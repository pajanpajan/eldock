# Zadání fáze 66 – Revize VTZ podle zákona 250/2021 Sb. a NV 190/2022 Sb.

**Zdroj:** chat 2026-11-07 / 2026-11-08. Uživatel: „V dalším kroku se musíme věnovat opět průmyslu, prověř, jestli vše sedí
se zákony a normami. Potom se musíme pustit do registrace firem, hlavně zabezpečení, ukládání jejich dat a synchronizaci
napříč zaměstnanci ve firmě. Budeme muset udělat windows aplikaci pro offline provoz stejně tak aplikaci pro telefony
s IOS a Android, aby měli údržbáři přístup k datům, mohli skenovat QR kódy rovnou posílat úpravy a to jak online tak
offline, je spoustu závodů, kde není ve výrobě signál proto je potřeba, aby systém mohl běžet i na interní síti, nebo
offline, s tím, že v offline režimu bude potřeba každodenní synchronizace, aby se vše propsalo.“

Po prověrce (audit 2026-11-07) uživatel schválil roadmapu fází 66–71 a odpověděl „Ano, začni fázi 66“:
66 legislativní shoda · 67 firmy, uživatelé a zabezpečení · 68 data a provoz (zálohy, GDPR) · 69 synchronizační API ·
70 aplikace pro Windows a server závodu (LAN / offline) · 71 mobilní aplikace (iOS / Android, QR, offline fronta).

## Ověřené zdroje (zakonyprolidi.cz)

- **NV 190/2022 Sb.** (aktuální znění, příloha č. 4 ve znění 175/2024 Sb.; text přílohy ověřen 2026-11-08):
  - příloha č. 4 – nejdelší lhůty pravidelných revizí: objekty pro administrativní činnost 5 let; výroba, vzdělávání,
    ubytování a lékařské účely 3 roky; objekt, který podle PBŘ umožňuje přítomnost více než 200 osob 2 roky;
    prozatímní zařízení stavenišť 0,5 roku; pojízdné a převozné prostředky 1 rok; prostory s nebezpečím požáru
    a výbuchu 3 roky; prostory mokré a s trvalým výskytem korozivních nebo znečišťujících látek 1 rok;
    LPS chránící kritické systémy 2 roky, ostatní 4 roky, u všech LPS vizuální kontrola nejméně 1× ročně;
  - doplňující informace: a) více lhůt → nejkratší; b) revize v roce, do kterého spadá konec lhůty (ne u lhůt do 1 roku);
    c) řád preventivní údržby smí stanovit až dvojnásobné lhůty; d) výjimka § 21 odst. 1 zákona;
    k LPS: kritické systémy = stavby s citlivými vnitřními systémy, kancelářské a obchodní budovy, VTZ I. třídy
    a objekty se škodou velkého rozsahu;
  - § 4 – VTZ I. třídy (teploty nad 55 °C, tryskající voda a ponoření, trvalé korozivní látky, požár hořlavých kapalin,
    nebezpečí výbuchu, objekt pro více než 200 osob, zdravotnické prostory, LPS chránící tato zařízení);
  - § 9 a příloha č. 5 – osvědčení revizního technika: E1 (NN i VN s rozsahem napětí, vč. LPS), E2 (NN do 1 kV AC /
    1,5 kV DC, vč. LPS), E3 (jen ochrana před atmosférickou elektřinou, přepětím a statickou elektřinou);
    A = prostory bez nebezpečí výbuchu, B = s nebezpečím výbuchu;
  - § 10 odst. 1 – náležitosti zprávy o revizi, písm. a) až o).
- **Zákon 250/2021 Sb.:** § 8 oprávnění firmy (10 let), § 11 osvědčení revizního technika (5 let, TIČR),
  § 17 revizi smí provést jen RT s osvědčením v rozsahu revidovaného VTZ.
- **NV 378/2001 Sb.**, § 4 odst. 2: kontrola pracovního prostředku nejméně 1× za 12 měsíců, nestanoví-li zvláštní
  předpis, průvodní dokumentace nebo normové hodnoty jinak.
- **ČSN 33 1600 ed. 2, tab. 1** (shoda 4 webů revizních techniků; text normy licencovaný): skupiny A–E, sloupce
  „držené v ruce a prodlužovací přívody třídy I / třídy II a III“ a „ostatní nepřipevněné“ (B 3 / 6 / 6, C 6 / 12 / 24,
  D a E 12 / 12 / 24 měsíců, A před každým vydáním).

## Nálezy prověrky → úkoly fáze 66

1. Lhůty VTZ klíčované jen vnějšími vlivy podle staré tabulky ČSN 33 1500: prostory normální 5 let i ve výrobě (zákon 3),
   AF4 2 roky (zákon 1), chybí objekt pro 200 osob, staveniště a pojízdná zařízení → lhůta podle účelu objektu (typ budovy),
   provedení a prostoru, nejkratší z nich.
2. Hromosvody plošně 4 roky → 2 roky u kritických systémů (kancelářské budovy, objekty pro 200 osob, Ex, ručně označené)
   a roční vizuální kontrola jako samostatný záznam.
3. Spotřebiče bez třídy ochrany a sloupce „držené v ruce“ (nářadí sk. C 12 místo 6 měsíců u tř. I), skupina A bez
   „před každým vydáním“, popisek E „domácnost“.
4. Zpráva o revizi bez § 10 odst. 1 písm. c, e (důvod mimořádné), f (4 data), h, i, k (porušená ustanovení), m
   a bez sídla provozovatele.
5. Osvědčení a oprávnění citovaná k NV 190/2022 místo zákona 250/2021 (§ 8 / § 11); chybí rozsah a platnost osvědčení
   a kontrola podle § 17.
6. Vlastní lhůta zařízení delší než zákonná se přijme bez varování.
7. Stroje citují ČSN EN 60204-1 místo NV 378/2001 Sb., § 4 odst. 2.
8. Konec lhůty = datum + měsíce; zákon u lhůt nad 1 rok dovoluje revizi do konce roku → zobrazit nejzazší termín.
9. Starší lhůty a platnosti revizí (60 měsíců ve výrobě) přepočítat bez resetu databáze.
10. Normový registr: PR-016 „DOPLNIT“ → doplnit ověřené hodnoty přílohy č. 4.

Mimo rozsah fáze 66 (fáze 67+): zabezpečení přihlášení a firem, izolace dat (kromě kontroly závodu u zápisů lhůtníku
a tisku zprávy), zálohy, synchronizace, aplikace Windows / iOS / Android.
