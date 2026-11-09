// Fáze 73: zrcadlo všeho, co ještě není na serveru, v souborech aplikace (mobilní aplikace). iOS smí data WebView
// (IndexedDB) při nedostatku místa smazat – aplikace proto drží i v souborech: neodeslané, převzaté a odmítnuté
// úpravy, fotky čekající na nahrání a údaje spárování (bez tokenu – ten je v Klíčence / Keystore). Při startu
// `restore()` doplní do úložiště, co v něm chybí; data závodu se pak stáhnou znovu od začátku.

import { isLocalRef } from "./files";
import type { EntityName } from "./entities";
import type { FileInfo } from "./protocol";
import type { LocalFile, OutboxItem, StoredRecord, SyncMeta, SyncStore } from "./store";

/** Soubory aplikace (Capacitor Filesystem, v testech paměť). Zápis má být atomický (dočasný soubor → přejmenování). */
export interface DurableBackup {
  readText(name: string): Promise<string | null>;
  writeText(name: string, text: string): Promise<void>;
  readBlob(name: string): Promise<Blob | null>;
  writeBlob(name: string, data: Blob): Promise<void>;
  remove(name: string): Promise<void>;
}

/** Zrcadlo v paměti (testy). */
export class MemoryBackup implements DurableBackup {
  readonly entries = new Map<string, string | Blob>();
  /** Zkouška výpadku zápisu (plný disk). */
  failWrites = false;

  async readText(name: string) {
    const value = this.entries.get(name);
    return typeof value === "string" ? value : null;
  }
  async writeText(name: string, text: string) {
    if (this.failWrites) throw new Error("zápis zrcadla selhal");
    this.entries.set(name, text);
  }
  async readBlob(name: string) {
    const value = this.entries.get(name);
    return value instanceof Blob ? value : null;
  }
  async writeBlob(name: string, data: Blob) {
    if (this.failWrites) throw new Error("zápis zrcadla selhal");
    this.entries.set(name, data);
  }
  async remove(name: string) {
    this.entries.delete(name);
  }
}

const PAIRING_FILE = "pairing.json";
const OUTBOX_FILE = "outbox.json";
const FILES_FILE = "files.json";
/** Údaje spárování – bez nich by aplikace po ztrátě dat nevěděla, kam a pod kým frontu odeslat. */
const PAIRING_META = ["serverUrl", "serverName", "userId", "deviceId", "deviceName", "session"] as const satisfies ReadonlyArray<keyof SyncMeta>;

type FileMeta = Omit<LocalFile, "data">;

/** Název souboru fotky v zrcadle (`local:<sha256>` → `photo-<sha256>.bin`). */
export const backupBlobName = (key: string) => `photo-${key.replace(/^local:/, "").replace(/[^a-z0-9]/gi, "").slice(0, 64)}.bin`;

const parse = <T>(text: string | null): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export interface RestoreReport {
  /** Úložiště přišlo o údaje spárování a zrcadlo je vrátilo (data závodu se stáhnou znovu). */
  pairing: boolean;
  outbox: number;
  files: number;
}

/** Úložiště jádra s průběžným zrcadlem fronty a místních fotek (obal libovolného `SyncStore`). */
export class DurableStore implements SyncStore {
  private chain: Promise<void> = Promise.resolve();
  private index: Record<string, FileMeta> | null = null;

  constructor(
    private readonly inner: SyncStore,
    private readonly backup: DurableBackup,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  /** Zápisy zrcadla po jednom v pořadí změn; chyba zrcadla aplikaci nezastaví (ohlásí se `onError`). */
  private mirror(task: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(task).catch((error: unknown) => this.onError(error));
    return this.chain;
  }

  /** Počká na dokončení zápisů zrcadla (testy, odchod aplikace do pozadí). */
  flush(): Promise<void> {
    return this.chain;
  }

  private async fileIndex(): Promise<Record<string, FileMeta>> {
    this.index ??= parse<Record<string, FileMeta>>(await this.backup.readText(FILES_FILE)) ?? {};
    return this.index;
  }

  private async saveOutbox() {
    const items = (await this.inner.listOutbox()).filter((item) => item.status !== "applied");
    await this.backup.writeText(OUTBOX_FILE, JSON.stringify(items));
  }

  private async savePairing() {
    const entries = await Promise.all(PAIRING_META.map(async (key) => [key, (await this.inner.getMeta(key)) ?? null] as const));
    await this.backup.writeText(PAIRING_FILE, JSON.stringify(Object.fromEntries(entries)));
  }

  // -------------------------------------------------------------------------
  //  Obnova po ztrátě dat
  // -------------------------------------------------------------------------

  /** Doplní do úložiště ze zrcadla údaje spárování, úpravy a fotky, které v něm chybí (při startu aplikace). */
  async restore(): Promise<RestoreReport> {
    const report: RestoreReport = { pairing: false, outbox: 0, files: 0 };
    const [pairingText, outboxText, filesText] = await Promise.all([this.backup.readText(PAIRING_FILE), this.backup.readText(OUTBOX_FILE), this.backup.readText(FILES_FILE)]);

    const pairing = parse<Partial<Record<(typeof PAIRING_META)[number], unknown>>>(pairingText);
    if (pairing?.serverUrl && !(await this.inner.getMeta("serverUrl"))) {
      const values = Object.fromEntries(Object.entries(pairing).filter(([, value]) => value !== null && value !== undefined)) as Partial<SyncMeta>;
      // Data závodu jsou pryč – stáhnou se znovu od začátku
      await this.inner.setMeta({ ...values, cursor: 0 });
      report.pairing = true;
    }

    const items = parse<OutboxItem[]>(outboxText) ?? [];
    const known = new Set((await this.inner.listOutbox()).map((item) => item.id));
    for (const item of items) {
      if (!item?.id || known.has(item.id)) continue;
      await this.inner.addOutbox(item);
      report.outbox++;
    }

    const index = parse<Record<string, FileMeta>>(filesText) ?? {};
    for (const [key, meta] of Object.entries(index)) {
      if (!isLocalRef(key) || (await this.inner.getFile(key))) continue;
      const data = await this.backup.readBlob(backupBlobName(key));
      if (!data) continue;
      await this.inner.putFile({ ...meta, key, data });
      report.files++;
    }
    this.index = index;
    return report;
  }

  // -------------------------------------------------------------------------
  //  SyncStore – předání vnitřnímu úložišti, zrcadlo jen fronty, místních fotek a spárování
  // -------------------------------------------------------------------------

  getMeta<K extends keyof SyncMeta>(key: K): Promise<SyncMeta[K] | undefined> {
    return this.inner.getMeta(key);
  }

  async setMeta(values: Partial<SyncMeta>) {
    await this.inner.setMeta(values);
    if (PAIRING_META.some((key) => key in values)) void this.mirror(() => this.savePairing());
  }

  getRecord(entity: EntityName, id: string) {
    return this.inner.getRecord(entity, id);
  }

  childrenOf(entity: EntityName, parentId: string) {
    return this.inner.childrenOf(entity, parentId);
  }

  writeRecords(upserts: StoredRecord[], deletes: Array<[EntityName, string]>) {
    return this.inner.writeRecords(upserts, deletes);
  }

  clearRecords() {
    return this.inner.clearRecords();
  }

  countRecords() {
    return this.inner.countRecords();
  }

  async addOutbox(item: OutboxItem) {
    await this.inner.addOutbox(item);
    void this.mirror(() => this.saveOutbox());
  }

  listOutbox() {
    return this.inner.listOutbox();
  }

  async updateOutbox(id: string, patch: Partial<OutboxItem>) {
    await this.inner.updateOutbox(id, patch);
    void this.mirror(() => this.saveOutbox());
  }

  async removeOutbox(id: string) {
    await this.inner.removeOutbox(id);
    void this.mirror(() => this.saveOutbox());
  }

  getFile(key: string) {
    return this.inner.getFile(key);
  }

  async putFile(file: LocalFile) {
    await this.inner.putFile(file);
    if (!isLocalRef(file.key)) return;
    void this.mirror(async () => {
      const index = await this.fileIndex();
      const { data, ...meta } = file;
      // Stejná fotka (jen doplněná adresa po nahrání) se znovu nezapisuje; nejdřív data, pak rejstřík
      if (index[file.key]?.sha256 !== file.sha256) await this.backup.writeBlob(backupBlobName(file.key), data);
      index[file.key] = meta;
      await this.backup.writeText(FILES_FILE, JSON.stringify(index));
    });
  }

  async removeFile(key: string) {
    await this.inner.removeFile(key);
    if (!isLocalRef(key)) return;
    void this.mirror(async () => {
      const index = await this.fileIndex();
      delete index[key];
      await this.backup.remove(backupBlobName(key));
      await this.backup.writeText(FILES_FILE, JSON.stringify(index));
    });
  }

  listFiles() {
    return this.inner.listFiles();
  }

  getFileIndex(): Promise<Record<string, FileInfo>> {
    return this.inner.getFileIndex();
  }

  mergeFileIndex(files: Record<string, FileInfo>) {
    return this.inner.mergeFileIndex(files);
  }

  clearFileIndex() {
    return this.inner.clearFileIndex();
  }

  /** Odpojení zařízení: smazat i zrcadlo. */
  async clearAll() {
    await this.inner.clearAll();
    void this.mirror(async () => {
      const index = await this.fileIndex();
      for (const key of Object.keys(index)) await this.backup.remove(backupBlobName(key));
      this.index = {};
      await Promise.all([this.backup.remove(FILES_FILE), this.backup.remove(OUTBOX_FILE), this.backup.remove(PAIRING_FILE)]);
    });
  }
}
