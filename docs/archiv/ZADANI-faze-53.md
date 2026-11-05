# Zadání fáze 53 – životnost součástek a zatížení kabelových tras (vloženo 2026-11-05)

Původní znění vložené místo `docs/PLAN.md`. V zadání je uvedené jako „Fáze 52“, uživatel ho posunul na fázi 53 (fáze 52 = metodika ČSN 33 2130 ed. 4).

Implementujeme Fázi 52 do větve Správa výrobních závodů: "Prediktivní hlídání životnosti elektrotechnických součástek (cykly, motohodiny, B10d Safety a teplotní degradace dle Arrhenia) a Hlídání proudového zatížení kabelových tras (dle ČSN 33 2000-5-52 ed. 2) se simulátorem připojení nového stroje".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 6 bodech:

1. DATABÁZOVÉ SCHÉMA A MIGRACE (`prisma/schema.prisma`):
Vytvoř čistou SQLite migraci pro tyto modely a rozšíření:
a) Rozšiř model `Equipment` o provozní a kabelové parametry přívodu:
   - `shiftRegime` (Int @default(2) – směnnost provozu stroje/rozváděče: `1` = 1 směna 8h/den, `2` = 2 směny 16h/den, `3` = 3 směny 24h prac. dny, `4` = nepřetržitý provoz 24/7)
   - `internalTempC` (Float? – reálná nebo vypočtená vnitřní teplota v rozváděči [°C] pro výpočet tepelného stárnutí zdrojů a měničů; výchozí 35 °C)
   - Parametry přívodního kabelu (vztah k nadřazenému `fedFromEquipmentId`):
     * `feederCableType` (String? – např. `"CYKY-J"`, `"1-CXKH-R"`, `"AYKY"`, `"ÖLFLEX CLASSIC 110"`)
     * `feederConductorMaterial` (String @default("CU") – `"CU"` měď | `"AL"` hliník)
     * `feederCrossSectionMm2` (Float? – průřez fázového vodiče v mm²: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240)
     * `feederParallelRuns` (Int @default(1) – počet paralelních kabelů na fázi, např. 2× CYKY 3×120+70)
     * `feederLengthM` (Float? – délka kabelové trasy v metrech)
     * `feederInstallMethod` (String @default("E") – referenční způsob uložení dle ČSN 33 2000-5-52: `"B2"` v trubce/lišty na zdi, `"C"` přímo na zdi/lávce, `"E"` perforovaný kabelový žlab/rošt na vzduchu, `"D"` v zemi)
     * `feederGroupingCount` (Int @default(1) – počet souběžně uložených zatížených třífázových kabelů ve stejném žlabu/trase pro výpočet korekčního součinitele seskupení k_1)
     * `feederAmbientTempC` (Float @default(30) – max. teplota okolí kabelové trasy [°C], např. 30 °C běžná hala, 40 °C pod střechou haly / u pecí)
     * `feederUpstreamBreakerA` (Float? – jmenovitý proud In předřazeného jističe/pojistky v nadřazeném rozváděči [A])
     * `nominalCurrentA` (Float? – jmenovitý výpočtový odběr Ib tohoto zařízení [A])
     * `measuredCurrentA` (Float? – skutečný proud naměřený klešťovým ampérmetrem při revizi/diagnostice [A])
b) Model `MonitoredComponent` (Sledované kritické součástky rozváděče/stroje s omezenou životností):
   - `id` (String @id @default(cuid()))
   - `equipmentId` (String, vazba na `Equipment`, onDelete: Cascade)
   - `designation` (String – IEC značení ve schématu, např. `"-K4"`, `"-T1"`, `"-U1"`, `"-G1"`, `"-F_FAN1"`)
   - `name` (String – např. `"Stykač hlavního čerpadla hydrauliky"`, `"Spínaný zdroj 24V DC / 10A"`, `"Frekvenční měnič vřetene"`, `"Safety relé Total Stop"`, `"Ventilátor rozváděče + filtr"`)
   - `manufacturer` (String?), `modelNumber` (String?)
   - `wearCategory` (enum `ComponentWearCategory`:
     * `SWITCHING_CONTACTOR` = Silový stykač / relé / ventil (počítání sepnutí)
     * `SAFETY_ELEMENT` = Bezpečnostní prvek dle ČSN EN ISO 13849-1 (hlídání B10d cyklů a doby mise T_M 20 let)
     * `POWER_ELECTRONICS` = 24V DC zdroj / Frekvenční měnič / Kondenzátory (motohodiny + teplotní degradace dle Arrhenia)
     * `COOLING_FAN_FILTER` = Ventilátor rozváděče / Filtrační vložka / Baterie UPS/PLC)
   - `installedAt` (DateTime – datum instalace nebo poslední výměny kusu)
   - `cyclesPerHour` (Float? – průměrný počet sepnutí za provozní hodinu stroje, např. `120` sepnutí/h u lisu nebo `15` u CNC)
   - `manualCyclesOffset` (Int @default(0) – případný ručně zadaný počáteční stav cyklů z čítače PLC)
   - `maxElectricalCycles` (Int? – katalogová elektrická životnost v cyklech při AC-3/AC-4 nebo limit B10d u Safety prvků, např. `1000000`)
   - `maxOperatingHours` (Int? – katalogová životnost v provozních hodinách při referenční teplotě 40 °C, např. `50000` h u zdroje/ventilátoru)
   - `maxCalendarMonths` (Int? – maximální kalendářní doba v měsících, např. `240` měsíců = 20 let doba mise T_M u Safety prvku, nebo `6` měsíců u filtrační vložky, `48` měsíců u baterie)
   - `replacementStockCount` (Int @default(0) – počet náhradních kusů skladem v dílně údržby!)
   - `notes` (String?), `updatedAt` (DateTime @updatedAt)

2. VÝPOČETNÍ ENGINE ŽIVOTNOSTI SOUČÁSTEK (`src/lib/component-lifespan.ts` + unit testy):
Vytvoř čistý deterministický modul pro výpočet opotřebení a predikci výměny:
- Výpočet odpracovaných hodin od `installedAt` podle `shiftRegime` stroje:
  * `1 směna` = 2 000 h/rok (~5,48 h/den), `2 směny` = 4 000 h/rok (~10,96 h/den), `3 směny` = 6 000 h/rok (~16,44 h/den), `24/7` = 8 760 h/rok (24 h/den).
- Výpočet aktuálního počtu sepnutí: `totalCycles = manualCyclesOffset + Math.round(operatingHours * cyclesPerHour)`.
- **Teplotní korekce životnosti dle Arrheniova zákona (pro `POWER_ELECTRONICS` – 24V zdroje, měniče, kondenzátory):**
  * Referenční teplota katalogové životnosti je `T_ref = 40 °C`.
  * Pokud je v rozváděči zvýšená teplota `T_internal > 40 °C` (zjištěná z výpočtu oteplení nebo termovize), efektivní životnost v hodinách klesá podle vzorce:
    `effectiveMaxHours = maxOperatingHours * Math.pow(2, -(T_internal - 40) / 10)` (každých +10 °C nad 40 °C zkracuje životnost elektrolytických kondenzátorů na polovinu!).
- Pro každou součástku spočítej % vyčerpání všech relevantních limitů (Cykly / B10d, Motohodiny s teplotní korekcí, Kalendářní limit T_M) a vezmi ten nejhorší (`wearPercent`, `remainingDays`, `predictedReplacementDate`):
  * 🟢 `OK` (`< 75 %` životnosti)
  * 🟡 `PLAN_REPLACEMENT` (`75–95 %` nebo zbývá méně než 90 dní – doporučit preventivní výměnu při odstávce a zkontrolovat, zda je `replacementStockCount > 0`!)
  * 🔴 `CRITICAL_EXPIRED` (`>= 95 %` nebo po termínu – hrozí nečekaná porucha linky / vypršela doba mise Safety prvku dle EU 2023/1230!).

3. VÝPOČETNÍ ENGINE ZATÍŽENÍ KABELŮ DLE ČSN 33 2000-5-52 ed. 2 (`src/lib/cable-sizing.ts` + unit testy):
Vytvoř inženýrský modul pro kontrolu dimenzování a zatížení průmyslových kabelových tras:
- Tabulka základních proudových zatížitelností $I_{\text{tab}}$ [A] pro PVC/XLPE kabely (Cu i Al, 3 zatížené žíly, průřezy `1,5 mm²` až `240 mm²`) pro referenční způsoby uložení `B2`, `C`, `E` a `D`.
- Korekční součinitel teploty okolí $k_{\text{temp}}$ (pro 25 °C až 55 °C) a korekční součinitel seskupení kabelů v lávce/žlabu $k_{\text{group}}$ (pro 1 až 20 souběžných třífázových kabelů dle tab. B.52.17 ČSN 33 2000-5-52: např. 1 kabel = 1,00; 2 kabely = 0,88; 3 = 0,82; 4–5 = 0,77; 6–8 = 0,73; 9+ = 0,70).
- **Skutečná dovolená zatížitelnost trasy:** `Iz = I_tab * parallelRuns * k_temp * k_group`.
- **Výpočtové a reálné zatížení kabelu $I_B$:**
  * Pokud má zařízení podřízené odběry v hierarchii napájení (`feeds`), sečti jejich výpočtové proudy se soudobostí (`SF = 0,8`), případně vezmi `measuredCurrentA` (pokud bylo změřeno klešťákem) nebo `nominalCurrentA`.
- **Kontrola 3 normativních podmínek a Semafor kabelu:**
  1) **Vytížení kabelu:** `loadPercent = (I_B / Iz) * 100`.
  2) **Podmínka jištění kabelu proti přetížení (čl. 433.1 ČSN 33 2000-4-43):** Platí `I_B <= In <= Iz`! Pokud je předřazený jistič `In > Iz` (protože v lávce přibyly kabely nebo je vysoká teplota), vyhoď červené varování: `🔴 NEJIŠTĚNÝ KABEL: Jistič In (${In} A) je vyšší než skutečná zatížitelnost kabelu Iz (${Iz} A po korekci seskupením a teplotou)!`
  3) **Úbytek napětí $\Delta U$ [%]:** `dU_percent` pro 3f 400 V soustavu (limit $\le 5\,\%$ pro motory/stroje, $\le 3\,\%$ pro světla).
- **SIMULÁTOR "CO KDYŽ PŘIPOJÍM NOVÝ STROJ?" (`simulateAddedLoad`):**
  * Funkce přijme stávající strom napájení závodu, cílový rozváděč (např. `R-LIS-01` nebo `R-CNC-04`) a příkon/proud plánovaného nového stroje (např. `+45 kW / +80 A`).
  * Okamžitě propíše tento přírůstek proudu celou kaskádou nahoru (přívodní kabel podružného rozváděče -> hlavní rozváděč `RM1` -> transformátor `TR1`) a vrátí přehled, které kabely a jističe v trase vyhoví (🟢) a které přejdou do přetížení (🔴) včetně doporučení potřebného průřezu v $\text{mm}^2$!

4. UŽIVATELSKÉ ROZHRANÍ NA KARTĚ ZAŘÍZENÍ (`/equipment/[id]`) A V PAVOUKU NAPÁJENÍ:
- V záložce **`🔍 Diagnostika & Spoje (Údržba)`** (a s indikátorem v hlavičce zařízení) vytvoř dvě nové přehledné sekce:
  a) **Sekce 1: `⏳ Životnost součástek a prediktivní údržba (B10d / Motohodiny)`:**
     - Přepínač směnnosti stroje (`1 směna`, `2 směny`, `3 směny`, `24/7`) a vnitřní teploty rozváděče (`T_rozváděče [°C]`).
     - Karty / tabulka sledovaných součástek (`-K4 Stykač`, `-T1 Zdroj 24V DC`, `-U1 Frekvenční měnič`, `-K_SAF1 Safety relé`, `-FAN1 Ventilátor + filtr`) s barevným progress barem vyčerpání životnosti (`%`), počtem sepnutí / motohodin, informací o teplotním zkrácení životnosti dle Arrhenia, stavem náhradního dílu na skladě (`Skladem: 1 ks` / `⚠️ Chybí na skladě!`) a předpokládaným datem výměny.
     - Tlačítko **`[ 🔄 Zapsat výměnu kusu za nový (Reset 0 %) ]`** (vynuluje počítadlo k dnešnímu dni a volitelně založí záznam do historie) a tlačítko **`[ + Přidat sledovanou součástku ]`** (s rychlým výběrem přímo z kusovníku BOM daného rozváděče!).
  b) **Sekce 2: `🔌 Dimenzování a zatížení přívodního kabelu (ČSN 33 2000-5-52)`:**
     - Karta přívodního kabelu (např. `RM1 ➔ R-CNC-04 · Kabel CYKY-J 3×50+25 mm² · délka 48 m · uložení E (žlab, 6 kabelů v souběhu) · okolí 35 °C`).
     - Velký vizuální ukazatel: **Tabulková $I_{\text{tab}}$ ➔ Skutečná zatížitelnost $I_z$ (po korekci $k_1 \times k_2$) ➔ Předřazený jistič $I_n$ ➔ Aktuální zatížení $I_B$ (v % $I_z$)** + úbytek napětí $\Delta U$ [%].
     - Tlačítko `[ ✏️ Upravit parametry kabelu a měření klešťákem ]`.
     - **Interaktivní box `🧪 Simulátor: Co když sem připojím další stroj?`**: Uživatel posuvníkem nebo polem zadá příkon nového stroje v `kW` nebo `A` (např. `30 kW / 55 A`) a okamžitě vidí dopad na tento přívodní kabel, na nadřazený hlavní rozváděč `RM1` i na transformátor `TR1`!
- V půdorysu patra při zapnutí **„⚡ Pavouk napájení (Hierarchie)“** zobrazuj přímo na spojnicích mezi rozváděči a stroji typ kabelu a barevné % jeho zatížení (např. `CYKY 4×50 · 78 % Iz`).
- Do **Hlídače lhůt (`/inspections/alerts` a přehled areálu)** přidej souhrnný odznak `⏳ Součástky před koncem životnosti (N)` a `🔌 Přetížené / nejištěné kabely (N)`.

5. REALISTICKÝ SEED PRO OKAMŽITOU UKÁZKU V ZÁVODĚ JABLonec (`prisma/seed-lifespan-cables.ts`):
Doplň do seedu (i do přírůstkového produkčního seedu volaného z `docker-entrypoint.sh`, aby se vše propsalo na `eldock.cz`) bohatá realistická data:
- Nastav kabelové pasporty na páteřních i koncových trasách v Závodě Jablonec:
  * `TR1 ➔ RM1`: `3× (3× 1-CXKH-R 1×240 mm²)`, 18 m, uložení E.
  * `RM1 ➔ R-LIS-01`: `CYKY-J 3×95+50 mm²`, 65 m, žlab E se 7 souběžnými kabely, teplota pod střechou 38 °C, jistič `In = 160 A`, odběr `138 A` (**🟡 Vytížení 86 % Iz – varování nízké rezervy pro další stroje!**).
  * `RM1 ➔ R-CNC-04`: `CYKY-J 3×50+25 mm²`, 48 m, žlab E se 6 kabely, jistič `In = 125 A`, ale po korekci seskupením a teplotou 35 °C je `Iz = 112 A` (**🔴 Ukázka chyby jištění dle ČSN: po přitažení dalších kabelů do žlabu kleslo Iz pod jistič 125 A!**).
  * `RM1 ➔ R-ML-01`, `R-LIS-01 ➔ LIS-01`, `R-CNC-04 ➔ CNC-04` atd. (**🟢 V pořádku, rezerva 35–55 %**).
- Doplň sledované součástky (`MonitoredComponent`) u hlavních rozváděčů a strojů:
  * U **`R-LIS-01` / `LIS-01`** (3směnný provoz):
    - `-K1` Stykač hlavního čerpadla hydrauliky (ABB AF38, 120 sepnutí/h, nasbíráno `940 000 / 1 000 000` cyklů = **🟡 94 % – naplánovat výměnu do 3 týdnů**, skladem 1 ks).
    - `-K_SAF1` Bezpečnostní modul lisu (Pilz PNOZsigma, hlídání $B_{10d}$ dle ISO 13849-1, 42 %).
  * U **`R-CNC-04`** (2směnný provoz, vnitřní teplota v rozváděči 48 °C):
    - `-T1` Spínaný zdroj 24V DC / 10A (kvůli teplotě 48 °C v rozváděči klesla životnost kondenzátorů dle Arrhenia z 50 000 h na 28 700 h -> aktuálně **🔴 97 % vyčerpáno, 0 ks skladem!**).
    - `-FAN1` Filtrační vložka ventilátoru rozváděče Rittal SK 3238 (**🔴 Po termínu výměny 6 měsíců – příčina zvýšené teploty v rozváděči!**).
    - `-U1` Frekvenční měnič vřetene (Siemens Sinamics, 58 % životnosti DC meziobvodu).

6. VERIFIKACE A TESTY:
- Napiš unit testy pro `component-lifespan.ts` (výpočet cyklů ze směnnosti, Arrheniův teplotní vzorec, B10d) a `cable-sizing.ts` (výpočet Iz se seskupením a teplotou, detekce `In > Iz`, úbytek napětí a simulátor nového stroje).
- Přidej E2E test ověřující zobrazení životnosti součástek, výměnu kusu na 1 klik a simulátor zatížení kabelu na kartě `R-CNC-04` / `R-LIS-01`.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `npm run docs:bundle`, udělej commit a vypiš příkazy pro push a deploy.
