import "server-only";

import type { BuildingType, EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buildingEntryHref } from "@/lib/routes";
import { worstEquipmentStatus } from "@/lib/status";

export async function getPlants() {
  return prisma.plant.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, city: true },
  });
}

export interface StatusCounts {
  /** Zařízení celkem. */
  total: number;
  /** 🟠 nahlášená změna (otevřený CR SUBMITTED / IN_PROGRESS). */
  pending: number;
  /** 🔵 nová revize čeká na schválení. */
  waiting: number;
}

export interface BuildingOverview {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: BuildingType;
  description: string | null;
  mapPolygon: string;
  labelX: number;
  labelY: number;
  floors: { id: string; code: string; name: string; level: number }[];
  /** Kam vede klik: výběr patra, nebo rovnou půdorys jednopodlažní budovy. */
  href: string;
  counts: StatusCounts;
  worstStatus: EquipmentStatus;
}

const countStatuses = (statuses: EquipmentStatus[]): StatusCounts => ({
  total: statuses.length,
  pending: statuses.filter((status) => status === "PENDING_UPDATE").length,
  waiting: statuses.filter((status) => status === "WAITING_APPROVAL").length,
});

/** Level 1 – areál: budovy s geometrií, patry a souhrnem stavů zařízení. */
export async function getPlantOverview(plantId: string, types: EquipmentType[] | null = null) {
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    include: {
      buildings: {
        orderBy: { sortOrder: "asc" },
        include: {
          floors: {
            orderBy: { level: "asc" },
            select: { id: true, code: true, name: true, level: true, equipment: { where: types ? { type: { in: types } } : undefined, select: { status: true } } },
          },
        },
      },
    },
  });
  if (!plant) return null;

  const buildings: BuildingOverview[] = plant.buildings.map((building) => {
    const statuses = building.floors.flatMap((floor) => floor.equipment.map((equipment) => equipment.status));
    return {
      id: building.id,
      code: building.code,
      name: building.name,
      shortName: building.shortName,
      type: building.type,
      description: building.description,
      mapPolygon: building.mapPolygon,
      labelX: building.labelX,
      labelY: building.labelY,
      floors: building.floors.map(({ id, code, name, level }) => ({ id, code, name, level })),
      href: buildingEntryHref(plant.id, building.id, building.floors.map((floor) => floor.id)),
      counts: countStatuses(statuses),
      worstStatus: worstEquipmentStatus(statuses),
    };
  });

  return {
    id: plant.id,
    code: plant.code,
    name: plant.name,
    customerName: plant.customerName,
    city: plant.city,
    address: plant.address,
    viewBox: { width: plant.campusViewBoxW, height: plant.campusViewBoxH },
    buildings,
    counts: {
      total: buildings.reduce((sum, building) => sum + building.counts.total, 0),
      pending: buildings.reduce((sum, building) => sum + building.counts.pending, 0),
      waiting: buildings.reduce((sum, building) => sum + building.counts.waiting, 0),
    } satisfies StatusCounts,
  };
}

export type PlantOverview = NonNullable<Awaited<ReturnType<typeof getPlantOverview>>>;
