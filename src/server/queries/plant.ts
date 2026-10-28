import "server-only";

import { prisma } from "@/lib/prisma";

export async function getPlants() {
  return prisma.plant.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, city: true },
  });
}

/** Závod se základními počty (úplný přehled areálu doplní fáze 3). */
export async function getPlantSummary(plantId: string) {
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    select: { id: true, code: true, name: true, customerName: true, city: true, address: true },
  });
  if (!plant) return null;

  const where = { floor: { building: { plantId } } };
  const [buildings, equipment, pending, waiting] = await Promise.all([
    prisma.building.count({ where: { plantId } }),
    prisma.equipment.count({ where }),
    prisma.equipment.count({ where: { ...where, status: "PENDING_UPDATE" } }),
    prisma.equipment.count({ where: { ...where, status: "WAITING_APPROVAL" } }),
  ]);
  return { ...plant, buildings, equipment, pending, waiting };
}
