import "server-only";

import { DEADLINE_TYPES, compareByUrgency, governingInspection, needsAttention, pragueToday, summarizeInspections, type InspectionSummary } from "@/lib/inspection";
import type { PlannerItem } from "@/lib/inspection-planner";
import { PORTABLE_TYPES } from "@/lib/inspection-rules";
import type { EquipmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Výřez závodu a typů zařízení (účet) pro `equipment`. */
const plantScope = (plantId?: string) => (plantId ? { floor: { building: { plantId } } } : {});
const typeScope = (types: EquipmentType[] | null) => (types ? { type: { in: types } } : {});

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
export async function getInspectionWatch(plantId?: string, now: Date = new Date(), types: EquipmentType[] | null = null) {
  const equipment = await prisma.equipment.findMany({
    where: { ...plantScope(plantId), ...typeScope(types) },
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
export async function getInspectionOverview(plantId?: string, now: Date = new Date(), types: EquipmentType[] | null = null) {
  const equipment = await prisma.equipment.findMany({
    where: { ...plantScope(plantId), ...typeScope(types) },
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
        select: { id: true, type: true, inspectionDate: true, validUntil: true, result: true },
      },
    },
  });
  return equipment
    .map(({ floor, inspections, ...item }) => ({
      ...item,
      location: `${floor.building.name} › ${floor.name}`,
      plantName: floor.building.plant.name,
      summary: summarizeInspections(inspections, now),
      /** Rozhodující revize → revizní protokol k tisku. */
      reportId: governingInspection(inspections)?.id ?? null,
    }))
    .sort((a, b) => compareByUrgency(a.summary, b.summary) || a.tag.localeCompare(b.tag));
}

export type InspectionOverviewItem = Awaited<ReturnType<typeof getInspectionOverview>>[number];

/** Rychlá revize (`/inspections/rapid`): přenosné spotřebiče a nářadí s místností, stavem a posledním měřením. */
export async function getRapidQueue(plantId?: string, now: Date = new Date(), types: EquipmentType[] | null = null) {
  const today = pragueToday(now);
  const portable = PORTABLE_TYPES.filter((type) => !types || types.includes(type));
  const equipment = await prisma.equipment.findMany({
    where: { type: { in: portable }, ...plantScope(plantId) },
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
export async function getPlannerItems(plantId?: string, now: Date = new Date(), types: EquipmentType[] | null = null): Promise<PlannerItem[]> {
  const equipment = await prisma.equipment.findMany({
    where: { ...plantScope(plantId), ...typeScope(types) },
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

/** Auditní report / Kniha revizí: všechna zařízení s poslední revizí, otevřené závady a aktivní provizoria. */
export async function getAuditReport(plantId?: string, now: Date = new Date(), types: EquipmentType[] | null = null) {
  const scope = { ...plantScope(plantId), ...typeScope(types) };
  const [equipment, defects, mods] = await Promise.all([
    prisma.equipment.findMany({
      where: scope,
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
        floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } },
        inspections: {
          where: { type: { in: [...DEADLINE_TYPES] } },
          orderBy: { inspectionDate: "desc" },
          select: { type: true, inspectionDate: true, validUntil: true, result: true, reportNumber: true, inspectorName: true },
        },
      },
    }),
    prisma.inspectionDefect.findMany({
      where: { status: "OPEN", equipment: scope },
      orderBy: { deadline: "asc" },
      include: { equipment: { select: { id: true, tag: true, name: true } }, inspection: { select: { reportNumber: true, inspectionDate: true } } },
    }),
    prisma.temporaryModification.findMany({
      where: { status: "ACTIVE", equipment: scope },
      orderBy: { expiresAt: "asc" },
      include: { equipment: { select: { id: true, tag: true, name: true, floor: { select: { name: true, building: { select: { name: true } } } } } } },
    }),
  ]);

  const rows = equipment.map(({ floor, inspections, ...item }) => {
    const summary = summarizeInspections(inspections, now);
    const last = inspections[0] ?? null;
    return {
      ...item,
      location: `${plantId ? "" : `${floor.building.plant.name} › `}${floor.building.name} › ${floor.name}`,
      summary,
      last: last ? { inspectionDate: last.inspectionDate, reportNumber: last.reportNumber, inspectorName: last.inspectorName, result: last.result } : null,
    };
  });
  return { rows, defects, mods };
}

export type AuditReport = Awaited<ReturnType<typeof getAuditReport>>;

/** Revizní protokol k tisku (`/inspections/report/[id]`): záznam, zařízení, umístění a závady. */
export async function getInspectionProtocol(recordId: string) {
  return prisma.inspectionRecord.findUnique({
    where: { id: recordId },
    include: {
      defects: { orderBy: { createdAt: "asc" }, select: { id: true, description: true, severity: true, deadline: true, status: true } },
      equipment: {
        select: {
          id: true,
          tag: true,
          name: true,
          type: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          inventoryNumber: true,
          yearInstalled: true,
          ratedVoltage: true,
          ratedCurrent: true,
          ipRating: true,
          usageGroup: true,
          protectionClass: true,
          externalInfluences: true,
          assignedZone: true,
          floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true, code: true, customerName: true, address: true, city: true } } } } } },
        },
      },
    },
  });
}

export type InspectionProtocolData = NonNullable<Awaited<ReturnType<typeof getInspectionProtocol>>>;

/** Patra všech závodů pro přiřazení lokality při importu (Závod → Budova → Patro). */
export async function getImportFloors() {
  const floors = await prisma.floor.findMany({
    orderBy: [{ building: { plant: { code: "asc" } } }, { building: { sortOrder: "asc" } }, { level: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
      building: { select: { name: true, code: true, shortName: true, plant: { select: { id: true, name: true } } } },
    },
  });
  return floors.map((floor) => ({
    id: floor.id,
    plantId: floor.building.plant.id,
    plantName: floor.building.plant.name,
    buildingName: floor.building.name,
    buildingCode: floor.building.code,
    buildingShortName: floor.building.shortName,
    floorName: floor.name,
    floorCode: floor.code,
    level: floor.level,
  }));
}

export type ImportFloor = Awaited<ReturnType<typeof getImportFloors>>[number];
