import { describe, expect, it } from "vitest";

import { REFERENCE_DEVICES, withPositions } from "./reference";
import { flattenTree, isConnected, proposeTree, renumber, validateTree, type TreeNode } from "./tree";

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
  it("referenční rozváděč: vstup → -Q1 → -F1 SPD a -F2 RCD → -F3 až -F12, fáze jako v 1P schématu", () => {
    const nodes = proposed();
    const by = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(by["-Q1"]).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1,L2,L3" });
    expect(by["-F1"]).toMatchObject({ parentItemId: "-Q1", phaseAssignment: "L1,L2,L3,N" });
    expect(by["-F2"]).toMatchObject({ parentItemId: "-Q1", phaseAssignment: "L1,L2,L3,N" });
    for (const id of ["-F3", "-F4", "-F5", "-F12"]) expect(by[id].parentItemId).toBe("-F2");
    expect(by["-F3"].phaseAssignment).toBe("L1,L2,L3");
    expect(["-F5", "-F6", "-F7", "-F8", "-F9", "-F10", "-F11", "-F12"].map((id) => by[id].phaseAssignment)).toEqual(["L1", "L2", "L3", "L1", "L2", "L3", "L1", "L2"]);
    expect(validateTree(nodes, 0.5)).toEqual([]);
    expect(flattenTree(nodes).map(({ node, depth }) => `${node.id}@${depth}`).slice(0, 4)).toEqual(["-Q1@1", "-F1@2", "-F2@2", "-F3@3"]);
    expect(isConnected("-F12", new Map(nodes.map((node) => [node.id, node])))).toBe(true);
  });

  it("jističe pod nejbližší předchozí chránič; bez vypínače i chráničů rovnou ze vstupu", () => {
    const two = [
      { ...NODES[2], id: "rcd1", designation: "-F1", dinRailIndex: 1, positionOnRail: 1 },
      { ...NODES[5], id: "a", dinRailIndex: 1, positionOnRail: 2 },
      { ...NODES[2], id: "rcd2", designation: "-F3", dinRailIndex: 2, positionOnRail: 1 },
      { ...NODES[5], id: "b", dinRailIndex: 2, positionOnRail: 2 },
    ];
    const tree = proposeTree(two);
    expect(tree.get("a")?.parentItemId).toBe("rcd1");
    expect(tree.get("b")?.parentItemId).toBe("rcd2");
    expect(tree.get("rcd1")).toMatchObject({ parentItemId: null, fedFromIncomer: true });
    expect(proposeTree([NODES[5]]).get("-F5")).toMatchObject({ parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1" });
    // nerozpoznaný přístroj (bez proudu) nerozhodí rotaci fází
    const unknown = NODES.map((node) => (node.id === "-F6" ? { ...node, category: null, poles: null, ratedCurrentA: null } : node));
    const phases = proposeTree(unknown);
    expect(["-F5", "-F6", "-F7", "-F8"].map((id) => phases.get(id)?.phaseAssignment)).toEqual(["L1", "L2", "L3", "L1"]);
  });
});

describe("elektrotechnický hlídač", () => {
  const issuesFor = (nodes: TreeNode[], id: string) => validateTree(nodes, 0.5).filter((issue) => issue.itemId === id);

  it("3P pod 1P uzlem, fáze mimo rodiče, vývod pod SPD, nezapojený prvek a cyklus", () => {
    const nodes = proposed();
    const edit = (id: string, patch: Partial<TreeNode>) => nodes.map((node) => (node.id === id ? { ...node, ...patch } : node));
    expect(issuesFor(edit("-F3", { parentItemId: "-F5" }), "-F3")[0].message).toContain("3P přístroj -F3 nemůže být napájen z jednofázového uzlu -F5");
    expect(issuesFor(edit("-F6", { parentItemId: "-F5" }), "-F6").map((issue) => issue.message)).toEqual([
      "-F6 je na fázi L2, ale nadřazený -F5 vede jen L1.",
      "-F6 (10 A) není selektivní vůči nadřazenému -F5 (10 A).",
    ]);
    expect(issuesFor(edit("-F7", { parentItemId: "-F1" }), "-F7")[0]).toMatchObject({ severity: "error", message: expect.stringContaining("pod přepěťovou ochranu -F1") });
    expect(issuesFor(edit("-F8", { parentItemId: null, fedFromIncomer: false }), "-F8")[0]).toMatchObject({ severity: "warning", message: "-F8 není zapojen – vyberte, odkud je napájen." });
    const cycle = edit("-Q1", { parentItemId: "-F2", fedFromIncomer: false });
    expect(issuesFor(cycle, "-Q1")[0].message).toContain("cyklu");
  });

  it("přetížení nadřazeného prvku součtem výpočtových proudů (Ib × SF)", () => {
    const nodes = proposed().map((node) => (node.id === "-F2" ? { ...node, ratedCurrentA: 25 } : node));
    expect(issuesFor(nodes, "-F2")[0].message).toBe("Součet výpočtových proudů 37 A na L1 přetěžuje -F2 (In 25 A).");
    // bez soudobosti přetíží i hlavní vypínač 40 A (74 A na L1)
    expect(validateTree(proposed(), 1).find((issue) => issue.itemId === "-Q1")?.message).toContain("74 A na L1");
  });

  it("přečíslování IEC značení v pořadí čtení", () => {
    const shuffled = NODES.map((node, index) => ({ ...node, id: `x${index}` }));
    expect([...renumber(shuffled).values()].slice(0, 4)).toEqual(["-Q1", "-F1", "-F2", "-F3"]);
  });
});
