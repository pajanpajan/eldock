// Soupis místností → půdorys pro most „půdorys → rozváděč“ (fáze 48). Uživatel nemusí kreslit
// půdorys: u každé místnosti zadá vzdálenost od rozváděče, počty zásuvek / světel / ovládacích míst
// a spotřebiče. Z toho vznikne syntetický půdorys (1 px = 1 mm, body v řadě od rozváděče) a kalibrace,
// které zpracuje `generateCircuitsFromFloorplan` a `buildSwitchboardFromCircuits` (ČSN 33 2130 ed. 4).

import { APPLIANCES, calibrateFloorplanScale, type ApplianceTag, type Calibration, type FloorNode, type Floorplan, type InstallMode } from "./floorplan-bridge";

export interface ScheduleRoom {
  name: string;
  /** Vzdálenost místnosti od rozváděče po trase kabelu [m]. */
  distanceM: number;
  singleSockets: number;
  doubleSockets: number;
  lights: number;
  /** Ovládací místa světel (1 = vypínač, 2 = schodišťové, 3+ = křížový / impulzní relé). */
  switchPlaces: number;
  appliances: ApplianceTag[];
  /** Fáze 82: jednozásuvky na světelném okruhu místnosti (jištění 10 / 13 A); bez údaje 0. */
  lightingSockets?: number;
}

/** Spotřebiče nabízené v soupisu (vyhrazené okruhy, 3f vývody, lednice na RCBO). */
export const SCHEDULE_APPLIANCES: ApplianceTag[] = ["oven", "cooktop_3p", "dishwasher", "fridge", "washer", "dryer", "boiler", "ev_charger", "heat_pump"];
export const applianceLabel = (tag: ApplianceTag) => APPLIANCES[tag].label;

/** Vzorový rodinný dům 4+kk – výchozí obsah soupisu v dialogu. */
export const SAMPLE_SCHEDULE: ScheduleRoom[] = [
  { name: "Chodba", distanceM: 2, singleSockets: 2, doubleSockets: 0, lights: 2, switchPlaces: 3, appliances: [] },
  { name: "Kuchyně", distanceM: 5, singleSockets: 0, doubleSockets: 4, lights: 2, switchPlaces: 2, appliances: ["oven", "cooktop_3p", "dishwasher", "fridge"] },
  { name: "Obývací pokoj", distanceM: 8, singleSockets: 4, doubleSockets: 3, lights: 3, switchPlaces: 2, appliances: [] },
  { name: "Ložnice", distanceM: 10, singleSockets: 0, doubleSockets: 3, lights: 1, switchPlaces: 1, appliances: [] },
  { name: "Dětský pokoj", distanceM: 9, singleSockets: 0, doubleSockets: 3, lights: 1, switchPlaces: 1, appliances: [] },
  { name: "Koupelna", distanceM: 4, singleSockets: 0, doubleSockets: 1, lights: 2, switchPlaces: 1, appliances: ["washer", "boiler"] },
];

const clampInt = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

/** Očištěný soupis: názvy, rozsahy počtů, jen známé spotřebiče, max. 30 místností. */
export function sanitizeSchedule(rooms: readonly ScheduleRoom[]): ScheduleRoom[] {
  return rooms
    .slice(0, 30)
    .map((room) => ({
      name: room.name.trim().slice(0, 40),
      distanceM: Math.min(100, Math.max(1, Number.isFinite(room.distanceM) ? room.distanceM : 1)),
      singleSockets: clampInt(room.singleSockets, 30),
      doubleSockets: clampInt(room.doubleSockets, 30),
      lights: clampInt(room.lights, 30),
      switchPlaces: clampInt(room.switchPlaces, 6),
      appliances: [...new Set(room.appliances.filter((tag) => SCHEDULE_APPLIANCES.includes(tag)))],
      // Fáze 82: zásuvky na světelném okruhu jen u místnosti se světlem (bez nich pole chybí – tvar dosavadních dat)
      ...(room.lights > 0 && clampInt(room.lightingSockets ?? 0, 4) > 0 ? { lightingSockets: clampInt(room.lightingSockets ?? 0, 4) } : {}),
    }))
    .filter((room) => room.name);
}

/**
 * Syntetický půdorys ze soupisu: body místnosti leží v řadě od její vzdálenosti dál (0,5 m od sebe),
 * takže délka kabelu = vzdálenost + rozestup + svislé instalační zóny z kalibrace.
 */
export function floorplanFromSchedule(rooms: readonly ScheduleRoom[], mode: InstallMode): { plan: Floorplan; calibration: Calibration } {
  const clean = sanitizeSchedule(rooms);
  const nodes: FloorNode[] = [];
  clean.forEach((room, roomIndex) => {
    const id = `r${roomIndex + 1}`;
    let offset = 0;
    const add = (kind: FloorNode["kind"], extra: Partial<FloorNode> = {}) => {
      nodes.push({ id: `${id}-n${nodes.length + 1}`, room: id, kind, px: [room.distanceM * 1000 + offset, 0], ...extra });
      offset += 500;
    };
    for (let i = 0; i < room.singleSockets; i++) add("single_socket");
    for (let i = 0; i < room.doubleSockets; i++) add("double_socket");
    for (let i = 0; i < room.lights; i++) add("light");
    for (let i = 0; i < (room.lightingSockets ?? 0); i++) add("single_socket", { onLighting: true });
    for (const tag of room.appliances) add("appliance", { tag });
  });
  const plan: Floorplan = {
    mode,
    rooms: clean.map((room, index) => ({
      id: `r${index + 1}`,
      name: room.name,
      ...(room.lights && room.switchPlaces ? { lighting: { groups: 1 as const, switchCount: room.switchPlaces } } : {}),
    })),
    nodes,
  };
  const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 1000 }], panelPx: [0, 0] });
  return { plan, calibration };
}
