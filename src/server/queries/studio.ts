import "server-only";

import { prisma } from "@/lib/prisma";
import { STUDIO_MENU_KEY } from "@/lib/studio-menu";

/** Podklady Studia: budovy a patra závodu (s půdorysem), zařízení pro hierarchii napájení. */
export async function getStudioData(plantId: string) {
  // Závod i zařízení najednou (zařízení se filtrují přes plantId, na závodu nezávisí).
  const [plant, equipment, menu] = await Promise.all([
    prisma.plant.findUnique({
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
            floors: { orderBy: { level: "asc" }, select: { id: true, level: true, code: true, name: true, floorplanSvg: true, studioLayoutJson: true } },
          },
        },
      },
    }),
    prisma.equipment.findMany({
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
    }),
    prisma.tenantSetting.findUnique({ where: { key: STUDIO_MENU_KEY }, select: { value: true } }),
  ]);
  if (!plant) return null;
  // Vlastní nabídka kroku 3 jako JSON (klient ji ověří a porovná s localStorage)
  return { plant, equipment, menuJson: menu?.value ?? null };
}

export type StudioData = NonNullable<Awaited<ReturnType<typeof getStudioData>>>;
