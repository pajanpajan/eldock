import "server-only";

import { ETIM_FRAMES, ETIM_GTIN, type EtimFrame } from "@/lib/panel-builder/abb-etim.generated";
import { KOPOS_BOX_DATA } from "@/lib/panel-builder/brand-etim.generated";
import { boxImage, enclosureImage, productImage, type CatalogImage } from "@/lib/panel-builder/catalog-images";
import { CATALOG_IMAGES } from "@/lib/panel-builder/catalog-images.generated";
import { SERIES_PHOTOS, catalogSeriesPhotos, type SeriesPhoto } from "@/lib/panel-builder/series-photos";

// Fáze 104: katalogová data, která do klientského JS bundlu nesmí – celé importy ETIM (ABB ETIM 9.0: EAN / GTIN
// objednacích čísel, rámečky 1R–5R s EAN; Hager ETIM 10 a KOPOS: EAN a ceníkové ceny) a index produktových fotek
// s objednacími čísly. Prohlížeč dostane jen to, co právě zobrazuje (EAN položek svého kusovníku, rámečky zvolené řady,
// fotku konkrétní skříně / krabice / výrobku), přes serverové akce a API pro přihlášené.

/** EAN objednacího čísla přístroje (ABB ETIM 9.0) nebo krabice (KOPOS – stránka výrobku); null = výrobce neuvádí. */
export function catalogEan(code: string, kind: "device" | "box" = "device"): string | null {
  return kind === "box" ? (KOPOS_BOX_DATA[code]?.ean ?? null) : (ETIM_GTIN[code] ?? null);
}

/** Klíč položky kusovníku pro dotaz na EAN („dev:6619A-A06357 B“, „box:KPR 68_KA“). */
export const eanKey = (code: string, box: boolean) => `${box ? "box" : "dev"}:${code}`;

/** EAN pro seznam položek kusovníku – jen nalezené (klíč `eanKey`). */
export function catalogEans(items: readonly { code: string; box?: boolean }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of items) {
    const ean = catalogEan(item.code, item.box ? "box" : "device");
    if (ean) result[eanKey(item.code, Boolean(item.box))] = ean;
  }
  return result;
}

/** Rámečky 1R–5R barvy řady z oficiálních dat ABB ETIM 9.0 („ABB|Tango|abb-tango-b“). */
export const etimFramesFor = (key: string): EtimFrame[] | null => ETIM_FRAMES[key] ?? null;

/** Fotky dílů designových řad z `public/catalog-images/` (ruční seznam má přednost) – galerie řad pro přihlášené. */
export const ALL_SERIES_PHOTOS: readonly SeriesPhoto[] = [...SERIES_PHOTOS, ...catalogSeriesPhotos(CATALOG_IMAGES)];

export type CatalogImageKind = "enclosure" | "box" | "product";
export type CatalogImageLite = Pick<CatalogImage, "src" | "source" | "license">;

/** Fotka konkrétní rozvodnice (objednací číslo), krabice (kód) nebo výrobku chytré domácnosti (id) – bez celého indexu. */
export function lookupCatalogImage(kind: CatalogImageKind, key: string): CatalogImageLite | null {
  const image = kind === "enclosure" ? enclosureImage(key, CATALOG_IMAGES) : kind === "box" ? boxImage(key, CATALOG_IMAGES) : kind === "product" ? productImage(key, CATALOG_IMAGES) : null;
  return image ? { src: image.src, source: image.source, license: image.license } : null;
}
