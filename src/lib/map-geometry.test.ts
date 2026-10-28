import { describe, expect, it } from "vitest";

import { bounds, parsePercentPolygon, toSvgPoints } from "./map-geometry";
import { buildingEntryHref } from "./routes";

describe("parsePercentPolygon", () => {
  it("převede procenta na souřadnice viewBoxu", () => {
    const points = parsePercentPolygon("26,15.7 64,15.7 64,42.9", 1000, 700);
    expect(points[0][0]).toBeCloseTo(260);
    expect(points[0][1]).toBeCloseTo(109.9);
    expect(points[2][1]).toBeCloseTo(300.3);
    expect(toSvgPoints(points)).toBe("260,109.9 640,109.9 640,300.3");
  });

  it("vrátí ohraničení", () => {
    expect(bounds([[10, 20], [50, 5], [30, 40]])).toEqual({ x: 10, y: 5, width: 40, height: 35 });
  });
});

describe("buildingEntryHref", () => {
  it("jednopodlažní budova vede rovnou na půdorys", () => {
    expect(buildingEntryHref("p", "b", ["f"])).toBe("/plant/p/building/b/floor/f");
  });

  it("vícepodlažní budova vede na výběr patra", () => {
    expect(buildingEntryHref("p", "b", ["f1", "f2"])).toBe("/plant/p/building/b");
  });
});
