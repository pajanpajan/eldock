// Demo data fáze 13: hierarchie napájení, pasport rozváděčů (ČSN EN 61439) a lhůtník
// revizí (ČSN 33 1500). Čistá data bez I/O; data revizí jsou relativní k okamžiku seedu,
// aby stavy 🟢 / 🟡 / 🔴 vycházely vždy stejně.
import type { ComplianceCategory, DefectSeverity, InspectionResult, InspectionType } from "../src/generated/prisma/enums";
import { addMonths, pragueToday } from "../src/lib/inspection";
import { inspectionRuleFor, isPortable, measurementLimits } from "../src/lib/inspection-rules";

import { day, daysAgo, type EquipmentSeed } from "./seed-data";

// ---------------------------------------------------------------------------
//  Hierarchie napájení
// ---------------------------------------------------------------------------

export interface FeedSeed {
  from: string;
  circuit: string;
  /** Jistič vývodu do liniového schématu. */
  rating?: string;
}

export const FEEDS: Record<string, FeedSeed> = {
  RM1: { from: "TR1", circuit: "Vývod nn / Q0", rating: "1600 A" },
  "R-LIS-01": { from: "RM1", circuit: "Pole 1 / QF1", rating: "250 A" },
  "R-CNC-04": { from: "RM1", circuit: "Pole 2 / QF2", rating: "63 A" },
  KS1: { from: "RM1", circuit: "Pole 2 / QF3", rating: "160 A" },
  "R-VZT-01": { from: "RM1", circuit: "Pole 3 / QF4", rating: "125 A" },
  "R-ML-01": { from: "RM1", circuit: "Pole 4 / QF5", rating: "160 A" },
  "R-SKL": { from: "RM1", circuit: "Pole 4 / QF6", rating: "125 A" },
  "RP-ADM1": { from: "RM1", circuit: "Pole 5 / QF7", rating: "63 A" },
  RC1: { from: "RM1", circuit: "Pole 6 / QF8", rating: "400 A" },
  RZ1: { from: "RM1", circuit: "Pole 6 / QF9", rating: "160 A" },
  "RP-ADM2": { from: "RP-ADM1", circuit: "Vývod FA4", rating: "63 A" },
  "LIS-01": { from: "R-LIS-01", circuit: "Vývod Q2" },
  "LIS-02": { from: "R-LIS-01", circuit: "Vývod Q3" },
  "ROB-03": { from: "R-LIS-01", circuit: "Vývod Q4" },
  "CNC-04": { from: "R-CNC-04", circuit: "Hlavní vypínač Q1" },
  "VZT-01": { from: "R-VZT-01", circuit: "Vývod Q2" },
  "ML-01": { from: "R-ML-01", circuit: "Vývod Q2" },
  "ML-02": { from: "R-ML-01", circuit: "Vývod Q3" },
  "ROB-07": { from: "R-ML-01", circuit: "Vývod Q4" },
  "LAK-01": { from: "R-LAK-01", circuit: "Vývod Q2" },
  "VZT-LAK": { from: "R-LAK-01", circuit: "Vývod Q3" },
  // Spotřebiče, nářadí a bezpečnostní okruhy (fáze 17 – pavouk napájení)
  "NR-0112": { from: "R-LIS-01", circuit: "Zásuvkový okruh ZS1" },
  "NR-0087": { from: "R-LIS-01", circuit: "Zásuvkový okruh ZS1" },
  "PP-0031": { from: "R-LIS-01", circuit: "Zásuvka 400 V / XS3" },
  "SV-0004": { from: "R-LIS-01", circuit: "Zásuvka 400 V / XS3" },
  "NO-A": { from: "R-LIS-01", circuit: "Okruh nouzového osvětlení FE1" },
  "SV-0007": { from: "R-ML-01", circuit: "Zásuvkový okruh ZS2" },
  "SP-0201": { from: "RM1", circuit: "Pole 5 / Zásuvkový okruh ZS-E1" },
  "SP-0202": { from: "RM1", circuit: "Pole 5 / Zásuvkový okruh ZS-E1" },
  "SP-0203": { from: "RM1", circuit: "Pole 5 / Zásuvkový okruh ZS-E1" },
  "SP-0204": { from: "RM1", circuit: "Pole 5 / Zásuvkový okruh ZS-E1" },
  "NO-E": { from: "RZ1", circuit: "Okruh nouzového osvětlení FE2" },
  "SP-0310": { from: "RP-ADM1", circuit: "Zásuvkový okruh ZS3" },
  "PP-0044": { from: "RP-ADM1", circuit: "Zásuvkový okruh ZS3" },
  "SP-0322": { from: "RP-ADM2", circuit: "Zásuvkový okruh ZS1" },
};

// ---------------------------------------------------------------------------
//  Vnější vlivy a lhůty revizí
// ---------------------------------------------------------------------------

const INFLUENCES_BY_FLOOR: Record<string, string> = {
  "e-1pp": "AA5, AB5, AD1, AE1, BA4, BE1 – prostory normální (elektrická provozovna)",
  "e-1np": "AA5, AB5, AD1, AE2, AG2, BA4 – prostory normální",
  "a-1np": "AA5, AB5, AD2, AE2, AF2, AG2, BA4 – normální průmyslové (chladicí emulze)",
  "a-2np": "AA4, AB4, AD1, AE2, BA4 – prostory normální (strojovna VZT)",
  "b-1np": "AA5, AB5, AD1, AE2, AG2, BA4, BE1 – normální průmyslové",
  "s-1np": "AA5, AB5, AD1, AE2, AG2, BA4, BE2 – nabíjení akumulátorů VZV",
  "k-1np": "AA5, AB5, AD1, AE1, BA1 – prostory normální",
  "k-2np": "AA5, AB5, AD1, AE1, BA1 – prostory normální",
  "lbc-1np": "AA5, AB5, AD1, AE2, BE3 – prostor s nebezpečím výbuchu (lakovna, hořlavé barvy)",
};

export const externalInfluencesFor = (eq: EquipmentSeed) =>
  eq.type === "SWITCHBOARD" ? (INFLUENCES_BY_FLOOR[eq.floor] ?? null) : null;

/** Lhůta podle `inspection-rules` (ČSN 33 1500 dle vnějších vlivů, NV 378/2001 Sb., ČSN 33 1600 ed. 2 …). */
export const intervalFor = (eq: EquipmentSeed) =>
  inspectionRuleFor({ type: eq.type, usageGroup: eq.usageGroup, protectionClass: eq.protectionClass, externalInfluences: externalInfluencesFor(eq) }).months;

// ---------------------------------------------------------------------------
//  Revizní technici
// ---------------------------------------------------------------------------

export const INSPECTORS = {
  horak: { name: "Ing. Pavel Horák", license: "TIČR č. E-0815/2021 (E1A)" },
  benes: { name: "Miroslav Beneš", license: "TIČR č. E-1432/2023 (E2A)" },
  sykora: { name: "Bc. Radek Sýkora", license: "Certifikát ČSN EN ISO 9712 TT2 č. 0391" },
} as const;

type InspectorKey = keyof typeof INSPECTORS;

export interface InspectionSeed {
  type: InspectionType;
  inspectionDate: Date;
  validUntil: Date;
  reportNumber: string;
  inspector: InspectorKey;
  result: InspectionResult;
  defectsSummary: string | null;
  measuringInstrument: string | null;
  protectiveConductorResistance: number | null;
  insulationResistance: number | null;
  /** Termovize. */
  maxTempC?: number | null;
  deltaTempC?: number | null;
  /** Závady revize; bez nich se odvodí ze `defectsSummary`. */
  defectItems?: DefectSeed[];
  /** Závady ze starších zpráv byly odstraněny. */
  defectsResolved: boolean;
}

export interface DefectSeed {
  description: string;
  severity: DefectSeverity;
  /** Odstraněno N dní po revizi (jinak otevřená). */
  resolved?: { afterDays: number; by: string; note: string };
}

export const MEASURING_INSTRUMENT = "Metrel MI 3309 BT";

/** Dny do konce aktuálního kalendářního měsíce (Europe/Prague) – plánovač potřebuje kusy „tento měsíc“. */
function daysToMonthEnd(): number {
  const [year, month, dayOfMonth] = pragueToday().split("-").map(Number);
  return Math.round((Date.UTC(year, month, 0) - Date.UTC(year, month - 1, dayOfMonth)) / (24 * 3600 * 1000));
}
/** Konec platnosti uprostřed zbytku měsíce (poslední den měsíce = dnes). */
const thisMonth = () => daysAgo(-Math.floor(daysToMonthEnd() / 2));
/** 5. den příštího měsíce – do 45 dnů po konci měsíce (tip „přiberte při jedné cestě“). */
const nextMonth = () => daysAgo(-(daysToMonthEnd() + 5));

/** Závady R-ML-01: neodstraněné z poslední (propadlé) revize. */
const R_ML_01_DEFECTS: DefectSeed[] = [
  { description: "Chybí krytí živých částí IP2X u stykače K2", severity: "MAJOR" },
  { description: "Chybí štítek jističe F3", severity: "MINOR" },
];

/** Konec platnosti poslední revize pro řízené případy z plánu (🟢 RM1, 🟡 R-CNC-04, 🔴 R-ML-01). */
const SPECIAL: Record<string, { validUntil: () => Date; result?: InspectionResult; defects?: string }> = {
  RM1: { validUntil: () => addMonths(daysAgo(0), 14) },
  "R-CNC-04": { validUntil: () => daysAgo(-18) },
  "R-ML-01": {
    validUntil: () => daysAgo(14),
    result: "CAPABLE_WITH_DEFECTS",
    defects: "Chybí krytí živých částí IP2X u stykače K2 a chybí štítek jističe F3",
  },
  // Spotřebiče a nářadí (fáze 14)
  "SP-0201": { validUntil: () => daysAgo(5) },
  // Plánovač (fáze 15): kuchyňka – propadlé, tento měsíc a příští měsíc ve stejné místnosti
  "SP-0204": { validUntil: thisMonth },
  "SP-0203": { validUntil: nextMonth },
  // Dílna údržby: svářečka končí krátce po okně „do 30 dnů“ (tip v plánovači), ale je ještě 🟢
  "SV-0004": { validUntil: () => daysAgo(-38) },
  "SP-0322": { validUntil: () => daysAgo(-100) },
  "RP-ADM1": { validUntil: thisMonth },
  "NR-0112": { validUntil: () => daysAgo(-9) },
  "PP-0031": { validUntil: () => daysAgo(21), result: "CAPABLE_WITH_DEFECTS", defects: "Poškozená izolace kabelu u vidlice – nutná výměna přívodu" },
};

let reportSequence = 100;
const reportNumber = (prefix: "RZ" | "TV", date: Date, plant: string) =>
  `${prefix}-${date.getUTCFullYear()}-${String(++reportSequence).padStart(3, "0")}/${plant}`;

/**
 * Historie revizí zařízení: výchozí revize při instalaci, pak pravidelné revize po lhůtě.
 * Poslední revize platí podle `SPECIAL`, ostatní zařízení mají 4–30 měsíců rezervy.
 */
export function inspectionsFor(eq: EquipmentSeed, index: number, plantCode: string): InspectionSeed[] {
  const interval = intervalFor(eq);
  const special = SPECIAL[eq.tag];
  const lastDefectItems = eq.tag === "R-ML-01" ? R_ML_01_DEFECTS : undefined;
  // Rezerva vždy kratší než lhůta, aby poslední revize neležela v budoucnu.
  const reserve = 4 + ((index * 7) % Math.max(1, Math.min(27, interval - 5)));
  const lastValidUntil = special ? special.validUntil() : addMonths(daysAgo(0), reserve);
  const lastDate = addMonths(lastValidUntil, -interval);
  const commissioned = day(`${eq.yearInstalled}-0${3 + (index % 6)}-1${index % 9}`);

  const periodic: Date[] = [lastDate];
  const earliest = addMonths(commissioned, Math.ceil(interval / 2)).getTime();
  for (let date = addMonths(lastDate, -interval); date.getTime() > earliest; date = addMonths(date, -interval)) {
    periodic.unshift(date);
  }
  // Výchozí revize nejvýš jednu lhůtu před první pravidelnou (bez mezery v platnosti).
  const lapse = addMonths(periodic[0], -interval);
  const installed = commissioned.getTime() < lapse.getTime() ? lapse : commissioned;
  const hasInitial = installed.getTime() < addMonths(periodic[0], -3).getTime();
  const inspector = (i: number): InspectorKey => (isPortable(eq.type) ? "benes" : (index + i) % 2 ? "benes" : "horak");
  // Měření přenosných spotřebičů (ČSN 33 1600 ed. 2) – deterministicky podle pořadí
  const measured = (i: number) => {
    if (!isPortable(eq.type)) return { measuringInstrument: null, protectiveConductorResistance: null, insulationResistance: null };
    const limits = measurementLimits(eq.protectionClass);
    return {
      measuringInstrument: MEASURING_INSTRUMENT,
      protectiveConductorResistance: limits.rpeMax === null ? null : Math.round((0.06 + ((index + i) % 7) * 0.025) * 100) / 100,
      insulationResistance: 120 + ((index * 37 + i * 53) % 380),
    };
  };

  const records: InspectionSeed[] = [];
  if (hasInitial) {
    records.push({
      type: "INITIAL",
      inspectionDate: installed,
      validUntil: addMonths(installed, interval),
      reportNumber: reportNumber("RZ", installed, plantCode),
      inspector: "horak",
      result: "CAPABLE",
      defectsSummary: null,
      defectsResolved: true,
      ...measured(0),
    });
  }
  periodic.forEach((date, i) => {
    const last = i === periodic.length - 1;
    const type: InspectionType = !hasInitial && i === 0 ? "INITIAL" : "PERIODIC";
    const olderDefect = !last && eq.tag === "RM1" ? "Chybějící popisy vývodů v poli 3 a uvolněná svorka PEN – odstraněno při revizi." : null;
    records.push({
      type,
      inspectionDate: date,
      validUntil: last ? lastValidUntil : addMonths(date, interval),
      reportNumber: reportNumber("RZ", date, plantCode),
      inspector: inspector(i),
      result: last && special?.result ? special.result : olderDefect ? "CAPABLE_WITH_DEFECTS" : "CAPABLE",
      defectsSummary: last ? (special?.defects ?? null) : olderDefect,
      defectsResolved: !last,
      defectItems: last ? lastDefectItems : undefined,
      ...measured(i + 1),
    });
  });

  // Termovize hlavního rozváděče a lisovací linky
  if (eq.tag === "RM1" || eq.tag === "R-LIS-01") {
    const validUntil = eq.tag === "RM1" ? addMonths(daysAgo(0), 14) : addMonths(daysAgo(0), 7);
    const months = eq.tag === "RM1" ? 24 : 12;
    const date = addMonths(validUntil, -months);
    if (eq.tag === "RM1") {
      const previous = addMonths(date, -24);
      records.push({
        type: "THERMOVISION",
        inspectionDate: previous,
        validUntil: date,
        reportNumber: reportNumber("TV", previous, plantCode),
        inspector: "sykora",
        result: "CAPABLE_WITH_DEFECTS",
        defectsSummary: "Zvýšená teplota svorky L2 vývodu QF4 (Δθ 41 K) – dotaženo, ověřeno opakovaným měřením.",
        defectsResolved: true,
        maxTempC: 68.4,
        deltaTempC: 41.2,
        ...measured(0),
      });
    }
    records.push({
      type: "THERMOVISION",
      inspectionDate: date,
      validUntil,
      reportNumber: reportNumber("TV", date, plantCode),
      inspector: "sykora",
      result: "CAPABLE",
      defectsSummary: null,
      defectsResolved: true,
      maxTempC: eq.tag === "RM1" ? 38.6 : 44.1,
      deltaTempC: eq.tag === "RM1" ? 9.8 : 16.5,
      ...measured(0),
    });
  }

  // Mimořádná revize R-CNC-04 po výměně stykače K4 (neposouvá lhůtu pravidelné revize)
  if (eq.tag === "R-CNC-04") {
    const date = daysAgo(25);
    records.push({
      type: "EXTRAORDINARY",
      inspectionDate: date,
      validUntil: addMonths(date, interval),
      reportNumber: reportNumber("RZ", date, plantCode),
      inspector: "horak",
      result: "CAPABLE_WITH_DEFECTS",
      defectsSummary: "Uvolněná svorka PE na X1:PE. Chybí aktualizovaná výstražná tabulka na dveřích rozváděče.",
      defectsResolved: false,
      defectItems: [
        { description: "Uvolněná svorka PE na X1:PE", severity: "MAJOR", resolved: { afterDays: 3, by: "Petr Novák", note: "Svorka dotažena momentem 2,5 Nm, ověřena spojitost PE." } },
        { description: "Chybí aktualizovaná výstražná tabulka na dveřích rozváděče", severity: "MINOR" },
      ],
      ...measured(0),
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
//  Pasport rozváděče (ČSN EN 61439)
// ---------------------------------------------------------------------------

export interface ComplianceSeed {
  category: ComplianceCategory;
  title: string;
  documentNumber: string;
  issuer: string;
  author: string;
  notes: string | null;
}

const PANEL_BUILDERS = {
  RM1: "Elektro Lumen s.r.o. – partner Siemens SIVACON",
  default: "ELMONT Jablonec s.r.o. – výrobce rozváděčů",
};

const COMPLETE: Record<string, ComplianceCategory[]> = {
  RM1: ["SINGLE_LINE_DIAGRAM", "CONFORMITY_DECLARATION", "ROUTINE_VERIFICATION", "THERMAL_CALCULATION", "EXTERNAL_INFLUENCES"],
  "R-CNC-04": ["SINGLE_LINE_DIAGRAM", "CONFORMITY_DECLARATION", "ROUTINE_VERIFICATION", "THERMAL_CALCULATION", "EXTERNAL_INFLUENCES"],
};
const BASIC: ComplianceCategory[] = ["CONFORMITY_DECLARATION", "ROUTINE_VERIFICATION"];

const DOC_PREFIX: Record<ComplianceCategory, string> = {
  SINGLE_LINE_DIAGRAM: "LS",
  CONFORMITY_DECLARATION: "PS",
  ROUTINE_VERIFICATION: "KZ",
  THERMAL_CALCULATION: "VO",
  EXTERNAL_INFLUENCES: "VV",
};

export function complianceFor(eq: EquipmentSeed): ComplianceSeed[] {
  if (eq.type !== "SWITCHBOARD") return [];
  const issuer = eq.tag === "RM1" ? PANEL_BUILDERS.RM1 : PANEL_BUILDERS.default;
  const serial = `${eq.yearInstalled}-${eq.tag.replace(/[^A-Z0-9]/gi, "")}`;
  return (COMPLETE[eq.tag] ?? BASIC).map((category) => {
    const documentNumber = `${DOC_PREFIX[category]}-${serial}${category === "THERMAL_CALCULATION" && eq.tag === "RM1" ? "-630" : ""}`;
    switch (category) {
      case "SINGLE_LINE_DIAGRAM":
        return {
          category,
          title: eq.tag === "RM1" ? "Liniové schéma rozvodny 1. PP – RM1" : `Liniové schéma ${eq.tag}`,
          documentNumber,
          issuer: "Eldock CAE",
          author: "Ing. Lucie Marková",
          notes: "Jednopólové schéma s označením polí a vývodových jističů.",
        };
      case "CONFORMITY_DECLARATION":
        return { category, title: `EU prohlášení o shodě – ${eq.tag}`, documentNumber, issuer, author: "Ing. Martin Šimek", notes: "ČSN EN IEC 61439-1/-2:2021, označení CE." };
      case "ROUTINE_VERIFICATION":
        return { category, title: "Protokol o kusové zkoušce (čl. 11)", documentNumber, issuer, author: "Jiří Kolář", notes: "Elektrická pevnost 2 500 V / 1 s, izolační odpor > 500 MΩ." };
      case "THERMAL_CALCULATION":
        return {
          category,
          title: eq.tag === "RM1" ? "Výpočet oteplení – vývodové pole 630 A" : "Výpočet oteplení rozváděče",
          documentNumber,
          issuer,
          author: "Ing. Martin Šimek",
          notes: "Metoda ztrátového výkonu dle čl. 10.10.4, okolní teplota 35 °C.",
        };
      case "EXTERNAL_INFLUENCES":
        return {
          category,
          title: "Protokol o určení vnějších vlivů",
          documentNumber,
          issuer: "Komise JBL Automotive / Eldock CAE",
          author: "Ing. Tomáš Král",
          notes: externalInfluencesFor(eq),
        };
    }
  });
}
