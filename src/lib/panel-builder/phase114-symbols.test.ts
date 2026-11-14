import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VectorModuleSymbol } from "@/components/panel-builder/VectorModuleSymbol";

import { ACCESSORY_COMPONENTS } from "../../../prisma/seed-accessories-2026";
import { CATALOG } from "../../../prisma/seed-panel-builder";

import { ACCESSORY_DEFAULT_MODULES, ACCESSORY_KINDS, accessoryKindOf, busbarPhases, hlakChambers, hlakText, indicatorLeds, rowTerminalConductor } from "./accessory-symbols";
import { ACCESSORY_SUBTYPES, configFields, defaultConfig, matchConfig, withOption, type CatalogLike, type ItemConfig } from "./configurator";
import { SMART_SYSTEMS, planSmartHome } from "./smart-home";
import { VECTOR } from "./vector-layout";
import { deviceWithConfig, type VectorDevice } from "./vector-symbols";

// Fáze 114: věrná grafika všech 10 podtypů „Svorky / Hřebeny / Příslušenství“ na DIN liště i v kartě k osazení.

const BLANK: VectorDevice = {
  id: "x",
  designation: "-X1",
  dinRailIndex: 1,
  positionOnRail: 1,
  modulesWidth: 1,
  category: null,
  poles: null,
  manufacturer: "ABB",
  typeCode: null,
  articleNumber: null,
  ratedCurrentA: null,
  curve: null,
  rcdType: null,
  rcdSensitivityMa: null,
  spdType: null,
  contactConfig: null,
  power: null,
  powerLossWatts: null,
  label: "Rozbočení",
  status: "VERIFIED",
};

const render = (device: VectorDevice) =>
  renderToStaticMarkup(createElement("svg", null, createElement(VectorModuleSymbol, { device, rect: { x: 0, y: 0, w: device.modulesWidth * VECTOR.moduleW, h: VECTOR.deviceH }, theme: "dark" })));

/** Konfigurace z kaskády: podtyp dlaždicí C1 (typická šířka podtypu), póly 3P. */
function accessory(kind: string, patch: Partial<ItemConfig> = {}): VectorDevice {
  const base = defaultConfig("ACCESSORY", { manufacturer: "ABB", modules: 0.5 });
  const config = { ...withOption(base, { moduleSubtype: kind }), poles: "3P", ...patch };
  return { ...deviceWithConfig({ ...BLANK, modulesWidth: config.modules }, config), modulesWidth: config.modules, designation: "-X1", label: "Rozbočení" };
}

/** Kresba bez textů (tvar symbolu). */
const shape = (html: string) => html.replace(/<text[^>]*>[^<]*<\/text>/g, "");

describe("fáze 114 – grafika příslušenství na DIN liště", () => {
  it("10 podtypů = 10 rozpoznatelných kreseb (ne jeden obrázek pomocného kontaktu)", () => {
    expect([...ACCESSORY_KINDS].sort()).toEqual(Object.keys(ACCESSORY_SUBTYPES).sort());
    const shapes = new Map<string, string>();
    for (const kind of ACCESSORY_KINDS) {
      const device = accessory(kind);
      expect(device.modulesWidth).toBe(ACCESSORY_DEFAULT_MODULES[kind]);
      const html = render(device);
      expect(html).toContain(`data-accessory="${kind}"`);
      expect(html).toContain('data-testid="symbol-designation"');
      expect(html).toContain('data-label-strip=""');
      // Starý obecný modul (šedý obdélník se zelenou a oranžovou tečkou) už nikde
      expect(html).not.toContain('data-mechanics="module"');
      shapes.set(kind, shape(html));
    }
    expect(new Set(shapes.values()).size).toBe(10);
  });

  it("svorkovnice HLAK -X1: barevné komory L1 / L2 / L3 / N / PE s mosaznými tělesy a popisem HLAK 25/16 mm²", () => {
    const html = render({ ...accessory("TERMINAL_BLOCK"), typeCode: "HLAK 25-4/5" });
    expect(html).toContain('data-terminal="hlak"');
    expect(html.match(/data-chamber="/g)).toHaveLength(5);
    for (const conductor of ["L1", "L2", "L3", "N", "PE"]) expect(html).toContain(`data-chamber="${conductor}"`);
    expect(html).toContain("#1d4ed8");
    expect(html).toContain("#15803d");
    expect(html).toContain("#eab308");
    expect(html.match(/data-brass=""/g)).toHaveLength(5);
    expect(html).toContain("HLAK 25/16 mm²");
    expect(html).toContain("-X1");
    // 1f svorkovnice 2M: L / N / PE
    expect(hlakChambers(2, "1P").map((chamber) => chamber.conductor)).toEqual(["L", "N", "PE"]);
    expect(hlakText("HLAK 35-4/5")).toBe("HLAK 35/16 mm²");
    expect(hlakText(null)).toBe("HLAK 25/16 mm²");
  });

  it("řadová svorka 0,5–1M: profil s klecovými svorkami, štítkem a můstkovou drážkou podle druhu vodiče", () => {
    const html = render(accessory("TERMINAL_BLOCK", { modules: 1 }));
    expect(html).toContain('data-terminal="row"');
    expect(html.match(/data-cage-clamp=""/g)).toHaveLength(2);
    expect(html).toContain('data-bridge-slot=""');
    expect(html).toContain('data-marker=""');
    expect(rowTerminalConductor("Svorka PE 4 mm²").conductor).toBe("PE");
    expect(rowTerminalConductor("NK/S06 svorky N").conductor).toBe("N");
    expect(rowTerminalConductor("A 12-F2 šedý").conductor).toBe("L");
  });

  it("hřeben s vidličkami a potiskem fází, LED signálky, podpěťová spoušť U <, segmenty záslepky", () => {
    const comb = render(accessory("BUSBAR"));
    expect(comb).toContain("L1 · L2 · L3 · 10/16 mm²");
    expect(comb.match(/data-tooth="/g)?.length).toBe(12);
    expect(busbarPhases("1P", null)).toEqual(["L1"]);
    expect(busbarPhases(null, "3F 10mm2 KDN363B")).toEqual(["L1", "L2", "L3"]);
    expect(render(accessory("INDICATOR")).match(/data-led="/g)).toHaveLength(3);
    expect(indicatorLeds("1P", 1, "E219-D").map((led) => led.fill)).toEqual(["#22c55e"]);
    expect(render(accessory("UNDERVOLTAGE_TRIP"))).toContain("U &lt;");
    expect(render(accessory("SHUNT_TRIP"))).toContain('data-trip-disc=""');
    expect(render(accessory("FUSE_LINK"))).toContain("10×38 gG");
    expect(render(accessory("DIN_SOCKET"))).toContain('data-pe-pin=""');
    expect(render(accessory("BLANK_COVER", { modules: 3 })).match(/data-segment=""/g)).toHaveLength(2);
    expect(render(accessory("BUSBAR_END_CAP"))).toContain('data-cap=""');
    expect(render(accessory("AUX_CONTACT"))).toContain('data-terminal-numbers="13 · 21/14 · 22"');
  });

  it("podtyp i z katalogu a typového označení; jistič ani popis obvodu příslušenství nedělají", () => {
    expect(accessoryKindOf({ category: "TERMINAL", typeCode: "HLAK 25-4/5" })).toBe("TERMINAL_BLOCK");
    expect(accessoryKindOf({ category: "OTHER", moduleSubtype: "FUSE_DISCONNECTOR", typeCode: "OPV10-1" })).toBe("FUSE_LINK");
    expect(accessoryKindOf({ category: "OTHER", typeCode: "ZP-ASA/230" })).toBe("SHUNT_TRIP");
    expect(accessoryKindOf({ category: "OTHER", typeCode: "Z-USA/230" })).toBe("UNDERVOLTAGE_TRIP");
    expect(accessoryKindOf({ category: "OTHER", typeCode: "E219-3CDE" })).toBe("INDICATOR");
    expect(accessoryKindOf({ category: "OTHER", typeCode: "Elektroměr", label: "Zásuvky kuchyně" })).toBeNull();
    expect(accessoryKindOf({ category: "MCB", typeCode: "S201-B16", label: "LED pásek" })).toBeNull();
    // Svorka z databáze bez rozpoznaného typu = rozbočovací svorkovnice
    expect(accessoryKindOf({ category: "TERMINAL", typeCode: "X-123" })).toBe("TERMINAL_BLOCK");
  });
});

describe("fáze 114 – příslušenství s objednacím číslem výrobce (ne odhad IEC)", () => {
  it("Schneider všech 10 podtypů, ABB / OEZ / Hager s ověřenými kusy; kaskáda najde skutečný kus", () => {
    const catalog: CatalogLike[] = CATALOG.map((row, index) => ({
      id: `c${index}`,
      manufacturer: row.manufacturer,
      typeCode: row.typeCode,
      articleNumber: row.articleNumber,
      category: row.category,
      poles: row.poles,
      ratedCurrentA: row.ratedCurrentA,
      trippingCurve: row.trippingCurve ?? null,
      breakingCapacityKa: row.breakingCapacityKa ?? null,
      rcdType: row.rcdType ?? null,
      rcdSensitivityMa: row.rcdSensitivityMa ?? null,
      spdType: row.spdType ?? null,
      surgeCurrentKa: row.surgeCurrentKa ?? null,
      contactConfig: row.contactConfig ?? null,
      coilVoltage: row.coilVoltage ?? null,
      relaySubtype: row.relaySubtype ?? null,
      moduleSubtype: row.moduleSubtype ?? null,
      modulesCount: row.modulesCount,
    }));
    const covered = (maker: string) => ACCESSORY_KINDS.filter((kind) => matchConfig(catalog.filter((row) => row.manufacturer === maker), { ...defaultConfig("ACCESSORY", { manufacturer: maker, modules: 1 }), moduleSubtype: kind }));
    expect(covered("Schneider")).toEqual([...ACCESSORY_KINDS]);
    // ABB: podpěťová spoušť S2C-UA se na stránkách výrobce dohledat nepodařilo – zůstává odhad IEC
    expect(covered("ABB")).toEqual(ACCESSORY_KINDS.filter((kind) => kind !== "UNDERVOLTAGE_TRIP"));
    // OEZ a Hager: hřebeny, koncovky, zásuvky … přidává import katalogu výrobců; seed doplnil chybějící podtypy
    expect(covered("OEZ")).toEqual(expect.arrayContaining(["TERMINAL_BLOCK", "SHUNT_TRIP", "UNDERVOLTAGE_TRIP", "FUSE_LINK", "BLANK_COVER"]));
    expect(covered("Hager")).toEqual(expect.arrayContaining(["AUX_CONTACT", "SHUNT_TRIP", "UNDERVOLTAGE_TRIP", "FUSE_LINK", "INDICATOR"]));
    const pick = matchConfig(catalog.filter((row) => row.manufacturer === "ABB"), { ...defaultConfig("ACCESSORY", { manufacturer: "ABB", modules: 1 }), moduleSubtype: "SHUNT_TRIP" });
    expect(pick?.articleNumber).toBe("2CDS200909R0002");
    // Každý nový kus má zdroj z oficiálních dat výrobce, EAN u ABB, OEZ a Hager
    for (const row of ACCESSORY_COMPONENTS) {
      expect(row.source).toMatch(/ABB|OEZ|Hager|Schneider/);
      if (row.manufacturer !== "Schneider") expect(row.ean).toMatch(/^\d{13}$/);
    }
  });
});

describe("fáze 114 – žaluziové BA-M a topné HA-M aktory ABB-free@home ve 4M i 8M", () => {
  const loads = (role: "blind" | "heating", count: number) => Array.from({ length: count }, (_, index) => ({ id: `${role}${index}`, room: "Obývák", role, powerW: 0, label: `${role} ${index + 1}` }));
  const plan = (role: "blind" | "heating", count: number) =>
    planSmartHome({ system: "abb_freeathome", loads: loads(role, count), busDevices: 4 })
      .modules.filter((unit) => unit.role === role)
      .map((unit) => `${unit.typeCode} ${unit.modules}M`);

  it("plánovač: 1–4 žaluzie = 4M BA-M-4.230.1.1, 5–8 = 8M BA-M-8.230.1.1; 1–6 topných okruhů = 4M HA-M-0.6.1, 7–12 = 8M HA-M-0.12.1", () => {
    for (const count of [1, 4]) expect(plan("blind", count)).toEqual(["BA-M-4.230.1.1 4M"]);
    for (const count of [5, 8]) expect(plan("blind", count)).toEqual(["BA-M-8.230.1.1 8M"]);
    for (const count of [1, 6]) expect(plan("heating", count)).toEqual(["HA-M-0.6.1 4M"]);
    for (const count of [7, 12]) expect(plan("heating", count)).toEqual(["HA-M-0.12.1 8M"]);
    expect(plan("blind", 12)).toEqual(["BA-M-8.230.1.1 8M", "BA-M-4.230.1.1 4M"]);
  });

  it("C3 Počet kanálů / šířka: jeden klik 4M ↔ 8M a v katalogu skutečný kus s EAN a šířkou", () => {
    const abb = { ...defaultConfig("SMART_HOME", { manufacturer: "ABB", modules: 4 }), smartSystem: "abb_freeathome", smartRole: "blind" };
    const field = (config: ItemConfig) => configFields(config).find((entry) => entry.key === "channels")!;
    expect(field(abb).label).toBe("Počet kanálů / šířka");
    expect(field(abb).options.map((option) => option.label)).toEqual(["Libovolný", "4× · 4M", "8× · 8M"]);
    expect(field({ ...abb, smartRole: "heating" }).options.map((option) => option.label)).toEqual(["Libovolný", "6× · 4M", "12× · 8M"]);
    const catalog: CatalogLike[] = CATALOG.filter((row) => row.manufacturer === "ABB").map((row, index) => ({
      id: `a${index}`,
      manufacturer: row.manufacturer,
      typeCode: row.typeCode,
      articleNumber: row.articleNumber,
      category: row.category,
      poles: row.poles,
      ratedCurrentA: row.ratedCurrentA,
      trippingCurve: null,
      breakingCapacityKa: null,
      rcdType: null,
      rcdSensitivityMa: null,
      spdType: null,
      surgeCurrentKa: null,
      contactConfig: null,
      coilVoltage: null,
      relaySubtype: null,
      moduleSubtype: row.moduleSubtype ?? null,
      modulesCount: row.modulesCount,
    }));
    const pick = (config: ItemConfig, label: string) => {
      const option = field(config).options.find((entry) => entry.label === label)!;
      return matchConfig(catalog, withOption(config, option.patch));
    };
    expect(pick(abb, "4× · 4M")).toMatchObject({ typeCode: "BA-M-4.230.1.1", modulesCount: 4 });
    expect(pick(abb, "8× · 8M")).toMatchObject({ typeCode: "BA-M-8.230.1.1", modulesCount: 8 });
    expect(pick({ ...abb, smartRole: "heating" }, "6× · 4M")).toMatchObject({ typeCode: "HA-M-0.6.1", modulesCount: 4 });
    expect(pick({ ...abb, smartRole: "heating" }, "12× · 8M")).toMatchObject({ typeCode: "HA-M-0.12.1", modulesCount: 8 });
    // EAN z oficiálních dat ABB (zadání uvádělo neexistující typy „.2.1“ a jiné EAN)
    const ean = (article: string) => CATALOG.find((row) => row.articleNumber === article)?.ean;
    expect([ean("2CDG510028R0011"), ean("2CDG510029R0011"), ean("2CDG510008R0011"), ean("2CDG510009R0011")]).toEqual(["4053546111347", "4053546111354", "4016779941815", "4016779941808"]);
    const fah = SMART_SYSTEMS.find((system) => system.id === "abb_freeathome")!;
    expect(fah.modules.filter((unit) => unit.role === "blind" || unit.role === "heating").map((unit) => [unit.typeCode, unit.modules, unit.lossW])).toEqual([
      ["BA-M-4.230.1.1", 4, 1.5],
      ["BA-M-8.230.1.1", 8, 3],
      ["HA-M-0.6.1", 4, 2],
      ["HA-M-0.12.1", 8, 4],
    ]);
  });
});
