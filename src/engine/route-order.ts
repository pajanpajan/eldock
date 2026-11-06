// Fáze 60: nejkratší pořadí prvků okruhu (otevřená cesta z rozváděče přes všechny prvky). Do 11 prvků přesně
// (Held–Karp, dynamické programování přes podmnožiny), větší okruhy nejbližší soused + 2-opt + přesun prvku.
// Výsledek nezávisí na pořadí, v jakém byly prvky nakresleny (shoda cen řeší index, ne čas vložení). Čisté funkce.

/** Cena přechodu: `from` = −1 je rozváděč, jinak index prvku. */
export type StepCost = (from: number, to: number) => number;

/** Nejvyšší počet prvků pro přesný výpočet (2^11 · 11² ≈ 250 tis. kroků). */
export const EXACT_LIMIT = 11;

export function pathCost(order: readonly number[], cost: StepCost): number {
  let total = 0;
  let previous = -1;
  for (const node of order) {
    total += cost(previous, node);
    previous = node;
  }
  return total;
}

/** Přesně: dp[mask][j] = nejlevnější cesta z rozváděče přes množinu `mask` končící v j. */
function heldKarp(count: number, cost: StepCost): number[] {
  const size = 1 << count;
  const dp = new Float64Array(size * count).fill(Infinity);
  const parent = new Int8Array(size * count).fill(-1);
  for (let j = 0; j < count; j++) dp[(1 << j) * count + j] = cost(-1, j);
  const matrix = Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => (i === j ? 0 : cost(i, j))));
  for (let mask = 1; mask < size; mask++) {
    for (let j = 0; j < count; j++) {
      const current = dp[mask * count + j];
      if (!(mask & (1 << j)) || current === Infinity) continue;
      for (let k = 0; k < count; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const value = current + matrix[j][k];
        if (value < dp[next * count + k] - 1e-9) {
          dp[next * count + k] = value;
          parent[next * count + k] = j;
        }
      }
    }
  }
  const full = size - 1;
  let end = 0;
  for (let j = 1; j < count; j++) if (dp[full * count + j] < dp[full * count + end] - 1e-9) end = j;
  const order: number[] = [];
  for (let mask = full, node = end; node !== -1; ) {
    order.unshift(node);
    const previous = parent[mask * count + node];
    mask &= ~(1 << node);
    node = previous;
  }
  return order;
}

/** Heuristika pro velké okruhy: nejbližší soused z rozváděče, pak 2-opt a přesun jednoho prvku, dokud se zkracuje. */
function heuristic(count: number, cost: StepCost): number[] {
  const left = new Set(Array.from({ length: count }, (_, i) => i));
  const order: number[] = [];
  let at = -1;
  while (left.size) {
    let best = -1;
    for (const node of left) if (best === -1 || cost(at, node) < cost(at, best) - 1e-9) best = node;
    order.push(best);
    left.delete(best);
    at = best;
  }
  let improved = true;
  for (let round = 0; improved && round < 50; round++) {
    improved = false;
    const base = pathCost(order, cost);
    // 2-opt: otočení úseku i..j
    for (let i = 0; i < count - 1 && !improved; i++) {
      for (let j = i + 1; j < count && !improved; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathCost(candidate, cost) < base - 1e-6) {
          order.splice(0, count, ...candidate);
          improved = true;
        }
      }
    }
    // Přesun jednoho prvku na jiné místo
    for (let i = 0; i < count && !improved; i++) {
      for (let j = 0; j < count && !improved; j++) {
        if (i === j) continue;
        const candidate = [...order];
        const [node] = candidate.splice(i, 1);
        candidate.splice(j, 0, node);
        if (pathCost(candidate, cost) < base - 1e-6) {
          order.splice(0, count, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Nejkratší pořadí prvků (indexy) pro otevřenou cestu z rozváděče. */
export function optimalOrder(count: number, cost: StepCost): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  return count <= EXACT_LIMIT ? heldKarp(count, cost) : heuristic(count, cost);
}
