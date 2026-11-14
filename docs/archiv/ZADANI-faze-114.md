# Zadání fáze 114 – místnosti L / T / U a rozpoznání z PDF, levý sloupec půdorysu, grafika svorkovnice HLAK a příslušenství, větší rozvodnice s rezervou, aktory free@home 4M / 8M, SSO, předběžné kredity a notifikace, provozovatel a sady QR štítků

Vloženo z chatu 2026-11-14 (po nasazení fáze 113). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Na základě živého testování na serveru (nyní navýšeném na Hetzner CPX22 se 4 GB RAM) potřebujeme naimplementovat **Fázi 114**, která vyřeší 6 konkrétních vizuálních a funkčních bodů z testování editorů a zároveň dokončí SSO přemostění, okamžité odemčení kreditů po QR platbě a výchozí nastavení provozovatele a sad QR štítků.

Zapiš tuto úlohu jako Fázi 114 do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 9 částech:

================================================================================
ČÁST 1: SPOJOVÁNÍ MÍSTNOSTÍ DO TVARU „L / T / U“ (Z Nástroje ROH -> ROH) + OPRAVA DETEKCE V PDF
================================================================================

PROBLÉM (`{9E489D6A...}.jpg`, `{97F80DDD...}.jpg`, `{3D96E76E...}.jpg`, `{B4E267AB...}.jpg`):
1) Nástroj `Rychlá místnost 2 kliky (roh -> roh)` funguje skvěle pro obdélníky, ale když je místnost tvaru `L` (např. koupelna 2.06 nebo chodba 2.01) a uživatel nakreslí dva překrývající se nebo dotýkající se obdélníky (`Místnost 4` a `Místnost 5`), zůstanou to dvě samostatné překrývající se místnosti a ve 3D náhledu se vykreslí jako dva protínající se skleněné kvádry s vnitřními stěnami!
2) Nástroj `Klikni do místnosti na PDF` se zastavuje o tenké kótovací čáry (`6885`, `3406`), oblouky dveří a nábytek uvnitř místnosti (vytvoří malý obdélník 1,6 × 1,5 m místo celého pokoje) a `Automaticky rozpoznat místnosti z PDF` na šrafovaném CAD výkresu nenajde uzavřenou místnost.

OPRAVA:
1. **Automatické a jednoklikové slučování obdélníků do L / T / U místnosti (`unionRoomPolygons` v `room-geometry.ts`):**
   - Když uživatel v nástroji `Rychlá místnost 2 kliky (roh -> roh)` (nebo `Kreslit místnost (obdélník)`) dokončí druhý obdélník, který se **překrývá nebo sdílí stěnu** s již existující místností:
     * Nabídni v horní liště nástroje zaškrtávací přepínač (ve výchozím stavu **ZAPNUTÝ `[✓] Spojovat překrývající se obdélníky do jedné L-místnosti`**) + v detailu vybrané místnosti tlačítko **`[ 🔗 Spojit s překrývající se / sousední místností do jednoho celku (L-tvar) ]`**!
     * Při spojení vypočítej **sjednocení dvou 2D polygonů (Rectilinear Polygon Boolean Union)**: odstraň vnitřní překrývající se úseky stěn a vytvoř **jednu sjednocenou polygonovou místnost (`room.points`)** ve tvaru `L`, `T` nebo `U` se sečtenou skutečnou plochou v `m²`!
     * Ve **3D náhledu (`FloorplanPseudo3DModal.tsx`)** i na 2D plátně se tak spojená místnost vykreslí jako **jeden čistý prostor do L bez jakýchkoliv vnitřních překrývajících se stěn**!
2. **Vylepšení `Klikni do místnosti na PDF` a `Automaticky rozpoznat místnosti z PDF` pro CAD výkresy s kótami:**
   - Před spuštěním Flood-Fill algoritmu na rastrovaném PDF podkladu aplikuj **morfologickou filtraci tloušťky čar**:
     * Odstraň / ignoruj tenké 1–2px čáry (kótovací čáry, vynášecí čáry, osy řezů `A-A'`, oblouky dveří, texty a obrysy nábytku).
     * Jako bariéru stěny ber pouze **tlusté obrysové čáry zdiva a šrafované pásy nosných stěn a příček** (případně po morfologickém uzavření hustého šrafování zdiva do plného pásu stěny).
     * Pokud přesto Flood-Fill narazí na malou oblast (`< 3,5 m²`), automaticky zkus druhé kolo s vyšším prahem filtrace tenkých čar, aby našel skutečné obvodové stěny pokoje!

================================================================================
ČÁST 2: OPRAVA FORMÁTOVÁNÍ LEVÉHO SLOUPCE V 2D PŮDORYSU (`FloorplanEditor`)
================================================================================

PROBLÉM (`{9E489D6A...}.jpg`, `{3D96E76E...}.jpg`):
- V levém sloupci Kroku 1 (`Půdorys a místnosti`) jsou tlačítka `Nahrát půdorys (PDF / DXF / BI...` oříznutá na pravém kraji, některé popisky přetékají šířku sloupce a rozestupy působí stísněně.

OPRAVA:
- Zkontroluj všechny prvky v levém sloupci `/panel-builder/floorplan`:
  * Nastav všem tlačítkům a kartám v levém panelu `w-full min-w-0 whitespace-normal text-left leading-snug` a uprav texty tak, aby se žádné písmeno nikdy neořízlo za okrajem (např. `Nahrát půdorys (PDF / DXF / Obrázek)` s čistým zalomením nebo kompaktním podřádkem).
  * Sjednoť vnitřní odsazení (`p-2.5 gap-2`), zarovnej vstupy rozměrů `X × Y` a tlačítka podlaží (`1. NP`, `2. NP`) do čisté, nepřetékající mřížky.

================================================================================
ČÁST 3: REALISTICKÁ GRAFIKA SVORKOVNICE `-X1` (HLAK) NA DIN LIŠTĚ (`{44305C70...}.png`)
================================================================================

PROBLÉM (`{44305C70...}.png`):
- Přístroj `-X1` (`ABB Svorka / svorkovnice 1P – Rozbočovací svorkovnice (HLAK)`) se na DIN liště vykresluje jako generický šedý obdélník se 4 horními šrouby, 4 dolními šrouby a malým obdélníčkem se zelenou a oranžovou tečkou uprostřed. Vůbec nevypadá jako rozbočovací svorkovnice HLAK ani jako řadová svorka.

OPRAVA v `src/lib/panel-builder/vector-symbols.ts` (`VectorModuleSymbol`):
- Vytvoř pro kategorii `Svorka / svorkovnice` (`terminal` / `hlak` / `-X*`) **věrnou vektorovou grafiku podle skutečného provedení**:
  1) **Rozbočovací svorkovnice `HLAK` (šířka 2M až 4M, např. 4pólová nebo 5pólová HLAK 25/35 mm²):**
     * Vykresli charakteristické **barevně odlišené izolační komory vedle sebe**:
       - Póly `L1, L2, L3` (šedé / hnědé / černé komory),
       - Pól `N` (modrá komora `#1d4ed8`),
       - Pól `PE` (zelenožlutá komora `#15803d` se žlutým pruhem `#eab308`).
     * Uvnitř každé komory vykresli **mosazné svorkové těleso** se 2 velkými zdířkami/šrouby pro přívod a 2–4 menšími zdířkami pro vývody + čitelný štítek `-X1` a `HLAK 25/16 mm²`.
  2) **Řadová svorka na DIN lištu (`0,5M` až `1M`):**
     * Vykresli profil skutečné řadové svorky (šedá fázová, modrá N nebo zelenožlutá PE) s horní a spodní klecovou svorkou, popisovým štítkem uprostřed a můstkovou drážkou.

================================================================================
ČÁST 4: VÝBĚR VĚTŠÍCH ROZVODNIC S REZERVOU V PROCENTECH PŘI GENEROVÁNÍ Z 2D PŮDORYSU
================================================================================

PROBLÉM: Při generování rozváděče z 2D půdorysu (`SwitchboardLayoutWizardModal.tsx` a v kroku `1b Skříň rozváděče`) ukazuje program základní rozvodnice pro dané uspořádání, ale chybí tam přímá možnost vybrat si **větší rozvodnici (s více řadami / moduly)**, u které by uživatel rovnou viděl výslednou **rezervu v procentech (%)**.

OPRAVA:
1. V modalu `SwitchboardLayoutWizardModal.tsx` (který vyskakuje při exportu z 2D půdorysu do Panel Builderu a při kliknutí na `Uspořádání skříně a lišt`) přidej pod zvolenou koncepci (`Dvoupolová skříň`, `Široké lišty 24M`, `18M lišty`, `12M lišty`) sekci:
   **`📦 Zvolte velikost rozvodnice a požadovanou rezervu (dle ČSN EN IEC 61439 min. 20 %):`**
2. Nabídni přehledné přepínací karty **od nejmenší vyhovující až po větší skříně s velkorysou rezervou** (se skutečnými modely z databáze ABB, OEZ, Hager, Eaton, Schneider), kde je na každé kartě tučně vypsáno:
   - **Kapacita skříně (počet polí × řad × modulů)**, např. `144 M (2 pole × 6 řad)` -> `168 M (2 pole × 7 řad)` -> `192 M` -> `216 M` -> `240 M`,
   - **Přesná volná rezerva v % a v modulech:** např. **`🟢 Rezerva 23 % (33 volných M)`** vs. **`🟢 Rezerva 34 % (57 volných M – Doporučeno pro budoucí rozšíření)`** vs. **`🟢 Rezerva 46 % (81 volných M)`**,
   - **Konkrétní modely skříní v této velikosti:** např. *ABB ComfortLine CA26V / CA27V*, *OEZ DistriTon RZA*, *Eaton xEnergy BF*, *Schneider PrismaSeT / Pragma*.
3. Jakmile si uživatel vybere větší variantu (např. se 35% nebo 45% rezervou), rozváděč se rovnou vygeneruje s tímto počtem DIN lišt a předvybranou větší skříní!

================================================================================
ČÁST 5: ŽALUZIOVÉ (`BA-M`) A TOPNÉ (`HA-M`) AKTORY ABB-free@home VE VELIKOSTECH 4M I 8M
================================================================================

PROBLÉM (`{F88211A4...}.jpg` a `{272D734E...}.png`):
- Žaluziové aktory `ABB-free@home` (`BA-M`) i topné aktory (`HA-M`) se ve skutečnosti vyrábějí jak ve velikosti **4 moduly (4M)**, tak ve velikosti **8 modulů (8M)**, ale v katalogu a generátoru chybí plná podpora obou velikostí (např. u topení se nabízí jen 8M `HA-M-0.12.1`).

OPRAVA v `src/lib/panel-builder/smart-home.ts`, `smart-din-catalog.ts`, `seed-abb-2026.ts` a `CascadePicker`:
1. **Žaluziové aktory ABB-free@home (`Žaluziový aktor`):**
   - **4M varianta (4kanálová):** **`ABB BA-M-4.230.2.1`** (MPN `2CDG510028R0011`, EAN `4016779958172`, šířka **`4 M`**, 4 kanály 230 V AC, $P_v = 1,5\text{ W}$).
   - **8M varianta (8kanálová):** **`ABB BA-M-8.230.2.1`** (MPN `2CDG510029R0011`, EAN `4016779958189`, šířka **`8 M`**, 8 kanálů 230 V AC, $P_v = 2,5\text{ W}$).
2. **Topné aktory ABB-free@home (`Topení / ventily`):**
   - **4M varianta (6kanálová):** **`ABB HA-M-0.6.1`** (MPN `2CDG510008R0011`, EAN `4011395190234`, šířka **`4 M`**, 6 bezhlučných výstupů pro termoelektrické pohony 24 V / 230 V, $P_v = 2,0\text{ W}$).
   - **8M varianta (12kanálová):** **`ABB HA-M-0.12.1`** (MPN `2CDG510009R0011`, EAN `4011395190241`, šířka **`8 M`**, 12 výstupů pro termoelektrické pohony, $P_v = 3,5\text{ W}$).
3. **Automatický výběr i ruční volba v kaskádě (`CascadePicker`):**
   - V automatickém plánovači `planSmartHome` (`chooseModules`) vybírej optimální kombinaci `4M` a `8M` modulů podle počtu žaluzií a topných zón (např. pro 1–4 žaluzie dej `1× 4M BA-M-4.230.2.1`, pro 5–8 žaluzií `1× 8M BA-M-8.230.2.1`; pro 1–6 topných okruhů/hlavic dej `1× 4M HA-M-0.6.1`, pro 7–12 okruhů `1× 8M HA-M-0.12.1`).
   - V pravém panelu `Vložit nový přístroj -> Chytrá domácnost -> C3. POČET KANÁLŮ / ŠÍŘKA` umožni jedním klikem přepnout mezi **4M** (`4×` u žaluzií / `6×` u topení) a **8M** (`8×` u žaluzií / `12×` u topení) a vykresli na DIN liště skutečnou šířku **4 moduly** nebo **8 modulů**!

================================================================================
ČÁST 6: UNIKÁTNÍ VĚRNÉ NÁHLEDOVÉ OBRÁZKY PRO VŠECHNY POLOŽKY V „SVORKY / HŘEBENY / PŘÍSLUŠENSTVÍ“ (`{07796F4A...}.png`)
================================================================================

PROBLÉM (`{07796F4A...}.png`):
- V kaskádovém výběru `B. KATEGORIE -> Svorky / Hřebeny / Příslušenství` zobrazují všechny podtypy (`Svorka / svorkovnice`, `Hřebenová propojovací lišta`, `Koncovka hřebenu`, `Pomocný kontakt`, `Vypínací spoušť`, `Podpěťová spoušť`, `Pojistková vložka`, `Zásuvka na DIN`, `Signálka / kontrolka`, `Záslepka`) úplně stejný obrázek úzkého 0,5M pomocného kontaktu!

OPRAVA v `src/lib/panel-builder/vector-symbols.ts` (jak v náhledu `PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ`, tak přímo na DIN liště):
Vykresli pro každý z 10 podtypů příslušenství (`C1. DRUH PŘÍSLUŠENSTVÍ`) **vlastní, okamžitě rozpoznatelnou technickou grafiku odpovídající skutečnosti**:
1. **`Svorka / svorkovnice`:** Barevný rozbočovací blok `HLAK` (zelenožlutá PE, modrá N, šedá/hnědá L se zdířkami) pro šířky 2M–4M, nebo profil řadové svorky pro 0,5M–1M.
2. **`Hřebenová propojovací lišta`:** Vodorovný výřez **měděné hřebenové přípojnice** s šedobílým izolačním profilem, měděnými vidličkami (`1P`, `2P`, `3P` nebo `4P`) a potiskem `L1 · L2 · L3 · 10/16 mm²`.
3. **`Koncovka hřebenu`:** Výrazná **žlutá izolační koncová krytka** (`Koncovka hřebenu KDN / PS-END`) nasazovaná na bok měděné lišty.
4. **`Pomocný kontakt`:** Úzký `0,5 M` boční modul s páčkou, indikačním okénkem stavu a svorkami `13–14 / 21–22`.
5. **`Vypínací spoušť` (`FA / S2C-A`):** `1 M` modul s červeným terčíkem/páčkou spouště, mechanickým unašečem a svorkami cívky `C1–C2`.
6. **`Podpěťová spoušť` (`FU / S2C-UA`):** `1 M` modul se žlutomodrým označením `U <`, páčkou a svorkami `D1–D2`.
7. **`Pojistková vložka` (`OPV / E90`):** Modulární válcový pojistkový odpínač s výklopným šuplíkem pro vložku `10×38 gG / gPV` a popisovým okénkem.
8. **`Zásuvka na DIN` (`2,5 M / 3 M`):** Modulární domovní zásuvka `230 V / 16 A` na DIN lištu s kruhovou dutinou zásuvky, dvěma zdířkami a zemnicím kolíkem (`PE`).
9. **`Signálka / kontrolka`:** Modul s 1 až 3 svítícími kruhovými LED čočkami (zelená / červená / žlutá pro `L1 · L2 · L3`).
10. **`Záslepka`:** Čistý hladký krycí plastový pás s naznačenými 1M odlamovacími segmenty (`Krycí záslepka výřezu`).

Doplň zároveň ke každému z těchto podtypů reálné objednací číslo (`MPN`) zvoleného výrobce (ABB, OEZ, Eaton, Hager, Schneider), aby u nich nesvítilo `MPN — odhad IEC`!

================================================================================
ČÁST 7: JEDNOTNÉ PŘIHLÁŠENÍ (SSO PŘEMOSTĚNÍ) MEZI PANEL BUILDEREM A HLÍDAČEM REVIZÍ / ZÁVODEM
================================================================================

PROBLÉM: AI Panel Builder používá přihlášení `RegisteredCompany` (`cookie: eldock-pb`), zatímco `/hlidac-revizi` a Správa závodů používají `UserSession` (`/login`). Revizní technik nebo elektrikář se při přechodu mezi rozváděči a Hlídačem revizí musí registrovat a přihlašovat dvakrát.

OPRAVA:
- Vytvoř bezpečné serverové přemostění (`src/server/services/sso-bridge.ts`):
  * Když je uživatel přihlášený v AI Panel Builderu (`getPanelCompany()`) a přejde do `/hlidac-revizi` (nebo klikne na `Otevřít Hlídač revizí / Správu budov`), nabídni mu jednoklikové tlačítko **`[ 🔄 Pokračovat pod mým účtem z Panel Builderu (<název firmy / e-mail>) ]`** (nebo ho rovnou přihlas), které mu automaticky najde nebo založí spárovaný účet budovy/závodu se stejným e-mailem a nastaví relaci bez nutnosti vyplňovat druhou registraci!
  * Stejně tak umožni přihlášenému uživateli Správy závodů / Hlídače revizí jedním klikem přejít do AI Panel Builderu (včetně přenosu rozváděče z BIMu do Panel Builderu bez hlášky o chybějícím druhém přihlášení!).

================================================================================
ČÁST 8: OKAMŽITÉ ODEMČENÍ KREDITŮ PO QR PLATBĚ (OPTIMISTIC UNLOCK) + NOTIFIKACE OBJEDNÁVKY
================================================================================

PROBLÉM: Když elektrikář zaplatí kredity přes QR kód (SPD) večer nebo o víkendu, objednávka zůstane `PENDING` až do ručního potvrzení ve velínu `/superadmin`, což zdržuje práci.

OPRAVA:
1. V okně výzvy k platbě / faktury s QR kódem (`/panel-builder/credits/[orderId]/invoice`) přidej tlačítko:
   **`[ ✅ Zaplatil jsem QR kódem – aktivovat kredity ihned (předběžné připsání na 48 h) ]`**.
   - Po kliknutí (maximálně pro 1 neuhrazenou objednávku na firmu současně!) okamžitě zpřístupni objednané kredity v režimu `PROVISIONAL_GRANT` (označené ve velínu žlutým štítkem `⏳ Čeká na kontrolu výpisu z banky`), aby zákazník mohl ihned v téže minutě dokončit a stáhnout svou zakázku!
   - Ve velínu `/superadmin` pak majitel jedním klikem buď potvrdí přijatou platbu (`Potvrdit platbu v bance`), nebo při nezaplacení po 48 hodinách předběžné kredity odečte.
2. Při každém vytvoření objednávky kreditů nebo sad QR štítků odešli majiteli okamžitou notifikaci (přes `ELDOCK_SMTP_URL` / `ELDOCK_CONTACT_WEBHOOK_URL` a zvýrazněný odznak ve velínu `/superadmin`).

================================================================================
ČÁST 9: DOKONČENÍ NASTAVENÍ PROVOZOVATELE (NEPLÁTCE DPH) A PŘEDNAPLNĚNÍ SAD QR ŠTÍTKŮ
================================================================================

1. **Výchozí profil provozovatele (`lib/operator.ts` a `DEFAULT_OPERATOR`):**
   - Nastav ve výchozím stavu **`isVatPayer: false` (`Neplátce DPH`)**!
   - Ujisti se, že pole `ico`, `dic` a `registryNote` jsou zcela volitelná – dokud nejsou ve velínu vyplněná, na všech výzvách k platbě, v ceníku i v patičce se zobrazuje čistě `Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou · Neplátce DPH` a platný účet Raiffeisenbank (`918118002/5500` / IBAN) bez jakýchkoliv upozornění na chybějící údaje.
2. **Automatické přednaplnění (Seed) sad QR štítků (`labelSetsOf`):**
   - Ve výchozí konfiguraci `DEFAULT_OPERATOR` (a při startu, pokud je seznam sad prázdný) automaticky přednaplň **5 prodejních sad odolných QR štítků ELDOCK**:
     1) `Sada SPOTŘEBIČ & KANCELÁŘ (100 ks · 30×15 mm)` – `490 Kč`
     2) `Sada SPOTŘEBIČ & KANCELÁŘ – VELKÁ (500 ks · 30×15 mm)` – `1 750 Kč`
     3) `Sada ROZVÁDĚČ PROFI (50 ks · 50×25 mm · Stříbrný PET)` – `745 Kč`
     4) `Sada PRŮMYSL & STROJE (50 ks · 70×40 mm · Stříbrný PET)` – `1 450 Kč`
     5) `STARTOVACÍ MIX SADA ELDOCK (100 ks: 60× Spotřebič + 30× Rozváděč + 10× Stroj)` – `890 Kč`
   - Objednávání sad QR štítků tak bude okamžitě aktivní hned po nasazení!

================================================================================
TESTY, DOKUMENTACE A NASAZENÍ NA PRODUKCI (4 GB RAM SERVER)
================================================================================

1. Napiš unit testy ověřující:
   - Že `unionRoomPolygons` spojí dva překrývající se obdélníky z nástroje `roh -> roh` do jedné polygonové L-místnosti bez vnitřních dělicích stěn v 2D i 3D pohledu.
   - Že aktory `ABB-free@home` pro žaluzie (`BA-M-4.230.2.1` 4M a `BA-M-8.230.2.1` 8M) i pro topení (`HA-M-0.6.1` 4M a `HA-M-0.12.1` 8M) jsou dostupné v obou šířkách.
   - Že všech 10 podtypů v kategorii `Svorky / Hřebeny / Příslušenství` vykresluje odlišnou, věrnou vektorovou grafiku (včetně barevné svorkovnice `HLAK`).
   - Že funguje SSO přemostění účtů, předběžné odemčení kreditů po QR platbě (`PROVISIONAL_GRANT`) a výchozí profil neplátce DPH se sadami QR štítků.
2. Aktualizuj v `CLAUDE.md` poznámku o produkčním serveru (nyní Hetzner CPX22 se 4 GB RAM), spusť `npm run verify` a `npm run docs:bundle`, udělej commit a nasaď na produkci `https://eldock.cz`.

## Rozhodnutí při implementaci

**Migrace `20261114120000_phase114_sso_provisional`** (před nasazením záloha databáze):

- `RegisteredCompany.email` je jedinečný v rámci produktu (`@@unique([email, productScope])` místo `@unique`) – spárovaný
  účet AI Panel Builderu a Správy závodů smí mít stejný e-mail.
- `RegisteredCompany.linkedCompanyId` (jedinečné) – spárovaný účet druhého produktu, uložený na obou stranách.
- `CreditOrder.provisionalAt`, `provisionalRevokedAt`, `ownerNotifiedAt`, `ownerNotifyError` – předběžné připsání kreditů
  a výsledek notifikace majiteli.

**1. Místnosti L / T / U a rozpoznání z PDF**

- **Sjednocení** (`unionRooms` / `unionRoomPolygons` v `room-geometry.ts`):
  - pravoúhlé místnosti přes komprimaci souřadnic a obrys buněk; stěny do 2 cm od sebe se zarovnají;
  - výsledek je jeden obrys L, T nebo U se sečtenou plochou (2D i 3D bez vnitřních stěn);
  - nespojí se: šikmé stěny, místnosti bez společné stěny (i jen přes roh) a spojení s dírou uprostřed – hláška.
- **Přepínač** „Spojovat překrývající se obdélníky do jedné L-místnosti“ (výchozí zapnutý, pamatuje si ho prohlížeč) je
  v liště nástrojů „Kreslit místnost (obdélník)“ i „Rychlá místnost 2 kliky“:
  - obdélník, který se **překrývá** s místností, ji rovnou rozšíří (zůstane její název, prvky v nové části převezme);
  - **odchylka:** obdélník, který jen **sdílí stěnu**, se automaticky nespojí – sousední pokoje bytu stěny sdílí běžně.
    Oznámení nabídne „🔗 Spojit do L“ a detail místnosti tlačítko „🔗 Spojit s překrývající se / sousední místností do
    jednoho celku (L-tvar)“ (víc kandidátů = výběr).
- **Detektor** (`pdf-room-detector.ts`) – 7 vrstev bariér počítaných líně:
  - zdivo, husté šrafy zacelené do plného pásu (rozteč do ~16 cm), otvory do 1,6 m, jen obrysové čáry od 3 px (1–2px
    kóty, osy řezů, oblouky dveří, text a nábytek pryč), od 5 px, zdivo s okny do 0,4 m, všechny čáry;
  - klik do místnosti: ze dvou zdivových vrstev menší oblast (větší unikla přes chybějící příčku); oblast pod 3,5 m²
    = další kolo; když nic většího nevyjde, platí první nalezená (malé WC); oblast se 2 a více popisky = další vrstva;
  - automatika bez popisků vybere vrstvu s největší plochou místností; pracovní rastr 2400 px (klik ~0,4 s).

**2. Levý sloupec kroku 1**

- Tlačítka a karty `w-full min-w-0 whitespace-normal text-left leading-snug`, odsazení `p-2.5 gap-2`.
- „Nahrát půdorys“ s podřádkem „(PDF / DXF / BIM .ifc / Obrázek)“; kalibrace a Úprava PDF vedle sebe v mřížce.
- Rozměry X × Y a podlaží (`RoomBySizeForm` / `FloorBar` v režimu `stacked`) v mřížce – nic nepřeteče šířku sloupce
  (ověřeno testem v prohlížeči při 1440 px).

**3. a 6. Grafika svorkovnice a příslušenství**

- `AccessorySymbol.tsx` + `lib/panel-builder/accessory-symbols.ts` – 10 rozpoznatelných kreseb na DIN liště i v kartě
  „Přiřazený přístroj k osazení“:
  - svorkovnice HLAK od 2M: komory L1 / L2 / L3 / N / PE (1f: L / N / PE) v barvách vodičů, mosazná tělesa se 2 velkými
    a 2–4 malými zdířkami, popis „-X1“ a „HLAK 25/16 mm²“; řadová svorka 0,5–1M (klecové svorky, štítek, můstková drážka;
    šedá / modrá N / zelenožlutá PE);
  - hřeben (izolace, měď, vidličky, „L1 · L2 · L3 · 10/16 mm²“), žlutá koncovka, pomocný kontakt, vypínací spoušť
    (červený terčík, unašeč, C1–C2), podpěťová spoušť („U <“, D1–D2), pojistkový odpínač s vložkou 10 × 38, zásuvka na DIN
    s kolíkem PE, signálka s 1–3 LED, záslepka s 1M segmenty.
- Podtyp se bere z konfigurace, z katalogu (`moduleSubtype`, HLAK = `MAIN_TERMINAL`), jinak z typového označení
  (ne z popisu obvodu). Volba podtypu v kaskádě nastaví typickou šířku (HLAK 4M, pomocný kontakt 0,5M, zásuvka 3M …).
- **Objednací čísla jen z oficiálních dat výrobců** (`prisma/seed-accessories-2026.ts`, 23 kusů):
  - ABB: S2C-H6R, S2C-A2 (stránky new.abb.com – typ, EAN, šířka, Pv), svorkovnice N / PE 41Z57 / 41Z62 a záslepka 41Z23
    (ABB ETIM 9.0); hřeben PS, PS-END, signálky E219, zásuvky M1174 / M1175 a pojistkové odpínače E 91 už v katalogu byly;
  - OEZ (ETIM 8): SV-LT-X400, SP-LT-A230, CS-N12, PD-RA-ZAS-B; Hager (BMEcat ETIM 10): MZ201, MZ203, MZ206, LF316G, SVN121;
  - Schneider Electric (se.com): iOF, iMX, iMN, A9XPH312, A9XPE110, STI 1P, iPC 2P+E (francouzský standard), iIL,
    Linergy LGY412548, záslepka 13940.
- **Nedohledáno (bez vymyšleného čísla – zůstává odhad IEC):** ABB podpěťová spoušť S2C-UA, Eaton koncovka hřebene
  a pojistka (ostatní podtypy Eatonu jsou z importu katalogu).
- Pojistková vložka najde i pojistkový odpínač (ABB E 91, OEZ OPV), svorkovnice i HLAK; skutečný kus má vždy přednost
  před syntetickým `CFG-…`; štítek „odhad IEC“ se u skutečného kusu ukáže jen u ztrátového výkonu.

**4. Velikost rozvodnice s rezervou**

- Průvodce ukáže pod koncepcí „📦 Zvolte velikost rozvodnice a požadovanou rezervu (dle ČSN EN IEC 61439 min. 20 %)“:
  - až 5 velikostí od nejmenší vyhovující (pole × řady × šířka), rezerva v % i ve volných modulech;
  - „Doporučeno pro budoucí rozšíření“ = první velikost s rezervou aspoň 30 %;
  - v každé velikosti skutečné modely z databáze, výrobce přístrojů napřed a pak po jednom od dalších výrobců.
- Po vlastní volbě velikosti / modelu se rozváděč vygeneruje (i přeuspořádá z lišty plátna) s tolika DIN lištami, kolik
  má skříň řad (`fillRailsToEnclosure` – u 2 polí obě pole, s přepážkou prázdné lišty nad přepážku). Bez volby beze
  změny proti fázi 111.

**5. Aktory ABB-free@home BA-M a HA-M**

- **Odchylka od zadání:** typy „BA-M-4.230.2.1“ / „BA-M-8.230.2.1“ a EAN 4016779958172 / …189 / 4011395190234 / …241
  výrobce nevede. Podle ABB ETIM 9.0 a produktových stránek ABB:
  - BA-M-4.230.1.1 (2CDG510028R0011, EAN 4053546111347, 4 M, 1,5 W) a BA-M-8.230.1.1 (2CDG510029R0011,
    EAN 4053546111354, 8 M, 3 W – zadání 2,5 W);
  - HA-M-0.6.1 (2CDG510008R0011, EAN 4016779941815, 4 M, 2 W) a HA-M-0.12.1 (2CDG510009R0011, EAN 4016779941808, 8 M,
    4 W – zadání 3,5 W).
- Plánovač ABB-free@home: žaluzie a topné okruhy bez rezervy kanálů navíc (1–4 žaluzie = 4M, 5–8 = 8M; 1–6 okruhů =
  HA-M-0.6.1, 7–12 = HA-M-0.12.1); Loxone, KNX a TapHome dál s rezervou 20 % (aspoň 1 kanál) podle fáze 77. Důsledek:
  tréninkový chytrý dům ABB-free@home se vejde do 96 M místo 120 M (název předvolby trenažéru upraven).
- Kaskáda „C3. Počet kanálů / šířka“ u žaluzií a topení nabízí skutečné kusy systému: „4× · 4M“ / „8× · 8M“ (topení
  „6× · 4M“ / „12× · 8M“); na DIN liště skutečná šířka.

**7. SSO přemostění** (`server/services/sso-bridge.ts`, `server/sso-session.ts`, `server/actions/sso.ts`)

- „🔄 Pokračovat pod mým účtem z Panel Builderu (firma / e-mail)“ na `/hlidac-revizi`, `/login` a odkaz 🛡️ v hlavičce
  Panel Builderu; opačně „🔄 Pokračovat pod účtem Správy závodů“ na přihlášení Panel Builderu (jen s oprávněním Panel
  Builderu) a přenos rozváděče z BIMu se přemostí sám.
- Bez spárování se založí spárovaný účet druhého produktu se stejným e-mailem i heslem (závod + technický ředitel,
  respektive firma AI Panel Builderu s 1 testovacím projektem).
- **Bezpečnost:** nespárovaný účet se stejným e-mailem se nepřebírá (e-mail při registraci nikdo neověřuje – převzetí
  cizího účtu). Uživatel se do něj jednou přihlásí heslem a „🔗 Propojit účty“ (správce firmy) je spáruje. Účet
  s dvoufázovým ověřením se přihlásí vždy kódem.
- Ukázková firma Tester je při startu propojená s veřejnou testovací firmou Správy závodů (`test@eldock.cz`) – SSO
  z ukázky nezakládá další sdílený účet.

**8. Předběžné kredity a notifikace**

- „✅ Zaplatil jsem QR kódem – aktivovat kredity ihned (předběžné připsání na 48 h)“ na výzvě k platbě i na faktuře
  (na tisku není):
  - jen balíčky kreditů (předplatné a sady QR štítků až po připsání platby), nejvýš 1 předběžná objednávka firmy;
  - kredity hned (pohyb `PROVISIONAL_GRANT`), objednávka čeká na úhradu.
- Velín:
  - žlutý štítek „⏳ Čeká na kontrolu výpisu z banky“ s lhůtou (po 48 h červeně), odznaky záložky Objednávky (čekající
    a ⏳);
  - „✅ Potvrdit platbu v bance“ (kredity se nepřipíšou podruhé) nebo „↩️ Odečíst předběžné kredity“ – storno a odečet
    (zůstatek může klesnout pod nulu), firma už předběžné připsání nedostane; obyčejné storno předběžné objednávky nejde.
- Notifikace majiteli při každé objednávce kreditů / štítků i při předběžném připsání:
  - SMTP (`ELDOCK_SMTP_URL` nebo SMTP z velínu), Resend, webhook `ELDOCK_CONTACT_WEBHOOK_URL`;
  - příjemce `ELDOCK_CONTACT_NOTIFY_EMAIL`, jinak e-mail provozovatele;
  - výsledek u objednávky ve velínu (📧 / ⚠️), bez SMTP i webhooku „jen ve velínu“.

**9. Provozovatel a sady štítků**

- Výchozí neplátce DPH a volitelné IČO / DIČ / spisová značka už z fáze 113 (`vatPayer`, `registry` = `isVatPayer`,
  `registryNote` ze zadání).
- Dodavatel jedním řádkem „Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou · Neplátce DPH“ a účet Raiffeisenbank
  918118002/5500 / IBAN na výzvě k platbě a v cenících (`operatorSummary`, `bankLine`).
- Prázdný seznam sad QR štítků = 5 výchozích sad; při startu kontejneru je `db:panel-builder` zapíše, když chybí nebo
  jsou prázdné; prázdný seznam už ve velínu uložit nejde.

**Server:** produkční server navýšen na Hetzner CPX22 (4 GB RAM) – poznámky v `CLAUDE.md`, `next.config.ts`
a `Dockerfile`.
