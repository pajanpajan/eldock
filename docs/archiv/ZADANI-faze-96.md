# Zadání fáze 96 – viditelnost a indexace eldock.cz ve vyhledávačích (Google.cz, Seznam.cz, Bing, AI vyhledávače)

Vloženo z chatu 2026-11-11 (během fáze 95). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Potřebujeme, aby byl web `https://eldock.cz` maximálně viditelný a zaindexovaný ve vyhledávačích **Google.cz**, **Seznam.cz** a **Bing** (včetně AI vyhledávačů).

HLAVNÍ PROBLÉM SOUČASNÉHO STAVU:
Většina podstránek (`/panel-builder/floorplan`, `/panel-builder/catalog` atd.) vrací nepřihlášeným robotům vyhledávačů (`Googlebot`, `SeznamBot`, `bingbot`) přesměrování `307` na přihlašovací stránku `/panel-builder/auth`. Vyhledávače tak vidí jen úvodní stránku `/` a login!

Zapiš tuto úlohu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 6 krocích:

================================================================================
1. ODEMČENÍ VEŘEJNÝCH STRÁNEK PRO VYHLEDÁVAČE (`middleware.ts`) + VEŘEJNÝ KATALOG
================================================================================

- Uprav `src/middleware.ts` tak, aby kromě `/` a `/ukazka-elaboratu` vracely stav **`200 OK` bez přesměrování na login** i všechny veřejné produktové, katalogové a SEO stránky:
  * `/panel-builder` (veřejná vstupní stránka AI Panel Builderu s ukázkou a trenažérem – přihlášení vyžaduj až při ukládání vlastního projektu do cloudu nebo tisku s firemním razítkem!)
  * `/panel-builder/catalog` (veřejný katalog přístrojů ABB, Eaton, OEZ, Schneider, Legrand, Hager, Loxone, TapHome – obrovský zdroj organické návštěvnosti z vyhledávání konkrétních typů přístrojů!)
  * `/navody`
  * Všechny nové SEO vstupní stránky níže!

================================================================================
2. VYTVOŘENÍ 5 VYSOCE KONVERZNÍCH SEO VSTUPNÍCH STRÁNEK (SSR `200 OK`)
================================================================================

Vytvoř 5 veřejně přístupných, obsahově bohatých a rychlých Server Component stránek s perfektní strukturou nadpisů (`H1`, `H2`, `H3`), srovnávacími tabulkami, ukázkami, často kladenými otázkami (`FAQ`) a přímými tlačítky pro vyzkoušení nástroje:

1) **`/ai-panel-builder` – Návrh rozváděče online a dokumentace dle ČSN EN IEC 61439:**
   - Cílová klíčová slova: *návrh rozváděče online, program na kreslení rozváděčů, výrobní dokumentace rozváděče, schéma rozváděče z fotky, ČSN 33 2130 ed. 4*.
   - Obsah: Jak funguje pasportizace rozváděče z fotky/videa i návrh od nuly, automatické PE a N sběrnice, vyvážení fází, Elektro-linter dle ČSN 33 2130 ed. 4, ukázka 6listového PDF elaborátu a tlačítko `[ ⚡ Vyzkoušet AI Panel Builder zdarma ]`.

2) **`/2d-pudorys-elektroinstalace` – Kreslení elektroinstalace do půdorysu a výkaz kabelů:**
   - Cílová klíčová slova: *návrh elektroinstalace v půdorysu, program na elektroinstalaci v domě, výpočet délky kabelů z půdorysu, rozmístění zásuvek a vypínačů, chytrá domácnost ABB free@home Loxone TapHome*.
   - Obsah: Nahrání PDF/DXF/BIM (.ifc) půdorysu nebo složení místností X×Y, obvodové trasování kabelů dle ČSN, koupelnové zóny ČSN 33 2000-7-701, hlídání hloubky krabiček KOPOS a vygenerování rozváděče z půdorysu na 1 klik.

3) **`/vypocet-otepleni-rozvadece` – Výpočet oteplení rozváděče dle ČSN EN IEC 61439 a IEC TR 60890:**
   - Cílová klíčová slova: *výpočet oteplení rozváděče, IEC TR 60890 kalkulačka, tepelná bilance rozváděče, ztrátový výkon přístrojů v rozváděči*.
   - Obsah: Vysvětlení metodiky IEC TR 60890, proč revizní technici a TIČR vyžadují výpočet oteplení, interaktivní náhled výpočtu (součet $P_v$ [W], chladicí plocha skříně $A_e$, teplota ve středu a horní části skříně $\Delta t_{0.5}$ a $\Delta t_{1.0}$) a přechod do kalkulačky v Panel Builderu.

4) **`/kusova-zkouska-rozvadece` – Protokol o kusové zkoušce, EU prohlášení o shodě a výrobní štítek CE:**
   - Cílová klíčová slova: *protokol o kusové zkoušce rozváděče vzor, EU prohlášení o shodě rozváděč, výrobní štítek rozváděče CE, protokol o určení vnějších vlivů*.
   - Obsah: Co musí obsahovat dokumentace každého vyrobeného rozváděče dle zákona č. 90/2016 Sb. a ČSN EN IEC 61439-1 ed. 3, vzorové náhledy protokolů a generování na 1 klik.

5) **`/prumyslova-udrzba-a-revize` – Digitální dvojče závodu, QR diagnostika strojů a Nařízení EU 2023/1230:**
   - Cílová klíčová slova: *správa elektro dokumentace ve výrobě, revize elektrických zařízení a strojů, elektronická červenka schémat, zálohování PLC programů, podstatná změna stroje EU 2023/1230*.
   - Obsah: Přínosy pro vedoucí údržby, energetiky nemocnic a správce obchodních center (BIM import `.ifc`, 3 úrovně zálohování Síť/DA/UPS, QR štítky na rozváděčích, Kniha revizí).

Prolinkuj všechny tyto stránky z patičky (`Footer`) úvodní stránky `/`, aby na ně Googlebot a SeznamBot okamžitě našly přímé HTML odkazy (`<a href="...">`)!

================================================================================
3. KOMPLETNÍ `sitemap.ts`, `robots.ts` A STRUKTUROVANÁ DATA `JSON-LD`
================================================================================

1. **`src/app/robots.ts` (`/robots.txt`):**
   - Explicitně povol indexaci (`Allow: /`) pro všechny klíčové roboty: `*`, `Googlebot`, `SeznamBot`, `bingbot`, `OAI-SearchBot`, `GPTBot`, `PerplexityBot`, `ClaudeBot`.
   - Zakáž pouze interní API a privátní admin routy (`Disallow: ['/api/', '/superadmin']`).
   - Uveď přesný odkaz `Sitemap: https://eldock.cz/sitemap.xml` a `Host: https://eldock.cz`.

2. **`src/app/sitemap.ts` (`/sitemap.xml`):**
   - Zahrň všechny veřejné URL s prioritami (`1.0` pro `/`, `0.95` pro `/panel-builder`, `/ai-panel-builder`, `/2d-pudorys-elektroinstalace`, `/vypocet-otepleni-rozvadece`, `/kusova-zkouska-rozvadece`, `/prumyslova-udrzba-a-revize`, `/ukazka-elaboratu`, `/panel-builder/catalog`, `/navody`).

3. **Strukturovaná data `JSON-LD` (Schema.org) a Meta tagy (`src/app/layout.tsx` a podstránky):**
   - Do hlavního layoutu a SEO stránek vlož validní `<script type="application/ld+json">` se schématy:
     * `SoftwareApplication` (název `ELDOCK`, kategorie `BusinessApplication / CADSoftware`, operační systém `Web`, jazyk `cs-CZ`, nabídka vyzkoušení zdarma),
     * `Organization` / `WebSite`,
     * `FAQPage` (s nejčastějšími dotazy elektrikářů a revizních techniků u každé vstupní stránky).
   - Přidej do `src/app/layout.tsx` podporu pro ověřovací meta tagy `verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: { 'seznam-wmt': process.env.SEZNAM_WMT_VERIFICATION } }`, kanonické URL (`alternates.canonical`) a české OpenGraph tagy (`locale: 'cs_CZ'`).

================================================================================
4. AUTOMATICKÉ ODESLÁNÍ DO SEZNAM.CZ A BINGU PŘES PROTOKOL `IndexNow`!
================================================================================

Seznam.cz (`https://search.seznam.cz/indexnow`) a Microsoft Bing (`https://api.indexnow.org/indexnow`) podporují okamžitou indexaci přes protokol **IndexNow** bez nutnosti ruční registrace!
1. Vygeneruj pevný 32znakový hexadecimální klíč (např. `eldock2026indexnowkey918118002cz`) a ulož ho jako veřejně dostupný soubor `public/<KEY>.txt` (obsahující tento klíč), aby byl dostupný na `https://eldock.cz/<KEY>.txt`.
2. Vytvoř skript `scripts/seo-indexnow-ping.mjs` (a přidej `"seo:ping": "node scripts/seo-indexnow-ping.mjs"` do `package.json`), který vezme seznam všech veřejných URL z naší sitemapy a odešle je přes `POST` (JSON payload s `host: "eldock.cz"`, `key`, `keyLocation` a `urlList`) a `GET` ping přímo na:
   - `https://search.seznam.cz/indexnow` (Seznam.cz vyhledávač!)
   - `https://api.indexnow.org/indexnow` (Bing, Yandex, Seznam a partnerské vyhledávače!)
3. Vytvoř také API endpoint `POST /api/seo/ping` (nebo automatický krok po deployi), abychom při každém nasazení nové verze automaticky upozornili Seznam.cz a Bing na aktualizované stránky!

================================================================================
5. KONTROLA A SPUŠTĚNÍ INDEXACE ROVNOU ZE SERVERU
================================================================================

1. Napiš testy ověřující, že:
   - Všech 5 nových SEO stránek (`/ai-panel-builder`, `/2d-pudorys-elektroinstalace`, `/vypocet-otepleni-rozvadece`, `/kusova-zkouska-rozvadece`, `/prumyslova-udrzba-a-revize`) i `/panel-builder/catalog` vrací nepřihlášenému robotovi status `200 OK` (žádné `307`!).
   - `/robots.txt`, `/sitemap.xml` a IndexNow klíč `/<KEY>.txt` vracejí status `200 OK`.
2. Spusť `npm run verify`, udělej commit, pushni a nasaď změny na produkční server `https://eldock.cz`.
3. Hned po nasazení na produkci spusť `npm run seo:ping` a vypiš mi do terminálu potvrzení (HTTP status kód 200 / 202) ze serveru **Seznam.cz (`search.seznam.cz/indexnow`)** a **IndexNow (`api.indexnow.org`)**, že obdržely seznam všech našich stránek!

## Rozhodnutí při implementaci

- **Brána:** v Next.js 16 je middleware v `src/proxy.ts`. Bez přihlášení (200 i pro roboty) nově projde
  `/panel-builder`, `/panel-builder/catalog` a 5 SEO stránek; `/`, `/ukazka-elaboratu` a `/navody` byly veřejné už dřív
  a nové stránky veřejného webu by prošly i bez seznamu (nejsou trasou Správy závodů ani Panel Builderu) – v
  `PUBLIC_PATHS` jsou výslovně. Editor půdorysu, trenažér, projekty a další stránky AI Panel Builderu dál vyžadují
  přihlášenou firmu (ukládání do cloudu, kredity, razítko firmy).
- **`/panel-builder` bez firmy** = veřejná vstupní stránka (H1, funkce, 5 kroků, odkazy na ukázku elaborátu, trenažér
  po přihlášení, katalog a SEO stránky); s přihlášenou firmou beze změny přehled projektů. **Katalog** bez firmy jen ke
  čtení: místo importu datasheetu odkaz na přihlášení, místo náhledu datasheetu přes účet přímý odkaz na datasheet.
- **5 SEO stránek** (Server Components ve veřejném webu): obsah je jen v `src/lib/seo-landings.ts` (H1, úvod, tlačítka,
  sekce H2 s bloky H3, srovnávací tabulka, 4–5 častých dotazů, související stránky), šablona `SeoLandingPage` s drobečkovou
  navigací, patičkou, JSON-LD BreadcrumbList + FAQPage a kanonickou URL. Výpočet oteplení má interaktivní náhled nad
  stejným výpočtem jako kalkulačka Panel Builderu (`calculateThermal` – Pv, Ae, Δt0,5, Δt1,0). Texty popisují jen to,
  co aplikace opravdu umí (např. bez „kontroly selektivity“, aplikace offline jen Windows / Android).
- **robots.txt:** pravidlo pro každého robota (*, Googlebot, SeznamBot, bingbot, OAI-SearchBot, GPTBot, PerplexityBot,
  ClaudeBot) s `Allow: /` a `Disallow: /api/`, `/superadmin`; dřívější zákazy aplikačních tras zrušené podle zadání
  (bez přihlášení vrací přesměrování na přihlášení). `Sitemap` a `Host` beze změny.
- **sitemap.xml:** priority podle zadání (1,0 úvod, 0,95 `/panel-builder`, katalog, ukázka, návody a 5 SEO stránek),
  ostatní veřejné stránky zůstaly.
- **JSON-LD a meta:** v hlavním layoutu Organization + WebSite + SoftwareApplication (ELDOCK, BusinessApplication /
  CADSoftware, Web, cs-CZ, vyzkoušení zdarma) – z úvodní stránky se duplicitní blok odstranil; FAQPage na každé SEO
  stránce. `verification` z `GOOGLE_SITE_VERIFICATION` a `SEZNAM_WMT_VERIFICATION` (bez proměnné se meta nevypíše).
  **Kanonická URL** není v layoutu (všechny podstránky bez vlastní by pak ukazovaly na úvod) – nastavuje ji každá
  veřejná stránka sama; OpenGraph `cs_CZ` už web měl.
- **IndexNow:** klíč je náhodný 32znakový hex (příklad ze zadání nebyl hexadecimální) v `public/<klíč>.txt` a v
  `src/lib/indexnow.ts`. `npm run seo:ping` vezme adresy z živé `sitemap.xml`, pošle POST (host, key, keyLocation,
  urlList) a GET ping s úvodní stránkou na `search.seznam.cz/indexnow` i `api.indexnow.org/indexnow` a vypíše stavy.
  `POST /api/seo/ping` dělá totéž ze serveru (Bearer `ELDOCK_CRON_SECRET` nebo přihlášený velín). Automatický ping při
  každém startu kontejneru není – ping patří do postupu nasazení (CLAUDE.md §7).
