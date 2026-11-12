// Fáze 101: živá data prezentace `/prezentace` – spočítaná stejnými funkcemi jako aplikace (kusovník vzorového rodinného
// domu 4+kk z 2D půdorysu, převod vzorového BIM modelu výrobní haly). Volá se jen na serveru při sestavení stránky,
// do prohlížeče jde jen výsledek (žádný katalog ani parser v balíčku prezentace).
import { bimSummary } from "@/lib/bim/bim-summary";
import { parseIfc } from "@/lib/bim/ifc-parser";
import { samplePlantIfc } from "@/lib/bim/sample-ifc";
import { demoDraft } from "@/lib/panel-builder/demo-scenarios";
import { analyzeDraft } from "@/lib/panel-builder/floorplan-editor";
import { DOCUMENT_SHEETS } from "@/lib/panel-builder/documentation";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { POWER_BACKUP_TIERS } from "@/lib/power-backup";

export interface PitchLiveData {
  /** Ukázkové řádky kusovníku vzorového RD 4+kk – přístroje s objednacím číslem a EAN výrobce. */
  bom: { name: string; mpn: string; ean: string | null; quantity: number; unit: "ks" | "m" }[];
  bomStats: { rows: number; withMpn: number; withEan: number; cableM: number; circuits: number };
  bim: { buildings: number; storeys: number; spaces: number; areaM2: number; dimensions: string; boards: number; machines: number; sources: { tag: string; tier: string }[]; cableM: number };
  /** Listy PDF elaborátu rozváděče v pořadí dokumentace. */
  sheets: string[];
  /** Úrovně napájení mapy areálu (filtr Síť / DA / UPS) s barvou aplikace. */
  tiers: { label: string; color: string }[];
}

export function pitchLiveData(): PitchLiveData {
  const draft = demoDraft("rd-4kk");
  const analysis = analyzeDraft(draft);
  const rows = compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {} });
  const devices = rows.filter((row) => row.mpn && row.ean && row.unit === "ks" && row.category !== "Instalační krabice");
  // Pestrý výběr: zásuvka, vypínač, rámeček, termostat… – z každé kategorie nejvýš jeden řádek
  const seen = new Set<string>();
  const bom = devices
    .filter((row) => !seen.has(row.category) && seen.add(row.category))
    .slice(0, 4)
    .map((row) => ({ name: row.name, mpn: row.mpn!, ean: row.ean ?? null, quantity: row.quantity, unit: row.unit }));
  const summary = bimSummary(parseIfc(samplePlantIfc()));
  return {
    bom,
    bomStats: {
      rows: rows.length,
      withMpn: rows.filter((row) => row.mpn).length,
      withEan: rows.filter((row) => row.ean).length,
      cableM: Math.round(analysis.summary.byCable.reduce((total, row) => total + row.meters, 0)),
      circuits: analysis.summary.circuits.length,
    },
    bim: {
      buildings: summary.buildings,
      storeys: summary.storeys,
      spaces: summary.spaces,
      areaM2: summary.areaM2,
      dimensions: summary.dimensions,
      boards: summary.boards.length,
      machines: summary.machines.length,
      sources: summary.sources.map((source) => ({ tag: source.tag, tier: source.tier })),
      cableM: Math.round(summary.routes.cableMeters),
    },
    sheets: [...DOCUMENT_SHEETS],
    tiers: POWER_BACKUP_TIERS.map((tier) => ({ label: tier.label, color: tier.color })),
  };
}
