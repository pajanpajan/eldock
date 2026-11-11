# Zadání fáze 95 – nativní import BIM (IFC2x3 / IFC4, ISO 16739) do Správy závodů a 2D půdorysu

Vloženo z chatu 2026-11-11 (během fáze 93). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Přidáváme do ELDOCKu špičkovou B2B funkci: **Nativní import BIM dat (soubory `.ifc` – IFC2x3 a IFC4 dle ISO 16739)** pro automatické vygenerování rozměrů budov/hal/místností i kompletní elektrotechnické části (rozváděče, trafostanice, kabelové trasy/žlaby, stroje, spotřebiče, zásuvky a světla).

TVŮJ POSTUP:
1. Zapiš tuto etapu jako novou fázi do `docs/PLAN.md`.
2. Naimplementuj kompletní IFC/BIM engine (`src/lib/bim/ifc-parser.ts`) a napoj ho do **Průmyslové správy závodů (`/studio` a `/`)** i do **2D Půdorysu (`/panel-builder/floorplan`)**.
3. Napiš unit testy nad reálným vzorovým `.ifc` souborem, spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

================================================================================
ČÁST 1: PARSER BIM / IFC SOUBORŮ (`src/lib/bim/ifc-parser.ts`) – STAVEBNÍ + ELEKTRO ČÁST
================================================================================

Vytvoř rychlý, čistý TypeScript parser standardu **IFC STEP Physical File (ISO 10303-21, `.ifc` – podpora `IFC2X3` i `IFC4` / `IFC4X3`)**, který nevyžaduje žádné těžké nativní/WASM binárky a dokáže přímo v prohlížeči i na serveru rozparsovat nahraný `.ifc` soubor:

1. JEDNOTKY A SOUŘADNICOVÝ SYSTÉM (`IFCUNITASSIGNMENT`, `IFCSIUNIT`, `IFCCARTESIANPOINT`, `IFCAXIS2PLACEMENT3D`, `IFCLOCALPLACEMENT`):
   - Automaticky detekuj délkové jednotky v `.ifc` souboru (`MILLIMETRE` vs. `METRE` z `IFCSIUNIT(.LENGTHUNIT., .MILLI., .METRE.)`) a všechny souřadnice `(X, Y, Z)` i rozměry převáděj přesně na **metry (`m`)** a **milimetry (`mm`)**.
   - Rekurzivně vyhodnoť hierarchii lokálních souřadnic (`IFCLOCALPLACEMENT` -> `PlacementRelTo` + `RelativePlacement`), aby každý rozváděč, stroj, místnost a kabelový žlab získal svou **skutečnou globální pozici `(X, Y, Z)` v budově**!

2. EXTRAKCE STAVEBNÍ ČÁSTI A PŘESNÝCH ROZMĚRŮ (`buildings`, `storeys`, `spaces`, `walls`, `openings`):
   - `IFCPROJECT`, `IFCSITE`, `IFCBUILDING` -> Název projektu/areálu a seznam budov/výrobních hal.
   - `IFCBUILDINGSTOREY` -> Jednotlivá podlaží s názvem (např. `1. NP`, `2. NP`) a výškovou kótou `Elevation` (`Z`).
   - `IFCSPACE` (a `IFCRELAGGREGATES` / `IFCRELCONTAINEDINSPATIALSTRUCTURE`) -> Místnosti / výrobní sekce:
     * Vytáhni kód/číslo místnosti (`Name`), čitelný název (`LongName`, s dekódováním STEP Unicode sekvencí `\X2\...\X0\` pro bezchybnou českou diakritiku!), podlaží a geometrii půdorysu (`IFCRECTANGLEPROFILEDEF` -> `XDim`, `YDim`, nebo `IFCARBITRARYCLOSEDPROFILEDEF` -> `IFCPOLYLINE` vrcholy polygonu, příp. `IFCEXTRUDEDAREASOLID` a `IfcQuantityArea` / `BaseQuantities`).
   - `IFCWALL` / `IFCWALLSTANDARDCASE`, `IFCWINDOW`, `IFCDOOR` -> Obvodové stěny, příčky, okna a dveře s jejich pozicí a šířkou.

3. EXTRAKCE ELEKTROTECHNICKÉ ČÁSTI (`IfcElectricalDomain` & `IfcSharedBldgServiceElements`):
   Vytáhni z `.ifc` souboru všechny elektrotechnické prvky včetně jejich příslušnosti k podlaží/místnosti a napájení:
   - **Zdroje, trafostanice, DA a UPS:**
     * `IFCTRANSFORMER`, `IFCELECTRICGENERATOR`, `IFCELECTRICFLOWSTORAGEDEVICE` -> Trafostanice, dieselagregáty (DA) a centrální UPS.
   - **Rozváděče:**
     * `IFCELECTRICDISTRIBUTIONBOARD`, `IFCELECTRICDISTRIBUTIONPOINT`, a také `IFCDISTRIBUTIONCONTROLELEMENT` / `IFCFLOWCONTROLLER` / `IFCBUILDINGELEMENTPROXY`, pokud jejich `Name`, `ObjectType` nebo `PredefinedType` obsahuje `SWITCHBOARD`, `PANELBOARD`, `DISTRIBUTIONBOARD`, `ROZVADEC`, `RM`, `RH`, `HR`, `RP`.
   - **Kabelové trasy, žlaby, lávky a kabely:**
     * `IFCCABLECARRIERSEGMENT`, `IFCCABLECARRIERFITTING` (kabelové žlaby, lávky, trubky) a `IFCCABLESEGMENT` (kabely) -> vytáhni 3D lomové body trasy, skutečnou délku úseku v metrech (včetně svislého stoupání v ose `Z`!), šířku/výšku žlabu a typ kabelu.
   - **Výrobní stroje, motory, VZT a spotřebiče:**
     * `IFCELECTRICAPPLIANCE`, `IFCMOTORCONNECTION`, `IFCELECTRICMOTOR`, `IFCUNITARYEQUIPMENT`, `IFCPUMP`, `IFCFAN`, `IFCCHILLER`, `IFCBOILER`.
   - **Domovní a komerční elektroinstalace (pro 2D Půdorys):**
     * `IFCLIGHTFIXTURE` (svítidla včetně nouzových `EXITLIGHT` / `SAFETYLIGHT`), `IFCOUTLET` (zásuvky silové a datové), `IFCSWITCHINGDEVICE` (vypínače, nouzová tlačítka CENTRAL STOP), `IFCSENSOR` (čidla), `IFCACTUATOR` (pohony žaluzií/topení).

4. EXTRAKCE ELEKTROTECHNICKÝCH PARAMETRŮ (`IFCPROPERTYSET`, `IFCPROPERTYSINGLEVALUE`, `IFCSYSTEM`):
   Pro každý prvek projdi navázané `IFCRELDEFINESBYPROPERTIES` -> `IFCPROPERTYSET` (zejména `Pset_DistributionBoardCommon`, `Pset_ElectricalDeviceCommon`, `Pset_CableSegmentOccurrence`, `Pset_LightFixtureTypeCommon`, `Pset_OutletTypeCommon` i české/revitové parametry jako `Příkon`, `Apparent_Load`, `Nominal_Current`, `Voltage`, `Number_of_Poles`, `IP_Code`, `Circuit_Number`, `Panel_Name`):
   - Automaticky načti:
     * **Označení rozváděče / prvku** (`Tag` / `Reference` / `Mark`, např. `RH1`, `R-102`, `-F1`),
     * **Jmenovitý proud $I_n$ [A]** (`NominalCurrent` / `RatedCurrent`),
     * **Jmenovitý příkon $P$ [kW / W]** (`RatedPower` / `ApparentPower` / `TotalConnectedLoad`),
     * **Napětí $U$ [V] a počet fází** (`NominalVoltage` -> `230 V 1f` vs. `400 V 3f`),
     * **Stupeň krytí IP** (`IP_Code`, např. `IP44`, `IP54`, `IP65`),
     * **Kategorii zálohování** (`BackupTier`: pokud název/systém obsahuje `UPS` / `ZIS` -> `CRITICAL_UPS_ZIS`; pokud `DA` / `GEN` / `DIESEL` -> `BACKUP_GENERATOR_DA`; jinak `GRID_STANDARD`),
     * **Topologii zapojení (`IFCSYSTEM`, `IFCRELASSIGNSTOGROUP`, `IFCRELCONNECTSPORTS`):** Který stroj, okruh nebo podružný rozváděč je napájen ze kterého nadřazeného rozváděče!

================================================================================
ČÁST 2: IMPORT BIM (`.ifc`) DO PRŮMYSLOVÉ SPRÁVY ZÁVODŮ (`/studio` a `/`)
================================================================================

V průmyslové části aplikace (`/` a `/studio` – 2D Studio pro správu závodu) přidej tlačítko **`[ 🏢 Importovat BIM model závodu (.ifc) ]`** + tlačítko **`[ ✨ Vyzkoušet na vzorovém BIM souboru haly (.ifc) ]`**:

1. PŘEHLEDNÉ OKNO KONTROLY PŘED IMPORTEM (`BimImportModal.tsx`):
   Po nahrání `.ifc` souboru zobraz přehledný souhrn, co ELDOCK v BIM modelu našel:
   - **Stavební struktura:** Počet budov/hal, podlaží, místností (`IfcSpace`), celková plocha v $\text{m}^2$ a vnější rozměry areálu v metrech (např. `84,0 × 42,5 m`).
   - **Elektrotechnická výzbroj:**
     * `⚡ Zdroje, trafostanice, DA a UPS:` seznam nalezených zdrojů s výkonem.
     * `🗄️ Rozváděče (IfcElectricDistributionBoard):` tabulka nalezených rozváděčů (kód, název, podlaží/místnost, $I_n$ [A], příkon [kW], krytí IP, větev Síť/DA/UPS).
     * `⚙️ Stroje a technologické spotřebiče:` počet a seznam strojů/VZT s příkony v kW.
     * `🔌 Kabelové trasy a žlaby (IfcCableCarrierSegment):` počet tras a celková metráž v metrech.
   - Volba režimu importu:
     * `[ Vytvořit z BIMu kompletní mapu závodu, rozváděče, trasy i stroje ]` *(Výchozí)*
     * `[ Aktualizovat existující rozváděče podle kódů z BIMu (zachovat stávající PDF schémata a Červenky) ]`

2. AUTOMATICKÉ SESTAVENÍ 2D MAPY ZÁVODU A STROMU NAPÁJENÍ:
   Po potvrzení importu:
   - Vytvoř v databázi/stavu závodu budovy a místnosti s přesnými rozměry z BIMu.
   - Rozmísti na 2D mapu v přesných souřadnicích `(X, Y)` všechny trafostanice, hlavní a podružné rozváděče i výrobní stroje.
   - Propoj rozváděče a stroje kabelovými trasami s reálnou délkou a průřezem/žlabem z BIMu, nastav jejich jmenovité proudy, příkony a úrovně zálohování (`GRID_STANDARD` / `BACKUP_GENERATOR_DA` / `CRITICAL_UPS_ZIS`) a vygeneruj k nim QR kódy!
   - U každého rozváděče přidej tlačítko **`[ ⚡ Otevřít tento BIM rozváděč v AI Panel Builderu a vygenerovat vnitřní osazení ]`**, které vezme okruhy a příkon z BIMu a automaticky poskládá DIN lišty s jističi a chrániči!

================================================================================
ČÁST 3: IMPORT BIM (`.ifc`) DO 2D PŮDORYSU (`/panel-builder/floorplan`)
================================================================================

Stejný parser napoj také do **2D Půdorysu (`/panel-builder/floorplan`)** v Kroku 1 u tlačítka **`Nahrát půdorys (PDF / DXF / BIM .ifc / Obrázek)`**:
- Když uživatel nahraje `.ifc` soubor (např. rodinný dům, patro nemocnice nebo obchodní jednotku v OC):
  1) Automaticky vytvoř všechna podlaží (`IFCBUILDINGSTOREY` -> `1. NP`, `2. NP`...).
  2) Automaticky nastav velikost plátna podle rozměrů budovy z BIMu (např. `24 × 18 m`) a nastav měřítko **1:1 bez nutnosti ruční kalibrace**!
  3) Ze všech `IFCSPACE` (a `IFCWALL`) automaticky vytvoř na plátně **místnosti s přesnými rozměry `X × Y` v metrech a českými názvy** (Obývací pokoj, Koupelna, Technická místnost, Ordinace...), včetně oken (`IFCWINDOW`) a dveří (`IFCDOOR`)!
  4) Pokud `.ifc` soubor obsahuje i elektro prvky (`IFCELECTRICDISTRIBUTIONBOARD`, `IFCOUTLET`, `IFCLIGHTFIXTURE`, `IFCSWITCHINGDEVICE`, `IFCELECTRICAPPLIANCE`), rovnou je osaď na jejich přesné souřadnice `(X, Y)` a výšky `Z` v milimetrech, natrasuj k nim obvodové kabely a umožni z nich jedním klikem vygenerovat rozváděč!

================================================================================
ČÁST 4: VZOROVÝ BIM SOUBOR PRO OKAMŽITÉ VYZKOUŠENÍ + TESTY A DEPLOY
================================================================================

1. Vytvoř v `public/samples/eldock-sample-plant.ifc` (a v generátoru vzorového IFC v kódu) reálný, platný vzorový `.ifc` soubor (`ISO-10303-21` / `IFC4`), který obsahuje:
   - Výrobní a technologickou halu s místnostmi (`IfcSpace`: *Rozvodna VN/NN*, *Výrobní hala M1*, *Kompresorovna*, *Velín údržby*),
   - Trafostanici `TR1 (630 kVA)` + Dieselagregát `DA1 (250 kVA)` + UPS `UPS1 (60 kVA)`,
   - Rozváděče `HR1 (Hlavní rozváděč 1000 A)`, `RM1 (Podružný rozváděč lisovny 250 A)`, `R-UPS (Kritický rozváděč velínu 63 A)` s `Pset_DistributionBoardCommon`,
   - Kabelové žlaby `IfcCableCarrierSegment` a výrobní stroje `IfcElectricAppliance` (*CNC Frézka 45 kW*, *Hydraulický lis 75 kW*, *Šroubový kompresor 37 kW*),
   aby si uživatel mohl import BIMu vyzkoušet jedním kliknutím na **`[ ✨ Vyzkoušet import na vzorovém BIM (.ifc) modelu ]`** i bez vlastního souboru z Revitu!
2. Napiš unit testy v `src/lib/bim/__tests__/ifc-parser.test.ts`, které ověří:
   - Přesný převod jednotek (`MILLIMETRE` i `METRE`) a dekódování české diakritiky ze STEP `\X2\...\X0\`.
   - Vytěžení místností (`IFCSPACE`) s rozměry `X × Y`, rozváděčů (`IFCELECTRICDISTRIBUTIONBOARD`) s proudem a příkonem z `IFCPROPERTYSET`, kabelových žlabů (`IFCCABLECARRIERSEGMENT`) a strojů.
   - Převod načteného BIM modelu jak do průmyslového závodu, tak do místností a prvků 2D půdorysu.
3. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

- **Parser** (`src/lib/bim/`) je čistý TypeScript bez WASM: `step.ts` rozdělí sekci DATA jedním průchodem na entity
  (řetězce s „;“ a „)“ se respektují) a argumenty parsuje až při čtení entity – velké exporty z Revitu tak nedrží celý
  strom hodnot v paměti. Dekóduje `\X2\…\X0\`, `\X4\`, `\X\HH`, `\S\` a zdvojený apostrof. Jednotky z
  `IfcUnitAssignment` (předpony MILLI / CENTI …, IfcConversionBasedUnit FOOT / INCH, výkon / proud / napětí), globální
  poloha složením IfcLocalPlacement (osa Z a RefDirection), tvar z IfcExtrudedAreaSolid (obdélník, mnohoúhelník
  IfcPolyline / IfcIndexedPolyCurve / IfcCompositeCurve, kruh), IfcMappedItem, jinak obálka bodů B-rep / tesselace.
  IfcGridPlacement a zakřivené úseky se nevyhodnocují (varování).
- **Elektro prvky:** IFC4 třídy (IfcTransformer, IfcElectricGenerator, IfcElectricFlowStorageDevice,
  IfcElectricDistributionBoard, IfcCableCarrierSegment / Fitting, IfcCableSegment, IfcElectricAppliance, motory, VZT,
  čerpadla, IfcLightFixture, IfcOutlet, IfcSwitchingDevice, IfcSensor, IfcActuator) i IFC2X3 obecné třídy (IfcFlowController,
  IfcElectricDistributionPoint, IfcBuildingElementProxy …) podle typu objektu (IfcRelDefinesByType) nebo názvu
  (SWITCHBOARD, ROZVÁDĚČ, RM / RH / HR / RP …). Vlastnosti z property setů instance i typu a z IfcElementQuantity –
  anglické Pset_ názvy i české a revitové parametry (Příkon, Apparent_Load, Nominal_Current, Panel, Circuit_Number);
  výkon z IfcPowerMeasure v jednotce projektu, jinak podle jednotky v názvu / hodnotě. Úroveň zálohování z vlastnosti
  BackupTier, názvu a systémů a po větvi napájení (prvek z UPS / DA ji dědí).
- **Topologie napájení:** 1) IfcRelConnectsPorts (port SOURCE → SINK, kabel jako RealizingElement nebo mezičlánek),
  2) IfcRelAssignsToGroup / IfcSystem / IfcDistributionCircuit (jediný rozváděč skupiny napájí ostatní, jinak rozváděč
  podle označení v názvu okruhu), 3) Revit „Panel“ / „Napájeno z“ podle označení.
- **Správa závodů:** soubor se čte v prohlížeči, na server jde zmenšený model (podlaží, obálky místností, zdroje,
  rozváděče, stroje a kabely přívodů) – Server Action přijme do 1 MB, velký model se má importovat po budovách. Import
  skládá koncept Studia výstavby (stejná pravidla hierarchie napájení, rastr 1 m, tagy, QR kódy) a ve stejné transakci
  zapíše údaje z BIMu (In, U, IP, nový sloupec `ratedPowerKw`, Ib, typ a délka přívodního kabelu – z IfcCableSegment,
  jinak odhad po trase, kapacita DA / UPS, `bimGuid`). Osa Y se otočí (sever nahoru). Místnosti jsou ve Studiu obdélníky
  (obálka IfcSpace), druh místnosti podle názvu. Správa závodů nemá typ DA / UPS: zdroj se uloží jako kořenový zdroj
  (typ trafostanice) se zálohováním a kapacitou, napájení UPS z DA zůstane v popisu. Stroj bez napájecího rozváděče
  dostane hlavní rozváděč budovy (poznámka v okně). Kabelové žlaby nemají v mapě vlastní vrstvu – v okně jejich počet
  a metráž, u zařízení délka přívodu. Režim „Aktualizovat existující rozváděče podle kódů“ páruje podle GlobalId, jinak
  jednoznačného označení, a mění jen parametry (popis, revize, PDF schémata a Červenky zůstanou).
- **⚡ Rozváděč z BIMu do AI Panel Builderu:** vývody k zařízením, která rozváděč v závodě napájí (jištění C ≥ Ib,
  kabel a délka z BIMu, úbytek napětí a kontrola impedance smyčky), hlavní vypínač podle In rozváděče, skříň a strom
  zapojení stejným generátorem jako u půdorysu; přístroje nad 125 A jsou orientační kusy s varováním. Potřebuje přihlášení
  do závodu (právo AI Panel Builder) i firmu AI Panel Builderu a stojí 1 kredit (nepovedený návrh ho vrátí). Tlačítko je
  ve výsledku importu a na kartě rozváděče s `bimGuid`.
- **2D půdorys:** nahrání `.ifc` vytvoří všechna podlaží (výchozí = kóta nejblíž ±0), plátno = obálka stavby + 1 m okraj
  v mm bez kalibrace, místnosti s názvy (mnohoúhelník jako body místnosti), okna a dveře podle šířky, hlavní rozváděč RH
  (napájený ze zdroje) a podružné RP s kódem z BIMu, zásuvky (datová, IP44, dvojitá), svítidla (nouzové NO_SV),
  vypínač, PIR, pohon žaluzie a stroje jako vlastní spotřebiče s příkonem a 3f jištěním (do 32 A, nad to varování).
  Tlačítko CENTRAL STOP se do půdorysu neosazuje (spoušť doplní rozváděč v režimu BD4). Nákres s prvky se nahradí až po
  potvrzení.
- **Vzorový model** `public/samples/eldock-sample-plant.ifc` (IFC4, mm) je výstup generátoru `samplePlantIfc()`
  (`npm run bim:sample`, test hlídá shodu) – hala H1 84,0 × 42,5 m posunutá v areálu, 2 podlaží, 5 místností (hala jako
  mnohoúhelník), TR1 / DA1 / UPS1, HR1 / RM1 / R-UPS s Pset_DistributionBoardCommon, stroje 45 / 75 / 37 kW a VZT 18 kW,
  6 kabelů a 4 žlaby / lávka, napájení všemi třemi cestami (porty, okruhy, Revit „Panel“) a domovní přístroje ve velínu.
