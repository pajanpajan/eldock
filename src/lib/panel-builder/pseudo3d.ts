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
  /** Fáze 110: položka palety a natočení značky (stěna, ke které prvek patří – odvození stěn bez místností). */
  item: string;
  rotation: number;
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
    elements.push({ id: element.id, x: element.x, y: element.y, z: elementZ(element, profile), kind: kindOf(element), symbol: item.symbol ?? "", label: item.label, room: element.room, custom: element.mountHeightMm !== null, item: element.item, rotation: element.rotation });
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

// ---------------------------------------------------------------------------
//  Fáze 110: stěny i bez nakreslených místností (PDF podklad), společný rozsah scény, virtuální místnosti
//  pro pohled na stěnu, PDF podklad na podlaze a 3D trasy kabelů
// ---------------------------------------------------------------------------

export interface PlanExtent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Úsečka stěny – nakreslená místnost, nebo odvozená obvodová stěna / příčka. */
export interface WallSegment {
  a: FixturePoint;
  b: FixturePoint;
  kind: "room" | "perimeter" | "partition";
}

function extentOf(points: readonly FixturePoint[]): PlanExtent | null {
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

const grow = (extent: PlanExtent, margin: number): PlanExtent => ({ minX: extent.minX - margin, minY: extent.minY - margin, maxX: extent.maxX + margin, maxY: extent.maxY + margin });

/**
 * Společný rozsah scény ze VŠECH místností (obdélníky i mnohoúhelníky), prvků, nábytku, oken a dveří a listu podkladu –
 * střed a výřez 3D kamery (po kalibraci měřítka PDF nejsou stěny mimo výřez).
 */
export function sceneExtent(scene: Scene, sheet: PlanExtent | null = null): PlanExtent {
  const points: FixturePoint[] = [
    ...scene.rooms.flatMap((room) => room.polygon),
    ...scene.elements,
    ...scene.furniture.flatMap((entry) => entry.geometry.corners),
    ...scene.openings.flatMap((opening) => opening.geometry.corners),
    ...(sheet ? [{ x: sheet.minX, y: sheet.minY }, { x: sheet.maxX, y: sheet.maxY }] : []),
  ];
  return extentOf(points) ?? { minX: 0, minY: 0, maxX: 5000, maxY: 4000 };
}

/** Stěny nakreslených místností (obdélník i mnohoúhelník) jako jednotné úsečky [a, b]. */
export const roomWallSegments = (scene: Scene): WallSegment[] =>
  scene.rooms.flatMap((room) => room.polygon.map((a, index) => ({ a, b: room.polygon[(index + 1) % room.polygon.length], kind: "room" as const })));

const rectWalls = (rect: PlanExtent): WallSegment[] => {
  const corners = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  return corners.map((a, index) => ({ a, b: corners[(index + 1) % 4], kind: "perimeter" as const }));
};

/** Nástěnné prvky, které leží ve stěně (zásuvky, vypínače, ovladače, rozváděč pod stropní výškou). */
const WALL_MOUNTED = new Set<SceneKind>(["socket", "switch", "control", "board"]);
const AXIS_TOLERANCE_DEG = 4;
/** Prvky a otvory do 200 mm od sebe leží na jedné stěně. */
const SAME_LINE_MM = 200;
/** Příčka do 300 mm od obvodu je obvodová stěna. */
const PERIMETER_SNAP_MM = 300;
const WALL_EXTEND_MM = 700;
const REACH_PERIMETER_MM = 2500;
const SPAN_GAP_MM = 1500;
const MAX_PARTITIONS = 16;

/** Osa stěny podle natočení značky / otvoru (0° = vodorovná stěna); šikmé natočení = bez příčky. */
function wallAxis(rotation: number): "H" | "V" | null {
  const r = ((rotation % 180) + 180) % 180;
  if (r <= AXIS_TOLERANCE_DEG || r >= 180 - AXIS_TOLERANCE_DEG) return "H";
  if (Math.abs(r - 90) <= AXIS_TOLERANCE_DEG) return "V";
  return null;
}

export interface InferredWalls {
  walls: WallSegment[];
  /** Obálka půdorysu (obvodové stěny). */
  envelope: PlanExtent;
  partitions: number;
}

/**
 * Stěny bez nakreslených místností (prvky osazené přímo na PDF podkladu): obvodové stěny podle obálky prvků, nábytku,
 * oken a dveří (otvory leží vždy ve stěně – obálka končí v jejich ose), oříznuté listem podkladu, a vnitřní příčky
 * v osách oken a dveří a nástěnných prvků, které leží v jedné linii (aspoň 2 prvky, nebo otvor).
 */
export function inferWalls(scene: Scene, sheet: PlanExtent | null = null): InferredWalls | null {
  const anchors: FixturePoint[] = [];
  for (const element of scene.elements) anchors.push({ x: element.x - 150, y: element.y - 150 }, { x: element.x + 150, y: element.y + 150 });
  for (const entry of scene.furniture) anchors.push(...entry.geometry.corners);
  for (const opening of scene.openings) anchors.push({ x: opening.geometry.cx, y: opening.geometry.cy });
  let envelope = extentOf(anchors) ?? (sheet ? grow(sheet, -Math.min(sheet.maxX - sheet.minX, sheet.maxY - sheet.minY) * 0.05) : null);
  if (!envelope) return null;
  if (sheet && envelope.maxX > sheet.minX && envelope.minX < sheet.maxX && envelope.maxY > sheet.minY && envelope.minY < sheet.maxY) {
    envelope = { minX: Math.max(envelope.minX, sheet.minX), minY: Math.max(envelope.minY, sheet.minY), maxX: Math.min(envelope.maxX, sheet.maxX), maxY: Math.min(envelope.maxY, sheet.maxY) };
  }
  // Aspoň 1 m × 1 m (jediný prvek)
  if (envelope.maxX - envelope.minX < 1000) envelope = { ...envelope, minX: (envelope.minX + envelope.maxX) / 2 - 500, maxX: (envelope.minX + envelope.maxX) / 2 + 500 };
  if (envelope.maxY - envelope.minY < 1000) envelope = { ...envelope, minY: (envelope.minY + envelope.maxY) / 2 - 500, maxY: (envelope.minY + envelope.maxY) / 2 + 500 };
  const env = envelope;

  type Candidate = { axis: "H" | "V"; at: number; from: number; to: number; opening: boolean };
  const candidates: Candidate[] = [];
  const add = (axis: "H" | "V", x: number, y: number, half: number, opening: boolean) =>
    candidates.push({ axis, at: axis === "H" ? y : x, from: (axis === "H" ? x : y) - half, to: (axis === "H" ? x : y) + half, opening });
  for (const element of scene.elements) {
    if (!WALL_MOUNTED.has(element.kind) || element.z >= 2300) continue;
    const axis = wallAxis(element.rotation);
    if (axis) add(axis, element.x, element.y, WALL_EXTEND_MM, false);
  }
  for (const opening of scene.openings) {
    const axis = wallAxis(opening.geometry.rotation);
    if (axis) add(axis, opening.geometry.cx, opening.geometry.cy, opening.geometry.w / 2 + WALL_EXTEND_MM, true);
  }
  const onPerimeter = (candidate: Candidate) =>
    candidate.axis === "H"
      ? Math.min(Math.abs(candidate.at - env.minY), Math.abs(candidate.at - env.maxY)) <= PERIMETER_SNAP_MM
      : Math.min(Math.abs(candidate.at - env.minX), Math.abs(candidate.at - env.maxX)) <= PERIMETER_SNAP_MM;
  const inner = candidates.filter((candidate) => !onPerimeter(candidate)).sort((a, b) => (a.axis === b.axis ? a.at - b.at : a.axis === "H" ? -1 : 1));

  // Linie: kandidáti stejné osy do 200 mm od sebe; příčka jen s oporou (otvor nebo aspoň 2 nástěnné prvky)
  const lines: { axis: "H" | "V"; at: number; members: Candidate[] }[] = [];
  for (const candidate of inner) {
    const last = lines.at(-1);
    if (last && last.axis === candidate.axis && Math.abs(candidate.at - last.at) <= SAME_LINE_MM) {
      last.members.push(candidate);
      last.at = last.members.reduce((sum, member) => sum + member.at, 0) / last.members.length;
    } else lines.push({ axis: candidate.axis, at: candidate.at, members: [candidate] });
  }
  const partitions: WallSegment[] = [];
  for (const line of lines) {
    if (!line.members.some((member) => member.opening) && line.members.length < 2) continue;
    const low = line.axis === "H" ? env.minX : env.minY;
    const high = line.axis === "H" ? env.maxX : env.maxY;
    const spans = line.members.map((member) => ({ from: member.from, to: member.to })).sort((a, b) => a.from - b.from);
    const merged: { from: number; to: number }[] = [];
    for (const span of spans) {
      const last = merged.at(-1);
      if (last && span.from - last.to <= SPAN_GAP_MM) last.to = Math.max(last.to, span.to);
      else merged.push({ ...span });
    }
    for (const span of merged) {
      // Konec příčky dotáhnout k obvodové stěně, je-li blízko
      const from = span.from - low <= REACH_PERIMETER_MM ? low : Math.max(low, span.from);
      const to = high - span.to <= REACH_PERIMETER_MM ? high : Math.min(high, span.to);
      if (to - from < 400) continue;
      const at = Math.round(line.at);
      partitions.push(line.axis === "H" ? { a: { x: from, y: at }, b: { x: to, y: at }, kind: "partition" } : { a: { x: at, y: from }, b: { x: at, y: to }, kind: "partition" });
      if (partitions.length >= MAX_PARTITIONS) break;
    }
    if (partitions.length >= MAX_PARTITIONS) break;
  }
  return { walls: [...rectWalls(env), ...partitions], envelope: env, partitions: partitions.length };
}

/** Virtuální „místnost“ pohledu na stěnu (celý půdorys na PDF podkladu nebo zóna rozpoznaná z prvků). */
export interface VirtualRoom {
  id: string;
  name: string;
  rect: PlanExtent;
  /** Prvky zóny; null = všechny prvky půdorysu. */
  members: string[] | null;
}

export const PLAN_AREA_ID = "__plan";
export const PLAN_AREA_NAME = "Celý půdorys (PDF podklad)";
const CLUSTER_MM = 2500;

/** Název shluku podle vybavení (kuchyňské spotřebiče a linka, koupelnové předměty, postel, gauč). */
function clusterName(members: readonly SceneElement[], furniture: readonly SceneFurniture[], rect: PlanExtent): string | null {
  const tags = new Set(members.map((element) => paletteItem(element.item)?.tag).filter(Boolean) as string[]);
  const types = new Set(furniture.filter((entry) => entry.geometry.cx >= rect.minX && entry.geometry.cx <= rect.maxX && entry.geometry.cy >= rect.minY && entry.geometry.cy <= rect.maxY).map((entry) => entry.type));
  if (["cooktop", "oven", "dishwasher", "fridge", "hood", "microwave"].some((tag) => tags.has(tag)) || types.has("kitchen") || types.has("island")) return "Kuchyň";
  if (["bath", "shower", "basin", "double_basin", "wc"].some((type) => types.has(type))) return "Koupelna";
  if (types.has("bed_double") || types.has("bed_single")) return "Ložnice";
  if (types.has("sofa") || types.has("sofa_l") || types.has("tv")) return "Obývák";
  return null;
}

/**
 * Virtuální místnosti pro pohled na stěnu: bez nakreslených místností (nebo s prvky mimo ně) celý půdorys a zóny
 * z názvů místností u prvků, případně ze shluků prvků (kuchyň, koupelna … podle vybavení).
 */
export function virtualRooms(draft: Pick<FloorplanDraft, "rooms" | "elements" | "profile">, options: { background?: boolean; envelope?: PlanExtent | null } = {}): VirtualRoom[] {
  const scene = buildScene(draft);
  const drawn = new Set(draft.rooms.flatMap((room) => [room.name, room.id]));
  const orphans = scene.elements.filter((element) => !element.room || !drawn.has(element.room));
  if (draft.rooms.length && !orphans.length) return [];
  if (!draft.rooms.length && !scene.elements.length && !options.background && !scene.furniture.length && !scene.openings.length) return [];
  const planRect = draft.rooms.length
    ? grow(extentOf(orphans) ?? sceneExtent(scene), 600)
    : (options.envelope ?? grow(extentOf([...scene.elements, ...scene.furniture.flatMap((entry) => entry.geometry.corners), ...scene.openings.map((opening) => ({ x: opening.geometry.cx, y: opening.geometry.cy }))]) ?? sceneExtent(scene), 300));
  const rooms: VirtualRoom[] = [{ id: PLAN_AREA_ID, name: options.background ? PLAN_AREA_NAME : "Celý půdorys", rect: planRect, members: draft.rooms.length ? orphans.map((element) => element.id) : null }];
  // Zóny z názvů místností u prvků (osazené na podkladu bez nakreslené místnosti)
  const named = new Map<string, SceneElement[]>();
  for (const element of orphans) {
    if (!element.room) continue;
    named.set(element.room, [...(named.get(element.room) ?? []), element]);
  }
  for (const [name, members] of named) rooms.push({ id: `zone:${name}`, name: `${name} (zóna z prvků)`, rect: grow(extentOf(members)!, 600), members: members.map((element) => element.id) });
  if (named.size) return rooms;
  // Shluky prvků (jednoduché propojení do 2,5 m), aspoň 3 prvky
  const pending = [...orphans];
  let index = 0;
  while (pending.length) {
    const cluster = [pending.shift()!];
    for (let cursor = 0; cursor < cluster.length; cursor += 1) {
      for (let other = pending.length - 1; other >= 0; other -= 1) {
        if (Math.hypot(pending[other].x - cluster[cursor].x, pending[other].y - cluster[cursor].y) <= CLUSTER_MM) cluster.push(...pending.splice(other, 1));
      }
    }
    if (cluster.length < 3 || cluster.length === orphans.length) continue;
    index += 1;
    const rect = grow(extentOf(cluster)!, 600);
    const name = clusterName(cluster, scene.furniture, rect);
    rooms.push({ id: `cluster:${index}`, name: `${name ?? `Zóna ${index}`} (shluk ${cluster.length} prvků)`, rect, members: cluster.map((element) => element.id) });
  }
  return rooms;
}

/** Stěna obdélníku z pohledu zevnitř (zleva doprava) – stejné pořadí jako u nakreslené místnosti. */
function rectWall(rect: PlanExtent, side: WallSide): { a: FixturePoint; b: FixturePoint; length: number } {
  const wall =
    side === "N"
      ? { a: { x: rect.minX, y: rect.minY }, b: { x: rect.maxX, y: rect.minY } }
      : side === "S"
        ? { a: { x: rect.maxX, y: rect.maxY }, b: { x: rect.minX, y: rect.maxY } }
        : side === "E"
          ? { a: { x: rect.maxX, y: rect.minY }, b: { x: rect.maxX, y: rect.maxY } }
          : { a: { x: rect.minX, y: rect.maxY }, b: { x: rect.minX, y: rect.minY } };
  return { ...wall, length: Math.round(Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)) };
}

/**
 * Pohled na stěnu virtuální místnosti: čelní průmět všech prvků zóny (celého půdorysu) na zvolenou stranu s pravítkem
 * 0 – strop – výšku jde měnit myší i tlačítky stejně jako u nakreslené místnosti.
 */
export function elevationOfArea(draft: Pick<FloorplanDraft, "rooms" | "elements" | "profile">, area: Pick<VirtualRoom, "rect" | "members">, side: WallSide): Elevation {
  const scene = buildScene(draft);
  const wall = rectWall(area.rect, side);
  const members = area.members ? new Set(area.members) : null;
  const within = (point: FixturePoint, margin = 300) => point.x >= area.rect.minX - margin && point.x <= area.rect.maxX + margin && point.y >= area.rect.minY - margin && point.y <= area.rect.maxY + margin;
  const along = (point: FixturePoint) => Math.round(Math.min(wall.length, Math.max(0, project(wall, point).along)));
  const elements = scene.elements
    .filter((element) => (members ? members.has(element.id) : within(element, 1000)))
    .map((element) => ({ id: element.id, along: along(element), z: element.z, kind: element.kind, symbol: element.symbol, label: element.label }));
  const openings = scene.openings
    .filter((opening) => within({ x: opening.geometry.cx, y: opening.geometry.cy }))
    .map((opening) => ({ id: opening.id, type: opening.type, along: along({ x: opening.geometry.cx, y: opening.geometry.cy }), width: opening.geometry.w, sill: opening.sill, height: opening.height }));
  const furniture = scene.furniture
    .filter((entry) => within({ x: entry.geometry.cx, y: entry.geometry.cy }))
    .map((entry) => {
      const angle = Math.abs(Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) - (entry.geometry.rotation * Math.PI) / 180) % Math.PI;
      const parallel = angle < Math.PI / 4 || angle > (3 * Math.PI) / 4;
      return { id: entry.id, label: entry.label, along: along({ x: entry.geometry.cx, y: entry.geometry.cy }), width: parallel ? entry.geometry.w : entry.geometry.d, height: entry.height };
    });
  return { lengthMm: wall.length, ceilingMm: scene.ceilingMm, elements, openings, furniture };
}

/** Prázdná stěna 5 m s pravítkem (půdorys bez prvků i podkladu) – pohled na stěnu nikdy nekončí hláškou. */
export const emptyElevation = (ceilingMm: number): Elevation => ({ lengthMm: 5000, ceilingMm, elements: [], openings: [], furniture: [] });

/**
 * Afinní matice SVG (a b c d e f) z mm půdorysu do izometrie v rovině podlahy z = 0 – stejná transformace jako
 * `isoProject` (PDF podklad a mřížka na podlaze 3D náhledu).
 */
export function isoFloorMatrix(view: IsoView, center: { x: number; y: number }): [number, number, number, number, number, number] {
  const angle = (view.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tilt = Math.min(1, Math.max(0.2, view.tilt));
  return [cos, tilt * sin, -sin, tilt * cos, -cos * center.x + sin * center.y, -tilt * (sin * center.x + cos * center.y)];
}

/** Barvy 3D tras podle vrstvy okruhu: zásuvky oranžově, spotřebiče fialově, světla žlutě, stínění zeleně, data modře, sběrnice azurově. */
export const CABLE_COLORS: Readonly<Record<string, string>> = {
  sockets: "#fb923c",
  appliance: "#c084fc",
  feeder: "#f97316",
  lighting: "#facc15",
  shading: "#4ade80",
  data: "#3b82f6",
  bus: "#22d3ee",
};

export interface CableCircuitLike {
  id: string;
  layer: string;
  routing: "BOTTOM" | "TOP";
  legs: readonly { from: string; to: string; points: readonly { x: number; y: number }[] }[];
  elementIds?: readonly string[];
}

export interface CableRun3D {
  id: string;
  layer: string;
  color: string;
  routing: "BOTTOM" | "TOP";
  points: { x: number; y: number; z: number }[];
}

/**
 * 3D trasy kabelů: úseky okruhů vodorovně po podlaze (spodem, 0 mm) nebo pod stropem (vrchem) a svislé svody po stěně
 * do výšky prvku (zásuvka 300 / 1150 mm, vypínač 1200 mm, rozváděč ve své výšce, svítidlo u stropu).
 */
export function cableRuns3D(circuits: readonly CableCircuitLike[], scene: Scene, panelZ: number): CableRun3D[] {
  const zOf = new Map(scene.elements.map((element) => [element.id, element.z]));
  const endZ = (id: string) => zOf.get(id) ?? (id.startsWith("panel") || id.startsWith("board") ? panelZ : 0);
  return circuits.flatMap((circuit) =>
    circuit.legs
      .filter((leg) => leg.points.length >= 2)
      .map((leg, index) => {
        const level = circuit.routing === "TOP" ? scene.ceilingMm : 0;
        const first = leg.points[0];
        const last = leg.points[leg.points.length - 1];
        return {
          id: `${circuit.id}:${index}`,
          layer: circuit.layer,
          color: CABLE_COLORS[circuit.layer] ?? "#e5e7eb",
          routing: circuit.routing,
          points: [{ x: first.x, y: first.y, z: endZ(leg.from) }, ...leg.points.map((point) => ({ x: point.x, y: point.y, z: level })), { x: last.x, y: last.y, z: endZ(leg.to) }],
        };
      }),
  );
}

/** Instalační zóny pro vodorovné vedení na stěně (ČSN 33 2130 ed. 4): 150–450 mm pod stropem a nad podlahou. */
export const INSTALL_ZONES = { top: { from: 150, to: 450 }, bottom: { from: 150, to: 450 } } as const;

/** Výška vodorovného vedení okruhu na stěně – osa horní / dolní instalační zóny. */
export const wallRunZ = (routing: "BOTTOM" | "TOP", ceilingMm: number) => (routing === "TOP" ? ceilingMm - 300 : 300);
