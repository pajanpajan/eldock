// Kredity AI Panel Builderu (fáze 50): balíčky, DPH, variabilní symbol a český QR kód platby (SPD 1.0).
// Čisté funkce – bezpečné pro klient i server.

export const VAT_RATE = 0.21;

export const CREDIT_PACKAGES = [
  { code: "START_10", name: "START 10", title: "Balíček 10 rozváděčů", credits: 10, priceExclVat: 990, note: "99 Kč / rozváděč", highlight: false },
  { code: "PROFI_30", name: "PROFI 30", title: "Balíček 30 rozváděčů", credits: 30, priceExclVat: 2490, note: "83 Kč / rozváděč – nejoblíbenější", highlight: true },
  { code: "UNLIMITED_YEAR", name: "PROJEKTANT ROK", title: "Roční neomezený tarif", credits: 200, priceExclVat: 5900, note: "200 kreditů na 12 měsíců", highlight: false },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];
export type PackageCode = CreditPackage["code"];

export const creditPackage = (code: string): CreditPackage | null => CREDIT_PACKAGES.find((item) => item.code === code) ?? null;

/** Cena s DPH 21 % zaokrouhlená na celé koruny. */
export const withVat = (priceExclVat: number) => Math.round(priceExclVat * (1 + VAT_RATE));
export const vatOf = (priceExclVat: number) => withVat(priceExclVat) - priceExclVat;

export const formatCzk = (value: number) => `${value.toLocaleString("cs-CZ")} Kč`;

/** Další variabilní symbol roku: „RRRR“ + pořadí na 4 místa (20260001, 20260002 …). */
export function nextVariableSymbol(existing: readonly string[], year: number): string {
  const prefix = String(year);
  const max = existing.reduce((top, vs) => (vs.startsWith(prefix) && vs.length === 8 ? Math.max(top, Number(vs.slice(4)) || 0) : top), 0);
  if (max >= 9999) throw new Error("Vyčerpaná řada variabilních symbolů pro tento rok.");
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** IBAN bez mezer, velkými písmeny; neplatný tvar → null. */
export function normalizeIban(value: string | null | undefined): string | null {
  const iban = (value ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban) ? iban : null;
}

/** Text zprávy pro SPD: bez diakritiky a hvězdiček (oddělovač formátu), max. 60 znaků. */
export function spdText(value: string, max = 60): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Český QR kód platby – Short Payment Descriptor 1.0:
 * `SPD*1.0*ACC:<IBAN>*AM:<částka>.00*CC:CZK*X-VS:<VS>*MSG:<zpráva>`.
 */
export function spdPayload(input: { iban: string; amountCzk: number; variableSymbol: string; message: string }): string {
  const iban = normalizeIban(input.iban);
  if (!iban) throw new Error("Neplatný IBAN pro QR platbu.");
  if (!Number.isFinite(input.amountCzk) || input.amountCzk <= 0) throw new Error("Neplatná částka.");
  if (!/^\d{1,10}$/.test(input.variableSymbol)) throw new Error("Variabilní symbol musí mít 1–10 číslic.");
  return `SPD*1.0*ACC:${iban}*AM:${input.amountCzk.toFixed(2)}*CC:CZK*X-VS:${input.variableSymbol}*MSG:${spdText(input.message)}`;
}

/** IBAN po 4 znacích pro čitelný tisk. */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export const ORDER_STATUS: Record<"PENDING" | "PAID" | "CANCELLED", { label: string; badge: string }> = {
  PENDING: { label: "Čeká na úhradu", badge: "border-amber-500/50 bg-amber-500/10 text-amber-200" },
  PAID: { label: "Uhrazeno – kredity připsány", badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" },
  CANCELLED: { label: "Stornováno", badge: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300" },
};
