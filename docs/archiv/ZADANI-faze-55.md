# Zadání fáze 55 – AI Panel Builder a 2D půdorys (vloženo 2026-11-05)

Původní znění vložené do `docs/PLAN.md` během práce na fázi 54 (opravy veřejného webu). V textu je uvedené jako „Fáze 54“;
číslo 54 už nese fáze oprav webu, proto je zařazené jako fáze 55. **Text končí uprostřed bodu 6** (poslední slova „varné plotýnky pro“) –
zbytek bodu 6 (oprava nahrání PDF půdorysu „Plocha 0 × 0 m“) chybí. Realizace čeká na potvrzení uživatele.

Bod 1 se částečně překrývá s fází 54: zdvojené emoji 🚀 / 📄 na úvodní stránce odstranila fáze 54; sestavení stromu PB-001
(List 3 „Nezapojeno ve stromu“, chybějící spojnice na Listu 2) zůstává pro fázi 55.

---

Na základě kontroly nasazené aplikace a Katalogu ABB 2026 provedeme v AI Panel Builderu a 2D půdorysu 6 zásadních oprav a vylepšení (Fáze 54). Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj:

1. OPRAVA VZOROVÉHO 6LISTOVÉHO ELABORÁTU NA ÚVODNÍ STRÁNCE (`/ukazka-elaboratu` a `PB-001`) + DUPLICITNÍ IKONY:
- V `image_3c1c24.png` je na Listu 3 vzorového elaborátu `PB-001` prázdné jednopólové schéma s červenou chybou `"Nezapojeno ve stromu: -Q1, -FV..."` a na Listu 2 chybí modré spojnice, protože položky `PB-001` nemají v databázi sestavený strom (`fedFromIncomer` / `parentItemId`).
- Oprav to na dvou místech:
  a) V `prisma/seed-panel-builder.ts` u vzorového projektu `PB-001` po vytvoření položek automaticky aplikuj `proposeTree()`, aby `-Q1` měl `fedFromIncomer = true`, `-FV1` a `-FI1` visely pod `-Q1` a všechny jističe `-F1` až `-F10` byly řádně zapojené s rozvrženými fázemi a vyplněným `routineTestJson`.
  b) V `src/server/panel-documentation.ts` ve funkci `buildDocumentationData`: pokud má projekt v režimu `showcase: true` (nebo `PB-001`) některé prvky nezapojené ve stromu, automaticky nad daty před vykreslením `renderSingleLineDiagramSvg` a `renderPanelDrawingSvg` spusť `proposeTree()`, aby veřejná ukázka na úvodní stránce měla VŽDY 100% kompletní jednopólové schéma na Listu 3, modré propojky na Listu 2 a nula chyb!
- Na úvodní stránce (`src/app/(site)/page.tsx` a `SampleElaborateDialog.tsx`) odstraň z textu tlačítek duplicitní textové emotikony `🚀` a `📄`, když už tlačítko obsahuje Lucide ikonu `<Rocket />` / `<FileText />`.

2. VOLBA 1FÁZOVÉ / 3FÁZOVÉ INSTALACE A AUTOMATICKÁ PRÁCE S VODIČI A SBĚRNICEMI `PE` A `N` (`TN-C-S` vs. `TN-S`):
Rozšiř datový model projektu (`PanelBoardProject`), 2D půdorys, soupis místností, vektorové plátno i PDF dokumentaci o volbu fází a správu `PE` / `N` vodičů:
- **Volba soustavy a počtu fází (`supplyPhases` & `networkSystem`):**
  * V hlavičce projektu rozváděče, v modalu Nový projekt i v 2D půdorysu přidej jasný přepínač:
    1) **`3f soustava (3× 230/400 V AC)`** se třemi variantami přívodu:
       - `TN-C-S (přívod 4-vodič L1, L2, L3, PEN -> rozdělení PEN na PE a N v tomto rozváděči)`
       - `TN-S (přívod 5-vodič L1, L2, L3, N, PE -> PE a N již rozděleny před rozváděčem)`
       - `TT (L1, L2, L3, N + vlastní uzemnění PE)`
    2) **`1f soustava (1× 230 V AC)`** se dvěma variantami přívodu:
       - `1f TN-S (přívod 3-vodič L, N, PE – 230 V)`
       - `1f TN-C-S (přívod 2-vodič L, PEN -> rozdělení PEN na PE a N v rozváděči)`
  * Pokud je zvolena **1f soustava (230 V)**:
    - Automatický generátor rozváděče osazuje **2P hlavní vypínač (`2M`)**, **1f přepěťovku (`2M`)** a **2P proudové chrániče (`2M`)** (nebo `1P+N` RCBO).
    - Všechny okruhy jsou přiřazeny na fázi `L1` (v fázové bilanci se hodnotí proud 1f přívodu bez falešného varování na nesymetrii L2/L3!).
- **Automatický model a vizualizace `PE` a `N` sběrnic (můstků) v rozváděči (`src/lib/panel-builder/pe-n-busbars.ts`):**
  * Vytvoř deterministický výpočet svorkovnic `PE` a `N` pro každý rozváděč:
    1) **Hlavní ochranná sběrnice `PE` (zeleno-žlutá):** Spočítej potřebný počet přípojných míst (`1× přívod PE/PEN` + `1× uzemnění/MET` + `1× SPD` + `počet všech koncových jisticích vývodů` + `20 % rezerva`) a vyber odpovídající PE sběrnici (např. `PE sběrnice 12 / 18 / 24 / 36 otvorů`).
    2) **Bod rozdělení `PEN -> PE + N` (pouze u `TN-C-S`):** Pokud je soustava `TN-C-S`, vykresli a zapiš do schématu i kusovníku **propojku (klemu) mezi sběrnicí `PE` a hlavní nulovou sběrnicí `N0`** s popisem `"Bod rozdělení PEN -> PE + N (ČSN 33 2000-5-54 ed. 3)"`. U soustavy `TN-S` jsou `PE` a `N0` plně izolované bez propojky!
    3) **Hlavní nulová sběrnice `N0` (modrá – před chrániči):** Pro přívod `N`, napájení `N` pólů jednotlivých proudových chráničů (`-FI1`, `-FI2`...), `1P+N` jističochráničů (`-FA1`...) a okruhů mimo skupinové chrániče.
    4) **Izolované skupinové nulové můstky `N-FI1`, `N-FI2`, `N-FI3`... (modré – ZA každým proudovým chráničem!):**
       - Pro KAŽDÝ proudový chránič (`RCD`, `-FIx`) v rozváděči automaticky vytvoř samostatný, elektricky oddělený modrý nulový můstek `N-FIx`, do kterého jsou přivedeny nulové vodiče výhradně těch koncových jističů (`-Fy`), které mají `parentItemId = FIx.id`!
       - Zobraz počet obsazených a volných svorek na každém můstku (např. `Můstek N1 (za -FI1): 7 / 10 svorek`).
  * **Vizualizace na 2D vektorovém rozváděči, v 1P schématu a v kusovníku (BOM):**
    - Přímo na 2D vektorovém plátně (`VectorPanel.tsx`) i na Listu 2 PDF dokumentace vykresli v horní nebo spodní části skříně (podle směru přívodu) grafickou lištu svorkovnic: zeleno-žlutý blok **`PE`** (s propojkou na `N0` při `TN-C-S`), modrý blok **`N0`** a samostatné modré bloky **`N1 (za -FI1)`**, **`N2 (za -FI2)`** se šroubky a počtem připojených vodičů!
    - Kliknutím na blok `PE / N svorkovnice` na plátně zobraz přehledné vysvětlení a rozpis, který okruh je na který N-můstek připojen.
    - Všechny vypočtené `PE` a `N` můstky automaticky přidej jako položky do Kusovníku (List 4).

3. OPRAVA LOGA HAGER (`hager` MÍSTO `hagergroup`):
- V `public/brands/hager.svg` a `ManufacturerLogo.tsx` nahraď šedé korporátní logo `hagergroup` oficiálním modrým logem **`hager`** (`#005CA9`, čistá tučná typografie `hager`).

4. 2D PŮDORYS (`/panel-builder/floorplan`): PŘESUN VÝBĚRU VÝROBCE A ŘADY ÚPLNĚ NAHORU + 15 DESIGNOVÝCH ŘAD ABB S NÁHLEDY A DYNAMICKÝMI BARVAMI DLE KATALOGU 2026:
- **Přesun z levého panelu do horní lišty:**
  * Odstraň velký blok `🎨 Domovní přístroje` z levého bočního panelu (kde teď zabírá polovinu výšky a vytlačuje rozváděč, zásuvky a vypínače mimo obrazovku!).
  * Umísti výběr **Výrobce -> Designová řada (s grafickým náhledem tvaru) -> Barva (s přesnými barvami dané řady)** do **horní vodorovné lišty přímo nad rastr půdorysu**! Levý panel tak bude od samého vrchu patřit výhradně osazovaným prvkům (`⚡ Rozváděč`, `🔌 Zásuvky`, `💡 Světla a vypínače`, `🔥 Samostatné spotřebiče`).
- **Kompletní designové řady ABB a jejich přesné barvy dle Katalogu ABB 2026 (`src/lib/panel-builder/abb-catalog-2026.ts`):**
  * Když uživatel vybere výrobce **ABB**, zobraz všech **14 designových řad pro zapuštěnou montáž + 3 nástěnné řady IP44/IP54**, každou s **2D SVG náhledem typického tvaru rámečku a klapky** (např. *Tango* zaoblený rámeček, *Levit* vrstvený čtvercový s barevnou spárou, *Zoni* moderní tenký matný, *Decento* kulatý porcelánový retro, *Time* s kovovým proužkem):
    1) `Zoni` (`T`) -> barvy: `Bílá (500)`, `Matná bílá (240)`, `Šedá / bílá (241/141)`, `Pudrová / bílá (242/142)`, `Olivová / bílá (243/143)`, `Greige / bílá (244/144)`, `Matná černá (237)`, `Matná černá / bílá (137)`.
    2) `Tango` (`A`) -> barvy: `Bílá (B)`, `Slonová kost (C)`, `Šedá (S)`, `Béžová (D)`, `Hnědá (H)`, `Černá (N)`, `Kouřová šedá (S2)`, `Vřesová červená (R2)`.
    3) `Levit` (`H`) -> barvy: `Bílá / ledová bílá (01)`, `Bílá / bílá (03)`, `Šedá / bílá (16)`, `Slonová kost / bílá (17)`, `Macchiato / bílá (18)`, `Bílá / kouřová černá (62)`, `Žlutá / kouřová černá (64)`, `Červená / kouřová černá (65)`, `Oranžová / kouřová černá (66)`, `Zelená / kouřová černá (67)`.
    4) `Levit M` (`H`) -> barvy: `Onyx / kouřová černá (63)`, `Perleťová / ledová bílá (68)`, `Ocelová / kouřová černá (69)`, `Titanová / kouřová černá (70)`.
    5) `Time` (`E/F`) -> barvy: `Bílá / ledová bílá (01)`, `Bílá / bílá (03)`, `Titanová (08)`, `Starostříbrná (32)`, `Šampaňská (33)`, `Antracitová (34)`, `Ocelová (36)`.
    6) `Time Arbo` (`E/F`) -> barvy: `Starostříbrná / přírodní javor`, `Starostříbrná / olše`, `Starostříbrná / třešeň`, `Titanová / třešeň`, `Antracitová / mahagon`, `Antracitová / wenge`.
    7) `Element` (`E`) -> barvy: `Bílá / ledová bílá`, `Bílá / bílá`, `Agáve`, `Karmínová`, `Karamelová`, `Titanová`, `Platinová`.
    8) `Swing` (`G`) -> barvy: `Jasně bílá (B1)`, `Krémová (C1)`, `Béžová (D1)`, `Světle šedá (S1)`, `Hnědá (H1)`.
    9) `Swing L` (`G/J`) -> barvy: `Jasně bílá (B1)`, `Krémová (C1)`, `Mocca (C3)`, `Světle šedá (S1)`, `Cihlová (R3)`.
    10) `Classic` (`3553`) -> barvy: `Jasně bílá (B1)`, `Béžová (D2)`, `Hnědá (H3)`.
    11) `Decento` (`K`) -> barvy: `Porcelán bílá`, `Porcelán černá`, `Porcelán bílá / dřevo buk`, `Porcelán bílá / dřevo třešeň`, `Porcelán černá / dřevo wenge`.
    12) `future linear` -> barvy: `Alpská bílá (84)`, `Matná alpská bílá (884)`, `Slonová kost (82)`, `Antracitová (81)`, `Matná černá (885)`, `Hliníková (83)`.
    13) `solo / solo carat` -> barvy: `Studio bílá`, `Slonová kost`, `Šedá metalíza`, `Chrom`, `Zlato`, `Bronz`, `Břidlice`.
    14) `Busch-axcent` -> barvy: `Studio bílá`, `Černá`, `Červená`, `Modrá`, `Zelená`, `Žlutá`, `Beton`, `Břidlice`, `Dřevo`.
    15) `Garant (IP44)` / `Variant+ (IP54)` / `Praktik (IP44)` -> barvy: `Bílá`, `Šedá`, `Béžová`, `Hnědá`.
  * **DŮLEŽITÉ:** Jakmile uživatel klikne na jinou designovou řadu (např. přepne z `Tango` na `Zoni` nebo `Classic` nebo `Levit M`), nabídka barev se OKAMŽITĚ PŘEPNE na skutečné barvy dané řady (a pokud předchozí barva v nové řadě neexistuje, automaticky se vybere první výchozí barva nové řady)! Totéž udělej pro řady Schneider Electric (`Nová Unica`, `Sedna`, `Asfora`, `Mureva Styl`), Legrand (`Valena Life`, `Valena Allure`, `Céliane`, `Niloé`, `Plexo`) a Hager (`lumina`, `berker`).

5. GENERÁTOR KUSOVNÍKU DOMOVNÍ INSTALACE (BOM S MNOŽSTVÍM A PŘESNÝMI OBJEDNACÍMI KÓDY DLE KOMPLETNOSTI):
- Podle Katalogu ABB 2026 (str. 26 "Sestavování přístrojů") se stavebnicový vypínač skládá z **Přístroje (strojku 1)** + **Krytu v barvě (4)** + **Rámečku 1R–5R v barvě (5)**, jednonásobná zásuvka z **Přístroje s krytem (2)** + **Rámečku (5)** a dvojzásuvka z **Kompletního přístroje (3)**.
- Vytvoř v `src/lib/panel-builder/wiring-bom.ts` funkci `compileFloorplanBom(nodes, mode)`, která pro celý naklikaný projekt v 2D půdorysu vygeneruje **kompletní položkový kusovník (BOM) s přesnými objednacími čísly (MPN) a součty kusů**:
  * Spočítá samostatně **Přístroje spínačů pod omítku** (např. `3559-A01345` pro řazení 1, `3559-A06345` pro ř. 6, `3559-A07345` pro ř. 7, `3559-A05345` pro ř. 5, `3559-A52345` pro ř. 6+6, `3559-A87345` pro 1/0+1/0, `3559-A89345` pro žaluziový spínač).
  * Spočítá **Kryty spínačů v přesné zvolené řadě a kódu barvy** (např. u Zoni bílá `3559T-A00651 500` jednoduchý / `3559T-A00652 500` dělený / `3559T-A00662 500` žaluziový; u Tango `3558A-A651 B`; u Levit `3559H-A00651 03`; u Time `3558E-A00651 03` – podloženo daty v `WiringDevice` + deterministickou maticí z Katalogu ABB 2026).
  * Spočítá **Zásuvky 1N a 2N** v přesné řadě a kódu barvy (`6619T-A06657 500`, `5513T-C02157 500`, `6619A-A06357 B`, `5513A-C02357 B`, `6619H-A06357 03`, `5513H-C02357 03`...).
  * Spočítá **Rámečky podle násobnosti (1R až 5R)** v přesné řadě a barvě (`3901T-A00010 500` až `A00050`, `3901A-B10 B` až `B50`, `3901H-A05010 03` až `A05050`...).
  * Spočítá **Instalační krabice KOPOS** (`KU 68-1901` pro běžnou montáž nebo `KPR 68 / KPRL 68-70/LD` hluboké krabice) a **Kabely CYKY** po metrech.
- V pravém panelu 2D půdorysu (a v samostatném modalu **`[ 📋 Zobrazit kompletní kusovník (BOM) a objednací čísla ]`** s exportem do **CSV / XLSX a tiskem PDF**) zobraz tuto kompletní tabulku se sloupci: **Kategorie · Objednací číslo (MPN) · Název a specifikace · Řada a barva · Počet ks / m**. Stejný kusovník přenes i do vygenerovaného projektu v AI Panel Builderu!

6. INTERAKTIVNÍ SCHEMATICKÉ ZNAČKY NA PŮDORYSU + OPRAVA NAHRÁNÍ PDF PŮDORYSU (`Plocha 0 × 0 m`):
- **Interaktivní schematické značky místo obyčejných teček:**
  * V 2D půdorysu (`/panel-builder/floorplan`) nahraď malé kruhové tečky skutečnými, čitelnými **interaktivními SVG elektrotechnickými značkami (dle ČSN EN 60617 / ČSN 01 3481)**:
    - **Zásuvky (1Z, 2Z, ZL, IP44, RJ45):** Půlkruhová značka zásuvky se svislou čarou (u 2Z s dvojitou ryskou / číslem `2`, u IP44 se stříškou) + barevný lem podle barvy přístroje.
    - **Vypínače (S1, S5, S6, S6+6, S7, T1, T2, ZAL, STM, PIR, TER):** Kruh spínače se šikmým praporkem podle počtu klapek a směru (1 praporek = ř. 1, 2 praporky = ř. 5, protilehlé praporky = ř. 6 / 6+6, 4 praporky = ř. 7, trojúhelník = tlačítko, šipky = žaluzie).
    - **Svítidla:** Křížek v kruhu (`⊗`) pro stropní svítidlo, nástěnná konzola pro nástěnné svítidlo.
    - **Samostatné spotřebiče (VD, TR, MY, PR, SU, CH, BO, TČ, EV, FVE):** Výrazný čtvercový technologický symbol s vnitřní piktogramovou ikonou spotřebiče (varné plotýnky pro
