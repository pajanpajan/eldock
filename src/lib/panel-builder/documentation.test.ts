import { describe, expect, it } from "vitest";

import { CATALOG } from "../../../prisma/seed-panel-builder";
import { componentsList, partsList, releaseBlockers, type DocItem } from "./documentation";
import { renderPanelDrawingSvg, renderSingleLineDiagramSvg, type DrawingItem } from "./drawings";
import { REFERENCE_DEVICES, REFERENCE_DIMS, withPositions } from "./reference";
import { proposeTree, type TreeNode } from "./tree";

const catalog = new Map(CATALOG.map((component) => [component.articleNumber, component]));
const placed = withPositions(REFERENCE_DEVICES);
const nodes: TreeNode[] = placed.map((device) => ({
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
const tree = proposeTree(nodes);
const connected = nodes.map((node) => ({ ...node, ...tree.get(node.id)! }));
const docItems: DocItem[] = connected.map((node, index) => {
  const component = catalog.get(placed[index].articleNumber)!;
  return { ...node, component: { articleNumber: component.articleNumber, typeCode: component.typeCode, manufacturer: component.manufacturer, description: component.description, category: component.category } };
});
const enclosure = { articleNumber: "1SPE007717F0620", typeCode: "RES12x320", manufacturer: "ABB", description: "MISTRAL41W, 36M 3R", category: "ENCLOSURE" as const };
const drawing: DrawingItem[] = connected.map((node, index) => ({ ...node, typeCode: placed[index].typeCode, modulesWidth: placed[index].modules }));

describe("kusovník a seznam komponent (referenční PDF)", () => {
  it("kusovník podle objednacích čísel se skříní na prvním řádku", () => {
    const parts = partsList(docItems, enclosure);
    expect(parts[0]).toMatchObject({ articleNumber: "1SPE007717F0620", quantity: 1 });
    const qty = Object.fromEntries(parts.map((row) => [row.typeCode, row.quantity]));
    expect(qty).toMatchObject({ "S201-B10": 3, "S201-B16": 5, "S203-B16": 2, "SD203/40": 1, "FH204 A-40/0,03": 1, "OVR T2-T3 3N 20-275 P QS": 1 });
    expect(parts.reduce((sum, row) => sum + row.quantity, 0)).toBe(14);
  });

  it("seznam komponent podle značení (přirozené řazení) s pozicí v 1P schématu a funkcí", () => {
    const rows = componentsList(docItems, enclosure);
    expect(rows.map((row) => row.designation).slice(0, 5)).toEqual(["-A1", "-F1", "-F2", "-F3", "-F4"]);
    expect(rows.map((row) => row.designation).slice(-4)).toEqual(["-F10", "-F11", "-F12", "-Q1"]);
    expect(rows.find((row) => row.designation === "-F8")).toMatchObject({ articleNumber: "2CDS251001R1165", function: "Zásuvky kuchyně" });
    expect(rows.find((row) => row.designation === "-Q1")?.position).toBe("/3.1");
  });

  it("překážky propuštění", () => {
    const ready = docItems.map((item) => ({ ...item, recognitionStatus: "VERIFIED" }));
    expect(releaseBlockers({ items: ready, connected: true, thermalOk: true })).toEqual([]);
    const blockers = releaseBlockers({ items: ready.map((item, i) => (i === 6 ? { ...item, recognitionStatus: "UNRECOGNIZED", component: null } : item)), connected: false, thermalOk: false });
    expect(blockers).toEqual(["Nepotvrzené přístroje (krok 1): -F6.", "Strom zapojení není kompletní (krok 2).", "Výpočet oteplení nevyhovuje (krok 3)."]);
  });
});

describe("výkresy SVG", () => {
  it("výkres osazení: skříň, 3 lišty, 13 přístrojů a modré propojky", () => {
    const svg = renderPanelDrawingSvg(REFERENCE_DIMS, drawing, "MISTRAL41W, 36M 3R");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/fill="#e5e7eb"/g)).toHaveLength(3);
    for (const designation of ["-Q1", "-F1", "-F12"]) expect(svg).toContain(`>${designation}</text>`);
    expect(svg).toContain('stroke="#1d4ed8"');
    expect(svg).toContain("292 mm");
    expect(svg).toContain("507 mm");
  });

  it("1P schéma ze stromu: přívod, -Q1 → -F1/-F2 → -F3 až -F12, fáze a popisy obvodů", () => {
    const svg = renderSingleLineDiagramSvg(drawing, { incomer: "L1,L2,L3,N", network: "3 x 230/400 V, 50Hz, TN-S" });
    expect(svg).toContain(">L1,L2,L3,N</text>");
    for (const designation of ["-Q1", "-F1", "-F2", "-F3", "-F12"]) expect(svg).toContain(`>${designation}</text>`);
    for (const label of ["Tepelné čerpadlo", "Zásuvky pokoje + koupelna"]) expect(svg).toContain(label);
    expect(svg).not.toContain("Nezapojeno ve stromu");
    // nezapojený prvek se vypíše pod schéma
    const loose = renderSingleLineDiagramSvg(drawing.map((item) => (item.designation === "-F12" ? { ...item, parentItemId: null, fedFromIncomer: false } : item)), { incomer: "L1,L2,L3,N", network: "" });
    expect(loose).toContain("Nezapojeno ve stromu: -F12");
  });
});
