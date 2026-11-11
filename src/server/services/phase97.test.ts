import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { BRAND_ENCLOSURE_FIXES, BRAND_ETIM_COMPONENTS } from "@/lib/panel-builder/brand-etim-components.generated";

import { applyEnclosureFixes } from "./catalog-sync";
import { createTestDb } from "./test-db";

// Fáze 97 nad SQLite: řady × moduly rozvodnice z externí databáze opravené podle dat výrobce (Hager ETIM 10 potvrzený
// popisem výrobce) a data DIN přístrojů OEZ ze stránek výrobce pro seed.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

describe("fáze 97 – data výrobců v databázi", () => {
  it("rozvodnice golf VF212TD: 2 × 12 podle výrobce místo 1 × 12, zdroj v popisu, data výrobce", async () => {
    expect(BRAND_ENCLOSURE_FIXES.VF212TD).toMatchObject({ rows: 2, modulesPerRow: 12, totalModules: 24 });
    expect(BRAND_ENCLOSURE_FIXES.VF212TD.source).toMatch(/2-řadá, 24 mod/);
    await prisma.panelEnclosure.create({ data: { manufacturer: "Hager", series: "golf", model: "Golf VF212TD", articleNumber: "VF212TD", rows: 1, modulesPerRow: 12, totalModules: 12, widthMm: 352, heightMm: 418, depthMm: 98, ipRating: "IP40", installation: "FLUSH", dataSource: "EXTERNAL" } });
    expect(await applyEnclosureFixes(prisma)).toBe(1);
    expect(await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "VF212TD" } })).toMatchObject({ rows: 2, modulesPerRow: 12, totalModules: 24, dataSource: "MANUFACTURER_CATALOG" });
    // Opakované spuštění (každý start kontejneru) nic nerozbije
    expect(await applyEnclosureFixes(prisma)).toBe(1);
  });

  it("jističe OEZ: EAN s kontrolní číslicí a hloubka ze stránky výrobce u objednacího čísla katalogu", () => {
    expect(BRAND_ETIM_COMPONENTS["OEZ:41638"]).toMatchObject({ ean: "8590125416388", depthMm: 79.7 });
    const oez = Object.entries(BRAND_ETIM_COMPONENTS).filter(([key]) => key.startsWith("OEZ:"));
    expect(oez.length).toBeGreaterThan(300);
    expect(oez.every(([, data]) => !data.ean || /^\d{13}$/.test(data.ean))).toBe(true);
  });
});
