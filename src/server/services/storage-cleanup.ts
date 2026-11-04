import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { UPLOAD_KINDS } from "@/lib/files";

// Úklid osiřelých souborů v `storage/uploads` (fáze 48, `npm run storage:cleanup`): soubor, na který
// neodkazuje žádný textový sloupec databáze (URL `/api/files/…` v polích *Url, JSON i SVG půdorysů),
// starší než 24 hodin a mimo složky `seed/`, se smaže.

export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const URL_PATTERN = /\/api\/files\/[a-z]+\/[^\s"'()<>\\]+/g;

/** Všechny URL nahraných souborů zmíněné v textech (dekódované, bez koncové interpunkce). */
export function extractUploadUrls(texts: Iterable<string>): Set<string> {
  const urls = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,;:]+$/, "");
      urls.add(url);
      try {
        urls.add(decodeURI(url));
      } catch {
        // neplatné % kódování – necháme původní tvar
      }
    }
  }
  return urls;
}

/** Odkazy na nahrané soubory z celé databáze: každý textový sloupec každé tabulky s „/api/files/“. */
export async function databaseUploadReferences(prisma: PrismaClient): Promise<Set<string>> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  const texts: string[] = [];
  for (const { name } of tables) {
    const columns = await prisma.$queryRawUnsafe<{ name: string; type: string }[]>(`PRAGMA table_info("${name.replace(/"/g, "")}")`);
    for (const column of columns.filter((col) => /TEXT|CHAR|CLOB/i.test(col.type))) {
      const quoted = `"${column.name.replace(/"/g, "")}"`;
      const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(`SELECT ${quoted} AS value FROM "${name.replace(/"/g, "")}" WHERE ${quoted} LIKE '%/api/files/%'`);
      for (const row of rows) texts.push(row.value);
    }
  }
  return extractUploadUrls(texts);
}

export interface StoredUpload {
  url: string;
  filePath: string;
  mtimeMs: number;
  bytes: number;
}

/** Soubory v `storage/uploads/<druh>/` (bez podsložek – `seed/` a jiné se přeskočí). */
export async function listUploads(root: string): Promise<StoredUpload[]> {
  const result: StoredUpload[] = [];
  for (const kind of UPLOAD_KINDS) {
    const dir = path.join(root, kind);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue; // .gitkeep apod.
      const filePath = path.join(dir, entry.name);
      const info = await stat(filePath);
      result.push({ url: `/api/files/${kind}/${entry.name}`, filePath, mtimeMs: info.mtimeMs, bytes: info.size });
    }
  }
  return result;
}

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
  for (const orphan of orphans) {
    try {
      await unlink(orphan.filePath);
      removed++;
      freedBytes += orphan.bytes;
    } catch {
      // soubor mezitím zmizel – nevadí
    }
  }
  return { scanned: files.length, references: references.size, orphans, removed, freedBytes };
}
