// Fáze 89: místnost zadáním přesných rozměrů Šířka X × Hloubka Y (předvolby názvů, metry i milimetry, tečka i čárka),
// vložení na volné místo plochy a magnetické přichytávání stěn a rohů přesouvané místnosti k ostatním místnostem
// (tolerance 150 mm, vodicí čáry) – půdorys domu se skládá z místností jako stavebnice bez mezer a překryvů.
// Čisté funkce – sdílí editor půdorysu a testy.

import { PLANE_EDGE_MM, PLANE_MAX_MM, resizePlane } from "./floorplan-plane";
import type { EditorRoom, FloorplanDraft } from "./floorplan-editor";

/** Předvolby názvu / typu místnosti s typickým rozměrem k předvyplnění (rozměr jde vždy přepsat). */
export const ROOM_PRESETS = [
  { name: "Obývací pokoj", w: 5_000, h: 4_000 },
  { name: "Kuchyň", w: 3_500, h: 3_000 },
  { name: "Obývák + KK", w: 7_000, h: 4_500 },
  { name: "Ložnice", w: 4_000, h: 3_500 },
  { name: "Dětský pokoj", w: 3_500, h: 3_200 },
  { name: "Pracovna", w: 3_200, h: 2_800 },
  { name: "Koupelna", w: 2_500, h: 2_200 },
  { name: "WC", w: 1_500, h: 1_000 },
  { name: "Chodba / Zádveří", w: 4_000, h: 1_500 },
  { name: "Technická místnost", w: 2_500, h: 2_000 },
  { name: "Šatna", w: 2_000, h: 1_800 },
  { name: "Spíž", w: 1_500, h: 1_200 },
  { name: "Garáž", w: 6_000, h: 3_500 },
] as const;

export const ROOM_MIN_MM = 500;
export const ROOM_MAX_MM = PLANE_MAX_MM;
/** Tolerance magnetického přichytávání stěn a rohů [mm]. */
export const ROOM_SNAP_MM = 150;
/** Odstup nové místnosti od okraje plochy a od ostatních místností [mm]. */
const MARGIN_MM = 1_000;
const GAP_MM = 500;
const STEP_MM = 500;

export type SizeUnit = "m" | "mm";

/** Rozměr z pole formuláře (tečka i čárka, mezery jako oddělovač tisíců); mimo 0,5–100 m nebo neplatný → null. */
export function parseRoomSize(text: string, unit: SizeUnit = "m"): number | null {
  const value = Number(text.trim().replace(/\s+/g, "").replace(",", "."));
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return null;
  const mm = Math.round(unit === "mm" ? value : value * 1000);
  return mm >= ROOM_MIN_MM && mm <= ROOM_MAX_MM ? mm : null;
}

/** Hodnota do pole formuláře v jednotce („4,5“ m / „4500“ mm). */
export const formatRoomSize = (mm: number, unit: SizeUnit = "m") => (unit === "mm" ? String(Math.round(mm)) : (mm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 3 }));

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/**
 * Volné místo pro novou místnost: první pozice v rastru 0,5 m zleva shora, kde nepřekryje žádnou místnost (s odstupem
 * 0,5 m – uživatel ji pak sám přisune); nevejde-li se do plochy, vpravo vedle nákresu (plocha se rozšíří).
 */
export function freeSpot(rooms: readonly Rect[], plane: { widthMm: number; heightMm: number }, size: { w: number; h: number }): { x: number; y: number } {
  for (let y = MARGIN_MM; y + size.h <= plane.heightMm - MARGIN_MM / 2; y += STEP_MM) {
    for (let x = MARGIN_MM; x + size.w <= plane.widthMm - MARGIN_MM / 2; x += STEP_MM) {
      const rect = { x, y, ...size };
      if (!rooms.some((room) => overlaps(rect, room, GAP_MM))) return { x, y };
    }
  }
  const right = Math.max(0, ...rooms.map((room) => room.x + room.w));
  return { x: Math.ceil((right + MARGIN_MM) / STEP_MM) * STEP_MM, y: MARGIN_MM };
}

/** Unikátní název místnosti na podlaží („Ložnice“, „Ložnice 2“). */
export function uniqueRoomName(rooms: readonly Pick<EditorRoom, "name">[], base: string): string {
  const clean = base.trim().slice(0, 40) || "Místnost";
  const names = new Set(rooms.map((room) => room.name));
  if (!names.has(clean)) return clean;
  for (let index = 2; ; index++) {
    const name = `${clean.slice(0, 36)} ${index}`;
    if (!names.has(name)) return name;
  }
}

/**
 * Nová obdélníková místnost Šířka X × Hloubka Y na volném místě aktivního podlaží; prvky, které v ní leží, do ní patří.
 * Plocha se rozšíří, když se místnost nevejde. Vrací nový nákres i místnost (editor ji vybere a přepne na přesun).
 */
export function addRoomBySize(draft: FloorplanDraft, input: { name: string; w: number; h: number; id: string }): { draft: FloorplanDraft; room: EditorRoom } {
  const w = Math.min(ROOM_MAX_MM, Math.max(ROOM_MIN_MM, Math.round(input.w)));
  const h = Math.min(ROOM_MAX_MM, Math.max(ROOM_MIN_MM, Math.round(input.h)));
  const spot = freeSpot(draft.rooms, draft, { w, h });
  const room: EditorRoom = { id: input.id, name: uniqueRoomName(draft.rooms, input.name), x: spot.x, y: spot.y, w, h };
  const grown = draft.background ? draft : resizePlane(draft, Math.max(draft.widthMm, room.x + w + PLANE_EDGE_MM), Math.max(draft.heightMm, room.y + h + PLANE_EDGE_MM)).draft;
  const inside = (x: number, y: number) => x >= room.x && x <= room.x + w && y >= room.y && y <= room.y + h;
  return {
    room,
    draft: { ...grown, rooms: [...grown.rooms, room], elements: grown.elements.map((element) => (inside(element.x, element.y) ? { ...element, room: room.name } : element)) },
  };
}

export interface SnapGuide {
  axis: "x" | "y";
  /** Poloha vodicí čáry (x u svislé, y u vodorovné) [mm]. */
  at: number;
  from: number;
  to: number;
  /** „wall“ = stěna ke stěně (místnosti na sebe navazují), „align“ = zarovnání stejných stěn. */
  kind: "wall" | "align";
}

/** Rozsahy se překrývají nebo se dotýkají do tolerance – místnosti jsou sousední v dané ose. */
const near = (a0: number, a1: number, b0: number, b1: number, tolerance: number) => a0 <= b1 + tolerance && b0 <= a1 + tolerance;

/**
 * Magnetické přichytávání přesouvané místnosti: v každé ose nejbližší hrana sousední místnosti do tolerance (líc na líc
 * = stěna ke stěně, nebo zarovnání stejných stěn), obě osy zároveň = přichycení do rohu. Vrací posunutý obdélník
 * a vodicí čáry k vykreslení (modrá = stěna ke stěně, žlutá = zarovnání).
 */
export function snapRoomRect(rect: Rect, others: readonly Rect[], tolerance = ROOM_SNAP_MM): { x: number; y: number; guides: SnapGuide[] } {
  type Hit = { delta: number; target: number; other: Rect; kind: SnapGuide["kind"] };
  const best = (axis: "x" | "y"): Hit | null => {
    let hit: Hit | null = null;
    for (const other of others) {
      const neighbour = axis === "x" ? near(rect.y, rect.y + rect.h, other.y, other.y + other.h, tolerance) : near(rect.x, rect.x + rect.w, other.x, other.x + other.w, tolerance);
      if (!neighbour) continue;
      const start = axis === "x" ? rect.x : rect.y;
      const size = axis === "x" ? rect.w : rect.h;
      const otherStart = axis === "x" ? other.x : other.y;
      const otherEnd = otherStart + (axis === "x" ? other.w : other.h);
      const candidates: { delta: number; target: number; kind: SnapGuide["kind"] }[] = [
        { delta: otherEnd - start, target: otherEnd, kind: "wall" },
        { delta: otherStart - (start + size), target: otherStart, kind: "wall" },
        { delta: otherStart - start, target: otherStart, kind: "align" },
        { delta: otherEnd - (start + size), target: otherEnd, kind: "align" },
      ];
      for (const candidate of candidates) {
        if (Math.abs(candidate.delta) > tolerance) continue;
        // Stěna ke stěně má přednost před zarovnáním při stejné vzdálenosti
        if (!hit || Math.abs(candidate.delta) < Math.abs(hit.delta) || (Math.abs(candidate.delta) === Math.abs(hit.delta) && candidate.kind === "wall" && hit.kind === "align")) hit = { ...candidate, other };
      }
    }
    return hit;
  };
  const hx = best("x");
  const hy = best("y");
  const x = rect.x + (hx?.delta ?? 0);
  const y = rect.y + (hy?.delta ?? 0);
  const guides: SnapGuide[] = [];
  if (hx) guides.push({ axis: "x", at: hx.target, from: Math.min(y, hx.other.y), to: Math.max(y + rect.h, hx.other.y + hx.other.h), kind: hx.kind });
  if (hy) guides.push({ axis: "y", at: hy.target, from: Math.min(x, hy.other.x), to: Math.max(x + rect.w, hy.other.x + hy.other.w), kind: hy.kind });
  return { x, y, guides };
}

/** Plocha překryvu dvou obdélníků [mm²] – test „bez překryvů“ po přichycení. */
export const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
