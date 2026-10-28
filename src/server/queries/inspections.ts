import "server-only";

import { DEADLINE_TYPES, compareByUrgency, summarizeInspections, type InspectionSummary } from "@/lib/inspection";
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
    .filter((item) => item.summary.state === "EXPIRED" || item.summary.state === "EXPIRING")
    .sort((a, b) => compareByUrgency(a.summary, b.summary));

  return {
    items,
    total: equipment.length,
    expired: items.filter((item) => item.summary.state === "EXPIRED").length,
    expiring: items.filter((item) => item.summary.state === "EXPIRING").length,
  };
}

export type InspectionWatch = Awaited<ReturnType<typeof getInspectionWatch>>;
