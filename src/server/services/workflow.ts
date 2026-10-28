// Business logika workflow „Zadat změnu → CAE → schválení“. Služby dostávají `prisma`
// a `actor` jako parametr (testovatelné bez cookies, použije je i smoke skript), každá
// změna stavu běží v transakci a zapisuje `ChangeRequestEvent`. Pravidla přechodů jsou
// v `src/lib/workflow/state-machine.ts`. Záměrně bez `server-only` (běží i přes tsx).

import type {
  AttachmentType,
  ChangeRequestPriority,
  ChangeRequestStatus,
  SchematicFormat,
  UserRole,
} from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseMarkup } from "@/lib/markup";
import {
  OPEN_STATUSES,
  WorkflowError,
  assertCanPerform,
  deriveEquipmentStatus,
  formatTicketNumber,
  formatVersion,
  nextTicketSequence,
  nextVersion,
  type VersionBump,
} from "@/lib/workflow/state-machine";

export interface Actor {
  id: string;
  role: UserRole;
}

type Tx = Prisma.TransactionClient;

export interface AttachmentInput {
  url: string;
  type?: AttachmentType;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  caption?: string | null;
}

export interface BomItemInput {
  designation: string;
  description: string;
  manufacturer?: string | null;
  partNumber?: string | null;
  quantity: number;
  unit?: string;
  note?: string | null;
}

// ---------------------------------------------------------------------------
//  Pomocné funkce
// ---------------------------------------------------------------------------

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

async function loadChangeRequest(tx: Tx, changeRequestId: string) {
  const changeRequest = await tx.changeRequest.findUnique({ where: { id: changeRequestId } });
  if (!changeRequest) throw new WorkflowError("NOT_FOUND", "Požadavek na změnu nebyl nalezen.");
  return changeRequest;
}

function attachmentRows(attachments: AttachmentInput[] | undefined, uploadedById: string) {
  return (attachments ?? []).map((attachment) => ({
    type: attachment.type ?? "PHOTO",
    url: attachment.url,
    fileName: attachment.fileName ?? null,
    mimeType: attachment.mimeType ?? null,
    sizeBytes: attachment.sizeBytes ?? null,
    caption: clean(attachment.caption),
    uploadedById,
  }));
}

/** Nastaví stav zařízení podle otevřeného požadavku a ověří invarianty (jinak rollback). */
async function syncEquipment(tx: Tx, equipmentId: string) {
  const [open, activeRevisions] = await Promise.all([
    tx.changeRequest.findMany({ where: { equipmentId, status: { in: [...OPEN_STATUSES] } }, select: { status: true } }),
    tx.documentRevision.count({ where: { equipmentId, status: "ACTIVE" } }),
  ]);
  if (open.length > 1) throw new WorkflowError("INVARIANT", "Zařízení by mělo více otevřených požadavků na změnu.");
  if (activeRevisions > 1) throw new WorkflowError("INVARIANT", "Zařízení by mělo více platných revizí.");
  await tx.equipment.update({ where: { id: equipmentId }, data: { status: deriveEquipmentStatus(open[0]?.status) } });
}

async function addEvent(
  tx: Tx,
  data: {
    changeRequestId: string;
    type: Prisma.ChangeRequestEventCreateManyInput["type"];
    actorId: string;
    from?: ChangeRequestStatus | null;
    to?: ChangeRequestStatus | null;
    revisionId?: string | null;
    comment?: string | null;
    at?: Date;
  },
) {
  await tx.changeRequestEvent.create({
    data: {
      changeRequestId: data.changeRequestId,
      type: data.type,
      actorId: data.actorId,
      fromStatus: data.from ?? null,
      toStatus: data.to ?? null,
      revisionId: data.revisionId ?? null,
      comment: clean(data.comment),
      createdAt: data.at,
    },
  });
}

// ---------------------------------------------------------------------------
//  Údržba: zadání změny
// ---------------------------------------------------------------------------

export interface SubmitChangeRequestInput {
  equipmentId: string;
  priority?: ChangeRequestPriority;
  /** JSON zákresu (formát viz `lib/markup.ts`). */
  markupData?: string | null;
  markupSheet?: number;
  markupImageUrl?: string | null;
  voiceTranscript?: string | null;
  note?: string | null;
  attachments?: AttachmentInput[];
}

export async function submitChangeRequest(prisma: PrismaClient, actor: Actor, input: SubmitChangeRequestInput) {
  const markup = input.markupData ? parseMarkup(input.markupData) : null;
  if (input.markupData && !markup) throw new WorkflowError("VALIDATION", "Zákres má neplatný formát.");
  const hasMarkup = !!markup && markup.strokes.length > 0;
  const voiceTranscript = clean(input.voiceTranscript);
  const note = clean(input.note);
  if (!hasMarkup && !voiceTranscript && !note && !input.attachments?.length) {
    throw new WorkflowError("VALIDATION", "Přidejte alespoň zákres, fotku nebo poznámku.");
  }

  return prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.findUnique({ where: { id: input.equipmentId }, select: { id: true } });
    if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");

    const open = await tx.changeRequest.findFirst({
      where: { equipmentId: equipment.id, status: { in: [...OPEN_STATUSES] } },
      select: { number: true, status: true },
    });
    if (open) {
      throw new WorkflowError("CONFLICT", `Zařízení už má otevřený požadavek ${open.number}. Doplňte ho komentářem.`);
    }
    const to = assertCanPerform("submit", actor.role, null)!;

    const now = new Date();
    const year = now.getFullYear();
    const numbers = await tx.changeRequest.findMany({ where: { number: { startsWith: `ZM-${year}-` } }, select: { number: true } });
    const number = formatTicketNumber(year, nextTicketSequence(numbers.map((item) => item.number), year));
    const baseRevision = await tx.documentRevision.findFirst({
      where: { equipmentId: equipment.id, status: "ACTIVE" },
      select: { id: true },
    });

    const changeRequest = await tx.changeRequest.create({
      data: {
        number,
        equipmentId: equipment.id,
        status: to,
        priority: input.priority ?? "NORMAL",
        baseRevisionId: baseRevision?.id ?? null,
        markupSheet: markup?.sheet ?? input.markupSheet ?? 1,
        markupData: hasMarkup ? JSON.stringify(markup) : null,
        markupImageUrl: clean(input.markupImageUrl),
        voiceTranscript,
        note,
        reporterId: actor.id,
        submittedAt: now,
        attachments: { create: attachmentRows(input.attachments, actor.id) },
      },
    });
    await addEvent(tx, { changeRequestId: changeRequest.id, type: "SUBMITTED", actorId: actor.id, from: null, to, at: now });
    await syncEquipment(tx, equipment.id);
    return changeRequest;
  });
}

/** Komentář (a případně fotky) k otevřenému požadavku – obě role. */
export async function addComment(
  prisma: PrismaClient,
  actor: Actor,
  input: { changeRequestId: string; comment?: string | null; attachments?: AttachmentInput[] },
) {
  const comment = clean(input.comment);
  if (!comment && !input.attachments?.length) throw new WorkflowError("VALIDATION", "Napište komentář nebo přidejte fotku.");

  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    assertCanPerform("comment", actor.role, changeRequest.status);
    if (input.attachments?.length) {
      await tx.attachment.createMany({
        data: attachmentRows(input.attachments, actor.id).map((row) => ({ ...row, changeRequestId: changeRequest.id })),
      });
    }
    const photos = input.attachments?.length ?? 0;
    await addEvent(tx, {
      changeRequestId: changeRequest.id,
      type: "COMMENT",
      actorId: actor.id,
      comment:
        comment ??
        (photos === 1 ? "Doplněna 1 fotka." : photos < 5 ? `Doplněny ${photos} fotky.` : `Doplněno ${photos} fotek.`),
    });
    return changeRequest;
  });
}

// ---------------------------------------------------------------------------
//  CAE: převzetí, nová revize, storno
// ---------------------------------------------------------------------------

export async function assignChangeRequest(prisma: PrismaClient, actor: Actor, input: { changeRequestId: string }) {
  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    const to = assertCanPerform("assign", actor.role, changeRequest.status)!;
    const updated = await tx.changeRequest.update({
      where: { id: changeRequest.id },
      data: { status: to, assigneeId: actor.id, assignedAt: new Date() },
    });
    await addEvent(tx, { changeRequestId: changeRequest.id, type: "ASSIGNED", actorId: actor.id, from: changeRequest.status, to });
    await syncEquipment(tx, changeRequest.equipmentId);
    return updated;
  });
}

export interface UploadRevisionInput {
  changeRequestId: string;
  schematicUrl: string;
  schematicFormat: SchematicFormat;
  /** Technické shrnutí změn (povinné). */
  summary: string;
  bump?: VersionBump;
  title?: string | null;
  sheetCount?: number;
  /** Nový kusovník; bez něj se zkopíruje kusovník platné revize. */
  bom?: BomItemInput[];
}

export async function uploadRevision(prisma: PrismaClient, actor: Actor, input: UploadRevisionInput) {
  const summary = clean(input.summary);
  if (!summary) throw new WorkflowError("VALIDATION", "Doplňte technické shrnutí změn.");
  if (!clean(input.schematicUrl)) throw new WorkflowError("VALIDATION", "Nahrajte soubor schématu.");

  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    const to = assertCanPerform("uploadRevision", actor.role, changeRequest.status)!;
    const now = new Date();

    let from = changeRequest.status;
    if (from === "SUBMITTED") {
      // Nahrání nad novým požadavkem ho automaticky přiřadí nahrávajícímu projektantovi.
      await tx.changeRequest.update({
        where: { id: changeRequest.id },
        data: { status: "IN_PROGRESS", assigneeId: actor.id, assignedAt: now },
      });
      await addEvent(tx, { changeRequestId: changeRequest.id, type: "ASSIGNED", actorId: actor.id, from, to: "IN_PROGRESS", at: now });
      from = "IN_PROGRESS";
    }

    const revisions = await tx.documentRevision.findMany({
      where: { equipmentId: changeRequest.equipmentId },
      select: { major: true, minor: true, status: true, title: true, bomItems: { orderBy: { position: "asc" } } },
    });
    const active = revisions.find((revision) => revision.status === "ACTIVE");
    const version = nextVersion(revisions, input.bump ?? "minor");
    const bom: BomItemInput[] =
      input.bom ??
      (active?.bomItems ?? []).map(({ designation, description, manufacturer, partNumber, quantity, unit, note }) => ({
        designation,
        description,
        manufacturer,
        partNumber,
        quantity,
        unit,
        note,
      }));
    if (bom.some((item) => !clean(item.designation) || !clean(item.description) || !(item.quantity > 0))) {
      throw new WorkflowError("VALIDATION", "Každá položka kusovníku musí mít označení, popis a kladné množství.");
    }

    const revision = await tx.documentRevision.create({
      data: {
        equipmentId: changeRequest.equipmentId,
        version: formatVersion(version),
        major: version.major,
        minor: version.minor,
        status: "PENDING_APPROVAL",
        title: clean(input.title) ?? active?.title ?? "Elektrické schéma",
        summary,
        schematicUrl: input.schematicUrl,
        schematicFormat: input.schematicFormat,
        sheetCount: input.sheetCount ?? 1,
        thumbnailUrl: input.schematicFormat === "PDF" ? null : input.schematicUrl,
        authorId: actor.id,
        changeRequestId: changeRequest.id,
        createdAt: now,
        bomItems: {
          create: bom.map((item, index) => ({
            position: index + 1,
            designation: item.designation.trim(),
            description: item.description.trim(),
            manufacturer: clean(item.manufacturer),
            partNumber: clean(item.partNumber),
            quantity: item.quantity,
            unit: clean(item.unit) ?? "ks",
            note: clean(item.note),
          })),
        },
      },
    });

    await tx.changeRequest.update({
      where: { id: changeRequest.id },
      data: { status: to, resolvedAt: now, engineerSummary: summary },
    });
    await addEvent(tx, {
      changeRequestId: changeRequest.id,
      type: "REVISION_UPLOADED",
      actorId: actor.id,
      from,
      to,
      revisionId: revision.id,
      comment: summary,
      at: now,
    });
    await syncEquipment(tx, changeRequest.equipmentId);
    return revision;
  });
}

export async function cancelChangeRequest(
  prisma: PrismaClient,
  actor: Actor,
  input: { changeRequestId: string; comment?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    const to = assertCanPerform("cancel", actor.role, changeRequest.status)!;
    const updated = await tx.changeRequest.update({ where: { id: changeRequest.id }, data: { status: to, closedAt: new Date() } });
    await addEvent(tx, {
      changeRequestId: changeRequest.id,
      type: "CANCELLED",
      actorId: actor.id,
      from: changeRequest.status,
      to,
      comment: input.comment,
    });
    await syncEquipment(tx, changeRequest.equipmentId);
    return updated;
  });
}

// ---------------------------------------------------------------------------
//  Údržba: schválení / vrácení revize
// ---------------------------------------------------------------------------

async function loadPendingRevision(tx: Tx, changeRequestId: string) {
  const revision = await tx.documentRevision.findFirst({
    where: { changeRequestId, status: "PENDING_APPROVAL" },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
  if (!revision) throw new WorkflowError("NOT_FOUND", "K požadavku není nahraná revize čekající na schválení.");
  return revision;
}

export async function approveRevision(
  prisma: PrismaClient,
  actor: Actor,
  input: { changeRequestId: string; comment?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    const to = assertCanPerform("approve", actor.role, changeRequest.status)!;
    const revision = await loadPendingRevision(tx, changeRequest.id);
    const now = new Date();

    // Dosavadní platná revize jde do archivu, nová se stává platnou.
    await tx.documentRevision.updateMany({
      where: { equipmentId: changeRequest.equipmentId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
    const approved = await tx.documentRevision.update({
      where: { id: revision.id },
      data: { status: "ACTIVE", approverId: actor.id, approvedAt: now },
    });
    await tx.changeRequest.update({ where: { id: changeRequest.id }, data: { status: to, closedAt: now } });
    await addEvent(tx, {
      changeRequestId: changeRequest.id,
      type: "APPROVED",
      actorId: actor.id,
      from: changeRequest.status,
      to,
      revisionId: revision.id,
      comment: input.comment,
      at: now,
    });
    await syncEquipment(tx, changeRequest.equipmentId);
    return approved;
  });
}

export async function rejectRevision(
  prisma: PrismaClient,
  actor: Actor,
  input: { changeRequestId: string; comment: string },
) {
  const comment = clean(input.comment);
  if (!comment || comment.length < 3) throw new WorkflowError("VALIDATION", "Napište, proč revizi vracíte k přepracování.");

  return prisma.$transaction(async (tx) => {
    const changeRequest = await loadChangeRequest(tx, input.changeRequestId);
    const to = assertCanPerform("reject", actor.role, changeRequest.status)!;
    const revision = await loadPendingRevision(tx, changeRequest.id);
    const now = new Date();

    // Zamítnutá revize si ponechá číslo (auditní stopa); „schvalovatel“ = kdo ji vrátil.
    const rejected = await tx.documentRevision.update({
      where: { id: revision.id },
      data: { status: "REJECTED", rejectionComment: comment, approverId: actor.id, approvedAt: now },
    });
    await tx.changeRequest.update({ where: { id: changeRequest.id }, data: { status: to, resolvedAt: null } });
    await addEvent(tx, {
      changeRequestId: changeRequest.id,
      type: "REJECTED",
      actorId: actor.id,
      from: changeRequest.status,
      to,
      revisionId: revision.id,
      comment,
      at: now,
    });
    await syncEquipment(tx, changeRequest.equipmentId);
    return rejected;
  });
}
