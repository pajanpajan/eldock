import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { SANDBOX_BATH_LIGHT_ID, SANDBOX_BED_TARGET, SANDBOX_TRAINER_PRESET, TRAINER_PROJECT_LIMIT, sandboxDraft } from "@/lib/panel-builder/floorplan-sandbox-preset";
import { projectLintIssues } from "@/lib/panel-builder/panel-live-checklist";
import { TRAINER_JOBS } from "@/lib/panel-builder/panel-trainer-presets";
import { railCapacities } from "@/lib/panel-builder/rails";

import { readWiringSnapshot } from "../../../prisma/external-catalog-source";
import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importWiringDevices } from "./catalog-sync";
import { configureItem } from "./panel-builder";
import { createSandboxProject, openTrainerProject } from "./panel-trainer";
import { createTestDb } from "./test-db";

// Fáze 92: rozváděče z trenažérů bez kreditu (trenažér půdorysu, 3 tréninkové zakázky)

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  await importWiringDevices(prisma, (readWiringSnapshot() ?? []).filter((row) => row.series === "Levit"));
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

const credits = async () => (await prisma.registeredCompany.findUniqueOrThrow({ where: { id: companyId } })).creditsRemaining;

async function lintOf(projectId: string) {
  const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: projectId }, include: { items: { include: { catalogComponent: true } }, enclosure: true } });
  return { project, issues: projectLintIssues(project, project.enclosure?.totalModules ?? null) };
}

describe("fáze 92 – tréninkové zakázky AI Panel Builderu", () => {
  it("tři zakázky vzniknou jedním klikem bez kreditu a podruhé se otevře stejný projekt", async () => {
    const before = await credits();
    const sizes: Record<string, number | null> = {};
    for (const job of TRAINER_JOBS) {
      const first = await openTrainerProject(prisma, { companyId, preset: job.id });
      expect(first.created).toBe(true);
      const again = await openTrainerProject(prisma, { companyId, preset: job.id });
      expect(again).toEqual({ id: first.id, created: false });
      const { project, issues } = await lintOf(first.id);
      expect(project).toMatchObject({ trainerPreset: job.id, name: job.projectName, companyId });
      sizes[job.id] = project.enclosure?.totalModules ?? railCapacities(project).reduce((sum, value) => sum + value, 0);
      // Zakázka bez záměrné chyby je čistá, RD + FVE má právě chránič wallboxu typu A
      if (job.defect) expect(issues.map((issue) => issue.rule)).toEqual(["rcd-type-b"]);
      else expect(issues).toEqual([]);
    }
    expect(await credits()).toBe(before);
    expect(sizes).toEqual({ "byt-3kk": 48, "rd-fve": 96, "chytry-dum": 120 });
  });

  it("RD + FVE: Elektro-linter najde chránič wallboxu typu A a oprava jedním klikem ho vrátí na typ B", async () => {
    const { id } = await openTrainerProject(prisma, { companyId, preset: "rd-fve" });
    const { issues } = await lintOf(id);
    const fix = issues[0].fix;
    expect(issues[0].message).toMatch(/Wallbox/);
    expect(fix?.kind).toBe("configure");
    if (fix?.kind !== "configure") return;
    await configureItem(prisma, fix.itemId, fix.config);
    expect((await lintOf(id)).issues).toEqual([]);
  });

  it("chytrý dům má akční členy ABB-free@home na DIN liště", async () => {
    const { id } = await openTrainerProject(prisma, { companyId, preset: "chytry-dum" });
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: id }, include: { catalogComponent: true } });
    const types = items.map((item) => item.customTypeCode ?? item.catalogComponent?.typeCode ?? "");
    for (const prefix of ["SA-M", "DA/M", "BA-M", "HA-M", "PS-M"]) expect(types.some((type) => type.startsWith(prefix)), prefix).toBe(true);
  });
});

describe("fáze 92 – trenažér 2D půdorysu", () => {
  const finished = () => {
    const draft = sandboxDraft();
    return {
      ...draft,
      elements: [
        ...draft.elements.map((element) => (element.id === SANDBOX_BATH_LIGHT_ID ? { ...element, light: { dimmable: true, powerW: 20, load: "led" as const } } : element)),
        { id: "uzivatel-1", item: "double-socket", x: SANDBOX_BED_TARGET.x, y: SANDBOX_BED_TARGET.y, room: "Ložnice", mountHeightMm: null, frameUnits: 2, series: null, color: null, controls: [], rotation: 0, scale: null },
      ],
    };
  };

  it("rozváděč z cvičného bungalovu vznikne bez kreditu se značkou trenažéru", async () => {
    const before = await credits();
    const result = await createSandboxProject(prisma, { companyId, draft: finished() });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id } });
    expect(project.trainerPreset).toBe(SANDBOX_TRAINER_PRESET);
    expect(project.floorplanJson).toContain("uzivatel-1");
    expect(await credits()).toBe(before);
  });

  it("jiný nákres než cvičný bungalov bez kreditu neprojde a počet rozváděčů z trenažérů je omezený", async () => {
    const draft = finished();
    await expect(createSandboxProject(prisma, { companyId, draft: { ...draft, rooms: draft.rooms.map((room) => ({ ...room, w: room.w * 2 })) } })).rejects.toThrow(/Místnosti cvičného bungalovu/);
    await prisma.panelBoardProject.updateMany({ where: { companyId }, data: { trainerPreset: "byt-3kk" } });
    const count = await prisma.panelBoardProject.count({ where: { companyId } });
    for (let index = count; index < TRAINER_PROJECT_LIMIT; index++) await createSandboxProject(prisma, { companyId, draft });
    await expect(createSandboxProject(prisma, { companyId, draft })).rejects.toThrow(/smažte některé/);
  });
});
