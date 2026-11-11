# Zadání fáze 93 – obchodní centra (ČSN 33 2000-7-718, BD4) a zdravotnictví (ČSN 33 2000-7-710 ed. 2, ČSN EN 62353 ed. 2)

Vloženo z chatu 2026-11-11. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Rozšiřujeme platformu ELDOCK o plnou normativní a funkční podporu pro **Obchodní centra / Retail Parky (ČSN 33 2000-7-718, Vyhláška č. 23/2008 Sb.)** a **Nemocnice, polikliniky a lékařské ordinace (ČSN 33 2000-7-710 ed. 2, ČSN EN 62353 ed. 2)**.

TVŮJ POSTUP:
1. Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` (zkontroluj v `git log` poslední číslo fáze a plynule navaž).
2. Naimplementuj kompletně všechny 4 části níže.
3. Napiš unit testy, spusť `npm run verify`, aktualizuj `docs/PLAN.md` + `CLAUDE.md`, udělej git commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

================================================================================
ČÁST 1: PROFIL PROJEKTU „OBCHODNÍ CENTRUM / PROSTOR PRO VEŘEJNOST (BD4 – ČSN 33 2000-7-718)“ V 2D PŮDORYSU A AI PANEL BUILDERU
================================================================================

Do nastavení projektu v **2D Půdorysu (`/panel-builder/floorplan` – Krok 2 a Kompaktní lišta)** i při zakládání/úpravě projektu v **AI Panel Builderu (`/panel-builder` a `/panel-builder/[id]`)** přidej volbu **`Typ objektu a normativní režim (Specializace prostoru)`**:
- `🏠 Bytová / Domovní instalace (ČSN 33 2130 ed. 4 – BD1, běžné kabely CYKY)` *(Výchozí)*
- `🛍️ Obchodní centrum / Prostor pro veřejnost (ČSN 33 2000-7-718 · BD3/BD4 · Bezhalogenové kabely B2ca)`
- `🏥 Zdravotnický prostor – Skupina 1: Ordinace, vyšetřovny a lůžka (ČSN 33 2000-7-710 ed. 2)`

Jakmile uživatel zvolí režim **`🛍️ Obchodní centrum / Prostor pro veřejnost (BD3/BD4)`**, proveď automaticky tyto změny:

1. AUTOMATICKÁ NÁHRADA KABELŮ ZA BEZHALOGENOVÉ `B2ca-s1, d1, a1` (DLE VYHLÁŠKY Č. 23/2008 Sb.):
   - Ve všech okruzích 2D půdorysu, ve výkazu kabeláže, na kótách tras v PDF/DXF výkresu i ve finálním Kusovníku (BOM) automaticky nahraď standardní PVC kabely `CYKY` za bezhalogenové kabely se sníženou kouřivostí a třídou reakce na oheň **`B2ca-s1, d1, a1`**:
     * `CYKY-J 3×1,5` -> **`1-CHKE-R (N2XH-J) 3×1,5 B2ca-s1,d1,a1`**
     * `CYKY-O 3×1,5` -> **`1-CHKE-R (N2XH-O) 3×1,5 B2ca-s1,d1,a1`**
     * `CYKY-J 5×1,5` -> **`1-CHKE-R (N2XH-J) 5×1,5 B2ca-s1,d1,a1`**
     * `CYKY-J 3×2,5` -> **`1-CHKE-R (N2XH-J) 3×2,5 B2ca-s1,d1,a1`**
     * `CYKY-J 5×2,5` -> **`1-CHKE-R (N2XH-J) 5×2,5 B2ca-s1,d1,a1`**
     * `CYKY-J 5×4` / `5×6` / `5×10` -> **`1-CHKE-R (N2XH-J) 5×4 / 5×6 / 5×10 B2ca-s1,d1,a1`**
     * Sběrnicové a datové kabely -> **`J-H(St)H 2×2×0,8 B2ca`** / **`U/FTP CAT6A LSOH B2ca-s1,d1,a1`**.
   - Pro instalační krabičky v kusovníku automaticky vynucuj **bezhalogenové provedení (`HF` / `KA` – např. `KOPOS KPR 68 KA` / `KU 68 LD NA`)**.
   - V protokolu vnějších vlivů (Krok 4 AI Panel Builderu) automaticky předvyplň vnější vliv **`BD4 (obtížný a pomalý únik osob, vysoká hustota osob)`**, **`BE2 (nebezpečí požáru)`**, normu **`ČSN 33 2000-7-718`** a **`Vyhlášku č. 23/2008 Sb.`**!

2. NOUZOVÉ OSVĚTLENÍ V PŮDORYSU + KONTROLA CENTRAL STOP A MID ELEKTROMĚRU V ROZVÁDĚČI NÁJEMNÍ JEDNOTKY:
   - Do levé palety `💡 Světla` v 2D půdorysu přidej prvek **`NO_SV` Nouzové únikové svítidlo s piktogramem (1h / 3h, SE/SA dle ČSN EN 1838)** (se zelenou schematickou značkou běžícího panáčka a šipky úniku, výchozí výška `2200 mm`).
   - V **Elektro-linteru AI Panel Builderu (`src/engine/electrical-linter.ts`)** i při generování rozváděče z půdorysu v režimu `Obchodní centrum (BD4)` kontroluj a nabízej 1-klikovou opravu pro:
     a) **Vypínací spoušť (Shunt Trip – CENTRAL STOP / TOTAL STOP od EPS):** Hlavní vypínač / hlavní jistič rozváděče nájemní jednotky MUSÍ mít osazenou boční **vypínací spoušť (`0,5M` / `1M`, např. `ABB S2C-A2`, `Eaton FAZ-XAA`, `OEZ SV-LT`, `Schneider iMX+OF`)** pro dálkové vypnutí z ústředny EPS / tlačítka CENTRAL STOP! Pokud v rozváděči chybí, linter zobrazí varování s tlačítkem **`[ + Doplnit vypínací spoušť CENTRAL STOP a podružný MID elektroměr (1-klik) ]`**.
     b) **Podružný fakturační elektroměr (3f MID s Modbus / M-Bus):** Kontrola přítomnosti 3f elektroměru na DIN lištu (`4M`, např. `ABB B23 312-100`, `Schneider iEM3155`, `Finder 7M.38`) pro rozúčtování spotřeby nájemní jednotky.

================================================================================
ČÁST 2: PROFIL PROJEKTU „ZDRAVOTNICKÝ PROSTOR – SKUPINA 1 (ČSN 33 2000-7-710 ed. 2)“
================================================================================

Jakmile uživatel v 2D půdorysu nebo v AI Panel Builderu zvolí režim **`🏥 Zdravotnický prostor – Skupina 1 (Vyšetřovny, ordinace, lůžkové pokoje dle ČSN 33 2000-7-710 ed. 2)`**:

1. NOVÉ ZDRAVOTNICKÉ PRVKY V LEVÉ PALETĚ 2D PŮDORYSU (`/panel-builder/floorplan`):
   Do palety v 2D půdorysu přidej sekci / prvky pro zdravotnictví:
   - **`EKV` Přípojka doplňujícího ochranného pospojování (Ekvipotenciální svorkovnice):**
     * Výchozí výška `300 mm` (nebo `1000 mm` u vyšetřovacího lůžka), normová značka ochranného uzemnění v rámečku `EKV (PE)`, rozvod zelenožlutým vodičem **`CYA 6 mm² ZŽ (H07V-K)`** v trubce k kovovým částem, rozvodům vody/topení a k lůžkové rampě.
   - **`LUZ` Zdravotnická lůžková rampa / Vyšetřovací pracoviště (Skupina 1):**
     * Výchozí výška `1200 mm`, obsahuje dvojici/čtveřici zásuvek 230 V barevně/štítkem rozlišených na **Okruh A (Zelený/Bílý)** a **Okruh B (Oranžový/Zálohovaný)** + přípojný bod pospojování `PE` + datovou zásuvku `RJ45`.
   - V sekci `🛋️ Okna, dveře a nábytek` přidej také orientační architektonický prvek **`LEH_Z` Vyšetřovací lehátko / Nemocniční lůžko / Stomatologické křeslo** (`2,00 × 0,90 m`, s aktivním rohem X×Y).

2. AUTOMATICKÉ DĚLENÍ ZÁSUVEK DO 2 NEZÁVISLÝCH OKRUHŮ POD 2 CHRÁNIČE (ČSN 33 2000-7-710 ed. 2):
   - Ve `floorplan-bridge.ts` (`buildSwitchboardFromCircuits`) v režimu `Zdravotnický prostor – Skupina 1`:
     * Zásuvky v každé zdravotnické místnosti (vyšetřovně / ordinaci / lůžkovém pokoji) nebo na lůžkové rampě `LUZ` **automaticky rozděl minimálně na 2 samostatné jištěné okruhy (`Okruh A` a `Okruh B`)**, přičemž každý z nich MUSÍ být připojen pod **jiný samostatný proudový chránič $I_{\Delta n} \le 30\text{ mA}$ výhradně typu A nebo typu B** (nebo realizován pomocí dvou samostatných jističochráničů RCBO `1P+N B16A / 30mA typ A`!), aby při vybavení jednoho chrániče nikdy nezůstalo vyšetřovací lůžko nebo ordinace zcela bez napětí!
     * Stejně tak světelné okruhy ve zdravotnickém prostoru rozděl nebo doplň o nouzové svítidlo, aby při výpadku jednoho okruhu nezůstala ordinace potmě.

3. KONTROLY V ELEKTRO-LINTERU (2D PŮDORYS I AI PANEL BUILDER) PRO SKUPINU 1 DLE ČSN 33 2000-7-710 ed. 2:
   - **Kontrola 1 (Povinné 2 nezávislé zásuvkové okruhy pod 2 chrániči):** Pokud má vyšetřovna/ordinace v půdorysu (nebo zdravotnický rozváděč v Panel Builderu) všechny zásuvky pověšené na jediném okruhu nebo pod jediným společným proudovým chráničem, zobraz v Elektro-linteru chybu:
     * *"⚠️ ČSN 33 2000-7-710 ed. 2 (čl. 710.53 / 710.55): V zdravotnickém prostoru Skupiny 1 musí být zásuvky lůžka/vyšetřovny napájeny alespoň ze 2 samostatných obvodů pod 2 nezávislými chrániči ≤ 30 mA (typ A nebo B)!"* + tlačítko **`[ Opravit: Rozdělit zásuvky na 2 nezávislé RCBO/RCD okruhy (1-klik) ]`**.
   - **Kontrola 2 (Přísný zákaz chráničů typu AC a kontrola $I_{\Delta n} \le 30\text{ mA}$):** Ve zdravotnických prostorech Skupiny 1 a 2 jsou chrániče typu `AC` normou ČSN 33 2000-7-710 ed. 2 výslovně zakázány – povolen je pouze typ `A` nebo `B`!
   - **Kontrola 3 (Povinná přípojka doplňujícího pospojování `EKV`):** Pokud v půdorysu v místnosti označené jako ordinace/vyšetřovna/koupelna v režimu Skupiny 1 chybí prvek `EKV` (ekvipotenciální svorkovnice), zobraz v `Kontrola půdorysu a norem` varování s možností vložit `EKV` jedním klikem.
   - **Protokol vnějších vlivů v Kroku 4:** Automaticky doplň normu **`ČSN 33 2000-7-710 ed. 2 (Zdravotnické prostory – Skupina 1)`**, požadavek na doplňující ochranné pospojování a kontrolu izolačního stavu / impedance.

================================================================================
ČÁST 3: PODPORA 3 ZDROJŮ NAPÁJENÍ (`SÍŤ` / `DIESELAGREGÁT DA` / `UPS`) A NÁJEMNÍCH JEDNOTEK VE SPRÁVĚ AREÁLU (`/`)
================================================================================

V modulu **Správa výrobních závodů a areálů (`/` – hlavní mapa a detail rozváděče)** přidej klíčovou funkcionalitu pro nemocnice, obchodní centra i moderní fabriky:

1. KATEGORIE ZÁLOHOVÁNÍ NAPÁJENÍ ROZVÁDĚČE (`powerBackupTier`):
   U každého rozváděče a napájecí trasy umožni zvolit (a v detailu rozváděče i v 2D Studiu přepínat) úroveň důležitosti napájení:
   - **`GRID_STANDARD` – Běžné napájení ze sítě (Modrá / Šedá):** Odpojované při výpadku distribuční sítě (běžné kanceláře, obchody, nekritická technologie).
   - **`BACKUP_GENERATOR_DA` – Důležité napájení – Dieselagregát DA do 15 s (Oranžová / Jantarová `⚡ DA 15s`):** Rozváděče zálohované náhradním zdrojem (motorgenerátor se záskokovým automatem ATS do 15 sekund – evakuační výtahy, požární větrání, vyšetřovny, chlazení, důležité osvětlení).
   - **`CRITICAL_UPS_ZIS` – Velmi důležité / Kritické napájení – UPS do 0,5 s / ZIS IT (Červená / Purpurová `🔋 UPS <0,5s / IT`):** Bezvýpadkové napájení z centrální UPS / ZNZ nebo zdravotnické izolované soustavy IT (operační sály, JIP/ARO, serverovny, EPS, nouzové osvětlení).

2. VIZUÁLNÍ FILTR VĚTVÍ NA 2D MAPĚ AREÁLU + EVIDENCE NÁJEMNÍ JEDNOTKY / ODDĚLENÍ:
   - Přímo nad 2D mapou areálu na hlavní stránce `/` přidej přepínač pohledu napájecích větví:
     * `[ Všechny rozvody ]` · `[ 🔵 Jen běžná síť ]` · `[ 🟠 Zálohováno Dieselagregátem (DA <15 s) ]` · `[ 🔴 Kritické okruhy UPS (<0,5 s) / ZIS IT ]`
   - Když energetik nemocnice nebo správce obchodního centra klikne na filtr `🟠 Dieselagregát` nebo `🔴 Kritické UPS`, na mapě areálu se okamžitě barevně rozsvítí celá zálohovaná páteřní trasa a příslušné rozváděče včetně součtu zálohovaného příkonu v kW (např. *"Celkem na DA: 185 kW / kapacita DA 250 kVA -> Rezerva 26 %"*).
   - Na kartě rozváděče přidej volitelné pole **`Nájemní jednotka / Zdravotnické oddělení`** (např. `"Jednotka 1.42 – Kavárna"` nebo `"Pavilon B – Chirurgická ambulance, Skupina 1"`), podle kterého lze v areálu rychle vyhledávat a filtrovat.

================================================================================
ČÁST 4: ROZŠÍŘENÍ KNIHY REVIZÍ O ZDRAVOTNICKÉ A POŽÁRNÍ REVIZE (`/revisions`)
================================================================================

Rozšiř modul **Kniha revizí** (`src/app/revisions/` a přehled revizí na hlavní stránce `/`), aby kromě standardních revizí elektrických rozvodů, strojů, hromosvodů a spotřebičů sledoval i zákonné revize vyžadované v nemocnicích a obchodních centrech:

1. Přidej 4 nové specializované kategorie revizí se správnými zákonnými lhůtami a normami:
   - **`🏥 Zdravotnické elektrické přístroje (ČSN EN 62353 ed. 2 / zák. č. 375/2022 Sb.)`** – Opakované zkoušky a kontroly bezpečnosti zdravotnických přístrojů (EKG, infuzní pumpy, defibrilátory, křesla; výchozí perioda **12 měsíců** nebo **24 měsíců** dle třídy rizika).
   - **`🩺 Zdravotnické prostory Skupiny 1 a 2 & Hlídače izolačního stavu IMD / ZIS IT (ČSN 33 2000-7-710 ed. 2)`** – Pravidelná revize zdravotnických prostorů a test funkčnosti hlídačů izolačního stavu a záskoku UPS/DA (výchozí perioda **6 měsíců** pro funkční test IMD/ZIS, **12 měsíců** pro celkovou revizi prostoru Skupiny 2, **36 měsíců** pro Skupinu 1).
   - **`🏃 Nouzové únikové osvětlení a CBS (ČSN EN 50172 / ČSN EN 1838 / Vyhl. č. 246/2001 Sb.)`** – Evidenční deník nouzového osvětlení:
     * *Měsíční funkční zkouška* (perioda **1 měsíc**),
     * *Roční zkouška plné doby svícení akumulátorů (1 h / 3 h) a revize* (perioda **12 měsíců**).
   - **`🔥 Požární vypínací prvky CENTRAL / TOTAL STOP a EPS odpojení (Vyhl. č. 246/2001 Sb.)`** – Kontrola funkčnosti dálkového vypnutí rozváděčů nájemních jednotek a budovy (výchozí perioda **12 měsíců**).

2. Přidej do Knihy revizí rychlé předvolby filtru podle typu provozu:
   * `[ 🏭 Průmyslový závod ]` · `[ 🛍️ Obchodní centrum (BD4 + Nouzové osv. + Central Stop) ]` · `[ 🏥 Zdravotnictví (Skupina 1/2 + ČSN EN 62353 + ZIS IT) ]`, které jedním klikem vyfiltrují příslušné kontrolní okruhy a umožní exportovat souhrnný PDF výkaz pro kontrolu HZS (hasičů), SÚIP/TIČR nebo akreditační komisi Ministerstva zdravotnictví.

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ
================================================================================

- Napiš unit testy (např. v `src/engine/__tests__/commercial-medical-modes.test.ts`), které ověří:
  1) Že při přepnutí projektu půdorysu do režimu `Obchodní centrum (BD4)` se všechny kabely `CYKY` v kusovníku automaticky přepočítají na bezhalogenové kabely `1-CHKE-R (N2XH-J) B2ca-s1,d1,a1` a krabičky na bezhalogenové `HF/KA`.
  2) Že v režimu `Obchodní centrum (BD4)` Elektro-linter ohlásí chybějící vypínací spoušť `CENTRAL STOP` na hlavním vypínači a 1-kliková oprava ji osadí.
  3) Že v režimu `Zdravotnický prostor – Skupina 1 (ČSN 33 2000-7-710 ed. 2)` most z půdorysu (`floorplan-bridge.ts`) automaticky rozdělí zásuvky vyšetřovny/lůžka (`LUZ`) na 2 nezávislé okruhy pod 2 samostatné chrániče 30 mA typu A/B a linter zablokuje použití chrániče typu AC nebo jednoho společného chrániče.
  4) Že rozváděče ve Správě areálu podporují 3 úrovně zálohování (`GRID_STANDARD`, `BACKUP_GENERATOR_DA`, `CRITICAL_UPS_ZIS`) a Kniha revizí podporuje nové zdravotnické a požární kategorie.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

- **Kde je co:** zadání jmenuje `src/engine/electrical-linter.ts` a `src/app/revisions/` – Elektro-linter Eldocku je
  `src/lib/panel-builder/linter.ts`, Kniha revizí je `/inspections` (přehled) a `/inspections/audit-report` (auditní
  report). „Krok 4“ protokolu vnějších vlivů = protokol v dokumentaci rozváděče (krok 5 Dokumentace a PDF, list 5) –
  krok 4 Panel Builderu je oteplení.
- **Typ objektu** je jedna hodnota pro nákres (`FloorplanDraft.occupancy`, JSON nákresu, bez migrace) i projekt
  (`PanelBoardProject.occupancy`, migrace `phase93_occupancy_backup`); rozváděč z půdorysu převezme typ z nákresu.
  Výběr v kroku 2 průvodce (nad úrovní instalace), v kompaktní liště samostatné tlačítko se štítkem typu, v dialogu
  nového projektu a v úpravě hlavičky; štítek v hlavičce projektu.
- **Bezhalogenové kabely** vznikají na výstupu výpočtu (`analyzeDraft`) – okruhy, výkaz kabeláže (rozpis k nákupu se
  sloučí podle nového označení), svody k vypínačům, datové a sběrnicové trasy, štítky tras v PDF / DXF a kusovník.
  Ovládací CYSY → `1-CHKE-R (N2XH-O) n×1,5 B2ca-s1,d1,a1` (N2XH nejmenší průřez 1,5 mm²), signální SYKFY a sběrnice →
  `J-H(St)H …×2×0,8 B2ca` (počet párů nahoru na řadu 1 / 2 / 4 / 6 / 10).
- **Krabice HF:** v katalogu jen ověřené bezhalogenové typy z kategorie „bezhalogenové“ na kopos.cz (2026-11-11):
  KU 68-45/HF_HA (pod omítku 45 mm), KPR 68-70/HF_HA (pod omítku 70 mm), KU 68 LD/1HF_HA (výrobce ji řadí do dutých
  stěn – rozšířeno z dřevostavby i na SDK) a KPL 64-50/2LD HF_KA (dvojnásobná do dutých stěn). `KPR 68 KA` ze zadání
  je podle stránky výrobce PVC krabice bez označení HF a `KU 68 LD NA` jsme jako bezhalogenovou nenašli – nepoužity.
  Chybějící HF typ (jiný výrobce, hluboká HF krabice do SDK) kusovník vypíše „doplnit“ a hlídač nabídne přepnutí na
  KOPOS (řada HF).
- **NO_SV** je svítidlo světelného okruhu (nespínaný přívod, vlastní akumulátor) se zelenou značkou (štítek s běžícím
  panáčkem a šipkou) a výškou 2200 mm; v kusovníku řádek „Nouzové únikové svítidlo … – výrobce doplňte“.
- **CENTRAL STOP a MID:** rozváděč z půdorysu BD4 dostane za hlavní vypínač vypínací spoušť (příslušenství 1 M,
  podtyp SHUNT_TRIP) a podružný elektroměr MID (3f 4 M, u 1f přívodu 2 M) + tlačítko CENTRAL STOP do kusovníku.
  Typy (ABB S2C-A2, Eaton FAZ-XAA, OEZ SV-LT, Schneider iMX+OF; ABB B23 312-100, Schneider iEM3155, Finder 7M.38) jsou
  jen příklady ze zadání ve štítku – konkrétní kus vybere konfigurátor z katalogu (jinak orientační kus). Oprava
  1 klikem vloží chybějící přístroje na první lištu s volným místem, jinak přidá DIN lištu.
- **Zdravotnictví:** lékařská místnost se pozná podle názvu (ordinace, vyšetřovna, lůžkový pokoj, zákrokový sál,
  ošetřovna, ambulance, stomatologie …); zásuvky těchto místností a rampy LUZ jdou mimo zóny zásuvek do okruhů A / B,
  každý okruh na vlastní RCBO 1P+N B16 30 mA typ A (= „2 samostatné jističochrániče“ ze zadání). Jediný zásuvkový
  vývod v místnosti = varování (výpočet i hlídač s opravou „doplnit dvojzásuvku okruhu B“). Světla místnosti se 2 a více
  svítidly se střídají na 2 světelné okruhy; jediné svítidlo bez NO_SV = varování s vložením NO_SV. LUZ se ve výpočtu
  rozpadne na dvojzásuvku A, dvojzásuvku B a datovou zásuvku (uzly `id#A`, `id#B`, `id#D`); v kusovníku jako jedno
  těleso. EKV není vývod okruhu – v kusovníku svorka EKV, přípojnice EKV místnosti a vodič CYA 6 mm² ZŽ (odhad 3 m
  na přípojku); u lehátka LEH_Z (do 1,5 m) se vkládá ve výšce 1000 mm.
- **Linter zdravotnictví** bere místnosti ze štítku okruhu („Zásuvky – Ordinace 1 – Okruh A …“); rozváděč bez
  zásuvkových okruhů pravidlo zásuvek netýká; bez rozpoznané lékařské místnosti posoudí všechny zásuvkové okruhy
  rozváděče. Chránič AC je ve zdravotnictví chyba (jinde varování), IΔn nad 30 mA chyba s opravou na 30 mA.
- **Zálohování napájení:** úroveň má rozváděč a zdroj (`SWITCHBOARD`, `TRANSFORMER`) a platí i pro jeho přívodní trasu
  (trasa = napájení rozváděče); podřízené rozváděče ji dědí, dokud nemají vlastní (UPS za DA). Výkon větve = Ib
  (naměřený, jinak součet podřízených se soudobostí 0,8, jinak jmenovitý) · √3 · 400 V · cos φ 0,9; rezerva se počítá
  ze zdánlivého výkonu (kVA) proti kapacitě zdroje zadané u kořene větve (`backupCapacityKva`) – proto u příkladu ze
  zadání (185 kW / 250 kVA) vyjde 18 %, ne 26 % (zadání porovnávalo kW s kVA). Filtr zvýrazní budovy větve a páteřní
  trasy mezi budovami; přehled rozváděčů větve s odkazy na karty. Nájemní jednotka / oddělení na kartě rozváděče,
  hledání nad mapou bez diakritiky.
- **Kniha revizí:** nové typy zařízení `MEDICAL_DEVICE` (12 / 24 měsíců – varianta na kartě), `MEDICAL_ROOM` (Skupina 1
  36, Skupina 2 12, IMD / ZIS IT 6 měsíců) a `FIRE_SHUTDOWN` (12 měsíců, vyhláška č. 246/2001 Sb.); nouzové osvětlení
  dostalo měsíční zkoušku funkce (`FUNCTION_TEST`, platnost 1 měsíc, lhůtu revize neposouvá) vedle roční zkoušky plné
  doby. Lhůty jsou normové (varování), ne závazné jako u VTZ. Předvolby filtrují přehled i auditní report
  (`?predvolba=INDUSTRY|RETAIL|HEALTH`, průnik s výřezem účtu); souhrnný tisk = tisk auditního reportu do PDF
  s hlavičkou pro SÚIP / TIČR, HZS nebo akreditační komisi MZ. Zdravotnické přístroje mají vlastní vrstvu mapy
  `HEALTH` (technik spotřebičů podle ČSN 33 1600 je nevidí), zdravotnické prostory a CENTRAL STOP jsou ve vrstvě
  bezpečnosti (vidí je revizní technik VTZ).
