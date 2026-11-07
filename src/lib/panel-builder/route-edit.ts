// Fáze 63: ruční úprava tras kabelů v 2D půdorysu. Úsek lomené čáry se posouvá jen kolmo ke svému směru – vodorovný
// výhradně v ose Y, svislý výhradně v ose X, šikmý (podél šikmé stěny) kolmo ke stěně, takže s ní zůstává rovnoběžný.
// Sousední úsek kolmý na posun se natáhne / zkrátí (úhel zůstává 90°), jinak vznikne spojka ve směru posunu. Dvojklik
// vloží ortogonální odskok, trasy podél stěn se kreslí v odsazení 200 mm s kolmou odbočkou k prvku. Čisté funkce.

import { cleanPolyline, directionOf, normalOf, segmentAxis, type PlanPoint } from "@/engine/route-geometry";

export { cleanPolyline, normalOf, orthogonalPath, polylineLength, reanchor, segmentAxis, type PlanPoint, type SegmentAxis } from "@/engine/route-geometry";

/** Klíč úseku trasy (rozváděč / prvek → prvek) pro uložení ruční úpravy v nákresu. */
export const legKey = (from: string, to: string) => `${from}>${to}`;

/** Odsazení tras od stěny do místnosti [mm] (kabel rovnoběžně se stěnou, k prvku kolmá odbočka). */
export const WALL_INSET_MM = 200;
/** Výchozí hloubka a délka odskoku vloženého dvojklikem [mm]. */
export const JOG_DEPTH_MM = 300;
export const JOG_HALF_MM = 300;

const add = (a: PlanPoint, b: PlanPoint, k = 1): PlanPoint => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const dot = (a: PlanPoint, b: PlanPoint) => a.x * b.x + a.y * b.y;
const crossOf = (a: PlanPoint, b: PlanPoint) => a.x * b.y - a.y * b.x;

/** Je úsek a → b rovnoběžný se směrem `n` (sousední úsek, který se při posunu jen natáhne)? */
function parallel(a: PlanPoint, b: PlanPoint, n: PlanPoint) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return false;
  return Math.abs(crossOf({ x: (b.x - a.x) / length, y: (b.y - a.y) / length }, n)) < 1e-3;
}

/** Posun, který úsek skutečně udělá: průmět tažení do normály úseku (u os X / Y zaokrouhlený na `snap` mm). */
export function segmentShift(points: readonly PlanPoint[], index: number, drag: PlanPoint, snap = 0): PlanPoint | null {
  if (index < 0 || index >= points.length - 1) return null;
  const a = points[index];
  const b = points[index + 1];
  const n = normalOf(a, b);
  let distance = dot(drag, n);
  if (snap > 0 && segmentAxis(a, b) !== "slanted") distance = Math.round(distance / snap) * snap;
  if (Math.abs(distance) < 0.5) return null;
  return { x: n.x * distance, y: n.y * distance };
}

/**
 * Posun úseku `index` (mezi body `index` a `index + 1`) o tažení `drag` – vodorovný jen v ose Y, svislý jen v ose X,
 * šikmý kolmo ke svému směru. Sousední úsek kolmý na úsek se natáhne / zkrátí; koncový bod trasy (rozváděč, prvek)
 * zůstává na místě a k posunutému úseku vede kolmá spojka.
 */
export function dragSegment(points: readonly PlanPoint[], index: number, drag: PlanPoint, options: { snap?: number } = {}): PlanPoint[] {
  const shift = segmentShift(points, index, drag, options.snap ?? 0);
  if (!shift) return cleanPolyline(points);
  const n = normalOf(points[index], points[index + 1]);
  const a = points[index];
  const b = points[index + 1];
  const movedA = add(a, shift);
  const movedB = add(b, shift);
  const head = points.slice(0, index);
  const tail = points.slice(index + 2);
  // Levý konec: první úsek trasy (pevný začátek) nebo soused, který se nenatáhne → spojka
  const left = index === 0 || !parallel(points[index - 1], a, n) ? [a, movedA] : [movedA];
  const right = index + 1 === points.length - 1 || !parallel(b, points[index + 2], n) ? [movedB, b] : [movedB];
  return cleanPolyline([...head, ...left, ...right, ...tail]);
}

/**
 * Dvojklik na úsek: ortogonální odskok – úsek se kolem místa kliknutí rozdělí a prostřední část se odsune o `depth`
 * (dvojice lomových bodů po 90°), takže ji jde dál táhnout kolem překážky.
 */
export function insertJog(points: readonly PlanPoint[], index: number, at: PlanPoint, depth = JOG_DEPTH_MM, half = JOG_HALF_MM): PlanPoint[] {
  if (index < 0 || index >= points.length - 1) return cleanPolyline(points);
  const a = points[index];
  const b = points[index + 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 150) return cleanPolyline(points);
  const dir = directionOf(a, b);
  const n = normalOf(a, b);
  const reach = Math.min(half, length / 3);
  const centre = Math.min(length - reach, Math.max(reach, dot({ x: at.x - a.x, y: at.y - a.y }, dir)));
  const p1 = add(a, dir, centre - reach);
  const p2 = add(a, dir, centre + reach);
  return cleanPolyline([...points.slice(0, index + 1), p1, add(p1, n, depth), add(p2, n, depth), p2, ...points.slice(index + 1)]);
}

/** Stěna místnosti s jednotkovou normálou do místnosti (pro odsazení trasy). */
export interface InsetWall {
  a: PlanPoint;
  b: PlanPoint;
  inward: PlanPoint;
  room: string;
}

/** Leží úsek p → q na stěně (obě krajní body do 3 mm od přímky stěny a v jejím rozsahu)? */
function onWall(p: PlanPoint, q: PlanPoint, wall: InsetWall) {
  const dir = directionOf(wall.a, wall.b);
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const within = (point: PlanPoint) => {
    const rel = { x: point.x - wall.a.x, y: point.y - wall.a.y };
    const along = dot(rel, dir);
    return Math.abs(crossOf(dir, rel)) <= 3 && along >= -3 && along <= length + 3;
  };
  return Math.hypot(q.x - p.x, q.y - p.y) >= 1 && within(p) && within(q);
}

/** Průsečík přímek p1 + t·d1 a p2 + s·d2 (null = rovnoběžné). */
function intersect(p1: PlanPoint, d1: PlanPoint, p2: PlanPoint, d2: PlanPoint): PlanPoint | null {
  const denominator = crossOf(d1, d2);
  if (Math.abs(denominator) < 1e-6) return null;
  const t = crossOf({ x: p2.x - p1.x, y: p2.y - p1.y }, d2) / denominator;
  return add(p1, d1, t);
}

/**
 * Trasa podél stěn v odsazení `inset` do místnosti: úseky ležící na stěně se posunou rovnoběžně se stěnou (u šikmé stěny
 * v její lokální ose), rohy se dopočítají jako průsečíky, od prvku a rozváděče vede kolmá odbočka. Úseky mimo stěny
 * (volný prostor) zůstávají v osách X / Y. `prefer` = místnosti koncových prvků (u společné stěny dvou místností).
 */
export function insetWallRoute(points: readonly PlanPoint[], walls: readonly InsetWall[], inset = WALL_INSET_MM, prefer: readonly string[] = []): PlanPoint[] {
  if (points.length < 2 || !walls.length || inset <= 0) return cleanPolyline(points);
  const offsets = points.slice(0, -1).map((p, index) => {
    const q = points[index + 1];
    const candidates = walls.filter((wall) => onWall(p, q, wall));
    const wall = candidates.find((candidate) => prefer.includes(candidate.room)) ?? candidates[0];
    return wall ? { x: wall.inward.x * inset, y: wall.inward.y * inset } : { x: 0, y: 0 };
  });
  const zero = (offset: PlanPoint) => Math.abs(offset.x) < 1e-6 && Math.abs(offset.y) < 1e-6;
  const same = (a: PlanPoint, b: PlanPoint) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  const out: PlanPoint[] = [points[0]];
  if (!zero(offsets[0])) out.push(add(points[0], offsets[0]));
  for (let index = 1; index < points.length - 1; index++) {
    const before = offsets[index - 1];
    const after = offsets[index];
    if (same(before, after)) {
      out.push(add(points[index], after));
      continue;
    }
    const hit = intersect(add(points[index - 1], before), directionOf(points[index - 1], points[index]), add(points[index], after), directionOf(points[index], points[index + 1]));
    if (hit) out.push(hit);
    else out.push(add(points[index], before), add(points[index], after));
  }
  const last = offsets[offsets.length - 1];
  if (!zero(last)) out.push(add(points[points.length - 1], last));
  out.push(points[points.length - 1]);
  return cleanPolyline(out);
}
