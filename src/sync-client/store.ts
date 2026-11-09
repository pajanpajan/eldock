// Fáze 71: rozhraní místního úložiště aplikace (IndexedDB v aplikaci pro Windows, paměť v testech, později SQLite
// v mobilní aplikaci a na serveru závodu) a zápis stránky změn s kaskádou smazání podle rodičů.

import type { SyncMutationType } from "@/lib/sync";

import { ENTITY_CHILDREN, isEntityName, parentIdOf, type EntityName } from "./entities";
import type { ChangeEntry, FileInfo, SyncSession } from "./protocol";

export interface StoredRecord {
  entity: EntityName;
  id: string;
  seq: number;
  /** Id rodiče (index pro kaskádu a výpis potomků), `""` u kořenů. */
  parentId: string;
  data: Record<string, unknown>;
}

/** `accepted` = úpravu převzal server závodu a čeká na cloud (fáze 72) – aplikace ji posílá znovu kvůli výsledku. */
export type OutboxStatus = "pending" | "accepted" | "applied" | "rejected";

/** Úprava ve frontě (offline). `payload` může do odeslání nést místní odkazy `local:<sha256>` na fotky. */
export interface OutboxItem {
  /** Id úpravy (unikátní pro uživatele, přesně jednou na serveru). */
  id: string;
  type: SyncMutationType;
  payload: Record<string, unknown>;
  performedAt: string;
  baseUpdatedAt: string | null;
  /** Vlastník fronty – úpravy jiného uživatele se neodešlou. */
  userId: string;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  /** Popis pro uživatele („Zadání změny – RM1“). */
  label: string;
  equipmentId: string | null;
  code?: string;
  message?: string;
  entity?: string;
  entityId?: string;
  result?: Record<string, unknown>;
  lastAttemptAt?: string;
  resolvedAt?: string;
}

export interface LocalFile {
  /** Adresa na serveru (`/api/files/…`) nebo místní odkaz `local:<sha256>` (čeká na nahrání). */
  key: string;
  sha256: string | null;
  size: number;
  mime: string;
  name?: string;
  /** Druh nahrání (`photo` …) u místních souborů. */
  kind?: string;
  data: Blob;
  etag?: string | null;
  /** Místní soubor po nahrání → adresa na serveru (opakované odeslání ho znovu nenahrává). */
  uploadedUrl?: string;
  storedAt: string;
}

export interface SyncMeta {
  serverUrl: string;
  serverName: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  session: SyncSession;
  cursor: number;
  scope: string;
  lastSyncAt: string;
  lastPullAt: string;
  lastPushAt: string;
  lastAttemptAt: string;
  lastError: string | null;
  /** Poslední pokus skončil bez spojení se serverem. */
  offline: boolean;
  /** Proč zařízení přestalo být spárované (401). */
  unpairedReason: string | null;
}

export interface SyncStore {
  getMeta<K extends keyof SyncMeta>(key: K): Promise<SyncMeta[K] | undefined>;
  setMeta(values: Partial<SyncMeta>): Promise<void>;

  getRecord(entity: EntityName, id: string): Promise<StoredRecord | undefined>;
  /** Záznamy entity s daným rodičem (index `[entity+parentId]`). */
  childrenOf(entity: EntityName, parentId: string): Promise<StoredRecord[]>;
  /** Jedna transakce: smazat klíče, pak zapsat záznamy. */
  writeRecords(upserts: StoredRecord[], deletes: Array<[EntityName, string]>): Promise<void>;
  /** Smaže všechna data závodu (reset) – fronta a soubory zůstanou. */
  clearRecords(): Promise<void>;
  countRecords(): Promise<number>;

  addOutbox(item: OutboxItem): Promise<void>;
  /** Fronta v pořadí zadání. */
  listOutbox(): Promise<OutboxItem[]>;
  updateOutbox(id: string, patch: Partial<OutboxItem>): Promise<void>;
  removeOutbox(id: string): Promise<void>;

  getFile(key: string): Promise<LocalFile | undefined>;
  putFile(file: LocalFile): Promise<void>;
  removeFile(key: string): Promise<void>;
  listFiles(): Promise<Array<Omit<LocalFile, "data">>>;

  /** Otisky souborů, na které odkazují stažené záznamy (adresa → otisk, velikost, typ). */
  getFileIndex(): Promise<Record<string, FileInfo>>;
  mergeFileIndex(files: Record<string, FileInfo>): Promise<void>;
  clearFileIndex(): Promise<void>;

  /** Odpojení: smazat vše (data, frontu, soubory, metadata). */
  clearAll(): Promise<void>;
}

const keyOf = (entity: string, id: string) => `${entity}:${id}`;

/**
 * Zapíše stránku změn: smazání i s potomky (kaskáda podle rodičů – server značky potomků posílá taky, ale aplikace
 * se na to nesmí spoléhat), pak nové a změněné záznamy. Neznámé entity (novější server) přeskočí.
 */
export async function applyChanges(store: SyncStore, changes: ChangeEntry[]): Promise<{ upserted: number; deleted: number }> {
  const upserts = new Map<string, StoredRecord>();
  const roots: Array<[EntityName, string]> = [];
  for (const change of changes) {
    if (!isEntityName(change.entity)) continue;
    const entity = change.entity;
    if (change.op === "upsert" && change.data) {
      upserts.set(keyOf(entity, change.id), { entity, id: change.id, seq: change.seq, parentId: parentIdOf(entity, change.data) ?? "", data: change.data });
    } else if (change.op === "delete") {
      upserts.delete(keyOf(entity, change.id));
      roots.push([entity, change.id]);
    }
  }
  const deletes = new Map<string, [EntityName, string]>();
  const queue = [...roots];
  while (queue.length) {
    const next = queue.pop();
    if (!next) break;
    const [entity, id] = next;
    const key = keyOf(entity, id);
    if (deletes.has(key)) continue;
    deletes.set(key, next);
    for (const child of ENTITY_CHILDREN[entity]) {
      for (const record of await store.childrenOf(child, id)) {
        // Potomek ve stejné stránce znovu zapsaný (přesun pod jiného rodiče) zůstane
        if (!upserts.has(keyOf(child, record.id))) queue.push([child, record.id]);
      }
    }
  }
  await store.writeRecords([...upserts.values()], [...deletes.values()]);
  return { upserted: upserts.size, deleted: deletes.size };
}
