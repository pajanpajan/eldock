// Fáze 95: import BIM modelu (IFC) do Správy závodů. Režim CREATE: nová budova s podlažími, místnostmi a zařízeními
// (koncept Studia výstavby) a údaji z BIMu (In, U, IP, příkon, přívodní kabel s délkou, zálohování, kapacita zdroje, QR
// kód) v jedné transakci. Režim UPDATE: stávající zařízení závodu podle GlobalId / označení z BIMu dostanou parametry
// z modelu – dokumentace, PDF schémata, revize a Červenky zůstanou. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import type { BimPlantPayload } from "@/lib/bim/bim-payload";
import { bimToPlantPlan, type BimEquipmentDetails } from "@/lib/bim/bim-plant";
import { hasBackupTier } from "@/lib/power-backup";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { saveStudioConceptInTx } from "./studio";

export type BimImportMode = "CREATE" | "UPDATE";

export interface BimImportResult {
  mode: BimImportMode;
  plantId: string;
  buildingId: string | null;
  buildingCode: string | null;
  firstFloorId: string | null;
  /** Nová / aktualizovaná zařízení (rozváděče s tlačítkem do AI Panel Builderu). */
  equipment: { id: string; tag: string; type: string; name: string; feeds: number }[];
  notFound: string[];
  notes: string[];
}

/** Sloupce zařízení z údajů BIMu (prázdný údaj nic nepřepíše). */
function detailData(details: BimEquipmentDetails, type: string, update: boolean) {
  return {
    ...(details.bimGuid ? { bimGuid: details.bimGuid } : {}),
    ...(details.ratedCurrent ? { ratedCurrent: details.ratedCurrent } : {}),
    ...(details.ratedVoltage ? { ratedVoltage: details.ratedVoltage } : {}),
    ...(details.ipRating ? { ipRating: details.ipRating } : {}),
    ...(details.ratedPowerKw !== null ? { ratedPowerKw: details.ratedPowerKw } : {}),
    ...(details.nominalCurrentA !== null ? { nominalCurrentA: details.nominalCurrentA } : {}),
    ...(details.feederCableType ? { feederCableType: details.feederCableType } : {}),
    ...(details.feederLengthM !== null ? { feederLengthM: details.feederLengthM } : {}),
    ...(details.backupCapacityKva !== null && hasBackupTier(type as never) ? { backupCapacityKva: details.backupCapacityKva } : {}),
    // Popis se při aktualizaci nepřepisuje (uživatelská poznámka zůstane)
    ...(update ? {} : { description: details.description }),
  };
}

export async function importBimToPlant(prisma: PrismaClient, plantId: string, payload: BimPlantPayload, mode: BimImportMode): Promise<BimImportResult> {
  const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, campusWidthM: true, campusDepthM: true, buildings: { select: { code: true, mapPolygon: true } } } });
  if (!plant) throw new WorkflowError("NOT_FOUND", "Závod nebyl nalezen.");
  if (!payload.electrical.length && !payload.spaces.length) throw new WorkflowError("VALIDATION", "BIM model neobsahuje místnosti ani elektro prvky – není co importovat.");
  const plan = bimToPlantPlan(payload, {
    plantId: plant.id,
    campus: { widthM: plant.campusWidthM, depthM: plant.campusDepthM },
    existingCodes: plant.buildings.map((building) => building.code),
    existingPolygons: plant.buildings.map((building) => building.mapPolygon),
  });
  const [concept] = plan.concept.buildings;

  if (mode === "UPDATE") {
    const rows = await prisma.equipment.findMany({ where: { floor: { building: { plantId: plant.id } } }, select: { id: true, tag: true, type: true, name: true, bimGuid: true, _count: { select: { feeds: true } } } });
    const byGuid = new Map(rows.filter((row) => row.bimGuid).map((row) => [row.bimGuid!, row]));
    const byTag = new Map<string, (typeof rows)[number][]>();
    for (const row of rows) byTag.set(row.tag.toUpperCase(), [...(byTag.get(row.tag.toUpperCase()) ?? []), row]);
    const equipment: BimImportResult["equipment"] = [];
    const notFound: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const item of concept.equipment) {
        const details = plan.details[item.key];
        const sameTag = byTag.get(item.tag.toUpperCase()) ?? [];
        const row = (details?.bimGuid ? byGuid.get(details.bimGuid) : undefined) ?? (sameTag.length === 1 ? sameTag[0] : undefined);
        if (!row || !details) {
          notFound.push(sameTag.length > 1 ? `${item.tag} (v závodě ${sameTag.length}× – upřesněte GlobalId)` : item.tag);
          continue;
        }
        await tx.equipment.update({ where: { id: row.id }, data: { ...detailData(details, row.type, true), ...(item.powerBackupTier && hasBackupTier(row.type) ? { powerBackupTier: item.powerBackupTier } : {}) } });
        equipment.push({ id: row.id, tag: row.tag, type: row.type, name: row.name, feeds: row._count.feeds });
      }
    });
    return { mode, plantId: plant.id, buildingId: null, buildingCode: null, firstFloorId: null, equipment, notFound, notes: equipment.length ? [] : ["V závodě není žádné zařízení s označením z BIM modelu – použijte režim vytvoření."] };
  }

  return prisma.$transaction(
    async (tx) => {
      const [saved] = await saveStudioConceptInTx(tx, plan.concept);
      const equipment: BimImportResult["equipment"] = [];
      for (const item of concept.equipment) {
        const id = saved.equipmentIds[item.key];
        const details = plan.details[item.key];
        if (!id) continue;
        if (details) await tx.equipment.update({ where: { id }, data: detailData(details, item.type, false) });
        equipment.push({ id, tag: item.tag, type: item.type, name: item.name, feeds: concept.equipment.filter((child) => child.parent?.kind === "draft" && child.parent.key === item.key).length });
      }
      return { mode, plantId: saved.plantId, buildingId: saved.buildingId, buildingCode: plan.buildingCode, firstFloorId: saved.firstFloorId, equipment, notFound: [], notes: plan.skipped };
    },
    { timeout: 120_000 },
  );
}
