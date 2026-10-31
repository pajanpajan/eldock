import { describe, expect, it } from "vitest";

import { REFERENCE_DIMS } from "./reference";
import { demoDetections, designationsInOrder, matchDetection, type MatchableComponent } from "./matching";

const c = (id: string, manufacturer: string, typeCode: string, articleNumber: string, category: MatchableComponent["category"], poles: string, current: number, curve: string | null, modules = 1) => ({
  id,
  manufacturer,
  typeCode,
  articleNumber,
  category,
  poles,
  ratedCurrentA: current,
  trippingCurve: curve,
  modulesCount: modules,
  powerLossWatts: 2.5,
});

const CATALOG = [
  c("abb-b16", "ABB", "S201-B16", "2CDS251001R1165", "MCB", "1P", 16, "B"),
  c("abb-ds", "ABB", "DS201 B16 A30", "2CSR255140R1165", "RCBO", "1P+N", 16, "B", 2),
  c("eaton-b16", "Eaton", "PL7-B16/1", "262706", "MCB", "1P", 16, "B"),
  c("oez-c16", "OEZ", "LTN-16C-1", "41578", "MCB", "1P", 16, "C"),
  c("abb-sd", "ABB", "SD203/40", "2CDD283101R0040", "MAIN_SWITCH", "3P", 40, null, 3),
];

const detection = (overrides: Partial<Parameters<typeof matchDetection>[0]>) => ({
  dinRailIndex: 1,
  positionOnRail: 1,
  modules: 1,
  box: null,
  rawOcrText: "",
  category: null,
  poles: null,
  ratedCurrentA: null,
  trippingCurve: null,
  manufacturer: null,
  confidence: 0.8,
  ...overrides,
});

describe("párování detekcí s katalogem", () => {
  it("přečtený typ nebo objednací číslo → VERIFIED (nejdelší shoda vyhrává)", () => {
    expect(matchDetection(detection({ rawOcrText: "ABB S201-B16 6kA" }), CATALOG, "ABB")).toMatchObject({ componentId: "abb-b16", status: "VERIFIED" });
    expect(matchDetection(detection({ rawOcrText: "DS201 B16 A30" }), CATALOG, "ABB").componentId).toBe("abb-ds");
    expect(matchDetection(detection({ rawOcrText: "obj. č. 262706" }), CATALOG, "ABB").componentId).toBe("eaton-b16");
  });

  it("jen parametry → PARTIAL s dominantním výrobcem; bez proudu → UNRECOGNIZED", () => {
    expect(matchDetection(detection({ rawOcrText: "S201-B1б", category: "MCB", poles: "1P", ratedCurrentA: 16, trippingCurve: "B" }), CATALOG, "ABB")).toMatchObject({ componentId: "abb-b16", status: "PARTIAL" });
    expect(matchDetection(detection({ category: "MCB", ratedCurrentA: 16, trippingCurve: "B" }), CATALOG, "Eaton").componentId).toBe("eaton-b16");
    expect(matchDetection(detection({ rawOcrText: "S2?? -B1?", category: "MCB" }), CATALOG, "ABB")).toMatchObject({ componentId: null, status: "UNRECOGNIZED" });
  });

  it("IEC značení v pořadí čtení", () => {
    expect(designationsInOrder(["MAIN_SWITCH", "SPD", "RCD", "MCB", null, "CONTACTOR"])).toEqual(["-Q1", "-F1", "-F2", "-F3", "-F4", "-K1"]);
  });

  it("demo detekce referenčního rozváděče: 13 přístrojů na 3 lištách s rámečky v %", () => {
    const detections = demoDetections(REFERENCE_DIMS);
    expect(detections).toHaveLength(13);
    expect(detections.map((d) => d.dinRailIndex)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3]);
    const [ymin, xmin, ymax, xmax] = detections[0].box!;
    expect(ymin).toBeLessThan(ymax);
    expect(xmin).toBeLessThan(xmax);
    expect(Math.max(...detections.map((d) => d.box![3]))).toBeLessThanOrEqual(100);
    // F3 začíná tam, kde na liště 2 začíná první modul; F4 hned za ním
    expect(detections[4].box![1]).toBeGreaterThan(detections[3].box![3] - 0.01);
    expect(detections.find((d) => d.designation === "-F6")).toMatchObject({ ratedCurrentA: null, manufacturer: null });
  });
});

describe("mix výrobců v jednom rozváděči", () => {
  it("výrobce přečtený u modulu má přednost; bez preference se páruje napříč katalogem", () => {
    const params = { category: "MCB" as const, poles: "1P", ratedCurrentA: 16, trippingCurve: "B" };
    expect(matchDetection(detection({ ...params, manufacturer: "EATON" }), CATALOG, "ABB")).toMatchObject({ componentId: "eaton-b16", status: "PARTIAL" });
    expect(matchDetection(detection({ ...params, manufacturer: "Hager" }), CATALOG, "ABB")).toMatchObject({ componentId: null, status: "UNRECOGNIZED" });
    expect(matchDetection(detection(params), CATALOG, null)).toMatchObject({ componentId: expect.stringMatching(/b16$/), status: "PARTIAL" });
    expect(matchDetection(detection({ rawOcrText: "OEZ LTN-16C-1" }), CATALOG, "ABB")).toMatchObject({ componentId: "oez-c16", status: "VERIFIED" });
  });
});
