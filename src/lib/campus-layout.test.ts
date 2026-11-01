import { describe, expect, it } from "vitest";

import { campusSizeValid, campusViewBox, centerAt, clampRect, findFreeSpot, metersToRect, moveRect, polygonBounds, rectInsideCampus, rectToMeters, rectsOverlap, rescalePolygon, rescaleRect, resizeRect } from "./campus-layout";

describe("umístění budovy v areálu", () => {
  it("budova nevyjede mimo areál při posunu ani změně velikosti", () => {
    expect(moveRect({ x: 90, y: 80, w: 15, h: 10 }, 20, 30)).toEqual({ x: 85, y: 90, w: 15, h: 10 });
    expect(moveRect({ x: 5, y: 5, w: 10, h: 10 }, -20, -1)).toEqual({ x: 0, y: 4, w: 10, h: 10 });
    expect(resizeRect({ x: 80, y: 70, w: 10, h: 10 }, 50, 50)).toEqual({ x: 80, y: 70, w: 20, h: 30 });
    expect(resizeRect({ x: 10, y: 10, w: 10, h: 10 }, -30, -30)).toEqual({ x: 10, y: 10, w: 1, h: 1 });
    expect(centerAt({ x: 0, y: 0, w: 20, h: 10 }, 5, 50)).toEqual({ x: 0, y: 45, w: 20, h: 10 });
    expect(clampRect({ x: -5, y: 120, w: 200, h: 3 })).toEqual({ x: 0, y: 97, w: 100, h: 3 });
  });

  it("překryv se stávajícími budovami a obálka polygonu", () => {
    const hall = polygonBounds("26,15.7 64,15.7 64,42.9 26,42.9");
    expect(hall).toEqual({ x: 26, y: 15.7, w: 38, h: 27.2 });
    expect(rectsOverlap({ x: 60, y: 40, w: 10, h: 10 }, hall)).toBe(true);
    expect(rectsOverlap({ x: 64, y: 40, w: 10, h: 10 }, hall)).toBe(false);
  });

  it("rozměr ze šablony v metrech a první volné místo", () => {
    expect(metersToRect(66, 42)).toEqual({ w: 16.5, h: 15 });
    // Nový závod 300 × 200 m: stejná hala zabere větší část mapy, obří hala nepřeteče
    expect(metersToRect(66, 42, { width: 300, height: 200 })).toEqual({ w: 22, h: 21 });
    expect(metersToRect(900, 42, { width: 300, height: 200 }).w).toBe(100);
    const spot = findFreeSpot({ w: 20, h: 20 }, [{ x: 0, y: 0, w: 50, h: 100 }]);
    expect(spot.x).toBeGreaterThanOrEqual(52);
    expect(rectsOverlap(spot, { x: 0, y: 0, w: 50, h: 100 })).toBe(false);
  });

  it("rozměr areálu X × Y: poměr stran mapy, metry budovy zůstanou při změně rozměru", () => {
    expect(campusViewBox({ width: 300, height: 200 })).toEqual({ width: 1000, height: 667 });
    expect(campusViewBox({ width: 400, height: 280 })).toEqual({ width: 1000, height: 700 });
    expect(campusSizeValid({ width: 50, height: 2000 })).toBe(true);
    expect(campusSizeValid({ width: 49, height: 200 })).toBe(false);
    const hall = { x: 10, y: 20, w: 22, h: 21 };
    expect(rectToMeters(hall, { width: 300, height: 200 })).toEqual({ x: 30, y: 40, w: 66, h: 42 });
    const bigger = rescaleRect(hall, { width: 300, height: 200 }, { width: 600, height: 400 });
    expect(bigger).toEqual({ x: 5, y: 10, w: 11, h: 10.5 });
    expect(rectToMeters(bigger, { width: 600, height: 400 })).toEqual({ x: 30, y: 40, w: 66, h: 42 });
    expect(rescalePolygon("80,80 95,80 95,95", { width: 400, height: 280 }, { width: 300, height: 200 })).toBe("106.7,112 126.7,112 126.7,133");
    expect(rectInsideCampus(polygonBounds("106.7,112 126.7,112 126.7,133"))).toBe(false);
    expect(rectInsideCampus({ x: 0, y: 0, w: 100, h: 100 })).toBe(true);
  });
});
