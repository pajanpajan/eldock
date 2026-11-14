// Fáze 116: 🚶 Pochůzkový režim revizního technika – zařízení výjezdu seskupená do zastávek Budova ➔ Patro ➔ Místnost
// (každou místnost projde technik jen jednou), pořadí po patře od vchodu nejbližším sousedem, „📍 kde to najdu“
// (místnost / osový kříž / pracovní místo), kontrolní odpočet místnosti a postup dnešního výjezdu. Čisté funkce.

import { formatGridRef, gridToPx, insideFrame, nearestGridPoint, parseGridRef, pxToMeters } from "./cad-grid";
import { compareRoute } from "./inspection-planner";
import type { TripItem } from "./revision-trip";
import { frameOfFloor, layoutOfFloor } from "./studio-layout";

export interface WalkItem extends TripItem {
  /** Poloha pinu na půdorysu patra (procenta 0–100). */
  pinX: number;
  pinY: number;
  /** Místnost / zóna – přiřazená, jinak ta, ve které pin leží. */
  room: string | null;
  /** Osový kříž rastru sloupů („B3“). */
  gridRef: string | null;
  /** Upřesnění místa (pracovní místo, linka). */
  locationNote: string | null;
  photoUrl: string | null;
  nameplatePhotoUrl: string | null;
  protectionClass: string | null;
  /** Vchod / vrata patra (procenta) – začátek pochůzky po patře. */
  entrance: { x: number; y: number; label: string } | null;
  /** Hodnoty z minulé revize (předvyplnění rychlého zápisu). */
  last: { date: string; riso: number | null; rpe: number | null; zs: number | null; inspector: string | null } | null;
  /** Dnes už zapsaná revize – hotovo v dnešním výjezdu. */
  inspectedToday: boolean;
}

export const WALK_SORTS = [
  { id: "trasa", label: "🚶‍♂️ Pochůzková trasa technika (Budova ➔ Patro ➔ Místnost)" },
  { id: "urgence", label: "⏰ Podle urgencí a expirace" },
] as const;
export type WalkSort = (typeof WALK_SORTS)[number]["id"];
export const WALK_SORT_PARAM = "razeni";
export const walkSortOf = (value: string | string[] | undefined): WalkSort => ((Array.isArray(value) ? value[0] : value) === "trasa" ? "trasa" : "urgence");

/** „📍 Osový kříž B3 · Lisovací linka“ / „📍 Kancelář 204 · Pracovní místo u okna“. */
export function locationText(item: Pick<WalkItem, "room" | "gridRef" | "locationNote" | "floorName">): string {
  const where = [item.room, item.gridRef ? `Osový kříž ${item.gridRef}` : null, item.locationNote].filter(Boolean);
  return `📍 ${where.length ? where.join(" · ") : item.floorName}`;
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Pořadí bodů nejbližším sousedem od startu (vchod patra, jinak levý horní roh). */
export function nearestNeighbourOrder<T extends { pinX: number; pinY: number }>(items: readonly T[], start: { x: number; y: number } | null): T[] {
  const left = [...items];
  const out: T[] = [];
  let at = start ?? { x: 0, y: 0 };
  while (left.length) {
    let best = 0;
    for (let index = 1; index < left.length; index++) if (distance(at, { x: left[index].pinX, y: left[index].pinY }) < distance(at, { x: left[best].pinX, y: left[best].pinY })) best = index;
    const [next] = left.splice(best, 1);
    out.push(next);
    at = { x: next.pinX, y: next.pinY };
  }
  return out;
}

export interface WalkStop {
  index: number;
  buildingId: string;
  buildingName: string;
  floorId: string;
  floorName: string;
  room: string | null;
  items: WalkItem[];
}

/**
 * Zastávky pochůzky: budovy v pořadí areálu, patra od nejnižšího, na patře místnosti v pořadí, jak na ně technik narazí
 * od vchodu (nejbližší soused), v místnosti zařízení po stejné trase. Každá místnost = jedna zastávka.
 */
export function walkStops(items: readonly WalkItem[]): WalkStop[] {
  const floors = new Map<string, WalkItem[]>();
  for (const item of [...items].sort(compareRoute)) {
    const list = floors.get(item.floorId);
    if (list) list.push(item);
    else floors.set(item.floorId, [item]);
  }
  const ordered = [...floors.values()].sort((a, b) => compareRoute(a[0], b[0]));
  const stops: WalkStop[] = [];
  for (const floorItems of ordered) {
    const path = nearestNeighbourOrder(floorItems, floorItems[0].entrance);
    const rooms = new Map<string, WalkItem[]>();
    for (const item of path) {
      const key = item.room ?? "";
      const list = rooms.get(key);
      if (list) list.push(item);
      else rooms.set(key, [item]);
    }
    for (const [room, roomItems] of rooms) {
      const first = roomItems[0];
      stops.push({ index: stops.length + 1, buildingId: first.buildingId, buildingName: first.buildingName, floorId: first.floorId, floorName: first.floorName, room: room || null, items: roomItems });
    }
  }
  return stops;
}

/** „Hotovo 5 z 16 zařízení v dnešním výjezdu“. */
export function walkProgress(items: readonly Pick<WalkItem, "inspectedToday">[]): { done: number; total: number } {
  return { done: items.filter((item) => item.inspectedToday).length, total: items.length };
}

/** Kontrolní odpočet místnosti: co v ní ještě zbývá najít a zapsat. */
export function roomCountdown(stop: Pick<WalkStop, "items">): { done: number; total: number; remaining: WalkItem[] } {
  const remaining = stop.items.filter((item) => !item.inspectedToday);
  return { done: stop.items.length - remaining.length, total: stop.items.length, remaining };
}

/** Položky pochůzky: v horizontu výjezdu (po termínu / končící), bez revize, nebo dnes už zapsané (postup výjezdu). */
export function walkItemsFor(items: readonly WalkItem[], horizon: number, focusBuildingId: string | null = null): WalkItem[] {
  return items.filter((item) => (!focusBuildingId || item.buildingId === focusBuildingId) && (item.inspectedToday || item.state === "MISSING" || (item.daysLeft !== null && item.daysLeft <= horizon && item.state !== "FAILED")));
}

/** „Zastávka 1: Hala A – 1. NP · Hlavní výroba (4 zařízení)“. */
export const stopTitle = (stop: Pick<WalkStop, "index" | "buildingName" | "floorName" | "room" | "items">) => `Zastávka ${stop.index}: ${stop.buildingName} – ${stop.floorName}${stop.room ? ` · ${stop.room}` : ""} (${stop.items.length} zařízení)`;

// ---------------------------------------------------------------------------
//  Poloha zařízení v patře (místnost, osový kříž, vchod)
// ---------------------------------------------------------------------------

/**
 * Lokátor patra: vchod / vrata (první vrata rastru) a pro pin zařízení místnost (přiřazená, jinak zóna pod pinem)
 * a nejbližší osový kříž rastru sloupů. Piny jsou v procentech viewBoxu patra.
 */
export function floorLocator(floor: { studioLayoutJson?: string | null; floorplanSvg?: string | null; viewBoxW: number; viewBoxH: number }) {
  const layout = layoutOfFloor(floor);
  const frame = frameOfFloor(floor);
  const width = floor.viewBoxW || 1200;
  const height = floor.viewBoxH || 800;
  const gate = layout.gates[0];
  const gatePoint = gate ? parseGridRef(gate.at, layout.grid) : null;
  const entrancePx = gatePoint ? gridToPx(gatePoint, frame) : null;
  return {
    entrance: entrancePx && gate ? { x: Math.round((entrancePx.x / width) * 1000) / 10, y: Math.round((entrancePx.y / height) * 1000) / 10, label: gate.label } : null,
    locate(pinX: number, pinY: number, assignedZone: string | null): { room: string | null; gridRef: string | null } {
      const px = { x: (pinX / 100) * width, y: (pinY / 100) * height };
      const meters = pxToMeters(frame, px);
      const zone = layout.zones.find((candidate) => meters.x >= candidate.x && meters.x <= candidate.x + candidate.w && meters.y >= candidate.y && meters.y <= candidate.y + candidate.h);
      return { room: assignedZone ?? zone?.name ?? null, gridRef: insideFrame(frame, meters) ? formatGridRef(nearestGridPoint(px, frame)) : null };
    },
  };
}

/** Základ adresy hubu s volbou řazení (`?razeni=trasa`), aby přežila přepnutí záložky a filtru budovy. */
export function withWalkSort(base: string, sort: WalkSort): string {
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  if (sort === "trasa") params.set(WALK_SORT_PARAM, "trasa");
  else params.delete(WALK_SORT_PARAM);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}
