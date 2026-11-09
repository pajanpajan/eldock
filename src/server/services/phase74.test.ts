import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, parseCableReport, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createProjectFromFloorplan, parseFeederInfo } from "./panel-projects";
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

const el = (id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch }) as EditorElement;

/** Dům s hlavním rozváděčem a garáží napájenou z podružného rozváděče RP1. */
function house(): FloorplanDraft {
  return {
    ...emptyDraft(),
    series: "ABB|Levit",
    rooms: [
      { id: "m1", name: "Obývák", x: 0, y: 0, w: 6000, h: 4000 },
      { id: "m2", name: "Garáž", x: 6000, y: 0, w: 5000, h: 4000 },
    ],
    elements: [
      el("rh", "panel", 300, 2000, "Obývák"),
      el("z1", "socket", 2000, 0, "Obývák"),
      el("z2", "socket", 4000, 4000, "Obývák"),
      el("l1", "ceiling-light", 3000, 2000, "Obývák"),
      el("s1", "switch-1", 1000, 4000, "Obývák", { controls: ["l1"] }),
      el("rp", "subpanel", 10_700, 2000, "Garáž", { boardCode: "RP1" }),
      el("g1", "socket", 8000, 0, "Garáž", { board: "RP1" }),
      el("g2", "socket", 9000, 4000, "Garáž", { board: "RP1" }),
      el("gl", "ceiling-light", 8500, 2000, "Garáž", { board: "RP1" }),
      el("gs", "switch-1", 6500, 4000, "Garáž", { controls: ["gl"], board: "RP1" }),
      el("wb", "wallbox", 10_900, 3500, "Garáž", { board: "RP1" }),
    ],
  };
}

describe("fáze 74 – rozváděč z půdorysu s podružným rozváděčem", () => {
  it("vytvoří hlavní rozváděč s přívodem RP1 a propojený projekt podružného rozváděče s jeho okruhy", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD Novák", customerName: null, companyId, draft: house() });
    expect(result.boards.map((board) => board.code)).toEqual(["RH", "RP1"]);
    const main = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: true } });
    const sub = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.boards[1].id }, include: { items: true } });
    expect(main.boardCode).toBe("RH");
    expect(sub).toMatchObject({ boardCode: "RP1", parentBoardId: main.id });
    expect(sub.name).toContain("podružný rozváděč RP1");
    // Hlavní rozváděč: jistič přívodu RP1 (3P) mimo chrániče, žádné okruhy garáže
    const feederItem = main.items.find((item) => item.circuitLabel.startsWith("Přívod podružného rozváděče RP1"));
    expect(feederItem).toBeDefined();
    expect(main.items.some((item) => /Garáž/.test(item.circuitLabel) && !item.circuitLabel.startsWith("Přívod"))).toBe(false);
    // Podružný rozváděč: okruhy garáže včetně wallboxu (chránič typ B) a vlastní hlavní vypínač
    expect(sub.items.some((item) => /Garáž/.test(item.circuitLabel))).toBe(true);
    expect(sub.items.some((item) => /elektromobil/i.test(item.circuitLabel))).toBe(true);
    // Přívod uložený u podružného rozváděče (titulní list a rozcestník obvodů)
    const feeder = parseFeederInfo(sub.feederJson)!;
    expect(feeder).toMatchObject({ board: "RP1", fromBoard: "RH", fromProjectId: main.id, fromProjectCode: main.code });
    expect(feeder.cable).toMatch(/^CYKY-J 5×/);
    expect(feeder.designation).toBe(feederItem!.designation);
    expect(feeder.lengthM).toBeGreaterThan(9);
    // Výkaz kabeláže každého rozváděče jen s jeho okruhy
    expect(parseCableReport(sub.cableReportJson)!.circuits.every((row) => /Garáž/.test(row.label))).toBe(true);
    expect(parseCableReport(main.cableReportJson)!.circuits.some((row) => /Přívod podružného rozváděče/.test(row.label))).toBe(true);
    // Domovní přístroje garáže jen u podružného rozváděče
    const wiring = await prisma.panelItemWiring.findMany({ where: { itemId: { in: main.items.map((item) => item.id) } } });
    expect(wiring.every((row) => row.room !== "Garáž")).toBe(true);
  });

  it("bez podružného rozváděče s okruhy vznikne jen hlavní rozváděč (beze změny)", async () => {
    const draft = house();
    const plain = { ...draft, elements: draft.elements.map((element) => ({ ...element, board: undefined })).filter((element) => element.item !== "subpanel") };
    const result = await createProjectFromFloorplan(prisma, { name: "RD", customerName: null, companyId, draft: plain });
    expect(result.boards).toEqual([]);
    const main = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } });
    expect(main.boardCode).toBeNull();
    expect(main.parentBoardId).toBeNull();
  });
});
