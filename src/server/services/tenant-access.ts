// Fáze 67 / 70: oddělení firem – kolik záznamů ze vstupu leží v dostupných závodech. Sdílí serverové akce
// (`server/tenant.ts`, uživatel z cookie) i úpravy z aplikací (`services/sync.ts`, uživatel z tokenu zařízení).
// Aplikace navíc ověřují výřez kategorií účtu (`equipment`). Záměrně bez `server-only` (testy nad SQLite).

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

type Plant = Prisma.PlantWhereInput;
type EquipmentWhere = Prisma.EquipmentWhereInput;

export type EntityKind =
  | "equipment"
  | "changeRequest"
  | "revision"
  | "defect"
  | "temporaryMod"
  | "equipmentDocument"
  | "softwareBackup"
  | "monitoredComponent"
  | "schematicReference"
  | "floor"
  | "building"
  | "plant"
  // Fáze 108: záznam revize (podpis, PAdES, zneplatnění) a profil revizního technika závodu
  | "inspection"
  | "inspectorProfile";

/** Pole vstupu akcí → druh záznamu. */
export const FIELD_KINDS: Record<string, EntityKind> = {
  equipmentId: "equipment",
  equipmentIds: "equipment",
  linkedEquipmentId: "equipment",
  changeRequestId: "changeRequest",
  revisionId: "revision",
  defectId: "defect",
  documentId: "equipmentDocument",
  backupId: "softwareBackup",
  componentId: "monitoredComponent",
  floorId: "floor",
  buildingId: "building",
  plantId: "plant",
  inspectionId: "inspection",
  inspectorProfileId: "inspectorProfile",
};

const viaEquipment = (plant: Plant, equipment: EquipmentWhere) => ({ equipment: { ...equipment, floor: { building: { plant } } } });

/** Počet záznamů s danými id, které leží v dostupných závodech (a u zařízení ve výřezu `equipment`). */
export function countAccessible(prisma: PrismaClient, kind: EntityKind, ids: string[], plant: Plant, equipment: EquipmentWhere = {}): Promise<number> {
  const id = { in: ids };
  switch (kind) {
    case "equipment":
      return prisma.equipment.count({ where: { id, ...equipment, floor: { building: { plant } } } });
    case "changeRequest":
      return prisma.changeRequest.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "revision":
      return prisma.documentRevision.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "defect":
      return prisma.inspectionDefect.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "temporaryMod":
      return prisma.temporaryModification.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "equipmentDocument":
      return prisma.equipmentDocument.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "softwareBackup":
      return prisma.softwareBackup.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "monitoredComponent":
      return prisma.monitoredComponent.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "schematicReference":
      return prisma.schematicReference.count({ where: { id, revision: viaEquipment(plant, equipment) } });
    case "floor":
      return prisma.floor.count({ where: { id, building: { plant } } });
    case "building":
      return prisma.building.count({ where: { id, plant } });
    case "plant":
      return prisma.plant.count({ where: { AND: [{ id }, plant] } });
    case "inspection":
      return prisma.inspectionRecord.count({ where: { id, ...viaEquipment(plant, equipment) } });
    case "inspectorProfile":
      return prisma.inspectorProfile.count({ where: { id, plant } });
  }
}

export const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string" && item.length > 0);

/** Ověří záznamy jednoho druhu (prázdný výběr projde). Cizí nebo neexistující = „nenalezeno“ (nic se neprozradí). */
export async function assertAccessible(prisma: PrismaClient, kind: EntityKind, value: unknown, plant: Plant, equipment: EquipmentWhere = {}) {
  const ids = [...new Set(idsOf(value))];
  if (!ids.length) return;
  if ((await countAccessible(prisma, kind, ids, plant, equipment)) !== ids.length) throw new WorkflowError("NOT_FOUND", "Záznam nebyl nalezen.");
}
