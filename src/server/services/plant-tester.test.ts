import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { PLANT_TESTER } from "@/lib/registered-company";

import { verifyCredentials } from "./account-security";
import { ensurePlantTester } from "./plant-tester";
import { createPairingCode } from "./sync";
import { createTestDb } from "./test-db";

// Testovací firma Správy závodů (2026-11-10): obecné přihlášení pro testy webu i aplikací.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(async () => db.cleanup());

describe("testovací firma Správy závodů", () => {
  it("založí firmu, závod s halou a dva účty s obecným heslem, které smí párovat aplikace; podruhé nic nezmění", async () => {
    const result = await ensurePlantTester(prisma, new Date("2026-11-10T08:00:00Z"));
    expect(result).toMatchObject({ created: true, users: 2, equipment: 5 });

    const company = await prisma.registeredCompany.findUniqueOrThrow({ where: { email: PLANT_TESTER.email } });
    expect(company).toMatchObject({ productScope: "PLANT_MANAGEMENT", companyName: PLANT_TESTER.companyName });
    const users = await prisma.user.findMany({ where: { companyId: company.id }, orderBy: { email: "asc" } });
    // Řazení podle e-mailu (binárně: „-“ je před „@“)
    expect(users.map((user) => [user.email, user.accountType, user.homePlantId])).toEqual([
      [PLANT_TESTER.technician.email, "MAINTENANCE_TECH", company.plantId],
      [PLANT_TESTER.email, "PLANT_ADMIN", company.plantId],
    ]);
    expect(users.every((user) => !user.mustChangePassword)).toBe(true);

    // Obecné heslo platí pro oba účty, jiné ne
    for (const email of [PLANT_TESTER.email, PLANT_TESTER.technician.email]) {
      expect((await verifyCredentials(prisma, { email, password: PLANT_TESTER.password })).user?.email).toBe(email);
    }
    expect((await verifyCredentials(prisma, { email: PLANT_TESTER.email, password: "Spatne2026!" })).user).toBeNull();

    // Hala A ze Studia: rozváděče s hierarchií napájení a QR štítkem pro aplikace
    const equipment = await prisma.equipment.findMany({ where: { floor: { building: { plantId: company.plantId! } } }, include: { fedFrom: { select: { tag: true } } }, orderBy: { tag: "asc" } });
    expect(equipment.map((item) => [item.tag, item.fedFrom?.tag ?? null])).toEqual([
      ["K1", "RH1"],
      ["L1", "RM-L1"],
      ["RH1", null],
      ["RM-L1", "RH1"],
      ["SP-0001", "RH1"],
    ]);
    expect(equipment.every((item) => item.qrToken)).toBe(true);

    // Na rozdíl od obchodního dema smí účty firmy párovat aplikace Windows / iOS / Android
    const technician = users.find((user) => user.email === PLANT_TESTER.technician.email)!;
    await expect(createPairingCode(prisma, { userId: technician.id })).resolves.toBeTruthy();

    // Druhé spuštění (každý start kontejneru) nic nezaloží ani nepřepíše
    expect(await ensurePlantTester(prisma)).toEqual({ created: false });
    expect(await prisma.registeredCompany.count({ where: { email: PLANT_TESTER.email } })).toBe(1);
    expect(await prisma.equipment.count({ where: { floor: { building: { plantId: company.plantId! } } } })).toBe(5);
  });
});
