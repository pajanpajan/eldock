import { unlink } from "node:fs/promises";

import type { PrismaClient } from "@/generated/prisma/client";

import { markFilesDeleted } from "./file-registry";
import { databaseUploadReferences, listUploads, type StoredUpload } from "./upload-references";

// Úklid osiřelých souborů v `storage/uploads` (fáze 48, `npm run storage:cleanup`): soubor, na který
// neodkazuje žádný textový sloupec databáze (URL `/api/files/…` v polích *Url, JSON i SVG půdorysů),
// starší než 24 hodin a mimo složky `seed/`, se smaže. Registr souborů a zálohy (fáze 68) se za odkaz nepočítají.

export { databaseUploadReferences, extractUploadUrls, listUploads, type StoredUpload } from "./upload-references";

export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** Osiřelé soubory: bez odkazu v databázi a starší než `minAgeMs` (čerstvý upload ještě nemusí být uložený). */
export function findOrphans(files: readonly StoredUpload[], references: ReadonlySet<string>, now: number, minAgeMs = ORPHAN_MIN_AGE_MS): StoredUpload[] {
  return files.filter((file) => !file.url.includes("/seed/") && !references.has(file.url) && now - file.mtimeMs >= minAgeMs);
}

export interface CleanupReport {
  scanned: number;
  references: number;
  orphans: StoredUpload[];
  removed: number;
  freedBytes: number;
}

/** Najde a (bez `dryRun`) smaže osiřelé soubory. Prázdná databáze bez odkazů = nic nemazat. */
export async function cleanupStorage(prisma: PrismaClient, root: string, options: { dryRun?: boolean; now?: number } = {}): Promise<CleanupReport> {
  const [files, references] = await Promise.all([listUploads(root), databaseUploadReferences(prisma)]);
  const orphans = findOrphans(files, references, options.now ?? Date.now());
  // Pojistka: databáze bez jediného odkazu (špatná DATABASE_URL, prázdná DB) – nic nemazat
  if (!references.size || options.dryRun) return { scanned: files.length, references: references.size, orphans, removed: 0, freedBytes: 0 };
  let removed = 0;
  let freedBytes = 0;
  const removedUrls: string[] = [];
  for (const orphan of orphans) {
    try {
      await unlink(orphan.filePath);
      removed++;
      freedBytes += orphan.bytes;
      removedUrls.push(orphan.url);
    } catch {
      // soubor mezitím zmizel – nevadí
    }
  }
  // Fáze 68: smazané soubory označit v registru (číst nejdou, záloha mimo server je po 30 dnech odstraní)
  await markFilesDeleted(prisma, removedUrls);
  return { scanned: files.length, references: references.size, orphans, removed, freedBytes };
}
