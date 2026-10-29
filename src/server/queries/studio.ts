import "server-only";

import { prisma } from "@/lib/prisma";

/** Podklady Studia: budovy a patra závodu (s půdorysem), zařízení pro hierarchii napájení. */
export async function getStudioData(plantId: string) {
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    select: {
      id: true,
      code: true,
      name: true,
      campusWidthM: true,
      campusDepthM: true,
      buildings: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          mapPolygon: true,
          labelX: true,
          labelY: true,
          floors: { orderBy: { level: "asc" }, select: { id: true, level: true, code: true, name: true, floorplanSvg: true } },
        },
      },
    },
  });
  if (!plant) return null;
  const equipment = await prisma.equipment.findMany({
    where: { floor: { building: { plantId } } },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      floorId: true,
      pinX: true,
      pinY: true,
      fedFromEquipmentId: true,
      fedFromCircuit: true,
      fedFrom: { select: { id: true, tag: true } },
    },
  });
  return { plant, equipment };
}

export type StudioData = NonNullable<Awaited<ReturnType<typeof getStudioData>>>;
