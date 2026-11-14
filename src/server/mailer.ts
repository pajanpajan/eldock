// Odesílání e-mailů přes SMTP (nodemailer). Bez `ELDOCK_SMTP_URL` a bez SMTP z velínu (fáze 113) není transport
// k dispozici a notifikace se jen uloží do logu v databázi.
import nodemailer from "nodemailer";

import { brandEnv } from "@/lib/auth";
import { platformCache, type SmtpRuntime } from "@/server/services/platform-settings";

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Doplňkové hlavičky (fáze 56: List-Unsubscribe u newsletteru). */
  headers?: Record<string, string>;
  /** Fáze 107: odpověď na notifikaci kontaktní zprávy jde rovnou odesílateli. */
  replyTo?: string;
}

export type MailTransport = (message: MailMessage) => Promise<void>;

/** Fáze 113: nodemailer pro SMTP z velínu (465 = SSL/TLS, 587 = STARTTLS). */
export function smtpTransporter(settings: SmtpRuntime) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.user ? { auth: { user: settings.user, pass: settings.pass ?? "" } } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

/**
 * Odesílatel z prostředí (`ELDOCK_SMTP_URL`, např. `smtps://uzivatel:heslo@smtp.example.cz:465`); fáze 113: jinak SMTP
 * nastavené ve velínu (⚙️ SMTP & Cloud zálohy); bez obojího `null`.
 */
export function smtpTransportFromEnv(): MailTransport | null {
  const url = brandEnv("SMTP_URL");
  const stored = url ? null : platformCache().smtp;
  if (!url && !stored) return null;
  const from = url ? (brandEnv("MAIL_FROM") ?? "Eldock <noreply@eldock.cz>") : stored!.from;
  const transporter = url ? nodemailer.createTransport(url) : smtpTransporter(stored!);
  return async ({ to, subject, html, text, headers, replyTo }) => {
    await transporter.sendMail({ from, to, subject, html, text, headers, ...(replyTo ? { replyTo } : {}) });
  };
}

/** Fáze 113: [ Otestovat SMTP ] – ověření spojení a zkušební e-mail; chyba = česká hláška pro velín. */
export async function sendSmtpTest(to: string): Promise<{ via: "env" | "velin" }> {
  const url = brandEnv("SMTP_URL");
  const stored = platformCache().smtp;
  if (!url && !stored) throw new Error("SMTP zatím není nastavené – vyplňte server, port, uživatele a heslo a uložte.");
  const transporter = url ? nodemailer.createTransport(url) : smtpTransporter(stored!);
  try {
    await transporter.verify();
    await transporter.sendMail({
      from: url ? (brandEnv("MAIL_FROM") ?? "Eldock <noreply@eldock.cz>") : stored!.from,
      to,
      subject: "ELDOCK – zkušební e-mail (nastavení SMTP)",
      text: "Dobrý den,\n\ntento e-mail poslal velín ELDOCK při kontrole nastavení SMTP. Odesílání e-mailů (obnova hesla, notifikace, reporty) funguje.\n\nELDOCK.cz",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`SMTP neodpovídá nebo odmítlo přihlášení: ${reason.slice(0, 200)}`);
  }
  return { via: url ? "env" : "velin" };
}
