import "server-only";

import type { ChangeRequestStatus, EquipmentStatus, EquipmentType, SafetyImpactLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { equipmentGroupOf, type EquipmentGroup } from "@/lib/plant-phases";

/** Otevřené změny – technik nahlásil, CAE na nich pracuje, nebo čekají na schválení nové revize. */
const OPEN_CHANGES: ChangeRequestStatus[] = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"];

export interface PlantAgendaRow {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  group: EquipmentGroup;
  status: EquipmentStatus;
  location: string;
  manufacturer: string | null;
  model: string | null;
  /** Fyzický QR štítek už vygenerovaný. */
  hasQr: boolean;
  /** Platné schéma (aktivní revize). */
  drawing: { version: string; title: string; sheets: number } | null;
  /** Otevřené změny (Červenka = změna s červeným zákresem ve schématu). */
  changes: { id: string; number: string; status: ChangeRequestStatus; redline: boolean; safetyImpact: SafetyImpactLevel }[];
  /** Aktivní zálohy řídicího SW (PLC, měniče). */
  backups: { id: string; targetUnit: string; platform: string; version: string; safety: boolean; createdAt: Date }[];
}

/**
 * Fáze 98: agenda závodu pro přepínač fází ELDOCK Průmysl – zařízení s umístěním, platným schématem, otevřenými změnami
 * (červené zákresy) a aktivními zálohami SW; výřez typů zařízení podle účtu (revizní technik jen spotřebiče …).
 */
export async function getPlantAgenda(plantId: string, types: EquipmentType[] | null = null): Promise<PlantAgendaRow[]> {
  const rows = await prisma.equipment.findMany({
    where: { floor: { building: { plantId } }, ...(types ? { type: { in: types } } : {}) },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      status: true,
      manufacturer: true,
      model: true,
      qrToken: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
      revisions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1, select: { version: true, title: true, sheetCount: true } },
      changeRequests: { where: { status: { in: OPEN_CHANGES } }, orderBy: { submittedAt: "desc" }, select: { id: true, number: true, status: true, markupImageUrl: true, markupData: true, safetyImpact: true } },
      softwareBackups: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true, targetUnit: true, platform: true, major: true, minor: true, isSafetyRelated: true, createdAt: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    name: row.name,
    type: row.type,
    group: equipmentGroupOf(row.type),
    status: row.status,
    location: `${row.floor.building.name} › ${row.floor.name}`,
    manufacturer: row.manufacturer,
    model: row.model,
    hasQr: Boolean(row.qrToken),
    drawing: row.revisions[0] ? { version: row.revisions[0].version, title: row.revisions[0].title, sheets: row.revisions[0].sheetCount } : null,
    changes: row.changeRequests.map((change) => ({ id: change.id, number: change.number, status: change.status, redline: Boolean(change.markupImageUrl || change.markupData), safetyImpact: change.safetyImpact })),
    backups: row.softwareBackups.map((backup) => ({ id: backup.id, targetUnit: backup.targetUnit, platform: backup.platform, version: `v${backup.major}.${backup.minor}`, safety: backup.isSafetyRelated, createdAt: backup.createdAt })),
  }));
}
