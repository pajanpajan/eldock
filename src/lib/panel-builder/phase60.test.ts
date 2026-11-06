import { describe, expect, it } from "vitest";

import { analyzeDraft, buildPlan, emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { newAnnotation } from "./floorplan-frames";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

const room = { id: "m1", name: "Obývák", x: 0, y: 0, w: 8000, h: 5000 };

describe("fáze 60 – trasy podél stěn a pořadí nezávislé na kreslení", () => {
  it("s místnostmi vede trasa po stěnách (body na stěnách), bez místností pravoúhle", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), rooms: [room], elements: [el("rh", "panel", 0, 2500), el("z1", "socket", 8000, 2500)] };
    const build = buildPlan(draft);
    expect(build.wallFloors).toEqual([draft.floorId]);
    // Z levé stěny na pravou: po horní nebo dolní stěně (2,5 + 8 + 2,5 m), ne napříč místností (8 m)
    expect(build.metric.distance(build.panel, build.routeNodes[0])).toBe(13_000);
    const path = build.metric.path(build.panel, build.routeNodes[0]);
    expect(path.every((point) => point.x === 0 || point.x === 8000 || point.y === 0 || point.y === 5000)).toBe(true);
    const open = buildPlan({ ...draft, rooms: [] });
    expect(open.wallFloors).toEqual([]);
    expect(open.metric.distance(open.panel, open.routeNodes[0])).toBe(8000);
  });

  it("nová příčka zakreslená v Úpravě PDF je stěnou pro trasy", () => {
    const wall = newAnnotation("wall", { x: 0, y: 2500 }, { x: 8000, y: 2500 });
    const build = buildPlan({ ...emptyDraft(), rooms: [room], annotations: [wall], elements: [el("rh", "panel", 0, 2500), el("z1", "socket", 8000, 2500)] });
    expect(build.metric.distance(build.panel, build.routeNodes[0])).toBe(8000);
  });

  it("pořadí zásuvek v okruhu = nejkratší cesta bez ohledu na pořadí kreslení; výkaz ukáže úsporu", () => {
    const sockets = [6000, 1000, 7000, 2000, 4000].map((x, index) => el(`z${index}`, "socket", x, 0));
    const draft: FloorplanDraft = { ...emptyDraft(), rooms: [room], elements: [el("rh", "panel", 0, 0), ...sockets] };
    const { summary } = analyzeDraft(draft);
    const circuit = summary.circuits.find((row) => row.label.startsWith("Zásuvky"))!;
    expect(circuit.route.segments.map((segment) => segment.to)).toEqual(["z1", "z3", "z4", "z0", "z2"]);
    expect(summary.orderSavingM).toBeGreaterThan(0);
    // Totéž pro jiné pořadí kreslení
    const reversed = analyzeDraft({ ...draft, elements: [draft.elements[0], ...sockets.slice().reverse()] }).summary;
    expect(reversed.circuits.find((row) => row.label.startsWith("Zásuvky"))!.route.segments.map((segment) => segment.to)).toEqual(["z1", "z3", "z4", "z0", "z2"]);
    expect(reversed.totals.OPTIMIZED).toBe(summary.totals.OPTIMIZED);
  });
});
