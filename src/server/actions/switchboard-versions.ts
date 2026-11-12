"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseRoutineTest, routineTestVerdict } from "@/lib/legislation-2027";
import { ENVIRONMENT_BLOCKER } from "@/lib/panel-builder/environments";
import { prisma } from "@/lib/prisma";
import { inspectionBlock, mergeRoutineTest, nextVersion, snapshotStringify, type InspectionInput } from "@/lib/switchboard-versions";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { buildDocumentationData } from "@/server/panel-documentation";
import { actionFailure, guardCompany, guardProject } from "@/server/panel-guards";
import { getPanelProject } from "@/server/queries/panel-builder";
import { requestOrigin } from "@/server/request-url";
import { assignProjectLabel, pairLabelWithProject } from "@/server/services/qr-labels";
import { parseInspection, publishVersion, returnToDraft, submitForInspection, unlockProject } from "@/server/services/switchboard-versions";

import type { ActionResult } from "./workflow";

// Fáze 103: zamykání a verzování dokumentace rozváděče (krok Dokumentace, kusová zkouška & štítky).

const id = z.string().min(1).max(64);

function revalidateProject(projectId: string, serial?: string | null) {
  revalidatePath(`/panel-builder/${projectId}`, "layout");
  revalidatePath("/panel-builder");
  if (serial) revalidatePath(`/q/${serial}`, "layout");
}

/** Konstrukce hotová → předat ke kusové zkoušce (úpravy osazení a zapojení se zamknou). */
export async function submitForInspectionAction(projectId: string): Promise<ActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný rozváděč." };
  try {
    const company = await guardProject(projectId);
    await submitForInspection(prisma, projectId, company.id);
    revalidateProject(projectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Předání ke kusové zkoušce se nepodařilo.");
  }
}

/** ↩️ Vrátit předaný rozváděč do úprav. */
export async function returnToDraftAction(projectId: string): Promise<ActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný rozváděč." };
  try {
    const company = await guardProject(projectId);
    await returnToDraft(prisma, projectId, company.id);
    revalidateProject(projectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Vrácení do úprav se nepodařilo.");
  }
}

/**
 * 🔒 Potvrdit kusovou zkoušku, uzamknout PDF v cloudu a vydat Verzi X.Y: měření technika doplní protokol o kusové
 * zkoušce, rozváděč dostane z registru QR štítek (první vydání), snímek 6listového elaborátu (s částí revizního technika
 * a štítkem CE s adresou karty) a navázaného 2D půdorysu se uloží jako neměnná verze; předchozí verze → NEAKTUÁLNÍ.
 */
export async function publishSwitchboardVersionAction(projectId: string, input: InspectionInput): Promise<ActionResult<{ version: string; serial: string }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný rozváděč." };
  try {
    const company = await guardProject(projectId);
    const inspection = parseInspection(input);
    const state = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, select: { docState: true, routineTestJson: true, versions: { select: { major: true, minor: true } } } });
    if (!state) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
    if (state.docState === "LOCKED_PUBLISHED") throw new WorkflowError("VALIDATION", "Rozváděč je už uzamčený – pro změnu ho odemkněte (Založit novou revizi).");
    const routineTest = mergeRoutineTest(parseRoutineTest(state.routineTestJson), inspection);
    const evaluation = routineTestVerdict(routineTest);
    if (evaluation.verdict === "FAIL") throw new WorkflowError("VALIDATION", "Protokol o kusové zkoušce má nevyhovující bod – nevyhovující rozváděč se nevydává.");
    if (evaluation.verdict !== "PASS") throw new WorkflowError("VALIDATION", `V protokolu o kusové zkoušce (panel Kusová zkouška) chybí: ${evaluation.missing.join(", ")}.`);

    const project = await getPanelProject(projectId);
    if (!project) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
    const origin = await requestOrigin();
    const built = await buildDocumentationData(project, origin);
    const blockers = project.environmentConfirmedAt ? built.blockers : [ENVIRONMENT_BLOCKER, ...built.blockers];
    if (blockers.length) throw new WorkflowError("VALIDATION", `Uzamknout lze jen dokumentaci bez blokací: ${blockers.join(" ")}`);

    // Štítek z registru až po kontrolách (nevydaný rozváděč štítek nespotřebuje)
    const serial = await assignProjectLabel(prisma, projectId);
    const now = new Date();
    const version = nextVersion(state.versions).version;
    const data = { ...built.data, routineTest, inspection: inspectionBlock(inspection, version, now), qrUrl: `${origin}/q/${serial}` };
    const linked = await prisma.floorplan.findFirst({ where: { projectId, companyId: company.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { code: true, name: true, draftJson: true } });
    const floorplan = linked ? { name: [linked.code, linked.name].filter(Boolean).join(" "), json: linked.draftJson } : project.floorplanJson ? { name: project.name || project.code, json: project.floorplanJson } : null;
    const published = await publishVersion(prisma, { projectId, companyId: company.id, inspection, documentationJson: snapshotStringify(data), floorplan, routineTestJson: JSON.stringify(routineTest), now });
    revalidateProject(projectId, published.serial);
    return { ok: true, data: published };
  } catch (error) {
    return actionFailure(error, "Uzamčení a vydání verze se nepodařilo.");
  }
}

/** 🔓 Odemknout rozváděč k úpravě / Založit novou revizi – vydaná verze platí, dokud se neschválí další. */
export async function unlockSwitchboardAction(projectId: string): Promise<ActionResult<{ nextVersion: string }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný rozváděč." };
  try {
    const company = await guardProject(projectId);
    const next = await unlockProject(prisma, projectId, company.id);
    const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, select: { qrSerial: true } });
    revalidateProject(projectId, project?.qrSerial);
    return { ok: true, data: { nextVersion: next } };
  } catch (error) {
    return actionFailure(error, "Odemknutí rozváděče se nepodařilo.");
  }
}

/** Spárování předtištěného štítku firmy (série z velínu) s rozváděčem – z karty /q/EL-… po naskenování. */
export async function pairLabelAction(code: string, projectId: string): Promise<ActionResult<{ serial: string }>> {
  if (!id.safeParse(projectId).success || !/^EL-\d{6,9}$/i.test(code.trim())) return { ok: false, error: "Vyberte rozváděč." };
  try {
    const company = await guardCompany();
    const serial = await pairLabelWithProject(prisma, { code, projectId, companyId: company.id });
    revalidateProject(projectId, serial);
    return { ok: true, data: { serial } };
  } catch (error) {
    return actionFailure(error, "Spárování štítku se nepodařilo.");
  }
}
