// Fáze 67: účty zaměstnanců registrovaných firem – ověření přihlášení, relace na serveru, odkazy na nastavení hesla,
// limit neúspěšných pokusů, bezpečnostní deník, správa zaměstnanců a dvoufázové ověření (TOTP).
// Služby dostávají `prisma` jako parametr (testy nad SQLite). Záměrně bez `server-only`.
import { createHash, createHmac, randomBytes } from "node:crypto";

import type { AuthTokenKind, SecurityEventKind } from "@/generated/prisma/enums";
import type { PrismaClient, User } from "@/generated/prisma/client";
import { AUTH_TTL_SECONDS, authSecret, checkAccessPassword } from "@/lib/auth";
import { passwordIssues } from "@/lib/password-policy";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { hashPassword, verifyPassword } from "@/server/password";
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpUri, verifyTotp } from "@/server/totp";

export const SESSION_TTL_MS = AUTH_TTL_SECONDS * 1000;
/** Okno limitu pokusů a délka zablokování. */
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;
/** Obnova zapomenutého hesla: nejvýš 3 žádosti na e-mail za hodinu. */
export const MAX_RESETS_PER_HOUR = 3;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const LINK_TTL_MS: Record<AuthTokenKind, number> = { INVITE: 7 * 24 * HOUR_MS, RESET: HOUR_MS };
/** Odkaz na obnovu hesla, který vytvoří správce firmy (předá ho zaměstnanci osobně). */
export const ADMIN_RESET_TTL_MS = 24 * HOUR_MS;

/** Neexistující účet: stejně drahé ověření hesla jako u skutečného (časem nejde zjistit, zda e-mail existuje). */
const DUMMY_HASH = `scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA==$${Buffer.alloc(64, 65).toString("base64")}`;
const FAILURE_KINDS: SecurityEventKind[] = ["LOGIN_FAILED", "TOTP_FAILED"];

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** IP adresa jen jako HMAC – limit pokusů bez ukládání adresy. */
export const ipKeyOf = (ip: string | null | undefined) => (ip ? createHmac("sha256", `${authSecret()}:ip`).update(ip).digest("hex").slice(0, 32) : null);

/** Popis zařízení z User-Agent bez verzí („Chrome · Windows“). */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Prohlížeč";
  const system = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iPod/.test(userAgent)
        ? "iOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "jiný systém";
  return `${browser} · ${system}`;
}

export interface SecurityEventInput {
  kind: SecurityEventKind;
  userId?: string | null;
  companyId?: string | null;
  actorId?: string | null;
  email?: string | null;
  ipKey?: string | null;
  detail?: string | null;
}

export function recordSecurityEvent(prisma: PrismaClient, event: SecurityEventInput, now: Date = new Date()) {
  return prisma.securityEvent.create({
    data: {
      kind: event.kind,
      userId: event.userId ?? null,
      companyId: event.companyId ?? null,
      actorId: event.actorId ?? null,
      email: event.email ? normalizeEmail(event.email) : null,
      ipKey: event.ipKey ?? null,
      detail: event.detail?.slice(0, 300) ?? null,
      createdAt: now,
    },
  });
}

// ---------------------------------------------------------------------------
//  Přihlášení a limit pokusů
// ---------------------------------------------------------------------------

/**
 * Zablokování po opakovaných chybách: 5 neúspěšných pokusů na e-mail (od posledního úspěšného přihlášení)
 * nebo 20 na IP během 15 minut → další pokus až po uplynutí okna. Vrací minuty do odblokování, jinak `null`.
 */
export async function loginLock(prisma: PrismaClient, input: { email?: string | null; ipKey?: string | null }, now: Date = new Date()) {
  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS);
  const email = input.email ? normalizeEmail(input.email) : null;
  const lastOk = email
    ? await prisma.securityEvent.findFirst({ where: { kind: "LOGIN_OK", email, createdAt: { gte: windowStart } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
    : null;
  const since = lastOk && lastOk.createdAt > windowStart ? lastOk.createdAt : windowStart;
  const [byEmail, byIp] = await Promise.all([
    email ? prisma.securityEvent.findMany({ where: { kind: { in: FAILURE_KINDS }, email, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }) : [],
    input.ipKey
      ? prisma.securityEvent.findMany({ where: { kind: { in: FAILURE_KINDS }, ipKey: input.ipKey, createdAt: { gt: windowStart } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
      : [],
  ]);
  const blocking = byEmail.length >= MAX_FAILURES_PER_EMAIL ? byEmail[byEmail.length - MAX_FAILURES_PER_EMAIL] : byIp.length >= MAX_FAILURES_PER_IP ? byIp[byIp.length - MAX_FAILURES_PER_IP] : null;
  if (!blocking) return null;
  return { minutes: Math.max(1, Math.ceil((blocking.createdAt.getTime() + LOCK_WINDOW_MS - now.getTime()) / 60_000)) };
}

export interface CredentialsInput {
  email?: string | null;
  accountId?: string | null;
  password: string;
}

/**
 * Ověří přihlašovací údaje: uživatel registrované firmy vlastním heslem (ne zablokovaný, s nastaveným heslem), demo účet
 * (bez firmy) sdíleným heslem obchodního dema. `candidate` = nalezený účet (i při chybném hesle – pro deník a limit).
 */
export async function verifyCredentials(prisma: PrismaClient, input: CredentialsInput): Promise<{ user: User | null; candidate: User | null }> {
  const candidate = input.email
    ? await prisma.user.findFirst({ where: { email: normalizeEmail(input.email), accountType: { not: null } } })
    : input.accountId
      ? await prisma.user.findFirst({ where: { id: input.accountId, accountType: { not: null } } })
      : null;
  if (!candidate || (candidate.companyId && (candidate.disabledAt || !candidate.passwordHash))) {
    await verifyPassword(input.password, DUMMY_HASH);
    return { user: null, candidate };
  }
  const ok = candidate.companyId ? await verifyPassword(input.password, candidate.passwordHash!) : await checkAccessPassword(input.password);
  return { user: ok ? candidate : null, candidate };
}

// ---------------------------------------------------------------------------
//  Relace
// ---------------------------------------------------------------------------

export function createUserSession(prisma: PrismaClient, userId: string, device: string | null, now: Date = new Date()) {
  return prisma.userSession.create({ data: { userId, device: device?.slice(0, 80) ?? null, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } });
}

/** Platná relace a její (nezablokovaný) uživatel; prošlá nebo zrušená → `null`. „Naposledy aktivní“ nejvýš 1× za 5 min. */
export async function activeSession(prisma: PrismaClient, input: { userId: string; sessionId: string }, now: Date = new Date()) {
  const session = await prisma.userSession.findFirst({ where: { id: input.sessionId, userId: input.userId, revokedAt: null, expiresAt: { gt: now } }, include: { user: true } });
  if (!session || session.user.disabledAt || !session.user.accountType) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  return session;
}

/** Zruší relace uživatele (jednu, všechny, nebo všechny kromě aktuální); vrací počet. */
export async function revokeSessions(prisma: PrismaClient, input: { userId: string; sessionId?: string; exceptSessionId?: string | null }, now: Date = new Date()) {
  const result = await prisma.userSession.updateMany({
    where: { userId: input.userId, revokedAt: null, ...(input.sessionId ? { id: input.sessionId } : {}), ...(input.exceptSessionId ? { id: { not: input.exceptSessionId } } : {}) },
    data: { revokedAt: now },
  });
  return result.count;
}

export function listActiveSessions(prisma: PrismaClient, userId: string, now: Date = new Date()) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, device: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
}

// ---------------------------------------------------------------------------
//  Odkazy na nastavení hesla (pozvánka, obnova)
// ---------------------------------------------------------------------------

/** Nový jednorázový odkaz (starší nepoužité odkazy uživatele zneplatní). Vrací token do odkazu – v DB jen jeho SHA-256. */
export async function issuePasswordLink(prisma: PrismaClient, input: { userId: string; kind: AuthTokenKind; createdById?: string | null; ttlMs?: number }, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + (input.ttlMs ?? LINK_TTL_MS[input.kind]));
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId: input.userId, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({ data: { userId: input.userId, kind: input.kind, tokenHash: tokenHash(token), expiresAt, createdById: input.createdById ?? null, createdAt: now } }),
  ]);
  return { token, expiresAt };
}

/** Platný odkaz (nepoužitý, neprošlý, uživatel registrované firmy a nezablokovaný), jinak `null`. */
export async function findPasswordLink(prisma: PrismaClient, token: string, now: Date = new Date()) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const link = await prisma.authToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: { id: true, name: true, email: true, companyId: true, disabledAt: true, totpEnabledAt: true } } },
  });
  if (!link || link.usedAt || link.expiresAt <= now || link.user.disabledAt || !link.user.companyId) return null;
  return link;
}

/** Nastaví heslo z odkazu: odkaz se spotřebuje, ostatní odkazy i relace uživatele se zruší. */
export async function setPasswordFromLink(prisma: PrismaClient, input: { token: string; password: string }, now: Date = new Date()) {
  const link = await findPasswordLink(prisma, input.token, now);
  if (!link) throw new WorkflowError("NOT_FOUND", "Odkaz vypršel nebo už byl použit – požádejte o nový.");
  const issues = passwordIssues(input.password, link.user);
  if (issues.length) throw new WorkflowError("VALIDATION", issues[0]);
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: link.userId }, data: { passwordHash, passwordChangedAt: now, mustChangePassword: false } }),
    prisma.authToken.updateMany({ where: { userId: link.userId, usedAt: null }, data: { usedAt: now } }),
    prisma.userSession.updateMany({ where: { userId: link.userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.securityEvent.create({
      data: { kind: "PASSWORD_SET", userId: link.userId, companyId: link.user.companyId, email: link.user.email, detail: link.kind === "INVITE" ? "z pozvánky" : "z odkazu na obnovu", createdAt: now },
    }),
  ]);
  return link.user;
}

/** Žádost o obnovu hesla: odkaz jen pro aktivní účet registrované firmy a nejvýš 3× za hodinu; jinak `null` (stejná odpověď). */
export async function requestPasswordReset(prisma: PrismaClient, input: { email: string; ipKey?: string | null }, now: Date = new Date()) {
  const email = normalizeEmail(input.email);
  const [recent, user] = await Promise.all([
    prisma.securityEvent.count({ where: { kind: "RESET_REQUESTED", email, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } }),
    prisma.user.findFirst({ where: { email, companyId: { not: null }, disabledAt: null, accountType: { not: null } }, select: { id: true, name: true, email: true, companyId: true } }),
  ]);
  const limited = recent >= MAX_RESETS_PER_HOUR;
  await recordSecurityEvent(prisma, { kind: "RESET_REQUESTED", email, ipKey: input.ipKey, userId: user?.id, companyId: user?.companyId, detail: !user ? "neznámý e-mail" : limited ? "limit žádostí" : null }, now);
  if (!user || limited) return null;
  return { user, ...(await issuePasswordLink(prisma, { userId: user.id, kind: "RESET" }, now)) };
}

/** Změna hesla přihlášeným uživatelem: ověří současné heslo, ostatní relace se odhlásí. */
export async function changePassword(prisma: PrismaClient, input: { userId: string; sessionId?: string | null; current: string; next: string }, now: Date = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user?.companyId || !user.passwordHash) throw new WorkflowError("FORBIDDEN", "Účty obchodního dema mají společné heslo – mění ho správce serveru.");
  if (!(await verifyPassword(input.current, user.passwordHash))) throw new WorkflowError("VALIDATION", "Současné heslo nesouhlasí.");
  if (input.current === input.next) throw new WorkflowError("VALIDATION", "Nové heslo se musí lišit od současného.");
  const issues = passwordIssues(input.next, user);
  if (issues.length) throw new WorkflowError("VALIDATION", issues[0]);
  const passwordHash = await hashPassword(input.next);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now, mustChangePassword: false } });
  const revoked = await revokeSessions(prisma, { userId: user.id, exceptSessionId: input.sessionId ?? null }, now);
  await recordSecurityEvent(prisma, { kind: "PASSWORD_CHANGED", userId: user.id, companyId: user.companyId, actorId: user.id, email: user.email, detail: revoked ? `odhlášeno ${revoked} dalších zařízení` : null }, now);
  return { revoked };
}

// ---------------------------------------------------------------------------
//  Správa zaměstnanců (správce registrované firmy)
// ---------------------------------------------------------------------------

export interface Actor {
  id: string;
  companyId: string | null;
}

async function companyMember(prisma: PrismaClient, actor: Actor, userId: string) {
  if (!actor.companyId) throw new WorkflowError("FORBIDDEN", "Účty obchodního dema se přihlašují společným heslem – pozvánky a blokace jsou jen pro registrované firmy.");
  const user = await prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId, accountType: { not: null } } });
  if (!user) throw new WorkflowError("NOT_FOUND", "Účet nebyl nalezen.");
  return user;
}

/** Odkaz pro zaměstnance: bez hesla pozvánka (7 dní), s heslem obnova (24 h). */
export async function adminPasswordLink(prisma: PrismaClient, actor: Actor, userId: string, now: Date = new Date()) {
  const user = await companyMember(prisma, actor, userId);
  if (user.disabledAt) throw new WorkflowError("INVALID_STATE", "Účet je zablokovaný – nejdřív ho odblokujte.");
  const kind: AuthTokenKind = user.passwordHash ? "RESET" : "INVITE";
  const link = await issuePasswordLink(prisma, { userId: user.id, kind, createdById: actor.id, ttlMs: kind === "RESET" ? ADMIN_RESET_TTL_MS : undefined }, now);
  await recordSecurityEvent(prisma, { kind: kind === "INVITE" ? "INVITE_CREATED" : "RESET_REQUESTED", userId: user.id, companyId: user.companyId, actorId: actor.id, email: user.email, detail: "odkaz od správce" }, now);
  return { ...link, kind, user: { id: user.id, name: user.name, email: user.email } };
}

/** Zablokuje / odblokuje zaměstnance; blokace zruší jeho relace a odkazy. Sám sebe správce zablokovat nemůže. */
export async function setUserDisabled(prisma: PrismaClient, actor: Actor, userId: string, disabled: boolean, now: Date = new Date()) {
  if (userId === actor.id) throw new WorkflowError("VALIDATION", "Vlastní účet zablokovat nelze.");
  const user = await companyMember(prisma, actor, userId);
  await prisma.user.update({ where: { id: user.id }, data: { disabledAt: disabled ? now : null } });
  if (disabled) {
    await revokeSessions(prisma, { userId: user.id }, now);
    await prisma.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  }
  await recordSecurityEvent(prisma, { kind: disabled ? "USER_DISABLED" : "USER_ENABLED", userId: user.id, companyId: user.companyId, actorId: actor.id, email: user.email }, now);
}

/** Odhlásí zaměstnance ze všech zařízení. */
export async function adminRevokeSessions(prisma: PrismaClient, actor: Actor, userId: string, now: Date = new Date()) {
  const user = await companyMember(prisma, actor, userId);
  const count = await revokeSessions(prisma, { userId: user.id }, now);
  await recordSecurityEvent(prisma, { kind: "SESSION_REVOKED", userId: user.id, companyId: user.companyId, actorId: actor.id, email: user.email, detail: `zrušeno relací: ${count}` }, now);
  return count;
}

/** Bezpečnostní deník firmy (nejnovější nahoře). */
export function companySecurityLog(prisma: PrismaClient, companyId: string, take = 50) {
  return prisma.securityEvent.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take, select: { id: true, kind: true, userId: true, actorId: true, email: true, detail: true, createdAt: true } });
}

// ---------------------------------------------------------------------------
//  Dvoufázové ověření (TOTP)
// ---------------------------------------------------------------------------

async function totpUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) throw new WorkflowError("FORBIDDEN", "Dvoufázové ověření je pro účty registrovaných firem.");
  return user;
}

/** Začne spárování: nové tajemství (zatím nezapnuté) a odkaz `otpauth://` pro QR kód. */
export async function startTotpSetup(prisma: PrismaClient, userId: string) {
  const user = await totpUser(prisma, userId);
  if (user.totpEnabledAt) throw new WorkflowError("INVALID_STATE", "Dvoufázové ověření už je zapnuté.");
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptTotpSecret(secret), totpEnabledAt: null, totpRecoveryJson: null } });
  return { secret, uri: totpUri({ secret, account: user.email }) };
}

/** Dokončí spárování kódem z aplikace; vrací 8 záložních kódů (zobrazí se jen jednou). */
export async function confirmTotpSetup(prisma: PrismaClient, userId: string, code: string, now: Date = new Date()) {
  const user = await totpUser(prisma, userId);
  if (user.totpEnabledAt) throw new WorkflowError("INVALID_STATE", "Dvoufázové ověření už je zapnuté.");
  const secret = decryptTotpSecret(user.totpSecret);
  if (!secret) throw new WorkflowError("INVALID_STATE", "Spárování vypršelo – začněte znovu.");
  if (!verifyTotp(secret, code, now.getTime())) throw new WorkflowError("VALIDATION", "Kód nesouhlasí – zkontrolujte, že má telefon správný čas.");
  const codes = generateRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: now, totpRecoveryJson: JSON.stringify(codes.map(hashRecoveryCode)) } });
  await recordSecurityEvent(prisma, { kind: "TOTP_ENABLED", userId: user.id, companyId: user.companyId, actorId: user.id, email: user.email }, now);
  return codes;
}

/** Druhý krok přihlášení: kód z aplikace, nebo záložní kód (spotřebuje se). */
export async function verifySecondFactor(prisma: PrismaClient, userId: string, code: string, now: Date = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabledAt || user.disabledAt) return false;
  const secret = decryptTotpSecret(user.totpSecret);
  if (secret && verifyTotp(secret, code, now.getTime())) return true;
  const hashes: string[] = (() => {
    try {
      const parsed: unknown = JSON.parse(user.totpRecoveryJson ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  })();
  const index = hashes.indexOf(hashRecoveryCode(code));
  if (index < 0) return false;
  hashes.splice(index, 1);
  await prisma.user.update({ where: { id: user.id }, data: { totpRecoveryJson: JSON.stringify(hashes) } });
  return true;
}

/** Vypne dvoufázové ověření (po ověření hesla). */
export async function disableTotp(prisma: PrismaClient, userId: string, password: string, now: Date = new Date()) {
  const user = await totpUser(prisma, userId);
  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new WorkflowError("VALIDATION", "Heslo nesouhlasí.");
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpRecoveryJson: null } });
  await recordSecurityEvent(prisma, { kind: "TOTP_DISABLED", userId: user.id, companyId: user.companyId, actorId: user.id, email: user.email }, now);
}

/** Počet zbývajících záložních kódů. */
export function recoveryCodesLeft(user: Pick<User, "totpRecoveryJson">) {
  try {
    const parsed: unknown = JSON.parse(user.totpRecoveryJson ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
