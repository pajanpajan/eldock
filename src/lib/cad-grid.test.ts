import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRID,
  FLOOR_TEMPLATES,
  cellAt,
  clampGrid,
  floorTemplate,
  isWallPoint,
  nearestWallPoint,
  parseCellRef,
  zoneAt,
  zoneContains,
  colLabels,
  formatGridRef,
  gateToFloorplan,
  gridDimensions,
  gridToPercent,
  gridToPx,
  nearestGridPoint,
  parseGridRef,
  renderGridFloorplanSvg,
  rowLabels,
  scaleBar,
  zoneToRoom,
} from "./cad-grid";
import { allowedParents, powerRole, suggestCircuit, validatePlacement } from "./power-hierarchy";

describe("konstrukční rastr", () => {
  it("osy 1…N a A…Z, rozměr haly mezi krajními osami", () => {
    expect(colLabels(12)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    expect(rowLabels(8).join("")).toBe("ABCDEFGH");
    expect(gridDimensions(DEFAULT_GRID)).toMatchObject({ widthM: 66, depthM: 42, label: "66 m × 42 m" });
    expect(gridDimensions({ ...DEFAULT_GRID, cols: 5, rows: 4, stepMeters: 7.5 }).label).toBe("30 m × 22,5 m");
  });

  it("omezí rozsah os 4–20 / 4–16", () => {
    expect(clampGrid({ ...DEFAULT_GRID, cols: 30, rows: 2 })).toMatchObject({ cols: 20, rows: 4 });
  });

  it("souřadnice rastru ↔ viewBox půdorysu (shodné s půdorysem 12×8 ze seedu)", () => {
    expect(parseGridRef("c11", DEFAULT_GRID)).toEqual({ row: 2, col: 10 });
    expect(parseGridRef("I1", DEFAULT_GRID)).toBeNull();
    expect(parseGridRef("A13", DEFAULT_GRID)).toBeNull();
    expect(formatGridRef({ row: 6, col: 11 })).toBe("G12");
    expect(gridToPx({ row: 0, col: 0 }, DEFAULT_GRID)).toEqual({ x: 70, y: 70 });
    expect(gridToPx({ row: 7, col: 11 }, DEFAULT_GRID)).toEqual({ x: 1120, y: 760 });
    expect(gridToPercent({ row: 0, col: 0 }, DEFAULT_GRID)).toEqual({ pinX: 5.8, pinY: 8.8 });
    expect(nearestGridPoint({ x: 50, y: 50 }, DEFAULT_GRID)).toEqual({ col: 6, row: 3 });
  });

  it("zóna z buněk A1–C11 (buňka = pole mezi sousedními osami) a vrata na obvodu", () => {
    expect(zoneToRoom({ from: "A1", to: "C11", name: "Montážní linka 1", kind: "PRODUCTION" }, DEFAULT_GRID)).toEqual({
      label: "Montážní linka 1",
      x: 78,
      y: 78,
      w: 1034,
      h: 280,
      kind: "zone",
    });
    expect(zoneToRoom({ from: "A1", to: "A12", name: "Mimo", kind: "STORAGE" }, DEFAULT_GRID)).toBeNull();
    expect(gateToFloorplan({ at: "G12", label: "Vrata – expedice" }, DEFAULT_GRID)).toMatchObject({ orient: "v", x: 1120, label: "Vrata – expedice" });
    expect(gateToFloorplan({ at: "H4", label: "" }, DEFAULT_GRID)).toMatchObject({ orient: "h", label: "Vrata" });
    expect(gateToFloorplan({ at: "D5", label: "Uvnitř" }, DEFAULT_GRID)).toBeNull();
  });

  it("B2–B5 na stejné ose je platný pás výšky 1 modulu, i jediná buňka je místnost (oprava chyby)", () => {
    const band = zoneToRoom({ from: "B2", to: "B5", name: "Pás", kind: "STORAGE" }, DEFAULT_GRID)!;
    expect(band).not.toBeNull();
    const b2 = gridToPx({ row: 1, col: 1 }, DEFAULT_GRID);
    const c6 = gridToPx({ row: 2, col: 5 }, DEFAULT_GRID);
    expect(band).toMatchObject({ x: Math.round(b2.x + 8), y: Math.round(b2.y + 8), w: Math.round(c6.x - b2.x - 16), h: Math.round(c6.y - b2.y - 16) });
    // Pořadí bodů nehraje roli, jedna buňka = 1 modul × 1 modul
    expect(zoneToRoom({ from: "B5", to: "B2", name: "Pás", kind: "STORAGE" }, DEFAULT_GRID)).toEqual(band);
    expect(zoneToRoom({ from: "D4", to: "D4", name: "Buňka", kind: "HAZARD" }, DEFAULT_GRID)).toMatchObject({ w: 79, h: 83, kind: "electrical" });
  });

  it("buňka pod kurzorem, místnost pod průsečíkem a vrata u nejbližší zdi", () => {
    expect(cellAt({ x: 50, y: 50 }, DEFAULT_GRID)).toEqual({ col: 5, row: 3 });
    expect(cellAt({ x: 99, y: 99 }, DEFAULT_GRID)).toEqual({ col: 10, row: 6 });
    expect(parseCellRef("H1", DEFAULT_GRID)).toBeNull();
    const zones = [
      { from: "A1", to: "G11", name: "Hala", kind: "PRODUCTION" as const },
      { from: "B2", to: "C3", name: "Svařovna", kind: "HAZARD" as const },
    ];
    expect(zoneAt(zones, { row: 2, col: 2 }, DEFAULT_GRID)?.name).toBe("Svařovna");
    expect(zoneAt(zones, { row: 5, col: 8 }, DEFAULT_GRID)?.name).toBe("Hala");
    expect(zoneContains(zones[1], { row: 6, col: 8 }, DEFAULT_GRID)).toBe(false);
    expect(nearestWallPoint({ x: 93, y: 60 }, DEFAULT_GRID)).toMatchObject({ col: 11 });
    expect(nearestWallPoint({ x: 40, y: 92 }, DEFAULT_GRID)).toMatchObject({ row: 7 });
    expect(isWallPoint({ row: 3, col: 0 }, DEFAULT_GRID)).toBe(true);
    expect(isWallPoint({ row: 3, col: 4 }, DEFAULT_GRID)).toBe(false);
  });

  it("šablony rozdělení patra vytvoří platné, nepřekrývající se zóny i v nejmenším rastru", () => {
    for (const spec of [DEFAULT_GRID, { ...DEFAULT_GRID, cols: 4, rows: 4 }]) {
      for (const template of FLOOR_TEMPLATES) {
        const zones = floorTemplate(template.key, spec);
        expect(zones.length).toBeGreaterThan(1);
        for (const zone of zones) expect(zoneToRoom(zone, spec)).not.toBeNull();
      }
    }
    expect(floorTemplate("two-lines", DEFAULT_GRID).map((zone) => `${zone.from}–${zone.to} ${zone.name}`)).toEqual([
      "A1–B11 Výrobní linka 1",
      "C1–D11 Výrobní linka 2",
      "E1–G5 Zázemí a šatny",
      "E6–G11 Sklad komponent",
    ]);
  });

  it("měřítková ryska podle rozteče a vygenerovaný půdorys", () => {
    expect(scaleBar(DEFAULT_GRID)).toEqual({ pxPer10m: 159.1, label: "M 1:200" });
    const svg = renderGridFloorplanSvg({
      floorName: "1. NP - Montáž",
      spec: { ...DEFAULT_GRID, cols: 6, rows: 5, scale: "1:500" },
      zones: [{ from: "A1", to: "C3", name: "Linka <1>", kind: "PRODUCTION" }, { from: "D2", to: "D2", name: "Buňka", kind: "HAZARD" }],
      gates: [{ at: "C6", label: "Vrata" }],
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Linka &lt;1&gt;");
    expect(svg).toContain("M 1:500");
    expect(svg).toContain("30 m × 24 m");
    expect((svg.match(/<circle /g) ?? []).length).toBe(6 + 5);
  });
});

describe("hierarchie napájení", () => {
  const sources = [
    { id: "tr1", tag: "TR1", type: "TRANSFORMER" as const, floorId: "e" },
    { id: "rm1", tag: "RM1", type: "SWITCHBOARD" as const, floorId: "e" },
    { id: "rml", tag: "R-ML-01", type: "SWITCHBOARD" as const, floorId: "b" },
  ];

  it("role a povolení nadřazení: rozváděč z rozváděče / trafa, stroj jen z rozváděče, stejné patro první", () => {
    expect(powerRole("TRANSFORMER")).toBe("SOURCE");
    expect(powerRole("SWITCHBOARD", true)).toBe("SOURCE");
    expect(powerRole("SWITCHBOARD")).toBe("SUBBOARD");
    expect(powerRole("PRODUCTION_LINE")).toBe("LOAD");
    expect(powerRole("APPLIANCE")).toBe("OUTLET");
    expect(allowedParents("SWITCHBOARD", sources, "b").map((s) => s.tag)).toEqual(["R-ML-01", "RM1", "TR1"]);
    expect(allowedParents("MACHINE", sources, "b").map((s) => s.tag)).toEqual(["R-ML-01", "RM1"]);
    expect(allowedParents("TRANSFORMER", sources, "b")).toEqual([]);
  });

  it("návrh vývodu", () => {
    expect(suggestCircuit("SWITCHBOARD", { type: "SWITCHBOARD" }, 4)).toBe("Pole 3 / QF5");
    expect(suggestCircuit("PRODUCTION_LINE", { type: "SWITCHBOARD" }, 0)).toBe("Vývod FA1");
    expect(suggestCircuit("APPLIANCE", { type: "SWITCHBOARD" }, 1)).toBe("Zásuvkový okruh ZS2");
    expect(suggestCircuit("SWITCHBOARD", { type: "TRANSFORMER" }, 0)).toBe("Vývod nn / Q0");
  });

  it("validace osazení", () => {
    expect(validatePlacement({ type: "SWITCHBOARD", tag: "RM2", parentId: null, circuit: null, zone: null, isRoot: true }, sources)).toEqual([]);
    expect(validatePlacement({ type: "SWITCHBOARD", tag: "R-X", parentId: null, circuit: null, zone: null }, sources)).toEqual(["Podružný rozváděč musí mít nadřazený rozváděč."]);
    expect(validatePlacement({ type: "MACHINE", tag: "ML-03", parentId: "tr1", circuit: "Q1", zone: null }, sources)).toEqual(["TR1 nemůže napájet tento typ zařízení."]);
    expect(validatePlacement({ type: "APPLIANCE", tag: "SP-1", parentId: "rml", circuit: "ZS1", zone: "" }, sources)).toEqual(["Drobné vybavení musí mít místnost / zónu."]);
    expect(validatePlacement({ type: "PRODUCTION_LINE", tag: "ML-03", parentId: "rml", circuit: " ", zone: null }, sources)).toEqual(["Doplňte pole / jistič / okruh napájení."]);
    expect(validatePlacement({ type: "MACHINE", tag: "", parentId: "rml", circuit: "FA1", zone: null }, sources)).toEqual(["Zadejte označení (tag), např. R-ML-02."]);
  });
});
