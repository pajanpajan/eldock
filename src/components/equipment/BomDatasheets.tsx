"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bomDatasheetParts, type LifespanRowView } from "@/lib/lifespan-view";

import { ComponentDatasheetDialog } from "./ComponentDatasheetDialog";

/**
 * Fáze 116: technické listy součástek z kusovníku v záložce „📚 Návody & Datasheety“ – ověřené listy výrobců s odkazem
 * na oficiální PDF, díly bez ověřeného listu zvlášť (údaje z kusovníku, životnost odhadem).
 */
export function BomDatasheets({ rows }: { rows: readonly LifespanRowView[] }) {
  const [open, setOpen] = useState<LifespanRowView | null>(null);
  const parts = bomDatasheetParts(rows);
  const verified = parts.filter((part) => part.row.datasheet?.verified);
  const other = parts.filter((part) => !part.row.datasheet?.verified);
  if (!parts.length) return null;
  const item = ({ row, designations }: (typeof parts)[number]) => (
    <li key={row.key} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm" data-testid="bom-datasheet-card" data-part={row.partNumber ?? ""} data-verified={row.datasheet?.verified ? "true" : "false"}>
      <p className="font-semibold">
        {row.datasheet?.manufacturer ?? row.manufacturer} <span className="font-mono">{row.datasheet?.partNumber ?? row.partNumber}</span>
      </p>
      <p className="line-clamp-2 text-xs text-muted-foreground">{row.datasheet?.title ?? row.description}</p>
      <p className="font-mono text-xs text-primary">{designations.join(", ")}</p>
      <div className="mt-auto flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setOpen(row)}>
          📄 Datasheet
        </Button>
        {row.datasheet?.datasheetUrl ? (
          <a href={row.datasheet.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-primary hover:underline">
            <ExternalLink className="size-3.5" aria-hidden /> Oficiální PDF
          </a>
        ) : null}
      </div>
    </li>
  );
  return (
    <section className="flex flex-col gap-2" aria-label="Technické listy součástek z kusovníku" data-testid="bom-datasheets">
      <h3 className="text-base font-semibold">📄 Technické listy součástek z kusovníku ({verified.length})</h3>
      {verified.length ? <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{verified.map(item)}</ul> : <p className="text-sm text-muted-foreground">Pro díly tohoto kusovníku zatím nejsou v katalogu ELDOCK ověřené listy výrobců.</p>}
      {other.length ? (
        <details className="rounded-xl border border-dashed border-border p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Díly bez ověřeného listu výrobce ({other.length}) – údaje z kusovníku, životnost odhadem kategorie</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{other.map(item)}</ul>
        </details>
      ) : null}
      {open ? <ComponentDatasheetDialog row={open} open onOpenChange={(value) => (!value ? setOpen(null) : undefined)} /> : null}
    </section>
  );
}
