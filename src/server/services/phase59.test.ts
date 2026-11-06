import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import { addFloor, emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { createFrame } from "@/lib/panel-builder/floorplan-frames";

import { readWiringSnapshot } from "../../../prisma/external-catalog-source";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { addRail, createPanelProject } from "./panel-builder";
import { moveItem, placeComponents } from "./panel-design";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

const rows = (projectId: string) => prisma.panelBoardItem.findMany({ where: { projectId }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] });

describe("fáze 59 – přístroje na DIN liště jde měnit a přesouvat", () => {
  it("přesun po liště i na jinou lištu: pozice, IEC značení a strom (rodič) zůstanou konzistentní", async () => {
    const { id } = await createPanelProject(prisma, { name: "RD59", customerName: null, photoUrl: null, designMode: "DESIGN" });
    await placeComponents(prisma, id, { config: defaultConfig("RCD", { manufacturer: "ABB", modules: 4 }), rail: 1, count: 1 });
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 3 });
    await addRail(prisma, id);
    let items = await rows(id);
    const rcd = items[0];
    // Strom: jističe pod chráničem
    await prisma.panelBoardItem.updateMany({ where: { projectId: id, id: { not: rcd.id } }, data: { parentItemId: rcd.id } });
    const last = items[3];
    await moveItem(prisma, last.id, 1, 1);
    items = await rows(id);
    expect(items.map((item) => item.id)[0]).toBe(last.id);
    expect(items.map((item) => item.positionOnRail)).toEqual([1, 2, 3, 4]);
    await moveItem(prisma, last.id, 2, 1);
    items = await rows(id);
    const moved = items.find((item) => item.id === last.id)!;
    expect(moved).toMatchObject({ dinRailIndex: 2, positionOnRail: 1, parentItemId: rcd.id });
    expect(items.filter((item) => item.dinRailIndex === 1).map((item) => item.positionOnRail)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.designation)).toEqual(["-FI1", "-F1", "-F2", "-F3"]);
    // Plná lišta: srozumitelná chyba
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 2, count: 11 });
    await expect(moveItem(prisma, rcd.id, 2, 1)).rejects.toThrow(/nevejde/);
  });
});

describe("fáze 59 – rozváděč z vícepodlažního půdorysu s víceramečkem", () => {
  it("okruhy obou podlaží, jeden víceramček 3R k jističi zásuvek a domovní přístroje z obou podlaží", async () => {
    await importWiringDevices(prisma, (readWiringSnapshot() ?? []).filter((row) => row.series === "Tango"));
    const companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
    const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
    let draft: FloorplanDraft = { ...emptyDraft(), series: "ABB|Tango", color: "abb-tango-b", environment: "INDOOR_DRY", elements: [el("rh", "panel", 0, 0), el("z1", "socket", 2000, 0), el("z2", "socket", 2400, 0), el("s1", "switch-1", 2800, 0, { controls: ["l1"] }), el("l1", "ceiling-light", 2500, 2000)] };
    const framed = createFrame(draft, ["z1", "z2", "s1"]);
    if (!framed.ok) throw new Error(framed.error);
    draft = addFloor(framed.draft, { name: "2. NP" });
    draft = { ...draft, elements: [el("st", "riser", 0, 0, { room: "Chodba" }), el("z3", "socket", 3000, 4000, { room: "Ložnice" }), el("l2", "ceiling-light", 3000, 2000, { room: "Ložnice" }), el("s2", "switch-1", 1000, 2000, { room: "Ložnice", controls: ["l2"] })] };
    const result = await createProjectFromFloorplan(prisma, { name: "RD59 patrový", customerName: null, companyId, draft });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { include: { wiringDevices: { include: { wiringDevice: true } } } } } });
    const labels = project.items.map((item) => item.circuitLabel);
    expect(labels.some((label) => /Zásuvky – Kuchyně \(1\. NP\)/.test(label))).toBe(true);
    expect(labels.some((label) => /Zásuvky – Ložnice \(2\. NP\)/.test(label))).toBe(true);
    const frames = project.items.flatMap((item) => item.wiringDevices).filter((row) => row.wiringDevice.category === "WD_FRAME");
    expect(frames.map((row) => row.wiringDevice.frameUnits)).toContain(3);
    expect(JSON.parse(project.floorplanJson!).otherFloors).toHaveLength(1);
  });
});
