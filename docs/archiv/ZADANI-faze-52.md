# Zadání fáze 52 – metodika ČSN 33 2130 ed. 4 (vloženo 2026-11-05)

Původní znění vložené místo `docs/PLAN.md`. V zadání se test jmenuje `phase53-methodology.test.ts`, uživatel ho určil jako fázi 52.

Na základě verifikace proti naší odborné referenční metodice ("Metodika pro návrh domovních elektroinstalací a Smart Home" – ČSN 33 2130 ed. 4 platná od 1. 1. 2025, ČSN 33 2000-5-52 ed. 2, ČSN 33 2000-5-51 ed. 3+Z1+Z2, TNI 33 2000-5-51:2022 a vyhláška č. 131/2024 Sb.) musíme zpřísnit a rozšířit inženýrskou logiku v `floorplan-bridge.ts`, `room-schedule.ts`, `linter.ts`, 2D půdorysu i výstupní dokumentaci.

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj v těchto 6 bodech:

1. TŘI ÚROVNĚ ARCHITEKTURY INSTALACE (KLASIKA vs. SBĚRNICOVÁ SMART HOME vs. HYBRIDNÍ RETROFIT):
V `src/engine/floorplan-bridge.ts`, `src/engine/room-schedule.ts` i v UI (2D půdorys a modal Nový projekt ze soupisu) zaveď plnou podporu všech 3 úrovní podle metodiky:
- `classic` ("1. Klasická instalace 230/400 V"):
  * Okruhová/stromová topologie, lokální spínače, kabely `CYKY-J / CYKY-O`, krabice `KU68`.
- `bus_loxone` ("2. Plně sběrnicová Smart Home – Loxone / KNX / TapHome / ABB-free@home"):
  * Hvězdicová topologie silnoproudu: každý spínaný světelný vývod, spínaná zásuvka a pohon žaluzie (`CYKY-J 5×1,5`) vede samostatným kabelem přímo do centrálního rozváděče na vícepatrové instalační svorkovnice (L/N/PE).
  * Sběrnicová větev `24 V DC` (`CAT7` nebo `KNX TP J-Y(St)Y 2×2×0,8`) propojuje tlačítka a senzory; pro sběrnici RS-485 (elektroměry Eastron / střídač) automaticky přidej do kusovníku zakončovací rezistor `120 Ω` a vícepatrové svorkovnice.
- `smart_retrofit` ("3. Hybridní / Retrofit – Zigbee / Matter / Home Assistant / Lokální moduly pod vypínač"):
  * Klasická kabeláž, ale se STRIKTNÍM PRAVIDLEM: v každé krabici vypínače je POVINNÝ nulový vodič `N`! Zakáž použití kabelu `CYKY-O` (bez modré žíly) – ke každému vypínači počítej `CYKY-J 3×1,5` (nebo `5×1,5` u dvojitých spínačů) s průběžným vodičem `N`.
  * Do výkazu materiálu automaticky generuj hluboké přístrojové krabice **min. 65 mm (`KPR68 / KU68 hluboká`)** a lokální chytré moduly pod vypínače.

2. STRIKTNÍ PRAVIDLA ČSN 33 2130 ed. 4 PRO PROUDOVÉ CHRÁNIČE, SVĚTLA A ZÁSUVKY:
Uprav `generateCircuitsFromFloorplan`, `buildSwitchboardFromCircuits` (v `floorplan-bridge.ts`) a `validateSwitchboardState` (v `src/lib/panel-builder/linter.ts`):
- **Konec chráničů typu AC & Oddělení světel od zásuvek:**
  * Světelné obvody NESMÍ viset na společném proudovém chrániči se zásuvkovými obvody!
  * Každý koncový světelný obvod (`B10A`) musí mít v návrhu podle ČSN 33 2130 ed. 4 samostatnou doplňkovou ochranu proudovým chráničem **typu A** (`IΔn = 30 mA`) – buď jako samostatný jednomodulový jističochránič **RCBO 1P+N typ A** (např. `ABB DS301C B10 A30` / `Eaton PFL7-10/1N/B/003-A`), nebo přes vyhrazenou skupinu chráničů výhradně pro světla (nikdy smíchanou se zásuvkami!).
  * Všechny zásuvkové proudové chrániče musí být minimálně **Typ A** (nikdy `Typ AC`!).
  * Pro okruhy `ev_charger` (Wallbox), `pv_inverter` (FVE) a `heat_pump` (TČ s frekvenčním měničem) striktně vyžaduj proudový chránič **Typ B nebo Typ F**!
- **Počítání skutečných zásuvek v obvodu (max. 10 zásuvek):**
  * Podle ČSN 33 2130 ed. 4 zásuvkový obvod nepočítá rámečky, ale skutečné zásuvky: započítávej dvojzásuvku (`double_socket`) jako **2 zásuvky** do limitu max. 10 zásuvek na jeden okruh `B16A` (přidej volitelný přepínač `Počítat dvojzásuvku jako 2 zásuvky dle ČSN 33 2130 ed. 4` – výchozí zapnuto).
- **Nová pravidla v Elektro-linteru (`linter.ts`):**
  1) Varování (s opravou 1 klikem): *"Chránič -FIx je typu AC – dle ČSN 33 2130 ed. 4 musí být u koncových obvodů s elektronikou a LED osvětlením použit typ A (příp. B/F)."* -> Tlačítko `[Opravit 1 klikem: Přepnout na Typ A]`.
  2) Varování (s opravou 1 klikem): *"Pod chráničem -FIx jsou společně zapojené světelné i zásuvkové okruhy – dle ČSN 33 2130 ed. 4 nesmí světla viset na společném chrániči se zásuvkami!"* -> Tlačítko `[Opravit 1 klikem: Oddělit světla na RCBO / samostatný chránič]`.
  3) Varování: *"Okruh Wallbox / TČ / FVE je za chráničem typu A/AC – vyžadován chránič typu B nebo F."*

3. DIMENZOVÁNÍ VODIČŮ V TEPELNÉ IZOLACI (A1/A2/B2/C DLE TAB. 9) A IMPEDANCE SMYČKY V TEPLÉM STAVU ($Z_{sm}$):
Rozšiř výpočet kabelů v `floorplan-bridge.ts`:
- Přidej volbu způsobu uložení kabelů v budově (`InstallMethod = "C" | "B2" | "A2" | "A1"`):
  * `C` (ve zdi pod omítkou – standardní zdivo): `CYKY 3×1,5` -> $I_z = 19,5\text{ A}$ (jistič 10/16 A), `CYKY 3×2,5` -> $I_z = 27\text{ A}$ (jistič 16 A).
  * `B2` (v elektroinstalační trubce / liště ve zdi): `CYKY 3×1,5` -> max. jistič **10 A** (dle Tab. 9!), `CYKY 3×2,5` -> $I_z = 20\text{ A}$ (jistič 16 A).
  * `A1 / A2` (v tepelně izolační příčce / dřevostavbě / zatepleném podhledu): `CYKY 3×1,5` -> max. jistič **10 A**, `CYKY 3×2,5` -> $I_z$ klesá na **18,5 A** (max. jistič **16 A**; při souběhu více kabelů v izolaci klesá $I_z$ pod 16 A a systém musí automaticky navrhnout přechod na průřez `4 mm²` nebo jištění `13 A`!).
- **Kontrola obou podmínek koordinace (ČSN 33 2000-4-43):**
  * $I_B \le I_n \le I_z$ a $I_2 \le 1,45 \cdot I_z$ (kde pro jističe dle ČSN EN 60898 je $I_2 = 1,45 \cdot I_n$).
- **Kontrola impedance poruchové smyčky v teplém stavu ($Z_{sm}$ dle ČSN 33 2000-6 ed. 2):**
  * Pro každý navržený okruh spočítej impedanci vedení v teplém stavu (koeficient ohřevu $1,5\times$ a pokles napětí na $0,8 \cdot U_0$):
    $$I_{k,\min} = \frac{0,8 \cdot U_0}{1,5 \cdot Z_S} \ge I_a \quad \text{a} \quad Z_{sm} \le \frac{2 \cdot U_0}{3 \cdot I_a}$$
    (kde $U_0 = 230\text{ V}$ a $I_a = 5 \cdot I_n$ pro jistič char. B, resp. $10 \cdot I_n$ pro char. C). Pokud je trasa kabelu příliš dlouhá a nevyhoví impedanci smyčky nebo úbytku napětí $\Delta U$ (příloha A a E ČSN 33 2130 ed. 4: $\le 3\,\%$ světla, $\le 5\,\%$ ostatní), upozorni projektanta a navrhni o stupeň vyšší průřez!

4. KATALOGOVÉ ŘAZENÍ SPÍNAČŮ ABB A STAVEBNÍ DETAILY (VZDUCHOTĚSNOST, UZEMNĚNÍ V4A, SPD BEZ PŘEDJIŠTĚNÍ):
- Do palety spínačů v 2D půdorysu doplň přesná katalogová řazení dle standardu ABB:
  * `1` (jednopólový), `1So` (s orientační doutnavkou), `1S` (se signalizační doutnavkou), `1SSo`, `1+1` (dvojitý s blokováním proti současnému stisku), `5` (sériový), `6` (střídavý), `6+6` (dvojitý střídavý), `6+6/0`, `7` (křížový), `7So`, `1/0` (tlačítko zapínací), `1/0So`.
- Do katalogu přepěťových ochran Saltek přidej kombinované svodiče T1+T2 bez nutnosti předjištění s vnitřním nadproudovým odpojovačem a dálkovou signalizací: **`Saltek FLP-25-T1-VSF`** a **`Saltek FLP-B+C-MAXI-VSF`**.
- Při návrhu rozváděče s kombinací **FVE + Tepelné čerpadlo + EV Wallbox (Synergický energetický management)**:
  * Automaticky přidej do rozváděče **SG Ready bezpotenciálové relé** pro propojení střídače FVE s tepelným čerpadlem a **nepřímý/přímý 3f elektroměr pro Dynamické řízení zátěže (DLM)** wallboxu proti přetížení hlavního jističe (dle čl. 10 ČSN 33 2130 ed. 4 a požadavků pojišťoven) + možnost volby tlačítka **TOTAL STOP / CENTRAL STOP**.
- Pokud je v projektu zvoleno prostředí `Dřevostavba / Pasivní dům` nebo `Venkovní prostupy`, přidej do kusovníku a technické zprávy položky: **Vzduchotěsné membránové krabice, EPDM manžety (`ProClima ROFLEX`), krabice do zateplení (`Kopos KEZ_KB`)** a požadavek na **nerezový obvodový zemnič V4A (AISI 316Ti)** pod hydroizolací základové desky dle ČSN 33 2000-5-54 ed. 3.

5. PROTOKOL O URČENÍ VNĚJŠÍCH VLIVŮ (TNI 33 2000-5-51:2022) A HLAVIČKA DLE VYHLÁŠKY Č. 131/2024 Sb. V DOKUMENTACI:
- V Kroku 4 AI Panel Builderu (`/panel-builder/[id]/documentation`) a na kartě elaborátu:
  * Rozšiř technickou zprávu a titulní list o odkaz na **stavební zákon č. 283/2021 Sb., vyhlášku č. 131/2024 Sb. (Příloha 9, část D.2.5 TPS – Silnoproud)**, **zákon č. 250/2021 Sb.**, **NV č. 190/2022 Sb.** a normu **ČSN 33 2130 ed. 4** (u rozvodnic pod omítku DBO též deklaraci **„Úplný kryt“ dle ČSN EN 60670-24**).
  * Automaticky vygeneruj ze zvoleného prostředí instalace oficiální **„Protokol o určení vnějších vlivů dle TNI 33 2000-5-51:2022 a ČSN 33 2000-5-51 ed. 3+Z1+Z2“** (tabulka vnějších vlivů AA, AB, AC, AD, AE, AF, AG, AH, AN, BA, BC, BD, BE, CA, CB + stanovené opatření a požadované krytí IP/IK), který bude přímou součástí tiskového elaborátu pro výchozí a pravidelné revize.
- V revizních protokolech (`/inspections/report/[id]`) doplň u zkoušení proudových chráničů (RCD) dle **ČSN EN 61557-6 ed. 2** a **ČSN 33 2000-6 ed. 2** všechny 3 předepsané testy:
  1) Měření nevybavovacího proudu ($0,5 \cdot I_{\Delta n}$ po dobu $\ge 300\text{ ms}$ – nesmí vybavit),
  2) Měření vybavovacího času při $1,0 \cdot I_{\Delta n}$ ($t \le 300\text{ ms}$),
  3) Měření vybavovacího proudu $I_\Delta$ (u typu A testováno pulzujícím DC proudem do $1,4 \cdot I_{\Delta n}$) + kontrolu impedance smyčky $Z_{sm} \le \frac{2}{3} Z_{s,\max}$.

6. TESTY A VERIFIKACE:
- Napiš unit testy v `src/lib/phase53-methodology.test.ts` ověřující:
  * Že v návrhu dle ČSN 33 2130 ed. 4 nikdy nevznikne chránič typu AC a světelný okruh nikdy nesdílí chránič se zásuvkami.
  * Že v režimu `smart_retrofit` má každý spínač přivedený vodič `N` (`CYKY-J`) a krabici `KPR68 (65 mm)`.
  * Výpočet $I_z$ v tepelné izolaci (`A2` -> max. 10 A pro 1,5 mm²) a kontrolu impedance smyčky v teplém stavu $Z_{sm} \le \frac{2 U_0}{3 I_a}$.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `npm run docs:bundle`, udělej commit a vypiš příkazy pro push a deploy.
