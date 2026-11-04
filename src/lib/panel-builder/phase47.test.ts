import { describe, expect, it } from "vitest";

import { isHiddenManufacturer } from "./brands";
import { CATALOG_GROUPS, componentGroup, isCatalogGroup } from "./catalog-groups";
import { effectiveAirflow, fanVerdict, recommendFan, requiredAirflow } from "./fans";
import { validateSwitchboardState, type LintDevice } from "./linter";
import { parseRailPhotos, railPhotoList } from "./rails";
import { frameLabel, mapWiringDevice } from "./wiring-devices";

describe("fáze 47 – značky a katalog po výrobcích", () => {
  it("9 odebraných značek včetně variant zápisu z externí DB", () => {
    for (const name of ["Finder", "FINDER", "Mean Well", "MEANWELL", "Elko EP", "ELKOEP", "Weidmüller", "Shelly", "Pollmann"]) expect(isHiddenManufacturer(name)).toBe(true);
    for (const name of ["ABB", "Siemens", "Eaton", "Hager", null]) expect(isHiddenManufacturer(name)).toBe(false);
  });

  it("11 kategorií; kompaktní DS301C patří mezi jističochrániče, free@home mezi smart moduly", () => {
    expect(CATALOG_GROUPS).toHaveLength(11);
    expect(isCatalogGroup("FAN")).toBe(true);
    expect(isCatalogGroup("RELAY")).toBe(false);
    expect(componentGroup({ category: "RCBO" })).toBe("RCBO");
    expect(componentGroup({ category: "PLC", moduleSubtype: "PLC" })).toBe("SMART");
    expect(componentGroup({ category: "CONTACTOR" })).toBe("CONTACTOR");
    expect(componentGroup({ category: "MAIN_SWITCH" })).toBe("SWITCH");
  });
});

describe("domovní přístroje z externí databáze", () => {
  it("mapování na WiringDevice s klíčem výrobce a vyhledávacím textem bez diakritiky", () => {
    const mapped = mapWiringDevice({ brand: "ABB", article: "1754-0-4438", title: "ABB Levit rámeček 2násobný bílá", series: "Levit", category: "WD_FRAME", features: { wd_role: "frame", wd_frame_units: 2, wd_color_etim: "bílá" } });
    expect(mapped).toMatchObject({ articleNumber: "ABB:1754-0-4438", manufacturer: "ABB", category: "WD_FRAME", role: "frame", frameUnits: 2, color: "bílá" });
    expect(mapped?.searchText).toContain("ramecek");
    expect(mapWiringDevice({ brand: "ABB", article: "x", title: "Neznámé", category: "WD_FOO" })?.category).toBe("WD_OTHER");
    expect(mapWiringDevice({ brand: "ABB", article: "", title: "x", category: "WD_SOCKET" })).toBeNull();
    expect(frameLabel(3)).toMatch(/3/);
  });
});

describe("detailní fotky lišt", () => {
  it("jen číselné lišty s textovou URL, seřazené", () => {
    expect(parseRailPhotos('{"2":"/b.jpg","1":"/a.jpg","x":"/c.jpg","3":5}')).toEqual({ "1": "/a.jpg", "2": "/b.jpg" });
    expect(parseRailPhotos("nejde")).toEqual({});
    expect(railPhotoList('{"3":"/c.jpg","1":"/a.jpg"}')).toEqual([
      { rail: 1, url: "/a.jpg" },
      { rail: 3, url: "/c.jpg" },
    ]);
  });
});

describe("ventilátor skříně (V = 3,1 · Q / ΔT)", () => {
  const small = { id: "a", airflowFreeM3h: 20, airflowFilterM3h: 15 };
  const big = { id: "b", airflowFreeM3h: 160, airflowFilterM3h: null };

  it("potřebný průtok po odečtení přestupu povrchem; bez potřeby i nad cílovou teplotou", () => {
    expect(requiredAirflow({ lossW: 300, ambientTempC: 25, surfaceM2: 1 })).toEqual({ heatW: 245, deltaK: 10, requiredM3h: 76 });
    expect(requiredAirflow({ lossW: 30, ambientTempC: 25, surfaceM2: 1 }).requiredM3h).toBe(0);
    expect(requiredAirflow({ lossW: 100, ambientTempC: 40, surfaceM2: 1 }).requiredM3h).toBeNull();
  });

  it("účinný průtok s filtrem, doporučení nejmenšího vyhovujícího a verdikt", () => {
    expect(effectiveAirflow(small)).toBe(15);
    expect(effectiveAirflow(big, 2)).toBe(224);
    expect(recommendFan([big, small], 10)).toBe(small);
    expect(recommendFan([big, small], 500)).toBe(big);
    const need = requiredAirflow({ lossW: 300, ambientTempC: 25, surfaceM2: 1 });
    expect(fanVerdict(small, 1, need).ok).toBe(false);
    expect(fanVerdict(small, 6, need).ok).toBe(true);
    expect(fanVerdict(null, 1, need).text).toMatch(/76 m³\/h/);
  });
});

describe("linter bez falešných varování smíšených výrobců", () => {
  const device = (id: string, position: number, patch: Partial<LintDevice>): LintDevice => ({
    id,
    designation: `-${id}`,
    dinRailIndex: 1,
    positionOnRail: position,
    modulesWidth: 1,
    category: "MCB",
    poles: "1P",
    ratedCurrentA: 16,
    manufacturer: "ABB",
    typeCode: null,
    label: "",
    parentItemId: null,
    config: null,
    ...patch,
  });

  it("SPD, zdroj, stykač, smart modul ani odpínač jiné značky na liště jističů ABB nevadí", () => {
    const devices = [
      device("F1", 1, {}),
      device("F2", 2, {}),
      device("FV1", 3, { category: "SPD", manufacturer: "Saltek", poles: "3P+N", ratedCurrentA: null }),
      device("KM1", 4, { category: "CONTACTOR", manufacturer: "Hager", poles: "2P", ratedCurrentA: 25 }),
      device("A1", 5, { category: "PLC", manufacturer: "Loxone", poles: null, ratedCurrentA: null }),
      device("G1", 6, { category: "PSU", manufacturer: "Siemens", poles: null, ratedCurrentA: null }),
      device("Q1", 7, { category: "MAIN_SWITCH", manufacturer: "Eaton", poles: "3P", ratedCurrentA: 40 }),
    ];
    expect(validateSwitchboardState({ devices, capacities: [36] }).filter((issue) => issue.rule === "mixed-busbar")).toEqual([]);
    const mixed = [...devices, device("F3", 8, { manufacturer: "Eaton" })];
    expect(validateSwitchboardState({ devices: mixed, capacities: [36] }).filter((issue) => issue.rule === "mixed-busbar")).toHaveLength(1);
  });
});

describe("exporty externí databáze v prisma/external-catalog", () => {
  it("katalog přístrojů nečte wiring.json (jiný formát) a domovní přístroje mají vlastní export", async () => {
    const { readSnapshot, readWiringSnapshot } = await import("../../../prisma/external-catalog-source");
    const products = readSnapshot() ?? [];
    expect(products.length).toBeGreaterThan(1000);
    expect(products.every((product) => typeof product.manufacturer === "string" && typeof product.mpn === "string")).toBe(true);
    const wiring = readWiringSnapshot() ?? [];
    expect(wiring.length).toBeGreaterThan(1000);
    expect(wiring.every((device) => device.brand && device.article && device.category)).toBe(true);
  });
});
