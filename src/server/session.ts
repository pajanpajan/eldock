import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCOUNT_TYPES, canSeeType, can, equipmentScope, visibleTypes, type Permission } from "@/lib/accounts";
import { AUTH_COOKIE, companyIdOf, isAccountSwitcherLocked, isAuthBypassed, parseSubject, verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COOKIE, DEMO_USER_ID, PLANT_COOKIE, ROLE_COOKIE, parseRole, type AppRole } from "@/lib/roles";
import { activeSession } from "@/server/services/account-security";

/**
 * Ověřené přihlášení z cookie `digitry-auth` (fáze 67): podpis a platnost tokenu, u uživatele registrované firmy
 * navíc platná relace na serveru (`UserSession`). `revoked` = token má správný podpis, ale relace byla zrušená,
 * vypršela, účet je zablokovaný nebo jde o starší token firmy bez relace → přihlášení neplatí (zpět na /login).
 */
export const getAuthState = cache(async () => {
  const token = await verifyAuthToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!token || companyIdOf(token)) return { token: null, user: null, sessionId: null, revoked: false };
  const { userId, sessionId } = parseSubject(token.userId);
  if (sessionId) {
    const session = await activeSession(prisma, { userId, sessionId });
    return session ? { token, user: session.user, sessionId, revoked: false } : { token, user: null, sessionId, revoked: true };
  }
  const user = await prisma.user.findFirst({ where: { id: userId, accountType: { not: null } } });
  // Účet registrované firmy se přihlašuje jen s relací – bezstavový token (z doby před fází 67) neplatí.
  if (user?.companyId) return { token, user: null, sessionId: null, revoked: true };
  return { token, user, sessionId: null, revoked: false };
});

/** Přihlášený uživatel z podepsané cookie (bez ohledu na přepínač účtů), pokud existuje. */
export const getSignedInUser = cache(async () => (await getAuthState()).user);

/** Uživatel aktuálního účtu: přihlášený uživatel firmy, jinak cookie přepínače (jen demo účty), jinak výchozí účet role. */
export const getCurrentUser = cache(async () => {
  const state = await getAuthState();
  if (state.revoked) redirect("/login");
  const store = await cookies();
  // Uzamčený přepínač nebo registrovaná firma (fáze 41): účet určuje jen podepsaná přihlašovací cookie.
  const signedIn = state.user;
  if (signedIn && (isAccountSwitcherLocked() || signedIn.companyId)) return signedIn;
  const accountId = store.get(ACCOUNT_COOKIE)?.value;
  if (accountId) {
    // Fáze 67: nepodepsaná cookie přepínače smí vybrat jen demo účet – nikdy uživatele registrované firmy.
    const user = await prisma.user.findFirst({ where: { id: accountId, accountType: { not: null }, companyId: null } });
    if (user) return user;
  }
  return prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID[parseRole(store.get(ROLE_COOKIE)?.value)] } });
});

/** Aktuální účet: typ, definice (oprávnění, výřez) a uživatel. */
export const getCurrentAccount = cache(async () => {
  const user = await getCurrentUser();
  const accountType = user.accountType ?? (user.role === "CAE_ENGINEER" ? "CAE_ENGINEER" : "MAINTENANCE_LEAD");
  const account = { accountType, scopeLayers: user.scopeLayers };
  return {
    ...account,
    user,
    definition: ACCOUNT_TYPES[accountType],
    /** Viditelné typy zařízení (`null` = vše). */
    types: visibleTypes(account),
    /** Prisma filtr výřezu pro `equipment`. */
    scope: equipmentScope(account),
    can: (permission: Permission) => can(account, permission),
    canSee: (type: Parameters<typeof canSeeType>[1]) => canSeeType(account, type),
  };
});

export type CurrentAccount = Awaited<ReturnType<typeof getCurrentAccount>>;

/** Workflow role pro stavový automat (odvozená z typu účtu). */
export const getCurrentRole = cache(async (): Promise<AppRole> => (await getCurrentAccount()).definition.workflowRole);

/** Id naposledy otevřeného závodu (cookie), pokud existuje. */
export const getRememberedPlantId = cache(async (): Promise<string | undefined> => {
  const store = await cookies();
  return store.get(PLANT_COOKIE)?.value;
});

/** Platné přihlášení (při `ELDOCK_BYPASS_AUTH=1` vždy); zrušená relace firmy = nepřihlášen. */
export const getAuthSession = cache(async () => {
  if (isAuthBypassed()) return { userId: "bypass", expires: Number.MAX_SAFE_INTEGER };
  const state = await getAuthState();
  return state.user ? state.token : null;
});
