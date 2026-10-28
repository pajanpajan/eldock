import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { UploadKind } from "@/lib/files";

// Zápis souborů do `storage/uploads` (servíruje je `GET /api/files/...`).

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/** Uloží soubor pod náhodným jménem `<UUID><přípona>` a vrátí jeho URL. */
export async function saveUpload(dir: UploadKind, extension: string, data: Buffer | string) {
  const storedName = `${randomUUID()}${extension}`;
  await mkdir(path.join(UPLOAD_ROOT, dir), { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, dir, storedName), data);
  return { url: `/api/files/${dir}/${storedName}`, storedName };
}
