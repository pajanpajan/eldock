import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import type { Detection } from "@/lib/panel-builder/matching";
import { parseRailPhotos } from "@/lib/panel-builder/rails";

import { ENCLOSURE_FANS } from "../../../prisma/seed-catalog-research";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { createPanelProject } from "./panel-builder";
import { analyzeRailDetail, insertNextTo, placeComponents } from "./panel-design";
import { addItemWiring, searchWiringDevices, setItemWiringQuantity, setProjectFan } from "./panel-wiring";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

const design = () => createPanelProject(prisma, { name: "Rozvodnice RD47", customerName: null, photoUrl: null, designMode: "DESIGN" });
const rail = (projectId: string, index = 1) =>
  prisma.panelBoardItem.findMany({ where: { projectId, dinRailIndex: index }, orderBy: { positionOnRail: "asc" }, include: { catalogComponent: true } });

const detection = (position: number, patch: Partial<Detection>): Detection => ({
  dinRailIndex: 2,
  positionOnRail: position,
  modules: 1,
  box: null,
  rawOcrText: "",
  category: "MCB",
  poles: "1P",
  ratedCurrentA: 16,
  trippingCurve: "B",
  manufacturer: "ABB",
  confidence: 0.9,
  ...patch,
});

describe("➕ Přidat prvek vpravo / 📑 Duplikovat prvek", () => {
  it("duplikát vznikne hned vpravo se stejným kusem a popisem, ostatní se posunou a přečíslují", async () => {
    const { id } = await design();
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 3, circuitLabel: "Zásuvky" });
    const [first] = await rail(id);
    const copy = await insertNextTo(prisma, first.id, "duplicate");
    const rows = await rail(id);
    expect(rows.map((row) => [row.positionOnRail, row.catalogComponent?.typeCode, row.circuitLabel])).toEqual([
      [1, "S201-B16", "Zásuvky"],
      [2, "S201-B16", "Zásuvky"],
      [3, "S201-B16", "Zásuvky"],
      [4, "S201-B16", "Zásuvky"],
    ]);
    expect(rows[1].id).toBe(copy.id);
    expect(rows.map((row) => row.designation)).toEqual(["-F1", "-F2", "-F3", "-F4"]);
  });

  it("prázdný prvek vpravo je nerozpoznaný 1M modul bez kusu", async () => {
    const { id } = await design();
    await placeComponents(prisma, id, { config: defaultConfig("RCD", { manufacturer: "ABB", modules: 4 }), rail: 1, count: 1 });
    const [rcd] = await rail(id);
    const blank = await insertNextTo(prisma, rcd.id, "blank");
    const rows = await rail(id);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ id: blank.id, positionOnRail: 2, modulesWidth: 1, catalogComponentId: null, recognitionStatus: "UNRECOGNIZED" });
  });
});

describe("pravidlo F – detailní fotka jedné lišty", () => {
  it("přepíše jen danou lištu, ostatní nechá a fotku uloží k projektu (pravidla DS301C, EN25, FH204)", async () => {
    const { id } = await design();
    await prisma.panelBoardProject.update({ where: { id }, data: { dinRailsCount: 2, railModulesJson: "[12,36]" } });
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 2 });
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 2, count: 5 });
    const result = await analyzeRailDetail(prisma, id, 2, "/api/files/photos/detail-2.jpg", {
      readPhoto: async () => ({ bytes: Buffer.from("x"), mimeType: "image/jpeg" }),
      analyze: async (input) => {
        expect(input.rail).toBe(2);
        return {
          mode: "GEMINI",
          detections: [
            detection(1, { category: "RCD", poles: "4P", modules: 4, rawOcrText: "FH204 AC-40/0.03", ratedCurrentA: 40, trippingCurve: null }),
            detection(2, { category: "MCB", modules: 2, rawOcrText: "DS301C B16 A30" }),
            detection(3, { category: "OTHER", modules: 2, rawOcrText: "EN25-40N" }),
          ],
        };
      },
    });
    expect(result).toMatchObject({ mode: "GEMINI", total: 3 });
    expect(await rail(id, 1)).toHaveLength(2);
    const second = await rail(id, 2);
    expect(second.map((row) => [row.positionOnRail, row.modulesWidth])).toEqual([
      [1, 4],
      [2, 2],
      [3, 2],
    ]);
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id } });
    expect(parseRailPhotos(project.railPhotosJson)).toEqual({ "2": "/api/files/photos/detail-2.jpg" });
  });

  it("demo režim bez detekcí lištu nezmění, jen uloží fotku", async () => {
    const { id } = await design();
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 3 });
    const result = await analyzeRailDetail(prisma, id, 1, "/api/files/photos/demo.jpg", { readPhoto: async () => null, analyze: async () => ({ mode: "DEMO", detections: [], warning: "Demo" }) });
    expect(result).toMatchObject({ mode: "DEMO", total: 0, warning: "Demo" });
    expect(await rail(id)).toHaveLength(3);
    await expect(analyzeRailDetail(prisma, id, 5, "/api/files/photos/x.jpg", { readPhoto: async () => null, analyze: async () => ({ mode: "DEMO", detections: [] }) })).rejects.toThrow(/Neplatná DIN lišta/);
  });
});

describe("domovní instalace obvodu a ventilátory skříně", () => {
  it("hledání bez diakritiky, přiřazení k obvodu (stejná místnost = navýšení), změna počtu a odebrání", async () => {
    await importWiringDevices(prisma, [
      { brand: "ABB", article: "5518A-A2359 B", title: "ABB Tango zásuvka bílá 5518A-A2359 B s clonkami", series: "Tango", category: "WD_SOCKET", features: { wd_role: "complete" } },
      { brand: "ABB", article: "3558A-A651 B", title: "ABB Tango kryt vypínače bílá 3558A-A651 B", series: "Tango", category: "WD_COVER" },
    ]);
    const hits = await searchWiringDevices(prisma, "tango zasuvka");
    expect(hits.map((hit) => hit.articleNumber)).toEqual(["ABB:5518A-A2359 B"]);
    expect(hits[0].categoryLabel).toBe("Zásuvky");

    const { id } = await design();
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 1, circuitLabel: "Zásuvky kuchyně" });
    const [mcb] = await rail(id);
    await addItemWiring(prisma, mcb.id, { wiringDeviceId: hits[0].id, quantity: 3, room: "Kuchyně" });
    const again = await addItemWiring(prisma, mcb.id, { wiringDeviceId: hits[0].id, quantity: 2, room: " Kuchyně " });
    expect(again.quantity).toBe(5);
    await addItemWiring(prisma, mcb.id, { wiringDeviceId: hits[0].id, quantity: 1, room: null });
    expect(await prisma.panelItemWiring.count({ where: { itemId: mcb.id } })).toBe(2);
    await setItemWiringQuantity(prisma, mcb.id, again.id, 0);
    expect(await prisma.panelItemWiring.count({ where: { itemId: mcb.id } })).toBe(1);
    await expect(addItemWiring(prisma, mcb.id, { wiringDeviceId: hits[0].id, quantity: 0 })).rejects.toThrow(/1–200/);
  });

  it("seed nahraje ventilátory s datasheety; projekt si ventilátor vybere a zase odebere", async () => {
    expect(await prisma.enclosureFan.count()).toBe(ENCLOSURE_FANS.length);
    expect(await prisma.enclosureFan.count({ where: { datasheetUrl: null } })).toBe(0);
    const fan = await prisma.enclosureFan.findFirstOrThrow({ orderBy: { airflowFreeM3h: "asc" } });
    const { id } = await design();
    expect(await setProjectFan(prisma, id, fan.id, 2)).toEqual({ fanId: fan.id, fanCount: 2 });
    expect(await setProjectFan(prisma, id, null, 1)).toEqual({ fanId: null, fanCount: 1 });
    await expect(setProjectFan(prisma, id, fan.id, 9)).rejects.toThrow(/1–6/);
  });
});
