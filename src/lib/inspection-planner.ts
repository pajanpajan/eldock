import type { EquipmentType } from "@/generated/prisma/enums";

import { pragueToday, type InspectionState } from "./inspection";
import { isPortable } from "./inspection-rules";
import { normalizeCz, type InspectionPlanQuery, type InstrumentGroup } from "./inspection-voice-parser";

// Chytrý plánovač revizí: měsíční horizont, výběr dávky podle dotazu, tip „Přiberte při jedné
// cestě“ a řazení pochůzky. Čisté funkce nad položkami z dotazu (dny = posun od dneška).

export interface PlannerItem {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  buildingName: string;
  buildingOrder: number;
  floorCode: string;
  floorLevel: number;
  floorName: string;
  /** Místnost / zóna (u spotřebičů), jinak `null`. */
  zone: string | null;
  state: InspectionState;
  /** Dny do konce platnosti (záporné = po termínu); `null` bez revize. */
  daysLeft: number | null;
  validUntil: Date | null;
}

export type PlanBucket = "OVERDUE" | "THIS_MONTH" | "NEXT_MONTH" | "LATER";
export const PLAN_BUCKETS: PlanBucket[] = ["OVERDUE", "THIS_MONTH", "NEXT_MONTH", "LATER"];

/** Okno, ve kterém se tip „přiberte“ dívá za konec zvoleného období. */
export const LOOK_AHEAD_DAYS = 45;
/** Horizont měsíčního přehledu (🟢 další 3–6 měsíců). */
export const HORIZON_DAYS = 183;

export const measuringGroup = (type: EquipmentType): InstrumentGroup => (isPortable(type) ? "PORTABLE" : "FIXED");

export const MEASURING_GROUP_LABELS: Record<InstrumentGroup, string> = {
  PORTABLE: "Přenosné spotřebiče a nářadí (rychlé měření)",
  FIXED: "Pevná zařízení & rozváděče (vyžadují přístup / odstávku)",
};

/** Po termínu, vyřazené a bez revize se plánují ihned (posun −1). */
export function effectiveDays(item: Pick<PlannerItem, "state" | "daysLeft">): number {
  if (item.state === "FAILED" || item.state === "MISSING" || item.daysLeft === null) return -1;
  return item.daysLeft;
}

/** Hranice měsíčního přehledu jako posuny od dneška. */
export function bucketBounds(now: Date = new Date()) {
  const [year, month, day] = pragueToday(now).split("-").map(Number);
  const today = Date.UTC(year, month - 1, day);
  const offset = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m, d) - today) / (24 * 3600 * 1000));
  return { thisMonthEnd: offset(year, month, 0), nextMonthEnd: offset(year, month + 1, 0), horizon: HORIZON_DAYS };
}

export function bucketFor(days: number, bounds: ReturnType<typeof bucketBounds>): PlanBucket | null {
  if (days < 0) return "OVERDUE";
  if (days <= bounds.thisMonthEnd) return "THIS_MONTH";
  if (days <= bounds.nextMonthEnd) return "NEXT_MONTH";
  if (days <= bounds.horizon) return "LATER";
  return null;
}

const zoneText = (item: PlannerItem) => normalizeCz(`${item.zone ?? ""} ${item.floorName}`);

/** Typy a lokace dotazu (bez období) – podklad měsíčního přehledu. */
export function matchesScope(item: PlannerItem, query: InspectionPlanQuery): boolean {
  if (query.types.length && !query.types.includes(item.type)) return false;
  if (query.floorQuery.length && !query.floorQuery.some((floor) => floor.match === item.floorCode)) return false;
  const building = normalizeCz(item.buildingName);
  const buildingOk = query.buildingQuery.some((term) => building.includes(term.match));
  const zoneOk = query.zoneQuery.some((term) => zoneText(item).includes(term.match));
  if (query.locationMode === "ANY") return query.buildingQuery.length + query.zoneQuery.length === 0 || buildingOk || zoneOk;
  return (query.buildingQuery.length === 0 || buildingOk) && (query.zoneQuery.length === 0 || zoneOk);
}

export function matchesTimeframe(item: PlannerItem, timeframe: InspectionPlanQuery["timeframe"]): boolean {
  const days = effectiveDays(item);
  if (days < 0) return timeframe.includeExpired;
  return days >= (timeframe.fromDay ?? 0) && days <= timeframe.toDay;
}

/** Pořadí pochůzky: budova → patro → zóna → měřicí skupina (přenosné napřed) → tag. */
export function compareRoute(a: PlannerItem, b: PlannerItem): number {
  return (
    a.buildingOrder - b.buildingOrder ||
    a.buildingName.localeCompare(b.buildingName, "cs") ||
    a.floorLevel - b.floorLevel ||
    (a.zone ?? "").localeCompare(b.zone ?? "", "cs") ||
    (measuringGroup(a.type) === measuringGroup(b.type) ? 0 : measuringGroup(a.type) === "PORTABLE" ? -1 : 1) ||
    a.tag.localeCompare(b.tag, "cs")
  );
}

/** Klíč místa pro tip „při jedné cestě“: stejná budova, patro a zóna (bez zóny celé patro). */
const placeKey = (item: PlannerItem) => `${item.buildingName}|${item.floorCode}|${item.zone ?? ""}`;

export interface PlanResult {
  selected: PlannerItem[];
  suggestions: PlannerItem[];
  buckets: Record<PlanBucket, number>;
  summary: { total: number; fixed: number; portable: number };
}

export function summarize(items: readonly PlannerItem[]) {
  const portable = items.filter((item) => measuringGroup(item.type) === "PORTABLE").length;
  return { total: items.length, portable, fixed: items.length - portable };
}

/**
 * Dávka podle dotazu (seřazená pochůzka), měsíční přehled rozsahu dotazu a tip: zařízení
 * ve stejném místě a měřicí skupině, kterým revize končí do 45 dnů po konci zvoleného okna.
 */
export function planInspections(items: readonly PlannerItem[], query: InspectionPlanQuery, now: Date = new Date()): PlanResult {
  const bounds = bucketBounds(now);
  const buckets: Record<PlanBucket, number> = { OVERDUE: 0, THIS_MONTH: 0, NEXT_MONTH: 0, LATER: 0 };
  const inScope = items.filter((item) => matchesScope(item, query));
  for (const item of inScope) {
    const bucket = bucketFor(effectiveDays(item), bounds);
    if (bucket) buckets[bucket] += 1;
  }

  const selected = inScope.filter((item) => matchesTimeframe(item, query.timeframe)).sort(compareRoute);
  const chosen = new Set(selected.map((item) => item.id));
  const places = new Set(selected.map((item) => `${placeKey(item)}|${measuringGroup(item.type)}`));
  const windowEnd = Math.max(query.timeframe.toDay, -1);
  const suggestions = items
    .filter((item) => {
      if (chosen.has(item.id)) return false;
      const days = effectiveDays(item);
      return days > windowEnd && days <= windowEnd + LOOK_AHEAD_DAYS && places.has(`${placeKey(item)}|${measuringGroup(item.type)}`);
    })
    .sort(compareRoute);

  return { selected, suggestions, buckets, summary: summarize(selected) };
}

/** Pochůzkový list: dávka seskupená po budovách a místnostech v pořadí pochůzky. */
export function groupForRoute(items: readonly PlannerItem[]): { building: string; places: { place: string; items: PlannerItem[] }[] }[] {
  const out: { building: string; places: { place: string; items: PlannerItem[] }[] }[] = [];
  for (const item of [...items].sort(compareRoute)) {
    let building = out.at(-1);
    if (!building || building.building !== item.buildingName) {
      building = { building: item.buildingName, places: [] };
      out.push(building);
    }
    const place = item.zone ?? item.floorName;
    let group = building.places.at(-1);
    if (!group || group.place !== place) {
      group = { place, items: [] };
      building.places.push(group);
    }
    group.items.push(item);
  }
  return out;
}
