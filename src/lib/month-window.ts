// Deterministické posuny dat pro demo data plánovače revizí: kus „tento měsíc“ a kus „příští měsíc“
// musí vyjít správně v každý den roku (i 1. a poslední den v měsíci, přestupný rok). Čisté funkce
// nad pražským kalendářním dnem `YYYY-MM-DD`.

const DAY_MS = 24 * 3600 * 1000;

const parse = (today: string) => {
  const [year, month, day] = today.split("-").map(Number);
  return { year, month, day, utc: Date.UTC(year, month - 1, day) };
};

/** Dny do posledního dne aktuálního měsíce (poslední den = 0). */
export function daysToMonthEnd(today: string): number {
  const { year, month, utc } = parse(today);
  return Math.round((Date.UTC(year, month, 0) - utc) / DAY_MS);
}

/** Posuny ve dnech od dneška: polovina zbytku měsíce (nikdy do minulosti) a 5. den příštího měsíce. */
export function monthWindowOffsets(today: string): { thisMonth: number; nextMonth: number } {
  const rest = daysToMonthEnd(today);
  return { thisMonth: Math.floor(rest / 2), nextMonth: rest + 5 };
}

/** Pražský den + N dní jako `YYYY-MM-DD`. */
export function addDaysIso(today: string, days: number): string {
  return new Date(parse(today).utc + days * DAY_MS).toISOString().slice(0, 10);
}
