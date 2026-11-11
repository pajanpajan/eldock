// Fáze 78: oficiální náhledy výrobců z `public/catalog-images/<výrobce>/<řada>/` (manifest generuje
// `npm run catalog:images`). Fotky jsou díla výrobců – smí se použít jen se souhlasem; každá složka nese `zdroj.json`
// se zdrojem a podmínkami užití, které galerie vypíše pod fotkou. Bez fotky zůstává vektorový náhled. Čisté funkce.

import { DESIGN_BRANDS } from "./wiring-designs";

export const CATALOG_IMAGE_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif", "svg"];
/** Největší náhled [B] – fotky ve vysokém rozlišení, ale ne originály tiskových dat. */
export const CATALOG_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
// Fáze 94: „frame“ = rámeček 1R v barvě (dlaždice barvy rámečku, fotka z ETIM 9.0)
export const CATALOG_IMAGE_PARTS = ["switch", "socket", "set", "frame"] as const;
export type CatalogImagePart = (typeof CATALOG_IMAGE_PARTS)[number] | "product";

export interface CatalogImage {
  /** Řada „ABB|Tango“, u chytré domácnosti `smart`, u rozvodnic `enclosure` (fáze 94). */
  series: string;
  /** Barva řady (id), bez ní fotka celé řady; u chytré domácnosti id výrobku, u rozvodnice objednací číslo (slug). */
  color?: string;
  part: CatalogImagePart;
  /** Cesta v `public/` („/catalog-images/abb/tango/abb-tango-n-switch.webp“). */
  src: string;
  source: string;
  license: string;
  /** Fáze 92: reálná fotka výrobce (`manifest.json`, zdroj a licence u fotky) – má přednost před vektorovým renderem. */
  photo?: boolean;
  /** Fáze 94: objednací číslo vyfoceného výrobku (import ABB ETIM 9.0). */
  mpn?: string;
}

/** Slug složky: malá písmena bez diakritiky, mezery a znaky → „-“ („Time Arbo“ → „time-arbo“, „Variant+“ → „variant“). */
export const catalogSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Složka řady → klíč řady (`výrobce|řada`), null = neznámá řada. */
export function seriesForFolder(maker: string, series: string): string | null {
  for (const brand of DESIGN_BRANDS) {
    if (catalogSlug(brand.manufacturer) !== maker) continue;
    const found = brand.series.find((option) => catalogSlug(option.name) === series);
    if (found) return `${brand.manufacturer}|${found.name}`;
  }
  return null;
}

/** Soubor ve složce → položka manifestu (`<barva>-<díl>`, `rada-<díl>` bez barvy, `smart/<id výrobku>`). */
export function catalogImageEntry(maker: string, series: string, file: string, license: { source: string; license: string }, options: { photo?: boolean; mpn?: string } = {}): CatalogImage | null {
  const extension = file.split(".").pop()?.toLowerCase() ?? "";
  if (!CATALOG_IMAGE_EXTENSIONS.includes(extension)) return null;
  const base = file.slice(0, -(extension.length + 1));
  const src = `/catalog-images/${maker}/${series}/${file}`;
  const meta = { src, source: license.source.slice(0, 160), license: license.license.slice(0, 160), ...(options.photo ? { photo: true } : {}), ...(options.mpn ? { mpn: options.mpn.slice(0, 40) } : {}) };
  // Fáze 94: id výrobků chytré domácnosti obsahují i podtržítko („abb_knx-knx-sa8“)
  if (series === "smart") return /^[a-z0-9_-]{2,60}$/.test(base) ? { series: "smart", color: base, part: "product", ...meta } : null;
  // Fáze 94: fotky rozvodnic podle objednacího čísla (`abb/enclosures/<mpn>.webp`)
  if (series === "enclosures") return /^[a-z0-9-]{2,60}$/.test(base) ? { series: "enclosure", color: base, part: "product", ...meta } : null;
  const key = seriesForFolder(maker, series);
  const match = /^(.+)-(switch|socket|set|frame)$/.exec(base);
  if (!key || !match) return null;
  return { series: key, ...(match[1] === "rada" ? {} : { color: match[1] }), part: match[2] as CatalogImagePart, ...meta };
}

/** Zdroj manifestu (TypeScript) – stabilní pořadí, aby se soubor neměnil bez důvodu. */
export function renderCatalogImages(images: readonly CatalogImage[]): string {
  const sorted = [...images].sort((a, b) => a.src.localeCompare(b.src));
  return [
    "// Generuje `npm run catalog:images` z public/catalog-images/ – needitujte ručně.",
    'import type { CatalogImage } from "./catalog-images";',
    "",
    `export const CATALOG_IMAGES: readonly CatalogImage[] = ${JSON.stringify(sorted, null, 2)};`,
    "",
  ].join("\n");
}

/** Náhled výrobku chytré domácnosti (karta katalogu), null = vektorový náhled. */
export function productImage(productId: string, images: readonly CatalogImage[]): CatalogImage | null {
  return images.find((image) => image.series === "smart" && image.color === productId) ?? null;
}

/** Fáze 94: fotka rozvodnice podle objednacího čísla výrobce (ETIM 9.0); null = kresba dvířek. */
export function enclosureImage(articleNumber: string | null | undefined, images: readonly CatalogImage[]): CatalogImage | null {
  if (!articleNumber) return null;
  const key = catalogSlug(articleNumber);
  return images.find((image) => image.series === "enclosure" && image.color === key) ?? null;
}
