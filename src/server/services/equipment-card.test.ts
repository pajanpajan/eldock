import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { regenerateQrToken, setEquipmentPhoto } from "./equipment-card";
import { createTestDb, seedMinimal } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

describe("vizuální karta zařízení", () => {
  it("nastaví a odebere fotografii", async () => {
    await setEquipmentPhoto(prisma, "eq-R-LIS-01", "/api/files/photos/abc.jpg");
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).photoUrl).toBe("/api/files/photos/abc.jpg");
    await setEquipmentPhoto(prisma, "eq-R-LIS-01", null);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).photoUrl).toBeNull();
  });

  it("přegenerování QR kódu vytvoří nový unikátní kód", async () => {
    const first = await regenerateQrToken(prisma, "eq-R-LIS-01");
    const second = await regenerateQrToken(prisma, "eq-R-LIS-01");
    expect(first.qrToken).toMatch(/^[0-9A-F]{10}$/);
    expect(second.qrToken).not.toBe(first.qrToken);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).qrToken).toBe(second.qrToken);
  });

  it("neexistující zařízení odmítne", async () => {
    await expect(regenerateQrToken(prisma, "eq-neni")).rejects.toBeInstanceOf(WorkflowError);
  });
});
