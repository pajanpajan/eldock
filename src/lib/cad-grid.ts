import { renderFloorplanSvg, type FloorplanGate, type FloorplanRoom, type RoomStyle } from "./mock-graphics/floorplan";

// Konstrukční rastr Studia: osy 1…N (svislé čáry, číslované) a A…Z (vodorovné, písmenné),
// rozteč sloupů v metrech. Půdorys se kreslí ve viewBoxu 1200 × 800 v JEDNOTNÉM měřítku
// (stejný počet px na metr v ose X i Y) – rám `PlanFrame` převádí metry ↔ viewBox.
// Místnosti a zařízení konceptu mají souřadnice v metrech od průsečíku os A1 (osa X doprava,
// osa Y dolů), takže je jde přichytávat na jemný rastr po 1 m.

export const GRID_LIMITS = { cols: { min: 4, max: 20 }, rows: { min: 4, max: 16 } } as const;
export const SCALES = ["1:100", "1:200", "1:500", "1:1000"] as const;
export type DrawingScale = (typeof SCALES)[number];

export interface GridSpec {
  /** Počet os 1…N (osa X). */
  cols: number;
  /** Počet os A…Z (osa Y). */
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

/** Číslo v metrech česky: 22.5 → „22,5“. */
export const fmtM = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");
const fmtArea = (value: number) => Math.round(value).toLocaleString("cs-CZ");

/** Rozměr haly mezi krajními osami: 12 os × 6 m → 66 m. */
export function gridDimensions(spec: Pick<GridSpec, "cols" | "rows" | "stepMeters">): { widthM: number; depthM: number; label: string } {
  const widthM = (spec.cols - 1) * spec.stepMeters;
  const depthM = (spec.rows - 1) * spec.stepMeters;
  return { widthM, depthM, label: `${fmtM(widthM)} m × ${fmtM(depthM)} m` };
}

// ---------------------------------------------------------------------------
//  Měřítko výkresu → zoom na obrazovce
// ---------------------------------------------------------------------------

export const scaleDenominator = (scale: DrawingScale) => Number(scale.split(":")[1]);
/** Obrazovka 96 dpi: kolik px zabere 1 m skutečnosti v daném měřítku (1:100 → 37,8 px). */
export const screenPxPerMeter = (scale: DrawingScale) => 96 / 0.0254 / scaleDenominator(scale);
/** Největší šířka plátna v px (větší měřítka se u velkých objektů nenabízejí). */
export const MAX_CANVAS_PX = 8000;

/** Šířka plátna v px pro objekt široký `meters` v měřítku (`null` = přesáhlo by limit). */
export function canvasWidthPx(meters: number, scale: DrawingScale): number | null {
  const px = Math.round(meters * screenPxPerMeter(scale));
  return px > MAX_CANVAS_PX ? null : px;
}

/** Grafické měřítko: „hezká“ délka v metrech, která na obrazovce zabere cca 80–200 px. */
export function scaleBarLength(pxPerMeter: number): { meters: number; px: number } {
  const options = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const meters = options.find((value) => value * pxPerMeter >= 80) ?? options[options.length - 1];
  return { meters, px: Math.round(meters * pxPerMeter) };
}

// ---------------------------------------------------------------------------
//  Rám půdorysu (metry ↔ viewBox)
// ---------------------------------------------------------------------------

export interface PlanFrame {
  /** Obvod mezi krajními osami ve viewBoxu. */
  x: number;
  y: number;
  w: number;
  h: number;
  widthM: number;
  depthM: number;
  cols: number;
  rows: number;
  stepMeters: number;
}

/** Rám nového patra: obvod v jednotném měřítku, vystředěný v ploše viewBoxu (okraj 70 px pro popisy os). */
export function planFrame(spec: Pick<GridSpec, "cols" | "rows" | "stepMeters">, viewBox: { width: number; height: number } = FLOOR_VIEWBOX): PlanFrame {
  const { widthM, depthM } = gridDimensions(spec);
  const area = { x: 70, y: 70, w: viewBox.width - 150, h: viewBox.height - 110 };
  const k = Math.min(area.w / widthM, area.h / depthM);
  const w = widthM * k;
  const h = depthM * k;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h, widthM, depthM, cols: spec.cols, rows: spec.rows, stepMeters: spec.stepMeters };
}

/** Stávající patra (půdorysy ze seedu a starších verzí Studia): obvod 70/70/1050/690 px = rastr 12 × 8 po 6 m. */
export const EXISTING_FLOOR_FRAME: PlanFrame = { x: 70, y: 70, w: 1050, h: 690, widthM: 66, depthM: 42, cols: 12, rows: 8, stepMeters: 6 };

export interface MeterPoint {
  x: number;
  y: number;
}

export const pxPerMeter = (frame: PlanFrame) => ({ x: frame.w / frame.widthM, y: frame.h / frame.depthM });

/** Metry od osy A1 → bod viewBoxu. */
export const metersToPx = (frame: PlanFrame, point: MeterPoint) => ({ x: frame.x + point.x * pxPerMeter(frame).x, y: frame.y + point.y * pxPerMeter(frame).y });

/** Bod viewBoxu → metry (oříznuté na obvod), volitelně přichycené na krok `snap`. */
export function pxToMeters(frame: PlanFrame, point: { x: number; y: number }, snap = 0): MeterPoint {
  const k = pxPerMeter(frame);
  const round = (value: number) => (snap > 0 ? Math.round(value / snap) * snap : value);
  return {
    x: Math.min(frame.widthM, Math.max(0, round((point.x - frame.x) / k.x))),
    y: Math.min(frame.depthM, Math.max(0, round((point.y - frame.y) / k.y))),
  };
}

/** Pozice pinu v procentech půdorysu (jak ji ukládá `Equipment.pinX/pinY`). */
export function metersToPercent(frame: PlanFrame, point: MeterPoint, viewBox: { width: number; height: number } = FLOOR_VIEWBOX) {
  const { x, y } = metersToPx(frame, point);
  return { pinX: Math.round((x / viewBox.width) * 1000) / 10, pinY: Math.round((y / viewBox.height) * 1000) / 10 };
}

/** Leží bod (v metrech) uvnitř obvodu patra? */
export const insideFrame = (frame: PlanFrame, point: MeterPoint) => point.x >= 0 && point.y >= 0 && point.x <= frame.widthM + 1e-6 && point.y <= frame.depthM + 1e-6;

/** Krok jemného pod-rastru: 1 m, u velkých hal (méně než 6 px/m ve viewBoxu) 2 m nebo 5 m. */
export function fineStep(frame: PlanFrame): number {
  const k = Math.min(pxPerMeter(frame).x, pxPerMeter(frame).y);
  return k >= 6 ? 1 : k >= 3 ? 2 : 5;
}

/** Pole rastru, ve kterém leží bod: „B3“ = mezi osami B–C a 3–4. */
export function bayAt(frame: PlanFrame, point: MeterPoint): string {
  const col = Math.min(frame.cols - 2, Math.max(0, Math.floor(point.x / frame.stepMeters)));
  const row = Math.min(frame.rows - 2, Math.max(0, Math.floor(point.y / frame.stepMeters)));
  return formatGridRef({ row, col });
}

/** Popis polohy: „X 12 m · Y 6 m (pole B3)“. */
export const formatPosition = (frame: PlanFrame, point: MeterPoint) => `X ${fmtM(point.x)} m · Y ${fmtM(point.y)} m (pole ${bayAt(frame, point)})`;

// ---------------------------------------------------------------------------
//  Osy a průsečíky
// ---------------------------------------------------------------------------

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
export function gridToPx(point: GridPoint, frame: PlanFrame): { x: number; y: number } {
  return { x: frame.x + (frame.w / (frame.cols - 1)) * point.col, y: frame.y + (frame.h / (frame.rows - 1)) * point.row };
}

/** Nejbližší průsečík os k bodu viewBoxu. */
export function nearestGridPoint(point: { x: number; y: number }, frame: PlanFrame): GridPoint {
  const col = Math.round(((point.x - frame.x) / frame.w) * (frame.cols - 1));
  const row = Math.round(((point.y - frame.y) / frame.h) * (frame.rows - 1));
  return { col: Math.min(frame.cols - 1, Math.max(0, col)), row: Math.min(frame.rows - 1, Math.max(0, row)) };
}

/** Nejbližší průsečík na obvodové stěně k bodu viewBoxu (vrata jedním klikem u zdi). */
export function nearestWallPoint(point: { x: number; y: number }, frame: PlanFrame): GridPoint {
  const nearest = nearestGridPoint(point, frame);
  const distances = [
    { wall: "left", d: Math.abs(point.x - frame.x) },
    { wall: "right", d: Math.abs(point.x - (frame.x + frame.w)) },
    { wall: "top", d: Math.abs(point.y - frame.y) },
    { wall: "bottom", d: Math.abs(point.y - (frame.y + frame.h)) },
  ].sort((a, b) => a.d - b.d);
  switch (distances[0].wall) {
    case "left":
      return { ...nearest, col: 0 };
    case "right":
      return { ...nearest, col: frame.cols - 1 };
    case "top":
      return { ...nearest, row: 0 };
    default:
      return { ...nearest, row: frame.rows - 1 };
  }
}

/** Je průsečík na obvodu rastru (vrata)? */
export const isWallPoint = (point: GridPoint, spec: Pick<GridSpec, "cols" | "rows">) =>
  point.col === 0 || point.col === spec.cols - 1 || point.row === 0 || point.row === spec.rows - 1;

// ---------------------------------------------------------------------------
//  Zóny a místnosti (v metrech)
// ---------------------------------------------------------------------------

export type ZoneKind = "PRODUCTION" | "OFFICE" | "ELECTRICAL" | "STORAGE" | "WORKSHOP" | "FACILITIES" | "CORRIDOR";
export const ZONE_KIND_KEYS = ["PRODUCTION", "OFFICE", "ELECTRICAL", "STORAGE", "WORKSHOP", "FACILITIES", "CORRIDOR"] as const satisfies readonly ZoneKind[];

export interface ZoneKindDef {
  label: string;
  /** Výchozí název nové místnosti („Kancelář 3“). */
  defaultName: string;
  color: string;
  /** Popis vzhledu do dlaždice. */
  look: string;
  style: RoomStyle;
}

const rgba = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};

const kind = (label: string, defaultName: string, color: string, look: string, extra: Partial<RoomStyle> = {}, alpha = 0.1): ZoneKindDef => ({
  label,
  defaultName,
  color,
  look,
  style: { fill: rgba(color, alpha), stroke: color, ...extra },
});

/** 7 logických kategorií zón a místností (barva v dlaždici, na plátně i v uloženém půdorysu). */
export const ZONE_KINDS: Record<ZoneKind, ZoneKindDef> = {
  PRODUCTION: kind("Výrobní zóna / Hala", "Výrobní zóna", "#f59e0b", "oranžová čárkovaná", { dash: "10 6" }, 0.08),
  OFFICE: kind("Administrativa / Kanceláře", "Kancelář", "#3b82f6", "modrá plná"),
  ELECTRICAL: kind("Rozvodna / Energetika (VTZ)", "Rozvodna", "#a855f7", "fialová výrazná", {}, 0.16),
  STORAGE: kind("Sklad a expedice", "Sklad", "#64748b", "břidlicově šedá", {}, 0.12),
  WORKSHOP: kind("Dílna a údržba", "Dílna", "#14b8a6", "tyrkysová"),
  FACILITIES: kind("Technické a sociální zázemí", "Zázemí", "#10b981", "smaragdově zelená"),
  CORRIDOR: kind("Chodba / Komunikace", "Chodba", "#94a3b8", "neutrální šrafovaná", { hatch: true }, 0.04),
};

/** Starší typy zón (fáze 17–34) → nové kategorie. */
export const LEGACY_ZONE_KINDS: Record<string, ZoneKind> = { HAZARD: "ELECTRICAL" };

export interface GridZone {
  /** Klíč v konceptu (stabilní při mazání a úpravách). */
  key: string;
  /** Levý horní roh od osy A1 [m]. */
  x: number;
  y: number;
  /** Šířka (osa X) a hloubka (osa Y) [m]. */
  w: number;
  h: number;
  name: string;
  kind: ZoneKind;
}

export const MIN_ZONE_M = 1;

/** Rozměr místnosti: „18 m × 12 m (216 m²)“. */
export const zoneDimensions = (zone: Pick<GridZone, "w" | "h">) => `${fmtM(zone.w)} m × ${fmtM(zone.h)} m (${fmtArea(zone.w * zone.h)} m²)`;

/** Zóna se vejde do obvodu patra a má alespoň 1 × 1 m. */
export const zoneFits = (zone: Pick<GridZone, "x" | "y" | "w" | "h">, frame: Pick<PlanFrame, "widthM" | "depthM">) =>
  zone.w >= MIN_ZONE_M - 1e-6 && zone.h >= MIN_ZONE_M - 1e-6 && zone.x >= -1e-6 && zone.y >= -1e-6 && zone.x + zone.w <= frame.widthM + 1e-6 && zone.y + zone.h <= frame.depthM + 1e-6;

/** Obdélník ze dvou bodů tažení (v metrech) – pořadí bodů nehraje roli. */
export function rectFromPoints(a: MeterPoint, b: MeterPoint) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export type ZoneHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLE_CURSORS: Record<ZoneHandle | "move", string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  move: "move",
};

/**
 * Posun stěny / rohu místnosti na bod kurzoru (metry, už přichycené). Protilehlá stěna
 * zůstává, místnost nevyjede z obvodu a nikdy nebude menší než 1 × 1 m.
 */
export function resizeZone<T extends Pick<GridZone, "x" | "y" | "w" | "h">>(zone: T, handle: ZoneHandle, point: MeterPoint, frame: Pick<PlanFrame, "widthM" | "depthM">): T {
  let left = zone.x;
  let top = zone.y;
  let right = zone.x + zone.w;
  let bottom = zone.y + zone.h;
  if (handle.includes("w")) left = Math.max(0, Math.min(point.x, right - MIN_ZONE_M));
  if (handle.includes("e")) right = Math.min(frame.widthM, Math.max(point.x, left + MIN_ZONE_M));
  if (handle.includes("n")) top = Math.max(0, Math.min(point.y, bottom - MIN_ZONE_M));
  if (handle.includes("s")) bottom = Math.min(frame.depthM, Math.max(point.y, top + MIN_ZONE_M));
  return { ...zone, x: left, y: top, w: right - left, h: bottom - top };
}

/** Posun celé místnosti o delta (metry) v hranicích obvodu. */
export function moveZone<T extends Pick<GridZone, "x" | "y" | "w" | "h">>(zone: T, dx: number, dy: number, frame: Pick<PlanFrame, "widthM" | "depthM">): T {
  return { ...zone, x: Math.min(frame.widthM - zone.w, Math.max(0, zone.x + dx)), y: Math.min(frame.depthM - zone.h, Math.max(0, zone.y + dy)) };
}

/** Zóna → obdélník půdorysu (s malou mezerou od sousedních místností) se stylem kategorie a rozměrem. */
export function zoneToRoom(zone: GridZone, frame: PlanFrame): FloorplanRoom | null {
  if (!zoneFits(zone, frame)) return null;
  const p1 = metersToPx(frame, { x: zone.x, y: zone.y });
  const p2 = metersToPx(frame, { x: zone.x + zone.w, y: zone.y + zone.h });
  const inset = Math.min(3, (p2.x - p1.x) / 6, (p2.y - p1.y) / 6);
  return {
    label: zone.name.trim() || "Místnost",
    x: Math.round((p1.x + inset) * 10) / 10,
    y: Math.round((p1.y + inset) * 10) / 10,
    w: Math.round((p2.x - p1.x - 2 * inset) * 10) / 10,
    h: Math.round((p2.y - p1.y - 2 * inset) * 10) / 10,
    kind: zone.kind === "ELECTRICAL" ? "electrical" : zone.kind === "PRODUCTION" ? "zone" : "room",
    style: ZONE_KINDS[zone.kind].style,
    subLabel: zoneDimensions(zone),
  };
}

/** Leží bod (metry) uvnitř zóny (včetně obvodu)? */
export const zoneContains = (zone: Pick<GridZone, "x" | "y" | "w" | "h">, point: MeterPoint) =>
  point.x >= zone.x - 1e-6 && point.x <= zone.x + zone.w + 1e-6 && point.y >= zone.y - 1e-6 && point.y <= zone.y + zone.h + 1e-6;

/** Nejmenší zóna obsahující bod (vnořené místnosti mají přednost). */
export function zoneAt<T extends Pick<GridZone, "x" | "y" | "w" | "h">>(zones: readonly T[], point: MeterPoint): T | null {
  return zones.filter((zone) => zoneContains(zone, point)).sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null;
}

// Buňky rastru (pole mezi sousedními osami): „B2“ leží mezi osami B–C a 2–3 – ruční zadání a šablony.

/** Počet buněk rastru (o jednu méně než os). */
export const cellCount = (spec: Pick<GridSpec, "cols" | "rows">) => ({ cols: spec.cols - 1, rows: spec.rows - 1 });

/** „B5“ → buňka { row: 1, col: 4 } (0-based); mimo rastr → `null`. */
export function parseCellRef(ref: string, spec: Pick<GridSpec, "cols" | "rows">): GridPoint | null {
  const cells = cellCount(spec);
  return parseGridRef(ref, { cols: cells.cols, rows: cells.rows });
}

/** Rozsah buněk „B2“–„B5“ → obdélník v metrech; neplatné buňky → `null`. */
export function cellsToRect(from: string, to: string, spec: Pick<GridSpec, "cols" | "rows" | "stepMeters">) {
  const a = parseCellRef(from, spec);
  const b = parseCellRef(to, spec);
  if (!a || !b) return null;
  const step = spec.stepMeters;
  const col = Math.min(a.col, b.col);
  const row = Math.min(a.row, b.row);
  return { x: col * step, y: row * step, w: (Math.max(a.col, b.col) - col + 1) * step, h: (Math.max(a.row, b.row) - row + 1) * step };
}

// ---------------------------------------------------------------------------
//  Vrata
// ---------------------------------------------------------------------------

export interface GridGate {
  at: string;
  label: string;
}

/** Vrata na obvodové stěně u průsečíku („G12“ = osa G na pravé stěně), šířka 4 m. Uvnitř rastru → `null`. */
export function gateToFloorplan(gate: GridGate, frame: PlanFrame): FloorplanGate | null {
  const point = parseGridRef(gate.at, frame);
  if (!point) return null;
  const { x, y } = gridToPx(point, frame);
  const bay = Math.min(frame.w / (frame.cols - 1), frame.h / (frame.rows - 1));
  const half = Math.max(10, Math.min(bay / 2.2, 2 * Math.min(pxPerMeter(frame).x, pxPerMeter(frame).y)));
  const label = gate.label.trim() || "Vrata";
  if (point.col === 0 || point.col === frame.cols - 1) return { x: Math.round(x), y: Math.round(y - half), length: Math.round(half * 2), orient: "v", label };
  if (point.row === 0 || point.row === frame.rows - 1) return { x: Math.round(x - half), y: Math.round(y), length: Math.round(half * 2), orient: "h", label };
  return null;
}

// ---------------------------------------------------------------------------
//  Šablony rozdělení patra (1 klik)
// ---------------------------------------------------------------------------

export const FLOOR_TEMPLATES = [
  { key: "two-lines", label: "2 výrobní linky + sklad" },
  { key: "switchroom", label: "Rozvodna + zázemí" },
  { key: "offices", label: "Kanceláře podél chodby" },
] as const;

export type FloorTemplateKey = (typeof FLOOR_TEMPLATES)[number]["key"];

/** Zóny šablony pro daný rastr (po polích rastru); funguje i pro nejmenší rastr 4 × 4 os. */
export function floorTemplate(key: FloorTemplateKey, spec: Pick<GridSpec, "cols" | "rows" | "stepMeters">): GridZone[] {
  const cells = cellCount(spec);
  const ref = (row: number, col: number) => formatGridRef({ row, col });
  const lastRow = cells.rows - 1;
  const lastCol = cells.cols - 1;
  const half = Math.max(1, Math.floor(cells.cols / 2));
  const zone = (from: string, to: string, name: string, zoneKind: ZoneKind): GridZone[] => {
    const rect = cellsToRect(from, to, spec);
    return rect ? [{ key: "", ...rect, name, kind: zoneKind }] : [];
  };
  let zones: GridZone[];
  switch (key) {
    case "two-lines": {
      const band = Math.max(1, Math.floor(cells.rows * 0.35));
      zones = [
        ...zone(ref(0, 0), ref(band - 1, lastCol), "Výrobní linka 1", "PRODUCTION"),
        ...zone(ref(band, 0), ref(Math.min(2 * band - 1, lastRow - 1), lastCol), "Výrobní linka 2", "PRODUCTION"),
        ...zone(ref(Math.min(2 * band, lastRow), 0), ref(lastRow, half - 1), "Zázemí a šatny", "FACILITIES"),
        ...zone(ref(Math.min(2 * band, lastRow), half), ref(lastRow, lastCol), "Sklad komponent", "STORAGE"),
      ];
      break;
    }
    case "switchroom": {
      const split = Math.max(1, Math.floor(cells.cols * 0.6));
      zones = [...zone(ref(0, 0), ref(lastRow, split - 1), "Rozvodna nn", "ELECTRICAL"), ...zone(ref(0, split), ref(lastRow, lastCol), "Zázemí", "FACILITIES")];
      break;
    }
    case "offices": {
      const corridor = Math.max(1, Math.floor(cells.rows / 2));
      zones = [
        ...zone(ref(0, 0), ref(corridor - 1, half - 1), "Kanceláře A", "OFFICE"),
        ...zone(ref(0, half), ref(corridor - 1, lastCol), "Kanceláře B", "OFFICE"),
        ...zone(ref(corridor, 0), ref(corridor, lastCol), "Chodba", "CORRIDOR"),
        ...(corridor + 1 <= lastRow
          ? [...zone(ref(corridor + 1, 0), ref(lastRow, half - 1), "Zasedací místnost", "OFFICE"), ...zone(ref(corridor + 1, half), ref(lastRow, lastCol), "Kuchyňka", "FACILITIES")]
          : []),
      ];
      break;
    }
  }
  return zones.map((entry, index) => ({ ...entry, key: `${key}-${index + 1}` }));
}

// ---------------------------------------------------------------------------
//  Uložený půdorys
// ---------------------------------------------------------------------------

/** Půdorys patra ze Studia: rastr, zóny, vrata, měřítko a rozměr haly; `fineGrid` = jemný pod-rastr (plátno Studia). */
export function renderGridFloorplanSvg(input: { floorName: string; spec: GridSpec; zones: GridZone[]; gates: GridGate[]; fineGrid?: boolean }): string {
  const { spec } = input;
  const frame = planFrame(spec);
  const k = pxPerMeter(frame);
  const step = fineStep(frame);
  const dims = gridDimensions(spec);
  return renderFloorplanSvg({
    floor: { name: input.floorName, viewBoxW: FLOOR_VIEWBOX.width, viewBoxH: FLOOR_VIEWBOX.height },
    outline: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
    columns: spec.cols,
    rows: spec.rows,
    rooms: input.zones.map((zone) => zoneToRoom(zone, frame)).filter((room): room is FloorplanRoom => room !== null),
    gates: input.gates.map((gate) => gateToFloorplan(gate, frame)).filter((gate): gate is FloorplanGate => gate !== null),
    scale: { label: `M ${spec.scale}`, pxPer10m: Math.round(k.x * 100) / 10, dimensions: `osa X ${fmtM(dims.widthM)} m × osa Y ${fmtM(dims.depthM)} m, rozteč ${fmtM(spec.stepMeters)} m` },
    fineGrid: input.fineGrid ? { stepX: Math.round(k.x * step * 100) / 100, stepY: Math.round(k.y * step * 100) / 100 } : undefined,
  });
}
