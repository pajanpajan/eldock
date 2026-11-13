# Zadání fáze 111 – před spuštěním ELDOCK: uspořádání skříně a lišt z 2D půdorysu (Silnoproud / Slaboproud), rozcestník na úvodní stránce a logo na „/“, 1 testovací projekt a nový ceník kreditů, Hlídač revizí s AI čtečkou výrobního štítku

Vloženo z chatu 2026-11-13 (po nasazení fáze 110) jako prioritní fáze. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Příští týden spouštíme ELDOCK (`https://eldock.cz`) pro elektrikáře a revizní techniky a týden poté pro průmyslové závody a správce budov. Musíme teď perfektně zapracovat těchto 5 klíčových architektonických a obchodních úprav:

1) Opravit přenos z 2D půdorysu do AI Panel Builderu (`{A0A67020-BA5F-49D2-9095-5CF9074361FE}.png`), kde se vše naskládalo do jednoho dlouhého sloupce 14 lišt po 12 modulech a nešlo najít vhodnou skříň ani rozšířit lišty do šířky. Přidat krok dotazu na uspořádání skříně a oddělení slaboproudu (Smart Home) od silnoproudu podle reálných rozvodnic v databázi.
2) Přepracovat úvodní stránku `https://eldock.cz/` na čistý, okamžitý dvoustranný rozcestník (Vlevo: Domovní instalace & Rozváděče | Vpravo: Průmysl, Budovy & Hlídač revizí), kde se podrobné náhledy a popisy otevřou až po rozkliknutí zvolené větve.
3) Zajistit, aby kliknutí na logo ELDOCK vlevo nahoře z jakéhokoliv místa v aplikaci vždy vedlo na úvodní obrazovku `https://eldock.cz/`.
4) Přepracovat kreditní a monetizační systém: omezit zkušební provoz na 1 testovací půdorys a 1 testovací rozváděč, ostatní zpoplatnit a nasadit novou ceníkovou architekturu, aby nám neunikaly peníze.
5) Vyčlenit a výrazně posílit sekci **Hlídání revizí & Správa spotřebičů a zařízení** (pro administrativní budovy, kanceláře – monitory, prodlužovačky, spotřebiče dle ČSN 33 1600 ed. 2 – i pro průmyslové závody) a přidat funkci **`📷 Vyfotit výrobní štítek (AI OCR čtečka)`**, která uloží fotku výrobního štítku jako druhou fotku zařízení, přečte z ní data (název, výrobce, model, výrobní číslo S/N, třídu ochrany) a vygeneruje přehledný identifikační štítek zařízení.

Zapiš tuto etapu jako prioritní fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: CHYTRÉ USPOŘÁDÁNÍ ROZVÁDĚČE PŘI EXPORTU Z 2D PŮDORYSU + OPRAVA ŠÍŘKY LIŠT
================================================================================

PROBLÉM (`{A0A67020-BA5F-49D2-9095-5CF9074361FE}.png`):
- Při vygenerování rozváděče z 2D půdorysu dal software každý chránič na novou 12M lištu (takže vznikly poloprázdné lišty `7/12 M`, `8/12 M`, `1/12 M`) a pod ně naskládal 5 lišt se Smart Home moduly `ABB-free@home`. Celkem vzniklo 14 lišt po 12M v jednom sloupci (`14 × 12M`), pro což v databázi neexistuje žádná rozvodnice!
- Navíc v editoru DIN lišt nefunguje správně rozšíření lišty do šířky (`18M`, `24M`, `36M` nebo vícesloupcové pole).

OPRAVA:
1. **Oprava komprimace okruhů na DIN lištách (`packRailsOptimally`):**
   - Nikdy nedávej poloprázdnou skupinu chrániče (`4M RCD + 1×3M jistič = 7M`) na samostatnou lištu, pokud se na tutéž lištu (podle zvolené šířky lišty `12M`, `18M` nebo `24M` s ponecháním ~15–20% rezervy) vejde další skupina chrániče nebo jističochrániče (`-FA1..FA3`) a samostatné jističe (`-F18 B6`)!

2. **Krok výběru koncepce skříně a oddělení slaboproudu (`SwitchboardLayoutWizardModal.tsx`):**
   - Když uživatel v 2D půdorysu klikne na **`⚡ Vygenerovat rozváděč z půdorysu`** (a také kdykoliv přímo v AI Panel Builderu přes výrazné tlačítko v horní liště plátna **`[ 📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud) ]`**), zobraz přehledné okno, kde si uživatel vybere, jak má rozváděč vypadat – **vždy s přímou vazbou na reálně existující rozvodnice z naší databáze**:
     * **Možnost 1 (Doporučeno při přítomnosti Smart Home / free@home / Loxone / KNX): `🏢 Dvoupolová skříň vedle sebe (Levé pole: Silnoproud 230/400 V | Pravé pole: Slaboproud & Smart Home)`**
       - Rozdělí rozváděč do **2 sloupců vedle sebe (Levé pole `Pole A – Silnoproud` | Pravé pole `Pole B – Slaboproud / Automatizace`)**, např. `2 pole × 5 řad po 12M (120M)` nebo `2 pole × 6 řad po 12M (144M)` nebo `2 pole × 7 řad (168M)`.
       - Automaticky napáruje existující dvoupolové skříně z naší databáze: **ABB ComfortLine `CA25V` / `CU25V` (120M), `CA26V` (144M), `CA27V` (168M), OEZ `RZA` / `RZG` / `RN` dvoupolové, Hager `Univers`, Eaton `BF / xEnergy`**!
     * **Možnost 2: `📏 Široké lišty 24 modulů (5×24M = 120M nebo 6×24M = 144M – Silnoproud nahoře, Slaboproud dole s přepážkou)`**
       - Vyskládá přístroje na široké **24modulové lišty** (`modulesPerRow = 24`), kde se silnoproud vejde do horních 2–3 lišt (po 24M) a slaboproud/Smart Home do spodních 2 lišt (po 24M) s vyznačenou izolační přepážkou.
       - Automaticky napáruje reálné skříně se 24M lištami: **ABB `Mistral41W 120M (5×24)`, ABB `CA25` / `CA25B` (`5×24`), `CA26` (`6×24`), OEZ `RZA / RN`**!
     * **Možnost 3: `📦 Kompaktní 18modulové lišty (4×18M = 72M nebo 6×18M = 108M)`**
       - Vyskládá přístroje na **18modulové DIN lišty** (`modulesPerRow = 18`), ideální pro rozvodnice **ABB `Mistral41 / Mistral65 72M (4×18M)`, Schneider `Pragma 4×18M`, Eaton `BP/BF`**.
     * **Možnost 4: `⚡+🤖 Dva samostatné rozváděče (RH1 Silnoproudý + RH2 Slaboproudý / Smart Home)`**
       - Vytvoří a propojí dvě standardní bytové rozvodnice vedle sebe nebo nad sebou (např. `RH1: 4×12M / 4×18M Silnoproud` + `RH2: 3×12M / 4×18M Smart Home`), takže na každou okamžitě pasují běžné skříně **ABB `Mistral41/65`, Eaton `KLV`, Hager `Volta`, OEZ `RZA`**!

3. **Plně funkční změna šířky lišt (`12M | 18M | 24M | 36M` a `- / +`) a zobrazení 2 polí vedle sebe na plátně:**
   - Oprav v editoru DIN lišt (`/panel-builder/[id]`) tlačítka v záhlaví každé lišty (`12M`, `18M`, `24M`, `36M`, `-`, `+`) i nový globální přepínač nad plátnem **`Šířka všech lišt: [ 12M ] [ 18M ] [ 24M ] [ 36M ]`** a **`Sloupce (Pole): [ 1 pole ] [ 2 pole vedle sebe (Silnoproud | Slaboproud) ]`**!
   - Když je zvoleno dvoupolové uspořádání (`2 pole vedle sebe`), vykresli na plátně vedle sebe **Levé pole (Silnoproud 230/400 V)** a **Pravé pole (Slaboproud / Smart Home)** oddělené svislou přepážkou skříně, přesně tak, jak vypadá reálný rozváděč `ABB CA25V` nebo `OEZ RZA`!
   - Ujisti se, že v kroku `1b Skříň rozváděče` databáze skříní VŽDY najde odpovídající rozvodnice (i pro velký rodinný dům se Smart Home nad 100–168 modulů).

================================================================================
ČÁST 2: NOVÁ ÚVODNÍ STRÁNKA `https://eldock.cz/` (ČISTÝ ROZCESTNÍK VLEVO / VPRAVO) + KLIKNUTÍ NA LOGO
================================================================================

1. **Kliknutí na logo ELDOCK vlevo nahoře VŽDY přesměruje na `https://eldock.cz/` (`/`):**
   - Zkontroluj úplně všechny hlavičky a navigační lišty v celém projektu (`Header`, `PanelBuilderHeader`, `FloorplanHeader`, `PlantHeader`, `/prezentace`, `/kontakt`, `/revize`, `/superadmin`).
   - Ujisti se, že logo **ELDOCK** vlevo nahoře je VŽDY obalené v `<Link href="/">` a po kliknutí okamžitě přenese uživatele na hlavní úvodní obrazovku `https://eldock.cz/`!

2. **Přepracování úvodní stránky `src/app/page.tsx` (`https://eldock.cz/`):**
   - Místo dlouhé rolovací stránky udělej z úvodní obrazovky `https://eldock.cz/` **čistý, moderní a okamžitě srozumitelný dvoustranný rozcestník (Split-Screen Gateway)**, kde se návštěvník během 2 vteřin dostane přesně do své sekce:
     * **LEVÁ KARTA / POLOVINA: `🏠⚡ Domovní a komerční elektroinstalace & Rozváděče`**
       - *Pro koho:* Pro montážní elektrikáře, revizní techniky, projektanty a výrobce rozváděčů.
       - *Stručný popis (3 jasné body):*
         1. **2D Půdorys & Kabeláž** – 5fázový návrh elektroinstalace, automatické trasy, krabičky KOPOS a 3D kontrola výšek.
         2. **AI Panel Builder** – návrh rozváděče z půdorysu nebo z fotky, oddělení silnoproudu a Smart Home, výpočet oteplení IEC 60890, CNC podklady a 6listový PDF elaborát.
         3. **Cenové nabídky & Kusovníky** – automatický výpočet z normohodin a ceníkových cen + 1-klikový export do velkoobchodů.
       - *Tlačítko:* **`[ Vstoupit do sekce: Domovní instalace & Rozváděče → ]`**
     * **PRAVÁ KARTA / POLOVINA: `🏭🛡️ Průmysl, Administrativní budovy & Hlídač revizí`**
       - *Pro koho:* Pro výrobní závody, administrativní a kancelářské budovy, obchodní centra, nemocnice a revizní techniky.
       - *Stručný popis (3 jasné body):*
         1. **Hlídač revizí spotřebičů, kanceláří a strojů** – evidence monitorů, prodlužovaček, spotřebičů (ČSN 33 1600 ed. 2) i rozváděčů, **AI čtečka výrobních štítků z fotky** a Chytrá revize.
         2. **Živá mapa závodu & 100% lokální BIM (`.ifc`)** – rozvodny, větve Síť / Dieselagregát / UPS a simulátor zátěže.
         3. **QR pasporty, Červenka & Ochrana TIČR** – uzamčená cloud dokumentace `v1.0 -> v1.1`, zakreslování změn do schémat a měsíční kontrolní reporty revizním technikům.
       - *Tlačítko:* **`[ Vstoupit do sekce: Průmysl, Budovy & Hlídač revizí → ]`**
   - **Až po rozkliknutí levé nebo pravé části** se uživatel přenese do vybrané podsekce (`/sekce/elektroinstalace` nebo `/sekce/prumysl-a-revize`, případně rovnou s detailními náhledy obrazovek, podrobným popisem modulů a tlačítky pro spuštění 2D Půdorysu, AI Panel Builderu, Hlídače revizí nebo Průmyslového závodu)!

================================================================================
ČÁST 3: PŘEPRACOVÁNÍ KREDITŮ A MONETIZACE (1 TESTOVACÍ PROJEKT ZDARMA, OSTATNÍ PLACENÉ)
================================================================================

PROBLÉM: Startovních 45 kreditů zdarma je příliš mnoho – uživatelé mohou vygenerovat několik komerčních zakázek zdarma a unikají nám peníze oproti obrovské hodnotě (úspora 8 hodin práce = 5 200 Kč na každém domě).

OPRAVA (`src/lib/credits/` + UI ceníku a dobíjení kreditů):
1. **Nastav zkušební limit přesně na `1 testovací půdorys / rozváděč zdarma`:**
   - Nový účet má nárok na **1 testovací projekt (1 zkušební 2D půdorys + 1 zkušební rozváděč)** (`freeTrialProjectsRemaining = 1`, resp. startovní zkušební kredit `15 kr.` určený na 1 vyzkoušení).
   - Ve zkušebním režimu se na vygenerovaném PDF elaborátu a cenové nabídce zobrazuje jemné označení *„ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL (1. testovací projekt zdarma)“*.
   - Jakmile uživatel vyčerpá tento **1 testovací projekt** a klikne na vytvoření dalšího půdorysu/rozváděče nebo na stažení komerčního PDF elaborátu / cenové nabídky / DXF / XLSX kusovníku bez zkušebního vodoznaku, otevře se čistý, přesvědčivý prodejní modal **`💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)`**!

2. **Nová ceníková a kreditní struktura (v modalu `+ Dobít kredity / Tarify` i na stránce ceníku):**
   - **Ceny akcí po vyčerpání 1 testovacího projektu:**
     * `Kompletní rozváděč (6listové PDF + oteplení IEC 60890 + štítky + kusovník)`: **15 kreditů**
     * `Kompletní 2D půdorys (Výkres PDF/DXF + výkaz kabeláže + krabičky KOPOS)`: **15 kreditů**
     * `Výhodný balíček celá zakázka (2D Půdorys + Rozváděč + Cenová nabídka pro zákazníka)`: **25 kreditů** *(ušetří 5 kreditů)*
     * `Samostatná Cenová nabídka nebo CNC výrobní balíček (.dxf + drátovací list)`: **8 kreditů**
   - **Balíčky kreditů (Jednorázové dobití – platnost 12 měsíců + bonus: ke každému prvnímu dobití 20 ks stříbrných QR štítků ELDOCK zdarma!):**
     1) **`Balíček START (1 kompletní zakázka domu / 2 rozváděče)`** – **30 kreditů za 750 Kč** *(25,00 Kč / kredit)*
     2) **`Balíček MONTÉR (5 kompletních zakázek / 8 rozváděčů – Nejoblíbenější)`** – **125 kreditů za 2 490 Kč** *(19,92 Kč / kredit – úspora 20 %)*
     3) **`Balíček PROJEKČNÍ & MONTÁŽNÍ FIRMA (12 zakázek / 20 rozváděčů)`** – **300 kreditů za 4 990 Kč** *(16,63 Kč / kredit – úspora 33 %)*
   - **Předplatné pro pravidelné uživatele, budovy a průmysl:**
     1) **`ELDOCK PRO (Elektrikář & Projektant)`:** **1 490 Kč / měsíc** *(nebo 14 900 Kč / rok)* – obsahuje **100 kreditů měsíčně**, neomezený cloud archiv verzí `v1.0 -> v1.1`, normohodinové cenové nabídky a 3D náhled.
     2) **`ELDOCK REVIZE & BUDOVY (Kanceláře, Administrativní budovy, Školy, Kliniky, Revizní technici)`:** **1 990 Kč / měsíc** *(nebo 19 900 Kč / rok)* – samostatný modul Hlídač revizí až pro **500 spotřebičů, monitorů, prodlužovaček a rozváděčů**, AI čtečka výrobních štítků (OCR), Chytrá revize a Měsíční TIČR report.
     3) **`ELDOCK PRŮMYSL & ENTERPRISE (Výrobní závody, OC, Nemocnice)`:** **6 900 Kč / měsíc** *(nebo 69 000 Kč / rok)* – až **5 000 zařízení, strojů a spotřebičů**, živá mapa areálu, BIM (`.ifc`) import, Červenka + burza projektantů a zálohy PLC.

================================================================================
ČÁST 4: SAMOSTATNÁ SEKCE „HLÍDAČ REVIZÍ & SPRÁVA SPOTŘEBIČŮ A ZAŘÍZENÍ“ + AI ČTEČKA VÝROBNÍHO ŠTÍTKU (`Vyfotit výrobní štítek`)
================================================================================

Po hlídání revizí je velká poptávka nejen ve výrobních závodech, ale také v **administrativních a kancelářských budovách, školách, úřadech a klinikách**, které musí pravidelně revidovat **monitory, počítače, prodlužovačky, rychlovarné konvice, mikrovlnky, kávovary, ruční nářadí i rozváděče** (dle **ČSN 33 1600 ed. 2** a **ČSN 33 1500**).

1. **Vytvoř samostatnou, přehlednou sekci `/hlidac-revizi` (dostupnou z hlavní navigace, z pravé větve úvodní stránky i z průmyslové části):**
   - Umožni uživateli vybrat režim objektu: **`[ 🏢 Administrativní budova / Kanceláře / Škola / Klinika ]`** vs. **`[ 🏭 Výrobní závod / Dílna / Sklad ]`**.
   - **Snadné nakreslení budovy, pater a místností + osazení spotřebičů na 1 klik:**
     * Uživatel si za pár vteřin nakliká patra (`1. NP`, `2. NP`) a místnosti (např. *Kancelář 101, Open-space, Kuchyňka, Serverovna, Dílna*) a z rychlé palety do nich sází spotřebiče a zařízení:
       - **Kancelář a IT:** `🖥️ Monitor`, `💻 Počítač / Dokovací stanice`, `🔌 Prodlužovací přívod (Prodlužovačka / Přeběhová ochrana)`, `🖨️ Tiskárna / Kopírka`, `❄️ Klimatizace`.
       - **Kuchyňka a zázemí:** `☕ Kávovar / Rychlovarná konvice`, `🍲 Mikrovlnná trouba`, `🧊 Lednice`, `🍽️ Myčka`, `🔥 Ohřívač vody / Bojler`.
       - **Dílna a budova:** `🛠️ Ruční elektrické nářadí (vrtačka, bruska)`, `⚡ Rozváděč (RH / RP)`, `🚨 Nouzové osvětlení`, `⚙️ Výrobní stroj`.

2. **NOVÁ KLÍČOVÁ FUNKCE U KAŽDÉHO ZAŘÍZENÍ: `📷 Vyfotit výrobní štítek (AI OCR čtečka + Identifikační štítek)`:**
   V detailu každého zařízení/spotřebiče (v `/hlidac-revizi`, v detailu podlaží `/plant/...` i v `/rychla-revize`) měj **2 samostatné fotografické sloty** a **automatický generátor identifikačního štítku**:
   - **Slot 1: `📸 Fotka zařízení (Celkový pohled na přístroj / umístění)`** (`devicePhotoUrl`).
   - **Slot 2: `🏷️ Fotka výrobního štítku + AI čtení údajů`** (`nameplatePhotoUrl`):
     * Tlačítko **`[ 📷 Vyfotit / Nahrát výrobní štítek (AI přečte údaje) ]`** (podporuje fotoaparát mobilu `capture="environment"`, nahrání souboru i vložení přes `Ctrl+V`).
     * **1) Uchování fotky výrobního štítku:** Nahraná fotka výrobního štítku se **trvale uloží jako druhá fotka k zařízení** (`nameplatePhotoUrl`), takže si ji revizní technik nebo inspektor může kdykoliv rozkliknout v plném rozlišení!
     * **2) Automatické přečtení dat z výrobního štítku (`/api/ocr-nameplate` + chytrý klientský/serverový extraktor):**
       - Přečte ze štítku (nebo umožní bleskově potvrdit/upravit):
         * **`Název a typ zařízení`** (např. `Monitor Dell UltraSharp 27"` / `Prodlužovací přívod 5 zásuvek 3 m`),
         * **`Výrobce (Brand)`** (např. `DELL`, `Bosch`, `Hilti`, `ETA`, `ABB`),
         * **`Model / Typové označení`** (např. `U2723QE`),
         * **`Výrobní číslo (S/N – Serial Number)`** (např. `CN-0892K1-74210`),
         * **`Technické parametry ze štítku`:** Napětí (`230 V / 50 Hz`), Příkon / Proud (`90 W / 1,5 A`), Krytí (`IP20`), **Třída ochrany dle ČSN 33 1600 ed. 2** (`Třída I – PE`, `Třída II – dvojitá izolace 回`, `Třída III – SELV`) a **Skupina používání (`A, B, C, D, E`)**, podle které systém **automaticky spočítá datum příští revize** (např. 12 nebo 24 měsíců)!
     * **3) Automatické vygenerování přehledného identifikačního štítku (`Přehledný štítek zařízení`):**
       - Hned pod fotkou výrobního štítku vykresli čistý, kontrastní **Identifikační štítek zařízení ELDOCK** (připravený jak pro zobrazení na obrazovce, tak pro tisk na kotouč `30×15 mm` / `50×25 mm` na tiskárně Zebra ZD421t):
         * Obsahuje: **Unikátní QR kód s logem ELDOCK (`EL-xxxxxx`)**, **Tučný název zařízení**, **Výrobce & Model**, **Výrobní číslo (`S/N: ...`)**, **Místnost / Budova**, **Třída a skupina ČSN 33 1600** a **Termín příští revize**!
       - Díky tomu revizní technik při příští revizi v kanceláři s 20 stejnými monitory nebo prodlužovačkami na první pohled (nebo pípnutím QR kódu) neomylně pozná, o který konkrétní kus s jakým výrobním číslem (`S/N`) jde!

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit a integrační testy ověřující:
   - Že při přenosu z 2D půdorysu do Panel Builderu průvodce nabídne varianty uspořádání (Dvoupolová skříň Silnoproud | Slaboproud, Široké 24M lišty, Kompaktní 18M lišty, Dva rozváděče), zkomprimuje poloprázdné lišty a ke každé variantě najde v databázi odpovídající reálné rozvodnice.
   - Že v editoru DIN lišt fungují přepínače šířky lišt (`12M | 18M | 24M | 36M`) a přepnutí na 2 sloupce vedle sebe.
   - Že úvodní stránka `/` zobrazuje čistý dvoustranný rozcestník (Domovní instalace vs. Průmysl & Hlídač revizí) a že kliknutí na logo ELDOCK v hlavičkách vždy směřuje na `/`.
   - Že kreditní systém povolí 1 testovací půdorys/rozváděč zdarma a pro další komerční projekty vyžaduje kredity nebo tarif.
   - Že v sekci `/hlidac-revizi` (i v detailu zařízení v budově) lze k zařízení uložit jak celkovou fotku, tak fotku výrobního štítku (`nameplatePhotoUrl`), přečíst z ní `S/N` a parametry a vygenerovat přehledný identifikační štítek s názvem a výrobním číslem.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Migrace `20261113162042_phase111_layout_credits_nameplate`** (před nasazením záloha databáze):

- `Equipment`: `nameplatePhotoUrl` (druhá fotka – výrobní štítek), `nameplateDataJson`, `nameplateReadAt`.
- `PanelBoardProject`: `railLayoutJson` (uspořádání lišt), `license`, `quoteUnlockedAt`, `cncUnlockedAt`; `Floorplan`: `license`,
  `quoteUnlockedAt`.
- `RegisteredCompany`: `trialFloorplanUsed`, `trialSwitchboardUsed`, `creditsValidUntil`, `subscriptionPlan`,
  `subscriptionUntil`, `subscriptionCreditedAt`, `firstTopUpBonusAt`; nová firma začíná na 0 kreditech.
- Nová tabulka `CreditTransaction` – každý pohyb kreditů (dobití, předplatné, akce, vrácení, převod, ruční úprava).
- Převod zůstatků na nový ceník: 1 dosavadní kredit (= 1 rozváděč) = 15 nových kreditů (záznam `CONVERSION`).
  Stávající projekty a půdorysy jsou plné verze (`PAID`), vzorový PB-001 `SAMPLE`.

**1. Uspořádání rozváděče z 2D půdorysu a šířka lišt**

- Příčina 14 × 12M: lišty se plnily postupně (každý chránič na novou lištu). Dvoupolové rozvodnice bez P_max výběr
  vyřadil a potřeba skříně nepočítala s poli.
- `src/lib/panel-builder/rail-layout.ts`:
  - `packRails` (v zadání `packRailsOptimally`) skládá „first-fit“ po skupinách:
    - skupina chrániče / jističochrániče (`-FA…`) i ovládací skupina zůstanou pohromadě;
    - samostatné jističe doplní volná místa;
    - rezerva 15 % (`railFillLimit`: 12M → 10, 18M → 15, 24M → 20, 36M → 30);
    - přístroje z poslední poloprázdné lišty se přesunou nahoru.
  - `planLayout` rozloží přístroje podle 4 koncepcí. `matchLayoutEnclosures` k nim hledá skutečné rozvodnice z databáze:
    - stejný výrobce, nejmenší vyhovující, ověřené z katalogu výrobce, se známým P_max;
    - rezerva skříně 25 %.
  - Dvoupolová skříň = sloupce po 12 M vedle sebe:
    - pole A silnoproud;
    - pole B slaboproud (Smart Home / KNX / Loxone / free@home, PLC, zdroje).
- `SwitchboardLayoutWizardModal.tsx` se otevře:
  - po „⚡ Vygenerovat rozváděč z půdorysu“ (i z průvodce 2D půdorysem);
  - z tlačítka `[ 📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud) ]` v horní liště plátna AI Panel Builderu.
- Průvodce doporučuje:
  - se slaboproudem dvoupolovou skříň;
  - bez slaboproudu nejmenší koncepci. Dva rozváděče bez slaboproudu nedoporučí.
- Každá varianta ukazuje rozložení lišt a několik skutečných skříní k výběru, u dvou rozváděčů skříň RH1 i RH2.
- Dva rozváděče:
  - RH1 (nebo RH, když má půdorys podružné RP);
  - nový projekt RH2 propojený jako podružný rozváděč. Přívod: jistič B6 skupiny „Ovládání a řídicí obvody“,
    CYKY-J 3×1,5, 1 m.
- Editor DIN lišt:
  - `Šířka všech lišt: 12M | 18M | 24M | 36M` – přístroje se znovu rozloží ve stejné koncepci;
  - `Sloupce (Pole): 1 pole | 2 pole vedle sebe`;
  - tlačítka šířky a − / + v záhlaví lišty fungují v obou polích.
- Plátno kreslí pole A a B vedle sebe se svislou přepážkou skříně. U širokých lišt je slaboproud dole za vodorovnou
  přepážkou.
- Krok 1b Skříň rozváděče počítá potřebu podle uspořádání (pole, šířka řady). Pro dům se Smart Home 100–168 M najde:
  - dvoupolové ABB ComfortLine CA / CU …V a …R nebo Hager Univers FWU…S;
  - nebo 5–6 × 24M: Mistral41W, ComfortLine Compact CA25 / CA26, Eaton BF-O, Hager Golf.
- Dvoupolové skříně mají v návrhu lišty po polích. Tří- a čtyřpolové mají dál lištu přes celou řadu.
- **Odchylka:** v databázi nejsou skříně OEZ (RZA / RZG / RN), Schneider Pragma 4×18M ani dvoupolové Eaton xEnergy, a
  z oficiálních dat výrobců je zatím nemáme. Průvodce je proto nenabízí.

**2. Úvodní stránka a logo**

- Logo ELDOCK vede ve všech hlavičkách na `/` (`data-testid="logo-home"`):
  - Správa závodů (`AppHeader`, včetně revizí a podlaží);
  - AI Panel Builder i 2D půdorys (`PanelBuilderHeader`);
  - veřejný web včetně `/kontakt` (`SiteChrome`);
  - velín `/superadmin` a `/prezentace`;
  - logo uprostřed přihlašovacích stránek.
- Dříve vedlo logo aplikace na `/app` a logo Panel Builderu na `/panel-builder`.
- `/` je dvoustranný rozcestník s texty podle zadání:
  - vlevo 🏠⚡ Domovní a komerční elektroinstalace & Rozváděče;
  - vpravo 🏭🛡️ Průmysl, Administrativní budovy & Hlídač revizí;
  - pod nimi odkaz „Domluvte si nezávaznou ukázku“ a odběr novinek.
- Podrobnosti jsou až v podsekcích `/sekce/elektroinstalace` a `/sekce/prumysl-a-revize`:
  - náhledy obrazovek a popisy modulů s tlačítky pro spuštění (2D půdorys, AI Panel Builder, nabídky, Hlídač revizí,
    mapa závodu, pasporty);
  - ceník, vzorový elaborát a video-návody;
  - produktové video v podsekci průmyslu.
- Dosavadní stránky `/domovni-elektroinstalace` a `/prumysl` zůstávají jako podrobný přehled.

**3. Kredity a monetizace (`src/lib/credits/`)**

- **1 testovací projekt zdarma** = 1 zkušební 2D půdorys + 1 zkušební rozváděč.
  - Místo počítadla `freeTrialProjectsRemaining` jsou dva příznaky firmy; funkce `freeTrialProjectsRemaining` je odvozená.
  - Výstupy zkušebního projektu nesou označení „ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL (1. testovací projekt zdarma)“: PDF
    elaborát, cenová nabídka, výkres PDF / DXF, kusovník.
- Ceny akcí: rozváděč 15, 2D půdorys 15, balíček celá zakázka 25, cenová nabídka nebo CNC balíček 8 kreditů.
  - Balíček celá zakázka 25 kr. = půdorys 15 + doplatek rozváděče 10. Nabídka je v ceně, nový rozváděč z téhož
    půdorysu je zdarma.
  - Půdorys se účtuje při prvním uložení na server (i duplikát a import).
  - Smazání nedokončeného projektu vrátí zaplacené kredity podle pohybů.
- Prodejní modal „💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)“ s ceníkem, balíčky
  a PRO se otevře:
  - při nedostatku kreditů na nový půdorys nebo rozváděč;
  - na „💎 Odemknout plnou verzi“ u zkušebních výstupů (odemčení za cenu rozváděče / půdorysu);
  - u nabídky a CNC.
- Balíčky START 30 / 750 Kč, MONTÉR 125 / 2 490 Kč a FIRMA 300 / 4 990 Kč:
  - platnost 12 měsíců od posledního dobití; po vypršení modal s důvodem;
  - k prvnímu dobití 20 stříbrných QR štítků jako dávka ve velínu, odeslání poštou ručně.
- Předplatné:
  - PRO (1 490 Kč / měsíc, 14 900 Kč / rok) se objedná QR platbou. 100 kreditů měsíčně připíše denní úloha.
  - REVIZE & BUDOVY a PRŮMYSL & ENTERPRISE se objednávají přes kontakt a aktivuje je obchod.
- Ukázková firma (Tester) má všechny projekty zkušební a kredity se jí neodečítají – veřejné demo zůstává zdarma.
- Lead za kontakt: „1 testovací projekt zdarma“ (dříve 45 kreditů). Podmínky užití 1.2 (čl. 5 Kredity, zkušební projekt a
  ceník) a zásady 1.7 (čtení výrobních štítků přes Gemini) před ostrým prodejem zkontrolovat právníkem.
- **Odchylka:** limity tarifů (500 / 5 000 zařízení) jsou zatím jen v ceníku, technicky se nevynucují.

**4. Hlídač revizí & Správa spotřebičů a zařízení (`/hlidac-revizi`)**

- Kudy se tam dostanete:
  - hlavní navigace webu i aplikace;
  - pravá karta rozcestníku a podsekce průmyslu;
  - tlačítko na `/prumysl`.
- Bez přihlášení stránka ukáže přehled a tarify. Po přihlášení je to pracovní plocha zvoleného závodu (`?zavod=`).
- Režim objektu 🏢 / 🏭 se pamatuje u závodu:
  - spotřebiče dostanou skupinu používání E (administrativa) nebo C (výroba);
  - interval revize určí pravidlo ČSN 33 1600 ed. 2.
- Rychlá budova: název + patra se seznamem místností oddělených čárkou. Založí se jako koncept Studia, místnost 6 × 5 m.
- Paleta 14 spotřebičů ve 3 skupinách podle zadání. Klik přidá zařízení s označením a pinem v místnosti.
- Detail zařízení má 2 fotografické sloty:
  - 📸 fotka zařízení (dosavadní fotka);
  - 🏷️ fotka výrobního štítku + AI.
- Výrobní štítek:
  - fotoaparát `capture="environment"`, nahrání souboru i Ctrl+V;
  - náhled v plném rozlišení;
  - `/api/ocr-nameplate` uloží fotku do soukromého úložiště závodu a přečte údaje: název, výrobce, model, S/N, napětí,
    příkon / proud, IP, třída, skupina;
  - formulář pro potvrzení / úpravu. Uložení přejmenuje zařízení a přepočítá interval a termín příští revize.
- Identifikační štítek: QR `EL-xxxxxx` z registru QR štítků, tučný název, výrobce & model, S/N, místnost / budova, třída a
  skupina, příští revize. Tisková stránka `/equipment/[id]/stitek?rozmer=30x15|50x25` má přesný rozměr kotouče Zebra
  ZD421t a tiskne se z prohlížeče.
- Kde všude je štítek:
  - Hlídač revizí;
  - karta zařízení;
  - rychlý náhled zařízení v podlaží `/plant/…`;
  - rychlá revize `/inspections/rapid` (nově i adresa `/rychla-revize`).
- **Odchylky:**
  - Bez `GEMINI_API_KEY` (E2E, vývoj) se fotka nečte – údaje se vyčtou z vloženého textu štítku nebo se doplní ručně.
  - Štítek se tiskne z prohlížeče, ZPL pro ID štítek se negeneruje.

**5. Testy**

- `src/lib/panel-builder/phase111.test.ts` (14):
  - rezerva lišt a komprimace skupin chráničů;
  - 4 koncepce (2 pole, 24M, 18M, dva rozváděče) se skutečnými skříněmi a odhadem P_max;
  - krok 1b: 14 × 12M ve dvou polích najde dvoupolovou skříň se 7 řadami;
  - uspořádání a plátno s přepážkami;
  - generátor z půdorysu.
- `src/lib/phase111.test.ts` (9):
  - ceník, zkušební projekt a výstupy podle licence, platnost kreditů a PRO, ceník na webu;
  - čtečka štítku (S/N, napětí, příkon, proud, IP, třída) a odpověď AI;
  - identifikační štítek;
  - režimy, paleta a rozvržení pater;
  - rozcestník.
- `src/server/services/phase111.test.ts` (7):
  - zkušební projekt a balíček celá zakázka;
  - plná verze, samostatná nabídka a vrácení;
  - PRO a ukázková firma;
  - náhled koncepcí, generování dvou polí a RH1 + RH2;
  - přeuspořádání osazeného projektu;
  - Hlídač revizí: budova, spotřebiče, štítek se S/N a EL-xxxxxx.
- E2E `e2e/phase111.spec.ts` (5):
  - průvodce uspořádáním z 2D půdorysu, 2 pole, šířka všech lišt, 24M s přepážkou;
  - rozcestník, podsekce a logo na veřejném webu;
  - logo v přihlášené aplikaci;
  - nová firma se zkušebním rozváděčem a prodejním modalem;
  - Hlídač revizí s budovou, spotřebiči, výrobním štítkem a ID štítkem 30 × 15.
- Upravené starší testy podle nového ceníku, rozcestníku a průvodce uspořádáním. Celá sada E2E navíc odhalila:
  - test kódu projektu závislý na pořadí (PB-002) – projekt se hledá podle názvu;
  - zásuvku u umyvadla, kterou fáze 109 zvedá na 1150 mm (test čekal 300 mm);
  - druhé pole pro soubor na kartě zařízení;
  - příponu `-ZKUSEBNI` u CNC souborů ukázkové firmy;
  - Hlídač revizí v navigaci terénního pohledu – terénní pohled zůstává bez hlavní navigace;
  - hlavičku Panel Builderu zalomenou do 2 řádků – pod 1536 px ukazuje jen „Kredity: N“ a 🎁 (celý text v bublině).
