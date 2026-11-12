"use client";

import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleAlert, Loader2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { analyzeDraft, generationChecklist } from "@/lib/panel-builder/floorplan-editor";
import { ENVIRONMENTS, environmentOf, type EnvironmentId } from "@/lib/panel-builder/environments";
import { ROUTING_LABEL, type RouteStyle } from "@/lib/panel-builder/floorplan-editor";
import type { CableRoutingMode, Protection } from "@/engine/floorplan-bridge";
import { cn } from "@/lib/utils";

import { PanelSection } from "./RightPanels";

type Analysis = ({ ok: true } & ReturnType<typeof analyzeDraft>) | { ok: false; error: string };

const m = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m`;
const SHORT: Record<CableRoutingMode, string> = { BOTTOM: "Spodem", TOP: "Vrchem", OPTIMIZED: "Optimalizovaně" };

/** Živý výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4) + „⚡ Vygenerovat rozváděč z tohoto půdorysu“. */
/** „RCBO B10 typ A 30 mA“ / „B16 → chránič typ B“. */
function protectionLabel(protection: Protection): string {
  const base = `${protection.curve}${protection.ratedA}${protection.poles === "3P" ? " 3P" : ""}`;
  return protection.device === "RCBO" ? `RCBO ${base} typ ${protection.rcd?.type ?? "A"} ${protection.rcd?.sensitivityMa ?? 30} mA` : base;
}

export function CablePanel({
  analysis,
  mode,
  pending,
  onGenerate,
  slackPercent,
  environment,
  onEnvironment,
  checklist,
  manufacturers = [],
  wallFloors = 0,
  floorCount = 1,
  defaults,
  boards = [],
  routeStyle = "walls",
}: {
  analysis: Analysis;
  mode: CableRoutingMode;
  pending: boolean;
  onGenerate: (form: FormData) => void;
  slackPercent: number;
  environment: EnvironmentId | null;
  onEnvironment: (environment: EnvironmentId | null) => void;
  checklist: ReturnType<typeof generationChecklist>;
  /** Fáze 60: výrobci celého rozváděče (jističe + chrániče v databázi). */
  manufacturers?: readonly { name: string; count: number }[];
  /** Fáze 60: počet podlaží s trasami podél stěn (místnosti / příčky) z celkového počtu podlaží. */
  wallFloors?: number;
  floorCount?: number;
  /** Fáze 64: zákazník a místo stavby z údajů uloženého půdorysu (předvyplnění formuláře). */
  /** Fáze 99: i název půdorysu – rozváděč dostane „RH – <název půdorysu>“ (demo scénáře, pojmenované zakázky). */
  defaults?: { customer: string | null; site: string | null; name?: string | null };
  /** Fáze 74: rozváděče nákresu (RH, RP1 …) – podružné vzniknou jako propojené projekty. */
  boards?: readonly string[];
  /** Fáze 76: styl tras (po stěnách / nejkratší v podlaze). */
  routeStyle?: RouteStyle;
}) {
  const circuitById = new Map(analysis.ok ? analysis.circuits.circuits.map((circuit) => [circuit.id, circuit]) : []);
  // Fáze 76: dvě sbalovací karty pravého sloupce – výkaz kabeláže a založení rozváděče
  return (
    <>
    <PanelSection id="cables" title="Výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4)" ariaLabel="Výkaz kabeláže a okruhů" testId="cable-panel" badge={analysis.ok ? <span className="font-mono text-[11px] font-normal text-muted-foreground">{m(analysis.summary.totals[mode])}</span> : null}>
      {!analysis.ok ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground" data-testid="cable-empty">
          {analysis.error}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5" data-testid="cable-totals">
            {(["BOTTOM", "TOP", "OPTIMIZED"] as const).map((key) => (
              <div key={key} className={cn("rounded-lg border p-2", key === mode ? "border-primary bg-primary/10" : "border-border")} data-mode={key}>
                <p className="text-[11px] text-muted-foreground">{SHORT[key]}</p>
                <p className="font-mono text-base font-bold tabular-nums">{m(analysis.summary.totals[key])}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-300" data-testid="cable-saving">
            Optimalizovaně: {m(analysis.summary.totals.OPTIMIZED)} – ušetřeno {m(analysis.summary.savingVsBottomM)} oproti vedení spodem a {m(analysis.summary.savingVsTopM)} oproti vedení vrchem.
          </p>
          {/* Fáze 60: trasy podél stěn a pořadí prvků nezávislé na pořadí kreslení */}
          <p className={cn("text-xs", wallFloors || routeStyle === "direct" ? "text-sky-200" : "text-amber-200")} data-testid="cable-walls">
            {/* Fáze 76: obvodový router (po stěnách) nebo nejkratší přímé trasy podlahou */}
            {routeStyle === "direct"
              ? "Styl 📐 Nejkratší v podlaze: přímé pravoúhlé trasy podlahou (husí krky v betonu), nevedou po stěnách."
              : wallFloors
                ? `Trasy vedou podél stěn obvodově v instalačních zónách (${wallFloors === floorCount ? "všechna podlaží" : `${wallFloors} z ${floorCount} podlaží`}) – v místnosti bez průchodu středem a bez vracení po stěně.`
                : "Trasy zatím pravoúhle – zakreslete místnosti nebo nové příčky (Úprava PDF), pak povedou podél stěn."}{" "}
            Pořadí prvků v okruzích se vždy přepočítá na nejkratší
            {analysis.summary.orderSavingM > 0 ? ` – o ${m(analysis.summary.orderSavingM)} kratší než v pořadí kreslení.` : "."}
          </p>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Kabely k nákupu – {ROUTING_LABEL[mode]} (vč. rezervy {slackPercent} % a přídavků na zapojení)</p>
            <ul className="flex flex-col gap-0.5" data-testid="cable-buy">
              {analysis.summary.byCable.map((row) => (
                <li key={row.cable} className="flex justify-between gap-2 rounded bg-muted/40 px-2 py-0.5 font-mono text-xs">
                  <span>{row.cable}{/^CYKY/.test(row.cable) ? " mm²" : ""}</span>
                  <b>{row.meters} m</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {/* Fáze 52: jištění a doplňková ochrana dle ČSN 33 2130 ed. 4, Iz v zadaném uložení, Zs v teplém stavu */}
            <table className="w-full text-xs" data-testid="cable-circuits">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium">Okruh</th>
                  <th className="font-medium">Trasa</th>
                  <th className="text-right font-medium">Délka</th>
                  <th className="text-right font-medium">ΔU</th>
                </tr>
              </thead>
              <tbody>
                {analysis.summary.circuits.map((row) => {
                  const circuit = circuitById.get(row.id);
                  return (
                  <tr key={row.id} className="border-t border-border" data-circuit={row.id}>
                    <td className="py-0.5 pr-1">
                      {row.label}
                      <span className="block font-mono text-[10px] text-muted-foreground">{row.cable}</span>
                      {circuit ? (
                        <span className={cn("block font-mono text-[10px]", circuit.loop.ok ? "text-muted-foreground" : "font-bold text-red-300")} data-testid="circuit-protection">
                          {protectionLabel(circuit.protection)} · Iz {circuit.izA.toLocaleString("cs-CZ")} A · Zs {circuit.loop.zsOhm.toLocaleString("cs-CZ")} Ω ≤ {circuit.loop.zsMaxOhm.toLocaleString("cs-CZ")} Ω
                        </span>
                      ) : null}
                    </td>
                    <td className="text-center" title={row.routing === "TOP" ? "Vrchem" : "Spodem"}>
                      {row.routing === "TOP" ? <ArrowUp className="mx-auto size-3.5 text-sky-300" aria-label="vrchem" /> : <ArrowDown className="mx-auto size-3.5 text-amber-300" aria-label="spodem" />}
                    </td>
                    <td className="text-right font-mono tabular-nums">{row.lengthsM[mode].toLocaleString("cs-CZ")} m</td>
                    <td className={cn("text-right font-mono tabular-nums", row.ok ? "text-emerald-300" : "font-bold text-red-300")}>{row.voltageDropPct.toLocaleString("cs-CZ")} %</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {[...analysis.circuits.warnings, ...analysis.summary.warnings].slice(0, 4).map((warning) => (
            <p key={warning} className="flex gap-1.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {warning}
            </p>
          ))}
        </>
      )}
    </PanelSection>
    <PanelSection id="generate" title="Založit rozváděč" testId="generate-panel" icon={<Zap className="size-4 text-primary" aria-hidden />}>
      <form action={onGenerate} className="flex flex-col gap-2" key={`${defaults?.customer ?? ""}|${defaults?.site ?? ""}`}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="fp-name">Název rozváděče</Label>
          <Input id="fp-name" name="name" required maxLength={120} defaultValue={defaults?.name?.trim() && !/^(Nový půdorys|Půdorys \d)/.test(defaults.name) ? `RH – ${defaults.name.trim()}`.slice(0, 120) : "Rozvodnice RD – z půdorysu"} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fp-customer">Zákazník</Label>
            <Input id="fp-customer" name="customer" maxLength={120} placeholder="nepovinné" defaultValue={defaults?.customer ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fp-site">Místo instalace</Label>
            <Input id="fp-site" name="site" maxLength={120} placeholder="nepovinné" defaultValue={defaults?.site ?? ""} />
          </div>
        </div>
        {/* Fáze 60: celý rozváděč od jednoho výrobce */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="fp-manufacturer">Výrobce přístrojů rozváděče</Label>
          <select id="fp-manufacturer" name="manufacturer" defaultValue={manufacturers[0]?.name ?? "ABB"} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" data-testid="floorplan-manufacturer">
            {(manufacturers.length ? manufacturers : [{ name: "ABB", count: 0 }]).map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
                {option.count ? ` (${option.count} jističů a chráničů)` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Všechny přístroje od jednoho výrobce – co výrobce v databázi nemá, dostane parametry návrhu s odhadem (nikdy jiný výrobce). Převést na jiného výrobce jde i později v kroku 1.</p>
        </div>
        {/* Fáze 57: prostředí dle ČSN 33 2000-5-51 ed. 3 – povinně před generováním rozváděče a dokumentace */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="fp-environment">Prostředí dle ČSN 33 2000-5-51 ed. 3 *</Label>
          <select
            id="fp-environment"
            value={environment ?? ""}
            onChange={(event) => onEnvironment((event.target.value || null) as EnvironmentId | null)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            data-testid="floorplan-environment"
          >
            <option value="">– zvolte prostředí instalace –</option>
            {ENVIRONMENTS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.label} – {env.codes}
              </option>
            ))}
          </select>
          {environment ? <p className="text-[11px] text-muted-foreground">Protokol o určení vnějších vlivů, min. krytí IP {environmentOf(environment).minIp} a teplota okolí {environmentOf(environment).ambientTempC} °C se propíšou do dokumentace.</p> : null}
        </div>
        <ul className="flex flex-col gap-1 rounded-lg border border-border p-2 text-xs" aria-label="Kontrola před generováním" data-testid="generation-checklist">
          {checklist.items.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-1.5", item.ok ? "text-emerald-300" : "text-amber-200")} data-ok={item.ok}>
              {item.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
              {item.label}
            </li>
          ))}
        </ul>
        <Button type="submit" className="touch-target gap-2" disabled={pending || !analysis.ok || !analysis.summary.circuits.length || !checklist.ready} data-testid="generate-from-floorplan">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} [ ⚡ Vygenerovat rozváděč z tohoto půdorysu ]
        </Button>
        <p className="text-[11px] text-muted-foreground">1 kredit · jističe, chrániče, fáze, skříň, domovní přístroje zvolené řady a výkaz kabeláže v dokumentaci.</p>
        {boards.length > 1 ? (
          <p className="rounded-md border border-violet-500/40 bg-violet-500/5 px-2 py-1 text-[11px] text-violet-100" data-testid="generate-boards">
            {boards.length <= 4 ? `Vzniknou ${boards.length} propojené rozváděče` : `Vznikne ${boards.length} propojených rozváděčů`} ({boards.join(" + ")}) – hlavní rozváděč s přívody podružných, každý podružný jako vlastní projekt se svými okruhy. Stále 1 kredit.
          </p>
        ) : null}
      </form>
    </PanelSection>
    </>
  );
}
