import { describe, expect, it } from "vitest";

import { MANHATTAN } from "./cable-routing";
import { buildWallGraph, wallMetric, wallSegments } from "./wall-routing";

const rooms = [
  { x: 0, y: 0, w: 4000, h: 3000 },
  { x: 4000, y: 0, w: 3000, h: 3000 },
];

describe("fáze 60 – vedení kabelů podél stěn", () => {
  it("společná stěna sousedních místností je jedna úsečka grafu; trasa jde po stěnách, ne napříč místností", () => {
    const graph = buildWallGraph(wallSegments(rooms));
    // 6 rohů / styčných bodů (společná stěna se nezdvojí)
    expect(graph.nodes).toHaveLength(6);
    const metric = wallMetric(graph, MANHATTAN);
    // Levá stěna A → pravá stěna B: napříč by to bylo 7 m, po stěnách nahoru, podél stropu a dolů 10 m
    expect(metric.distance({ x: 0, y: 1500 }, { x: 7000, y: 1500 })).toBe(10_000);
    const path = metric.path({ x: 0, y: 1500 }, { x: 7000, y: 1500 });
    expect(path.every((point) => point.x === 0 || point.x === 7000 || point.y === 0 || point.y === 3000)).toBe(true);
    // Horní stěna A → dolní stěna B přes společnou stěnu (4000, 0)–(4000, 3000)
    expect(metric.distance({ x: 1000, y: 0 }, { x: 6000, y: 3000 })).toBe(8000);
  });

  it("nová příčka zkrátí trasu; svítidlo uprostřed se připojí kolmo k nejbližší stěně", () => {
    const partition = { x1: 0, y1: 1500, x2: 7000, y2: 1500 };
    const metric = wallMetric(buildWallGraph(wallSegments(rooms, [partition])), MANHATTAN);
    expect(metric.distance({ x: 0, y: 1500 }, { x: 7000, y: 1500 })).toBe(7000);
    // Svítidlo ve středu A (2000, 750): kolmice 750 mm k příčce nebo ke stropní stěně
    const light = metric.path({ x: 2000, y: 750 }, { x: 0, y: 1500 });
    expect(Math.round(Math.hypot(light[1].x - 2000, light[1].y - 750))).toBe(750);
  });

  it("mezera na tloušťku zdi se přemostí; bez stěn platí pravoúhlé měření", () => {
    const gap = buildWallGraph(wallSegments([rooms[0], { x: 4300, y: 0, w: 3000, h: 3000 }]));
    const metric = wallMetric(gap, MANHATTAN);
    expect(metric.distance({ x: 1000, y: 0 }, { x: 6000, y: 0 })).toBe(5000);
    const none = wallMetric(buildWallGraph([]), MANHATTAN);
    expect(none.distance({ x: 0, y: 0 }, { x: 3000, y: 4000 })).toBe(7000);
  });
});
