import type { EquipmentType } from "@/generated/prisma/enums";

// Kategorie zařízení ve Studiu (krok 3): barva banneru, značky na půdorysu, seznamu i legendy
// a způsob umístění – pevná zařízení do jemného rastru, spotřebiče a nářadí do místnosti.

export type EquipmentCategoryKey = "TR" | "R" | "STR" | "ROB" | "TECH" | "SP" | "RN";
export type PlacementMode = "grid" | "room";

export interface EquipmentCategory {
  key: EquipmentCategoryKey;
  /** Zkratka na banneru („R / RH / RP“). */
  code: string;
  label: string;
  color: string;
  /** Emoji do inventárního štítku místnosti. */
  emoji: string;
  /** Typy v kategorii; první je výchozí. */
  types: readonly EquipmentType[];
  placement: PlacementMode;
}

export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = [
  { key: "TR", code: "TR", label: "Transformátor / Trafostanice", color: "#f97316", emoji: "⚡", types: ["TRANSFORMER"], placement: "grid" },
  { key: "R", code: "R / RH / RP", label: "Rozváděč", color: "#eab308", emoji: "🗄️", types: ["SWITCHBOARD"], placement: "grid" },
  { key: "STR", code: "STR / CNC", label: "Výrobní stroj / Linka", color: "#3b82f6", emoji: "🏭", types: ["PRODUCTION_LINE", "MACHINE", "CNC_MACHINE"], placement: "grid" },
  { key: "ROB", code: "ROB", label: "Robotické pracoviště", color: "#a855f7", emoji: "🤖", types: ["ROBOT_CELL"], placement: "grid" },
  {
    key: "TECH",
    code: "TECH",
    label: "Technologie / VZT / Kompresor",
    color: "#10b981",
    emoji: "🌀",
    types: ["HVAC_UNIT", "COMPRESSOR", "EMERGENCY_LIGHTING", "LIGHTNING_ROD"],
    placement: "grid",
  },
  { key: "SP", code: "SP", label: "Spotřebič", color: "#ec4899", emoji: "🔌", types: ["APPLIANCE", "EXTENSION_CORD"], placement: "room" },
  { key: "RN", code: "RN", label: "Ruční nářadí", color: "#06b6d4", emoji: "🛠️", types: ["POWER_TOOL", "WELDER"], placement: "room" },
];

const BY_TYPE = new Map<EquipmentType, EquipmentCategory>(EQUIPMENT_CATEGORIES.flatMap((category) => category.types.map((type) => [type, category] as const)));
const FALLBACK: EquipmentCategory = { key: "TECH", code: "X", label: "Ostatní", color: "#94a3b8", emoji: "📦", types: ["OTHER"], placement: "grid" };

/** Kategorie typu zařízení (neznámý typ → šedá „Ostatní“). */
export const categoryOf = (type: EquipmentType): EquipmentCategory => BY_TYPE.get(type) ?? FALLBACK;

export const categoryByKey = (key: EquipmentCategoryKey) => EQUIPMENT_CATEGORIES.find((category) => category.key === key)!;

/** Typy osaditelné ve Studiu. */
export const PLACEABLE_TYPES: readonly EquipmentType[] = EQUIPMENT_CATEGORIES.flatMap((category) => category.types);

/** Umisťuje se typ do místnosti (spotřebiče, nářadí), nebo do jemného rastru? */
export const placementOf = (type: EquipmentType): PlacementMode => categoryOf(type).placement;

/** Inventární štítek místnosti: „🔌 3× Spotřebič · 🛠️ 2× Nářadí“. */
export function roomInventoryLabel(types: readonly EquipmentType[]): string {
  const counts = new Map<EquipmentCategoryKey, number>();
  for (const type of types) counts.set(categoryOf(type).key, (counts.get(categoryOf(type).key) ?? 0) + 1);
  const short: Partial<Record<EquipmentCategoryKey, string>> = { SP: "Spotřebič", RN: "Nářadí" };
  return EQUIPMENT_CATEGORIES.filter((category) => counts.has(category.key))
    .map((category) => `${category.emoji} ${counts.get(category.key)}× ${short[category.key] ?? category.label}`)
    .join(" · ");
}
