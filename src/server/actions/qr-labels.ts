"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { LABEL_PURPOSES, type LabelPurpose } from "@/lib/qr-label-registry";
import { actionFailure } from "@/server/panel-guards";
import { createLabelBatch, pairLabelWithEquipment } from "@/server/services/qr-labels";
import { getSignedInUser } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";
import { requireSuperadmin } from "@/server/superadmin-session";

import type { ActionResult } from "./workflow";

// Fáze 103: generátor QR štítků ELDOCK ve velínu – nová série pro firmu a označení vytištěné série.

const batchSchema = z.object({
  companyName: z.string().trim().min(2, "Zadejte název firmy.").max(160),
  ico: z.string().trim().max(12).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  purpose: z.enum(LABEL_PURPOSES.map((purpose) => purpose.id) as [LabelPurpose, ...LabelPurpose[]]),
  count: z.coerce.number().int().min(1, "Série má 1 až 5 000 štítků.").max(5000, "Série má 1 až 5 000 štítků."),
  note: z.string().trim().max(300).optional().nullable(),
});

export async function createLabelBatchAction(input: z.input<typeof batchSchema>): Promise<ActionResult<{ id: string; first: string; last: string; count: number; companyName: string; registered: boolean }>> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte údaje série." };
  try {
    await requireSuperadmin();
    const email = parsed.data.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Zadejte platný e-mail zákazníka." };
    const batch = await createLabelBatch(prisma, { ...parsed.data, email });
    revalidatePath("/superadmin");
    return { ok: true, data: { id: batch.id, first: batch.first, last: batch.last, count: batch.count, companyName: batch.companyName, registered: Boolean(batch.registeredCompanyId) } };
  } catch (error) {
    return actionFailure(error, "Sérii štítků se nepodařilo vytvořit.");
  }
}

/** Po tisku (událost `afterprint` stránky tisku) – datum tisku v historii sérií. */
export async function markBatchPrintedAction(batchId: string): Promise<ActionResult> {
  if (!z.string().min(1).max(64).safeParse(batchId).success) return { ok: false, error: "Neplatná série." };
  try {
    await requireSuperadmin();
    await prisma.qrLabelBatch.updateMany({ where: { id: batchId }, data: { printedAt: new Date() } });
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Datum tisku se nepodařilo uložit.");
  }
}

/**
 * Fáze 103: spárování štítku ze série firmy se zařízením jejího závodu (z karty štítku po naskenování) – jen uživatel
 * registrované firmy Správy závodů (sdílené obchodní demo štítky nepáruje).
 */
export async function pairLabelWithEquipmentAction(code: string, equipmentId: string): Promise<ActionResult<{ serial: string }>> {
  if (!/^EL-\d{6,9}$/i.test(code.trim()) || !z.string().min(1).max(64).safeParse(equipmentId).success) return { ok: false, error: "Vyberte zařízení." };
  try {
    const user = await getSignedInUser();
    if (!user?.companyId) return { ok: false, error: "Štítek spáruje přihlášený uživatel firmy závodu." };
    await assertTenantAccess({ equipmentId });
    const serial = await pairLabelWithEquipment(prisma, { code, equipmentId, companyId: user.companyId });
    revalidatePath(`/q/${serial}`);
    return { ok: true, data: { serial } };
  } catch (error) {
    return actionFailure(error, "Spárování štítku se nepodařilo.");
  }
}
