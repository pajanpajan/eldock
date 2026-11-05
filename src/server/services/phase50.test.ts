import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { adjustCredits, cancelCreditOrder, confirmCreditOrder, createAiFeedback, createCreditOrder, parseFeedbackSnapshot, resolveAiFeedback } from "./credits";
import { createPanelProject } from "./panel-builder";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const credits = async () => (await prisma.registeredCompany.findUniqueOrThrow({ where: { id: companyId } })).creditsRemaining;

describe("objednávky kreditů", () => {
  it("objednávka má VS roku, cenu s DPH a čeká na úhradu", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    const first = await createCreditOrder(prisma, companyId, "PROFI_30", now);
    const second = await createCreditOrder(prisma, companyId, "START_10", now);
    expect(first).toMatchObject({ variableSymbol: "20260001", creditsCount: 30, priceCzkExclVat: 2490, priceCzkInclVat: 3013, status: "PENDING" });
    expect(second.variableSymbol).toBe("20260002");
    await expect(createCreditOrder(prisma, companyId, "ZDARMA_999")).rejects.toThrow(/Neznámý balíček/);
  });

  it("✅ potvrzení úhrady v transakci: PAID + paidAt + kredity firmě; podruhé nic nepřičte", async () => {
    const order = await createCreditOrder(prisma, companyId, "START_10");
    const before = await credits();
    const paidAt = new Date("2026-11-06T08:00:00Z");
    const result = await confirmCreditOrder(prisma, order.id, paidAt);
    expect(result.company.creditsRemaining).toBe(before + 10);
    expect(await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "PAID", paidAt });
    await expect(confirmCreditOrder(prisma, order.id)).rejects.toThrow(/už není čekající/);
    expect(await credits()).toBe(before + 10);
  });

  it("storno jen čekající objednávky; stornovanou nelze potvrdit", async () => {
    const order = await createCreditOrder(prisma, companyId, "UNLIMITED_YEAR");
    await cancelCreditOrder(prisma, order.id);
    await expect(cancelCreditOrder(prisma, order.id)).rejects.toThrow(/čekající/);
    await expect(confirmCreditOrder(prisma, order.id)).rejects.toThrow(/stornována/);
  });

  it("ruční úprava kreditů ve velínu: přičíst i nastavit, záporný stav odmítne", async () => {
    const before = await credits();
    expect((await adjustCredits(prisma, companyId, { add: 50 })).creditsRemaining).toBe(before + 50);
    expect((await adjustCredits(prisma, companyId, { set: 3 })).creditsRemaining).toBe(3);
    await expect(adjustCredits(prisma, companyId, { add: -10 })).rejects.toThrow(/0–/);
    await expect(adjustCredits(prisma, "neexistuje", { add: 1 })).rejects.toThrow(/neexistuje/);
  });
});

describe("🐛 hlášení chyb AI", () => {
  it("uloží zprávu, fotku a snímek lišt a prvků projektu; vyřešení s poznámkou", async () => {
    const sample = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" }, include: { items: true } });
    const report = await createAiFeedback(prisma, companyId, sample.id, "  Špatně rozpoznaný stykač na 2. liště ");
    expect(report).toMatchObject({ projectId: sample.id, companyId, photoUrl: sample.photoUrl, message: "Špatně rozpoznaný stykač na 2. liště", status: "OPEN" });
    const snapshot = parseFeedbackSnapshot(report.detectedSnapshotJson);
    expect(snapshot?.code).toBe("PB-001");
    expect(snapshot?.items).toHaveLength(sample.items.length);
    expect(snapshot?.items[0]).toMatchObject({ rail: 1, position: 1 });
    const resolved = await resolveAiFeedback(prisma, report.id, " opraven prompt ");
    expect(resolved).toMatchObject({ status: "RESOLVED", adminNote: "opraven prompt" });
    // Smazaný projekt hlášení zachová (vazba SetNull)
    await prisma.panelBoardProject.delete({ where: { id: sample.id } });
    expect((await prisma.aiFeedbackReport.findUniqueOrThrow({ where: { id: report.id } })).projectId).toBeNull();
  });

  it("cizí projekt = nenalezen, prázdná zpráva = chyba", async () => {
    const foreign = await createPanelProject(prisma, { name: "cizí", customerName: null, photoUrl: null, designMode: "DESIGN", companyId: null });
    await expect(createAiFeedback(prisma, companyId, foreign.id, "chyba")).rejects.toThrow(/nebyl nalezen/);
    const sample = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } });
    await expect(createAiFeedback(prisma, companyId, sample.id, " ")).rejects.toThrow(/popis/);
  });
});
