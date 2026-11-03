Přidáváme do AI Panel Builderu klíčovou funkci "Projektování nového rozváděče bez fotky (CAD návrh od nuly)", kaskádový výběr výrobce a součástek s Drag & Drop osazováním, chytré filtrování skříní rozváděčů podle velikosti, nahrání razítka a loga firmy do profilu a tisk samolepicích popisků rozváděče v měřítku 1:1. Zároveň napojíme katalog na naši externí databázi prvků z "C:\Users\janou\Desktop\Claude\ai-panel-builder".

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj v těchto 6 bodech:

1. NOVÝ REŽIM "NAVRHNOUT ROZVÁDĚČ BEZ FOTKY (OD NULY)" A DYNAMICKÉ DIN LIŠTY:
- V modalu "Nový projekt rozváděče" (/panel-builder) přidej na začátek výrazný přepínač 2 režimů:
  a) "[ 📐 Navrhnout nový rozváděč od nuly (bez fotky) ]" (výchozí pro projekci)
  b) "[ 📷 Pasportizovat rozváděč z fotky (AI Vision) ]"
- Při volbě "Navrhnout od nuly" se projekt založí rovnou s 1 DIN lištou na 12 modulů (1× 12M) a otevře čisté 2D vektorové pracovní plátno (bez levého boxu s fotkou, takže 2D vektorový rozváděč má dostatek prostoru).
- Přímo u každé DIN lišty na plátně přidej ovládání její kapacity:
  * Rychlé presety šířky řady podle standardních rozvodnic: [ 8M ] [ 12M ] [ 14M (12+2) ] [ 18M ] [ 24M ] [ 36M ] + tlačítka "[ − ]" a "[ + ]" pro změnu po 1 modulu.
  * Tlačítko "[ ➕ Přidat další DIN lištu (řadu) ]" pod lištami (umožní přidat 2., 3., 4., 5., 6. řadu) a možnost lištu smazat nebo změnit pořadí lišt šipkami nahoru/dolů.
  * Nahoře nad lištami zobraz živý indikátor: "Konfigurace: {počet} DIN lišt × {moduly} M · Obsazeno: {obsazeno} / {celkem} M ({procenta} % · volná rezerva {rezerva} %)".

2. KASKÁDOVÉ PRAVÉ MENU: LOGA VÝROBCŮ -> KATEGORIE -> PARAMETRY -> DRAG & DROP SOUČÁSTKA:
Přepracuj pravý panel v "/panel-builder/[id]" tak, aby fungoval pro vkládání nových součástek i úpravu stávajících přesně v tomto sledu:
- KROK A (Výběr výrobce přístroje):
  * Zobraz vyhledávací pole "🔍 Hledat výrobce podle názvu..." a pod ním přehlednou mřížku karet s logy/odznaky výrobců z naší databáze (ABB, Eaton, OEZ, Schneider Electric, Hager, Noark, Bonega, Schrack, Siemens, ETI, SEZ, Saltek, Hakel, Dehn, Elko EP, Finder, Relpol, Loxone, Shelly, Eastron, Wago, Phoenix Contact, Weidmüller, Pollmann, Mean Well, Pilz, Omron).
  * JAKMILE uživatel klikne na jednoho výrobce (např. ABB), všechny ostatní karty výrobců ZMIZÍ a zůstane jen kompaktní lišta vybraného výrobce: "[ 🟥 ABB ]" + tlačítko "[ 🔄 Vybrat jiného výrobce ]".
  * Po kliknutí na "[ 🔄 Vybrat jiného výrobce ]" se opět rozbalí celé menu všech výrobců s vyhledáváním, dokud uživatel nevybere jiného.
- KROK B (Výběr kategorie – zobrazí se po výběru výrobce):
  * Zobraz dlaždice kategorií: [ Jistič ] [ Chránič ] [ Jističochránič ] [ Odpínač / Vypínač ] [ SPD (Přepěťovka) ] [ Stykač ] [ Relé ] [ Zdroj / Měření / Jiné ] + [ Svorky / Hřebeny / Příslušenství ].
- KROK C (Dynamické parametry podle kategorie):
  * Po kliknutí na kategorii zobraz odpovídající řádky dlaždic parametrů (Póly & Šířka vč. 0,5M / 1M / 2M / 3M / 4M, Charakteristika B/C/D/K/Z, Typ chrániče AC/A/F/B, Citlivost 10/30/100/300 mA, Jmenovitý proud In, Zkratová odolnost kA, Cívka stykače/relé, Třída SPD).
- KROK D (Živá finální součástka + Vícenásobné Drag & Drop přetahování na DIN lištu):
  * Dole pod parametry vykresli kartu "PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ", která se v reálném čase mění při každém kliknutí na parametr.
  * Karta obsahuje živý 2D vektorový náhled součástky (v přesném počtu modulů, s páčkou, šroubky a nápisem např. "ABB B16"), přesný typ a MPN z databáze, šířku v modulech, ztrátový výkon ve W a pole pro popis obvodu.
  * DRAG & DROP NA LIŠTU: Uživatel může tuto finální součástku chytit myší a PŘETÁHNOUT ji na libovolnou DIN lištu (i opakovaně vícekrát za sebou!). Přidej k ní také rychlá tlačítka "[ ➕ Vložit na aktivní lištu (1×) ]", "[ +3× ]" a "[ +6× ]", aby šlo osadit řadu jističů během pár vteřin.

3. CHYTRÝ VÝBĚR SKŘÍNĚ ROZVÁDĚČE (FILTROVÁNÍ PODLE VELIKOSTI AŽ PO VOLBĚ VÝROBCE):
- Vytvoř samostatnou sekci / modal "🗄️ Výběr skříně rozváděče (Rozvodnice)" (dostupný v Kroku 1 i v Kroku 3 Oteplení):
  * Nejprve uživatel zvolí VÝROBCE SKŘÍNĚ z karet s logy: [ ABB ] [ EATON ] [ HAGER ] [ OEZ ] [ NOARK ] [ SCHRACK ] [ HENSEL ] [ RITTAL ] (a volitelně montáž: Vše / Pod omítku / Na omítku / Krytí IP).
  * DŮLEŽITÉ PRAVIDLO: Dokud není zvolen výrobce skříně, seznam rozváděčů nezobrazuj!
  * Jakmile uživatel vybere výrobce (např. ABB nebo Eaton), vyfiltruj a zobraz POUZE ty skříně daného výrobce, které VYHOVUJÍ aktuální velikosti navrženého rozváděče:
    - `skrin.rows >= aktualniPocetDinList`
    - `skrin.modulesPerRow >= maxModuluNaListe`
    - `skrin.totalModules >= celkemObsazenoModulu`
  * U každé vyhovující skříně (např. ABB Mistral41W 36M 3×12, ABB UK600 36M 3×12/14, Eaton KLV-36UPS-F 3×12/14, Hager Volta VU36NC, Hensel KV 9336, Rittal AX) zobraz její přesné rozměry V×Š×H [mm], krytí IP, maximální ztrátový výkon skříně P_max [W] a kolik % volné rezervy v ní zůstane. Kliknutím na skříň se její rozměry, model a P_max automaticky propíšou do projektu a výpočtu oteplení.

4. RAZÍTKO A LOGO V PROFILU FIRMY -> AUTOMATICKÝ PROPIS DO DOKUMENTACE:
- Rozšiř model "RegisteredCompany" (a nastavení firmy "/panel-builder/profile" resp. modal "Firemní údaje a razítko") o dva grafické vstupy:
  * `logoUrl String?` – Firemní logo (PNG / SVG / JPG).
  * `stampUrl String?` – Otisk razítka a podpisu projektanta / revizního technika (PNG/JPG s automatickým vyčištěním bílého pozadí na průhledné přes HTML5 Canvas při nahrání, aby razítko na čáře podpisu vypadalo jako skutečný modrý/černý otisk!).
- Automaticky propisuj nahrané `logoUrl` a `stampUrl` do všech výstupů v Kroku 4 ("Výstupní dokumentace a PDF export"):
  * `logoUrl`: Vykresli na Titulní straně (List 1), v rohovém razítku výkresů (Listy 1–6) a na Výrobním štítku CE.
  * `stampUrl`: Vykresli přímo do pole "Podpis a razítko odpovědné osoby výrobce" na Listu 6 (ES Prohlášení o shodě) a u protokolu kusové zkoušky.

5. EXPORT A TISK SAMOLEPICÍCH POPISKŮ ROZVÁDĚČE (MĚŘÍTKO 1:1):
- V detailu projektu (v horní liště i v Kroku 4 Dokumentace) přidej záložku / tlačítko "🏷️ Tisk popisků a štítků (1:1)":
  * Vygeneruj tiskovou A4 sestavu (`@media print` bez okrajů prohlížeče, s kontrolním kalibračním měřítkem "100 mm = 10 cm" pro ověření 100% tisku bez přizpůsobení stránce):
    1) SOUVISLÉ POPISOVACÍ PÁSY NAD/POD DIN LIŠTY: Pro každou DIN lištu (Lišta 1, Lišta 2...) vykresli souvislý samolepicí proužek v přesné fyzické šířce modulů (`1 modul = 17,5 mm` nebo přepínatelně `18,0 mm`, volitelná výška pásu `9 mm / 12 mm / 15 mm`). Každé políčko odpovídá šířce přístroje (1M = 17,5 mm, 3M = 52,5 mm, 4M = 70 mm), má barevný proužek podle fáze/skupiny, tučné označení (`-Q1`, `-FI1`, `-F1`), český název obvodu (`Zásuvky kuchyně`) a hodnotu (`B16`).
    2) JEDNOTLIVÉ ŠTÍTKY NA PŘÍSTROJE: Mřížka malých štítků (17 × 9 mm) s označením `-Q1`, `-FI1`, `-FA1`, `-F1`... k nalepení přímo na těla jističů.
    3) Možnost exportovat popisky také do CSV/XLSX pro štítkovačky Brother P-Touch / Dymo.

6. MOST PRO NAPOJENÍ NA PARALELNÍ DATABÁZI ("C:\Users\janou\Desktop\Claude\ai-panel-builder"):
- Vytvoř v Eldocku synchronizační a importní skript `scripts/sync-external-catalog.ts` (spouštěný přes `npm run catalog:sync`), který zkontroluje složku `C:\Users\janou\Desktop\Claude\ai-panel-builder` (nebo lokální JSON export v `prisma/external-catalog/`):
  * Načte z ní vygenerované výrobce, přístroje (`components`), jejich ETIM fasety (`facets`), 2D vektorové archetypy (`din_vector_archetype_id`), svorky (`terminals`), skříně rozváděčů (`enclosure` s `max_heat_dissipation_w`) i relační příslušenství (`component_relations` – boční 0,5M pomocné kontakty, vyrážecí spouště, hřebenové lišty a pojistkové vložky).
  * Bezpečně je přes dávkový `upsert` propíše do databáze Eldocku (`CatalogComponent` + vazby příslušenství), aby náš kaskádový konfigurátor a 2D vektorový editor okamžitě čerpal z této plné databáze.
- Doplň do seedu také kompletní matici standardních rozvodnic (12M, 14M, 18M, 24M, 36M, 48M, 54M, 60M, 72M, 96M, 120M, 144M) od výrobců ABB, Eaton, Hager, OEZ, Noark, Schrack, Hensel a Rittal, aby filtrování skříní podle velikosti ihned fungovalo pro jakoukoliv sestavu.

Ověř vše přes "npm run verify", aktualizuj testy, udělej commit a vypiš příkazy pro push a deploy na produkční server.
