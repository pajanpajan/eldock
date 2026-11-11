// Fáze 74: originální fotografie designových řad domovních přístrojů v galerii řad a barev. Fotky výrobců jsou autorská
// díla – do aplikace (a do veřejného repozitáře) se smí dostat jen fotka, ke které má Eldock právo (partnerská fotobanka
// výrobce, písemný souhlas). Každá položka proto nese zdroj a licenci a galerie ji vypíše pod fotkou. Bez fotky galerie
// kreslí vektorový náhled (`DeviceMockup`). Soubory patří do `public/series/<výrobce>/<řada>/<barva>-<díl>.webp`.
// Čisté funkce. Fáze 78: i oficiální náhledy z `public/catalog-images/` (`catalog-images.ts`).

import type { CatalogImage } from "./catalog-images";
import { CATALOG_IMAGES } from "./catalog-images.generated";

/** Fáze 94: „frame“ = rámeček 1R v barvě (dlaždice barvy rámečku). */
export type SeriesPhotoPart = "switch" | "socket" | "set" | "frame";

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
  /** Fáze 92: reálná fotka (stažená harvesterem nebo nahraná ve velínu), jinak render / kresba. */
  photo?: boolean;
  /** Fáze 94: objednací číslo vyfoceného výrobku (fotka z dat ABB ETIM 9.0). */
  mpn?: string;
}

/**
 * Ručně schválené fotky (`public/series/…`, položka se zdrojem i licencí). Fáze 80: uživatel 2026-11-10 potvrdil, že
 * produktové náhledy výrobců smí být ve veřejném repozitáři – nové náhledy patří do `public/catalog-images/` (manifest
 * `npm run catalog:images`, rendery řad ABB `npm run catalog:renders`); tento seznam zůstává pro výjimky.
 */
export const SERIES_PHOTOS: readonly SeriesPhoto[] = [];

/**
 * Fáze 78: fotky z `public/catalog-images/<výrobce>/<řada>/` (manifest `npm run catalog:images`, zdroj a licence ze
 * `zdroj.json` složky) – spolu s ručním seznamem `SERIES_PHOTOS`; ruční položka má přednost.
 */
export const ALL_SERIES_PHOTOS: readonly SeriesPhoto[] = [
  ...SERIES_PHOTOS,
  // Fáze 92: reálné fotky (`manifest.json`) před rendery stejného dílu a barvy
  ...CATALOG_IMAGES.filter((image): image is CatalogImage & { part: SeriesPhotoPart } => image.part !== "product")
    .map((image) => ({ series: image.series, ...(image.color ? { color: image.color } : {}), part: image.part, src: image.src, source: image.source, license: image.license, ...(image.photo ? { photo: true } : {}), ...(image.mpn ? { mpn: image.mpn } : {}) }))
    .sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo))),
];

/** Fáze 92: nahrané fotky (velín, trvalé úložiště) mají přednost před staženými fotkami a rendery z repozitáře. */
export const withUploadedPhotos = (uploaded: readonly SeriesPhoto[], photos: readonly SeriesPhoto[] = ALL_SERIES_PHOTOS): readonly SeriesPhoto[] => (uploaded.length ? [...uploaded.map((photo) => ({ ...photo, photo: true })), ...photos] : photos);

/** Fotka dílu řady v barvě (přesná barva, jinak fotka řady bez barvy); null = vektorový náhled. */
export function seriesPhoto(series: string | null | undefined, color: string | null | undefined, part: SeriesPhotoPart, photos: readonly SeriesPhoto[] = ALL_SERIES_PHOTOS): SeriesPhoto | null {
  if (!series) return null;
  const own = photos.filter((photo) => photo.series === series && photo.part === part);
  return own.find((photo) => photo.color === color) ?? own.find((photo) => !photo.color) ?? null;
}
