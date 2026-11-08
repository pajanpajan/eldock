"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { User } from "@/generated/prisma/client";
import {
  AUTH_COOKIE,
  AUTH_TTL_SECONDS,
  TWO_FACTOR_COOKIE,
  TWO_FACTOR_TTL_SECONDS,
  brandEnv,
  parseSubject,
  safeNextPath,
  sessionSubject,
  signAuthToken,
  signTwoFactorToken,
  verifyAuthToken,
  verifyTwoFactorToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_HOME } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { applyAccount } from "@/server/account-switch";
import { passwordLinkUrl, sendPasswordLink } from "@/server/password-links";
import { requestMeta } from "@/server/request-meta";
import {
  createUserSession,
  loginLock,
  normalizeEmail,
  recordSecurityEvent,
  requestPasswordReset,
  revokeSessions,
  setPasswordFromLink,
  verifyCredentials,
  verifySecondFactor,
} from "@/server/services/account-security";

// Fáze 67: přihlášení do Správy závodů – limit pokusů, stejná hláška pro neznámý e-mail i špatné heslo, relace na serveru
// pro uživatele registrovaných firem, druhý krok TOTP, zapomenuté heslo a nastavení hesla z odkazu.

export interface LoginState {
  error?: string;
  email?: string;
  accountId?: string;
  /** Heslo ověřeno, čeká se na kód z aplikace Authenticator (cookie `eldock-2fa`). */
  needsTotp?: boolean;
  next?: string;
}

const loginSchema = z.object({
  accountId: z.string().max(64).optional(),
  email: z.string().trim().max(200).optional(),
  password: z.string().max(200),
  next: z.string().max(500).optional(),
});

const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";
const cookieOptions = (maxAge: number) => ({ path: "/", maxAge, sameSite: "lax" as const, httpOnly: true, secure: secure() });

/** Dokončí přihlášení: relace (firma) nebo bezstavový token (demo), záznam do deníku a přesměrování. */
async function completeLogin(user: User, next: string | undefined, ipKey: string | null, device: string | null) {
  const now = new Date();
  const store = await cookies();
  const token = user.companyId ? await signAuthToken(sessionSubject(user.id, (await createUserSession(prisma, user.id, device, now)).id)) : await signAuthToken(user.id);
  store.set(AUTH_COOKIE, token, cookieOptions(AUTH_TTL_SECONDS));
  store.delete(TWO_FACTOR_COOKIE);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  await recordSecurityEvent(prisma, { kind: "LOGIN_OK", userId: user.id, companyId: user.companyId, email: user.email, ipKey, detail: device }, now);
  // Přihlášení nastaví účet vždy (i při ELDOCK_LOCK_ACCOUNT_SWITCHER=1 – právě tím se účet uzamkne).
  await applyAccount(user.id, APP_HOME, user.mustChangePassword ? "/ucet?heslo=zmenit" : (safeNextPath(next) ?? APP_HOME));
}

/** Přihlášení: účet (výběr nebo e-mail) + heslo; u účtu se zapnutým dvoufázovým ověřením následuje kód. */
export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const input = loginSchema.parse({
    accountId: formData.get("accountId") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") ?? "",
    next: formData.get("next") || undefined,
  });
  const echo = { email: input.email, accountId: input.accountId, next: input.next };
  if (!input.email && !input.accountId) return { ...echo, error: "Vyberte účet nebo zadejte e-mail." };
  const { ipKey, device } = await requestMeta();
  const email = input.email ? normalizeEmail(input.email) : null;
  const lock = await loginLock(prisma, { email, ipKey });
  if (lock) {
    await recordSecurityEvent(prisma, { kind: "LOGIN_LOCKED", email, ipKey });
    return { ...echo, error: `Příliš mnoho neúspěšných pokusů. Zkuste to znovu za ${lock.minutes} min.` };
  }
  const { user, candidate } = await verifyCredentials(prisma, input);
  if (!user) {
    await recordSecurityEvent(prisma, { kind: "LOGIN_FAILED", email: email ?? candidate?.email, userId: candidate?.id, companyId: candidate?.companyId, ipKey });
    return { ...echo, error: input.email ? "Nesprávný e-mail nebo heslo." : "Nesprávné heslo / PIN." };
  }
  if (user.companyId && user.totpEnabledAt) {
    (await cookies()).set(TWO_FACTOR_COOKIE, await signTwoFactorToken(user.id), cookieOptions(TWO_FACTOR_TTL_SECONDS));
    return { ...echo, needsTotp: true };
  }
  await completeLogin(user, input.next, ipKey, device);
  return {};
}

const totpSchema = z.object({ code: z.string().trim().min(6).max(20), next: z.string().max(500).optional() });

/** Druhý krok přihlášení: kód z aplikace Authenticator nebo záložní kód. */
export async function verifyTwoFactorLogin(_state: LoginState, formData: FormData): Promise<LoginState> {
  const input = totpSchema.safeParse({ code: formData.get("code") ?? "", next: formData.get("next") || undefined });
  const store = await cookies();
  const userId = await verifyTwoFactorToken(store.get(TWO_FACTOR_COOKIE)?.value);
  if (!userId) return { error: "Přihlášení vypršelo – zadejte znovu e-mail a heslo." };
  const next = input.success ? input.data.next : undefined;
  if (!input.success) return { needsTotp: true, next, error: "Zadejte šestimístný kód z aplikace nebo záložní kód." };
  const user = await prisma.user.findFirst({ where: { id: userId, accountType: { not: null }, disabledAt: null } });
  if (!user) return { error: "Přihlášení vypršelo – zadejte znovu e-mail a heslo." };
  const { ipKey, device } = await requestMeta();
  const lock = await loginLock(prisma, { email: user.email, ipKey });
  if (lock) return { needsTotp: true, next, error: `Příliš mnoho neúspěšných pokusů. Zkuste to znovu za ${lock.minutes} min.` };
  if (!(await verifySecondFactor(prisma, user.id, input.data.code))) {
    await recordSecurityEvent(prisma, { kind: "TOTP_FAILED", userId: user.id, companyId: user.companyId, email: user.email, ipKey });
    return { needsTotp: true, next, error: "Kód nesouhlasí – zkuste aktuální kód z aplikace." };
  }
  await completeLogin(user, next, ipKey, device);
  return {};
}

/** Zpět na zadání hesla (zruší čekající druhý krok). */
export async function cancelTwoFactorLogin() {
  (await cookies()).delete(TWO_FACTOR_COOKIE);
  redirect("/login");
}

/** Odhlásit (Zamknout): zruší relaci na serveru i cookie; účet a závod zůstávají zapamatované. */
export async function logout() {
  const store = await cookies();
  const token = await verifyAuthToken(store.get(AUTH_COOKIE)?.value);
  if (token) {
    const { userId, sessionId } = parseSubject(token.userId);
    if (sessionId) {
      await revokeSessions(prisma, { userId, sessionId });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, email: true } });
      await recordSecurityEvent(prisma, { kind: "LOGOUT", userId, companyId: user?.companyId, email: user?.email });
    }
  }
  store.delete(AUTH_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------------------
//  Zapomenuté heslo a nastavení hesla z odkazu
// ---------------------------------------------------------------------------

export interface ResetRequestState {
  done?: boolean;
  error?: string;
}

/** Žádost o obnovu hesla – odpověď je vždy stejná (nejde zjistit, zda e-mail existuje). */
export async function requestPasswordResetAction(_state: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = z.string().trim().email().max(200).safeParse(formData.get("email") ?? "");
  if (!email.success) return { error: "Zadejte e-mail, kterým se přihlašujete." };
  const { ipKey } = await requestMeta();
  const result = await requestPasswordReset(prisma, { email: email.data, ipKey });
  if (result) {
    const link = passwordLinkUrl(result.token);
    const sent = await sendPasswordLink({ email: result.user.email, name: result.user.name, link, kind: "RESET", validity: "1 hodinu" });
    // Bez ELDOCK_SMTP_URL jen do logu serveru (stejně jako potvrzení newsletteru); správce firmy umí odkaz vytvořit sám.
    if (!sent) console.info(`[eldock] Obnova hesla (bez SMTP) pro ${result.user.email}: ${link}`);
  }
  return { done: true };
}

export interface SetPasswordState {
  error?: string;
}

const setPasswordSchema = z.object({ token: z.string().min(20).max(100), password: z.string().max(200), confirm: z.string().max(200) });

/** Nastaví heslo z pozvánky / obnovy; bez dvoufázového ověření rovnou přihlásí. */
export async function setPasswordAction(_state: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const input = setPasswordSchema.safeParse({ token: formData.get("token") ?? "", password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!input.success) return { error: "Vyplňte nové heslo do obou polí." };
  if (input.data.password !== input.data.confirm) return { error: "Hesla se neshodují." };
  let user: Awaited<ReturnType<typeof setPasswordFromLink>>;
  try {
    user = await setPasswordFromLink(prisma, { token: input.data.token, password: input.data.password });
  } catch (error) {
    if (error instanceof WorkflowError) return { error: error.message };
    console.error(error);
    return { error: "Heslo se nepodařilo nastavit. Zkuste to prosím znovu." };
  }
  if (user.totpEnabledAt) redirect("/login?heslo=nastaveno");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const { ipKey, device } = await requestMeta();
  await completeLogin(full, APP_HOME, ipKey, device);
  return {};
}
