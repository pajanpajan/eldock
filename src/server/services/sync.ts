// Fáze 70: synchronizace s aplikacemi (Windows, iOS, Android, server závodu) – párování zařízení, token zařízení,
// relace aplikace, stahování změn ze žurnálu (`SyncChange`) a retence. Úpravy z aplikací = `server/sync/mutations.ts`,
// protokol = `docs/SYNC_API.md`. Služby dostávají `prisma` (testy nad SQLite). Záměrně bez `server-only`.

import { createHash, createHmac, randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { AccountType, EquipmentType, SyncPlatform, UserRole } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES, accountLayers, visibleTypes, type Permission } from "@/lib/accounts";
import { authSecret } from "@/lib/auth";
import { collectFileUrls, companyOwner, type FileOwner } from "@/lib/file-ownership";
import type { LayerKey } from "@/lib/map-layers";
import { effectiveFeatures } from "@/lib/modules";
import {
  PAIRING_CODE_LENGTH,
  SYNC_API,
  SYNC_API_VERSION,
  SYNC_MUTATION_TYPES,
  SYNC_PLATFORM_LABELS,
  SYNC_POLICY,
  SYNC_SCHEMA_VERSION,
  formatPairingCode,
  normalizePairingCode,
  pairingCodeFrom,
} from "@/lib/sync";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { SYNC_ENTITIES, type SyncEntity } from "@/server/sync/journal";

import { recordSecurityEvent } from "./account-security";
import { loadModuleConfig } from "./modules";

const DAY_MS = 86_400_000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SyncErrorCode = "UNAUTHORIZED" | "RATE_LIMITED" | "BAD_REQUEST";

/** Chyba API synchronizace mimo pravidla služeb (token, limit pokusů, formát požadavku) – s HTTP stavem. */
export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
/** Kód párování jen jako HMAC (8 znaků = 40 bitů – bez tajemství by šel z databáze dopočítat). */
const pairingHash = (code: string) => createHmac("sha256", `${authSecret()}:sync-pair`).update(code).digest("hex");

/** Token zařízení: předpona (rozpoznatelný při úniku) + 32 náhodných bajtů. V DB jen SHA-256. */
export const DEVICE_TOKEN_PREFIX = "eldk_";
const TOKEN_PATTERN = /^eldk_[\w-]{40,64}$/;
export const deviceTokenHash = (token: string) => sha256(token);

// ---------------------------------------------------------------------------
//  Párování
// ---------------------------------------------------------------------------

const pairableInclude = { registeredCompany: { select: { id: true, companyName: true, ico: true, productScope: true, closedAt: true } } } as const;

/** Uživatel, který smí spárovat aplikaci: aktivní účet registrované firmy Správy závodů se závodem. */
async function pairableUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: pairableInclude });
  if (!user?.accountType || !user.companyId) {
    throw new WorkflowError("FORBIDDEN", "Aplikace pro Windows, iOS a Android jsou pro účty registrovaných firem Správy závodů – obchodní demo je nepáruje.");
  }
  const company = user.registeredCompany;
  if (user.disabledAt || !user.homePlantId || !company || company.closedAt || company.productScope !== "PLANT_MANAGEMENT") {
    throw new WorkflowError("FORBIDDEN", "Účet nemůže párovat aplikace (zablokovaný účet, zrušená firma nebo účet bez závodu).");
  }
  return { ...user, registeredCompany: company };
}

/** Nový kód párování (10 minut). Starší nepoužitý kód uživatele přestane platit. */
export async function createPairingCode(prisma: PrismaClient, input: { userId: string }, now: Date = new Date()) {
  const user = await pairableUser(prisma, input.userId);
  const active = await prisma.syncDevice.count({ where: { userId: user.id, revokedAt: null } });
  if (active >= SYNC_POLICY.maxDevicesPerUser) {
    throw new WorkflowError("CONFLICT", `Máte spárováno ${active} zařízení (nejvýš ${SYNC_POLICY.maxDevicesPerUser}) – nejdřív některé odpojte.`);
  }
  const code = pairingCodeFrom(randomBytes(PAIRING_CODE_LENGTH));
  const expiresAt = new Date(now.getTime() + SYNC_POLICY.pairingTtlMinutes * 60_000);
  await prisma.$transaction([
    prisma.syncPairing.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    prisma.syncPairing.create({ data: { userId: user.id, codeHash: pairingHash(code), expiresAt, createdAt: now } }),
  ]);
  return { code: formatPairingCode(code), expiresAt };
}

export interface PairDeviceInput {
  code: string;
  name: string;
  platform: SyncPlatform;
  appVersion?: string | null;
  ipKey?: string | null;
}

const PAIR_FAILED = "Kód neplatí nebo vypršel – v „Můj účet“ → „Aplikace a zařízení“ vytvořte nový.";

/** Spáruje aplikaci kódem z „Můj účet“: vrací token zařízení (jen teď – v DB je jeho SHA-256). */
export async function pairDevice(prisma: PrismaClient, input: PairDeviceInput, now: Date = new Date()) {
  if (input.ipKey) {
    const since = new Date(now.getTime() - SYNC_POLICY.pairFailureWindowMinutes * 60_000);
    const failures = await prisma.securityEvent.count({ where: { kind: "DEVICE_PAIR_FAILED", ipKey: input.ipKey, createdAt: { gt: since } } });
    if (failures >= SYNC_POLICY.maxPairFailuresPerIp) {
      throw new SyncError("RATE_LIMITED", `Příliš mnoho chybných kódů – zkuste to za ${SYNC_POLICY.pairFailureWindowMinutes} minut.`, 429);
    }
  }
  const code = normalizePairingCode(input.code);
  const pairing = code ? await prisma.syncPairing.findUnique({ where: { codeHash: pairingHash(code) }, include: { user: { select: { companyId: true } } } }) : null;
  const fail = async (detail: string) => {
    // Použitý nebo prošlý kód patří uživateli firmy – pokus se ukáže i v bezpečnostním deníku firmy
    await recordSecurityEvent(prisma, { kind: "DEVICE_PAIR_FAILED", userId: pairing?.userId ?? null, companyId: pairing?.user.companyId ?? null, ipKey: input.ipKey, detail }, now);
    return new WorkflowError("NOT_FOUND", PAIR_FAILED);
  };
  if (!pairing) throw await fail(code ? "neznámý kód" : "neplatný formát kódu");
  if (pairing.usedAt) throw await fail("kód už byl použit");
  if (pairing.expiresAt <= now) throw await fail("kód vypršel");

  const user = await pairableUser(prisma, pairing.userId);
  const name = input.name.trim().slice(0, 80) || SYNC_PLATFORM_LABELS[input.platform];
  const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const device = await prisma.$transaction(async (tx) => {
    // Dva souběžné požadavky se stejným kódem: projde jen první (zápisy SQLite jsou za sebou)
    const claimed = await tx.syncPairing.updateMany({ where: { id: pairing.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) throw new WorkflowError("NOT_FOUND", PAIR_FAILED);
    const created = await tx.syncDevice.create({
      data: { userId: user.id, companyId: user.registeredCompany.id, name, platform: input.platform, appVersion: input.appVersion?.trim().slice(0, 40) || null, tokenHash: deviceTokenHash(token), createdAt: now, lastSeenAt: now },
      select: { id: true, name: true, platform: true, createdAt: true },
    });
    await tx.syncPairing.update({ where: { id: pairing.id }, data: { deviceId: created.id } });
    return created;
  });
  await recordSecurityEvent(prisma, { kind: "DEVICE_PAIRED", userId: user.id, companyId: user.registeredCompany.id, actorId: user.id, email: user.email, ipKey: input.ipKey, detail: `${SYNC_PLATFORM_LABELS[device.platform]} · ${device.name}` }, now);
  return { token, device, user: { id: user.id, name: user.name } };
}

// ---------------------------------------------------------------------------
//  Token zařízení
// ---------------------------------------------------------------------------

export interface DeviceContext {
  device: { id: string; name: string; platform: SyncPlatform; appVersion: string | null; createdAt: Date; lastPullAt: Date | null; lastPushAt: Date | null; lastCursor: number | null };
  user: { id: string; name: string; email: string; title: string | null; role: UserRole; accountType: AccountType; scopeLayers: string | null };
  company: { id: string; companyName: string; ico: string };
  /** Dostupné závody (registrovaná firma = svůj závod). */
  plantIds: string[];
  /** Výřez kategorií účtu (`null` = všechna zařízení). */
  visibleTypes: EquipmentType[] | null;
  layers: LayerKey[];
  permissions: readonly Permission[];
  /** Workflow aktér pro služby. */
  actor: { id: string; role: UserRole };
  /** Vlastník souborů (firma). */
  owner: FileOwner;
}

/**
 * Ověří token zařízení z hlavičky `Authorization: Bearer`. Neplatný, odpojený nebo vypršelý token, zablokovaný
 * či odebraný uživatel a zrušená firma = `null` (401). „Naposledy viděno“ se zapisuje nejvýš 1× za 5 minut.
 */
export async function authenticateDevice(prisma: PrismaClient, token: string | null | undefined, now: Date = new Date()): Promise<DeviceContext | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const device = await prisma.syncDevice.findUnique({ where: { tokenHash: deviceTokenHash(token) }, include: { user: { include: pairableInclude } } });
  if (!device || device.revokedAt) return null;
  if (now.getTime() - device.lastSeenAt.getTime() > SYNC_POLICY.idleExpiryDays * DAY_MS) return null;
  const { user } = device;
  const company = user.registeredCompany;
  if (!user.accountType || user.disabledAt || user.companyId !== device.companyId || !user.homePlantId) return null;
  if (!company || company.closedAt || company.productScope !== "PLANT_MANAGEMENT") return null;
  if (now.getTime() - device.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.syncDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  const account = { accountType: user.accountType, scopeLayers: user.scopeLayers };
  return {
    device: { id: device.id, name: device.name, platform: device.platform, appVersion: device.appVersion, createdAt: device.createdAt, lastPullAt: device.lastPullAt, lastPushAt: device.lastPushAt, lastCursor: device.lastCursor },
    user: { id: user.id, name: user.name, email: user.email, title: user.title, role: user.role, accountType: user.accountType, scopeLayers: user.scopeLayers },
    company: { id: company.id, companyName: company.companyName, ico: company.ico },
    plantIds: [user.homePlantId],
    visibleTypes: visibleTypes(account),
    layers: accountLayers(account),
    permissions: ACCOUNT_TYPES[user.accountType].permissions,
    actor: { id: user.id, role: user.role },
    owner: companyOwner(company.id),
  };
}

export const canDevice = (ctx: DeviceContext, permission: Permission) => ctx.permissions.includes(permission);

/** Prisma filtr výřezu účtu pro zařízení (`{}` = vše). */
export const deviceEquipmentScope = (ctx: DeviceContext): Prisma.EquipmentWhereInput => (ctx.visibleTypes ? { type: { in: ctx.visibleTypes } } : {});

// ---------------------------------------------------------------------------
//  Relace aplikace (bootstrap)
// ---------------------------------------------------------------------------

const EPOCH_KEY = "sync.epoch";

/**
 * Epocha žurnálu: náhodný identifikátor databáze. Po obnově zálohy se mění (`npm run sync:setup -- --new-epoch`) –
 * aplikace pak stáhnou vše znovu (jejich kurzory patří ke staré větvi žurnálu).
 */
export async function syncEpoch(prisma: Prisma.TransactionClient): Promise<string> {
  const current = await prisma.tenantSetting.findUnique({ where: { key: EPOCH_KEY } });
  if (current) return current.value;
  const value = randomBytes(6).toString("hex");
  await prisma.tenantSetting.upsert({ where: { key: EPOCH_KEY }, update: {}, create: { key: EPOCH_KEY, value } });
  return (await prisma.tenantSetting.findUniqueOrThrow({ where: { key: EPOCH_KEY } })).value;
}

export async function rotateSyncEpoch(prisma: PrismaClient): Promise<string> {
  const value = randomBytes(6).toString("hex");
  await prisma.tenantSetting.upsert({ where: { key: EPOCH_KEY }, update: { value }, create: { key: EPOCH_KEY, value } });
  return value;
}

/** Otisk toho, co zařízení vidí (epocha, verze dat, firma, závody, výřez) – změna = aplikace stáhne vše znovu. */
export function scopeKeyOf(ctx: Pick<DeviceContext, "company" | "plantIds" | "visibleTypes">, epoch: string): string {
  const payload = JSON.stringify({ epoch, schema: SYNC_SCHEMA_VERSION, company: ctx.company.id, plants: [...ctx.plantIds].sort(), types: ctx.visibleTypes ? [...ctx.visibleTypes].sort() : null });
  return sha256(payload).slice(0, 20);
}

/** Odpověď `GET /api/sync/v1/session`: kdo je přihlášen, co vidí a smí, závod, moduly a pravidla synchronizace. */
export async function deviceSession(prisma: PrismaClient, ctx: DeviceContext, now: Date = new Date()) {
  const [plants, config, epoch, counter] = await Promise.all([
    prisma.plant.findMany({ where: { id: { in: ctx.plantIds } }, select: { id: true, code: true, name: true, city: true }, orderBy: { code: "asc" } }),
    loadModuleConfig(prisma),
    syncEpoch(prisma),
    prisma.syncCounter.findUnique({ where: { id: 1 } }),
  ]);
  return {
    api: SYNC_API,
    version: SYNC_API_VERSION,
    schema: SYNC_SCHEMA_VERSION,
    serverTime: now.toISOString(),
    scope: scopeKeyOf(ctx, epoch),
    device: { id: ctx.device.id, name: ctx.device.name, platform: ctx.device.platform, appVersion: ctx.device.appVersion, pairedAt: ctx.device.createdAt, lastPullAt: ctx.device.lastPullAt, lastPushAt: ctx.device.lastPushAt },
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      title: ctx.user.title,
      accountType: ctx.user.accountType,
      accountLabel: ACCOUNT_TYPES[ctx.user.accountType].label,
      permissions: ctx.permissions,
      layers: ctx.layers,
      visibleTypes: ctx.visibleTypes,
    },
    company: { id: ctx.company.id, name: ctx.company.companyName, ico: ctx.company.ico },
    plants,
    features: effectiveFeatures(config),
    entities: SYNC_ENTITIES,
    mutations: SYNC_MUTATION_TYPES,
    policy: {
      staleAfterHours: SYNC_POLICY.staleAfterHours,
      idleExpiryDays: SYNC_POLICY.idleExpiryDays,
      maxBatch: SYNC_POLICY.maxBatch,
      defaultPageSize: SYNC_POLICY.defaultPageSize,
      maxPageSize: SYNC_POLICY.maxPageSize,
      tombstoneDays: SYNC_POLICY.tombstoneDays,
    },
    journal: { head: counter?.value ?? 0 },
  };
}

// ---------------------------------------------------------------------------
//  Stahování změn
// ---------------------------------------------------------------------------

type Row = Record<string, unknown> & { id: string };
type Reader = (prisma: Prisma.TransactionClient, ids: string[]) => Promise<Row[]>;

/** Data synchronizovaných záznamů. Uživatelé jen jméno a role (bez e-mailu, hesla a tajemství). */
const READERS: Record<SyncEntity, Reader> = {
  Plant: (prisma, ids) => prisma.plant.findMany({ where: { id: { in: ids } } }),
  Building: (prisma, ids) => prisma.building.findMany({ where: { id: { in: ids } } }),
  Floor: (prisma, ids) => prisma.floor.findMany({ where: { id: { in: ids } } }),
  Equipment: (prisma, ids) => prisma.equipment.findMany({ where: { id: { in: ids } } }),
  ComplianceDocument: (prisma, ids) => prisma.complianceDocument.findMany({ where: { id: { in: ids } } }),
  InspectionRecord: (prisma, ids) => prisma.inspectionRecord.findMany({ where: { id: { in: ids } } }),
  InspectionDefect: (prisma, ids) => prisma.inspectionDefect.findMany({ where: { id: { in: ids } } }),
  DocumentRevision: (prisma, ids) => prisma.documentRevision.findMany({ where: { id: { in: ids } } }),
  BomItem: (prisma, ids) => prisma.bomItem.findMany({ where: { id: { in: ids } } }),
  SchematicReference: (prisma, ids) => prisma.schematicReference.findMany({ where: { id: { in: ids } } }),
  ChangeRequest: (prisma, ids) => prisma.changeRequest.findMany({ where: { id: { in: ids } } }),
  Attachment: (prisma, ids) => prisma.attachment.findMany({ where: { id: { in: ids } } }),
  ChangeRequestEvent: (prisma, ids) => prisma.changeRequestEvent.findMany({ where: { id: { in: ids } } }),
  TemporaryModification: (prisma, ids) => prisma.temporaryModification.findMany({ where: { id: { in: ids } } }),
  EquipmentDocument: (prisma, ids) => prisma.equipmentDocument.findMany({ where: { id: { in: ids } } }),
  SoftwareBackup: (prisma, ids) => prisma.softwareBackup.findMany({ where: { id: { in: ids } } }),
  MonitoredComponent: (prisma, ids) => prisma.monitoredComponent.findMany({ where: { id: { in: ids } } }),
  User: (prisma, ids) =>
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, role: true, accountType: true, title: true, companyId: true, homePlantId: true, disabledAt: true },
    }),
};

export interface SyncChangeEntry {
  entity: SyncEntity;
  id: string;
  op: "upsert" | "delete";
  seq: number;
  data?: Row;
}

export interface PullResult {
  /** Kurzor pro další dotaz (`cursor=`). */
  cursor: number;
  hasMore: boolean;
  /** Aplikace musí smazat místní data a stáhnout vše od kurzoru 0 (změna výřezu, verze dat, epochy, prošlý kurzor). */
  reset: boolean;
  scope: string;
  changes: SyncChangeEntry[];
  /** Otisky souborů, na které změny odkazují (registr fáze 68). */
  files: Record<string, { sha256: string | null; size: number; mime: string }>;
  serverTime: string;
}

interface JournalRow {
  entity: string;
  entityId: string;
  seq: number | bigint;
  deleted: number | boolean | bigint;
  equipmentId: string | null;
  equipmentType: string | null;
}

const isEntity = (value: string): value is SyncEntity => (SYNC_ENTITIES as readonly string[]).includes(value);

type PullInput = { cursor: number; limit?: number; scope?: string | null };

/**
 * Změny od kurzoru (`cursor = 0` = první stažení celého závodu, bez značek smazání). Stránka nikdy nerozdělí
 * změny se stejným pořadím. Záznam mimo výřez kategorií účtu přijde jako smazání (aplikace ho zahodí).
 *
 * Čte se v transakci: adaptér SQLite má jediné spojení a dotaz mimo transakci vidí i nepotvrzené zápisy cizí otevřené
 * transakce (ověřeno) – po jejím vrácení by aplikace měla data, která neexistují, a kurzor za pořadím, které čítač
 * použije znovu (změny by přeskočila). Vlastní transakce počká, až cizí skončí. Chyba čtení transakci nevrací
 * (zápisy jiných požadavků, které do ní během čtení spadly, zůstanou).
 */
export async function pullChanges(prisma: PrismaClient, ctx: DeviceContext, input: PullInput, now: Date = new Date()): Promise<PullResult> {
  const outcome = await prisma.$transaction(
    async (tx) => {
      try {
        return { page: await readChanges(tx, ctx, input, now) };
      } catch (error) {
        return { error };
      }
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
  if ("error" in outcome) throw outcome.error;
  const { page } = outcome;
  if (!page.reset) await prisma.syncDevice.update({ where: { id: ctx.device.id }, data: { lastCursor: page.cursor, ...(page.hasMore ? {} : { lastPullAt: now }) } }).catch(() => undefined);
  return page;
}

async function readChanges(prisma: Prisma.TransactionClient, ctx: DeviceContext, input: PullInput, now: Date): Promise<PullResult> {
  const [epoch, counter] = await Promise.all([syncEpoch(prisma), prisma.syncCounter.findUnique({ where: { id: 1 } })]);
  const scope = scopeKeyOf(ctx, epoch);
  const head = counter?.value ?? 0;
  const cursor = Math.max(0, Math.floor(input.cursor));
  const base = { scope, files: {}, changes: [], serverTime: now.toISOString() };
  // Kurzor z jiného výřezu / epochy, před smazanými značkami nebo „z budoucnosti“ (jiná databáze) → vše znovu
  if (cursor > 0 && (input.scope !== scope || cursor < (counter?.prunedSeq ?? 0) || cursor > head)) return { ...base, cursor: 0, hasMore: true, reset: true };

  const limit = Math.min(SYNC_POLICY.maxPageSize, Math.max(1, Math.floor(input.limit ?? SYNC_POLICY.defaultPageSize)));
  const plants = Prisma.join(ctx.plantIds);
  const live = cursor === 0 ? Prisma.sql`AND c."deleted" = 0` : Prisma.empty;
  const where = Prisma.sql`c."seq" > ${cursor} AND (c."plantId" IN (${plants}) OR c."companyId" = ${ctx.company.id}) ${live}`;
  const edge = await prisma.$queryRaw<{ seq: number | bigint }[]>`SELECT c."seq" FROM "SyncChange" c WHERE ${where} ORDER BY c."seq" LIMIT 1 OFFSET ${limit - 1}`;
  const boundary = edge.length ? Number(edge[0].seq) : null;
  const upTo = boundary === null ? Prisma.empty : Prisma.sql`AND c."seq" <= ${boundary}`;
  const rows = await prisma.$queryRaw<JournalRow[]>`SELECT c."entity", c."entityId", c."seq", c."deleted", c."equipmentId", e."type" AS "equipmentType" FROM "SyncChange" c LEFT JOIN "Equipment" e ON e."id" = c."equipmentId" WHERE ${where} ${upTo} ORDER BY c."seq"`;
  const hasMore =
    boundary !== null &&
    (await prisma.$queryRaw<{ one: number }[]>`SELECT 1 AS "one" FROM "SyncChange" c WHERE c."seq" > ${boundary} AND (c."plantId" IN (${plants}) OR c."companyId" = ${ctx.company.id}) ${live} LIMIT 1`).length > 0;

  const entries: SyncChangeEntry[] = [];
  const wanted = new Map<SyncEntity, string[]>();
  for (const row of rows) {
    if (!isEntity(row.entity)) continue;
    const seq = Number(row.seq);
    const hidden = row.equipmentId !== null && (row.equipmentType === null || (ctx.visibleTypes !== null && !ctx.visibleTypes.includes(row.equipmentType as EquipmentType)));
    if (Number(row.deleted) || hidden) {
      if (cursor > 0) entries.push({ entity: row.entity, id: row.entityId, op: "delete", seq });
      continue;
    }
    entries.push({ entity: row.entity, id: row.entityId, op: "upsert", seq });
    const list = wanted.get(row.entity);
    if (list) list.push(row.entityId);
    else wanted.set(row.entity, [row.entityId]);
  }
  const data = new Map<string, Row>();
  for (const [entity, ids] of wanted) for (const record of await READERS[entity](prisma, ids)) data.set(`${entity}:${record.id}`, record);
  const changes: SyncChangeEntry[] = [];
  for (const entry of entries) {
    if (entry.op === "delete") {
      changes.push(entry);
      continue;
    }
    const record = data.get(`${entry.entity}:${entry.id}`);
    // Záznam smazaný mezi čtením žurnálu a dat: jeho značka smazání přijde v další stránce – teď ho rovnou smazat
    if (record) changes.push({ ...entry, data: record });
    else if (cursor > 0) changes.push({ entity: entry.entity, id: entry.id, op: "delete", seq: entry.seq });
  }

  const urls = [...new Set(changes.flatMap((change) => (change.data ? collectFileUrls(change.data) : [])))];
  const stored = urls.length ? await prisma.storedFile.findMany({ where: { url: { in: urls }, deletedAt: null }, select: { url: true, sha256: true, sizeBytes: true, mimeType: true } }) : [];
  const files = Object.fromEntries(stored.map((file) => [file.url, { sha256: file.sha256, size: file.sizeBytes, mime: file.mimeType }]));

  const last = rows.length ? Number(rows[rows.length - 1].seq) : cursor;
  // Bez další stránky = zařízení má vše do hlavy žurnálu (změny jiných závodů přeskočí)
  const next = boundary !== null && hasMore ? boundary : Math.max(last, head);
  return { cursor: next, hasMore, reset: false, scope, changes, files, serverTime: now.toISOString() };
}

// ---------------------------------------------------------------------------
//  Správa zařízení
// ---------------------------------------------------------------------------

/** Odpojí zařízení: vlastní (uživatel, aplikace) nebo kterékoli zařízení firmy (technický ředitel). */
export async function revokeDevice(prisma: PrismaClient, input: { deviceId: string; actorId: string; companyId: string; admin: boolean; reason: string }, now: Date = new Date()) {
  const device = await prisma.syncDevice.findFirst({
    where: { id: input.deviceId, companyId: input.companyId, ...(input.admin ? {} : { userId: input.actorId }) },
    select: { id: true, userId: true, name: true, platform: true, revokedAt: true },
  });
  if (!device) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  if (device.revokedAt) return { id: device.id, name: device.name, already: true };
  await prisma.syncDevice.update({ where: { id: device.id }, data: { revokedAt: now, revokedById: input.actorId, revokedReason: input.reason.slice(0, 120) } });
  await recordSecurityEvent(prisma, { kind: "DEVICE_REVOKED", userId: device.userId, companyId: input.companyId, actorId: input.actorId, detail: `${SYNC_PLATFORM_LABELS[device.platform]} · ${device.name} (${input.reason})` }, now);
  return { id: device.id, name: device.name, already: false };
}

/** Soubor firmy se stejným obsahem (nahrání z aplikace po výpadku spojení = žádný duplikát). */
export function findCompanyFileBySha(prisma: PrismaClient, input: { companyId: string; sha256: string; kind: string }) {
  return prisma.storedFile.findFirst({
    where: { ownerKind: "COMPANY", companyId: input.companyId, sha256: input.sha256, kind: input.kind, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { url: true, sha256: true, sizeBytes: true, mimeType: true, originalName: true },
  });
}

// ---------------------------------------------------------------------------
//  Retence
// ---------------------------------------------------------------------------

export interface SyncRetentionSummary {
  syncTombstones: number;
  syncMutations: number;
  syncDevices: number;
  syncPairings: number;
}

/**
 * Úklid synchronizace: značky smazání v žurnálu (90 dní – starší kurzor = `reset`), evidence úprav (90 dní),
 * odpojená a vypršelá zařízení (30 dní po odpojení / vypršení), kódy párování (1 den).
 */
export async function pruneSync(prisma: PrismaClient, now: Date = new Date()): Promise<SyncRetentionSummary> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const tombstones = { deleted: true, changedAt: { lt: before(SYNC_POLICY.tombstoneDays) } };
  const pruned = await prisma.syncChange.aggregate({ where: tombstones, _max: { seq: true } });
  let syncTombstones = 0;
  if (pruned._max.seq !== null) {
    syncTombstones = (await prisma.syncChange.deleteMany({ where: tombstones })).count;
    await prisma.$executeRaw`UPDATE "SyncCounter" SET "prunedSeq" = MAX("prunedSeq", ${pruned._max.seq}) WHERE "id" = 1`;
  }
  const syncMutations = (await prisma.syncMutation.deleteMany({ where: { receivedAt: { lt: before(SYNC_POLICY.mutationDays) } } })).count;
  const syncDevices = (
    await prisma.syncDevice.deleteMany({
      where: { OR: [{ revokedAt: { lt: before(SYNC_POLICY.revokedDeviceDays) } }, { revokedAt: null, lastSeenAt: { lt: before(SYNC_POLICY.idleExpiryDays + SYNC_POLICY.revokedDeviceDays) } }] },
    })
  ).count;
  const syncPairings = (await prisma.syncPairing.deleteMany({ where: { createdAt: { lt: before(SYNC_POLICY.pairingDays) } } })).count;
  return { syncTombstones, syncMutations, syncDevices, syncPairings };
}
