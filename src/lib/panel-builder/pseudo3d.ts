// Fáze 105: Pseudo-3D náhled 2D půdorysu – izometrický pohled (stěny vytažené do výšky stropu, okna, dveře, nábytek
// a prvky ve skutečné výšce Z) a rozvinutý pohled na stěnu místnosti (S / V / J / Z s pravítkem výšek). Čistá geometrie
// bez Reactu: scéna z nákresu, promítání, kolize výšek (zásuvka schovaná za kuchyňskou linkou) a úprava výšek prvků.

import { DEFAULT_ELEVATION, mountHeight, type ElevationProfile } from "@/engine/floorplan-bridge";

import { fixtureGeometry, fixtureSpecOf, toLocal, type FixtureGeometry, type FixturePoint } from "./fixtures";
import { paletteItem, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { roomPolygon } from "./room-geometry";

/** Výšky stavebních otvorů a nábytku [mm] (parapet okna 900, okno 1400, dveře 2000, linka 900, stůl 750). */
export const OPENING_HEIGHTS: Record<string, { sill: number; height: number }> = {
  window_1: { sill: 900, height: 1400 },
  window_2: { sill: 900, height: 1400 },
  window_hs: { sill: 0, height: 2200 },
  door_1: { sill: 0, height: 2000 },
  door_2: { sill: 0, height: 2000 },
  door_sliding: { sill: 0, height: 2000 },
};

export const FURNITURE_HEIGHTS: Record<string, number> = {
  bed_double: 500,
  bed_single: 500,
  sofa_l: 800,
  sofa: 800,
  table_dining: 750,
  desk: 750,
  kitchen: 900,
  island: 900,
  wardrobe: 2000,
  tv: 500,
  wc: 400,
  exam_bed: 700,
  bath: 600,
  shower: 2000,
  basin: 850,
  double_basin: 850,
};

/** Hladiny výškového pravítka pohledu na stěnu [mm]. */
export const HEIGHT_LEVELS: readonly { mm: number; label: string }[] = [
  { mm: 300, label: "300 mm – zásuvky u podlahy" },
  { mm: 900, label: "900 mm – horní hrana linky" },
  { mm: 1150, label: "1150 mm – zásuvky nad linkou / v koupelně" },
  { mm: 1200, label: "1200 mm – vypínače" },
  { mm: 1500, label: "1500 mm – termostaty, displeje, RH" },
];

/** Rychlé výšky v editoru výšky prvku [mm]. */
export const HEIGHT_PRESETS = [300, 1150, 1200, 1500, 2000, 2200] as const;
export const WORKTOP_SOCKET_MM = 1150;

export type SceneKind = "socket" | "switch" | "light" | "board" | "control" | "appliance" | "other";

export interface SceneElement {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: SceneKind;
  symbol: string;
  label: string;
  room: string;
  /** Vlastní výška (ne výchozí podle profilu). */
  custom: boolean;
}

export interface SceneOpening {
  id: string;
  type: string;
  geometry: FixtureGeometry;
  sill: number;
  height: number;
}

export interface SceneFurniture {
  id: string;
  type: string;
  label: string;
  geometry: FixtureGeometry;
  height: number;
}

export interface SceneRoom {
  id: string;
  name: string;
  polygon: FixturePoint[];
}

export interface Scene {
  ceilingMm: number;
  rooms: SceneRoom[];
  openings: SceneOpening[];
  furniture: SceneFurniture[];
  elements: SceneElement[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function kindOf(element: EditorElement): SceneKind {
  const item = paletteItem(element.item);
  if (!item) return "other";
  if (item.kind === "panel") return "board";
  if (item.kind === "light") return "light";
  // Fáze 109: ovladače bez párování světel (termostat, čidlo, magnet) tyrkysově – vypínače zeleně
  if (item.kind === "switch") return item.control === "thermostat" || item.control === "none" || item.sensor ? "control" : "switch";
  if (item.kind === "appliance") return "appliance";
  if (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket") return "socket";
  if (item.control || item.sensor || item.bus) return "control";
  return "other";
}

/** Výška prvku nad podlahou [mm] – vlastní, jinak výchozí podle druhu a výškového profilu nákresu. */
export function elementZ(element: EditorElement, profile: ElevationProfile = DEFAULT_ELEVATION): number {
  const item = paletteItem(element.item);
  if (!item) return element.mountHeightMm ?? profile.defaultSocketHeightMm;
  const kind = item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" ? "socket" : item.kind;
  if (kindOf(element) === "board") return element.mountHeightMm ?? profile.switchboardHeightMm;
  return mountHeight({ kind: kind as never, mountHeightMm: element.mountHeightMm ?? undefined, variant: item.variant as never, tag: item.tag as never }, profile);
}

/** Scéna Pseudo-3D z nákresu (místnosti, otvory, nábytek, prvky ve výšce Z). */
export function buildScene(draft: Pick<FloorplanDraft, "rooms" | "elements" | "profile">): Scene {
  const profile = draft.profile ?? DEFAULT_ELEVATION;
  const rooms = draft.rooms.map((room) => ({ id: room.id, name: room.name, polygon: roomPolygon(room) }));
  const openings: SceneOpening[] = [];
  const furniture: SceneFurniture[] = [];
  const elements: SceneElement[] = [];
  for (const element of draft.elements) {
    const spec = fixtureSpecOf(element.item);
    const geometry = spec ? fixtureGeometry(element) : null;
    if (spec && geometry) {
      if (spec.arch === "opening") openings.push({ id: element.id, type: spec.type, geometry, ...(OPENING_HEIGHTS[spec.type] ?? { sill: 0, height: 2000 }) });
      else furniture.push({ id: element.id, type: spec.type, label: spec.label, geometry, height: FURNITURE_HEIGHTS[spec.type] ?? 750 });
      continue;
    }
    const item = paletteItem(element.item);
    if (!item) continue;
    elements.push({ id: element.id, x: element.x, y: element.y, z: elementZ(element, profile), kind: kindOf(element), symbol: item.symbol ?? "", label: item.label, room: element.room, custom: element.mountHeightMm !== null });
  }
  const points = [...rooms.flatMap((room) => room.polygon), ...elements, ...furniture.flatMap((entry) => entry.geometry.corners)];
  const bounds = points.length ? { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) } : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  return { ceilingMm: profile.ceilingHeightMm, rooms, openings, furniture, elements, bounds };
}

// ---------------------------------------------------------------------------
//  Izometrické promítání
// ---------------------------------------------------------------------------

export interface IsoView {
  /** Otočení půdorysu kolem svislé osy [°] (po 90°, volně po 15°). */
  rotation: number;
  /** Náklon pohledu 0,35 (shora) – 1 (z boku); výška Z se násobí stejným poměrem. */
  tilt: number;
}

export const DEFAULT_ISO: IsoView = { rotation: 45, tilt: 0.55 };

/** Bod půdorysu ve výšce Z → souřadnice izometrického obrázku (osa y dolů, výška nahoru). */
export function isoProject(point: { x: number; y: number; z?: number }, view: IsoView, center: { x: number; y: number }) {
  const angle = (view.rotation * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  const tilt = Math.min(1, Math.max(0.2, view.tilt));
  // Hloubka (pro řazení malíře): vzdálenější body mají menší hloubku
  return { x: rx, y: ry * tilt - (point.z ?? 0) * Math.sqrt(1 - tilt * tilt), depth: ry };
}

// ---------------------------------------------------------------------------
//  Kolize výšek
// ---------------------------------------------------------------------------

export interface HeightIssue {
  id: string;
  elementIds: string[];
  text: string;
  /** Oprava jedním klikem (výška prvků). */
  fix?: { label: string; heightMm: number };
}

const inside = (geometry: FixtureGeometry, x: number, y: number, margin: number) => {
  const local = toLocal(geometry, x, y);
  return Math.abs(local.u) <= geometry.w / 2 + margin && Math.abs(local.v) <= geometry.d / 2 + margin;
};

/**
 * Výškové kolize: zásuvka nebo vypínač pod horní hranou kuchyňské linky / ostrůvku (900 mm) v jejím půdorysu (zásuvka
 * za linkou místo 1150 mm nad ní), prvek ve skříni, vypínač za otevřenými dveřmi nebo prvek v okně (pod parapetem
 * ne, v otvoru ano).
 */
export function heightIssues(draft: Pick<FloorplanDraft, "rooms" | "elements" | "profile">): HeightIssue[] {
  const scene = buildScene(draft);
  const issues: HeightIssue[] = [];
  const counters = scene.furniture.filter((entry) => entry.type === "kitchen" || entry.type === "island");
  const hidden = scene.elements.filter((element) => (element.kind === "socket" || element.kind === "switch") && element.z < 1000 && counters.some((counter) => inside(counter.geometry, element.x, element.y, 150)));
  if (hidden.length) {
    issues.push({
      id: "worktop",
      elementIds: hidden.map((element) => element.id),
      text: `${hidden.length === 1 ? "Zásuvka / vypínač je" : `${hidden.length} zásuvky / vypínače jsou`} ve výšce ${[...new Set(hidden.map((element) => `${Math.round(element.z)} mm`))].join(", ")} schované za kuchyňskou linkou (horní hrana 900 mm) – nad linkou patří do 1150 mm.`,
      fix: { label: `Zvýšit zásuvky u linky na ${WORKTOP_SOCKET_MM} mm`, heightMm: WORKTOP_SOCKET_MM },
    });
  }
  for (const wardrobe of scene.furniture.filter((entry) => entry.type === "wardrobe")) {
    const blocked = scene.elements.filter((element) => element.kind !== "light" && element.z < wardrobe.height && inside(wardrobe.geometry, element.x, element.y, 50));
    if (blocked.length) issues.push({ id: `wardrobe-${wardrobe.id}`, elementIds: blocked.map((element) => element.id), text: `${blocked.length} ${blocked.length === 1 ? "prvek je" : "prvky jsou"} za vestavěnou skříní (výška ${wardrobe.height} mm) – přesuňte je mimo skříň.` });
  }
  for (const opening of scene.openings) {
    const blocked = scene.elements.filter((element) => element.kind !== "light" && element.z >= opening.sill && element.z <= opening.sill + opening.height && inside(opening.geometry, element.x, element.y, 60));
    if (blocked.length) issues.push({ id: `opening-${opening.id}`, elementIds: blocked.map((element) => element.id), text: `${blocked.length} ${blocked.length === 1 ? "prvek je" : "prvky jsou"} v ${opening.type.startsWith("door") ? "dveřním" : "okenním"} otvoru (${opening.sill}–${opening.sill + opening.height} mm) – posuňte ${blocked.length === 1 ? "ho" : "je"} na stěnu vedle otvoru.` });
  }
  return issues;
}

/** Nová výška prvků (null = výchozí podle profilu). */
export function setHeights(draft: FloorplanDraft, ids: readonly string[], heightMm: number | null): FloorplanDraft {
  const wanted = new Set(ids);
  const ceiling = (draft.profile ?? DEFAULT_ELEVATION).ceilingHeightMm;
  const value = heightMm === null ? null : Math.round(Math.min(ceiling, Math.max(0, heightMm)));
  return { ...draft, elements: draft.elements.map((element) => (wanted.has(element.id) ? { ...element, mountHeightMm: value } : element)) };
}

// ---------------------------------------------------------------------------
//  Rozvinutý pohled na stěnu
// ---------------------------------------------------------------------------

export type WallSide = "N" | "E" | "S" | "W";
export const WALL_SIDES: readonly { id: WallSide; label: string }[] = [
  { id: "N", label: "Severní" },
  { id: "E", label: "Východní" },
  { id: "S", label: "Jižní" },
  { id: "W", label: "Západní" },
];

/** Stěna místnosti na dané světové straně (sever = horní okraj půdorysu) – nejdelší hrana s vnější normálou k té straně. */
export function wallOf(room: Pick<EditorRoom, "x" | "y" | "w" | "h" | "points">, side: WallSide): { a: FixturePoint; b: FixturePoint; length: number } | null {
  const polygon = roomPolygon(room as EditorRoom);
  if (polygon.length < 3) return null;
  const cx = polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length;
  const cy = polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length;
  const target = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } }[side];
  let best: { a: FixturePoint; b: FixturePoint; length: number; score: number } | null = null;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 200) continue;
    // Vnější normála hrany (od středu místnosti)
    let nx = (b.y - a.y) / length;
    let ny = -(b.x - a.x) / length;
    const mx = (a.x + b.x) / 2 - cx;
    const my = (a.y + b.y) / 2 - cy;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    const facing = nx * target.x + ny * target.y;
    if (facing < 0.5) continue;
    const score = facing * length;
    if (!best || score > best.score) best = { a, b, length, score };
  }
  if (!best) return null;
  // Pohled zevnitř místnosti na stěnu: zleva doprava
  const { a, b } = best;
  const ordered = (side === "N" && a.x > b.x) || (side === "S" && a.x < b.x) || (side === "E" && a.y > b.y) || (side === "W" && a.y < b.y) ? { a: b, b: a } : { a, b };
  return { ...ordered, length: Math.round(best.length) };
}

export interface ElevationItem {
  id: string;
  /** Poloha podél stěny zleva [mm]. */
  along: number;
  z: number;
  kind: SceneKind;
  symbol: string;
  label: string;
}

export interface Elevation {
  lengthMm: number;
  ceilingMm: number;
  elements: ElevationItem[];
  openings: { id: string; type: string; along: number; width: number; sill: number; height: number }[];
  furniture: { id: string; label: string; along: number; width: number; height: number }[];
}

const project = (wall: { a: FixturePoint; b: FixturePoint; length: number }, point: FixturePoint) => {
  const ux = (wall.b.x - wall.a.x) / wall.length;
  const uy = (wall.b.y - wall.a.y) / wall.length;
  const along = (point.x - wall.a.x) * ux + (point.y - wall.a.y) * uy;
  const offset = Math.abs((point.x - wall.a.x) * -uy + (point.y - wall.a.y) * ux);
  return { along, offset };
};

/** Prvky, otvory a nábytek u stěny místnosti (do 450 mm od stěny) v rozvinutém pohledu. */
export function elevationOf(draft: Pick<FloorplanDraft, "rooms" | "elements" | "profile">, roomId: string, side: WallSide): Elevation | null {
  const room = draft.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return null;
  const wall = wallOf(room, side);
  if (!wall) return null;
  const scene = buildScene(draft);
  const near = (point: FixturePoint, reach = 450) => {
    const { along, offset } = project(wall, point);
    return along >= -50 && along <= wall.length + 50 && offset <= reach ? Math.round(along) : null;
  };
  const elements = scene.elements.flatMap((element) => {
    if (element.room !== room.name && element.room !== room.id) return [];
    const along = near(element);
    return along === null ? [] : [{ id: element.id, along, z: element.z, kind: element.kind, symbol: element.symbol, label: element.label }];
  });
  const openings = scene.openings.flatMap((opening) => {
    const along = near({ x: opening.geometry.cx, y: opening.geometry.cy }, 500);
    return along === null ? [] : [{ id: opening.id, type: opening.type, along, width: opening.geometry.w, sill: opening.sill, height: opening.height }];
  });
  const furniture = scene.furniture.flatMap((entry) => {
    const along = near({ x: entry.geometry.cx, y: entry.geometry.cy }, Math.max(entry.geometry.d, entry.geometry.w) / 2 + 300);
    if (along === null) return [];
    const angle = Math.abs(Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) - (entry.geometry.rotation * Math.PI) / 180) % Math.PI;
    const parallel = angle < Math.PI / 4 || angle > (3 * Math.PI) / 4;
    return [{ id: entry.id, label: entry.label, along, width: parallel ? entry.geometry.w : entry.geometry.d, height: entry.height }];
  });
  return { lengthMm: wall.length, ceilingMm: scene.ceilingMm, elements, openings, furniture };
}
