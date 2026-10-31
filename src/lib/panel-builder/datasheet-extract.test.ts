import { describe, expect, it } from "vitest";

import { buildSearchText, estimatePowerLoss, matchesFilter, normalizeSearch, parseCatalogFilter } from "./catalog";
import { classify, extractComponents } from "./datasheet-extract";

// Řádky kusovníku a seznamu komponent z referenčního PDF (public/demo-docs/domovni-rozvadec-rh1.pdf).
const PARTS_LIST = [
  "1SPE007717F0620   1 RES12x320",
  "2CDD283101R0040   1 SD203/40",
  "S201-B16 2CDS251001R1165 5",
  "FH204 A-40/0,03 2CSF204102R1400 1",
  "OVR T2-T3 3N 20-275 P QS 2CTB803973R1200 1",
];
const COMPONENTS_LIST = [
  "-F1 2CTB803973R1200 OVR T2-T3 3N 20-275 P QS Surge Protective Device /12.1 Přepěťová ochrana (SPD)",
  "2CSF204102R1400  -F2 FH204 A-40/0,03 RCCB TYPE A 4P 40A 30mA /12.1 Proudový chránič (RCD)",
  "2CDS251001R1165 -F8 S201-B16 Jistic 1P, 16A, char. B, 6kA /12.4 Zásuvky kuchyně",
  "2CDS251001R1165 -F9 S201-B16 Jistic 1P, 16A, char. B, 6kA /12.5 Zásuvky obývák",
  "2CDD283101R0040 SD203/40   Vypínac 3P, 40A   /12.1 Odpínač",
  "PCS2220017 =SYS0/+1.1/-UC1.F1 -- PCS-MCB-017 Circuit Breaker (MCB) 4P 10A /5.3",
  "PCS2250101 =SYS0.1/+1.1/-UC1.Q1 -- PCS-CON01 Contactor 3POL 1NO 1NC type1 /7.3",
];

describe("atomizace PDF datasheetu", () => {
  const components = extractComponents([PARTS_LIST, COMPONENTS_LIST]);
  const byArticle = Object.fromEntries(components.map((component) => [component.articleNumber, component]));

  it("každé objednací číslo = jeden prvek (kusovník a seznam komponent se spojí)", () => {
    expect(components).toHaveLength(7);
    expect(byArticle["2CDS251001R1165"].sourcePage).toBe(1);
  });

  it("jistič S201-B16: kategorie, póly, proud, charakteristika, Icn a odhad Pv", () => {
    expect(byArticle["2CDS251001R1165"]).toMatchObject({
      manufacturer: "ABB",
      typeCode: "S201-B16",
      category: "MCB",
      poles: "1P",
      ratedCurrentA: 16,
      trippingCurve: "B",
      breakingCapacityKa: 6,
      modulesCount: 1,
      powerLossWatts: 2.5,
      powerLossEstimated: true,
      iecSymbol: "MCB_1P",
    });
    expect(byArticle["2CDS251001R1165"].description).not.toContain("Zásuvky");
  });

  it("chránič, vypínač, SPD a skříň", () => {
    expect(byArticle["2CSF204102R1400"]).toMatchObject({ category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4 });
    expect(byArticle["2CDD283101R0040"]).toMatchObject({ category: "MAIN_SWITCH", typeCode: "SD203/40", poles: "3P", ratedCurrentA: 40, modulesCount: 3 });
    expect(byArticle["2CTB803973R1200"]).toMatchObject({ category: "SPD", poles: "3P+N", typeCode: "OVR T2-T3 3N 20-275 P QS" });
    expect(byArticle["1SPE007717F0620"]).toMatchObject({ category: "ENCLOSURE", typeCode: "RES12x320" });
  });

  it("obecný kusovník bez známé řady (PCSCHEMATIC)", () => {
    expect(byArticle.PCS2220017).toMatchObject({ category: "MCB", poles: "4P", ratedCurrentA: 10, typeCode: "PCS-MCB-017" });
    expect(byArticle.PCS2250101).toMatchObject({ category: "CONTACTOR", poles: "3P" });
    expect(classify("Aux contacts 1NO 1NC type1")).toBe("OTHER");
  });
});

describe("katalog – hledání a filtr", () => {
  const component = {
    manufacturer: "ABB",
    series: "System pro M compact S200",
    typeCode: "S201-B16",
    articleNumber: "2CDS251001R1165",
    category: "MCB" as const,
    poles: "1P",
    ratedCurrentA: 16,
    trippingCurve: "B",
    description: "Jistič 1P, 16 A, char. B, 6 kA",
  };
  const searchText = buildSearchText(component);

  it("hledá bez diakritiky, bez pomlček i podle objednacího čísla", () => {
    expect(normalizeSearch("  Jistič  Č ")).toBe("jistic c");
    for (const q of ["jistic b16", "S201B16", "2cds251001r1165", "abb 16a"]) expect(matchesFilter({ ...component, searchText }, { q })).toBe(true);
    expect(matchesFilter({ ...component, searchText }, { q: "chranic" })).toBe(false);
  });

  it("filtr parametrů a čtení z URL", () => {
    expect(matchesFilter({ ...component, searchText }, { category: "MCB", poles: "1P", current: 16, curve: "B" })).toBe(true);
    expect(matchesFilter({ ...component, searchText }, { curve: "C" })).toBe(false);
    expect(parseCatalogFilter({ category: "MCB", poles: "3P", current: "16", curve: "X", q: "s203" })).toEqual({
      q: "s203",
      category: "MCB",
      manufacturer: undefined,
      poles: "3P",
      current: 16,
      curve: undefined,
    });
  });

  it("odhad Pv podle IEC tabulek", () => {
    expect(estimatePowerLoss("MCB", "1P", 10)).toBe(2.1);
    expect(estimatePowerLoss("RCD", "4P", 40)).toBe(3.2);
    expect(estimatePowerLoss("MAIN_SWITCH", "3P", 40)).toBe(6.81);
  });
});
