// Fáze 72: databáze serveru závodu – SQLite přes vestavěné `node:sqlite` (Node 22.13+, Electron 45 = Node 24):
// žádné nativní moduly, běží v `Eldock.exe --plant-server` i v Node. API je synchronní – jedna operace úložiště
// proběhne celá bez přerušení (server závodu běží v jednom vlákně).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Vrstva z cloudu (poslední stav podle žurnálu eldock.cz)
CREATE TABLE IF NOT EXISTS cloud (entity TEXT NOT NULL, id TEXT NOT NULL, parentId TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (entity, id));
CREATE INDEX IF NOT EXISTS cloud_parent ON cloud (entity, parentId);
-- Předběžná vrstva: úpravy z haly, o kterých cloud ještě nerozhodl (data NULL = předběžně smazáno)
CREATE TABLE IF NOT EXISTS overlay (entity TEXT NOT NULL, id TEXT NOT NULL, relayId TEXT NOT NULL, parentId TEXT NOT NULL, data TEXT, PRIMARY KEY (entity, id));
CREATE INDEX IF NOT EXISTS overlay_relay ON overlay (relayId);
CREATE INDEX IF NOT EXISTS overlay_parent ON overlay (entity, parentId);
-- Místní žurnál pro zařízení v hale (vlastní pořadí, značky smazání)
CREATE TABLE IF NOT EXISTS journal (entity TEXT NOT NULL, id TEXT NOT NULL, seq INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (entity, id));
CREATE INDEX IF NOT EXISTS journal_seq ON journal (seq);
CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL);
INSERT OR IGNORE INTO counter (id, value) VALUES (1, 0);
-- Přeposílané úpravy z haly (fronta jádra synchronizace v režimu přeposílání)
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, userId TEXT NOT NULL, createdAt TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS outbox_created ON outbox (createdAt);
-- Soubory: kopie z cloudu, fotky nahrané v hale; obsah na disku podle SHA-256
CREATE TABLE IF NOT EXISTS files (key TEXT PRIMARY KEY, sha256 TEXT, size INTEGER NOT NULL, mime TEXT NOT NULL, name TEXT, kind TEXT, path TEXT NOT NULL, etag TEXT, uploadedUrl TEXT, storedAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS files_sha ON files (sha256);
CREATE TABLE IF NOT EXISTS file_index (url TEXT PRIMARY KEY, sha256 TEXT, size INTEGER NOT NULL, mime TEXT NOT NULL);
-- Zařízení v hale spárovaná se serverem závodu a jejich kódy párování
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, userId TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL, appVersion TEXT, tokenHash TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, lastSeenAt TEXT NOT NULL, lastPullAt TEXT, lastPushAt TEXT, revokedAt TEXT, revokedReason TEXT);
CREATE TABLE IF NOT EXISTS pairings (id TEXT PRIMARY KEY, userId TEXT NOT NULL, codeHash TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL, usedAt TEXT);
-- Přihlášení do správy serveru
CREATE TABLE IF NOT EXISTS admin_sessions (tokenHash TEXT PRIMARY KEY, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL);
`;

export interface PlantDb {
  db: DatabaseSync;
  /** Složka obsahu souborů (`<data>/files`). */
  filesDir: string;
  close(): void;
}

export function openPlantDb(dataDir: string): PlantDb {
  mkdirSync(dataDir, { recursive: true });
  const filesDir = path.join(dataDir, "files");
  mkdirSync(filesDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "server-zavodu.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return { db, filesDir, close: () => db.close() };
}

/** Synchronní transakce (výjimka = ROLLBACK). */
export function inTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const json = <T>(value: unknown): T => JSON.parse(String(value)) as T;
