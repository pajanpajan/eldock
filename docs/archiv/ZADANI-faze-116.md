# Zadání fáze 116 – detail stroje se záložkami nahoře a kompaktním identifikačním pruhem, prediktivní životnost součástek v kusovníku s datasheety a nákupním reportem, doplnění pasportu 61439, Červenky u stroje a pochůzka revizního technika

Vloženo z chatu 2026-11-14 (po nasazení fáze 115). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

Na základě testování detailu zařízení (`/equipment/[id]`) a revizního portálu (`/revize` a `/hlidac-revizi`) potřebujeme naimplementovat **Fázi 116**, která vyřeší 6 klíčových bodů z praxe:

1) V detailu stroje/rozváděče (`/equipment/[id]`): přesunout hlavní lištu záložek (`Schéma`, `Kusovník`, `3D rozváděč`, `✏️ Červenky`, `Historie změn`, `Pasport & Shoda (61439)`, `Revize & Lhůtník`, `📚 Návody & Datasheety`, `💾 Software & Zálohy PLC`, `🔍 Diagnostika & Spoje`) **úplně nahoru** hned pod hlavičku zařízení a zmenšit obří pole pro fotku zařízení, QR štítek a `🏷️ Fotka výrobního štítku + AI čtení údajů` do kompaktního 3sloupcového pruhu!
2) V záložce `Pasport & Shoda (61439)`: umožnit přímo doplnit, nahrát nebo vygenerovat chybějící dokumenty pasportu (`Liniové schéma`, `Výpočet oteplení`, `Vnější vlivy`) a upravit odpovědné osoby (`OOEZ` / `OPŘPČ`).
3) Přidat do detailu stroje/rozváděče přehled a správu **Červenek (`✏️ Červenky & Zákresy`)** daného zařízení.
4) Vybudovat komplexní systém **Prediktivního hlídání životnosti součástek a oficiálních Datasheetů**:
   - Zobrazovat všechny sledované součástky s **% zbývající životnosti (100 % -> 0 %)**, **předpokládaným datem konce životnosti**, **režimem provozu (1/2/3 směny, 24/7, četnost spínání relé/stykačů za hodinu, teplota v rozváděči)** a **oficiálním Datasheetem** přímo v záložce **`Kusovník`** (a propojit datasheety se záložkou `📚 Návody & Datasheety`).
   - V záložce **`🔍 Diagnostika & Spoje (Údržba)`** zobrazovat primárně součástky, které **překročily dobu životnosti (nebo jsou v kritickém okně k okamžité výměně)**.
   - Přidat **Nastavení předstihu upozornění** (pro každou součástku zvlášť i hromadně pro všechny) a **Souhrnný nákupní report pro oddělení nákupu (`📦 Nákupní report součástek před koncem životnosti`)**, který při prvním upozornění seskupí všechny součástky napříč závodem blížící se konci životnosti, aby nákup nemusel objednávat každý týden po jednom kusu.
5) Vylepšit sekci **`Revize & Plánovač` (`/revize`) a `Hlídač revizí` (`/hlidac-revizi`)** pro revizní techniky: přidat **Pochůzkový režim (řazení Budova ➔ Patro ➔ Místnost)**, **2D Lokalizační minimapu se špendlíkem („Kde přesně v budově a místnosti zařízení najdu“)**, **Kontrolní odpočet místnosti („Co v místnosti ještě zbývá najít“)** a **Rychlé řádkové převzetí hodnot z minulé revize**.

Zapiš tuto etapu jako Fázi 116 do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 6 částech:

================================================================================
ČÁST 1: NOVÉ ROZVRŽENÍ DETAILU STROJE A ROZVÁDĚČE (`/equipment/[id]`) – ZÁLOŽKY ÚPLNĚ NAHOŘE + KOMPAKTNÍ KARTY FOTEK A ŠTÍTKU
================================================================================

PROBLÉM (`{AB4A1C34...}.png` a `{C35CD2BC...}.png`):
- Na stránce `/equipment/[id]` jsou nahoře dva obří čtvercové boxy (`Zařízení zatím nemá fotografii` a `Přiřazený QR štítek`) a pod nimi obrovský prázdný černý obdélník `🏷️ Fotka výrobního štítku + AI čtení údajů` vysoký přes 500 px.
- Hlavní navigační záložky (`Schéma`, `Kusovník`, `3D rozváděč`...) jsou kvůli tomu utopené hluboko dole pod těmito boxy.

OPRAVA v `src/app/(app)/equipment/[id]/page.tsx` a souvisejících komponentách:
1. **Přesuň hlavní lištu záložek ÚPLNĚ NAHORU hned pod hlavičku zařízení (název, kód, budova, stav revize):**
   - Lišta záložek musí být první věc, kterou uživatel po otevření stroje nebo rozváděče okamžitě vidí bez jakéhokoliv rolování:
     * `📐 Schéma`
     * `📋 Kusovník & Životnost`
     * `✏️ Červenky (X)` *(nová záložka se seznamem polních zákresů tohoto stroje!)*
     * `🧊 3D rozváděč`
     * `🕒 Historie změn`
     * `🛡️ Pasport & Shoda (61439)`
     * `📅 Revize & Lhůtník`
     * `📚 Návody & Datasheety (X)` *(automaticky naplněno i z datasheetů součástek kusovníku!)*
     * `💾 Software & Zálohy PLC`
     * `🔍 Diagnostika & Spoje (Údržba)`
2. **Zmenši 3 boxy (`Fotka zařízení`, `Fotka výrobního štítku + AI OCR`, `Přiřazený QR štítek`) do kompaktního 3sloupcového pruhu (`grid-cols-1 md:grid-cols-3 gap-3`):**
   - Každá z těchto 3 karet musí mít v klidovém stavu **kompaktní výšku max. `120–145 px`** (horizontální rozvržení uvnitř karty: vlevo malý náhled fotky/štítku `88×88 px`, vpravo přečtené údaje `Výrobce, Model, S/N` a kompaktní tlačítka `[ 📷 Vyfotit štítek (AI) ]`, `[ 🖨️ Tisk QR ]`).
   - Přidej navíc tlačítko `[ ▴ Sbalit identifikační pruh ]`, aby měl uživatel při práci se schématem nebo kusovníkem maximální prostor na obrazovce!

================================================================================
ČÁST 2: DOKONČENÍ „PASPORT & SHODA (61439)“ (`{CF24609C...}.jpg`) + ZÁLOŽKA „ČERVENKY“ U STROJE
================================================================================

PROBLÉM (`{CF24609C...}.jpg`):
- V záložce `Pasport & Shoda (61439)` svítí `Pasport neúplný – chybí 3 z 5 dokumentů` (`Liniové schéma`, `Výpočet oteplení`, `Vnější vlivy`), ale chybějící položky nelze nijak doplnit ani vygenerovat.
- U stroje chybí přehled jeho Červenek.

OPRAVA:
1. **Interaktivní doplnění všech 5 dokumentů v `Pasport & Shoda (61439)`:**
   - U každé z 5 karet v sekci `Výrobní dokumentace rozváděče` (`EU prohlášení o shodě`, `Protokol o kusové zkoušce`, `Liniové schéma`, `Výpočet oteplení dle čl. 10.10.4 / IEC 60890`, `Protokol o určení vnějších vlivů dle ČSN 33 2000-5-51`):
     * Pokud dokument **chybí (`CHYBÍ V PASPORTU`)**, zobraz přímo na kartě 2 tlačítka:
       1) **`[ ⚡ Doplnit / Vygenerovat v ELDOCKu ]`** – otevře rychlý předvyplněný modal, kde uživatel za 10 vteřin potvrdí parametry (např. u *Výpočtu oteplení* rozměr skříně, ztrátový výkon ze součástek kusovníku a $\Delta T \le 30\text{ K}$; u *Vnějších vlivů* prostředí např. `AB5 / BA4 / AD1` dle ČSN 33 2000-5-51; u *Liniového schématu* propojí existující schéma ze záložky `Schéma`), uloží protokol do databáze a přepne kartu na zelený stav **`✅ V PASPORTU (Platný dokument)`** s tlačítky `👁️ Náhled` a `📥 Stáhnout PDF`!
       2) **`[ 📤 Nahrát vlastní PDF ]`** – umožní nahrát sken/PDF od výrobce.
     * Přidej také možnost jedním klikem upravit **Odpovědné osoby dle ČSN EN 50110-1 ed. 4 (`OOEZ` a `OPŘPČ`)** přímo v kartě LOTO.
2. **Seznam a správa Červenek přímo u stroje (`✏️ Červenky (X)`):**
   - V nové záložce `✏️ Červenky` (a v rychlém přehledu nad schématem) zobraz všechny polní zákresy a požadavky na změnu (`ChangeRequest` / `RedlineTask`) tohoto stroje/rozváděče:
     * Náhled zákresu, datum, autor z údržby, popis změny, dopad na bezpečnost dle EU 2023/1230, stav (`Čeká na překreslení`, `Přiřazeno internímu projektantovi`, `V ELDOCK Poolu`, `Schváleno do v1.1`) a tlačítka **`[ ✏️ Zakreslit novou Červenku do schématu ]`** a **`[ 🌐 Odeslat k překreslení projektantovi / do Poolu ]`**.

================================================================================
ČÁST 3: PREDIKTIVNÍ ŽIVOTNOST SOUČÁSTEK V KUSOVNÍKU + OFICIÁLNÍ DATASHEETY (`{D935E770...}.png` a `{C0C55CA8...}.png`)
================================================================================

Navrhni a kompletně propoj systém sledování životnosti součástek mezi záložkou **`Kusovník`**, **`Diagnostika & Spoje`** a **`📚 Návody & Datasheety`** (`src/lib/component-lifespan.ts`, `src/server/services/lifespan.ts`):

1. **VŠECHNY TYPY SOUČÁSTEK S PREDIKCÍ ŽIVOTNOSTI (AUTOMATICKÉ NAPÁROVÁNÍ NA POLOŽKY KUSOVNÍKU):**
   Každé položce v kusovníku stroje/rozváděče (`BomItem` / `MonitoredComponent`) automaticky přiřaď prediktivní model životnosti podle kategorie a dat výrobce:
   - **A) Elektromechanické spínací prvky (Stykače `-K`, Relé `-KA`, Motorové spouštěče `-Q`, Jističe `-F`, Tlačítka `-S`):**
     * Výpočet z **$B_{10d}$ / elektrické životnosti v cyklech** (např. stykač *Schneider LC1D25BD*: $B_{10d} = 1\,369\,863\text{ cyklů}$) podle **četnosti spínání (`cyklů/hod`)** a **směnnosti provozu** (`1 směna = 2 000 h/rok`, `2 směny = 4 000 h/rok`, `3 směny = 6 000 h/rok`, `24/7 = 8 760 h/rok`).
   - **B) Výkonová elektronika a řídicí technika (Spínané zdroje 24 V DC `-T`, Frekvenční měniče `-U`, Softstartéry, PLC `-A`):**
     * Výpočet z **motohodin a Arrheniova zákona tepelného stárnutí elektrolytických kondenzátorů** podle **směnnosti** a **teploty v rozváděči $T_{\text{rozv}}$ [°C]** ($L(T) = L_0 \cdot 2^{\frac{T_{\text{ref}} - T_{\text{rozv}}}{10}}$).
   - **C) Chlazení a filtrace rozváděče (Ventilátory `-FAN` – ložiska $L_{10}$, Filtrační rohože – kalendářní/provozní interval dle prašnosti).**
   - **D) Zálohovací baterie PLC/CNC, akumulátory UPS a nouzových svítidel (`-BT` – kalendářní a teplotní degradace).**
   - **E) Přepěťové ochrany SPD (`-FV` – kalendářní a impulzní opotřebení).**

2. **ZOBRAZENÍ ŽIVOTNOSTI A DATASHEETŮ PŘÍMO V ZÁLOŽCE `KUSOVNÍK` (`{D935E770...}.png`):**
   - Nad tabulku kusovníku přidej přehledný ovládací pruh provozu stroje:
     * **`Provozní režim stroje:`** `[ 1 směna (Po–Pá, 8h) ]` · `[ 2 směny (Po–Pá, 16h) ]` · `[ 3 směny (Po–Pá, 24h) ]` · `[ 24/7 Nepřetržitý ]`
     * **`Teplota v rozváděči:`** `[ 35 °C / 48 °C ]`
     * **`Předstih upozornění (všechny součástky):`** `[ 30 dní ] · [ 60 dní ] · [ 90 dní ] · [ 180 dní ]`
     * Tlačítko **`[ 📦 Souhrnný nákupní report součástek před koncem životnosti ]`**.
   - Do tabulky `Kusovník` doplň ke každému řádku (`Q1`, `F1..F6`, `K1..K4`, `T1`, `A1`, `X1..X2` i dalším sledovaným dílům jako `-FAN1`, `-U1`) tyto sloupce:
     1) **`Zbývající životnost (%)`:** Jasný barevný ukazatel **kolik % životnosti ZBÝVÁ** (`100 %` = nová ➔ `0 %` = konec životnosti; pokud je překročeno, ukaž `🔴 0 % zbývá (překročeno o +38 %)`!).
     2) **`Předpokládaný konec životnosti`:** Přesné vypočtené datum (např. `14. 11. 2028 (za 731 dní)` nebo `🔴 Překročeno – vyměnit ihned`).
     3) **`Parametry provozu (Spínání / Hodiny)`:** U stykačů a relé přímo v řádku zobraz a umožni kliknutím upravit **četnost spínání** (např. `45 sepnutí/hod` nebo `120 sepnutí/hod`) a u ostatních dílů odpracované motohodiny; změna okamžitě přepočítá % zbývající životnosti a datum konce!
     4) **`Sklad & Upozornění`:** Stav skladu (`🟢 Skladem: 2 ks` vs. `⚠️ 0 ks – Chybí!`, s možností upravit počet ks na skladě a individuální předstih upozornění `30/60/90/180 dní` pro tuto součástku) + tlačítko `[ 🔄 Vyměněno (Reset 100 %) ]`.
     5) **`📄 Oficiální Datasheet`:** Tlačítko **`[ 📄 Datasheet ]`**, které otevře detailní technický list dané součástky (s parametry výrobce Eaton, Siemens, ABB, Schneider Electric, Phoenix Contact, Weidmüller, Rittal, hodnotami $B_{10d}$ / MTBF, rozměry, schématem zapojení a přímým odkazem na oficiální PDF datasheet výrobce)!
   - **Propojení se záložkou `📚 Návody & Datasheety`:** Všechny oficiální datasheety součástek z kusovníku automaticky zobraz i v záložce `📚 Návody & Datasheety (X)`, takže u každého rozváděče a stroje bude tato záložka plná reálných technických listů použitých komponent!

3. **ZÁLOŽKA `🔍 DIAGNOSTIKA & SPOJE (ÚDRŽBA)` (`{C0C55CA8...}.png`) PRO SOUČÁSTKY PO ŽIVOTNOSTI:**
   - V záložce `Diagnostika & Spoje (Údržba)` zobrazuj v horní sekci primárně **kritické součástky, které již přesáhly dobu životnosti (zbývá `0 %` / opotřebení `≥ 100 %`) nebo jsou pod prahem upozornění** (s přepínačem `[ 🔴 Jen po životnosti a kritické (X) ]` vs. `[ Zobrazit všechny ]`), aby údržbář v diagnostice okamžitě viděl, co musí dnes vyměnit!

================================================================================
ČÁST 4: SOUHRNNÝ NÁKUPNÍ REPORT SOUČÁSTEK PŘED KONCEM ŽIVOTNOSTI (PRO ODDĚLENÍ NÁKUPU)
================================================================================

Aby nákupčí ve výrobním závodě nemusel každý týden objednávat jednu součástku zvlášť:
1. Vytvoř službu a přehledové okno / stránku **`📦 Nákupní report prediktivní údržby (Konsolidovaná objednávka náhradních dílů)`** (dostupné z Kusovníku stroje, z Diagnostiky i z horního menu `⚡ Rozváděče & Stroje`):
   - **Logika spuštění (Smart Batch Trigger):** Jakmile **kterákoliv první součástka** v závodě dosáhne svého nastaveného předstihu upozornění (např. `zbývá ≤ 60 dní` nebo `≤ 15 % životnosti`), systém automaticky vyhledá **všechny součástky napříč celým závodem (všemi stroji a rozváděči)**, kterým končí životnost v nastavitelném nákupním okně (**`Výhled nákupu: [ +60 dní ] · [ +90 dní ] · [ +180 dní ] · [ +365 dní ]`**).
   - **Seskupení podle objednacích čísel (MPN):** Pokud končí životnost např. u 4 stykačů `LC1D25BD` v Hale A a 2 stykačů `LC1D25BD` v Hale B, report je sečte do jednoho řádku:
     * `Výrobce` (`Schneider Electric`), `Objednací číslo MPN` (`LC1D25BD`), `Popis`, `Potřebný počet ks k výměně` (`6 ks`), `Aktuálně skladem` (`1 ks`), **`Nutno doobjednat na sklad` (`5 ks`)**, `Seznam strojů a nejbližší datum výměny`.
   - **Nastavení automatického zasílání e-mailem pro nákup:** Umožni nastavit e-mail nákupního oddělení (např. `nakup@...`), frekvenci souhrnného reportu (`Při prvním varování + souhrn za 90 dní` / `1× měsíčně` / `1× čtvrtletně`) a export na 1 klik do **XLSX / CSV / PDF** (i do formátu pro elektro-velkoobchody Sonepar, Elkov, K&V Elektro)!

================================================================================
ČÁST 5: VYLEPŠENÍ SEKCE „REVIZE & HLÍDAČ REVIZÍ“ PRO REVIZNÍ TECHNIKY – POCHŮZKOVÁ TRASA A 2D LOKALIZACE V BUDOVĚ (`{07787EEE...}.jpg`)
================================================================================

PROBLÉM (`{07787EEE...}.jpg`):
- Seznam v `Chytré revizi` a `Lhůtníku` řadí zařízení podle počtu dní po termínu napříč celým areálem (`Hala B`, pak `Hala A`, pak `Energetika`, pak `Sklad`), takže by revizní technik musel běhat tam a zpět mezi budovami.
- Technik navíc u položky (např. `PP-0031 Prodlužovací buben` v `Hala A - 1. NP`) nevidí, **kde přesně v hale nebo v kanceláři** se dané zařízení nachází!

OPRAVA v `/revize` a `/hlidac-revizi`:
1. **🚶‍♂️ Pochůzkový režim (Optimalizovaná trasa technika po budovách, patrech a místnostech):**
   - Do hlavičky `Chytré revize` i `Lhůtníku` přidej výrazný přepínač řazení:
     **`Řazení výjezdu: [ 🚶‍♂️ Pochůzková trasa technika (Budova ➔ Patro ➔ Místnost) ]` · `[ ⏰ Podle urgencí a expirace ]`**.
   - V režimu **Pochůzková trasa** seskup vybraná zařízení do přehledných bloků podle budov, pater a místností/zón (např. *Zastávka 1: Hala A – 1. NP Hlavní výroba (4 zařízení) ➔ Zastávka 2: Hala A – 2. NP Vzduchotechnika (1 zařízení) ➔ Zastávka 3: Hala B – 1. NP (2 zařízení)*), takže technik projde každou místnost jen jednou!

2. **📍 2D Lokalizátor „Kde přesně to v budově najdu“ (Minimapa patra s blikajícím špendlíkem u každé položky):**
   - Ke každému zařízení v seznamu revizí vypiš kromě budovy a patra také **přesnou zónu / místnost / osový kříž sloupu nebo pracovní místo** (např. `📍 Osový kříž B3 · Lisovací linka` nebo `📍 Kancelář 204 · Pracovní místo u okna`).
   - Přidej na každý řádek tlačítko **`[ 📍 Ukázat místo na mapě patra ]`**:
     * Kliknutím se přímo pod řádkem (nebo v bočním náhledu) rozbalí **2D půdorys daného patra budovy s jasně svítícím a pulzujícím špendlíkem hledaného zařízení**, vyznačeným vchodem/vraty a náhledem fotky zařízení a výrobního štítku!
     * Pokud je vybrána celá budova, zobraz na mapě patra **očíslované špendlíky `1 ➔ 2 ➔ 3 ➔ 4` spojené čárkovanou pochůzkovou trasou**, aby revizní technik na první pohled viděl kudy v hale jít!

3. **⚡ Rychlé řádkové měření „Předvyplnit z minulé revize“ + Kontrola místnosti:**
   - Umožni reviznímu technikovi přímo v pochůzkovém seznamu kliknout na **`[ ⚡ Rychlý zápis na 1 klik (hodnoty dle minulé revize) ]`**, kde jen potvrdí nebo přepíše naměřenou hodnotu ($R_{\text{iso}}$, $R_{\text{PE}}$, $Z_s$) a položka se okamžitě označí jako hotová se započítáním do postupu pochůzky (`Hotovo 5 z 16 zařízení v dnešním výjezdu`).

================================================================================
ČÁST 6: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit a integrační testy ověřující:
   - Že výpočet životnosti součástek v kusovníku správně vrací **zbývající % životnosti (100 % -> 0 %)** a předpokládané datum konce životnosti podle směnnosti (`1 / 2 / 3 směny / 24/7`), četnosti spínání a teploty.
   - Že Souhrnný nákupní report (`generateLifespanPurchaseReport`) při dosažení prahu upozornění u první součástky seskupí všechny součástky před koncem životnosti v zadaném horizontu (např. 90/180 dní) a spočítá kusy k doobjednání na sklad.
   - Že v `Pasport & Shoda (61439)` lze doplnit chybějící dokumenty (`Výpočet oteplení`, `Vnější vlivy`, `Liniové schéma`) a přepnout pasport na kompletní stav `5 z 5`.
   - Že v `/revize` funguje přepnutí na `Pochůzkovou trasu (Budova -> Patro -> Místnost)` a zobrazení 2D lokalizační mapky zařízení.
2. Spusť `npm run verify` a `npm run docs:bundle`, udělej commit a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Migrace `20261114160000_phase116_lifespan_passport_walk` (jen přidané sloupce a tabulka `SparePartStock` – před
nasazením záloha). Start kontejneru doplní ukázková data jednorázově (`db:demo-lifespan`, značka `demo.phase116`).

**1. Detail stroje a rozváděče** (`app/(app)/equipment/[id]/page.tsx`, `DocumentationTabs.tsx`, `EquipmentIdentityStrip.tsx`)

- Lišta záložek je hned pod hlavičkou (📐 Schéma · 📋 Kusovník & Životnost · ✏️ Červenky (X) · 🧊 3D rozváděč ·
  🕒 Historie změn · 🛡️ Pasport & Shoda (61439) · 📅 Revize & Lhůtník · 📚 Návody & Datasheety (X) · 💾 Software &
  Zálohy PLC · 🔍 Diagnostika & Spoje (Údržba)); při 1440 × 900 končí kolem 440 px od horního okraje okna.
- Upozornění (neplatný QR štítek, zneplatněná revize, otevřená změna, provizoria) a kompaktní identifikační pruh jsou
  mezi lištou záložek a obsahem. Pruh má 3 karty `grid-cols-1 md:grid-cols-3` po 133 px (náhled 88 × 88 px; fotka
  zařízení, výrobní štítek s hodnotami Výrobce / Model / S/N a „📷 Vyfotit štítek (AI)“, QR kód s „🖨️ Tisk QR“).
  „▴ Sbalit identifikační pruh“ si pamatuje prohlížeč. Tvář QR štítku 62 × 29 mm je v náhledu po kliku na QR kód,
  potvrzení údajů přečtených AI je v dialogu.
- Karty, které nejsou identifikace (zálohování napájení, rozváděč z BIMu, pasport AI Panel Builderu), jsou v záložce
  Pasport & Shoda.

**2. Pasport & Shoda (61439) a Červenky** (`CompliancePassport.tsx`, `PassportDocActions.tsx`, `passport-docs.ts`,
`services/passport.ts`, tisková stránka `/equipment/[id]/pasport/[docId]`)

- Chybějící dokument má na kartě „⚡ Doplnit / Vygenerovat v ELDOCKu“ a „📤 Nahrát vlastní PDF“; dokument v pasportu
  „✅ V PASPORTU (Platný dokument)“ s „👁️ Náhled“ a „📥 Stáhnout PDF“ (tisková podoba → „Uložit jako PDF“).
- Liniové schéma se propojí se schématem platné revize ze záložky Schéma. Výpočet oteplení IEC TR 60890 (stávající
  `calculateThermal`): rozměr skříně je odhad podle počtu DIN lišt kusovníku (uživatel ho přepíše), Pv z technického
  listu / katalogu výrobce, jinak ho uživatel musí doplnit (odhadem se nedoplňuje), ΔT pod stropem ≤ 30 K. Vnější vlivy:
  kódy ČSN 33 2000-5-51 ed. 3 předvyplněné z karty zařízení, návrh závěru (normální / nebezpečný / zvlášť nebezpečný)
  potvrzuje komise. EU prohlášení o shodě ELDOCK připraví, vydává a podepisuje ho výrobce rozváděče (uvedeno
  v dialogu). Kusová zkouška čl. 11.2–11.10 se uloží až po potvrzení, že byla provedena.
- Odpovědné osoby OOEZ / OPŘPČ (ČSN EN 50110-1 ed. 4) se upravují jedním klikem v kartě LOTO (jméno a telefon).
- Záložka ✏️ Červenky: všechny požadavky na změnu stroje (zákres, datum, autor, popis, dopad dle Nařízení (EU)
  2023/1230, stav Čeká na překreslení / Přiřazeno internímu projektantovi / V ELDOCK Poolu / Schváleno do vX.Y),
  „✏️ Zakreslit novou Červenku do schématu“ a u otevřeného požadavku „🌐 Odeslat k překreslení projektantovi / do
  Poolu“; nad schématem rychlý přehled.

**3. Životnost součástek a datasheety** (`component-lifespan.ts`, `bom-lifespan.ts`, `component-datasheets.ts`,
`datasheet-view.ts`, `services/lifespan-report.ts`, `BomLifespanTable.tsx`, `ComponentLifespan.tsx`)

- Každá položka kusovníku zobrazené revize dostane model A–E podle označení (-K, -KA, -Q, -F, -S, -T, -U, -A, -FAN,
  -BT, -FV) a popisu; svorky a pojistky jsou bez opotřebení. Uložená sledovaná součástka se stejným označením má
  přednost (i když je jiného typu než v kusovníku – řádek to uvede). Instalace dílů = 1. 1. roku instalace stroje,
  dokud se nezapíše výměna.
- Limity: z ověřeného technického listu výrobce, jinak výchozí odhad kategorie, vždy označený „odhad“ (stykač 30 sepnutí/h
  a 1 000 000 cyklů, jistič 4 000 cyklů a 0,01 sepnutí/h, zdroj / měnič 50 000 h a PLC 100 000 h při 40 °C s Arrheniem,
  ventilátor L10 40 000 h, filtrační rohož 6 měsíců, baterie 4 roky při 25 °C (+10 °C = polovina), SPD kontrola po
  10 letech a 15 výbojích In podle zkoušky provozní výdrže ČSN EN 61643-11).
- **Odchylka – datasheety:** ověřené údaje výrobce jsou jen u Schneider Electric LC1D25BD (technický list z se.com,
  14. 11. 2026: B10d 1 369 863 cyklů, el. životnost 1,65 mil. AC-3, mech. 30 mil., 1,25 W/pól, 45 × 85 × 101 mm),
  Rittal SK 3238.100 / .200 (L10 68 200 h při 40 °C) a u dílů z katalogu AI Panel Builderu (např. ABB S201-C2: Pv,
  rozměry, list ABB). Siemens 5SY, S7-1500, SITOP, Phoenix Contact QUINT4, Eaton P3 a další se nepodařilo ověřit
  (stránky výrobců automatické načtení odmítají) – mají životnost odhadem a obecné značení svorek, nic se nevymýšlí.
  Phoenix QUINT4-PS/3AC/24DC/10 je položka 2904621 (2904601 je jednofázový 1AC).
- Zbývající životnost 100 % → 0 %, po překročení „🔴 0 % zbývá (překročeno o +N %)“ a „🔴 Překročeno – vyměnit
  ihned“; konec za více než 50 let se uvádí slovy (jističe spínané výjimečně).
- Předstih upozornění 30 / 60 / 90 / 180 dní hromadně pro stroj i zvlášť pro součástku; v okně upozornění je součástka
  i při zbývajících ≤ 15 %. Sklad: díl s objednacím číslem má sklad závodu (`SparePartStock`, platí pro všechny stroje),
  díl bez MPN počet u součástky; výměna odepíše kus ze skladu.
- Diagnostika ukazuje nahoře jen součástky po životnosti a v okně upozornění („🔴 Jen po životnosti a kritické (X)“ /
  „Zobrazit všechny“). Návody & Datasheety: ověřené technické listy dílů kusovníku se započítají do počtu záložky.

**4. Nákupní report** (`lifespan-purchase.ts`, `/nakupni-report`, tisk `/nakupni-report/tisk`)

- Spustí ho první součástka závodu v předstihu upozornění nebo po životnosti; pak sečte všechny součástky závodu, kterým
  životnost končí ve výhledu +60 / +90 / +180 / +365 dní, podle objednacího čísla (potřeba, skladem, nutno doobjednat,
  stroje a nejbližší výměna). Součástky bez objednacího čísla jsou zvlášť.
- Exporty XLSX, CSV, PDF (tisk) a košík pro velkoobchod. **Odchylka:** importní formáty e-shopů Sonepar, Elkov a K&V
  Elektro nebyly ověřené – košík je obecná rychlá objednávka (objednací číslo výrobce; množství; výrobce; popis).
- E-mail oddělení nákupu (nastavení závodu): při prvním varování (jen když je v předstihu součástka, kterou minulý souhrn
  nepokryl), 1× měsíčně (1. den) nebo 1× čtvrtletně (1. den ledna, dubna, července, října); denní údržba, SMTP jinak
  záznam v logu notifikací; ruční odeslání s limitem e-mailů. Dostupné z kusovníku, diagnostiky a z menu „⚡ Rozváděče &
  Stroje“ (oprávnění Zadat změnu).

**5. Pochůzka revizního technika** (`revision-walk.ts`, `RevisionWalkRoute.tsx`, `FloorMiniMap.tsx`, `/revize`,
`/hlidac-revizi`)

- „Řazení výjezdu: 🚶‍♂️ Pochůzková trasa technika (Budova ➔ Patro ➔ Místnost) · ⏰ Podle urgencí a expirace“ v Chytré
  revizi i Lhůtníku (`?razeni=trasa`) a v Hlídači revizí. Zastávky po místnostech, na patře nejbližším sousedem od
  prvních vrat; každá místnost jen jednou.
- „📍 kde to najdu“: místnost (přiřazená, jinak zóna pod pinem), osový kříž (nejbližší průsečík rastru) a upřesnění
  místa (nové pole `locationNote`). „📍 Ukázat místo na mapě patra“ rozbalí půdorys s pulzujícím špendlíkem, vraty
  a fotkami zařízení a štítku; „🗺️ Trasa po patře“ očísluje špendlíky a spojí je čárkovanou trasou.
- „⚡ Rychlý zápis na 1 klik“ zapíše dnešní periodickou revizi VYHOVUJE s R_iso, R_PE a Z_s (nový sloupec) předvyplněnými
  z minulé revize; nevyhovující výsledek se zapisuje plným formulářem se závadami, jeden zápis za den. Postup „Hotovo X
  z Y zařízení v dnešním výjezdu“ a kontrolní odpočet místnosti „Zbývá najít …“.

**Ukázková data:** sklad LC1D25BD 1 ks a S201-C2 2 ks, upřesnění míst u 6 zařízení, odpovědné osoby LOTO u RM1;
oprava filtrační rohože -FAN1 (Rittal SK 3238.200 je výstupní filtr, ne rohož – objednací číslo náhradní rohože
doplní údržba).
