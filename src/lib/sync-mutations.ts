// Fáze 71: schémata úprav z aplikací (fronta offline) – sdílí je server (`server/sync/mutations.ts`, pravidla
// a provedení) i aplikace (formuláře, ověření před uložením do fronty). Čistý modul bez Prismy a Node API.
// Protokol: `docs/SYNC_API.md` §5.

import { z } from "zod";

import type { Permission } from "@/lib/accounts";
import { CLIENT_ID_PATTERN, type SyncMutationType } from "@/lib/sync";

/** Oprávnění účtu pro úpravu (stačí jedno z nich, prázdné = každý, kdo záznam vidí). */
export const SYNC_MUTATION_PERMISSIONS: Record<SyncMutationType, readonly Permission[]> = {
  "changeRequest.submit": ["submitChange"],
  "changeRequest.comment": [],
  "temporaryMod.create": ["temporaryMods"],
  "temporaryMod.restore": ["temporaryMods"],
  "defect.resolve": ["resolveDefects"],
  "component.replace": ["submitChange", "recordInspection"],
  "equipment.photo": ["submitChange", "recordInspection"],
};

/** Smí účet s danými oprávněními úpravu zadat? */
export const canMutate = (type: SyncMutationType, permissions: readonly string[]) => {
  const required = SYNC_MUTATION_PERMISSIONS[type];
  return required.length === 0 || required.some((permission) => permissions.includes(permission));
};

const id = z.string().min(1).max(64);
/** Id nového záznamu nebo úpravy přidělené aplikací (offline na něj jde navázat další úprava). */
export const clientIdSchema = z.string().regex(CLIENT_ID_PATTERN, "id musí mít 8–64 znaků A–Z, a–z, 0–9, _ nebo -");
const text = (max: number) => z.string().max(max).optional().nullable();

/** Soubory jen z našeho úložiště (nahrané přes `POST /api/sync/v1/files`). */
export const SYNC_FILE_URL_PATTERN = /^\/api\/files\/(photos|revisions|markups|voice)\/[\w./-]+$/;
export const SYNC_PHOTO_URL_PATTERN = /^\/api\/files\/photos\/[\w./-]+$/;
const fileUrl = z.string().max(300).regex(SYNC_FILE_URL_PATTERN, "Neplatná adresa souboru");
const photoUrl = z.string().max(300).regex(SYNC_PHOTO_URL_PATTERN, "Neplatná adresa fotky");

export const ATTACHMENT_TYPES = ["PHOTO", "VOICE_NOTE", "MARKUP_IMAGE", "OTHER"] as const;

export const attachmentSchema = z.object({
  url: fileUrl,
  type: z.enum(ATTACHMENT_TYPES).optional(),
  fileName: text(255),
  mimeType: text(100),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  caption: text(200),
  originalUrl: fileUrl.optional().nullable(),
});
export type AttachmentPayload = z.infer<typeof attachmentSchema>;

export const CHANGE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const SAFETY_IMPACTS = ["NONE_1_TO_1", "OPERATIONAL_ONLY", "SUBSTANTIAL_SAFETY_MOD"] as const;

export const SYNC_MUTATION_SCHEMAS = {
  "changeRequest.submit": z.object({
    /** Id nového požadavku z aplikace (offline na něj jde navázat). */
    id: clientIdSchema.optional(),
    equipmentId: id,
    priority: z.enum(CHANGE_PRIORITIES).optional(),
    markupData: z.string().max(500_000).optional().nullable(),
    markupSheet: z.number().int().positive().optional(),
    markupImageUrl: fileUrl.optional().nullable(),
    voiceTranscript: text(4000),
    note: text(4000),
    attachments: z.array(attachmentSchema).max(20).optional(),
    safetyImpact: z.enum(SAFETY_IMPACTS).optional(),
    requiresSoftwareUpdate: z.boolean().optional(),
  }),
  "changeRequest.comment": z.object({ changeRequestId: id, comment: text(4000), attachments: z.array(attachmentSchema).max(20).optional() }),
  "temporaryMod.create": z.object({
    id: clientIdSchema.optional(),
    equipmentId: id,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(4000),
    days: z.union([z.literal(7), z.literal(14)]),
    photoUrl: photoUrl.optional().nullable(),
    createdByRole: z.string().max(60).optional().nullable(),
  }),
  "temporaryMod.restore": z.object({ temporaryModId: id, note: text(4000) }),
  "defect.resolve": z.object({ defectId: id, note: z.string().min(1).max(4000), photoUrl: photoUrl.optional().nullable() }),
  "component.replace": z.object({ componentId: id, equipmentId: id }),
  "equipment.photo": z.object({ equipmentId: id, photoUrl: photoUrl.nullable() }),
} satisfies Record<SyncMutationType, z.ZodType>;

/** Data úpravy daného druhu (vstup formuláře aplikace). */
export type SyncMutationPayload<T extends SyncMutationType> = z.input<(typeof SYNC_MUTATION_SCHEMAS)[T]>;

/** Adresy souborů v úpravě (nahrávají se před odesláním fronty, server ověří vlastníka). */
export function mutationFileUrls(type: SyncMutationType, payload: unknown): string[] {
  const data = (payload ?? {}) as Record<string, unknown>;
  const attachments = Array.isArray(data.attachments) ? (data.attachments as Array<Record<string, unknown>>) : [];
  const urls = [
    ...(type === "changeRequest.submit" ? [data.markupImageUrl] : []),
    ...(type === "temporaryMod.create" || type === "defect.resolve" || type === "equipment.photo" ? [data.photoUrl] : []),
    ...attachments.flatMap((item) => [item.url, item.originalUrl]),
  ];
  return urls.filter((url): url is string => typeof url === "string" && url.length > 0);
}
