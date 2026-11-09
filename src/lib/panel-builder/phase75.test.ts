import { describe, expect, it } from "vitest";

import { buildSwitchboardFromCircuits, combPhases, rcdDemandA, rcdRating, type Circuit } from "@/engine/floorplan-bridge";

import { planBusbars, type BusbarItem } from "./pe-n-busbars";
import { SUPPLY_SYSTEMS } from "./supply";

const item = (id: string, designation: string, category: BusbarItem["category"], poles: string, parentItemId: string | null, circuitLabel = ""): BusbarItem => ({ id, designation, category, poles, parentItemId, circuitLabel });
const tnS = SUPPLY_SYSTEMS.find((supply) => supply.id === "3F_TNS")!;
const tt = SUPPLY_SYSTEMS.find((supply) => supply.id === "3F_TT")!;

const circuit = (id: string, designW: number, extra: Partial<Circuit> = {}): Circuit => ({
  id,
  label: id,
  kind: "sockets",
  phases: 1,
  protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 16 },
  cable: "CYKY-J 3x2,5",
  crossSectionMm2: 2.5,
  rooms: ["m1"],
  nodeIds: [id],
  outlets: 4,
  installedW: designW,
  designW,
  lengthMm: 10_000,
  voltageDropPct: 1,
  rcd: "A30",
  izA: 27,
  loop: { zsOhm: 0.5, zsMaxOhm: 1, iaA: 80, ikMinA: 300, ok: true },
  ...extra,
});

describe("fáze 75 – dělení N svorek a chráničů", () => {
  it("N bere každý přístroj z můstku nejbližšího nadřazeného chrániče – i RCBO a chránič pod hlavním chráničem (TT)", () => {
    const items = [
      item("q", "-Q1", "MAIN_SWITCH", "4P", null),
      item("fi0", "-FI0", "RCD", "4P", "q"),
      item("fi1", "-FI1", "RCD", "4P", "fi0"),
      item("fi2", "-FI2", "RCD", "2P", "fi0"),
      item("f1", "-F1", "MCB", "1P", "fi1", "Zásuvky kuchyň"),
      item("f2", "-F2", "MCB", "1P", "fi1", "Zásuvky obývák"),
      item("fa1", "-FA1", "RCBO", "1P+N", "fi1", "Světla"),
      item("f3", "-F3", "MCB", "1P", "fi2", "Koupelna"),
      item("fa2", "-FA2", "RCBO", "1P+N", "q", "Lednice"),
      item("f4", "-F4", "MCB", "3P", "fi0", "Motor bez N"),
    ];
    const plan = planBusbars(items, tt);
    const bar = (rcd: string) => plan.groups.find((group) => group.rcd === rcd)!;
    // Hlavní chránič -FI0 napájí N skupinových chráničů (ne N0); 3P motor bez N nic nebere
    expect(bar("-FI0").connections.map((row) => row.designation)).toEqual(["-FI1", "-FI2"]);
    // -FI1: obě zásuvky i N přívodu RCBO pod ním (dřív RCBO bralo N z N0 – chránič by vybavil)
    expect(bar("-FI1").connections.map((row) => row.designation)).toEqual(["-F1", "-F2", "-FA1"]);
    expect(bar("-FI1").connections.find((row) => row.designation === "-FA1")?.label).toContain("RCBO");
    expect(bar("-FI2").connections.map((row) => row.designation)).toEqual(["-F3"]);
    // N0: přívod, jen hlavní chránič a RCBO bez nadřazeného chrániče
    expect(plan.n0.connections.map((row) => row.designation)).toEqual(["přívod", "-FI0", "-FA2"]);
    expect(plan.n0.connections.some((row) => row.designation === "-FI1" || row.designation === "-FA1")).toBe(false);
  });

  it("bez hlavního chrániče beze změny: chrániče a samostatná RCBO z N0, jističe pod chráničem z jeho můstku", () => {
    const items = [item("q", "-Q1", "MAIN_SWITCH", "3P", null), item("fi1", "-FI1", "RCD", "4P", "q"), item("f1", "-F1", "MCB", "1P", "fi1"), item("fa1", "-FA1", "RCBO", "1P+N", "q")];
    const plan = planBusbars(items, tnS);
    expect(plan.n0.connections.map((row) => row.designation)).toEqual(["přívod", "-FI1", "-FA1"]);
    expect(plan.groups[0].connections.map((row) => row.designation)).toEqual(["-F1"]);
  });

  it("fáze jističů pod 4P chráničem jdou po sobě L1, L2, L3 podle pozice na hřebenové liště a zatížení se vyrovná", () => {
    const heavy = [circuit("a", 2000), circuit("b", 1800), circuit("c", 300), circuit("d", 250), circuit("e", 1900)];
    const placed = combPhases([{ key: "-FI1", circuits: heavy }]);
    const order = placed.order.get("-FI1")!;
    const phases = order.map((row) => placed.phaseOf[row.id]);
    // Pozice po sobě v pořadí lišty: L(o), L(o+1), L(o+2), …
    const cycle = ["L1", "L2", "L3"];
    const start = cycle.indexOf(phases[0] as string);
    expect(phases).toEqual(order.map((_, index) => cycle[(start + index) % 3]));
    // Tři nejtěžší okruhy každý na jiné fázi
    expect(new Set(["a", "b", "e"].map((id) => placed.phaseOf[id])).size).toBe(3);
    // Generátor rozváděče uloží stejné fáze a pořadí na liště
    const board = buildSwitchboardFromCircuits({ circuits: heavy, io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 }, bom: [] }, { mode: "classic", enclosures: [] });
    const onRail = board.devices.filter((device) => device.category === "MCB");
    expect(onRail.map((device) => device.phase)).toEqual(onRail.map((_, index) => cycle[(cycle.indexOf(onRail[0].phase as string) + index) % 3]));
  });

  it("jmenovitý proud chrániče podle součtu jističů na fázi s náročností 0,7 (40 A / 63 A)", () => {
    const six = Array.from({ length: 6 }, (_, index) => circuit(`s${index}`, 1000));
    const phaseOf = Object.fromEntries(six.map((row, index) => [row.id, ["L1", "L2", "L3"][index % 3] as "L1" | "L2" | "L3"]));
    // 2 × 16 A na fázi × 0,7 = 22,4 A → 40 A
    expect(rcdDemandA(six, phaseOf)).toBe(22.4);
    expect(rcdRating(six, phaseOf)).toBe(40);
    // 4 jističe 16 A (L1 dvakrát) + 3f okruh 32 A pod jedním chráničem → (2 × 16 + 32) × 0,7 = 44,8 A → 63 A
    const mixed = [...six.slice(0, 4), circuit("v", 9000, { phases: 3, protection: { device: "MCB", poles: "3P", curve: "B", ratedA: 32 } })];
    expect(rcdRating(mixed, { ...phaseOf, v: "L1,L2,L3" })).toBe(63);
    const board = buildSwitchboardFromCircuits({ circuits: mixed, io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 }, bom: [] }, { mode: "classic", enclosures: [] });
    expect(board.devices.find((device) => device.category === "RCD")?.ratedA).toBe(63);
  });
});
