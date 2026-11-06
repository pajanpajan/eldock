import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { sameManufacturer } from "@/lib/panel-builder/matching";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createProjectFromFloorplan } from "./panel-projects";
import { transferManufacturer } from "./panel-transfer";
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
const house = (): FloorplanDraft => ({
  ...emptyDraft(),
  environment: "INDOOR_DRY",
  rooms: [
    { id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
    { id: "m2", name: "Kuchyně", x: 5000, y: 0, w: 4000, h: 4000 },
  ],
  elements: [
    el("rh", "panel", 0, 2000, "Obývák"),
    el("z1", "double-socket", 2000, 0, "Obývák"),
    el("z2", "socket", 5000, 3000, "Obývák"),
    el("z3", "worktop-socket", 7000, 0, "Kuchyně"),
    el("l1", "ceiling-light", 2500, 2000, "Obývák"),
    el("l2", "ceiling-light", 7000, 2000, "Kuchyně"),
    el("s1", "switch-1", 4800, 1200, "Obývák", { controls: ["l1"] }),
    el("s2", "switch-1", 5200, 1200, "Kuchyně", { controls: ["l2"] }),
    el("tr", "oven", 8500, 3000, "Kuchyně"),
  ],
});

const loadProject = (id: string) => prisma.panelBoardProject.findUniqueOrThrow({ where: { id }, include: { items: { include: { catalogComponent: true }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] } } });

describe("fáze 60 – rozváděč z půdorysu podle hierarchie od jednoho výrobce", () => {
  it("strom: hlavní vypínač = kořen, SPD a chrániče pod ním, jističe pod svým chráničem, RCBO pod hlavním vypínačem; vše ABB", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD60 ABB", customerName: null, companyId, draft: house(), manufacturer: "ABB" });
    const project = await loadProject(result.id);
    expect(project.status).toBe("TREE_BUILT");
    const byId = new Map(project.items.map((item) => [item.id, item]));
    const root = project.items.find((item) => item.catalogComponent?.category === "MAIN_SWITCH")!;
    expect(root).toMatchObject({ parentItemId: null, fedFromIncomer: true });
    // Pořadí na lištách: hlavní vypínač první, za ním svodič přepětí
    expect(project.items[0].id).toBe(root.id);
    expect(project.items[1].catalogComponent?.category).toBe("SPD");
    for (const item of project.items.filter((candidate) => candidate.catalogComponent?.category === "RCD")) expect(item.parentItemId).toBe(root.id);
    const mcbs = project.items.filter((item) => item.catalogComponent?.category === "MCB" && item.circuitLabel.startsWith("Zásuvky"));
    expect(mcbs.length).toBeGreaterThan(0);
    for (const mcb of mcbs) expect(byId.get(mcb.parentItemId!)?.catalogComponent?.category).toBe("RCD");
    for (const rcbo of project.items.filter((item) => item.catalogComponent?.category === "RCBO")) expect(rcbo.parentItemId).toBe(root.id);
    expect(project.items.every((item) => sameManufacturer(item.catalogComponent?.manufacturer, "ABB"))).toBe(true);
    expect(project.dominantManufacturer).toBe("ABB");
  });

  it("jiný výrobce: celý rozváděč Eaton (chybějící kus = odhad Eaton s varováním, nikdy jiný výrobce)", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD60 Eaton", customerName: null, companyId, draft: house(), manufacturer: "Eaton" });
    const project = await loadProject(result.id);
    expect(project.items.every((item) => sameManufacturer(item.catalogComponent?.manufacturer, "Eaton"))).toBe(true);
    const estimates = project.items.filter((item) => item.catalogComponent?.dataSource === "IEC_ESTIMATE");
    if (estimates.length) expect(result.warnings[0]).toMatch(/^Eaton v databázi prvků nemá/);
  });
});

describe("fáze 60 – převod hotového rozváděče na jiného výrobce", () => {
  it("náhled bez zápisu, pak převod: značení, popisy obvodů a strom zůstanou, přístroje jsou od nového výrobce", async () => {
    const { id } = await createProjectFromFloorplan(prisma, { name: "RD60 převod", customerName: null, companyId, draft: house(), manufacturer: "ABB" });
    const before = await loadProject(id);
    const preview = await transferManufacturer(prisma, id, "Eaton", { apply: false });
    expect(preview.applied).toBe(false);
    expect(preview.summary.changed).toBeGreaterThan(0);
    expect((await loadProject(id)).items.map((item) => item.catalogComponentId)).toEqual(before.items.map((item) => item.catalogComponentId));
    const done = await transferManufacturer(prisma, id, "Eaton", { apply: true });
    expect(done.applied).toBe(true);
    const after = await loadProject(id);
    const snapshot = (items: typeof before.items) => items.map((item) => [item.id, item.designation, item.circuitLabel, item.parentItemId]);
    expect(snapshot(after.items).sort()).toEqual(snapshot(before.items).sort());
    const changed = after.items.filter((item) => done.rows.find((row) => row.itemId === item.id)?.status !== "keep");
    expect(changed.every((item) => sameManufacturer(item.catalogComponent?.manufacturer, "Eaton"))).toBe(true);
    expect(after.dominantManufacturer).toBe("Eaton");
    await expect(transferManufacturer(prisma, id, "Eaton", { apply: true })).rejects.toThrow(/už je od výrobce Eaton/);
  });
});
