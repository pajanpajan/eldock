import "server-only";

import { brandEnv } from "@/lib/auth";
import { SITE_URL } from "@/lib/seo";
import { smtpTransportFromEnv } from "@/server/mailer";

// Fáze 67: odkazy na nastavení hesla (pozvánka zaměstnance, obnova) – adresa a e-mail. Bez `ELDOCK_SMTP_URL`
// se e-mail neodešle: správce firmy odkaz zkopíruje z aplikace, obnova se zapíše do logu serveru.

const publicBase = () => (brandEnv("PUBLIC_URL") ?? SITE_URL).replace(/\/+$/, "");

export const passwordLinkUrl = (token: string) => `${publicBase()}/nastavit-heslo/${token}`;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Odešle odkaz e-mailem; vrací `true` jen při skutečném odeslání přes SMTP. */
export async function sendPasswordLink(input: { email: string; name: string; link: string; kind: "INVITE" | "RESET"; validity: string; company?: string | null }) {
  const send = smtpTransportFromEnv();
  if (!send) return false;
  const intro =
    input.kind === "INVITE"
      ? `${input.company ? `firma ${input.company} vás` : "Byli jste"} pozvali do Eldocku (dokumentace, revize a údržba závodu). Heslo si nastavíte odkazem`
      : `pro účet ${input.email} jsme dostali žádost o nastavení nového hesla do Eldocku. Odkaz`;
  const text = `Dobrý den, ${input.name},\n\n${intro} – platí ${input.validity}:\n${input.link}\n\nPokud jste o nic nežádali, e-mail ignorujte.\n\nEldock`;
  const html = `<p>Dobrý den, ${escapeHtml(input.name)},</p><p>${escapeHtml(intro)} – platí ${escapeHtml(input.validity)}:</p><p><a href="${escapeHtml(input.link)}">Nastavit heslo</a></p><p>Pokud jste o nic nežádali, e-mail ignorujte.</p>`;
  try {
    await send({ to: [input.email], subject: input.kind === "INVITE" ? "Eldock – pozvánka do účtu firmy" : "Eldock – nastavení nového hesla", text, html });
    return true;
  } catch (error) {
    console.error("[eldock] Odkaz na nastavení hesla se nepodařilo odeslat e-mailem.", error);
    return false;
  }
}
