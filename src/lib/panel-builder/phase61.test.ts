import { describe, expect, it } from "vitest";

import { ABB_SERIES_2026 } from "./abb-catalog-2026";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { applyNormFix, floorplanNorms } from "./floorplan-norms";
import { smartLoadsOf, smartPlanOf } from "./smart-home-plan";
import { compileFloorplanBom } from "./wiring-bom";
import { designSeriesOf, seriesColors } from "./wiring-designs";

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

describe("fáze 61 – normový hlídač půdorysu", () => {
  it("zásuvka a spínač blíž než 0,6 m od vany = chyba zóny 0–2; dál od vany v pořádku", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), elements: [el("v", "bath", 1000, 500, "Koupelna"), el("z1", "ip44-socket", 2100, 500, "Koupelna"), el("z2", "ip44-socket", 3000, 500, "Koupelna"), el("s1", "switch-1", 1000, 1300, "Koupelna")] };
    const zone = floorplanNorms(draft).find((issue) => issue.rule === "bath-zone")!;
    // Vana 1700 × 750 se středem (1000, 500): hrana x = 1850 → z1 je 250 mm od vany, s1 425 mm, z2 1150 mm
    expect(zone.elementIds.sort()).toEqual(["s1", "z1"]);
    expect(zone.source).toMatch(/ČSN 33 2000-7-701 ed\. 2/);
  });

  it("koupelna bez IP44 a venkovní zásuvky: varování s opravou jedním klikem; koupelna bez vany = výzva vložit vanu", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), elements: [el("z1", "socket", 0, 0, "Koupelna"), el("z2", "double-socket", 500, 0, "Koupelna"), el("z3", "socket", 0, 0, "Terasa"), el("z4", "socket", 0, 0, "Ložnice")] };
    const issues = floorplanNorms(draft);
    const wet = issues.find((issue) => issue.rule === "wet-room-ip")!;
    expect(wet.elementIds).toEqual(["z1", "z2"]);
    expect(wet.fix?.replace).toEqual([{ from: "z1", to: "ip44-socket" }]); // dvojzásuvka bez náhrady IP44
    expect(issues.find((issue) => issue.rule === "outdoor-ip")?.elementIds).toEqual(["z3"]);
    expect(issues.find((issue) => issue.rule === "fixture-missing")?.text).toMatch(/Koupelna/);
    expect(issues.find((issue) => issue.rule === "afdd")?.text).toMatch(/Ložnice/);
    const fixed = applyNormFix(draft, wet);
    expect(fixed.elements.find((element) => element.id === "z1")!.item).toBe("ip44-socket");
    expect(floorplanNorms(fixed).find((issue) => issue.rule === "wet-room-ip")?.elementIds).toEqual(["z2"]);
  });
});

describe("fáze 61 – chytrá domácnost z půdorysu", () => {
  it("světla (spínaná / stmívaná / DALI), žaluzie a topné zóny → zátěže; výpočet jen na sběrnicové úrovni", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      installation: "bus_loxone",
      smartSystem: "abb_freeathome",
      elements: [
        el("l1", "ceiling-light", 0, 0, "Obývák"),
        el("l2", "ceiling-light", 0, 0, "Obývák", { light: { dimmable: true, powerW: 60, load: "led" } }),
        el("l3", "ceiling-light", 0, 0, "Kuchyně", { light: { dimmable: true, powerW: 20, load: "dali" } }),
        el("b1", "bus-blind", 0, 0, "Obývák"),
        el("r1", "bus-room", 0, 0, "Obývák"),
        el("r2", "bus-room", 0, 0, "Obývák"),
        el("t1", "bus-2", 0, 0, "Obývák", { controls: ["l1", "l2"] }),
      ],
    };
    const { loads, busDevices } = smartLoadsOf(draft);
    expect(loads.map((load) => [load.id, load.role])).toEqual([["l1", "switch"], ["l2", "dim"], ["l3", "dali"], ["b1", "blind"], ["r1", "heating"]]);
    expect(busDevices).toBe(4);
    const plan = smartPlanOf(draft)!;
    expect(plan.modules.map((module) => module.typeCode)).toEqual(expect.arrayContaining(["SAP.3", "SA-M-4.16.2.2", "DA/M.4.210.2.1", "DG-M-1.16.1", "BA-M-4.230.1.1", "HA-M-0.6.1", "PS-M-64.1.1"]));
    expect(smartPlanOf({ ...draft, installation: "classic" })).toBeNull();
  });

  it("kusovník: sběrnicová tlačítka ABB-free@home s objednacím číslem tlačítkového rozhraní", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), installation: "bus_loxone", smartSystem: "abb_freeathome", series: "ABB|Zoni", color: "abb-zoni-500", elements: [el("t1", "bus-1", 0, 0, "Obývák"), el("t2", "bus-2", 0, 0, "Obývák"), el("r1", "bus-room", 0, 0, "Obývák")] };
    const bus = compileFloorplanBom(draft).filter((row) => row.category === "Sběrnicové prvky");
    expect(bus.map((row) => row.mpn)).toEqual(expect.arrayContaining(["2CKA006220A0117", "2CKA006220A0118", "2CKA006220A0122"]));
  });
});

describe("fáze 61 – designové řady podle katalogu ABB 2026", () => {
  it("14 řad pro zapuštěnou montáž bez řady Element, solo a solo carat zvlášť, starší klíče fungují dál", () => {
    const flush = ABB_SERIES_2026.filter((series) => series.mount === "flush").map((series) => series.name);
    expect(flush).toHaveLength(14);
    expect(flush).not.toContain("Element");
    expect(flush).toEqual(expect.arrayContaining(["solo", "solo carat", "Busch-axcent", "future linear", "Decento"]));
    expect(designSeriesOf("ABB|solo / solo carat")?.series.name).toBe("solo");
    expect(designSeriesOf("ABB|Element")?.series.name).toBe("Time");
    // Fáze 91: kód barvy krytu ze společné kapitoly (str. 170)
    expect(seriesColors("ABB|future linear").map((color) => color.label)).toEqual(["Studio bílá (84)", "Hliníková stříbrná (83)", "Antracitová (81)", "Ušlechtilá ocel (866)", "Mechová bílá (884)", "Mechová černá (885)"]);
    // Fáze 91: Busch-axcent – kryt ze společné kapitoly, rámeček bílé sklo zvlášť (1R–5R, str. 166)
    const axcent = designSeriesOf("ABB|Busch-axcent")!.series;
    expect(axcent.colors![0]).toMatchObject({ label: "Studio bílá (84)" });
    expect(axcent.frames![0]).toMatchObject({ label: "Bílé sklo", material: "glass", frameMpn: ["2CKA001754A4437", "2CKA001754A4438", "2CKA001754A4439", "2CKA001754A4440", "2CKA001754A4441"] });
  });

  it("rámečky řad Time, Swing a Swing L a Levit M mají objednací čísla z katalogu 2026", () => {
    const frame = (series: string, color: string) => compileFloorplanBom({ ...emptyDraft(), series, color, elements: [el("z", "socket", 0, 0, "Pokoj")] }).find((row) => row.category === "Rámečky")?.mpn;
    expect(frame("ABB|Time", "abb-time-03")).toBe("3901F-A00110 03");
    expect(frame("ABB|Swing L", "abb-swing-l-c1")).toBe("3901J-A00010 C1");
    expect(frame("ABB|Swing", "abb-swing-b1")).toBe("3901G-A00010 B1");
    expect(frame("ABB|Levit M", "abb-levit-m-63")).toBe("3901H-A05010 63");
    expect(frame("ABB|future linear", "abb-future-studio-bila")).toBe("2CKA001754A4235");
  });
});
