# Zadání fáze 92 – onboarding a průvodci pro nové zákazníky (trenažéry, živé taháky, průvodce závodem) a reálné fotky řad

Vloženo z chatu 2026-11-11. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Máme dva klíčové úkoly:
1) Zcela přepracovat onboarding a průvodce pro nové zákazníky – žádné nudné čtecí bubliny a striktní oddělení obou produktových světů:
   - **Svět 1: Elektrikáři, projektanti a revizáci (`/panel-builder` a `/panel-builder/floorplan`)** mají k dispozici POUZE **2D Půdorys & Kabeláž** a **AI Panel Builder** (nikdy jim tam neukazuj průmyslovou správu závodů!).
   - **Svět 2: Výrobní závody (`/` ELDOCK Průmysl)** mají k dispozici POUZE **Správu výrobního závodu a dokumentace** (nikdy jim v průmyslovém průvodci neukazuj bytové půdorysy!).
2) Vyřešit reálné produktové fotky vypínačů a zásuvek v galerii designových řad (Playwright Harvester + Ctrl+V nahrávač fotek).

Zapiš tuto fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 4 částech:

================================================================================
ČÁST 1: STRIKTNĚ ODDĚLENÝ PRAKTICKÝ TRENAŽÉR PRO ELEKTRIKÁŘE (`/panel-builder` a `/panel-builder/floorplan`)
================================================================================

Místo pasivních vyskakovacích bublin postav pro elektrikáře a revizní techniky praktický interaktivní trenažér a živého samoodškrtávacího asistenta:

1. V 2D PŮDORYSU (`/panel-builder/floorplan`) – "ROZDĚLANÁ ZAKÁZKA Z 85 % HOTOVÁ (DOKONČETE JI 3 KLIKY ZA 45 S)" + "ŽIVÝ KONTROLNÍ TAHÁK":
   - **A) Interaktivní trenažér "Vyzkoušet na rozdělaném domě (3 úkoly za 45 s)" (`src/lib/panel-builder/floorplan-sandbox-preset.ts`):**
     * V horní liště 2D půdorysu (a při prvním otevření půdorysu novým uživatelem jako přívětivou volbu `[ 🎯 Vyzkoušet nanečisto: Dokončit rozdělaný dům 3 kliky (45 s) ]` vs. `[ ➕ Začít prázdný půdorys ]`) načti předpřipravený, **z 85 % hotový Bungalov 4+kk** (má už nakreslené místnosti s nábytkem, postelí, kuchyňskou linkou, vanou, umyvadlem, rozváděčem `RH` a většinou zásuvek/světel).
     * V pravém dolním rohu zobraz kompaktní interaktivní kartu **"🎯 Trenažér: Dokončete tuto zakázku 3 kliknutími"**, která reaguje na skutečné akce uživatele na plátně:
       - **Úkol 1/3:** *"V ložnici chybí zásuvka u postele. Klikněte v levé paletě na `Dvojzásuvka` (nebo klikněte na `[Vybrat nástroj]`) a položte ji ke stěně u postele."* -> V levé paletě pulzuje žlutý rámeček kolem `Dvojzásuvka` a v ložnici u postele svítí jemný terčík `⊕ Sem položte dvojzásuvku`. Jakmile tam uživatel klikne, okamžitě se vykreslí obvodová trasa kabelu po stěně a Úkol 1 se sám odškrtne (`✅ Hotovo! Všimněte si, jak kabel automaticky oběhl stěnu místnosti.`).
       - **Úkol 2/3:** *"V koupelně klikněte na stropní svítidlo a v detailu zaškrtněte `🔆 Stmívatelné`."* -> Jakmile uživatel zaškrtne stmívání, Úkol 2 se sám odškrtne (`✅ Hotovo! Systém automaticky přidal stmívací aktor do rozváděče a hlubokou krabičku KOPOS KPR 68.`).
       - **Úkol 3/3:** *"Zakázka je kompletní! Klikněte na žluté tlačítko `⚡ Vygenerovat rozváděč z tohoto půdorysu`."* -> Tlačítko pulzuje; po kliknutí se vygeneruje kompletní rozváděč (bez odečtu kreditů v režimu trenažéru!) a přepne uživatele přímo do AI Panel Builderu s gratulací!
   - **B) Živý samoodškrtávací tahák při práci na VLASTNÍM projektu (`FloorplanLiveChecklist.tsx`):**
     * Když uživatel pracuje na svém vlastním půdorysu, zobraz v rohu sbalitelný **"🧭 Tahák zakázky (Co teď udělat)"**, který vůbec neblokuje obrazovku, ale **automaticky v reálném čase kontroluje stav projektu** a odškrtává hotové body:
       1) `[✓ / ○] 1. Podklad nebo místnosti` *(automaticky `✓`, jakmile je nahrán PDF/DXF se zkalibrovaným měřítkem NEBO vložena aspoň 1 místnost)* + tlačítko `[Ukázat kde]`, které zvýrazní vložení místnosti X×Y / nahrání PDF.
       2) `[✓ / ○] 2. Zvolen výrobce a řada vypínačů` *(zobrazuje aktuální volbu např. `ABB Levit M` + tlačítko `[Změnit řadu/barvu]`)*.
       3) `[✓ / ○] 3. Umístěn hlavní rozváděč (RH)` *(automaticky `✓`, jakmile je na plátně prvek `RH`; pokud chybí, svítí jako aktuální doporučený krok s tlačítkem `[Vybrat rozváděč RH]`, které rovnou aktivuje nástroj pokládky rozváděče!)*.
       4) `[✓ / ○] 4. Osazeny zásuvky, světla a spotřebiče` *(ukazuje živé počty: např. `14 zásuvek · 6 světel · 3 spotřebiče`)*.
       5) `[✓ / ○] 5. Kontrola tras, kusovníku a generování rozváděče` *(tlačítka `[Otevřít kusovník s krabičkami KOPOS]` a `[⚡ Vygenerovat rozváděč]`)*.
     * Uživatel může tahák kdykoliv minimalizovat do malé pilulky `🧭 Tahák (3/5 hotovo)` nebo trvale vypnout.

2. V AI PANEL BUILDERU (`/panel-builder` a `/panel-builder/[id]`) – "3 REÁLNÉ TRÉNINKOVÉ ZAKÁZKY NA 1 KLIK (BEZ ODEČTU KREDITŮ)" + "ŽIVÝ TAHÁK ROZVÁDĚČE":
   - Přímo na stránce `/panel-builder` (pro nové uživatele s 0 projekty nebo přes tlačítko `🎯 Vyzkoušet nanečisto (Trenažér zdarma)`) zobraz 3 okamžité tréninkové zakázky (označené `TRENAŽÉR – 0 kreditů`), které si elektrikář otevře jedním klikem bez hledání vlastních fotek:
     1) **`🏠 Bytová rozvodnice 36M (Klasická instalace TN-S)`** – ukázka vyvážení fází, N-můstků za chrániči a bleskového tisku 6listového PDF elaborátu a štítků.
     2) **`☀️ Rodinný dům + FVE a Wallbox 72M (s úkolem v Elektro-linteru)`** – rozváděč má záměrně 1 normovou chybu dle ČSN 33 2130 ed. 4 (např. chybějící chránič typu B/F nebo světla na společném chrániči se zásuvkami), a živý tahák vyzve elektrikáře: *"1) Klikněte v Kroku 2 na `Opravit 1 klikem` v Elektro-linteru -> 2) Zkontrolujte oteplení v Kroku 3 -> 3) Vytiskněte 6listový PDF elaborát v Kroku 4!"*
     3) **`🏡 Chytrý dům ABB-free@home® / Loxone 108M`** – ukázka kombinace silnoproudých jističů a DIN akčních členů (`SA-M`, `JA-M`, `DA-M`, `SysAP`) s výpočtem oteplení skříně dle IEC TR 60890.

================================================================================
ČÁST 2: STRIKTNĚ ODDĚLENÝ PRŮVODCE PRO VÝROBNÍ ZÁVODY (`/` ELDOCK PRŮMYSL)
================================================================================

V průmyslové části aplikace (`/` – Správa výrobních závodů) vytvoř samostatného průmyslového průvodce (`IndustrialPlantOnboarding.tsx`), který se zaměřuje výhradně na potřeby **vedoucího údržby, technického ředitele a průmyslových revizáků** (žádné bytové vypínače ani domovní půdorysy!):

Nabídni v něm 2 praktické interaktivní režimy (dostupné po přihlášení nového závodu a přes tlačítko `🧭 Průvodce závodem` v horní liště):

1. **REŽIM A: `🏗️ Postavit náš vlastní závod a první stroj za 3 minuty (Rychlý průvodce založením závodu)`:**
   Interaktivní 3krokový asistent, který s novou výrobní firmou reálně založí její první halu a první zdokumentovaný stroj:
   - **Krok 1 (Vaše první hala a hlavní zdroj):** Uživatel zadá název své první výrobní haly (např. `"Hala 1 – Výroba"`), název hlavního rozváděče/trafostanice (`"HR-1"`) a jmenovitý výkon/proud -> systém v 2D mapě závodu ihned vygeneruje čistou halu s rozvodnou.
   - **Krok 2 (Přidání prvního stroje / rozváděče a nahrání PDF schématu):** Uživatel zadá název prvního stroje nebo podružného rozváděče (např. `"CNC Centrum 1"` nebo `"Rozváděč R-101"`), příkon v kW a rovnou přetáhne jeho PDF elektrické schéma (příp. použije vzorové průmyslové schéma na 1 klik).
   - **Krok 3 (Okamžitý QR štítek a vyzkoušení Červenky):** Systém ukáže vygenerovaný **QR štítek tohoto stroje** (připravený k tisku na 20×20 mm / 40×40 mm štítek) a jedním klikem otevře kartu stroje, kde si uživatel rovnou vyzkouší zakreslit první změnu v `Července`, nahrát zálohu PLC a zkontrolovat kartu v `Knize revizí`!

2. **REŽIM B: `🚨 Simulace noční poruchy linky (90vteřinová interaktivní mise pro údržbu)`:**
   Praktická interaktivní mise nad vzorovým závodem, která vedoucímu údržby nebo řediteli závodu během 90 sekund v praxi předvede hodnotu ELDOCKu při poruše:
   - **Úkol 1/4 (02:15 ráno – Výpadek stroje):** *"Na lisovně vypadl stroj. Klikněte na zvýrazněný rozváděč/stroj na 2D mapě závodu (nebo simulujte načtení jeho QR kódu mobilem)."*
   - **Úkol 2/4 (Diagnostika ve schématu a elektronická Červenka):** *"Vyměnili jste stykač a přepojili svorku. Klikněte v prohlížeči schématu na `✏️ Červenka` a zakreslete červenou poznámku do výkresu, aby o změně věděla ranní směna i CAE projektant."*
   - **Úkol 3/4 (Záloha PLC a hlídač legislativy EU 2023/1230):** *"Zkontrolujte záložku `Zálohy SW (PLC/HMI)` a podívejte se, jak systém automaticky vyhodnotil, zda zásah představuje podstatnou změnu stroje dle Nařízení EU 2023/1230."*
   - **Úkol 4/4 (Simulátor připojení nového stroje a Kniha revizí):** *"Na závěr jedním klikem vyzkoušejte `Simulátor zátěže` (zda stávající trasa unese nový 60kW stroj) a otevřete `Knihu revizí` připravenou pro kontrolu TIČR/SÚIP."*

================================================================================
ČÁST 3: REÁLNÉ PRODUKTOVÉ FOTKY VYPÍNAČŮ A ZÁSUVEK (PLAYWRIGHT HARVESTER + CTRL+V UPLOADER)
================================================================================

Vyřeš zobrazení reálných fotografií v modalu `Designové řady a barvy` (`DesignSeriesModal.tsx` a `SeriesPreviewIllustration.tsx`):
1. **Automatický skript v reálném prohlížeči (`scripts/harvest-switch-photos.mjs`):**
   - Pomocí Playwrightu (reálné Chromium) projdi designové řady v `residential-series-catalog.ts` a podle MPN / názvu řady stáhni reálné produktové fotografie spínačů a zásuvek do `public/catalog-images/<brand>/<seriesId>/` a zapiš je do `public/catalog-images/manifest.json`.
2. **Okamžitý „Ctrl+V / Drag & Drop“ nahrávač fotek přímo v modalu `Designové řady a barvy` (`POST /api/catalog-images/upload`):**
   - Přidej do modalu `Designové řady a barvy` přepínač **`[ 📷 Nahrát reálné fotky (Ctrl+V / Soubor) ]`**.
   - Když je zapnutý, uživatel může na webu výrobce nebo v PDF katalogu zkopírovat jakoukoliv reálnou fotku vypínače/zásuvky/rámečku do schránky (`Ctrl+C`), kliknout na příslušný slot (`Spínač 1R`, `Zásuvka 1R`, `Vícerámeček`, nebo konkrétní barevnou dlaždici) a stisknout **`Ctrl+V`** (nebo přetáhnout obrázek myší).
   - Endpoint `/api/catalog-images/upload` uloží obrázek do `public/catalog-images/<brand>/<seriesId>/<slot>.webp`, zapíše ho do `manifest.json` a komponenta `SeriesPreviewIllustration.tsx` okamžitě (a trvale pro všechny uživatele) zobrazí tuto reálnou fotografii místo kresleného SVG!

================================================================================
ČÁST 4: TESTY, VERIFIKACE A NASAZENÍ
================================================================================

- Napiš unit a E2E testy ověřující:
  1) Striktní oddělení: v `/panel-builder` a `/panel-builder/floorplan` se zobrazuje pouze trenažér a živý tahák pro půdorysy a rozváděče; v `/` se zobrazuje pouze průmyslový průvodce závodem.
  2) Funkčnost 85% rozdělaného domu v 2D půdorysu (3 interaktivní úkoly) a živého samoodškrtávacího taháku (`FloorplanLiveChecklist`).
  3) Funkčnost endpointu `/api/catalog-images/upload` pro vkládání reálných fotek vypínačů přes `Ctrl+V`.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Část 1 – trenažér a taháky elektrikářů (`/panel-builder`, `/panel-builder/floorplan`)**

- **Rozdělaný bungalov 4+kk** (`floorplan-sandbox-preset.ts`): 9 místností (obývací pokoj s kuchyní, ložnice, koupelna, chodba, technická místnost s rozváděčem RH, WC, dětský pokoj, pracovna, šatna), nábytek (manželská a dětská postel, kuchyňská linka, vana, umyvadlo, WC, skříně, gauč, stoly), 16 zásuvek, 14 světel, 5 spotřebičů. Bez normových chyb, rovnou generovatelný (prostředí zvolené). Trenažér je stránka `/panel-builder/floorplan/trenazer` – editor s `sandbox`: nic se neukládá na server ani do zálohy v prohlížeči (`useFloorplanSync({ disabled })`), v liště „🎯 Trenažér – nic se neukládá“.
- **Instalace bungalovu = ABB-free@home (sběrnice)** – úkol 2 ze zadání slibuje „stmívací aktor do rozváděče a hlubokou krabičku KOPOS KPR 68“. Stmívací akční člen v rozváděči je pravda jen ve sběrnicové instalaci (v klasické stmívá stmívač na stěně a krabice spínače je hluboká už kvůli svorkám WAGO, nic by „nepřibylo“). Gratulace k úkolu 2 se proto počítá z výpočtu chytré domácnosti (`bathDimmerOf` → „DA/M.4.210.2.1 (4násobný)“) a krabici nezmiňuje (sběrnicové tlačítko má mělkou krabici).
- **Úkoly se odškrtávají podle nákresu** (`sandboxProgress`): 1 = nová zásuvka v ložnici do 1,1 m od cíle u postele (kabel k ní vede obvodově po stěnách – test), 2 = stropní svítidlo koupelny stmívatelné, 3 = vygenerovaný rozváděč. Pulzuje položka Dvojzásuvka v paletě (kategorie se sama rozbalí), terčík „⊕ Sem položte dvojzásuvku“, kroužek „🔆 Klikněte na svítidlo“ a žlutá tlačítka ⚡ (v kartě i v liště editoru).
- **Rozváděč bez kreditu** jen pro cvičný bungalov: server ověří místnosti (název a rozměr), žádný vlastní podklad ani další podlaží a nejvýš 15 prvků navíc (`sandboxDraftIssue`); na firmu nejvýš 12 rozváděčů z trenažérů. Značka `PanelBoardProject.trainerPreset` (migrace `phase92_trainer`, jen nový sloupec). Po vygenerování AI Panel Builder s gratulací (`?trenazer=hotovo`).
- **Úvodní volba** „🎯 Vyzkoušet nanečisto … / ➕ Začít prázdný půdorys“: karta v prázdném seznamu půdorysů a nad editorem nového půdorysu, dokud firma nemá žádný půdorys. Nemodální – dialog by blokoval práci (i stávající E2E, které otevírají nový půdorys). Trenažér je i v horní liště editoru („🎯 Vyzkoušet nanečisto“) a v seznamu půdorysů.
- **Živý tahák zakázky** (`FloorplanLiveChecklist`): nahoře v pravém sloupci editoru – nic nepřekrývá (v rohu obrazovky by zakrýval panely a tlačítka). Body 1–5 podle zadání; „Ukázat kde“ přepne krok 1 a rozbliká formulář místnosti i nahrání PDF / DXF, „Změnit řadu/barvu“ otevře galerii řad, „Vybrat rozváděč RH“ zapne pokládku rozváděče, kusovník s krabicemi zvoleného výrobce, ⚡ generování. Bod 2 je splněný už výchozí řadou nového nákresu (tahák připíše „výchozí – změňte podle zákazníka“). Pilulka „🧭 Tahák (3/5 hotovo)“, trvalé vypnutí a zapnutí tlačítkem 🧭 v liště.
- **Tréninkové zakázky** (`panel-trainer-presets.ts`, `services/panel-trainer.ts`): skutečné projekty ze stejného generátoru jako vlastní zakázky, bez kreditu, podruhé se otevře existující. **Velikosti skříní jsou ty, které generátor s rezervou 25 % (ČSN EN 61439) skutečně vybere**: byt 3+kk 3f TN-S = 48M (osazení 38 M – do 36M se s rezervou nevejde), RD + FVE + wallbox + TČ = 96M (64 M), chytrý dům ABB-free@home se žaluziemi, topením a stmíváním = 120M (74 M; skříň 108M CA34R 3 × 36 generátor nevybral – rozložení skupin na řady / ztráty). Zadání uvádí 36M / 72M / 108M; test hlídá, že název sedí se skříní projektu.
- **Záměrná normová chyba** zakázky RD + FVE: chránič wallboxu typu A místo B (ČSN 33 2130 ed. 4 – výkonová elektronika) → Elektro-linter „rcd-type-b“ s opravou jedním klikem (ostatní zakázky jsou bez nálezů – test). **Kroky taháku podle skutečných kroků projektu** (`STEPS`): Elektro-linter je v kroku 1 (zadání: krok 2), oteplení v kroku 4 (zadání: krok 3), PDF v kroku 5 (zadání: krok 4). „6listový elaborát“ tahák neslibuje – počet listů závisí na projektu.
- **Akční členy free@home podle katalogu v aplikaci**: SA-M (spínací), DA/M (stmívací), BA-M (žaluziový), HA-M (topení), PS-M (zdroj) – zadání uvádí „JA-M“ (žaluziový je BA-M) a „DA-M“ (DA/M); systémový modul SysAP 3.0 je nástěnný, v rozváděči není.
- **Živý tahák rozváděče** (`PanelLiveChecklist`, layout `/panel-builder/[id]`) u rozváděčů z trenažérů (tréninkové zakázky a cvičný bungalov – zadání ho váže na ně; u vlastních zakázek by pruh posunul pracovní plochu kroku 1 pod lepivé panely a rozložení zůstává beze změny): pruh nad projektem na všech krocích (nic nepřekrývá, v tisku skrytý) – 1 Elektro-linter bez nálezů (stejný výpočet jako krok 1), 2 strom zapojení, 3 skříň, 4 oteplení vyhovuje a krok 4 byl otevřený, 5 elaborát vytištěný (událost tisku na kroku 5). U tréninkové zakázky úkoly zakázky a popis záměrné chyby.

**Část 2 – průvodce výrobním závodem (`/app` → `/plant/…`)**

- `IndustrialPlantOnboarding` je jen v průmyslové části (test oddělení světů – importy i texty bez půdorysů, bytů, vypínačů a Panel Builderu). Tlačítko „🧭 Průvodce závodem“ v horní liště (na stránce závodu otevře dialog hned, jinde přejde do závodu s `?pruvodce=1`; `?pruvodce=zavod` / `mise` rovnou režim). Na prázdném závodě (hned po registraci) karta se dvěma režimy na stránce – **ne automatický modální dialog**, ten by blokoval práci (a 8 E2E registrací závodu).
- **Režim A** zakládá skutečná data přes Studio výstavby (`saveStudioBuilding`): hala 54 × 30 m s výrobou a rozvodnou na volném místě mapy areálu, hlavní rozváděč nebo trafostanice (kVA → proud na straně 400 V) se jmenovitým proudem; první stroj / podružný rozváděč napájený z hlavního zdroje, jmenovitý odběr z kW (cos φ 0,9), PDF schéma přetažením (`/api/uploads`, vlastnictví souboru ověřené) nebo vzorové schéma `/demo-docs/plc-rozvadec-linka.pdf`, výchozí platná revize v1.0 (výchozí digitalizace bez změnového řízení). Jen s právem Studio výstavby.
- **QR štítek 20 × 20 mm a 40 × 40 mm**: nový formát tiskové stránky štítku (`/equipment/[id]/label?format=20|40`, `QrSquareLabel`) se stejným odkazem a kódem štítku jako 62 × 29 mm. Z kroku 3 rovnou karta stroje, Červenka (zadání změny), zálohy PLC a Kniha revizí (auditní report, je-li v tarifu; jinak záložka Revize stroje).
- **Režim B (mise)** běží v prohlížeči nad vzorovým závodem (nic se nezapisuje do dat firmy) se skutečnými výpočty: kniha PCSCHEMATIC rozváděče lisu (`renderPanelSheetSvg`, list 3 – silové schéma), klasifikace zásahu dle Nařízení (EU) 2023/1230 podle F-Signature zálohy (výměna stykače 1:1 = 🟢), simulátor `simulateAddedLoad` pro nový 60kW stroj (96,2 A kaskádou kabel → RH1 → TS-1) a výřez Knihy revizí.

**Část 3 – reálné fotky řad**

- Modal „Designové řady a barvy“ je v kódu `SeriesGallery.tsx` (zadání: `DesignSeriesModal.tsx`); náhled dílu je nová komponenta `SeriesPreviewIllustration.tsx`. Fotka má přednost před renderem (příznak `photo`), nahraná před staženou.
- **Harvester** `scripts/harvest-switch-photos.mjs` (`npm run catalog:photos`): objednací čísla z kusovníku (kryt spínače č. 1 / kompletní přístroj Decento, zásuvka 1N), vyhledání na oficiálním katalogu ABB pro ČR nizke-napeti.cz.abb.com, fotka jen se stejným objednacím číslem v názvu souboru (`3558A-A651_B.webp` = 3558A-A651 B), manifest `public/catalog-images/manifest.json` se zdrojem, stránkou výrobce a datem. **2026-11-11 web headless prohlížeč nepustil** (každá stránka net::ERR_HTTP2_PROTOCOL_ERROR, interaktivní prohlížeč stránky načte) – blokace se neobchází (žádné podvržené hlavičky ani obcházení protokolu), harvester skončí s hláškou a manifest zůstává prázdný. Adaptér jen pro ABB; monobloky Garant / Praktik / Variant+ nemají v kusovníku ověřené objednací číslo.
- **Nahrávač Ctrl+V / soubor / přetažení** jen pro přihlášený velín (`/superadmin`) – fotka se ukáže všem firmám, nahrávat ji smí jen provozovatel. Slot = Spínač 1R, Zásuvka 1R, Vícerámeček nebo dlaždice barvy (spínač v té barvě). Ukládá se do **trvalého úložiště `storage/catalog-images/`** (svazek Dockeru), ne do `public/` – obsah `public/` je v obrazu jen ze sestavení a Next.js soubory přidané za běhu neservíruje; servíruje `GET /api/catalog-images/file/…`, seznam `GET /api/catalog-images/manifest`. Obrázek se znovu zakóduje přes sharp do WebP (max. 1600 px, bez metadat; SVG a PDF odmítnuté).

**Část 4 – testy:** unit `floorplan-sandbox-preset`, `floorplan-live-checklist` (i tahák rozváděče), `catalog-photos` (manifest, úložiště přes sharp, přednost fotky), `phase92-separation` (oddělení světů), `services/panel-trainer` (3 zakázky bez kreditu, skříně, chyba a oprava linteru, trenažér a limity), `services/plant-onboarding` (hala, stroj s revizí, mise); E2E `e2e/phase92.spec.ts` (7).
