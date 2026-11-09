// Fáze 71: místní databáze aplikace (IndexedDB přes Dexie) – stažená data závodu, fronta úprav, soubory pro
// offline a otisky souborů. Data zůstanou i po vypnutí počítače; odpojení zařízení je smaže.

import Dexie, { type Table } from "dexie";

import type { FileInfo, LocalFile, OutboxItem, StoredRecord } from "@/sync-client";

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface FileIndexRow extends FileInfo {
  url: string;
}

export class EldockDatabase extends Dexie {
  records!: Table<StoredRecord, [string, string]>;
  meta!: Table<MetaRow, string>;
  outbox!: Table<OutboxItem, string>;
  files!: Table<LocalFile, string>;
  fileIndex!: Table<FileIndexRow, string>;

  constructor(name = "eldock") {
    super(name);
    this.version(1).stores({
      records: "[entity+id], entity, [entity+parentId]",
      meta: "key",
      outbox: "id, createdAt, status, equipmentId",
      files: "key",
      fileIndex: "url",
    });
  }
}

export const db = new EldockDatabase();
