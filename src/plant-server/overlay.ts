// Fáze 72: úprava z haly na serveru závodu – ověření na místě (schéma, oprávnění účtu, závod a výřez, stav záznamu,
// souběh) a předběžná data, která hned uvidí ostatní zařízení v síti závodu. Cloud pak úpravu provede svými pravidly
// a jeho data předběžná nahradí (odmítnutá úprava se vrátí). Čísla ZM- a PROV- přidělí až cloud.

import { tempModExpiry, TEMP_MOD_ROLE_LABEL } from "@/lib/temporary-mod";
import type { SyncMutationType } from "@/lib/sync";
import { SYNC_MUTATION_SCHEMAS, canMutate, mutationFileUrls } from "@/lib/sync-mutations";
import type { EntityName, PlantUserAccess } from "@/sync-client";

type Row = Record<string, unknown>;

/** Úpravu odmítne už server závodu (do cloudu neodejde). */
export class LocalRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LocalRejection";
  }
}

export interface Effect {
  entity: EntityName;
  id: string;
  data: Row | null;
}

export interface OverlayContext {
  actor: PlantUserAccess;
  relayId: string;
  /** Čas provedení v hale (ověřený jako v cloudu). */
  at: Date;
  baseUpdatedAt: string | null;
  /** Platný záznam viditelný pro účet (jinak null). */
  find: (entity: EntityName, id: string) => Row | null;
  /** Platní potomci (bez ohledu na výřez – rodič už je ověřený). */
  children: (entity: EntityName, parentId: string) => Row[];
  /** Soubor známý serveru závodu (nahraný v hale nebo kopie z cloudu). */
  hasFile: (url: string) => boolean;
  /** Záznam má předběžná data jiné úpravy, o které cloud ještě nerozhodl. */
  pendingOverlay: (entity: EntityName, id: string) => boolean;
}

export const PROVISIONAL_NUMBER = "čeká na cloud";

/** Otevřené stavy požadavku na změnu (= `OPEN_STATUSES` webu; vlastní kopie, aby server závodu netáhl štítky a ikony). */
export const OPEN_CHANGE_STATUSES = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"] as const;

const iso = (date: Date) => date.toISOString();

function required(ctx: OverlayContext, entity: EntityName, id: string, what: string): Row {
  const row = ctx.find(entity, id);
  if (!row) throw new LocalRejection("NOT_FOUND", `${what} nenalezen(o) – v datech serveru závodu není nebo ho váš účet nevidí.`);
  return row;
}

function checkBase(ctx: OverlayContext, row: Row) {
  if (!ctx.baseUpdatedAt || typeof row.updatedAt !== "string") return;
  const base = new Date(ctx.baseUpdatedAt).getTime();
  if (Number.isNaN(base)) throw new LocalRejection("VALIDATION", "Neplatný čas baseUpdatedAt.");
  if (new Date(row.updatedAt).getTime() !== base) throw new LocalRejection("CONFLICT", "Záznam mezitím změnil někdo jiný – stáhněte změny a úpravu zopakujte.");
}

function attachmentRows(ctx: OverlayContext, changeRequestId: string, attachments: Array<Record<string, unknown>> | undefined): Effect[] {
  return (attachments ?? []).map((attachment, index) => ({
    entity: "Attachment" as const,
    id: `prov-${ctx.relayId}-a${index}`,
    data: {
      id: `prov-${ctx.relayId}-a${index}`,
      changeRequestId,
      type: attachment.type ?? "PHOTO",
      url: attachment.url,
      fileName: attachment.fileName ?? null,
      mimeType: attachment.mimeType ?? null,
      sizeBytes: attachment.sizeBytes ?? null,
      caption: attachment.caption ?? null,
      originalUrl: attachment.originalUrl ?? null,
      uploadedById: ctx.actor.id,
      createdAt: iso(ctx.at),
    },
  }));
}

function comment(ctx: OverlayContext, changeRequestId: string, text: string | null | undefined, attachments: Array<Record<string, unknown>> | undefined): Effect[] {
  const id = `prov-${ctx.relayId}-e`;
  return [
    { entity: "ChangeRequestEvent", id, data: { id, changeRequestId, type: "COMMENT", actorId: ctx.actor.id, revisionId: null, fromStatus: null, toStatus: null, comment: text?.trim() || null, createdAt: iso(ctx.at) } },
    ...attachmentRows(ctx, changeRequestId, attachments),
  ];
}

export interface Prepared {
  effects: Effect[];
  /** `baseUpdatedAt` pro cloud: `null`, když úprava staví na předběžné změně kolegy (souběh ověřil server závodu). */
  relayBaseUpdatedAt: string | null;
}

/** Ověří úpravu z haly a vrátí předběžná data; chyba = `LocalRejection`. */
export function prepareHallMutation(type: SyncMutationType, raw: unknown, ctx: OverlayContext): Prepared {
  const parsed = SYNC_MUTATION_SCHEMAS[type].safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new LocalRejection("VALIDATION", `Neplatná data úpravy${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "chybný formát"}.`);
  }
  if (!canMutate(type, ctx.actor.permissions)) throw new LocalRejection("FORBIDDEN", `Účet ${ctx.actor.accountLabel} tuto úpravu zadat nemůže.`);
  for (const url of mutationFileUrls(type, parsed.data)) if (!ctx.hasFile(url)) throw new LocalRejection("VALIDATION", "Fotka k úpravě na serveru závodu není – nahrajte ji znovu.");

  let target: [EntityName, string] | null = null;
  const effects: Effect[] = [];
  switch (type) {
    case "changeRequest.submit": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["changeRequest.submit"]>;
      required(ctx, "Equipment", input.equipmentId, "Zařízení");
      const open = ctx.children("ChangeRequest", input.equipmentId).find((row) => (OPEN_CHANGE_STATUSES as readonly unknown[]).includes(row.status));
      if (open) {
        // Jako cloud: zařízení má otevřený požadavek → zápis z haly se k němu připojí jako komentář
        const lines = [input.note?.trim(), input.voiceTranscript?.trim() ? `Hlasová poznámka: ${input.voiceTranscript.trim()}` : null].filter(Boolean);
        effects.push(...comment(ctx, String(open.id), lines.join("\n") || "Doplnění z aplikace.", input.attachments));
        break;
      }
      const id = input.id ?? `prov-${ctx.relayId}`;
      if (ctx.find("ChangeRequest", id)) throw new LocalRejection("DUPLICATE_ID", "Záznam s tímto id už existuje – aplikace musí id nového záznamu vygenerovat znovu.");
      effects.push({
        entity: "ChangeRequest",
        id,
        data: {
          id,
          number: PROVISIONAL_NUMBER,
          equipmentId: input.equipmentId,
          status: "SUBMITTED",
          priority: input.priority ?? "NORMAL",
          baseRevisionId: null,
          markupSheet: input.markupSheet ?? 1,
          markupData: input.markupData ?? null,
          markupImageUrl: input.markupImageUrl ?? null,
          voiceTranscript: input.voiceTranscript ?? null,
          note: input.note ?? null,
          reporterId: ctx.actor.id,
          assigneeId: null,
          engineerSummary: null,
          safetyImpact: input.safetyImpact ?? "NONE_1_TO_1",
          requiresSoftwareUpdate: input.requiresSoftwareUpdate ?? false,
          submittedAt: iso(ctx.at),
          assignedAt: null,
          resolvedAt: null,
          closedAt: null,
          updatedAt: iso(ctx.at),
        },
      });
      effects.push(...attachmentRows(ctx, id, input.attachments));
      break;
    }
    case "changeRequest.comment": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["changeRequest.comment"]>;
      required(ctx, "ChangeRequest", input.changeRequestId, "Požadavek na změnu");
      effects.push(...comment(ctx, input.changeRequestId, input.comment, input.attachments));
      break;
    }
    case "temporaryMod.create": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["temporaryMod.create"]>;
      required(ctx, "Equipment", input.equipmentId, "Zařízení");
      const id = input.id ?? `prov-${ctx.relayId}`;
      if (ctx.find("TemporaryModification", id)) throw new LocalRejection("DUPLICATE_ID", "Záznam s tímto id už existuje – aplikace musí id nového záznamu vygenerovat znovu.");
      effects.push({
        entity: "TemporaryModification",
        id,
        data: {
          id,
          equipmentId: input.equipmentId,
          number: PROVISIONAL_NUMBER,
          title: input.title.trim(),
          description: input.description.trim(),
          createdByName: ctx.actor.name,
          createdByRole: input.createdByRole?.trim() || TEMP_MOD_ROLE_LABEL[ctx.actor.role as keyof typeof TEMP_MOD_ROLE_LABEL] || ctx.actor.accountLabel,
          createdAt: iso(ctx.at),
          expiresAt: iso(tempModExpiry(ctx.at, input.days)),
          photoUrl: input.photoUrl ?? null,
          markupJson: null,
          status: "ACTIVE",
          resolvedAt: null,
          resolvedByName: null,
          resolutionNote: null,
          updatedAt: iso(ctx.at),
          spawnedChangeRequestId: null,
        },
      });
      break;
    }
    case "temporaryMod.restore": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["temporaryMod.restore"]>;
      const mod = required(ctx, "TemporaryModification", input.temporaryModId, "Provizorium");
      checkBase(ctx, mod);
      if (mod.status !== "ACTIVE") throw new LocalRejection("INVALID_STATE", "Provizorium už je ukončené.");
      target = ["TemporaryModification", input.temporaryModId];
      effects.push({ entity: "TemporaryModification", id: input.temporaryModId, data: { ...mod, status: "RESTORED_1_TO_1", resolvedAt: iso(ctx.at), resolvedByName: ctx.actor.name, resolutionNote: input.note?.trim() || null } });
      break;
    }
    case "defect.resolve": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["defect.resolve"]>;
      const defect = required(ctx, "InspectionDefect", input.defectId, "Závada");
      checkBase(ctx, defect);
      if (defect.status === "RESOLVED") throw new LocalRejection("INVALID_STATE", "Závada už je odstraněná.");
      target = ["InspectionDefect", input.defectId];
      effects.push({ entity: "InspectionDefect", id: input.defectId, data: { ...defect, status: "RESOLVED", resolvedAt: iso(ctx.at), resolvedBy: ctx.actor.name, resolutionNote: input.note.trim(), resolutionPhotoUrl: input.photoUrl ?? null } });
      break;
    }
    case "component.replace": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["component.replace"]>;
      const component = required(ctx, "MonitoredComponent", input.componentId, "Součástka");
      if (component.equipmentId !== input.equipmentId) throw new LocalRejection("NOT_FOUND", "Součástka k tomuto zařízení nepatří.");
      required(ctx, "Equipment", input.equipmentId, "Zařízení");
      checkBase(ctx, component);
      target = ["MonitoredComponent", input.componentId];
      effects.push({ entity: "MonitoredComponent", id: input.componentId, data: { ...component, installedAt: iso(ctx.at), manualCyclesOffset: 0, replacementStockCount: Math.max(0, Number(component.replacementStockCount ?? 0) - 1) } });
      break;
    }
    case "equipment.photo": {
      const input = parsed.data as import("zod").infer<(typeof SYNC_MUTATION_SCHEMAS)["equipment.photo"]>;
      const equipment = required(ctx, "Equipment", input.equipmentId, "Zařízení");
      checkBase(ctx, equipment);
      target = ["Equipment", input.equipmentId];
      effects.push({ entity: "Equipment", id: input.equipmentId, data: { ...equipment, photoUrl: input.photoUrl } });
      break;
    }
  }
  return { effects, relayBaseUpdatedAt: target && ctx.pendingOverlay(...target) ? null : ctx.baseUpdatedAt };
}
