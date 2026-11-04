import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import type { ExternalProduct } from "@/lib/panel-builder/external-catalog";
import { railCapacities } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importExternalCatalog, seedStandardEnclosures } from "./catalog-sync";
import { addRail, createPanelProject, deleteRail } from "./panel-builder";
import { listEnclosures, moveRail, placeComponents, previewConfig, saveCircuitChips, selectEnclosure, setCompanyBranding, setEnvironment, setRailCapacity } from "./panel-design";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

const design = () => createPanelProject(prisma, { name: "Rozvodnice RD1", customerName: null, photoUrl: null, designMode: "DESIGN" });
const items = (projectId: string) => prisma.panelBoardItem.findMany({ where: { projectId }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], include: { catalogComponent: true } });
const project = (id: string) => prisma.panelBoardProject.findUniqueOrThrow({ where: { id } });

describe("návrh rozváděče od nuly (fáze 43)", () => {
  it("nový návrh = 1 DIN lišta 12M bez fotky a bez analýzy", async () => {
    const created = await design();
    expect(created).toMatchObject({ designMode: "DESIGN", dinRailsCount: 1, modulesPerRail: 12, railModulesJson: "[12]", photoUrl: null, status: "RECOGNIZED" });
    expect(await prisma.panelBoardItem.count({ where: { projectId: created.id } })).toBe(0);
  });

  it("vložení 3× jističe ABB na lištu, IEC značení, přesný kus z katalogu; vložení na pozici posune ostatní", async () => {
    const { id } = await design();
    const mcb = defaultConfig("MCB", { manufacturer: "ABB", modules: 1 });
    const result = await placeComponents(prisma, id, { config: mcb, rail: 1, count: 3, circuitLabel: "Zásuvky" });
    expect(result).toMatchObject({ placed: 3, requested: 3, typeCode: "S201-B16" });
    const rcd = defaultConfig("RCD", { manufacturer: "ABB", modules: 4 });
    await placeComponents(prisma, id, { config: rcd, rail: 1, count: 1, position: 1 });
    const rows = await items(id);
    expect(rows.map((row) => [row.designation, row.positionOnRail, row.catalogComponent?.typeCode, row.circuitLabel])).toEqual([
      ["-FI1", 1, "F204 A-40/0,03", ""],
      ["-F1", 2, "S201-B16", "Zásuvky"],
      ["-F2", 3, "S201-B16", "Zásuvky"],
      ["-F3", 4, "S201-B16", "Zásuvky"],
    ]);
    expect(rows.every((row) => row.recognitionStatus === "VERIFIED" && row.configJson)).toBe(true);
  });

  it("vloží jen to, co se vejde; plná lišta = srozumitelná chyba", async () => {
    const { id } = await design();
    const mcb = defaultConfig("MCB", { manufacturer: "ABB", modules: 1 });
    await placeComponents(prisma, id, { config: mcb, rail: 1, count: 6 });
    expect(await placeComponents(prisma, id, { config: mcb, rail: 1, count: 6 })).toMatchObject({ placed: 6, requested: 6 });
    await expect(placeComponents(prisma, id, { config: mcb, rail: 1, count: 1 })).rejects.toThrow(/se 1M přístroj už nevejde/);
    await setRailCapacity(prisma, id, 1, 14);
    expect(await placeComponents(prisma, id, { config: mcb, rail: 1, count: 6 })).toMatchObject({ placed: 2, requested: 6 });
  });

  it("lišty: preset šířky, přidání, přesun šipkou (i s přístroji) a smazání", async () => {
    const { id } = await design();
    await addRail(prisma, id);
    await setRailCapacity(prisma, id, 2, 18);
    expect(railCapacities(await project(id))).toEqual([12, 18]);
    await placeComponents(prisma, id, { config: defaultConfig("MAIN_SWITCH", { manufacturer: "ABB", modules: 3 }), rail: 2, count: 1 });
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 2 });
    expect(await moveRail(prisma, id, 2, -1)).toEqual({ rail: 1 });
    expect(railCapacities(await project(id))).toEqual([18, 12]);
    expect((await items(id)).map((row) => [row.designation, row.dinRailIndex])).toEqual([
      ["-Q1", 1],
      ["-F1", 2],
      ["-F2", 2],
    ]);
    await expect(moveRail(prisma, id, 1, -1)).rejects.toBeInstanceOf(WorkflowError);
    await deleteRail(prisma, id, 1);
    expect(await project(id)).toMatchObject({ dinRailsCount: 1, railModulesJson: "[12]" });
    // Užší lišta než obsazení = varování (přeplněno), nic se nesmaže
    expect((await setRailCapacity(prisma, id, 1, 4)).overflow).toBe(0);
  });

  it("živá karta: přesný kus (MPN, Pv) nebo odhad IEC bez zápisu do katalogu", async () => {
    const exact = await previewConfig(prisma, defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }));
    expect(exact).toMatchObject({ manufacturer: "ABB", typeCode: "S201-B16", articleNumber: "2CDS251001R1165", estimated: false });
    const before = await prisma.catalogComponent.count();
    // Siemens má od fáze 47 přesné kusy 5SY6 – odhad IEC ukáže výrobce bez jističů v katalogu
    const estimate = await previewConfig(prisma, defaultConfig("MCB", { manufacturer: "Legrand", modules: 1 }));
    expect(estimate).toMatchObject({ manufacturer: "Legrand", articleNumber: null, estimated: true });
    expect(await prisma.catalogComponent.count()).toBe(before);
  });

  it("skříně: matice v seedu, výběr propíše rozměry, krytí, instalaci a P_max", async () => {
    const abb = await listEnclosures(prisma, "ABB");
    expect(abb.length).toBeGreaterThanOrEqual(12);
    const target = abb.find((row) => row.model.startsWith("UK600 36M"))!;
    const { id } = await design();
    await selectEnclosure(prisma, id, target.id);
    expect(await project(id)).toMatchObject({ enclosureId: target.id, enclosureModel: `ABB ${target.model}`, enclosureType: "FLUSH_MOUNTED", ipRating: "IP 30", widthMm: target.widthMm, heightMm: target.heightMm, enclosurePmaxW: target.pMaxW });
    // Standardní matice = všechny skříně kromě ABB CA35R 144M z rešerše (fáze 47)
    expect(await seedStandardEnclosures(prisma)).toBe((await prisma.panelEnclosure.count()) - 1);
  });

  it("logo a razítko firmy", async () => {
    const company = await prisma.registeredCompany.findFirstOrThrow();
    expect(await setCompanyBranding(prisma, company.id, { logoUrl: "/api/files/documents/logo.svg" })).toMatchObject({ logoUrl: "/api/files/documents/logo.svg", stampUrl: null });
    expect(await setCompanyBranding(prisma, company.id, { stampUrl: "/api/files/documents/stamp.png" })).toMatchObject({ logoUrl: "/api/files/documents/logo.svg", stampUrl: "/api/files/documents/stamp.png" });
  });
});

const mcb: ExternalProduct = { manufacturer: "EATON", series: "xPole PL7", category: "MCB", mpn: "262701", type_designation: "PL7-B16/1", name_cs: "Jistič PL7-B16/1", poles: "1P", in_a: 16, trip_characteristic: "B", p_loss_w: 2.4, width_modules: 1, mounting: ["din_th35"] };
const external: ExternalProduct[] = [
  mcb,
  { ...mcb, category: "AUX_CONTACT", series: "PL7 příslušenství", mpn: "286052", type_designation: "ZP-IHK", name_cs: "Pomocný kontakt ZP-IHK", width_modules: 0.5 },
  { manufacturer: "EATON", series: "BC", category: "DISTRIBUTION_BOARD", mpn: "280347", type_designation: "BC-A-1/13-A", name_cs: "Rozvodnice BC-A-1/13-A", width_mm: 250, height_mm: 225, depth_mm: 94, enclosure: { rows: 1, modules_per_row: 13, installation: "surface", ip_code: "IP30", p_max_w: 22 } },
  // Vlastní katalog Eldocku (ABB S201-B16) se nepřepíše
  { ...mcb, manufacturer: "ABB", series: "S200", mpn: "2CDS251001R1165", type_designation: "S201-B16 (externí)", p_loss_w: 9 },
  { ...mcb, category: "MCCB", mpn: "269163" },
];

describe("catalog:sync – import externí databáze", () => {
  it("dávkový upsert přístrojů, skříní a vazeb; stejný otisk se přeskočí, vlastní katalog zůstane", async () => {
    const result = await importExternalCatalog(prisma, external);
    expect(result).toMatchObject({ skipped: false, products: 5, components: { created: 2, updated: 0, kept: 1 }, enclosures: { created: 1, updated: 0 }, relations: 1 });
    expect(result.skippedProducts.map((row) => row.key)).toEqual(["EATON|269163"]);
    const pl7 = await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "EATON:262701" }, include: { relations: { include: { child: true } } } });
    expect(pl7).toMatchObject({ manufacturer: "Eaton", externalSource: "ai-panel-builder", archetypeId: "din_mcb_1M_1P" });
    expect(pl7.relations.map((relation) => [relation.child.typeCode, relation.relationType, relation.verified])).toEqual([["ZP-IHK", "SIDE_UNSPECIFIED", true]]);
    expect((await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CDS251001R1165" } })).typeCode).toBe("S201-B16");
    expect(await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "EATON:280347" } })).toMatchObject({ totalModules: 13, pMaxW: 22, dataSource: "EXTERNAL" });

    expect((await importExternalCatalog(prisma, external)).skipped).toBe(true);
    const again = await importExternalCatalog(prisma, external, { force: true });
    expect(again.components).toEqual({ created: 0, updated: 2, kept: 1 });
    expect(await prisma.catalogRelation.count()).toBe(1);

    // Karta k osazení ukáže příslušenství z databáze
    const preview = await previewConfig(prisma, { ...defaultConfig("MCB", { manufacturer: "Eaton", modules: 1 }), breakingCapacityKa: null });
    expect(preview.accessories.map((accessory) => accessory.typeCode)).toContain("ZP-IHK");
  });
});

describe("fáze 45: prostředí instalace a štítky firmy", () => {
  it("prostředí nastaví teplotu okolí pro oteplení; neznámé odmítne", async () => {
    const { id } = await design();
    expect(await setEnvironment(prisma, id, "HOT")).toMatchObject({ environment: "HOT", ambientTempC: 35 });
    expect(await setEnvironment(prisma, id, "GARAGE")).toMatchObject({ environment: "GARAGE", ambientTempC: 25 });
    await expect(setEnvironment(prisma, id, "MARS")).rejects.toBeInstanceOf(WorkflowError);
  });

  it("štítky: uloží se jen novější sada", async () => {
    const company = await prisma.registeredCompany.findFirstOrThrow();
    const newer = { chips: [{ id: "sauna", label: "Sauna", preset: { category: "MCB" as const, poles: "3P", ratedCurrentA: 16 } }], updatedAt: 200 };
    expect((await saveCircuitChips(prisma, company.id, newer)).saved).toBe(true);
    const older = await saveCircuitChips(prisma, company.id, { chips: [{ id: "x", label: "Starý" }], updatedAt: 100 });
    expect(older).toMatchObject({ saved: false, set: { updatedAt: 200 } });
    expect(older.set.chips[0].label).toBe("Sauna");
  });
});
