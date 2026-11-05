import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, parseCableReport, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import { readWiringSnapshot } from "../../../prisma/external-catalog-source";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  await importWiringDevices(prisma, (readWiringSnapshot() ?? []).filter((row) => row.series === "Levit" || row.series === "Valena Life"));
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const el = (id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, controls: [], ...patch });

function house(): FloorplanDraft {
  return {
    ...emptyDraft(),
    series: "ABB|Levit",
    elements: [
      el("rh", "panel", 500, 500, "Chodba"),
      el("z1", "double-socket", 3000, 1000, "Obývák", { frameUnits: 2 }),
      el("z2", "socket", 6000, 1000, "Obývák"),
      el("k1", "worktop-socket", 4000, 6000, "Kuchyně"),
      el("k2", "worktop-socket", 5000, 6000, "Kuchyně"),
      el("l1", "ceiling-light", 4000, 3000, "Obývák"),
      el("s1", "switch-6", 2000, 2000, "Obývák", { controls: ["l1"] }),
      el("s2", "switch-6", 7000, 2000, "Obývák", { controls: ["l1"] }),
      el("ov", "oven", 6000, 6500, "Kuchyně"),
      el("vd", "cooktop", 6500, 6500, "Kuchyně"),
      el("d1", "data-socket", 3500, 1000, "Obývák"),
    ],
  };
}

describe("⚡ rozváděč z 2D půdorysu", () => {
  it("vytvoří návrh s okruhy, skříní, domovními přístroji řady ABB Levit a uloženým výkazem kabeláže", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD z půdorysu", customerName: null, companyId, draft: house() });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { include: { wiringDevices: { include: { wiringDevice: true } } } } } });
    expect(project.designMode).toBe("DESIGN");
    expect(project.items.find((item) => item.circuitLabel.startsWith("Trouba"))).toBeTruthy();
    expect(project.items.find((item) => item.circuitLabel.startsWith("Varná deska"))).toBeTruthy();
    // Dvojzásuvky ve 2R rámečku a zásuvky přiřazené k jističi obývacího pokoje
    const wiring = project.items.flatMap((item) => item.wiringDevices.map((row) => ({ item: item.circuitLabel, room: row.room, quantity: row.quantity, title: row.wiringDevice.title, series: row.wiringDevice.series })));
    expect(wiring.every((row) => row.series === "Levit")).toBe(true);
    expect(wiring.find((row) => /dvojzásuvka/.test(row.title) && row.room === "Obývák")?.quantity).toBe(2);
    // Dvě ovládací místa jednoho světla = 2× vypínač č. 6 u světelného okruhu
    expect(wiring.filter((row) => /vypínač č\.6/.test(row.title) && row.item.startsWith("Světla")).reduce((sum, row) => sum + row.quantity, 0)).toBe(2);
    const report = parseCableReport(project.cableReportJson);
    expect(report?.mode).toBe("OPTIMIZED");
    expect(report?.byCable.map((row) => row.cable)).toEqual(expect.arrayContaining(["CYKY-J 3×2,5", "CYKY-J 5×2,5", "CYKY-O 3×1,5", "UTP Cat6"]));
    expect(report!.totals.OPTIMIZED).toBeLessThanOrEqual(Math.min(report!.totals.BOTTOM, report!.totals.TOP));
    expect(JSON.parse(project.floorplanJson ?? "{}").elements).toHaveLength(11);
  });

  it("bez rozváděče nebo bez silových vývodů = srozumitelná chyba", async () => {
    await expect(createProjectFromFloorplan(prisma, { name: "x", customerName: null, companyId, draft: { ...emptyDraft(), elements: [el("z", "socket", 1000, 1000, "A")] } })).rejects.toThrow(/rozváděč/);
    await expect(createProjectFromFloorplan(prisma, { name: "x", customerName: null, companyId, draft: { ...emptyDraft(), elements: [el("rh", "panel", 0, 0, "A"), el("d", "data-socket", 1000, 0, "A")] } })).rejects.toThrow(/silový vývod/);
    await expect(createProjectFromFloorplan(prisma, { name: "x", customerName: null, companyId, draft: "nesmysl" })).rejects.toThrow(/načíst/);
  });
});
