"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { changePassword, confirmTotpSetup, disableTotp, recordSecurityEvent, revokeSessions, startTotpSetup } from "@/server/services/account-security";
import { getAuthState } from "@/server/session";

import type { ActionResult } from "./workflow";

// Fáze 67: „Můj účet“ – změna hesla, přihlášená zařízení a dvoufázové ověření přihlášeného uživatele registrované firmy.

async function signedInMember() {
  const state = await getAuthState();
  if (!state.user?.companyId) throw new WorkflowError("FORBIDDEN", "Účty obchodního dema mají společné heslo – přihlaste se účtem své firmy.");
  return { user: state.user, sessionId: state.sessionId };
}

async function run<T>(action: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    const data = await action();
    revalidatePath("/ucet");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

const passwordSchema = z.object({ current: z.string().max(200), next: z.string().max(200), confirm: z.string().max(200) });

/** Změna hesla; ostatní zařízení se odhlásí. */
export async function changePasswordAction(input: z.input<typeof passwordSchema>) {
  return run(async () => {
    const data = passwordSchema.parse(input);
    if (data.next !== data.confirm) throw new WorkflowError("VALIDATION", "Nová hesla se neshodují.");
    const { user, sessionId } = await signedInMember();
    return changePassword(prisma, { userId: user.id, sessionId, current: data.current, next: data.next });
  }, "Heslo se nepodařilo změnit. Zkuste to prosím znovu.");
}

/** Odhlásí jedno zařízení (aktuální relace se odhlašuje tlačítkem Odhlásit). */
export async function revokeSessionAction(sessionId: string) {
  return run(async () => {
    const { user, sessionId: current } = await signedInMember();
    const id = z.string().min(1).max(64).parse(sessionId);
    if (id === current) throw new WorkflowError("VALIDATION", "Aktuální zařízení se odhlašuje tlačítkem Odhlásit.");
    const count = await revokeSessions(prisma, { userId: user.id, sessionId: id });
    if (count) await recordSecurityEvent(prisma, { kind: "SESSION_REVOKED", userId: user.id, companyId: user.companyId, actorId: user.id, email: user.email, detail: "jedno zařízení" });
    return { count };
  }, "Zařízení se nepodařilo odhlásit.");
}

/** Odhlásí všechna ostatní zařízení. */
export async function revokeOtherSessionsAction() {
  return run(async () => {
    const { user, sessionId } = await signedInMember();
    const count = await revokeSessions(prisma, { userId: user.id, exceptSessionId: sessionId });
    await recordSecurityEvent(prisma, { kind: "SESSION_REVOKED", userId: user.id, companyId: user.companyId, actorId: user.id, email: user.email, detail: `ostatní zařízení: ${count}` });
    return { count };
  }, "Zařízení se nepodařilo odhlásit.");
}

/** Začne spárování aplikace Authenticator – vrací tajemství a odkaz pro QR kód. */
export async function startTotpAction() {
  return run(async () => startTotpSetup(prisma, (await signedInMember()).user.id), "Dvoufázové ověření se nepodařilo připravit.");
}

/** Dokončí spárování kódem z aplikace – vrací záložní kódy (zobrazí se jen jednou). */
export async function confirmTotpAction(code: string) {
  return run(async () => ({ codes: await confirmTotpSetup(prisma, (await signedInMember()).user.id, z.string().trim().max(20).parse(code)) }), "Dvoufázové ověření se nepodařilo zapnout.");
}

/** Vypne dvoufázové ověření (po zadání hesla). */
export async function disableTotpAction(password: string) {
  return run(async () => disableTotp(prisma, (await signedInMember()).user.id, z.string().max(200).parse(password)), "Dvoufázové ověření se nepodařilo vypnout.");
}
