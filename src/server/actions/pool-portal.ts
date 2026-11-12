"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { actionFailure } from "@/server/panel-guards";
import { getPoolDesigner, signInPoolDesigner, signOutPoolDesigner } from "@/server/pool-session";
import { authenticateDesigner, claimTask, createPoolDesigner } from "@/server/services/redlines";
import { requireSuperadmin } from "@/server/superadmin-session";

import type { ActionResult } from "./workflow";

// Fáze 103: portál projektantů ELDOCK Poolu (/portal-projektantu) a jejich správa ve velínu.

/** Omezení pokusů o přihlášení (v paměti procesu): 10 pokusů za 15 minut na e-mail. */
const attempts = new Map<string, { start: number; count: number }>();
function allowAttempt(email: string, now = Date.now()) {
  const entry = attempts.get(email);
  if (!entry || now - entry.start > 15 * 60_000) {
    if (attempts.size > 2000) attempts.clear();
    attempts.set(email, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 10;
}

/** Přihlášení projektanta e-mailem a přístupovým kódem ze schváleného seznamu poolu. */
export async function poolLoginAction(_previous: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "");
  if (!email || !code) return { error: "Zadejte e-mail a přístupový kód projektanta." };
  if (!allowAttempt(email)) return { error: "Příliš mnoho pokusů – zkuste to za 15 minut." };
  const designer = await authenticateDesigner(prisma, email, code);
  if (!designer) return { error: "E-mail nebo přístupový kód nesedí – kód vydává velín ELDOCK schváleným projektantům." };
  await signInPoolDesigner(designer.id);
  redirect("/portal-projektantu");
}

export async function poolLogoutAction() {
  await signOutPoolDesigner();
  redirect("/portal-projektantu");
}

/** ✋ Přijímám úkol k překreslení – atomicky: první projektant vyhrává. */
export async function claimPoolTaskAction(taskId: string): Promise<ActionResult> {
  if (!z.string().min(1).max(64).safeParse(taskId).success) return { ok: false, error: "Neplatný úkol." };
  try {
    const designer = await getPoolDesigner();
    if (!designer) return { ok: false, error: "Přihlaste se do portálu projektantů." };
    await claimTask(prisma, taskId, designer.id);
    revalidatePath("/portal-projektantu");
    return { ok: true, data: undefined };
  } catch (error) {
    revalidatePath("/portal-projektantu");
    return actionFailure(error, "Úkol se nepodařilo přijmout.");
  }
}

const designerSchema = z.object({ name: z.string().trim().min(3).max(80), email: z.string().trim().max(160) });

/** Velín: schválený projektant poolu – přístupový kód se zobrazí jen jednou. */
export async function createPoolDesignerAction(input: z.input<typeof designerSchema>): Promise<ActionResult<{ name: string; email: string; code: string }>> {
  const parsed = designerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte jméno (aspoň 3 znaky) a e-mail projektanta." };
  try {
    await requireSuperadmin();
    const designer = await createPoolDesigner(prisma, parsed.data);
    revalidatePath("/superadmin");
    return { ok: true, data: { name: designer.name, email: designer.email, code: designer.code } };
  } catch (error) {
    return actionFailure(error, "Projektanta se nepodařilo uložit.");
  }
}

/** Velín: vyřazení / návrat projektanta do poolu (vyřazený se nepřihlásí a nemůže přijímat úkoly). */
export async function setPoolDesignerActiveAction(designerId: string, active: boolean): Promise<ActionResult> {
  if (!z.string().min(1).max(64).safeParse(designerId).success) return { ok: false, error: "Neplatný projektant." };
  try {
    await requireSuperadmin();
    await prisma.poolDesigner.update({ where: { id: designerId }, data: { active } });
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Změna se nepodařila.");
  }
}
