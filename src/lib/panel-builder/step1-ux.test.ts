import { describe, expect, it } from "vitest";

import { DEFAULT_CHIPS, moveChip, newestChipSet, nextChipLabel, parseChipSet, presetConfig } from "./circuit-chips";
import { defaultConfig } from "./configurator";
import { ENVIRONMENTS, enclosureFitsEnvironment, environmentOf, ipLabel } from "./environments";
import { validateSwitchboardState, type LintDevice } from "./linter";

describe("štítky funkce obvodu se Smart Presety", () => {
  it("číslování: Chránič 1 → Chránič 2, nečíslovaný štítek se očísluje až při opakování", () => {
    const rcd = DEFAULT_CHIPS.find((chip) => chip.id === "rcd")!;
    expect(nextChipLabel(rcd, [])).toBe("Chránič 1");
    expect(nextChipLabel(rcd, ["Chránič 1", "Zásuvky"])).toBe("Chránič 2");
    expect(nextChipLabel(rcd, ["chránič 3", "Chránič 1"])).toBe("Chránič 4");
    expect(nextChipLabel({ label: "Zásuvky" }, ["Kuchyně"])).toBe("Zásuvky");
    expect(nextChipLabel({ label: "Zásuvky" }, ["Zásuvky"])).toBe("Zásuvky 2");
    expect(nextChipLabel({ label: "Světla 1+2" }, ["Světla 1+2"])).toBe("Světla 1+2 2");
  });

  it("preset → konfigurace (Varná deska = jistič 3P 3M B16, Chránič = 4P)", () => {
    expect(presetConfig({ category: "MCB", poles: "3P", curve: "B", ratedCurrentA: 16 }, "ABB")).toMatchObject({ category: "MCB", manufacturer: "ABB", poles: "3P", modules: 3, curve: "B", ratedCurrentA: 16 });
    expect(presetConfig({ category: "RCD", poles: "4P", ratedCurrentA: 40 }, null)).toMatchObject({ category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, rcdSensitivityMa: 30 });
    expect(presetConfig({ category: "RCD" }, null).curve).toBeUndefined();
  });

  it("uložení: neplatná data ignorovat, novější sada vyhrává, pořadí šipkami", () => {
    expect(parseChipSet("nesmysl")).toBeNull();
    expect(parseChipSet(JSON.stringify({ chips: [{ id: "a", label: "  Sauna " }, { id: "b", label: "" }], updatedAt: 5 }))).toEqual({ chips: [{ id: "a", label: "Sauna" }], updatedAt: 5 });
    const older = { chips: [{ id: "a", label: "A" }], updatedAt: 1 };
    const newer = { chips: [{ id: "b", label: "B" }], updatedAt: 2 };
    expect(newestChipSet(older, newer)).toBe(newer);
    expect(newestChipSet(null, null).chips).toHaveLength(DEFAULT_CHIPS.length);
    expect(moveChip(DEFAULT_CHIPS, 1, -1).slice(0, 2).map((chip) => chip.id)).toEqual(["rcd", "main"]);
  });
});

describe("prostředí instalace (ČSN 33 2000-5-51 ed. 3)", () => {
  it("min. krytí, teplota okolí a doporučení", () => {
    expect(ENVIRONMENTS).toHaveLength(5);
    expect(environmentOf("GARAGE")).toMatchObject({ minIp: 44, recommendedIp: 54, minIk: 7, ambientTempC: 25 });
    expect(environmentOf("HOT").ambientTempC).toBe(35);
    expect(environmentOf("TIMBER").notes.join(" ")).toMatch(/850 °C.*AFDD/);
    expect(environmentOf("nesmysl").id).toBe("INDOOR_DRY");
    expect(enclosureFitsEnvironment("IP 41", environmentOf("INDOOR_DRY"))).toBe(true);
    expect(enclosureFitsEnvironment("IP 41", environmentOf("GARAGE"))).toBe(false);
    expect(enclosureFitsEnvironment("IP65", environmentOf("OUTDOOR"))).toBe(true);
    expect(ipLabel(54)).toBe("IP 54");
  });
});

const dev = (id: string, rail: number, position: number, extra: Partial<LintDevice> = {}): LintDevice => ({
  id,
  designation: `-F${id}`,
  dinRailIndex: rail,
  positionOnRail: position,
  modulesWidth: 1,
  category: "MCB",
  poles: "1P",
  ratedCurrentA: 16,
  manufacturer: "ABB",
  typeCode: "S201-B16",
  label: "",
  parentItemId: null,
  config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }),
  ...extra,
});
const rules = (issues: ReturnType<typeof validateSwitchboardState>) => issues.map((issue) => issue.rule);

describe("elektro-linter validateSwitchboardState", () => {
  it("štítek vs. kategorie: „Chránič“ na jističi, „Hlavní vypínač“ na 1P jističi – oprava 1 klikem", () => {
    const issues = validateSwitchboardState({ devices: [dev("1", 1, 1, { label: "Chránič 1" }), dev("2", 1, 2, { label: "Hlavní vypínač" })], capacities: [12] });
    const [rcd, main] = issues.filter((issue) => issue.rule === "label-category");
    expect(rcd).toMatchObject({ severity: "error", itemIds: ["1"], fix: { kind: "configure", config: { category: "RCD" } } });
    expect(main.fix).toMatchObject({ kind: "configure", config: { category: "MAIN_SWITCH", poles: "3P" } });
    expect(rules(validateSwitchboardState({ devices: [dev("1", 1, 1, { label: "Jističochránič kuchyně", category: "RCBO" })], capacities: [12] }))).not.toContain("label-category");
  });

  it("popis 3P vs. 4P přístroj → synchronizace textu", () => {
    const issues = validateSwitchboardState({ devices: [dev("4", 2, 1, { typeCode: "Jistič 3P B16 6 kA", poles: "4P", modulesWidth: 4, config: { ...defaultConfig("MCB", { manufacturer: "ABB", modules: 4 }) } })], capacities: [12, 12] });
    expect(issues.find((issue) => issue.rule === "label-poles")).toMatchObject({ severity: "warning", fix: { kind: "sync-text" } });
    expect(rules(validateSwitchboardState({ devices: [dev("1", 1, 1, { typeCode: "Jistič 1P+N B16", poles: "1P+N" })], capacities: [12] }))).not.toContain("label-poles");
  });

  it("chybějící chránič pro zásuvky a přetížený chránič (víc než 6 okruhů)", () => {
    const missing = validateSwitchboardState({ devices: [dev("1", 1, 1, { label: "Zásuvky kuchyně" }), dev("2", 1, 2, { label: "Světla" })], capacities: [12] });
    expect(missing.find((issue) => issue.rule === "rcd-missing")).toMatchObject({ severity: "error", itemIds: ["1"], fix: { kind: "palette", config: { category: "RCD" } } });
    const rcd = dev("fi", 1, 1, { category: "RCD", poles: "4P", modulesWidth: 4, ratedCurrentA: 40, label: "Chránič 1" });
    const many = Array.from({ length: 7 }, (_, i) => dev(String(i + 1), 1, i + 2, { label: "Zásuvky" }));
    const overloaded = validateSwitchboardState({ devices: [rcd, ...many], capacities: [12] });
    expect(rules(overloaded)).toContain("rcd-overload");
    expect(rules(overloaded)).not.toContain("rcd-missing");
  });

  it("rezerva pod 20 % a smíchaní výrobci na liště (sjednocení na většinového)", () => {
    const full = Array.from({ length: 11 }, (_, i) => dev(String(i + 1), 1, i + 1, { manufacturer: i === 3 ? "Eaton" : "ABB", config: defaultConfig("MCB", { manufacturer: i === 3 ? "Eaton" : "ABB", modules: 1 }) }));
    const issues = validateSwitchboardState({ devices: full, capacities: [12] });
    expect(issues.find((issue) => issue.rule === "reserve")).toMatchObject({ fix: { kind: "add-rail" } });
    const mixed = issues.find((issue) => issue.rule === "mixed-busbar")!;
    expect(mixed.message).toContain("ABB + Eaton");
    expect(mixed.fix).toMatchObject({ kind: "configure-many", items: [{ itemId: "4", config: { manufacturer: "ABB" } }] });
    // Skříň s větší kapacitou než lišty = rezerva ze skříně
    expect(rules(validateSwitchboardState({ devices: full, capacities: [12], enclosureModules: 36 }))).not.toContain("reserve");
  });

  it("jmenovité proudy vůči hlavnímu vypínači a chránič slabší než jistič pod ním", () => {
    const main = dev("q", 1, 1, { designation: "-Q1", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 25, modulesWidth: 3, config: defaultConfig("MAIN_SWITCH", { manufacturer: "ABB", modules: 3, ratedCurrentA: 25 }) });
    const rcd = dev("fi", 1, 2, { designation: "-FI1", category: "RCD", poles: "4P", ratedCurrentA: 25, modulesWidth: 4, config: defaultConfig("RCD", { manufacturer: "ABB", modules: 4, ratedCurrentA: 25 }) });
    const big = dev("1", 1, 3, { ratedCurrentA: 32, config: { ...defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), ratedCurrentA: 32 } });
    const issues = validateSwitchboardState({ devices: [main, rcd, big], capacities: [12] }).filter((issue) => issue.rule === "rating");
    expect(issues.map((issue) => issue.fix?.label)).toEqual(["Snížit na 25 A", "Zvýšit na 40 A"]);
    expect(validateSwitchboardState({ devices: [], capacities: [12] })).toEqual([]);
  });
});
