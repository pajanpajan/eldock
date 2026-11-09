// Fáze 72: úložiště serveru závodu. Pro spojení s cloudem je to `SyncStore` jádra synchronizace (vrstva z cloudu,
// fronta přeposílaných úprav, soubory); pro zařízení v hale skládá platná data = předběžná vrstva úprav z haly, jinak
// vrstva z cloudu, a každou změnu platných dat zapíše do místního žurnálu (vlastní pořadí, značky smazání).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parentIdOf, sha256Hex, type EntityName, type FileInfo, type LocalFile, type OutboxItem, type StoredRecord, type SyncMeta, type SyncStore } from "@/sync-client";

import { inTransaction, json, type PlantDb } from "./db";

/** Fotky nahrané zařízeními v hale – server závodu je obslouží sám (do cloudu odejdou s úpravou). */
export const PLANT_UPLOAD_PREFIX = "/api/files/photos/plant-";

/** Další klíče metadat serveru závodu (vedle `SyncMeta` jádra). */
export interface PlantMeta {
  /** Epocha místního žurnálu – nová = zařízení v hale stáhnou vše znovu. */
  epoch: string;
  adminPasswordHash: string;
  /** Po resetu z cloudu: záznamy, které cloud znovu nepošle, dostanou značku smazání. */
  resetPending: boolean;
  serverName: string;
}

type Row = Record<string, unknown>;

export interface JournalRow {
  entity: string;
  id: string;
  seq: number;
  deleted: boolean;
}

export class PlantStore implements SyncStore {
  constructor(private readonly plant: PlantDb) {}

  private get db() {
    return this.plant.db;
  }

  // ---------------------------------------------------------------------------
  //  Metadata
  // ---------------------------------------------------------------------------

  async getMeta<K extends keyof SyncMeta>(key: K): Promise<SyncMeta[K] | undefined> {
    return this.meta(key) as SyncMeta[K] | undefined;
  }

  async setMeta(values: Partial<SyncMeta>) {
    this.writeMeta(values as Record<string, unknown>);
  }

  meta<K extends string>(key: K): unknown {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as Row | undefined;
    return row ? json(row.value) : undefined;
  }

  plantMeta<K extends keyof PlantMeta>(key: K): PlantMeta[K] | undefined {
    return this.meta(key) as PlantMeta[K] | undefined;
  }

  writeMeta(values: Record<string, unknown>) {
    const upsert = this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value");
    const remove = this.db.prepare("DELETE FROM meta WHERE key = ?");
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) remove.run(key);
      else upsert.run(key, JSON.stringify(value));
    }
  }

  // ---------------------------------------------------------------------------
  //  Vrstva z cloudu (jádro synchronizace) a místní žurnál
  // ---------------------------------------------------------------------------

  private toRecord(row: Row): StoredRecord {
    return { entity: row.entity as EntityName, id: String(row.id), seq: Number(row.seq), parentId: String(row.parentId), data: json(row.data) };
  }

  async getRecord(entity: EntityName, id: string) {
    const row = this.db.prepare("SELECT * FROM cloud WHERE entity = ? AND id = ?").get(entity, id) as Row | undefined;
    return row ? this.toRecord(row) : undefined;
  }

  async childrenOf(entity: EntityName, parentId: string) {
    return (this.db.prepare("SELECT * FROM cloud WHERE entity = ? AND parentId = ?").all(entity, parentId) as Row[]).map((row) => this.toRecord(row));
  }

  async writeRecords(upserts: StoredRecord[], deletes: Array<[EntityName, string]>) {
    const remove = this.db.prepare("DELETE FROM cloud WHERE entity = ? AND id = ?");
    const upsert = this.db.prepare("INSERT INTO cloud (entity, id, parentId, seq, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (entity, id) DO UPDATE SET parentId = excluded.parentId, seq = excluded.seq, data = excluded.data");
    inTransaction(this.db, () => {
      for (const [entity, id] of deletes) {
        remove.run(entity, id);
        this.touch(entity, id);
      }
      for (const record of upserts) {
        upsert.run(record.entity, record.id, record.parentId, record.seq, JSON.stringify(record.data));
        this.touch(record.entity, record.id);
      }
    });
  }

  /** Reset z cloudu: vrstva z cloudu se stáhne znovu; žurnál zůstane, chybějící záznamy dostanou značku po stažení. */
  async clearRecords() {
    this.db.exec("DELETE FROM cloud");
    this.writeMeta({ resetPending: true });
  }

  async countRecords() {
    return Number((this.db.prepare("SELECT COUNT(*) AS n FROM cloud").get() as Row).n);
  }

  /** Po úplném stažení po resetu: záznamy, které už nejsou v cloudu ani v předběžné vrstvě, smazat i pro zařízení. */
  finishReset() {
    if (!this.plantMeta("resetPending")) return 0;
    const stale = this.db
      .prepare("SELECT j.entity, j.id FROM journal j WHERE j.deleted = 0 AND NOT EXISTS (SELECT 1 FROM cloud c WHERE c.entity = j.entity AND c.id = j.id) AND NOT EXISTS (SELECT 1 FROM overlay o WHERE o.entity = j.entity AND o.id = j.id AND o.data IS NOT NULL)")
      .all() as Row[];
    inTransaction(this.db, () => {
      for (const row of stale) this.touch(String(row.entity), String(row.id));
      this.writeMeta({ resetPending: undefined });
    });
    return stale.length;
  }

  private nextSeq(): number {
    return Number((this.db.prepare("UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value").get() as Row).value);
  }

  head(): number {
    return Number((this.db.prepare("SELECT value FROM counter WHERE id = 1").get() as Row).value);
  }

  /** Platná data záznamu: předběžná vrstva (null = předběžně smazáno), jinak cloud; `null` = záznam není. */
  effective(entity: string, id: string): Row | null {
    const overlay = this.db.prepare("SELECT data FROM overlay WHERE entity = ? AND id = ?").get(entity, id) as Row | undefined;
    if (overlay) return overlay.data === null ? null : json<Row>(overlay.data);
    const cloud = this.db.prepare("SELECT data FROM cloud WHERE entity = ? AND id = ?").get(entity, id) as Row | undefined;
    return cloud ? json<Row>(cloud.data) : null;
  }

  /** Platné záznamy entity s daným rodičem (cloud + předběžné). */
  effectiveChildren(entity: string, parentId: string): Row[] {
    const ids = new Set<string>();
    for (const row of this.db.prepare("SELECT id FROM cloud WHERE entity = ? AND parentId = ?").all(entity, parentId) as Row[]) ids.add(String(row.id));
    for (const row of this.db.prepare("SELECT id FROM overlay WHERE entity = ? AND parentId = ?").all(entity, parentId) as Row[]) ids.add(String(row.id));
    return [...ids].map((id) => this.effective(entity, id)).filter((row): row is Row => row !== null);
  }

  /** Zapíše změnu platných dat do místního žurnálu (nové pořadí). */
  touch(entity: string, id: string) {
    const deleted = this.effective(entity, id) === null ? 1 : 0;
    const known = this.db.prepare("SELECT deleted FROM journal WHERE entity = ? AND id = ?").get(entity, id) as Row | undefined;
    // Smazání záznamu, který zařízení nikdy nedostala, žurnál nepotřebuje
    if (!known && deleted) return;
    this.db.prepare("INSERT INTO journal (entity, id, seq, deleted) VALUES (?, ?, ?, ?) ON CONFLICT (entity, id) DO UPDATE SET seq = excluded.seq, deleted = excluded.deleted").run(entity, id, this.nextSeq(), deleted);
  }

  journalAfter(cursor: number, limit: number): JournalRow[] {
    return (this.db.prepare("SELECT entity, id, seq, deleted FROM journal WHERE seq > ? ORDER BY seq LIMIT ?").all(cursor, limit) as Row[]).map((row) => ({ entity: String(row.entity), id: String(row.id), seq: Number(row.seq), deleted: Boolean(row.deleted) }));
  }

  // ---------------------------------------------------------------------------
  //  Předběžná vrstva (úpravy z haly do rozhodnutí cloudu)
  // ---------------------------------------------------------------------------

  /** Převezme úpravu z haly: předběžná data + položka fronty přeposílání v jedné transakci. */
  acceptRelay(item: OutboxItem, effects: Array<{ entity: EntityName; id: string; data: Row | null }>) {
    const upsert = this.db.prepare("INSERT INTO overlay (entity, id, relayId, parentId, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (entity, id) DO UPDATE SET relayId = excluded.relayId, parentId = excluded.parentId, data = excluded.data");
    inTransaction(this.db, () => {
      this.insertOutbox(item);
      for (const effect of effects) {
        upsert.run(effect.entity, effect.id, item.id, effect.data ? (parentIdOf(effect.entity, effect.data) ?? "") : "", effect.data ? JSON.stringify(effect.data) : null);
        this.touch(effect.entity, effect.id);
      }
    });
  }

  /** Cloud rozhodl (provedeno a data stažená, nebo odmítnuto): předběžná data úpravy pryč, platí cloud. */
  dropOverlay(relayId: string): number {
    const rows = this.db.prepare("SELECT entity, id FROM overlay WHERE relayId = ?").all(relayId) as Row[];
    if (!rows.length) return 0;
    inTransaction(this.db, () => {
      this.db.prepare("DELETE FROM overlay WHERE relayId = ?").run(relayId);
      for (const row of rows) this.touch(String(row.entity), String(row.id));
    });
    return rows.length;
  }

  overlayRelayIds(): string[] {
    return (this.db.prepare("SELECT DISTINCT relayId FROM overlay").all() as Row[]).map((row) => String(row.relayId));
  }

  // ---------------------------------------------------------------------------
  //  Fronta přeposílání
  // ---------------------------------------------------------------------------

  private insertOutbox(item: OutboxItem) {
    this.db.prepare("INSERT INTO outbox (id, userId, createdAt, status, data) VALUES (?, ?, ?, ?, ?)").run(item.id, item.userId, item.createdAt, item.status, JSON.stringify(item));
  }

  async addOutbox(item: OutboxItem) {
    this.insertOutbox(item);
  }

  async listOutbox() {
    return (this.db.prepare("SELECT data FROM outbox ORDER BY createdAt, id").all() as Row[]).map((row) => json<OutboxItem>(row.data));
  }

  outboxItem(id: string): OutboxItem | undefined {
    const row = this.db.prepare("SELECT data FROM outbox WHERE id = ?").get(id) as Row | undefined;
    return row ? json<OutboxItem>(row.data) : undefined;
  }

  async updateOutbox(id: string, patch: Partial<OutboxItem>) {
    const item = this.outboxItem(id);
    if (!item) return;
    const next = { ...item, ...patch } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    this.db.prepare("UPDATE outbox SET status = ?, data = ? WHERE id = ?").run(String(next.status), JSON.stringify(next), id);
  }

  async removeOutbox(id: string) {
    this.db.prepare("DELETE FROM outbox WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  //  Soubory (obsah na disku podle SHA-256)
  // ---------------------------------------------------------------------------

  private toFile(row: Row): LocalFile | undefined {
    const file = String(row.path);
    if (!existsSync(file)) return undefined;
    return {
      key: String(row.key),
      sha256: row.sha256 ? String(row.sha256) : null,
      size: Number(row.size),
      mime: String(row.mime),
      ...(row.name ? { name: String(row.name) } : {}),
      ...(row.kind ? { kind: String(row.kind) } : {}),
      ...(row.etag ? { etag: String(row.etag) } : {}),
      ...(row.uploadedUrl ? { uploadedUrl: String(row.uploadedUrl) } : {}),
      data: new Blob([readFileSync(file)], { type: String(row.mime) }),
      storedAt: String(row.storedAt),
    };
  }

  async getFile(key: string) {
    const row = this.db.prepare("SELECT * FROM files WHERE key = ?").get(key) as Row | undefined;
    return row ? this.toFile(row) : undefined;
  }

  /** Obsah souboru z disku bez načtení do Blob (stažení zařízením). */
  fileContent(key: string): { data: Buffer; sha256: string | null; mime: string; size: number } | null {
    const row = this.db.prepare("SELECT * FROM files WHERE key = ?").get(key) as Row | undefined;
    if (!row || !existsSync(String(row.path))) return null;
    return { data: readFileSync(String(row.path)), sha256: row.sha256 ? String(row.sha256) : null, mime: String(row.mime), size: Number(row.size) };
  }

  async putFile(file: LocalFile) {
    const buffer = Buffer.from(await file.data.arrayBuffer());
    const sha256 = file.sha256 ?? (await sha256Hex(buffer));
    const target = path.join(this.plant.filesDir, sha256);
    mkdirSync(this.plant.filesDir, { recursive: true });
    if (!existsSync(target)) writeFileSync(target, buffer);
    this.db
      .prepare("INSERT INTO files (key, sha256, size, mime, name, kind, path, etag, uploadedUrl, storedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET sha256 = excluded.sha256, size = excluded.size, mime = excluded.mime, name = excluded.name, kind = excluded.kind, path = excluded.path, etag = excluded.etag, uploadedUrl = excluded.uploadedUrl, storedAt = excluded.storedAt")
      .run(file.key, sha256, buffer.byteLength, file.mime, file.name ?? null, file.kind ?? null, target, file.etag ?? null, file.uploadedUrl ?? null, file.storedAt);
  }

  async removeFile(key: string) {
    const row = this.db.prepare("SELECT path FROM files WHERE key = ?").get(key) as Row | undefined;
    this.db.prepare("DELETE FROM files WHERE key = ?").run(key);
    if (row && !(this.db.prepare("SELECT 1 FROM files WHERE path = ?").get(String(row.path)) as Row | undefined)) rmSync(String(row.path), { force: true });
  }

  /** Soubory pro úklid jádra – bez fotek nahraných v hale (na ty odkazují předběžná data). */
  async listFiles() {
    return (this.db.prepare("SELECT * FROM files WHERE key NOT LIKE ?").all(`${PLANT_UPLOAD_PREFIX}%`) as Row[]).map((row) => ({
      key: String(row.key),
      sha256: row.sha256 ? String(row.sha256) : null,
      size: Number(row.size),
      mime: String(row.mime),
      ...(row.uploadedUrl ? { uploadedUrl: String(row.uploadedUrl) } : {}),
      storedAt: String(row.storedAt),
    }));
  }

  async getFileIndex() {
    const rows = this.db.prepare("SELECT * FROM file_index").all() as Row[];
    return Object.fromEntries(rows.map((row) => [String(row.url), { sha256: row.sha256 ? String(row.sha256) : null, size: Number(row.size), mime: String(row.mime) }])) as Record<string, FileInfo>;
  }

  /** Otisk souboru pro zařízení: kopie z cloudu (registr) nebo fotka nahraná v hale. */
  fileInfo(url: string): FileInfo | null {
    const indexed = this.db.prepare("SELECT * FROM file_index WHERE url = ?").get(url) as Row | undefined;
    if (indexed) return { sha256: indexed.sha256 ? String(indexed.sha256) : null, size: Number(indexed.size), mime: String(indexed.mime) };
    const stored = this.db.prepare("SELECT * FROM files WHERE key = ?").get(url) as Row | undefined;
    return stored ? { sha256: stored.sha256 ? String(stored.sha256) : null, size: Number(stored.size), mime: String(stored.mime) } : null;
  }

  async mergeFileIndex(files: Record<string, FileInfo>) {
    const upsert = this.db.prepare("INSERT INTO file_index (url, sha256, size, mime) VALUES (?, ?, ?, ?) ON CONFLICT (url) DO UPDATE SET sha256 = excluded.sha256, size = excluded.size, mime = excluded.mime");
    for (const [url, info] of Object.entries(files)) upsert.run(url, info.sha256, info.size, info.mime);
  }

  async clearFileIndex() {
    this.db.exec("DELETE FROM file_index");
  }

  /** Odpojení od cloudu: data závodu, fronta, soubory, zařízení v hale pryč; heslo správy zůstane, nová epocha. */
  async clearAll() {
    const keep = this.plantMeta("adminPasswordHash");
    this.db.exec("DELETE FROM cloud; DELETE FROM overlay; DELETE FROM journal; UPDATE counter SET value = 0; DELETE FROM outbox; DELETE FROM files; DELETE FROM file_index; DELETE FROM devices; DELETE FROM pairings; DELETE FROM meta;");
    rmSync(this.plant.filesDir, { recursive: true, force: true });
    this.writeMeta({ ...(keep ? { adminPasswordHash: keep } : {}), epoch: globalThis.crypto.randomUUID().slice(0, 8) });
  }
}
