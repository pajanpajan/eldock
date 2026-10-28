import type { EquipmentType } from "@/generated/prisma/enums";

import { computeValidUntil, DEFAULT_INSPECTION_INTERVAL_MONTHS } from "./inspection";

// Pravidla revizních lhůt podle druhu zařízení a normy. Čisté funkce – používá je seed
// (výchozí `inspectionIntervalMonths`), služby (platnost nového záznamu) i UI (popisky norem,
// lehká karta, meze měření v rychlé revizi). Hodnoty jsou zjednodušené tabulky norem pro demo.

export type UsageGroup = "A" | "B" | "C" | "D" | "E";
export type ProtectionClass = "I" | "II" | "III";

export interface RuleInput {
  type: EquipmentType;
  usageGroup?: string | null;
  protectionClass?: string | null;
  externalInfluences?: string | null;
}

export interface InspectionRule {
  months: number;
  /** Krátké označení normy do popisků („ČSN 33 1600 ed. 2“). */
  standard: string;
  /** Zdůvodnění lhůty pro tooltip a dialog. */
  basis: string;
}

export const USAGE_GROUP_LABELS: Record<UsageGroup, string> = {
  A: "Skupina A – půjčovny (před každým vydáním)",
  B: "Skupina B – stavby, venkovní práce",
  C: "Skupina C – průmysl, řemesla",
  D: "Skupina D – veřejné prostory, školy",
  E: "Skupina E – administrativa, domácnost",
};

/** Spotřebiče a revizní zařízení: lehká karta bez schématu, kusovníku, 3D a historie změn. */
export const LIGHT_CARD_TYPES: readonly EquipmentType[] = [
  "POWER_TOOL",
  "APPLIANCE",
  "EXTENSION_CORD",
  "WELDER",
  "LIGHTNING_ROD",
  "EMERGENCY_LIGHTING",
];

/** Přenosná zařízení měřená v rychlé revizi (R_PE, R_iso). */
export const PORTABLE_TYPES: readonly EquipmentType[] = ["POWER_TOOL", "APPLIANCE", "EXTENSION_CORD", "WELDER"];

export const isLightCard = (type: EquipmentType) => LIGHT_CARD_TYPES.includes(type);
export const isPortable = (type: EquipmentType) => PORTABLE_TYPES.includes(type);

const parseGroup = (value: string | null | undefined): UsageGroup =>
  value && /^[A-E]$/.test(value.trim().toUpperCase()) ? (value.trim().toUpperCase() as UsageGroup) : "C";

/** Kódy vnějších vlivů z textu protokolu („AA5, AD2, BE3 – …“). */
export function parseInfluences(text: string | null | undefined): Set<string> {
  return new Set((text ?? "").toUpperCase().match(/\b[A-C][A-S]\d\b/g) ?? []);
}

/** ČSN 33 1500, tab. 1 (zjednodušeně): lhůta pravidelné revize VTZ podle prostředí. */
export function fixedInstallationRule(externalInfluences: string | null | undefined): InspectionRule {
  const standard = "ČSN 33 1500";
  if (!externalInfluences?.trim()) {
    return { months: DEFAULT_INSPECTION_INTERVAL_MONTHS, standard, basis: "Vnější vlivy neurčeny – konzervativně 3 roky." };
  }
  const codes = parseInfluences(externalInfluences);
  const has = (...list: string[]) => list.some((code) => codes.has(code));
  if (has("BE3", "AD4", "AD5", "AD6", "AD7", "AD8")) return { months: 12, standard, basis: "Prostory s nebezpečím výbuchu nebo mokré – 1 rok." };
  if (has("BE2", "AF3", "AF4")) return { months: 24, standard, basis: "Prostory s nebezpečím požáru nebo korozní agresivitou – 2 roky." };
  if (has("AD2", "AD3", "AE4", "AE5", "AE6", "AA6", "AA7", "AA1", "AA2")) {
    return { months: 36, standard, basis: "Prostory vlhké, prašné, horké nebo studené – 3 roky." };
  }
  return { months: 60, standard, basis: "Prostory normální – 5 let." };
}

/** ČSN 33 1600 ed. 2, tab. 1 (zjednodušeně) – měsíce podle skupiny užívání. */
const APPLIANCE_TABLE: Record<"POWER_TOOL" | "APPLIANCE" | "EXTENSION_CORD", Record<UsageGroup, number>> = {
  POWER_TOOL: { A: 3, B: 3, C: 12, D: 12, E: 24 },
  APPLIANCE: { A: 6, B: 6, C: 24, D: 24, E: 24 },
  EXTENSION_CORD: { A: 3, B: 3, C: 12, D: 12, E: 24 },
};

const KIND_LABEL: Record<keyof typeof APPLIANCE_TABLE, string> = {
  POWER_TOOL: "Ruční elektrické nářadí",
  APPLIANCE: "Nepřipevněný spotřebič",
  EXTENSION_CORD: "Prodlužovací přívod",
};

/** Doporučená lhůta revize a norma pro dané zařízení. */
export function inspectionRuleFor(input: RuleInput): InspectionRule {
  switch (input.type) {
    case "SWITCHBOARD":
    case "TRANSFORMER":
      return fixedInstallationRule(input.externalInfluences);
    case "MACHINE":
    case "CNC_MACHINE":
    case "PRODUCTION_LINE":
    case "ROBOT_CELL":
    case "HVAC_UNIT":
    case "COMPRESSOR":
      return { months: 12, standard: "NV 378/2001 Sb.", basis: "Elektrické zařízení stroje – kontrola 1× ročně (ČSN EN 60204-1)." };
    case "POWER_TOOL":
    case "APPLIANCE":
    case "EXTENSION_CORD": {
      const group = parseGroup(input.usageGroup);
      const months = APPLIANCE_TABLE[input.type][group];
      const protection = input.protectionClass ? `, třída ${input.protectionClass}` : "";
      return { months, standard: "ČSN 33 1600 ed. 2", basis: `${KIND_LABEL[input.type]}, skupina ${group}${protection} – ${months} měsíců.` };
    }
    case "WELDER":
      return { months: 12, standard: "ČSN EN 60974-4", basis: "Zařízení pro obloukové svařování – periodická kontrola 1× ročně." };
    case "LIGHTNING_ROD":
      return { months: 48, standard: "ČSN EN 62305-3", basis: "Hromosvod LPS třídy III – úplná revize 1× za 4 roky." };
    case "EMERGENCY_LIGHTING":
      return { months: 12, standard: "ČSN EN 50172", basis: "Nouzové osvětlení – roční zkouška plné doby funkce." };
    case "OTHER":
      return { months: DEFAULT_INSPECTION_INTERVAL_MONTHS, standard: "ČSN 33 1500", basis: "Výchozí lhůta 3 roky." };
  }
}

/** Platnost nové revize: datum + lhůta zařízení (nebo doporučená lhůta podle pravidla). */
export function nextValidUntil(inspectionDate: Date, input: RuleInput & { inspectionIntervalMonths?: number | null }): Date {
  return computeValidUntil(inspectionDate, input.inspectionIntervalMonths ?? inspectionRuleFor(input).months);
}

// ---------------------------------------------------------------------------
//  Meze měření (ČSN 33 1600 ed. 2, čl. 5.4 – zjednodušeně)
// ---------------------------------------------------------------------------

export interface MeasurementLimits {
  /** Max. odpor ochranného vodiče R_PE [Ω]; `null` = neměří se (třída II / III). */
  rpeMax: number | null;
  /** Min. izolační odpor R_iso [MΩ]. */
  risoMin: number;
  /** Typické hodnoty pro předvyplnění formuláře. */
  typical: { rpe: number | null; riso: number };
}

const parseClass = (value: string | null | undefined): ProtectionClass =>
  value === "II" || value === "III" ? value : "I";

export function measurementLimits(protectionClass: string | null | undefined): MeasurementLimits {
  switch (parseClass(protectionClass)) {
    case "I":
      return { rpeMax: 0.3, risoMin: 1, typical: { rpe: 0.12, riso: 250 } };
    case "II":
      return { rpeMax: null, risoMin: 2, typical: { rpe: null, riso: 300 } };
    case "III":
      return { rpeMax: null, risoMin: 0.25, typical: { rpe: null, riso: 100 } };
  }
}

export interface MeasurementInput {
  rpe?: number | null;
  riso?: number | null;
}

/** Vyhodnotí měření; vrací seznam nevyhovujících hodnot (české texty pro soupis závad). */
export function evaluateMeasurements(protectionClass: string | null | undefined, values: MeasurementInput): { ok: boolean; failures: string[] } {
  const limits = measurementLimits(protectionClass);
  const failures: string[] = [];
  if (limits.rpeMax !== null) {
    if (values.rpe === null || values.rpe === undefined || Number.isNaN(values.rpe)) failures.push("Chybí měření odporu ochranného vodiče R_PE.");
    else if (values.rpe > limits.rpeMax) failures.push(`Odpor ochranného vodiče R_PE ${formatNumber(values.rpe)} Ω > ${formatNumber(limits.rpeMax)} Ω.`);
  }
  if (values.riso === null || values.riso === undefined || Number.isNaN(values.riso)) failures.push("Chybí měření izolačního odporu R_iso.");
  else if (values.riso < limits.risoMin) failures.push(`Izolační odpor R_iso ${formatNumber(values.riso)} MΩ < ${formatNumber(limits.risoMin)} MΩ.`);
  return { ok: failures.length === 0, failures };
}

const formatNumber = (value: number) => String(value).replace(".", ",");
