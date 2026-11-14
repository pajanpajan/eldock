import { mkdir, readdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";

import type { PrismaClient } from "@/generated/prisma/client";
import type { MaintenanceTrigger } from "@/generated/prisma/enums";
import { UPLOAD_KINDS } from "@/lib/files";
import { LOCAL_BACKUP_INFO } from "@/lib/platform-settings";
import type { BackupConfig } from "@/server/backup/config";
import { createSealer, packFile, unpackFile, type Sealer } from "@/server/backup/crypto";
import { S3Client } from "@/server/backup/s3";

// Zálohy (fáze 68): denní konzistentní snímek databáze (VACUUM INTO za běhu, kontrola integrity, gzip, šifrování),
// místní rotace a mimo server (S3) šifrovaný snímek s retencí denních a měsíčních kopií + přírůstkově soubory úložiště.
// Obnova jen do prázdné složky (`restoreBackup`) – nikdy přes živá data.

export const SNAPSHOT_PATTERN = /^eldock-(\d{8}T\d{6}Z)\.db\.gz(\.enc)?$/;
const RUNNING_STALE_MS = 3 * 60 * 60 * 1000;
const DEFAULT_FILE_BUDGET_MS = 45 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Razítko názvu snímku `20261108T013000Z` (UTC). */
export const snapshotStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
export const snapshotName = (date: Date, encrypted: boolean) => `eldock-${snapshotStamp(date)}.db.gz${encrypted ? ".enc" : ""}`;

/**
 * Které snímky ponechat (retence): nejnovější snímek každého z posledních `keepDaily` dnů a nejnovější snímek
 * každého z posledních `keepMonthly` měsíců. Vstup = názvy snímků, výstup = množina názvů k ponechání.
 */
export function snapshotsToKeep(names: readonly string[], keepDaily: number, keepMonthly: number): Set<string> {
  const dated = names.map((name) => ({ name, stamp: name.match(SNAPSHOT_PATTERN)?.[1] })).filter((item): item is { name: string; stamp: string } => !!item.stamp);
  dated.sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
  const keep = new Set<string>();
  const pick = (length: number, limit: number) => {
    const seen = new Set<string>();
    for (const item of dated) {
      const period = item.stamp.slice(0, length);
      if (seen.has(period)) continue;
      if (seen.size >= limit) break;
      seen.add(period);
      keep.add(item.name);
    }
  };
  pick(8, keepDaily);
  pick(6, keepMonthly);
  return keep;
}

export interface StorageFile {
  /** Cesta v úložišti `photos/<soubor>`, `documents/seed/<soubor>`. */
  rel: string;
  filePath: string;
  size: number;
  mtimeMs: number;
}

/** Všechny soubory úložiště včetně vzorových `seed/` (rekurzivně ve složkách druhů). */
export async function listStorageFiles(root: string): Promise<StorageFile[]> {
  const result: StorageFile[] = [];
  async function walk(dir: string, rel: string) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const filePath = path.join(dir, entry.name);
      const relPath = `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(filePath, relPath);
      else if (entry.isFile()) {
        const info = await stat(filePath);
        result.push({ rel: relPath, filePath, size: info.size, mtimeMs: Math.floor(info.mtimeMs) });
      }
    }
  }
  for (const kind of UPLOAD_KINDS) await walk(path.join(root, kind), kind);
  return result;
}

export interface SnapshotInfo {
  name: string;
  dbBytes: number;
  archiveBytes: number;
  sha256: string;
  encrypted: boolean;
  tables: number;
  counts: { plants: number; equipment: number; users: number; companies: number; files: number };
}

export interface OffsiteSummary {
  uploadedDb: boolean;
  filesUploaded: number;
  filesSkipped: number;
  filesPending: number;
  filesMarkedMissing: number;
  filesDeleted: number;
  dbDeleted: number;
  bytesUploaded: number;
  errors: string[];
}

export interface BackupSummary {
  snapshot: SnapshotInfo;
  local: { dir: string; kept: number; removed: number };
  offsite: OffsiteSummary | null;
  offsiteSkipped: string | null;
  durationMs: number;
}

export interface BackupDeps {
  prisma: PrismaClient;
  config: BackupConfig;
  storageRoot: string;
  /** Klient úložiště mimo server (testy podstrčí vlastní); výchozí podle `config.s3`. */
  s3?: S3Client | null;
  now?: () => Date;
  /** Časový limit nahrávání souborů v jednom běhu (zbytek dožene další běh). */
  fileBudgetMs?: number;
  log?: (message: string) => void;
}

/** Ověří snímek databáze: `PRAGMA integrity_check` = ok, počet tabulek a hlavních záznamů. */
export function inspectSnapshot(filePath: string) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = String(db.pragma("integrity_check", { simple: true }));
    if (integrity !== "ok") throw new Error(`Snímek databáze neprošel kontrolou integrity: ${integrity}`);
    const count = (sql: string) => Number((db.prepare(sql).get() as { c: number } | undefined)?.c ?? 0);
    const has = (table: string) => count(`SELECT count(*) AS c FROM sqlite_master WHERE type = 'table' AND name = '${table}'`) > 0;
    const rows = (table: string) => (has(table) ? count(`SELECT count(*) AS c FROM "${table}"`) : 0);
    return {
      tables: count("SELECT count(*) AS c FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"),
      counts: { plants: rows("Plant"), equipment: rows("Equipment"), users: rows("User"), companies: rows("RegisteredCompany"), files: rows("StoredFile") },
    };
  } finally {
    db.close();
  }
}

/** Snímek databáze za běhu (`VACUUM INTO` – konzistentní kopie i při zápisech, WAL nevadí). */
export async function snapshotDatabase(prisma: PrismaClient, target: string) {
  await rm(target, { force: true });
  await prisma.$executeRawUnsafe("VACUUM INTO ?", target);
}

/** Místní snímky v adresáři záloh (nejnovější první). */
export async function listLocalSnapshots(dir: string): Promise<{ name: string; filePath: string; bytes: number; createdAt: Date }[]> {
  const names = (await readdir(dir).catch(() => [] as string[])).filter((name) => SNAPSHOT_PATTERN.test(name)).sort().reverse();
  return Promise.all(
    names.map(async (name) => {
      const info = await stat(path.join(dir, name));
      return { name, filePath: path.join(dir, name), bytes: info.size, createdAt: info.mtime };
    }),
  );
}

const s3Key = (prefix: string, key: string) => (prefix ? `${prefix}/${key}` : key);

/** Úložiště mimo server: snímek databáze, retence snímků, přírůstkově soubory a odstranění smazaných souborů. */
async function syncOffsite(deps: BackupDeps, s3: S3Client, sealer: Sealer, snapshot: { name: string; archivePath: string; dbBytes: number; archiveBytes: number; sha256: string }, tmpDir: string): Promise<OffsiteSummary> {
  const { prisma, config } = deps;
  const prefix = config.s3?.prefix ?? "";
  const now = deps.now?.() ?? new Date();
  const summary: OffsiteSummary = { uploadedDb: false, filesUploaded: 0, filesSkipped: 0, filesPending: 0, filesMarkedMissing: 0, filesDeleted: 0, dbDeleted: 0, bytesUploaded: 0, errors: [] };

  // 1. Snímek databáze
  const dbKey = s3Key(prefix, `db/${snapshot.name}`);
  await s3.putFile(dbKey, snapshot.archivePath, snapshot.sha256);
  await prisma.backupObject.upsert({
    where: { key: dbKey },
    create: { key: dbKey, kind: "db", source: snapshot.name, sizeBytes: snapshot.dbBytes, storedBytes: snapshot.archiveBytes, sha256: snapshot.sha256, uploadedAt: now },
    update: { storedBytes: snapshot.archiveBytes, sha256: snapshot.sha256, uploadedAt: now },
  });
  summary.uploadedDb = true;
  summary.bytesUploaded += snapshot.archiveBytes;

  // 2. Retence snímků (denní + měsíční)
  const dbObjects = await prisma.backupObject.findMany({ where: { kind: "db" }, select: { key: true, source: true } });
  const keep = snapshotsToKeep(dbObjects.map((object) => object.source), config.keepDaily, config.keepMonthly);
  for (const object of dbObjects) {
    if (keep.has(object.source)) continue;
    try {
      await s3.deleteObject(object.key);
      await prisma.backupObject.delete({ where: { key: object.key } });
      summary.dbDeleted++;
    } catch (error) {
      summary.errors.push(`Starší snímek ${object.source} se nepodařilo smazat: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 3. Soubory úložiště přírůstkově (nezměněné se přeskočí), každý zvlášť šifrovaný
  const files = await listStorageFiles(deps.storageRoot);
  const known = new Map((await prisma.backupObject.findMany({ where: { kind: "file" } })).map((object) => [object.source, object]));
  const deadline = Date.now() + (deps.fileBudgetMs ?? DEFAULT_FILE_BUDGET_MS);
  const tmpFile = path.join(tmpDir, "file.enc");
  for (const file of files) {
    const existing = known.get(file.rel);
    if (existing && existing.sizeBytes === file.size && existing.sourceMtimeMs === file.mtimeMs) {
      if (existing.missingSince) await prisma.backupObject.update({ where: { key: existing.key }, data: { missingSince: null } });
      summary.filesSkipped++;
      continue;
    }
    if (Date.now() > deadline) {
      summary.filesPending++;
      continue;
    }
    const key = s3Key(prefix, `files/${file.rel}.enc`);
    try {
      const packed = await packFile(file.filePath, tmpFile, { sealer });
      await s3.putFile(key, tmpFile, packed.sha256);
      await prisma.backupObject.upsert({
        where: { key },
        create: { key, kind: "file", source: file.rel, sizeBytes: file.size, storedBytes: packed.bytes, sha256: packed.sha256, sourceMtimeMs: file.mtimeMs, uploadedAt: now },
        update: { sizeBytes: file.size, storedBytes: packed.bytes, sha256: packed.sha256, sourceMtimeMs: file.mtimeMs, uploadedAt: now, missingSince: null },
      });
      summary.filesUploaded++;
      summary.bytesUploaded += packed.bytes;
    } catch (error) {
      summary.filesPending++;
      if (summary.errors.length < 10) summary.errors.push(`${file.rel}: ${error instanceof Error ? error.message : error}`);
    }
  }
  await rm(tmpFile, { force: true });

  // 4. Soubory smazané z úložiště: označit, po `deletedRetentionDays` odstranit i ze zálohy
  const present = new Set(files.map((file) => file.rel));
  const cutoff = new Date(now.getTime() - config.deletedRetentionDays * DAY_MS);
  for (const object of known.values()) {
    if (present.has(object.source)) continue;
    if (!object.missingSince) {
      await prisma.backupObject.update({ where: { key: object.key }, data: { missingSince: now } });
      summary.filesMarkedMissing++;
    } else if (object.missingSince < cutoff) {
      try {
        await s3.deleteObject(object.key);
        await prisma.backupObject.delete({ where: { key: object.key } });
        summary.filesDeleted++;
      } catch (error) {
        if (summary.errors.length < 10) summary.errors.push(`Smazaný soubor ${object.source} se ze zálohy nepodařilo odstranit: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return summary;
}

/** Klient úložiště podle nastavení (null = mimo server se nezálohuje). */
export const s3ClientFor = (config: BackupConfig) => (config.s3 && config.secret ? new S3Client(config.s3) : null);

/**
 * Jedna záloha: snímek → kontrola → gzip (+ šifrování) do místní složky → rotace → mimo server. Zapisuje
 * `MaintenanceRun` (RUNNING → OK / WARNING / FAILED). Běžící záloha mladší 3 h = další se nespustí.
 */
export async function runBackup(deps: BackupDeps, trigger: MaintenanceTrigger) {
  const { prisma, config } = deps;
  const now = deps.now?.() ?? new Date();
  const started = Date.now();
  await prisma.maintenanceRun.updateMany({ where: { kind: "BACKUP", status: "RUNNING", startedAt: { lt: new Date(now.getTime() - RUNNING_STALE_MS) } }, data: { status: "FAILED", finishedAt: now, error: "Záloha byla přerušena (restart aplikace nebo výpadek)." } });
  if (await prisma.maintenanceRun.count({ where: { kind: "BACKUP", status: "RUNNING" } })) throw new Error("Záloha už běží – počkejte na její dokončení.");
  const run = await prisma.maintenanceRun.create({ data: { kind: "BACKUP", trigger, startedAt: now } });

  const tmpDir = path.join(config.dir, ".tmp");
  try {
    await mkdir(tmpDir, { recursive: true });
    // 1. Snímek databáze a kontrola integrity
    const rawPath = path.join(tmpDir, "eldock.db");
    await snapshotDatabase(prisma, rawPath);
    const inspected = inspectSnapshot(rawPath);
    const dbBytes = (await stat(rawPath)).size;

    // 2. Místní archiv (gzip + šifrování s heslem záloh)
    const sealer = config.secret ? await createSealer(config.secret) : null;
    const name = snapshotName(now, !!sealer);
    const archivePath = path.join(config.dir, name);
    const packed = await packFile(rawPath, archivePath, { sealer, gzip: true });
    await rm(rawPath, { force: true });
    const snapshot: SnapshotInfo = { name, dbBytes, archiveBytes: packed.bytes, sha256: packed.sha256, encrypted: !!sealer, ...inspected };

    // 3. Rotace místních snímků
    const local = await listLocalSnapshots(config.dir);
    let removed = 0;
    for (const old of local.slice(config.keepLocal)) {
      await unlink(old.filePath).catch(() => undefined);
      removed++;
    }

    // 4. Mimo server (jen šifrovaně)
    const s3 = deps.s3 === undefined ? s3ClientFor(config) : deps.s3;
    let offsite: OffsiteSummary | null = null;
    let offsiteSkipped: string | null = null;
    // Fáze 113: bez úložiště mimo server je místní záloha plnohodnotná – klidná informace, ne chyba
    if (!config.s3 && !deps.s3) offsiteSkipped = LOCAL_BACKUP_INFO;
    else if (!sealer) offsiteSkipped = "Mimo server se zálohy posílají jen šifrované – chybí ELDOCK_BACKUP_KEY (nebo heslo šifrování záloh ve velínu).";
    else if (s3) offsite = await syncOffsite(deps, s3, sealer, { name, archivePath, dbBytes, archiveBytes: packed.bytes, sha256: packed.sha256 }, tmpDir);

    const summary: BackupSummary = { snapshot, local: { dir: config.dir, kept: Math.min(local.length, config.keepLocal), removed }, offsite, offsiteSkipped, durationMs: Date.now() - started };
    const warning = !!offsite && (offsite.errors.length > 0 || offsite.filesPending > 0);
    return prisma.maintenanceRun.update({ where: { id: run.id }, data: { status: warning ? "WARNING" : "OK", finishedAt: deps.now?.() ?? new Date(), summaryJson: JSON.stringify(summary) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log?.(`[eldock] Záloha selhala: ${message}`);
    return prisma.maintenanceRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: deps.now?.() ?? new Date(), error: message.slice(0, 2000) } });
  } finally {
    await rm(path.join(tmpDir, "eldock.db"), { force: true }).catch(() => undefined);
  }
}

export const parseBackupSummary = (json: string | null): BackupSummary | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as BackupSummary;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
//  Obnova (npm run backup:restore) – jen do prázdné složky, nikdy přes živá data
// ---------------------------------------------------------------------------

export interface RestoreOptions {
  config: BackupConfig;
  /** Odkud: místní složka záloh, nebo úložiště mimo server. */
  from: "local" | "s3";
  /** Název snímku, nebo `latest`. */
  snapshot: string;
  /** Prázdná cílová složka – vznikne `<cíl>/eldock.db` (a s `withFiles` i `<cíl>/uploads/…`). */
  targetDir: string;
  withFiles?: boolean;
  /** Živá data, do kterých se obnovovat nesmí (databáze a úložiště běžící aplikace). */
  liveDirs: string[];
  s3?: S3Client | null;
  log?: (message: string) => void;
}

const inside = (child: string, parent: string) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/** Obnoví snímek databáze (a soubory) do prázdné složky, ověří integritu a vrátí souhrn. */
export async function restoreBackup(options: RestoreOptions) {
  const target = path.resolve(options.targetDir);
  if (options.liveDirs.some((dir) => inside(target, dir) || inside(dir, target))) throw new Error("Obnova do složky s živými daty aplikace je zakázaná – zvolte novou prázdnou složku.");
  const existing = await readdir(target).catch(() => null);
  if (existing && existing.length) throw new Error(`Cílová složka ${target} není prázdná.`);
  await mkdir(target, { recursive: true });

  const s3 = options.from === "s3" ? (options.s3 === undefined ? s3ClientFor(options.config) : options.s3) : null;
  if (options.from === "s3" && !s3) throw new Error("Úložiště mimo server není nastavené (ELDOCK_BACKUP_S3_* a ELDOCK_BACKUP_KEY).");
  const prefix = options.config.s3?.prefix ?? "";

  // 1. Snímek databáze
  let archivePath: string;
  let name: string;
  const tmpDir = path.join(target, ".restore-tmp");
  await mkdir(tmpDir, { recursive: true });
  if (options.from === "local") {
    const snapshots = await listLocalSnapshots(options.config.dir);
    const found = options.snapshot === "latest" ? snapshots[0] : snapshots.find((item) => item.name === options.snapshot);
    if (!found) throw new Error(`Snímek ${options.snapshot} v ${options.config.dir} není.`);
    archivePath = found.filePath;
    name = found.name;
  } else {
    const objects = (await s3!.list(s3Key(prefix, "db/"))).map((object) => ({ ...object, name: object.key.split("/").pop() ?? "" })).filter((object) => SNAPSHOT_PATTERN.test(object.name));
    objects.sort((a, b) => (a.name < b.name ? 1 : -1));
    const found = options.snapshot === "latest" ? objects[0] : objects.find((object) => object.name === options.snapshot);
    if (!found) throw new Error(`Snímek ${options.snapshot} v úložišti mimo server není.`);
    name = found.name;
    archivePath = path.join(tmpDir, name);
    options.log?.(`Stahuji ${found.key}…`);
    await s3!.getFile(found.key, archivePath);
  }
  const dbPath = path.join(target, "eldock.db");
  await unpackFile(archivePath, dbPath, { secret: options.config.secret, gunzip: true });
  const inspected = inspectSnapshot(dbPath);

  // 2. Soubory úložiště (jen z úložiště mimo server – místní soubory jsou živé úložiště)
  let files = 0;
  if (options.withFiles) {
    if (!s3) throw new Error("Soubory se obnovují z úložiště mimo server (--from s3).");
    const objects = (await s3.list(s3Key(prefix, "files/"))).filter((object) => object.key.endsWith(".enc"));
    for (const object of objects) {
      const rel = object.key.slice(s3Key(prefix, "files/").length, -".enc".length);
      if (!rel || rel.split("/").some((segment) => !segment || segment === "." || segment === "..")) continue;
      const out = path.join(target, "uploads", ...rel.split("/"));
      await mkdir(path.dirname(out), { recursive: true });
      const encrypted = path.join(tmpDir, "file.enc");
      await s3.getFile(object.key, encrypted);
      await unpackFile(encrypted, out, { secret: options.config.secret });
      files++;
    }
  }
  await rm(tmpDir, { recursive: true, force: true });
  return { snapshot: name, dbPath, files, ...inspected };
}
