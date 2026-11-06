import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SAMPLE_SCHEDULE } from "@/engine/room-schedule";
import type { PrismaClient } from "@/generated/prisma/client";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createPanelProject } from "./panel-builder";
import { createProjectFromSchedule, deletePanelProjects, updateProjectHeader } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  const sample = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" }, select: { companyId: true } });
  companyId = sample.companyId!;
});
afterEach(() => db.cleanup());

const credits = async () => (await prisma.registeredCompany.findUniqueOrThrow({ where: { id: companyId } })).creditsRemaining;
const project = (name: string, extra: Partial<Parameters<typeof createPanelProject>[1]> = {}) => createPanelProject(prisma, { name, customerName: null, photoUrl: null, designMode: "DESIGN", companyId, ...extra });

describe("🗑️ smazání projektů", () => {
  it("smaže projekt s prvky, vrátí kredit za nedokončený a fyzicky smaže jen jeho vlastní fotky (ne seed/ ani sdílené)", async () => {
    const own = await project("test-1");
    await prisma.panelBoardProject.update({ where: { id: own.id }, data: { photoUrl: "/api/files/photos/a.jpg", railPhotosJson: JSON.stringify({ 1: "/api/files/photos/b.jpg", 2: "/api/files/photos/seed/x.svg", 3: "/api/files/photos/shared.jpg" }) } });
    const other = await project("jiný");
    await prisma.panelBoardProject.update({ where: { id: other.id }, data: { photoUrl: "/api/files/photos/shared.jpg" } });
    await prisma.panelBoardItem.create({ data: { projectId: own.id, dinRailIndex: 1, positionOnRail: 1, modulesWidth: 1, designation: "-F1", sortOrder: 101 } });
    const done = await project("hotový");
    await prisma.panelBoardProject.update({ where: { id: done.id }, data: { status: "COMPLETED" } });
    const before = await credits();

    const removed: string[] = [];
    const result = await deletePanelProjects(prisma, companyId, [own.id, done.id], { removeFile: async (url) => (removed.push(url), true) });
    expect(result).toMatchObject({ deleted: 2, refunded: 1, skipped: [], removedFiles: 2 });
    expect(removed.sort()).toEqual(["/api/files/photos/a.jpg", "/api/files/photos/b.jpg"]);
    expect(await credits()).toBe(before + 1);
    expect(await prisma.panelBoardItem.count({ where: { projectId: own.id } })).toBe(0);
    expect(await prisma.panelBoardProject.count({ where: { id: other.id } })).toBe(1);
  });

  it("hromadné mazání vzorový PB-001 vynechá; cizí projekt = nenalezen", async () => {
    const sample = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } });
    const test = await project("test 3");
    const result = await deletePanelProjects(prisma, companyId, [sample.id, test.id], { protectSample: true });
    expect(result).toMatchObject({ deleted: 1, refunded: 1, skipped: ["PB-001"] });
    expect(await prisma.panelBoardProject.count({ where: { code: "PB-001" } })).toBe(1);
    const foreign = await createPanelProject(prisma, { name: "cizí", customerName: null, photoUrl: null, designMode: "DESIGN", companyId: null });
    await expect(deletePanelProjects(prisma, companyId, [foreign.id])).rejects.toThrow(/nebyl nalezen/);
    // Jednotlivě (s potvrzením v UI) jde vzorový projekt smazat, kredit se za něj nevrací
    const before = await credits();
    expect(await deletePanelProjects(prisma, companyId, [sample.id])).toMatchObject({ deleted: 1, refunded: 0 });
    expect(await credits()).toBe(before);
  });

  it("✏️ úprava hlavičky: název, zákazník a místo instalace", async () => {
    const created = await project("RD1");
    expect(await updateProjectHeader(prisma, created.id, { name: "  RD1 – přízemí ", customerName: "Novák", installationSite: " Liberec, Husova 5 " })).toMatchObject({ name: "RD1 – přízemí", customerName: "Novák", installationSite: "Liberec, Husova 5" });
    await expect(updateProjectHeader(prisma, created.id, { name: " ", customerName: null, installationSite: null })).rejects.toThrow(/název/);
  });
});

describe("🏠 rozváděč ze soupisu místností (floorplan-bridge)", () => {
  it("vzorový dům → návrh s hlavním vypínačem, chrániči, jističi, vybranou skříní a funkcemi obvodů", async () => {
    const result = await createProjectFromSchedule(prisma, { name: "RD ze soupisu", customerName: null, installationSite: "Jablonec", companyId, rooms: SAMPLE_SCHEDULE, mode: "classic" });
    expect(result.devices).toBeGreaterThan(10);
    const created = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] } } });
    // Fáze 60: generátor rovnou sestaví strom zapojení podle hierarchie → TREE_BUILT
    expect(created).toMatchObject({ designMode: "DESIGN", status: "TREE_BUILT", installationSite: "Jablonec", companyId });
    expect(created.items[0].designation).toBe("-Q1");
    expect(created.items.every((item) => item.catalogComponentId && item.recognitionStatus === "VERIFIED")).toBe(true);
    expect(created.items.some((item) => item.designation.startsWith("-FI"))).toBe(true);
    expect(created.items.map((item) => item.circuitLabel)).toContain("Trouba – Kuchyně");
    expect(created.items.some((item) => /ELKO/i.test(item.circuitLabel))).toBe(false);
    // Lišty odpovídají vybrané skříni a každý přístroj se na svou lištu vejde
    const capacities = JSON.parse(created.railModulesJson ?? "[]") as number[];
    for (const [index, capacity] of capacities.entries()) {
      expect(created.items.filter((item) => item.dinRailIndex === index + 1).reduce((sum, item) => sum + item.modulesWidth, 0)).toBeLessThanOrEqual(capacity);
    }
    if (result.enclosure) expect(created.enclosureId).not.toBeNull();
  });

  it("prázdný soupis nebo místnosti bez vývodů = srozumitelná chyba", async () => {
    await expect(createProjectFromSchedule(prisma, { name: "x", customerName: null, companyId, rooms: [], mode: "classic" })).rejects.toThrow(/místnost/);
    await expect(createProjectFromSchedule(prisma, { name: "x", customerName: null, companyId, rooms: [{ name: "Sklep", distanceM: 3, singleSockets: 0, doubleSockets: 0, lights: 0, switchPlaces: 0, appliances: [] }], mode: "classic" })).rejects.toThrow(/vývod/);
  });
});

describe("🧹 úklid osiřelých souborů (storage:cleanup)", () => {
  it("smaže jen neodkazované soubory starší 24 h mimo seed/; odkazy najde v *Url, JSON i SVG", async () => {
    const { mkdtemp, mkdir, writeFile, utimes, readdir, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { cleanupStorage, extractUploadUrls } = await import("./storage-cleanup");
    const root = await mkdtemp(path.join(tmpdir(), "eldock-uploads-"));
    try {
      await mkdir(path.join(root, "photos", "seed"), { recursive: true });
      const old = new Date(Date.now() - 48 * 3600_000);
      for (const name of ["used.jpg", "rail.jpg", "orphan.jpg", "fresh.jpg", "seed/sample.svg"]) {
        await writeFile(path.join(root, "photos", name), "x");
        if (name !== "fresh.jpg") await utimes(path.join(root, "photos", name), old, old);
      }
      const created = await project("s fotkou");
      await prisma.panelBoardProject.update({ where: { id: created.id }, data: { photoUrl: "/api/files/photos/used.jpg", railPhotosJson: JSON.stringify({ 1: "/api/files/photos/rail.jpg" }) } });

      const dry = await cleanupStorage(prisma, root, { dryRun: true });
      expect(dry.orphans.map((file) => file.url)).toEqual(["/api/files/photos/orphan.jpg"]);
      expect(await readdir(path.join(root, "photos"))).toContain("orphan.jpg");
      const report = await cleanupStorage(prisma, root);
      expect(report.removed).toBe(1);
      expect((await readdir(path.join(root, "photos"))).sort()).toEqual(["fresh.jpg", "rail.jpg", "seed", "used.jpg"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    expect([...extractUploadUrls(['<image href="/api/files/documents/plan%20A.svg"/>', "viz /api/files/photos/a.jpg."])]).toEqual(expect.arrayContaining(["/api/files/documents/plan%20A.svg", "/api/files/documents/plan A.svg", "/api/files/photos/a.jpg"]));
  });
});
