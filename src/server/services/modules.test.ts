import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_MODULE_CONFIG, effectiveFeatures } from "@/lib/modules";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { applyPreset, assertFeatureEnabled, loadModuleConfig, setDisplayMode, setFeatureEnabled, setModuleEnabled } from "./modules";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(async () => db.cleanup());

describe("konfigurace modulů a tarifů", () => {
  it("výchozí stav: vše zapnuté, obchodní demo", async () => {
    expect(await loadModuleConfig(prisma)).toEqual(DEFAULT_MODULE_CONFIG);
  });

  it("modul, podfunkce a režim; Core ani připravovanou funkci zapnout / vypnout nejde", async () => {
    expect((await setModuleEnabled(prisma, "CAE_ADVANCED", false, "u")).modules.CAE_ADVANCED).toBe(false);
    const config = await setFeatureEnabled(prisma, "inspections.alerts", false, "u");
    expect(effectiveFeatures(config)["inspections.alerts"]).toBe(false);
    expect(effectiveFeatures(config)["inspections.planner"]).toBe(true);
    expect((await setDisplayMode(prisma, "CLEAN", "u")).displayMode).toBe("CLEAN");
    await expect(setModuleEnabled(prisma, "CORE", false, "u")).rejects.toBeInstanceOf(WorkflowError);
    await expect(setFeatureEnabled(prisma, "enterprise.ai_panel_builder", true, "u")).rejects.toBeInstanceOf(WorkflowError);
    await expect(setFeatureEnabled(prisma, "neznama", true, "u")).rejects.toBeInstanceOf(WorkflowError);
  });

  it("preset START vypne všechny add-ony a přepne na čisté pracoviště, KOMPLET vše zapne", async () => {
    await setFeatureEnabled(prisma, "cae.hotspots", false, "u");
    const start = await applyPreset(prisma, "START", "u");
    expect(start.displayMode).toBe("CLEAN");
    expect(Object.values(effectiveFeatures(start)).some(Boolean)).toBe(false);
    const enterprise = await applyPreset(prisma, "ENTERPRISE", "u");
    expect(enterprise.displayMode).toBe("CLEAN");
    expect(effectiveFeatures(enterprise)["cae.hotspots"]).toBe(true);
    expect(effectiveFeatures(enterprise)["enterprise.studio"]).toBe(true);
  });

  it("ochrana akcí odmítne vypnutou funkci", () => {
    const flags = effectiveFeatures({ ...DEFAULT_MODULE_CONFIG, features: { ...DEFAULT_MODULE_CONFIG.features, "enterprise.csv_import": false } });
    expect(() => assertFeatureEnabled(flags, "enterprise.csv_import")).toThrow("Hromadný import");
    expect(() => assertFeatureEnabled(flags, "enterprise.studio")).not.toThrow();
  });
});
