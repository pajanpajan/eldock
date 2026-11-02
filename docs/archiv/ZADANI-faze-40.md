# Zadání fáze 40 (vloženo 2026-11-02 do sekce B plánu)

Musíme zásadně přepracovat logiku a UX modulu "Studio výstavby závodu" (/studio) a kompletně aktualizovat vzorové závody (seed), ze kterých po zavedení nového modelu zmizely místnosti a vybavení.

Zapiš tyto úpravy do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. ŽÁDNÁ AUTOMATICKÁ NOVÁ BUDOVA PŘI OTEVŘENÍ STUDIA + REŽIM "MAPA ZÁVODU NA PRVNÍM MÍSTĚ":
- Když uživatel otevře "/studio" pro existující závod, NESMÍ se automaticky vytvářet žádný žlutý koncept nové budovy ("Hala C") a nesmí tam strašit rozbalený Krok 1!
- Výchozí obrazovka "/studio" zobrazí pouze čistou interaktivní mapu aktuálního závodu se všemi jeho stávajícími budovami a výzvou: "Klikněte na libovolnou budovu pro správu jejího vybavení a místností".
- V horní liště nad mapou zobraz pouze akční tlačítka:
  * "[ ✏️ Upravit areál / + Přidat budovu ]" – teprve po kliknutí na toto tlačítko se odemkne režim editace areálu (změna rozměrů pozemku X×Y, posouvání/změna velikosti budov a přidání nové budovy).
  * "[ 🆕 Vytvořit nový závod od nuly ]" – přepne do průvodce stavbou nového areálu.

2. PŘÍMÝ PROKLIK Z MAPY BUDOVY ROVNOU K ZAŘÍZENÍM A MÍSTNOSTEM (BEZ NUTNOSTI KROKU 1):
- Když uživatel na mapě areálu ve Studiu klikne na stávající budovu (např. Hala A, Energetika, Administrativa):
  * Otevře se pohled na tuto budovu s přepínačem jejích pater nahoře (1. PP, 1. NP, 2. NP...) a půdorysem vybraného patra.
  * Zároveň se otevře levý boční panel se 3 rychlými režimy práce nad tímto patrem:
    1) "[ 🔌 Zařízení a napájení ]" (VÝCHOZÍ AKTIVNÍ REŽIM po otevření budovy!) – uživatel hned vidí půdorys patra se všemi místnostmi a osazenými stroji, rozváděči a spotřebiči, může kliknout na místnost a okamžitě přidávat, upravovat nebo odebírat zařízení.
    2) "[ 🧱 Místnosti, zóny a vrata ]" – přepne plátno do režimu kreslení místností, posouvání stěn myší a osazování vrat.
    3) "[ 🏢 Budova a podlaží ]" – odemkne přejmenování pater, přidání nového patra (NP/PP) nebo úpravu rozměru budovy X×Y.

3. OBOUSMĚRNÁ SYNCHRONIZACE EXISTUJÍCÍCH ZAŘÍZENÍ A MÍSTNOSTÍ VE STUDIU:
- Oprav načítání existujícího patra do Studia: když uživatel otevře jakékoliv patro existující budovy, Studio musí načíst jak jeho "studioLayoutJson" (všechny místnosti, zóny a vrata v metrech), tak VŠECHNA existující zařízení ("Equipment") na tomto patře z databáze!
- V půdorysu Studia i v levém panelu ("Upravit stávající") musí být vidět všechny stávající rozváděče, stroje, roboty, spotřebiče i ruční nářadí, které na patře jsou.
- Umožni ve Studiu existující zařízení plnohodnotně upravovat (změnit název, tag, napájení, místnost, počet kusů přes +/−), mazat (s potvrzením) nebo přidávat nová, a při kliknutí na "Uložit změny patra" vše čistě zapsat do databáze a přegenerovat "floorplanSvg".

4. KOMPLETNÍ AKTUALIZACE A BOHATÉ VYBAVENÍ VZOROVÝCH ZÁVODŮ V SEEDU (Závod Jablonec & Závod Liberec):
Vzorové závody teď kvůli novým pravidlům působí prázdně nebo mají nekompatibilní staré SVG půdorysy. Aktualizuj seed ("prisma/seed-data.ts", "prisma/seed-appliances.ts" a přírůstkový seed pro produkci) tak, aby vzorové závody na 100 % využívaly novou metrovou architekturu Studia a byly bohatě naplněné realistickým vybavením:
- Pro KAŽDÉ patro všech budov v Závodě Jablonec (Hala A 1.NP a 2.NP, Hala B 1.NP, Energetika 1.PP a 1.NP, Sklad 1.NP, Administrativa 1.NP a 2.NP) i v Závodě Liberec (Hala 1 - Lakovna) definuj přesný "studioLayoutJson" s logickými místnostmi pokrývajícími celou plochu patra (žádné prázdné neobsazené kusy haly!), se správnými 7 typy zón a azurovými vraty, a vygeneruj z nich nové půdorysy "floorplanSvg".
- Bohatě vybav všechna patra a místnosti reálnými zařízeními napojenými do hierarchie napájení:
  * Energetika (1. PP a 1. NP): Transformátor TR1, hlavní rozváděč RM1, kompenzační rozváděč RC1, UPS rozváděč RZ1, kompresorová stanice KS1, v kuchyňce a velínu spotřebiče (2× Kávovar, 1× Chladnička, 1× Mikrovlnná trouba, 3× PC sestava, 4× Prodlužovací přívod) a v dílně měřicí přístroje a nářadí.
  * Hala A – Lisovna (1. NP a 2. NP): Rozváděče R-LIS-01, R-CNC-04, R-VZT-01, hydraulické lisy LIS-01 a LIS-02, CNC centra CNC-01 až CNC-04, robotické buňky ROB-01 až ROB-03, VZT jednotky, hromosvod, nouzové osvětlení + v místnosti "Dílna údržby" a "Mistrová" bohatá sada ručního nářadí a spotřebičů (4× Úhlová bruska, 3× Aku/elektrická vrtačka, 2× Svářečka, 2× Průmyslový vysavač, 6× Prodlužovací buben, 2× PC sestava).
  * Hala B – Montáž (1. NP): Rozváděč R-ML-01, montážní linky ML-01 a ML-02, svařovací roboty ROB-07 a ROB-08 + v montážních zónách a zázemí spotřebiče a nářadí (5× Elektrický šroubovák/vrtačka, 2× Horkovzdušná pistole, 4× Prodlužovací přívod, 1× Průmyslový vysavač).
  * Sklad (1. NP): Rozváděč R-SKL, nabíjecí stanice VZV, balicí linka + v expedici (3× PC sestava / terminál, 2× Horkovzdušná pistole, 4× Prodlužovací přívod).
  * Administrativa (1. NP a 2. NP): Patrové rozváděče RP-ADM1 a RP-ADM2 + v kancelářích, zasedačce a kuchyňkách (12× PC sestava / monitor, 3× Tiskárna, 2× Kávovar, 2× Rychlovarná konvice, 2× Chladnička, 10× Prodlužovací přívod).
- Zajisti, aby se tato aktualizovaná struktura (studioLayoutJson, přegenerované floorplanSvg se součtovými štítky v místnostech a doplněné kusy vybavení) bezpečně propsala i na produkční server přes přírůstkový seed skript při startu kontejneru (bez smazání uživatelských dat a projektů v Panel Builderu).

Po implementaci spusť "npm run verify", uprav E2E testy Studia na nový průchod (klik na budovu na mapě -> úprava patra -> přidání/úprava zařízení), udělej commit a vypiš příkazy pro push a deploy.
