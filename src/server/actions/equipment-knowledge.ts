"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { activateSoftwareBackup, addEquipmentDocument, createSoftwareBackup, deleteEquipmentDocument } from "@/server/services/equipment-knowledge";
import { getCurrentAccount, getCurrentUser } from "@/server/session";

import type { ActionResult } from "./workflow";

// Knihovna návodů a datasheetů + verzované zálohy SW (fáze 46). Dokumenty smí přidat údržba, revizní
// technik i CAE; zálohy řídicího SW údržba a CAE projektant.

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max).nullable().optional();
const file = {
  fileName: z.string().trim().min(1).max(200),
  fileSizeBytes: z.number().int().positive().max(60 * 1024 * 1024),
};

async function run<S extends z.ZodType, T>(schema: S, raw: unknown, allowed: readonly ("submitChange" | "recordInspection" | "caeOffice")[], action: (input: z.infer<S>, userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte vyplněné údaje a soubor." };
  try {
    const account = await getCurrentAccount();
    if (!allowed.some((permission) => account.can(permission))) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemůže měnit dokumentaci zařízení.`);
    const user = await getCurrentUser();
    return { ok: true, data: await action(parsed.data, user.id) };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }
}

const documentSchema = z.object({
  equipmentId: id,
  category: z.enum(["MANUAL", "DATASHEET", "DRIVE_PARAMS", "FLUID_SCHEMA", "CERTIFICATE", "OTHER"]),
  title: z.string().trim().min(1).max(200),
  componentTag: text(20),
  manufacturer: text(80),
  modelNumber: text(80),
  version: text(20),
  fileUrl: z.string().max(300).regex(/^\/api\/files\/attachments\/[\w./-]+$/),
  ...file,
});

/** „+ Nahrát návod / datasheet“. */
export async function addEquipmentDocumentAction(input: z.input<typeof documentSchema>): Promise<ActionResult<{ id: string }>> {
  return run(documentSchema, input, ["submitChange", "recordInspection", "caeOffice"], async (data, userId) => {
    const document = await addEquipmentDocument(prisma, { id: userId }, data);
    revalidatePath(equipmentHref(data.equipmentId));
    return { id: document.id };
  });
}

export async function deleteEquipmentDocumentAction(documentId: string): Promise<ActionResult> {
  return run(id, documentId, ["submitChange", "caeOffice"], async (value) => {
    const document = await deleteEquipmentDocument(prisma, value);
    revalidatePath(equipmentHref(document.equipmentId));
    return undefined;
  });
}

const backupSchema = z.object({
  equipmentId: id,
  targetUnit: z.string().trim().min(1).max(120),
  platform: z.string().trim().min(1).max(80),
  bump: z.enum(["minor", "major"]),
  firmwareVersion: text(40),
  isSafetyRelated: z.boolean().optional(),
  safetyChecksum: text(60),
  changeSummary: z.string().trim().min(5).max(2000),
  changeRequestId: id.nullable().optional(),
  fileUrl: z.string().max(300).regex(/^\/api\/files\/software\/[\w./-]+$/),
  ...file,
});

/** „+ Nahrát novou verzi zálohy SW / parametrů“ (dosavadní ACTIVE uzlu → ARCHIVED). */
export async function createSoftwareBackupAction(input: z.input<typeof backupSchema>): Promise<ActionResult<{ version: string }>> {
  return run(backupSchema, input, ["submitChange", "caeOffice"], async (data, userId) => {
    const backup = await createSoftwareBackup(prisma, { id: userId }, data);
    revalidatePath(equipmentHref(data.equipmentId));
    revalidatePath("/cae", "layout");
    return { version: `v${backup.major}.${backup.minor}` };
  });
}

/** Rollback: starší verzi nastavit jako aktuálně ve stroji. */
export async function activateSoftwareBackupAction(backupId: string): Promise<ActionResult<{ version: string }>> {
  return run(id, backupId, ["submitChange", "caeOffice"], async (value) => {
    const backup = await activateSoftwareBackup(prisma, value);
    revalidatePath(equipmentHref(backup.equipmentId));
    return { version: `v${backup.major}.${backup.minor}` };
  });
}
