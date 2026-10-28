// Dočasná provizoria: provizorní zapojení v zařízení, které NEMĚNÍ oficiální dokumentaci
// (revize, kusovník) ani nezakládá ticket v CAE Back-Office. Ukončení buď 1:1 dle schématu,
// nebo převodem na požadavek na změnu (v jedné transakci). Záměrně bez `server-only`.

import type { ChangeRequestPriority } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  TEMP_MOD_DAYS,
  TEMP_MOD_ROLE_LABEL,
  formatTempModNumber,
  nextTempModSequence,
  tempModExpiry,
} from "@/lib/temporary-mod";
import { OPEN_STATUSES, WorkflowError } from "@/lib/workflow/state-machine";

import { addCommentInTx, submitChangeRequestInTx, type Actor, type Tx } from "./workflow";

const clean = (value: string | null | undefined) => value?.trim() || null;

async function actorName(tx: Tx | PrismaClient, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  if (!user) throw new WorkflowError("NOT_FOUND", "Uživatel nebyl nalezen.");
  return user.name;
}

export interface CreateTemporaryModInput {
  equipmentId: string;
  title: string;
  description: string;
  /** Lhůta odstranění: 7 nebo 14 dní. */
  days: number;
  photoUrl?: string | null;
  markupJson?: string | null;
  /** Kdo provizorium zapsal („Revizní technik“ / „Údržba“); výchozí podle role. */
  createdByRole?: string | null;
}

/** Založí aktivní provizorium (bez zásahu do revizí dokumentace a bez ticketu pro CAE). */
export async function createTemporaryMod(prisma: PrismaClient, actor: Actor, input: CreateTemporaryModInput, now: Date = new Date()) {
  const title = clean(input.title);
  const description = clean(input.description);
  if (!title || title.length < 3) throw new WorkflowError("VALIDATION", "Napište stručný název provizoria.");
  if (!description || description.length < 3) throw new WorkflowError("VALIDATION", "Popište provizorní zapojení a bezpečnostní opatření.");
  if (!(TEMP_MOD_DAYS as readonly number[]).includes(input.days)) throw new WorkflowError("VALIDATION", "Lhůta odstranění provizoria je 7 nebo 14 dní.");

  return prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.findUnique({ where: { id: input.equipmentId }, select: { id: true } });
    if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
    const year = now.getUTCFullYear();
    const numbers = await tx.temporaryModification.findMany({ where: { number: { startsWith: `PROV-${year}-` } }, select: { number: true } });
    return tx.temporaryModification.create({
      data: {
        equipmentId: equipment.id,
        number: formatTempModNumber(year, nextTempModSequence(numbers.map((item) => item.number), year)),
        title,
        description,
        createdByName: await actorName(tx, actor),
        createdByRole: clean(input.createdByRole) ?? TEMP_MOD_ROLE_LABEL[actor.role],
        createdAt: now,
        expiresAt: tempModExpiry(now, input.days),
        photoUrl: clean(input.photoUrl),
        markupJson: clean(input.markupJson),
      },
    });
  });
}

async function loadActive(tx: Tx, id: string) {
  const mod = await tx.temporaryModification.findUnique({ where: { id } });
  if (!mod) throw new WorkflowError("NOT_FOUND", "Provizorium nebylo nalezeno.");
  if (mod.status !== "ACTIVE") throw new WorkflowError("INVALID_STATE", `Provizorium ${mod.number} už bylo ukončeno.`);
  return mod;
}

/** Provizorium odstraněno a nahrazeno 1:1 dle platného schématu – dokumentace zůstává beze změny. */
export async function resolveAsOneToOne(prisma: PrismaClient, actor: Actor, input: { id: string; note?: string | null }, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const mod = await loadActive(tx, input.id);
    return tx.temporaryModification.update({
      where: { id: mod.id },
      data: {
        status: "RESTORED_1_TO_1",
        resolvedAt: now,
        resolvedByName: await actorName(tx, actor),
        resolutionNote: clean(input.note) ?? "Provizorium odstraněno, zapojení vráceno do stavu 1:1 dle platného schématu.",
      },
    });
  });
}

export interface ConvertTemporaryModInput {
  id: string;
  /** Popis finálního stavu, který se liší od schématu (povinný – jde do požadavku pro CAE). */
  note: string;
  photoUrl?: string | null;
  priority?: ChangeRequestPriority;
}

/**
 * Provizorium nahrazeno jiným finálním zapojením: v jedné transakci uzavře provizorium a založí
 * požadavek na změnu dokumentace (předvyplněný popisem a fotkou). Má-li zařízení už otevřený
 * požadavek (max. 1 na zařízení), doplní se do něj komentář s fotkou.
 */
export async function resolveAndConvertToChangeRequest(prisma: PrismaClient, actor: Actor, input: ConvertTemporaryModInput, now: Date = new Date()) {
  const note = clean(input.note);
  if (!note || note.length < 3) throw new WorkflowError("VALIDATION", "Popište finální zapojení, které se liší od schématu.");
  const photo = clean(input.photoUrl);

  return prisma.$transaction(async (tx) => {
    const mod = await loadActive(tx, input.id);
    const text = `Ukončení provizoria ${mod.number} (${mod.title}): ${note}`;
    const attachments = photo ? [{ url: photo, type: "PHOTO" as const, caption: `Finální stav po provizoriu ${mod.number}` }] : [];
    const open = await tx.changeRequest.findFirst({
      where: { equipmentId: mod.equipmentId, status: { in: [...OPEN_STATUSES] } },
      select: { id: true },
    });
    const changeRequest = open
      ? await addCommentInTx(tx, actor, { changeRequestId: open.id, comment: text, attachments })
      : await submitChangeRequestInTx(tx, actor, { equipmentId: mod.equipmentId, priority: input.priority ?? "HIGH", note: text, attachments });
    const updated = await tx.temporaryModification.update({
      where: { id: mod.id },
      data: {
        status: "CONVERTED_TO_CR",
        resolvedAt: now,
        resolvedByName: await actorName(tx, actor),
        resolutionNote: note,
        spawnedChangeRequestId: changeRequest.id,
      },
    });
    return { temporaryMod: updated, changeRequest: { id: changeRequest.id, number: changeRequest.number }, appended: !!open };
  });
}
