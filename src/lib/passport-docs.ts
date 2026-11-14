// Fáze 116: doplnění výrobní dokumentace rozváděče v záložce „🛡️ Pasport & Shoda (61439)“ – předvyplněné protokoly
// (EU prohlášení o shodě, kusová zkouška čl. 11, liniové schéma ze záložky Schéma, výpočet oteplení IEC TR 60890,
// vnější vlivy ČSN 33 2000-5-51), které uživatel potvrdí a ELDOCK je uloží do pasportu. Čistá data a funkce
// (dialogy, služba, tisková stránka / PDF, testy).

import type { ComplianceCategory, EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";

import { ROUTINE_TEST_POINTS } from "./legislation-2027";
import { calculateThermal } from "./thermalCalculation";

/** Plné názvy dokumentů na kartách pasportu. */
export const PASSPORT_DOC_TITLES: Record<ComplianceCategory, string> = {
  CONFORMITY_DECLARATION: "EU prohlášení o shodě",
  ROUTINE_VERIFICATION: "Protokol o kusové zkoušce (čl. 11 ČSN EN IEC 61439-1)",
  SINGLE_LINE_DIAGRAM: "Liniové schéma",
  THERMAL_CALCULATION: "Výpočet oteplení dle čl. 10.10.4 / IEC TR 60890",
  EXTERNAL_INFLUENCES: "Protokol o určení vnějších vlivů dle ČSN 33 2000-5-51",
};

/** Číslo dokumentu: „DoC-RM1-2026“, „KZ-RM1-20261114“ … */
export function passportDocNumber(category: ComplianceCategory, tag: string, date: string): string {
  const prefix: Record<ComplianceCategory, string> = { CONFORMITY_DECLARATION: "DoC", ROUTINE_VERIFICATION: "KZ", SINGLE_LINE_DIAGRAM: "LS", THERMAL_CALCULATION: "OT", EXTERNAL_INFLUENCES: "VV" };
  return `${prefix[category]}-${tag}-${date.replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
//  EU prohlášení o shodě
// ---------------------------------------------------------------------------

export interface ConformityPayload {
  kind: "CONFORMITY_DECLARATION";
  manufacturer: string;
  manufacturerAddress: string;
  product: string;
  typeDesignation: string;
  serialNumber: string;
  directives: string[];
  standards: string[];
  place: string;
  date: string;
  signatory: string;
  signatoryRole: string;
}

export const CONFORMITY_DIRECTIVES = [
  "Směrnice 2014/35/EU (LVD) – nařízení vlády č. 118/2016 Sb.",
  "Směrnice 2014/30/EU (EMC) – nařízení vlády č. 117/2016 Sb.",
  "Směrnice 2011/65/EU (RoHS) – nařízení vlády č. 481/2012 Sb.",
] as const;

export const CONFORMITY_STANDARDS = ["ČSN EN IEC 61439-1 ed. 3", "ČSN EN IEC 61439-2 ed. 3", "ČSN EN 61439-3 ed. 2"] as const;

// ---------------------------------------------------------------------------
//  Kusová zkouška (kusové ověření, čl. 11)
// ---------------------------------------------------------------------------

/** Body kusového ověření čl. 11.2–11.9 (stejné jako kusová zkouška AI Panel Builderu) + 11.10 zapojení a funkce. */
export const ROUTINE_ITEMS: readonly { clause: string; label: string }[] = [
  ...ROUTINE_TEST_POINTS.map(({ clause, label }) => ({ clause, label })),
  { clause: "11.10", label: "Zapojení, provozní vlastnosti a funkce" },
];

export type RoutineResult = "OK" | "FAIL" | "NA";
export const ROUTINE_RESULT_LABELS: Record<RoutineResult, string> = { OK: "Vyhovuje", FAIL: "Nevyhovuje", NA: "Neprovádí se" };

export interface RoutinePayload {
  kind: "ROUTINE_VERIFICATION";
  items: { clause: string; label: string; result: RoutineResult }[];
  testVoltageV: number | null;
  insulationMOhm: number | null;
  instrument: string;
  performedBy: string;
  date: string;
}

export const routinePassed = (payload: Pick<RoutinePayload, "items">) => payload.items.every((item) => item.result !== "FAIL");

// ---------------------------------------------------------------------------
//  Liniové schéma (odkaz na schéma ze záložky Schéma)
// ---------------------------------------------------------------------------

export interface SingleLinePayload {
  kind: "SINGLE_LINE_DIAGRAM";
  revisionId: string;
  version: string;
  schematicUrl: string;
  sheetCount: number;
}

// ---------------------------------------------------------------------------
//  Výpočet oteplení (IEC TR 60890, ČSN EN IEC 61439-1 čl. 10.10.4)
// ---------------------------------------------------------------------------

export interface ThermalLossLine {
  designation: string;
  description: string;
  quantity: number;
  lossW: number | null;
  /** Odkud je ztrátový výkon: katalog / technický list výrobce, jinak zadání uživatele. */
  source: string;
}

export interface ThermalPayload {
  kind: "THERMAL_CALCULATION";
  enclosure: { heightMm: number; widthMm: number; depthMm: number; installation: EnclosureType; material: EnclosureMaterial };
  ambientTempC: number;
  /** Nejvyšší dovolené oteplení vzduchu pod stropem skříně ΔT [K]. */
  maxRiseK: number;
  losses: ThermalLossLine[];
  wiringLossW: number;
  result: { deviceLossW: number; totalLossW: number; effectiveAreaM2: number; deltaT05: number; deltaT10: number; internalTempC: number; topTempC: number; ok: boolean; verdict: string };
  date: string;
  author: string;
}

export const ENCLOSURE_INSTALLATIONS: { id: EnclosureType; label: string }[] = [
  { id: "WALL_MOUNTED", label: "Nástěnný" },
  { id: "FLUSH_MOUNTED", label: "Zapuštěný" },
  { id: "FREE_STANDING", label: "Volně stojící" },
];
export const ENCLOSURE_MATERIALS: { id: EnclosureMaterial; label: string }[] = [
  { id: "PAINTED_STEEL", label: "Lakovaná ocel" },
  { id: "STAINLESS_STEEL", label: "Nerez" },
  { id: "PLASTIC", label: "Plast" },
];

/** Ztráty vodičů – orientačně 20 % ztrát přístrojů (IEC TR 60890: ztráty vnitřního propojení). */
export const wiringLossEstimate = (deviceLossW: number) => Math.round(deviceLossW * 0.2 * 10) / 10;

/**
 * Oteplení skříně z celkového ztrátového výkonu (IEC TR 60890, skříň bez větracích otvorů): Δt0,5 a Δt1,0 pod stropem,
 * vyhovuje, když oteplení pod stropem nepřekročí `maxRiseK`.
 */
export function thermalCheck(input: Pick<ThermalPayload, "enclosure" | "ambientTempC" | "maxRiseK" | "losses" | "wiringLossW">): ThermalPayload["result"] {
  const deviceLossW = Math.round(input.losses.reduce((sum, line) => sum + (line.lossW ?? 0) * Math.max(1, line.quantity), 0) * 100) / 100;
  const result = calculateThermal([], {
    heightMm: input.enclosure.heightMm,
    widthMm: input.enclosure.widthMm,
    depthMm: input.enclosure.depthMm,
    installation: input.enclosure.installation,
    material: input.enclosure.material,
    ambientTempC: input.ambientTempC,
    simultaneityFactor: 1,
    internalWiringLossW: deviceLossW + input.wiringLossW,
    limitTempC: input.ambientTempC + input.maxRiseK,
  });
  const round = (value: number) => Math.round(value * 10) / 10;
  const rise = result.topTempC - input.ambientTempC;
  const ok = rise <= input.maxRiseK + 1e-9;
  const cz = (value: number) => value.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    deviceLossW,
    totalLossW: round(result.totalLossW),
    effectiveAreaM2: Math.round(result.effectiveAreaM2 * 1000) / 1000,
    deltaT05: round(result.deltaT05),
    deltaT10: round(result.deltaT10),
    internalTempC: round(result.internalTempC),
    topTempC: round(result.topTempC),
    ok,
    verdict: ok
      ? `VYHOVUJE – oteplení pod stropem skříně ΔT = ${cz(rise)} K ≤ ${cz(input.maxRiseK)} K (vnitřní teplota ${cz(result.internalTempC)} °C, pod stropem ${cz(result.topTempC)} °C)`
      : `NEVYHOVUJE – oteplení pod stropem skříně ΔT = ${cz(rise)} K > ${cz(input.maxRiseK)} K – zvětšete skříň, přidejte větrání nebo snižte ztráty`,
  };
}

/**
 * Orientační rozměr skříně z počtu DIN lišt kusovníku (výška 300 mm + 200 mm na lištu, normalizované řady) – jen
 * předvyplnění, uživatel ho přepíše podle skutečné skříně.
 */
export function suggestEnclosure(rails: number, ratedCurrentA: number | null): ThermalPayload["enclosure"] {
  const big = (ratedCurrentA ?? 0) > 250;
  const heights = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
  const needed = 300 + Math.max(1, rails) * 200;
  const heightMm = big ? 2000 : (heights.find((height) => height >= needed) ?? 2000);
  return { heightMm, widthMm: big ? 800 : 600, depthMm: big ? 400 : 250, installation: big ? "FREE_STANDING" : "WALL_MOUNTED", material: "PAINTED_STEEL" };
}

// ---------------------------------------------------------------------------
//  Vnější vlivy (ČSN 33 2000-5-51 ed. 3)
// ---------------------------------------------------------------------------

export interface InfluenceClass {
  id: string;
  label: string;
  values: { code: string; label: string }[];
}

export const INFLUENCE_CLASSES: readonly InfluenceClass[] = [
  { id: "AA", label: "Teplota okolí", values: [{ code: "AA4", label: "−5 °C až +40 °C" }, { code: "AA5", label: "+5 °C až +40 °C" }, { code: "AA6", label: "+5 °C až +60 °C" }, { code: "AA7", label: "−25 °C až +55 °C" }, { code: "AA3", label: "−25 °C až +5 °C" }, { code: "AA8", label: "−50 °C až +40 °C" }] },
  { id: "AB", label: "Atmosférické podmínky (teplota a vlhkost)", values: [{ code: "AB4", label: "−5 °C až +40 °C, vlhkost 5–95 %" }, { code: "AB5", label: "+5 °C až +40 °C, vlhkost 5–85 %" }, { code: "AB6", label: "+5 °C až +60 °C, vlhkost 10–100 %" }, { code: "AB7", label: "−25 °C až +55 °C, vlhkost 10–100 %" }] },
  { id: "AD", label: "Výskyt vody", values: [{ code: "AD1", label: "Zanedbatelný" }, { code: "AD2", label: "Volně padající kapky" }, { code: "AD3", label: "Kropení" }, { code: "AD4", label: "Stříkání" }, { code: "AD5", label: "Tryskající voda" }, { code: "AD6", label: "Vlny" }, { code: "AD7", label: "Ponoření" }, { code: "AD8", label: "Potopení" }] },
  { id: "AE", label: "Cizí pevná tělesa", values: [{ code: "AE1", label: "Zanedbatelný výskyt" }, { code: "AE2", label: "Malé předměty (≥ 2,5 mm)" }, { code: "AE3", label: "Velmi malé předměty (≥ 1 mm)" }, { code: "AE4", label: "Lehká prašnost" }, { code: "AE5", label: "Střední prašnost" }, { code: "AE6", label: "Silná prašnost" }] },
  { id: "AF", label: "Korozivní a znečišťující látky", values: [{ code: "AF1", label: "Zanedbatelný výskyt" }, { code: "AF2", label: "Atmosférický původ" }, { code: "AF3", label: "Občasný nebo náhodný" }, { code: "AF4", label: "Trvalý" }] },
  { id: "AG", label: "Mechanické namáhání – ráz", values: [{ code: "AG1", label: "Mírné" }, { code: "AG2", label: "Střední" }, { code: "AG3", label: "Vysoké" }] },
  { id: "AH", label: "Mechanické namáhání – vibrace", values: [{ code: "AH1", label: "Mírné" }, { code: "AH2", label: "Střední" }, { code: "AH3", label: "Vysoké" }] },
  { id: "AN", label: "Sluneční záření", values: [{ code: "AN1", label: "Nízké" }, { code: "AN2", label: "Střední" }, { code: "AN3", label: "Vysoké" }] },
  { id: "BA", label: "Schopnost osob", values: [{ code: "BA1", label: "Běžné (laici)" }, { code: "BA2", label: "Děti" }, { code: "BA3", label: "Osoby se zdravotním postižením" }, { code: "BA4", label: "Poučené" }, { code: "BA5", label: "Znalé" }] },
  { id: "BC", label: "Dotyk osob s potenciálem země", values: [{ code: "BC1", label: "Žádný" }, { code: "BC2", label: "Malý" }, { code: "BC3", label: "Častý" }, { code: "BC4", label: "Trvalý" }] },
  { id: "BD", label: "Podmínky úniku v nouzi", values: [{ code: "BD1", label: "Malá hustota osob, snadný únik" }, { code: "BD2", label: "Malá hustota osob, obtížný únik" }, { code: "BD3", label: "Velká hustota osob, snadný únik" }, { code: "BD4", label: "Velká hustota osob, obtížný únik" }] },
  { id: "BE", label: "Povaha zpracovávaných nebo skladovaných materiálů", values: [{ code: "BE1", label: "Bez významného nebezpečí" }, { code: "BE2", label: "Nebezpečí požáru" }, { code: "BE3", label: "Nebezpečí výbuchu" }, { code: "BE4", label: "Nebezpečí kontaminace" }] },
];

export const INFLUENCE_DEFAULTS: Record<string, string> = { AA: "AA5", AB: "AB5", AD: "AD1", AE: "AE1", AF: "AF1", AG: "AG1", AH: "AH1", AN: "AN1", BA: "BA4", BC: "BC2", BD: "BD1", BE: "BE1" };

/** Kódy vnějších vlivů z volného textu karty („AA5, AB4, BA4 – normální průmyslové“) doplněné o výchozí třídy. */
export function influenceCodesFrom(text: string | null | undefined): string[] {
  const found = new Map<string, string>();
  for (const match of (text ?? "").toUpperCase().matchAll(/\b([AB][A-Z])(\d)\b/g)) {
    const cls = match[1];
    if (INFLUENCE_CLASSES.some((entry) => entry.id === cls) && !found.has(cls)) found.set(cls, `${cls}${match[2]}`);
  }
  return INFLUENCE_CLASSES.map((entry) => found.get(entry.id) ?? INFLUENCE_DEFAULTS[entry.id]);
}

export type SpaceConclusion = "NORMAL" | "DANGEROUS" | "SPECIAL";
export const SPACE_CONCLUSIONS: Record<SpaceConclusion, string> = {
  NORMAL: "Prostor normální",
  DANGEROUS: "Prostor nebezpečný",
  SPECIAL: "Prostor zvlášť nebezpečný",
};

/** Návrh závěru podle kódů (voda, koroze, vlhko, dotyk s potenciálem země) – závěr vždy potvrzuje komise. */
export function suggestConclusion(codes: readonly string[]): SpaceConclusion {
  const set = new Set(codes);
  if (["AD5", "AD6", "AD7", "AD8", "BC4"].some((code) => set.has(code))) return "SPECIAL";
  if (["AD2", "AD3", "AD4", "AF3", "AF4", "AB6", "AB7", "BC3"].some((code) => set.has(code))) return "DANGEROUS";
  return "NORMAL";
}

export interface InfluencesPayload {
  kind: "EXTERNAL_INFLUENCES";
  space: string;
  codes: string[];
  conclusion: SpaceConclusion;
  chair: string;
  members: string[];
  basis: string;
  date: string;
}

export const influenceLabel = (code: string) => {
  const cls = INFLUENCE_CLASSES.find((entry) => code.startsWith(entry.id));
  const value = cls?.values.find((entry) => entry.code === code);
  return cls && value ? `${code} – ${cls.label}: ${value.label}` : code;
};

// ---------------------------------------------------------------------------
//  Uložený protokol
// ---------------------------------------------------------------------------

export type PassportPayload = ConformityPayload | RoutinePayload | SingleLinePayload | ThermalPayload | InfluencesPayload;

export function parsePassportPayload(json: string | null | undefined): PassportPayload | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as PassportPayload;
    return parsed && typeof parsed === "object" && typeof parsed.kind === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Odkaz na tiskovou podobu (náhled / PDF) protokolu vygenerovaného v ELDOCKu. */
export const passportPrintHref = (equipmentId: string, documentId: string) => `/equipment/${equipmentId}/pasport/${documentId}`;
