// Fáze 52: zkoušení proudových chráničů (RCD) při revizi dle ČSN EN 61557-6 ed. 2 a ČSN 33 2000-6 ed. 2 –
// tři předepsané zkoušky (nevybavovací proud 0,5 · IΔn, vybavovací čas při 1 · IΔn, vybavovací proud IΔ)
// a kontrola impedance smyčky Zsm ≤ 2/3 · Zs,max. Čisté funkce – formulář revize, služba i protokol.

export type RcdTestType = "AC" | "A" | "F" | "B";
export const RCD_TEST_TYPES: readonly RcdTestType[] = ["A", "F", "B", "AC"];

export interface RcdTest {
  /** Jmenovitý reziduální proud IΔn [mA]. */
  ratedMa: number;
  type: RcdTestType;
  /** 1) Při 0,5 · IΔn po dobu ≥ 300 ms chránič NEVYBAVIL (true = vyhovuje). */
  noTripAtHalf: boolean | null;
  /** 2) Vybavovací čas při 1 · IΔn [ms]. */
  tripTimeMs: number | null;
  /** 3) Vybavovací proud IΔ [mA] (typ A pulzujícím DC proudem). */
  tripCurrentMa: number | null;
  /** Naměřená impedance smyčky Zsm [Ω] a jistič, který okruh chrání. */
  loopOhm: number | null;
  breakerA: number | null;
  breakerCurve: "B" | "C";
}

export const DEFAULT_RCD_TEST: RcdTest = {
  ratedMa: 30,
  type: "A",
  noTripAtHalf: true,
  tripTimeMs: null,
  tripCurrentMa: null,
  loopOhm: null,
  breakerA: 16,
  breakerCurve: "B",
};

/** Max. vybavovací čas při 1 · IΔn – obecný (neselektivní) chránič. */
export const MAX_TRIP_TIME_MS = 300;

/** Rozsah vybavovacího proudu podle typu (násobky IΔn): AC 0,5–1,0, A 0,35–1,4 (pulzní DC), F 0,35–1,4, B 0,5–2,0. */
export function tripCurrentRange(type: RcdTestType): {
  min: number;
  max: number;
} {
  if (type === "AC") return { min: 0.5, max: 1 };
  if (type === "B") return { min: 0.5, max: 2 };
  return { min: 0.35, max: 1.4 };
}

/** Max. dovolená naměřená impedance smyčky Zsm = 2/3 · Zs,max = 2/3 · U0 / Ia (Ia = 5 · In pro B, 10 · In pro C). */
export function maxMeasuredLoopOhm(
  breakerA: number,
  curve: "B" | "C",
  u0 = 230,
): number {
  const ia = (curve === "C" ? 10 : 5) * breakerA;
  return Math.round((2 / 3) * (u0 / ia) * 1000) / 1000;
}

const finite = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
    ? value
    : null;

/** Očištění vstupu z formuláře / JSON; bez jediné hodnoty zkoušky = null (chránič se nezkoušel). */
export function sanitizeRcdTest(value: unknown): RcdTest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<RcdTest>;
  const test: RcdTest = {
    ratedMa: finite(input.ratedMa, 6, 1000) ?? 30,
    type: RCD_TEST_TYPES.includes(input.type as RcdTestType)
      ? (input.type as RcdTestType)
      : "A",
    noTripAtHalf:
      typeof input.noTripAtHalf === "boolean" ? input.noTripAtHalf : null,
    tripTimeMs: finite(input.tripTimeMs, 0, 5000),
    tripCurrentMa: finite(input.tripCurrentMa, 0, 5000),
    loopOhm: finite(input.loopOhm, 0, 100),
    breakerA: finite(input.breakerA, 1, 630),
    breakerCurve: input.breakerCurve === "C" ? "C" : "B",
  };
  return test.noTripAtHalf === null &&
    test.tripTimeMs === null &&
    test.tripCurrentMa === null &&
    test.loopOhm === null
    ? null
    : test;
}

export function parseRcdTest(json: string | null | undefined): RcdTest | null {
  if (!json) return null;
  try {
    return sanitizeRcdTest(JSON.parse(json));
  } catch {
    return null;
  }
}

const num = (value: number, digits = 2) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

export interface RcdTestRow {
  label: string;
  symbol: string;
  value: string;
  limit: string;
  ok: boolean | null;
}

/** Řádky protokolu: 3 zkoušky chrániče + impedance smyčky. */
export function rcdTestRows(test: RcdTest): RcdTestRow[] {
  const range = tripCurrentRange(test.type);
  const zsMax = test.breakerA
    ? maxMeasuredLoopOhm(test.breakerA, test.breakerCurve)
    : null;
  return [
    {
      label: `RCD typ ${test.type} ${test.ratedMa} mA – 1) nevybavovací proud 0,5 · IΔn (≥ 300 ms)`,
      symbol: "0,5 · I_Δn",
      value:
        test.noTripAtHalf === null
          ? "–"
          : test.noTripAtHalf
            ? "nevybavil"
            : "VYBAVIL",
      limit: "nesmí vybavit",
      ok: test.noTripAtHalf,
    },
    {
      label: "2) vybavovací čas při 1 · IΔn",
      symbol: "t_Δ",
      value: test.tripTimeMs === null ? "–" : `${num(test.tripTimeMs, 0)} ms`,
      limit: `≤ ${MAX_TRIP_TIME_MS} ms`,
      ok: test.tripTimeMs === null ? null : test.tripTimeMs <= MAX_TRIP_TIME_MS,
    },
    {
      label: `3) vybavovací proud${test.type === "A" || test.type === "F" ? " (pulzující DC)" : ""}`,
      symbol: "I_Δ",
      value:
        test.tripCurrentMa === null ? "–" : `${num(test.tripCurrentMa, 1)} mA`,
      limit: `${num(range.min * test.ratedMa, 1)}–${num(range.max * test.ratedMa, 1)} mA`,
      ok:
        test.tripCurrentMa === null
          ? null
          : test.tripCurrentMa >= range.min * test.ratedMa &&
            test.tripCurrentMa <= range.max * test.ratedMa,
    },
    {
      label: `Impedance poruchové smyčky${test.breakerA ? ` (jistič ${test.breakerCurve}${test.breakerA})` : ""}`,
      symbol: "Z_sm",
      value: test.loopOhm === null ? "–" : `${num(test.loopOhm, 3)} Ω`,
      limit: zsMax === null ? "–" : `≤ ⅔ · Z_s,max = ${num(zsMax, 3)} Ω`,
      ok:
        test.loopOhm === null || zsMax === null ? null : test.loopOhm <= zsMax,
    },
  ];
}
