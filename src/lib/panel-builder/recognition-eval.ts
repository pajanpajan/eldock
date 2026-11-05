// Fáze 56: měření přesnosti rozpoznávání fotek rozváděčů proti ručně ověřené pravdě.
// Každá lišta se zarovná (Needleman–Wunsch nad podobností přístrojů), takže jeden vynechaný přístroj
// nezpůsobí posun a „chybu“ všech dalších. Výstup: počty lišt a přístrojů, vynechané / navíc a přesnost polí.

import type { ComponentCategory } from "@/generated/prisma/enums";

import type { Detection } from "./matching";
import { similarity } from "./rail-merge";

/** Jeden přístroj v pravdě (`<fotka>.truth.json`); neuvedené pole se nehodnotí. */
export interface TruthDevice {
  category: ComponentCategory;
  modules: number;
  poles?: string;
  ratedCurrentA?: number;
  trippingCurve?: string;
  rcdType?: string;
  rcdSensitivityMa?: number;
  manufacturer?: string;
}

export interface TruthFile {
  /** Lišty shora dolů, přístroje zleva doprava. */
  rails: TruthDevice[][];
  manufacturerHint?: string | null;
  note?: string;
}

export const EVAL_FIELDS = ["category", "modules", "poles", "ratedCurrentA", "trippingCurve", "rcdType", "rcdSensitivityMa", "manufacturer"] as const;
export type EvalField = (typeof EVAL_FIELDS)[number];

export interface RailScore {
  rail: number;
  truth: number;
  predicted: number;
  matched: number;
  missed: number;
  extra: number;
  /** Přístroje, které sedí ve VŠECH hodnocených polích. */
  exact: number;
  fields: Record<EvalField, { correct: number; total: number }>;
}

export interface PhotoScore {
  railsTruth: number;
  railsPredicted: number;
  rails: RailScore[];
  devicesTruth: number;
  exact: number;
  missed: number;
  extra: number;
  fields: Record<EvalField, { correct: number; total: number }>;
}

const emptyFields = () => Object.fromEntries(EVAL_FIELDS.map((field) => [field, { correct: 0, total: 0 }])) as Record<EvalField, { correct: number; total: number }>;

const same = (field: EvalField, truth: TruthDevice, predicted: Detection) => {
  const expected = truth[field];
  if (expected === undefined || expected === null) return null;
  const actual = predicted[field as keyof Detection];
  if (field === "modules") return Math.abs(Number(actual) - Number(expected)) < 0.26;
  if (field === "manufacturer") return typeof actual === "string" && actual.toLowerCase().startsWith(String(expected).toLowerCase().slice(0, 3));
  return actual === expected;
};

/** Globální zarovnání dvou řad přístrojů (mezera = −1, shoda = podobnost z rail-merge). */
export function alignRail(truth: readonly TruthDevice[], predicted: readonly Detection[]): [number | null, number | null][] {
  const t = truth.length;
  const p = predicted.length;
  const score = Array.from({ length: t + 1 }, () => new Array<number>(p + 1).fill(0));
  for (let i = 1; i <= t; i++) score[i][0] = -i;
  for (let j = 1; j <= p; j++) score[0][j] = -j;
  const sim = (i: number, j: number) =>
    similarity({ modules: truth[i].modules, category: truth[i].category, poles: truth[i].poles ?? null, ratedCurrentA: truth[i].ratedCurrentA ?? null }, predicted[j]);
  for (let i = 1; i <= t; i++) for (let j = 1; j <= p; j++) score[i][j] = Math.max(score[i - 1][j - 1] + sim(i - 1, j - 1), score[i - 1][j] - 1, score[i][j - 1] - 1);
  const pairs: [number | null, number | null][] = [];
  let i = t;
  let j = p;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && score[i][j] === score[i - 1][j - 1] + sim(i - 1, j - 1)) {
      pairs.push([--i, --j]);
    } else if (i > 0 && score[i][j] === score[i - 1][j] - 1) {
      pairs.push([--i, null]);
    } else {
      pairs.push([null, --j]);
    }
  }
  return pairs.reverse();
}

export function scoreRail(rail: number, truth: readonly TruthDevice[], predicted: readonly Detection[]): RailScore {
  const fields = emptyFields();
  let matched = 0;
  let missed = 0;
  let extra = 0;
  let exact = 0;
  for (const [ti, pi] of alignRail(truth, predicted)) {
    if (ti === null) {
      extra++;
      continue;
    }
    if (pi === null) {
      missed++;
      continue;
    }
    matched++;
    let all = true;
    for (const field of EVAL_FIELDS) {
      const result = same(field, truth[ti], predicted[pi]);
      if (result === null) continue;
      fields[field].total++;
      if (result) fields[field].correct++;
      else all = false;
    }
    if (all) exact++;
  }
  return { rail, truth: truth.length, predicted: predicted.length, matched, missed, extra, exact, fields };
}

export function scorePhoto(truth: TruthFile, detections: readonly Detection[]): PhotoScore {
  const predictedRails = new Map<number, Detection[]>();
  for (const detection of [...detections].sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail)) {
    predictedRails.set(detection.dinRailIndex, [...(predictedRails.get(detection.dinRailIndex) ?? []), detection]);
  }
  const railCount = Math.max(truth.rails.length, ...predictedRails.keys(), 0);
  const rails = Array.from({ length: railCount }, (_, index) => scoreRail(index + 1, truth.rails[index] ?? [], predictedRails.get(index + 1) ?? []));
  const fields = emptyFields();
  for (const rail of rails) for (const field of EVAL_FIELDS) {
    fields[field].correct += rail.fields[field].correct;
    fields[field].total += rail.fields[field].total;
  }
  return {
    railsTruth: truth.rails.length,
    railsPredicted: predictedRails.size,
    rails,
    devicesTruth: truth.rails.reduce((sum, rail) => sum + rail.length, 0),
    exact: rails.reduce((sum, rail) => sum + rail.exact, 0),
    missed: rails.reduce((sum, rail) => sum + rail.missed, 0),
    extra: rails.reduce((sum, rail) => sum + rail.extra, 0),
    fields,
  };
}

export const percent = (correct: number, total: number) => (total ? `${Math.round((correct / total) * 100)} %` : "–");
