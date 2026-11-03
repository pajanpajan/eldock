// Samolepicí popisky rozváděče v měřítku 1:1 (fáze 43): souvislé pásy nad / pod DIN lišty (políčko =
// fyzická šířka přístroje, 1 modul = 17,5 nebo 18 mm), malé štítky 17 × 9 mm na přístroje a export
// pro štítkovačky (CSV / XLSX). Čisté funkce.

import { readingOrder } from "./tree";
import { symbolTexts, type VectorDevice } from "./vector-symbols";

export const MODULE_MM_OPTIONS = [17.5, 18] as const;
export const STRIP_HEIGHT_OPTIONS = [9, 12, 15] as const;
export type ModuleMm = (typeof MODULE_MM_OPTIONS)[number];
export type StripHeight = (typeof STRIP_HEIGHT_OPTIONS)[number];

/** Barvy fází dle ČSN 33 0165: L1 hnědá, L2 černá, L3 šedá. */
export const PHASE_COLORS: Record<"L1" | "L2" | "L3", string> = { L1: "#8b4513", L2: "#111111", L3: "#8a8a8a" };
/** Barvy skupin (podle nadřazeného chrániče) pro přístroje bez přiřazené fáze. */
const GROUP_COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#be185d", "#65a30d"];

export interface LabelDevice extends VectorDevice {
  phaseAssignment: string | null;
  parentItemId: string | null;
}

export interface StripCell {
  id: string | null;
  designation: string;
  label: string;
  value: string;
  modules: number;
  widthMm: number;
  /** Barevný proužek: 1 barva (fáze / skupina) nebo 3 barvy u třífázového přístroje. */
  colors: string[];
  empty: boolean;
}

export interface LabelStrip {
  rail: number;
  capacity: number;
  widthMm: number;
  cells: StripCell[];
}

/** Barvy proužku podle fáze, jinak podle skupiny (nadřazený prvek). */
export function stripColors(device: Pick<LabelDevice, "phaseAssignment" | "parentItemId" | "id">, groups: ReadonlyMap<string, number>): string[] {
  const phases = (device.phaseAssignment ?? "").split(",").filter((phase): phase is "L1" | "L2" | "L3" => phase in PHASE_COLORS);
  if (phases.length) return phases.map((phase) => PHASE_COLORS[phase]);
  const group = groups.get(device.parentItemId ?? device.id) ?? 0;
  return [GROUP_COLORS[group % GROUP_COLORS.length]];
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Souvislé pásy pro každou lištu; volné moduly na konci jsou prázdné políčko. */
export function labelStrips(devices: readonly LabelDevice[], capacities: readonly number[], moduleMm: number): LabelStrip[] {
  const groupKeys = [...new Set(readingOrder(devices).map((device) => device.parentItemId ?? device.id))];
  const groups = new Map(groupKeys.map((key, index) => [key, index]));
  const railCount = Math.max(capacities.length, ...devices.map((device) => device.dinRailIndex));
  return Array.from({ length: railCount }, (_, index) => {
    const rail = index + 1;
    const onRail = devices.filter((device) => device.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
    const used = onRail.reduce((sum, device) => sum + device.modulesWidth, 0);
    const capacity = Math.max(capacities[index] ?? used, used);
    const cells: StripCell[] = onRail.map((device) => ({
      id: device.id,
      designation: device.designation,
      label: device.label,
      value: symbolTexts(device).value.replace("?", ""),
      modules: device.modulesWidth,
      widthMm: round(device.modulesWidth * moduleMm),
      colors: stripColors(device, groups),
      empty: false,
    }));
    // Volné moduly po jednom (rezerva na pásu, dělení pásu na šířku A4 zůstane po modulech)
    for (let free = capacity - used; free > 1e-9; free -= 1) {
      const modules = Math.min(1, free);
      cells.push({ id: null, designation: "", label: "", value: "", modules, widthMm: round(modules * moduleMm), colors: [], empty: true });
    }
    return { rail, capacity, widthMm: round(capacity * moduleMm), cells };
  });
}

/** Pás širší než tisknutelná šířka A4 (190 mm) se rozdělí na části; přístroj se nikdy nerozdělí, prázdné části se vynechají. */
export function splitStrip(strip: LabelStrip, maxWidthMm = 190): StripCell[][] {
  const parts: StripCell[][] = [[]];
  let width = 0;
  for (const cell of strip.cells) {
    if (width + cell.widthMm > maxWidthMm && parts[parts.length - 1].length) {
      parts.push([]);
      width = 0;
    }
    parts[parts.length - 1].push(cell);
    width += cell.widthMm;
  }
  return parts.filter((part, index) => index === 0 || part.some((cell) => !cell.empty));
}

/** Řádky exportu pro štítkovačky (pořadí lišt zleva doprava). */
export function labelRows(devices: readonly LabelDevice[], moduleMm: number): (string | number)[][] {
  return [
    ["Lišta", "Pozice", "Značení", "Funkce obvodu", "Hodnota", "Typ", "Šířka [M]", "Šířka [mm]", "Fáze"],
    ...[...devices]
      .sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail)
      .map((device) => [
        device.dinRailIndex,
        device.positionOnRail,
        device.designation,
        device.label,
        symbolTexts(device).value.replace("?", ""),
        device.typeCode ?? "",
        device.modulesWidth,
        round(device.modulesWidth * moduleMm),
        device.phaseAssignment ?? "",
      ]),
  ];
}

/** CSV se středníkem a BOM (Excel v češtině, Brother P-Touch Editor, Dymo Connect). */
export function labelsCsv(rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number) => {
    const text = typeof value === "number" ? String(value).replace(".", ",") : value;
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
