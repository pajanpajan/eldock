import { describe, expect, it } from "vitest";

import { downstreamTree, spiderLinks, upstreamChain, type PowerNode } from "./power-tree";

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

describe("spiderLinks", () => {
  const pinned = (tag: string, from: string | null, circuit: string | null) => ({
    id: tag,
    tag,
    pinX: 10,
    pinY: 10,
    fedFromEquipmentId: from,
    fedFromCircuit: circuit,
    fedFrom: from ? { id: from, tag: from } : null,
  });

  it("spojí rozváděč s napájenými zařízeními patra, napájení z jiného patra jako odbočku", () => {
    const links = spiderLinks([pinned("R-ML-01", "RM1", "Pole 4 / QF5"), pinned("ML-01", "R-ML-01", "Vývod Q2"), pinned("ROB-07", "R-ML-01", "Vývod Q4"), pinned("LPS-B", null, null)]);
    expect(links.map((link) => (link.kind === "local" ? `${link.from.tag}→${link.to.tag} (${link.circuit})` : `${link.sourceTag}⇢${link.to.tag}`))).toEqual([
      "RM1⇢R-ML-01",
      "R-ML-01→ML-01 (Vývod Q2)",
      "R-ML-01→ROB-07 (Vývod Q4)",
    ]);
  });
});
