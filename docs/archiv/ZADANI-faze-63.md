# Zadání fáze 63 (2026-11-07, z chatu)

V zadání je etapa označená jako „Fáze 55“. Číslo 55 je obsazené (nasazená fáze 2026-11-05), proto se zadání
zapisuje a realizuje jako **fáze 63**.

Zadání uživatele (doslovně):

> Na základě testování 2D půdorysu (`/panel-builder/floorplan`) provedeme 7 klíčových vylepšení (Fáze 55): sbalovací
> levé menu, umyvadlo a aktivní změna rozměrů X×Y u zařizovacích předmětů, editovatelné samostatné spotřebiče,
> rozšíření chytré domácnosti (ABB-free@home, KNX, Loxone, TapHome) v horní liště, realistické katalogové vizualizace
> řad s přímým odkazem na web výrobce, interaktivní posouvání kabelových tras v osách X/Y + podpora šikmých stěn
> (45° / polygon) a export výkresu s normovým značením kabelů do PDF a DXF/DWG.
>
> Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:
>
> 1. SBALOVACÍ KATEGORIE V LEVÉM MENU PŮDORYSU (ACCORDION):
> - V levém panelu `/panel-builder/floorplan` zabal každou kategorii (`⚡ Rozváděč`, `🔌 Zásuvky`, `💡 Světla a vypínače`,
>   `🎛️ Sběrnicové ovládání 24 V DC / Smart Home`, `🔥 Samostatné spotřebiče`, `🛁 Zařizovací předměty`) do
>   rozbalovacího akordeonu:
>   * Kliknutím na záhlaví kategorie se sekce sbalí nebo rozbalí (zobrazuj u ní šipku `▾ / ▸` a počet osazených prvků
>     této kategorie v půdorysu).
>   * Přidej úplně nahoru do levého panelu rychlý přepínač `[ Sbalit vše ]` / `[ Rozbalit vše ]` a režim *"Rozbalit vždy
>     jen jednu kategorii"*, aby menu zůstalo maximálně přehledné.
>
> 2. UMYVADLO, DVOJUMYVADLO A AKTIVNÍ ÚPRAVA ROZMĚRŮ X × Y U ZAŘIZOVACÍCH PŘEDMĚTŮ (ČSN 33 2000-7-701 a ČSN 33 2130 ed. 4):
> - Do kategorie `🛁 Zařizovací předměty` přidej:
>   * **`UMY` Umyvadlo (`600 × 450 mm`)** a **`DUM` Dvojumyvadlo (`1200 × 450 mm`)** – kolem umyvadla vykresluj v půdorysu
>     ochranný umyvadlový prostor (svislý pás nad a pod umyvadlem dle ČSN 33 2130 ed. 4) a kontroluj v linteru dodržení
>     vzdálenosti zásuvek a spínačů od hrany umyvadla / vany / sprchy!
> - **Aktivní roh a živé rozměry X × Y pro Vanu, Sprchový kout i Umyvadlo:**
>   * Každý zařizovací předmět (`Vana`, `Sprchový kout`, `Umyvadlo`, `Dvojumyvadlo`) vykresli na půdorysu jako
>     architektonický 2D symbol v reálných rozměrech `widthM × depthM`.
>   * Po kliknutí na zařizovací předmět zobraz **aktivní žlutý roh (handle)** a posuvné stěny, kterými může uživatel myší
>     plynule měnit jeho šířku X a hloubku Y (se živými kótami přímo u předmětu: `X: 1,70 m × Y: 0,75 m`), předmět otáčet
>     o 90°/45° nebo zadat přesný rozměr v mm v bočním panelu. Ochranné zóny 0, 1, 2 (60 cm) a umyvadlový prostor se
>     okamžitě přepočítají podle nového rozměru!
>
> 3. EDITOVATELNÉ SAMOSTATNÉ SPOTŘEBIČE (`🔥 Samostatné spotřebiče`):
> - V sekci `🔥 Samostatné spotřebiče (vlastní jisticí okruh)` přidej do záhlaví tlačítko `[ ✎ Upravit / + Přidat ]`.
> - Umožni uživateli:
>   * Přejmenovat kterýkoliv stávající spotřebič (např. změnit `"Trouba"` na `"Pečicí a parní trouba"`, `"Tepelné
>     čerpadlo"` na `"Venkovní jednotka TČ"`), změnit jeho 2–3písmennou zkratku na značce, výchozí příkon [W], jistič
>     (`1P/3P`, `B10/B16/B20/B25`), typ chrániče (`A / F / B / RCBO`), kabel (`3×2,5` / `5×2,5` / `5×4`) a výchozí
>     montážní výšku [mm].
>   * Přidat vlastní spotřebič tlačítkem `[ + Přidat vlastní spotřebič ]` (s rychlými šablonami: `Klimatizace`,
>     `Rekuperace VZT`, `Saunová kamna 3f`, `Bazénová technologie`, `Čerpadlo studny / ČOV`, `Brána / Garážová vrata`)
>     a uložit úpravy do `localStorage` + profilu firmy `RegisteredCompany`.
>
> 4. CHYTRÁ DOMÁCNOST V HORNÍ LIŠTĚ VÝROBCŮ (ABB-free@home®, KNX, Loxone, TapHome) A KOMPLETNÍ PRVKY:
> - Rozšiř horní lištu výběru výrobců a systémů nad půdorysem:
>   * U výrobce **ABB** přidej přepínač produktových rodin:
>     1) **`🎨 Domovní spínače a zásuvky (15 řad)`**
>     2) **`🏠 ABB-free@home® (Sběrnice 24 V DC & Wireless)`** – po kliknutí zobraz podkategorie:
>        - *Senzory a tlačítka v designu řad (Zoni, Tango, Levit, Time, future linear)*: 1násobné, 2násobné, 4násobné
>          tlačítko, žaluziový senzor, prostorový termostat s displejem.
>        - *Bezdrátové prvky free@home® WL & Smart Switch*: Akční člen do krabičky (1kanál, 2kanál, žaluziový, stmívací),
>          bezbateriový Smart Switch.
>        - *Centrální panely a komunikace*: Dotykový panel **ABB OneTouch 7"**, System Access Point SysAP 2.0, videotelefon
>          ABB-Welcome Midi.
>        - *Akční členy na DIN lištu*: Spínací aktory 4/8/12kanálové (`SA-M`), žaluziové aktory (`JA-M`), stmívací aktory,
>          topné aktory (`HA-M`), zdroj sběrnice `PS-M-64.1.1`.
>     3) **`🏢 ABB i-bus® KNX & ABB-flexTronics®`** – KNX tlačítkové snímače, detektory přítomnosti Busch-Watchdog 180
>        Basic/Multi/Sky/Corridor, DALI regulátory.
>   * Do horní lišty výrobců přidej vedle `ABB`, `Schneider Electric`, `Legrand` a `Hager` také výrobce chytré automatizace
>     s jejich logy:
>     - **`Loxone`** (řady: *Touch Pure*, *Touch Pure Flex*, *Touch классик*, *Touch Nightlight*, *Stropní senzor
>       přítomnosti*, *Miniserver / Tree / Air*) – ve barvách *Bílá* a *Antracit*.
>     - **`TapHome`** (řady: *TapHome 2T / 4T / 6T tlačítka*, *UI Termostat*, *Core jednotka*).
>
> 5. VĚRNÉ VIZUALIZACE DESIGNOVÝCH ŘAD A PŘÍMÝ PROKLIK NA WEB VÝROBCE (`nizke-napeti.cz.abb.com`):
> - Přepracuj vykreslování náhledů v modalu `Designové řady a barvy` (a v horní liště), aby 2D SVG rendery Spínače 1R,
>   Zásuvky 1R a Vícerámečku 3R věrně odpovídaly skutečnému tvaru, proporcím a materiálům jednotlivých řad:
>   * **ABB Levit / Levit M:** Ostrý čtvercový rámeček s charakteristickou barevnou spodní základnou prosvítající v horní
>     a spodní spáře (dvoubarevný vrstvený efekt `Onyx / kouřová černá`, `Žlutá / kouřová černá` atd.) a vodorovným
>     proužkem indikace.
>   * **ABB Zoni:** Moderní matný plochý rámeček s tenkým okrajem (16 mm profil), u dvoubarevných variant (`pudrová /
>     bílá`, `olivová / bílá`, `greige / bílá`, `matná černá / bílá`) barevný rámeček a čistě bílá středová
>     klapka/zásuvka!
>   * **ABB Tango:** Typický zaoblený (vypouklý) rámeček a zaoblená kolébka s vodorovným modrým/oranžovým průzorem
>     doutnavky.
>   * **ABB Time / Time Arbo:** Rovný rámeček s charakteristickou tenkou kovovou linkou kolem klapky; u *Time Arbo*
>     realistická kresba dřeva (javor, olše, třešeň, mahagon, wenge) na rámečku a metalická klapka (starostříbrná /
>     titanová / antracitová).
>   * **ABB Decento:** Kulatý retro porcelánový rámeček s otočnou nebo úzkou páčkou a kulatou zásuvkou.
>   * **Legrand Céliane:** Obdélníkový rámeček s typickým **kruhovým výřezem a kruhovou klapkou** uvnitř (nikoliv obyčejný
>     čtverec!).
>   * **Schneider Nová Unica / Sedna / Asfora:** Odpovídající tvar rámečku a kolébky v reálných odstínech.
> - **Tlačítko pro přechod na web výrobce:**
>   * Přímo do modalu `Designové řady a barvy` (vedle tlačítka *Použít*) i do horní lišty přidej tlačítko **`[ 🌐
>     Prohlédnout řadu na webu výrobce ↗ ]`**, které otevře v novém okně oficiální stránku právě vybrané řady a výrobce:
>     - Pro ABB: konkrétní URL na `https://nizke-napeti.cz.abb.com/` (např. stránku designových řad Zoni, Tango, Levit,
>       Time, Decento, Swing, Classic, ABB-free@home).
>     - Pro Schneider Electric, Legrand, Hager, Loxone a TapHome: jejich oficiální české katalogové stránky dané řady.
>
> 6. INTERAKTIVNÍ ÚPRAVA TRAS KABELŮ V OSÁCH X / Y + ŘEŠENÍ PRO ŠIKMÉ STĚNY (45° A OBECNÉ ÚHLY):
> Uprav směrování a editaci kabelových tras na plátně 2D půdorysu:
> a) **Interaktivní posouvání úseků kabelů myší striktně v ose X nebo Y:**
>    - Každá vykreslená trasa kabelu se skládá z rovných úseků mezi lomovými body (`waypoints`).
>    - Když uživatel najede myší na **vodorovný úsek kabelu**, zobraz zvýrazněný úchyt s kurzorem `ns-resize (↕)`.
>      Tažením myší se tento vodorovný úsek posouvá **výhradně nahoru a dolů v ose Y** (sousední svislé úseky se
>      automaticky natáhnou/zkrátí, úhel zůstává vždy 90°!).
>    - Když uživatel najede na **svislý úsek kabelu**, zobraz kurzor `ew-resize (↔)` a tažením ho posouvej **výhradně
>      doleva a doprava v ose X**.
>    - **Dvojklik na úsek kabelu** vloží do trasy nový ortogonální odskok (dvojici 90° lomových bodů), takže lze trasu
>      snadno vést kolem překážky. Kliknutím pravým tlačítkem (nebo tlačítkem v panelu) lze ručně posunutou trasu okruhu
>      vrátit na `"🔄 Resetovat trasu na automat"`.
> b) **Kreslení šikmých stěn / polygonálních místností a Lokální osa šikmé stěny (45° a obecné úhly):**
>    - Vedle nástroje `Kreslit místnost (Obdélník)` přidej nástroj **`📐 Kreslit šikmou stěnu / Polygonální místnost`**:
>      uživatel kliká jednotlivé rohy místnosti po obvodu podkladu PDF (s přichytáváním na **0°, 45°, 90°** nebo volný
>      úhel podle podkladu při podržení `Shift`).
>    - **Pravidlo kabelů u šikmých stěn:**
>      * Ve volném prostoru půdorysu vedou kabely VŽDY striktně v osách X a Y (0° / 90°).
>      * Pokud však prvek leží u šikmé stěny (pod úhlem $\alpha$, např. 45° nebo 15° podle stěny v PDF), úsek kabelu
>        přiléhající k této šikmé stěně se automaticky přichytí do **lokální osy této stěny** (vede **rovnoběžně se šikmou
>        stěnou** v odsazení např. 200 mm a do zásuvky/vypínače odbočuje **kolmo (90°) na šikmou stěnu**!).
>      * Při tažení takového úseku myší se úsek posouvá kolmo ke své šikmé stěně (zůstává s ní vždy rovnoběžný).
>
> 7. KLASICKÉ NORMOVÉ ZNAČENÍ KABELŮ A CAD EXPORT DO PDF A DWG/DXF:
> - Přidej nad půdorys přepínač zobrazení kabelů: `[ 🎨 Barevně podle okruhů ]` vs. **`[ 📐 Normové CAD značení (ČSN) ]`**:
>   * V normovém CAD režimu vykresluj kabely klasickou inženýrskou grafikou (plná čára se šikmými ryskami počtu žil
>     `/// 3` nebo `///// 5`, čárkovaná čára pro ovládací/sběrnicové kabely `24 V DC`) a přímo podél každé větve
>     vypisuj čitelný štítek: **`Okr. -F4 · CYKY-J 3×2,5 · 14,2 m`**.
> - Přidej do horní lišty půdorysu tlačítka pro export výkresu:
>   1) **`[ 📄 Exportovat výkres elektroinstalace do PDF (A3/A4) ]`** – vygeneruje čistý vektorový výkres půdorysu
>      s rohový razítkem projektu, legendou značek dle ČSN, okótovanými trasami kabelů s normovým popisem a souhrnnou
>      tabulkou okruhů a metráže.
>   2) **`[ 📐 Exportovat do CAD (DXF / DWG kompatibilní) ]`** (`src/lib/panel-builder/dxf-export.ts`) – vygeneruje
>      standardní soubor `.dxf` (otevřitelný v AutoCADu, BricsCADu, GstarCADu i ProgeCADu) rozdělený do přehledných
>      hladin (`STAVBA_MISTNOSTI`, `ZARIZOVACI_PREDMETY`, `ZASUVKY_230V_400V`, `SVETLA_VYPINACE`, `SBERNICE_SMART_HOME`,
>      `KABELY_SILOVE`, `KABELY_SLABOPROUD`, `POPISY_A_KOTY`) v reálných milimetrech 1:1!
>
> Po implementaci spusť `npm run verify`, přidej unit testy pro posouvání ortogonálních a šikmých úseků kabelů a DXF
> generátor, uprav E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.

## Rozpad fáze 63

1. Paleta půdorysu jako akordeon: záhlaví kategorie se šipkou ▾ / ▸ a počtem osazených prvků na aktivním podlaží,
   „Sbalit vše“ / „Rozbalit vše“, režim „Rozbalit vždy jen jednu kategorii“, stav uložený v prohlížeči.
2. Zařizovací předměty ve skutečných rozměrech (vana, sprchový kout, umyvadlo UMY 600 × 450, dvojumyvadlo DUM
   1200 × 450): architektonická značka, žlutý roh a posuvné strany se živými kótami, otočení o 90° / 45°, přesné
   rozměry v detailu, zóny 0–2 (0,6 m) a pás nad / pod umyvadlem se přepočítají; hlídač vzdáleností zásuvek
   a spínačů od vany, sprchy a umyvadla.
3. Knihovna samostatných spotřebičů: úprava vestavěných (název, zkratka, příkon, jistič, chránič, kabel, montážní
   výška), vlastní spotřebiče se šablonami, uložení v prohlížeči i ve firmě (`RegisteredCompany.applianceLibraryJson`)
   a kopie v nákresu; okruhy rozváděče podle zadání spotřebiče (chránič typ F jako samostatná skupina).
4. Lišta výrobců: ABB s přepínačem rodin (domovní spínače a zásuvky / ABB-free@home / ABB i-bus KNX
   & ABB-flexTronics), výrobci Loxone a TapHome s řadami a barvami, vložení prvků do půdorysu (sběrnicová úroveň),
   akční členy na DIN lištu jako informace o výpočtu rozváděče, TapHome jako systém chytré domácnosti.
5. Věrné náhledy řad v galerii i v liště (Levit, Zoni, Tango, Time, Time Arbo, Decento, Céliane, Nová Unica, Sedna,
   Asfora …) a tlačítko „🌐 Prohlédnout řadu na webu výrobce ↗“.
6. Ruční úprava tras: posun úseku kolmo k jeho směru (vodorovný v Y, svislý v X, šikmý kolmo ke stěně), sousední
   úseky se natáhnou, dvojklik = odskok, pravé tlačítko / panel = reset na automat; délky kabelů z upravené trasy.
   Polygonální místnosti se šikmými stěnami (přichytávání 0° / 45° / 90°, Shift = volný úhel), trasy podél stěn
   v odsazení 200 mm s kolmou odbočkou k prvku, prvek u šikmé stěny natočený ke stěně.
7. Zobrazení kabelů barevně / normové CAD značení (rysky počtu žil, čárkovaně ovládací a sběrnicové kabely, štítek
   okruhu), export výkresu do PDF přes tiskový náhled (A3 / A4, razítko, legenda, tabulka okruhů) a do DXF
   (`dxf-export.ts`, 8 hladin, mm 1 : 1; DWG uloží CAD program z DXF).
