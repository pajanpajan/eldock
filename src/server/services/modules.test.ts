import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { ALL_MODULES_ENABLED } from "@/lib/modules";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { assertModuleEnabled, loadModuleState, setModuleEnabled } from "./modules";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(async () => db.cleanup());

describe("konfigurace modulů", () => {
  it("výchozí stav: všechny moduly zapnuté", async () => {
    expect(await loadModuleState(prisma)).toEqual(ALL_MODULES_ENABLED);
  });

  it("vypne a znovu zapne add-on, Core vypnout nejde", async () => {
    expect(await setModuleEnabled(prisma, "CAE_ADVANCED", false, "u-boss")).toEqual({ ...ALL_MODULES_ENABLED, CAE_ADVANCED: false });
    expect((await setModuleEnabled(prisma, "CAE_ADVANCED", true, "u-boss")).CAE_ADVANCED).toBe(true);
    await expect(setModuleEnabled(prisma, "CORE", false, "u-boss")).rejects.toBeInstanceOf(WorkflowError);
  });

  it("ochrana akcí odmítne vypnutý modul", () => {
    expect(() => assertModuleEnabled({ ...ALL_MODULES_ENABLED, ENTERPRISE_TOOLS: false }, "ENTERPRISE_TOOLS", "Hromadné nástroje")).toThrow("Hromadné nástroje");
    expect(() => assertModuleEnabled(ALL_MODULES_ENABLED, "ENTERPRISE_TOOLS", "Hromadné nástroje")).not.toThrow();
  });
});
