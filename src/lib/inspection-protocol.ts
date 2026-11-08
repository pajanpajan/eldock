// Revizní protokol (tisk / PDF) ve dvou variantách: VTZ a pevná zařízení (zákon 250/2021 Sb., NV 190/2022 Sb.,
// ČSN 33 1500, ČSN 33 2000-6) a elektrospotřebiče / nářadí (ČSN 33 1600 ed. 2).

import type { EquipmentType, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import { inspectionRuleFor, isPortable, measurementLimits, type RuleInput } from "@/lib/inspection-rules";
import { batteryPassportRows, parseBatteryPassport } from "@/lib/battery-passport";
import { parseRcdTest, rcdTestRows } from "@/lib/rcd-test";

export type ProtocolVariant = "VTZ" | "APPLIANCE";

export interface ProtocolMeasurement {
  label: string;
  symbol: string;
  value: string;
  limit: string;
  /** `null` = neměřilo se / nehodnotí se. */
  ok: boolean | null;
}

export interface ProtocolInput {
  record: {
    type: InspectionType;
    result: InspectionResult;
    protectiveConductorResistance: number | null;
    insulationResistance: number | null;
    leakageCurrent: number | null;
    functionalTest: boolean | null;
    /** Fáze 52: zkoušky RCD (JSON `lib/rcd-test.ts`). */
    rcdTestJson?: string | null;
  };
  equipment: { type: EquipmentType; usageGroup: string | null; protectionClass: string | null; externalInfluences?: string | null };
}

const num = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 });

/** Max. unikající (ochranný / rozdílový) proud I_PE / I_Δ dle ČSN 33 1600 ed. 2 [mA]. */
export const leakageLimitMa = (protectionClass: string | null) => (protectionClass === "II" || protectionClass === "III" ? 0.5 : 3.5);

export const protocolVariant = (type: EquipmentType): ProtocolVariant => (isPortable(type) ? "APPLIANCE" : "VTZ");

export const PROTOCOL_TITLES: Record<ProtocolVariant, { title: string; basis: string }> = {
  VTZ: {
    title: "Zpráva o revizi elektrického zařízení",
    basis: "Vyhrazené technické zařízení elektrické · zákon 250/2021 Sb. · NV 190/2022 Sb. · ČSN 33 1500 · ČSN 33 2000-6 ed. 2",
  },
  APPLIANCE: {
    title: "Protokol o revizi elektrického spotřebiče",
    basis: "Revize a kontrola elektrických spotřebičů a nářadí dle ČSN 33 1600 ed. 2",
  },
};

export const VERDICTS: Record<InspectionResult, string> = {
  CAPABLE: "Zařízení je schopno bezpečného provozu.",
  CAPABLE_WITH_DEFECTS: "Zařízení je schopno bezpečného provozu s výhradou odstranění uvedených závad v termínu.",
  INCAPABLE: "Zařízení není schopno bezpečného provozu – vyřadit z provozu až do odstranění závad.",
};

/** Tabulka naměřených hodnot s mezními hodnotami a vyhodnocením. */
export function protocolMeasurements({ record, equipment }: ProtocolInput): ProtocolMeasurement[] {
  const variant = protocolVariant(equipment.type);
  const limits = measurementLimits(equipment.protectionClass);
  const rpeMax = variant === "APPLIANCE" ? limits.rpeMax : 0.5;
  const risoMin = variant === "APPLIANCE" ? limits.risoMin : 1;
  const leakageMax = leakageLimitMa(equipment.protectionClass);
  const rpe = record.protectiveConductorResistance;
  const riso = record.insulationResistance;
  const leakage = record.leakageCurrent;
  const rcdTest = parseRcdTest(record.rcdTestJson);

  return [
    {
      label: "Odpor ochranného vodiče",
      symbol: "R_PE",
      value: rpe === null ? "–" : `${num(rpe)} Ω`,
      limit: rpeMax === null ? "neměří se (třída II/III)" : `≤ ${num(rpeMax)} Ω`,
      ok: rpe === null || rpeMax === null ? null : rpe <= rpeMax,
    },
    {
      label: "Izolační odpor",
      symbol: "R_iso",
      value: riso === null ? "–" : `${num(riso)} MΩ`,
      limit: `≥ ${num(risoMin)} MΩ`,
      ok: riso === null ? null : riso >= risoMin,
    },
    {
      label: variant === "APPLIANCE" ? "Unikající proud (ochranný / rozdílový)" : "Unikající / rozdílový proud",
      symbol: "I_PE / I_Δ",
      value: leakage === null ? "–" : `${num(leakage)} mA`,
      limit: `≤ ${num(leakageMax)} mA`,
      ok: leakage === null ? null : leakage <= leakageMax,
    },
    {
      label: "Funkční zkouška",
      symbol: "—",
      value: record.functionalTest === null ? "neprováděla se" : record.functionalTest ? "vyhovuje" : "nevyhovuje",
      limit: "bez závad",
      ok: record.functionalTest,
    },
    // Fáze 52: 3 zkoušky proudového chrániče dle ČSN EN 61557-6 ed. 2 + impedance smyčky (jen VTZ)
    ...(variant !== "APPLIANCE" && rcdTest ? rcdTestRows(rcdTest) : []),
  ];
}

/** Hlavní údaje o rozsahu revize: předpis a nejdelší lhůta podle pravidla zařízení (vč. budovy – fáze 66). */
export function protocolScope(input: RuleInput) {
  const rule = inspectionRuleFor(input);
  return { standard: rule.standard, basis: rule.basis, months: rule.months, maxMonths: rule.maxMonths, kind: rule.kind, binding: rule.binding };
}

/** Celé měsíce mezi datem revize a platností (doporučená lhůta příští revize, § 10 odst. 1 písm. n). */
export const monthsBetween = (from: Date, to: Date) => (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();

/** Sekce „Digitální pas baterie“ (Nařízení (EU) 2023/1542) u UPS / BESS – řádky protokolu, jinak null. */
export function protocolBatteryPassport(equipment: { batteryPassportJson?: string | null }): [string, string][] | null {
  const passport = parseBatteryPassport(equipment.batteryPassportJson);
  return passport ? batteryPassportRows(passport) : null;
}
