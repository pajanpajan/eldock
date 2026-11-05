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
  /** Demo IBAN (vzorový účet z české dokumentace SPD) – skutečný účet nastavte v env `ELDOCK_BANK_IBAN`. */
  demoIban: "CZ6508000000192000145399",
  bankName: "Bankovní účet ELDOCK",
} as const;
