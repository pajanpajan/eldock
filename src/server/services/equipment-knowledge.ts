import type { AttachmentCategory } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeComponentTag } from "@/lib/equipment-documents";
import { SAFETY_CHECKSUM_PATTERN, nextSoftwareVersion, normalizeChecksum, type VersionBump } from "@/lib/software-backups";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { Actor, Tx } from "./workflow";

// Knihovna návodů a datasheetů zařízení a verzované zálohy řídicího SW (fáze 46).

const FILE_URL = /^(\/api\/files\/(attachments|documents|software)\/[\w./-]+|\/demo-docs\/[\w.-]+\.pdf)$/;
const clean = (value: string | null | undefined, max: number) => value?.trim().slice(0, max) || null;

export interface FileInput {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

function assertFile(file: FileInput, dir: "attachments" | "software") {
  if (!FILE_URL.test(file.fileUrl) || (dir === "software" ? !file.fileUrl.includes("/software/") : file.fileUrl.includes("/software/"))) {
    throw new WorkflowError("VALIDATION", "Soubor nebyl správně nahrán – nahrajte ho prosím znovu.");
  }
  if (!file.fileName.trim() || file.fileSizeBytes <= 0) throw new WorkflowError("VALIDATION", "Soubor je prázdný.");
}

async function assertEquipment(prisma: PrismaClient | Tx, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true, tag: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  return equipment;
}

// ---------------------------------------------------------------------------
//  Návody a datasheety
// ---------------------------------------------------------------------------

export interface EquipmentDocumentInput extends FileInput {
  equipmentId: string;
  category: AttachmentCategory;
  title: string;
  componentTag?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  version?: string | null;
  language?: string | null;
}

export async function addEquipmentDocument(prisma: PrismaClient, actor: Pick<Actor, "id">, input: EquipmentDocumentInput) {
  await assertEquipment(prisma, input.equipmentId);
  assertFile(input, "attachments");
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new WorkflowError("VALIDATION", "Zadejte název dokumentu.");
  return prisma.equipmentDocument.create({
    data: {
      equipmentId: input.equipmentId,
      category: input.category,
      title,
      componentTag: normalizeComponentTag(input.componentTag),
      manufacturer: clean(input.manufacturer, 80),
      modelNumber: clean(input.modelNumber, 80),
      version: clean(input.version, 20) ?? "1.0",
      language: clean(input.language, 5) ?? "cs",
      fileUrl: input.fileUrl,
      fileName: input.fileName.trim().slice(0, 200),
      fileSizeBytes: Math.round(input.fileSizeBytes),
      uploadedById: actor.id,
    },
  });
}

export async function deleteEquipmentDocument(prisma: PrismaClient, documentId: string) {
  const document = await prisma.equipmentDocument.findUnique({ where: { id: documentId }, select: { id: true, equipmentId: true } });
  if (!document) throw new WorkflowError("NOT_FOUND", "Dokument nebyl nalezen.");
  await prisma.equipmentDocument.delete({ where: { id: document.id } });
  return document;
}

// ---------------------------------------------------------------------------
//  Verzované zálohy SW / parametrů
// ---------------------------------------------------------------------------

export interface SoftwareBackupInput extends FileInput {
  equipmentId: string;
  targetUnit: string;
  platform: string;
  bump: VersionBump;
  firmwareVersion?: string | null;
  isSafetyRelated?: boolean;
  safetyChecksum?: string | null;
  changeSummary: string;
  changeRequestId?: string | null;
}

/**
 * Nová verze zálohy řídicího uzlu v transakci: dosavadní ACTIVE uzlu → ARCHIVED, nová ACTIVE (v1.0,
 * Minor +0.1, Major +1.0). Bezpečnostní program musí mít kontrolní součet (Nařízení (EU) 2023/1230).
 */
export async function createSoftwareBackupInTx(tx: Tx, actor: Pick<Actor, "id">, input: SoftwareBackupInput) {
  await assertEquipment(tx, input.equipmentId);
  assertFile(input, "software");
  const targetUnit = input.targetUnit.trim().slice(0, 120);
  const platform = input.platform.trim().slice(0, 80);
  const changeSummary = input.changeSummary.trim().slice(0, 2000);
  if (!targetUnit) throw new WorkflowError("VALIDATION", "Zadejte řídicí uzel stroje (např. PLC -A1).");
  if (!platform) throw new WorkflowError("VALIDATION", "Zadejte platformu (např. TIA Portal V19).");
  if (changeSummary.length < 5) throw new WorkflowError("VALIDATION", "Popis změny v programu / parametrech je povinný.");
  const checksum = input.isSafetyRelated ? normalizeChecksum(input.safetyChecksum ?? "") : null;
  if (input.isSafetyRelated && (!checksum || !SAFETY_CHECKSUM_PATTERN.test(checksum))) {
    throw new WorkflowError("VALIDATION", "Bezpečnostní program vyžaduje kontrolní součet (např. CRC: 0x8F4A-2C91).");
  }
  if (input.changeRequestId) {
    const change = await tx.changeRequest.findUnique({ where: { id: input.changeRequestId }, select: { equipmentId: true } });
    if (!change || change.equipmentId !== input.equipmentId) throw new WorkflowError("VALIDATION", "Změnové řízení patří k jinému zařízení.");
  }
  const existing = await tx.softwareBackup.findMany({ where: { equipmentId: input.equipmentId, targetUnit }, select: { major: true, minor: true } });
  const version = nextSoftwareVersion(existing, input.bump);
  await tx.softwareBackup.updateMany({ where: { equipmentId: input.equipmentId, targetUnit, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
  return tx.softwareBackup.create({
    data: {
      equipmentId: input.equipmentId,
      targetUnit,
      platform,
      major: version.major,
      minor: version.minor,
      status: "ACTIVE",
      firmwareVersion: clean(input.firmwareVersion, 40),
      isSafetyRelated: !!input.isSafetyRelated,
      safetyChecksum: checksum,
      changeSummary,
      fileUrl: input.fileUrl,
      fileName: input.fileName.trim().slice(0, 200),
      fileSizeBytes: Math.round(input.fileSizeBytes),
      changeRequestId: input.changeRequestId ?? null,
      authorId: actor.id,
    },
  });
}

export function createSoftwareBackup(prisma: PrismaClient, actor: Pick<Actor, "id">, input: SoftwareBackupInput) {
  return prisma.$transaction((tx) => createSoftwareBackupInTx(tx, actor, input));
}

/** Rollback: starší verze zpět jako ACTIVE (ostatní verze uzlu ARCHIVED). */
export async function activateSoftwareBackup(prisma: PrismaClient, backupId: string) {
  return prisma.$transaction(async (tx) => {
    const backup = await tx.softwareBackup.findUnique({ where: { id: backupId } });
    if (!backup) throw new WorkflowError("NOT_FOUND", "Záloha nebyla nalezena.");
    await tx.softwareBackup.updateMany({ where: { equipmentId: backup.equipmentId, targetUnit: backup.targetUnit, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
    return tx.softwareBackup.update({ where: { id: backup.id }, data: { status: "ACTIVE" } });
  });
}

/** Změny čekající na zálohu SW: požadavek s příznakem úpravy SW bez navázané zálohy. */
export async function pendingSoftwareUpdates(prisma: PrismaClient | Tx, changeRequestIds: readonly string[]) {
  const rows = await prisma.changeRequest.findMany({
    where: { id: { in: [...changeRequestIds] }, requiresSoftwareUpdate: true, softwareBackups: { none: {} } },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}
