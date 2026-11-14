import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_LABEL_SETS, DEFAULT_OPERATOR, LABEL_SETS_KEY, bankLine, operatorSchema, operatorSummary, parseLabelSets } from "@/lib/operator";
import { PLANT_TESTER, TESTER_COMPANY, panelRegistrationSchema, plantRegistrationSchema } from "@/lib/registered-company";

import { verifyCredentials } from "./account-security";
import { authenticateCompany, registerPanelCompany, registerPlantCompany } from "./companies";
import { cancelCreditOrder, chargeNewSwitchboard, confirmCreditOrder, createCreditOrder, grantProvisionalCredits, revokeProvisionalCredits } from "./credits";
import { ensureDefaultLabelSets, labelSetsOf, saveLabelSets } from "./operator";
import { notifyOrderOwner } from "./order-notify";
import { ensurePlantTester } from "./plant-tester";
import { bridgePanelToPlant, bridgePlantToPanel, linkCompanies, linkedCompanyOf } from "./sso-bridge";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 114: SSO přemostění, předběžné připsání kreditů po QR platbě, notifikace objednávek a výchozí sady QR štítků.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

const base = {
  ico: "12345679",
  dic: "",
  companyName: "Elektro Novák s.r.o.",
  street: "Nádražní 15",
  city: "Turnov",
  zip: "511 01",
  contactName: "Jan Novák",
  phone: "+420 777 000 111",
  authorizationNumber: "E-0815/2021",
  email: "jan@novak.cz",
  password: "tajneheslo",
  termsAccepted: true,
};

describe("fáze 114 – SSO přemostění AI Panel Builderu a Hlídače revizí / Správy závodů", () => {
  it("Panel Builder → Hlídač: spárovaný účet se stejným e-mailem i heslem se založí jednou, podruhé se jen přihlásí", async () => {
    const panel = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base));
    const first = await bridgePanelToPlant(prisma, panel.id);
    expect(first).toMatchObject({ kind: "session", created: true });
    if (first.kind !== "session") return;
    const plant = await prisma.registeredCompany.findUniqueOrThrow({ where: { id: first.companyId } });
    expect(plant).toMatchObject({ productScope: "PLANT_MANAGEMENT", email: "jan@novak.cz", ico: "12345679", linkedCompanyId: panel.id });
    expect((await prisma.registeredCompany.findUniqueOrThrow({ where: { id: panel.id } })).linkedCompanyId).toBe(plant.id);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: first.userId } })).toMatchObject({ accountType: "PLANT_ADMIN", companyId: plant.id, homePlantId: first.plantId });
    // Stejné heslo jako v Panel Builderu – /login funguje i bez přemostění
    expect((await verifyCredentials(prisma, { email: "jan@novak.cz", password: "tajneheslo" })).user?.id).toBe(first.userId);
    expect(await authenticateCompany(prisma, "jan@novak.cz", "tajneheslo", "PLANT_MANAGEMENT")).toMatchObject({ id: plant.id });
    expect(await authenticateCompany(prisma, "jan@novak.cz", "tajneheslo", "PANEL_BUILDER")).toMatchObject({ id: panel.id });
    const again = await bridgePanelToPlant(prisma, panel.id);
    expect(again).toMatchObject({ kind: "session", created: false, userId: first.userId });
    expect(await prisma.registeredCompany.count({ where: { productScope: "PLANT_MANAGEMENT" } })).toBe(1);
    expect(await linkedCompanyOf(prisma, panel.id)).toMatchObject({ id: plant.id, productScope: "PLANT_MANAGEMENT" });
  });

  it("cizí nespárovaný účet se stejným e-mailem se nepřebírá – nutné přihlášení heslem a 🔗 propojení", async () => {
    const plant = await registerPlantCompany(prisma, plantRegistrationSchema.parse({ ...base, plantName: "Hlavní závod" }));
    const panel = await registerPanelCompany(prisma, panelRegistrationSchema.parse({ ...base, password: "jineheslo99" }));
    const result = await bridgePanelToPlant(prisma, panel.id);
    expect(result).toMatchObject({ kind: "login", reason: "exists" });
    expect(await prisma.user.count({ where: { email: "jan@novak.cz" } })).toBe(1);
    // Přihlášený v obou produktech propojí účty
    expect(await linkCompanies(prisma, panel.id, plant.companyId)).toEqual({ linked: true });
    expect(await bridgePanelToPlant(prisma, panel.id)).toMatchObject({ kind: "session", created: false, userId: plant.userId });
    expect(await bridgePlantToPanel(prisma, plant.userId)).toEqual({ kind: "company", companyId: panel.id, created: false });
  });

  it("dvoufázové ověření se SSO neobejde; Hlídač → Panel Builder založí firmu AI Panel Builderu se stejným e-mailem", async () => {
    const plant = await registerPlantCompany(prisma, plantRegistrationSchema.parse({ ...base, plantName: "Hlavní závod" }));
    const toPanel = await bridgePlantToPanel(prisma, plant.userId);
    expect(toPanel).toMatchObject({ kind: "company", created: true });
    if (toPanel.kind !== "company") return;
    expect(await prisma.registeredCompany.findUniqueOrThrow({ where: { id: toPanel.companyId } })).toMatchObject({ productScope: "PANEL_BUILDER", email: "jan@novak.cz", linkedCompanyId: plant.companyId, creditsRemaining: 0, trialSwitchboardUsed: false });
    await prisma.user.update({ where: { id: plant.userId }, data: { totpEnabledAt: new Date() } });
    expect(await bridgePanelToPlant(prisma, toPanel.companyId)).toMatchObject({ kind: "login", reason: "two-factor" });
    // Účet spárovaný s jinou firmou se propojením nepřepíše
    const other = await registerPanelCompany(prisma, panelRegistrationSchema.parse({ ...base, email: "jiny@novak.cz" }));
    await expect(linkCompanies(prisma, other.id, plant.companyId)).rejects.toThrow(/propojený s jiným/);
  });
});

describe("fáze 114 – okamžité odemčení kreditů po QR platbě (PROVISIONAL_GRANT) a notifikace objednávky", () => {
  it("„Zaplatil jsem“: kredity hned, objednávka čeká na kontrolu výpisu; potvrzení v bance nepřipíše podruhé", async () => {
    const panel = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base));
    const order = await createCreditOrder(prisma, panel.id, "START_30", new Date("2026-11-14T20:00:00Z"));
    const granted = await grantProvisionalCredits(prisma, panel.id, order.id, new Date("2026-11-14T20:05:00Z"));
    expect(granted).toMatchObject({ credits: 30, already: false, balance: 30 });
    expect(await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "PENDING", provisionalAt: new Date("2026-11-14T20:05:00Z") });
    expect(await prisma.creditTransaction.findFirst({ where: { companyId: panel.id }, orderBy: { createdAt: "desc" } })).toMatchObject({ reason: "PROVISIONAL_GRANT", amount: 30, refId: order.id });
    // Opakované kliknutí nic nepřipíše
    expect(await grantProvisionalCredits(prisma, panel.id, order.id)).toMatchObject({ already: true, credits: 0 });
    // Hned lze utratit (rozváděč 15 kr. po zkušebním)
    await prisma.registeredCompany.update({ where: { id: panel.id }, data: { trialSwitchboardUsed: true } });
    expect((await chargeNewSwitchboard(prisma, panel.id)).plan).toMatchObject({ license: "PAID", cost: 15 });
    // Velín: ✅ Potvrdit platbu v bance → PAID bez druhého připsání
    await confirmCreditOrder(prisma, order.id, new Date("2026-11-15T08:00:00Z"));
    expect((await prisma.registeredCompany.findUniqueOrThrow({ where: { id: panel.id } })).creditsRemaining).toBe(15);
    expect(await prisma.creditTransaction.count({ where: { companyId: panel.id, reason: { in: ["TOP_UP", "PROVISIONAL_GRANT"] } } })).toBe(1);
  });

  it("nejvýš 1 předběžná objednávka; nezaplaceno po 48 h → odečet (i do mínusu) a další předběžné připsání už ne; štítky ne", async () => {
    const panel = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base));
    const first = await createCreditOrder(prisma, panel.id, "MONTER_125");
    const second = await createCreditOrder(prisma, panel.id, "START_30");
    await grantProvisionalCredits(prisma, panel.id, first.id);
    await expect(grantProvisionalCredits(prisma, panel.id, second.id)).rejects.toThrow(/jen 1 neuhrazenou objednávku/);
    await expect(cancelCreditOrder(prisma, first.id)).rejects.toThrow(/bez předběžně připsaných kreditů/);
    await prisma.registeredCompany.update({ where: { id: panel.id }, data: { creditsRemaining: { decrement: 100 } } });
    expect(await revokeProvisionalCredits(prisma, first.id)).toEqual({ balance: -100, credits: 125 });
    expect(await prisma.creditOrder.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: "CANCELLED", provisionalRevokedAt: expect.any(Date) });
    await expect(grantProvisionalCredits(prisma, panel.id, second.id)).rejects.toThrow(/už u vaší firmy není k dispozici/);
    const labels = await createCreditOrder(prisma, panel.id, "LABELS_A100");
    await expect(grantProvisionalCredits(prisma, panel.id, labels.id)).rejects.toThrow(/jen balíček kreditů/);
  });

  it("notifikace majiteli při objednávce (SMTP + webhook), výsledek u objednávky pro velín", async () => {
    const panel = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base));
    const order = await createCreditOrder(prisma, panel.id, "LABELS_A100");
    const mails: { to: string[]; subject: string }[] = [];
    const hooks: string[] = [];
    const result = await notifyOrderOwner(prisma, order.id, "created", {
      smtp: async (message) => void mails.push(message),
      fetchImpl: (async (url: string, init?: RequestInit) => {
        hooks.push(`${url} ${String(init?.body)}`);
        return new Response("ok");
      }) as typeof fetch,
      env: (name) => ({ CONTACT_WEBHOOK_URL: "https://hooks.example/eldock", CONTACT_NOTIFY_EMAIL: "majitel@example.cz" })[name],
      now: new Date("2026-11-14T10:00:00Z"),
    });
    expect(result).toEqual({ sent: ["smtp", "webhook"], errors: [] });
    expect(mails[0]).toMatchObject({ to: ["majitel@example.cz"] });
    expect(mails[0].subject).toContain(`Nová objednávka VS ${order.variableSymbol}`);
    expect(mails[0].subject).toContain("Elektro Novák s.r.o.");
    expect(hooks[0]).toContain("https://hooks.example/eldock");
    expect(await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ ownerNotifiedAt: new Date("2026-11-14T10:00:00Z"), ownerNotifyError: null });
    // Bez SMTP i webhooku – upozornění jen ve velínu
    expect(await notifyOrderOwner(prisma, order.id, "provisional", { smtp: null, env: () => undefined })).toEqual({ sent: [], errors: [] });
    expect((await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } })).ownerNotifyError).toMatch(/jen ve velínu/);
  });
});

describe("fáze 114 – provozovatel neplátce DPH a výchozí sady QR štítků", () => {
  it("výchozí profil: Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou · Neplátce DPH, účet Raiffeisenbank; IČO / DIČ volitelné", () => {
    expect(DEFAULT_OPERATOR.vatPayer).toBe(false);
    expect(operatorSummary(DEFAULT_OPERATOR)).toBe("Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou · Neplátce DPH");
    expect(bankLine(DEFAULT_OPERATOR)).toContain("918118002/5500");
    expect(bankLine(DEFAULT_OPERATOR)).toMatch(/IBAN CZ\d{2} /);
    expect(operatorSchema.safeParse({ ...DEFAULT_OPERATOR, ico: "", dic: "", registry: "" }).success).toBe(true);
    expect(operatorSummary({ ...DEFAULT_OPERATOR, ico: "27082440", vatPayer: true, dic: "CZ27082440" })).toBe("Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou · IČO 27082440 · DIČ CZ27082440");
  });

  it("při startu: chybějící nebo prázdný seznam sad → 5 výchozích sad; sady z velínu se nepřepíšou; prázdný seznam nejde uložit", async () => {
    // Migrace fáze 113 sady založila – bez záznamu (nová databáze) je založí start serveru
    await prisma.platformSetting.deleteMany({ where: { key: LABEL_SETS_KEY } });
    expect(await ensureDefaultLabelSets(prisma)).toBe(true);
    expect((await labelSetsOf(prisma)).map((set) => set.code)).toEqual(DEFAULT_LABEL_SETS.map((set) => set.code));
    await prisma.platformSetting.update({ where: { key: LABEL_SETS_KEY }, data: { valueJson: "[]" } });
    expect(parseLabelSets("[]")).toHaveLength(5);
    expect(await ensureDefaultLabelSets(prisma)).toBe(true);
    expect(JSON.parse((await prisma.platformSetting.findUniqueOrThrow({ where: { key: LABEL_SETS_KEY } })).valueJson)).toHaveLength(5);
    await saveLabelSets(prisma, [{ title: "Vlastní sada", description: "", items: [{ kind: "A", count: 20 }], priceExclVat: 199 }]);
    expect(await ensureDefaultLabelSets(prisma)).toBe(false);
    expect((await labelSetsOf(prisma)).map((set) => set.title)).toEqual(["Vlastní sada"]);
    await expect(saveLabelSets(prisma, [])).rejects.toThrow(/aspoň jednu sadu/);
  });
});

describe("fáze 114 – ukázková firma Tester → veřejná testovací firma Správy závodů", () => {
  it("start serveru propojí Tester s testovací firmou závodu; SSO z ukázky nezakládá další sdílený účet", async () => {
    await prisma.registeredCompany.create({ data: { id: TESTER_COMPANY.id, productScope: "PANEL_BUILDER", ico: "12345679", companyName: "Elektro Tester s.r.o.", street: "Průmyslová 1", city: "Jablonec nad Nisou", zip: "466 01", contactName: "Ing. Tomáš Tester", email: TESTER_COMPANY.email, phone: "+420 777 123 456", passwordHash: "x", termsAcceptedAt: new Date() } });
    await ensurePlantTester(prisma, new Date("2026-11-14T08:00:00Z"));
    const plant = await prisma.registeredCompany.findFirstOrThrow({ where: { email: PLANT_TESTER.email, productScope: "PLANT_MANAGEMENT" } });
    expect(plant.linkedCompanyId).toBe(TESTER_COMPANY.id);
    const bridged = await bridgePanelToPlant(prisma, TESTER_COMPANY.id);
    expect(bridged).toMatchObject({ kind: "session", created: false, companyId: plant.id });
    expect(await prisma.registeredCompany.count({ where: { productScope: "PLANT_MANAGEMENT" } })).toBe(1);
  });
});
