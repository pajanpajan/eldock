import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { defaultConfig } from "@/lib/panel-builder/configurator";
import type { Detection } from "@/lib/panel-builder/matching";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createPanelProject } from "./panel-builder";
import { analyzeRailDetail, analyzeRailDetails, placeComponents } from "./panel-design";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

const design = () => createPanelProject(prisma, { name: "Rozvodnice RD56", customerName: null, photoUrl: null, designMode: "DESIGN" });
const rail = (projectId: string) => prisma.panelBoardItem.findMany({ where: { projectId, dinRailIndex: 1 }, orderBy: { positionOnRail: "asc" } });
const detection = (position: number, patch: Partial<Detection>): Detection => ({
  dinRailIndex: 1,
  positionOnRail: position,
  modules: 1,
  box: null,
  rawOcrText: "",
  category: "MCB",
  poles: "1P",
  ratedCurrentA: 16,
  trippingCurve: "B",
  manufacturer: "ABB",
  confidence: 0.8,
  ...patch,
});

describe("fáze 56 – detail části lišty a víc detailů jedné lišty", () => {
  it("detail dvou přístrojů z 12M lišty je jen zpřesní – ostatní přístroje i jejich id zůstanou", async () => {
    const { id } = await design();
    await placeComponents(prisma, id, { config: defaultConfig("MCB", { manufacturer: "ABB", modules: 1 }), rail: 1, count: 10 });
    const before = await rail(id);
    // Uložená detekce přístrojů 5 a 6 jako u rozpoznané fotky (podpis pro zarovnání)
    for (const [index, current] of [[4, 10], [5, 20]] as const) {
      await prisma.panelBoardItem.update({ where: { id: before[index].id }, data: { recognitionStatus: "PARTIAL", confidence: 0.5, detectedJson: JSON.stringify({ category: "MCB", poles: "1P", ratedCurrentA: current }) } });
    }
    const result = await analyzeRailDetail(prisma, id, 1, "/api/files/photos/detail-1a.jpg", {
      readPhoto: async () => ({ bytes: Buffer.from("x"), mimeType: "image/jpeg" }),
      analyze: async () => ({ mode: "GEMINI", detections: [detection(1, { ratedCurrentA: 10, rawOcrText: "S201 B10" }), detection(2, { ratedCurrentA: 20, rawOcrText: "S201 B20" })] }),
    });
    expect(result).toMatchObject({ merged: true, total: 2 });
    const after = await rail(id);
    expect(after.map((item) => item.id)).toEqual(before.map((item) => item.id));
    expect(after[4].rawOcrText).toBe("S201 B10");
    expect(after[5].rawOcrText).toBe("S201 B20");
    expect(after[0].rawOcrText).toBe(before[0].rawOcrText);
  });

  it("dva detaily téže lišty se přečtou oba (dřív zůstal jen poslední)", async () => {
    const project = await createPanelProject(prisma, { name: "Dlouhá řada", customerName: null, photoUrl: "/api/files/photos/celek.jpg", designMode: "PHOTO" });
    await prisma.panelBoardProject.update({ where: { id: project.id }, data: { dinRailsCount: 1 } });
    const seen: string[] = [];
    const result = await analyzeRailDetails(
      prisma,
      project.id,
      [
        { rail: 1, url: "/api/files/photos/leva-pulka.jpg" },
        { rail: 1, url: "/api/files/photos/prava-pulka.jpg" },
      ],
      {
        readPhoto: async (url) => {
          seen.push(url);
          return { bytes: Buffer.from("x"), mimeType: "image/jpeg" };
        },
        analyze: async () => ({ mode: "DEMO", detections: [] }),
      },
    );
    expect(result.analyzed).toBe(2);
    expect(seen).toEqual(["/api/files/photos/leva-pulka.jpg", "/api/files/photos/prava-pulka.jpg"]);
  });
});
