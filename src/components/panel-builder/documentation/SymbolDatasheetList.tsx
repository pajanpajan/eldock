import Link from "next/link";

import { DatasheetDialog } from "@/components/panel-builder/DatasheetDialog";
import { SYMBOLS, symbolPreviewSvg, type SymbolKind } from "@/lib/panel-builder/iec-symbols";

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export interface SymbolDatasheetRow {
  id: string;
  designation: string;
  typeCode: string;
  manufacturer: string | null;
  componentId: string | null;
  symbol: SymbolKind;
}

/**
 * Fáze 58: kontrola značek jednopólového schématu – každý přístroj s jeho značkou dle ČSN EN 60617, názvem značky
 * a náhledem datasheetu (jen na obrazovce, do tisku se nedostane).
 */
export function SymbolDatasheetList({ rows }: { rows: SymbolDatasheetRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Značky a datasheety přístrojů" data-testid="symbol-datasheets">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Značky a datasheety přístrojů</h2>
        <Link href="/panel-builder/catalog/znacky" className="text-xs text-primary underline-offset-4 hover:underline">
          Knihovna značek ČSN EN 60617 →
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">Zkontrolujte, že každý přístroj má ve schématu správnou značku. Kategorie a podtyp (relé, zdroj, odpínač…) se berou z katalogu – špatná značka = špatně přiřazený katalogový prvek.</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 rounded-lg border border-border p-2" data-testid="symbol-row" data-symbol-kind={row.symbol}>
            {/* eslint-disable-next-line @next/next/no-img-element -- vlastní vektorová značka */}
            <img src={svgUri(symbolPreviewSvg(row.symbol, 56))} alt={SYMBOLS[row.symbol].label} className="h-12 w-14 shrink-0 rounded bg-white" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold">
                {row.designation} <span className="font-normal text-muted-foreground">· {SYMBOLS[row.symbol].label}</span>
              </p>
              <p className="truncate text-muted-foreground">{[row.manufacturer, row.typeCode].filter(Boolean).join(" ")}</p>
            </div>
            {row.componentId ? <DatasheetDialog componentId={row.componentId} size="xs" /> : <span className="text-[11px] text-amber-200">bez katalogu</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
