import "server-only";

import { DEADLINE_TYPES, compareByUrgency, needsAttention, pragueToday, summarizeInspections, type InspectionSummary } from "@/lib/inspection";
import type { PlannerItem } from "@/lib/inspection-planner";
import { PORTABLE_TYPES } from "@/lib/inspection-rules";
import { prisma } from "@/lib/prisma";

export interface InspectionWatchItem {
  id: string;
  tag: string;
  name: string;
  location: string;
  plantName: string;
  summary: InspectionSummary;
  defectsSummary: string | null;
}

/**
 * Hlídač elektrorevizí: zařízení s propadlou nebo brzy končící revizí, seřazená podle
 * naléhavosti. Bez `plantId` napříč všemi závody (CAE přehled).
 */
export async function getInspectionWatch(plantId?: string, now: Date = new Date()) {
  const equipment = await prisma.equipment.findMany({
    where: plantId ? { floor: { building: { plantId } } } : undefined,
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] } },
        orderBy: { inspectionDate: "desc" },
        select: { type: true, inspectionDate: true, validUntil: true, result: true, defectsSummary: true },
      },
    },
  });

  const items: InspectionWatchItem[] = equipment
    .map(({ id, tag, name, floor, inspections }) => ({
      id,
      tag,
      name,
      location: `${floor.building.name} › ${floor.name}`,
      plantName: floor.building.plant.name,
      summary: summarizeInspections(inspections, now),
      defectsSummary: inspections[0]?.defectsSummary ?? null,
    }))
    .filter((item) => needsAttention(item.summary.state))
    .sort((a, b) => compareByUrgency(a.summary, b.summary));

  return {
    items,
    total: equipment.length,
    expired: items.filter((item) => item.summary.state === "EXPIRED" || item.summary.state === "FAILED").length,
    expiring: items.filter((item) => item.summary.state === "EXPIRING").length,
  };
}

export type InspectionWatch = Awaited<ReturnType<typeof getInspectionWatch>>;

/** Přehled revizí (`/inspections`): všechna zařízení závodu se stavem lhůty – podklad pro hromadnou revizi. */
export async function getInspectionOverview(plantId?: string, now: Date = new Date()) {
  const equipment = await prisma.equipment.findMany({
    where: plantId ? { floor: { building: { plantId } } } : undefined,
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      usageGroup: true,
      protectionClass: true,
      externalInfluences: true,
      inspectionIntervalMonths: true,
      assignedZone: true,
      floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] } },
        select: { type: true, inspectionDate: true, validUntil: true, result: true },
      },
    },
  });
  return equipment
    .map(({ floor, inspections, ...item }) => ({
      ...item,
      location: `${floor.building.name} › ${floor.name}`,
      plantName: floor.building.plant.name,
      summary: summarizeInspections(inspections, now),
    }))
    .sort((a, b) => compareByUrgency(a.summary, b.summary) || a.tag.localeCompare(b.tag));
}

export type InspectionOverviewItem = Awaited<ReturnType<typeof getInspectionOverview>>[number];

/** Rychlá revize (`/inspections/rapid`): přenosné spotřebiče a nářadí s místností, stavem a posledním měřením. */
export async function getRapidQueue(plantId?: string, now: Date = new Date()) {
  const today = pragueToday(now);
  const equipment = await prisma.equipment.findMany({
    where: { type: { in: [...PORTABLE_TYPES] }, ...(plantId ? { floor: { building: { plantId } } } : {}) },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      usageGroup: true,
      protectionClass: true,
      inventoryNumber: true,
      assignedZone: true,
      inspectionIntervalMonths: true,
      manufacturer: true,
      model: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] } },
        orderBy: { inspectionDate: "desc" },
        select: {
          type: true,
          inspectionDate: true,
          validUntil: true,
          result: true,
          protectiveConductorResistance: true,
          insulationResistance: true,
        },
      },
    },
  });
  return equipment.map(({ floor, inspections, ...item }) => ({
    ...item,
    zone: item.assignedZone ?? `${floor.building.name} › ${floor.name}`,
    summary: summarizeInspections(inspections, now),
    inspectedToday: inspections.some((record) => pragueToday(record.inspectionDate) === today),
    last: inspections[0]
      ? { rpe: inspections[0].protectiveConductorResistance, riso: inspections[0].insulationResistance, date: inspections[0].inspectionDate }
      : null,
  }));
}

export type RapidItem = Awaited<ReturnType<typeof getRapidQueue>>[number];

/** Plánovač revizí (`/inspections/planner`): všechna zařízení s místem pro řazení pochůzky. */
export async function getPlannerItems(plantId?: string, now: Date = new Date()): Promise<PlannerItem[]> {
  const equipment = await prisma.equipment.findMany({
    where: plantId ? { floor: { building: { plantId } } } : undefined,
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      assignedZone: true,
      floor: {
        select: {
          code: true,
          level: true,
          name: true,
          building: { select: { name: true, sortOrder: true, plant: { select: { code: true } } } },
        },
      },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] } },
        select: { type: true, inspectionDate: true, validUntil: true, result: true },
      },
    },
  });
  return equipment.map(({ floor, inspections, ...item }) => {
    const summary = summarizeInspections(inspections, now);
    return {
      id: item.id,
      tag: item.tag,
      name: item.name,
      type: item.type,
      // Bez filtru závodu (CAE) se budovy řadí i podle závodu.
      buildingName: plantId ? floor.building.name : `${floor.building.plant.code} · ${floor.building.name}`,
      buildingOrder: floor.building.sortOrder,
      floorCode: floor.code,
      floorLevel: floor.level,
      floorName: floor.name,
      zone: item.assignedZone,
      state: summary.state,
      daysLeft: summary.daysLeft,
      validUntil: summary.validUntil,
    };
  });
}
