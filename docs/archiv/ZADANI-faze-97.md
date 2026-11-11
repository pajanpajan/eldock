# Zadání fáze 97 – vyhledání a stažení datových balíčků výrobců (ETIM / BMEcat / XLSX / feedy), reálné fotky a data do katalogů

Vloženo z chatu 2026-11-11 (po nasazení fáze 96). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Víme, že výrobci elektroinstalačního materiálu (ABB, KOPOS Kolín, OEZ, Schneider Electric, Legrand, Hager, Eaton, Schrack, Saltek) vystavují na svých webech veřejné datové balíčky pro e-shopy, velkoobchody a projektanty (ETIM 8/9, BMEcat XML, e-shopové XML/CSV feedy a XLSX ceníky s technickými daty a URL adresami produktových fotek).

Tvým úkolem je tyto balíčky a datové zdroje **sám aktivně dohledat na webu, stáhnout je na disk, rozbalit a kompletně z nich vytěžit reálné produktové fotky i technická ETIM data do ELDOCKu**.

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a proveď ji kompletně od začátku do konce v těchto 5 krocích:

================================================================================
KROK 1: AUTONOMNÍ VYHLEDÁNÍ A STAŽENÍ ETIM / BMEcat / XML / XLSX BALÍČKŮ (`scripts/discover-and-download-etim.mjs`)
================================================================================

Použij kombinaci vyhledávání na webu (Web Search / Fetch) a Playwright prohlížeče (reálné Chromium, které projde stránky *Ke stažení / Podpora pro e-shopy / Ceníky a databáze* a odchytí všechny přímé odkazy na `.zip`, `.xml`, `.xlsx`, `.csv`) a prohledej tyto oficiální zdroje:

1. **ABB (`nizke-napeti.cz.abb.com`):**
   - Zpracuj lokální archiv `ELSB_ETIM-9.0_2026-05.zip` (pokud je na disku) A ZÁROVEŇ prohledej `https://nizke-napeti.cz.abb.com/ke-stazeni/ceniky` a `https://nizke-napeti.cz.abb.com/ke-stazeni`, kde ABB veřejně publikuje aktuální datové soubory ceníků a ETIM/BMEcat balíčky (obsahující MPN, EAN, ETIM parametry a přímé odkazy na produktové fotografie v PIM/CDN ABB).

2. **KOPOS Kolín (`kopos.cz`):**
   - Prohledej `https://www.kopos.cz/cs/ke-stazeni`, `https://www.kopos.cz/cs/ceniky`, `https://www.kopos.cz/cs/podpora-pro-projektanty` a e-shopové/velkoobchodní XML/CSV/XLSX exporty KOPOSu.
   - Dohledej a stáhni datový soubor s instalačními krabičkami (`KU 68-1901`, `KPR 68`, `KPR 68/71`, `KPR 68/L`, `KUP 68`, `KPRL 68-70/LD NA`, `KEZ KB`, `MDZ KB`, `KP 64/FD`, `KP 68/2`, `KP 68/3`), vytáhni z něj přesné rozměry, hloubky v mm, bezhalogenovost a stáhni reálné produktové fotky všech krabiček z `kopos.cz`!

3. **OEZ Letohrad (`oez.cz`):**
   - Prohledej `https://www.oez.cz/ke-stazeni` / `https://www.oez.cz/podpora/ceniky` (OEZ veřejně nabízí ke stažení kompletní databáze výrobků v XLSX/XML/ETIM včetně ztrátových výkonů $P_v$, šířek v modulech a přímých URL adres na obrázky jističů Minia `LTN`, chráničů `LFE`/`LFN`, jističochráničů `LFI`, pojistkových odpínačů `OPVP` a rozvodnic `RZA`/`RZG`/`RN`).

4. **Schneider Electric (`se.com/cz/cs`):**
   - Prohledej sekci ke stažení a ceníky na `se.com/cz/cs/` a pro všechny naše řady vypínačů/zásuvek (`Nová Unica`, `Sedna Design & Elements`, `Asfora`, `Mureva Styl IP55`) i přístrojů/rozvodnic (`Acti9`, `Resi9`, `Mini Pragma`, `Kaedra`) stáhni ETIM data a originální studiové fotky přímo z veřejného multimediálního serveru Schneider Electric:
     * `https://download.schneider-electric.com/files?p_Doc_Ref=<MPN>&p_File_Type=rendition_369_jpg` (příp. `rendition_1500_jpg` / JSON data ze stránky `https://www.se.com/cz/cs/product/<MPN>`).

5. **Legrand (`legrand.cz`):**
   - Prohledej `https://www.legrand.cz/ke-stazeni` / ceníky a e-katalog `legrand.cz` pro řady `Valena Life`, `Valena Allure`, `Céliane`, `Plexo IP55` a rozvodnice `Practibox S` / `Nedbox` + přístroje `RX3` / `DX3`. Podle 6místných objednacích kódů stáhni ETIM parametry a originální produktové fotky.

6. **Hager (`hager.com/cz`):**
   - Prohledej `https://hager.com/cz/ke-stazeni` (ceníky a datové soubory XLSX/BMEcat) a katalogové JSON endpointy pro domovní řady `lumina`, `berker S.1`, `berker B.3 / B.7`, `berker Q.1 / Q.3`, `berker K.1 / K.5`, `berker R.classic`, `berker W.1 IP55` a rozvodnice `Vector`, `Volta`, `Golf`, `Univers`.

7. **Eaton, Schrack a Saltek (`eaton.com/cz`, `schrack.cz`, `saltek.eu`):**
   - Dohledej veřejné datové soubory (zejména Saltek a Schrack mají veřejné XML/ETIM feedy pro e-shopy) a stáhni reálné fotky a parametry svodičů přepětí, jističů, chráničů a rozvodnic (`KLV`, `xEnergy`, `BC-O`).

Všechny stažené balíčky ulož do `data/etim/downloads/<brand>/` (složku `data/etim/downloads/` přidej do `.gitignore`, aby nezahltila git repozitář).

================================================================================
KROK 2: UNIVERZÁLNÍ PARSER STAŽENÝCH BALÍČKŮ (BMEcat XML + ETIM CSV/XLSX + E-SHOP FEEDY) (`scripts/parse-etim-packages.mjs`)
================================================================================

Vytvoř robustní parser (podporující `.zip`, `.xml` BMEcat 1.2 / 2005 / ETIM 7/8/9, `.xlsx` přes `xlsx`/`exceljs` a `.csv`), který ze všech stažených balíčků v `data/etim/` automaticky vytáhne:

1. **Identifikaci produktu:**
   - `MPN` / `SUPPLIER_PID` / `Objednací číslo`, `EAN` (`GTIN`), český název, řadu (`Design/Series`) a odkaz na PDF katalogový list (`datasheetUrl`).
2. **Exaktní technické parametry ETIM:**
   - **Pro vypínače, zásuvky, stmívače, termostaty a rámečky (`EC001590`, `EC000125`, `EC000050`):**
     * Skutečnou vestavnou hloubku v mm (`EF000218`),
     * Maximální počet jednotek ve vícerámečku `1R` až `5R` (`EF000137`) a orientaci (vodorovná/svislá),
     * Skutečnou barvu (`EF000007`), číslo RAL (`EF000116`), materiál (`EF002169` – plast, sklo, porcelán, dřevo, kov, břidlice, beton), povrch (`EF006569` – matný/lesklý) a krytí IP (`EF005474`).
   - **Pro instalační krabičky (`EC002601`, `EC000062`):**
     * Vnitřní hloubku v mm, průměr (68 / 73 mm), způsob montáže (pod omítku do zdiva / do dutých stěn SDK / do zateplení / větruvzdorná s membránou) a bezhalogenovost (`HF`).
   - **Pro rozvodnice (`EC000214`) a DIN přístroje (`EC000042`, `EC000003`, `EC000905`, `EC000941`):**
     * Počet řad, počet modulů na řadu, celkový počet modulů, rozměry V×Š×H v mm, krytí IP, způsob montáže (pod omítku / nástěnná), tepelný ztrátový výkon $P_v$ [W] (`EF005455`) a šířku v modulech (`EF002950`).
3. **Originální produktové fotografie (`MIME_INFO` / `IMAGE_URL`):**
   - Stáhni každou produktovou fotku z URL uvedené v balíčku (nebo z veřejného CDN výrobce podle MPN/EAN).
   - **KRITICKÁ KONTROLA KVALITY OBRÁZKU:** Před uložením ověř HTTP status `200`, `Content-Type: image/*`, minimální velikost souboru (`> 1.5 KB`) a platnou hlavičku obrázku (JPEG/PNG/WebP magic bytes), aby se na disk nikdy neuložila chybová HTML stránka 404!
   - Převeď fotku do čistého `.webp` (`400×400 px`, průhledné nebo čistě bílé studiové pozadí) a ulož ji do:
     * `public/catalog-images/<brand>/<seriesId>/<slot-nebo-colorId>.webp` (pro domovní spínače, zásuvky a rámečky)
     * `public/catalog-images/<brand>/boxes/<codeId>.webp` (pro krabičky KOPOS a další)
     * `public/catalog-images/<brand>/enclosures/<mpn>.webp` (pro rozvodnice)
     * `public/catalog-images/<brand>/devices/<mpn>.webp` (pro DIN přístroje a Smart Home panely)
   - Zapiš kompletní mapu všech ověřených fotek do `public/catalog-images/manifest.json`.

================================================================================
KROK 3: AUTOMATICKÁ AKTUALIZACE KATALOGŮ V KÓDU ELDOCKU PODLE STAŽENÝCH ETIM DAT
================================================================================

Promítni vytěžená ETIM data přímo do našich datových souborů a databáze:
1. **`src/lib/panel-builder/residential-series-catalog.ts`:**
   - Doplň u všech řad (ABB, Schneider, Legrand, Hager) skutečné MPN a EAN kódy ze stažených ceníků/ETIMu, přesné vestavné hloubky strojků v mm (`mechanismDepthMm`), ověřené `maxFrameGang` (`1` až `5`) a odkazy na reálné `.webp` fotky z `manifest.json`.
2. **`src/lib/panel-builder/mounting-boxes-catalog.ts`:**
   - Doplň reálné fotky krabiček KOPOS (`public/catalog-images/kopos/boxes/...`), přesné hloubky v mm a objednací čísla ze staženého feedu KOPOSu.
3. **Rozvodnice a DIN přístroje (`CatalogComponent` + výběr rozvodnice v AI Panel Builderu):**
   - Aktualizuj seznam rozvodnic (ABB Mistral41/Mistral65/ComfortLine/Unifix, Eaton KLV/xEnergy/BC-O, Hager Vector/Volta/Golf, OEZ RZA/RZG/RN, Schneider Mini Pragma/Kaedra) o přesné typové a objednací kódy, rozměry, počty modulů a reálné fotky skříní.

================================================================================
KROK 4: VIZUÁLNÍ KONTROLA PŘES PLAYWRIGHT (OVĚŘENÍ, ŽE SE FOTKY SKUTEČNĚ NAČÍTAJÍ!)
================================================================================

Po doběhnutí stahování a parsování napiš automatický verifikační test v Playwrightu, který:
1. Otevře v prohlížeči modal `Designové řady a barvy` a postupně přepne výrobce **ABB**, **Schneider Electric**, **Legrand** a **Hager**.
2. Zkontroluje u vykreslených `<img>` elementů vlastnost `img.complete === true && img.naturalWidth > 50`, čímž 100% potvrdí, že se zákazníkovi na obrazovce vykreslují skutečné stažené `.webp` fotografie produktů (a ne rozbité odkazy nebo prázdné placeholdery)!
3. Stejně tak ověří načtení fotek krabiček KOPOS v kusovníku a fotek rozvodnic v AI Panel Builderu.

================================================================================
KROK 5: VÝPIS STATISTIKY, COMMIT A NASAZENÍ NA PRODUKCI
================================================================================

1. Vypiš mi do terminálu přesnou tabulku výsledků:
   - Které balíčky / ceníky / ETIM feedy se podařilo na webech výrobců dohledat a stáhnout,
   - Kolik reálných `.webp` fotek bylo uloženo a ověřeno pro každou značku (`ABB`, `KOPOS`, `OEZ`, `Schneider`, `Legrand`, `Hager`, `Eaton`, `Loxone`, `TapHome`),
   - Kolik položek v katalogu dostalo zpřesněné ETIM parametry (hloubka v mm, $P_v$ [W], EAN, MPN).
2. Spusť `npm run verify`, udělej git commit (včetně všech vygenerovaných `.webp` fotek v `public/catalog-images/` a `manifest.json`, ale bez surových ZIP/XML archivů v `data/etim/downloads/`) a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Stav webů výrobců ověřený 2026-11-11 skriptem `npm run catalog:discover` (přehled `data/etim/downloads/discovery.json`):

- **Pravidla stahování:** robots.txt každého webu (zakázaná cesta se přeskočí – např. stránkování katalogu Legrand
  `?page=`), jeden požadavek po druhém s pauzou, obecný identifikátor klienta bez osobních údajů, bez přihlašování.
  Stránky se čtou HTTP požadavkem a v Playwrightu (Edge, bez úprav identity) jen tam, kde web HTTP odmítne (403).
  Web, který automatizovaný přístup odmítne, je „blokuje“ – nikdy se neobchází jinou identitou prohlížeče ani CAPTCHA.
  Zaheslované soubory se stáhnou, ale nepoužijí (heslo se nehádá). Kreslicí data (Revit / DXF / STEP) a sešity s makry
  nejsou datové balíčky výrobků.
- **ABB:** nizke-napeti.cz.abb.com automatizovaný přístup odmítá (HTTP spojení bez odpovědi, prohlížeč
  `net::ERR_HTTP2_PROTOCOL_ERROR`, stejně jako ve fázi 92) – použitá vlastní kopie `ELSB_ETIM-9.0_2026-05.zip`
  (stejný balíček vystavuje ABB na stránce Dokumenty a katalogy; ceníky ABB jsou jen po přihlášení). Nově fotky
  307 DIN přístrojů ABB z katalogu AI Panel Builderu (`abb/devices/`); řady, rozvodnice a chytrá domácnost z fáze 94.
- **KOPOS:** stránky ze zadání vrací 404; skutečné jsou `/cs/ceniky-ke-stazeni` (ceník XLSX od 1. 8. 2026 – kód,
  název, popis, cena za 1 000 MJ, EAN), `/cs/pro-projektanty` (jen knihovny Revit tvarovek žlabů) a `/cs/katalogy`
  (PDF). ETIM / BMEcat ani XML feed KOPOS veřejně nevede → feed ze stránek výrobků e-shopu (sitemap, 263 krabic
  a desek: EAN, materiál, průměr, hloubka, datový list, fotka). Všech 23 krabic KOPOS katalogu krabic má fotku, EAN
  a hloubku (souhlasí s katalogem), 11 průměr, 6 bezhalogenových. Kódy ze zadání: KPR 68 → KPR 68_KA, KPRL 68-70/LD NA
  → KPRL 68-70/LD_NA, KEZ KB → KEZ_KB, MDZ KB → MDZ_KB, KP 68/2 → KP 68/2_KA; KU 68-1901 už výrobce nevede (stránka
  KU 68-45: „přímá náhrada krabice KU 68-1901“), KPR 68/71 přesně nevede (nejbližší KPR 68/71L_NA – v katalogu je),
  KPR 68/L, KUP 68 (označení SEZ), KP 64/FD a KP 68/3 v aktuálních datech KOPOS nejsou. Ceníkové ceny jsou v datech
  (`priceCzk`), aplikace je zatím nezobrazuje.
- **OEZ:** `/ke-stazeni` vede na `/ke-stazeni/dokumenty` (PDF katalogy), ceník CSV se generuje jen přihlášenému partnerovi
  („Nemáte oprávnění ke stažení ceníku“) – nestahuje se. Feed ze stránek výrobků oez.cz (sitemap, stránka podle
  typového označení ověřená objednacím kódem – „ltn-16b-1“ je LTN-1,6B-1): 370 z 371 výrobků katalogu Eldocku (EAN,
  počet modulů, rozměry, hloubka, fotka); ztrátový výkon Pv stránky OEZ neuvádějí.
- **Schneider Electric:** se.com odmítá HTTP (403), čte se v Playwrightu; stránka ke stažení nemá datové soubory.
  Adresa obrázku podle MPN (`p_Doc_Ref=<MPN>`) neexistuje (404) a varianta `_main` vrací zástupný obrázek 1 329 B –
  kontrola kvality ho odmítne; skutečné reference (`<MPN>_IOP-default…`, `PB…`) jsou na stránce výrobku. 128 stránek
  (43 dílů řad Nová Unica / Sedna / Asfora, 85 rozvodnic), 125 fotek; EAN stránky se.com neuvádějí (z katalogu
  Eldocku). Mureva Styl nemá v katalogu domovních přístrojů díly. Schneider není mezi výrobci výběru skříně
  (`ENCLOSURE_MANUFACTURERS`) – fotky jeho rozvodnic ukazuje katalog přístrojů.
- **Legrand:** `/ke-stazeni` 404; `/cs/ke-stazeni/databaze-etim`: databáze ETIM V10 / V9 a Netatmo jsou ZIP se
  zašifrovaným XML a ceníky XLSX zaheslované sešity Office (heslo výrobce posílá e-mailem) – nepoužité. Veřejný archiv
  fotek výrobků (16 GB ZIP) se přes HTTP Range čte jen po částech: adresář (22 495 fotek) a 27 fotek dílů Valena Life /
  Valena Allure / Mosaic / Plexo podle 6místného kódu (hlavní fotka `<kód>-LEGRAND-1000.jpg`). Plexo nové generace
  s „L“ (`069621L` …) archiv z 2022 nevede – fotka jiného čísla se nepoužije. Céliane a Niloé nemají v katalogu
  domovních přístrojů díly pro galerii; Practibox S, Nedbox a RX3 / DX3 nejsou v katalogu Eldocku.
- **Hager:** `/cz/ke-stazeni` 404, skutečná stránka `/cz/ke-stazeni-a-udalosti/etim-data`: BMEcat ETIM 10 (13 183
  výrobků, fotky assets.hager.com), Excel ETIM (popisy, hlavní fotka, bezhalogenovost) a 7 GB archiv fotek (není potřeba).
  Díly řad lumina a berker S.1 (řada „berker S.1 / B.3 / Q.1 / Q.3“) podle popisu a třídy ETIM; vestavné hloubky
  (lumina spínač i zásuvka 35 mm, berker zásuvka 40 mm) do hlídače krabic; rámečky obou řad v ETIM do 5R (pravidla
  potvrzena). Řady berker B.7, K.1, K.5, R.classic, W.1 a lumina passion / soul nejsou samostatné řady katalogu Eldocku
  – nepřidávají se (nová řada = kusovník, pravidla a náhledy). Rozvodnice: 65 fotek; golf VF212TD a VS212TD opravené
  na 2 × 12 (ETIM i popis výrobce „2-řadá, 24 mod.“, katalog měl 1 × 12), Volta VA24B ponechaná 2 × 12 (ETIM uvádí
  24 modulů v řadě – rozpor s názvem). Pv u Hager jen u jističů, které katalog Eldocku nevede.
- **Eaton:** eaton.com odmítá prohlížeč (`net::ERR_HTTP2_PROTOCOL_ERROR`) i HTTP – blokuje, KLV / xEnergy / BC-O bez dat.
  **Schrack:** robots.txt zakazuje katalogové stažení (`/eshop/catalog/download/*`), veřejný je jen dopravní ceník FVE.
  **Saltek:** veřejný datový soubor nenalezen. **Loxone / TapHome:** nejsou mezi výrobci zadání – 0 nových fotek.
- **ETIM vlastnosti:** EF000137 a EF005455 v datech výrobců nejsou – počet násobků rámečku je EF000074, ztrátový výkon
  EF005387 (stejně jako fáze 94), řady rozvodnice EF000266, moduly v řadě EF002950, vestavná hloubka EF012278 / EF000218.
- **Parser** bez knihoven `xlsx` / `exceljs` (XLSX = ZIP + XML, vlastní čtení i CSV) – žádná nová závislost.
- **Fotky:** WebP 400 × 400 v bílém poli (sharp, jako fáze 94), 963 nových (ABB 307, KOPOS 23, OEZ 370, Schneider 125,
  Legrand 27, Hager 111), všechny s GTIN. Krabice, rozvodnice a přístroje jsou v `manifest.json` jako `products`;
  fotky DIN přístrojů jen pro serverový katalog (`device-photos.generated.ts`) – v klientském balíčku by přidaly stovky
  kB. Licence u každé fotky: „užití v Eldocku (i ve veřejném repozitáři) zadal provozovatel 2026-11-11 (fáze 97)“
  (ABB jako ve fázi 94).
