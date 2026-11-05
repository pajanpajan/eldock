import type { PrismaClient } from "@/generated/prisma/client";
import { COMPANY_INFO } from "@/lib/company";
import { creditPackage, nextVariableSymbol, normalizeIban, withVat } from "@/lib/credits";
import { parseRailPhotos } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Kredity, objednávky a hlášení chyb AI (fáze 50). Potvrzení úhrady a ruční úpravy kreditů volá jen
// velín /superadmin (kontrola přístupu v Server Actions), objednávku a hlášení zakládá přihlášená firma.

/** Účet pro QR platbu: `ELDOCK_BANK_IBAN`, jinak demo IBAN z `COMPANY_INFO`. */
export const bankIban = () => normalizeIban(process.env.ELDOCK_BANK_IBAN) ?? COMPANY_INFO.demoIban;

/** Nová objednávka balíčku s variabilním symbolem roku (při souběhu se VS zkusí znovu). */
export async function createCreditOrder(prisma: PrismaClient, companyId: string, packageCode: string, now = new Date()) {
  const pkg = creditPackage(packageCode);
  if (!pkg) throw new WorkflowError("VALIDATION", "Neznámý balíček kreditů.");
  const year = now.getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.creditOrder.findMany({ where: { variableSymbol: { startsWith: String(year) } }, select: { variableSymbol: true } });
    try {
      return await prisma.creditOrder.create({
        data: {
          companyId,
          variableSymbol: nextVariableSymbol(existing.map((row) => row.variableSymbol), year),
          packageCode: pkg.code,
          creditsCount: pkg.credits,
          priceCzkExclVat: pkg.priceExclVat,
          priceCzkInclVat: withVat(pkg.priceExclVat),
          createdAt: now,
        },
      });
    } catch (error) {
      // Unikátní VS obsadila souběžná objednávka – další pokus s novým číslem
      if (!(error instanceof Error && /Unique constraint/i.test(error.message)) || attempt === 4) throw error;
    }
  }
  throw new WorkflowError("CONFLICT", "Objednávku se nepodařilo založit, zkuste to znovu.");
}

/** ✅ Potvrdit úhradu: v jedné transakci PENDING → PAID a připsání kreditů (opakované potvrzení nic nepřičte). */
export async function confirmCreditOrder(prisma: PrismaClient, orderId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.creditOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new WorkflowError("NOT_FOUND", "Objednávka neexistuje.");
    const { count } = await tx.creditOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID", paidAt: now } });
    if (!count) throw new WorkflowError("INVALID_STATE", `Objednávka VS ${order.variableSymbol} už není čekající (${order.status === "PAID" ? "uhrazena" : "stornována"}).`);
    const company = await tx.registeredCompany.update({ where: { id: order.companyId }, data: { creditsRemaining: { increment: order.creditsCount } }, select: { id: true, companyName: true, creditsRemaining: true } });
    return { order: { ...order, status: "PAID" as const, paidAt: now }, company };
  });
}

export async function cancelCreditOrder(prisma: PrismaClient, orderId: string) {
  const { count } = await prisma.creditOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (!count) throw new WorkflowError("INVALID_STATE", "Stornovat lze jen čekající objednávku.");
}

export const MAX_CREDITS = 100_000;

/** Ruční úprava kreditů ve velínu: přičíst (+5 / +10 / +50) nebo nastavit přesnou hodnotu. */
export async function adjustCredits(prisma: PrismaClient, companyId: string, change: { add: number } | { set: number }) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { creditsRemaining: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const target = "set" in change ? change.set : company.creditsRemaining + change.add;
  if (!Number.isInteger(target) || target < 0 || target > MAX_CREDITS) throw new WorkflowError("VALIDATION", `Počet kreditů musí být 0–${MAX_CREDITS}.`);
  return prisma.registeredCompany.update({ where: { id: companyId }, data: { creditsRemaining: target }, select: { id: true, creditsRemaining: true } });
}

// ---------------------------------------------------------------------------
//  🐛 Hlášení chyb AI rozpoznání
// ---------------------------------------------------------------------------

export interface FeedbackSnapshot {
  code: string;
  name: string;
  designMode: string;
  analysisMode: string | null;
  railPhotos: Record<string, string>;
  items: { designation: string; rail: number; position: number; modules: number; status: string; category: string | null; typeCode: string | null; manufacturer: string | null; label: string; ocr: string | null }[];
}

/** Uloží hlášení se snímkem lišt a prvků projektu firmy (cizí projekt = nenalezen). */
export async function createAiFeedback(prisma: PrismaClient, companyId: string, projectId: string, message: string) {
  const text = message.trim().slice(0, 2000);
  if (text.length < 3) throw new WorkflowError("VALIDATION", "Napište krátký popis chyby.");
  const project = await prisma.panelBoardProject.findFirst({
    where: { id: projectId, companyId },
    include: { items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], include: { catalogComponent: { select: { category: true, typeCode: true, manufacturer: true } } } } },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  const snapshot: FeedbackSnapshot = {
    code: project.code,
    name: project.name,
    designMode: project.designMode,
    analysisMode: project.analysisMode,
    railPhotos: parseRailPhotos(project.railPhotosJson),
    items: project.items.map((item) => ({
      designation: item.designation,
      rail: item.dinRailIndex,
      position: item.positionOnRail,
      modules: item.modulesWidth,
      status: item.recognitionStatus,
      category: item.catalogComponent?.category ?? null,
      typeCode: item.customTypeCode ?? item.catalogComponent?.typeCode ?? null,
      manufacturer: item.catalogComponent?.manufacturer ?? null,
      label: item.circuitLabel,
      ocr: item.rawOcrText || null,
    })),
  };
  return prisma.aiFeedbackReport.create({ data: { projectId, companyId, photoUrl: project.photoUrl, detectedSnapshotJson: JSON.stringify(snapshot), message: text } });
}

export function parseFeedbackSnapshot(json: string): FeedbackSnapshot | null {
  try {
    const value = JSON.parse(json) as FeedbackSnapshot;
    return value && Array.isArray(value.items) ? value : null;
  } catch {
    return null;
  }
}

export async function resolveAiFeedback(prisma: PrismaClient, reportId: string, adminNote: string | null) {
  return prisma.aiFeedbackReport.update({ where: { id: reportId }, data: { status: "RESOLVED", adminNote: adminNote?.trim().slice(0, 1000) || null } });
}
