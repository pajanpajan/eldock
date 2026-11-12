import { describe, expect, it } from "vitest";

import { DEMO_SCENARIOS, demoDraft, isDemoScenarioId } from "./panel-builder/demo-scenarios";
import { paletteItem, roomLabelDetails, roomLabelLines } from "./panel-builder/floorplan-editor";
import { DEFAULT_PITCH_CONFIG, LIVE_DEMO, PITCH_SLIDE_COUNT, amountLabel, clampSlide, fundShare, parsePitchConfig, slideFromHash, slideKey } from "./pitch";

// Fáze 99: prezentace /prezentace (ovládání, údaje jednání v prohlížeči) a demo scénáře živé ukázky.
describe("prezentace – ovládání a údaje jednání", () => {
  it("klávesy, adresa slidu a meze", () => {
    expect(["ArrowRight", " ", "PageDown"].map(slideKey)).toEqual(["next", "next", "next"]);
    expect(["ArrowLeft", "PageUp", "Home", "End", "a"].map(slideKey)).toEqual(["prev", "prev", "first", "last", null]);
    expect([slideFromHash("#slide-4"), slideFromHash("#slide-99"), slideFromHash("#nic"), slideFromHash("")]).toEqual([3, PITCH_SLIDE_COUNT - 1, 0, 0]);
    expect([clampSlide(-3), clampSlide(4.4), clampSlide(42)]).toEqual([0, 4, PITCH_SLIDE_COUNT - 1]);
    expect(PITCH_SLIDE_COUNT).toBe(8);
  });

  it("uložené údaje: neplatná data → výchozí, oříznutí délky, podíly využití", () => {
    expect(parsePitchConfig(null)).toEqual(DEFAULT_PITCH_CONFIG);
    expect(parsePitchConfig("{rozbité")).toEqual(DEFAULT_PITCH_CONFIG);
    const config = parsePitchConfig(JSON.stringify({ amount: "8 mil. Kč", partner: "x".repeat(200), funds: ["45", 7, "35,5"], contactName: 12 }));
    expect(config.amount).toBe("8 mil. Kč");
    expect(config.partner).toHaveLength(80);
    expect(config.funds).toEqual(["45", "", "35,5"]);
    expect(config.contactName).toBe("Pavel Janoušek");
    expect(amountLabel({ amount: "  " })).toBe("podle domluvy na jednání");
    expect([fundShare("45"), fundShare("35,5"), fundShare(""), fundShare("150"), fundShare("abc")]).toEqual(["45 %", "35,5 %", null, null, null]);
  });

  it("odkazy živé ukázky míří na demo scénáře a vzorové stránky", () => {
    expect(LIVE_DEMO.floorplan).toBe("/panel-builder/floorplan?demo=rd-4kk");
    for (const href of [LIVE_DEMO.floorplan, LIVE_DEMO.clinic, LIVE_DEMO.shop]) expect(isDemoScenarioId(new URL(href, "https://eldock.cz").searchParams.get("demo"))).toBe(true);
  });
});

describe("demo scénáře 2D půdorysu", () => {
  it("3 scénáře podle zadání, každý s rozváděčem RH a jen existujícími položkami palety", () => {
    expect(DEMO_SCENARIOS.map((scenario) => scenario.icon)).toEqual(["🏠", "🏥", "🛍️"]);
    for (const scenario of DEMO_SCENARIOS) {
      const draft = demoDraft(scenario.id);
      expect(draft.elements.filter((element) => element.item === "panel"), scenario.id).toHaveLength(1);
      for (const element of draft.elements) expect(paletteItem(element.item), `${scenario.id}: ${element.item}`).not.toBeNull();
      expect(new Set(draft.elements.map((element) => element.id)).size).toBe(draft.elements.length);
    }
  });

  it("rodinný dům: FVE, TČ, wallbox, indukce, stmívaná světla, žaluzie a hluboké krabice", () => {
    const draft = demoDraft("rd-4kk");
    const items = new Set(draft.elements.map((element) => element.item));
    for (const item of ["pv-inverter", "heat-pump", "wallbox", "cooktop", "blind-motor", "bus-blind", "shower", "bath", "basin"]) expect(items.has(item), item).toBe(true);
    expect(draft.elements.filter((element) => element.light?.dimmable).length).toBeGreaterThanOrEqual(4);
    expect(draft.elements.filter((element) => element.box === "deep").length).toBeGreaterThan(20);
    expect(draft).toMatchObject({ installation: "bus_loxone", smartSystem: "abb_freeathome", series: "ABB|Levit", occupancy: "RESIDENTIAL" });
  });

  it("ordinace Skupiny 1 s LUZ a EKV, obchodní jednotka BD4 s nouzovými svítidly", () => {
    const clinic = demoDraft("ordinace");
    expect(clinic.occupancy).toBe("MEDICAL_G1");
    expect(clinic.elements.some((element) => element.item === "bed-ramp")).toBe(true);
    expect(clinic.elements.some((element) => element.item === "ekv")).toBe(true);
    const shop = demoDraft("oc-jednotka");
    expect(shop.occupancy).toBe("COMMERCIAL_BD4");
    expect(shop.elements.filter((element) => element.item === "emergency-light").length).toBeGreaterThanOrEqual(3);
  });
});

describe("popisek místnosti na plátně se vejde do místnosti", () => {
  // Písmo plátna 175 mm (pohled na rodinný dům), znak ≈ 98 mm
  const font = 175;
  it("široká místnost na jeden řádek, úzká název a rozměry pod sebou, nízká jen zkrácený název", () => {
    expect(roomLabelDetails({ x: 0, y: 0, w: 5500, h: 4000 })).toEqual(["5,5 × 4 m (22 m²)", "5,5 × 4 m", "22 m²"]);
    expect(roomLabelLines("Obývací pokoj", roomLabelDetails({ x: 0, y: 0, w: 5500, h: 4000 }), { w: 5500, h: 4000 }, font)).toEqual(["Obývací pokoj · 5,5 × 4 m (22 m²)"]);
    expect(roomLabelLines("WC", roomLabelDetails({ x: 0, y: 0, w: 1200, h: 2000 }), { w: 1200, h: 2000 }, font)).toEqual(["WC", "1,2 × 2 m"]);
    const narrow = roomLabelLines("Technická místnost", roomLabelDetails({ x: 0, y: 0, w: 1500, h: 2500 }), { w: 1500, h: 2500 }, font);
    expect(narrow[0]).toMatch(/^Technick.*…$/);
    expect(narrow[0].length).toBeLessThanOrEqual(13);
    expect(roomLabelLines("Chodba", ["9 × 0,4 m (3,6 m²)"], { w: 600, h: 400 }, font)).toEqual(["Cho…"]);
  });

  it("mnohoúhelník: plocha s počtem rohů", () => {
    const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 2000, y: 4000 }, { x: 0, y: 3000 }];
    expect(roomLabelDetails({ x: 0, y: 0, w: 4000, h: 4000, points })).toEqual(["14 m² (5 rohů)", "14 m²"]);
  });
});
