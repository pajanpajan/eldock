import { describe, expect, it } from "vitest";

import { DEFAULT_ELEVATION } from "@/engine/floorplan-bridge";
import { MANHATTAN, summarizeCabling, type RouteNode, type TreeLeg } from "@/engine/cable-routing";
import { buildWallGraph, wallMetric, wallSegments } from "@/engine/wall-routing";

import { analyzeDraft, emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { TRACK_MM, WALL_BAND_MM, createPerimeterRouter, insetOutline, perimeterSweep } from "./perimeter-router";
import { displayRoutes } from "./route-display";

// Fáze 76: obvodový router – modelová ložnice (zásuvky na spodní a horní stěně) vedle chodby s rozváděčem.

const corridor = { id: "m1", name: "Chodba", x: 0, y: 0, w: 2000, h: 3500 };
const bedroom = { id: "m2", name: "Ložnice", x: 2000, y: 0, w: 4000, h: 3500 };
const outline = (room: { x: number; y: number; w: number; h: number }) => [
  { x: room.x, y: room.y },
  { x: room.x + room.w, y: room.y },
  { x: room.x + room.w, y: room.y + room.h },
  { x: room.x, y: room.y + room.h },
];
const node = (id: string, x: number, y: number, room = "m2", heightMm = 300): RouteNode => ({ id, x, y, heightMm, room, floor: "f1" });
const panel = { x: 200, y: 1000, floor: "f1" };
// Zásuvky za postelí na horní stěně a na spodní stěně ložnice
const sockets = [node("z1", 3000, 0), node("z2", 5000, 0), node("z3", 5000, 3500), node("z4", 4000, 3500), node("z5", 3000, 3500)];

function bedroomRouter() {
  const rooms = [corridor, bedroom];
  const graph = buildWallGraph(wallSegments(rooms), { rooms });
  const metric = wallMetric(graph, MANHATTAN);
  return { metric, router: createPerimeterRouter({ rooms: rooms.map((room) => ({ id: room.id, floor: "f1", outline: outline(room) })), metric }) };
}

/** Protíná úsečka p → q vnitřní obdélník místnosti (mimo obvodový pás stěn)? */
function crossesInterior(p: { x: number; y: number }, q: { x: number; y: number }, room: typeof bedroom, band = WALL_BAND_MM) {
  const inner = { x1: room.x + band, y1: room.y + band, x2: room.x + room.w - band, y2: room.y + room.h - band };
  for (let step = 0; step <= 100; step++) {
    const x = p.x + ((q.x - p.x) * step) / 100;
    const y = p.y + ((q.y - p.y) * step) / 100;
    if (x > inner.x1 && x < inner.x2 && y > inner.y1 && y < inner.y2) return true;
  }
  return false;
}
const segmentsOf = (legs: readonly TreeLeg[]) => legs.flatMap((leg) => leg.points.slice(1).map((point, index) => [leg.points[index], point] as const));

describe("fáze 76 – obvodové řazení (perimeterSweep)", () => {
  it("vynechá největší mezeru: jeden směr, druhý směr nebo rozvětvení ze vstupu", () => {
    // Obvod 100, vstup na 0: body 10, 20 a 90 → rozvětvení (po směru 10, 20; proti směru 90), pokrytí 30
    expect(perimeterSweep([0, 10, 20, 90], 0, 100)).toEqual({ cw: [1, 2], ccw: [3], length: 30 });
    // Body jen za vstupem → jen po směru
    expect(perimeterSweep([0, 10, 20, 30], 0, 100)).toEqual({ cw: [1, 2, 3], ccw: [], length: 30 });
    // Body jen před vstupem → jen proti směru (nejbližší první)
    expect(perimeterSweep([50, 40, 30], 0, 100)).toEqual({ cw: [], ccw: [1, 2], length: 20 });
    // Shoda mezer → přednost jednomu směru
    expect(perimeterSweep([0, 25, 50, 75], 0, 100)).toEqual({ cw: [1, 2, 3], ccw: [], length: 75 });
  });

  it("dráha v odsazení 200 mm od líce stěny, u malé místnosti menší", () => {
    expect(insetOutline(outline(bedroom), TRACK_MM)).toEqual([
      { x: 2200, y: 200 },
      { x: 5800, y: 200 },
      { x: 5800, y: 3300 },
      { x: 2200, y: 3300 },
    ]);
    const small = insetOutline(outline({ x: 0, y: 0, w: 300, h: 2000 }), TRACK_MM);
    expect(small[0].x).toBe(100);
  });
});

describe("fáze 76 – obvodový router na modelové ložnici", () => {
  it("žádný úsek neprotne vnitřek ložnice, trasa oběhne místnost po pravé stěně a po stěně se nevrací", () => {
    const { router } = bedroomRouter();
    const legs = router(sockets, panel)!;
    expect(legs).not.toBeNull();
    // Strom: jediný přívod z rozváděče, každá zásuvka připojená právě jednou
    expect(legs.filter((leg) => leg.from === "panel")).toHaveLength(1);
    expect(legs.map((leg) => leg.to).sort()).toEqual(["z1", "z2", "z3", "z4", "z5"]);
    // Stupeň 3: žádná čára vnitřkem ložnice (mimo pás stěn 400 mm)
    for (const [p, q] of segmentsOf(legs)) expect(crossesInterior(p, q, bedroom)).toBe(false);
    // Stupeň 2: vstup u rozváděče (horní levá zásuvka), pak po směru – horní stěna, pravá stěna, spodní stěna zprava doleva
    expect(legs.map((leg) => `${leg.from}>${leg.to}`)).toEqual(["panel>z1", "z1>z2", "z2>z3", "z3>z4", "z4>z5"]);
    // Přechod z horní na spodní stěnu vede po pravé stěně v dráze 200 mm (x = 5800), ne středem
    const across = legs.find((leg) => leg.from === "z2")!;
    expect(across.points.some((point) => point.x === 5800 && point.y === 200)).toBe(true);
    expect(across.points.some((point) => point.x === 5800 && point.y === 3300)).toBe(true);
    // Stupeň 1: zásuvky na téže stěně v jedné ose dráhy (spodní stěna y = 3300)
    const bottom = legs.filter((leg) => leg.from === "z3" || leg.from === "z4");
    for (const leg of bottom) expect(leg.points.slice(1, -1).every((point) => point.y === 3300)).toBe(true);
    // Bez vracení: délka úseků v místnosti = obvod − největší mezera (15 m − 5,5 m), žádná stěna dvakrát
    const inside = legs.filter((leg) => leg.final);
    expect(inside.reduce((sum, leg) => sum + leg.horizontalMm, 0)).toBe(9500);
  });

  it("vstup uprostřed stěny: rozvětvení na obě strany bez dvojité čáry", () => {
    const { router } = bedroomRouter();
    // Rozváděč pod ložnicí u spodní stěny – nejbližší vstup je prostřední zásuvka spodní stěny
    const below = { x: 4000, y: 3700, floor: "f1" };
    const legs = router([node("a", 3000, 3500), node("b", 4000, 3500), node("c", 5000, 3500)], below)!;
    expect(legs.find((leg) => leg.from === "panel")?.to).toBe("b");
    expect(legs.filter((leg) => leg.from === "b").map((leg) => leg.to).sort()).toEqual(["a", "c"]);
    expect(legs.filter((leg) => leg.final).reduce((sum, leg) => sum + leg.horizontalMm, 0)).toBe(2000);
  });

  it("stropní svítidlo uprostřed: do vnitřku vede jen koncová odbočka", () => {
    const { router } = bedroomRouter();
    const legs = router([node("l1", 4000, 1750, "m2", 2600), node("z1", 3000, 0)], panel)!;
    const stub = legs.find((leg) => leg.to === "l1")!;
    // Jen úsek končící u svítidla vstoupí do vnitřku; ostatní zůstanou v pásu stěn
    for (const leg of legs.filter((leg) => leg !== stub)) for (const [p, q] of segmentsOf([leg])) expect(crossesInterior(p, q, bedroom)).toBe(false);
    expect(stub.points[stub.points.length - 1]).toMatchObject({ x: 4000, y: 1750 });
  });

  it("podlaží bez místností: obálka prvků skupiny, trasa po jejím obvodu", () => {
    const router = createPerimeterRouter({ rooms: [], metric: MANHATTAN });
    const legs = router([node("a", 0, 0, "m9"), node("b", 3000, 0, "m9"), node("c", 3000, 2000, "m9")], { x: -500, y: 0, floor: "f1" })!;
    expect(legs.map((leg) => `${leg.from}>${leg.to}`)).toEqual(["panel>a", "a>b", "b>c"]);
    expect(legs.filter((leg) => leg.final).reduce((sum, leg) => sum + leg.horizontalMm, 0)).toBe(5000);
  });

  it("výkaz kabeláže se stromem: délka ve všech režimech, nejdelší větev a vykreslení bez odsazení", () => {
    const { metric, router } = bedroomRouter();
    const summary = summarizeCabling({
      circuits: [{ id: "c1", label: "Zásuvky – Ložnice", cable: "CYKY-J 3x2,5", nodeIds: sockets.map((socket) => socket.id), kind: "sockets", phases: 1, crossSectionMm2: 2.5, protection: { ratedA: 16, curve: "B", poles: 1 } } as never],
      nodes: sockets,
      panel,
      profile: DEFAULT_ELEVATION,
      selected: "BOTTOM",
      metric,
      treeRouter: router,
    });
    const route = summary.circuits[0].route;
    expect(route.segments.filter((segment) => segment.final)).toHaveLength(4);
    // Spodem: přívod svisle z rozváděče + každá zásuvka dolů a zpět (koncová jen jednou)
    expect(route.longestMm).toBeLessThanOrEqual(route.totalMm);
    expect(summary.circuits[0].lengthsM.TOP).toBeGreaterThan(0);
  });
});

describe("fáze 76 – nákres: styl tras po stěnách (výchozí) a nejkratší v podlaze", () => {
  const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement =>
    ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra }) as EditorElement;
  const draft = (routeStyle: FloorplanDraft["routeStyle"]): FloorplanDraft => ({
    ...emptyDraft(),
    environment: "INDOOR_DRY",
    rooms: [corridor, bedroom],
    elements: [el("rh", "panel", 200, 1000, "Chodba", { rotation: 270 }), ...sockets.map((socket) => el(socket.id, "socket", socket.x, socket.y, "Ložnice", { rotation: socket.y === 0 ? 0 : 180 }))],
    routeStyle,
  });

  it("po stěnách: úseky v ložnici obvodově a na výkrese bez dalšího odsazení", () => {
    const analysis = analyzeDraft(draft("walls"));
    const circuit = analysis.summary.circuits.find((row) => row.route.segments.some((segment) => segment.to === "z1"))!;
    expect(circuit.route.segments.filter((segment) => segment.final).length).toBeGreaterThanOrEqual(4);
    const shown = displayRoutes(draft("walls"), analysis).circuits.find((row) => row.id === circuit.id)!;
    for (const leg of shown.legs.filter((leg) => leg.from !== "panel")) for (const [p, q] of leg.points.slice(1).map((point, index) => [leg.points[index], point] as const)) expect(crossesInterior(p, q, bedroom)).toBe(false);
  });

  it("nejkratší v podlaze: přímé pravoúhlé trasy bez grafu stěn", () => {
    const analysis = analyzeDraft(draft("direct"));
    expect(analysis.build.wallFloors).toEqual([]);
    expect(analysis.build.perimeterRooms).toEqual([]);
    expect(analysis.summary.circuits.every((row) => row.route.segments.every((segment) => !segment.final))).toBe(true);
  });
});
