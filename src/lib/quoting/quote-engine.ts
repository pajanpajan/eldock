// Fáze 105: generátor cenové nabídky (2D půdorys, rozváděč i kompletní zakázka).
//
// Materiál = ceníkové ceny výrobců (bez individuálního rabatu firmy) s obchodní úpravou pro zákazníka, práce = matice
// normohodin (NH-2026.11, kalibrace firmy) × hodinová sazba × koeficient konstrukce stavby. Výpočet vrací dvě části:
// `internal` (jen pro elektrikáře v aplikaci – zdroje cen, hodiny, chybějící ceny) a `customer` (nabídka pro zákazníka).
// Ve výstupu pro zákazníka nesmí být zmínka o ceníkových cenách, normohodinách ani rabatu (`assertCustomerSafe`).

import { CONSTRUCTIONS, DEFAULT_CALIBRATION, NH_TASKS, NH_VERSION, constructionOf, nhOf, type ConstructionId, type NhCalibration, type NhTask } from "./normohodiny-catalog";

export type QuoteScope = "complete" | "floorplan" | "switchboard";
export type QuoteLayout = "items" | "chapters";
export type VatRate = 12 | 21;
export type QuoteUnit = "ks" | "m" | "kpl";
export type QuoteChapterId = "material" | "installation" | "switchboard" | "testing";

export const QUOTE_SCOPES: readonly { id: QuoteScope; icon: string; label: string }[] = [
  { id: "complete", icon: "🏠", label: "Kompletní zakázka (2D elektroinstalace + Rozváděč + Revize)" },
  { id: "floorplan", icon: "📐", label: "Pouze rozvody a přístroje z 2D půdorysu" },
  { id: "switchboard", icon: "⚡", label: "Pouze výroba a osazení rozváděče" },
];

/** Kapitoly nabídky pro zákazníka (pevné názvy). */
export const QUOTE_CHAPTERS: Record<QuoteChapterId, string> = {
  material: "Dodávka elektroinstalačního materiálu",
  installation: "Elektromontážní a instalační práce",
  switchboard: "Kompletace a zapojení rozváděče",
  testing: "Zkoušky, měření a výchozí revize",
};

export const VAT_OPTIONS: readonly { rate: VatRate; label: string }[] = [
  { rate: 12, label: "12 % DPH – bytová výstavba / RD a byty dle § 48 zák. o DPH" },
  { rate: 21, label: "21 % DPH – komerční a průmyslové objekty" },
];

export const DISCOUNT_PRESETS = [0, 5, 10, 15] as const;
export const DEFAULT_HOURLY_RATE = 650;
export const DEFAULT_VALIDITY_DAYS = 14;

/** Položka materiálu (kusovník půdorysu nebo rozváděče) s ceníkovou cenou za jednotku bez DPH. */
export interface QuoteMaterial {
  key: string;
  name: string;
  /** Objednací číslo výrobce (zákazník ho v nabídce vidí jako specifikaci). */
  code?: string | null;
  quantity: number;
  unit: QuoteUnit;
  section: "floorplan" | "switchboard";
  /** Ceníková cena výrobce za jednotku bez DPH; null = cena chybí (doplní elektrikář). */
  listPriceCzk: number | null;
  /** Zdroj ceny (interní). */
  priceSource?: string | null;
  /** Druh položky pro dohledání ceny (kabel podle označení za metr, krabice, přístroj podle objednacího čísla). */
  priceKind?: "cable" | "box" | "device";
  /** EAN a výrobce pro poptávku do velkoobchodu. */
  ean?: string | null;
  manufacturer?: string | null;
}

/** Množství pro výpočet práce. */
export interface QuoteWork {
  /** Kabely do 3×2,5 / silové 5×2,5–5×10 [m]. */
  lightCableM: number;
  powerCableM: number;
  boxes: number;
  deepBoxes: number;
  devices: number;
  dataDevices: number;
  lights: number;
  lightStrips: number;
  appliances: number;
  /** Skříně rozváděčů podle velikosti (moduly). */
  enclosureModules: readonly number[];
  din1p: number;
  din3p: number;
  dinSmart: number;
  circuits: number;
}

export const EMPTY_WORK: QuoteWork = { lightCableM: 0, powerCableM: 0, boxes: 0, deepBoxes: 0, devices: 0, dataDevices: 0, lights: 0, lightStrips: 0, appliances: 0, enclosureModules: [], din1p: 0, din3p: 0, dinSmart: 0, circuits: 0 };

export interface QuoteParty {
  name: string;
  ico?: string | null;
  dic?: string | null;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface QuoteOptions {
  scope: QuoteScope;
  hourlyRate: number;
  construction: ConstructionId;
  /** Obchodní úprava ceníkových cen materiálu pro zákazníka [%, kladné = sleva]. */
  discountPct: number;
  vatRate: VatRate;
  layout: QuoteLayout;
  number: string;
  issuedAt: string;
  validityDays: number;
  customer: QuoteParty;
  supplier: QuoteParty;
  title: string;
  calibration?: NhCalibration;
  /** Ceny doplněné elektrikářem k položkám bez ceníkové ceny (klíč položky → Kč bez DPH za jednotku). */
  manualPrices?: Readonly<Record<string, number>>;
}

export interface QuoteLine {
  name: string;
  code?: string | null;
  quantity: number;
  unit: QuoteUnit;
  unitPriceCzk: number;
  totalCzk: number;
}

export interface CustomerQuote {
  number: string;
  title: string;
  issuedAt: string;
  validUntil: string;
  supplier: QuoteParty;
  customer: QuoteParty;
  layout: QuoteLayout;
  chapters: { id: QuoteChapterId; title: string; lines: QuoteLine[]; totalCzk: number }[];
  totals: { withoutVatCzk: number; vatRate: VatRate; vatCzk: number; withVatCzk: number };
  notes: string[];
}

export interface InternalLabor {
  task: NhTask;
  quantity: number;
  /** Hodiny po koeficientu stavby a kalibraci firmy. */
  hours: number;
  priceCzk: number;
}

export interface QuoteInternal {
  nhVersion: string;
  calibrationFactor: number;
  constructionFactor: number;
  laborHours: number;
  labor: InternalLabor[];
  /** Materiál v ceníkových cenách (před obchodní úpravou) [Kč bez DPH]. */
  materialListCzk: number;
  materialCustomerCzk: number;
  /** Položky bez ceníkové ceny (a bez ručně doplněné ceny) – v nabídce za 0 Kč, upozornit elektrikáře. */
  missingPrices: QuoteMaterial[];
  pricedFrom: { source: string; lines: number }[];
}

export interface QuoteResult {
  customer: CustomerQuote;
  internal: QuoteInternal;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const roundCzk = (value: number) => Math.round(value);

/** Názvy úkonů pro zákazníka (bez interní terminologie kalkulace). */
const CUSTOMER_WORK: Record<string, { name: string; unit: QuoteUnit }> = {
  "chase-light": { name: "Uložení instalačních kabelů pod omítku včetně drážek a zapravení", unit: "m" },
  "chase-power": { name: "Uložení silových kabelů pod omítku včetně drážek a zapravení", unit: "m" },
  "cable-dry": { name: "Uložení kabelů v sádrokartonu, podhledu nebo žlabu", unit: "m" },
  box: { name: "Osazení instalačních krabic", unit: "ks" },
  "box-deep": { name: "Osazení hlubokých instalačních krabic", unit: "ks" },
  "box-sdk": { name: "Osazení instalačních krabic do sádrokartonu", unit: "ks" },
  device: { name: "Montáž a zapojení zásuvek, vypínačů a ovladačů", unit: "ks" },
  "device-data": { name: "Montáž a zapojení datových zásuvek a sběrnicových prvků", unit: "ks" },
  light: { name: "Montáž a zapojení svítidel", unit: "ks" },
  "light-strip": { name: "Montáž LED pásků s profilem a zdrojem", unit: "ks" },
  appliance: { name: "Připojení spotřebičů (varná deska, bojler, tepelné čerpadlo, wallbox)", unit: "ks" },
  "enclosure-s": { name: "Osazení skříně rozváděče", unit: "ks" },
  "enclosure-m": { name: "Osazení skříně rozváděče", unit: "ks" },
  "enclosure-l": { name: "Osazení skříně rozváděče", unit: "ks" },
  "din-1p": { name: "Montáž a zapojení jednopólových přístrojů rozváděče", unit: "ks" },
  "din-3p": { name: "Montáž a zapojení vícepólových jističů, chráničů a přepěťových ochran", unit: "ks" },
  "din-smart": { name: "Montáž a oživení modulů chytré domácnosti", unit: "ks" },
  "board-finish": { name: "Zapojení sběrnic, popis okruhů, kusová zkouška a dokumentace rozváděče", unit: "kpl" },
  "test-circuit": { name: "Měření a výchozí revize elektrických okruhů", unit: "ks" },
  "test-report": { name: "Zpráva o výchozí revizi elektrické instalace", unit: "kpl" },
};

const TASK_CHAPTER: Record<string, QuoteChapterId> = { installation: "installation", switchboard: "switchboard", testing: "testing" };

/** Množství úkonů z výkazu (konstrukce SDK = uložení v SDK a krabice do SDK). */
export function laborQuantities(work: QuoteWork, scope: QuoteScope, construction: ConstructionId): Record<string, number> {
  const floor = scope !== "switchboard";
  const board = scope !== "floorplan";
  const dry = construction === "drywall";
  const quantities: Record<string, number> = {};
  if (floor) {
    if (dry) quantities["cable-dry"] = work.lightCableM + work.powerCableM;
    else {
      quantities["chase-light"] = work.lightCableM;
      quantities["chase-power"] = work.powerCableM;
    }
    if (dry) quantities["box-sdk"] = work.boxes + work.deepBoxes;
    else {
      quantities.box = work.boxes;
      quantities["box-deep"] = work.deepBoxes;
    }
    quantities.device = work.devices;
    quantities["device-data"] = work.dataDevices;
    quantities.light = work.lights;
    quantities["light-strip"] = work.lightStrips;
    quantities.appliance = work.appliances;
  }
  if (board) {
    for (const modules of work.enclosureModules) {
      const id = modules <= 36 ? "enclosure-s" : modules <= 120 ? "enclosure-m" : "enclosure-l";
      quantities[id] = (quantities[id] ?? 0) + 1;
    }
    quantities["din-1p"] = work.din1p;
    quantities["din-3p"] = work.din3p;
    quantities["din-smart"] = work.dinSmart;
    quantities["board-finish"] = Math.max(work.enclosureModules.length, work.din1p + work.din3p + work.dinSmart > 0 ? 1 : 0);
  }
  // Revize: u samotného rozváděče jen jeho okruhy (bez zprávy o revizi celé instalace)
  if (scope !== "switchboard" || work.circuits) {
    quantities["test-circuit"] = work.circuits;
    quantities["test-report"] = scope === "switchboard" ? 0 : work.circuits ? 1 : 0;
  }
  return quantities;
}

/** Slova kalkulace, která do nabídky pro zákazníka nepatří (interní podklady). */
export const CUSTOMER_FORBIDDEN = [/ceníkov/i, /normohodin/i, /\bNH\b/, /rabat/i];

/** Název výrobku pro zákazníka: nožové pojistky NH se v ČR značí PN (bez interní zkratky kalkulace). */
export const customerText = (text: string) => text.replace(/\bNH(?=[\s-]?\d|\b)/g, "PN");

/** Kontrola výstupu pro zákazníka – vyhodí chybu, pokud by v nabídce zůstal interní pojem. */
export function assertCustomerSafe(quote: CustomerQuote): CustomerQuote {
  const text = JSON.stringify(quote);
  for (const pattern of CUSTOMER_FORBIDDEN) if (pattern.test(text)) throw new Error(`Nabídka pro zákazníka obsahuje interní pojem (${pattern}).`);
  return quote;
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Vypočte nabídku: materiál z ceníkových cen s obchodní úpravou, práce z normohodin, DPH, kapitoly / položky. */
export function buildQuote(materials: readonly QuoteMaterial[], work: QuoteWork, options: QuoteOptions): QuoteResult {
  const calibration = options.calibration ?? DEFAULT_CALIBRATION;
  const construction = constructionOf(options.construction);
  const rate = Math.max(0, options.hourlyRate);
  const discount = Math.min(90, Math.max(-100, options.discountPct)) / 100;
  const wanted = (section: QuoteMaterial["section"]) => options.scope === "complete" || (options.scope === "floorplan" ? section === "floorplan" : section === "switchboard");

  // Materiál
  const used = materials.filter((item) => wanted(item.section) && item.quantity > 0);
  const missingPrices: QuoteMaterial[] = [];
  const sources = new Map<string, number>();
  let materialListCzk = 0;
  const materialLines: QuoteLine[] = used.map((item) => {
    const manual = options.manualPrices?.[item.key];
    const list = item.listPriceCzk ?? null;
    if (list === null && manual === undefined) missingPrices.push(item);
    if (list !== null && item.priceSource) sources.set(item.priceSource, (sources.get(item.priceSource) ?? 0) + 1);
    // Ručně doplněná cena je už cena pro zákazníka (bez další úpravy); ceníková cena projde obchodní úpravou
    const unitPriceCzk = manual !== undefined ? round2(manual) : list !== null ? round2(list * (1 - discount)) : 0;
    if (list !== null) materialListCzk += list * item.quantity;
    return { name: customerText(item.name), code: item.code ? customerText(item.code) : null, quantity: item.quantity, unit: item.unit, unitPriceCzk, totalCzk: round2(unitPriceCzk * item.quantity) };
  });

  // Práce
  const quantities = laborQuantities(work, options.scope, construction.id);
  const labor: InternalLabor[] = [];
  const workLines = new Map<QuoteChapterId, QuoteLine[]>();
  for (const task of NH_TASKS) {
    const quantity = Math.round((quantities[task.id] ?? 0) * 10) / 10;
    if (!(quantity > 0)) continue;
    const perUnitHours = nhOf(task, calibration) * (task.construction ? construction.factor : 1) * calibration.factor;
    const hours = perUnitHours * quantity;
    const unitPriceCzk = round2(perUnitHours * rate);
    const priceCzk = round2(unitPriceCzk * quantity);
    labor.push({ task, quantity, hours: round2(hours), priceCzk });
    const chapter = TASK_CHAPTER[task.chapter];
    const shown = CUSTOMER_WORK[task.id];
    const lines = workLines.get(chapter) ?? [];
    // Stejný název (skříně různé velikosti) = jedna řádka s průměrnou jednotkovou cenou
    const same = lines.find((line) => line.name === shown.name && line.unit === shown.unit);
    if (same) {
      same.quantity = Math.round((same.quantity + quantity) * 10) / 10;
      same.totalCzk = round2(same.totalCzk + priceCzk);
      same.unitPriceCzk = round2(same.totalCzk / same.quantity);
    } else lines.push({ name: shown.name, quantity, unit: shown.unit, unitPriceCzk, totalCzk: priceCzk });
    workLines.set(chapter, lines);
  }

  const chapterTotal = (lines: readonly QuoteLine[]) => round2(lines.reduce((sum, line) => sum + line.totalCzk, 0));
  const itemized = (["material", "installation", "switchboard", "testing"] as const)
    .map((id) => ({ id, title: QUOTE_CHAPTERS[id], lines: id === "material" ? materialLines : (workLines.get(id) ?? []) }))
    .filter((chapter) => chapter.lines.length)
    .map((chapter) => ({ ...chapter, totalCzk: chapterTotal(chapter.lines) }));
  // Souhrnná nabídka: každá kapitola jedna položka „1 kpl“
  const chapters = options.layout === "chapters" ? itemized.map((chapter) => ({ ...chapter, lines: [{ name: chapter.title, quantity: 1, unit: "kpl" as const, unitPriceCzk: chapter.totalCzk, totalCzk: chapter.totalCzk }] })) : itemized;
  const withoutVatCzk = roundCzk(itemized.reduce((sum, chapter) => sum + chapter.totalCzk, 0));
  const vatCzk = roundCzk((withoutVatCzk * options.vatRate) / 100);
  const validUntil = addDays(options.issuedAt, Math.max(1, Math.round(options.validityDays)));
  const notes = [
    `Ceny jsou uvedeny v Kč bez DPH, DPH ${options.vatRate} %${options.vatRate === 12 ? " (bytová výstavba dle § 48 zákona o DPH – podmínky doloží odběratel prohlášením)" : ""}.`,
    `Nabídka platí do ${validUntil.split("-").reverse().join(". ").replace(/^0/, "")}.`,
    "Rozsah prací odpovídá předanému projektu; vícepráce a změny rozsahu se oceňují zvlášť po dohodě s odběratelem.",
  ];
  const customer = assertCustomerSafe({
    number: options.number,
    title: customerText(options.title),
    issuedAt: options.issuedAt.slice(0, 10),
    validUntil,
    supplier: options.supplier,
    customer: options.customer,
    layout: options.layout,
    chapters,
    totals: { withoutVatCzk, vatRate: options.vatRate, vatCzk, withVatCzk: withoutVatCzk + vatCzk },
    notes,
  });
  const materialCustomerCzk = round2(materialLines.reduce((sum, line) => sum + line.totalCzk, 0));
  return {
    customer,
    internal: {
      nhVersion: NH_VERSION,
      calibrationFactor: calibration.factor,
      constructionFactor: construction.factor,
      laborHours: round2(labor.reduce((sum, entry) => sum + entry.hours, 0)),
      labor,
      materialListCzk: round2(materialListCzk),
      materialCustomerCzk,
      missingPrices,
      pricedFrom: [...sources.entries()].map(([source, lines]) => ({ source, lines })),
    },
  };
}

export { CONSTRUCTIONS };
