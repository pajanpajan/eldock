// Fáze 71: cyklus synchronizace aplikace (docs/SYNC_API.md §7) nad rozhraním úložiště – relace → nahrání fotek
// čekajících úprav → fronta po 50 → stahování změn s resetem → soubory pro offline s ověřením SHA-256.
// Fronta patří uživateli: úpravy jiného uživatele (zařízení spárované znovu jiným účtem) se neodešlou.

import { SYNC_MUTATION_LABELS, SYNC_POLICY, normalizePairingCode, type SyncMutationType } from "@/lib/sync";
import { SYNC_MUTATION_SCHEMAS, canMutate, type SyncMutationPayload } from "@/lib/sync-mutations";

import { OFFLINE_MESSAGE, SyncApi, SyncApiError, normalizeServerUrl, type FetchLike } from "./api";
import type { EntityName } from "./entities";
import { collectLocalRefs, isLocalRef, localRefFor, replaceLocalRefs, sha256Hex, withUploadPlaceholders } from "./files";
import type { FileInfo, SessionUser, SyncPlatformName, SyncSession, WireMutation } from "./protocol";
import { applyChanges, type LocalFile, type OutboxItem, type StoredRecord, type SyncStore } from "./store";

/** Bezpečné úložiště tokenu (Windows DPAPI přes Electron, Keychain / Keystore v mobilní aplikaci). */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  constructor(private token: string | null = null) {}
  async get() {
    return this.token;
  }
  async set(token: string) {
    this.token = token;
  }
  async clear() {
    this.token = null;
  }
}

export type SyncPhase = "session" | "upload" | "push" | "pull" | "files";

export type SyncEvent =
  | { type: "progress"; phase: SyncPhase; pulled?: number; head?: number; done?: number; total?: number }
  | { type: "finished"; report: SyncReport }
  | { type: "queued"; item: OutboxItem }
  | { type: "paired"; session: SyncSession }
  | { type: "unpaired"; reason: string };

export interface SyncReport {
  ok: boolean;
  applied: number;
  rejected: number;
  /** Úpravy převzaté serverem závodu – výsledek z cloudu přijde při další synchronizaci (fáze 72). */
  accepted: number;
  /** Úpravy, které server tentokrát nezpracoval (chyba serveru) – odejdou příště. */
  retry: number;
  pulled: number;
  reset: boolean;
  downloaded: number;
  /** Úpravy jiného uživatele ve frontě (neodesílají se). */
  foreign: number;
  unpaired: boolean;
  offline: boolean;
  error: string | null;
  finishedAt: string;
}

export interface EngineStatus {
  paired: boolean;
  server: string | null;
  /** Název serveru z `GET /api/sync/v1` („Eldock“ = cloud, „Server závodu – …“ = server v síti závodu). */
  serverName: string | null;
  user: SessionUser | null;
  session: SyncSession | null;
  lastSyncAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  offline: boolean;
  /** Poslední úplná synchronizace je starší než `policy.staleAfterHours` (24 h) – upozornit uživatele. */
  stale: boolean;
  pending: number;
  /** Na serveru závodu, čeká na cloud (fáze 72). */
  accepted: number;
  rejected: number;
  foreign: number;
  unpairedReason: string | null;
}

export interface EngineOptions {
  store: SyncStore;
  tokens: TokenStore;
  platform: SyncPlatformName;
  appVersion: string;
  fetcher?: FetchLike;
  now?: () => Date;
  newId?: () => string;
  /** Které soubory stahovat pro offline – výchozí vše do 50 MB, větší až na vyžádání. */
  shouldDownload?: (url: string, info: FileInfo) => boolean;
  onEvent?: (event: SyncEvent) => void;
  pageSize?: number;
  /**
   * Fáze 72: režim přeposílání (server závodu) – fronta nese úpravy více uživatelů z haly, odešlou se všechny
   * s `actorId` = vlastník úpravy (cloud je provede jejich jménem).
   */
  relay?: boolean;
}

const AUTO_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const APPLIED_KEEP_DAYS = 7;

export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly options: EngineOptions) {
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => globalThis.crypto.randomUUID());
  }

  get store() {
    return this.options.store;
  }

  private emit(event: SyncEvent) {
    this.options.onEvent?.(event);
  }

  private api(server: string, token: string | null) {
    return new SyncApi(server, token, this.options.fetcher);
  }

  // -------------------------------------------------------------------------
  //  Párování a odpojení
  // -------------------------------------------------------------------------

  /** Spáruje zařízení kódem z webu (Můj účet → Aplikace a zařízení). Jiný server nebo účet = místní data znovu. */
  async pair(input: { server: string; code: string; name: string }): Promise<SyncSession> {
    const server = normalizeServerUrl(input.server);
    if (!server) throw new SyncApiError(0, "VALIDATION", "Zadejte adresu serveru (např. eldock.cz).");
    const code = normalizePairingCode(input.code);
    if (!code) throw new SyncApiError(0, "VALIDATION", "Kód párování má 8 znaků (písmena a číslice) – opište ho z webu.");
    const api = this.api(server, null);
    let info;
    try {
      info = await api.info();
    } catch (error) {
      if (error instanceof SyncApiError && error.network) throw new SyncApiError(0, "NETWORK", "Server je nedostupný – zkontrolujte adresu serveru a připojení k síti.", true);
      throw error;
    }
    const paired = await api.pair({ code, platform: this.options.platform, name: input.name.trim().slice(0, 80) || "Windows", appVersion: this.options.appVersion });
    const { store } = this.options;
    const [previousServer, previousUser] = await Promise.all([store.getMeta("serverUrl"), store.getMeta("userId")]);
    if (previousServer !== server || previousUser !== paired.session.user.id) {
      await store.clearRecords();
      await store.clearFileIndex();
      await store.setMeta({ cursor: 0, scope: paired.session.scope });
    }
    await this.options.tokens.set(paired.token);
    await store.setMeta({
      serverUrl: server,
      serverName: info.name,
      userId: paired.session.user.id,
      deviceId: paired.device.id,
      deviceName: paired.device.name,
      session: paired.session,
      unpairedReason: null,
      lastError: null,
      offline: false,
    });
    this.emit({ type: "paired", session: paired.session });
    return paired.session;
  }

  /** Odpojí zařízení na serveru (je-li dostupný) a smaže všechna místní data včetně fronty. */
  async disconnect(): Promise<void> {
    const { store, tokens } = this.options;
    const [server, token] = await Promise.all([store.getMeta("serverUrl"), tokens.get()]);
    if (server && token) await this.api(server, token).disconnect().catch(() => undefined);
    await tokens.clear();
    await store.clearAll();
    this.emit({ type: "unpaired", reason: "Zařízení je odpojené." });
  }

  /** Smaže stažená data a při další synchronizaci stáhne vše znovu (fronta zůstane). */
  async resetData(): Promise<void> {
    const { store } = this.options;
    await store.clearRecords();
    await store.clearFileIndex();
    await store.setMeta({ cursor: 0 });
  }

  // -------------------------------------------------------------------------
  //  Fronta úprav
  // -------------------------------------------------------------------------

  /** Smí přihlášený účet úpravu zadat (oprávnění z relace)? */
  async canQueue(type: SyncMutationType): Promise<boolean> {
    const session = await this.options.store.getMeta("session");
    return Boolean(session && canMutate(type, session.user.permissions));
  }

  /**
   * Úprava do fronty (offline). Data se ověří schématem jako na serveru (fotky čekající na nahrání jako místní
   * odkazy `local:<sha256>`); `baseUpdatedAt` = `updatedAt` měněného záznamu, jak ho aplikace zná.
   */
  async queue<T extends SyncMutationType>(type: T, payload: SyncMutationPayload<T>, info: { label?: string; equipmentId?: string | null; baseUpdatedAt?: string | null } = {}): Promise<OutboxItem> {
    const { store } = this.options;
    const userId = await store.getMeta("userId");
    if (!userId) throw new SyncApiError(0, "UNPAIRED", "Zařízení není spárované.");
    if (!(await this.canQueue(type))) throw new SyncApiError(403, "FORBIDDEN", "Váš účet tuto úpravu nemůže zadat.");
    const parsed = SYNC_MUTATION_SCHEMAS[type].safeParse(withUploadPlaceholders(payload));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new SyncApiError(400, "VALIDATION", `Neplatná data úpravy${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "chybný formát"}.`);
    }
    for (const ref of collectLocalRefs(payload)) {
      if (!(await store.getFile(ref))) throw new SyncApiError(400, "VALIDATION", "Fotka k úpravě se v zařízení nenašla – přidejte ji znovu.");
    }
    const at = this.now().toISOString();
    const item: OutboxItem = {
      id: this.newId(),
      type,
      payload: payload as Record<string, unknown>,
      performedAt: at,
      baseUpdatedAt: info.baseUpdatedAt ?? null,
      userId,
      createdAt: at,
      status: "pending",
      attempts: 0,
      label: info.label ?? SYNC_MUTATION_LABELS[type],
      equipmentId: info.equipmentId ?? null,
    };
    await store.addOutbox(item);
    this.emit({ type: "queued", item });
    return item;
  }

  /** Odmítnutou úpravu uživatel zahodí (opraví ji jako novou). */
  async dismiss(id: string): Promise<void> {
    await this.options.store.removeOutbox(id);
  }

  /** Fotka pořízená offline → místní odkaz `local:<sha256>` pro data úpravy. */
  async addLocalFile(data: Blob, info: { kind?: string; name: string }): Promise<string> {
    const sha256 = await sha256Hex(data);
    const key = localRefFor(sha256);
    const existing = await this.options.store.getFile(key);
    if (!existing) await this.options.store.putFile({ key, sha256, size: data.size, mime: data.type || "image/jpeg", name: info.name, kind: info.kind ?? "photo", data, storedAt: this.now().toISOString() });
    return key;
  }

  /** Soubor pro zobrazení: z mezipaměti, jinak (online) stáhne a ověří. `null` = offline bez kopie. */
  async fileBlob(url: string): Promise<Blob | null> {
    const { store, tokens } = this.options;
    const cached = await store.getFile(url);
    if (cached) return cached.data;
    if (isLocalRef(url)) return null;
    const [server, token, index] = await Promise.all([store.getMeta("serverUrl"), tokens.get(), store.getFileIndex()]);
    if (!server || !token || !url.startsWith("/")) return null;
    try {
      const file = await this.download(this.api(server, token), url, index[url] ?? null);
      return file?.data ?? null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  //  Stav
  // -------------------------------------------------------------------------

  async status(): Promise<EngineStatus> {
    const { store, tokens } = this.options;
    const [token, server, serverName, session, userId, lastSyncAt, lastAttemptAt, lastError, offline, unpairedReason, outbox] = await Promise.all([
      tokens.get(),
      store.getMeta("serverUrl"),
      store.getMeta("serverName"),
      store.getMeta("session"),
      store.getMeta("userId"),
      store.getMeta("lastSyncAt"),
      store.getMeta("lastAttemptAt"),
      store.getMeta("lastError"),
      store.getMeta("offline"),
      store.getMeta("unpairedReason"),
      store.listOutbox(),
    ]);
    const staleAfter = (session?.policy.staleAfterHours ?? SYNC_POLICY.staleAfterHours) * 3_600_000;
    return {
      paired: Boolean(token && server),
      server: server ?? null,
      serverName: serverName ?? null,
      user: session?.user ?? null,
      session: session ?? null,
      lastSyncAt: lastSyncAt ?? null,
      lastAttemptAt: lastAttemptAt ?? null,
      lastError: lastError ?? null,
      offline: offline ?? false,
      stale: !lastSyncAt || this.now().getTime() - new Date(lastSyncAt).getTime() > staleAfter,
      pending: outbox.filter((item) => item.status === "pending" && (this.options.relay || item.userId === userId)).length,
      accepted: outbox.filter((item) => item.status === "accepted" && (this.options.relay || item.userId === userId)).length,
      rejected: outbox.filter((item) => item.status === "rejected").length,
      foreign: this.options.relay ? 0 : outbox.filter((item) => (item.status === "pending" || item.status === "accepted") && item.userId !== userId).length,
      unpairedReason: unpairedReason ?? null,
    };
  }

  // -------------------------------------------------------------------------
  //  Synchronizace
  // -------------------------------------------------------------------------

  /** Jeden cyklus synchronizace (souběžné volání počká na běžící). */
  sync(): Promise<SyncReport> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncReport> {
    const { store, tokens } = this.options;
    const report: SyncReport = { ok: false, applied: 0, rejected: 0, accepted: 0, retry: 0, pulled: 0, reset: false, downloaded: 0, foreign: 0, unpaired: false, offline: false, error: null, finishedAt: "" };
    const [token, server] = await Promise.all([tokens.get(), store.getMeta("serverUrl")]);
    if (!token || !server) return this.finish({ ...report, unpaired: true, error: "Zařízení není spárované." });
    const api = this.api(server, token);
    await store.setMeta({ lastAttemptAt: this.now().toISOString() });
    try {
      this.emit({ type: "progress", phase: "session" });
      const session = await api.session();
      await store.setMeta({ session, userId: session.user.id, offline: false });
      await this.pushOutbox(api, session, report);
      await this.pull(api, session, report);
      await this.downloadFiles(api, report);
      await this.prune();
      const at = this.now().toISOString();
      await store.setMeta({ lastSyncAt: at, lastPullAt: at, lastError: null, unpairedReason: null });
      report.ok = true;
    } catch (error) {
      const apiError = error instanceof SyncApiError ? error : new SyncApiError(0, "CLIENT_ERROR", error instanceof Error ? error.message : String(error));
      report.error = apiError.message;
      report.offline = apiError.network;
      if (apiError.unauthorized) {
        report.unpaired = true;
        await tokens.clear();
        await store.setMeta({ unpairedReason: apiError.message });
        this.emit({ type: "unpaired", reason: apiError.message });
      }
      await store.setMeta({ lastError: apiError.network ? OFFLINE_MESSAGE : apiError.message, offline: apiError.network });
    }
    return this.finish(report);
  }

  private finish(report: SyncReport): SyncReport {
    const done = { ...report, finishedAt: this.now().toISOString() };
    this.emit({ type: "finished", report: done });
    return done;
  }

  /** Nahraje fotky čekajících úprav a odešle frontu po dávkách (`policy.maxBatch`). */
  private async pushOutbox(api: SyncApi, session: SyncSession, report: SyncReport) {
    const { store } = this.options;
    // Převzaté serverem závodu se posílají znovu – opakované odeslání vrátí výsledek z cloudu, až ho server má
    const pending = (await store.listOutbox()).filter((item) => item.status === "pending" || item.status === "accepted");
    const mine = this.options.relay ? pending : pending.filter((item) => item.userId === session.user.id);
    report.foreign = pending.length - mine.length;
    if (!mine.length) return;

    this.emit({ type: "progress", phase: "upload", done: 0, total: mine.length });
    const ready: OutboxItem[] = [];
    for (const item of mine) {
      const refs = collectLocalRefs(item.payload);
      const urls: Record<string, string> = {};
      let problem: string | null = null;
      for (const ref of refs) {
        const file = await store.getFile(ref);
        if (!file?.sha256) {
          problem = "Fotka k úpravě se v zařízení nenašla – úpravu zadejte znovu.";
          break;
        }
        if (file.uploadedUrl) {
          urls[ref] = file.uploadedUrl;
          continue;
        }
        try {
          const uploaded = await api.uploadFile({ kind: file.kind ?? "photo", name: file.name ?? "foto.jpg", data: file.data, sha256: file.sha256 });
          urls[ref] = uploaded.url;
          await store.putFile({ ...file, uploadedUrl: uploaded.url });
          // Kopie pod adresou ze serveru – fotka je po synchronizaci vidět i bez opětovného stažení
          await store.putFile({ key: uploaded.url, sha256: uploaded.sha256, size: file.size, mime: file.mime, name: file.name, data: file.data, storedAt: this.now().toISOString() });
        } catch (error) {
          if (error instanceof SyncApiError && !error.retryable && !error.unauthorized) {
            problem = error.message;
            break;
          }
          throw error;
        }
      }
      if (problem) {
        await store.updateOutbox(item.id, { status: "rejected", code: "FILE", message: problem, resolvedAt: this.now().toISOString() });
        report.rejected++;
        continue;
      }
      const payload = refs.length ? replaceLocalRefs(item.payload, urls) : item.payload;
      if (refs.length) await store.updateOutbox(item.id, { payload });
      ready.push({ ...item, payload });
    }

    const batch = Math.max(1, session.policy.maxBatch || SYNC_POLICY.maxBatch);
    for (let start = 0; start < ready.length; start += batch) {
      const chunk = ready.slice(start, start + batch);
      this.emit({ type: "progress", phase: "push", done: start, total: ready.length });
      const at = this.now().toISOString();
      for (const item of chunk) await store.updateOutbox(item.id, { attempts: item.attempts + 1, lastAttemptAt: at });
      const wire: WireMutation[] = chunk.map((item) => ({ id: item.id, type: item.type, payload: item.payload, performedAt: item.performedAt, baseUpdatedAt: item.baseUpdatedAt, ...(this.options.relay ? { actorId: item.userId } : {}) }));
      const { results } = await api.pushMutations(wire);
      for (const result of results) {
        if (result.status === "applied") {
          report.applied++;
          await store.updateOutbox(result.id, { status: "applied", entity: result.entity, entityId: result.entityId, result: result.result, code: undefined, message: undefined, resolvedAt: at });
        } else if (result.status === "rejected") {
          report.rejected++;
          await store.updateOutbox(result.id, { status: "rejected", code: result.code, message: result.message, resolvedAt: at });
        } else if (result.status === "accepted") {
          report.accepted++;
          await store.updateOutbox(result.id, { status: "accepted", code: undefined, message: result.message });
        } else {
          report.retry++;
          await store.updateOutbox(result.id, { code: result.code, message: result.message ?? "Server úpravu tentokrát nezpracoval – odešle se příště." });
        }
      }
    }
    await store.setMeta({ lastPushAt: this.now().toISOString() });
  }

  /** Stahuje stránky změn od uloženého kurzoru, `reset` = smazat data a znovu od 0. */
  private async pull(api: SyncApi, session: SyncSession, report: SyncReport) {
    const { store } = this.options;
    let cursor = (await store.getMeta("cursor")) ?? 0;
    let scope = (await store.getMeta("scope")) ?? session.scope;
    const head = session.journal.head;
    const limit = Math.min(this.options.pageSize ?? session.policy.defaultPageSize ?? SYNC_POLICY.defaultPageSize, session.policy.maxPageSize ?? SYNC_POLICY.maxPageSize);
    this.emit({ type: "progress", phase: "pull", pulled: 0, head });
    let resets = 0;
    for (let pages = 0; ; pages++) {
      if (pages > 10_000) throw new SyncApiError(0, "CLIENT_ERROR", "Stahování změn se nezastavilo – zkuste synchronizaci znovu.");
      const page = await api.changes({ cursor, scope, limit });
      if (page.reset) {
        if (++resets > 3) throw new SyncApiError(0, "CLIENT_ERROR", "Server opakovaně žádá nové stažení dat – zkuste to později.");
        report.reset = true;
        await store.clearRecords();
        await store.clearFileIndex();
        cursor = 0;
        scope = page.scope;
        await store.setMeta({ cursor, scope });
        continue;
      }
      await applyChanges(store, page.changes);
      await store.mergeFileIndex(page.files);
      report.pulled += page.changes.length;
      cursor = page.cursor;
      scope = page.scope;
      await store.setMeta({ cursor, scope });
      this.emit({ type: "progress", phase: "pull", pulled: report.pulled, head: Math.max(head, cursor) });
      if (!page.hasMore) break;
    }
  }

  /** Stáhne chybějící nebo změněné soubory pro offline (otisk SHA-256 z registru serveru). */
  private async downloadFiles(api: SyncApi, report: SyncReport) {
    const { store } = this.options;
    const index = await store.getFileIndex();
    const policy = this.options.shouldDownload ?? ((_url: string, info: FileInfo) => info.size <= AUTO_DOWNLOAD_BYTES);
    const wanted: Array<[string, FileInfo]> = [];
    for (const [url, info] of Object.entries(index)) {
      if (!url.startsWith("/api/files/") || !policy(url, info)) continue;
      const cached = await store.getFile(url);
      if (cached && (!info.sha256 || cached.sha256 === info.sha256)) continue;
      wanted.push([url, info]);
    }
    for (let done = 0; done < wanted.length; done++) {
      this.emit({ type: "progress", phase: "files", done, total: wanted.length });
      const [url, info] = wanted[done];
      try {
        if (await this.download(api, url, info)) report.downloaded++;
      } catch (error) {
        // Chybějící nebo nedostupný soubor (404) synchronizaci nezastaví; výpadek sítě ano (dokončí se příště)
        if (error instanceof SyncApiError && (error.network || error.unauthorized || error.status >= 500)) throw error;
      }
    }
  }

  private async download(api: SyncApi, url: string, info: FileInfo | null): Promise<LocalFile | null> {
    const { store } = this.options;
    const result = await api.downloadFile(url);
    if (result.notModified) return null;
    const sha256 = await sha256Hex(result.data);
    const expected = info?.sha256 ?? result.info.sha256;
    if (expected && expected !== sha256) throw new SyncApiError(422, "CHECKSUM_MISMATCH", "Stažený soubor nesouhlasí s otiskem – stáhne se znovu.");
    const file: LocalFile = { key: url, sha256, size: result.data.size, mime: result.info.mime, data: result.data, etag: result.etag, storedAt: this.now().toISOString() };
    await store.putFile(file);
    return file;
  }

  /** Úklid: vyřízené úpravy starší 7 dní, nahrané místní fotky bez čekající úpravy, soubory mimo stažená data. */
  private async prune() {
    const { store } = this.options;
    const outbox = await store.listOutbox();
    const cutoff = this.now().getTime() - APPLIED_KEEP_DAYS * 86_400_000;
    for (const item of outbox) if (item.status === "applied" && item.resolvedAt && new Date(item.resolvedAt).getTime() < cutoff) await store.removeOutbox(item.id);
    const needed = new Set((await store.listOutbox()).filter((item) => item.status !== "applied").flatMap((item) => collectLocalRefs(item.payload)));
    const index = await store.getFileIndex();
    for (const file of await store.listFiles()) {
      if (isLocalRef(file.key)) {
        if (!needed.has(file.key) && file.uploadedUrl) await store.removeFile(file.key);
      } else if (!index[file.key] && !(await this.isReferencedUpload(file.key, outbox))) {
        await store.removeFile(file.key);
      }
    }
  }

  /** Fotka nahraná z této aplikace, kterou ještě nepotvrdila stažená data (úprava čeká nebo je čerstvě provedená). */
  private async isReferencedUpload(url: string, outbox: OutboxItem[]) {
    return outbox.some((item) => JSON.stringify(item.payload).includes(url));
  }
}

/** Záznam entity jako typ (pomocník rozhraní nad `StoredRecord.data`). */
export const recordData = <T>(record: StoredRecord | undefined): T | undefined => record?.data as T | undefined;

export type { EntityName };
