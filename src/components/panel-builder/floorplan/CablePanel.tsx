"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { analyzeDraft } from "@/lib/panel-builder/floorplan-editor";
import { ROUTING_LABEL } from "@/lib/panel-builder/floorplan-editor";
import type { CableRoutingMode } from "@/engine/floorplan-bridge";
import { cn } from "@/lib/utils";

type Analysis = ({ ok: true } & ReturnType<typeof analyzeDraft>) | { ok: false; error: string };

const m = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m`;
const SHORT: Record<CableRoutingMode, string> = { BOTTOM: "Spodem", TOP: "Vrchem", OPTIMIZED: "Optimalizovaně" };

/** Živý výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4) + „⚡ Vygenerovat rozváděč z tohoto půdorysu“. */
export function CablePanel({ analysis, mode, pending, onGenerate }: { analysis: Analysis; mode: CableRoutingMode; pending: boolean; onGenerate: (form: FormData) => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Výkaz kabeláže a okruhů" data-testid="cable-panel">
      <h3 className="font-bold">Výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4)</h3>
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
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Kabely k nákupu – {ROUTING_LABEL[mode]} (vč. rezervy a přídavků na zapojení)</p>
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
                {analysis.summary.circuits.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-0.5 pr-1">
                      {row.label}
                      <span className="block font-mono text-[10px] text-muted-foreground">{row.cable}</span>
                    </td>
                    <td className="text-center" title={row.routing === "TOP" ? "Vrchem" : "Spodem"}>
                      {row.routing === "TOP" ? <ArrowUp className="mx-auto size-3.5 text-sky-300" aria-label="vrchem" /> : <ArrowDown className="mx-auto size-3.5 text-amber-300" aria-label="spodem" />}
                    </td>
                    <td className="text-right font-mono tabular-nums">{row.lengthsM[mode].toLocaleString("cs-CZ")} m</td>
                    <td className={cn("text-right font-mono tabular-nums", row.ok ? "text-emerald-300" : "font-bold text-red-300")}>{row.voltageDropPct.toLocaleString("cs-CZ")} %</td>
                  </tr>
                ))}
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
      <form action={onGenerate} className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fp-name">Název rozváděče</Label>
          <Input id="fp-name" name="name" required maxLength={120} defaultValue="Rozvodnice RD – z půdorysu" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fp-customer">Zákazník</Label>
            <Input id="fp-customer" name="customer" maxLength={120} placeholder="nepovinné" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fp-site">Místo instalace</Label>
            <Input id="fp-site" name="site" maxLength={120} placeholder="nepovinné" />
          </div>
        </div>
        <Button type="submit" className="touch-target gap-2" disabled={pending || !analysis.ok || !analysis.summary.circuits.length} data-testid="generate-from-floorplan">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} [ ⚡ Vygenerovat rozváděč z tohoto půdorysu ]
        </Button>
        <p className="text-[11px] text-muted-foreground">1 kredit · jističe, chrániče, fáze, skříň, domovní přístroje zvolené řady a výkaz kabeláže v dokumentaci.</p>
      </form>
    </section>
  );
}
