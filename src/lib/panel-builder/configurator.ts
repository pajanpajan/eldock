// Živý konfigurátor prvku rozváděče: parametry podle kategorie (dlaždice), výchozí hodnoty,
// výběr nejbližšího přesného kusu z katalogu a syntéza odhadu IEC, když katalog kus nemá.
// Čisté funkce – sdílí klient (dlaždice) i služba (uložení a přiřazení).
// Fáze 81: kategorie 🏠 Chytrá domácnost / PLC / Aktory – systém (u ABB filtr free@home / KNX), funkce aktoru a počet
// kanálů; přesný kus podle profilu kusu katalogu (`smartDinProfile`), šířka podle kusu.

import type { ComponentCategory } from "@/generated/prisma/enums";

import { estimatePowerLoss, iecSymbolFor, normalizeSearch } from "./catalog";
import { ACCESSORY_DEFAULT_MODULES, isAccessoryKind } from "./accessory-symbols";
import { sameManufacturer } from "./matching";
import { SMART_SYSTEM_FILTER_LABEL, smartDinProfile, smartRank, smartSystemsOf } from "./smart-din-catalog";
import { SMART_SYSTEMS } from "./smart-home";

export type ConfigCategory = "MCB" | "RCD" | "RCBO" | "MAIN_SWITCH" | "SPD" | "CONTACTOR" | "RELAY" | "SMART_HOME" | "OTHER" | "ACCESSORY";

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
  /** Fáze 81: chytrá domácnost – systém (null = všechny systémy výrobce), funkce aktoru a počet kanálů (null = libovolný). */
  smartSystem?: string | null;
  smartRole?: string | null;
  channels?: number | null;
  /** Fáze 112: stykač HDO – značení ovládacího jističe cívky (L přes kontakt přijímače HDO na A1). */
  hdoControl?: string | null;
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
  { value: "SMART_HOME", label: "🏠 Chytrá domácnost / PLC / Aktory" },
  { value: "OTHER", label: "Zdroj / Měření / Jiné" },
  { value: "ACCESSORY", label: "Svorky / Hřebeny / Příslušenství" },
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

/** Fáze 81: funkce kusu chytré domácnosti na DIN lištu (role modulu výpočtu `smart-home.ts`). */
export const SMART_ROLES = {
  switch: "Spínací aktor",
  blind: "Žaluziový aktor",
  dim: "Stmívací aktor",
  heating: "Topení / ventily",
  dali: "DALI brána / rozhraní",
  input: "Binární vstupy",
  pwm: "LED 24 V PWM",
  psu: "Zdroj sběrnice / 24 V",
  interface: "Rozhraní / rozšíření",
  system: "Systémový modul / Miniserver",
} as const;

/** Svorky, hřebenové lišty a příslušenství přístrojů (fáze 43, externí databáze prvků). */
export const ACCESSORY_SUBTYPES = {
  TERMINAL_BLOCK: "Svorka / svorkovnice",
  BUSBAR: "Hřebenová propojovací lišta",
  BUSBAR_END_CAP: "Koncovka hřebenu",
  AUX_CONTACT: "Pomocný kontakt",
  SHUNT_TRIP: "Vypínací spoušť",
  UNDERVOLTAGE_TRIP: "Podpěťová spoušť",
  FUSE_LINK: "Pojistková vložka",
  DIN_SOCKET: "Zásuvka na DIN",
  INDICATOR: "Signálka / kontrolka",
  BLANK_COVER: "Záslepka",
} as const;

export const isAccessorySubtype = (value: string | null | undefined): value is keyof typeof ACCESSORY_SUBTYPES => !!value && value in ACCESSORY_SUBTYPES;

/**
 * Fáze 115: propojovací hřeben a jeho koncovka nikdy nesedí na DIN liště jako modul vedle jističů – zasouvají se do
 * svorek přístrojů. V kaskádě vkládání nejsou; volí se v záhlaví lišty („Hřeben: …“) a počítají se do kusovníku.
 */
export const COMB_ACCESSORY_SUBTYPES: ReadonlySet<string> = new Set(["BUSBAR", "BUSBAR_END_CAP"]);
export const isCombAccessory = (config: Pick<ItemConfig, "category" | "moduleSubtype">) => config.category === "ACCESSORY" && COMB_ACCESSORY_SUBTYPES.has(config.moduleSubtype ?? "");

const RCD_TYPES: Record<string, string> = { AC: "AC (střídavý)", A: "A (pulzní DC)", B: "B (hladký DC)", F: "F (frekvenční)", G: "G (krátkodobě zpožděný)", S: "S (selektivní)" };

const poleWidth = (poles: string, modules: number): ConfigOption => ({ value: `${poles}|${modules}`, label: `${poles} (${modules}M)`, patch: { poles, modules } });
const opts = <K extends keyof ItemConfig>(key: K, values: readonly ItemConfig[K][], label: (value: ItemConfig[K]) => string): ConfigOption[] =>
  values.map((value) => ({ value: String(value), label: label(value), patch: { [key]: value } as Partial<ItemConfig> }));
const amps = (values: number[]) => opts("ratedCurrentA", values, (value) => `${value}A`);
const ma = (values: number[]) => opts("rcdSensitivityMa", values, (value) => `${value} mA`);
const modulesOnly = (values: number[]) => values.map((modules) => ({ value: String(modules), label: `${String(modules).replace(".", ",")}M`, patch: { modules } }));
/** Kompaktní přístroje: póly ≠ šířka na liště. */
const compact = (poles: string, modules: number, label: string): ConfigOption => ({ value: `${poles}|${modules}|compact`, label, patch: { poles, modules } });
/** Ruční šířka v modulech nezávisle na pólech (0,5M … 6M). */
const widthField: ConfigField = { key: "width", label: "Šířka v modulech (ručně)", options: modulesOnly([0.5, 1, 1.5, 2, 3, 4, 6]) };

/** Řádky dlaždic podle kategorie (zadání fáze 33). */
export const CONFIG_FIELDS: Record<ConfigCategory, ConfigField[]> = {
  MCB: [
    {
      key: "poles",
      label: "Póly & šířka",
      options: [
        poleWidth("1P", 1),
        poleWidth("1P+N", 2),
        poleWidth("2P", 2),
        poleWidth("3P", 3),
        poleWidth("3P+N", 4),
        poleWidth("4P", 4),
        compact("2x1P", 1, "⚡ 2×1P Duální (1M)"),
        compact("1P+N", 1, "⚡ 1P+N Kompakt (1M)"),
        compact("3P", 2, "⚡ 3P Kompakt (2M)"),
      ],
    },
    { key: "curve", label: "Vypínací charakteristika", options: opts("curve", ["B", "C", "D", "K", "Z"], (value) => String(value)) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63]) },
    { key: "breakingCapacityKa", label: "Zkratová odolnost", options: opts("breakingCapacityKa", [6, 10], (value) => `${value} kA`) },
    widthField,
  ],
  RCD: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("2P", 2), poleWidth("4P", 4)] },
    { key: "rcdType", label: "Typ chrániče", options: opts("rcdType", ["AC", "A", "B", "F", "G", "S"], (value) => RCD_TYPES[String(value)]) },
    { key: "rcdSensitivityMa", label: "Citlivost (IΔn)", options: ma([10, 30, 100, 300, 500]) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([16, 25, 40, 63, 80, 100]) },
    widthField,
  ],
  RCBO: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("1P+N", 1), poleWidth("1P+N", 2), poleWidth("2P", 2), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "curve", label: "Charakteristika", options: opts("curve", ["B", "C"], (value) => String(value)) },
    { key: "rcdType", label: "Typ chrániče", options: opts("rcdType", ["A", "AC"], (value) => String(value)) },
    { key: "rcdSensitivityMa", label: "Citlivost (IΔn)", options: ma([10, 30, 100, 300]) },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([6, 10, 13, 16, 20, 25, 32, 40]) },
    widthField,
  ],
  MAIN_SWITCH: [
    { key: "poles", label: "Póly & šířka", options: [poleWidth("1P", 1), poleWidth("2P", 2), poleWidth("3P", 3), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "ratedCurrentA", label: "Jmenovitý proud In", options: amps([16, 25, 32, 40, 63, 80, 100, 125]) },
    widthField,
  ],
  SPD: [
    { key: "spdType", label: "Typ svodiče", options: opts("spdType", ["T1", "T1+T2", "T2", "T2+T3", "T3"], (value) => String(value)) },
    { key: "poles", label: "Konfigurace / póly", options: [poleWidth("1P+N", 2), poleWidth("3P", 3), poleWidth("3P+N", 4), poleWidth("4P", 4)] },
    { key: "surgeCurrentKa", label: "Svodičový proud", options: opts("surgeCurrentKa", [12.5, 15, 20, 25, 40], (value) => `${String(value).replace(".", ",")} kA`) },
    widthField,
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
    widthField,
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
  // Fáze 81: řada / systém se doplní podle výrobce (`configFields`), šířka se bere z přiřazeného kusu
  SMART_HOME: [
    { key: "smartRole", label: "Funkce", options: Object.entries(SMART_ROLES).map(([value, label]) => ({ value, label, patch: { smartRole: value, channels: null } })) },
    { key: "channels", label: "Počet kanálů / šířka", options: [{ value: "all", label: "Libovolný", patch: { channels: null } }, ...[2, 4, 6, 8, 12, 14, 16, 20].map((count) => ({ value: String(count), label: `${count}×`, patch: { channels: count } }))] },
  ],
  ACCESSORY: [
    // Fáze 115: bez hřebenu a koncovky hřebenu (volba v záhlaví lišty)
    { key: "moduleSubtype", label: "Druh příslušenství", options: Object.entries(ACCESSORY_SUBTYPES).filter(([value]) => !COMB_ACCESSORY_SUBTYPES.has(value)).map(([value, label]) => ({ value, label, patch: { moduleSubtype: value } })) },
    { key: "poles", label: "Póly", options: ["1P", "2P", "3P", "4P"].map((poles) => ({ value: poles, label: poles, patch: { poles } })) },
    { key: "modules", label: "Šířka v modulech", options: modulesOnly([0.5, 1, 2, 3, 4]) },
  ],
};

/**
 * Řádky dlaždic konfigurace: u chytré domácnosti navíc filtr řady / systému výrobce, který má víc systémů (ABB:
 * ABB-free@home® · ABB i-bus® KNX); Loxone a TapHome nabízí všechny své moduly.
 */
export function configFields(config: Pick<ItemConfig, "category" | "manufacturer"> & Partial<Pick<ItemConfig, "smartRole" | "smartSystem">> | null): ConfigField[] {
  if (!config) return [];
  const base = CONFIG_FIELDS[config.category];
  if (config.category !== "SMART_HOME") return base;
  // Fáze 114 / 115: C3 – jen skutečné kusy systému se šířkou na DIN liště (spínací 4× (4M) / 8× (8M) / 12× (12M), stmívací
  // 4× (6M) / 6× (8M), žaluzie 4× (4M) / 8× (8M), topení 6× (4M) / 12× (8M), binární vstupy 4× (2M) / 10× (4M))
  const fields = base.map((field) => (field.key === "channels" ? smartChannelField(config, field) : field));
  const systems = smartSystemsOf(config.manufacturer);
  if (systems.length < 2) return fields;
  const series: ConfigField = {
    key: "smartSystem",
    label: "Řada / systém",
    options: [{ value: "all", label: "Vše", patch: { smartSystem: null } }, ...systems.map((system) => ({ value: system.id, label: SMART_SYSTEM_FILTER_LABEL[system.id], patch: { smartSystem: system.id } }))],
  };
  return [series, ...fields];
}

/** Fáze 115: funkce s volbou počtu kanálů ze skutečných kusů systému (ostatní – DALI, PWM, zdroje – obecně). */
const CHANNEL_PICK_ROLES = new Set<string>(["switch", "dim", "blind", "heating", "input"]);

/**
 * Fáze 114 / 115: „C3. Počet kanálů / šířka“ – kusy zvoleného systému (bez systému všech systémů výrobce) s počtem kanálů
 * a skutečnou šířkou na DIN liště, jen výchozí typy výpočtu (alternativy pro ruční volbu mají stejné kanály / šířku jako
 * některý z nich nebo se vyberou v panelu chytré domácnosti). Funkce bez kusů systému nabídne jen „Libovolný“.
 */
function smartChannelField(config: Pick<ItemConfig, "manufacturer"> & Partial<Pick<ItemConfig, "smartRole" | "smartSystem">>, field: ConfigField): ConfigField {
  const role = config.smartRole;
  if (!role || !CHANNEL_PICK_ROLES.has(role)) return field;
  const system = config.smartSystem ? smartSystemFor({ manufacturer: config.manufacturer ?? null, smartSystem: config.smartSystem }) : null;
  const scope = system ? SMART_SYSTEMS.filter((candidate) => candidate.id === system) : smartSystemsOf(config.manufacturer);
  const seen = new Set<string>();
  const units = scope
    .flatMap((candidate) => candidate.modules.filter((unit) => unit.role === role && !unit.manualOnly && unit.modules > 0 && unit.channels > 0 && !unit.source.startsWith("obecný modul")))
    .filter((unit) => {
      const key = `${unit.channels}|${unit.modules}`;
      return !seen.has(key) && Boolean(seen.add(key));
    })
    .sort((a, b) => a.channels - b.channels || a.modules - b.modules);
  const width = (modules: number) => String(modules).replace(".", ",");
  return {
    ...field,
    options: [field.options[0], ...units.map((unit) => ({ value: `${unit.channels}|${unit.modules}`, label: `${unit.channels}× (${width(unit.modules)}M)`, patch: { channels: unit.channels, modules: unit.modules } }))],
  };
}

/** Fáze 81: systém chytré domácnosti platí jen u výrobce, který ho nabízí (po změně výrobce se zahodí). */
export const smartSystemFor = (config: Pick<ItemConfig, "manufacturer" | "smartSystem">): string | null =>
  config.smartSystem && smartSystemsOf(config.manufacturer).some((system) => system.id === config.smartSystem) ? config.smartSystem : null;

/** Konfigurace s jiným výrobcem (systém chytré domácnosti jiného výrobce se zahodí). */
export function withManufacturer<T extends ItemConfig>(config: T, manufacturer: string | null): T {
  const next = { ...config, manufacturer };
  return config.smartSystem ? { ...next, smartSystem: smartSystemFor(next) } : next;
}

/**
 * Fáze 114: klik na dlaždici kaskády – u příslušenství přinese nový podtyp typickou šířku (svorkovnice HLAK 4M, pomocný
 * kontakt 0,5M, zásuvka na DIN 3M …); ručně zvolená šířka v témže kliknutí má přednost.
 */
export function withOption<T extends ItemConfig>(config: T, patch: Partial<ItemConfig>): T {
  const next = { ...config, ...patch } as T;
  const subtype = patch.moduleSubtype;
  if (config.category === "ACCESSORY" && subtype && subtype !== config.moduleSubtype && patch.modules === undefined && isAccessoryKind(subtype)) return { ...next, modules: ACCESSORY_DEFAULT_MODULES[subtype] };
  return next;
}

/** Je dlaždice aktivní pro danou konfiguraci? */
export function isOptionActive(config: ItemConfig, option: ConfigOption): boolean {
  return Object.entries(option.patch).every(([key, value]) => (config[key as keyof ItemConfig] ?? null) === (value ?? null));
}

/** Kategorie konfigurátoru → kategorie katalogu. */
export function catalogCategory(config: Pick<ItemConfig, "category" | "moduleSubtype" | "smartRole">): ComponentCategory {
  if (config.category === "ACCESSORY") return config.moduleSubtype === "TERMINAL_BLOCK" ? "TERMINAL" : "OTHER";
  // Fáze 81: chytrá domácnost – zdroj sběrnice / 24 V v katalogu jako zdroj, ostatní kusy jako PLC
  if (config.category === "SMART_HOME") return config.smartRole === "psu" ? "PSU" : "PLC";
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

export const toConfigCategory = (category: ComponentCategory | null | undefined, moduleSubtype?: string | null): ConfigCategory | null =>
  !category
    ? null
    : ((["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY"] as const).find((value) => value === category) ??
      // Fáze 81: PLC / smart moduly = kategorie Chytrá domácnost
      (category === "PLC" ? "SMART_HOME" : category === "ENCLOSURE" ? null : isAccessorySubtype(moduleSubtype) ? "ACCESSORY" : "OTHER"));

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
    case "SMART_HOME":
      return { ...common, poles: "1P", modules: Math.min(Math.max(m, 2), 12), smartRole: "switch", smartSystem: null, channels: null, ratedCurrentA: null };
    case "OTHER":
      return { ...common, poles: "1P", moduleSubtype: "PSU_DC", modules: Math.min(m, 6), power: "15W/24V", ratedCurrentA: null };
    case "ACCESSORY":
      return { ...common, poles: "1P", moduleSubtype: "AUX_CONTACT", modules: base.modules < 1 ? base.modules : 0.5, ratedCurrentA: null };
  }
}

/** Konfigurace z přiřazeného katalogového kusu (prvek bez uložené konfigurace). */
export function configFromComponent(component: CatalogLike, manufacturerFallback: string | null = null): ItemConfig | null {
  // Fáze 81: kus chytré domácnosti (i zdroj sběrnice) → kategorie Chytrá domácnost s funkcí, systémem a kanály
  const smart = component.category === "PLC" || component.category === "PSU" ? smartDinProfile(component) : null;
  if (smart) {
    return { category: "SMART_HOME", manufacturer: component.manufacturer || manufacturerFallback, poles: component.poles, modules: component.modulesCount || 1, ratedCurrentA: null, smartRole: smart.role === "psu_led" ? "psu" : smart.role, smartSystem: smart.system, channels: smart.channels || null };
  }
  const category = toConfigCategory(component.category, component.moduleSubtype);
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
      case "SMART_HOME": {
        // Fáze 81: kus chytré domácnosti podle profilu (funkce, systém, kanály) – obecné PLC jiných výrobců ne
        const profile = smartDinProfile(component);
        const role = profile?.role === "psu_led" ? "psu" : profile?.role;
        return Boolean(profile && eq(config.smartRole, role) && eq(smartSystemFor(config), profile.system) && eq(config.channels, profile.channels));
      }
      case "OTHER":
        return eq(config.moduleSubtype, component.moduleSubtype);
      case "ACCESSORY":
        // Fáze 114: pojistková vložka i pojistkový odpínač (ABB E 91, OEZ OPV), svorkovnice i hlavní svorkovnice HLAK
        return (
          eq(config.moduleSubtype, component.moduleSubtype) ||
          (config.moduleSubtype === "FUSE_LINK" && component.moduleSubtype === "FUSE_DISCONNECTOR") ||
          (config.moduleSubtype === "TERMINAL_BLOCK" && component.moduleSubtype === "MAIN_TERMINAL")
        );
    }
  });
  const score = (component: T) =>
    // Fáze 114: skutečný kus výrobce vždy před syntetickým odhadem z konfigurátoru (`CFG-…` uložený dřívějším vložením)
    Number(!component.articleNumber.startsWith("CFG-")) * 40 +
    Number(component.modulesCount === config.modules) * 8 +
    Number((config.breakingCapacityKa ?? null) === component.breakingCapacityKa) * 2 +
    Number((config.surgeCurrentKa ?? null) === component.surgeCurrentKa) * 2 +
    Number((config.coilVoltage ?? null) === component.coilVoltage) * 2 +
    Number(config.ratedCurrentA === null || config.ratedCurrentA === component.ratedCurrentA) +
    Number(component.poles === config.poles) * 3 +
    // Fáze 81: výchozí typ výpočtu před ruční alternativou (JRA/S 4.230.5.1 před 4.230.2.1) a před řádky importu
    (config.category === "SMART_HOME" ? smartRank(smartDinProfile(component)) : 0);
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
  SMART_HOME: "Chytrá domácnost",
  OTHER: "Modul",
  ACCESSORY: "Příslušenství",
};

/** Čitelný popis konfigurace („Jistič 1P B16 6 kA“). */
export function describeConfig(config: ItemConfig): string {
  const n = (value: number) => String(value).replace(".", ",");
  switch (config.category) {
    case "MCB":
      return `Jistič ${config.poles === "2x1P" ? "2×1P" : config.poles} ${config.curve ?? ""}${config.ratedCurrentA ?? ""}${config.breakingCapacityKa ? ` ${n(config.breakingCapacityKa)} kA` : ""}`.replace(/\s+/g, " ").trim();
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
    case "SMART_HOME": {
      const role = SMART_ROLES[(config.smartRole ?? "switch") as keyof typeof SMART_ROLES] ?? SMART_ROLES.switch;
      const own = smartSystemFor(config);
      const system = own ? ` (${SMART_SYSTEM_FILTER_LABEL[own as keyof typeof SMART_SYSTEM_FILTER_LABEL]?.split(" (")[0] ?? own})` : "";
      return `${role}${config.channels ? ` ${config.channels}×` : ""}${system}`;
    }
    case "OTHER":
      return `${MODULE_SUBTYPES[(config.moduleSubtype ?? "PSU_DC") as keyof typeof MODULE_SUBTYPES]}${config.power ? ` ${config.power}` : config.ratedCurrentA ? ` ${config.ratedCurrentA} A` : ""}`;
    case "ACCESSORY":
      return `${ACCESSORY_SUBTYPES[(isAccessorySubtype(config.moduleSubtype) ? config.moduleSubtype : "AUX_CONTACT")]} ${config.poles}`;
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
    moduleSubtype: config.category === "SMART_HOME" ? (category === "PSU" ? "PSU_DC" : "PLC") : (config.moduleSubtype ?? null),
    modulesCount: config.modules,
    widthMm: config.modules * 17.5,
    powerLossWatts: powerFromSupply ?? estimatePowerLoss(category, config.poles, current),
    iecSymbol: iecSymbolFor(category, config.poles),
    description: `${typeCode} – parametry z konfigurátoru, ztrátový výkon odhadnut dle IEC`,
  };
}
