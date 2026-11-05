import { describe, expect, it } from "vitest";

import { standardEnclosureMatrix, type EnclosureLike } from "@/lib/panel-builder/enclosures";

import {
  MAX_CIRCUITS_PER_RCD,
  MAX_OUTLETS_PER_CIRCUIT,
  balancePhases,
  buildSwitchboardFromCircuits,
  calibrateFloorplanScale,
  generateCircuitsFromFloorplan,
  resolveSwitchWiring,
  voltageDropPercent,
  type FloorNode,
  type Floorplan,
  type InstallMode,
} from "./floorplan-bridge";

const ENCLOSURES: EnclosureLike[] = standardEnclosureMatrix().map((row) => ({ ...row, id: row.articleNumber }));

// Vzorový rodinný dům 10 × 8 m, rozváděč v chodbě; podklad 1 px = 10 mm
const calibration = calibrateFloorplanScale({
  walls: [
    { px: [0, 0, 1000, 0], lengthMm: 10_000 },
    { px: [0, 0, 0, 800], lengthMm: 8_000 },
  ],
  panelPx: [50, 400],
});

let seq = 0;
const node = (room: string, kind: FloorNode["kind"], x: number, y: number, extra: Partial<FloorNode> = {}): FloorNode => ({ id: `n${++seq}`, room, kind, px: [x, y], ...extra });
const repeat = (count: number, make: (index: number) => FloorNode) => Array.from({ length: count }, (_, index) => make(index));

function house(mode: InstallMode): Floorplan {
  seq = 0;
  return {
    mode,
    rooms: [
      { id: "hall", name: "Chodba", lighting: { groups: 1, switchCount: 3 } },
      { id: "kitchen", name: "Kuchyně", lighting: { groups: 1, switchCount: 2 } },
      { id: "living", name: "Obývací pokoj", lighting: { groups: 2, switchCount: 2, blinds: 2 } },
      { id: "bedroom", name: "Ložnice", lighting: { groups: 1, switchCount: 1, blinds: 1 } },
      { id: "kids", name: "Dětský pokoj", lighting: { groups: 1, switchCount: 1 } },
      { id: "bath", name: "Koupelna", lighting: { groups: 2, switchCount: 1 } },
      { id: "garage", name: "Garáž", lighting: { groups: 1, switchCount: 4 } },
    ],
    nodes: [
      ...repeat(2, (i) => node("hall", "single_socket", 80 + i * 60, 420)),
      ...repeat(4, (i) => node("kitchen", "double_socket", 150 + i * 50, 120)),
      node("kitchen", "appliance", 160, 60, { tag: "oven" }),
      node("kitchen", "appliance", 200, 60, { tag: "dishwasher" }),
      node("kitchen", "appliance", 240, 60, { tag: "fridge" }),
      node("kitchen", "appliance", 280, 60, { tag: "cooktop_3p" }),
      node("kitchen", "appliance", 320, 60, { tag: "microwave_builtin", powerW: 900 }),
      ...repeat(6, (i) => node("living", "single_socket", 450 + i * 70, 150)),
      ...repeat(3, (i) => node("living", "double_socket", 450 + i * 90, 300)),
      ...repeat(4, (i) => node("bedroom", "double_socket", 650 + i * 60, 600)),
      ...repeat(4, (i) => node("kids", "double_socket", 400 + i * 60, 650)),
      node("bath", "double_socket", 250, 600),
      node("bath", "appliance", 220, 650, { tag: "washer" }),
      node("bath", "appliance", 280, 700, { tag: "boiler" }),
      ...repeat(2, (i) => node("garage", "single_socket", 900, 100 + i * 100)),
      node("garage", "appliance", 950, 100, { tag: "ev_charger" }),
      node("garage", "appliance", 950, 300, { tag: "heat_pump" }),
      ...repeat(2, (i) => node("hall", "light", 100 + i * 100, 400)),
      ...repeat(2, (i) => node("kitchen", "light", 200 + i * 100, 100)),
      ...repeat(3, (i) => node("living", "light", 500 + i * 100, 200)),
      node("bedroom", "light", 700, 650),
      node("kids", "light", 450, 650),
      ...repeat(2, (i) => node("bath", "light", 250 + i * 40, 650)),
      ...repeat(2, (i) => node("garage", "light", 880, 150 + i * 150)),
      node("hall", "switch", 60, 380),
    ],
  };
}

describe("1. kalibrace měřítka a délky kabelů", () => {
  it("dvě stěny = měřítko pro osu X a Y zvlášť (zkosený sken)", () => {
    const skewed = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 10_000 }, { px: [0, 0, 0, 400], lengthMm: 8_000 }], panelPx: [0, 0] });
    expect(skewed.pxToMm.x).toBeCloseTo(10);
    expect(skewed.pxToMm.y).toBeCloseTo(20);
    const diagonal = calibrateFloorplanScale({ walls: [{ px: [0, 0, 300, 400], lengthMm: 5_000 }], panelPx: [0, 0] });
    expect(diagonal.pxToMm).toEqual({ x: 10, y: 10 });
    expect(() => calibrateFloorplanScale({ walls: [], panelPx: [0, 0] })).toThrow(/1 nebo 2/);
  });

  it("Manhattan délka + svislé instalační zóny (zásuvka 300 mm, spínač 1050 mm, stropní trasa −300 mm)", () => {
    // vodorovně 1 m, z trasy 2 300 mm k přívodu rozváděče 1 700 mm = 600 mm
    expect(calibration.calculateCableLength({ px: [150, 400], kind: "single_socket" })).toBe(1000 + 600 + 2000);
    expect(calibration.calculateCableLength({ px: [150, 400], kind: "switch" })).toBe(1000 + 600 + 1250);
    expect(calibration.calculateCableLength({ px: [150, 500], kind: "light" })).toBe(2000 + 600 + 300);
  });

  it("úbytek napětí 1f a 3f", () => {
    expect(voltageDropPercent({ lengthMm: 25_000, currentA: 16, crossSectionMm2: 2.5, phases: 1 })).toBeCloseTo(3.13, 2);
    expect(voltageDropPercent({ lengthMm: 25_000, currentA: 16, crossSectionMm2: 2.5, phases: 3 })).toBeCloseTo(1.56, 2);
  });
});

describe("2. matice řazení vypínačů", () => {
  const classic = (groups: 1 | 2, switchCount: number) => resolveSwitchWiring({ groups, switchCount, mode: "classic" });
  it("klasická instalace podle tabulky", () => {
    expect(classic(1, 1).items).toEqual([{ place: "wall", name: "Jednopólový spínač", razeni: "1", count: 1 }]);
    expect(classic(2, 1).items[0]).toMatchObject({ razeni: "5", count: 1 });
    expect(classic(1, 2).items[0]).toMatchObject({ razeni: "6", count: 2 });
    expect(classic(2, 2).items[0]).toMatchObject({ razeni: "6+6 / 5B", count: 2 });
    expect(classic(1, 3).items.map((item) => [item.razeni, item.count])).toEqual([
      ["6", 2],
      ["7", 1],
    ]);
    const many = classic(1, 4);
    expect(many.items[0]).toMatchObject({ razeni: "1/0", count: 4 });
    expect(many.impulseRelays).toBe(1);
    expect(many.note).toContain("MR-41");
  });

  it("chytré relé a Loxone: tlačítka / Touch Tree a požadavek na DI / DO", () => {
    expect(resolveSwitchWiring({ groups: 2, switchCount: 3, mode: "smart_relay", blinds: 1 })).toMatchObject({ io: { di: 4, do: 4 }, impulseRelays: 0 });
    const loxone = resolveSwitchWiring({ groups: 1, switchCount: 2, mode: "bus_loxone", blinds: 2 });
    expect(loxone.items[0]).toMatchObject({ name: "Loxone Touch Tree (s integrovaným termostatem)", count: 2 });
    expect(loxone).toMatchObject({ io: { di: 0, do: 5 }, treeDevices: 2 });
  });
});

describe("3. + 4. vzorový rodinný dům: od půdorysu po přístroje na DIN lištách", () => {
  const plan = generateCircuitsFromFloorplan(house("classic"), calibration);
  const of = (kind: string) => plan.circuits.filter((circuit) => circuit.kind === kind);

  it("okruhy dle ČSN 33 2130 ed. 4", () => {
    expect(of("dedicated").map((c) => c.label)).toEqual(["Trouba – Kuchyně", "Myčka – Kuchyně", "Pračka – Koupelna", "Bojler – Koupelna"]);
    expect(of("dedicated").every((c) => c.protection.ratedA === 16 && c.protection.poles === "1P" && c.cable === "CYKY-J 3x2,5")).toBe(true);
    expect(of("cooktop")).toEqual([expect.objectContaining({ phases: 3, cable: "CYKY-J 5x2,5", protection: expect.objectContaining({ poles: "3P", ratedA: 16 }) })]);
    expect(of("fridge")[0].protection).toEqual({ device: "RCBO", poles: "1P+N", curve: "B", ratedA: 16, rcd: { type: "A", sensitivityMa: 30 } });
    expect(of("three_phase_rcd_b").map((c) => [c.label, c.protection.curve, c.rcd])).toEqual([
      ["Nabíječka elektromobilu – Garáž", "B", "B30"],
      ["Tepelné čerpadlo – Garáž", "C", "B30"],
    ]);
    // Zásuvky: max. 10 skutečných zásuvek (fáze 52: dvojzásuvka = 2); mikrovlnka 900 W zůstane na zásuvkovém okruhu
    const sockets = of("sockets");
    expect(sockets.every((c) => c.outlets <= MAX_OUTLETS_PER_CIRCUIT && c.protection.ratedA === 16)).toBe(true);
    expect(sockets.reduce((sum, c) => sum + c.outlets, 0)).toBe(2 + 4 * 2 + 1 + 6 + 3 * 2 + 4 * 2 + 4 * 2 + 2 + 2);
    // Světla: min. 2 nezávislé okruhy B10 na RCBO typ A (fáze 52), CYKY-J 3x1,5
    expect(of("lighting").length).toBeGreaterThanOrEqual(2);
    expect(of("lighting").every((c) => c.protection.ratedA === 10 && c.protection.device === "RCBO" && c.rcd === "own" && c.cable === "CYKY-J 3x1,5" && c.voltageDropPct <= 3)).toBe(true);
    expect(plan.circuits.filter((c) => c.kind !== "lighting").every((c) => c.voltageDropPct <= 5)).toBe(true);
  });

  it("kusovník rozlišuje jednozásuvky a dvojzásuvky a spínače podle řazení", () => {
    const count = (item: string) => plan.bom.find((entry) => entry.item.startsWith(item))?.count ?? 0;
    expect(count("Zásuvka jednonásobná")).toBe(10);
    expect(count("Zásuvka dvojnásobná")).toBe(16);
    expect(count("Křížový přepínač (řazení 7)")).toBe(1);
    expect(plan.io.impulseRelays).toBe(1); // garáž: 4 ovládací místa
  });

  it("rozváděč: vyvážené fáze, chrániče bez konfliktu místností, rezerva 25 % a skříň s P_max", () => {
    const board = buildSwitchboardFromCircuits(plan, { mode: "classic", enclosures: ENCLOSURES });
    expect(board.devices.slice(0, 3).map((d) => d.designation)).toEqual(["-Q1", "-FV1", "-X1"]);
    // Fáze: rozdíl nejvýše jednoho největšího 1f okruhu
    const largest = Math.max(...plan.circuits.filter((c) => c.phases === 1).map((c) => c.designW));
    expect(Math.max(...Object.values(board.phaseLoadW)) - Math.min(...Object.values(board.phaseLoadW))).toBeLessThanOrEqual(largest);
    expect(Object.keys(board.phaseOf)).toHaveLength(plan.circuits.length);

    const typeA = board.rcdGroups.filter((group) => group.type === "A");
    expect(typeA.every((group) => group.circuitIds.length <= MAX_CIRCUITS_PER_RCD)).toBe(true);
    expect(board.rcdGroups.filter((group) => group.type === "B")).toHaveLength(2);
    const byId = new Map(plan.circuits.map((c) => [c.id, c]));
    for (const group of typeA) {
      const circuits = group.circuitIds.map((id) => byId.get(id)!);
      const lightRooms = new Set(circuits.filter((c) => c.kind === "lighting").flatMap((c) => c.rooms));
      expect(circuits.filter((c) => c.kind === "sockets").some((c) => c.rooms.some((room) => lightRooms.has(room)))).toBe(false);
      expect(circuits.filter((c) => c.kind === "lighting").length).toBeLessThanOrEqual(1);
    }
    // Každý okruh má právě jeden jisticí přístroj, RCBO lednice mimo chrániče
    expect(board.devices.filter((d) => d.circuitId).map((d) => d.circuitId).sort()).toEqual(plan.circuits.map((c) => c.id).sort());
    expect(board.devices.find((d) => d.category === "RCBO")?.designation).toBe("-FA1");
    expect(board.devices.filter((d) => d.category === "RELAY")).toHaveLength(1);
    expect(board.bom.find((entry) => entry.item.startsWith("Izolovaný N-můstek"))?.count).toBe(board.rcdGroups.length);

    // Skříň: moduly + 25 % rezerva, ztráty ≤ P_max, lišty v řadách skříně
    expect(board.requiredModules).toBe(Math.ceil(board.totalModules * 1.25));
    expect(board.enclosure).not.toBeNull();
    expect(board.enclosure!.totalModules).toBeGreaterThanOrEqual(board.requiredModules);
    expect(board.totalPowerLossW).toBeLessThanOrEqual(board.enclosure!.pMaxW!);
    expect(board.rails.length).toBeLessThanOrEqual(board.enclosure!.rows);
    expect(board.rails.every((rail) => rail.used <= rail.capacity)).toBe(true);
    expect(board.rails.flatMap((rail) => rail.devices)).toHaveLength(board.devices.length);
    // Skupina chrániče začíná chráničem a jeho jističe jsou na stejné liště (když se vejde)
    const firstRcd = board.rails.find((rail) => rail.devices.some((d) => d.designation === "-FI1"))!;
    expect(firstRcd.devices.filter((d) => typeA[0].circuitIds.includes(d.circuitId ?? "")).length).toBe(typeA[0].circuitIds.length);
    // Přístroje nesou konfiguraci pro AI Panel Builder
    expect(board.devices.find((d) => d.designation === "-FV1")?.config).toMatchObject({ category: "SPD", spdType: "T1+T2", poles: "3P+N" });
    expect(board.warnings).toEqual([]);
  });

  it("chytrá instalace: Loxone Miniserver + Relay Extension + zdroj 24 V, Shelly Pro podle DI / DO", () => {
    const loxone = generateCircuitsFromFloorplan(house("bus_loxone"), calibration);
    expect(loxone.io.impulseRelays).toBe(0);
    expect(loxone.io.do).toBe(1 + 1 + 2 + 2 * 2 + 1 + 2 * 1 + 1 + 2 + 1);
    const board = buildSwitchboardFromCircuits(loxone, { mode: "bus_loxone", enclosures: ENCLOSURES });
    const labels = board.devices.map((d) => d.label);
    expect(labels).toContain("Loxone Miniserver");
    expect(labels.filter((label) => label === "Loxone Relay Extension")).toHaveLength(1); // 15 DO = 8 + 14
    expect(labels).toContain("Napájecí zdroj 24 V DC");
    expect(board.enclosure).not.toBeNull();

    const shelly = buildSwitchboardFromCircuits(generateCircuitsFromFloorplan(house("smart_relay"), calibration), { mode: "smart_relay", enclosures: ENCLOSURES });
    expect(shelly.devices.filter((d) => d.label === "Shelly Pro 4PM")).toHaveLength(4); // 15 DI / 15 DO po 4
  });

  it("bez vyhovující skříně varování místo tiché chyby", () => {
    const board = buildSwitchboardFromCircuits(plan, { mode: "classic", enclosures: ENCLOSURES.filter((row) => row.totalModules <= 24) });
    expect(board.enclosure).toBeNull();
    expect(board.warnings[0]).toMatch(/Žádná skříň z databáze nepojme/);
    expect(balancePhases([{ id: "a", phases: 3, designW: 3000 }]).load).toEqual({ L1: 1000, L2: 1000, L3: 1000 });
  });
});
