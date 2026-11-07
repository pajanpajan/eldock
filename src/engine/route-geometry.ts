// Fáze 63: geometrie lomených čar tras kabelů – délka, čištění (duplicitní a souběžné body), přichycení ručně upravené
// trasy k novým koncovým bodům (posunutý prvek) a náhradní pravoúhlá trasa. Sdílí ji výpočet kabeláže (cable-routing.ts)
// i ruční úpravy tras v editoru (`lib/panel-builder/route-edit.ts`). Čisté funkce.

export interface PlanPoint {
  x: number;
  y: number;
}

export type SegmentAxis = "horizontal" | "vertical" | "slanted";

/** Tolerance vodorovnosti / svislosti úseku [mm]. */
const AXIS_EPS = 0.5;
/** Body blíž než 1 mm jsou totožné. */
const SAME_MM = 1;

const round = (value: number) => Math.round(value * 10) / 10;
const point = (x: number, y: number): PlanPoint => ({ x: round(x), y: round(y) });

/** Druh úseku: vodorovný (posun jen v ose Y), svislý (jen v ose X), šikmý (kolmo ke svému směru). */
export function segmentAxis(a: PlanPoint, b: PlanPoint): SegmentAxis {
  if (Math.abs(b.y - a.y) <= AXIS_EPS) return "horizontal";
  if (Math.abs(b.x - a.x) <= AXIS_EPS) return "vertical";
  return "slanted";
}

/** Jednotkový směr úseku a → b (nulový úsek = osa X). */
export function directionOf(a: PlanPoint, b: PlanPoint): PlanPoint {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return length > 1e-9 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 };
}

/** Jednotková normála úseku (otočení směru o 90°); u vodorovného úseku míří v ose Y, u svislého v ose X. */
export function normalOf(a: PlanPoint, b: PlanPoint): PlanPoint {
  const axis = segmentAxis(a, b);
  if (axis === "horizontal") return { x: 0, y: 1 };
  if (axis === "vertical") return { x: 1, y: 0 };
  const dir = directionOf(a, b);
  return { x: -dir.y, y: dir.x };
}

export const polylineLength = (points: readonly PlanPoint[]) => points.reduce((sum, current, index) => (index ? sum + Math.hypot(current.x - points[index - 1].x, current.y - points[index - 1].y) : 0), 0);

/**
 * Úklid lomené čáry: bez duplicitních bodů a bez vnitřních bodů ležících na přímce mezi sousedy (souběžné úseky
 * se sloučí, „zpětný hrot“ zanikne). Koncové body zůstávají vždy.
 */
export function cleanPolyline(points: readonly PlanPoint[]): PlanPoint[] {
  const unique: PlanPoint[] = [];
  for (const current of points) {
    const last = unique[unique.length - 1];
    if (!last || Math.hypot(current.x - last.x, current.y - last.y) >= SAME_MM) unique.push(point(current.x, current.y));
  }
  if (unique.length < 3) return unique;
  const out: PlanPoint[] = [unique[0]];
  for (let index = 1; index < unique.length - 1; index++) {
    const previous = out[out.length - 1];
    const current = unique[index];
    const next = unique[index + 1];
    const ax = current.x - previous.x;
    const ay = current.y - previous.y;
    const bx = next.x - current.x;
    const by = next.y - current.y;
    const cross = ax * by - ay * bx;
    const scale = Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by));
    // Bod na přímce (souběžné úseky i hrot zpět) vypadne
    if (Math.abs(cross) / scale < 1e-6) continue;
    out.push(current);
  }
  out.push(unique[unique.length - 1]);
  return out;
}

/** Náhradní pravoúhlá trasa (nejdřív v ose X, pak v ose Y). */
export const orthogonalPath = (a: PlanPoint, b: PlanPoint): PlanPoint[] => cleanPolyline([a, { x: b.x, y: a.y }, b]);

/**
 * Přichycení ručně upravené trasy k novým koncovým bodům (prvek se posunul): první / poslední úsek se natáhne a posune
 * tak, aby zůstal vodorovný nebo svislý (sousední úsek se natáhne); u šikmého úseku vznikne krátká spojka. Trasa
 * s jediným úsekem se nahradí pravoúhlou.
 */
export function reanchor(points: readonly PlanPoint[], from: PlanPoint, to: PlanPoint): PlanPoint[] {
  if (points.length < 2) return orthogonalPath(from, to);
  const startMoved = Math.hypot(points[0].x - from.x, points[0].y - from.y) >= SAME_MM;
  const endMoved = Math.hypot(points[points.length - 1].x - to.x, points[points.length - 1].y - to.y) >= SAME_MM;
  if (!startMoved && !endMoved) return cleanPolyline(points);
  if (points.length === 2) return orthogonalPath(from, to);
  const next = points.map((value) => ({ ...value }));
  if (startMoved) {
    const axis = segmentAxis(next[0], next[1]);
    const dx = from.x - next[0].x;
    const dy = from.y - next[0].y;
    if (axis === "horizontal") next[1].y += dy;
    else if (axis === "vertical") next[1].x += dx;
    else next.unshift({ ...from });
    next[0] = { ...from };
  }
  if (endMoved) {
    const last = next.length - 1;
    const axis = segmentAxis(next[last - 1], next[last]);
    const dx = to.x - next[last].x;
    const dy = to.y - next[last].y;
    if (axis === "horizontal") next[last - 1].y += dy;
    else if (axis === "vertical") next[last - 1].x += dx;
    else next.push({ ...to });
    next[next.length - 1] = { ...to };
  }
  return cleanPolyline(next);
}
