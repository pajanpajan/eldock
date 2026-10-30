import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODULE_CONFIG,
  FEATURE_KEYS,
  PRESETS,
  effectiveFeatures,
  featureForPath,
  matchingPreset,
  moduleConfigFrom,
  resolveHome,
  roleImpact,
} from "./modules";

const all = effectiveFeatures(DEFAULT_MODULE_CONFIG);

describe("registr modulů a podfunkcí", () => {
  it("výchozí stav: vše zapnuté kromě připravované AI funkce, režim obchodní demo", () => {
    expect(moduleConfigFrom([], [], null)).toEqual(DEFAULT_MODULE_CONFIG);
    expect(all["cae.visual_diff"]).toBe(true);
    expect(all["enterprise.ai_panel_builder"]).toBe(false);
    expect(DEFAULT_MODULE_CONFIG.displayMode).toBe("UPSELL");
  });

  it("podfunkce je účinná jen se zapnutým modulem; neznámé klíče a labs se ignorují", () => {
    const config = moduleConfigFrom(
      [{ key: "CAE_ADVANCED", enabled: false }, { key: "NEZNAMY", enabled: false }],
      [{ key: "inspections.alerts", enabled: false }, { key: "enterprise.ai_panel_builder", enabled: true }],
      "CLEAN",
    );
    const flags = effectiveFeatures(config);
    expect(config.features["cae.visual_diff"]).toBe(true);
    expect(flags["cae.visual_diff"]).toBe(false);
    expect(flags["inspections.alerts"]).toBe(false);
    expect(flags["inspections.planner"]).toBe(true);
    expect(flags["enterprise.ai_panel_builder"]).toBe(false);
    expect(config.displayMode).toBe("CLEAN");
  });

  it("presety tarifů a rozpoznání aktuálního tarifu", () => {
    const start = PRESETS.START.apply(DEFAULT_MODULE_CONFIG);
    expect(start.displayMode).toBe("CLEAN");
    expect(FEATURE_KEYS.some((key) => effectiveFeatures(start)[key])).toBe(false);
    const profi = PRESETS.PROFI.apply(DEFAULT_MODULE_CONFIG);
    expect(effectiveFeatures(profi)["inspections.planner"]).toBe(true);
    expect(effectiveFeatures(profi)["cae.ticketing"]).toBe(false);
    expect(matchingPreset(start)).toBe("START");
    expect(matchingPreset(DEFAULT_MODULE_CONFIG)).toBe("ENTERPRISE");
    expect(matchingPreset({ ...DEFAULT_MODULE_CONFIG, features: { ...DEFAULT_MODULE_CONFIG.features, "cae.hotspots": false } })).toBeNull();
  });

  it("přiřadí cesty k podfunkcím", () => {
    expect(featureForPath("/inspections/rapid")).toBe("inspections.planner");
    expect(featureForPath("/inspections/report/abc")).toBe("inspections.pdf_reports");
    expect(featureForPath("/api/cron/inspection-alerts")).toBe("inspections.alerts");
    expect(featureForPath("/cae/tickets/x")).toBe("cae.ticketing");
    expect(featureForPath("/studio")).toBe("enterprise.studio");
    expect(featureForPath("/inspections")).toBeNull();
  });

  it("domovská stránka bez plánovače spadne na přehled revizí, CAE zůstává na /cae", () => {
    const start = effectiveFeatures(PRESETS.START.apply(DEFAULT_MODULE_CONFIG));
    expect(resolveHome("/inspections/rapid", start)).toBe("/inspections");
    expect(resolveHome("/inspections/planner", all)).toBe("/inspections/planner");
    expect(resolveHome("/cae", start)).toBe("/cae");
  });

  it("matice dopadu na role: ředitel ztratí Studio, údržbář kreslení do fotek", () => {
    const flags = effectiveFeatures({ ...DEFAULT_MODULE_CONFIG, modules: { ...DEFAULT_MODULE_CONFIG.modules, ENTERPRISE_TOOLS: false }, features: { ...DEFAULT_MODULE_CONFIG.features, "cae.canvas_annotation": false } });
    const impact = Object.fromEntries(roleImpact(flags).map((role) => [role.accountType, role]));
    expect(impact.PLANT_ADMIN.hidden).toContain("Studio výstavby závodu");
    expect(impact.MAINTENANCE_TECH.hidden).toEqual(["Kreslení do fotek"]);
    expect(impact.MAINTENANCE_TECH.available).toContain("Hlášení změny (červenka)");
    expect(impact.CAE_ENGINEER.available).toContain("CAE back-office (tickety)");
    expect(impact.CAE_ENGINEER.available).not.toContain("Hlášení změny (červenka)");
    expect(roleImpact(all)).toHaveLength(6);
  });
});
