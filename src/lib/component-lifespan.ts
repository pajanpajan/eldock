// Fáze 53: prediktivní hlídání životnosti součástek rozváděčů a strojů – počet sepnutí ze směnnosti,
// B10d a doba mise T_M bezpečnostních prvků (ČSN EN ISO 13849-1), motohodiny s teplotní degradací
// dle Arrhenia (+10 °C nad 40 °C = poloviční životnost kondenzátorů) a kalendářní limity filtrů / baterií.
// Fáze 116: kategorie A–E (D baterie s teplotní degradací, E přepěťové ochrany s impulzním opotřebením),
// zbývající životnost 100 % → 0 %, předstih upozornění (stroj / součástka) a odečet počítadla motohodin.
// Čisté deterministické funkce – karta zařízení, kusovník, nákupní report, hlídač lhůt i seed.

export type WearCategory =
  | "SWITCHING_CONTACTOR"
  | "SAFETY_ELEMENT"
  | "POWER_ELECTRONICS"
  | "COOLING_FAN_FILTER"
  | "BATTERY"
  | "SURGE_PROTECTION";

export const WEAR_CATEGORIES: readonly { id: WearCategory; group: "A" | "B" | "C" | "D" | "E"; label: string }[] = [
  {
    id: "SWITCHING_CONTACTOR",
    group: "A",
    label: "A · Spínací prvek – stykač, relé, motorový spouštěč, jistič, tlačítko (cykly / B10d)",
  },
  {
    id: "SAFETY_ELEMENT",
    group: "A",
    label: "A · Bezpečnostní prvek ISO 13849-1 (B10d, doba mise T_M)",
  },
  {
    id: "POWER_ELECTRONICS",
    group: "B",
    label: "B · Zdroj 24 V DC / měnič / softstartér / PLC (motohodiny + Arrhenius)",
  },
  {
    id: "COOLING_FAN_FILTER",
    group: "C",
    label: "C · Ventilátor (ložiska L10) / filtrační rohož (interval dle prašnosti)",
  },
  {
    id: "BATTERY",
    group: "D",
    label: "D · Baterie PLC / CNC, akumulátor UPS a nouzového svítidla (kalendář + teplota)",
  },
  {
    id: "SURGE_PROTECTION",
    group: "E",
    label: "E · Přepěťová ochrana SPD (kalendář + impulzní opotřebení)",
  },
];
export const isWearCategory = (value: unknown): value is WearCategory =>
  WEAR_CATEGORIES.some((category) => category.id === value);

/** Směnnost: 1 směna, 2 směny, 3 směny (pracovní dny), nepřetržitý provoz 24/7. */
export const SHIFT_REGIMES: readonly {
  id: 1 | 2 | 3 | 4;
  label: string;
  /** Fáze 116: popisek ovládacího pruhu kusovníku. */
  longLabel: string;
  hoursPerYear: number;
}[] = [
  { id: 1, label: "1 směna", longLabel: "1 směna (Po–Pá, 8h)", hoursPerYear: 2000 },
  { id: 2, label: "2 směny", longLabel: "2 směny (Po–Pá, 16h)", hoursPerYear: 4000 },
  { id: 3, label: "3 směny", longLabel: "3 směny (Po–Pá, 24h)", hoursPerYear: 6000 },
  { id: 4, label: "24/7", longLabel: "24/7 Nepřetržitý", hoursPerYear: 8760 },
];
export const shiftRegimeOf = (value: number | null | undefined) =>
  SHIFT_REGIMES.find((regime) => regime.id === value) ?? SHIFT_REGIMES[1];
/** Provozní hodiny za kalendářní den (2 000 h/rok = 5,48 h/den …). */
export const hoursPerDay = (shiftRegime: number) =>
  shiftRegimeOf(shiftRegime).hoursPerYear / 365;

/** Referenční teplota katalogové životnosti [°C] a výchozí teplota v rozváděči. */
export const REFERENCE_TEMP_C = 40;
export const DEFAULT_INTERNAL_TEMP_C = 35;
/** Hranice stavů: plánovat výměnu od 75 % (nebo < 90 dní), kritické od 95 % / po termínu. */
export const PLAN_THRESHOLD = 75;
export const CRITICAL_THRESHOLD = 95;
export const PLAN_DAYS = 90;

/** Fáze 116: předstih upozornění na konec životnosti (stroj hromadně / součástka zvlášť). */
export const ALERT_LEAD_OPTIONS = [30, 60, 90, 180] as const;
export const DEFAULT_ALERT_DAYS = 60;
export const isAlertLead = (value: unknown): value is (typeof ALERT_LEAD_OPTIONS)[number] =>
  ALERT_LEAD_OPTIONS.includes(value as (typeof ALERT_LEAD_OPTIONS)[number]);
/** Upozornit i při zbývající životnosti ≤ 15 % (nezávisle na dnech). */
export const ALERT_PERCENT = 15;
/** Baterie (VRLA, Li): kalendářní životnost výrobce při 25 °C, každých +10 °C nad ní = poloviční životnost. */
export const BATTERY_REFERENCE_C = 25;

const DAY_MS = 86_400_000;

/** Arrheniův zákon: každých +10 °C nad 40 °C zkracuje životnost elektrolytických kondenzátorů na polovinu. */
export function arrheniusHours(
  maxOperatingHours: number,
  internalTempC: number,
): number {
  return internalTempC > REFERENCE_TEMP_C
    ? Math.round(
        maxOperatingHours *
          Math.pow(2, -(internalTempC - REFERENCE_TEMP_C) / 10),
      )
    : maxOperatingHours;
}

/** Baterie: kalendářní životnost [měsíce] zkrácená teplotou nad 25 °C (každých +10 °C = polovina). */
export function batteryMonths(maxCalendarMonths: number, internalTempC: number): number {
  return internalTempC > BATTERY_REFERENCE_C
    ? Math.round(maxCalendarMonths * Math.pow(2, -(internalTempC - BATTERY_REFERENCE_C) / 10) * 10) / 10
    : maxCalendarMonths;
}

/** Odpracované hodiny od instalace podle směnnosti. */
export function operatingHours(
  installedAt: Date,
  now: Date,
  shiftRegime: number,
): number {
  const days = Math.max(0, (now.getTime() - installedAt.getTime()) / DAY_MS);
  return Math.round(days * hoursPerDay(shiftRegime));
}

/** Fáze 116: odpracované hodiny – odečet počítadla (měnič, zdroj) + hodiny od odečtu podle směnnosti, jinak od instalace. */
export function workedHours(
  component: Pick<ComponentInput, "installedAt" | "hoursReading" | "hoursReadingAt">,
  now: Date,
  shiftRegime: number,
): number {
  if (component.hoursReading != null && component.hoursReadingAt && component.hoursReadingAt >= component.installedAt)
    return component.hoursReading + operatingHours(component.hoursReadingAt, now, shiftRegime);
  return operatingHours(component.installedAt, now, shiftRegime);
}

export interface ComponentInput {
  wearCategory: WearCategory;
  installedAt: Date;
  cyclesPerHour: number | null;
  manualCyclesOffset: number;
  maxElectricalCycles: number | null;
  maxOperatingHours: number | null;
  maxCalendarMonths: number | null;
  replacementStockCount: number;
  /** Fáze 116: odečet počítadla motohodin a jeho datum. */
  hoursReading?: number | null;
  hoursReadingAt?: Date | null;
}

export type LifespanStatus = "OK" | "PLAN_REPLACEMENT" | "CRITICAL_EXPIRED";

export const LIFESPAN_STATUS: Record<
  LifespanStatus,
  { label: string; emoji: string; bar: string; text: string }
> = {
  OK: {
    label: "V pořádku",
    emoji: "🟢",
    bar: "bg-emerald-500",
    text: "text-emerald-300",
  },
  PLAN_REPLACEMENT: {
    label: "Naplánovat výměnu",
    emoji: "🟡",
    bar: "bg-amber-400",
    text: "text-amber-300",
  },
  CRITICAL_EXPIRED: {
    label: "Kritické / po termínu",
    emoji: "🔴",
    bar: "bg-red-500",
    text: "text-red-300",
  },
};

export interface LifespanLimit {
  kind: "cycles" | "hours" | "calendar";
  label: string;
  used: number;
  max: number;
  percent: number;
  remainingDays: number;
}

export interface LifespanAssessment {
  operatingHours: number;
  totalCycles: number | null;
  /** Motohodiny po teplotní korekci (jen výkonová elektronika nad 40 °C). */
  effectiveMaxHours: number | null;
  thermalDerating: { fromHours: number; toHours: number; tempC: number } | null;
  limits: LifespanLimit[];
  wearPercent: number;
  remainingDays: number | null;
  predictedReplacementDate: Date | null;
  status: LifespanStatus;
  /** Doporučená výměna, ale náhradní díl není skladem. */
  missingStock: boolean;
  /** Fáze 116: zbývající životnost 100 % (nová) → 0 % (konec), překročení nad 100 % vyčerpání. */
  remainingPercent: number;
  overrunPercent: number;
  /** Životnost vyčerpaná (≥ 100 %) nebo datum konce v minulosti – vyměnit ihned. */
  expired: boolean;
  /** V okně upozornění: zbývá ≤ předstih [dny] nebo ≤ 15 % životnosti. */
  alert: boolean;
  alertLeadDays: number;
}

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Vyčerpání všech relevantních limitů (cykly / B10d, motohodiny s Arrheniem, kalendářní T_M) – rozhoduje
 * nejhorší. Stav: ≥ 95 % nebo po termínu = kritický, ≥ 75 % nebo méně než 90 dní = naplánovat výměnu.
 */
export function assessComponent(
  component: ComponentInput,
  profile: { shiftRegime: number; internalTempC: number | null },
  now: Date,
  options: { alertLeadDays?: number | null } = {},
): LifespanAssessment {
  const perDay = hoursPerDay(profile.shiftRegime);
  const hours = workedHours(component, now, profile.shiftRegime);
  const limits: LifespanLimit[] = [];
  let totalCycles: number | null = null;
  if (component.cyclesPerHour !== null && component.maxElectricalCycles) {
    // Přepěťová ochrana: „cykly“ = zaznamenané výboje (bez četnosti za hodinu), limit = výboje dle výrobce / zkoušky
    const surge = component.wearCategory === "SURGE_PROTECTION";
    totalCycles =
      component.manualCyclesOffset +
      (surge ? 0 : Math.round(hours * component.cyclesPerHour));
    const perDayCycles = surge ? 0 : component.cyclesPerHour * perDay;
    limits.push({
      kind: "cycles",
      label: surge
        ? "Impulzní opotřebení (výboje)"
        : component.wearCategory === "SAFETY_ELEMENT"
          ? "Cykly / B10d"
          : "Elektrická životnost (cykly)",
      used: totalCycles,
      max: component.maxElectricalCycles,
      percent: (totalCycles / component.maxElectricalCycles) * 100,
      remainingDays:
        perDayCycles > 0
          ? (component.maxElectricalCycles - totalCycles) / perDayCycles
          : Infinity,
    });
  }
  let effectiveMaxHours: number | null = null;
  let thermalDerating: LifespanAssessment["thermalDerating"] = null;
  if (component.maxOperatingHours) {
    const tempC = profile.internalTempC ?? DEFAULT_INTERNAL_TEMP_C;
    effectiveMaxHours =
      component.wearCategory === "POWER_ELECTRONICS"
        ? arrheniusHours(component.maxOperatingHours, tempC)
        : component.maxOperatingHours;
    if (effectiveMaxHours < component.maxOperatingHours)
      thermalDerating = {
        fromHours: component.maxOperatingHours,
        toHours: effectiveMaxHours,
        tempC,
      };
    limits.push({
      kind: "hours",
      label: thermalDerating
        ? `Motohodiny (Arrhenius ${String(tempC).replace(".", ",")} °C)`
        : "Motohodiny",
      used: hours,
      max: effectiveMaxHours,
      percent: (hours / effectiveMaxHours) * 100,
      remainingDays:
        perDay > 0 ? (effectiveMaxHours - hours) / perDay : Infinity,
    });
  }
  if (component.maxCalendarMonths) {
    // Fáze 116: baterie stárnou rychleji v teplém rozváděči (kalendářní životnost výrobce při 25 °C)
    const tempC = profile.internalTempC ?? DEFAULT_INTERNAL_TEMP_C;
    const months =
      component.wearCategory === "BATTERY"
        ? batteryMonths(component.maxCalendarMonths, tempC)
        : component.maxCalendarMonths;
    const end = new Date(
      addMonths(component.installedAt, Math.floor(months)).getTime() +
        (months % 1) * 30.44 * DAY_MS,
    );
    const total = (end.getTime() - component.installedAt.getTime()) / DAY_MS;
    const elapsed = (now.getTime() - component.installedAt.getTime()) / DAY_MS;
    limits.push({
      kind: "calendar",
      label:
        component.wearCategory === "SAFETY_ELEMENT"
          ? "Doba mise T_M"
          : component.wearCategory === "BATTERY" && months < component.maxCalendarMonths
            ? `Kalendářní životnost (${String(tempC).replace(".", ",")} °C)`
            : "Kalendářní limit",
      used: Math.round(elapsed),
      max: Math.round(total),
      percent: total > 0 ? (elapsed / total) * 100 : 100,
      remainingDays: (end.getTime() - now.getTime()) / DAY_MS,
    });
  }
  const worst = limits.reduce<LifespanLimit | null>(
    (best, limit) => (!best || limit.percent > best.percent ? limit : best),
    null,
  );
  const wearPercent = worst ? Math.round(worst.percent * 10) / 10 : 0;
  const finiteDays = limits
    .map((limit) => limit.remainingDays)
    .filter(Number.isFinite);
  const remainingDays = finiteDays.length
    ? Math.floor(Math.min(...finiteDays))
    : null;
  const predictedReplacementDate =
    remainingDays === null
      ? null
      : new Date(now.getTime() + remainingDays * DAY_MS);
  const alertLeadDays = options.alertLeadDays ?? DEFAULT_ALERT_DAYS;
  const remainingPercent = Math.max(0, Math.round((100 - wearPercent) * 10) / 10);
  const overrunPercent = Math.max(0, Math.round((wearPercent - 100) * 10) / 10);
  const expired =
    wearPercent >= 100 || (remainingDays !== null && remainingDays <= 0);
  const alert =
    limits.length > 0 &&
    (expired ||
      remainingPercent <= ALERT_PERCENT ||
      (remainingDays !== null && remainingDays <= alertLeadDays));
  const status: LifespanStatus =
    wearPercent >= CRITICAL_THRESHOLD ||
    (remainingDays !== null && remainingDays <= 0)
      ? "CRITICAL_EXPIRED"
      : wearPercent >= PLAN_THRESHOLD ||
          alert ||
          (remainingDays !== null && remainingDays < PLAN_DAYS)
        ? "PLAN_REPLACEMENT"
        : "OK";
  return {
    operatingHours: hours,
    totalCycles,
    effectiveMaxHours,
    thermalDerating,
    limits,
    wearPercent,
    remainingDays,
    predictedReplacementDate,
    status,
    missingStock: status !== "OK" && component.replacementStockCount <= 0,
    remainingPercent,
    overrunPercent,
    expired,
    alert,
    alertLeadDays,
  };
}

const pct = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** „🔴 0 % zbývá (překročeno o +38 %)“ / „62,5 %“. */
export function remainingText(assessment: Pick<LifespanAssessment, "remainingPercent" | "overrunPercent" | "expired">): string {
  if (assessment.overrunPercent > 0) return `🔴 0 % zbývá (překročeno o +${pct(assessment.overrunPercent)} %)`;
  if (assessment.expired) return "🔴 0 % zbývá";
  return `${pct(assessment.remainingPercent)} %`;
}

/** Nad 50 let se datum konce životnosti neuvádí (jističe a vypínače spínané výjimečně). */
export const LONG_LIFE_DAYS = 50 * 365;

/** Počet dní česky: „1 den“, „3 dny“, „731 dní“. */
export const daysWord = (days: number) => `${days.toLocaleString("cs-CZ")} ${days === 1 ? "den" : days >= 2 && days <= 4 ? "dny" : "dní"}`;

/** „14. 11. 2028 (za 731 dní)“ / „🔴 Překročeno – vyměnit ihned“ / „Bez limitu“. */
export function endOfLifeText(assessment: Pick<LifespanAssessment, "predictedReplacementDate" | "remainingDays" | "expired">): string {
  if (assessment.expired) return "🔴 Překročeno – vyměnit ihned";
  if (!assessment.predictedReplacementDate || assessment.remainingDays === null) return "Bez limitu";
  // Jistič / vypínač spínaný jen výjimečně – vzdálené datum nemá vypovídací hodnotu
  if (assessment.remainingDays > LONG_LIFE_DAYS) return "více než 50 let (spíná výjimečně)";
  const date = assessment.predictedReplacementDate.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  return `${date} (za ${daysWord(assessment.remainingDays)})`;
}

/** Barva ukazatele: zelená, oranžová (okno upozornění / plánovat), červená (≤ 5 % / po konci životnosti). */
export function remainingTone(assessment: Pick<LifespanAssessment, "expired" | "alert" | "status">): "green" | "amber" | "red" {
  if (assessment.expired || assessment.status === "CRITICAL_EXPIRED") return "red";
  if (assessment.alert || assessment.status === "PLAN_REPLACEMENT") return "amber";
  return "green";
}
