# Zadání fáze 106 – výroba rozváděče na klíč: CNC vrtací plán 1:1 (DXF + CSV), nářezový a drátovací list, zasmluvnění výrobci a portál /vyroba-rozvadecu s uzamčením Verze 1.0 pod QR štítkem

Vloženo z chatu 2026-11-12 (během fáze 104). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Rozšiřujeme AI Panel Builder o přelomovou B2B funkci: **Konfigurace a zakázková výroba rozváděče na klíč (Turnkey Switchboard Manufacturing + CNC & Shop-Floor Data Package)**.

Zákazník si v AI Panel Builderu rozmístí DIN lišty, nasadí a propojí modulární přístroje, nastaví parametry skříně (vývodky, dveřní prvky, krytí) a program automaticky vygeneruje:
1) Kompletní výrobní podklady pro dílnu a CNC stroje (DXF 1:1 vrtací a frézovací šablony, Nářezový a drátovací list vodičů `Odkud -> Kam` s délkami a dutinkami, Nářezový list lišt, žlabů a hřebenů).
2) Kompletní 6listovou dokumentaci dle ČSN EN IEC 61439.
3) Okamžité odeslání poptávky/objednávky zasmluvněnému výrobci rozváděčů, který rozváděč vyrobí, osadí, prodrátuje, vyplní výstupní kusovou zkoušku, nalepí unikátní QR štítek ELDOCK (`https://eldock.cz/q/EL-xxxxxx`) odkazující na uzamčenou cloud dokumentaci a odešle hotový rozváděč zákazníkovi!

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: KONFIGURÁTOR MECHANICKÝCH A VÝROBNÍCH PARAMETRŮ SKŘÍNĚ (`src/lib/panel-builder/cnc-manufacturing-engine.ts`)
================================================================================

Rozšiř konfiguraci rozváděče (v Kroku 1b `Skříň rozváděče` a v novém panelu `🏭 Výrobní podklady (CNC & Drátování)`) o automatický návrh a možnost doladění mechanického provedení skříně:

1. AUTOMATICKÝ NÁVRH KABELOVÝCH VÝVODEK / PRŮCHODEK PODLE OKRUHŮ:
   - Ze seznamu okruhů (přívodní kabel + všechny vývodové kabely z půdorysu nebo stromu zapojení) automaticky spočítej optimální sadu kabelových vývodek / membránových průchodek podle vnějšího průměru kabelů:
     * Hlavní přívod (`CYKY 5×10` / `5×16` / `4×25`) -> **`1× Vývodka M32 / M40`** (s maticí a odlehčením tahu),
     * Silové 3f vývody (`CYKY 5×2,5` / `5×4` / `5×6`) -> **`Vývodky M20 / M25`**,
     * Koncové 1f okruhy (`CYKY 3×1,5` / `3×2,5`) a sběrnicové kabely -> **`Vývodky M16 / M20`** (nebo vícenásobná membránová příruba u zapuštěných rozvodnic).
   - Umožni uživateli zvolit směr přívodu kabelů do skříně: **`[ ⬆️ Shora ]` · `[ ⬇️ Zespodu ]` · `[ ↕️ Shora i zespodu ]`** a typ montáže (`Pod omítku / Do SDK` vs. `Nástěnná / Stojanová s vývodkami`).

2. AUTOMATICKÉ ROZMÍSTĚNÍ DIN LIŠT, KABELOVÝCH ŽLABŮ A DVEŘNÍCH PRVKŮ:
   - Spočítej přesnou geometrii vnitřní montážní desky / rámu v milimetrech:
     * Pozice a délky všech **DIN lišt `TS 35 × 7,5 / 15 mm`** (včetně souřadnic vrtacích otvorů M5/M6 na krajích lišt),
     * Pozice a délky **perforovaných kabelových žlabů** (vodorovné žlaby mezi řadami DIN lišt + svislé postranní žlaby, např. `40×60 mm` nebo `25×60 mm`),
     * Pozice **PE a N sběrnic** (`PE`, `N-hlavní`, `N1`, `N2`, `N3` držáky za chrániči),
     * Případné **výřezy ve dveřích nebo bočnicích skříně** (např. větrací mřížka / ventilátor s filtrem `120×120 mm`, pokud to vyžaduje výpočet oteplení v Kroku 3; tlačítko `CENTRAL STOP Ø 22,5 mm`; kontrolky fází `L1/L2/L3 Ø 22,5 mm`; multimetr `92×92 mm`).

================================================================================
ČÁST 2: GENERÁTOR CNC PODKLADŮ (DXF 1:1 + CSV) A NÁŘEZOVÉHO / DRÁTOVACÍHO LISTU VODIČŮ
================================================================================

Vytvoř deterministický generátor výrobních dat (`generateManufacturingPackage(project)`), který na 1 klik vytvoří kompletní podklady pro výrobu skříně:

1. **CNC VRTACÍ A FRÉZOVACÍ ŠABLONA 1:1 (`.dxf` a `.csv` pro Perforex / Steinhauer):**
   - Vygeneruj platný CAD výkres **`CNC-Vrtaci-a-frezovaci-plan-1-1.dxf`** v měřítku **1:1 v milimetrech**, rozdělený do standardních CNC hladin (Layers):
     * `0_OBRYS_SKRINE_A_DESKY` (vnější rozměr montážní desky, dveří a kabelových čel v mm),
     * `1_CNC_VRTANI_ZAVITY` (přesné středy děr `[X, Y]` a průměry `Ø 4.2 mm / M5`, `Ø 5.0 mm / M6` pro uchycení DIN lišt TS 35, kabelových žlabů a PE/N držáků),
     * `2_CNC_VYREZY_DVERE` (kruhové otvory `Ø 22.5 mm` pro návěstidla/tlačítka a obdélníkové výřezy pro ventilaci/měřidla),
     * `3_CNC_VYVODKY_CELA` (rozmístění a průměry otvorů pro kabelové vývodky `M16 = Ø 16.5 mm`, `M20 = Ø 20.5 mm`, `M25 = Ø 25.5 mm`, `M32 = Ø 32.5 mm`, `M40 = Ø 40.5 mm` v horním/spodním čele skříně),
     * `4_OSAZENI_PRISTROJU_KOTY` (obrysy přístrojů na DIN lištách s popisem `-F1`, `-FA1` a kótami).
   - Současně vygeneruj strojový CSV soubor souřadnic otvorů a výřezů (`X_mm; Y_mm; Typ_operace; Prumer_nebo_Rozmer_mm; Hladina`), který lze přímo nahrát do CNC center (Kiesling Perforex / Rittal / Steinhauer).

2. **NÁŘEZOVÝ A DRÁTOVACÍ LIST VODIČŮ (`Wire Harness & Cut List` – CSV / XLSX / PDF):**
   - Ze stromu zapojení a 2D rozmístění přístrojů na DIN lištách automaticky vygeneruj tabulku **všech vnitřních vodičů v rozváděči** (pro automatické střihačky Komax / Schleuniger i pro ruční drátování):
     * `Číslo vodiče` (`W001`, `W002`...),
     * `Odkud (Přístroj : Svorka)` (např. `-Q1 : 2 (L1)` nebo `-FA1 : N-out`),
     * `Kam (Přístroj : Svorka)` (např. `-FA1 : 1 (L1)` nebo `Sběrnice N1 : Svorka 1`),
     * `Typ a průřez vodiče` (např. `H07V-K (CYA) 10 mm²`, `H07V-K 6 mm²`, `H07V-K 2,5 mm²`, `H07V-K 1,5 mm²`),
     * `Barva vodiče` (`Černá / Hnědá (L)`, `Světle modrá (N)`, `Zelenožlutá (PE)`, `Červená / Modrá (Ovládání)`),
     * `Přesná délka vodiče [mm]` (spočítaná po ortogonální trase přes vodorovné a svislé kabelové žlaby mezi souřadnicemi svorek + `90 mm` rezerva na ohyb do svorky!),
     * `Zakončení Konce A / Konce B` (`Dutinka 10 mm² / 12 mm`, nebo **`Dvojitá TWIN dutinka 2×10 mm²`** tam, kde ze svorky pokračuje smyčka do dalšího chrániče!).
   - Pokud jsou přístroje v jedné řadě propojeny **propojovacím hřebenem (lištou)**, označ tyto spoje jako `Hřebenová přípojnice 3P / 1P 10 mm² (délka X modulů / Y mm)` a vyřaď je z drátování ohebnými vodiči!

3. **NÁŘEZOVÝ LIST LIŠT, ŽLABŮ A HŘEBENŮ:**
   - Přehledná tabulka přesných délek v mm pro uříznutí na pile/nůžkách: kolik kusů a jakých délek DIN lišt `TS 35`, kabelových žlabů a propojovacích hřebenů je potřeba.

================================================================================
ČÁST 3: SYSTÉM ZASMLUVNĚNÝCH VÝROBCŮ ROZVÁDĚČŮ A POPTÁVKA VÝROBY NA KLÍČ (`/vyroba-rozvadecu`)
================================================================================

Propoj konfigurátor rozváděče s našimi zasmluvněnými výrobci rozváděčů (Contracted Panel Builders Marketplace):

1. TLAČÍTKO V AI PANEL BUILDERU: **`[ 🏭 Poptat / Objednat výrobu rozváděče na klíč ]`** (v Kroku 1b i v Kroku 4):
   - Otevře čistý modal **`Objednávka výroby rozváděče na klíč u certifikovaného výrobce ELDOCK`**, kde zákazník vidí:
     * **Co dostane hotové na stavbu:** Kompletně osazený, prodrátovaný a otestovaný rozváděč podle jeho návrhu, s protokolem o kusové zkoušce, EU prohlášením o shodě, popisky jističů a **nalepeným odolným stříbrným QR štítkem ELDOCK (`https://eldock.cz/q/EL-xxxxxx`)**, pod kterým je v cloudu uzamčená kompletní dokumentace!
     * **Orientační kalkulaci ceny výroby na klíč:** Materiál + Montáž, drátování a kusová zkouška + Doprava na stavbu.
     * **Výběr zasmluvněného výrobce / regionu:** Možnost vybrat konkrétního partnerského výrobce rozváděčů (podle kraje / termínu dodání, např. *Expresní výroba do 5–7 pracovních dnů*) nebo **`[ ⚡ Odeslat všem certifikovaným výrobcům ELDOCK v mém regionu ]`**.
     * **Automatická rezervace unikátního QR štítku ELDOCK:** Jakmile zákazník odešle poptávku na výrobu, systém z našeho sekvenčního registru (`qr-label-registry.ts`) **automaticky zarezervuje unikátní kód štítku `EL-xxxxxx`** přímo pro tento rozváděč!

2. PORTÁL PRO ZASMLUVNĚNÉ VÝROBCE ROZVÁDĚČŮ (`src/app/vyroba-rozvadecu/page.tsx` + správa v `/superadmin`):
   Vytvoř dedikovaný portál `/vyroba-rozvadecu` (dostupný pro naše zasmluvněné výrobce rozváděčů a kontrolovaný v `/superadmin`), kde výrobce vidí přijaté zakázky a provede celý výrobní proces:
   - **Krok 1 (Přijetí zakázky a stažení CNC & dílenských podkladů):**
     * Výrobce vidí detail zakázky, jedním klikem potvrdí cenu/termín (`[ ✅ Přijmout zakázku do výroby ]`) a stáhne si **Kompletní výrobní ZIP/balíček**:
       - `1_CNC_Vrtaci_plan_1-1.dxf` + `.csv`,
       - `2_Narezovy_a_dratovaci_list_vodicu.csv / .xlsx`,
       - `3_Kusovnik_materialu_MPN_EAN.xlsx` (s exportem do Sonepar / Elkov / K&V),
       - `4_6listovy_PDF_elaborat_a_1P_schema.pdf`,
       - `5_Samolepici_stitky_pristroju_a_QR_stitek_EL-xxxxxx.pdf` (300 DPI).
   - **Krok 2 (Výroba, drátování a Výstupní kusová zkouška výrobce):**
     * Po zhotovení rozváděče na dílně vyplní výrobce přímo v portálu naměřené hodnoty **kusové zkoušky dle ČSN EN IEC 61439-1 ed. 3** ($R_{iso}$, spojitost PE, zkouška chráničů, utahovací momenty, jméno zkoušejícího a výrobní číslo skříně).
   - **Krok 3 (Uzamčení dokumentace v cloudu a nalepení QR štítku ELDOCK):**
     * Kliknutím na **`[ 🔒 Dokončit výrobu, uzamknout Verzi 1.0 pod QR štítkem a expedovat ]`** se:
       1) Dokumentace rozváděče (včetně 2D půdorysu, pokud existuje) v cloudu **uzamkne jako schválená `Verze 1.0`** na adrese `https://eldock.cz/q/EL-xxxxxx`,
       2) Výrobce vytiskne a nalepí na dveře skříně přidělený stříbrný QR štítek **`EL-xxxxxx` s logem ELDOCK**,
       3) Zákazník dostane notifikaci, že jeho rozváděč je vyrobený, odzkoušený a připravený k převzetí / odeslání na stavbu!

================================================================================
ČÁST 4: NÁHLED CNC VRTACÍ ŠABLONY A DRÁTOVACÍHO LISTU PŘÍMO V PROHLÍŽEČI
================================================================================

Aby si tuto funkci mohl každý okamžitě prohlédnout (i během prezentace!), přidej do AI Panel Builderu (v Kroku 4 nebo jako podzáložku **`[ 🛠️ CNC & Výroba na klíč ]`**) interaktivní náhled:
1. **Vizuální 2D CAD výkres `CNC Vrtací a frézovací plán 1:1`** (zobrazující okótovanou montážní desku, DIN lišty, kabelové žlaby, přesné souřadnice vrtaných děr `Ø 5.0 mm` v mm a otvory pro vývodky `M16–M40`).
2. **Interaktivní tabulku `Nářezový a drátovací list vodičů (Odkud ➔ Kam)`** s průřezy, barvami, přesnou délkou v mm a typem dutinek + tlačítka pro stažení `.dxf`, `.csv` a `.xlsx`.
3. **Tlačítko `[ 🏭 Objednat výrobu tohoto rozváděče na klíč ]`**.

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit testy v `src/lib/panel-builder/__tests__/cnc-manufacturing.test.ts` ověřující:
   - Že `generateManufacturingPackage` vygeneruje platný `.dxf` soubor s CNC hladinami (`1_CNC_VRTANI_ZAVITY`, `3_CNC_VYVODKY_CELA`),
   - Že drátovací list vodičů (`wireHarnessList`) spočítá spojení `Odkud -> Kam`, určí správný průřez/barvu vodiče, délku v mm a rozpozná dvojitou `TWIN` dutinku u smyčkovaných svorek,
   - Že vytvoření objednávky výroby na klíč zarezervuje unikátní QR štítek `EL-xxxxxx` a po dokončení výrobcem uzamkne dokumentaci `Verze 1.0` na `/q/EL-xxxxxx`.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**1. Konfigurátor mechanického provedení (`src/lib/panel-builder/cnc-manufacturing-engine.ts`):**

- Kabelové vývodky podle vnějšího průměru kabelu (tabulka CYKY-J / CYKY-O podle katalogů výrobců):
  - rozsahy těsnění M16 4,5–10, M20 6–13, M25 9–17, M32 13–21 a M40 19–28 mm;
  - hlavní přívod M32 / M40 (5×10 → M32, 5×16 a 4×25 → M40);
  - 3f vývody 5×2,5 → M20, 5×4 / 5×6 → M25;
  - 1f okruhy 3×1,5 → M16, 3×2,5 → M20;
  - sběrnice a data M16.
- Volba přívodu kabelů (⬆️ shora / ⬇️ zespodu / ↕️ shora i zespodu = přívod nahoře, vývody dole) a typu montáže. Pod
  omítku / do SDK = membránová příruba bez otvorů vývodek; nástěnná / stojanová = vývodky v čele.
- Geometrie montážní desky (skříň − 50 × 80 mm):
  - DIN lišty TS 35 × 7,5 s otvory M5 (Ø 4,2 mm) 15 mm od krajů a po 250 mm;
  - perforované žlaby 40 × 60 nad první lištou, mezi řadami a pod poslední, svislé žlaby 25 × 60 po stranách (M5 po
    300 mm);
  - sběrnice PE, N a N1… (jedna za každým chráničem, M6 Ø 5,0 mm).
- Výřezy ve dveřích:
  - kontrolky fází L1 / L2 / L3 a tlačítko CENTRAL STOP Ø 22,5 mm;
  - multimetr 92 × 92 mm;
  - ventilátor s filtrem 120 × 120 mm (zaškrtávací volby; ventilátor se předvyplní, když výpočet oteplení v kroku 3
    nevyhoví).

**2. Generátor výrobních podkladů (`cnc-outputs.ts`, `generateManufacturingPackage`):**

- `1_CNC_Vrtaci_plan_1-1.dxf`: DXF R12 v mm 1 : 1 s hladinami `0_OBRYS_SKRINE_A_DESKY`, `1_CNC_VRTANI_ZAVITY`,
  `2_CNC_VYREZY_DVERE`, `3_CNC_VYVODKY_CELA` a `4_OSAZENI_PRISTROJU_KOTY` (deska, dveře, horní a dolní čelo).
- `1_CNC_Vrtaci_plan_1-1.csv`: `X_mm;Y_mm;Typ_operace;Prumer_nebo_Rozmer_mm;Hladina;Dil`. Strojové souřadnice dílu mají
  počátek v levém dolním rohu.
- Nářezový a drátovací list (CSV / XLSX):
  - vodiče W001… podle stromu zapojení; svorky 1 / 3 / 5 a N vstup nahoře, 2 / 4 / 6 a N-out výstup dole;
  - H07V-K (CYA) podle jmenovitého proudu napájeného přístroje (10 A 1,5 · 16 A 2,5 · 25 A 4 · 32 A 6 · 40 A 10 ·
    63 A 16 mm²);
  - barvy L1 hnědá, L2 černá, L3 šedá, L černá / hnědá, N světle modrá, PE zelenožlutá;
  - délka po žlabech (svisle do žlabu, vodorovně, mezi řadami přes postranní žlab) + 90 mm na ohyb, zaokrouhleno na
    5 mm;
  - dutinky podle DIN 46228-4 a dvojitá TWIN dutinka na svorce, odkud pokračuje smyčka do dalšího chrániče;
  - sousední jističe / jističochrániče jedné větve na stejné liště propojí hřeben „Hřebenová přípojnice 1P / 3P
    10 mm² (n modulů / mm)“ a jsou vyřazené z drátování;
  - N chráničů na sběrnice N1…, přepěťová ochrana z výstupu hlavního vypínače a na PE.
- Nářezový list DIN lišt, žlabů, sběrnic a hřebenů (délky a kusy).
- **Odchylka:** drátovací list pokrývá silové propojení přístrojů podle stromu. Ovládací obvody (cívky stykačů, vstupy
  modulů) se negenerují a délky jsou z pravoúhlého modelu tras, ne z CAD výkresu skříně.

**3. Zasmluvnění výrobci a výroba na klíč:**

- Modely `PanelManufacturer` a `ManufacturingOrder`, migrace `phase106_turnkey_manufacturing`.
- Tlačítko „🏭 Poptat / Objednat výrobu rozváděče na klíč“ v kroku 1b i v kroku 4. Okno ukazuje:
  - co zákazník dostane;
  - orientační kalkulaci: materiál z ceníků (fáze 105), montáž, drátování a kusová zkouška z normohodin
    (650 Kč / h), doprava 1 490 Kč;
  - blokace dokumentace (nevyhovující návrh se do výroby neposílá);
  - výběr výrobce v kraji, nebo „⚡ Odeslat všem certifikovaným výrobcům ELDOCK v mém regionu“.
- Odesláním vznikne zakázka `VYR-RRRR-NNNN` a z registru se hned zarezervuje QR štítek `EL-…` spárovaný s rozváděčem.
  Poptávku „všem“ přijme jen první výrobce (podmíněný zápis).
- Portál `/vyroba-rozvadecu` (e-mail + přístupový kód z velínu, vlastní cookie `eldock-vyroba`):
  1. ✅ přijetí s cenou a termínem; 📦 výrobní balíček ZIP (CNC DXF + CSV, drátovací list CSV / XLSX, nářezový list,
     kusovník MPN / EAN XLSX a košík Sonepar, README); tisk 6listového elaborátu a štítků;
  2. výstupní kusová zkouška výrobce: R_iso, spojitost PE, RCD, utahovací momenty, zapojení, body čl. 11.2 / 11.3 /
     11.5 / 11.6 / 11.7, zkoušející, výrobní číslo skříně;
  3. „🔒 Dokončit výrobu, uzamknout Verzi 1.0 pod QR štítkem a expedovat“ – uzamčení jako ve fázi 103 (snímek
     elaborátu s protokolem výrobce). Nevyhovující zkouška se nevydává; zákazník dostane e-mail.
- E-maily výrobcům a zákazníkovi chodí jen s nastaveným `ELDOCK_SMTP_URL`. Stav zakázky vidí firma v kroku 1b / 4.
- Velín: záložka „🏭 Výrobci rozváděčů“ (zasmluvnění výrobci s krajem a termínem, přístupový kód, přehled zakázek).
- **Odchylky:**
  - PDF elaborátu a štítků (300 DPI) se tisknou z prohlížeče ze stránek portálu – aplikace nemá serverový generátor
    PDF; ZIP obsahuje odkazy. Štítky jsou vektorové (libovolné rozlišení).
  - Výrobce rozváděčů = samostatný účet portálu, ne registrovaná firma.

**4. Náhled v prohlížeči (krok 4, `CncManufacturingPanel`):**

- Panel „🛠️ CNC & Výroba na klíč – výrobní podklady“:
  - volby přívodu, montáže a prvků ve dveřích;
  - CNC plán 1 : 1 (SVG: deska s lištami, žlaby, sběrnicemi, otvory s X / Y v titulku, čela s otvory vývodek);
  - drátovací list Odkud ➔ Kam a nářezový list;
  - stažení `.dxf`, `.csv` a `.xlsx`;
  - „🏭 Objednat výrobu tohoto rozváděče na klíč“ a stav zakázek.

**Testy:**

- `src/lib/panel-builder/__tests__/cnc-manufacturing.test.ts` (7): DXF s CNC hladinami a CSV, vývodky, geometrie,
  drátovací list (Odkud → Kam, průřez, barva, délka, TWIN, hřebeny, PE), kusová zkouška výrobce.
- `src/server/services/phase106.test.ts` (3): poptávka rezervuje štítek EL-…, přijetí, zkouška a Verze 1.0;
  poptávka všem v kraji přijme jen první; bez výrobce v kraji neprojde.
- E2E `e2e/phase106.spec.ts` (1): velín, krok 1b, CNC v kroku 4 se stažením DXF, objednávka se štítkem, portál
  výrobce s balíčkem, zkouškou a Verzí 1.0 na kartě `/q/EL-…`.
