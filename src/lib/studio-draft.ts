import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";

import type { GridGate, GridSpec, GridZone } from "./cad-grid";

// Koncept Studia výstavby závodu (klient → Server Action → služba). Čistá data.

export interface StudioFloorDraft {
  key: string;
  /** -2 = 2. PP, -1 = 1. PP, 0 = 1. NP, 1 = 2. NP … */
  level: number;
  usage: string;
  zones: GridZone[];
  gates: GridGate[];
}

export type StudioParentRef = { kind: "existing"; id: string } | { kind: "draft"; key: string };

export interface StudioEquipmentDraft {
  key: string;
  /** Patro konceptu (`StudioFloorDraft.key`) nebo existující patro (`floorId`). */
  floor: { kind: "draft"; key: string } | { kind: "existing"; id: string };
  /** Průsečík rastru, např. „B11“. */
  at: string;
  tag: string;
  name: string;
  type: EquipmentType;
  parent: StudioParentRef | null;
  circuit: string | null;
  zone: string | null;
  /** Rozváděč bez nadřazeného = hlavní rozváděč. */
  isRoot: boolean;
}

export type StudioBuildingDraft =
  | { mode: "new"; code: string; name: string; type: BuildingType; map: { x: number; y: number; w: number; h: number } }
  | { mode: "existing"; id: string };

/** Nový závod od nuly (Studio): vznikne ve stejné transakci jako první budova. */
export interface StudioNewPlantDraft {
  name: string;
  code: string;
  /** „Ulice 12, Město“ nebo jen město. */
  location: string;
  widthM: number;
  depthM: number;
}

export interface StudioDraft {
  /** Stávající závod; při `newPlant` se ignoruje. */
  plantId: string;
  newPlant?: StudioNewPlantDraft | null;
  grid: GridSpec;
  building: StudioBuildingDraft;
  floors: StudioFloorDraft[];
  equipment: StudioEquipmentDraft[];
}

/** Kód a název patra: level 0 → „1NP“ / „1. NP“, level −1 → „1PP“ / „1. PP“. */
export function floorLabel(level: number): { code: string; short: string } {
  const n = level >= 0 ? level + 1 : -level;
  const kind = level >= 0 ? "NP" : "PP";
  return { code: `${n}${kind}`, short: `${n}. ${kind}` };
}

export const floorName = (level: number, usage: string) => `${floorLabel(level).short}${usage.trim() ? ` - ${usage.trim()}` : ""}`;

/** Obdélník v areálu (procenta) → polygon budovy „x,y x,y …“. */
export function rectPolygon(map: { x: number; y: number; w: number; h: number }): string {
  const r = (value: number) => Math.round(value * 10) / 10;
  const { x, y, w, h } = map;
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
    .map(([px, py]) => `${r(px)},${r(py)}`)
    .join(" ");
}
