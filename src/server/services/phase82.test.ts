import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { SAMPLE_SCHEDULE } from "@/engine/room-schedule";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import { readWiringSnapshot } from "../../../prisma/external-catalog-source";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { createProjectFromFloorplan, createProjectFromSchedule } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  // Domovní přístroje řady Levit (výchozí řada nákresu) – přiřazení k jističům okruhů
  await importWiringDevices(prisma, (readWiringSnapshot() ?? []).filter((row) => row.series === "Levit"));
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const loadItems = (id: string) => prisma.panelBoardItem.findMany({ where: { projectId: id }, include: { catalogComponent: true, wiringDevices: { include: { wiringDevice: true } } }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] });
const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

describe("fáze 82 – zásuvky na světelném okruhu v AI Panel Builderu", () => {
  it("soupis místností: světelný okruh se zásuvkou dostane RCBO B13 z katalogu prvků (ne odhad) s popisem okruhu", async () => {
    const rooms = SAMPLE_SCHEDULE.map((room) => (room.name === "Obývací pokoj" ? { ...room, lightingSockets: 1 } : room));
    const result = await createProjectFromSchedule(prisma, { name: "RD82 soupis", customerName: null, companyId, rooms, mode: "classic", lightingSocketA: 13 });
    const items = await loadItems(result.id);
    const mixed = items.find((item) => item.circuitLabel.startsWith("Světla + zásuvky"))!;
    expect(mixed.circuitLabel).toContain("Obývací pokoj");
    expect(mixed.catalogComponent).toMatchObject({ category: "RCBO", ratedCurrentA: 13, trippingCurve: "B", rcdSensitivityMa: 30 });
    expect(mixed.catalogComponent!.articleNumber.startsWith("CFG-")).toBe(false);
    // Ostatní světelné okruhy zůstávají na 10 A, zásuvkové na 16 A
    expect(items.filter((item) => item.circuitLabel.startsWith("Světla –")).every((item) => item.catalogComponent?.ratedCurrentA === 10)).toBe(true);
    expect(items.filter((item) => item.circuitLabel.startsWith("Zásuvky")).every((item) => item.catalogComponent?.ratedCurrentA === 16)).toBe(true);
  });

  it("2D půdorys: zásuvka na světelném okruhu jde pod jeho jistič B10 i s domovním přístrojem; volba se uloží do projektu", async () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      environment: "INDOOR_DRY",
      rooms: [
        { id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
        { id: "m2", name: "Ložnice", x: 5000, y: 0, w: 4000, h: 4000 },
      ],
      elements: [
        el("rh", "panel", 0, 2000, "Obývák"),
        el("l1", "ceiling-light", 2500, 2000, "Obývák"),
        el("l2", "ceiling-light", 7000, 2000, "Ložnice"),
        el("s1", "switch-1", 4800, 1500, "Obývák", { controls: ["l1"] }),
        el("z1", "socket", 1000, 0, "Obývák", { onLighting: true }),
        el("z2", "double-socket", 3000, 4000, "Obývák"),
      ],
    };
    const result = await createProjectFromFloorplan(prisma, { name: "RD82 půdorys", customerName: null, companyId, draft, manufacturer: "ABB" });
    const items = await loadItems(result.id);
    const mixed = items.find((item) => item.circuitLabel === "Světla + zásuvky – Obývák")!;
    expect(mixed.catalogComponent).toMatchObject({ manufacturer: "ABB", category: "RCBO", ratedCurrentA: 10 });
    expect(mixed.wiringDevices.reduce((sum, row) => sum + row.quantity, 0)).toBeGreaterThan(0);
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, select: { floorplanJson: true } });
    expect(JSON.parse(project.floorplanJson!).elements.find((element: EditorElement) => element.id === "z1").onLighting).toBe(true);
  });
});
