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
  /** Fáze 115: napájený přístroj u odbočky (`drop`). */
  to?: string;
  kind: "incomer" | "feed" | "bus" | "drop";
  points: [number, number][];
}

export interface VectorRail {
  index: number;
  top: number;
  y: number;
  x0: number;
  x1: number;
  used: number;
  capacity: number;
  /** Fáze 111: začátek modulů lišty (levé pole = `VECTOR.left`, pravé pole za svislou přepážkou). */
  left: number;
  /** Fáze 111: pravý okraj sloupce lišty (tlačítko „+ modul“, boční dráhy spojnic). */
  right: number;
  /** Fáze 111: pole lišty (0 = A vlevo, 1 = B vpravo) a pořadí řady v poli. */
  field: 0 | 1;
  row: number;
}

export interface VectorLayout {
  width: number;
  height: number;
  capacity: number;
  rails: VectorRail[];
  rects: Map<string, Rect>;
  /** Fáze 111: dvě pole vedle sebe – svislá přepážka skříně a záhlaví polí. */
  fields: { partitionX: number; labels: [string, string]; columns: [{ left: number; right: number }, { left: number; right: number }] } | null;
  /** Fáze 111: vodorovná izolační přepážka mezi silnoproudem a slaboproudem. */
  partition: { y: number; label: string } | null;
}

/** Fáze 111: volby rozložení – dvě pole vedle sebe (lišty 1…n vlevo) nebo přepážka pod lištou n. */
export interface VectorLayoutOptions {
  fields?: { aRails: number; labels: [string, string] } | null;
  partition?: { afterRail: number; label: string } | null;
}

/** Fáze 111: mezera mezi poli (svislá přepážka skříně) a výška záhlaví polí / přepážky. */
export const FIELD_GAP = 110;
export const FIELD_HEADER = 26;

const rowTopOf = (top: number, row: number) => top + (row - 1) * (VECTOR.deviceH + VECTOR.gap);

/**
 * Rozložení přístrojů na lištách (zleva bez mezer v pořadí `positionOnRail`, jako na fotce).
 * `modulesPerRail` = jedna šířka pro všechny lišty, nebo kapacita každé lišty zvlášť (fáze 43). Fáze 111: dvě pole
 * vedle sebe (levé pole lišty 1…n, pravé zbytek – svislá přepážka) nebo vodorovná přepážka silnoproud / slaboproud.
 */
export function vectorLayout(items: readonly LayoutItem[], rails: number, modulesPerRail: number | readonly number[], options: VectorLayoutOptions = {}): VectorLayout {
  const railCount = Math.max(1, rails, ...items.map((item) => item.dinRailIndex));
  const used = Array.from({ length: railCount }, (_, i) => items.filter((item) => item.dinRailIndex === i + 1).reduce((sum, item) => sum + item.modulesWidth, 0));
  const railCapacity = (index: number) => (typeof modulesPerRail === "number" ? modulesPerRail : (modulesPerRail[index] ?? modulesPerRail[modulesPerRail.length - 1] ?? 12));
  const capacities = Array.from({ length: railCount }, (_, i) => railCapacity(i));
  const split = options.fields && options.fields.aRails >= 1 && options.fields.aRails < railCount ? options.fields.aRails : null;
  const partitionAfter = !split && options.partition && options.partition.afterRail >= 1 && options.partition.afterRail < railCount ? options.partition.afterRail : null;
  const top = VECTOR.top + (split || partitionAfter ? FIELD_HEADER : 0);
  const fieldOf = (index: number): 0 | 1 => (split !== null && index >= split ? 1 : 0);
  const rowOf = (index: number) => (split !== null && index >= split ? index - split + 1 : index + 1);
  const widest = (field: 0 | 1) => Math.max(1, ...capacities.filter((_, i) => fieldOf(i) === field), ...used.filter((_, i) => fieldOf(i) === field));
  const widthA = widest(0);
  const leftB = VECTOR.left + widthA * VECTOR.moduleW + FIELD_GAP;
  const leftOf = (index: number) => (fieldOf(index) === 1 ? leftB : VECTOR.left);
  const rightOf = (index: number) => (fieldOf(index) === 1 ? leftB + widest(1) * VECTOR.moduleW : VECTOR.left + widthA * VECTOR.moduleW);
  const capacity = split !== null ? widthA + widest(1) + Math.ceil(FIELD_GAP / VECTOR.moduleW) : Math.max(...capacities, ...used, 1);
  const rects = new Map<string, Rect>();
  for (let rail = 1; rail <= railCount; rail++) {
    let cursor = 0;
    for (const item of [...items].filter((candidate) => candidate.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail)) {
      const w = Math.max(item.modulesWidth, 0.5) * VECTOR.moduleW;
      rects.set(item.id, { x: leftOf(rail - 1) + cursor * VECTOR.moduleW, y: rowTopOf(top, rowOf(rail - 1)), w, h: VECTOR.deviceH });
      cursor += Math.max(item.modulesWidth, 0.5);
    }
  }
  const rows = Math.max(1, ...Array.from({ length: railCount }, (_, i) => rowOf(i)));
  const width = split !== null ? leftB + widest(1) * VECTOR.moduleW + VECTOR.right : VECTOR.left + capacity * VECTOR.moduleW + VECTOR.right;
  const height = rowTopOf(top, rows) + VECTOR.deviceH + VECTOR.bottom;
  const railList = Array.from({ length: railCount }, (_, i): VectorRail => {
    const railTop = rowTopOf(top, rowOf(i));
    return {
      index: i + 1,
      top: railTop,
      y: railTop + VECTOR.deviceH / 2,
      x0: leftOf(i) - 8,
      x1: leftOf(i) + Math.max(capacities[i], used[i]) * VECTOR.moduleW + 8,
      used: used[i],
      capacity: capacities[i],
      left: leftOf(i),
      right: rightOf(i),
      field: fieldOf(i),
      row: rowOf(i),
    };
  });
  return {
    width,
    height,
    capacity,
    rects,
    rails: railList,
    fields:
      split !== null
        ? {
            partitionX: VECTOR.left + widthA * VECTOR.moduleW + FIELD_GAP / 2,
            labels: options.fields!.labels,
            columns: [
              { left: VECTOR.left, right: VECTOR.left + widthA * VECTOR.moduleW },
              { left: leftB, right: leftB + widest(1) * VECTOR.moduleW },
            ],
          }
        : null,
    partition: partitionAfter !== null ? { y: rowTopOf(top, partitionAfter) + VECTOR.deviceH + VECTOR.gap / 2, label: options.partition!.label } : null,
  };
}

/** Kořeny stromu = prvky napájené přímo z hlavního přívodu. */
export const rootsOf = <T extends WiringNode>(nodes: readonly T[]) => nodes.filter((node) => node.fedFromIncomer && !node.parentItemId);

/**
 * Modré spojnice: přívod do kořene, pro každý nadřazený prvek propojka z jeho výstupu (spodní svorky
 * při přívodu shora) do mezery u vstupů potomků a hřebenová sběrnice s odbočkami ke každému potomkovi.
 */
export function wiringPaths(layout: VectorLayout, items: readonly LayoutItem[], nodes: readonly WiringNode[], incomer: IncomerFrom, combFed: ReadonlySet<string> = new Set()): Wire[] {
  const wires: Wire[] = [];
  const down = incomer === "TOP";
  const railOf = new Map(items.map((item) => [item.id, item.dinRailIndex]));
  const rectOf = (id: string) => layout.rects.get(id);
  const cx = (rect: Rect) => rect.x + rect.w / 2;
  const inEdge = (rect: Rect) => (down ? rect.y : rect.y + rect.h);
  const outEdge = (rect: Rect) => (down ? rect.y + rect.h : rect.y);
  const offset = (lane: number) => VECTOR.laneBase + (lane % VECTOR.lanes) * VECTOR.laneStep;
  // Fáze 111: horní hrana a sloupec lišty z rozložení (dvě pole vedle sebe mají lišty ve dvou sloupcích)
  const railTop = (rail: number) => layout.rails[rail - 1]?.top ?? VECTOR.top + (rail - 1) * (VECTOR.deviceH + VECTOR.gap);
  const railInfo = (rail: number) => layout.rails[rail - 1] ?? null;
  /** Vodorovná dráha v mezeře u vstupů lišty (nad lištou při přívodu shora). */
  const busY = (rail: number, lane: number) => (down ? railTop(rail) - offset(lane) : railTop(rail) + VECTOR.deviceH + offset(lane));
  /** Dráha v mezeře u výstupů lišty. */
  const outY = (rail: number, lane: number) => (down ? railTop(rail) + VECTOR.deviceH + offset(lane) : railTop(rail) - offset(lane));
  const leftX = (lane: number, rail = 1) => (railInfo(rail)?.left ?? VECTOR.left) - 14 - (lane % VECTOR.lanes) * 6;
  const rightX = (lane: number, rail = 1) => (layout.fields ? (railInfo(rail)?.right ?? layout.width - VECTOR.right) : layout.width - VECTOR.right) + 14 + (lane % VECTOR.lanes) * 6;
  /** Mezera u výstupů lišty r je zároveň mezera u vstupů sousední lišty ve směru toku (stejné pole). */
  const adjacent = (fromRail: number, toRail: number) => {
    const from = railInfo(fromRail);
    const to = railInfo(toRail);
    if (from && to) return from.field === to.field && (down ? to.row === from.row + 1 : to.row === from.row - 1);
    return down ? toRail === fromRail + 1 : toRail === fromRail - 1;
  };

  // Hlavní přívod: šipka z okraje plátna do vstupu kořene (přes boční okraj, když kořen není na krajní liště)
  rootsOf(nodes).forEach((root, index) => {
    const rect = rectOf(root.id);
    const rail = railOf.get(root.id);
    if (!rect || !rail) return;
    const x = cx(rect);
    const edgeY = down ? 6 : layout.height - 6;
    // Fáze 111: krajní lišta sloupce (u dvou polí každé pole zvlášť)
    const info = railInfo(rail);
    const columnRows = info ? layout.rails.filter((candidate) => candidate.field === info.field).length : layout.rails.length;
    const edgeRow = info ? (down ? info.row === 1 : info.row === columnRows) : rail === (down ? 1 : layout.rails.length);
    if (edgeRow) wires.push({ from: "incomer", kind: "incomer", points: [[x, edgeY], [x, inEdge(rect)]] });
    else {
      const side = leftX(VECTOR.lanes - 1 - (index % VECTOR.lanes), rail);
      const y = busY(rail, VECTOR.lanes - 1);
      wires.push({ from: "incomer", kind: "incomer", points: [[side, edgeY], [side, y], [x, y], [x, inEdge(rect)]] });
    }
  });

  // Skupiny: nadřazený prvek → jeho potomci (podle lišt)
  const parents = readingOrder(items.filter((item) => nodes.some((node) => node.parentItemId === item.id)));
  parents.forEach((parent, lane) => {
    const from = rectOf(parent.id);
    if (!from) return;
    // Fáze 115: přístroj napájený hřebenem (jistič za chráničem na téže liště, další jističochránič řady) bez spojnice
    const children = items.filter((item) => nodes.find((node) => node.id === item.id)?.parentItemId === parent.id && rectOf(item.id) && !combFed.has(item.id));
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
        // Přes okraj: výstup → mezera u výstupů → bližší boční okraj → mezera u vstupů potomků (fáze 111: u dvou polí
        // vede propojka mezi poli mezerou svislé přepážky, v jednom poli okrajem sloupce)
        const fromInfo = railInfo(parent.dinRailIndex);
        const toInfo = railInfo(rail);
        const side =
          layout.fields && fromInfo && toInfo && fromInfo.field !== toInfo.field
            ? layout.fields.partitionX + ((lane % VECTOR.lanes) - 2) * 6
            : layout.fields && fromInfo
              ? px < (fromInfo.left + fromInfo.right) / 2
                ? leftX(lane, parent.dinRailIndex)
                : rightX(lane, parent.dinRailIndex)
              : px < (VECTOR.left + layout.width - VECTOR.right) / 2
                ? leftX(lane)
                : rightX(lane);
        const exitY = outY(parent.dinRailIndex, lane);
        wires.push({ from: parent.id, kind: "feed", points: [[px, outEdge(from)], [px, exitY], [side, exitY], [side, y]] });
        busFrom = Math.min(busFrom, side);
        busTo = Math.max(busTo, side);
      }
      wires.push({ from: parent.id, kind: "bus", points: [[busFrom, y], [busTo, y]] });
      for (const child of group) {
        const rect = rectOf(child.id)!;
        wires.push({ from: parent.id, to: child.id, kind: "drop", points: [[cx(rect), y], [cx(rect), inEdge(rect)]] });
      }
    }
  });
  return wires;
}

/** Body spojnice → atribut `d` cesty SVG. */
export const pathOf = (points: readonly [number, number][]) => points.map(([x, y], index) => `${index ? "L" : "M"}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join(" ");
