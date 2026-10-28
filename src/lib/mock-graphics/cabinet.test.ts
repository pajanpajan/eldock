import { describe, expect, it } from "vitest";

import { toCsv } from "../csv";
import { parseMarkup } from "../markup";
import { RAIL_CAPACITY, layoutCabinet } from "./cabinet";
import { buildParts } from "./parts";

describe("layoutCabinet", () => {
  const rails = layoutCabinet(buildParts("63 A", {}));

  it("umístí všechny položky kusovníku", () => {
    expect(rails.flat()).toHaveLength(15);
  });

  it("žádná lišta nepřeteče", () => {
    for (const rail of rails) {
      expect(rail.reduce((sum, module) => sum + module.width, 0)).toBeLessThanOrEqual(RAIL_CAPACITY);
    }
  });

  it("hlavní vypínač je nahoře, svorkovnice dole", () => {
    expect(rails[0][0].designation).toBe("Q1");
    expect(rails.at(-1)!.every((module) => module.kind === "terminal")).toBe(true);
  });
});

describe("toCsv", () => {
  it("escapuje středníky a uvozovky", () => {
    expect(toCsv([["a;b", 'say "hi"', null, 3]])).toBe('﻿"a;b";"say ""hi""";;3');
  });
});

describe("parseMarkup", () => {
  it("načte platný zákres a odmítne nevalidní", () => {
    const valid = JSON.stringify({ version: 1, sheet: 1, strokes: [{ tool: "pen", color: "#ef4444", width: 0.004, points: [[0.1, 0.2, 0.5]] }] });
    expect(parseMarkup(valid)?.strokes).toHaveLength(1);
    expect(parseMarkup("{")).toBeNull();
    expect(parseMarkup(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseMarkup(null)).toBeNull();
  });
});
