import { describe, expect, it } from "vitest";

import { ALL_MODULES_ENABLED, moduleForPath, moduleStateFrom, resolveHome } from "./modules";

describe("licenční moduly", () => {
  it("chybějící záznam znamená zapnutý modul, neznámé klíče se ignorují", () => {
    expect(moduleStateFrom([])).toEqual(ALL_MODULES_ENABLED);
    expect(moduleStateFrom([{ key: "CAE_ADVANCED", enabled: false }, { key: "NEZNAMY", enabled: false }])).toEqual({ ...ALL_MODULES_ENABLED, CAE_ADVANCED: false });
  });

  it("přiřadí stránky a API k modulům", () => {
    expect(moduleForPath("/inspections/planner")).toBe("INSPECTIONS_PRO");
    expect(moduleForPath("/inspections/report/abc")).toBe("INSPECTIONS_PRO");
    expect(moduleForPath("/api/cron/inspection-alerts")).toBe("INSPECTIONS_PRO");
    expect(moduleForPath("/studio")).toBe("ENTERPRISE_TOOLS");
    expect(moduleForPath("/inspections/import")).toBe("ENTERPRISE_TOOLS");
    expect(moduleForPath("/inspections")).toBeNull();
    expect(moduleForPath("/inspections/plannerx")).toBeNull();
    expect(moduleForPath("/equipment/eq-rh1")).toBeNull();
  });

  it("domovská stránka účtu bez modulu spadne na přehled revizí", () => {
    expect(resolveHome("/inspections/rapid", { ...ALL_MODULES_ENABLED, INSPECTIONS_PRO: false })).toBe("/inspections");
    expect(resolveHome("/inspections/rapid", ALL_MODULES_ENABLED)).toBe("/inspections/rapid");
    expect(resolveHome("/cae", { ...ALL_MODULES_ENABLED, INSPECTIONS_PRO: false })).toBe("/cae");
  });
});
