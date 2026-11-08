import type { BuildingType, EquipmentType, InstallationKind } from "@/generated/prisma/enums";

import { computeValidUntil } from "./inspection";

// Pravidla revizních lhůt podle druhu zařízení, předpisu a normy. Čisté funkce – seed, služby, dotazy i UI.
//  • VTZ elektrická: nejdelší lhůty pravidelných revizí podle NV 190/2022 Sb., příloha č. 4 (aktuální znění ověřeno
//    na zakonyprolidi.cz 2026-11-08, fáze 66): lhůta podle účelu objektu, provedení a prostoru – platí nejkratší z nich
//    (pozn. a), revize stačí v kalendářním roce, do kterého spadá konec lhůty delší než 1 rok (pozn. b), řád preventivní
//    údržby smí stanovit až dvojnásobek (pozn. c).
//  • LPS: kritické systémy 2 roky, ostatní 4 roky, u všech vizuální kontrola nejméně 1× ročně.
//  • Stroje: kontrola nejméně 1× za 12 měsíců (NV 378/2001 Sb., § 4 odst. 2).
//  • Spotřebiče a nářadí: ČSN 33 1600 ed. 2, tab. 1 (skupina užívání, držené v ruce, třída ochrany).
// Lhůty VTZ a LPS jsou právně závazné – zařízení nesmí mít delší. U ostatních jde o normové hodnoty: delší lhůta
// je jen varování (průvodní dokumentace výrobce nebo vyhodnocení rizik provozovatele).

export type UsageGroup = "A" | "B" | "C" | "D" | "E";
export type ProtectionClass = "I" | "II" | "III";
/** Druh pravidla: předpis, kontrola osvědčení revizního technika a náležitosti zprávy. */
export type RuleKind = "VTZ" | "LPS" | "MACHINE" | "APPLIANCE" | "WELDER" | "EMERGENCY";

export interface RuleInput {
  type: EquipmentType;
  usageGroup?: string | null;
  protectionClass?: string | null;
  externalInfluences?: string | null;
  /** Účel objektu = typ budovy (příloha č. 4: administrativa 5 let, výroba 3 roky). */
  buildingType?: BuildingType | null;
  /** Objekt podle PBŘ umožňuje přítomnost více než 200 osob. */
  crowdOver200?: boolean | null;
  installationKind?: InstallationKind | null;
  /** LPS chrání kritické systémy (citlivé vnitřní systémy, VTZ I. třídy, škoda velkého rozsahu). */
  lpsCritical?: boolean | null;
  /** Lhůtu stanoví řád preventivní údržby provozovatele (až dvojnásobek). */
  preventiveMaintenance?: boolean | null;
  /** Spotřebič držený v ruce (nářadí a prodlužovací přívody vždy). */
  handHeld?: boolean | null;
}

export interface InspectionRule {
  /** Nejdelší lhůta podle předpisu / normy [měsíce]. */
  months: number;
  /** Nejdelší přípustná lhůta zařízení – s řádem preventivní údržby až dvojnásobek. */
  maxMonths: number;
  kind: RuleKind;
  /** Právně závazná lhůta (NV 190/2022 Sb.) – delší nejde uložit ani zapsat. */
  binding: boolean;
  /** Krátké označení předpisu nebo normy do popisků („NV 190/2022 Sb.“). */
  standard: string;
  /** Zdůvodnění lhůty pro tooltip, dialog a zprávu. */
  basis: string;
}

export const USAGE_GROUP_LABELS: Record<UsageGroup, string> = {
  A: "Skupina A – pronájem (revize před každým vydáním)",
  B: "Skupina B – venkovní prostory, stavby, zemědělství",
  C: "Skupina C – průmysl a řemesla",
  D: "Skupina D – veřejně přístupné prostory",
  E: "Skupina E – administrativa",
};

export const INSTALLATION_KIND_LABELS: Record<InstallationKind, string> = {
  STANDARD: "Pevná instalace",
  CONSTRUCTION_SITE: "Prozatímní zařízení staveniště (0,5 roku)",
  MOBILE: "Pojízdný nebo převozný prostředek (1 rok)",
};

/** Spotřebiče a revizní zařízení: lehká karta bez schématu, kusovníku, 3D a historie změn. */
export const LIGHT_CARD_TYPES: readonly EquipmentType[] = [
  "POWER_TOOL",
  "APPLIANCE",
  "EXTENSION_CORD",
  "WELDER",
  "LIGHTNING_ROD",
  "EMERGENCY_LIGHTING",
  "WIRING_DEVICE",
];

/** Přenosná zařízení měřená v rychlé revizi (R_PE, R_iso). */
export const PORTABLE_TYPES: readonly EquipmentType[] = ["POWER_TOOL", "APPLIANCE", "EXTENSION_CORD", "WELDER"];

const MACHINE_TYPES: readonly EquipmentType[] = ["MACHINE", "CNC_MACHINE", "PRODUCTION_LINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR"];

export const isLightCard = (type: EquipmentType) => LIGHT_CARD_TYPES.includes(type);
export const isPortable = (type: EquipmentType) => PORTABLE_TYPES.includes(type);

/** Pole zařízení, ze kterých se počítá lhůta (Prisma `select`); budovu dotaz přidá přes `BUILDING_RULE_FIELDS`. */
export const RULE_FIELDS = {
  type: true,
  usageGroup: true,
  protectionClass: true,
  externalInfluences: true,
  installationKind: true,
  lpsCritical: true,
  preventiveMaintenance: true,
  handHeld: true,
  inspectionIntervalMonths: true,
} as const;

export const BUILDING_RULE_FIELDS = { type: true, crowdOver200: true } as const;

/** Vstup pravidla ze zařízení a jeho budovy (výsledek dotazu s `RULE_FIELDS` a `BUILDING_RULE_FIELDS`). */
export const ruleInputFrom = <T extends Omit<RuleInput, "buildingType" | "crowdOver200">>(
  item: T,
  building: { type?: BuildingType | null; crowdOver200?: boolean | null } | null | undefined,
): T & Pick<RuleInput, "buildingType" | "crowdOver200"> => ({ ...item, buildingType: building?.type ?? null, crowdOver200: building?.crowdOver200 ?? false });

export function ruleKindOf(type: EquipmentType): RuleKind {
  if (type === "LIGHTNING_ROD") return "LPS";
  if (type === "EMERGENCY_LIGHTING") return "EMERGENCY";
  if (type === "WELDER") return "WELDER";
  if (type === "POWER_TOOL" || type === "APPLIANCE" || type === "EXTENSION_CORD") return "APPLIANCE";
  if (MACHINE_TYPES.includes(type)) return "MACHINE";
  // Rozváděče, transformátory, domovní přístroje a ostatní části elektrické instalace
  return "VTZ";
}

const parseGroup = (value: string | null | undefined): UsageGroup =>
  value && /^[A-E]$/.test(value.trim().toUpperCase()) ? (value.trim().toUpperCase() as UsageGroup) : "C";

const parseClass = (value: string | null | undefined): ProtectionClass => (value === "II" || value === "III" ? value : "I");

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Kódy vnějších vlivů z textu protokolu („AA5, AD2, BE3 – …“). */
export function parseInfluences(text: string | null | undefined): Set<string> {
  return new Set((text ?? "").toUpperCase().match(/\b[A-C][A-S]\d\b/g) ?? []);
}

// ---------------------------------------------------------------------------
//  VTZ elektrická – NV 190/2022 Sb., příloha č. 4
// ---------------------------------------------------------------------------

const VTZ_STANDARD = "NV 190/2022 Sb.";
const VTZ_SOURCE = "NV 190/2022 Sb., příloha č. 4";

const PURPOSE_LABEL: Record<BuildingType, string> = {
  PRODUCTION: "výrobní hala",
  ASSEMBLY: "montáž",
  ENERGY: "energetika závodu",
  WAREHOUSE: "sklad závodu",
  OFFICE: "administrativa",
  OTHER: "ostatní objekt závodu",
};

/** Prostor mokrý = stříkající voda a vyšší (AD4–AD8); AD3 (kropení) posoudí protokol vnějších vlivů. */
const WET_CODES = ["AD4", "AD5", "AD6", "AD7", "AD8"];
/** Trvalý výskyt korozivních nebo znečišťujících látek. */
const CORROSIVE_CODES = ["AF4"];
/** Nebezpečí požáru (BE2) a výbuchu (BE3). */
const FIRE_EX_CODES = ["BE2", "BE3"];

export interface IntervalLimit {
  months: number;
  reason: string;
}

/** Lhůty přílohy č. 4, které na VTZ dopadají – vždy alespoň účel objektu; platí nejkratší (pozn. a). */
export function vtzLimits(input: Omit<RuleInput, "type">): IntervalLimit[] {
  const purpose = input.buildingType ?? null;
  const limits: IntervalLimit[] = [
    purpose === "OFFICE"
      ? { months: 60, reason: "objekt pro administrativní činnost – 5 let" }
      : { months: 36, reason: purpose ? `objekt pro výrobu (${PURPOSE_LABEL[purpose]}) – 3 roky` : "účel objektu neurčen – jako výroba 3 roky" },
  ];
  if (input.crowdOver200) limits.push({ months: 24, reason: "objekt pro více než 200 osob podle PBŘ – 2 roky" });
  const codes = parseInfluences(input.externalInfluences);
  const found = (list: string[]) => list.filter((code) => codes.has(code));
  const fire = found(FIRE_EX_CODES);
  if (fire.length) limits.push({ months: 36, reason: `prostor s nebezpečím požáru a výbuchu (${fire.join(", ")}) – 3 roky` });
  const wet = [...found(WET_CODES), ...found(CORROSIVE_CODES)];
  if (wet.length) limits.push({ months: 12, reason: `prostor mokrý nebo s trvalým výskytem korozivních či znečišťujících látek (${wet.join(", ")}) – 1 rok` });
  if (input.installationKind === "MOBILE") limits.push({ months: 12, reason: "pojízdné a převozné prostředky – 1 rok" });
  if (input.installationKind === "CONSTRUCTION_SITE") limits.push({ months: 6, reason: "prozatímní zařízení staveniště – 0,5 roku" });
  return limits;
}

/** Nejdelší lhůta pravidelné revize VTZ elektrického (rozváděče, transformátory, elektrická instalace). */
export function vtzRule(input: Omit<RuleInput, "type">): InspectionRule {
  const limits = vtzLimits(input);
  const governing = limits.reduce((min, limit) => (limit.months < min.months ? limit : min));
  const months = governing.months;
  const maxMonths = input.preventiveMaintenance ? months * 2 : months;
  const shortest = limits.length > 1 ? ` Nejkratší z ${limits.length} lhůt (pozn. a).` : "";
  const extended = input.preventiveMaintenance ? ` Řád preventivní údržby: nejvýš ${maxMonths} měsíců (pozn. c).` : "";
  return { months, maxMonths, kind: "VTZ", binding: true, standard: VTZ_STANDARD, basis: `${capitalize(governing.reason)} (${VTZ_SOURCE}).${shortest}${extended}` };
}

/** Důvody, proč LPS chrání kritické systémy (příl. 4, doplňující informace k LPS, písm. b). */
export function lpsCriticalReasons(input: Omit<RuleInput, "type">): string[] {
  const reasons: string[] = [];
  if (input.lpsCritical) reasons.push("chrání kritické systémy");
  if (input.buildingType === "OFFICE") reasons.push("kancelářská budova");
  if (input.crowdOver200) reasons.push("objekt pro více než 200 osob – VTZ I. třídy");
  if (parseInfluences(input.externalInfluences).has("BE3")) reasons.push("prostor s nebezpečím výbuchu – VTZ I. třídy");
  return reasons;
}

export function lpsRule(input: Omit<RuleInput, "type">): InspectionRule {
  const reasons = lpsCriticalReasons(input);
  const months = reasons.length ? 24 : 48;
  const basis = reasons.length
    ? `LPS chránící kritické systémy (${reasons.join(", ")}) – revize 2 roky, vizuální kontrola nejméně 1× ročně (${VTZ_SOURCE}).`
    : `LPS chránící ostatní objekty – revize 4 roky, vizuální kontrola nejméně 1× ročně (${VTZ_SOURCE}).`;
  return { months, maxMonths: months, kind: "LPS", binding: true, standard: VTZ_STANDARD, basis };
}

// ---------------------------------------------------------------------------
//  Spotřebiče a nářadí – ČSN 33 1600 ed. 2, tab. 1
// ---------------------------------------------------------------------------

/** Měsíce: držené v ruce a prodlužovací přívody třídy I / třídy II a III, ostatní nepřipevněné spotřebiče. */
const APPLIANCE_TABLE: Record<Exclude<UsageGroup, "A">, { handI: number; handII: number; other: number }> = {
  B: { handI: 3, handII: 6, other: 6 },
  C: { handI: 6, handII: 12, other: 24 },
  D: { handI: 12, handII: 12, other: 24 },
  E: { handI: 12, handII: 12, other: 24 },
};

const KIND_LABEL: Partial<Record<EquipmentType, string>> = {
  POWER_TOOL: "Ruční elektrické nářadí",
  APPLIANCE: "Spotřebič",
  EXTENSION_CORD: "Prodlužovací přívod",
};

export function applianceRule(input: RuleInput): InspectionRule {
  const group = parseGroup(input.usageGroup);
  const protection = parseClass(input.protectionClass);
  // Nářadí a prodlužovací přívody patří vždy do sloupce „držené v ruce“
  const handHeld = input.type !== "APPLIANCE" || Boolean(input.handHeld);
  const row = APPLIANCE_TABLE[group === "A" ? "B" : group];
  const months = handHeld ? (protection === "I" ? row.handI : row.handII) : row.other;
  const column = input.type === "EXTENSION_CORD" ? "prodlužovací přívod" : handHeld ? "držený v ruce" : "ostatní nepřipevněný";
  const groupText = group === "A" ? "skupina A – revize před každým vydáním, mezi výpůjčkami jako skupina B" : `skupina ${group}`;
  return {
    months,
    maxMonths: months,
    kind: "APPLIANCE",
    binding: false,
    standard: "ČSN 33 1600 ed. 2",
    basis: `${KIND_LABEL[input.type] ?? "Spotřebič"} (${column}, třída ${protection}), ${groupText} – ${months} měsíců (ČSN 33 1600 ed. 2, tab. 1).`,
  };
}

// ---------------------------------------------------------------------------
//  Stroje, svářečky, nouzové osvětlení
// ---------------------------------------------------------------------------

const MACHINE_RULE: InspectionRule = {
  months: 12,
  maxMonths: 12,
  kind: "MACHINE",
  binding: false,
  standard: "NV 378/2001 Sb.",
  basis: "Elektrické zařízení stroje – kontrola nejméně 1× za 12 měsíců, nestanoví-li průvodní dokumentace jinak (NV 378/2001 Sb., § 4 odst. 2; zkoušky podle ČSN EN 60204-1).",
};

const WELDER_RULE: InspectionRule = {
  months: 12,
  maxMonths: 12,
  kind: "WELDER",
  binding: false,
  standard: "ČSN EN 60974-4",
  basis: "Zařízení pro obloukové svařování – periodická prohlídka a zkouška 1× ročně (ČSN EN 60974-4).",
};

const EMERGENCY_RULE: InspectionRule = {
  months: 12,
  maxMonths: 12,
  kind: "EMERGENCY",
  binding: false,
  standard: "ČSN EN 50172",
  basis: "Nouzové osvětlení – zkouška plné doby funkce 1× ročně a krátká zkouška funkce 1× měsíčně (ČSN EN 50172).",
};

/** Nejdelší lhůta revize a předpis pro dané zařízení. */
export function inspectionRuleFor(input: RuleInput): InspectionRule {
  switch (ruleKindOf(input.type)) {
    case "VTZ":
      return vtzRule(input);
    case "LPS":
      return lpsRule(input);
    case "APPLIANCE":
      return applianceRule(input);
    case "MACHINE":
      return MACHINE_RULE;
    case "WELDER":
      return WELDER_RULE;
    case "EMERGENCY":
      return EMERGENCY_RULE;
  }
}

/** Revizi VTZ a LPS smí provést jen revizní technik s osvědčením v odpovídajícím rozsahu (zákon 250/2021 Sb., § 17). */
export const requiresCertificate = (rule: Pick<InspectionRule, "kind">) => rule.kind === "VTZ" || rule.kind === "LPS";

/** Lhůta, se kterou se zapíše nová revize: u závazných lhůt nejvýš zákonná (starší delší hodnota se ořízne). */
export function effectiveIntervalMonths(storedMonths: number | null | undefined, rule: InspectionRule): number {
  const stored = storedMonths && storedMonths > 0 ? storedMonths : rule.months;
  return rule.binding ? Math.min(stored, rule.maxMonths) : stored;
}

export interface IntervalIssue {
  level: "error" | "warning";
  message: string;
}

/** Lhůta zařízení je delší než nejdelší přípustná: závazná = chyba (ořízne se), normová = varování. */
export function intervalIssue(storedMonths: number, rule: InspectionRule): IntervalIssue | null {
  if (storedMonths <= rule.maxMonths) return null;
  return rule.binding
    ? { level: "error", message: `Lhůta ${storedMonths} měsíců překračuje nejdelší zákonnou lhůtu ${rule.maxMonths} měsíců (${rule.standard}) – nové revize se zapíší s ${rule.maxMonths} měsíci.` }
    : { level: "warning", message: `Lhůta ${storedMonths} měsíců je delší než ${rule.maxMonths} měsíců podle ${rule.standard} – doložte ji průvodní dokumentací nebo vyhodnocením rizik.` };
}

/**
 * Nejzazší termín pravidelné revize: konec lhůty ze zprávy, u závazných lhůt nejvýš datum revize + zákonná lhůta;
 * u VTZ s lhůtou nad 1 rok pak konec kalendářního roku, do kterého konec lhůty spadá (NV 190/2022 Sb., příl. 4
 * pozn. b). Lhůtník dál hlídá přísnější konec lhůty (`validUntil`).
 */
export function legalDeadline(inspectionDate: Date, validUntil: Date, rule: Pick<InspectionRule, "kind" | "binding" | "maxMonths">): Date {
  const legal = rule.binding ? computeValidUntil(inspectionDate, rule.maxMonths) : validUntil;
  const end = legal.getTime() < validUntil.getTime() ? legal : validUntil;
  if (rule.kind !== "VTZ" || end.getTime() <= computeValidUntil(inspectionDate, 12).getTime()) return end;
  return new Date(Date.UTC(end.getUTCFullYear(), 11, 31, 10));
}

/** Platnost nové revize: datum + lhůta zařízení (u závazných nejvýš zákonná), jinak doporučená lhůta. */
export function nextValidUntil(inspectionDate: Date, input: RuleInput & { inspectionIntervalMonths?: number | null }): Date {
  return computeValidUntil(inspectionDate, effectiveIntervalMonths(input.inspectionIntervalMonths, inspectionRuleFor(input)));
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
