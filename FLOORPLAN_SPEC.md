# FLOORPLAN_SPEC – most „půdorys → rozváděč“

Výpočetní modul `src/engine/floorplan-bridge.ts` propojuje chystaný 2D editor domovní elektroinstalace
(půdorys) s automatickým návrhářem rozváděčů (AI Panel Builder). Je deterministický: stejný vstup dává
vždy stejný výstup, nemá vedlejší efekty a nepoužívá Prismu ani UI. Testy jsou v
`src/engine/floorplan-bridge.test.ts` a pokrývají celý průchod od vzorového rodinného domu až po přístroje
na DIN lištách.

```
Půdorys (px) ──1──▶ Kalibrace (mm, délky kabelů, úbytek U)
             ──2──▶ Ovládání světel (řazení, impulzní relé, DI/DO)
             ──3──▶ Okruhy dle ČSN 33 2130 ed. 4 + kusovník
             ──4──▶ Rozváděč: fáze, chrániče, přístroje na lištách, skříň
```

## Vstupní data půdorysu

| Typ | Pole | Popis |
|---|---|---|
| `Floorplan` | `rooms`, `nodes`, `mode` | `mode` = `classic` · `smart_relay` (Shelly Pro / iNELS) · `bus_loxone` (Loxone Tree) |
| `Room` | `id`, `name`, `lighting?` | `lighting = { groups: 1 \| 2, switchCount, blinds? }` – větve světel, ovládací místa, žaluzie |
| `FloorNode` | `id`, `room`, `kind`, `px`, `tag?`, `powerW?` | `kind` = `single_socket` · `double_socket` · `light` · `switch` · `appliance` |
| `ApplianceTag` | | `oven`, `dishwasher`, `washer`, `dryer`, `boiler`, `microwave_builtin`, `cooktop_3p`, `fridge`, `ev_charger`, `heat_pump` |

## 1. Kalibrace měřítka – `calibrateFloorplanScale`

- **Vstup:** 1–2 referenční stěny `{ px: [x1, y1, x2, y2], lengthMm }` a poloha rozváděče `panelPx: [rx, ry]`.
- **Měřítko:**
  - 1 stěna → stejné měřítko v obou osách.
  - 2 stěny → soustava `dx²·sx² + dy²·sy² = L²` pro každou stěnu. Řeší se zvlášť pro osu X a Y, takže sken natažený jen v jedné ose se vyrovná.
  - Singulární nebo záporné řešení → průměr jednotných měřítek.
- **`calculateCableLength(node)`:** vrací ortogonální (Manhattan) délku `|Δx|·sx + |Δy|·sy`. K ní se přičítá:
  - svislý úsek z horní instalační zóny (300 mm pod stropem, výchozí strop 2 600 mm) k přívodu rozváděče (1 700 mm),
  - svislý úsek k bodu:

| Bod | Montážní výška | Svislý úsek od trasy 2 300 mm |
|---|---|---|
| Zásuvka / spotřebič | +300 mm | 2 000 mm |
| Spínač | +1 050 mm | 1 250 mm |
| Svítidlo (strop) | stropní trasa −300 mm | 300 mm |

- **Úbytek napětí (`voltageDropPercent`):** měď ρ = 0,0225 Ω·mm²/m (70 °C).
  - Vzorce: 1f `2·L·I·ρ/S/230`, 3f `√3·L·I·ρ/S/400`.
  - Kontroluje se při jmenovitém proudu jističe In.
  - Limity: světla ≤ 3 %, zásuvky a spotřebiče ≤ 5 %. Při překročení se průřez zvětší (1,5 → 2,5 → 4 mm²) a vznikne varování.

## 2. Ovládání světel – `resolveSwitchWiring`

Klasická instalace (`classic`), G = nezávislé větve, S = ovládací místa:

| G | S | Nástěnné prvky | V rozváděči |
|---|---|---|---|
| 1 | 1 | 1× řazení 1 (jednopólový spínač) | – |
| 2 | 1 | 1× řazení 5 (sériový lustrový) | – |
| 1 | 2 | 2× řazení 6 (střídavý) | – |
| 2 | 2 | 2× řazení 6+6 / 5B (dvojitý střídavý) | – |
| 1 | 3 | 2× řazení 6 + 1× řazení 7 (křížový) | – |
| 1 | ≥ 4 (a G = 2, S ≥ 3) | S× tlačítko řazení 1/0 (paralelně) | G× impulzní paměťové relé (ELKO MR-41 / CRM-91H) |

Žaluzie: klasicky žaluziový spínač, v chytrých režimech 2 výstupy (nahoru / dolů) na žaluzii.

- **`smart_relay`:**
  - Na stěně: S× tlačítko (dvojité při G = 2) a žaluziová tlačítka.
  - V rozváděči: DI = G + 2·žaluzie (tlačítka stejné větve paralelně), DO = G + 2·žaluzie.
- **`bus_loxone`:**
  - Na stěně: S× Loxone Touch Tree s integrovaným termostatem.
  - V rozváděči: DO = G + 2·žaluzie, DI = 0 (ovládání po sběrnici Tree).

## 3. Shlukovač okruhů – `generateCircuitsFromFloorplan`

| Zdroj | Okruh | Jištění | Kabel | Proudová ochrana |
|---|---|---|---|---|
| `oven`, `dishwasher`, `washer`, `dryer`, `boiler`, `microwave_builtin` ≥ 2 000 W | samostatný 1f | B16 1P | CYKY-J 3x2,5 | společný chránič 30 mA typ A |
| `cooktop_3p` | 3f | B16 3P | CYKY-J 5x2,5 | společný chránič 30 mA typ A |
| `fridge` | prioritní nevypínaná větev | RCBO B16 / 30 mA typ A | CYKY-J 3x2,5 | vlastní (RCBO) |
| `ev_charger`, `heat_pump` | 3f, In ≥ Ib (min. 16 A), TČ char. C | B/C 3P | CYKY-J 5x2,5 až 5x10 podle In | vlastní chránič 30 mA typ B |
| běžné zásuvky (i spotřebiče < 2 000 W) | max. 10 vývodů / okruh, dvojzásuvka = 1 vývod | B16 1P | CYKY-J 3x2,5 | společný typ A |
| světla | min. 2 nezávislé okruhy, max. 10 bodů / okruh | B10 1P | CYKY-J 3x1,5 | společný typ A |

- **Pořadí zásuvek:**
  - Místnosti se řadí od rozváděče nejbližší (nejkratší kabel), body uvnitř místnosti také podle délky kabelu.
  - Místnost zůstane celá na jednom okruhu, pokud se vejde. Jinak začne nový okruh, a teprve větší místnost se rozdělí.
- **Světla:** místnosti se přidávají vždy do nejméně obsazeného světelného okruhu.
- **Kusovník (`bom`):**
  - Jednozásuvky a dvojzásuvky zvlášť (dvojzásuvka se do limitu 10 vývodů počítá jako 1, v kusovníku zůstane přesný typ).
  - Svítidlové vývody a nástěnné prvky podle řazení.
- **Soudobý příkon:**
  - Spotřebiče: výchozí příkon × součinitel podle štítku (`APPLIANCES`).
  - Zásuvky: 200 W na vývod × 0,3 + 200 W, nejvýš 3 680 W.
  - Světla: 60 W na bod × 0,8.

## 4. Generátor rozváděče – `buildSwitchboardFromCircuits`

1. **Fáze (`balancePhases`):** hladový algoritmus. 1f okruhy od největšího soudobého příkonu jdou vždy na nejméně zatíženou fázi, 3f okruhy přidají třetinu na každou fázi. Rozdíl fází je nejvýš jeden největší 1f okruh.
2. **Chrániče (`groupUnderRcds`):**
   - Nejvýš 6 okruhů na 4P chránič 30 mA typ A, minimálně 2 chrániče, pokud jsou v domě světla i jiné okruhy.
   - Světla a zásuvky stejné místnosti nesmí být na stejném chrániči.
   - Světelné okruhy se rozkládají na různé chrániče.
   - EV a TČ mají každý vlastní chránič typ B, lednice má RCBO.
   - Ke každému chrániči jde do kusovníku izolovaný N-můstek a hřebenová lišta 3P.
3. **Přístroje:**
   - Pořadí na liště: `-Q1` hlavní vypínač 3P 40 A, `-FV1` svodič T1+T2 3P+N, `-X1` rozbočovací svorkovnice HLAK, skupiny `-FIn` + jističe `-Fn`, RCBO `-FAn`, impulzní relé `-KAn`.
   - Chytrá instalace:
     - `bus_loxone`: Miniserver (8 DO) + Relay Extension (14 DO každá) + zdroj 24 V DC, nad 100 prvků Tree také Tree Extension.
     - `smart_relay`: Shelly Pro 4PM po 4 DI / 4 DO.
     - Šířky chytrých modulů jsou orientační (`SMART_MODULES`).
   - Každý přístroj nese `config` (`ItemConfig`), takže ho AI Panel Builder umí rovnou osadit (`placeComponents`).
4. **Lišty a skříň:**
   - Celkový počet modulů + 25 % rezerva (zaokrouhleno nahoru).
   - Z databáze skříní (`PanelEnclosure`: matice standardních rozvodnic i externí databáze) se vybere nejmenší, která:
     - pojme moduly s rezervou,
     - rozloží skupiny na své řady (skupina chrániče se nedělí, pokud se vejde na lištu),
     - splní oteplení `total_power_loss_w ≤ pMaxW` (skříně bez P_max se nevybírají).
   - Bez vyhovující skříně vrátí `enclosure: null` a varování.

## Výstup a navázání na AI Panel Builder

`buildSwitchboardFromCircuits` vrací:
- `devices` a `rails` (přístroje po lištách),
- `phaseLoadW` a `phaseOf` (fáze každého okruhu),
- `rcdGroups`, `bom`, `totalModules`, `requiredModules`, `totalPowerLossW`,
- `enclosure` a `warnings`.

Projekt rozváděče z výstupu zakládá `createPlanProject` (`src/server/services/panel-projects.ts`): ze soupisu místností
(fáze 48, `src/engine/room-schedule.ts`) nebo z 2D půdorysu (fáze 49, `/panel-builder/floorplan`).

Výsledek vzorového domu z testu (klasická instalace):
- 13 okruhů, 5 chráničů (3× typ A, 2× typ B), fáze 10,6 / 10,6 / 10,5 kW.
- 52 M + 25 % = 65 M → skříň 5 × 14 M s P_max 74 W při ztrátách 55,7 W.

## 3D výpočet kabeláže (fáze 49, `src/engine/cable-routing.ts`)

- **Výškový profil** `ElevationProfile` (mm od čisté podlahy): strop 2600, hloubka v podlaze 50, rozváděč 1500,
  zásuvky 300, zásuvky nad linkou / v koupelně 1150, vypínače 1050, rezerva 10 % + 600 mm v rozváděči + 150 mm v každé krabici KU68.
- **Výška prvku** `mountHeight`: vlastní `FloorNode.mountHeightMm`, jinak podle druhu (stropní světlo = strop, nástěnné 2000,
  bojler 1800, wallbox 1200).
- **Trasa okruhu** = řetěz rozváděč → nejbližší prvek → další (`chainOrder`, Manhattan).
  - `BOTTOM`: svod rozváděče do podlahy (výška rozváděče + hloubka), trasa v podlaze, výstup ke krabici (výška + hloubka);
    mezi krabicemi 2 × (výška + hloubka), ve společném rámečku (`frame`) bez svodu.
  - `TOP`: výstup do stropu (strop − rozváděč), trasa v podhledu, spuštění k prvku (strop − výška).
  - `OPTIMIZED`: pro každý okruh kratší z obou; sousední prvky ve stejné místnosti a výšce ≥ 900 mm (linka) propojí přímo ve zdi.
- **Výkaz** `summarizeCabling`: metráž ve 3 režimech, úspora, rozpis podle kabelu (okruhy, svody k vypínačům `CYKY-O 3×1,5`,
  datové zásuvky `UTP Cat6` samostatně z rozváděče) a ΔU na nejdelší větvi (světla 3 %, ostatní 5 %).
- `calibrateFloorplanScale({ elevation, routing })` počítá délku přívodu 3D modelem – generátor okruhů z ní bere ΔU a průřez.
- Editor `/panel-builder/floorplan` (`lib/panel-builder/floorplan-editor.ts`: paleta, nákres v mm, `buildPlan`, `analyzeDraft`)
  a projekt z půdorysu `createProjectFromFloorplan` (domovní přístroje řady přes `pickWiringDevice`, výkaz v `cableReportJson`).

## Metodika ČSN 33 2130 ed. 4 (fáze 52)

- **Úrovně instalace** (`InstallMode`, `INSTALL_LEVELS`): `classic` (stromová topologie, svody CYKY-O, krabice KU 68),
  `bus_loxone` (hvězda – každé svítidlo samostatným `CYKY-J 3×1,5` do rozváděče na vícepatrové svorkovnice, tlačítka na sběrnici
  24 V DC `CAT7 / J-Y(St)Y 2×2×0,8`, u EV / TČ / FVE elektroměr RS-485 a 2× zakončovací rezistor 120 Ω) a `smart_retrofit`
  (v každé krabici vypínače N → svody vždy CYKY-J, hluboké krabice KPR 68 min. 65 mm, modul pod vypínač na větev; od 4 míst tlačítka
  bez impulzního relé). `smart_relay` zůstává jen pro API / testy.
- **Chrániče:** nikdy typ AC. Světla B10 nikdy na společném chrániči se zásuvkami – výchozí RCBO 1P+N B10 typ A 30 mA na každý
  světelný okruh (`rcd: "own"`), volitelně chrániče typ A jen pro světla (`lightingProtection: "rcd_group"`, `rcd: "A30L"`).
  EV / TČ / FVE (`RCD_TYPE_B_TAGS`) každý vlastní chránič typ B.
- **Zásuvky:** limit 10 skutečných zásuvek na okruh B16, dvojzásuvka = 2 (`countDoubleAsTwo`, výchozí ano).
- **Průřez** (`sized`): nejmenší od výchozího, který splní ΔU (3 / 5 %), koordinaci IB ≤ In ≤ Iz a I2 ≤ 1,45 · Iz
  (`checkCoordination`, `cableAmpacity` – uložení C / B2 / A2 / A1, 1f 2 / 3f 3 zatížené žíly, souběh `groupingFactor`,
  tab. 9: 1,5 mm² v B2 / A1 / A2 max. 10 A) a impedanci smyčky (`loopImpedanceCheck`: Zs = 0,3 Ω přívodu + 2·L·ρ20/S,
  Ik,min = 0,8·U0 / (1,5·Zs) ≥ Ia a Zsm ≤ 2·U0 / (3·Ia)). Každé zvětšení = varování s důvodem.
- **Synergie:** FVE + TČ → SG Ready relé; EV + (FVE nebo TČ) → elektroměr pro DLM; `centralStop` → tlačítko TOTAL STOP.
- **Stavební detaily** (`constructionDetails` v `environments.ts`): dřevostavba / venkovní prostupy → membránové krabice,
  ROFLEX, Kopos KEZ_KB a zemnič V4A do kusovníku.

## Spotřebiče, ruční trasy a šikmé stěny (fáze 63)

- **Samostatný spotřebič podle zadání** – `FloorNode.appliance` (`ApplianceOverride`: název, příkon, póly 1 / 3, jistič
  B / C 6–32 A, chránič A / F / B / RCBO, výchozí průřez, soudobost) má přednost před štítkem `tag`: vlastní okruh
  `dedicated` (1f) / `cooktop` (3f) / `three_phase_rcd_b` (3f + typ B), chránič A = společná skupina `A30`, F = vlastní
  skupina `F30` (`RcdGroup` typ F), B = `B30`, RCBO jen 1f (`own`). Průřez dál hlídá `sized` (úbytek, koordinace,
  smyčka). Vestavěný spotřebič bez úprav počítá engine jako dřív (práh 2 000 W, lednice RCBO, EV / TČ / FVE typ B).
- **Označení jističů** – `circuitDesignations(circuits)` čísluje jističe stejně jako `buildSwitchboardFromCircuits`
  (pod chrániči v pořadí skupin, pak vlastní ochrana; RCBO řada -FA) – štítky tras „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“.
- **Ruční úprava trasy** – `summarizeCabling({ routeEdits })`: klíč úseku „od>do“ (rozváděč = `panel`), lomená čára
  se přichytí k aktuálním koncovým bodům (`reanchor`, `src/engine/route-geometry.ts`), vodorovná délka úseku = délka
  upravené čáry ve všech třech režimech (rozdíl × rezerva do `totalMm` / `longestMm`). Pořadí prvků okruhu se počítá
  z automatických tras – ruční objížďka ho nepřehází. Úsek přes stoupací vedení (dvě podlaží) ruční úpravu nemá.
- **Šikmé stěny** – `wallSegments` bere u místnosti s `points` hrany mnohoúhelníku; graf stěn (`buildWallGraph`)
  obecné úsečky dělí v průsečících a T-spojích stejně jako vodorovné / svislé, kolmice k prvku je kolmý průmět na
  šikmou stěnu. Ve volném prostoru zůstává pravoúhlé měřidlo `MANHATTAN`.

## Uložené půdorysy, verze a Zpět / Znovu (fáze 64)

- **Úložiště** – nákres (`FloorplanDraft`) patří firmě a je na serveru v `Floorplan.draftJson`; prohlížeč drží jen
  zálohu neuložených změn (`eldock.pb.floorplan:<id>`, nový půdorys `…:novy`). Nový půdorys vznikne při první změně.
- **Ukládání** – 1,2 s po poslední úpravě, při nepřetržité práci nejpozději po 10 s; zápis jen nad verzí, ze které
  editor vychází (`Floorplan.version`). Jiná verze = souběh dvou oken: odmítnutý nákres jde do historie (CONFLICT)
  a uživatel zvolí „Načíst aktuální verzi“, nebo „Ponechat mou verzi“ (stav serveru jde do historie jako OVERWRITE).
- **Historie verzí** – automatický snímek nejvýš jednou za 10 minut, ručně pojmenovaná verze, stav, ze kterého byl
  vygenerován rozváděč (GENERATE), stav před obnovením (RESTORE) a převzetí (IMPORT); drží se 30 snímků.
  Obnovení starší verze jde vrátit – současný stav se před ním uloží do historie.
- **Zpět / Znovu** – Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y a tlačítka v liště půdorysu; jedno tažení nebo jeden klik =
  jeden krok, rychlá série úprav z klávesnice a formulářů (mezery do 700 ms) se slučuje; 100 kroků. V textovém
  poli platí Zpět prohlížeče.
- **Rozváděč** – „⚡ Vygenerovat rozváděč“ nejdřív uloží půdorys a nový projekt (1 kredit) se k němu naváže;
  „📐 Upravit půdorys“ u projektu otevře navázaný půdorys, u projektů z fází 49–63 ho založí z kopie nákresu
  uložené v projektu (`PanelBoardProject.floorplanJson`).
