import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import type { MailMessage } from "@/server/mailer";

import { confirmSubscription, purgeStalePending, sendIssue, subscribe, tokenHash, unsubscribe } from "./newsletter";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let outbox: MailMessage[];
const send = async (message: MailMessage) => void outbox.push(message);
const baseUrl = "https://eldock.test";
const tokenFrom = (message: MailMessage) => /potvrzeni\?t=([A-Za-z0-9_-]+)/.exec(message.text)![1];

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  outbox = [];
});
afterEach(() => db.cleanup());

describe("fáze 56 – newsletter s dvojím potvrzením", () => {
  it("přihlášení uloží souhlas a jen otisk tokenu, potvrzení aktivuje odběr, odkaz nejde použít znovu", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(await subscribe(prisma, { email: " Jan@Firma.cz ", audience: "revizni-technik", consent: true }, { send, baseUrl, now })).toEqual({ status: "sent" });
    const row = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: "jan@firma.cz" } });
    expect(row).toMatchObject({ status: "PENDING", audience: "revizni-technik", consentVersion: "1" });
    expect(row.consentText).toMatch(/kdykoli odvolat/);
    const token = tokenFrom(outbox[0]);
    expect(row.confirmTokenHash).toBe(tokenHash(token));
    expect(row.confirmTokenHash).not.toContain(token);

    expect(await confirmSubscription(prisma, token, new Date("2026-11-06T10:00:00Z"))).toEqual({ ok: true, email: "jan@firma.cz" });
    expect(await confirmSubscription(prisma, token)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await subscribe(prisma, { email: "jan@firma.cz", consent: true }, { send, baseUrl })).toEqual({ status: "already" });
  });

  it("opakované přihlášení do 10 minut nepošle další e-mail; po 7 dnech odkaz vyprší", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    await subscribe(prisma, { email: "eva@firma.cz", consent: true }, { send, baseUrl, now });
    expect(await subscribe(prisma, { email: "eva@firma.cz", consent: true }, { send, baseUrl, now: new Date(now.getTime() + 60_000) })).toEqual({ status: "throttled" });
    expect(outbox).toHaveLength(1);
    expect(await confirmSubscription(prisma, tokenFrom(outbox[0]), new Date("2026-11-13T10:00:01Z"))).toMatchObject({ ok: false, reason: "expired" });
  });

  it("bez souhlasu nebo s neplatnou adresou nic neuloží; bez SMTP jen zapíše odkaz do logu", async () => {
    await expect(subscribe(prisma, { email: "x@firma.cz", consent: false }, { send, baseUrl })).rejects.toThrow(/souhlas/);
    await expect(subscribe(prisma, { email: "neplatny", consent: true }, { send, baseUrl })).rejects.toThrow(/platnou/);
    expect(await prisma.newsletterSubscriber.count()).toBe(0);
    expect(await subscribe(prisma, { email: "bez-smtp@firma.cz", consent: true }, { send: null, baseUrl })).toEqual({ status: "logged" });
  });

  it("rozeslání jen potvrzeným (a cílové skupině) s hlavičkou List-Unsubscribe; odhlášení je idempotentní", async () => {
    for (const [email, audience] of [["a@firma.cz", "elektrikar"], ["b@firma.cz", "udrzba"], ["c@firma.cz", "elektrikar"]] as const) {
      await subscribe(prisma, { email, audience, consent: true }, { send, baseUrl });
    }
    await confirmSubscription(prisma, tokenFrom(outbox[0]));
    await confirmSubscription(prisma, tokenFrom(outbox[1]));
    outbox = [];
    const body = "Nové funkce Eldocku za listopad a změny norem.";
    expect(await sendIssue(prisma, { subject: "Novinky – listopad", body, audience: "elektrikar" }, { send, baseUrl })).toMatchObject({ sent: 1, failed: 0 });
    expect(outbox.map((message) => message.to[0])).toEqual(["a@firma.cz"]);
    expect(outbox[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const unsubscribeToken = /odhlaseni\?t=([A-Za-z0-9_-]+)/.exec(outbox[0].text)![1];

    expect(await unsubscribe(prisma, unsubscribeToken)).toMatchObject({ ok: true, email: "a@firma.cz" });
    expect(await unsubscribe(prisma, unsubscribeToken)).toMatchObject({ ok: true });
    outbox = [];
    expect(await sendIssue(prisma, { subject: "Novinky – prosinec", body }, { send, baseUrl })).toMatchObject({ sent: 1 });
    expect(outbox.map((message) => message.to[0])).toEqual(["b@firma.cz"]);
    await expect(sendIssue(prisma, { subject: "Novinky", body }, { send: null, baseUrl })).rejects.toThrow(/SMTP/);
  });

  it("nepotvrzené žádosti starší 30 dní se smažou", async () => {
    await subscribe(prisma, { email: "stara@firma.cz", consent: true }, { send, baseUrl, now: new Date("2026-09-01T10:00:00Z") });
    await prisma.newsletterSubscriber.update({ where: { email: "stara@firma.cz" }, data: { createdAt: new Date("2026-09-01T10:00:00Z") } });
    expect(await purgeStalePending(prisma, new Date("2026-09-20T10:00:00Z"))).toBe(0);
    expect(await purgeStalePending(prisma, new Date("2026-11-05T10:00:00Z"))).toBe(1);
    // úklid běží i při každém přihlášení
    await subscribe(prisma, { email: "stara2@firma.cz", consent: true }, { send, baseUrl, now: new Date("2026-09-01T10:00:00Z") });
    await prisma.newsletterSubscriber.update({ where: { email: "stara2@firma.cz" }, data: { createdAt: new Date("2026-09-01T10:00:00Z") } });
    await subscribe(prisma, { email: "nova@firma.cz", consent: true }, { send, baseUrl, now: new Date("2026-11-05T10:00:00Z") });
    expect(await prisma.newsletterSubscriber.findMany({ select: { email: true } })).toEqual([{ email: "nova@firma.cz" }]);
  });
});
