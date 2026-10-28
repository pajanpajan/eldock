import { describe, expect, it } from "vitest";

import { formatCount, initials, plural } from "./format";
import { worstEquipmentStatus } from "./status";

const CHANGE = ["změna", "změny", "změn"] as const;

describe("plural", () => {
  it("skloňuje podle českých pravidel", () => {
    expect(plural(0, CHANGE)).toBe("změn");
    expect(plural(1, CHANGE)).toBe("změna");
    expect(plural(2, CHANGE)).toBe("změny");
    expect(plural(4, CHANGE)).toBe("změny");
    expect(plural(5, CHANGE)).toBe("změn");
    expect(plural(21, CHANGE)).toBe("změn");
  });

  it("formatCount přidá číslo", () => {
    expect(formatCount(3, CHANGE)).toBe("3 změny");
  });
});

describe("initials", () => {
  it("vynechává tituly", () => {
    expect(initials("Ing. Tomáš Král")).toBe("TK");
    expect(initials("Petr Novák")).toBe("PN");
  });
});

describe("worstEquipmentStatus", () => {
  it("vybere nejhorší stav", () => {
    expect(worstEquipmentStatus([])).toBe("ACTIVE");
    expect(worstEquipmentStatus(["ACTIVE", "WAITING_APPROVAL"])).toBe("WAITING_APPROVAL");
    expect(worstEquipmentStatus(["WAITING_APPROVAL", "PENDING_UPDATE", "ACTIVE"])).toBe("PENDING_UPDATE");
  });
});
