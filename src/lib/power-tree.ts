import type { EquipmentType } from "@/generated/prisma/enums";

// Strom napájení (relace `fedFrom` / `feeds`) pro LOTO kartu: kde zařízení bezpečně vypnout
// a co zůstane bez proudu. Čisté funkce nad plochým seznamem uzlů; cykly v datech neuváznou.

export interface PowerNode {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  fedFromEquipmentId: string | null;
  fedFromCircuit: string | null;
}

export interface UpstreamStep {
  node: PowerNode;
  /** Vývod v tomto uzlu, ze kterého je napájen další článek řetězce. */
  circuit: string | null;
}

/**
 * Řetězec napájení od zdroje k přímému nadřazenému rozváděči, např.
 * TR1 (Vývod nn / Q0) › RM1 (Pole 2 / QF2). Vypíná se poslední článek.
 */
export function upstreamChain(id: string, nodes: readonly PowerNode[]): UpstreamStep[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: UpstreamStep[] = [];
  const seen = new Set([id]);
  let current = byId.get(id);
  while (current?.fedFromEquipmentId && !seen.has(current.fedFromEquipmentId)) {
    const parent = byId.get(current.fedFromEquipmentId);
    if (!parent) break;
    chain.unshift({ node: parent, circuit: current.fedFromCircuit });
    seen.add(parent.id);
    current = parent;
  }
  return chain;
}

export interface DownstreamEntry {
  node: PowerNode;
  depth: number;
}

/** Všechna zařízení, která zůstanou bez proudu po vypnutí uzlu (do hloubky, podle vývodů). */
export function downstreamTree(id: string, nodes: readonly PowerNode[]): DownstreamEntry[] {
  const children = new Map<string, PowerNode[]>();
  for (const node of nodes) {
    if (!node.fedFromEquipmentId) continue;
    children.set(node.fedFromEquipmentId, [...(children.get(node.fedFromEquipmentId) ?? []), node]);
  }
  const out: DownstreamEntry[] = [];
  const seen = new Set([id]);
  const visit = (parentId: string, depth: number) => {
    const list = [...(children.get(parentId) ?? [])].sort(
      (a, b) => (a.fedFromCircuit ?? "").localeCompare(b.fedFromCircuit ?? "", "cs") || a.tag.localeCompare(b.tag, "cs"),
    );
    for (const child of list) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push({ node: child, depth });
      visit(child.id, depth + 1);
    }
  };
  visit(id, 1);
  return out;
}

// ---------------------------------------------------------------------------
//  Pavouk napájení na půdorysu patra
// ---------------------------------------------------------------------------

export interface SpiderItem {
  id: string;
  tag: string;
  pinX: number;
  pinY: number;
  fedFromEquipmentId: string | null;
  fedFromCircuit: string | null;
  fedFrom: { id: string; tag: string } | null;
}

export type SpiderLink =
  | { kind: "local"; from: SpiderItem; to: SpiderItem; circuit: string | null }
  /** Napájení z rozváděče mimo zobrazená zařízení patra (jiné patro / skrytá vrstva). */
  | { kind: "remote"; to: SpiderItem; sourceTag: string; circuit: string | null };

/** Spojnice nadřazený rozváděč → napájené zařízení mezi zobrazenými piny patra. */
export function spiderLinks(items: readonly SpiderItem[]): SpiderLink[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const links: SpiderLink[] = [];
  for (const item of items) {
    if (!item.fedFromEquipmentId) continue;
    const parent = byId.get(item.fedFromEquipmentId);
    if (parent) links.push({ kind: "local", from: parent, to: item, circuit: item.fedFromCircuit });
    else links.push({ kind: "remote", to: item, sourceTag: item.fedFrom?.tag ?? "?", circuit: item.fedFromCircuit });
  }
  return links;
}
