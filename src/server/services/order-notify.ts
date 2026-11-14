// Fáze 114: okamžitá notifikace majiteli o každé nové objednávce kreditů / sady QR štítků a o předběžném připsání kreditů
// po QR platbě – e-mail přes SMTP (`ELDOCK_SMTP_URL` nebo SMTP z velínu), Resend (`ELDOCK_RESEND_API_KEY`) a / nebo webhook
// (`ELDOCK_CONTACT_WEBHOOK_URL` – Slack, Teams, Discord …). Příjemce `ELDOCK_CONTACT_NOTIFY_EMAIL`, jinak e-mail
// provozovatele z velínu. Výsledek se zapíše k objednávce (velín ukáže 📧 / ⚠️). Záměrně bez `server-only` (testy).

import type { PrismaClient } from "@/generated/prisma/client";
import { brandEnv } from "@/lib/auth";
import { COMPANY_INFO } from "@/lib/company";
import { creditPackage, formatCzk } from "@/lib/credits";
import { labelOrderTitle } from "@/lib/operator";
import { SITE_URL } from "@/lib/seo";
import { smtpTransportFromEnv, type MailTransport } from "@/server/mailer";

import { labelSetsOf, operatorProfileOf } from "./operator";

export type OrderEvent = "created" | "provisional";

export interface OrderNotifyDeps {
  smtp?: MailTransport | null;
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
  now?: Date;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Předmět a text notifikace (čisté – testy). */
export function orderNotification(
  order: { variableSymbol: string; packageCode: string; creditsCount: number; priceCzkInclVat: number; createdAt: Date },
  company: { companyName: string; ico: string; email: string; phone: string },
  event: OrderEvent,
  product: string,
  adminUrl: string,
): { subject: string; text: string } {
  const head = event === "provisional" ? "⏳ Předběžně připsané kredity po QR platbě" : "🧾 Nová objednávka";
  const subject = `${head} VS ${order.variableSymbol} – ${company.companyName} – ${formatCzk(order.priceCzkInclVat)}`;
  const text = [
    event === "provisional"
      ? `Zákazník označil objednávku VS ${order.variableSymbol} jako zaplacenou QR kódem – kredity (${order.creditsCount}) jsou předběžně aktivní. Do 48 hodin zkontrolujte výpis z banky a ve velínu platbu potvrďte, nebo předběžné kredity odečtěte.`
      : `Nová objednávka VS ${order.variableSymbol} čeká na úhradu převodem / QR platbou.`,
    "",
    `Produkt: ${product}`,
    `Částka: ${formatCzk(order.priceCzkInclVat)}`,
    `Firma: ${company.companyName} (IČO ${company.ico})`,
    `Kontakt: ${company.email} · ${company.phone}`,
    `Objednáno: ${order.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`,
    "",
    `Velín: ${adminUrl}`,
  ].join("\n");
  return { subject, text };
}

/** Odešle notifikaci majiteli a zapíše výsledek k objednávce; chyba odeslání objednávku nikdy nezastaví. */
export async function notifyOrderOwner(prisma: PrismaClient, orderId: string, event: OrderEvent = "created", deps: OrderNotifyDeps = {}): Promise<{ sent: string[]; errors: string[] }> {
  const env = deps.env ?? brandEnv;
  const order = await prisma.creditOrder.findUnique({ where: { id: orderId }, include: { company: { select: { companyName: true, ico: true, email: true, phone: true } } } });
  if (!order) return { sent: [], errors: ["Objednávka neexistuje."] };
  const [operator, sets] = await Promise.all([operatorProfileOf(prisma), labelSetsOf(prisma)]);
  const product = labelOrderTitle(order.packageCode, sets) ?? creditPackage(order.packageCode)?.title ?? `${order.packageCode} · ${order.creditsCount} kreditů`;
  const adminUrl = `${env("PUBLIC_URL") ?? SITE_URL}/superadmin?tab=orders#VS${order.variableSymbol}`;
  const { subject, text } = orderNotification(order, order.company, event, product, adminUrl);
  const to = env("CONTACT_NOTIFY_EMAIL") ?? (operator.email || COMPANY_INFO.email);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sent: string[] = [];
  const errors: string[] = [];

  const smtp = deps.smtp === undefined ? smtpTransportFromEnv() : deps.smtp;
  if (smtp) {
    try {
      await smtp({ to: [to], subject, text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`, replyTo: order.company.email });
      sent.push("smtp");
    } catch (error) {
      errors.push(`SMTP: ${errorText(error)}`);
    }
  }
  const resendKey = env("RESEND_API_KEY");
  if (resendKey) {
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("MAIL_FROM") ?? "ELDOCK <noreply@eldock.cz>", to: [to], subject, text, reply_to: order.company.email }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sent.push("resend");
    } catch (error) {
      errors.push(`Resend: ${errorText(error)}`);
    }
  }
  const webhook = env("CONTACT_WEBHOOK_URL");
  if (webhook) {
    try {
      const body = `${subject}\n\n${text}`;
      const response = await fetchImpl(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, content: body.slice(0, 1900), order: order.variableSymbol, event, url: adminUrl }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sent.push("webhook");
    } catch (error) {
      errors.push(`Webhook: ${errorText(error)}`);
    }
  }
  const note = errors.length ? errors.join(" · ") : sent.length ? null : "SMTP ani webhook nejsou nastavené – objednávka je jen ve velínu.";
  await prisma.creditOrder.update({ where: { id: order.id }, data: { ownerNotifiedAt: sent.length ? (deps.now ?? new Date()) : order.ownerNotifiedAt, ownerNotifyError: note?.slice(0, 500) ?? null } });
  return { sent, errors };
}
