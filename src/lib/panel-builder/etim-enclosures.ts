// Fáze 94: rozvodnice ABB z oficiálních dat ETIM 9.0 (ELSB_ETIM-9.0_2026-05), které ověřený seznam z katalogů výrobců
// (`verified-enclosures.ts`, fáze 86 / 88) ještě nemá – řady, moduly v řadě, rozměry, krytí, montáž a materiál přesně
// podle ETIM, nic se nedopočítává. Jen pro seed (server) – do klientského kódu se seznam nedostane.

import { ABB_ETIM_ENCLOSURES, type EtimEnclosure } from "./abb-etim-enclosures.generated";
import { VERIFIED_ENCLOSURES, VERIFIED_ENCLOSURE_SOURCE, type VerifiedEnclosure } from "./verified-enclosures";

/** Řada ETIM → řada v kaskádě výběru skříně („MISTRAL41W“ → „Mistral41W“, „ComfortLine Compact CA“ ponechá). */
export function etimSeriesName(series: string): string {
  const mistral = /^MISTRAL(\d+[A-Z]?)$/i.exec(series.trim());
  return mistral ? `Mistral${mistral[1].toUpperCase()}` : series.trim();
}

const rowsWord = (rows: number) => (rows === 1 ? "řada" : rows <= 4 ? "řady" : "řad");

export function etimEnclosure(row: EtimEnclosure): VerifiedEnclosure {
  const page = row.page ?? `https://new.abb.com/products/cs/${encodeURIComponent(row.articleNumber)}`;
  return {
    manufacturer: "ABB",
    series: etimSeriesName(row.series),
    model: row.model,
    articleNumber: row.articleNumber,
    rows: row.rows,
    modulesPerRow: row.modulesPerRow,
    totalModules: row.rows * row.modulesPerRow,
    widthMm: Math.round(row.widthMm),
    heightMm: Math.round(row.heightMm),
    depthMm: Math.round(row.depthMm),
    ipRating: row.ipRating,
    installation: row.installation,
    material: row.material,
    pMaxW: null,
    // Fáze 113: EAN do vlastního sloupce (dál i v popisu)
    ean: row.gtin ?? null,
    dataSource: VERIFIED_ENCLOSURE_SOURCE,
    description: `${row.description} – ${row.rows} ${rowsWord(row.rows)} × ${row.modulesPerRow} M, ${row.ipRating}${row.gtin ? `, EAN ${row.gtin}` : ""}. Zdroj: ${page} (data ABB ETIM 9.0, ELSB_ETIM-9.0_2026-05)`,
    sourceUrl: page,
  };
}

/** Rozvodnice z ETIM navíc k ověřenému seznamu (stejné objednací číslo už v seznamu je → přednost má seznam). */
export function etimEnclosures(): VerifiedEnclosure[] {
  const known = new Set(VERIFIED_ENCLOSURES.map((row) => row.articleNumber));
  return ABB_ETIM_ENCLOSURES.filter((row) => !known.has(row.articleNumber)).map(etimEnclosure);
}
