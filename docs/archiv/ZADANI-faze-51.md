# Zadání fáze 51 (vloženo 2026-11-05 místo obsahu docs/PLAN.md)

Na základě testování Katalogu prvků, zakládání projektu a 2D půdorysu elektroinstalace provedeme 4 zásadní vylepšení (Fáze 51). Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj:

1. OFICIÁLNÍ LOGA VÝROBCŮ ZE SLOŽKY `public/brands/` A VYČIŠTĚNÍ KATALOGU:
- Vytvoř složku `public/brands/` pro oficiální loga výrobců (`abb.svg`, `noark.svg`, `oez.svg`, `schneider.svg`, `eaton.svg`, `legrand.svg`, `eti.svg`, `hakel.svg`, `hager.svg`, `bonega.svg`, `siemens.svg`, `schrack.svg`, `loxone.svg`, `rittal.svg`, `hensel.svg`, `saltek.svg`, `sez.svg`, `wago.svg`).
- Napiš skript `scripts/fetch-brand-logos.ts`, který stáhne oficiální vektorová SVG loga těchto značek (z Wikimedia Commons / SimpleIcons / oficiálních CDN) do `public/brands/`, a tam, kde veřejné SVG není dostupné, vygeneruje věrné vektorové logo přesně podle oficiálního manuálu značky (žádné amatérské nápisy v bílém obdélníku).
- Komponentu `ManufacturerLogo.tsx` uprav tak, aby primárně načítala soubor z `/brands/<slug>.svg` (nebo `.png`/`.webp`, pokud tam uživatel nahraje vlastní soubor). Když uživatel do `public/brands/` vloží vlastní logo, okamžitě se propíše do celé aplikace.
- Z hlavního rozcestníku výrobců v Katalogu (`/panel-builder/catalog`) a v Konfigurátoru skryj okrajové 1položkové značky `ORNO`, `POLLOCK`, `LOVATO` a výrobce samotných ventilátorů `PFANNENBERG` a `STEGO` přesuň výhradně do výběru ventilátorů v Kroku 3 (Oteplení).

2. PŘEHLEDNÝ MODAL "NOVÝ PROJEKT ROZVÁDĚČE" + VÍCE FOTEK A ANALÝZA VIDEA (MP4/MOV):
Přepracuj nepřehledný modal `NewProjectDialog.tsx`:
- Odstraň hranaté závorky `[ ... ]` z tlačítek a místo 4 řádků pod sebou zobraz nahoře přehlednou mřížku **2×2 velkých karet (dlaždic) s ikonou, tučným nadpisem a stručným popisem**:
  1) **📐 Navrhnout od nuly (CAD)** – Čisté 2D vektorové plátno s DIN lištami.
  2) **📷 Pasport z fotek nebo 🎥 videa (AI Vision)** – Rozpoznání přístrojů z 1 až N fotek nebo z videa.
  3) **🏠 Ze soupisu místností (ČSN 33 2130)** – Rychlá tabulka místností, zásuvek a spotřebičů.
  4) **🗺️ 2D půdorys & kabeláž** – Vizuální kreslení půdorysu a výpočet kabelů (kliknutí rovnou otevře `/panel-builder/floorplan`).
- PODPORA VÍCE FOTEK A VIDEA V REŽIMU "PASPORT Z FOTEK NEBO VIDEA":
  * Umožni uživateli nahrát buď **více fotek najednou** (`<input type="file" accept="image/*" multiple>`: 1. hlavní celková fotka + libovolný počet detailních fotek jednotlivých DIN lišt/sekcí), NEBO **video rozváděče** (`<input type="file" accept="video/mp4,video/quicktime,video/webm">`).
  * Pokud uživatel nahraje **video** (např. 5–15s průjezd mobilem přes rozváděč):
    - Přímo na klientu v prohlížeči (`src/lib/video-frames.ts` přes `<video>` a `<canvas>`) automaticky vyextrahuj **6 rovnoměrně rozložených ostrých snímků (keyframes)** ve vysokém rozlišení (1920 px JPEG 0,92).
    - Zobraz uživateli náhledy vytažených snímků z videa (může označit, který je celkový pohled a které jsou detaily lišt, případně snímek přidat tlačítkem `"📸 Zachytit aktuální snímek z videa"`).
    - Při založení projektu ulož hlavní fotku + detailní snímky do `railPhotosJson` a pošli je do `geminiPanelService` ke kombinované analýze (celková topologie + ostré přečtení hodnot B10/B16/DS301C/EN25 z detailních snímků)!

3. 2D PŮDORYS (`/panel-builder/floorplan`): KASKÁDA VÝROBCE (S LOGEM) -> DESIGNOVÁ ŘADA -> BARVA + KOMPLETNÍ VYPÍNAČE:
- Odstraň malý select "Designová řada (výchozí)" ze spodku levého panelu a přesuň výběr domovních přístrojů **úplně NAHORU** (do horní lišty / horní karty levého panelu) jako živou 3stupňovou kaskádu:
  * **1. Výrobce (s oficiálním logem):** Klikací karty `[ ABB ]` · `[ Schneider Electric ]` · `[ Legrand ]` · `[ Hager ]`.
  * **2. Designová řada vybraného výrobce:**
    - Pro **ABB**: `Tango`, `Levit`, `Zoni`, `Time`, `Element`, `Swing / Swing L`, `Future Linear`, `Busch-axcent`, `Decento`, `Solo`, `Basic55`, `Garant (IP44)`.
    - Pro **Schneider Electric**: `Nová Unica`, `Sedna Design & Elements`, `Asfora`, `Mureva Styl (IP55)`.
    - Pro **Legrand**: `Valena Life`, `Valena Allure`, `Céliane`, `Niloé`, `Mosaic`, `Plexo (IP55)`.
    - Pro **Hager**: `lumina`, `berker S.1 / B.3 / Q.1 / Q.3`.
  * **3. Barva přístrojů (s barevnými kroužky):**
    - `⚪ Bílá / Alpská bílá`, `🟡 Slonová kost / Béžová`, `⚫ Černá matná / Antracit`, `🔘 Šedá / Metalická`, `🥈 Hliník / Inox`, `🟤 Dřevo / Písková`.
  * Změna výrobce, řady nebo barvy platí pro nově vkládané prvky a nabízí tlačítko `[ 🔄 Použít na celý půdorys ]` nebo `[ Použít na vybranou místnost ]`, takže ji lze plynule měnit kdykoliv během projektování! V kusovníku a soupisu domovní instalace se vypisuje přesný výrobce, řada i zvolená barva.
- ROZŠÍŘENÍ PALETY "💡 SVĚTLA A VYPÍNAČE" O VŠECHNY BĚŽNÉ TYPY:
  Do levého panelu v sekci `Světla a vypínače` doplň kompletní sadu spínačů a ovladačů:
  * `S1` Vypínač č. 1 (jednopólový)
  * `S5` Sériový přepínač č. 5 (lustrový – 2 klapky)
  * `S6` Střídavý přepínač č. 6 (schodový)
  * `S6+6` **Dvojitý střídavý přepínač č. 6+6 (řazení 5B – 2 klapky)**
  * `S7` Křížový přepínač č. 7
  * `T1` Tlačítko č. 1/0 (impulzní / zvonkové)
  * `T2` **Dvojtlačítko č. 1/0+1/0 (2 klapky)**
  * `ZAL` **Žaluziový spínač / tlačítko (nahoru / dolů)**
  * `STM` **Stmívač (otočný / tlačítkový LED)**
  * `PIR` **Pohybové čidlo (PIR nástěnné / stropní)**
  * `S1S` **Vypínač s orientační doutnavkou / LED (řazení 1S / 6S)**
  * `S44` **Vypínač IP44 (do vlhka / venkovní)**
  * `TER` **Pokojový termostat**
  Aktualizuj také výpočet kabeláže: k `S6+6` počítej dvoužilové korespondenční propojení pro obě větve, k `ZAL` kabel `CYKY-J 5×1,5` k pohonu žaluzie a k `TER` kabel k topnému okruhu.

4. 2D PŮDORYS: ŽIVÉ ROZMĚRY X × Y PŘI KRESLENÍ, POSOUVÁNÍ, AKTIVNÍ ROH A MAZÁNÍ MÍSTNOSTÍ:
Oprav práci s místnostmi na plátně `/panel-builder/floorplan`:
- **Živé kóty během kreslení místnosti:** Když uživatel v režimu `Kreslit místnost` táhne myší žlutý čárkovaný obdélník, zobrazuj v reálném čase přímo u horní hrany štítek `X: {šířka} m`, u pravé hrany `Y: {hloubka} m` a uprostřed obdélníku `{šířka} × {hloubka} m ({plocha} m²)`.
- **Výběr a posouvání nakreslené místnosti:** V režimu `Výběr` (nebo kliknutím na místnost) se místnost zvýrazní žlutým rámečkem. Tažením za vnitřek místnosti lze celou místnost plynule **posouvat myší** (přičemž všechny zásuvky, vypínače a světla umístěné uvnitř této místnosti se posouvají společně s ní!).
- **Aktivní roh a stěny pro změnu velikosti:** Vybraná místnost musí mít v pravém dolním rohu výrazný žlutý **aktivní úchyt (handle)** a interaktivní všechny 4 stěny (kurzory `nwse-resize`, `ew-resize`, `ns-resize`). Tažením za roh nebo stěnu uživatel plynule mění rozměr X a Y se živými kótami.
- **Úprava a smazání místnosti:** Když je místnost vybraná, zobraz v pravém panelu (a v plovoucí liště nad místností) editovatelné pole **Název místnosti** (s rychlými štítky: `Obývací pokoj`, `Kuchyně`, `Ložnice`, `Dětský pokoj`, `Koupelna`, `WC`, `Chodba`, `Technická místnost`, `Garáž`), číselná pole `Šířka X [m]` a `Hloubka Y [m]` a červené tlačítko **`[ 🗑️ Smazat místnost ]`** (funguje i klávesa `Delete` / `Backspace`).

Po implementaci spusť `npm run verify`, aktualizuj unit i E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.

