// Fáze 74: originální fotografie designových řad domovních přístrojů v galerii řad a barev. Fotky výrobců jsou autorská
// díla – do aplikace (a do veřejného repozitáře) se smí dostat jen fotka, ke které má Eldock právo (partnerská fotobanka
// výrobce, písemný souhlas). Každá položka proto nese zdroj a licenci a galerie ji vypíše pod fotkou. Bez fotky galerie
// kreslí vektorový náhled (`DeviceMockup`). Soubory patří do `public/series/<výrobce>/<řada>/<barva>-<díl>.webp`.
// Čisté funkce.

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

/** Fotka dílu řady v barvě (přesná barva, jinak fotka řady bez barvy); null = vektorový náhled. */
export function seriesPhoto(series: string | null | undefined, color: string | null | undefined, part: SeriesPhotoPart, photos: readonly SeriesPhoto[] = SERIES_PHOTOS): SeriesPhoto | null {
  if (!series) return null;
  const own = photos.filter((photo) => photo.series === series && photo.part === part);
  return own.find((photo) => photo.color === color) ?? own.find((photo) => !photo.color) ?? null;
}
