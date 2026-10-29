"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { EyeOff, Search, X } from "lucide-react";
import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

import { StatusLegend } from "@/components/common/StatusLegend";
import { BatchInspectionBar } from "@/components/inspections/BatchInspectionBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";
import { matchesFilter, searchEquipment } from "@/lib/equipment-filter";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { DEFAULT_LAYERS, layerCounts, layerOf, matchesLayers, type LayerKey } from "@/lib/map-layers";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { FloorView } from "@/server/queries/floor";

import { pinElementId } from "./EquipmentPin";
import { EquipmentQuickView } from "./EquipmentQuickView";
import { FloorEquipmentTable } from "./FloorEquipmentTable";
import { FloorplanViewer } from "./FloorplanViewer";
import { MapLayersPanel } from "./MapLayersPanel";

const STATUSES: EquipmentStatus[] = ["ACTIVE", "PENDING_UPDATE", "WAITING_APPROVAL"];

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Půdorys patra: vrstvy, filtry, hledání tagu, zoomovatelný viewer, tabulka s hromadnou revizí a rychlý náhled. */
export function FloorExplorer({
  floor,
  showInspections = true,
  canBatchInspect = true,
  scopeLabel = null,
}: {
  floor: FloorView;
  /** Lhůtník revizí (CAE ne). */
  showInspections?: boolean;
  /** Hromadná revize v tabulce. */
  canBatchInspect?: boolean;
  /** Výřez dat účtu („Revizní technik VTZ: …“). */
  scopeLabel?: string | null;
}) {
  const [spider, setSpider] = useState(false);
  const apiRef = useRef<ReactZoomPanPinchRef>(null);
  const [statuses, setStatuses] = useState<ReadonlySet<EquipmentStatus>>(new Set());
  const [types, setTypes] = useState<ReadonlySet<EquipmentType>>(new Set());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [layers, setLayers] = useState<ReadonlySet<LayerKey>>(DEFAULT_LAYERS);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  const layerFilter = { layers, attentionOnly };
  const inLayers = floor.equipment.filter((item) => matchesLayers(item, layerFilter));
  const presentTypes = [...new Set(inLayers.map((item) => item.type))];
  const visible = inLayers.filter((item) => matchesFilter(item, { statuses, types }));
  const counts = useMemo(() => layerCounts(floor.equipment), [floor.equipment]);
  const matches = searchEquipment(floor.equipment, query).slice(0, 6);
  const selected = floor.equipment.find((item) => item.id === selectedId) ?? null;
  const filtered = statuses.size > 0 || types.size > 0;
  const batchItems = floor.equipment.filter((item) => checked.has(item.id));

  function select(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  /** Najde pin, zruší filtry, které ho skrývají, a přiblíží na něj. */
  function focusEquipment(id: string) {
    const item = floor.equipment.find((equipment) => equipment.id === id);
    if (!item) return;
    if (!matchesFilter(item, { statuses, types })) {
      setStatuses(new Set());
      setTypes(new Set());
    }
    if (!matchesLayers(item, layerFilter)) {
      setAttentionOnly(false);
      setLayers((current) => new Set([...current, layerOf(item.type)]));
    }
    setSelectedId(id);
    setQuery("");
    // Pin musí být v DOM (po případném zrušení filtrů) – počkat na další snímek.
    requestAnimationFrame(() => {
      const element = document.getElementById(pinElementId(id));
      if (element) apiRef.current?.zoomToElement(element, 3, 400);
      element?.focus({ preventScroll: true });
    });
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    if (matches[0]) focusEquipment(matches[0].id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <form onSubmit={onSearch} className="relative w-full sm:w-72" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat tag, např. R-CNC-04"
            aria-label="Hledat zařízení podle tagu"
            className="h-11 pl-9"
          />
          {query && matches.length > 0 ? (
            <ul className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => focusEquipment(item.id)}
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className={cn("size-2.5 rounded-full", EQUIPMENT_STATUS[item.status].dot)} aria-hidden />
                    <span className="font-mono font-semibold">{item.tag}</span>
                    <span className="truncate text-muted-foreground">{item.name.replace(`${item.tag} - `, "")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {query && matches.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Na tomto patře nic nenalezeno.</p>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtr stavu">
          {STATUSES.map((status) => {
            const style = EQUIPMENT_STATUS[status];
            const active = statuses.has(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setStatuses((current) => toggle(current, status))}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? style.badge : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("size-2.5 rounded-full", style.dot)} aria-hidden />
                {style.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtr typu">
          {presentTypes.map((type) => {
            const Icon = EQUIPMENT_TYPE_ICONS[type];
            const active = types.has(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setTypes((current) => toggle(current, type))}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {EQUIPMENT_TYPE_LABELS[type]}
              </button>
            );
          })}
          {filtered ? (
            <Button
              variant="ghost"
              className="touch-target"
              onClick={() => {
                setStatuses(new Set());
                setTypes(new Set());
              }}
            >
              <X className="size-4" />
              Zrušit filtry
            </Button>
          ) : null}
        </div>
      </div>

      {scopeLabel ? (
        <p className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-200" data-testid="account-scope">
          <EyeOff className="size-4 shrink-0" aria-hidden />
          Výřez účtu – {scopeLabel}
        </p>
      ) : null}

      <MapLayersPanel
        layers={layers}
        counts={counts}
        attentionOnly={attentionOnly}
        showAttention={showInspections}
        onToggleLayer={(key) => setLayers((current) => toggle(current, key))}
        onToggleAttention={() => setAttentionOnly((value) => !value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-pressed={spider}
          onClick={() => setSpider((value) => !value)}
          className={cn("touch-target gap-2", spider && "border-yellow-400 bg-yellow-400/15 text-yellow-200")}
        >
          ⚡ Zobrazit pavouka napájení (Hierarchie)
        </Button>
        {spider ? <span className="text-xs text-muted-foreground">Žlutě vývody z rozváděčů patra, modře napájení z jiného patra nebo skryté vrstvy.</span> : null}
      </div>

      <FloorplanViewer
        svg={floor.floorplanSvg}
        viewBox={floor.viewBox}
        equipment={visible}
        selectedId={selectedId}
        onSelect={select}
        apiRef={apiRef}
        spider={spider}
        showInspections={showInspections}
      />
      <StatusLegend
        extra={<span>Kolečko myši / dva prsty = zoom · tažení = posun · dvojklik = přiblížit</span>}
      />

      <section aria-label="Zařízení patra" className="space-y-2">
        <h2 className="text-lg font-semibold">
          Zařízení na patře{" "}
          <span className="font-mono text-sm text-muted-foreground">
            {visible.length}
            {visible.length !== floor.equipment.length ? ` / ${floor.equipment.length}` : ""}
          </span>
        </h2>
        <FloorEquipmentTable
          equipment={visible}
          selectedId={selectedId}
          onSelect={select}
          checked={checked}
          onCheckedChange={setChecked}
          selectable={canBatchInspect}
          showInspections={showInspections}
        />
      </section>

      {canBatchInspect ? <BatchInspectionBar items={batchItems} today={floor.today} onClear={() => setChecked(new Set())} /> : null}

      <EquipmentQuickView equipment={sheetOpen ? selected : null} onOpenChange={setSheetOpen} />
    </div>
  );
}
