import "server-only";

import { DEADLINE_TYPES, summarizeInspections } from "@/lib/inspection";
import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"] as const;

/** Level 3 – patro s půdorysem a zařízeními (aktivní revize + otevřený požadavek na změnu). */
export async function getFloorView(plantId: string, buildingId: string, floorId: string) {
  const floor = await prisma.floor.findFirst({
    where: { id: floorId, buildingId, building: { plantId } },
    include: {
      building: {
        select: {
          id: true,
          name: true,
          plant: { select: { id: true, name: true } },
          floors: { orderBy: { level: "desc" }, select: { id: true, name: true, code: true } },
        },
      },
      equipment: {
        orderBy: { tag: "asc" },
        select: {
          id: true,
          tag: true,
          name: true,
          type: true,
          status: true,
          description: true,
          manufacturer: true,
          model: true,
          ratedVoltage: true,
          ratedCurrent: true,
          pinX: true,
          pinY: true,
          revisions: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { version: true, approvedAt: true, createdAt: true },
          },
          inspections: {
            where: { type: { in: [...DEADLINE_TYPES] } },
            select: { type: true, inspectionDate: true, validUntil: true, result: true },
          },
          changeRequests: {
            where: { status: { in: [...OPEN_STATUSES] } },
            take: 1,
            select: {
              number: true,
              status: true,
              priority: true,
              submittedAt: true,
              voiceTranscript: true,
              note: true,
              reporter: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!floor) return null;
  const now = new Date();

  return {
    id: floor.id,
    code: floor.code,
    name: floor.name,
    description: floor.description,
    floorplanSvg: floor.floorplanSvg ?? "",
    viewBox: { width: floor.viewBoxW, height: floor.viewBoxH },
    building: floor.building,
    equipment: floor.equipment.map(({ revisions, changeRequests, inspections, ...equipment }) => ({
      ...equipment,
      inspection: summarizeInspections(inspections, now),
      activeRevision: revisions[0] ?? null,
      openChange: changeRequests[0] ?? null,
    })),
  };
}

export type FloorView = NonNullable<Awaited<ReturnType<typeof getFloorView>>>;
export type FloorEquipment = FloorView["equipment"][number];
