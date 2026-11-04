import { describe, expect, it } from "vitest";

import { filterBrands, DEVICE_BRANDS, brandOf } from "./brands";
import { ACCESSORY_SUBTYPES, CONFIG_CATEGORIES, CONFIG_FIELDS, catalogCategory, configFromComponent, defaultConfig, describeConfig, matchConfig, toConfigCategory, type CatalogLike } from "./configurator";
import { ENCLOSURE_MANUFACTURERS, STANDARD_SIZES, enclosureNeed, enclosureProjectData, fitEnclosures, fitsEnclosure, ipNumber, reservePercent, sizeLayout, standardEnclosureMatrix, type EnclosureLike } from "./enclosures";
import { labelRows, labelStrips, labelsCsv, splitStrip, stripColors, PHASE_COLORS, type LabelDevice } from "./labels";
import { formatRailSummary, freeOnRail, railCapacities, railColumns, railMoveTarget, railSummary, withRailAdded, withRailCapacity, withRailRemoved, withRailsSwapped } from "./rails";
import { vectorLayout } from "./vector-layout";
import type { VectorDevice } from "./vector-symbols";

describe("DIN lišty návrhu od nuly (fáze 43)", () => {
  it("kapacity z JSON, jinak modulesPerRail; doplnění chybějících lišt poslední šířkou", () => {
    expect(railCapacities({ dinRailsCount: 3, modulesPerRail: 12, railModulesJson: null })).toEqual([12, 12, 12]);
    expect(railCapacities({ dinRailsCount: 3, modulesPerRail: 12, railModulesJson: "[14,18]" })).toEqual([14, 18, 18]);
    expect(railCapacities({ dinRailsCount: 1, modulesPerRail: 12, railModulesJson: "nesmysl" })).toEqual([12]);
    expect(railCapacities({ dinRailsCount: 2, modulesPerRail: 12, railModulesJson: "[2, 99]" })).toEqual([4, 48]);
  });

  it("přidání, smazání, šířka, přesun a uložení", () => {
    expect(withRailAdded([12, 14])).toEqual([12, 14, 14]);
    expect(withRailRemoved([12, 14, 18], 2)).toEqual([12, 18]);
    expect(withRailRemoved([12], 1)).toEqual([12]);
    expect(withRailCapacity([12, 12], 2, 36)).toEqual([12, 36]);
    expect(withRailsSwapped([8, 12, 14], 1, 2)).toEqual([12, 8, 14]);
    expect(railMoveTarget(3, 1, -1)).toBeNull();
    expect(railMoveTarget(3, 3, 1)).toBeNull();
    expect(railMoveTarget(3, 2, 1)).toBe(3);
    expect(railColumns([12, 14])).toEqual({ railModulesJson: "[12,14]", dinRailsCount: 2, modulesPerRail: 14 });
  });

  it("živý indikátor: počet lišt, moduly, obsazenost a rezerva", () => {
    const items = [
      { dinRailIndex: 1, modulesWidth: 4 },
      { dinRailIndex: 1, modulesWidth: 1 },
      { dinRailIndex: 2, modulesWidth: 3 },
    ];
    expect(freeOnRail([12, 12], items, 1)).toBe(7);
    expect(formatRailSummary(railSummary([12, 12], items))).toBe("Konfigurace: 2 DIN lišty × 12 M · Obsazeno: 8 / 24 M (33 % · volná rezerva 67 %)");
    expect(formatRailSummary(railSummary([12], []))).toBe("Konfigurace: 1 DIN lišta × 12 M · Obsazeno: 0 / 12 M (0 % · volná rezerva 100 %)");
    expect(formatRailSummary(railSummary([12, 14, 12, 12, 12], [{ dinRailIndex: 1, modulesWidth: 0.5 }]))).toContain("5 DIN lišt × 12/14/12/12/12 M · Obsazeno: 0,5 / 62 M");
  });

  it("vektorový rozváděč: každá lišta má svou kapacitu, plátno podle nejširší", () => {
    const layout = vectorLayout([{ id: "a", dinRailIndex: 1, positionOnRail: 1, modulesWidth: 1 }], 2, [8, 14]);
    expect(layout.capacity).toBe(14);
    expect(layout.rails.map((rail) => rail.capacity)).toEqual([8, 14]);
    expect(layout.rails[0].x1).toBeLessThan(layout.rails[1].x1);
  });
});

const enclosure = (rows: number, perRow: number, extra: Partial<EnclosureLike> = {}): EnclosureLike => ({
  id: `${rows}x${perRow}`,
  manufacturer: "ABB",
  series: "Mistral41W",
  model: `Mistral41W ${rows * perRow}M`,
  articleNumber: `X-${rows}-${perRow}`,
  rows,
  modulesPerRow: perRow,
  totalModules: rows * perRow,
  widthMm: 300,
  heightMm: 500,
  depthMm: 120,
  ipRating: "IP41",
  installation: "SURFACE",
  material: "PLASTIC",
  pMaxW: 30,
  dataSource: "STANDARD_MATRIX",
  ...extra,
});

describe("výběr skříně podle velikosti návrhu", () => {
  const need = enclosureNeed([12, 14], [{ modulesWidth: 10 }, { modulesWidth: 8 }]);

  it("pravidlo zadání: řady ≥ lišty, moduly na řadu ≥ nejširší lišta, celkem ≥ obsazeno", () => {
    expect(need).toEqual({ rails: 2, maxModulesPerRail: 14, usedModules: 18 });
    expect(fitsEnclosure(enclosure(2, 12), need)).toBe(false); // řada 12 < 14
    expect(fitsEnclosure(enclosure(1, 18), need)).toBe(false); // 1 řada < 2 lišty
    expect(fitsEnclosure(enclosure(2, 14), need)).toBe(true);
    expect(reservePercent(enclosure(3, 14), need)).toBe(57);
  });

  it("bez výrobce nic, jinak jen vyhovující skříně výrobce od nejmenší; montáž a IP54+", () => {
    const list = [enclosure(4, 18), enclosure(2, 14), enclosure(2, 14, { id: "eaton", manufacturer: "Eaton" }), enclosure(3, 14, { id: "flush", installation: "FLUSH" }), enclosure(2, 24, { id: "ip65", ipRating: "IP65" })];
    expect(fitEnclosures(list, need, { manufacturer: null, mounting: "ALL" })).toEqual([]);
    expect(fitEnclosures(list, need, { manufacturer: "ABB", mounting: "ALL" }).map((row) => row.id)).toEqual(["2x14", "flush", "ip65", "4x18"]);
    expect(fitEnclosures(list, need, { manufacturer: "ABB", mounting: "FLUSH" }).map((row) => row.id)).toEqual(["flush"]);
    expect(fitEnclosures(list, need, { manufacturer: "ABB", mounting: "IP54" }).map((row) => row.id)).toEqual(["ip65"]);
    expect(ipNumber("IP4X")).toBe(40);
  });

  it("matice standardních rozvodnic 12–144M pro všech 8 výrobců", () => {
    const matrix = standardEnclosureMatrix();
    for (const manufacturer of ENCLOSURE_MANUFACTURERS) {
      const sizes = new Set(matrix.filter((row) => row.manufacturer === manufacturer).map((row) => row.totalModules));
      for (const size of STANDARD_SIZES) expect(sizes.has(size) || sizes.has(sizeLayout(size, true).rows * 14), `${manufacturer} ${size}M`).toBe(true);
    }
    expect(new Set(matrix.map((row) => row.articleNumber)).size).toBe(matrix.length);
    expect(sizeLayout(14)).toEqual({ rows: 1, perRow: 14 });
    expect(sizeLayout(144)).toEqual({ rows: 6, perRow: 24 });
    expect(matrix.every((row) => row.pMaxW && row.pMaxW > 0 && row.heightMm > row.rows * 100)).toBe(true);
  });

  it("vybraná skříň → parametry projektu a oteplení", () => {
    expect(enclosureProjectData(enclosure(3, 12, { installation: "FLUSH", material: "PAINTED_STEEL", pMaxW: 42 }))).toMatchObject({
      enclosureModel: "ABB Mistral41W 36M",
      enclosureType: "FLUSH_MOUNTED",
      enclosureMaterial: "PAINTED_STEEL",
      ipRating: "IP 41",
      enclosurePmaxW: 42,
    });
  });
});

const device = (id: string, rail: number, position: number, modules: number, extra: Partial<LabelDevice> = {}): LabelDevice => ({
  id,
  designation: `-F${id}`,
  dinRailIndex: rail,
  positionOnRail: position,
  modulesWidth: modules,
  category: "MCB",
  poles: "1P",
  manufacturer: "ABB",
  typeCode: "S201-B16",
  articleNumber: null,
  ratedCurrentA: 16,
  curve: "B",
  rcdType: null,
  rcdSensitivityMa: null,
  spdType: null,
  contactConfig: null,
  power: null,
  powerLossWatts: null,
  label: "Zásuvky kuchyně",
  status: "VERIFIED",
  phaseAssignment: "L1",
  parentItemId: null,
  ...extra,
});

describe("popisky 1:1", () => {
  it("políčko = fyzická šířka přístroje (17,5 / 18 mm), volné moduly na konci prázdné", () => {
    const devices = [device("1", 1, 1, 1), device("2", 1, 2, 3, { phaseAssignment: "L1,L2,L3", poles: "3P" })];
    const [strip] = labelStrips(devices, [12], 17.5);
    expect(strip.widthMm).toBe(210);
    expect(strip.cells.map((cell) => cell.widthMm)).toEqual([17.5, 52.5, ...Array(8).fill(17.5)]);
    expect(strip.cells[0]).toMatchObject({ designation: "-F1", value: "B16", label: "Zásuvky kuchyně", colors: [PHASE_COLORS.L1] });
    expect(strip.cells[1].colors).toEqual([PHASE_COLORS.L1, PHASE_COLORS.L2, PHASE_COLORS.L3]);
    expect(strip.cells.slice(2).every((cell) => cell.empty)).toBe(true);
    expect(labelStrips(devices, [12], 18)[0].cells[1].widthMm).toBe(54);
    // 210 mm > 190 mm: zbytek jen z prázdných modulů se netiskne; plný pás se rozdělí po přístrojích
    expect(splitStrip(strip).map((part) => part.length)).toEqual([8]);
    const full = labelStrips(Array.from({ length: 12 }, (_, i) => device(String(i + 1), 1, i + 1, 1)), [12], 17.5)[0];
    expect(splitStrip(full).map((part) => part.length)).toEqual([10, 2]);
  });

  it("barva skupiny podle nadřazeného prvku, když fáze chybí", () => {
    const groups = new Map([["fi1", 0], ["fi2", 1]]);
    expect(stripColors({ id: "x", phaseAssignment: null, parentItemId: "fi2" }, groups)).not.toEqual(stripColors({ id: "y", phaseAssignment: null, parentItemId: "fi1" }, groups));
  });

  it("export pro štítkovačky: CSV se středníkem a BOM, desetinná čárka", () => {
    const rows = labelRows([device("2", 1, 2, 1), device("1", 1, 1, 1, { label: 'Světla; "terasa"' })], 17.5);
    expect(rows[0][2]).toBe("Značení");
    expect(rows[1][2]).toBe("-F1");
    const csv = labelsCsv(rows);
    expect(csv.startsWith("﻿Lišta;Pozice;Značení")).toBe(true);
    expect(csv).toContain('"Světla; ""terasa"""');
    expect(csv).toContain(";17,5;");
  });
});

describe("kaskádové menu: výrobci a příslušenství", () => {
  it("21 výrobců z databáze (fáze 47 bez 9 odebraných značek), hledání bez diakritiky", () => {
    expect(DEVICE_BRANDS).toHaveLength(21);
    expect(DEVICE_BRANDS.some((brand) => brand.value === "Weidmüller" || brand.value === "Finder")).toBe(false);
    expect(filterBrands(DEVICE_BRANDS, "siem").map((brand) => brand.value)).toEqual(["Siemens"]);
    expect(filterBrands(DEVICE_BRANDS, "schneider electric")[0].value).toBe("Schneider");
    expect(brandOf("EATON")?.label).toBe("Eaton");
  });

  it("kategorie Svorky / Hřebeny / Příslušenství s podtypy a šířkou 0,5M", () => {
    expect(CONFIG_CATEGORIES.at(-1)).toEqual({ value: "ACCESSORY", label: "Svorky / Hřebeny / Příslušenství" });
    expect(CONFIG_FIELDS.ACCESSORY[0].options.map((option) => option.value)).toEqual(Object.keys(ACCESSORY_SUBTYPES));
    const config = defaultConfig("ACCESSORY", { manufacturer: "Eaton", modules: 1 });
    expect(config).toMatchObject({ moduleSubtype: "AUX_CONTACT", modules: 0.5 });
    expect(catalogCategory(config)).toBe("OTHER");
    expect(catalogCategory({ ...config, moduleSubtype: "TERMINAL_BLOCK" })).toBe("TERMINAL");
    expect(describeConfig({ ...config, moduleSubtype: "BUSBAR", poles: "3P" })).toBe("Hřebenová propojovací lišta 3P");
    expect(toConfigCategory("OTHER", "BUSBAR")).toBe("ACCESSORY");
    expect(toConfigCategory("OTHER", "METER")).toBe("OTHER");
    const aux: CatalogLike = { id: "aux", manufacturer: "Eaton", typeCode: "ZP-IHK", articleNumber: "EATON:286052", category: "OTHER", poles: "1P", ratedCurrentA: 3, trippingCurve: null, breakingCapacityKa: null, rcdType: null, rcdSensitivityMa: null, spdType: null, surgeCurrentKa: null, contactConfig: null, coilVoltage: null, relaySubtype: null, moduleSubtype: "AUX_CONTACT", modulesCount: 0.5 };
    expect(matchConfig([aux], config)?.id).toBe("aux");
    expect(configFromComponent(aux)?.category).toBe("ACCESSORY");
  });
});

// Typová kontrola: LabelDevice je VectorDevice s fází a rodičem
const _check: VectorDevice = device("t", 1, 1, 1);
void _check;
