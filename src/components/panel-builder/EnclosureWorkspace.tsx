"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ENCLOSURE_MANUFACTURERS, INSTALLATION_LABELS, fitsEnclosure, ipNumber, reservePercent, type EnclosureInstallation, type EnclosureLike, type EnclosureNeed } from "@/lib/panel-builder/enclosures";
import { cn } from "@/lib/utils";
import { selectEnclosureAction } from "@/server/actions/panel-design";

import { ManufacturerLogo } from "./ManufacturerLogo";

/** Doporučená rezerva modulů ve skříni (ČSN EN 61439-3 – projekční zásada, místo na doplnění). */
export const RECOMMENDED_RESERVE_PCT = 20;

const MATERIAL_LABEL: Record<string, string> = { PLASTIC: "plast", PAINTED_STEEL: "lakovaná ocel", STAINLESS_STEEL: "nerez" };
const n = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** Hodnocení skříně proti požadavku návrhu: vejde se, krytí, ztráty a rezerva. */
export function rateEnclosure(enclosure: EnclosureLike, need: EnclosureNeed, input: { minIp: number; lossW: number | null }) {
  const fits = fitsEnclosure(enclosure, need);
  const ipOk = ipNumber(enclosure.ipRating) >= input.minIp;
  const heatOk = input.lossW === null || enclosure.pMaxW === null ? null : input.lossW <= enclosure.pMaxW;
  const reserve = reservePercent(enclosure, need);
  return { fits, ipOk, heatOk, reserve, ok: fits && ipOk && heatOk !== false };
}

/** Náhled zaplnění skříně: řady × moduly, obsazené moduly návrhu podle lišt (zbytek = rezerva). */
function FillPreview({ enclosure, used }: { enclosure: Pick<EnclosureLike, "rows" | "modulesPerRow">; used: readonly number[] }) {
  const rows = Array.from({ length: enclosure.rows }, (_, index) => Math.min(enclosure.modulesPerRow, used[index] ?? 0));
  const width = enclosure.modulesPerRow * 6 + 8;
  const height = enclosure.rows * 12 + 8;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full max-w-40" role="img" aria-label={`Zaplnění skříně ${rows.reduce((sum, value) => sum + value, 0)} z ${enclosure.rows * enclosure.modulesPerRow} modulů`}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={3} fill="#18181b" stroke="#52525b" />
      {rows.map((filled, row) =>
        Array.from({ length: enclosure.modulesPerRow }, (_, module) => (
          <rect key={`${row}-${module}`} x={4 + module * 6} y={4 + row * 12} width={5} height={10} rx={1} fill={module < filled ? "#facc15" : "#3f3f46"} opacity={module < filled ? 0.95 : 0.6} />
        )),
      )}
    </svg>
  );
}

/**
 * Fáze 75: krok 3 – výběr skříně rozváděče na celé stránce. Požadavek návrhu (řady, nejširší lišta, obsazené moduly,
 * rezerva, krytí z prostředí, ztrátový výkon), filtry výrobce, montáže, materiálu a krytí, doporučená skříň a náhled
 * zaplnění u každé skříně. Volba se propíše do projektu i výpočtu oteplení (`selectEnclosureAction`).
 */
export function EnclosureWorkspace({
  projectId,
  need,
  railUsed,
  catalog,
  current,
  minIp,
  recommendedIp,
  lossW,
  preferredManufacturer,
}: {
  projectId: string;
  need: EnclosureNeed;
  /** Obsazené moduly jednotlivých lišt návrhu (náhled zaplnění). */
  railUsed: number[];
  catalog: EnclosureLike[];
  current: { model: string; enclosureId: string | null };
  minIp: number;
  recommendedIp: number;
  /** Ztrátový výkon návrhu z výpočtu oteplení [W] (null = neznámý). */
  lossW: number | null;
  preferredManufacturer: string;
}) {
  const router = useRouter();
  const brands = useMemo(() => ENCLOSURE_MANUFACTURERS.filter((brand) => catalog.some((row) => row.manufacturer.toLowerCase() === brand.toLowerCase())), [catalog]);
  const [manufacturer, setManufacturer] = useState<string>(() => brands.find((brand) => brand.toLowerCase() === preferredManufacturer.toLowerCase()) ?? "ALL");
  const [mounting, setMounting] = useState<EnclosureInstallation | "ALL">("ALL");
  const [material, setMaterial] = useState<string>("ALL");
  const [ipFloor, setIpFloor] = useState<number>(minIp);
  const [reserveOnly, setReserveOnly] = useState(true);
  const [saving, startSaving] = useTransition();
  const active = catalog.find((row) => row.id === current.enclosureId) ?? null;
  const rate = (row: EnclosureLike) => rateEnclosure(row, need, { minIp, lossW });
  const rows = catalog
    .filter((row) => manufacturer === "ALL" || row.manufacturer.toLowerCase() === manufacturer.toLowerCase())
    .filter((row) => mounting === "ALL" || row.installation === mounting)
    .filter((row) => material === "ALL" || row.material === material)
    .filter((row) => ipNumber(row.ipRating) >= ipFloor)
    .filter((row) => fitsEnclosure(row, need))
    .filter((row) => !reserveOnly || reservePercent(row, need) >= RECOMMENDED_RESERVE_PCT)
    .sort((a, b) => a.totalModules - b.totalModules || a.rows - b.rows || a.heightMm - b.heightMm || a.model.localeCompare(b.model));
  // Doporučená: nejmenší vyhovující skříň (krytí, ztráty, rezerva 20 %), přednostně od výrobce přístrojů
  // (ověřený P_max ≥ ztráty má přednost před skříní bez údaje P_max)
  const preferred = (row: EnclosureLike) => Number(row.manufacturer.toLowerCase() === preferredManufacturer.toLowerCase());
  const recommended = [...rows].filter((row) => rate(row).ok && rate(row).reserve >= RECOMMENDED_RESERVE_PCT).sort((a, b) => Number(rate(b).heatOk === true) - Number(rate(a).heatOk === true) || preferred(b) - preferred(a))[0] ?? null;

  function choose(row: EnclosureLike) {
    startSaving(async () => {
      const result = await selectEnclosureAction(projectId, row.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Skříň ${result.data.enclosureModel} propsána do projektu a výpočtu oteplení – pokračujte dalším krokem.`);
      router.refresh();
    });
  }

  const state = active ? rate(active) : null;
  return (
    <div className="flex flex-col gap-4" data-testid="enclosure-workspace">
      <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-bold">Požadavek návrhu</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3" data-testid="enclosure-need">
            <div>
              <dt className="text-xs text-muted-foreground">DIN lišty (řady)</dt>
              <dd className="font-mono font-bold">{need.rails}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Nejširší lišta</dt>
              <dd className="font-mono font-bold">{need.maxModulesPerRail} M</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Obsazeno</dt>
              <dd className="font-mono font-bold">{n(need.usedModules)} M</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Krytí z prostředí</dt>
              <dd className="font-mono font-bold">
                min. IP {minIp} <span className="font-normal text-muted-foreground">(doporučeno IP {recommendedIp})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ztrátový výkon</dt>
              <dd className="font-mono font-bold">{lossW === null ? "–" : `${n(lossW)} W`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rezerva</dt>
              <dd className="font-mono font-bold">≥ {RECOMMENDED_RESERVE_PCT} % modulů</dd>
            </div>
          </dl>
        </div>
        <div className={cn("rounded-xl border p-4", !active ? "border-dashed border-amber-500/60 bg-amber-500/5" : state?.ok ? "border-emerald-500/60 bg-emerald-500/5" : "border-amber-500/60 bg-amber-500/5")} data-testid="enclosure-current">
          <h2 className="mb-2 font-bold">Vybraná skříň</h2>
          {active && state ? (
            <div className="flex gap-3">
              <FillPreview enclosure={active} used={railUsed} />
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <b>
                  {active.manufacturer} {active.model}
                </b>
                <span className="text-xs text-muted-foreground">
                  {active.rows} × {active.modulesPerRow} M · {active.heightMm} × {active.widthMm} × {active.depthMm} mm · {active.ipRating} · {MATERIAL_LABEL[active.material] ?? active.material}
                </span>
                <span className="flex flex-wrap gap-1 text-[11px]">
                  <Badge ok={state.fits} text={state.fits ? "návrh se vejde" : "návrh se nevejde"} />
                  <Badge ok={state.ipOk} text={`krytí ${active.ipRating}`} />
                  <Badge ok={state.reserve >= RECOMMENDED_RESERVE_PCT} text={`rezerva ${state.reserve} %`} />
                  {state.heatOk !== null ? <Badge ok={state.heatOk} text={`P_max ${n(active.pMaxW ?? 0)} W`} /> : null}
                </span>
              </div>
            </div>
          ) : current.model ? (
            <p className="text-sm">
              {current.model} <span className="text-muted-foreground">– zadaná ručně (bez katalogové skříně); vyberte skříň z nabídky níže pro kontrolu zaplnění a P_max.</span>
            </p>
          ) : (
            <p className="text-sm text-amber-200">Zatím bez skříně – vyberte ji níže (doporučená je označená).</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Filtry skříní">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Výrobce skříně">
          <button type="button" role="radio" aria-checked={manufacturer === "ALL"} onClick={() => setManufacturer("ALL")} className={cn("flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold", manufacturer === "ALL" ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")} data-testid="enclosure-brand-all">
            Všichni výrobci
          </button>
          {brands.map((brand) => (
            <button key={brand} type="button" role="radio" aria-checked={manufacturer === brand} aria-label={brand} onClick={() => setManufacturer(brand)} className={cn("flex min-h-10 items-center gap-2 rounded-lg border bg-white px-2", manufacturer === brand ? "border-primary ring-2 ring-primary" : "border-border")} data-testid={`enclosure-brand-${brand}`}>
              <ManufacturerLogo manufacturer={brand} className="h-6 w-16" />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            Montáž
            <select value={mounting} onChange={(event) => setMounting(event.target.value as EnclosureInstallation | "ALL")} className="h-8 rounded-md border border-input bg-transparent px-1.5 dark:bg-input/30" data-testid="enclosure-mounting">
              <option value="ALL">vše</option>
              {(Object.keys(INSTALLATION_LABELS) as EnclosureInstallation[]).map((key) => (
                <option key={key} value={key}>
                  {INSTALLATION_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Materiál
            <select value={material} onChange={(event) => setMaterial(event.target.value)} className="h-8 rounded-md border border-input bg-transparent px-1.5 dark:bg-input/30" data-testid="enclosure-material">
              <option value="ALL">vše</option>
              <option value="PLASTIC">plast</option>
              <option value="PAINTED_STEEL">lakovaná ocel</option>
              <option value="STAINLESS_STEEL">nerez</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Krytí od
            <select value={ipFloor} onChange={(event) => setIpFloor(Number(event.target.value))} className="h-8 rounded-md border border-input bg-transparent px-1.5 dark:bg-input/30" data-testid="enclosure-ip">
              {[...new Set([minIp, 30, 40, 41, 43, 44, 54, 65, 66])].filter((value) => value >= minIp).sort((a, b) => a - b).map((value) => (
                <option key={value} value={value}>
                  IP {value}
                  {value === minIp ? " (min. pro prostředí)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={reserveOnly} onChange={(event) => setReserveOnly(event.target.checked)} data-testid="enclosure-reserve" />
            jen s rezervou ≥ {RECOMMENDED_RESERVE_PCT} %
          </label>
          <span className="ml-auto text-muted-foreground" data-testid="enclosure-count">
            {rows.length} {rows.length === 1 ? "skříň" : rows.length >= 2 && rows.length <= 4 ? "skříně" : "skříní"}
          </span>
        </div>
      </section>

      {rows.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Vyhovující skříně" data-testid="enclosure-cards">
          {rows.map((row) => {
            const rating = rate(row);
            const chosen = row.id === current.enclosureId;
            const best = recommended?.id === row.id;
            return (
              <li key={row.id} className={cn("flex flex-col gap-2 rounded-xl border p-3", chosen ? "border-emerald-500 bg-emerald-500/10" : best ? "border-primary bg-primary/10" : "border-border bg-card")} data-testid="enclosure-card" data-recommended={best ? "true" : undefined}>
                <div className="flex items-start gap-2">
                  <FillPreview enclosure={row} used={railUsed} />
                  <div className="min-w-0 flex-1 text-sm">
                    <b className="block">
                      {row.manufacturer} {row.model}
                    </b>
                    <span className="block text-xs text-muted-foreground">
                      {row.rows} × {row.modulesPerRow} M · {INSTALLATION_LABELS[row.installation as EnclosureInstallation] ?? row.installation} · {MATERIAL_LABEL[row.material] ?? row.material}
                    </span>
                    <span className="block font-mono text-xs">
                      {row.heightMm} × {row.widthMm} × {row.depthMm} mm · {row.ipRating}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {best ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">
                      <Sparkles className="size-3" aria-hidden /> Doporučená
                    </span>
                  ) : null}
                  <Badge ok={rating.reserve >= RECOMMENDED_RESERVE_PCT} text={`rezerva ${rating.reserve} %`} />
                  {rating.heatOk !== null ? <Badge ok={rating.heatOk} text={`P_max ${n(row.pMaxW ?? 0)} W`} /> : <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">P_max neuveden</span>}
                  {row.dataSource === "STANDARD_MATRIX" ? <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">orientační rozměry</span> : null}
                </div>
                <Button type="button" size="sm" variant={chosen ? "outline" : best ? "default" : "outline"} className="mt-auto gap-1.5" disabled={saving || chosen} onClick={() => choose(row)} data-testid="enclosure-choose">
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : chosen ? <Check className="size-4" aria-hidden /> : null}
                  {chosen ? "Vybraná skříň" : "Vybrat tuto skříň"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-amber-500/60 p-6 text-center text-sm text-amber-200" data-testid="enclosure-none">
          Žádná skříň s těmito filtry návrh nepojme (potřeba {need.rails} řad × {need.maxModulesPerRail} M, {n(need.usedModules)} M obsazeno). Zkuste jiného výrobce, montáž nebo vypněte rezervu 20 %.
        </p>
      )}
    </div>
  );
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", ok ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200")}>
      {ok ? <CheckCircle2 className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
      {text}
    </span>
  );
}
