// Fáze 54: veřejné právní stránky – zásady zpracování osobních údajů (/ochrana-osobnich-udaju).
// Obsah odpovídá tomu, co aplikace skutečně zpracovává (registrace firem a závodů, fotky a hlasové poznámky,
// analýza fotek přes Google Gemini, e-mailová avíza, hosting Hetzner, cookies podle souhlasu; fáze 102 telemetrie prvních
// stran a kontakty z trenažéru s údaji z ARES). Čisté konstanty bez I/O.
// Před ostrým prodejem nechat zkontrolovat právníkem (viz registr eldock-normovy-registr, INT-015).


export const PRIVACY_VERSION = "1.8 – 13. 11. 2026";

/**
 * Fáze 104: doložka ochrany databáze a autorských práv (patička webu, obchodní podmínky, zápatí PDF výstupů) – databáze
 * prvků jako databáze s vlastním právem pořizovatele (§ 88–94 zák. č. 121/2000 Sb.), algoritmy a struktura dokumentace
 * jako autorské dílo / software.
 */
export const IP_NOTICE =
  "© 2026 ELDOCK.cz – Všechna práva vyhrazena. Databáze prvků, výpočtové algoritmy a struktura dokumentace jsou chráněny autorským právem a zvláštním právem pořizovatele databáze dle zák. č. 121/2000 Sb. Automatizované vytěžování (scraping) a reverzní inženýrství je zakázáno.";

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
      // Fáze 112: identita provozovatele z velínu (`withOperator`)
      "Správcem osobních údajů je {{PROVOZOVATEL}} (dále „Eldock“). Kontakt pro otázky ochrany osobních údajů: {{EMAIL}}.",
      "U údajů, které do platformy vkládá registrovaná firma o svých zaměstnancích, zařízeních a dokumentaci (Správa závodů), je správcem tato firma a Eldock je jejím zpracovatelem: data zpracováváme jen pro poskytování platformy, firma je může kdykoli stáhnout a po zrušení účtu je smažeme. Žádosti zaměstnanců firmy o jejich údaje vyřizuje firma – nástroje k tomu má v aplikaci (export dat, odebrání zaměstnance).",
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
      "profil revizního technika a elektronický podpis revize (fáze 108): jméno a titul, firma a IČO, telefon, e-mail, číslo osvědčení a oprávnění TIČR, měřicí přístroj a kalibrační list, obrázek vlastnoručního podpisu a osobní PIN (jen jeho kryptografický otisk); u každé podepsané revize čas podpisu, IP adresa a typ zařízení (prohlížeč a systém) a otisk SHA-256 obsahu protokolu – údaje jsou součástí uzamčené revizní zprávy a slouží jako důkaz, kdo a kdy revizi podepsal,",
      "technické záznamy nutné pro bezpečný provoz: časy přihlášení a změn v auditní stopě, bezpečnostní deník firmy (přihlášení, neúspěšné pokusy, změny hesel a účtů – bez IP adresy, pro omezení pokusů jen její jednosměrný otisk) a přihlášená zařízení (typ prohlížeče a systému),",
      "spárované aplikace Eldock pro Windows, iOS a Android: název zařízení, platforma, verze aplikace, časy spárování, posledního spojení a synchronizace a evidence úprav odeslaných z aplikace (druh, výsledek a čas) – přístupový token zařízení ukládáme jen jako kryptografický otisk,",
      "evidence žádostí o export a výmaz dat (firma, druh žádosti a čas – bez jmen),",
      "souhrnná statistika používání webu bez cookies: navštívená stránka (bez parametrů adresy), doména odkazu, ze kterého jste přišli, a parametry kampaně (utm), druh akce (spuštěný trenažér, zvolená designová řada, vygenerovaný rozváděč, pokus o export) – bez IP adresy, bez údajů o prohlížeči a bez identifikátoru; jen s vaším souhlasem s analytickými cookies k tomu náhodný identifikátor prohlížeče (navazující návštěvy),",
      "kontakt z trenažéru a ukázkové firmy: e-mail, volitelně IČO a podle něj údaje firmy z veřejného registru ARES (název, sídlo, DIČ, obory činnosti CZ-NACE), zvolené zaměření (elektrikář, projektant, údržba), co jste v ukázce vytvořili (např. počet okruhů a metráž kabelů), zdroj návštěvy a volitelný souhlas s novinkami,",
      "zprávy z kontaktního formuláře a hlášení chyb (tlačítko „💬 Nápověda, Chyby & Kontakt“, stránka Kontakt & Spolupráce): text zprávy, kategorie a její podrobnosti (např. forma schůzky, typ spolupráce, počet QR štítků), jméno, firma a IČO (údaje firmy z ARES), e-mail, telefon, přiložené printscreeny nebo fotky (zmenšené, bez metadat) a technická diagnostika, kterou formulář přiloží sám: adresa stránky, modul a krok průvodce, identifikátor otevřeného projektu, velikost okna a identifikace prohlížeče.",
    ],
  },
  {
    title: "3. Účely a právní základy",
    paragraphs: [],
    list: [
      "poskytování platformy a plnění smlouvy s vaší firmou (čl. 6 odst. 1 písm. b) GDPR),",
      "vedení účetnictví a daňových dokladů k objednávkám kreditů (čl. 6 odst. 1 písm. c) GDPR),",
      "zabezpečení platformy, auditní stopa a obrana právních nároků (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR),",
      "podepsaná revize a měsíční kontrolní report revizního technika: prokázání, kdo a kdy revizi vydal (čas, IP adresa a zařízení při podpisu, pečeť obsahu), ochrana technika před zneužitím jeho osvědčení TIČR a měsíční e-mail se souhrnem, pokud si ho technik zapne (plnění smlouvy a oprávněný zájem, čl. 6 odst. 1 písm. b) a f) GDPR),",
      "e-mailová avíza o blížících se lhůtách revizí, pokud si je ve své firmě zapnete (plnění smlouvy),",
      "zasílání newsletteru s novinkami jen na základě vašeho souhlasu (čl. 6 odst. 1 písm. a) GDPR),",
      "statistika návštěvnosti webu (Google Analytics 4, Microsoft Clarity, produktová analytika s identifikátorem) a měření kampaní a remarketing (Seznam Sklik, Google Ads, LinkedIn), jen pokud k nim dáte souhlas v liště cookies (čl. 6 odst. 1 písm. a) GDPR),",
      "souhrnná statistika používání webu bez cookies a bez identifikátoru – zlepšování nástrojů a přehled o zájmu o ně (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR; proti tomu můžete vznést námitku),",
      "kontakt z trenažéru: zaslání dokumentace, dokončení registrace a odpověď na váš zájem o platformu, včetně jednoho navazujícího obchodního kontaktu k vaší poptávce (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR); obchodní sdělení e-mailem jen s vaším souhlasem (čl. 6 odst. 1 písm. a) GDPR a § 7 zákona č. 480/2004 Sb.),",
      "vyřízení zprávy z kontaktního formuláře – odpověď, oprava nahlášené chyby, sjednání schůzky nebo ukázky a příprava nabídky (opatření před uzavřením smlouvy a oprávněný zájem, čl. 6 odst. 1 písm. b) a f) GDPR).",
    ],
  },
  {
    title: "4. Příjemci a zpracovatelé",
    paragraphs: ["Údaje neprodáváme ani nepředáváme k marketingu. Pro provoz využíváme tyto zpracovatele:"],
    list: [
      "Hetzner Online GmbH (Německo) – hosting serveru a databáze v EU, případně úložiště záloh v EU (zálohy mimo server jsou šifrované, klíč má jen Eldock),",
      "Google (Gemini API) – rozpoznání přístrojů z fotografií rozváděčů, čtení technických listů a čtení výrobních štítků zařízení (Hlídač revizí); odesílá se jen fotografie nebo dokument určený k analýze, který jste nahráli,",
      "poskytovatel odesílání e-mailů – doručení avíz, systémových zpráv a newsletteru, případně i firemní komunikační nástroj Eldocku – upozornění na novou zprávu z kontaktního formuláře (text a kontakt, bez přiložených obrázků),",
      "Google Ireland Ltd. (Google Analytics 4, Google Ads), Microsoft Ireland Operations Ltd. (Clarity), Seznam.cz, a.s. (Sklik) a LinkedIn Ireland Unlimited Company (Insight Tag) – jen pokud je služba na webu zapnutá a dáte k ní souhlas v liště cookies,",
      "Ministerstvo financí ČR (registr ARES) – podle zadaného IČO načteme veřejné údaje firmy; posíláme jen IČO.",
    ],
  },
  {
    title: "5. Předání mimo EU",
    paragraphs: [
      "Google, Microsoft a LinkedIn mohou údaje zpracovávat i mimo Evropskou unii. Takové předání probíhá jen se zárukami podle kapitoly V GDPR (např. rozhodnutí o odpovídající ochraně nebo standardní smluvní doložky).",
    ],
  },
  {
    title: "6. Doba uložení",
    paragraphs: [
      "Údaje účtu a nahraný obsah uchováváme po dobu trvání registrace. Účet firmy zruší její správce v aplikaci (správa závodů: Administrace → Data firmy, AI Panel Builder: Firemní údaje); data pak smažeme po 30 dnech, během nichž si je firma může stáhnout nebo žádost zrušit. Doklady k objednávkám kreditů a fakturační údaje firmy (bez kontaktní osoby) uchováváme 10 let kvůli účetním a daňovým povinnostem. Dokumentaci, kterou musí provozovatel zařízení nebo výrobce rozváděče archivovat, si před zrušením účtu stáhněte exportem.",
    ],
    list: [
      "bezpečnostní deník firmy: 1 rok,",
      "údaje podpisu revize (čas, IP adresa, zařízení, obrázek podpisu, pečeť): po dobu uchování revizní zprávy, kterou provozovatel uchovává po dobu životnosti zařízení; profil technika do jeho smazání nebo zrušení účtu firmy,",
      "zrušená nebo prošlá přihlášení zařízení a odkazy na nastavení hesla: 30 dní,",
      "spárované aplikace: do odpojení (odpojí je uživatel, správce firmy, změna hesla nebo blokace účtu; po 90 dnech bez spojení vyprší), pak 30 dní; evidence úprav z aplikací 90 dní; jednorázové kódy párování 1 den,",
      "evidence žádostí o export a výmaz dat: 3 roky,",
      "odebraný zaměstnanec: přihlášení, e-mail, telefon a dvoufázové ověření mažeme hned; jméno zůstává u záznamů, které ve firmě vytvořil (změny, revize), pokud ho firma nenechá anonymizovat,",
      "zálohy: denní snímky databáze 7 dní na serveru, mimo server 14 denních a 6 měsíčních snímků; soubor smazaný v aplikaci zmizí ze zálohy mimo server po 30 dnech – smazaná data tak ze záloh zmizí nejpozději po 6 měsících,",
      "souhrnná statistika používání webu: 14 měsíců; náhodný identifikátor prohlížeče (jen se souhlasem): 13 měsíců nebo do odvolání souhlasu,",
      "kontakt z trenažéru: 2 roky od posledního kontaktu, s registrací firmy jako údaje účtu; námitkou nebo žádostí o výmaz ho smažeme hned,",
      "zprávy z kontaktního formuláře včetně printscreenů: po dobu řešení a 2 roky od vyřízení; na žádost o výmaz je smažeme dřív, pokud je nepotřebujeme k obraně právních nároků.",
    ],
  },
  {
    id: "cookies",
    title: "7. Cookies a místní úložiště",
    paragraphs: [
      "Technicky nezbytné cookies používáme bez souhlasu: podepsaný token relace pro přihlášení a cookie eldock_consent, která si pamatuje vaši volbu (platí 6 měsíců; kopii volby s časem uloží i místní úložiště eldock_cookie_consent_v1). Místní úložiště prohlížeče slouží k uložení rozpracovaného nákresu a rozváděče a nastavení zobrazení.",
      "Volitelné cookies zapneme jen s vaším výslovným souhlasem v liště „Nastavení soukromí a souborů cookies“: analytické a výkonnostní (produktová analytika ELDOCK s náhodným identifikátorem eldock_vid, Google Analytics 4, Microsoft Clarity) a marketingové a remarketingové (Seznam Sklik, Google Ads, LinkedIn) – služby třetích stran jen ty, které jsou na webu právě zapnuté (vypíše je podrobné nastavení). Google dostává signály Consent Mode v2: bez souhlasu se jeho služby vůbec nenačtou. Odmítnutí je stejně snadné jako přijetí a volbu můžete kdykoli změnit odkazem „Nastavení cookies“ v patičce webu.",
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
    id: "kontakty",
    title: "7b. Kontakt z trenažéru a ukázkové firmy",
    paragraphs: [
      "Když si v ukázkové firmě (trenažér, demo scénáře) stáhnete kusovník, vytisknete elaborát nebo uložíte projekt, požádáme vás o e-mail, kam dokumentaci poslat. IČO je nepovinné: podle něj načteme z veřejného registru ARES název, sídlo, DIČ a obory činnosti firmy, abychom vám mohli předvyplnit razítko a registraci. Ke kontaktu si uložíme, co jste v ukázce vytvořili a odkud jste na web přišli.",
      "Novinky a nabídky vám e-mailem pošleme jen se samostatným souhlasem (políčko v okně není předem zaškrtnuté) a po potvrzení odkazem v e-mailu; souhlas odvoláte jedním kliknutím v každém e-mailu. Kontakt nikomu neprodáváme ani nepředáváme.",
    ],
  },
  {
    id: "kontaktni-formular",
    title: "7c. Kontaktní formulář a hlášení chyb",
    paragraphs: [
      "Zprávu z kontaktního formuláře (hlášení chyby, tip na zlepšení, schůzka a ukázka, spolupráce, poptávka, QR štítky, poradna k projektu) vidí jen provozovatel Eldocku v administraci platformy. Přiložené printscreeny a fotky se v prohlížeči zmenší, na serveru v EU se uloží bez metadat (např. polohy z fotky mobilem) a veřejně dostupné nejsou.",
      "Na printscreenu může být cokoli, co bylo na obrazovce – údaje, které sdílet nechcete, před odesláním zakryjte. Technickou diagnostiku (adresa stránky, modul a krok průvodce, projekt, velikost okna, prohlížeč) formulář přiloží sám, abychom chybu rychle našli; co se odešle, vidíte ve formuláři před odesláním. Ozveme se vám jen kvůli vaší zprávě, obchodní sdělení posíláme jen se souhlasem (viz 7a).",
    ],
  },
  {
    title: "8. Vaše práva",
    paragraphs: [
      `Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku proti zpracování na základě oprávněného zájmu. Žádost pošlete na {{EMAIL}}. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (www.uoou.gov.cz).`,
      "Část práv uplatníte přímo v aplikaci: uživatel registrované firmy si v „Můj účet“ stáhne své údaje (profil, přihlášená zařízení a aplikace, bezpečnostní deník) a odpojí spárované aplikace, správce firmy stáhne všechna data firmy ve strojově čitelném formátu (JSON a soubory), odebere zaměstnance a požádá o zrušení účtu firmy.",
    ],
  },
];
