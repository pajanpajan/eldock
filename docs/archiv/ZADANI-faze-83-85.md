# Zadání fází 83–85 – plocha 2D půdorysu, bankovní účet pro QR platby a výběr konkrétní rozvodnice

Vloženo z chatu 2026-11-10. Celé zadání beze změn je níže, za ním poznámky k ověření údajů a k rozdělení do fází
(83 = bod 1, 84 = bod 2, 85 = body 3 a 4).

## Zadání (z chatu)

Potřebujeme udělat 2 důležité úpravy v 2D půdorysu a ve fakturaci / dobíjení kreditů:

1. NASTAVITELNÁ VELIKOST PLÁTNA V 2D PŮDORYSU (`/panel-builder/floorplan`) PRO VELKÉ DOMY A HALY (15×14 m AŽ 100×100 m):
- V současnosti je čistý rastr půdorysu omezený na pevnou plochu `14 × 10 m`, takže na něj nelze od nuly nakreslit např. dům `15 × 14 m` nebo větší objekt.
- V horní nástrojové liště 2D půdorysu (vpravo, kde je nyní statický text `Plocha 14 × 10 m`) nahraď tento text interaktivním ovládáním rozměru plochy:
  * Zobraz editovatelná číselná pole **`Plocha: Šířka X [ 20 ] m × Hloubka Y [ 16 ] m`** (rozsah `5 m` až `100 m`, výchozí hodnotu pro nový čistý rastr zvedni ze `14 × 10 m` na **`20 × 16 m`**, aby se běžný rodinný dům 15×14 m s rezervou vešel hned napoprvé!).
  * Přidej vedle polí rychlé předvolby velikosti plochy (dropdown nebo tlačítka):
    - `Byt / Menší RD (14 × 10 m)`
    - `Rodinný dům standard (20 × 16 m)` *(výchozí)*
    - `Velký RD / Vila s dvojgaráží (30 × 22 m)`
    - `Provozovna / Hala (50 × 35 m)`
    - `Vlastní rozměr (až 100 × 100 m)`
  * **Automatické přizpůsobení mřížky, zoomu a posunu (Pan & Zoom):**
    - Při změně rozměru plochy (např. na `20 × 16 m` nebo `30 × 25 m`) zachovej pozice již nakreslených místností a prvků v metrech `(x, y)` beze změny, pouze rozšiř rastr (mřížku po 1 m a jemnou mřížku po 0,25 m / 0,5 m) a přidej tlačítko **`[ ⛶ Přizpůsobit pohled (Fit) ]`**, které celý půdorys vycentruje do okna.
    - Pokud uživatel nakreslí nebo posune místnost blízko k pravému nebo dolnímu okraji plátna, automaticky nabídni nebo rozšiř plochu půdorysu o dalších `+5 m`, aby nikdy nenarazil na umělou zeď!
    - Ukládej zvolený rozměr plochy (`canvasWidthM`, `canvasHeightM`) přímo do dat projektu půdorysu (cloud DB, `localStorage` i export `.eldock.json`), do PDF tisku i do DXF exportu.

2. NASTAVENÍ OFICIÁLNÍHO BANKOVNÍHO ÚČtu PRO QR PLATBY (SPD) A ZÁLOHOVÉ FAKTURY:
Aktualizuj výchozí bankovní spojení dodavatele v `src/lib/company.ts`, v generátoru českého platebního QR kódu (SPD 1.0) a na tiskové sestavě zálohové faktury při dobíjení kreditů (`/panel-builder/credits` a `/superadmin`) na tyto přesné údaje (Raiffeisenbank):
- **Číslo účtu (CZ):** `918118002/5500`
- **IBAN:** `CZ1755000000000918118002` *(pro zobrazení na faktuře naformátuj čitelně jako `CZ17 5500 0000 0009 1811 8002`, do SPD QR řetězce vkládej bez mezer `ACC:CZ1755000000000918118002+RZBCCZPP` nebo `ACC:CZ1755000000000918118002` dle standardu ČBA SPD 1.0)*
- **SWIFT / BIC:** `RZBCCZPP`
- **Banka:** `Raiffeisenbank a.s.`
- Zkontroluj, že v `.env.example`, v `src/lib/company.ts` i v unit testech pro generování SPD QR platby je tento IBAN `CZ1755000000000918118002`, účet `918118002/5500` a SWIFT `RZBCCZPP` nastaven jako primární hodnota, takže naskenování QR kódu v mobilním bankovnictví kterékoliv české banky okamžitě předvyplní platbu na účet `918118002/5500`.


Provedeme další rozšíření AI Panel Builderu (součást Fáze 57) – přidání volitelného, ale vysoce přesného úvodního kroku pro výběr konkrétní rozvodnice a finálního vizuálního náhledu v posledním kroku:

3. VOLITELNÝ ÚVODNÍ KROK V AI PANEL BUILDERU (VÝBĚR KONKRÉTNÍ ROZVODNICE):
- Hned na začátku zakládání nového projektu (nebo v prvním kroku po kliknutí na "Navrhnout od nuly" / "Pasportizovat z fotky") přidej volitelný krok: **"Výběr konkrétní skříně / rozvodnice (Volitelné)"**.
- Pokud uživatel typ rozvodnice zná (např. potřebuje oddělit silnoproudou část od modulů pro chytrou domácnost, nebo volí konkrétní podomítkovou/nástěnnou skříň), provede ho 3stupňová kaskáda:
  1) **Výrobce rozvodnice:** `ABB` · `Eaton` · `Hager` · `Rittal` · `Schneider Electric` · `Schrack`.
  2) **Typová řada:** Např. u ABB: *Mistral (IP41/IP65)*, *Unifix*, *ComfortLine CA / CW*; u Eaton: *xEnergy Light (KLV)*, *DBP / DBM*; u Hager: *Vector (IP65)*, *Univers*; u Rittal: *AX / KX*.
  3) **Konkrétní model (skříň):** Vybere konkrétní rozměr a provedení (např. *ABB Mistral65 – 3 řady po 18 modulech (54M)*, nebo *Hager Univers podomítková 4řadá (72M)*).
- Tento krok je striktně **volitelný** (pokud uživatel nic nevybere, systém funguje jako doposud a rozměr/skříň dopočítá automaticky podle počtu modulů). Pokud ale konkrétní skříň zvolí, systém ji natvrdo zafixuje jako cílovou skříň, omezí maximální počet modulů na řadu podle tohoto modelu a připraví ji do výstupu.

4. FINÁLNÍ KROK: NÁHLED ROZVÁDNICE, POPIS, TYPOVÉ A OBJEDNACÍ ČÍSLO:
- V posledním kroku AI Panel Builderu (a v záložce výstupní dokumentace / kusovníku) vytvoř přehlednou sekci **"Zvolená rozvodnice a skříň"**:
  * **Vizuální náhled rozvodnice:** Vykresli detailní 2D render zvolené skříně (s dvířky / bez dvířek, s osazenými DIN lištami a přístroji).
  * **Technický popis:** Uveď kompletní popis (např. *Plastová nástěnná rozvodnice Mistral65, IP65, transparentní dvířka, kapacita 3× 18 modulů*).
  * **Typové označení (Type designation):** Přesný typ výrobce (např. `1SLM006500A1222` / `Mistral65`).
  * **Objednací číslo (MPN):** Oficiální objednací kód pro velkoobchod (např. pro e-shop kupabb.cz / Eaton / Hager).
  * Tlačítko `[ 📋 Zkopírovat objednací údaje rozvodnice ]` a propojení do kusovníku (BOM).

Po implementaci spusť `npm run verify`, aktualizuj unit testy, zapiš stav do docs/PLAN.md, udělej commit a pushni změny na server (eldock.cz).

## Ověření a rozdělení

| Bod | Fáze | Ověření / poznámka |
|---|---|---|
| 1 | 83 | Plocha nákresu je dál `FloorplanDraft.widthMm` / `heightMm` (a stejná pole u podlaží) v mm – ukládá se s nákresem do cloudu, prohlížeče i do `.eldock.json` beze změny formátu (názvy `canvasWidthM` / `canvasHeightM` ze zadání by stejný údaj zdvojily). Starší nákres bez plochy se otevře jako 14 × 10 m. |
| 2 | 84 | IBAN CZ17 5500 0000 0009 1811 8002 má platnou kontrolní číslici (ISO 13616, zbytek po dělení 97 = 1), číslo účtu 0918118002 projde váhovou kontrolou ČNB (mod 11) a z IBAN vychází přesně 918118002/5500. QR platba nese `ACC:CZ1755000000000918118002+RZBCCZPP` (BIC je podle ČBA SPD 1.0 volitelný). |
| 3 | 85 | Kaskáda čte katalog skříní Eldocku: ABB, Eaton, Hager a Schneider Electric mají rozvodnice z katalogu výrobců s objednacím číslem (např. ABB Mistral65 3 × 18 M = 1SLM006501A1208), Rittal a Schrack zatím jen orientační typy (`STD-…`, „ověřte“). Řady ze zadání, které katalog nevede (ABB Unifix a ComfortLine CW, Eaton DBP / DBM, Hager Vector a Univers, Rittal KX), se nevymýšlí – doplní je až ověřený katalog výrobce. |
| 4 | 85 | Náhled čela je výkres listu 2 (lišty a přístroje návrhu) s volitelnými dvířky; druh dvířek katalog skříní nevede, náhled je orientační (ocelová a zapuštěná skříň plná, plastová na omítku kouřová). |
