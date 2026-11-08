import "server-only";

import { prisma } from "@/lib/prisma";
import { getAuthState, getCurrentUser } from "@/server/session";
import { companySecurityLog, listActiveSessions, recoveryCodesLeft } from "@/server/services/account-security";

/**
 * Účty, za které se lze přepnout (přepínač v hlavičce, správa podúčtů). Registrovaná firma vidí jen své
 * účty, obchodní demo jen demo účty bez registrované firmy.
 */
export async function getAccountUsers(options: { demoOnly?: boolean } = {}) {
  const companyId = options.demoOnly ? null : ((await getCurrentUser()).companyId ?? null);
  const users = await prisma.user.findMany({
    where: { accountType: { not: null }, companyId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      company: true,
      accountType: true,
      scopeLayers: true,
      createdAt: true,
      // Fáze 67: stav účtu pro správu zaměstnanců – hash hesla nikdy neopustí server
      passwordHash: true,
      mustChangePassword: true,
      disabledAt: true,
      lastLoginAt: true,
      totpEnabledAt: true,
      _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
    },
  });
  return users.map(({ passwordHash, _count, ...user }) => ({ ...user, hasPassword: Boolean(passwordHash), activeSessions: _count.sessions }));
}

export type AccountUser = Awaited<ReturnType<typeof getAccountUsers>>[number];

/** Bezpečnostní deník firmy přihlášeného správce (jména uživatelů místo id). */
export async function getCompanySecurityLog() {
  const user = await getCurrentUser();
  if (!user.companyId) return [];
  const events = await companySecurityLog(prisma, user.companyId, 60);
  const ids = [...new Set(events.flatMap((event) => [event.userId, event.actorId]).filter((value): value is string => !!value))];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));
  return events.map((event) => ({ ...event, userName: event.userId ? (names.get(event.userId) ?? null) : null, actorName: event.actorId ? (names.get(event.actorId) ?? null) : null }));
}

/** „Můj účet“: přihlášený uživatel firmy, jeho zařízení a stav dvoufázového ověření. */
export async function getMyAccount() {
  const state = await getAuthState();
  const user = state.user;
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    totpEnabledAt: user.totpEnabledAt,
    recoveryCodesLeft: recoveryCodesLeft(user),
    currentSessionId: state.sessionId,
    sessions: user.companyId ? await listActiveSessions(prisma, user.id) : [],
  };
}
