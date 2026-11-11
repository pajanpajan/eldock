import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { ABB_ETIM_COMPONENTS } from "@/lib/panel-builder/abb-etim-components.generated";
import { etimEnclosures } from "@/lib/panel-builder/etim-enclosures";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { applyEtimComponents } from "./catalog-sync";
import { createTestDb } from "./test-db";

// Fáze 94 nad SQLite: seed AI Panel Builderu zapíše ke kusům katalogu ABB data ETIM 9.0 (EAN, Pv, vestavná hloubka,
// technický list) a doplní rozvodnice ABB z ETIM do výběru skříně.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

describe("fáze 94 – data ABB ETIM 9.0 v katalogu", () => {
  it("jistič S201-C16 po seedu: EAN, ztrátový výkon a hloubka podle výrobce; rozvodnice ABB z ETIM ve výběru skříně", async () => {
    const result = await seedPanelBuilder(prisma, { external: false, demo: false });
    expect(result.failures).toEqual([]);
    expect(result.etim).toBeGreaterThanOrEqual(250);
    const mcb = await prisma.catalogComponent.findFirstOrThrow({ where: { articleNumber: "2CDS251001R0164" } });
    expect(mcb).toMatchObject({ ean: "4016779464406", powerLossWatts: 2.5, depthMm: 69 });
    expect(mcb.datasheetUrl).toBeTruthy();
    // Rozvodnice z ETIM navíc k ověřenému seznamu (řada, moduly, rozměry, krytí přesně podle dat výrobce)
    const sample = etimEnclosures()[0];
    const stored = await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: sample.articleNumber } });
    expect(stored).toMatchObject({ manufacturer: "ABB", series: sample.series, rows: sample.rows, modulesPerRow: sample.modulesPerRow, ipRating: sample.ipRating, dataSource: "MANUFACTURER_CATALOG" });
  });

  it("technický list ETIM nepřepíše odkaz, který kus už má; neznámá čísla se přeskočí", async () => {
    await seedPanelBuilder(prisma, { external: false, demo: false });
    const before = await prisma.catalogComponent.findFirstOrThrow({ where: { articleNumber: "2CDS251001R0164" } });
    await prisma.catalogComponent.update({ where: { id: before.id }, data: { datasheetUrl: "https://example.test/vlastni.pdf", ean: null } });
    const updated = await applyEtimComponents(prisma, { "2CDS251001R0164": { ...ABB_ETIM_COMPONENTS["2CDS251001R0164"], datasheetUrl: "https://example.test/etim.pdf" }, "NEEXISTUJE-1": { ean: "1" } });
    expect(updated).toBe(1);
    expect(await prisma.catalogComponent.findFirstOrThrow({ where: { id: before.id } })).toMatchObject({ datasheetUrl: "https://example.test/vlastni.pdf", ean: "4016779464406" });
  });
});
