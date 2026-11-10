# Zadání fáze 89 – 2D půdorys: místnost podle rozměrů X × Y, průvodce v 5 fázích a kompaktní CAD lišta

Vloženo z chatu 2026-11-10. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Horní část stránky 2D půdorysu (`/panel-builder/floorplan`) je momentálně vizuálně zahlcená – nad plátnem je pod sebou naskládaných 8 různých nástrojových lišt a panelů, které zabírají 85 % výšky obrazovky. Zároveň místo statických video-návodů chceme přímo do 2D půdorysu zabudovat logického fázového průvodce a možnost vytvářet místnosti přesným zadáním rozměrů X × Y.

Zapiš tuto úpravu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 4 bodech:

1. VKLÁDÁNÍ MÍSTNOSTI ZADÁNÍM PŘESNÝCH ROZMĚRŮ X × Y + PŘESUN MYŠÍ S MAGNETICKÝM PŘICHYTÁVÁNÍM (SNAP):
- U nástroje pro tvorbu místností přidej vedle kreslení tažením myši (`Kreslit místnost obdélník` / `Polygon`) přímý **Generátor místnosti podle rozměrů X × Y**:
  * Zobraz kompaktní inline formulář:
    - **Název / typ místnosti:** Rychlý výběr z předvoleb (`Obývací pokoj`, `Kuchyň`, `Obývák + KK`, `Ložnice`, `Dětský pokoj`, `Pracovna`, `Koupelna`, `WC`, `Chodba / Zádveří`, `Technická místnost`, `Šatna`, `Spíž`, `Garáž`) nebo vlastní text.
    - **Šířka X [m]:** číselné pole (např. `4.50`, podporuj tečku i čárku, příp. přepínač `m / mm`).
    - **Hloubka Y [m]:** číselné pole (např. `3.80`).
    - Tlačítko **`[ + Vytvořit místnost ]`** (nebo stisk `Enter`) + tlačítko **`[ ↻ Prohodit X ↔ Y ]`**.
  * **Jak se nově vytvořená místnost chová:**
    - Po kliknutí na `[ + Vytvořit místnost ]` se na volném místě plátna (nebo v režimu "plovoucí místnosti na kurzoru") okamžitě vytvoří místnost přesně zadaných rozměrů `X × Y` s vypsanými kótami (např. `4,50 × 3,80 m · 17,1 m²`) a automaticky se přepne do režimu přesunu.
    - Uživatel místnost jednoduše chytne myší za její plochu a přesune ji na finální místo v půdorysu!
    - **Magnetické přichytávání stěn a rohů (Room-to-Room Wall Snap):** Při posouvání místnosti myší přidej automatické přichytávání (tolerance `150 mm`) k vnějším stěnám a rohům již existujících místností (se zvýrazněním modré/žluté vodicí čáry zarovnání), aby šlo půdorys domu poskládat z jednotlivých místností jako stavebnici bez mezer a překryvů!
    - I u již položené místnosti lze kdykoliv v pravém panelu nebo dvojklikem na kótu přepsat číselně její Šířku X a Hloubku Y.

2. ROZLOŽENÍ NÁVRHU DO 5 ČISTÝCH FÁZÍ (INTERAKTIVNÍ PRŮVODCE PŮDORYSEM):
Odstraň současnou stěnu 8 pod sebou naskládaných lišt! Místo toho zaveď nad plátnem čistý, vizuálně vzdušný **5krokový průvodce (`FloorplanWizardBar`)**, který v každém kroku zobrazuje POUZE jednu kontextovou lištu nástrojů pro danou fázi (takže kreslicí plátno s levým a pravým panelem zabírá min. 80 % výšky okna prohlížeče!):

- **Fáze 1: `1. Podklad a místnosti`**
  * Zobrazí přehledný výběr:
    a) **Mám výkres od stavaře:** `[ 📄 Nahrát půdorys (PDF / DXF / Obrázek) ]`, `[ 📏 Kalibrovat měřítko ]`, `Úprava PDF / Vrstvy DXF`.
    b) **Kreslím místnosti od nuly:** Rychlé vložení místnosti zadáním **`Název + Šířka X [m] × Hloubka Y [m] -> [ + Vytvořit místnost ]`**, `[ ▭ Kreslit obdélník myší ]`, `[ 📐 Kreslit šikmou stěnu ]`, nastavení velikosti rastru (`Plocha 20 × 16 m`) a správa podlaží (`1. NP`, `+ Přidat podlaží`).
  * Krátká nápověda v liště: *"Nahrajte podklad a zkalibrujte měřítko, nebo zadejte rozměry X × Y jednotlivých místností a poskládejte je myší k sobě."* + tlačítko **`[ Pokračovat na Výběr systému a designu → ]`**.

- **Fáze 2: `2. Systém, výrobce a design`**
  * Zobrazí výběr **Úrovně instalace** (`1. Klasická 230/400 V` | `2. Sběrnicová Smart Home` | `3. Retrofit`), **Přívodu rozváděče** (`3× 230/400 V TN-S / TN-C-S` | `1× 230 V`) a přehledný výběr **Výrobce (ABB, Schneider, Legrand, Hager, Loxone, TapHome) -> Designové řady -> Barvy klapky a rámečku**.
  * Jakmile uživatel klikne na **`[ Pokračovat na Osazení prvků → ]`** (nebo přepne na jinou fázi), celý tento velký box výrobců a barev se SCHOVÁ a v horní liště z něj zůstane jen malý klikací souhrnný odznak (např. `[ 🎨 ABB Levit M · Perleťová/bílá ]`), který nezabírá žádné místo na výšku!

- **Fáze 3: `3. Osazení prvků a spotřebičů`**
  * Hlavní pracovní fáze s maximální plochou plátna!
  * V horní liště jsou jen rychlé přepínače (`Výběr a přesun`, `Velikost značek`, rychlý čip zvolené řady/barvy) a krátká nápověda: *"Nejprve umístěte rozváděč RH, v koupelně vyznačte vanu/sprchu/umyvadlo a poté z levého menu osazujte zásuvky, světla, vypínače a spotřebiče."* + tlačítko **`[ Pokračovat na Trasy kabelů → ]`**.

- **Fáze 4: `4. Trasy kabelů a výšky`**
  * Zobrazí pouze lištu směrování a výšek: `Spodem (v podlaze)` | `Vrchem (stropem)` | `Optimalizovaně (Auto)`, styl `Po stěnách (obvodově dle ČSN)` | `Nejkratší v podlaze`, zobrazení `Barevně podle okruhů` | `Normové CAD značení (ČSN)`, uložení kabelů (`C - pod omítkou`...) a výchozí montážní výšky (`Strop`, `Rozváděč`, `Zásuvky`, `Linka`, `Vypínače`, `Rezerva %`).
  * Nápověda: *"Zkontrolujte automatické obvodové trasy. Kterýkoliv rovný úsek kabelu můžete chytit myší a posunout v ose X nebo Y."* + tlačítko **`[ Pokračovat na Kusovník a Rozváděč → ]`**.

- **Fáze 5: `5. Kusovník, Export a Rozváděč`**
  * Zobrazí rychlé akce pro výstup: **`[ 📋 Kompletní kusovník (BOM) ]`**, **`[ 📄 Exportovat výkres do PDF (A3/A4) ]`**, **`[ 📐 Exportovat do CAD (DXF/DWG) ]`**, **`[ 💾 Uložit projekt do PC (.eldock) ]`** a hlavní CTA tlačítko **`[ ⚡ Vygenerovat rozváděč z tohoto půdorysu ]`**.

3. MOŽNOST PRŮVODCE TRVALE VYPNOUT PRO ZKUŠENÉ ("PROFI KOMPAKTNÍ REŽIM"):
- Přímo do pravé části horní lišty půdorysu přidej přepínač režimu zobrazení:
  * **`[ 🧭 Průvodce (Krok 1–5) ]`** vs. **`[ ⚡ Kompaktní lišta (Bez průvodce) ]`** (s automatickým trvalým uložením volby do `localStorage` pod klíčem `eldock-floorplan-ui-mode` i do profilu uživatele, takže zkušenému projektantovi zůstane průvodce trvale vypnutý i při příštím otevření).
- **KRITICKÉ PRAVIDLO PRO KOMPAKTNÍ REŽIM (BEZ PRŮVODCE):**
  * Když uživatel průvodce vypne, NIKDY mu nezobrazuj zpět těch 8 obřích rozbalených pruhů pod sebou!
  * V kompaktním režimu zobraz nad plátnem **jedinou štíhlou profesionální CAD lištu**, kde jsou:
    1) Primární nástroje plátna: `Výběr`, `+ Místnost (X×Y / Myší / Šikmá)`, `Měřítko`, `Podlaží (1. NP ▾)`.
    2) Čtyři čistá rozbalovací menu (Popover / Modal na kliknutí):
       - **`[ 🎨 Design: ABB Levit M ▾ ]`** (po kliknutí otevře výběr výrobce, řady, barvy a Smart Home katalogu),
       - **`[ 🔌 Trasy & Výšky ▾ ]`** (po kliknutí otevře nastavení Spodem/Vrchem, Po stěnách, výšky v mm a typ instalace),
       - **`[ 📁 Podklad & Uložení ▾ ]`** (Nahrát PDF/DXF, vrstvy CAD, Moje půdorysy v cloudu, Uložit/Nahrát `.eldock`, Verze),
       - **`[ 📤 Export & Rozváděč ▾ ]`** (PDF A3/A4, DXF, Kusovník BOM, Vygenerovat rozváděč).
  * Také úvodní šedý dvouřádkový popis pod nadpisem `2D půdorys & kabeláž` nahraď malou ikonkou `(?)` s nápovědou na najetí, aby nadpis a projektová lišta tvořily jeden kompaktní řádek!

4. TESTY A VERIFIKACE:
- Napiš unit a E2E testy ověřující:
  1) Vytvoření místnosti přesným zadáním rozměrů `X × Y` (např. `5.5 × 4.0 m`), její vložení na plátno a magnetické přichytnutí ke stěně druhé místnosti.
  2) Přepínání mezi kroky 1 až 5 v režimu Průvodce a trvalé přepnutí do Kompaktního režimu (bez průvodce) přes `localStorage`.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou změny pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

| Bod | Rozhodnutí |
|---|---|
| 1 | Předvolby názvů předvyplní typický rozměr místnosti (jde přepsat). Pole přijímají tečku i čárku, jednotku m / mm přepíná přepínač. Nová místnost jde na první volné místo plochy s odstupem 0,5 m od ostatních (nevejde-li se, vpravo vedle nákresu a plocha se rozšíří), je hned vybraná a přesouvá se tažením za plochu. Přichytávání 150 mm ke stěnám a rohům sousedních místností: modrá vodicí čára = stěna ke stěně, žlutá = zarovnání. Alt při tažení přichytávání vypne. Šířka X / Hloubka Y jdou přepsat v detailu místnosti, dvojklik na místnost (kótu) skočí do pole Šířka X. |
| 2 | Lišty nad plátnem nahradil průvodce v 5 krocích. V každém kroku je jen jeho kontextová lišta, nápověda a tlačítko na další krok. Přepínač podlaží je kvůli osazování vidět ve všech krocích, správa podlaží je v kroku 1. Výběr designu se po kroku 2 schová do odznaku „🎨 řada · barva“, který vrací na krok 2. Výchozí krok po otevření: prázdný nákres 1, místnosti nebo podklad bez prvků 2, s prvky 3. |
| 3 | Režim „🧭 Průvodce / ⚡ Kompaktní lišta“ se ukládá do prohlížeče (`eldock-floorplan-ui-mode`) i do profilu firmy (knihovna 2D půdorysu `floorplanLibraryJson`, vyhrává novější). Kompaktní lišta je jeden řádek: Výběr, + Místnost (X×Y / myší / šikmá), Měřítko, Podlaží a 4 rozbalovací menu Design, Trasy & výšky, Podklad & uložení, Export & rozváděč. Dvouřádkový popis pod nadpisem nahradila ikona (?) s nápovědou na najetí. Nadpis je v jednom řádku s projektovou lištou. |
