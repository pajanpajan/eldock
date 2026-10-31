// Katalog prvků AI Panel Builderu – popisky, normalizace pro hledání a odhady parametrů podle
// IEC tabulek. Čisté funkce bez Prismy (sdílí klient, server i seed).

import type { ComponentCategory, ComponentDataSource } from "@/generated/prisma/enums";

export const COMPONENT_CATEGORIES = [
  "MAIN_SWITCH",
  "MCB",
  "RCD",
  "RCBO",
  "SPD",
  "CONTACTOR",
  "RELAY",
  "PSU",
  "PLC",
  "TERMINAL",
  "ENCLOSURE",
  "OTHER",
] as const satisfies readonly ComponentCategory[];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  MAIN_SWITCH: "Hlavní vypínač / odpínač",
  MCB: "Jistič",
  RCD: "Proudový chránič",
  RCBO: "Jističochránič",
  SPD: "Přepěťová ochrana",
  CONTACTOR: "Stykač",
  RELAY: "Relé",
  PSU: "Napájecí zdroj",
  PLC: "PLC / řídicí systém",
  TERMINAL: "Svorka",
  ENCLOSURE: "Skříň rozváděče",
  OTHER: "Jiné",
};

export const DATA_SOURCE_LABELS: Record<ComponentDataSource, string> = {
  SEED_CATALOG: "Katalog Eldock",
  PDF_DATASHEET: "PDF datasheet",
  GEMINI_AI: "Gemini AI",
  IEC_ESTIMATE: "PDF + odhad Pv (IEC)",
};

/** „Různí výrobci / Auto-detekce AI“ – rozváděč s přístroji více značek (bez preference). */
export const MIX = "MIX";
export const isMix = (manufacturer: string | null | undefined) => !manufacturer?.trim() || manufacturer === MIX;

/** Značky v nabídce nového projektu: hodnota = název v katalogu, popisek = obchodní název. */
export const MANUFACTURER_OPTIONS = [
  { value: MIX, label: "⚡ Různí výrobci / Auto-detekce AI" },
  { value: "ABB", label: "ABB" },
  { value: "Eaton", label: "Eaton" },
  { value: "OEZ", label: "OEZ" },
  { value: "Schneider", label: "Schneider Electric" },
  { value: "Hager", label: "Hager" },
  { value: "Noark", label: "Noark" },
  { value: "Schrack", label: "Schrack" },
  { value: "Saltek", label: "Saltek" },
  { value: "Finder", label: "Finder" },
] as const;

/** Rychlé záložky výrobce v Smart Fallback Pickeru (null = všichni). */
export const PICKER_MANUFACTURERS = [
  { value: null, label: "Všichni" },
  { value: "ABB", label: "ABB" },
  { value: "Eaton", label: "EATON" },
  { value: "OEZ", label: "OEZ" },
  { value: "Schneider", label: "SCHNEIDER" },
  { value: "Hager", label: "HAGER" },
  { value: "Saltek", label: "SALTEK" },
  { value: "Finder", label: "FINDER" },
] as const;

const MANUFACTURER_ALIASES: [RegExp, string][] = [
  [/^abb\b/, "ABB"],
  [/^(eaton|moeller)\b/, "Eaton"],
  [/^oez\b/, "OEZ"],
  [/^(schneider|telemecanique|merlin gerin)\b/, "Schneider"],
  [/^hager\b/, "Hager"],
  [/^noark\b/, "Noark"],
  [/^schrack\b/, "Schrack"],
  [/^saltek\b/, "Saltek"],
  [/^finder\b/, "Finder"],
  [/^siemens\b/, "Siemens"],
  [/^legrand\b/, "Legrand"],
];

/** Jednotný název výrobce (odpověď AI „SCHNEIDER ELECTRIC“ → katalogový „Schneider“). */
export function normalizeManufacturer(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === MIX) return null;
  const lower = normalizeSearch(trimmed);
  return MANUFACTURER_ALIASES.find(([pattern]) => pattern.test(lower))?.[1] ?? trimmed;
}

export const POLES = ["1P", "1P+N", "2P", "3P", "3P+N", "4P"] as const;
export type Poles = (typeof POLES)[number];
export const CURVES = ["B", "C", "D"] as const;
export const RATED_CURRENTS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63] as const;

export const isPoles = (value: string): value is Poles => (POLES as readonly string[]).includes(value);

/** Počet proudovodných pólů (1P+N = 2, 3P+N = 4). */
export const poleCount = (poles: string) => ({ "1P": 1, "1P+N": 2, "2P": 2, "3P": 3, "3P+N": 4, "4P": 4 })[poles] ?? 1;

/** Počet fázových pólů (bez N): 1P, 1P+N, 2P → 1; 3P, 3P+N, 4P → 3. */
export const phaseCount = (poles: string) => (poleCount(poles) >= 3 ? 3 : 1);

/** Lowercase bez diakritiky a nadbytečných mezer – hledání „jistic b16“ najde „Jistič … B16“. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface CatalogFields {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  ean?: string | null;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve?: string | null;
  rcdSensitivityMa?: number | null;
  rcdType?: string | null;
  description: string;
}

/** Text pro okamžité hledání: výrobce, řada, typ (i bez pomlček), obj. číslo, EAN, kategorie a popis. */
export function buildSearchText(component: CatalogFields): string {
  const compactType = component.typeCode.replace(/[\s\-/,.]/g, "");
  const curve = component.trippingCurve ? `${component.trippingCurve}${component.ratedCurrentA}` : "";
  return normalizeSearch(
    [
      component.manufacturer,
      component.series,
      component.typeCode,
      compactType,
      component.articleNumber,
      component.ean ?? "",
      CATEGORY_LABELS[component.category],
      component.poles,
      `${component.ratedCurrentA}a`,
      curve,
      component.rcdSensitivityMa ? `${component.rcdSensitivityMa}ma` : "",
      component.rcdType ? `typ ${component.rcdType}` : "",
      component.description,
    ].join(" "),
  );
}

/** IEC značka pro 1P schéma podle kategorie a pólů. */
export function iecSymbolFor(category: ComponentCategory, poles: string): string {
  switch (category) {
    case "MAIN_SWITCH":
      return "SWITCH_3P";
    case "SPD":
      return "SPD_T2";
    case "RCD":
    case "RCBO":
      return "RCD_4P";
    case "MCB":
      return phaseCount(poles) === 3 ? "MCB_3P" : "MCB_1P";
    case "CONTACTOR":
      return "CONTACTOR";
    default:
      return "GENERIC";
  }
}

/** Typická šířka v modulech 18 mm, není-li v podkladech. */
export function estimateModules(category: ComponentCategory, poles: string, ratedCurrentA: number): number {
  const count = poleCount(poles);
  switch (category) {
    case "MCB":
    case "MAIN_SWITCH":
      return count;
    case "RCD":
      return count >= 4 ? 4 : 2;
    case "RCBO":
      return count >= 4 ? 4 : 2;
    case "SPD":
      return count >= 4 ? 4 : count;
    case "CONTACTOR":
      return ratedCurrentA > 25 || count >= 4 ? 2 : 1;
    case "PSU":
      return 4;
    case "PLC":
      return 6;
    case "ENCLOSURE":
      return 0;
    default:
      return 1;
  }
}

/** Ztráta jističe na pól při In [W] – orientační hodnoty výrobců (System pro M, PL7, Minia, iC60). */
const MCB_LOSS: [number, number][] = [
  [2, 1.2],
  [6, 1.6],
  [10, 2.1],
  [13, 2.3],
  [16, 2.5],
  [20, 2.9],
  [25, 3.1],
  [32, 3.6],
  [40, 4.4],
  [50, 5.0],
  [63, 6.0],
];

const interpolateLoss = (table: [number, number][], current: number) => {
  if (current <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [c1, p1] = table[i];
    const [c0, p0] = table[i - 1];
    if (current <= c1) return p0 + ((p1 - p0) * (current - c0)) / (c1 - c0);
  }
  const [cLast, pLast] = table[table.length - 1];
  return pLast * (current / cLast) ** 2;
};

/**
 * Odhad jmenovitého ztrátového výkonu Pn [W] podle IEC tabulek, když datasheet hodnotu neuvádí.
 * Konvence shodná s referenčním výpočtem: u jističů a vypínačů ztráta při In, u chráničů na pól.
 */
export function estimatePowerLoss(category: ComponentCategory, poles: string, ratedCurrentA: number): number {
  const round = (value: number) => Math.round(value * 100) / 100;
  switch (category) {
    case "MCB":
    case "RCBO":
      return round(interpolateLoss(MCB_LOSS, ratedCurrentA) + (category === "RCBO" ? 0.6 : 0));
    case "MAIN_SWITCH":
      return round(6.81 * (ratedCurrentA / 40));
    case "RCD":
      return round(3.2 * (ratedCurrentA / 40) ** 2);
    case "SPD":
      return 0.03;
    case "CONTACTOR":
      return round(1.5 + ratedCurrentA * 0.06);
    case "RELAY":
      return 0.5;
    case "PSU":
      return 6;
    case "PLC":
      return 5;
    case "TERMINAL":
      return 0.1;
    default:
      return 0;
  }
}

/** Filtr katalogu (stránka katalogu i Smart Fallback Picker). */
export interface CatalogFilter {
  q?: string;
  category?: ComponentCategory;
  manufacturer?: string;
  poles?: string;
  current?: number;
  curve?: string;
}

/** Čtení filtru z URL (?q=&category=&manufacturer=&poles=&current=&curve=). */
export function parseCatalogFilter(params: Record<string, string | string[] | undefined>): CatalogFilter {
  const get = (key: string) => (typeof params[key] === "string" && params[key] ? (params[key] as string) : undefined);
  const category = get("category");
  const current = Number(get("current"));
  const poles = get("poles");
  const curve = get("curve");
  return {
    q: get("q")?.slice(0, 80),
    category: category && (COMPONENT_CATEGORIES as readonly string[]).includes(category) ? (category as ComponentCategory) : undefined,
    manufacturer: get("manufacturer")?.slice(0, 40),
    poles: poles && isPoles(poles) ? poles : undefined,
    current: Number.isFinite(current) && current > 0 ? current : undefined,
    curve: curve && (CURVES as readonly string[]).includes(curve) ? curve : undefined,
  };
}

/** Lokální filtr nad načtenými prvky (Picker) – stejná pravidla jako dotaz do databáze. */
export function matchesFilter(component: CatalogFields & { searchText: string }, filter: CatalogFilter): boolean {
  if (filter.category && component.category !== filter.category) return false;
  if (filter.manufacturer && component.manufacturer !== filter.manufacturer) return false;
  if (filter.poles && component.poles !== filter.poles) return false;
  if (filter.current && component.ratedCurrentA !== filter.current) return false;
  if (filter.curve && component.trippingCurve !== filter.curve) return false;
  if (filter.q) {
    const terms = normalizeSearch(filter.q).split(" ").filter(Boolean);
    if (!terms.every((term) => component.searchText.includes(term))) return false;
  }
  return true;
}

export const formatWatts = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} W`;
