import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { contentTypeFor, resolveUploadPath, type UploadKind } from "@/lib/files";

// Zápis souborů do `storage/uploads` (servíruje je `GET /api/files/...`).

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/** Uloží soubor pod náhodným jménem `<UUID><přípona>` a vrátí jeho URL. */
export async function saveUpload(dir: UploadKind, extension: string, data: Buffer | string) {
  const storedName = `${randomUUID()}${extension}`;
  await mkdir(path.join(UPLOAD_ROOT, dir), { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, dir, storedName), data);
  return { url: `/api/files/${dir}/${storedName}`, storedName };
}

/**
 * Obsah uloženého souboru podle URL aplikace: `/api/files/…` (storage/uploads) nebo vzorové PDF
 * `/demo-docs/<soubor>.pdf` (public). Cokoli jiného nebo neexistující soubor → null.
 */
export async function readStoredFile(url: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  let filePath: string | null = null;
  if (url.startsWith("/api/files/")) filePath = resolveUploadPath(UPLOAD_ROOT, url.slice("/api/files/".length).split("/").map(decodeURIComponent));
  else if (/^\/demo-docs\/[\w.-]+\.pdf$/.test(url)) filePath = path.join(process.cwd(), "public", url);
  if (!filePath) return null;
  try {
    // Cesta je známá až za běhu – nepatří do trasování buildu (jinak Turbopack přibalí celý projekt).
    return { bytes: await readFile(/* turbopackIgnore: true */ filePath), mimeType: contentTypeFor(filePath) };
  } catch {
    return null;
  }
}
