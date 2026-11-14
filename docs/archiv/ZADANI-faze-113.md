# Zadání fáze 113 – ukládání více podlaží, přepínač podlaží, místnosti z PDF, neplátce DPH, sady QR štítků, rozvodnice OEZ / Schneider / Eaton, limity tarifů, SMTP a zálohy ve velínu

Vloženo z chatu 2026-11-14 (po nasazení fáze 112). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Potřebujeme vyřešit 3 kritické chyby v 2D půdorysu a zároveň kompletně dotáhnout body z fází 110–112, které můžeš udělat přímo v kódu a databázi:

1) OPRAVA UKLÁDÁNÍ PROJEKTU PO PŘIDÁNÍ DRUHÉHO PATRA (`! Neuloženo · Uložit znovu`):
   - Problém: Jakmile uživatel v `/panel-builder/floorplan` přidá druhé podlaží (`2. NP +3,000`) a nahraje do něj PDF podklad, uložení projektu na server selže (kvůli velikosti payloadu se 2 base64 obrázky podkladů nebo validaci schématu `floors[]`).
   - Oprava:
     * Zvyš limit velikosti těla požadavku (`bodyParser` / `serverActions.bodySizeLimit` v `next.config` a v API routách `/api/floorplans*` a `/api/panel-builder*`) na **`50mb`**.
     * Při nahrání PDF podkladu na klientovi optimalizuj rastrovaný podklad (rozumné rozlišení max. `2400 px` na delší straně, formát `.webp` / `.jpeg` s kvalitou `0.82` místo obřího nekomprimovaného PNG v base64), aby měl podklad jednoho patra max. `300–600 KB` místo `10 MB`!
     * Zkontroluj a oprav backendové API ukládání půdorysu (`POST / PUT / PATCH`), aby 100% ukládalo kompletní pole `floors` (všechna podlaží `1. NP`, `2. NP`, `3. NP`... včetně jejich vlastního `backgroundImage`, `scale`, `rooms`, `items`, `furniture` a `routes`) do databáze i `localStorage` bez jediné chyby!
     * Otestuj, že po přidání `2. NP` a nahrání druhého PDF svítí v horní liště zeleně `✓ Uloženo v cloudu`.

2) PŘEPÍNÁNÍ MEZI PATRY V ODZNAKU NA PLÁTNĚ (`2. NP +3,000`) A V PRAVÉM MENU:
   - **A) Interaktivní přepínač přímo na plátně vlevo nahoře (`2. NP +3,000`):**
     * Změň statický štítek podlaží v levém horním rohu plátna (`1. NP ±0,000` / `2. NP +3,000`) na interaktivní komponentu!
     * Pokud má projekt **přesně 2 patra**, po najetí myší (`hover`) se štítek plynule rozšíří a zobrazí jasnou vizuální výzvu k přepnutí na druhé patro jedním klikem: např. **`2. NP +3,000  ⇄  Přepnout na 1. NP ±0,000`** (se šipkou nahoru/dolů a zvýrazněným rámečkem). Kliknutím na tento štítek se okamžitě přepne aktivní patro!
     * Pokud má projekt **3 a více pater**, po najetí myší nebo kliknutí na štítek v rohu plátna se rozbalí čisté plovoucí menu všech pater s možností okamžitého přepnutí.
   - **B) Přepínač pater v pravém menu (`Místnosti a podlaží`) i v horní liště:**
     * V pravém panelu v kartě `Místnosti a podlaží` nahraď pasivní text *„zvolit podlaží můžete v levé paletě“* **aktivními přepínacími tlačítky všech podlaží přímo v této kartě** (`[ 1. NP ±0,000 ]` · `[ 2. NP +3,000 ]` · `[ + Přidat podlaží ]`), aby uživatel mohl přepínat patra přímo vpravo!

3) AUTOMATICKÁ A POLOAUTOMATICKÁ DETEKCE MÍSTNOSTÍ Z NAHRANÉHO PDF VÝKRESU (`src/lib/panel-builder/pdf-room-detector.ts`):
   - Problém: Po nahrání PDF půdorysu se v 3D náhledu vykreslí pouze vnější obvodová stěna celého výkresu, protože vnitřní místnosti nejsou rozpoznané.
   - Naimplementuj **3stupňový systém získání místností a vnitřních příček z PDF**:
     * **Stupeň 1 – Automatická detekce místností z PDF (`[ 🔍 Automaticky rozpoznat místnosti z PDF ]`):**
       - Hned po nahrání PDF (a po kalibraci měřítka) spusť (nebo nabídni na 1 klik) detektor, který:
         1. Přečte z PDF textové vrstvy (`pdfjs`) typické popisky místností (čísla jako `1.01`, `1.02`, `2.01`..`2.09`, názvy pokojů *Obývací pokoj, Ložnice, Koupelna, WC, Chodba, Kuchyň, Pokoj, Šatna, Technická místnost* a výměry `XX,X m²`).
         2. Na rastrovaném obraze PDF provede detekci uzavřených oblastí (prahování tmavých čar stěn + morfologické uzavření mezer dveří do šířky ~90 cm + Flood-Fill / Connected Components kolem nalezených středů místností) a automaticky vytvoří obdélníky/polygony jednotlivých pokojů!
     * **Stupeň 2 – Poloautomatický nástroj `🪄 Klikni doprostřed místnosti (Auto-výplň stěn)`:**
       - Přidej do levého panelu (v Kroku 1 `Půdorys a místnosti`) hned pod `Nahrát půdorys` výrazné tlačítko **`[ 🪄 Klikni do místnosti na PDF ( rozpozná stěny ) ]`**.
       - Když uživatel klikne do libovolného pokoje na PDF výkresu, algoritmus z bodu kliknutí spustí paprsky / Flood-Fill na rastru PDF podkladu, najde okolní tlusté čáry zdiva, automaticky vytvoří místnost přesně v hranicích stěn a zeptá se jen na název (nebo ho přečte z PDF).
     * **Stupeň 3 – Rychlé nakliknutí místnosti 2 protilehlými rohy (`[ 📐 Rychlá místnost 2 kliky (roh ➔ roh) ]`):**
       - Uživatel klikne na levý horní roh pokoje na PDF a na pravý dolní roh pokoje -> místnost se okamžitě vytvoří a nástroj zůstane aktivní pro bleskové naklikání dalších pokojů v patře během pár sekund!
   - Jakmile jsou místnosti vytvořené (automaticky nebo poloautomaticky), **3D náhled (`FloorplanPseudo3DModal.tsx`)** okamžitě vykreslí všechny vnitřní 20% poloprůhledné příčky mezi pokoji!

4) DOKONČENÍ BODŮ Z FÁZÍ 110–112 PŘÍMO V KÓDU A DATABÁZI:
   - **A) Provozovatel & Fakturace (Režim před založením s.r.o. dle doporučení Lipo.ink):**
     * V nastavení provozovatele (`🏢 Provozovatel & fakturace`) nastav výchozí hodnotu **`Plátce DPH: NE (`isVatPayer = false` – Neplátce DPH)`**!
     * Pole `IČO`, `DIČ` a `Spisová značka` nastav jako **nepovinná (volitelná)** – pokud nejsou vyplněná, na faktuře / výzvě k platbě i v patičce se vypíše čistě jméno provozovatele (`Pavel Janoušek · ELDOCK.cz`), adresa a číslo bankovního účtu / IBAN s poznámkou *„Neplátce DPH“*, aniž by systém kdekoliv hlásil chybu nebo blokoval platby!
     * Ujisti se, že jednou uložené číslo účtu a IBAN zůstávají trvale uložené v databázi/konfiguraci a nepřepisují se při buildu nebo migraci.
   - **B) Automatické přednaplnění (Seed) sad QR štítků s cenami (Aktivace objednávek štítků):**
     * Nečekej na ruční zadání ve velínu – rovnou v databázovém seedu a výchozí konfiguraci vytvoř a aktivuj tyto **4 prodejní sady odolných QR štítků ELDOCK (300 DPI termotransfer PET + Resin)**:
       1. **`Sada SPOTŘEBIČ & KANCELÁŘ (100 ks · 30×15 mm)`** – Pro monitory, PC, prodlužovačky a nářadí dle ČSN 33 1600 ed. 2. Cena: **`490 Kč`** (`4,90 Kč/ks`).
       2. **`Sada SPOTŘEBIČ & KANCELÁŘ – VELKÁ (500 ks · 30×15 mm)`** – Zvýhodněný kotouč pro revizní techniky a administrativní budovy. Cena: **`1 750 Kč`** (`3,50 Kč/ks`).
       3. **`Sada ROZVÁDĚČ PROFI (50 ks · 50×25 mm · Stříbrný Datapol PET)`** – Pro domovní a komerční rozváděče dle ČSN EN IEC 61439 (-40 až +150 °C). Cena: **`745 Kč`** (`14,90 Kč/ks`).
       4. **`Sada PRŮMYSL & STROJE (50 ks · 70×40 mm · Stříbrný 3M/Datapol PET)`** – Pro výrobní stroje, linky a rozvodny dle Nařízení EU 2023/1230. Cena: **`1 450 Kč`** (`29,00 Kč/ks`).
       5. **`STARTOVACÍ MIX SADA ELDOCK (100 ks celkem: 60× Spotřebič + 30× Rozváděč + 10× Stroj)`** – Cena: **`890 Kč`**.
     * Objednávka QR štítků tak bude **okamžitě zapnutá a funkční** (a ve velínu `/superadmin` půjdou ceny kdykoliv upravit).
   - **C) Doplnění rozvodnic OEZ, Schneider Pragma a Eaton xEnergy do databáze skříní:**
     * Do katalogu rozvodnic (`enclosures` v AI Panel Builderu) kompletně přidej všechny klíčové řady na českém trhu včetně rozměrů V×Š×H, počtu řad a modulů (`12M`, `18M`, `24M`, jedno- i dvoupolové skříně), krytí IP, maximální ztrátové schopnosti $P_{max}$ [W] dle IEC TR 60890, objednacích čísel MPN, EAN, ceníkových cen a čistých vektorových/produktových náhledů:
       - **OEZ:** `DistriTon RZA` (nástěnné i zapuštěné, 1 až 2 pole, 3 až 7 řad, `36M` až `168M`, IP30/IP40), `RZG` (IP54), `RN` / `RNP` (plastové 12M až 72M, IP40/IP65).
       - **Schneider Electric:** `Pragma` (`13M`, `18M` a `24M` na lištu – 1 až 6 řad, `18M` až `144M`, IP30/IP40, nástěnná i zapuštěná), `Mini Pragma` (`8M–36M`), `Kaedra` (vodotěsná IP65 `12M–72M`), `PrismaSeT G` (komerční/průmyslové 1polové a 2polové skříně až `288M`).
       - **Eaton:** `xEnergy Basic / BF` (oceloplechové 1polové i 2polové `24M` na lištu, 3 až 6 řad, `72M` až `168M`, IP30/IP54), `KLV` (domovní `12M` až `60M` + multimediální/Smart Home verze), `BP` / `BC`.
   - **D) Technické vynucení limitů tarifů a kreditů:**
     * Zapni vynucování limitů tarifů a kreditů na API i v UI: běžný nově registrovaný uživatel má k dispozici **1 testovací půdorys + 1 testovací rozváděč zdarma**, a pro další projekty nebo neomezenou správu v `/hlidac-revizi` (nad zkušební limit) systém vyžaduje příslušné kredity nebo aktivní tarif (`ELDOCK PRO`, `REVIZE & BUDOVY`, `PRŮMYSL`).
     * DŮLEŽITÉ: Účty označené jako `SUPERADMIN` nebo `isDemoAccount / Ukázková firma` (`Elektro Tester s.r.o.` a účet majitele) mají vždy plný neomezený přístup pro prezentace a testování!
   - **E) Pohodlné nastavení SMTP a S3 záloh přímo ve Velínu (`/superadmin`) + tichý lokální fallback záloh:**
     * Do `/superadmin` přidej sekci `⚙️ Nastavení SMTP & Cloud záloh (R2/S3)`, kam může majitel kdykoliv vložit údaje přes webové rozhraní (s tlačítkem `[ Otestovat SMTP ]` a `[ Spustit zálohu ]`).
     * Dokud není `ELDOCK_BACKUP_S3_*` vyplněné, ukládej denní zálohy automaticky do lokálního adresáře `/backups` na serveru (s rotací posledních 14 dnů) a v přehledu zobraz klidnou informaci `💾 Lokální záloha na serveru je aktivní (S3/R2 cloud úložiště je volitelné)` místo chybového hlášení!

Spusť `npm run verify`, zkontroluj, že všechny testy procházejí, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Migrace `20261114090000_phase113_limits_enclosures`** (před nasazením záloha databáze):

- `RegisteredCompany.unlimitedAccess` – ⭐ neomezený přístup (velín); ukázková firma Tester ho dostane hned a její
  zkušební projekty a půdorysy se převedou na plnou verzi (`UNLIMITED`).
- `PanelEnclosure.ean` a `listPriceCzk` – EAN a ceníková cena rozvodnic jen z oficiálních dat výrobců.
- Data:
  - uložený provozovatel se přepne na neplátce DPH (ostatní údaje včetně účtu a IBAN zůstávají);
  - výchozí sady QR štítků se zapíšou, jen když je velín ještě neuložil.

**1. Ukládání půdorysu s dalším podlažím**

- **Skutečná příčina:** v produkčním logu je opakovaně „Failed to find Server Action … older or newer deployment“.
  - Otevřený editor ze starší verze aplikace po nasazení nové volá Server Actions, které server nezná. Každé sestavení
    Next.js má nová ID akcí.
  - Ukládání proto padalo a stav ukazoval „Neuloženo · Uložit znovu“ – nezáleželo na tom, kolik podlaží projekt má.
- **Podklady nejdou do nákresu jako base64.** PDF se vykreslí do obrázku a nahraje jako soubor, nákres drží jen
  odkaz `/api/files/photos/…`. Uložený nákres odkaz `data:` vůbec nepřijme.
- Opravy:
  - **Nová verze aplikace (`lib/stale-deploy.ts`):**
    - při neznámé Server Action editor zazálohuje nákres v prohlížeči, ukáže „🔄 Nová verze ELDOCK – načítám znovu…“
      a stránku načte znovu (nejvýš jednou za minutu);
    - po načtení editor zálohu převezme a hned ji uloží novou verzí;
    - globální pojistka `StaleDeployGuard` nabídne „🔄 Načíst novou verzi“ i jinde.
  - **Limity:** tělo Server Action i požadavku přes proxy až **50 MB** (`next.config.ts`). Největší nákres je 20 MB
    místo 900 kB, stejný limit platí i pro generování rozváděče z půdorysu.
  - **Podklad podlaží:**
    - delší strana 2400 px;
    - WebP v kvalitě 0,82 (JPEG, když prohlížeč WebP nekóduje);
    - při větším souboru nižší kvalita, pak menší rozlišení (cíl do 600 kB).
  - **Uložení všech podlaží:** každé podlaží (podklad, měřítko, místnosti, prvky, rámečky, poznámky, ruční trasy) se
    ukládá v nákresu – ověřeno testem se 4 podlažími a nákresem přes 900 kB.
- **Odchylka:** API routy `/api/floorplans*` ani `/api/panel-builder*` neexistují. Půdorys se ukládá Server Actions,
  pro ně a pro proxy platí limit 50 MB.

**2. Přepínání podlaží**

- Štítek podlaží v levém horním rohu plátna (`FloorBadge`):
  - 1 podlaží = štítek;
  - 2 podlaží = najetím se plynule rozšíří o „⇄ ↓ Přepnout na 1. NP ±0,000“ se zvýrazněným rámečkem a klik přepne;
  - 3 a více = najetím nebo klikem plovoucí menu všech podlaží.
- Karta „🏠 Místnosti a podlaží“ v pravém panelu:
  - tlačítka všech podlaží `[ 1. NP ±0,000 ] · [ 2. NP +3,000 ]`;
  - `[ + Přidat podlaží ]` přidá další NP o 3 m výš.
- V horní liště průvodce zůstává rozbalovací přepínač podlaží z fáze 89.

**3. Místnosti z PDF výkresu (`lib/panel-builder/pdf-room-detector.ts`)**

- **Popisky z textové vrstvy PDF:**
  - při nahrání se z textové vrstvy přečtou čísla 1.01 / 2.09, názvy (Obývací pokoj, Ložnice, Koupelna, WC, Chodba,
    Kuchyň, Pokoj, Šatna, Technická místnost …) a výměry „32,5 m²“;
  - uloží se k podkladu podlaží (nejvýš 400, jen texty místností).
- **Rastr:**
  - prahování tmavých čar a uzavření mezer dveří do 95 cm;
  - tři vrstvy stěn: jen zdivo → zdivo s okny (tenké čáry do 0,8 m od zdi) → všechny čáry;
  - flood fill kolem popisků;
  - bez textové vrstvy souvislé oblasti ohraničené zdivem (1–300 m²);
  - výsledkem je obdélník (vyplnění ≥ 85 %), jinak polygon do 40 rohů;
  - mělké okenní a dveřní niky se zahladí.
- **Stupeň 1 – „🔍 Automaticky rozpoznat místnosti z PDF“:**
  - v kroku 1 a po kalibraci nabídka na 1 klik;
  - nezkalibrovaný podklad s výměrami u aspoň 2 shodných místností dostane měřítko z výměr.
- **Stupeň 2 – „🪄 Klikni do místnosti na PDF (rozpozná stěny)“:** název z popisku, jinak dotaz.
- **Stupeň 3 – „📐 Rychlá místnost 2 kliky (roh ➔ roh)“:** nástroj zůstává aktivní.
- **3D náhled:** kreslí všechny stěny místností poloprůhledně (20 %). Nově je u něj štítek „🧱 Stěny a vnitřní příčky
  z místností podlaží“.
- **Odchylky:**
  - výsledek je odhad podle kreslení výkresu – rozměry a tvar místností jdou upravit tažením;
  - skenované PDF nemá textovou vrstvu (místnosti bez názvů);
  - popisky se čtou jen u PDF nahraných od této fáze;
  - stěny místností jsou vnitřní líce, mezi sousedními místnostmi je tedy tloušťka zdi.

**4A. Provozovatel – neplátce DPH**

- Výchozí plátcovství DPH je **NE**. Migrace přepne i už uložený profil; účet, IBAN a adresa zůstávají.
- IČO, DIČ a spisová značka jsou ve velínu označené „(nepovinné)“. Bez nich faktura i patička ukáže jméno, adresu,
  „Neplátce DPH“ a bankovní spojení.
- Patička: druhý řádek „Neplátce DPH · Č. ú. …“.
- Ceník (balíčky kreditů, předplatné, sady štítků) ukazuje u neplátce konečné ceny místo „… Kč s DPH“; velín ukazuje
  čekající objednávky „(neplátce DPH)“.
- Údaje jsou v `PlatformSetting` (databáze ve svazku) – build ani migrace je nepřepíší.

**4B. Sady QR štítků**

- Výchozí sady jsou v prodeji hned (`DEFAULT_LABEL_SETS` + migrace):
  - SPOTŘEBIČ & KANCELÁŘ 100 ks za 490 Kč;
  - SPOTŘEBIČ & KANCELÁŘ – VELKÁ 500 ks za 1 750 Kč;
  - ROZVÁDĚČ PROFI 50 ks za 745 Kč;
  - PRŮMYSL & STROJE 50 ks za 1 450 Kč;
  - STARTOVACÍ MIX 60 + 30 + 10 za 890 Kč.
- Kód objednávky podle složení: `LABELS_A100`, `LABELS_A60S30M10`. Fáze 112 „LABELS_50“ = 50 štítků spotřebičů.
- Po úhradě vznikne série pro každý druh štítku: spotřebič 30 × 15 mm, rozváděč 50 × 25 mm, stroj 70 × 40 mm.
- V ceníku je cena za kus a velín sady upraví (název, popis, počty druhů, cena).
- **Odchylka:** zadání píše „4 sady“, vyjmenovává ale 5 – v prodeji je všech 5.

**4C. Rozvodnice OEZ, Schneider Electric a Eaton (oficiální stránky výrobců, ověřeno 14. 11. 2026)**

- **OEZ DistriTon (oez.cz), 71 typů:**
  - RZA zapuštěné / do dutých stěn;
  - RZB oceloplechové nástěnné a zapuštěné do 198 M;
  - RZG plastové IP40;
  - RZI plastové IP65;
  - u každého typu objednací číslo, EAN, rozměry, řady × moduly, krytí, montáž a P_max („rozptyl ztrátového výkonu“).
- **Schneider Electric (se.com/cz), 44 typů:** Pragma 13 / 18 / 24 M (1–6 řad, povrchové bez dveří i s dveřmi, IP40
  s průhlednými dveřmi, zapuštěné) a Mini Pragma (Resi9 MP) 4–36 M.
- **Eaton (eaton.com/cz), 92 typů:**
  - xComfort KLV domovní (UP / HW, 12–48 M) a multimediální (Smart Home);
  - xEnergy Basic / xBoard BF-O / OT / U / UT 2–6 řad po 24 a 33 M;
  - u každého typu katalogové číslo, EAN a P_max podle IEC 60890 (ΔT 35 K).
- **Odchylky:**
  - ceníkové ceny výrobci veřejně neuvádějí (ceník OEZ jen po přihlášení) – zůstávají prázdné, nic se nedopočítává;
  - Schneider na webu neuvádí EAN ani P_max;
  - „RN / RNP“ OEZ nevede – plastové jsou RZG (IP40) a RZI (IP65);
  - Kaedra a PrismaSeT G nejsou na se.com/cz dohledatelné jako rozvodnice s řadami modulů;
  - Eaton BP / BC na eaton.com/cz nebyly;
  - OEZ RZG-N-2T40 vynechán (rozměry rozporné s RZG-N-2S40);
  - u části typů Eaton prohozená výška a hloubka – jako hloubka platí menší z obou hodnot;
  - náhledy jsou vektorové (výkres skříně z rozměrů), fotky výrobců se nestahují.

**4D. Limity tarifů a kreditů**

- Kredity jsou vynucené už od fáze 111 na serveru (Server Actions) i v UI (prodejní modal):
  - nová firma má 1 zkušební 2D půdorys + 1 zkušební rozváděč;
  - další půdorys nebo rozváděč stojí kredity.
- **⭐ Neomezený přístup** (`unlimitedAccess`, přepínač ve velínu u firmy):
  - plná verze bez kreditů a bez zkušebního označení (licence `UNLIMITED`), nabídka i CNC zdarma;
  - Hlídač bez limitu;
  - ukázková firma Elektro Tester ho má od nasazení;
  - testovací firma Správy závodů (Testovací závod, testy webu a aplikací) ho má také;
  - účet majitele zaškrtne majitel ve velínu.
- **Hlídač revizí – limit zařízení závodu:**
  - zkušební limit 50 zařízení;
  - REVIZE & BUDOVY 500, PRŮMYSL & ENTERPRISE 5 000;
  - závod bez registrované firmy (ukázkové a interní) bez limitu;
  - nad limitem srozumitelná hláška s nabídkou tarifu (přidání, import, Scan & Snap);
  - snímek Scan & Snap zůstane v offline frontě (HTTP 402), nic se nezahodí;
  - v hlavičce Hlídače štítek „📦 12 / 50 zařízení – zkušební limit“.
- **Odchylky:**
  - SUPERADMIN = firma označená ve velínu (velín má vlastní heslo, ne uživatelský účet);
  - zkušební limit Hlídače (50) zadání neuvádí – rozhodnutí;
  - veřejné demo (ukázková firma) dává s neomezeným přístupem plné výstupy každému návštěvníkovi – jde vypnout ve
    velínu.

**4E. SMTP a zálohy ve velínu**

- Nová záložka velínu „⚙️ Nastavení SMTP & Cloud záloh (R2/S3)“:
  - server, port, SSL/TLS, uživatel, heslo a odesílatel;
  - tlačítko [ Otestovat SMTP ] (ověření spojení a zkušební e-mail) a [ Odebrat SMTP ];
  - úložiště Cloudflare R2 / S3 (endpoint, bucket, klíče, prefix) a heslo šifrování záloh;
  - tlačítko [ Spustit zálohu ].
- Hesla a klíče se ukládají šifrovaně (AES-256-GCM, klíč z `ELDOCK_AUTH_SECRET`) a zpět se nezobrazují.
- Proměnné prostředí (`ELDOCK_SMTP_URL`, `ELDOCK_BACKUP_S3_*`) mají přednost.
- Plánovač i ruční záloha čtou nastavení při každém běhu, změna platí bez restartu.
- **Denní zálohy:**
  - místní snímky na serveru 14 dní (dříve 7);
  - bez cloudu klidná informace „💾 Lokální záloha na serveru je aktivní (S3/R2 cloud úložiště je volitelné)“
    místo varování.
- **Odchylka:** místní zálohy zůstávají v `/app/data/backups` – trvalý svazek dat na serveru. Nový adresář `/backups`
  by potřeboval další svazek a práva v kontejneru.

**Testy**

- `src/lib/panel-builder/pdf-room-detector.test.ts` (9):
  - popisky;
  - morfologie;
  - místnosti s dveřmi, oknem a kótou;
  - bez textové vrstvy;
  - klik;
  - tvar L;
  - měřítko z výměr.
- `src/lib/phase113.test.ts` (9):
  - podklad 2400 px / WebP;
  - podlaží s popisky;
  - otočení podkladu;
  - nová verze;
  - neplátce DPH;
  - sady štítků;
  - neomezený přístup a limity Hlídače;
  - SMTP / S3 formuláře.
- `src/server/services/phase113.test.ts` (5):
  - neomezená firma;
  - limit zařízení Hlídače;
  - mix sada štítků (3 série);
  - šifrované SMTP a úložiště, `backupConfig` z velínu;
  - 4 podlaží a nákres přes 900 kB.
- E2E `e2e/phase113.spec.ts` (3):
  - 2. NP s PDF „Uloženo v cloudu“, štítek a karta podlaží, obnova po nasazení nové verze;
  - 🪄 / 🔍 / 📐 místnosti a 3D;
  - ceník, faktura neplátce, velín SMTP a zálohy, ⭐ neomezený přístup, Hlídač, patička.
