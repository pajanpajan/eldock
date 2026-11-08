import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { UPLOAD_KINDS } from "@/lib/files";

// Odkazy databáze na nahrané soubory (fáze 48 úklid, fáze 68 doplnění registru): každý textový sloupec každé tabulky
// s „/api/files/“ – pole *Url, JSON (lišty, nákresy půdorysů) i SVG půdorysů pater.

const URL_PATTERN = /\/api\/files\/[a-z]+\/[^\s"'()<>\\]+/g;

/** Tabulky, které soubory jen evidují (registr, zálohy) – nejsou to odkazy, které by soubor držely naživu (fáze 68). */
export const BOOKKEEPING_TABLES = new Set(["StoredFile", "BackupObject", "MaintenanceRun"]);

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

export interface ReferenceRow {
  table: string;
  /** `id` řádku (null = tabulka bez sloupce id). */
  id: string | null;
  urls: string[];
}

const quote = (name: string) => `"${name.replace(/"/g, "")}"`;

/** Řádky databáze, které odkazují na nahrané soubory (tabulka, id řádku, adresy). */
export async function uploadReferenceRows(prisma: PrismaClient): Promise<ReferenceRow[]> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  const rows: ReferenceRow[] = [];
  for (const { name } of tables) {
    if (BOOKKEEPING_TABLES.has(name)) continue;
    const columns = await prisma.$queryRawUnsafe<{ name: string; type: string }[]>(`PRAGMA table_info(${quote(name)})`);
    const hasId = columns.some((column) => column.name === "id");
    for (const column of columns.filter((col) => /TEXT|CHAR|CLOB/i.test(col.type))) {
      const col = quote(column.name);
      const found = await prisma.$queryRawUnsafe<{ id: string | null; value: string }[]>(`SELECT ${hasId ? '"id"' : "NULL"} AS id, ${col} AS value FROM ${quote(name)} WHERE ${col} LIKE '%/api/files/%'`);
      for (const row of found) rows.push({ table: name, id: row.id, urls: [...extractUploadUrls([row.value])] });
    }
  }
  return rows;
}

/** Odkazy na nahrané soubory z celé databáze (množina adres). */
export async function databaseUploadReferences(prisma: PrismaClient): Promise<Set<string>> {
  return new Set((await uploadReferenceRows(prisma)).flatMap((row) => row.urls));
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
