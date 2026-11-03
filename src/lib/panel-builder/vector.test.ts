import { describe, expect, it } from "vitest";

import { REFERENCE_DEVICES, withPositions } from "./reference";
import { proposeTree, type TreeNode } from "./tree";
import { VECTOR, pathOf, rootsOf, vectorLayout, wiringPaths } from "./vector-layout";
import { deviceWithConfig, leverCount, screwCount, sensitivityAmps, symbolTexts, vectorDeviceFrom, type VectorDevice } from "./vector-symbols";

const device = (patch: Partial<VectorDevice>): VectorDevice => ({
  id: "x",
  designation: "-F1",
  dinRailIndex: 1,
  positionOnRail: 1,
  modulesWidth: 1,
  category: "MCB",
  poles: "1P",
  manufacturer: "ABB",
  typeCode: "S201-B16",
  articleNumber: "2CDS251001R1165",
  ratedCurrentA: 16,
  curve: "B",
  rcdType: null,
  rcdSensitivityMa: null,
  spdType: null,
  contactConfig: null,
  power: null,
  powerLossWatts: 2.1,
  label: "Světla",
  status: "VERIFIED",
  ...patch,
});

describe("dynamické texty vektorových symbolů", () => {
  it("jistič „ABB / B16 / S201-B16“, chránič „AC 25A 0,03A“, odpínač „(40A)“", () => {
    expect(symbolTexts(device({}))).toEqual({ manufacturer: "ABB", value: "B16", detail: "S201-B16" });
    expect(symbolTexts(device({ category: "RCD", poles: "4P", curve: null, ratedCurrentA: 25, rcdType: "AC", rcdSensitivityMa: 30, typeCode: "FH204" }))).toEqual({ manufacturer: "ABB", value: "AC 25A 0,03A", detail: "FH204" });
    expect(symbolTexts(device({ category: "MAIN_SWITCH", poles: "3P", curve: null, ratedCurrentA: 40, typeCode: "SD203/40" })).value).toBe("(40A)");
    expect(symbolTexts(device({ category: "RCBO", curve: "B", ratedCurrentA: 16, rcdSensitivityMa: 30 })).value).toBe("B16 0,03A");
    expect(symbolTexts(device({ category: "SPD", spdType: "T2" })).value).toBe("T2");
    expect(symbolTexts(device({ category: null, manufacturer: null, typeCode: null, status: "UNRECOGNIZED" }))).toEqual({ manufacturer: "", value: "?", detail: "" });
    expect(sensitivityAmps(300)).toBe("0,3A");
  });

  it("šroubky = počet modulů, páčky podle pólů (kompakt podle šířky)", () => {
    expect([0.5, 1, 2, 3, 4].map(screwCount)).toEqual([1, 1, 2, 3, 4]);
    expect(leverCount("1P", 1)).toBe(1);
    expect(leverCount("3P", 3)).toBe(3);
    expect(leverCount("4P", 4)).toBe(4);
    expect(leverCount("3P", 2)).toBe(2); // kompaktní 3P ve 2M
    expect(leverCount("2x1P", 1)).toBe(1);
  });

  it("řádek z databáze → přístroj; náhled konfigurace hned přepíše hodnoty symbolu", () => {
    const fromDb = vectorDeviceFrom({
      id: "i1",
      designation: "-F4",
      dinRailIndex: 2,
      positionOnRail: 4,
      modulesWidth: 1,
      circuitLabel: "Koupelna",
      customTypeCode: null,
      recognitionStatus: "UNRECOGNIZED",
      rawOcrText: "S2?? -B1?",
      configJson: null,
      catalogComponent: null,
    });
    expect(fromDb).toMatchObject({ category: null, typeCode: null, label: "Koupelna", status: "UNRECOGNIZED" });
    const preview = deviceWithConfig(fromDb, { category: "MCB", manufacturer: "Eaton", poles: "1P", modules: 1, ratedCurrentA: 10, curve: "C" });
    expect(symbolTexts(preview)).toMatchObject({ manufacturer: "Eaton", value: "C10" });
    expect(preview.status).toBe("VERIFIED");
  });
});

describe("2D vektorový rozváděč – rozložení a modré spojnice", () => {
  const placed = withPositions(REFERENCE_DEVICES);
  const items = placed.map((entry) => ({ id: entry.designation, dinRailIndex: entry.dinRailIndex, positionOnRail: entry.positionOnRail, modulesWidth: entry.modules }));
  const nodes: TreeNode[] = placed.map((entry) => ({
    id: entry.designation,
    designation: entry.designation,
    circuitLabel: entry.label,
    dinRailIndex: entry.dinRailIndex,
    positionOnRail: entry.positionOnRail,
    category: entry.category,
    poles: entry.poles,
    ratedCurrentA: entry.ratedCurrentA,
    operatingCurrentA: null,
    parentItemId: null,
    fedFromIncomer: false,
    phaseAssignment: null,
  }));
  const tree = proposeTree(nodes);
  const wired = nodes.map((node) => ({ ...node, ...tree.get(node.id)! }));
  const layout = vectorLayout(items, 3, 12);

  it("přístroje zleva bez mezer v měřítku modulů, lišty pod sebou", () => {
    expect(layout.rects.get("-Q1")).toMatchObject({ x: VECTOR.left, w: 3 * VECTOR.moduleW });
    expect(layout.rects.get("-FV1")!.x).toBe(VECTOR.left + 3 * VECTOR.moduleW);
    expect(layout.rects.get("-F1")!.y).toBeGreaterThan(layout.rects.get("-Q1")!.y + VECTOR.deviceH);
    expect(layout.rails.map((rail) => rail.used)).toEqual([11, 12, 2]);
    expect(layout.width).toBe(VECTOR.left + 12 * VECTOR.moduleW + VECTOR.right);
  });

  it("přívod shora se šipkou do -Q1, sběrnice nad jističi skupiny, odbočka ke každému potomkovi", () => {
    const wires = wiringPaths(layout, items, wired, "TOP");
    const incomer = wires.filter((wire) => wire.kind === "incomer");
    expect(incomer).toHaveLength(1);
    const q1 = layout.rects.get("-Q1")!;
    expect(incomer[0].points.at(-1)).toEqual([q1.x + q1.w / 2, q1.y]);
    // -FI1 napájí 10 jističů na lištách 2 a 3 → dvě sběrnice a 10 odboček
    expect(wires.filter((wire) => wire.from === "-FI1" && wire.kind === "bus")).toHaveLength(2);
    expect(wires.filter((wire) => wire.from === "-FI1" && wire.kind === "drop")).toHaveLength(10);
    // sběrnice lišty 2 leží v mezeře nad lištou 2 (přívod shora)
    const bus = wires.find((wire) => wire.from === "-FI1" && wire.kind === "bus" && wire.points[0][1] < layout.rects.get("-F1")!.y)!;
    expect(bus.points[0][1]).toBeGreaterThan(q1.y + q1.h);
    // žádná spojnice nevede svisle přes tělo přístroje (kromě odboček do svorky)
    for (const wire of wires.filter((entry) => entry.kind !== "drop" && entry.kind !== "incomer")) {
      for (const [x, y] of wire.points.slice(1, -1)) {
        const inside = [...layout.rects.values()].some((rect) => x > rect.x && x < rect.x + rect.w && y > rect.y + 1 && y < rect.y + rect.h - 1);
        expect(inside).toBe(false);
      }
    }
    expect(pathOf([[1, 2], [3.04, 4]])).toBe("M1 2 L3 4");
  });

  it("přívod zespoda vede šipku zdola a sběrnice pod přístroji; bez stromu žádné spojnice", () => {
    const wires = wiringPaths(layout, items, wired, "BOTTOM");
    const incomer = wires.find((wire) => wire.kind === "incomer")!;
    expect(incomer.points[0][1]).toBe(layout.height - 6);
    const f1 = layout.rects.get("-F1")!;
    const drop = wires.find((wire) => wire.kind === "drop" && wire.points[1][0] === f1.x + f1.w / 2)!;
    expect(drop.points[1][1]).toBe(f1.y + f1.h);
    expect(wiringPaths(layout, items, nodes, "TOP")).toEqual([]);
    expect(rootsOf(wired).map((node) => node.id)).toEqual(["-Q1"]);
  });
});
