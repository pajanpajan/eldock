import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import { midMeterConfig, shuntTripConfig, CENTRAL_STOP_LABEL, MID_METER_LABEL } from "@/lib/panel-builder/occupancy";
import { projectLintIssues } from "@/lib/panel-builder/panel-live-checklist";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { updateInspectionSettings } from "./inspection-intervals";
import { createPanelProject } from "./panel-builder";
import { placeComponents, placeLintDevices } from "./panel-design";
import { updatePowerBackup } from "./power-backup";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 93 nad SQLite: projekt obchodního centra (typ objektu, oprava Elektro-linteru 1 klikem), zálohování napájení
// rozváděče a varianta revize zdravotnického prostoru.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

async function lintOf(projectId: string) {
  const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: projectId }, include: { items: { include: { catalogComponent: true } }, enclosure: true } });
  return { project, issues: projectLintIssues(project, project.enclosure?.totalModules ?? null) };
}

describe("fáze 93 – projekt obchodního centra v AI Panel Builderu", () => {
  it("typ objektu se uloží, linter BD4 hlásí spoušť a elektroměr a oprava je vloží na lišty (i na novou lištu)", async () => {
    await seedPanelBuilder(prisma, { external: false });
    const created = await createPanelProject(prisma, { name: "RJ-A12", customerName: null, photoUrl: null, designMode: "DESIGN", occupancy: "COMMERCIAL_BD4", dims: { dinRailsCount: 1, modulesPerRail: 12 } });
    expect(created.occupancy).toBe("COMMERCIAL_BD4");
    // Plná lišta: 12 jističů 1 M → doplnění musí přidat novou DIN lištu
    await placeComponents(prisma, created.id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 12, circuitLabel: "Zásuvky – Prodejna" });
    const before = await lintOf(created.id);
    expect(before.issues.map((issue) => issue.rule)).toEqual(expect.arrayContaining(["bd4-central-stop", "bd4-mid-meter"]));
    const fix = before.issues.find((issue) => issue.rule === "bd4-central-stop")!.fix;
    if (fix?.kind !== "add-devices") throw new Error("oprava musí doplnit přístroje");
    const placed = await placeLintDevices(prisma, created.id, fix.devices);
    expect(placed.map((row) => row.rail)).toEqual([2, 2]);
    const after = await lintOf(created.id);
    expect(after.project.dinRailsCount).toBe(2);
    expect(after.project.items.map((item) => item.circuitLabel)).toEqual(expect.arrayContaining([CENTRAL_STOP_LABEL, MID_METER_LABEL]));
    expect(after.issues.some((issue) => issue.rule.startsWith("bd4-"))).toBe(false);
    // Konfigurace z linteru projde i omezeními akce (pole `power` nejvýš 12 znaků, štítek do 80 znaků)
    expect((midMeterConfig("ABB").power ?? "").length).toBeLessThanOrEqual(12);
    expect(shuntTripConfig("ABB")).toMatchObject({ category: "ACCESSORY", moduleSubtype: "SHUNT_TRIP" });
    expect(Math.max(CENTRAL_STOP_LABEL.length, MID_METER_LABEL.length)).toBeLessThanOrEqual(80);
  });
});

describe("fáze 93 – zálohování napájení a zdravotnické kategorie Knihy revizí", () => {
  beforeEach(() => seedMinimal(prisma));

  it("rozváděč: úroveň zálohy, kapacita zdroje a nájemní jednotka; běžná síť kapacitu smaže", async () => {
    const saved = await updatePowerBackup(prisma, { equipmentId: "eq-R-LIS-01", tier: "BACKUP_GENERATOR_DA", capacityKva: 250, tenantUnit: "  Lisovna –  nájemní jednotka A1 " });
    expect(saved).toMatchObject({ powerBackupTier: "BACKUP_GENERATOR_DA", backupCapacityKva: 250, tenantUnit: "Lisovna – nájemní jednotka A1" });
    const grid = await updatePowerBackup(prisma, { equipmentId: "eq-R-LIS-01", tier: "GRID_STANDARD", capacityKva: 250, tenantUnit: null });
    expect(grid).toMatchObject({ powerBackupTier: "GRID_STANDARD", backupCapacityKva: null, tenantUnit: null });
    await expect(updatePowerBackup(prisma, { equipmentId: "eq-R-LIS-01", tier: "CRITICAL_UPS_ZIS", capacityKva: -5, tenantUnit: null })).rejects.toThrow(/1–100 000 kVA/);
  });

  it("zdravotnický prostor: varianta Skupina 2 zkrátí lhůtu na 12 měsíců, IMD / ZIS IT na 6 měsíců", async () => {
    await prisma.equipment.create({ data: { id: "eq-zp", floorId: "f", tag: "ZP-A-01", name: "ZP-A-01 - Operační sál", type: "MEDICAL_ROOM", pinX: 20, pinY: 20 } });
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-zp", inspectionVariant: "GROUP_2" })).intervalMonths).toBe(12);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-zp" } })).inspectionVariant).toBe("GROUP_2");
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-zp", inspectionVariant: "IMD_IT" })).intervalMonths).toBe(6);
    // Varianta jiné kategorie se u zdravotnického prostoru neuloží (zůstane výchozí Skupina 1 – 36 měsíců)
    expect((await updateInspectionSettings(prisma, { equipmentId: "eq-zp", inspectionVariant: "CRITICAL_12" })).intervalMonths).toBe(36);
  });
});
