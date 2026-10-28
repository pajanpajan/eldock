import type { InspectionResult, InspectionType } from "@/generated/prisma/enums";

// Lhůtník elektrorevizí (ČSN 33 1500): výpočet platnosti a stavu revize. Čisté funkce
// bez Prismy – používá je seed, služby, dotazy i UI. Dny se počítají jako kalendářní
// dny v pásmu Europe/Prague, aby server i klient ukázaly stejný odpočet.

/** Revize končící do tolika dnů je „blíží se konec platnosti“ (🟡). */
export const INSPECTION_WARNING_DAYS = 30;

/** Výchozí lhůta pravidelné revize (ČSN 33 1500, normální prostředí). */
export const DEFAULT_INSPECTION_INTERVAL_MONTHS = 36;

/** Obvyklá platnost termovizního měření. */
export const THERMOVISION_INTERVAL_MONTHS = 12;

/** Lhůtu pravidelné revize určuje výchozí nebo pravidelná revize; mimořádná a termovize ji neposouvají. */
export const DEADLINE_TYPES: readonly InspectionType[] = ["INITIAL", "PERIODIC"];

/** FAILED = poslední revize „Neschopno bezpečného provozu“ (vyřazeno z provozu) bez ohledu na datum. */
export type InspectionState = "VALID" | "EXPIRING" | "EXPIRED" | "FAILED" | "MISSING";

/** Stavy, na které upozorňuje hlídač, pin a filtr „⚠️“. */
export const ATTENTION_STATES: readonly InspectionState[] = ["FAILED", "EXPIRED", "EXPIRING"];
export const needsAttention = (state: InspectionState) => ATTENTION_STATES.includes(state);

const DAY_MS = 24 * 3600 * 1000;

const pragueDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalendářní den v Praze jako UTC půlnoc (pro rozdíly ve dnech). */
function pragueDay(date: Date | string | number): number {
  const [year, month, day] = pragueDate.format(new Date(date)).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Přičte měsíce; přetečení konce měsíce se zarovná na poslední den (31. 1. + 1 = 28./29. 2.). */
export function addMonths(date: Date | string | number, months: number): Date {
  const source = new Date(date);
  const result = new Date(source);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return result;
}

/** Platnost revize = datum revize + lhůta v měsících. */
export function computeValidUntil(inspectionDate: Date | string | number, intervalMonths: number): Date {
  if (!Number.isInteger(intervalMonths) || intervalMonths <= 0) throw new RangeError("Lhůta revize musí být kladný počet měsíců.");
  return addMonths(inspectionDate, intervalMonths);
}

/** Dnešní den v Praze jako `YYYY-MM-DD` (výchozí hodnota pro datum revize). */
export const pragueToday = (now: Date | number = new Date()) => pragueDate.format(new Date(now));

/** Počet kalendářních dnů od `now` do `target` (záporný = už uplynulo). */
export function daysUntil(target: Date | string | number, now: Date | string | number = new Date()): number {
  return Math.round((pragueDay(target) - pragueDay(now)) / DAY_MS);
}

export interface InspectionLike {
  type: InspectionType;
  inspectionDate: Date;
  validUntil: Date;
  result?: InspectionResult;
}

/** Revize, která určuje lhůtu: nejnovější výchozí / pravidelná. */
export function governingInspection<T extends InspectionLike>(records: readonly T[]): T | null {
  let latest: T | null = null;
  for (const record of records) {
    if (!DEADLINE_TYPES.includes(record.type)) continue;
    if (!latest || record.inspectionDate.getTime() > latest.inspectionDate.getTime()) latest = record;
  }
  return latest;
}

/** Nejnovější záznam daného typu (např. poslední termovize). */
export function latestOfType<T extends InspectionLike>(records: readonly T[], type: InspectionType): T | null {
  let latest: T | null = null;
  for (const record of records) {
    if (record.type !== type) continue;
    if (!latest || record.inspectionDate.getTime() > latest.inspectionDate.getTime()) latest = record;
  }
  return latest;
}

export function inspectionStateFor(validUntil: Date | null, now: Date | number = new Date(), warningDays = INSPECTION_WARNING_DAYS): InspectionState {
  if (!validUntil) return "MISSING";
  const days = daysUntil(validUntil, now);
  if (days < 0) return "EXPIRED";
  if (days <= warningDays) return "EXPIRING";
  return "VALID";
}

export interface InspectionSummary {
  state: InspectionState;
  validUntil: Date | null;
  /** Dny do konce platnosti (záporné = po termínu); `null` bez revize. */
  daysLeft: number | null;
  result: InspectionResult | null;
}

/** Stav elektrorevize zařízení podle jeho revizních záznamů. */
export function summarizeInspections(records: readonly InspectionLike[], now: Date | number = new Date(), warningDays = INSPECTION_WARNING_DAYS): InspectionSummary {
  const governing = governingInspection(records);
  if (!governing) return { state: "MISSING", validUntil: null, daysLeft: null, result: null };
  return {
    state: governing.result === "INCAPABLE" ? "FAILED" : inspectionStateFor(governing.validUntil, now, warningDays),
    validUntil: governing.validUntil,
    daysLeft: daysUntil(governing.validUntil, now),
    result: governing.result ?? null,
  };
}

/** Pořadí naléhavosti pro hlídač termínů (propadlé nahoře, pak nejdřív končící). */
export function compareByUrgency(a: InspectionSummary, b: InspectionSummary): number {
  const rank: Record<InspectionState, number> = { FAILED: 0, EXPIRED: 1, EXPIRING: 2, VALID: 3, MISSING: 4 };
  return rank[a.state] - rank[b.state] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
}

/** Výchozí platnost nového záznamu podle typu revize a lhůty zařízení. */
export function defaultValidityMonths(type: InspectionType, equipmentIntervalMonths: number): number {
  return type === "THERMOVISION" ? THERMOVISION_INTERVAL_MONTHS : equipmentIntervalMonths;
}
