import { describe, expect, it } from "vitest";

import { downstreamTree, upstreamChain, type PowerNode } from "./power-tree";

const node = (tag: string, from: string | null = null, circuit: string | null = null, type: PowerNode["type"] = "SWITCHBOARD"): PowerNode => ({
  id: tag,
  tag,
  name: `${tag} - zařízení`,
  type,
  fedFromEquipmentId: from,
  fedFromCircuit: circuit,
});

const NODES = [
  node("TR1", null, null, "TRANSFORMER"),
  node("RM1", "TR1", "Vývod nn / Q0"),
  node("R-CNC-04", "RM1", "Pole 2 / QF2"),
  node("CNC-04", "R-CNC-04", "Hlavní vypínač Q1", "CNC_MACHINE"),
  node("R-LIS-01", "RM1", "Pole 1 / QF1"),
  node("LIS-02", "R-LIS-01", "Vývod Q3", "PRODUCTION_LINE"),
  node("LIS-01", "R-LIS-01", "Vývod Q2", "PRODUCTION_LINE"),
];

describe("upstreamChain", () => {
  it("řetězec od zdroje k přímému nadřazenému rozváděči s vývody", () => {
    expect(upstreamChain("CNC-04", NODES).map((step) => `${step.node.tag} (${step.circuit})`)).toEqual([
      "TR1 (Vývod nn / Q0)",
      "RM1 (Pole 2 / QF2)",
      "R-CNC-04 (Hlavní vypínač Q1)",
    ]);
    expect(upstreamChain("TR1", NODES)).toEqual([]);
  });

  it("neuvázne v cyklu", () => {
    const cyclic = [node("A", "B", "x"), node("B", "A", "y")];
    expect(upstreamChain("A", cyclic).map((step) => step.node.tag)).toEqual(["B"]);
  });
});

describe("downstreamTree", () => {
  it("všechny podřízené rozváděče a stroje do hloubky, seřazené podle vývodů", () => {
    expect(downstreamTree("RM1", NODES).map((entry) => `${"·".repeat(entry.depth)}${entry.node.tag}`)).toEqual([
      "·R-LIS-01",
      "··LIS-01",
      "··LIS-02",
      "·R-CNC-04",
      "··CNC-04",
    ]);
    expect(downstreamTree("CNC-04", NODES)).toEqual([]);
  });
});
