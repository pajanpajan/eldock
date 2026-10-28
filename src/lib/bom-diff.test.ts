import { describe, expect, it } from "vitest";

import { diffBom, summarizeBomDiff, type BomDiffItem } from "./bom-diff";

const item = (designation: string, overrides: Partial<BomDiffItem> = {}): BomDiffItem => ({
  designation,
  description: `Díl ${designation}`,
  manufacturer: "Siemens",
  partNumber: `PN-${designation}`,
  quantity: 1,
  unit: "ks",
  note: null,
  ...overrides,
});

describe("diffBom", () => {
  const before = [item("Q1"), item("F6"), item("K4"), item("X1", { quantity: 14 })];
  const after = [item("Q1"), item("K4", { partNumber: "3RT2026", manufacturer: "Siemens " }), item("X1", { quantity: 16 }), item("X3")];

  it("rozliší přidané, odebrané, změněné a stejné položky", () => {
    const rows = diffBom(before, after);
    expect(rows.map((row) => `${row.designation}:${row.kind}`)).toEqual(["Q1:same", "F6:removed", "K4:changed", "X1:changed", "X3:added"]);
    expect(rows.find((row) => row.designation === "K4")?.fields).toEqual(["partNumber"]);
    expect(rows.find((row) => row.designation === "X1")?.fields).toEqual(["quantity"]);
    expect(summarizeBomDiff(rows)).toEqual({ added: 1, removed: 1, changed: 2 });
  });

  it("odebraná první položka zůstane nahoře a duplicitní označení se párují podle pořadí", () => {
    expect(diffBom([item("A"), item("B")], [item("B")]).map((row) => row.kind)).toEqual(["removed", "same"]);
    const rows = diffBom([item("X", { note: "1" }), item("X", { note: "2" })], [item("X", { note: "1" })]);
    expect(rows.map((row) => row.kind)).toEqual(["same", "removed"]);
  });

  it("stejné kusovníky nemají rozdíly", () => {
    expect(summarizeBomDiff(diffBom(before, before))).toEqual({ added: 0, removed: 0, changed: 0 });
  });
});
