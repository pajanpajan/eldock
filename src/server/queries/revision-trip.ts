import "server-only";

import type { EquipmentType } from "@/generated/prisma/enums";
import { polygonBounds } from "@/lib/campus-layout";
import { DEADLINE_TYPES, pragueToday, summarizeInspections } from "@/lib/inspection";
import { prisma } from "@/lib/prisma";
import type { TripItem } from "@/lib/revision-trip";
import { floorLocator, type WalkItem } from "@/lib/revision-walk";
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

/**
 * Fáze 116: podklad 🚶 pochůzkového režimu – položky Chytré revize doplněné o polohu v patře (místnost, osový kříž,
 * upřesnění místa, vchod), fotky zařízení a štítku, hodnoty z minulé revize a dnešní zápis.
 */
export async function getWalkItems(plantId: string, now: Date = new Date(), types: EquipmentType[] | null = null): Promise<WalkItem[]> {
  const [trip, details, floors] = await Promise.all([
    getTripItems(plantId, now, types),
    prisma.equipment.findMany({
      where: { floor: { building: { plantId } }, ...(types ? { type: { in: types } } : {}) },
      select: {
        id: true,
        pinX: true,
        pinY: true,
        assignedZone: true,
        locationNote: true,
        photoUrl: true,
        nameplatePhotoUrl: true,
        protectionClass: true,
        inspections: {
          where: { misuseFlaggedAt: null },
          orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
          take: 3,
          select: { inspectionDate: true, insulationResistance: true, protectiveConductorResistance: true, loopImpedanceOhm: true, inspectorName: true },
        },
      },
    }),
    prisma.floor.findMany({ where: { building: { plantId } }, select: { id: true, studioLayoutJson: true, floorplanSvg: true, viewBoxW: true, viewBoxH: true } }),
  ]);
  const byId = new Map(details.map((row) => [row.id, row]));
  const locators = new Map(floors.map((floor) => [floor.id, floorLocator(floor)]));
  const today = pragueToday(now);
  return trip.flatMap((item) => {
    const detail = byId.get(item.id);
    if (!detail) return [];
    const locator = locators.get(item.floorId);
    const where = locator ? locator.locate(detail.pinX, detail.pinY, detail.assignedZone) : { room: detail.assignedZone, gridRef: null };
    const measured = detail.inspections.find((record) => record.insulationResistance !== null || record.protectiveConductorResistance !== null || record.loopImpedanceOhm !== null) ?? null;
    const latest = detail.inspections[0] ?? null;
    return [
      {
        ...item,
        pinX: detail.pinX,
        pinY: detail.pinY,
        room: where.room,
        gridRef: where.gridRef,
        locationNote: detail.locationNote,
        photoUrl: detail.photoUrl,
        nameplatePhotoUrl: detail.nameplatePhotoUrl,
        protectionClass: detail.protectionClass,
        entrance: locator?.entrance ?? null,
        last: measured ? { date: measured.inspectionDate.toISOString(), riso: measured.insulationResistance, rpe: measured.protectiveConductorResistance, zs: measured.loopImpedanceOhm, inspector: measured.inspectorName } : null,
        inspectedToday: latest ? pragueToday(latest.inspectionDate) === today : false,
      },
    ];
  });
}
