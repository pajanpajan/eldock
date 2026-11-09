// Fáze 72: výřez dat pro zařízení v hale – stejná pravidla jako cloud (`readChanges`): záznam patří závodu a zařízení
// podle rodičů (budova → patro → zařízení → potomci), účet vidí jen své závody a kategorie zařízení (`visibleTypes`).

import type { PlantUserAccess } from "@/sync-client";

import type { PlantStore } from "./store";

type Row = Record<string, unknown>;

export interface RecordScope {
  /** `null` = celofiremní záznam (uživatelé firmy). */
  plantId: string | null;
  equipmentType: string | null;
}

const EQUIPMENT_CHILD = new Set(["ComplianceDocument", "InspectionRecord", "InspectionDefect", "DocumentRevision", "ChangeRequest", "TemporaryModification", "EquipmentDocument", "SoftwareBackup", "MonitoredComponent"]);
const str = (value: unknown) => (typeof value === "string" ? value : null);

/** Vyhodnocení výřezu s mezipamětí pro jeden požadavek (rodiče se čtou z platných dat). */
export function scopeResolver(store: PlantStore) {
  const cache = new Map<string, RecordScope | null>();
  const record = (entity: string, id: string | null) => (id ? store.effective(entity, id) : null);

  const resolve = (entity: string, id: string, data?: Row | null): RecordScope | null => {
    const key = `${entity}:${id}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const row = data === undefined ? store.effective(entity, id) : data;
    let scope: RecordScope | null = null;
    if (row) {
      if (entity === "User") scope = { plantId: null, equipmentType: null };
      else if (entity === "Plant") scope = { plantId: id, equipmentType: null };
      else if (entity === "Building") scope = str(row.plantId) ? { plantId: str(row.plantId), equipmentType: null } : null;
      else if (entity === "Floor") scope = parentScope("Building", str(row.buildingId));
      else if (entity === "Equipment") {
        const floor = parentScope("Floor", str(row.floorId));
        scope = floor ? { plantId: floor.plantId, equipmentType: str(row.type) } : null;
      } else if (EQUIPMENT_CHILD.has(entity)) scope = parentScope("Equipment", str(row.equipmentId));
      else if (entity === "BomItem" || entity === "SchematicReference") scope = parentScope("DocumentRevision", str(row.revisionId));
      else if (entity === "Attachment" || entity === "ChangeRequestEvent") scope = parentScope("ChangeRequest", str(row.changeRequestId));
    }
    cache.set(key, scope);
    return scope;
  };

  const parentScope = (entity: string, id: string | null): RecordScope | null => (id ? resolve(entity, id, record(entity, id)) : null);

  return resolve;
}

/** Smí účet záznam vidět? */
export function visibleFor(user: PlantUserAccess, scope: RecordScope | null): boolean {
  if (!scope) return false;
  if (scope.plantId === null) return true;
  if (!user.plantIds.includes(scope.plantId)) return false;
  return !scope.equipmentType || !user.visibleTypes || user.visibleTypes.includes(scope.equipmentType);
}

/** Adresy souborů v záznamu (`/api/files/…`). */
export function fileUrlsIn(data: Row): string[] {
  const urls = new Set<string>();
  for (const value of Object.values(data)) if (typeof value === "string" && value.startsWith("/api/files/")) urls.add(value.split("?")[0] ?? value);
  return [...urls];
}
