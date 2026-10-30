import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { importEquipment, importPin, type ImportItem } from "./equipment-import";
import { createTestDb, seedMinimal } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
const reports: string[] = [];
const writeReport = async (svg: string) => {
  reports.push(svg);
  return `/api/files/documents/import-${reports.length}.svg`;
};

const item = (tag: string, patch: Partial<ImportItem> = {}): ImportItem => ({
  tag,
  name: `Spotřebič ${tag}`,
  type: "APPLIANCE",
  floorId: "f",
  intervalMonths: 24,
  lastInspection: null,
  location: "Kuchyňka",
  ...patch,
});

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  reports.length = 0;
});
afterEach(async () => db.cleanup());

describe("hromadný import zařízení", () => {
  it("založí zařízení s QR kódem, lhůtou a převzatou revizí", async () => {
    const result = await importEquipment(prisma, {
      items: [item("SP-1", { lastInspection: new Date("2026-03-12T12:00:00Z") }), item("NR-1", { type: "POWER_TOOL", intervalMonths: null })],
      writeReport,
    });
    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    const kettle = await prisma.equipment.findFirstOrThrow({ where: { tag: "SP-1" }, include: { inspections: true } });
    expect(kettle.qrToken).toMatch(/^[0-9A-F]{10}$/);
    expect(kettle.name).toBe("SP-1 - Spotřebič SP-1");
    expect(kettle.inspections[0].validUntil.toISOString().slice(0, 10)).toBe("2028-03-12");
    expect(kettle.inspections[0].reportUrl).toBe("/api/files/documents/import-1.svg");
    const drill = await prisma.equipment.findFirstOrThrow({ where: { tag: "NR-1" } });
    expect(drill.inspectionIntervalMonths).toBe(12);
    expect(drill.usageGroup).toBe("C");
  });

  it("přeskočí evidenční čísla, která v závodě už jsou (i duplicitní v souboru)", async () => {
    await importEquipment(prisma, { items: [item("SP-1")], writeReport });
    const result = await importEquipment(prisma, { items: [item("SP-1"), item("SP-2"), item("SP-2")], writeReport });
    expect(result.created.map((row) => row.tag)).toEqual(["SP-2"]);
    expect(result.skipped.map((row) => row.tag)).toEqual(["SP-1", "SP-2"]);
  });

  it("odmítne neplatné patro", async () => {
    await expect(importEquipment(prisma, { items: [item("X", { floorId: "neni" })], writeReport })).rejects.toBeInstanceOf(WorkflowError);
  });

  it("piny skládá do řad u spodního okraje", () => {
    expect(importPin(0)).toEqual({ pinX: 6, pinY: 92 });
    expect(importPin(13)).toEqual({ pinX: 14, pinY: 85 });
  });
});
