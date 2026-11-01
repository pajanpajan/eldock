import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRID,
  EXISTING_FLOOR_FRAME,
  FLOOR_TEMPLATES,
  bayAt,
  canvasWidthPx,
  cellsToRect,
  clampGrid,
  colLabels,
  fineStep,
  floorTemplate,
  formatGridRef,
  formatPosition,
  gateToFloorplan,
  gridDimensions,
  gridToPx,
  isWallPoint,
  metersToPercent,
  metersToPx,
  moveZone,
  nearestGridPoint,
  nearestWallPoint,
  parseCellRef,
  parseGridRef,
  planFrame,
  pxPerMeter,
  pxToMeters,
  rectFromPoints,
  renderGridFloorplanSvg,
  resizeZone,
  rowLabels,
  scaleBarLength,
  screenPxPerMeter,
  zoneAt,
  zoneContains,
  zoneDimensions,
  zoneFits,
  zoneToRoom,
  type GridZone,
} from "./cad-grid";
import { extractFloorplanRoomsWithLabels } from "./mock-graphics/floorplan";
import { allowedParents, powerRole, suggestCircuit, validatePlacement } from "./power-hierarchy";

const zone = (patch: Partial<GridZone> = {}): GridZone => ({ key: "z", x: 6, y: 6, w: 24, h: 6, name: "Svařovna", kind: "PRODUCTION", ...patch });

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

  it("rám půdorysu má jednotné měřítko v ose X i Y a je vystředěný", () => {
    const frame = planFrame(DEFAULT_GRID);
    expect(frame).toMatchObject({ x: 70, w: 1050, widthM: 66, depthM: 42 });
    expect(frame.y).toBeCloseTo(80.9, 1);
    expect(pxPerMeter(frame).x).toBeCloseTo(pxPerMeter(frame).y, 6);
    // Malá energetika 24 × 18 m: omezuje výška → vystředěno vodorovně
    expect(planFrame({ cols: 5, rows: 4, stepMeters: 6 })).toMatchObject({ x: 135, y: 70, w: 920, h: 690 });
  });

  it("metry ↔ viewBox ↔ procenta pinu, přichycení na jemný rastr", () => {
    const frame = planFrame(DEFAULT_GRID);
    expect(metersToPx(frame, { x: 0, y: 0 }).x).toBe(70);
    expect(metersToPx(frame, { x: 66, y: 42 }).x).toBeCloseTo(1120, 6);
    expect(pxToMeters(frame, metersToPx(frame, { x: 12.4, y: 7.6 }), 1)).toEqual({ x: 12, y: 8 });
    expect(pxToMeters(frame, { x: -50, y: 2000 })).toEqual({ x: 0, y: 42 });
    // Stávající patra (seed) mají obvod 70/70/1050/690 – shodně s dřívějším převodem
    expect(metersToPercent(EXISTING_FLOOR_FRAME, { x: 0, y: 0 })).toEqual({ pinX: 5.8, pinY: 8.8 });
    expect(fineStep(frame)).toBe(1);
    expect(fineStep(planFrame({ cols: 20, rows: 16, stepMeters: 30 }))).toBe(5);
    expect(bayAt(frame, { x: 48, y: 6 })).toBe("B9");
    expect(formatPosition(frame, { x: 48, y: 6 })).toBe("X 48 m · Y 6 m (pole B9)");
  });

  it("osy, průsečíky a vrata u nejbližší zdi", () => {
    const frame = planFrame(DEFAULT_GRID);
    expect(parseGridRef("c11", DEFAULT_GRID)).toEqual({ row: 2, col: 10 });
    expect(parseGridRef("I1", DEFAULT_GRID)).toBeNull();
    expect(formatGridRef({ row: 6, col: 11 })).toBe("G12");
    expect(gridToPx({ row: 0, col: 11 }, frame).x).toBeCloseTo(1120, 6);
    expect(nearestGridPoint({ x: 600, y: 400 }, frame)).toEqual({ col: 6, row: 3 });
    expect(nearestWallPoint({ x: 1110, y: 480 }, frame)).toMatchObject({ col: 11 });
    expect(nearestWallPoint({ x: 480, y: 740 }, frame)).toMatchObject({ row: 7 });
    expect(isWallPoint({ row: 3, col: 0 }, DEFAULT_GRID)).toBe(true);
    expect(isWallPoint({ row: 3, col: 4 }, DEFAULT_GRID)).toBe(false);
    expect(gateToFloorplan({ at: "G12", label: "Vrata – expedice" }, frame)).toMatchObject({ orient: "v", x: 1120, label: "Vrata – expedice" });
    expect(gateToFloorplan({ at: "H4", label: "" }, frame)).toMatchObject({ orient: "h", label: "Vrata" });
    expect(gateToFloorplan({ at: "D5", label: "Uvnitř" }, frame)).toBeNull();
  });
});

describe("zóny a místnosti v metrech", () => {
  const frame = planFrame(DEFAULT_GRID);

  it("ruční zadání polí B2–B5 = pás 24 × 6 m, i jediné pole je místnost", () => {
    expect(cellsToRect("B2", "B5", DEFAULT_GRID)).toEqual({ x: 6, y: 6, w: 24, h: 6 });
    expect(cellsToRect("B5", "B2", DEFAULT_GRID)).toEqual({ x: 6, y: 6, w: 24, h: 6 });
    expect(cellsToRect("D4", "D4", DEFAULT_GRID)).toEqual({ x: 18, y: 18, w: 6, h: 6 });
    expect(cellsToRect("A1", "A12", DEFAULT_GRID)).toBeNull();
    expect(parseCellRef("H1", DEFAULT_GRID)).toBeNull();
    expect(rectFromPoints({ x: 30, y: 12 }, { x: 6, y: 6 })).toEqual({ x: 6, y: 6, w: 24, h: 6 });
  });

  it("zóna → obdélník půdorysu se stylem kategorie a rozměrem; přesah obvodu neplatí", () => {
    const room = zoneToRoom(zone(), frame)!;
    expect(room).toMatchObject({ label: "Svařovna", kind: "zone", subLabel: "24 m × 6 m (144 m²)", style: { stroke: "#f59e0b", dash: "10 6" } });
    expect(room.w).toBeCloseTo(24 * pxPerMeter(frame).x - 6, 0);
    expect(zoneToRoom(zone({ kind: "CORRIDOR" }), frame)!.style).toMatchObject({ stroke: "#94a3b8", hatch: true });
    expect(zoneToRoom(zone({ kind: "ELECTRICAL" }), frame)).toMatchObject({ kind: "electrical", style: { stroke: "#a855f7" } });
    expect(zoneToRoom(zone({ x: 60, w: 10 }), frame)).toBeNull();
    expect(zoneFits(zone({ w: 0.5 }), frame)).toBe(false);
    expect(zoneDimensions({ w: 22.5, h: 12 })).toBe("22,5 m × 12 m (270 m²)");
  });

  it("posun stěn a rohů: protilehlá stěna drží, min. 1 × 1 m, nevyjede z obvodu", () => {
    expect(resizeZone(zone(), "e", { x: 36, y: 0 }, frame)).toMatchObject({ x: 6, w: 30 });
    expect(resizeZone(zone(), "w", { x: 2, y: 0 }, frame)).toMatchObject({ x: 2, w: 28 });
    expect(resizeZone(zone(), "w", { x: 50, y: 0 }, frame)).toMatchObject({ x: 29, w: 1 });
    expect(resizeZone(zone(), "n", { x: 0, y: 0 }, frame)).toMatchObject({ y: 0, h: 12 });
    expect(resizeZone(zone(), "s", { x: 0, y: 99 }, frame)).toMatchObject({ y: 6, h: 36 });
    expect(resizeZone(zone(), "se", { x: 40, y: 20 }, frame)).toMatchObject({ x: 6, y: 6, w: 34, h: 14 });
    expect(resizeZone(zone(), "nw", { x: 0, y: 0 }, frame)).toMatchObject({ x: 0, y: 0, w: 30, h: 12 });
    expect(moveZone(zone(), 100, -100, frame)).toMatchObject({ x: 42, y: 0, w: 24, h: 6 });
  });

  it("místnost pod bodem: nejmenší obsahující zóna", () => {
    const zones = [zone({ key: "hala", x: 0, y: 0, w: 66, h: 36, name: "Hala" }), zone({ key: "sv", x: 6, y: 6, w: 12, h: 12, name: "Svařovna" })];
    expect(zoneAt(zones, { x: 12, y: 12 })?.name).toBe("Svařovna");
    expect(zoneAt(zones, { x: 50, y: 30 })?.name).toBe("Hala");
    expect(zoneAt(zones, { x: 50, y: 40 })).toBeNull();
    expect(zoneContains(zones[1], { x: 18, y: 18 })).toBe(true);
  });

  it("šablony rozdělení patra vytvoří platné zóny i v nejmenším rastru", () => {
    for (const spec of [DEFAULT_GRID, { ...DEFAULT_GRID, cols: 4, rows: 4 }]) {
      for (const template of FLOOR_TEMPLATES) {
        const zones = floorTemplate(template.key, spec);
        expect(zones.length).toBeGreaterThan(1);
        expect(new Set(zones.map((entry) => entry.key)).size).toBe(zones.length);
        for (const entry of zones) expect(zoneToRoom(entry, planFrame(spec))).not.toBeNull();
      }
    }
    expect(floorTemplate("two-lines", DEFAULT_GRID).map((entry) => `${entry.x},${entry.y} ${entry.w}×${entry.h} ${entry.kind} ${entry.name}`)).toEqual([
      "0,0 66×12 PRODUCTION Výrobní linka 1",
      "0,12 66×12 PRODUCTION Výrobní linka 2",
      "0,24 30×18 FACILITIES Zázemí a šatny",
      "30,24 36×18 STORAGE Sklad komponent",
    ]);
    expect(floorTemplate("offices", DEFAULT_GRID).map((entry) => entry.kind)).toEqual(["OFFICE", "OFFICE", "CORRIDOR", "OFFICE", "FACILITIES"]);
  });
});

describe("měřítko na obrazovce", () => {
  it("1:100 = 3,78 cm na metr, plátno podle měřítka a limit šířky", () => {
    expect(screenPxPerMeter("1:100")).toBeCloseTo(37.8, 1);
    expect(screenPxPerMeter("1:1000")).toBeCloseTo(3.78, 2);
    expect(canvasWidthPx(300, "1:1000")).toBe(1134);
    expect(canvasWidthPx(66, "1:200")).toBe(1247);
    expect(canvasWidthPx(66, "1:100")).toBe(2494);
    expect(canvasWidthPx(2000, "1:100")).toBeNull();
  });

  it("grafické měřítko vybere hezkou délku", () => {
    expect(scaleBarLength(18.9)).toEqual({ meters: 5, px: 95 });
    expect(scaleBarLength(3.78)).toEqual({ meters: 25, px: 95 });
    expect(scaleBarLength(37.8)).toEqual({ meters: 5, px: 189 });
  });
});

describe("vygenerovaný půdorys", () => {
  it("zóny s rozměrem, kontrastní vrata, měřítko, jemný rastr a zpětné čtení názvů místností", () => {
    const spec = { ...DEFAULT_GRID, cols: 6, rows: 5, scale: "1:500" as const };
    const zones = [zone({ key: "a", x: 0, y: 0, w: 18, h: 12, name: "Linka <1>" }), zone({ key: "b", x: 18, y: 6, w: 6, h: 6, name: "Rozvodna", kind: "ELECTRICAL" })];
    const svg = renderGridFloorplanSvg({ floorName: "1. NP - Montáž", spec, zones, gates: [{ at: "C6", label: "Vrata 1" }] });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Linka &lt;1&gt;");
    expect(svg).toContain("18 m × 12 m (216 m²)");
    expect(svg).toContain("M 1:500");
    expect(svg).toContain("osa X 30 m × osa Y 24 m");
    expect(svg).toContain("🚪 Vrata 1");
    expect(svg).toContain("#06b6d4");
    expect(svg).not.toContain("fp-fine");
    expect((svg.match(/<circle /g) ?? []).length).toBe(6 + 5);
    expect(extractFloorplanRoomsWithLabels(svg).map((room) => room.label)).toEqual(["Linka <1>", "Rozvodna"]);
    expect(renderGridFloorplanSvg({ floorName: "x", spec, zones, gates: [], fineGrid: true })).toContain('fill="url(#fp-fine)"');
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
