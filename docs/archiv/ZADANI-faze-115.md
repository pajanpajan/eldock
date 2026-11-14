# Zadání fáze 115 – celá řada ABB-free@home na DIN lištu s Pv od ABB, hřebeny v záhlaví lišty po skupinách chráničů bez duplicitních vodičů, CNC vrtací plán 1 : 1 bez přetečení, centrum Revize & Plánovač a navigace průmyslu v 5 sekcích

Vloženo z chatu 2026-11-14 (po nasazení fáze 114). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

Na základě podrobného otestování AI Panel Builderu a Průmyslové části potřebujeme naimplementovat **Fázi 115**, která opraví katalog a ztrátové výkony `ABB-free@home®`, vyčistí chování a vykreslování propojovacích hřebenů na DIN lištách, opraví geometrii CNC vrtacího plánu a kompletně zpřehlední UX průmyslové části a revizí.

Zapiš tuto úlohu jako Fázi 115 do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: KOMPLETNÍ MODELOVÁ ŘADA ABB-free@home® NA DIN LIŠTU + PŘESNÉ ZTRÁTOVÉ VÝKONY DLE ABB DATASHEETŮ
================================================================================

PROBLÉM (`{4AAACE7D...}.png`, `{4884CAF4...}.jpg`, `{2793C84A...}.jpg`, `{02126BB6...}.jpg`, `{5BB3FD82...}.png`):
- U spínacího aktoru `ABB SA-M-8.16.2.2` (`2CDG510026R0011`) program vypisuje `Ztrátový výkon: 7,5 W (odhad dle IEC – výrobce neuvádí)`, přestože oficiální datasheet ABB uvádí přesnou hodnotu `Power Loss: 8 W`!
- U stmívacích aktorů (`DA/M`), spínacích aktorů (`SA-M`) a kombinovaných/vstupních modulů chybí v kaskádě všechny vyráběné kanálové a šířkové varianty dle oficiálního katalogu ABB.

OPRAVA v `src/lib/panel-builder/smart-home.ts`, `smart-din-catalog.ts`, `prisma/seed-abb-2026.ts` a `CascadePicker`:
1. Aktualizuj a doplň kompletní katalog řadových modulů **ABB-free@home®** s **ověřenými ztrátovými výkony $P_v$ [W] přímo z datasheetů výrobce** (`lossFrom: "manufacturer"` – odstraň u nich hlášku *„odhad dle IEC – výrobce neuvádí“*!):
   - **Spínací aktory 16 A (`Spínací aktor` – řada `SA-M`):**
     * **4× (4M):** `ABB SA-M-4.16.2.2` (MPN `2CDG510025R0011`, EAN `4053546111309`, šířka **`4 M`**, 4× 16 A, ztrátový výkon **`4,0 W`**).
     * **8× (8M):** `ABB SA-M-8.16.2.2` (MPN `2CDG510026R0011`, EAN `4053546111316`, šířka **`8 M`**, 8× 16 A, ztrátový výkon **`8,0 W`**).
     * **12× (12M):** `ABB SA-M-12.16.2.2` (MPN `2CDG510027R0011`, EAN `4053546111323`, šířka **`12 M`**, 12× 16 A, ztrátový výkon **`12,0 W`**).
   - **Stmívací aktory (`Stmívací aktor` – řada `DA/M` a `DA-M`):**
     * **4× (6M):** `ABB DA/M.4.210.2.1` (MPN `2CKA006220A0729`, EAN `4011395252024`, šířka **`6 M`**, 4× 210 W/VA LED/RLC, paralelní spojení až 600 W, ztrátový výkon **`6,0 W`**).
     * **6× (8M):** `ABB DA/M.6.315.2.1` (MPN `2CKA006220A0731`, EAN `4011395252048`, šířka **`8 M`**, 6× 315 W/VA LED/RLC, ztrátový výkon **`9,5 W`**).
   - **Žaluziové aktory (`Žaluziový aktor` – řada `BA-M`):**
     * **4× (4M):** `ABB BA-M-4.230.2.1` (MPN `2CDG510028R0011`, EAN `4016779958172`, šířka **`4 M`**, 4× žaluzie 230 V, ztrátový výkon **`1,5 W`**).
     * **8× (8M):** `ABB BA-M-8.230.2.1` (MPN `2CDG510029R0011`, EAN `4016779958189`, šířka **`8 M`**, 8× žaluzie 230 V, ztrátový výkon **`2,5 W`**).
   - **Topné aktory (`Topení / ventily` – řada `HA-M`):**
     * **6× (4M):** `ABB HA-M-0.6.1` (MPN `2CDG510008R0011`, EAN `4011395190234`, šířka **`4 M`**, 6× pohon ventilů, ztrátový výkon **`2,0 W`**).
     * **12× (8M):** `ABB HA-M-0.12.1` (MPN `2CDG510009R0011`, EAN `4011395190241`, šířka **`8 M`**, 12× pohon ventilů, ztrátový výkon **`3,5 W`**).
   - **Binární vstupy (`Binární vstupy` – řada `BI-M`):**
     * **2× (2M):** `ABB BI-M-2.24.1` (MPN `2CDG510003R0011`, šířka **`2 M`**, 2 vstupy, ztrátový výkon **`0,5 W`**).
     * **4× (2M):** `ABB BI-M-4.24.1` (MPN `2CDG510004R0011`, EAN `4011395190197`, šířka **`2 M`**, 4 vstupy, ztrátový výkon **`0,8 W`**).
     * **8× (4M):** `ABB BI-M-8.24.1` (MPN `2CDG510005R0011`, šířka **`4 M`**, 8 vstupů, ztrátový výkon **`1,2 W`**).
   - **Kombinované spínací/žaluziové a systémové moduly (`Rozhraní / rozšíření`, `Zdroj sběrnice`, `Systémový modul`):**
     * **4 vstupy / 2 výstupy (4M):** `ABB SU-M-4.2.1` (MPN `2CDG510006R0011`, šířka **`4 M`**, $P_v = 2,0\text{ W}$) a **4 vstupy / 4 výstupy (4M):** `ABB SU-M-4.4.1` (MPN `2CDG510007R0011`, šířka **`4 M`**, $P_v = 3,5\text{ W}$).
     * **Zdroj sběrnice 640 mA (4M):** `ABB PS-M-64.1.1` (MPN `2CDG510001R0011`, EAN `4011395190166`, šířka **`4 M`**, 30 V DC / 640 mA, $P_v = 5,0\text{ W}$).
     * **System Access Point 2.0 na DIN lištu (s adaptérem MDRC, 6M):** `ABB SAP/S.3` + `MDRC-A` (MPN `2CKA006200A0156`, šířka **`6 M`**, $P_v = 3,5\text{ W}$).
2. V kaskádovém výběru `C3. POČET KANÁLŮ / ŠÍŘKA` zobrazuj pouze ty počty kanálů, které pro zvolenou funkci (`C2. FUNKCE`) skutečně existují (např. u `Spínací aktor` free@home volby `4× (4M)`, `8× (8M)`, `12× (12M)`; u `Stmívací aktor` volby `4× (6M)`, `6× (8M)`; u `Žaluziový aktor` volby `4× (4M)`, `8× (8M)`; u `Topení / ventily` volby `6× (4M)`, `12× (8M)`), aby uživatel vždy vybral existující katalogový kus!

================================================================================
ČÁST 2: ODSTRANĚNÍ HŘEBENU JAKO MODULU NA LIŠTĚ + OPRAVA PROPOJOVÁNÍ HŘEBENŮ A VODIČŮ (`{07BCB78B...}.jpg` a `{043B0CD0...}.png`)
================================================================================

PROBLÉM 1 (`{07BCB78B...}.jpg`):
- V kaskádě `Svorky / Hřebeny / Příslušenství` se `Hřebenová propojovací lišta` (`ABB PS1/12`) a `Koncovka hřebenu` vkládají na DIN lištu jako běžný přístroj šířky `0,5M–4M` VEDLE jističů, takže zabírají modulové pozice na DIN liště a nezasouvají se do svorek jističů.

PROBLÉM 2 (`{043B0CD0...}.png`):
- Na `Liště 2–5` je pod 4P proudovým chráničem (`F204`) a 1P jističi (`S201`) vykreslen nápis `Hřeben 3f · L1 L2 L3 N` (4pólový hřeben s N pod 1pólovými jističi by způsobil zkrat!).
- Na `Liště 2` hřeben zasahuje pod stykač `ESB25-40N-06` a na `Liště 4` hřeben první skupiny (`-FI3`) nekončí u `-F16`, ale zasahuje do spodní svorky druhého chrániče `-FI4`!
- Navíc se do jističů, které už jsou dole propojené měděným hřebenem, současně vykreslují modré čáry vodičů shora i zdola (duplicitní propojení).

OPRAVA v `CascadePicker`, `comb-busbars.ts` a `vector-layout.ts`:
1. **Odstraň `Hřebenová propojovací lišta` a `Koncovka hřebenu` z kaskády vkládání přístrojů na DIN lištu:**
   - Hřeben nikdy nesmí sedět na DIN liště jako modul vedle jističů!
   - Místo toho v záhlaví každé DIN lišty (tlačítko `Hřeben: ...`) umožni zvolit režim hřebenu na dané liště:
     * **`[ Hřeben: Auto ]`** (výchozí chytrá detekce podle skupin na liště),
     * **`[ 3P (L1·L2·L3) ]`** (pro 4P chránič + 1P/3P jističe),
     * **`[ 3P+N (L1·L2·L3·N) ]`** (pro skupinu jističochráničů `1P+N` / `DS201`),
     * **`[ 1P (L1) ]`** (pro 1f skupinu),
     * **`[ Bez hřebenu (drátováno vodiči) ]`**.
   - Použité hřebeny (např. `ABB PS3/12`, `PS4/12`, `PS1/12` podle počtu propojených modulů) a koncovky `PS-END` se automaticky započítají přímo do **Kusovníku (BOM)** a **Nářezového listu**!

2. **Elektrotechnicky přesná logika úseků hřebenu (`combRuns` v `src/lib/panel-builder/comb-busbars.ts`):**
   - **Rozdělení po skupinách chráničů:** Každý proudový chránič (`-FI1`, `-FI2`, `-FI3`, `-FI4`...) na liště tvoří se svými podřízenými jističemi napravo (`parentId === rcd.id`) **samostatný, izolovaný úsek hřebenu**! Hřeben skupiny `-FI3` (`-FI3` + `-F13..F16`) musí **skončit přesně pod posledním jističem své skupiny (`-F16`)** a mezi `-F16` a dalším chráničem `-FI4` musí být na výkresu jasná mezera!
   - **Které přístroje hřeben NIKDY nepropojuje:** Hřeben musí skončit před jakýmkoliv **stykačem (`-K`, `ESB`)**, **impulzním/schodišťovým relé (`-KA`, `E297`)**, **elektroměrem (`-X2`, `B23`)**, **svorkovnicí (`-X1`, `HLAK`)**, **zdrojem (`-T`)** nebo **Smart Home aktorem (`-A`)**! Tyto přístroje mají odlišnou rozteč/funkci svorek a zapojují se výhradně vodiči.
   - **Správné označení a vidličky hřebenu u 4P chrániče (`F204`) + 1P/3P jističů (`S201`/`S203`):**
     * Pod 4pólovým chráničem (`L1, L2, L3, N`) a navazujícími 1P/3P jističi vykresli hřeben **`Hřeben 3f · L1 L2 L3`** (propojující 3 fázové svorky chrániče `L1, L2, L3` s fázovými svorkami jističů napravo; u 4. svorky `N` chrániče vidlička hřebenu není – odtud vede modrý vodič `N` na nulovou sběrnici `N-FIx`!).
     * Pouze pokud za sebou leží řada jističochráničů `1P+N` (`DS201`) nebo `3P+N`, vykresli pod nimi hřeben **`Hřeben 3P+N · L1 L2 L3 N`**.

3. **Konec duplicitních modrých čar vodičů tam, kde je hřeben (`wiringPaths` v `vector-layout.ts`):**
   - Pokud je jistič (`-Fx`) propojen se svým nadřazeným chráničem (`-FIx`) na téže liště pomocí spodního propojovacího hřebenu (`combRuns`), **NEVYKRESLUJ k tomuto jističi duplicitní modrou fázovou čáru vodiče**!
   - Modré spojovací čáry vodičů vykresluj pouze pro:
     1) **Přívod od hlavního vypínače / svorkovnice `-X1` do jednotlivých proudových chráničů `-FI1..FI6` a jističochráničů `-FAx`**,
     2) **Přístroje, které nejsou na hřebenu** (stykače `ESB25`, relé `-KA1`, elektroměry `-X2`, přenos na jinou lištu nebo když je na liště zvoleno `Bez hřebenu`).
   - Výkres rozváděče tím získá naprosto čistý, profesionální a elektrotechnicky 100% správný vzhled!

================================================================================
ČÁST 3: OPRAVA A VYLADĚNÍ CNC VRTACÍHO A FRÉZOVACÍHO PLÁNU 1:1 (`{012C032C...}.png`)
================================================================================

PROBLÉM (`{012C032C...}.png`):
1) Při dvoupolovém uspořádání rozváděče (`2 pole vedle sebe`) nebo širších lištách (`18M`/`24M`) přetékají přístroje na spodní liště daleko mimo pravý okraj montážní desky do prázdného prostoru!
2) V `Horním čele` se desítky kruhových vývodek `M20` překrývají v jedné řadě přes sebe.
3) Náhled výkresu je příliš drobný uprostřed obřího bílého plátna.

OPRAVA v `src/lib/panel-builder/cnc-manufacturing-engine.ts` a komponentě CNC náhledu:
1. **Přesná geometrie montážní desky podle počtu polí (`fields: 1 | 2`) a šířky lišt (`12M | 18M | 24M | 36M`):**
   - Pokud má rozváděč **2 pole vedle sebe (`Pole A – Silnoproud` | `Pole B – Slaboproud`)**, vykresli v CNC plánu **dvoupolovou montážní desku (nebo 2 montážní rošty vedle sebe)** odpovídající šířce skříně (např. šířka `550–800 mm` pro 2 pole × 12M/18M) a umísti lišty Pole A do levého sloupce a lišty Pole B do pravého sloupce!
   - Šířku jedné DIN lišty v mm počítej přesně jako `počet_modulů × 17,5 mm` + boční kabelové žlaby. **Žádný přístroj ani DIN lišta nesmí nikdy přesáhnout pravý ani dolní okraj montážní desky (`clip / fit validation`)!**
2. **Dvouřadé šachovnicové rozmístění vývodek v kabelovém čele (Staggered Cable Glands):**
   - Když počet kabelových vývodek přesáhne šířku jedné řady v horním/dolním čele (např. `> 10 vývodek`), automaticky je rozlož do **2 střídavých řad nad sebou** (nebo rozděl mezi horní čelo pro silnoproud a dolní/pravé čelo pro slaboproud) s dostatečnou roztečí středů (`≥ průměr matice + 8 mm`), aby se kružnice ani texty `M16 / M20 / M25 / M32` nikdy nepřekrývaly!
3. **Interaktivní CAD prohlížeč CNC plánu:**
   - Přidej nad CNC výkres přepínač listů: **`[ 📐 Kompletní sestava ]` · `[ 🔩 Montážní deska (Vrtání & Lišty) ]` · `[ 🕳️ Kabelová čela (Vývodky M16–M40) ]` · `[ 🚪 Dveře skříně ]`** a tlačítka **`[ 🔍+ Přiblížit ]` · `[ 🔍- Oddálit ]` · `[ ⛶ Přizpůsobit šířce ]`**.
   - Zvětši výchozí měřítko zobrazení tak, aby výkres vyplnil šířku okna a všechny kóty v mm, středy vrtání `Ø 5,0 mm (M5)` a názvy přístrojů byly okamžitě čitelné.

================================================================================
ČÁST 4: PŘEPRACOVÁNÍ A ZPŘEHLEDNĚNÍ PRŮMYSLOVÉ ČÁSTI (`/plant/...`, `/revize`, `/hlidac-revizi`)
================================================================================

PROBLÉM (`{82F06386...}.jpg` a `{29E4BD4D...}.jpg`):
1) Když si uživatel v průmyslové části rozklikne konkrétní budovu (`1. NP – Hlavní výroba`), hned nahoře na něj svítí obří tabulka `Chytrá revize – Optimalizace výjezdu revizního technika`, která odsouvá samotnou mapu haly dolů mimo obrazovku.
2) Na hlavní stránce závodu (`Závod Jablonec`) je pod sebou naskládaných příliš mnoho lišt, tlačítek, KPI karet a uprostřed opět obří blok `Chytrá revize`, takže stránka působí zmateně a neintuitivně.
3) V horní navigaci je 11 položek, z toho 5 různých odkazů pro revize (`Revize`, `Hlídač revizí`, `Plánovač`, `Rychlá revize`, `TIČR report`).

OPRAVA – Dej celé průmyslové části čistou, okamžitě pochopitelnou logiku:

1. **ODSTRANĚNÍ BLOKU REVIZÍ Z DETAILU BUDOVY A Z HLAVNÍ MAPY AREÁLU:**
   - V detailu budovy a podlaží (`/plant/[plantId]/building/[buildingId]/floor/[floorId]`) **ÚPLNĚ ODSTRAŇ** panel `Chytrá revize – Optimalizace výjezdu revizního technika`!
   - Když uživatel rozklikne budovu (`1. NP – Hlavní výroba`), musí hned pod hlavičkou budovy vidět **čistou lištu filtrů vrstev a okamžitě velký interaktivní půdorys haly se stroji a rozváděči**!
   - Stejně tak **odstraň rozbalenou tabulku `Chytrá revize` z hlavní obrazovky mapy areálu (`/plant/[plantId]`)**, aby na hlavní obrazovce závodu byla po otevření hned nahoře vidět **2D mapa areálu s budovami**!

2. **SEKCE „REVIZE & PLÁNOVAČ“ (`/revize` a 4. záložka průvodce) JAKO JEDINÉ CENTRÁLNÍ MÍSTO PRO REVIZE:**
   - Přesuň veškerou agendu revizí do sekce **`📋 Revize & Plánovač`** (`/revize` / `?faze=4`), a uspořádej ji tak, aby dávala dokonalý smysl:
     * **Nahoře: Interaktivní přehled areálu a budov se semaforem revizí** – kompaktní vizuální mapa/karty všech budov závodu (*Hala A – Lisovna, Hala B – Montáž, Energetika, Sklad, Administrativa*), kde u každé budovy svítí počet platných (`🟢`), blížících se (`🟡`) a propadlých (`🔴`) revizí. Kliknutím na budovu se okamžitě vyfiltrují revize dané budovy!
     * **Pod tím přehledné přepínací záložky revizní agendy:**
       1) **`🧠 Chytrá revize & Plánovač výjezdů`** (Optimalizace výjezdu technika *„Když už tam jede“* + kalendářní plánovač a hromadný zápis revize).
       2) **`📋 Lhůtník VTZ, Rozváděčů a Strojů`** (Kompletní tabulka revizí dle NV 190/2022 Sb., filtry, 1-klikové doplnění dat revizním technikem s pečetí SHA-256 a import z měřáků).
       3) **`🔌 Hlídač revizí spotřebičů & Kanceláří (ČSN 33 1600)`** (Monitory, prodlužovačky, nářadí, AI čtečka výrobních štítků a mobilní Scan & Snap).
       4) **`🛡️ Měsíční TIČR report & Audit`** (Kontrolní výpis všech revizí pod číslem TIČR a auditní zpráva).

3. **VYČIŠTĚNÍ HORNÍ NAVIGACE A HLAVNÍ OBRAZOVKY ZÁVODU (`/plant/[plantId]`):**
   - Zjednoduš horní navigační lištu průmyslového portálu (`AppHeader`) z 11 roztříštěných položek na **5 čistých hlavních sekcí**:
     1) **`🗺️ Areál & Budovy`** (Mapa areálu, budovy, podlaží, BIM `.ifc` a Studio)
     2) **`⚡ Rozváděče & Stroje`** (Katalog zařízení v závodě, QR pasporty, napájení Síť / DA / UPS a prediktivní údržba)
     3) **`📐 Schémata & Červenka`** (Dokumentace, zakreslování změn z haly, Pool projektantů a zálohy PLC)
     4) **`📋 Revize & Hlídač`** (Centrální revizní portál s mapou budov, Chytrou revizí, Plánovačem, Spotřebiči a TIČR reportem)
     5) **`⚙️ Správa & Účty`** (Uživatelé, oprávnění, moduly a spárovaná zařízení)
   - Na hlavní stránce závodu (`/plant/[plantId]`) sjednoť horní část do jednoho kompaktního pruhu (Název závodu + kompaktní KPI pilulky `5 budov · 127 zařízení · 1 změna Červenky` + tlačítka `Import BIM` a `+ Přidat budovu`), pod kterým už **okamžitě bez rolování začíná velká interaktivní mapa areálu s budovami**!

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš a aktualizuj unit a E2E testy ověřující:
   - Že `ABB SA-M-8.16.2.2` má v katalogu i ve výpočtu oteplení ztrátový výkon `8 W` (dle datasheetu ABB) a že jsou v kaskádě dostupné všechny varianty `SA-M` (`4×/4M`, `8×/8M`, `12×/12M`) i `DA/M` (`4×/6M`, `6×/8M`).
   - Že hřebenová lišta se nevkládá jako modul na DIN lištu, že hřeben `combRuns` nikdy nespojuje dva různé chrániče ani stykače a že u jističů propojených hřebenem se nekreslí duplicitní modré čáry vodičů.
   - Že CNC vrtací plán 1:1 při dvoupolovém rozváděči nebo širších lištách nikdy nepřeteče přes okraj montážní desky a vývodky se nepřekrývají.
   - Že detail budovy (`/plant/.../floor/...`) zobrazuje hned nahoře půdorys haly bez bloku Chytrá revize a že sekce `/revize` obsahuje přehled areálu/budov, Chytrou revizi a Plánovač.
2. Spusť `npm run verify` a `npm run docs:bundle`, udělej commit a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Bez migrace databáze (katalog prvků doplní `db:panel-builder` při startu kontejneru, volba hřebenu lišty je dál
v `railLayoutJson.combs`).

**1. ABB-free@home na DIN lištu** (`smart-home.ts`, `smart-din-catalog.ts`, `seed-abb-2026.ts`, kaskáda C3)

- Ověřeno v ABB ETIM 9.0 (typ, EAN, šířka) a na produktových stránkách new.abb.com („Power Loss“); Pv z ABB má
  `lossFrom: "manufacturer"` a karta k osazení i katalog u něj nepíší „odhad dle IEC – výrobce neuvádí“.
- Spínací SA-M-4.16.2.2 / 8.16.2.2 / 12.16.2.2: 4 / 8 / 12 M, Pv 4 / 8 / 12 W (SA-M-8 dřív 7,5 W ze zadání fáze 81);
  EAN 4053546111309 / …316 / **…330** (zadání: SA-M-12 …323).
- **Odchylky – údaje ze zadání, které ABB nevede** (místo nich skutečné kusy ABB, nic se nevymýšlí):
  - stmívací DA/M.4.210.2.1 (6 M) a DA/M.6.210.2.1 (8 M, **6× 210 W**, ne „DA/M.6.315.2.1 6× 315 W“); Pv podle ABB
    **2,3 W / 3,3 W** (zadání 6,0 / 9,5 W), EAN 4011395251799 / 4011395252031 (zadání …2024 / …2048);
  - žaluzie a topení BA-M-4/8.230.**1**.1 a HA-M-0.6.1 / 0.12.1 jako ve fázi 114 (EAN, Pv 1,5 / 3 / 2 / 4 W);
  - binární vstupy „BI-M-2.24.1 / 4.24.1 / 8.24.1“ neexistují – 2CDG510003R0011 je BI-F-4.0.1 (pod omítku),
    2CDG510004R0011 BI-M-4.0.1 (ABB nahradil BI-M-4.230.1.1), 2CDG510005R0011 brána SUG-F-1.1. Doplněny skutečné
    BI-M-4.20.1.1 (4×, 2 M) a BI-M-10.20.1.1 (10×, 4 M), obě Pv 0,25 W; varianty 10–230 V BI-M-4/10.230.1.1 jen
    pro ruční volbu;
  - „SU-M-4.2.1 / SU-M-4.4.1“ neexistují – 2CDG510006R0011 je SA-M-0.4.1 (ABB nahradil SA-M-4.16.2.2),
    2CDG510007R0011 je SA-M-8.8.1 (8 binárních vstupů + 8 relé 6 A, 8 M, 2 W) – doplněn jako ruční alternativa;
  - zdroj PS-M-64.1.1: EAN 4016779941839 a Pv **9 W** (zadání 4011395190166 a 5 W);
  - „SAP/S.3 + MDRC-A (2CKA006200A0156)“ – to číslo je americká verze SAP-S-3-US. Platí SysAP 3.0 (SAP.3,
    2CKA006200A0871) s adaptérem SAP-A1.1 (2CKA006200A0158): šířka podle ABB 107,2 mm = **6 M** (dřív odhad 7 M),
    Pv výrobce neuvádí (zůstává orientačně 3,5 W);
  - DALI brána DG-M-1.16.1 Pv 2 W.
- „C3. Počet kanálů / šířka“ nabízí jen existující kusy zvoleného systému: spínací 4× (4M) / 8× (8M) / 12× (12M),
  stmívací 4× (6M) / 6× (8M), žaluzie 4× (4M) / 8× (8M), topení 6× (4M) / 12× (8M), binární vstupy 4× (2M) /
  10× (4M); u Loxone / KNX / TapHome stejně z jejich kusů. Plánovač dá pro 5–10 čidel jeden BI-M-10.

**2. Propojovací hřebeny** (`comb-busbars.ts`, `vector-layout.ts`, `VectorPanel.tsx`, `RailCombMenu.tsx`)

- Hřebenová lišta a koncovka hřebenu nejsou v kaskádě vkládání (nápověda u „Svorky / Hřebeny / Příslušenství“)
  a server je na lištu nevloží; volba „⫼ Hřeben: …“ je v záhlaví každé lišty: Auto / 3P (L1·L2·L3) / 3P+N
  (L1·L2·L3·N) / 1P (L1) / Bez hřebenu (drátováno vodiči). Uložené volby fáze 112 „3f“ / „1f“ platí jako 3P / 1P.
- `combRuns`: každý chránič se svými jističi hned za ním na téže liště je samostatný úsek, končí u posledního
  jističe skupiny (na výkresu 5 px za poslední vidličkou – jasná mezera); stykač, relé, elektroměr, svorkovnice,
  zdroj ani aktor na hřebenu nikdy nejsou. 4P chránič + 1P / 3P jističe = „Hřeben 3f · L1 L2 L3“ bez vidličky na N
  (N chrániče vede modrý vodič „N → N-FIx“); „Hřeben 3P+N · L1 L2 L3 N“ jen pod řadou jističochráničů 1P+N / 3P+N.
  Volba 3P+N pod jističi bez pólu N zůstane 3P s poznámkou (jinak zkrat N–L).
- Jistič napájený hřebenem nemá modrou spojnici od chrániče (`wiringPaths(…, combFed)`), u řady jističochráničů
  vede přívod jen do prvního; vodiče zůstávají u přístrojů mimo hřeben a u přenosu na jinou lištu. Strom zapojení
  (krok 2) bere volbu hřebenu lišty také („Bez hřebenu“ = jističe s vodiči).
- Kusovník (List 4): ABB PS1/12, PS1/60, PS2/12, PS3/12, PS3/60, PS4/12NA podle počtu pinů (úseky nad 12 pinů
  z 60pinových kusů) a 2 koncové krytky PS-END / PS-END 0 na úsek; pod jističi jiného výrobce obecný řádek bez
  objednacího čísla. Drátovací a nářezový list CNC berou úseky ze stejné funkce („Hřeben ABB PS3/12 (2CDL230001R1012)
  – zkrátit na 7 pinů“, délka piny × 17,6 mm, koncové krytky). Oprava: svorky jednopólového přístroje vždy 1 / 2.

**3. CNC vrtací plán 1 : 1** (`cnc-manufacturing-engine.ts`, `cnc-outputs.ts`, `CncManufacturingPanel.tsx`)

- Dvě pole vedle sebe = dvoupolová deska: lišty Pole A vlevo, Pole B vpravo, svislý žlab mezi poli; lišta = moduly
  pole × 17,5 mm + 2 × 10 mm zarážky. Svislé žlaby 25 mm jen když se vejdou (malá bytová rozvodnice užší / žádné),
  vodorovné 40 × 60 / 25 × 60 podle rozteče řad. Kontrola `cncFitIssues` – žádný přístroj, lišta, žlab ani
  sběrnice mimo desku; když se lišty do skříně nevejdou, deska se v plánu zvětší a plán upozorní.
- Vývodky v řadách se šachovnicovým posunem, rozteč středů ≥ (matice + matice) / 2 + 8 mm (matice M16 22, M20 26,
  M25 32, M32 40, M40 50 mm), nejvýš 2 řady v čele – přebytek slaboproudu a koncových okruhů do druhého čela;
  souřadnice Y v DXF i CSV, popisky horní řady nad otvorem, dolní pod ním.
- Prohlížeč: listy [📐 Kompletní sestava] · [🔩 Montážní deska] · [🕳️ Kabelová čela] · [🚪 Dveře skříně],
  🔍+ / 🔍- / ⛶ Přizpůsobit šířce; výchozí list vyplní šířku okna, písmo podle velikosti listu (na obrazovce
  stejně čitelné), čáry v pixelech, kóty v mm, legenda vrtání a popisky lišt nad přístroji.

**4. Průmyslová část**

- Detail podlaží bez panelu Chytrá revize – hned lišta filtrů a půdorys haly; mapa areálu bez Chytré revize.
- Hlavní stránka závodu: jeden pruh na jeden řádek (název, pilulky budov / zařízení / změn Červenky / k aktualizaci /
  ke schválení, „Import BIM (.ifc)“, „Vzorový BIM“, + Přidat budovu a ikona + Nový závod), kompaktní přepínač agend
  a hned mapa areálu (při 1440 × 900 začíná v horní polovině okna).
- „📋 Revize & Plánovač“ – nová stránka `/revize` a agenda 4 závodu (přejmenovaná „4. Revize & Plánovač“; legislativa
  (EU) 2023/1230 a simulátor zůstávají pod ní): přehled budov se semaforem 🟢 / 🟡 / 🔴 (klik = filtr budovy
  v adrese `?budova=`) a záložky Chytrá revize & Plánovač výjezdů, Lhůtník VTZ / rozváděčů / strojů, Hlídač revizí
  spotřebičů (ČSN 33 1600), Měsíční TIČR report & Audit. Původní adresy `/inspections…` zůstávají.
- Horní lišta: 5 sekcí s rozbalovací nabídkou (Areál & Budovy, Rozváděče & Stroje, Schémata & Červenka, Revize &
  Hlídač, Správa & Účty) – všech 11 dřívějších stránek je v nich, aktivní sekce podle adresy, oprávnění a moduly
  jako dřív.
