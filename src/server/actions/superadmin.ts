"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SUPERADMIN_COOKIE, SUPERADMIN_TTL_SECONDS, brandEnv, checkAccessPassword, signSuperadminToken, superadminPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionFailure } from "@/server/panel-guards";
import { startManualBackup } from "@/server/jobs";
import { adjustCredits, cancelCreditOrder, confirmCreditOrder, resolveAiFeedback } from "@/server/services/credits";
import { requireSuperadmin } from "@/server/superadmin-session";

import type { ActionResult } from "./workflow";

// Velín /superadmin (fáze 50): přihlášení heslem velínu a obchodní / technické zásahy.

const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";
const id = z.string().min(1).max(64);

export async function loginSuperadminAction(_previous: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const expected = superadminPassword();
  if (!expected) return { error: "Velín je vypnutý – nastavte na serveru ELDOCK_SUPERADMIN_PASSWORD." };
  const candidate = String(form.get("password") ?? "");
  if (!candidate || !(await checkAccessPassword(candidate, expected))) {
    // Zpomalení pokusů o uhodnutí hesla
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "Nesprávné heslo velínu." };
  }
  (await cookies()).set(SUPERADMIN_COOKIE, await signSuperadminToken(), { path: "/", maxAge: SUPERADMIN_TTL_SECONDS, sameSite: "strict", httpOnly: true, secure: secure() });
  redirect("/superadmin");
}

export async function logoutSuperadminAction() {
  (await cookies()).delete(SUPERADMIN_COOKIE);
  redirect("/superadmin/login");
}

const adjustSchema = z.union([z.object({ add: z.number().int().min(-100_000).max(100_000) }), z.object({ set: z.number().int().min(0).max(100_000) })]);

/** [ +5 / +10 / +50 kreditů ] nebo ruční nastavení počtu kreditů firmy. */
export async function adjustCreditsAction(companyId: string, change: z.input<typeof adjustSchema>): Promise<ActionResult<{ creditsRemaining: number }>> {
  const parsed = adjustSchema.safeParse(change);
  if (!id.safeParse(companyId).success || !parsed.success) return { ok: false, error: "Neplatný počet kreditů." };
  try {
    await requireSuperadmin();
    const company = await adjustCredits(prisma, companyId, parsed.data);
    revalidatePath("/superadmin");
    return { ok: true, data: { creditsRemaining: company.creditsRemaining } };
  } catch (error) {
    return actionFailure(error, "Kredity se nepodařilo upravit.");
  }
}

/** [ ✅ Potvrdit úhradu a připsat kredity ] – transakce PENDING → PAID + kredity firmě. */
export async function confirmCreditOrderAction(orderId: string): Promise<ActionResult<{ creditsRemaining: number; companyName: string }>> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Neplatná objednávka." };
  try {
    await requireSuperadmin();
    const { company } = await confirmCreditOrder(prisma, orderId);
    revalidatePath("/superadmin");
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { creditsRemaining: company.creditsRemaining, companyName: company.companyName } };
  } catch (error) {
    return actionFailure(error, "Úhradu se nepodařilo potvrdit.");
  }
}

export async function cancelCreditOrderAction(orderId: string): Promise<ActionResult> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Neplatná objednávka." };
  try {
    await requireSuperadmin();
    await cancelCreditOrder(prisma, orderId);
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Objednávku se nepodařilo stornovat.");
  }
}

/** Fáze 68: „Zálohovat teď“ – záloha běží na pozadí, stav ukáže záložka Zálohy a data. */
export async function runBackupNowAction(): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    if (await prisma.maintenanceRun.count({ where: { kind: "BACKUP", status: "RUNNING" } })) return { ok: false, error: "Záloha už běží – počkejte na její dokončení." };
    startManualBackup({ prisma, log: (message) => console.error(message) });
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && !(error.name === "WorkflowError")) return { ok: false, error: error.message };
    return actionFailure(error, "Zálohu se nepodařilo spustit.");
  }
}

/** [ ✓ Označit jako vyřešené ] hlášení chyby AI. */
export async function resolveAiFeedbackAction(reportId: string, adminNote: string | null): Promise<ActionResult> {
  if (!id.safeParse(reportId).success || (adminNote?.length ?? 0) > 1000) return { ok: false, error: "Neplatné hlášení." };
  try {
    await requireSuperadmin();
    await resolveAiFeedback(prisma, reportId, adminNote);
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Hlášení se nepodařilo uzavřít.");
  }
}
