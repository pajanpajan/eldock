import "server-only";

import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"] as const;

/** Detail zařízení: lokace, všechny revize (autor, schvalovatel, BOM) a otevřený požadavek na změnu. */
export async function getEquipmentDetail(equipmentId: string) {
  return prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      floor: {
        select: {
          id: true,
          name: true,
          building: {
            select: {
              id: true,
              name: true,
              plant: { select: { id: true, name: true } },
              _count: { select: { floors: true } },
            },
          },
        },
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
