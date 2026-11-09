// Fáze 71: úložiště jádra synchronizace nad IndexedDB (rozhraní `SyncStore` ze src/sync-client/store.ts).

import type { EntityName, FileInfo, LocalFile, OutboxItem, StoredRecord, SyncMeta, SyncStore } from "@/sync-client";

import type { EldockDatabase } from "./db";

export class IdbStore implements SyncStore {
  constructor(private readonly db: EldockDatabase) {}

  async getMeta<K extends keyof SyncMeta>(key: K): Promise<SyncMeta[K] | undefined> {
    return (await this.db.meta.get(key))?.value as SyncMeta[K] | undefined;
  }

  async setMeta(values: Partial<SyncMeta>) {
    await this.db.meta.bulkPut(Object.entries(values).map(([key, value]) => ({ key, value })));
  }

  getRecord(entity: EntityName, id: string) {
    return this.db.records.get([entity, id]);
  }

  childrenOf(entity: EntityName, parentId: string) {
    return this.db.records.where("[entity+parentId]").equals([entity, parentId]).toArray();
  }

  async writeRecords(upserts: StoredRecord[], deletes: Array<[EntityName, string]>) {
    await this.db.transaction("rw", this.db.records, async () => {
      if (deletes.length) await this.db.records.bulkDelete(deletes);
      if (upserts.length) await this.db.records.bulkPut(upserts);
    });
  }

  async clearRecords() {
    await this.db.records.clear();
  }

  countRecords() {
    return this.db.records.count();
  }

  async addOutbox(item: OutboxItem) {
    await this.db.outbox.put(item);
  }

  listOutbox() {
    return this.db.outbox.orderBy("createdAt").toArray();
  }

  async updateOutbox(id: string, patch: Partial<OutboxItem>) {
    await this.db.outbox.update(id, patch);
  }

  async removeOutbox(id: string) {
    await this.db.outbox.delete(id);
  }

  getFile(key: string) {
    return this.db.files.get(key);
  }

  async putFile(file: LocalFile) {
    await this.db.files.put(file);
  }

  async removeFile(key: string) {
    await this.db.files.delete(key);
  }

  async listFiles() {
    const files = await this.db.files.toArray();
    return files.map((file) => {
      const { data, ...rest } = file;
      void data;
      return rest;
    });
  }

  async getFileIndex() {
    const rows = await this.db.fileIndex.toArray();
    return Object.fromEntries(rows.map(({ url, ...info }) => [url, info])) as Record<string, FileInfo>;
  }

  async mergeFileIndex(files: Record<string, FileInfo>) {
    const rows = Object.entries(files).map(([url, info]) => ({ url, ...info }));
    if (rows.length) await this.db.fileIndex.bulkPut(rows);
  }

  async clearFileIndex() {
    await this.db.fileIndex.clear();
  }

  async clearAll() {
    await this.db.transaction("rw", [this.db.records, this.db.meta, this.db.outbox, this.db.files, this.db.fileIndex], async () => {
      await Promise.all([this.db.records.clear(), this.db.meta.clear(), this.db.outbox.clear(), this.db.files.clear(), this.db.fileIndex.clear()]);
    });
  }
}
