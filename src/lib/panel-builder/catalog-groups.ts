// Katalog prvků po výrobcích a kategoriích (fáze 47): rozcestník výrobců → kategorie výrobce → prvky.
// Skupiny skládají katalogové přístroje (CatalogComponent), skříně (PanelEnclosure), domovní přístroje
// (WiringDevice) a ventilátory rozváděčů (EnclosureFan). Čisté funkce.

import type { ComponentCategory, Prisma } from "@/generated/prisma/client";

export type CatalogGroupId = "MCB" | "RCD" | "RCBO" | "SWITCH" | "SPD" | "CONTACTOR" | "SMART" | "ENCLOSURE" | "WIRING" | "ACCESSORY" | "FAN";

export interface CatalogGroup {
  id: CatalogGroupId;
  label: string;
  icon: string;
  /** Zdroj dat skupiny. */
  source: "component" | "enclosure" | "wiring" | "fan";
}

export const CATALOG_GROUPS: readonly CatalogGroup[] = [
  { id: "MCB", label: "Jističe (MCB)", icon: "⚡", source: "component" },
  { id: "RCD", label: "Proudové chrániče (RCD)", icon: "🛡️", source: "component" },
  { id: "RCBO", label: "Jističochrániče (RCBO – vč. 1M kompaktních DS301C)", icon: "🔰", source: "component" },
  { id: "SWITCH", label: "Odpínače a hlavní vypínače", icon: "🔴", source: "component" },
  { id: "SPD", label: "Přepěťové ochrany (SPD)", icon: "🌩️", source: "component" },
  { id: "CONTACTOR", label: "Stykače a instalační relé (vč. ručních EN25-40N)", icon: "🔁", source: "component" },
  // Fáze 81: akční členy, zdroje a systémové moduly ABB-free@home, ABB i-bus KNX, Loxone a TapHome (filtr systému)
  { id: "SMART", label: "Chytrá domácnost / PLC / Aktory (free@home, KNX, Loxone, TapHome)", icon: "🏠", source: "component" },
  { id: "ENCLOSURE", label: "Rozvodnice a skříně rozváděčů (12M až 144M+)", icon: "🗄️", source: "enclosure" },
  { id: "WIRING", label: "Domovní vypínače, zásuvky a rámečky (Tango, Levit, Unica, Valena…)", icon: "🔌", source: "wiring" },
  { id: "ACCESSORY", label: "Svorkovnice, hřebeny a příslušenství", icon: "🔩", source: "component" },
  { id: "FAN", label: "Ventilátory a chlazení rozváděčů", icon: "🌀", source: "fan" },
];

export const isCatalogGroup = (value: unknown): value is CatalogGroupId => CATALOG_GROUPS.some((group) => group.id === value);
export const catalogGroupOf = (id: CatalogGroupId) => CATALOG_GROUPS.find((group) => group.id === id)!;

const ACCESSORY_SUBTYPES = ["BUSBAR", "BUSBAR_END_CAP", "AUX_CONTACT", "SHUNT_TRIP", "UNDERVOLTAGE_TRIP", "FUSE_LINK", "DIN_SOCKET", "INDICATOR", "BLANK_COVER", "TERMINAL_BLOCK", "MAIN_TERMINAL", "FUSE_DISCONNECTOR"];

/** Skupina katalogového přístroje podle kategorie a podtypu. */
export function componentGroup(component: { category: ComponentCategory; moduleSubtype?: string | null }): CatalogGroupId {
  switch (component.category) {
    case "MCB":
      return "MCB";
    case "RCD":
      return "RCD";
    case "RCBO":
      return "RCBO";
    case "MAIN_SWITCH":
      return "SWITCH";
    case "SPD":
      return "SPD";
    case "CONTACTOR":
    case "RELAY":
      return "CONTACTOR";
    case "PLC":
    case "PSU":
      return "SMART";
    case "TERMINAL":
      return "ACCESSORY";
    case "ENCLOSURE":
      return "ENCLOSURE";
    default:
      return component.moduleSubtype && ACCESSORY_SUBTYPES.includes(component.moduleSubtype) ? "ACCESSORY" : "SMART";
  }
}

/** Podmínka Prismy pro skupinu přístrojů (zdroj „component“). */
export function componentGroupWhere(group: CatalogGroupId): Prisma.CatalogComponentWhereInput {
  switch (group) {
    case "MCB":
      return { category: "MCB" };
    case "RCD":
      return { category: "RCD" };
    case "RCBO":
      return { category: "RCBO" };
    case "SWITCH":
      return { category: "MAIN_SWITCH" };
    case "SPD":
      return { category: "SPD" };
    case "CONTACTOR":
      return { category: { in: ["CONTACTOR", "RELAY"] } };
    case "SMART":
      return { OR: [{ category: { in: ["PLC", "PSU"] } }, { category: "OTHER", NOT: { moduleSubtype: { in: ACCESSORY_SUBTYPES } } }, { category: "OTHER", moduleSubtype: null }] };
    case "ACCESSORY":
      return { OR: [{ category: "TERMINAL" }, { category: "OTHER", moduleSubtype: { in: ACCESSORY_SUBTYPES } }] };
    default:
      return { id: "__none__" };
  }
}

/** Rychlé filtry (dlaždice) ve 3. kroku podle skupiny. */
export const GROUP_FILTERS: Partial<Record<CatalogGroupId, ("poles" | "current" | "curve" | "sensitivity" | "series" | "system")[]>> = {
  MCB: ["poles", "curve", "current"],
  RCD: ["poles", "sensitivity", "current"],
  RCBO: ["curve", "current", "sensitivity"],
  SWITCH: ["poles", "current"],
  SPD: ["poles"],
  CONTACTOR: ["current"],
  SMART: ["system", "series"],
  ACCESSORY: ["series"],
  WIRING: ["series"],
  ENCLOSURE: ["series"],
  FAN: ["series"],
};
