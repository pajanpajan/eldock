// Fáze 83: nastavitelná plocha 2D půdorysu pro velké domy a haly – čistý rastr 5 až 100 m (výchozí 20 × 16 m),
// předvolby velikosti, rozšíření o 5 m, když nákres dojde k pravému / dolnímu okraji, a pohled „Přizpůsobit“ na celý
// nákres. Plocha = `FloorplanDraft.widthMm` / `heightMm` (a stejná pole podlaží) – ukládá se s nákresem do cloudu,
// prohlížeče i souboru `.eldock.json`; souřadnice místností a prvků v mm se při změně plochy nemění. Podlaží s podkladem
// (obrázek / PDF) má plochu podle podkladu. Čisté funkce.

import { CAD_MARGIN_MM } from "./cad-underlay";
import type { FloorplanDraft, FloorSheet } from "./floorplan-editor";
import { fitView, type PlanView } from "./floorplan-pdf";
import { contentBox } from "./plan-sheet";
import { roomPolygon } from "./room-geometry";

export const PLANE_MIN_MM = 5_000;
export const PLANE_MAX_MM = 100_000;
/** Rozšíření plochy, když nákres dojde k okraji [mm]. */
export const PLANE_GROW_MM = 5_000;
/** Vzdálenost obsahu od pravého / dolního okraje, při které se plocha rozšíří [mm]. */
export const PLANE_EDGE_MM = 1_000;
/** Výchozí plocha nového čistého rastru – rodinný dům 15 × 14 m se vejde s rezervou. */
export const DEFAULT_PLANE = { widthMm: 20_000, heightMm: 16_000 } as const;

export const PLANE_PRESETS = [
  { id: "flat", label: "Byt / Menší RD (14 × 10 m)", widthMm: 14_000, heightMm: 10_000 },
  { id: "house", label: "Rodinný dům standard (20 × 16 m)", widthMm: 20_000, heightMm: 16_000 },
  { id: "villa", label: "Velký RD / Vila s dvojgaráží (30 × 22 m)", widthMm: 30_000, heightMm: 22_000 },
  { id: "hall", label: "Provozovna / Hala (50 × 35 m)", widthMm: 50_000, heightMm: 35_000 },
] as const;
export type PlanePresetId = (typeof PLANE_PRESETS)[number]["id"] | "custom";

/** Předvolba podle rozměru (jinak vlastní rozměr). */
export const planePresetOf = (widthMm: number, heightMm: number): PlanePresetId => PLANE_PRESETS.find((preset) => preset.widthMm === widthMm && preset.heightMm === heightMm)?.id ?? "custom";

type Content = Pick<FloorSheet, "rooms" | "elements" | "annotations"> & Partial<Pick<FloorSheet, "cad">>;

/** Pravý a dolní okraj nákresu podlaží (místnosti, prvky, zakreslené změny, podklad CAD s okrajem) [mm]; prázdné podlaží = 0. */
export function contentExtent(sheet: Content): { maxX: number; maxY: number } {
  let maxX = 0;
  let maxY = 0;
  const add = (x: number, y: number) => {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const room of sheet.rooms) for (const point of roomPolygon(room)) add(point.x, point.y);
  for (const element of sheet.elements) add(element.x, element.y);
  for (const note of sheet.annotations) {
    add(note.x, note.y);
    add(note.x2, note.y2);
  }
  // Podklad CAD: výkres + okraj kolem dokola (`planSizeFor`) – plocha nejde zmenšit pod výkres
  if (sheet.cad) add(sheet.cad.widthMm + CAD_MARGIN_MM * 2, sheet.cad.heightMm + CAD_MARGIN_MM * 2);
  return { maxX, maxY };
}

/** Na celých 0,5 m nahoru. */
const roundUp = (mm: number) => Math.ceil(mm / 500) * 500;
const clampPlane = (mm: number, min: number) => Math.min(PLANE_MAX_MM, Math.max(PLANE_MIN_MM, roundUp(min), Math.round(mm / 100) * 100));

/**
 * Nová velikost plochy (5–100 m, nikdy menší než nákres): aktivní podlaží a ostatní podlaží bez podkladu (ta aspoň
 * na svůj obsah). `clamped` = požadovaný rozměr byl mimo rozsah nebo menší než nákres.
 */
export function resizePlane(draft: FloorplanDraft, widthMm: number, heightMm: number): { draft: FloorplanDraft; clamped: boolean } {
  if (draft.background || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return { draft, clamped: false };
  const own = contentExtent(draft);
  const w = clampPlane(widthMm, own.maxX);
  const h = clampPlane(heightMm, own.maxY);
  const clamped = w !== Math.round(widthMm / 100) * 100 || h !== Math.round(heightMm / 100) * 100;
  let changed = w !== draft.widthMm || h !== draft.heightMm;
  const otherFloors = draft.otherFloors.map((floor) => {
    if (floor.background) return floor;
    const extent = contentExtent(floor);
    const fw = clampPlane(w, extent.maxX);
    const fh = clampPlane(h, extent.maxY);
    if (fw === floor.widthMm && fh === floor.heightMm) return floor;
    changed = true;
    return { ...floor, widthMm: fw, heightMm: fh };
  });
  return { draft: changed ? { ...draft, widthMm: w, heightMm: h, otherFloors } : draft, clamped };
}

/**
 * Rozšíření plochy o 5 m, když nákres došel blíž než 1 m k pravému / dolnímu okraji (nikdy přes 100 m). S `before`
 * (nákres při stisku ukazatele) jen ve směru, kam se nákres během gesta rozšířil – ručně těsně nastavená plocha se
 * kliknutím sama nezvětší.
 */
export function growPlane(draft: FloorplanDraft, before?: Content): FloorplanDraft {
  if (draft.background) return draft;
  const now = contentExtent(draft);
  const was = before ? contentExtent(before) : { maxX: -1, maxY: -1 };
  const grow = (size: number, extent: number, previous: number) =>
    extent > previous && extent > size - PLANE_EDGE_MM && size < PLANE_MAX_MM ? Math.min(PLANE_MAX_MM, roundUp(Math.max(size + PLANE_GROW_MM, extent + PLANE_EDGE_MM))) : size;
  const w = grow(draft.widthMm, now.maxX, was.maxX);
  const h = grow(draft.heightMm, now.maxY, was.maxY);
  return w === draft.widthMm && h === draft.heightMm ? draft : resizePlane(draft, w, h).draft;
}

/** „⛶ Přizpůsobit pohled“: výřez na celý nákres s okrajem (poměr stran plochy); prázdný nákres = celá plocha. */
export function contentView(draft: Pick<FloorplanDraft, "rooms" | "elements" | "annotations" | "widthMm" | "heightMm">): PlanView {
  if (!draft.rooms.length && !draft.elements.length && !draft.annotations.length) return fitView(draft);
  const box = contentBox(draft);
  const ratio = draft.heightMm / draft.widthMm;
  const w = Math.min(draft.widthMm, Math.max(box.w, box.h / ratio, 2_000));
  const h = w * ratio;
  return { w, x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2 };
}

/** Rozměr v metrech pro popisky („20“, „12,5“). */
export const meters = (mm: number) => (mm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
