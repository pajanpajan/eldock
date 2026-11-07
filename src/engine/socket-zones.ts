// Fáze 65: rozdělení běžných zásuvek do okruhů (ČSN 33 2130 ed. 4: nejvýš 10 zásuvek na okruh B16A, dvojzásuvka = 2).
//
// - „compact“ (výchozí v půdorysu) = kompaktní zóny: zásuvky v pořadí nejkratší trasy – místnosti v pořadí sousedství od
//   rozváděče, uvnitř místnosti nejkratší průchod. Okruh = souvislý úsek té trasy: místnost se nedělí, pokud se vejde,
//   sousední malé místnosti (mezera do 8 m) se spojí, velká místnost i půdorys bez zakreslených místností se rozdělí na
//   vyvážené souvislé úseky. Okruh tak nikdy nesbírá zásuvky na protilehlých koncích bytu.
// - „rooms“ = každá místnost vlastní okruh(y), velká místnost na souvislé úseky.
// - „distance“ = dosavadní rozdělení (do fáze 64): místnosti podle vzdálenosti od rozváděče, velká místnost po 10
//   zásuvkách v pořadí vzdálenosti (u velké místnosti vznikají „prstence“ okolo rozváděče).
//
// Ruční okruh (`manual`, např. „Z2“) má přednost v každém režimu – zásuvky se stejným klíčem tvoří jeden okruh
// (po podlažích), nad 10 zásuvek jen s varováním. Okruh nikdy nespojuje dvě podlaží. Čisté funkce.

import { optimalOrder } from "./route-order";

export type SocketGrouping = "compact" | "rooms" | "distance";
export const SOCKET_GROUPINGS: readonly SocketGrouping[] = ["compact", "rooms", "distance"];
export const isSocketGrouping = (value: unknown): value is SocketGrouping => SOCKET_GROUPINGS.includes(value as SocketGrouping);

export interface SocketPoint {
  id: string;
  room: string;
  floor: string;
  /** Poloha v mm. */
  x: number;
  y: number;
  /** Délka trasy z rozváděče [mm]. */
  home: number;
  /** Počet zásuvek (dvojzásuvka = 2). */
  weight: number;
  /** Ruční okruh („Z1“, „Z2“ …); null = automaticky. */
  manual?: string | null;
  /** Pořadí místnosti v nákresu (při shodě vzdáleností). */
  roomOrder?: number;
  /** Společný víceramček (jedna krabice) – zásuvky rámečku zůstanou v jednom okruhu. */
  frame?: string | null;
}

export interface SocketGroup {
  ids: string[];
  rooms: string[];
  floor: string;
  weight: number;
  manual: string | null;
}

/** Největší mezera mezi sousedními místnostmi, které se ještě spojí do jednoho okruhu [mm]. */
export const MERGE_GAP_MM = 8000;

const manhattan = (a: Pick<SocketPoint, "x" | "y">, b: Pick<SocketPoint, "x" | "y">) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const weightOf = (points: readonly SocketPoint[]) => points.reduce((sum, point) => sum + point.weight, 0);
const minHome = (points: readonly SocketPoint[]) => Math.min(...points.map((point) => point.home));
/** Nejmenší vzdálenost dvou skupin bodů [mm]. */
const gap = (a: readonly SocketPoint[], b: readonly SocketPoint[]) => Math.min(...a.flatMap((p) => b.map((q) => manhattan(p, q))));

function makeGroup(points: readonly SocketPoint[], manual: string | null = null): SocketGroup {
  return { ids: points.map((point) => point.id), rooms: [...new Set(points.map((point) => point.room))], floor: points[0]?.floor ?? "", weight: weightOf(points), manual };
}

/**
 * Souvislé úseky posloupnosti s vyrovnanou zátěží: počet úseků = ⌈součet / max⌉, řez u nejbližší kumulativní hranice
 * (prvek patří do úseku, kde leží jeho střed), žádný úsek nad `max` (těžký prvek dostane vlastní úsek).
 */
export function balancedChunks<T>(items: readonly T[], weight: (item: T) => number, max: number): T[][] {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const count = Math.max(1, Math.ceil(total / max));
  const chunks: T[][] = [];
  let current: T[] = [];
  let load = 0;
  let done = 0;
  for (const item of items) {
    const w = weight(item);
    const boundary = (total * (chunks.length + 1)) / count;
    const overflow = load + w > max;
    const pastBoundary = chunks.length < count - 1 && done + load + w / 2 > boundary;
    if (current.length && (overflow || pastBoundary)) {
      chunks.push(current);
      done += load;
      current = [];
      load = 0;
    }
    current.push(item);
    load += w;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Nejkratší otevřený průchod body od rozváděče (začíná u bodu nejblíž rozváděči). */
function tour(points: readonly SocketPoint[]): SocketPoint[] {
  const ordered = [...points].sort((a, b) => a.home - b.home || a.id.localeCompare(b.id));
  return optimalOrder(ordered.length, (from, to) => (from < 0 ? ordered[to].home : manhattan(ordered[from], ordered[to]))).map((index) => ordered[index]);
}

/** Dosavadní rozdělení (do fáze 64) – beze změny chování. */
function byDistance(points: readonly SocketPoint[], max: number): SocketGroup[] {
  const rooms = new Map<string, SocketPoint[]>();
  for (const point of [...points].sort((a, b) => a.home - b.home)) rooms.set(point.room, [...(rooms.get(point.room) ?? []), point]);
  const ordered = [...rooms.entries()].sort((a, b) => minHome(a[1]) - minHome(b[1]) || (a[1][0].roomOrder ?? 0) - (b[1][0].roomOrder ?? 0));
  const groups: SocketPoint[][] = [];
  for (const [, nodes] of ordered) {
    let current = groups[groups.length - 1];
    if (!current || weightOf(current) + weightOf(nodes) > max || current[0].floor !== nodes[0].floor) {
      current = [];
      groups.push(current);
    }
    for (const node of nodes) {
      if (current.length && weightOf(current) + node.weight > max) {
        current = [];
        groups.push(current);
      }
      current.push(node);
    }
  }
  return groups.filter((group) => group.length).map((group) => makeGroup(group));
}

/** Zásuvky víceramečku jako jeden celek (poloha prvního členu, součet zásuvek) – rozdělení ho nerozpůlí. */
function atomsOf(points: readonly SocketPoint[]): { atoms: SocketPoint[]; members: Map<string, SocketPoint[]> } {
  const members = new Map<string, SocketPoint[]>();
  const atoms: SocketPoint[] = [];
  for (const point of points) {
    const key = point.frame ? `frame:${point.frame}` : point.id;
    const list = members.get(key);
    if (list) list.push(point);
    else {
      members.set(key, [point]);
      atoms.push({ ...point, id: key });
    }
  }
  return { atoms: atoms.map((atom) => ({ ...atom, weight: weightOf(members.get(atom.id)!), home: minHome(members.get(atom.id)!) })), members };
}

/** Kompaktní zóny (`perRoom` = každá místnost vlastní okruh). */
function byZones(input: readonly SocketPoint[], max: number, perRoom: boolean): SocketGroup[] {
  const { atoms: points, members } = atomsOf(input);
  const result: SocketPoint[][] = [];
  const floors = [...new Set(points.map((point) => point.floor))].sort((a, b) => minHome(points.filter((point) => point.floor === a)) - minHome(points.filter((point) => point.floor === b)));
  for (const floor of floors) {
    const byRoom = new Map<string, SocketPoint[]>();
    for (const point of points) if (point.floor === floor) byRoom.set(point.room, [...(byRoom.get(point.room) ?? []), point]);
    const rooms = [...byRoom.values()].map((list) => ({ seq: tour(list), weight: weightOf(list), home: minHome(list), order: list[0].roomOrder ?? 0 }));
    rooms.sort((a, b) => a.home - b.home || a.order - b.order);
    // Místnosti v pořadí sousedství: nejkratší průchod místnostmi (vzdálenost = nejbližší dvojice zásuvek)
    const sequence = optimalOrder(rooms.length, (from, to) => (from < 0 ? rooms[to].home : gap(rooms[from].seq, rooms[to].seq))).map((index) => rooms[index]);
    let current: SocketPoint[] | null = null;
    for (const room of sequence) {
      if (room.weight > max) {
        const chunks = balancedChunks(room.seq, (point) => point.weight, max);
        result.push(...chunks);
        current = perRoom ? null : chunks[chunks.length - 1];
        continue;
      }
      if (!perRoom && current && weightOf(current) + room.weight <= max && gap(current, room.seq) <= MERGE_GAP_MM) {
        current.push(...room.seq);
        continue;
      }
      current = [...room.seq];
      result.push(current);
    }
  }
  return result.map((group) => makeGroup(group.flatMap((atom) => members.get(atom.id) ?? [atom])));
}

const naturalKey = (a: string, b: string) => a.localeCompare(b, "cs", { numeric: true });

/** Okruhy běžných zásuvek: ruční okruhy + automatické rozdělení podle režimu, seřazené od rozváděče. */
export function planSocketGroups(points: readonly SocketPoint[], options: { grouping?: SocketGrouping; maxOutlets: number }): { groups: SocketGroup[]; warnings: string[] } {
  const max = options.maxOutlets;
  const warnings: string[] = [];
  const groups: SocketGroup[] = [];
  const homeOf = new Map(points.map((point) => [point.id, point.home]));
  for (const key of [...new Set(points.flatMap((point) => (point.manual ? [point.manual] : [])))].sort(naturalKey)) {
    const members = points.filter((point) => point.manual === key);
    const floors = [...new Set(members.map((point) => point.floor))];
    if (floors.length > 1) warnings.push(`Ruční okruh ${key} je na ${floors.length} podlažích – rozdělen po podlažích (okruh nespojuje podlaží).`);
    for (const floor of floors) {
      const group = makeGroup(tour(members.filter((point) => point.floor === floor)), key);
      if (group.weight > max) warnings.push(`Ruční okruh ${key}: ${group.weight} zásuvek – víc než ${max} na okruh dle ČSN 33 2130 ed. 4, rozdělte ho.`);
      groups.push(group);
    }
  }
  const auto = points.filter((point) => !point.manual);
  const grouping = options.grouping ?? "compact";
  const first = (group: SocketGroup) => Math.min(...group.ids.map((id) => homeOf.get(id) ?? 0));
  const fromPanel = (list: SocketGroup[]) => list.map((group, index) => ({ group, index })).sort((a, b) => first(a.group) - first(b.group) || a.index - b.index).map(({ group }) => group);
  // Dosavadní režim zachová své pořadí okruhů (ruční okruhy před ním); zóny se číslují od rozváděče
  if (grouping === "distance") return { groups: [...fromPanel(groups), ...byDistance(auto, max)], warnings };
  return { groups: fromPanel([...groups, ...byZones(auto, max, grouping === "rooms")]), warnings };
}
