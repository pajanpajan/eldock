import { describe, expect, it } from "vitest";

import { PRODUCT_TEMPLATES, categoryByKey } from "./equipment-categories";
import {
  EMPTY_MENU,
  addTemplate,
  categoryLabel,
  menuTemplates,
  newerMenu,
  normalizeMenu,
  parseStudioMenu,
  removeTemplate,
  resetCategory,
  setCategoryLabel,
  studioMenuSchema,
  updateTemplate,
} from "./studio-menu";

describe("vlastní nabídka kroku 3 Studia", () => {
  it("bez úprav = výchozí kategorie a dlaždice", () => {
    expect(categoryLabel(EMPTY_MENU, categoryByKey("SP"))).toBe("Spotřebič");
    expect(menuTemplates(EMPTY_MENU, "SP")).toBe(PRODUCT_TEMPLATES.SP);
  });

  it("rozdělení „Kávovar / Rychlovarná konvice“ na dvě dlaždice s vlastními prefixy, přejmenování kategorie", () => {
    let menu = updateTemplate(EMPTY_MENU, "SP", "coffee", { label: "Kávovar", prefix: "kav" }, 1000);
    const added = addTemplate(menu, "SP", { label: "Rychlovarná konvice", prefix: "rk-", emoji: "🫖" }, 2000);
    menu = setCategoryLabel(added.menu, "SP", "Spotřebiče kanceláří", 3000);
    const list = menuTemplates(menu, "SP");
    expect(list.find((entry) => entry.key === "coffee")).toMatchObject({ label: "Kávovar", name: "Kávovar", prefix: "KAV" });
    expect(list.at(-1)).toMatchObject({ label: "Rychlovarná konvice", name: "Rychlovarná konvice", emoji: "🫖", type: "APPLIANCE", prefix: "RK-" });
    expect(added.template.key).toMatch(/^user-/);
    expect(categoryLabel(menu, categoryByKey("SP"))).toBe("Spotřebiče kanceláří");
    expect(menu.updatedAt).toBe(3000);
    // smazání dlaždice a návrat k výchozí nabídce
    expect(menuTemplates(removeTemplate(menu, "SP", "vacuum"), "SP").some((entry) => entry.key === "vacuum")).toBe(false);
    const reset = resetCategory(menu, "SP", 4000);
    expect(menuTemplates(reset, "SP")).toBe(PRODUCT_TEMPLATES.SP);
    expect(categoryLabel(reset, categoryByKey("SP"))).toBe("Spotřebič");
  });

  it("rozepsaný prázdný název se při uložení vrátí na výchozí / původní", () => {
    const typing = updateTemplate(setCategoryLabel(EMPTY_MENU, "RN", "  ", 10), "RN", "grinder", { label: "" }, 20);
    expect(categoryLabel(typing, categoryByKey("RN"))).toBe("Ruční nářadí");
    const clean = normalizeMenu(typing);
    expect(clean.labels.RN).toBeUndefined();
    expect(menuTemplates(clean, "RN").find((entry) => entry.key === "grinder")?.label).toBe("Úhlová bruska");
    expect(studioMenuSchema.safeParse(clean).success).toBe(true);
  });

  it("načtení z JSON: neplatná data se zahodí, typ mimo kategorii a duplicitní klíč se vyřadí, novější verze vyhrává", () => {
    expect(parseStudioMenu("{rozbité")).toBeNull();
    expect(parseStudioMenu(JSON.stringify({ updatedAt: 1, labels: {}, templates: { SP: [{ key: "x", label: "X", emoji: "x", type: "APPLIANCE", name: "X", prefix: "bad prefix" }] } }))).toBeNull();
    const parsed = parseStudioMenu(
      JSON.stringify({
        updatedAt: 5,
        labels: { SP: "Kancelář" },
        templates: {
          SP: [
            { key: "a", label: "Kávovar", emoji: "☕", type: "APPLIANCE", name: "Kávovar" },
            { key: "a", label: "Duplicita", emoji: "☕", type: "APPLIANCE", name: "Duplicita" },
            { key: "b", label: "Robot", emoji: "🤖", type: "ROBOT_CELL", name: "Robot" },
          ],
        },
      }),
    )!;
    expect(parsed.templates.SP?.map((entry) => entry.key)).toEqual(["a"]);
    expect(newerMenu(parsed, { ...EMPTY_MENU, updatedAt: 9 }).updatedAt).toBe(9);
    expect(newerMenu(parsed, null)).toBe(parsed);
    expect(newerMenu(null, null)).toBe(EMPTY_MENU);
  });
});
