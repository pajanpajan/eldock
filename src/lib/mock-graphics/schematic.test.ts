import { describe, expect, it } from "vitest";

import { markupCenter } from "@/lib/markup";

import { buildParts, overridesFromBom } from "./parts";
import { SCHEMATIC_DESIGNATIONS, nearestSchematicElement, renderSchematicSvg, schematicElementCenter } from "./schematic";

describe("nearestSchematicElement", () => {
  it("najde prvek pod středem zákresu", () => {
    for (const designation of ["Q1", "T1", "K4", "F6", "X2"]) {
      const [x, y] = schematicElementCenter(designation);
      expect(nearestSchematicElement(x, y)).toBe(designation);
    }
  });

  it("zákres kroužkem kolem K4 ukazuje na K4", () => {
    const [cx, cy] = schematicElementCenter("K4");
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      return [cx + Math.cos(t) * 0.05, cy + Math.sin(t) * 0.07, 0.5] as [number, number, number];
    });
    const center = markupCenter({ version: 1, sheet: 1, strokes: [{ tool: "pen", color: "#ef4444", width: 0.004, points }] });
    expect(nearestSchematicElement(...center!)).toBe("K4");
    expect(markupCenter(null)).toBeNull();
  });
});

describe("overridesFromBom", () => {
  it("výchozí kusovník nemá žádné změny, upravený vrátí jen rozdíly", () => {
    const parts = buildParts("63 A");
    expect(overridesFromBom("63 A", parts)).toEqual({});
    const edited = parts.map((part) => (part.designation === "K4" ? { ...part, partNumber: "3RT2026-1BB40", manufacturer: "Siemens" } : part));
    expect(overridesFromBom("63 A", edited)).toEqual({ K4: { partNumber: "3RT2026-1BB40", manufacturer: "Siemens" } });
  });

  it("schéma s upraveným kusovníkem obsahuje nové objednací číslo a revizní obláček", () => {
    const svg = renderSchematicSvg({
      equipment: { tag: "R-TEST", name: "Test", ratedCurrent: "63 A" },
      revision: { version: "v1.3", date: "28.10.2026", author: "Ing. Tomáš Král" },
      variant: { overrides: { K4: { partNumber: "3RT2026-1BB40" } }, changed: ["K4"], changeNote: "Výměna K4" },
    });
    expect(svg).toContain("3RT2026-1BB40");
    expect(svg).toContain("Výměna K4");
    expect(SCHEMATIC_DESIGNATIONS).toContain("K4");
  });
});
