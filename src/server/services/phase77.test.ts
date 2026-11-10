import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
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

/** Klasická instalace: DALI svítidlo, RGBW pásek, motory žaluzií se spínačem, čidlo vody v koupelně. */
const classicHouse = (): FloorplanDraft => ({
  ...emptyDraft(),
  installation: "classic",
  environment: "INDOOR_DRY",
  rooms: [
    { id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
    { id: "m2", name: "Koupelna", x: 5000, y: 0, w: 3000, h: 4000 },
  ],
  elements: [
    el("rh", "panel", 0, 2000, "Obývák"),
    el("z1", "socket", 2000, 0, "Obývák"),
    el("l1", "ceiling-light", 2500, 2000, "Obývák", { light: { dimmable: true, powerW: 30, load: "dali", control: "dali" } }),
    el("s1", "switch-1", 4800, 1200, "Obývák", { controls: ["l1"] }),
    el("p1", "led-strip", 2500, 3500, "Obývák", { light: { dimmable: true, powerW: 40, load: "led", color: "rgbw" } }),
    el("bs", "blind", 4800, 1500, "Obývák", { controls: ["mo1", "mo2"] }),
    el("mo1", "blind-motor", 1500, 4000, "Obývák"),
    el("mo2", "blind-motor", 3500, 4000, "Obývák"),
    el("v1", "water-sensor", 6500, 3800, "Koupelna"),
  ],
});

const loadItems = (id: string) => prisma.panelBoardItem.findMany({ where: { projectId: id }, include: { catalogComponent: true }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] });

describe("fáze 77 – moduly k prvkům půdorysu v generovaném rozváděči", () => {
  it("klasika: žaluziový okruh B10, zdroj LED 24 V a řadič PWM s typem, DALI jednotka, hlídač zaplavení; ventil do kusovníku", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD77", customerName: null, companyId, draft: classicHouse(), manufacturer: "ABB" });
    const items = await loadItems(result.id);
    const byType = (code: string) => items.filter((item) => item.customTypeCode === code);
    // 40 W × 1,2 = 48 W → zdroj 60 W; 4 kanály RGBW = 1 řadič PWM
    expect(byType("HDR-60-24")).toHaveLength(1);
    expect(byType("PWM 4× 24 V DC")).toHaveLength(1);
    expect(byType("DALI řadič 64")).toHaveLength(1);
    expect(byType("Hlídač zaplavení")).toHaveLength(1);
    expect(byType("Uzávěr vody")).toHaveLength(0);
    // Jistič žaluziového okruhu a zdroje LED (B10)
    expect(items.some((item) => item.circuitLabel.startsWith("Žaluzie – Obývák"))).toBe(true);
    expect(items.some((item) => item.circuitLabel.startsWith("Zdroj 24 V DC – LED osvětlení"))).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("LED 24 V: 1× pásek / svítidlo, 4 kanály PWM, zdroj 48 W"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("svítidlo DALI"))).toBe(true);
  });
});
