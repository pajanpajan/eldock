import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { accessPassword } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/server/password";
import { totpCode } from "@/server/totp";

import {
  ADMIN_RESET_TTL_MS,
  activeSession,
  adminPasswordLink,
  adminRevokeSessions,
  changePassword,
  confirmTotpSetup,
  createUserSession,
  disableTotp,
  findPasswordLink,
  issuePasswordLink,
  loginLock,
  recordSecurityEvent,
  requestPasswordReset,
  revokeSessions,
  setPasswordFromLink,
  setUserDisabled,
  startTotpSetup,
  verifyCredentials,
  verifySecondFactor,
} from "./account-security";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 67 nad SQLite: přihlášení, limit pokusů, relace, odkazy na heslo, správa zaměstnanců, TOTP a převzetí hesla firmy.

const NOW = new Date("2026-11-08T10:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const OWNER_PASSWORD = "modry-kocour-2026";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  const companyHash = await hashPassword(OWNER_PASSWORD);
  await prisma.registeredCompany.create({
    data: { id: "co", productScope: "PLANT_MANAGEMENT", ico: "27074358", companyName: "Strojírny Test s.r.o.", street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: "Karel Majitel", email: "majitel@strojirny.example", phone: "+420 600 000 000", passwordHash: companyHash, termsAcceptedAt: NOW, plantId: "p" },
  });
  await prisma.registeredCompany.create({
    data: { id: "co2", productScope: "PLANT_MANAGEMENT", ico: "12345679", companyName: "Jiná firma a.s.", street: "Hlavní 2", city: "Brno", zip: "602 00", contactName: "Jan Jiný", email: "jiny@firma.example", phone: "+420 600 000 001", passwordHash: companyHash, termsAcceptedAt: NOW },
  });
  await prisma.user.createMany({
    data: [
      { id: "owner", name: "Karel Majitel", email: "majitel@strojirny.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "co", homePlantId: "p", passwordHash: companyHash },
      { id: "tech", name: "Petr Technik", email: "technik@strojirny.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "co", homePlantId: "p" },
      { id: "foreign", name: "Jan Jiný", email: "jiny@firma.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "co2" },
      { id: "demo", name: "Demo Ředitel", email: "demo@eldock.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN" },
    ],
  });
});
afterEach(async () => db.cleanup());

const owner = { id: "owner", companyId: "co" };

describe("přihlášení a limit pokusů", () => {
  it("firma vlastním heslem, demo heslem dema; zablokovaný účet ani účet bez hesla se nepřihlásí", async () => {
    expect((await verifyCredentials(prisma, { email: " Majitel@Strojirny.example ", password: OWNER_PASSWORD })).user?.id).toBe("owner");
    expect((await verifyCredentials(prisma, { email: "majitel@strojirny.example", password: accessPassword() })).user).toBeNull();
    expect((await verifyCredentials(prisma, { accountId: "demo", password: accessPassword() })).user?.id).toBe("demo");
    // Uživatel firmy nejde přihlásit heslem dema ani výběrem dlaždice
    expect((await verifyCredentials(prisma, { accountId: "owner", password: accessPassword() })).user).toBeNull();
    // Bez hesla (čeká na pozvánku) a neznámý e-mail – stejný výsledek
    expect(await verifyCredentials(prisma, { email: "technik@strojirny.example", password: "cokoli-dlouhe-heslo" })).toMatchObject({ user: null, candidate: { id: "tech" } });
    expect(await verifyCredentials(prisma, { email: "nikdo@nikde.example", password: "cokoli-dlouhe-heslo" })).toEqual({ user: null, candidate: null });
    await prisma.user.update({ where: { id: "owner" }, data: { disabledAt: NOW } });
    expect((await verifyCredentials(prisma, { email: "majitel@strojirny.example", password: OWNER_PASSWORD })).user).toBeNull();
  });

  it("5 chyb na e-mail za 15 minut zablokuje, úspěšné přihlášení počítadlo vynuluje, 20 chyb na IP", async () => {
    for (let index = 0; index < 4; index++) await recordSecurityEvent(prisma, { kind: "LOGIN_FAILED", email: "majitel@strojirny.example", ipKey: "ip-a" }, later(index));
    expect(await loginLock(prisma, { email: "majitel@strojirny.example", ipKey: "ip-a" }, later(5))).toBeNull();
    await recordSecurityEvent(prisma, { kind: "TOTP_FAILED", email: "majitel@strojirny.example", ipKey: "ip-a" }, later(5));
    expect(await loginLock(prisma, { email: "MAJITEL@strojirny.example" }, later(6))).toEqual({ minutes: 9 });
    expect(await loginLock(prisma, { email: "majitel@strojirny.example" }, later(16))).toBeNull();
    // Úspěch po chybách – další chyby se počítají od něj
    await recordSecurityEvent(prisma, { kind: "LOGIN_OK", email: "majitel@strojirny.example" }, later(6));
    expect(await loginLock(prisma, { email: "majitel@strojirny.example" }, later(7))).toBeNull();
    for (let index = 0; index < 20; index++) await recordSecurityEvent(prisma, { kind: "LOGIN_FAILED", email: `x${index}@spam.example`, ipKey: "ip-b" }, later(10));
    expect(await loginLock(prisma, { email: "novy@spam.example", ipKey: "ip-b" }, later(11))).toEqual({ minutes: 14 });
  });
});

describe("relace", () => {
  it("platná relace, zrušení, vypršení a zablokovaný uživatel", async () => {
    const session = await createUserSession(prisma, "owner", "Chrome · Windows", NOW);
    const other = await createUserSession(prisma, "owner", "Safari · iOS", NOW);
    expect((await activeSession(prisma, { userId: "owner", sessionId: session.id }, later(1)))?.user.id).toBe("owner");
    expect(await activeSession(prisma, { userId: "tech", sessionId: session.id }, later(1))).toBeNull();
    expect(await activeSession(prisma, { userId: "owner", sessionId: session.id }, later(13 * 60))).toBeNull();
    // „Naposledy aktivní“ se obnoví nejvýš 1× za 5 minut
    await activeSession(prisma, { userId: "owner", sessionId: session.id }, later(10));
    expect((await prisma.userSession.findUniqueOrThrow({ where: { id: session.id } })).lastSeenAt).toEqual(later(10));
    expect(await revokeSessions(prisma, { userId: "owner", exceptSessionId: session.id }, later(11))).toBe(1);
    expect(await activeSession(prisma, { userId: "owner", sessionId: other.id }, later(12))).toBeNull();
    await prisma.user.update({ where: { id: "owner" }, data: { disabledAt: later(12) } });
    expect(await activeSession(prisma, { userId: "owner", sessionId: session.id }, later(13))).toBeNull();
  });
});

describe("odkazy na nastavení hesla", () => {
  it("pozvánka nastaví heslo, spotřebuje se, odhlásí zařízení; starší odkaz neplatí", async () => {
    const first = await issuePasswordLink(prisma, { userId: "tech", kind: "INVITE", createdById: "owner" }, NOW);
    const second = await issuePasswordLink(prisma, { userId: "tech", kind: "INVITE", createdById: "owner" }, later(1));
    expect(await findPasswordLink(prisma, first.token, later(2))).toBeNull();
    expect((await findPasswordLink(prisma, second.token, later(2)))?.user.email).toBe("technik@strojirny.example");
    expect(second.expiresAt).toEqual(new Date(later(1).getTime() + 7 * 24 * 3600 * 1000));
    await expect(setPasswordFromLink(prisma, { token: second.token, password: "kratke" }, later(3))).rejects.toThrow(/10 znaků/);
    await expect(setPasswordFromLink(prisma, { token: second.token, password: "petr-na-horach-2026" }, later(3))).rejects.toThrow(/jméno/);
    const session = await createUserSession(prisma, "tech", null, later(3));
    await setPasswordFromLink(prisma, { token: second.token, password: "zeleny-vlak-jede-rano" }, later(4));
    const tech = await prisma.user.findUniqueOrThrow({ where: { id: "tech" } });
    expect(await verifyPassword("zeleny-vlak-jede-rano", tech.passwordHash!)).toBe(true);
    expect(tech).toMatchObject({ mustChangePassword: false, passwordChangedAt: later(4) });
    expect(await activeSession(prisma, { userId: "tech", sessionId: session.id }, later(5))).toBeNull();
    await expect(setPasswordFromLink(prisma, { token: second.token, password: "jiny-zeleny-vlak-2026" }, later(5))).rejects.toThrow(/vypršel/);
    expect(await prisma.securityEvent.count({ where: { kind: "PASSWORD_SET", userId: "tech" } })).toBe(1);
  });

  it("obnova hesla: jen aktivní účet firmy, nejvýš 3× za hodinu, prošlý odkaz neplatí", async () => {
    expect(await requestPasswordReset(prisma, { email: "nikdo@nikde.example" }, NOW)).toBeNull();
    expect(await requestPasswordReset(prisma, { email: "demo@eldock.example" }, NOW)).toBeNull();
    const reset = await requestPasswordReset(prisma, { email: "majitel@strojirny.example", ipKey: "ip-a" }, NOW);
    expect(reset?.user.id).toBe("owner");
    expect(await findPasswordLink(prisma, reset!.token, later(61))).toBeNull();
    await requestPasswordReset(prisma, { email: "majitel@strojirny.example" }, later(1));
    await requestPasswordReset(prisma, { email: "majitel@strojirny.example" }, later(2));
    expect(await requestPasswordReset(prisma, { email: "majitel@strojirny.example" }, later(3))).toBeNull();
    expect(await prisma.securityEvent.count({ where: { kind: "RESET_REQUESTED", email: "majitel@strojirny.example" } })).toBe(4);
  });

  it("změna hesla ověří současné, odhlásí ostatní zařízení, demo účet nemění", async () => {
    const current = await createUserSession(prisma, "owner", null, NOW);
    const other = await createUserSession(prisma, "owner", null, NOW);
    await expect(changePassword(prisma, { userId: "owner", sessionId: current.id, current: "spatne-heslo-2026", next: "novy-modry-kocour" }, NOW)).rejects.toThrow(/Současné heslo/);
    await expect(changePassword(prisma, { userId: "owner", sessionId: current.id, current: OWNER_PASSWORD, next: OWNER_PASSWORD }, NOW)).rejects.toThrow(/lišit/);
    expect(await changePassword(prisma, { userId: "owner", sessionId: current.id, current: OWNER_PASSWORD, next: "novy-modry-kocour" }, NOW)).toEqual({ revoked: 1 });
    expect(await activeSession(prisma, { userId: "owner", sessionId: current.id }, later(1))).not.toBeNull();
    expect(await activeSession(prisma, { userId: "owner", sessionId: other.id }, later(1))).toBeNull();
    await expect(changePassword(prisma, { userId: "demo", current: accessPassword(), next: "novy-modry-kocour" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("správa zaměstnanců", () => {
  it("odkaz od správce: pozvánka bez hesla, obnova na 24 h s heslem; cizí firma a demo nesmí", async () => {
    expect((await adminPasswordLink(prisma, owner, "tech", NOW)).kind).toBe("INVITE");
    const reset = await adminPasswordLink(prisma, owner, "owner", NOW);
    expect(reset).toMatchObject({ kind: "RESET", expiresAt: new Date(NOW.getTime() + ADMIN_RESET_TTL_MS) });
    await expect(adminPasswordLink(prisma, owner, "foreign", NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(adminPasswordLink(prisma, { id: "demo", companyId: null }, "tech", NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blokace odhlásí zaměstnance a zneplatní odkazy; sám sebe správce nezablokuje", async () => {
    await prisma.user.update({ where: { id: "tech" }, data: { passwordHash: await hashPassword("zeleny-vlak-jede-rano") } });
    const session = await createUserSession(prisma, "tech", null, NOW);
    const link = await issuePasswordLink(prisma, { userId: "tech", kind: "RESET" }, NOW);
    await expect(setUserDisabled(prisma, owner, "owner", true, NOW)).rejects.toThrow(/Vlastní účet/);
    await setUserDisabled(prisma, owner, "tech", true, NOW);
    expect(await activeSession(prisma, { userId: "tech", sessionId: session.id }, later(1))).toBeNull();
    expect(await findPasswordLink(prisma, link.token, later(1))).toBeNull();
    await expect(adminPasswordLink(prisma, owner, "tech", later(1))).rejects.toThrow(/zablokovaný/);
    await setUserDisabled(prisma, owner, "tech", false, later(2));
    expect((await verifyCredentials(prisma, { email: "technik@strojirny.example", password: "zeleny-vlak-jede-rano" })).user?.id).toBe("tech");
    await createUserSession(prisma, "tech", null, later(3));
    expect(await adminRevokeSessions(prisma, owner, "tech", later(4))).toBe(1);
    expect((await prisma.securityEvent.findMany({ where: { companyId: "co" }, orderBy: { createdAt: "asc" } })).map((event) => event.kind)).toEqual(["USER_DISABLED", "USER_ENABLED", "SESSION_REVOKED"]);
  });
});

describe("dvoufázové ověření", () => {
  it("spárování kódem, přihlášení kódem i záložním kódem (jednou), vypnutí jen s heslem", async () => {
    const { secret, uri } = await startTotpSetup(prisma, "owner");
    expect(uri).toContain("majitel%40strojirny.example");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "owner" } })).totpSecret).not.toContain(secret);
    await expect(confirmTotpSetup(prisma, "owner", "000000", NOW)).rejects.toThrow(/Kód nesouhlasí/);
    const codes = await confirmTotpSetup(prisma, "owner", totpCode(secret, NOW.getTime()), NOW);
    expect(codes).toHaveLength(8);
    await expect(startTotpSetup(prisma, "owner")).rejects.toThrow(/už je zapnuté/);
    expect(await verifySecondFactor(prisma, "owner", totpCode(secret, later(1).getTime()), later(1))).toBe(true);
    expect(await verifySecondFactor(prisma, "owner", "123456", later(1))).toBe(false);
    expect(await verifySecondFactor(prisma, "owner", codes[2].toLowerCase(), later(2))).toBe(true);
    expect(await verifySecondFactor(prisma, "owner", codes[2], later(3))).toBe(false);
    await expect(disableTotp(prisma, "owner", "spatne-heslo-2026", later(4))).rejects.toThrow(/Heslo nesouhlasí/);
    await disableTotp(prisma, "owner", OWNER_PASSWORD, later(4));
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "owner" } })).toMatchObject({ totpSecret: null, totpEnabledAt: null });
    await expect(startTotpSetup(prisma, "demo")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("migrace phase67_accounts_security – převzetí hesla firmy", () => {
  it("uživatelé firmy převezmou heslo firmy, zakladatel ho nemusí měnit, demo účty a cizí firma beze změny", async () => {
    const folder = readdirSync(path.resolve("prisma", "migrations")).find((name) => name.endsWith("_phase67_accounts_security"))!;
    const sql = readFileSync(path.resolve("prisma", "migrations", folder, "migration.sql"), "utf8");
    const update = sql.slice(sql.indexOf('UPDATE "User"')).trim().replace(/;\s*$/, "");
    await prisma.user.updateMany({ where: { id: { in: ["owner", "foreign"] } }, data: { passwordHash: null } });
    await prisma.$executeRawUnsafe(update);
    const users = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: ["owner", "tech", "foreign", "demo"] } } })).map((user) => [user.id, user]));
    const company = await prisma.registeredCompany.findUniqueOrThrow({ where: { id: "co" } });
    expect(users.owner).toMatchObject({ passwordHash: company.passwordHash, mustChangePassword: false });
    expect(users.tech).toMatchObject({ passwordHash: company.passwordHash, mustChangePassword: true });
    expect(users.foreign.passwordHash).toBe((await prisma.registeredCompany.findUniqueOrThrow({ where: { id: "co2" } })).passwordHash);
    expect(users.demo.passwordHash).toBeNull();
    expect(await verifyPassword(OWNER_PASSWORD, users.tech.passwordHash!)).toBe(true);
  });
});
