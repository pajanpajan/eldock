"use client";

import { ExternalLink, FileText } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TerminalPair } from "@/lib/component-datasheets";
import type { LifespanRowView } from "@/lib/lifespan-view";

/** Schéma zapojení ze svorek technického listu (hlavní kontakty, cívka, pomocné Z / V, napájení / výstup). */
export function TerminalDiagram({ terminals }: { terminals: readonly TerminalPair[] }) {
  if (!terminals.length) return null;
  const width = Math.max(140, terminals.length * 64 + 16);
  return (
    <svg viewBox={`0 0 ${width} 132`} className="h-36 w-full max-w-xl rounded-lg border border-border bg-white" role="img" aria-label="Schéma zapojení svorek" data-testid="datasheet-diagram">
      {terminals.map((pair, index) => {
        const x = 40 + index * 64;
        const top = 22;
        const bottom = 110;
        return (
          <g key={`${pair.from}-${pair.to}-${index}`} stroke="#0f172a" strokeWidth={1.6} fill="none" fontFamily="ui-sans-serif, system-ui" fontSize={10}>
            <text x={x} y={top - 8} textAnchor="middle" fill="#0f172a" stroke="none">
              {pair.from}
            </text>
            <text x={x} y={bottom + 18} textAnchor="middle" fill="#0f172a" stroke="none">
              {pair.to}
            </text>
            <circle cx={x} cy={top} r={2.5} fill="#0f172a" />
            <circle cx={x} cy={bottom} r={2.5} fill="#0f172a" />
            {pair.kind === "coil" ? (
              <>
                <line x1={x} y1={top} x2={x} y2={50} />
                <rect x={x - 12} y={50} width={24} height={28} />
                <line x1={x} y1={78} x2={x} y2={bottom} />
              </>
            ) : pair.kind === "supply" || pair.kind === "output" ? (
              <>
                <line x1={x} y1={top} x2={x} y2={48} />
                <rect x={x - 18} y={48} width={36} height={34} strokeDasharray={pair.kind === "output" ? "4 3" : undefined} />
                <text x={x} y={69} textAnchor="middle" fill="#0f172a" stroke="none" fontSize={9}>
                  {pair.kind === "supply" ? "vstup" : "výstup"}
                </text>
                <line x1={x} y1={82} x2={x} y2={bottom} />
              </>
            ) : (
              <>
                <line x1={x} y1={top} x2={x} y2={52} />
                {pair.kind === "nc" ? <line x1={x} y1={52} x2={x + 10} y2={78} /> : <line x1={x} y1={78} x2={x - 12} y2={54} />}
                {pair.kind === "nc" ? <line x1={x + 10} y1={52} x2={x + 10} y2={56} /> : null}
                <line x1={x} y1={78} x2={x} y2={bottom} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Fáze 116: „📄 Datasheet“ součástky z kusovníku – parametry výrobce, životnost (B10d / el. a mech. životnost / L10 /
 * MTBF), rozměry, schéma zapojení a přímý odkaz na oficiální PDF technický list výrobce.
 */
export function ComponentDatasheetDialog({ row, open, onOpenChange }: { row: LifespanRowView; open: boolean; onOpenChange: (open: boolean) => void }) {
  const sheet = row.datasheet;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" data-testid="datasheet-dialog" data-verified={sheet?.verified ? "true" : "false"}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <FileText className="size-5 text-primary" aria-hidden /> {row.designation} · {sheet?.manufacturer ?? row.manufacturer ?? "Výrobce neuveden"} {sheet?.partNumber ?? row.partNumber ?? ""}
          </DialogTitle>
          <DialogDescription>{sheet?.title ?? row.description}</DialogDescription>
        </DialogHeader>
        {sheet && !sheet.verified ? (
          <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-100" data-testid="datasheet-unverified">
            Údaje výrobce k {sheet.partNumber} zatím nejsou v katalogu ELDOCK ověřené – životnost se počítá odhadem kategorie ({row.basis}). Technický list najdete u výrobce podle objednacího čísla.
          </p>
        ) : null}
        {sheet?.ratings.length ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Parametry výrobce</h3>
            <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] gap-x-3 gap-y-1 text-sm" data-testid="datasheet-ratings">
              {sheet.ratings.map((entry) => (
                <div key={entry.label} className="contents">
                  <dt className="text-muted-foreground">{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Životnost a spolehlivost</h3>
          {sheet?.lifespan.length ? (
            <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] gap-x-3 gap-y-1 text-sm" data-testid="datasheet-lifespan">
              {sheet.lifespan.map((entry) => (
                <div key={entry.label} className="contents">
                  <dt className="text-muted-foreground">{entry.label}</dt>
                  <dd className="font-medium">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Výrobce v ověřených zdrojích údaj o životnosti neuvádí – model: {row.basis}.</p>
          )}
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Rozměry</p>
            <p className="font-medium" data-testid="datasheet-dimensions">
              {sheet?.dimensions ?? "výrobce v ověřených zdrojích neuvádí"}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Hmotnost</p>
            <p className="font-medium">{sheet?.weight ?? "–"}</p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Ztrátový výkon Pv</p>
            <p className="font-medium">{sheet?.lossW ?? "–"}</p>
          </div>
        </section>
        {sheet?.terminals.length ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Schéma zapojení</h3>
            <TerminalDiagram terminals={sheet.terminals} />
            <p className="text-xs text-muted-foreground">{sheet.terminalsNote}</p>
          </section>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {sheet?.datasheetUrl ? (
            <a href={sheet.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" data-testid="datasheet-pdf">
              <ExternalLink className="size-4" aria-hidden /> 📄 Oficiální PDF datasheet výrobce
            </a>
          ) : null}
          {sheet?.productUrl ? (
            <a href={sheet.productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <ExternalLink className="size-4" aria-hidden /> Stránka výrobku
            </a>
          ) : null}
        </div>
        {sheet?.sources.length ? <p className="text-xs text-muted-foreground">Zdroj: {sheet.sources.join(" · ")}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
