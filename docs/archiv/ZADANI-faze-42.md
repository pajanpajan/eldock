# Zadání fáze 42 (vloženo 2026-11-03 do sekce B plánu)

Zásadně přepracujeme UX a architekturu AI Panel Builderu (/panel-builder/[id]). Opouštíme nepřesné vykreslování zelených/žlutých bounding boxů přes fotku rozváděče a nefunkční tabulkový Krok 2. Místo toho zavedeme přímý převod do standardizované 2D vektorové grafiky (mechanické symboly s živými modrými spojnicemi) a interaktivní Drag & Drop tvorbu hierarchie přímo na vektorovém rozváděči.
Zapiš tuto změnu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:
1. KONEC BOUNDING BOXŮ NA FOTCE -> ČISTÁ REFERENČNÍ FOTKA + 2D VEKTOROVÉ PLÁTNO:
- Na fotce rozváděče (vlevo) ZCELA VYPNI vykreslování zelených, žlutých a červených obdélníčků (bounding boxů). Fotka slouží pouze jako čistá, ostrá referenční předloha s možností přiblížení (zoom/pan), aby z ní technik mohl pohodlně číst bez rušivých čar.
- Hlavní pracovní plochou je "2D Vektorový rozváděč (Interactive Vector CAD)" – čisté grafické zobrazení DIN lišt a přístrojů, které má přepínatelný režim zobrazení:
  * "Tmavý editor (CAD Dark)" a "Výkres osazení (Černobílý CAD s modrými spojnicemi jako ve výkresu dokumentace)".

2. STANDARDIZOVANÉ MECHANICKÉ VEKTOROVÉ SYMBOLY (SVG KOMPONENTY):
Vytvoř v "src/components/panel-builder/VectorModuleSymbol.tsx" sadu pevných, graficky čistých mechanických vektorových symbolů pro každou kategorii a počet pólů (šířka v poměru modulů 1M, 2M, 3M, 4M):
- Každý symbol má nahoře a dole pás se šroubovými svorkami (kroužky šroubků: 1M = 1 šroubek nahoře/dole, 2M = 2, 3M = 3, 4M = 4).
- Střední část se mechanicky liší podle kategorie:
  * 1P Jistič (MCB 1M): 1 černá ovládací páčka.
  * 3P Jistič (MCB 3M): 3 páčky spojené společnou vodorovnou hrazdičkou.
  * Odpínač / Hlavní vypínač (MAIN_SWITCH 3M/4M): spojená ČERVENÁ páčka bez nadproudové spouště.
  * Proudový chránič (RCD 2M/4M): ovládací páčka + zřetelné testovací tlačítko "[ T ]" a okénko indikace.
  * Jističochránič (RCBO 1M/2M): páčka + modré/bílé testovací tlačítko "[ T ]".
  * Svodič přepětí (SPD 2M/3M/4M): vyjímatelné kazety s terčíky stavu (zelená) a symbolem blesku/uzemnění.
  * Stykač / Relé / Zdroj: odpovídající mechanická silueta s cívkou/kontakty.
- DYNAMICKÁ TEXTOVÁ POLE UVNITŘ KAŽDÉHO VEKTOROVÉHO SYMBOLU:
  1) Vlevo pod horními šroubky: Tučné IEC značení (např. "-Q1", "-FV1", "-FI1", "-FA1", "-F1").
  2) V těle přístroje: Výrobce + klíčová hodnota a typ z databáze:
     - U jističe např.: "ABB" a výrazně "B16" (pod tím drobně "S201-B16").
     - U chrániče např.: "ABB" a "FH204 AC 25A 0,03A".
     - U odpínače např.: "ABB · SD203/40 (40A)".
  3) Ve spodním štítku přístroje: Popis funkce/obvodu (např. "Světla", "Zásuvky", "Kuchyně") – editovatelný přímo dvojklikem nebo v pravém panelu.

3. NAPOJENÍ NA ROZŠÍŘENOU DATABÁZI PRVKŮ (CatalogComponent):
- Propoj AI analyzátor, konfigurátor i vektorové symboly s kompletní databází "CatalogComponent":
  * Při analýze fotky páruj detekované přístroje primárně proti "CatalogComponent" (podle výrobce, kategorie, pólů, jmenovitého proudu In, charakteristiky B/C/D nebo parametrů chrániče AC/A a mA).
  * V pravém konfigurátoru přidej rychlé našeptávací vyhledávání přímo z databáze prvků + okamžité filtrování podle dlaždic (Výrobce -> Kategorie -> Póly -> Hodnoty). Jakmile uživatel vybere parametry nebo kus z databáze, okamžitě se přepíše dynamický text ve vektorovém symbolu, aktualizuje se ztrátový výkon (Pv ve Wattech) a objednací číslo.
  * Pokud uživatel zadá nový typ, který v databázi není, po dohledání přes Gemini ho automaticky ulož (upsert) do "CatalogComponent", aby se databáze sama učila.
4. NOVÉ INTUITIVNÍ NASTAVENÍ HIERARCHIE A ZAPOJENÍ (PŘÍVOD + DRAG & DROP MEZI PRVKY):
Oprav a kompletně přepracuj tvorbu hierarchie (sjednoť ji s vektorovým pohledem na DIN lišty, aby uživatel pracoval přímo nad grafickým rozváděčem a nikoliv v nepřehledné textové tabulce s 37 chybami):
a) Volba hlavního přívodu a kořenového prvku (Root):
   - Nad vektorovým rozváděčem zobraz lištu "Hlavní přívod rozváděče":
     1. Přepínač směru přívodu: "[ ⬇ Přívod SHORA ]" vs. "[ ⬆ Přívod ZESPODA ]".
     2. Výběr prvního (kořenového) prvku, do kterého je napojen hlavní přívod: Tlačítko "[ 🎯 Určit hlavní vstupní prvek ]" (nebo roletka ze všech 3P/4P prvků v rozváděči).
     3. DŮLEŽITÉ: Hlavním vstupním prvkem může být JAKÝKOLIV přístroj (Odpínač -Q1, ale klidně i 3f jistič -F1, pokud rozváděč nemá samostatný odpínač, nebo hlavní chránič -FI1)! Jakmile je určen, vykreslí se do něj hlavní přívodní čára se šipkou (shora nebo zespoda).
b) Drag & Drop zapojování přímo na vektorovém rozváděči:
   - Uživatel může v režimu "Zapojení a hierarchie" chytit myší libovolný přístroj (nebo označit skupinu přístrojů / celou DIN lištu) a PŘETÁHNOUT (Drag & Drop) ho na přístroj, ze kterého je napájen!
   - Pravidla inteligentního řazení při přetažení (Drop):
     * Přetažení Přepěťovky (-FV1) na Hlavní prvek (-Q1 / -F1): Přepěťovka se zapojí přímo pod hlavní prvek (`parentId = Q1.id`).
     * Přetažení Chrániče (-FI1) na Přepěťovku (-FV1) nebo na Hlavní prvek (-Q1): Chránič se zapojí za tento prvek jako nadřazený skupinový uzel (a pokud je přetažen na přepěťovku, vytvoří průchozí napájecí uzel v hlavní větvi).
     * Přetažení Jističů (-F2, -F3, -F4...) na Chránič (-FI1) nebo na Hlavní prvek (-Q1): Kdykoliv uživatel přetáhne jeden nebo více jističů na Chránič (nebo dokonce přetáhne jistič na jiný jistič, který už pod tímto chráničem je), VŠECHNY tyto jističe se zařadí HIERARCHICKY VEDLE SEBE (paralelně jako sourozenci se stejným `parentId = FI1.id`), NIKDY za sebe do série! Automaticky se jim přitom střídají fáze L1, L2, L3.
   - Rychlá pomocná tlačítka (pro rozváděče s 30+ jističi):
     * U každého chrániče (-FI1, -FI2) přímo na liště zobraz tlačítko "[ 🔗 Připojit jističe vpravo na této liště ]", které jedním klikem naváže všechny jističe na dané DIN liště napravo od chrániče pod tento chránič.
     * Opravené tlačítko "[ ⚡ AI návrh zapojení na 1 klik ]": Pokud v rozváděči není odpínač -Q1, automaticky vezme jako kořenový vstupní prvek první 3P/4P přístroj na 1. liště (např. -F1 S203-C25 nebo první chránič), takže strom zapojení VŽDY zafunguje na 100 % a nikdy neskončí s 0/37 zapojenými prvky!
c) Živé vykreslování modrých spojnic (jako v CAD výkresu):
   - Přímo mezi vektorovými DIN lištami vykresluj v reálném čase modré napájecí čáry a hřebenové lišty (přesně ve stylu přiloženého vzoru: přívodní šipka -> hlavní prvek -> propojky na SPD a chrániče -> vodorovná modrá hřebenová sběrnice nad/pod jističi dané skupiny). Uživatel tak okamžitě vizuálně vidí, co je s čím spojené!
Ověř vše přes "npm run verify", aktualizuj testy a vypiš příkazy pro push a deploy na server.
