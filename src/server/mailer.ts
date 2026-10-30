// Odesílání e-mailů přes SMTP (nodemailer). Bez `ELDOCK_SMTP_URL` není transport k dispozici
// a notifikace se jen uloží do logu v databázi.
import nodemailer from "nodemailer";

import { brandEnv } from "@/lib/auth";

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export type MailTransport = (message: MailMessage) => Promise<void>;

/** Odesílatel z prostředí (`ELDOCK_SMTP_URL`, např. `smtps://uzivatel:heslo@smtp.example.cz:465`), jinak `null`. */
export function smtpTransportFromEnv(): MailTransport | null {
  const url = brandEnv("SMTP_URL");
  if (!url) return null;
  const from = brandEnv("MAIL_FROM") ?? "Eldock <noreply@eldock.cz>";
  const transporter = nodemailer.createTransport(url);
  return async ({ to, subject, html, text }) => {
    await transporter.sendMail({ from, to, subject, html, text });
  };
}
