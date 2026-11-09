// Fáze 71: odvozené stavy zařízení z dat v zařízení (platnost revize, otevřené závady, provizoria) – stejné
// funkce jako web (src/lib/inspection.ts, defects.ts, temporary-mod.ts).

import { defectState } from "@/lib/defects";
import { inspectionStateFor, type InspectionState } from "@/lib/inspection";
import { tempModCountdown } from "@/lib/temporary-mod";
import type { EquipmentRecord, InspectionDefectRecord, InspectionRecordRecord, TemporaryModificationRecord } from "@/sync-client";

export interface EquipmentFlags {
  inspection: InspectionState;
  openDefects: number;
  overdueDefects: number;
  activeMods: number;
  overdueMods: number;
}

/** Poslední revize podle data (platnost určuje stav). */
export function latestInspection(records: InspectionRecordRecord[]): InspectionRecordRecord | null {
  return records.reduce<InspectionRecordRecord | null>((latest, record) => (!latest || record.inspectionDate > latest.inspectionDate ? record : latest), null);
}

export function equipmentFlags(inspections: InspectionRecordRecord[], defects: InspectionDefectRecord[], mods: TemporaryModificationRecord[], now = new Date()): EquipmentFlags {
  const latest = latestInspection(inspections);
  const open = defects.filter((defect) => defect.status !== "RESOLVED");
  const active = mods.filter((mod) => mod.status === "ACTIVE");
  return {
    inspection: inspectionStateFor(latest ? new Date(latest.validUntil) : null, now),
    openDefects: open.length,
    overdueDefects: open.filter((defect) => defectState({ status: defect.status, deadline: new Date(defect.deadline) }, now).state === "OVERDUE").length,
    activeMods: active.length,
    overdueMods: active.filter((mod) => tempModCountdown(new Date(mod.expiresAt), now).overdue).length,
  };
}

/** Vyžaduje pozornost údržby (závada nebo provizorium po termínu, propadlá či nevyhovující revize). */
export const needsAttention = (flags: EquipmentFlags) => flags.overdueDefects > 0 || flags.overdueMods > 0 || flags.inspection === "EXPIRED" || flags.inspection === "FAILED";

/** Skupiny záznamů podle zařízení. */
export function byEquipment<T extends { equipmentId: string }>(records: T[] | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records ?? []) map.set(record.equipmentId, [...(map.get(record.equipmentId) ?? []), record]);
  return map;
}

/** Text pro vyhledávání bez diakritiky a velikosti písmen. */
export const searchKey = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const equipmentSearchText = (equipment: EquipmentRecord) => searchKey([equipment.tag, equipment.name, equipment.manufacturer, equipment.model, equipment.serialNumber, equipment.inventoryNumber, equipment.assignedZone].filter(Boolean).join(" "));
