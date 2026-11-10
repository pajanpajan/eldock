import { describe, expect, it } from "vitest";

import { buildSwitchboardFromCircuits, calibrateFloorplanScale, generateCircuitsFromFloorplan, type FloorNode, type Floorplan } from "@/engine/floorplan-bridge";
import { floorplanFromSchedule } from "@/engine/room-schedule";

import { GENERATED_CATALOG } from "../../../prisma/seed-catalog-generated";
import { DEFAULT_CHIPS } from "./circuit-chips";
import { analyzeDraft, emptyDraft, parseDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { applyNormFix, floorplanNorms } from "./floorplan-norms";
import { assignLightingCircuit, assignSocketCircuit, lightingSocketIds, lightingSocketRows } from "./socket-circuits";

const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 1000 }], panelPx: [0, 0] });
const node = (id: string, kind: FloorNode["kind"], room: string, x: number, extra: Partial<FloorNode> = {}): FloorNode => ({ id, kind, room, px: [x, 0], ...extra });
/** Dvě místnosti se světly, zásuvka obýváku na světelném okruhu a běžné zásuvky. */
const plan = (extra: Partial<FloorNode> = {}): Floorplan => ({
  mode: "classic",
  rooms: [
    { id: "a", name: "Obývák" },
    { id: "b", name: "Ložnice" },
  ],
  nodes: [
    node("l1", "light", "a", 3000),
    node("l2", "light", "b", 6000),
    node("z1", "single_socket", "a", 3500, { onLighting: true, ...extra }),
    node("z2", "double_socket", "a", 4000),
    node("z3", "double_socket", "b", 6500),
  ],
});

describe("fáze 82 – zásuvky na světelném okruhu (jištění 10 / 13 A)", () => {
  it("zásuvka jde na světelný okruh své místnosti s jističem 10 A (RCBO), zásuvkové okruhy ji nemají", () => {
    const { circuits } = generateCircuitsFromFloorplan(plan(), calibration);
    const mixed = circuits.find((circuit) => circuit.nodeIds.includes("z1"))!;
    expect(mixed).toMatchObject({ kind: "lighting", label: "Světla + zásuvky – Obývák", outlets: 1, crossSectionMm2: 1.5, protection: { device: "RCBO", ratedA: 10 } });
    expect(mixed.nodeIds).toEqual(expect.arrayContaining(["l1", "z1"]));
    // Druhý světelný okruh beze změny, zásuvkové okruhy B16 bez zásuvky ze světla
    expect(circuits.find((circuit) => circuit.nodeIds.includes("l2"))).toMatchObject({ label: "Světla – Ložnice", outlets: 0, protection: { ratedA: 10 } });
    for (const circuit of circuits.filter((row) => row.kind === "sockets")) {
      expect(circuit.nodeIds).not.toContain("z1");
      expect(circuit.protection.ratedA).toBe(16);
    }
    // Světelný okruh nikdy 16 A
    expect(circuits.filter((circuit) => circuit.kind === "lighting").every((circuit) => circuit.protection.ratedA <= 13)).toBe(true);
  });

  it("13 A: v uložení C zůstane 1,5 mm², v trubce (tab. 9 – 1,5 mm² nejvýš 10 A) průřez 2,5 mm² s vysvětlením", () => {
    const c = generateCircuitsFromFloorplan(plan(), calibration, { lightingSocketA: 13 });
    expect(c.circuits.find((circuit) => circuit.nodeIds.includes("z1"))).toMatchObject({ crossSectionMm2: 1.5, protection: { ratedA: 13 } });
    const b2 = generateCircuitsFromFloorplan(plan(), calibration, { lightingSocketA: 13, installMethod: "B2", lightingProtection: "rcd_group" });
    const mixed = b2.circuits.find((circuit) => circuit.nodeIds.includes("z1"))!;
    expect(mixed).toMatchObject({ crossSectionMm2: 2.5, protection: { device: "MCB", ratedA: 13 }, rcd: "A30L" });
    expect(b2.warnings.some((warning) => warning.startsWith("Světla + zásuvky – Obývák") && warning.includes("alternativa: jistič 10 A") && warning.includes("2,5 mm²"))).toBe(true);
  });

  it("podlaží bez světla vrátí zásuvku na zásuvkový okruh; nad 10 vývodů varování", () => {
    const dark = generateCircuitsFromFloorplan({ ...plan(), nodes: plan().nodes.filter((row) => row.kind !== "light") }, calibration);
    expect(dark.circuits.find((circuit) => circuit.nodeIds.includes("z1"))?.kind).toBe("sockets");
    expect(dark.warnings).toContain("1× zásuvka na světelném okruhu, ale na podlaží není světlo – zůstává na zásuvkovém okruhu.");
    const many = generateCircuitsFromFloorplan({ ...plan(), nodes: [...plan().nodes, ...Array.from({ length: 9 }, (_, index) => node(`x${index}`, "double_socket", "a", 4500 + index * 100, { onLighting: true }))] }, calibration);
    expect(many.warnings.some((warning) => /Světla \+ zásuvky – Obývák: 2\d vývodů/.test(warning))).toBe(true);
  });

  it("rozváděč: RCBO / jistič B13 s popisem okruhu; katalog má RCBO B13 a štítek Kroku 1 „Světla + zásuvky“ (10 A)", () => {
    const circuits = generateCircuitsFromFloorplan(plan(), calibration, { lightingSocketA: 13 });
    const board = buildSwitchboardFromCircuits(circuits, { mode: "classic", enclosures: [], railModules: 24 });
    const device = board.devices.find((row) => row.label === "Světla + zásuvky – Obývák")!;
    expect(device).toMatchObject({ category: "RCBO", ratedA: 13, poles: "1P+N" });
    expect(GENERATED_CATALOG.some((row) => row.category === "RCBO" && row.manufacturer === "ABB" && row.ratedCurrentA === 13 && row.trippingCurve === "B")).toBe(true);
    expect(DEFAULT_CHIPS.find((chip) => chip.id === "lights-sockets")).toMatchObject({ label: "Světla + zásuvky", preset: { category: "MCB", ratedCurrentA: 10 } });
  });

  it("soupis místností AI Panel Builderu: sloupec zásuvek na světelném okruhu (jen u místnosti se světlem)", () => {
    const { plan: schedule, calibration: scale } = floorplanFromSchedule(
      [
        { name: "Obývák", distanceM: 6, singleSockets: 2, doubleSockets: 2, lights: 2, switchPlaces: 1, appliances: [], lightingSockets: 1 },
        { name: "Sklep", distanceM: 4, singleSockets: 1, doubleSockets: 0, lights: 0, switchPlaces: 0, appliances: [], lightingSockets: 2 },
      ],
      "classic",
    );
    expect(schedule.nodes.filter((row) => row.onLighting)).toHaveLength(1);
    const { circuits } = generateCircuitsFromFloorplan(schedule, scale, { lightingSocketA: 13 });
    expect(circuits.some((circuit) => circuit.label === "Světla + zásuvky – Obývák" && circuit.protection.ratedA === 13 && circuit.outlets === 1)).toBe(true);
  });
});

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const draft = (extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({
  ...emptyDraft(),
  rooms: [{ id: "m1", name: "Kuchyně", x: 0, y: 0, w: 5000, h: 4000 }],
  elements: [el("rh", "panel", 0, 2000, "Kuchyně"), el("l1", "ceiling-light", 2500, 2000, "Kuchyně"), el("z1", "socket", 1000, 0, "Kuchyně"), el("z2", "worktop-socket", 4000, 0, "Kuchyně"), el("z3", "socket", 3000, 4000, "Kuchyně")],
  ...extra,
});

describe("fáze 82 – zásuvka na světelném okruhu v 2D půdorysu", () => {
  it("volba u zásuvky: na světelný okruh a zpět, ruční okruh se zruší; přehled smíšených okruhů s jističem", () => {
    const manual = assignSocketCircuit(draft(), ["z1"], "Z1");
    const on = assignLightingCircuit(manual, ["z1", "l1"]);
    expect(on.elements.find((element) => element.id === "z1")).toMatchObject({ onLighting: true });
    expect(on.elements.find((element) => element.id === "z1")?.socketCircuit).toBeUndefined();
    expect(on.elements.find((element) => element.id === "l1")?.onLighting).toBeUndefined();
    expect(lightingSocketIds(on)).toEqual(["z1"]);
    const rows = lightingSocketRows(analyzeDraft({ ...on, lightingSocketA: 13 }).circuits.circuits);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Světla + zásuvky – Kuchyně", outlets: 1, ratedA: 13, elementIds: expect.arrayContaining(["l1", "z1"]) });
    expect(rows[0].designation).toMatch(/^-F/);
    const back = assignSocketCircuit(on, ["z1"], null);
    expect(back.elements.find((element) => element.id === "z1")?.onLighting).toBeUndefined();
    // Uložení: volba zásuvky a jištění zůstanou, neplatné se zahodí (světlo ani 16 A nejde)
    const saved = parseDraft(JSON.parse(JSON.stringify({ ...on, lightingSocketA: 13, elements: [...on.elements, el("l2", "ceiling-light", 1000, 1000, "Kuchyně", { onLighting: true })] })))!;
    expect(saved.lightingSocketA).toBe(13);
    expect(saved.elements.filter((element) => element.onLighting).map((element) => element.id)).toEqual(["z1"]);
    expect(parseDraft(JSON.parse(JSON.stringify({ ...on, lightingSocketA: 16 })))!.lightingSocketA).toBe(10);
  });

  it("normový hlídač: zásuvky na světelném okruhu (jištění), zásuvka linky = varování s opravou zpět na zásuvkový okruh", () => {
    const on = { ...assignLightingCircuit(draft(), ["z1", "z2"]), lightingSocketA: 13 as const };
    const issues = floorplanNorms(on);
    const info = issues.find((issue) => issue.rule === "lighting-socket")!;
    expect(info).toMatchObject({ level: "info", elementIds: ["z1", "z2"] });
    expect(info.text).toContain("jistič 13 A (nikdy 16 A)");
    const worktop = issues.find((issue) => issue.rule === "lighting-socket-worktop")!;
    expect(worktop).toMatchObject({ level: "warning", elementIds: ["z2"] });
    const fixed = applyNormFix(on, worktop);
    expect(fixed.elements.find((element) => element.id === "z2")?.onLighting).toBeUndefined();
    expect(fixed.elements.find((element) => element.id === "z1")?.onLighting).toBe(true);
    expect(floorplanNorms(fixed).some((issue) => issue.rule === "lighting-socket-worktop")).toBe(false);
  });
});
