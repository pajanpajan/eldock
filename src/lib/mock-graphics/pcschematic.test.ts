import { describe, expect, it } from "vitest";

import { buildPanelModel } from "../panel-model";
import { PC_SHEET_COUNT, columnRect, renderPanelSheetSvg } from "./pcschematic";

const model = buildPanelModel({ tag: "RM1", name: "RM1 - Hlavní rozváděč nn", ratedCurrent: "1600 A", plantCode: "JBC", buildingCode: "E", floorCode: "1PP", customerName: "JBL Automotive" });

describe("renderPanelSheetSvg", () => {
  it("každý ze 6 listů má rám 1–8 / A–F a razítko PCSCHEMATIC s číslem listu", () => {
    for (let sheet = 1; sheet <= PC_SHEET_COUNT; sheet++) {
      const svg = renderPanelSheetSvg(model, sheet);
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 1190 842"/);
      expect(svg).toContain(`data-sheet="${sheet}"`);
      expect(svg).toContain("PCSCHEMATIC");
      expect(svg).toContain(`>${sheet} / 6<`);
      expect(svg).toContain(`>=JBC/+E1PP/-RM1/${sheet}<`);
      for (const label of ["Project title", "Customer", "Page title", "File name", "Page ref.", "DCC", "Scale", "Last edit"]) expect(svg).toContain(`data-field="${label}"`);
      expect(svg).toContain(">8</text>");
      expect(svg).toContain(">F</text>");
    }
  });

  it("obsah listů: liniové, silové, PLC, dispozice 1:5 a ztráty s CE štítkem", () => {
    expect(renderPanelSheetSvg(model, 1)).toContain("Obsah dokumentace");
    const single = renderPanelSheetSvg(model, 2);
    expect(single).toContain(">-F12<");
    expect(single).toContain(">-F1<");
    const power = renderPanelSheetSvg(model, 3);
    expect(power).toContain("&gt;-M1<");
    expect(power).toContain('data-xref="/4.6"');
    expect(power).toMatch(/-W1 {2}BK · BN · GY · GNYE/);
    const control = renderPanelSheetSvg(model, 4);
    expect(control).toContain("DI7 X0.7");
    expect(control).toContain("001.001.001.001");
    expect(renderPanelSheetSvg(model, 5)).toContain('data-mount="1A"');
    expect(renderPanelSheetSvg(model, 5)).toContain(">1:5<");
    const thermal = renderPanelSheetSvg(model, 6);
    expect(thermal).toContain(`data-total-loss="${model.thermal.totalLossW}"`);
    expect(thermal).toContain('data-phase="N"');
    expect(thermal).toContain("ČSN EN 61439-1 / -2");
  });

  it("escapuje text a zvýrazní sloupec cíle", () => {
    expect(renderPanelSheetSvg(buildPanelModel({ tag: "X<1>", name: "A & B", plantCode: "T", buildingCode: "A", floorCode: "1NP" }), 1)).toContain("A &amp; B");
    expect(columnRect(3)).toMatchObject({ x: 40 + 2 * (1110 / 8), w: 1110 / 8 });
  });
});
