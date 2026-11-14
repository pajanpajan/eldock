"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PURCHASE_FREQUENCIES, PURCHASE_HORIZONS, type PurchaseFrequency, type PurchaseHorizon } from "@/lib/lifespan-purchase";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { assertPermission } from "@/server/permissions";
import { requestOrigin } from "@/server/request-url";
import { getPurchaseSettings, plantPurchaseReport, savePurchaseSettings, sendPurchaseReport } from "@/server/services/lifespan-report";
import { assertMailQuota } from "@/server/services/revision-signing";
import { getCurrentAccount, getCurrentUser } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 116: 📦 nákupní report prediktivní údržby – e-mail oddělení nákupu, frekvence a výhled; ruční odeslání.

const settingsSchema = z.object({
  plantId: z.string().min(1).max(64),
  email: z.string().trim().max(160).nullable(),
  frequency: z.enum(PURCHASE_FREQUENCIES.map((item) => item.id) as [PurchaseFrequency, ...PurchaseFrequency[]]),
  horizonDays: z.number().int().refine((value) => (PURCHASE_HORIZONS as readonly number[]).includes(value), "Neplatný výhled nákupu."),
});
const sendSchema = z.object({ plantId: z.string().min(1).max(64), horizonDays: settingsSchema.shape.horizonDays });

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Neplatná data." };
  console.error(error);
  return { ok: false, error: fallback };
}

export async function savePurchaseSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult<{ email: string | null }>> {
  try {
    await assertPermission("submitChange");
    const data = settingsSchema.parse(input);
    await assertTenantAccess({ plantId: data.plantId });
    const user = await getCurrentUser();
    const saved = await savePurchaseSettings(prisma, data.plantId, { email: data.email, frequency: data.frequency, horizonDays: data.horizonDays as PurchaseHorizon }, user?.id ?? null);
    revalidatePath("/nakupni-report");
    return { ok: true, data: { email: saved.email } };
  } catch (error) {
    return failure(error, "Nastavení se nepodařilo uložit.");
  }
}

/** „📧 Odeslat report nákupu teď“ – na uložený e-mail oddělení nákupu (SMTP, jinak záznam v logu). */
export async function sendPurchaseReportNowAction(input: z.input<typeof sendSchema>): Promise<ActionResult<{ delivery: string; to: string }>> {
  try {
    await assertPermission("submitChange");
    const data = sendSchema.parse(input);
    await assertTenantAccess({ plantId: data.plantId });
    const [account, user] = await Promise.all([getCurrentAccount(), getCurrentUser()]);
    await assertMailQuota(prisma, user?.id ?? null);
    const [settings, plant] = await Promise.all([getPurchaseSettings(prisma, data.plantId), prisma.plant.findUnique({ where: { id: data.plantId }, select: { id: true, name: true } })]);
    if (!plant) throw new WorkflowError("NOT_FOUND", "Závod nebyl nalezen.");
    const { report } = await plantPurchaseReport(prisma, plant.id, data.horizonDays, new Date(), account.types);
    const result = await sendPurchaseReport(prisma, { plantId: plant.id, plantName: plant.name, report, settings, origin: await requestOrigin(), transport: smtpTransportFromEnv(), triggeredBy: user?.id ?? "user", userId: user?.id ?? null });
    revalidatePath("/nakupni-report");
    return { ok: true, data: { delivery: result.delivery, to: result.to } };
  } catch (error) {
    return failure(error, "Report se nepodařilo odeslat.");
  }
}
