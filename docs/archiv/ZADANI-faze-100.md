# Zadání fáze 100 – vizuální, UX a výkonnostní audit 2D půdorysu (podklad, paleta, 4 záložky, 60 FPS)

Vloženo z chatu 2026-11-12 (po nasazení fáze 99, před prezentací projektu). Celé zadání beze změn je níže, za ním
rozhodnutí při implementaci.

## Zadání (z chatu)

Provedli jsme vizuální, UX a výkonnostní audit živého webu `https://eldock.cz`. Před dnešní prezentací potřebujeme dotáhnout vizuální čistotu rozhraní, čitelnost výkresů a rychlost vykreslování na úroveň špičkového B2B CAD systému.

Zapiš tuto úlohu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 6 bodech:

================================================================================
1. KONTRAST A ČITELNOST VÝKRESU NAD BÍLÝM PDF PODKLADEM (`/panel-builder/floorplan`)
================================================================================

Problém: Když uživatel nahraje bílý stavební půdorys (PDF/obrázek), černé čáry stavaře, kóty a naše popisky kabelů splývají a zhoršují čitelnost.
- Přidej do horní lišty plátna rychlý posuvník / přepínač **`🌗 Podklad: [ 100% | 60% (Doporučeno) | 35% | Invertovat do tmavého CADu ]`**:
  * Ve výchozím stavu po nahrání PDF nastav podklad na **60% krytí s jemným potlačením kontrastu**, aby nad ním barevné okruhy, červené/modré trasy a značky zásuvek/světel dokonale vynikly!
  * Volba `Invertovat do tmavého CADu` aplikuje na bílý stavební výkres CSS filtr `invert(0.92) hue-rotate(180deg) contrast(0.85)`, čímž z bílého PDF výkresu udělá luxusní tmavý architektonický podklad ladící s tmavým rozhraním ELDOCKu!
- Pod každý textový popisek trasy kabelu (např. `Okr. -F1 · CYKY-J 3×2,5`) a pod každou značku přístroje přidej v SVG čitelný podkladový štítek (`paint-order: stroke; stroke: rgba(15,23,42,0.88); stroke-width: 4px; stroke-linejoin: round;` nebo podkladový `<rect rx="3">`), aby text nikdy nesplýval s čárou stěny pod ním!

================================================================================
2. VYČIŠTĚNÍ LEVÉ PALETY PRVKŮ (KONEC OŘÍZNUTÝCH TEXTŮ A DLOUHÝCH SEZNAMŮ)
================================================================================

V `/panel-builder/floorplan` uprav levou paletu (`PALETA`):
- Zkrať a zpřehledni názvy kategorií tak, aby se NIKDY neořezávaly třemi tečkami (`...`):
  * `⚡ Rozváděče`
  * `🔌 Zásuvky`
  * `💡 Světla`
  * `🔘 Vypínače 230 V`
  * `🎛️ Sběrnicové ovládání`
  * `🪟 Stínění, čidla a topení`
  * `🔥 Samostatné spotřebiče`
  * `🛁 Koupelna (zóny ČSN)`
  * `🛋️ Okna, dveře a nábytek`
- Uvnitř rozbalené kategorie (zejména u `Okna, dveře a nábytek`, `Zásuvky` a `Světla`) nahraď dlouhé svislé textové nudle **kompaktní 2sloupcovou mřížkou dlaždic (`grid-cols-2 gap-1.5`)**, kde každá dlaždice ukazuje **čistou vektorovou CAD značku prvku**, srozumitelný název a rozměr/zkratku.

================================================================================
3. PŘESTAVBA PRAVÉHO PANELU DO 4 ČISTÝCH ZÁLOŽEK + MODERNÍ TENKÉ POSUVNÍKY
================================================================================

Problém: V pravém sloupci je pod sebou naskládaných až 10 panelů a uvnitř `Soupis okruhů` a `Výkaz kabeláže` svítí tlusté šedé systémové posuvníky.
- V pravém panelu zaveď nahoře **4 přehledné přepínací záložky (s odznakem počtu položek / varování)**, které se automaticky přepínají podle aktuální Fáze 1–5 (ale uživatel si je může kdykoliv překliknout ručně):
  * **`[ 🎯 Detail ]`** (Detail vybraného prvku/místnosti, rozměry X×Y, hloubka krabičky KOPOS, párování vypínače se světlem, Smart Home aktor)
  * **`[ 🔌 Okruhy & Trasy ]`** (Soupis okruhů s ikonou oka `👁️`, Zásuvkové okruhy, Výkaz kabeláže dle ČSN 33 2130 ed. 4)
  * **`[ 🛡️ Normy (Linter) ]`** (Kontrola půdorysu a norem s červeným/zeleným odznakem počtu nálezů + Tahák zakázky)
  * **`[ ⚡ Kusovník & Rozváděč ]`** (Karta `Založit / Vygenerovat rozváděč z půdorysu`, Kompletní kusovník BOM a doporučené krabičky KOPOS)
- V globálním CSS (`globals.css`) nahraď ošklivé tlusté šedé posuvníky čistými, tenkými dark-mode posuvníky (`scrollbar-width: thin; scrollbar-color: #3f3f46 transparent;` a `::-webkit-scrollbar { width: 6px; height: 6px; }`).

================================================================================
4. VYLEPŠENÍ VZHLEDU KARET VÝROBCŮ A MODALU DESIGNOVÝCH ŘAD
================================================================================

- **Tlačítka výrobců (`ABB`, `Schneider`, `Legrand`, `Hager`, `Loxone`, `TapHome`):**
  * Odstraň ostré bílé obdélníky nalepené natvrdo v tmavé liště. Obal loga do sjednocených, elegantních karet s jemným rámečkem, zaoblením `rounded-lg` a u aktivního výrobce žlutým akcentním rámečkem `ring-2 ring-amber-400 shadow-lg shadow-amber-500/10`.
- **Náhledové karty v `Designové řady a barvy` (`Spínač 1R`, `Zásuvka 1R`, `Vícerámeček`):**
  * Místo oslňující čistě bílé plochy `#ffffff` použij jemné studiové pozadí `bg-gradient-to-b from-slate-100 to-slate-200/90` s jemným vnitřním rámečkem a stínem pod přístrojem (`drop-shadow-md`), aby bílé přístroje (Zoni, Levit, Decento, Garant) měly jasně viditelné kontury a 3D hloubku!

================================================================================
5. VÝKONNOSTNÍ OPTIMALIZACE 2D PLÁTNA (60 FPS) A RYCHLOSTI NAČÍTÁNÍ WEBU
================================================================================

1. **Memoizace vrstev 2D půdorysu (`React.memo` / `useMemo`):**
   - Odděl v SVG plátnu vykreslování statického podkladu/místností a neaktivních kabelových tras od vrstvy aktivně taženého prvku/kurzoru, aby při pohybu myší (`onMouseMove`) nedocházelo k přepočítávání celého kusovníku a všech okruhů v každém snímku (použij `requestAnimationFrame` / throttling pro plynulých 60 FPS i u velkých půdorysů).
2. **Optimalizace obrázků a modalu:**
   - U všech katalogových obrázků v `public/catalog-images/` nastav `loading="lazy"` a `decoding="async"`.
   - V `next.config` zkontroluj zapnutou kompresi a cache hlavičky pro `/catalog-images/**` (`Cache-Control: public, max-age=31536000, immutable`).

================================================================================
6. VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

- Spusť `npm run verify` (a `npm run verify:demo`, pokud existuje), zkontroluj, že všechny testy procházejí bez chyb, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.


## Rozhodnutí při implementaci

**1. Podklad nad bílým výkresem (`src/lib/panel-builder/background-look.ts`, `BackgroundLookSwitch.tsx`):**

- Přepínač „🌗 Podklad: 100 % | 60 % (Doporučeno) | 35 % | 🌑 Tmavý CAD“ je v horní liště plátna – proužek s pevnou
  výškou nahoře v rámečku plátna vedle podlaží (jen s nahraným podkladem PDF / obrázek), výkres začíná pod ním. Přes
  výkres zakrýval jeho horní okraj (první klik kalibrace na roh stěny padl na přepínač) a v liště probíhajícího kroku
  měnil zalomení nápovědy (plátno se mezi dvěma kliky kalibrace přeskládalo). Vzhled se ukládá s podkladem podlaží
  (`FloorplanBackground.look` v JSON nákresu – bez migrace); po nahrání 60 %, u starších půdorysů bez údaje také 60 %.
- 60 % a 35 % = krytí obrázku nad bílou plochou s jemně potlačeným kontrastem `contrast(0.85)` (čára stavaře 60 % →
  šedá #717171), 100 % = originál bez filtru. Tmavý CAD = filtr `invert(0.92) hue-rotate(180deg) contrast(0.85)`, plocha
  pod výkresem tmavě šedá #242424 (= bílá po filtru) a kresba nad ním světlá jako na čistém rastru.
- Filtr kreslí SVG `<filter>` se stejnými primitivy, jak CSS funkce definuje Filter Effects Level 1 (invert = tabulka
  [a, 1 − a], hue-rotate = feColorMatrix, contrast = lineární přenos), v prostoru sRGB – CSS filtr na prvku uvnitř SVG
  (`<image>`) prohlížeče dlouho neuměly; CSS zápis je u obrázku v `data-filter`.
- Podkladový štítek popisků: štítky tras („Okr. -F1 · CYKY-J 3×2,5“) i délky tras světlým písmem s tmavým obrysem
  `paint-order: stroke`, `stroke: rgba(15,23,42,0.88)`, ≈ 4 px (`stroke-linejoin: round`); u značek přístrojů silnější
  obrys v barvě podkladu (zakryje čáru stěny pod značkou, vnitřek kroužku svítidla vyplní) a popisek značky (IP44, řazení)
  stejně jako štítky tras. Popisky místností s obrysem v barvě podkladu. Tiskový výkres štítky nemá (tisk na bílý papír).

**2. Levá paleta (`PALETTE_GROUPS`, `CONTROLS_LABEL`, `PaletteAccordion`, `PaletteGlyph.tsx`):**

- Názvy kategorií podle zadání; „🔘 Vypínače 230 V“ a „🎛️ Sběrnicové ovládání“ jsou tatáž skupina ovládání podle úrovně
  instalace (klasika / sběrnice; retrofit „📲 Chytré vypínače“). Názvy se nikdy neořezávají – v úzké paletě se zalomí,
  počet osazených je vpravo; 🏥 Zdravotnictví (Skupina 1) zůstává (jen režim zdravotnictví).
- Všechny kategorie (nejen okna / dveře / nábytek, zásuvky a světla) mají mřížku 2 sloupců dlaždic `grid-cols-2 gap-1.5`:
  vektorová CAD značka (stejné cesty jako plátno, tisk a DXF – `symbolParts`, u oken / dveří / nábytku `archDrawing`,
  u koupelnových předmětů vana / sprcha / umyvadlo), celý název (přístupné jméno tlačítka beze změny) a rozměr X × Y
  v metrech nebo zkratka s montážní výškou (spotřebiče zkratka a příkon). ⭐ oblíbené a technický list v rozích dlaždice.

**3. Pravý panel ve 4 záložkách (`RIGHT_TABS`, `PHASE_TAB`, `tabSectionVisible`, `RightTabBar`):**

- 🎯 Detail (místnosti fáze 1, přívod a typ prostoru fáze 2, systém a design fáze 4, detail výběru, hladiny CAD, chytrá
  domácnost – akční členy), 🔌 Okruhy & Trasy (soupis okruhů s okem, zásuvkové okruhy, výkaz kabeláže dle ČSN 33 2130
  ed. 4, ručně upravené trasy), 🛡️ Normy (Linter) (celá kontrola půdorysu a norem, bez nálezů zelený stav, + tahák
  zakázky), ⚡ Kusovník & Rozváděč (velké tlačítko fáze 5, karta Založit rozváděč, kusovník BOM s krabicemi KOPOS,
  soupis domovní instalace). `CablePanel` má části zvlášť (`part="report" | "generate"`).
- Výchozí záložka podle fáze: 1, 2, 4 Detail, 3 Okruhy & Trasy, 5 Kusovník & Rozváděč (kompaktní lišta „Zobrazit vše“
  Detail). Ručně se dá přepnout kdykoli (i šipkami ← →); ruční volba platí do dalšího přepnutí fáze. Vlastnosti sledují
  výběr: klik na prvek, místnost nebo poznámku na plátně a „Zobrazit“ u nálezu kontroly otevřou Detail, vložení nového
  prvku ho otevře jen ve výchozí záložce fáze (ručně zvolená záložka, třeba Normy s tahákem, zůstane). Přechody
  z taháku zakázky (bod fáze, „Vybrat rozváděč“, „Ukázat kde“) nechají záložku Normy otevřenou, aby šlo pokračovat
  dalším bodem; kusovník a generování rozváděče z lišt přepnou na Kusovník & Rozváděč, štítek „Víceramček mimo katalog
  řady“ na Normy. Dvojklik na úsek trasy (odskok) už nevybírá místnost pod ní.
- Odznaky: Detail = počet vybraných, Okruhy = počet okruhů, Normy = počet chyb a varování červeně / zeleně ✓, Kusovník =
  počet položek. Výřez „Varování zón a zásuvek“ fází 3 a 4 nahradila celá kontrola v záložce Normy (odznak je vidět stále).
- Posuvníky: Firefox `scrollbar-width: thin` + `scrollbar-color: #3f3f46 transparent`, Chromium a Safari
  `::-webkit-scrollbar` 6 px (Chromium od verze 121 vlastní posuvník ignoruje, má-li prvek `scrollbar-width`, proto
  standardní vlastnosti jen v prohlížečích bez `::-webkit-scrollbar`).

**4. Karty výrobců a galerie řad (`brandCardClass`, `ManufacturerLogo bare`, `SeriesPreviewIllustration`):**

- Tlačítka výrobců (ABB, Schneider, Legrand, Hager v kartě designu i v galerii; Loxone a TapHome) jsou jednotné karty
  `rounded-lg` s jemným světlým studiem a rámečkem (logo bez vlastní bílé podložky), aktivní `ring-2 ring-amber-400
  shadow-lg shadow-amber-500/10` (i Loxone / TapHome místo zelené).
- Náhledy Spínač 1R / Zásuvka 1R / Víceramček na studiu `bg-gradient-to-b from-slate-100 to-slate-200/90` s vnitřním
  rámečkem; vektorový render bez vlastního pozadí (`renderDeviceSvg({ studio: false })`) se stínem `drop-shadow-md`,
  fotka výrobce (bílé pozadí JPEG) se do studia vpije `mix-blend-multiply` (stín pod fotkou s neprůhledným pozadím by
  kreslil obdélník).

**5. Výkon (`PlanLayers.tsx`, `frame-throttle.ts`, `next.config.ts`):**

- Statický podklad (rastr, obrázek / PDF, DXF), místnosti, zakreslené změny, trasy a každý prvek jsou memoizované
  komponenty; obsluha událostí přes stabilní `PlanHandlers` (editor do nich po každém vykreslení předá aktuální funkce).
  Kusovník, okruhy a normy se počítají z odloženého nákresu (`useDeferredValue`, fáze 63) – při pohybu myši se
  nepřepočítávají. Pohyb myši se zpracuje nejvýš jednou za snímek (requestAnimationFrame, platí poslední poloha), při
  puštění tlačítka se čekající poloha zpracuje hned (`flushSync`) a konec tažení vyhodnotí obsluha s čerstvým stavem.
  Ověřeno počtem překreslení vrstev v E2E (`window.__eldockLayerRenders`, jen když ho test zapne).
- `FallbackImg` má výchozí `loading="lazy"` a `decoding="async"` (všechny fotky katalogu). `next.config.ts`: `compress:
  true` (na produkci komprimuje i Caddy) a `Cache-Control: public, max-age=31536000, immutable` pro
  `/catalog-images/:path*` (dřív `max-age=0` s revalidací) – opravenou fotku je proto nutné uložit pod novým názvem
  souboru (`public/catalog-images/README.md`). Fotky nahrané ve velínu mají vlastní adresu s `?v=`.

**6. Kontrola:** `src/lib/phase100.test.ts`, E2E `e2e/phase100.spec.ts` (je i v `npm run verify:demo`, produkční
kontrola hlídá hlavičku mezipaměti fotek); starší sady E2E přepínají záložky pomocníkem `rightTab` z
`e2e/floorplan-phases.ts`.
