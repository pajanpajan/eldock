import { renderFloorplanSvg, type FloorplanGate, type FloorplanRoom, type RoomKind } from "./mock-graphics/floorplan";

// Konstrukční rastr Studia: osy 1…N (svislé čáry, číslované) a A…Z (vodorovné, písmenné),
// rozteč sloupů v metrech, převod souřadnic rastru („A1“–„C11“) na viewBox půdorysu.
// Stejná geometrie jako `renderFloorplanSvg` (okraj 70 px pro popisy os).

export const GRID_LIMITS = { cols: { min: 4, max: 20 }, rows: { min: 4, max: 16 } } as const;
export const SCALES = ["1:100", "1:200", "1:500"] as const;
export type DrawingScale = (typeof SCALES)[number];

export interface GridSpec {
  /** Počet os 1…N. */
  cols: number;
  /** Počet os A…Z. */
  rows: number;
  /** Rozteč sloupů [m]. */
  stepMeters: number;
  scale: DrawingScale;
}

export const DEFAULT_GRID: GridSpec = { cols: 12, rows: 8, stepMeters: 6, scale: "1:200" };
export const FLOOR_VIEWBOX = { width: 1200, height: 800 } as const;

export const clampGrid = (spec: GridSpec): GridSpec => ({
  ...spec,
  cols: Math.min(GRID_LIMITS.cols.max, Math.max(GRID_LIMITS.cols.min, Math.round(spec.cols))),
  rows: Math.min(GRID_LIMITS.rows.max, Math.max(GRID_LIMITS.rows.min, Math.round(spec.rows))),
  stepMeters: Math.min(30, Math.max(2, spec.stepMeters)),
});

export const colLabels = (cols: number) => Array.from({ length: cols }, (_, i) => String(i + 1));
export const rowLabels = (rows: number) => Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));

/** Rozměr haly mezi krajními osami: 12 os × 6 m → 66 m. */
export function gridDimensions(spec: GridSpec): { widthM: number; depthM: number; label: string } {
  const widthM = (spec.cols - 1) * spec.stepMeters;
  const depthM = (spec.rows - 1) * spec.stepMeters;
  const fmt = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");
  return { widthM, depthM, label: `${fmt(widthM)} m × ${fmt(depthM)} m` };
}

/** Obvod mezi krajními osami ve viewBoxu (shodný s výchozím okrajem `renderFloorplanSvg`). */
export function gridOutline(viewBox: { width: number; height: number } = FLOOR_VIEWBOX) {
  return { x: 70, y: 70, w: viewBox.width - 150, h: viewBox.height - 110 };
}

export interface GridPoint {
  col: number;
  row: number;
}

/** „C11“ → { row: 2, col: 10 } (0-based); neplatné / mimo rastr → `null`. */
export function parseGridRef(ref: string, spec: Pick<GridSpec, "cols" | "rows">): GridPoint | null {
  const match = /^\s*([A-Za-z])\s*(\d{1,2})\s*$/.exec(ref);
  if (!match) return null;
  const row = match[1].toUpperCase().charCodeAt(0) - 65;
  const col = Number(match[2]) - 1;
  if (row < 0 || row >= spec.rows || col < 0 || col >= spec.cols) return null;
  return { row, col };
}

export const formatGridRef = (point: GridPoint) => `${String.fromCharCode(65 + point.row)}${point.col + 1}`;

/** Průsečík os ve viewBoxu. */
export function gridToPx(point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">, viewBox = FLOOR_VIEWBOX): { x: number; y: number } {
  const o = gridOutline(viewBox);
  return { x: o.x + (o.w / (spec.cols - 1)) * point.col, y: o.y + (o.h / (spec.rows - 1)) * point.row };
}

/** Pozice pinu v procentech půdorysu (jak ji ukládá `Equipment.pinX/pinY`). */
export function gridToPercent(point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">, viewBox = FLOOR_VIEWBOX) {
  const { x, y } = gridToPx(point, spec, viewBox);
  return { pinX: Math.round((x / viewBox.width) * 1000) / 10, pinY: Math.round((y / viewBox.height) * 1000) / 10 };
}

/** Nejbližší průsečík os k bodu v procentech (klik do rastru). */
export function nearestGridPoint(percent: { x: number; y: number }, spec: Pick<GridSpec, "cols" | "rows">, viewBox = FLOOR_VIEWBOX): GridPoint {
  const o = gridOutline(viewBox);
  const px = (percent.x / 100) * viewBox.width;
  const py = (percent.y / 100) * viewBox.height;
  const col = Math.round(((px - o.x) / o.w) * (spec.cols - 1));
  const row = Math.round(((py - o.y) / o.h) * (spec.rows - 1));
  return { col: Math.min(spec.cols - 1, Math.max(0, col)), row: Math.min(spec.rows - 1, Math.max(0, row)) };
}

export type ZoneKind = "PRODUCTION" | "STORAGE" | "HAZARD";

/** Typ zóny Studia → styl místnosti v půdorysu. */
export const ZONE_KINDS: Record<ZoneKind, { label: string; room: RoomKind }> = {
  PRODUCTION: { label: "Výrobní zóna (oranžová čárkovaná)", room: "zone" },
  STORAGE: { label: "Sklad a zázemí (šedá plná)", room: "room" },
  HAZARD: { label: "Nebezpečný prostor / Rozvodna", room: "electrical" },
};

export interface GridZone {
  from: string;
  to: string;
  name: string;
  kind: ZoneKind;
}

/** Zóna mezi dvěma průsečíky („A1“–„C11“) → obdélník půdorysu s malou mezerou od os. */
export function zoneToRoom(zone: GridZone, spec: GridSpec, viewBox = FLOOR_VIEWBOX): FloorplanRoom | null {
  const a = parseGridRef(zone.from, spec);
  const b = parseGridRef(zone.to, spec);
  if (!a || !b || a.col === b.col || a.row === b.row) return null;
  const p1 = gridToPx({ col: Math.min(a.col, b.col), row: Math.min(a.row, b.row) }, spec, viewBox);
  const p2 = gridToPx({ col: Math.max(a.col, b.col), row: Math.max(a.row, b.row) }, spec, viewBox);
  const inset = 8;
  return {
    label: zone.name.trim() || "Místnost",
    x: Math.round(p1.x + inset),
    y: Math.round(p1.y + inset),
    w: Math.round(p2.x - p1.x - 2 * inset),
    h: Math.round(p2.y - p1.y - 2 * inset),
    kind: ZONE_KINDS[zone.kind].room,
  };
}

export interface GridGate {
  at: string;
  label: string;
}

/** Vrata na obvodové stěně u průsečíku („G12“ = osa G na pravé stěně). Uvnitř rastru → `null`. */
export function gateToFloorplan(gate: GridGate, spec: GridSpec, viewBox = FLOOR_VIEWBOX): FloorplanGate | null {
  const point = parseGridRef(gate.at, spec);
  if (!point) return null;
  const o = gridOutline(viewBox);
  const { x, y } = gridToPx(point, spec, viewBox);
  const half = Math.min(o.w / (spec.cols - 1), o.h / (spec.rows - 1)) / 2.5;
  const label = gate.label.trim() || "Vrata";
  if (point.col === 0 || point.col === spec.cols - 1) return { x: Math.round(x), y: Math.round(y - half), length: Math.round(half * 2), orient: "v", label };
  if (point.row === 0 || point.row === spec.rows - 1) return { x: Math.round(x - half), y: Math.round(y), length: Math.round(half * 2), orient: "h", label };
  return null;
}

/** Délka 10 m v px a štítek měřítka pro rysku půdorysu. */
export function scaleBar(spec: GridSpec, viewBox = FLOOR_VIEWBOX): { pxPer10m: number; label: string } {
  const o = gridOutline(viewBox);
  const pxPerMeter = o.w / (spec.cols - 1) / spec.stepMeters;
  return { pxPer10m: Math.round(pxPerMeter * 10 * 10) / 10, label: `M ${spec.scale}` };
}

/** Půdorys patra ze Studia: rastr, zóny, vrata, měřítko a rozměr haly. */
export function renderGridFloorplanSvg(input: { floorName: string; spec: GridSpec; zones: GridZone[]; gates: GridGate[] }): string {
  const { spec } = input;
  const bar = scaleBar(spec);
  return renderFloorplanSvg({
    floor: { name: input.floorName, viewBoxW: FLOOR_VIEWBOX.width, viewBoxH: FLOOR_VIEWBOX.height },
    columns: spec.cols,
    rows: spec.rows,
    rooms: input.zones.map((zone) => zoneToRoom(zone, spec)).filter((room): room is FloorplanRoom => room !== null),
    gates: input.gates.map((gate) => gateToFloorplan(gate, spec)).filter((gate): gate is FloorplanGate => gate !== null),
    scale: { label: bar.label, pxPer10m: bar.pxPer10m, dimensions: `${gridDimensions(spec).label}, rozteč ${String(spec.stepMeters).replace(".", ",")} m` },
  });
}
