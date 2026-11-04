// Legislativní paket 2027 (fáze 46): edice norem rozváděčů (ČSN EN IEC 61439 ed. 3, ČSN EN 60204-1
// ed. 3 + Nařízení (EU) 2023/1230), protokol o kusové zkoušce dle čl. 11 ČSN EN IEC 61439-1 ed. 3,
// klasifikace zásahu dle čl. 18 Nařízení (EU) 2023/1230 a LOTO dle ČSN EN 50110-1 ed. 4. Čisté funkce.

import type { SafetyImpactLevel } from "@/generated/prisma/enums";

export type StandardEditionId = "CSN_61439_3_ED2" | "CSN_61439_2_ED3" | "CSN_60204_1_ED3";

export interface StandardEdition {
  id: StandardEditionId;
  label: string;
  /** Krátký zápis do štítku CE a hlavičky dokumentace. */
  short: string;
  /** Harmonizované normy pro EU prohlášení o shodě (List 6). */
  norms: string[];
  /** Směrnice / nařízení EU. */
  directives: string[];
  /** Ověření oteplení (List 5). */
  thermalBasis: string;
  /** Prohlášení: ES (směrnice) nebo EU (nařízení o strojních zařízeních). */
  declarationTitle: string;
}

export const STANDARD_EDITIONS: readonly StandardEdition[] = [
  {
    id: "CSN_61439_3_ED2",
    label: "ČSN EN IEC 61439-1 ed. 3 / ČSN EN IEC 61439-3 ed. 2 (Rozvodnice DBO pro laickou obsluhu – platnost 2027)",
    short: "ČSN EN IEC 61439-3 ed. 2",
    norms: ["ČSN EN IEC 61439-1 ed. 3 – Rozváděče nízkého napětí – Část 1: Všeobecná pravidla", "ČSN EN IEC 61439-3 ed. 2 – Rozváděče nízkého napětí – Část 3: Rozvodnice určené k provozování laiky (DBO)"],
    directives: ["Směrnice o elektrických zařízeních nízkého napětí – LVD 2014/35/EU", "Směrnice o elektromagnetické kompatibilitě – EMC 2014/30/EU", "Směrnice o omezení nebezpečných látek – RoHS 2011/65/EU"],
    thermalBasis: "Ověření oteplení výpočtem dle čl. 10.10.4 ČSN EN IEC 61439-1 ed. 3 (metoda IEC TR 60890)",
    declarationTitle: "EU PROHLÁŠENÍ O SHODĚ",
  },
  {
    id: "CSN_61439_2_ED3",
    label: "ČSN EN IEC 61439-1 ed. 3 / ČSN EN IEC 61439-2 ed. 3 (Výkonové průmyslové rozváděče PSC)",
    short: "ČSN EN IEC 61439-2 ed. 3",
    norms: ["ČSN EN IEC 61439-1 ed. 3 – Rozváděče nízkého napětí – Část 1: Všeobecná pravidla", "ČSN EN IEC 61439-2 ed. 3 – Rozváděče nízkého napětí – Část 2: Výkonové rozváděče (PSC)"],
    directives: ["Směrnice o elektrických zařízeních nízkého napětí – LVD 2014/35/EU", "Směrnice o elektromagnetické kompatibilitě – EMC 2014/30/EU", "Směrnice o omezení nebezpečných látek – RoHS 2011/65/EU"],
    thermalBasis: "Ověření oteplení výpočtem dle čl. 10.10.4 ČSN EN IEC 61439-1 ed. 3 (metoda IEC TR 60890)",
    declarationTitle: "EU PROHLÁŠENÍ O SHODĚ",
  },
  {
    id: "CSN_60204_1_ED3",
    label: "ČSN EN 60204-1 ed. 3 + Nařízení (EU) 2023/1230 (Elektrická zařízení pracovních strojů)",
    short: "ČSN EN 60204-1 ed. 3",
    norms: ["ČSN EN 60204-1 ed. 3 – Bezpečnost strojních zařízení – Elektrická zařízení strojů – Část 1: Všeobecné požadavky", "ČSN EN IEC 61439-1 ed. 3 – Rozváděče nízkého napětí – Část 1: Všeobecná pravidla (rozváděč stroje)"],
    directives: ["Nařízení o strojních výrobcích (EU) 2023/1230", "Směrnice o elektromagnetické kompatibilitě – EMC 2014/30/EU", "Směrnice o omezení nebezpečných látek – RoHS 2011/65/EU"],
    thermalBasis: "Ověření oteplení dle čl. 10.10.4 ČSN EN IEC 61439-1 ed. 3 pro rozváděč stroje dle ČSN EN 60204-1 ed. 3, čl. 11.3",
    declarationTitle: "EU PROHLÁŠENÍ O SHODĚ (Nařízení (EU) 2023/1230)",
  },
];

export const DEFAULT_STANDARD_EDITION: StandardEditionId = "CSN_61439_3_ED2";
export const isStandardEdition = (value: unknown): value is StandardEditionId => STANDARD_EDITIONS.some((edition) => edition.id === value);
export const standardEditionOf = (id: string | null | undefined): StandardEdition => STANDARD_EDITIONS.find((edition) => edition.id === id) ?? STANDARD_EDITIONS[0];

// ---------------------------------------------------------------------------
//  Protokol o kusové zkoušce (čl. 11 ČSN EN IEC 61439-1 ed. 3)
// ---------------------------------------------------------------------------

export const ROUTINE_TEST_POINTS = [
  { id: "ip", clause: "11.2", label: "Stupeň krytí IP" },
  { id: "clearances", clause: "11.3", label: "Vzdušné a povrchové cesty" },
  { id: "protection", clause: "11.4", label: "Ochrana před úrazem elektrickým proudem a spojitost ochranného obvodu (PE)" },
  { id: "devices", clause: "11.5", label: "Vestavěné přístroje" },
  { id: "circuits", clause: "11.6", label: "Vnitřní elektrické obvody a spoje" },
  { id: "terminals", clause: "11.7", label: "Svorky pro vnější vodiče" },
  { id: "mechanical", clause: "11.8", label: "Mechanická funkčnost" },
  { id: "dielectric", clause: "11.9", label: "Dielektrické vlastnosti a izolační odpor R_iso" },
] as const;

export type RoutinePointId = (typeof ROUTINE_TEST_POINTS)[number]["id"];
export type RoutineResult = "PASS" | "FAIL" | null;

export interface RoutineTest {
  points: Record<RoutinePointId, RoutineResult>;
  /** Izolační odpor [MΩ] (měření dle čl. 11.9 alternativou ke zkoušce napětím). */
  insulationMOhm: number | null;
  testedBy: string;
  /** ISO datum zkoušky. */
  testedAt: string | null;
  note: string;
}

export const emptyRoutineTest = (): RoutineTest => ({
  points: Object.fromEntries(ROUTINE_TEST_POINTS.map((point) => [point.id, null])) as Record<RoutinePointId, RoutineResult>,
  insulationMOhm: null,
  testedBy: "",
  testedAt: null,
  note: "",
});

/** Min. izolační odpor: 1 000 Ω/V vůči napětí obvodu proti zemi (čl. 11.9) – 230 V → 0,23 MΩ. */
export const minInsulationMOhm = (voltageToEarth = 230) => Math.round(voltageToEarth * 1000) / 1_000_000;

export function parseRoutineTest(json: string | null | undefined): RoutineTest {
  const base = emptyRoutineTest();
  if (!json) return base;
  try {
    const value = JSON.parse(json) as Partial<RoutineTest>;
    for (const point of ROUTINE_TEST_POINTS) {
      const result = value.points?.[point.id];
      base.points[point.id] = result === "PASS" || result === "FAIL" ? result : null;
    }
    base.insulationMOhm = typeof value.insulationMOhm === "number" && Number.isFinite(value.insulationMOhm) && value.insulationMOhm >= 0 ? value.insulationMOhm : null;
    base.testedBy = typeof value.testedBy === "string" ? value.testedBy.slice(0, 120) : "";
    base.testedAt = typeof value.testedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.testedAt) ? value.testedAt : null;
    base.note = typeof value.note === "string" ? value.note.slice(0, 1000) : "";
    return base;
  } catch {
    return base;
  }
}

export type RoutineVerdict = "INCOMPLETE" | "PASS" | "FAIL";

/** Vyhodnocení: všech 8 bodů vyhovuje a R_iso ≥ 1 000 Ω/V = VYHOVUJE; chybí-li bod nebo R_iso = NEÚPLNÝ. */
export function routineTestVerdict(test: RoutineTest, voltageToEarth = 230): { verdict: RoutineVerdict; missing: string[]; insulationOk: boolean | null } {
  const missing: string[] = ROUTINE_TEST_POINTS.filter((point) => test.points[point.id] === null).map((point) => point.label);
  const insulationOk = test.insulationMOhm === null ? null : test.insulationMOhm >= minInsulationMOhm(voltageToEarth);
  if (insulationOk === null) missing.push("Izolační odpor R_iso");
  if (!test.testedBy.trim()) missing.push("Zkoušku provedl");
  const failed = ROUTINE_TEST_POINTS.some((point) => test.points[point.id] === "FAIL") || insulationOk === false;
  return { verdict: failed ? "FAIL" : missing.length ? "INCOMPLETE" : "PASS", missing, insulationOk };
}

// ---------------------------------------------------------------------------
//  Klasifikace zásahu dle Nařízení (EU) 2023/1230 a LOTO dle ČSN EN 50110-1 ed. 4
// ---------------------------------------------------------------------------

export const SAFETY_IMPACT: Record<SafetyImpactLevel, { label: string; short: string; tone: "green" | "yellow" | "red" }> = {
  NONE_1_TO_1: { label: "🟢 Běžná údržba / Výměna 1:1 (nemění funkci ani bezpečnost)", short: "Výměna 1:1", tone: "green" },
  OPERATIONAL_ONLY: { label: "🟡 Provozní úprava zapojení (bez zásahu do bezpečnostních obvodů)", short: "Provozní úprava", tone: "yellow" },
  SUBSTANTIAL_SAFETY_MOD: { label: "🔴 Zásah do bezpečnostního obvodu / Safety PLC (Podstatná změna dle čl. 18 Nařízení EU 2023/1230!)", short: "Podstatná změna – bezpečnost", tone: "red" },
};

export const SUBSTANTIAL_MOD_WARNING =
  "Podstatná změna dle čl. 18 Nařízení (EU) 2023/1230: zásah vyžaduje schválení vedoucím údržby, ověření Safety CRC bezpečnostního programu a posouzení shody (případně nové EU prohlášení o shodě).";

/** 5 bezpečnostních pravidel pro zajištění pracoviště (ČSN EN 50110-1 ed. 4, čl. 6.2). */
export const FIVE_SAFETY_RULES = [
  "Vypnout a úplně odpojit od zdroje",
  "Zajistit proti opětovnému zapnutí (zámek LOTO, visačka)",
  "Ověřit beznapěťový stav na všech pólech",
  "Uzemnit a zkratovat",
  "Zakrýt nebo ohradit sousední části pod napětím",
] as const;

/** Odpovědné osoby dle ČSN EN 50110-1 ed. 4. */
export const LOTO_ROLES = [
  { code: "OOEZ", label: "Osoba odpovědná za elektrické zařízení", duty: "Odpovídá za bezpečný provoz zařízení a povoluje odpojení." },
  { code: "OPŘPČ", label: "Osoba pověřená řízením pracovní činnosti", duty: "Řídí práci na místě, ověřuje zajištění pracoviště a předání do provozu." },
] as const;

export const QR_LEGAL_NOTE = "Digitální provozní dokumentace dle čl. 10 Nařízení (EU) 2023/1230 a ČSN EN 50110-1 ed. 4";
