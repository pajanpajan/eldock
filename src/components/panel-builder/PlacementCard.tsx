"use client";

import { useEffect, useState } from "react";
import { GripVertical, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWatts } from "@/lib/panel-builder/catalog";
import { ACCESSORY_SUBTYPES, describeConfig, isAccessorySubtype, type ItemConfig } from "@/lib/panel-builder/configurator";
import { VECTOR } from "@/lib/panel-builder/vector-layout";
import { deviceWithConfig, type VectorDevice } from "@/lib/panel-builder/vector-symbols";
import { previewConfigAction } from "@/server/actions/panel-design";
import type { ConfigPreview } from "@/server/services/panel-design";

import { VectorModuleSymbol } from "./VectorModuleSymbol";
import { PLACE_MIME } from "./VectorPanel";

const BLANK: VectorDevice = {
  id: "placement-preview",
  designation: "-?",
  dinRailIndex: 1,
  positionOnRail: 1,
  modulesWidth: 1,
  category: null,
  poles: null,
  manufacturer: null,
  typeCode: null,
  articleNumber: null,
  ratedCurrentA: null,
  curve: null,
  rcdType: null,
  rcdSensitivityMa: null,
  spdType: null,
  contactConfig: null,
  power: null,
  powerLossWatts: null,
  label: "",
  status: "VERIFIED",
};

const RELATION_LABELS: Record<string, string> = {
  SIDE_LEFT: "boční vlevo",
  SIDE_RIGHT: "boční vpravo",
  SIDE_UNSPECIFIED: "boční",
  REQUIRES_BOM_ITEM: "do kusovníku",
  COMPATIBLE_BUSBAR: "hřeben",
  ACCESSORY: "příslušenství",
};

/**
 * KROK D – „PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ“: živý 2D vektorový náhled v přesném počtu modulů, typ a MPN
 * z databáze, Pv a popis obvodu. Kartu jde opakovaně přetáhnout na libovolnou DIN lištu nebo vložit
 * tlačítky 1× / +3× / +6× na aktivní lištu.
 */
export function PlacementCard({
  config,
  label,
  onLabelChange,
  activeRail,
  rails,
  busy,
  onInsert,
  onAddRailInsert,
  assigned = null,
}: {
  config: ItemConfig | null;
  label: string;
  onLabelChange: (label: string) => void;
  activeRail: number;
  /** Volné moduly na každé liště (chytré vložení na jinou lištu, když se na aktivní nevejde). */
  rails: { index: number; free: number }[];
  busy: boolean;
  onInsert: (count: number, rail: number) => void;
  /** Žádná lišta nemá místo: přidat novou lištu a vložit na ni. */
  onAddRailInsert: (count: number) => void;
  /** Vybraný přístroj na liště: uložený katalogový kus (sloučená karta „Přiřazený přístroj“). */
  assigned?: { manufacturer: string; typeCode: string; articleNumber: string; modules: number; powerLossWatts: number; estimated: boolean } | null;
}) {
  const key = config ? JSON.stringify(config) : "";
  const [preview, setPreview] = useState<{ key: string; data: ConfigPreview } | null>(null);
  useEffect(() => {
    if (!config) return;
    const timer = setTimeout(async () => {
      const result = await previewConfigAction(config);
      if (result.ok) setPreview({ key: JSON.stringify(config), data: result.data });
    }, 150);
    return () => clearTimeout(timer);
  }, [config]);
  const shown = preview?.key === key ? preview.data : null;

  if (!config) {
    return (
      <section aria-label="Přiřazený přístroj k osazení" className="sticky top-2 z-20 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground" data-testid="placement-card">
        <h3 className="mb-1 text-xs font-bold tracking-wide uppercase">D. Přiřazený přístroj k osazení</h3>
        Vyberte výrobce a kategorii – karta s přístrojem se objeví tady a půjde přetáhnout na DIN lištu.
      </section>
    );
  }

  const device: VectorDevice = {
    ...deviceWithConfig({ ...BLANK, modulesWidth: config.modules }, config),
    modulesWidth: config.modules,
    typeCode: shown?.typeCode ?? null,
    label,
    power: config.category === "ACCESSORY" && isAccessorySubtype(config.moduleSubtype) ? ACCESSORY_SUBTYPES[config.moduleSubtype] : config.power ?? null,
  };
  const width = config.modules * VECTOR.moduleW;
  const freeOn = (rail: number) => rails.find((entry) => entry.index === rail)?.free ?? 0;
  /** Kam se `count` kusů vejde: aktivní lišta, jinak první lišta s místem, jinak nová lišta. */
  const target = (count: number) => {
    const need = config.modules * count - 1e-9;
    if (freeOn(activeRail) >= need) return { rail: activeRail, alternative: false };
    const other = rails.find((entry) => entry.free >= need);
    return other ? { rail: other.index, alternative: true } : null;
  };
  const insert = (count: number) => {
    const where = target(count);
    if (where) onInsert(count, where.rail);
    else onAddRailInsert(count);
  };
  const single = target(1);
  const n = (value: number) => String(value).replace(".", ",");

  return (
    <section aria-label="Přiřazený přístroj k osazení" className="sticky top-2 z-20 flex flex-col gap-3 rounded-xl border-2 border-sky-500/50 bg-card p-3 shadow-lg shadow-black/40" data-testid="placement-card">
      <h3 className="text-xs font-bold tracking-wide text-sky-200 uppercase">{assigned !== undefined && assigned !== null ? "Přiřazený přístroj" : "Přiřazený přístroj k osazení"}</h3>
      {assigned ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/40 px-2 py-1.5 text-sm" data-testid="assigned-device">
          <b>
            {assigned.manufacturer} {assigned.typeCode}
          </b>
          <span className="font-mono text-xs text-muted-foreground">({assigned.articleNumber})</span>
          <span className="text-xs text-muted-foreground">
            · Šířka: {assigned.modules}M · Ztrátový výkon: {formatWatts(assigned.powerLossWatts)}
          </span>
          {assigned.estimated ? <Badge variant="outline">odhad IEC</Badge> : null}
        </p>
      ) : null}
      <div className="flex gap-3">
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(PLACE_MIME, key);
            event.dataTransfer.setData("text/plain", describeConfig(config));
            event.dataTransfer.effectAllowed = "copy";
          }}
          className="flex shrink-0 cursor-grab flex-col items-center gap-1 rounded-lg border border-border bg-[#0b1220] p-2 active:cursor-grabbing"
          title="Chyťte a přetáhněte na DIN lištu (i opakovaně)"
          aria-label="Přetáhnout přístroj na DIN lištu"
          role="img"
          data-testid="placement-drag"
        >
          <svg viewBox={`-6 -6 ${width + 12} ${VECTOR.deviceH + 12}`} width={Math.max(52, width * 0.75)} height={(VECTOR.deviceH + 12) * 0.75} aria-hidden>
            <VectorModuleSymbol device={device} rect={{ x: 0, y: 0, w: width, h: VECTOR.deviceH }} theme="dark" />
          </svg>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <GripVertical className="size-3" aria-hidden /> táhnout na lištu
          </span>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] content-start gap-x-2 gap-y-1 text-xs" data-testid="placement-details">
          <dt className="text-muted-foreground">Typ</dt>
          <dd className="font-semibold">{shown ? `${shown.manufacturer} ${shown.typeCode}` : <Loader2 className="size-3 animate-spin" aria-label="Načítám" />}</dd>
          <dt className="text-muted-foreground">MPN</dt>
          <dd className="font-mono" data-testid="placement-mpn">
            {shown ? (shown.articleNumber ?? "—") : "…"}
            {shown?.estimated ? (
              <Badge variant="outline" className="ml-1.5">
                odhad IEC
              </Badge>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">Šířka</dt>
          <dd className="font-mono">{n(config.modules)} M</dd>
          <dt className="text-muted-foreground">Ztrátový výkon</dt>
          <dd className="font-mono">{shown ? formatWatts(shown.powerLossWatts) : "…"}</dd>
        </dl>
      </div>
      {shown?.accessories.length ? (
        <div className="text-[11px] text-muted-foreground" data-testid="placement-accessories">
          <b className="text-foreground">Příslušenství z databáze ({shown.accessoryCount}):</b>{" "}
          {shown.accessories.map((accessory) => `${accessory.typeCode} (${RELATION_LABELS[accessory.relationType] ?? accessory.relationType}${accessory.verified ? "" : ", neověřeno"})`).join(" · ")}
          {shown.accessoryCount > shown.accessories.length ? " …" : ""}
        </div>
      ) : null}
      <Input value={label} onChange={(event) => onLabelChange(event.target.value)} maxLength={80} placeholder="Popis obvodu, např. Zásuvky kuchyně" aria-label="Popis obvodu nového přístroje" className="h-9" />
      <div className="flex flex-wrap gap-2">
        <Button className="touch-target flex-1 gap-1.5" disabled={busy} onClick={() => insert(1)} data-testid="insert-1">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}{" "}
          {!single ? "+ Přidat novou lištu a vložit" : single.alternative ? `Vložit na Lištu ${single.rail} (volno ${n(freeOn(single.rail))} M)` : "Vložit na aktivní lištu (1×)"}
        </Button>
        {[3, 6].map((count) => {
          const where = target(count);
          return (
            <Button
              key={count}
              variant="secondary"
              className="touch-target"
              disabled={busy}
              onClick={() => insert(count)}
              aria-label={`Vložit ${count}× na aktivní lištu`}
              title={!where ? "Přidá novou lištu a vloží na ni" : where.alternative ? `Na aktivní lištu se nevejde – vloží na lištu ${where.rail}` : undefined}
            >
              +{count}×
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="placement-target">
        Aktivní lišta {activeRail} · volno {n(Math.max(0, freeOn(activeRail)))} M
      </p>
    </section>
  );
}
