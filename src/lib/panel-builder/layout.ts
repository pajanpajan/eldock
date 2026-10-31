// Geometrie rozváděče: skříň, DIN lišty a moduly v měřítku. Sdílí ji generátor „fotky“, rámečky
// rozpoznaných prvků (bounding box v % fotky), grafika DIN lišt i výkres osazení.

export const PHOTO = { width: 900, height: 1300 } as const;
/** Rozteč modulu na DIN liště [mm] (šířka modulu 17,5 mm + rezerva). */
export const MODULE_MM = 18;
/** Výška modulového přístroje (S200, F200, SD200) [mm]. */
export const DEVICE_HEIGHT_MM = 85;

export interface EnclosureDims {
  widthMm: number;
  heightMm: number;
  dinRailsCount: number;
  modulesPerRail: number;
}

export interface SlotInput {
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
}

/** [ymin, xmin, ymax, xmax] v procentech fotky (konvence Gemini, jen v % místo 0–1000). */
export type BoundingBox = [number, number, number, number];

export interface PhotoGeometry {
  scale: number; // px / mm
  enclosure: { x: number; y: number; w: number; h: number };
  rails: { index: number; y: number; x0: number; x1: number }[];
  moduleW: number;
  deviceH: number;
}

/** Svislá poloha osy lišty (podíl výšky skříně) – lišty rovnoměrně s okrajem nahoře i dole. */
export const railFraction = (index: number, count: number) => (index - 0.25) / (count + 0.5);

export function photoGeometry(dims: EnclosureDims): PhotoGeometry {
  const scale = Math.min((PHOTO.width - 160) / dims.widthMm, (PHOTO.height - 100) / dims.heightMm);
  const w = dims.widthMm * scale;
  const h = dims.heightMm * scale;
  const x = (PHOTO.width - w) / 2;
  const y = (PHOTO.height - h) / 2;
  const railLength = Math.min(dims.modulesPerRail * MODULE_MM, dims.widthMm - 20) * scale;
  const rails = Array.from({ length: dims.dinRailsCount }, (_, i) => ({
    index: i + 1,
    y: y + h * railFraction(i + 1, dims.dinRailsCount),
    x0: x + (w - railLength) / 2,
    x1: x + (w + railLength) / 2,
  }));
  return { scale, enclosure: { x, y, w, h }, rails, moduleW: MODULE_MM * scale, deviceH: Math.min(DEVICE_HEIGHT_MM, (dims.heightMm / (dims.dinRailsCount + 0.5)) * 0.8) * scale };
}

/** Počáteční modul každého prvku na liště (prvky jdou zleva bez mezer v pořadí `positionOnRail`). */
export function slotOffsets<T extends SlotInput>(items: readonly T[]): Map<T, number> {
  const offsets = new Map<T, number>();
  const byRail = new Map<number, T[]>();
  for (const item of items) byRail.set(item.dinRailIndex, [...(byRail.get(item.dinRailIndex) ?? []), item]);
  for (const list of byRail.values()) {
    let cursor = 0;
    for (const item of [...list].sort((a, b) => a.positionOnRail - b.positionOnRail)) {
      offsets.set(item, cursor);
      cursor += item.modulesWidth;
    }
  }
  return offsets;
}

/** Obdélník prvku na fotce v px. */
export function slotRect(geometry: PhotoGeometry, rail: number, startModule: number, modules: number) {
  const line = geometry.rails[rail - 1] ?? geometry.rails[geometry.rails.length - 1];
  return { x: line.x0 + startModule * geometry.moduleW, y: line.y - geometry.deviceH / 2, w: Math.max(modules, 0.5) * geometry.moduleW, h: geometry.deviceH };
}

const pct = (value: number, total: number) => Math.round((value / total) * 10000) / 100;

/** Bounding boxy prvků v % fotky (seed, demo analýza). */
export function slotBoxes<T extends SlotInput>(dims: EnclosureDims, items: readonly T[]): Map<T, BoundingBox> {
  const geometry = photoGeometry(dims);
  const offsets = slotOffsets(items);
  return new Map(
    items.map((item) => {
      const rect = slotRect(geometry, item.dinRailIndex, offsets.get(item) ?? 0, item.modulesWidth);
      return [item, [pct(rect.y, PHOTO.height), pct(rect.x, PHOTO.width), pct(rect.y + rect.h, PHOTO.height), pct(rect.x + rect.w, PHOTO.width)] as BoundingBox];
    }),
  );
}

export function parseBox(json: string | null | undefined): BoundingBox | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number") ? (value as BoundingBox) : null;
  } catch {
    return null;
  }
}

/** Obsazenost lišt v modulech (pro varování „lišta je přeplněná“). */
export function railUsage(items: readonly SlotInput[], dims: Pick<EnclosureDims, "dinRailsCount" | "modulesPerRail">) {
  return Array.from({ length: dims.dinRailsCount }, (_, i) => {
    const used = items.filter((item) => item.dinRailIndex === i + 1).reduce((sum, item) => sum + item.modulesWidth, 0);
    return { rail: i + 1, used, capacity: dims.modulesPerRail, overflow: used > dims.modulesPerRail };
  });
}
