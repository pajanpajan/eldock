import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { parseRailPhotos } from "@/lib/panel-builder/rails";
import { emptyDraft, parseCableReport, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import { readWiringSnapshot } from "../../../prisma/external-catalog-source";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { createPanelProject } from "./panel-builder";
import { analyzeRailDetails } from "./panel-design";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
});
afterEach(() => db.cleanup());

describe("📷 kombinovaná analýza: celková fotka + detaily lišt / snímky z videa", () => {
  it("každý detail se přečte jako své lišta; lišta mimo rozváděč se přeskočí s upozorněním", async () => {
    const project = await createPanelProject(prisma, { name: "RP z videa", customerName: null, photoUrl: "/api/files/photos/celek.jpg", designMode: "PHOTO" });
    await prisma.panelBoardProject.update({ where: { id: project.id }, data: { dinRailsCount: 2 } });
    const seen: number[] = [];
    const result = await analyzeRailDetails(
      prisma,
      project.id,
      [
        { rail: 2, url: "/api/files/photos/snimek-2.jpg" },
        { rail: 1, url: "/api/files/photos/snimek-1.jpg" },
        { rail: 5, url: "/api/files/photos/snimek-5.jpg" },
      ],
      {
        readPhoto: async () => ({ bytes: Buffer.from("x"), mimeType: "image/jpeg" }),
        analyze: async (input) => {
          seen.push(input.rail);
          return { mode: "DEMO", detections: [] };
        },
      },
    );
    expect(seen).toEqual([1, 2]);
    expect(result.analyzed).toBe(2);
    expect(result.warnings.join(" ")).toMatch(/Detail lišty 5 přeskočen/);
    const saved = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: project.id } });
    expect(parseRailPhotos(saved.railPhotosJson)).toEqual({ "1": "/api/files/photos/snimek-1.jpg", "2": "/api/files/photos/snimek-2.jpg" });
  });
});

describe("⚡ rozváděč z půdorysu: řada, barva a nové ovladače", () => {
  const el = (id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, rotation: 0, scale: null, controls: [], ...patch });

  it("černá ABB Levit: vypínač i čidlo v černé, výkaz s kabelem žaluzie a termostatu", async () => {
    await importWiringDevices(prisma, (readWiringSnapshot() ?? []).filter((row) => row.series === "Levit"));
    const companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      series: "ABB|Levit",
      color: "black",
      elements: [
        el("rh", "panel", 500, 500, "Chodba"),
        el("l1", "ceiling-light", 4000, 3000, "Obývák"),
        el("s1", "switch-6", 2000, 2000, "Obývák", { controls: ["l1"] }),
        el("s2", "switch-6", 5000, 2000, "Obývák", { controls: ["l1"] }),
        el("l2", "ceiling-light", 6000, 3000, "Chodba"),
        el("p1", "pir", 6500, 2000, "Chodba", { controls: ["l2"] }),
        el("z1", "socket", 3000, 1000, "Obývák"),
        el("zal", "blind", 3000, 500, "Obývák"),
        el("ter", "thermostat", 5000, 500, "Obývák"),
      ],
    };
    const result = await createProjectFromFloorplan(prisma, { name: "RD51", customerName: null, companyId, draft });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { include: { wiringDevices: { include: { wiringDevice: true } } } } } });
    const wiring = project.items.flatMap((item) => item.wiringDevices.map((row) => ({ category: row.wiringDevice.category, family: JSON.parse(row.wiringDevice.featuresJson ?? "{}").wd_color_family as string })));
    expect(wiring.find((row) => row.category === "WD_SWITCH")?.family).toBe("black");
    expect(wiring.find((row) => row.category === "WD_SENSOR")?.family).toBe("black");
    // Levit nemá v katalogu žaluziový ovladač ani termostat → upozornění, ne chyba
    expect(result.warnings.join(" ")).toMatch(/Žaluziový spínač|Pokojový termostat/);
    const report = parseCableReport(project.cableReportJson);
    expect(report?.byCable.map((row) => row.cable)).toEqual(expect.arrayContaining(["CYKY-J 5×1,5", "CYKY-J 3×1,5"]));
  });
});
