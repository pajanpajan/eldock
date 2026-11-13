// Fáze 112: offline fronta pro práci v rozvodnách a suterénech bez signálu (Hlídač revizí, rychlá revize, sekvenční sběr
// Scan & Snap). Nově přidané spotřebiče, fotky výrobních štítků a naměřené revize se při výpadku sítě (`!navigator.onLine`
// nebo selhání požadavku) uloží do perzistentní fronty v prohlížeči – záznamy do `localStorage`, fotky do IndexedDB – a po
// obnovení připojení (`online`) se odešlou v pořadí, v jakém vznikly. Každý záznam nese id klienta, server ho přijme jen
// jednou (opakované odeslání vrátí stejný výsledek). Bez závislostí na Reactu – úložiště jdou podvrhnout v testech.

export interface QueueEntry<P = unknown> {
  /** Id klienta (idempotence na serveru). */
  id: string;
  kind: string;
  payload: P;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  /** Klíče fotek v úložišti souborů (IndexedDB). */
  blobKeys: string[];
}

export interface QueueStorage {
  load(): QueueEntry[];
  save(entries: QueueEntry[]): void;
}

export interface BlobStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<void>;
}

/** Výsledek odeslání jednoho záznamu: hotovo, zkusit znovu později (síť), nebo zahodit (server ho odmítl natrvalo). */
export type SendResult = "done" | "retry" | "drop";
export type Sender = (entry: QueueEntry, blobs: Record<string, Blob>) => Promise<SendResult>;

export const OFFLINE_QUEUE_KEY = "eldock-offline-queue-v1";
const MAX_ENTRIES = 500;

/** Chyba sítě (fetch bez spojení, prohlížeč offline) – záznam zůstane ve frontě. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /failed to fetch|networkerror|load failed|network request failed|fetch failed|offline|bez připojení/i.test(error.message);
}

/** Popisek indikátoru („📡 Offline režim – 3 záznamy čekají na odeslání“). */
export function offlineLabel(count: number): string {
  const noun = count === 1 ? "záznam čeká" : count >= 2 && count <= 4 ? "záznamy čekají" : "záznamů čeká";
  return `📡 Offline režim – ${count} ${noun} na odeslání`;
}

/** Fronta v `localStorage` (poškozený obsah = prázdná fronta). */
export function localStorageQueue(key = OFFLINE_QUEUE_KEY): QueueStorage {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        return Array.isArray(parsed) ? (parsed.filter((entry) => entry && typeof entry === "object" && typeof (entry as QueueEntry).id === "string") as QueueEntry[]) : [];
      } catch {
        return [];
      }
    },
    save(entries) {
      try {
        window.localStorage.setItem(key, JSON.stringify(entries));
      } catch {
        // plné úložiště / soukromý režim – fronta zůstane v paměti stránky
      }
    },
  };
}

/** Fronta v paměti (testy, prohlížeč bez úložiště). */
export function memoryStorage(initial: QueueEntry[] = []): QueueStorage & { entries: QueueEntry[] } {
  const store = {
    entries: [...initial],
    load: () => store.entries.map((entry) => ({ ...entry })),
    save: (entries: QueueEntry[]) => {
      store.entries = entries.map((entry) => ({ ...entry }));
    },
  };
  return store;
}

/** Fotky v paměti (testy, prohlížeč bez IndexedDB). */
export function memoryBlobs(): BlobStore & { size(): number } {
  const map = new Map<string, Blob>();
  return {
    put: async (key, blob) => void map.set(key, blob),
    get: async (key) => map.get(key) ?? null,
    delete: async (key) => void map.delete(key),
    size: () => map.size,
  };
}

/** Fotky v IndexedDB (přežijí zavření prohlížeče); bez IndexedDB v paměti stránky. */
export function indexedDbBlobs(dbName = "eldock-offline", storeName = "blobs"): BlobStore {
  if (typeof indexedDB === "undefined") return memoryBlobs();
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB nejde otevřít."));
    }));
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const database = await db();
    return new Promise<T>((resolve, reject) => {
      const request = action(database.transaction(storeName, mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB selhala."));
    });
  };
  return {
    put: async (key, blob) => void (await run("readwrite", (store) => store.put(blob, key))),
    get: async (key) => ((await run<unknown>("readonly", (store) => store.get(key))) as Blob | undefined) ?? null,
    delete: async (key) => void (await run("readwrite", (store) => store.delete(key))),
  };
}

const randomId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export class OfflineSyncQueue {
  private readonly storage: QueueStorage;
  private readonly blobs: BlobStore;
  private readonly listeners = new Set<(count: number) => void>();
  private readonly idFactory: () => string;
  private readonly now: () => number;
  private flushing: Promise<{ sent: number; dropped: number; remaining: number }> | null = null;

  constructor(options: { storage: QueueStorage; blobs?: BlobStore; idFactory?: () => string; now?: () => number }) {
    this.storage = options.storage;
    this.blobs = options.blobs ?? memoryBlobs();
    this.idFactory = options.idFactory ?? randomId;
    this.now = options.now ?? Date.now;
  }

  pending(): QueueEntry[] {
    return this.storage.load();
  }

  count(): number {
    return this.pending().length;
  }

  subscribe(listener: (count: number) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private notify() {
    const count = this.count();
    for (const listener of this.listeners) listener(count);
  }

  /** Nové id záznamu (stejné id při okamžitém odeslání i ve frontě = server ho přijme jednou). */
  newId(): string {
    return this.idFactory();
  }

  /** Uloží záznam do fronty (fotky do úložiště souborů). */
  async enqueue<P>(kind: string, payload: P, blobs: Record<string, Blob> = {}, id = this.newId()): Promise<QueueEntry<P>> {
    const keys: string[] = [];
    for (const [name, blob] of Object.entries(blobs)) {
      const key = `${id}:${name}`;
      await this.blobs.put(key, blob);
      keys.push(key);
    }
    const entry: QueueEntry<P> = { id, kind, payload, createdAt: this.now(), attempts: 0, lastError: null, blobKeys: keys };
    const entries = this.pending().filter((existing) => existing.id !== id);
    entries.push(entry as QueueEntry);
    this.storage.save(entries.slice(-MAX_ENTRIES));
    this.notify();
    return entry;
  }

  private async remove(entry: QueueEntry) {
    for (const key of entry.blobKeys) await this.blobs.delete(key).catch(() => undefined);
    this.storage.save(this.pending().filter((existing) => existing.id !== entry.id));
  }

  /**
   * Odešle frontu v pořadí vzniku. Chyba sítě přeruší odesílání (zbytek počká na další `online`), trvalé odmítnutí
   * serverem záznam zahodí. Souběžná volání sdílí jedno odesílání.
   */
  flush(send: Sender): Promise<{ sent: number; dropped: number; remaining: number }> {
    this.flushing ??= this.runFlush(send).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async runFlush(send: Sender) {
    let sent = 0;
    let dropped = 0;
    for (const entry of this.pending()) {
      const blobs: Record<string, Blob> = {};
      for (const key of entry.blobKeys) {
        const blob = await this.blobs.get(key);
        if (blob) blobs[key.slice(key.indexOf(":") + 1)] = blob;
      }
      let result: SendResult;
      try {
        result = await send(entry, blobs);
      } catch (error) {
        result = isNetworkError(error) ? "retry" : "drop";
        entry.lastError = error instanceof Error ? error.message : String(error);
      }
      if (result === "retry") {
        this.storage.save(this.pending().map((existing) => (existing.id === entry.id ? { ...existing, attempts: existing.attempts + 1, lastError: entry.lastError ?? "Bez připojení" } : existing)));
        break;
      }
      await this.remove(entry);
      if (result === "done") sent++;
      else dropped++;
    }
    this.notify();
    return { sent, dropped, remaining: this.count() };
  }

  /** Automatické odeslání po obnovení připojení (`online`) a pravidelně, dokud je co odesílat. */
  startAutoSync(send: Sender, target: Pick<Window, "addEventListener" | "removeEventListener"> = window, intervalMs = 30_000): () => void {
    const run = () => {
      if (this.count() && (typeof navigator === "undefined" || navigator.onLine !== false)) void this.flush(send);
    };
    target.addEventListener("online", run);
    const timer = setInterval(run, intervalMs);
    run();
    return () => {
      target.removeEventListener("online", run);
      clearInterval(timer);
    };
  }
}

/**
 * Odeslání s offline zárukou: online se záznam pošle hned (chyba sítě = do fronty), offline rovnou do fronty. Vrací
 * „sent“ s výsledkem serveru, nebo „queued“.
 */
export async function sendOrQueue<P, R>(queue: OfflineSyncQueue, kind: string, payload: P, blobs: Record<string, Blob>, send: (entry: QueueEntry<P>, blobs: Record<string, Blob>) => Promise<R>): Promise<{ status: "sent"; result: R } | { status: "queued"; entry: QueueEntry<P> }> {
  const id = queue.newId();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      const result = await send({ id, kind, payload, createdAt: Date.now(), attempts: 0, lastError: null, blobKeys: [] }, blobs);
      return { status: "sent", result };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  return { status: "queued", entry: await queue.enqueue(kind, payload, blobs, id) };
}
