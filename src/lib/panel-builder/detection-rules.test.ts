import { describe, expect, it } from "vitest";

import { normalizeDetection, occupiedModules } from "./detection-rules";
import type { Detection } from "./matching";

const detection = (rawOcrText: string, extra: Partial<Detection> = {}): Detection => ({
  dinRailIndex: 1,
  positionOnRail: 1,
  modules: 1,
  box: null,
  rawOcrText,
  category: "MCB",
  poles: "1P",
  ratedCurrentA: null,
  trippingCurve: null,
  manufacturer: null,
  confidence: 0.8,
  ...extra,
});

describe("pravidla Vision Analyzeru pro reálný 144M rozváděč ABB CA35R", () => {
  it("B: DS301C se dvěma šroubky = jeden 1M jističochránič 1P+N, ne dva jističe", () => {
    expect(normalizeDetection(detection("ABB DS301C B16 A30", { modules: 2, poles: "2P" }))).toMatchObject({ category: "RCBO", poles: "1P+N", modules: 1, trippingCurve: "B", ratedCurrentA: 16, rcdType: "A", rcdSensitivityMa: 30, manufacturer: "ABB" });
    expect(normalizeDetection(detection("DS301C C16 A30"))).toMatchObject({ trippingCurve: "C", ratedCurrentA: 16 });
  });

  it("D: EN25-40N je instalační stykač 2M (25 = proud AC-1, ne jistič 25 A); EN40 3M, EN20-20N 1M", () => {
    expect(normalizeDetection(detection("ABB EN25-40N", { category: "MCB", ratedCurrentA: 25, trippingCurve: "C" }))).toMatchObject({ category: "CONTACTOR", poles: "4P", modules: 2, ratedCurrentA: 25, trippingCurve: null });
    expect(normalizeDetection(detection("EN40-40N-06"))).toMatchObject({ category: "CONTACTOR", modules: 3 });
    expect(normalizeDetection(detection("EN20-20N"))).toMatchObject({ category: "CONTACTOR", poles: "2P", modules: 1 });
    expect(normalizeDetection(detection("ESB25-40N"))).toMatchObject({ category: "CONTACTOR" });
  });

  it("C + E: FH204 = 4P chránič 4M (40A vs 25A, 0,03A), S203 = 3P jistič 3M, B2 / B10 / B16 / B20", () => {
    expect(normalizeDetection(detection("ABB FH204 A-40/0,03", { category: "MCB", modules: 3 }))).toMatchObject({ category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30 });
    expect(normalizeDetection(detection("FH204 AC-25/0,03"))).toMatchObject({ ratedCurrentA: 25, rcdType: "AC" });
    expect(normalizeDetection(detection("ABB S203 B20", { category: "RCD", modules: 4 }))).toMatchObject({ category: "MCB", poles: "3P", modules: 3, trippingCurve: "B", ratedCurrentA: 20 });
    expect(normalizeDetection(detection("S201-B2"))).toMatchObject({ poles: "1P", ratedCurrentA: 2, trippingCurve: "B" });
    expect(normalizeDetection(detection("S201 B10"))).toMatchObject({ ratedCurrentA: 10 });
  });

  it("B: řídicí moduly KNX / free@home jako jeden široký modul, řadové svorky jako TERMINAL", () => {
    expect(normalizeDetection(detection("ABB SA/S 8.16.2.2 KNX", { modules: 1 }))).toMatchObject({ category: "PLC", modules: 8 });
    expect(normalizeDetection(detection("free@home SA-M-12.16.2.2"))).toMatchObject({ category: "PLC", modules: 12 });
    expect(normalizeDetection(detection("Loxone Miniserver", { modules: 2 }))).toMatchObject({ category: "PLC", modules: 4 });
    expect(normalizeDetection(detection("WDU 2.5"))).toMatchObject({ category: "TERMINAL" });
  });

  it("neznámý text zůstane beze změny; A: obsazené moduly jen ze skutečných přístrojů", () => {
    const plain = detection("nečitelné");
    expect(normalizeDetection(plain)).toBe(plain);
    expect(occupiedModules([{ modules: 4 }, { modules: 1 }, { modules: 3 }])).toBe(8);
  });
});
