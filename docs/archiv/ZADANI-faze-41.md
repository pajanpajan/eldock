# Zadání fáze 41 (vloženo 2026-11-03 do sekce B plánu)

Přecházíme do další fáze, ve které obchodně a funkčně oddělíme "ELDOCK AI Panel Builder" (jako samostatný zpeněžitelný produkt s vlastní registrací firmy a propisem údajů do PDF) od hlavního systému "ELDOCK Správa závodů a revizí".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 6 bodech:

1. DATOVÝ MODEL PRO REGISTROVANÉ FIRMY A PRÁVNÍ SOUHLASY (Prisma migrace):
Vytvoř v "prisma/schema.prisma" model "RegisteredCompany" (a čistou migraci):
- id (String @id @default(cuid()))
- productScope (enum: "PANEL_BUILDER" | "PLANT_MANAGEMENT") – určuje, do kterého produktu je firma registrovaná
- ico (String) – IČO firmy
- dic (String?) – DIČ firmy
- companyName (String) – Obchodní název firmy (propisuje se jako Výrobce rozváděče)
- street (String) – Ulice a č.p.
- city (String) – Město
- zip (String) – PSČ
- contactName (String) – Jméno a příjmení odpovědné osoby / projektanta
- email (String @unique) – Přihlašovací e-mail
- phone (String) – Kontaktní telefon
- passwordHash (String) – Bezpečný hash hesla (scrypt / pbkdf2 přes node:crypto)
- authorizationNumber (String?) – Volitelné ev. č. oprávnění / osvědčení TIČR (NV 190/2022 Sb.)
- termsAcceptedAt (DateTime) – Přesný čas odsouhlasení VOP a přenesení odpovědnosti
- termsVersion (String @default("1.0-2026-11")) – Verze odsouhlasených podmínek
- creditsRemaining (Int @default(5)) – Počet volných kreditů/projektů pro testery
- plantId (String?) – Vazba na vlastní Plant (u firem registrovaných do PLANT_MANAGEMENT)
- Vazba "companyId String?" na "PanelBoardProject", aby každý registrovaný uživatel v Panel Builderu viděl pouze své vlastní rozváděče a měl v nich automaticky vyplněné své firemní údaje.

2. NAPOJENÍ NA REGISTR ARES (/api/ares):
- Vytvoř endpoint "GET /api/ares?ico=..." který zavolá veřejné REST API registru ARES ("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}") a vrátí JSON: { companyName, ico, dic, street, city, zip }.
- Ve formuláři registrace po zadání 8místného IČO (nebo kliknutí na "Načíst z ARES") automaticky předvyplň název firmy, DIČ a kompletní sídlo. Pokud je ARES nedostupný, umožni údaje vyplnit ručně.

3. SAMOSTATNÝ BANNER NA DOMOVSKÉ OBRAZOVCE (/) A ODDĚLENÍ NAVIGACE:
- Na veřejné úvodní stránce ("/") vytvoř výrazný samostatný produktový banner / sekci:
  "⚡ ELDOCK AI Panel Builder – Výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty".
  Tlačítka na banneru: "[ 🚀 Spustit AI Panel Builder (Registrace / Přihlášení) ]" -> vede na "/panel-builder/auth".
- Druhá hlavní sekce na úvodní stránce reprezentuje celozávodní platformu:
  "🏭 ELDOCK Průmyslový dok – Správa výrobních závodů, dokumentace a revizí" -> tlačítka "[ Registrovat výrobní závod ]" ("/register-plant") a "[ Přihlásit se / Demo závodu ]" ("/login").
- STRIKTNÍ ODDĚLENÍ PRODUKTŮ:
  * Z hlavní horní navigace ("AppHeader") v systému pro správu závodů (/plant, /inspections, /cae, /studio, /admin) ODSTRAŇ položku "Panel Builder"! V závodním systému je pouze správa závodů, budov, dokumentace, červenky a revizí.
  * Sekce "/panel-builder/*" dostane svou vlastní samostatnou horní lištu ("PanelBuilderHeader"), kde je logo "ELDOCK AI Panel Builder", název přihlášené firmy + IČO, počet zbývajících testovacích kreditů, tlačítko "Firemní údaje do razítka" (kde lze údaje kdykoliv upravit) a tlačítko "Odhlásit".

4. REGISTRACE A PŘIHLÁŠENÍ DO AI PANEL BUILDERU (/panel-builder/auth) + PRÁVNÍ VÝLUKA ODPOVĚDNOSTI:
- Pokud nepřihlášený uživatel klikne na banner AI Panel Builderu nebo vstoupí na "/panel-builder", přesměruj ho na "/panel-builder/auth".
- Stránka "/panel-builder/auth" má dvě záložky: "Přihlášení" (e-mail + heslo, plus rychlé tlačítko "Vyzkoušet předvyplněný Tester účet" pro snadné testování) a "Registrace firmy (Tester)".
- Registrační formulář vyžaduje:
  * IČO (s tlačítkem "Doplnit z ARES"), Obchodní název firmy, DIČ (volitelné), Ulice a č.p., Město, PSČ.
  * Jméno a příjmení odpovědné osoby, E-mail, Telefon, Ev. č. oprávnění TIČR (volitelné), Heslo.
- POVINNÝ PRÁVNÍ SOUHLAS A PŘENESENÍ ODPOVĚDNOSTI:
  * Pod formulářem musí být povinný zaškrtávací box (s možností rozkliknout celé znění v modalu "Obchodní podmínky a vyloučení odpovědnosti"):
    "Souhlasím s Obchodními podmínkami a výslovně beru na vědomí, že nástroj ELDOCK AI Panel Builder slouží výhradně jako pomocný softwarový nástroj. Veškerou odbornou, technickou a právní odpovědnost za správnost návrhu, dimenzování přístrojů, výpočet oteplení, provedení kusové zkoušky a shodu rozváděče s ČSN EN 61439 a platnými bezpečnostními předpisy nese výhradně uživatel (výrobce rozváděče / projektant), nikoliv provozovatel platformy Eldock."
  * Bez zaškrtnutí tohoto souhlasu nelze registraci odeslat.

5. AUTOMATICKÝ PROPIS FIREMNÍCH ÚDAJŮ DO 6LISTOVÉ PDF DOKUMENTACE ROZVÁDĚČE:
- Když přihlášená firma v AI Panel Builderu založí nový rozváděč (nebo otevře svůj projekt), automaticky propisuj její registrační údaje (companyName, ico, dic, street, city, zip, contactName, phone, email, authorizationNumber) do dat výrobce rozváděče:
  * List 1 (Titulní strana): Kompletní blok "Výrobce rozváděče" (Název firmy, IČO, DIČ, adresa sídla, odpovědná osoba, telefon, e-mail).
  * Listy 1–6 (Rohové razítko): Název firmy a jméno zpracovatele (`contactName`).
  * List 6 (EU Prohlášení o shodě a Výrobní štítek CE): V prohlášení o shodě je přímo vyplněná zaregistrovaná firma, její sídlo a IČO jako "Výrobce, který tímto na svou výhradní odpovědnost prohlašuje..." + jméno odpovědné osoby u podpisu. Na výrobním štítku se značkou CE je vypsán název firmy a sídlo výrobce.
- Před kliknutím na "Vytisknout / Exportovat kompletní PDF elaborát" v Kroku 4 přidej potvrzovací checkbox:
  "✅ Potvrzuji, že jsem veškeré rozpoznané přístroje, schéma zapojení i výpočet oteplení odborně zkontroloval(a) a přebírám za dokumentaci plnou odpovědnost výrobce rozváděče."

6. REGISTRACE PRO VÝROBNÍ ZÁVODY (/register-plant):
- Vytvoř registrační stránku "/register-plant" pro druhý produkt (Správa závodů, dokumentace a revizí):
  * Formulář načte přes IČO/ARES údaje firmy, doplní název prvního závodu (např. "Hlavní výrobní závod"), kontaktní osobu, e-mail, telefon, heslo a souhlas s VOP.
  * Po registraci v jedné transakci založí "RegisteredCompany" (scope: PLANT_MANAGEMENT), nový "Plant" s čistou mapou areálu, uživatele v roli Technického ředitele ("PLANT_ADMIN") a rovnou ho přihlásí do jeho nového závodu (kde může ve Studiu stavět budovy, nahrávat dokumentaci a řídit revize – bez Panel Builderu).

Ověř vše přes "npm run verify", uprav a doplň unit i E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.
