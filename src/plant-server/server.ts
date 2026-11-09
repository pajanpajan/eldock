// Fáze 72: server závodu – pro zařízení v hale stejné API jako eldock.cz (`docs/SYNC_API.md`), s cloudem
// se synchronizuje jako zařízení `PLANT_SERVER` (jádro `src/sync-client/` v režimu přeposílání). Obsluha požadavků
// je ve tvaru Fetch API (`handle(Request) → Response`) – stejná pro HTTP server (`http.ts`) i testy.

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import os from "node:os";

import { z } from "zod";

import { CLIENT_ID_PATTERN, PAIRING_CODE_LENGTH, SYNC_API, SYNC_API_VERSION, SYNC_MUTATION_LABELS, SYNC_MUTATION_TYPES, SYNC_POLICY, SYNC_SCHEMA_VERSION, effectivePerformedAt, formatPairingCode, normalizePairingCode, pairingCodeFrom, type SyncMutationType } from "@/lib/sync";
import { ENTITY_NAMES, SyncEngine, isEntityName, localRefFor, sha256Hex, type EntityName, type FetchLike, type MutationResult, type OutboxItem, type PlantUserAccess, type SyncReport, type SyncSession, type TokenStore } from "@/sync-client";

import { adminPage } from "./admin-page";
import { json, openPlantDb, type PlantDb } from "./db";
import { LocalRejection, prepareHallMutation } from "./overlay";
import { fileUrlsIn, scopeResolver, visibleFor } from "./scope";
import { PLANT_UPLOAD_PREFIX, PlantStore } from "./store";

type Row = Record<string, unknown>;

export const PLANT_SERVER_VERSION = "1.0.0";
const TOKEN_PREFIX = "eldk_";
const ADMIN_COOKIE = "eldock-plant-admin";
const ADMIN_SESSION_HOURS = 12;
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const MAX_PAIR_FAILURES = 10;

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "X-Content-SHA256, ETag, Content-Disposition, Content-Length" } as const;

export interface PlantServerOptions {
  dataDir: string;
  /** `fetch` do cloudu (testy podvrhnou trasy API). */
  cloudFetch?: FetchLike;
  now?: () => Date;
  serverName?: string;
  /** Interval synchronizace s cloudem (výchozí 5 minut); 0 = jen ručně a po úpravách z haly. */
  syncIntervalMs?: number;
  /** Prodleva odeslání po úpravě z haly (výchozí 2 s). */
  relayDelayMs?: number;
  log?: (message: string) => void;
}

export interface RequestInfo {
  remoteAddress: string;
}

interface DeviceRow {
  id: string;
  userId: string;
  name: string;
  platform: string;
  appVersion: string | null;
  createdAt: string;
  lastSeenAt: string;
  lastPullAt: string | null;
  lastPushAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

interface HallContext {
  device: DeviceRow;
  user: PlantUserAccess;
  session: SyncSession;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const isLoopback = (address: string) => address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...CORS, ...headers } });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status);
}

function preflight(methods: string) {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": `${methods}, OPTIONS`, "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Content-SHA256, If-None-Match", "Access-Control-Max-Age": "86400" } });
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function checkPassword(password: string, stored: string | undefined) {
  const [scheme, salt, hash] = (stored ?? "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 32);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const pairSchema = z.object({ code: z.string().min(1).max(20), platform: z.enum(["WINDOWS", "IOS", "ANDROID", "OTHER"]), name: z.string().max(80).optional().default(""), appVersion: z.string().max(40).optional().nullable() });
const pushSchema = z.object({
  mutations: z
    .array(z.object({ id: z.string().regex(CLIENT_ID_PATTERN), type: z.string().min(1).max(60), payload: z.unknown(), performedAt: z.string().max(40).optional().nullable(), baseUpdatedAt: z.string().max(40).optional().nullable() }))
    .min(1)
    .max(SYNC_POLICY.maxBatch),
});

export class PlantServer {
  readonly store: PlantStore;
  readonly engine: SyncEngine;
  readonly serverName: string;
  lastReport: SyncReport | null = null;
  private readonly db: PlantDb;
  private readonly now: () => Date;
  private syncing: Promise<SyncReport> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private relayTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pairFailures = new Map<string, number[]>();
  private readonly loginFailures = new Map<string, number[]>();

  constructor(private readonly options: PlantServerOptions) {
    this.db = openPlantDb(options.dataDir);
    this.store = new PlantStore(this.db);
    this.now = options.now ?? (() => new Date());
    this.serverName = options.serverName ?? `Server závodu – ${os.hostname()}`;
    if (!this.store.plantMeta("epoch")) this.store.writeMeta({ epoch: randomUUID().slice(0, 8) });
    const tokens: TokenStore = {
      get: async () => (this.store.meta("cloudToken") as string | undefined) ?? null,
      set: async (token) => this.store.writeMeta({ cloudToken: token }),
      clear: async () => this.store.writeMeta({ cloudToken: undefined }),
    };
    this.engine = new SyncEngine({ store: this.store, tokens, platform: "PLANT_SERVER", appVersion: PLANT_SERVER_VERSION, fetcher: options.cloudFetch, now: this.now, relay: true, shouldDownload: (_url, info) => info.size <= 100 * 1024 * 1024 });
  }

  private log(message: string) {
    this.options.log?.(`[server závodu] ${message}`);
  }

  // ---------------------------------------------------------------------------
  //  Spojení s cloudem
  // ---------------------------------------------------------------------------

  get session(): SyncSession | undefined {
    return this.store.meta("session") as SyncSession | undefined;
  }

  private users(): PlantUserAccess[] {
    return this.session?.plantServer?.users ?? [];
  }

  /** Synchronizace s cloudem: přeposlání úprav z haly, stažení závodu, pak výsledky do předběžných dat. */
  syncCloud(): Promise<SyncReport> {
    this.syncing ??= (async () => {
      const report = await this.engine.sync();
      const outbox = await this.store.listOutbox();
      const status = new Map(outbox.map((item) => [item.id, item.status]));
      for (const relayId of this.store.overlayRelayIds()) {
        const state = status.get(relayId);
        // Odmítnuté vrátit hned; provedené až po úspěšném stažení (data z cloudu už jsou v úložišti)
        if (state === "rejected" || state === undefined || (state === "applied" && report.ok)) this.store.dropOverlay(relayId);
      }
      if (report.ok) {
        this.store.finishReset();
        this.revokeInactiveUsers();
      }
      this.lastReport = report;
      this.log(report.ok ? `synchronizováno s cloudem (přeposláno ${report.applied + report.rejected}, staženo ${report.pulled} změn)` : `cloud nedostupný: ${report.error}`);
      return report;
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  /** Spárování s cloudem kódem z Administrace → Zařízení → Spárovat server závodu. */
  async pairCloud(server: string, code: string) {
    const session = await this.engine.pair({ server, code, name: this.serverName });
    if (!session.plantServer) throw new LocalRejection("FORBIDDEN", "Cloud zařízení nepřijal jako server závodu – použijte kód „Spárovat server závodu“ z Administrace.");
    await this.syncCloud();
    return session;
  }

  /** Synchronizace jen se spárovaným cloudem (plánovač, po úpravě z haly, po startu). */
  async syncIfPaired(): Promise<SyncReport | null> {
    return (await this.engine.status()).paired ? this.syncCloud() : null;
  }

  start() {
    const every = this.options.syncIntervalMs ?? 5 * 60_000;
    if (every > 0)
      this.interval = setInterval(() => {
        void this.syncIfPaired();
      }, every);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.relayTimer) clearTimeout(this.relayTimer);
    this.interval = null;
    this.relayTimer = null;
  }

  close() {
    this.stop();
    this.db.close();
  }

  private scheduleRelay() {
    if (this.relayTimer) clearTimeout(this.relayTimer);
    this.relayTimer = setTimeout(() => {
      this.relayTimer = null;
      void this.syncIfPaired();
    }, this.options.relayDelayMs ?? 2000);
  }

  /** Zařízení zablokovaných nebo odebraných uživatelů v hale přestanou platit. */
  private revokeInactiveUsers() {
    const active = new Set(this.users().filter((user) => !user.disabled).map((user) => user.id));
    const at = this.now().toISOString();
    for (const device of this.db.db.prepare("SELECT id, userId FROM devices WHERE revokedAt IS NULL").all() as Row[]) {
      if (!active.has(String(device.userId))) this.db.db.prepare("UPDATE devices SET revokedAt = ?, revokedReason = ? WHERE id = ?").run(at, "účet uživatele v cloudu zablokovaný nebo odebraný", String(device.id));
    }
  }

  // ---------------------------------------------------------------------------
  //  Požadavky
  // ---------------------------------------------------------------------------

  async handle(request: Request, info: RequestInfo = { remoteAddress: "127.0.0.1" }): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "OPTIONS") return preflight(path.startsWith("/api/sync/v1/session") ? "GET, DELETE" : "GET, POST");
      if (path === "/" || path === "/admin") return new Response(adminPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'", "X-Frame-Options": "DENY" } });
      if (path.startsWith("/api/plant/v1/")) return await this.admin(request, path.slice("/api/plant/v1/".length), info);
      if (path === "/api/sync/v1" && request.method === "GET") return jsonResponse(this.info());
      if (path === "/api/sync/v1/pair" && request.method === "POST") return await this.pair(request, info);
      if (path.startsWith("/api/files/") && request.method === "GET") return await this.withDevice(request, (ctx) => this.fileDownload(ctx, path));
      if (path === "/api/sync/v1/session" && request.method === "GET") return await this.withDevice(request, async (ctx) => jsonResponse(this.hallSession(ctx)));
      if (path === "/api/sync/v1/session" && request.method === "DELETE") return await this.withDevice(request, async (ctx) => this.revokeDevice(ctx.device.id, "odpojeno v aplikaci"));
      if (path === "/api/sync/v1/changes" && request.method === "GET") return await this.withDevice(request, async (ctx) => this.changes(ctx, url.searchParams));
      if (path === "/api/sync/v1/mutations" && request.method === "POST") return await this.withDevice(request, (ctx) => this.mutations(ctx, request));
      if (path === "/api/sync/v1/files" && request.method === "POST") return await this.withDevice(request, (ctx) => this.fileUpload(ctx, request, url.searchParams));
      return errorResponse("NOT_FOUND", "Neznámá adresa serveru závodu.", 404);
    } catch (error) {
      if (error instanceof LocalRejection) return errorResponse(error.code, error.message, error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "UNAUTHORIZED" ? 401 : 400);
      this.log(`chyba požadavku ${request.method} ${path}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      return errorResponse("SERVER_ERROR", "Server závodu požadavek nezpracoval – zkuste to znovu.", 500);
    }
  }

  private info() {
    const session = this.session;
    return {
      api: SYNC_API,
      version: SYNC_API_VERSION,
      schema: SYNC_SCHEMA_VERSION,
      name: this.serverName,
      serverTime: this.now().toISOString(),
      pairing: { codeLength: PAIRING_CODE_LENGTH, ttlMinutes: SYNC_POLICY.pairingTtlMinutes },
      platforms: ["WINDOWS", "IOS", "ANDROID", "OTHER"],
      plantServer: { name: this.serverName, plants: session?.plants.map((plant) => plant.name) ?? [], cloudSyncAt: (this.store.meta("lastSyncAt") as string | undefined) ?? null },
    };
  }

  // ---------------------------------------------------------------------------
  //  Zařízení v hale
  // ---------------------------------------------------------------------------

  private device(row: Row): DeviceRow {
    return row as unknown as DeviceRow;
  }

  private async withDevice(request: Request, handler: (ctx: HallContext) => Promise<Response>): Promise<Response> {
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
    const unpaired = () => errorResponse("UNAUTHORIZED", "Zařízení není spárované se serverem závodu nebo bylo odpojeno – spárujte ho znovu kódem ze správy serveru závodu.", 401);
    if (!match?.[1]?.startsWith(TOKEN_PREFIX)) return unpaired();
    const row = this.db.db.prepare("SELECT * FROM devices WHERE tokenHash = ? AND revokedAt IS NULL").get(sha256(match[1])) as Row | undefined;
    const session = this.session;
    if (!row || !session) return unpaired();
    const device = this.device(row);
    const user = this.users().find((candidate) => candidate.id === device.userId);
    if (!user || user.disabled) {
      this.db.db.prepare("UPDATE devices SET revokedAt = ?, revokedReason = ? WHERE id = ?").run(this.now().toISOString(), "účet uživatele zablokovaný nebo odebraný", device.id);
      return unpaired();
    }
    this.db.db.prepare("UPDATE devices SET lastSeenAt = ? WHERE id = ?").run(this.now().toISOString(), device.id);
    return handler({ device, user, session });
  }

  private scopeKey(user: PlantUserAccess) {
    return sha256([this.store.plantMeta("epoch"), SYNC_SCHEMA_VERSION, user.id, user.plantIds.join(","), user.visibleTypes?.join(",") ?? "*"].join("|")).slice(0, 20);
  }

  private hallSession({ device, user, session }: HallContext) {
    return {
      api: SYNC_API,
      version: SYNC_API_VERSION,
      schema: SYNC_SCHEMA_VERSION,
      serverTime: this.now().toISOString(),
      scope: this.scopeKey(user),
      device: { id: device.id, name: device.name, platform: device.platform, appVersion: device.appVersion, pairedAt: device.createdAt, lastPullAt: device.lastPullAt, lastPushAt: device.lastPushAt },
      user: { id: user.id, name: user.name, email: "", title: user.title, accountType: user.accountType, accountLabel: user.accountLabel, permissions: user.permissions, layers: user.layers, visibleTypes: user.visibleTypes },
      company: session.company,
      plants: session.plants.filter((plant) => user.plantIds.includes(plant.id)),
      features: session.features,
      entities: ENTITY_NAMES,
      mutations: SYNC_MUTATION_TYPES,
      policy: session.policy,
      journal: { head: this.store.head() },
    };
  }

  private failedPairing(address: string) {
    const since = Date.now() - SYNC_POLICY.pairFailureWindowMinutes * 60_000;
    const recent = (this.pairFailures.get(address) ?? []).filter((at) => at > since);
    this.pairFailures.set(address, [...recent, Date.now()]);
  }

  private async pair(request: Request, info: RequestInfo) {
    const since = Date.now() - SYNC_POLICY.pairFailureWindowMinutes * 60_000;
    if ((this.pairFailures.get(info.remoteAddress) ?? []).filter((at) => at > since).length >= MAX_PAIR_FAILURES) return errorResponse("RATE_LIMITED", `Příliš mnoho chybných kódů – zkuste to za ${SYNC_POLICY.pairFailureWindowMinutes} minut.`, 429);
    const body = pairSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return errorResponse("BAD_REQUEST", "Očekávám { code, platform, name, appVersion }.", 400);
    const session = this.session;
    if (!session) return errorResponse("NOT_READY", "Server závodu ještě není spárovaný s cloudem – dokončete nastavení ve správě serveru.", 409);
    const code = normalizePairingCode(body.data.code);
    const now = this.now();
    const pairing = code ? (this.db.db.prepare("SELECT * FROM pairings WHERE codeHash = ?").get(sha256(code)) as Row | undefined) : undefined;
    if (!pairing || pairing.usedAt || String(pairing.expiresAt) <= now.toISOString()) {
      this.failedPairing(info.remoteAddress);
      return errorResponse("NOT_FOUND", "Kód neplatí nebo vypršel – ve správě serveru závodu vytvořte nový.", 404);
    }
    const user = this.users().find((candidate) => candidate.id === pairing.userId && !candidate.disabled);
    if (!user) return errorResponse("FORBIDDEN", "Účet, pro který je kód, už v závodě nemá platný přístup.", 403);
    const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
    const device: DeviceRow = { id: randomUUID(), userId: user.id, name: body.data.name.trim().slice(0, 80) || "Zařízení v hale", platform: body.data.platform, appVersion: body.data.appVersion?.trim().slice(0, 40) || null, createdAt: now.toISOString(), lastSeenAt: now.toISOString(), lastPullAt: null, lastPushAt: null, revokedAt: null, revokedReason: null };
    this.db.db.exec("BEGIN IMMEDIATE");
    try {
      const claimed = this.db.db.prepare("UPDATE pairings SET usedAt = ? WHERE id = ? AND usedAt IS NULL").run(now.toISOString(), String(pairing.id));
      if (Number(claimed.changes) !== 1) throw new LocalRejection("NOT_FOUND", "Kód neplatí nebo vypršel – ve správě serveru závodu vytvořte nový.");
      this.db.db.prepare("INSERT INTO devices (id, userId, name, platform, appVersion, tokenHash, createdAt, lastSeenAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(device.id, device.userId, device.name, device.platform, device.appVersion, sha256(token), device.createdAt, device.lastSeenAt);
      this.db.db.exec("COMMIT");
    } catch (error) {
      this.db.db.exec("ROLLBACK");
      throw error;
    }
    this.log(`spárováno zařízení ${device.name} (${user.name})`);
    return jsonResponse({ token, device: { id: device.id, name: device.name, platform: device.platform, createdAt: device.createdAt }, session: this.hallSession({ device, user, session }) }, 201);
  }

  private revokeDevice(deviceId: string, reason: string) {
    this.db.db.prepare("UPDATE devices SET revokedAt = ?, revokedReason = ? WHERE id = ? AND revokedAt IS NULL").run(this.now().toISOString(), reason, deviceId);
    return jsonResponse({ ok: true });
  }

  private changes({ device, user }: HallContext, params: URLSearchParams) {
    const cursor = Number(params.get("cursor") ?? 0);
    const limit = Math.min(SYNC_POLICY.maxPageSize, Math.max(1, Math.floor(Number(params.get("limit") ?? SYNC_POLICY.defaultPageSize))));
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isFinite(limit)) return errorResponse("BAD_REQUEST", "Neplatný kurzor nebo limit.", 400);
    const scope = this.scopeKey(user);
    const head = this.store.head();
    const serverTime = this.now().toISOString();
    if (cursor > 0 && (params.get("scope") !== scope || cursor > head)) return jsonResponse({ cursor: 0, hasMore: true, reset: true, scope, changes: [], files: {}, serverTime });
    const rows = this.store.journalAfter(cursor, limit);
    const resolve = scopeResolver(this.store);
    const changes: Array<{ entity: string; id: string; op: "upsert" | "delete"; seq: number; data?: Row }> = [];
    const files: Record<string, { sha256: string | null; size: number; mime: string }> = {};
    for (const row of rows) {
      const data = row.deleted ? null : this.store.effective(row.entity, row.id);
      if (data && visibleFor(user, resolve(row.entity, row.id, data))) {
        changes.push({ entity: row.entity, id: row.id, op: "upsert", seq: row.seq, data });
        for (const url of fileUrlsIn(data)) {
          const info = this.store.fileInfo(url);
          if (info) files[url] = info;
        }
      } else if (cursor > 0) {
        changes.push({ entity: row.entity, id: row.id, op: "delete", seq: row.seq });
      }
    }
    const hasMore = rows.length === limit;
    const next = hasMore ? (rows[rows.length - 1]?.seq ?? cursor) : Math.max(head, cursor);
    if (!hasMore) this.db.db.prepare("UPDATE devices SET lastPullAt = ? WHERE id = ?").run(serverTime, device.id);
    return jsonResponse({ cursor: next, hasMore, reset: false, scope, changes, files, serverTime });
  }

  /** Výsledek úpravy z fronty přeposílání pro aplikaci. */
  private resultOf(item: OutboxItem, duplicate: boolean): MutationResult {
    if (item.status === "applied") return { id: item.id, status: "applied", ...(duplicate ? { duplicate } : {}), ...(item.entity ? { entity: item.entity } : {}), ...(item.entityId ? { entityId: item.entityId } : {}), ...(item.result ? { result: item.result } : {}) };
    if (item.status === "rejected") return { id: item.id, status: "rejected", ...(duplicate ? { duplicate } : {}), code: item.code ?? "REJECTED", message: item.message ?? "Cloud úpravu odmítl." };
    return { id: item.id, status: "accepted", ...(duplicate ? { duplicate } : {}), message: "Převzato serverem závodu – do cloudu odejde při nejbližší synchronizaci." };
  }

  private async mutations(ctx: HallContext, request: Request) {
    const parsed = pushSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("BAD_REQUEST", `Očekávám { "mutations": [...] } s 1–${SYNC_POLICY.maxBatch} úpravami (id, type, payload).`, 400);
    const results: MutationResult[] = [];
    let accepted = 0;
    const now = this.now();
    for (const mutation of parsed.data.mutations) {
      const known = this.store.outboxItem(mutation.id);
      if (known) {
        results.push(known.userId === ctx.user.id ? this.resultOf(known, true) : { id: mutation.id, status: "rejected", code: "DUPLICATE_ID", message: "Id úpravy už použil jiný uživatel – aplikace musí id vygenerovat znovu." });
        continue;
      }
      if (!(SYNC_MUTATION_TYPES as readonly string[]).includes(mutation.type)) {
        results.push({ id: mutation.id, status: "rejected", code: "UNKNOWN_TYPE", message: `Neznámý druh úpravy „${mutation.type}“ – aktualizujte aplikaci.` });
        continue;
      }
      const type = mutation.type as SyncMutationType;
      const at = effectivePerformedAt(mutation.performedAt, now);
      const resolve = scopeResolver(this.store);
      try {
        const prepared = prepareHallMutation(type, mutation.payload, {
          actor: ctx.user,
          relayId: mutation.id,
          at,
          baseUpdatedAt: mutation.baseUpdatedAt ?? null,
          find: (entity, id) => {
            const data = this.store.effective(entity, id);
            return data && visibleFor(ctx.user, resolve(entity, id, data)) ? data : null;
          },
          children: (entity, parentId) => this.store.effectiveChildren(entity, parentId),
          hasFile: (url) => Boolean(this.store.fileInfo(url)),
          pendingOverlay: (entity, id) => Boolean(this.db.db.prepare("SELECT 1 FROM overlay WHERE entity = ? AND id = ?").get(entity, id)),
        });
        const item: OutboxItem = {
          id: mutation.id,
          type,
          payload: this.relayPayload(mutation.payload) as Record<string, unknown>,
          performedAt: at.toISOString(),
          baseUpdatedAt: prepared.relayBaseUpdatedAt,
          userId: ctx.user.id,
          createdAt: now.toISOString(),
          status: "pending",
          attempts: 0,
          label: `${SYNC_MUTATION_LABELS[type]} – ${ctx.user.name} (${ctx.device.name})`,
          equipmentId: equipmentOf(mutation.payload),
        };
        this.store.acceptRelay(item, prepared.effects.filter((effect) => isEntityName(effect.entity)));
        accepted++;
        results.push(this.resultOf(item, false));
      } catch (error) {
        if (!(error instanceof LocalRejection)) throw error;
        results.push({ id: mutation.id, status: "rejected", code: error.code, message: error.message });
      }
    }
    this.db.db.prepare("UPDATE devices SET lastPushAt = ? WHERE id = ?").run(now.toISOString(), ctx.device.id);
    if (accepted) this.scheduleRelay();
    return jsonResponse({ results, serverTime: now.toISOString() });
  }

  /** Fotky nahrané v hale → místní odkazy pro jádro (před přeposláním je nahraje do cloudu). */
  private relayPayload(payload: unknown): unknown {
    if (typeof payload === "string" && payload.startsWith(PLANT_UPLOAD_PREFIX)) {
      const sha = /plant-([a-f0-9]{64})\./.exec(payload)?.[1];
      return sha ? localRefFor(sha) : payload;
    }
    if (Array.isArray(payload)) return payload.map((item) => this.relayPayload(item));
    if (payload && typeof payload === "object") return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, this.relayPayload(value)]));
    return payload;
  }

  private async fileUpload(_ctx: HallContext, request: Request, params: URLSearchParams) {
    if ((params.get("kind") ?? "photo") !== "photo") return errorResponse("BAD_REQUEST", "Server závodu přijímá z haly jen fotky.", 400);
    const name = (params.get("name") ?? "foto.jpg").slice(0, 200);
    const extension = (/\.[a-z0-9]+$/i.exec(name)?.[0] ?? "").toLowerCase();
    const mime = PHOTO_TYPES[extension];
    if (!mime) return errorResponse("BAD_REQUEST", "Nepodporovaný formát fotky (JPG, PNG nebo WebP).", 400);
    const expected = (request.headers.get("x-content-sha256") ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) return errorResponse("BAD_REQUEST", "Chybí hlavička X-Content-SHA256 (SHA-256 obsahu souboru, hex).", 400);
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.byteLength) return errorResponse("BAD_REQUEST", "Soubor je prázdný.", 400);
    if (data.byteLength > PHOTO_MAX_BYTES) return errorResponse("BAD_REQUEST", "Soubor je příliš velký (max. 15 MB).", 413);
    const sha = await sha256Hex(data);
    if (sha !== expected) return errorResponse("CHECKSUM_MISMATCH", "Otisk SHA-256 nesouhlasí – soubor se cestou poškodil, nahrajte ho znovu.", 422);
    const url = `${PLANT_UPLOAD_PREFIX}${sha}${extension === ".jpeg" ? ".jpg" : extension}`;
    const deduplicated = Boolean(this.store.fileInfo(url));
    if (!deduplicated) {
      const blob = new Blob([data], { type: mime });
      const storedAt = this.now().toISOString();
      await this.store.putFile({ key: url, sha256: sha, size: data.byteLength, mime, name, data: blob, storedAt });
      await this.store.putFile({ key: localRefFor(sha), sha256: sha, size: data.byteLength, mime, name, kind: "photo", data: blob, storedAt });
    }
    return jsonResponse({ url, sha256: sha, sizeBytes: data.byteLength, mimeType: mime, fileName: name, deduplicated }, deduplicated ? 200 : 201);
  }

  private async fileDownload(_ctx: HallContext, path: string) {
    const file = this.store.fileContent(decodeURIComponent(path));
    if (!file) return new Response("Soubor nenalezen.", { status: 404, headers: CORS });
    return new Response(new Uint8Array(file.data), {
      headers: { ...CORS, "Content-Type": file.mime, "Content-Length": String(file.size), "Cache-Control": "private, max-age=3600", ...(file.sha256 ? { "X-Content-SHA256": file.sha256, ETag: `"${file.sha256}"` } : {}) },
    });
  }

  // ---------------------------------------------------------------------------
  //  Správa serveru závodu
  // ---------------------------------------------------------------------------

  private adminSignedIn(request: Request): boolean {
    const cookie = request.headers.get("cookie") ?? "";
    const token = new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`).exec(cookie)?.[1];
    if (!token) return false;
    const row = this.db.db.prepare("SELECT expiresAt FROM admin_sessions WHERE tokenHash = ?").get(sha256(token)) as Row | undefined;
    return Boolean(row && String(row.expiresAt) > this.now().toISOString());
  }

  private adminSession() {
    const token = randomBytes(32).toString("base64url");
    const now = this.now();
    this.db.db.prepare("DELETE FROM admin_sessions WHERE expiresAt <= ?").run(now.toISOString());
    this.db.db.prepare("INSERT INTO admin_sessions (tokenHash, createdAt, expiresAt) VALUES (?, ?, ?)").run(sha256(token), now.toISOString(), new Date(now.getTime() + ADMIN_SESSION_HOURS * 3_600_000).toISOString());
    return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ADMIN_SESSION_HOURS * 3600}`;
  }

  private async admin(request: Request, route: string, info: RequestInfo): Promise<Response> {
    const local = isLoopback(info.remoteAddress);
    const hasPassword = Boolean(this.store.plantMeta("adminPasswordHash"));
    const body = async () => ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (route === "state" && request.method === "GET") return jsonResponse({ setup: hasPassword, signedIn: this.adminSignedIn(request), local, name: this.serverName });
    if (route === "setup" && request.method === "POST") {
      if (hasPassword) return errorResponse("CONFLICT", "Heslo správy už je nastavené.", 409);
      if (!local) return errorResponse("FORBIDDEN", "První nastavení jde jen přímo na serveru závodu (http://localhost).", 403);
      const password = String((await body()).password ?? "");
      if (password.length < 10) return errorResponse("VALIDATION", "Heslo správy musí mít aspoň 10 znaků.", 400);
      this.store.writeMeta({ adminPasswordHash: hashPassword(password) });
      return jsonResponse({ ok: true }, 200, { "Set-Cookie": this.adminSession() });
    }
    if (route === "login" && request.method === "POST") {
      const since = Date.now() - 15 * 60_000;
      const failures = (this.loginFailures.get(info.remoteAddress) ?? []).filter((at) => at > since);
      if (failures.length >= 5) return errorResponse("RATE_LIMITED", "Příliš mnoho chybných hesel – zkuste to za 15 minut.", 429);
      if (!checkPassword(String((await body()).password ?? ""), this.store.plantMeta("adminPasswordHash"))) {
        this.loginFailures.set(info.remoteAddress, [...failures, Date.now()]);
        return errorResponse("UNAUTHORIZED", "Nesprávné heslo správy.", 401);
      }
      return jsonResponse({ ok: true }, 200, { "Set-Cookie": this.adminSession() });
    }
    if (!this.adminSignedIn(request)) return errorResponse("UNAUTHORIZED", "Přihlaste se do správy serveru závodu.", 401);
    // Správa jen ze stejného původu (ochrana proti odeslání formuláře z cizí stránky)
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) return errorResponse("FORBIDDEN", "Požadavek z cizí stránky.", 403);

    if (route === "logout" && request.method === "POST") return jsonResponse({ ok: true }, 200, { "Set-Cookie": `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    if (route === "overview" && request.method === "GET") return jsonResponse(await this.overview(request));
    if (route === "cloud/pair" && request.method === "POST") {
      const input = await body();
      const session = await this.pairCloud(String(input.server ?? ""), String(input.code ?? ""));
      return jsonResponse({ ok: true, company: session.company.name, plants: session.plants.map((plant) => plant.name) });
    }
    if (route === "cloud/sync" && request.method === "POST") return jsonResponse(await this.syncCloud());
    if (route === "cloud/disconnect" && request.method === "POST") {
      await this.engine.disconnect();
      return jsonResponse({ ok: true });
    }
    if (route === "pairing" && request.method === "POST") return jsonResponse(this.createHallPairing(String((await body()).userId ?? ""), request));
    if (route === "devices/revoke" && request.method === "POST") return this.revokeDevice(String((await body()).deviceId ?? ""), "odpojeno ve správě serveru závodu");
    return errorResponse("NOT_FOUND", "Neznámá akce správy.", 404);
  }

  /** Kód párování zařízení v hale pro uživatele firmy (10 minut, jednou). */
  createHallPairing(userId: string, request?: Request) {
    const user = this.users().find((candidate) => candidate.id === userId && !candidate.disabled);
    if (!user) throw new LocalRejection("NOT_FOUND", "Uživatel v závodě není nebo je zablokovaný – synchronizujte s cloudem.");
    const code = pairingCodeFrom(randomBytes(PAIRING_CODE_LENGTH));
    const now = this.now();
    const expiresAt = new Date(now.getTime() + SYNC_POLICY.pairingTtlMinutes * 60_000).toISOString();
    this.db.db.prepare("UPDATE pairings SET usedAt = ? WHERE userId = ? AND usedAt IS NULL").run(now.toISOString(), user.id);
    this.db.db.prepare("INSERT INTO pairings (id, userId, codeHash, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), user.id, sha256(code), now.toISOString(), expiresAt);
    return { code: formatPairingCode(code), expiresAt, user: user.name, servers: this.addresses(request) };
  }

  /** Adresy, na kterých zařízení v hale server najdou (síťová rozhraní počítače). */
  addresses(request?: Request): string[] {
    const port = request ? new URL(request.url).port : "";
    const suffix = port ? `:${port}` : "";
    const found = Object.values(os.networkInterfaces())
      .flat()
      .filter((entry): entry is os.NetworkInterfaceInfo => Boolean(entry && entry.family === "IPv4" && !entry.internal))
      .map((entry) => `http://${entry.address}${suffix}`);
    return [...new Set([...found, `http://${os.hostname()}${suffix}`])];
  }

  private async overview(request: Request) {
    const status = await this.engine.status();
    const outbox = await this.store.listOutbox();
    const users = this.users();
    const name = new Map(users.map((user) => [user.id, user.name]));
    const devices = (this.db.db.prepare("SELECT * FROM devices ORDER BY createdAt DESC").all() as Row[]).map((row) => this.device(row));
    return {
      name: this.serverName,
      version: PLANT_SERVER_VERSION,
      cloud: { paired: status.paired, server: status.server, company: status.session?.company.name ?? null, plants: status.session?.plants.map((plant) => plant.name) ?? [], lastSyncAt: status.lastSyncAt, lastAttemptAt: status.lastAttemptAt, lastError: status.lastError, offline: status.offline, stale: status.stale, unpairedReason: status.unpairedReason },
      lastReport: this.lastReport,
      journal: { head: this.store.head(), records: await this.store.countRecords() },
      relays: {
        pending: outbox.filter((item) => item.status === "pending").length,
        applied: outbox.filter((item) => item.status === "applied").length,
        rejected: outbox.filter((item) => item.status === "rejected").length,
        recent: outbox.slice(-50).reverse().map((item) => ({ id: item.id, label: item.label, user: name.get(item.userId) ?? item.userId, status: item.status, message: item.message ?? null, createdAt: item.createdAt, result: item.result ?? null })),
      },
      users: users.map((user) => ({ id: user.id, name: user.name, accountLabel: user.accountLabel, title: user.title, disabled: user.disabled })),
      devices: devices.map((device) => ({ id: device.id, name: device.name, platform: device.platform, user: name.get(device.userId) ?? device.userId, createdAt: device.createdAt, lastSeenAt: device.lastSeenAt, lastPullAt: device.lastPullAt, revokedAt: device.revokedAt, revokedReason: device.revokedReason })),
      addresses: this.addresses(request),
    };
  }
}

/** Zařízení, kterého se úprava týká (pro výpis přeposílaných úprav). */
function equipmentOf(payload: unknown): string | null {
  const value = (payload as { equipmentId?: unknown } | null)?.equipmentId;
  return typeof value === "string" ? value : null;
}

export type { EntityName };
export { json };
