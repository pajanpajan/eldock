import { describe, expect, it } from "vitest";

import { BLIND_CABLE, BLIND_DC_CABLE, HEAD_CABLE, SENSOR_CABLE, ledCableLabel } from "@/engine/cable-routing";
import { MAIN_BOARD, buildSwitchboardFromCircuits } from "@/engine/floorplan-bridge";

import { classicDeviceModules, fieldDemand, lightBadges, ledSupplyW } from "./field-devices";
import { isFrameable } from "./floorplan-frames";
import { analyzeDraft, applyLightOption, circuitsOfBoard, emptyDraft, isPairController, isPairTarget, lightControlOf, pairNoun, pairsWith, paletteItem, parseDraft, pwmChannels, type EditorElement, type EditorRoom, type FloorplanDraft, type LightSpec } from "./floorplan-editor";
import { ledSupplies } from "./smart-home";
import { smartPlanOf } from "./smart-home-plan";
import { circuitEntries } from "./route-display";
import { symbolParts } from "./symbol-parts";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (name: string, x: number, y: number, w: number, h: number): EditorRoom => ({ id: `m-${name}`, name, x, y, w, h });
const item = (id: string) => paletteItem(id)!;

/** Obývák s rozváděčem, žaluziovým spínačem a dvěma motory u oken, termostatem s hlavicemi a čidly. */
function house(installation: FloorplanDraft["installation"] = "classic", extra: EditorElement[] = []): FloorplanDraft {
  return {
    ...emptyDraft(),
    installation,
    rooms: [room("Obývák", 0, 0, 6000, 4000), room("Koupelna", 6000, 0, 3000, 4000)],
    elements: [
      el("rh", "panel", 300, 2000),
      el("z1", "socket", 2000, 0),
      el("l1", "ceiling-light", 3000, 2000),
      el("s1", installation === "bus_loxone" ? "bus-1" : "switch-1", 5800, 1000, { controls: ["l1"] }),
      el("bs", installation === "bus_loxone" ? "bus-blind" : "blind", 5800, 1400, { controls: ["m1", "m2"] }),
      el("m1", "blind-motor", 1500, 4000),
      el("m2", "blind-motor", 4500, 4000),
      el("t1", installation === "bus_loxone" ? "bus-smart-thermostat" : "smart-thermostat", 5800, 2500, { controls: ["h1", "h2"] }),
      el("h1", "heating-head", 1000, 3800),
      el("h2", "heating-head", 5000, 3800, { headDrive: "wireless" }),
      el("w1", "window-contact", 3000, 4000),
      el("v1", "water-sensor", 7500, 3800, { room: "Koupelna" }),
      ...extra,
    ],
  };
}

describe("fáze 77 – stínění, čidla, vytápění a párování", () => {
  it("paleta: ZAL_M 2450 mm, MAG 2100 mm, VOD 50 mm, TER_S 1400 mm (klasika i sběrnice), HLV 300 mm; LED pásek a bodové svítidlo", () => {
    expect(item("blind-motor")).toMatchObject({ symbol: "ZAL_M", kind: "blind_motor", heightMm: 2450, group: "shading" });
    expect(item("window-contact")).toMatchObject({ symbol: "MAG", sensor: "window", heightMm: 2100 });
    expect(item("water-sensor")).toMatchObject({ symbol: "VOD", sensor: "water", heightMm: 50 });
    expect(item("smart-thermostat")).toMatchObject({ symbol: "TER_S", control: "thermostat", heightMm: 1400 });
    expect(item("bus-smart-thermostat")).toMatchObject({ symbol: "TER_S", bus: { role: "room_unit" } });
    expect(item("heating-head")).toMatchObject({ symbol: "HLV", heatingHead: true, heightMm: 300 });
    expect(item("led-strip")).toMatchObject({ symbol: "LED_P", kind: "light", lightForm: "strip" });
    expect(item("spot-light")).toMatchObject({ symbol: "BOD", kind: "light", lightForm: "spot" });
    // Čidla a hlavice nejdou do víceramečku s vypínači
    expect(isFrameable({ item: "water-sensor" })).toBe(false);
    expect(isFrameable({ item: "heating-head" })).toBe(false);
    expect(isFrameable({ item: "smart-thermostat" })).toBe(true);
  });

  it("párování: vypínač ↔ světla, žaluziový spínač ↔ motory, termostat ↔ hlavice; čidla nic", () => {
    expect(pairsWith(item("switch-1"), item("ceiling-light"))).toBe(true);
    expect(pairsWith(item("switch-1"), item("blind-motor"))).toBe(false);
    expect(pairsWith(item("blind"), item("blind-motor"))).toBe(true);
    expect(pairsWith(item("bus-blind"), item("blind-motor"))).toBe(true);
    expect(pairsWith(item("smart-thermostat"), item("heating-head"))).toBe(true);
    expect(pairsWith(item("bus-room"), item("heating-head"))).toBe(true);
    expect(pairsWith(item("thermostat"), item("ceiling-light"))).toBe(false);
    expect(pairsWith(item("window-contact"), item("ceiling-light"))).toBe(false);
    expect(isPairController(item("heating-head"))).toBe(false);
    expect(isPairController(item("water-sensor"))).toBe(false);
    expect(isPairTarget(item("heating-head"))).toBe(true);
    expect(isPairTarget(item("blind-motor"))).toBe(true);
    expect(pairNoun(item("blind"), 2)).toBe("2 motory žaluzií");
    expect(pairNoun(item("smart-thermostat"), 5)).toBe("5 hlavic");
    expect(pairNoun(item("switch-1"), 1)).toBe("1 svítidlo");
  });

  it("pohon motoru a hlavice se uloží a načte; neznámá hodnota se zahodí", () => {
    const draft = house("classic", [el("m3", "blind-motor", 5500, 4000, { drive: "dc24" })]);
    const parsed = parseDraft(JSON.parse(JSON.stringify({ ...draft, elements: [...draft.elements, { ...el("m4", "blind-motor", 100, 4000), drive: "nonsense" }] })))!;
    expect(parsed.elements.find((element) => element.id === "m3")?.drive).toBe("dc24");
    expect(parsed.elements.find((element) => element.id === "m4")?.drive).toBeUndefined();
    expect(parsed.elements.find((element) => element.id === "h2")?.headDrive).toBe("wireless");
  });

  it("klasika: motory 230 V na žaluziovém okruhu B10 (chránič 30 mA), max. 8 motorů na okruh, ovládání ze spínače k motorům", () => {
    const motors = Array.from({ length: 8 }, (_, index) => el(`x${index}`, "blind-motor", 600 + index * 600, 0));
    const { circuits, build, summary } = analyzeDraft(house("classic", motors));
    const blinds = circuitsOfBoard(circuits, MAIN_BOARD).filter((circuit) => circuit.kind === "blinds");
    expect(blinds).toHaveLength(2);
    for (const circuit of blinds) {
      expect(circuit.protection).toMatchObject({ device: "MCB", poles: "1P", curve: "B", ratedA: 10 });
      expect(circuit.rcd).toBe("A30");
      expect(circuit.nodeIds.length).toBeLessThanOrEqual(8);
      expect(circuit.label).toMatch(/^Žaluzie – /);
    }
    expect(blinds.flatMap((circuit) => circuit.nodeIds).sort()).toEqual(["m1", "m2", ...motors.map((motor) => motor.id)].sort());
    // Ovládání: žaluziový spínač → spárované motory (L↑, L↓, N, PE)
    expect(build.controlRuns.filter((run) => run.kind === "blind")).toEqual([
      { id: "bs", kind: "blind", targetId: "m1" },
      { id: "bs", kind: "blind", targetId: "m2" },
    ]);
    expect(summary.byCable.some((row) => row.cable === BLIND_CABLE)).toBe(true);
  });

  it("sběrnice: jeden okruh B10 pro žaluziové aktory, motory hvězdou z rozváděče; pohon 24 V DC kabelem SYKFY / CAT7 s varováním", () => {
    const draft = house("bus_loxone", [el("m3", "blind-motor", 5500, 4000, { drive: "dc24" })]);
    const { circuits, build } = analyzeDraft(draft);
    const blinds = circuits.circuits.filter((circuit) => circuit.kind === "blinds");
    expect(blinds).toHaveLength(1);
    expect(blinds[0]).toMatchObject({ label: "Žaluzie – napájení žaluziových akčních členů (2 motorů)", nodeIds: [] });
    expect(circuits.warnings.some((warning) => warning.includes("1× pohon žaluzie 24 V DC"))).toBe(true);
    // Tlačítko je na sběrnici – žádný silový kabel od tlačítka k motoru
    expect(build.controlRuns.filter((run) => run.kind === "blind")).toEqual([]);
    const runs = Object.fromEntries(build.starRuns.map((run) => [run.id, run]));
    expect(runs.m1).toMatchObject({ cable: BLIND_CABLE, targetId: null });
    expect(runs.m3).toMatchObject({ cable: BLIND_DC_CABLE, targetId: null });
  });

  it("čidla na binární vstupy a hlavice: klasika od termostatu, sběrnice z rozváděče; bezdrátová hlavice bez kabelu", () => {
    const classic = analyzeDraft(house("classic")).build;
    const runs = Object.fromEntries(classic.starRuns.map((run) => [run.id, run]));
    expect(runs.w1).toMatchObject({ cable: SENSOR_CABLE, targetId: null });
    expect(runs.v1).toMatchObject({ cable: SENSOR_CABLE, targetId: null });
    expect(runs.h1).toMatchObject({ cable: HEAD_CABLE, targetId: "t1" });
    expect(runs.h2).toBeUndefined();
    const bus = Object.fromEntries(analyzeDraft(house("bus_loxone")).build.starRuns.map((run) => [run.id, run]));
    expect(bus.h1).toMatchObject({ cable: HEAD_CABLE, targetId: null });
    // Kabely jsou v souhrnu kabeláže
    const { summary } = analyzeDraft(house("classic"));
    expect(summary.byCable.find((row) => row.cable === SENSOR_CABLE)?.meters).toBeGreaterThan(0);
    expect(summary.byCable.find((row) => row.cable === HEAD_CABLE)?.meters).toBeGreaterThan(0);
  });
});

describe("fáze 77 – pokročilé osvětlení: stmívání, CCT, RGB(W), DALI a 24 V PWM", () => {
  const ceiling = item("ceiling-light");
  const strip = item("led-strip");
  const base: LightSpec = { dimmable: false, powerW: 20, load: "led" };

  it("technologie podle zadání: DALI zátěž = DALI, LED pásek výchozí 24 V PWM, jinak fázové; kanály PWM 1 / 2 / 3 / 4 / 5", () => {
    expect(lightControlOf({ light: base }, ceiling)).toBe("phase");
    expect(lightControlOf({ light: { ...base, load: "dali" } }, ceiling)).toBe("dali");
    expect(lightControlOf({}, strip)).toBe("pwm");
    expect([{}, { cct: true }, { color: "rgb" as const }, { color: "rgbw" as const }, { color: "rgb" as const, cct: true }].map((spec) => pwmChannels(spec))).toEqual([1, 2, 3, 4, 5]);
  });

  it("CCT / barva nejdou fázovým stmíváním – svítidlo přejde na DALI DT8, pásek na PWM; DALI zátěž přepne řízení a naopak", () => {
    expect(applyLightOption(base, { cct: true }, ceiling)).toEqual({ dimmable: true, powerW: 20, load: "dali", cct: true, control: "dali" });
    // LED pásek je ve výchozím stavu na 24 V PWM – barva technologii nemění
    const colored = applyLightOption(base, { color: "rgbw" }, strip);
    expect(colored).toEqual({ dimmable: true, powerW: 20, load: "led", color: "rgbw" });
    expect(lightControlOf({ light: colored }, strip)).toBe("pwm");
    // Pásek přepnutý na fázové stmívání se s barvou vrátí na PWM
    expect(applyLightOption({ ...base, control: "phase" }, { color: "rgb" }, strip)).toMatchObject({ control: "pwm", color: "rgb" });
    expect(applyLightOption(base, { load: "dali" }, ceiling)).toMatchObject({ load: "dali", control: "dali", dimmable: true });
    // Zpět z DALI zátěže na LED: řízení podle tvaru svítidla (fázové)
    const dali = applyLightOption(base, { load: "dali" }, ceiling);
    expect(applyLightOption(dali, { load: "led" }, ceiling)).toEqual({ dimmable: true, powerW: 20, load: "led" });
    // Barevné svítidlo nejde přepnout na fázové stmívání
    const rgb = applyLightOption(base, { color: "rgb" }, ceiling);
    expect(applyLightOption(rgb, { control: "phase" }, ceiling)).toMatchObject({ control: "dali", load: "dali", color: "rgb" });
    // Vypnutí barvy ponechá zvolenou technologii, ale ne prázdné příznaky
    expect(applyLightOption(rgb, { color: undefined }, ceiling)).not.toHaveProperty("color");
  });

  it("štítky u značky: DIM / CCT / RGBW a technologie DALI / 24V", () => {
    expect(lightBadges({ light: base }, ceiling)).toEqual([]);
    expect(lightBadges({ light: { ...base, dimmable: true } }, ceiling)).toEqual(["DIM"]);
    expect(lightBadges({ light: { ...base, cct: true, control: "dali", load: "dali" } }, ceiling)).toEqual(["DIM", "CCT", "DALI"]);
    expect(lightBadges({ light: { ...base, color: "rgbw" } }, strip)).toEqual(["DIM", "RGBW", "24V"]);
  });

  it("okruhy: DALI svítidla kabelem 5×1,5; PWM pásky mimo okruhy 230 V – zdroj 24 V s rezervou 20 % na vlastním B10, pásek kabelem ze zdroje", () => {
    const draft = house("classic", [
      el("d1", "ceiling-light", 1500, 1500, { light: { dimmable: true, powerW: 30, load: "dali", control: "dali" } }),
      el("p1", "led-strip", 2500, 3500, { light: { dimmable: true, powerW: 50, load: "led", color: "rgbw" } }),
      el("p2", "led-strip", 3500, 3500, { light: { dimmable: true, powerW: 40, load: "led", cct: true } }),
    ]);
    const { circuits, build } = analyzeDraft(draft);
    const lighting = circuits.circuits.filter((circuit) => circuit.kind === "lighting");
    const dali = lighting.find((circuit) => circuit.nodeIds.includes("d1"))!;
    expect(dali.label).toContain("(DALI)");
    expect(dali.cable).toBe("CYKY-J 5x1,5");
    expect(lighting.some((circuit) => circuit.nodeIds.includes("p1") || circuit.nodeIds.includes("p2"))).toBe(false);
    const psu = lighting.find((circuit) => circuit.label.startsWith("Zdroj 24 V DC – LED osvětlení"))!;
    expect(psu).toMatchObject({ nodeIds: [], installedW: 108, protection: { ratedA: 10, curve: "B" } });
    const runs = Object.fromEntries(build.starRuns.map((run) => [run.id, run]));
    expect(runs.p1.cable).toBe(ledCableLabel(5, "RGBW"));
    expect(runs.p2.cable).toBe(ledCableLabel(3, "CCT"));
    // Soupis okruhů: okruh zdroje je jen v rozváděči (bez trasy), ale v soupisu s jističem
    const entries = circuitEntries(analyzeDraft(draft));
    expect(entries.find((entry) => entry.label.startsWith("Zdroj 24 V DC – LED osvětlení"))).toMatchObject({ inBoard: true, lengthM: 0, layer: "lighting", board: "RH" });
    expect(entries.find((entry) => entry.id === dali.id)?.inBoard).toBeUndefined();
  });
});

describe("fáze 77 – moduly do rozváděče", () => {
  it("klasika: DALI jednotka, zdroj LED podle příkonu + 20 %, řadiče PWM po 4 kanálech, hlídač zaplavení a ventil do kusovníku", () => {
    const draft = house("classic", [
      el("d1", "ceiling-light", 1500, 1500, { light: { dimmable: true, powerW: 30, load: "dali", control: "dali" } }),
      el("p1", "led-strip", 2500, 3500, { light: { dimmable: true, powerW: 50, load: "led", color: "rgbw" } }),
      el("p2", "led-strip", 3500, 3500, { light: { dimmable: true, powerW: 40, load: "led", cct: true } }),
      el("m3", "blind-motor", 5500, 4000, { drive: "dc24" }),
    ]);
    const demand = fieldDemand(draft);
    expect(demand.pwm.map((light) => light.channels)).toEqual([4, 2]);
    expect(demand.heads).toEqual([
      { id: "h1", room: "Obývák", wireless: false },
      { id: "h2", room: "Obývák", wireless: true },
    ]);
    expect(ledSupplyW(demand)).toBe(108);
    const { modules, warnings } = classicDeviceModules(demand);
    expect(modules.map((module) => module.role)).toEqual(["dali", "psu_led", "pwm", "pwm", "input", "valve"]);
    // 108 W → zdroj 150 W (60 / 100 nestačí)
    expect(modules.find((module) => module.role === "psu_led")?.typeCode).toBe("HDR-150-24");
    expect(modules.find((module) => module.role === "valve")?.modules).toBe(0);
    expect(warnings.some((warning) => warning.includes("6 kanálů PWM"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("pohon žaluzie 24 V DC"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("okenní / dveřní kontakt"))).toBe(true);
    // Na lištu rozváděče: moduly se šířkou, ventil bez šířky do kusovníku
    const { circuits } = analyzeDraft(draft);
    const board = buildSwitchboardFromCircuits({ circuits: circuitsOfBoard(circuits, MAIN_BOARD), io: circuits.io, bom: circuits.bom }, { mode: "classic", enclosures: [], devices: modules });
    expect(board.devices.filter((device) => device.category === "PSU").map((device) => device.article?.typeCode)).toEqual(["HDR-150-24"]);
    expect(board.devices.filter((device) => device.article?.typeCode === "PWM 4× 24 V DC")).toHaveLength(2);
    expect(board.bom.some((row) => row.item.startsWith("Elektromagnetický ventil"))).toBe(true);
  });

  it("zdroje LED: nejmenší dostačující, nad 150 W víc zdrojů", () => {
    expect(ledSupplies(0)).toEqual([]);
    expect(ledSupplies(60).map((unit) => unit.typeCode)).toEqual(["HDR-60-24"]);
    expect(ledSupplies(61).map((unit) => unit.typeCode)).toEqual(["HDR-100-24"]);
    expect(ledSupplies(320).map((unit) => unit.typeCode)).toEqual(["HDR-150-24", "HDR-150-24", "HDR-150-24"]);
  });

  it("sběrnice: kanály PWM podle barvy, zdroj LED, motory a hlavice po kusech, čidla na binární vstupy, výstup pro uzávěr vody", () => {
    for (const system of ["loxone", "abb_knx", "abb_fah"]) {
      const draft = { ...house("bus_loxone", [el("p1", "led-strip", 2500, 3500, { light: { dimmable: true, powerW: 50, load: "led", color: "rgbw" } })]), smartSystem: system };
      const plan = smartPlanOf(draft)!;
      expect(plan.channels.pwm.needed).toBeGreaterThanOrEqual(5);
      expect(plan.channels.pwm.available).toBeGreaterThanOrEqual(4);
      // Zakreslené motory: 2 kanály (ne podle žaluziových tlačítek)
      expect(plan.channels.blind.needed).toBeGreaterThanOrEqual(2);
      expect(plan.channels.blind.needed).toBeLessThanOrEqual(3);
      // Bezdrátová hlavice nezabírá kanál akčního členu
      expect(plan.channels.heating.needed).toBe(2);
      // MAG + VOD = 2 binární vstupy (s rezervou)
      expect(plan.channels.input.needed).toBeGreaterThanOrEqual(3);
      expect(plan.ledSupplyW).toBe(60);
      expect(plan.modules.some((module) => module.role === "psu_led" && module.typeCode === "HDR-60-24")).toBe(true);
      expect(plan.modules.some((module) => module.role === "pwm")).toBe(true);
      expect(plan.modules.some((module) => module.role === "input")).toBe(true);
      expect(plan.modules.flatMap((module) => module.assigned).some((slot) => slot.load.id === "valve-water")).toBe(true);
    }
  });
});

describe("fáze 77 – značky ČSN EN 60617", () => {
  it("motor žaluzie Ⓜ s nožičkou ke stěně, kontakt, čidlo vody, hlavice ventilem, TER_S, LED pásek a bodové svítidlo", () => {
    expect(symbolParts(item("blind-motor"), 300)).toMatchObject({ kind: "blind_motor", label: "ZAL_M" });
    expect(symbolParts(item("blind-motor"), 300).texts.map((text) => text.value)).toEqual(["M"]);
    expect(symbolParts(item("window-contact"), 300)).toMatchObject({ kind: "sensor", label: "MAG" });
    expect(symbolParts(item("water-sensor"), 300)).toMatchObject({ kind: "sensor", label: "VOD" });
    expect(symbolParts(item("heating-head"), 300)).toMatchObject({ kind: "valve", label: "HLV" });
    expect(symbolParts(item("smart-thermostat"), 300).label).toBe("TER_S");
    expect(symbolParts(item("bus-smart-thermostat"), 300).label).toBe("BUS TER_S");
    expect(symbolParts(item("thermostat"), 300).label).toBe("TER");
    expect(symbolParts(item("led-strip"), 300)).toMatchObject({ kind: "light", label: "LED_P" });
    expect(symbolParts(item("spot-light"), 300)).toMatchObject({ kind: "light", label: "BOD" });
  });
});
