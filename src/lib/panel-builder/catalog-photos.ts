// Fáze 92: reálné produktové fotky designových řad v galerii „Designové řady a barvy“. Dva zdroje:
//  1) `scripts/harvest-switch-photos.mjs` stáhne oficiální fotky výrobců (Playwright) do `public/catalog-images/<výrobce>/
//     <řada>/<barva>-<díl>.<přípona>` a zapíše je do `public/catalog-images/manifest.json` se zdrojem a licencí každé fotky;
//  2) nahrávač Ctrl+V / soubor v galerii (`POST /api/catalog-images/upload`, jen velín) uloží WebP do trvalého úložiště
//     `storage/catalog-images/…` – hned a pro všechny uživatele (`GET /api/catalog-images/manifest`).
// Fotka má přednost před vektorovým renderem. Čisté funkce.

import { CATALOG_IMAGE_PARTS, catalogSlug, type CatalogImagePart } from "./catalog-images";
import { DESIGN_BRANDS, seriesColors } from "./wiring-designs";

export type PhotoPart = Exclude<CatalogImagePart, "product">;

/** Sloty galerie: spínač, zásuvka a víceramček (u monobloků dvojzásuvka). Dlaždice barvy = spínač v té barvě. */
export const PHOTO_SLOTS: readonly { part: PhotoPart; label: string }[] = [
  { part: "switch", label: "Spínač 1R" },
  { part: "socket", label: "Zásuvka 1R" },
  { part: "set", label: "Vícerámeček" },
];

export const isPhotoPart = (value: unknown): value is PhotoPart => CATALOG_IMAGE_PARTS.includes(value as PhotoPart);

/** Položka `manifest.json` (stažené fotky ve veřejném repozitáři) i manifestu nahraných fotek v úložišti. */
export interface ManifestPhoto {
  /** Klíč řady „ABB|Tango“. */
  series: string;
  /** Barva řady (id); bez ní fotka celé řady. */
  color?: string;
  part: PhotoPart;
  /** Cesta souboru vůči kořeni katalogu („abb/tango/abb-tango-b-switch.webp“). */
  file: string;
  source: string;
  license: string;
  /** Stránka výrobce, odkud fotka pochází (harvester), nebo „nahráno ve velínu“. */
  sourceUrl?: string;
  /** Datum stažení / nahrání (ISO). */
  retrievedAt?: string;
  /** Fáze 94: objednací číslo výrobce a GTIN / EAN vyfoceného dílu (import ETIM 9.0). */
  mpn?: string;
  gtin?: string;
}

export interface PhotoManifest {
  version: 1;
  photos: ManifestPhoto[];
}

const FILE_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+-(switch|socket|set|frame)\.(webp|png|jpg|jpeg|avif)$/;

/** Načtení manifestu fotek – neplatné položky se zahodí (cizí cesta, neznámá řada, díl nebo barva). */
export function parsePhotoManifest(value: unknown): ManifestPhoto[] {
  const list = value && typeof value === "object" && Array.isArray((value as PhotoManifest).photos) ? (value as PhotoManifest).photos : [];
  const photos: ManifestPhoto[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const { series, color, part, file, source, license, sourceUrl, retrievedAt, mpn, gtin } = raw as Partial<ManifestPhoto>;
    if (typeof series !== "string" || !isPhotoPart(part) || typeof file !== "string" || !FILE_PATTERN.test(file) || typeof source !== "string" || typeof license !== "string") continue;
    const target = photoTarget(series, color ?? null, part);
    if (!target || !file.startsWith(`${target.maker}/${target.folder}/`)) continue;
    photos.push({
      series,
      ...(color ? { color } : {}),
      part,
      file,
      source: source.slice(0, 160),
      license: license.slice(0, 160),
      ...(typeof sourceUrl === "string" && /^https:\/\//.test(sourceUrl) ? { sourceUrl: sourceUrl.slice(0, 400) } : {}),
      ...(typeof retrievedAt === "string" ? { retrievedAt: retrievedAt.slice(0, 32) } : {}),
      ...(typeof mpn === "string" && mpn.trim() ? { mpn: mpn.trim().slice(0, 40) } : {}),
      ...(typeof gtin === "string" && /^\d{8,14}$/.test(gtin) ? { gtin } : {}),
    });
  }
  return photos;
}

/** Stabilní zápis manifestu (řazení podle souboru, aby se soubor neměnil bez důvodu). */
export function renderPhotoManifest(photos: readonly ManifestPhoto[]): string {
  const manifest: PhotoManifest = { version: 1, photos: [...photos].sort((a, b) => a.file.localeCompare(b.file)) };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Cíl fotky: složka výrobce a řady (jako u renderů) a název souboru `<barva>-<díl>` (bez barvy `rada-<díl>`). Barva musí
 * patřit řadě; null = neznámá řada / barva.
 */
export function photoTarget(series: string, color: string | null, part: PhotoPart): { maker: string; folder: string; base: string } | null {
  const [manufacturer, name] = series.split("|");
  const brand = DESIGN_BRANDS.find((candidate) => candidate.manufacturer === manufacturer);
  const option = brand?.series.find((candidate) => candidate.name === name);
  if (!brand || !option || !isPhotoPart(part)) return null;
  if (color && !seriesColors(series).some((candidate) => candidate.id === color)) return null;
  if (color && !/^[a-z0-9-]{2,60}$/.test(color)) return null;
  return { maker: catalogSlug(brand.manufacturer), folder: catalogSlug(option.name), base: `${color ?? "rada"}-${part}` };
}

/** Nová položka manifestu – nahrazuje stávající fotku stejného slotu (řada + barva + díl). */
export function upsertPhoto(photos: readonly ManifestPhoto[], photo: ManifestPhoto): ManifestPhoto[] {
  const same = (entry: ManifestPhoto) => entry.series === photo.series && (entry.color ?? null) === (photo.color ?? null) && entry.part === photo.part;
  return [...photos.filter((entry) => !same(entry)), photo];
}
