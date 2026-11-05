Implementujeme Fázi 49: "Vizuální 2D editor půdorysu elektroinstalace, 3D výpočet kabeláže s montážními výškami (Vrchem / Spodem / Optimalizovaně) a automatický generátor rozváděče".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 5 bodech:

1. ROZŠÍŘENÍ VÝPOČETNÍHO JÁDRA O 3D VÝŠKOVÝ PROFIL A REŽIMY TAHÁNÍ KABELŮ (`src/engine/floorplan-bridge.ts`):
Rozšiř výpočet délky kabelů (`calculateCableLength` a `generateCircuitsFromFloorplan`) o plný 3D výškový model v milimetrech:
- Globální výškové parametry podlaží (`ElevationProfile`):
  * `ceilingHeightMm`: Světlá výška stropu / podhledu pro vedení kabelů vrchem (výchozí `2600 mm`).
  * `floorDepthMm`: Hloubka uložení kabelu v podlaze / mazanině (výchozí `50 mm`).
  * `switchboardHeightMm`: Výška středu / vstupu rozváděče od čisté podlahy (výchozí `1500 mm`).
  * `defaultSocketHeightMm`: Výchozí výška běžných zásuvek od podlahy (výchozí `300 mm` dle ČSN 33 2130 ed. 4).
  * `worktopSocketHeightMm`: Výchozí výška zásuvek nad kuchyňskou linkou / v koupelně (`1150 mm`).
  * `defaultSwitchHeightMm`: Výchozí výška vypínačů / ovladačů od podlahy (`1050 mm`).
  * `slackPercent`: Technologická rezerva na ohyby a nepřesnosti trasy (výchozí `10 %`) + pevný přídavek na zapojení (`+600 mm` v rozváděči a `+150 mm` v každé krabici KU68).
- Individuální výška prvku: Každý uzel (`FloorNode`) může mít vlastní `mountHeightMm` (pokud není zadána, vezme se výchozí podle typu: běžná zásuvka `300 mm`, kuchyňská/pracovní zásuvka `1150 mm`, vypínač `1050 mm`, stropní světlo `ceilingHeightMm`).
- 3 REŽIMY VEDENÍ KABELÁŽE (`CableRoutingMode = "BOTTOM" | "TOP" | "OPTIMIZED"`):
  1) `BOTTOM` ("Spodem – v podlaze / mazanině"):
     - Svislý svod z rozváděče do podlahy: `switchboardHeightMm + floorDepthMm`.
     - Vodorovná ortogonální (Manhattan) trasa v podlaze: `|x2 - x1| + |y2 - y1|`.
     - Svislý výstup z podlahy do krabice prvku: `node.mountHeightMm + floorDepthMm` (u řetězených zásuvek v jednom okruhu jde přechod mezi sousedními zásuvkami ze zásuvky dolů do podlahy a zpět nahoru do další zásuvky: `2 * (mountHeightMm + floorDepthMm)`, pokud nejsou ve společném vícenásobném rámečku).
  2) `TOP` ("Vrchem – v podhledu / stropem"):
     - Svislý výstup z rozváděče do stropu: `(ceilingHeightMm - switchboardHeightMm)`.
     - Vodorovná ortogonální trasa ve stropě: `|x2 - x1| + |y2 - y1|`.
     - Svislé spuštění ze stropu dolů k prvku: `(ceilingHeightMm - node.mountHeightMm)`.
  3) `OPTIMIZED` ("Optimalizovaně – kombinace a nejmenší spotřeba kabelů"):
     - Pro každý okruh nezávisle spočítá variantu `BOTTOM` i variantu `TOP` a vybere pro daný okruh tu kratší a technicky nejvýhodnější (typicky: nízko položené zásuvky `300 mm` vede spodem v podlaze, stropní světla a vysoko položené vývody vede vrchem v podhledu; u řetězených zásuvek ve výšce `1150 mm` nad kuchyňskou linkou povolí přímé vodorovné propojení ve zdi ve stejné výšce bez scházení k podlaze!).
- Výstup výpočtu (`CableSummary`) musí vždy vracet porovnání všech 3 režimů:
  * Celková metráž v režimu `Spodem [m]`, `Vrchem [m]` a `Optimalizovaně [m]` + vyčíslená úspora v metrech (`Ušetřeno X m kabelu`).
  * Rozpad metráže podle průřezu a typu kabelu (`CYKY-J 3×1,5`, `CYKY-O 3×1,5`, `CYKY-J 3×2,5`, `CYKY-J 5×2,5`, `CYKY-J 5×4`, `CYKY-J 5×6`, `UTP Cat6`) a kontrolu úbytku napětí ΔU [%] na nejdelší větvi každého okruhu.

2. VIZUÁLNÍ 2D EDITOR PŮDORYSU ELEKTROINSTALACE (`/panel-builder/floorplan`):
Vytvoř novou interaktivní stránku `/panel-builder/floorplan` (dostupnou z modalu "Nový projekt rozváděče" i z horní lišty Panel Builderu jako `📐 2D Půdorys & Kabeláž`):
- PODKLAD PŮDORYSU:
  * Uživatel může nahrát vlastní obrázek půdorysu (PNG/JPG/WEBP/SVG) nebo PDF výkres stavby (vykreslený přes `pdf.js`), NEBO si přepnout na čistý rastr s rychlým nakreslením obdélníků místností myší.
- KALIBRACE MĚŘÍTKA NA 2 KLIKY:
  * Nástroj `[ 📏 Kalibrovat měřítko ]`: uživatel klikne na začátek a konec známé stěny nebo kóty ve výkresu a zadá reálnou délku (např. `4500 mm` / `4,5 m`) -> plátno okamžitě přepočítá měřítko a zobrazuje všechny vzdálenosti a trasy v reálných metrech.
- HORNÍ LIŠTA VÝŠEK A ZPŮSOBU TAHÁNÍ KABELŮ:
  * Přepínač trasy: `[ ⬇ Spodem (v podlaze) ]` · `[ ⬆ Vrchem (stropem/podhledem) ]` · `[ ✨ Optimalizovaně (Auto) ]`.
  * Rychlé nastavení výšek (v mm od podlahy): `Strop: [2600] mm` · `Rozváděč: [1500] mm` · `Zásuvky: [300] mm` · `Kuchyně/Linka: [1150] mm` · `Vypínače: [1050] mm`.

3. OSAZOVÁNÍ PRVKŮ DO PŮDORYSU A ŽIVÉ VYKRESLENÍ TRAS KABELŮ:
- V levém panelu zobraz paletu elektroinstalačních značek rozdělenou do 4 skupin:
  1. `⚡ Rozváděč`: Hlavní domovní / bytový rozváděč (výchozí bod všech tras).
  2. `🔌 Zásuvky`: Jednozásuvka (300 mm), Dvojzásuvka (300 mm), Zásuvka nad linkou (1150 mm), Zásuvka IP44 koupelna/venek (1150 mm), Datová zásuvka RJ45.
  3. `💡 Světla a vypínače`: Stropní svítidlo (2600 mm), Nástěnné svítidlo (2000 mm), Vypínač č. 1, Sériový č. 5, Střídavý č. 6, Křížový č. 7, Tlačítko (1050 mm). Kliknutím lze spárovat vypínač se světlem, které ovládá (vykreslí se čárkovaná ovládací vazba a podle počtu spínačů na jedno světlo se automaticky určí řazení 1 / 6 / 7!).
  4. `🔥 Samostatné spotřebiče (vlastní jisticí okruh)`: Varná deska 3f (400V), Trouba, Myčka, Pračka, Sušička, Chladnička (RCBO), Bojler, Tepelné čerpadlo, Wallbox EV.
- DETAIL VYBRANÉHO PRVKU V PŮDORYSU:
  * Po kliknutí na osazený prvek v půdorysu může uživatel upravit jeho přesnou **Montážní výšku [mm]**, název místnosti, počet kusů v rámečku (1R až 5R) a vybrat konkrétní **designovou řadu** z naší databáze `WiringDevice` (např. *ABB Levit*, *ABB Tango*, *ABB Zoni*, *Schneider Nová Unica*, *Legrand Valena Life*).
- VIZUALIZACE KABELOVÝCH TRAS:
  * Přímo nad půdorysem vykresluj ortogonální (Manhattan) trasy kabelů od rozváděče k jednotlivým okruhům (barevně odlišené podle okruhů, s popiskem délky v metrech včetně svislých svodů/výstupů).

4. ŽIVÁ KARTA METRÁŽE KABELŮ A PŘEVOD DO ROZVÁDĚČE NA 1 KLIK:
- V pravém panelu zobraz živou tabulku **„Výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4)“**:
  * Porovnání celkové délky: `Spodem: X m` | `Vrchem: Y m` | `Optimalizovaně: Z m (úspora N m)`.
  * Přesný rozpis kabelů k nákupu (např. `CYKY-J 3×2,5 mm²: 142 m`, `CYKY-J 3×1,5 mm²: 98 m`, `CYKY-J 5×2,5 mm²: 18 m`) včetně kontroly úbytku napětí ΔU.
  * Tlačítko **`[ ⚡ Vygenerovat rozváděč z tohoto půdorysu ]`**: zavolá `generateCircuitsFromFloorplan` + `buildSwitchboardFromCircuits`, vytvoří kompletně osazený projekt v AI Panel Builderu (se všemi jističi, chrániči, vyváženými fázemi, vybranou skříní, přiřazenými domovními vypínači/zásuvkami a uloženým výkazem kabeláže v dokumentaci) a přesměruje do `/panel-builder/[id]`.

5. TESTY A VERIFIKACE:
- Napiš unit testy pro 3D výpočet kabeláže (`BOTTOM` vs `TOP` vs `OPTIMIZED`, změna výšky zásuvky z 300 mm na 1150 mm, změna výšky stropu a rozváděče) a E2E test pro 2D půdorys. Spusť `npm run verify` a udělej commit.
