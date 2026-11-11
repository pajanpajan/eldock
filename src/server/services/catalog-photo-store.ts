// Fáze 92: nahrané reálné fotky designových řad (velín → galerie „Designové řady a barvy“ pro všechny uživatele). Soubory
// jsou v trvalém úložišti `storage/catalog-images/<výrobce>/<řada>/<barva>-<díl>.webp` (svazek Dockeru – přežijí nasazení,
// `public/` je v obrazu jen ze sestavení) a v jejich `manifest.json`; servíruje je `GET /api/catalog-images/file/…`.
// Každý obrázek se znovu zakóduje přes sharp do WebP (max. 1600 px, bez metadat) – do úložiště se nedostane nic jiného
// než rastrový obrázek. Záměrně bez `server-only` (testy nad dočasnou složkou).

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { parsePhotoManifest, photoTarget, renderPhotoManifest, upsertPhoto, type ManifestPhoto, type PhotoPart } from "@/lib/panel-builder/catalog-photos";
import type { SeriesPhoto } from "@/lib/panel-builder/series-photos";
import { WorkflowError } from "@/lib/workflow/state-machine";

export const CATALOG_PHOTO_ROOT = path.join(process.cwd(), "storage", "catalog-images");
/** Největší nahrávaný obrázek [B] (fotka z webu nebo výřez z PDF katalogu). */
export const CATALOG_PHOTO_MAX_UPLOAD = 10 * 1024 * 1024;
/** Delší strana uložené fotky [px]. */
export const CATALOG_PHOTO_MAX_PX = 1600;
const INPUT_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff", "heif"]);
const FILE = /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+-(switch|socket|set)\.webp$/;

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

/** Adresa nahrané fotky; `v` = čas nahrání (nová fotka stejného slotu obejde mezipaměť prohlížeče). */
export const uploadedPhotoSrc = (photo: Pick<ManifestPhoto, "file" | "retrievedAt">) => `/api/catalog-images/file/${photo.file}${photo.retrievedAt ? `?v=${encodeURIComponent(photo.retrievedAt)}` : ""}`;

export async function readStoredPhotos(root = CATALOG_PHOTO_ROOT): Promise<ManifestPhoto[]> {
  try {
    return parsePhotoManifest(JSON.parse(await readFile(/* turbopackIgnore: true */ path.join(root, "manifest.json"), "utf8")));
  } catch {
    return [];
  }
}

/** Nahrané fotky jako fotky galerie (přednost před fotkami a rendery z repozitáře). */
export async function uploadedSeriesPhotos(root = CATALOG_PHOTO_ROOT): Promise<SeriesPhoto[]> {
  return (await readStoredPhotos(root)).map((photo) => ({ series: photo.series, ...(photo.color ? { color: photo.color } : {}), part: photo.part, src: uploadedPhotoSrc(photo), source: photo.source, license: photo.license, photo: true }));
}

// Zápisy manifestu jdou po sobě (jeden proces Node.js) – dvě nahrání najednou se nepřepíšou
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

/** Uloží fotku slotu (řada + barva + díl): WebP do úložiště a záznam do manifestu (stará fotka slotu se nahradí). */
export async function storeCatalogPhoto(
  input: { data: Buffer; series: string; color: string | null; part: PhotoPart; source: string; license: string; now?: Date },
  root = CATALOG_PHOTO_ROOT,
): Promise<ManifestPhoto> {
  const target = photoTarget(input.series, input.color, input.part);
  if (!target) fail("Neznámá designová řada, barva nebo díl.");
  if (!input.data.length || input.data.length > CATALOG_PHOTO_MAX_UPLOAD) fail(`Obrázek musí mít 1 B až ${CATALOG_PHOTO_MAX_UPLOAD / 1024 / 1024} MB.`);
  let webp: Buffer;
  try {
    const image = sharp(input.data, { limitInputPixels: 60_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !INPUT_FORMATS.has(meta.format)) fail("Vložte obrázek JPG, PNG, WebP, GIF nebo AVIF (ne SVG ani PDF).");
    webp = await image.rotate().resize({ width: CATALOG_PHOTO_MAX_PX, height: CATALOG_PHOTO_MAX_PX, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    return fail("Soubor není čitelný obrázek.");
  }
  const { maker, folder, base } = target!;
  const file = `${maker}/${folder}/${base}.webp`;
  const photo: ManifestPhoto = {
    series: input.series,
    ...(input.color ? { color: input.color } : {}),
    part: input.part,
    file,
    source: input.source.trim().slice(0, 160) || "Vloženo ve velínu Eldocku",
    license: input.license.trim().slice(0, 160) || "fotka výrobce – užití potvrdil provozovatel Eldocku",
    retrievedAt: (input.now ?? new Date()).toISOString(),
  };
  return serial(async () => {
    await mkdir(path.join(root, maker, folder), { recursive: true });
    const target = path.join(root, file);
    await writeFile(`${target}.tmp`, webp!);
    await rename(`${target}.tmp`, target);
    const photos = upsertPhoto(await readStoredPhotos(root), photo);
    const manifest = path.join(root, "manifest.json");
    await writeFile(`${manifest}.tmp`, renderPhotoManifest(photos));
    await rename(`${manifest}.tmp`, manifest);
    return photo;
  });
}

/** Obsah nahrané fotky podle cesty v adrese (jen `<výrobce>/<řada>/<soubor>.webp` uvnitř úložiště), jinak null. */
export async function readCatalogPhotoFile(relative: string, root = CATALOG_PHOTO_ROOT): Promise<Buffer | null> {
  if (!FILE.test(relative)) return null;
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) return null;
  try {
    return await readFile(/* turbopackIgnore: true */ resolved);
  } catch {
    return null;
  }
}
