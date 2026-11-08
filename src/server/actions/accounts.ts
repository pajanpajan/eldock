"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { passwordLinkUrl, sendPasswordLink } from "@/server/password-links";
import { assertPermission } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";
import { adminPasswordLink, adminRevokeSessions, setUserDisabled } from "@/server/services/account-security";
import { createSubAccount } from "@/server/services/accounts";

import type { ActionResult } from "./workflow";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().min(3).max(200),
  title: z.string().max(120).optional().nullable(),
  accountType: z.enum(["PLANT_ADMIN", "MAINTENANCE_LEAD", "MAINTENANCE_TECH", "INSPECTOR_VTZ", "INSPECTOR_APPLIANCES", "CAE_ENGINEER"]),
  layers: z.array(z.enum(["ENERGY", "MACHINES", "TOOLS", "APPLIANCES", "SAFETY"])).max(5).optional(),
});
const id = z.string().min(1).max(64);

/** Odkaz na nastavení hesla pro správce firmy: adresa, platnost a zda odešel e-mailem (fáze 67). */
export interface PasswordLinkResult {
  link: string;
  expiresAt: Date;
  kind: "INVITE" | "RESET";
  emailed: boolean;
  email: string;
}

async function run<T>(action: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    await assertPermission("manageUsers");
    const data = await action();
    revalidatePath("/admin/users");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

async function deliverLink(actor: { id: string; companyId: string | null }, userId: string): Promise<PasswordLinkResult> {
  const result = await adminPasswordLink(prisma, actor, userId);
  const link = passwordLinkUrl(result.token);
  const company = actor.companyId ? (await prisma.registeredCompany.findUnique({ where: { id: actor.companyId }, select: { companyName: true } }))?.companyName : null;
  const emailed = await sendPasswordLink({ email: result.user.email, name: result.user.name, link, kind: result.kind, validity: result.kind === "INVITE" ? "7 dní" : "24 hodin", company });
  return { link, expiresAt: result.expiresAt, kind: result.kind, emailed, email: result.user.email };
}

/** Přidá podúčet (jen technický ředitel); u registrované firmy rovnou vytvoří pozvánku k nastavení hesla. */
export async function createSubAccountAction(input: z.input<typeof schema>): Promise<ActionResult<{ id: string; name: string; invite: PasswordLinkResult | null }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  return run(async () => {
    const actor = await getCurrentUser();
    const user = await createSubAccount(prisma, { ...parsed.data, owner: { companyId: actor.companyId, homePlantId: actor.homePlantId } });
    const invite = actor.companyId ? await deliverLink(actor, user.id) : null;
    revalidatePath("/", "layout");
    return { id: user.id, name: user.name, invite };
  }, "Podúčet se nepodařilo založit. Zkuste to prosím znovu.");
}

/** Nový odkaz na nastavení hesla pro zaměstnance (pozvánka bez hesla, jinak obnova na 24 h). */
export async function issuePasswordLinkAction(userId: string): Promise<ActionResult<PasswordLinkResult>> {
  return run(async () => deliverLink(await getCurrentUser(), id.parse(userId)), "Odkaz se nepodařilo vytvořit.");
}

/** Zablokuje / odblokuje zaměstnance (zablokovaný se nepřihlásí a jeho zařízení se odhlásí). */
export async function setUserDisabledAction(userId: string, disabled: boolean): Promise<ActionResult> {
  return run(async () => {
    await setUserDisabled(prisma, await getCurrentUser(), id.parse(userId), z.boolean().parse(disabled));
    return undefined;
  }, "Účet se nepodařilo změnit.");
}

/** Odhlásí zaměstnance ze všech zařízení. */
export async function revokeUserSessionsAction(userId: string): Promise<ActionResult<{ count: number }>> {
  return run(async () => ({ count: await adminRevokeSessions(prisma, await getCurrentUser(), id.parse(userId)) }), "Zařízení se nepodařilo odhlásit.");
}
