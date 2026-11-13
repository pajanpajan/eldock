// Fáze 112: řízení nízkého tarifu (HDO) a krycí záslepky volných modulů. Instalační stykač k bojleru, tepelnému čerpadlu,
// akumulačnímu vytápění a wallboxu (spínaný kontaktem přijímače HDO přes ovládací jistič B6), výběr typu podle počtu
// fází a jističe okruhu (AC-1 stykače ≥ In jističe) a počet dělitelných záslepek 12M na volné moduly všech lišt
// rozvodnice. Čisté funkce (generátor rozváděče z půdorysu, dokumentace, testy).

/** Spotřebiče, které se v ČR běžně spínají signálem HDO (sazby D25d, D26d, D45d, D56d, D57d a D61d). */
export const HDO_TAGS = ["boiler", "heat_pump", "storage_heater", "ev_charger"] as const;
export type HdoTag = (typeof HDO_TAGS)[number];

export const isHdoTag = (tag: string | null | undefined): tag is HdoTag => (HDO_TAGS as readonly string[]).includes(tag ?? "");

/** Výchozí řízení HDO: bojler, tepelné čerpadlo a akumulační vytápění ano, wallbox jen na přání (vlastní sazba / DLM). */
export const hdoDefault = (tag: string | null | undefined) => isHdoTag(tag) && tag !== "ev_charger";

/** Řízení HDO prvku půdorysu: ruční volba, jinak výchozí podle druhu spotřebiče. */
export const hdoEnabled = (tag: string | null | undefined, choice: boolean | null | undefined) => isHdoTag(tag) && (choice ?? hdoDefault(tag));

export interface ContactorChoice {
  manufacturer: "ABB";
  series: "ESB";
  typeCode: string;
  /** Objednací číslo z katalogu ABB pro ČR (null = typ z orientačního katalogu – ověřit u výrobce). */
  articleNumber: string | null;
  poles: "2P" | "4P";
  contactConfig: "2NO" | "4NO";
  modules: number;
  /** Jmenovitý proud AC-1 [A]. */
  ratedA: number;
  verified: boolean;
}

/**
 * Instalační stykače ABB ESB s cívkou 230 V AC. Objednací čísla ESB20-20N-06 a ESB25-40N-06 jsou z katalogu ABB pro ČR
 * (nizke-napeti.cz.abb.com, fáze 88); ESB40 / ESB63 jen z orientačního průmyslového katalogu (bez ověřeného čísla).
 */
export const HDO_CONTACTORS: readonly ContactorChoice[] = [
  { manufacturer: "ABB", series: "ESB", typeCode: "ESB20-20N-06", articleNumber: "1SBE121111R0620", poles: "2P", contactConfig: "2NO", modules: 1, ratedA: 20, verified: true },
  { manufacturer: "ABB", series: "ESB", typeCode: "ESB25-40N-06", articleNumber: "1SAE231111R0640", poles: "4P", contactConfig: "4NO", modules: 2, ratedA: 25, verified: true },
  { manufacturer: "ABB", series: "ESB", typeCode: "ESB40-40N-06", articleNumber: null, poles: "4P", contactConfig: "4NO", modules: 3, ratedA: 40, verified: false },
  { manufacturer: "ABB", series: "ESB", typeCode: "ESB63-40N-06", articleNumber: null, poles: "4P", contactConfig: "4NO", modules: 3, ratedA: 63, verified: false },
];

/**
 * Stykač HDO k okruhu: jednofázový okruh dvoupólovým stykačem (L + N), třífázový čtyřpólovým; AC-1 stykače nejméně
 * jmenovitý proud jističe okruhu. Nad 63 A null (stykač navrhne projektant).
 */
export function hdoContactorFor(phases: 1 | 3, breakerA: number): ContactorChoice | null {
  const fits = HDO_CONTACTORS.filter((choice) => choice.ratedA >= breakerA);
  if (phases === 1) return fits.find((choice) => choice.poles === "2P") ?? fits[0] ?? null;
  return fits.find((choice) => choice.poles === "4P") ?? null;
}

/**
 * Odkaz na ovládací jistič cívky z konfigurace stykače (`configJson.hdoControl`): „item:<id>“ v uloženém projektu
 * (stabilní i po přečíslování), značení „-F21“ v návrhu generátoru; jinak null.
 */
export function hdoControlOf(configJson: string | null | undefined): string | null {
  if (!configJson) return null;
  try {
    const value = (JSON.parse(configJson) as { hdoControl?: unknown }).hdoControl;
    return typeof value === "string" && (/^-[A-Z]{1,3}\d{1,3}$/.test(value) || /^item:[\w-]{6,40}$/.test(value)) ? value : null;
  } catch {
    return null;
  }
}

/** Značení ovládacího jističe podle odkazu (id prvku → aktuální značení). */
export function hdoControlDesignation(reference: string | null, items: readonly { id: string; designation: string }[]): string | null {
  if (!reference) return null;
  if (!reference.startsWith("item:")) return reference;
  return items.find((item) => item.id === reference.slice(5))?.designation ?? null;
}

/** Ovládací jistič cívek stykačů HDO (přívod na spínací kontakt přijímače HDO v elektroměrovém rozváděči). */
export const HDO_CONTROL = { label: "Ovládání HDO – cívky stykačů (kontakt přijímače HDO)", ratedA: 6, curve: "B" as const };
export const hdoContactorLabel = (circuitLabel: string) => `Stykač HDO – ${circuitLabel}`;
/** Řádek drátovacího listu: ovládací jistič → kontakt přijímače HDO (mimo rozváděč) → cívka A1, A2 → N. */
export const HDO_RECEIVER = "Přijímač HDO (elektroměrový rozváděč) – spínací kontakt";

// -----------------------------------------------------------------------------
//  Krycí záslepky volných modulů (ČSN EN IEC 61439-1/-3: krytí IP2X / IPXXB i v místě bez přístroje)
// -----------------------------------------------------------------------------

export const BLANKING_TITLE = "Krycí záslepka neobsazených modulů (dělitelná lišta 12M, IP20/IP40 dle ČSN EN IEC 61439)";
/** Výchozí délka dělitelné záslepky v modulech. */
export const BLANKING_STRIP_MODULES = 12;

/** Krycí záslepka z katalogu (výrobce skříně), jinak obecná položka bez objednacího čísla. */
export interface BlankCover {
  manufacturer: string;
  typeCode: string;
  articleNumber: string | null;
  modulesCount: number;
}

export interface BlankingPlan {
  freeModules: number;
  /** Počet záslepek (dělitelných – zbytek se odlomí). */
  strips: number;
  stripModules: number;
  cover: BlankCover | null;
}

/** Volné moduly všech lišt (kapacita lišty − osazené moduly, přeplněná lišta nic neodečte). */
export function freeModules(capacities: readonly number[], used: readonly number[]): number {
  return Math.round(capacities.reduce((sum, capacity, index) => sum + Math.max(0, capacity - (used[index] ?? 0)), 0) * 10) / 10;
}

/** Osazené moduly po lištách (index 0 = lišta 1). */
export function usedModules(items: readonly { dinRailIndex: number; modulesWidth: number }[], rails: number): number[] {
  return Array.from({ length: rails }, (_, index) => items.filter((item) => item.dinRailIndex === index + 1).reduce((sum, item) => sum + item.modulesWidth, 0));
}

export function blankingPlan(free: number, cover: BlankCover | null = null): BlankingPlan | null {
  const whole = Math.floor(free + 1e-6);
  if (whole <= 0) return null;
  const stripModules = cover?.modulesCount && cover.modulesCount > 0 ? cover.modulesCount : BLANKING_STRIP_MODULES;
  return { freeModules: whole, strips: Math.ceil(whole / stripModules), stripModules, cover };
}

/**
 * Krycí záslepka výrobce skříně: stejný výrobce, delší (dělitelná) záslepka. Jen kus s objednacím číslem výrobce – klíč
 * externí databáze („HAGER:S35S“) není ověřené číslo, kusovník pak uvede „dle katalogu výrobce skříně“.
 */
export function blankCoverFor(enclosureManufacturer: string | null | undefined, covers: readonly BlankCover[]): BlankCover | null {
  const maker = (enclosureManufacturer ?? "").trim().toLowerCase();
  if (!maker) return null;
  return (
    [...covers]
      .filter((cover) => cover.manufacturer.trim().toLowerCase() === maker && Boolean(cover.articleNumber) && !cover.articleNumber!.includes(":"))
      .sort((a, b) => b.modulesCount - a.modulesCount)[0] ?? null
  );
}

export const blankingSummary = (plan: BlankingPlan) =>
  `Celkem ${plan.freeModules} ${plan.freeModules === 1 ? "volný modul" : plan.freeModules < 5 ? "volné moduly" : "volných modulů"} → ${plan.strips} × záslepka ${plan.stripModules}M (dělitelná)`;

/** Řádek kusovníku (List 4) – objednací číslo jen z katalogu výrobce skříně, jinak „dle katalogu výrobce skříně“. */
export function blankingPartsRow(plan: BlankingPlan | null): { articleNumber: string; typeCode: string; manufacturer: string; description: string; quantity: number } | null {
  if (!plan) return null;
  return {
    articleNumber: plan.cover?.articleNumber ?? "–",
    typeCode: plan.cover?.typeCode ?? `záslepka ${plan.stripModules}M – dle katalogu výrobce skříně`,
    manufacturer: plan.cover?.manufacturer ?? "–",
    description: `${BLANKING_TITLE} · ${blankingSummary(plan)}`,
    quantity: plan.strips,
  };
}
