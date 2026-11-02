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


/** Konkrétní produktová šablona (banner „Vytvořit nové“ v kroku 3): typ, český název a emoji. */
export interface ProductTemplate {
  key: string;
  label: string;
  emoji: string;
  type: EquipmentType;
  /** Základ názvu zařízení („Úhlová bruska“ → „Úhlová bruska – Dílna údržby“). */
  name: string;
  /** Rozváděč: hlavní (kořenový) zdroj. */
  root?: boolean;
  /** Výchozí prefix tagu dlaždice („KAV“ → KAV01, KAV02 …); jinak autopilot podle typu. */
  prefix?: string;
}

const product = (key: string, label: string, emoji: string, type: EquipmentType, name = label, root?: boolean): ProductTemplate => ({ key, label, emoji, type, name, root });

/** Produktové banery podle kategorie (zadání fáze 38) – vždy i „Vlastní zařízení“. */
export const PRODUCT_TEMPLATES: Record<EquipmentCategoryKey, readonly ProductTemplate[]> = {
  TR: [product("tr", "Transformátor / Trafostanice", "⚡", "TRANSFORMER", "Transformátor")],
  R: [
    product("rh", "Hlavní rozváděč (RH)", "⚡", "SWITCHBOARD", "Hlavní rozváděč", true),
    product("rp", "Podružný / Patrový rozváděč (RP)", "🔌", "SWITCHBOARD", "Podružný rozváděč"),
    product("rm", "Rozváděč stroje / linky (RM)", "🤖", "SWITCHBOARD", "Rozváděč stroje"),
  ],
  STR: [
    product("press", "Lisovací linka", "🏭", "PRODUCTION_LINE"),
    product("cnc", "CNC obráběcí centrum", "⚙️", "CNC_MACHINE"),
    product("lathe", "Soustruh / Frézka", "🔧", "MACHINE"),
    product("assembly", "Montážní / Balicí linka", "📦", "PRODUCTION_LINE"),
    product("crane", "Jeřáb / Zdvihadlo", "🏗️", "MACHINE"),
  ],
  ROB: [
    product("weld-robot", "Svařovací robot", "🤖", "ROBOT_CELL"),
    product("handling", "Manipulační robotická buňka", "🦾", "ROBOT_CELL"),
    product("vision", "Kamerové / Kontrolní pracoviště", "👁️", "ROBOT_CELL"),
  ],
  TECH: [
    product("hvac", "Vzduchotechnická jednotka (VZT)", "🌀", "HVAC_UNIT", "Vzduchotechnická jednotka"),
    product("compressor", "Kompresorová stanice", "💨", "COMPRESSOR"),
    product("cooling", "Chlazení / Tepelné čerpadlo", "❄️", "HVAC_UNIT"),
    product("emergency", "Nouzové osvětlení / Hromosvod", "🚨", "EMERGENCY_LIGHTING", "Nouzové osvětlení"),
  ],
  SP: [
    product("vacuum", "Průmyslový vysavač", "🧹", "APPLIANCE"),
    product("coffee", "Kávovar / Rychlovarná konvice", "☕", "APPLIANCE", "Kávovar"),
    product("fridge", "Chladnička / Mikrovlnka", "🧊", "APPLIANCE", "Chladnička"),
    product("pc", "PC sestava / Tiskárna", "🖥️", "APPLIANCE", "PC sestava"),
    product("cord", "Prodlužovací přívod / Buben", "🔌", "EXTENSION_CORD", "Prodlužovací přívod"),
  ],
  RN: [
    product("drill", "Vrtačka / Aku šroubovák", "🔩", "POWER_TOOL", "Vrtačka"),
    product("grinder", "Úhlová bruska", "⚙️", "POWER_TOOL"),
    product("hammer", "Vrtací / Bourací kladivo", "🔨", "POWER_TOOL", "Vrtací kladivo"),
    product("heatgun", "Horkovzdušná pistole", "🔥", "POWER_TOOL"),
    product("welder", "Svářečka", "⚡", "WELDER"),
    product("meter", "Měřicí přístroj", "📏", "POWER_TOOL"),
  ],
};

/** Dlaždice „Vlastní zařízení / Vytvořit nový Tag“ – výchozí typ kategorie. */
export const customTemplate = (category: EquipmentCategory): ProductTemplate => product(`custom-${category.key}`, "Vlastní zařízení / Vytvořit nový Tag", "🏷️", category.types[0], category.label.split(" / ")[0]);

/** Základ názvu zařízení bez místnosti a tagu („SP-0003 - Kávovar – Kancelář 1“ → „Kávovar“). */
export function deviceBaseName(name: string, tag?: string): string {
  let base = name.trim();
  if (tag && base.toUpperCase().startsWith(`${tag.toUpperCase()} - `)) base = base.slice(tag.length + 3);
  const dash = base.lastIndexOf(" – ");
  if (dash > 0) base = base.slice(0, dash);
  return base.trim() || name.trim();
}

/** Seskupený štítek místnosti: „☕ 2× Kávovar“. */
export interface InventoryGroup {
  /** Klíč skupiny = kategorie + název (malými písmeny). */
  key: string;
  label: string;
  emoji: string;
  color: string;
  category: EquipmentCategoryKey;
  count: number;
}

/**
 * Spotřebiče a nářadí v místnosti sečtené podle názvu přístroje (fáze 39). Ikona podle dlaždice se
 * stejným názvem (výchozí i vlastní nabídka), jinak podle kategorie. Řazení: nejvíc kusů první.
 */
export function roomInventoryGroups(items: readonly { name: string; type: EquipmentType; tag?: string }[], templates: readonly ProductTemplate[] = []): InventoryGroup[] {
  const known = [...templates, ...Object.values(PRODUCT_TEMPLATES).flat()];
  const groups = new Map<string, InventoryGroup>();
  for (const item of items) {
    const category = categoryOf(item.type);
    const label = deviceBaseName(item.name, item.tag);
    const key = `${category.key}:${label.toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.count++;
    else {
      const template = known.find((entry) => entry.name.toLowerCase() === label.toLowerCase() || entry.label.toLowerCase() === label.toLowerCase());
      groups.set(key, { key, label, emoji: template?.emoji ?? category.emoji, color: category.color, category: category.key, count: 1 });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "cs"));
}

export const inventoryChipText = (group: InventoryGroup) => `${group.emoji} ${group.count}× ${group.label}`;
