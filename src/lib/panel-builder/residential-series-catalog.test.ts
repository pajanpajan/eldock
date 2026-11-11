import { describe, expect, it } from "vitest";

import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { assemblyError, createFrame, placeAssembly } from "./floorplan-frames";
import { applyNormFix, floorplanNorms } from "./floorplan-norms";
import { compileBoxUsage } from "./mounting-boxes-catalog";
import { frameLimitText, frameRulesOf, maxFrameGang, splitFrameGangs } from "./residential-series-catalog";
import { compileFloorplanBom } from "./wiring-bom";
import { appearanceLabel, designSeriesOf, frameColorForSeries, resolveFrameColor, seriesFrameColors } from "./wiring-designs";

// Fáze 91: pravidla rámečků designových řad podle katalogů výrobců 2026 (ABB ověřeno v Katalogu ABB 2026)

const el = (id: string, item: string, x: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y: 1000, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const drawing = (series: string, color: string, elements: EditorElement[], extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({ ...emptyDraft(), series, color, elements, ...extra });
const firstColor = (series: string) => designSeriesOf(series)!.series.colors![0].id;

describe("fáze 91 – limity vícenásobných rámečků podle katalogu", () => {
  it("Decento nemá víceramček (jen samostatné přístroje s roztečí min. 90 mm), Time Arbo a solo carat do 4R, Classic jen 1R", () => {
    expect(maxFrameGang("ABB|Decento")).toBe(1);
    expect(frameRulesOf("ABB|Decento").separateDevices).toEqual({ minPitchMm: 90 });
    expect(frameLimitText("ABB|Decento")).toContain("nejdou do vícenásobných rámečků");
    expect(maxFrameGang("ABB|Time Arbo")).toBe(4);
    expect(frameLimitText("ABB|Time Arbo")).toBe("Řada ABB Time Arbo se vyrábí nejvýš ve čtyřrámečku (1R–4R) – Katalog ABB 2026, str. 138 (dřevěné rámečky jen 1R–4R).");
    expect(maxFrameGang("ABB|solo carat")).toBe(4);
    expect(maxFrameGang("ABB|Classic")).toBe(1);
    for (const series of ["ABB|Zoni", "ABB|Tango", "ABB|Levit", "ABB|Levit M", "ABB|Time", "ABB|Swing", "ABB|Swing L", "ABB|future linear", "ABB|solo", "ABB|Busch-axcent"]) expect(maxFrameGang(series)).toBe(5);
    expect(frameLimitText("ABB|Zoni")).toBeNull();
  });

  it("nástěnné řady Garant / Praktik / Variant+ mají maxFrameGang 1, jsou na povrch a nedostanou podomítkovou krabici KU 68", () => {
    for (const series of ["ABB|Garant (IP44)", "ABB|Praktik (IP44)", "ABB|Variant+ (IP54)"]) {
      expect(frameRulesOf(series)).toMatchObject({ maxFrameGang: 1, isSurfaceMounted: true });
      const draft = drawing(series, firstColor(series), [el("z", "socket", 1000), el("d", "double-socket", 2000), el("s", "switch-1", 3000)]);
      expect(compileBoxUsage(draft)).toEqual([]);
      const bom = compileFloorplanBom(draft, { installation: "classic" });
      expect(bom.some((row) => row.category === "Instalační krabice" || row.category === "Rámečky")).toBe(false);
      expect(bom.some((row) => /KU 68/.test(row.mpn ?? ""))).toBe(false);
    }
  });

  it("ostatní výrobci podle zadání: Asfora svisle 3R, Plexo 3R, Mureva Styl nástěnná", () => {
    expect(maxFrameGang("Schneider|Asfora")).toBe(5);
    expect(maxFrameGang("Schneider|Asfora", { orientation: "vertical" })).toBe(3);
    expect(maxFrameGang("Legrand|Plexo (IP55)")).toBe(3);
    expect(frameRulesOf("Schneider|Mureva Styl (IP55)").isSurfaceMounted).toBe(true);
    expect(maxFrameGang("Hager|lumina")).toBe(5);
  });

  it("rozdělení na skutečně vyráběné rámečky", () => {
    expect(splitFrameGangs(5, 4)).toEqual([4, 1]);
    expect(splitFrameGangs(5, 3)).toEqual([3, 2]);
    expect(splitFrameGangs(3, 1)).toEqual([1, 1, 1]);
    expect(splitFrameGangs(2, 5)).toEqual([2]);
  });

  it("sestava 4R / 5R v Decentu a Time Arbo nejde vložit, 3R v Time Arbo ano", () => {
    const decento = drawing("ABB|Decento", firstColor("ABB|Decento"), []);
    const four = ["socket", "socket", "socket", "socket"];
    const limit = { max: 1, text: frameLimitText("ABB|Decento") };
    expect(assemblyError(four, limit)).toContain("Decento");
    expect(placeAssembly(decento, ["socket", "socket"], { x: 1000, y: 1000, rotation: 0, room: "Pokoj", series: null, color: null }).ok).toBe(false);
    const arbo = drawing("ABB|Time Arbo", firstColor("ABB|Time Arbo"), []);
    expect(placeAssembly(arbo, [...four, "socket"], { x: 1000, y: 1000, rotation: 0, room: "Pokoj", series: null, color: null }).ok).toBe(false);
    expect(placeAssembly(arbo, ["socket", "socket", "socket"], { x: 1000, y: 1000, rotation: 0, room: "Pokoj", series: null, color: null }).ok).toBe(true);
    const selected = createFrame(drawing("ABB|Time Arbo", firstColor("ABB|Time Arbo"), ["a", "b", "c", "d", "e"].map((id, index) => el(id, "socket", 1000 + index * 80))), ["a", "b", "c", "d", "e"]);
    expect(selected.ok).toBe(false);
  });

  it("víceramček 5R přepnutý na Time Arbo: linter varuje, kusovník rozdělí na 4R + 1R, oprava rozdělí i nákres", () => {
    const members = ["a", "b", "c", "d", "e"].map((id, index) => el(id, "socket", 1000 + index * 80));
    const draft = drawing("ABB|Time Arbo", firstColor("ABB|Time Arbo"), members, { frames: [{ id: "r1", members: members.map((member) => member.id) }] });
    const issue = floorplanNorms(draft).find((candidate) => candidate.rule === "frame-limit");
    expect(issue?.text).toContain("víceramček 5R");
    expect(issue?.text).toContain("rozdělený na 4R + 1R");
    expect(issue?.fix?.label).toBe("Rozdělit na 4R + 1R");
    const frames = compileFloorplanBom(draft, { installation: "classic" }).filter((row) => row.category === "Rámečky");
    expect(frames.map((row) => row.name)).toEqual(expect.arrayContaining(["Rámeček 4násobný (4R) – víceramček 5R rozdělený podle řady (4R + 1R)", "Rámeček 1násobný (1R) – víceramček 5R rozdělený podle řady (4R + 1R)"]));
    expect(frames.some((row) => /5násobný/.test(row.name))).toBe(false);
    const fixed = applyNormFix(draft, issue!);
    expect(fixed.frames).toEqual([{ id: "r1", members: ["a", "b", "c", "d"] }]);
    expect(floorplanNorms(fixed).some((candidate) => candidate.rule === "frame-limit")).toBe(false);
  });

  it("Decento: víceramček se rozpadne na samostatné kompletní přístroje bez rámečku (kusovník bez vymyšlené položky)", () => {
    const members = ["a", "b", "c"].map((id, index) => el(id, "socket", 1000 + index * 80));
    const draft = drawing("ABB|Decento", firstColor("ABB|Decento"), members, { frames: [{ id: "r1", members: members.map((member) => member.id) }] });
    const bom = compileFloorplanBom(draft, { installation: "classic" });
    expect(bom.some((row) => row.category === "Rámečky")).toBe(false);
    expect(bom.find((row) => row.category === "Zásuvky")).toMatchObject({ mpn: "6619K-C06347", quantity: 3 });
    expect(bom.find((row) => row.mpn === "KU 68-45_KA")?.quantity).toBe(3);
    expect(floorplanNorms(draft).find((candidate) => candidate.rule === "frame-limit")?.fix?.label).toBe("Rozdělit na samostatné přístroje");
  });
});

describe("fáze 91 – Busch-axcent a solo carat: kryt zvlášť, rámeček zvlášť", () => {
  it("Busch-axcent drží barvu krytu (studio bílá / mechová černá) nezávisle na materiálu rámečku", () => {
    const frames = seriesFrameColors("ABB|Busch-axcent").map((frame) => frame.label);
    expect(frames).toEqual(["Bílé sklo", "Černé sklo", "Titanová", "Platinová", "Matná černá", "Beton", "Hnědý papír", "Břidlice"]);
    for (const [frame, label] of [
      ["abb-axcent-ramecek-cerne-sklo", "Černé sklo"],
      ["abb-axcent-ramecek-beton", "Beton"],
      ["abb-axcent-ramecek-bridlice", "Břidlice"],
    ]) {
      expect(appearanceLabel("ABB|Busch-axcent", "abb-axcent-84", frame)).toBe(`ABB Busch-axcent · rámeček ${label} · kryt Studio bílá (84)`);
      expect(appearanceLabel("ABB|Busch-axcent", "abb-axcent-885", frame)).toBe(`ABB Busch-axcent · rámeček ${label} · kryt Mechová černá (885)`);
      const draft = drawing("ABB|Busch-axcent", "abb-axcent-84", [el("s", "switch-1", 1000)], { frameColor: frame });
      const bom = compileFloorplanBom(draft, { installation: "classic" });
      // kryt klapky z barvy krytu, rámeček ze samostatné palety (objednací číslo materiálu)
      expect(bom.find((row) => row.category === "Kryty spínačů")).toMatchObject({ mpn: "3559B-A0065184", verified: true });
      expect(bom.find((row) => row.category === "Rámečky")?.mpn).toBe(resolveFrameColor("ABB|Busch-axcent", frame, "abb-axcent-84")!.frameMpn![0]);
    }
    // volba rámečku přežije změnu vzhledu (rámeček z palety rámečků, ne z krytů)
    expect(frameColorForSeries("ABB|Busch-axcent", "abb-axcent-ramecek-beton")).toBe("abb-axcent-ramecek-beton");
    expect(frameColorForSeries("ABB|Busch-axcent", "abb-axcent-84")).toBeNull();
    expect(frameColorForSeries("ABB|Tango", "abb-tango-n")).toBe("abb-tango-n");
    // bez zvoleného rámečku výchozí kombinace z katalogu (str. 165)
    expect(resolveFrameColor("ABB|Busch-axcent", null, "abb-axcent-885")?.label).toBe("Matná černá");
    expect(maxFrameGang("ABB|Busch-axcent", { color: "abb-axcent-84", frameColor: "abb-axcent-ramecek-beton" })).toBe(5);
  });

  it("solo carat: rámečky jen bílé sklo / ušlechtilá ocel / černé sklo do 4R, kryty ze společné kapitoly", () => {
    expect(seriesFrameColors("ABB|solo carat").map((frame) => frame.label)).toEqual(["Bílé sklo", "Ušlechtilá ocel", "Černé sklo"]);
    expect(designSeriesOf("ABB|solo carat")!.series.colors!.map((color) => color.label)).toEqual(["Studio bílá (84)", "Mechová bílá (884)", "Antracitová (81)", "Mechová černá (885)", "Hliníková stříbrná (83)", "Ušlechtilá ocel (866)"]);
    expect(maxFrameGang("ABB|solo carat", { color: "abb-solo-carat-81", frameColor: "abb-solo-carat-ramecek-cerne-sklo" })).toBe(4);
  });
});
