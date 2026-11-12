// Fáze 104: veřejná (klientská) část katalogových dat – jen technické hodnoty, které potřebují výpočty v prohlížeči
// (hlídač hloubky krabic, nejvyšší vícenásobný rámeček řady, rozměry krabic KOPOS). Celé importy ETIM (EAN / GTIN,
// rámečky s EAN, výrobky chytré domácnosti) a ceníkové ceny KOPOS zůstávají `server-only` (`src/server/catalog-data.ts`).
// Soubor `catalog-public.generated.ts` generuje `npm run catalog:public` z `abb-etim.generated.ts`
// a `brand-etim.generated.ts`; test hlídá, že odpovídá aktuálním datům. Čisté funkce.

import type { BrandDeviceDepth, EtimFrameLimit, KoposBoxData } from "./brand-etim.generated";

/** Vestavná hloubka přístroje řady (objednací číslo dílu = stejné číslo, jaké ukazuje kusovník). */
export interface PublicDeviceDepth {
  mpn: string;
  depthMm: number;
  source: string;
}

/** Technické údaje krabice KOPOS bez EAN a ceníkové ceny. */
export type PublicBoxData = Omit<KoposBoxData, "ean" | "priceCzk">;

export interface CatalogPublic {
  deviceDepths: Record<string, PublicDeviceDepth>;
  frameLimits: Record<string, EtimFrameLimit>;
  koposBoxes: Record<string, PublicBoxData>;
  koposSource: string;
}

export const ABB_DEPTH_SOURCE = "ABB ETIM 9.0";

export function buildCatalogPublic(input: { abbDepths: Record<string, { mpn: string; depthMm: number }>; brandDepths: Record<string, BrandDeviceDepth>; frameLimits: Record<string, EtimFrameLimit>; kopos: Record<string, KoposBoxData>; koposSource: string }): CatalogPublic {
  const deviceDepths: Record<string, PublicDeviceDepth> = {};
  for (const [key, value] of Object.entries(input.abbDepths)) deviceDepths[key] = { mpn: value.mpn, depthMm: value.depthMm, source: ABB_DEPTH_SOURCE };
  for (const [key, value] of Object.entries(input.brandDepths)) if (!deviceDepths[key]) deviceDepths[key] = { mpn: value.mpn, depthMm: value.depthMm, source: value.source };
  const koposBoxes: Record<string, PublicBoxData> = {};
  for (const [code, data] of Object.entries(input.kopos)) {
    const { ean: _ean, priceCzk: _price, ...technical } = data;
    void _ean;
    void _price;
    koposBoxes[code] = technical;
  }
  const sorted = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  return { deviceDepths: sorted(deviceDepths), frameLimits: sorted(input.frameLimits), koposBoxes: sorted(koposBoxes), koposSource: input.koposSource };
}

export function renderCatalogPublic(data: CatalogPublic): string {
  return [
    "// Generuje `npm run catalog:public` z abb-etim.generated.ts a brand-etim.generated.ts (fáze 104) – needitujte ručně.",
    "// Veřejná část katalogových dat pro výpočty v prohlížeči: bez EAN / GTIN, ceníkových cen a celých importů ETIM.",
    'import type { EtimFrameLimit } from "./brand-etim.generated";',
    'import type { PublicBoxData, PublicDeviceDepth } from "./catalog-public";',
    "",
    `export const KOPOS_DATA_SOURCE = ${JSON.stringify(data.koposSource)};`,
    "",
    `export const DEVICE_DEPTHS: Record<string, PublicDeviceDepth> = ${JSON.stringify(data.deviceDepths, null, 2)};`,
    "",
    `export const FRAME_LIMITS: Record<string, EtimFrameLimit> = ${JSON.stringify(data.frameLimits, null, 2)};`,
    "",
    `export const KOPOS_BOXES: Record<string, PublicBoxData> = ${JSON.stringify(data.koposBoxes, null, 2)};`,
    "",
  ].join("\n");
}
