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

// Zóny se zadávají jako BUŇKY rastru (pole mezi sousedními osami): buňka „B2“ leží mezi
// osami B–C a 2–3. „B2“–„B5“ je tedy platný pás výšky 1 modulu a i jediná buňka je místnost.

/** Počet buněk rastru (o jednu méně než os). */
export const cellCount = (spec: Pick<GridSpec, "cols" | "rows">) => ({ cols: spec.cols - 1, rows: spec.rows - 1 });

/** „B5“ → buňka { row: 1, col: 4 } (0-based); mimo rastr → `null`. */
export function parseCellRef(ref: string, spec: Pick<GridSpec, "cols" | "rows">): GridPoint | null {
  const cells = cellCount(spec);
  return parseGridRef(ref, { cols: cells.cols, rows: cells.rows });
}

/** Buňka pod bodem v procentech půdorysu (tažení myší v rastru). */
export function cellAt(percent: { x: number; y: number }, spec: Pick<GridSpec, "cols" | "rows">, viewBox = FLOOR_VIEWBOX): GridPoint {
  const o = gridOutline(viewBox);
  const cells = cellCount(spec);
  const px = (percent.x / 100) * viewBox.width;
  const py = (percent.y / 100) * viewBox.height;
  const col = Math.floor(((px - o.x) / o.w) * cells.cols);
  const row = Math.floor(((py - o.y) / o.h) * cells.rows);
  return { col: Math.min(cells.cols - 1, Math.max(0, col)), row: Math.min(cells.rows - 1, Math.max(0, row)) };
}

/** Rozsah buněk zóny jako osy (levý horní a pravý dolní průsečík). */
function zoneAxes(zone: Pick<GridZone, "from" | "to">, spec: Pick<GridSpec, "cols" | "rows">) {
  const a = parseCellRef(zone.from, spec);
  const b = parseCellRef(zone.to, spec);
  if (!a || !b) return null;
  return {
    start: { col: Math.min(a.col, b.col), row: Math.min(a.row, b.row) },
    end: { col: Math.max(a.col, b.col) + 1, row: Math.max(a.row, b.row) + 1 },
  };
}

/** Zóna z buněk („B2“–„B5“) → obdélník půdorysu s malou mezerou od os. */
export function zoneToRoom(zone: GridZone, spec: GridSpec, viewBox = FLOOR_VIEWBOX): FloorplanRoom | null {
  const axes = zoneAxes(zone, spec);
  if (!axes) return null;
  const p1 = gridToPx(axes.start, spec, viewBox);
  const p2 = gridToPx(axes.end, spec, viewBox);
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

/** Leží průsečík os uvnitř zóny (včetně obvodu)? – převzetí místnosti při osazení zařízení. */
export function zoneContains(zone: Pick<GridZone, "from" | "to">, point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">): boolean {
  const axes = zoneAxes(zone, spec);
  return !!axes && point.col >= axes.start.col && point.col <= axes.end.col && point.row >= axes.start.row && point.row <= axes.end.row;
}

/** Nejmenší zóna obsahující bod (vnořené místnosti mají přednost). */
export function zoneAt<T extends Pick<GridZone, "from" | "to">>(zones: readonly T[], point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">): T | null {
  const area = (zone: T) => {
    const axes = zoneAxes(zone, spec)!;
    return (axes.end.col - axes.start.col) * (axes.end.row - axes.start.row);
  };
  return zones.filter((zone) => zoneContains(zone, point, spec)).sort((a, b) => area(a) - area(b))[0] ?? null;
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

/** Nejbližší průsečík na obvodové stěně k bodu v procentech (vrata jedním klikem u zdi). */
export function nearestWallPoint(percent: { x: number; y: number }, spec: Pick<GridSpec, "cols" | "rows">, viewBox = FLOOR_VIEWBOX): GridPoint {
  const point = nearestGridPoint(percent, spec, viewBox);
  const o = gridOutline(viewBox);
  const px = (percent.x / 100) * viewBox.width;
  const py = (percent.y / 100) * viewBox.height;
  const distances = [
    { wall: "left", d: Math.abs(px - o.x) },
    { wall: "right", d: Math.abs(px - (o.x + o.w)) },
    { wall: "top", d: Math.abs(py - o.y) },
    { wall: "bottom", d: Math.abs(py - (o.y + o.h)) },
  ].sort((a, b) => a.d - b.d);
  switch (distances[0].wall) {
    case "left":
      return { ...point, col: 0 };
    case "right":
      return { ...point, col: spec.cols - 1 };
    case "top":
      return { ...point, row: 0 };
    default:
      return { ...point, row: spec.rows - 1 };
  }
}

/** Je průsečík na obvodu rastru (vrata)? */
export const isWallPoint = (point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">) =>
  point.col === 0 || point.col === spec.cols - 1 || point.row === 0 || point.row === spec.rows - 1;

// ---------------------------------------------------------------------------
//  Šablony rozdělení patra (1 klik)
// ---------------------------------------------------------------------------

export const FLOOR_TEMPLATES = [
  { key: "two-lines", label: "2 výrobní linky + sklad" },
  { key: "switchroom", label: "Rozvodna + zázemí" },
  { key: "offices", label: "Kanceláře podél chodby" },
] as const;

export type FloorTemplateKey = (typeof FLOOR_TEMPLATES)[number]["key"];

/** Zóny šablony pro daný rastr (buňky); funguje i pro nejmenší rastr 4 × 4 os. */
export function floorTemplate(key: FloorTemplateKey, spec: Pick<GridSpec, "cols" | "rows">): GridZone[] {
  const cells = cellCount(spec);
  const ref = (row: number, col: number) => formatGridRef({ row, col });
  const lastRow = cells.rows - 1;
  const lastCol = cells.cols - 1;
  const half = Math.max(1, Math.floor(cells.cols / 2));
  switch (key) {
    case "two-lines": {
      const band = Math.max(1, Math.floor(cells.rows * 0.35));
      return [
        { from: ref(0, 0), to: ref(band - 1, lastCol), name: "Výrobní linka 1", kind: "PRODUCTION" },
        { from: ref(band, 0), to: ref(Math.min(2 * band - 1, lastRow - 1), lastCol), name: "Výrobní linka 2", kind: "PRODUCTION" },
        { from: ref(Math.min(2 * band, lastRow), 0), to: ref(lastRow, half - 1), name: "Zázemí a šatny", kind: "STORAGE" },
        { from: ref(Math.min(2 * band, lastRow), half), to: ref(lastRow, lastCol), name: "Sklad komponent", kind: "STORAGE" },
      ];
    }
    case "switchroom": {
      const split = Math.max(1, Math.floor(cells.cols * 0.6));
      return [
        { from: ref(0, 0), to: ref(lastRow, split - 1), name: "Rozvodna nn", kind: "HAZARD" },
        { from: ref(0, split), to: ref(lastRow, lastCol), name: "Zázemí", kind: "STORAGE" },
      ];
    }
    case "offices": {
      const corridor = Math.max(1, Math.floor(cells.rows / 2));
      return [
        { from: ref(0, 0), to: ref(corridor - 1, half - 1), name: "Kanceláře A", kind: "STORAGE" },
        { from: ref(0, half), to: ref(corridor - 1, lastCol), name: "Kanceláře B", kind: "STORAGE" },
        { from: ref(corridor, 0), to: ref(corridor, lastCol), name: "Chodba", kind: "STORAGE" },
        ...(corridor + 1 <= lastRow
          ? [
              { from: ref(corridor + 1, 0), to: ref(lastRow, half - 1), name: "Zasedací místnost", kind: "STORAGE" as const },
              { from: ref(corridor + 1, half), to: ref(lastRow, lastCol), name: "Kuchyňka", kind: "STORAGE" as const },
            ]
          : []),
      ];
    }
  }
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
