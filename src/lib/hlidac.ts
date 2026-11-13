// Fáze 111: 🛡️ Hlídač revizí & Správa spotřebičů a zařízení – režim objektu (administrativa / výroba), rychlá paleta
// spotřebičů na 1 klik (kancelář a IT, kuchyňka, dílna a budova) a rozvržení pater z názvů místností. Čistá data
// a funkce (stránka, služba, testy).

import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";

import type { GridSpec, GridZone, ZoneKind } from "./cad-grid";

export type HlidacMode = "OFFICE" | "FACTORY";

export const HLIDAC_MODES: Record<HlidacMode, { id: HlidacMode; icon: string; title: string; buildingType: BuildingType; usageGroup: "E" | "C"; rooms: string[] }> = {
  OFFICE: { id: "OFFICE", icon: "🏢", title: "Administrativní budova / Kanceláře / Škola / Klinika", buildingType: "OFFICE", usageGroup: "E", rooms: ["Kancelář 101", "Open-space", "Kuchyňka", "Serverovna", "Zasedačka"] },
  FACTORY: { id: "FACTORY", icon: "🏭", title: "Výrobní závod / Dílna / Sklad", buildingType: "PRODUCTION", usageGroup: "C", rooms: ["Dílna", "Sklad", "Kancelář mistra", "Kuchyňka", "Rozvodna"] },
};
export const isHlidacMode = (value: unknown): value is HlidacMode => value === "OFFICE" || value === "FACTORY";

/**
 * Fáze 112: druh zařízení podle názvu (import revizních dat, sekvenční sběr): prodlužovačka, ruční nářadí, svářečka,
 * rozváděč, stroj, jinak spotřebič třídy I.
 */
export function guessDeviceType(name: string): { type: EquipmentType; protectionClass: "I" | "II" | "III" | null; handHeld: boolean } {
  const text = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/prodluz|prodluzovac|pohybliv\w* privod|rozbocov|privodni snura|extension/.test(text)) return { type: "EXTENSION_CORD", protectionClass: "I", handHeld: true };
  if (/vrtac|brusk|flexa|pila|sroubov|kladiv|bourac|nářadí|naradi|fen horkovzd|aku |hoblik/.test(text)) return { type: "POWER_TOOL", protectionClass: "II", handHeld: true };
  if (/svarec|svářeč|svarovac|welder/.test(text)) return { type: "WELDER", protectionClass: "I", handHeld: false };
  if (/rozvadec|rozvodnic|switchboard|^r[hp]\d*\b/.test(text)) return { type: "SWITCHBOARD", protectionClass: null, handHeld: false };
  if (/stroj|soustruh|frez|lis\b|kompresor|machine|linka/.test(text)) return { type: "MACHINE", protectionClass: "I", handHeld: false };
  return { type: "APPLIANCE", protectionClass: "I", handHeld: false };
}

export interface PaletteDevice {
  id: string;
  emoji: string;
  label: string;
  type: EquipmentType;
  protectionClass: "I" | "II" | "III" | null;
  handHeld: boolean;
}

export interface PaletteGroup {
  id: string;
  title: string;
  items: PaletteDevice[];
}

/** Rychlá paleta – co se v kancelářích, kuchyňkách, dílnách a budovách reviduje nejčastěji (ČSN 33 1600 ed. 2 / 33 1500). */
export const HLIDAC_PALETTE: readonly PaletteGroup[] = [
  {
    id: "office",
    title: "Kancelář a IT",
    items: [
      { id: "monitor", emoji: "🖥️", label: "Monitor", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "pc", emoji: "💻", label: "Počítač / Dokovací stanice", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "extension", emoji: "🔌", label: "Prodlužovací přívod (Prodlužovačka / Přepěťová ochrana)", type: "EXTENSION_CORD", protectionClass: "I", handHeld: true },
      { id: "printer", emoji: "🖨️", label: "Tiskárna / Kopírka", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "ac", emoji: "❄️", label: "Klimatizace", type: "HVAC_UNIT", protectionClass: "I", handHeld: false },
    ],
  },
  {
    id: "kitchen",
    title: "Kuchyňka a zázemí",
    items: [
      { id: "coffee", emoji: "☕", label: "Kávovar / Rychlovarná konvice", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "microwave", emoji: "🍲", label: "Mikrovlnná trouba", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "fridge", emoji: "🧊", label: "Lednice", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "dishwasher", emoji: "🍽️", label: "Myčka", type: "APPLIANCE", protectionClass: "I", handHeld: false },
      { id: "boiler", emoji: "🔥", label: "Ohřívač vody / Bojler", type: "APPLIANCE", protectionClass: "I", handHeld: false },
    ],
  },
  {
    id: "workshop",
    title: "Dílna a budova",
    items: [
      { id: "tool", emoji: "🛠️", label: "Ruční elektrické nářadí (vrtačka, bruska)", type: "POWER_TOOL", protectionClass: "II", handHeld: true },
      { id: "board", emoji: "⚡", label: "Rozváděč (RH / RP)", type: "SWITCHBOARD", protectionClass: null, handHeld: false },
      { id: "emergency", emoji: "🚨", label: "Nouzové osvětlení", type: "EMERGENCY_LIGHTING", protectionClass: null, handHeld: false },
      { id: "machine", emoji: "⚙️", label: "Výrobní stroj", type: "MACHINE", protectionClass: "I", handHeld: false },
    ],
  },
];

export const paletteDevice = (id: string) => HLIDAC_PALETTE.flatMap((group) => group.items).find((item) => item.id === id) ?? null;

/** Druh místnosti podle názvu (barva v půdorysu Studia). */
export function roomKind(name: string): ZoneKind {
  const text = name.toLowerCase();
  if (/rozvodn|serverov|elektro/.test(text)) return "ELECTRICAL";
  if (/sklad|archiv/.test(text)) return "STORAGE";
  if (/dílna|dilna|údržb|udrzb/.test(text)) return "WORKSHOP";
  if (/výrob|vyrob|hala|linka/.test(text)) return "PRODUCTION";
  if (/chodb|hal[ae] vstup/.test(text)) return "CORRIDOR";
  if (/kuchy|wc|šatn|satn|zázem|zazem|jídeln|jideln/.test(text)) return "FACILITIES";
  return "OFFICE";
}

/** Místnosti z textu („Kancelář 101, Open-space; Kuchyňka“ / po řádcích) – bez prázdných a duplicit, max. 24. */
export function parseRooms(text: string): string[] {
  const rooms = text.split(/[\n,;]+/).map((room) => room.trim().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean);
  return [...new Set(rooms)].slice(0, 24);
}

export const ROOM_SIZE_M = { w: 6, h: 5 } as const;
export const ROOMS_PER_ROW = 4;

/**
 * Rozvržení patra z názvů místností: místnosti 6 × 5 m v řadách po 4 (stejné pro všechna patra budovy – rastr podle
 * patra s nejvíc místnostmi). Zóny v metrech pro Studio (`saveStudioConcept`).
 */
export function buildingGrid(roomCounts: readonly number[]): GridSpec {
  const most = Math.max(1, ...roomCounts);
  const columns = Math.min(ROOMS_PER_ROW, most);
  const rows = Math.ceil(most / ROOMS_PER_ROW);
  const widthM = columns * ROOM_SIZE_M.w;
  const depthM = rows * ROOM_SIZE_M.h;
  return { cols: Math.ceil(widthM / 6) + 1, rows: Math.ceil(depthM / 6) + 1, stepMeters: 6, scale: "1:100", widthM, depthM };
}

export function roomZones(rooms: readonly string[]): GridZone[] {
  return rooms.map((name, index) => ({ key: `z${index + 1}`, x: (index % ROOMS_PER_ROW) * ROOM_SIZE_M.w, y: Math.floor(index / ROOMS_PER_ROW) * ROOM_SIZE_M.h, w: ROOM_SIZE_M.w, h: ROOM_SIZE_M.h, name, kind: roomKind(name) }));
}

/** Poloha n-tého zařízení v místnosti (rastr 1 m od rohu, po řádcích). */
export function devicePosition(zone: Pick<GridZone, "x" | "y" | "w" | "h">, index: number): { x: number; y: number } {
  const perRow = Math.max(1, Math.floor(zone.w) - 1);
  const column = index % perRow;
  const row = Math.floor(index / perRow) % Math.max(1, Math.floor(zone.h) - 1);
  return { x: Math.round((zone.x + 0.8 + column) * 10) / 10, y: Math.round((zone.y + 0.8 + row) * 10) / 10 };
}

/** Další volný kód budovy (A, B, … Z, AA …). */
export function nextBuildingCode(codes: readonly string[]): string {
  const taken = new Set(codes.map((code) => code.toUpperCase()));
  for (let index = 0; index < 26 * 27; index++) {
    const code = index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + Math.floor(index / 26) - 1)}${String.fromCharCode(65 + (index % 26))}`;
    if (!taken.has(code)) return code;
  }
  return `B${codes.length + 1}`;
}

export const HLIDAC_MODE_KEY = (plantId: string) => `hlidac-mode:${plantId}`;
