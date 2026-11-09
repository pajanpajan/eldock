// Fáze 70: úpravy z aplikací (fronta offline) – záměry, které projdou stejnými službami a pravidly jako web
// (oprávnění účtu, závod a výřez kategorií, vlastník souborů). Každá úprava proběhne přesně jednou: zapisuje se
// v jedné transakci se záznamem `SyncMutation` (id úpravy z aplikace je unikátní pro uživatele). Odmítnutá úprava
// se eviduje taky – opakované odeslání vrátí stejný výsledek. Záměrně bez `server-only` (testy nad SQLite).

import { z } from "zod";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ACCOUNT_TYPES, PERMISSION_LABELS, type Permission } from "@/lib/accounts";
import { CLIENT_ID_PATTERN, SYNC_MUTATION_LABELS, SYNC_POLICY, effectivePerformedAt, type SyncMutationType } from "@/lib/sync";
import { SYNC_MUTATION_PERMISSIONS, SYNC_MUTATION_SCHEMAS, type AttachmentPayload } from "@/lib/sync-mutations";
import { OPEN_STATUSES, WorkflowError } from "@/lib/workflow/state-machine";
import { setEquipmentPhoto } from "@/server/services/equipment-card";
import { assertFileClaims } from "@/server/services/file-registry";
import { resolveDefect } from "@/server/services/inspection";
import { replaceMonitoredComponent } from "@/server/services/lifespan";
import { SyncError, canDevice, deviceEquipmentScope, type DeviceContext } from "@/server/services/sync";
import { assertAccessible, type EntityKind } from "@/server/services/tenant-access";
import { createTemporaryMod, resolveAsOneToOne } from "@/server/services/temporary-mod";
import { addCommentInTx, submitChangeRequestInTx } from "@/server/services/workflow";

import type { SyncEntity } from "./journal";

/**
 * Interaktivní transakce jako klient Prismy: služby, které samy volají `prisma.$transaction(…)`, poběží uvnitř
 * vnější transakce (vnořená transakce = stejná transakce). Úprava a její evidence se tak zapíší najednou.
 */
export function flatTransaction(tx: Prisma.TransactionClient): PrismaClient {
  const client = new Proxy(tx, {
    get(target, property) {
      if (property === "$transaction") {
        return (arg: unknown) => (typeof arg === "function" ? (arg as (inner: PrismaClient) => Promise<unknown>)(client) : Promise.all(arg as Promise<unknown>[]));
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  }) as unknown as PrismaClient;
  return client;
}

// ---------------------------------------------------------------------------
//  Definice úprav
// ---------------------------------------------------------------------------

interface Applied {
  entity: SyncEntity;
  entityId: string;
  result?: Record<string, unknown>;
}

type BaseKind = "equipment" | "temporaryMod" | "defect" | "monitoredComponent";

interface Spec<T> {
  /** Stačí jedno z oprávnění (prázdné = každý účet, který záznam vidí – jako komentář na webu). */
  permissions: readonly Permission[];
  /** Záznamy ze vstupu – musí ležet v závodě zařízení a ve výřezu účtu. */
  refs: (input: T) => [EntityKind, string][];
  /** Soubory ze vstupu – jen soubory firmy (vzorové a sdílené kdokoli). */
  files?: (input: T) => (string | null | undefined)[];
  /** Záznam pro kontrolu souběhu: `baseUpdatedAt` z aplikace ≠ `updatedAt` na serveru → CONFLICT. */
  base?: (input: T) => [BaseKind, string];
  apply: (db: PrismaClient, ctx: DeviceContext, input: T, at: Date) => Promise<Applied>;
}

export interface MutationHandler {
  /** Ověří vstup, oprávnění, přístup a soubory (mimo transakci) a vrátí provedení úpravy v transakci. */
  prepare(prisma: PrismaClient, ctx: DeviceContext, payload: unknown, options: { baseUpdatedAt: string | null; at: Date }): Promise<(db: PrismaClient) => Promise<Applied>>;
}

const UPDATED_AT: Record<BaseKind, (db: PrismaClient, id: string) => Promise<{ updatedAt: Date } | null>> = {
  equipment: (db, id) => db.equipment.findUnique({ where: { id }, select: { updatedAt: true } }),
  temporaryMod: (db, id) => db.temporaryModification.findUnique({ where: { id }, select: { updatedAt: true } }),
  defect: (db, id) => db.inspectionDefect.findUnique({ where: { id }, select: { updatedAt: true } }),
  monitoredComponent: (db, id) => db.monitoredComponent.findUnique({ where: { id }, select: { updatedAt: true } }),
};

async function checkBase(db: PrismaClient, [kind, id]: [BaseKind, string], baseUpdatedAt: string) {
  const base = new Date(baseUpdatedAt);
  if (Number.isNaN(base.getTime())) throw new WorkflowError("VALIDATION", "Neplatný čas baseUpdatedAt.");
  const record = await UPDATED_AT[kind](db, id);
  if (record && record.updatedAt.getTime() !== base.getTime()) {
    const when = record.updatedAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" });
    throw new WorkflowError("CONFLICT", `Záznam mezitím změnil někdo jiný (${when}) – stáhněte změny a úpravu zopakujte.`);
  }
}

function define<S extends z.ZodType>(schema: S, spec: Spec<z.infer<S>>): MutationHandler {
  return {
    async prepare(prisma, ctx, payload, options) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new WorkflowError("VALIDATION", `Neplatná data úpravy${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "chybný formát"}.`);
      }
      const input = parsed.data;
      if (spec.permissions.length && !spec.permissions.some((permission) => canDevice(ctx, permission))) {
        throw new WorkflowError("FORBIDDEN", `Účet ${ACCOUNT_TYPES[ctx.user.accountType].label} nemá oprávnění: ${spec.permissions.map((permission) => PERMISSION_LABELS[permission]).join(" nebo ")}.`);
      }
      const plant = { id: { in: ctx.plantIds } };
      for (const [kind, id] of spec.refs(input)) await assertAccessible(prisma, kind, id, plant, deviceEquipmentScope(ctx));
      if (spec.files) await assertFileClaims(prisma, spec.files(input), ctx.owner);
      return async (db) => {
        // Souběh až v transakci (zápisy SQLite jdou za sebou – mezi kontrolou a zápisem nikdo jiný nezapíše)
        if (spec.base && options.baseUpdatedAt) await checkBase(db, spec.base(input), options.baseUpdatedAt);
        return spec.apply(db, ctx, input, options.at);
      };
    },
  };
}

// Schémata dat úprav sdílí server s aplikacemi (fáze 71: `lib/sync-mutations.ts`) – tady jen pravidla a provedení.
const attachmentFiles = (attachments: AttachmentPayload[] | undefined) => (attachments ?? []).flatMap((item) => [item.url, item.originalUrl]);
const S = SYNC_MUTATION_SCHEMAS;
const P = SYNC_MUTATION_PERMISSIONS;

export const SYNC_MUTATIONS: Record<SyncMutationType, MutationHandler> = {
  "changeRequest.submit": define(S["changeRequest.submit"], {
    permissions: P["changeRequest.submit"],
    refs: (input) => [["equipment", input.equipmentId]],
    files: (input) => [input.markupImageUrl, ...attachmentFiles(input.attachments)],
    async apply(db, ctx, input, at) {
      // Zařízení má max. 1 otevřený požadavek: zadání z haly (offline mohl změnu mezitím nahlásit kolega) se připojí
      // k otevřenému požadavku jako komentář s přílohami – práce technika se neztratí.
      const open = await db.changeRequest.findFirst({ where: { equipmentId: input.equipmentId, status: { in: [...OPEN_STATUSES] } }, select: { id: true, number: true } });
      if (open) {
        const lines = [input.note?.trim(), input.voiceTranscript?.trim() ? `Hlasová poznámka: ${input.voiceTranscript.trim()}` : null].filter(Boolean);
        const attachments = [...(input.attachments ?? []), ...(input.markupImageUrl ? [{ url: input.markupImageUrl, type: "MARKUP_IMAGE" as const, fileName: "zakres.png" }] : [])];
        await addCommentInTx(db, ctx.actor, {
          changeRequestId: open.id,
          comment: `${lines.length ? lines.join("\n") : "Doplnění z aplikace."}\n(Zadáno v aplikaci jako nová změna – zařízení už mělo otevřený požadavek ${open.number}.)`,
          attachments,
        });
        return { entity: "ChangeRequest", entityId: open.id, result: { number: open.number, merged: true } };
      }
      const created = await submitChangeRequestInTx(db, ctx.actor, { ...input, now: at });
      return { entity: "ChangeRequest", entityId: created.id, result: { number: created.number, merged: false } };
    },
  }),
  "changeRequest.comment": define(S["changeRequest.comment"], {
    permissions: P["changeRequest.comment"],
    refs: (input) => [["changeRequest", input.changeRequestId]],
    files: (input) => attachmentFiles(input.attachments),
    async apply(db, ctx, input) {
      const changeRequest = await addCommentInTx(db, ctx.actor, input);
      return { entity: "ChangeRequest", entityId: changeRequest.id, result: { number: changeRequest.number } };
    },
  }),
  "temporaryMod.create": define(
    S["temporaryMod.create"],
    {
      permissions: P["temporaryMod.create"],
      refs: (input) => [["equipment", input.equipmentId]],
      files: (input) => [input.photoUrl],
      async apply(db, ctx, input, at) {
        const mod = await createTemporaryMod(db, ctx.actor, input, at);
        return { entity: "TemporaryModification", entityId: mod.id, result: { number: mod.number, expiresAt: mod.expiresAt.toISOString() } };
      },
    },
  ),
  "temporaryMod.restore": define(S["temporaryMod.restore"], {
    permissions: P["temporaryMod.restore"],
    refs: (input) => [["temporaryMod", input.temporaryModId]],
    base: (input) => ["temporaryMod", input.temporaryModId],
    async apply(db, ctx, input, at) {
      const mod = await resolveAsOneToOne(db, ctx.actor, { id: input.temporaryModId, note: input.note }, at);
      return { entity: "TemporaryModification", entityId: mod.id, result: { number: mod.number } };
    },
  }),
  "defect.resolve": define(S["defect.resolve"], {
    permissions: P["defect.resolve"],
    refs: (input) => [["defect", input.defectId]],
    files: (input) => [input.photoUrl],
    base: (input) => ["defect", input.defectId],
    async apply(db, ctx, input, at) {
      const defect = await resolveDefect(db, ctx.actor, input, at);
      return { entity: "InspectionDefect", entityId: defect.id };
    },
  }),
  "component.replace": define(S["component.replace"], {
    permissions: P["component.replace"],
    refs: (input) => [
      ["monitoredComponent", input.componentId],
      ["equipment", input.equipmentId],
    ],
    base: (input) => ["monitoredComponent", input.componentId],
    async apply(db, _ctx, input, at) {
      const component = await replaceMonitoredComponent(db, { ...input, now: at });
      return { entity: "MonitoredComponent", entityId: component.id, result: { installedAt: component.installedAt.toISOString(), replacementStockCount: component.replacementStockCount } };
    },
  }),
  "equipment.photo": define(S["equipment.photo"], {
    permissions: P["equipment.photo"],
    refs: (input) => [["equipment", input.equipmentId]],
    files: (input) => [input.photoUrl],
    base: (input) => ["equipment", input.equipmentId],
    async apply(db, _ctx, input) {
      const equipment = await setEquipmentPhoto(db, input.equipmentId, input.photoUrl);
      return { entity: "Equipment", entityId: equipment.id };
    },
  }),
};

const isMutationType = (value: string): value is SyncMutationType => value in SYNC_MUTATION_LABELS;

// ---------------------------------------------------------------------------
//  Odeslání fronty
// ---------------------------------------------------------------------------

const pushSchema = z.object({
  mutations: z
    .array(
      z.object({
        id: z.string().regex(CLIENT_ID_PATTERN),
        type: z.string().min(1).max(60),
        payload: z.unknown(),
        performedAt: z.string().max(40).optional().nullable(),
        baseUpdatedAt: z.string().max(40).optional().nullable(),
      }),
    )
    .min(1)
    .max(SYNC_POLICY.maxBatch),
});
type PushMutation = z.infer<typeof pushSchema>["mutations"][number];

export interface MutationResult {
  id: string;
  /** applied = provedeno · rejected = odmítnuto pravidlem (znovu neposílat) · error = chyba serveru (poslat znovu) */
  status: "applied" | "rejected" | "error";
  /** Úprava už byla zpracována dřív (opakované odeslání) – výsledek je původní. */
  duplicate?: boolean;
  code?: string;
  message?: string;
  entity?: string;
  entityId?: string;
  result?: Record<string, unknown>;
}

type MutationRecord = { clientId: string; status: "APPLIED" | "REJECTED"; code: string | null; message: string | null; entity: string | null; entityId: string | null; resultJson: string | null };

function fromRecord(record: MutationRecord, duplicate: boolean): MutationResult {
  return {
    id: record.clientId,
    status: record.status === "APPLIED" ? "applied" : "rejected",
    ...(duplicate ? { duplicate: true } : {}),
    ...(record.code ? { code: record.code } : {}),
    ...(record.message ? { message: record.message } : {}),
    ...(record.entity ? { entity: record.entity } : {}),
    ...(record.entityId ? { entityId: record.entityId } : {}),
    ...(record.resultJson ? { result: JSON.parse(record.resultJson) as Record<string, unknown> } : {}),
  };
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

async function processMutation(prisma: PrismaClient, ctx: DeviceContext, mutation: PushMutation, now: Date): Promise<MutationResult> {
  const key = { userId_clientId: { userId: ctx.user.id, clientId: mutation.id } };
  const known = await prisma.syncMutation.findUnique({ where: key });
  if (known) return fromRecord(known, true);
  const at = effectivePerformedAt(mutation.performedAt, now);
  const base = { userId: ctx.user.id, deviceId: ctx.device.id, clientId: mutation.id, type: mutation.type, performedAt: at, receivedAt: now };

  const reject = async (code: string, message: string): Promise<MutationResult> => {
    try {
      await prisma.syncMutation.create({ data: { ...base, status: "REJECTED", code, message: message.slice(0, 300) } });
    } catch (error) {
      // Souběžné odeslání stejné úpravy (druhé spojení po výpadku) – platí výsledek prvního
      const again = isUniqueViolation(error) ? await prisma.syncMutation.findUnique({ where: key }) : null;
      if (again) return fromRecord(again, true);
      throw error;
    }
    return { id: mutation.id, status: "rejected", code, message };
  };

  if (!isMutationType(mutation.type)) return reject("UNKNOWN_TYPE", `Neznámý druh úpravy „${mutation.type}“ – aktualizujte aplikaci.`);
  try {
    const apply = await SYNC_MUTATIONS[mutation.type].prepare(prisma, ctx, mutation.payload, { baseUpdatedAt: mutation.baseUpdatedAt ?? null, at });
    const applied = await prisma.$transaction(
      async (tx) => {
        const outcome = await apply(flatTransaction(tx));
        await tx.syncMutation.create({
          data: { ...base, status: "APPLIED", entity: outcome.entity, entityId: outcome.entityId, resultJson: outcome.result ? JSON.stringify(outcome.result) : null },
        });
        return outcome;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    return { id: mutation.id, status: "applied", entity: applied.entity, entityId: applied.entityId, ...(applied.result ? { result: applied.result } : {}) };
  } catch (error) {
    if (error instanceof WorkflowError) return reject(error.code, error.message);
    if (isUniqueViolation(error)) {
      const again = await prisma.syncMutation.findUnique({ where: key });
      if (again) return fromRecord(again, true);
      return reject("DUPLICATE_ID", "Záznam s tímto id už existuje – aplikace musí id nového záznamu vygenerovat znovu.");
    }
    console.error(`[sync] Úprava ${mutation.type} z aplikace selhala:`, error);
    return { id: mutation.id, status: "error", message: "Úpravu se nepodařilo zpracovat – aplikace ji odešle znovu." };
  }
}

/** Odeslání fronty úprav (nejvýš `SYNC_POLICY.maxBatch`): v pořadí z aplikace, každá samostatně. */
export async function pushMutations(prisma: PrismaClient, ctx: DeviceContext, raw: unknown, now: Date = new Date()) {
  const parsed = pushSchema.safeParse(raw);
  if (!parsed.success) throw new SyncError("BAD_REQUEST", `Očekávám { "mutations": [...] } s 1–${SYNC_POLICY.maxBatch} úpravami (id, type, payload).`, 400);
  const ids = parsed.data.mutations.map((mutation) => mutation.id);
  if (new Set(ids).size !== ids.length) throw new SyncError("BAD_REQUEST", "Id úprav v jednom odeslání se nesmí opakovat.", 400);
  const results: MutationResult[] = [];
  for (const mutation of parsed.data.mutations) results.push(await processMutation(prisma, ctx, mutation, now));
  await prisma.syncDevice.update({ where: { id: ctx.device.id }, data: { lastPushAt: now } }).catch(() => undefined);
  return { results, serverTime: now.toISOString() };
}
