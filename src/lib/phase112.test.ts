import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSwitchboardFromCircuits } from "@/engine/floorplan-bridge";
import { combLabel, combRuns, nextCombSetting, parseCombSettings, phaseBadges, type CombDevice } from "@/lib/panel-builder/comb-busbars";
import { wireHarnessList, type CncInput } from "@/lib/panel-builder/cnc-manufacturing-engine";
import { DEFAULT_TURNKEY_CONFIG } from "@/lib/panel-builder/turnkey-manufacturing";
import { analyzeDraft, emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { BLANKING_TITLE, blankCoverFor, blankingPartsRow, blankingPlan, freeModules, hdoContactorFor, hdoControlOf, hdoDefault, hdoEnabled, usedModules } from "@/lib/panel-builder/hdo";
import { layoutAfterRailRemoved, layoutAfterRailSwap, parseRailLayout, serializeRailLayout, SINGLE_LAYOUT, withComb } from "@/lib/panel-builder/rail-layout";
import { orthoLinkPath, switchLinkPath } from "@/lib/panel-builder/switch-links";
import { legendFor, titleBlockRows, versionLabel } from "@/lib/panel-builder/title-block";

import { spdPayload } from "./credits";
import { OfflineSyncQueue, isNetworkError, memoryBlobs, memoryStorage, offlineLabel, sendOrQueue, type QueueEntry } from "./offline-sync-queue";
import { DEFAULT_OPERATOR, footerLine, labelCountOf, operatorSchema, parseLabelSets, parseOperator, priceWithVat, registryLines, withOperator } from "./operator";
import { circuitsFromRevision, crossSectionOf } from "./revision-board";
import { detectKind, fieldOfHeader, parseMeasurement, parseProtection, parseRevisionRows, parseXmlRecords, revisionTemplateCsv, rowsFromText } from "./revision-import";

// Fáze 112: hřebeny a fáze L1/L2/L3, stykač HDO a záslepky, pravoúhlé vazby vypínačů s rohovým razítkem ČSN EN ISO 7200
// a legendou, import revizních dat (Metrel / Sonel / Fluke / Chauvin Arnoux / Illko), offline fronta Scan & Snap,
// QR platba SPD a údaje provozovatele.

afterEach(() => vi.unstubAllGlobals());

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

function house(extra: EditorElement[]): FloorplanDraft {
  const rooms = [
    { id: "m1", name: "Technická místnost", x: 0, y: 0, w: 4000, h: 3000 },
    { id: "m2", name: "Garáž", x: 4000, y: 0, w: 6000, h: 3000 },
  ];
  return { ...emptyDraft(), rooms, elements: [el("rh", "panel", 300, 1500, "Technická místnost"), el("z1", "socket", 2000, 100, "Technická místnost"), ...extra] };
}

describe("fáze 112 – stykač HDO, záslepky a drátovací list", () => {
  it("výchozí HDO: bojler, tepelné čerpadlo a akumulace ano, wallbox jen na přání; stykač podle fází a jističe", () => {
    expect(["boiler", "heat_pump", "storage_heater"].every(hdoDefault)).toBe(true);
    expect(hdoDefault("ev_charger")).toBe(false);
    expect(hdoEnabled("ev_charger", true)).toBe(true);
    expect(hdoEnabled("boiler", false)).toBe(false);
    expect(hdoEnabled("oven", true)).toBe(false);
    expect(hdoContactorFor(1, 16)).toMatchObject({ typeCode: "ESB20-20N-06", articleNumber: "1SBE121111R0620", poles: "2P", modules: 1, verified: true });
    expect(hdoContactorFor(1, 25)).toMatchObject({ typeCode: "ESB25-40N-06", articleNumber: "1SAE231111R0640" });
    expect(hdoContactorFor(3, 16)).toMatchObject({ typeCode: "ESB25-40N-06", poles: "4P", modules: 2 });
    expect(hdoContactorFor(3, 32)).toMatchObject({ typeCode: "ESB40-40N-06", articleNumber: null, verified: false });
    expect(hdoContactorFor(3, 80)).toBeNull();
    expect(hdoControlOf(JSON.stringify({ category: "CONTACTOR", hdoControl: "-F21" }))).toBe("-F21");
    expect(hdoControlOf(JSON.stringify({ hdoControl: "drop table" }))).toBeNull();
  });

  it("bojler a TČ z půdorysu: instalační stykač za jističem okruhu a ovládací jistič B6 HDO; wallbox bez HDO nemá stykač", () => {
    const draft = house([el("bo", "boiler", 1000, 2900, "Technická místnost"), el("tc", "heat-pump", 3000, 2900, "Technická místnost"), el("ev", "wallbox", 8000, 2900, "Garáž")]);
    const analysis = analyzeDraft(draft);
    const byTag = new Map(analysis.circuits.circuits.map((circuit) => [circuit.tag, circuit]));
    expect(byTag.get("boiler")?.hdo).toBe(true);
    expect(byTag.get("heat_pump")?.hdo).toBe(true);
    expect(byTag.get("ev_charger")?.hdo).toBeUndefined();
    const board = buildSwitchboardFromCircuits(analysis.circuits, { mode: "classic", enclosures: [] });
    const control = board.devices.find((device) => device.label.startsWith("Ovládání HDO"))!;
    expect(control).toMatchObject({ category: "MCB", poles: "1P", ratedA: 6, parentKey: "main" });
    const contactors = board.devices.filter((device) => device.category === "CONTACTOR");
    expect(contactors).toHaveLength(2);
    const boilerBreaker = board.devices.find((device) => device.circuitId === byTag.get("boiler")!.id)!;
    const boilerContactor = contactors.find((device) => device.parentKey === boilerBreaker.key)!;
    expect(boilerContactor).toMatchObject({ designation: "-KM1", poles: "2P", label: expect.stringMatching(/^Stykač HDO – Bojler/) });
    expect(boilerContactor.config.hdoControl).toBe(control.designation);
    expect(boilerContactor.article?.articleNumber).toBe("1SBE121111R0620");
    expect(contactors.find((device) => device.label.includes("Tepelné čerpadlo"))?.poles).toBe("4P");
    // Wallbox s ručně zapnutým HDO stykač dostane
    const withEv = analyzeDraft(house([el("ev", "wallbox", 8000, 2900, "Garáž", { hdo: true })]));
    expect(buildSwitchboardFromCircuits(withEv.circuits, { mode: "classic", enclosures: [] }).devices.some((device) => device.category === "CONTACTOR")).toBe(true);
  });

  it("drátovací list: ovládací jistič → kontakt přijímače HDO → cívka A1, A2 na N", () => {
    const input: CncInput = {
      name: "RD",
      enclosure: { manufacturer: "ABB", model: "Mistral41W", rows: 2, modulesPerRow: 12, widthMm: 330, heightMm: 450, depthMm: 120, installation: "SURFACE" },
      devices: [
        { id: "q", designation: "-Q1", category: "MAIN_SWITCH", poles: "3P", modules: 3, ratedCurrentA: 40, rail: 1, position: 0, parentId: null },
        { id: "f", designation: "-F1", category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 16, rail: 1, position: 3, parentId: "q" },
        { id: "k", designation: "-KM1", category: "CONTACTOR", poles: "2P", modules: 1, ratedCurrentA: 20, rail: 1, position: 4, parentId: "f", coilFrom: "-F2" },
        { id: "h", designation: "-F2", category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 6, rail: 1, position: 5, parentId: "q" },
      ],
      supplyCable: "CYKY-J 5×10",
      busCables: 0,
      ...DEFAULT_TURNKEY_CONFIG,
    } as unknown as CncInput;
    const rows = wireHarnessList(input);
    expect(rows.some((row) => row.from.startsWith("-F2") && row.to.startsWith("Přijímač HDO"))).toBe(true);
    expect(rows.some((row) => row.from.startsWith("Přijímač HDO") && row.to === "-KM1 : A1")).toBe(true);
    expect(rows.some((row) => row.from === "-KM1 : A2" && row.to.startsWith("Sběrnice N"))).toBe(true);
  });

  it("záslepky: volné moduly všech lišt → dělitelné záslepky 12M, číslo jen z katalogu výrobce skříně", () => {
    const used = usedModules([{ dinRailIndex: 1, modulesWidth: 10 }, { dinRailIndex: 2, modulesWidth: 12 }, { dinRailIndex: 3, modulesWidth: 11 }], 3);
    expect(used).toEqual([10, 12, 11]);
    expect(freeModules([12, 12, 24], used)).toBe(15);
    expect(freeModules([12], [13])).toBe(0);
    const plan = blankingPlan(15)!;
    expect(plan).toMatchObject({ freeModules: 15, strips: 2, stripModules: 12, cover: null });
    expect(blankingPlan(0)).toBeNull();
    const row = blankingPartsRow(plan)!;
    expect(row).toMatchObject({ articleNumber: "–", quantity: 2, typeCode: "záslepka 12M – dle katalogu výrobce skříně" });
    expect(row.description).toContain(BLANKING_TITLE);
    expect(row.description).toContain("Celkem 15 volných modulů → 2 × záslepka 12M (dělitelná)");
    // Klíč externí databáze není objednací číslo výrobce
    const covers = [{ manufacturer: "Hager", typeCode: "Záslepka 12 modulů", articleNumber: "HAGER:S35S", modulesCount: 12 }, { manufacturer: "Hager", typeCode: "Krycí pás 18M", articleNumber: "S35X18", modulesCount: 18 }];
    expect(blankCoverFor("ABB", covers)).toBeNull();
    expect(blankCoverFor("Hager", covers)?.articleNumber).toBe("S35X18");
    expect(blankingPartsRow(blankingPlan(20, blankCoverFor("Hager", covers)))).toMatchObject({ articleNumber: "S35X18", quantity: 2, manufacturer: "Hager" });
  });
});

describe("fáze 112 – hřebeny a fáze L1 / L2 / L3", () => {
  const device = (id: string, position: number, patch: Partial<CombDevice> = {}): CombDevice => ({ id, designation: `-${id.toUpperCase()}`, dinRailIndex: 1, positionOnRail: position, modulesWidth: 1, category: "MCB", poles: "1P", phaseAssignment: null, ...patch });
  const devices = [device("fi1", 1, { category: "RCD", poles: "4P", modulesWidth: 4 }), device("f1", 2), device("f2", 3), device("f3", 4), device("f4", 5), device("f5", 6, { poles: "3P", modulesWidth: 3 }), device("x", 7, { category: "MCB" })];
  const nodes = [...devices.map((row) => ({ id: row.id, parentItemId: row.id === "fi1" || row.id === "x" ? null : "fi1" }))];

  it("3f hřeben pod 4P chráničem: jističe L1, L2, L3, L1 podle pozice, 3P jistič L1+L2+L3, přiřazená fáze má přednost", () => {
    const runs = combRuns(devices, nodes);
    expect(runs).toEqual([{ rail: 1, ids: ["fi1", "f1", "f2", "f3", "f4", "f5"], kind: "3F", conductors: ["L1", "L2", "L3", "N"], input: false }]);
    expect(combLabel(runs[0])).toBe("Hřeben 3f · L1 L2 L3 N");
    const badges = phaseBadges(devices, runs);
    expect(Object.fromEntries(badges)).toMatchObject({ f1: "L1", f2: "L2", f3: "L3", f4: "L1", f5: "L1+L2+L3" });
    const assigned = phaseBadges(devices.map((row) => (row.id === "f1" ? { ...row, phaseAssignment: "L3" } : row)), runs);
    expect(assigned.get("f1")).toBe("L3");
  });

  it("volba lišty: Vyp skryje hřeben, 1f / 3f přebije druh; 1f soustava = L1; nastavení se ukládá v uspořádání lišt", () => {
    expect(combRuns(devices, nodes, { 1: "OFF" })).toEqual([]);
    expect(combRuns(devices, nodes, { 1: "1F" })[0]).toMatchObject({ kind: "1F", conductors: ["L", "N"] });
    expect(phaseBadges(devices, combRuns(devices, nodes, {}, 1), 1).get("f2")).toBe("L1");
    expect(nextCombSetting("AUTO")).toBe("3F");
    expect(nextCombSetting("OFF")).toBe("AUTO");
    expect(parseCombSettings({ 1: "OFF", 2: "AUTO", 99: "3F", x: "1F" })).toEqual({ 1: "OFF" });
    const layout = withComb(SINGLE_LAYOUT, 2, "1F", 3);
    expect(parseRailLayout(serializeRailLayout(layout), 3).combs).toEqual({ 2: "1F" });
    expect(layoutAfterRailSwap(layout, 2, 3, 3).combs).toEqual({ 3: "1F" });
    expect(layoutAfterRailRemoved(layout, 1, 3).combs).toEqual({ 1: "1F" });
    expect(withComb(layout, 2, "AUTO", 3).combs).toBeUndefined();
  });

  it("řada jističochráničů se společným napájením = hřeben na vstupu", () => {
    const rcbo = [device("a", 1, { category: "RCBO", poles: "1P+N", modulesWidth: 2 }), device("b", 2, { category: "RCBO", poles: "1P+N", modulesWidth: 2 })];
    const runs = combRuns(rcbo, rcbo.map((row) => ({ id: row.id, parentItemId: "q1" })));
    expect(runs[0]).toMatchObject({ kind: "3F", input: true, conductors: ["L1", "L2", "L3"] });
  });
});

describe("fáze 112 – vazby vypínačů, rohové razítko ČSN EN ISO 7200 a legenda", () => {
  it("pravoúhlá CAD vazba: L se zaobleným rohem podél delší osy, skoro rovná = úsečka; přímé / skryté", () => {
    expect(orthoLinkPath({ x: 0, y: 0 }, { x: 4000, y: 1000 }, 400)).toBe("M 0 0 H 3600 Q 4000 0 4000 400 V 1000");
    expect(orthoLinkPath({ x: 0, y: 0 }, { x: 500, y: -3000 }, 400)).toBe("M 0 0 V -2750 Q 0 -3000 250 -3000 H 500");
    expect(orthoLinkPath({ x: 0, y: 0 }, { x: 4000, y: 30 }, 400)).toBe("M 0 0 L 4000 30");
    expect(switchLinkPath("straight", { x: 0, y: 0 }, { x: 10, y: 20 }, 4)).toBe("M 0 0 L 10 20");
    expect(switchLinkPath("hidden", { x: 0, y: 0 }, { x: 10, y: 20 }, 4)).toBeNull();
  });

  it("razítko: projektant z firemního razítka, investor, název výkresu, stupeň DPS / DSPS, měřítko, datum a verze", () => {
    const rows = titleBlockRows({ stamp: { name: "Elektro Tester s.r.o.", ico: "12345679", address: "Dlouhá 5, 466 01 Jablonec nad Nisou", contact: "Jan Tester", phone: "+420 603 000 111", authorization: "E-1234/2025" }, author: "Elektro Tester s.r.o.", investor: "Rodina Nováků", site: "Jablonec nad Nisou", project: "RD 4+kk", floorName: "1. NP", stage: "DSPS", scale: 50, paper: "A3", date: "13. 11. 2026", version: "1.1", number: "E-01", projectCode: "FP-001" });
    const value = (label: string) => rows.find((row) => row.label === label)?.value;
    expect(value("Projektant / Montážní firma")).toBe("Elektro Tester s.r.o. · IČO 12345679 · Dlouhá 5, 466 01 Jablonec nad Nisou");
    expect(value("Název výkresu")).toBe("2D Půdorys elektroinstalace – 1. NP");
    expect(value("Stupeň")).toBe("DSPS – Skutečné provedení stavby");
    expect(value("Měřítko · formát")).toBe("1 : 50 · A3");
    expect(value("Číslo verze · č. výkresu")).toBe("v1.1 · E-01 · FP-001");
    expect(versionLabel("")).toBe("v1.0");
    expect(versionLabel("v2")).toBe("v2.0");
  });

  it("legenda: jen druhy okruhů a kabely z výkresu (počty a metry)", () => {
    const legend = legendFor(
      [
        { layer: "sockets", cable: "CYKY-J 3x2,5", lengthM: 14.2, inBoard: false },
        { layer: "sockets", cable: "CYKY-J 3x2,5", lengthM: 10, inBoard: false },
        { layer: "lighting", cable: "CYKY-J 3x1,5", lengthM: 8.4, inBoard: false },
        { layer: "appliance", cable: "CYKY-J 5x2,5", lengthM: 0, inBoard: true },
      ],
      null,
    );
    expect(legend.layers.map((row) => [row.layer, row.circuits])).toEqual([
      ["sockets", 2],
      ["lighting", 1],
    ]);
    expect(legend.cables).toEqual([
      { cable: "CYKY-J 3x1,5", circuits: 1, meters: 8.4 },
      { cable: "CYKY-J 3x2,5", circuits: 2, meters: 24.2 },
    ]);
  });
});

describe("fáze 112 – import revizních dat", () => {
  it("Metrel ES Manager: hlavička, Riso nad rozsahem, Zs, tA v ms a S/N", () => {
    const rows = [
      ["Metrel ES Manager – Protokol: Rodinný dům", "", "", "", "", "", "", ""],
      ["Object", "Name", "Fuse", "Riso [MΩ]", "Zs (L-PE) [Ω]", "R low [Ω]", "t(IΔn) [ms]", "Serial No."],
      ["-F1", "Zásuvky kuchyň", "B16", "> 299,9 MΩ", "0,62 Ω", "", "", ""],
      ["-FI1", "Proudový chránič", "RCD 40A 30mA", "", "", "", "18 ms", ""],
      ["-F2", "Světla obývák", "B10", "1,2 GΩ", "810 mΩ", "", "0,021 s", ""],
    ];
    const table = parseRevisionRows(rows);
    expect(table.headers[0]).toBe("Object");
    expect(table.records).toHaveLength(3);
    expect(table.records[0]).toMatchObject({ designation: "-F1", protection: "B16", risoMOhm: 299.9, risoAbove: true, zsOhm: 0.62 });
    expect(table.records[1]).toMatchObject({ taMs: 18 });
    expect(table.records[2]).toMatchObject({ risoMOhm: 1200, zsOhm: 0.81, taMs: 21 });
    expect(table.kind).toBe("circuits");
    expect(table.source).toBe("Metrel ES Manager");
  });

  it("Sonel / PC Revize / Fluke DMS: sloupce, výsledek, datum a spotřebiče se S/N", () => {
    expect(fieldOfHeader("Nr fabryczny")).toBe("serial");
    expect(fieldOfHeader("Zabezpieczenie")).toBe("protection");
    expect(fieldOfHeader("Insulation (MΩ)")).toBe("riso");
    expect(fieldOfHeader("R1+R2")).toBe("rpe");
    expect(fieldOfHeader("Vybavovací čas")).toBe("ta");
    expect(fieldOfHeader("Impedance smyčky Zs")).toBe("zs");
    const table = parseRevisionRows([
      ["Označení", "Název", "Místnost", "RPE [Ω]", "Riso [MΩ]", "Výrobní číslo", "Výsledek", "Datum"],
      ["SP-0401", "Monitor Dell UltraSharp 27", "Kancelář 101", "0,08", ">200", "CN-0892K1-74210", "Vyhovuje", "12.03.2026"],
      ["SP-0402", "Prodlužovací přívod 5 zásuvek 3 m", "Kancelář 101", "0,45", "150", "PP-2026-0153", "Nevyhovuje", "12. 3. 2026"],
      ["Celkem", "", "", "", "", "", "", ""],
    ]);
    expect(table.kind).toBe("appliances");
    expect(table.records).toHaveLength(2);
    expect(table.records[0]).toMatchObject({ serialNumber: "CN-0892K1-74210", rpeOhm: 0.08, risoMOhm: 200, risoAbove: true, result: "PASS", location: "Kancelář 101" });
    expect(table.records[1]).toMatchObject({ result: "FAIL" });
    expect(table.records[1].date?.toISOString().slice(0, 10)).toBe("2026-03-12");
  });

  it("hodnoty a jištění z textu buněk", () => {
    expect(parseMeasurement("OL", "MΩ")).toEqual({ value: null, bound: "above" });
    expect(parseMeasurement("---", "Ω")).toEqual({ value: null, bound: null });
    expect(parseMeasurement("500 kΩ", "MΩ").value).toBe(0.5);
    expect(parseProtection("C 10 A")).toMatchObject({ device: "MCB", curve: "C", ratedA: 10, poles: "1P" });
    expect(parseProtection("3×B25")).toMatchObject({ device: "MCB", curve: "B", ratedA: 25, poles: "3P" });
    expect(parseProtection("OLE 16B/0,03")).toMatchObject({ device: "RCBO", curve: "B", ratedA: 16, sensitivityMa: 30 });
    expect(parseProtection("FI 40/0,03 A")).toMatchObject({ device: "RCD", ratedA: 40, sensitivityMa: 30 });
    expect(parseProtection("PV 25 gG")).toMatchObject({ device: "FUSE" });
    expect(detectKind([])).toBe("appliances");
  });

  it("XML export přístroje, text ze staré zprávy (PDF / Word) a šablona", () => {
    const xml = `<?xml version="1.0"?><Measurements><Measurement><Circuit>-F3</Circuit><Description>Pračka</Description><OCPD>B16</OCPD><Zs>0.71</Zs><Insulation>&gt;299.9</Insulation></Measurement><Measurement><Circuit>-F4</Circuit><Description>Myčka</Description><OCPD>B16</OCPD><Zs>0.69</Zs><Insulation>310</Insulation></Measurement></Measurements>`;
    const rows = parseXmlRecords(xml);
    expect(rows[0]).toEqual(["Circuit", "Description", "OCPD", "Zs", "Insulation"]);
    const table = parseRevisionRows(rows);
    expect(table.records.map((record) => [record.designation, record.zsOhm, record.risoMOhm])).toEqual([
      ["-F3", 0.71, 299.9],
      ["-F4", 0.69, 310],
    ]);
    expect(rowsFromText("Označení\tNázev\tJistič\tZs\n-F1\tZásuvky\tB16\t0,62\nPoznámka bez tabulky")).toEqual([
      ["Označení", "Název", "Jistič", "Zs"],
      ["-F1", "Zásuvky", "B16", "0,62"],
    ]);
    const template = revisionTemplateCsv();
    expect(template.startsWith("﻿Označení;Název;Místnost;Jistič / typ;Kabel;Riso [MΩ];Zs [Ω];RPE [Ω];tA [ms];S/N;Výsledek;Datum")).toBe(true);
    expect(parseRevisionRows(rowsFromText(template.replace(/;/g, "\t"))).records).toHaveLength(5);
  });

  it("okruhy z revize → okruhy generátoru rozváděče (jističe a jističochrániče, kabel, druh podle názvu)", () => {
    const table = parseRevisionRows([
      ["Označení", "Název", "Jistič / typ", "Kabel"],
      ["-F1", "Zásuvky kuchyň", "B16", "CYKY-J 3×2,5"],
      ["-F2", "Světla obývák", "B10", ""],
      ["-F3", "Varná deska", "3×B16", ""],
      ["-FA1", "Lednice", "OLE 16B/0,03", ""],
      ["-FI1", "Chránič", "RCD 40A 30mA", ""],
    ]);
    const circuits = circuitsFromRevision(table.records);
    expect(circuits.map((circuit) => [circuit.kind, circuit.phases, circuit.protection.device, circuit.protection.ratedA, circuit.cable])).toEqual([
      ["sockets", 1, "MCB", 16, "CYKY-J 3×2,5"],
      ["lighting", 1, "MCB", 10, "CYKY-J 3x1,5"],
      ["cooktop", 3, "MCB", 16, "CYKY-J 5x2,5"],
      ["dedicated", 1, "RCBO", 16, "CYKY-J 3x2,5"],
    ]);
    expect(circuits[3].rcd).toBe("own");
    expect(crossSectionOf("CYKY-J 5×4")).toBe(4);
    const board = buildSwitchboardFromCircuits({ circuits, io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 }, bom: [] }, { mode: "classic", enclosures: [] });
    expect(board.devices.filter((device) => device.category === "RCD").length).toBeGreaterThan(0);
    expect(board.devices.filter((device) => device.circuitId).length).toBe(4);
  });
});

describe("fáze 112 – offline fronta (Scan & Snap)", () => {
  const offlineError = () => Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });

  it("výpadek sítě: záznamy s fotkou zůstanou ve frontě, po obnovení se odešlou v pořadí a fotky se smažou", async () => {
    const storage = memoryStorage();
    const blobs = memoryBlobs();
    let id = 0;
    const queue = new OfflineSyncQueue({ storage, blobs, idFactory: () => `zaznam-${++id}` });
    const counts: number[] = [];
    queue.subscribe((count) => counts.push(count));
    await queue.enqueue("snap", { room: "Rozvodna -1" }, { photo: new Blob(["štítek"], { type: "image/jpeg" }) });
    await queue.enqueue("snap", { room: "Rozvodna -1" });
    expect(queue.count()).toBe(2);
    expect(blobs.size()).toBe(1);
    expect(offlineLabel(2)).toBe("📡 Offline režim – 2 záznamy čekají na odeslání");
    expect(offlineLabel(5)).toBe("📡 Offline režim – 5 záznamů čeká na odeslání");

    const offline = await queue.flush(async () => {
      throw offlineError();
    });
    expect(offline).toEqual({ sent: 0, dropped: 0, remaining: 2 });
    expect(queue.pending()[0]).toMatchObject({ attempts: 1, lastError: "Failed to fetch" });

    const sent: { id: string; photo: boolean }[] = [];
    const online = await queue.flush(async (entry: QueueEntry, files) => {
      sent.push({ id: entry.id, photo: Boolean(files.photo) });
      return "done";
    });
    expect(online).toEqual({ sent: 2, dropped: 0, remaining: 0 });
    expect(sent).toEqual([
      { id: "zaznam-1", photo: true },
      { id: "zaznam-2", photo: false },
    ]);
    expect(blobs.size()).toBe(0);
    expect(counts.at(-1)).toBe(0);
  });

  it("trvalé odmítnutí serverem záznam zahodí; sendOrQueue offline rovnou do fronty; automatická synchronizace po „online“", async () => {
    const queue = new OfflineSyncQueue({ storage: memoryStorage(), blobs: memoryBlobs() });
    await queue.enqueue("snap", {});
    expect(await queue.flush(async () => "drop")).toEqual({ sent: 0, dropped: 1, remaining: 0 });
    expect(isNetworkError(offlineError())).toBe(true);
    expect(isNetworkError(new Error("Neplatné patro"))).toBe(false);

    vi.stubGlobal("navigator", { onLine: false });
    const send = vi.fn(async () => ({ ok: true }));
    const outcome = await sendOrQueue(queue, "snap", { room: "Sklad" }, {}, send);
    expect(outcome.status).toBe("queued");
    expect(send).not.toHaveBeenCalled();
    expect(queue.count()).toBe(1);

    vi.stubGlobal("navigator", { onLine: true });
    const listeners = new Map<string, () => void>();
    const target = { addEventListener: (name: string, listener: () => void) => void listeners.set(name, listener), removeEventListener: (name: string) => void listeners.delete(name) } as unknown as Window;
    const received: string[] = [];
    const stop = queue.startAutoSync(async (entry) => {
      received.push(entry.id);
      return "done";
    }, target, 60_000);
    await vi.waitFor(() => expect(queue.count()).toBe(0));
    expect(received).toHaveLength(1);
    expect(listeners.has("online")).toBe(true);
    stop();
    expect(listeners.has("online")).toBe(false);

    // Online: okamžité odeslání se stejným id, chyba sítě = do fronty
    const failing = vi.fn(async () => {
      throw offlineError();
    });
    expect((await sendOrQueue(queue, "snap", { room: "Sklad" }, {}, failing)).status).toBe("queued");
    expect(failing).toHaveBeenCalledTimes(1);
    expect((await sendOrQueue(queue, "snap", { room: "Sklad" }, {}, send)).status).toBe("sent");
  });
});

describe("fáze 112 – QR platba SPD a údaje provozovatele", () => {
  it("platný český řetězec SPD*1.0*ACC:…*AM:…*CC:CZK*X-VS:… z IBAN provozovatele", () => {
    const payload = spdPayload({ iban: DEFAULT_OPERATOR.iban, bic: DEFAULT_OPERATOR.bic, amountCzk: priceWithVat(750, true), variableSymbol: "20260001", message: "ELDOCK Kredity Elektro Tester" });
    expect(payload).toMatch(/^SPD\*1\.0\*ACC:CZ\d{22}\+RZBCCZPP\*AM:908\.00\*CC:CZK\*X-VS:20260001\*MSG:/);
    expect(spdPayload({ iban: "CZ17 5500 0000 0009 1811 8002", amountCzk: 750, variableSymbol: "20260002", message: "QR stitky" })).toBe("SPD*1.0*ACC:CZ1755000000000918118002*AM:750.00*CC:CZK*X-VS:20260002*MSG:QR stitky");
    expect(() => spdPayload({ iban: "CZ00 1234", amountCzk: 1, variableSymbol: "1", message: "x" })).toThrow();
  });

  it("patička, registrační údaje, VOP a ceny neplátce DPH", () => {
    expect(footerLine(DEFAULT_OPERATOR)).toBe("ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz");
    expect(registryLines(DEFAULT_OPERATOR)).toEqual([]);
    const profile = parseOperator(JSON.stringify({ ...DEFAULT_OPERATOR, ico: "27082440", dic: "cz27082440", registry: "C 12345 vedená u KS v Ústí nad Labem", vatPayer: false, iban: "neplatný" }));
    expect(registryLines(profile)).toEqual(["IČO 27082440", "DIČ CZ27082440", "C 12345 vedená u KS v Ústí nad Labem"]);
    expect(profile.iban).toBe(DEFAULT_OPERATOR.iban);
    expect(withOperator("Provozovatelem je {{PROVOZOVATEL}}. Kontakt: {{EMAIL}}.", profile)).toBe("Provozovatelem je Pavel Janoušek, 466 01 Jablonec nad Nisou, IČO 27082440, DIČ CZ27082440, C 12345 vedená u KS v Ústí nad Labem, provozovatel webu ELDOCK.cz. Kontakt: info@eldock.cz.");
    expect(priceWithVat(750, true)).toBe(908);
    expect(priceWithVat(750, false)).toBe(750);
    expect(operatorSchema.safeParse({ ...DEFAULT_OPERATOR, ico: "12345678" }).success).toBe(false);
    expect(operatorSchema.safeParse({ ...DEFAULT_OPERATOR, dic: "12345678" }).success).toBe(false);
    expect(operatorSchema.safeParse({ ...DEFAULT_OPERATOR, ico: "27082440", dic: "CZ27082440" }).success).toBe(true);
    expect(parseLabelSets(JSON.stringify([{ title: "Sada 50", count: 50, priceExclVat: 690 }, { title: "chyba", count: 0, priceExclVat: 1 }]))).toEqual([{ title: "Sada 50", count: 50, priceExclVat: 690, code: "LABELS_50" }]);
    expect(labelCountOf("LABELS_50")).toBe(50);
    expect(labelCountOf("START_30")).toBeNull();
  });
});
