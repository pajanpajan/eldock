import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { convertForLevel, emptyDraft, type EditorElement } from "@/lib/panel-builder/floorplan-editor";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { releaseDocumentation } from "./panel-builder";
import { setEnvironment } from "./panel-design";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb, seedMinimal } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const house = () => ({
  ...emptyDraft(),
  elements: [el("rh", "panel", 0, 0), el("z1", "double-socket", 2000, 0), el("l1", "ceiling-light", 3000, 2000), el("s1", "switch-1", 1000, 2000, { controls: ["l1"] })],
});

describe("fáze 57 – prostředí dle ČSN 33 2000-5-51 ed. 3 před dokumentací", () => {
  it("projekt z půdorysu převezme zvolené prostředí jako potvrzené (teplota okolí, stavební detaily dřevostavby)", async () => {
    const result = await createProjectFromFloorplan(prisma, { name: "RD57 dřevostavba", customerName: null, companyId, draft: { ...house(), environment: "TIMBER" } });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } });
    expect(project.environment).toBe("TIMBER");
    expect(project.environmentConfirmedAt).toBeInstanceOf(Date);
    expect(JSON.parse(project.floorplanJson!).environment).toBe("TIMBER");
  });

  it("bez zvoleného prostředí zůstane projekt nepotvrzený a dokumentaci nelze propustit; výslovná volba ji odblokuje", async () => {
    await seedMinimal(prisma);
    const result = await createProjectFromFloorplan(prisma, { name: "RD57 bez prostředí", customerName: null, companyId, draft: house() });
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } })).environmentConfirmedAt).toBeNull();
    await expect(releaseDocumentation(prisma, result.id, "eq-R-LIS-01")).rejects.toThrow(/prostředí instalace dle ČSN 33 2000-5-51 ed\. 3/);
    await setEnvironment(prisma, result.id, "GARAGE");
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } });
    expect(project).toMatchObject({ environment: "GARAGE", ambientTempC: 25 });
    expect(project.environmentConfirmedAt).toBeInstanceOf(Date);
    // vzorový PB-001 má prostředí potvrzené ze seedu
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).environmentConfirmedAt).toBeInstanceOf(Date);
  });

  it("sběrnicová instalace: tlačítka se nepárují s katalogem vypínačů a výkaz kabeláže má sběrnicovou linku", async () => {
    const draft = { ...convertForLevel(house(), "bus_loxone").draft, environment: "INDOOR_DRY" as const };
    const result = await createProjectFromFloorplan(prisma, { name: "RD57 sběrnice", customerName: null, companyId, draft });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } });
    const report = JSON.parse(project.cableReportJson!) as { byCable: { cable: string }[] };
    expect(report.byCable.map((row) => row.cable)).toContain("CAT7 / KNX J-Y(St)Y 2×2×0,8 (sběrnice 24 V DC)");
    expect(report.byCable.some((row) => row.cable.startsWith("CYKY-O"))).toBe(false);
  });
});
