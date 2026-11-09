// Fáze 71 a 73: přehled – vyhledání zařízení (označení, název, výrobní číslo; čtečka čárových kódů píše sem),
// skenování QR štítku (nativně v mobilní aplikaci, jinak kamerou), závody → budovy → patra a zařízení, která vyžadují
// pozornost. Na telefonu je hledání nahoře a budovy s patry pod ním (rozbalovací).

import { AlertTriangle, Building2, ChevronDown, ChevronRight, Layers, QrCode, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount } from "@/lib/format";
import { EQUIPMENT_STATUS, INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentRecord, FloorRecord } from "@/sync-client";

import type { Navigation } from "../App";
import { touchUi } from "../bridge";
import { useAll } from "../data";
import { useScanResolver, useScanner } from "../scan";
import { Button, Empty, Section, Spinner, StatusBadge, inputClass } from "../ui";

import { byEquipment, equipmentFlags, equipmentSearchText, needsAttention, searchKey, type EquipmentFlags } from "./equipment-state";

const MAX_RESULTS = 200;

export function HomeScreen({ navigation, initialQuery = "" }: { navigation: Navigation; initialQuery?: string }) {
  const plants = useAll("Plant");
  const buildings = useAll("Building");
  const floors = useAll("Floor");
  const equipment = useAll("Equipment");
  const inspections = useAll("InspectionRecord");
  const defects = useAll("InspectionDefect");
  const mods = useAll("TemporaryModification");
  const [query, setQuery] = useState(initialQuery);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [showFloors, setShowFloors] = useState(false);
  const { scan } = useScanner();
  const resolve = useScanResolver(navigation, setQuery);

  const flags = useMemo(() => {
    const now = new Date();
    const inspectionsBy = byEquipment(inspections);
    const defectsBy = byEquipment(defects);
    const modsBy = byEquipment(mods);
    return new Map((equipment ?? []).map((item) => [item.id, equipmentFlags(inspectionsBy.get(item.id) ?? [], defectsBy.get(item.id) ?? [], modsBy.get(item.id) ?? [], now)]));
  }, [equipment, inspections, defects, mods]);

  const floorById = useMemo(() => new Map((floors ?? []).map((floor) => [floor.id, floor])), [floors]);
  const buildingById = useMemo(() => new Map((buildings ?? []).map((building) => [building.id, building])), [buildings]);
  const locationOf = (item: EquipmentRecord) => {
    const floor = floorById.get(item.floorId);
    const building = floor ? buildingById.get(floor.buildingId) : undefined;
    return [building?.name, floor?.name].filter(Boolean).join(" · ");
  };

  const selectedFloor = floorId ? floorById.get(floorId) : undefined;
  const floorTitle = selectedFloor ? [buildingById.get(selectedFloor.buildingId)?.name, selectedFloor.name].filter(Boolean).join(" · ") : "";
  const sorted = useMemo(() => [...(equipment ?? [])].sort((a, b) => a.tag.localeCompare(b.tag, "cs", { numeric: true })), [equipment]);
  const key = searchKey(query.trim());
  const results = key ? sorted.filter((item) => equipmentSearchText(item).includes(key)) : floorId ? sorted.filter((item) => item.floorId === floorId) : [];
  const attention = sorted.filter((item) => {
    const itemFlags = flags.get(item.id);
    return itemFlags ? needsAttention(itemFlags) : false;
  });

  if (!equipment || !plants || !buildings || !floors) {
    return (
      <div className="p-6">
        <Spinner label="Načítám data závodu…" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <aside className="order-2 space-y-3 lg:order-1 lg:w-72 lg:shrink-0">
        {plants.length ? (
          <button type="button" className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium lg:hidden" onClick={() => setShowFloors((value) => !value)} aria-expanded={showFloors} data-testid="floors-toggle">
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-primary" aria-hidden />
              Budovy a patra ({floors.length})
            </span>
            <ChevronDown className={cn("size-4 transition-transform", showFloors && "rotate-180")} aria-hidden />
          </button>
        ) : (
          <Empty>Data závodu zatím nejsou stažená – připojte se k síti a synchronizujte.</Empty>
        )}
        <div className={cn("space-y-3 lg:block", showFloors ? "block" : "hidden")}>
          {[...plants]
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((plant) => (
              <nav key={plant.id} className="space-y-2 rounded-xl border border-border bg-card p-3" aria-label={plant.name}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="size-4 text-primary" aria-hidden />
                  {plant.name}
                </p>
                {buildings
                  .filter((building) => building.plantId === plant.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
                  .map((building) => (
                    <div key={building.id} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{building.name}</p>
                      {floors
                        .filter((floor) => floor.buildingId === building.id)
                        .sort((a, b) => a.level - b.level)
                        .map((floor) => (
                          <FloorButton
                            key={floor.id}
                            floor={floor}
                            active={floor.id === floorId && !key}
                            count={equipment.filter((item) => item.floorId === floor.id).length}
                            onClick={() => {
                              setQuery("");
                              setFloorId(floor.id);
                              setShowFloors(false);
                            }}
                          />
                        ))}
                    </div>
                  ))}
              </nav>
            ))}
        </div>
      </aside>

      <div className="order-1 min-w-0 flex-1 space-y-4 lg:order-2">
        <form
          className="flex gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) void resolve(query.trim());
          }}
        >
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              className={cn(inputClass, "h-12 pl-9 text-base sm:text-base")}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={touchUi ? "Hledat zařízení – označení, název…" : "Hledat zařízení – označení, název, výrobní číslo… nebo naskenujte štítek čtečkou"}
              aria-label="Hledat zařízení"
              autoFocus={!touchUi}
              data-testid="search-input"
            />
          </label>
          <Button size="lg" className="shrink-0 px-4" onClick={() => void scan(resolve)} aria-label="Skenovat QR štítek" data-testid="scan-open">
            <QrCode className="size-5" aria-hidden />
            <span className="hidden sm:inline">Skenovat QR</span>
          </Button>
        </form>

        {key || floorId ? (
          <Section title={key ? `Výsledky hledání (${results.length})` : floorTitle} icon={<Search className="size-4 text-primary" aria-hidden />}>
            {results.length ? <EquipmentList items={results.slice(0, MAX_RESULTS)} flags={flags} locationOf={locationOf} onOpen={(id) => navigation.open({ name: "equipment", id })} /> : <Empty>Žádné zařízení.</Empty>}
            {results.length > MAX_RESULTS ? <p className="text-xs text-muted-foreground">Zobrazeno prvních {MAX_RESULTS} – zpřesněte hledání.</p> : null}
          </Section>
        ) : null}

        <Section title={`Vyžaduje pozornost (${attention.length})`} icon={<AlertTriangle className="size-4 text-amber-400" aria-hidden />} testId="attention">
          {attention.length ? (
            <EquipmentList items={attention} flags={flags} locationOf={locationOf} onOpen={(id) => navigation.open({ name: "equipment", id })} />
          ) : (
            <Empty>Žádné zařízení s propadlou revizí, závadou nebo provizoriem po termínu.</Empty>
          )}
        </Section>
        <p className="text-xs text-muted-foreground">
          V zařízení: {formatCount(equipment.length, ["zařízení", "zařízení", "zařízení"])} ve {formatCount(floors.length, ["patře", "patrech", "patrech"])}.
        </p>
      </div>
    </div>
  );
}

function FloorButton({ floor, active, count, onClick }: { floor: FloorRecord; active: boolean; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm lg:py-1.5", active ? "bg-primary/15 text-primary" : "hover:bg-muted")} data-testid={`floor-${floor.id}`}>
      <span className="flex items-center gap-2">
        <Layers className="size-3.5" aria-hidden />
        {floor.name}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

export function EquipmentList({ items, flags, locationOf, onOpen }: { items: EquipmentRecord[]; flags: Map<string, EquipmentFlags>; locationOf: (item: EquipmentRecord) => string; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border" data-testid="equipment-list">
      {items.map((item) => {
        const Icon = EQUIPMENT_TYPE_ICONS[item.type];
        const itemFlags = flags.get(item.id);
        return (
          <li key={item.id}>
            <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/60 sm:py-2.5" onClick={() => onOpen(item.id)} data-testid={`equipment-${item.id}`}>
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono font-semibold">{item.tag}</span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {EQUIPMENT_TYPE_LABELS[item.type]} · {locationOf(item)}
                </span>
                {/* Na telefonu stavy pod názvem (vedle by se nevešly) */}
                <EquipmentBadges item={item} flags={itemFlags} className="mt-1 flex sm:hidden" />
              </span>
              <EquipmentBadges item={item} flags={itemFlags} className="hidden justify-end sm:flex" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EquipmentBadges({ item, flags, className }: { item: EquipmentRecord; flags: EquipmentFlags | undefined; className?: string }) {
  const badges = [
    item.status !== "ACTIVE" ? <StatusBadge key="status" style={EQUIPMENT_STATUS[item.status]} /> : null,
    flags && flags.inspection !== "VALID" && flags.inspection !== "MISSING" ? <StatusBadge key="inspection" style={INSPECTION_STATE[flags.inspection]} /> : null,
    flags?.openDefects ? (
      <span key="defects" className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
        {formatCount(flags.openDefects, ["závada", "závady", "závad"])}
      </span>
    ) : null,
    flags?.activeMods ? (
      <span key="mods" className={cn("rounded-full border px-2 py-0.5 text-xs", flags.overdueMods ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>
        {formatCount(flags.activeMods, ["provizorium", "provizoria", "provizorií"])}
      </span>
    ) : null,
  ].filter(Boolean);
  if (!badges.length) return null;
  return <span className={cn("flex-wrap gap-1", className)}>{badges}</span>;
}
