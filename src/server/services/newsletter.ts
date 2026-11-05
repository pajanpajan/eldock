// Fáze 56: newsletter s dvojím potvrzením (double opt-in), odhlášením jedním kliknutím a rozesíláním vydání.
// Souhlas (text, verze, čas) se ukládá kvůli prokázání (čl. 7 odst. 1 GDPR). Potvrzovací token jen jako SHA-256.

import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "@/lib/legal";
import { confirmationEmail, isAudience, isValidEmail, issueEmail, normalizeEmail } from "@/lib/newsletter";
import { WorkflowError } from "@/lib/workflow/state-machine";
import type { MailTransport } from "@/server/mailer";

export const CONFIRM_TTL_DAYS = 7;
export const PENDING_RETENTION_DAYS = 30;
/** Potvrzovací e-mail na stejnou adresu nejvýš jednou za 10 minut (ochrana proti zahlcení cizí schránky). */
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

const DAY = 86_400_000;
const newToken = () => randomBytes(24).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface NewsletterDeps {
  send: MailTransport | null;
  baseUrl: string;
  now?: Date;
}

/** Nepotvrzené žádosti starší 30 dní se mažou (slib v zásadách ochrany osobních údajů, sekce 7a). */
export async function purgeStalePending(prisma: PrismaClient, now = new Date()) {
  const { count } = await prisma.newsletterSubscriber.deleteMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - PENDING_RETENTION_DAYS * DAY) } } });
  return count;
}

/**
 * Přihlášení k odběru. Navenek vždy stejná odpověď (neprozrazuje, zda adresa už odebírá).
 * `sent` = potvrzení odesláno, `logged` = SMTP chybí (odkaz jen v logu serveru), `throttled` = nedávno odesláno, `already` = už potvrzeno.
 */
export async function subscribe(prisma: PrismaClient, input: { email: string; audience?: string | null; source?: string; consent: boolean }, deps: NewsletterDeps) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new WorkflowError("VALIDATION", "Zadejte platnou e-mailovou adresu.");
  if (!input.consent) throw new WorkflowError("VALIDATION", "Pro odběr je potřeba souhlas se zasíláním novinek.");
  const now = deps.now ?? new Date();
  await purgeStalePending(prisma, now);
  const audience = isAudience(input.audience) ? input.audience : null;
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.status === "CONFIRMED") {
    if (audience && audience !== existing.audience) await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: { audience } });
    return { status: "already" as const };
  }
  if (existing?.status === "PENDING" && existing.confirmSentAt && now.getTime() - existing.confirmSentAt.getTime() < RESEND_COOLDOWN_MS) return { status: "throttled" as const };

  const token = newToken();
  const consent = { consentText: NEWSLETTER_CONSENT_TEXT, consentVersion: NEWSLETTER_CONSENT_VERSION, consentAt: now };
  const data = { ...consent, status: "PENDING" as const, audience, source: (input.source ?? "web").slice(0, 40), confirmTokenHash: tokenHash(token), confirmSentAt: now, confirmedAt: null, unsubscribedAt: null };
  await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email, unsubscribeToken: newToken(), ...data }, update: data });

  const confirmUrl = `${deps.baseUrl}/newsletter/potvrzeni?t=${token}`;
  if (!deps.send) {
    console.warn(`[newsletter] SMTP není nastaven (ELDOCK_SMTP_URL) – potvrzovací odkaz pro ${email}: ${confirmUrl}`);
    return { status: "logged" as const };
  }
  await deps.send({ to: [email], ...confirmationEmail(confirmUrl) });
  return { status: "sent" as const };
}

/** Potvrzení odběru odkazem z e-mailu (platí 7 dní). */
export async function confirmSubscription(prisma: PrismaClient, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false as const, reason: "invalid" as const };
  const row = await prisma.newsletterSubscriber.findUnique({ where: { confirmTokenHash: tokenHash(token) } });
  if (!row || row.status !== "PENDING") return { ok: false as const, reason: "invalid" as const };
  if (!row.confirmSentAt || now.getTime() - row.confirmSentAt.getTime() > CONFIRM_TTL_DAYS * DAY) return { ok: false as const, reason: "expired" as const };
  await prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { status: "CONFIRMED", confirmedAt: now, confirmTokenHash: null } });
  return { ok: true as const, email: row.email };
}

/** Odhlášení (idempotentní). E-mail zůstane jen jako záznam odhlášení. */
export async function unsubscribe(prisma: PrismaClient, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false as const };
  const row = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!row) return { ok: false as const };
  if (row.status !== "UNSUBSCRIBED") await prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: now, confirmTokenHash: null } });
  return { ok: true as const, email: row.email };
}

const unsubscribeUrl = (baseUrl: string, token: string) => `${baseUrl}/newsletter/odhlaseni?t=${token}`;

function issueMessage(input: { subject: string; body: string }, baseUrl: string, recipient: { email: string; unsubscribeToken: string }) {
  const link = unsubscribeUrl(baseUrl, recipient.unsubscribeToken);
  return {
    to: [recipient.email],
    ...issueEmail({ subject: input.subject, body: input.body, unsubscribeUrl: link }),
    // RFC 2369 + RFC 8058: odhlášení jedním kliknutím přímo z poštovního klienta
    headers: { "List-Unsubscribe": `<${baseUrl}/api/newsletter/unsubscribe?t=${recipient.unsubscribeToken}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

const issueSchema = (input: { subject: string; body: string }) => {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3 || subject.length > 150) throw new WorkflowError("VALIDATION", "Předmět musí mít 3–150 znaků.");
  if (body.length < 20 || body.length > 20_000) throw new WorkflowError("VALIDATION", "Text vydání musí mít 20–20 000 znaků.");
  return { subject, body };
};

/** Zkušební vydání na jednu adresu (bez záznamu vydání). */
export async function sendTestIssue(input: { to: string; subject: string; body: string }, deps: NewsletterDeps) {
  if (!deps.send) throw new WorkflowError("VALIDATION", "Odesílání e-mailů není nastavené (ELDOCK_SMTP_URL).");
  const to = normalizeEmail(input.to);
  if (!isValidEmail(to)) throw new WorkflowError("VALIDATION", "Zadejte platnou adresu pro zkušební e-mail.");
  const issue = issueSchema(input);
  await deps.send(issueMessage({ ...issue, subject: `[TEST] ${issue.subject}` }, deps.baseUrl, { email: to, unsubscribeToken: "zkusebni-odkaz-neodhlasuje" }));
}

/** Rozeslání vydání všem potvrzeným odběratelům (volitelně jen jedné cílové skupině); chyba jednoho e-mailu nezastaví ostatní. */
export async function sendIssue(prisma: PrismaClient, input: { subject: string; body: string; audience?: string | null }, deps: NewsletterDeps) {
  if (!deps.send) throw new WorkflowError("VALIDATION", "Odesílání e-mailů není nastavené (ELDOCK_SMTP_URL).");
  const issue = issueSchema(input);
  const audience = isAudience(input.audience) ? input.audience : null;
  const recipients = await prisma.newsletterSubscriber.findMany({ where: { status: "CONFIRMED", ...(audience ? { audience } : {}) }, select: { email: true, unsubscribeToken: true }, orderBy: { confirmedAt: "asc" } });
  if (!recipients.length) throw new WorkflowError("VALIDATION", "Žádný potvrzený odběratel – vydání nebylo odesláno.");
  const record = await prisma.newsletterIssue.create({ data: { ...issue, audience } });
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await deps.send(issueMessage(issue, deps.baseUrl, recipient));
      sent++;
    } catch (error) {
      failed++;
      console.error(`[newsletter] doručení selhalo (${recipient.email}):`, error);
    }
  }
  await prisma.newsletterIssue.update({ where: { id: record.id }, data: { recipients: sent, failed, sentAt: deps.now ?? new Date() } });
  return { id: record.id, sent, failed };
}

/** Přehled pro velín: počty podle stavu a cílové skupiny + poslední vydání. */
export async function newsletterOverview(prisma: PrismaClient) {
  const [byStatus, byAudience, issues] = await Promise.all([
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.newsletterSubscriber.groupBy({ by: ["audience"], where: { status: "CONFIRMED" }, _count: { _all: true } }),
    prisma.newsletterIssue.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  return {
    confirmed: count("CONFIRMED"),
    pending: count("PENDING"),
    unsubscribed: count("UNSUBSCRIBED"),
    byAudience: byAudience.map((row) => ({ audience: row.audience, count: row._count._all })),
    issues,
  };
}
