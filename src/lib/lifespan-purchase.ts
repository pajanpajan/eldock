// Fáze 116: 📦 Nákupní report prediktivní údržby (konsolidovaná objednávka náhradních dílů). Smart Batch Trigger:
// jakmile první součástka v závodě dosáhne svého předstihu upozornění (zbývá ≤ N dní nebo ≤ 15 % životnosti), report
// sečte všechny součástky závodu, kterým životnost končí v nákupním výhledu (+60 / +90 / +180 / +365 dní), podle
// objednacího čísla (MPN): potřeba k výměně, skladem, nutno doobjednat, stroje a nejbližší datum výměny.
// Čisté funkce – stránka reportu, e-mail nákupu, exporty a testy.

import { partKeyOf } from "./component-datasheets";
import { toCsv } from "./csv";

export const PURCHASE_HORIZONS = [60, 90, 180, 365] as const;
export type PurchaseHorizon = (typeof PURCHASE_HORIZONS)[number];
export const DEFAULT_PURCHASE_HORIZON: PurchaseHorizon = 90;
export const isPurchaseHorizon = (value: unknown): value is PurchaseHorizon => PURCHASE_HORIZONS.includes(value as PurchaseHorizon);

export const PURCHASE_FREQUENCIES = [
  { id: "FIRST_WARNING", label: "Při prvním varování + souhrn za 90 dní" },
  { id: "MONTHLY", label: "1× měsíčně" },
  { id: "QUARTERLY", label: "1× čtvrtletně" },
] as const;
export type PurchaseFrequency = (typeof PURCHASE_FREQUENCIES)[number]["id"];
export const isPurchaseFrequency = (value: unknown): value is PurchaseFrequency => PURCHASE_FREQUENCIES.some((item) => item.id === value);

/** Jedna sledovaná součástka závodu s vyhodnocenou životností (vstup reportu). */
export interface PurchaseInputRow {
  equipmentId: string;
  tag: string;
  equipmentName: string;
  buildingName: string;
  floorName: string;
  designation: string;
  manufacturer: string | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  /** Dny do konce životnosti (záporné = po konci); `null` bez limitu. */
  remainingDays: number | null;
  endDate: Date | null;
  remainingPercent: number;
  /** V okně upozornění (předstih dny / ≤ 15 %) nebo po konci životnosti. */
  alert: boolean;
  expired: boolean;
  alertLeadDays: number;
  /** Četnost / limit jen odhadem kategorie (ne údaj výrobce ani potvrzení údržby). */
  estimated: boolean;
}

export interface PurchaseMachine {
  equipmentId: string;
  tag: string;
  buildingName: string;
  floorName: string;
  designation: string;
  quantity: number;
  endDate: Date | null;
  remainingDays: number | null;
  expired: boolean;
}

export interface PurchaseLine {
  partKey: string;
  manufacturer: string | null;
  partNumber: string;
  description: string;
  /** Potřebný počet kusů k výměně v nákupním výhledu. */
  needed: number;
  inStock: number;
  /** Nutno doobjednat na sklad = potřeba − skladem (nejméně 0). */
  toOrder: number;
  machines: PurchaseMachine[];
  nearestDate: Date | null;
  nearestDays: number | null;
  estimatedCount: number;
}

export interface PurchaseReport {
  generatedAt: Date;
  horizonDays: number;
  /** Spuštěno: aspoň jedna součástka dosáhla předstihu upozornění. */
  triggered: boolean;
  /** První (nejnaléhavější) součástka, která report spustila. */
  trigger: PurchaseInputRow | null;
  alertCount: number;
  lines: PurchaseLine[];
  /** Součástky v nákupním výhledu bez objednacího čísla (nejde je sečíst podle MPN). */
  withoutPartNumber: PurchaseInputRow[];
  totals: { lines: number; needed: number; toOrder: number; machines: number };
}

const daysOf = (row: Pick<PurchaseInputRow, "remainingDays" | "expired">) => (row.expired ? Math.min(0, row.remainingDays ?? 0) : (row.remainingDays ?? Number.POSITIVE_INFINITY));

/**
 * Souhrnný nákupní report. Bez spuštění (žádná součástka v předstihu) jsou řádky prázdné – výhled se ukáže až
 * s prvním varováním, aby nákup dostal jednu objednávku místo jednotlivých kusů každý týden.
 */
export function generateLifespanPurchaseReport(
  rows: readonly PurchaseInputRow[],
  options: { now: Date; horizonDays: number; stock: ReadonlyMap<string, number>; forecast?: boolean },
): PurchaseReport {
  const alerts = rows.filter((row) => row.alert || row.expired).sort((a, b) => daysOf(a) - daysOf(b));
  const triggered = alerts.length > 0;
  const inWindow = triggered || options.forecast ? rows.filter((row) => row.expired || (row.remainingDays !== null && row.remainingDays <= options.horizonDays)) : [];
  const groups = new Map<string, PurchaseLine>();
  const withoutPartNumber: PurchaseInputRow[] = [];
  for (const row of [...inWindow].sort((a, b) => daysOf(a) - daysOf(b))) {
    const key = partKeyOf(row.partNumber);
    if (!key) {
      withoutPartNumber.push(row);
      continue;
    }
    let line = groups.get(key);
    if (!line) {
      line = { partKey: key, manufacturer: row.manufacturer, partNumber: row.partNumber!.trim(), description: row.description, needed: 0, inStock: options.stock.get(key) ?? 0, toOrder: 0, machines: [], nearestDate: null, nearestDays: null, estimatedCount: 0 };
      groups.set(key, line);
    }
    line.needed += Math.max(1, row.quantity);
    if (row.estimated) line.estimatedCount += 1;
    line.manufacturer ??= row.manufacturer;
    line.machines.push({ equipmentId: row.equipmentId, tag: row.tag, buildingName: row.buildingName, floorName: row.floorName, designation: row.designation, quantity: Math.max(1, row.quantity), endDate: row.endDate, remainingDays: row.remainingDays, expired: row.expired });
    const days = daysOf(row);
    if (line.nearestDays === null || days < line.nearestDays) {
      line.nearestDays = Number.isFinite(days) ? days : null;
      line.nearestDate = row.expired ? (row.endDate ?? options.now) : row.endDate;
    }
  }
  const lines = [...groups.values()]
    .map((line) => ({ ...line, toOrder: Math.max(0, line.needed - line.inStock) }))
    .sort((a, b) => (a.nearestDays ?? Infinity) - (b.nearestDays ?? Infinity) || b.toOrder - a.toOrder || a.partNumber.localeCompare(b.partNumber, "cs"));
  const machineIds = new Set(inWindow.map((row) => row.equipmentId));
  return {
    generatedAt: options.now,
    horizonDays: options.horizonDays,
    triggered,
    trigger: alerts[0] ?? null,
    alertCount: alerts.length,
    lines,
    withoutPartNumber,
    totals: {
      lines: lines.length,
      needed: lines.reduce((sum, line) => sum + line.needed, 0) + withoutPartNumber.reduce((sum, row) => sum + Math.max(1, row.quantity), 0),
      toOrder: lines.reduce((sum, line) => sum + line.toOrder, 0),
      machines: machineIds.size,
    },
  };
}

const date = (value: Date | null) => (value ? value.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "–");

/** „R-CNC-04 -K1 (Hala B, do 14. 2. 2027)“ – seznam strojů na řádku reportu. */
export const machinesText = (line: PurchaseLine) =>
  line.machines.map((machine) => `${machine.tag} ${machine.designation}${machine.quantity > 1 ? ` ${machine.quantity}×` : ""} (${machine.buildingName}, ${machine.expired ? "po životnosti" : `do ${date(machine.endDate)}`})`).join("; ");

/** Tabulka reportu pro CSV / XLSX / e-mail (záhlaví + řádky). */
export function purchaseTable(report: PurchaseReport): (string | number | null)[][] {
  const head = ["Výrobce", "Objednací číslo (MPN)", "Popis", "Potřeba k výměně [ks]", "Aktuálně skladem [ks]", "Nutno doobjednat [ks]", "Nejbližší výměna", "Stroje a pozice"];
  const rows: (string | number | null)[][] = report.lines.map((line) => [line.manufacturer ?? "", line.partNumber, line.description, line.needed, line.inStock, line.toOrder, line.nearestDays !== null && line.nearestDays <= 0 ? "ihned (po životnosti)" : date(line.nearestDate), machinesText(line)]);
  for (const row of report.withoutPartNumber) rows.push([row.manufacturer ?? "", "(bez objednacího čísla)", row.description, Math.max(1, row.quantity), null, null, row.expired ? "ihned (po životnosti)" : date(row.endDate), `${row.tag} ${row.designation} (${row.buildingName})`]);
  return [head, ...rows];
}

export const purchaseCsv = (report: PurchaseReport) => toCsv(purchaseTable(report));

/**
 * Košík pro elektro-velkoobchod (Sonepar, Elkov, K&V Elektro): jen díly k doobjednání – objednací číslo výrobce,
 * množství, výrobce a popis (středník, UTF-8). Kód zboží velkoobchodu se dohledá podle objednacího čísla výrobce.
 */
export function wholesaleCsv(report: PurchaseReport): string {
  return toCsv([["Objednací číslo výrobce", "Množství", "Výrobce", "Popis"], ...report.lines.filter((line) => line.toOrder > 0).map((line) => [line.partNumber, line.toOrder, line.manufacturer ?? "", line.description])]);
}

// ---------------------------------------------------------------------------
//  Automatické zasílání nákupu (denní údržba)
// ---------------------------------------------------------------------------

export interface PurchaseSettings {
  email: string | null;
  frequency: PurchaseFrequency;
  horizonDays: PurchaseHorizon;
  lastSentAt: string | null;
  /** Součástky, o kterých už nákup ví (při prvním varování se posílá jen při nové součástce v předstihu). */
  notifiedKeys: string[];
}

export const DEFAULT_PURCHASE_SETTINGS: PurchaseSettings = { email: null, frequency: "FIRST_WARNING", horizonDays: DEFAULT_PURCHASE_HORIZON, lastSentAt: null, notifiedKeys: [] };
export const PURCHASE_SETTINGS_KEY = (plantId: string) => `purchase-report:${plantId}`;

export function parsePurchaseSettings(json: string | null | undefined): PurchaseSettings {
  if (!json) return { ...DEFAULT_PURCHASE_SETTINGS };
  try {
    const raw = JSON.parse(json) as Partial<PurchaseSettings>;
    return {
      email: typeof raw.email === "string" && raw.email.includes("@") ? raw.email : null,
      frequency: isPurchaseFrequency(raw.frequency) ? raw.frequency : DEFAULT_PURCHASE_SETTINGS.frequency,
      horizonDays: isPurchaseHorizon(raw.horizonDays) ? raw.horizonDays : DEFAULT_PURCHASE_HORIZON,
      lastSentAt: typeof raw.lastSentAt === "string" ? raw.lastSentAt : null,
      notifiedKeys: Array.isArray(raw.notifiedKeys) ? raw.notifiedKeys.filter((key): key is string => typeof key === "string").slice(0, 2000) : [],
    };
  } catch {
    return { ...DEFAULT_PURCHASE_SETTINGS };
  }
}

/** Klíč součástky v předstihu (stroj + pozice) – „nová“ součástka = nový varovný e-mail. */
export const alertKeyOf = (row: Pick<PurchaseInputRow, "equipmentId" | "designation">) => `${row.equipmentId}|${row.designation}`;

/**
 * Součástky, které odeslaný report pokryl (všechny v nákupním výhledu, ne jen v předstihu) – další e-mail při prvním
 * varování přijde až pro součástku, která v minulém souhrnu nebyla.
 */
export const reportKeys = (report: Pick<PurchaseReport, "lines" | "withoutPartNumber">) => [
  ...report.lines.flatMap((line) => line.machines.map((machine) => alertKeyOf({ equipmentId: machine.equipmentId, designation: machine.designation }))),
  ...report.withoutPartNumber.map(alertKeyOf),
];

const PRAGUE_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" });
const pragueDay = (value: Date) => PRAGUE_DAY.format(value);

/**
 * Má denní údržba poslat report nákupu? Při prvním varování: report je spuštěný a v předstihu je součástka, o které
 * nákup ještě neví (nejvýš 1× denně). Měsíčně: 1. den v měsíci; čtvrtletně: 1. den v lednu, dubnu, červenci a říjnu.
 */
export function purchaseReportDue(settings: PurchaseSettings, report: Pick<PurchaseReport, "triggered">, alertKeys: readonly string[], now: Date): { due: boolean; reason: string } {
  if (!settings.email) return { due: false, reason: "Bez e-mailu nákupu." };
  const today = pragueDay(now);
  if (settings.lastSentAt && pragueDay(new Date(settings.lastSentAt)) === today) return { due: false, reason: "Dnes už odesláno." };
  if (settings.frequency === "FIRST_WARNING") {
    if (!report.triggered) return { due: false, reason: "Žádná součástka v předstihu upozornění." };
    const known = new Set(settings.notifiedKeys);
    return alertKeys.some((key) => !known.has(key)) ? { due: true, reason: "Nová součástka v předstihu upozornění." } : { due: false, reason: "Nákup o všech součástkách v předstihu ví." };
  }
  const [, month, day] = today.split("-").map(Number);
  if (day !== 1) return { due: false, reason: "Souhrn se posílá 1. den v měsíci." };
  if (settings.frequency === "QUARTERLY" && ![1, 4, 7, 10].includes(month)) return { due: false, reason: "Čtvrtletní souhrn v lednu, dubnu, červenci a říjnu." };
  return { due: true, reason: settings.frequency === "MONTHLY" ? "Měsíční souhrn." : "Čtvrtletní souhrn." };
}

/** Text e-mailu pro nákup (prostý text; HTML se skládá z tabulky). */
export function purchaseMailText(report: PurchaseReport, input: { plantName: string; reportUrl: string }): string {
  const lines = [
    `📦 Nákupní report prediktivní údržby – ${input.plantName}`,
    `Výhled nákupu: +${report.horizonDays} dní · ${report.totals.lines} objednacích čísel · ${report.totals.needed} ks k výměně · ${report.totals.toOrder} ks nutno doobjednat`,
    report.trigger ? `Spuštěno: ${report.trigger.tag} ${report.trigger.designation} (${report.trigger.partNumber ?? report.trigger.description}) – ${report.trigger.expired ? "po konci životnosti" : `zbývá ${report.trigger.remainingDays} dní`}` : "",
    "",
    ...report.lines.map((line) => `• ${line.manufacturer ?? ""} ${line.partNumber} – ${line.description}: potřeba ${line.needed} ks, skladem ${line.inStock} ks, DOOBJEDNAT ${line.toOrder} ks (nejbližší ${line.nearestDays !== null && line.nearestDays <= 0 ? "ihned" : date(line.nearestDate)})`),
    ...report.withoutPartNumber.map((row) => `• (bez objednacího čísla) ${row.description} – ${row.tag} ${row.designation}`),
    "",
    `Celý report s exporty XLSX / CSV / PDF: ${input.reportUrl}`,
  ];
  return lines.filter((line, index) => line || index > 2).join("\n");
}

// ---------------------------------------------------------------------------
//  Serializace pro klienta (data jako ISO řetězce)
// ---------------------------------------------------------------------------

type Serialized<T> = T extends Date ? string : T extends (infer U)[] ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export type SerializedPurchaseReport = Serialized<PurchaseReport>;

export function serializeReport(report: PurchaseReport): SerializedPurchaseReport {
  return JSON.parse(JSON.stringify(report)) as SerializedPurchaseReport;
}

/** Zpět na objekty s daty (exporty v prohlížeči používají stejné funkce jako server). */
export function deserializeReport(report: SerializedPurchaseReport): PurchaseReport {
  const day = (value: string | null) => (value ? new Date(value) : null);
  const row = (entry: SerializedPurchaseReport["withoutPartNumber"][number]): PurchaseInputRow => ({ ...entry, endDate: day(entry.endDate) });
  return {
    ...report,
    generatedAt: new Date(report.generatedAt),
    trigger: report.trigger ? row(report.trigger) : null,
    withoutPartNumber: report.withoutPartNumber.map(row),
    lines: report.lines.map((line) => ({ ...line, nearestDate: day(line.nearestDate), machines: line.machines.map((machine) => ({ ...machine, endDate: day(machine.endDate) })) })),
  };
}
