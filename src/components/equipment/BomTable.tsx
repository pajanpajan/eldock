"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv } from "@/lib/csv";
import { normalizeSearch } from "@/lib/equipment-filter";
import { formatCount } from "@/lib/format";

export interface BomRow {
  id: string;
  position: number;
  designation: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
}

type SortKey = "position" | "designation" | "description" | "manufacturer" | "partNumber" | "quantity";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "position", label: "Poz.", className: "w-14" },
  { key: "designation", label: "Označení" },
  { key: "description", label: "Popis" },
  { key: "manufacturer", label: "Výrobce", className: "hidden md:table-cell" },
  { key: "partNumber", label: "Objednací číslo", className: "hidden lg:table-cell" },
  { key: "quantity", label: "Množství", className: "text-right" },
];

const collator = new Intl.Collator("cs", { numeric: true, sensitivity: "base" });

/** Kusovník revize: řazení podle sloupců, hledání, export CSV. */
export function BomTable({ rows, fileName }: { rows: BomRow[]; fileName: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "position", dir: 1 });

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    const filtered = q
      ? rows.filter((row) =>
          normalizeSearch([row.designation, row.description, row.manufacturer, row.partNumber, row.note].join(" ")).includes(q),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av ?? ""), String(bv ?? ""));
      return cmp * sort.dir;
    });
  }, [rows, query, sort]);

  function exportCsv() {
    const csv = toCsv([
      ["Pozice", "Označení", "Popis", "Výrobce", "Objednací číslo", "Množství", "Jednotka", "Poznámka"],
      ...visible.map((row) => [
        row.position,
        row.designation,
        row.description,
        row.manufacturer,
        row.partNumber,
        String(row.quantity).replace(".", ","),
        row.unit,
        row.note,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat označení, popis, číslo…"
            aria-label="Hledat v kusovníku"
            className="h-11 pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {visible.length} / {formatCount(rows.length, ["položka", "položky", "položek"])}
        </span>
        <Button variant="outline" className="touch-target ml-auto gap-2" onClick={exportCsv}>
          <FileSpreadsheet className="size-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => {
                const active = sort.key === column.key;
                const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TableHead
                    key={column.key}
                    className={column.className}
                    aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => setSort((current) => ({ key: column.key, dir: current.key === column.key ? (current.dir === 1 ? -1 : 1) : 1 }))}
                      className="inline-flex min-h-10 items-center gap-1 font-medium hover:text-foreground"
                    >
                      {column.label}
                      <Icon className="size-3.5 opacity-60" aria-hidden />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                  Nic nenalezeno.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-muted-foreground">{row.position}</TableCell>
                  <TableCell className="font-mono font-semibold text-primary">{row.designation}</TableCell>
                  <TableCell className="max-w-80 whitespace-normal">
                    {row.description}
                    {row.note ? <div className="text-xs text-amber-300">{row.note}</div> : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.manufacturer ?? "—"}</TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">{row.partNumber ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {row.quantity.toLocaleString("cs-CZ")} {row.unit}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
