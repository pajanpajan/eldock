// Výchozí firemní a kontaktní údaje (kontakt, JSON-LD, výchozí účet pro QR platby). Fáze 112: provozovatele (jméno, IČO,
// DIČ, spisovou značku, IBAN) upravuje velín /superadmin – patička, faktury, VOP a zásady čtou `server/operator.ts`.

export const COMPANY_INFO = {
  name: "ELDOCK.cz – Pavel Janoušek",
  contactPerson: "Pavel Janoušek",
  email: "info@eldock.cz",
  location: "Jablonec nad Nisou, Česká republika",
  /** Fáze 112: IČO, DIČ a ulici vyplní velín (prázdné = nezobrazuje se). */
  ico: "",
  dic: "",
  street: "",
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
