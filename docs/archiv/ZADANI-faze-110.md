# Zadání fáze 110 – 3D náhled a kontrola výšek i pro PDF podklad bez nakreslených místností: odvozené stěny, PDF na podlaze, pohled na stěnu „Celý půdorys (PDF podklad)“ a 🔌 kabelové trasy

Vloženo z chatu 2026-11-13 (po nasazení fáze 109). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Zjistili jsme přesnou příčinu chyby v `3D náhled a kontrola výšek` (`FloorplanPseudo3DModal.tsx` v `/panel-builder/floorplan`):
- Když jsou místnosti nakreslené v programu (`rooms.length > 0` jako obdélníky), poloprůhledné 3D stěny i `Pohled na stěnu` fungují skvěle.
- Když ale uživatel nahraje PDF / obrázkový podklad a osazuje prvky přímo na PDF (nebo nakreslí polygonové místnosti / místnosti v kalibrovaném měřítku PDF), 3D stěny selžou a `Pohled na stěnu` vypíše „Nakreslete nejdřív místnost.“.
- Navíc v horní liště `FloorplanPseudo3DModal.tsx` ještě chybí zapínací tlačítko `[ 🔌 Kabelové trasy ]`.

Oprav to kompletně v těchto 4 bodech:

================================================================================
1. AUTOMATICKÉ 3D STĚNY (20 % OPACITY) I PRO NAHRANÝ PDF PODKLAD BEZ MÍSTNOSTÍ
================================================================================

V `FloorplanPseudo3DModal.tsx` uprav přípravu 3D stěn tak, aby 100% fungovala ve všech 3 situacích u nahraného PDF:

A) **Sjednocení souřadnic a podpora polygonových místností nad PDF:**
   - Pokud uživatel nad PDF místnosti nakreslil (ať už přes `x, y, width, height` nebo jako polygon `points` / `vertices`), převeď každý polygon i obdélník do jednotného formátu stěnových úseček `[p1, p2]`.
   - Výpočet 3D kamery a bounding-boxu (`minX, minY, maxX, maxY, scale`) musí počítat společný rozsah ze VŠECH místností, VŠECH prvků (`items`), oken/dveří (`furniture`) i rozměru PDF podkladu, aby po kalibraci měřítka PDF nebyly stěny vykreslené mimo viditelný výřez plátna!

B) **Automatické odvození 3D stěn, když uživatel nahrál PDF a místnosti nekreslil (`rooms.length === 0`):**
   - Když je `rooms.length === 0` (uživatel sázel prvky rovnou na PDF výkres), **NIKDY nenech 3D pohled bez stěn**!
   - Automaticky vygeneruj 3D stěny (`virtualWalls` vytažené od `0 mm` do `ceilingHeightMm = 2600 mm` s `20%` poloprůhledností `rgba(148, 163, 184, 0.20)` a jasnými hranami `rgba(226, 232, 240, 0.55)`):
     1) Vytvoř obvodové stěny půdorysu (podle obálky osazených prvků, oken, dveří a kalibrovaného PDF podkladu).
     2) Vytvoř vnitřní příčky zarovnané podle osazených **oken, dveří** (`furniture` typu okno/dveře leží vždy přímo ve stěně!) a podle ortogonálních linií nástěnných prvků (vypínačů u dveří, nástěnných zásuvek a rozváděče) / rozdělení okruhů.
     3) V horní liště 3D modalu zobraz v tomto režimu užitečný štítek: `📐 PDF režim: Obvodové stěny a příčky byly automaticky odvozeny z prvků na PDF podkladu`.

C) **Vykreslení samotného PDF půdorysu na podlahu 3D izometrie (`z = 0 mm`):**
   - Pokud má projekt nahraný PDF / rastrový podklad (`backgroundImage` / `pdfFloorplanUrl`), vykresli na rovinu podlahy (`z = 0`) izometricky transformovaný obrys podlahy s jemnou mřížkou a náhledem podkladu (s přepínačem `[ 🗺️ PDF podklad na podlaze ]`), aby se uživatel v 3D prostoru okamžitě orientoval podle čar svého výkresu!

================================================================================
2. FUNKČNÍ „POHLED NA STĚNU“ I PŘI NAHRANÉM PDF BEZ NAKRESLENÝCH MÍSTNOSTÍ
================================================================================

PROBLÉM (`image_d61680.png`): V režimu `Pohled na stěnu` se při `rooms.length === 0` zobrazí prázdná obrazovka s textem *„Nakreslete nejdřív místnost.“*.

OPRAVA:
- Pokud je `rooms.length === 0` (nebo jsou prvky umístěné mimo nakreslené místnosti přímo na PDF), **automaticky vytvoř virtuální místnosti pro `Pohled na stěnu`**:
  1) **`Celý půdorys (PDF podklad)`** – zahrnuje všechny osazené prvky, okna, dveře a nábytek v půdorysu a umožní je okamžitě zobrazit v čelním průmětu ze 4 stran (`Severní`, `Východní`, `Jižní`, `Západní`) s výškovým pravítkem `0 mm` až `2600 mm` a měnit jejich výšku myší nebo tlačítky!
  2) Pokud mají prvky přiřazené zóny / okruhy (např. *Kuchyň*, *Obývák*, *Koupelna* z názvů okruhů nebo shluků), přidej do rozbalovacího seznamu místností i tyto automaticky rozpoznané zóny!
- Hlášku *„Nakreslete nejdřív místnost.“* úplně odstraň – `Pohled na stěnu` musí vykreslit stěnu s výškovým pravítkem a prvky VŽDY, jakmile je v půdorysu alespoň 1 prvek nebo PDF podklad!

================================================================================
3. PŘEPÍNAČ `[ 🔌 Kabelové trasy ]` PŘÍMO V HORNÍ LIŠTĚ 3D NÁHLEDU
================================================================================

Do horní ovládací lišty `FloorplanPseudo3DModal.tsx` (vedle posuvníků `otočení` a `náklon`) přidej zapínací tlačítko **`[ 🔌 Kabelové trasy ]`** (ve výchozím stavu zapnuté nebo snadno přepínatelné na 1 klik):
- V režimu **Izometrie 3D** vykreslí 3D trasy kabelů od rozváděče `RH` (ve výšce `1500 mm`) přes podlahu (`0 mm`) nebo strop (`2600 mm`) a svislé svody po stěnách přímo do jednotlivých zásuvek (`300 / 1150 mm`), vypínačů (`1200 mm`), spotřebičů a svítidel (odlišené barvou: silové zásuvkové a spotřebičové trasy oranžově/fialově, světelné žlutě/zeleně, sběrnice modře/azurově).
- V režimu **Pohled na stěnu** vykreslí vodorovné a svislé uložení kabelů přímo na stěně (v instalačních zónách dle ČSN 33 2130 ed. 4).

================================================================================
4. TESTY A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit/integrační test ověřující:
   - Že `FloorplanPseudo3DModal` vykreslí 3D stěny i v případě, kdy má projekt pouze nahraný PDF podklad a osazené prvky bez ručně nakreslených místností (`rooms = []`).
   - Že přepnutí na `Pohled na stěnu` při `rooms = []` automaticky vybere `Celý půdorys (PDF podklad)` a vykreslí prvky ve výšce `0–2600 mm` bez hlášky „Nakreslete nejdřív místnost“.
   - Že tlačítko `Kabelové trasy` zapíná/vypíná vykreslení 3D kabelových tras.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Bez migrace. Geometrie v `src/lib/panel-builder/pseudo3d.ts`, vykreslení v `FloorplanPseudo3DModal.tsx` (`IsoView3D` a
`WallView` jsou exportované kvůli testům).

**1A. Jednotné stěny a výřez kamery:**

- Stěny nakreslených místností jsou jednotné úsečky `[a, b]` (`roomWallSegments`). Obdélník i mnohoúhelník (`points`)
  prochází `roomPolygon`; pojmenování `vertices` aplikace nepoužívá.
- Střed a výřez izometrie počítá `sceneExtent` ze všech místností, prvků, nábytku, oken a dveří a z listu podkladu
  (`widthMm × heightMm`).
- Do výřezu se počítají i stěny, otvory, nábytek, trasy a rohy podkladu, takže po kalibraci měřítka PDF nic neleží
  mimo plátno.

**1B. Stěny bez nakreslených místností** (`inferWalls`):

- Obvodové stěny podle obálky prvků (±150 mm), nábytku a os oken a dveří. Otvory leží ve stěně, takže obálka končí
  v jejich ose. Obálka se ořízne listem PDF (nejméně 1 × 1 m).
- Vnitřní příčky leží v ose oken a dveří a v linii nástěnných prvků (zásuvky, vypínače, ovladače, rozváděč pod 2,3 m),
  které mají stejnou osu natočení a leží do 200 mm od sebe:
  - příčka vznikne jen s oporou – otvor, nebo aspoň 2 prvky;
  - linie do 300 mm od obvodu je obvodová stěna;
  - konce se dotáhnou k obvodu do 2,5 m;
  - nejvýš 16 příček.
- Stěny jsou poloprůhledné (20 %) od podlahy do stropu s hranami jako u nakreslených místností.
- Štítek nad náhledem: „📐 PDF režim: Obvodové stěny a příčky byly automaticky odvozeny z prvků na PDF podkladu“. Bez
  podkladu má štítek obdobné znění.
- **Odchylka:** čáry stěn v nahraném PDF se nerozpoznávají – podklad je obrázek. Rozdělení okruhů se pro příčky
  nepoužívá. Prvky ve výchozím natočení (0°) samy příčku netvoří, potřebují oporu.

**1C. PDF podklad na podlaze:**

- Podklad se vykreslí v rovině z = 0 afinní maticí `isoFloorMatrix` – stejnou transformací jako `isoProject`.
- Barvy jsou invertované pro tmavé pozadí. Je vidět obrys listu a jemná mřížka 1 m (u listu nad 30 m po 2 m).
- Přepínač „🗺️ PDF podklad na podlaze“ je zapnutý. Podlahy nakreslených místností jsou nad podkladem poloprůhledné.

**2. Pohled na stěnu bez místností** (`virtualRooms`, `elevationOfArea`):

- Bez místností, nebo s prvky mimo nakreslené místnosti, nabídne výběr virtuální místnost „Celý půdorys (PDF
  podklad)“. Bez podkladu se jmenuje „Celý půdorys“.
- Nabídne i zóny:
  - podle názvu místnosti u prvků („Kuchyň (zóna z prvků)“);
  - bez názvů ze shluků prvků (do 2,5 m od sebe, aspoň 3 prvky) pojmenovaných podle vybavení – Kuchyň (spotřebiče,
    linka), Koupelna, Ložnice, Obývák, jinak „Zóna N“.
- Pohled je čelní průmět všech prvků zóny na zvolenou stranu (Severní / Východní / Jižní / Západní) s pravítkem
  0 – strop. Výšku jde měnit myší i tlačítky jako u nakreslené místnosti.
- Hláška „Nakreslete nejdřív místnost.“ je pryč. Prázdný půdorys bez podkladu ukáže prázdnou stěnu 5 m s pravítkem
  a nápovědou.

**3. 🔌 Kabelové trasy** (přepínač v liště, výchozí zapnutý):

- Izometrie (`cableRuns3D`) – úseky okruhů z výpočtu tras 2D půdorysu (`displayRoutes`):
  - vodorovně po podlaze (spodem, 0 mm) nebo pod stropem (vrchem);
  - svislé svody do výšky prvku – rozváděč ve výšce rozváděče, zásuvky 300 / 1 150 mm, vypínače a svítidla podle
    výškového profilu;
  - barvy: zásuvky oranžově, spotřebiče fialově, světla žlutě, stínění zeleně, data modře, sběrnice azurově.
- Pohled na stěnu: instalační zóny 150–450 mm pod stropem a nad podlahou (ČSN 33 2130 ed. 4). Okruh vede vodorovně
  v ose zóny a svisle k prvkům okruhu, včetně rozváděče na začátku trasy.
- **Odchylky:**
  - spojení vypínač – světlo (korespondence) není úsek okruhu, na stěně se nekreslí;
  - výška vypínače se bere z výškového profilu nákresu (výchozí 1 050 mm, zadání uvádí 1 200 mm jako příklad).

**4. Testy:**

- `src/lib/panel-builder/phase110.test.ts` (7):
  - odvozené stěny a příčka;
  - izometrie s jen PDF podkladem a prvky (stěny, podlaha s PDF, výřez);
  - mnohoúhelníkové stěny a matice podlahy;
  - virtuální místnost „Celý půdorys (PDF podklad)“ ze 4 stran bez hlášky;
  - zóny a shluky;
  - 3D trasy (výšky svodů, barvy);
  - skutečný výpočet tras bez místností a přepínač tras v izometrii i na stěně.
- E2E `e2e/phase110.spec.ts`: nahrané PDF, prvky přímo na podkladu bez místností. Ověřuje stěny, štítek, podklad na
  podlaze s přepínačem, trasy zapnout / vypnout, pohled na stěnu (celý půdorys, 4 strany, změna výšky) a snímky.
