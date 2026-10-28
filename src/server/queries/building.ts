import "server-only";

import { prisma } from "@/lib/prisma";

/** Budova s patry a stavy zařízení (izometrický pohled doplní fáze 4). */
export async function getBuilding(plantId: string, buildingId: string) {
  return prisma.building.findFirst({
    where: { id: buildingId, plantId },
    include: {
      plant: { select: { id: true, name: true } },
      floors: {
        orderBy: { level: "desc" },
        include: { equipment: { select: { status: true } } },
      },
    },
  });
}

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
