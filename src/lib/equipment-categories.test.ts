import { describe, expect, it } from "vitest";

import { EQUIPMENT_CATEGORIES, PLACEABLE_TYPES, categoryOf, deviceBaseName, inventoryChipText, placementOf, roomInventoryGroups } from "./equipment-categories";
import { isPortable } from "./inspection-rules";

describe("kategorie zařízení ve Studiu", () => {
  it("unikátní barvy podle zadání a každý typ v právě jedné kategorii", () => {
    expect(Object.fromEntries(EQUIPMENT_CATEGORIES.map((category) => [category.key, category.color]))).toEqual({
      TR: "#f97316",
      R: "#eab308",
      STR: "#3b82f6",
      ROB: "#a855f7",
      TECH: "#10b981",
      SP: "#ec4899",
      RN: "#06b6d4",
    });
    expect(new Set(PLACEABLE_TYPES).size).toBe(PLACEABLE_TYPES.length);
    expect(categoryOf("CNC_MACHINE").key).toBe("STR");
    expect(categoryOf("OTHER").label).toBe("Ostatní");
  });

  it("spotřebiče a nářadí (přenosná zařízení) se přiřazují do místnosti, ostatní do jemného rastru", () => {
    for (const type of PLACEABLE_TYPES) expect(placementOf(type)).toBe(isPortable(type) ? "room" : "grid");
  });

  it("inventář místnosti sečtený podle názvu přístroje (místnost i tag se z názvu odstraní)", () => {
    expect(deviceBaseName("SP-0003 - Kávovar – Kancelář 1", "SP-0003")).toBe("Kávovar");
    expect(deviceBaseName("PC sestava")).toBe("PC sestava");
    const groups = roomInventoryGroups([
      ...Array.from({ length: 7 }, (_, i) => ({ name: "PC sestava – Kancelář 1", type: "APPLIANCE" as const, tag: `SP-0${i}` })),
      { name: "Prodlužovací přívod – Kancelář 1", type: "EXTENSION_CORD" },
      { name: "Prodlužovací přívod", type: "EXTENSION_CORD" },
      { name: "Kávovar – Kancelář 1", type: "APPLIANCE" },
      { name: "Svářečka", type: "WELDER" },
    ]);
    expect(groups.map(inventoryChipText)).toEqual(["🖥️ 7× PC sestava", "🔌 2× Prodlužovací přívod", "☕ 1× Kávovar", "⚡ 1× Svářečka"]);
    // vlastní dlaždice určí ikonu, neznámý přístroj dostane ikonu kategorie
    const custom = roomInventoryGroups([{ name: "Rychlovarná konvice", type: "APPLIANCE" }, { name: "Vysoušeč rukou", type: "APPLIANCE" }], [
      { key: "user-1", label: "Rychlovarná konvice", name: "Rychlovarná konvice", emoji: "🫖", type: "APPLIANCE" },
    ]);
    expect(custom.map(inventoryChipText)).toEqual(["🫖 1× Rychlovarná konvice", "🔌 1× Vysoušeč rukou"]);
    expect(roomInventoryGroups([])).toEqual([]);
  });
});

describe("produktové banery kroku 3", () => {
  it("každá kategorie má konkrétní šablony s typem z kategorie a dlaždici Vlastní zařízení", async () => {
    const { PRODUCT_TEMPLATES, customTemplate } = await import("./equipment-categories");
    for (const category of EQUIPMENT_CATEGORIES) {
      const templates = PRODUCT_TEMPLATES[category.key];
      expect(templates.length).toBeGreaterThan(0);
      for (const template of templates) expect(category.types).toContain(template.type);
      expect(customTemplate(category).label).toBe("Vlastní zařízení / Vytvořit nový Tag");
    }
    expect(PRODUCT_TEMPLATES.RN.map((template) => template.label)).toContain("Úhlová bruska");
    expect(PRODUCT_TEMPLATES.R.find((template) => template.key === "rh")?.root).toBe(true);
  });
});
