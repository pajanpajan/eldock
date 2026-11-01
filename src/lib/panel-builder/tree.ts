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
 * Logický strom podle pozic na DIN lištách:
 * 1. Hlavní vypínač (-Q1) je kořen (vstup napájení), 3P/4P vede „L1,L2,L3,N“.
 * 2. Chrániče, jističochrániče a svodiče přepětí visí přímo pod -Q1; 4P / 3P+N chránič vede vždy
 *    „L1,L2,L3,N“, 2P chránič jednu fázi s N.
 * 3. Pravidlo DIN lišty: jistič napravo od chrániče na STEJNÉ liště patří pod tento (nejbližší) chránič.
 * 4. Jistič nalevo od chrániče nebo na liště hlavního vypínače → přímo pod -Q1.
 * 5. Jistič na liště bez chrániče: když je výše „samostatný“ chránič (na své liště nemá vpravo žádné
 *    vývody – typicky chránič na horní liště napájející lišty pod ním), patří pod něj; jinak pod -Q1.
 * 6. Jednofázové vývody se v každé skupině střídají L1 → L2 → L3 → L1 …; pod 2P chráničem dědí jeho fázi.
 */
export function proposeTree(nodes: readonly TreeNode[]): Map<string, Omit<TreeAssignment, "id" | "circuitLabel" | "designation">> {
  const ordered = readingOrder(nodes);
  const result = new Map<string, Omit<TreeAssignment, "id" | "circuitLabel" | "designation">>();
  const main = ordered.find((node) => node.category === "MAIN_SWITCH") ?? null;
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
    const phase = SINGLE_PHASES[index % 3];
    // 2P chránič (L + N) dostane fázi s nulou, jednofázové vývody jen fázi
    assignment.phaseAssignment = node.category === "RCD" && hasNeutral(node) ? `${phase},N` : phase;
  }
  return result;
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
    if (parent.category === "SPD") {
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
