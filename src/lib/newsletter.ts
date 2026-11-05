// Fáze 56: newsletter – cílové skupiny, validace e-mailu a šablony e-mailů (čisté funkce bez I/O).

export const NEWSLETTER_AUDIENCES = [
  { id: "elektrikar", label: "Elektrikář / elektromontáže" },
  { id: "revizni-technik", label: "Revizní technik" },
  { id: "technicky-reditel", label: "Technický ředitel / vedoucí údržby" },
  { id: "udrzba", label: "Údržbář v provozu" },
  { id: "jine", label: "Jiné" },
] as const;

export type NewsletterAudience = (typeof NEWSLETTER_AUDIENCES)[number]["id"];

export const isAudience = (value: unknown): value is NewsletterAudience => NEWSLETTER_AUDIENCES.some((audience) => audience.id === value);
export const audienceLabel = (value: string | null | undefined) => NEWSLETTER_AUDIENCES.find((audience) => audience.id === value)?.label ?? "neuvedeno";

/** E-mail bez mezer a malými písmeny (jedna adresa = jeden odběr). */
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

/** Praktická kontrola tvaru adresy (RFC 5322 je pro formulář zbytečně benevolentní). */
export const isValidEmail = (value: string) => value.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Prostý text vydání → HTML: odstavce podle prázdných řádků, odkazy http(s) klikací, nic jiného (bez šablonových injekcí). */
export function textToHtml(body: string): string {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(paragraph).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#f59e0b">$1</a>')}</p>`)
    .join("");
}

const frame = (title: string, inner: string, footer: string) => `<!doctype html><html lang="cs"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background:#09090b;border-radius:12px 12px 0 0;color:#fafafa;font-weight:bold;font-size:18px">ELDOCK <span style="color:#f59e0b;font-weight:normal;font-size:13px">${escapeHtml(title)}</span></td></tr>
<tr><td style="padding:24px;font-size:15px">${inner}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7">${footer}</td></tr>
</table></td></tr></table></body></html>`;

/** Potvrzovací e-mail double opt-in. */
export function confirmationEmail(confirmUrl: string) {
  const subject = "Potvrďte odběr novinek Eldock";
  const text = `Dobrý den,\n\nněkdo (nejspíš vy) požádal o zasílání novinek Eldock na tuto adresu – zhruba jednou měsíčně.\nOdběr potvrdíte tímto odkazem (platí 7 dní):\n${confirmUrl}\n\nPokud jste o odběr nežádali, e-mail ignorujte – nic dalšího vám nepošleme.\n\nEldock`;
  const html = frame(
    "Potvrzení odběru",
    `<p style="margin:0 0 14px">Dobrý den,</p><p style="margin:0 0 14px">někdo (nejspíš vy) požádal o zasílání novinek Eldock na tuto adresu – zhruba jednou měsíčně.</p>
<p style="margin:20px 0"><a href="${escapeHtml(confirmUrl)}" style="background:#f59e0b;color:#09090b;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Potvrdit odběr</a></p>
<p style="margin:0;color:#71717a;font-size:13px">Odkaz platí 7 dní. Pokud jste o odběr nežádali, e-mail ignorujte – nic dalšího vám nepošleme.</p>`,
    "Eldock – digitální elektrodokumentace a revize",
  );
  return { subject, text, html };
}

/** Vydání newsletteru s odkazem na odhlášení (povinný v každém e-mailu). */
export function issueEmail(input: { subject: string; body: string; unsubscribeUrl: string }) {
  const text = `${input.body.trim()}\n\n—\nOdhlášení odběru: ${input.unsubscribeUrl}\nTento e-mail dostáváte, protože jste se přihlásili k odběru novinek Eldock.`;
  const html = frame(
    "Novinky",
    `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(input.subject)}</h1>${textToHtml(input.body)}`,
    `Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek Eldock. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#71717a">Odhlásit odběr</a>`,
  );
  return { subject: input.subject, text, html };
}
