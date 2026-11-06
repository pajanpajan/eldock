# Zadání fází 59–61 (2026-11-06, z chatu)

Zadání uživatele (doslovně):

> když v panel builderu přidám prvek, zůstane označený, a když pak vybírám jiný, zároveň tím měním poslední přidaný, je
> to chyba, když přidám prvek, nesmí zůstat označený, zároveň chci, abych mohl komponenty vložené na DIN lištu měnit.
>
> Když kreslím v 2D půdorysu zásuvky a podobně, potřebuji, aby další vložená byla stejně pootočená, jak ta předchozí.
> Pokud dám více zařízení vedle sebe, jako třeba 3 zásuvky, nebo 2 zásuvky a vypínač, musím mít možnost to celé vložit
> do víceramečku a vyrovnat, tedy přisazení.
>
> Do úpravy PDF chci přidat možnost zakreslení změny, tedy, vybrat barvu/šrafování a dokreslit třeba příčku, nebo
> nějakou označit, že tam bude a tako možnost vložit textové pole a dopsat informace se základní možností editace jako
> barva, velikost písma, a podobně.
>
> Navrhované kabelové obvody by se vždy měly být zakreslovány podél stěn.
>
> Jak zakresluji zásuvky, rovnou se zobrazuje kabeláž, což není špatně, ale jde to popořadě, jak to kreslím, vždy by
> projekt měl hlídat ideální vzdálenost a přepočítávat, nebrat to postupně, jak to jde v řadě za sebou podle toho, jak
> zásuvky přidávám.
>
> Dále musíme přidat řešení pro vícepatrové domy, tedy přidat možnost druhého patra.
>
> Chybí možnost přiřadit vypínač ke světlu, musíme to opravit.
>
> Když dám vygenerovat rozváděč podle 2D půdorysu měla by sedět posloupnost podle hierarchie. Neměli by se míchat různí
> výrobci, vždy to bude jeden, ale je potřeba tam mít možnost přenést celý rozváděč do jiného výrobce se zachováním všech
> hodnot a hierarchie. Při projektování chytré domácnosti to nenabídne výrobce ani to nepočítá vhodné spínací ani
> stmívací moduly, tyto funkce úplně chybí, je to nedotažené. Doplň chybějící funkce, celé to zpřehledni, designové řady
> a jejich možnosti barev by měly mít mnohem lepší vizualizaci, zapracuj na tom. Dále rozšiř naši databázi prvků
> a hledej aktuální katalogy u ABB jsi naposledy vycházel z katalogu z roku 2024 když už je k dispozici katalog 2026.
> Hlídej dodržování norem a bezpečnosti a přidej tam logiku, aby to dávalo smysl a mělo to pokročilé funkce, které
> potřebujeme dotáhnout.

## Rozpad do fází

**Fáze 59 – editace v Panel Builderu a 2D půdorysu**
1. Panel Builder, krok 1: po vložení přístroje nic nezůstane vybrané (paleta si drží poslední konfiguraci pro další
   vložení), „Přidat vpravo“ a „+“ na liště vkládají přes paletu na zvolenou pozici, duplikát se nevybere. Vložený
   přístroj se mění jen po kliknutí (zřetelný režim „Úprava -F3“, Hotovo / Esc) a jde přesunout (◀ ▶, jiná lišta).
2. 2D půdorys: další značka převezme natočení předchozí (náhled u kurzoru, R otočí před vložením), vícenásobný výběr,
   víceramečky 2R–5R z různých přístrojů (zásuvky + vypínač) s vyrovnáním a přisazením, rozdělení rámečku, kusovník
   s jedním vícenásobným rámečkem.
3. Přiřazení vypínače ke světlu: 🔗 v plovoucí liště vypínače i světla, automatické přiřazení v místnosti, hlídání
   světel bez ovládání.
4. Úprava PDF → zakreslení změn: nová příčka, bouraná konstrukce, šrafovaná oblast (barva, šrafa, tloušťka), textové
   pole (barva, velikost písma, tučné, podklad); výběr, přesun, úprava, mazání.
5. Vícepodlažní dům: patra s vlastním podkladem, kalibrací, místnostmi a prvky, výška podlaží, stoupací vedení, výpočet
   okruhů a kabeláže přes všechna patra.

**Fáze 60 – kabeláž podél stěn a rozváděč z půdorysu**
1. Trasy okruhů podél stěn (graf stěn z místností a zakreslených příček), bez stěn náhradní pravoúhlé trasy.
2. Optimální pořadí prvků v okruhu nezávislé na pořadí kreslení (přesný výpočet pro malé okruhy, 2-opt pro větší).
3. Rozváděč z půdorysu: lišty i strom zapojení podle hierarchie, jeden výrobce celého rozváděče, převod rozváděče
   na jiného výrobce se zachováním hodnot, značení, popisů a stromu.

**Fáze 61 – chytrá domácnost, designové řady, katalog ABB 2026 a normy**
1. Chytrá domácnost: systém a výrobce (ABB-free@home, ABB i-bus KNX, Loxone), světla spínaná / stmívaná s příkonem,
   výpočet spínacích, stmívacích, žaluziových a topných akčních členů s rezervou kanálů, napájecí zdroj a systémový
   modul, kontrola sběrnice, přiřazení kanálů, moduly do rozváděče.
2. Designové řady: galerie s velkými náhledy rámečků a krytů v barvách řady, dvoubarevná provedení, materiály.
3. Katalog ABB 2026 („Katalog: Domovní elektroinstalační materiál 2026“, únor 2026, 680 stran,
   `nizke-napeti.cz.abb.com/files/document/20641/…`): řady a barvy podle vydání 2026, moduly ABB-free@home 2026
   do databáze prvků.
4. Normový hlídač půdorysu (koupelnové zóny dle ČSN 33 2000-7-701 ed. 2, krytí, světla bez ovládání, sběrnice,
   stmívače, zásuvkové okruhy) s opravou jedním klikem, kde to jde.

Poznámka ke katalogu: dokument 20641 na webu ABB dřív obsahoval vydání 2024 („Katalog 2024 – Domovní
elektroinstalační materiál“); od února 2026 je pod stejnou adresou vydání 2026.
