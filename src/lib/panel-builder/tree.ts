// Hierarchický strom zapojení rozváděče: návrh stromu, rozvržení fází, hlídač (guardrails)
// a přečíslování IEC značení. Čisté funkce – sdílí editor stromu (klient) i služba (server).

import type { ComponentCategory } from "@/generated/prisma/enums";

import { phaseCount, poleCount } from "./catalog";
import { designationsInOrder } from "./matching";

export const PHASE_OPTIONS = ["L1,L2,L3,N", "L1,L2,L3", "L1", "L2", "L3", "L1,N", "L2,N", "L3,N"] as const;
export type PhaseAssignment = (typeof PHASE_OPTIONS)[number];
export const isPhaseAssignment = (value: string | null | undefined): value is PhaseAssignment => (PHASE_OPTIONS as readonly (string | null | undefined)[]).includes(value);

export interface TreeNode {
  id: string;
  designation: string;
  circuitLabel: string;
  dinRailIndex: number;
  positionOnRail: number;
  category: ComponentCategory | null;
  poles: string | null;
  ratedCurrentA: number | null;
  operatingCurrentA: number | null;
  parentItemId: string | null;
  fedFromIncomer: boolean;
  phaseAssignment: string | null;
}

/** Editovatelná část uzlu (to, co ukládá editor stromu). */
export type TreeAssignment = Pick<TreeNode, "id" | "parentItemId" | "fedFromIncomer" | "phaseAssignment" | "circuitLabel" | "designation">;

export const readingOrder = <T extends Pick<TreeNode, "dinRailIndex" | "positionOnRail">>(items: readonly T[]) => [...items].sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail);

const isThreePhase = (node: Pick<TreeNode, "poles">) => phaseCount(node.poles ?? "1P") === 3;
const hasNeutral = (node: Pick<TreeNode, "poles">) => node.poles === "3P+N" || node.poles === "4P" || node.poles === "1P+N" || node.poles === "2P";

/** Fáze, které uzel vede (pro kontrolu potomků a bilanci). */
export function phasesOf(node: Pick<TreeNode, "phaseAssignment" | "poles">): string[] {
  if (node.phaseAssignment) return node.phaseAssignment.split(",").filter((phase) => phase !== "N");
  return isThreePhase(node) ? ["L1", "L2", "L3"] : [];
}

/** Výchozí fáze vícepólového přístroje. */
export function threePhaseAssignment(node: Pick<TreeNode, "poles">): PhaseAssignment {
  return hasNeutral(node) && poleCount(node.poles ?? "") >= 4 ? "L1,L2,L3,N" : "L1,L2,L3";
}

/** Návrhový proud vývodu pro bilanci (Ib, jinak In). */
export const designCurrent = (node: Pick<TreeNode, "operatingCurrentA" | "ratedCurrentA">) => node.operatingCurrentA ?? node.ratedCurrentA ?? 0;

// ---------------------------------------------------------------------------
//  AI návrh stromu na 1 klik (pravidlo DIN lišty a hřebenové propojky)
// ---------------------------------------------------------------------------

/** Vývod napájený z chrániče nebo hlavního vypínače (jistič, stykač, relé, nerozpoznaný přístroj …). */
const isFeeder = (node: Pick<TreeNode, "category">) => !node.category || !["MAIN_SWITCH", "RCD", "RCBO", "SPD", "ENCLOSURE"].includes(node.category);
const SINGLE_PHASES = ["L1", "L2", "L3"] as const;

/**
 * Hlavní vstupní prvek (kořen), když ho uživatel neurčil: odpínač / hlavní vypínač, jinak první
 * 3P/4P přístroj na 1. liště (např. -F1 S203-C25 nebo hlavní chránič), jinak první 3P/4P kdekoli,
 * jinak první prvek. Strom tak vždy má kořen a AI návrh nikdy neskončí s 0 zapojenými prvky.
 */
export function chooseRoot<T extends Pick<TreeNode, "id" | "category" | "poles" | "dinRailIndex" | "positionOnRail">>(nodes: readonly T[]): T | null {
  const ordered = readingOrder(nodes);
  const multiPole = (node: T) => node.category !== "SPD" && phaseCount(node.poles ?? "1P") === 3;
  const firstRail = ordered[0]?.dinRailIndex;
  return (
    ordered.find((node) => node.category === "MAIN_SWITCH") ??
    ordered.find((node) => node.dinRailIndex === firstRail && multiPole(node)) ??
    ordered.find(multiPole) ??
    ordered.find((node) => node.category !== "SPD") ??
    ordered[0] ??
    null
  );
}

/** Aktuální hlavní vstupní prvek (napájený z přívodu bez rodiče); při více kořenech první v pořadí lišt. */
export const currentRoot = <T extends Pick<TreeNode, "id" | "parentItemId" | "fedFromIncomer" | "dinRailIndex" | "positionOnRail">>(nodes: readonly T[]) =>
  readingOrder(nodes).find((node) => node.fedFromIncomer && !node.parentItemId) ?? null;

/**
 * Logický strom podle pozic na DIN lištách:
 * 1. Hlavní vstupní prvek je kořen (zvolený uživatelem, jinak `chooseRoot`), 3P/4P vede „L1,L2,L3,N“.
 * 2. Chrániče, jističochrániče a svodiče přepětí visí přímo pod -Q1; 4P / 3P+N chránič vede vždy
 *    „L1,L2,L3,N“, 2P chránič jednu fázi s N.
 * 3. Pravidlo DIN lišty: jistič napravo od chrániče na STEJNÉ liště patří pod tento (nejbližší) chránič.
 * 4. Jistič nalevo od chrániče nebo na liště hlavního vypínače → přímo pod -Q1.
 * 5. Jistič na liště bez chrániče: když je výše „samostatný“ chránič (na své liště nemá vpravo žádné
 *    vývody – typicky chránič na horní liště napájející lišty pod ním), patří pod něj; jinak pod -Q1.
 * 6. Jednofázové vývody se v každé skupině střídají L1 → L2 → L3 → L1 …; pod 2P chráničem dědí jeho fázi.
 */
/** Fáze 55: `supplyPhases: 1` = jednofázový přívod (1× 230 V) – všechny jednofázové okruhy na L1, bez rotace fází. */
export function proposeTree(nodes: readonly TreeNode[], rootId: string | null = null, options: { supplyPhases?: number } = {}): Map<string, Omit<TreeAssignment, "id" | "circuitLabel" | "designation">> {
  const singlePhase = options.supplyPhases === 1;
  const ordered = readingOrder(nodes);
  const result = new Map<string, Omit<TreeAssignment, "id" | "circuitLabel" | "designation">>();
  const main = (rootId ? ordered.find((node) => node.id === rootId) : null) ?? chooseRoot(ordered);
  const rcds = ordered.filter((node) => node.category === "RCD");
  const standalone = rcds.filter((rcd) => !ordered.some((node) => node.dinRailIndex === rcd.dinRailIndex && node.positionOnRail > rcd.positionOnRail && isFeeder(node)));
  const top = (node: TreeNode) => (main && node.id !== main.id ? { parentItemId: main.id, fedFromIncomer: false } : { parentItemId: null, fedFromIncomer: true });

  for (const node of ordered) {
    let link: { parentItemId: string | null; fedFromIncomer: boolean };
    if (node === main) link = { parentItemId: null, fedFromIncomer: true };
    else if (!isFeeder(node)) link = top(node);
    else {
      const sameRail = rcds.filter((rcd) => rcd.dinRailIndex === node.dinRailIndex && rcd.positionOnRail < node.positionOnRail);
      const onMainRail = !!main && main.dinRailIndex === node.dinRailIndex;
      const leftOfRcd = rcds.some((rcd) => rcd.dinRailIndex === node.dinRailIndex && rcd.positionOnRail > node.positionOnRail);
      const above = standalone.filter((rcd) => rcd.dinRailIndex < node.dinRailIndex);
      const rcd = sameRail[sameRail.length - 1] ?? (onMainRail || leftOfRcd ? undefined : above[above.length - 1]);
      link = rcd ? { parentItemId: rcd.id, fedFromIncomer: false } : top(node);
    }
    const fourWire = (node.category === "MAIN_SWITCH" || node.category === "RCD") && isThreePhase(node);
    result.set(node.id, { ...link, phaseAssignment: fourWire ? "L1,L2,L3,N" : isThreePhase(node) ? threePhaseAssignment(node) : null });
  }

  // Fáze jednofázových prvků: střídání L1 → L2 → L3 v rámci skupiny (stejný nadřazený prvek, pořadí čtení).
  const rotation = new Map<string, number>();
  for (const node of ordered) {
    const assignment = result.get(node.id)!;
    if (assignment.phaseAssignment || node.category === "SPD") continue;
    const parent = assignment.parentItemId ? result.get(assignment.parentItemId) : null;
    const parentPhases = parent?.phaseAssignment?.split(",").filter((phase) => phase !== "N") ?? [];
    if (parentPhases.length === 1) {
      assignment.phaseAssignment = parentPhases[0];
      continue;
    }
    const group = assignment.parentItemId ?? "__incomer__";
    const index = rotation.get(group) ?? 0;
    rotation.set(group, index + 1);
    const phase = singlePhase ? "L1" : SINGLE_PHASES[index % 3];
    // 2P chránič (L + N) dostane fázi s nulou, jednofázové vývody jen fázi
    assignment.phaseAssignment = node.category === "RCD" && hasNeutral(node) ? `${phase},N` : phase;
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Zapojování přímo na vektorovém rozváděči (fáze 42): kořen, drag & drop, „připojit vpravo“
// ---------------------------------------------------------------------------

/** Přístroje, které při přetažení na ně nenapájí, ale řadí přetažené jako sourozence (jističe, stykače …). */
const isLeafTarget = (node: Pick<TreeNode, "category">) => !node.category || ["MCB", "RCBO", "CONTACTOR", "RELAY", "PSU", "PLC", "TERMINAL", "OTHER"].includes(node.category);

/**
 * Fáze přímých potomků uzlu: jednofázové se v pořadí lišt střídají L1 → L2 → L3 (pod jednofázovým
 * rodičem dědí jeho fázi), 3P/4P vedou všechny fáze, 2P chránič fázi s N, SPD se do rotace nepočítá.
 */
export function rotatePhases(nodes: readonly TreeNode[], parentId: string | null): TreeNode[] {
  const parent = parentId ? nodes.find((node) => node.id === parentId) : null;
  const parentPhases = parent ? phasesOf(parent).filter((phase) => phase !== "N") : [];
  const children = readingOrder(nodes.filter((node) => (parentId ? node.parentItemId === parentId : node.fedFromIncomer && !node.parentItemId)));
  const phases = new Map<string, string | null>();
  let index = 0;
  for (const child of children) {
    // SPD bez vlastní fáze v rotaci; 3P/4P svodič vede všechny fáze (jako v AI návrhu)
    if (child.category === "SPD") phases.set(child.id, isThreePhase(child) ? threePhaseAssignment(child) : null);
    else if (isThreePhase(child)) phases.set(child.id, (child.category === "MAIN_SWITCH" || child.category === "RCD") ? "L1,L2,L3,N" : threePhaseAssignment(child));
    else {
      const phase = parentPhases.length === 1 ? parentPhases[0] : SINGLE_PHASES[index++ % 3];
      phases.set(child.id, child.category === "RCD" && hasNeutral(child) ? `${phase},N` : phase);
    }
  }
  return nodes.map((node) => (phases.has(node.id) ? { ...node, phaseAssignment: phases.get(node.id)! } : node));
}

/**
 * Určení hlavního vstupního prvku: kořen je napájen z přívodu; ostatní prvky, které visely přímo
 * na přívodu (včetně dosavadního kořene), přejdou pod nový kořen.
 */
export function setRoot(nodes: readonly TreeNode[], rootId: string): TreeNode[] {
  if (!nodes.some((node) => node.id === rootId)) return [...nodes];
  const next = nodes.map((node) => {
    if (node.id === rootId) return { ...node, parentItemId: null, fedFromIncomer: true, phaseAssignment: isThreePhase(node) ? (node.category === "MAIN_SWITCH" || node.category === "RCD" ? "L1,L2,L3,N" : threePhaseAssignment(node)) : node.phaseAssignment };
    if (node.fedFromIncomer && !node.parentItemId) return { ...node, parentItemId: rootId, fedFromIncomer: false };
    return node;
  });
  return rotatePhases(next, rootId);
}

export type DropResult = { ok: true; nodes: TreeNode[]; parentId: string } | { ok: false; error: string };

/**
 * Drag & drop: přetažené prvky se zapojí pod cílový přístroj, ze kterého jsou napájeny.
 * - Cíl = hlavní prvek, chránič, odpínač nebo přepěťovka → přetažené visí přímo pod ním
 *   (chránič na přepěťovce = průchozí napájecí uzel v hlavní větvi).
 * - Cíl = jistič (nebo jiný koncový přístroj) pod skupinou → přetažené se zařadí VEDLE něj jako
 *   sourozenci pod jeho rodiče, nikdy do série.
 * Jednofázové přístroje ve skupině dostanou střídavě L1, L2, L3. Cyklus odmítne.
 */
export function dropOnto(nodes: readonly TreeNode[], sourceIds: readonly string[], targetId: string): DropResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const target = byId.get(targetId);
  if (!target) return { ok: false, error: "Cílový přístroj neexistuje." };
  const sources = sourceIds.filter((id) => id !== targetId && byId.has(id));
  if (!sources.length) return { ok: false, error: "Prvek nemůže napájet sám sebe." };
  return assignParent(nodes, sources, dropParent(target));
}

/** Skutečný napájecí prvek po přetažení na cíl (koncový přístroj pod skupinou → jeho rodič). */
export function dropParent(target: Pick<TreeNode, "id" | "category" | "parentItemId" | "fedFromIncomer">): string {
  const isRoot = target.fedFromIncomer && !target.parentItemId;
  return isLeafTarget(target) && !isRoot && target.parentItemId ? target.parentItemId : target.id;
}

/** Přesné zapojení prvků pod zvolený napájecí prvek (roletka „Napájeno z“) se střídáním fází. */
export function assignParent(nodes: readonly TreeNode[], sourceIds: readonly string[], parentId: string): DropResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!byId.has(parentId)) return { ok: false, error: "Napájecí přístroj neexistuje." };
  const sources = sourceIds.filter((id) => byId.has(id));
  if (!sources.length || sources.includes(parentId)) return { ok: false, error: "Prvek nemůže napájet sám sebe." };
  const root = currentRoot(nodes);
  if (root && sources.includes(root.id)) return { ok: false, error: `${root.designation} je hlavní vstupní prvek napájený z přívodu – jiný kořen určíte tlačítkem „🎯 Určit hlavní vstupní prvek“.` };
  const chain = ancestors(parentId, byId) ?? [];
  const looped = sources.find((id) => chain.includes(id));
  if (looped) return { ok: false, error: `${byId.get(looped)!.designation} napájí ${byId.get(parentId)!.designation} – zapojení by vytvořilo cyklus.` };
  const moved = nodes.map((node) => (sources.includes(node.id) ? { ...node, parentItemId: parentId, fedFromIncomer: false } : node));
  return { ok: true, nodes: rotatePhases(moved, parentId), parentId };
}

/** „🔗 Připojit jističe vpravo na této liště“: vývody napravo od chrániče až po další chránič / odpínač. */
export function connectRightOf(nodes: readonly TreeNode[], headId: string): { nodes: TreeNode[]; count: number } {
  const head = nodes.find((node) => node.id === headId);
  if (!head) return { nodes: [...nodes], count: 0 };
  const rail = readingOrder(nodes.filter((node) => node.dinRailIndex === head.dinRailIndex && node.positionOnRail > head.positionOnRail));
  const stop = rail.findIndex((node) => node.category === "RCD" || node.category === "MAIN_SWITCH");
  const feeders = (stop < 0 ? rail : rail.slice(0, stop)).filter((node) => isFeeder(node) && !(node.fedFromIncomer && !node.parentItemId)).map((node) => node.id);
  if (!feeders.length) return { nodes: [...nodes], count: 0 };
  const result = dropOnto(nodes, feeders, headId);
  return result.ok ? { nodes: result.nodes, count: feeders.length } : { nodes: [...nodes], count: 0 };
}

// ---------------------------------------------------------------------------
//  Elektrotechnický hlídač
// ---------------------------------------------------------------------------

export type IssueSeverity = "error" | "warning" | "info";
export interface TreeIssue {
  itemId: string;
  severity: IssueSeverity;
  message: string;
}

const fmt = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** Rodiče nad uzlem; při cyklu vrací null. */
export function ancestors(nodeId: string, byId: ReadonlyMap<string, Pick<TreeNode, "id" | "parentItemId">>): string[] | null {
  const chain: string[] = [];
  let current = byId.get(nodeId)?.parentItemId ?? null;
  while (current) {
    if (current === nodeId || chain.includes(current)) return null;
    chain.push(current);
    current = byId.get(current)?.parentItemId ?? null;
  }
  return chain;
}

/** Proud na fázích pod uzlem (Ib × soudobost; jen koncové vývody, ať se nepočítá dvakrát). */
export function subtreeLoad(nodeId: string, nodes: readonly TreeNode[], simultaneity: number, visited: Set<string> = new Set()): Record<"L1" | "L2" | "L3", number> {
  const load = { L1: 0, L2: 0, L3: 0 };
  if (visited.has(nodeId)) return load; // cyklus – hlásí ho validateTree
  visited.add(nodeId);
  const children = nodes.filter((node) => node.parentItemId === nodeId);
  if (!children.length) return load;
  for (const child of children) {
    const grandchildren = nodes.some((node) => node.parentItemId === child.id);
    if (grandchildren) {
      const sub = subtreeLoad(child.id, nodes, simultaneity, visited);
      load.L1 += sub.L1;
      load.L2 += sub.L2;
      load.L3 += sub.L3;
      continue;
    }
    if (child.category === "SPD") continue;
    for (const phase of phasesOf(child)) if (phase in load) load[phase as keyof typeof load] += designCurrent(child) * simultaneity;
  }
  return load;
}

/**
 * Živý hlídač: chyby = nezapojený prvek, cyklus, 3P přístroj pod jednofázovým uzlem; varování = fáze
 * mimo nadřazený uzel, vývod pod SPD, chybějící fáze; informace = selektivita jističů.
 */
export function validateTree(nodes: readonly TreeNode[]): TreeIssue[] {
  const issues: TreeIssue[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const parent = node.parentItemId ? byId.get(node.parentItemId) : null;
    if (!parent && !node.fedFromIncomer) {
      issues.push({ itemId: node.id, severity: "error", message: `${node.designation} není zapojen – vyberte skupinu, ze které je napájen.` });
      continue;
    }
    if (ancestors(node.id, byId) === null) {
      issues.push({ itemId: node.id, severity: "error", message: `${node.designation} je v cyklu – prvek nemůže napájet sám sebe.` });
      continue;
    }
    if (node.category !== "SPD" && node.category !== "RCD" && node.category !== "MAIN_SWITCH" && !phasesOf(node).length) {
      issues.push({ itemId: node.id, severity: "warning", message: `${node.designation}: chybí přiřazení fáze (L1 / L2 / L3).` });
    }
    if (!parent) continue;
    // Chránič za přepěťovkou = průchozí napájecí uzel v hlavní větvi (fáze 42), jen koncové vývody se hlásí
    if (parent.category === "SPD" && isFeeder(node)) {
      issues.push({ itemId: node.id, severity: "warning", message: `${node.designation} je zapojen pod přepěťovou ochranu ${parent.designation} – SPD nenapájí vývody.` });
    }
    const parentPhases = phasesOf(parent);
    if (isThreePhase(node) && parentPhases.length && parentPhases.length < 3) {
      issues.push({ itemId: node.id, severity: "error", message: `${node.poles} přístroj ${node.designation} nemůže být napájen z jednofázového uzlu ${parent.designation} (${parentPhases.join(", ")}).` });
    } else if (parentPhases.length) {
      const missing = phasesOf(node).filter((phase) => !parentPhases.includes(phase));
      if (missing.length) issues.push({ itemId: node.id, severity: "warning", message: `${node.designation} je na fázi ${missing.join(", ")}, ale nadřazený ${parent.designation} vede jen ${parentPhases.join(", ")}.` });
    }
    if (node.category === "MCB" && parent.category === "MCB" && node.ratedCurrentA && parent.ratedCurrentA && node.ratedCurrentA >= parent.ratedCurrentA) {
      issues.push({ itemId: node.id, severity: "info", message: `${node.designation} (${fmt(node.ratedCurrentA)} A) není selektivní vůči nadřazenému ${parent.designation} (${fmt(parent.ratedCurrentA)} A).` });
    }
  }
  // Součet In jističů běžně převyšuje In hlavního vypínače i chrániče (soudobost) – to není chyba.
  // Zatížení skupiny se zobrazuje jen jako informace (groupLoad); chybou zůstává nezapojený prvek,
  // cyklus a 3P přístroj pod jednofázovým uzlem.
  return issues;
}

/** Zatížení skupiny (Ib × soudobost po fázích) – informace v kartě skupiny, ne chyba. */
export function groupLoad(nodeId: string, nodes: readonly TreeNode[], simultaneity: number) {
  const load = subtreeLoad(nodeId, nodes, simultaneity);
  return { ...load, max: Math.max(load.L1, load.L2, load.L3) };
}

/** Automatické přečíslování IEC značení v pořadí čtení (-Q1, -FI1, -F1 …). */
export function renumber(nodes: readonly Pick<TreeNode, "id" | "category" | "dinRailIndex" | "positionOnRail">[]): Map<string, string> {
  const ordered = readingOrder(nodes);
  const designations = designationsInOrder(ordered.map((node) => node.category));
  return new Map(ordered.map((node, index) => [node.id, designations[index]]));
}

/** Uzly ve stromu do hloubky (pro vykreslení); nezapojené a cykly na konci jako „volné“. */
export function flattenTree<T extends Pick<TreeNode, "id" | "parentItemId" | "fedFromIncomer" | "dinRailIndex" | "positionOnRail">>(nodes: readonly T[]): { node: T; depth: number }[] {
  const ordered = readingOrder(nodes);
  const out: { node: T; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (node: T, depth: number) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push({ node, depth });
    for (const child of ordered.filter((candidate) => candidate.parentItemId === node.id)) visit(child, depth + 1);
  };
  for (const root of ordered.filter((node) => node.fedFromIncomer && !node.parentItemId)) visit(root, 1);
  return out;
}

/** Je uzel (nepřímo) napájen ze vstupu? */
export function isConnected(nodeId: string, byId: ReadonlyMap<string, Pick<TreeNode, "id" | "parentItemId" | "fedFromIncomer">>): boolean {
  const chain = ancestors(nodeId, byId);
  if (chain === null) return false;
  const top = byId.get(chain[chain.length - 1] ?? nodeId);
  return Boolean(top && !top.parentItemId && top.fedFromIncomer);
}

/** Řádek prvku z databáze (s katalogovým kusem) → uzel stromu. */
export function treeNodeFrom(item: {
  id: string;
  designation: string;
  circuitLabel: string;
  dinRailIndex: number;
  positionOnRail: number;
  parentItemId: string | null;
  fedFromIncomer: boolean;
  phaseAssignment: string | null;
  operatingCurrentA: number | null;
  catalogComponent: { category: ComponentCategory; poles: string; ratedCurrentA: number } | null;
}): TreeNode {
  return {
    id: item.id,
    designation: item.designation,
    circuitLabel: item.circuitLabel,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    category: item.catalogComponent?.category ?? null,
    poles: item.catalogComponent?.poles ?? null,
    ratedCurrentA: item.catalogComponent?.ratedCurrentA || null,
    operatingCurrentA: item.operatingCurrentA,
    parentItemId: item.parentItemId,
    fedFromIncomer: item.fedFromIncomer,
    phaseAssignment: item.phaseAssignment,
  };
}
