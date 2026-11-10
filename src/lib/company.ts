// Firemní a kontaktní údaje pro veřejnou úvodní stránku a patičku – jediné místo k přepsání
// po zápisu s.r.o. do obchodního rejstříku.

export const COMPANY_INFO = {
  name: "Eldock s.r.o. (v založení)",
  contactPerson: "Pavel Janoušek",
  email: "info@eldock.cz",
  location: "Jablonec nad Nisou, Česká republika",
  ico: "Bude doplněno po zápisu do OR",
  dic: "Bude doplněno",
  /** Fakturační adresa dodavatele (zálohová faktura kreditů, fáze 50). */
  street: "Bude doplněno",
  city: "Jablonec nad Nisou",
  zip: "466 01",
  /**
   * Fáze 84: bankovní účet pro QR platby (SPD) a zálohové faktury kreditů. Jiný účet jen přes env `ELDOCK_BANK_IBAN`
   * (+ `ELDOCK_BANK_BIC`, `ELDOCK_BANK_NAME`).
   */
  bank: {
    name: "Raiffeisenbank a.s.",
    accountNumber: "918118002/5500",
    iban: "CZ1755000000000918118002",
    bic: "RZBCCZPP",
  },
} as const;
