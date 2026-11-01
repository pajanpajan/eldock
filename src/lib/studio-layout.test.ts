import { describe, expect, it } from "vitest";

import { DEFAULT_GRID, planFrame, renderGridFloorplanSvg } from "./cad-grid";
import { renderFloorplanSvg } from "./mock-graphics/floorplan";
import { frameFromSvg, frameOfFloor, layoutFromSvg, layoutOfFloor, parseLayout, serializeLayout } from "./studio-layout";

describe("rozvržení patra ze Studia (studioLayoutJson)", () => {
  const grid = { ...DEFAULT_GRID, cols: 10, rows: 6, stepMeters: 6 };
  const zones = [{ key: "z1", x: 0, y: 0, w: 30, h: 18, name: "Linka 1", kind: "PRODUCTION" as const }];

  it("uložení a načtení JSON, poškozený JSON = null", () => {
    const json = serializeLayout({ grid, zones, gates: [{ at: "C10", label: "Vrata 1" }] });
    expect(parseLayout(json)).toEqual({ version: 1, grid, zones, gates: [{ at: "C10", label: "Vrata 1" }] });
    expect(parseLayout("{nesmysl")).toBeNull();
    expect(parseLayout(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseLayout(JSON.stringify({ version: 1, grid, zones: [{ x: 1 }], gates: [] }))?.zones).toEqual([]);
  });

  it("patro Studia bez JSON: rám i zóny se přečtou zpět z vygenerovaného SVG", () => {
    const svg = renderGridFloorplanSvg({ floorName: "1. NP", spec: grid, zones, gates: [{ at: "C10", label: "Vrata 1" }] });
    const frame = frameFromSvg(svg);
    const expected = planFrame(grid);
    expect(frame).toMatchObject({ cols: 10, rows: 6, stepMeters: 6, widthM: 54, depthM: 30 });
    expect(frame.x).toBeCloseTo(expected.x, 3);
    expect(frame.w).toBeCloseTo(expected.w, 3);
    const layout = layoutFromSvg(svg);
    expect(layout.zones).toEqual([{ key: "z1", x: 0, y: 0, w: 30, h: 18, name: "Linka 1", kind: "PRODUCTION" }]);
    expect(layout.gates).toEqual([{ at: "C10", label: "Vrata 1" }]);
  });

  it("půdorys ze seedu (výchozí obvod 70/70/1050/690, 12 × 8 os): místnosti, typy podle barvy a vrata starého stylu", () => {
    const svg = renderFloorplanSvg({
      floor: { name: "1. NP", viewBoxW: 1200, viewBoxH: 800 },
      rooms: [
        { label: "Lisovací linka 1", x: 86, y: 86, w: 460, h: 300, kind: "zone" },
        { label: "Rozvodna", x: 600, y: 86, w: 200, h: 200, kind: "electrical" },
      ],
      gates: [{ x: 1120, y: 600, length: 60, orient: "v", label: "Vrata – expedice" }],
    });
    const layout = layoutFromSvg(svg);
    expect(frameFromSvg(svg)).toMatchObject({ x: 70, y: 70, w: 1050, h: 690, cols: 12, rows: 8, widthM: 66, depthM: 42 });
    expect(layout.grid).toMatchObject({ cols: 12, rows: 8, stepMeters: 6 });
    expect(layout.zones.map((zone) => [zone.name, zone.kind])).toEqual([
      ["Lisovací linka 1", "PRODUCTION"],
      ["Rozvodna", "ELECTRICAL"],
    ]);
    expect(layout.zones[0]).toMatchObject({ x: 1, y: 1, w: 29 });
    expect(layout.gates).toEqual([{ at: "G12", label: "Vrata – expedice" }]);
    // Starší uložené půdorysy mají vrata jako tmavou čáru šířky 8 + popisek
    const legacy = `<rect x="70" y="70" width="1050" height="690" fill="none" stroke="#94a3b8" stroke-width="6"/><line x1="1120" y1="620" x2="1120" y2="700" stroke="#0b1220" stroke-width="8"/><line x1="1120" y1="620" x2="1120" y2="700" stroke="#e2e8f0" stroke-width="2"/><text x="1108" y="600">Vrata 2</text>`;
    expect(layoutFromSvg(legacy).gates).toEqual([{ at: "G12", label: "Vrata 2" }]);
  });

  it("rám a rozvržení stávajícího patra: přednost má JSON", () => {
    const json = serializeLayout({ grid, zones, gates: [] });
    expect(layoutOfFloor({ studioLayoutJson: json, floorplanSvg: "" }).zones).toEqual(zones);
    expect(frameOfFloor({ studioLayoutJson: json })).toEqual(planFrame(grid));
    expect(frameOfFloor({ studioLayoutJson: null, floorplanSvg: "" })).toMatchObject({ x: 70, y: 70, widthM: 66 });
  });
});
