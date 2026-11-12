# Zadání fáze 102 – lišta cookies (§ 89 ZEK, Consent Mode v2), telemetrie prvních stran, kontakty z trenažéru, ARES a tržní data

Vloženo z chatu 2026-11-12 (po nasazení fáze 101). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Chceme na `https://eldock.cz` nasadit profesionální systém pro souhlas s cookies (podle vzoru Alza.cz – v souladu s českým zákonem § 89 ZEK a Google Consent Mode v2) a zároveň vybudovat vlastní analytický a lead-capture engine, abychom maximálně vytěžili data z návštěvníků webu pro budoucí obchod a marketing.

Zapiš tuto úlohu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: COOKIE CONSENT LIŠTA DLE ČESKÉ LEGISLATIVY + GOOGLE CONSENT MODE V2 (`CookieConsentBanner.tsx`)
================================================================================

Vytvoř čistou, důvěryhodnou spodní/plovoucí lištu pro souhlas s cookies (`src/components/analytics/CookieConsentBanner.tsx`), která se zobrazí novým návštěvníkům na všech veřejných i aplikačních stránkách:

1. **Vzhled a texty (po vzoru profesionální lišty Alza.cz, sladěné s inženýrským dark-mode designem ELDOCKu):**
   - **Nadpis:** `🍪 Nastavení soukromí a souborů cookies`
   - **Text:** *"My, platforma ELDOCK.cz, používáme soubory cookies a další údaje k zajištění spolehlivého chodu inženýrských nástrojů (ukládání rozpracovaných půdorysů a rozváděčů) a s vaším souhlasem také k analýze návštěvnosti a personalizaci obsahu a reklamy. Kliknutím na „Rozumím a přijímám“ souhlasíte s využíváním všech cookies."* + rozbalovací odkaz `⌄ Více informací a přehled kategorií`.
   - **3 jasná akční tlačítka vpravo (stejně dostupná dle požadavků ÚOOÚ):**
     1) **`[ Rozumím a přijímám ]`** *(Výrazné primární tlačítko – uloží plný souhlas: `necessary: true, analytics: true, marketing: true`)*
     2) **`[ Podrobné nastavení ]`** *(Otevře přehled přepínačů: 1. Nezbytné technické a funkční cookies [Vždy aktivní], 2. Analytické a výkonnostní cookies [GA4, Clarity], 3. Marketingové a remarketingové cookies [Seznam Sklik, Google Ads, LinkedIn] + tlačítko `Uložit vybrané`)*
     3) **`[ Odmítnout vše ]`** *(Uloží pouze nezbytné technické cookies: `necessary: true, analytics: false, marketing: false`)*
   - V patičce webu přidej nenápadný odkaz `Nastavení cookies`, kterým lze lištu kdykoliv znovu otevřít a změnit volbu.

2. **Integrace Google Consent Mode v2 + Seznam Sklik / Microsoft Clarity (`AnalyticsProvider.tsx`):**
   - Ve výchozím stavu před kliknutím uživatele nastav `gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })`.
   - Jakmile uživatel klikne na `Rozumím a přijímám` (nebo povolí analytiku/marketing v podrobném nastavení), okamžitě zavolej `gtag('consent', 'update', ...)` s hodnotou `'granted'`, ulož volbu s časovým razítkem do `localStorage` (`eldock_cookie_consent_v1`) a do cookie a aktivuj skripty pro `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID` a `NEXT_PUBLIC_SKLIK_ID` (pokud jsou v `.env` vyplněny).

================================================================================
ČÁST 2: VLASTNÍ 1ST-PARTY PRODUKTOVÁ TELEMETRIE BEZ ZÁVISLOSTI NA TŘETÍCH STRANÁCH (`/api/telemetry`)
================================================================================

Abychom měli 100% přehled o tom, co návštěvníci na webu dělají, i když mají zapnutý AdBlock nebo odmítnou reklamní cookies třetích stran, vytvoř lehkou interní analytiku prvních stran (bez ukládání osobních identifikátorů u nepřihlášených uživatelů):

1. Vytvoř úložiště událostí (tabulka/model nebo strukturovaný JSONL/SQLite log zpřístupněný v `/superadmin`) a endpoint `POST /api/telemetry`, který zaznamenává klíčové obchodní a produktové události:
   - `page_view` (vstupní stránka, `utm_source`, `utm_medium`, `utm_campaign`, `referrer` – odkud přesně člověk přišel: Google, Seznam, Facebook skupina, LinkedIn, přímý vstup),
   - `sandbox_started` (který trenažér si návštěvník spustil: `2D Půdorys 4+kk`, `AI Panel Builder`, `Průmyslový BIM závod`, `Zdravotnictví`, `Obchodní centrum`),
   - `series_selected` (kterého výrobce a designovou řadu vypínačů si lidé nejčastěji vybírají: např. `ABB Levit`, `ABB Zoni`, `Schneider Nová Unica`),
   - `switchboard_generated` (počet modulů, výrobce přístrojů `ABB / Eaton / OEZ / Schneider`, typ prostoru `RD / OC BD4 / Zdravotnictví`),
   - `export_clicked` (pokus o export PDF elaborátu, DXF výkresu nebo XLSX kusovníku),
   - `lead_captured` (zachycený e-mail / IČO).

================================================================================
ČÁST 3: CHYTRÉ CHYTÁNÍ KONTAKTŮ V TRENAŽÉRU („MICRO-LEAD CAPTURE“) + OBOHACENÍ PŘES ARES DLE IČO
================================================================================

1. **Zachycení e-mailu u nepřihlášených návštěvníků v Trenažéru (`LeadCaptureModal.tsx`):**
   - Když si nepřihlášený návštěvník zkouší 2D Půdorys nebo AI Panel Builder v režimu Trenažéru / Demo scénáře a klikne na **`Export XLSX / CSV kusovníku`**, **`Tisk 6listového PDF elaborátu`** nebo **`Uložit projekt`**, zobraz přívětivé okno:
     * **`📩 Kam vám máme poslat hotový kusovník a PDF dokumentaci?`**
     * Pole: `Váš e-mail`, volitelné pole `IČO firmy (automaticky doplníme vaše razítko z ARESu)` a volba zaměření (`[⚡ Jsem montážní elektrikář / revizák]`, `[📐 Jsem projektant]`, `[🏭 Řeším údržbu závodu / budovy]`).
     * Tlačítko: **`[ Stáhnout dokumentaci & získat 45 kreditů zdarma → ]`**.
     * Ulož tento kontakt do databáze zachycených leadů (včetně informace, jaký půdorys nebo rozváděč si vytvořil a odkud na web přišel!), a rovnou mu povol stažení souboru nebo jednoklikové dokončení registrace.

2. **Automatické obohacení firemních dat z registru ARES podle IČO (`/api/ares?ico=...`):**
   - Vytvoř/rozšiř endpoint `/api/ares`, který po zadání 8místného IČO (při registraci, v nastavení firemního razítka nebo v Lead Capture okně) dotazuje veřejné API Ministerstva financí ČR (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/<ICO>`) a automaticky načte:
     * Oficiální název firmy / živnostníka,
     * Adresu sídla a DIČ,
     * Seznam oborů činnosti **`CZ-NACE`** (podle kterého automaticky poznáme, zda jde o elektromontážní firmu `43210`, projekční kancelář `7112`, výrobní podnik nebo zdravotnické zařízení!).

================================================================================
ČÁST 4: PŘEHLEDNÝ MARKETINGOVÝ & OBCHODNÍ DASHBOARD V `/superadmin`
================================================================================

Do administrace `/superadmin` přidej novou záložku **`📈 Návštěvnost, Leady & Tržní data`**, kde jako majitel na jeden pohled uvidím:
1. **Trychtýř návštěvníků (Conversion Funnel):**
   - `Návštěvy webu (podle zdroje: Google / Seznam / Facebook / LinkedIn / Přímé)` ➔ `Spuštěný Trenažér (Půdorys / Rozváděč / BIM)` ➔ `Zachycené e-maily & Leady` ➔ `Registrované firmy`.
2. **Tabulka zachycených kontaktů a firem (s daty z ARESu):**
   - Seznam všech lidí a firem (e-mail, IČO, název firmy z ARESu, obor NACE, co v aplikaci testovali, kolik okruhů/rozváděčů navrhli) s tlačítkem **`[ 📥 Exportovat kontakty do CSV ]`** pro budoucí oslovení a e-mailing.
3. **Statistika obliby značek a řad (Tržní inteligence pro jednání s výrobci):**
   - Živý žebříček: které designové řady vypínačů (`Levit`, `Zoni`, `Tango`, `Unica`...) a které značky jističů (`ABB`, `Eaton`, `OEZ`, `Schneider`) uživatelé v projektech nejčastěji osazují a jaký objem materiálu (metry kabelů, počet krabiček KOPOS, počet modulů) už přes ELDOCK prošel.
4. **Přehled souhlasů s cookies (GDPR / ZEK audit log):**
   - Poměr `Přijato vše` vs. `Pouze nezbytné` pro kontrolu funkčnosti Consent Mode v2.

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

- Napiš unit a E2E testy ověřující:
  1) Že se novému návštěvníkovi zobrazí `CookieConsentBanner` s tlačítky `Rozumím a přijímám`, `Podrobné nastavení` a `Odmítnout vše` a že po kliknutí se volba uloží a banner zmizí.
  2) Že endpoint `/api/telemetry` přijímá a ukládá události a že v `/superadmin` se vykresluje sekce `Návštěvnost, Leady & Tržní data`.
  3) Že ARES lookup správně doplní firemní údaje podle IČO.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Mantinely zákona (zadání chce „maximálně vytěžit data“ – implementace jde jen tam, kam zákon dovolí):**

- Bez souhlasu se do prohlížeče nic nezapisuje ani nečte kromě cookie volby (§ 89 odst. 3 ZEK) – vlastní telemetrie
  pak posílá jen souhrnnou událost bez identifikátoru; server neukládá IP adresu (jen pro omezení četnosti v paměti
  procesu) ani user-agent, odkaz jen jako doménu, cestu stránky bez parametrů. Pseudonymní id prohlížeče
  (`eldock_vid`) jen se souhlasem s analytikou. Právní základ souhrnné statistiky = oprávněný zájem (popsaný
  v zásadách, právo námitky).
- Služby třetích stran (GA4, Clarity, Sklik, Google Ads, LinkedIn) se načtou až po souhlasu („basic“ Consent Mode –
  bez souhlasu Google nedostane ani anonymní ping); výchozí `gtag('consent','default', …denied)` je první skript stránky.
- „Rozumím a přijímám“ a „Odmítnout vše“ jsou na první vrstvě lišty stejně velké (požadavek ÚOOÚ ze zadání); souhlas
  jen zvýrazněný barvou, odmítnutí je plné tlačítko, ne odkaz.
- Kontakt z trenažéru: e-mail pro zaslání dokumentace a registraci (oprávněný zájem), obchodní sdělení e-mailem jen se
  samostatným, předem nezaškrtnutým souhlasem (§ 7 zákona č. 480/2004 Sb.) – vede přes stávající newsletter s dvojím
  potvrzením. Export CSV má sloupec souhlasu; oslovovat e-mailem jen kontakty se souhlasem.
- Zásady ochrany osobních údajů 1.4 (12. 11. 2026) popisují telemetrii, kontakty, ARES a nové služby. Před ostrým
  prodejem je i nadále nechat zkontrolovat právníkem.

**1. Lišta a Consent Mode v2 (`CookieConsentBanner.tsx`, `AnalyticsProvider.tsx`, `consent-store.ts`, `src/lib/consent.ts`):**

- Postaveno na souhlasu z fáze 56 (cookie `eldock_consent`, záznam volby `ConsentRecord` pro prokázání bez IP adresy);
  verze souhlasu 2 – starší volby se zeptají znovu. Lišta se ukáže vždy (kategorie analytika = vlastní produktová
  analytika; marketing podle zadání vždy, bez nastavené služby s poznámkou „web teď žádnou nepoužívá“).
- ID služeb čte server za běhu (`/api/consent` z `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID`,
  `NEXT_PUBLIC_SKLIK_ID`, navíc `NEXT_PUBLIC_GOOGLE_ADS_ID` a `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`; dřívější
  `ELDOCK_GA4_ID` platí dál) – statické stránky by si ID z buildu „zapekly“ a build na serveru `.env` nemá; proměnné
  předává `docker-compose.yml`. Na produkci zatím žádné ID nastavené není – služby třetích stran se zapnou doplněním
  do `.env` na serveru (to dělá majitel).
- Kopie volby s časovým razítkem v localStorage `eldock_cookie_consent_v1`; odvolání smaže cookies služeb a `eldock_vid`.
- Odkaz „Nastavení cookies“ v patičce existoval (fáze 56) – otevírá podrobné nastavení s „Uložit vybrané“.

**2. Telemetrie (`POST /api/telemetry`, model `TelemetryEvent`, `src/lib/telemetry.ts`, `telemetry-client.ts`):**

- `page_view` při každém přechodu stránky (vstup = první stránka z jiného webu nebo přímo), zdroj Google / Seznam /
  Facebook / LinkedIn / přímé / jiné z UTM a domény odkazu; `sandbox_started` (demo scénáře RD 4+kk / Zdravotnictví /
  Obchodní centrum a tréninkové zakázky AI Panel Builderu zapisuje server, vzorový BIM závod a trenažér 2D půdorysu
  prohlížeč), `series_selected` (výběr řady v kartě designu), `switchboard_generated` (server po vzniku rozváděče
  z půdorysu nebo soupisu: moduly, přístroje, výrobci z katalogu, typ prostoru), `export_clicked` (CSV / XLSX
  kusovníku, tisk elaborátu, uložení projektu, DXF výkresu), `lead_captured` (server). Roboti se zahodí, nejvýš 120
  událostí za minutu z jedné adresy. Serverové události AdBlock nezablokuje.

**3. Kontakty z trenažéru (`LeadCaptureModal.tsx`, model `Lead`, `captureLeadAction`, `src/server/services/leads.ts`):**

- „Nepřihlášený návštěvník“ = ukázková firma Tester (trenažér, demo scénáře – sdílený účet bez vlastní registrace).
  Okno při exportu CSV / XLSX kusovníku, tisku 6listového PDF elaborátu a uložení projektu (.eldock); po odeslání se
  akce rovnou provede a nabídne se „Dokončit registraci (45 kreditů)“. Funkční cookie `eldock_lead` (30 dní) si
  pamatuje zadaný kontakt (okno se znovu neptá).
- IČO: náhled firmy z ARES už v okně, na serveru doplnění názvu, sídla, DIČ a CZ-NACE. Registrace z odkazu kontaktu
  (`/panel-builder/auth?tab=register&lead=…`) má předvyplněný e-mail, IČO a firmu a dostane 45 kreditů (token jen
  jednou); z ukázkové firmy jde registrace otevřít (dřív přesměrovala pryč). „Jednoklikové“ dokončení = předvyplněný
  formulář – heslo, telefon a souhlas s podmínkami musí uživatel zadat sám.

**4. ARES (`/api/ares`, `src/server/services/ares.ts`, `src/lib/ares.ts`):** obory `czNace` z odpovědi a zaměření
podle CZ-NACE (43.21 elektromontáže, 71.12 projekce, 86 zdravotnictví, 10–33 výroba, 68.32 / 81.10 správa budov);
výsledek drží proces 24 hodin. Registrace i firemní razítko používají stejný endpoint jako dřív.

**5. Velín – „📈 Návštěvnost, Leady & Tržní data“ (`MarketTab.tsx`, `src/server/queries/market.ts`):** trychtýř za
7 / 30 / 90 dní / rok, tabulka kontaktů s daty z ARES a export CSV (`/superadmin/leads-export`), oblíbenost řad
(přístroje v uložených půdorysech + výběry) a značek přístrojů v rozváděčích, objem materiálu (metry kabelů a krabice
z kusovníku uložených půdorysů – nejnovějších 300, výpočet drží proces 10 minut; moduly z projektů) a poměr souhlasů.
