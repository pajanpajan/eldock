import { describe, expect, it } from "vitest";

import { EXACT_LIMIT, optimalOrder, pathCost } from "./route-order";

const points = (coords: [number, number][]) => coords.map(([x, y]) => ({ x, y }));
const manhattanCost = (nodes: { x: number; y: number }[], start = { x: 0, y: 0 }) => (from: number, to: number) => {
  const a = from < 0 ? start : nodes[from];
  const b = nodes[to];
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

describe("fáze 60 – optimální pořadí prvků okruhu", () => {
  it("výsledek nezávisí na pořadí kreslení (zásuvky nakreslené „na přeskáčku“)", () => {
    const nodes = points([[9000, 0], [1000, 0], [5000, 0], [3000, 0], [7000, 0]]);
    const cost = manhattanCost(nodes);
    const order = optimalOrder(nodes.length, cost);
    expect(order.map((index) => nodes[index].x)).toEqual([1000, 3000, 5000, 7000, 9000]);
    expect(pathCost(order, cost)).toBe(9000);
    // Pořadí kreslení by stálo 9 + 8 + 4 + 2 + 4 = 27 m
    expect(pathCost([0, 1, 2, 3, 4], cost)).toBe(27_000);
    const shuffled = [nodes[3], nodes[0], nodes[4], nodes[1], nodes[2]];
    const again = optimalOrder(shuffled.length, manhattanCost(shuffled));
    expect(again.map((index) => shuffled[index].x)).toEqual([1000, 3000, 5000, 7000, 9000]);
  });

  it("přesně do 11 prvků lépe než hladový nejbližší soused; velké okruhy heuristikou bez zhoršení", () => {
    // Nejbližší soused z rozváděče jde nejdřív k (1000, 0), pak musí přeskočit tam a zpět
    const nodes = points([[1000, 0], [-1500, 0], [3000, 0], [-3000, 0]]);
    const cost = manhattanCost(nodes);
    const order = optimalOrder(nodes.length, cost);
    expect(pathCost(order, cost)).toBe(1500 + 1500 + 4000 + 2000); // vlevo, pak celou řadu doprava
    const many = points(Array.from({ length: EXACT_LIMIT + 4 }, (_, i) => [((i * 7919) % 13) * 1000, ((i * 104_729) % 5) * 1000] as [number, number]));
    const big = optimalOrder(many.length, manhattanCost(many));
    expect(new Set(big).size).toBe(many.length);
    expect(pathCost(big, manhattanCost(many))).toBeLessThanOrEqual(pathCost(many.map((_, i) => i), manhattanCost(many)));
  });
});
