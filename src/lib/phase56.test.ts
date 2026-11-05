import { describe, expect, it } from "vitest";

import { matchDetection, seriesHit, type Detection, type MatchableComponent } from "./panel-builder/matching";
import { planRailMerge, signatureFromItem } from "./panel-builder/rail-merge";
import { alignRail, scorePhoto, type TruthFile } from "./panel-builder/recognition-eval";
import { PANEL_PHOTO_MAX_PX } from "./upload-client";
import { MIN_ZOOM_PX_PER_MODULE, generationConfigFor, isNextGenModel, mergeTouchingRails, mergeZoomReading, toRailDetections, zoomPixelsPerModule, zoomRegionFor } from "@/server/services/geminiPanelService";

const det = (patch: Partial<Detection> = {}): Detection => ({
  dinRailIndex: 1,
  positionOnRail: 1,
  modules: 1,
  box: [10, 10, 30, 14],
  rawOcrText: "",
  category: "MCB",
  poles: "1P",
  ratedCurrentA: 16,
  trippingCurve: "B",
  manufacturer: "ABB",
  confidence: 0.6,
  ...patch,
});

describe("fáze 56 – lupa (fáze C) a modely Gemini", () => {
  it("výřez přístroje má okraj kolem těla a nevyjede z fotky", () => {
    const region = zoomRegionFor([40, 50, 60, 52], 4000, 3000);
    expect(region.left).toBeLessThan(2000);
    expect(region.left + region.width).toBeGreaterThan(2080);
    expect(region.top).toBeLessThan(1200);
    expect(region.top + region.height).toBeGreaterThan(1800);
    const edge = zoomRegionFor([0, 0, 100, 100], 1000, 800);
    expect(edge).toMatchObject({ left: 0, top: 0, width: 1000, height: 800 });
  });

  it("čtení lupou opraví charakteristiku a proud, šířku a rámeček nechá ze segmentace", () => {
    const merged = mergeZoomReading(det({ trippingCurve: "C", ratedCurrentA: 10, rawOcrText: "S201" }), { index: 1, typeCode: "S201-B16", text: "ABB S201 B16", ratedCurrentA: 16, trippingCurve: "B", confidence: 0.85 });
    expect(merged).toMatchObject({ trippingCurve: "B", ratedCurrentA: 16, modules: 1, box: [10, 10, 30, 14], confidence: 0.85 });
    expect(merged.rawOcrText.startsWith("S201-B16")).toBe(true);
  });

  it("nejisté čtení lupou nic nemění; kategorie a póly až od jistoty 0,6", () => {
    const original = det();
    expect(mergeZoomReading(original, { index: 1, ratedCurrentA: 25, confidence: 0.3 })).toBe(original);
    const unsure = mergeZoomReading(det(), { index: 1, category: "RCBO", poles: "1P+N", ratedCurrentA: 13, confidence: 0.5 });
    expect(unsure).toMatchObject({ category: "MCB", poles: "1P", ratedCurrentA: 13 });
    const rcd = mergeZoomReading(det({ category: null, poles: null, modules: 4 }), { index: 1, category: "RCD", poles: "4P", ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30, confidence: 0.9 });
    expect(rcd).toMatchObject({ category: "RCD", poles: "4P", rcdType: "A", rcdSensitivityMa: 30 });
  });

  it("odpínač s červenou páčkou přečtený lupou zůstane hlavním vypínačem 25 A", () => {
    const merged = mergeZoomReading(det({ modules: 3, poles: "3P" }), { index: 1, typeCode: "SHD203/25", category: "MCB", trippingCurve: "C", ratedCurrentA: 25, confidence: 0.8 });
    expect(merged).toMatchObject({ category: "MAIN_SWITCH", ratedCurrentA: 25, trippingCurve: null, poles: "3P" });
  });

  it("lištová cesta už neztrácí typ a citlivost chrániče", () => {
    const region = { left: 0, top: 0, width: 1000, height: 200, imageWidth: 1000, imageHeight: 1000 };
    const [rcd] = toRailDetections([{ position: 1, box_2d: [0, 0, 1000, 400], text: "F204 A-40/0,03", category: "RCD", poles: "4P", modulesWidth: 4, ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30, confidence: 0.9 }], 1, region, 4);
    expect(rcd).toMatchObject({ rcdType: "A", rcdSensitivityMa: 30 });
  });

  it("Gemini 3+ bez nízké teploty a s vysokým rozlišením obrázků, 2.5 beze změny", () => {
    expect(isNextGenModel("gemini-2.5-pro")).toBe(false);
    expect(isNextGenModel("gemini-3.1-pro-preview")).toBe(true);
    expect(isNextGenModel("gemini-pro-latest")).toBe(true);
    expect(generationConfigFor("gemini-2.5-pro", {})).toMatchObject({ temperature: 0.1 });
    const next = generationConfigFor("gemini-3.1-pro-preview", {});
    expect(next).toMatchObject({ mediaResolution: "MEDIA_RESOLUTION_HIGH" });
    expect(next).not.toHaveProperty("temperature");
  });

  it("řada LED signálek těsně nad lištou se sloučí s lištou, vzdálené lišty zůstanou zvlášť", () => {
    expect(mergeTouchingRails([[700, 500, 760, 850], [640, 520, 700, 840], [200, 500, 300, 900]])).toEqual([
      [200, 500, 300, 900],
      [640, 500, 760, 850],
    ]);
    expect(mergeTouchingRails([[100, 100, 200, 900], [300, 100, 400, 900]])).toHaveLength(2);
  });

  it("lupa se nepouští na přístroje, které mají na fotce méně než 40 px na modul", () => {
    expect(MIN_ZOOM_PX_PER_MODULE).toBe(40);
    expect(zoomPixelsPerModule({ box: [0, 10, 10, 12.5], modules: 1 }, 995)).toBeLessThan(40);
    expect(zoomPixelsPerModule({ box: [0, 10, 10, 12.5], modules: 1 }, 4096)).toBeGreaterThan(100);
    expect(zoomPixelsPerModule({ box: null, modules: 1 }, 4096)).toBe(0);
  });

  it("fotky rozváděče se nahrávají až ve 4096 px", () => {
    expect(PANEL_PHOTO_MAX_PX).toBe(4096);
  });
});

describe("fáze 56 – detail jen části lišty nic nemaže", () => {
  const sig = (modules: number, category: Detection["category"] = "MCB", ratedCurrentA: number | null = 16) => ({ modules, category, poles: null, ratedCurrentA });

  it("detail celé lišty ji nahradí, detail části se zarovná na odpovídající úsek", () => {
    const rail = [sig(4, "RCD", 40), sig(1), sig(1), sig(1, "MCB", 10), sig(3, "MCB", 20), sig(1), sig(1)];
    expect(planRailMerge(rail, rail)).toEqual({ mode: "replace" });
    expect(planRailMerge([], [sig(1)])).toEqual({ mode: "replace" });
    const plan = planRailMerge(rail, [sig(1, "MCB", 10), sig(3, "MCB", 20)]);
    expect(plan).toMatchObject({ mode: "enrich", pairs: [[3, 0], [4, 1]] });
  });

  it("detail, který k liště nesedí, ji nechá beze změny (prázdné párování)", () => {
    const rail = Array.from({ length: 12 }, () => sig(1));
    expect(planRailMerge(rail, [sig(4, "RCD", 40), sig(4, "RCD", 25)])).toMatchObject({ mode: "enrich", pairs: [] });
  });

  it("podpis uloženého prvku z detectedJson", () => {
    expect(signatureFromItem({ modulesWidth: 3, detectedJson: JSON.stringify({ category: "MCB", poles: "3P", ratedCurrentA: 20 }) })).toEqual({ modules: 3, category: "MCB", poles: "3P", ratedCurrentA: 20 });
    expect(signatureFromItem({ modulesWidth: 2, detectedJson: "{rozbité" })).toEqual({ modules: 2, category: null, poles: null, ratedCurrentA: null });
  });
});

describe("fáze 56 – párování podle řady z čela", () => {
  const catalog: MatchableComponent[] = [
    { id: "pl6", manufacturer: "Eaton", typeCode: "PL6-B16/1", articleNumber: "286531", category: "MCB", poles: "1P", ratedCurrentA: 16, trippingCurve: "B", modulesCount: 1 },
    { id: "pl7", manufacturer: "Eaton", typeCode: "PL7-B16/1", articleNumber: "262705", category: "MCB", poles: "1P", ratedCurrentA: 16, trippingCurve: "B", modulesCount: 1 },
  ];

  it("PL7 přečtená na čele vyhraje nad abecedně dřívější PL6", () => {
    expect(seriesHit(catalog[1], "eatonpl7b16")).toBe(3);
    expect(matchDetection(det({ manufacturer: "Eaton", rawOcrText: "EATON PL7 B16" }), catalog, null)).toMatchObject({ componentId: "pl7", status: "PARTIAL" });
    expect(matchDetection(det({ manufacturer: "Eaton", rawOcrText: "" }), catalog, null)).toMatchObject({ componentId: "pl6" });
  });
});

describe("fáze 56 – měření přesnosti", () => {
  const truth: TruthFile = {
    rails: [
      [
        { category: "RCD", modules: 4, poles: "4P", ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30 },
        { category: "MCB", modules: 1, poles: "1P", ratedCurrentA: 16, trippingCurve: "B" },
        { category: "MCB", modules: 1, poles: "1P", ratedCurrentA: 10, trippingCurve: "B" },
      ],
    ],
  };

  it("vynechaný přístroj neposune hodnocení dalších", () => {
    const predicted = [det({ category: "RCD", modules: 4, poles: "4P", ratedCurrentA: 40, trippingCurve: null, rcdType: "A", rcdSensitivityMa: 30 }), det({ positionOnRail: 2, ratedCurrentA: 10 })];
    expect(alignRail(truth.rails[0], predicted)).toEqual([
      [0, 0],
      [1, null],
      [2, 1],
    ]);
    const score = scorePhoto(truth, predicted);
    expect(score).toMatchObject({ devicesTruth: 3, exact: 2, missed: 1, extra: 0, railsPredicted: 1 });
  });

  it("špatná charakteristika se počítá jako chyba pole", () => {
    const predicted = [det({ category: "RCD", modules: 4, poles: "4P", ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30 }), det({ trippingCurve: "C" }), det({ ratedCurrentA: 10 })];
    const score = scorePhoto(truth, predicted);
    expect(score.exact).toBe(2);
    expect(score.fields.trippingCurve).toEqual({ correct: 1, total: 2 });
  });
});
