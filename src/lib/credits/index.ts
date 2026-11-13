// Kredity ELDOCK (fáze 50, nový ceník fáze 111): balíčky a předplatné, DPH, variabilní symbol a český QR kód platby
// (SPD 1.0). Čisté funkce – bezpečné pro klient i server. Ceník a nároky na výstupy jsou v `pricing.ts` a
// `entitlements.ts` (fáze 111).

import { VAT_RATE, orderProduct } from "./pricing";

export * from "./pricing";
export * from "./entitlements";

/** Produkt objednávky podle kódu (balíček kreditů, předplatné nebo dřívější balíček – jen zobrazení starých objednávek). */
export const creditPackage = (code: string) => orderProduct(code);

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

/** Fáze 84: BIC / SWIFT (8 nebo 11 znaků) velkými písmeny; neplatný tvar → null. */
export function normalizeBic(value: string | null | undefined): string | null {
  const bic = (value ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic) ? bic : null;
}

/** Fáze 84: kontrolní číslice IBAN (ISO 13616 – zbytek po dělení 97 je 1). */
export function isValidIban(value: string | null | undefined): boolean {
  const iban = normalizeIban(value);
  if (!iban) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
  let rest = 0;
  for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}

/** Fáze 84: tuzemské číslo účtu z českého IBAN (`CZkk BBBB PPPPPP CCCCCCCCCC` → `[předčíslí-]číslo/kód banky`). */
export function czAccountFromIban(value: string | null | undefined): string | null {
  const iban = normalizeIban(value);
  if (!iban || !/^CZ\d{22}$/.test(iban)) return null;
  const prefix = iban.slice(8, 14).replace(/^0+/, "");
  const number = iban.slice(14).replace(/^0+/, "");
  return `${prefix ? `${prefix}-` : ""}${number}/${iban.slice(4, 8)}`;
}

/** Fáze 84: účet pro QR platbu a zálohovou fakturu kreditů (banka a číslo účtu jen u známého účtu). */
export interface BankAccount {
  iban: string;
  bic: string | null;
  accountNumber: string | null;
  bankName: string | null;
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
 * Český QR kód platby – Short Payment Descriptor 1.0 (ČBA):
 * `SPD*1.0*ACC:<IBAN>[+<BIC>]*AM:<částka>.00*CC:CZK*X-VS:<VS>*MSG:<zpráva>` (BIC volitelně, fáze 84).
 */
export function spdPayload(input: { iban: string; bic?: string | null; amountCzk: number; variableSymbol: string; message: string }): string {
  const iban = normalizeIban(input.iban);
  if (!iban) throw new Error("Neplatný IBAN pro QR platbu.");
  const bic = input.bic ? normalizeBic(input.bic) : null;
  if (input.bic && !bic) throw new Error("Neplatný BIC / SWIFT pro QR platbu.");
  if (!Number.isFinite(input.amountCzk) || input.amountCzk <= 0) throw new Error("Neplatná částka.");
  if (!/^\d{1,10}$/.test(input.variableSymbol)) throw new Error("Variabilní symbol musí mít 1–10 číslic.");
  return `SPD*1.0*ACC:${iban}${bic ? `+${bic}` : ""}*AM:${input.amountCzk.toFixed(2)}*CC:CZK*X-VS:${input.variableSymbol}*MSG:${spdText(input.message)}`;
}

/** IBAN po 4 znacích pro čitelný tisk. */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export const ORDER_STATUS: Record<"PENDING" | "PAID" | "CANCELLED", { label: string; badge: string }> = {
  PENDING: { label: "Čeká na úhradu", badge: "border-amber-500/50 bg-amber-500/10 text-amber-200" },
  PAID: { label: "Uhrazeno – kredity připsány", badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" },
  CANCELLED: { label: "Stornováno", badge: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300" },
};
