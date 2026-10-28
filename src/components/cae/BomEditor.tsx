"use client";

import { useMemo } from "react";
import { Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changedFields, removedRows, rowChange, type BomDraftRow, type BomField } from "@/lib/bom-edit";
import { cn } from "@/lib/utils";

const COLUMNS: { field: BomField; label: string; className: string }[] = [
  { field: "designation", label: "Označení", className: "w-24" },
  { field: "description", label: "Popis", className: "min-w-56" },
  { field: "manufacturer", label: "Výrobce", className: "w-40" },
  { field: "partNumber", label: "Objednací číslo", className: "w-44" },
  { field: "quantity", label: "Množství", className: "w-20" },
  { field: "unit", label: "Jedn.", className: "w-16" },
  { field: "note", label: "Poznámka", className: "w-44" },
];

/** Editovatelný kusovník nové revize: změněné řádky žlutě, nové zeleně, odebrané lze vrátit. */
export function BomEditor({
  rows,
  originals,
  onChange,
  onAdd,
  onRemove,
  onRestore,
  onReset,
}: {
  rows: BomDraftRow[];
  originals: BomDraftRow[];
  onChange: (key: string, field: BomField, value: string) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onRestore: (row: BomDraftRow) => void;
  onReset: () => void;
}) {
  const byKey = useMemo(() => new Map(originals.map((row) => [row.key, row])), [originals]);
  const removed = removedRows(rows, originals);
  const stats = rows.reduce(
    (acc, row) => {
      acc[rowChange(row, byKey)] += 1;
      return acc;
    },
    { new: 0, changed: 0, same: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {rows.length} položek · <span className="text-amber-300">{stats.changed} změněno</span> ·{" "}
          <span className="text-emerald-300">{stats.new} přidáno</span> · <span className="text-red-300">{removed.length} odebráno</span>
        </span>
        <Button type="button" variant="ghost" className="touch-target ml-auto gap-1.5" onClick={onReset} disabled={!stats.changed && !stats.new && !removed.length}>
          <RotateCcw className="size-4" />
          Vrátit na kusovník platné revize
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2 font-medium">#</th>
              {COLUMNS.map((column) => (
                <th key={column.field} className={cn("px-1 py-2 font-medium", column.className)}>
                  {column.label}
                </th>
              ))}
              <th className="w-12 px-1 py-2">
                <span className="sr-only">Akce</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const change = rowChange(row, byKey);
              const changed = new Set(change === "changed" ? changedFields(row, byKey) : []);
              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-t border-border",
                    change === "new" && "bg-emerald-500/10",
                    change === "changed" && "bg-amber-500/10",
                  )}
                  data-change={change}
                >
                  <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{index + 1}</td>
                  {COLUMNS.map((column) => (
                    <td key={column.field} className="px-1 py-1">
                      <Input
                        value={row[column.field]}
                        onChange={(event) => onChange(row.key, column.field, event.target.value)}
                        aria-label={`${column.label}, řádek ${index + 1}`}
                        inputMode={column.field === "quantity" ? "decimal" : undefined}
                        className={cn(
                          "h-10 px-2",
                          column.field === "designation" || column.field === "partNumber" ? "font-mono" : "",
                          changed.has(column.field) && "border-amber-400/70 text-amber-100",
                        )}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="touch-target text-muted-foreground hover:text-red-400"
                      onClick={() => onRemove(row.key)}
                      aria-label={`Odebrat řádek ${index + 1}${row.designation ? ` (${row.designation})` : ""}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {removed.map((row) => (
              <tr key={`removed-${row.key}`} className="border-t border-border bg-red-500/10 text-red-200/80" data-change="removed">
                <td className="px-2 py-2 text-xs">–</td>
                <td className="px-2 py-2 font-mono line-through">{row.designation}</td>
                <td className="px-2 py-2 line-through" colSpan={5}>
                  {row.description}
                </td>
                <td className="px-2 py-2 text-xs">odebráno</td>
                <td className="px-1 py-1 text-center">
                  <Button type="button" variant="ghost" size="icon" className="touch-target" onClick={() => onRestore(row)} aria-label={`Vrátit řádek ${row.designation}`}>
                    <Undo2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" className="touch-target gap-2" onClick={onAdd}>
        <Plus className="size-4" />
        Přidat řádek
      </Button>
    </div>
  );
}
