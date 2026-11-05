// Fáze 56: sloučení detailní fotky lišty s už rozpoznanou lištou.
// Detail celé lišty ji nahradí (je ostřejší). Detail jen ČÁSTI lišty (dlouhá řada nafocená po kouscích)
// lištu NEMAŽE: najde se úsek, kterému detail odpovídá (šířky, kategorie, póly, proud), a přístroje
// v něm se jen zpřesní – ostatní přístroje i zapojení stromu zůstanou.

import type { ComponentCategory } from "@/generated/prisma/enums";

import type { Detection } from "./matching";

/** Podpis přístroje pro zarovnání (z uloženého prvku nebo z detekce). */
export interface RailSignature {
  modules: number;
  category: ComponentCategory | null;
  poles: string | null;
  ratedCurrentA: number | null;
}

export type RailMergePlan = { mode: "replace" } | { mode: "enrich"; pairs: [existingIndex: number, detailIndex: number][]; score: number };

export const signatureOf = (detection: Pick<Detection, "modules" | "category" | "poles" | "ratedCurrentA">): RailSignature => ({
  modules: detection.modules,
  category: detection.category,
  poles: detection.poles,
  ratedCurrentA: detection.ratedCurrentA,
});

/** Podobnost dvou přístrojů: šířka je nejspolehlivější (segmentace), kategorie a parametry jen pomáhají. */
export function similarity(a: RailSignature, b: RailSignature): number {
  let score = Math.abs(a.modules - b.modules) < 0.26 ? 2 : -1;
  if (a.category && b.category) score += a.category === b.category ? 1 : -1;
  if (a.poles && b.poles && a.poles === b.poles) score += 1;
  if (a.ratedCurrentA && b.ratedCurrentA && a.ratedCurrentA === b.ratedCurrentA) score += 1;
  return score;
}

const sum = (rows: readonly RailSignature[]) => rows.reduce((total, row) => total + (row.modules || 1), 0);

/**
 * Plán sloučení. Nahrazuje se, když je lišta prázdná nebo detail pokrývá aspoň 85 % jejích modulů
 * (detail celé lišty) či má aspoň tolik přístrojů. Jinak se detail zarovná na nejlépe odpovídající souvislý
 * úsek lišty; když žádný úsek neodpovídá (průměr < 1,5 bodu na přístroj), lišta se nemění a vrátí se
 * prázdné párování – detail se nesmí „rozmazat“ přes cizí přístroje.
 */
export function planRailMerge(existing: readonly RailSignature[], detail: readonly RailSignature[]): RailMergePlan {
  if (!existing.length || !detail.length) return { mode: "replace" };
  if (detail.length >= existing.length || sum(detail) >= 0.85 * sum(existing)) return { mode: "replace" };
  let best = { offset: -1, score: -Infinity };
  for (let offset = 0; offset + detail.length <= existing.length; offset++) {
    const score = detail.reduce((total, row, index) => total + similarity(existing[offset + index], row), 0);
    if (score > best.score) best = { offset, score };
  }
  if (best.offset < 0 || best.score / detail.length < 1.5) return { mode: "enrich", pairs: [], score: best.score };
  return { mode: "enrich", pairs: detail.map((_, index) => [best.offset + index, index]), score: best.score };
}

/** Uložené `detectedJson` prvku → podpis pro zarovnání. */
export function signatureFromItem(item: { modulesWidth: number; detectedJson: string | null }): RailSignature {
  try {
    const value = item.detectedJson ? (JSON.parse(item.detectedJson) as Partial<Record<keyof RailSignature, unknown>>) : {};
    return {
      modules: item.modulesWidth || 1,
      category: typeof value.category === "string" ? (value.category as ComponentCategory) : null,
      poles: typeof value.poles === "string" ? value.poles : null,
      ratedCurrentA: typeof value.ratedCurrentA === "number" ? value.ratedCurrentA : null,
    };
  } catch {
    return { modules: item.modulesWidth || 1, category: null, poles: null, ratedCurrentA: null };
  }
}
