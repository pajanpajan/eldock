"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { regenerateQrToken, setEquipmentPhoto } from "@/server/services/equipment-card";
import { applyNameplate } from "@/server/services/nameplate";
import { ensureEquipmentLabel } from "@/server/services/qr-labels";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

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
    await assertTenantAccess(parsed.data);
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

// ---------------------------------------------------------------------------
//  Fáze 111: 📷 výrobní štítek – potvrzení přečtených údajů a identifikační štítek EL-xxxxxx
// ---------------------------------------------------------------------------

const optional = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const nameplateSchema = z.object({
  equipmentId: id,
  title: optional(120),
  name: optional(120),
  manufacturer: optional(40),
  model: optional(60),
  serialNumber: optional(40),
  voltage: optional(40),
  powerW: z.number().positive().max(10_000_000).nullable().optional().transform((value) => value ?? null),
  currentA: z.number().positive().max(100_000).nullable().optional().transform((value) => value ?? null),
  ipRating: optional(8),
  protectionClass: z.enum(["I", "II", "III"]).nullable().optional().transform((value) => value ?? null),
  usageGroup: z.enum(["A", "B", "C", "D", "E"]).nullable().optional().transform((value) => value ?? null),
  year: z.number().int().min(1950).max(2100).nullable().optional().transform((value) => value ?? null),
  handHeld: z.boolean().nullable().optional(),
});

/** Potvrzené údaje z výrobního štítku do karty zařízení; lhůta revize podle třídy a skupiny (ČSN 33 1600 ed. 2). */
export async function applyNameplateAction(input: z.input<typeof nameplateSchema>) {
  return run(nameplateSchema, input, async ({ equipmentId, ...fields }) => {
    const result = await applyNameplate(prisma, equipmentId, fields);
    // Identifikační štítek s QR kódem EL-xxxxxx (registr štítků, idempotentně)
    const serial = await ensureEquipmentLabel(prisma, equipmentId);
    revalidatePath(equipmentHref(equipmentId));
    revalidatePath("/hlidac-revizi");
    return { ...result, labelSerial: serial };
  });
}

/** Přidělení identifikačního štítku EL-xxxxxx (před tiskem). */
export async function ensureEquipmentLabelAction(input: z.input<typeof qrSchema>) {
  return run(qrSchema, input, async ({ equipmentId }) => ({ serial: await ensureEquipmentLabel(prisma, equipmentId) }));
}

