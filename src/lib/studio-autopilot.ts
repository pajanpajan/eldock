import type { EquipmentType } from "@/generated/prisma/enums";

import { allowedParents, type PowerSource } from "./power-hierarchy";

// „Autopilot“ Studia: po kliknutí do rastru navrhne další volný tag, smysluplný název
// a nejvhodnější napájecí rozváděč. Čisté funkce (UI je jen volá).

/** Prefix a šířka čísla tagu; `{code}` = kód budovy. */
const TAG_PATTERNS: Record<EquipmentType, { prefix: string; width: number }> = {
  SWITCHBOARD: { prefix: "R-{code}-", width: 2 },
  TRANSFORMER: { prefix: "TR", width: 1 },
  PRODUCTION_LINE: { prefix: "ML-", width: 2 },
  MACHINE: { prefix: "STR-", width: 2 },
  CNC_MACHINE: { prefix: "CNC-", width: 2 },
  ROBOT_CELL: { prefix: "ROB-", width: 2 },
  HVAC_UNIT: { prefix: "VZT-", width: 2 },
  COMPRESSOR: { prefix: "KS", width: 1 },
  APPLIANCE: { prefix: "SP-", width: 4 },
  POWER_TOOL: { prefix: "NR-", width: 4 },
  EXTENSION_CORD: { prefix: "PP-", width: 4 },
  WELDER: { prefix: "SV-", width: 4 },
  LIGHTNING_ROD: { prefix: "LPS-{code}", width: 0 },
  EMERGENCY_LIGHTING: { prefix: "NO-{code}", width: 0 },
  OTHER: { prefix: "X-", width: 2 },
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Další volný tag podle typu (R-C-01, ML-03, SP-0323, LPS-C, LPS-C2 …). */
export function nextTag(type: EquipmentType, context: { buildingCode: string; tags: readonly string[] }): string {
  const pattern = TAG_PATTERNS[type];
  const prefix = pattern.prefix.replace("{code}", context.buildingCode.toUpperCase() || "X");
  const taken = new Set(context.tags.map((tag) => tag.toUpperCase()));
  if (pattern.width === 0) {
    if (!taken.has(prefix)) return prefix;
    for (let n = 2; ; n++) if (!taken.has(`${prefix}${n}`)) return `${prefix}${n}`;
  }
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, "i");
  const max = Math.max(0, ...context.tags.map((tag) => Number(regex.exec(tag)?.[1] ?? 0)));
  return `${prefix}${String(max + 1).padStart(pattern.width, "0")}`;
}

const BASE_NAMES: Partial<Record<EquipmentType, string>> = {
  TRANSFORMER: "Transformátor",
  PRODUCTION_LINE: "Výrobní linka",
  MACHINE: "Stroj",
  CNC_MACHINE: "CNC centrum",
  ROBOT_CELL: "Robotické pracoviště",
  HVAC_UNIT: "Vzduchotechnická jednotka",
  COMPRESSOR: "Kompresor",
  APPLIANCE: "Spotřebič",
  POWER_TOOL: "Ruční nářadí",
  EXTENSION_CORD: "Prodlužovací přívod",
  WELDER: "Svářečka",
  LIGHTNING_ROD: "Hromosvod",
  EMERGENCY_LIGHTING: "Nouzové osvětlení",
  OTHER: "Zařízení",
};

/** Krátký název budovy: „Hala C - Svařovna“ → „Hala C“. */
export const buildingShortName = (name: string) => name.split(" - ")[0].trim();

/** Návrh názvu: rozváděč podle pořadí v budově, ostatní podle typu, čísla tagu a místnosti. */
export function suggestName(type: EquipmentType, context: { tag: string; zone: string | null; buildingName: string; boardsInBuilding: number }): string {
  const zone = context.zone?.trim() ? ` – ${context.zone.trim()}` : "";
  if (type === "SWITCHBOARD") {
    if (context.boardsInBuilding === 0) return `Hlavní rozváděč ${buildingShortName(context.buildingName)}`;
    return context.zone?.trim() ? `Rozváděč${zone}` : `Podružný rozváděč ${context.boardsInBuilding + 1}`;
  }
  const number = /(\d+)$/.exec(context.tag)?.[1];
  const numbered = ["PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR", "TRANSFORMER"].includes(type);
  const base = BASE_NAMES[type] ?? "Zařízení";
  if (type === "LIGHTNING_ROD" || type === "EMERGENCY_LIGHTING") return `${base} ${buildingShortName(context.buildingName)}${zone}`;
  return `${base}${numbered && number ? ` ${Number(number)}` : ""}${zone}`;
}

export interface AutopilotSource extends PowerSource {
  /** Hlavní rozváděč (napájený z trafa nebo kořenový). */
  isMain: boolean;
  /** Rozváděč patří do upravované budovy (koncept nebo stávající patra). */
  inBuilding: boolean;
}

/** Nejvhodnější napájení: rozváděč na stejném patře → v téže budově → hlavní rozváděč → první povolený. */
export function bestParent<T extends AutopilotSource>(type: EquipmentType, sources: readonly T[], floorId: string): T | null {
  const allowed = allowedParents(type, sources, floorId);
  if (!allowed.length) return null;
  const boards = allowed.filter((source) => source.type === "SWITCHBOARD");
  return (
    boards.find((source) => source.floorId === floorId) ??
    boards.find((source) => source.inBuilding) ??
    boards.find((source) => source.isMain) ??
    allowed[0]
  );
}
