import { describe, expect, it } from "vitest";

import { COMPLIANCE_CATEGORY_ORDER } from "@/lib/format";

import { renderComplianceDocumentSvg } from "./compliance";

const ctx = {
  tag: "R-CNC-04",
  name: "R-CNC-04 - Rozváděč CNC centra 04",
  type: "SWITCHBOARD",
  manufacturer: "Rittal",
  model: "TS 8",
  yearInstalled: 2021,
  ratedVoltage: "400 V AC / 50 Hz",
  ratedCurrent: "63 A",
  ipRating: "IP54",
  externalInfluences: "AA5, AB5 & AD2 <emulze>",
  fedFrom: { tag: "RM1" },
  fedFromCircuit: "Pole 2 / QF2",
  issuer: "ELMONT Jablonec s.r.o.",
  documentNumber: "PS-2021-RCNC04",
  date: "20.02.2021",
  author: "Ing. Martin Šimek",
  feeders: [{ circuit: "Hlavní vypínač Q1", label: "CNC-04" }],
};

describe("renderComplianceDocumentSvg", () => {
  it.each(COMPLIANCE_CATEGORY_ORDER)("vykreslí %s jako samostatné SVG s escapovaným textem", (category) => {
    const svg = renderComplianceDocumentSvg(category, ctx);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toContain("<emulze>");
    expect(svg).not.toMatch(/<script|href="http/);
  });

  it("liniové schéma obsahuje přívod a vývody", () => {
    const svg = renderComplianceDocumentSvg("SINGLE_LINE_DIAGRAM", ctx);
    expect(svg).toContain("Přívod z RM1 (Pole 2 / QF2)");
    expect(svg).toContain("CNC-04");
  });
});
