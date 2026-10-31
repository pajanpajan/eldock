import { afterEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_DIMS } from "@/lib/panel-builder/reference";

import { normalizeManufacturer } from "@/lib/panel-builder/catalog";

import sharp from "sharp";

import { RAILS_PROMPT, abbS200Article, analyzePanelPhoto, cropRegionFor, photoPrompt, railPrompt, toPhotoBox, toRailDetections, extractDatasheetComponents, isGeminiConfigured, lookupComponent, toDetections, toExtracted } from "./geminiPanelService";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const noHints = { category: null, poles: null, current: null, curve: null, manufacturer: null };

describe("Gemini – demo režim bez GEMINI_API_KEY", () => {
  it("analýza fotky nespadne a vrátí deterministickou detekci", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isGeminiConfigured()).toBe(false);
    const result = await analyzePanelPhoto({ image: { bytes: Buffer.from("x"), mimeType: "image/jpeg" }, dims: REFERENCE_DIMS });
    expect(result.mode).toBe("DEMO");
    expect(result.detections).toHaveLength(13);
  });

  it("datasheet i dohledání jdou deterministicky", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const datasheet = await extractDatasheetComponents({ pages: [["2CDS251001R0105 S201-B10 Jistic 1P, 10A, char. B, 6kA"]], pdf: null });
    expect(datasheet).toMatchObject({ mode: "DEMO", components: [{ articleNumber: "2CDS251001R0105", ratedCurrentA: 10 }] });
    const lookup = await lookupComponent({ text: "s201 c20", hints: noHints });
    expect(lookup.mode).toBe("DEMO");
    expect(lookup.component).toMatchObject({ typeCode: "S201-C20", articleNumber: "2CDS251001R0204", category: "MCB", ratedCurrentA: 20, trippingCurve: "C", powerLossEstimated: true });
    const generic = await lookupComponent({ text: "Hager MBN116", hints: { ...noHints, category: "MCB", poles: "1P", current: 16, curve: "B", manufacturer: "Hager" } });
    expect(generic.component).toMatchObject({ manufacturer: "Hager", category: "MCB", ratedCurrentA: 16, poles: "1P", articleNumber: "IEC-HAGER-MBN116" });
    expect((await lookupComponent({ text: "??", hints: noHints })).component).toBeNull();
  });

  it("chyba Gemini → pojistka v demo režimu s varováním", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await analyzePanelPhoto({ image: { bytes: Buffer.from("x"), mimeType: "image/png" }, dims: REFERENCE_DIMS });
    expect(result.mode).toBe("DEMO");
    expect(result.warning).toContain("Gemini neodpověděl");
  });

  it("odpověď Gemini se převede na detekce (box 0–1000 → %, řazení lišta/pozice)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const devices = [
      { rail: 2, position: 1, box_2d: [400, 200, 560, 260], text: "S201-B16", category: "MCB", poles: "1P", ratedCurrentA: 16, trippingCurve: "b", modules: 1, manufacturer: "ABB", confidence: 0.9 },
      { rail: 1, position: 1, box_2d: [100, 200, 250, 330], text: "SD203/40", category: "MAIN_SWITCH", poles: "3P", modules: 3, confidence: 0.95, label: "Odpínač" },
    ];
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ dominantManufacturer: "ABB", devices }) }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzePanelPhoto({ image: { bytes: Buffer.from("x"), mimeType: "image/jpeg" }, dims: REFERENCE_DIMS });
    expect(result.mode).toBe("GEMINI");
    expect(result.detections.map((d) => d.rawOcrText)).toEqual(["SD203/40", "S201-B16"]);
    expect(result.detections[1]).toMatchObject({ box: [40, 20, 56, 26], trippingCurve: "B", category: "MCB" });
    expect(result.detections[0].circuitLabel).toBe("Odpínač");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("gemini-2.5-pro:generateContent");
  });

  it("pomocné převody", () => {
    expect(abbS200Article("S201-B16")).toBe("2CDS251001R0165");
    expect(abbS200Article("S203-C32")).toBe("2CDS253001R0324");
    expect(abbS200Article("PL7-B16")).toBeNull();
    expect(toDetections([{ rail: 1, position: 1, box_2d: [1], text: "x", modules: 0, confidence: 2 }])[0]).toMatchObject({ box: null, modules: 1, confidence: 1 });
    expect(toExtracted({ manufacturer: "ABB", typeCode: "S201-B16", articleNumber: "X1", category: "MCB", ratedCurrentA: 16 })).toMatchObject({ powerLossWatts: 2.5, powerLossEstimated: true, modulesCount: 1 });
    expect(toExtracted({ manufacturer: "ABB", typeCode: "S201-B16", category: "MCB" })).toBeNull();
  });
});

describe("Gemini – mix výrobců", () => {
  it("prompt bez nápovědy neomezuje značku, se značkou ji jen upřednostní", () => {
    expect(photoPrompt(null)).toContain("RŮZNÝCH výrobců");
    expect(photoPrompt("MIX")).toContain("u KAŽDÉHO modulu samostatně");
    expect(photoPrompt("Eaton")).toContain("pravděpodobně Eaton");
    expect(photoPrompt("Eaton")).not.toContain("RŮZNÝCH");
  });

  it("nápověda projektu jde do promptu, výrobci z odpovědi se sjednotí", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const devices = [
      { rail: 1, position: 1, box_2d: [100, 100, 200, 200], text: "MSO-40-3", category: "MAIN_SWITCH", modules: 3, manufacturer: "OEZ a.s.", confidence: 0.9 },
      { rail: 1, position: 2, box_2d: [100, 200, 200, 300], text: "SLP-275", category: "SPD", modules: 4, manufacturer: "SALTEK", confidence: 0.9 },
      { rail: 2, position: 1, box_2d: [300, 100, 400, 140], text: "iC60N", category: "MCB", modules: 1, manufacturer: "Schneider Electric", confidence: 0.9 },
    ];
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ dominantManufacturer: "MIX", devices }) }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzePanelPhoto({ image: { bytes: Buffer.from("x"), mimeType: "image/jpeg" }, dims: REFERENCE_DIMS, manufacturerHint: null });
    expect(result.detections.map((d) => d.manufacturer)).toEqual(["OEZ", "Saltek", "Schneider"]);
    expect(result.dominantManufacturer).toBeNull();
    // 1. volání = fáze A (lišty), bez lišt následuje analýza celé fotky s promptem pro mix výrobců
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("svorkovnice PE/N");
    expect(String(fetchMock.mock.calls[1][1].body)).toContain("RŮZNÝCH výrobců");
    expect(normalizeManufacturer("MOELLER")).toBe("Eaton");
    expect(normalizeManufacturer("Legrand SNC")).toBe("Legrand");
    expect(normalizeManufacturer("Neznámá s.r.o.")).toBe("Neznámá s.r.o.");
  });
});

describe("Vision Analyzer 2.0 – analýza po DIN lištách", () => {
  it("výřez lišty s přesahem a přepočet souřadnic zpět do celé fotky", () => {
    const region = cropRegionFor([400, 100, 500, 900], 1000, 2000);
    // lišta 800–1000 px, přesah max(15 % z 200 px, 4 % z 2000 px) = 80 px
    expect(region).toEqual({ left: 80, top: 720, width: 840, height: 360, imageWidth: 1000, imageHeight: 2000 });
    expect(toPhotoBox([0, 0, 1000, 1000], region)).toEqual([36, 8, 54, 92]);
    expect(toPhotoBox([500, 500, 500, 500], region)).toEqual([45, 50, 45, 50]);
  });

  it("přístroje lišty → detekce; vynechaný konec řady se doplní do totalModules", () => {
    const region = { left: 0, top: 0, width: 1000, height: 1000, imageWidth: 1000, imageHeight: 1000 };
    const devices = [
      { position: 2, box_2d: [100, 300, 900, 600], text: "S203-B16", category: "MCB", poles: "3P", modulesWidth: 3, confidence: 0.9 },
      { position: 1, box_2d: [100, 200, 900, 300], text: "S201-B10", category: "MCB", poles: "1P", modulesWidth: 1, confidence: 0.9 },
      { position: 3, box_2d: [100, 600, 900, 700], text: "x", poles: "2x1P", modulesWidth: 1, confidence: 0.5 },
    ];
    const detections = toRailDetections(devices, 2, region, 7);
    expect(detections.map((d) => [d.positionOnRail, d.modules, d.poles, d.dinRailIndex])).toEqual([
      [1, 1, "1P", 2],
      [2, 3, "3P", 2],
      [3, 1, "2x1P", 2],
      [4, 1, null, 2],
      [5, 1, null, 2],
    ]);
    expect(detections[3]).toMatchObject({ box: [10, 70, 90, 80], rawOcrText: "(doplněno – AI modul vynechala)", confidence: 0.2 });
  });

  it("prompty: lišty bez PE/N svorkovnic, šroubky vs. páčky a kompaktní přístroje", () => {
    expect(RAILS_PROMPT).toContain("NIKDY neoznačuj jako DIN lištu holé mosazné svorkovnice PE/N");
    expect(railPrompt("UNCOVERED", "ABB")).toContain("spočítej všechny šroubky");
    expect(railPrompt("UNCOVERED", "ABB")).toContain('poles "3P", modulesWidth 3');
    expect(railPrompt("COVERED", null)).toContain("w_1M");
    expect(railPrompt("COVERED", null)).toContain('poles "2x1P", modulesWidth 1');
  });

  it("dvoufázová analýza: fáze A najde 2 lišty, fáze B každý výřez zvlášť, souřadnice v celé fotce", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const photo = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const reply = (body: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] });
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(reply({ coverState: "COVERED", dominantManufacturer: "OEZ", rails: [{ box_2d: [600, 100, 700, 900] }, { box_2d: [200, 100, 300, 900] }] }))
      .mockResolvedValueOnce(reply({ totalModules: 4, devices: [{ position: 1, box_2d: [100, 0, 900, 750], poles: "3P", modulesWidth: 3, category: "MCB", confidence: 0.9 }] }))
      .mockResolvedValueOnce(reply({ totalModules: 1, devices: [{ position: 1, box_2d: [100, 0, 900, 500], poles: "1P", modulesWidth: 1, category: "MCB", confidence: 0.9 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePanelPhoto({ image: { bytes: photo, mimeType: "image/jpeg" }, dims: REFERENCE_DIMS, manufacturerHint: null, mode: "UNCOVERED" });
    expect(result).toMatchObject({ mode: "GEMINI", railCount: 2, coverState: "UNCOVERED", dominantManufacturer: "OEZ" });
    // horní lišta (ymin 200) je Lišta 1 – 3P + doplněný 1M modul do totalModules 4
    expect(result.detections.map((d) => [d.dinRailIndex, d.positionOnRail, d.modules])).toEqual([
      [1, 1, 3],
      [1, 2, 1],
      [2, 1, 1],
    ]);
    // výřez lišty 1: y 200–300 ‰ → 200–300 px ± max(15 px, 40 px) = 160–340 px, x 64–736 px; přístroj 100–900 ‰ výřezu
    expect(result.detections[0].box).toEqual([17.8, 8, 32.2, 71]);
    expect(String(fetchMock.mock.calls[1][1].body)).toContain("ODKRYTOVANÝ");
    expect(String(fetchMock.mock.calls[1][1].body)).toContain('"mime_type":"image/jpeg"');
  });
});
