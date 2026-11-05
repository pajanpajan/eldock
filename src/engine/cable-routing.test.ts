import { describe, expect, it } from "vitest";

import { chainOrder, circuitRoutes, routeCircuit, summarizeCabling, type RouteNode } from "./cable-routing";
import { DEFAULT_ELEVATION, calibrateFloorplanScale, elevationProfile, homeRunLength, mountHeight, type Circuit } from "./floorplan-bridge";

const panel = { x: 0, y: 0 };
const node = (id: string, x: number, heightMm: number, extra: Partial<RouteNode> = {}): RouteNode => ({ id, x, y: 0, heightMm, room: "kuchyne", ...extra });
const circuit = (id: string, nodeIds: string[], patch: Partial<Circuit> = {}) => ({
  id,
  label: id,
  cable: "CYKY-J 3x2,5",
  nodeIds,
  kind: "sockets" as const,
  phases: 1 as const,
  crossSectionMm2: 2.5,
  protection: { device: "MCB" as const, poles: "1P" as const, curve: "B" as const, ratedA: 16 },
  ...patch,
});

describe("výškový profil a montážní výšky", () => {
  it("výchozí výšky podle druhu, vlastní výška má přednost", () => {
    expect(mountHeight({ kind: "single_socket" })).toBe(300);
    expect(mountHeight({ kind: "double_socket", variant: "worktop" })).toBe(1150);
    expect(mountHeight({ kind: "switch" })).toBe(1050);
    expect(mountHeight({ kind: "light" })).toBe(2600);
    expect(mountHeight({ kind: "light", variant: "wall" })).toBe(2000);
    expect(mountHeight({ kind: "single_socket", mountHeightMm: 1150 })).toBe(1150);
    expect(mountHeight({ kind: "light" }, elevationProfile({ ceilingHeightMm: 2800 }))).toBe(2800);
  });

  it("samostatný přívod: spodem = svod + podlaha + výstup, vrchem = výstup + strop + spuštění", () => {
    // spodem: 4000 + (1500 + 50) + (300 + 50); vrchem: 4000 + (2600 − 1500) + (2600 − 300)
    expect(homeRunLength(panel, { x: 4000, y: 0 }, 300, "BOTTOM", DEFAULT_ELEVATION)).toBe(5900);
    expect(homeRunLength(panel, { x: 4000, y: 0 }, 300, "TOP", DEFAULT_ELEVATION)).toBe(7400);
    expect(homeRunLength(panel, { x: 4000, y: 0 }, 300, "OPTIMIZED", DEFAULT_ELEVATION)).toBe(5900);
    // stropní světlo je kratší vrchem
    expect(homeRunLength(panel, { x: 4000, y: 0 }, 2600, "OPTIMIZED", DEFAULT_ELEVATION)).toBe(5100);
  });
});

describe("režimy vedení BOTTOM / TOP / OPTIMIZED", () => {
  it("zásuvka 300 mm: spodem kratší; rezerva 10 % + 600 mm v rozváděči + 150 mm krabice", () => {
    const routes = circuitRoutes([node("z1", 4000, 300)], panel);
    expect(routes.BOTTOM).toMatchObject({ rawMm: 5900, totalMm: 7240 });
    expect(routes.TOP).toMatchObject({ rawMm: 7400, totalMm: 8890 });
    expect(routes.OPTIMIZED.mode).toBe("BOTTOM");
  });

  it("změna výšky zásuvky z 300 na 1150 mm přepne optimalizaci na vedení vrchem", () => {
    const low = circuitRoutes([node("z1", 4000, 300)], panel);
    const high = circuitRoutes([node("z1", 4000, 1150)], panel);
    expect(high.BOTTOM.rawMm - low.BOTTOM.rawMm).toBe(850);
    expect(low.TOP.rawMm - high.TOP.rawMm).toBe(850);
    expect(high.OPTIMIZED.mode).toBe("TOP");
    expect(high.OPTIMIZED.rawMm).toBe(6550);
  });

  it("řetězené zásuvky: spodem 2 × (výška + hloubka) mezi krabicemi, společný rámeček bez svodu", () => {
    const chained = routeCircuit([node("z1", 4000, 300), node("z2", 5000, 300)], panel, "BOTTOM");
    expect(chained.segments[1]).toMatchObject({ horizontalMm: 1000, verticalMm: 700, wall: false });
    const framed = routeCircuit([node("z1", 4000, 300, { frame: "r1" }), node("z2", 4071, 300, { frame: "r1" })], panel, "BOTTOM");
    expect(framed.segments[1]).toMatchObject({ verticalMm: 0, wall: true });
    // jeden rámeček = jedna krabice
    expect(framed.totalMm).toBe(Math.round(framed.rawMm * 1.1 + 600 + 150));
  });

  it("zásuvky nad linkou 1150 mm: optimalizace je propojí přímo ve zdi bez scházení k podlaze", () => {
    const nodes = [node("z1", 4000, 1150), node("z2", 5000, 1150)];
    const routes = circuitRoutes(nodes, panel);
    expect(routes.BOTTOM.segments[1].verticalMm).toBe(2400);
    expect(routes.TOP.segments[1].verticalMm).toBe(2900);
    expect(routes.OPTIMIZED.segments[1]).toMatchObject({ verticalMm: 0, wall: true });
    expect(routes.OPTIMIZED.rawMm).toBe(6550 + 1000);
    expect(routes.OPTIMIZED.totalMm).toBeLessThan(Math.min(routes.BOTTOM.totalMm, routes.TOP.totalMm));
  });

  it("vyšší strop prodlouží vedení vrchem, výš umístěný rozváděč zkrátí vrch a prodlouží spodek", () => {
    const base = circuitRoutes([node("z1", 4000, 300)], panel);
    const tall = circuitRoutes([node("z1", 4000, 300)], panel, elevationProfile({ ceilingHeightMm: 3000 }));
    expect(tall.TOP.rawMm - base.TOP.rawMm).toBe(800);
    expect(tall.BOTTOM.rawMm).toBe(base.BOTTOM.rawMm);
    const highPanel = circuitRoutes([node("z1", 4000, 300)], panel, elevationProfile({ switchboardHeightMm: 1800 }));
    expect(highPanel.BOTTOM.rawMm - base.BOTTOM.rawMm).toBe(300);
    expect(base.TOP.rawMm - highPanel.TOP.rawMm).toBe(300);
  });

  it("řetěz vede vždy k nejbližšímu dalšímu prvku", () => {
    expect(chainOrder([node("far", 9000, 300), node("near", 1000, 300), node("mid", 5000, 300)], panel).map((n) => n.id)).toEqual(["near", "mid", "far"]);
  });
});

describe("výkaz kabeláže (CableSummary)", () => {
  const nodes = [node("z1", 4000, 300), node("z2", 5000, 300), node("l1", 3000, 2600, { room: "obyvak" }), node("s1", 500, 1050, { room: "obyvak" }), node("d1", 6000, 300)];
  const circuits = [circuit("zasuvky", ["z1", "z2"]), circuit("svetla", ["l1"], { cable: "CYKY-J 3x1,5", kind: "lighting", crossSectionMm2: 1.5, protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 10 } })];

  it("porovná 3 režimy, vyčíslí úsporu a rozepíše kabely k nákupu", () => {
    const summary = summarizeCabling({ circuits, nodes, panel, selected: "OPTIMIZED", switchLinks: [{ switchId: "s1", lightId: "l1" }], dataNodeIds: ["d1"] });
    expect(summary.totals.OPTIMIZED).toBeLessThanOrEqual(Math.min(summary.totals.BOTTOM, summary.totals.TOP));
    expect(summary.savingVsTopM).toBeGreaterThan(0);
    expect(summary.byCable.map((row) => row.cable).sort()).toEqual(["CYKY-J 3×1,5", "CYKY-J 3×2,5", "CYKY-O 3×1,5", "UTP Cat6"]);
    expect(summary.circuits.find((row) => row.id === "svetla")?.routing).toBe("TOP");
    expect(summary.circuits.find((row) => row.id === "zasuvky")?.routing).toBe("BOTTOM");
    expect(summary.circuits.every((row) => row.ok)).toBe(true);
  });

  it("úbytek napětí na nejdelší větvi – dlouhý světelný okruh překročí 3 %", () => {
    const far = summarizeCabling({ circuits: [circuits[1]], nodes: [node("l1", 60_000, 2600)], panel, selected: "TOP" });
    expect(far.circuits[0].ok).toBe(false);
    expect(far.warnings[0]).toMatch(/úbytek napětí/);
  });

  it("kalibrace s výškovým profilem počítá délku přívodu 3D modelem (generátor okruhů z ní bere ΔU)", () => {
    const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 100, 0], lengthMm: 1000 }], panelPx: [0, 0], elevation: {}, routing: "BOTTOM" });
    expect(calibration.calculateCableLength({ px: [400, 0], kind: "single_socket" })).toBe(5900);
    expect(calibration.calculateCableLength({ px: [400, 0], kind: "single_socket", mountHeightMm: 1150 })).toBe(6750);
  });
});
