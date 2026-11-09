# Zadání fází 74 a 75 – 2D půdorys & kabeláž, Panel Builder a chytré PDF

**Zdroj:** pokyn uživatele 2026-11-09 (se snímky obrazovky půdorysu, galerie řad, levého panelu a kroku 1 rozváděče):
věrnější výběr designů a barev s originálními obrázky a barvou rámečku a klapky zvlášť; soupis okruhů se zvýrazněním;
podružný rozváděč a přiřazení obvodů k rozváděči; lepší pravidla tras (přednost vnitřní stěny); zvlášť zásuvkové,
světelné a datové okruhy; úprava trasy jen u vybraného okruhu; přeřazení zásuvky do jiného okruhu kliknutím; hezčí
levý panel; ochranná zóna umyvadla; jasné tlačítko „Další krok“ v Panel Builderu; ověření dělení N svorek
a chráničů; lepší výběr skříně (klidně jako samostatný krok mezi Zapojením a Oteplením); chytré PDF s odkazy mezi
obvody a prvky rozváděče, když rozváděč vznikl z půdorysu.

Rozsah je rozdělený: **fáze 74** = 2D půdorys & kabeláž, **fáze 75** = Panel Builder a dokumentace.

## Fáze 74 – 2D půdorys & kabeláž

### Okruhy na plátně

- **Soupis okruhů** všech druhů (zásuvkové, světelné, spotřebiče, datové, sběrnice) s označením jističe,
  rozváděčem, počtem prvků, kabelem a délkou. Najetí myší okruh na plátně zvýrazní, klik ho vybere (ostatní
  okruhy se ztlumí).
- **Vrstvy podle druhu:** přepínače Zásuvkové / Světelné / Spotřebiče / Datové nad plátnem i v soupisu – skryté
  druhy se nekreslí. Datové zásuvky dostanou vlastní trasy (každá samostatný UTP z rozváděče), dosud se jen
  sčítaly do výkazu.
- **Úprava trasy jen u vybraného okruhu:** úchyty úseků má jen vybraný okruh (klik na jeho trasu nebo do soupisu),
  ostatní trasy se nedají omylem posunout. Lišta vybraného okruhu nad plátnem: délka, kabel, rozváděč, reset trasy.
- **Přeřazení zásuvky:** klik na zásuvku ukáže u ní plovoucí nabídku okruhů (barevné čipy jako na plátně, nový
  ruční okruh, automaticky) – bez hledání v bočním panelu.

### Podružný rozváděč

- Nová značka palety **Podružný rozváděč (RP)** – i víc kusů (RP1, RP2 …) na libovolném podlaží.
- Každý prvek patří k rozváděči: **automaticky** (podlaží s podružným rozváděčem bez hlavního rozváděče → ten
  podružný, jinak hlavní), nebo ručně – u okruhu v soupisu (celý okruh) i u prvku.
- Okruhy se navrhují zvlášť pro každý rozváděč (okruh nikdy nevede přes dva rozváděče), trasy vedou z jeho
  rozváděče, označení jističů je pro každý rozváděč vlastní („RP1 -F3“).
- **Přívod hlavní → podružný rozváděč** je samostatný okruh hlavního rozváděče: soudobý příkon podružného
  rozváděče → jistič 3P (u 1f přívodu 1P+N), kabel CYKY-J 5× / 3× podle zatížitelnosti a úbytku napětí, délka po
  stěnách přes stoupací vedení. Přívod není pod chráničem 30 mA (chrániče má podružný rozváděč); u soustavy TT
  upozornění na chránič typu S.
- Generování z půdorysu vytvoří hlavní rozváděč a ke každému podružnému vlastní propojený projekt (stále 1 kredit
  za jedno generování).

### Pravidla tras kabelů (návrh)

1. **Vnitřní stěna má vždy přednost.** Stěny se rozdělí na vnitřní (mezi dvěma místnostmi, nové příčky)
   a obvodové (za stěnou do 0,7 m žádná místnost). Hledání cesty penalizuje obvodovou stěnu (cena × 4), délka kabelu
   zůstává skutečná. Po obvodové stěně vede trasa jen tam, kde jinak nejde, typicky poslední úsek k prvku, který na
   obvodové stěně sedí.
2. Trasa vede v instalačních zónách podél stěn s kolmou odbočkou k prvku (ČSN 33 2130 ed. 4, beze změny).
3. Kreslí se vždy na straně místnosti, ve které je prvek nebo rozváděč, nikdy vně budovy (beze změny).
4. Volný prostor bez stěn = pravoúhle (beze změny); ruční úprava trasy má přednost před automatem.

### Levý panel

- Kategorie jako řádky: ikona, krátký název, podtitul (norma / poznámka), počet osazených prvků a šipka; tlačítko
  „Upravit / + Přidat“ spotřebičů v těle kategorie. Prvky ve dvou sloupcích se značkou a názvem.

### Umyvadlo

- **Ověření norem:** ČSN 33 2000-7-701 ed. 2 (od 6. 12. 2027 ed. 3) zná zóny 0–2 jen u vany a sprchy. U umyvadla
  platí podle ČSN 33 2130 **umývací prostor**: svislý průmět umyvadla ke stěně do výšky 2,25 m. Zásuvky a spínače
  jen vně; ve výšce od 1,2 m smí být těsně u hranice, níž nejméně 0,2 m od hranice. (Text převzatý z ed. 3,
  čl. 7.8 – v ed. 4 ověřit v plném znění normy.)
- **V půdorysu:** umyvadlo dostane ochrannou zónu kreslenou stejně jako zóny vany a sprchy: umývací prostor
  a pás 0,2 m. Hlídač bere ohled na výšku krabice (od 1,2 m smí být prvek těsně u hranice). Volba „přísnější
  0,6 m jako zóna 2“ pro projektanty, kteří ji používají.

### Designové řady a barvy

- Barva **rámečku** a barva **klapky / krytu** zvlášť (výchozí stejná) – v galerii, v liště řad i u prvku.
  Objednací čísla rámečků dostanou kód barvy rámečku, kryty a klapky kód barvy klapky.
- Věrnější náhledy: stejný poloměr rohů u víceramečku (žádná „pilulka“), bez orientační kontrolky u běžného
  spínače, poměr klapky a rámečku podle řady.
- **Originální fotky řad:** fotky výrobců jsou autorská díla. Aplikace má pro každou řadu a barvu místo na
  oficiální fotku se zdrojem a licencí (`public/series/…` + manifest); bez fotky ukáže vektorový náhled. Fotky se
  doplní až s potvrzením práva je použít (partnerský přístup k fotobankám ABB, Schneider, Legrand, Hager nebo
  souhlas výrobce). Repozitář je veřejný.

## Fáze 75 – Panel Builder a dokumentace

- **Další krok:** výrazné tlačítko „Další krok →“ v liště kroků a dole na každé stránce kroku.
- **Krok Skříň rozváděče** mezi Zapojením a Oteplením (kroky 1–5): požadavek návrhu (řady, moduly, rezerva,
  IP z prostředí, ztráty), filtr výrobce / montáže / krytí / materiálu, doporučená skříň, náhled zaplnění.
- **Ověření dělení N svorek a chráničů (nálezy):**
  1. RCBO pod skupinovým chráničem bralo N z N0 – musí z můstku nadřazeného chrániče (jinak chránič vybaví).
  2. Chránič pod chráničem (hlavní S + skupinové) bral N z N0 – musí z můstku nadřazeného chrániče.
  3. Generátor z půdorysu dával fáze jističům pod 4P chráničem podle zatížení, ne podle pozice na hřebenové
     liště 3P (L1-L2-L3 po sobě) – fáze musí odpovídat pozici, vyvažování se dělá pořadím okruhů.
  4. Chránič měl vždy 40 A – nově podle součtu jističů na fázi (s náročností 0,7), jinak 63 A a upozornění.
- **Chytré PDF:** rozcestník obvodů (označení, okruh, místnosti, jištění, chránič, fáze, kabel, délka) s odkazy
  na výkres osazení, jednopólové schéma, kusovník, výkaz kabeláže a list půdorysu; z každého listu odkaz zpět;
  obsah s odkazy na listy; klikací přístroje ve výkresech; list půdorysu s klikacími štítky okruhů; odkazy na
  podružné rozváděče. PDF vzniká tiskem prohlížeče (Chrome / Edge zachovají vnitřní odkazy).
