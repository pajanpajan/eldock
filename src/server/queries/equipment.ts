import "server-only";

import type { PowerNode } from "@/lib/power-tree";
import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"] as const;

/** Detail zařízení: lokace, napájení, revize (autor, schvalovatel, BOM), otevřený požadavek, pasport a revizní zprávy. */
export async function getEquipmentDetail(equipmentId: string) {
  return prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      floor: {
        select: {
          id: true,
          code: true,
          name: true,
          building: {
            select: {
              id: true,
              code: true,
              name: true,
              plant: { select: { id: true, code: true, name: true, customerName: true } },
              _count: { select: { floors: true } },
            },
          },
        },
      },
      fedFrom: { select: { id: true, tag: true, name: true } },
      feeds: { orderBy: [{ fedFromCircuit: "asc" }, { tag: "asc" }], select: { id: true, tag: true, name: true, type: true, fedFromCircuit: true } },
      complianceDocuments: { orderBy: { issuedAt: "desc" } },
      inspections: {
        orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
        include: { defects: { orderBy: [{ status: "asc" }, { deadline: "asc" }] } },
      },
      temporaryMods: {
        orderBy: { createdAt: "desc" },
        include: { spawnedChangeRequest: { select: { id: true, number: true } } },
      },
      revisions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        include: {
          author: { select: { name: true, company: true } },
          approver: { select: { name: true } },
          changeRequest: { select: { id: true, number: true } },
          bomItems: { orderBy: { position: "asc" } },
        },
      },
      changeRequests: {
        where: { status: { in: [...OPEN_STATUSES] } },
        take: 1,
        include: {
          reporter: { select: { name: true, company: true } },
          assignee: { select: { name: true } },
          baseRevision: { select: { id: true, version: true, schematicUrl: true, schematicFormat: true } },
          attachments: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
        },
      },
    },
  });
}

export type EquipmentDetail = NonNullable<Awaited<ReturnType<typeof getEquipmentDetail>>>;
export type EquipmentRevision = EquipmentDetail["revisions"][number];
export type OpenChangeRequest = EquipmentDetail["changeRequests"][number];
export type EquipmentComplianceDocument = EquipmentDetail["complianceDocuments"][number];
export type EquipmentInspection = EquipmentDetail["inspections"][number];
export type EquipmentDefect = EquipmentInspection["defects"][number];
export type EquipmentTemporaryMod = EquipmentDetail["temporaryMods"][number];

/** Uzly stromu napájení závodu (LOTO karta: kde vypnout a co zůstane bez proudu). */
export async function getPowerNodes(plantId: string): Promise<PowerNode[]> {
  return prisma.equipment.findMany({
    where: { floor: { building: { plantId } } },
    select: { id: true, tag: true, name: true, type: true, fedFromEquipmentId: true, fedFromCircuit: true },
  });
}

const revisionForCompare = {
  select: {
    id: true,
    version: true,
    status: true,
    title: true,
    summary: true,
    schematicUrl: true,
    schematicFormat: true,
    createdAt: true,
    approvedAt: true,
    author: { select: { name: true } },
    approver: { select: { name: true } },
    bomItems: { orderBy: { position: "asc" as const } },
  },
} as const;

/** Podklady schválení: otevřený požadavek, revize ke schválení a dosavadní platná revize. */
export async function getApprovalData(equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      tag: true,
      name: true,
      status: true,
      floor: {
        select: {
          id: true,
          name: true,
          building: { select: { id: true, name: true, plant: { select: { id: true, name: true } }, _count: { select: { floors: true } } } },
        },
      },
      changeRequests: {
        where: { status: { in: [...OPEN_STATUSES] } },
        take: 1,
        select: {
          id: true,
          number: true,
          status: true,
          markupData: true,
          voiceTranscript: true,
          note: true,
          submittedAt: true,
          baseRevisionId: true,
          reporter: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      },
    },
  });
  if (!equipment) return null;
  const change = equipment.changeRequests[0] ?? null;
  const [pending, active] = await Promise.all([
    change
      ? prisma.documentRevision.findFirst({
          where: { changeRequestId: change.id, status: "PENDING_APPROVAL" },
          orderBy: [{ major: "desc" }, { minor: "desc" }],
          ...revisionForCompare,
        })
      : null,
    prisma.documentRevision.findFirst({ where: { equipmentId, status: "ACTIVE" }, ...revisionForCompare }),
  ]);
  return { equipment, change, pending, active };
}

export type ApprovalData = NonNullable<Awaited<ReturnType<typeof getApprovalData>>>;
export type CompareRevision = NonNullable<ApprovalData["active"]>;
