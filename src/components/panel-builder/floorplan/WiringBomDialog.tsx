"use client";

import { FileSpreadsheet, FileText, ListChecks, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toCsv } from "@/lib/csv";
import { BOX_TABLE_TITLE, bomBoxRows, bomMainRows, bomTable, type WiringBomRow } from "@/lib/panel-builder/wiring-bom";
import { buildXlsx } from "@/lib/xlsx";
import { cn } from "@/lib/utils";

import { BoxPhoto } from "./BoxPhoto";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fáze 55: souhrn kusovníku domovní instalace v pravém panelu + modal s tabulkou, exportem CSV / XLSX a tiskem. */
export function WiringBomDialog({ rows }: { rows: readonly WiringBomRow[] }) {
  const devices = rows.filter((row) => row.unit === "ks").reduce((sum, row) => sum + row.quantity, 0);
  const missing = rows.filter((row) => !row.mpn && row.unit === "ks").length;
  const unverified = rows.filter((row) => row.mpn && !row.verified).length;
  const table = bomTable(rows);
  // Fáze 91: krabice v samostatné tabulce na konci kusovníku
  const main = bomMainRows(rows);
  const boxes = bomBoxRows(rows);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Kusovník domovní instalace" data-testid="wiring-bom">
      <h2 className="text-sm font-semibold">Kusovník domovní instalace</h2>
      <p className="text-xs text-muted-foreground">
        {rows.length ? `${rows.length} položek · ${devices} ks${missing ? ` · ${missing} bez objednacího čísla` : ""}${unverified ? ` · ${unverified} k ověření` : ""}` : "Vložte do půdorysu zásuvky a vypínače."}
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="h-auto min-h-9 gap-1.5 whitespace-normal py-1.5 text-left text-xs" disabled={!rows.length} data-testid="wiring-bom-open">
            <ListChecks className="size-4" aria-hidden /> Zobrazit kompletní kusovník (BOM) a objednací čísla
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Kusovník domovní instalace</DialogTitle>
            <DialogDescription>
              Přístroj + kryt + rámeček podle sestavování přístrojů Katalogu ABB 2026 (víceramček, který řada nevyrábí, rozdělený na skutečné rámečky), kabely z výkazu kabeláže a na konci instalační krabice podle výrobce, konstrukce stěn a hloubky přístroje. EAN = objednací číslo je v oficiálních datech výrobce ABB ETIM 9.0, „ověřit“ = číslo odvozené z matice katalogu, které data výrobce neuvádějí, „doplnit“ = objednací číslo v podkladech chybí. Krabice KOPOS mají fotku, EAN a hloubku ze stránky výrobku kopos.cz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => download("kusovnik-domovni-instalace.csv", toCsv(table), "text/csv;charset=utf-8")}>
              <FileText className="size-4" aria-hidden /> Export CSV
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => download("kusovnik-domovni-instalace.xlsx", buildXlsx("Kusovník", table) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>
              <FileSpreadsheet className="size-4" aria-hidden /> Export XLSX
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Tisk / PDF
            </Button>
          </div>
          <table className="w-full border-collapse text-xs" data-testid="wiring-bom-table">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1.5 pr-2">Kategorie</th>
                <th className="py-1.5 pr-2">Objednací číslo (MPN)</th>
                <th className="py-1.5 pr-2">Název a specifikace</th>
                <th className="py-1.5 pr-2">Řada a barva</th>
                <th className="py-1.5 text-right">Počet ks / m</th>
              </tr>
            </thead>
            <tbody>
              {main.map((row) => (
                <tr key={`${row.category}-${row.mpn ?? row.name}-${row.appearance}`} className="border-b border-border/60">
                  <td className="py-1 pr-2 text-muted-foreground">{row.category}</td>
                  <td className={cn("py-1 pr-2 font-mono", !row.mpn && "text-amber-300")}>
                    {row.mpn ?? "doplnit"}
                    {row.mpn && !row.verified ? <span className="ml-1 rounded bg-amber-500/20 px-1 font-sans text-[10px] text-amber-200">ověřit</span> : null}
                    {/* Fáze 94: EAN z oficiálních dat výrobce ABB ETIM 9.0 */}
                    {row.ean ? (
                      <span className="block font-sans text-[10px] text-muted-foreground" data-testid="wiring-bom-ean" title="EAN (GTIN) z oficiálních dat výrobce ABB ETIM 9.0">
                        EAN {row.ean}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1 pr-2">{row.name}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{row.appearance}</td>
                  <td className="py-1 text-right font-mono">
                    {row.quantity.toLocaleString("cs-CZ")} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {boxes.length ? (
            <section className="flex flex-col gap-1.5" aria-label="Doporučené instalační krabičky" data-testid="wiring-bom-boxes">
              <h3 className="text-sm font-semibold">{BOX_TABLE_TITLE}</h3>
              <table className="w-full border-collapse text-xs" data-testid="wiring-bom-boxes-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1.5 pr-2">
                      <span className="sr-only">Fotka</span>
                    </th>
                    <th className="py-1.5 pr-2">Výrobce</th>
                    <th className="py-1.5 pr-2">Typové označení</th>
                    <th className="py-1.5 pr-2">Objednací kód / katalogové číslo</th>
                    <th className="py-1.5 pr-2 text-right">Hloubka (mm)</th>
                    <th className="py-1.5 pr-2">Určení / prostředí</th>
                    <th className="py-1.5 text-right">Počet ks</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((row) => (
                    <tr key={`${row.mpn ?? row.name}-${row.box.maker}`} className="border-b border-border/60" data-testid="wiring-bom-box" data-code={row.mpn ?? ""}>
                      {/* Fáze 97: fotka krabice výrobce (KOPOS) */}
                      <td className="w-14 py-1 pr-2">
                        <BoxPhoto code={row.mpn} label={row.box.type} />
                      </td>
                      <td className="py-1 pr-2">{row.box.maker}</td>
                      <td className="py-1 pr-2 font-semibold">{row.box.type}</td>
                      <td className={cn("py-1 pr-2 font-mono", !row.mpn && "text-amber-300")}>
                        {row.mpn ?? "doplnit"}
                        {row.ean ? (
                          <span className="block font-sans text-[10px] text-muted-foreground" data-testid="wiring-bom-box-ean" title="EAN (GTIN) ze stránky výrobku">
                            EAN {row.ean}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono">{row.box.depthMm ?? "–"}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{row.box.purpose}</td>
                      <td className="py-1 text-right font-mono">{row.quantity.toLocaleString("cs-CZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
