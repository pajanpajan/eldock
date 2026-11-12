import type { PrismaClient } from "@/generated/prisma/client";
import { inspectionIssues, inspectionSchema, nextVersion, VERSION_STATUS, type Inspection } from "@/lib/switchboard-versions";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { ensureProjectLabel } from "./qr-labels";

// Fáze 103: zamykání a verzování dokumentace rozváděče. Vydání = neměnný snímek (dokumentace 6 listů s naměřenými
// hodnotami a podpisem revizního technika + navázaný 2D půdorys a jeho kusovník) jako nová verze 1.0 / 1.1 …;
// předchozí platná verze se v téže transakci přepne na SUPERSEDED (NEAKTUÁLNÍ – nahrazeno novou verzí).

export function parseInspection(input: unknown): Inspection {
  const parsed = inspectionSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Zkontrolujte naměřené hodnoty.");
  const issues = inspectionIssues(parsed.data);
  if (issues.length) throw new WorkflowError("VALIDATION", `Uzamknout lze jen vyhovující rozváděč: ${issues.join(" ")}`);
  return parsed.data;
}

/** Konstrukce hotová → čeká na kusovou zkoušku (úpravy zamčené). */
export async function submitForInspection(prisma: PrismaClient, projectId: string, companyId: string) {
  const { count } = await prisma.panelBoardProject.updateMany({ where: { id: projectId, companyId, docState: "DRAFT" }, data: { docState: "PENDING_INSPECTION" } });
  if (!count) throw new WorkflowError("VALIDATION", "Ke kusové zkoušce jde předat jen rozpracovaný rozváděč.");
}

/** Vrácení ke kusové zkoušce předaného rozváděče do úprav. */
export async function returnToDraft(prisma: PrismaClient, projectId: string, companyId: string) {
  const { count } = await prisma.panelBoardProject.updateMany({ where: { id: projectId, companyId, docState: "PENDING_INSPECTION" }, data: { docState: "DRAFT" } });
  if (!count) throw new WorkflowError("VALIDATION", "Rozváděč nečeká na kusovou zkoušku.");
}

export interface PublishInput {
  projectId: string;
  companyId: string;
  inspection: Inspection;
  /** Neměnná data 6listového elaborátu (DocumentationData) s vyplněnou kusovou zkouškou – `snapshotStringify`. */
  documentationJson: string;
  floorplan: { name: string; json: string } | null;
  /** Protokol o kusové zkoušce doplněný o měření technika – uloží se i do rozpracovaného projektu. */
  routineTestJson?: string;
  now?: Date;
}

/** 🔒 Potvrzení kusové zkoušky, uzamčení a vydání verze X.Y. */
export async function publishVersion(prisma: PrismaClient, input: PublishInput) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const project = await tx.panelBoardProject.findFirst({ where: { id: input.projectId, companyId: input.companyId }, select: { id: true, docState: true, qrSerial: true, companyId: true, company: { select: { companyName: true, ico: true, email: true } } } });
    if (!project) throw new WorkflowError("NOT_FOUND", "Rozváděč nebyl nalezen.");
    if (project.docState === "LOCKED_PUBLISHED") throw new WorkflowError("VALIDATION", "Rozváděč je už uzamčený – pro změnu ho nejdřív odemkněte (nová revize).");
    const published = await tx.switchboardVersion.findMany({ where: { projectId: project.id }, select: { major: true, minor: true } });
    const next = nextVersion(published);
    await tx.switchboardVersion.updateMany({ where: { projectId: project.id, status: VERSION_STATUS.current }, data: { status: VERSION_STATUS.superseded, supersededAt: now, supersededByVersion: next.version } });
    const serial = await ensureProjectLabel(tx, project, project.company);
    const version = await tx.switchboardVersion.create({
      data: {
        projectId: project.id,
        major: next.major,
        minor: next.minor,
        version: next.version,
        status: VERSION_STATUS.current,
        inspectorName: input.inspection.inspectorName,
        inspectorCert: input.inspection.inspectorCert,
        measuredAt: new Date(`${input.inspection.measuredAt}T12:00:00Z`),
        measurementsJson: JSON.stringify(input.inspection),
        documentationJson: input.documentationJson,
        floorplanJson: input.floorplan?.json ?? null,
        floorplanName: input.floorplan?.name ?? null,
        publishedAt: now,
      },
    });
    await tx.panelBoardProject.update({ where: { id: project.id }, data: { docState: "LOCKED_PUBLISHED", ...(input.routineTestJson ? { routineTestJson: input.routineTestJson } : {}) } });
    return { version: version.version, serial };
  });
}

/** 🔓 Odemknutí k úpravě / nová revize – platná verze zůstává aktuální, dokud se nevydá další. */
export async function unlockProject(prisma: PrismaClient, projectId: string, companyId: string) {
  const { count } = await prisma.panelBoardProject.updateMany({ where: { id: projectId, companyId, docState: "LOCKED_PUBLISHED" }, data: { docState: "DRAFT" } });
  if (!count) throw new WorkflowError("VALIDATION", "Rozváděč není uzamčený.");
  const versions = await prisma.switchboardVersion.findMany({ where: { projectId }, select: { major: true, minor: true } });
  return nextVersion(versions).version;
}

/** Úpravy rozváděče jen v rozpracovaném stavu (kusová zkouška a vydaná verze jsou zamčené). */
export async function assertEditable(prisma: PrismaClient, where: { projectId: string } | { itemId: string }, options: { allowPending?: boolean } = {}) {
  const project = "projectId" in where ? await prisma.panelBoardProject.findUnique({ where: { id: where.projectId }, select: { docState: true } }) : (await prisma.panelBoardItem.findUnique({ where: { id: where.itemId }, select: { project: { select: { docState: true } } } }))?.project;
  if (project && project.docState !== "DRAFT" && !(options.allowPending && project.docState === "PENDING_INSPECTION")) throw new WorkflowError("VALIDATION", project.docState === "LOCKED_PUBLISHED" ? "🔒 Rozváděč je uzamčený ve schválené verzi – pro úpravu ho odemkněte (Založit novou revizi)." : "Rozváděč čeká na kusovou zkoušku – úpravy jsou zamčené (vraťte ho do úprav).");
}
