import type { PowerBackupTier } from "./power-backup";
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
  /** Úprava rozvržení stávajícího patra (Floor.id); bez něj jde o nové patro. */
  existingId?: string;
  /** Vlastní rastr upravovaného stávajícího patra (nová patra mají společný rastr konceptu). */
  grid?: GridSpec;
}

export type StudioParentRef = { kind: "existing"; id: string } | { kind: "draft"; key: string };

export interface StudioEquipmentDraft {
  key: string;
  /** Patro konceptu (`StudioFloorDraft.key`) nebo existující patro (`floorId`). */
  floor: { kind: "draft"; key: string } | { kind: "existing"; id: string };
  /** Poloha v metrech od osy A1 (jemný rastr 1 m); u spotřebičů a nářadí kotva v rohu místnosti. */
  pos: { x: number; y: number };
  /** Spotřebič / nářadí přiřazené k místnosti (klíč zóny konceptu nebo „ex:<index>“ u stávajícího patra). */
  roomKey: string | null;
  tag: string;
  name: string;
  type: EquipmentType;
  parent: StudioParentRef | null;
  circuit: string | null;
  zone: string | null;
  /** Rozváděč bez nadřazeného = hlavní rozváděč. */
  isRoot: boolean;
  /** Fáze 93: zálohování napájení rozváděče / zdroje a jeho přívodní trasy (bez údaje běžná síť). */
  powerBackupTier?: PowerBackupTier;
}

export type StudioBuildingDraft =
  | { mode: "new"; code: string; name: string; type: BuildingType; map: { x: number; y: number; w: number; h: number } }
  /** Stávající budova; `map` = nová poloha / velikost v areálu (procenta mapy), bez něj se nemění. */
  | { mode: "existing"; id: string; map?: { x: number; y: number; w: number; h: number } | null };

/** Nový závod od nuly (Studio): vznikne ve stejné transakci jako první budova. */
export interface StudioNewPlantDraft {
  name: string;
  code: string;
  /** „Ulice 12, Město“ nebo jen město. */
  location: string;
}

/** Rozměr areálu v metrech (osa X × osa Y). */
export interface StudioCampusDraft {
  widthM: number;
  depthM: number;
}

export interface StudioDraft {
  /** Stávající závod; při `newPlant` se ignoruje. */
  plantId: string;
  newPlant?: StudioNewPlantDraft | null;
  /** Rozměr areálu; u stávajícího závodu se při změně přepočítají polohy budov. */
  campus?: StudioCampusDraft | null;
  grid: GridSpec;
  building: StudioBuildingDraft;
  floors: StudioFloorDraft[];
  equipment: StudioEquipmentDraft[];
  /** Nový název / využití stávajících pater upravované budovy. */
  floorRenames?: { id: string; usage: string }[];
  /** Úpravy stávajících zařízení (tag, název, napájení, vývod, místnost) z kroku 3 „Upravit stávající“. */
  equipmentEdits?: StudioEquipmentEdit[];
  /** Uložená zařízení budovy ke smazání (Studio: „Smazat“ s potvrzením, „−“ u skupiny). */
  equipmentDeletes?: string[];
}

export interface StudioEquipmentEdit {
  id: string;
  tag: string;
  name: string;
  parentId: string | null;
  circuit: string | null;
  zone: string | null;
  /** Nová poloha v metrech od osy A1 (přesun / změna místnosti); bez ní pin zůstává. */
  pos?: { x: number; y: number } | null;
  /** Fáze 93: zálohování napájení rozváděče / zdroje (bez údaje beze změny). */
  powerBackupTier?: PowerBackupTier;
}

/** Jedna budova konceptu (Studio zvládne více budov v jednom průchodu). */
export type StudioBuildingConcept = Pick<StudioDraft, "grid" | "building" | "floors" | "equipment" | "floorRenames" | "equipmentEdits" | "equipmentDeletes">;

/** Celý koncept Studia: závod (nový / stávající), areál a jedna či více budov – uloží se v jedné transakci. */
export interface StudioConceptDraft {
  plantId: string;
  newPlant?: StudioNewPlantDraft | null;
  campus?: StudioCampusDraft | null;
  buildings: StudioBuildingConcept[];
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
