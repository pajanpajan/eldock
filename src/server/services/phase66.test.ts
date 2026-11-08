import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InspectionResult, InspectionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";

import { recordInspection } from "./inspection";
import { PHASE66_MARKER, migratePhase66Intervals, updateInspectionSettings } from "./inspection-intervals";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 66 nad SQLite: nastavení lhůty podle NV 190/2022 Sb. (příloha č. 4), zkrácení platností a jednorázová oprava dat.

const day = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const NOW = new Date("2026-11-08T10:00:00Z");

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

function addRecord(equipmentId: string, inspectionDate: string, validUntil: string, type: InspectionType = "PERIODIC", result: InspectionResult = "CAPABLE") {
  return prisma.inspectionRecord.create({
    data: {
      equipmentId,
      type,
      inspectionDate: day(inspectionDate),
      validUntil: day(validUntil),
      reportNumber: `RZ-${inspectionDate}`,
      inspectorName: "Ing. Pavel Horák",
      inspectorLicense: "E-0815/2024",
      result,
      reportUrl: "/x",
    },
  });
}

describe("jednorázová oprava lhůt (fáze 66)", () => {
  it("zkrátí lhůty a platnosti VTZ na zákonné maximum, původní platnost uloží a podruhé nic neudělá", async () => {
    await prisma.equipment.update({ where: { id: "eq-R-LIS-01" }, data: { inspectionIntervalMonths: 60 } });
    const capped = await addRecord("eq-R-LIS-01", "2024-03-15", "2029-03-15");
    const ok = await addRecord("eq-R-CNC-04", "2025-01-10", "2028-01-10");
    await addRecord("eq-R-CNC-04", "2026-01-10", "2026-01-10", "PERIODIC", "INCAPABLE");
    const thermo = await addRecord("eq-R-LIS-01", "2025-06-01", "2030-06-01", "THERMOVISION");

    const dry = await migratePhase66Intervals(prisma, { dryRun: true });
    expect(dry).toMatchObject({ skipped: false, capped: { intervals: 1, records: 1 } });
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).inspectionIntervalMonths).toBe(60);

    expect(await migratePhase66Intervals(prisma)).toMatchObject({ skipped: false, capped: { intervals: 1, records: 1, changes: [{ tag: "R-LIS-01", interval: { from: 60, to: 36 }, records: 1 }] } });
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).inspectionIntervalMonths).toBe(36);
    expect(await prisma.inspectionRecord.findUniqueOrThrow({ where: { id: capped.id } })).toMatchObject({ validUntil: day("2027-03-15"), validUntilOriginal: day("2029-03-15") });
    expect((await prisma.inspectionRecord.findUniqueOrThrow({ where: { id: ok.id } })).validUntilOriginal).toBeNull();
    expect((await prisma.inspectionRecord.findUniqueOrThrow({ where: { id: thermo.id } })).validUntil).toEqual(day("2030-06-01"));
    expect(await prisma.tenantSetting.findUnique({ where: { key: PHASE66_MARKER } })).not.toBeNull();
    expect(await migratePhase66Intervals(prisma)).toEqual({ skipped: true });
  });

  it("spotřebičům s výchozí lhůtou staré tabulky dá lhůtu ČSN 33 1600 ed. 2, vlastní lhůty nechá", async () => {
    await prisma.equipment.createMany({
      data: [
        { id: "eq-nr", floorId: "f", tag: "NR-1", name: "NR-1 - Bruska", type: "POWER_TOOL", usageGroup: "C", protectionClass: "I", inspectionIntervalMonths: 12, pinX: 1, pinY: 1 },
        { id: "eq-nr2", floorId: "f", tag: "NR-2", name: "NR-2 - Vrtačka", type: "POWER_TOOL", usageGroup: "C", protectionClass: "I", inspectionIntervalMonths: 9, pinX: 1, pinY: 1 },
        { id: "eq-nr3", floorId: "f", tag: "NR-3", name: "NR-3 - Pila", type: "POWER_TOOL", usageGroup: "C", protectionClass: "II", inspectionIntervalMonths: 12, pinX: 1, pinY: 1 },
        { id: "eq-pp", floorId: "f", tag: "PP-1", name: "PP-1 - Prodlužovací přívod", type: "EXTENSION_CORD", usageGroup: "C", inspectionIntervalMonths: 12, pinX: 1, pinY: 1 },
      ],
    });
    const result = await migratePhase66Intervals(prisma);
    expect(result).toMatchObject({ skipped: false, appliances: [{ tag: "NR-1", from: 12, to: 6 }, { tag: "PP-1", from: 12, to: 6 }] });
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-nr2" } })).inspectionIntervalMonths).toBe(9);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-nr3" } })).inspectionIntervalMonths).toBe(12);
  });
});

describe("nastavení lhůty zařízení (fáze 66)", () => {
  it("mokrý prostor zkrátí lhůtu na 1 rok i platnost poslední revize, delší než zákonnou odmítne", async () => {
    const record = await addRecord("eq-R-LIS-01", "2025-11-01", "2028-11-01");
    await expect(updateInspectionSettings(prisma, { equipmentId: "eq-R-LIS-01", intervalMonths: 48 })).rejects.toThrow(/překračuje nejdelší zákonnou lhůtu 36/);
    const saved = await updateInspectionSettings(prisma, { equipmentId: "eq-R-LIS-01", externalInfluences: "AA5, AD5 – mycí linka" });
    expect(saved).toMatchObject({ intervalMonths: 12, cappedRecords: 1, warning: null });
    expect(await prisma.inspectionRecord.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ validUntil: day("2026-11-01"), validUntilOriginal: day("2028-11-01") });
    // Řád preventivní údržby provozovatele: až dvojnásobek (příloha č. 4, pozn. c)
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-R-CNC-04", preventiveMaintenance: true, intervalMonths: 72 })).intervalMonths).toBe(72);
  });

  it("objekt pro více než 200 osob platí pro celou budovu", async () => {
    await addRecord("eq-R-CNC-04", "2025-06-01", "2028-06-01");
    const saved = await updateInspectionSettings(prisma, { equipmentId: "eq-R-LIS-01", crowdOver200: true });
    expect(saved).toMatchObject({ intervalMonths: 24, cappedRecords: 1 });
    expect((await prisma.building.findUniqueOrThrow({ where: { id: "b" } })).crowdOver200).toBe(true);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-CNC-04" } })).inspectionIntervalMonths).toBe(24);
  });

  it("spotřebič: skupina, třída a držení v ruce; delší než normová lhůta jen s varováním", async () => {
    await prisma.equipment.create({ data: { id: "eq-sp", floorId: "f", tag: "SP-1", name: "SP-1 - Fén", type: "APPLIANCE", usageGroup: "E", protectionClass: "II", inspectionIntervalMonths: 24, pinX: 1, pinY: 1 } });
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-sp", handHeld: true })).intervalMonths).toBe(12);
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-sp", intervalMonths: 18 })).warning).toContain("delší než 12 měsíců");
  });
});

describe("zápis revize nad databází (fáze 66)", () => {
  it("uloží osvědčení a náležitosti zprávy včetně předchozí revize s neodstraněnou závadou", async () => {
    await prisma.inspectionRecord.create({
      data: {
        equipmentId: "eq-R-LIS-01",
        type: "PERIODIC",
        inspectionDate: day("2023-11-01"),
        validUntil: day("2026-11-01"),
        reportNumber: "RZ-2023-001",
        inspectorName: "Ing. Pavel Horák",
        inspectorLicense: "E-0815/2021",
        result: "CAPABLE_WITH_DEFECTS",
        reportUrl: "/x",
        defects: { create: { equipmentId: "eq-R-LIS-01", description: "Chybí štítek jističe F3", deadline: day("2023-12-01") } },
      },
    });
    await prisma.complianceDocument.create({
      data: { equipmentId: "eq-R-LIS-01", category: "EXTERNAL_INFLUENCES", title: "Protokol o určení vnějších vlivů", documentNumber: "PVV-1", fileUrl: "/x", issuedAt: day("2019-03-01"), issuer: "Komise" },
    });
    const record = await recordInspection(
      prisma,
      {
        equipmentId: "eq-R-LIS-01",
        type: "PERIODIC",
        inspectionDate: "2026-11-02",
        reportNumber: "RZ-2026-001",
        inspectorName: "Ing. Pavel Horák",
        inspectorLicense: "E-0815/2024",
        inspectorScope: "E1B",
        inspectorValidUntil: "2029-03-31",
        result: "CAPABLE",
        reportUrl: "/x",
      },
      NOW,
    );
    expect(record).toMatchObject({ inspectorScope: "E1B", inspectorValidUntil: day("2029-03-31"), validUntil: day("2029-11-02"), startedAt: day("2026-11-02") });
    expect(record.previousEvaluation).toContain("RZ-2023-001 ze dne 01.11.2023: schopno bezpečného provozu s výhradou, neodstraněné závady: Chybí štítek jističe F3");
    expect(record.documentsUsed).toContain("Dokumentace skutečného provedení – revize v1.0");
    expect(record.documentsUsed).toContain("Protokol o určení vnějších vlivů PVV-1 ze dne 01.03.2019");
  });
});
