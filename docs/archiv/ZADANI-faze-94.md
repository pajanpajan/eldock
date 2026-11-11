# Zadání fáze 94 – import oficiálních dat ABB ETIM 9.0 (fotky řad, rámečky, hloubky přístrojů, DIN přístroje a rozvodnice)

Vloženo z chatu 2026-11-11 (během fáze 93). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Máme k dispozici oficiální datový balíček výrobce ABB ve formátu ETIM 9.0: `ELSB_ETIM-9.0_2026-05.zip` (hledej ho v kořeni projektu, ve složce `data/`, `docs/` nebo v `~/Downloads` / `C:\Users\*\Downloads`).

Tento ZIP archiv obsahuje kompletní strukturovaná data divize ABB Electrification Smart Buildings (BMEcat XML / CSV / XLSX + multimediální odkazy `MIME_INFO`).

Zapiš tuto úlohu jako novou fázi do `docs/PLAN.md` a kompletně ji realizuj v těchto 5 krocích:

1. PROZKOUMÁNÍ ARCHIVU `ELSB_ETIM-9.0_2026-05.zip` A OCHRANA GITU:
   - Přidej `**/ELSB_ETIM*.zip` a `data/etim/raw/**` do `.gitignore`, aby se samotný obří zdrojový ZIP nebo surové XML necommitovalo do gitu (do gitu půjdou až vyextrahované optimalizované `.webp` fotky v `public/catalog-images/` a strukturovaný JSON katalog!).
   - Rozbal a zanalyzuj strukturu `ELSB_ETIM-9.0_2026-05.zip`: zjisti přesné názvy souborů uvnitř (BMEcat `.xml`, `.csv`, `.xlsx`, případně přibalenou složku s obrázky) a strukturu tagů pro produkt (`SUPPLIER_PID` / `ARTICLE_ID` / `MPN`, `EAN`/`GTIN`, `DESCRIPTION_SHORT`, `DESCRIPTION_LONG`, `ARTICLE_FEATURES` / ETIM třídy `EC...` a vlastnosti `EF...`, a především blok `MIME_INFO` -> `MIME_SOURCE`, `MIME_TYPE`, `MIME_PURPOSE`).

2. PARSER ETIM 9.0 DAT A STAŽENÍ OFICIÁLNÍCH PRODUKTOVÝCH FOTEK (`scripts/import-abb-etim9.mjs`):
   Vytvoř proudový (streamovací) Node.js parser, který projde celý ETIM 9.0 soubor bez přetečení RAM a provede:
   - **A) Extrakci a stažení reálných produktových fotografií pro všechny designové řady ABB:**
     * Najdi v ETIM datech zástupce (Spínač 1R řazení 1/6, Zásuvka 1R, Krycí rámečky 1R–5R a všechny barevné varianty klapek a rámečků) pro každou z našich řad ABB:
       `Zoni`, `Tango`, `Levit`, `Levit M`, `Time`, `Time Arbo`, `Element`, `Swing`, `Swing L`, `Classic`, `Decento`, `future linear`, `solo`, `solo carat`, `Busch-axcent`, `Garant`, `Variant+`, `Praktik`.
     * Stejně tak najdi oficiální fotky pro panely a prvky **ABB-free@home®** (`IP Touch 7"/10"`, `SmartTouch 10"`, `OneTouch 7"`, `RoomTouch 4"`, `Trevion 2,4"`, `SysAP 3.0`, akční členy `SA-M`, `JA-M`, `DA-M`, `HA-M`), **ABB i-bus® KNX** a rozvodnice (**Mistral41, Mistral65, ComfortLine, Unifix**).
     * Z jejich `<MIME_INFO>` (kde `MIME_PURPOSE` je `normal`, `detail` nebo `thumbnail`, resp. `MIME_TYPE` je `image/jpeg` / `image/png`) vytáhni přesnou URL adresu (`MIME_SOURCE`) nebo lokální cestu v ZIPu, stáhni originální studiovou fotografii, převeď ji do čistého `.webp` (např. `400×400 px` se zachováním poměru stran) a ulož do:
       - `public/catalog-images/abb/<seriesId>/<slot-nebo-colorId>.webp`
       - `public/catalog-images/abb/smart-home/<mpn>.webp`
       - `public/catalog-images/abb/enclosures/<mpn>.webp`
     * Zapiš kompletní mapování stažených fotek do `public/catalog-images/manifest.json`.

3. AKTUALIZACE KATALOGU VYPÍNAČŮ, RÁMEČKŮ A HLOUBKY KRABIČEK PODLE EXAKTNÍCH ETIM 9.0 ATRIBUTŮ:
   Využij technické atributy z `ELSB_ETIM-9.0_2026-05.zip` ke zpřesnění naší databáze (`src/lib/panel-builder/residential-series-catalog.ts` a `mounting-boxes-catalog.ts`):
   - **Skutečné vícerámečky (`EC000050` Krycí rámeček):** Ověř z ETIM atributu *Počet jednotek* (`EF000137`), jaké vícerámečky (1R až 5R) se pro každou řadu a barvu skutečně vyrábějí, a ulož k nim přesná objednací čísla (`SUPPLIER_PID`), `EAN` a ceníkové/orientační údaje.
   - **Skutečná vestavná hloubka přístrojů (`EF000218` v mm):** Doplň ke strojkům vypínačů, stmívačů, USB zásuvek, termostatů a datových zásuvek jejich skutečnou vestavnou hloubku v milimetrech z ETIMu, aby hlídač krabiček KOPOS (`KU 68` 45 mm vs. `KPR 68` 66 mm) počítal s oficiálními hodnotami výrobce.
   - **Rozvodnice a DIN přístroje (`CatalogComponent`):** Z ETIM tříd rozvodnic (`EC000214`), jističů (`EC000042`), chráničů (`EC000003`), jističochráničů (`EC000905`) a svodičů přepětí aktualizuj přesné šířky v modulech, ztrátové výkony $P_v$ [W], `EAN` kódy, odkazy na datasheety a seznam skříní pro úvodní výběr rozvodnice v AI Panel Builderu!

4. NAPOJENÍ REÁLNÝCH ETIM FOTEK DO UI (`DesignSeriesModal.tsx`, `SeriesPreviewIllustration.tsx`, `SmartHomeDeviceCatalog.tsx` a Krok 4 Rozvodnice):
   - V modalu `Designové řady a barvy` zobrazuj primárně tyto skutečné fotky stažené z ETIM 9.0 (u Spínače 1R, Zásuvky 1R, dlaždic barev klapek i rámečků; a pro Vícerámeček 2R/3R buď fotku vícerámečku z ETIMu, nebo fotorealistické složení reálných fotek přístrojů v reálném rámečku).
   - Stejně tak zobraz reálné ETIM fotky na kartách dotykových panelů a akčních členů ABB-free@home / KNX a v náhledu zvolené rozvodnice v AI Panel Builderu.

5. VERIFIKACE A NASAZENÍ:
   - Spusť skript `node scripts/import-abb-etim9.mjs` a vypiš přehlednou statistiku: kolik produktů z `ELSB_ETIM-9.0_2026-05.zip` bylo zpracováno a kolik reálných fotek `.webp` bylo uloženo do `public/catalog-images/abb/`.
   - Spusť `npm run verify`, přidej unit test ověřující načtení `manifest.json` s reálnými fotkami, udělej git commit (včetně vygenerovaných `.webp` fotek v `public/catalog-images/`) a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

- **Archiv:** `ELSB_ETIM-9.0_2026-05.zip` obsahuje jeden XML (272 MB) ve formátu BMEcat ETIM 9.0 / EDXF 5.0 –
  15 126 výrobků, 247 tříd ETIM, 15 082 s fotkou (MD01). Média jsou v `UDX.EDXF.MIME_INFO` (ne v klasickém
  `MIME_INFO`), fotky v archivu nejsou – jen odkazy na `cdn.productimages.abb.com`; ceny data neobsahují
  (`PRODUCT_PRICE` 0), proto mají rámečky objednací číslo a EAN, ale ne cenu. Import čte ZIP proudově (ZIP / ZIP64,
  `inflateRaw`, v paměti vždy jen jeden produkt) asi za 3 s; archiv i `data/etim/raw/` jsou v `.gitignore`.
- **Fotky (526):** 287 dílů řad ABB (spínač = kryt / kompletní přístroj 1R, zásuvka 1R, rámeček 1R, víceramček = rámeček
  2R – v každé barvě), 35 výrobků chytré domácnosti a 204 rozvodnic (103 ověřených + 101 převzatých z ETIM); WebP 400 × 400 přes sharp (bílé pozadí, ořez
  okraje, celý výrobek bez ořezu), v `manifest.json` zdroj, URL fotky, datum, objednací číslo a GTIN. Chytrá domácnost
  je podle stávající pipeline katalogu v `abb/smart/<id výrobku>.webp` (ne `abb/smart-home/<mpn>.webp`), rozvodnice
  v `abb/enclosures/<objednací číslo>.webp`. Stahování nejvýš 4 souběžně s pauzou, při 403 / 429 se zastaví.
- **Řady bez čísla dílu v kusovníku** (Classic, Swing, Swing L, zásuvka Time, zásuvky Busch-Jaeger, Garant, Praktik,
  Variant+): fotka = reprezentativní výrobek řady z ETIM podle šablony objednacího čísla s kódem barvy (70 fotek,
  `PHOTO_FALLBACKS`, číslo je pod fotkou) – do kusovníku se nepíše. Swing L má přístroje Swing se středem jasně bílým,
  spínač a zásuvka jsou proto ve všech barvách stejné (barvu nese rámeček L); Garant je v ETIM jen šedý hliníkový IP55
  (fotka jen u šedé barvy); Time Arbo v datech ABB není a „Element“ není samostatná řada katalogu (patří k Time) –
  zůstává render.
- **Rámečky 1R–5R:** čísla z kusovníku (matice katalogu ABB 2026), ETIM potvrdil 314 z 339 a počet násobků EF000074
  sedí; data výrobce nevedou dvoubarevné rámečky Zoni 241–244 (20) a Swing 5R (5) – v galerii ⚠, v kusovníku „ověřit“.
- **EAN v kusovníku:** 499 z 544 objednacích čísel, která kusovník řad ABB počítá (všechny prvky palety ve všech
  barvách), je v ETIM → EAN v kusovníku, CSV / XLSX (sloupec „EAN (GTIN)“) a v listu 4 dokumentace; řádek je ověřený
  (i odvozený kryt, např. dělený kryt Tango 3558A-A652 B).
- **Vestavná hloubka:** zadání uvádí EF000218, ETIM má u strojků EF000218 i EF012278 (17 mm), u zásuvek jen EF012278
  (40 mm, Zoni 24,6 mm) → import bere EF012278, jinak EF000218; u přístroje z více dílů rozhoduje nejhlubší. 67 hodnot
  (spínače 1 / 6 / 7, žaluziový, tlačítko, zásuvky, dvojzásuvky, datová zásuvka Decento); stmívače, termostaty a USB
  zásuvky data u řad neuvádějí → zůstávají pravidla fáze 91 (hluboká krabice). Hlídač: přístroj hlubší než 40 mm
  (nejmenší hloubka mělké krabice) chce hlubokou, hlubší než 66 mm krabici 70 mm; u zvolené krabice ukáže volné místo
  za přístrojem (KU 68-45 a zásuvka Tango 40 mm → 5 mm, KPR 68 a strojek 17 mm → 49 mm na svorky); ručně zvolená
  krabice, do které se přístroj nevejde, je varování s hodnotou výrobce. Typy KU 68 / KPR 68 ze zadání sedí na KOPOS
  KU 68-45 (45 mm) a KPR 68 (66 mm).
- **DIN přístroje:** 307 z 433 objednacích čísel ABB v katalogu je v ETIM; seed zapíše EAN, technický list (jen kde
  kus žádný nemá), vestavnou hloubku EF000218 (jistič 69 mm) a ztrátový výkon EF005387 u 158 kusů – hodnota výrobce na
  celý přístroj (S201-C16 2,5 W, S203-C16 7,5 W) místo odhadu; šířku v modulech ETIM neuvádí (zůstává z katalogu).
- **Rozvodnice:** všech 103 ověřených rozvodnic ABB (Mistral41, Mistral65, ComfortLine) je v ETIM a údaje sedí (jen
  Mistral65H 1SLM006500A2211 hloubka 154 × 155 mm – ponechán katalog). Dalších 206 má úplné údaje (řady EF000266,
  moduly EF002950, rozměry, krytí, montáž, materiál), ale u multimediálních (Media) a kombinovaných variant (K, VP)
  počítá ETIM celou mřížku včetně polí pro média a svorky – popis výrobce uvádí méně modulů (CA25K 5 × 24 = 120, popis
  72 modulů). Seed proto do výběru skříně přidá jen 101 rozvodnic, jejichž počet modulů potvrzuje i popis výrobce
  (Mistral41W / 41F / 65 a ComfortLine Compact CA, `dataSource` katalog výrobce); 36 s jiným počtem a 69 bez počtu
  v popisu (ComfortLine Compact CU, Media) se nepřidávají.
