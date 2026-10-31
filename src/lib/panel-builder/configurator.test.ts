import { describe, expect, it } from "vitest";

import { CATALOG } from "../../../prisma/seed-panel-builder";
import { CONFIG_CATEGORIES, CONFIG_FIELDS, configFromComponent, defaultConfig, describeConfig, isOptionActive, matchConfig, polesForWidth, synthesizeComponent, type CatalogLike } from "./configurator";

const catalog: CatalogLike[] = CATALOG.map((component, index) => ({
  id: `c${index}`,
  manufacturer: component.manufacturer,
  typeCode: component.typeCode,
  articleNumber: component.articleNumber,
  category: component.category,
  poles: component.poles,
  ratedCurrentA: component.ratedCurrentA,
  trippingCurve: component.trippingCurve ?? null,
  breakingCapacityKa: component.breakingCapacityKa ?? null,
  rcdType: component.rcdType ?? null,
  rcdSensitivityMa: component.rcdSensitivityMa ?? null,
  spdType: component.spdType ?? (component.category === "SPD" ? "T2" : null),
  surgeCurrentKa: component.surgeCurrentKa ?? null,
  contactConfig: component.contactConfig ?? null,
  coilVoltage: component.coilVoltage ?? null,
  relaySubtype: component.relaySubtype ?? null,
  moduleSubtype: component.moduleSubtype ?? null,
  modulesCount: component.modulesCount,
}));

describe("katalog 220+ přístrojů", () => {
  it("rozsah, jedinečná objednací čísla a hlavní značky i kategorie", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(220);
    expect(new Set(CATALOG.map((c) => c.articleNumber)).size).toBe(CATALOG.length);
    for (const brand of ["ABB", "Eaton", "OEZ", "Schneider", "Hager", "Noark", "Schrack", "Saltek", "Finder", "Elko EP", "Mean Well"]) expect(CATALOG.some((c) => c.manufacturer === brand)).toBe(true);
    for (const category of ["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "PSU"] as const) expect(CATALOG.filter((c) => c.category === category).length).toBeGreaterThan(5);
    expect(CATALOG.find((c) => c.typeCode === "S203-C25")?.articleNumber).toBe("2CDS253001R0254");
    expect(CATALOG.find((c) => c.typeCode === "iC60N 1P B10")?.articleNumber).toBe("A9F03110");
    expect(CATALOG.find((c) => c.typeCode === "MR-41")).toMatchObject({ category: "RELAY", relaySubtype: "IMPULSE", manufacturer: "Elko EP" });
  });
});

describe("konfigurátor – parametry podle kategorie", () => {
  it("chránič ani odpínač nemají charakteristiku B/C/D, relé má vlastní dlaždici", () => {
    expect(CONFIG_FIELDS.RCD.map((f) => f.key)).toEqual(["poles", "rcdType", "rcdSensitivityMa", "ratedCurrentA"]);
    expect(CONFIG_FIELDS.MAIN_SWITCH.map((f) => f.key)).toEqual(["poles", "ratedCurrentA"]);
    expect(CONFIG_FIELDS.MCB.find((f) => f.key === "curve")?.options.map((o) => o.label)).toEqual(["B", "C", "D", "K", "Z"]);
    expect(CONFIG_FIELDS.RCD.find((f) => f.key === "rcdType")?.options.map((o) => o.value)).toEqual(["AC", "A", "B", "F", "G", "S"]);
    expect(CONFIG_CATEGORIES.map((c) => c.label)).toContain("Relé");
    expect(CONFIG_FIELDS.CONTACTOR[0].options.map((o) => o.label)).toContain("2NO+2NC (2M)");
  });

  it("výchozí konfigurace podle šířky modulu a aktivní dlaždice", () => {
    const mcb = defaultConfig("MCB", { manufacturer: "ABB", modules: 3 });
    expect(mcb).toMatchObject({ poles: "3P", modules: 3, curve: "B", ratedCurrentA: 16, breakingCapacityKa: 6 });
    expect(isOptionActive(mcb, CONFIG_FIELDS.MCB[0].options.find((o) => o.value === "3P|3")!)).toBe(true);
    expect(isOptionActive(mcb, CONFIG_FIELDS.MCB[0].options.find((o) => o.value === "1P|1")!)).toBe(false);
    expect(defaultConfig("RCD", { manufacturer: null, modules: 1 })).toMatchObject({ poles: "2P", modules: 2, rcdType: "A", rcdSensitivityMa: 30, ratedCurrentA: 40 });
    expect(polesForWidth("MCB", 3)).toBe("3P");
    expect(polesForWidth("RCD", 4)).toBe("4P");
    expect(polesForWidth("SPD", 4)).toBe("3P+N");
  });

  it("nejbližší přesný kus od zvoleného výrobce, jinak odhad IEC", () => {
    expect(matchConfig(catalog, defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }))?.typeCode).toBe("S201-B16");
    expect(matchConfig(catalog, { ...defaultConfig("MCB", { manufacturer: "Eaton", modules: 3 }), curve: "C", ratedCurrentA: 25 })?.typeCode).toBe("PL7-C25/3");
    expect(matchConfig(catalog, { ...defaultConfig("RCD", { manufacturer: "Hager", modules: 4 }), ratedCurrentA: 40 })?.typeCode).toBe("CDA440D");
    expect(matchConfig(catalog, { ...defaultConfig("RCD", { manufacturer: "ABB", modules: 4 }), rcdType: "B", ratedCurrentA: 40 })?.typeCode).toBe("F204 B-40/0,03");
    expect(matchConfig(catalog, { ...defaultConfig("RELAY", { manufacturer: "Elko EP", modules: 1 }), relaySubtype: "TIMER" })?.typeCode).toMatch(/^CRM-9/);
    expect(matchConfig(catalog, { ...defaultConfig("OTHER", { manufacturer: "Mean Well", modules: 2 }), power: "30W/24V" })?.manufacturer).toBe("Mean Well");
    // Bonega jistič v katalogu není → odhad
    const bonega = { ...defaultConfig("MCB", { manufacturer: "Bonega", modules: 1 }), ratedCurrentA: 10 };
    expect(matchConfig(catalog, bonega)).toBeNull();
    expect(synthesizeComponent(bonega)).toMatchObject({ manufacturer: "Bonega", typeCode: "Jistič 1P B10 6 kA", category: "MCB", modulesCount: 1, powerLossWatts: 2.1 });
    expect(synthesizeComponent(bonega).articleNumber).toBe("CFG-BONEGA-JISTIC-1P-B10-6-KA");
  });

  it("konfigurace z katalogového kusu a čitelný popis", () => {
    const s203 = catalog.find((c) => c.typeCode === "S203-B16")!;
    expect(configFromComponent(s203)).toMatchObject({ category: "MCB", poles: "3P", modules: 3, curve: "B", ratedCurrentA: 16 });
    expect(describeConfig({ ...defaultConfig("RCD", { manufacturer: null, modules: 4 }) })).toBe("Chránič 4P 40 A / 30 mA typ A");
    expect(describeConfig({ ...defaultConfig("CONTACTOR", { manufacturer: null, modules: 1 }) })).toBe("Stykač 25 A 2NO, cívka 230V AC");
  });
});
