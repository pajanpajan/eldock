// Fáze 81: akční členy, zdroje a systémové moduly chytré domácnosti na DIN lištu (`SMART_SYSTEMS` v `smart-home.ts`) jako
// kusy katalogu prvků AI Panel Builderu (`CatalogComponent`) – kategorie, šířka, ztrátový výkon Pv, objednací číslo a
// datasheet z jednoho zdroje pro 2D půdorys, kaskádu Kroku 1, katalog `/panel-builder/catalog` i generování rozváděče.
// Klíč v katalogu = objednací číslo (Loxone s předponou „LOXONE:“ jako v importu katalogu výrobců); modul bez ověřeného
// čísla má klíč výrobce a typu („TAPHOME:6DO“) a popis „objednací číslo ověřte u výrobce“. Profil kusu (systém, funkce,
// kanály, barevný štítek „SPÍNACÍ 8×16A“) pro kaskádu a vektorový symbol na DIN liště. Čisté funkce.

import { normalizeSearch } from "./catalog";
import { externalArticleNumber } from "./external-catalog";
import { SMART_SYSTEMS, smartSystemOf, type SmartModule, type SmartRole, type SmartSystemId } from "./smart-home";

/** Kód výrobce v katalogu (předpona číselných objednacích čísel). */
export const SMART_MAKER_CODE: Record<SmartSystemId, string> = { abb_freeathome: "ABB", abb_knx: "ABB", loxone: "LOXONE", taphome: "TAPHOME" };
/** Řada kusu v katalogu prvků (shodně s importem katalogu výrobců – filtr řady „free@home“ / „ABB i-bus KNX“). */
export const SMART_SERIES: Record<SmartSystemId, string> = { abb_freeathome: "free@home", abb_knx: "ABB i-bus KNX", loxone: "Loxone", taphome: "TapHome" };

/** Modul patří do katalogu prvků: má šířku na DIN liště a není obecný (LED PWM, zdroje LED bez výrobce systému). */
export const isCatalogModule = (unit: Pick<SmartModule, "modules" | "source" | "role">) => unit.modules > 0 && !unit.source.startsWith("obecný modul") && unit.role !== "psu_led";

const slug = (text: string) => normalizeSearch(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

/** Klíč kusu v katalogu prvků (objednací číslo, Loxone „LOXONE:100335“, bez čísla „TAPHOME:6DO“). */
export function smartCatalogArticle(system: SmartSystemId, unit: Pick<SmartModule, "articleNumber" | "typeCode">): string {
  const maker = SMART_MAKER_CODE[system];
  return unit.articleNumber ? externalArticleNumber(maker, unit.articleNumber) : `${maker}:${slug(unit.typeCode)}`;
}

export interface SmartDinComponent {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  category: "PLC" | "PSU";
  poles: string;
  ratedCurrentA: number;
  moduleSubtype: "PLC" | "PSU_DC";
  modulesCount: number;
  /** null = výrobce neuvádí → odhad dle IEC. */
  powerLossWatts: number | null;
  /** Pv není z katalogu výrobců (orientačně ze zadání / odvozeno) → v katalogu „odhad“. */
  lossEstimated: boolean;
  description: string;
  datasheetUrl: string | null;
  source: string;
  system: SmartSystemId;
  moduleId: string;
  /** Fáze 114: EAN z oficiálních dat výrobce. */
  ean: string | null;
}

const isPsu = (role: SmartRole) => role === "psu" || role === "psu_led";

/** Kus katalogu prvků pro modul na DIN lištu. */
export function smartDinComponent(system: SmartSystemId, unit: SmartModule): SmartDinComponent {
  const setup = smartSystemOf(system);
  const psu = isPsu(unit.role);
  const note = [unit.lossFrom === "zadání" ? "Pv orientačně" : unit.lossFrom === "odvozeno" ? "Pv odvozen ze shodné platformy" : null, unit.verified ? null : "objednací číslo ověřte u výrobce"].filter(Boolean).join(", ");
  return {
    manufacturer: setup.manufacturer,
    series: SMART_SERIES[system],
    typeCode: unit.typeCode,
    articleNumber: smartCatalogArticle(system, unit),
    category: psu ? "PSU" : "PLC",
    poles: "1P",
    ratedCurrentA: unit.ratedA ?? (psu && unit.busMa ? unit.busMa / 1000 : 0),
    moduleSubtype: psu ? "PSU_DC" : "PLC",
    modulesCount: unit.modules,
    powerLossWatts: unit.lossW ?? null,
    lossEstimated: unit.lossFrom !== "katalog",
    description: `${unit.label} – ${setup.label.replace(/\s*\(.*\)$/, "")}, šířka ${unit.modules} M${note ? ` (${note})` : ""}`.slice(0, 300),
    datasheetUrl: unit.datasheetUrl ?? null,
    source: unit.source,
    system,
    moduleId: unit.id,
    ean: unit.ean ?? null,
  };
}

/** Všechny kusy na DIN lištu čtyř systémů (bez duplicit klíče) – přírůstkový seed katalogu prvků. */
export function smartDinComponents(): SmartDinComponent[] {
  const seen = new Set<string>();
  return SMART_SYSTEMS.flatMap((system) => system.modules.filter(isCatalogModule).map((unit) => smartDinComponent(system.id, unit))).filter((row) => {
    if (seen.has(row.articleNumber)) return false;
    seen.add(row.articleNumber);
    return true;
  });
}

// ---------------------------------------------------------------------------
//  Profil kusu: systém, funkce a kanály (kaskáda Kroku 1, symbol na DIN liště)
// ---------------------------------------------------------------------------

export interface SmartDinProfile {
  system: SmartSystemId;
  role: SmartRole;
  channels: number;
  ratedA: number | null;
  /** Barevný štítek na čele aktoru („SPÍNACÍ 8×16A“, „ŽALUZIOVÝ 4×“, „DALI“). */
  label: string;
  /** Barva štítku podle funkce. */
  color: string;
  /** Alternativní typ jen pro ruční volbu (`manualOnly`) – v kaskádě má přednost výchozí typ výpočtu. */
  alternative?: boolean;
  /** Kus výpočtu chytré domácnosti (`smart-home.ts`) – v kaskádě před řádky importu katalogu výrobců. */
  canonical?: boolean;
}

/** Pořadí kusu v kaskádě: výchozí typ výpočtu 2, ruční alternativa 1, řádek importu katalogu výrobců 0. */
export const smartRank = (profile: SmartDinProfile | null) => (profile?.canonical ? (profile.alternative ? 1 : 2) : 0);

export const ROLE_COLOR: Record<SmartRole, string> = {
  switch: "#2563eb",
  blind: "#0d9488",
  dim: "#d97706",
  heating: "#dc2626",
  dali: "#7c3aed",
  input: "#0891b2",
  pwm: "#db2777",
  psu: "#4b5563",
  psu_led: "#4b5563",
  interface: "#16a34a",
  system: "#15803d",
};

/** Štítek funkce na čele aktoru. */
export function profileLabel(role: SmartRole, channels: number, ratedA: number | null): string {
  const count = channels > 0 ? `${channels}×` : "";
  switch (role) {
    case "switch":
      return `SPÍNACÍ ${count}${ratedA ? `${ratedA}A` : ""}`.trim();
    case "blind":
      return `ŽALUZIOVÝ ${count}`.trim();
    case "dim":
      return `STMÍVACÍ ${count}`.trim();
    case "heating":
      return `TOPENÍ ${count}`.trim();
    case "dali":
      return "DALI";
    case "input":
      return `VSTUPY ${count}`.trim();
    case "pwm":
      return `LED PWM ${count}`.trim();
    case "psu":
    case "psu_led":
      return "ZDROJ";
    case "interface":
      return "ROZHRANÍ";
    case "system":
      return "SYSTÉM";
  }
}

const profile = (system: SmartSystemId, role: SmartRole, channels: number, ratedA: number | null = null): SmartDinProfile => ({ system, role, channels, ratedA, label: profileLabel(role, channels, ratedA), color: ROLE_COLOR[role] });

/** Typové řady ABB a názvy Loxone mimo výpočet (import katalogu výrobců: SA-M-0.4.1, JRA/S 2.230.2.1 …). */
const PATTERNS: { test: RegExp; system: SmartSystemId; role: SmartRole; channels?: number; ratedA?: number }[] = [
  { test: /^SA-M-0\.(\d+)\./, system: "abb_freeathome", role: "switch" },
  { test: /^SA-M-(\d+)\.(\d+)/, system: "abb_freeathome", role: "switch" },
  { test: /^BA-M-0\.(\d+)\./, system: "abb_freeathome", role: "blind" },
  { test: /^BA-M-(\d+)\./, system: "abb_freeathome", role: "blind" },
  { test: /^DA[-/]M[.-](\d+)\./, system: "abb_freeathome", role: "dim" },
  { test: /^HA-M-0\.(\d+)\./, system: "abb_freeathome", role: "heating" },
  { test: /^DG-M-1\.(\d+)/, system: "abb_freeathome", role: "dali" },
  { test: /^BI-M-(\d+)\./, system: "abb_freeathome", role: "input" },
  { test: /^PS-M-/, system: "abb_freeathome", role: "psu" },
  { test: /^SAP/, system: "abb_freeathome", role: "system" },
  { test: /^SA\/S ?(\d+)\.(\d+)/, system: "abb_knx", role: "switch" },
  { test: /^JRA\/S ?(\d+)\./, system: "abb_knx", role: "blind" },
  { test: /^UD\/S ?(\d+)\./, system: "abb_knx", role: "dim" },
  { test: /^ES\/S ?(\d+)\./, system: "abb_knx", role: "heating" },
  { test: /^VC\/S ?(\d+)\./, system: "abb_knx", role: "heating" },
  { test: /^DG\/S ?1\.(\d+)/, system: "abb_knx", role: "dali" },
  { test: /^BE\/S ?(\d+)\./, system: "abb_knx", role: "input" },
  { test: /^SV\/S/, system: "abb_knx", role: "psu" },
  { test: /^IP[SR]\/S/, system: "abb_knx", role: "interface" },
  { test: /^Relay Extension/i, system: "loxone", role: "switch", channels: 14, ratedA: 16 },
  { test: /^Dimmer Extension/i, system: "loxone", role: "dim", channels: 4 },
  { test: /^DALI Extension/i, system: "loxone", role: "dali", channels: 64 },
  { test: /^DI Extension/i, system: "loxone", role: "input", channels: 20 },
  { test: /^RGBW 24V (Compact )?Dimmer/i, system: "loxone", role: "pwm", channels: 4 },
  { test: /Extension/i, system: "loxone", role: "interface" },
  { test: /^Miniserver/i, system: "loxone", role: "system" },
  { test: /^Power Supply/i, system: "loxone", role: "psu" },
];

const compactType = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** Kanonické moduly výpočtu podle klíče v katalogu a podle typu (bez mezer – „SA/S4.16.2.2“ = „SA/S 4.16.2.2“). */
const CANONICAL = (() => {
  const byArticle = new Map<string, SmartDinProfile>();
  const byType = new Map<string, SmartDinProfile>();
  for (const system of SMART_SYSTEMS) {
    for (const unit of system.modules) {
      if (!isCatalogModule(unit)) continue;
      const value = { ...profile(system.id, unit.role, unit.channels > 0 && unit.role !== "psu" && unit.role !== "system" && unit.role !== "interface" ? unit.channels : 0, unit.ratedA ?? null), canonical: true, ...(unit.manualOnly ? { alternative: true } : {}) };
      byArticle.set(smartCatalogArticle(system.id, unit), value);
      byType.set(`${smartSystemOf(system.id).manufacturer.toUpperCase()}|${compactType(unit.typeCode)}`, value);
    }
  }
  return { byArticle, byType };
})();

/**
 * Profil kusu na DIN lištu: kanonický modul výpočtu (klíč nebo typ), jinak typová řada (ABB free@home / KNX, Loxone).
 * null = kus chytré domácnosti není (jistič, zdroj obecný, PLC jiného výrobce).
 */
export function smartDinProfile(component: { manufacturer: string | null; typeCode: string | null; articleNumber?: string | null; ratedCurrentA?: number | null }): SmartDinProfile | null {
  const maker = (component.manufacturer ?? "").toUpperCase();
  const typeCode = (component.typeCode ?? "").trim();
  if (component.articleNumber) {
    const known = CANONICAL.byArticle.get(component.articleNumber);
    if (known) return known;
  }
  const byType = CANONICAL.byType.get(`${maker}|${compactType(typeCode)}`);
  if (byType) return byType;
  if (!typeCode || !["ABB", "LOXONE", "TAPHOME"].includes(maker)) return null;
  for (const pattern of PATTERNS) {
    if (pattern.system === "loxone" ? maker !== "LOXONE" : maker !== "ABB") continue;
    const match = pattern.test.exec(typeCode);
    if (!match) continue;
    const channels = pattern.channels ?? (match[1] ? Number(match[1]) : 0);
    // Proud kanálu: z katalogu (SA-M-8.8.1 = 6 A), jinak z typu („SA/S 4.16…“ = 16 A)
    const known = component.ratedCurrentA && component.ratedCurrentA > 0 ? component.ratedCurrentA : null;
    const ratedA = pattern.role !== "switch" ? null : (known ?? pattern.ratedA ?? (match[2] && Number(match[2]) >= 6 && Number(match[2]) <= 20 ? Number(match[2]) : null));
    return profile(pattern.system, pattern.role, ["psu", "system", "interface"].includes(pattern.role) ? 0 : channels, ratedA);
  }
  return null;
}

/** Systémy chytré domácnosti výrobce (filtr řady v kaskádě – u ABB free@home a KNX). */
export const smartSystemsOf = (manufacturer: string | null | undefined) => SMART_SYSTEMS.filter((system) => system.manufacturer.toUpperCase() === (manufacturer ?? "").toUpperCase());

/** Popisky filtru řady (zadání fáze 81). */
export const SMART_SYSTEM_FILTER_LABEL: Record<SmartSystemId, string> = {
  abb_freeathome: "ABB-free@home® (SA-M, BA-M, DA/M, HA-M, SysAP)",
  abb_knx: "ABB i-bus® KNX (SA/S, JRA/S, UD/S, SV/S)",
  loxone: "Loxone – Miniserver a Extensions",
  taphome: "TapHome – Core a moduly na DIN",
};

/** Systém chytré domácnosti podle řady kusu v katalogu prvků („free@home“, „free@home wireless“, „ABB i-bus KNX“). */
export function smartSystemOfSeries(series: string | null | undefined): SmartSystemId | null {
  const value = (series ?? "").toLowerCase();
  if (value.includes("free@home")) return "abb_freeathome";
  if (value.includes("knx")) return "abb_knx";
  if (value.includes("loxone")) return "loxone";
  if (value.includes("taphome")) return "taphome";
  return null;
}
