import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { ORDER_STATUS, factoryTestIssues, factoryTestSchema, inspectionFromFactoryTest, isRegion, orderNumber, routineTestFromFactory, type FactoryTestInput, type TurnkeyConfig, type TurnkeyEstimate } from "@/lib/panel-builder/turnkey-manufacturing";
import { accessCode } from "@/lib/redline-marketplace";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { hashPassword, verifyPassword } from "@/server/password";
import { ensureProjectLabel } from "@/server/services/qr-labels";
import { parseInspection, publishVersion } from "@/server/services/switchboard-versions";

// Fáze 106: zasmluvnění výrobci rozváděčů a zakázky výroby na klíč – poptávka (s rezervací QR štítku z registru),
// přijetí výrobcem (u poptávky „všem v regionu“ atomicky – vyhraje první), výstupní kusová zkouška a dokončení
// (uzamčení Verze 1.0 dokumentace pod štítkem EL-…). Čisté služby nad Prisma klientem (testy nad SQLite).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Zasmluvněný výrobce – přístupový kód do portálu se ukáže jen jednou (ukládá se otisk). */
export async function createManufacturer(prisma: PrismaClient, input: { name: string; email: string; region: string; ico?: string | null; phone?: string | null; leadDays?: number }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3 || !EMAIL.test(email)) throw new WorkflowError("VALIDATION", "Zadejte název a platný e-mail výrobce.");
  if (!isRegion(input.region)) throw new WorkflowError("VALIDATION", "Vyberte kraj působnosti výrobce.");
  const code = accessCode((size) => randomBytes(size));
  const data = { name, region: input.region, ico: input.ico?.trim() || null, phone: input.phone?.trim() || null, leadDays: Math.min(60, Math.max(1, Math.round(input.leadDays ?? 10))), accessHash: await hashPassword(code), active: true };
  const manufacturer = await prisma.panelManufacturer.upsert({ where: { email }, create: { email, ...data }, update: data });
  return { id: manufacturer.id, name, email, region: input.region, code };
}

/** Přihlášení výrobce do portálu /vyroba-rozvadecu (e-mail + přístupový kód). */
export async function authenticateManufacturer(prisma: PrismaClient, email: string, code: string) {
  const manufacturer = await prisma.panelManufacturer.findUnique({ where: { email: email.trim().toLowerCase() } });
  return manufacturer?.active && (await verifyPassword(code.trim().toUpperCase(), manufacturer.accessHash)) ? { id: manufacturer.id, name: manufacturer.name } : null;
}

export interface OrderInput {
  projectId: string;
  companyId: string;
  /** Konkrétní výrobce, nebo null = všem certifikovaným výrobcům v regionu. */
  manufacturerId: string | null;
  region: string;
  config: TurnkeyConfig;
  estimate: TurnkeyEstimate;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  deliveryAddress?: string | null;
  note?: string | null;
  now?: Date;
}

/**
 * Poptávka / objednávka výroby na klíč: zakázka `VYR-RRRR-NNNN` a hned rezervace unikátního QR štítku `EL-…` z registru
 * pro tento rozváděč (spárovaný s projektem – po dokončení vede na uzamčenou dokumentaci).
 */
export async function createManufacturingOrder(prisma: PrismaClient, input: OrderInput) {
  if (!isRegion(input.region)) throw new WorkflowError("VALIDATION", "Vyberte kraj, kam se rozváděč dodá.");
  if (input.contactName.trim().length < 3 || !EMAIL.test(input.contactEmail.trim())) throw new WorkflowError("VALIDATION", "Zadejte kontaktní osobu a platný e-mail.");
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const project = await tx.panelBoardProject.findFirst({ where: { id: input.projectId, companyId: input.companyId }, select: { id: true, qrSerial: true, companyId: true, company: { select: { companyName: true, ico: true, email: true } } } });
    if (!project) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
    const open = await tx.manufacturingOrder.findFirst({ where: { projectId: project.id, status: { in: [ORDER_STATUS.SENT, ORDER_STATUS.ACCEPTED, ORDER_STATUS.TESTED] } }, select: { number: true } });
    if (open) throw new WorkflowError("VALIDATION", `Rozváděč už je ve výrobě (zakázka ${open.number}).`);
    if (input.manufacturerId) {
      const manufacturer = await tx.panelManufacturer.findFirst({ where: { id: input.manufacturerId, active: true }, select: { id: true } });
      if (!manufacturer) throw new WorkflowError("VALIDATION", "Vybraný výrobce není aktivní.");
    } else {
      const count = await tx.panelManufacturer.count({ where: { region: input.region, active: true } });
      if (!count) throw new WorkflowError("VALIDATION", `V kraji ${input.region} zatím není žádný certifikovaný výrobce ELDOCK – vyberte jiný kraj nebo konkrétního výrobce.`);
    }
    const year = now.getFullYear();
    const sequence = (await tx.manufacturingOrder.count({ where: { number: { startsWith: `VYR-${year}-` } } })) + 1;
    // QR štítek z registru (sériové číslo přiděluje jen registr – fáze 103)
    const qrSerial = await ensureProjectLabel(tx, project, project.company);
    const order = await tx.manufacturingOrder.create({
      data: {
        number: orderNumber(year, sequence),
        projectId: project.id,
        companyId: input.companyId,
        manufacturerId: input.manufacturerId,
        region: input.region,
        broadcast: !input.manufacturerId,
        status: ORDER_STATUS.SENT,
        qrSerial,
        configJson: JSON.stringify(input.config),
        estimateJson: JSON.stringify(input.estimate),
        contactName: input.contactName.trim(),
        contactEmail: input.contactEmail.trim().toLowerCase(),
        contactPhone: input.contactPhone?.trim() || null,
        deliveryAddress: input.deliveryAddress?.trim() || null,
        note: input.note?.trim() || null,
        createdAt: now,
      },
    });
    return { id: order.id, number: order.number, qrSerial };
  });
}

/** Zakázky výrobce: přidělené jemu a nepřijaté poptávky „všem v regionu“ z jeho kraje. */
export async function manufacturerOrders(prisma: PrismaClient, manufacturerId: string) {
  const manufacturer = await prisma.panelManufacturer.findUniqueOrThrow({ where: { id: manufacturerId }, select: { region: true } });
  return prisma.manufacturingOrder.findMany({
    where: { OR: [{ manufacturerId }, { broadcast: true, manufacturerId: null, region: manufacturer.region, status: ORDER_STATUS.SENT }] },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, code: true, name: true } }, company: { select: { companyName: true } } },
  });
}

/** Zakázka, kterou výrobce smí vidět (jeho, nebo otevřená poptávka jeho kraje). */
export async function orderForManufacturer(prisma: PrismaClient, orderId: string, manufacturerId: string) {
  const manufacturer = await prisma.panelManufacturer.findUniqueOrThrow({ where: { id: manufacturerId }, select: { region: true, name: true, ico: true } });
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: orderId, OR: [{ manufacturerId }, { broadcast: true, manufacturerId: null, region: manufacturer.region, status: ORDER_STATUS.SENT }] } });
  if (!order) throw new WorkflowError("NOT_FOUND", "Zakázka nebyla nalezena.");
  return { order, manufacturer };
}

/** ✅ Přijmout zakázku do výroby (cena a termín) – u poptávky všem vyhraje první výrobce (podmíněný update). */
export async function acceptManufacturingOrder(prisma: PrismaClient, input: { orderId: string; manufacturerId: string; priceCzk: number; days: number; now?: Date }) {
  if (!(input.priceCzk > 0) || !(input.days >= 1 && input.days <= 120)) throw new WorkflowError("VALIDATION", "Zadejte cenu výroby a termín dodání (1–120 pracovních dnů).");
  const { order } = await orderForManufacturer(prisma, input.orderId, input.manufacturerId);
  const result = await prisma.manufacturingOrder.updateMany({
    where: { id: order.id, status: ORDER_STATUS.SENT, OR: [{ manufacturerId: input.manufacturerId }, { manufacturerId: null }] },
    data: { manufacturerId: input.manufacturerId, status: ORDER_STATUS.ACCEPTED, acceptedPriceCzk: Math.round(input.priceCzk), acceptedDays: Math.round(input.days), acceptedAt: input.now ?? new Date() },
  });
  if (!result.count) throw new WorkflowError("CONFLICT", "Zakázku už přijal jiný výrobce.");
  return { number: order.number };
}

/** Výstupní kusová zkouška výrobce (po výrobě a prodrátování). */
export async function recordFactoryTest(prisma: PrismaClient, input: { orderId: string; manufacturerId: string; test: FactoryTestInput; now?: Date }) {
  const parsed = factoryTestSchema.safeParse(input.test);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatný protokol kusové zkoušky.");
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: input.orderId, manufacturerId: input.manufacturerId, status: { in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.TESTED] } } });
  if (!order) throw new WorkflowError("NOT_FOUND", "Zakázka není ve výrobě u vás.");
  const issues = factoryTestIssues(parsed.data);
  await prisma.manufacturingOrder.update({ where: { id: order.id }, data: { routineTestJson: JSON.stringify(parsed.data), enclosureSerial: parsed.data.enclosureSerial, status: ORDER_STATUS.TESTED, testedAt: input.now ?? new Date() } });
  return { issues };
}

/**
 * 🔒 Dokončit výrobu: uzamknout dokumentaci rozváděče jako Verzi 1.0 pod štítkem EL-… (snímek 6listového elaborátu
 * s protokolem výrobce) a zakázku označit jako vyrobenou, odzkoušenou a připravenou k převzetí / odeslání.
 * `documentation` připraví volající (server stránky / akce) – `buildDocumentationData` nad projektem.
 */
export async function completeManufacturingOrder(prisma: PrismaClient, input: { orderId: string; manufacturerId: string; documentationJson: string; floorplan: { name: string; json: string } | null; now?: Date }) {
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: input.orderId, manufacturerId: input.manufacturerId, status: ORDER_STATUS.TESTED }, include: { manufacturer: { select: { name: true, ico: true } } } });
  if (!order || !order.routineTestJson || !order.manufacturer) throw new WorkflowError("VALIDATION", "Nejdřív zapište výstupní kusovou zkoušku.");
  const test = factoryTestSchema.parse(JSON.parse(order.routineTestJson));
  const issues = factoryTestIssues(test);
  if (issues.length) throw new WorkflowError("VALIDATION", `Kusová zkouška nevyhověla: ${issues.join(" ")} Nevyhovující rozváděč se nevydává.`);
  const inspection = parseInspection(inspectionFromFactoryTest(test, order.manufacturer));
  const now = input.now ?? new Date();
  const published = await publishVersion(prisma, { projectId: order.projectId, companyId: order.companyId, inspection, documentationJson: input.documentationJson, floorplan: input.floorplan, routineTestJson: JSON.stringify(routineTestFromFactory(test, order.manufacturer)), now });
  await prisma.manufacturingOrder.update({ where: { id: order.id }, data: { status: ORDER_STATUS.COMPLETED, completedAt: now, version: published.version } });
  return { number: order.number, version: published.version, serial: published.serial, contactEmail: order.contactEmail, contactName: order.contactName };
}

/** Zakázky výroby rozváděče u firmy (stav v kroku 4). */
export function projectOrders(prisma: PrismaClient, projectId: string, companyId: string) {
  return prisma.manufacturingOrder.findMany({ where: { projectId, companyId }, orderBy: { createdAt: "desc" }, include: { manufacturer: { select: { name: true, region: true, phone: true, email: true } } } });
}
