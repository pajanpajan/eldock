import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { loadDigestItems, sendInspectionDigest } from "./notifications";
import { createTestDb, seedMinimal } from "./test-db";

const NOW = new Date("2026-10-30T08:00:00Z");
const DAY = 86_400_000;

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

async function inspection(equipmentId: string, validInDays: number) {
  await prisma.inspectionRecord.create({
    data: {
      equipmentId,
      type: "PERIODIC",
      inspectionDate: new Date(NOW.getTime() - 300 * DAY),
      validUntil: new Date(NOW.getTime() + validInDays * DAY),
      reportNumber: `RZ-${equipmentId}`,
      inspectorName: "Technik",
      inspectorLicense: "E-1",
      result: "CAPABLE",
      reportUrl: "/api/files/documents/x.svg",
    },
  });
}

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  await prisma.user.create({ data: { id: "u-lead", name: "Karel Novotný", email: "vedouci@test.example", role: "MAINTENANCE", accountType: "MAINTENANCE_LEAD" } });
  await prisma.user.create({ data: { id: "u-boss", name: "Ing. Martin Dvořák", email: "reditel@test.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN" } });
  const ids = (await prisma.equipment.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map((row) => row.id);
  await inspection(ids[0], -3);
  await inspection(ids[1], 10);
});
afterEach(async () => db.cleanup());

describe("souhrnné avízo lhůt", () => {
  it("vybere jen zařízení po termínu nebo do 30 dnů", async () => {
    const items = await loadDigestItems(prisma, "p", NOW);
    expect(items.map((item) => item.daysLeft).sort((a, b) => a - b)).toEqual([-3, 10]);
  });

  it("bez SMTP uloží avízo do logu pro vedení závodu", async () => {
    const log = await sendInspectionDigest(prisma, { plantId: "p", origin: "https://eldock.cz", triggeredBy: "manual:u-lead", transport: null, now: NOW });
    expect(log.delivery).toBe("LOGGED");
    expect(log.itemCount).toBe(2);
    expect(log.recipients).toBe("reditel@test.example, vedouci@test.example");
    expect(log.html).toContain("https://eldock.cz/inspections/planner");
  });

  it("s transportem odešle e-mail, chybu SMTP zaloguje", async () => {
    const sent: string[][] = [];
    const ok = await sendInspectionDigest(prisma, { plantId: "p", origin: "https://eldock.cz", triggeredBy: "cron", transport: async (message) => void sent.push(message.to), now: NOW });
    expect(ok.delivery).toBe("SENT");
    expect(sent).toHaveLength(1);
    const failed = await sendInspectionDigest(prisma, {
      plantId: "p",
      origin: "https://eldock.cz",
      triggeredBy: "cron",
      transport: async () => {
        throw new Error("Connection refused");
      },
      now: NOW,
    });
    expect(failed.delivery).toBe("FAILED");
    expect(failed.error).toBe("Connection refused");
    expect(await prisma.notificationLog.count()).toBe(2);
  });
});
