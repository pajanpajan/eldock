import { describe, expect, it } from "vitest";

import {
  bomDraftFrom,
  changedDesignations,
  emptyBomRow,
  parseQuantity,
  removedRows,
  rowChange,
  toBomInput,
  validateBomDraft,
} from "./bom-edit";

const source = [
  { designation: "K4", description: "Stykač 3P 25 A", manufacturer: "Schneider Electric", partNumber: "LC1D25BD", quantity: 1, unit: "ks", note: null },
  { designation: "X1", description: "Svorka 2,5 mm²", manufacturer: null, partNumber: "UT 2,5", quantity: 14.5, unit: "ks", note: null },
  { designation: "F6", description: "Jistič 1P C2 A", manufacturer: "ABB", partNumber: "S201-C2", quantity: 1, unit: "ks", note: null },
];

describe("bom-edit", () => {
  const originals = bomDraftFrom(source);
  const byKey = new Map(originals.map((row) => [row.key, row]));

  it("převede kusovník na řádky s desetinnou čárkou", () => {
    expect(originals[1]).toMatchObject({ manufacturer: "", quantity: "14,5", originalKey: "orig-1" });
  });

  it("rozliší nový, změněný a stejný řádek", () => {
    const changed = { ...originals[0], partNumber: "LC1D32BD" };
    const sameQuantity = { ...originals[1], quantity: "14.5" };
    expect(rowChange(changed, byKey)).toBe("changed");
    expect(rowChange(sameQuantity, byKey)).toBe("same");
    expect(rowChange(emptyBomRow("n1"), byKey)).toBe("new");
  });

  it("najde odebrané a změněné prvky", () => {
    const rows = [{ ...originals[0], partNumber: "LC1D32BD" }, originals[1], { ...emptyBomRow("n1"), designation: "K5", description: "Stykač" }];
    expect(removedRows(rows, originals).map((row) => row.designation)).toEqual(["F6"]);
    expect(changedDesignations(rows, originals)).toEqual(["K4", "K5", "F6"]);
  });

  it("validuje povinná pole a množství", () => {
    expect(validateBomDraft(originals)).toBeNull();
    expect(validateBomDraft([emptyBomRow("n")])).toBe("Řádek 1: doplňte označení.");
    expect(validateBomDraft([{ ...originals[0], quantity: "0" }])).toBe("Řádek 1 (K4): množství musí být kladné číslo.");
    expect(parseQuantity("1 000,5")).toBe(1000.5);
    expect(parseQuantity("abc")).toBeNull();
  });

  it("vytvoří data pro akci", () => {
    expect(toBomInput([originals[1]])[0]).toEqual({
      designation: "X1",
      description: "Svorka 2,5 mm²",
      manufacturer: null,
      partNumber: "UT 2,5",
      quantity: 14.5,
      unit: "ks",
      note: null,
    });
  });
});
