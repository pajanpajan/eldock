import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import { enclosureSeries } from "@/lib/panel-builder/enclosure-choice";
import type { ExternalProduct } from "@/lib/panel-builder/external-catalog";

import { CATALOG, seedCatalog, seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importExternalCatalog } from "./catalog-sync";
import { listEnclosures, previewConfig } from "./panel-design";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

describe("fáze 88 – katalog ABB pro ČR v databázi", () => {
  it("seed: přístroje s objednacím číslem a produktovým listem ABB, vazby příslušenství", async () => {
    await seedPanelBuilder(prisma, { external: false });
    expect(await prisma.catalogComponent.count()).toBe(CATALOG.length);
    expect(await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CSF204101R1400" } })).toMatchObject({
      typeCode: "F204 A-40/0,03",
      series: "System pro M compact F200",
      category: "RCD",
      // Fáze 94: ztrátový výkon z oficiálních dat výrobce ABB ETIM 9.0 (EF005387) – už ne odhad podle IEC
      dataSource: "SEED_CATALOG",
      powerLossWatts: 9.6,
      ean: "8012542783503",
      externalSource: null,
      datasheetUrl: expect.stringMatching(/^https:\/\/nizke-napeti\.cz\.abb\.com\/f200-typ-a-10ka-sirka-4-moduly-17008\/.+\?mime=pdf$/),
    });
    const busbars = await prisma.catalogRelation.findMany({ where: { parent: { articleNumber: "2CSR255163R1165" } }, include: { child: true } });
    expect(busbars.map((row) => row.child.typeCode).sort()).toEqual(["PSc 1/114/10 N", "PSc 1/24/10 N", "PSc 3/114/10 N", "PSc 3/24/10 N"]);
    expect(busbars.every((row) => row.relationType === "COMPATIBLE_BUSBAR" && row.verified)).toBe(true);
    // Opakovaný seed nic nezdvojí
    const relations = await prisma.catalogRelation.count();
    await seedCatalog(prisma);
    expect(await prisma.catalogRelation.count()).toBe(relations);
    expect(await prisma.catalogComponent.count()).toBe(CATALOG.length);
  }, 20_000);

  it("orientační řádek staršího seedu dostane objednací číslo – nic se nemaže ani nezdvojí", async () => {
    const legacy = await prisma.catalogComponent.create({
      data: { manufacturer: "ABB", series: "System pro M compact F200", typeCode: "F204 A-40/0,03", articleNumber: "F204 A-40/0,03", category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4, powerLossWatts: 3.2, description: "Proudový chránič 4P, 40 A / 30 mA, typ A", searchText: "abb f204" },
    });
    await seedCatalog(prisma);
    const rows = await prisma.catalogComponent.findMany({ where: { manufacturer: "ABB", typeCode: "F204 A-40/0,03" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: legacy.id, articleNumber: "2CSF204101R1400" });
    expect(await prisma.catalogComponent.count()).toBe(CATALOG.length);
  });

  it("konfigurátor kroku 1: kus z katalogu ABB pro ČR s objednacím číslem a příslušenstvím", async () => {
    await seedPanelBuilder(prisma, { external: false });
    const rcbo = await previewConfig(prisma, { ...defaultConfig("RCBO", { manufacturer: "ABB", modules: 1 }), poles: "1P+N", curve: "B", ratedCurrentA: 16, rcdType: "A", rcdSensitivityMa: 30 });
    expect(rcbo).toMatchObject({ manufacturer: "ABB", typeCode: "DS301C B16 A30", articleNumber: "2CSR255163R1165", estimated: false });
    expect(rcbo.accessories.map((row) => row.typeCode)).toEqual(expect.arrayContaining(["PSc 1/24/10 N", "PSc 3/24/10 N"]));
    const rcd = await previewConfig(prisma, { ...defaultConfig("RCD", { manufacturer: "ABB", modules: 4 }), poles: "4P", ratedCurrentA: 63, rcdType: "A", rcdSensitivityMa: 300 });
    expect(rcd).toMatchObject({ typeCode: "F204 A-63/0,3", articleNumber: "2CSF204101R3630" });
    const mcb = await previewConfig(prisma, defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }));
    expect(mcb).toMatchObject({ typeCode: "S201-B16", articleNumber: "2CDS251001R1165" });
    expect(mcb.accessories.map((row) => row.typeCode)).toEqual(expect.arrayContaining(["PS1/12", "PS1/60"]));
  });

  it("import externí databáze kusy z katalogu ABB pro ČR nepřepíše; nové řady rozvodnic v kaskádě", async () => {
    await seedPanelBuilder(prisma, { external: false });
    const foreign: ExternalProduct = { manufacturer: "ABB", series: "F200", category: "RCCB", mpn: "2CSF204101R1400", type_designation: "F204 A-40/0,03 (jiná data)", name_cs: "Chránič", poles: "4P", in_a: 25, idn_ma: 300, rcd_type: "AC", width_modules: 4, mounting: ["din_th35"] };
    const result = await importExternalCatalog(prisma, [foreign]);
    expect(result.components).toMatchObject({ created: 0, kept: 1 });
    expect(await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CSF204101R1400" } })).toMatchObject({ ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A" });
    const labels = enclosureSeries(await listEnclosures(prisma, "ABB")).map((series) => series.label);
    expect(labels).toEqual(expect.arrayContaining(["Mistral41W", "Mistral41F", "Mistral65", "Mistral65H", "ComfortLine CU (rozteč 125 mm)", "ComfortLine CU (rozteč 150 mm)"]));
  });
});
