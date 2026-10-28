import "server-only";

import type { EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";
import { extractFloorplanRooms } from "@/lib/mock-graphics/floorplan";
import { prisma } from "@/lib/prisma";
import { floorHref } from "@/lib/routes";
import { worstEquipmentStatus } from "@/lib/status";

export interface FloorOverview {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  href: string;
  /** Dispozice patra normalizovaná na 0–1 (náznak v izometrii). */
  rooms: { x: number; y: number; w: number; h: number }[];
  equipment: { id: string; tag: string; type: EquipmentType; status: EquipmentStatus; x: number; y: number }[];
  counts: { total: number; pending: number; waiting: number };
  worstStatus: EquipmentStatus;
}

/** Level 2 – budova s patry (od nejnižšího), dispozicí a piny zařízení. */
export async function getBuildingOverview(plantId: string, buildingId: string) {
  const building = await prisma.building.findFirst({
    where: { id: buildingId, plantId },
    include: {
      plant: { select: { id: true, name: true } },
      floors: {
        orderBy: { level: "asc" },
        include: {
          equipment: {
            orderBy: { tag: "asc" },
            select: { id: true, tag: true, type: true, status: true, pinX: true, pinY: true },
          },
        },
      },
    },
  });
  if (!building) return null;

  const floors: FloorOverview[] = building.floors.map((floor) => {
    const statuses = floor.equipment.map((equipment) => equipment.status);
    return {
      id: floor.id,
      code: floor.code,
      name: floor.name,
      description: floor.description,
      level: floor.level,
      href: floorHref(plantId, building.id, floor.id),
      rooms: extractFloorplanRooms(floor.floorplanSvg ?? "").map((room) => ({
        x: room.x / floor.viewBoxW,
        y: room.y / floor.viewBoxH,
        w: room.w / floor.viewBoxW,
        h: room.h / floor.viewBoxH,
      })),
      equipment: floor.equipment.map(({ id, tag, type, status, pinX, pinY }) => ({
        id,
        tag,
        type,
        status,
        x: pinX / 100,
        y: pinY / 100,
      })),
      counts: {
        total: statuses.length,
        pending: statuses.filter((status) => status === "PENDING_UPDATE").length,
        waiting: statuses.filter((status) => status === "WAITING_APPROVAL").length,
      },
      worstStatus: worstEquipmentStatus(statuses),
    };
  });

  return {
    id: building.id,
    code: building.code,
    name: building.name,
    type: building.type,
    description: building.description,
    plant: building.plant,
    floors,
  };
}

export type BuildingDetail = NonNullable<Awaited<ReturnType<typeof getBuildingOverview>>>;

/** Patro s budovou a závodem pro hlavičku a drobečkovou navigaci. */
export async function getFloorHeader(plantId: string, buildingId: string, floorId: string) {
  return prisma.floor.findFirst({
    where: { id: floorId, buildingId, building: { plantId } },
    include: {
      building: {
        select: { id: true, name: true, plant: { select: { id: true, name: true } }, _count: { select: { floors: true } } },
      },
      _count: { select: { equipment: true } },
    },
  });
}
