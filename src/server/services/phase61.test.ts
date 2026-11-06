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

/** Sběrnicová instalace: 2 světla (jedno stmívané 300 W), žaluzie, prostorová jednotka, tlačítka. */
const smartHouse = (smartSystem: string): FloorplanDraft => ({
  ...emptyDraft(),
  installation: "bus_loxone",
  smartSystem,
  environment: "INDOOR_DRY",
  rooms: [
    { id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
    { id: "m2", name: "Kuchyně", x: 5000, y: 0, w: 4000, h: 4000 },
  ],
  elements: [
    el("rh", "panel", 0, 2000, "Obývák"),
    el("z1", "socket", 2000, 0, "Obývák"),
    el("l1", "ceiling-light", 2500, 2000, "Obývák"),
    el("l2", "ceiling-light", 7000, 2000, "Kuchyně", { light: { dimmable: true, powerW: 300, load: "led" } }),
    el("t1", "bus-2", 4800, 1200, "Obývák", { controls: ["l1", "l2"] }),
    el("b1", "bus-blind", 4800, 1500, "Obývák"),
    el("r1", "bus-room", 4800, 1800, "Obývák"),
  ],
});

const loadItems = (id: string) => prisma.panelBoardItem.findMany({ where: { projectId: id }, include: { catalogComponent: true }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] });

describe("fáze 61 – akční členy chytré domácnosti v rozváděči z půdorysu", () => {
  it("ABB i-bus KNX: stmívač, spínací a žaluziový člen, zdroj a IP rozhraní s objednacími čísly; rozváděč Eaton nemění systémové prvky", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD61 KNX", customerName: null, companyId, draft: smartHouse("abb_knx"), manufacturer: "Eaton" });
    const items = await loadItems(result.id);
    // Přesný kus podle objednacího čísla – i když ho databáze vede pod jiným zápisem typu („SA/S4.16.2.2“)
    const knx = {
      "2CKA006197A0047": "UD/S 4.210.2.1",
      "2CDG110262R0011": "SA/S 4.16.2.2",
      "2CDG110125R0011": "JRA/S 4.230.5.1",
      "2CDG110058R0011": "ES/S 4.1.2.1",
      "2CDG110146R0011": "SV/S 30.640.5.1",
      "2CDG110204R0011": "IPS/S 3.5.1",
    };
    const smart = items.filter((item) => item.catalogComponent && item.catalogComponent.articleNumber in knx);
    expect(smart.map((item) => item.catalogComponent!.articleNumber).sort()).toEqual(Object.keys(knx).sort());
    expect(smart.find((item) => item.catalogComponent!.articleNumber === "2CKA006197A0047")!.catalogComponent!.typeCode).toBe("UD/S 4.210.2.1");
    // Systémové prvky zůstávají u svého systému (ABB), jističe a chrániče jsou od zvoleného výrobce
    for (const item of smart) expect(item.catalogComponent!.manufacturer).toBe("ABB");
    const mcbs = items.filter((item) => item.catalogComponent?.category === "MCB");
    expect(mcbs.length).toBeGreaterThan(0);
    for (const item of mcbs) expect(sameManufacturer(item.catalogComponent!.manufacturer, "Eaton")).toBe(true);
    // Stmívané svítidlo 300 W > 210 W na kanál → 2 kanály paralelně (varování ve výsledku generování)
    expect(result.warnings.some((warning) => /Chytrá domácnost \(ABB i-bus KNX.*2 kanály stmívače paralelně/.test(warning))).toBe(true);
  });

  it("ABB-free@home: akční členy z katalogu ABB 2026, systémový modul SysAP mimo lištu", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD61 free@home", customerName: null, companyId, draft: smartHouse("abb_freeathome"), manufacturer: "ABB" });
    const typeCodes = (await loadItems(result.id)).map((item) => item.catalogComponent?.typeCode);
    expect(typeCodes).toEqual(expect.arrayContaining(["SA-M-4.16.2.2", "DA/M.4.210.2.1", "BA-M-4.230.1.1", "HA-M-0.6.1", "PS-M-64.1.1"]));
    // SysAP je nástěnný (0 M) – na liště není
    expect(typeCodes).not.toContain("SAP.3");
    // Převod jističů na Eaton: akční členy i sběrnicový zdroj free@home (podtyp „zdroj DC“) zůstávají ABB
    await transferManufacturer(prisma, result.id, "Eaton", { apply: true });
    const after = await loadItems(result.id);
    for (const typeCode of ["SA-M-4.16.2.2", "DA/M.4.210.2.1", "PS-M-64.1.1"]) expect(after.find((item) => item.catalogComponent?.typeCode === typeCode)?.catalogComponent?.manufacturer).toBe("ABB");
    expect(after.filter((item) => item.catalogComponent?.category === "MCB").every((item) => sameManufacturer(item.catalogComponent!.manufacturer, "Eaton"))).toBe(true);
  });
});
