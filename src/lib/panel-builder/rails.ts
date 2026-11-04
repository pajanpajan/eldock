// DIN lišty návrhu rozváděče (fáze 43): kapacita každé lišty zvlášť (presety standardních rozvodnic),
// přidání, smazání a přesun lišty, souhrn obsazenosti a rezervy. Čisté funkce – sdílí UI, služba i testy.

/** Rychlé presety šířky řady podle standardních rozvodnic (14M = 12 + 2). */
export const RAIL_PRESETS = [8, 12, 14, 18, 24, 36] as const;
export const MIN_RAIL_MODULES = 4;
export const MAX_RAIL_MODULES = 48;
export const MAX_RAILS = 12;
/** Výchozí řada nového návrhu od nuly (1× 12M). */
export const DEFAULT_RAIL_MODULES = 12;

const clampModules = (value: number) => Math.min(MAX_RAIL_MODULES, Math.max(MIN_RAIL_MODULES, Math.round(value)));

/** Kapacity lišt projektu; neplatný / chybějící JSON = všechny lišty po `modulesPerRail`. */
export function railCapacities(project: { dinRailsCount: number; modulesPerRail: number; railModulesJson?: string | null }): number[] {
  const count = Math.max(1, project.dinRailsCount);
  let parsed: unknown = null;
  try {
    parsed = project.railModulesJson ? JSON.parse(project.railModulesJson) : null;
  } catch {
    parsed = null;
  }
  const list = Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).map(clampModules) : [];
  return Array.from({ length: count }, (_, index) => list[index] ?? list[list.length - 1] ?? clampModules(project.modulesPerRail));
}

/** Data k uložení: kapacity, počet lišt a nejširší lišta (pro starší výpočty s jednou šířkou). */
export const railColumns = (capacities: readonly number[]) => ({
  railModulesJson: JSON.stringify(capacities.map(clampModules)),
  dinRailsCount: capacities.length,
  modulesPerRail: Math.max(...capacities.map(clampModules)),
});

export function withRailCapacity(capacities: readonly number[], rail: number, modules: number): number[] {
  return capacities.map((value, index) => (index === rail - 1 ? clampModules(modules) : value));
}

/** Nová lišta pod stávajícími se šířkou poslední lišty. */
export function withRailAdded(capacities: readonly number[]): number[] {
  if (capacities.length >= MAX_RAILS) return [...capacities];
  return [...capacities, capacities[capacities.length - 1] ?? DEFAULT_RAIL_MODULES];
}

export function withRailRemoved(capacities: readonly number[], rail: number): number[] {
  const next = capacities.filter((_, index) => index !== rail - 1);
  return next.length ? next : [DEFAULT_RAIL_MODULES];
}

/** Přesun lišty nahoru (−1) / dolů (+1); vrací null, když to nejde. */
export function railMoveTarget(count: number, rail: number, direction: -1 | 1): number | null {
  const target = rail + direction;
  return rail >= 1 && rail <= count && target >= 1 && target <= count ? target : null;
}

export function withRailsSwapped(capacities: readonly number[], a: number, b: number): number[] {
  const next = [...capacities];
  [next[a - 1], next[b - 1]] = [next[b - 1], next[a - 1]];
  return next;
}

/** Obsazené moduly na liště. */
export const usedOnRail = (items: readonly { dinRailIndex: number; modulesWidth: number }[], rail: number) =>
  items.filter((item) => item.dinRailIndex === rail).reduce((sum, item) => sum + item.modulesWidth, 0);

/** Volné moduly na liště (záporné = přeplněno). */
export const freeOnRail = (capacities: readonly number[], items: readonly { dinRailIndex: number; modulesWidth: number }[], rail: number) =>
  (capacities[rail - 1] ?? 0) - usedOnRail(items, rail);

const plural = (count: number, one: string, few: string, many: string) => (count === 1 ? one : count >= 2 && count <= 4 ? few : many);
const decimal = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");

export interface RailSummary {
  rails: number;
  /** „12“ nebo „12/14/12“ (různé šířky lišt). */
  modules: string;
  used: number;
  total: number;
  percent: number;
  reserve: number;
}

export function railSummary(capacities: readonly number[], items: readonly { dinRailIndex: number; modulesWidth: number }[]): RailSummary {
  const total = capacities.reduce((sum, value) => sum + value, 0);
  const used = items.reduce((sum, item) => sum + item.modulesWidth, 0);
  const percent = total ? Math.round((used / total) * 100) : 0;
  const unique = [...new Set(capacities)];
  return { rails: capacities.length, modules: unique.length === 1 ? String(unique[0]) : capacities.join("/"), used, total, percent, reserve: Math.max(0, 100 - percent) };
}

/** „Konfigurace: 2 DIN lišty × 12 M · Obsazeno: 9 / 24 M (38 % · volná rezerva 62 %)“. */
export function formatRailSummary(summary: RailSummary): string {
  return `Konfigurace: ${summary.rails} ${plural(summary.rails, "DIN lišta", "DIN lišty", "DIN lišt")} × ${summary.modules} M · Obsazeno: ${decimal(summary.used)} / ${summary.total} M (${summary.percent} % · volná rezerva ${summary.reserve} %)`;
}

/** Detailní fotky lišt projektu (fáze 47): { "1": "/api/files/photos/…" }. */
export function parseRailPhotos(json: string | null | undefined): Record<string, string> {
  try {
    const value = json ? (JSON.parse(json) as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => /^\d+$/.test(entry[0]) && typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

/** Detailní fotky lišt seřazené podle lišty (pro náhledy v kroku 1). */
export const railPhotoList = (json: string | null | undefined) =>
  Object.entries(parseRailPhotos(json))
    .map(([rail, url]) => ({ rail: Number(rail), url }))
    .sort((a, b) => a.rail - b.rail);
