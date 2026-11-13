import type { EquipmentType } from "@/generated/prisma/enums";

import { formatCount } from "./format";
import { INSPECTION_WARNING_DAYS } from "./inspection";
import { compareRoute, type PlannerItem } from "./inspection-planner";

// Fáze 108: Chytrá revize – optimalizace výjezdu revizního technika („když už tam technik jede“).
// Kotva výjezdu = nejnaléhavější zařízení po termínu (EXPIRED) nebo do 30 dnů před koncem platnosti (DUE_SOON).
// K ní se nabídnou další zařízení téhož závodu, kterým platnost revize skončí v přepínatelném horizontu
// 30 / 60 / 90 / 180 dnů – seřazená stejná budova → sousední budovy (vzdálenost středů na mapě areálu) → nejdřív končící.
// Čisté funkce nad položkami plánovače (dny = posun od dneška).

export const TRIP_HORIZONS = [30, 60, 90, 180] as const;
export type TripHorizon = (typeof TRIP_HORIZONS)[number];
export const DEFAULT_TRIP_HORIZON: TripHorizon = 90;
/** DUE_SOON = do 30 dnů před koncem platnosti (stejná hranice jako výstraha lhůtníku). */
export const DUE_SOON_DAYS = INSPECTION_WARNING_DAYS;
/** Nejvíc zařízení v jednom sloučeném výjezdu (= nejvíc zařízení hromadné revize). */
export const MAX_TRIP_ITEMS = 200;

export const isTripHorizon = (value: unknown): value is TripHorizon => TRIP_HORIZONS.includes(value as TripHorizon);

/** Položka plánovače doplněná o závod, budovu (střed na mapě areálu v %) a podlaží. */
export interface TripItem extends PlannerItem {
  plantId: string;
  plantName: string;
  buildingId: string;
  floorId: string;
  buildingCenter: { x: number; y: number } | null;
}

export type TripUrgency = "EXPIRED" | "DUE_SOON" | "UPCOMING";

/**
 * Orientační čas revize jednoho zařízení na místě [min] – měření, prohlídka a zápis (bez dopravy).
 * Slouží jen k odhadu délky výjezdu; skutečná náročnost závisí na rozsahu zařízení a přístupnosti.
 */
export const INSPECTION_MINUTES: Record<EquipmentType, number> = {
  SWITCHBOARD: 90,
  TRANSFORMER: 120,
  PRODUCTION_LINE: 180,
  MACHINE: 60,
  CNC_MACHINE: 75,
  ROBOT_CELL: 90,
  HVAC_UNIT: 45,
  COMPRESSOR: 45,
  POWER_TOOL: 10,
  APPLIANCE: 8,
  EXTENSION_CORD: 6,
  WELDER: 20,
  LIGHTNING_ROD: 60,
  EMERGENCY_LIGHTING: 20,
  WIRING_DEVICE: 5,
  MEDICAL_DEVICE: 30,
  MEDICAL_ROOM: 90,
  FIRE_SHUTDOWN: 30,
  OTHER: 30,
};

/** „≈ 1 h 30 min“ / „≈ 45 min“. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `≈ ${rest} min`;
  return rest ? `≈ ${hours} h ${rest} min` : `≈ ${hours} h`;
}

/**
 * Naléhavost pro výjezd: jen zařízení s platností revize (vyřazená a nikdy nerevidovaná řeší lhůtník / zápis revize).
 * `null` = do výjezdu se nenabízí.
 */
export function tripUrgency(item: Pick<PlannerItem, "state" | "daysLeft">): TripUrgency | null {
  if (item.daysLeft === null || item.state === "FAILED" || item.state === "MISSING") return null;
  if (item.daysLeft < 0) return "EXPIRED";
  if (item.daysLeft <= DUE_SOON_DAYS) return "DUE_SOON";
  return "UPCOMING";
}

export const isTripAnchor = (item: Pick<PlannerItem, "state" | "daysLeft">) => {
  const urgency = tripUrgency(item);
  return urgency === "EXPIRED" || urgency === "DUE_SOON";
};

export interface TripRow {
  item: TripItem;
  urgency: TripUrgency;
  minutes: number;
  /** Ve stejné budově jako kotva výjezdu. */
  sameBuilding: boolean;
  /** Vzdálenost středu budovy od budovy kotvy (procenta mapy areálu); u budovy bez polohy podle pořadí budov. */
  distance: number;
}

export interface RevisionTrip {
  plantId: string;
  plantName: string;
  horizon: number;
  /** Nejnaléhavější revize – důvod výjezdu. */
  anchor: TripRow;
  /** Další zařízení do horizontu (bez kotvy) v pořadí stejná budova → sousední budovy → nejdřív končící. */
  rows: TripRow[];
  /** Neodkladných (po termínu + do 30 dnů) v závodě včetně kotvy. */
  urgentCount: number;
  sameBuildingCount: number;
  /** Odhad času celého výjezdu (kotva + všechna nabídnutá zařízení) [min]. */
  minutes: number;
}

function distanceBetween(a: TripItem, b: TripItem): number {
  if (a.buildingId === b.buildingId) return 0;
  if (a.buildingCenter && b.buildingCenter) return Math.hypot(a.buildingCenter.x - b.buildingCenter.x, a.buildingCenter.y - b.buildingCenter.y);
  // Budova bez polohy na mapě: za všemi umístěnými, podle pořadí budov
  return 1000 + Math.abs(a.buildingOrder - b.buildingOrder);
}

const daysOf = (item: TripItem) => item.daysLeft ?? 0;

/** Nejnaléhavější první: nejméně dnů do konce platnosti (po termínu záporné), pak pořadí pochůzky. */
const compareUrgency = (a: TripItem, b: TripItem) => daysOf(a) - daysOf(b) || compareRoute(a, b);

function toRow(item: TripItem, anchor: TripItem): TripRow {
  return {
    item,
    urgency: tripUrgency(item) ?? "UPCOMING",
    minutes: INSPECTION_MINUTES[item.type] ?? INSPECTION_MINUTES.OTHER,
    sameBuilding: item.buildingId === anchor.buildingId,
    distance: distanceBetween(item, anchor),
  };
}

/**
 * Výjezdy po závodech: v každém závodě s aspoň jednou neodkladnou revizí kotva a nabídka dalších zařízení
 * do horizontu. `focusBuildingId` (detail podlaží) dá přednost kotvě v této budově.
 * Výjezdy jsou seřazené od nejnaléhavějšího.
 */
export function planRevisionTrips(items: readonly TripItem[], horizon: number, options: { focusBuildingId?: string | null } = {}): RevisionTrip[] {
  const byPlant = new Map<string, TripItem[]>();
  for (const item of items) {
    if (!tripUrgency(item)) continue;
    const list = byPlant.get(item.plantId);
    if (list) list.push(item);
    else byPlant.set(item.plantId, [item]);
  }

  const trips: RevisionTrip[] = [];
  for (const plantItems of byPlant.values()) {
    const anchors = plantItems.filter(isTripAnchor).sort(compareUrgency);
    if (!anchors.length) continue;
    const anchor = (options.focusBuildingId ? anchors.find((item) => item.buildingId === options.focusBuildingId) : undefined) ?? anchors[0];
    const rows = plantItems
      .filter((item) => item.id !== anchor.id && daysOf(item) <= horizon)
      .map((item) => toRow(item, anchor))
      .sort((a, b) => Number(b.sameBuilding) - Number(a.sameBuilding) || a.distance - b.distance || compareUrgency(a.item, b.item));
    const anchorRow = toRow(anchor, anchor);
    trips.push({
      plantId: anchor.plantId,
      plantName: anchor.plantName,
      horizon,
      anchor: anchorRow,
      rows,
      urgentCount: anchors.length,
      sameBuildingCount: rows.filter((row) => row.sameBuilding).length,
      minutes: anchorRow.minutes + rows.reduce((sum, row) => sum + row.minutes, 0),
    });
  }
  return trips.sort((a, b) => compareUrgency(a.anchor.item, b.anchor.item));
}

/** Text zbývajících dnů: „po termínu 12 dní“ / „dnes končí“ / „za 25 dní“. */
export function daysText(daysLeft: number | null): string {
  if (daysLeft === null) return "bez platné revize";
  if (daysLeft < 0) return `po termínu ${formatCount(-daysLeft, ["den", "dny", "dní"])}`;
  if (daysLeft === 0) return "končí dnes";
  return `za ${formatCount(daysLeft, ["den", "dny", "dní"])}`;
}

/** „další 3 zařízení“ / „dalších 7 zařízení“ (zařízení je nesklonné). */
export const moreItemsText = (count: number) => `${count >= 1 && count <= 4 ? "další" : "dalších"} ${count} zařízení`;

/** Věta banneru podle zadání: kvůli 1 neodkladné revizi přibalit X dalších zařízení končících v horizontu. */
export function tripSummaryText(trip: RevisionTrip): string {
  const anchor = `${trip.anchor.item.tag} – ${daysText(trip.anchor.item.daysLeft)}`;
  if (!trip.rows.length) {
    return `Revizní technik jede do závodu kvůli 1 neodkladné revizi (${anchor}). V nejbližších ${trip.horizon} dnech v závodě žádné další zařízení nekončí – zkuste delší horizont.`;
  }
  return `Než revizní technik vyrazí do závodu kvůli 1 neodkladné revizi (${anchor}), doporučujeme do stejného výjezdu přibalit ${moreItemsText(trip.rows.length)} v téže budově / závodě, kterým vyprší platnost revize v nejbližších ${trip.horizon} dnech. Ušetříte tím opakovaný výjezd a dopravu technika.`;
}

/** Seznam pro technika (e-mail / schránka): kotva + vybraná zařízení po budovách s dny a odhadem času. */
export function tripListText(trip: Pick<RevisionTrip, "plantName" | "horizon">, rows: readonly TripRow[]): string {
  const lines = [`Sloučený revizní výjezd – ${trip.plantName}`, `Horizont: ${trip.horizon} dnů · ${formatCount(rows.length, ["zařízení", "zařízení", "zařízení"])} · ${formatMinutes(rows.reduce((sum, row) => sum + row.minutes, 0))} práce na místě (orientačně)`, ""];
  let building = "";
  for (const row of [...rows].sort((a, b) => a.distance - b.distance || compareRoute(a.item, b.item))) {
    if (row.item.buildingName !== building) {
      building = row.item.buildingName;
      lines.push(`■ ${building}`);
    }
    lines.push(`  • ${row.item.tag} – ${row.item.name} (${row.item.floorName}${row.item.zone ? `, ${row.item.zone}` : ""}) · ${daysText(row.item.daysLeft)} · ${formatMinutes(row.minutes)}`);
  }
  return lines.join("\n");
}
