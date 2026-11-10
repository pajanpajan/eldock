import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { partsList } from "@/lib/panel-builder/documentation";
import { thermalDevices, thermalEnclosure } from "@/lib/panel-builder/thermal-input";
import { calculateThermal } from "@/lib/thermalCalculation";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { previewConfig } from "./panel-design";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

/** Sběrnicová instalace: světla (jedno stmívané), žaluzie, prostorová jednotka a tlačítka. */
const house = (smartSystem: string, smartExtras: Record<string, number> = {}): FloorplanDraft => ({
  ...emptyDraft(),
  installation: "bus_loxone",
  smartSystem,
  smartExtras,
  environment: "INDOOR_DRY",
  rooms: [
    { id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
    { id: "m2", name: "Kuchyně", x: 5000, y: 0, w: 4000, h: 4000 },
  ],
  elements: [
    el("rh", "panel", 0, 2000, "Obývák"),
    el("z1", "socket", 2000, 0, "Obývák"),
    el("l1", "ceiling-light", 2500, 2000, "Obývák"),
    el("l2", "ceiling-light", 7000, 2000, "Kuchyně", { light: { dimmable: true, powerW: 120, load: "led" } }),
    el("t1", "bus-2", 4800, 1200, "Obývák", { controls: ["l1", "l2"] }),
    el("b1", "bus-blind", 4800, 1500, "Obývák"),
    el("r1", "bus-room", 4800, 1800, "Obývák"),
  ],
});

const loadProject = (id: string) =>
  prisma.panelBoardProject.findUniqueOrThrow({ where: { id }, include: { items: { include: { catalogComponent: true }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] } } });

describe("fáze 81 – akční členy z půdorysu na DIN liště rozváděče (katalog prvků, Pv, kusovník)", () => {
  it("Loxone: automatické i ručně přidané kusy podle přesného klíče katalogu, vyhrazená lišta, Pv v oteplení a kusovníku", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD81 Loxone", customerName: null, companyId, draft: house("loxone", { "lox-relay": 1, "lox-tree": 1 }), manufacturer: "ABB" });
    const project = await loadProject(result.id);
    const smart = project.items.filter((item) => item.catalogComponent?.manufacturer === "Loxone");
    const articles = smart.map((item) => item.catalogComponent!.articleNumber);
    // Přesný kus seedu (klíč „LOXONE:…“ jako v importu katalogu výrobců) – žádný duplicitní odhad pod holým číslem
    expect(articles).toEqual(expect.arrayContaining(["LOXONE:100335", "LOXONE:100038", "LOXONE:100029", "LOXONE:100218"]));
    expect(await prisma.catalogComponent.count({ where: { articleNumber: { in: ["100335", "100038", "100029"] } } })).toBe(0);
    // Ručně přidaná Relay Extension a Tree Extension se přičtou k výpočtu
    expect(articles.filter((article) => article === "LOXONE:100038")).toHaveLength(1);
    expect(articles.filter((article) => article === "LOXONE:100218")).toHaveLength(1);
    const mini = smart.find((item) => item.catalogComponent!.articleNumber === "LOXONE:100335")!;
    expect(mini.catalogComponent).toMatchObject({ powerLossWatts: 6.7, modulesCount: 9, dataSource: "SEED_CATALOG" });
    expect(mini.modulesWidth).toBe(9);
    // Vyhrazená lišta chytré domácnosti: na liště Miniserveru jen řídicí jistič a moduly systému
    const rail = project.items.filter((item) => item.dinRailIndex === mini.dinRailIndex);
    expect(rail.every((item) => item.circuitLabel === "Ovládání a řídicí obvody" || item.catalogComponent?.category === "PLC" || item.catalogComponent?.category === "PSU")).toBe(true);
    expect(project.items.filter((item) => item.dinRailIndex < mini.dinRailIndex).some((item) => item.catalogComponent?.manufacturer === "Loxone")).toBe(false);
    // Krok 3: Pv modulů v součtu ztrát (jmenovitá ztráta kusu z katalogu prvků)
    const thermal = calculateThermal(thermalDevices(project.items), thermalEnclosure(project));
    const row = thermal.rows.find((entry) => entry.id === mini.id)!;
    expect(row.ratedLossW).toBe(6.7);
    expect(row.constantLossW + row.reducedLossW).toBeGreaterThan(0);
    expect(thermal.deviceLossW).toBeGreaterThan(6.7 + 11);
    // Krok 4: kusovník podle objednacích čísel
    const parts = partsList(project.items.map((item) => ({ ...item, component: item.catalogComponent ? { ...item.catalogComponent } : null })) as unknown as Parameters<typeof partsList>[0], null);
    expect(parts.find((row) => row.articleNumber === "LOXONE:100038")?.quantity).toBe(1);
    expect(parts.find((row) => row.articleNumber === "LOXONE:100335")?.quantity).toBe(1);
  });

  it("TapHome: Core a moduly na DIN lištu z katalogu prvků (klíč typu); chybí jen akční člen topení (zadání ho neuvádí)", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD81 TapHome", customerName: null, companyId, draft: house("taphome"), manufacturer: "ABB" });
    const project = await loadProject(result.id);
    const tap = project.items.filter((item) => item.catalogComponent?.manufacturer === "TapHome").map((item) => item.catalogComponent!.articleNumber);
    expect(tap).toEqual(expect.arrayContaining(["TAPHOME:CORE", "TAPHOME:6DO", "TAPHOME:4DO", "TAPHOME:DIMMER-4CH", "TAPHOME:PSU-24-V-DC-60-W"]));
    const missing = result.warnings.filter((warning) => warning.includes("nemá v databázi akční člen"));
    expect(missing.some((warning) => /pro (spínání|stmívání|žaluzie)/.test(warning))).toBe(false);
    expect(missing.some((warning) => warning.includes("pro topení"))).toBe(true);
  });

  it("katalog prvků: SysAP s adaptérem 7 M a přesný kus kaskády Kroku 1 se šířkou podle katalogu", async () => {
    const sysap = await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CKA006200A0871" } });
    expect(sysap).toMatchObject({ modulesCount: 7, category: "PLC", externalSource: null });
    const tap = await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "TAPHOME:6DO" } });
    expect(tap).toMatchObject({ manufacturer: "TapHome", modulesCount: 6, powerLossWatts: 4.5, dataSource: "IEC_ESTIMATE" });
    // Kaskáda: Loxone → Chytrá domácnost → systémový modul = Miniserver 9 M (náhled vrací šířku kusu)
    const preview = await previewConfig(prisma, { category: "SMART_HOME", manufacturer: "Loxone", poles: "1P", modules: 4, ratedCurrentA: null, smartRole: "system", smartSystem: null, channels: null });
    expect(preview).toMatchObject({ typeCode: "Miniserver", articleNumber: "LOXONE:100335", modules: 9, powerLossWatts: 6.7, estimated: false });
    const knx = await previewConfig(prisma, { category: "SMART_HOME", manufacturer: "ABB", poles: "1P", modules: 4, ratedCurrentA: null, smartRole: "switch", smartSystem: "abb_knx", channels: 8 });
    expect(knx).toMatchObject({ typeCode: "SA/S 8.16.2.2", modules: 8 });
  });
});
