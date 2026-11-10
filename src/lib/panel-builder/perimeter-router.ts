// Fáze 76: obvodový router kabelů 2D půdorysu (zadání A, 4 stupně):
//  1. vodicí dráha podél stěny – obvod místnosti (nakreslená místnost, na podlaží bez místností obálka prvků skupiny);
//     prvky na téže stěně sdílejí jednu osu dráhy, takže mezi sousedními zásuvkami nevzniká odskok,
//  2. obvodové řazení – prvky místnosti promítnuté na obvod (souřadnice s); ze vstupního prvku kabel vede po směru,
//     proti směru nebo oběma směry podle nejkratšího pokrytí obvodu (obvod − největší mezera) – nikdy se po stěně nevrací,
//  3. zákaz průchodu vnitřkem – spoje uvnitř místnosti jen po dráze přes rohy; do vnitřku vede jen odbočka k prvku,
//     který stojí uprostřed místnosti (stropní svítidlo, podlahová krabice),
//  4. páteř – z rozváděče do první místnosti a mezi místnostmi po stěnách (měřidlo `wallMetric` s předností vnitřních stěn);
//     vstupní prvek místnosti je ten, u kterého je přívod + pokrytí obvodu nejkratší, okruh má jediný přívod z rozváděče.
// Délky se měří po líci stěny (stejně jako dosud), kreslí se v dráze `TRACK_MM` od stěny s kolmou odbočkou k prvku.
// Výstup je strom úseků pro `summarizeCabling` (`treeRouter`). Čisté funkce bez UI.

import type { CircuitTreeRouter, RouteMetric, RouteNode, RoutePoint, TreeLeg } from "@/engine/cable-routing";
import { cleanPolyline, type PlanPoint } from "@/engine/route-geometry";

/** Odsazení kreslené dráhy od stěny do místnosti [mm] – stejné jako u ostatních tras (`WALL_INSET_MM`). */
export const TRACK_MM = 200;
/** Obvodový pás stěn [mm]: prvek dál od stěny stojí ve vnitřku místnosti (vede k němu jen odbočka). */
export const WALL_BAND_MM = 400;

export interface PerimeterRoom {
  /** Místnost výpočtu (`RouteNode.room`). */
  id: string;
  floor: string;
  /** Obrys nakreslené místnosti (rohy v libovolném směru oběhu). */
  outline: readonly PlanPoint[];
}

export interface PerimeterRouterInput {
  rooms: readonly PerimeterRoom[];
  /** Měřidlo páteře (rozváděč → místnost, místnost → místnost): podél stěn, přes stoupací vedení mezi podlažími. */
  metric: RouteMetric;
  /** Odsazení kreslené dráhy [mm]. */
  track?: number;
}

// ---------------------------------------------------------------------------
//  Geometrie obvodu (uzavřená lomená čára s délkovou souřadnicí s)
// ---------------------------------------------------------------------------

export interface Loop {
  points: PlanPoint[];
  /** Souřadnice s každého vrcholu (od vrcholu 0 ve směru oběhu). */
  cum: number[];
  total: number;
}

const dist = (a: PlanPoint, b: PlanPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const mod = (value: number, total: number) => ((value % total) + total) % total;

/** Plocha se znaménkem (kladná = vnitřek vlevo od každé hrany v souřadnicích výkresu). */
function signedArea(points: readonly PlanPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Obrys bez opakovaných bodů ve směru oběhu s kladnou plochou. */
function oriented(points: readonly PlanPoint[]): PlanPoint[] {
  const unique = points.filter((point, index) => index === 0 || dist(point, points[index - 1]) > 0.5).map((point) => ({ x: point.x, y: point.y }));
  if (unique.length > 2 && dist(unique[0], unique[unique.length - 1]) <= 0.5) unique.pop();
  return signedArea(unique) < 0 ? unique.reverse() : unique;
}

/** Obrys posunutý o `inset` dovnitř (průsečíky sousedních posunutých hran); u malé místnosti menší odsazení. */
export function insetOutline(points: readonly PlanPoint[], inset: number): PlanPoint[] {
  const polygon = oriented(points);
  if (polygon.length < 3 || inset <= 0) return polygon;
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const room = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const amount = Math.max(0, Math.min(inset, room / 2 - 50));
  if (amount <= 0) return polygon;
  const offsetEdge = (a: PlanPoint, b: PlanPoint) => {
    const length = dist(a, b) || 1;
    // Kladná plocha → vnitřek vlevo: normála (−dy, dx)
    const n = { x: (-(b.y - a.y) / length) * amount, y: ((b.x - a.x) / length) * amount };
    return { a: { x: a.x + n.x, y: a.y + n.y }, d: { x: b.x - a.x, y: b.y - a.y } };
  };
  const edges = polygon.map((point, index) => offsetEdge(point, polygon[(index + 1) % polygon.length]));
  return polygon.map((point, index) => {
    const before = edges[(index - 1 + edges.length) % edges.length];
    const after = edges[index];
    const cross = before.d.x * after.d.y - before.d.y * after.d.x;
    if (Math.abs(cross) < 1e-6) return after.a;
    const t = ((after.a.x - before.a.x) * after.d.y - (after.a.y - before.a.y) * after.d.x) / cross;
    return { x: before.a.x + before.d.x * t, y: before.a.y + before.d.y * t };
  });
}

export function loopOf(points: readonly PlanPoint[]): Loop {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  const total = cum[points.length - 1] + dist(points[points.length - 1], points[0]);
  return { points: [...points], cum, total };
}

/** Nejbližší bod obvodu k bodu: souřadnice s, bod a vzdálenost (délka kolmé odbočky). */
export function locate(loop: Loop, point: PlanPoint): { s: number; at: PlanPoint; distance: number } {
  let best = { s: 0, at: loop.points[0], distance: Infinity };
  for (let i = 0; i < loop.points.length; i++) {
    const a = loop.points[i];
    const b = loop.points[(i + 1) % loop.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
    const at = { x: a.x + dx * t, y: a.y + dy * t };
    const distance = dist(point, at);
    if (distance < best.distance - 1e-6) best = { s: loop.cum[i] + t * Math.sqrt(length2), at, distance };
  }
  return best;
}

/** Délka po obvodu z s1 do s2 ve směru oběhu (dir = 1) nebo proti němu (dir = −1). */
export const arcLength = (loop: Loop, s1: number, s2: number, dir: 1 | -1) => (dir === 1 ? mod(s2 - s1, loop.total) : mod(s1 - s2, loop.total));

function pointAt(loop: Loop, s: number): PlanPoint {
  const at = mod(s, loop.total);
  for (let i = loop.points.length - 1; i >= 0; i--) {
    if (at >= loop.cum[i] - 1e-9) {
      const a = loop.points[i];
      const b = loop.points[(i + 1) % loop.points.length];
      const length = dist(a, b) || 1;
      const t = (at - loop.cum[i]) / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return loop.points[0];
}

/** Lomená čára po obvodu z s1 do s2 ve zvoleném směru (s vrcholy, přes které vede). */
export function arcPath(loop: Loop, s1: number, s2: number, dir: 1 | -1): PlanPoint[] {
  const length = arcLength(loop, s1, s2, dir);
  const out: PlanPoint[] = [pointAt(loop, s1)];
  const vertices = loop.cum.map((s, index) => ({ index, along: arcLength(loop, s1, s, dir) })).filter((vertex) => vertex.along > 1e-6 && vertex.along < length - 1e-6);
  vertices.sort((a, b) => a.along - b.along);
  for (const vertex of vertices) out.push(loop.points[vertex.index]);
  out.push(pointAt(loop, s2));
  return out;
}

// ---------------------------------------------------------------------------
//  Stupeň 2: obvodové řazení ze vstupního bodu
// ---------------------------------------------------------------------------

export interface Sweep {
  /** Prvky po směru oběhu od vstupu (indexy v pořadí průchodu). */
  cw: number[];
  /** Prvky proti směru oběhu od vstupu (indexy v pořadí průchodu). */
  ccw: number[];
  /** Délka pokrytí obvodu = obvod − největší mezera mezi sousedními body (včetně vstupu) [mm]. */
  length: number;
}

/**
 * Obvodové řazení: ze vstupu `entry` (index v `positions`) se obvod pokryje nejkratší souvislou částí – po směru,
 * proti směru, nebo oběma směry ze vstupu; vynechá se největší mezera. Při shodě se dává přednost jednomu směru.
 */
export function perimeterSweep(positions: readonly number[], entry: number, total: number): Sweep {
  const origin = positions[entry];
  const others = positions
    .map((s, index) => ({ index, d: mod(s - origin, total) }))
    .filter((point) => point.index !== entry)
    .sort((a, b) => a.d - b.d || a.index - b.index);
  if (!others.length || total <= 0) return { cw: [], ccw: [], length: 0 };
  const marks = [0, ...others.map((point) => point.d), total];
  const gaps = marks.slice(1).map((mark, k) => ({ k: k + 1, gap: mark - marks[k] }));
  const widest = Math.max(...gaps.map((gap) => gap.gap));
  // Shoda do 10 mm: jen po směru (mezera za posledním), jen proti směru (mezera před prvním), jinak rozvětvení
  const tied = gaps.filter((gap) => gap.gap >= widest - 10);
  const pick = tied.find((gap) => gap.k === marks.length - 1) ?? tied.find((gap) => gap.k === 1) ?? tied[0];
  return {
    cw: others.slice(0, pick.k - 1).map((point) => point.index),
    ccw: others
      .slice(pick.k - 1)
      .reverse()
      .map((point) => point.index),
    length: total - pick.gap,
  };
}

// ---------------------------------------------------------------------------
//  Router okruhu
// ---------------------------------------------------------------------------

interface Group {
  nodes: RouteNode[];
  /** Obvod po líci stěny (délky) a kreslená dráha (výkres); bez obvodu = samostatný bod. */
  outline: Loop | null;
  track: Loop | null;
  s: number[];
  stub: number[];
  trackS: number[];
  trackAt: PlanPoint[];
}

const roomKey = (node: RouteNode) => `${node.floor ?? ""}|${node.room}`;

/** Obálka prvků skupiny (podlaží bez nakreslených místností) – degenerovaná na úsečku, pokud prvky leží v řadě. */
function inferredBox(nodes: readonly RouteNode[]): PlanPoint[] | null {
  if (nodes.length < 2) return null;
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const box = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  if (box.x2 - box.x1 < 1 && box.y2 - box.y1 < 1) return null;
  return [
    { x: box.x1, y: box.y1 },
    { x: box.x2, y: box.y1 },
    { x: box.x2, y: box.y2 },
    { x: box.x1, y: box.y2 },
  ];
}

function groupOf(nodes: RouteNode[], outline: readonly PlanPoint[] | null, inset: number): Group {
  if (!outline) return { nodes, outline: null, track: null, s: [], stub: [], trackS: [], trackAt: [] };
  const wall = loopOf(oriented(outline));
  const track = inset > 0 ? loopOf(insetOutline(outline, inset)) : wall;
  const onWall = nodes.map((node) => locate(wall, node));
  const onTrack = nodes.map((node) => locate(track, node));
  return { nodes, outline: wall, track, s: onWall.map((hit) => hit.s), stub: onWall.map((hit) => hit.distance), trackS: onTrack.map((hit) => hit.s), trackAt: onTrack.map((hit) => hit.at) };
}

/** Úseky jedné větve z prvku `from` přes `order` ve směru `dir` (délka po líci stěny, kresba po dráze). */
function branchLegs(group: Group, from: number, order: readonly number[], dir: 1 | -1): TreeLeg[] {
  const legs: TreeLeg[] = [];
  let previous = from;
  for (const next of order) {
    const a = group.nodes[previous];
    const b = group.nodes[next];
    const floor = a.floor;
    // Víceramček / vícenásobná zásuvka: propojení přímo v sousedních krabicích
    if (a.frame && a.frame === b.frame) {
      legs.push({ from: a.id, to: b.id, horizontalMm: Math.round(dist(a, b)), points: [a, b].map((point) => ({ x: point.x, y: point.y, floor })), final: true });
    } else {
      const horizontal = group.stub[previous] + arcLength(group.outline!, group.s[previous], group.s[next], dir) + group.stub[next];
      const path = cleanPolyline([a, group.trackAt[previous], ...arcPath(group.track!, group.trackS[previous], group.trackS[next], dir), group.trackAt[next], b]);
      legs.push({ from: a.id, to: b.id, horizontalMm: Math.round(horizontal), points: path.map((point) => ({ x: point.x, y: point.y, floor })), final: true });
    }
    previous = next;
  }
  return legs;
}

/**
 * Obvodový router: prvky okruhu po místnostech, páteř z rozváděče a mezi místnostmi po stěnách, uvnitř místnosti
 * obvodové řazení po dráze. Místnosti se připojují postupně – vždy ta, kterou jde připojit nejkratším přívodem
 * + pokrytím obvodu (první z rozváděče, další z kteréhokoli už připojeného prvku).
 */
export function createPerimeterRouter(input: PerimeterRouterInput): CircuitTreeRouter {
  const inset = input.track ?? TRACK_MM;
  const rooms = new Map(input.rooms.map((room) => [`${room.floor}|${room.id}`, room]));
  const floorsWithRooms = new Set(input.rooms.map((room) => room.floor));
  const metric = input.metric;
  return (nodes: readonly RouteNode[], origin: RoutePoint) => {
    if (!nodes.length) return null;
    // Skupiny po místnostech; prvky mimo nakreslenou místnost na podlaží s místnostmi = samostatné body
    const byRoom = new Map<string, RouteNode[]>();
    for (const node of nodes) byRoom.set(roomKey(node), [...(byRoom.get(roomKey(node)) ?? []), node]);
    const groups: Group[] = [];
    for (const [key, members] of byRoom) {
      const room = rooms.get(key);
      if (room) groups.push(groupOf(members, room.outline, inset));
      else if (!floorsWithRooms.has(members[0].floor ?? "")) groups.push(groupOf(members, inferredBox(members), 0));
      else for (const member of members) groups.push(groupOf([member], null, inset));
    }
    const coverage = (group: Group, entry: number) => (group.outline ? perimeterSweep(group.s, entry, group.outline.total) : { cw: [], ccw: [], length: 0 });
    const legs: TreeLeg[] = [];
    let upstream: { id: string; point: RoutePoint }[] = [{ id: "panel", point: origin }];
    const pending = [...groups];
    while (pending.length) {
      let best: { group: number; entry: number; from: { id: string; point: RoutePoint }; cost: number; sweep: Sweep } | null = null;
      for (const [g, group] of pending.entries()) {
        for (let entry = 0; entry < group.nodes.length; entry++) {
          const sweep = coverage(group, entry);
          for (const from of upstream) {
            const cost = metric.distance(from.point, group.nodes[entry]) + sweep.length;
            if (!best || cost < best.cost - 1e-6) best = { group: g, entry, from, cost, sweep };
          }
        }
      }
      if (!best) break;
      const [group] = pending.splice(best.group, 1);
      const entryNode = group.nodes[best.entry];
      // Páteř: rozváděč / už připojený prvek → vstupní prvek místnosti po stěnách (výkres ji odsadí do místnosti)
      legs.push({ from: best.from.id, to: entryNode.id, horizontalMm: Math.round(metric.distance(best.from.point, entryNode)), points: metric.path(best.from.point, entryNode), final: false });
      legs.push(...branchLegs(group, best.entry, best.sweep.cw, 1), ...branchLegs(group, best.entry, best.sweep.ccw, -1));
      // Okruh má jediný přívod z rozváděče – další místnosti navazují na už připojené prvky
      if (upstream.length === 1 && upstream[0].id === "panel") upstream = [];
      upstream.push(...group.nodes.map((node) => ({ id: node.id, point: node as RoutePoint })));
    }
    return legs;
  };
}
