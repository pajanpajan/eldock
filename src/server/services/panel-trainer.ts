// Fáze 92: rozváděče z trenažérů bez kreditu – trenažér 2D půdorysu (cvičný bungalov) a tři tréninkové zakázky AI Panel
// Builderu. Vznikají stejným generátorem jako vlastní zakázky (`createProjectFromFloorplan`), jen bez odečtu kreditu a se
// značkou `trainerPreset`. Bez kreditu jde jen předvolba: trenažér půdorysu ověří, že nákres je opravdu cvičný bungalov
// (`sandboxDraftIssue`), tréninkovou zakázku server sestaví sám a podruhé otevře tu existující; na firmu nejvýš
// `TRAINER_PROJECT_LIMIT` rozváděčů z trenažérů. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { configFromComponent, parseConfig } from "@/lib/panel-builder/configurator";
import { parseDraft } from "@/lib/panel-builder/floorplan-editor";
import { SANDBOX_TRAINER_PRESET, TRAINER_PROJECT_LIMIT, sandboxDraftIssue } from "@/lib/panel-builder/floorplan-sandbox-preset";
import { TYPE_B_LABEL } from "@/lib/panel-builder/linter";
import { SANDBOX_JOB, trainerDraft, trainerJob, type TrainerPresetId } from "@/lib/panel-builder/panel-trainer-presets";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { configureItem } from "./panel-builder";
import { createProjectFromFloorplan } from "./panel-projects";

type ManufacturerInfo = Parameters<typeof createProjectFromFloorplan>[1]["manufacturerInfo"];

async function assertCapacity(prisma: PrismaClient, companyId: string) {
  const count = await prisma.panelBoardProject.count({ where: { companyId, trainerPreset: { not: null } } });
  if (count >= TRAINER_PROJECT_LIMIT) throw new WorkflowError("VALIDATION", `Rozváděčů z trenažéru máte už ${count} – smažte některé v seznamu projektů a zkuste to znovu.`);
}

/** ⚡ z trenažéru 2D půdorysu: rozváděč z cvičného bungalovu bez kreditu (jiný nákres server odmítne). */
export async function createSandboxProject(prisma: PrismaClient, input: { companyId: string; draft: unknown; manufacturerInfo?: ManufacturerInfo; createdById?: string | null }) {
  const draft = parseDraft(input.draft);
  if (!draft) throw new WorkflowError("VALIDATION", "Půdorys trenažéru se nepodařilo načíst.");
  const issue = sandboxDraftIssue(draft);
  if (issue) throw new WorkflowError("VALIDATION", issue);
  await assertCapacity(prisma, input.companyId);
  const result = await createProjectFromFloorplan(prisma, {
    name: SANDBOX_JOB.projectName,
    customerName: SANDBOX_JOB.customerName,
    installationSite: SANDBOX_JOB.installationSite,
    draft,
    companyId: input.companyId,
    manufacturerInfo: input.manufacturerInfo,
    createdById: input.createdById ?? undefined,
  });
  await prisma.panelBoardProject.updateMany({ where: { id: { in: [result.id, ...result.boards.map((board) => board.id)] } }, data: { trainerPreset: SANDBOX_TRAINER_PRESET } });
  return result;
}

/**
 * Tréninková zakázka jedním klikem: existující projekt firmy se stejnou předvolbou, jinak nový z nákresu předvolby
 * (bez kreditu). Zakázka „RD + FVE a wallbox“ dostane záměrnou normovou chybu pro Elektro-linter.
 */
export async function openTrainerProject(prisma: PrismaClient, input: { companyId: string; preset: TrainerPresetId; manufacturerInfo?: ManufacturerInfo; createdById?: string | null }) {
  const job = trainerJob(input.preset);
  if (!job) throw new WorkflowError("VALIDATION", "Neznámá tréninková zakázka.");
  const existing = await prisma.panelBoardProject.findFirst({ where: { companyId: input.companyId, trainerPreset: job.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  await assertCapacity(prisma, input.companyId);
  const result = await createProjectFromFloorplan(prisma, {
    name: job.projectName,
    customerName: job.customerName,
    installationSite: job.installationSite,
    draft: trainerDraft(job.id),
    companyId: input.companyId,
    manufacturerInfo: input.manufacturerInfo,
    createdById: input.createdById ?? undefined,
  });
  try {
    await prisma.panelBoardProject.updateMany({ where: { id: { in: [result.id, ...result.boards.map((board) => board.id)] } }, data: { trainerPreset: job.id } });
    if (job.id === "rd-fve") await injectWallboxDefect(prisma, result.id);
  } catch (error) {
    await prisma.panelBoardProject.deleteMany({ where: { id: { in: [result.id, ...result.boards.map((board) => board.id)] } } });
    throw error;
  }
  return { id: result.id, created: true };
}

/**
 * Záměrná chyba zakázky RD + FVE: chránič wallboxu z typu B na typ A (ČSN 33 2130 ed. 4 – výkonová elektronika chce
 * typ B / F). Elektro-linter ji najde jako „rcd-type-b“ s opravou jedním klikem.
 */
export async function injectWallboxDefect(prisma: PrismaClient, projectId: string) {
  const items = await prisma.panelBoardItem.findMany({ where: { projectId }, include: { catalogComponent: true } });
  const configOf = (item: (typeof items)[number]) => parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null);
  // Fáze 111: jen jistič / jističochránič okruhu wallboxu (ne elektroměr DLM „… wallboxu“ – pořadí na lištách se mění)
  const wallbox = items.find((item) => /wallbox|elektromobil|nabíje/i.test(item.circuitLabel) && TYPE_B_LABEL.test(item.circuitLabel) && ["MCB", "RCBO"].includes(configOf(item)?.category ?? ""));
  if (!wallbox) throw new WorkflowError("VALIDATION", "V tréninkové zakázce chybí okruh wallboxu.");
  const own = configOf(wallbox);
  // Jističochránič wallboxu, jinak chránič nad jeho jističem
  const target = own?.category === "RCBO" ? wallbox : items.find((item) => item.id === wallbox.parentItemId && configOf(item)?.category === "RCD");
  const config = target ? configOf(target) : null;
  if (!target || !config) throw new WorkflowError("VALIDATION", "Chránič wallboxu v tréninkové zakázce nebyl nalezen.");
  await configureItem(prisma, target.id, { ...config, rcdType: "A" });
  return target.id;
}
