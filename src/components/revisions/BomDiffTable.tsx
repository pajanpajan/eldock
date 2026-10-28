import { Minus, Plus, Equal, PenLine } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeBomDiff, type BomDiffField, type BomDiffKind, type BomDiffRow } from "@/lib/bom-diff";
import { cn } from "@/lib/utils";

const KIND: Record<BomDiffKind, { label: string; row: string; icon: typeof Plus; text: string }> = {
  added: { label: "Přidáno", row: "bg-emerald-500/10", icon: Plus, text: "text-emerald-300" },
  removed: { label: "Odebráno", row: "bg-red-500/10 text-red-200/80", icon: Minus, text: "text-red-300" },
  changed: { label: "Změněno", row: "bg-amber-500/10", icon: PenLine, text: "text-amber-300" },
  same: { label: "Beze změny", row: "", icon: Equal, text: "text-muted-foreground" },
};

const quantity = (row: BomDiffRow["after"]) => (row ? `${String(row.quantity).replace(".", ",")} ${row.unit}` : "");

function Cell({ row, field, value }: { row: BomDiffRow; field: BomDiffField; value: (item: NonNullable<BomDiffRow["after"]>) => string | null }) {
  const after = row.after ? value(row.after) : null;
  const before = row.before ? value(row.before) : null;
  if (row.kind === "removed") return <span className="line-through">{before}</span>;
  if (row.kind === "changed" && row.fields.includes(field)) {
    return (
      <span className="flex flex-col">
        <span className="text-xs text-red-300/80 line-through">{before || "–"}</span>
        <span className="font-medium text-amber-200">{after || "–"}</span>
      </span>
    );
  }
  return <>{after}</>;
}

/** Rozdíl kusovníků platné a nové revize (přidáno / odebráno / změněno barevně). */
export function BomDiffTable({ rows, showUnchanged = false }: { rows: BomDiffRow[]; showUnchanged?: boolean }) {
  const summary = summarizeBomDiff(rows);
  const visible = showUnchanged ? rows : rows.filter((row) => row.kind !== "same");
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className={KIND.added.text}>+ {summary.added} přidáno</span>
        <span className={KIND.removed.text}>− {summary.removed} odebráno</span>
        <span className={KIND.changed.text}>± {summary.changed} změněno</span>
        <span className="text-muted-foreground">{rows.filter((row) => row.kind === "same").length} beze změny</span>
      </p>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Kusovník je beze změny.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 sm:w-28">
                  <span className="sr-only sm:not-sr-only">Změna</span>
                </TableHead>
                <TableHead className="w-20">Označení</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="hidden md:table-cell">Výrobce</TableHead>
                <TableHead className="hidden sm:table-cell">Objednací číslo</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Množství</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const kind = KIND[row.kind];
                return (
                  <TableRow key={row.key} className={kind.row} data-diff={row.kind}>
                    <TableCell className={cn("py-2.5 align-top", kind.text)}>
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <kind.icon className="size-3.5" aria-label={kind.label} />
                        <span className="hidden sm:inline">{kind.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className={cn("py-2.5 align-top font-mono font-semibold", row.kind === "removed" && "line-through")}>{row.designation}</TableCell>
                    <TableCell className="py-2.5 align-top whitespace-normal">
                      <Cell row={row} field="description" value={(item) => item.description} />
                      {row.fields.includes("partNumber") || row.kind !== "changed" ? (
                        <div className="font-mono text-xs text-muted-foreground sm:hidden">{(row.after ?? row.before)?.partNumber}</div>
                      ) : null}
                      {row.fields.includes("quantity") ? (
                        <div className="text-xs sm:hidden">
                          <Cell row={row} field="quantity" value={quantity} />
                        </div>
                      ) : null}
                      {row.after?.note && row.kind !== "removed" ? <div className="text-xs text-muted-foreground">{row.after.note}</div> : null}
                    </TableCell>
                    <TableCell className="hidden py-2.5 align-top md:table-cell">
                      <Cell row={row} field="manufacturer" value={(item) => item.manufacturer} />
                    </TableCell>
                    <TableCell className="hidden py-2.5 align-top font-mono text-xs sm:table-cell">
                      <Cell row={row} field="partNumber" value={(item) => item.partNumber} />
                    </TableCell>
                    <TableCell className="hidden py-2.5 text-right align-top tabular-nums sm:table-cell">
                      <Cell row={row} field="quantity" value={quantity} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
