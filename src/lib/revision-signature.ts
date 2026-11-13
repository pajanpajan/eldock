import { z } from "zod";

import type { InspectionResult } from "@/generated/prisma/enums";

import type { InspectorScope } from "./inspector-certificate";

// Fáze 108: podepsaná revize revizního technika – profil technika, rychlé hodnoty měření, kanonický obsah
// kryptografické pečeti SHA-256, grafické razítko, časové razítko UTC / SEČ a rozpoznání podpisu PAdES.
// Právní rámec (bez nadsázky): vrstva A = prostý elektronický podpis (eIDAS čl. 25 odst. 1 – nelze mu upřít
// právní účinky jen proto, že je elektronický) s pečetí obsahu; vrstva B = kvalifikovaný elektronický podpis
// PAdES technika (eIDAS čl. 25 odst. 2, zákon č. 297/2016 Sb.) připojený k uzamčenému protokolu.
// Modul je izomorfní (formulář v prohlížeči i server); hash počítá jen server (node:crypto).

export const SEAL_VERSION = 1;

export const SIGNABLE_TYPES = ["PERIODIC", "INITIAL", "EXTRAORDINARY"] as const;
export type SignableType = (typeof SIGNABLE_TYPES)[number];
export const SIGNABLE_TYPE_LABELS: Record<SignableType, string> = {
  PERIODIC: "Pravidelná (periodická)",
  INITIAL: "Výchozí",
  EXTRAORDINARY: "Mimořádná (po opravě / změně)",
};

/** Lhůta příští revize v letech (ČSN 33 1500 / NV 190/2022 Sb., příloha č. 4); `null` = podle lhůty zařízení. */
export const INTERVAL_YEARS = [1, 2, 3, 4] as const;

export const VERDICT_TEXT: Record<InspectionResult, string> = {
  CAPABLE: "ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU",
  CAPABLE_WITH_DEFECTS: "ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU ZA PODMÍNKY ODSTRANĚNÍ ZJIŠTĚNÝCH ZÁVAD",
  INCAPABLE: "ZAŘÍZENÍ NENÍ SCHOPNÉ BEZPEČNÉHO PROVOZU",
};
export const NO_DEFECTS_TEXT = "Bez zjištěných závad";
export const MISUSE_BANNER = "⛔ POZOR: REVIZNÍ TECHNIK ZNEPLATNIL TENTO ZÁZNAM PRO PODEZŘENÍ ZE ZNEUŽITÍ OSVĚDČENÍ TIČR";

// ---------------------------------------------------------------------------
//  Profil revizního technika
// ---------------------------------------------------------------------------

export const PIN_PATTERN = /^\d{4,8}$/;
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 15;

/**
 * Klíč čísla osvědčení pro párování záznamů: velká písmena, bez mezer, jednotné pomlčky a lomítka,
 * bez přípony rozsahu „(E2A)“ a předpony „TIČR č.“.
 */
export function certificateKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\((?:[^)]*)\)\s*$/, "")
    .replace(/^\s*(?:ti[čc]r|osv(?:ědčení|edceni)?\.?)\s*(?:(?:č|c|no)\.\s*)?/i, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);
const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || null);

export const SCOPE_VALUES = ["E1A", "E1B", "E2A", "E2B", "E3A", "E3B"] as const satisfies readonly InspectorScope[];

/** Profil technika závodu (formulář i serverová akce). PIN se zadává při založení, změna PINu vyžaduje současný. */
export const inspectorProfileSchema = z.object({
  inspectorProfileId: z.string().min(1).max(64).optional().nullable(),
  plantId: z.string().min(1).max(64),
  name: z.string().trim().min(3, "Vyplňte jméno a příjmení technika.").max(120),
  company: optionalText(160),
  ico: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "IČO má 8 číslic.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .email("Neplatný e-mail.")
    .max(160)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => value || null),
  certificateNo: z.string().trim().min(3, "Vyplňte evidenční číslo osvědčení TIČR.").max(60),
  certificateScope: z.enum(SCOPE_VALUES).optional().nullable(),
  certificateValidUntil: optionalDay,
  authorizationNo: optionalText(60),
  instrument: optionalText(200),
  calibrationNo: optionalText(80),
  calibrationValidUntil: optionalDay,
  monthlyEmail: z.boolean().optional(),
  pin: z.string().regex(PIN_PATTERN, "PIN má 4–8 číslic.").optional().nullable(),
  currentPin: z.string().regex(PIN_PATTERN, "PIN má 4–8 číslic.").optional().nullable(),
});
export type InspectorProfileInput = z.input<typeof inspectorProfileSchema>;

/** Profil pro formulář (bez otisku PINu). */
export interface InspectorProfileView {
  id: string;
  plantId: string;
  name: string;
  company: string | null;
  ico: string | null;
  phone: string | null;
  email: string | null;
  certificateNo: string;
  certificateScope: InspectorScope | null;
  certificateValidUntil: string | null;
  authorizationNo: string | null;
  instrument: string | null;
  calibrationNo: string | null;
  calibrationValidUntil: string | null;
  signatureUrl: string | null;
  monthlyEmail: boolean;
  locked: boolean;
}

/** Text měřicího přístroje do protokolu: „Metrel … · Kalibrační list č. KL-… · platnost do 10/2027“. */
export function instrumentText(profile: Pick<InspectorProfileView, "instrument" | "calibrationNo" | "calibrationValidUntil">): string | null {
  if (!profile.instrument) return null;
  const until = profile.calibrationValidUntil ? `${profile.calibrationValidUntil.slice(5, 7)}/${profile.calibrationValidUntil.slice(0, 4)}` : null;
  return [profile.instrument, profile.calibrationNo ? `Kalibrační list č. ${profile.calibrationNo}` : null, until ? `platnost do ${until}` : null].filter(Boolean).join(", ");
}

/** Řádky grafického razítka revizního technika. */
export function stampLines(profile: { name: string; certificateNo: string; certificateScope?: string | null; authorizationNo?: string | null; company?: string | null }) {
  return {
    title: "REVIZNÍ TECHNIK",
    name: profile.name,
    certificate: `Osv. TIČR č. ${profile.certificateNo}`,
    scope: profile.certificateScope ? `Rozsah ${profile.certificateScope}` : null,
    authorization: profile.authorizationNo ? `Opr. TIČR č. ${profile.authorizationNo}` : null,
    company: profile.company ?? null,
  };
}

// ---------------------------------------------------------------------------
//  Rychlé hodnoty měření
// ---------------------------------------------------------------------------

export const RCD_TYPES = ["AC", "A", "F", "B"] as const;

export interface SignedMeasurements {
  /** R_iso [MΩ] */
  insulationResistance: number | null;
  /** Zkušební napětí R_iso [V DC] */
  insulationTestVoltage: number | null;
  /** Přístroj ukázal hodnotu nad měřicím rozsahem („> 500 MΩ“). */
  insulationAbove: boolean;
  /** Spojitost PE a pospojování [Ω] */
  protectiveConductorResistance: number | null;
  /** Impedance poruchové smyčky Z_s [Ω] */
  loopImpedance: number | null;
  /** Zkratový proud I_k [A] */
  shortCircuitA: number | null;
  /** RCD I_Δn [mA] */
  rcdRatedMa: number | null;
  /** RCD vybavovací čas t_A [ms] */
  rcdTripTimeMs: number | null;
  rcdType: (typeof RCD_TYPES)[number];
  /** Kontrola oteplení / termovize a dotažení spojů – VYHOVUJE */
  connectionsOk: boolean | null;
}

/** Jmenovité napětí proti zemi U₀ [V] pro výpočet I_k = U₀ / Z_s. */
export const NOMINAL_U0 = 230;
export const shortCircuitFromLoop = (loopOhm: number | null) => (loopOhm && loopOhm > 0 ? Math.round(NOMINAL_U0 / loopOhm) : null);

/**
 * „✨ Předvyplnit standardní vyhovující hodnoty“ – šablona, kterou technik přepíše čísly z přístroje.
 * Nejsou to naměřené hodnoty: před podpisem technik potvrzuje, že údaje odpovídají skutečnému měření.
 */
export const STANDARD_MEASUREMENTS: SignedMeasurements = {
  insulationResistance: 500,
  insulationTestVoltage: 500,
  insulationAbove: true,
  protectiveConductorResistance: 0.05,
  loopImpedance: 0.35,
  shortCircuitA: shortCircuitFromLoop(0.35),
  rcdRatedMa: 30,
  rcdTripTimeMs: 18,
  rcdType: "A",
  connectionsOk: true,
};

export const EMPTY_MEASUREMENTS: SignedMeasurements = {
  insulationResistance: null,
  insulationTestVoltage: 500,
  insulationAbove: false,
  protectiveConductorResistance: null,
  loopImpedance: null,
  shortCircuitA: null,
  rcdRatedMa: null,
  rcdTripTimeMs: null,
  rcdType: "A",
  connectionsOk: null,
};

/** Hodnoty jsou beze změny převzaté ze šablony (formulář na to upozorní). */
export const isStandardTemplate = (values: SignedMeasurements) =>
  (Object.keys(STANDARD_MEASUREMENTS) as (keyof SignedMeasurements)[]).every((key) => values[key] === STANDARD_MEASUREMENTS[key]);

const decimal = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

/** Soupis měření do zprávy (§ 10 odst. 1 písm. i – soupis provedených úkonů s výsledky). */
export function measurementLines(values: SignedMeasurements): string[] {
  const lines: string[] = [];
  if (values.insulationResistance !== null) {
    lines.push(`Izolační odpor R_iso ${values.insulationAbove ? "> " : ""}${decimal(values.insulationResistance, 1)} MΩ${values.insulationTestVoltage ? ` při ${values.insulationTestVoltage} V DC` : ""}`);
  }
  if (values.protectiveConductorResistance !== null) lines.push(`Spojitost ochranného vodiče a pospojování PE ${decimal(values.protectiveConductorResistance, 3)} Ω`);
  if (values.loopImpedance !== null || values.shortCircuitA !== null) {
    lines.push(
      [values.loopImpedance !== null ? `Impedance poruchové smyčky Z_s ${decimal(values.loopImpedance, 3)} Ω` : null, values.shortCircuitA !== null ? `zkratový proud I_k ${decimal(values.shortCircuitA, 0)} A` : null]
        .filter(Boolean)
        .join(" / "),
    );
  }
  if (values.rcdRatedMa !== null || values.rcdTripTimeMs !== null) {
    lines.push(`Zkouška proudového chrániče RCD typ ${values.rcdType}: I_Δn ${values.rcdRatedMa ?? "–"} mA, vybavovací čas t_A ${values.rcdTripTimeMs ?? "–"} ms`);
  }
  if (values.connectionsOk !== null) lines.push(`Kontrola oteplení / termovize a dotažení spojů: ${values.connectionsOk ? "VYHOVUJE" : "NEVYHOVUJE"}`);
  return lines;
}

// ---------------------------------------------------------------------------
//  Kryptografická pečeť (kanonický obsah)
// ---------------------------------------------------------------------------

/** Sloupce jednoho záznamu, které pečeť chrání (hodnoty přesně tak, jak leží v databázi). */
export interface SealRecord {
  equipmentId: string;
  type: string;
  inspectionDate: Date;
  validUntil: Date;
  reportNumber: string;
  result: string;
  defectsSummary: string | null;
  measuringInstrument: string | null;
  calibrationRef: string | null;
  insulationResistance: number | null;
  protectiveConductorResistance: number | null;
  rcdTestJson: string | null;
  shortCircuitA: number | null;
  connectionsOk: boolean | null;
  actsPerformed: string | null;
  inspectorName: string;
  inspectorLicense: string;
  inspectorScope: string | null;
  inspectorAuthorization: string | null;
  inspectorCompany: string | null;
  inspectorIco: string | null;
  signatureUrl: string | null;
  signedAt: Date | null;
  signedIp: string | null;
  signedDevice: string | null;
  pinVerified: boolean;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * Kanonický text pečeti protokolu: pevné pořadí klíčů, záznamy podle id zařízení. Z týchž sloupců ho kdykoli
 * znovu sestaví ověření – jakákoli změna údaje, měření, technika, času nebo IP změní otisk SHA-256.
 */
export function sealPayload(records: readonly SealRecord[], version = SEAL_VERSION): string {
  const sorted = [...records].sort((a, b) => (a.equipmentId < b.equipmentId ? -1 : a.equipmentId > b.equipmentId ? 1 : 0));
  const head = sorted[0];
  return JSON.stringify({
    v: version,
    protocol: head?.reportNumber ?? null,
    inspector: head
      ? {
          name: head.inspectorName,
          certificate: head.inspectorLicense,
          scope: head.inspectorScope,
          authorization: head.inspectorAuthorization,
          company: head.inspectorCompany,
          ico: head.inspectorIco,
        }
      : null,
    signature: head ? { image: head.signatureUrl, at: iso(head.signedAt), ip: head.signedIp, device: head.signedDevice, pin: head.pinVerified } : null,
    records: sorted.map((record) => ({
      equipment: record.equipmentId,
      type: record.type,
      date: iso(record.inspectionDate),
      validUntil: iso(record.validUntil),
      report: record.reportNumber,
      result: record.result,
      defects: record.defectsSummary,
      instrument: record.measuringInstrument,
      calibration: record.calibrationRef,
      riso: record.insulationResistance,
      rpe: record.protectiveConductorResistance,
      rcd: record.rcdTestJson,
      ik: record.shortCircuitA,
      connections: record.connectionsOk,
      acts: record.actsPerformed,
    })),
  });
}

/** Zkrácený otisk pro tabulky „3f9a…c21e“. */
export const shortHash = (hash: string | null | undefined) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "–");

const PRAGUE_TIME = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

/** Časové razítko podpisu: UTC i středoevropský čas (SEČ / SELČ). */
export function sealTimestamp(date: Date): { utc: string; local: string } {
  return { utc: `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`, local: PRAGUE_TIME.format(date) };
}

/** Krátký popis zařízení při podpisu z User-Agent („Chrome · Windows“). */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Prohlížeč";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "neznámý systém";
  const mobile = /Mobile|iPhone|Android/.test(ua) ? " (mobil)" : "";
  return `${browser} · ${os}${mobile}`;
}

// ---------------------------------------------------------------------------
//  Vrstva B – PAdES
// ---------------------------------------------------------------------------

export const PADES_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Rozpozná PDF s elektronickým podpisem (slovník podpisu s /ByteRange a /SubFilter PAdES / PKCS#7).
 * Platnost certifikátu a důvěryhodnost (kvalifikovaný certifikát) se tím neověřuje – to dělá ověřovací software.
 */
export function detectPades(bytes: Uint8Array): { pdf: boolean; signatures: number; subFilter: string | null } {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  const pdf = head.startsWith("%PDF-");
  if (!pdf) return { pdf: false, signatures: 0, subFilter: null };
  const text = new TextDecoder("latin1").decode(bytes);
  const signatures = (text.match(/\/ByteRange\s*\[/g) ?? []).length;
  const sub = /\/SubFilter\s*\/(ETSI\.CAdES\.detached|adbe\.pkcs7\.detached|adbe\.pkcs7\.sha1|ETSI\.RFC3161)/.exec(text);
  return { pdf, signatures, subFilter: sub ? sub[1] : null };
}

// ---------------------------------------------------------------------------
//  Měsíční report TIČR
// ---------------------------------------------------------------------------

const MONTHS = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

export const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** „2026-11“ → „Listopad 2026“. */
export function monthLabel(month: string): string {
  const match = MONTH_PATTERN.exec(month);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : month;
}

/** Posun pražského času od UTC [ms] v daném okamžiku. */
function pragueOffset(at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(at))
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - at;
}

const pragueMidnight = (year: number, monthIndex: number) => {
  const guess = Date.UTC(year, monthIndex, 1);
  return new Date(guess - pragueOffset(guess));
};

/** Hranice měsíce v pražském čase jako okamžiky UTC [from, to). */
export function monthRange(month: string): { from: Date; to: Date } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error("Neplatný měsíc.");
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return { from: pragueMidnight(year, index), to: pragueMidnight(index === 11 ? year + 1 : year, (index + 1) % 12) };
}

/** Pražský měsíc „YYYY-MM“ okamžiku a měsíc před ním. */
export function pragueMonth(date: Date): string {
  const shifted = new Date(date.getTime() + pragueOffset(date.getTime()));
  return shifted.toISOString().slice(0, 7);
}

export function previousMonth(month: string): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error("Neplatný měsíc.");
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return index === 0 ? `${year - 1}-12` : `${year}-${String(index).padStart(2, "0")}`;
}
