// Geometrie 2D vektorového rozváděče (fáze 42): DIN lišty, obdélníky přístrojů v modulech a živé
// modré spojnice podle stromu zapojení – přívodní šipka → hlavní prvek → propojky → vodorovná
// hřebenová sběrnice nad (přívod shora) nebo pod (přívod zespoda) přístroji skupiny.
// Spojnice vedou jen mezerami mezi lištami a okraji, nikdy přes přístroje. Čisté funkce.

import { readingOrder } from "./tree";

export type IncomerFrom = "TOP" | "BOTTOM";
export const isIncomerFrom = (value: unknown): value is IncomerFrom => value === "TOP" || value === "BOTTOM";

/** Rozměry plátna v px (viewBox SVG). */
export const VECTOR = {
  moduleW: 40,
  deviceH: 140,
  gap: 84,
  left: 84,
  right: 64,
  top: 70,
  bottom: 70,
  laneStep: 7,
  laneBase: 10,
  lanes: 5,
} as const;

export interface LayoutItem {
  id: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
}

export interface WiringNode {
  id: string;
  parentItemId: string | null;
  fedFromIncomer: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Wire {
  /** Nadřazený prvek (nebo „incomer“ pro hlavní přívod). */
  from: string;
  kind: "incomer" | "feed" | "bus" | "drop";
  points: [number, number][];
}

export interface VectorLayout {
  width: number;
  height: number;
  capacity: number;
  rails: { index: number; top: number; y: number; x0: number; x1: number; used: number }[];
  rects: Map<string, Rect>;
}

const rowTop = (rail: number) => VECTOR.top + (rail - 1) * (VECTOR.deviceH + VECTOR.gap);

/** Rozložení přístrojů na lištách (zleva bez mezer v pořadí `positionOnRail`, jako na fotce). */
export function vectorLayout(items: readonly LayoutItem[], rails: number, modulesPerRail: number): VectorLayout {
  const railCount = Math.max(1, rails, ...items.map((item) => item.dinRailIndex));
  const used = Array.from({ length: railCount }, (_, i) => items.filter((item) => item.dinRailIndex === i + 1).reduce((sum, item) => sum + item.modulesWidth, 0));
  const capacity = Math.max(modulesPerRail, ...used, 1);
  const rects = new Map<string, Rect>();
  for (let rail = 1; rail <= railCount; rail++) {
    let cursor = 0;
    for (const item of [...items].filter((candidate) => candidate.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail)) {
      const w = Math.max(item.modulesWidth, 0.5) * VECTOR.moduleW;
      rects.set(item.id, { x: VECTOR.left + cursor * VECTOR.moduleW, y: rowTop(rail), w, h: VECTOR.deviceH });
      cursor += Math.max(item.modulesWidth, 0.5);
    }
  }
  const width = VECTOR.left + capacity * VECTOR.moduleW + VECTOR.right;
  const height = rowTop(railCount) + VECTOR.deviceH + VECTOR.bottom;
  return {
    width,
    height,
    capacity,
    rects,
    rails: Array.from({ length: railCount }, (_, i) => ({
      index: i + 1,
      top: rowTop(i + 1),
      y: rowTop(i + 1) + VECTOR.deviceH / 2,
      x0: VECTOR.left - 8,
      x1: VECTOR.left + capacity * VECTOR.moduleW + 8,
      used: used[i],
    })),
  };
}

/** Kořeny stromu = prvky napájené přímo z hlavního přívodu. */
export const rootsOf = <T extends WiringNode>(nodes: readonly T[]) => nodes.filter((node) => node.fedFromIncomer && !node.parentItemId);

/**
 * Modré spojnice: přívod do kořene, pro každý nadřazený prvek propojka z jeho výstupu (spodní svorky
 * při přívodu shora) do mezery u vstupů potomků a hřebenová sběrnice s odbočkami ke každému potomkovi.
 */
export function wiringPaths(layout: VectorLayout, items: readonly LayoutItem[], nodes: readonly WiringNode[], incomer: IncomerFrom): Wire[] {
  const wires: Wire[] = [];
  const down = incomer === "TOP";
  const railOf = new Map(items.map((item) => [item.id, item.dinRailIndex]));
  const rectOf = (id: string) => layout.rects.get(id);
  const cx = (rect: Rect) => rect.x + rect.w / 2;
  const inEdge = (rect: Rect) => (down ? rect.y : rect.y + rect.h);
  const outEdge = (rect: Rect) => (down ? rect.y + rect.h : rect.y);
  const offset = (lane: number) => VECTOR.laneBase + (lane % VECTOR.lanes) * VECTOR.laneStep;
  /** Vodorovná dráha v mezeře u vstupů lišty (nad lištou při přívodu shora). */
  const busY = (rail: number, lane: number) => (down ? rowTop(rail) - offset(lane) : rowTop(rail) + VECTOR.deviceH + offset(lane));
  /** Dráha v mezeře u výstupů lišty. */
  const outY = (rail: number, lane: number) => (down ? rowTop(rail) + VECTOR.deviceH + offset(lane) : rowTop(rail) - offset(lane));
  const leftX = (lane: number) => VECTOR.left - 14 - (lane % VECTOR.lanes) * 6;
  const rightX = (lane: number) => layout.width - VECTOR.right + 14 + (lane % VECTOR.lanes) * 6;
  /** Mezera u výstupů lišty r je zároveň mezera u vstupů sousední lišty ve směru toku. */
  const adjacent = (fromRail: number, toRail: number) => (down ? toRail === fromRail + 1 : toRail === fromRail - 1);

  // Hlavní přívod: šipka z okraje plátna do vstupu kořene (přes boční okraj, když kořen není na krajní liště)
  rootsOf(nodes).forEach((root, index) => {
    const rect = rectOf(root.id);
    const rail = railOf.get(root.id);
    if (!rect || !rail) return;
    const x = cx(rect);
    const edgeY = down ? 6 : layout.height - 6;
    const firstRail = down ? 1 : layout.rails.length;
    if (rail === firstRail) wires.push({ from: "incomer", kind: "incomer", points: [[x, edgeY], [x, inEdge(rect)]] });
    else {
      const side = leftX(VECTOR.lanes - 1 - (index % VECTOR.lanes));
      const y = busY(rail, VECTOR.lanes - 1);
      wires.push({ from: "incomer", kind: "incomer", points: [[side, edgeY], [side, y], [x, y], [x, inEdge(rect)]] });
    }
  });

  // Skupiny: nadřazený prvek → jeho potomci (podle lišt)
  const parents = readingOrder(items.filter((item) => nodes.some((node) => node.parentItemId === item.id)));
  parents.forEach((parent, lane) => {
    const from = rectOf(parent.id);
    if (!from) return;
    const children = items.filter((item) => nodes.find((node) => node.id === item.id)?.parentItemId === parent.id && rectOf(item.id));
    const byRail = new Map<number, LayoutItem[]>();
    for (const child of children) byRail.set(child.dinRailIndex, [...(byRail.get(child.dinRailIndex) ?? []), child]);
    const px = cx(from);
    for (const [rail, group] of byRail) {
      const xs = group.map((child) => cx(rectOf(child.id)!));
      const y = busY(rail, lane);
      let busFrom = Math.min(...xs);
      let busTo = Math.max(...xs);
      if (adjacent(parent.dinRailIndex, rail)) {
        // Výstup rodiče míří přímo do mezery se sběrnicí
        wires.push({ from: parent.id, kind: "feed", points: [[px, outEdge(from)], [px, y]] });
        busFrom = Math.min(busFrom, px);
        busTo = Math.max(busTo, px);
      } else {
        // Přes okraj: výstup → mezera u výstupů → bližší boční okraj → mezera u vstupů potomků
        const side = px < (VECTOR.left + layout.width - VECTOR.right) / 2 ? leftX(lane) : rightX(lane);
        const exitY = outY(parent.dinRailIndex, lane);
        wires.push({ from: parent.id, kind: "feed", points: [[px, outEdge(from)], [px, exitY], [side, exitY], [side, y]] });
        busFrom = Math.min(busFrom, side);
        busTo = Math.max(busTo, side);
      }
      wires.push({ from: parent.id, kind: "bus", points: [[busFrom, y], [busTo, y]] });
      for (const child of group) {
        const rect = rectOf(child.id)!;
        wires.push({ from: parent.id, kind: "drop", points: [[cx(rect), y], [cx(rect), inEdge(rect)]] });
      }
    }
  });
  return wires;
}

/** Body spojnice → atribut `d` cesty SVG. */
export const pathOf = (points: readonly [number, number][]) => points.map(([x, y], index) => `${index ? "L" : "M"}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join(" ");
