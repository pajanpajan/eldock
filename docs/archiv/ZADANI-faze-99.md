# Zadání fáze 99 – audit před prezentací, demo scénáře na 1 klik, prezentace /prezentace a kontrola verify:demo

Vloženo z chatu 2026-11-12 (po nasazení fáze 98, prioritní – prezentace projektu následující den odpoledne). Celé zadání
beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Zítra odpoledne jdu prezentovat projekt ELDOCK (https://eldock.cz) a žádat o podporu. Celý web teď musí projít přísným technickým a vizuálním auditem, nesmí v něm zůstat žádná chyba a musíme připravit 100% spolehlivý režim pro živou ukázku (Live Demo) i samotnou prezentaci (Pitch Deck + A4 One-Pager).

Zapiš tuto úlohu jako novou prioritní fázi do `docs/PLAN.md` a kompletně ji proveď v těchto 5 částech:

================================================================================
ČÁST 1: HLOUBKOVÝ AUDIT A OPRAVA VŠECH CHYB PŘED PREZENTACÍ ("ZERO-BUG AUDIT")
================================================================================

Proveď kompletní kontrolu celého kódu a běžící aplikace a oprav každý nalezený nedostatek:

1. **Kontrola obrázků a katalogu (`DesignSeriesModal`, `SmartHomeDeviceCatalog`, krabičky KOPOS, rozvodnice):**
   - Zkontroluj všechny cesty k obrázkům v `public/catalog-images/` a `manifest.json`.
   - Přidej globální pojistku (`onError` handler + validaci existence souboru): na celé stránce se NIKDY nesmí objevit ikona rozbitého obrázku (404 broken image)! Pokud u některé položky chybí `.webp` fotka, vykresli okamžitě čistý studiový vektorový náhled.
2. **Kontrola rozlišení pro projektor a notebooky (`1366×768` a `1920×1080` při 125% škálování Windows):**
   - Otestuj v Playwrightu zobrazení `/`, `/panel-builder`, `/panel-builder/floorplan` a `/studio` na menším viewportu `1366×768`.
   - Ujisti se, že žádné tlačítko, modal (`Designové řady a barvy`, `Kusovník`, `BIM Import`) ani fázová lišta nepřetéká mimo obrazovku a že v 2D půdorysu je kreslicí plátno vždy přehledné a dostatečně velké.
3. **Kontrola přechodu 2D Půdorys ➔ AI Panel Builder ➔ 6listový PDF elaborát:**
   - Ověř, že kliknutí na `⚡ Vygenerovat rozváděč z tohoto půdorysu` proběhne okamžitě (< 1 s), přenese všechny okruhy, vyváží fáze L1/L2/L3, správně spočítá PE a N sběrnice (N1, N2 za chrániči), spočítá oteplení dle IEC TR 60890 a v Kroku 4 bez chyby vygeneruje kompletní 6listový PDF elaborát i arch samolepicích štítků 1:1.
4. **Kontrola češtiny a profesionálních textů:**
   - Projdi hlavní obrazovky a odstraň případné vývojářské poznámky, ladicí výpisy, anglické zbytky nebo překlepy.

================================================================================
ČÁST 2: REŽIM „🎯 LIVE DEMO SCÉNÁŘE (1-KLIK)“ PRO PREZENTACI
================================================================================

Při živé prezentaci není čas 10 minut ručně naklikávat místnosti a zásuvky. Vytvoř v horní liště (v `/panel-builder/floorplan`, `/panel-builder` i v průmyslovém `/`) rychlé rozbalovací menu **`[ 🎯 Demo scénáře (Prezentace) ▾ ]`**, které během 1 sekundy načte kompletní, vizuálně působivý projekt připravený k předvedení:

1. **Scénář 1: `🏠 Rodinný dům 4+kk + FVE & Smart Home (ABB Levit M / free@home)`**
   - Načte v 2D půdorysu kompletně vybavený dům (obývák, kuchyň s linkou, ložnice s postelí, koupelna s vanou, sprchou a umyvadlem, technická místnost s rozváděčem `RH`), osazený zásuvkami, spotřebiči (indukce, TČ, FVE, Wallbox), stmívatelnými světly, žaluziemi a hlubokými krabičkami KOPOS `KPR 68`.
   - Prezentující tak může během 15 vteřin přepnout mezi Fází 1 až 5, ukázat obvodové trasy kabelů, kusovník s krabičkami KOPOS a jedním klikem vygenerovat 3f rozváděč!

2. **Scénář 2: `🏥 Zdravotnická ordinace – Skupina 1 (ČSN 33 2000-7-710 ed. 2)`**
   - Načte půdorys lékařské vyšetřovny se zdravotnickou lůžkovou rampou (`LUZ`), ekvipotenciální svorkovnicí doplňujícího pospojování (`EKV`) a ukáže, jak Elektro-linter a generátor rozváděče automaticky rozdělí zásuvky vyšetřovny na 2 nezávislé okruhy pod 2 samostatné chrániče 30 mA typu A.

3. **Scénář 3: `🛍️ Obchodní centrum – Nájemní jednotka (BD4 · Bezhalogenové B2ca)`**
   - Načte obchodní jednotku v režimu `BD4 (ČSN 33 2000-7-718)` s bezhalogenovými kabely `1-CHKE-R (N2XH-J) B2ca-s1,d1,a1`, nouzovým únikovým osvětlením, vypínací spouští `CENTRAL STOP` od EPS a fakturačním MID elektroměrem.

4. **Scénář 4: `🏭 Průmyslový závod 4.0 (BIM .ifc + QR + Červenka + Legislativa 2027)`**
   - V průmyslovém portálu `/` načte kompletní výrobní závod s 2D mapou hal, 3 úrovněmi zálohování (`Běžná síť` / `Dieselagregát DA do 15 s` / `Kritická UPS do 0,5 s`), připraveným BIM (`.ifc`) modelem, QR štítky na rozváděčích, zakreslenou elektronickou Červenkou ve schématu, verzovanou zálohou PLC programu, vyhodnocením podstatné změny stroje dle Nařízení EU 2023/1230, Knihou revizí a Simulátorem připojení nového 75kW stroje.

================================================================================
ČÁST 3: INTERAKTIVNÍ PREZENTACE (PITCH DECK) NA `https://eldock.cz/prezentace`
================================================================================

Vytvoř veřejně přístupnou, vizuálně špičkovou prezentační stránku **`src/app/prezentace/page.tsx` (`https://eldock.cz/prezentace`)** (přidej ji i do `publicPaths` v `middleware.ts`), která funguje jako moderní interaktivní **Pitch Deck + One-Pager**:

1. **Ovládání prezentace:**
   - Přepínání slidů šipkami na klávesnici (`←` / `→` / `Mezerník`), klikacími tečkami dole, tlačítkem **`[ ⛶ Celá obrazovka (F11) ]`**, přepínačem **`[ 📊 Prezentace (10 slidů) ]` ⇄ `[ 📄 Executive One-Pager (Tisk A4) ]`** a tlačítkem **`[ 🖨️ Vytisknout / Uložit do PDF ]`**.
   - Přidej také nenápadné tlačítko **`[ ✏️ Upravit čísla a požadavek na podporu ]`**, které mi umožní přímo v prohlížeči před schůzkou přepsat cílovou částku podpory, jméno partnera/investora nebo kontaktní údaje (uloží se do `localStorage`), abych mohl prezentaci na místě přizpůsobit konkrétnímu jednání!

2. **Obsah 10 slidů prezentace (s přímými tlačítky pro otevření živé ukázky v novém panelu nebo modalu):**
   - **Slide 1 – Vize & Hodnota:**
     * *Nadpis:* **ELDOCK.cz – Digitální ekosystém pro návrh elektroinstalací, výrobu rozváděčů a provozní správu budov a průmyslu.**
     * *Podtitul:* Od 2D půdorysu a fotky rozváděče přes normativní výpočty až po digitální dvojče výrobního závodu, nemocnice či obchodního centra.
   - **Slide 2 – Problém na trhu (Proč vznikl ELDOCK):**
     * **1. Montážní firmy a elektrikáři (40 000+ v ČR/SK):** Ztrácejí desítky hodin měsíčně ručním počítáním kabelů z PDF půdorysů a večerním lepením výrobní dokumentace rozváděčů, kusových zkoušek a výpočtů oteplení v Excelu.
     * **2. Průmyslové závody, OC a nemocnice:** „Mrtvá“ dokumentace v papírových šanonech nebo nepoužitelných 3D BIM modelech, prostoje při nočních poruchách strojů, nepodchycené ruční změny ve schématech a přísná nová legislativa (ČSN 33 2130 ed. 4, ČSN EN IEC 61439, Nařízení EU 2023/1230 o strojních zařízeních).
   - **Slide 3 – Řešení: 3 propojené pilíře platformy ELDOCK:**
     * Přehledné vizuální schéma 3 modulů:
       1) **2D Půdorys & Kabeláž** (Fázový průvodce 1–5, obvodové trasy dle ČSN, kusovník s krabičkami KOPOS a 1-klikový přenos do rozváděče).
       2) **AI Panel Builder** (Rozváděč z fotky nebo z půdorysu za 3 minuty, Elektro-linter, oteplení dle IEC TR 60890, 6listový PDF elaborát, CE štítek a popisky 1:1).
       3) **ELDOCK Průmysl & Facility** (Nativní BIM `.ifc` import, QR štítky na rozváděčích, elektronická Červenka, zálohy PLC, 3 zdroje Síť/DA/UPS a Kniha revizí).
   - **Slide 4 – Živá ukázka 1: Bytová a komerční elektroinstalace (Od půdorysu po PDF elaborát za 3 minuty):**
     * Ukázka 5fázového průvodce + přímá akční tlačítka: **`[ 🚀 Otevřít živou ukázku: 2D Půdorys 4+kk ]`** a **`[ ⚡ Otevřít živou ukázku: AI Panel Builder & 6listové PDF ]`**.
   - **Slide 5 – Živá ukázka 2: Průmyslové závody, Obchodní centra a Nemocnice:**
     * Ukázka BIM `.ifc` importu, QR diagnostiky u stroje, Červenky a režimů BD4 (bezhalogenové kabely `B2ca`, Central Stop) a Zdravotnictví Skupina 1 (ČSN 33 2000-7-710 ed. 2) + tlačítko **`[ 🏭 Otevřít živou ukázku: Průmyslový závod & BIM ]`**.
   - **Slide 6 – Unikátní technologický náskok (Proč nás nelze snadno zkopírovat):**
     * **Exaktní inženýrské jádro (ne jen kreslítko):** Vestavěný deterministický Elektro-linter (ČSN 33 2130 ed. 4, ČSN 33 2000-7-701, 7-710, 7-718), normativní výpočet oteplení dle IEC TR 60890, automatické PE/N sběrnice a hlídač hloubky krabiček.
     * **Reálná katalogová data ETIM 9.0:** Přesná objednací čísla (MPN/EAN), ztrátové výkony ve Wattech a vestavné hloubky předních výrobců (ABB, Schneider, Legrand, Hager, Eaton, OEZ, KOPOS, Loxone, TapHome).
     * **Nativní BIM (`.ifc`) parser v prohlížeči:** Převod stavebně-elektrotechnického BIM modelu na živé provozní dvojče za 5 sekund bez drahých CAD licencí.
   - **Slide 7 – Tržní příležitost a škálování (ČR ➔ SK ➔ PL/HU ➔ DACH):**
     * Segmentace trhu:
       - *Segment A (SMB):* Živnostníci, elektromontážní firmy, revizní technici, instalační firmy FVE a TČ.
       - *Segment B (Enterprise & Facility):* Výrobní závody, obchodní centra a retail parky, nemocnice a polikliniky.
     * Mezinárodní škálovatelnost díky harmonizovaným normám IEC / EN (ČSN EN IEC 61439, IEC TR 60890, ISO 16739 IFC, ETIM 9.0).
   - **Slide 8 – Obchodní model a zdroje příjmů (Monetizace):**
     * **1. SaaS předplatné & Kreditový systém** pro montážní firmy a projektanty (okamžitá platba za vygenerovaný elaborát nebo měsíční/roční tarif).
     * **2. Roční B2B Enterprise licence** pro výrobní závody, obchodní centra a nemocnice (v limitu přímého nákupu pod 2 mil. Kč bez zdlouhavých tendrů).
     * **3. Transakční marže z kusovníků (BOM Affiliate & Rozváděče na klíč):** Jednoklikový přenos spočítaného kusovníku do e-shopů velkoobchodů a zakázková výroba rozváděčů s provizí z obratu materiálu.
   - **Slide 9 – Současný stav projektu (100% funkční produkt v produkci):**
     * Důkaz realizace: Platforma `https://eldock.cz` není prezentace nápadu na papíře, ale plně funkční, otestovaný systém běžící v cloudu s desítkami tisíc řádků inženýrského kódu, automatizovanými testy a napojeným katalogem.
   - **Slide 10 – Žádost o podporu a plán využití zdrojů (Roadmap 2026–2027):**
     * Jasně strukturovaný slide (s možností živé úpravy textu na místě):
       - **Cíl podpory / partnerství:** Akcelerace obchodního nasazení v ČR a expanze na Slovensko a do regionu CEE/DACH, přímé napojení API velkoobchodů a výrobců, certifikace a rozšíření modulu Výchozích revizních zpráv (VRZ) a automatických cenových nabídek.
       - **Rozpad využití podpory:** 1) Obchodní akvizice a B2B prodej (závody, OC, nemocnice, montážní firmy), 2) Rozvoj produktového jádra a ETIM/velkoobchodních integrací, 3) Zákaznická podpora a onboarding.
       - Kontaktní údaje: **Pavel Janoušek · ELDOCK (`https://eldock.cz`)**.

3. **Tisknutelný A4 „Executive Summary (One-Pager)“:**
   - Když uživatel na `/prezentace` přepne na `[ 📄 Executive One-Pager (Tisk A4) ]` a stiskne `Ctrl+P` (nebo tlačítko Tisk), vytiskne se čistý, reprezentativní jednostránkový dokument formátu A4 s klíčovými body projektu, architekturou, obchodním modelem, QR kódem na `https://eldock.cz` a kontakty – ideální pro rozdání lidem u stolu na začátku schůzky!

================================================================================
ČÁST 4: AUTOMATICKÝ „PRE-FLIGHT CHECK“ SKRIPT (`scripts/verify-demo-ready.mjs`)
================================================================================

Vytvoř skript `scripts/verify-demo-ready.mjs` (a přidej `"verify:demo": "node scripts/verify-demo-ready.mjs"` do `package.json`), který před zítřejší prezentací v Playwrightu otestuje:
1. Že stránka `/prezentace` vrací status `200 OK`, vykreslí všech 10 slidů i A4 One-Pager.
2. Že v `/panel-builder/floorplan` fungují všechny Demo scénáře na 1 klik, všech 5 fází průvodce a přenos do AI Panel Builderu bez jediné chyby v konzoli (`pageerror` / `console.error`).
3. Že v `/panel-builder` funguje otevření vzorového rozváděče, výpočet oteplení a Krok 4 (PDF elaborát).
4. Že v průmyslovém `/` funguje načtení vzorového BIM (`.ifc`) modelu, 2D mapa s filtry `Síť / DA / UPS`, detail stroje s Červenkou a Kniha revizí.

================================================================================
ČÁST 5: SPUŠTĚNÍ TESTŮ, COMMIT A NASAZENÍ NA PRODUKCI
================================================================================

Spusť `npm run verify` a `npm run verify:demo`, oprav případné chyby, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Demo scénáře (`src/lib/panel-builder/demo-scenarios.ts`, `server/actions/demo-scenarios.ts`):**

- Scénáře 1–3 jsou čisté nákresy 2D půdorysu; klik v nabídce „🎯 Demo scénáře (Prezentace)“ založí přihlášené firmě
  **nový** půdorys (nic nepřepíše) a otevře ho ve fázi 1 průvodce. Rozváděč z něj vzniká běžným generátorem (1 kredit) –
  stejně jako u každé zakázky, aby prezentace ukazovala skutečný produkt.
- 🏠 Rodinný dům 4+kk vychází z cvičného bungalovu fáze 92, doplněný o zásuvku u postele, sprchový kout, tepelné čerpadlo,
  střídač FVE, wallbox, okna s motory žaluzií a žaluziovými tlačítky, stmívaná světla a hluboké krabice (KOPOS KPR 68).
  Ověřeno generátorem (`services/phase99.test.ts`): 33 přístrojů, 3f hlavní vypínač, chrániče typu B pro TČ, FVE
  a wallbox, akční členy free@home (spínací, stmívací, žaluziový), SG Ready relé a elektroměr DLM.
- 🏥 Ordinace Skupiny 1: vyšetřovna s lehátkem, lůžkovou rampou LUZ, EKV a umyvadlem; generátor dá zásuvky vyšetřovny
  (i ordinace lékaře) do okruhů A / B, každý pod vlastním chráničem 30 mA typu A (RCBO = samostatný chránič s jističem).
- 🛍️ Nájemní jednotka OC (BD4): prodejna s výlohou, pokladnou, skupinami světel, LED páskem a 3 nouzovými únikovými
  svítidly, sklad a zázemí; generátor přidá vypínací spoušť CENTRAL STOP a podružný elektroměr MID, kabely a krabice
  bezhalogenové (B2ca, HF) podle typu objektu.
- 🏭 Průmyslový závod 4.0 má vlastní nabídku v hlavičce průmyslového portálu (`PlantDemoMenu`): přímé odkazy na agendy
  naposledy otevřeného závodu – mapa se vzorovým BIM modelem haly (`?bim=vzor` ho rovnou načte), rozváděče a QR štítky,
  Červenka a zálohy PLC, Kniha revizí s Nařízením (EU) 2023/1230 a simulátorem nového stroje 75 kW (`?stroj=75`)
  a interaktivní mise noční poruchy. Podle pravidla fáze 92 (oddělené světy) nabídka závodu neodkazuje do Panel
  Builderu; nabídka Panel Builderu odkazuje na průmyslový portál a na prezentaci (nová karta).
- Odkazy živé ukázky z prezentace (`/panel-builder/floorplan?demo=rd-4kk` …) po přihlášení firmy rovnou načtou scénář
  (`DemoScenarioAutostart` – jen jednou, adresa se hned vyčistí; pouhý prefetch odkazu nic nezaloží).
- Výchozí název rozváděče ve formuláři generování = „RH – <název půdorysu>“ (u výchozího názvu „Půdorys <datum>“
  zůstává „Rozvodnice RD – z půdorysu“).

**Prezentace (`src/app/prezentace/page.tsx`, `components/pitch`, `lib/pitch.ts`):**

- Veřejná bez přihlášení (`PUBLIC_PATHS` v `src/proxy.ts` – v Next.js 16 je to „middleware“ projektu), mimo vyhledávače
  (`noindex`, není v sitemap) – je pro jednání, ne pro vyhledávání.
- 10 slidů podle zadání; šipky ← / →, mezerník, Home / End, tečky dole, slide v adrese (`#slide-4`), ⛶ celá obrazovka,
  přepínač Prezentace ⇄ Executive One-Pager (A4), 🖨️ tisk / PDF (prezentace = slidy na A4 na šířku, One-Pager = jedna
  stránka A4 na výšku s QR kódem na eldock.cz). Živé ukázky se otevírají v nové kartě (aplikace potřebuje vlastní
  přihlášení a celou obrazovku), na slidu 4 i veřejný vzorový 6listový elaborát bez přihlášení.
- ✏️ Úprava čísel jednání (částka, forma podpory, partner, kontakt, rozpad využití v %) jen v localStorage prohlížeče
  prezentujícího. Prázdná částka = „podle domluvy na jednání“. Výchozí kontakt „Pavel Janoušek · ELDOCK“ s veřejnou
  adresou webu info@eldock.cz (osobní e-mail se do veřejného repozitáře nepíše – doplní se v úpravě).
- Stav projektu na slidu 9 a v One-Pageru jen z ověřitelných čísel repozitáře (136 000+ řádků TypeScriptu, 1 200+ unit
  testů a 71 sad E2E, 838 přístrojů katalogu, 963 fotek výrobců, 264 ověřených rozvodnic, 99 fází).

**Zero-bug audit:**

- Obrázky: `FallbackImg` (náhrada při chybě načtení i před hydratací) v galerii řad (vektorový render dílu), katalogu
  chytré domácnosti (vektorový náhled výrobku), u krabic KOPOS, rozvodnic a DIN přístrojů; `BrokenImageGuard` v layoutu
  schová jakýkoli rozbitý obrázek na celém webu. Test `catalog/phase99-images.test.ts` ověří, že každá cesta katalogu
  a manifestu existuje a je platný WebP (všechny prošly – žádná chybějící fotka).
- Rozlišení 1366 × 768 a 1536 × 864 (`e2e/phase99.spec.ts`): bez vodorovného přetečení, dialogy Designové řady,
  Kusovník a BIM import celé na obrazovce, fázová lišta bez posuvníku, plátno nejméně 560 × 400 px. Opraveno: hlavička
  Panel Builderu, lišta dokumentu a nápověda fáze pod 1536 px kompaktní (popisky do ikon s tooltipem, nápověda na
  2 řádky) – pracovní plocha se po posunu pod pevnou hlavičku vejde na obrazovku celá.
- Přechod půdorys → rozváděč → elaborát (`e2e/demo-ready.spec.ts`): demo scénář se vykreslí za 0,2–2 s, generování
  rozváděče trvalo na vývojovém serveru 3,3–3,8 s včetně překladu stránky (produkce rychlejší, samostatně neměřeno); vzorový
  PB-001 – oteplení VYHOVUJE, 6 listů elaborátu a arch štítků 1:1. Vše bez chyb v konzoli.
- Plátno 2D půdorysu: popisek místnosti se vejde do místnosti – celý na jednom řádku, jinak název a pod ním rozměry
  (nebo plocha), u nízké místnosti jen název; co se nevejde, zkrátí „…“ (úzké WC a technická místnost se už nepřekrývají
  se sousedními místnostmi). Prezentace: slidy se při přepnutí nepřekrývají (předchozí zmizí hned, nový se krátce
  rozsvítí).
- Texty: hlavní obrazovky bez ladicích výpisů a vývojářských poznámek; anglické popisky pro čtečky obrazovky v dialozích
  a drobečkové navigaci přeloženy („Zavřít“, „Další“); tahák rozváděče a tréninkové zakázky odkazují na fáze 1a–4
  projektu a přepínač lišty 2D půdorysu na „🧭 Průvodce (Fáze 1–5)“ (ne na staré kroky 1–5).

**Kontrola připravenosti:** `npm run verify:demo` (`scripts/verify-demo-ready.mjs`) spustí Playwright proti vlastnímu
E2E serveru (čistá databáze) – `e2e/demo-ready.spec.ts` (prezentace, demo scénáře s fázemi 1–5 a generováním, vzorový
rozváděč a PDF, průmyslový závod) a `e2e/phase99.spec.ts` (rozlišení); `-- --prod` přidá kontrolu produkce (veřejné
stránky, prezentace s 10 slidy a One-Pagerem, fotky katalogu), `-- --only-prod` jen produkci po nasazení.
