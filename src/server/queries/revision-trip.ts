import "server-only";

import type { EquipmentType } from "@/generated/prisma/enums";
import { polygonBounds } from "@/lib/campus-layout";
import { DEADLINE_TYPES, summarizeInspections } from "@/lib/inspection";
import { prisma } from "@/lib/prisma";
import type { TripItem } from "@/lib/revision-trip";
import { plantAccessWhere } from "@/server/queries/plant";

/** Střed budovy na mapě areálu (procenta); budova bez polygonu nemá polohu. */
function centerOf(mapPolygon: string | null): TripItem["buildingCenter"] {
  if (!mapPolygon?.trim()) return null;
  const box = polygonBounds(mapPolygon);
  const x = box.x + box.w / 2;
  const y = box.y + box.h / 2;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * Fáze 108: podklad Chytré revize – zařízení závodu (bez `plantId` všech dostupných závodů účtu) se stavem lhůty,
 * budovou (střed na mapě) a podlažím. Zneplatněné revize (zneužití osvědčení TIČR) se do platnosti nepočítají.
 */
export async function getTripItems(plantId: string | null, now: Date = new Date(), types: EquipmentType[] | null = null): Promise<TripItem[]> {
  const access = await plantAccessWhere();
  const equipment = await prisma.equipment.findMany({
    where: {
      floor: { building: { plant: plantId ? { AND: [{ id: plantId }, access] } : access } },
      ...(types ? { type: { in: types } } : {}),
    },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      assignedZone: true,
      floor: {
        select: {
          id: true,
          code: true,
          level: true,
          name: true,
          building: { select: { id: true, name: true, sortOrder: true, mapPolygon: true, plant: { select: { id: true, code: true, name: true } } } },
        },
      },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] }, misuseFlaggedAt: null },
        select: { type: true, inspectionDate: true, validUntil: true, result: true },
      },
    },
  });
  return equipment.map(({ floor, inspections, ...item }) => {
    const summary = summarizeInspections(inspections, now);
    const { building } = floor;
    return {
      id: item.id,
      tag: item.tag,
      name: item.name,
      type: item.type,
      buildingName: building.name,
      buildingOrder: building.sortOrder,
      floorCode: floor.code,
      floorLevel: floor.level,
      floorName: floor.name,
      zone: item.assignedZone,
      state: summary.state,
      daysLeft: summary.daysLeft,
      validUntil: summary.validUntil,
      plantId: building.plant.id,
      plantName: building.plant.name,
      buildingId: building.id,
      floorId: floor.id,
      buildingCenter: centerOf(building.mapPolygon),
    };
  });
}
