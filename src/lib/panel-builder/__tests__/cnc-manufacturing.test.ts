import { describe, expect, it } from "vitest";

import { BEND_RESERVE_MM, GLAND_HOLE_MM, cncLayout, glandFor, singleFerrule, twinFerrule, wireHarnessList, wireSection, type CncDevice, type CncInput } from "../cnc-manufacturing-engine";
import { CNC_LAYERS, cncCsv, cncOperations, generateManufacturingPackage } from "../cnc-outputs";
import { factoryTestIssues, factoryTestSchema, inspectionFromFactoryTest, orderNumber, routineTestFromFactory, turnkeyEstimate } from "../turnkey-manufacturing";

// Fáze 106: výrobní podklady rozváděče na klíč – CNC plán 1 : 1 (DXF s hladinami a CSV), vývodky podle kabelů,
// drátovací list vodičů (Odkud → Kam, průřez, barva, délka, TWIN dutinky, hřebeny) a výstupní kusová zkouška výrobce.

const device = (patch: Partial<CncDevice> & Pick<CncDevice, "id" | "designation">): CncDevice => ({ category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 16, rail: 1, position: 0, parentId: null, ...patch });

/** RD: hlavní vypínač 3P+N 40 A, 2 chrániče 4P 40 A (druhý smyčkou ze vstupu prvního), jističe za chrániči hřebenem. */
const input = (patch: Partial<CncInput> = {}): CncInput => ({
  name: "RD Novák",
  enclosure: { manufacturer: "ABB", model: "Mistral65 65P18X32A", rows: 3, modulesPerRow: 18, widthMm: 500, heightMm: 620, depthMm: 115, installation: "SURFACE", material: "PLASTIC" },
  devices: [
    device({ id: "q1", designation: "-Q1", category: "MAIN_SWITCH", poles: "3P+N", modules: 4, ratedCurrentA: 40 }),
    device({ id: "fv1", designation: "-FV1", category: "SPD", poles: "3P+N", modules: 4, ratedCurrentA: 25, position: 4, parentId: "q1" }),
    device({ id: "fa1", designation: "-FA1", category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, position: 8, parentId: "q1" }),
    device({ id: "fa2", designation: "-FA2", category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, position: 12, parentId: "q1" }),
    device({ id: "f1", designation: "-F1", ratedCurrentA: 10, rail: 2, position: 0, parentId: "fa1", cable: "CYKY-J 3×1,5", label: "Světla" }),
    device({ id: "f2", designation: "-F2", ratedCurrentA: 16, rail: 2, position: 1, parentId: "fa1", cable: "CYKY-J 3×2,5", label: "Zásuvky" }),
    device({ id: "f3", designation: "-F3", ratedCurrentA: 16, rail: 2, position: 2, parentId: "fa1", cable: "CYKY-J 3×2,5", label: "Kuchyně" }),
    device({ id: "f4", designation: "-F4", poles: "3P", modules: 3, ratedCurrentA: 16, rail: 3, position: 0, parentId: "fa2", cable: "CYKY-J 5×2,5", label: "Varná deska" }),
  ],
  supplyCable: "CYKY-J 5×10",
  busCables: 1,
  entry: "top",
  mounting: "surface",
  door: { centralStop: true, phaseLamps: true, meter: false, ventilation: false },
  ...patch,
});

describe("fáze 106 – CNC plán 1 : 1 a vývodky", () => {
  it("generateManufacturingPackage: platný DXF s CNC hladinami a strojový CSV souřadnic", () => {
    const pkg = generateManufacturingPackage(input());
    const dxf = String(pkg.files.find((file) => file.name === "1_CNC_Vrtaci_plan_1-1.dxf")!.content);
    expect(dxf.startsWith("999\r\nELDOCK - CNC vrtaci a frezovaci plan rozvadece, jednotky mm, meritko 1:1\r\n  0\r\nSECTION\r\n  2\r\nHEADER")).toBe(true);
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    for (const layer of CNC_LAYERS.map((entry) => entry.name)) expect(dxf, layer).toContain(`\r\n${layer}\r\n`);
    // Otvory M5 pro lišty (kružnice ve hladině vrtání) a otvory vývodek v čele
    expect(dxf).toMatch(/CIRCLE\r\n {2}8\r\n1_CNC_VRTANI_ZAVITY/);
    expect(dxf).toMatch(/CIRCLE\r\n {2}8\r\n3_CNC_VYVODKY_CELA/);
    const csv = String(pkg.files.find((file) => file.name === "1_CNC_Vrtaci_plan_1-1.csv")!.content);
    expect(csv.split("\r\n")[0]).toBe("﻿X_mm;Y_mm;Typ_operace;Prumer_nebo_Rozmer_mm;Hladina;Dil");
    expect(csv).toContain(";VRTANI_M5;Ø 4,2 / M5;1_CNC_VRTANI_ZAVITY;deska");
    expect(csv).toContain(";VYREZ_KRUH;Ø 22,5;2_CNC_VYREZY_DVERE;dvere");
    expect(csv).toContain(";VYVODKA_M32;Ø 32,5;3_CNC_VYVODKY_CELA;celo-horni");
    expect(pkg.summary.holes).toBeGreaterThan(10);
  });

  it("vývodky podle kabelů: přívod M32 / M40, 3f vývody M20 / M25, 1f a sběrnice M16 / M20; otvory Ø + 0,5 mm", () => {
    expect(glandFor("CYKY-J 3×1,5")).toBe("M16");
    expect(glandFor("CYKY-J 3×2,5")).toBe("M20");
    expect(glandFor("CYKY-J 5×2,5")).toBe("M20");
    expect(["M25"]).toContain(glandFor("CYKY-J 5×6"));
    expect(glandFor("J-Y(St)Y 2×2×0,8")).toBe("M16");
    expect(GLAND_HOLE_MM).toEqual({ M16: 16.5, M20: 20.5, M25: 25.5, M32: 32.5, M40: 40.5 });
    const layout = cncLayout(input());
    expect(layout.glands[0]).toMatchObject({ role: "supply", size: "M32", side: "top" });
    expect(cncLayout(input({ supplyCable: "CYKY-J 4×25" })).glands[0].size).toBe("M40");
    // Shora i zespodu: přívod nahoře, vývody dole; zapuštěná rozvodnice = membránová příruba bez otvorů vývodek
    const both = cncLayout(input({ entry: "both" }));
    expect(both.glands.filter((gland) => gland.role !== "supply").every((gland) => gland.side === "bottom")).toBe(true);
    const flush = generateManufacturingPackage(input({ mounting: "flush" }));
    expect(flush.layout.membrane).toBe(true);
    expect(cncOperations(flush.layout).some((op) => op.operation.startsWith("VYVODKA"))).toBe(false);
  });

  it("geometrie: DIN lišty TS 35 s otvory M5 na krajích, žlaby 40 × 60 mezi řadami a 25 × 60 po stranách, PE / N / N1 / N2, výřezy dveří", () => {
    const layout = cncLayout(input());
    expect(layout.rails).toHaveLength(3);
    for (const rail of layout.rails) {
      expect(rail.holes[0].x).toBeCloseTo(rail.x1 + 15, 1);
      expect(rail.holes[rail.holes.length - 1].x).toBeCloseTo(rail.x2 - 15, 1);
      expect(rail.holes.every((hole) => hole.thread === "M5" && hole.diameterMm === 4.2)).toBe(true);
    }
    expect(layout.ducts.filter((duct) => duct.size === "25×60")).toHaveLength(2);
    expect(layout.ducts.filter((duct) => duct.size === "40×60")).toHaveLength(4);
    expect(layout.bars.map((bar) => bar.name)).toEqual(["PE", "N", "N1", "N2"]);
    expect(layout.bars.flatMap((bar) => bar.holes).every((hole) => hole.thread === "M6" && hole.diameterMm === 5)).toBe(true);
    expect(layout.doorCutouts.map((cut) => cut.label)).toEqual(["Kontrolka L1", "Kontrolka L2", "Kontrolka L3", "CENTRAL STOP"]);
    expect(cncCsv(layout).split("\r\n").length).toBeGreaterThan(20);
  });
});

describe("fáze 106 – nářezový a drátovací list vodičů", () => {
  const wires = wireHarnessList(input());

  it("spojení Odkud → Kam s průřezem, barvou, délkou po žlabech a dutinkami", () => {
    const feed = wires.find((row) => row.from === "-Q1 : 2 (L1)" && row.to === "-FA1 : 1 (L1)")!;
    expect(feed).toMatchObject({ type: "H07V-K (CYA) 10 mm²", crossSectionMm2: 10, color: "Hnědá (L1)", endA: singleFerrule(10), kind: "wire" });
    expect(feed.lengthMm).toBeGreaterThan(BEND_RESERVE_MM);
    expect(feed.lengthMm % 5).toBe(0);
    expect(wires.find((row) => row.conductor === "N" && row.from.startsWith("-Q1"))).toMatchObject({ to: "Sběrnice N : Svorka 1", color: "Světle modrá (N)" });
    expect(wires.find((row) => row.from === "-FA1 : N-out")).toMatchObject({ to: "Sběrnice N1 : Svorka 1" });
    expect(wires.filter((row) => row.kind === "wire").every((row) => /^W\d{3}$/.test(row.no))).toBe(true);
    expect(wireSection(10)).toBe(1.5);
    expect(wireSection(16)).toBe(2.5);
    expect(wireSection(40)).toBe(10);
  });

  it("smyčka do dalšího chrániče = dvojitá TWIN dutinka na sdílené svorce", () => {
    const loop = wires.find((row) => row.from === "-FA1 : 1 (L1)" && row.to === "-FA2 : 1 (L1)")!;
    expect(loop.endA).toBe(twinFerrule(10));
    expect(wires.find((row) => row.to === "-FA1 : 1 (L1)")!.endB).toBe(twinFerrule(10));
  });

  it("jističe na jiné liště než jejich chránič = přenos vodiči (fáze 115: hřeben jen pod chráničem na téže liště), přepěťová ochrana na PE", () => {
    expect(wires.filter((row) => row.kind === "comb")).toHaveLength(0);
    // 3f chránič rozdělí 1P jističe na fáze L1, L2, L3
    expect(wires.find((row) => row.to === "-F1 : 1 (L1)")).toMatchObject({ from: "-FA1 : 2 (L1)" });
    expect(wires.find((row) => row.to === "-F2 : 1 (L2)")).toMatchObject({ from: "-FA1 : 4 (L2)" });
    expect(wires.find((row) => row.to === "-F3 : 1 (L3)")).toMatchObject({ from: "-FA1 : 6 (L3)" });
    expect(wires.find((row) => row.from.startsWith("-FV1") && row.to.startsWith("Sběrnice PE"))).toMatchObject({ color: "Zelenožlutá (PE)", crossSectionMm2: 16 });
  });
});

describe("fáze 106 – výroba na klíč", () => {
  it("číslo zakázky, kalkulace a výstupní kusová zkouška výrobce → měření pro Verzi 1.0", () => {
    expect(orderNumber(2026, 7)).toBe("VYR-2026-0007");
    expect(turnkeyEstimate({ materialCzk: 12000.4, laborCzk: 6500, laborHours: 10, missingPrices: 2 })).toMatchObject({ totalCzk: 12000 + 6500 + 1490, transportCzk: 1490, missingPrices: 2 });
    const test = factoryTestSchema.parse({ testerName: "Jan Výrobce", enclosureSerial: "SN-2026-15", measuredAt: "2026-11-12", insulationMOhm: 250, peContinuityOhm: 0.04, rcdTripCurrentMa: 22, rcdTripTimeMs: 24, torqueOk: true, wiringOk: true, checks: { ip: true, clearances: true, devices: true, circuits: true, terminals: true } });
    expect(factoryTestIssues(test)).toEqual([]);
    expect(inspectionFromFactoryTest(test, { name: "Rozváděče Liberec s.r.o.", ico: "12345678" })).toMatchObject({ inspectorName: "Jan Výrobce", verdict: "SAFE", mechanicalOk: true, insulationTestVoltage: 500 });
    const routine = routineTestFromFactory(test, { name: "Rozváděče Liberec s.r.o." });
    expect(Object.values(routine.points).every((point) => point === "PASS")).toBe(true);
    expect(factoryTestIssues({ ...test, peContinuityOhm: 0.5, torqueOk: false })).toHaveLength(2);
  });
});
