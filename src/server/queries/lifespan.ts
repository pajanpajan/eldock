import "server-only";

import { cache } from "react";

import type { EquipmentType } from "@/generated/prisma/enums";
import { partKeyOf } from "@/lib/component-datasheets";
import type { CatalogPart } from "@/lib/datasheet-view";
import { prisma } from "@/lib/prisma";
import { equipmentLifespan, getPurchaseSettings, plantLifespanRows, plantPurchaseReport } from "@/server/services/lifespan-report";

// Fáze 116: tenké dotazy stránek nad službou životnosti (sdílený klient, deduplikace v rámci požadavku).

export const getEquipmentLifespan = cache((equipmentId: string, revisionId: string | null = null) => equipmentLifespan(prisma, equipmentId, { revisionId }));

export const getPlantLifespanRows = cache((plantId: string, types: readonly EquipmentType[] | null = null) => plantLifespanRows(prisma, plantId, new Date(), types));

export const getPurchaseReport = cache((plantId: string, horizonDays: number, types: readonly EquipmentType[] | null = null) => plantPurchaseReport(prisma, plantId, horizonDays, new Date(), types));

export const getPlantPurchaseSettings = cache((plantId: string) => getPurchaseSettings(prisma, plantId));

/**
 * Fáze 116: záznamy katalogu AI Panel Builderu pro objednací čísla z kusovníku (typ nebo objednací kód výrobce) –
 * technický list součástky a ztrátový výkon pro výpočet oteplení.
 */
export const getCatalogParts = cache(async (partNumbers: readonly (string | null)[]): Promise<Map<string, CatalogPart>> => {
  const wanted = [...new Set(partNumbers.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  if (!wanted.length) return new Map();
  const rows = await prisma.catalogComponent.findMany({
    where: { OR: [{ typeCode: { in: wanted } }, { articleNumber: { in: wanted } }] },
    select: { manufacturer: true, series: true, typeCode: true, articleNumber: true, ean: true, poles: true, ratedCurrentA: true, trippingCurve: true, breakingCapacityKa: true, powerLossWatts: true, widthMm: true, heightMm: true, depthMm: true, datasheetUrl: true, description: true, dataSource: true },
  });
  const map = new Map<string, CatalogPart>();
  for (const row of rows) {
    const part: CatalogPart = { ...row, dataSource: String(row.dataSource) };
    map.set(partKeyOf(row.typeCode), part);
    map.set(partKeyOf(row.articleNumber), part);
  }
  return map;
});
