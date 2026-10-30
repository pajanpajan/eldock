import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Interaktivní reference ve výkresu (CAE): značka prvku, pozice na stránce a vazba na kartu zařízení.

export interface ReferenceInput {
  revisionId: string;
  page: number;
  designation: string;
  title: string;
  description?: string | null;
  x: number;
  y: number;
  linkedEquipmentId?: string | null;
}

/** Referenční označení dle ČSN EN 81346: „-Q1“, „-M12“, „-X1.3“ (pomlčka se doplní). */
export function normalizeDesignation(value: string): string {
  const text = value.trim().toUpperCase().replace(/\s+/g, "");
  const designation = text.startsWith("-") ? text : `-${text}`;
  if (!/^-[A-Z]{1,3}\d{1,4}(\.\d{1,3})?$/.test(designation)) {
    throw new WorkflowError("VALIDATION", `Neplatné referenční označení „${value}“ (např. -Q1, -M1, -X1).`);
  }
  return designation;
}

async function validate(prisma: PrismaClient, input: ReferenceInput) {
  const revision = await prisma.documentRevision.findUnique({ where: { id: input.revisionId }, select: { id: true, sheetCount: true, schematicFormat: true } });
  if (!revision) throw new WorkflowError("NOT_FOUND", "Revize neexistuje.");
  const pages = revision.schematicFormat === "PDF" ? Math.max(1, revision.sheetCount) : 1;
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > pages) throw new WorkflowError("VALIDATION", `Stránka musí být 1–${pages}.`);
  if (![input.x, input.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) throw new WorkflowError("VALIDATION", "Pozice musí ležet ve výkresu.");
  const title = input.title.trim();
  if (!title || title.length > 120) throw new WorkflowError("VALIDATION", "Zadejte název prvku (max. 120 znaků).");
  if (input.linkedEquipmentId && !(await prisma.equipment.findUnique({ where: { id: input.linkedEquipmentId }, select: { id: true } }))) {
    throw new WorkflowError("NOT_FOUND", "Propojené zařízení neexistuje.");
  }
  return {
    revisionId: revision.id,
    page: input.page,
    designation: normalizeDesignation(input.designation),
    title,
    description: input.description?.trim() || null,
    x: Math.round(input.x * 10) / 10,
    y: Math.round(input.y * 10) / 10,
    linkedEquipmentId: input.linkedEquipmentId || null,
  };
}

export async function createReference(prisma: PrismaClient, input: ReferenceInput) {
  return prisma.schematicReference.create({ data: await validate(prisma, input) });
}

export async function updateReference(prisma: PrismaClient, id: string, input: ReferenceInput) {
  const existing = await prisma.schematicReference.findUnique({ where: { id }, select: { revisionId: true } });
  if (!existing) throw new WorkflowError("NOT_FOUND", "Reference neexistuje.");
  if (existing.revisionId !== input.revisionId) throw new WorkflowError("VALIDATION", "Referenci nelze přesunout do jiné revize.");
  return prisma.schematicReference.update({ where: { id }, data: await validate(prisma, input) });
}

export async function deleteReference(prisma: PrismaClient, id: string) {
  const existing = await prisma.schematicReference.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new WorkflowError("NOT_FOUND", "Reference neexistuje.");
  await prisma.schematicReference.delete({ where: { id } });
}
