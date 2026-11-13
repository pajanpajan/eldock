import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { MISSION_TASKS, SAMPLE_SCHEMATIC, cleanTag, freeHallSpot, missionAssessment, missionSimulation, nextBuildingCode, transformerCurrentA, uniqueTag } from "@/lib/plant-onboarding";

import { registerPlantCompany } from "./companies";
import { addOnboardingMachine, createOnboardingHall } from "./plant-onboarding";
import { createTestDb } from "./test-db";

// Fáze 92: průvodce výrobním závodem – režim A (skutečná hala, hlavní zdroj, první stroj se schématem) a data mise B

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let plantId: string;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  const registered = await registerPlantCompany(prisma, {
    ico: "12345679",
    dic: null,
    companyName: "Strojírna Zkouška s.r.o.",
    street: "Průmyslová 1",
    city: "Liberec",
    zip: "460 01",
    contactName: "Ing. Jana Průvodcová",
    phone: "+420 777 000 222",
    email: "pruvodce@example.cz",
    authorizationNumber: null,
    password: "Heslo-pro-test-92",
    termsAccepted: true,
    plantName: "Závod Liberec",
  });
  plantId = registered.plant.id;
  userId = registered.userId;
});
afterEach(async () => db.cleanup());

describe("fáze 92 – průvodce závodem, režim A", () => {
  it("krok 1: nová hala s rozvodnou a hlavním rozváděčem na čisté mapě areálu", async () => {
    const hall = await createOnboardingHall(prisma, plantId, { hallName: "Hala 1 – Výroba", boardTag: "hr 1", sourceKind: "SWITCHBOARD", rating: 630 });
    const building = await prisma.building.findUniqueOrThrow({ where: { id: hall.buildingId }, include: { floors: { include: { equipment: true } } } });
    expect(building).toMatchObject({ name: "Hala 1 – Výroba", code: "A", type: "PRODUCTION", plantId });
    expect(building.floors).toHaveLength(1);
    expect(building.floors[0].floorplanSvg).toContain("Rozvodna");
    const board = building.floors[0].equipment[0];
    expect(board).toMatchObject({ tag: "HR-1", type: "SWITCHBOARD", ratedCurrent: "630 A", fedFromEquipmentId: null });
    expect(board.qrToken).toMatch(/^[0-9A-F]{10}$/);
    // Druhá hala dostane další kód a jiné místo v areálu
    const second = await createOnboardingHall(prisma, plantId, { hallName: "Hala 2 – Montáž", boardTag: "HR-1", sourceKind: "TRANSFORMER", rating: 1000 });
    const ts = await prisma.equipment.findUniqueOrThrow({ where: { id: second.boardId } });
    expect(ts).toMatchObject({ tag: "HR-1-2", type: "TRANSFORMER", ratedCurrent: `${transformerCurrentA(1000)} A` });
    expect((await prisma.building.findUniqueOrThrow({ where: { id: second.buildingId } })).code).toBe("B");
  });

  it("krok 2–3: první stroj napájený z hlavního rozváděče s platnou revizí schématu a QR štítkem", async () => {
    const hall = await createOnboardingHall(prisma, plantId, { hallName: "Hala 1 – Výroba", boardTag: "HR-1", sourceKind: "SWITCHBOARD", rating: 400 });
    const machine = await addOnboardingMachine(prisma, plantId, userId, { buildingId: hall.buildingId, name: "CNC Centrum 1", tag: "cnc 1", type: "CNC_MACHINE", powerKw: 22, schematicUrl: SAMPLE_SCHEMATIC.url });
    const row = await prisma.equipment.findUniqueOrThrow({ where: { id: machine.equipmentId }, include: { revisions: true } });
    expect(row).toMatchObject({ tag: "CNC-1", type: "CNC_MACHINE", fedFromEquipmentId: hall.boardId, nominalCurrentA: 35.3 });
    expect(row.qrToken).toBeTruthy();
    expect(row.revisions).toHaveLength(1);
    expect(row.revisions[0]).toMatchObject({ status: "ACTIVE", version: "v1.0", schematicUrl: SAMPLE_SCHEMATIC.url, schematicFormat: "PDF", authorId: userId });
    // Jen PDF z úložiště Eldocku nebo vzorové schéma; cizí hala neprojde
    await expect(addOnboardingMachine(prisma, plantId, userId, { buildingId: hall.buildingId, name: "Lis", tag: "LIS", type: "MACHINE", powerKw: 10, schematicUrl: "https://example.com/a.pdf" })).rejects.toThrow(/PDF nahrané/);
    await expect(addOnboardingMachine(prisma, "jiny-zavod", userId, { buildingId: hall.buildingId, name: "Lis", tag: "LIS", type: "MACHINE", powerKw: 10, schematicUrl: SAMPLE_SCHEMATIC.url })).rejects.toThrow(/Hala nebyla nalezena/);
  });

  it("validace a pomocné funkce", async () => {
    await expect(createOnboardingHall(prisma, plantId, { hallName: "H", boardTag: "HR", sourceKind: "SWITCHBOARD", rating: 400 })).rejects.toThrow(/název haly/);
    await expect(createOnboardingHall(prisma, plantId, { hallName: "Hala 9", boardTag: "TS", sourceKind: "TRANSFORMER", rating: 9000 })).rejects.toThrow(/50–4000 kVA/);
    expect(cleanTag("Rozváděč r-101", "X")).toBe("ROZVADEC-R-101");
    expect(uniqueTag("HR-1", new Set(["HR-1", "HR-1-2"]))).toBe("HR-1-3");
    expect(nextBuildingCode(["A", "b"])).toBe("C");
    // Fáze 108: první volné místo bez překryvu (s odstupem 2 %), ne pevná pozice vedle první haly
    expect(freeHallSpot(["8,10 36,10 36,30 8,30"])).toEqual({ x: 38, y: 2, w: 28, h: 20 });
    expect(transformerCurrentA(1000)).toBe(1443);
  });
});

describe("fáze 92 – mise noční poruchy linky (režim B)", () => {
  it("čtyři úkoly, klasifikace zásahu dle EU 2023/1230 a simulátor nového 60kW stroje", () => {
    expect(MISSION_TASKS.map((task) => task.id)).toEqual(["locate", "redline", "backup", "simulate"]);
    const assessment = missionAssessment();
    expect(assessment).toMatchObject({ level: "NONE_1_TO_1", substantial: false });
    expect(assessment.reasons.join(" ")).toMatch(/F-Signature/);
    const simulation = missionSimulation(60);
    expect(simulation.addedA).toBe(96.2);
    expect(simulation.rows.map((row) => row.tag)).toEqual(["RM-L2", "RH1", "TS-1"]);
    expect(simulation.rows[0].afterA).toBeGreaterThan(simulation.rows[0].beforeA);
  });
});
