import { describe, expect, it } from "vitest";

import { symbolParts } from "@/components/panel-builder/floorplan/FloorSymbol";
import { summarizeCabling, BUS_LEG_CABLE, SWITCH_LEG_CABLE } from "@/engine/cable-routing";

import { analyzeDraft, convertForLevel, effectiveSwitchNo, emptyDraft, generationChecklist, paletteFor, paletteItem, parseDraft, snapToWall, wallRotation, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { backgroundTransform, calibrationPreview, clampView, cropDraft, deviationPct, mmPerPxFromDrawingScale, planExtent, resetCrop, rotateDraft, zoomView, type FloorplanBackground } from "./floorplan-pdf";
import { compileFloorplanBom } from "./wiring-bom";

const element = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

const withBackground = (patch: Partial<FloorplanBackground> = {}): FloorplanDraft => {
  const background: FloorplanBackground = { url: "/api/files/photos/a.jpg", widthPx: 2000, heightPx: 1000, rotation: 0, crop: null, pagePt: { width: 842, height: 421 }, ...patch };
  return { ...emptyDraft(), background, mmPerPx: 10, ...planExtent(background, 10) };
};

describe("fáze 57 – úprava PDF podkladu", () => {
  it("otočení o 90° prohodí rozměry, otočí místnosti i značky a 4× otočení vrátí původní stav", () => {
    const draft = { ...withBackground(), rooms: [{ id: "m1", name: "Obývací pokoj", x: 1000, y: 2000, w: 4000, h: 3000 }], elements: [element("e1", "socket", 1000, 2000)] };
    const once = rotateDraft(draft);
    expect(once.widthMm).toBe(10_000);
    expect(once.heightMm).toBe(20_000);
    expect(once.background?.rotation).toBe(90);
    // bod (x, y) → (H − y, x)
    expect(once.elements[0]).toMatchObject({ x: 8000, y: 1000, rotation: 90 });
    expect(once.rooms[0]).toMatchObject({ x: 10_000 - 5000, y: 1000, w: 3000, h: 4000 });
    const back = rotateDraft(rotateDraft(rotateDraft(once)));
    expect(back.elements[0]).toMatchObject({ x: 1000, y: 2000, rotation: 0 });
    expect(back.rooms[0]).toMatchObject({ x: 1000, y: 2000, w: 4000, h: 3000 });
    expect(rotateDraft(once, -1).background?.rotation).toBe(0);
  });

  it("SVG transformace podkladu respektuje otočení a ořez", () => {
    expect(backgroundTransform(withBackground().background!, 10)).toBe("scale(10) translate(0 0)");
    expect(backgroundTransform(withBackground({ rotation: 90 }).background!, 10)).toBe("scale(10) translate(0 0) translate(1000 0) rotate(90)");
    expect(backgroundTransform(withBackground({ crop: { x: 100, y: 50, w: 500, h: 400 } }).background!, 10)).toBe("scale(10) translate(-100 -50)");
  });

  it("ořez posune prvky, zkrátí místnosti, odstraní značky mimo výřez a zrušení ořezu vše vrátí", () => {
    const draft = { ...withBackground(), rooms: [{ id: "m1", name: "Pokoj", x: 0, y: 0, w: 6000, h: 5000 }], elements: [element("e1", "socket", 3000, 3000), element("e2", "socket", 15_000, 3000)] };
    const cropped = cropDraft(draft, { x: 2000, y: 1000, w: 8000, h: 6000 });
    expect(cropped.widthMm).toBe(8000);
    expect(cropped.heightMm).toBe(6000);
    expect(cropped.background?.crop).toEqual({ x: 200, y: 100, w: 800, h: 600 });
    expect(cropped.elements.map((e) => [e.id, e.x, e.y])).toEqual([["e1", 1000, 2000]]);
    expect(cropped.rooms[0]).toMatchObject({ x: 0, y: 0, w: 4000, h: 4000 });
    const reset = resetCrop(cropped);
    expect(reset.widthMm).toBe(20_000);
    expect(reset.elements[0]).toMatchObject({ x: 3000, y: 3000 });
  });

  it("zoom drží bod pod kurzorem a nevyjede z výkresu", () => {
    const draft = { widthMm: 20_000, heightMm: 10_000 };
    const view = zoomView({ x: 0, y: 0, w: 20_000 }, draft, 2, { x: 10_000, y: 5000 });
    expect(view).toEqual({ x: 5000, y: 2500, w: 10_000 });
    expect(clampView({ x: 18_000, y: 9000, w: 10_000 }, draft)).toEqual({ x: 10_000, y: 5000, w: 10_000 });
    expect(zoomView(view, draft, 0.1).w).toBe(20_000);
  });

  it("kalibrace: náhled měřítka, kontrola proti měřítku výkresu 1 : 50 a odchylka ověřovací kóty", () => {
    const draft = withBackground();
    expect(calibrationPreview(draft, 4000, 5000)).toMatchObject({ ratio: 1.25, mmPerPx: 12.5, widthMm: 25_000 });
    // A3 na šířku 842 pt = 297 mm na 2000 px → 1 : 50 = 7,42 mm / px
    expect(mmPerPxFromDrawingScale(draft.background, 50)).toBeCloseTo(7.426, 3);
    expect(mmPerPxFromDrawingScale({ pagePt: null, widthPx: 2000 }, 50)).toBeNull();
    expect(deviationPct(3636, 3600)).toBe(1);
    expect(deviationPct(3420, 3600)).toBe(-5);
  });

  it("starý nákres bez transformací se načte (otočení 0, bez ořezu, kalibrace neověřená, prostředí nezvolené)", () => {
    const old = { version: 1, background: { url: "/api/files/photos/x.jpg", widthPx: 1500, heightPx: 1000 }, mmPerPx: 10, widthMm: 15_000, heightMm: 10_000, rooms: [], elements: [{ id: "e", item: "socket", x: 10, y: 10, room: "A", frameUnits: 1, controls: [] }] };
    const draft = parseDraft(old)!;
    expect(draft.background).toMatchObject({ rotation: 0, crop: null, pagePt: null });
    expect(draft.elements[0]).toMatchObject({ rotation: 0, scale: null });
    expect(draft.calibration.state).toBe("none");
    expect(draft.environment).toBeNull();
    expect(generationChecklist(draft).ready).toBe(false);
    expect(generationChecklist({ ...draft, background: null, environment: "INDOOR_DRY" }).ready).toBe(true);
  });
});

describe("fáze 57 – značky dle ČSN EN 60617-11", () => {
  it("zásuvka = otevřený oblouk s nožičkou ke stěně a ochranným kontaktem, dvojzásuvka s počtem 2", () => {
    const single = symbolParts(paletteItem("socket")!, 300);
    expect(single.kind).toBe("socket");
    expect(single.paths[0]).toBe("M0 0 V84"); // nožička ke stěně
    expect(single.paths[1]).toMatch(/^M-90 174 A90 90 0 0 1 90 174$/); // oblouk bez základny
    expect(single.paths).toContain("M-90 84 H90"); // ochranný kontakt
    expect(symbolParts(paletteItem("double-socket")!, 300).texts.map((text) => text.value)).toEqual(["2"]);
    expect(symbolParts(paletteItem("data-socket")!, 300).label).toBe("RJ45");
  });

  it("vypínač podle skutečného řazení: 1 = jedna čára, 6 = obě strany, 7 = čtyři čáry, 5 = V, doutnavka = křížek", () => {
    const lines = (id: string, switchNo?: string) => symbolParts(paletteItem(id)!, 300, { switchNo }).paths.filter((d) => d.includes(" l")).length;
    expect(lines("switch-1")).toBe(1);
    expect(lines("switch-1", "6")).toBe(2);
    expect(lines("switch-1", "7")).toBe(4);
    expect(lines("switch-5")).toBe(2);
    expect(symbolParts(paletteItem("abb-1so")!, 300).paths.some((d) => /^M-\d/.test(d) && d.includes(" L") && !d.includes(" l"))).toBe(true);
    expect(symbolParts(paletteItem("button")!, 300).circles).toHaveLength(2);
    expect(symbolParts(paletteItem("bus-4")!, 300)).toMatchObject({ kind: "bus", label: "BUS 4×" });
    expect(symbolParts(paletteItem("switch-1")!, 300, { level: "smart_retrofit" }).texts.map((text) => text.value)).toContain("M");
  });

  it("řazení z párování: jediné ovládací místo = 1, dvě = 6, třetí = 7", () => {
    const light = element("l1", "ceiling-light", 3000, 3000);
    const switches = [element("s1", "switch-1", 1000, 1000, { controls: ["l1"] }), element("s2", "switch-1", 5000, 1000, { controls: ["l1"] }), element("s3", "switch-1", 3000, 5000, { controls: ["l1"] })];
    const draft = { ...emptyDraft(), elements: [light, ...switches] };
    expect(switches.map((sw) => effectiveSwitchNo(draft, sw))).toEqual(["6", "6", "7"]);
    expect(effectiveSwitchNo({ elements: [light, switches[0]] }, switches[0])).toBe("1");
  });

  it("zásuvka se natočí ke stěně a přicvakne k ní", () => {
    const room = { x: 0, y: 0, w: 4000, h: 3000 };
    expect(wallRotation(room, 2000, 200)).toBe(0);
    expect(wallRotation(room, 3900, 1500)).toBe(90);
    expect(wallRotation(room, 2000, 2900)).toBe(180);
    expect(wallRotation(room, 100, 1500)).toBe(270);
    expect(snapToWall(room, 2000, 300)).toEqual({ x: 2000, y: 0 });
    expect(snapToWall(room, 2000, 1500)).toEqual({ x: 2000, y: 1500 });
  });
});

describe("fáze 57 – úroveň instalace mění ovládání, kabeláž i kusovník", () => {
  const base = (): FloorplanDraft => ({
    ...emptyDraft(),
    elements: [
      element("rh", "panel", 0, 0, { series: null }),
      element("l1", "ceiling-light", 4000, 3000),
      element("l2", "ceiling-light", 6000, 3000),
      element("s1", "switch-1", 3000, 1000, { controls: ["l1"] }),
      element("s5", "switch-5", 5000, 1000, { controls: ["l2"] }),
      element("t", "thermostat", 2000, 2000),
    ],
  });

  it("paleta nabízí v každé úrovni jiné ovládání", () => {
    const ids = (level: Parameters<typeof paletteFor>[0]) => paletteFor(level).filter((item) => item.group === "controls").map((item) => item.id);
    expect(ids("classic")).toContain("switch-6");
    expect(ids("classic")).not.toContain("bus-4");
    expect(ids("bus_loxone")).toEqual(expect.arrayContaining(["bus-1", "bus-4", "bus-presence", "bus-room"]));
    expect(ids("bus_loxone")).not.toContain("switch-1");
    expect(ids("smart_retrofit")).toEqual(expect.arrayContaining(["switch-1", "wireless-1"]));
  });

  it("přepnutí na sběrnici převede vypínače na tlačítka (párování zůstane) a zpět", () => {
    const bus = convertForLevel(base(), "bus_loxone");
    expect(bus.draft.installation).toBe("bus_loxone");
    expect(bus.draft.elements.find((e) => e.id === "s1")).toMatchObject({ item: "bus-1", controls: ["l1"] });
    expect(bus.draft.elements.find((e) => e.id === "s5")?.item).toBe("bus-2");
    expect(bus.draft.elements.find((e) => e.id === "t")?.item).toBe("bus-room");
    expect(bus.changes.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    const classic = convertForLevel(bus.draft, "classic");
    expect(classic.draft.elements.find((e) => e.id === "s1")?.item).toBe("switch-1");
    expect(classic.draft.elements.find((e) => e.id === "t")?.item).toBe("thermostat");
  });

  it("sběrnice: jedna sběrnicová linka z rozváděče místo svodů CYKY-O, světla hvězdou", () => {
    const draft = convertForLevel(base(), "bus_loxone").draft;
    const { summary } = analyzeDraft(draft);
    const cables = summary.byCable.map((row) => row.cable);
    expect(cables).toContain(BUS_LEG_CABLE);
    expect(cables.some((cable) => cable.startsWith("CYKY-O"))).toBe(false);
    const classic = analyzeDraft(base()).summary.byCable.map((row) => row.cable);
    expect(classic.some((cable) => cable.startsWith("CYKY-O"))).toBe(true);
    // bez seznamu sběrnicových prvků zůstává původní chování (svody ze světel)
    const legacy = summarizeCabling({ circuits: [], nodes: [{ id: "s", x: 0, y: 0, heightMm: 1050, room: "m" }, { id: "l", x: 1000, y: 0, heightMm: 2600, room: "m" }], panel: { x: 0, y: 0 }, selected: "OPTIMIZED", switchLinks: [{ switchId: "s", lightId: "l" }], installation: "bus_loxone" });
    expect(legacy.byCable.map((row) => row.cable)).toEqual([BUS_LEG_CABLE]);
    expect(SWITCH_LEG_CABLE).toBe("CYKY-O 3×1,5");
  });

  it("kusovník: sběrnice bez strojků spínačů, retrofit s moduly a bezdrátové tlačítko bez krabice", () => {
    const bus = compileFloorplanBom(convertForLevel(base(), "bus_loxone").draft, { installation: "bus_loxone" });
    expect(bus.some((row) => row.category === "Přístroje spínačů")).toBe(false);
    expect(bus.filter((row) => row.category === "Sběrnicové prvky").map((row) => row.quantity)).toEqual(expect.arrayContaining([1, 1, 1]));
    const retrofitDraft = { ...base(), installation: "smart_retrofit" as const, elements: [...base().elements, element("l3", "ceiling-light", 8000, 3000), element("w1", "wireless-1", 8000, 1000, { controls: ["l3"] })] };
    const retrofit = compileFloorplanBom(retrofitDraft, { installation: "smart_retrofit" });
    const row = (name: RegExp) => retrofit.find((candidate) => name.test(candidate.name))?.quantity;
    expect(row(/^Chytrý modul pod vypínač/)).toBe(2);
    expect(row(/^Spínací modul do krabice svítidla/)).toBe(1);
    expect(row(/^Bezdrátové tlačítko 1násobné/)).toBe(1);
    // krabice: 2 vypínače + termostat (bezdrátové tlačítko krabici nemá)
    expect(retrofit.find((candidate) => candidate.category === "Instalační krabice")?.quantity).toBe(3);
  });
});
