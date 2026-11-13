"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { parseRooms, type HlidacMode } from "@/lib/hlidac";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { addHlidacDevice, createHlidacBuilding, setHlidacMode } from "@/server/services/hlidac";
import { equipmentLabelSerial } from "@/server/services/qr-labels";
import { idLabelData, titleWithoutTag, type IdLabelData } from "@/lib/equipment-id-label";
import { summarizeInspections, type InspectionSummary } from "@/lib/inspection";
import { parseReading, type NameplateReading } from "@/lib/nameplate";
import type { EquipmentType } from "@/generated/prisma/enums";
import { getCurrentAccount, getCurrentUser } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 111: 🛡️ Hlídač revizí – režim objektu, rychlé nakreslení budovy s patry a místnostmi a spotřebič na 1 klik.

const id = z.string().min(1).max(64);
const mode = z.enum(["OFFICE", "FACTORY"]);
const PATH = "/hlidac-revizi";

async function assertEditor(structure = false) {
  const account = await getCurrentAccount();
  const allowed = structure ? account.can("studio") || account.can("recordInspection") : account.can("studio") || account.can("recordInspection") || account.can("submitChange");
  if (!allowed) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.studio} nebo ${PERMISSION_LABELS.recordInspection}.`);
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

/** Režim objektu: 🏢 administrativa / kanceláře / škola / klinika vs. 🏭 výrobní závod / dílna / sklad. */
export async function setHlidacModeAction(plantId: string, value: HlidacMode): Promise<ActionResult<{ mode: HlidacMode }>> {
  if (!id.safeParse(plantId).success || !mode.safeParse(value).success) return { ok: false, error: "Neplatný režim." };
  try {
    await assertTenantAccess({ plantId });
    const user = await getCurrentUser();
    await setHlidacMode(prisma, plantId, value, user.id);
    revalidatePath(PATH);
    return { ok: true, data: { mode: value } };
  } catch (error) {
    return failure(error, "Režim se nepodařilo uložit.");
  }
}

const buildingSchema = z.object({
  plantId: id,
  mode,
  name: z.string().trim().min(3, "Zadejte název budovy (aspoň 3 znaky).").max(80),
  floors: z.array(z.object({ usage: z.string().trim().max(40), rooms: z.string().max(2000) })).min(1).max(10),
});

/** Nová budova s patry a místnostmi (názvy místností oddělené čárkou nebo řádkem). */
export async function createHlidacBuildingAction(input: z.input<typeof buildingSchema>): Promise<ActionResult<{ buildingId: string; code: string; floors: number }>> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte budovu, patra a místnosti." };
  try {
    await assertEditor(true);
    await assertTenantAccess({ plantId: parsed.data.plantId });
    const result = await createHlidacBuilding(prisma, { ...parsed.data, floors: parsed.data.floors.map((floor) => ({ usage: floor.usage, rooms: parseRooms(floor.rooms) })) });
    revalidatePath(PATH);
    revalidatePath(`/plant/${parsed.data.plantId}`);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Budovu se nepodařilo založit.");
  }
}

const deviceSchema = z.object({ floorId: id, room: z.string().min(1).max(64), itemId: z.string().min(1).max(32), mode });

/** Spotřebič z palety do místnosti na 1 klik. */
export async function addHlidacDeviceAction(input: z.input<typeof deviceSchema>): Promise<ActionResult<{ id: string; tag: string; name: string; inspectionIntervalMonths: number }>> {
  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatný spotřebič." };
  try {
    await assertEditor();
    await assertTenantAccess({ floorId: parsed.data.floorId });
    const created = await addHlidacDevice(prisma, parsed.data);
    revalidatePath(PATH);
    return { ok: true, data: created };
  } catch (error) {
    return failure(error, "Spotřebič se nepodařilo přidat.");
  }
}

export interface DeviceSlots {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  location: string;
  photoUrl: string | null;
  nameplatePhotoUrl: string | null;
  readAt: string | null;
  reading: NameplateReading | null;
  inspection: InspectionSummary;
  current: { title: string; manufacturer: string | null; model: string | null; serialNumber: string | null; ratedVoltage: string | null; ipRating: string | null; protectionClass: string | null; usageGroup: string | null; handHeld: boolean };
  label: IdLabelData;
  canEdit: boolean;
}

/** Detail zařízení pro dialog (Hlídač revizí, podlaží, Rychlá revize): 2 fotografické sloty a identifikační štítek. */
export async function getDeviceSlotsAction(equipmentId: string): Promise<ActionResult<DeviceSlots>> {
  if (!id.safeParse(equipmentId).success) return { ok: false, error: "Zařízení nebylo nalezeno." };
  try {
    await assertTenantAccess({ equipmentId });
    const account = await getCurrentAccount();
    const row = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: {
        id: true, tag: true, name: true, type: true, photoUrl: true, nameplatePhotoUrl: true, nameplateReadAt: true, nameplateDataJson: true,
        manufacturer: true, model: true, serialNumber: true, ratedVoltage: true, ipRating: true, protectionClass: true, usageGroup: true, handHeld: true, assignedZone: true,
        floor: { select: { name: true, building: { select: { name: true } } } },
        inspections: { where: { misuseFlaggedAt: null }, select: { type: true, inspectionDate: true, validUntil: true, result: true } },
      },
    });
    if (!row || !account.canSee(row.type)) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
    const inspection = summarizeInspections(row.inspections);
    const serial = await equipmentLabelSerial(prisma, row.id);
    return {
      ok: true,
      data: {
        id: row.id,
        tag: row.tag,
        name: row.name,
        type: row.type,
        location: [row.assignedZone, row.floor.name, row.floor.building.name].filter(Boolean).join(" · "),
        photoUrl: row.photoUrl,
        nameplatePhotoUrl: row.nameplatePhotoUrl,
        readAt: row.nameplateReadAt?.toISOString() ?? null,
        reading: parseReading(row.nameplateDataJson),
        inspection,
        current: { title: titleWithoutTag(row.name, row.tag), manufacturer: row.manufacturer, model: row.model, serialNumber: row.serialNumber, ratedVoltage: row.ratedVoltage, ipRating: row.ipRating, protectionClass: row.protectionClass, usageGroup: row.usageGroup, handHeld: row.handHeld },
        label: idLabelData(row, { serial, building: row.floor.building.name, floor: row.floor.name, validUntil: inspection.validUntil }),
        canEdit: account.can("submitChange") || account.can("recordInspection"),
      },
    };
  } catch (error) {
    return failure(error, "Zařízení se nepodařilo načíst.");
  }
}

