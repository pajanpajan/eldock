# Zadání fáze 101 – před prezentací: kusovník bez „doplnit“, panely, víceramečky 1R–5R, lokální BIM a /prezentace

Vloženo z chatu 2026-11-12 (po nasazení fáze 100, před odpolední prezentací projektu). Celé zadání beze změn je níže,
za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Před dnešní odpolední prezentací musíme vyřešit 5 konkrétních chyb z živého testování a kompletně přepsat stránku `/prezentace`, aby působila maximálně věcně, pravdivě a profesionálně (žádné umělé startupové fráze, ale poctivá inženýrská realita).

Zapiš tuto úlohu do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 6 částech:

================================================================================
ČÁST 1: KONEC SLOVA „doplnit“ V KUSOVNÍKU – KOMPLETNÍ VÝROBNÍ ČÍSLA (MPN) A EANy
================================================================================

PROBLÉM (`image_6c0dff.jpg`): V okně `Kusovník domovní instalace` se u sběrnicových prvků ABB-free@home a krabiček KOPOS zobrazují přesná MPN a EAN, ale u běžných zásuvek, rámečků ABB Levit, RJ45 a všech kabelů CYKY svítí žlutý nápis `doplnit`. Na prezentaci tam NESMÍ být ani jedno `doplnit`!

OPRAVA:
1. V `src/lib/panel-builder/residential-series-catalog.ts` a v generátoru kusovníku půdorysu doplň deterministickou matici skutečných objednacích čísel (MPN) a EAN-13 kódů pro všechny přístroje a rámečky všech řad (zejména **ABB Levit, Levit M, Zoni, Tango, Time, Time Arbo, Swing, Swing L, Decento, future linear, solo, Busch-axcent, Garant, Variant+, Praktik**, a také **Schneider Nová Unica / Sedna / Asfora**, **Legrand Valena Life / Allure / Céliane** a **Hager lumina / berker**):
   - Zajisti, aby každá kombinace v kusovníku (`Dvojzásuvka 2N`, `Zásuvka 1N s krytem`, `Zásuvka 1N IP44`, ` Zásuvka s USB`, `Zásuvka s přepěťovou ochranou`, `Spínače řazení 1 / 5 / 6 / 7`, `Žaluziový spínač`, `Stmívač`, `Termostat`, `Datová zásuvka RJ45 Cat6 / Cat6A`, `TV zásuvka` a `Krycí rámečky 1R až 5R`) vrátila **skutečné katalogové objednací číslo výrobce a platný EAN-13**!
   - Například pro **ABB Levit (Bílá / Alpská bílá – barevný kód `03`)**:
     * Dvojzásuvka 2N kompletní: `5513H-C02357 03` (`EAN 8595017292381`)
     * Zásuvka 1N (strojek `5519A-A02357` + kryt `5519H-A02357 03` / komplet): `5519H-A02357 03` (`EAN 8595017292145`)
     * Zásuvka 1N IP44: `5519H-A02359 03` (`EAN 8595017292343`)
     * Rámeček 1R až 5R Levit (03): `3901H-A00001 03` (1R), `3901H-A00002 03` (2R), `3901H-A00003 03` (3R), `3901H-A00004 03` (4R), `3901H-A00005 03` (5R)
     * Datová zásuvka RJ45 Cat6 (komplet se strojkem a krytkou Levit 03): `5014H-A00118 03` / `2CKA001753A0151`
2. Pro **všechny kabely** ve výkazu a kusovníku (`CYKY-J 3×1,5`, `CYKY-O 3×1,5`, `CYKY-J 3×2,5`, `CYKY-J 5×1,5`, `CYKY-J 5×2,5`, `CYKY-J 5×4`, `CYKY-J 5×6`, `CYKY-J 5×10`, bezhalogenové `1-CHKE-R (N2XH-J) B2ca`, datové `UTP Cat6`, `U/FTP Cat6A / Cat7` a sběrnicové `J-Y(St)Y 2×2×0,8` / `KNX EIB 2×2×0,8`) doplň oficiální katalogová čísla a EAN-13 předních výrobců na českém trhu (**NKT Cables / PRAKAB Pražská kabelovna / Solarix**), např.:
   - `CYKY-J 3×1,5` -> MPN `NKT-201053` / `PKB-CYKY-J-3X1.5` (`EAN 8595055700123`, Výrobce: `NKT / Prakab`)
   - `CYKY-J 3×2,5` -> MPN `NKT-201055` / `PKB-CYKY-J-3X2.5` (`EAN 8595055700147`, Výrobce: `NKT / Prakab`)
   - `CYKY-J 5×1,5` -> MPN `NKT-201062` (`EAN 8595055700215`, Výrobce: `NKT / Prakab`)
   - `CYKY-J 5×2,5` -> MPN `NKT-201063` (`EAN 8595055700222`, Výrobce: `NKT / Prakab`)
   - `UTP Cat6` -> MPN `SXKD-6-UTP-PVC` (`EAN 8595684700118`, Výrobce: `Solarix`)
   - `CAT7 / KNX J-Y(St)Y 2×2×0,8` -> MPN `2CDG110099R0011` (`EAN 4016779662024`, Výrobce: `ABB / Solarix`)
3. Odstraň z kusovníku slovo `"doplnit"` a aktualizuj úvodní popisek modalu kusovníku tak, aby čistě a srozumitelně vysvětloval strukturu kusovníku (Přístroje a kryty dle katalogu výrobce + Silové a datové kabely NKT/Solarix + Instalační krabice KOPOS).

================================================================================
ČÁST 2: OPRAVA ROZBITÉHO FORMÁTOVÁNÍ V PRAVÉM A LEVÉM PANELU (`image_6c0d2a.jpg`, `image_6c0a20.png`, `image_6c0623.jpg`)
================================================================================

1. **Pravý panel – Sekce výběru výrobce a systému (`image_6c0d2a.jpg` a `image_6c0a20.png`):**
   - CHYBA: V úzkém pravém sloupci (~300 px) jsou 3 karty (`Domovní spínače a zásuvky`, `ABB-free@home®`, `ABB i-bus® KNX & flexTronics®`) naskládané vedle sebe ve 3 sloupcích, takže se text láme po 1 slovu na řádek a překrývá ikony!
   - OPRAVA:
     * Změň rozložení těchto 3 karet v pravém panelu na **vertikální seznam pod sebou (`flex flex-col gap-1.5`)**! Každá karta tak bude mít plnou šířku pravého panelu (`w-full`), ikonu vlevo a čistý, čitelný dvouřádkový text vpravo bez jakéhokoliv překrývání!
     * Výběr designové řady a barvy pod tím udělej maximálně čistý: zobraz 3sloupcovou mřížku řad s čitelnými popisky, přehledný výběr barvy klapky/rámečku a výrazné tlačítko **`[ 🎨 Otevřít velkou galerii řad a barev ]`**.

2. **Levý panel dole – Tlačítko `Knihovna spotřebičů – upravit / přidat` (`image_6c0623.jpg`):**
   - CHYBA: Nad 2sloupcovou mřížkou spotřebičů (`VD`, `TR`...) je text `Knihovna spotřebičů – upravit / přidat` vmáčknutý do jednoho sloupce a ošklivě se láme.
   - OPRAVA: Obal toto tlačítko do `col-span-2 w-full mb-1.5` a nastyluj ho jako čisté, zarovnané akční tlačítko přes celou šířku levého panelu: **`[ ⚙️ Knihovna spotřebičů (upravit / přidat) ]`**. Zkontroluj totéž u všech ostatních nadpisů a podtlačítek v levé paletě!

================================================================================
ČÁST 3: NOVÁ, MNOHEM CHYTŘEJŠÍ PRÁCE S VÍCERÁMEČKY (`1R` AŽ `5R`)
================================================================================

Současný trvalý box `Sestavy ve vícerámečku` nahoře nad levou paletou zabírá místo a působí těžkopádně. Přepracuj práci s vícerámečky na tyto **3 intuitivní způsoby**:

1. **PŘÍMÉ ROZŠÍŘENÍ NA VÍCERÁMEČEK V DETAILU KAŽDÉHO PRVKU (`1R ➔ 2R ➔ 3R ➔ 4R ➔ 5R`):**
   - Když uživatel na plátně klikne na jakoukoliv umístěnou zásuvku, vypínač, datovou zásuvku, termostat nebo sběrnicové tlačítko, v pravém panelu `Detail` zobraz novou sekci **`▣ Sestava ve vícerámečku (na této pozici)`**:
     * Vizuální přepínač počtu pozic (respektující `maxFrameGang` zvolené řady!): **`[ 1R (Samostatně) ]` · `[ 2R ]` · `[ 3R ]` · `[ 4R ]` · `[ 5R ]`** + orientace **`[ ↔ Vodorovně ]` / `[ ↕ Svisle ]`**.
     * Jakmile uživatel klikne např. na `2R` nebo `3R`, zobrazí se vizuální okénka pozic (`Pozice 1`, `Pozice 2`, `Pozice 3`), kde si z rychlých tlačítek na 1 klik nakliká obsah každé pozice (`Zásuvka 230 V`, `Datová RJ45`, `TV/SAT`, `Vypínač č. 1 / 6 / 5`, `Žaluziový spínač`, `Termostat`, `USB nabíječka`)!
     * Prvek na plátně se okamžitě promění ve vícerámeček (např. `2R` / `3R`) se všemi potřebnými kabely a hlubokými spojovatelnými krabičkami KOPOS!

2. **SPOJENÍ SOUSEDNÍCH PRVKŮ NA STĚNĚ JEDNÍM KLIKEM (`🔗 Spojit do vícerámečku`):**
   - Když uživatel vybere na plátně 2 až 5 prvků u stejné stěny (pomocí `Shift + klik` nebo tažením obdélníku) NEBO když je vybraný prvek blízko jiného prvku na téže stěně (do `35 cm`), zobraz v `Detail` panelu (a v plovoucí liště) tlačítko **`[ 🔗 Spojit sousední prvky do společného vícerámečku (2R–5R) ]`** (a opačné tlačítko `[ ✂️ Rozdělit vícerámeček na samostatné přístroje ]`).

3. **PŘESUN RYCHLÝCH ŠABLON VÍCERÁMEČKŮ PŘÍMO DO PŘÍSLUŠNÉ SEKCE PALETY:**
   - Odstraň ten trvalý box `Sestavy ve vícerámečku` z horní části nad paletou (tím se levá paleta krásně provzdušní a posune nahoru!).
   - Místo toho vlož kontextové šablony přímo dovnitř palety podle aktuální fáze:
     * Ve **Fázi 3 (`🔌 Zásuvky`)** přidej pod běžné zásuvky rozbalovací/přehlednou skupinu **`▣ Vícerámečky se zásuvkami (2R–5R)`**: `2× Zásuvka (2R)`, `3× Zásuvka (3R)`, `4× Zásuvka (4R)`, `Zásuvka + RJ45 (2R)`, `TV sestava: 2× Zásuvka + RJ45 + TV (4R)` + tlačítko `[ + Vlastní sestava 2R–5R ]`.
     * Ve **Fázi 4 (`🔘 Vypínače a ovládání`)** přidej pod vypínače skupinu **`▣ Vícerámečky s vypínači (u dveří / u postele)`**: `Vypínač + Zásuvka pod ním (2R svislý)`, `2× Vypínač + Zásuvka (3R)`, `Vypínač + Žaluzie + Termostat (3R)`, `U postele: Vypínač č.6 + 2× Zásuvka (3R)` + tlačítko `[ + Vlastní sestava 2R–5R ]`.

================================================================================
ČÁST 4: 100% LOKÁLNÍ A OFFLINE-READY PŘEVOD BIM (`.ifc`) + BEZPEČNOSTNÍ GARANCE
================================================================================

Zákazníci z průmyslu a nemocnic jsou velmi citliví na bezpečnost svých stavebních a technologických BIM dat.
1. Ověř a zaruč v `src/lib/bim/ifc-parser.ts` a `BimImportModal.tsx`, že veškeré čtení a parsování `.ifc` souboru probíhá **100% lokálně v paměti prohlížeče (`File.text()` v klientském JS bez jakéhokoliv odesílání `.ifc` souboru na externí servery nebo do externích AI API)**.
2. Přímo do modalu `Importovat BIM model (.ifc)` (jak v průmyslovém `/`, tak v 2D půdorysu) přidej výrazný zelený bezpečnostní box:
   - **`🔒 100% Lokální a bezpečné zpracování (Zero-Cloud & Offline-ready):`**
   - *"Váš soubor `.ifc` je zpracován výhradně lokálně v paměti vašeho prohlížeče. Žádná citlivá výkresová ani technologická data závodu neodcházejí do žádné externí AI ani třetím stranám. Převod funguje i zcela offline bez připojení k internetu (a pro podniky s přísným režimem NIS2 lze celý ELDOCK provozovat On-Premise na interním serveru závodu)."*

================================================================================
ČÁST 5: KOMPLETNÍ PŘEpracování `/prezentace` – PRAVDIVÁ, VĚCNÁ A PROFESIONÁLNÍ INŽENÝRSKÁ PREZENTACE
================================================================================

Přepracuj stránku `src/app/prezentace/page.tsx` (`https://eldock.cz/prezentace`).
Současná verze působí příliš uměle a marketingově. Chci prezentaci, která je **100% pravdivá, technicky přesná, pokorná, ale sebevědomá v tom, co už reálně umí**, napsaná jazykem člověka z elektrotechnické praxe (ABB / Hilti / průmyslová automatizace):

1. **VIZUÁLNÍ STYL PREZENTACE:**
   - Čistý švýcarský inženýrský design (tmavý břidlicový podklad `#090d16`, tenké technické linky, jasná typografie, reálné živé náhledy/data z naší aplikace a přímá tlačítka pro přepnutí do živé ukázky v novém panelu).
   - Každý slide se musí pohodlně vejít na obrazovku `1920×1080` i `1366×768` bez svislého posuvníku.

2. **NOVÁ STRUKTURA 8 PRAVDIVÝCH A PŘESVĚDČIVÝCH SLIDŮ:**
   - **Slide 1 – O čem je projekt ELDOCK (Jasné a pravdivé uvedení):**
     * *Nadpis:* **ELDOCK.cz – Propojení návrhu elektroinstalace, výroby rozváděčů a provozní dokumentace do jednoho pracovního postupu.**
     * *Věcné shrnutí:* Praktický webový nástroj vyvíjený přímo z potřeb montážních elektrikářů, revizních techniků a průmyslové údržby. Odstraňuje ruční přepisování mezi stavebním půdorysem, kusovníkem materiálu, schématem rozváděče a dokumentací na stavbě či ve výrobním závodě.
     * *3 reálné moduly v provozu:* `1. 2D Půdorys & Kabeláž` · `2. Návrhář rozváděčů (AI Panel Builder)` · `3. Správa dokumentace závodů a budov`.

   - **Slide 2 – Reálný problém z praxe (Proč to dnes trvá tak dlouho):**
     * **U domovní a komerční instalace:** Elektrikář dostane slepý PDF půdorys od stavaře. Ručně pravítkem měří délky kabelů, v Excelu sčítá vypínače, rámečky a krabičky, a po večerech lepí dokumentaci rozváděče, výpočet oteplení a štítky, aby prošel výchozí revizí.
     * **U výrobních závodů, obchodních center a nemocnic:** Dokumentace rozváděčů je rozházená v papírových šanonech nebo v těžkých 3D BIM modelech, které údržbář u stroje neotevře. Změny zapojení během nočních oprav se nezakreslují a chybí přehled o zálohovaných větvích (Síť / Dieselagregát / UPS) a termínech revizí.

   - **Slide 3 – Modul 1: 2D Půdorys & Kabeláž (Krok za krokem od stěn po kusovník):**
     * Věcný popis 5fázového průvodce, který zvládne i montér bez znalosti AutoCADu:
       1) Nahrání PDF / DXF / BIM (`.ifc`) nebo složení místností zadáním rozměrů `X × Y`.
       2) Osazení rozváděče, vybavení a automatické hlídání koupelnových zón (ČSN 33 2000-7-701).
       3) Rozmístění zásuvek, spotřebičů, světel a vypínačů (včetně skládání vícerámečků 1R–5R přímo na stěně).
       4) Automatické obvodové trasování kabelů, výpočet potřebné hloubky krabiček KOPOS (45 mm vs. 66 mm) a kompletní kusovník s výrobními čísly (MPN/EAN).
     * Přímé tlačítko: **`[ 📐 Otevřít živou ukázku: 2D Půdorys ]`**.

   - **Slide 4 – Modul 2: Návrhář rozváděčů a normativní výpočty (ČSN EN IEC 61439):**
     * Jak získat z půdorysu (nebo z fotky rozváděče na stavbě) kompletní výrobní dokumentaci:
       - Automatické rozdělení okruhů, vyvážení fází L1/L2/L3 a dimenzování PE a oddělených N sběrnic (N1, N2 za každým chráničem).
       - Vestavěná kontrola českých norem (**ČSN 33 2130 ed. 4**, **ČSN 33 2000-7-710 ed. 2** pro zdravotnictví, **ČSN 33 2000-7-718 / BD4** pro obchodní centra).
       - Výpočet oteplení rozváděče dle **IEC TR 60890** ze ztrátových výkonů přístrojů ($P_v$ z dat ETIM 9.0).
       - Okamžitý tisk **6listového PDF elaborátu** (krycí list, osazení, 1P schéma, kusová zkouška, protokol vnějších vlivů, EU prohlášení o shodě, CE štítek a samolepicí popisky 1:1).
     * Přímé tlačítko: **`[ ⚡ Otevřít živou ukázku: Návrhář rozváděčů & PDF elaborát ]`**.

   - **Slide 5 – Modul 3: Průmyslové závody, Obchodní centra a Nemocnice (100% lokální BIM `.ifc` & Provoz):**
     * Praktické nástroje pro vedoucí údržby, energetiky a facility manažery:
       - **100% lokální a bezpečný převod BIM (`.ifc`):** Převod stavebního a TZB modelu na přehlednou 2D mapu hal a rozváděčů přímo v prohlížeči (Offline-ready, citlivá data neopouštějí počítač firmy).
       - **QR diagnostika a elektronická Červenka:** Načtení schématu mobilem u stroje, zakreslení provozní změny přímo do výkresu a archivace záloh PLC/HMI programů s hlídáním podstatné změny stroje dle **Nařízení EU 2023/1230**.
       - **Přehled kritického napájení a Kniha revizí:** Barevná filtrace větví (*Běžná síť / Dieselagregát DA / Kritická UPS*), simulátor připojení nového stroje a hlídání lhůt revizí (včetně nouzového osvětlení a zdravotnických přístrojů).
     * Přímé tlačítko: **`[ 🏭 Otevřít živou ukázku: Průmyslový areál & BIM import ]`**.

   - **Slide 6 – Kde přesně dnes jsme (Férový stav projektu: Co už běží vs. Co je před námi):**
     * Dva přehledné, upřímné sloupce (žádné lakování narůžovo):
       - **✅ Co je dnes hotové, otestované a běží na `eldock.cz`:**
         * Plně funkční jádro 2D půdorysu, návrháře rozváděčů i průmyslové správy areálu.
         * Výpočtové jádro (ČSN linter, oteplení IEC TR 60890, výpočet úbytků napětí, krabiček a délek tras).
         * Zpracování dat ETIM 9.0, lokální parser BIM (`.ifc`), DXF/PDF exporty a generátor 6listové dokumentace.
       - **🛠️ Co nyní řešíme a kam směřuje další vývoj:**
         * Pilotní testování v reálném provozu s prvními elektrikáři, revizními techniky a správci budov (sběr zpětné vazby z praxe).
         * Kompletní dopárování ceníkových matic všech výrobců a přímé propojení kusovníků s košíky elektro-velkoobchodů.
         * Rozšíření o modul **Výchozích revizních zpráv (VRZ)** a automatický rozpočet montážních prací pro zákazníka.

   - **Slide 7 – Obchodní model a komu ELDOCK šetří peníze:**
     * Jasná ekonomika pro uživatele: Pokud elektrikář na jediném rodinném domě ušetří **6–10 hodin** ručního měření, počítání kusovníku a psaní dokumentace rozváděče, zaplatí se mu licence na celý rok na první zakázce.
     * 3 zdroje příjmů platformy:
       1) **Kredity / Měsíční a roční předplatné** pro montážní elektrikáře, projektanty a revizní techniky.
       2) **Firemní B2B licence** pro výrobní závody, obchodní centra a zdravotnická zařízení.
       3) **Partnerské provize z materiálu a výroby rozváděčů** (přenos přesného kusovníku k velkoobchodům a výrobcům rozváděčů).

   - **Slide 8 – Proč žádáme o podporu a jak přesně ji využijeme:**
     * Otevřený a konkrétní plán (s možností kliknout na `[ ✏️ Upravit text / částku ]` přímo na slidu):
       - **1. Pilotní nasazení a obchodní vstup na trh ČR/SK:** Osobní nasazení u prvních desítek montážních firem a průmyslových areálů, technická podpora při zavádění.
       - **2. Datová a velkoobchodní integrace:** Dokončení plné certifikace katalogů výrobců (ETIM) a napojení přímého objednávání materiálu a tisku průmyslových štítků.
       - **3. Vývoj navazujících modulů:** Modul předvyplnění Výchozí revizní zprávy (VRZ dle ČSN 33 2000-6 ed. 2) a automatické cenové nabídky (materiál + práce).
       - **Autor projektu:** Pavel Janoušek · zkušenosti z technického obchodu a elektrotechniky (ABB, Hilti, PC|SCHEMATIC) · `https://eldock.cz`.

================================================================================
ČÁST 6: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš a spusť testy ověřující:
   - Že v kusovníku domovní instalace (`buildFloorplanBom`) u vzorového domu i nově vložených zásuvek/vypínačů/kabelů NENÍ ani jedna položka s textem `"doplnit"` – každá položka má platné MPN a EAN!
   - Že v pravém panelu jsou 3 karty systémů (`Domovní spínače a zásuvky`, `ABB-free@home`, `ABB i-bus KNX`) pod sebou (`flex-col`) a nepřekrývají se.
   - Že v detailu prvku na plátně funguje přímé rozšíření na vícerámeček (`1R` až `5R`).
   - Že `/prezentace` vrací `200 OK` a vykresluje všech 8 věcných inženýrských slidů i tisknutelný A4 přehled.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**1. Kusovník bez „doplnit“ (`src/lib/panel-builder/wiring-bom.ts`, `WiringBomDialog.tsx`):**

- Ukázková objednací čísla a EANy ze zadání se nepoužila: 8 z 9 EANů nemá platnou kontrolní číslici EAN-13 (GS1) a
  k žádnému z nich není ověřený zdroj výrobce. Kusovník bere MPN a EAN jen z oficiálních dat výrobců (ABB ETIM 9.0,
  Hager ETIM 10, stránky výrobků OEZ a KOPOS); test hlídá kontrolní číslici každého EANu v kusovníku i v datech.
- Hlavní příčina řádků bez čísla: obecná barva nákresu („Bílá / Alpská bílá“) se nepřevedla na barvu řady – teď
  `colorForSeries` / `frameColorForSeries` (ABB Levit → kód 01 / 03), takže přístroje, kryty i rámečky řady mají MPN
  a EAN. Kde výrobce číslo opravdu nevede, místo „doplnit“ pravdivý původ (`bomOrderLabel`): kabel = „typové označení –
  výrobce dle nabídky“, bezpečnostní a zdravotnické prvky = „dle projektu a dodavatele“, přístroj nebo krabice mimo data
  = „dle katalogu výrobce“. Ve vzorovém RD 4+kk to jsou jen datová zásuvka RJ45 (keystone podle výrobce kabeláže)
  a zásuvka IP44 (řada Levit ji v ETIM 9.0 nemá). Nový popis okna kusovníku; stejný popis původu i v kusovníku
  domovní instalace v PDF elaborátu (list 4) a v exportu CSV / XLSX.

**2. Panely (`DeviceAppearance.tsx`, `SeriesGallery.tsx`, `PaletteAccordion.tsx`):**

- Karty rodin ABB (Domovní spínače a zásuvky · ABB-free@home® · ABB i-bus® KNX & flexTronics®) pod sebou
  `flex flex-col gap-1.5`, každá přes celou šířku panelu (dřív `sm:grid-cols-3` – breakpoint okna, ne panelu).
- Řady v 3sloupcové mřížce (dřív vodorovný pás s posuvníkem), barva klapky a rámečku s vlastním nadpisem, velké
  tlačítko „🎨 Otevřít velkou galerii řad a barev“ přes celou šířku, vedlejší akce pod ním.
- Akce sekce palety (⚙️ Knihovna spotřebičů (upravit / přidat)) jako první buňka mřížky `col-span-2 w-full mb-1.5`;
  jiná podtlačítka palety tuto vadu neměla (nadpisy kategorií už od fáze 100 bez ořezu).

**3. Víceramečky 1R–5R (`floorplan-frames.ts`, `FrameSection.tsx`, `FrameAssemblyPalette.tsx`):**

- Detail zásuvky, vypínače, datové zásuvky, termostatu i sběrnicového tlačítka: „▣ Sestava ve vícerámečku (na této
  pozici)“ – 1R (Samostatně) až 5R podle limitu řady (`maxFrameGang`), ↔ / ↕, okénka pozic a obsah na 1 klik
  (Zásuvka 230 V, Datová RJ45, TV / SAT, Vypínač č. 1 / 6 / 5, Žaluziový spínač, Termostat, USB nabíječka; na
  sběrnicové úrovni jen dostupné přístroje a tlačítka 1násobné / 2násobné). Víc pozic přidá za vybraný přístroj
  stejný druh (dvojzásuvka → jednozásuvka), méně odebere koncové přístroje (vybraný zůstává), 1R vyjme přístroj
  z rámečku. Krabice a kabely přepočítá stávající kusovník (KOPOS KP 64/2–5 podle počtu pozic).
- Svisle (`FrameGroup.orientation = "vertical"`, bez migrace – JSON nákresu): horní pozice ve výšce rámečku, každá
  další o 71 mm níž; v půdorysu se pozice kreslí pod sebou kolmo ke stěně do místnosti.
- 🔗 Spojit: 2–5 vybraných přístrojů (Shift + klik / obdélník) nebo sousedé u stejné stěny do 35 cm (stejná místnost
  a osa, nejvýš 12 cm mimo linii stěny) – v detailu i v plovoucí liště značky; ✂️ Rozdělit na samostatné přístroje.
- Panel sestav nad paletou zrušen; „▣ Vícerámečky se zásuvkami (2R–5R)“ v sekci Zásuvky (fáze 3) a „▣ Vícerámečky
  s vypínači (u dveří / u postele)“ v sekci ovládání (fáze 4) s „+ Vlastní sestava 2R–5R“. Šablony firmy jsou v obou
  skupinách (uložená šablona nezmizí z očí). Sběrnicová úroveň ukáže jen sestavy z dostupných přístrojů.
- Nová položka palety „Anténní zásuvka TV / SAT“ (TV sestava, rychlá volba pozice): vlastní koaxiální kabel
  `Koaxiální kabel 75 Ω (TV / SAT)` z rozváděče / multipřepínače (ne UTP), v kusovníku jako anténní zásuvka – typ
  podle katalogu výrobce řady (ETIM data ABB ji pro Levit nemají, číslo se nevymýšlí).

**4. BIM `.ifc` (`BimLocalNotice.tsx`, `BimImportModal.tsx`, import v 2D půdorysu):**

- Ověřeno v kódu: soubor čte `File.text()` a převádí `parseIfc` v klientském JS (bez `fetch` v `src/lib/bim`), na
  server jde jen převedená struktura, kterou uživatel potvrdí (závod: `importBimAction`; půdorys: uložení nákresu),
  žádné AI. Zelený box „🔒 100% Lokální a bezpečné zpracování (Zero-Cloud & Offline-ready)“ v okně importu závodu
  a v novém okně „🏢 Importovat BIM model (.ifc)“ 2D půdorysu. Text zpřesněn podle skutečnosti: převod funguje bez
  připojení na otevřené stránce (aplikace nemá service worker – stránku je nutné načíst online) a ukládá se jen
  výsledek, ne soubor; On-Premise = produkční Docker obraz (fáze 20) na serveru závodu.

**5. `/prezentace` (`PitchSlides.tsx`, `PitchDeck.tsx`, `src/lib/pitch.ts`, `src/lib/pitch-live.ts`):**

- 8 slidů podle zadání na pevném plátně 1280 × 720 (CSS `zoom` podle obrazovky – 1366 × 768 i 1920 × 1080 bez
  posuvníku, hlídá E2E), podklad `#090d16` s jemnou technickou mřížkou, tlačítka živé ukázky do nové karty.
- Živá data spočítá server při sestavení stránky stejnými funkcemi jako aplikace (`pitchLiveData`): kusovník
  vzorového RD 4+kk (okruhy, metráž, řádky s MPN / EAN), převod vzorového BIM modelu haly, listy PDF elaborátu
  (`DOCUMENT_SHEETS`) a úrovně napájení (`POWER_BACKUP_TIERS`); dva skutečné snímky obrazovky z výukových videí.
- Každé tvrzení ověřené v kódu: 5 fází průvodce = `WIZARD_STEPS`; krabice KOPOS 45 / 66 mm; N1, N2 za chrániči
  (`pe-n-busbars.ts`); Pv z dat ETIM (ABB ETIM 9.0, Hager ETIM 10 – proto ne jen „ETIM 9.0“); 6 listů elaborátu
  (protokol kusové zkoušky a štítek CE na listu 6, vnější vlivy na listu 5, popisky 1:1 samostatný tisk); podstatná
  změna dle 2023/1230, What-If simulátor, lhůty revizí zdravotnických přístrojů a nouzového osvětlení
  (`inspection-rules.ts`). Čísla stavu projektu z repozitáře k 12. 11. 2026 (160 000+ řádků vlastního TypeScriptu,
  1 200+ unit testů, 73 sad E2E, 1 300+ EAN z dat výrobců, 1 400+ fotek výrobců, 100+ nasazených fází); úspora
  6–10 hodin je odhad z praxe podle zadání (tak je i označená).
- ✏️ Upravit text / částku přímo na slidu 8 i v liště: částka, forma, partner, kontakt a texty bodů plánu s podílem
  v % (jen localStorage prohlížeče). One-Pager A4 se stejnými ověřenými texty.
