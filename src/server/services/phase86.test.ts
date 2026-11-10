import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { enclosureSeries } from "@/lib/panel-builder/enclosure-choice";
import type { ExternalProduct } from "@/lib/panel-builder/external-catalog";
import { railCapacities } from "@/lib/panel-builder/rails";
import { VERIFIED_ENCLOSURES, VERIFIED_ENCLOSURE_SOURCE } from "@/lib/panel-builder/verified-enclosures";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importExternalCatalog, seedStandardEnclosures, seedVerifiedEnclosures } from "./catalog-sync";
import { createPanelProject } from "./panel-builder";
import { listEnclosures } from "./panel-design";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

const verifiedCount = () => prisma.panelEnclosure.count({ where: { dataSource: VERIFIED_ENCLOSURE_SOURCE } });
const labels = async (manufacturer: string) => enclosureSeries(await listEnclosures(prisma, manufacturer)).map((series) => series.label);

/** Záznam exportu databáze prvků se stejným objednacím číslem jako ověřená rozvodnice Hager (jiné údaje). */
const conflicting: ExternalProduct = {
  manufacturer: "HAGER",
  series: "vector",
  category: "DISTRIBUTION_BOARD",
  mpn: "VE112SN",
  type_designation: "VE112SN",
  name_cs: "Rozvodnice VE112SN",
  width_mm: 999,
  height_mm: 999,
  depth_mm: 99,
  mounting: ["flush"],
  features: { enclosure_material: "steel" },
  enclosure: { rows: 2, modules_per_row: 9, installation: "flush", ip_code: "IP20" },
};

describe("fáze 86 – ověřené rozvodnice výrobců v katalogu skříní", () => {
  it("seed: všechny ověřené rozvodnice, přírůstkově a opakovatelně; ABB CA35R z fáze 47 je v řadě ComfortLine CA", async () => {
    expect(await verifiedCount()).toBe(VERIFIED_ENCLOSURES.length);
    const before = await prisma.panelEnclosure.count();
    expect(await seedVerifiedEnclosures(prisma)).toBe(VERIFIED_ENCLOSURES.length);
    expect(await prisma.panelEnclosure.count()).toBe(before);
    expect(await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "2CPX052241R9999" } })).toMatchObject({
      manufacturer: "ABB",
      series: "ComfortLine CA (rozteč 150 mm)",
      model: "CA35R (3 pole po 12 M)",
      rows: 4,
      modulesPerRow: 36,
      totalModules: 144,
      widthMm: 800,
      heightMm: 800,
      depthMm: 160,
      dataSource: VERIFIED_ENCLOSURE_SOURCE,
    });
  });

  it("orientační matice ani import externí databáze ověřené údaje nepřepíšou", async () => {
    const original = await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "VE112SN" } });
    await seedStandardEnclosures(prisma);
    const added: ExternalProduct = { ...conflicting, mpn: "VE118PN", type_designation: "VE118PN", name_cs: "Rozvodnice VE118PN", enclosure: { rows: 1, modules_per_row: 18, installation: "surface", ip_code: "IP65" } };
    const result = await importExternalCatalog(prisma, [conflicting, added]);
    expect(result.enclosures).toEqual({ created: 1, updated: 0, kept: 1 });
    const kept = await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "VE112SN" } });
    expect(kept).toEqual(original);
    expect(kept).toMatchObject({ rows: 1, modulesPerRow: 12, widthMm: 310, heightMm: 302, depthMm: 151, ipRating: "IP65", installation: "SURFACE", material: "PLASTIC", dataSource: VERIFIED_ENCLOSURE_SOURCE });
    expect(kept.description).toContain("Zdroj: https://hager.com/cz/katalog/produkt/ve112sn");
    // Ostatní skříně exportu se dál importují
    expect(await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "VE118PN" } })).toMatchObject({ dataSource: "EXTERNAL", modulesPerRow: 18 });
    expect(await verifiedCount()).toBe(VERIFIED_ENCLOSURES.length);
  });

  it("kaskáda dialogu nového projektu: nové řady s MPN, orientační typy zůstávají", async () => {
    expect(await labels("ABB")).toEqual(["ComfortLine CA (rozteč 125 mm)", "ComfortLine CA (rozteč 150 mm)", "ComfortLine CU (rozteč 125 mm)", "ComfortLine CU (rozteč 150 mm)", "Mistral41F", "Mistral41W", "Mistral65", "Mistral65H", "Mistral41W (orientační)", "UK600 (orientační)"]);
    expect(await labels("Hager")).toEqual(["Univers FWU", "Vector II", "Golf (orientační)", "Volta (orientační)"]);
    expect(await labels("Schrack")).toEqual(["TOPO nástěnná", "TOPO zapuštěná", "Amparo (orientační)", "Amparo UP (orientační)"]);
    expect(await labels("Rittal")).toEqual(["AX (orientační)"]);
    expect(await labels("Eaton")).toEqual(["BF-O (orientační)", "KLV (orientační)"]);
  });

  it("projekt se zvolenou ověřenou rozvodnicí: lišty podle skříně, rozměry, krytí a P_max výrobce", async () => {
    const topo = await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "BK080153--" } });
    const project = await createPanelProject(prisma, { name: "RD TOPO", customerName: null, photoUrl: null, designMode: "DESIGN", enclosureId: topo.id });
    expect(project).toMatchObject({ enclosureId: topo.id, enclosureFixed: true, enclosureModel: "Schrack TOPO 3×12, dveře bílé", widthMm: 287, heightMm: 482, depthMm: 112, ipRating: "IP 40", enclosurePmaxW: 44, dinRailsCount: 3, modulesPerRail: 12 });
    expect(railCapacities(project)).toEqual([12, 12, 12]);
    const univers = await prisma.panelEnclosure.findUniqueOrThrow({ where: { articleNumber: "FWU42S" } });
    const flush = await createPanelProject(prisma, { name: "Byt FWU", customerName: null, photoUrl: null, designMode: "DESIGN", enclosureId: univers.id });
    expect(flush).toMatchObject({ enclosureModel: "Hager Univers FWU42S (2 pole po 12 M)", enclosureType: "FLUSH_MOUNTED", enclosureMaterial: "PAINTED_STEEL", ipRating: "IP 30", enclosurePmaxW: null });
    expect(railCapacities(flush)).toEqual([24, 24, 24, 24]);
  });
});
