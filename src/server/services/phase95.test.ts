import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { toPlantPayload } from "@/lib/bim/bim-payload";
import { parseIfc } from "@/lib/bim/ifc-parser";
import { samplePlantIfc } from "@/lib/bim/sample-ifc";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importBimToPlant } from "./bim-import";
import { createProjectFromBimBoard } from "./panel-projects";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 95 nad SQLite: import vzorového BIM modelu haly do závodu (nová budova se zařízeními a údaji z BIMu)
// a aktualizace stávajících rozváděčů podle kódů (dokumentace zůstane).

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(() => db.cleanup());

const payload = () => toPlantPayload(parseIfc(samplePlantIfc()));

describe("fáze 95 – import BIM do Správy závodů", () => {
  it("vytvoří halu H1 s 1. a 2. NP, místnostmi, zdroji, rozváděči a stroji – napájení, zálohování, údaje z BIMu a QR kódy", async () => {
    const result = await importBimToPlant(prisma, "p", payload(), "CREATE");
    expect(result).toMatchObject({ mode: "CREATE", plantId: "p", buildingCode: "H1" });
    const building = await prisma.building.findUniqueOrThrow({ where: { id: result.buildingId! }, include: { floors: { orderBy: { level: "asc" } } } });
    expect(building).toMatchObject({ code: "H1", name: "Hala H1 – výroba a technologie", type: "PRODUCTION" });
    expect(building.floors.map((floor) => floor.name)).toEqual(["1. NP - Přízemí – výroba", "2. NP - Technické podlaží"]);
    expect(building.floors[0].studioLayoutJson).toContain("Výrobní hala M1");
    const equipment = await prisma.equipment.findMany({ where: { floor: { buildingId: building.id } }, include: { fedFrom: { select: { tag: true } } } });
    const byTag = new Map(equipment.map((row) => [row.tag, row]));
    expect(equipment).toHaveLength(10);
    expect(byTag.get("HR1")).toMatchObject({ type: "SWITCHBOARD", name: "HR1 - Hlavní rozváděč 1000 A", ratedCurrent: "1000 A", ratedVoltage: "400 V AC / 50 Hz", ipRating: "IP54", ratedPowerKw: 420, feederLengthM: 8.8, feederCableType: "4× 1-AYKY 3×240+120", fedFrom: { tag: "TR1" } });
    expect(byTag.get("HR1")!.bimGuid).toMatch(/^3[0-9A-Za-z_$]{21}$/);
    expect(byTag.get("RM1")).toMatchObject({ fedFrom: { tag: "HR1" }, ratedCurrent: "250 A", feederLengthM: 46 });
    expect(byTag.get("R-UPS")).toMatchObject({ fedFrom: { tag: "UPS1" }, powerBackupTier: "CRITICAL_UPS_ZIS", assignedZone: "Velín údržby" });
    expect(byTag.get("DA1")).toMatchObject({ type: "TRANSFORMER", powerBackupTier: "BACKUP_GENERATOR_DA", backupCapacityKva: 250 });
    expect(byTag.get("CNC-01")).toMatchObject({ type: "CNC_MACHINE", fedFrom: { tag: "RM1" }, fedFromCircuit: "RM1-Q1 CNC frézka", ratedPowerKw: 45, nominalCurrentA: 80, feederLengthM: 32 });
    expect(byTag.get("KOMP-01")).toMatchObject({ type: "COMPRESSOR", fedFrom: { tag: "HR1" }, fedFromCircuit: "Q5" });
    expect(byTag.get("VZT-01")!.floorId).toBe(building.floors[1].id);
    expect(equipment.every((row) => row.qrToken && row.description?.startsWith("Importováno z BIM modelu (IFC4"))).toBe(true);
    // Výsledek pro okno importu: rozváděče s počtem napájených zařízení (tlačítko do AI Panel Builderu)
    expect(result.equipment.find((row) => row.tag === "RM1")).toMatchObject({ type: "SWITCHBOARD", feeds: 2 });
    expect(result.notes.some((note) => note.includes("Kabelové trasy a žlaby (94,7 m)"))).toBe(true);
    // Druhý import stejné haly dostane další volný kód budovy
    const again = await importBimToPlant(prisma, "p", payload(), "CREATE");
    expect(again.buildingCode).toBe("B");
  });

  it("aktualizace podle kódů: parametry z BIMu ke stávajícím zařízením, popis a revize zůstanou, neznámé kódy se vypíšou", async () => {
    const before = await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" }, include: { revisions: true } });
    const data = payload();
    const hr1 = data.electrical.find((element) => element.tag === "HR1")!;
    hr1.tag = "R-LIS-01";
    hr1.props.nominalCurrentA = 400;
    const result = await importBimToPlant(prisma, "p", data, "UPDATE");
    expect(result.equipment.map((row) => row.tag)).toEqual(["R-LIS-01"]);
    expect(result.notFound).toEqual(expect.arrayContaining(["TR1", "RM1", "R-UPS", "CNC-01"]));
    const after = await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" }, include: { revisions: true } });
    expect(after).toMatchObject({ ratedCurrent: "400 A", ipRating: "IP54", ratedPowerKw: 420, description: before.description, name: before.name });
    expect(after.bimGuid).toBe(hr1.guid);
    expect(after.revisions).toHaveLength(before.revisions.length);
    // Žádná nová budova
    expect(await prisma.building.count({ where: { plantId: "p" } })).toBe(1);
  });

  it("⚡ BIM rozváděč → návrh v AI Panel Builderu: hlavní vypínač podle In, vývody ke strojům s jištěním podle příkonu a kabelem z BIMu", async () => {
    await seedPanelBuilder(prisma, { external: false, demo: false });
    await importBimToPlant(prisma, "p", payload(), "CREATE");
    const rm1 = await prisma.equipment.findFirstOrThrow({ where: { tag: "RM1" } });
    const result = await createProjectFromBimBoard(prisma, { equipmentId: rm1.id, companyId: null });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] } } });
    expect(project).toMatchObject({ name: "RM1 - Podružný rozváděč lisovny 250 A", customerName: "Test s.r.o.", installationSite: "Testovací závod · Hala H1 – výroba a technologie · 1. NP - Přízemí – výroba" });
    const configs = project.items.map((item) => ({ label: item.circuitLabel, ...(JSON.parse(item.configJson ?? "{}") as { category: string; poles: string; ratedCurrentA: number; curve?: string }) }));
    expect(configs.find((config) => config.category === "MAIN_SWITCH")).toMatchObject({ poles: "3P", ratedCurrentA: 250 });
    expect(configs.find((config) => config.label?.startsWith("CNC-01"))).toMatchObject({ category: "MCB", poles: "3P", ratedCurrentA: 80, curve: "C" });
    expect(configs.find((config) => config.label?.startsWith("LIS-01"))).toMatchObject({ category: "MCB", ratedCurrentA: 160 });
    expect(result.circuits).toBe(2);
    expect(result.warnings.some((warning) => warning.startsWith("LIS-01: vývod 160 A je nad řadou modulárních jističů"))).toBe(true);
    // Rozváděč bez napájených zařízení nemá z čeho generovat
    const ups = await prisma.equipment.findFirstOrThrow({ where: { tag: "VZT-01" } });
    await expect(createProjectFromBimBoard(prisma, { equipmentId: ups.id, companyId: null })).rejects.toThrow("Rozváděč nebyl nalezen.");
  }, 30_000); // seed katalogu + import BIM
});
