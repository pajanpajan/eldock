"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";
import { buildingImpact, deleteBuilding, deleteEquipment, equipmentImpact, moveBuilding, updateBuilding, updateFloor, type BuildingImpact, type EquipmentImpact } from "@/server/services/buildings";
import { assertEntityAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 108: budova, podlaží a zařízení mimo Studio – úprava, přesun na mapě areálu a smazání (právo Studia výstavby).
// Všechny stránky závodu čtou stav z databáze, po změně se obnoví celý layout (mapa, seznamy, revize, plánovač).

const id = z.string().min(1).max(64);

async function run<T>(guard: () => Promise<void>, action: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    await assertPermission("studio");
    await assertFeature("enterprise.studio");
    await guard();
    const data = await action();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

export async function buildingImpactAction(buildingId: string): Promise<ActionResult<BuildingImpact>> {
  if (!id.safeParse(buildingId).success) return { ok: false, error: "Neplatná budova." };
  return run(() => assertEntityAccess("building", buildingId), () => buildingImpact(prisma, buildingId), "Údaje budovy se nepodařilo načíst.");
}

const editSchema = z.object({
  buildingId: id,
  name: z.string().max(80),
  code: z.string().max(4),
  shortName: z.string().max(40).optional().nullable(),
  map: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional().nullable(),
});

export async function updateBuildingAction(input: z.input<typeof editSchema>) {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Neplatné údaje budovy." };
  return run(
    () => assertEntityAccess("building", parsed.data.buildingId),
    async () => {
      const building = await updateBuilding(prisma, parsed.data);
      return { id: building.id, name: building.name, code: building.code, plantId: building.plantId };
    },
    "Budovu se nepodařilo upravit.",
  );
}

const rect = z.object({ x: z.number().min(-1).max(101), y: z.number().min(-1).max(101), w: z.number().min(0.5).max(100), h: z.number().min(0.5).max(100) });

export async function moveBuildingAction(input: { buildingId: string; rect: z.input<typeof rect> }) {
  const parsed = z.object({ buildingId: id, rect }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Neplatná poloha budovy." };
  return run(() => assertEntityAccess("building", parsed.data.buildingId), async () => (await moveBuilding(prisma, parsed.data.buildingId, parsed.data.rect)).id, "Budovu se nepodařilo přesunout.");
}

export async function updateFloorAction(input: { floorId: string; name: string; description?: string | null }) {
  const parsed = z.object({ floorId: id, name: z.string().max(80), description: z.string().max(300).optional().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Neplatné údaje podlaží." };
  return run(() => assertEntityAccess("floor", parsed.data.floorId), async () => (await updateFloor(prisma, parsed.data)).id, "Podlaží se nepodařilo upravit.");
}

export async function deleteBuildingAction(input: { buildingId: string; confirmName?: string | null }) {
  const parsed = z.object({ buildingId: id, confirmName: z.string().max(120).optional().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Neplatná budova." };
  return run(
    () => assertEntityAccess("building", parsed.data.buildingId),
    async () => {
      const user = await getCurrentUser();
      const result = await deleteBuilding(prisma, { ...parsed.data, actorId: user.id });
      return { plantId: result.plantId, name: result.name };
    },
    "Budovu se nepodařilo smazat.",
  );
}

export async function equipmentImpactAction(equipmentId: string): Promise<ActionResult<EquipmentImpact>> {
  if (!id.safeParse(equipmentId).success) return { ok: false, error: "Neplatné zařízení." };
  return run(() => assertEntityAccess("equipment", equipmentId), () => equipmentImpact(prisma, equipmentId), "Údaje zařízení se nepodařilo načíst.");
}

export async function deleteEquipmentAction(input: { equipmentId: string; confirmTag?: string | null }) {
  const parsed = z.object({ equipmentId: id, confirmTag: z.string().max(80).optional().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Neplatné zařízení." };
  return run(() => assertEntityAccess("equipment", parsed.data.equipmentId), async () => (await deleteEquipment(prisma, parsed.data)).tag, "Zařízení se nepodařilo smazat.");
}
