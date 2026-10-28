import { describe, expect, it } from "vitest";

import { matchesFilter, searchEquipment } from "./equipment-filter";

const ITEMS = [
  { tag: "CNC-04", name: "CNC-04 - CNC obráběcí centrum 04", status: "ACTIVE", type: "CNC_MACHINE" },
  { tag: "R-CNC-04", name: "R-CNC-04 - Rozváděč CNC centra 04", status: "PENDING_UPDATE", type: "SWITCHBOARD" },
  { tag: "LIS-01", name: "LIS-01 - Hydraulický lis 400 t", status: "ACTIVE", type: "PRODUCTION_LINE" },
] as const;

describe("matchesFilter", () => {
  it("prázdné filtry propustí vše", () => {
    expect(ITEMS.every((item) => matchesFilter(item, { statuses: new Set(), types: new Set() }))).toBe(true);
  });

  it("kombinuje stav a typ", () => {
    const filter = { statuses: new Set(["PENDING_UPDATE"] as const), types: new Set(["SWITCHBOARD"] as const) };
    expect(ITEMS.filter((item) => matchesFilter(item, filter)).map((item) => item.tag)).toEqual(["R-CNC-04"]);
  });
});

describe("searchEquipment", () => {
  it("ignoruje velikost písmen a pomlčky, přesná shoda má přednost", () => {
    expect(searchEquipment([...ITEMS], "cnc04").map((item) => item.tag)).toEqual(["CNC-04", "R-CNC-04"]);
    expect(searchEquipment([...ITEMS], "rcnc").map((item) => item.tag)).toEqual(["R-CNC-04"]);
  });

  it("hledá i v názvu bez diakritiky", () => {
    expect(searchEquipment([...ITEMS], "hydraulicky").map((item) => item.tag)).toEqual(["LIS-01"]);
  });

  it("prázdný dotaz nevrací nic", () => {
    expect(searchEquipment([...ITEMS], "  ")).toEqual([]);
  });
});
