// Fáze 116: oficiální technické listy součástek z kusovníku – jen údaje ověřené z dokumentů výrobce (u každé
// položky zdroj a datum ověření). Díl, který tu není, má v kusovníku životnost podle kategorie označenou „odhad“
// a technický list jen s údaji z kusovníku. Čistá data (karta zařízení, kusovník, Návody & Datasheety, testy).

export type DatasheetLifespan = {
  /** B10d při jmenovitém zatížení (ČSN EN ISO 13849-1) [cykly]. */
  b10dCycles?: number;
  b10dCondition?: string;
  /** B10d při mechanickém zatížení [cykly]. */
  b10dMechanicalCycles?: number;
  /** Elektrická životnost [cykly] a podmínka (kategorie užití, proud, napětí). */
  electricalCycles?: number;
  electricalCondition?: string;
  mechanicalCycles?: number;
  /** Nejvyšší provozní četnost [cykly / h]. */
  maxOperatingRatePerHour?: number;
  /** Životnost ložisek ventilátoru L10 [h] při teplotě [°C]. */
  fanL10Hours?: number;
  fanL10TempC?: number;
  mtbfHours?: number;
  mtbfCondition?: string;
};

export type TerminalKind = "main" | "coil" | "no" | "nc" | "supply" | "output";

/** Dvojice svorek ve schématu zapojení (např. hlavní kontakt 1/L1 – 2/T1, cívka A1 – A2, pomocný 13 – 14). */
export interface TerminalPair {
  from: string;
  to: string;
  kind: TerminalKind;
}

export interface ComponentDatasheet {
  manufacturer: string;
  /** Objednací číslo přesně podle výrobce. */
  partNumber: string;
  title: string;
  /** Klíčové parametry výrobce (popisek → hodnota). */
  ratings: { label: string; value: string }[];
  lifespan: DatasheetLifespan;
  /** Ztrátový výkon na pól [W] (AC-3 u stykače) – výpočet oteplení IEC TR 60890. */
  lossPerPoleW?: number;
  poles?: number;
  dimensionsMm?: { w: number; h: number; d: number };
  weightKg?: number;
  terminals?: TerminalPair[];
  terminalsNote?: string;
  datasheetUrl?: string;
  productUrl?: string;
  /** Odkud jsou údaje a kdy byly ověřeny. */
  source: string;
}

/** Klíč objednacího čísla: velká písmena bez mezer (LC1D25BD, SK3238.100). */
export const partKeyOf = (partNumber: string | null | undefined) => (partNumber ?? "").trim().toUpperCase().replace(/\s+/g, "");

const SCHNEIDER_LC1D25BD: ComponentDatasheet = {
  manufacturer: "Schneider Electric",
  partNumber: "LC1D25BD",
  title: "Stykač TeSys Deca 3P (3 Z) 25 A AC-3 440 V, pomocné kontakty 1 Z + 1 V, cívka 24 V DC",
  ratings: [
    { label: "Jmenovitý pracovní proud Ie", value: "25 A AC-3 / AC-3e (≤ 440 V, < 60 °C) · 40 A AC-1" },
    { label: "Výkon motoru AC-3", value: "11 kW při 380/400 V · 5,5 kW při 220/230 V" },
    { label: "Ovládací napětí Uc", value: "24 V DC (standardní DC cívka s odrušovací diodou)" },
    { label: "Příkon cívky", value: "5,4 W při 20 °C (přítah i přídržný)" },
    { label: "Pomocné kontakty", value: "1 Z + 1 V (mechanicky svázané, IEC 60947-5-1)" },
    { label: "Jmenovité izolační napětí Ui", value: "690 V (IEC 60947-4-1)" },
    { label: "Krytí čela", value: "IP20 (IEC 60529)" },
    { label: "Teplota okolí", value: "−40 … 60 °C (60 … 70 °C se snížením zatížení)" },
  ],
  lifespan: {
    b10dCycles: 1_369_863,
    b10dCondition: "stykač s jmenovitým zatížením podle EN/ISO 13849-1",
    b10dMechanicalCycles: 20_000_000,
    electricalCycles: 1_650_000,
    electricalCondition: "25 A AC-3 při Ue ≤ 440 V",
    mechanicalCycles: 30_000_000,
    maxOperatingRatePerHour: 3600,
  },
  lossPerPoleW: 1.25,
  poles: 3,
  dimensionsMm: { w: 45, h: 85, d: 101 },
  weightKg: 0.53,
  terminals: [
    { from: "1/L1", to: "2/T1", kind: "main" },
    { from: "3/L2", to: "4/T2", kind: "main" },
    { from: "5/L3", to: "6/T3", kind: "main" },
    { from: "A1", to: "A2", kind: "coil" },
    { from: "13", to: "14", kind: "no" },
    { from: "21", to: "22", kind: "nc" },
  ],
  terminalsNote: "Značení svorek podle ČSN EN 60947-1 a EN 50012 (pomocné kontakty 1 Z + 1 V podle technického listu).",
  datasheetUrl: "https://www.se.com/cz/cs/product/download-pdf/LC1D25BD?filename=Schneider+Electric_TeSys-Deca-styka%25C4%258De_LC1D25BD.pdf",
  productUrl: "https://www.se.com/cz/cs/product/LC1D25BD/",
  source: "Technický list Schneider Electric LC1D25BD (se.com, ověřeno 14. 11. 2026)",
};

const RITTAL_FAN: ComponentDatasheet = {
  manufacturer: "Rittal",
  partNumber: "SK 3238.100",
  title: "Filtrační ventilátor TopTherm 230 V, 1~, 50/60 Hz, IP 54, vč. filtrační rohože ze sekaných vláken",
  ratings: [
    { label: "Průtok vzduchu", value: "52 / 63 m³/h (50 / 60 Hz) s rohoží ze sekaných vláken · 63 / 72 m³/h se skládaným filtrem" },
    { label: "Jmenovité napětí", value: "230 V, 1~, 50/60 Hz" },
    { label: "Jmenovitý proud", value: "0,12 / 0,09 A (50 / 60 Hz)" },
    { label: "Provozní teplota", value: "−15 … 55 °C" },
    { label: "Montážní výřez", value: "124 × 124 mm" },
  ],
  lifespan: { fanL10Hours: 68_200, fanL10TempC: 40 },
  dimensionsMm: { w: 148.5, h: 148.5, d: 58.5 },
  weightKg: 0.9,
  terminals: [
    { from: "L", to: "N", kind: "supply" },
  ],
  productUrl: "https://www.rittal.com/com-en/product/show/variantdetail.action?productID=3238100",
  source: "Produktová stránka Rittal SK 3238.100 (rittal.com, ověřeno 14. 11. 2026); hloubka = montážní hloubka",
};

const RITTAL_OUTLET: ComponentDatasheet = {
  manufacturer: "Rittal",
  partNumber: "SK 3238.200",
  title: "Výstupní filtr Standard pro TopTherm SK 3238.1xx, vč. filtrační rohože ze sekaných vláken",
  ratings: [
    { label: "Použití", value: "Odvod vzduchu (horní / spodní část skříně) k filtračnímu ventilátoru SK 3238.1xx" },
    { label: "Průtok s ventilátorem SK 3238.100", value: "1 × výstupní filtr 36 / 42 m³/h · 2 × 46 / 54 m³/h (50 / 60 Hz)" },
    { label: "Materiál", value: "ABS, RAL 7035" },
    { label: "Montážní výřez", value: "124 × 124 mm" },
  ],
  lifespan: {},
  dimensionsMm: { w: 148.5, h: 148.5, d: 24 },
  weightKg: 0.17,
  productUrl: "https://www.rittal.com/com-en/product/show/variantdetail.action?productID=3238200",
  source: "Produktová stránka Rittal SK 3238.200 (rittal.com, ověřeno 14. 11. 2026)",
};

const CATALOG: readonly ComponentDatasheet[] = [SCHNEIDER_LC1D25BD, RITTAL_FAN, RITTAL_OUTLET];
const BY_KEY = new Map(CATALOG.map((sheet) => [partKeyOf(sheet.partNumber), sheet]));

/** Ověřený technický list podle objednacího čísla (přesná shoda bez mezer a velikosti písmen). */
export function datasheetFor(partNumber: string | null | undefined): ComponentDatasheet | null {
  const key = partKeyOf(partNumber);
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

export const VERIFIED_DATASHEETS = CATALOG;

/** Zdrojová hodnota životnosti z technického listu (B10d → elektrická životnost → L10 / MTBF). */
export function datasheetLimit(sheet: ComponentDatasheet | null): { cycles?: number; cyclesLabel?: string; hours?: number; hoursLabel?: string } {
  if (!sheet) return {};
  const { lifespan } = sheet;
  if (lifespan.b10dCycles) return { cycles: lifespan.b10dCycles, cyclesLabel: `B10d ${lifespan.b10dCycles.toLocaleString("cs-CZ")} cyklů (${lifespan.b10dCondition ?? "výrobce"})` };
  if (lifespan.electricalCycles) return { cycles: lifespan.electricalCycles, cyclesLabel: `elektrická životnost ${lifespan.electricalCycles.toLocaleString("cs-CZ")} cyklů (${lifespan.electricalCondition ?? "výrobce"})` };
  if (lifespan.fanL10Hours) return { hours: lifespan.fanL10Hours, hoursLabel: `L10 ${lifespan.fanL10Hours.toLocaleString("cs-CZ")} h při ${lifespan.fanL10TempC ?? 40} °C` };
  return {};
}
