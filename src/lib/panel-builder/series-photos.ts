// Fáze 74: originální fotografie designových řad domovních přístrojů v galerii řad a barev. Fotky výrobců jsou autorská
// díla – do aplikace (a do veřejného repozitáře) se smí dostat jen fotka, ke které má Eldock právo (partnerská fotobanka
// výrobce, písemný souhlas). Každá položka proto nese zdroj a licenci a galerie ji vypíše pod fotkou. Bez fotky galerie
// kreslí vektorový náhled (`DeviceMockup`). Soubory patří do `public/series/<výrobce>/<řada>/<barva>-<díl>.webp`.
// Čisté funkce. Fáze 78: i oficiální náhledy z `public/catalog-images/` (`catalog-images.ts`).

import type { CatalogImage } from "./catalog-images";
import { CATALOG_IMAGES } from "./catalog-images.generated";

export type SeriesPhotoPart = "switch" | "socket" | "set";

export interface SeriesPhoto {
  /** Klíč řady „ABB|Tango“. */
  series: string;
  /** Barva řady (`SeriesColor.id`); bez ní fotka platí pro celou řadu (výchozí barva). */
  color?: string;
  part: SeriesPhotoPart;
  /** Cesta v `public/` („/series/abb/tango/abb-tango-n-switch.webp“). */
  src: string;
  /** Zdroj fotky (fotobanka / stránka výrobce) a podmínky užití – zobrazí se pod fotkou. */
  source: string;
  license: string;
}

/**
 * Schválené fotky. Prázdné, dokud není potvrzené právo fotky výrobců použít – doplnění = položka zde + soubor
 * v `public/series/…` (test hlídá, že soubor existuje a položka má zdroj i licenci).
 */
export const SERIES_PHOTOS: readonly SeriesPhoto[] = [];

/**
 * Fáze 78: fotky z `public/catalog-images/<výrobce>/<řada>/` (manifest `npm run catalog:images`, zdroj a licence ze
 * `zdroj.json` složky) – spolu s ručním seznamem `SERIES_PHOTOS`; ruční položka má přednost.
 */
export const ALL_SERIES_PHOTOS: readonly SeriesPhoto[] = [
  ...SERIES_PHOTOS,
  ...CATALOG_IMAGES.filter((image): image is CatalogImage & { part: SeriesPhotoPart } => image.part !== "product").map((image) => ({ series: image.series, ...(image.color ? { color: image.color } : {}), part: image.part, src: image.src, source: image.source, license: image.license })),
];

/** Fotka dílu řady v barvě (přesná barva, jinak fotka řady bez barvy); null = vektorový náhled. */
export function seriesPhoto(series: string | null | undefined, color: string | null | undefined, part: SeriesPhotoPart, photos: readonly SeriesPhoto[] = ALL_SERIES_PHOTOS): SeriesPhoto | null {
  if (!series) return null;
  const own = photos.filter((photo) => photo.series === series && photo.part === part);
  return own.find((photo) => photo.color === color) ?? own.find((photo) => !photo.color) ?? null;
}
