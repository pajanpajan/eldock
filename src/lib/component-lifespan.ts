// Fáze 53: prediktivní hlídání životnosti součástek rozváděčů a strojů – počet sepnutí ze směnnosti,
// B10d a doba mise T_M bezpečnostních prvků (ČSN EN ISO 13849-1), motohodiny s teplotní degradací
// dle Arrhenia (+10 °C nad 40 °C = poloviční životnost kondenzátorů) a kalendářní limity filtrů / baterií.
// Čisté deterministické funkce – karta zařízení, hlídač lhůt i seed.

export type WearCategory =
  | "SWITCHING_CONTACTOR"
  | "SAFETY_ELEMENT"
  | "POWER_ELECTRONICS"
  | "COOLING_FAN_FILTER";

export const WEAR_CATEGORIES: readonly { id: WearCategory; label: string }[] = [
  {
    id: "SWITCHING_CONTACTOR",
    label: "Silový stykač / relé / ventil (počet sepnutí)",
  },
  {
    id: "SAFETY_ELEMENT",
    label: "Bezpečnostní prvek ISO 13849-1 (B10d, doba mise T_M)",
  },
  {
    id: "POWER_ELECTRONICS",
    label: "Zdroj 24 V DC / měnič / kondenzátory (motohodiny + Arrhenius)",
  },
  {
    id: "COOLING_FAN_FILTER",
    label: "Ventilátor / filtrační vložka / baterie UPS a PLC",
  },
];
export const isWearCategory = (value: unknown): value is WearCategory =>
  WEAR_CATEGORIES.some((category) => category.id === value);

/** Směnnost: 1 směna, 2 směny, 3 směny (pracovní dny), nepřetržitý provoz 24/7. */
export const SHIFT_REGIMES: readonly {
  id: 1 | 2 | 3 | 4;
  label: string;
  hoursPerYear: number;
}[] = [
  { id: 1, label: "1 směna", hoursPerYear: 2000 },
  { id: 2, label: "2 směny", hoursPerYear: 4000 },
  { id: 3, label: "3 směny", hoursPerYear: 6000 },
  { id: 4, label: "24/7", hoursPerYear: 8760 },
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

/** Odpracované hodiny od instalace podle směnnosti. */
export function operatingHours(
  installedAt: Date,
  now: Date,
  shiftRegime: number,
): number {
  const days = Math.max(0, (now.getTime() - installedAt.getTime()) / DAY_MS);
  return Math.round(days * hoursPerDay(shiftRegime));
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
): LifespanAssessment {
  const perDay = hoursPerDay(profile.shiftRegime);
  const hours = operatingHours(component.installedAt, now, profile.shiftRegime);
  const limits: LifespanLimit[] = [];
  let totalCycles: number | null = null;
  if (component.cyclesPerHour !== null && component.maxElectricalCycles) {
    totalCycles =
      component.manualCyclesOffset +
      Math.round(hours * component.cyclesPerHour);
    const perDayCycles = component.cyclesPerHour * perDay;
    limits.push({
      kind: "cycles",
      label:
        component.wearCategory === "SAFETY_ELEMENT"
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
    const end = addMonths(component.installedAt, component.maxCalendarMonths);
    const total = (end.getTime() - component.installedAt.getTime()) / DAY_MS;
    const elapsed = (now.getTime() - component.installedAt.getTime()) / DAY_MS;
    limits.push({
      kind: "calendar",
      label:
        component.wearCategory === "SAFETY_ELEMENT"
          ? "Doba mise T_M"
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
  const status: LifespanStatus =
    wearPercent >= CRITICAL_THRESHOLD ||
    (remainingDays !== null && remainingDays <= 0)
      ? "CRITICAL_EXPIRED"
      : wearPercent >= PLAN_THRESHOLD ||
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
  };
}
