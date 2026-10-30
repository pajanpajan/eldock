"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { regenerateQrToken, setEquipmentPhoto } from "@/server/services/equipment-card";
import { getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

// Fotografie a QR štítek: smí směnový technik (zadává změny) i revizní technici.

const id = z.string().min(1).max(64);
const photoSchema = z.object({
  equipmentId: id,
  /** Jen soubory z našeho úložiště (POST /api/uploads, druh `photo`). */
  photoUrl: z.string().regex(/^\/api\/files\/photos\/[\w./-]+$/).nullable(),
});
const qrSchema = z.object({ equipmentId: id });

async function assertCardEditor() {
  const account = await getCurrentAccount();
  if (!account.can("submitChange") && !account.can("recordInspection")) {
    throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.submitChange} nebo ${PERMISSION_LABELS.recordInspection}.`);
  }
}

async function run<S extends z.ZodType, T>(schema: S, raw: unknown, action: (input: z.infer<S>) => Promise<T>): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neplatná data." };
  try {
    await assertCardEditor();
    const data = await action(parsed.data);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }
}

export async function updateEquipmentPhotoAction(input: z.input<typeof photoSchema>) {
  return run(photoSchema, input, async ({ equipmentId, photoUrl }) => {
    const result = await setEquipmentPhoto(prisma, equipmentId, photoUrl);
    revalidatePath(equipmentHref(equipmentId));
    return result;
  });
}

export async function regenerateQrLabelAction(input: z.input<typeof qrSchema>) {
  return run(qrSchema, input, async ({ equipmentId }) => {
    const result = await regenerateQrToken(prisma, equipmentId);
    revalidatePath(equipmentHref(equipmentId));
    return { qrToken: result.qrToken! };
  });
}
