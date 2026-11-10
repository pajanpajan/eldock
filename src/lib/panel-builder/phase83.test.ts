import { describe, expect, it } from "vitest";

import { floorplanDxf } from "./dxf-export";
import { buildEldockFile, parseEldockFile } from "./eldock-file";
import { addFloor, emptyDraft, parseDraft, switchFloor, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { clampView, MIN_VIEW_MM, ZOOM_MAX } from "./floorplan-pdf";
import { contentExtent, contentView, DEFAULT_PLANE, growPlane, meters, PLANE_MAX_MM, PLANE_PRESETS, planePresetOf, resizePlane } from "./floorplan-plane";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Hala", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (x: number, y: number, w: number, h: number, name = "Hala") => ({ id: `m-${name}`, name, x, y, w, h });
/** Čistý rastr s místností a dvěma prvky. */
const drawn = (extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({
  ...emptyDraft(),
  rooms: [room(1000, 1000, 12_000, 9000)],
  elements: [el("e1", "socket", 2000, 1500), el("e2", "light", 7000, 5000)],
  ...extra,
});

describe("fáze 83 – nastavitelná plocha 2D půdorysu (5–100 m)", () => {
  it("nový čistý rastr má 20 × 16 m, předvolby od bytu po halu a vlastní rozměr", () => {
    expect(emptyDraft()).toMatchObject({ widthMm: 20_000, heightMm: 16_000 });
    expect(DEFAULT_PLANE).toEqual({ widthMm: 20_000, heightMm: 16_000 });
    expect(PLANE_PRESETS.map((preset) => [preset.label, preset.widthMm, preset.heightMm])).toEqual([
      ["Byt / Menší RD (14 × 10 m)", 14_000, 10_000],
      ["Rodinný dům standard (20 × 16 m)", 20_000, 16_000],
      ["Velký RD / Vila s dvojgaráží (30 × 22 m)", 30_000, 22_000],
      ["Provozovna / Hala (50 × 35 m)", 50_000, 35_000],
    ]);
    expect(planePresetOf(20_000, 16_000)).toBe("house");
    expect(planePresetOf(50_000, 35_000)).toBe("hall");
    expect(planePresetOf(25_000, 16_000)).toBe("custom");
    expect(meters(12_500)).toBe("12,5");
    expect(meters(100_000)).toBe("100");
  });

  it("změna plochy zachová souřadnice v mm, ořízne rozsah 5–100 m a nikdy nejde pod nákres", () => {
    const draft = drawn();
    const hall = resizePlane(draft, 50_000, 35_000);
    expect(hall.clamped).toBe(false);
    expect(hall.draft).toMatchObject({ widthMm: 50_000, heightMm: 35_000 });
    expect(hall.draft.rooms).toEqual(draft.rooms);
    expect(hall.draft.elements).toEqual(draft.elements);

    expect(resizePlane(draft, 150_000, 2_000)).toMatchObject({ clamped: true, draft: { widthMm: PLANE_MAX_MM, heightMm: 10_000 } });
    // Nákres sahá do 13 × 10 m → menší plocha se zarovná na nákres (na 0,5 m nahoru)
    expect(resizePlane(draft, 8_000, 6_000)).toMatchObject({ clamped: true, draft: { widthMm: 13_000, heightMm: 10_000 } });
    expect(resizePlane(draft, 5_000, 5_000).draft).toMatchObject({ widthMm: 13_000, heightMm: 10_000 });
    // Beze změny = stejný objekt (žádný krok Zpět ani uložení)
    expect(resizePlane(draft, 20_000, 16_000).draft).toBe(draft);
    // Podlaží s podkladem má plochu podle podkladu
    const withBackground = { ...draft, background: { url: "/api/files/plan.png", width: 1000, height: 800 } } as unknown as FloorplanDraft;
    expect(resizePlane(withBackground, 50_000, 35_000).draft).toBe(withBackground);
  });

  it("plocha platí pro všechna podlaží bez podkladu – každé aspoň na svůj nákres", () => {
    const two = addFloor(drawn(), { name: "2. NP" });
    expect(two.widthMm).toBe(20_000);
    const withAttic = { ...two, elements: [el("a1", "light", 26_000, 3000)] };
    const resized = resizePlane(withAttic, 30_000, 22_000).draft;
    expect(resized).toMatchObject({ widthMm: 30_000, heightMm: 22_000 });
    expect(resized.otherFloors[0]).toMatchObject({ widthMm: 30_000, heightMm: 22_000 });
    // Zmenšení: aktivní podlaží jen na svůj nákres (26 m) a ostatní podlaží na stejnou plochu – podlaží zůstanou zarovnaná
    const shrunk = resizePlane(resized, 10_000, 10_000).draft;
    expect(shrunk).toMatchObject({ widthMm: 26_000, heightMm: 10_000 });
    expect(shrunk.otherFloors[0]).toMatchObject({ widthMm: 26_000, heightMm: 10_000 });
    expect(switchFloor(shrunk, shrunk.otherFloors[0].id)).toMatchObject({ widthMm: 26_000, rooms: drawn().rooms });
    // Podlaží s větším nákresem než aktivní zůstane aspoň na svůj nákres
    const back = resizePlane(switchFloor(shrunk, shrunk.otherFloors[0].id), 5_000, 5_000).draft;
    expect(back).toMatchObject({ widthMm: 13_000, heightMm: 10_000 });
    expect(back.otherFloors[0]).toMatchObject({ widthMm: 26_000, heightMm: 10_000 });
  });

  it("nákres u pravého / dolního okraje rozšíří plochu o 5 m – jen ve směru, kam se nákres rozšířil", () => {
    const before = drawn();
    // Místnost natažená k pravému okraji (19,5 m z 20 m)
    const after = { ...before, rooms: [...before.rooms, room(14_000, 2000, 5500, 4000, "Garáž")] };
    const grown = growPlane(after, before);
    expect(grown).toMatchObject({ widthMm: 25_000, heightMm: 16_000 });
    expect(growPlane(grown, before)).toBe(grown);
    // Prvek přetažený za dolní okraj → plocha aspoň 1 m za prvek
    const below = { ...before, elements: [...before.elements, el("e3", "socket", 5000, 22_300)] };
    expect(growPlane(below, before)).toMatchObject({ widthMm: 20_000, heightMm: 23_500 });
    // Ručně těsně nastavená plocha se kliknutím (nákres beze změny) nezvětší
    const tight = resizePlane(before, 13_000, 10_000).draft;
    expect(growPlane(tight, tight)).toBe(tight);
    // Nejvýš 100 m, podklad = beze změny
    const edge = { ...emptyDraft(), widthMm: PLANE_MAX_MM, elements: [el("x", "socket", 99_800, 1000)] };
    expect(growPlane(edge, emptyDraft()).widthMm).toBe(PLANE_MAX_MM);
    const withBackground = { ...after, background: { url: "/api/files/plan.png", width: 1000, height: 800 } } as unknown as FloorplanDraft;
    expect(growPlane(withBackground, before)).toBe(withBackground);
  });

  it("podklad CAD drží plochu aspoň na výkres s okrajem", () => {
    const cad = { url: "/api/files/cad.json", fileName: "hala.dxf", units: "mm", unitsSource: "header", widthMm: 42_000, heightMm: 28_000, layers: [], monochrome: false, opacity: 0.8, snap: true } as unknown as FloorplanDraft["cad"];
    const draft = { ...drawn(), cad, widthMm: 44_000, heightMm: 30_000 };
    expect(contentExtent(draft)).toEqual({ maxX: 44_000, maxY: 30_000 });
    expect(resizePlane(draft, 20_000, 16_000)).toMatchObject({ clamped: true, draft: { widthMm: 44_000, heightMm: 30_000 } });
  });

  it("⛶ Přizpůsobit pohled vycentruje celý nákres v poměru stran plochy, prázdný = celá plocha", () => {
    expect(contentView(emptyDraft())).toEqual({ x: 0, y: 0, w: 20_000 });
    const hall = resizePlane(drawn(), 50_000, 35_000).draft;
    const view = contentView(hall);
    // Nákres 1–13 × 1–10 m + okraj 0,8 m
    expect(view.w).toBeCloseTo(Math.max(13_600, 10_600 / 0.7), 0);
    expect(view.x + view.w / 2).toBeCloseTo(7000, 0);
    expect(view.y + (view.w * 0.7) / 2).toBeCloseTo(5500, 0);
    // Malý nákres → výřez aspoň 2 m (a celý nákres i na výšku)
    expect(contentView({ ...hall, rooms: [], elements: [el("s", "socket", 9000, 9000)] }).w).toBeCloseTo(Math.max(2000, 1600 / 0.7), 3);
    expect(contentView({ ...hall, widthMm: 50_000, heightMm: 10_000, rooms: [], elements: [el("s", "socket", 9000, 9000)] }).w).toBe(8000);
  });

  it("u haly 100 m jde přiblížit na výřez 1,5 m, do šířky 24 m beze změny (1/16 plochy)", () => {
    expect(clampView({ x: 0, y: 0, w: 100 }, { widthMm: 100_000, heightMm: 100_000 }).w).toBe(MIN_VIEW_MM);
    expect(clampView({ x: 0, y: 0, w: 100 }, { widthMm: 20_000, heightMm: 16_000 }).w).toBe(20_000 / ZOOM_MAX);
    expect(clampView({ x: 0, y: 0, w: 100 }, { widthMm: 14_000, heightMm: 10_000 }).w).toBe(14_000 / ZOOM_MAX);
  });

  it("plocha se uloží s nákresem (cloud / prohlížeč), v souboru .eldock.json a v DXF", () => {
    const hall = resizePlane(drawn(), 50_000, 35_000).draft;
    expect(parseDraft(JSON.parse(JSON.stringify(hall)))).toMatchObject({ widthMm: 50_000, heightMm: 35_000 });
    // Starší nákres bez plochy dál 14 × 10 m
    const legacy = JSON.parse(JSON.stringify(drawn()));
    delete legacy.widthMm;
    delete legacy.heightMm;
    expect(parseDraft(legacy)).toMatchObject({ widthMm: 14_000, heightMm: 10_000 });

    const file = buildEldockFile({ meta: { code: null, name: "Hala", customerName: null, installationSite: null }, draft: hall, templates: [], assets: {} });
    const parsed = parseEldockFile(JSON.stringify(file));
    expect("file" in parsed && parseDraft(parsed.file.draft)).toMatchObject({ widthMm: 50_000, heightMm: 35_000 });

    expect(floorplanDxf(hall, null, { date: new Date("2026-11-10T10:00:00Z") })).toContain(String.raw`plocha 50 \U+00D7 35 m`);
  });
});
