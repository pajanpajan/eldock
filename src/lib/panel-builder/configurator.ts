// Živý konfigurátor prvku rozváděče: parametry podle kategorie (dlaždice), výchozí hodnoty,
// výběr nejbližšího přesného kusu z katalogu a syntéza odhadu IEC, když katalog kus nemá.
// Čisté funkce – sdílí klient (dlaždice) i služba (uložení a přiřazení).

import type { ComponentCategory } from "@/generated/prisma/enums";

import { estimatePowerLoss, iecSymbolFor, normalizeSearch } from "./catalog";
import { sameManufacturer } from "./matching";

export type ConfigCategory = "MCB" | "RCD" | "RCBO" | "MAIN_SWITCH" | "SPD" | "CONTACTOR" | "RELAY" | "OTHER";

export interface ItemConfig {
  category: ConfigCategory;
  manufacturer: string | null;
  poles: string;
  modules: number;
  ratedCurrentA: number | null;
  curve?: string | null;
  breakingCapacityKa?: number | null;
  rcdType?: string | null;
  rcdSensitivityMa?: number | null;
  spdType?: string | null;
  surgeCurrentKa?: number | null;
  contactConfig?: string | null;
  coilVoltage?: string | null;
  relaySubtype?: string | null;
  moduleSubtype?: string | null;
  /** Výkon zdroje („15W/24V“) – jen zdroj / měření / jiné. */
  power?: string | null;
}

export interface ConfigOption {
  value: string;
  label: string;
  patch: Partial<ItemConfig>;
}

export interface ConfigField {
  key: string;
  label: string;
  options: ConfigOption[];
}

export const CONFIG_CATEGORIES: { value: ConfigCategory; label: string }[] = [
  { value: "MCB", label: "Jistič" },
  { value: "RCD", label: "Chránič" },
  { value: "RCBO", label: "Jističochránič" },
  { value: "MAIN_SWITCH", label: "Odpínač / Vypínač" },
  { value: "SPD", label: "SPD (Přepěťovka)" },
  { value: "CONTACTOR", label: "Stykač" },
  { value: "RELAY", label: "Relé" },
  { value: "OTHER", label: "Zdroj / Měření / Jiné" },
];

export const RELAY_SUBTYPES = {
  IMPULSE: "Impulzní (bistabilní)",
  TIMER: "Časové relé",
  AUXILIARY: "Pomocné / Instalační",
  LEVEL: "Hladinové relé",
  MONITORING: "Hlídací (napětí/fáze)",
  STAIRCASE: "Schodišťový automat",
  THERMOSTAT: "Termostat / Soumrakové",
} as const;

export const MODULE_SUBTYPES = {
  PSU_DC: "Napájecí zdroj DC",
  BELL_TRANSFORMER: "Zvonkové trafo",
  METER: "Elektroměr",
  PLC: "PLC / Smart modul",
  MAIN_TERMINAL: "Hlavní svorkovnice (HLAK)",
  FUSE_DISCONNECTOR: "Pojistkový odpínač",
} as const;

const RCD_TYPES: Record<string, string> = { AC: "AC (střídavý)", A: "A (pulzní DC)", B: "B (hladký DC)", F: "F (frekvenční)", G: "G (krátkodobě zpožděný)", S: "S (selektivní)" };

const poleWidth = (poles: string, modules: number): ConfigOption => ({ value: `${poles}|${modules}`, label: `${poles} (${modules}M)`, patch: { poles, modules } });
const opts = <K extends keyof ItemConfig>(key: K, values: readonly ItemConfig[K][], label: (value: ItemConfig[K]) => string): ConfigOption[] =>
  values.map((value) => ({ value: String(value), label: label(value), patch: { [key]: value } as Partial<ItemConfig> }));
const amps = (values: number[]) => opts("ratedCurrentA", values, (value) => `${value}A`);
const ma = (values: number[]) => opts("rcdSensitivityMa", values, (value) => `${value} mA`);
const modulesOnly = (values: number[]) => values.map((modules) => ({ value: String(modules), label: `${modules}M`, patch: { modules } }));

/** Řádky dlaždic podle kategorie (zadání fáze 33). */
export const CONFIG_FIELDS: Record<ConfigCategory, ConfigField[]> = {
  MCB: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("1P", 1), poleWidth("1P+N", 2), poleWidth("2P", 2), poleWidth("3P", 3), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "curve", label: "Vypínací charakteristika", options: opts("curve", ["B", "C", "D", "K", "Z"], (value) => String(value)) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63]) },
    { key: "breakingCapacityKa", label: "Zkratová odolnost", options: opts("breakingCapacityKa", [6, 10], (value) => `${value} kA`) },
  ],
  RCD: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("2P", 2), poleWidth("4P", 4)] },
    { key: "rcdType", label: "Typ chrániče", options: opts("rcdType", ["AC", "A", "B", "F", "G", "S"], (value) => RCD_TYPES[String(value)]) },
    { key: "rcdSensitivityMa", label: "Citlivost (IΔn)", options: ma([10, 30, 100, 300, 500]) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([16, 25, 40, 63, 80, 100]) },
  ],
  RCBO: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("1P+N", 1), poleWidth("1P+N", 2), poleWidth("2P", 2), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "curve", label: "Charakteristika", options: opts("curve", ["B", "C"], (value) => String(value)) },
    { key: "rcdType", label: "Typ chrániče", options: opts("rcdType", ["A", "AC"], (value) => String(value)) },
    { key: "rcdSensitivityMa", label: "Citlivost (IΔn)", options: ma([10, 30, 100, 300]) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([6, 10, 13, 16, 20, 25, 32, 40]) },
  ],
  MAIN_SWITCH: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("1P", 1), poleWidth("2P", 2), poleWidth("3P", 3), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([16, 25, 32, 40, 63, 80, 100, 125]) },
  ],
  SPD: [
    { key: "spdType", label: "Typ svodiče", options: opts("spdType", ["T1", "T1+T2", "T2", "T2+T3", "T3"], (value) => String(value)) },
    { key: "poles", label: "Konfigurace / póly", options: [poleWidth("1P+N", 2), poleWidth("3P", 3), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "surgeCurrentKa", label: "Svodičový proud", options: opts("surgeCurrentKa", [12.5, 15, 20, 25, 40], (value) => `${String(value).replace(".", ",")} kA`) },
  ],
  CONTACTOR: [
    {
      key: "contacts",
      label: "Kontakty & šířka",
      options: [
        ["2P", "2NO", 1],
        ["2P", "2NO", 2],
        ["3P", "3NO", 2],
        ["3P", "3NO", 3],
        ["4P", "4NO", 2],
        ["4P", "4NO", 3],
        ["2P", "2NO+2NC", 2],
      ].map(([poles, contactConfig, modules]) => ({
        value: `${contactConfig}|${modules}`,
        label: contactConfig === "2NO+2NC" ? `2NO+2NC (${modules}M)` : `${poles} / ${contactConfig} (${modules}M)`,
        patch: { poles: poles as string, contactConfig: contactConfig as string, modules: modules as number },
      })),
    },
    { key: "ratedCurrentA", label: "Jmenovitý proud", options: amps([16, 20, 25, 40, 63]) },
    { key: "coilVoltage", label: "Ovládací napětí cívky", options: opts("coilVoltage", ["230V AC", "24V AC/DC", "12V DC"], (value) => String(value)) },
  ],
  RELAY: [
    { key: "relaySubtype", label: "Podtyp relé", options: Object.entries(RELAY_SUBTYPES).map(([value, label]) => ({ value, label, patch: { relaySubtype: value } })) },
    { key: "modules", label: "Šířka v modulech", options: modulesOnly([1, 2, 3]) },
    { key: "ratedCurrentA", label: "Jmenovitý proud kontaktů", options: amps([8, 10, 16, 20]) },
  ],
  OTHER: [
    { key: "moduleSubtype", label: "Podtyp modulu", options: Object.entries(MODULE_SUBTYPES).map(([value, label]) => ({ value, label, patch: { moduleSubtype: value } })) },
    { key: "modules", label: "Šířka v modulech", options: modulesOnly([1, 2, 3, 4, 6]) },
    {
      key: "rating",
      label: "Výkon / proud",
      options: [
        ...["15W/24V", "30W/24V", "60W/24V"].map((power) => ({ value: power, label: power.replace("/", " / "), patch: { power, ratedCurrentA: null } })),
        ...[40, 63, 80].map((current) => ({ value: `${current}A`, label: `${current}A`, patch: { ratedCurrentA: current, power: null } })),
      ],
    },
  ],
};

/** Je dlaždice aktivní pro danou konfiguraci? */
export function isOptionActive(config: ItemConfig, option: ConfigOption): boolean {
  return Object.entries(option.patch).every(([key, value]) => (config[key as keyof ItemConfig] ?? null) === (value ?? null));
}

/** Kategorie konfigurátoru → kategorie katalogu. */
export function catalogCategory(config: Pick<ItemConfig, "category" | "moduleSubtype">): ComponentCategory {
  if (config.category !== "OTHER") return config.category;
  switch (config.moduleSubtype) {
    case "PSU_DC":
    case "BELL_TRANSFORMER":
      return "PSU";
    case "PLC":
      return "PLC";
    case "MAIN_TERMINAL":
      return "TERMINAL";
    default:
      return "OTHER";
  }
}

export const toConfigCategory = (category: ComponentCategory | null | undefined): ConfigCategory | null =>
  !category ? null : (["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY"] as const).find((value) => value === category) ?? (category === "ENCLOSURE" ? null : "OTHER");

/** Póly podle šířky (jistič 3M → 3P, chránič 4M → 4P …) – pro sloučení modulů. */
export function polesForWidth(category: ConfigCategory, modules: number): string {
  if (category === "RCD") return modules >= 4 ? "4P" : "2P";
  if (category === "SPD") return modules >= 4 ? "3P+N" : modules === 3 ? "3P" : "1P+N";
  if (category === "RCBO") return modules >= 4 ? "4P" : modules === 2 ? "2P" : "1P+N";
  return modules >= 4 ? "4P" : modules === 3 ? "3P" : modules === 2 ? "2P" : "1P";
}

/** Výchozí (úplná) konfigurace kategorie – každý klik tak vede k přiřaditelnému kusu. */
export function defaultConfig(category: ConfigCategory, base: { manufacturer: string | null; modules: number; ratedCurrentA?: number | null; curve?: string | null }): ItemConfig {
  const m = Math.max(1, base.modules);
  const common = { category, manufacturer: base.manufacturer };
  switch (category) {
    case "MCB":
      return { ...common, poles: polesForWidth("MCB", m), modules: m >= 4 ? 4 : m, curve: base.curve ?? "B", ratedCurrentA: base.ratedCurrentA ?? 16, breakingCapacityKa: 6 };
    case "RCD":
      return { ...common, poles: m >= 4 ? "4P" : "2P", modules: m >= 4 ? 4 : 2, rcdType: "A", rcdSensitivityMa: 30, ratedCurrentA: base.ratedCurrentA && base.ratedCurrentA >= 16 ? base.ratedCurrentA : 40 };
    case "RCBO":
      return { ...common, poles: m >= 4 ? "4P" : m === 2 ? "1P+N" : "1P+N", modules: m >= 4 ? 4 : m === 2 ? 2 : 1, curve: base.curve === "C" ? "C" : "B", rcdType: "A", rcdSensitivityMa: 30, ratedCurrentA: base.ratedCurrentA ?? 16 };
    case "MAIN_SWITCH":
      return { ...common, poles: polesForWidth("MAIN_SWITCH", m === 1 ? 3 : m), modules: m === 1 ? 3 : Math.min(m, 4), ratedCurrentA: base.ratedCurrentA ?? 40 };
    case "SPD":
      return { ...common, spdType: "T2", poles: m >= 4 ? "3P+N" : m === 3 ? "3P" : m === 2 ? "1P+N" : "3P+N", modules: m >= 2 ? Math.min(m, 4) : 4, surgeCurrentKa: 20, ratedCurrentA: null };
    case "CONTACTOR":
      return { ...common, poles: "2P", contactConfig: "2NO", modules: m >= 2 ? 2 : 1, ratedCurrentA: 25, coilVoltage: "230V AC" };
    case "RELAY":
      return { ...common, poles: "1P", relaySubtype: "IMPULSE", modules: Math.min(m, 3), ratedCurrentA: 16 };
    case "OTHER":
      return { ...common, poles: "1P", moduleSubtype: "PSU_DC", modules: Math.min(m, 6), power: "15W/24V", ratedCurrentA: null };
  }
}

/** Konfigurace z přiřazeného katalogového kusu (prvek bez uložené konfigurace). */
export function configFromComponent(component: CatalogLike, manufacturerFallback: string | null = null): ItemConfig | null {
  const category = toConfigCategory(component.category);
  if (!category) return null;
  return {
    category,
    manufacturer: component.manufacturer || manufacturerFallback,
    poles: component.poles,
    modules: component.modulesCount || 1,
    ratedCurrentA: component.ratedCurrentA || null,
    curve: component.trippingCurve,
    breakingCapacityKa: component.breakingCapacityKa,
    rcdType: component.rcdType,
    rcdSensitivityMa: component.rcdSensitivityMa,
    spdType: component.spdType,
    surgeCurrentKa: component.surgeCurrentKa,
    contactConfig: component.contactConfig,
    coilVoltage: component.coilVoltage,
    relaySubtype: component.relaySubtype,
    moduleSubtype: component.moduleSubtype,
  };
}

export function parseConfig(json: string | null | undefined): ItemConfig | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as ItemConfig;
    return value && typeof value === "object" && typeof value.category === "string" ? value : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
//  Nejbližší přesný kus z katalogu / syntéza odhadu
// ---------------------------------------------------------------------------

export interface CatalogLike {
  id: string;
  manufacturer: string;
  typeCode: string;
  articleNumber: string;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve: string | null;
  breakingCapacityKa: number | null;
  rcdType: string | null;
  rcdSensitivityMa: number | null;
  spdType: string | null;
  surgeCurrentKa: number | null;
  contactConfig: string | null;
  coilVoltage: string | null;
  relaySubtype: string | null;
  moduleSubtype: string | null;
  modulesCount: number;
}

/**
 * Přesný kus pro konfiguraci: musí sedět výrobce (je-li zvolen), kategorie, póly a určující parametry
 * (In, charakteristika, typ a citlivost chrániče, typ SPD, kontakty, podtyp); šířka a Icn jen řadí.
 */
export function matchConfig<T extends CatalogLike>(catalog: readonly T[], config: ItemConfig): T | null {
  const category = catalogCategory(config);
  const eq = <V>(want: V | null | undefined, have: V | null | undefined) => want === null || want === undefined || want === have;
  const candidates = catalog.filter((component) => {
    if (component.category !== category) return false;
    if (config.manufacturer && !sameManufacturer(component.manufacturer, config.manufacturer)) return false;
    switch (config.category) {
      case "MCB":
        return component.poles === config.poles && eq(config.ratedCurrentA, component.ratedCurrentA) && eq(config.curve, component.trippingCurve);
      case "RCD":
        return component.poles === config.poles && eq(config.ratedCurrentA, component.ratedCurrentA) && eq(config.rcdType, component.rcdType) && eq(config.rcdSensitivityMa, component.rcdSensitivityMa);
      case "RCBO":
        return (
          component.poles === config.poles &&
          eq(config.ratedCurrentA, component.ratedCurrentA) &&
          eq(config.curve, component.trippingCurve) &&
          eq(config.rcdType, component.rcdType) &&
          eq(config.rcdSensitivityMa, component.rcdSensitivityMa)
        );
      case "MAIN_SWITCH":
        return component.poles === config.poles && eq(config.ratedCurrentA, component.ratedCurrentA);
      case "SPD":
        return component.poles === config.poles && eq(config.spdType, component.spdType);
      case "CONTACTOR":
        return eq(config.contactConfig, component.contactConfig) && eq(config.ratedCurrentA, component.ratedCurrentA);
      case "RELAY":
        return eq(config.relaySubtype, component.relaySubtype);
      case "OTHER":
        return eq(config.moduleSubtype, component.moduleSubtype);
    }
  });
  const score = (component: T) =>
    Number(component.modulesCount === config.modules) * 8 +
    Number((config.breakingCapacityKa ?? null) === component.breakingCapacityKa) * 2 +
    Number((config.surgeCurrentKa ?? null) === component.surgeCurrentKa) * 2 +
    Number((config.coilVoltage ?? null) === component.coilVoltage) * 2 +
    Number(config.ratedCurrentA === null || config.ratedCurrentA === component.ratedCurrentA);
  return [...candidates].sort((a, b) => score(b) - score(a) || a.typeCode.localeCompare(b.typeCode))[0] ?? null;
}

const CATEGORY_NOUN: Record<ConfigCategory, string> = {
  MCB: "Jistič",
  RCD: "Chránič",
  RCBO: "Jističochránič",
  MAIN_SWITCH: "Vypínač",
  SPD: "Svodič přepětí",
  CONTACTOR: "Stykač",
  RELAY: "Relé",
  OTHER: "Modul",
};

/** Čitelný popis konfigurace („Jistič 1P B16 6 kA“). */
export function describeConfig(config: ItemConfig): string {
  const n = (value: number) => String(value).replace(".", ",");
  switch (config.category) {
    case "MCB":
      return `Jistič ${config.poles} ${config.curve ?? ""}${config.ratedCurrentA ?? ""}${config.breakingCapacityKa ? ` ${n(config.breakingCapacityKa)} kA` : ""}`.replace(/\s+/g, " ").trim();
    case "RCD":
      return `Chránič ${config.poles} ${config.ratedCurrentA ?? ""} A / ${config.rcdSensitivityMa ?? 30} mA typ ${config.rcdType ?? "A"}`;
    case "RCBO":
      return `Jističochránič ${config.poles} ${config.curve ?? "B"}${config.ratedCurrentA ?? ""} / ${config.rcdSensitivityMa ?? 30} mA typ ${config.rcdType ?? "A"}`;
    case "MAIN_SWITCH":
      return `Vypínač ${config.poles} ${config.ratedCurrentA ?? ""} A`;
    case "SPD":
      return `Svodič přepětí ${config.spdType ?? "T2"} ${config.poles}${config.surgeCurrentKa ? ` ${n(config.surgeCurrentKa)} kA` : ""}`;
    case "CONTACTOR":
      return `Stykač ${config.ratedCurrentA ?? ""} A ${config.contactConfig ?? ""}${config.coilVoltage ? `, cívka ${config.coilVoltage}` : ""}`;
    case "RELAY":
      return `${RELAY_SUBTYPES[(config.relaySubtype ?? "AUXILIARY") as keyof typeof RELAY_SUBTYPES]}${config.ratedCurrentA ? ` ${config.ratedCurrentA} A` : ""}`;
    case "OTHER":
      return `${MODULE_SUBTYPES[(config.moduleSubtype ?? "PSU_DC") as keyof typeof MODULE_SUBTYPES]}${config.power ? ` ${config.power}` : config.ratedCurrentA ? ` ${config.ratedCurrentA} A` : ""}`;
  }
  return CATEGORY_NOUN[config.category];
}

/** Katalogový kus odhadnutý podle konfigurace (výrobce bez přesného kusu v katalogu). */
export function synthesizeComponent(config: ItemConfig) {
  const category = catalogCategory(config);
  const manufacturer = config.manufacturer ?? "Neurčený výrobce";
  const typeCode = describeConfig(config);
  const slug = (text: string) => normalizeSearch(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  const current = config.ratedCurrentA ?? 0;
  const powerFromSupply = config.power ? Number(/^(\d+)W/.exec(config.power)?.[1] ?? 0) * 0.12 : null;
  return {
    manufacturer,
    series: `${CATEGORY_NOUN[config.category]} (konfigurace)`,
    typeCode,
    articleNumber: `CFG-${slug(manufacturer)}-${slug(typeCode)}`.slice(0, 120),
    category,
    poles: config.poles,
    ratedCurrentA: current,
    trippingCurve: config.curve ?? null,
    breakingCapacityKa: config.breakingCapacityKa ?? null,
    rcdType: config.rcdType ?? null,
    rcdSensitivityMa: config.rcdSensitivityMa ?? null,
    spdType: config.spdType ?? null,
    surgeCurrentKa: config.surgeCurrentKa ?? null,
    contactConfig: config.contactConfig ?? null,
    coilVoltage: config.coilVoltage ?? null,
    relaySubtype: config.relaySubtype ?? null,
    moduleSubtype: config.moduleSubtype ?? null,
    modulesCount: config.modules,
    widthMm: config.modules * 17.5,
    powerLossWatts: powerFromSupply ?? estimatePowerLoss(category, config.poles, current),
    iecSymbol: iecSymbolFor(category, config.poles),
    description: `${typeCode} – parametry z konfigurátoru, ztrátový výkon odhadnut dle IEC`,
  };
}
