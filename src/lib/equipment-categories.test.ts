import { describe, expect, it } from "vitest";

import { EQUIPMENT_CATEGORIES, PLACEABLE_TYPES, categoryOf, placementOf, roomInventoryLabel } from "./equipment-categories";
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

  it("inventární štítek místnosti", () => {
    expect(roomInventoryLabel(["APPLIANCE", "POWER_TOOL", "APPLIANCE", "EXTENSION_CORD", "WELDER"])).toBe("🔌 3× Spotřebič · 🛠️ 2× Nářadí");
    expect(roomInventoryLabel([])).toBe("");
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
