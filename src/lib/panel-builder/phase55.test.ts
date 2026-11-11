import { describe, expect, it } from "vitest";

import { ABB_SERIES_2026 } from "./abb-catalog-2026";
import { emptyDraft, type EditorElement } from "./floorplan-editor";
import { busbarPartsRows, busbarSummary, pickBar, planBusbars, type BusbarItem } from "./pe-n-busbars";
import { colorForSeries, seriesColors } from "./wiring-designs";
import { compileFloorplanBom } from "./wiring-bom";
import { SUPPLY_SYSTEMS, supplyById, supplyOf } from "./supply";
import { proposeTree, type TreeNode } from "./tree";

// Fáze 55: soustava přívodu 1f / 3f a sběrnice PE / N.

const item = (id: string, designation: string, category: BusbarItem["category"], poles: string, parentItemId: string | null, circuitLabel = ""): BusbarItem => ({ id, designation, category, poles, parentItemId, circuitLabel });

describe("soustava přívodu", () => {
  it("text sloupců → soustava (stávající projekty TN-S 3f, „1 x“ = 1f, TN-C-S = PEN)", () => {
    expect(supplyOf({ networkSystem: "3 x 230/400 V, 50Hz, TN-S" }).id).toBe("3F_TNS");
    expect(supplyOf({ networkSystem: "3 x 230/400 V, 50Hz, TN-C-S", supplyPhases: 3 }).id).toBe("3F_TNCS");
    expect(supplyOf({ networkSystem: "3 x 230/400 V, 50Hz, TT" }).id).toBe("3F_TT");
    expect(supplyOf({ networkSystem: "1 x 230 V, 50Hz, TN-C-S" }).id).toBe("1F_TNCS");
    expect(supplyOf({ networkSystem: "3 x 230/400 V, 50Hz, TN-S", supplyPhases: 1 }).id).toBe("1F_TNS");
    for (const supply of SUPPLY_SYSTEMS) expect(supplyOf({ networkSystem: supply.networkSystem, supplyPhases: supply.phases })).toBe(supply);
    expect(supplyById("1F_TNCS").conductors).toBe("L,PEN");
    expect(supplyById("nesmysl").id).toBe("3F_TNS");
  });

  it("1f přívod: navržený strom dá všechny jednofázové vývody na L1 (bez rotace L1 → L2 → L3)", () => {
    const node = (id: string, category: TreeNode["category"], poles: string, rail: number, pos: number): TreeNode => ({ id, designation: id, circuitLabel: "", dinRailIndex: rail, positionOnRail: pos, category, poles, ratedCurrentA: 16, operatingCurrentA: null, parentItemId: null, fedFromIncomer: false, phaseAssignment: null });
    const nodes = [node("Q1", "MAIN_SWITCH", "2P", 1, 1), node("FI1", "RCD", "2P", 1, 2), node("F1", "MCB", "1P", 1, 3), node("F2", "MCB", "1P", 1, 4), node("F3", "MCB", "1P", 1, 5)];
    const single = [...proposeTree(nodes, null, { supplyPhases: 1 }).values()].map((link) => link.phaseAssignment ?? "");
    expect(single.filter((phase) => /L2|L3/.test(phase))).toEqual([]);
    expect(single.slice(2)).toEqual(["L1", "L1", "L1"]);
    // 3f rozváděč (3P vypínač, 4P chránič) dál rotuje fáze
    const threePhase = [node("Q1", "MAIN_SWITCH", "3P", 1, 1), node("FI1", "RCD", "4P", 1, 2), node("F1", "MCB", "1P", 1, 3), node("F2", "MCB", "1P", 1, 4), node("F3", "MCB", "1P", 1, 5)];
    expect([...proposeTree(threePhase).values()].slice(2).map((link) => link.phaseAssignment)).toEqual(["L1", "L2", "L3"]);
    expect([...proposeTree(threePhase, null, { supplyPhases: 1 }).values()].slice(2).map((link) => link.phaseAssignment)).toEqual(["L1", "L1", "L1"]);
  });
});

describe("sběrnice PE a N", () => {
  const items = [
    item("q1", "-Q1", "MAIN_SWITCH", "3P", null),
    item("fv1", "-FV1", "SPD", "3P+N", "q1"),
    item("fi1", "-FI1", "RCD", "4P", "q1"),
    item("fi2", "-FI2", "RCD", "2P", "q1"),
    ...Array.from({ length: 7 }, (_, i) => item(`f${i + 1}`, `-F${i + 1}`, "MCB", "1P", "fi1", `Okruh ${i + 1}`)),
    item("f8", "-F8", "MCB", "1P", "fi2", "Koupelna"),
    item("f9", "-F9", "MCB", "3P", "q1", "Sporák"),
    item("fa1", "-FA1", "RCBO", "1P+N", "q1", "Pračka"),
  ];

  it("TN-C-S 3f: PE s rezervou 20 %, N0 před chrániči, skupinové můstky za každým chráničem a propojka PEN", () => {
    const plan = planBusbars(items, supplyById("3F_TNCS"));
    // PE: přívod + MET + SPD + 10 vývodů = 13 → ×1,2 = 16 → 18 otvorů
    expect(plan.pe).toMatchObject({ size: 18, used: 13, pieces: 1 });
    expect(plan.groups.map((group) => [group.label, group.used, group.size])).toEqual([
      ["N1 (za -FI1)", 7, 10],
      ["N2 (za -FI2)", 1, 7],
    ]);
    // N0: přívod + N pólů 2 chráničů + N SPD + RCBO -FA1 (3P -F9 bez N)
    expect(plan.n0.connections.map((connection) => connection.designation)).toEqual(["přívod", "-FI1", "-FI2", "-FV1", "-FA1"]);
    expect(plan.penBridge).toBe(true);
    expect(busbarSummary(plan.groups[0])).toBe("Můstek N1 (za -FI1): 7 / 10 svorek");
    expect(busbarPartsRows(plan).map((row) => row.typeCode)).toEqual(["PE sběrnice 18 otvorů", "N sběrnice 7 svorek", "N můstek 10 svorek", "N můstek 7 svorek", "Propojka PE–N0"]);
  });

  it("TN-S: PE a N0 bez propojky; velký rozváděč skládá PE z více kusů", () => {
    expect(planBusbars(items, supplyById("3F_TNS")).penBridge).toBe(false);
    expect(pickBar(40, [12, 18, 24, 36])).toEqual({ size: 72, pieces: 2 });
    expect(pickBar(10, [12, 18, 24, 36])).toEqual({ size: 12, pieces: 1 });
  });
});

describe("řady ABB 2026 a barvy", () => {
  it("14 řad pod omítku + 3 nástěnné, přepnutí řady nabídne jen její barvy", () => {
    expect(ABB_SERIES_2026.filter((series) => series.mount === "flush")).toHaveLength(14);
    expect(ABB_SERIES_2026.filter((series) => series.mount === "surface").map((series) => series.ip)).toEqual(["IP44", "IP54", "IP44"]);
    expect(seriesColors("ABB|Zoni").map((color) => color.label)).toContain("Pudrová / bílá (242/142)");
    expect(seriesColors("ABB|Levit M")).toHaveLength(4);
    // Tango bílá (B) → Zoni nemá „B“ → stejná skupina (bílá 500); Classic hnědá zůstane jen v Classic
    const tangoWhite = seriesColors("ABB|Tango")[0].id;
    expect(colorForSeries("ABB|Zoni", tangoWhite)).toBe("abb-zoni-500");
    expect(colorForSeries("ABB|Levit M", "abb-zoni-500")).toBe("abb-levit-m-68");
    expect(colorForSeries("ABB|Zoni", "abb-zoni-237")).toBe("abb-zoni-237");
    // Řady bez katalogových barev nabízejí obecné skupiny
    expect(seriesColors("Schneider|Asfora")[0].id).toBe("white");
  });
});

describe("kusovník domovní instalace", () => {
  const el = (id: string, item: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 0, y: 0, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, rotation: 0, scale: null, controls: [], ...extra });

  it("Zoni bílá 500: strojky, kryty, zásuvky, rámečky podle násobnosti, krabice a kabely", () => {
    const draft = {
      ...emptyDraft(),
      series: "ABB|Zoni",
      color: "abb-zoni-500",
      elements: [
        el("panel", "panel"),
        el("l1", "ceiling-light"),
        el("s1", "switch-1", { controls: ["l1"] }),
        el("l2", "ceiling-light"),
        el("s2", "switch-1", { controls: ["l2"] }),
        el("s3", "switch-1", { controls: ["l2"] }),
        el("s4", "switch-6-6"),
        el("z1", "socket", { frameUnits: 2 }),
        el("z2", "double-socket"),
        el("zal", "blind"),
      ],
    };
    const rows = compileFloorplanBom(draft, { installation: "classic", cables: [{ cable: "CYKY-J 3x1,5", meters: 41.2 }] });
    const find = (mpn: string) => rows.find((row) => row.mpn === mpn);
    expect(find("3559-A01345")?.quantity).toBe(1);
    expect(find("3559-A06345")?.quantity).toBe(2);
    expect(find("3559-A52345")?.quantity).toBe(1);
    expect(find("3559-A89345")?.quantity).toBe(1);
    expect(find("3559T-A00651 500")).toMatchObject({ quantity: 3, verified: true });
    expect(find("3559T-A00652 500")?.quantity).toBe(1);
    expect(find("3559T-A00662 500")?.quantity).toBe(1);
    expect(find("6619T-A06657 500")?.quantity).toBe(2);
    expect(find("5513T-C02157 500")?.quantity).toBe(1);
    expect(find("3901T-A00010 500")?.quantity).toBe(5);
    expect(find("3901T-A00020 500")?.quantity).toBe(1);
    // Fáze 91: vypínače klasické instalace do hluboké krabice (WAGO svorky), zásuvky do mělké KU 68-45 (náhrada KU 68-1901),
    // 2 zásuvky v jednom rámečku do dvojnásobné KP 64/2
    expect(find("KPR 68_KA")?.quantity).toBe(5);
    expect(find("KU 68-45_KA")?.quantity).toBe(1);
    expect(find("KP 64/2_KA")?.quantity).toBe(1);
    expect(find("KU 68-1901")).toBeUndefined();
    expect(rows.find((row) => row.category === "Kabely")).toMatchObject({ name: "CYKY-J 3x1,5", quantity: 42, unit: "m" });
  });

  it("Tango: dělený kryt je odvozený (ověřit), řada bez matice a dvoubarevný kód bez vymyšleného čísla", () => {
    const tango = compileFloorplanBom({ ...emptyDraft(), series: "ABB|Tango", color: seriesColors("ABB|Tango")[0].id, elements: [el("s", "switch-6-6")] });
    // Fáze 94: odvozený dělený kryt potvrzují oficiální data výrobce ABB ETIM 9.0 → ověřený, s EAN
    expect(tango.find((row) => row.category === "Kryty spínačů")).toMatchObject({ mpn: "3558A-A652 B", verified: true, ean: "8595017208188" });
    // Řada bez matice objednacích čísel (Classic) – číslo se nevymýšlí; fáze 91 – Decento má kompletní přístroje z katalogu
    const classic = compileFloorplanBom({ ...emptyDraft(), series: "ABB|Classic", color: seriesColors("ABB|Classic")[0].id, elements: [el("z", "socket")] });
    expect(classic.find((row) => row.category === "Zásuvky")?.mpn).toBeNull();
    const decento = compileFloorplanBom({ ...emptyDraft(), series: "ABB|Decento", color: seriesColors("ABB|Decento")[0].id, elements: [el("z", "socket")] });
    expect(decento.find((row) => row.category === "Zásuvky")).toMatchObject({ mpn: "6619K-C06347", verified: true });
    const twoTone = compileFloorplanBom({ ...emptyDraft(), series: "ABB|Zoni", color: "abb-zoni-241-141", elements: [el("z", "socket")] });
    // Fáze 74: dvoubarevný kód „241/141“ = rámeček 241 / kryt 141 – zásuvka (kryt) dostane 141, rámeček 241 (obojí ověřit)
    expect(twoTone.find((row) => row.category === "Zásuvky")).toMatchObject({ mpn: "6619T-A06657 141", verified: false });
    expect(twoTone.find((row) => row.category === "Rámečky")).toMatchObject({ mpn: "3901T-A00010 241", verified: false });
    // Fáze 94: dvoubarevná čísla Zoni data ETIM 9.0 výrobce neuvádějí – zůstanou „ověřit“ a bez EAN
    expect(twoTone.find((row) => row.category === "Rámečky")?.ean).toBeUndefined();
    // Fáze 91: retrofit – zásuvka do mělké krabice, vypínač s modulem pod vypínač do krabice 70 mm s prostorem pro elektroniku
    expect(compileFloorplanBom({ ...emptyDraft(), installation: "smart_retrofit", elements: [el("z", "socket")] }, { installation: "smart_retrofit" }).find((row) => row.category === "Instalační krabice")?.mpn).toBe("KU 68-45_KA");
    const retrofit = compileFloorplanBom({ ...emptyDraft(), installation: "smart_retrofit", elements: [el("l", "ceiling-light"), el("s", "switch-1", { controls: ["l"] })] }, { installation: "smart_retrofit" });
    expect(retrofit.find((row) => row.category === "Instalační krabice")?.mpn).toBe("KPR 68-70_KA");
  });
});
