import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { railCapacities } from "@/lib/panel-builder/rails";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { seedStandardEnclosures } from "./catalog-sync";
import { addRail, createPanelProject } from "./panel-builder";
import { releaseEnclosureLimit, selectEnclosure, setRailCapacity } from "./panel-design";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  await seedStandardEnclosures(prisma);
});
afterEach(() => db.cleanup());

/** Rozvodnice z katalogu výrobce (jako z importu databáze prvků). */
const mistral = () =>
  prisma.panelEnclosure.upsert({
    where: { articleNumber: "1SL1208A00" },
    update: {},
    create: { manufacturer: "ABB", series: "Mistral", model: "MISTRAL65 3×18M", articleNumber: "1SL1208A00", rows: 3, modulesPerRow: 18, totalModules: 54, widthMm: 430, heightMm: 600, depthMm: 155, ipRating: "IP65", installation: "SURFACE", material: "PLASTIC", pMaxW: 45, dataSource: "EXTERNAL", description: "Rozvodnice MISTRAL65, 3×18 modulů" },
  });

describe("fáze 85 – projekt se zvolenou skříní / rozvodnicí", () => {
  it("návrh od nuly se skříní: lišty podle skříně, skříň v projektu i v oteplení, omezení zapnuté", async () => {
    const enclosure = await mistral();
    const project = await createPanelProject(prisma, { name: "RD Mistral", customerName: null, photoUrl: null, designMode: "DESIGN", enclosureId: enclosure.id });
    expect(project).toMatchObject({ enclosureId: enclosure.id, enclosureFixed: true, enclosureModel: "ABB MISTRAL65 3×18M", widthMm: 430, heightMm: 600, depthMm: 155, ipRating: "IP 65", enclosurePmaxW: 45, dinRailsCount: 3, modulesPerRail: 18 });
    expect(railCapacities(project)).toEqual([18, 18, 18]);
    // Bez skříně dál 1 lišta 12M bez omezení
    const free = await createPanelProject(prisma, { name: "RD", customerName: null, photoUrl: null, designMode: "DESIGN" });
    expect(free).toMatchObject({ enclosureId: null, enclosureFixed: false, dinRailsCount: 1, modulesPerRail: 12 });
  });

  it("zvolená skříň nepustí další řadu ani širší lištu; po uvolnění omezení zase jde", async () => {
    const enclosure = await mistral();
    const { id } = await createPanelProject(prisma, { name: "RD Mistral", customerName: null, photoUrl: null, designMode: "DESIGN", enclosureId: enclosure.id });
    await expect(addRail(prisma, id)).rejects.toThrow(/MISTRAL65 3×18M má jen 3 řady/);
    await expect(setRailCapacity(prisma, id, 1, 24)).rejects.toThrow(/řady po 18 M/);
    expect(await setRailCapacity(prisma, id, 1, 14)).toMatchObject({ capacities: [14, 18, 18] });
    await releaseEnclosureLimit(prisma, id);
    expect(await addRail(prisma, id)).toEqual({ dinRailsCount: 4 });
    expect((await setRailCapacity(prisma, id, 1, 24)).capacities[0]).toBe(24);
    expect(await prisma.panelBoardProject.findUniqueOrThrow({ where: { id } })).toMatchObject({ enclosureFixed: false, enclosureId: enclosure.id });
  });

  it("pasport z fotky se skříní a změna skříně v kroku 3 (omezení jde s novou skříní)", async () => {
    const enclosure = await mistral();
    const photo = await createPanelProject(prisma, { name: "Pasport", customerName: null, photoUrl: "/api/files/photos/seed/panel-pb-001.svg", designMode: "PHOTO", enclosureId: enclosure.id, dims: { dinRailsCount: 3, modulesPerRail: 18 } });
    expect(photo).toMatchObject({ enclosureFixed: true, enclosureModel: "ABB MISTRAL65 3×18M", dinRailsCount: 3, modulesPerRail: 18, designMode: "PHOTO" });
    const bigger = await prisma.panelEnclosure.findFirstOrThrow({ where: { manufacturer: "ABB", series: "Mistral41W", rows: 4, modulesPerRow: 18 } });
    await selectEnclosure(prisma, photo.id, bigger.id);
    expect(await addRail(prisma, photo.id)).toEqual({ dinRailsCount: 4 });
    await expect(addRail(prisma, photo.id)).rejects.toThrow(/má jen 4 řady/);
  });

  it("neexistující skříň = chyba (projekt nevznikne)", async () => {
    const before = await prisma.panelBoardProject.count();
    await expect(createPanelProject(prisma, { name: "X", customerName: null, photoUrl: null, designMode: "DESIGN", enclosureId: "neexistuje" })).rejects.toThrow(/Skříň v katalogu neexistuje/);
    expect(await prisma.panelBoardProject.count()).toBe(before);
  });
});
