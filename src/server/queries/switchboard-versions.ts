import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { sequenceOf } from "@/lib/qr-label-registry";
import { snapshotParse } from "@/lib/switchboard-versions";
import type { DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { resolveLabel } from "@/server/services/qr-labels";

// Fáze 103: vydané verze dokumentace rozváděče a karta QR štítku /q/EL-… (veřejná – bez přihlášení).

const versionSelect = { major: true, minor: true, version: true, status: true, publishedAt: true, inspectorName: true, inspectorCert: true, measuredAt: true, supersededByVersion: true, floorplanName: true } as const;

type VersionRecord = { major: number; minor: number; version: string; status: string; publishedAt: Date; inspectorName: string; inspectorCert: string; measuredAt: Date; supersededByVersion: string | null; floorplanName: string | null };

const toRow = (row: VersionRecord) => ({
  major: row.major,
  minor: row.minor,
  version: row.version,
  status: row.status,
  publishedAt: row.publishedAt.toISOString(),
  inspectorName: row.inspectorName,
  inspectorCert: row.inspectorCert,
  measuredAt: row.measuredAt.toISOString().slice(0, 10),
  supersededByVersion: row.supersededByVersion,
  hasFloorplan: row.floorplanName !== null,
});

/** Vydané verze rozváděče – nejnovější první. */
export async function projectVersions(projectId: string) {
  const rows = await prisma.switchboardVersion.findMany({ where: { projectId }, orderBy: [{ major: "desc" }, { minor: "desc" }], select: versionSelect });
  return rows.map(toRow);
}

export type VersionSummary = ReturnType<typeof toRow>;

/** Karta štítku: štítek z registru, spárovaný rozváděč (nebo zařízení závodu) a jeho verze. */
export const getQrCard = cache(async (rawCode: string) => {
  const code = decodeURIComponent(rawCode).trim().toUpperCase();
  if (sequenceOf(code) === null) return null;
  const label = await resolveLabel(prisma, code);
  if (!label) return null;
  const project =
    label.targetType === "PANEL_PROJECT" && label.targetId
      ? await prisma.panelBoardProject.findUnique({
          where: { id: label.targetId },
          select: { id: true, code: true, name: true, boardCode: true, customerName: true, installationSite: true, docState: true, companyId: true, enclosureModel: true, company: { select: { companyName: true } }, versions: { orderBy: [{ major: "desc" }, { minor: "desc" }], select: versionSelect } },
        })
      : null;
  const equipment =
    label.targetType === "EQUIPMENT" && label.targetId
      ? await prisma.equipment.findUnique({ where: { id: label.targetId }, select: { id: true, tag: true, name: true, floor: { select: { building: { select: { plant: { select: { name: true } } } } } } } })
      : null;
  return {
    equipment,
    label: { serialCode: label.serialCode, targetType: label.targetType, targetId: label.targetId, activatedAt: label.activatedAt, companyName: label.batch.companyName, purpose: label.batch.purpose, batchCompanyId: label.batch.registeredCompanyId, batchIco: label.batch.ico, batchEmail: label.batch.email },
    project: project ? { ...project, versions: project.versions.map(toRow) } : null,
  };
});

export type QrCard = NonNullable<Awaited<ReturnType<typeof getQrCard>>>;

/** Neměnný snímek verze („1.0“) rozváděče pod štítkem – data elaborátu a navázaný půdorys. */
export async function getVersionSnapshot(rawCode: string, rawVersion: string) {
  const card = await getQrCard(rawCode);
  const version = decodeURIComponent(rawVersion).trim();
  if (!card?.project || !/^\d{1,3}\.\d{1,3}$/.test(version)) return null;
  const row = await prisma.switchboardVersion.findFirst({ where: { projectId: card.project.id, version }, select: { ...versionSelect, documentationJson: true, floorplanJson: true } });
  if (!row) return null;
  const current = card.project.versions.find((item) => item.status === "LOCKED_PUBLISHED")?.version ?? null;
  return { card, row: toRow(row), current, documentation: snapshotParse<DocumentationData>(row.documentationJson), floorplanJson: row.floorplanJson, floorplanName: row.floorplanName };
}
