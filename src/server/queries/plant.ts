import "server-only";

import { cache } from "react";

import type { BuildingType, EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/session";
import { BACKUP_TYPES, isPowerBackupTier, type BackupNode } from "@/lib/power-backup";
import { buildingEntryHref } from "@/lib/routes";
import { worstEquipmentStatus } from "@/lib/status";

/**
 * Závody viditelné pro aktuálního uživatele: registrovaná firma (fáze 41) jen svůj závod,
 * obchodní demo jen závody, které nepatří žádné firmě registrované do Správy závodů.
 */
export async function plantAccessWhere(): Promise<Prisma.PlantWhereInput> {
  const user = await getCurrentUser();
  // Firma AI Panel Builderu může mít vazbu na demo závod (propuštění pasportu) – skrývají se jen závody správy závodů.
  return user.homePlantId ? { id: user.homePlantId } : { registeredCompanies: { none: { productScope: "PLANT_MANAGEMENT" } } };
}

/** Závod je pro aktuálního uživatele dostupný (jinak stránka vrátí 404). */
export async function canAccessPlant(plantId: string): Promise<boolean> {
  return (await prisma.plant.count({ where: { AND: [{ id: plantId }, await plantAccessWhere()] } })) > 0;
}

/** Všechna zařízení leží v závodech dostupných pro aktuálního uživatele (zápisy lhůtníku – fáze 66). */
export async function canAccessEquipment(equipmentIds: readonly string[]): Promise<boolean> {
  const ids = [...new Set(equipmentIds)];
  if (!ids.length) return true;
  const plant = await plantAccessWhere();
  return (await prisma.equipment.count({ where: { id: { in: ids }, floor: { building: { plant } } } })) === ids.length;
}

export async function getPlants() {
  return prisma.plant.findMany({
    where: await plantAccessWhere(),
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
async function loadPlantOverview(plantId: string, types: EquipmentType[] | null = null) {
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

/** Deduplikace v rámci požadavku (generateMetadata + stránka). */
export const getPlantOverview = cache(loadPlantOverview);

/**
 * Fáze 93: strom napájení závodu pro filtr větví nad mapou areálu – rozváděče a zdroje s úrovní zálohy, kapacitou zdroje,
 * proudy (výkon větve) a nájemní jednotkou / oddělením. Účet bez rozváděčů ve výřezu dostane prázdný seznam.
 */
export async function getPlantPower(plantId: string, types: EquipmentType[] | null = null): Promise<BackupNode[]> {
  const visible = types ? BACKUP_TYPES.filter((type) => types.includes(type)) : BACKUP_TYPES;
  if (!visible.length) return [];
  const rows = await prisma.equipment.findMany({
    where: { type: { in: [...visible] }, floor: { building: { plantId } } },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, name: true, type: true, fedFromEquipmentId: true, powerBackupTier: true, backupCapacityKva: true, nominalCurrentA: true, measuredCurrentA: true, tenantUnit: true, floor: { select: { buildingId: true } } },
  });
  const ids = new Set(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    name: row.name,
    type: row.type,
    // Napájení z rozváděče mimo výřez účtu = kořen větve
    parentId: row.fedFromEquipmentId && ids.has(row.fedFromEquipmentId) ? row.fedFromEquipmentId : null,
    buildingId: row.floor.buildingId,
    tier: isPowerBackupTier(row.powerBackupTier) ? row.powerBackupTier : "GRID_STANDARD",
    capacityKva: row.backupCapacityKva,
    nominalCurrentA: row.nominalCurrentA,
    measuredCurrentA: row.measuredCurrentA,
    tenantUnit: row.tenantUnit,
  }));
}

export type PlantOverview = NonNullable<Awaited<ReturnType<typeof getPlantOverview>>>;
