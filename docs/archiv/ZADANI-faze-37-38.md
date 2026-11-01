> **Zadání fází 37 a 38 (2026-11-01)** – plné znění tak, jak bylo vloženo do `docs/PLAN.md`. Fáze 37 = AI Panel Builder (body 1–5 první části), fáze 38 = Studio výstavby závodu (body 1–5 druhé části).

Na základě testování na reálné fotce rozváděče ABB (PB-004) musíme zásadně opravit 6 věcí v AI Panel Builderu: čitelnost selectů v dark mode, přesnost OCR (zejména B vs. C, 10/13/16A a odpínače SHD203), zarovnání rámečků na fotce, zadávání funkce obvodu v Kroku 1, správné značení přístrojů (-Q, -FI, -FA, -F) a kompletně přepracovat nepochopitelný Krok 2 (Hierarchický strom).

Zapiš tyto úpravy do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. GLOBÁLNÍ OPRAVA NEČITELNÝCH ROZBALOVACÍCH MENU (<select> / <option>):
- V "src/app/globals.css" nastav globálně "color-scheme: dark;" na ":root" a "html", a přidej explicitní stylování pro všechny nativní "<select>", "<option>" a "<optgroup>" (background-color: #18181b; color: #f4f4f5;), aby rozbalené menu na Windows nikdy nemělo světlý nečitelný text na bílém pozadí.

2. ZPŘESNĚNÍ OCR ANALÝZY FOTEK A KATALOGU ABB (SH200 / SHD200 / FH200 / 13A):
- Rozšiř katalog v seedu o kompletní řady ABB Compact Home:
  - Odpínače "SHD203/25", "SHD203/40", "SHD203/63", "SHD204/40" a "SD203/25" (kategorie MAIN_SWITCH, šířka 3M/4M).
  - Jističe "SH201" a "SH203" v charakteristikách B i C pro proudy 6A, 10A, 13A (!), 16A, 20A, 25A, 32A.
  - Chrániče "FH202" a "FH204" (AC i A, 25A, 40A, 63A / 30mA).
- V "src/server/services/geminiPanelService.ts" zásadně zpřesni systémový prompt pro čtení lišty:
  a) ČERVENÁ PÁČKA (Red toggle): Pokud má 3M nebo 4M přístroj červenou ovládací páčku a nemá testovací tlačítko T (např. ABB SHD203/25, SD203/40), jde VŽDY o hlavní vypínač / odpínač (category: "MAIN_SWITCH"), NIKDY o jistič! Číslo za lomítkem "/25" nebo "/40" je jmenovitý proud 25A / 40A, nikoliv charakteristika C25!
  b) CHARAKTERISTIKA B vs. C: Explicitně přikaž modelu, aby si dal pozor na záměnu písmen B a C u jističů. V domovních a plastových rozváděčích (řady SH201, S201, PL6, PL7, LTN, MBN) je drtivá většina jističů charakteristiky "B" (B10, B13, B16). Pokud není na přístroji zcela zřetelně vytištěno "C16" nebo "C10", upřednostni "B"! Pozorně rozlišuj hodnoty "B10", "B13" a "B16" vytištěné přímo pod červeným proužkem ABB.
  c) VÝŘEZ LIŠTY: Posílej výřez lišty do Gemini v plném rozlišení (PNG nebo JPEG kvalita 95 %, bez zmenšování šířky), aby drobný potisk "B10 / B13 / B16" zůstal ostrý.

3. PŘESNÉ KOPÍROVÁNÍ PODKLADU RÁMEČKY NA FOTCE + RUČNÍ ÚPRAVA RÁMEČKU MYŠÍ:
- V promptu pro detekci lišt a modulů striktně vyžaduj, aby souřadnice [ymin, xmin, ymax, xmax] obepínaly POUZE skutečná plastová těla osazených přístrojů (nikoliv prázdnou kovovou DIN lištu a kabely napravo od posledního jističe!).
- Při přepočtu nebo skládání modulů na liště nesmí systém roztahovat moduly na 100 % šířky DIN lišty, pokud je lišta zaplněná jen částečně (např. 10M z 12M).
- Přímo na fotce rozváděče v Kroku 1 umožni u právě vybraného (žlutého) rámečku chytit myší jeho levý/pravý okraj nebo celý rámeček a jemně ho posunout/upravit, aby technik mohl rámeček za 1 vteřinu srovnat přesně na hrany přístroje na fotce.

4. DOPLNĚNÍ FUNKCE OBVODU HNED V KROKU 1 + SPRÁVNÉ IEC ZNAČENÍ PŘÍSTROJŮ (-Q, -FI, -FA, -F):
- V pravém panelu "Konfigurátor prvku" (Krok 1) přesuň pole "Funkce / Popis obvodu" (circuitLabel) úplně nahoru hned pod hlavičku prvku (-Q1 / -FI1 / -F1).
- Hned pod toto pole přidej 1-klikové rychlé štítky (chips) pro bleskové vyplnění funkce:
  [Hlavní vypínač] [Chránič 1] [Chránič 2] [Světla] [Zásuvky] [Kuchyně] [Koupelna] [Varná deska] [Trouba] [Myčka / Pračka] [Bojler / TČ] [Topení] [Venek / Garáž].
- Zadaný popis obvodu zobrazuj čitelně přímo na dlaždici modulu na DIN liště pod fotkou!
- Uprav automatické IEC značení ("autoNumberDesignations" i prvotní detekci), aby používalo jasné prefixy podle kategorie:
  - Odpínač / Hlavní vypínač (MAIN_SWITCH): "-Q1", "-Q2"...
  - Proudový chránič (RCD): "-FI1", "-FI2"...
  - Jističochránič (RCBO): "-FA1", "-FA2"...
  - Svodič přepětí (SPD): "-FV1", "-FV2"...
  - Jistič (MCB): "-F1", "-F2"...
  - Stykač (CONTACTOR): "-K1", "-K2"...
  - Relé (RELAY): "-KA1", "-KA2"...
  - Zdroj / Měření / Jiné: "-T1" / "-U1" / "-X1".
  Umožni také v hlavičce Konfigurátoru prvku značení (např. "-FI1") ručně přepsat.

5. KOMPLETNÍ PŘEPRACOVÁNÍ KROKU 2 ("2. Zapojení a hierarchie" – /panel-builder/[id]/tree):
Současný Krok 2 je pro uživatele nepochopitelný a generuje falešné chyby. Přepracuj algoritmus i celé UI Kroku 2:
a) Opravený algoritmus "AI návrh zapojení na 1 klik" (Pravidlo DIN lišty a hřebenové propojky):
   - Hlavní vypínač (-Q1) je kořenem rozváděče (napájen ze Vstupu napájení, fáze vždy "L1,L2,L3,N" u 3P/4P).
   - Každý 4P nebo 3P+N proudový chránič (-FI1, -FI2...) je napájen z hlavního vypínače (-Q1) a má VŽDY nastavené fáze "L1,L2,L3,N" (NIKDY mu nenastavuj jen jednu fázi L1/L2/L3!). 2P chránič má "L1,N" (příp. L2/L3).
   - Pravidlo DIN lišty: Pokud na dané DIN liště leží proudový chránič (-FIx), pak VŠECHNY jističe (MCB) umístěné napravo od tohoto chrániče na STEJNÉ DIN liště automaticky zapoj POD tento chránič (-FIx)!
   - Všechny jističe, 3P jističe, jističochrániče (-FAx) a přepěťovky (-FVx), které jsou na liště bez proudového chrániče (např. na Liště 1 vedle hlavního vypínače -Q1) nebo leží nalevo od chrániče, zapoj PŘÍMO pod hlavní vypínač (-Q1)!
   - Jednofázovým jističům ve skupině automaticky střídej fáze L1 -> L2 -> L3 -> L1...
b) Zrušení falešné chyby přetížení vypínače/chrániče v hlídači (Guardrails):
   - Součet jmenovitých proudů jističů (Σ In) v rozváděči běžně převyšuje jmenovitý proud hlavního vypínače (-Q1, např. 25A nebo 40A) nebo chrániče (40A). Zruš červenou chybu "Součet výpočtových proudů přetěžuje -Q1"! Místo chyby zobrazuj u skupiny jen čistou informaci o zatížení se započtením koeficientu soudobosti. Skutečnou červenou chybou zůstává pouze: nezapojený prvek, cyklus, nebo 3P jistič pověšený pod 1P uzel.
c) Nové, intuitivní UI Kroku 2 – "Skupinové karty podle DIN lišt a chráničů":
   - Místo nepřehledného stromu s desítkami roletek vykresli Krok 2 jako vizuální SKUPINOVÉ KARTY:
     * Karta 1: "⚡ Hlavní přívod a přímé vývody (pod hlavním vypínačem -Q1)" – zobrazuje hlavní vypínač -Q1 a pod ním všechny přímo napájené přístroje (3P jističe, jističochrániče -FA1, -FA2, přepěťovky).
     * Karta 2: "🛡️ Skupina Chrániče -FI1 (Lišta 2 – např. FH204 40A/30mA)" – hlavička karty je samotný chránič a uvnitř karty jsou přehledně vypsané všechny jističe na této liště, které chránič jistí.
     * Karta 3: "🛡️ Skupina Chrániče -FI2 (Lišta 3 – např. F204 40A/30mA)" – hlavička druhého chrániče a pod ním jeho jističe.
   - Přímo na řádku každého jističe nahraď rozbalovací menu fáze přímými klikacími tlačítky (pills):
     * Pro 1P / 1P+N přístroje: [ L1 ] [ L2 ] [ L3 ] (klik okamžitě přepne fázi).
     * Pro 3P / 4P přístroje: pevný štítek [ L1, L2, L3 ].
   - Pro přesun jističe do jiné skupiny dej na řádek přehledný přepínač skupiny: "Napájeno z: [ -Q1 Hlavní ] [ -FI1 Chránič (Lišta 2) ] [ -FI2 Chránič (Lišta 3) ]".

Na základě testování modulu "Studio výstavby závodu" (/studio) musíme opravit 6 zásadních věcí v ergonomii a logice všech 3 kroků. Zapiš to do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:

1. ZRUŠENÍ LIMITU 114×90 M A ZJEDNODUŠENÍ VELIKOSTI BUDOVY (Krok 1):
- Zruš tvrdé omezení počtu os (max 20 × 16), které teď blokuje zvětšení budovy na 114 × 90 m!
- Hlavním vstupem pro velikost budovy musí být přímo rozměr v metrech:
  - "Šířka budovy – osa X [m]" (rozsah 6 m až do plné šířky areálu, např. 1000 m)
  - "Hloubka budovy – osa Y [m]" (rozsah 6 m až do plné hloubky areálu, např. 600 m)
- Při tažení za žlutý roh budovy na mapě areálu umožni budovu plynule zvětšovat až do rozměrů celého areálu (s krokem po 1 m nebo po rozteči sloupů).
- Sekci "Konstrukční rastr" v levém panelu maximálně zjednoduš a schovej do rozbalovacího detailu "Pokročilé: Rozteč nosných sloupů (výchozí 6 m / 12 m)" – počet sloupových os (1..N, A..Z, AA..ZZ) nech dopocítávat plně automaticky na pozadí z šířky a hloubky budovy v metrech, aby rastr uživatele vůbec neomezoval.

2. TVORBA A SPRÁVA VÍCE BUDOV V AREÁLU NAJEDNOU (Krok 1):
- Umožni v rámci jednoho průchodu Studiem (jak v novém závodě, tak ve stávajícím) vytvořit a spravovat VÍCE budov najednou.
- V levém panelu i nad mapou zobraz přepínač budov v konceptu: např. "[ 🏭 Hala A (114×90 m) ] [ ⚡ Energetika (24×18 m) ] [ ➕ Přidat další budovu ]".
- Kliknutím na "+ Přidat další budovu" (nebo kliknutím na šablonu budovy nahoře) se první budova uloží do seznamu budov na mapě areálu a vytvoří se další budova, se kterou může uživatel na mapě nezávisle hýbat, měnit její velikost a v Krocích 2 a 3 jí kreslit místnosti a osazovat zařízení. Kliknutím na libovolnou budovu v mapě areálu se tato budova stane aktivní pro úpravy.

3. EDITOVATELNÉ NÁZVY STÁVAJÍCÍCH PODLAŽÍ (Krok 1 – Upravit existující budovu):
- V režimu "Upravit existující budovu" jsou teď názvy již existujících pater (např. "1. NP Hlavní výroba", "2. NP Vzduchotechnika") zobrazené jen jako neaktivní šedý text se štítkem "stávající".
- Změň všechna stávající podlaží na plnohodnotná editovatelná vstupní pole (<input>), aby šel název/využití jakéhokoliv existujícího patra okamžitě přepsat a při uložení Studia se změna propsala do databáze (prisma.floor.update).

4. ODSTRANĚNÍ "ROZDĚLIT PATRO ŠABLONOU" A PŘIDÁNÍ HISTORIE ZPĚT / VPŘED (Krok 2):
- V Kroku 2 ("Místnosti, zóny a vrata") ÚPLNĚ ODSTRAŇ sekci "Rozdělit patro šablonou" (tlačítka "2 výrobní linky + sklad", "Rozvodna + zázemí", "Kanceláře podél chodby"), protože nechtěným kliknutím maže ručně nakreslené místnosti.
- Přidej do Kroku 2 (a stejně tak do Kroku 3) plnohodnotnou historii kroků (Undo / Redo stack pro posledních 30 akcí):
  - Výrazná tlačítka "[ ↩ Zpět (Ctrl+Z) ]" a "[ ↪ Vpřed (Ctrl+Y) ]" v horní liště nad půdorysem i v levém panelu.
  - Každé nakreslení místnosti, posunutí stěny, smazání místnosti nebo vložení vrat jde jedním klikem (nebo klávesou Ctrl+Z) vrátit zpět.

5. KOMPLETNÍ PŘEPRACOVÁNÍ KROKU 3 ("Zařízení a napájení") – AUTOMATICKÉ ROZBALOVACÍ MENU PODLE MÍSTNOSTI A KONKRÉTNÍ BANERY STROJŮ/NÁŘADÍ:
Přepracuj levý panel a interakci s půdorysem v Kroku 3 na čistý, kontextově rozbalovací (accordion) workflow:

a) Sekce 1 – VÝBĚR MÍSTNOSTI / ZÓNY (otevřená jako první):
   - Uživatel klikne přímo v půdorysu na místnost (např. "Lisovací linka 1" nebo "Expedice výlisků") NEBO ji vybere ze seznamu vlevo.
   - Vybraná místnost se v půdorysu jasně zvýrazní a v levém panelu se automaticky rozbalí Sekce 2 pro tuto místnost.

b) Sekce 2 – VÝBĚR KATEGORIE ZAŘÍZENÍ + AUTOMATICKÉ FILTROVÁNÍ PŮDORYSU:
   - Zobraz přehledné barevné banery kategorií (Transformátor, Rozváděč, Výrobní stroj / Linka, Robotické pracoviště, Technologie budov, Spotřebič, Ruční nářadí).
   - U každého baneru zobraz počet kusů této kategorie v právě vybrané místnosti.
   - DŮLEŽITÉ: Jakmile uživatel klikne na kategorii (např. "Výrobní stroj / Linka" nebo "Ruční nářadí"), na půdorysu i v seznamu se VYFILTRUJÍ A ZVÝRAZNÍ POUZE zařízení spadající do tohoto typu (ostatní typy se v půdorysu ztlumí na 20 % opacity, s tlačítkem "Zobrazit vše").
   - Po výběru kategorie se automaticky rozbalí Sekce 3.

c) Sekce 3 – PŘEPÍNAČ "[ ➕ Vytvořit nové ]" vs. "[ ✏️ Upravit stávající (N) ]":
   - Režim "✏️ Upravit stávající":
     * Vypíše pouze existující zařízení zvoleného typu v této místnosti. Kliknutím na položku (nebo na její značku v půdorysu) může uživatel okamžitě upravit její Tag, Název, Nadřazený rozváděč, Vývod nebo ji přesunout/smazat.
   - Režim "➕ Vytvořit nové" – KONKRÉTNÍ PRODUKTOVÉ BANERY (ŠABLONY):
     * Místo obecného vkládání zobraz klikací dlaždice/banery konkrétních přístrojů podle vybrané kategorie:
       - Pro "Ruční nářadí": [ 🔩 Vrtačka / Aku šroubovák ] [ ⚙️ Úhlová bruska ] [ 🔨 Vrtací / Bourací kladivo ] [ 🔥 Horkovzdušná pistole ] [ ⚡ Svářečka ] [ 📏 Měřicí přístroj ]
       - Pro "Spotřebič": [ 🧹 Průmyslový vysavač ] [ ☕ Kávovar / Rychlovarná konvice ] [ 🧊 Chladnička / Mikrovlnka ] [ 🖥️ PC sestava / Tiskárna ] [ 🔌 Prodlužovací přívod / Buben ]
       - Pro "Výrobní stroj / Linka": [ 🏭 Lisovací linka ] [ ⚙️ CNC obráběcí centrum ] [ 🔧 Soustruh / Frézka ] [ 📦 Montážní / Balicí linka ] [ 🏗️ Jeřáb / Zdvihadlo ]
       - Pro "Robotické pracoviště": [ 🤖 Svařovací robot ] [ 🦾 Manipulační robotická buňka ] [ 👁️ Kamerové / Kontrolní pracoviště ]
       - Pro "Technologie / VZT": [ 🌀 Vzduchotechnická jednotka (VZT) ] [ 💨 Kompresorová stanice ] [ ❄️ Chlazení / Tepelné čerpadlo ] [ 🚨 Nouzové osvětlení / Hromosvod ]
       - Pro "Rozváděč": [ ⚡ Hlavní rozváděč (RH) ] [ 🔌 Podružný / Patrový rozváděč (RP) ] [ 🤖 Rozváděč stroje / linky (RM) ]
       - Vždy přidej i dlaždici: [ 🏷️ Vlastní zařízení / Vytvořit nový Tag ]
     * Kliknutím na konkrétní baner (např. "Vrtačka", "Bruska", "Vysavač" nebo "Lisovací linka") autopilot okamžitě vygeneruje odpovídající Tag a přesný český název (např. "Úhlová bruska – Dílna údržby"), nabídne editovatelné pole pro "Vlastní Tag" (s tlačítkem pro vlastní prefix) a umožní zařízení jedním klikem vložit do místnosti nebo do jemného rastru.

Po implementaci spusť "npm run verify", aktualizuj testy Studia v "e2e/accounts-studio.spec.ts", udělej commit a vypiš příkazy pro push a deploy.
