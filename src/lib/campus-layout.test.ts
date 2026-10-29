import { describe, expect, it } from "vitest";

import { centerAt, clampRect, findFreeSpot, metersToRect, moveRect, polygonBounds, rectsOverlap, resizeRect } from "./campus-layout";

describe("umístění budovy v areálu", () => {
  it("budova nevyjede mimo areál při posunu ani změně velikosti", () => {
    expect(moveRect({ x: 90, y: 80, w: 15, h: 10 }, 20, 30)).toEqual({ x: 85, y: 90, w: 15, h: 10 });
    expect(moveRect({ x: 5, y: 5, w: 10, h: 10 }, -20, -1)).toEqual({ x: 0, y: 4, w: 10, h: 10 });
    expect(resizeRect({ x: 80, y: 70, w: 10, h: 10 }, 50, 50)).toEqual({ x: 80, y: 70, w: 20, h: 30 });
    expect(resizeRect({ x: 10, y: 10, w: 10, h: 10 }, -30, -30)).toEqual({ x: 10, y: 10, w: 4, h: 4 });
    expect(centerAt({ x: 0, y: 0, w: 20, h: 10 }, 5, 50)).toEqual({ x: 0, y: 45, w: 20, h: 10 });
    expect(clampRect({ x: -5, y: 120, w: 200, h: 3 })).toEqual({ x: 0, y: 96, w: 100, h: 4 });
  });

  it("překryv se stávajícími budovami a obálka polygonu", () => {
    const hall = polygonBounds("26,15.7 64,15.7 64,42.9 26,42.9");
    expect(hall).toEqual({ x: 26, y: 15.7, w: 38, h: 27.2 });
    expect(rectsOverlap({ x: 60, y: 40, w: 10, h: 10 }, hall)).toBe(true);
    expect(rectsOverlap({ x: 64, y: 40, w: 10, h: 10 }, hall)).toBe(false);
  });

  it("rozměr ze šablony v metrech a první volné místo", () => {
    expect(metersToRect(66, 42)).toEqual({ w: 16.5, h: 15 });
    const spot = findFreeSpot({ w: 20, h: 20 }, [{ x: 0, y: 0, w: 50, h: 100 }]);
    expect(spot.x).toBeGreaterThanOrEqual(52);
    expect(rectsOverlap(spot, { x: 0, y: 0, w: 50, h: 100 })).toBe(false);
  });
});
