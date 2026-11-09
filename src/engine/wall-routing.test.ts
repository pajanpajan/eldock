import { describe, expect, it } from "vitest";

import { MANHATTAN } from "./cable-routing";
import { buildWallGraph, isExteriorWall, wallMetric, wallSegments } from "./wall-routing";

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

  it("fáze 74: obvodová a vnitřní stěna – společná stěna, mezera na tloušťku zdi i příčka jsou vnitřní", () => {
    const layout = [
      { x: 0, y: 0, w: 4000, h: 3000 },
      { x: 4300, y: 0, w: 3000, h: 3000 },
    ];
    // Levá stěna A je obvodová, pravá stěna A má za mezerou 300 mm místnost B → vnitřní
    expect(isExteriorWall({ x: 0, y: 0 }, { x: 0, y: 3000 }, layout)).toBe(true);
    expect(isExteriorWall({ x: 4000, y: 0 }, { x: 4000, y: 3000 }, layout)).toBe(false);
    expect(isExteriorWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, layout)).toBe(true);
    // Příčka uvnitř místnosti má místnost po obou stranách
    expect(isExteriorWall({ x: 0, y: 1500 }, { x: 4000, y: 1500 }, layout)).toBe(false);
    const graph = buildWallGraph(wallSegments(layout), { rooms: layout });
    expect(graph.edges.some((edge) => edge.exterior)).toBe(true);
    expect(graph.edges.some((edge) => !edge.exterior)).toBe(true);
  });

  it("fáze 74: při stejné délce vede trasa po vnitřní stěně, ne po obvodové", () => {
    // Pokoj A s vnitřní stěnou vpravo (pokoj B) a dole (pokoj C); nahoře a vlevo obvodové stěny
    const layout = [
      { x: 0, y: 0, w: 4000, h: 3000 },
      { x: 4000, y: 0, w: 4000, h: 3000 },
      { x: 0, y: 3000, w: 4000, h: 3000 },
    ];
    const metric = wallMetric(buildWallGraph(wallSegments(layout), { rooms: layout }), MANHATTAN);
    // Ze středu pravé (vnitřní) stěny ke středu levé (obvodové) stěny: horem i spodem 7 m – zvolí se spodní vnitřní stěna
    const from = { x: 4000, y: 1500 };
    const to = { x: 0, y: 1500 };
    expect(metric.distance(from, to)).toBe(7000);
    const path = metric.path(from, to);
    expect(path.some((point) => point.y === 3000)).toBe(true);
    expect(path.some((point) => point.y === 0)).toBe(false);
    // Bez rozlišení stěn (starší výpočet) je délka stejná
    expect(wallMetric(buildWallGraph(wallSegments(layout)), MANHATTAN).distance(from, to)).toBe(7000);
  });

  it("fáze 74: obvodová stěna se použije, jen když jinak nejde – délka kabelu je vždy skutečná", () => {
    const layout = [
      { x: 0, y: 0, w: 2000, h: 6000 },
      { x: 2000, y: 0, w: 6000, h: 6000 },
    ];
    const metric = wallMetric(buildWallGraph(wallSegments(layout), { rooms: layout }), MANHATTAN);
    // Svítidlo u obvodové stěny daleko od vnitřní stěny: po vnitřní stěně nahoru, pak po obvodové a kolmo ke svítidlu
    expect(metric.distance({ x: 2000, y: 300 }, { x: 5000, y: 900 })).toBe(300 + 3000 + 900);
    // Svítidlo blízko vnitřní stěny se připojí k ní (kolmice 1 m místo 0,9 m k obvodové stěně a 1 m po ní)
    const path = metric.path({ x: 2000, y: 2500 }, { x: 3000, y: 900 });
    expect(path.some((point) => point.y === 0)).toBe(false);
    expect(metric.distance({ x: 2000, y: 2500 }, { x: 3000, y: 900 })).toBe(1600 + 1000);
  });

  it("mezera na tloušťku zdi se přemostí; bez stěn platí pravoúhlé měření", () => {
    const gap = buildWallGraph(wallSegments([rooms[0], { x: 4300, y: 0, w: 3000, h: 3000 }]));
    const metric = wallMetric(gap, MANHATTAN);
    expect(metric.distance({ x: 1000, y: 0 }, { x: 6000, y: 0 })).toBe(5000);
    const none = wallMetric(buildWallGraph([]), MANHATTAN);
    expect(none.distance({ x: 0, y: 0 }, { x: 3000, y: 4000 })).toBe(7000);
  });
});
