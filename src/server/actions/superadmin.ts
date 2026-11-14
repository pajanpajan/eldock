"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SUPERADMIN_COOKIE, SUPERADMIN_TTL_SECONDS, brandEnv, checkAccessPassword, signSuperadminToken, superadminPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionFailure } from "@/server/panel-guards";
import { startManualBackup } from "@/server/jobs";
import { adjustCredits, cancelCreditOrder, confirmCreditOrder, resolveAiFeedback, revokeProvisionalCredits } from "@/server/services/credits";
import { requireSuperadmin } from "@/server/superadmin-session";
import { saveLabelSets, saveOperatorProfile } from "@/server/services/operator";
import { clearBackupStorage, clearSmtpSettings, loadPlatformSettings, saveBackupStorage, saveSmtpSettings } from "@/server/services/platform-settings";
import { sendSmtpTest } from "@/server/mailer";
import { footerLine } from "@/lib/operator";

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

/**
 * Fáze 113: ⭐ neomezený přístup firmy (účet provozovatele, ukázková firma pro prezentace) – nové projekty a půdorysy
 * v plné verzi bez kreditů, Hlídač revizí bez limitu zařízení.
 */
export async function setUnlimitedAccessAction(companyId: string, unlimited: boolean): Promise<ActionResult<{ unlimitedAccess: boolean }>> {
  if (!id.safeParse(companyId).success || typeof unlimited !== "boolean") return { ok: false, error: "Neplatná firma." };
  try {
    await requireSuperadmin();
    const company = await prisma.registeredCompany.update({ where: { id: companyId }, data: { unlimitedAccess: unlimited }, select: { unlimitedAccess: true } });
    revalidatePath("/superadmin");
    return { ok: true, data: company };
  } catch (error) {
    return actionFailure(error, "Přístup se nepodařilo změnit.");
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

/** Fáze 114: [ ↩️ Odečíst předběžné kredity ] – platba za předběžně připsané kredity nedorazila (storno + odečet). */
export async function revokeProvisionalCreditsAction(orderId: string): Promise<ActionResult<{ balance: number; credits: number }>> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Neplatná objednávka." };
  try {
    await requireSuperadmin();
    const result = await revokeProvisionalCredits(prisma, orderId);
    revalidatePath("/superadmin");
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Předběžné kredity se nepodařilo odečíst.");
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

/** Fáze 113: ⚙️ SMTP z velínu (heslo se ukládá šifrovaně; prázdné heslo = ponechat uložené). */
export async function saveSmtpSettingsAction(input: unknown): Promise<ActionResult<{ host: string; port: number }>> {
  try {
    await requireSuperadmin();
    const saved = await saveSmtpSettings(prisma, input);
    revalidatePath("/superadmin");
    return { ok: true, data: { host: saved.host, port: saved.port } };
  } catch (error) {
    return actionFailure(error, "Nastavení SMTP se nepodařilo uložit.");
  }
}

/** Fáze 113: [ Otestovat SMTP ] – ověření spojení a zkušební e-mail na zadanou adresu. */
export async function testSmtpAction(to: string): Promise<ActionResult<{ to: string; via: "env" | "velin" }>> {
  const email = z.string().trim().email().max(200).safeParse(to);
  if (!email.success) return { ok: false, error: "Zadejte platný e-mail pro zkušební zprávu." };
  try {
    await requireSuperadmin();
    await loadPlatformSettings(prisma);
    const result = await sendSmtpTest(email.data);
    return { ok: true, data: { to: email.data, via: result.via } };
  } catch (error) {
    if (error instanceof Error && error.name !== "WorkflowError") return { ok: false, error: error.message };
    return actionFailure(error, "Zkušební e-mail se nepodařilo odeslat.");
  }
}

/** Fáze 113: ☁️ úložiště záloh mimo server (S3 / Cloudflare R2) z velínu – klíče a heslo šifrování šifrovaně. */
export async function saveBackupStorageAction(input: unknown): Promise<ActionResult<{ bucket: string }>> {
  try {
    await requireSuperadmin();
    const saved = await saveBackupStorage(prisma, input);
    revalidatePath("/superadmin");
    return { ok: true, data: { bucket: saved.bucket } };
  } catch (error) {
    return actionFailure(error, "Úložiště záloh se nepodařilo uložit.");
  }
}

/** Fáze 113: odebrání SMTP z velínu. */
export async function clearSmtpSettingsAction(): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    await clearSmtpSettings(prisma);
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "SMTP se nepodařilo odebrat.");
  }
}

/** Fáze 113: odebrání úložiště záloh z velínu – zálohy dál místně na serveru. */
export async function clearBackupStorageAction(): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    await clearBackupStorage(prisma);
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Úložiště záloh se nepodařilo odebrat.");
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

/** Fáze 112: údaje provozovatele (patička, faktury, VOP, zásady) – IČO, DIČ, IBAN, spisová značka, plátcovství DPH. */
export async function saveOperatorProfileAction(input: unknown): Promise<ActionResult<{ footer: string }>> {
  try {
    await requireSuperadmin();
    const profile = await saveOperatorProfile(prisma, input);
    revalidatePath("/", "layout");
    return { ok: true, data: { footer: footerLine(profile) } };
  } catch (error) {
    return actionFailure(error, "Údaje provozovatele se nepodařilo uložit.");
  }
}

/** Fáze 112: sady QR štítků k objednání (název, počet kusů, cena bez DPH). */
export async function saveLabelSetsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    await requireSuperadmin();
    const sets = await saveLabelSets(prisma, input);
    revalidatePath("/panel-builder/credits");
    revalidatePath("/superadmin");
    return { ok: true, data: { count: sets.length } };
  } catch (error) {
    return actionFailure(error, "Sady štítků se nepodařilo uložit.");
  }
}
