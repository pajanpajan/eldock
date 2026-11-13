// Fáze 111: uspořádání skříně a DIN lišt rozváděče. Čtyři koncepce, vždy s vazbou na skutečné rozvodnice z databáze:
//  - two_field: dvoupolová skříň vedle sebe – Pole A Silnoproud 230/400 V | Pole B Slaboproud / Smart Home (2 × 12M)
//  - wide24: široké 24M lišty – silnoproud nahoře, slaboproud dole za izolační přepážkou
//  - compact18: kompaktní 18M lišty
//  - two_boards: dva samostatné rozváděče RH1 (silnoproud) + RH2 (slaboproud / Smart Home)
// Komprimace skupin na lišty (first-fit s rezervou ~15 % každé lišty): skupina chrániče se nedělí, jističochrániče,
// samostatné jističe a přívody vyplní mezery dřívějších lišt – žádná poloprázdná lišta s jedinou skupinou chrániče,
// když se vedle vejde další. Párování se skříněmi podle polí, řad a šířky řady (P_max bez údaje výrobce = odhad).
// Čisté funkce – sdílí generátor z půdorysu, průvodce uspořádáním, editor DIN lišt, krok skříně i testy.

import { parseCombSettings, type CombSetting } from "./comb-busbars";
import { enclosureFields, typicalPmax, type EnclosureFields, type EnclosureLike } from "./enclosures";

export type LayoutConcept = "two_field" | "wide24" | "compact18" | "two_boards";
export type RailLayoutMode = "single" | LayoutConcept;

export const LAYOUT_CONCEPTS: readonly LayoutConcept[] = ["two_field", "wide24", "compact18", "two_boards"];
export const isLayoutConcept = (value: unknown): value is LayoutConcept => typeof value === "string" && (LAYOUT_CONCEPTS as readonly string[]).includes(value);

export interface ConceptInfo {
  id: LayoutConcept;
  icon: string;
  title: string;
  short: string;
  description: string;
  /** Šířka lišty (u dvoupolové skříně šířka jednoho pole). */
  railModules: number;
  /** Skříně, které koncepce typicky páruje (popis – skutečné modely vždy z databáze). */
  examples: string;
}

export const CONCEPT_INFO: Record<LayoutConcept, ConceptInfo> = {
  two_field: {
    id: "two_field",
    icon: "🏢",
    title: "Dvoupolová skříň vedle sebe (Levé pole: Silnoproud 230/400 V | Pravé pole: Slaboproud & Smart Home)",
    short: "Dvoupolová skříň vedle sebe",
    description: "Dva sloupce lišt po 12 M vedle sebe se svislou přepážkou – 2 × 5 řad (120 M), 2 × 6 řad (144 M) nebo 2 × 7 řad (168 M).",
    railModules: 12,
    examples: "např. ABB ComfortLine CA2xV / CU2xV, Hager Univers (2 pole po 12 M)",
  },
  wide24: {
    id: "wide24",
    icon: "📏",
    title: "Široké lišty 24 modulů (Silnoproud nahoře, Slaboproud dole s přepážkou)",
    short: "Široké 24M lišty",
    description: "Silnoproud v horních lištách po 24 M, slaboproud a Smart Home ve spodních lištách za vyznačenou izolační přepážkou (5 × 24 M = 120 M, 6 × 24 M = 144 M).",
    railModules: 24,
    examples: "např. ABB Mistral41W 5×24, ABB ComfortLine Compact CA25 / CA26, Eaton BF, OEZ RZB",
  },
  compact18: {
    id: "compact18",
    icon: "📦",
    title: "Kompaktní 18modulové lišty (např. 4 × 18 M = 72 M)",
    short: "Kompaktní 18M lišty",
    description: "Přístroje na 18modulových lištách – menší a nižší rozvodnice, slaboproud ve spodní liště za přepážkou.",
    railModules: 18,
    examples: "např. ABB Mistral41 / Mistral65 4×18, Schneider Pragma 4×18, Eaton BF",
  },
  two_boards: {
    id: "two_boards",
    icon: "⚡+🤖",
    title: "Dva samostatné rozváděče (RH1 Silnoproudý + RH2 Slaboproudý / Smart Home)",
    short: "Dva samostatné rozváděče",
    description: "Dvě standardní bytové rozvodnice vedle sebe nebo nad sebou – RH1 silnoproud, RH2 slaboproud a Smart Home napájený z jističe řídicích obvodů v RH1.",
    railModules: 12,
    examples: "např. ABB Mistral41 / Mistral65, Eaton KLV, Hager Volta, OEZ RZA",
  },
};

export interface RailLayout {
  version: 1;
  concept: RailLayoutMode;
  /** 1 = lišty pod sebou, 2 = dvě pole vedle sebe. */
  fields: 1 | 2;
  /** Počet lišt levého pole (lišty 1…n), zbytek je pravé pole. */
  fieldARails: number;
  /** Izolační přepážka pod lištou n (silnoproud nad ní, slaboproud pod ní); null = bez přepážky. */
  partitionAfterRail: number | null;
  /** Pravé pole nese slaboproud / Smart Home (jinak pokračování silnoproudu). */
  fieldBLow: boolean;
  /** Fáze 112: ruční volba propojovacího hřebenu lišty (číslo lišty → 3f / 1f / Vyp; bez údaje Auto). */
  combs?: Record<number, CombSetting>;
}

export const SINGLE_LAYOUT: RailLayout = { version: 1, concept: "single", fields: 1, fieldARails: 0, partitionAfterRail: null, fieldBLow: false };

export const FIELD_A_LABEL = "Pole A – Silnoproud 230/400 V";
export const FIELD_B_LOW_LABEL = "Pole B – Slaboproud / Smart Home";
export const FIELD_B_POWER_LABEL = "Pole B – Silnoproud (pokračování)";
export const PARTITION_LABEL = "Izolační přepážka – silnoproud nahoře / slaboproud a Smart Home dole";

export const fieldLabels = (layout: Pick<RailLayout, "fieldBLow">): [string, string] => [FIELD_A_LABEL, layout.fieldBLow ? FIELD_B_LOW_LABEL : FIELD_B_POWER_LABEL];

/** Uspořádání po kontrole proti počtu lišt (2 pole jen s lištou v každém poli, přepážka mezi lištami). */
export function normalizeLayout(layout: RailLayout, railCount: number): RailLayout {
  const count = Math.max(1, Math.round(railCount));
  const fields = layout.fields === 2 && count >= 2 ? 2 : 1;
  const fieldARails = fields === 2 ? Math.min(count - 1, Math.max(1, Math.round(layout.fieldARails))) : 0;
  const partition = fields === 1 && layout.partitionAfterRail !== null && layout.partitionAfterRail >= 1 && layout.partitionAfterRail < count ? Math.round(layout.partitionAfterRail) : null;
  const combs = Object.fromEntries(Object.entries(parseCombSettings(layout.combs)).filter(([rail]) => Number(rail) <= count));
  return { version: 1, concept: layout.concept, fields, fieldARails, partitionAfterRail: partition, fieldBLow: fields === 2 && layout.fieldBLow, ...(Object.keys(combs).length ? { combs } : {}) };
}

/** JSON z databáze → uspořádání (poškozený / chybějící JSON = lišty pod sebou). */
export function parseRailLayout(json: string | null | undefined, railCount: number): RailLayout {
  if (!json) return SINGLE_LAYOUT;
  try {
    const raw = JSON.parse(json) as Partial<RailLayout>;
    if (raw.version !== 1) return SINGLE_LAYOUT;
    const concept: RailLayoutMode = raw.concept === "single" || isLayoutConcept(raw.concept) ? raw.concept : "single";
    return normalizeLayout(
      { version: 1, concept, fields: raw.fields === 2 ? 2 : 1, fieldARails: Number(raw.fieldARails) || 0, partitionAfterRail: typeof raw.partitionAfterRail === "number" ? raw.partitionAfterRail : null, fieldBLow: raw.fieldBLow === true, combs: parseCombSettings(raw.combs) },
      railCount,
    );
  } catch {
    return SINGLE_LAYOUT;
  }
}

export const serializeRailLayout = (layout: RailLayout) => JSON.stringify(layout);

/** Pole (0 = A vlevo, 1 = B vpravo) a pořadí řady v poli pro každou lištu 1…n. */
export function railPlacement(layout: RailLayout, railCount: number): { field: 0 | 1; row: number }[] {
  const normalized = normalizeLayout(layout, railCount);
  return Array.from({ length: Math.max(1, railCount) }, (_, index) =>
    normalized.fields === 2 && index >= normalized.fieldARails ? { field: 1 as const, row: index - normalized.fieldARails + 1 } : { field: 0 as const, row: index + 1 },
  );
}

/** Dvě pole vedle sebe / jedno pole (přepínač „Sloupce (Pole)“); u 2 polí se dělí podle slaboproudu, jinak napůl. */
export function withFields(layout: RailLayout, railCount: number, fields: 1 | 2, lowStart: number | null = null): RailLayout {
  if (fields === 1) return normalizeLayout({ ...layout, fields: 1, fieldARails: 0, partitionAfterRail: layout.fields === 2 && layout.fieldBLow ? layout.fieldARails : layout.partitionAfterRail, concept: layout.concept === "two_field" ? "single" : layout.concept }, railCount);
  const split = lowStart && lowStart > 1 && lowStart <= railCount ? lowStart - 1 : Math.ceil(railCount / 2);
  return normalizeLayout({ ...layout, concept: "two_field", fields: 2, fieldARails: split, partitionAfterRail: null, fieldBLow: lowStart !== null && lowStart > 1 }, railCount);
}

/** Fáze 112: volba hřebenu lišty (Auto = bez údaje). */
export function withComb(layout: RailLayout, rail: number, setting: CombSetting, railCount: number): RailLayout {
  const combs = { ...(layout.combs ?? {}) };
  if (setting === "AUTO") delete combs[rail];
  else combs[rail] = setting;
  return normalizeLayout({ ...layout, combs }, railCount);
}

/** Fáze 112: hřebeny po přesunu lišty nahoru / dolů (prohození dvou lišt). */
export function layoutAfterRailSwap(layout: RailLayout, a: number, b: number, railCount: number): RailLayout {
  if (!layout.combs) return layout;
  const combs = { ...layout.combs };
  const [first, second] = [combs[a], combs[b]];
  delete combs[a];
  delete combs[b];
  if (second) combs[a] = second;
  if (first) combs[b] = first;
  return normalizeLayout({ ...layout, combs }, railCount);
}

/** Uspořádání po smazání lišty: pravé pole se posune, prázdné pole zmizí. */
export function layoutAfterRailRemoved(layout: RailLayout, rail: number, railCount: number): RailLayout {
  const next = Math.max(1, railCount - 1);
  // Fáze 112: hřebeny lišt pod smazanou lištou se posunou nahoru
  if (layout.combs) {
    const combs: Record<number, CombSetting> = {};
    for (const [key, setting] of Object.entries(layout.combs)) {
      const index = Number(key);
      if (index < rail) combs[index] = setting;
      else if (index > rail) combs[index - 1] = setting;
    }
    layout = { ...layout, combs };
  }
  if (layout.fields === 2) return normalizeLayout({ ...layout, fieldARails: rail <= layout.fieldARails ? layout.fieldARails - 1 : layout.fieldARails }, next);
  const partition = layout.partitionAfterRail !== null && rail <= layout.partitionAfterRail ? layout.partitionAfterRail - 1 : layout.partitionAfterRail;
  return normalizeLayout({ ...layout, partitionAfterRail: partition }, next);
}

// ---------------------------------------------------------------------------
//  Komprimace skupin přístrojů na lišty
// ---------------------------------------------------------------------------

export interface PackDevice {
  modules: number;
}

export interface PackGroup<T extends PackDevice> {
  devices: T[];
  /** Skupina se nedělí (chránič s jističi, hlavní vypínač se svodičem), dokud se vejde na lištu. */
  keepTogether: boolean;
  /** Slaboproud / Smart Home (pravé pole, spodní lišty za přepážkou, druhý rozváděč). */
  low: boolean;
  /** Jedno pole lišt pod sebou: skupina začíná na vlastní liště (akční členy chytré domácnosti – fáze 81). */
  ownRail?: boolean;
  /** Kolik prvních přístrojů skupiny zůstává v silnoproudu u dvou rozváděčů (jistič řídicích obvodů = přívod RH2). */
  powerLead?: number;
}

export interface PackedRail<T> {
  capacity: number;
  devices: T[];
  used: number;
}

/** Rezerva lišty pro pozdější doplnění (~15 %): 12M → 10 M, 18M → 15 M, 24M → 20 M, 36M → 30 M. */
export const RAIL_RESERVE = 0.15;
export const railFillLimit = (capacity: number) => Math.max(1, capacity - Math.ceil(capacity * RAIL_RESERVE - 1e-9));

const EPS = 1e-9;
const widthOf = (devices: readonly PackDevice[]) => devices.reduce((sum, device) => sum + device.modules, 0);
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Skupiny na lišty dané šířky (first-fit): celistvá skupina jde na první lištu, kde se vejde s rezervou (prázdná lišta
 * pojme celou šířku); dělitelné skupiny (jističochrániče, samostatné jističe, přívody) po přístrojích do mezer.
 * Skupina širší než lišta začne na nové liště a pokračuje na další.
 */
export function packRails<T extends PackDevice>(groups: readonly PackGroup<T>[], capacity: number, options: { reserve?: boolean } = {}): PackedRail<T>[] {
  const reserve = options.reserve ?? true;
  const rails: PackedRail<T>[] = [];
  const limit = (rail: PackedRail<T>) => (rail.used <= EPS ? capacity : reserve ? railFillLimit(capacity) : capacity);
  const open = () => {
    const rail: PackedRail<T> = { capacity, devices: [], used: 0 };
    rails.push(rail);
    return rail;
  };
  // Vlastní lišta (fáze 81): skupina i vše za ní jen na nových lištách
  let floor = 0;
  const fit = (width: number) => rails.slice(floor).find((rail) => rail.used + width <= limit(rail) + EPS) ?? null;
  const put = (rail: PackedRail<T>, device: T) => {
    rail.devices.push(device);
    rail.used += device.modules;
  };
  /** Přístroje dělitelných skupin (jdou přesunout na jinou lištu) a začátek oblasti (vlastní lišta) každé lišty. */
  const movable = new Set<T>();
  const regionOf = new Map<PackedRail<T>, number>();
  for (const group of groups) {
    if (!group.devices.length) continue;
    if (group.ownRail) floor = rails.length;
    const width = widthOf(group.devices);
    const before = rails.length;
    if (group.keepTogether && width <= capacity + EPS) {
      const rail = fit(width) ?? open();
      for (const device of group.devices) put(rail, device);
    } else if (group.keepTogether) {
      let rail = open();
      for (const device of group.devices) {
        if (rail.used + device.modules > capacity + EPS) rail = open();
        put(rail, device);
      }
    } else {
      for (const device of group.devices) {
        put(fit(device.modules) ?? open(), device);
        movable.add(device);
      }
    }
    for (const rail of rails.slice(before)) regionOf.set(rail, floor);
  }
  // Poslední lišta jen s dělitelnými přístroji (jističochrániče, samostatné jističe), které se vejdou do volného místa
  // lišt nad ní (bez rezervy) – přesunout nahoru, ať nezůstane téměř prázdná lišta (např. 2/12 M)
  while (rails.length > 1) {
    const last = rails[rails.length - 1];
    const start = regionOf.get(last) ?? 0;
    const others = rails.slice(start, -1);
    if (!others.length || !last.devices.every((device) => movable.has(device)) || last.used > others.reduce((sum, rail) => sum + (rail.capacity - rail.used), 0) + EPS) break;
    const trial = others.map((rail) => ({ rail, used: rail.used, add: [] as T[] }));
    const placed = [...last.devices].sort((a, b) => b.modules - a.modules).every((device) => {
      const target = trial.find((entry) => entry.used + device.modules <= capacity + EPS);
      if (!target) return false;
      target.used += device.modules;
      target.add.push(device);
      return true;
    });
    if (!placed) break;
    for (const entry of trial) for (const device of entry.add) put(entry.rail, device);
    rails.pop();
  }
  return rails.map((rail) => ({ ...rail, used: round(rail.used) }));
}

/** Jedno pole lišt pod sebou (výchozí generátor): silnoproud, pak skupiny na vlastní liště (Smart Home). */
export function packSingle<T extends PackDevice>(groups: readonly PackGroup<T>[], capacity: number, options: { reserve?: boolean } = {}): PackedRail<T>[] {
  return packRails(groups, capacity, options);
}

// ---------------------------------------------------------------------------
//  Koncepce uspořádání
// ---------------------------------------------------------------------------

export interface PlannedRail<T> extends PackedRail<T> {
  /** 0 = levé pole / horní část, 1 = pravé pole / spodní část za přepážkou. */
  field: 0 | 1;
  low: boolean;
}

export interface LayoutPlan<T> {
  concept: LayoutConcept;
  /** Hlavní rozváděč (u dvou rozváděčů RH1). */
  rails: PlannedRail<T>[];
  layout: RailLayout;
  /** Dva rozváděče: lišty RH2 (slaboproud / Smart Home); null = rozváděč nemá slaboproud. */
  second: PlannedRail<T>[] | null;
}

const lowSplit = <T extends PackDevice>(groups: readonly PackGroup<T>[], separateLead: boolean) => {
  const power: PackGroup<T>[] = [];
  const low: PackGroup<T>[] = [];
  for (const group of groups) {
    if (!group.low) {
      power.push({ ...group, ownRail: false });
      continue;
    }
    const lead = separateLead ? Math.min(group.devices.length, Math.max(0, group.powerLead ?? 0)) : 0;
    if (lead) power.push({ devices: group.devices.slice(0, lead), keepTogether: false, low: false });
    if (group.devices.length > lead) low.push({ ...group, devices: group.devices.slice(lead), ownRail: false });
  }
  return { power, low };
};

const planned = <T>(rails: readonly PackedRail<T>[], field: 0 | 1, low: boolean): PlannedRail<T>[] => rails.map((rail) => ({ ...rail, field, low }));

/** Rozložení přístrojů podle koncepce (šířka lišty z koncepce, u dvou rozváděčů a dvou polí volitelně 12 / 18 M). */
export function planLayout<T extends PackDevice>(groups: readonly PackGroup<T>[], concept: LayoutConcept, options: { railModules?: number; reserve?: boolean } = {}): LayoutPlan<T> {
  const capacity = options.railModules ?? CONCEPT_INFO[concept].railModules;
  const { power, low } = lowSplit(groups, concept === "two_boards");
  const a = packRails(power, capacity, options);
  const b = packRails(low, capacity, options);
  if (concept === "two_field") {
    if (!b.length) {
      // Bez slaboproudu: silnoproud rovnoměrně do obou polí (pravé pole = pokračování)
      const split = Math.max(1, Math.ceil(a.length / 2));
      const rails = [...planned(a.slice(0, split), 0, false), ...planned(a.slice(split), 1, false)];
      return { concept, rails, layout: normalizeLayout({ version: 1, concept, fields: 2, fieldARails: split, partitionAfterRail: null, fieldBLow: false }, rails.length), second: null };
    }
    const rails = [...planned(a, 0, false), ...planned(b, 1, true)];
    return { concept, rails, layout: normalizeLayout({ version: 1, concept, fields: 2, fieldARails: Math.max(1, a.length), partitionAfterRail: null, fieldBLow: true }, rails.length), second: null };
  }
  if (concept === "two_boards") {
    return { concept, rails: planned(a, 0, false), layout: { ...SINGLE_LAYOUT, concept }, second: b.length ? planned(b, 0, true) : null };
  }
  const rails = [...planned(a, 0, false), ...planned(b, 1, true)];
  return { concept, rails, layout: normalizeLayout({ version: 1, concept, fields: 1, fieldARails: 0, partitionAfterRail: b.length && a.length ? a.length : null, fieldBLow: false }, rails.length), second: null };
}

// ---------------------------------------------------------------------------
//  Párování se skříněmi z databáze
// ---------------------------------------------------------------------------

/** Celková rezerva skříně (25 % modulů navíc – jako generátor z půdorysu). */
export const ENCLOSURE_RESERVE = 0.25;

export interface LayoutNeed {
  /** Řady skříně (u dvou polí řady jednoho pole). */
  rows: number;
  fields: 1 | 2;
  /** Šířka lišty (u dvou polí šířka jednoho pole). */
  fieldWidth: number;
  usedModules: number;
  requiredModules: number;
  lossW: number;
}

/** Požadavek na skříň z lišt (s poli) a ztrátového výkonu přístrojů. */
export function layoutNeed(rails: readonly { capacity: number; used: number; field?: 0 | 1 }[], fields: 1 | 2, lossW: number): LayoutNeed {
  const rows = fields === 2 ? Math.max(rails.filter((rail) => rail.field !== 1).length, rails.filter((rail) => rail.field === 1).length) : rails.length;
  const usedModules = round(rails.reduce((sum, rail) => sum + rail.used, 0));
  return { rows: Math.max(1, rows), fields, fieldWidth: Math.max(1, ...rails.map((rail) => rail.capacity)), usedModules, requiredModules: Math.ceil(usedModules * (1 + ENCLOSURE_RESERVE) - EPS), lossW: round(lossW) };
}

/** P_max skříně: z katalogu výrobce, jinak orientační odhad podle velikosti a materiálu (ΔT 35 K). */
export function enclosurePmax(enclosure: Pick<EnclosureLike, "pMaxW" | "totalModules" | "rows" | "material">): { w: number; estimated: boolean } {
  if (enclosure.pMaxW !== null && enclosure.pMaxW !== undefined) return { w: enclosure.pMaxW, estimated: false };
  const material = enclosure.material === "PAINTED_STEEL" || enclosure.material === "STAINLESS_STEEL" ? enclosure.material : "PLASTIC";
  return { w: typicalPmax(enclosure.totalModules, enclosure.rows, material), estimated: true };
}

const orientational = (enclosure: Pick<EnclosureLike, "dataSource" | "articleNumber">) => enclosure.dataSource === "STANDARD_MATRIX" || /^STD-/i.test(enclosure.articleNumber);

/** Skříň pojme lišty: pole, řady a šířka řady (u přesné koncepce šířka řady = šířka lišty, 12M i 13 / 14M), moduly s rezervou a P_max. */
export function fitsLayout(enclosure: EnclosureLike, need: LayoutNeed, options: { exactWidth?: boolean } = {}): boolean {
  const fields = enclosureFields(enclosure);
  const geometry =
    need.fields === 2
      ? fields.fields >= 2 && fields.fieldWidth >= need.fieldWidth && fields.fieldWidth <= need.fieldWidth + 2 && enclosure.rows >= need.rows
      : fields.fields === 1 && enclosure.modulesPerRow >= need.fieldWidth && (!options.exactWidth || enclosure.modulesPerRow <= need.fieldWidth + 2) && enclosure.rows >= need.rows;
  return geometry && enclosure.totalModules >= need.requiredModules && enclosurePmax(enclosure).w >= need.lossW;
}

export interface EnclosureMatch<E extends EnclosureLike = EnclosureLike> {
  enclosure: E;
  fields: EnclosureFields;
  pMax: { w: number; estimated: boolean };
  reservePercent: number;
  sameManufacturer: boolean;
  verified: boolean;
}

/** Vyhovující skříně: výrobce přístrojů první, pak nejmenší, katalog výrobce před orientační maticí, známé P_max. */
export function matchLayoutEnclosures<E extends EnclosureLike>(list: readonly E[], need: LayoutNeed, options: { manufacturer?: string | null; exactWidth?: boolean; limit?: number } = {}): EnclosureMatch<E>[] {
  const brand = options.manufacturer?.trim().toLowerCase() ?? "";
  return list
    .filter((enclosure) => fitsLayout(enclosure, need, options))
    .map((enclosure) => ({
      enclosure,
      fields: enclosureFields(enclosure),
      pMax: enclosurePmax(enclosure),
      reservePercent: enclosure.totalModules > 0 ? Math.max(0, Math.round(((enclosure.totalModules - need.usedModules) / enclosure.totalModules) * 100)) : 0,
      sameManufacturer: Boolean(brand) && enclosure.manufacturer.toLowerCase() === brand,
      verified: !orientational(enclosure),
    }))
    .sort(
      (a, b) =>
        Number(b.sameManufacturer) - Number(a.sameManufacturer) ||
        a.enclosure.totalModules - b.enclosure.totalModules ||
        Number(b.verified) - Number(a.verified) ||
        Number(a.pMax.estimated) - Number(b.pMax.estimated) ||
        a.enclosure.rows - b.enclosure.rows ||
        a.enclosure.model.localeCompare(b.enclosure.model, "cs"),
    )
    .slice(0, options.limit ?? 50);
}

/** Přesná šířka řady podle koncepce (široké / kompaktní lišty a dva rozváděče – ne skříň s širší řadou). */
const exactFor = (concept: LayoutConcept) => concept !== "two_field";

export interface ConceptBoard<T, E extends EnclosureLike> {
  rails: PlannedRail<T>[];
  need: LayoutNeed;
  matches: EnclosureMatch<E>[];
}

export interface ConceptOption<T, E extends EnclosureLike> {
  concept: LayoutConcept;
  plan: LayoutPlan<T>;
  main: ConceptBoard<T, E>;
  second: ConceptBoard<T, E> | null;
  /** V databázi je vyhovující skříň (u dvou rozváděčů pro oba). */
  available: boolean;
  recommended: boolean;
  /** „Pole A: 5 × 12 M · Pole B: 3 × 12 M“. */
  summary: string;
  warning: string | null;
}

const plural = (count: number, one: string, few: string, many: string) => (count === 1 ? one : count >= 2 && count <= 4 ? few : many);
const railsText = (count: number, width: number) => `${count} × ${width} M`;
const lossOf = <T extends { powerLossW?: number }>(rails: readonly PackedRail<T>[]) => rails.reduce((sum, rail) => sum + rail.devices.reduce((acc, device) => acc + (device.powerLossW ?? 0), 0), 0);

/** Lišty jednoho rozváděče: pro dva rozváděče nejmenší vyhovující skříň z 12M i 18M lišt. */
function boardFor<T extends PackDevice & { powerLossW?: number }, E extends EnclosureLike>(
  groups: readonly PackGroup<T>[],
  enclosures: readonly E[],
  manufacturer: string | null,
  widths: readonly number[],
): ConceptBoard<T, E> {
  const variants = widths.map((width) => {
    const rails = planned(packRails(groups, width), 0, groups.some((group) => group.low));
    const need = layoutNeed(rails, 1, lossOf(rails));
    return { rails, need, matches: matchLayoutEnclosures(enclosures, need, { manufacturer, exactWidth: true, limit: 6 }) };
  });
  const best = (variant: (typeof variants)[number]) => variant.matches[0] ?? null;
  return (
    [...variants].sort((a, b) => {
      const x = best(a);
      const y = best(b);
      if (!x || !y) return Number(Boolean(y)) - Number(Boolean(x));
      return Number(y.sameManufacturer) - Number(x.sameManufacturer) || x.enclosure.totalModules - y.enclosure.totalModules || a.rails.length - b.rails.length;
    })[0] ?? variants[0]
  );
}

/** Dva samostatné rozváděče: RH1 silnoproud (s jističem řídicích obvodů) a RH2 slaboproud – lišty 12 / 18 M a skříně. */
export function planTwoBoards<T extends PackDevice & { powerLossW?: number }, E extends EnclosureLike>(
  groups: readonly PackGroup<T>[],
  enclosures: readonly E[],
  manufacturer: string | null,
): { main: ConceptBoard<T, E>; second: ConceptBoard<T, E> | null } {
  const { power, low } = lowSplit(groups, true);
  return { main: boardFor(power, enclosures, manufacturer, [12, 18]), second: low.length ? boardFor(low, enclosures, manufacturer, [12, 18]) : null };
}

/**
 * Čtyři koncepce pro průvodce uspořádáním: lišty podle koncepce, požadavek na skříň a až `limit` skutečných skříní
 * z databáze. Doporučená: s chytrou domácností dvoupolová skříň, jinak koncepce s nejmenší vyhovující skříní.
 */
export function layoutOptions<T extends PackDevice & { powerLossW?: number }, E extends EnclosureLike>(
  groups: readonly PackGroup<T>[],
  enclosures: readonly E[],
  options: { manufacturer?: string | null; limit?: number } = {},
): ConceptOption<T, E>[] {
  const manufacturer = options.manufacturer ?? null;
  const limit = options.limit ?? 3;
  const hasLow = groups.some((group) => group.low && group.devices.length > (group.powerLead ?? 0));
  const result = LAYOUT_CONCEPTS.map((concept): ConceptOption<T, E> => {
    if (concept === "two_boards") {
      const { main, second } = planTwoBoards(groups, enclosures, manufacturer);
      const plan: LayoutPlan<T> = { concept, rails: main.rails, layout: { ...SINGLE_LAYOUT, concept }, second: second?.rails ?? null };
      const available = main.matches.length > 0 && (!second || second.matches.length > 0);
      const width = (board: ConceptBoard<T, E>) => board.rails[0]?.capacity ?? 12;
      return {
        concept,
        plan,
        main: { ...main, matches: main.matches.slice(0, limit) },
        second: second ? { ...second, matches: second.matches.slice(0, limit) } : null,
        available,
        recommended: false,
        summary: `RH1 Silnoproud: ${railsText(main.rails.length, width(main))}${second ? ` · RH2 Slaboproud / Smart Home: ${railsText(second.rails.length, width(second))}` : " · bez slaboproudu (RH2 nevznikne)"}`,
        warning: available ? null : `V databázi není ${main.matches.length ? "skříň RH2" : "skříň RH1"} pro ${main.matches.length ? railsText(second!.rails.length, width(second!)) : railsText(main.rails.length, width(main))} – zvolte jinou koncepci.`,
      };
    }
    const plan = planLayout(groups, concept);
    const fields = plan.layout.fields;
    const need = layoutNeed(plan.rails, fields, lossOf(plan.rails));
    const matches = matchLayoutEnclosures(enclosures, need, { manufacturer, exactWidth: exactFor(concept), limit });
    const width = CONCEPT_INFO[concept].railModules;
    const a = plan.rails.filter((rail) => rail.field === 0).length;
    const b = plan.rails.length - a;
    const summary =
      concept === "two_field"
        ? `Pole A – Silnoproud: ${railsText(a, width)} · Pole B – ${plan.layout.fieldBLow ? "Slaboproud / Smart Home" : "Silnoproud"}: ${railsText(b, width)} (2 pole × ${need.rows} ${plural(need.rows, "řada", "řady", "řad")})`
        : `${railsText(plan.rails.length, width)}${plan.layout.partitionAfterRail ? ` · silnoproud ${a} ${plural(a, "lišta", "lišty", "lišt")}, slaboproud ${b} ${plural(b, "lišta", "lišty", "lišt")} za přepážkou` : ""}`;
    return {
      concept,
      plan,
      main: { rails: plan.rails, need, matches },
      second: null,
      available: matches.length > 0,
      recommended: false,
      summary,
      warning: matches.length ? null : `V databázi není skříň pro ${fields === 2 ? `2 pole × ${need.rows} řad po ${width} M` : `${need.rows} ${plural(need.rows, "řadu", "řady", "řad")} po ${width} M`} (${need.requiredModules} M s rezervou 25 %) – zvolte jinou koncepci.`,
    };
  });
  // Bez slaboproudu nedává smysl doporučit dva rozváděče (RH2 by nevznikl)
  const available = result.filter((option) => option.available && (hasLow || option.concept !== "two_boards"));
  const smallest = (option: ConceptOption<T, E>) => (option.main.matches[0]?.enclosure.totalModules ?? Infinity) + (option.second?.matches[0]?.enclosure.totalModules ?? 0);
  const pick = (hasLow ? available.find((option) => option.concept === "two_field") : null) ?? [...available].sort((a, b) => smallest(a) - smallest(b))[0] ?? null;
  return result.map((option) => ({ ...option, recommended: option === pick }));
}

// ---------------------------------------------------------------------------
//  Skupiny z osazeného projektu (průvodce uspořádáním v AI Panel Builderu)
// ---------------------------------------------------------------------------

export interface ProjectItemLike {
  id: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: string | null;
  parentItemId: string | null;
  powerLossW?: number;
}

const LOW_CATEGORIES = new Set(["PLC", "PSU"]);
const HEAD_CATEGORIES = new Set(["MAIN_SWITCH", "SPD", "TERMINAL"]);

/**
 * Skupiny přístrojů osazeného projektu v pořadí lišt: hlavní vypínač se svodičem a svorkovnicí, chránič se svými jističi
 * (podle stromu zapojení), slaboproud (PLC, zdroje, moduly chytré domácnosti) s jejich napájecím jističem na začátku
 * a ostatní přístroje jako dělitelná skupina.
 */
export function projectGroups<T extends ProjectItemLike>(items: readonly T[]): PackGroup<T & PackDevice>[] {
  const ordered = [...items].sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail).map((item) => ({ ...item, modules: item.modulesWidth }));
  const byId = new Map(ordered.map((item) => [item.id, item]));
  const lowIds = new Set(ordered.filter((item) => LOW_CATEGORIES.has(item.category ?? "")).map((item) => item.id));
  // Jistič, který napájí slaboproud (rodič modulů ve stromu), patří na začátek slaboproudé skupiny
  const supplyIds = new Set([...lowIds].map((id) => byId.get(id)?.parentItemId).filter((id): id is string => Boolean(id) && !lowIds.has(id!) && byId.get(id!)?.category === "MCB"));
  const rcdOf = (item: (typeof ordered)[number]) => (item.category === "RCD" ? item.id : item.parentItemId && byId.get(item.parentItemId)?.category === "RCD" ? item.parentItemId : null);
  const head = ordered.filter((item) => HEAD_CATEGORIES.has(item.category ?? "") && !rcdOf(item));
  const used = new Set(head.map((item) => item.id));
  const groups: PackGroup<T & PackDevice>[] = head.length ? [{ devices: head, keepTogether: true, low: false }] : [];
  const rcdGroups = new Map<string, (typeof ordered)[number][]>();
  for (const item of ordered) {
    const rcd = rcdOf(item);
    if (!rcd || lowIds.has(item.id) || supplyIds.has(item.id)) continue;
    rcdGroups.set(rcd, [...(rcdGroups.get(rcd) ?? []), item]);
  }
  for (const [rcd, members] of rcdGroups) {
    const sorted = [...members].sort((a, b) => Number(b.id === rcd) - Number(a.id === rcd));
    groups.push({ devices: sorted, keepTogether: true, low: false });
    for (const member of sorted) used.add(member.id);
  }
  const rest = ordered.filter((item) => !used.has(item.id) && !lowIds.has(item.id) && !supplyIds.has(item.id));
  if (rest.length) groups.push({ devices: rest, keepTogether: false, low: false });
  const supply = ordered.filter((item) => supplyIds.has(item.id));
  const low = ordered.filter((item) => lowIds.has(item.id));
  if (low.length) groups.push({ devices: [...supply, ...low], keepTogether: true, low: true, ownRail: true, powerLead: supply.length });
  else if (supply.length) groups.push({ devices: supply, keepTogether: false, low: false });
  return groups;
}

/** Začátek slaboproudu v projektu (první lišta s modulem PLC / zdrojem) – rozdělení polí přepínačem „2 pole“. */
export function lowStartRail(items: readonly Pick<ProjectItemLike, "dinRailIndex" | "category">[]): number | null {
  const rails = items.filter((item) => LOW_CATEGORIES.has(item.category ?? "")).map((item) => item.dinRailIndex);
  return rails.length ? Math.min(...rails) : null;
}

/** Text uspořádání pro souhrn lišt („2 pole vedle sebe: A 5 lišt | B 3 lišty“). */
export function layoutSummaryText(layout: RailLayout, railCount: number): string | null {
  const normalized = normalizeLayout(layout, railCount);
  if (normalized.fields === 2) {
    const b = railCount - normalized.fieldARails;
    return `2 pole vedle sebe: A ${normalized.fieldARails} ${plural(normalized.fieldARails, "lišta", "lišty", "lišt")} | B ${b} ${plural(b, "lišta", "lišty", "lišt")}`;
  }
  return normalized.partitionAfterRail ? `Přepážka pod lištou ${normalized.partitionAfterRail} (silnoproud / slaboproud)` : null;
}
