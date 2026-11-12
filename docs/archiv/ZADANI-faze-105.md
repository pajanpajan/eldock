# Zadání fáze 105 – balíčky ETIM data a ceníkové ceny, náhledy rozvodnic, kabely osvětlení se svody a řazením, Pseudo-3D náhled, cenová nabídka s normohodinami a export do velkoobchodů

Vloženo z chatu 2026-11-12 (během fáze 104). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Máme 5 klíčových úkolů, které posunou ELDOCK o úroveň výš:
1) Zpracovat nové ETIM balíčky ze složky `C:\Users\janou\Desktop\Digitry\ETIM data` (doplnit z nich fotky přístrojů, rozvodnic, ceníkové ceny, EANy, MPN a technické parametry).
2) Opravit chybějící náhledové obrázky samotných rozvodnic v kroku `1b Skříň rozváděče` (`/panel-builder/[id]/enclosure`), kde je teď vidět jen žlutá mřížka modulů bez obrázku skříně.
3) Opravit a zpřesnit výpočet kabelů osvětlení v 2D půdorysu (započítat svislé svody ke spínačům a ze stropu + přesnou topologii řazení 1, 5, 6, 6+6, 7 u klasické instalace vs. hvězdicovou topologii u Smart Home) a přidat **Pseudo-3D náhled (Izometrické 3D + Pohled na stěny)** pro vizuální kontrolu a úpravu výšek zásuvek, vypínačů a světel.
4) Vytvořit modul **Cenová nabídka (pro 2D půdorys, rozváděč i kompletní zakázku)** postavený na ceníkových cenách a aktualizovaných normohodinách (s interním upozorněním před generováním, které se ale NEZOBRAZUJE v samotné nabídce pro zákazníka, a krátkým 3krokovým průvodcem).
5) Připravit **Export poptávky/objednávky do velkoobchodů** (Sonepar, Elkov Elektro, K&V Elektro, DEK, univerzální B2B CSV/XLSX/XML).

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: IMPORT NOVÝCH ETIM BALÍČKŮ ZE SLOŽKY `C:\Users\janou\Desktop\Digitry\ETIM data` + OPRAVA NÁHLEDŮ ROZVODNIC
================================================================================

1. NAČTENÍ VŠECH BALÍČKŮ Z `C:\Users\janou\Desktop\Digitry\ETIM data`:
   - Prohledej složku `C:\Users\janou\Desktop\Digitry\ETIM data` (ve WSL případně `/mnt/c/Users/janou/Desktop/Digitry/ETIM data`) a projdi všechny soubory uvnitř (`.zip`, `.xml` BMEcat/ETIM, `.csv`, `.xlsx`, složky s obrázky).
   - Aktualizuj a spusť importní skript (`scripts/import-etim-universal.mjs`), aby z těchto nových balíčků vytěžil:
     * Produktové fotografie (`.jpg`/`.png` -> převeď do `.webp` v `public/catalog-images/` a zapiš do `public/catalog-images/manifest.json`),
     * **Ceníkové ceny (`PRICE_AMOUNT` / doporučená cena v CZK/EUR)** – ulož je k položkám v katalogu (`listPriceCzk`) jako základ pro náš nový generátor cenových nabídek!
     * Přesná objednací čísla (`MPN` / `SUPPLIER_PID`), `EAN` (`GTIN`), ztrátové výkony $P_v$ [W], vestavné hloubky v mm a rozměry skříní V×Š×H.

2. OPRAVA NÁHLEDOVÝCH OBRÁZKŮ ROZVODNIC V KROKU `1b Skříň rozváděče` (`/panel-builder/[id]/enclosure`):
   - PROBLÉM: V kroku výběru skříně rozváděče (`Vybraná skříň` nahoře i seznam karet skříní dole – např. `ABB Mistral41W 120M 5×24`, `ABB CA25`, `ABB CA25B`, `ABB CA25V`, `ABB CU25V`, Eaton `KLV`, Hager `Volta`/`Vector`, OEZ `RZA`/`RZG`/`RN`) je na kartě vidět jen žlutá mřížka DIN modulů, ale chybí obrázek samotné rozvodnice!
   - OPRAVA:
     * Ke každé kartě rozvodnice (jak v horním boxu `Vybraná skříň`, tak u každé karty v mřížce skříní i v Kroku 4) přidej **skutečný vizuální náhled skříně rozváděče**!
     * Pokud má daná rozvodnice reálnou fotku v `public/catalog-images/` (staženou z ETIM dat), zobraz tuto reálnou studiovou fotku skříně na čistém světlém podkladu.
     * Pokud pro konkrétní typ fotka v souborech není, vykresli **detailní, realistický vektorový render konkrétní řady rozvodnice** (rozlišující vzhled podle řady a materiálu: např. *ABB Mistral41/65* jako bílá plastová skříň s průhlednými kouřovými/zelenými dvířky a DIN lištami uvnitř; *ABB ComfortLine CA/CU* a *OEZ RZA/RN* jako šedobílá oceloplechová skříň s plnými/prosklenými dveřmi a kličkou; *Eaton KLV / Hager Volta* jako zapuštěná rozvodnice s kovovým rámem), a stávající žlutý indikátor obsazenosti modulů (`5 × 24 M`, rezerva %) zobraz čistě vedle obrázku skříně!

================================================================================
ČÁST 2: OPRAVA VÝPOČTU KABELŮ OSVĚTLENÍ V 2D PŮDORYSU (SVISLÉ SVODY + ŘAZENÍ 1, 5, 6, 7)
================================================================================

Zkontroluj a oprav výpočet tras a délek světelných kabelů v `/panel-builder/floorplan` (`floorplan-routing.ts` / výkaz kabeláže):

1. PŘESNÉ ZAPOČÍTÁNÍ SVISLÝCH SVODŮ ($\Delta Z$) KE SPÍNAČŮM A SVÍTIDLŮM:
   - Světelné kabely jsou vedeny v podhledu/stropu ve výšce $H_{\text{strop}}$ (výchozí `2600 mm`, nastavitelná u místnosti/podlaží), zatímco vypínače jsou ve výšce `h` (typicky `1200 mm`) a nástěnná svítidla např. ve `2000 mm`.
   - U každého spínače zapojeného do světelného okruhu započítej skutečný svislý svod ze stropu do krabičky spínače $(H_{\text{strop}} - H_{\text{vyp}})$ + technologickou rezervu na zapojení v krabičce (`0,30 m`)!

2. PŘESNÁ TOPOLOGIE PODLE ZVOLENÉ ÚROVNĚ INSTALACE A ŘAZENÍ VYPÍNAČŮ:
   - **A) Klasická instalace 230 V (`level = 'classic'`):**
     * **Přívod okruhu:** Z rozváděče `RH` (výstup do stropu + obvodová trasa po stěnách) vede přívodní kabel **`CYKY-J 3×1,5`** do krabičky prvního vypínače daného světelného okruhu (a pokud je na jednom 10A světelném jističi více místností/vypínačů, smyčkuje se přívod `CYKY-J 3×1,5` mezi krabičkami hlavních vypínačů).
     * **Řazení 1 (jednopólový spínač):** Z krabičky vypínače stoupá `CYKY-J 3×1,5` ke stropu a vede k prvnímu ovládanému svítidlu; pokud vypínač ovládá skupinu více svítidel (např. 4 bodovky v obýváku), spočítej obvodové/stropní smyčkování `CYKY-J 3×1,5` mezi všemi svítidly ve skupině (`Vypínač -> Světlo 1 -> Světlo 2 -> Světlo 3...`)!
     * **Řazení 5 (sériový / lustrový spínač):** Z krabičky vypínače ke svítidlu (nebo 2 skupinám svítidel) počítej kabel **`CYKY-J 5×1,5`** (příp. 2 větve `CYKY-J 3×1,5`).
     * **Řazení 6 (schodišťové přepínače – 2 vypínače ovládající společné světlo):** Spočítej přívod `CYKY-J 3×1,5` do přepínače č. 6 (A), mezi přepínačem č. 6 (A) a přepínačem č. 6 (B) spočítej korespondenční propojovací kabel **`CYKY-O 3×1,5` (nebo `CYKY-J 5×1,5`)** včetně obou svislých svodů $(2 \times (H_{\text{strop}} - H_{\text{vyp}}))$, a z přepínače č. 6 (B) spočítej vývod **`CYKY-J 3×1,5`** ke svítidlům!
     * **Řazení 7 (křížové přepínače – 3 a více míst ovládání):** Mezi prvním přepínačem č. 6, všemi křížovými přepínači č. 7 a koncovým přepínačem č. 6 spočítej propoj kabelem **`CYKY-J 5×1,5`** (včetně svislého svodu u každého vypínače)!
   - **B) Sběrnicová Smart Home instalace (`level = 'smart'` – Loxone / KNX / free@home / TapHome):**
     * Každá spínaná nebo stmívaná světelná větev vede hvězdicově přímo z rozváděče `RH` ke svítidlům kabelem **`CYKY-J 3×1,5`** (nebo **`CYKY-J 5×1,5`** u DALI / RGBW / dvojitého svítidla), a pokud je ve skupině více svítidel, smyčkuje se mezi nimi.
     * Sběrnicová tlačítka a čidla na stěnách jsou propojena v jedné linii sběrnicovým kabelem **`CAT7 / KNX J-Y(St)Y 2×2×0,8`** včetně svislých svodů.
   - Ve `Výkazu kabeláže a okruhů` zobraz u každého světelného okruhu průhledný rozpad délky: `Vodorovně po stěnách/stropu X m + Svislé svody k vypínačům a rozváděči Y m + Rezerva Z m = Celkem W m`, aby si projektant mohl každý metr okamžitě zkontrolovat!

================================================================================
ČÁST 3: PSEUDO-3D NÁHLED MÍSTNOSTÍ A STĚN PRO KONTROLU VÝŠEK ZÁSUVEK A VYPÍNAČŮ
================================================================================

Přidej do horní lišty plátna v `/panel-builder/floorplan` výrazné tlačítko **`[ 🧊 3D Náhled & Kontrola výšek ]`**, které otevře interaktivní **Pseudo-3D / Izometrický a stěnový prohlížeč (`FloorplanPseudo3DModal.tsx` nebo přepínatelný 3D režim plátna)**:

1. **Režim A – Izometrický 3D pohled na celý půdorys (s otáčením o 90°/360° a náklonem):**
   - Vykresli stěny všech místností vytažené do 3D výšky stropu (výchozí `2600 mm`, poloprůhledné stěny s čitelnými hranami), v nich ve skutečné výšce vykresli **okna** (parapet `900 mm`, výška `1400 mm`), **dveře** (`2000 mm`), **nábytek** (postel, kuchyňskou linku `900 mm`, stůl `750 mm`, vanu, umyvadlo).
   - Na stěnách a stropě vykresli ve **skutečné výškové kótě $Z$ [mm] od podlahy** všechny osazené prvky:
     * Zásuvky u podlahy (`300 mm` – modré/zelené značky se svislým svodem od podlahy),
     * Zásuvky nad kuchyňskou linkou a v koupelně (`1150 mm` – jasně viditelné nad horní hranou linky `900 mm`!),
     * Vypínače a tlačítka u dveří (`1200 mm` – se svislým svodem ze stropu),
     * Termostaty, Smart Home displeje a hlavní rozváděč `RH` (`1500 mm`),
     * Nástěnná a nouzová svítidla (`2000–2200 mm`) a stropní svítidla (`2600 mm`).
   - Automaticky zvýrazni červeným varováním případné výškové kolize (např. pokud je obyčejná zásuvka ve výšce `300 mm` schovaná za kuchyňskou linkou místo ve `1150 mm`, a nabídni tlačítko `[ Zvýšit zásuvky u linky na 1150 mm ]`!).

2. **Režim B – Pohled na vybranou stěnu místnosti (Rozvinutý pohled S / J / V / Z s pravítkem výšek):**
   - Uživatel klikne na místnost (např. *Kuchyň* nebo *Koupelna*) a přepíná stěny (`Severní`, `Východní`, `Jižní`, `Západní`).
   - Vidí čelní pohled na stěnu s výškovým pravítkem `0 mm` až `2600 mm`, vodorovnými hladinami (`300 mm`, `900 mm linka`, `1150 mm`, `1200 mm`, `1500 mm`) a může přímo v tomto pohledu kliknout na zásuvku nebo vypínač a **změnit jeho výšku v mm** (nebo ho posunout myší nahoru/dolů)!

================================================================================
ČÁST 4: GENERÁTOR CENOVÉ NABÍDKY (PŮDORYS + ROZVÁDĚČ) S NORMOHODINAMI A CENÍKOVÝMI CENAMI
================================================================================

Vytvoř kompletní modul **Cenová nabídka (`src/lib/quoting/quote-engine.ts` + `QuoteWizardModal.tsx`)**, dostupný jak z **2D Půdorysu (Fáze 5)**, tak z **AI Panel Builderu (Krok 4)** tlačítkem **`[ 💰 Vytvořit cenovou nabídku ]`**:

1. INTERNÍ UPOZORNĚNÍ PŘED VYGENEROVÁNÍM (POUZE V APLIKACI, NIKDY V NABÍDCE PRO ZÁKAZNÍKA!):
   - Na úvod průvodce zobraz žlutý informační banner určený výhradně pro elektrikáře/projektanta:
     * **`ℹ️ Informace ke kalkulaci (interní – nezobrazuje se v nabídce pro zákazníka):`**
     * *"Výpočet materiálu vychází z oficiálních ceníkových cen výrobců (bez započtení vašeho individuálního velkoobchodního rabatu). Výpočet montážních prací vychází z průběžně aktualizovaných normohodin (NH) pro jednotlivé úkony. V samotné vygenerované cenové nabídce pro koncového zákazníka není zmínka o ceníkových cenách ani o normohodinách nikde uvedena."*
   - **PŘÍSNÉ PRAVIDLO PRO PDF / TISK / EXPORT CENOVÉ NABÍDKY:** Ve vygenerované cenové nabídce pro zákazníka se NESMÍ objevit slova *"ceníková cena"*, *"normohodina"*, *"NH"*, *"rabat"* ani to interní upozornění! Zákazník v nabídce vidí pouze čisté položky (*Dodávka elektroinstalačního materiálu*, *Elektromontážní a instalační práce*, *Kompletace a zapojení rozváděče*, *Zkoušky, měření a výchozí revize*), množství (`ks` / `m` / `kpl`), jednotkovou cenu v Kč a cenu celkem!

2. KRÁTKÝ, NEOTRAVNÝ MINI-PRŮVODCE UPŘESNĚNÍM NABÍDKY (NA 1 OBRAZOVCE):
   Umožni uživateli před vygenerováním nabídky během 10 vteřin doladit 4 praktické parametry:
   - **1. Rozsah nabídky:**
     * `[ 🏠 Kompletní zakázka (2D elektroinstalace + Rozváděč + Revize) ]`
     * `[ 📐 Pouze rozvody a přístroje z 2D půdorysu ]`
     * `[ ⚡ Pouze výroba a osazení rozváděče ]`
   - **2. Hodinová sazba a typ stavby (pro výpočet práce z normohodin):**
     * Vaše hodinová sazba: např. `650 Kč / hod` (výchozí, uloží se do profilu uživatele),
     * Konstrukce budovy (koeficient náročnosti drážkování a montáže):
       - `Porobeton (Ytong) / dutá cihla (koef. 1,00×)`
       - `Sádrokarton (SDK) / dřevostavba (koef. 0,75×)`
       - `Plná cihla / smíšené zdivo (koef. 1,15×)`
       - `Železobeton / panel (koef. 1,35×)`
   - **3. Obchodní úprava cen materiálu a DPH:**
     * Úprava ceníkových cen materiálu pro zákazníka: rychlá tlačítka `[ Ceníková cena (0 %) ]`, `[ Sleva -5 % ]`, `[ Sleva -10 % ]`, `[ Sleva -15 % ]` nebo vlastní `%`.
     * Sazba DPH: **`[ 12 % DPH – Bytová výstavba / RD a byty dle § 48 zák. o DPH ]`** vs. **`[ 21 % DPH – Komerční a průmyslové objekty ]`**.
   - **4. Zákazník a platnost:**
     * Jméno / Firma odběratele (s načtením z ARESu podle IČO), číslo nabídky, platnost (14 dní) a možnost přepnout zobrazení: `[ Položkový rozpočet ]` vs. `[ Souhrnná nabídka po kapitolách ]`.

3. SYSTÉM NORMOHODIN (NH) S PRAVIDELNOU AKTUALIZACÍ A KALIBRACÍ DLE PRAXE (`src/lib/quoting/normohodiny-catalog.ts`):
   Vytvoř realistickou, podrobnou matici normohodin elektromontážních prací a výroby rozváděčů (verze `NH-2026.11` s automatickou kontrolou aktualizací a možností uživatelské kalibrace):
   - **Elektroinstalace v půdorysu:**
     * Vysekání drážky, uložení kabelu a zasádrování ve zdivu: `0,12 NH / m` (pro kabely do 3×2,5) a `0,16 NH / m` (pro silové kabely 5×2,5 až 5×10),
     * Uložení kabelu v SDK / podhledu / žlabu: `0,06 NH / m`,
     * Vyvrtání otvoru a osazení instalační krabičky KOPOS do zdiva: `0,35 NH / ks` (hluboká `KPR 68`: `0,40 NH / ks`, do SDK `KPR 68/L`: `0,18 NH / ks`),
     * Zapojení a kompletace zásuvky / vypínače / ovladače (strojek + kryt + rámeček): `0,25 NH / ks` (datová RJ45 Cat6A / sběrnicový prvek: `0,35 NH / ks`),
     * Montáž a zapojení svítidla: `0,45 NH / ks` (LED pásek s profilem a zdrojem: `0,80 NH / ks`),
     * Připojení samostatného spotřebiče (varná deska, bojler, TČ, Wallbox): `0,75 NH / ks`.
   - **Výroba a osazení rozváděče (AI Panel Builder):**
     * Osazení a zazdění/upevnění skříně rozváděče: `1,50 NH` (do 36M), `2,50 NH` (48–120M), `4,00 NH` (nad 120M),
     * Montáž a prodrátování 1p jističe / modulu na DIN lištu: `0,25 NH / ks`,
     * Montáž a prodrátování 3p jističe / proudového chrániče RCD / jističochrániče RCBO / SPD přepěťovky: `0,45 NH / ks`,
     * Montáž a oživení Smart Home aktoru / PLC modulu (`SA-M`, `JA-M`, `Miniserver`, `SysAP`): `0,65 NH / ks`,
     * Zapojení PE/N sběrnic, popisování okruhů, kusová zkouška dle ČSN EN IEC 61439 a kompletace dokumentace: `2,00 NH / rozváděč`.
   - **Zkoušky a výchozí revize:**
     * Měření a výchozí revize jednoho okruhu (Riso, Zs, RCD): `0,35 NH / okruh` + `1,50 NH` vypracování revizní zprávy.
   - **Průběžná aktualizace a zpětná vazba:** Přidej v okně normohodin tlačítko **`[ ⚙️ Upravit normohodiny / Kalibrovat podle mé rychlosti ]`**, kde si montér může buď upravit libovolný úkon, nebo po dokončení zakázky zadat *„Skutečně odpracováno X hodin“* a systém automaticky přepočítá a zkalibruje jeho firemní koeficient normohodin!

================================================================================
ČÁST 5: PŘÍPRAVA PRO EXPORT DO OBLÍBENÉHO VELKOOBCHODU (SONEPAR, ELKOV, K&V ELEKTRO, DEK)
================================================================================

Do okna **Kusovníku (BOM)** i do okna **Cenové nabídky** (jak v 2D půdorysu, tak v AI Panel Builderu) přidej sekci **`🛒 Exportovat poptávku / košík do velkoobchodu`**:
1. Umožni uživateli vybrat si svůj oblíbený elektro-velkoobchod (volba se uloží do profilu):
   - **`Sonepar ČR`** (`sonepar.cz` – B2B import košíku: `Objednací číslo / EAN; Množství; Jednotka; Poznámka`),
   - **`ELKOV elektro`** (`elkov.cz` – rychlý import podle EAN / Katalogového čísla),
   - **`K&V ELEKTRO`** (`kvelektro.cz` – B2B CSV/XLSX import košíku),
   - **`DEK / Stavebniny DEK Elektro`** (`dek.cz` – poptávkový list s EAN a MPN),
   - **`Univerzální B2B poptávka (XLSX / CSV / XML + e-mail obchodnímu zástupci)`**.
2. Nabídni u vybraného velkoobchodu 3 okamžité akce:
   - **`[ 📥 Stáhnout soubor pro import do košíku velkoobchodu (.csv / .xlsx) ]`** (přesně naformátovaný podle sloupce EAN/MPN a množství daného velkoobchodu),
   - **`[ 📋 Zkopírovat rychlý B2B seznam (EAN + Množství) do schránky ]`** (pro vložení přes `Ctrl+V` do pole *Rychlá objednávka* v e-shopu velkoobchodu!),
   - **`[ ✉️ Vygenerovat průvodní e-mail s poptávkou pro obchodního zástupce ]`**.

================================================================================
ČÁST 6: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Spusť import nových ETIM dat z `C:\Users\janou\Desktop\Digitry\ETIM data` a ověř, že se fotky a ceníkové ceny propíšou do katalogu.
2. Napiš unit testy ověřující:
   - Že výpočet kabelů osvětlení v 2D půdorysu správně započítává svislé svody ke spínačům $(H_{\text{strop}} - H_{\text{vyp}})$ a rozlišuje řazení 1, 5, 6 a 7 i Smart Home režim.
   - Že v generátoru cenové nabídky se spočítá cena materiálu z ceníkových cen a cena práce z normohodin, ale ve vygenerovaném výstupu pro zákazníka NENÍ zmíněno interní upozornění o ceníkových cenách a normohodinách.
   - Že export do velkoobchodů (`Sonepar`, `Elkov`, `K&V Elektro`, `DEK`) vygeneruje platný importní soubor s MPN/EAN a množstvím.
   - Že v kroku `1b Skříň rozváděče` má každá rozvodnice vykreslený vizuální náhled skříně (fotku nebo studiový render skříně).
3. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**1. Balíčky ze složky „ETIM data“ (`scripts/import-etim-universal.mjs`, `npm run catalog:universal`):**

- Balíčky se rozpoznají podle obsahu (hlavička BMEcat, katalog Schrack, kreslicí data).
- OEZ BMEcat ETIM 8.0 (`ETIM_8_CZ.zip`, 8 645 výrobků, 3 445 fotek JPG přímo v ZIPu):
  - spárováno 37 kusů katalogu AI Panel Builderu (EAN, rozměry, vestavná hloubka);
  - 36 nových fotek DIN přístrojů → `public/catalog-images/oez/devices/`, `manifest.json`, `device-photos.generated.ts`;
  - ceníková cena v balíčku je u všech výrobků 0 Kč a ztrátový výkon Pv (EF005387) chybí – nic se nedoplňuje.
- Ceníkový katalog Schrack (`999999_….zip`, `productcatalog.xml`, 37 082 výrobků):
  - ceníkové ceny 25 instalačních kabelů a vodičů za metr (ListPrice / PriceUnit);
  - zákaznická cena (DiscountPrice zákazníka 999999) se záměrně nepoužívá.
- Hager BMEcat ETIM 10: 37 kusů katalogu (EAN, hloubka, Pv); ceny ani fotky v balíčku nejsou.
- Excel Hager (balení a logistika) a ABB 2D / 3D kreslicí data (DXF / PDF / STEP / IGES) se přeskočí.
- Výstupy:
  - `src/lib/quoting/list-prices.generated.ts` (`server-only`, ceníky do prohlížeče nesmí);
  - `src/lib/panel-builder/etim-universal.generated.ts` – data pro seed ke kusům katalogu. Bez `server-only`, protože
    seed běží v tsx bez podmínky react-server; test hlídá, že ho klientský modul neimportuje.
- Migrace `phase105_quotes_list_prices`:
  - `CatalogComponent.listPriceCzk` a `listPriceSource` (seed `applyEtimComponents`);
  - `RegisteredCompany.quoteSettingsJson`.
- **Odchylka:** ceníkové ceny DIN přístrojů ABB / Hager / OEZ / Eaton ani domovních přístrojů v dodaných datech nejsou.
  Nabídka je ukáže elektrikáři jako „bez ceníkové ceny“ a cenu doplní on, nic se nevymýšlí. Krabice KOPOS mají cenu
  z ceníku výrobce (fáze 97).

**2. Náhled skříně v kroku 1b (`EnclosureVisual.tsx`):**

- U „Vybrané skříně“ i u každé karty je fotka výrobce (index fotek ze serveru) nebo vektorový render podle řady,
  materiálu a montáže. Žlutá mřížka obsazenosti modulů je vedle náhledu.
- Vzhled renderu:
  - plastová skříň s kouřovými nebo zelenými průhlednými dvířky a DIN lištami (ABB Mistral);
  - oceloplechová skříň s plnými / prosklenými dveřmi a kličkou (ABB ComfortLine CA, OEZ RN);
  - zapuštěná rozvodnice s kovovým rámem (ABB CU, Eaton KLV, Hager Volta / Vector, OEZ RZA / RZG).
- Krok 4 má kresbu čela s lištami a fotku už od fází 85 / 94.

**3. Kabely osvětlení (`src/engine/lighting-topology.ts`, `summarizeCabling` s `switchNos`):**

- Klasika a retrofit: přívod okruhu z RH do krabice prvního vypínače každé skupiny světel. Za první se bere vypínač
  nejblíž rozváděči; mezi krabicemi se přívod smyčkuje.
- Kabely podle řazení:
  - řazení 1 → CYKY-J 3×1,5 ke světlům se smyčkou mezi svítidly;
  - 5 → CYKY-J 5×1,5;
  - 6 → korespondence CYKY-O 3×1,5 se dvěma svislými svody, z druhého přepínače CYKY-J 3×1,5;
  - 7 → řetěz 6 – 7 – … – 6 kabelem CYKY-J 5×1,5;
  - 6+6 → CYKY-O 5×1,5 a CYKY-J 5×1,5.
- Ke každému konci kabelu v krabici vypínače svislý svod (strop − výška vypínače) a rezerva 0,30 m. U retrofitu
  CYKY-J místo CYKY-O.
- Sběrnice (Loxone / KNX / free@home / TapHome): jedna hvězdicová větev z RH na skupinu světel se stejným ovládáním
  (CYKY-J 3×1,5, u DALI a RGB / RGBW 5×1,5). Smyčka mezi svítidly. Světlo bez ovládání má vlastní větev; sběrnicová
  linka beze změny.
- Výkaz kabeláže u světelného okruhu ukazuje rozpad „Vodorovně po stěnách / stropu X m + svislé svody k vypínačům
  a rozváděči Y m + rezerva Z m = celkem W m“; v titulku jsou úseky podle kabelů.
- **Odchylka:** výška stropu se nastavuje ve výškovém profilu nákresu (pole Strop), ne zvlášť u každé místnosti.

**4. Pseudo-3D náhled (`FloorplanPseudo3DModal.tsx`, `src/lib/panel-builder/pseudo3d.ts`):**

- Tlačítko „🧊 3D Náhled & Kontrola výšek“ v horní liště plátna.
- Izometrie:
  - otáčení po 90° a po 15°, náklon;
  - poloprůhledné stěny do výšky stropu;
  - okna (parapet 900 mm, výška 1400 mm) a dveře (2000 mm);
  - nábytek ve výšce: linka 900, stůl 750, postel 500, skříň 2000 mm;
  - prvky ve skutečné výšce Z se svislým svodem (zásuvky od podlahy, ostatní ze stropu).
- Výškové kolize:
  - zásuvka / vypínač pod 1000 mm v půdorysu linky či ostrůvku → „Zvýšit zásuvky u linky na 1150 mm“ jedním klikem;
  - prvek za vestavěnou skříní;
  - prvek v okenním / dveřním otvoru.
- Pohled na stěnu S / V / J / Z: pravítko 0 – strop, hladiny 300 / 900 / 1150 / 1200 / 1500 mm. Výška prvku se mění
  číslem, rychlými hodnotami nebo tažením.

**5. Cenová nabídka (`src/lib/quoting/`, `QuoteWizardModal.tsx`):**

- Výpočet:
  - materiál = ceníková cena s obchodní úpravou (0 / −5 / −10 / −15 % nebo vlastní);
  - práce = normohodiny NH-2026.11 (hodnoty ze zadání) × hodinová sazba × koeficient konstrukce (SDK / dřevostavba
    = uložení v SDK a krabice do SDK) × firemní koeficient;
  - DPH 12 / 21 %; položkový rozpočet nebo souhrn po kapitolách.
- Kalibrace: úprava libovolného úkonu nebo „skutečně odpracováno X hodin“. Firemní koeficient je vážený průměr
  nejvýš 10 zakázek; verze matice se kontroluje.
- Průvodce:
  - žlutý interní banner, 4 bloky na jedné obrazovce, odběratel z ARESu;
  - číslo nabídky `NAB-RRRR-NNNN` se rezervuje při tisku / exportu, platnost 14 dní;
  - interní souhrn (hodiny, zdroje cen, položky bez ceny s doplněním).
- Výstup pro zákazníka:
  - tisk / PDF z nového okna (samostatné HTML jen z části pro zákazníka) a XLSX;
  - `assertCustomerSafe` odmítne nabídku se slovy „ceníková cena“, „normohodina“, „NH“ a „rabat“; nožové pojistky
    NH se v nabídce značí PN.
- Tlačítko „💰 Vytvořit cenovou nabídku“ je ve fázi 5 půdorysu (záložka Kusovník & Rozváděč) a v kroku 4 AI Panel
  Builderu. Krok 4 nabízí přístroje projektu a u rozváděče z 2D půdorysu i domovní instalaci.
- Nastavení (sazba, konstrukce, DPH, velkoobchod, kalibrace, číslování) se ukládá do profilu firmy.
- **Odchylka:** hodinová sazba se ukládá do profilu firmy (AI Panel Builder má firemní účty, ne osobní profily).

**6. Export do velkoobchodů (`wholesaler-export.ts`, `WholesalerExport.tsx`):**

- Sonepar ČR: „Objednací číslo / EAN; Množství; Jednotka; Poznámka“.
- ELKOV elektro: EAN / katalogové číslo a množství.
- K&V ELEKTRO: objednací číslo, EAN, název, množství, jednotka.
- DEK: poptávkový list s EAN, MPN a výrobcem.
- Univerzální B2B: XLSX / CSV / XML.
- Rychlý seznam „EAN + množství“ do schránky a průvodní e-mail (předmět a text, mailto i kopie textu).
- Je v okně kusovníku i v nabídce; volba velkoobchodu se uloží do profilu.
- **Odchylka:** přesné šablony importu velkoobchody nezveřejňují – sloupce podle zadání, ověřit s obchodním
  zástupcem.

**Testy:**

- `src/lib/phase105.test.ts` (20):
  - svody a řazení 1 / 5 / 6 / 7, sběrnicová hvězda, rozpad délky;
  - nabídka (NH, slevy, DPH, kapitoly, žádné interní pojmy);
  - velkoobchody, označení kabelů;
  - Pseudo-3D (kolize u linky, pohled na stěnu);
  - ceníky jen na serveru.
- `e2e/phase105.spec.ts` (3): 3D náhled a výška prvku, rozpad délky, nabídka a export do Sonepar, náhled každé skříně
  v kroku 1b a nabídka v kroku 4.
- Upravené testy: `phase51`, `phase57`, `commercial-medical-modes`, seed AI Panel Builderu.
