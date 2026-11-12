import { z } from "zod";

import { minInsulationMOhm, type RoutineTest } from "@/lib/legislation-2027";

// Fáze 103: životní cyklus dokumentace rozváděče AI Panel Builderu – DRAFT (rozpracováno) → PENDING_INSPECTION (čeká
// na kusovou zkoušku) → LOCKED_PUBLISHED (uzamčená schválená verze pod QR štítkem). Každé uzamčení vydá novou verzi
// (1.0, 1.1, 1.2 …), předchozí verze zůstanou v archivu jako NEAKTUÁLNÍ (SUPERSEDED). Čisté funkce.

export const DOC_STATES = ["DRAFT", "PENDING_INSPECTION", "LOCKED_PUBLISHED"] as const;
export type DocState = (typeof DOC_STATES)[number];

export const DOC_STATE_LABEL: Record<DocState, string> = {
  DRAFT: "Rozpracováno – odemčeno k editaci",
  PENDING_INSPECTION: "Čeká na kusovou zkoušku a potvrzení revizního technika",
  LOCKED_PUBLISHED: "Uzamčená schválená verze v cloudu",
};

export const VERSION_STATUS = { current: "LOCKED_PUBLISHED", superseded: "SUPERSEDED" } as const;

/** Verze „1.1“ z čísel. */
export const versionLabel = (major: number, minor: number) => `${major}.${minor}`;

/** Další verze: první vydání 1.0, každé další uzamčení zvýší druhé číslo (1.0 → 1.1 → 1.2). */
export function nextVersion(published: readonly { major: number; minor: number }[]): { major: number; minor: number; version: string } {
  if (!published.length) return { major: 1, minor: 0, version: "1.0" };
  const last = [...published].sort((a, b) => b.major - a.major || b.minor - a.minor)[0];
  return { major: last.major, minor: last.minor + 1, version: versionLabel(last.major, last.minor + 1) };
}

/** Štítek verze na kartě a v hlavičce listů. */
export function versionBadge(version: string, status: string, current?: string | null): string {
  return status === VERSION_STATUS.current ? `Verze ${version} – AKTUÁLNÍ` : `⚠️ NEAKTUÁLNÍ VERZE (${version})${current ? ` – NAHRAZENO VERZÍ ${current}` : ""}`;
}

/** Verdikt kusové zkoušky / revize. */
export const VERDICTS = [
  { id: "SAFE", label: "ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU" },
  { id: "UNSAFE", label: "ZAŘÍZENÍ NENÍ SCHOPNÉ BEZPEČNÉHO PROVOZU" },
] as const;

const decimal = (min: number, max: number) => z.coerce.number().refine((value) => Number.isFinite(value) && value >= min && value <= max, `Hodnota mimo rozsah ${min}–${max}.`);

/**
 * Část pro revizního technika (výstupní kusová zkouška): kdo měřil, číslo osvědčení TIČR, datum a naměřené hodnoty.
 * Uzamknout jde jen s verdiktem „schopné bezpečného provozu“ – nevyhovující rozváděč se nevydává.
 */
export const inspectionSchema = z.object({
  inspectorName: z.string().trim().min(3, "Zadejte jméno a příjmení revizního technika.").max(80),
  inspectorCert: z.string().trim().min(3, "Zadejte číslo osvědčení / oprávnění TIČR.").max(60),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum měření."),
  insulationMOhm: decimal(0, 100_000),
  insulationTestVoltage: z.coerce.number().int().refine((value) => [250, 500, 1000].includes(value), "Zkušební napětí 250 / 500 / 1000 V DC."),
  peContinuityOhm: decimal(0, 100),
  loopImpedanceOhm: decimal(0, 100).optional(),
  shortCircuitKa: decimal(0, 200).optional(),
  rcdTripCurrentMa: decimal(0, 1000).optional(),
  rcdTripTimeMs: decimal(0, 1000).optional(),
  mechanicalOk: z.boolean(),
  verdict: z.enum(["SAFE", "UNSAFE"]),
  note: z.string().trim().max(500).optional(),
});
export type InspectionInput = z.input<typeof inspectionSchema>;
export type Inspection = z.output<typeof inspectionSchema>;

/** Měřené hodnoty proti mezím (ČSN EN IEC 61439-1 ed. 3, čl. 11; ČSN 33 2000-6 ed. 2): seznam nevyhovujících bodů. */
export function inspectionIssues(value: Inspection): string[] {
  const issues: string[] = [];
  if (value.insulationMOhm < 1) issues.push(`Izolační odpor ${value.insulationMOhm} MΩ < 1 MΩ.`);
  if (value.peContinuityOhm > 0.1) issues.push(`Spojitost ochranného obvodu ${value.peContinuityOhm} Ω > 0,1 Ω.`);
  if (value.rcdTripTimeMs !== undefined && value.rcdTripTimeMs > 300) issues.push(`Vybavovací čas RCD ${value.rcdTripTimeMs} ms > 300 ms.`);
  if (value.rcdTripCurrentMa !== undefined && value.rcdTripCurrentMa > 30 && value.rcdTripCurrentMa <= 31) issues.push("Vybavovací proud RCD na hranici 30 mA – ověřte.");
  if (!value.mechanicalOk) issues.push("Mechanická funkční zkouška a utahovací momenty nevyhověly.");
  if (value.verdict !== "SAFE") issues.push("Celkový verdikt: zařízení není schopné bezpečného provozu.");
  return issues;
}

/** Řádky protokolu na kartě a ve snímku verze (popis + naměřená hodnota). */
export function inspectionRows(value: Inspection): { label: string; value: string }[] {
  const n = (number: number, digits = 2) => number.toLocaleString("cs-CZ", { maximumFractionDigits: digits });
  const rows = [
    { label: "Izolační odpor Riso", value: `${n(value.insulationMOhm, 1)} MΩ při ${value.insulationTestVoltage} V DC` },
    { label: "Spojitost ochranného obvodu PE", value: `${n(value.peContinuityOhm, 3)} Ω – ${value.peContinuityOhm <= 0.1 ? "VYHOVUJE" : "NEVYHOVUJE"}` },
  ];
  if (value.loopImpedanceOhm !== undefined || value.shortCircuitKa !== undefined) rows.push({ label: "Impedance poruchové smyčky Zs / zkratový proud Ik", value: [value.loopImpedanceOhm !== undefined ? `Zs ${n(value.loopImpedanceOhm, 3)} Ω` : null, value.shortCircuitKa !== undefined ? `Ik ${n(value.shortCircuitKa, 2)} kA` : null].filter(Boolean).join(" · ") });
  if (value.rcdTripCurrentMa !== undefined || value.rcdTripTimeMs !== undefined) rows.push({ label: "Zkouška proudových chráničů RCD", value: [value.rcdTripCurrentMa !== undefined ? `IΔ ${n(value.rcdTripCurrentMa, 1)} mA` : null, value.rcdTripTimeMs !== undefined ? `tA ${n(value.rcdTripTimeMs, 0)} ms` : null].filter(Boolean).join(" · ") });
  rows.push({ label: "Mechanická funkční zkouška a utahovací momenty", value: value.mechanicalOk ? "ANO / VYHOVUJE" : "NEVYHOVUJE" });
  rows.push({ label: "Celkový verdikt", value: VERDICTS.find((verdict) => verdict.id === value.verdict)!.label });
  return rows;
}

// ---------------------------------------------------------------------------
//  Snímek vydané verze (neměnná data elaborátu v cloudu)
// ---------------------------------------------------------------------------

/** JSON snímku zachová i nekonečna a NaN výpočtů (oteplení bez skříně) – JSON.stringify by z nich udělal null. */
export function snapshotStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "number" && !Number.isFinite(item) ? { $num: String(item) } : item));
}

export function snapshotParse<T>(json: string): T {
  return JSON.parse(json, (_key, item) => (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 1 && typeof item.$num === "string" ? Number(item.$num) : item)) as T;
}

/** Měření revizního technika doplní body 11.4 (PE), 11.8 (mechanika) a 11.9 (R_iso) protokolu o kusové zkoušce. */
export function mergeRoutineTest(saved: RoutineTest, value: Inspection): RoutineTest {
  return {
    ...saved,
    points: {
      ...saved.points,
      protection: value.peContinuityOhm <= 0.1 ? "PASS" : "FAIL",
      mechanical: value.mechanicalOk ? "PASS" : "FAIL",
      dielectric: value.insulationMOhm >= minInsulationMOhm() ? "PASS" : "FAIL",
    },
    insulationMOhm: value.insulationMOhm,
    testedBy: `${value.inspectorName}, ${value.inspectorCert}`.slice(0, 120),
    testedAt: value.measuredAt,
    note: value.note?.trim() || saved.note,
  };
}

/** Část revizního technika na Listu kusové zkoušky ve vydané verzi (naměřené hodnoty, verdikt, elektronické potvrzení). */
export interface InspectionBlock {
  inspectorName: string;
  inspectorCert: string;
  measuredAt: string;
  rows: { label: string; value: string }[];
  verdict: string;
  note: string | null;
  confirmedAt: string;
  version: string;
}

export function inspectionBlock(value: Inspection, version: string, confirmedAt: Date): InspectionBlock {
  return {
    inspectorName: value.inspectorName,
    inspectorCert: value.inspectorCert,
    measuredAt: value.measuredAt,
    rows: inspectionRows(value),
    verdict: VERDICTS.find((verdict) => verdict.id === value.verdict)!.label,
    note: value.note?.trim() || null,
    confirmedAt: confirmedAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    version,
  };
}

/** Verze zobrazovaného snímku – v hlavičce každého listu (aktuální / NEAKTUÁLNÍ s vodoznakem). */
export interface DocVersionMark {
  version: string;
  current: boolean;
  supersededBy: string | null;
}

/** Datum „2026-11-12“ → „12. 11. 2026“. */
export const czDate = (iso: string | Date) => {
  const date = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso) : iso;
  return date.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" });
};
