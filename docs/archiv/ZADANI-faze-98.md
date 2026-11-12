# Zadání fáze 98 – fázový průvodce 2D půdorysu a stejná fázová filozofie v AI Panel Builderu a ELDOCK Průmysl

Vloženo z chatu 2026-11-11 (během fáze 97, zařazeno hned po ní ve stejné relaci – stejné soubory editoru, kusovníku,
palety a dokumentace). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Podívej se na současný stav `/panel-builder/floorplan`: v pravém sloupci je pod sebou naskládaných 10 obřích boxů (stránka je 4× vyšší než monitor) a v levé paletě svítí všech 8 kategorií najednou, zatímco na plátně se přes sebe kříží zásuvky, světla, kabely i nábytek.

Chceme celý 2D návrh půdorysu (a následně i celý projekt eldock.cz) postavit jako **čistého, intuitivního a „blbuvzdorného“ fázového průvodce**, kde uživatel v každé fázi vidí v levé paletě, na plátně i v pravém panelu **VÝHRADNĚ nástroje a vrstvy pro danou fázi** (s možností kdykoliv volně přecházet tam i zpět mezi fázemi).

Zapiš tuto klíčovou architektonickou změnu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: NOVÉ ROZFÁZOVÁNÍ 2D PŮDORYSU DO 5 LOGICKÝCH FÁZÍ (`/panel-builder/floorplan`)
================================================================================

Přepracuj průvodce 2D půdorysu na těchto **5 jasných, logických fází** (v horní liště velký kontrastní Stepper `1` ➔ `2` ➔ `3` ➔ `4` ➔ `5`, mezi kterými lze kdykoliv kliknutím přecházet tam i zpět bez ztráty dat, + dole a nahoře jasná tlačítka `[ ← Předchozí fáze ]` a `[ Další fáze: ... → ]`):

1. **FÁZE 1: `1. Půdorys a místnosti` (Stavební podklad)**
   - **Co uživatel dělá:** Nahraje podklad (`PDF / DXF / DWG / BIM .ifc / Obrázek`) a zkalibruje měřítko, NEBO nakreslí místnosti (`Vytvořit místnost X × Y`, `Kreslit obdélník myší`, `Kreslit šikmou stěnu / polygon`), nastaví rozměr plochy a podlaží (`1. NP`, `+ Přidat podlaží`).
   - **Co je v Levé paletě:** Pouze nástroje pro podklad, kalibraci měřítka a rychlé vytváření místností `X × Y`. (Žádné zásuvky, světla ani spotřebiče!).
   - **Co je na Plátně:** Čistý půdorys / místnosti s kótami a výměrou v m².
   - **Co je v Pravém panelu:** Pouze `Seznam místností a podlaží` + `Detail vybrané místnosti` (změna názvu, rozměrů X × Y, konstrukce stěn *Zdivo / SDK / Dřevostavba* a prostředí).

2. **FÁZE 2: `2. Rozváděč, okna, dveře a vybavení` (Rozmístění jádra a interiéru)**
   - **Co uživatel dělá:** Umístí hlavní domovní rozváděč (`RH` / podružný `RP` / stoupačku) a volitelně do stěn osadí **okna a dveře**, do koupelny **vanu, sprchu, umyvadlo, WC** (pro automatické ochranné zóny ČSN 33 2000-7-701 a ČSN 33 2130 ed. 4) a do pokojů **nábytek** (postele, gauč, kuchyňskou linku, stoly se změnou velikosti aktivním rohem `X × Y`).
   - **Co je v Levé paletě:** POUZE 3 kategorie (automaticky rozbalené a přehledné):
     * `⚡ Rozváděče` (`Hlavní domovní rozváděč RH`, `Podružný RP`, `Stoupací vedení`)
     * `🛁 Zařizovací předměty (koupelnové zóny)` (`Vana`, `Sprcha`, `Umyvadlo`, `Dvojumyvadlo`, `WC`)
     * `🛋️ Okna, dveře a nábytek` (`Okna`, `Dveře L/P`, `Postele`, `Gauč`, `Stoly`, `Kuchyňská linka`, `Skříň`)
   - **Co je na Plátně:** Místnosti, rozváděč `RH`, okna, dveře, nábytek a koupelnové ochranné zóny.
   - **Co je v Pravém panelu:** Pouze `Detail vybraného prvku` (rozměry `X × Y`, otočení, otevírání dveří L/P, nastavení přívodu rozváděče `3× 230/400 V TN-S / TN-C-S` a typu prostoru *Byt / Obchodní centrum BD4 / Zdravotnictví Skupina 1*).

3. **FÁZE 3: `3. Zásuvkové okruhy a spotřebiče` (Silnoproudé napájení)**
   - **Co uživatel dělá:** Osazuje domovní zásuvky (jednozásuvky, dvojzásuvky, IP44, datové RJ45, TV) a samostatné spotřebiče s vlastním jisticím okruhem (varná deska, trouba, myčka, pračka, sušička, bojler, TČ, FVE, wallbox).
   - **Co je v Levé paletě:** POUZE 2 kategorie + `Sestavy ve vícerámečku`:
     * `🔌 Zásuvky`
     * `🔥 Spotřebiče (vlastní jisticí okruh)`
   - **Co je na Plátně (Chytrý filtr vrstev!):**
     * Místnosti, nábytek a koupelnové zóny jsou viditelné jako jemný orientační podklad (aby uživatel přesně viděl, kde je postel, stůl nebo kuchyňská linka).
     * **100% ostře a kontrastně svítí POUZE zásuvky, spotřebiče a jejich obvodové kabelové trasy!** (Pokud už uživatel dříve osadil světla a vypínače, ve Fázi 3 jsou jejich kabely skryté a značky světel jemně potlačené na 25 % opacity, aby vůbec nepřekážely!).
   - **Co je v Pravém panelu:** Pouze:
     * `Detail vybrané zásuvky / spotřebiče` (výška v mm, hloubka krabičky KOPOS, okruh),
     * `🔌 Zásuvkové okruhy` (automatické seskupování do okruhů po max. 10 zásuvkách dle ČSN 33 2130 ed. 4 nebo ruční sloučení/rozdělení okruhů),
     * Případné varování koupelnové zóny pro zásuvky.

4. **FÁZE 4: `4. Světla, vypínače a chytrá domácnost` (Osvětlení, ovládání a design)**
   - **Co uživatel dělá:** Zvolí úroveň instalace (`Klasická 230 V` / `Sběrnicová Smart Home` / `Retrofit`), vybere výrobce, designovou řadu a barvu vypínačů (ABB, Schneider, Legrand, Hager, Loxone, TapHome) a do místností osadí **světla** (včetně stmívání/RGBW), **vypínače / tlačítka** a **stínící techniku / čidla** (žaluzie, PIR, okenní kontakty, termostaty).
   - **Co je v Levé paletě:** POUZE kategorie pro osvětlení a ovládání:
     * `💡 Světla` (stropní, nástěnná, bodová, LED pásky, nouzová)
     * `🔘 Vypínače 230 V` / `🎛️ Sběrnicové ovládání (24 V DC – KNX / Loxone / free@home / TapHome)`
     * `🪟 Stínící technika, čidla a vytápění` (žaluzie, okenní magnety, PIR čidla, termostaty)
   - **Co je na Plátně (Chytrý filtr vrstev!):**
     * **Kabelové trasy zásuvek se ve Fázi 4 automaticky skryjí** (samotné ikony zásuvek a nábytku zůstanou jemně viditelné na 30 %, abys nepoložil vypínač přes zásuvku nebo skříň)!
     * **100% ostře svítí POUZE světla, vypínače, žaluzie, čidla, vazby vypínač ➔ světlo (řazení 1, 5, 6, 6+6, 7) a světelné / sběrnicové trasy!** Výkres je díky tomu dokonale čistý a přehledný!
   - **Co je v Pravém panelu:** Pouze:
     * Kompaktní karta `🎨 Zvolený systém a design vypínačů` (s tlačítkem pro otevření galerie řad a barev),
     * `Detail vybraného světla / vypínače / čidla` (spárování vypínače se světlem, zaškrtnutí *Stmívatelné / RGBW*, hloubka krabičky KOPOS),
     * Pokud je aktivní Smart Home / stmívání: panel `🤖 Chytrá domácnost – akční členy do rozváděče`.

5. **FÁZE 5: `5. Trasy kabelů, Kusovník a Rozváděč` (Finální kontrola a výstupy)**
   - **Co uživatel dělá:** Zkontroluje kompletní obvodové trasy kabelů (příp. posune úseky myší nebo přepne *Spodem v podlaze / Vrchem v podhledu / Optimalizovaně*), zkontroluje `Kontrolu půdorysu a norem`, prohlédne si `Kusovník (BOM + krabičky KOPOS)`, vyexportuje PDF / DXF výkres a jedním klikem vygeneruje hotový rozváděč!
   - **Co je v Levé paletě:** Rychlý filtr viditelnosti vrstev na plátně (`[ 👁️ Všechny okruhy ]`, `[ 🔌 Jen zásuvky a spotřebiče ]`, `[ 💡 Jen světla a vypínače ]`, `[ 🪟 Jen stínění a Smart Home ]`), přepínač směrování (`Spodem` / `Vrchem` / `Optimalizovaně`) a tlačítka exportů (`PDF A3/A4`, `CAD DXF/DWG`).
   - **Co je na Plátně:** Kompletní výkres s aktivním zvýrazňováním vybraného okruhu a možností ručního posunu tras v ose X/Y.
   - **Co je v Pravém panelu:**
     * `⚠️ Kontrola půdorysu a norem (ČSN 33 2130 ed. 4 / ČSN 33 2000-7-701)`,
     * `⚡ Založit / Vygenerovat rozváděč z tohoto půdorysu` (hlavní žluté CTA tlačítko nahoře na očích!),
     * `📏 Výkaz kabeláže a okruhů` (s tlačítkem `👁️` u každého okruhu),
     * `📋 Kusovník domovní instalace (BOM + doporučené krabičky KOPOS)`.

================================================================================
ČÁST 2: KONEC NEKONEČNÉHO ROLOVÁNÍ STRÁNKY (100VH CAD WORKSPACE LAYOUT)
================================================================================

Oprav rozvržení obrazovky `/panel-builder/floorplan`:
- Pravý sloupec už NIKDY nesmí natahovat celou webovou stránku na 3000–4000 px pod úroveň kreslicího plátna!
- Uzamkni pracovní plochu editoru (Levá paleta + Středové 2D plátno + Pravý kontextový panel) do čistého **CAD rozvržení na výšku obrazovky** (`min-h-[680px] lg:h-[calc(100vh-175px)]`), kde:
  * **Středové 2D plátno** je vždy 100% viditelné uprostřed obrazovky.
  * **Levá paleta** a **Pravý panel** mají svůj vlastní plynulý vnitřní scroll (`overflow-y-auto`) a díky filtrování podle Fáze 1–5 obsahují vždy jen 1 až 3 přehledné karty, takže se většinou vejdou na obrazovku bez nutnosti rolovat!
- V přepínači `Kompaktní lišta (Bez průvodce)` umožni zkušenému uživateli přepnout levý/pravý panel volbou `[ Zobrazit vše ]`, pokud si přeje vidět všechny kategorie najednou, ale i tehdy zachovej pevnou výšku pracovního okna, aby plátno nikdy nezmizelo z obrazovky.

================================================================================
ČÁST 3: STEJNÁ FÁZOVÁ FILOZOFIE V AI PANEL BUILDERU A PRŮMYSLOVÉM ELDOCKU
================================================================================

Sjednoť tento čistý fázový přístup napříč celým projektem `eldock.cz`:
1. **V AI Panel Builderu (`/panel-builder/[id]`):**
   - Ujisti se, že horní krokový průvodce rozváděče má stejně výrazný, jednotný vizuální styl a v každém kroku (`1. Osazení DIN lišt & Skříň` ⇄ `2. Strom zapojení, Fáze & Linter` ⇄ `3. Výpočet oteplení IEC 60890` ⇄ `4. Dokumentace, Kusovník & Štítky`) zobrazuje na obrazovce pouze nástroje příslušné fáze bez vizuálního šumu.
2. **V ELDOCK Průmysl (`/` Správa výrobních závodů):**
   - Přidej nad pracovní plochu čistý fázový přepínač pro průmyslové uživatele:
     * `1. Mapa závodu & BIM (.ifc)` (2D mapa areálu, vrstvy Síť / DA / UPS, import BIM)
     * `2. Rozváděče, Stroje & QR štítky` (seznam a karty rozváděčů/strojů, tisk QR štítků)
     * `3. Schémata, Červenka & Zálohy PLC` (prohlížeč výkresů, červené zákresy a verzování SW)
     * `4. Kniha revizí, Legislativa & Simulátor` (termíny revizí, Nařízení EU 2023/1230 a What-If simulátor zátěže)
   - Přepnutím fáze se obrazovka okamžitě vyčistí a ukáže jen danou agendu (s možností volného přechodu mezi fázemi).

================================================================================
ČÁST 4: AKTUALIZACE „ŽIVÉHO TAHÁKU“ PODLE NOVÝCH 5 FÁZÍ + TESTY A DEPLOY
================================================================================

1. Uprav `FloorplanLiveChecklist.tsx` (Tahák zakázky) tak, aby přesně kopíroval nových 5 fází (`1. Půdorys a místnosti` -> `2. Rozváděč, okna, dveře a nábytek` -> `3. Zásuvkové okruhy a spotřebiče` -> `4. Světla, vypínače a Smart Home` -> `5. Kontrola, Kusovník a Rozváděč`) a kliknutí na položku v taháku rovnou přepnulo editor do příslušné fáze!
2. Napiš unit a E2E testy ověřující:
   - Že přepnutí mezi Fází 1, 2, 3, 4 a 5 v `/panel-builder/floorplan` vyfiltruje levou paletu i pravý panel přesně na nástroje dané fáze.
   - Že ve Fázi 3 (Zásuvky) jsou světelné trasy potlačené/skryté a ve Fázi 4 (Světla a vypínače) jsou skryté zásuvkové kabelové trasy, zatímco samotný půdorys, nábytek a rozváděč zůstávají viditelné.
   - Že uživatel může kdykoliv skočit z Fáze 4 zpět do Fáze 2 nebo 3, upravit prvek a vrátit se do Fáze 5 bez ztráty dat.
3. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**2D půdorys – fáze (`src/lib/panel-builder/floorplan-phases.ts`, čisté funkce):**

- Fáze = krok průvodce z fáze 89/90 (`FloorplanPhase = WizardStep`, stav dál `useWizardStep` v relaci prohlížeče);
  `WIZARD_STEPS` mají nové názvy fází a tlačítka „Další fáze: … →“, přibylo „← Předchozí fáze“ v liště i pod plátnem
  (`PhaseNav`). Fáze mění jen uživatel – karta, Předchozí / Další, bod taháku, odznak designu (→ fáze 4), výběr nástroje
  z taháku nebo trenažéru (`pickPaletteTool` přepne do fáze skupiny palety) a kapitola video-návodu
  (`stepForTutorialChapter`: podklad 1, design 4, osazení 3, trasy 5, kusovník 5); nikdy akce nad nákresem.
- Levá paleta: `PHASE_PALETTE` (fáze 2 rozváděče, zařizovací předměty, okna / dveře / nábytek a zdravotnictví; fáze 3
  zásuvky a spotřebiče; fáze 4 světla, ovladače a stínění / čidla / topení), skupiny fáze se samy rozbalí
  (`PaletteAccordion autoOpen`), sestavy ve víceramečku jen ve fázích 3 a 4. Fáze 1 má v levém sloupci podklad,
  kalibraci, místnosti X × Y, kreslení a podlaží (`phase-tools-1`), fáze 5 rychlý filtr vrstev, trasy kabelů
  (směrování, uložení, výšky) a exporty (`phase-tools-5`).
- Plátno: `elementLook` – aktivní skupiny 100 % a klikatelné, ostatní potlačené a neklikatelné (`pointer-events: none`):
  fáze 1 všechny prvky na 12 % (místnosti jsou hlavní vrstva), fáze 2 ostatní na 20 %, fáze 3 světla a ovladače na 25 %,
  nábytek a zařizovací předměty jako jemný podklad 45 %, rozváděč 85 %, fáze 4 zásuvky a nábytek na 30 %, rozváděč 85 %.
  Trasy `routeVisible`: fáze 1–2 bez tras, fáze 3 jen zásuvky / spotřebiče / data (světelné trasy i spojnice
  vypínač–světlo skryté), fáze 4 jen světla, stínění a sběrnice (zásuvkové trasy skryté), přívod podružného rozváděče
  ve fázích 3–5; fáze 5 celý výkres s filtrem vše / zásuvky / světla / stínění a Smart Home (`LAYER_FILTERS`), mimo
  filtr se potlačí i značky (`filterLook`).
- Pravý panel: `PHASE_PANELS` – fáze 1 seznam místností a podlaží + detail (+ hladiny CAD), fáze 2 přívod (3×230/400 V,
  TN-S / TN-C-S) a typ prostoru + detail, fáze 3 detail, zásuvkové okruhy a varování zón, fáze 4 kompaktní karta
  designu (úroveň instalace, výrobce / řada / barva, galerie) + detail + akční členy chytré domácnosti, fáze 5 žluté
  „⚡ Založit / Vygenerovat rozváděč“ nahoře, kontrola norem, soupis okruhů s 👁️, kabeláž, upravené trasy, kusovník.
  **Odchylka:** detail vybraného prvku je ve všech fázích (výběr musí být vidět, i když ho zadání u fáze 5 nejmenuje)
  a varování zón, krytí, krabiček a víceramečků mimo katalog řady (karta jen se zjištěním) je i ve fázi 4 – vypínač
  v zóně 1 koupelny nebo stmívač v mělké krabici se opraví hned při osazení, ne až v kontrole fáze 5.
- Horní lišta fáze: fáze 1 plocha / měřítko, fáze 2–4 výběr a velikost značek, fáze 3–4 nabídka „📦 Instalační krabice“,
  fáze 5 výběr. Kompaktní CAD lišta: přepínač „☑ Zobrazit vše“ (výchozí = vše najednou, vypnuto = filtr aktuální fáze),
  pevná výška rozvržení zůstává.
- Rozvržení CAD na výšku okna `xl:h-[calc(100vh-175px)] xl:min-h-[680px]` (ne `lg:` – tři sloupce začínají až od `xl`,
  1280 px; pod tím jsou sloupce pod sebou a stránka se posouvá normálně), levý i pravý sloupec s vlastním posuvníkem,
  plátno vyplní střední sloupec a je vždy celé vidět. Výběry úrovně instalace a uložení kabelů se v úzkém sloupci zalomí
  (dřív přetékaly kartu designu).
- Živý tahák (`floorplan-live-checklist.ts`, `FloorplanLiveChecklist.tsx`): 5 bodů = 5 fází (`CHECKLIST_PHASES`),
  bod aktivní fáze zvýrazněný, klik na bod přepne fázi; „Změnit řadu/barvu“ u bodu 4, kusovník a generování u bodu 5.

**AI Panel Builder (`src/lib/panel-builder/panel-phases.ts`, `PanelSteps.tsx`):**

- 4 fáze nad stávajícími stránkami (adresy beze změny): 1 = 1a osazení DIN lišt (fotka / soupis / od nuly) + 1b skříň
  rozváděče, 2 = strom zapojení s fázemi L1 / L2 / L3, 3 = výpočet oteplení, 4 = 4a dokumentace a kusovník (PDF) +
  4b štítky. Krokové karty ve stejném stylu jako 2D půdorys (sdílené `components/phases/phase-style.ts` a `PhaseLinkCards`),
  u fází se dvěma částmi přepínač 1a / 1b a 4a / 4b se stavem ✓ Hotovo / Rozpracováno, nápověda fáze, Předchozí / Další
  nahoře i dole. Každá stránka dál ukazuje jen svou agendu.
- „Linter“ ve fázi 2: nad stromem zapojení souhrn Elektro-linteru z uloženého projektu (`TreeLinterSummary`,
  `projectLintIssues`); odznak linteru s opravou jedním klikem zůstává u DIN lišt v části 1a – opravy mění osazení
  (chránič, póly, další lišta) a patří k němu, souhrn ve fázi 2 na ně odkazuje.
- Čísla kroků v textech přečíslována (blokace propuštění, úkoly tréninkových zakázek, tahák rozváděče, odkazy na skříň);
  kapitoly video-návodu AI Panel Builderu nesou čísla z namluveného videa (bez nového natočení se nemění).

**ELDOCK Průmysl (`src/lib/plant-phases.ts`, `/plant/[id]`):**

- „`/` Správa výrobních závodů“ = pracovní plocha závodu, kam vede `/app` (`/plant/[id]`); veřejná úvodní stránka `/`
  se nemění. Agenda je v adrese `?faze=2…4` (bez parametru fáze 1) – sdílení, Zpět v prohlížeči, server načte jen data
  agendy (mapa a napájení ve fázi 1, prediktivní údržba a kabelový strom ve fázi 4).
- 1 Mapa závodu & BIM: souhrn závodu, mapa areálu s vrstvami napájení, založení závodu / budovy a import BIM (.ifc) jen
  tady; 2 Rozváděče, Stroje & QR štítky: karty zařízení ve skupinách rozváděče / stroje / ostatní se stavem dokumentace
  a tiskem QR štítku (`/equipment/[id]/label`); 3 Schémata, Červenka & Zálohy PLC: platné schéma, otevřené změny
  s červeným zákresem a aktivní zálohy SW (odkazy na záložky karty `?tab=schema|history|software`); 4 Kniha revizí,
  Legislativa & Simulátor: hlídač elektrorevizí s odkazy na revize a Knihu revizí, karta Nařízení (EU) 2023/1230
  (stroje, otevřené podstatné změny čl. 18, zálohy Safety PLC, dny do 20. 1. 2027) a What-If simulátor zátěže nad
  zvoleným rozváděčem (`LoadSimulator` z karty přívodního kabelu).
- Karty agend nesou živý stav (budovy a zařízení, rozváděče a stroje, schémata / zákresy / zálohy, revize k řešení
  a podstatné změny) a fajfku, když v agendě nic nečeká (`plantPhaseStatus`).

**Opravy z E2E testů:** výkres ve sloupci na výšku okna je ukotvený nahoru a vodorovně na střed (`preserveAspectRatio
xMidYMin meet` – nepřeskakuje při změně výšky okna), posun kolečkem a tažením počítá měřítko z matice SVG; „⚡ Vygenerovat
rozváděč“ z taháku nebo horní lišty mimo fázi 5 přepne do fáze 5 (kontrola před generováním a formulář rozváděče jsou
v kartě kabeláže); režim „jen jedna kategorie“ funguje i v automaticky rozbalené paletě fáze; katalog chytré domácnosti
v kartě designu skládá karty podle šířky místa (container queries, v pravém panelu pod sebou); krokové karty 2D půdorysu
mají základ šířky podle názvů fází (pravá část lišty se zalomí, karty bez posuvníku i při 1920 px).

**Testy:** `src/lib/panel-builder/phase98.test.ts` (fáze půdorysu: paleta, panel, vzhled prvků, trasy, filtr),
`src/lib/phase98-agendas.test.ts` (fáze AI Panel Builderu a agendy závodu), upravené `floorplan-live-checklist.test.ts`,
`phase89.test.ts`, `phase90.test.ts`, `documentation.test.ts`; E2E `e2e/phase98.spec.ts` (4: filtr palety a panelu
s rozvržením, chytrý filtr tras a návrat 4 → 2 → 3 → 5 bez ztráty dat, 4 fáze AI Panel Builderu, 4 agendy závodu),
pomocník `e2e/floorplan-phases.ts` (`goPhase`, `phaseForPalette`, `goPhaseForGroup`, `ensureActive`) a převedené starší
E2E testy půdorysu a AI Panel Builderu na nové fáze. Při průchodu celé sady se opravila i očekávání, která neodpovídala už
dřív nasazeným fázím: veřejná stránka `/panel-builder`, robots.txt, JSON-LD v layoutu a dvojí odkaz na video-návody
v patičce (fáze 96), fotky výrobců místo vektorových náhledů u panelů ABB a Decenta (fáze 94 / 97), český název
a objednací číslo na kartě akčního členu (fáze 81) a výchozí oteplení vzorového PB-001 se skříní a ztrátami z dat výrobců
(fáze 86 / 94 – referenční 42,4 °C dál hlídá unit test `thermalCalculation.test.ts`).
