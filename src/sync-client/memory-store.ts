// Fáze 71: úložiště jádra synchronizace v paměti – testy a referenční chování pro trvalá úložiště
// (IndexedDB v aplikaci pro Windows, SQLite později).

import type { EntityName } from "./entities";
import type { FileInfo } from "./protocol";
import type { LocalFile, OutboxItem, StoredRecord, SyncMeta, SyncStore } from "./store";

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryStore implements SyncStore {
  readonly records = new Map<string, StoredRecord>();
  readonly outbox = new Map<string, OutboxItem>();
  readonly files = new Map<string, LocalFile>();
  private meta: Partial<SyncMeta> = {};
  private fileIndex: Record<string, FileInfo> = {};

  async getMeta<K extends keyof SyncMeta>(key: K) {
    const value = this.meta[key];
    return value === undefined ? undefined : clone(value);
  }

  async setMeta(values: Partial<SyncMeta>) {
    this.meta = { ...this.meta, ...clone(values) };
  }

  async getRecord(entity: EntityName, id: string) {
    const record = this.records.get(`${entity}:${id}`);
    return record ? clone(record) : undefined;
  }

  async childrenOf(entity: EntityName, parentId: string) {
    return [...this.records.values()].filter((record) => record.entity === entity && record.parentId === parentId).map(clone);
  }

  async writeRecords(upserts: StoredRecord[], deletes: Array<[EntityName, string]>) {
    for (const [entity, id] of deletes) this.records.delete(`${entity}:${id}`);
    for (const record of upserts) this.records.set(`${record.entity}:${record.id}`, clone(record));
  }

  async clearRecords() {
    this.records.clear();
  }

  async countRecords() {
    return this.records.size;
  }

  /** Záznamy entity (pomocník testů a ukázek). */
  list(entity: EntityName) {
    return [...this.records.values()].filter((record) => record.entity === entity).map((record) => clone(record.data));
  }

  async addOutbox(item: OutboxItem) {
    this.outbox.set(item.id, clone(item));
  }

  async listOutbox() {
    return [...this.outbox.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(clone);
  }

  async updateOutbox(id: string, patch: Partial<OutboxItem>) {
    const item = this.outbox.get(id);
    if (item) this.outbox.set(id, { ...item, ...clone(patch) });
  }

  async removeOutbox(id: string) {
    this.outbox.delete(id);
  }

  async getFile(key: string) {
    const file = this.files.get(key);
    return file ? { ...file } : undefined;
  }

  async putFile(file: LocalFile) {
    this.files.set(file.key, { ...file });
  }

  async removeFile(key: string) {
    this.files.delete(key);
  }

  async listFiles() {
    return [...this.files.values()].map((file) => {
      const { data, ...rest } = file;
      void data;
      return rest;
    });
  }

  async getFileIndex() {
    return clone(this.fileIndex);
  }

  async mergeFileIndex(files: Record<string, FileInfo>) {
    this.fileIndex = { ...this.fileIndex, ...clone(files) };
  }

  async clearFileIndex() {
    this.fileIndex = {};
  }

  async clearAll() {
    this.records.clear();
    this.outbox.clear();
    this.files.clear();
    this.meta = {};
    this.fileIndex = {};
  }
}
