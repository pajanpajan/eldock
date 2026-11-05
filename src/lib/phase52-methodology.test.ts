import { describe, expect, it } from "vitest";

import {
  BUS_LEG_CABLE,
  STAR_LIGHT_CABLE,
  summarizeCabling,
  type RouteNode,
} from "@/engine/cable-routing";
import {
  BOX_DEEP,
  BUS_TERMINALS,
  RETROFIT_MODULE,
  RS485_TERMINATOR,
  buildSwitchboardFromCircuits,
  calibrateFloorplanScale,
  cableAmpacity,
  checkCoordination,
  generateCircuitsFromFloorplan,
  loopImpedanceCheck,
  maxBreakerFor,
  type FloorNode,
  type Floorplan,
  type InstallMode,
} from "@/engine/floorplan-bridge";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import {
  standardEnclosureMatrix,
  type EnclosureLike,
} from "@/lib/panel-builder/enclosures";
import {
  LEGAL_FRAMEWORK,
  externalInfluencesProtocol,
  isFlushEnclosure,
} from "@/lib/panel-builder/external-influences";
import {
  PALETTE,
  emptyDraft,
  parseDraft,
} from "@/lib/panel-builder/floorplan-editor";
import {
  validateSwitchboardState,
  type LintDevice,
} from "@/lib/panel-builder/linter";
import {
  maxMeasuredLoopOhm,
  parseRcdTest,
  rcdTestRows,
  sanitizeRcdTest,
} from "@/lib/rcd-test";

// Fáze 52: metodika návrhu domovních elektroinstalací a Smart Home – ČSN 33 2130 ed. 4, ČSN 33 2000-5-52
// ed. 2, ČSN 33 2000-5-51 ed. 3, TNI 33 2000-5-51:2022 a vyhláška č. 131/2024 Sb.

const ENCLOSURES: EnclosureLike[] = standardEnclosureMatrix().map((row) => ({
  ...row,
  id: row.articleNumber,
}));
const calibration = calibrateFloorplanScale({
  walls: [{ px: [0, 0, 1000, 0], lengthMm: 10_000 }],
  panelPx: [50, 400],
});

let seq = 0;
const node = (
  room: string,
  kind: FloorNode["kind"],
  x: number,
  y: number,
  extra: Partial<FloorNode> = {},
): FloorNode => ({ id: `n${++seq}`, room, kind, px: [x, y], ...extra });

function house(
  mode: InstallMode,
  extra: () => FloorNode[] = () => [],
): Floorplan {
  seq = 0;
  return {
    mode,
    rooms: [
      {
        id: "kitchen",
        name: "Kuchyně",
        lighting: { groups: 1, switchCount: 2 },
      },
      {
        id: "living",
        name: "Obývací pokoj",
        lighting: { groups: 2, switchCount: 2, blinds: 1 },
      },
      { id: "garage", name: "Garáž", lighting: { groups: 1, switchCount: 1 } },
    ],
    nodes: [
      ...Array.from({ length: 4 }, (_, i) =>
        node("kitchen", "double_socket", 150 + i * 50, 120),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        node("living", "single_socket", 450 + i * 70, 150),
      ),
      node("kitchen", "light", 200, 100),
      node("living", "light", 500, 200),
      node("living", "light", 600, 200),
      node("garage", "light", 880, 150),
      node("garage", "appliance", 950, 100, { tag: "ev_charger" }),
      node("garage", "appliance", 950, 300, { tag: "heat_pump" }),
      ...extra(),
    ],
  };
}

describe("ČSN 33 2130 ed. 4 – proudové chrániče a oddělení světel od zásuvek", () => {
  it("v návrhu nikdy nevznikne chránič typu AC a světelný okruh nikdy nesdílí chránič se zásuvkami", () => {
    for (const lightingProtection of ["rcbo", "rcd_group"] as const) {
      const plan = generateCircuitsFromFloorplan(
        house("classic"),
        calibration,
        { lightingProtection },
      );
      const board = buildSwitchboardFromCircuits(plan, {
        mode: "classic",
        enclosures: ENCLOSURES,
      });
      expect(
        board.devices.every((device) => device.config.rcdType !== "AC"),
      ).toBe(true);
      expect(
        board.rcdGroups.every((group) => group.type !== ("AC" as string)),
      ).toBe(true);
      const byId = new Map(
        plan.circuits.map((circuit) => [circuit.id, circuit]),
      );
      for (const group of board.rcdGroups) {
        const kinds = new Set(group.circuitIds.map((id) => byId.get(id)!.kind));
        expect(kinds.has("lighting") && kinds.size > 1).toBe(false);
      }
      const lights = plan.circuits.filter(
        (circuit) => circuit.kind === "lighting",
      );
      expect(lights.length).toBeGreaterThan(0);
      if (lightingProtection === "rcbo") {
        // Každý světelný okruh B10 = RCBO 1P+N typ A 30 mA mimo společné chrániče
        expect(
          lights.every(
            (circuit) =>
              circuit.rcd === "own" &&
              circuit.protection.device === "RCBO" &&
              circuit.protection.rcd?.type === "A",
          ),
        ).toBe(true);
        expect(
          board.devices.filter(
            (device) =>
              device.category === "RCBO" && device.label.startsWith("Světla"),
          ),
        ).toHaveLength(lights.length);
      } else {
        expect(
          board.rcdGroups
            .filter((group) => group.lightingOnly)
            .flatMap((group) => group.circuitIds)
            .sort(),
        ).toEqual(lights.map((c) => c.id).sort());
      }
    }
  });

  it("Wallbox, TČ a FVE striktně za chráničem typ B", () => {
    const plan = generateCircuitsFromFloorplan(
      house("classic", () => [
        node("garage", "appliance", 900, 300, { tag: "pv_inverter" }),
      ]),
      calibration,
    );
    const board = buildSwitchboardFromCircuits(plan, {
      mode: "classic",
      enclosures: ENCLOSURES,
    });
    const special = plan.circuits.filter(
      (circuit) =>
        circuit.tag === "ev_charger" ||
        circuit.tag === "heat_pump" ||
        circuit.tag === "pv_inverter",
    );
    expect(special).toHaveLength(3);
    for (const circuit of special)
      expect(
        board.rcdGroups.find((group) => group.circuitIds.includes(circuit.id))
          ?.type,
      ).toBe("B");
    // Synergie FVE + TČ + EV: SG Ready relé a elektroměr pro DLM; TOTAL STOP na přání
    const labels = board.devices.map((device) => device.label);
    expect(labels).toContain("SG Ready bezpotenciálové relé (FVE → TČ)");
    expect(labels).toContain(
      "Elektroměr 3f pro dynamické řízení zátěže (DLM) wallboxu",
    );
    expect(labels).not.toContain("Tlačítko TOTAL STOP / CENTRAL STOP");
    expect(
      buildSwitchboardFromCircuits(plan, {
        mode: "classic",
        enclosures: ENCLOSURES,
        centralStop: true,
      }).devices.map((d) => d.label),
    ).toContain("Tlačítko TOTAL STOP / CENTRAL STOP");
  });

  it("dvojzásuvka = 2 zásuvky do limitu 10 zásuvek na okruh B16 (přepínač)", () => {
    seq = 0;
    const plan: Floorplan = {
      mode: "classic",
      rooms: [{ id: "r", name: "Obývák" }],
      nodes: Array.from({ length: 6 }, (_, i) =>
        node("r", "double_socket", 100 + i * 30, 100),
      ),
    };
    const two = generateCircuitsFromFloorplan(
      plan,
      calibration,
    ).circuits.filter((c) => c.kind === "sockets");
    expect(two.map((c) => c.outlets)).toEqual([10, 2]);
    const one = generateCircuitsFromFloorplan(plan, calibration, {
      countDoubleAsTwo: false,
    }).circuits.filter((c) => c.kind === "sockets");
    expect(one.map((c) => c.outlets)).toEqual([6]);
  });
});

describe("tři úrovně architektury instalace", () => {
  const routeNodes = (plan: Floorplan): RouteNode[] =>
    plan.nodes.map((n) => ({
      id: n.id,
      x: n.px[0] * 10,
      y: n.px[1] * 10,
      heightMm: n.kind === "light" ? 2600 : n.kind === "switch" ? 1050 : 300,
      room: n.room,
    }));

  it("smart_retrofit: ke každému vypínači CYKY-J s vodičem N (nikdy CYKY-O) a krabice KPR 68 (65 mm)", () => {
    const plan = house("smart_retrofit", () => [
      node("kitchen", "switch", 120, 140),
      node("living", "switch", 420, 180),
    ]);
    const circuits = generateCircuitsFromFloorplan(plan, calibration);
    const lightIn = (room: string) =>
      plan.nodes.find((n) => n.room === room && n.kind === "light")!.id;
    const summary = summarizeCabling({
      circuits: circuits.circuits,
      nodes: routeNodes(plan),
      panel: { x: 500, y: 4000 },
      selected: "OPTIMIZED",
      installation: "smart_retrofit",
      switchLinks: [
        { switchId: "n17", lightId: lightIn("kitchen") },
        { switchId: "n18", lightId: lightIn("living"), cable: "CYKY-O 5×1,5" },
      ],
    });
    const cables = summary.byCable.map((row) => row.cable);
    expect(cables).toContain("CYKY-J 3×1,5");
    expect(cables).toContain("CYKY-J 5×1,5");
    expect(cables.some((cable) => cable.startsWith("CYKY-O"))).toBe(false);
    const bom = new Map(circuits.bom.map((entry) => [entry.item, entry.count]));
    // Ovládací místa: kuchyně 2, obývák 2 + 1 žaluzie, garáž 1 = 6 hlubokých krabic
    expect(bom.get(BOX_DEEP)).toBe(6);
    expect(bom.get(RETROFIT_MODULE)).toBe(1 + 3 + 1);
    expect(circuits.io.impulseRelays).toBe(0);
  });

  it("bus_loxone: hvězda světel do rozváděče, sběrnice 24 V DC, svorkovnice a RS-485 se 120 Ω", () => {
    const plan = house("bus_loxone", () => [
      node("kitchen", "switch", 120, 140),
    ]);
    const circuits = generateCircuitsFromFloorplan(plan, calibration);
    const bom = new Map(circuits.bom.map((entry) => [entry.item, entry.count]));
    expect(bom.get(BUS_TERMINALS)).toBeGreaterThanOrEqual(4);
    expect(bom.get(RS485_TERMINATOR)).toBe(2);
    const summary = summarizeCabling({
      circuits: circuits.circuits,
      nodes: routeNodes(plan),
      panel: { x: 500, y: 4000 },
      selected: "OPTIMIZED",
      installation: "bus_loxone",
      switchLinks: [{ switchId: "n17", lightId: "n11" }],
    });
    const cables = summary.byCable.map((row) => row.cable);
    expect(cables).toContain(STAR_LIGHT_CABLE);
    expect(cables).toContain(BUS_LEG_CABLE);
    // Hvězda = každé svítidlo vlastním kabelem: delší než řetěz klasiky
    const classic = summarizeCabling({
      circuits: circuits.circuits,
      nodes: routeNodes(plan),
      panel: { x: 500, y: 4000 },
      selected: "OPTIMIZED",
    });
    const lightsM = (s: typeof summary) =>
      s.circuits
        .filter((c) => c.label.startsWith("Světla"))
        .reduce((sum, c) => sum + c.lengthsM.OPTIMIZED, 0);
    expect(lightsM(summary)).toBeGreaterThan(lightsM(classic));
  });
});

describe("dimenzování vodičů (A1 / A2 / B2 / C) a impedance smyčky v teplém stavu", () => {
  it("Iz v tepelné izolaci: A2 → max. 10 A pro 1,5 mm², C → 16 A; 2,5 mm² v A2 = 18,5 A", () => {
    expect(
      maxBreakerFor({ crossSectionMm2: 1.5, method: "A2", phases: 1 }),
    ).toBe(10);
    expect(
      maxBreakerFor({ crossSectionMm2: 1.5, method: "A1", phases: 1 }),
    ).toBe(10);
    expect(
      maxBreakerFor({ crossSectionMm2: 1.5, method: "B2", phases: 1 }),
    ).toBe(10);
    expect(
      maxBreakerFor({ crossSectionMm2: 1.5, method: "C", phases: 1 }),
    ).toBe(16);
    expect(
      cableAmpacity({ crossSectionMm2: 1.5, method: "C", phases: 1 }),
    ).toBe(19.5);
    expect(
      cableAmpacity({ crossSectionMm2: 2.5, method: "C", phases: 1 }),
    ).toBe(27);
    expect(
      cableAmpacity({ crossSectionMm2: 2.5, method: "A2", phases: 1 }),
    ).toBe(18.5);
    expect(
      maxBreakerFor({ crossSectionMm2: 2.5, method: "A2", phases: 1 }),
    ).toBe(16);
    // Koordinace IB ≤ In ≤ Iz a I2 = 1,45 · In ≤ 1,45 · Iz
    expect(
      checkCoordination({
        designCurrentA: 8,
        ratedA: 16,
        crossSectionMm2: 1.5,
        method: "A2",
        phases: 1,
      }),
    ).toMatchObject({ ok: false, maxBreakerA: 10 });
    expect(
      checkCoordination({
        designCurrentA: 8,
        ratedA: 16,
        crossSectionMm2: 2.5,
        method: "C",
        phases: 1,
      }),
    ).toMatchObject({ ok: true, izA: 27, i2A: 23.2 });
  });

  it("souběh kabelů v izolaci: Iz klesne pod 16 A → zásuvkový okruh dostane 4 mm² (alternativa 13 A)", () => {
    expect(
      cableAmpacity({
        crossSectionMm2: 2.5,
        method: "A2",
        phases: 1,
        groupedCables: 2,
      }),
    ).toBe(14.8);
    seq = 0;
    const plan: Floorplan = {
      mode: "classic",
      rooms: [{ id: "r", name: "Pokoj" }],
      nodes: [node("r", "single_socket", 100, 400)],
    };
    const result = generateCircuitsFromFloorplan(plan, calibration, {
      installMethod: "A2",
      groupedCables: 2,
    });
    const sockets = result.circuits.find((c) => c.kind === "sockets")!;
    expect(sockets.crossSectionMm2).toBe(4);
    expect(sockets.cable).toBe("CYKY-J 3x4");
    expect(result.warnings.join(" ")).toMatch(
      /Iz 14,8 A v uložení A2 \(souběh 2 kabelů\) < In 16 A – alternativa: jistič 13 A/,
    );
  });

  it("impedance smyčky: Zsm ≤ 2·U0 / (3·Ia) a Ik,min = 0,8·U0 / (1,5·Zs) ≥ Ia", () => {
    const short = loopImpedanceCheck({
      lengthMm: 20_000,
      crossSectionMm2: 2.5,
      ratedA: 16,
      curve: "B",
    });
    expect(short.iaA).toBe(80);
    expect(short.zsMaxOhm).toBeCloseTo((2 * 230) / (3 * 80), 3);
    expect(short.zsOhm).toBeCloseTo(0.3 + (2 * 20 * 0.0178) / 2.5, 3);
    expect(short.ok).toBe(true);
    const long = loopImpedanceCheck({
      lengthMm: 100_000,
      crossSectionMm2: 1.5,
      ratedA: 10,
      curve: "B",
    });
    expect(long.ikMinA).toBeLessThan(long.iaA);
    expect(long.ok).toBe(false);
    // Generátor zvětší průřez dlouhé trasy, až smyčka vyhoví
    seq = 0;
    const far = calibrateFloorplanScale({
      walls: [{ px: [0, 0, 1000, 0], lengthMm: 100_000 }],
      panelPx: [0, 0],
    });
    const plan: Floorplan = {
      mode: "classic",
      rooms: [{ id: "r", name: "Dílna" }],
      nodes: [node("r", "light", 900, 0), node("r", "light", 950, 0)],
    };
    const lighting = generateCircuitsFromFloorplan(plan, far).circuits.filter(
      (c) => c.kind === "lighting",
    );
    expect(lighting.every((c) => c.crossSectionMm2 > 1.5 && c.loop.ok)).toBe(
      true,
    );
  });
});

describe("elektro-linter: typ chráničů a oddělení světel", () => {
  let id = 0;
  const device = (partial: Partial<LintDevice>): LintDevice => ({
    id: String(++id),
    designation: `-F${id}`,
    dinRailIndex: 1,
    positionOnRail: id,
    modulesWidth: 1,
    category: "MCB",
    poles: "1P",
    ratedCurrentA: 16,
    manufacturer: "ABB",
    typeCode: null,
    label: "",
    parentItemId: null,
    config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }),
    ...partial,
  });

  it("chránič AC → oprava na typ A, světla se zásuvkami → RCBO, Wallbox za typ A → typ B", () => {
    const rcd = device({
      designation: "-FI1",
      category: "RCD",
      poles: "4P",
      modulesWidth: 4,
      ratedCurrentA: 40,
      config: {
        ...defaultConfig("RCD", { manufacturer: "ABB", modules: 4 }),
        rcdType: "AC",
      },
    });
    const light = device({
      label: "Světla – kuchyně",
      ratedCurrentA: 10,
      parentItemId: rcd.id,
    });
    const socket = device({ label: "Zásuvky – kuchyně", parentItemId: rcd.id });
    const wallbox = device({
      label: "Wallbox EV",
      parentItemId: rcd.id,
      poles: "3P",
      modulesWidth: 3,
    });
    const issues = validateSwitchboardState({
      devices: [rcd, light, socket, wallbox],
      capacities: [36],
    });

    const ac = issues.find((issue) => issue.rule === "rcd-type-ac")!;
    expect(ac.message).toBe(
      "Chránič -FI1 je typu AC – dle ČSN 33 2130 ed. 4 musí být u koncových obvodů s elektronikou a LED osvětlením použit typ A (příp. B/F).",
    );
    expect(ac.fix).toMatchObject({
      kind: "configure",
      itemId: rcd.id,
      config: { rcdType: "A" },
      label: "Opravit 1 klikem: Přepnout na Typ A",
    });

    const mixed = issues.find((issue) => issue.rule === "rcd-lighting-mixed")!;
    expect(mixed.message).toContain(
      "nesmí světla viset na společném chrániči se zásuvkami",
    );
    expect(mixed.fix).toMatchObject({
      kind: "configure-many",
      label: "Opravit 1 klikem: Oddělit světla na RCBO / samostatný chránič",
      items: [
        {
          itemId: light.id,
          config: {
            category: "RCBO",
            rcdType: "A",
            rcdSensitivityMa: 30,
            ratedCurrentA: 10,
          },
        },
      ],
    });

    const typeB = issues.find((issue) => issue.rule === "rcd-type-b")!;
    expect(typeB.message).toMatch(
      /Okruh Wallbox \/ TČ \/ FVE .* vyžadován chránič typu B nebo F\./,
    );
    expect(typeB.fix).toMatchObject({
      kind: "configure",
      config: { rcdType: "B" },
    });

    // Po opravě (typ B, světla mimo chránič) už nic z toho
    const fixed = validateSwitchboardState({
      devices: [
        { ...rcd, config: { ...rcd.config!, rcdType: "B" } },
        { ...light, category: "RCBO" },
        socket,
        wallbox,
      ],
      capacities: [36],
    });
    expect(
      fixed.filter((issue) =>
        ["rcd-type-ac", "rcd-lighting-mixed", "rcd-type-b"].includes(
          issue.rule,
        ),
      ),
    ).toEqual([]);
  });
});

describe("dokumentace, revize a paleta", () => {
  it("protokol o určení vnějších vlivů (15 vlivů) a legislativní rámec", () => {
    const indoor = externalInfluencesProtocol("INDOOR_DRY");
    expect(indoor.rows.map((row) => row.code)).toEqual([
      "AA",
      "AB",
      "AC",
      "AD",
      "AE",
      "AF",
      "AG",
      "AH",
      "AN",
      "BA",
      "BC",
      "BD",
      "BE",
      "CA",
      "CB",
    ]);
    expect(indoor.requiredIp).toBe("IP 20");
    const timber = externalInfluencesProtocol("TIMBER");
    expect(timber.rows.find((row) => row.code === "CA")?.value).toBe("CA2");
    expect(timber.construction.join(" ")).toMatch(/ROFLEX.*V4A|V4A/);
    expect(externalInfluencesProtocol("OUTDOOR")).toMatchObject({
      requiredIp: "IP 54",
      requiredIk: "IK 07",
    });
    expect(LEGAL_FRAMEWORK.join(" ")).toMatch(/131\/2024 Sb\..*D\.2\.5/);
    expect(LEGAL_FRAMEWORK.join(" ")).toContain(
      "Nařízení vlády č. 190/2022 Sb.",
    );
    expect(isFlushEnclosure("Rozvodnice pod omítku 3×12M")).toBe(true);
    // Stavební detaily dřevostavby i do kusovníku návrhu
    seq = 0;
    const plan: Floorplan = {
      mode: "classic",
      rooms: [{ id: "r", name: "Pokoj" }],
      nodes: [node("r", "single_socket", 100, 400)],
    };
    expect(
      generateCircuitsFromFloorplan(plan, calibration, {
        environment: "TIMBER",
      })
        .bom.map((entry) => entry.item)
        .join(" "),
    ).toMatch(/Vzduchotěsná membránová.*ROFLEX.*KEZ_KB.*V4A/);
  });

  it("zkoušky RCD dle ČSN EN 61557-6 ed. 2 a Zsm ≤ ⅔ · Zs,max", () => {
    expect(maxMeasuredLoopOhm(16, "B")).toBeCloseTo((2 / 3) * (230 / 80), 3);
    expect(sanitizeRcdTest({ ratedMa: 30, type: "A" })).toBeNull();
    const test = sanitizeRcdTest({
      ratedMa: 30,
      type: "A",
      noTripAtHalf: true,
      tripTimeMs: 24,
      tripCurrentMa: 21,
      loopOhm: 0.62,
      breakerA: 16,
      breakerCurve: "B",
    })!;
    expect(parseRcdTest(JSON.stringify(test))).toEqual(test);
    const rows = rcdTestRows(test);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.ok)).toBe(true);
    expect(rows[2].limit).toBe("10,5–42 mA");
    expect(
      rcdTestRows({ ...test, noTripAtHalf: false, tripTimeMs: 320 })
        .slice(0, 2)
        .map((row) => row.ok),
    ).toEqual([false, false]);
  });

  it("paleta: přesná katalogová řazení ABB a nákres s úrovní instalace", () => {
    const symbols = PALETTE.map((item) => item.fixedSwitchNo);
    for (const no of [
      "1So",
      "1S",
      "1SSo",
      "1+1",
      "6+6",
      "6+6/0",
      "7So",
      "1/0",
      "1/0So",
      "5",
    ])
      expect(symbols).toContain(no);
    expect(PALETTE.find((item) => item.tag === "pv_inverter")).toBeTruthy();
    const draft = parseDraft({
      ...emptyDraft(),
      installation: "smart_retrofit",
      installMethod: "A2",
      groupedCables: 3,
      countDoubleAsTwo: false,
    });
    expect(draft).toMatchObject({
      installation: "smart_retrofit",
      installMethod: "A2",
      groupedCables: 3,
      countDoubleAsTwo: false,
    });
    expect(
      parseDraft({
        ...emptyDraft(),
        installation: "smart_relay",
        installMethod: "X",
      }),
    ).toMatchObject({
      installation: "classic",
      installMethod: "C",
      countDoubleAsTwo: true,
    });
  });
});
