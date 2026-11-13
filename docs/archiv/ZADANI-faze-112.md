# Zadání fáze 112 – hřebeny a fáze L1 / L2 / L3, stykač HDO a záslepky, pravoúhlé vazby vypínačů s razítkem ČSN EN ISO 7200 a legendou, import ze staré revize a měřicích přístrojů, Scan & Snap s offline frontou, faktury s QR platbou a údaje provozovatele

Vloženo z chatu 2026-11-13 (během fáze 111, provedeno po jejím nasazení). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Příští týden spouštíme ELDOCK (`https://eldock.cz`) pro elektrikáře a revizní techniky a týden nato pro průmysl a administrativní budovy. Na základě detailní analýzy obrazovek potřebujeme dotáhnout těchto 6 vysoce praktických vylepšení, která rozhodnou o profesionálním dojmu v praxi:

1) V AI Panel Builderu (`/panel-builder/[id]`): vykreslit vizuální propojovací hřebeny (1f / 3f lišty) a štítky fází (`L1`, `L2`, `L3`) přímo pod/nad jističi na 2D plátně, automaticky párovat HDO stykač + ovládací jistič u bojleru/TČ/wallboxu a automaticky počítat krycí záslepky volných modulů do kusovníku.
2) V 2D půdorysu (`/panel-builder/floorplan`): přidat ortogonální vykreslování vazeb vypínač -> světlo (místo šikmých čar přes místnosti) a do PDF exportu půdorysu doplnit normované projekční **Rohové razítko** a **Automatickou legendu použitých značek**.
3) Pro revizní techniky: přidat **Rychlý import ze staré revizní zprávy (PDF / XLSX / CSV) a z měřicích přístrojů (Metrel / Fluke / Illko)**, který automaticky předvyplní okruhy rozváděče nebo seznam spotřebičů v budově.
4) V Hlídači revizí (`/hlidac-revizi` a `/rychla-revize`): přidat bleskový mobilní režim **„Sekvenční sběr v místnosti (Pípni QR ➔ Vyfoť výrobní štítek ➔ Další kus)“** a **Offline PWA frontu**, aby šlo revize a štítky zadávat i v rozvodnách a suterénech bez mobilního signálu.
5) Automatická fakturace s QR platbou (SPD formát pro české banky) při nákupu kreditů a tarifů + editovatelné fakturační údaje provozovatele.

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: VIZUÁLNÍ PROPOJOVACÍ HŘEBENY, FÁZE L1/L2/L3, HDO STYKAČE A ZÁSLEPKY V PANEL BUILDERU
================================================================================

V `/panel-builder/[id]` (`SwitchboardCanvas` a `floorplan-to-switchboard` generátor) dotáhni tyto 3 inženýrské detaily:

1. **Vizuální vykreslení propojovacího hřebenu (1f / 3f lišty) a fází `L1 / L2 / L3` přímo na DIN liště:**
   - Když je na DIN liště zapnutý propojovací hřeben (`Hřeben: 3f` nebo `1f`), vykresli pod spodními svorkami propojených přístrojů (od proudového chrániče `-FIx` přes navazující jističe `-Fx`) realistickou **měděnou hřebenovou přípojnici s vidličkami do svorek** (`L1 / L2 / L3 / N`)!
   - Přímo na každý jistič na DIN liště vykresli malý kontrastní odznak přiřazené fáze (**`L1`**, **`L2`**, **`L3`** nebo **`L1+L2+L3`**) v barvě vodiče dle ČSN (hnědá/černá/šedá nebo přehledný barevný štítek), aby elektrikář při drátování na první pohled viděl, na které fázi který okruh visí!

2. **Automatické osazení HDO stykače k bojleru a tepelnému čerpadlu:**
   - Když se generuje rozváděč z 2D půdorysu, který obsahuje `Bojler / Ohřívač vody`, `Tepelné čerpadlo`, `Akumulační vytápění` nebo `Wallbox` s řízením nízkého tarifu (HDO), automaticky přidej vedle jističe spotřebiče odpovídající **instalační stykač** (např. `ABB ESB25-40N` 2M pro 1f bojler nebo `ABB ESB40-40N` 3M pro 3f TČ/elektrokotel) společně s 1p ovládacím jističem `B2 / B6 (HDO)` a propoj je ve stromu zapojení i drátovacím listu!

3. **Automatický výpočet záslepek volných modulů do kusovníku:**
   - Spočítej celkový počet neobsazených modulů na všech DIN lištách vybrané rozvodnice (např. `Celkem 18 volných modulů`) a do kusovníku rozváděče automaticky přidej položku **`Krycí záslepka neobsazených modulů (dělitelná lišta 12M, IP20/IP40 dle ČSN EN IEC 61439)`** s odpovídajícím objednací číslem výrobce skříně (např. `ABB ZA12P` / `1SPE007715F9701` nebo `OEZ ZAS-12`)!

================================================================================
ČÁST 2: ORTOGONÁLNÍ VAZBY V 2D PŮDORYSU + PROJEKČNÍ ROHOVÉ RAZÍTKO A LEGENDA V PDF
================================================================================

V `/panel-builder/floorplan` vylepši čitelnost výkresu a PDF výstupu:
1. **Pravoúhlé (ortogonální) zobrazení vazeb vypínač ➔ světlo:**
   - Místo šikmých čárkovaných čar, které křížem přeškrtávají místnosti, vykresluj ovládací vazby mezi vypínačem a svítidlem jako čisté **ortogonální (pravoúhlé L/Z) nebo jemně zakřivené CAD vodící linky** s přepínačem v horní liště `[ 📐 Vazby vypínačů: Pravoúhlé CAD | Přímé | Skrýt ]`.
2. **Normované Rohové razítko a Automatická legenda značek v PDF exportu půdorysu:**
   - Při tisku / exportu 2D půdorysu do PDF (A4 / A3) automaticky vykresli v pravém dolním rohu výkresu **projekční rohové razítko dle ČSN EN ISO 7200**:
     * *Projektant / Montážní firma* (načteno z firemního razítka uživatele), *Investor / Objekt*, *Název výkresu (2D Půdorys elektroinstalace – 1. NP)*, *Stupeň (DPS / DSPS – Skutečné provedení)*, *Měřítko*, *Datum*, *Číslo verze (`v1.0`)* a *QR kód projektu ELDOCK*.
   - Vedle razítka automaticky vykresli **Tabulku vysvětlivek použitých značek a barev okruhů** (obsahující přesně ty symboly zásuvek, vypínačů, světel a typů kabelů, které se v daném výkresu vyskytují).

================================================================================
ČÁST 3: IMPORT ZE STARÉ REVIZNÍ ZPRÁVY A Z MĚŘICÍCH PŘÍSTROJŮ (METREL / FLUKE / ILLKO)
================================================================================

Aby revizní technici nemuseli ručně přepisovat desítky okruhů a spotřebičů, přidej do AI Panel Builderu, do `/revize` i do `/hlidac-revizi` funkci **`[ 📥 Importovat z existující revize nebo měřicího přístroje ]`** (`RevisionDataImporterModal.tsx`):
1. **Podpora 3 vstupů:**
   - **A) CSV / XLSX / XML export z měřicích přístrojů a revizních programů** (*Metrel ES Manager*, *Sonel*, *Fluke DMS*, *Chauvin Arnoux*, *Illko / PC Revize*):
     * Automaticky namapuje sloupce: `Označení okruhu / spotřebiče`, `Název / Místnost`, `Jistič / Typ (B16, C16, RCD 30mA)`, `Kabel (CYKY 3×2,5)`, `Izolační odpor Riso [MΩ]`, `Impedance smyčky Zs [Ω]`, `Spojitost PE [Ω]`, `Vybavovací čas chrániče tA [ms]` a `Výrobní číslo S/N`.
   - **B) Nahrání staré revizní zprávy v PDF / Wordu nebo vyfocení tabulky okruhů:**
     * Extrahuje seznam okruhů rozváděče nebo tabulku revidovaných spotřebičů a jedním klikem z nich vytvoří celý rozváděč v AI Panel Builderu nebo naplní budovu v `/hlidac-revizi`!
   - **C) Stažení vzorové CSV/XLSX šablony pro hromadný import.**

================================================================================
ČÁST 4: MOBILNÍ SEKVENČNÍ REŽIM „PÍPNI QR ➔ VYFOŤ ŠTÍTEK ➔ DALŠÍ“ + OFFLINE PWA FRONTY
================================================================================

V sekci `/hlidac-revizi` (a `/rychla-revize`) vytvoř režim pro bleskovou práci v terénu:
1. **Režim `⚡ Rychlý sekvenční sběr v místnosti (Scan & Snap Loop)`:**
   - Technik si na mobilu vybere budovu a místnost (např. *2. NP – Kancelář 204*).
   - Spustí sekvenční režim, který běží v plynulé smyčce bez zbytečného klikání:
     * **Krok 1:** Naskenuj nalepený QR štítek ELDOCK (`EL-xxxxxx`) nebo vygeneruj další v pořadí.
     * **Krok 2:** Vyfoť výrobní štítek spotřebiče/stroje -> AI na pozadí přečte Název, Výrobce, Model, `S/N` a Třídu I/II/III a uloží fotku štítku.
     * **Krok 3:** Zadej 1 klikem výsledek měření (`[ ✅ VYHOVUJE – Riso > 200 MΩ, RPE < 0,3 Ω ]`) a aplikace okamžitě uloží záznam a **sama otevře fotoaparát pro další spotřebič v místnosti**!
2. **Offline odolnost v rozvodnách bez signálu (`src/lib/offline-sync-queue.ts`):**
   - Pokud je technik v suterénu nebo hale bez internetového připojení (`!navigator.onLine` nebo selhání sítě), ulož nově přidané spotřebiče, fotky výrobních štítků a naměřené revize do lokální perzistentní fronty v prohlížeči (`localStorage` / `IndexedDB`), zobraz v rohu indikátor `📡 Offline režim – X záznamů čeká na odeslání` a jakmile se připojení obnoví (`window.addEventListener('online')`), automaticky vše synchronizuj na server!

================================================================================
ČÁST 5: AUTOMATICKÁ ZÁLOHOVÁ / DAŇOVÁ FAKTURA S QR PLATBOU (SPD) A ČISTÉ ÚDAJE V PATIČCE
================================================================================

1. **Generování faktury s QR platbou (český standard SPD `SPD*1.0*ACC:...`) při objednávce kreditů, tarifu nebo QR štítků:**
   - Když si uživatel (nebo firma po zadání IČO s automatickým načtením z ARESu) objedná balíček kreditů (`750 Kč` / `2 490 Kč` / `4 990 Kč`), měsíční/roční tarif nebo sadu QR štítků:
     * Okamžitě vygeneruj profesionální PDF/HTML **Výzvu k platbě / Fakturu** se všemi náležitostmi (odběratel z ARESu, položka, částka, variabilní symbol) a **vykresleným QR kódem pro okamžitou platbu z mobilního bankovnictví kterékoliv české banky (formát Short Payment Descriptor `SPD*1.0`)**!
2. **Úprava údajů provozovatele v patičce a nastavení v `/superadmin`:**
   - Nahraď v patičce texty `Eldock s.r.o. (v založení)` a `Bude doplněno po zápisu do OR` čistým, profesionálním zobrazením provozovatele (`ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz`) s možností v `/superadmin` kdykoliv jedním klikem upravit IČO, DIČ, číslo bankovního účtu (IBAN pro QR platby) a spisovou značku, které se automaticky propíšou jak do patičky webu, tak na všechny faktury a VOP!

================================================================================
ČÁST 6: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit testy ověřující:
   - Že se při osazení bojleru nebo TČ z 2D půdorysu automaticky přidá HDO stykač a že volné moduly v rozváděči vygenerují do kusovníku krycí záslepky modulů.
   - Že generátor QR platby vytvoří platný český bankovní řetězec `SPD*1.0*ACC:...*AM:...*CC:CZK*X-VS:...`.
   - Že importér revizních dat správně přečte CSV/tabulku okruhů a spotřebičů s naměřenými hodnotami $R_{\text{iso}}$, $Z_s$ a `S/N`.
   - Že offline fronta uloží revizi při výpadku sítě a po obnovení spojení ji odešle.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Migrace `20261113210000_phase112_operator_offline`** (před nasazením záloha databáze):

- `PlatformSetting` (klíč → JSON) – údaje provozovatele a sady QR štítků z velínu.
- `OfflineSubmission` – id záznamu z offline fronty prohlížeče. Opakované odeslání po obnovení signálu vrátí uložený
  výsledek a nic se nezaloží podruhé.

**1. AI Panel Builder – hřebeny, fáze, HDO, záslepky**

- `src/lib/panel-builder/comb-busbars.ts` určí hřebeny:
  - chránič a za ním souvislá řada jeho jističů na stejné liště: 3f pod 4P chráničem (L1 / L2 / L3 / N), 1f pod 2P;
  - řada jističochráničů se společným napájením: hřeben na vstupu.
- Plátno (`VectorPanel`) kreslí:
  - měděnou přípojnici s vidličkami do svorek a popiskem „Hřeben 3f · L1 L2 L3 N“;
  - na každém jističi odznak fáze v barvě vodiče podle ČSN 33 0165 (L1 hnědá, L2 černá, L3 šedá, 3P = L1+L2+L3).
- Fáze jističe:
  - přednost má přiřazení z generátoru (`phaseAssignment`, fáze 75);
  - jinak pozice na 3f hřebenu (L1, L2, L3, L1 …).
- Tlačítko „⫼ Hřeben: Auto / 3f / 1f / Vyp“ je u přípojnice (ne v záhlaví lišty – u dvou polí by se nevešlo). Volba se
  ukládá do uspořádání lišt (`railLayoutJson.combs`) a přesouvá se s lištou.
- HDO (`src/lib/panel-builder/hdo.ts`):
  - **Výchozí řízení:** bojler, tepelné čerpadlo a nové „Akumulační vytápění (3f, HDO)“ ano, wallbox jen zaškrtnutím
    „⚡ Řízení HDO“ v detailu prvku.
  - **Stykač:** generátor přidá za jistič okruhu stykač ABB ESB (-KM…) a jeden ovládací jistič B6 „Ovládání HDO – cívky
    stykačů“.
  - **Strom zapojení:** jistič → stykač.
  - **Drátovací list:** jistič B6 → kontakt přijímače HDO v elektroměrovém rozváděči → cívka A1, A2 → sběrnice N.
  - **Odkaz na jistič:** stykač si ho drží id prvku (`hdoControl: item:<id>`), protože se značení po uložení
    přečísluje.
- **Odchylka – typ stykače:**
  - 1f bojler dostane dvoupólový ESB20-20N-06 (1M, 1SBE121111R0620). Čtyřpólový ESB25-40N ze zadání by u 1f zabral
    2M bez užitku.
  - 3f / do 25 A ESB25-40N-06 (1SAE231111R0640).
  - Obě objednací čísla jsou z katalogu ABB pro ČR.
  - ESB40 / ESB63 nad 25 A jsou jen z orientačního katalogu, bez ověřeného čísla.
- Krycí záslepky:
  - volné moduly všech lišt → dělitelné záslepky 12M v kusovníku (List 4) a souhrn „🔲 Celkem N volných modulů“ u
    plátna;
  - objednací číslo jen z katalogu výrobce skříně.
- **Odchylka – záslepky:** v databázi není ověřená záslepka žádného výrobce. Externí klíče jako „HAGER:S35S“ nejsou
  objednací čísla a ABB ZA12P / 1SPE007715F9701 ani OEZ ZAS-12 ze zadání nejsou v oficiálních datech. Kusovník proto
  uvádí „záslepka 12M – dle katalogu výrobce skříně“.

**2. 2D půdorys – vazby vypínačů, razítko, legenda**

- Volba v horní liště plátna `[ 📐 Vazby vypínačů: Pravoúhlé CAD | Přímé | Skrýt ]`:
  - pravoúhlá vazba (`switch-links.ts`) je L se zaobleným rohem podél delší osy, téměř rovná vazba je úsečka;
  - volbu si pamatuje prohlížeč a platí i pro tisk.
- Tiskový list PDF:
  - **Rohové razítko podle ČSN EN ISO 7200:**
    - Projektant / Montážní firma z firemního razítka (název, IČO, adresa, odpovědná osoba, ev. č. oprávnění);
    - Investor / Objekt, Akce, Název výkresu „2D Půdorys elektroinstalace – podlaží“;
    - Stupeň DPS / DSPS, Měřítko a formát, Datum, Číslo verze (v1.0 – volba v dialogu exportu) a číslo výkresu;
    - QR kód projektu ELDOCK.
  - **Vysvětlivky:**
    - značky výkresu;
    - druhy okruhů s barvou a druhem čáry;
    - typy kabelů s počtem okruhů a metry.
  - **Barevné druhy okruhů** lze vypnout (pak černobíle podle ČSN).

**3. Import ze staré revize a z měřicích přístrojů**

- `RevisionDataImporterModal.tsx` je v AI Panel Builderu (přehled projektů), v Revizích (`/inspections`, v zadání
  „/revize“) a v Hlídači revizí (místnost).
- Vstupy:
  - **A)** CSV / TSV / XLSX / XML – Metrel ES Manager, Sonel, Fluke DMS, Chauvin Arnoux, Illko / PC Revize; hlavičky
    CZ / EN / PL / FR.
  - **B)** PDF (text v prohlížeči přes pdf.js), Word DOCX (tabulky), fotka tabulky přes Gemini.
  - **C)** Šablona CSV a XLSX.
- Sloupce se rozpoznají samy a jdou přiřadit ručně. Hodnoty se převedou na MΩ / Ω / ms („> 299,9 MΩ“, „810 mΩ“,
  „0,021 s“, „OL“).
- Okruhy → rozváděč stejnou cestou jako soupis místností:
  - jističe a jističochrániče z protokolu;
  - chrániče navrhne generátor podle ČSN 33 2130 ed. 4;
  - zkušební projekt nebo 15 kreditů.
- Spotřebiče → místnost patra: S/N, druh podle názvu, lhůta, převzatá revize s Riso, RPE, přístrojem a výsledkem.
- **Odchylky:**
  - fotka tabulky jen s `GEMINI_API_KEY`;
  - starý formát .doc (Word 97) se nečte;
  - naskenované PDF bez textové vrstvy se přepíše jen jako fotka.

**4. Sekvenční sběr Scan & Snap a offline fronta**

- „⚡ Rychlý sekvenční sběr v místnosti“ v Hlídači revizí (místnost) a v rychlé revizi (`/rychla-revize`):
  1. QR štítek EL-xxxxxx (kamera přes BarcodeDetector, ruční kód, nebo „další v pořadí“ z registru);
  2. fotka výrobního štítku (AI přečte název, výrobce, model, S/N a třídu);
  3. „✅ VYHOVUJE – Riso > 200 MΩ, RPE < 0,3 Ω“ / „❌ NEVYHOVUJE“ (volitelně naměřené hodnoty).
- Po výsledku se záznam hned odešle a fotoaparát se sám otevře pro další kus.
- `src/lib/offline-sync-queue.ts`:
  - záznamy v `localStorage`, fotky v IndexedDB, odesílání v pořadí;
  - chyba sítě = zkusit znovu, trvalé odmítnutí serverem = zahodit;
  - automatické odeslání po `online` a každých 30 s;
  - indikátor „📡 Offline režim – X záznamů čeká na odeslání“ na všech stránkách Správy závodů.
- Server `/api/hlidac/snap` – jeden cyklus = zařízení v místnosti, QR štítek, fotka štítku s AI a rychlá revize,
  idempotentně podle id klienta.
- **Odchylky:**
  - čtení QR kamerou jen v prohlížečích s BarcodeDetector (Chrome / Android). Jinde ruční kód nebo další štítek
    v pořadí – po výsledku se otevře fotoaparát na výrobní štítek.
  - fronta je v prohlížeči jednoho zařízení (po odhlášení se odešle po dalším přihlášení);
  - bez Gemini se štítek přečte jen z vloženého textu.

**5. Faktury s QR platbou a údaje provozovatele**

- Výzva k platbě (zálohová faktura) s QR platbou SPD 1.0 je pro balíčky kreditů, předplatné PRO a nově sady QR štítků:
  - odběratel z ARES (registrace firmy);
  - po úhradě série štítků v registru k odeslání poštou.
- Velín `/superadmin?tab=provozovatel`:
  - jméno / firma, adresa, e-mail, IČO (kontrola), DIČ, spisová značka, plátcovství DPH, IBAN (kontrola), BIC, banka;
  - sady QR štítků.
- Kam se údaje propíšou:
  - patička „ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz“ (+ IČO / DIČ / spisová značka, až jsou
    vyplněné);
  - faktury a účet pro QR platby (IBAN z velínu má přednost před `ELDOCK_BANK_IBAN`);
  - VOP 1.3 – nový oddíl „Provozovatel“;
  - zásady 1.8 – správce.
- Neplátce DPH = cena bez DPH je konečná (faktura „Není plátce DPH“).
- **Odchylky:**
  - ceny sad QR štítků zadání neuvádí – nastavují se ve velínu (bez sad je objednávka vypnutá);
  - plátcovství DPH zůstává výchozí ano (dosavadní ceny s DPH);
  - modal VOP u registrace ukazuje výchozí údaje provozovatele (aktuální znění s IČO z velínu je na
    `/obchodni-podminky`).

**6. Testy**

- `src/lib/phase112.test.ts` (19):
  - stykač HDO z půdorysu (bojler, TČ, wallbox na přání) a drátovací list cívky;
  - záslepky a hřebeny s fázemi;
  - pravoúhlé vazby, razítko a legenda;
  - import CSV / XML / textu: Riso, Zs, RPE, tA, S/N, výsledek, datum, jištění;
  - offline fronta (výpadek → fronta → odeslání, zahození, `online`);
  - SPD a provozovatel.
- `src/server/services/phase112.test.ts` (5):
  - stykač v uloženém projektu;
  - rozváděč z revize;
  - import spotřebičů s revizí;
  - Scan & Snap s idempotencí a štítkem;
  - velín, neplátce DPH a objednávka sady štítků.
- E2E `e2e/phase112.spec.ts` (5):
  - hřebeny, fáze, stykač a záslepky;
  - vazby vypínačů a PDF razítko;
  - import do Panel Builderu;
  - Hlídač s importem a Scan & Snap offline;
  - velín, faktura štítků a patička.
