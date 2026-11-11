# Zadání fáze 90 – 2D půdorys: krok 1 bez přeskoku, krokové karty, řady ABB monobloky a Decento, okna / dveře / nábytek a koupelnové zóny

Vloženo z chatu 2026-11-11. Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Při testování 2D půdorysu (`/panel-builder/floorplan`) jsme narazili na 4 konkrétní problémy a požadavky, které musíme ihned opravit a nasadit:

1. OPRAVA KROKU 1 PRŮVODCE (ZÁKAZ AUTOMATICKÉHO PŘESKOKU NA KROK 2) + VÝRAZNĚJŠÍ HORNÍ LIŠTA KROKŮ:
- CHYBA: Když uživatel v Kroku 1 (`1. Podklad a místnosti`) zadá rozměry místnosti X × Y a klikne na `+ Vytvořit místnost`, aplikace okamžitě sama přeskočí na `2. Systém, výrobce a design`. To je špatně, protože uživatel potřebuje v Kroku 1 vytvořit a poskládat všechny místnosti domu (např. 6–10 místností za sebou)!
- OPRAVA:
  * Kliknutí na `+ Vytvořit místnost`, dokreslení místnosti myší, nahrání podkladu ani kalibrace měřítka NIKDY nesmí automaticky změnit `wizardStep` z 1 na 2! Uživatel zůstává v Kroku 1, dokud sám neklikne na tlačítko `Pokračovat na Výběr systému a designu →` nebo na záložku kroku nahoře.
  * Po kliknutí na `+ Vytvořit místnost` rovnou předvyplň v roletce další typ místnosti (např. po `Obývací pokoj` nabídni `Kuchyň`, `Ložnice`, `Koupelna`, `Chodba`, `Technická místnost`...), aby šlo sázet jednu místnost za druhou na jedno kliknutí!
- VIZUÁLNÍ ZVÝRAZNĚNÍ KROKŮ 1 AŽ 5 (`FloorplanWizardBar`):
  * Současné malé textové pilulky kroků `1. Podklad a místnosti` až `5. Kusovník, Export a Rozváděč` jsou málo viditelné.
  * Přepracuj lištu kroků na **velké, vysoce kontrastní krokové karty (Stepper)**: každý krok má výrazný kroužek s číslem `1`..`5` (nebo fajfkou `✓` u hotových kroků), tučný nadpis, krátký podtitulek (např. pod Krokem 1 živý počet: `3 místnosti · měřítko OK`), šipku `→` mezi kroky a u aktivního kroku jasné žluté podsvícení s horním/spodním akcentem.

2. OPRAVA VIZUALIZACÍ A BAREV U ABB DECENTO A NÁSTĚNNÝCH ŘAD IP44 / IP54 (GARANT, VARIANT+, PRAKTIK):
V modalu `Designové řady a barvy` a v katalogu (`src/lib/panel-builder/residential-series-catalog.ts`) oprav řady, které nesedí s realitou katalogu ABB 2026:
a) **Nástěnné řady do vlhka a průmyslu: `ABB Garant (IP44)`, `ABB Variant+ (IP54)` a `ABB Praktik (IP44)`:**
   - Tyto 3 řady jsou **nástěnné (krabicové) monoblokové přístroje** – NEMAJÍ samostatné podomítkové rámečky a nedávají se do standardního 3-rámečku `Vícerámeček 3R`!
   - U těchto tří řad **skryj volbu `Barva rámečku`** (přístroj je kompletní monoblok v jedné barvě/kombinaci) a místo `Vícerámeček 3R – vypínač + 2 zásuvky` vykresli **`Dvojzásuvka IP44/IP54 s odklápěcím víčkem (nástěnná)`** (příp. společnou nástěnnou kombinaci vypínač + zásuvka s víčkem)!
   - V SVG renderu u těchto řad vykresli:
     * Robustní nástěnné krabicové tělo s horní kabelovou průchodkou/vývodkou.
     * U zásuvky **odklápěcí ochranné víčko (klapku)** s prolisem a označením `IP44` / `IP54` (nikoliv otevřenou interiérovou zásuvku!).
   - Oprav reálné barvy podle Katalogu ABB 2026 (odstraň neexistující hnědou a béžovou u Garantu!):
     * **`Garant (IP44)`**: pouze 2 reálné barvy: `Bílá` a `Šedá / antracitová` (zaoblený nástěnný přístroj, str. 498).
     * **`Praktik (IP44)`**: pouze 2 reálné barvy: `Bílá` a `Šedá` (hranatý nástěnný přístroj, str. 502).
     * **`Variant+ (IP54)`**: reálné průmyslové barvy: `Šedá / tmavě šedá (2-barevná IP54)` a `Bílá / šedá (IP54)` (robustní průmyslový přístroj se zvýšeným krytím IP54, str. 506).
b) **Porcelánová retro řada `ABB Decento` (str. 142):**
   - Decento jsou **kulaté porcelánové přístroje**!
   - V SVG renderu vykresli:
     * **Spínač 1R:** Kulatý porcelánový rámeček s lesklým odleskem glazury a typickou **úzkou retro otočnou/pákovou klapkou** uprostřed.
     * **Zásuvka 1R:** Kulatý porcelánový rámeček, kruhová dutina se zemnicím kolíkem a dvěma charakteristickými montážními šroubky.
     * **Vícerámeček (Dvojrámeček / Trojrámeček Decento):** Vykresli autentický **vykrojený tvar spojených kruhů (tvar piškotu / osmičky)**, nikoliv rovný obdélník se zaoblenými rohy! U dřevěných variant (`Bílá / přírodní buk`, `Bílá / třešeň`, `Bílá / černý dub`) vykresli dřevěný kulatý/vykrojený rámeček a uvnitř čistě bílý porcelánový střed!
   - U Decenta skryj nesmyslné křížové kombinování barvy klapky a rámečku (každá ze 4–5 katalogových variant Decenta už definuje přesnou dvojici porcelánového středu a porcelánového/dřevěného rámečku).

3. NOVÁ SEKCE V LEVÉ PALETĚ: `🛋️ Okna, dveře a vybavení (Nábytek)` S AKTIVNÍM ROHEM X × Y:
Do levé palety v `/panel-builder/floorplan` přidej novou sbalovací kategorii **`🛋️ Okna, dveře a nábytek`** (pro dokonalou orientaci a vizualizaci půdorysu při rozmísťování zásuvek, vypínačů a světel):
- Všechny tyto prvky jsou **architektonické/orientační prvky** (nevytvářejí elektrické okruhy v rozváděči, ale zobrazují se na plátně, v PDF tisku i v DXF exportu ve vrstvě `ARCHITEKTURA_NABYTEK`).
- Každý prvek z této sekce MUSÍ mít po kliknutí na plátně **aktivní žlutý roh a posuvné hrany pro plynulou změnu rozměrů Šířka X × Hloubka Y**, živé kóty v metrech, otáčení (`0° / 45° / 90° / 180° / 270°`) a u dveří tlačítko `[ ⇄ Levé / Pravé otevírání ]`!
- Přidej tyto přednastavené prvky s čistými 2D architektonickými CAD půdorysnými nákresy:
  * **Stavební otvory (přichytávají se ke stěnám místnosti):**
    - `OKN_1` **Okno jednokřídlé** (výchozí `1,00 × 0,25 m`, dvojitá čára skla v rámu)
    - `OKN_2` **Okno dvoukřídlé** (výchozí `1,60 × 0,25 m`)
    - `OKN_HS` **Francouzské okno / HS portál** (výchozí `2,60 × 0,30 m`, se šipkou posuvu)
    - `DVE_1` **Dveře jednokřídlé** (výchozí `0,80 × 0,80 m`, křídlo dveří + čtvrtkruhová čárkovaná výseč otevírání + přepínač Levé/Pravé)
    - `DVE_2` **Dveře dvoukřídlé** (výchozí `1,45 × 0,80 m`, dvě křídla s oblouky)
    - `DVE_POS` **Dveře posuvné** (výchozí `0,90 × 0,20 m`)
  * **Nábytek a vybavení interiéru:**
    - `POST_2` **Manželská postel (dvoulůžko)** (výchozí `1,80 × 2,00 m`, nákres matrace, dvou polštářů a přikrývky – ideální pro přesné osazení zásuvek a vypínačů u čela postele!)
    - `POST_1` **Jednolůžko / Dětská postel** (výchozí `0,90 × 2,00 m`, nákres s polštářem)
    - `GAUC_L` **Rohová sedací souprava (L-gauč)** (výchozí `2,60 × 1,80 m`, sedáky a opěrky)
    - `GAUC_R` **Pohovka / Gauč rovný** (výchozí `2,20 × 0,95 m`)
    - `STUL_J` **Jídelní stůl se židlemi** (výchozí `1,80 × 0,90 m`, obdélník stolu se 6 židlemi okolo)
    - `STUL_PC` **Pracovní stůl se židlí** (výchozí `1,40 × 0,70 m`)
    - `LINKA` **Kuchyňská linka (s dřezem a varnou zónou)** (výchozí `2,60 × 0,60 m`)
    - `OSTR` **Kuchyňský ostrůvek** (výchozí `1,80 × 0,90 m`)
    - `SKRIN` **Šatní skříň / Vestavěná skříň** (výchozí `2,00 × 0,60 m`, se šrafováním ramínek)
    - `TV_ST` **TV stolek / Obývací stěna** (výchozí `1,80 × 0,45 m`, se symbolem obrazovky)
    - `WC_M` **WC mísa / Závěsné WC** (výchozí `0,40 × 0,65 m` – přidej i do `🛁 Zařizovací předměty`)

4. OPRAVA KOUPELNOVÝCH ZÓN (ČSN 33 2000-7-701 ed. 2) U VANY/OKNA A DOPLNĚNÍ OCHRANNÉHO PROSTORU UMYVADLA (ČSN 33 2130 ed. 4):
- **CHYBA A – Falešný poplach u venkovní žaluzie (`ZAL_M`) a okenního kontaktu (`MAG`) nad vanou:**
  * Když je vana umístěna u obvodové stěny pod oknem a uživatel osadí do okna vývod pro venkovní žaluzii `ZAL_M` (výška `2450 mm`) nebo okenní magnet `MAG` (`2100 mm`), linter chybně hlásí: *"1× zásuvka / spínač v zóně 0–2 koupelny (nejblíž 43 cm od hrany vany / sprchy)"*.
  * OPRAVA DLE ČSN 33 2000-7-701 ed. 2 (čl. 701.32):
    1) **Výškový strop zóny 1 a 2 je 2250 mm:** Každý prvek, který má montážní výšku `heightMm > 2250` (jako vývod motoru žaluzie `ZAL_M` v překladu ve výšce `2450 mm`), leží **NAD zónou 1 a 2** -> NIKDY ho nevyhodnocuj jako chybu v zóně 0–2!
    2) **Vyloučení venkovních a SELV prvků v okně:** Prvky `ZAL_M` (venkovní motor žaluzie v kastlíku okna) a `MAG` (pasivní magnetický kontakt SELV na okně) nejsou zásuvky ani spínače 230 V v koupelně -> vyřaď je z kontroly zásuvek/spínačů v zóně 0–2.
    3) **Oříznutí vykreslení koupelnové zóny stěnou místnosti:** Pokud vana nebo sprcha leží uvnitř nakreslené místnosti (koupelny), ořízni vykreslovanou modrou zónu 2 (`svg clipPath` nebo hranice místnosti) tak, aby nepřesahovala ven za obvodové stěny koupelny na fasádu domu!
    4) **Přesný název prvku v chybové hlášce:** Pokud v zóně 0–2 skutečně leží zakázaná zásuvka nebo spínač (s `heightMm <= 2250`), vypiš v hlášce přesný název a výšku prvku (např. `"1. NP: Jednozásuvka (výška 300 mm) zasahuje do zóny 2 koupelny (43 cm od vany, min. 60 cm)"`).
- **CHYBA B – Chybějící vykreslení a kontrola ochranné zóny u Umyvadla (`UMY`) a Dvojumyvadla (`DUM`):**
  * U `Umyvadla` (`UMY`) a `Dvojumyvadla` (`DUM`) momentálně na plátně není vidět žádná ochranná zóna!
  * OPRAVA DLE ČSN 33 2130 ed. 4 (Umyvadlový prostor):
    1) Přímo kolem každého osazeného `Umyvadla` (`UMY`) a `Dvojumyvadla` (`DUM`) vykresli na plátně (když jsou zapnuté koupelnové zóny / popisky) zřetelný **tyrkysově/oranžově čárkovaný ochranný „Umyvadlový prostor (ČSN 33 2130 ed. 4)“** – pás v šířce umyvadla (`widthM`) + boční ochranný lem `200 mm` (doporučeno `400 mm` pro spínače/zásuvky ve výšce pod 1200 mm) a popisek `UMYVADLOVÝ PROSTOR`.
    2) V linteru (`Kontrola půdorysu a norem`) přidej kontrolu: pokud je klasická zásuvka nebo vypínač 230 V umístěn přímo v svislém pásu umyvadla (nebo v těsné blízkosti hrany umyvadla pod výškou `1200 mm` bez krytí IP44), zobraz srozumitelné upozornění dle ČSN 33 2130 ed. 4 s tlačítkem `Zobrazit`.

Po implementaci přidej unit testy (zejména na to, že `ZAL_M` ve výšce 2450 mm nad vanou nevyhodí chybu zóny 0–2, že `UMY` vykresluje a hlídá umyvadlový prostor, a že přidání místnosti v Kroku 1 nepřepne průvodce na Krok 2), spusť `npm run verify`, udělej git commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

- **Příčina přeskoku na krok 2:** nový půdorys vznikne na serveru při první změně (`replaceState` na `/panel-builder/floorplan/<id>`) a další automatické uložení server action s `revalidatePath` překreslí už stránku uloženého půdorysu – editor se přemontuje a krok se počítal znovu z obsahu (`initialStep`: místnosti → krok 2). Oprava: aktivní krok se pamatuje v relaci prohlížeče podle půdorysu (`useWizardStep`, klíč `eldock-floorplan-wizard-step:<id>`), takže přežije přemontování i obnovení stránky; bez záznamu (nová karta) výchozí krok podle obsahu jako dosud. Krok mění jen karta kroku, tlačítko na další krok, odznak designu a kapitola video-návodu.
- **Předvolba další místnosti:** pořadí `ROOM_SEQUENCE` (obývací pokoj → kuchyň → ložnice → koupelna → chodba / zádveří → technická místnost → WC → dětský pokoj → pracovna → šatna → spíž → garáž); nabídne se typ za právě vytvořeným, který na podlaží ještě není (Obývák + KK zastoupí obývací pokoj i kuchyň), s typickým rozměrem – po přemontování editoru první chybějící typ.
- **Krokové karty:** fajfka u kroku 1 s místností a v pořádku měřítkem (rastr v mm, výkres CAD, zkalibrovaný podklad), u kroku 2 po jeho opuštění nebo s osazenými prvky, u kroku 3 s prvky a rozváděčem RH, u kroku 4 s okruhy po jeho opuštění, u kroku 5 s vygenerovaným rozváděčem; podtitul živě (místnosti a měřítko, design, prvky a RH, okruhy a délka kabelu, výstupy).
- **Řady ABB:** soubor `residential-series-catalog.ts` neexistuje – katalog řad je `abb-catalog-2026.ts`. Barvy a strany podle zadání (katalog ABB 2026 str. 498 / 502 / 506 / 142); Garant šedá / antracitová, Variant+ obě barvy a Praktik šedá si nechaly id barvy (uložené nákresy si barvu ponechají), hnědá a béžová zmizely (uložená barva přejde na bílou). Decento bílá / černý dub bez kódu barvy (zadání ho neuvádí). Barva rámečku se u monobloků a Decenta nevolí v kroku 2, v galerii ani v detailu prvku a do popisu vzhledu ani kusovníku se nepromítne (`hasFrameChoice`). Kusovník monobloku: kompletní nástěnný přístroj s víčkem, bez rámečku, krytu a krabice pod omítku.
- **Okna, dveře a nábytek:** zařizovací předměty se zónou „none“ (`FIXTURES` ve `fixtures.ts`) – stejný mechanismus rozměru, žlutého rohu, posuvných hran a natočení jako vana; meze 0,1–8 m; kresba jen v `architecture.ts` (`archDrawing`) pro plátno, tisk PDF i DXF (vrstva `ARCHITEKTURA_NABYTEK`); okna a posuvné dveře sedí středem na stěně, dveře zárubní na stěně a křídlem do místnosti (`snapOpening`, 0,6 m, při vložení i přesunu, Alt = volně); levé / pravé otevírání dveří, směr posuvu posuvných dveří a zrcadlení L-gauče, linky a HS portálu (`flip`). Na plátně se kreslí pod značkami (klik na zásuvku u postele vybere zásuvku), v legendě značek tiskového listu nejsou, okruhy ani kusovník nevytváří. WC je v obou kategoriích palety.
- **Koupelna:** zóny 1 a 2 do 2,25 m (`BATH_ZONE_TOP_MM`); čidla na binární vstup (okenní kontakt MAG, čidlo vody) a termostatické hlavice nejsou spínače 230 V; vývod motoru žaluzie se nehlídal nikdy (není zásuvka ani spínač) a výšku 2,45 m má nad zónami. Hláška jmenuje přístroj, výšku a vzdálenost (u více přístrojů výčet). Zóny se na plátně i v tisku ořežou obrysem místnosti předmětu (`clipPath`), v DXF `clipToPolygon`. Umyvadlo: tyrkysově čárkovaný pás + 0,2 m, oranžově tečkovaně doporučených 0,4 m a popisek UMYVADLOVÝ PROSTOR vždy (ne jen u vybraného); pás 0,2 m pod 1,2 m hlídá podle zadání jen přístroje bez krytí IP44 (dřív i IP44), umyvadlový prostor (průmět) všechny.
