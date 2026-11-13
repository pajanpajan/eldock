# Zadání fáze 109 – 2D půdorys: viditelnost a barva značek, 3D náhled se stěnami, nábytek po kusech, výška u kuchyňské linky, panely ABB-free@home podle barvy a převod Klasická 230 V ⇄ Smart Home se zachováním variant

Vloženo z chatu 2026-11-13 (původně jako fáze 108; průmyslové zadání vložené mezitím dostalo přednost jako fáze 108). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Máme 7 konkrétních vizuálních a funkčních úprav v 2D půdorysu (`/panel-builder/floorplan`) a katalogu Smart Home podle přímého testování:

1) Zvýraznění schématických značek na 2D půdorysu + možnost přepnutí barvy značek (např. na kontrastní červenou pro závěrečnou kontrolu).
2) V 3D náhledu (`3D náhled a kontrola výšek`) vykreslit poloprůhledné stěny místností (cca 20 % opacity) do zadané výšky stropu a jasně barevně odlišit vypínače od světel a dalších prvků.
3) Po vložení jakéhokoliv prvku z kategorie `Okna, dveře a nábytek` nebo `Koupelna` automaticky ukončit vkládání (přepnout nástroj zpět na `Výběr`), aby uživatel nevkládal nábytek opakovaně.
4) Odstranit duplicitní `WC mísa / závěsné WC` ze záložky `Okna, dveře a nábytek` (zůstane pouze v záložce `Koupelna`).
5) Nastavit automatickou výškovou logiku pro zásuvky a vypínače umístěné nad kuchyňskou linkou, ostrůvkem a umyvadlem (automaticky `1150 mm` nad pracovní deskou místo `300 mm`).
6) Opravit náhledové obrázky, přepínání barev (Černá vs. Bílá) a přesná MPN u panelů `ABB-free@home®` (`RoomTouch 4"`, `Trevion 2,4"`, `SmartTouch 10"`, `OneTouch 7"`).
7) Přidat funkci automatického převodu mezi `Klasickou instalací 230 V` a `Chytrou domácností (Smart Home)` přes krátké vyskakovací okno s tím, že původní návrh zůstane v projektu trvale uložený jako přepínatelná varianta!

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 7 částech:

================================================================================
ČÁST 1: VYSOKÁ VIDITELNOST SCHÉMATICKÝCH ZNAČEK + PŘEPÍNAČ BARVY PRO KONTROLU
================================================================================

PROBLÉM: Na tmavém CAD podkladu a přes bílé čáry/šrafování stavebního výkresu jsou šedé schématické značky (`IP44`, `BUS 4x`, `ZAL_M`, značky zásuvek, vypínačů a světel) špatně viditelné.

OPRAVA v `/panel-builder/floorplan`:
1. **Výraznější vykreslení značek a popisků na plátně:**
   - Zvyš tloušťku čar (`strokeWidth`) všech schématických značek o 35 % (min. `2.2px` až `2.8px`).
   - Pod každou značku i její textový popisek (`IP44`, `BUS 4×`, `ZAL_M`, `-F1`) přidej kontrastní podkladový obrys / štítek (`paint-order: stroke fill; stroke: rgba(9, 13, 22, 0.92); stroke-width: 4.5px;` nebo poloprůhledný tmavý podklad pod značkou), aby symbol nikdy nesplýval s bílým šrafováním stěn pod ním!
2. **Přepínač barvy schématických značek v horní liště plátna (vedle posuvníku `Velikost značek`):**
   - Přidej ovládací prvek **`🎨 Barva značek:`** s rychlými volbami:
     * **`[ 🌈 Dle typu (Výchozí kontrastní) ]`** – jasné syté barvy podle kategorie (žádná tmavě šedá!).
     * **`[ 🔴 Červená (Kontrola) ]`** – VŠECHNY elektrické značky, popisky a vazby na výkresu se okamžitě vykreslí **zářivě červenou barvou (`#ff2e2e` s bílým/tmavým kontrastním lemem)** a podkladový výkres se jemně ztlumí, aby měl projektant při závěrečné kontrole 100% jistotu, že žádný prvek nepřehlédne!
     * **`[ 🟡 Neon žlutá ]`** (`#facc15`)
     * **`[ 🔵 Jasně modrá / Cyan ]`** (`#00f0ff`)
     * **`[ 🎨 Vlastní barva ]`** (`<input type="color" />` pro libovolnou barvu dle přání uživatele).

================================================================================
ČÁST 2: 3D NÁHLED – POLOPRŮHLEDNÉ STĚNY (20 %) DO VÝŠKY STROPU + JASNÉ BARVY PRVKŮ
================================================================================

Uprav modal / komponentu `3D náhled a kontrola výšek` (`FloorplanPseudo3DModal.tsx`):

1. **Vykreslení poloprůhledných 3D stěn místností (~20 % průhlednost) podle zadané výšky stropu:**
   - Pro každou místnost v půdorysu vykresli v 3D izometrii její **obvodové stěny vytažené od podlahy (`0 mm`) až do zadané výšky stropu (`ceilingHeightMm`, výchozí `2600 mm`)**!
   - Stěny vykresli jako poloprůhledné plochy s **~20% krytím (`fill: rgba(148, 163, 184, 0.20)`)** a jasnými obrysovými hranami u podlahy, v rozích a u stropu (`stroke: rgba(226, 232, 240, 0.55)`), včetně názvu místnosti na podlaze a průhledných otvorů oken (`parapet 900 mm` do `2300 mm`) a dveří (`0 mm` do `2000 mm`).
2. **Jasné barevné a tvarové odlišení prvků (konec splývání vypínačů a světel!):**
   - Změň paletu barev v 3D pohledu (i ve spodní legendě) tak, aby byla každá kategorie okamžitě rozpoznatelná:
     * **`🔵 Zásuvka`:** Jasně modrá (`#38bdf8`) – kroužek s modrou čárkovanou svislicí k podlaze.
     * **`🟢 Vypínač`:** Smaragdově zelená (`#10b981`) – **čtvercový / kosočtvercový symbol** s jasným bílým obrysem (už NIKDY oranžová, která splývala se žlutými světly!).
     * **`🟡 Svítidlo`:** Zářivě žlutá (`#fde047`) se světelnou září (glow efekt) a symbolem paprsků.
     * **`🟣 Rozváděč`:** Výrazná purpurová / fialová (`#d946ef`) – obdélníkový 3D box skříně na stěně.
     * **`🩵 Ovladač / Čidlo / Magnet`:** Tyrkysová / Cyan (`#06b6d4`) – trojúhelníkový/kruhový bod.
     * **`🔴 Spotřebič`:** Sytě červená / Korálová (`#f43f5e`).
     * **`⚪ Nábytek / Zařizovací předměty`:** Světle šedý 3D kvádr (`rgba(255,255,255,0.14)`) s popiskem (`Linka 900 mm`, `Postel`, `Vana`).

================================================================================
ČÁST 3: AUTOMATICKÉ „HOTOVO“ PO VLOŽENÍ NÁBYTKU A KOUPELNOVÝCH PRVKŮ + ODSTRANĚNÍ DUPLICITNÍHO WC
================================================================================

1. **Jednorázové vložení nábytku, oken, dveří a koupelnových prvků (Auto-reset na `Výběr`):**
   - Když uživatel v levé paletě vybere jakýkoliv prvek z kategorie **`🛋️ Okna, dveře a nábytek`** nebo **`🛁 Zařizovací předměty (Koupelna)`** ( případně **`⚡ Rozváděče`**) a kliknutím ho umístí do půdorysu:
     * **Okamžitě po vložení přepni aktivní nástroj zpět na `Výběr` (`select` / `activePaletteItem = null`)** a nově vložený prvek automaticky označ jako vybraný!
     * Uživatel tak může ihned upravit rozměr `X × Y` nebo otočení vloženého nábytku, aniž by při dalším kliknutí do výkresu omylem vložil druhou kuchyňskou linku nebo druhou vanu. Pokud chce vložit další kus, jednoduše na něj znovu klikne v levém menu.
2. **Odstranění duplicitního WC ze sekce `Okna, dveře a nábytek`:**
   - Ze seznamu položek v kategorii `🛋️ Okna, dveře a nábytek` odstraň položku **`WC mísa / závěsné WC (0,40 × 0,65 m)`**, protože WC už je správně zařazené v kategorii `🛁 Koupelna (Zařizovací předměty)`.

================================================================================
ČÁST 4: CHYTRÁ LOGIKA VÝŠKY ZÁSUVEK A VYPÍNAČŮ NAD KUCHYŇSKOU LINKOU A NÁBYTKEM
================================================================================

Naimplementuj v `/panel-builder/floorplan` automatickou prostorovou detekci výšky prvků u nábytku:
1. **Při vložení nebo přesunu zásuvky / vypínače ke kuchyňské lince, ostrůvku nebo umyvadlu:**
   - Pokud uživatel umístí nebo přesune běžnou zásuvku (`1N`, `2N`, `IP44`, `USB`, vícerámeček se zásuvkami) nebo vypínač/ovladač do půdorysného obdélníku (nebo do vzdálenosti `≤ 20 cm` od hrany) prvku **`Kuchyňská linka`**, **`Kuchyňský ostrůvek`** nebo **`Umyvadlo / Dvojumyvadlo`**:
     * Automaticky nastav výšku této zásuvky / vypínače na **`1150 mm`** (standardní výška nad pracovní deskou `900 mm`!), pokud měla výchozí podlahovou výšku `300 mm`!
     * Výjimka: Samostatné spotřebiče zapojené pod linkou (`Myčka`, `Trouba`, `Varná deska`, `Lednice`) si ponechají svou technologickou výšku pod deskou (`300–600 mm`).
2. **Při vložení nebo posunutí samotné Kuchyňské linky pod již osazené zásuvky:**
   - Pokud uživatel položí nebo posune `Kuchyňskou linku` na místo, kde už na stěně jsou běžné zásuvky ve výšce `300 mm`, automaticky je zvedni na **`1150 mm`** a zobraz krátké informační upozornění: *„📏 Zásuvky nad kuchyňskou linkou byly automaticky nastaveny do výšky 1150 mm (nad pracovní desku 900 mm).“*

================================================================================
ČÁST 5: OPRAVA NÁHLEDOVÝCH OBRÁZKŮ, BAREV A MPN U ABB-free@home® (`SmartHomeDeviceCatalog`)
================================================================================

PROBLÉM (`{C5A56358-DFED-4711-AF41-428C41111E9A}.png`):
- U karty `Dotykový panel ABB RoomTouch® 4"` je vybraná barva `Černá / antracit`, ale obrázek vlevo je bílý čtverec (`Blinds south`).
- U karty `Dotykový panel ABB Trevion® 2,4"` je jen prázdný šedý čtvereček a obě karty mají zástupné MPN (`2TMA310011B0003` / `2TMA310011B0001`).

OPRAVA:
1. U všech panelů a nástěnných ovladačů v katalogu **ABB-free@home®** a **ABB i-bus® KNX** zajisti, aby přepnutí barevné varianty (`Černá / antracit` vs. `Bílá` vs. `Stříbrná / Nerez`) **dynamicky přepínalo jak náhledový obrázek (`imageUrl` / věrný produktový render v dané barvě!), tak skutečné objednací číslo `MPN` a `EAN`**:
   - **Dotykový panel ABB RoomTouch® 4" (HD kapacitní displej s tenkým rámečkem):**
     * Varianta `Černá / antracit`: MPN **`2TMA310050B0001`** (`RT-F-4.0.1-B`, EAN `6955891816626`) -> zobraz realistický černý skleněný štíhlý panel s tmavým rozhraním ABB RoomTouch (ovládání žaluzií, teploty `22,5 °C` a osvětlení).
     * Varianta `Bílá`: MPN **`2TMA310050W0001`** (`RT-F-4.0.1-WL`, EAN `6955891816619`) -> zobraz bílý skleněný panel se světlým rámečkem.
   - **Dotykový displej ABB Trevion® 2,4" (55 × 55 mm pod rámeček Zoni / Levit / Time / solo):**
     * Varianta `Černá / matná černá`: MPN **`2CKA006220A0875`** (EAN `4011395326459`) -> zobraz detailní černý displej Trevion 2,4" v černém rámečku s rozsvíceným barevným displejem (teplota místnosti, ikony světel a scén) a kapacitní lištou.
     * Varianta `Bílá / studiová bílá`: MPN **`2CKA006220A0872`** (EAN `4011395326411`) -> zobraz bílý displej Trevion 2,4" v bílém rámečku.
   - Zkontroluj a stejně dynamicky napáruj barvy a MPN i u `ABB SmartTouch® 10"` (`2TMA310051B0001` černá / `2TMA310051W0001` bílá) a `ABB OneTouch™ 7"` (`2TMA130050B0001` černá / `2TMA130050W0001` bílá).

================================================================================
ČÁST 6: AUTOMATICKÝ PŘEVOD MEZI KLASICKOU 230 V A CHYTROU DOMÁCNOSTÍ (SE ZACHOVÁNÍM PŮVODNÍHO NÁVRHU!)
================================================================================

Vytvoř chytrý obousměrný převodník instalace (`src/lib/panel-builder/installation-mode-converter.ts` + modal `ConvertInstallationModal.tsx`):

1. **Tlačítko a přepínač variant návrhu v 2D půdorysu:**
   - V horní liště 2D půdorysu i v pravém panelu u volby `Úroveň instalace` přidej výrazné tlačítko:
     **`[ 🔄 Převést návrh: Klasická 230 V ⇄ Chytrá domácnost (Zachovat obě verze) ]`**.
2. **Krátké vyskakovací okno pro doplnění parametrů převodu (`ConvertInstallationModal.tsx`):**
   - Když má uživatel nakreslenou **Klasickou instalaci 230 V** a klikne na převod do **Chytré domácnosti**, vyskočí přehledné okno, kde během 10 vteřin upřesní:
     1) **Cílový systém Smart Home:** `ABB-free@home®` | `Loxone (Miniserver + Tree)` | `ABB i-bus® KNX` | `TapHome`.
     2) **Designová řada ovladačů:** (automaticky nabídne kompatibilní řadu, např. `ABB Zoni / Levit`, `Loxone Touch Pure`, `TapHome`).
     3) **Jak převést vypínače a světla (zaškrtávací volby):**
        * `[✓] Nahradit klasické vypínače 230 V (č. 1, 5, 6, 7) sběrnicovými tlačítky 24 V DC`
        * `[✓] Sloučit vícenásobné vypínače u dveří (např. světlo + žaluzie) do jednoho vícerámečku / vícekanálového tlačítka`
        * `[✓] Přepočítat trasy světel a žaluzií na přímé hvězdicové větve do rozváděče + sběrnicovou linku 24 V DC`
        * `[ ] Volitelně: Nastavit hlavní světla v obytných místnostech jako stmívatelná (přidat stmívací aktor)`
        * `[ ] Volitelně: Doplnit do chodeb a koupelen stropní PIR čidla přítomnosti`
   - Pokud uživatel převádí **opačně (`Chytrá domácnost ➔ Klasická instalace 230 V`)**, okno se zeptá na cílovou designovou řadu 230V vypínačů (např. `ABB Levit`) a automaticky převede sběrnicová tlačítka zpět na klasické vypínače (řazení 1, 5, 6 u 2 ovladačů v místnosti, řazení 7 u 3+ ovladačů) a žaluziové spínače, a přepočítá trasy na klasické okruhy!
3. **ZACHOVÁNÍ PŮVODNÍHO NÁVRHU (PŘEPÍNATELNÉ VARIANTY V PROJEKTU):**
   - Při potvrzení převodu **NIKDY nepřepisuj původní návrh natvrdo**!
   - Ulož původní návrh do pole `projectVariants` v projektu půdorysu a nad plátnem zobraz čistý přepínač uložených variant téže zakázky:
     **`Varianta návrhu: [ ⚡ Varianta 1: Klasická 230 V (Původní) ] ⇄ [ 🤖 Varianta 2: Smart Home – ABB-free@home® ]`** (+ ukazatel rozdílu metráže kabelů a ceny!).
   - Elektrikář nebo projektant tak může jedním klikem přepínat mezi původní klasickou elektroinstalací a přepočítanou chytrou domácností, vygenerovat pro každou z nich rozváděč i cenovou nabídku a ukázat zákazníkovi přesné srovnání!

================================================================================
ČÁST 7: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit testy ověřující:
   - Že převodník `convertInstallationMode` správně převede klasický půdorys na Smart Home (vypínače -> sběrnicová tlačítka, trasy -> hvězdice + sběrnice, přidání Smart Home aktorů) A ZÁROVEŇ zachová původní návrh v `projectVariants` pro okamžité přepnutí zpět.
   - Že umístění běžné zásuvky nad `Kuchyňskou linku` automaticky nastaví výšku `1150 mm`.
   - Že v kategorii `Okna, dveře a nábytek` již není duplicitní položka `WC`.
   - Že u `ABB RoomTouch 4"` a `ABB Trevion 2,4"` přepnutí barvy `Černá` vs. `Bílá` vrací odpovídající barevný obrázek a MPN.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Bez migrace databáze – varianty zakázky se ukládají v nákresu půdorysu (JSON).

**1. Viditelnost značek a 🎨 Barva značek** (`src/lib/panel-builder/symbol-colors.ts`, `useSymbolColor.ts`):

- Na plátně editoru mají značky o 35 % silnější čáry, na obrazovce aspoň 2,4 px (přepočet mm plánu na pixel podle jednotky
  zobrazení).
- Pod značkou i popiskem je tmavý podkladový štítek `rgba(9, 13, 22, 0.92)` (aspoň 4,5 px, `paint-order: stroke`).
- Přepínač „🎨 Barva značek:“ je vedle posuvníku „Velikost značek“ (kroky 2–4 průvodce i kompaktní lišta) a v kroku 5
  (závěrečná kontrola):
  - 🌈 Dle typu (výchozí) – syté barvy kategorií: zásuvky modře, datové fialově, vypínače zeleně, ovladače a čidla
    tyrkysově, svítidla žlutě, rozváděč purpurově, spotřebiče korálově; nad bílým výkresem tmavší odstíny;
  - 🔴 Červená (Kontrola) `#ff2e2e` – všechny značky, popisky, trasy i vazby vypínač → světlo červeně a podklad
    (výkres, místnosti, poznámky) se ztlumí;
  - 🟡 Neon žlutá `#facc15`, 🔵 Cyan `#00f0ff` a 🎨 vlastní barva (`input type="color"`).
- Volba se pamatuje v prohlížeči (je to pohled projektanta). Tiskový výkres a exporty zůstávají černobílé podle ČSN.

**2. 3D náhled** (`FloorplanPseudo3DModal.tsx`):

- Stěny místností od podlahy do výšky stropu `ceilingHeightMm` (výchozí 2 600 mm) s výplní `rgba(148, 163, 184, 0.20)`
  a hranami `rgba(226, 232, 240, 0.55)` u podlahy, v rozích a u stropu.
- Název místnosti je na podlaze. Okna (parapet 900 → 2 300 mm) a dveře (0 → 2 000 mm) jsou průhledné otvory jen
  obrysem.
- Prvky barvou i tvarem:
  - 🔵 zásuvka – kroužek se svodem k podlaze;
  - 🟢 vypínač – kosočtverec s bílým obrysem;
  - 🟡 svítidlo – září a paprsky;
  - 🟣 rozváděč – skříň;
  - 🩵 ovladač, čidlo, termostat a magnet – trojúhelník;
  - 🔴 spotřebič.
- Nábytek je světlý poloprůhledný kvádr s popiskem („Kuchyňská linka 900 mm“). Legenda je pod náhledem.
- Termostaty a sběrnicová čidla se ve scéně počítají jako ovladače (dřív zeleně jako vypínače).

**3. Nábytek po kusech a WC:**

- Okna, dveře, nábytek, koupelna a rozváděče se vkládají po jednom kusu (`placesOnce`). Po kliknutí do půdorysu se
  nástroj vrátí na Výběr a vložený kus zůstane vybraný (rozměr X × Y, natočení).
- WC mísa / závěsné WC je jen v Koupelně (zařizovací předměty). Id `arch-wc` zůstává kvůli uloženým půdorysům.

**4. Výška u pracovní desky** (`src/lib/panel-builder/counter-heights.ts`):

- Zásuvka (1N, 2N, IP44, USB …) nebo vypínač / ovladač ve výchozí výšce, který leží v kuchyňské lince, ostrůvku,
  umyvadle či dvojumyvadle nebo do 20 cm od jejich hrany, se při vložení i přesunu zvedne na 1 150 mm.
- Vložená nebo posunutá linka zvedne zásuvky, které nad ní už jsou, s upozorněním podle zadání.
- Spotřebiče pod linkou (myčka, trouba, varná deska, lednice) si technologickou výšku nechávají.
- Prvek s ručně zadanou výškou se nemění.

**5. Panely ABB-free@home:**

- Karta katalogu u panelů s barevnými variantami ukazuje vždy věrný render ve zvolené barvě. Fotka výrobce je jedna
  na výrobek bez barvy – u RoomTouch® 4" ukazovala bílý panel i při zvolené černé.
- RoomTouch® je štíhlé sklo: černé s tmavým rozhraním, bílé se světlým rámečkem. Trevion® 2,4" má rámeček i displej
  v barvě varianty, rozsvícený barevný displej (teplota, světla, scény) a kapacitní lištu.
- Objednací číslo a typ se přepínají s barvou. U SmartTouch® 10" i OneTouch 7" mají obě barvy vlastní číslo.
- **Odchylka – čísla ze zadání ověřená proti katalogu výrobců v repozitáři (`prisma/external-catalog/catalog.json`):**
  - RoomTouch® 4" `2TMA310050B0001` / `W0001` (RT-F-4.0.1) v katalogu nejsou → ověřená `2TMA310011B0003`
    (RT/U12.86.1-825, černá) a `2TMA310011W0001` (RT/U12.86.1-811, bílá);
  - „Trevion“ `2CKA006220A0875` / `A0872` jsou podle katalogu ovladače ABB-Tenton® (12násobný a 6násobný s termostatem)
    → Trevion černý 55 × 55 mm `2TMA310011B0001` (SD/U12.55.1-825), 63 × 63 mm `2TMA310011B0002`; bílý Trevion
    v katalogu není → „ověřte u výrobce“;
  - OneTouch 7" `2TMA130050B0001` / `W0001` v katalogu nejsou → `2TMA320051B0001` / `W0001` (M2249-2B / -2W);
  - SmartTouch® 10" `2TMA310051B0001` / `W0001` souhlasí;
  - EAN ze zadání v oficiálních datech nejsou (katalog ani data ETIM v repozitáři je nemají) → neuvádějí se.

**6. Převod Klasická 230 V ⇄ Chytrá domácnost** (`installation-mode-converter.ts`, `ConvertInstallationModal.tsx`,
`ProjectVariantBar.tsx`):

- Tlačítko „🔄 Převést návrh: Klasická 230 V ⇄ Chytrá domácnost (Zachovat obě verze)“ je v horní liště (kroky 3–4,
  kompaktní lišta) a v pravém panelu u „Úroveň instalace“.
- Převod do Smart Home – okno s cílovým systémem (ABB-free@home®, Loxone, ABB i-bus® KNX, TapHome), designovou řadou
  podle systému a volbami ze zadání:
  - vypínače 230 V (č. 1, 5, 6, 7, tlačítka, stmívač, žaluziový spínač, PIR) → sběrnicová tlačítka a prvky 24 V DC;
    termostaty a bezdrátové prvky převede dosavadní převod úrovní (`convertForLevel`);
  - tlačítka světel u jedněch dveří (do 35 cm) → jedno vícekanálové tlačítko se sloučeným párováním;
  - světlo + žaluzie → společný víceramček (párování žaluzie zůstane platné);
  - hvězda + sběrnice = úroveň „Plně sběrnicová“; bez ní hybrid / retrofit (kabeláž a vypínače zůstanou);
  - volitelně stmívatelná hlavní světla obytných místností a stropní čidla přítomnosti v chodbách a koupelnách.
- Zpětný převod: okno se zeptá na designovou řadu 230 V. Tlačítka dostanou řazení podle počtu ovládacích míst světla:
  1 místo = 1 (dvě skupiny světel = 5, stmívané světlo = stmívač), 2 místa = 6, 3 a více = 6 na krajích a 7 uprostřed.
  Žaluziová tlačítka → žaluziové spínače, PIR, termostaty. Prvky bez klasické náhrady (dotykové panely, čidla) se
  odeberou. Ruční úpravy tras se u převedené varianty vynulují (trasy se přepočítají).
- Původní návrh se nikdy nepřepíše:
  - uloží se jako varianta do `projectVariants` v nákresu (snímek prvků a rámečků všech podlaží, úrovně, systému,
    řady, barev a tras);
  - místnosti, podklad a ostatní nastavení zakázky jsou společné;
  - nejvýš 4 varianty kvůli limitu velikosti uloženého půdorysu (900 kB).
- Nad plátnem je přepínač „Varianta návrhu: [ ⚡ Varianta 1: Klasická 230 V (Původní) ] ⇄ [ 🤖 Varianta 2: Smart Home –
  ABB-free@home® ]“. Uloženou variantu jde odebrat. Rozváděč, kusovník i cenová nabídka se generují z aktivní varianty.
- Ukazatel rozdílu:
  - metráž kabelů z výkazu kabeláže;
  - cena práce a revize podle normohodin × 650 Kč/h z generátoru nabídky (fáze 105);
  - **odchylka:** bez materiálu – ceníkové ceny přístrojů v datech chybějí; materiál ocení cenová nabídka.

**7. Testy:**

- `src/lib/panel-builder/phase109.test.ts` (12): převod do Smart Home s variantou a přepnutím (i po uložení a načtení),
  volby, zpětný převod s řazením, ukazatel; WC a vkládání po kusech; výška u linky; barvy značek a tloušťka; 3D otvory
  a druhy; panely ABB podle barvy (render i číslo, žádná neověřená čísla).
- E2E `e2e/phase109.spec.ts` (3): barva značek a 3D náhled; převod Smart Home ⇄ Klasická 230 V se třemi variantami
  a přepnutím; nábytek po kusech, WC a panely ABB.
- Upravený test fáze 90 (WC jen v Koupelně).
