// Fáze 54: veřejné právní stránky – zásady zpracování osobních údajů (/ochrana-osobnich-udaju).
// Obsah odpovídá tomu, co aplikace skutečně zpracovává (registrace firem a závodů, fotky a hlasové poznámky,
// analýza fotek přes Google Gemini, e-mailová avíza, hosting Hetzner, jen nezbytné cookies). Čisté konstanty bez I/O.
// Před ostrým prodejem nechat zkontrolovat právníkem (viz registr eldock-normovy-registr, INT-015).

import { COMPANY_INFO } from "./company";

export const PRIVACY_VERSION = "1.1 – 5. 11. 2026";

/** Text souhlasu s newsletterem – ukládá se k odběrateli (verze níže), změna textu = nová verze. */
export const NEWSLETTER_CONSENT_VERSION = "1";
export const NEWSLETTER_CONSENT_TEXT =
  "Souhlasím se zasíláním novinek Eldock (zhruba 1× měsíčně) na uvedený e-mail. Souhlas mohu kdykoli odvolat odkazem v každém e-mailu nebo zprávou na kontaktní e-mail.";

export interface LegalSection {
  /** Kotva sekce (např. #cookies). */
  id?: string;
  title: string;
  paragraphs: string[];
  list?: string[];
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. Správce",
    paragraphs: [
      `Správcem osobních údajů je ${COMPANY_INFO.name}, ${COMPANY_INFO.location} (dále „Eldock“). Kontakt pro otázky ochrany osobních údajů: ${COMPANY_INFO.email}.`,
    ],
  },
  {
    title: "2. Jaké údaje zpracováváme",
    paragraphs: ["Zpracováváme jen údaje, které nám poskytnete při registraci a používání platformy:"],
    list: [
      "údaje firmy a kontaktní osoby: obchodní název, IČO, DIČ, adresa, jméno, e-mail, telefon a číslo oprávnění (údaje firmy předvyplňujeme z veřejného registru ARES),",
      "přihlašovací údaje: e-mail a heslo (ukládáme jen jeho kryptografický otisk),",
      "obsah, který do platformy nahrajete: fotografie a videa rozváděčů a zařízení, zákresy, hlasové poznámky, revizní záznamy a dokumentaci včetně jmen osob, které změny zadaly nebo schválily,",
      "údaje o objednávkách kreditů a platbách (variabilní symbol, fakturační údaje),",
      "technické záznamy nutné pro bezpečný provoz (časy přihlášení a změn v auditní stopě).",
    ],
  },
  {
    title: "3. Účely a právní základy",
    paragraphs: [],
    list: [
      "poskytování platformy a plnění smlouvy s vaší firmou (čl. 6 odst. 1 písm. b) GDPR),",
      "vedení účetnictví a daňových dokladů k objednávkám kreditů (čl. 6 odst. 1 písm. c) GDPR),",
      "zabezpečení platformy, auditní stopa a obrana právních nároků (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR),",
      "e-mailová avíza o blížících se lhůtách revizí, pokud si je ve své firmě zapnete (plnění smlouvy),",
      "zasílání newsletteru s novinkami jen na základě vašeho souhlasu (čl. 6 odst. 1 písm. a) GDPR),",
      "statistika návštěvnosti webu, jen pokud k ní dáte souhlas v liště cookies (čl. 6 odst. 1 písm. a) GDPR).",
    ],
  },
  {
    title: "4. Příjemci a zpracovatelé",
    paragraphs: ["Údaje neprodáváme ani nepředáváme k marketingu. Pro provoz využíváme tyto zpracovatele:"],
    list: [
      "Hetzner Online GmbH (Německo) – hosting serveru a databáze v EU,",
      "Google (Gemini API) – rozpoznání přístrojů z fotografií rozváděčů a čtení technických listů; odesílá se jen fotografie nebo dokument určený k analýze, který jste nahráli,",
      "poskytovatel odesílání e-mailů – doručení avíz, systémových zpráv a newsletteru,",
      "Google Ireland Ltd. (Google Analytics 4) – jen pokud je na webu zapnutá statistika návštěvnosti a dáte k ní souhlas.",
    ],
  },
  {
    title: "5. Předání mimo EU",
    paragraphs: [
      "Google může údaje zpracovávat i mimo Evropskou unii. Takové předání probíhá jen se zárukami podle kapitoly V GDPR (např. rozhodnutí o odpovídající ochraně nebo standardní smluvní doložky).",
    ],
  },
  {
    title: "6. Doba uložení",
    paragraphs: [
      "Údaje účtu a nahraný obsah uchováváme po dobu trvání registrace. Po zrušení registrace je smažeme, s výjimkou účetních a daňových dokladů, které uchováváme po dobu stanovenou zákonem, a dokumentace, kterou musí výrobce rozváděče nebo provozovatel zařízení archivovat (pokud o to požádá).",
    ],
  },
  {
    id: "cookies",
    title: "7. Cookies a místní úložiště",
    paragraphs: [
      "Technicky nezbytné cookies používáme bez souhlasu: podepsaný token relace pro přihlášení a cookie eldock_consent, která si pamatuje vaši volbu (platí 6 měsíců). Místní úložiště prohlížeče slouží k uložení rozpracovaného nákresu a nastavení zobrazení.",
      "Volitelné cookies (analytické, případně marketingové) zapneme jen s vaším výslovným souhlasem v liště cookies. Odmítnutí je stejně snadné jako přijetí a volbu můžete kdykoli změnit odkazem „Nastavení cookies“ v patičce webu. Pokud web volitelné cookies nepoužívá, lišta se nezobrazuje.",
      "Volbu souhlasu evidujeme kvůli jeho prokázání (náhodný identifikátor, kategorie, verze a čas) – bez IP adresy a bez vazby na váš účet.",
    ],
  },
  {
    id: "newsletter",
    title: "7a. Newsletter",
    paragraphs: [
      "Pokud se přihlásíte k odběru novinek, zpracováváme váš e-mail, volitelně profesi (elektrikář, revizní technik, technický ředitel, údržba), text a čas udělení souhlasu a stav odběru. Odběr potvrzujete odkazem v e-mailu (dvojí potvrzení), bez potvrzení vám nic dalšího nepošleme a nepotvrzenou žádost po 30 dnech smažeme.",
      "Newsletter posíláme zhruba jednou měsíčně. Odhlásit se můžete jedním kliknutím v každém e-mailu; e-mail pak zůstane jen jako záznam odhlášení, abychom vám už nic neposlali.",
    ],
  },
  {
    title: "8. Vaše práva",
    paragraphs: [
      `Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku proti zpracování na základě oprávněného zájmu. Žádost pošlete na ${COMPANY_INFO.email}. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (www.uoou.gov.cz).`,
    ],
  },
];
