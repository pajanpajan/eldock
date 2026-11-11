# Zadání fáze 91 – katalogový audit designových řad (vícerámečky, Busch-axcent, náhledy) a instalační krabičky podle prostředí a hloubky

Vloženo z chatu 2026-11-11. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci (audit proti oficiálním katalogům a webům výrobců).

## Zadání (z chatu)

Musíme provést důkladnou katalogovou a vizuální revizi designových řad (konec vymyšlených vícerámečků, oprava Busch-axcent a reálné produktové náhledy) a přidat novou inženýrskou funkci: Hlídání hloubky instalačních krabiček + výběr výrobce krabiček (KOPOS, Kaiser, Schneider, OBO, SEZ) podle typu prostředí a stěny v kusovníku.

Zapiš tuto fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 4 částech:

================================================================================
ČÁST 1: PŘÍSNÝ KATALOGOVÝ AUDIT VÍCERÁMEČKŮ A KOMBINACÍ (ŽÁDNÉ VYMYŠLENÉ VARIANTY!)
================================================================================

V `src/lib/panel-builder/residential-series-catalog.ts`, v editoru `Sestavy ve vícerámečku` a v kusovníku (BOM) zaveď u každé designové řady striktní vlastnost `maxFrameGang` (`1` až `5`), povolené orientace (`horizontal`, `vertical`) a přesná pravidla párování krytů a rámečků podle oficiálních katalogů výrobců 2026:

1. PŘESNÉ LIMITY VÍCERÁMEČKŮ (`maxFrameGang`) PODLE SKUTEČNÝCH KATALOGŮ:
   - **ABB Zoni®, Tango®, Levit®, Levit® M, Time®, Swing®, Swing® L, Element®, Neo®, future® linear, solo®, solo® carat, Busch-axcent®:** `maxFrameGang = 5` (1R až 5R).
   - **ABB Time® Arbo (dřevěné rámečky):** `maxFrameGang = 4` (vyrábí se pouze 1R až 4R, 5R neexistuje!).
   - **ABB Decento® (porcelán a dřevo):** `maxFrameGang = 3` (vyrábí se POUZE 1R, 2R a 3R – 4R a 5R v katalogu ABB neexistují!).
   - **ABB Classic:** `maxFrameGang = 1` (klasické monoblokové přístroje bez modulárních vícerámečků).
   - **ABB Garant (IP44), Praktik (IP44), Variant+ (IP54):** `maxFrameGang = 1`, `isSurfaceMounted = true` (nástěnné krabicové přístroje do vlhka; žádné podomítkové vícerámečky 2R–5R! Povol pouze samostatný přístroj 1R nebo monoblokovou nástěnnou dvojzásuvku).
   - **Schneider Electric Nová Unica, Sedna Design & Elements, Asfora:** `maxFrameGang = 5` (u Asfora vodorovné až 6R, svislé až 3R; u Mureva Styl IP55 nástěnné `maxFrameGang = 1` / dvojbox).
   - **Legrand Valena Life, Valena Allure, Céliane:** `maxFrameGang = 5` (u Plexo IP55 `maxFrameGang = 3`).
   - **Hager lumina, berker S.1 / B.3 / B.7 / Q.1 / Q.3 / K.1 / K.5:** `maxFrameGang = 5` (u berker R.classic otočné `maxFrameGang = 3`, u W.1 IP55 nástěnné `maxFrameGang = 1`).

2. VYNUCENÍ LIMITŮ V EDITORU VÍCERÁMEČKŮ A V PŮDORYSU:
   - Pokud má zvolená řada `maxFrameGang = 3` (např. `ABB Decento`), v modalu a v levém panelu `Sestavy ve vícerámečku` **zakaž a skryj tvorbu 4R a 5R sestav** (zobraz jasnou informaci: *"Řada ABB Decento se vyrábí maximálně v trojrámečku (1R–3R)"*).
   - Pokud uživatel přepne projekt s již osazeným 4R/5R rámečkem na řadu `Decento` nebo nástěnnou řadu `Variant+ (IP54)`, v Elektro-linteru i v horní liště okamžitě zobraz upozornění a v kusovníku (BOM) sestavu automaticky rozděl na skutečně vyráběné rámečky (např. `3R + 1R` u Decenta, nebo samostatné nástěnné přístroje u IP44/54), aby v kusovníku NIKDY nebyla vymyšlená neexistující položka!

3. OPRAVA ŘADY `ABB Busch-axcent®` A `solo® carat` PODLE KATALOGU ABB 2026:
   - U **Busch-axcent®** oprav barvy a logiku kombinací (katalog ABB 2026, str. 296):
     * Přístroje (klapky a zásuvky uvnitř) se vyrábějí v barvách: **`Studiová bílá (lesklá)`**, **`Alpská bílá / Chaloupková bílá (matná)`**, **`Černá matná`** a **`Platinová`**.
     * Rámečky **Busch-axcent®** mají charakteristický rovný geometrický tvar s **vnitřním lemem (nosičem) v barvě Studiová bílá nebo Černá matná** a vnější plochou v těchto skutečných katalogových variantách:
       - *Základní a skleněné (Sklo / Plast):* `Studiová bílá`, `Černá`, `Červená`, `Zelená`, `Modrá`, `Žlutá`, `Sklo černé`, `Sklo bílé`, `Sklo korálové`, `Sklo ústřicové`, `Sklo avokádo`, `Sklo purpurové`, `Sklo sluneční`.
       - *Přírodní materiály (Busch-axcent® pur):* `Břidlice (pravá břidlice)`, `Beton`, `Lisovaný papír`, `Platinová (kov)`, `Titanová (kov)`.
     * V náhledu i v kusovníku se tedy při volbě např. `Busch-axcent · Sklo černé` nebo `Beton` mění **pouze vnější rámeček**, zatímco vnitřní klapka spínače a zásuvka zůstává čistě **Studiová bílá** nebo **Černá matná** (přesně tak, jak se Busch-axcent skutečně vyrábí a prodává!).
   - Stejné pravidlo nastav u **solo® carat**: ušlechtilé rámečky (`Bronz`, `Chrom`, `Zlato`, `Ušlechtilá ocel`, `Sklo bílé`, `Břidlice`) se kombinují výhradně s vnitřními krytkami řady **solo®** (`Slonová kost`, `Studiová bílá`, `Šedá metalíza`, `Antracitová`).

================================================================================
ČÁST 2: DOTAŽENÍ VIZUALIZACÍ DESIGNOVÝCH ŘAD DO REÁLNÉ KATALOGOVÉ PODOBY
================================================================================

Současné vektorové nákresy v modalu `Designové řady a barvy` (zejména u `Variant+`, `Garant`, `Praktik`, `Decento`, `Busch-axcent`, `Time`, `Swing`) vypadají jako zjednodušené dětské piktogramy (např. u Variant+ jen čtverec se 4 kroužky, u Decenta tečky po obvodu zásuvky).

Přepracuj vykreslovací engine náhledů (`SeriesPreviewIllustration.tsx` + lokální produktové fotky v `public/catalog-images/`):
1. **Stažení / vložení reálných produktových fotografií + fotorealistické studiové SVG rendery (s realistickými 3D gradienty, odlesky skla/porcelánu, texturami dřeva/betonu/břidlice a věrnou geometrií podle Katalogu ABB 2026):**
   - **ABB Decento:**
     * *Spínač 1R:* Kruhový glazovaný porcelánový rámeček s plynulým keramickým profilem a lesklým odleskem světla, uprostřed kruhový porcelánový střed a charakteristická **úzká retro klapka se zaoblenými konci** (nebo otočná páčka), žádné falešné čárky!
     * *Zásuvka 1R:* Kruhový porcelánový rámeček, hluboká kruhová dutina zásuvky s kovovým zemnicím kolíkem nahoře, dvěma zdířkami L/N a středovým upevňovacím šroubkem uprostřed dutiny (žádné tečky po obvodu rámečku!).
     * *Vícerámeček (2R / 3R):* Autentický vykrojený porcelánový/dřevěný tvar spojených kruhů; u dřevěných variant (`Buk`, `Třešeň`, `Černý dub`) realistická kresba dřeva na rámečku a bílý glazovaný porcelán uvnitř.
   - **ABB Variant+ (IP54):**
     * Charakteristický zaoblený průmyslový nástěnný přístroj: dvoubarevné šedé/tmavě modrošedé tělo se zkosenou horní a spodní hranou, uprostřed tmavě šedá kolébka nebo odklápěcí ochranné víčko s pružinovým pantem nahoře, bočními lemy a logem ABB / IP54 ve spodní části víčka.
   - **ABB Garant (IP44) a Praktik (IP44):**
     * *Garant:* Elegantní oblé nástěnné tělo v bílé nebo antracitově šedé barvě s průhledným/kouřovým nebo plným odklápěcím víčkem zásuvky.
     * *Praktik:* Čisté hranaté nástěnné krabicové tělo s odklápěcím víčkem zásuvky a velkou kolébkou spínače.
   - **ABB Busch-axcent®:**
     * Ostrý plochý obdélníkový rámeček s tenkým vnitřním bílým/černým nosným rámečkem okolo čtvercové klapky a realistickou texturou vnějšího rámečku (lesklé sklo s diagonálním odleskem, zrnitý beton, vrstvená břidlice, kartáčovaná ocel).
   - **ABB Zoni®, Tango®, Levit®, Time®, future® linear, solo®:**
     * U každé řady vykresli její nezaměnitelný tvar: *Tango* (vypouklý oblý rámeček a zakulacená kolébka), *Zoni* (zcela plochý sametově matný kruhový/čtvercový prolis), *Time* (kovový vodorovný proužek pod/nad klapkou), *solo* (široká klapka s kovovými/barevnými horními a spodními lištami rámečku).

================================================================================
ČÁST 3: HLÍDÁNÍ HLOUBKY INSTALAČNÍCH KRABIČEK + VÝROBCI KRABIČEK (KOPOS A DALŠÍ) DLE PROSTŘEDÍ
================================================================================

Vytvoř kompletní modul pro výpočet, kontrolu a výpis přístrojových instalačních krabiček (`src/lib/panel-builder/mounting-boxes-catalog.ts`) a napoj ho do 2D půdorysu, Elektro-linteru i finálního Kusovníku (BOM):

1. KATALOG VÝROBCŮ INSTALAČNÍCH KRABIČEK A TYPŮ STĚN / PROSTŘEDÍ:
   Do nastavení projektu půdorysu (v Kroku 2 / Kroku 5 a v detailu místnosti) přidej volbu:
   - **Výrobce instalačních krabiček:**
     1) **`KOPOS Kolín`** *(Výchozí – nejrozšířenější v ČR/SK)*
     2) **`Kaiser`** *(Prémiové instalační a větruvzdorné krabice Econ® / Electronic-Dose)*
     3) **`Schneider Electric`** *(Řada Merten / IMT35xxx)*
     4) **`OBO Bettermann`** *(Řada UG / HG větruvzdorné)*
     5) **`SEZ Dolný Kubín`** *(Řada KU 68 / KP 67)*
   - **Výchozí konstrukce stěn / prostředí (lze přepsat i pro každou místnost zvlášť, např. koupelna, dřevostavba, fasáda):**
     * `Zdivo / Cihla / Ytong (pod omítku)`
     * `Sádrokarton (SDK) / Duté příčky`
     * `Dřevostavba / Pasivní dům (CA2 – bezhalogenové / větruvzdorné s membránou)`
     * `Litý beton / Panel`
     * `Zateplená fasáda (ETICS – polystyren / vata, bez tepelného mostu)`
     * `Vlhké / Venkovní prostředí (nástěnná montáž IP44/IP54 – bez podomítkové krabice)`

2. AUTOMATICKÝ VÝPOČET POTŘEBNÉ HLOUBKY KRABIČKY (`requiredBoxDepthMm`) U KAŽDÉHO PRVKU:
   Pro každý osazený prvek (nebo sestavu ve vícerámečku) v půdorysu automaticky vyhodnoť minimální potřebnou hloubku krabičky:
   - **Standardní hloubka (`42–45 mm`, např. `KOPOS KU 68-1901` nebo `KUH 68/1` do SDK):**
     * Koncová jednozásuvka / dvojzásuvka bez průchozího smyčkování více než 2 kabelů.
     * Klasický koncový vypínač (řazení 1, 6) bez elektroniky a bez rozbočování pod vypínačem.
   - **Hluboká krabice (`66–70 mm`, např. `KOPOS KPR 68`, `KPR 68/71` nebo `KPR 68/L` do SDK):**
     Automaticky vyžaduj hlubokou krabici (`minDepthMm = 66`), jakmile platí ALESPOŇ JEDNA z těchto podmínek:
     * V krabici se smyčkuje / rozbočuje více kabelů (průchozí zásuvka v okruhu nebo vypínač, pod kterým se WAGO svorkami rozbočuje přívod ke svítidlům – v režimu `Klasická instalace` u vypínačů vždy doporuč hlubokou krabici `KPR 68` pro pohodlné uložení WAGO svorek za strojkem!).
     * Přístroj má hluboký strojek: **Stmívač 230 V**, **Zásuvka s USB-A/C nabíječkou**, **Zásuvka s přepěťovou ochranou T3**, **Prostorový termostat**, **Datová zásuvka 2× RJ45 (CAT6A/CAT7 kvůli poloměru ohybu kabelu)**, **Sporáková přívodka (krabice `KOPOS KP 64/FD` / `KPR 68`)**.
   - **Krabice s boční kapsou pro elektroniku (`70 mm + kapsa`, např. `KOPOS KUP 68` / `KP E68` nebo `Kaiser Electronic-Dose 1068-02`):**
     * Automaticky vyžaduj, pokud je u prvku osazen **podomítkový akční člen do krabičky** (`ABB-free@home® wireless aktor`, `ABB flexTronics®`, `Shelly / Retrofit modul pod vypínačem`, `Loxone Air do krabičky`).
   - **Speciální montážní krabice:**
     * U venkovních prvků na zateplené fasádě (venkovní zásuvka, světlo na fasádě, kamera): **`KOPOS KEZ KB`** (krabice do zateplení) nebo **`KOPOS MDZ KB`** (montážní deska do zateplení).
     * U nástěnných dotykových panelů (`ABB IP TOUCH 7"/10"`, `SmartTouch 10"`, `OneTouch 7"`, `Loxone Wall Display 10"`): příslušná originální zapuštěná montážní krabice výrobce.
     * U nástěnných přístrojů `Garant (IP44)`, `Praktik (IP44)`, `Variant+ (IP54)`: **0 ks podomítkových krabic** (montují se přímo na povrch stěny!).

3. HLÍDAČ HLOUBKY KRABIČEK V DETAILU PRVKU A V ELEKTRO-LINTERU (`Kontrola půdorysu a norem`):
   - V pravém panelu `Detail vybraného prvku` zobraz u každého prvku pole **`📦 Instalační krabička:`** s automaticky doporučeným typem (např. `Hluboká 66 mm – KOPOS KPR 68 (kvůli WAGO svorkování / stmívači)`), možností ruční volby (`Automaticky dle přístroje` | `Mělká 42–45 mm (KU 68)` | `Hluboká 66–70 mm (KPR 68)` | `S boční kapsou pro aktor (KUP 68)` | `Bez krabice – nástěnná`) a zobrazením minimální požadované hloubky v mm.
   - **Kontrola v Elektro-linteru:** Pokud uživatel u prvku, který vyžaduje hloubku `>= 65 mm` (např. vypínač s podomítkovým aktorem, stmívač, datová zásuvka CAT7, termostat nebo průchozí rozbočovací krabice), nastaví mělkou krabici `42–45 mm`, zobraz v `Kontrola půdorysu a norem` varování:
     * *"⚠️ Nedostatečná hloubka krabičky u [Název prvku] v místnosti [Místnost]: zvolena krabice 45 mm (KU 68), ale přístroj a svorkování vyžadují min. 66 mm! Doporučujeme hlubokou krabici KOPOS KPR 68 (do zdiva) nebo KPR 68/L (do SDK)."* + tlačítko **`[ Opravit na hlubokou krabici (1-klik) ]`**!

4. SEKCE DOPORUČENÝCH KRABIČEK PODLE PROSTŘEDÍ NA KONCI VÝPISU MATERIÁLU (BOM):
   - Na konci Kusovníku (BOM) v Kroku 5 (a v PDF/CSV exportu kusovníku půdorysu) přidej samostatnou přehlednou tabulku:
     **`📦 Doporučené instalační krabičky a montážní příslušenství (dle prostředí a hloubky)`**:
     * Pro každou položku vypiš: **Výrobce** (např. `KOPOS Kolín`), **Přesné typové označení** (např. `KU 68-1901`, `KPR 68`, `KPR 68/L`, `KPRL 68-70/LD NA`, `KUP 68`, `KEZ KB`, `KU 68 LD NA` víčka), **Objednací kód / Katalogové číslo**, **Hloubka (mm)**, **Určení / Prostředí** (např. *"Do zdiva – hluboká 66 mm pro vypínače se svorkováním, stmívače a zásuvky CAT7"* nebo *"Do sádrokartonu / dřevostavby CA2 – větruvzdorná s membránou, hl. 70 mm"*) a **Přesný počet kusů** (se zohledněním vícerámečků 2R–5R jako spojovatelných krabic s roztečí 71 mm nebo vícenásobných SDK krabic `KP 68/2`, `KP 68/3`!).

================================================================================
ČÁST 4: TESTY, VERIFIKACE A NASAZENÍ
================================================================================

- Napiš unit testy v `src/lib/panel-builder/mounting-boxes-catalog.test.ts` a `residential-series-catalog.test.ts`, které ověří:
  1) Že řada `Decento` povoluje max. `3R` (a blokuje 4R/5R), `Time Arbo` max. `4R`, a nástěnné řady `Garant / Praktik / Variant+` mají `maxFrameGang = 1` a negenerují podomítkové krabice KU68.
  2) Že `Busch-axcent` správně drží barvu vnitřní klapky (`Studiová bílá` / `Černá matná`) nezávisle na materiálu vnějšího rámečku (`Sklo černé`, `Beton`, `Břidlice`).
  3) Že kalkulátor krabiček správně přiřadí hlubokou krabici (`KPR 68` / `KPR 68/L`) u stmívače, termostatu nebo datové zásuvky a krabici s kapsou (`KUP 68` / `Kaiser Electronic-Dose`) u bezdrátového aktoru do krabičky, a že linter ohlásí chybu při ruční volbě mělké `45 mm` krabice.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

Zadání požaduje „žádné vymyšlené varianty“ – kde se zadání rozchází s oficiálním katalogem nebo webem výrobce, platí katalog
(ABB: lokální „Katalog: Domovní elektroinstalační materiál 2026“, strany níže; krabice: weby výrobců ověřené 2026-11-11).

- **Vícerámečky ABB (`residential-series-catalog.ts`, `SERIES_FRAME_RULES`):** Zoni, Tango, Levit, Levit M, Time, Swing,
  Swing L, future linear, solo a Busch-axcent 1R–5R (str. 68–69, 81, 96–97, 119–120, 136–137, 152, 160, 166); Time Arbo
  1R–4R (str. 138); Classic jen 1R (str. 54); Garant / Praktik / Variant+ nástěnné, 1 (str. 498, 502, 506). Všechny
  vícenásobné rámečky ABB jsou „pro vodorovnou i svislou montáž“. Řady Element a Neo ve vydání 2026 nejsou (Element skončil
  už ve fázi 61), proto je půdorys nenabízí.
- **solo carat jen 1R–4R** (str. 161: bílé sklo, ušlechtilá ocel, černé sklo – 5R v katalogu není), ne 5R ze zadání.
- **Decento nemá žádný vícenásobný rámeček** – str. 548: „Přístroje designové řady Decento nelze instalovat do vícenásobných
  rámečků. Při instalaci více přístrojů … musí být rozteč středů instalačních krabic alespoň 90 mm“ (rozpěrka 1159-34 na
  91 mm), str. 144 a 147 totéž. Proto `maxFrameGang = 1` + `separateDevices` (min. 90 mm): panel sestav u Decenta sestavy
  skryje s touto větou, víceramček po přepnutí řady linter označí s opravou „Rozdělit na samostatné přístroje“ a kusovník ho
  rozloží na samostatné kompletní přístroje (žádný rámeček 2R / 3R ani „3R + 1R“ – takové položky by byly vymyšlené). Náhled
  víc přístrojů = samostatné kruhy Ø 87 mm po 91 mm, ne „spojené kruhy“ (fáze 90). Decento má jen bílou, bílou / přírodní buk
  (50), bílou / třešeň (52) a černou (N) – „černý dub“ z fáze 90 katalog nevede (uložené nákresy přejdou na přírodní buk).
  Kusovník Decenta dostal objednací čísla kompletních přístrojů ze str. 145–147 (spínač řazení 1 = 6 (1) 3559K-C06345,
  zásuvka 6619K-C06347, komunikační zásuvka 5014K-C01018, nabíječka USB 5014K-C00399 jen bílá / černá; přípona 50 / 52 / N).
- **Ostatní výrobci podle zadání** (katalogy nejsou k dispozici): Schneider Nová Unica / Sedna / Asfora 5 (Asfora svisle 3,
  vodorovné 6R editor nepojme – víceramček má nejvýš 5 pozic), Mureva Styl nástěnná 1; Legrand Valena Life / Allure / Céliane
  5, Plexo 3 (nástěnná); Hager lumina a berker S.1 / B.3 / Q.1 / Q.3 5. Řady berker B.7, K.1, K.5, R.classic a W.1 půdorys
  zatím nenabízí, limit pro ně proto není potřeba. Orientace svisle se v půdorysu nekreslí (rámeček leží v ose stěny) – limit
  `vertical` je připravený v pravidlech.
- **Busch-axcent podle str. 165–166 a 170:** kryty (klapka, zásuvka) jsou ze společné kapitoly future linear / solo / solo
  carat / Busch-axcent – studio bílá (84), mechová bílá (884), antracitová (81), mechová černá (885), hliníková stříbrná (83),
  ušlechtilá ocel (866); rámečky zvlášť z 8 skutečných materiálů, každý 1R–5R: bílé sklo, černé sklo, titanová, platinová,
  matná černá, beton, hnědý papír, břidlice (objednací čísla 2CKA001754A4437 … A4809 – dřív byla doplněná jen 1R–2R / 3R).
  Další barvy ze zadání (červená, zelená, modrá, žlutá, sklo korálové / ústřicové / avokádo / purpurové / sluneční, „platinová“
  jako barva krytu) v katalogu 2026 nejsou – nepřidány. Volba rámečku mění jen rámeček, kryt zůstává (`frames` + `framePairs`
  = výchozí rámeček ke krytu podle kombinací vyfocených na str. 165). Kusovník: kryt 3559B-A00651 + kód (3559B-A0065184),
  rámeček z palety rámečků; stejné kryty doplněny i řadám future linear a solo (kódy krytů).
- **solo carat:** kryty ze stejné společné kapitoly, rámečky jen bílé sklo / ušlechtilá ocel / černé sklo; bronz, chrom,
  zlato a břidlice ani kryty „slonová kost“ a „šedá metalíza“ katalog 2026 nevede.
- **Náhledy (část 2):** jeden studiový engine `series-render.ts` pro soubory i živý náhled v galerii (`DeviceMockup` =
  tenký obal, id s předponou). Decento (glazura, úzká páčka, zásuvka s hlubokou dutinou, kovovým kolíkem, zdířkami L / N
  a středovým šroubkem, dřevo s bílým porcelánem), Garant (oblý, kouřové víčko u šedé), Praktik (hranatý, velká kolébka),
  Variant+ (dvoubarevné tělo se zkosenými hranami, pružinový pant, žebrování, ABB / IP54), Busch-axcent (nosný rámeček
  a textury skla, betonu, břidlice, papíru a kovu), Zoni (prolis), Tango (vypouklé), Time (kovové lišty nad a pod klapkou),
  solo (lišty rámečku). Soubory v `public/catalog-images/` zůstávají pro 6 řad (`npm run catalog:renders`), ostatní řady
  galerie kreslí živě stejným enginem. **Fotografie výrobců se nestahovaly** – rendery jsou vlastní dílo bez licenčních
  podmínek; fotky se schváleným zdrojem lze dál vložit do `public/catalog-images/<výrobce>/<řada>/` se `zdroj.json`.
- **Krabice (`mounting-boxes-catalog.ts`, `box-options.ts`):** jen typy ověřené na webech výrobců (odkaz `source` u každé).
  KOPOS: KU 68-45_KA 45 mm (výrobce ji uvádí jako přímou náhradu KU 68-1901 – ta už v nabídce není), KPR 68_KA 66 mm,
  KPR 68-70_KA 70 mm, KP 64/2–5_KA (vícenásobné do zdiva), KPL 64-45/LD_NA, KPR 68/71L_NA a KPL 64-50/2–5LD_NA do SDK,
  KU 68 LD/1HF_HA a KPRL 68-70/LD_NA vzduchotěsné (dřevostavba / pasivní dům), SB-KP 68-50/M_AB a SB-KP 68-70/M_AB do litého
  betonu, KEZ_KB, KEZ-3_KB a MDZ_KB do zateplení. Kaiser: 1055-05 (46 mm), 1555-05 (66 mm), Electronic-Dose UP¹ 1068-05
  (boční prostor pro elektroniku), O-range® Evo 9063-03, luftdicht 9263-23, Electronic-Dose O-range ECON® Flex 9268-94 (75 mm),
  ECON® Iso+ 1159-55 a Universal-Geräteträger 1159-24 do zateplení. OBO: UG 46 (2003700), UG 66 (2003702), HG 60 (2003414),
  HG 61-L (2003808). Schneider: jen Multifix Air do dutých stěn (IMT35032, IMT35000, IMT35031, IMT35033; IMT35150 výroba
  ukončena). SEZ: 6400-201/3 (400100), 6400H-201/3, KUP 68 LP/SK (400211), KUP 68H-201/3 LP SK. **Typy ze zadání, které
  výrobci nevedou, nejsou v katalogu:** KOPOS KUP 68 / KP E68 (krabici s boční kapsou KOPOS nevede – „s prostorem pro
  elektroniku“ = KPR 68-70 70 mm), KP 64/FD, KPR 68/L, KUH 68/1, „KEZ KB“ (správně KEZ_KB), „KP 68/2 / KP 68/3“ jako vícenásobné
  SDK (KP 68/2 je mělká krabice 30 mm do tenkých příček – vícenásobné SDK jsou KPL 64-50/2LD …); Kaiser 1068-02 v současné
  nabídce není (nástupce 1068-05); OBO krabici pro elektroniku ani UG 60 nevede; SEZ „KU 68 / KP 67“ neexistují. Kde výrobce
  typ pro danou stěnu nevede, kusovník ukáže „doplnit“ (např. Schneider do zdiva, OBO hluboká do SDK).
- **Potřebná hloubka (`boxNeed`):** hluboká ≥ 66 mm – stmívač, termostat, datová zásuvka RJ45, zásuvka s USB nabíječkou
  a s přepěťovou ochranou T3 (nové položky palety), přípojka varné desky, vypínač v klasické instalaci (WAGO svorky)
  a rozbočovací zásuvka (víc než 2 kabely v krabici podle tras); s prostorem pro elektroniku ≥ 66 mm – akční člen do krabičky
  (free@home wireless), ABB-flexTronics® a modul pod vypínač u retrofitu; bez krabice – nástěnné řady, místnost s nástěnnou
  montáží a bezdrátové prvky; panel chytré domácnosti = vlastní krabice výrobce (řádky panelu); zateplená fasáda = KEZ / MDZ.
  Víceramček: vícenásobná krabice, když všem pozicím stačí mělká, jinak spojované krabice po 71 mm podle pozic.
- **Hlídač (`floorplan-norms.ts`):** `frame-limit` (víceramček nad limit řady, oprava rozdělí víceramček i v nákresu,
  štítek „⚠️ Víceramček mimo katalog řady“ v horní liště) a `box-depth` (ruční mělčí krabice – text podle zadání se skutečnými
  typy výrobce a stěny, oprava jedním klikem vrátí doporučenou krabici).
- **Kusovník:** krabice v samostatné tabulce „📦 Doporučené instalační krabičky …“ (dialog kusovníku a tisk, CSV / XLSX,
  dokumentace rozváděče); hlavní tabulka už krabice nemá.
