Provedeme 6 zásadních úprav v AI Panel Builderu, Katalogu prvků a rozpoznávání reálných velkých rozváděčů (podle rozboru 144modulového rozváděče ABB CA35R z projektu PB-009 a jeho detailních fotek).

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:

1. ODSTRANĚNÍ 9 NEPOUŽÍVANÝCH VÝROBCŮ + OFICIÁLNÍ VEKTOROVÁ LOGA ZNAČEK:
- Ze seznamu výrobců v AI Panel Builderu (Konfigurátor, Katalog, filtry i AI párování) kompletně ODSTRAŇ těchto 9 značek:
  `Finder`, `Shelly`, `Mean Well`, `Dehn`, `Relpol`, `Pilz`, `Weidmüller`, `Elko EP`, `Pollmann`.
- Ponech hlavní značky používané v naší praxi (ABB, Eaton, OEZ, Schneider Electric, Hager, Noark, Bonega, Schrack, Siemens, ETI, SEZ, Saltek, Hakel, Legrand, Loxone, Eastron, Wago, Phoenix Contact, Omron, Hensel, Rittal).
- Vytvoř komponentu `src/components/panel-builder/ManufacturerLogo.tsx`, která místo obyčejných barevných čtverečků s iniciálami ("E", "SE", "H", "N"...) vykreslí autentická, čistá SVG vektorová loga (wordmarky) v oficiálních barvách a typografii daných výrobců (ABB červené tučné dělené logo, EATON modrobílé, OEZ modré, Schneider Electric zelené, Hager, NOARK, BONEGA, SCHRACK, SIEMENS, ETI, SALTEK, HAKEL, LEGRAND, LOXONE, WAGO, HENSEL, RITTAL).

2. NOVÁ STRUKTURA "KATALOG PRVKŮ" (/panel-builder/catalog) -> VÝROBCI -> KATEGORIE -> PRVKY:
- Přepracuj stránku `/panel-builder/catalog`, aby po otevření neukazovala nepřehlednou tabulku 2500+ řádků, ale fungovala jako čistý vizuální katalog ve 3 krocích:
  * KROK 1 (Rozcestník výrobců): Zobraz přehledné karty aktivních výrobců s jejich oficiálními SVG logy a počtem prvků v databázi (+ globální vyhledávací pole nahoře).
  * KROK 2 (Rozcestník kategorií vybraného výrobce): Po kliknutí na výrobce (např. ABB) zobraz hlavičku výrobce s tlačítkem `[ ← Zpět na všechny výrobce ]` a velkými kartami kategorií:
    - `Jističe (MCB)`
    - `Proudové chrániče (RCD)`
    - `Jističochrániče (RCBO – vč. 1M kompaktních DS301C)`
    - `Odpínače a hlavní vypínače`
    - `Přepěťové ochrany (SPD)`
    - `Stykače a instalační relé (vč. ručních EN25-40N)`
    - `Smart Home / KNX / free@home a řídicí moduly`
    - `Rozvodnice a skříně rozváděčů (12M až 144M+)`
    - `Domovní vypínače, zásuvky a rámečky (Tango, Levit, Unica, Valena...)`
    - `Svorkovnice, hřebeny a příslušenství`
  * KROK 3 (Přehled prvků kategorie): Rychlé filtrovací dlaždice parametrů a přehledný seznam prvků.

3. INTEGRACE DOMOVNÍCH PŘÍSTROJŮ (VYPÍNAČE, ZÁSUVKY, RÁMEČKY) + DOPLNĚNÍ KATALOGU ABB Z PRAXE:
- Do katalogu modulárních přístrojů ABB doplň přesné prvky z našeho reálného 144M rozváděče:
  * Skříň `ABB CA35R (Z151218)` – nástěnná rozvodnice ComfortLine 144 modulů (4 řady × 36M, tj. dvoupolová 24M + jedno pole 12M, 800×800×160 mm, IP44).
  * Kompaktní 1M jističochrániče `ABB DS301C` (1P+N v 1 modulu, 30mA typ A: `DS301C B6 A30`, `DS301C B10 A30`, `DS301C B13 A30`, `DS301C B16 A30`, `DS301C C16 A30`).
  * Instalační stykače s ručním ovládáním `ABB EN20-20N`, `ABB EN25-40N`, `ABB EN40-40N` (šířka 2M / 3M, přepínač OFF-AUTO-ON).
  * Jistič `ABB S201-B2` (2A pro jištění větrání/ovládání), `S203-B16`, `S203-B20`, chránič `FH204 A-40/0,03` (`2CSF204102R1400`) a řídicí aktory ABB-free@home / KNX (4M, 8M, 12M).
- Rozšiř synchronizační skript `scripts/sync-external-catalog.ts` (a seed katalogu), aby z `C:\Users\janou\Desktop\Claude\ai-panel-builder\catalog\wiring` načetl domovní spínače, zásuvky a rámečky (1R až 6R):
  * ABB (`Tango`, `Levit`, `Decento`, `Neo`, `Element`, `Time`, `Swing`, `Basic55`, `Future Linear`, `Solo`, `Busch-axcent`, `Zoni`, `Classic`, `Garant`), Schneider (`Nová Unica`, `Sedna`, `Asfora`), Legrand (`Valena Life`, `Valena Allure`, `Niloe`, `Celiane`, `Mosaic`, `Plexo`).
- Umožni domovní vypínače/zásuvky přiřazovat jak v **AI Panel Builderu** (soupis domovní instalace k obvodům), tak ve **Studiu (Krok 3)** v místnostech.

4. NOVÁ PŘESNÁ PRAVIDLA PRO VISION ANALYZER (PODLE ROZBORU 144M SKŘÍNĚ ABB CA35R):
V `geminiPanelService.ts` a v post-processingu detekcí zaveď těchto 6 přesných elektrotechnických pravidel:
- PRAVIDLO A (Podpora velkých a vícesloupcových skříní 24M / 36M / 144M):
  * Rozváděče mohou mít šířku řady 12M, 14M, 18M, 24M nebo 36M (např. skříň 144M má v jedné řadě levé pole 24M a pravé pole 12M oddělené svislou příčkou = 36M celkem). Nezkracuj uměle 24M ani 36M lišty!
  * Pokud AI na fotce vidí neosazený volný kus DIN lišty (prázdný kovový profil mezi skupinami přístrojů), NESMÍ ho vyplňovat smyšlenými moduly – započítá pouze skutečně osazené přístroje.
- PRAVIDLO B (Počítání TĚL A PÁČEK, nikoliv šroubků!):
  * ZRUŠ slepé pravidlo "1 šroubek = 1 modul"!
  * Důvod 1: Kompaktní 1M jističochrániče (`ABB DS301C` / `DSN201`) mají šířku POUZE 1 MODUL (17,5 mm), ale nahoře mají 2 šroubky vedle sebe (`1/2` a `N`), 1 úzkou černou páčku s červeným `I-ON` a malé bílé tlačítko TEST. Jde o JEDEN 1M přístroj (`RCBO 1P+N 1M`), nikoliv o dva 1P jističe!
  * Důvod 2: Šedé řídicí moduly chytré elektroinstalace (KNX / ABB-free@home / Loxone v pravém poli skříně) mají šířku 4M, 8M nebo 12M a řadu 16 drobných šroubků nahoře a dole. Jde o JEDEN široký řídicí modul (`OTHER / SMART_HOME`), nikoliv o 16 samostatných jističů!
  * Důvod 3: Řadové svorky (šedé úzké svorky se žlutými/červenými vodiči na kraji lišty) označ jako `TERMINAL (-X)`, nikoliv jako jističe.
- PRAVIDLO C (Rozlišení 3P jističe `S203` od 4P chrániče `FH204`):
  * Nepředpokládej, že každá lišta začíná proudovým chráničem! V praxi jsou často všechny chrániče (např. `3× ABB FH204 A 40A/0,03A`) umístěné vedle sebe na 1. liště, zatímco 3. a 4. lišta začíná třípólovými jističi (`ABB S203 B20` nebo `S203 B16`).
  * `4P Chránič (RCD, 4M)`: má páčku jen v pravé části, vlevo má velkou bílou plochu s popisem a oválné tlačítko `TEST`.
  * `3P Jistič (MCB, 3M, např. S203 B20 / B16)`: má širokou černou ovládací páčku spojenou přes VŠECHNY 3 moduly, bez tlačítka TEST!
- PRAVIDLO D (Rozpoznání instalačních stykačů `ABB EN25-40N` / `ESB`):
  * Bílý 2modulový přístroj bez klasické černé jističové páčky, který má na čele malý svislý posuvník `OFF - AUTO - ON` a označení `EN25-40N` nebo `ESB25`, je vždy **Instalační stykač (`CONTACTOR`, `-K`, 2M, 25A)** – nikdy z čísla 25 v kódu `EN25` nedělej 25A jistič!
- PRAVIDLO E (Čtení hodnot B10, B16, B20, B2 a 40A):
  * U jističů ABB S201/S203 pozorně čti hodnotu přímo pod červeným proužkem: rozlišuj `B16`, `B10`, `B20` a `B2` (2A jistič např. pro větrání). U chráničů `FH204 A` čti přesně `40A` vs `25A` (`40A IΔn = 0,03A`).
- PRAVIDLO F (Nahrání detailních fotek jednotlivých lišt / sekcí v Kroku 1):
  * Protože u velkých 144M rozváděčů je na celkové fotce text drobný, přidej v Kroku 1 k celé fotce i přímo ke každé DIN liště tlačítko `[ 📷 Nahrát detailní fotku této lišty / sekce ]` (nebo nahrání více detailních fotek najednou při zakládání projektu). Když uživatel nahraje detailní fotku lišty/sekce, AI přečte přesné texty (`DS301C B16`, `EN25-40N`, `FH204 A 40A`, `S203 B20`) přímo z ostrého detailu!

5. TLAČÍTKO "+ PŘIDAT PRVEK VPRAVO" A "DUPLIKOVAT" VEDLE "SMAZAT PRVEK":
- V pravém panelu `Konfigurátor prvku` (Krok 1) hned vedle červeného tlačítka `[ 🗑️ Smazat prvek ]` přidej na stejný řádek:
  * `[ ➕ Přidat prvek vpravo ]` – vloží nový přístroj hned napravo za právě vybraný prvek na téže DIN liště a vybere ho k úpravě.
  * `[ 📑 Duplikovat prvek ]` – vloží napravo od aktuálního prvku jeho přesnou kopii se stejnými parametry.

6. ČISTÝ A NERUŠIVÝ "ELEKTRO-LINTER" (KOMPAKTNÍ ODZNAK MÍSTO VELKÉHO BOXU):
- Odstraň velký rozbalený žlutý box `Elektro-linter` přímo nad 2D vektorovým rozváděčem.
- Místo něj zobraz v horní liště nad plátnem pouze malý klikací odznak: `[ ⚠️ X doporučení ▾ ]` (po kliknutí se otevře plovoucí popover s detaily a možností skrýt). Zruš falešné varování o smíchaných výrobcích u přepěťovek, zdrojů, stykačů a chytrých modulů.

Po implementaci spusť `npm run verify`, aktualizuj testy, udělej commit a vypiš příkazy pro push a deploy na produkční server.

