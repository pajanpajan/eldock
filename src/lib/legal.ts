// Fáze 54: veřejné právní stránky – zásady zpracování osobních údajů (/ochrana-osobnich-udaju).
// Obsah odpovídá tomu, co aplikace skutečně zpracovává (registrace firem a závodů, fotky a hlasové poznámky,
// analýza fotek přes Google Gemini, e-mailová avíza, hosting Hetzner, jen nezbytné cookies). Čisté konstanty bez I/O.
// Před ostrým prodejem nechat zkontrolovat právníkem (viz registr eldock-normovy-registr, INT-015).

import { COMPANY_INFO } from "./company";

export const PRIVACY_VERSION = "1.0 – 5. 11. 2026";

export interface LegalSection {
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
      "e-mailová avíza o blížících se lhůtách revizí, pokud si je ve své firmě zapnete (plnění smlouvy).",
    ],
  },
  {
    title: "4. Příjemci a zpracovatelé",
    paragraphs: ["Údaje neprodáváme ani nepředáváme k marketingu. Pro provoz využíváme tyto zpracovatele:"],
    list: [
      "Hetzner Online GmbH (Německo) – hosting serveru a databáze v EU,",
      "Google (Gemini API) – rozpoznání přístrojů z fotografií rozváděčů a čtení technických listů; odesílá se jen fotografie nebo dokument určený k analýze, který jste nahráli,",
      "poskytovatel odesílání e-mailů – doručení avíz a systémových zpráv.",
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
    title: "7. Cookies a místní úložiště",
    paragraphs: [
      "Používáme jen technicky nezbytné cookies pro přihlášení (podepsaný token relace) a místní úložiště prohlížeče pro uložení rozpracovaného nákresu a nastavení zobrazení. Nepoužíváme analytické ani reklamní cookies, proto nevyžadujeme souhlas s cookies.",
    ],
  },
  {
    title: "8. Vaše práva",
    paragraphs: [
      `Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku proti zpracování na základě oprávněného zájmu. Žádost pošlete na ${COMPANY_INFO.email}. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (www.uoou.gov.cz).`,
    ],
  },
];
