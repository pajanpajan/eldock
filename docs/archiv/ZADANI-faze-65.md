# Zadání fáze 65 – zásuvkové okruhy a obrázkový katalog chytré domácnosti (2026-11-07)

Zadání z chatu 2026-11-07 se dvěma snímky obrazovky (půdorys bytu s barevnými trasami zásuvkových okruhů přes celý
byt a pruhem „Ručně upravené trasy“; horní lišta výrobců se zeleným textovým boxem free@home). V zadání je katalog
chytré domácnosti označený jako **„Fáze 56“** – číslo je obsazené, proto **fáze 65**. **Text končí uprostřed bodu 3.3**
(schéma zapojení svorek – po první odrážce o sběrnicových tlačítkách / senzorech); zbytek bodu 3.3 je doplněn podle
smyslu bodu 2 (akční členy do krabičky, přístroje na DIN lištu, zdroj, systémový modul), další body zadání nedorazily.

## Doslovné znění

Musíme tam přidat možnost optimalizace kabelových zásuvkových tras, aktuální model se mi vůbec nelíbí, + tam musí být možnost změny, kdyby to z nějakého důvodu situace vyžadovala.

Současné textové zobrazení zařízení chytré domácnosti v `/panel-builder/floorplan` (obří zelený box s prostým textem a nečitelnými řádky) a přepínač pod ABB působí nepřehledně a neprofesionálně. Přepracujeme celou tuto část na čistý, intuitivní obrázkový model s popisy a rozklikávacími datasheety (Fáze 56).

1. ČISTÁ A ELEGANTNÍ HORNÍ LIŠTA VÝROBCŮ A SYSTÉMŮ (KONEC TEXTOVÝCH PLACHET A EMOTIKONŮ):
- V `public/brands/loxone.svg`, `taphome.svg` a `ManufacturerLogo.tsx` oprav loga **Loxone** (čistý zelený nápis `LOXONE` bez černého obdélníkového pozadí!) a **TapHome**, aby byla stejně velká, ostrá a čitelná jako logo ABB nebo Hager.
- Pod výrobcem **ABB** nahraď současné nevkusné pilulky s emotikony a závorkami (`🎨 Domovní spínače a zásuvky (17 řad)`, `🏠 ABB-free@home® (sběrnice 24 V DC & wireless)`...) moderním, čistým segmentovým přepínačem (Segmented Control) s jemnými vektorovými ikonami a podtitulkem:
  1) **Domovní spínače a zásuvky** *(17 designových řad)*
  2) **ABB-free@home®** *(Chytrá elektroinstalace – 24 V sběrnice & Wireless)*
  3) **ABB i-bus® KNX & flexTronics®** *(Systémová automatizace budov)*
- ZRUŠ obří zelený textový box s výpisem surových řádků DIN aktorů přímo nad půdorysem! Místo něj zobraz čisté, vizuální prostředí s přepínačem podkategorií (záložkami):
  * `[ 🎛️ Ovladače, tlačítka a termostaty (do půdorysu) ]`
  * `[ 📡 Prvky do krabičky a bezdrátové (do půdorysu) ]`
  * `[ 🖥️ Panely, čidla a komunikace ]`
  * `[ ⚡ Akční členy a zdroje na DIN lištu (do rozváděče) ]`

2. OBRÁZKOVÝ MODEL ZAŘÍZENÍ CHYTRÉ DOMÁCNOSTI (`src/components/panel-builder/SmartHomeDeviceCatalog.tsx`):
Každé zařízení chytré domácnosti (ABB-free@home, ABB KNX / flexTronics, Loxone, TapHome) zobraz jako přehlednou **Obrázkovou produktovou kartu (Grid karet)**, nikdy jako holé textové tlačítko nebo textový řádek!
Každá karta musí obsahovat:
a) **Detailní 2D vektorový obrázek / render přístroje (`SmartHomeDeviceIllustration.tsx`):**
   - *Tlačítka a senzory (free@home 1/2/4násobné, žaluziové, KNX snímače):* Vykreslený rámeček a klapky v aktuálně zvolené barvě řady s dělením kolébek, stavovými LED proužky a jemnými symboly žárovky / žaluzií.
   - *Loxone Touch Pure / Touch Pure Flex / Touch Nightlight / TapHome tlačítka:* Autentický bezrámečkový skleněný/matný vzhled v Bílé nebo Antracitové barvě s dotykovými body a piktogramy.
   - *Termostaty a dotykové panely (ABB OneTouch 7", Prostorový termostat free@home s displejem, Bluetooth termostat):* Vykreslená obrazovka s digitálním ukazatelem teploty `22,5 °C`, časem `14:17` a dotykovými ikonami topení/chlazení (podle Katalogu ABB 2026 str. 10–11).
   - *Akční členy do krabičky (ABB-free@home® wireless aktor 1kanál / 2kanál / žaluziový / stmívací):* Šedé kompaktní pouzdro do KU68 se zelenou 4pólovou svorkovnicí dole (`N ↓ C1 ↑1 L`), QR kódem, logem ABB a symbolem bezdrátové komunikace (podle Katalogu ABB 2026 str. 10).
   - *Stropní senzory přítomnosti (Busch-Watchdog 180, Loxone Přítomnost Tree/Air):* Kruhová senzorová hlava s multi-čočkou.
   - *Prvky na DIN lištu (SysAP 3.0, zdroj PS-M-64.1.1, spínací aktory SA-M 4/8/12x, žaluziové JA-M, stmívací DA-M, topné HA-M, Loxone Miniserver, Relay/Dimmer/Tree Extension, TapHome Core):* Přesný 2D přístroj na DIN lištu se šroubovými/push-in svorkami nahoře a dole, LED kontrolkami kanálů, popiskem typu a autentickým barevným řešením (ABB světle šedá s červeným proužkem, Loxone zelená/antracitová, TapHome).
b) **Strukturovaný popis a technické štítky (Badges):**
   - Tučný název přístroje + 1–2 věty srozumitelného popisu funkce (co přístroj ovládá a kam se instaluje).
   - Přehledné štítky parametrů: např. `[ 24 V DC sběrnice ]`, `[ Do krabice KPR68 (hl. 32 mm) ]` nebo `[ DIN lišta · 8 modulů ]`, `[ 8× 16 A ]`, `[ IP 20 ]` a objednací kód `MPN`.
c) **Akční tlačítka přímo na kartě:**
   - Pro prvky do půdorysu: tlačítko **`[ 🎯 Osadit do půdorysu ]`** (aktivuje nástroj vkládání tohoto prvku do místnosti v půdorysu; pokud už v půdorysu je, zobrazí odznak `Osazeno: X ks`).
   - Pro prvky na DIN lištu / centrální jednotky: ukazatel **`Automaticky v rozváděči: X ks`** + tlačítka **`[ − ]` / `[ + Přidat do rozváděče ]`**, aby projektant mohl počet DIN modulů i ručně navýšit.
   - Tlačítko **`[ 📄 Datasheet ]`** (s ikonou dokumentu) na každé kartě!

3. INTERAKTIVNÍ DATASHEET A SCHÉMA ZAPOJENÍ PŘÍSTROJE (`src/components/panel-builder/SmartHomeDatasheetModal.tsx`):
- Po kliknutí na tlačítko **`[ 📄 Datasheet ]`** u kteréhokoliv prvku chytré domácnosti (v horním katalogu, v levém menu i v pravém přehledu akčních členů) otevři profesionální modální okno **Technický list (Datasheet) přístroje**:
  1) **Hlavička a velká vizualizace:** Logo výrobce, přesný název, typové označení, objednací číslo (MPN), EAN a velký 2D vektorový náhled přístroje s okótovanými rozměry v mm (Š × V × H).
  2) **Tabulka technických parametrů:** Jmenovité napětí, jmenovitý proud / výkon kanálu, počet vstupů/výstupů, vlastní spotřeba / ztrátový výkon $P_v$ [W], způsob montáže, minimální hloubka krabice (např. KPR68) nebo šířka v modulech na DIN liště, průřez připojovacích vodičů, provozní teplota a stupeň krytí IP.
  3) **Vektorové schéma zapojení svorek (Wiring Diagram SVG):**
     - Automaticky vykresli přehledné schéma připojení vodičů k danému přístroji:
       * U sběrnicových tlačítek/senzorů: zapojení 2vodičové sběrnice `BUS+ / BUS-` (ABB-free@home / KNX) nebo `24V / GND / Tree L / Tree H` (Loxone).

*(zde text zadání končí)*

## Rozpad

1. **Zásuvkové okruhy:** dnes se zásuvky velké místnosti (a půdorysu bez zakreslených místností, kde je vše „Místnost 1“)
   řadí podle vzdálenosti od rozváděče a dělí po 10 – okruh tak sbírá zásuvky ve stejné vzdálenosti na opačných koncích
   bytu („prstence“). Nově kompaktní zóny: pořadí zásuvek po nejkratší trase, místnosti v pořadí sousedství, okruh =
   souvislý úsek trasy (vyvážené dělení do 10 zásuvek dle ČSN 33 2130 ed. 4). Volba rozdělení (optimalizované zóny /
   každá místnost zvlášť / podle vzdálenosti od rozváděče), ruční okruh u zásuvky i výběru zásuvek a tlačítko
   „Optimalizovat zásuvkové okruhy“.
2. **Lišta výrobců:** loga Loxone a TapHome, segmentový přepínač rodin ABB s ikonami a podtitulky, místo zeleného boxu
   záložky podkategorií.
3. **Obrázkový katalog:** karty s vektorovým náhledem přístroje (podle třídy přístroje a barvy řady), popisem, štítky
   parametrů a akcemi (osadit do půdorysu / osazeno X ks, automaticky v rozváděči X ks a ruční navýšení, technický list).
4. **Technický list:** hlavička, náhled s kótami, tabulka parametrů a schéma zapojení svorek; údaje jen ověřené
   (katalog výrobců `prisma/external-catalog/catalog.json`, Katalog ABB 2026, `smart-home.ts`), chybějící údaj =
   „ověřte v datasheetu výrobce“. Technický list i z levé palety a z pravého přehledu akčních členů.
