// Fáze 79: podklad CAD (DXF) v podlaží půdorysu – nastavení hladin v nákresu (`CadUnderlay`), geometrie hladin
// v souboru úložiště firmy (`CadGeometry`, JSON), kresba po hladinách a přichytávání kurzoru k vrcholům a úsečkám
// viditelných hladin (mřížka 1 m pro rychlé hledání). Čisté funkce.

import type { DxfDrawing, DxfUnits } from "./dxf-import";

export interface CadLayerState {
  name: string;
  color: string;
  entities: number;
  visible: boolean;
  /** Zamčená hladina: vyčištění balastu ji nepřepne a kurzor se k ní nepřichytává. */
  locked: boolean;
}

/** Nastavení podkladu CAD podlaží (v nákresu – malé; geometrie je v souboru `url`). */
export interface CadUnderlay {
  url: string;
  fileName: string;
  units: DxfUnits;
  unitsSource: "header" | "extent";
  widthMm: number;
  heightMm: number;
  layers: CadLayerState[];
  monochrome: boolean;
  /** Krytí podkladu 0,2–1. */
  opacity: number;
  snap: boolean;
}

export interface CadGeometry {
  version: 1;
  layers: { name: string; segments: number[]; texts: { x: number; y: number; size: number; rotation: number; value: string }[] }[];
}

export const CAD_OPACITY_MIN = 0.2;
/** Největší soubor geometrie hladin [B] – nahrává se jako `markup` (limit úložiště 10 MB). */
export const CAD_GEOMETRY_MAX_BYTES = 9.5 * 1024 * 1024;
export const DEFAULT_CAD_OPACITY = 0.8;
/** Okraj půdorysu kolem výkresu [mm]. */
export const CAD_MARGIN_MM = 1000;

/** Geometrie hladin do souboru – výkres posunutý o okraj půdorysu (`CAD_MARGIN_MM` od levého horního rohu). */
export function geometryOf(drawing: DxfDrawing, margin = CAD_MARGIN_MM): CadGeometry {
  const shift = (value: number) => Math.round((value + margin) * 10) / 10;
  return {
    version: 1,
    layers: drawing.layers.map((layer) => ({ name: layer.name, segments: layer.segments.map(shift), texts: layer.texts.map((text) => ({ ...text, x: shift(text.x), y: shift(text.y) })) })),
  };
}

/** Rozměr půdorysu pro výkres: výkres + okraj kolem dokola (aspoň stávající plocha). */
export const planSizeFor = (drawing: Pick<DxfDrawing, "widthMm" | "heightMm">, current: { widthMm: number; heightMm: number }, margin = CAD_MARGIN_MM) => ({
  widthMm: Math.max(current.widthMm, Math.ceil((drawing.widthMm + margin * 2) / 100) * 100),
  heightMm: Math.max(current.heightMm, Math.ceil((drawing.heightMm + margin * 2) / 100) * 100),
});

export function underlayOf(drawing: DxfDrawing, url: string, fileName: string): CadUnderlay {
  return {
    url,
    fileName: fileName.slice(0, 120),
    units: drawing.units,
    unitsSource: drawing.unitsSource,
    widthMm: drawing.widthMm,
    heightMm: drawing.heightMm,
    // Hladina vypnutá / zmrazená v DXF začíná skrytá
    layers: drawing.layers.map((layer) => ({ name: layer.name.slice(0, 120), color: layer.color, entities: layer.entities, visible: !layer.off, locked: false })),
    monochrome: false,
    opacity: DEFAULT_CAD_OPACITY,
    snap: true,
  };
}

const UNITS: readonly DxfUnits[] = ["mm", "cm", "m", "in", "ft"];
const HEX = /^#[0-9a-f]{6}$/i;

/** Ověření uloženého nastavení (nákres z klienta / ze serveru). */
export function parseCadUnderlay(value: unknown): CadUnderlay | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CadUnderlay>;
  if (typeof raw.url !== "string" || !raw.url.startsWith("/api/files/")) return null;
  const layers = (Array.isArray(raw.layers) ? raw.layers : [])
    .filter((layer): layer is CadLayerState => Boolean(layer) && typeof layer === "object" && typeof (layer as CadLayerState).name === "string")
    .slice(0, 500)
    .map((layer) => ({ name: layer.name.slice(0, 120), color: HEX.test(layer.color) ? layer.color : "#ffffff", entities: Math.max(0, Math.round(Number(layer.entities) || 0)), visible: layer.visible !== false, locked: layer.locked === true }));
  const size = (input: unknown) => Math.min(2_000_000, Math.max(1, Math.round(Number(input) || 1)));
  return {
    url: raw.url,
    fileName: typeof raw.fileName === "string" ? raw.fileName.slice(0, 120) : "vykres.dxf",
    units: UNITS.includes(raw.units as DxfUnits) ? (raw.units as DxfUnits) : "mm",
    unitsSource: raw.unitsSource === "header" ? "header" : "extent",
    widthMm: size(raw.widthMm),
    heightMm: size(raw.heightMm),
    layers,
    monochrome: raw.monochrome === true,
    opacity: Math.min(1, Math.max(CAD_OPACITY_MIN, Number(raw.opacity) || DEFAULT_CAD_OPACITY)),
    snap: raw.snap !== false,
  };
}

export function parseCadGeometry(value: unknown): CadGeometry | null {
  if (!value || typeof value !== "object" || (value as CadGeometry).version !== 1 || !Array.isArray((value as CadGeometry).layers)) return null;
  return value as CadGeometry;
}

/** Cesta SVG hladiny z úseček (navazující úsečky bez nového „M“). */
export function layerPath(segments: readonly number[]): string {
  let d = "";
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  for (let index = 0; index + 3 < segments.length; index += 4) {
    const [x1, y1, x2, y2] = [segments[index], segments[index + 1], segments[index + 2], segments[index + 3]];
    if (x1 !== lastX || y1 !== lastY) d += `M${x1} ${y1}`;
    d += `L${x2} ${y2}`;
    lastX = x2;
    lastY = y2;
  }
  return d;
}

/** Barva čáry hladiny: šedá při ztlumení, jinak barva hladiny (bílá ACI 7 na bílém podkladu tmavá). */
export const layerStroke = (layer: Pick<CadLayerState, "color">, monochrome: boolean, onPaper = false) => (monochrome ? "#9ca3af" : onPaper && layer.color.toLowerCase() === "#ffffff" ? "#111827" : layer.color);

// ---------------------------------------------------------------------------
//  Přichytávání (CAD Snap)
// ---------------------------------------------------------------------------

const CELL_MM = 1000;

export interface SnapIndex {
  cells: Map<string, number[]>;
  segments: number[];
}

/** Mřížka 1 m → úsečky viditelných a nezamčených hladin. */
export function buildSnapIndex(geometry: CadGeometry, underlay: Pick<CadUnderlay, "layers">): SnapIndex {
  const usable = new Set(underlay.layers.filter((layer) => layer.visible && !layer.locked).map((layer) => layer.name));
  const segments: number[] = [];
  const cells = new Map<string, number[]>();
  for (const layer of geometry.layers) {
    if (!usable.has(layer.name)) continue;
    for (let index = 0; index + 3 < layer.segments.length; index += 4) {
      const at = segments.length;
      segments.push(layer.segments[index], layer.segments[index + 1], layer.segments[index + 2], layer.segments[index + 3]);
      const [x1, y1, x2, y2] = [layer.segments[index], layer.segments[index + 1], layer.segments[index + 2], layer.segments[index + 3]];
      for (let cx = Math.floor(Math.min(x1, x2) / CELL_MM); cx <= Math.floor(Math.max(x1, x2) / CELL_MM); cx++) {
        for (let cy = Math.floor(Math.min(y1, y2) / CELL_MM); cy <= Math.floor(Math.max(y1, y2) / CELL_MM); cy++) {
          const key = `${cx}:${cy}`;
          const list = cells.get(key);
          if (list) list.push(at);
          else cells.set(key, [at]);
        }
      }
    }
  }
  return { cells, segments };
}

export interface SnapHit {
  x: number;
  y: number;
  kind: "vertex" | "edge";
}

/**
 * Nejbližší vrchol do `radius` (přednost), jinak nejbližší bod úsečky; null = nic blízko. Souřadnice v mm půdorysu
 * (posun podkladu už odečtený).
 */
export function snapToCad(index: SnapIndex, x: number, y: number, radius: number): SnapHit | null {
  let vertex: SnapHit | null = null;
  let vertexDist = radius;
  let edge: SnapHit | null = null;
  let edgeDist = radius;
  const seen = new Set<number>();
  for (let cx = Math.floor((x - radius) / CELL_MM); cx <= Math.floor((x + radius) / CELL_MM); cx++) {
    for (let cy = Math.floor((y - radius) / CELL_MM); cy <= Math.floor((y + radius) / CELL_MM); cy++) {
      for (const at of index.cells.get(`${cx}:${cy}`) ?? []) {
        if (seen.has(at)) continue;
        seen.add(at);
        const [x1, y1, x2, y2] = [index.segments[at], index.segments[at + 1], index.segments[at + 2], index.segments[at + 3]];
        for (const [px, py] of [
          [x1, y1],
          [x2, y2],
        ]) {
          const distance = Math.hypot(px - x, py - y);
          if (distance <= vertexDist) {
            vertexDist = distance;
            vertex = { x: px, y: py, kind: "vertex" };
          }
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = dx * dx + dy * dy;
        if (!length) continue;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        const distance = Math.hypot(px - x, py - y);
        if (distance <= edgeDist) {
          edgeDist = distance;
          edge = { x: px, y: py, kind: "edge" };
        }
      }
    }
  }
  return vertex ?? edge;
}
