import { describe, expect, it } from "vitest";

import { isoProject, isoSlab } from "./isometric";

describe("isoProject", () => {
  it("počátek zůstává v počátku", () => {
    expect(isoProject(0, 0, 0)).toEqual([0, 0]);
  });

  it("osa x vede vpravo dolů, y vlevo dolů, z nahoru", () => {
    const [xx, xy] = isoProject(10, 0, 0);
    const [yx, yy] = isoProject(0, 10, 0);
    const [, zy] = isoProject(0, 0, 10);
    expect(xx).toBeGreaterThan(0);
    expect(xy).toBeGreaterThan(0);
    expect(yx).toBeLessThan(0);
    expect(yy).toBeCloseTo(xy);
    expect(zy).toBe(-10);
  });
});

describe("isoSlab", () => {
  it("horní plocha leží o tloušťku desky výš než spodní hrana stěn", () => {
    const slab = isoSlab(100, 50, 0, 10);
    expect(slab.top[2][1]).toBeCloseTo(slab.front[2][1] - 10);
  });
});
