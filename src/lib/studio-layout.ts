import {
  DEFAULT_GRID,
  axisMeters,
  SCALES,
  ZONE_KIND_KEYS,
  formatGridRef,
  nearestWallPoint,
  planFrame,
  pxToMeters,
  type DrawingScale,
  type GridGate,
  type GridSpec,
  type GridZone,
  type PlanFrame,
  type ZoneKind,
} from "./cad-grid";
import { extractFloorplanRoomsWithLabels } from "./mock-graphics/floorplan";

// Zdrojová definice patra ze Studia (`Floor.studioLayoutJson`): rastr, zóny v metrech a vrata.
// Patro uložené Studiem jde díky ní kdykoli znovu otevřít a upravit. U starších pater (seed,
// Studio před fází 36) se rozvržení dopočítá z uloženého SVG půdorysu.

export interface StudioLayout {
  version: 1;
  grid: GridSpec;
  zones: GridZone[];
  gates: GridGate[];
}

export const serializeLayout = (layout: Omit<StudioLayout, "version">): string => JSON.stringify({ version: 1, ...layout });

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** JSON z databáze → rozvržení; poškozený nebo cizí JSON → `null`. */
export function parseLayout(json: string | null | undefined): StudioLayout | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<StudioLayout>;
    const grid = raw.grid;
    if (raw.version !== 1 || !grid || !isNumber(grid.cols) || !isNumber(grid.rows) || !isNumber(grid.stepMeters)) return null;
    const scale: DrawingScale = SCALES.includes(grid.scale) ? grid.scale : DEFAULT_GRID.scale;
    const zones = (Array.isArray(raw.zones) ? raw.zones : []).filter(
      (zone): zone is GridZone => !!zone && [zone.x, zone.y, zone.w, zone.h].every(isNumber) && typeof zone.name === "string" && ZONE_KIND_KEYS.includes(zone.kind),
    );
    const gates = (Array.isArray(raw.gates) ? raw.gates : []).filter((gate): gate is GridGate => !!gate && typeof gate.at === "string" && typeof gate.label === "string");
    const meters = isNumber(grid.widthM) && isNumber(grid.depthM) ? { widthM: grid.widthM, depthM: grid.depthM } : {};
    return { version: 1, grid: { cols: grid.cols, rows: grid.rows, stepMeters: grid.stepMeters, scale, ...meters }, zones: zones.map((zone, index) => ({ ...zone, key: zone.key || `z${index + 1}` })), gates };
  } catch {
    return null;
  }
}

const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const half = (value: number) => Math.round(value * 2) / 2;

/**
 * Rám uloženého půdorysu přečtený ze SVG: obvodová zeď (tlustý obdélník), počet os podle kroužků
 * popisů os a rozteč z popisku („rozteč 6 m“, jinak 6 m). Funguje pro seed i starší patra Studia.
 */
export function frameFromSvg(svg: string): PlanFrame {
  const wall = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none" stroke="#94a3b8" stroke-width="6"\/>/.exec(svg);
  const [x, y, w, h] = wall ? wall.slice(1, 5).map(Number) : [70, 70, 1050, 690];
  const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="13"/g)].map((match) => ({ cx: Number(match[1]), cy: Number(match[2]) }));
  const cols = circles.filter((circle) => Math.abs(circle.cy - (y - 28)) < 1).length || DEFAULT_GRID.cols;
  const rows = circles.filter((circle) => Math.abs(circle.cx - (x - 28)) < 1).length || DEFAULT_GRID.rows;
  const step = Number(/rozteč ([\d,]+) m/.exec(svg)?.[1]?.replace(",", ".") ?? 6) || 6;
  const widthM = (cols - 1) * step;
  const depthM = (rows - 1) * step;
  return { x, y, w, h, cols, rows, stepMeters: step, widthM, depthM, axesX: axisMeters(widthM, step), axesY: axisMeters(depthM, step) };
}

/** Typ zóny podle barvy obrysu v SVG (nové barvy Studia i původní styly seedu). */
function kindFromStroke(stroke: string): ZoneKind {
  const map: Record<string, ZoneKind> = {
    "#f59e0b": "PRODUCTION",
    "#a16207": "PRODUCTION",
    "#3b82f6": "OFFICE",
    "#a855f7": "ELECTRICAL",
    "#7e22ce": "ELECTRICAL",
    "#64748b": "STORAGE",
    "#14b8a6": "WORKSHOP",
    "#10b981": "FACILITIES",
    "#94a3b8": "CORRIDOR",
  };
  return map[stroke.toLowerCase()] ?? "FACILITIES";
}

/** Rozvržení staršího patra dopočítané z uloženého SVG (místnosti s názvy a typem, vrata na obvodu). */
export function layoutFromSvg(svg: string): StudioLayout {
  const frame = frameFromSvg(svg);
  const strokes = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="rgba[^"]+" stroke="(#[0-9a-fA-F]{6})"/g)].map((match) => ({ key: match.slice(1, 5).join(","), stroke: match[5] }));
  const zones: GridZone[] = extractFloorplanRoomsWithLabels(svg).map((room, index) => {
    const a = pxToMeters(frame, { x: room.x, y: room.y });
    const b = pxToMeters(frame, { x: room.x + room.w, y: room.y + room.h });
    const stroke = strokes.find((entry) => entry.key === [room.x, room.y, room.w, room.h].join(","))?.stroke ?? "";
    const x = half(a.x);
    const y = half(a.y);
    return { key: `z${index + 1}`, x, y, w: Math.max(1, half(b.x) - x), h: Math.max(1, half(b.y) - y), name: room.label, kind: kindFromStroke(stroke) };
  });
  const gates: GridGate[] = [];
  // Původní styl vrat (seed): tmavá čára šířky 8 + popisek; nový styl Studia: azurová výplň průjezdu + štítek
  for (const match of svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#0b1220" stroke-width="8"\/>(?:<line[^>]*\/>)?(?:<text[^>]*>([^<]*)<\/text>)?/g)) {
    const [x1, y1, x2, y2] = match.slice(1, 5).map(Number);
    gates.push({ at: formatGridRef(nearestWallPoint({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, frame)), label: unescape(match[5] ?? "").trim() || `Vrata ${gates.length + 1}` });
  }
  for (const match of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#06b6d4" fill-opacity="0.55"[\s\S]*?<g data-gate="([^"]*)"/g)) {
    const [x, y, w, h] = match.slice(1, 5).map(Number);
    gates.push({ at: formatGridRef(nearestWallPoint({ x: x + w / 2, y: y + h / 2 }, frame)), label: unescape(match[5]).trim() || `Vrata ${gates.length + 1}` });
  }
  const unique = gates.filter((gate, index) => gates.findIndex((entry) => entry.at === gate.at) === index);
  return { version: 1, grid: { cols: frame.cols, rows: frame.rows, stepMeters: frame.stepMeters, scale: DEFAULT_GRID.scale }, zones, gates: unique };
}

/** Rozvržení stávajícího patra: uložený JSON, jinak dopočet ze SVG. */
export const layoutOfFloor = (floor: { studioLayoutJson?: string | null; floorplanSvg?: string | null }): StudioLayout => parseLayout(floor.studioLayoutJson) ?? layoutFromSvg(floor.floorplanSvg ?? "");

/**
 * Rám, ve kterém jsou uložené piny zařízení stávajícího patra: patro se Studio JSON = jednotný rám
 * jeho rastru, starší patro = rám přečtený z SVG.
 */
export function frameOfFloor(floor: { studioLayoutJson?: string | null; floorplanSvg?: string | null }): PlanFrame {
  const layout = parseLayout(floor.studioLayoutJson);
  return layout ? planFrame(layout.grid) : frameFromSvg(floor.floorplanSvg ?? "");
}
