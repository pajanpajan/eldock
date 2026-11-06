import { describe, expect, it } from "vitest";

import { SMART_SYSTEMS, chooseModules, planSmartHome, smartSystemOf, type SmartLoad } from "./smart-home";

const loads = (role: SmartLoad["role"], count: number, powerW = 20): SmartLoad[] => Array.from({ length: count }, (_, i) => ({ id: `${role}${i}`, room: i < count / 2 ? "Obývák" : "Ložnice", role, powerW, label: `${role} ${i + 1}` }));

describe("fáze 61 – chytrá domácnost: akční členy podle zátěží", () => {
  it("nejmenší sestava modulů: 9 spínaných kanálů + rezerva → jeden 12násobný (12 M) místo 8 + 4", () => {
    const fah = smartSystemOf("abb_freeathome");
    const switches = fah.modules.filter((module) => module.role === "switch");
    expect(chooseModules(switches, 11).map((module) => module.typeCode)).toEqual(["SA-M-12.16.2.2"]);
    expect(chooseModules(switches, 5).map((module) => module.typeCode)).toEqual(["SA-M-8.16.2.2"]);
    expect(chooseModules(switches, 0)).toEqual([]);
  });

  it("ABB-free@home: spínací, stmívací, žaluziové a topné členy z katalogu 2026, zdroj 640 mA a SysAP; kanály po místnostech", () => {
    const plan = planSmartHome({ system: "abb_freeathome", loads: [...loads("switch", 9), ...loads("dim", 5, 60), ...loads("blind", 3), ...loads("heating", 4)], busDevices: 12 });
    const types = plan.modules.map((module) => module.typeCode);
    expect(types).toEqual(expect.arrayContaining(["SAP.3", "SA-M-12.16.2.2", "DA/M.6.210.2.1", "BA-M-4.230.1.1", "HA-M-0.6.1", "PS-M-64.1.1"]));
    expect(plan.modules.every((module) => module.verified && module.articleNumber)).toBe(true);
    expect(plan.channels.switch).toMatchObject({ needed: 11, available: 12 });
    const dimmer = plan.modules.find((module) => module.role === "dim")!;
    expect(dimmer.assigned.map((slot) => slot.load.room)).toEqual(["Ložnice", "Ložnice", "Obývák", "Obývák", "Obývák"]);
    expect(plan.busMa).toBe(plan.busDevices * 10);
    expect(plan.warnings).toEqual([]);
  });

  it("výkonné stmívané svítidlo zabere víc kanálů; KNX s IP rozhraním; Loxone využije výstupy Miniserveru", () => {
    const knx = planSmartHome({ system: "abb_knx", loads: [{ id: "big", room: "Obývák", role: "dim", powerW: 400, label: "Lustr" }], busDevices: 4 });
    expect(knx.warnings[0]).toMatch(/400 W překračuje 210 W na kanál – 2 kanály/);
    expect(knx.modules.map((module) => module.typeCode)).toEqual(expect.arrayContaining(["UD/S 4.210.2.1", "SV/S 30.640.5.1", "IPS/S 3.5.1"]));
    const lox = planSmartHome({ system: "loxone", loads: loads("switch", 6), busDevices: 10 });
    expect(lox.modules.map((module) => module.typeCode)).toEqual(["Miniserver", "24 V DC / 2,5 A"]);
    expect(lox.modules[0].assigned).toHaveLength(6);
    expect(SMART_SYSTEMS.map((system) => system.id)).toEqual(["abb_freeathome", "abb_knx", "loxone"]);
  });

  it("kontrola sběrnice: víc prvků než unese linie → další zdroj a varování", () => {
    const plan = planSmartHome({ system: "abb_freeathome", loads: loads("switch", 4), busDevices: 70 });
    expect(plan.modules.filter((module) => module.role === "psu")).toHaveLength(2);
    expect(plan.warnings.join(" ")).toMatch(/2 linie/);
  });
});
