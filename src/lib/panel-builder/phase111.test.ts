import { describe, expect, it } from "vitest";

import { buildSwitchboardFromCircuits, type SmartBoardModule } from "@/engine/floorplan-bridge";

import { enclosureRails, enclosureLayout, railLimits } from "./enclosure-choice";
import { enclosureFields, enclosureNeed, fitsEnclosure, type EnclosureLike } from "./enclosures";
import { layoutPreviewDto } from "./layout-options";
import {
  CONCEPT_INFO,
  RAIL_RESERVE,
  SINGLE_LAYOUT,
  enclosurePmax,
  layoutAfterRailRemoved,
  layoutNeed,
  layoutOptions,
  matchLayoutEnclosures,
  packRails,
  parseRailLayout,
  planLayout,
  projectGroups,
  railFillLimit,
  railPlacement,
  serializeRailLayout,
  withFields,
  type PackGroup,
} from "./rail-layout";
import { vectorLayout, wiringPaths } from "./vector-layout";

// Fáze 111: uspořádání skříně a lišt – komprimace skupin s rezervou, koncepce (dvoupolová skříň Silnoproud |
// Slaboproud, široké 24M, kompaktní 18M, dva rozváděče) a párování se skutečnými skříněmi z databáze.

type Dev = { id: string; modules: number; powerLossW?: number; designation?: string; label?: string };
const dev = (id: string, modules: number, loss = 1): Dev => ({ id, modules, powerLossW: loss, designation: id, label: id });
const keepGroup = (...devices: Dev[]): PackGroup<Dev> => ({ devices, keepTogether: true, low: false });
const splitGroup = (...devices: Dev[]): PackGroup<Dev> => ({ devices, keepTogether: false, low: false });

/** Rodinný dům se Smart Home: hlavní vypínač + svodič + svorkovnice, 4 chrániče, 3 jističochrániče, ovládání + moduly. */
function familyHouse(): PackGroup<Dev>[] {
  return [
    keepGroup(dev("-Q1", 3), dev("-FV1", 4), dev("-X1", 4)),
    keepGroup(dev("-FI1", 4), dev("-F1", 1), dev("-F2", 1), dev("-F3", 1)),
    keepGroup(dev("-FI2", 4), dev("-F4", 1), dev("-F5", 1), dev("-F6", 1), dev("-F7", 1)),
    keepGroup(dev("-FI3", 4), dev("-F8", 1), dev("-F9", 1), dev("-F10", 1)),
    keepGroup(dev("-FI4", 4), dev("-F11", 3), dev("-F12", 1)),
    splitGroup(dev("-FA1", 2), dev("-FA2", 2), dev("-FA3", 2)),
    {
      devices: [dev("-F18", 1), dev("-T1", 4, 6), dev("-A1", 4, 4), dev("-A2", 4, 4), dev("-A3", 4, 4), dev("-A4", 4, 4), dev("-A5", 4, 4), dev("-A6", 4, 4), dev("-A7", 2, 2)],
      keepTogether: true,
      low: true,
      ownRail: true,
      powerLead: 1,
    },
  ];
}

const enclosure = (patch: Partial<EnclosureLike> & Pick<EnclosureLike, "id" | "model" | "rows" | "modulesPerRow">): EnclosureLike => ({
  manufacturer: "ABB",
  series: "test",
  articleNumber: patch.id,
  totalModules: patch.rows * patch.modulesPerRow,
  widthMm: 600,
  heightMm: 900,
  depthMm: 150,
  ipRating: "IP41",
  installation: "SURFACE",
  material: "PLASTIC",
  pMaxW: null,
  dataSource: "MANUFACTURER_CATALOG",
  ...patch,
});

/** Výběr skutečných rozvodnic z databáze (názvy, objednací čísla a rozměry jako v katalogu). */
const DB: EnclosureLike[] = [
  enclosure({ id: "2CPX052186R9999", series: "ComfortLine CA (rozteč 125 mm)", model: "CA25V (2 pole po 12 M)", rows: 5, modulesPerRow: 24 }),
  enclosure({ id: "2CPX052187R9999", series: "ComfortLine CA (rozteč 125 mm)", model: "CA26V (2 pole po 12 M)", rows: 6, modulesPerRow: 24 }),
  enclosure({ id: "2CPX052188R9999", series: "ComfortLine CA (rozteč 125 mm)", model: "CA27V (2 pole po 12 M)", rows: 7, modulesPerRow: 24 }),
  enclosure({ id: "STD-ABB-MISTRAL41W-120M", series: "Mistral41W", model: "Mistral41W 120M 5×24", rows: 5, modulesPerRow: 24, pMaxW: 101, dataSource: "STANDARD_MATRIX" }),
  enclosure({ id: "2CPX052150R9999", series: "ComfortLine Compact CA", model: "CA25", rows: 5, modulesPerRow: 24 }),
  enclosure({ id: "STD-ABB-MISTRAL41W-144M", series: "Mistral41W", model: "Mistral41W 144M 6×24", rows: 6, modulesPerRow: 24, pMaxW: 119, dataSource: "STANDARD_MATRIX" }),
  enclosure({ id: "1SPE007717F1121", series: "Mistral41W", model: "Mistral41W 41P18X42A (průhledná dvířka)", rows: 4, modulesPerRow: 18 }),
  enclosure({ id: "STD-ABB-MISTRAL41W-72M", series: "Mistral41W", model: "Mistral41W 72M 4×18", rows: 4, modulesPerRow: 18, pMaxW: 70, dataSource: "STANDARD_MATRIX" }),
  enclosure({ id: "STD-ABB-UK600-48M", series: "UK600", model: "UK600 48M 4×12", rows: 4, modulesPerRow: 12, pMaxW: 55, dataSource: "STANDARD_MATRIX" }),
  enclosure({ id: "STD-ABB-UK600-60M", series: "UK600", model: "UK600 60M 5×12", rows: 5, modulesPerRow: 12, pMaxW: 65, dataSource: "STANDARD_MATRIX" }),
  enclosure({ id: "STD-EATON-KLV-36M", manufacturer: "Eaton", series: "KLV", model: "KLV-36UPS-F 3×12", rows: 3, modulesPerRow: 12, pMaxW: 45, dataSource: "STANDARD_MATRIX" }),
];

describe("fáze 111 – komprimace lišt (packRails)", () => {
  it("rezerva lišty ~15 %: 12M → 10 M, 18M → 15 M, 24M → 20 M, 36M → 30 M", () => {
    expect(RAIL_RESERVE).toBe(0.15);
    expect([12, 18, 24, 36].map(railFillLimit)).toEqual([10, 15, 20, 30]);
  });

  it("skupina chrániče nezůstane sama na poloprázdné liště – jističochrániče a samostatný jistič vyplní mezery", () => {
    const rails = packRails(
      [keepGroup(dev("-Q1", 3), dev("-FV1", 4), dev("-X1", 4)), keepGroup(dev("-FI1", 4), dev("-F1", 1), dev("-F2", 1), dev("-F3", 1)), keepGroup(dev("-FI2", 4), dev("-F4", 1), dev("-F5", 1), dev("-F6", 1), dev("-F7", 1)), splitGroup(dev("-FA1", 2), dev("-FA2", 2), dev("-FA3", 2)), splitGroup(dev("-F18", 1))],
      12,
    );
    // Dříve: 11 | 7 | 8 | 6 | 1 (každá skupina na nové liště); nyní 3 lišty a žádná s jedinou poloprázdnou skupinou
    expect(rails.map((rail) => rail.used)).toEqual([11, 12, 10]);
    const ids = rails.map((rail) => rail.devices.map((device) => device.id));
    expect(ids[1].slice(0, 4)).toEqual(["-FI1", "-F1", "-F2", "-F3"]);
    expect(ids[1]).toEqual(expect.arrayContaining(["-FA1", "-F18"]));
    expect(ids[2].slice(0, 5)).toEqual(["-FI2", "-F4", "-F5", "-F6", "-F7"]);
    // Skupina chrániče je vždy celá na jedné liště
    for (const group of [["-FI1", "-F1", "-F2", "-F3"], ["-FI2", "-F4", "-F5", "-F6", "-F7"]]) expect(ids.filter((rail) => group.some((id) => rail.includes(id)))).toHaveLength(1);
  });

  it("skupina širší než lišta začne na nové liště; vlastní lišta (Smart Home) jen na nových lištách", () => {
    const rails = packRails([keepGroup(dev("a", 2)), keepGroup(dev("FI", 4), ...Array.from({ length: 10 }, (_, i) => dev(`F${i}`, 1))), { devices: [dev("lo", 4)], keepTogether: true, low: true, ownRail: true }], 12);
    expect(rails.map((rail) => rail.used)).toEqual([2, 12, 2, 4]);
    expect(rails[1].devices[0].id).toBe("FI");
    expect(rails[3].devices.map((device) => device.id)).toEqual(["lo"]);
  });
});

describe("fáze 111 – koncepce uspořádání skříně", () => {
  it("dvoupolová skříň: silnoproud v poli A, slaboproud s jističem řídicích obvodů v poli B, řady = víc lišt pole", () => {
    const plan = planLayout(familyHouse(), "two_field");
    expect(plan.layout).toMatchObject({ concept: "two_field", fields: 2, fieldBLow: true });
    const a = plan.rails.filter((rail) => rail.field === 0);
    const b = plan.rails.filter((rail) => rail.field === 1);
    expect(plan.layout.fieldARails).toBe(a.length);
    expect(a.every((rail) => rail.capacity === 12) && b.every((rail) => rail.capacity === 12)).toBe(true);
    expect(b[0].devices[0].id).toBe("-F18");
    expect(b.flatMap((rail) => rail.devices).every((device) => ["-F18", "-T1"].includes(device.id) || device.id.startsWith("-A"))).toBe(true);
    const need = layoutNeed(plan.rails, 2, 40);
    expect(need).toMatchObject({ fields: 2, fieldWidth: 12, rows: Math.max(a.length, b.length) });
  });

  it("široké 24M lišty: silnoproud nahoře, slaboproud dole za přepážkou; kompaktní 18M stejně", () => {
    const wide = planLayout(familyHouse(), "wide24");
    expect(wide.rails.every((rail) => rail.capacity === 24)).toBe(true);
    const power = wide.rails.filter((rail) => !rail.low).length;
    expect(wide.layout.partitionAfterRail).toBe(power);
    expect(wide.rails.slice(power).every((rail) => rail.low)).toBe(true);
    const compact = planLayout(familyHouse(), "compact18");
    expect(compact.rails.every((rail) => rail.capacity === 18)).toBe(true);
    expect(compact.layout.partitionAfterRail).toBeGreaterThan(0);
  });

  it("dva rozváděče: jistič řídicích obvodů zůstává v RH1 jako přívod RH2, moduly a zdroj v RH2", () => {
    const plan = planLayout(familyHouse(), "two_boards");
    const main = plan.rails.flatMap((rail) => rail.devices.map((device) => device.id));
    const second = plan.second!.flatMap((rail) => rail.devices.map((device) => device.id));
    expect(main).toContain("-F18");
    expect(second).not.toContain("-F18");
    expect(second[0]).toBe("-T1");
    expect(second).toEqual(expect.arrayContaining(["-A1", "-A7"]));
  });

  it("ke každé koncepci skutečné skříně z databáze; s chytrou domácností doporučená dvoupolová skříň", () => {
    const options = layoutOptions(familyHouse(), DB, { manufacturer: "ABB" });
    expect(options.map((option) => option.concept)).toEqual(["two_field", "wide24", "compact18", "two_boards"]);
    const byConcept = Object.fromEntries(options.map((option) => [option.concept, option]));
    expect(byConcept.two_field.recommended).toBe(true);
    expect(byConcept.two_field.main.matches[0].enclosure.model).toMatch(/^CA2[5-7]V \(2 pole po 12 M\)$/);
    expect(byConcept.two_field.main.matches.every((match) => match.fields.fields === 2)).toBe(true);
    expect(byConcept.wide24.main.matches.every((match) => match.enclosure.modulesPerRow === 24 && match.fields.fields === 1)).toBe(true);
    // Katalog výrobce před orientační maticí při stejné velikosti (CA25 před Mistral41W 120M)
    expect(byConcept.wide24.main.matches[0].enclosure.model).toBe("CA25");
    expect(byConcept.two_boards.available).toBe(true);
    expect(byConcept.two_boards.second!.matches.length).toBeGreaterThan(0);
    for (const option of options.filter((candidate) => candidate.available)) expect(option.warning).toBeNull();
    // Kompaktní 18M: databáze má nejvýš 4 řady po 18 M – rozváděč se nevejde, koncepce ukáže důvod
    if (!byConcept.compact18.available) expect(byConcept.compact18.warning).toMatch(/V databázi není skříň pro \d+ řad/);
    const dto = layoutPreviewDto(options, { totalModules: 81, totalPowerLossW: 40, smart: true });
    expect(dto.options[0]).toMatchObject({ concept: "two_field", title: CONCEPT_INFO.two_field.title, fields: 2 });
    expect(dto.options[0].main.enclosures[0]).toMatchObject({ manufacturer: "ABB", fields: 2, fieldWidth: 12, verified: true, pMaxEstimated: true });
    expect(dto.options[0].main.enclosures[0].mpn).toMatch(/^2CPX0521\d{2}R9999$/);
  });

  it("P_max bez údaje výrobce = orientační odhad (skříň se nevyřadí); bez Smart Home doporučí nejmenší skříň", () => {
    const ca27 = DB.find((row) => row.model.startsWith("CA27V"))!;
    expect(enclosurePmax(ca27)).toEqual({ w: Math.round(10 + 168 * 0.55 + 7 * 5), estimated: true });
    expect(enclosurePmax(DB[3])).toEqual({ w: 101, estimated: false });
    const plain = familyHouse().slice(0, 6);
    const options = layoutOptions(plain, DB, { manufacturer: "ABB" });
    expect(options.find((option) => option.concept === "two_field")!.plan.layout.fieldBLow).toBe(false);
    expect(options.filter((option) => option.recommended)).toHaveLength(1);
    // Ztráty nad P_max skříně → skříň nevyhoví
    const need = layoutNeed([{ capacity: 24, used: 20 }], 1, 500);
    expect(matchLayoutEnclosures(DB, need)).toHaveLength(0);
  });
});

describe("fáze 111 – pole skříně, krok 1b a editor lišt", () => {
  it("pole z názvu modelu, lišty a limity dvoupolové skříně", () => {
    expect(enclosureFields({ model: "CA27V (2 pole po 12 M)", modulesPerRow: 24 })).toEqual({ fields: 2, fieldWidth: 12 });
    expect(enclosureFields({ model: "CA35R (3 pole po 12 M)", modulesPerRow: 36 })).toEqual({ fields: 3, fieldWidth: 12 });
    expect(enclosureFields({ model: "Mistral41W 120M 5×24", modulesPerRow: 24 })).toEqual({ fields: 1, fieldWidth: 24 });
    const ca27 = { rows: 7, modulesPerRow: 24, model: "CA27V (2 pole po 12 M)" };
    expect(enclosureRails(ca27)).toEqual(Array.from({ length: 14 }, () => 12));
    expect(enclosureLayout(ca27)).toEqual({ fields: 2, fieldARails: 7 });
    expect(railLimits(ca27)).toEqual({ maxRails: 14, maxModules: 12 });
    expect(enclosureRails({ rows: 5, modulesPerRow: 24, model: "CA25" })).toEqual([24, 24, 24, 24, 24]);
  });

  it("krok 1b: 14 lišt po 12 M ve dvou polích najde dvoupolovou skříň se 7 řadami (pod sebou žádnou)", () => {
    const capacities = Array.from({ length: 14 }, () => 12);
    const items = Array.from({ length: 14 }, () => ({ modulesWidth: 8 }));
    const single = enclosureNeed(capacities, items);
    expect(DB.filter((row) => fitsEnclosure(row, single))).toHaveLength(0);
    const twoField = enclosureNeed(capacities, items, { fields: 2, fieldARails: 7 });
    expect(twoField).toMatchObject({ rails: 7, maxModulesPerRail: 12, fields: 2 });
    expect(DB.filter((row) => fitsEnclosure(row, twoField)).map((row) => row.model)).toEqual(["CA27V (2 pole po 12 M)"]);
  });

  it("uspořádání: uložení, kontrola proti počtu lišt, přepínač polí a smazání lišty", () => {
    const layout = { ...SINGLE_LAYOUT, concept: "two_field" as const, fields: 2 as const, fieldARails: 5, fieldBLow: true };
    expect(parseRailLayout(serializeRailLayout(layout), 8)).toEqual(layout);
    expect(parseRailLayout("{rozbité", 8)).toEqual(SINGLE_LAYOUT);
    expect(parseRailLayout(serializeRailLayout(layout), 3).fieldARails).toBe(2);
    expect(railPlacement(layout, 8).map((place) => `${place.field}:${place.row}`)).toEqual(["0:1", "0:2", "0:3", "0:4", "0:5", "1:1", "1:2", "1:3"]);
    expect(withFields(SINGLE_LAYOUT, 6, 2, 5)).toMatchObject({ fields: 2, fieldARails: 4, fieldBLow: true });
    expect(withFields(SINGLE_LAYOUT, 6, 2)).toMatchObject({ fields: 2, fieldARails: 3, fieldBLow: false });
    expect(withFields(layout, 8, 1)).toMatchObject({ fields: 1, partitionAfterRail: 5 });
    expect(layoutAfterRailRemoved(layout, 2, 8)).toMatchObject({ fields: 2, fieldARails: 4 });
    expect(layoutAfterRailRemoved({ ...SINGLE_LAYOUT, partitionAfterRail: 3 }, 1, 5)).toMatchObject({ partitionAfterRail: 2 });
  });

  it("plátno: dvě pole vedle sebe se svislou přepážkou, vodorovná přepážka a spojnice mezi poli", () => {
    const items = [
      { id: "q", dinRailIndex: 1, positionOnRail: 1, modulesWidth: 3 },
      { id: "f1", dinRailIndex: 2, positionOnRail: 1, modulesWidth: 1 },
      { id: "a1", dinRailIndex: 3, positionOnRail: 1, modulesWidth: 4 },
    ];
    const layout = vectorLayout(items, 3, [12, 12, 12], { fields: { aRails: 2, labels: ["Pole A – Silnoproud 230/400 V", "Pole B – Slaboproud / Smart Home"] } });
    expect(layout.fields).not.toBeNull();
    const [r1, r2, r3] = layout.rails;
    expect(r3).toMatchObject({ field: 1, row: 1 });
    expect(r3.top).toBe(r1.top);
    expect(r3.left).toBeGreaterThan(r1.right);
    expect(layout.rects.get("a1")!.x).toBe(r3.left);
    expect(layout.fields!.partitionX).toBeGreaterThan(r1.right);
    expect(layout.fields!.partitionX).toBeLessThan(r3.left);
    expect(r2.row).toBe(2);
    const wires = wiringPaths(layout, items, [{ id: "q", parentItemId: null, fedFromIncomer: true }, { id: "f1", parentItemId: "q", fedFromIncomer: false }, { id: "a1", parentItemId: "q", fedFromIncomer: false }], "TOP");
    // Propojka z pole A do pole B vede mezerou svislé přepážky
    const feed = wires.find((wire) => wire.from === "q" && wire.kind === "feed" && wire.points.some(([x]) => Math.abs(x - layout.fields!.partitionX) < 20));
    expect(feed).toBeDefined();
    const partition = vectorLayout(items, 3, 24, { partition: { afterRail: 2, label: "přepážka" } });
    expect(partition.partition!.y).toBeGreaterThan(partition.rails[1].top);
    expect(partition.partition!.y).toBeLessThan(partition.rails[2].top);
  });

  it("skupiny osazeného projektu: chránič s jističi, slaboproud s jističem řídicích obvodů na začátku", () => {
    const items = [
      { id: "q", dinRailIndex: 1, positionOnRail: 1, modulesWidth: 3, category: "MAIN_SWITCH", parentItemId: null },
      { id: "fv", dinRailIndex: 1, positionOnRail: 2, modulesWidth: 4, category: "SPD", parentItemId: "q" },
      { id: "fi", dinRailIndex: 2, positionOnRail: 1, modulesWidth: 4, category: "RCD", parentItemId: "q" },
      { id: "f1", dinRailIndex: 2, positionOnRail: 2, modulesWidth: 1, category: "MCB", parentItemId: "fi" },
      { id: "fa", dinRailIndex: 3, positionOnRail: 1, modulesWidth: 2, category: "RCBO", parentItemId: "q" },
      { id: "fc", dinRailIndex: 4, positionOnRail: 1, modulesWidth: 1, category: "MCB", parentItemId: "q" },
      { id: "psu", dinRailIndex: 4, positionOnRail: 2, modulesWidth: 4, category: "PSU", parentItemId: "fc" },
      { id: "act", dinRailIndex: 5, positionOnRail: 1, modulesWidth: 4, category: "PLC", parentItemId: "fc" },
    ];
    const groups = projectGroups(items);
    expect(groups.map((group) => group.devices.map((device) => device.id))).toEqual([["q", "fv"], ["fi", "f1"], ["fa"], ["fc", "psu", "act"]]);
    expect(groups[3]).toMatchObject({ low: true, powerLead: 1, keepTogether: true });
  });

  it("generátor z půdorysu: koncepce dvoupolové skříně se skříní z databáze a dva rozváděče (RH2 se Smart Home)", () => {
    const circuit = (id: string) => ({ id, label: `Zásuvky ${id}`, kind: "sockets", phases: 1, designW: 2000, rcd: "group", rooms: [id], protection: { device: "MCB", poles: "1P", ratedA: 16, curve: "B" } });
    const plan = { circuits: Array.from({ length: 14 }, (_, index) => circuit(`c${index + 1}`)), io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 }, bom: [] } as unknown as Parameters<typeof buildSwitchboardFromCircuits>[0];
    const smart: SmartBoardModule[] = Array.from({ length: 6 }, (_, index) => ({ role: "switch", label: `Spínací akční člen ${index + 1}`, manufacturer: "ABB", series: "ABB-free@home", typeCode: `SA-${index}`, articleNumber: null, modules: 4, powerLossW: 3, lossVerified: false }));
    const board = buildSwitchboardFromCircuits(plan, { mode: "bus_loxone", enclosures: DB, smart, layout: "two_field", manufacturer: "ABB" });
    expect(board.layout).toMatchObject({ fields: 2, fieldBLow: true });
    expect(board.enclosure?.model).toMatch(/\(2 pole po 12 M\)$/);
    expect(board.rails.every((rail) => rail.capacity === 12)).toBe(true);
    expect(board.warnings.filter((warning) => warning.includes("skříň"))).toEqual([]);
    const two = buildSwitchboardFromCircuits(plan, { mode: "bus_loxone", enclosures: DB, smart, layout: "two_boards", manufacturer: "ABB" });
    expect(two.second).not.toBeNull();
    expect(two.second!.devices.every((device) => device.category === "PLC" || device.category === "PSU")).toBe(true);
    expect(two.devices.some((device) => device.label === "Ovládání a řídicí obvody")).toBe(true);
    expect(two.second!.enclosure).not.toBeNull();
    // Bez koncepce a bez vyhovující skříně pod sebou: automaticky koncepce s poli / širokými lištami (vždy skutečná skříň)
    const auto = buildSwitchboardFromCircuits(plan, { mode: "bus_loxone", enclosures: DB.filter((row) => row.pMaxW === null), smart, manufacturer: "ABB" });
    expect(auto.enclosure).not.toBeNull();
    expect(auto.warnings.some((warning) => warning.startsWith("Lišty pod sebou se nevejdou do žádné skříně – zvoleno uspořádání"))).toBe(true);
  });
});
