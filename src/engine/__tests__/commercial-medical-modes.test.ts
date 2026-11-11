import { describe, expect, it } from "vitest";

import { buildSwitchboardFromCircuits, type Switchboard } from "@/engine/floorplan-bridge";
import { defaultValidityMonths } from "@/lib/inspection";
import { INSPECTION_PRESETS, inPreset, presetById } from "@/lib/inspection-presets";
import { inspectionRuleFor, isLightCard } from "@/lib/inspection-rules";
import { externalInfluencesProtocol } from "@/lib/panel-builder/external-influences";
import { analyzeDraft, emptyDraft, paletteFor, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { applyNormFix, ekvHeightAt, floorplanNorms } from "@/lib/panel-builder/floorplan-norms";
import { validateSwitchboardState, type LintDevice } from "@/lib/panel-builder/linter";
import { compileBoxUsage } from "@/lib/panel-builder/mounting-boxes-catalog";
import { BD4_FIX_LABEL, CENTRAL_STOP_LABEL, HF_DATA_CABLE, MEDICAL_SPLIT_FIX, MEDICAL_SPLIT_MESSAGE, MID_METER_LABEL, halogenFreeCable, legalFrameworkFor } from "@/lib/panel-builder/occupancy";
import { circuitEntries } from "@/lib/panel-builder/route-display";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { POWER_BACKUP_TIERS, backupSummary, effectiveTiers, matchesTenant, type BackupNode } from "@/lib/power-backup";

// Fáze 93: obchodní centrum / prostor pro veřejnost (BD4, ČSN 33 2000-7-718) a zdravotnický prostor Skupiny 1
// (ČSN 33 2000-7-710 ed. 2) – kabely, krabice, linter, okruhy A / B, zálohování napájení areálu a Kniha revizí.

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

/** Prodejna nájemní jednotky: rozváděč, 3 světla s vypínačem, 4 zásuvky a datová zásuvka. */
const shop = (extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({
  ...emptyDraft(),
  rooms: [{ id: "m1", name: "Prodejna", x: 0, y: 0, w: 8000, h: 6000 }],
  elements: [
    el("rh", "panel", 0, 3000, "Prodejna"),
    el("l1", "ceiling-light", 2000, 2000, "Prodejna"),
    el("l2", "ceiling-light", 4000, 2000, "Prodejna"),
    el("l3", "ceiling-light", 6000, 2000, "Prodejna"),
    el("s1", "switch-1", 500, 0, "Prodejna", { controls: ["l1", "l2", "l3"] }),
    el("z1", "socket", 1500, 0, "Prodejna"),
    el("z2", "double-socket", 4000, 0, "Prodejna"),
    el("z3", "socket", 7000, 6000, "Prodejna"),
    el("z4", "double-socket", 3000, 6000, "Prodejna"),
    el("d1", "data-socket", 5000, 0, "Prodejna"),
  ],
  occupancy: "COMMERCIAL_BD4",
  ...extra,
});

/** Ordinace s lůžkovou rampou LUZ, lehátkem a 2 světly + čekárna se zásuvkami. */
const clinic = (extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({
  ...emptyDraft(),
  rooms: [
    { id: "m1", name: "Ordinace 1", x: 0, y: 0, w: 5000, h: 4000 },
    { id: "m2", name: "Čekárna", x: 5000, y: 0, w: 4000, h: 4000 },
  ],
  elements: [
    el("rh", "panel", 5000, 2000, "Čekárna"),
    el("luz", "bed-ramp", 2000, 0, "Ordinace 1"),
    el("leh", "arch-exam-bed", 2000, 600, "Ordinace 1"),
    el("o1", "double-socket", 500, 4000, "Ordinace 1"),
    el("o2", "double-socket", 4000, 4000, "Ordinace 1"),
    el("ol1", "ceiling-light", 1500, 2000, "Ordinace 1"),
    el("ol2", "ceiling-light", 3500, 2000, "Ordinace 1"),
    el("c1", "double-socket", 7000, 0, "Čekárna"),
    el("c2", "socket", 8000, 4000, "Čekárna"),
    el("cl1", "ceiling-light", 7000, 2000, "Čekárna"),
  ],
  occupancy: "MEDICAL_G1",
  ...extra,
});

/** Přístroje vygenerovaného rozváděče jako vstup Elektro-linteru (strom podle klíčů přístrojů). */
const lintOf = (board: Switchboard): LintDevice[] =>
  board.rails.flatMap((rail) =>
    rail.devices.map((device, index) => ({
      id: device.key,
      designation: device.designation,
      dinRailIndex: rail.index,
      positionOnRail: index + 1,
      modulesWidth: device.modules,
      category: device.category,
      poles: device.poles,
      ratedCurrentA: device.ratedA,
      manufacturer: null,
      typeCode: null,
      label: device.label,
      parentItemId: device.parentKey,
      config: device.config,
    })),
  );

const device = (id: string, patch: Partial<LintDevice>): LintDevice => ({ id, designation: `-${id}`, dinRailIndex: 1, positionOnRail: 1, modulesWidth: 1, category: "MCB", poles: "1P", ratedCurrentA: 16, manufacturer: "ABB", typeCode: null, label: "", parentItemId: null, config: null, ...patch });
/** Rozváděč: hlavní vypínač, jeden společný chránič 4P a zásuvkové okruhy pod ním. */
const sharedRcdBoard = (labels: readonly string[], rcd: { type?: string; ma?: number } = {}): LintDevice[] => [
  device("Q1", { category: "MAIN_SWITCH", poles: "3P", modulesWidth: 3, ratedCurrentA: 40, label: "Hlavní vypínač", positionOnRail: 1, config: { category: "MAIN_SWITCH", manufacturer: "ABB", poles: "3P", modules: 3, ratedCurrentA: 40 } }),
  device("FI1", { category: "RCD", poles: "4P", modulesWidth: 4, ratedCurrentA: 40, label: "Proudový chránič 30 mA", positionOnRail: 2, parentItemId: "Q1", config: { category: "RCD", manufacturer: "ABB", poles: "4P", modules: 4, ratedCurrentA: 40, rcdType: rcd.type ?? "A", rcdSensitivityMa: rcd.ma ?? 30 } }),
  ...labels.map((label, index) =>
    device(`F${index + 1}`, { label, positionOnRail: 3 + index, parentItemId: "FI1", config: { category: "MCB", manufacturer: "ABB", poles: "1P", modules: 1, ratedCurrentA: 16, curve: "B", breakingCapacityKa: 6 } }),
  ),
];

describe("fáze 93 – obchodní centrum BD4 (ČSN 33 2000-7-718)", () => {
  it("převod kabelů na bezhalogenové B2ca: CYKY-J / CYKY-O, sběrnice a data", () => {
    expect(halogenFreeCable("CYKY-J 3×1,5")).toBe("1-CHKE-R (N2XH-J) 3×1,5 B2ca-s1,d1,a1");
    expect(halogenFreeCable("CYKY-O 3×1,5")).toBe("1-CHKE-R (N2XH-O) 3×1,5 B2ca-s1,d1,a1");
    expect(halogenFreeCable("CYKY-J 5x2,5")).toBe("1-CHKE-R (N2XH-J) 5×2,5 B2ca-s1,d1,a1");
    expect(halogenFreeCable("CYKY-J 5×10")).toBe("1-CHKE-R (N2XH-J) 5×10 B2ca-s1,d1,a1");
    expect(halogenFreeCable("CAT7 / KNX J-Y(St)Y 2×2×0,8 (sběrnice 24 V DC)")).toBe("J-H(St)H 2×2×0,8 B2ca (sběrnice 24 V DC)");
    expect(halogenFreeCable("UTP Cat6")).toBe(HF_DATA_CABLE);
    // Už bezhalogenový kabel se nemění
    expect(halogenFreeCable("1-CHKE-R (N2XH-J) 3×1,5 B2ca-s1,d1,a1")).toBe("1-CHKE-R (N2XH-J) 3×1,5 B2ca-s1,d1,a1");
  });

  it("půdorys v BD4: všechny okruhy, výkaz kabeláže, svody k vypínači i datové trasy bez CYKY a UTP", () => {
    const analysis = analyzeDraft(shop());
    expect(analysis.circuits.circuits.length).toBeGreaterThan(2);
    for (const circuit of analysis.circuits.circuits) expect(circuit.cable).toMatch(/^1-CHKE-R \(N2XH-J\) \d×[\d,]+ B2ca-s1,d1,a1$/);
    const cables = analysis.summary.byCable.map((row) => row.cable);
    expect(cables.some((cable) => /CYKY|UTP/.test(cable))).toBe(false);
    expect(cables).toContain("1-CHKE-R (N2XH-O) 3×1,5 B2ca-s1,d1,a1");
    expect(cables).toContain(HF_DATA_CABLE);
    expect(circuitEntries(analysis).find((entry) => entry.layer === "data")?.cable).toBe(HF_DATA_CABLE);
    // Stejný nákres jako bytová instalace zůstává na CYKY
    const residential = analyzeDraft(shop({ occupancy: "RESIDENTIAL" }));
    expect(residential.circuits.circuits.every((circuit) => circuit.cable.startsWith("CYKY-J"))).toBe(true);
  });

  it("krabice v BD4 jen bezhalogenové HF (KOPOS KU 68-45/HF, KPR 68-70/HF), kusovník i kabely B2ca", () => {
    const draft = shop();
    const usage = compileBoxUsage(draft);
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((line) => line.box?.halogenFree === true)).toBe(true);
    expect(usage.map((line) => line.box?.type)).toEqual(expect.arrayContaining(["KU 68-45/HF"]));
    const bom = compileFloorplanBom(draft, { installation: draft.installation, cables: analyzeDraft(draft).summary.byCable });
    expect(bom.filter((row) => row.category === "Instalační krabice").every((row) => /HF/.test(row.name))).toBe(true);
    expect(bom.filter((row) => row.category === "Kabely").every((row) => !/CYKY/.test(row.name))).toBe(true);
    // Bytová instalace: běžné krabice KU 68-45
    expect(compileBoxUsage(shop({ occupancy: "RESIDENTIAL" })).some((line) => line.box?.type === "KU 68-45")).toBe(true);
  });

  it("protokol vnějších vlivů BD4 / BE2 a legislativní rámec s ČSN 33 2000-7-718 a vyhláškou č. 23/2008 Sb.", () => {
    const protocol = externalInfluencesProtocol("INDOOR_DRY", "COMMERCIAL_BD4");
    expect(protocol.rows.find((row) => row.code === "BD")).toMatchObject({ value: "BD4", description: "obtížný a pomalý únik osob, vysoká hustota osob" });
    expect(protocol.rows.find((row) => row.code === "BE")).toMatchObject({ value: "BE2", description: "nebezpečí požáru" });
    expect(protocol.codes).toMatch(/BD4, BE2/);
    expect(protocol.occupancy?.norms.join(" ")).toMatch(/ČSN 33 2000-7-718.*Vyhláška č\. 23\/2008 Sb\./);
    expect(legalFrameworkFor(["ČSN 33 2130 ed. 4"], "COMMERCIAL_BD4")).toEqual(expect.arrayContaining([expect.stringMatching(/^ČSN 33 2000-7-718/), expect.stringMatching(/^Vyhláška č\. 23\/2008 Sb\./)]));
    expect(externalInfluencesProtocol("INDOOR_DRY").occupancy).toBeNull();
  });

  it("linter hlásí chybějící spoušť CENTRAL STOP a elektroměr MID, oprava 1 klikem je doplní", () => {
    const board = sharedRcdBoard(["Zásuvky – Prodejna", "Zásuvky – Sklad"]);
    const issues = validateSwitchboardState({ devices: board, capacities: [24], occupancy: "COMMERCIAL_BD4" });
    const central = issues.find((issue) => issue.rule === "bd4-central-stop")!;
    expect(central).toMatchObject({ severity: "error", fix: { kind: "add-devices", label: BD4_FIX_LABEL } });
    expect(issues.find((issue) => issue.rule === "bd4-mid-meter")?.severity).toBe("error");
    if (central.fix?.kind !== "add-devices") throw new Error("oprava musí doplnit přístroje");
    expect(central.fix.devices.map((row) => row.config.moduleSubtype)).toEqual(["SHUNT_TRIP", "METER"]);
    expect(central.fix.devices.map((row) => row.label)).toEqual([CENTRAL_STOP_LABEL, MID_METER_LABEL]);
    expect(central.fix.devices[1].config).toMatchObject({ poles: "3P+N", modules: 4 });
    // Po doplnění přístrojů (oprava 1 klikem) nálezy BD4 zmizí
    const fixed = [...board, ...central.fix.devices.map((row, index) => device(`N${index}`, { label: row.label, category: "OTHER", poles: row.config.poles, modulesWidth: row.config.modules, ratedCurrentA: null, positionOnRail: 20 + index, config: row.config }))];
    expect(validateSwitchboardState({ devices: fixed, capacities: [24], occupancy: "COMMERCIAL_BD4" }).filter((issue) => issue.rule.startsWith("bd4-"))).toEqual([]);
    // Bytová instalace BD4 pravidla nemá
    expect(validateSwitchboardState({ devices: board, capacities: [24] }).some((issue) => issue.rule.startsWith("bd4-"))).toBe(false);
  });

  it("rozváděč vygenerovaný z půdorysu BD4 má spoušť CENTRAL STOP i elektroměr MID a linter je bez nálezu BD4", () => {
    const analysis = analyzeDraft(shop());
    const board = buildSwitchboardFromCircuits(analysis.circuits, { mode: "classic", enclosures: [], occupancy: "COMMERCIAL_BD4" });
    expect(board.devices.find((item) => item.label === CENTRAL_STOP_LABEL)).toMatchObject({ parentKey: "main", config: { moduleSubtype: "SHUNT_TRIP" } });
    expect(board.devices.find((item) => item.label === MID_METER_LABEL)).toMatchObject({ modules: 4, config: { moduleSubtype: "METER" } });
    expect(validateSwitchboardState({ devices: lintOf(board), capacities: board.rails.map((rail) => rail.capacity), occupancy: "COMMERCIAL_BD4" }).filter((issue) => issue.rule.startsWith("bd4-"))).toEqual([]);
    expect(buildSwitchboardFromCircuits(analysis.circuits, { mode: "classic", enclosures: [] }).devices.some((item) => item.label === CENTRAL_STOP_LABEL)).toBe(false);
  });

  it("hlídač BD4: chybějící nouzová svítidla NO_SV se doplní 1 klikem", () => {
    const issue = floorplanNorms(shop()).find((row) => row.rule === "bd4-emergency")!;
    expect(issue.level).toBe("warning");
    const fixed = applyNormFix(shop(), issue);
    expect(fixed.elements.filter((element) => element.item === "emergency-light")).toHaveLength(1);
    expect(floorplanNorms(fixed).some((row) => row.rule === "bd4-emergency")).toBe(false);
    // NO_SV je v kusovníku a ve výpočtu jako svítidlo (bez okruhu navíc)
    expect(compileFloorplanBom(fixed).some((row) => /Nouzové únikové svítidlo/.test(row.name))).toBe(true);
  });
});

describe("fáze 93 – zdravotnický prostor Skupiny 1 (ČSN 33 2000-7-710 ed. 2)", () => {
  it("paleta 🏥: EKV, lůžková rampa LUZ a lehátko LEH_Z jen v režimu zdravotnictví", () => {
    expect(paletteFor("classic", "MEDICAL_G1").map((item) => item.id)).toEqual(expect.arrayContaining(["ekv", "bed-ramp", "arch-exam-bed", "emergency-light"]));
    expect(paletteFor("classic", "RESIDENTIAL").some((item) => item.id === "ekv" || item.id === "bed-ramp")).toBe(false);
  });

  it("zásuvky ordinace a lůžkové rampy ve 2 okruzích A / B, každý s vlastním RCBO 30 mA typ A; světla na 2 okruzích", () => {
    const analysis = analyzeDraft(clinic());
    const office = analysis.circuits.circuits.filter((circuit) => circuit.kind === "sockets" && circuit.label.includes("Ordinace 1"));
    expect(office.length).toBeGreaterThanOrEqual(2);
    const a = office.find((circuit) => circuit.label.includes("Okruh A"))!;
    const b = office.find((circuit) => circuit.label.includes("Okruh B"))!;
    expect(a.nodeIds).toContain("luz#A");
    expect(b.nodeIds).toContain("luz#B");
    for (const circuit of office) expect(circuit.protection).toMatchObject({ device: "RCBO", poles: "1P+N", ratedA: 16, rcd: { type: "A", sensitivityMa: 30 } });
    // Rampa má i datovou zásuvku RJ45 (vlastní UTP)
    expect(analysis.build.dataNodeIds).toContain("luz#D");
    // Dvě svítidla ordinace na dvou různých světelných okruzích
    const lights = analysis.circuits.circuits.filter((circuit) => circuit.kind === "lighting");
    const owner = (id: string) => lights.findIndex((circuit) => circuit.nodeIds.includes(id));
    expect(owner("ol1")).not.toBe(owner("ol2"));
    // Bytová instalace ze stejného nákresu okruhy A / B nedělá
    expect(analyzeDraft(clinic({ occupancy: "RESIDENTIAL" })).circuits.circuits.some((circuit) => circuit.label.includes("Okruh A"))).toBe(false);
  });

  it("rozváděč z ordinace projde linterem zdravotnictví (2 nezávislé ochrany 30 mA)", () => {
    const analysis = analyzeDraft(clinic());
    const board = buildSwitchboardFromCircuits(analysis.circuits, { mode: "classic", enclosures: [] });
    const issues = validateSwitchboardState({ devices: lintOf(board), capacities: board.rails.map((rail) => rail.capacity), occupancy: "MEDICAL_G1" });
    expect(issues.filter((issue) => issue.rule === "medical-sockets" || issue.rule === "medical-rcd-sensitivity")).toEqual([]);
  });

  it("linter blokuje zásuvky ordinace pod jedním společným chráničem a oprava je převede na 2 nezávislé RCBO", () => {
    const board = sharedRcdBoard(["Zásuvky – Ordinace 1", "Zásuvky – Ordinace 1 (lehátko)"]);
    const issue = validateSwitchboardState({ devices: board, capacities: [24], occupancy: "MEDICAL_G1" }).find((row) => row.rule === "medical-sockets")!;
    expect(issue).toMatchObject({ severity: "error", message: MEDICAL_SPLIT_MESSAGE, fix: { kind: "add-devices", label: MEDICAL_SPLIT_FIX } });
    if (issue.fix?.kind !== "add-devices") throw new Error("oprava musí rozdělit okruhy");
    expect(issue.fix.configure?.map((row) => row.config)).toEqual([expect.objectContaining({ category: "RCBO", rcdType: "A", rcdSensitivityMa: 30 }), expect.objectContaining({ category: "RCBO", rcdType: "A", rcdSensitivityMa: 30 })]);
    const configured = new Map(issue.fix.configure!.map((row) => [row.itemId, row.config]));
    const fixed = board.map((item) => (configured.has(item.id) ? { ...item, category: "RCBO" as const, poles: "1P+N", modulesWidth: 2, config: configured.get(item.id)! } : item));
    expect(validateSwitchboardState({ devices: fixed, capacities: [24], occupancy: "MEDICAL_G1" }).some((row) => row.rule === "medical-sockets")).toBe(false);
    // Jediný zásuvkový okruh dostane i druhý okruh B
    const single = validateSwitchboardState({ devices: sharedRcdBoard(["Zásuvky – Ordinace 2"]), capacities: [24], occupancy: "MEDICAL_G1" }).find((row) => row.rule === "medical-sockets")!;
    expect(single.fix?.kind === "add-devices" ? single.fix.devices.map((row) => row.label) : []).toEqual([expect.stringMatching(/^Zásuvky – Ordinace 2 – Okruh B/)]);
  });

  it("chránič typu AC je ve zdravotnickém prostoru chyba a IΔn nad 30 mA se opraví na 30 mA", () => {
    const ac = validateSwitchboardState({ devices: sharedRcdBoard(["Zásuvky – Ordinace 1"], { type: "AC" }), capacities: [24], occupancy: "MEDICAL_G1" });
    expect(ac.find((row) => row.rule === "rcd-type-ac")).toMatchObject({ severity: "error", message: expect.stringMatching(/ČSN 33 2000-7-710 ed\. 2/) });
    expect(validateSwitchboardState({ devices: sharedRcdBoard(["Zásuvky – Kuchyně"], { type: "AC" }), capacities: [24] }).find((row) => row.rule === "rcd-type-ac")?.severity).toBe("warning");
    const sensitive = validateSwitchboardState({ devices: sharedRcdBoard(["Zásuvky – Ordinace 1"], { ma: 100 }), capacities: [24], occupancy: "MEDICAL_G1" }).find((row) => row.rule === "medical-rcd-sensitivity")!;
    expect(sensitive.fix).toMatchObject({ kind: "configure", config: { rcdSensitivityMa: 30 } });
  });

  it("hlídač: ordinace bez EKV – vložení 1 klikem, u lehátka ve výšce 1000 mm; EKV a rampa v kusovníku", () => {
    const draft = clinic();
    const issue = floorplanNorms(draft).find((row) => row.rule === "medical-ekv")!;
    expect(issue.text).toMatch(/Ordinace 1/);
    const fixed = applyNormFix(draft, issue);
    const ekv = fixed.elements.find((element) => element.item === "ekv")!;
    expect(ekv).toMatchObject({ room: "Ordinace 1", mountHeightMm: 1000 });
    expect(floorplanNorms(fixed).some((row) => row.rule === "medical-ekv")).toBe(false);
    expect(ekvHeightAt(draft.elements, "Ordinace 1", 2300, 700)).toBe(1000);
    expect(ekvHeightAt(draft.elements, "Čekárna", 7000, 0)).toBeNull();
    const bom = compileFloorplanBom(fixed);
    expect(bom.find((row) => /Přípojka doplňujícího ochranného pospojování EKV/.test(row.name))?.quantity).toBe(1);
    expect(bom.some((row) => /Lůžková rampa/.test(row.name))).toBe(true);
    // Vodič doplňujícího pospojování: EKV + svorka PE rampy = 2 přípojky × 3 m
    expect(bom.find((row) => row.category === "Kabely" && /CYA 6 mm² ZŽ/.test(row.name))).toMatchObject({ unit: "m", quantity: 6 });
    expect(externalInfluencesProtocol("INDOOR_DRY", "MEDICAL_G1").occupancy?.norms[0]).toBe("ČSN 33 2000-7-710 ed. 2 (Zdravotnické prostory – Skupina 1)");
  });
});

describe("fáze 93 – zálohování napájení areálu a Kniha revizí", () => {
  const node = (id: string, parentId: string | null, patch: Partial<BackupNode> = {}): BackupNode => ({ id, tag: id, name: `${id} - Rozváděč`, type: "SWITCHBOARD", parentId, buildingId: "b1", tier: "GRID_STANDARD", capacityKva: null, nominalCurrentA: null, measuredCurrentA: null, tenantUnit: null, ...patch });
  const nodes: BackupNode[] = [
    node("TR1", null, { type: "TRANSFORMER", buildingId: "b0" }),
    node("HR1", "TR1"),
    node("RDA", "HR1", { tier: "BACKUP_GENERATOR_DA", capacityKva: 250, measuredCurrentA: 297, buildingId: "b2" }),
    node("RP-DA1", "RDA", { nominalCurrentA: 120, tenantUnit: "Interní oddělení – 2. NP" }),
    node("R-UPS", "RP-DA1", { tier: "CRITICAL_UPS_ZIS", nominalCurrentA: 40, tenantUnit: "Operační sál 1 – ZIS IT" }),
    node("RP2", "HR1", { nominalCurrentA: 80 }),
  ];

  it("tři úrovně zálohování a dědění po větvi (za DA je DA, dokud větev nepřejde na UPS)", () => {
    expect(POWER_BACKUP_TIERS.map((tier) => tier.id)).toEqual(["GRID_STANDARD", "BACKUP_GENERATOR_DA", "CRITICAL_UPS_ZIS"]);
    const tiers = effectiveTiers(nodes);
    expect([tiers.get("HR1"), tiers.get("RDA"), tiers.get("RP-DA1"), tiers.get("R-UPS"), tiers.get("RP2")]).toEqual(["GRID_STANDARD", "BACKUP_GENERATOR_DA", "BACKUP_GENERATOR_DA", "CRITICAL_UPS_ZIS", "GRID_STANDARD"]);
  });

  it("filtr DA: páteř od trafostanice, součet výkonu a rezerva zdroje proti kapacitě DA", () => {
    const summary = backupSummary(nodes, "BACKUP_GENERATOR_DA");
    expect(summary.members.map((member) => member.id)).toEqual(["RDA", "RP-DA1"]);
    expect(summary.trunk).toEqual(expect.arrayContaining([{ from: "TR1", to: "HR1" }, { from: "HR1", to: "RDA" }, { from: "RDA", to: "RP-DA1" }]));
    expect(summary.trunkIds.sort()).toEqual(["HR1", "TR1"]);
    expect(summary.buildingIds.sort()).toEqual(["b0", "b1", "b2"]);
    expect(summary).toMatchObject({ loadKw: 185.2, loadKva: 205.8, capacityKva: 250, reservePct: 18 });
    expect(summary.headline).toBe("Celkem na DA: 185,2 kW (205,8 kVA při cos φ 0,9) / kapacita DA 250 kVA → rezerva 18 %");
    expect(backupSummary(nodes, "CRITICAL_UPS_ZIS").headline).toMatch(/kapacitu zdroje UPS doplňte/);
    expect(nodes.filter((entry) => matchesTenant(entry, "interni oddeleni")).map((entry) => entry.id)).toEqual(["RP-DA1"]);
  });

  it("Kniha revizí: zdravotnické přístroje 24 / 12 m, prostory Skupiny 1 / 2 / IMD 36 / 12 / 6 m, nouzové osvětlení 12 m + měsíční zkouška, CENTRAL STOP 12 m", () => {
    expect(inspectionRuleFor({ type: "MEDICAL_DEVICE" })).toMatchObject({ months: 24, kind: "MEDICAL_DEVICE", standard: "ČSN EN 62353 ed. 2" });
    expect(inspectionRuleFor({ type: "MEDICAL_DEVICE", inspectionVariant: "CRITICAL_12" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "MEDICAL_ROOM" })).toMatchObject({ months: 36, standard: "ČSN 33 2000-7-710 ed. 2" });
    expect(inspectionRuleFor({ type: "MEDICAL_ROOM", inspectionVariant: "GROUP_2" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "MEDICAL_ROOM", inspectionVariant: "IMD_IT" }).months).toBe(6);
    expect(inspectionRuleFor({ type: "EMERGENCY_LIGHTING" })).toMatchObject({ months: 12, checkMonths: 1 });
    expect(defaultValidityMonths("FUNCTION_TEST", 12)).toBe(1);
    expect(inspectionRuleFor({ type: "FIRE_SHUTDOWN" })).toMatchObject({ months: 12, kind: "FIRE", standard: "Vyhl. 246/2001 Sb." });
    expect(["MEDICAL_DEVICE", "MEDICAL_ROOM", "FIRE_SHUTDOWN"].every((type) => isLightCard(type as "MEDICAL_DEVICE"))).toBe(true);
  });

  it("předvolby Knihy revizí: průmysl, obchodní centrum (HZS) a zdravotnictví (akreditační komise MZ)", () => {
    expect(INSPECTION_PRESETS.map((preset) => preset.id)).toEqual(["INDUSTRY", "RETAIL", "HEALTH"]);
    const retail = presetById("RETAIL")!;
    expect(retail).toMatchObject({ authority: "HZS", label: "Obchodní centrum (BD4 + Nouzové osv. + Central Stop)" });
    expect(inPreset("EMERGENCY_LIGHTING", retail) && inPreset("FIRE_SHUTDOWN", retail)).toBe(true);
    expect(inPreset("CNC_MACHINE", retail)).toBe(false);
    const health = presetById("HEALTH")!;
    expect(health.authority).toBe("akreditační komise MZ");
    expect(inPreset("MEDICAL_DEVICE", health) && inPreset("MEDICAL_ROOM", health)).toBe(true);
    expect(presetById("NIC")).toBeNull();
  });
});
