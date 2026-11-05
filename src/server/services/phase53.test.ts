import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  checkCable,
  designCurrents,
  simulateAddedLoad,
  toCableNode,
} from "@/lib/cable-sizing";
import { assessComponent } from "@/lib/component-lifespan";

import { seedLifespanCables } from "../../../prisma/seed-lifespan-cables";
import {
  addMonitoredComponent,
  replaceMonitoredComponent,
  updateFeederCable,
  updateOperatingProfile,
} from "./lifespan";
import { createTestDb } from "./test-db";

// Fáze 53: seed Závodu Jablonec (kabely + součástky) a služby prediktivní údržby nad SQLite.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
const NOW = new Date("2026-11-05T08:00:00Z");

const TREE: [
  tag: string,
  type: "TRANSFORMER" | "SWITCHBOARD" | "PRODUCTION_LINE" | "CNC_MACHINE",
  parent: string | null,
  rated?: string,
][] = [
  ["TR1", "TRANSFORMER", null, "1443 A"],
  ["RM1", "SWITCHBOARD", "TR1"],
  ["R-LIS-01", "SWITCHBOARD", "RM1"],
  ["R-CNC-04", "SWITCHBOARD", "RM1"],
  ["R-ML-01", "SWITCHBOARD", "RM1"],
  ["LIS-01", "PRODUCTION_LINE", "R-LIS-01"],
  ["CNC-04", "CNC_MACHINE", "R-CNC-04"],
];

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await prisma.plant.create({
    data: {
      id: "plant-jbc",
      code: "JBC",
      name: "Závod Jablonec",
      customerName: "Test",
    },
  });
  await prisma.building.create({
    data: {
      id: "b",
      plantId: "plant-jbc",
      code: "A",
      name: "Hala A",
      mapPolygon: "0,0 1,0 1,1",
      labelX: 0,
      labelY: 0,
    },
  });
  await prisma.floor.create({
    data: { id: "f", buildingId: "b", level: 0, code: "1NP", name: "1. NP" },
  });
  for (const [tag, type, parent, rated] of TREE) {
    await prisma.equipment.create({
      data: {
        id: `eq-${tag}`,
        floorId: "f",
        tag,
        name: tag,
        type,
        pinX: 10,
        pinY: 10,
        ratedCurrent: rated ?? null,
        fedFromEquipmentId: parent ? `eq-${parent}` : null,
      },
    });
  }
});
afterEach(() => db.cleanup());

async function cableNodes() {
  const rows = await prisma.equipment.findMany({
    where: { floor: { building: { plantId: "plant-jbc" } } },
  });
  return rows.map(toCableNode);
}

describe("seed Závod Jablonec – kabely a součástky", () => {
  it("R-LIS-01 🟡 nízká rezerva, R-CNC-04 🔴 nejištěný (In 125 A > Iz), ostatní 🟢; jednorázově", async () => {
    const result = await seedLifespanCables(prisma, { now: NOW });
    expect(result).toMatchObject({ skipped: false, cables: 6, components: 5 });
    expect((await seedLifespanCables(prisma, { now: NOW })).skipped).toBe(true);

    const nodes = await cableNodes();
    const currents = designCurrents(nodes);
    const status = (tag: string) => {
      const node = nodes.find((entry) => entry.tag === tag)!;
      return checkCable(node.cable!, currents.get(node.id)!);
    };
    expect(status("R-LIS-01")).toMatchObject({
      status: "WARNING",
      protectedOk: true,
    });
    expect(status("R-CNC-04")).toMatchObject({
      status: "CRITICAL",
      protectedOk: false,
    });
    for (const tag of ["RM1", "R-ML-01", "LIS-01", "CNC-04"])
      expect(status(tag).status).toBe("OK");
    expect(status("R-ML-01").loadPercent).toBeGreaterThan(45);
    expect(status("R-ML-01").loadPercent).toBeLessThan(65);

    // Simulátor: +30 kW na R-LIS-01 → přívod přetížen, páteř RM1 v pořádku, zdroj TR1 v kaskádě
    const rows = simulateAddedLoad(nodes, "eq-R-LIS-01", 48);
    expect(rows.map((row) => row.tag)).toEqual(["R-LIS-01", "RM1", "TR1"]);
    expect(rows[0].status).toBe("CRITICAL");
    expect(rows[1].status).toBe("OK");

    const components = await prisma.monitoredComponent.findMany({
      include: { equipment: true },
    });
    const byDesignation = (designation: string) => {
      const component = components.find(
        (entry) => entry.designation === designation,
      )!;
      return assessComponent(component, component.equipment, NOW);
    };
    expect(byDesignation("-K1")).toMatchObject({ status: "PLAN_REPLACEMENT" });
    expect(byDesignation("-K1").wearPercent).toBeCloseTo(94, 0);
    expect(byDesignation("-K_SAF1").wearPercent).toBeCloseTo(42, 0);
    expect(byDesignation("-T1")).toMatchObject({
      status: "CRITICAL_EXPIRED",
      missingStock: true,
      thermalDerating: { fromHours: 50_000, toHours: 28_717 },
    });
    expect(byDesignation("-T1").wearPercent).toBeCloseTo(97, 0);
    expect(byDesignation("-FAN1").status).toBe("CRITICAL_EXPIRED");
    expect(byDesignation("-U1").wearPercent).toBeCloseTo(58, 0);
  });

  it("vlastní kabelový pasport se seedem nepřepisuje", async () => {
    await updateFeederCable(prisma, {
      equipmentId: "eq-R-CNC-04",
      cableType: "CYKY-J",
      material: "CU",
      crossSectionMm2: 95,
      parallelRuns: 1,
      lengthM: 48,
      method: "E",
      groupingCount: 6,
      ambientTempC: 35,
      upstreamBreakerA: 125,
      nominalCurrentA: 82,
      measuredCurrentA: null,
    });
    await seedLifespanCables(prisma, { now: NOW });
    expect(
      (
        await prisma.equipment.findUniqueOrThrow({
          where: { id: "eq-R-CNC-04" },
        })
      ).feederCrossSectionMm2,
    ).toBe(95);
  });
});

describe("služby prediktivní údržby", () => {
  it("výměna kusu = reset 0 % k dnešku a odpis ze skladu; profil a validace", async () => {
    const component = await addMonitoredComponent(prisma, {
      equipmentId: "eq-R-LIS-01",
      designation: "-K4",
      name: "Stykač",
      wearCategory: "SWITCHING_CONTACTOR",
      installedAt: new Date("2024-01-01"),
      cyclesPerHour: 60,
      maxElectricalCycles: 1_000_000,
      replacementStockCount: 2,
    });
    const replacedAt = new Date("2026-11-05T09:00:00Z");
    const replaced = await replaceMonitoredComponent(prisma, {
      componentId: component.id,
      equipmentId: "eq-R-LIS-01",
      now: replacedAt,
    });
    expect(replaced).toMatchObject({
      installedAt: replacedAt,
      manualCyclesOffset: 0,
      replacementStockCount: 1,
    });
    expect(replaced.notes).toMatch(/^Výměna 5\. 11\. 2026 \(kus ze skladu\)/);
    expect(
      assessComponent(
        replaced,
        { shiftRegime: 2, internalTempC: null },
        replacedAt,
      ).wearPercent,
    ).toBe(0);

    await expect(
      replaceMonitoredComponent(prisma, {
        componentId: component.id,
        equipmentId: "eq-R-CNC-04",
      }),
    ).rejects.toThrow(/neexistuje/);
    await expect(
      addMonitoredComponent(prisma, {
        equipmentId: "eq-R-LIS-01",
        designation: "-K5",
        name: "Bez limitu",
        wearCategory: "SWITCHING_CONTACTOR",
      }),
    ).rejects.toThrow(/alespoň jeden limit/);
    await expect(
      addMonitoredComponent(prisma, {
        equipmentId: "eq-R-LIS-01",
        designation: "-K5",
        name: "Stykač",
        wearCategory: "SWITCHING_CONTACTOR",
        maxElectricalCycles: 1000,
      }),
    ).rejects.toThrow(/sepnutí za hodinu/);

    await updateOperatingProfile(prisma, {
      equipmentId: "eq-R-LIS-01",
      shiftRegime: 4,
      internalTempC: 45,
    });
    expect(
      await prisma.equipment.findUniqueOrThrow({
        where: { id: "eq-R-LIS-01" },
        select: { shiftRegime: true, internalTempC: true },
      }),
    ).toEqual({ shiftRegime: 4, internalTempC: 45 });
    await expect(
      updateOperatingProfile(prisma, {
        equipmentId: "eq-R-LIS-01",
        shiftRegime: 7,
        internalTempC: null,
      }),
    ).rejects.toThrow(/směnnost/);
    await expect(
      updateFeederCable(prisma, {
        equipmentId: "eq-RM1",
        cableType: null,
        material: "CU",
        crossSectionMm2: 42,
        parallelRuns: 1,
        lengthM: null,
        method: "E",
        groupingCount: 1,
        ambientTempC: 30,
        upstreamBreakerA: null,
        nominalCurrentA: null,
        measuredCurrentA: null,
      }),
    ).rejects.toThrow(/Průřez/);
  });
});
