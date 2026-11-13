import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IsoView3D, WallView } from "@/components/panel-builder/floorplan/FloorplanPseudo3DModal";

import { analyzeDraft, emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import {
  DEFAULT_ISO,
  PLAN_AREA_ID,
  PLAN_AREA_NAME,
  buildScene,
  cableRuns3D,
  elevationOfArea,
  inferWalls,
  isoFloorMatrix,
  isoProject,
  roomWallSegments,
  sceneExtent,
  virtualRooms,
  wallRunZ,
  type PlanExtent,
} from "./pseudo3d";
import { displayRoutes } from "./route-display";

// Fáze 110: 3D náhled a pohled na stěnu i bez nakreslených místností (prvky osazené přímo na PDF podkladu), PDF
// podklad na podlaze izometrie a 🔌 kabelové trasy ve 3D i na stěně.

const el = (id: string, item: string, x: number, y: number, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });

/** Jen PDF podklad 15 × 10,6 m a prvky osazené přímo na něm – bez jediné nakreslené místnosti. */
function pdfOnlyDraft(): FloorplanDraft {
  return {
    ...emptyDraft(),
    background: { url: "/pudorys-test.png", widthPx: 1500, heightPx: 1060, rotation: 0, crop: null, pagePt: null },
    mmPerPx: 10,
    widthMm: 15_000,
    heightMm: 10_600,
    rooms: [],
    elements: [
      el("rh", "panel", 7000, 1000),
      el("z1", "double-socket", 2000, 1000),
      el("z2", "double-socket", 11_000, 1000),
      // Okna v obvodové stěně (vlevo a vpravo), dveře a vypínače ve vnitřní příčce x = 6000
      el("okno-l", "arch-window-1", 1000, 5000, { rotation: 90 }),
      el("okno-p", "arch-window-1", 13_500, 5000, { rotation: 90 }),
      el("dvere", "arch-door-1", 6000, 5200, { rotation: 90 }),
      el("s1", "switch-1", 6000, 4400, { rotation: 90, controls: ["l1"] }),
      el("s2", "switch-1", 6000, 6400, { rotation: 90, controls: ["l2"] }),
      el("l1", "ceiling-light", 3500, 5000),
      el("l2", "ceiling-light", 9500, 5000),
      el("z3", "socket", 3000, 9500, { rotation: 180 }),
    ],
  };
}

const SHEET: PlanExtent = { minX: 0, minY: 0, maxX: 15_000, maxY: 10_600 };
const count = (html: string, testId: string) => (html.match(new RegExp(`data-testid="${testId}"`, "g")) ?? []).length;

describe("fáze 110 – 3D stěny i bez nakreslených místností (prvky na PDF podkladu)", () => {
  it("odvodí obvodové stěny z obálky prvků, oken a dveří (oříznuté listem PDF) a příčku v ose dveří a vypínačů", () => {
    const scene = buildScene(pdfOnlyDraft());
    const inferred = inferWalls(scene, SHEET)!;
    expect(inferred.walls.filter((wall) => wall.kind === "perimeter")).toHaveLength(4);
    expect(inferred.envelope.minX).toBe(1000);
    expect(inferred.envelope.maxX).toBe(13_500);
    expect(inferred.envelope.maxY).toBeLessThanOrEqual(SHEET.maxY);
    const partitions = inferred.walls.filter((wall) => wall.kind === "partition");
    expect(partitions.length).toBeGreaterThanOrEqual(1);
    expect(partitions.some((wall) => wall.a.x === 6000 && wall.b.x === 6000)).toBe(true);
    // Jediný nástěnný prvek bez otvoru (zásuvka z3) příčku netvoří
    expect(partitions.some((wall) => wall.a.y === 9500 && wall.b.y === 9500)).toBe(false);
  });

  it("izometrie vykreslí stěny, PDF podklad na podlaze a výřez ze všech prvků, oken a listu podkladu", () => {
    const draft = pdfOnlyDraft();
    const scene = buildScene(draft);
    const inferred = inferWalls(scene, SHEET)!;
    expect(sceneExtent(scene, SHEET)).toMatchObject({ minX: 0, minY: 0, maxX: 15_000, maxY: 10_600 });
    const html = renderToStaticMarkup(createElement(IsoView3D, { draft, view: DEFAULT_ISO, selectedId: null, onSelect: () => undefined, walls: inferred.walls, floor: { background: draft.background!, mmPerPx: 10, sheet: SHEET }, cables: null }));
    expect(count(html, "pseudo3d-wall-face")).toBe(inferred.walls.length);
    expect(count(html, "pseudo3d-wall-face")).toBeGreaterThanOrEqual(5);
    expect(html).toContain('data-testid="pseudo3d-floor-pdf"');
    expect(html).toContain('href="/pudorys-test.png"');
    expect(count(html, "pseudo3d-element")).toBe(8);
  });

  it("polygonové i obdélníkové místnosti jako jednotné úsečky stěn; podlaha PDF ve stejné izometrii jako prvky", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      rooms: [
        { id: "r1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 },
        { id: "r2", name: "Kuchyň", x: 5000, y: 0, w: 4000, h: 4000, points: [{ x: 5000, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 2500 }, { x: 7500, y: 4000 }, { x: 5000, y: 4000 }] },
      ],
    };
    expect(roomWallSegments(buildScene(draft)).map((wall) => wall.kind)).toEqual(Array(9).fill("room"));
    const center = { x: 4000, y: 3000 };
    const [a, b, c, d, e, f] = isoFloorMatrix(DEFAULT_ISO, center);
    for (const point of [{ x: 0, y: 0 }, { x: 12_000, y: 3000 }, { x: 4500, y: 9000 }]) {
      const expected = isoProject(point, DEFAULT_ISO, center);
      expect(a * point.x + c * point.y + e).toBeCloseTo(expected.x, 6);
      expect(b * point.x + d * point.y + f).toBeCloseTo(expected.y, 6);
    }
  });
});

describe("fáze 110 – pohled na stěnu bez nakreslených místností", () => {
  it("virtuální místnost „Celý půdorys (PDF podklad)“ ukáže všechny prvky ve výšce 0–2600 mm bez hlášky o místnosti", () => {
    const draft = pdfOnlyDraft();
    const inferred = inferWalls(buildScene(draft), SHEET)!;
    const rooms = virtualRooms(draft, { background: true, envelope: inferred.envelope });
    expect(rooms[0]).toMatchObject({ id: PLAN_AREA_ID, name: PLAN_AREA_NAME, members: null });
    expect(PLAN_AREA_NAME).toBe("Celý půdorys (PDF podklad)");
    for (const side of ["N", "E", "S", "W"] as const) {
      const elevation = elevationOfArea(draft, rooms[0], side);
      expect(elevation.elements).toHaveLength(8);
      expect(elevation.elements.every((element) => element.z >= 0 && element.z <= 2600 && element.along >= 0 && element.along <= elevation.lengthMm)).toBe(true);
      expect(elevation.openings).toHaveLength(3);
    }
    const html = renderToStaticMarkup(createElement(WallView, { elevation: elevationOfArea(draft, rooms[0], "N"), selectedId: null, onSelect: () => undefined, onHeight: () => undefined }));
    expect(count(html, "pseudo3d-wall-element")).toBe(8);
    expect(html).not.toContain("Nakreslete");
  });

  it("zóny z názvů místností u prvků a ze shluků prvků (kuchyň podle spotřebičů)", () => {
    const named: FloorplanDraft = { ...emptyDraft(), elements: [el("a", "socket", 1000, 1000, { room: "Kuchyň" }), el("b", "socket", 1500, 1000, { room: "Kuchyň" }), el("c", "socket", 8000, 6000, { room: "Obývák" })] };
    expect(virtualRooms(named).map((room) => room.name)).toEqual(["Celý půdorys", "Kuchyň (zóna z prvků)", "Obývák (zóna z prvků)"]);
    const clustered: FloorplanDraft = {
      ...emptyDraft(),
      elements: [el("k1", "dishwasher", 1000, 1000), el("k2", "socket", 1800, 1000), el("k3", "socket", 2600, 1000), el("o1", "socket", 12_000, 8000), el("o2", "socket", 12_800, 8000), el("o3", "ceiling-light", 13_500, 8800)],
    };
    const names = virtualRooms(clustered).map((room) => room.name);
    expect(names[0]).toBe("Celý půdorys");
    expect(names.some((name) => name.startsWith("Kuchyň (shluk 3 prvků)"))).toBe(true);
    expect(names.some((name) => /^Zóna \d+ \(shluk 3 prvků\)$/.test(name))).toBe(true);
    // Nakreslené místnosti a všechny prvky v nich = žádné virtuální místnosti
    expect(virtualRooms({ ...emptyDraft(), rooms: [{ id: "r", name: "Pokoj", x: 0, y: 0, w: 4000, h: 3000 }], elements: [el("p", "socket", 100, 100, { room: "Pokoj" })] })).toEqual([]);
  });
});

describe("fáze 110 – 🔌 kabelové trasy ve 3D a na stěně", () => {
  it("trasa jde od rozváděče (1500 mm) svisle k podlaze / pod strop, vodorovně a svisle do výšky prvku (zásuvka 300 mm, vypínač podle profilu)", () => {
    const scene = buildScene(pdfOnlyDraft());
    const legs = [{ from: "panel", to: "z1", points: [{ x: 7000, y: 1000 }, { x: 2000, y: 1000 }] }];
    const [bottom] = cableRuns3D([{ id: "c1", layer: "sockets", routing: "BOTTOM", legs }], scene, 1500);
    expect(bottom.points.map((point) => point.z)).toEqual([1500, 0, 0, 300]);
    expect(bottom.color).toBe("#fb923c");
    const [top] = cableRuns3D([{ id: "c2", layer: "lighting", routing: "TOP", legs: [{ from: "s1", to: "l1", points: [{ x: 6000, y: 4400 }, { x: 3500, y: 5000 }] }] }], scene, 1500);
    // Svod do výšky vypínače podle výškového profilu nákresu
    expect(top.points[0].z).toBe(scene.elements.find((element) => element.id === "s1")!.z);
    expect(top.points[1].z).toBe(2600);
    expect(top.color).toBe("#facc15");
    expect(wallRunZ("TOP", 2600)).toBe(2300);
    expect(wallRunZ("BOTTOM", 2600)).toBe(300);
  });

  it("výpočet tras funguje i bez místností a přepínač zapne / vypne trasy v izometrii i na stěně", () => {
    const draft = pdfOnlyDraft();
    const scene = buildScene(draft);
    const routes = displayRoutes(draft, analyzeDraft(draft));
    const circuits = [...routes.circuits, ...(routes.bus ? [routes.bus] : [])];
    const runs = cableRuns3D(circuits, scene, scene.elements.find((element) => element.kind === "board")!.z);
    expect(runs.length).toBeGreaterThan(0);
    const inferred = inferWalls(scene, SHEET)!;
    const iso = (cables: typeof runs | null) => renderToStaticMarkup(createElement(IsoView3D, { draft, view: DEFAULT_ISO, selectedId: null, onSelect: () => undefined, walls: inferred.walls, cables }));
    expect(count(iso(runs), "pseudo3d-cable")).toBe(runs.length);
    expect(count(iso(null), "pseudo3d-cable")).toBe(0);
    const area = virtualRooms(draft, { background: true, envelope: inferred.envelope })[0];
    const wall = (cables: typeof circuits | null) => renderToStaticMarkup(createElement(WallView, { elevation: elevationOfArea(draft, area, "N"), selectedId: null, onSelect: () => undefined, onHeight: () => undefined, cables }));
    expect(count(wall(circuits), "pseudo3d-wall-cable")).toBeGreaterThan(0);
    expect(wall(circuits)).toContain("instalační zóna pod stropem (ČSN 33 2130 ed. 4)");
    expect(count(wall(null), "pseudo3d-wall-cable")).toBe(0);
  });
});
