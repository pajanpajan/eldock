# Zadání fází 76–79 – 2D půdorys & kabeláž: obvodový router, stínění a čidla, oblíbené a ukládání, import DXF

**Zdroj:** zadání vložené uživatelem do chatu 2026-11-10 (doslovné znění níže). Zadání ukládá soubor
`ZADANI-faze-57-60.md` – čísla 57–60 jsou obsazená (poslední fáze v `git log` je 75), proto
**fáze A = 76, B = 77, C = 78, D = 79**. Každá fáze = vlastní `npm run verify`, plán, `docs:bundle` a commit.

**Poznámky k realizaci (při rozpisu 2026-11-10):**
- Fáze 78, cloud: průběžné ukládání půdorysu na server už existuje (fáze 64 – `Floorplan` + `FloorplanVersion`,
  seznam „Půdorysy“, historie verzí, souběh dvou oken, vazba na rozváděč). Nový model `FloorplanProject` by ho
  zdvojil – rozšíří se stávající `Floorplan` o to, co chybí (kód FP-001, odstup 800 ms, indikátor ☁️ s časem,
  přepínání zakázek), a přibude soubor `.eldock.json` do počítače.
- Fáze 77, objednací čísla modulů: platí ověřená čísla z `smart-home.ts` (Katalog ABB 2026, Loxone); čísla ze zadání,
  která katalogu neodpovídají, se neopisují. U klasické instalace 230 V ovládá motor žaluzie žaluziový spínač na stěně
  – aktory do rozváděče přibudou jen u sběrnicové / chytré instalace, u klasické jen okruh B10.
- Fáze 78, fotky výrobců: podle zadání je souhlas výrobců; odkud soubory stáhnout a zda smí být ve veřejném
  repozitáři, se ověří s uživatelem před stažením (stahování souborů jen se souhlasem).
- Fáze 79, DWG: uzavřený binární formát bez veřejné specifikace – nahraný `.dwg` dostane návod uložit výkres jako DXF.

---

Máme kompletní sadu rozšíření pro 2D Půdorys & Kabeláž (`/panel-builder/floorplan`) a jeho propojení s AI Panel Builderem.

TVŮJ POSTUP:
1. Nejprve ulož kompletní znění tohoto zadání do `docs/archiv/ZADANI-faze-57-60.md` a rozepiš tyto 4 navazující fáze do `docs/PLAN.md` (zkontroluj v `git log` poslední číslo fáze a navazuj plynule).
2. Realizuj je postupně FÁZI PO FÁZI. Po každé dokončené fázi spusť `npm run verify` (typecheck, lint, unit testy, build), aktualizuj `docs/PLAN.md` + `npm run docs:bundle` a udělej samostatný git commit.

================================================================================
FÁZE A (1/4): 4STUPŇOVÝ OBVODOVÝ ROUTER KABELŮ + VIDITELNOST OKRUHŮ (OKO 👁️) A SBALOVACÍ PRAVÝ PANEL
================================================================================

1. NOVÝ 4STUPŇOVÝ OBVODOVÝ ROUTER KABELŮ (`src/lib/panel-builder/perimeter-router.ts`):
Musíme zásadně vylepšit algoritmus automatického trasování kabelů v 2D půdorysu (`/panel-builder/floorplan` a `src/engine/floorplan-bridge.ts`).

PROBLÉM SOUČASNÉHO TRASOVÁNÍ:
Současný router spojuje zásuvky v okruhu naivní L-čarou (vzdušnou Manhattan spojnicí) a řadí je podle vzdušné vzdálenosti. Kvůli tomu:
- Vede kabely přímo středem místnosti (např. ze spodní stěny ložnice kolmo přes postel na horní stěnu).
- Vrací se po stejné stěně tam a zpět, takže podél jedné zdi kreslí dvě souběžné černé čáry vedle sebe.

CÍLOVÝ STAV (JAK MÁ TRASOVÁNÍ FUNGOVAT):
Kabely musí vést přísně po obvodu stěn místností (Wall-Hugging / Perimeter Daisy-Chain dle instalačních zón ČSN 33 2130 ed. 4) v jedné čisté obvodové lince bez křížení středu místnosti a bez dvojitých souběžných čar.

Naimplementuj tento 4stupňový obvodový router (`src/lib/panel-builder/perimeter-router.ts` a napoj ho do 2D půdorysu):

a) STUPEŇ 1 – SJEDNOCENÍ VODICÍ DRÁHY PODÉL STĚNY (WALL-TRACK SNAPPING):
   - Pro každou místnost (nakreslenou místnost `Room`, nebo pokud v místě není nakreslená místnost, tak pro automaticky odvozenou obálku `inferredRoomBox` ze souřadnic prvků daného okruhu/skupiny s odsazením ke stěnám) definuj obvodovou instalační dráhu (`perimeterTrack` ve vzdálenosti např. `180 mm` od vnitřního líce stěny, resp. přímo v ose stěny).
   - Každý prvek u stěny (zásuvka, vypínač, spotřebič, čidlo, vývod žaluzie) přiřaď k nejbližší stěně místnosti (`NORTH`, `EAST`, `SOUTH`, `WEST`, příp. šikmá stěna polygonu).
   - Pokud leží více zásuvek na téže stěně (např. 3 zásuvky na horní stěně za postelí nebo 2 zásuvky na spodní stěně), zarovnej jejich propojovací trasu na JEDNU SPOLEČNOU vodorovnou/svislou osu této stěny (`wallTrackY` nebo `wallTrackX`), aby mezi sousedními zásuvkami na jedné zdi nikdy nevznikaly odskoky nebo dvojité čáry!

b) STUPEŇ 2 – OBVODOVÉ ŘAZENÍ PRVKŮ V MÍSTNOSTI (1D PERIMETER SWEEP – KONEC VRACENÍ KABELU):
   - Zruš řazení zásuvek v místnosti pomocí vzdušného "nejbližšího souseda", které přeskakuje mezi protilehlými stěnami!
   - Místo toho promítni každý prvek v místnosti na jednorozměrnou souřadnici `s` po obvodu místnosti (`0` až `obvod = 2*(W + H)`, měřeno od vstupního bodu kabelu do místnosti):
     * Vstupní bod do místnosti (`entryPoint`) je roh/bod na stěně místnosti nejblíže nadřazenému rozváděči `RH` (nebo chodbové páteři).
     * Spočítej délku obvodu při průchodu **po směru hodinových ručiček (CW)**, **proti směru hodinových ručiček (CCW)** a **rozvětvením ze vstupního rohu na dvě strany**, a vyber tu variantu, která má nejkratší souvislou trasu po stěnách bez překřížení!
     * Příklad pro ložnici (vstup vlevo nahoře/uprostřed, zásuvky na spodní a horní stěně): trasa vstoupí z chodby na levou stěnu -> sejde po levé stěně na spodní stěnu -> projede v jedné přímce všechny zásuvky na spodní stěně zleva doprava -> v pravém dolním rohu zahne po pravé obvodové stěně nahoru -> v pravém horním rohu zahne doleva na horní stěnu a projede všechny zásuvky za postelí zprava doleva.
     * VÝSLEDEK: Žádná čára nejde středem místnosti přes postel a na žádné stěně nejsou dvě čáry vedle sebe!

c) STUPEŇ 3 – ZÁKAZ PRŮCHODU VNITŘKEM MÍSTNOSTI (INTERIOR OBSTACLE AVOIDANCE):
   - Při spojování dvou bodů `(A, B)`, které leží na různých stěnách (např. `SOUTH` a `NORTH` stěna), NIKDY nepoužívej přímý L-spoj `[Ax, Ay] -> [Ax, By]`, pokud by tento úsek procházel vnitřkem místnosti (tj. mimo obvodový pás stěn šířky `400 mm`)!
   - Spoj mezi dvěma různými stěnami místnosti VŽDY veď po obvodové dráze stěn přes rohy místnosti (`cornerWaypoints`):
     * Ze stěny `SOUTH` na stěnu `NORTH` veď trasu buď přes stěnu `EAST` (`[Ax, southY] -> [eastX, southY] -> [eastX, northY] -> [Bx, northY]`), nebo přes stěnu `WEST`, podle toho, která cesta po obvodu je kratší a nevrací se po již použité stěně.
   - Jedinou výjimkou, kdy smí čára vést do vnitřku místnosti, je koncový přívod ke **stropnímu svítidlu** nebo **podlahové krabici / ostrůvku**, který je záměrně umístěn uprostřed místnosti (a v režimu `Spodem v podlaze` pouze tehdy, když uživatel výslovně zapne přepínač `"Povolit přímé trasy v podlaze mimo stěny"` – ve výchozím stavu vždy trasuj čistě po stěnách!).

d) STUPEŇ 4 – PÁTEŘNÍ TRASA Z ROZVÁDĚČE PODÉL CHODBY A PŘEPÍNÁNÍ STYLU TRASOVÁNÍ:
   - Cestu z hlavního rozváděče `RH` ke vstupnímu bodu vzdálené místnosti veď podél stěn přilehlých místností / chodby (využij hrany nakreslených místností jako koridor), aby ani přívodní část okruhu neřezala cizí místnosti šikmo nebo středem.
   - Do horní lišty 2D půdorysu přidej přepínač stylu vykreslení tras:
     * `[ 🧱 Po stěnách (obvodově dle ČSN) ]` *(VÝCHOZÍ – chová se přesně podle bodů 1–3, obíhá místnost po stěnách)*
     * `[ 📐 Nejkratší v podlaze (přímé L-trasy) ]` *(pro případ, kdy projektant tahá husí krky v betonu křížem podlahou)*
   - Pokud uživatel posune zásuvku nebo upraví rozměr místnosti, obvodová trasa se okamžitě přepočítá po stěnách (s možností kterýmikoliv rovnými úseky dál ručně šoupat myší v ose X/Y).
   - Napiš unit testy v `src/lib/panel-builder/perimeter-router.test.ts`, které na modelové ložnici (zásuvky na spodní a horní stěně) ověří, že žádný vygenerovaný segment neprotíná vnitřní obdélník místnosti a že trasa oběhne místnost přes obvodovou stěnu.

2. IKONA OKA (`👁️`) PRO VIDITELNOST JEDNOTLIVÝCH OKRUHŮ + SBALOVACÍ PRAVÉ PANELY:
- V pravém sloupci v soupisu okruhů (`Výkaz kabeláže a okruhů`) přidej ke každému okruhu (např. `Okr. -F1`, `Okr. -F2`...) klikací **ikonku oka (`👁️` / `Eye` vs `EyeOff`)** a checkbox:
  * Uživatel si může jedním klikem zapnout/vypnout, které konkrétní okruhy (jejich kabelové trasy a zvýraznění prvků) chce mít v půdorysu aktuálně viditelné!
  * Do záhlaví soupisu okruhů přidej rychlá tlačítka `[ 👁️ Zobrazit vše ]`, `[ Skrýt vše ]` a `[ Jen vybraná místnost ]`.
- **Sbalovací sekce v pravém panelu (Accordion):**
  * Všechny panely a karty v pravém sloupci (`Detail vybraného prvku / místnosti`, `Chytrá domácnost – akční členy`, `Kontrola půdorysu a norem`, `Výkaz kabeláže a okruhů`, `Založit rozváděč`) udělej sbalovací a rozbalovací (s šipkou `▾ / ▸` a tlačítkem `Sbalit / Rozbalit vše` nahoře), přesně jako v levém menu, aby pravý sloupec působil čistě a přehledně.

================================================================================
FÁZE B (2/4): STÍNÍCÍ TECHNIKA, ČIDLA (OKNA/DVEŘE, VODA), VYTÁPĚNÍ A POKROČILÉ OSVĚTLENÍ (STMÍVÁNÍ, CCT, RGBW) + MODULY DO ROZVÁDĚČE
================================================================================

1. VÝVOD K OKNŮM NA STÍNÍCÍ TECHNIKU (ŽALUZIE / ROLETY / MARKÝZY):
- Do levého menu v 2D půdorysu přidej novou paletu / sekci **`🪟 Stínící technika, čidla a vytápění`** (a propojení do stávajících kategorií):
  * **`ZAL_M` Vývod pro motor žaluzie / rolety (u okna)** – výchozí výška `2450 mm` (horní kastlík okna), schematická značka pohonu žaluzie (`M` se šipkami `▲/▼`).
  * U vývodu stínění umožni zvolit typ pohonu:
    - `230 V AC pohon (klasický / přes relé aktor)` -> kabel `CYKY-J 5×1,5` (nebo `4×1,5`).
    - `24 V DC pohon / Sběrnicový pohon (Loxone / Somfy / KNX)` -> kabel `SYKFY / CAT7 / 24 V DC`.
    - Možnost spárovat motor žaluzie s žaluziovým spínačem/tlačítkem na stěně v místnosti.

2. OKENNÍ A DVEŘNÍ ČIDLA, ČIDLA ÚNIKU VODY, CHYTRÉ TERMOSTATY A TERMOSTATICKÉ HLAVICE:
Do půdorysu přidej tyto prvky s jejich schematickými značkami, výškami a kabeláží:
- **`MAG` Okenní / dveřní magnetický kontakt (čidlo otevření okna/dveří):**
  * Výchozí výška `2100 mm`, kabel `SYKFY 2×2×0,5` nebo `CAT7` (sběrnice/binární vstup). Slouží pro zabezpečení, blokování rekuperace/topení při otevřeném okně a ochranu před vyjetím žaluzie při otevřeném okně.
- **`VOD` Čidlo úniku vody (záplavový senzor):**
  * Výchozí výška `50 mm` (u podlahy pod pračkou, myčkou, dřezem, bojlerem nebo v technické místnosti), značka kapky vody se senzorem, kabel `SYKFY / CAT7` na binární vstup / sběrnici Tree.
- **`TER_S` Chytrý prostorový termostat (s měřením teploty, vlhkosti / CO₂):**
  * Výchozí výška `1400 mm` (nebo `1050 mm` ve společném rámečku s vypínači), napájení `230 V` nebo sběrnice `24 V DC (KNX / Loxone Tree / free@home)`.
- **`HLV` Termostatická hlavice / Servopohon topného okruhu (radiátor / podlahový rozdělovač):**
  * Výchozí výška `300 mm` (u radiátoru) nebo v rozdělovači podlahového topení (`600 mm`), volba `24 V DC`, `230 V AC` nebo `Bezdrátová (Tree/Air/free@home WL)`. Umožni spárovat hlavice v místnosti s prostorovým termostatem dané místnosti!

3. STMÍVÁNÍ SVĚTEL, ZMĚNA CHROMATIČNOSTI (TUNABLE WHITE) A BARVY (RGB / RGBW):
- Když uživatel vkládá do půdorysu světlo (`Stropní svítidlo`, `Nástěnné svítidlo`, nově přidej také **`LED_P` LED pásek / nepřímé osvětlení** a **`BOD` Bodové podhledové svítidlo**) NEBO když klikne na již umístěné světlo v půdorysu, zobraz v panelu detailu světla (a v rychlé plovoucí liště přímo u světla) zaškrtávací volby:
  * `[ ] 🔆 Stmívatelné (Dimming 0–100 %)`
  * `[ ] 🌡️ Změna chromatičnosti (Tunable White – teplá/studená bílá CCT)`
  * `[ ] 🌈 Změna barvy (RGB / RGBW barevné osvětlení)`
  * Volba technologie řízení stmívání/barvy: `Fázové stmívání 230 V (RLC/LED)` | `DALI / DALI-2 sběrnice (kabel 5×1,5)` | `24 V DC PWM (pro LED pásky, CCT a RGBW)`.
- Na půdorysu přímo u značky světla vykresli malý vizuální odznak podle zaškrtnutí (`DIM`, `CCT`, `RGBW`), aby projektant na první pohled viděl, která světla jsou stmívaná a která mění barvu!

4. AUTOMATICKÉ DOPLNĚNÍ MODULŮ DO ROZVÁDĚČE PODLE STÍNĚNÍ, ČIDEL, HLAVIC A STMÍVÁNÍ/RGBW:
Rozšiř `buildSwitchboardFromCircuits` (`src/engine/floorplan-bridge.ts`) a kalkulaci chytré domácnosti, aby podle osazených prvků v půdorysu automaticky přidala přesný počet modulů na DIN lišty v rozváděči:
- **Pro stmívatelné / CCT / RGBW okruhy:**
  * Při `Fázovém stmívání 230 V`: osadí do rozváděče vícekanálový DIN stmívací aktor (např. `ABB DA-M-4.210.2.1` 4kanál 6M / `DA-M-8.210.2.1` 8kanál 8M, nebo `Loxone Dimmer Extension` 4kanál 9M, nebo impulzní stmívač na DIN).
  * Při `DALI`: osadí do rozváděče **DALI bránu / převodník** (`ABB DG-M-1.16.1` 4M nebo `Loxone DALI Extension` 2M) a změní kabel k těmto světlům na `CYKY-J 5×1,5` (L, N, PE, DA+, DA-).
  * Při `24 V DC PWM (CCT / RGBW LED pásky)`: osadí **24 V DC napájecí zdroj na DIN** (dimenzovaný podle součtu příkonu LED pásků + 20 % rezerva) a **RGBW 24V Dimmer aktor** (pro `Stmívatelné` počítá 1 kanál, pro `Tunable White CCT` 2 kanály, pro `RGB` 3 kanály, pro `RGBW` 4 kanály na každé svítidlo/pásek!).
- **Pro stínící techniku (žaluzie/rolety):**
  * Spočítá počet motorů žaluzií a osadí do rozváděče odpovídající počet **žaluziových aktorů** (`ABB JA-M-4.230.1.1` 4M / `JA-M-8.230.1.1` 8M nebo `Loxone Relay Extension` – 2 relé na 1 žaluzii) a jističe žaluziových okruhů `B10A`.
- **Pro termostatické hlavice a topení:**
  * Spočítá počet hlavic/smyček `HLV` a osadí **akční člen vytápění pro termoelektrické pohony** (`ABB HA-M-6.24.1` 6kanál 4M / `HA-M-12.24.1` 12kanál 8M nebo Loxone pohon rozdělovače).
- **Pro okenní/dveřní magnetické kontakty (`MAG`) a čidla vody (`VOD`):**
  * Spočítá celkový počet binárních čidel a osadí do rozváděče **modul binárních vstupů na DIN** (`ABB BE/S 8.20.2.1` / `BM-M` nebo vstupy na `Loxone Miniserveru / DI Extension`), a pokud je v domě čidlo úniku vody `VOD`, nabídne/přidá výstup pro **havarijní elektromagnetický uzávěr hlavního přívodu vody**!

================================================================================
FÁZE C (3/4): UKLÁDÁNÍ SESTAV VÍCERÁMEČKŮ, HVĚZDIČKY OBLÍBENÝCH (⭐), OFICIÁLNÍ FOTKY VÝROBCŮ A DUÁLNÍ UKLÁDÁNÍ (CLOUD + PC)
================================================================================

1. UKLÁDÁNÍ VLASTNÍCH SESTAV VÍCERÁMEČKŮ NA POZDĚJŠÍ POUŽITÍ:
- V editoru sestav pro přístroje do vícerámečku (2R až 5R, např. *Dvojzásuvka + Datová zásuvka RJ45 + TV* k televizi nebo *Vypínač č. 6 + Žaluziové tlačítko + Termostat* u dveří) přidej tlačítko **`[ 💾 Uložit tuto sestavu jako šablonu ]`**.
- Uživatel si sestavu pojmenuje (např. `"Sestava TV stěna 4R"`, `"U postele 3R"`, `"Vstup do pokoje 2R"`) a uloží se trvale do databáze firmy (`RegisteredCompany`) i do `localStorage`, takže ji v každém dalším projektu vloží do půdorysu jedním klikem!

2. HVĚZDIČKA "OBLÍBENÉ" (`⭐`) V SEZNAMECH S AUTOMATICKÝM ŘAZENÍM NAHORU:
- Ve všech nabídkových seznamech v levém panelu půdorysu (zejména: **Sestavy ve vícerámečku**, **Zásuvky**, **Světla a vypínače**, **Sběrnicové ovládání**, **Stínící technika a čidla**, **Samostatné spotřebiče**) přidej na každou položku klikací **hvězdičku (`⭐`)**.
- Pravidlo řazení:
  * Jakmile uživatel hvězdičku zaškrtne (zežloutne), položka se **automaticky přesune nahoru na začátek své kategorie** (případně se zobrazí i v horní rychlé sekci `⭐ Oblíbené prvky`).
  * Jakmile hvězdičku odškrtne, položka se **okamžitě vrátí přesně na své původní katalogové místo** (`originalSortIndex`).
  * Stav oblíbených hvězdiček trvale ukládej do `localStorage` a synchronizuj do profilu firmy v DB.

3. OFICIÁLNÍ NÁHLEDOVÉ OBRÁZKY A DESIGNY VÝROBCŮ:
- Máme souhlas výrobců pro použití jejich oficiálních náhledových obrázků a designů.
- Vytvoř systém `public/catalog-images/` (a stahovací/synchronizační skript + podporu `imageUrl` v katalogu řad, barev a Smart Home prvků):
  * U všech designových řad a barevných variant (ABB Zoni, Tango, Levit, Levit M, Time, Time Arbo, Element, Swing, Swing L, Classic, Decento, future linear, solo, solo carat, Busch-axcent, Garant, Variant+, Praktik; Schneider Nová Unica, Sedna, Asfora; Legrand Valena Life, Valena Allure, Céliane; Hager lumina, berker; Loxone Touch; TapHome) zobrazuj v modalu `Designové řady a barvy` i na kartách chytré domácnosti věrné produktové vizualizace a produktové fotografie ve vysokém rozlišení (s možností nahrát/aktualizovat oficiální fotky ve složce `public/catalog-images/<vyrobce>/<rada>/` a s fotorealistickým vícevrstvým renderem tam, kde externí fotka není v cache).

4. PRŮBĚŽNÉ UKLÁDÁNÍ PROJEKTU PŮDORYSU NA CLOUD I DO POČÍTAČE (`.eldock.json`):
- **Cloud ukládání (SQLite DB):**
  * Vytvoř v `prisma/schema.prisma` model `FloorplanProject` (id, companyId, code `FP-001`, name, customerName, installationSite, dataJson, linkedPanelProjectId, updatedAt) s indexem `(companyId, updatedAt)`.
  * V `/panel-builder/floorplan` zaveď automatické průběžné ukládání na cloud (debounce 800 ms po každé změně) + indikátor v horní liště `☁️ Uloženo v cloudu (HH:MM:SS)` a tlačítko `[ 📂 Moje uložené půdorysy (Cloud) ]` pro přepínání mezi rozpracovanými zakázkami.
- **Ukládání a načítání souboru do/z počítače (`.eldock.json`):**
  * Přidej do horní lišty tlačítka **`[ 💾 Uložit do PC (.eldock) ]`** a **`[ 📥 Nahrát projekt z PC ]`**.
  * Export uloží kompletní stav projektu (verze schématu, všechna podlaží, podkladový obrázek/PDF/DXF, kalibrace měřítka, místnosti, všechny osazené prvky, nastavení stmívání/RGB, uložené sestavy vícerámečků, ručně upravené trasy kabelů, zvolené designové řady a barvy) do souboru `<nazev-projektu>.eldock.json`.
  * Nahrání tohoto souboru z počítače kompletně obnoví celý projekt se 100% věrností, takže v něm uživatel může plynule pokračovat.

================================================================================
FÁZE D (4/4): IMPORT DWG / DXF VÝKRESŮ A KOMPLETNÍ PRÁCE S CAD VRSTVAMI (HLADINAMI)
================================================================================

1. PARSER A IMPORTÉR DXF (A DWG) DO 2D PŮDORYSU (`src/lib/panel-builder/dxf-import.ts`):
- Umožni u tlačítka `Nahrát půdorys` nahrát vedle obrázků a PDF také vektorové CAD soubory **`.dxf`** (a `.dwg` s převodem / upozorněním na uložení jako DXF).
- Vytvoř čistý TypeScript parser DXF entit (`LINE`, `LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`, `TEXT`, `MTEXT`, `INSERT` bloky) seskupený podle **CAD hladin (`LAYER`, kód `8`)** a barev AutoCADu (ACI barvy).
- **Automatická detekce jednotek a měřítka:** Z hlavičky `$INSUNITS` a celkového rozměru výkresu (`boundingBox`) automaticky urči, zda je DXF kreslené v milimetrech (`1 j. = 1 mm`), centimetrech nebo metrech, a automaticky nastav měřítko půdorysu 1:1 bez nutnosti ruční kalibrace!

2. SPRÁVCE CAD VRSTEV (HLADIN) A NÁSTROJE PRO PRÁCI S PODKLADEM:
- Jakmile je nahrán DXF výkres, zobraz v půdorysu panel **`🗂️ Vrstvy CAD výkresu (Hladiny)`**:
  * Seznam všech hladin z nahraného výkresu s barevným čtverečkem, názvem hladiny, počtem objektů, ikonou **`👁️ Viditelnost (Zap/Vyp)`** a **`🔒 Zámek`**.
  * Tlačítko **`[ 🧹 Vyčistit architektonický balast (1-klik) ]`**: automaticky skryje kótovací, šrafovací, textové a nábytkové hladiny (`*DIM*`, `*KOT*`, `*HATCH*`, `*SRAF*`, `*TEXT*`, `*FURN*`, `*NABYT*`, `*OSA*`, `*AXIS*`) a ponechá jen čisté stěny, příčky, okna a dveře!
  * Přepínač **`[ 🌑 Ztlumit podklad do šedé (Monochrome) ]`** + posuvník krytosti podkladu (`20 % – 100 %`), aby barevné trasy kabelů a elektro značky na CAD výkresu perfektně svítily.
  * **Magnetické přichytávání (CAD Snap):** Při kreslení místností a osazování zásuvek, vypínačů, okenních čidel a žaluzií zapni automatické přichytávání kurzoru k úsečkám a vrcholům viditelných CAD vrstev!

Po dokončení všech 4 fází spusť kompletní `npm run verify`, aktualizuj E2E testy a vypiš příkazy pro push a deploy na produkční server.
