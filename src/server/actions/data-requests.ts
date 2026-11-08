"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CLOSURE_CONFIRM_WORD, isClosureConfirmed } from "@/lib/data-requests";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { getPanelCompany } from "@/server/panel-session";
import { verifyPassword } from "@/server/password";
import { cancelCompanyClosure, closeCompanyNow, removeEmployee, requestCompanyClosure } from "@/server/services/data-requests";
import { getCurrentAccount } from "@/server/session";
import { UPLOAD_ROOT } from "@/server/storage";
import { requireSuperadmin } from "@/server/superadmin-session";

import type { ActionResult } from "./workflow";

// Fáze 69 (GDPR): zrušení účtu firmy (s heslem a potvrzením, výmaz po 30 dnech), zrušení žádosti, odebrání zaměstnance
// a zásahy velínu (výmaz hned, zrušení žádosti).

const id = z.string().min(1).max(64);
const closureSchema = z.object({ password: z.string().min(1).max(200), confirm: z.string().max(40) });
const removeSchema = z.object({ userId: id, anonymizeName: z.boolean() });

const wrongPassword = async (): Promise<{ ok: false; error: string }> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ok: false, error: "Nesprávné heslo." };
};

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

/** Technický ředitel registrované firmy Správy závodů (demo účty nemají účet firmy). */
async function companyAdmin() {
  const account = await getCurrentAccount();
  if (!account.user.companyId) throw new WorkflowError("FORBIDDEN", "Obchodní demo nemá účet firmy.");
  if (!account.can("manageUsers")) throw new WorkflowError("FORBIDDEN", "Účet firmy spravuje technický ředitel.");
  return { ...account.user, companyId: account.user.companyId };
}

const revalidateCompany = () => {
  revalidatePath("/admin/data");
  revalidatePath("/admin/users");
  revalidatePath("/ucet");
};

/** Žádost o zrušení účtu firmy Správy závodů – heslo správce a slovo ZRUŠIT; výmaz za 30 dní. */
export async function requestCompanyClosureAction(input: z.input<typeof closureSchema>): Promise<ActionResult<{ scheduledAt: string }>> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte své heslo." };
  if (!isClosureConfirmed(parsed.data.confirm)) return { ok: false, error: `Pro potvrzení napište ${CLOSURE_CONFIRM_WORD}.` };
  try {
    const admin = await companyAdmin();
    if (!admin.passwordHash || !(await verifyPassword(parsed.data.password, admin.passwordHash))) return wrongPassword();
    const request = await requestCompanyClosure(prisma, { companyId: admin.companyId, requestedBy: "company-admin", actorId: admin.id });
    revalidateCompany();
    return { ok: true, data: { scheduledAt: (request.scheduledAt ?? new Date()).toISOString() } };
  } catch (error) {
    return failure(error, "Žádost o zrušení účtu se nepodařilo uložit.");
  }
}

export async function cancelCompanyClosureAction(): Promise<ActionResult> {
  try {
    const admin = await companyAdmin();
    await cancelCompanyClosure(prisma, { companyId: admin.companyId, actorId: admin.id });
    revalidateCompany();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Žádost o zrušení účtu se nepodařilo zrušit.");
  }
}

/** Odebrání zaměstnance: zruší přihlášení a kontakty, jméno zůstane v historii (nebo se anonymizuje). */
export async function removeEmployeeAction(input: z.input<typeof removeSchema>): Promise<ActionResult<{ name: string }>> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zaměstnanec nebyl nalezen." };
  try {
    const admin = await companyAdmin();
    const result = await removeEmployee(prisma, { companyId: admin.companyId, actorId: admin.id, userId: parsed.data.userId, anonymizeName: parsed.data.anonymizeName });
    revalidateCompany();
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Zaměstnance se nepodařilo odebrat.");
  }
}

/** Firma AI Panel Builderu: žádost o zrušení účtu (heslo firmy a slovo ZRUŠIT). */
export async function requestPanelClosureAction(input: z.input<typeof closureSchema>): Promise<ActionResult<{ scheduledAt: string }>> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte heslo firmy." };
  if (!isClosureConfirmed(parsed.data.confirm)) return { ok: false, error: `Pro potvrzení napište ${CLOSURE_CONFIRM_WORD}.` };
  try {
    const company = await getPanelCompany();
    if (!company) throw new WorkflowError("FORBIDDEN", "Přihlaste se do AI Panel Builderu.");
    const stored = await prisma.registeredCompany.findUnique({ where: { id: company.id }, select: { passwordHash: true } });
    if (!stored || !(await verifyPassword(parsed.data.password, stored.passwordHash))) return wrongPassword();
    const request = await requestCompanyClosure(prisma, { companyId: company.id, requestedBy: "panel-company" });
    revalidatePath("/panel-builder/company");
    return { ok: true, data: { scheduledAt: (request.scheduledAt ?? new Date()).toISOString() } };
  } catch (error) {
    return failure(error, "Žádost o zrušení účtu se nepodařilo uložit.");
  }
}

export async function cancelPanelClosureAction(): Promise<ActionResult> {
  try {
    const company = await getPanelCompany();
    if (!company) throw new WorkflowError("FORBIDDEN", "Přihlaste se do AI Panel Builderu.");
    await cancelCompanyClosure(prisma, { companyId: company.id });
    revalidatePath("/panel-builder/company");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Žádost o zrušení účtu se nepodařilo zrušit.");
  }
}

/** Velín: výmaz účtu firmy hned (zákazník o něj výslovně požádal). */
export async function superadminCloseCompanyAction(companyId: string): Promise<ActionResult<{ status: string; error: string | null }>> {
  if (!id.safeParse(companyId).success) return { ok: false, error: "Firma nebyla nalezena." };
  try {
    await requireSuperadmin();
    const result = await closeCompanyNow(prisma, { companyId, storageRoot: UPLOAD_ROOT });
    revalidatePath("/superadmin");
    return { ok: true, data: { status: result.status, error: result.error } };
  } catch (error) {
    return failure(error, "Výmaz účtu firmy se nepodařil.");
  }
}

/** Velín: zrušení čekající žádosti o zrušení účtu. */
export async function superadminCancelClosureAction(companyId: string): Promise<ActionResult> {
  if (!id.safeParse(companyId).success) return { ok: false, error: "Firma nebyla nalezena." };
  try {
    await requireSuperadmin();
    await cancelCompanyClosure(prisma, { companyId });
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Žádost se nepodařilo zrušit.");
  }
}
