import { afterEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_DIMS } from "@/lib/panel-builder/reference";

import { abbS200Article, analyzePanelPhoto, extractDatasheetComponents, isGeminiConfigured, lookupComponent, toDetections, toExtracted } from "./geminiPanelService";

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
