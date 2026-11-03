import { describe, expect, it } from "vitest";

import { REFERENCE_DEVICES, withPositions } from "./reference";
import { assignParent, chooseRoot, connectRightOf, currentRoot, dropOnto, flattenTree, groupLoad, isConnected, proposeTree, renumber, setRoot, validateTree, type TreeNode } from "./tree";

const NODES: TreeNode[] = withPositions(REFERENCE_DEVICES).map((device) => ({
  id: device.designation,
  designation: device.designation,
  circuitLabel: device.label,
  dinRailIndex: device.dinRailIndex,
  positionOnRail: device.positionOnRail,
  category: device.category,
  poles: device.poles,
  ratedCurrentA: device.ratedCurrentA,
  operatingCurrentA: null,
  parentItemId: null,
  fedFromIncomer: false,
  phaseAssignment: null,
}));

const proposed = (): TreeNode[] => {
  const tree = proposeTree(NODES);
  return NODES.map((node) => ({ ...node, ...tree.get(node.id)! }));
};

describe("AI návrh stromu", () => {
  it("referenční rozváděč: vstup → -Q1 → -FV1 SPD a -FI1 RCD → -F1 až -F10, fáze jako v 1P schématu", () => {
    const nodes = proposed();
    const by = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(by["-Q1"]).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1,L2,L3,N" });
    // Chránič -FI1 na liště 1 nemá vpravo žádné vývody → „samostatný“ chránič napájí jističe lišt 2 a 3
    expect(by["-FV1"]).toMatchObject({ parentItemId: "-Q1", phaseAssignment: "L1,L2,L3,N" });
    expect(by["-FI1"]).toMatchObject({ parentItemId: "-Q1", phaseAssignment: "L1,L2,L3,N" });
    for (const id of ["-F1", "-F2", "-F3", "-F10"]) expect(by[id].parentItemId).toBe("-FI1");
    expect(by["-F1"].phaseAssignment).toBe("L1,L2,L3");
    expect(["-F3", "-F4", "-F5", "-F6", "-F7", "-F8", "-F9", "-F10"].map((id) => by[id].phaseAssignment)).toEqual(["L1", "L2", "L3", "L1", "L2", "L3", "L1", "L2"]);
    expect(validateTree(nodes)).toEqual([]);
    expect(flattenTree(nodes).map(({ node, depth }) => `${node.id}@${depth}`).slice(0, 4)).toEqual(["-Q1@1", "-FV1@2", "-FI1@2", "-F1@3"]);
    expect(isConnected("-F10", new Map(nodes.map((node) => [node.id, node])))).toBe(true);
  });

  it("jističe pod nejbližší předchozí chránič; bez vypínače i chráničů rovnou ze vstupu", () => {
    const two = [
      { ...NODES[2], id: "rcd1", designation: "-FV1", dinRailIndex: 1, positionOnRail: 1 },
      { ...NODES[5], id: "a", dinRailIndex: 1, positionOnRail: 2 },
      { ...NODES[2], id: "rcd2", designation: "-F1", dinRailIndex: 2, positionOnRail: 1 },
      { ...NODES[5], id: "b", dinRailIndex: 2, positionOnRail: 2 },
    ];
    const tree = proposeTree(two);
    expect(tree.get("a")?.parentItemId).toBe("rcd1");
    expect(tree.get("b")?.parentItemId).toBe("rcd2");
    expect(tree.get("rcd1")).toMatchObject({ parentItemId: null, fedFromIncomer: true });
    expect(proposeTree([NODES[5]]).get("-F3")).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1" });
    // nerozpoznaný přístroj (bez proudu) nerozhodí rotaci fází
    const unknown = NODES.map((node) => (node.id === "-F4" ? { ...node, category: null, poles: null, ratedCurrentA: null } : node));
    const phases = proposeTree(unknown);
    expect(["-F3", "-F4", "-F5", "-F6"].map((id) => phases.get(id)?.phaseAssignment)).toEqual(["L1", "L2", "L3", "L1"]);
  });
});

describe("pravidlo DIN lišty (reálná fotka PB-004)", () => {
  const node = (id: string, rail: number, position: number, category: TreeNode["category"], poles: string, current: number): TreeNode => ({
    id,
    designation: id,
    circuitLabel: "",
    dinRailIndex: rail,
    positionOnRail: position,
    category,
    poles,
    ratedCurrentA: current,
    operatingCurrentA: null,
    parentItemId: null,
    fedFromIncomer: false,
    phaseAssignment: null,
  });
  // Lišta 1: odpínač, 3P jistič, jističochránič · lišta 2: chránič 4P + 3 jističe · lišta 3: jistič vlevo, chránič, 2 jističe
  const PB004 = [
    node("-Q1", 1, 1, "MAIN_SWITCH", "3P", 25),
    node("-F1", 1, 2, "MCB", "3P", 16),
    node("-FA1", 1, 3, "RCBO", "1P+N", 16),
    node("-FI1", 2, 1, "RCD", "4P", 40),
    node("-F2", 2, 2, "MCB", "1P", 10),
    node("-F3", 2, 3, "MCB", "1P", 13),
    node("-F4", 2, 4, "MCB", "1P", 16),
    node("-F5", 3, 1, "MCB", "1P", 16),
    node("-FI2", 3, 2, "RCD", "4P", 40),
    node("-F6", 3, 3, "MCB", "1P", 16),
    node("-F7", 3, 4, "MCB", "1P", 16),
  ];

  it("chránič napájí jističe napravo na své liště, ostatní přímo pod -Q1; chrániče 4P vedou L1,L2,L3,N", () => {
    const tree = proposeTree(PB004);
    const parent = (id: string) => tree.get(id)?.parentItemId;
    expect(tree.get("-Q1")).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1,L2,L3,N" });
    expect(["-F1", "-FA1", "-FI1", "-FI2", "-F5"].map(parent)).toEqual(["-Q1", "-Q1", "-Q1", "-Q1", "-Q1"]);
    expect(["-F2", "-F3", "-F4"].map(parent)).toEqual(["-FI1", "-FI1", "-FI1"]);
    expect(["-F6", "-F7"].map(parent)).toEqual(["-FI2", "-FI2"]);
    expect(tree.get("-FI1")?.phaseAssignment).toBe("L1,L2,L3,N");
    expect(tree.get("-FI2")?.phaseAssignment).toBe("L1,L2,L3,N");
    // střídání fází ve skupině chrániče -FI1
    expect(["-F2", "-F3", "-F4"].map((id) => tree.get(id)?.phaseAssignment)).toEqual(["L1", "L2", "L3"]);
    const nodes = PB004.map((entry) => ({ ...entry, ...tree.get(entry.id)! }));
    expect(validateTree(nodes).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("2P chránič vede jednu fázi s N a jeho jističe ji dědí", () => {
    const tree = proposeTree([node("-Q1", 1, 1, "MAIN_SWITCH", "3P", 40), node("-FI1", 2, 1, "RCD", "2P", 25), node("-F1", 2, 2, "MCB", "1P", 10), node("-F2", 2, 3, "MCB", "1P", 16)]);
    expect(tree.get("-FI1")?.phaseAssignment).toBe("L1,N");
    expect(["-F1", "-F2"].map((id) => tree.get(id)?.phaseAssignment)).toEqual(["L1", "L1"]);
  });
});

describe("elektrotechnický hlídač", () => {
  const issuesFor = (nodes: TreeNode[], id: string) => validateTree(nodes).filter((issue) => issue.itemId === id);

  it("3P pod 1P uzlem, fáze mimo rodiče, vývod pod SPD, nezapojený prvek a cyklus", () => {
    const nodes = proposed();
    const edit = (id: string, patch: Partial<TreeNode>) => nodes.map((node) => (node.id === id ? { ...node, ...patch } : node));
    expect(issuesFor(edit("-F1", { parentItemId: "-F3" }), "-F1")[0].message).toContain("3P přístroj -F1 nemůže být napájen z jednofázového uzlu -F3");
    expect(issuesFor(edit("-F4", { parentItemId: "-F3" }), "-F4").map((issue) => issue.message)).toEqual([
      "-F4 je na fázi L2, ale nadřazený -F3 vede jen L1.",
      "-F4 (10 A) není selektivní vůči nadřazenému -F3 (10 A).",
    ]);
    expect(issuesFor(edit("-F5", { parentItemId: "-FV1" }), "-F5")[0]).toMatchObject({ severity: "warning", message: expect.stringContaining("pod přepěťovou ochranu -FV1") });
    // Červená chyba jen pro nezapojený prvek, cyklus a 3P pod 1P uzlem
    expect(issuesFor(edit("-F6", { parentItemId: null, fedFromIncomer: false }), "-F6")[0]).toMatchObject({ severity: "error", message: "-F6 není zapojen – vyberte skupinu, ze které je napájen." });
    expect(issuesFor(edit("-F1", { parentItemId: "-F3" }), "-F1")[0].severity).toBe("error");
    const cycle = edit("-Q1", { parentItemId: "-FI1", fedFromIncomer: false });
    expect(issuesFor(cycle, "-Q1")[0].message).toContain("cyklu");
  });

  it("součet In jističů nad In chrániče / vypínače není chyba – zatížení skupiny je jen informace (Ib × SF)", () => {
    const nodes = proposed().map((node) => (node.id === "-FI1" ? { ...node, ratedCurrentA: 25 } : node));
    expect(issuesFor(nodes, "-FI1")).toEqual([]);
    expect(validateTree(proposed()).filter((issue) => issue.itemId === "-Q1")).toEqual([]);
    expect(groupLoad("-FI1", nodes, 0.5)).toMatchObject({ L1: 37, max: 37 });
    expect(groupLoad("-Q1", proposed(), 1).L1).toBe(74);
  });

  it("přečíslování IEC značení v pořadí čtení", () => {
    const shuffled = NODES.map((node, index) => ({ ...node, id: `x${index}` }));
    expect([...renumber(shuffled).values()].slice(0, 4)).toEqual(["-Q1", "-FV1", "-FI1", "-F1"]);
  });
});

describe("zapojování na vektorovém rozváděči (fáze 42)", () => {
  const node = (id: string, rail: number, position: number, category: TreeNode["category"], poles: string, current: number): TreeNode => ({
    id,
    designation: id,
    circuitLabel: "",
    dinRailIndex: rail,
    positionOnRail: position,
    category,
    poles,
    ratedCurrentA: current,
    operatingCurrentA: null,
    parentItemId: null,
    fedFromIncomer: false,
    phaseAssignment: null,
  });
  // Rozváděč BEZ odpínače: 3P jistič -F1 na 1. liště je hlavní vstupní prvek
  const NO_Q1 = [
    node("-FV1", 1, 1, "SPD", "3P+N", 0),
    node("-F1", 1, 2, "MCB", "3P", 25),
    node("-FI1", 1, 3, "RCD", "4P", 40),
    node("-F2", 2, 1, "MCB", "1P", 10),
    node("-F3", 2, 2, "MCB", "1P", 16),
    node("-F4", 2, 3, "MCB", "1P", 16),
    node("-F5", 2, 4, "MCB", "1P", 16),
  ];
  const connectedCount = (nodes: TreeNode[]) => nodes.filter((entry) => isConnected(entry.id, new Map(nodes.map((n) => [n.id, n])))).length;
  const apply = (nodes: TreeNode[], tree: ReturnType<typeof proposeTree>) => nodes.map((entry) => ({ ...entry, ...tree.get(entry.id)! }));

  it("bez -Q1 vezme AI návrh první 3P přístroj na 1. liště (SPD ne) a zapojí 100 % prvků", () => {
    expect(chooseRoot(NO_Q1)?.id).toBe("-F1");
    const nodes = apply(NO_Q1, proposeTree(NO_Q1));
    expect(connectedCount(nodes)).toBe(NO_Q1.length);
    expect(currentRoot(nodes)?.id).toBe("-F1");
    expect(nodes.find((entry) => entry.id === "-FV1")?.parentItemId).toBe("-F1");
    expect(["-F2", "-F3", "-F4", "-F5"].map((id) => nodes.find((entry) => entry.id === id)?.parentItemId)).toEqual(["-FI1", "-FI1", "-FI1", "-FI1"]);
    expect(validateTree(nodes).filter((issue) => issue.severity === "error")).toEqual([]);
    // Uživatelem zvolený kořen má v AI návrhu přednost
    expect(currentRoot(apply(NO_Q1, proposeTree(NO_Q1, "-FI1")))?.id).toBe("-FI1");
    // Starý strom se 37 nezapojenými prvky (žádný kořen, žádný odpínač) → návrh vždy zapojí vše
    const loose = Array.from({ length: 37 }, (_, index) => node(`-F${index + 1}`, Math.floor(index / 12) + 1, (index % 12) + 1, "MCB", index === 0 ? "3P" : "1P", 16));
    expect(connectedCount(apply(loose, proposeTree(loose)))).toBe(37);
  });

  it("hlavním vstupním prvkem může být cokoli: setRoot přepojí ostatní kořeny pod nový", () => {
    const base = apply(NO_Q1, proposeTree(NO_Q1));
    const nodes = setRoot(base, "-FI1");
    const by = Object.fromEntries(nodes.map((entry) => [entry.id, entry]));
    expect(by["-FI1"]).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1,L2,L3,N" });
    expect(by["-F1"]).toMatchObject({ parentItemId: "-FI1", fedFromIncomer: false });
    expect(currentRoot(nodes)?.id).toBe("-FI1");
    expect(connectedCount(nodes)).toBe(NO_Q1.length);
  });

  it("drag & drop: SPD a chránič na hlavní prvek, chránič na přepěťovku = průchozí uzel, jističe paralelně se střídáním L1/L2/L3", () => {
    let nodes = setRoot(NO_Q1, "-F1");
    const step = (sources: string[], target: string) => {
      const result = dropOnto(nodes, sources, target);
      if (!result.ok) throw new Error(result.error);
      nodes = result.nodes;
      return result.parentId;
    };
    const by = () => Object.fromEntries(nodes.map((entry) => [entry.id, entry]));
    expect(step(["-FV1"], "-F1")).toBe("-F1");
    // chránič na přepěťovku → průchozí napájecí uzel v hlavní větvi, bez varování
    expect(step(["-FI1"], "-FV1")).toBe("-FV1");
    expect(validateTree(nodes).filter((issue) => issue.itemId === "-FI1")).toEqual([]);
    // jističe na chránič → sourozenci pod -FI1
    step(["-F2", "-F3"], "-FI1");
    // jistič přetažený na jiný jistič pod chráničem → vedle něj (pod -FI1), nikdy do série
    expect(step(["-F4"], "-F2")).toBe("-FI1");
    expect(step(["-F5"], "-F3")).toBe("-FI1");
    expect(["-F2", "-F3", "-F4", "-F5"].map((id) => by()[id].parentItemId)).toEqual(["-FI1", "-FI1", "-FI1", "-FI1"]);
    expect(["-F2", "-F3", "-F4", "-F5"].map((id) => by()[id].phaseAssignment)).toEqual(["L1", "L2", "L3", "L1"]);
    expect(connectedCount(nodes)).toBe(NO_Q1.length);
    expect(validateTree(nodes).filter((issue) => issue.severity !== "info")).toEqual([]);
  });

  it("drag & drop odmítne cyklus, přetažení na sebe a přesun hlavního vstupního prvku", () => {
    const nodes = apply(NO_Q1, proposeTree(NO_Q1));
    expect(dropOnto(nodes, ["-FI1"], "-FI1")).toMatchObject({ ok: false });
    // jistič pod chráničem → „vedle něj“ = pod chráničem samotným → nemůže napájet sám sebe
    expect(dropOnto(nodes, ["-FI1"], "-F2")).toMatchObject({ ok: false, error: "Prvek nemůže napájet sám sebe." });
    const chain = assignParent(nodes, ["-FI1"], "-FV1") as { nodes: TreeNode[] };
    expect(dropOnto(chain.nodes, ["-FV1"], "-F2")).toMatchObject({ ok: false, error: expect.stringContaining("cyklus") });
    expect(dropOnto(nodes, ["-F1"], "-FI1")).toMatchObject({ ok: false, error: expect.stringContaining("hlavní vstupní prvek") });
    expect(assignParent(nodes, ["-F2"], "-F1")).toMatchObject({ ok: true, parentId: "-F1" });
  });

  it("„Připojit jističe vpravo“ naváže vývody napravo od chrániče až po další chránič", () => {
    const rail = [
      node("-Q1", 1, 1, "MAIN_SWITCH", "3P", 40),
      node("-FI1", 2, 1, "RCD", "4P", 40),
      node("-F1", 2, 2, "MCB", "1P", 10),
      node("-F2", 2, 3, "MCB", "1P", 16),
      node("-FI2", 2, 4, "RCD", "2P", 25),
      node("-F3", 2, 5, "MCB", "1P", 16),
    ];
    const rooted = setRoot(rail, "-Q1");
    const { nodes, count } = connectRightOf(rooted, "-FI1");
    expect(count).toBe(2);
    expect(["-F1", "-F2", "-F3"].map((id) => nodes.find((entry) => entry.id === id)?.parentItemId)).toEqual(["-FI1", "-FI1", null]);
    expect(["-F1", "-F2"].map((id) => nodes.find((entry) => entry.id === id)?.phaseAssignment)).toEqual(["L1", "L2"]);
    // 2P chránič: jističe dědí jeho jedinou fázi
    const second = connectRightOf(assignParent(nodes, ["-FI2"], "-Q1").ok ? (assignParent(nodes, ["-FI2"], "-Q1") as { nodes: TreeNode[] }).nodes : nodes, "-FI2");
    const fi2 = second.nodes.find((entry) => entry.id === "-FI2")!;
    expect(second.nodes.find((entry) => entry.id === "-F3")?.phaseAssignment).toBe(fi2.phaseAssignment?.split(",")[0]);
    expect(connectRightOf(rooted, "-F3").count).toBe(0);
  });
});
