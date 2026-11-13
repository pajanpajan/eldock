import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { panelRegistrationSchema, plantRegistrationSchema } from "@/lib/registered-company";

import { verifyPassword } from "../password";
import { authenticateCompany, registerPanelCompany, registerPlantCompany, updateCompanyDetails } from "./companies";
import { chargeNewSwitchboard } from "./credits";
import { createPanelProject } from "./panel-builder";
import { createTestDb, seedMinimal } from "./test-db";

// Registrované firmy (fáze 41) nad SQLite z migrací.

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

describe("AI Panel Builder – registrace firmy", () => {
  it("registrace s hashem hesla a souhlasem, 0 kreditů + 1 testovací projekt (fáze 111); přihlášení jen do svého produktu", async () => {
    const company = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base), new Date("2026-11-03T10:00:00Z"));
    expect(company.creditsRemaining).toBe(0);
    expect(await prisma.registeredCompany.findUniqueOrThrow({ where: { id: company.id }, select: { trialFloorplanUsed: true, trialSwitchboardUsed: true } })).toEqual({ trialFloorplanUsed: false, trialSwitchboardUsed: false });
    const row = await prisma.registeredCompany.findUniqueOrThrow({ where: { id: company.id } });
    expect(row).toMatchObject({ productScope: "PANEL_BUILDER", termsVersion: "1.3-2026-11", authorizationNumber: "E-0815/2021", dic: null });
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("tajneheslo");
    expect(await verifyPassword("tajneheslo", row.passwordHash)).toBe(true);
    expect(row.termsAcceptedAt.toISOString()).toBe("2026-11-03T10:00:00.000Z");

    expect(await authenticateCompany(prisma, "JAN@novak.cz ", "tajneheslo", "PANEL_BUILDER")).toMatchObject({ id: company.id });
    expect(await authenticateCompany(prisma, "jan@novak.cz", "spatne-heslo", "PANEL_BUILDER")).toBeNull();
    expect(await authenticateCompany(prisma, "jan@novak.cz", "tajneheslo", "PLANT_MANAGEMENT")).toBeNull();
    await expect(registerPanelCompany(prisma, panelRegistrationSchema.parse(base))).rejects.toThrow(/už je registrovaná/);
  });

  it("kredity (fáze 111): zkušební rozváděč zdarma, další 15 kreditů, bez kreditů prodejní modal; úprava firemních údajů", async () => {
    const company = await registerPanelCompany(prisma, panelRegistrationSchema.parse(base));
    expect((await chargeNewSwitchboard(prisma, company.id)).plan).toMatchObject({ license: "TRIAL", cost: 0 });
    await prisma.registeredCompany.update({ where: { id: company.id }, data: { creditsRemaining: 15 } });
    expect((await chargeNewSwitchboard(prisma, company.id)).plan).toMatchObject({ license: "PAID", cost: 15 });
    await expect(chargeNewSwitchboard(prisma, company.id)).rejects.toThrow(/potřebujete 15 kreditů, zbývá 0/);
    expect((await prisma.registeredCompany.findUniqueOrThrow({ where: { id: company.id } })).creditsRemaining).toBe(0);

    const project = await createPanelProject(prisma, { name: "Rozvodnice RD", customerName: null, photoUrl: null, companyId: company.id });
    expect(project.companyId).toBe(company.id);
    await updateCompanyDetails(prisma, company.id, { ...panelRegistrationSchema.parse(base), companyName: "Elektro Novák a syn s.r.o." });
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: project.id }, include: { company: true } })).company?.companyName).toBe("Elektro Novák a syn s.r.o.");
  });
});

describe("Správa závodů – registrace výrobního závodu", () => {
  it("v jedné transakci: firma PLANT_MANAGEMENT, nový závod s čistou mapou a Technický ředitel omezený na svůj závod", async () => {
    const result = await registerPlantCompany(prisma, plantRegistrationSchema.parse({ ...base, plantName: "Hlavní výrobní závod" }));
    expect(result.plant).toMatchObject({ code: "EN", name: "Hlavní výrobní závod" });
    const plant = await prisma.plant.findUniqueOrThrow({ where: { id: result.plant.id }, include: { buildings: true } });
    expect(plant).toMatchObject({ customerName: "Elektro Novák s.r.o.", city: "Turnov", address: "Nádražní 15" });
    expect(plant.buildings).toEqual([]);
    expect(await prisma.registeredCompany.findUniqueOrThrow({ where: { id: result.companyId } })).toMatchObject({ productScope: "PLANT_MANAGEMENT", plantId: plant.id });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: result.userId } })).toMatchObject({ accountType: "PLANT_ADMIN", homePlantId: plant.id, companyId: result.companyId, email: "jan@novak.cz" });
    expect(await authenticateCompany(prisma, "jan@novak.cz", "tajneheslo", "PLANT_MANAGEMENT")).toMatchObject({ plantId: plant.id });
  });

  it("e-mail obsazený uživatelem: nic nevznikne (transakce se vrátí)", async () => {
    const taken = (await prisma.user.findFirstOrThrow()).email;
    const plants = await prisma.plant.count();
    await expect(registerPlantCompany(prisma, plantRegistrationSchema.parse({ ...base, email: taken, plantName: "Závod 2" }))).rejects.toThrow(/už existuje/);
    expect(await prisma.plant.count()).toBe(plants);
    expect(await prisma.registeredCompany.count()).toBe(0);
  });
});
