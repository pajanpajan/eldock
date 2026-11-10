import { formatIban, type BankAccount } from "@/lib/credits";

/**
 * Fáze 84: platební údaje kreditů – banka, číslo účtu, IBAN po čtveřicích, SWIFT / BIC a variabilní symbol. Dvojice
 * `dt` / `dd` do mřížky `dl` objednávky i zálohové faktury (stejné údaje jako v QR platbě).
 */
export function BankDetails({ bank, variableSymbol, labelClass }: { bank: BankAccount; variableSymbol: string; labelClass: string }) {
  const rows = [
    { label: "Banka", value: bank.bankName, mono: false, strong: false, id: "bank-name" },
    { label: "Číslo účtu", value: bank.accountNumber, mono: true, strong: true, id: "bank-account" },
    { label: "IBAN", value: formatIban(bank.iban), mono: true, strong: false, id: "bank-iban" },
    { label: "SWIFT / BIC", value: bank.bic, mono: true, strong: false, id: "bank-bic" },
    { label: "Variabilní symbol", value: variableSymbol, mono: true, strong: true, id: "bank-vs" },
  ].filter((row) => row.value);
  return rows.map((row) => [
    <dt key={`${row.id}-label`} className={labelClass}>
      {row.label}
    </dt>,
    <dd key={row.id} className={[row.mono ? "font-mono" : "", row.strong ? "font-bold" : ""].join(" ").trim() || undefined} data-testid={row.id}>
      {row.value}
    </dd>,
  ]);
}
