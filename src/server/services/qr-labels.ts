import type { PrismaClient } from "@/generated/prisma/client";
import { isValidIco, normalizeIco } from "@/lib/ares";
import { LABEL_PURPOSES, batchRange, isSerialCode, serialCode, type LabelPurpose } from "@/lib/qr-label-registry";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Fáze 103: registr QR štítků ELDOCK. Sériová čísla přiděluje jediné atomické počítadlo (`QrLabelCounter`, řádek 1)
// v transakci SQLite – dvě série se nikdy nepřekryjí; `UNIQUE` na `sequence` a `serialCode` to hlídá i v databázi.

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Rezervace `count` dalších pořadových čísel (atomické navýšení počítadla). */
async function reserve(tx: Tx, count: number) {
  await tx.qrLabelCounter.upsert({ where: { id: 1 }, create: { id: 1, lastSequenceNumber: 0 }, update: {} });
  const counter = await tx.qrLabelCounter.update({ where: { id: 1 }, data: { lastSequenceNumber: { increment: count } } });
  return batchRange(counter.lastSequenceNumber - count, count);
}

export interface BatchInput {
  companyName: string;
  ico?: string | null;
  email?: string | null;
  purpose: LabelPurpose;
  count: number;
  note?: string | null;
}

/** Nová série štítků pro firmu – registrovaná firma AI Panel Builderu se spáruje podle IČO nebo e-mailu. */
export async function createLabelBatch(prisma: PrismaClient, input: BatchInput) {
  const companyName = input.companyName.trim();
  if (companyName.length < 2) throw new WorkflowError("VALIDATION", "Zadejte název firmy.");
  if (!LABEL_PURPOSES.some((purpose) => purpose.id === input.purpose)) throw new WorkflowError("VALIDATION", "Neznámý účel štítku.");
  const ico = input.ico?.trim() ? normalizeIco(input.ico) : null;
  if (ico && !isValidIco(ico)) throw new WorkflowError("VALIDATION", "IČO má 8 číslic s platnou kontrolní číslicí.");
  const email = input.email?.trim().toLowerCase() || null;
  return prisma.$transaction(async (tx) => {
    const range = await reserve(tx, input.count);
    // Firma AI Panel Builderu (rozváděče) přednostně, jinak firma Správy závodů (stroje a spotřebiče závodu)
    const company = ico || email ? await tx.registeredCompany.findFirst({ where: { closedAt: null, OR: [...(ico ? [{ ico }] : []), ...(email ? [{ email }] : [])] }, orderBy: { productScope: "asc" }, select: { id: true } }) : null;
    const batch = await tx.qrLabelBatch.create({ data: { companyName, ico, email, registeredCompanyId: company?.id ?? null, purpose: input.purpose, firstSequence: range.first, lastSequence: range.last, count: input.count, note: input.note?.trim() || null } });
    await tx.qrLabelItem.createMany({ data: range.codes.map((code, index) => ({ sequence: range.first + index, serialCode: code, batchId: batch.id })) });
    return { ...batch, first: range.codes[0], last: range.codes[range.codes.length - 1] };
  });
}

/** Série s počtem aktivovaných štítků (spárovaných v terénu) – nejnovější první. */
export async function labelBatches(prisma: PrismaClient, take = 200) {
  const batches = await prisma.qrLabelBatch.findMany({ orderBy: { createdAt: "desc" }, take, include: { _count: { select: { items: true } } } });
  const activated = await prisma.qrLabelItem.groupBy({ by: ["batchId"], where: { batchId: { in: batches.map((batch) => batch.id) }, activatedAt: { not: null } }, _count: { _all: true } });
  return batches.map((batch) => ({ ...batch, from: serialCode(batch.firstSequence), to: serialCode(batch.lastSequence), activated: activated.find((row) => row.batchId === batch.id)?._count._all ?? 0 }));
}

/** Štítek podle sériového čísla (s firmou série). */
export async function resolveLabel(prisma: PrismaClient, code: string) {
  const serial = code.trim().toUpperCase();
  if (!isSerialCode(serial)) return null;
  return prisma.qrLabelItem.findUnique({ where: { serialCode: serial }, include: { batch: true } });
}

/**
 * Spárování štítku s rozváděčem (projekt AI Panel Builderu) – jen firma, které série patří (podle firmy série, IČO
 * nebo e-mailu), a jen dosud nespárovaný štítek. Štítek se tím aktivuje.
 */
export async function pairLabelWithProject(prisma: PrismaClient, input: { code: string; projectId: string; companyId: string }) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: input.companyId }, select: { id: true, ico: true, email: true } });
  const label = await resolveLabel(prisma, input.code);
  if (!company || !label) throw new WorkflowError("NOT_FOUND", "Štítek nebyl nalezen.");
  const owns = label.batch.registeredCompanyId === company.id || (label.batch.ico && label.batch.ico === company.ico) || (label.batch.email && label.batch.email === company.email);
  if (!owns) throw new WorkflowError("FORBIDDEN", "Štítek patří jiné firmě.");
  const project = await prisma.panelBoardProject.findFirst({ where: { id: input.projectId, companyId: company.id }, select: { id: true, qrSerial: true } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
  if (project.qrSerial && project.qrSerial !== label.serialCode) throw new WorkflowError("CONFLICT", `Rozváděč už má štítek ${project.qrSerial}.`);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.qrLabelItem.updateMany({ where: { id: label.id, targetId: null }, data: { targetType: "PANEL_PROJECT", targetId: project.id, activatedAt: new Date() } });
    if (!count) throw new WorkflowError("CONFLICT", "Štítek je už spárovaný.");
    if (!label.batch.registeredCompanyId) await tx.qrLabelBatch.update({ where: { id: label.batchId }, data: { registeredCompanyId: company.id } });
    await tx.panelBoardProject.update({ where: { id: project.id }, data: { qrSerial: label.serialCode } });
    return label.serialCode;
  });
}

/** Štítek rozváděče z registru (idempotentní) – před sestavením snímku vydané verze. */
export async function assignProjectLabel(prisma: PrismaClient, projectId: string) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.panelBoardProject.findUnique({ where: { id: projectId }, select: { id: true, qrSerial: true, companyId: true, company: { select: { companyName: true, ico: true, email: true } } } });
    if (!project) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
    return ensureProjectLabel(tx, project, project.company);
  });
}

/**
 * Štítek rozváděče při prvním vydání verze: má-li rozváděč spárovaný štítek, vrátí ho; jinak z registru přidělí nový
 * (série 1 ks pro firmu výrobce rozváděče) a spáruje ho – každý vydaný rozváděč má globálně unikátní QR kód.
 */
export async function ensureProjectLabel(tx: Tx, project: { id: string; qrSerial: string | null; companyId: string | null }, company: { companyName: string; ico: string; email: string } | null) {
  if (project.qrSerial) return project.qrSerial;
  const range = await reserve(tx, 1);
  const batch = await tx.qrLabelBatch.create({ data: { companyName: company?.companyName ?? "Výrobce rozváděče", ico: company?.ico ?? null, email: company?.email ?? null, registeredCompanyId: project.companyId, purpose: "SWITCHBOARD", firstSequence: range.first, lastSequence: range.last, count: 1, note: "Přiděleno automaticky při vydání dokumentace rozváděče" } });
  await tx.qrLabelItem.create({ data: { sequence: range.first, serialCode: range.codes[0], batchId: batch.id, targetType: "PANEL_PROJECT", targetId: project.id, activatedAt: new Date() } });
  await tx.panelBoardProject.update({ where: { id: project.id }, data: { qrSerial: range.codes[0] } });
  return range.codes[0];
}

/**
 * Fáze 103: spárování štítku se zařízením Správy závodů (stroj, spotřebič, rozváděč v závodě) – uživatel registrované
 * firmy závodu, štítek z její série a zařízení jejího závodu. Karta štítku pak vede na kartu zařízení.
 */
export async function pairLabelWithEquipment(prisma: PrismaClient, input: { code: string; equipmentId: string; companyId: string }) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: input.companyId }, select: { id: true, ico: true, email: true, plantId: true } });
  const label = await resolveLabel(prisma, input.code);
  if (!company?.plantId || !label) throw new WorkflowError("NOT_FOUND", "Štítek nebyl nalezen.");
  const owns = label.batch.registeredCompanyId === company.id || (label.batch.ico && label.batch.ico === company.ico) || (label.batch.email && label.batch.email === company.email);
  if (!owns) throw new WorkflowError("FORBIDDEN", "Štítek patří jiné firmě.");
  const equipment = await prisma.equipment.findFirst({ where: { id: input.equipmentId, floor: { building: { plantId: company.plantId } } }, select: { id: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  const taken = await prisma.qrLabelItem.findFirst({ where: { targetType: "EQUIPMENT", targetId: equipment.id }, select: { serialCode: true } });
  if (taken) throw new WorkflowError("CONFLICT", `Zařízení už má štítek ${taken.serialCode}.`);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.qrLabelItem.updateMany({ where: { id: label.id, targetId: null }, data: { targetType: "EQUIPMENT", targetId: equipment.id, activatedAt: new Date() } });
    if (!count) throw new WorkflowError("CONFLICT", "Štítek je už spárovaný.");
    if (!label.batch.registeredCompanyId) await tx.qrLabelBatch.update({ where: { id: label.batchId }, data: { registeredCompanyId: company.id } });
    return label.serialCode;
  });
}
