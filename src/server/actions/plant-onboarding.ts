"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPlantFiles } from "@/server/file-access";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";
import { assertEntityAccess } from "@/server/tenant";
import { addOnboardingMachine, createOnboardingHall } from "@/server/services/plant-onboarding";

import type { ActionResult } from "./workflow";

// Fáze 92: průvodce výrobním závodem, režim A – první hala s hlavním zdrojem a první zdokumentovaný stroj (jen s právem
// stavět ve Studiu výstavby, ve vlastním závodě).

const id = z.string().min(1).max(64);
const hallSchema = z.object({ hallName: z.string().trim().min(3).max(80), boardTag: z.string().trim().min(1).max(20), sourceKind: z.enum(["SWITCHBOARD", "TRANSFORMER"]), rating: z.number().finite().positive().max(10_000) });
const machineSchema = z.object({
  buildingId: id,
  name: z.string().trim().min(2).max(80),
  tag: z.string().trim().min(1).max(20),
  type: z.enum(["MACHINE", "CNC_MACHINE", "PRODUCTION_LINE", "SWITCHBOARD"]),
  powerKw: z.number().finite().positive().max(2000),
  schematicUrl: z.string().trim().min(1).max(300),
  schematicTitle: z.string().trim().max(120).nullable().optional(),
});

const failure = (error: unknown, fallback: string): { ok: false; error: string } => {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
};

async function guard(plantId: string) {
  await assertPermission("studio");
  await assertFeature("enterprise.studio");
  await assertEntityAccess("plant", plantId);
}

/** Krok 1: hala s rozvodnou a hlavním rozváděčem / trafostanicí na mapě areálu. */
export async function createOnboardingHallAction(plantId: string, input: z.input<typeof hallSchema>): Promise<ActionResult<{ buildingId: string; floorId: string; boardId: string; boardTag: string; boardName: string }>> {
  const parsed = hallSchema.safeParse(input);
  if (!id.safeParse(plantId).success || !parsed.success) return { ok: false, error: "Vyplňte název haly, označení hlavního zdroje a jmenovitý proud / výkon." };
  try {
    await guard(plantId);
    const hall = await createOnboardingHall(prisma, plantId, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: hall };
  } catch (error) {
    return failure(error, "Halu se nepodařilo založit. Zkuste to prosím znovu.");
  }
}

/** Krok 2: první stroj / podružný rozváděč s PDF schématem (nahrané do Eldocku nebo vzorové). */
export async function addOnboardingMachineAction(plantId: string, input: z.input<typeof machineSchema>): Promise<ActionResult<{ equipmentId: string; tag: string; name: string; qrToken: string | null }>> {
  const parsed = machineSchema.safeParse(input);
  if (!id.safeParse(plantId).success || !parsed.success) return { ok: false, error: "Vyplňte název stroje, příkon v kW a přiložte PDF schéma." };
  try {
    await guard(plantId);
    await assertEntityAccess("building", [parsed.data.buildingId]);
    // Jen soubor nahraný tímto účtem závodu (vzorové schéma z /demo-docs smí kdokoli)
    await assertPlantFiles([parsed.data.schematicUrl]);
    const user = await getCurrentUser();
    const machine = await addOnboardingMachine(prisma, plantId, user.id, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: { equipmentId: machine.equipmentId, tag: machine.tag, name: machine.name, qrToken: machine.qrToken } };
  } catch (error) {
    return failure(error, "Stroj se nepodařilo založit. Zkuste to prosím znovu.");
  }
}
