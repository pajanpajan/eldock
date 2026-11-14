// Fáze 116: automatické napárování položek kusovníku (BomItem) na prediktivní model životnosti – kategorie A–E podle
// označení ve schématu (-K, -KA, -Q, -F, -S, -T, -U, -A, -FAN, -BT, -FV …) a popisu, limity z ověřeného technického
// listu výrobce, jinak výchozí odhad kategorie (vždy označený „odhad“). Uložená MonitoredComponent (úprava četnosti,
// motohodin, výměna, ruční přidání v Diagnostice) má přednost. Čisté funkce – kusovník, diagnostika, nákupní report.

import { type ComponentInput, type WearCategory } from "./component-lifespan";
import { datasheetFor, datasheetLimit, partKeyOf, type ComponentDatasheet } from "./component-datasheets";

export type ComponentKind =
  | "CONTACTOR"
  | "RELAY"
  | "MOTOR_STARTER"
  | "MAIN_SWITCH"
  | "BREAKER"
  | "RCD"
  | "PUSHBUTTON"
  | "SAFETY_RELAY"
  | "PSU"
  | "VFD"
  | "SOFTSTARTER"
  | "PLC"
  | "FAN"
  | "FILTER"
  | "BATTERY"
  | "SPD"
  | "TERMINAL"
  | "FUSE"
  | "OTHER";

interface KindDefaults {
  cyclesPerHour?: number;
  maxCycles?: number;
  maxHours?: number;
  maxMonths?: number;
}

/** Popis druhu, kategorie opotřebení a výchozí (odhadované) limity, když výrobce v katalogu ELDOCK ověřený není. */
export const KIND_INFO: Record<ComponentKind, { label: string; category: WearCategory | null; defaults: KindDefaults; basis: string }> = {
  CONTACTOR: { label: "Stykač", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 30, maxCycles: 1_000_000 }, basis: "odhad 1 000 000 cyklů (doplňte B10d / el. životnost výrobce)" },
  RELAY: { label: "Relé", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 60, maxCycles: 100_000 }, basis: "odhad 100 000 cyklů při jmenovité zátěži" },
  MOTOR_STARTER: { label: "Motorový spouštěč", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 5, maxCycles: 100_000 }, basis: "odhad 100 000 cyklů" },
  MAIN_SWITCH: { label: "Hlavní vypínač / odpínač", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 0.02, maxCycles: 10_000 }, basis: "odhad 10 000 cyklů, spínání výjimečně (údržba)" },
  BREAKER: { label: "Jistič", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 0.01, maxCycles: 4_000 }, basis: "odhad 4 000 cyklů, spíná jen při poruše / údržbě" },
  RCD: { label: "Proudový chránič", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 0.01, maxCycles: 2_000 }, basis: "odhad 2 000 cyklů (zkouška tlačítkem T)" },
  PUSHBUTTON: { label: "Tlačítko / ovládač", category: "SWITCHING_CONTACTOR", defaults: { cyclesPerHour: 10, maxCycles: 1_000_000 }, basis: "odhad 1 000 000 cyklů" },
  SAFETY_RELAY: { label: "Bezpečnostní prvek", category: "SAFETY_ELEMENT", defaults: { cyclesPerHour: 20, maxCycles: 1_000_000, maxMonths: 240 }, basis: "odhad B10d 1 000 000 cyklů, doba mise T_M 20 let (ČSN EN ISO 13849-1)" },
  PSU: { label: "Spínaný zdroj", category: "POWER_ELECTRONICS", defaults: { maxHours: 50_000 }, basis: "odhad 50 000 h při 40 °C (elektrolytické kondenzátory)" },
  VFD: { label: "Frekvenční měnič", category: "POWER_ELECTRONICS", defaults: { maxHours: 50_000 }, basis: "odhad 50 000 h při 40 °C (kondenzátory meziobvodu)" },
  SOFTSTARTER: { label: "Softstartér", category: "POWER_ELECTRONICS", defaults: { maxHours: 50_000 }, basis: "odhad 50 000 h při 40 °C" },
  PLC: { label: "Řídicí systém PLC", category: "POWER_ELECTRONICS", defaults: { maxHours: 100_000 }, basis: "odhad 100 000 h při 40 °C" },
  FAN: { label: "Ventilátor", category: "COOLING_FAN_FILTER", defaults: { maxHours: 40_000 }, basis: "odhad L10 40 000 h při 40 °C" },
  FILTER: { label: "Filtrační rohož", category: "COOLING_FAN_FILTER", defaults: { maxMonths: 6 }, basis: "výměna po 6 měsících (střední prašnost; nízká 12, vysoká 3 měsíce)" },
  BATTERY: { label: "Baterie / akumulátor", category: "BATTERY", defaults: { maxMonths: 48 }, basis: "odhad 4 roky při 25 °C (každých +10 °C = polovina)" },
  SPD: { label: "Přepěťová ochrana SPD", category: "SURGE_PROTECTION", defaults: { maxMonths: 120, cyclesPerHour: 0, maxCycles: 15 }, basis: "kontrola po 10 letech; 15 výbojů jmenovitým proudem In (zkouška provozní výdrže ČSN EN 61643-11)" },
  TERMINAL: { label: "Svorka", category: null, defaults: {}, basis: "pasivní prvek bez opotřebení" },
  FUSE: { label: "Pojistka", category: null, defaults: {}, basis: "mění se po zapůsobení" },
  OTHER: { label: "Ostatní", category: null, defaults: {}, basis: "bez modelu životnosti" },
};

/** Prašnost prostředí → interval výměny filtrační rohože [měsíce]. */
export const FILTER_DUST_MONTHS = [
  { id: "LOW", label: "Nízká prašnost", months: 12 },
  { id: "MEDIUM", label: "Střední prašnost", months: 6 },
  { id: "HIGH", label: "Vysoká prašnost", months: 3 },
] as const;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Klíč označení ve schématu: „-K1“ = „K1“ = „=A1-K1“ → „K1“. */
export function designationKey(designation: string): string {
  const last = designation.trim().split(/[-=+]/).filter(Boolean).at(-1) ?? designation;
  return last.replace(/\s+/g, "").toUpperCase();
}

/** Zobrazované označení s pomlčkou (IEC 81346): „K1“ → „-K1“. */
export const displayDesignation = (designation: string) => (/^[-=+]/.test(designation.trim()) ? designation.trim() : `-${designation.trim()}`);

/** Druh součástky podle označení a popisu (popis má přednost – „-Q1 Hlavní vypínač“ vs. „-Q2 Motorový spouštěč“). */
export function classifyComponent(input: { designation: string; description: string }): ComponentKind {
  const text = fold(input.description);
  const code = (designationKey(input.designation).match(/^[A-Z]+/)?.[0] ?? "").toUpperCase();
  if (/prepet|svodic|\bspd\b|surge/.test(text) || code === "FV") return "SPD";
  if (/bateri|akumul|\bups\b|batter/.test(text) || code === "BT" || code === "GB") return "BATTERY";
  if (/rohoz|vlozk/.test(text)) return "FILTER";
  if (/ventilator|\bfan\b/.test(text) || code === "FAN" || code === "EV") return "FAN";
  if (/filtr/.test(text)) return "FILTER";
  if (/pojistk|\bfuse\b/.test(text) || code === "FU") return "FUSE";
  if (/svork|terminal block/.test(text) || code === "X" || code === "XD") return "TERMINAL";
  if (/bezpecnostni (modul|rele)|safety|pnoz|hlidac bezpec/.test(text)) return "SAFETY_RELAY";
  if (/nouzov|e-stop|totalstop/.test(text)) return code.startsWith("S") ? "PUSHBUTTON" : "SAFETY_RELAY";
  if (/softstart|soft start/.test(text)) return "SOFTSTARTER";
  if (/menic|frekven|sinamics|altivar|inverter|\bvfd\b/.test(text) || code === "U") return "VFD";
  if (/zdroj|\bpsu\b|power supply|sitop|quint/.test(text)) return "PSU";
  if (/\bplc\b|ridici (jednotk|system)|simatic|\bcpu\b|controller/.test(text) || code === "A") return "PLC";
  if (/styka|contactor/.test(text)) return "CONTACTOR";
  if (/\brele\b|relay/.test(text) || code === "KA") return "RELAY";
  if (/spoustec|motorovy spinac|motor starter|motor protect/.test(text)) return "MOTOR_STARTER";
  if (/vypinac|odpinac|odpojovac|disconnect/.test(text)) return "MAIN_SWITCH";
  if (/chranic|\brcd\b|rccb|proudovy/.test(text)) return "RCD";
  if (/jistic|\bmcb\b|circuit breaker/.test(text)) return "BREAKER";
  if (/tlacit|pushbutton|ovladac/.test(text)) return "PUSHBUTTON";
  switch (code) {
    case "K":
    case "KM":
      return "CONTACTOR";
    case "Q":
    case "QM":
      return "MOTOR_STARTER";
    case "F":
    case "QF":
      return "BREAKER";
    case "S":
    case "SB":
      return "PUSHBUTTON";
    case "T":
    case "G":
      return "PSU";
    default:
      return "OTHER";
  }
}

export interface BomLine {
  id?: string;
  position: number;
  designation: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note?: string | null;
}

/** Uložená sledovaná součástka (MonitoredComponent) – přesně ta pole, která párování potřebuje. */
export interface StoredComponent {
  id: string;
  designation: string;
  name: string;
  manufacturer: string | null;
  modelNumber: string | null;
  wearCategory: WearCategory;
  installedAt: Date;
  cyclesPerHour: number | null;
  manualCyclesOffset: number;
  maxElectricalCycles: number | null;
  maxOperatingHours: number | null;
  maxCalendarMonths: number | null;
  replacementStockCount: number;
  alertLeadDays: number | null;
  hoursReading: number | null;
  hoursReadingAt: Date | null;
  quantity: number;
  source: string;
  notes: string | null;
}

export type ParamSource = "datasheet" | "estimate" | "stored";

export interface LifespanRow {
  key: string;
  designation: string;
  position: number | null;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
  kind: ComponentKind;
  category: WearCategory | null;
  /** Uložená MonitoredComponent (jinak virtuální model z kusovníku). */
  componentId: string | null;
  inBom: boolean;
  /** Model pro `assessComponent`; `null` = prvek bez opotřebení (svorka, pojistka …). */
  model: ComponentInput | null;
  alertLeadDays: number | null;
  /** Odkud jsou limity a četnost: technický list výrobce / odhad kategorie / uložené (potvrzené uživatelem). */
  limitSource: ParamSource;
  rateSource: ParamSource;
  basis: string;
  datasheet: ComponentDatasheet | null;
  /** Kusy skladem bez MPN (u dílů s MPN platí sklad závodu). */
  componentStock: number;
  notes: string | null;
}

/** Výchozí model součástky z kusovníku: technický list výrobce, jinak odhad kategorie. */
export function defaultModel(input: { kind: ComponentKind; partNumber: string | null; installedAt: Date }): { model: ComponentInput | null; limitSource: ParamSource; basis: string; datasheet: ComponentDatasheet | null } {
  const info = KIND_INFO[input.kind];
  const datasheet = datasheetFor(input.partNumber);
  if (!info.category) return { model: null, limitSource: "estimate", basis: info.basis, datasheet };
  const sheet = datasheetLimit(datasheet);
  const cycles = sheet.cycles ?? info.defaults.maxCycles ?? null;
  const hours = sheet.hours ?? info.defaults.maxHours ?? null;
  const fromSheet = Boolean((info.defaults.maxCycles && sheet.cycles) || (info.defaults.maxHours && sheet.hours));
  return {
    model: {
      wearCategory: info.category,
      installedAt: input.installedAt,
      cyclesPerHour: info.defaults.maxCycles ? (info.defaults.cyclesPerHour ?? null) : null,
      manualCyclesOffset: 0,
      maxElectricalCycles: info.defaults.maxCycles ? cycles : null,
      maxOperatingHours: info.defaults.maxHours ? hours : null,
      maxCalendarMonths: info.defaults.maxMonths ?? null,
      replacementStockCount: 0,
    },
    limitSource: fromSheet ? "datasheet" : "estimate",
    basis: fromSheet ? (sheet.cyclesLabel ?? sheet.hoursLabel ?? info.basis) : info.basis,
    datasheet,
  };
}

const toModel = (component: StoredComponent): ComponentInput => ({
  wearCategory: component.wearCategory,
  installedAt: component.installedAt,
  cyclesPerHour: component.cyclesPerHour,
  manualCyclesOffset: component.manualCyclesOffset,
  maxElectricalCycles: component.maxElectricalCycles,
  maxOperatingHours: component.maxOperatingHours,
  maxCalendarMonths: component.maxCalendarMonths,
  replacementStockCount: component.replacementStockCount,
  hoursReading: component.hoursReading,
  hoursReadingAt: component.hoursReadingAt,
});

/**
 * Kusovník + sledované součástky → řádky životnosti: každá položka kusovníku dostane model (uložená součástka se
 * stejným označením má přednost), součástky mimo kusovník (např. -FAN1, -U1 přidané v Diagnostice) se připojí na konec.
 * `baseline` = instalace dílů z kusovníku (rok instalace stroje), dokud se nezapíše výměna.
 */
export function pairBomLifespan(bom: readonly BomLine[], components: readonly StoredComponent[], baseline: Date): LifespanRow[] {
  const stored = new Map(components.map((component) => [designationKey(component.designation), component]));
  const used = new Set<string>();
  const rows: LifespanRow[] = [];
  for (const line of [...bom].sort((a, b) => a.position - b.position)) {
    const key = designationKey(line.designation);
    if (used.has(key)) continue;
    used.add(key);
    const component = stored.get(key) ?? null;
    const kind = classifyComponent({ designation: line.designation, description: line.description });
    // Sledovaný kus může být jiného typu než v kusovníku revize (výměna za jiný typ) – platí sledovaný kus
    const partNumber = component?.modelNumber?.trim() || line.partNumber;
    const manufacturer = component?.modelNumber?.trim() ? (component.manufacturer ?? line.manufacturer) : line.manufacturer;
    const differs = Boolean(component?.modelNumber?.trim() && line.partNumber && partKeyOf(component.modelNumber) !== partKeyOf(line.partNumber));
    const fallback = defaultModel({ kind, partNumber, installedAt: baseline });
    rows.push({
      key,
      designation: displayDesignation(line.designation),
      position: line.position,
      description: line.description,
      manufacturer,
      partNumber,
      quantity: component?.quantity && component.source === "BOM" ? component.quantity : Math.max(1, Math.round(line.quantity)),
      unit: line.unit,
      note: [line.note, differs ? `V kusovníku revize: ${[line.manufacturer, line.partNumber].filter(Boolean).join(" ")}` : null].filter(Boolean).join(" · ") || null,
      kind,
      category: component?.wearCategory ?? fallback.model?.wearCategory ?? null,
      componentId: component?.id ?? null,
      inBom: true,
      model: component ? toModel(component) : fallback.model,
      alertLeadDays: component?.alertLeadDays ?? null,
      limitSource: component ? "stored" : fallback.limitSource,
      rateSource: component ? "stored" : fallback.limitSource === "datasheet" && !fallback.model?.cyclesPerHour ? "datasheet" : "estimate",
      basis: component ? storedBasis(component, fallback.datasheet) : fallback.basis,
      datasheet: fallback.datasheet,
      componentStock: component?.replacementStockCount ?? 0,
      notes: component?.notes ?? null,
    });
  }
  for (const component of components) {
    const key = designationKey(component.designation);
    if (used.has(key)) continue;
    used.add(key);
    const kind = classifyComponent({ designation: component.designation, description: component.name });
    const datasheet = datasheetFor(component.modelNumber);
    rows.push({
      key,
      designation: displayDesignation(component.designation),
      position: null,
      description: component.name,
      manufacturer: component.manufacturer,
      partNumber: component.modelNumber,
      quantity: Math.max(1, component.quantity),
      unit: "ks",
      note: null,
      kind,
      category: component.wearCategory,
      componentId: component.id,
      inBom: false,
      model: toModel(component),
      alertLeadDays: component.alertLeadDays,
      limitSource: "stored",
      rateSource: "stored",
      basis: storedBasis(component, datasheet),
      datasheet,
      componentStock: component.replacementStockCount,
      notes: component.notes,
    });
  }
  return rows;
}

function storedBasis(component: StoredComponent, datasheet: ComponentDatasheet | null): string {
  const sheet = datasheetLimit(datasheet);
  if (sheet.cycles && component.maxElectricalCycles === sheet.cycles) return sheet.cyclesLabel!;
  if (sheet.hours && component.maxOperatingHours === sheet.hours) return sheet.hoursLabel!;
  const parts = [
    component.maxElectricalCycles ? `${component.maxElectricalCycles.toLocaleString("cs-CZ")} ${component.wearCategory === "SURGE_PROTECTION" ? "výbojů" : "cyklů"}` : null,
    component.maxOperatingHours ? `${component.maxOperatingHours.toLocaleString("cs-CZ")} h při 40 °C` : null,
    component.maxCalendarMonths ? `${component.maxCalendarMonths.toLocaleString("cs-CZ")} měsíců` : null,
  ].filter(Boolean);
  return parts.length ? `zadáno: ${parts.join(" · ")}` : "zadáno ručně";
}

/** Data pro vytvoření MonitoredComponent z řádku kusovníku (první úprava řádku / výměna kusu). */
export function componentDataFromRow(row: Pick<LifespanRow, "designation" | "description" | "manufacturer" | "partNumber" | "quantity" | "model" | "category">): {
  designation: string;
  name: string;
  manufacturer: string | null;
  modelNumber: string | null;
  wearCategory: WearCategory;
  installedAt: Date;
  cyclesPerHour: number | null;
  manualCyclesOffset: number;
  maxElectricalCycles: number | null;
  maxOperatingHours: number | null;
  maxCalendarMonths: number | null;
  quantity: number;
  source: "BOM";
} | null {
  if (!row.model || !row.category) return null;
  return {
    designation: row.designation,
    name: row.description.slice(0, 200),
    manufacturer: row.manufacturer,
    modelNumber: row.partNumber,
    wearCategory: row.category,
    installedAt: row.model.installedAt,
    cyclesPerHour: row.model.cyclesPerHour,
    manualCyclesOffset: row.model.manualCyclesOffset,
    maxElectricalCycles: row.model.maxElectricalCycles,
    maxOperatingHours: row.model.maxOperatingHours,
    maxCalendarMonths: row.model.maxCalendarMonths,
    quantity: row.quantity,
    source: "BOM",
  };
}

/** Sklad dílu: s MPN sklad závodu (sdílený všemi stroji), bez MPN počet u součástky. */
export function stockOf(row: Pick<LifespanRow, "partNumber" | "componentStock">, plantStock: ReadonlyMap<string, number>): number {
  const key = partKeyOf(row.partNumber);
  if (key && plantStock.has(key)) return plantStock.get(key)!;
  return row.componentStock;
}

/** Instalace dílů z kusovníku: 1. 1. roku instalace stroje, jinak založení karty zařízení. */
export function baselineInstalledAt(equipment: { yearInstalled: number | null; createdAt: Date }): Date {
  return equipment.yearInstalled && equipment.yearInstalled > 1950 ? new Date(Date.UTC(equipment.yearInstalled, 0, 1)) : equipment.createdAt;
}
