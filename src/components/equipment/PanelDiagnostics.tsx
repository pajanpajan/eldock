"use client";

import { useState } from "react";
import { Cable, Cpu, Gauge, Search, Thermometer } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findPlcSignal, phaseReport, traceConnection, wireLabel } from "@/lib/panel-diagnostics";
import { xref, type PanelModel } from "@/lib/panel-model";
import { openSheet } from "@/lib/sheet-nav";
import { cn } from "@/lib/utils";

const TRACE_EXAMPLES = ["X1:U", "X2:5", "18", "-Q1:13", "-S1", "W1"];
const PLC_EXAMPLES = ["1.00", "DI0", "DO2", "001.001.001.001", "ALARM_ON_1", "Endstop UP"];

const PHASE_BAR: Record<string, string> = { L1: "bg-amber-700", L2: "bg-zinc-300", L3: "bg-zinc-500", N: "bg-blue-500" };

/** Diagnostika & spoje pro údržbu: propípávač, hledač PLC adres a kalkulačka zatížení fází. */
export function PanelDiagnostics({ model }: { model: PanelModel }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TraceTool model={model} />
      <PlcTool model={model} />
      <div className="xl:col-span-2">
        <PhaseTool model={model} />
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, description, children }: { icon: typeof Search; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Examples({ values, onPick }: { values: string[]; onPick: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Příklady">
      {values.map((value) => (
        <button key={value} type="button" onClick={() => onPick(value)} className="h-8 rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          {value}
        </button>
      ))}
    </div>
  );
}

/** Odkaz do knihy dokumentace: otevře list a zvýrazní sloupec. */
function SheetLink({ sheet, column }: { sheet: number; column: number }) {
  return (
    <button type="button" onClick={() => openSheet(sheet, column)} className="font-mono text-sm text-primary underline-offset-4 hover:underline" aria-label={`Otevřít list ${sheet}, sloupec ${column}`}>
      {xref(sheet, column)}
    </button>
  );
}

function TraceTool({ model }: { model: PanelModel }) {
  const [query, setQuery] = useState("X1:U");
  const hits = traceConnection(model, query);
  return (
    <Card icon={Cable} title="Propípávač svorek, vodičů a kabelů" description="Spoj FROM → TO dle IEC 62491: svorka (X1:U, X2:5), číslo vodiče, kontakt přístroje (-Q1:13), přístroj (-S1) nebo kabel (W1).">
      <div className="space-y-1.5">
        <Label htmlFor="trace-query">Svorka, vodič nebo přístroj</Label>
        <Input id="trace-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="X1:U" className="h-11 font-mono" autoComplete="off" />
      </div>
      <Examples values={TRACE_EXAMPLES} onPick={setQuery} />
      {query.trim() && !hits.length ? <p className="text-sm text-muted-foreground">Spoj „{query}“ v dokumentaci není.</p> : null}
      {hits.length ? (
        <ul className="space-y-2" aria-label="Nalezené spoje">
          {hits.map(({ wire, matched }) => (
            <li key={wire.number} className="rounded-lg border border-border bg-background/60 p-3" data-testid="trace-hit">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-muted px-1.5 font-mono text-xs">vodič {wire.number}</span>
                <span className="font-mono text-sm font-semibold">
                  <span className={cn(matched === "from" && "text-primary")}>{`${wire.from.device}:${wire.from.pin}`}</span>
                  {" → "}
                  <span className={cn(matched === "to" && "text-primary")}>{`${wire.to.device}:${wire.to.pin}`}</span>
                </span>
                <span className="ml-auto">
                  <SheetLink sheet={wire.sheet} column={wire.column} />
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Potenciál <span className="font-mono text-foreground">{wire.potential}</span> · {wire.crossSection} · barva <span className="font-mono">{wire.color}</span>
                {wire.cable ? (
                  <>
                    {" "}
                    · kabel <span className="font-mono text-foreground">{wire.cable.tag}</span> žíla <span className="font-mono text-foreground">{wire.cable.core}</span>
                  </>
                ) : null}
              </p>
              <span className="sr-only">{wireLabel(wire)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function PlcTool({ model }: { model: PanelModel }) {
  const [query, setQuery] = useState("DI0");
  const hits = findPlcSignal(model, query);
  return (
    <Card icon={Cpu} title="Hledač PLC adres a signálů" description="Adresa (1.00), kanál (DI0, DO2), slot (001.001.001.001), název signálu (ALARM_ON_1) nebo popis (Endstop UP).">
      <div className="space-y-1.5">
        <Label htmlFor="plc-query">PLC adresa nebo signál</Label>
        <Input id="plc-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="DI0" className="h-11 font-mono" autoComplete="off" />
      </div>
      <Examples values={PLC_EXAMPLES} onPick={setQuery} />
      {query.trim() && !hits.length ? <p className="text-sm text-muted-foreground">Signál „{query}“ v I/O seznamu není.</p> : null}
      {hits.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Nalezené signály">
          {hits.map((io) => (
            <li key={io.channel} className="rounded-lg border border-border bg-background/60 p-3" data-testid="plc-hit">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold">{io.channel}</span>
                <span className="font-mono text-sm text-muted-foreground">{io.address}</span>
                <span className="ml-auto rounded-full border border-border px-2 text-xs">{io.kind}</span>
              </div>
              <p className="mt-1 font-mono text-sm font-semibold text-primary">{io.signal}</p>
              <p className="text-sm text-muted-foreground">{io.description}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">Karta / svorka</dt>
                <dd className="font-mono">
                  {io.card} · {io.terminal}
                </dd>
                <dt className="text-muted-foreground">Slot</dt>
                <dd className="font-mono">{io.slot}</dd>
                <dt className="text-muted-foreground">Koncový prvek</dt>
                <dd className="font-mono">{io.endDevice}</dd>
                <dt className="text-muted-foreground">Výkres</dt>
                <dd>
                  <SheetLink sheet={io.sheet} column={io.column} />
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function PhaseTool({ model }: { model: PanelModel }) {
  const [extra, setExtra] = useState(0);
  const report = phaseReport(model, extra);
  const { thermal } = report;
  return (
    <Card icon={Gauge} title="Kalkulačka zatížení fází a tepelné rezervy" description={`Zatížení L1 / L2 / L3 / N vůči hlavnímu vypínači -Q1 ${model.mainRatedA} A a vnitřní teplota rozváděče (IEC 60890).`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2" role="table" aria-label="Zatížení fází">
          {report.rows.map((row) => (
            <div key={row.phase} role="row" className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_4.5rem] items-center gap-3 text-sm" data-testid={`phase-${row.phase}`}>
              <span role="rowheader" className="font-mono font-bold">
                {row.phase}
              </span>
              <span role="cell" className="h-3 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", PHASE_BAR[row.phase], row.percent > 80 && "bg-red-500")} style={{ width: `${Math.min(100, row.percent)}%` }} />
              </span>
              <span role="cell" className="text-right font-mono">
                {row.amps.toLocaleString("cs-CZ")} A
              </span>
              <span role="cell" className="text-right font-mono text-muted-foreground">
                {row.percent.toLocaleString("cs-CZ")} %
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Nesymetrie fází {report.imbalancePercent.toLocaleString("cs-CZ")} % · nejvíc zatížená {report.heaviest} ·{" "}
            <button type="button" onClick={() => openSheet(6, 6)} className="text-primary underline-offset-4 hover:underline">
              graf zatížení {xref(6, 6)}
            </button>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="extra-circuit">Nový jednofázový okruh [A]</Label>
          <Input id="extra-circuit" type="number" inputMode="decimal" min={0} max={63} step={1} value={extra || ""} placeholder="např. 10" onChange={(event) => setExtra(Math.max(0, Math.min(63, Number(event.target.value) || 0)))} className="h-11 font-mono" />
        </div>
      </div>
      <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium" role="status" data-testid="phase-recommendation">
        {report.recommendation}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" data-testid="thermal">
        <Thermometer className="size-4 text-muted-foreground" aria-hidden />
        <span>
          Uvnitř <span className="font-mono font-semibold">{thermal.internalC.toLocaleString("cs-CZ")} °C</span> · okolí {thermal.ambientC} °C · limit {thermal.maxC} °C · rezerva{" "}
          <span className="font-mono font-semibold">{thermal.reserveC.toLocaleString("cs-CZ")} °C</span> · ztráty {thermal.totalLossW.toLocaleString("cs-CZ")} W
        </span>
        <span className="w-full text-muted-foreground">{thermal.advice}</span>
      </div>
    </Card>
  );
}
