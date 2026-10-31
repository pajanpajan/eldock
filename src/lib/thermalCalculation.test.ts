import { describe, expect, it } from "vitest";

import { CATALOG } from "../../prisma/seed-panel-builder";
import { REFERENCE_DEVICES, REFERENCE_DIMS, withPositions } from "./panel-builder/reference";
import { proposeTree, type TreeNode } from "./panel-builder/tree";
import { calculateThermal, coolingSurfaces, deratingFactor, type ThermalDevice, type ThermalEnclosure } from "./thermalCalculation";

const pn = new Map(CATALOG.map((component) => [component.articleNumber, component.powerLossWatts]));

function referenceDevices(): ThermalDevice[] {
  const nodes: TreeNode[] = withPositions(REFERENCE_DEVICES).map((device) => ({
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
  return REFERENCE_DEVICES.map((device) => ({
    id: device.designation,
    designation: device.designation,
    typeCode: device.typeCode,
    description: device.label,
    category: device.category,
    poles: device.poles,
    ratedCurrentA: device.ratedCurrentA,
    ratedLossW: pn.get(device.articleNumber)!,
    operatingCurrentA: null,
    parentItemId: tree.get(device.designation)!.parentItemId,
    phaseAssignment: tree.get(device.designation)!.phaseAssignment,
  }));
}

const ENCLOSURE: ThermalEnclosure = { ...REFERENCE_DIMS, installation: "WALL_MOUNTED", ambientTempC: 30, simultaneityFactor: 0.5, internalWiringLossW: 4.1 };

describe("výpočet oteplení – referenční rozváděč (PDF PanelBuilder: 30 + 12,4 = 42,4 °C)", () => {
  const result = calculateThermal(referenceDevices(), ENCLOSURE);
  const row = (designation: string) => result.rows.find((r) => r.designation === designation)!;

  it("vnitřní teplota, ztrátový výkon a chladicí plocha", () => {
    expect(result.internalTempC).toBeCloseTo(42.4, 1);
    expect(result.deltaT05).toBeCloseTo(12.4, 1);
    expect(result.deviceLossW).toBeCloseTo(13.65, 1);
    expect(result.totalLossW).toBeCloseTo(17.75, 1);
    expect(result.effectiveAreaM2).toBeCloseTo(0.366, 3);
    expect(result.topTempC).toBeGreaterThan(result.internalTempC);
    expect(result.ok).toBe(true);
    expect(result.verdict).toMatch(/^VYHOVUJE dle ČSN EN 61439 – Vypočítaná teplota 42,4 °C .* pod limitem 70 °C$/);
  });

  it("řádky přístrojů odpovídají tabulce oteplení", () => {
    expect(row("-F3")).toMatchObject({ leaf: true });
    expect(row("-F3").operatingCurrentA).toBeCloseTo(13.52, 1);
    expect(row("-F3").lossW).toBeCloseTo(1.79, 1);
    expect(row("-F3").reducedLossW).toBeCloseTo(0.45, 2);
    expect(row("-F3").imaxSf).toBeCloseTo(6.76, 1);
    expect(row("-F5").N).toBeCloseTo(8.45, 1);
    expect(row("-F2").imax).toBeCloseTo(62.51, 1);
    expect(row("-F2").L3).toBeCloseTo(49, 0);
    expect(row("-F2").N).toBeCloseTo(13.52, 1);
    expect(row("-F2").lossW).toBeCloseTo(20.8, 1);
    expect(row("-Q1").lossW).toBeCloseTo(16.63, 1);
    expect(row("-Q1").reducedLossW).toBeCloseTo(4.17, 1);
    expect(row("-F1").constantLossW).toBe(0.03);
  });

  it("fázová bilance (L1, L2, L3, N) a provozní proud", () => {
    expect(result.phaseLoads.L1).toBeCloseTo(31.29, 0);
    expect(result.phaseLoads.L2).toBeCloseTo(31.29, 0);
    expect(result.phaseLoads.L3).toBeCloseTo(24.53, 0);
    expect(result.phaseLoads.N).toBeCloseTo(6.77, 0);
    expect(result.operatingCurrentA).toBeCloseTo(31.29, 0);
    expect(result.phaseImbalancePct).toBeGreaterThan(20);
    expect(result.warnings.some((warning) => warning.startsWith("Nesymetrie fází"))).toBe(true);
  });
});

describe("výpočet oteplení – vstupy skříně", () => {
  it("instalace mění účinnou plochu a tím teplotu", () => {
    const devices = referenceDevices();
    const wall = calculateThermal(devices, ENCLOSURE);
    const flush = calculateThermal(devices, { ...ENCLOSURE, installation: "FLUSH_MOUNTED" });
    const free = calculateThermal(devices, { ...ENCLOSURE, installation: "FREE_STANDING" });
    expect(flush.effectiveAreaM2).toBeLessThan(wall.effectiveAreaM2);
    expect(free.effectiveAreaM2).toBeGreaterThan(wall.effectiveAreaM2);
    expect(flush.internalTempC).toBeGreaterThan(wall.internalTempC);
    expect(free.internalTempC).toBeLessThan(wall.internalTempC);
    expect(coolingSurfaces({ ...ENCLOSURE, installation: "FREE_STANDING" }).every((surface) => surface.factor >= 0.9)).toBe(true);
  });

  it("vyšší soudobost a horké okolí → nevyhovuje; derating; výpočtový proud Ib", () => {
    const hot = calculateThermal(referenceDevices(), { ...ENCLOSURE, ambientTempC: 55, simultaneityFactor: 1 });
    expect(hot.ok).toBe(false);
    expect(hot.verdict).toMatch(/^NEVYHOVUJE/);
    expect(deratingFactor(20)).toBe(1);
    expect(deratingFactor(70)).toBe(0.5);
    const devices = referenceDevices().map((device) => (device.designation === "-F3" ? { ...device, operatingCurrentA: 4 } : device));
    const result = calculateThermal(devices, ENCLOSURE);
    expect(result.rows.find((row) => row.designation === "-F3")!.operatingCurrentA).toBe(4);
    expect(result.totalLossW).toBeLessThan(17.75);
  });

  it("bez přístrojů jen ztráty vodičů; nezapojené prvky se počítají jako samostatné vývody", () => {
    expect(calculateThermal([], ENCLOSURE).totalLossW).toBe(4.1);
    const loose = referenceDevices().map((device) => ({ ...device, parentItemId: null }));
    expect(calculateThermal(loose, ENCLOSURE).phaseLoads.L1).toBeGreaterThan(0);
  });
});
