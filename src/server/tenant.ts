import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { plantAccessWhere } from "@/server/queries/plant";

// Fáze 67: oddělení firem v serverových akcích. Akce nad daty závodu ověří, že záznamy ze vstupu patří do závodu
// přihlášeného uživatele (registrovaná firma jen svůj závod, obchodní demo jen demo závody) – stránky to hlídají už
// přes `plantAccessWhere`, akce dosud ne. Cizí nebo neexistující záznam = „nenalezeno“ (nic se neprozradí).

type Plant = Prisma.PlantWhereInput;
type EntityKind =
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
  | "plant";

const viaEquipment = (plant: Plant) => ({ equipment: { floor: { building: { plant } } } });

/** Počet záznamů s danými id, které leží v dostupných závodech. */
const COUNTERS: Record<EntityKind, (ids: string[], plant: Plant) => Promise<number>> = {
  equipment: (ids, plant) => prisma.equipment.count({ where: { id: { in: ids }, floor: { building: { plant } } } }),
  changeRequest: (ids, plant) => prisma.changeRequest.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  revision: (ids, plant) => prisma.documentRevision.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  defect: (ids, plant) => prisma.inspectionDefect.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  temporaryMod: (ids, plant) => prisma.temporaryModification.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  equipmentDocument: (ids, plant) => prisma.equipmentDocument.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  softwareBackup: (ids, plant) => prisma.softwareBackup.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  monitoredComponent: (ids, plant) => prisma.monitoredComponent.count({ where: { id: { in: ids }, ...viaEquipment(plant) } }),
  schematicReference: (ids, plant) => prisma.schematicReference.count({ where: { id: { in: ids }, revision: viaEquipment(plant) } }),
  floor: (ids, plant) => prisma.floor.count({ where: { id: { in: ids }, building: { plant } } }),
  building: (ids, plant) => prisma.building.count({ where: { id: { in: ids }, plant } }),
  plant: (ids, plant) => prisma.plant.count({ where: { AND: [{ id: { in: ids } }, plant] } }),
};

/** Pole vstupu akcí → druh záznamu. */
const FIELD_KINDS: Record<string, EntityKind> = {
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
};

const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === "string" && item.length > 0);

/** Ověří záznamy jednoho druhu (prázdný výběr projde). */
export async function assertEntityAccess(kind: EntityKind, value: unknown, plant?: Plant) {
  const ids = [...new Set(idsOf(value))];
  if (!ids.length) return;
  if ((await COUNTERS[kind](ids, plant ?? (await plantAccessWhere()))) !== ids.length) throw new WorkflowError("NOT_FOUND", "Záznam nebyl nalezen.");
}

/**
 * Ověří všechna známá pole vstupu akce (`equipmentId`, `changeRequestId`, `defectId` …). Obecné pole `id` jen když
 * akce řekne, čeho je (`{ id: "temporaryMod" }`).
 */
export async function assertTenantAccess(input: unknown, options: { id?: EntityKind } = {}) {
  if (!input || typeof input !== "object") return;
  const record = input as Record<string, unknown>;
  const plant = await plantAccessWhere();
  for (const [field, kind] of Object.entries(FIELD_KINDS)) if (field in record) await assertEntityAccess(kind, record[field], plant);
  if (options.id && "id" in record) await assertEntityAccess(options.id, record.id, plant);
}
