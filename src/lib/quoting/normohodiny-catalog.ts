// Fáze 105: matice normohodin (NH) elektromontážních prací a výroby rozváděčů – interní podklad kalkulace cenové
// nabídky. Do výstupu pro zákazníka se nic z tohoto souboru nepropisuje (jen ceny práce v Kč po kapitolách / položkách).
// Verze matice se zvyšuje při každé úpravě hodnot; uložená kalibrace firmy si pamatuje verzi, ze které vznikla
// (`nhUpdateAvailable`), a úpravy jednotlivých úkonů zůstávají i po převzetí nové verze.

export const NH_VERSION = "NH-2026.11";

export type NhChapter = "installation" | "switchboard" | "testing";
export type NhUnit = "m" | "ks" | "rozváděč" | "okruh" | "zpráva";

export interface NhTask {
  id: string;
  chapter: NhChapter;
  label: string;
  unit: NhUnit;
  /** Normohodiny na jednotku. */
  nh: number;
  /** Práce závisí na konstrukci budovy (drážkování, vrtání do zdiva) – násobí se koeficientem stavby. */
  construction: boolean;
}

export const NH_TASKS: readonly NhTask[] = [
  // Elektroinstalace v půdorysu
  { id: "chase-light", chapter: "installation", label: "Vysekání drážky, uložení kabelu a zasádrování ve zdivu (kabely do 3×2,5)", unit: "m", nh: 0.12, construction: true },
  { id: "chase-power", chapter: "installation", label: "Vysekání drážky, uložení kabelu a zasádrování ve zdivu (silové kabely 5×2,5 až 5×10)", unit: "m", nh: 0.16, construction: true },
  { id: "cable-dry", chapter: "installation", label: "Uložení kabelu v SDK / podhledu / žlabu", unit: "m", nh: 0.06, construction: false },
  { id: "box", chapter: "installation", label: "Vyvrtání otvoru a osazení instalační krabice do zdiva", unit: "ks", nh: 0.35, construction: true },
  { id: "box-deep", chapter: "installation", label: "Vyvrtání otvoru a osazení hluboké instalační krabice (KPR 68)", unit: "ks", nh: 0.4, construction: true },
  { id: "box-sdk", chapter: "installation", label: "Osazení instalační krabice do SDK (KPR 68/L)", unit: "ks", nh: 0.18, construction: false },
  { id: "device", chapter: "installation", label: "Zapojení a kompletace zásuvky / vypínače / ovladače (strojek + kryt + rámeček)", unit: "ks", nh: 0.25, construction: false },
  { id: "device-data", chapter: "installation", label: "Zapojení datové zásuvky RJ45 Cat6A / sběrnicového prvku", unit: "ks", nh: 0.35, construction: false },
  { id: "light", chapter: "installation", label: "Montáž a zapojení svítidla", unit: "ks", nh: 0.45, construction: false },
  { id: "light-strip", chapter: "installation", label: "Montáž LED pásku s profilem a zdrojem", unit: "ks", nh: 0.8, construction: false },
  { id: "appliance", chapter: "installation", label: "Připojení samostatného spotřebiče (varná deska, bojler, TČ, wallbox)", unit: "ks", nh: 0.75, construction: false },
  // Výroba a osazení rozváděče
  { id: "enclosure-s", chapter: "switchboard", label: "Osazení a zazdění / upevnění skříně rozváděče do 36 M", unit: "ks", nh: 1.5, construction: true },
  { id: "enclosure-m", chapter: "switchboard", label: "Osazení a zazdění / upevnění skříně rozváděče 48–120 M", unit: "ks", nh: 2.5, construction: true },
  { id: "enclosure-l", chapter: "switchboard", label: "Osazení a zazdění / upevnění skříně rozváděče nad 120 M", unit: "ks", nh: 4, construction: true },
  { id: "din-1p", chapter: "switchboard", label: "Montáž a prodrátování 1pólového jističe / modulu na DIN lištu", unit: "ks", nh: 0.25, construction: false },
  { id: "din-3p", chapter: "switchboard", label: "Montáž a prodrátování 3pólového jističe / chrániče RCD / RCBO / SPD", unit: "ks", nh: 0.45, construction: false },
  { id: "din-smart", chapter: "switchboard", label: "Montáž a oživení aktoru / modulu chytré domácnosti (SA-M, JA-M, Miniserver, SysAP)", unit: "ks", nh: 0.65, construction: false },
  { id: "board-finish", chapter: "switchboard", label: "Zapojení PE / N sběrnic, popis okruhů, kusová zkouška dle ČSN EN IEC 61439 a dokumentace", unit: "rozváděč", nh: 2, construction: false },
  // Zkoušky a výchozí revize
  { id: "test-circuit", chapter: "testing", label: "Měření a výchozí revize okruhu (R_iso, Z_s, RCD)", unit: "okruh", nh: 0.35, construction: false },
  { id: "test-report", chapter: "testing", label: "Vypracování zprávy o výchozí revizi", unit: "zpráva", nh: 1.5, construction: false },
];

export type NhTaskId = (typeof NH_TASKS)[number]["id"];

/** Konstrukce budovy – koeficient náročnosti drážkování a montáže. */
export const CONSTRUCTIONS = [
  { id: "aac", label: "Porobeton (Ytong) / dutá cihla", factor: 1 },
  { id: "drywall", label: "Sádrokarton (SDK) / dřevostavba", factor: 0.75 },
  { id: "brick", label: "Plná cihla / smíšené zdivo", factor: 1.15 },
  { id: "concrete", label: "Železobeton / panel", factor: 1.35 },
] as const;
export type ConstructionId = (typeof CONSTRUCTIONS)[number]["id"];
export const constructionOf = (id: string | null | undefined) => CONSTRUCTIONS.find((entry) => entry.id === id) ?? CONSTRUCTIONS[0];

/** Kalibrace firmy: vlastní hodnoty úkonů a koeficient rychlosti z odpracovaných zakázek. */
export interface NhCalibration {
  version: string;
  overrides: Record<string, number>;
  /** Koeficient firmy (skutečné hodiny / hodiny podle matice), 0,5–2. */
  factor: number;
  /** Zakázky, ze kterých koeficient vznikl (vážený průměr). */
  samples: number;
}

export const DEFAULT_CALIBRATION: NhCalibration = { version: NH_VERSION, overrides: {}, factor: 1, samples: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseCalibration(value: unknown): NhCalibration {
  if (!value || typeof value !== "object") return DEFAULT_CALIBRATION;
  const raw = value as Partial<NhCalibration>;
  const overrides: Record<string, number> = {};
  for (const task of NH_TASKS) {
    const own = raw.overrides?.[task.id];
    if (typeof own === "number" && Number.isFinite(own) && own >= 0 && own <= 50) overrides[task.id] = Math.round(own * 1000) / 1000;
  }
  const factor = typeof raw.factor === "number" && Number.isFinite(raw.factor) ? clamp(raw.factor, 0.5, 2) : 1;
  const samples = typeof raw.samples === "number" && Number.isInteger(raw.samples) && raw.samples >= 0 ? raw.samples : 0;
  return { version: typeof raw.version === "string" ? raw.version.slice(0, 20) : NH_VERSION, overrides, factor: Math.round(factor * 1000) / 1000, samples };
}

/** Normohodiny úkonu po kalibraci firmy (vlastní hodnota má přednost před maticí). */
export const nhOf = (task: NhTask, calibration: NhCalibration = DEFAULT_CALIBRATION) => calibration.overrides[task.id] ?? task.nh;

/** Nová verze matice od poslední kalibrace (výzva k převzetí, vlastní úpravy úkonů zůstávají). */
export const nhUpdateAvailable = (calibration: NhCalibration) => calibration.version !== NH_VERSION;

/**
 * „Skutečně odpracováno X hodin“ po dokončení zakázky → nový koeficient firmy: vážený průměr dosavadního koeficientu
 * (podle počtu zakázek, nejvýš 10) a poměru skutečných hodin k hodinám kalkulace. Hodiny kalkulace jsou už po
 * dosavadním koeficientu, poměr se proto vztahuje k matici bez koeficientu.
 */
export function calibrateFromActual(calibration: NhCalibration, input: { plannedHours: number; actualHours: number }): NhCalibration {
  if (!(input.plannedHours > 0) || !(input.actualHours > 0)) return calibration;
  const base = input.plannedHours / calibration.factor;
  const observed = clamp(input.actualHours / base, 0.5, 2);
  const weight = Math.min(10, calibration.samples);
  const factor = clamp((calibration.factor * weight + observed) / (weight + 1), 0.5, 2);
  return { ...calibration, version: NH_VERSION, factor: Math.round(factor * 1000) / 1000, samples: calibration.samples + 1 };
}
