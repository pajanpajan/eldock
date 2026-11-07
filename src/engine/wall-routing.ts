// Fáze 60: vedení kabelů podél stěn. Ze stěn místností (obdélníky) a nově zakreslených příček vznikne rovinný graf
// (souběžné stěny sousedních místností se sloučí, úsečky se rozdělí v průsečících a styčných bodech, mezery do
// tloušťky zdi se přemostí). Trasa mezi dvěma body = kolmice ke stěně + nejkratší cesta po stěnách (Dijkstra)
// + kolmice k cíli – tak, jak se kabel skutečně vede v instalačních zónách podél stěn (ČSN 33 2130 ed. 4).
// Čisté funkce bez UI; měřidlo `wallMetric` se dosadí do `floorMetric` (cable-routing.ts).

import type { RouteMetric, RoutePoint } from "./cable-routing";

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Point {
  x: number;
  y: number;
}

export interface WallGraph {
  nodes: Point[];
  /** Hrany grafu (úseky stěn) – indexy uzlů a délka [mm]. */
  edges: { a: number; b: number; length: number }[];
  adjacency: { to: number; edge: number }[][];
}

/** Tolerance shody souřadnic [mm] (rastr editoru je 50 mm, podklad z PDF může mít drobné odchylky). */
const EPS = 2;
/** Výchozí přemostění mezery mezi místnostmi (tloušťka zdi) [mm]. */
export const BRIDGE_MM = 700;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Stěny místností (4 hrany obdélníku, fáze 63: hrany mnohoúhelníku se šikmými stěnami) a nové příčky jako úsečky. */
export function wallSegments(rooms: readonly { x: number; y: number; w: number; h: number; points?: readonly Point[] | null }[], partitions: readonly WallSegment[] = []): WallSegment[] {
  const edges = rooms.flatMap((room) =>
    room.points && room.points.length >= 3
      ? room.points.map((point, index) => {
          const next = room.points![(index + 1) % room.points!.length];
          return { x1: point.x, y1: point.y, x2: next.x, y2: next.y };
        })
      : [
          { x1: room.x, y1: room.y, x2: room.x + room.w, y2: room.y },
          { x1: room.x + room.w, y1: room.y, x2: room.x + room.w, y2: room.y + room.h },
          { x1: room.x, y1: room.y + room.h, x2: room.x + room.w, y2: room.y + room.h },
          { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.h },
        ],
  );
  return [...edges, ...partitions].filter((segment) => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > EPS);
}

/** Sloučení souběžných překrývajících se vodorovných / svislých úseček (společná stěna sousedních místností). */
function mergeCollinear(segments: readonly WallSegment[]): WallSegment[] {
  const horizontal = new Map<number, [number, number][]>();
  const vertical = new Map<number, [number, number][]>();
  const other: WallSegment[] = [];
  const bucket = (value: number) => Math.round(value / EPS) * EPS;
  for (const segment of segments) {
    if (Math.abs(segment.y2 - segment.y1) <= EPS) {
      const key = bucket((segment.y1 + segment.y2) / 2);
      horizontal.set(key, [...(horizontal.get(key) ?? []), [Math.min(segment.x1, segment.x2), Math.max(segment.x1, segment.x2)]]);
    } else if (Math.abs(segment.x2 - segment.x1) <= EPS) {
      const key = bucket((segment.x1 + segment.x2) / 2);
      vertical.set(key, [...(vertical.get(key) ?? []), [Math.min(segment.y1, segment.y2), Math.max(segment.y1, segment.y2)]]);
    } else other.push(segment);
  }
  const merge = (intervals: [number, number][]) => {
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    for (const [from, to] of sorted) {
      const last = out[out.length - 1];
      if (last && from <= last[1] + EPS) last[1] = Math.max(last[1], to);
      else out.push([from, to]);
    }
    return out;
  };
  return [
    ...[...horizontal.entries()].flatMap(([y, intervals]) => merge(intervals).map(([x1, x2]) => ({ x1, y1: y, x2, y2: y }))),
    ...[...vertical.entries()].flatMap(([x, intervals]) => merge(intervals).map(([y1, y2]) => ({ x1: x, y1, x2: x, y2 }))),
    ...other,
  ];
}

/** Parametr t průsečíku dvou úseček na první z nich (nebo null). */
function intersection(a: WallSegment, b: WallSegment): number | null {
  const rx = a.x2 - a.x1;
  const ry = a.y2 - a.y1;
  const sx = b.x2 - b.x1;
  const sy = b.y2 - b.y1;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((b.x1 - a.x1) * sy - (b.y1 - a.y1) * sx) / denominator;
  const u = ((b.x1 - a.x1) * ry - (b.y1 - a.y1) * rx) / denominator;
  const tolA = EPS / (Math.hypot(rx, ry) || 1);
  const tolB = EPS / (Math.hypot(sx, sy) || 1);
  return t >= -tolA && t <= 1 + tolA && u >= -tolB && u <= 1 + tolB ? Math.min(1, Math.max(0, t)) : null;
}

/** Kolmý průmět bodu na úsečku: parametr t ∈ [0, 1], bod a vzdálenost. */
function project(point: Point, segment: WallSegment) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const length2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / length2));
  const at = { x: segment.x1 + dx * t, y: segment.y1 + dy * t };
  return { t, at, distance: dist(point, at) };
}

/**
 * Rovinný graf stěn: sloučení souběžných stěn, rozdělení úseček v průsečících a v koncových bodech jiných stěn
 * (T-spoj), přemostění mezer mezi místnostmi do `bridgeMm` (tloušťka zdi / nepřesný zákres).
 */
export function buildWallGraph(input: readonly WallSegment[], options: { bridgeMm?: number } = {}): WallGraph {
  const segments = mergeCollinear(input);
  const nodes: Point[] = [];
  const index = new Map<string, number>();
  const nodeAt = (point: Point) => {
    const key = `${Math.round(point.x / EPS)}:${Math.round(point.y / EPS)}`;
    const found = index.get(key);
    if (found !== undefined) return found;
    nodes.push({ x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 });
    index.set(key, nodes.length - 1);
    return nodes.length - 1;
  };
  const edges: WallGraph["edges"] = [];
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    edges.push({ a, b, length: dist(nodes[a], nodes[b]) });
  };
  for (const [i, segment] of segments.entries()) {
    const cuts = new Set<number>([0, 1]);
    for (const [j, other] of segments.entries()) {
      if (i === j) continue;
      const t = intersection(segment, other);
      if (t !== null) cuts.add(Math.round(t * 1e6) / 1e6);
      // T-spoj: konec jiné stěny leží na této úsečce
      for (const end of [
        { x: other.x1, y: other.y1 },
        { x: other.x2, y: other.y2 },
      ]) {
        const projected = project(end, segment);
        if (projected.distance <= EPS) cuts.add(Math.round(projected.t * 1e6) / 1e6);
      }
    }
    const points = [...cuts].sort((a, b) => a - b).map((t) => nodeAt({ x: segment.x1 + (segment.x2 - segment.x1) * t, y: segment.y1 + (segment.y2 - segment.y1) * t }));
    for (let k = 1; k < points.length; k++) addEdge(points[k - 1], points[k]);
  }
  // Přemostění mezer mezi komponentami (místnosti nakreslené s mezerou na tloušťku zdi)
  const bridge = options.bridgeMm ?? BRIDGE_MM;
  for (let pass = 0; pass < 6; pass++) {
    const component = components(nodes.length, edges);
    if (new Set(component).size <= 1) break;
    const best = new Map<string, { node: number; edge: number; at: Point; t: number; distance: number }>();
    for (let n = 0; n < nodes.length; n++) {
      for (const [e, edge] of edges.entries()) {
        if (component[edge.a] === component[n]) continue;
        const projected = project(nodes[n], { x1: nodes[edge.a].x, y1: nodes[edge.a].y, x2: nodes[edge.b].x, y2: nodes[edge.b].y });
        if (projected.distance > bridge) continue;
        const key = [component[n], component[edge.a]].sort((a, b) => a - b).join("|");
        const current = best.get(key);
        if (!current || projected.distance < current.distance) best.set(key, { node: n, edge: e, at: projected.at, t: projected.t, distance: projected.distance });
      }
    }
    if (!best.size) break;
    for (const candidate of best.values()) {
      const edge = edges[candidate.edge];
      const split = candidate.t <= 1e-6 ? edge.a : candidate.t >= 1 - 1e-6 ? edge.b : nodeAt(candidate.at);
      if (split !== edge.a && split !== edge.b) {
        edges[candidate.edge] = { a: edge.a, b: split, length: dist(nodes[edge.a], nodes[split]) };
        addEdge(split, edge.b);
      }
      addEdge(candidate.node, split);
    }
  }
  const adjacency: WallGraph["adjacency"] = nodes.map(() => []);
  for (const [e, edge] of edges.entries()) {
    adjacency[edge.a].push({ to: edge.b, edge: e });
    adjacency[edge.b].push({ to: edge.a, edge: e });
  }
  return { nodes, edges, adjacency };
}

function components(count: number, edges: readonly { a: number; b: number }[]): number[] {
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const edge of edges) parent[find(edge.a)] = find(edge.b);
  return parent.map((_, i) => find(i));
}

interface Attach {
  edge: number;
  t: number;
  at: Point;
  stub: number;
}

/** Nejbližší místo na stěně pro bod (kolmice ke stěně); bez stěn null. */
function attach(graph: WallGraph, point: Point): Attach | null {
  let best: Attach | null = null;
  for (const [e, edge] of graph.edges.entries()) {
    const projected = project(point, { x1: graph.nodes[edge.a].x, y1: graph.nodes[edge.a].y, x2: graph.nodes[edge.b].x, y2: graph.nodes[edge.b].y });
    if (!best || projected.distance < best.stub - 1e-9) best = { edge: e, t: projected.t, at: projected.at, stub: projected.distance };
  }
  return best;
}

interface Search {
  from: Attach;
  distance: Float64Array;
  previous: Int32Array;
}

/** Dijkstra z místa na stěně (dva počáteční uzly hrany s částečnou délkou). */
function search(graph: WallGraph, from: Attach): Search {
  const count = graph.nodes.length;
  const distance = new Float64Array(count).fill(Infinity);
  const previous = new Int32Array(count).fill(-1);
  const done = new Uint8Array(count);
  const edge = graph.edges[from.edge];
  distance[edge.a] = from.t * edge.length;
  distance[edge.b] = (1 - from.t) * edge.length;
  // Jednoduchá prioritní fronta (binární halda)
  const heap: [number, number][] = [];
  const push = (node: number, value: number) => {
    heap.push([value, node]);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  push(edge.a, distance[edge.a]);
  push(edge.b, distance[edge.b]);
  while (heap.length) {
    const [value, node] = pop();
    if (done[node] || value > distance[node]) continue;
    done[node] = 1;
    for (const next of graph.adjacency[node]) {
      const candidate = value + graph.edges[next.edge].length;
      if (candidate < distance[next.to]) {
        distance[next.to] = candidate;
        previous[next.to] = node;
        push(next.to, candidate);
      }
    }
  }
  return { from, distance, previous };
}

/** Délka a lomená čára po stěnách mezi dvěma místy na stěně. */
function along(graph: WallGraph, found: Search, to: Attach): { length: number; points: Point[] } {
  const edge = graph.edges[to.edge];
  const viaA = found.distance[edge.a] + to.t * edge.length;
  const viaB = found.distance[edge.b] + (1 - to.t) * edge.length;
  let length = Math.min(viaA, viaB);
  // Obě místa na téže hraně: přímo po ní
  if (to.edge === found.from.edge && Math.abs(to.t - found.from.t) * edge.length <= length) return { length: Math.abs(to.t - found.from.t) * edge.length, points: [found.from.at, to.at] };
  if (!Number.isFinite(length)) return { length: Infinity, points: [] };
  const chain: number[] = [];
  for (let node = viaA <= viaB ? edge.a : edge.b; node !== -1; node = found.previous[node]) chain.unshift(node);
  length = Math.min(viaA, viaB);
  return { length, points: [found.from.at, ...chain.map((node) => graph.nodes[node]), to.at] };
}

/**
 * Měřidlo tras podél stěn jednoho podlaží. Délka = kolmice ke stěně u zdroje + cesta po stěnách + kolmice k cíli;
 * bez stěn (nebo bez spojení) pravoúhle. Výsledky hledání se pamatují pro každý výchozí bod (výpočet jednoho nákresu).
 */
export function wallMetric(graph: WallGraph, fallback: RouteMetric): RouteMetric {
  if (!graph.edges.length) return fallback;
  const attachments = new Map<string, Attach | null>();
  const searches = new Map<string, Search>();
  const key = (point: Point) => `${Math.round(point.x)}:${Math.round(point.y)}`;
  const attachOf = (point: Point) => {
    const k = key(point);
    if (!attachments.has(k)) attachments.set(k, attach(graph, point));
    return attachments.get(k)!;
  };
  const searchOf = (point: Point, from: Attach) => {
    const k = key(point);
    if (!searches.has(k)) searches.set(k, search(graph, from));
    return searches.get(k)!;
  };
  const route = (a: RoutePoint, b: RoutePoint) => {
    const from = attachOf(a);
    const to = attachOf(b);
    if (!from || !to) return null;
    const result = along(graph, searchOf(a, from), to);
    if (!Number.isFinite(result.length)) return null;
    return { length: from.stub + result.length + to.stub, points: [a, ...result.points, b] };
  };
  return {
    distance(a, b) {
      if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) return 0;
      const found = route(a, b);
      return found ? Math.round(found.length) : fallback.distance(a, b);
    },
    path(a, b) {
      const found = route(a, b);
      if (!found) return fallback.path(a, b);
      // Bez duplicitních bodů (kolmice nulové délky), podlaží převezme od výchozího bodu
      const points: RoutePoint[] = [];
      for (const point of found.points) {
        const last = points[points.length - 1];
        if (!last || Math.abs(last.x - point.x) > 0.5 || Math.abs(last.y - point.y) > 0.5) points.push({ x: point.x, y: point.y, floor: a.floor });
      }
      return points.length >= 2 ? points : [a, b];
    },
  };
}
