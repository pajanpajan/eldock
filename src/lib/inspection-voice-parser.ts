import type { EquipmentType } from "@/generated/prisma/enums";

import { pragueToday } from "./inspection";
import { PORTABLE_TYPES } from "./inspection-rules";

// Hlasový / textový dispečer plánovače revizí: z české věty („Nářadí a prodlužováky v Hale A
// do 30 dnů“) vytáhne strukturovaný filtr. Čistě deterministický – bez externích API, funguje
// offline. Slova se porovnávají bez diakritiky podle kořenů, takže zvládne pády i překlepy
// v diakritice z rozpoznávání řeči. Období se počítá v kalendářních dnech (Europe/Prague)
// jako posun od dneška: 0 = dnes, záporné = po termínu.

export type TimeframeKind = "DEFAULT" | "EXPIRED_ONLY" | "THIS_MONTH" | "NEXT_MONTH" | "MONTH" | "DAYS" | "YEAR_END" | "QUARTER_END" | "LATER";

export interface Timeframe {
  kind: TimeframeKind;
  /** První den okna (posun od dneška); `null` = od dneška. */
  fromDay: number | null;
  /** Poslední den okna (včetně). */
  toDay: number;
  /** Přibrat i propadlé (a vyřazené / bez revize). */
  includeExpired: boolean;
  label: string;
}

export type InstrumentGroup = "PORTABLE" | "FIXED";

export interface CategoryMatch {
  key: string;
  label: string;
  types: EquipmentType[];
}

export interface LocationTerm {
  label: string;
  /** Normalizovaný kořen pro porovnání s názvem budovy / zóny, u pater kód („1NP“). */
  match: string;
}

export interface QueryChip {
  key: string;
  label: string;
}

export interface InspectionPlanQuery {
  text: string;
  timeframe: Timeframe;
  categories: CategoryMatch[];
  /** Sjednocení typů z kategorií; prázdné = všechny typy. */
  types: EquipmentType[];
  instrumentGroup: InstrumentGroup | null;
  buildingQuery: LocationTerm[];
  floorQuery: LocationTerm[];
  zoneQuery: LocationTerm[];
  /** Budovy a zóny spojené spojkou („v kuchyňkách a administrativě“) = ANY, jinak ALL. */
  locationMode: "ALL" | "ANY";
  recognizedChips: QueryChip[];
}

// ---------------------------------------------------------------------------
//  Normalizace a kalendář
// ---------------------------------------------------------------------------

/** Malá písmena bez diakritiky, interpunkce → mezery. */
export function normalizeCz(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DAY_MS = 24 * 3600 * 1000;

function todayParts(now: Date) {
  const [year, month, day] = pragueToday(now).split("-").map(Number);
  return { year, month: month - 1, day, utc: Date.UTC(year, month - 1, day) };
}

/** Posun ve dnech od dneška k danému kalendářnímu dni. */
function offsetTo(now: Date, year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month, day) - todayParts(now).utc) / DAY_MS);
}

/** Posun k poslednímu dni měsíce (`month` může přetéct do dalšího roku). */
const endOfMonthOffset = (now: Date, year: number, month: number) => offsetTo(now, year, month + 1, 0);
const startOfMonthOffset = (now: Date, year: number, month: number) => offsetTo(now, year, month, 1);

export const MONTH_NAMES = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

/** Tvary měsíců bez diakritiky (1., 2. a 6. pád). */
const MONTH_FORMS: string[][] = [
  ["leden", "ledna", "lednu"],
  ["unor", "unora", "unoru"],
  ["brezen", "brezna", "breznu"],
  ["duben", "dubna", "dubnu"],
  ["kveten", "kvetna", "kvetnu"],
  ["cerven", "cervna", "cervnu"],
  ["cervenec", "cervence", "cervenci"],
  ["srpen", "srpna", "srpnu"],
  ["zari"],
  ["rijen", "rijna", "rijnu"],
  ["listopad", "listopadu"],
  ["prosinec", "prosince", "prosinci"],
];

const DEFAULT_HORIZON_DAYS = 183;
const plus = (include: boolean) => (include ? " (+ propadlé)" : "");

/** Období podle druhu; `month` jen pro MONTH, `days` jen pro DAYS. */
export function timeframeFor(
  kind: TimeframeKind,
  now: Date,
  options: { includeExpired?: boolean; month?: number; days?: number } = {},
): Timeframe {
  const include = options.includeExpired ?? true;
  const { year, month } = todayParts(now);
  switch (kind) {
    case "EXPIRED_ONLY":
      return { kind, fromDay: null, toDay: -1, includeExpired: true, label: "Období: Jen propadlé" };
    case "THIS_MONTH":
      return { kind, fromDay: null, toDay: endOfMonthOffset(now, year, month), includeExpired: include, label: `Období: Tento měsíc${plus(include)}` };
    case "NEXT_MONTH":
      return {
        kind,
        fromDay: startOfMonthOffset(now, year, month + 1),
        toDay: endOfMonthOffset(now, year, month + 1),
        includeExpired: include,
        label: `Období: Příští měsíc${plus(include)}`,
      };
    case "MONTH": {
      const target = options.month ?? month;
      if (target === month) return timeframeFor("THIS_MONTH", now, options);
      // Uplynulý měsíc = stejný měsíc příštího roku.
      const targetYear = target < month ? year + 1 : year;
      return {
        kind,
        fromDay: startOfMonthOffset(now, targetYear, target),
        toDay: endOfMonthOffset(now, targetYear, target),
        includeExpired: include,
        label: `Období: ${MONTH_NAMES[target]} ${targetYear}${plus(include)}`,
      };
    }
    case "DAYS": {
      const days = Math.max(0, Math.round(options.days ?? 30));
      return { kind, fromDay: null, toDay: days, includeExpired: include, label: `Období: Do ${days} ${days === 1 ? "dne" : "dnů"}${plus(include)}` };
    }
    case "YEAR_END":
      return { kind, fromDay: null, toDay: offsetTo(now, year, 11, 31), includeExpired: include, label: `Období: Do konce roku${plus(include)}` };
    case "QUARTER_END": {
      const quarterEndMonth = Math.floor(month / 3) * 3 + 2;
      return { kind, fromDay: null, toDay: endOfMonthOffset(now, year, quarterEndMonth), includeExpired: include, label: `Období: Do konce kvartálu${plus(include)}` };
    }
    case "LATER":
      return {
        kind,
        fromDay: startOfMonthOffset(now, year, month + 2),
        toDay: DEFAULT_HORIZON_DAYS,
        includeExpired: include,
        label: `Období: Další 3–6 měsíců${plus(include)}`,
      };
    case "DEFAULT":
      return { kind, fromDay: null, toDay: DEFAULT_HORIZON_DAYS, includeExpired: true, label: "Období: Příštích 6 měsíců (+ propadlé)" };
  }
}

// ---------------------------------------------------------------------------
//  Slovník kategorií a lokací
// ---------------------------------------------------------------------------

interface CategoryDef extends CategoryMatch {
  prefixes: string[];
  exact?: string[];
}

const MACHINE_TYPES: EquipmentType[] = ["MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR"];
const FIXED_TYPES: EquipmentType[] = ["SWITCHBOARD", "TRANSFORMER", "PRODUCTION_LINE", ...MACHINE_TYPES];

const CATEGORIES: CategoryDef[] = [
  { key: "switchboard", label: "Rozváděče", types: ["SWITCHBOARD"], prefixes: ["rozvadec", "rozvadc"] },
  { key: "transformer", label: "Trafostanice", types: ["TRANSFORMER"], prefixes: ["traf", "transform"] },
  { key: "line", label: "Výrobní linky", types: ["PRODUCTION_LINE"], prefixes: ["link"] },
  { key: "machine", label: "Stroje", types: MACHINE_TYPES, prefixes: ["stroj", "cnc"], exact: ["lis", "lisy", "lisu", "lisum", "lisech"] },
  { key: "tool", label: "Ruční nářadí", types: ["POWER_TOOL"], prefixes: ["narad", "vrtack", "brusk", "flexk"] },
  {
    key: "appliance",
    label: "Spotřebiče",
    types: ["APPLIANCE"],
    prefixes: ["spotrebic", "konvic", "mikrovln", "lednic", "chladnic", "kavovar", "pocitac", "tiskar"],
  },
  { key: "cord", label: "Prodlužováky", types: ["EXTENSION_CORD"], prefixes: ["prodluz", "bubn"], exact: ["buben"] },
  { key: "welder", label: "Svářečky", types: ["WELDER"], prefixes: ["svarec", "svareck"] },
  { key: "lps", label: "Hromosvody", types: ["LIGHTNING_ROD"], prefixes: ["hromosvod", "bleskosvod"], exact: ["lps"] },
  { key: "emergency", label: "Nouzové osvětlení", types: ["EMERGENCY_LIGHTING"], prefixes: ["nouzov", "osvetlen"] },
];

const GROUPS: (CategoryDef & { group: InstrumentGroup })[] = [
  { key: "portable", group: "PORTABLE", label: "Přenosné spotřebiče a nářadí (ČSN 33 1600)", types: [...PORTABLE_TYPES], prefixes: ["prenosn"] },
  { key: "fixed", group: "FIXED", label: "Pevná zařízení / VTZ", types: FIXED_TYPES, prefixes: ["pevn"], exact: ["vtz"] },
];

const BUILDING_NAMES: { prefixes: string[]; exact?: string[]; term: LocationTerm }[] = [
  { prefixes: ["lisovn"], term: { label: "Lisovna", match: "lisovn" } },
  { prefixes: ["montaz"], term: { label: "Montáž", match: "montaz" } },
  { prefixes: ["energetik"], term: { label: "Energetika", match: "energetik" } },
  { prefixes: ["administrativ"], term: { label: "Administrativa", match: "administrativ" } },
  { prefixes: [], exact: ["sklad", "skladu", "skladech", "skladem"], term: { label: "Sklad", match: "sklad" } },
  { prefixes: ["lakovn"], term: { label: "Lakovna", match: "lakovn" } },
];

const ZONES: { prefixes: string[]; term: LocationTerm }[] = [
  { prefixes: ["kuchyn"], term: { label: "Kuchyňka", match: "kuchyn" } },
  { prefixes: ["diln"], term: { label: "Dílna", match: "diln" } },
  { prefixes: ["svarovn"], term: { label: "Svařovna", match: "svarovn" } },
  { prefixes: ["kancel"], term: { label: "Kancelář", match: "kancel" } },
  { prefixes: ["zazem"], term: { label: "Zázemí", match: "zazem" } },
  { prefixes: ["rozvodn"], term: { label: "Rozvodna", match: "rozvodn" } },
  { prefixes: ["strech"], term: { label: "Střecha", match: "strech" } },
];

const tokenMatches = (token: string, def: { prefixes: string[]; exact?: string[] }) =>
  def.prefixes.some((prefix) => token.startsWith(prefix)) || (def.exact ?? []).includes(token);

// ---------------------------------------------------------------------------
//  Parser
// ---------------------------------------------------------------------------

interface Mention {
  start: number;
  end: number;
}

/** Tokeny s pozicí v normalizovaném textu. */
function tokenize(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(/[a-z0-9]+/g)) out.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  return out;
}

function parseTimeframe(text: string, tokens: ReturnType<typeof tokenize>, now: Date): { timeframe: Timeframe; monthTokens: Set<number> } {
  const has = (pattern: RegExp) => pattern.test(text);
  const mentionsExpired = tokens.some(({ word }) => word.startsWith("propadl") || word.startsWith("expir")) || has(/\bpo terminu?\b/);
  const excludesExpired = has(/\b(bez|krome|mimo)\s+(propadl|expir)/);
  const includeExpired = !excludesExpired;
  const monthTokens = new Set<number>();

  let timeframe: Timeframe | null = null;
  if (has(/\b(pristi|pristim|nasledujici|nasledujicim)\s+mesic/)) timeframe = timeframeFor("NEXT_MONTH", now, { includeExpired });
  else if (has(/\b(tento|tenhle|tomto|tomhle|aktualni|aktualnim|letosni)\s+mesic|\bdo konce mesice\b/)) timeframe = timeframeFor("THIS_MONTH", now, { includeExpired });

  if (!timeframe) {
    for (const [index, { word }] of tokens.entries()) {
      const month = MONTH_FORMS.findIndex((forms) => forms.includes(word));
      if (month >= 0) {
        monthTokens.add(index);
        timeframe = timeframeFor("MONTH", now, { includeExpired, month });
        break;
      }
    }
  }

  if (!timeframe) {
    const days = text.match(/\b(?:do|behem|za|pristich|nejblizsich)\s+(\d{1,3})\s+(dnu|dni|dne|den|dny|tydnu|tydny|tyden|mesicu|mesice|mesic)\b/);
    if (days) {
      const count = Number(days[1]);
      const unit = days[2];
      const factor = unit.startsWith("tyd") ? 7 : unit.startsWith("mes") ? 30 : 1;
      timeframe = timeframeFor("DAYS", now, { includeExpired, days: count * factor });
    }
  }
  if (!timeframe && has(/\bdo konce roku\b|\bletos\b|\btento rok\b/)) timeframe = timeframeFor("YEAR_END", now, { includeExpired });
  if (!timeframe && has(/\b(tento|tenhle|tomto|toto|tohle|aktualni)\s+(kvartal|ctvrtleti)|\bdo konce (kvartalu|ctvrtleti)\b/)) {
    timeframe = timeframeFor("QUARTER_END", now, { includeExpired });
  }
  if (!timeframe) timeframe = mentionsExpired ? timeframeFor("EXPIRED_ONLY", now) : timeframeFor("DEFAULT", now);
  return { timeframe, monthTokens };
}

/** Rozebere českou větu na filtr plánovače revizí. */
export function parsePlanQuery(input: string, now: Date = new Date()): InspectionPlanQuery {
  const text = normalizeCz(input);
  const tokens = tokenize(text);
  const { timeframe, monthTokens } = parseTimeframe(text, tokens, now);

  // Kategorie a souhrnné skupiny
  const groups = GROUPS.filter((group) => tokens.some(({ word }) => tokenMatches(word, group)));
  const covered = new Set(groups.flatMap((group) => group.types));
  const categories: CategoryMatch[] = groups.map(({ key, label, types }) => ({ key, label, types }));
  for (const def of CATEGORIES) {
    const found = tokens.some(({ word }, index) => !monthTokens.has(index) && tokenMatches(word, def));
    if (found && !def.types.every((type) => covered.has(type))) categories.push({ key: def.key, label: def.label, types: def.types });
  }
  const instrumentGroup = groups.length === 1 ? groups[0].group : null;

  // Lokace (s pozicí kvůli spojkám)
  const buildings: (LocationTerm & Mention)[] = [];
  const zones: (LocationTerm & Mention)[] = [];
  for (const match of text.matchAll(/\bhal[aeuy]\s+([a-z0-9])\b/g)) {
    const code = match[1];
    buildings.push({ label: `Hala ${code.toUpperCase()}`, match: `hala ${code}`, start: match.index, end: match.index + match[0].length });
  }
  for (const { word, start, end } of tokens) {
    const building = BUILDING_NAMES.find((def) => tokenMatches(word, def));
    if (building && !buildings.some((entry) => entry.match === building.term.match)) buildings.push({ ...building.term, start, end });
    const zone = ZONES.find((def) => tokenMatches(word, def));
    if (zone && !zones.some((entry) => entry.match === zone.term.match)) zones.push({ ...zone.term, start, end });
  }
  const floors: LocationTerm[] = [];
  const addFloor = (code: string) => {
    if (!floors.some((floor) => floor.match === code)) floors.push({ label: `${code.slice(0, -2)}. ${code.slice(-2)}`, match: code });
  };
  for (const match of text.matchAll(/\b([1-9])\s*(np|pp)\b/g)) addFloor(`${match[1]}${match[2].toUpperCase()}`);
  if (tokens.some(({ word }) => word.startsWith("prizem"))) addFloor("1NP");
  if (tokens.some(({ word }) => word.startsWith("suteren") || word.startsWith("podzem"))) addFloor("1PP");

  // „v kuchyňkách a administrativě“ = buď – nebo; „dílna v Hale A“ = obojí současně.
  const mentions = [...buildings, ...zones].sort((a, b) => a.start - b.start);
  let locationMode: "ALL" | "ANY" = "ALL";
  for (let i = 1; i < mentions.length; i++) {
    const between = text.slice(mentions[i - 1].end, mentions[i].start).trim();
    if (/^((a|nebo|i|ci)( (v|ve|na))?)?$/.test(between) && !/^(v|ve|na)$/.test(between)) locationMode = "ANY";
  }

  const strip = <T extends LocationTerm>(list: T[]): LocationTerm[] => list.map(({ label, match }) => ({ label, match }));
  return withChips({
    text: input,
    timeframe,
    categories,
    types: [],
    instrumentGroup,
    buildingQuery: strip(buildings),
    floorQuery: floors,
    zoneQuery: strip(zones),
    locationMode,
    recognizedChips: [],
  });
}

// ---------------------------------------------------------------------------
//  Odznaky a úpravy dotazu (UI)
// ---------------------------------------------------------------------------

/** Dopočítá sjednocení typů a lidsky čitelné odznaky. */
export function withChips(query: InspectionPlanQuery): InspectionPlanQuery {
  const chips: QueryChip[] = [];
  if (query.timeframe.kind !== "DEFAULT") chips.push({ key: "timeframe", label: query.timeframe.label });
  const any = query.locationMode === "ANY" && query.buildingQuery.length + query.zoneQuery.length > 1;
  for (const building of query.buildingQuery) chips.push({ key: `building:${building.match}`, label: `Lokace: ${building.label}${any ? " (nebo)" : ""}` });
  for (const floor of query.floorQuery) chips.push({ key: `floor:${floor.match}`, label: `Patro: ${floor.label}` });
  for (const zone of query.zoneQuery) chips.push({ key: `zone:${zone.match}`, label: `Zóna: ${zone.label}${any ? " (nebo)" : ""}` });
  for (const category of query.categories) chips.push({ key: `cat:${category.key}`, label: `Kategorie: ${category.label}` });
  return { ...query, types: [...new Set(query.categories.flatMap((category) => category.types))], recognizedChips: chips };
}

/** Odebere kritérium podle klíče odznaku (křížek v UI). */
export function removeChip(query: InspectionPlanQuery, key: string, now: Date = new Date()): InspectionPlanQuery {
  const separator = key.indexOf(":");
  const kind = separator < 0 ? key : key.slice(0, separator);
  const value = separator < 0 ? "" : key.slice(separator + 1);
  const next: InspectionPlanQuery = { ...query };
  if (kind === "timeframe") next.timeframe = timeframeFor("DEFAULT", now);
  if (kind === "building") next.buildingQuery = query.buildingQuery.filter((term) => term.match !== value);
  if (kind === "floor") next.floorQuery = query.floorQuery.filter((term) => term.match !== value);
  if (kind === "zone") next.zoneQuery = query.zoneQuery.filter((term) => term.match !== value);
  if (kind === "cat") {
    next.categories = query.categories.filter((category) => category.key !== value);
    if (value === "portable" || value === "fixed") next.instrumentGroup = null;
  }
  return withChips(next);
}

/** Přepínač období (Po termínu / Tento měsíc / Příští měsíc / Další 3–6 měsíců). */
export function setTimeframe(query: InspectionPlanQuery, kind: TimeframeKind, now: Date = new Date()): InspectionPlanQuery {
  return withChips({ ...query, timeframe: timeframeFor(kind, now, { includeExpired: kind === "THIS_MONTH" || kind === "DEFAULT" }) });
}

/** Přepínač budovy: nahradí budovy v dotazu jednou budovou (nebo je zruší). */
export function setBuilding(query: InspectionPlanQuery, building: LocationTerm | null): InspectionPlanQuery {
  return withChips({ ...query, buildingQuery: building ? [building] : [], locationMode: "ALL" });
}

export const emptyPlanQuery = (now: Date = new Date()) => parsePlanQuery("", now);
