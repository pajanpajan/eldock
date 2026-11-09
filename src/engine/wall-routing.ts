// Fáze 60: vedení kabelů podél stěn. Ze stěn místností (obdélníky) a nově zakreslených příček vznikne rovinný graf
// (souběžné stěny sousedních místností se sloučí, úsečky se rozdělí v průsečících a styčných bodech, mezery do
// tloušťky zdi se přemostí). Trasa mezi dvěma body = kolmice ke stěně + nejkratší cesta po stěnách (Dijkstra)
// + kolmice k cíli – tak, jak se kabel skutečně vede v instalačních zónách podél stěn (ČSN 33 2130 ed. 4).
// Fáze 74: vnitřní stěna má vždy přednost – obvodová stěna (za ní do 0,7 m žádná místnost) stojí v hledání cesty
// `EXTERIOR_COST`× víc, délka kabelu zůstává skutečná; bod uprostřed místnosti (svítidlo) se smí připojit k blízké
// vnitřní stěně místo obvodové. Čisté funkce bez UI; měřidlo `wallMetric` se dosadí do `floorMetric` (cable-routing.ts).

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

export interface WallEdge {
  a: number;
  b: number;
  /** Skutečná délka úseku [mm]. */
  length: number;
  /** Fáze 74: obvodová stěna (za ní žádná místnost) – v hledání cesty `EXTERIOR_COST`× dražší. */
  exterior: boolean;
}

export interface WallGraph {
  nodes: Point[];
  /** Hrany grafu (úseky stěn) – indexy uzlů, délka [mm] a druh stěny. */
  edges: WallEdge[];
  adjacency: { to: number; edge: number }[][];
}

/** Fáze 74: místnost pro rozlišení vnitřní a obvodové stěny (obdélník nebo mnohoúhelník). */
export interface WallRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  points?: readonly Point[] | null;
}

/** Fáze 74: kolikrát je metr po obvodové stěně „dražší“ než po vnitřní (přednost vnitřních stěn). */
export const EXTERIOR_COST = 4;
/** Fáze 74: bod se smí připojit k vnitřní stěně místo obvodové, je-li kolmice k ní nejvýš o tolik delší (nebo nejvýš 1,5×). */
export const INTERIOR_ATTACH_MM = 600;
const costOf = (edge: WallEdge) => edge.length * (edge.exterior ? EXTERIOR_COST : 1);

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

/** Bod uvnitř místnosti (obdélník / mnohoúhelník, paprskový test). */
function insideRoom(room: WallRoom, point: Point): boolean {
  const polygon = room.points && room.points.length >= 3 ? room.points : null;
  if (!polygon) return point.x > room.x && point.x < room.x + room.w && point.y > room.y && point.y < room.y + room.h;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Fáze 74: obvodová stěna = na jedné její straně do `bridgeMm` není žádná místnost (vnější líc domu). Vnitřní stěna má
 * místnost po obou stranách (společná stěna, mezera na tloušťku zdi, příčka uvnitř místnosti).
 */
export function isExteriorWall(a: Point, b: Point, rooms: readonly WallRoom[], bridgeMm = BRIDGE_MM): boolean {
  const length = dist(a, b);
  if (length < EPS || !rooms.length) return false;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  const probes = [10, 150, 350, Math.max(20, bridgeMm - 10)];
  const occupied = (side: 1 | -1) => probes.some((offset) => rooms.some((room) => insideRoom(room, { x: mid.x + normal.x * offset * side, y: mid.y + normal.y * offset * side })));
  return !(occupied(1) && occupied(-1));
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
export function buildWallGraph(input: readonly WallSegment[], options: { bridgeMm?: number; rooms?: readonly WallRoom[] } = {}): WallGraph {
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
  const edges: WallEdge[] = [];
  const addEdge = (a: number, b: number, exterior = false) => {
    if (a === b) return;
    edges.push({ a, b, length: dist(nodes[a], nodes[b]), exterior });
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
  /** Přemostění mezery vede tloušťkou vnitřní zdi – nikdy obvodová stěna. */
  const bridges = new Set<WallEdge>();
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
        const first: WallEdge = { a: edge.a, b: split, length: dist(nodes[edge.a], nodes[split]), exterior: edge.exterior };
        edges[candidate.edge] = first;
        addEdge(split, edge.b, edge.exterior);
        if (bridges.delete(edge)) bridges.add(first).add(edges[edges.length - 1]);
      }
      const before = edges.length;
      addEdge(candidate.node, split);
      if (edges.length > before) bridges.add(edges[edges.length - 1]);
    }
  }
  // Fáze 74: druh stěny podle místností – obvodová stěna nemá za sebou místnost
  const rooms = options.rooms ?? [];
  if (rooms.length) for (const edge of edges) edge.exterior = !bridges.has(edge) && isExteriorWall(nodes[edge.a], nodes[edge.b], rooms, bridge);
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

/**
 * Místa připojení bodu ke stěně (kolmice): nejbližší stěna a – je-li obvodová – i nejbližší vnitřní stěna, pokud je
 * kolmice k ní nejvýš o `INTERIOR_ATTACH_MM` delší nebo nejvýš 1,5× delší (svítidlo uprostřed místnosti, prvek u rohu
 * s vnitřní stěnou). Bez stěn prázdné.
 */
function attachments(graph: WallGraph, point: Point): Attach[] {
  let best: Attach | null = null;
  let interior: Attach | null = null;
  for (const [e, edge] of graph.edges.entries()) {
    const projected = project(point, { x1: graph.nodes[edge.a].x, y1: graph.nodes[edge.a].y, x2: graph.nodes[edge.b].x, y2: graph.nodes[edge.b].y });
    const candidate = { edge: e, t: projected.t, at: projected.at, stub: projected.distance };
    if (!best || projected.distance < best.stub - 1e-9) best = candidate;
    if (!edge.exterior && (!interior || projected.distance < interior.stub - 1e-9)) interior = candidate;
  }
  if (!best) return [];
  if (!graph.edges[best.edge].exterior || !interior || interior.stub > Math.max(best.stub + INTERIOR_ATTACH_MM, best.stub * 1.5)) return [best];
  return [best, interior];
}

interface Search {
  from: Attach;
  distance: Float64Array;
  previous: Int32Array;
}

/** Dijkstra z místa na stěně (dva počáteční uzly hrany s částečnou cenou); obvodová stěna stojí `EXTERIOR_COST`×. */
function search(graph: WallGraph, from: Attach): Search {
  const count = graph.nodes.length;
  const distance = new Float64Array(count).fill(Infinity);
  const previous = new Int32Array(count).fill(-1);
  const done = new Uint8Array(count);
  const edge = graph.edges[from.edge];
  distance[edge.a] = from.t * costOf(edge);
  distance[edge.b] = (1 - from.t) * costOf(edge);
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
      const candidate = value + costOf(graph.edges[next.edge]);
      if (candidate < distance[next.to]) {
        distance[next.to] = candidate;
        previous[next.to] = node;
        push(next.to, candidate);
      }
    }
  }
  return { from, distance, previous };
}

const polylineLength = (points: readonly Point[]) => points.reduce((sum, point, index) => (index ? sum + dist(points[index - 1], point) : 0), 0);

/** Cena (přednost vnitřních stěn), skutečná délka a lomená čára po stěnách mezi dvěma místy na stěně. */
function along(graph: WallGraph, found: Search, to: Attach): { cost: number; length: number; points: Point[] } {
  const edge = graph.edges[to.edge];
  const viaA = found.distance[edge.a] + to.t * costOf(edge);
  const viaB = found.distance[edge.b] + (1 - to.t) * costOf(edge);
  const cost = Math.min(viaA, viaB);
  // Obě místa na téže hraně: přímo po ní
  const direct = Math.abs(to.t - found.from.t);
  if (to.edge === found.from.edge && direct * costOf(edge) <= cost) return { cost: direct * costOf(edge), length: direct * edge.length, points: [found.from.at, to.at] };
  if (!Number.isFinite(cost)) return { cost: Infinity, length: Infinity, points: [] };
  const chain: number[] = [];
  for (let node = viaA <= viaB ? edge.a : edge.b; node !== -1; node = found.previous[node]) chain.unshift(node);
  const points = [found.from.at, ...chain.map((node) => graph.nodes[node]), to.at];
  return { cost, length: polylineLength(points), points };
}

/**
 * Měřidlo tras podél stěn jednoho podlaží. Délka = kolmice ke stěně u zdroje + cesta po stěnách + kolmice k cíli;
 * bez stěn (nebo bez spojení) pravoúhle. Výsledky hledání se pamatují pro každý výchozí bod (výpočet jednoho nákresu).
 */
export function wallMetric(graph: WallGraph, fallback: RouteMetric): RouteMetric {
  if (!graph.edges.length) return fallback;
  const attached = new Map<string, Attach[]>();
  const searches = new Map<string, Search>();
  const key = (point: Point) => `${Math.round(point.x)}:${Math.round(point.y)}`;
  const attachOf = (point: Point) => {
    const k = key(point);
    if (!attached.has(k)) attached.set(k, attachments(graph, point));
    return attached.get(k)!;
  };
  const searchOf = (point: Point, from: Attach) => {
    const k = `${key(point)}|${from.edge}`;
    if (!searches.has(k)) searches.set(k, search(graph, from));
    return searches.get(k)!;
  };
  // Fáze 74: nejlevnější kombinace míst připojení (kolmice skutečnou délkou, stěny podle druhu); délka je skutečná
  const route = (a: RoutePoint, b: RoutePoint) => {
    let best: { cost: number; length: number; points: Point[] } | null = null;
    for (const from of attachOf(a)) {
      for (const to of attachOf(b)) {
        const result = along(graph, searchOf(a, from), to);
        if (!Number.isFinite(result.cost)) continue;
        const cost = from.stub + result.cost + to.stub;
        if (!best || cost < best.cost - 1e-6) best = { cost, length: from.stub + result.length + to.stub, points: [a, ...result.points, b] };
      }
    }
    return best;
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
