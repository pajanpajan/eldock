import { describe, expect, it } from "vitest";

import {
  cableAmpacityOf,
  checkCable,
  designCurrents,
  groupFactor,
  kwToAmps,
  parseAmps,
  simulateAddedLoad,
  tabulatedAmpacity,
  temperatureFactor,
  voltageDrop3f,
  type FeederCable,
  type PowerCableNode,
} from "./cable-sizing";
import {
  arrheniusHours,
  assessComponent,
  hoursPerDay,
  operatingHours,
  type ComponentInput,
} from "./component-lifespan";

// Fáze 53: prediktivní životnost součástek a zatížení kabelových tras (ČSN 33 2000-5-52 ed. 2).

const NOW = new Date("2026-11-05T08:00:00Z");
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

const base: ComponentInput = {
  wearCategory: "SWITCHING_CONTACTOR",
  installedAt: NOW,
  cyclesPerHour: null,
  manualCyclesOffset: 0,
  maxElectricalCycles: null,
  maxOperatingHours: null,
  maxCalendarMonths: null,
  replacementStockCount: 1,
};

describe("životnost součástek", () => {
  it("odpracované hodiny a cykly ze směnnosti (1 směna 2 000 h/rok … 24/7 8 760 h/rok)", () => {
    expect(hoursPerDay(1)).toBeCloseTo(5.48, 2);
    expect(hoursPerDay(2)).toBeCloseTo(10.96, 2);
    expect(hoursPerDay(3)).toBeCloseTo(16.44, 2);
    expect(hoursPerDay(4)).toBe(24);
    expect(operatingHours(daysAgo(365), NOW, 3)).toBe(6000);
    // Stykač: offset z čítače PLC + hodiny × sepnutí za hodinu
    const contactor = assessComponent(
      {
        ...base,
        installedAt: daysAgo(365),
        cyclesPerHour: 100,
        manualCyclesOffset: 50_000,
        maxElectricalCycles: 1_000_000,
      },
      { shiftRegime: 2, internalTempC: null },
      NOW,
    );
    expect(contactor.totalCycles).toBe(50_000 + 4000 * 100);
    expect(contactor.wearPercent).toBe(45);
    expect(contactor.status).toBe("OK");
  });

  it("Arrhenius: +10 °C nad 40 °C = poloviční životnost (50 000 h při 48 °C ≈ 28 700 h)", () => {
    expect(arrheniusHours(50_000, 40)).toBe(50_000);
    expect(arrheniusHours(50_000, 35)).toBe(50_000);
    expect(arrheniusHours(50_000, 50)).toBe(25_000);
    expect(arrheniusHours(50_000, 48)).toBe(28_717);
    const psu = assessComponent(
      {
        ...base,
        wearCategory: "POWER_ELECTRONICS",
        maxOperatingHours: 50_000,
        replacementStockCount: 0,
        installedAt: daysAgo((0.97 * 28_717) / hoursPerDay(2)),
      },
      { shiftRegime: 2, internalTempC: 48 },
      NOW,
    );
    expect(psu.thermalDerating).toEqual({
      fromHours: 50_000,
      toHours: 28_717,
      tempC: 48,
    });
    expect(psu.wearPercent).toBeCloseTo(97, 0);
    expect(psu.status).toBe("CRITICAL_EXPIRED");
    expect(psu.missingStock).toBe(true);
    // Stejný zdroj v chladném rozváděči bez korekce
    expect(
      assessComponent(
        {
          ...base,
          wearCategory: "POWER_ELECTRONICS",
          maxOperatingHours: 50_000,
          installedAt: NOW,
        },
        { shiftRegime: 2, internalTempC: 30 },
        NOW,
      ).thermalDerating,
    ).toBeNull();
  });

  it("B10d a doba mise T_M bezpečnostního prvku – rozhoduje nejhorší limit; stavy 75 % / 95 % / 90 dní", () => {
    const safety = assessComponent(
      {
        ...base,
        wearCategory: "SAFETY_ELEMENT",
        cyclesPerHour: 20,
        maxElectricalCycles: 1_000_000,
        maxCalendarMonths: 240,
        installedAt: daysAgo(21_000 / hoursPerDay(3)),
      },
      { shiftRegime: 3, internalTempC: null },
      NOW,
    );
    expect(safety.limits.map((limit) => limit.kind)).toEqual([
      "cycles",
      "calendar",
    ]);
    expect(safety.wearPercent).toBeCloseTo(42, 0);
    expect(safety.status).toBe("OK");
    // Doba mise vypršela, i když cyklů je málo
    const expired = assessComponent(
      {
        ...base,
        wearCategory: "SAFETY_ELEMENT",
        cyclesPerHour: 1,
        maxElectricalCycles: 1_000_000,
        maxCalendarMonths: 240,
        installedAt: daysAgo(365 * 21),
      },
      { shiftRegime: 1, internalTempC: null },
      NOW,
    );
    expect(
      expired.limits.find((limit) => limit.kind === "calendar")!.percent,
    ).toBeGreaterThan(100);
    expect(expired.status).toBe("CRITICAL_EXPIRED");
    // 94 % = naplánovat výměnu (do ~30 dní), filtr po 8 z 6 měsíců = kritický
    const k1 = assessComponent(
      {
        ...base,
        cyclesPerHour: 120,
        maxElectricalCycles: 1_000_000,
        installedAt: daysAgo(940_000 / 120 / hoursPerDay(3)),
      },
      { shiftRegime: 3, internalTempC: null },
      NOW,
    );
    expect(k1.status).toBe("PLAN_REPLACEMENT");
    expect(k1.remainingDays).toBeGreaterThan(25);
    expect(k1.remainingDays).toBeLessThan(35);
    const filter = assessComponent(
      {
        ...base,
        wearCategory: "COOLING_FAN_FILTER",
        maxCalendarMonths: 6,
        installedAt: daysAgo(243),
      },
      { shiftRegime: 2, internalTempC: null },
      NOW,
    );
    expect(filter.status).toBe("CRITICAL_EXPIRED");
    // Málo času (< 90 dní) i pod 75 %
    const soon = assessComponent(
      {
        ...base,
        wearCategory: "COOLING_FAN_FILTER",
        maxCalendarMonths: 12,
        installedAt: daysAgo(300),
      },
      { shiftRegime: 2, internalTempC: null },
      NOW,
    );
    expect(soon.wearPercent).toBeLessThan(85);
    expect(soon.status).toBe("PLAN_REPLACEMENT");
  });
});

const cnc: FeederCable = {
  cableType: "CYKY-J",
  material: "CU",
  crossSectionMm2: 50,
  parallelRuns: 1,
  lengthM: 48,
  method: "E",
  groupingCount: 6,
  ambientTempC: 35,
  upstreamBreakerA: 125,
};

describe("zatížení kabelů dle ČSN 33 2000-5-52 ed. 2", () => {
  it("Iz = Itab · paralelní běhy · k_temp · k_group", () => {
    expect(
      tabulatedAmpacity({
        crossSectionMm2: 50,
        method: "E",
        material: "CU",
        insulation: "PVC",
      }),
    ).toBe(153);
    expect(
      tabulatedAmpacity({
        crossSectionMm2: 240,
        method: "E",
        material: "CU",
        insulation: "XLPE",
      }),
    ).toBe(538);
    expect(
      tabulatedAmpacity({
        crossSectionMm2: 50,
        method: "E",
        material: "AL",
        insulation: "PVC",
      }),
    ).toBeCloseTo(119.3, 1);
    expect(temperatureFactor(35, "PVC", "E")).toBe(0.94);
    expect(temperatureFactor(38, "PVC", "E")).toBe(0.87); // na stranu bezpečnosti
    expect([1, 2, 3, 4, 5, 6, 8, 9, 20].map(groupFactor)).toEqual([
      1, 0.88, 0.82, 0.77, 0.77, 0.73, 0.73, 0.7, 0.7,
    ]);
    expect(cableAmpacityOf(cnc).iz).toBeCloseTo(153 * 0.94 * 0.73, 0);
    const backbone = cableAmpacityOf({
      ...cnc,
      cableType: "1-CXKH-R",
      crossSectionMm2: 240,
      parallelRuns: 3,
      groupingCount: 1,
      ambientTempC: 30,
    });
    expect(backbone.iz).toBe(1614);
  });

  it("detekce In > Iz (nejištěný kabel), vytížení, ΔU a doporučený průřez", () => {
    const result = checkCable(cnc, 82);
    expect(result.protectedOk).toBe(false);
    expect(result.status).toBe("CRITICAL");
    expect(result.messages[0]).toMatch(
      /^🔴 NEJIŠTĚNÝ KABEL: Jistič In \(125 A\) je vyšší než skutečná zatížitelnost kabelu Iz \(105 A po korekci seskupením a teplotou\)!$/,
    );
    expect(result.recommendedMm2).toBe(70);
    expect(result.voltageDropPct).toBe(voltageDrop3f(82, 48, 50, 1, "CU"));
    expect(voltageDrop3f(100, 100, 25, 1, "CU")).toBeCloseTo(
      ((Math.sqrt(3) * 100 * 100 * 0.0225) / 25 / 400) * 100,
      2,
    );
    // Nízká rezerva (≥ 75 % Iz) = varování, jinak v pořádku
    const lis = checkCable(
      {
        ...cnc,
        crossSectionMm2: 120,
        lengthM: 65,
        groupingCount: 7,
        ambientTempC: 38,
        upstreamBreakerA: 160,
      },
      138,
    );
    expect(lis.status).toBe("WARNING");
    expect(lis.messages[0]).toMatch(/^🟡 Vytížení 78,\d % Iz/);
    expect(checkCable({ ...cnc, upstreamBreakerA: 100 }, 50).status).toBe("OK");
    // Dlouhá trasa: úbytek nad 5 %
    expect(
      checkCable(
        {
          ...cnc,
          upstreamBreakerA: 63,
          lengthM: 600,
          crossSectionMm2: 16,
          groupingCount: 1,
        },
        60,
      ).messages.join(" "),
    ).toMatch(/Úbytek napětí/);
  });

  it("simulátor nového stroje: přírůstek kaskádou R-CNC-04 → RM1 → TR1 se soudobostí 0,8", () => {
    const nodes: PowerCableNode[] = [
      {
        id: "tr1",
        tag: "TR1",
        parentId: null,
        nominalCurrentA: null,
        measuredCurrentA: null,
        ratedCurrentA: parseAmps("1443 A"),
        cable: null,
      },
      {
        id: "rm1",
        tag: "RM1",
        parentId: "tr1",
        nominalCurrentA: null,
        measuredCurrentA: 980,
        cable: {
          ...cnc,
          cableType: "1-CXKH-R",
          crossSectionMm2: 240,
          parallelRuns: 3,
          lengthM: 18,
          groupingCount: 1,
          ambientTempC: 30,
          upstreamBreakerA: 1600,
        },
      },
      {
        id: "cnc",
        tag: "R-CNC-04",
        parentId: "rm1",
        nominalCurrentA: 82,
        measuredCurrentA: null,
        cable: cnc,
      },
      {
        id: "m",
        tag: "CNC-04",
        parentId: "cnc",
        nominalCurrentA: 50,
        measuredCurrentA: null,
        cable: null,
      },
    ];
    expect(parseAmps("1 443 A")).toBe(1443);
    // Naměřený proud má přednost, jinak součet podřízených × 0,8, jinak jmenovitý
    const currents = designCurrents(nodes);
    expect(currents.get("rm1")).toBe(980);
    expect(currents.get("cnc")).toBe(40);
    expect(currents.get("tr1")).toBe(784);

    const amps = kwToAmps(30);
    expect(amps).toBeCloseTo(48.1, 1);
    const rows = simulateAddedLoad(nodes, "cnc", 80);
    expect(rows.map((row) => [row.tag, row.kind])).toEqual([
      ["R-CNC-04", "cable"],
      ["RM1", "cable"],
      ["TR1", "source"],
    ]);
    expect(rows[0]).toMatchObject({
      beforeA: 40,
      afterA: 120,
      status: "CRITICAL",
      recommendedMm2: 70,
    });
    expect(rows[1].afterA).toBe(980 + 64);
    expect(rows[1].status).toBe("OK");
    expect(rows[2].afterA).toBeCloseTo(784 + 51.2, 1);
    // Velký stroj: páteř RM1 na 95 % Iz (nízká rezerva), ještě větší ji přetíží
    expect(
      simulateAddedLoad(nodes, "cnc", 700).find((row) => row.tag === "RM1")
        ?.status,
    ).toBe("WARNING");
    expect(
      simulateAddedLoad(nodes, "cnc", 900).find((row) => row.tag === "RM1")
        ?.status,
    ).toBe("CRITICAL");
  });
});
