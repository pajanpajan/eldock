import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { createPlant } from "./plants";
import { createTestDb, seedMinimal } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

describe("createPlant", () => {
  it("založí čistý areál s kódem, městem a adresou", async () => {
    const plant = await createPlant(prisma, { name: "Závod Turnov – Optika", code: "tur", location: "Nádražní 15, Turnov" });
    expect(plant).toMatchObject({ code: "TUR", name: "Závod Turnov – Optika", city: "Turnov", address: "Nádražní 15", customerName: "Závod Turnov – Optika" });
    expect(await prisma.building.count({ where: { plantId: plant.id } })).toBe(0);
  });

  it("odmítne duplicitní nebo neplatný kód a krátký název", async () => {
    await expect(createPlant(prisma, { name: "Test", code: "TST" })).rejects.toThrow(/TST už existuje/);
    await expect(createPlant(prisma, { name: "Závod X", code: "X" })).rejects.toThrow(/2–6/);
    await expect(createPlant(prisma, { name: "Zá", code: "ZAV" })).rejects.toThrow(/název/);
  });
});
