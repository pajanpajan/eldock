import "server-only";

import { prisma } from "@/lib/prisma";

/** Zařízení s lokací pro hlavičku detailu (kompletní dokumentaci doplní fáze 6). */
export async function getEquipmentHeader(equipmentId: string) {
  return prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      floor: {
        select: {
          id: true,
          name: true,
          building: { select: { id: true, name: true, plant: { select: { id: true, name: true } } } },
        },
      },
    },
  });
}
