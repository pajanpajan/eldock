# Zadání fáze 108 – průmyslová část: úprava, přesun a smazání budov, rozvržení podlaží, Chytrá revize (optimalizace výjezdu technika), formulář revizního technika s podpisem a pečetí SHA-256, měsíční report a ochrana osvědčení TIČR

Vloženo z chatu 2026-11-13 jako prioritní fáze (během zadání 2D půdorysu, které se tím posunulo na fázi 109). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Provedli jsme testování průmyslové části aplikace (`/plant/...`, `/revize`, `/rychla-revize`, `/planovac`, `/studio`) a narazili jsme na konkrétní chyby v ovládání, rozbité rozvržení obrazovky a chybějící funkce pro revizní techniky.

Zapiš tuto etapu jako prioritní fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 6 částech:

================================================================================
ČÁST 1: MOŽNOST ODSTRANIT, UPRAVIT A POSUNOUT BUDOVU + KONEC PŘEKRÝVÁNÍ HAL NA MAPĚ
================================================================================

PROBLÉM (`{34F613CD-11CE-447E-ACC9-56D96ADC851B}.jpg` a `{BA9CE0F6-0767-4CE7-BF61-59D1F0ECFB1A}.jpg`):
1) Když uživatel přidá budovu přes rychlé tlačítko `+ Přidat budovu do závodu`, nová budova (např. `Hala 1 - Výroba`) se na 2D mapě závodu položí přímo přes stávající budovy (`Hala A - Lisovna` a `Administrativa`).
2) Nikde v pravém seznamu budov, na mapě ani v detailu budovy (`/plant/[plantId]/building/[buildingId]/...`) není možnost přidanou budovu **odstranit (smazat)**, přejmenovat nebo změnit její pozici/rozměry!

OPRAVA:
1. **Okamžitá možnost odstranit a upravit budovu (na 3 místech):**
   - **V pravém seznamu budov na stránce závodu (`/plant/[plantId]`):** Ke každé kartě budovy přidej kromě šipky `>` také rychlé akční ikony **`[ ✏️ Upravit ]`** (změna názvu, kódu, rozměrů a pozice X/Y na mapě) a **`[ 🗑️ Odstranit budovu ]`**!
   - **Přímo na 2D mapě areálu:** Po kliknutí nebo najetí na budovu na mapě zobraz v rohu budovy rychlou lištu `[ ✥ Posunout ]` · `[ ✏️ Upravit ]` · `[ 🗑️ Smazat ]` a umožni budovu na mapě jednoduše přetáhnout myší (Drag & Drop) na volné místo!
   - **V hlavičce detailu budovy / podlaží (`/plant/[plantId]/building/[buildingId]/floor/[floorId]`):** Vedle nadpisu budovy (`1. NP - Výroba`) přidej tlačítka **`[ ← Zpět na mapu závodu ]`**, **`[ ✏️ Upravit budovu / podlaží ]`** a červené tlačítko **`[ 🗑️ Odstranit tuto budovu ]`** (po potvrzení budovu smaže ze stavu i `localStorage`/DB a přesměruje uživatele zpět na mapu závodu `/plant/[plantId]`).
2. **Chytré umístění nově přidané budovy bez kolize (Non-overlapping Placement):**
   - Uprav funkci pro přidání nové budovy (`+ Přidat budovu do závodu`) tak, aby zkontrolovala obdélníky (`x, y, width, height`) všech stávajících budov na mapě a novou budovu automaticky umístila na **první volnou pozici v areálu bez jakéhokoliv překryvu se stávajícími halami**!

================================================================================
ČÁST 2: OPRAVA ROZBITÉHO LAYOUTU V DETAILU HALY A KOMPLETNÍ AUDIT PRŮMYSLOVÉ ČÁSTI
================================================================================

PROBLÉM (`{BA9CE0F6-0767-4CE7-BF61-59D1F0ECFB1A}.jpg`):
- Na stránce podlaží budovy (`/plant/[plantId]/building/[buildingId]/floor/[floorId]`) je celá levá třetina obrazovky (~35 % šířky) prázdná černá díra a obsah je natlačený pouze do pravé části obrazovky!
- Spodní plovoucí žluté tlačítko `Zapsat hromadnou revizi (1 vybráno)` překrývá řádky tabulky `Zařízení na patře`.

OPRAVA:
1. Zkontroluj a oprav CSS layout v `src/app/plant/[plantId]/building/[buildingId]/floor/[floorId]/page.tsx` (i v nadřazených layout souborech `/plant/**`):
   - Odstraň prázdný levý grid sloupec / přebytečný `ml-*` offset, který odsouvá obsah doprava! Celá stránka podlaží musí být čistě vycentrovaná na plnou šířku (`max-w-[1600px] mx-auto w-full px-4 sm:px-6`).
   - Přidej spodní tabulce dostatečný vnitřní odstup (`pb-28`), aby plovoucí akční lišta `Zapsat hromadnou revizi` nikdy nepřekrývala poslední řádky tabulky.
2. Proveď audit všech podstránek průmyslové části (`/`, `/plant/[plantId]`, `/revize`, `/planovac`, `/rychla-revize`, `/audit`, `/studio`, `/moduly`, `/ucty`):
   - Zajisti, aby nově přidané budovy, rozváděče, stroje i zapsané revize byly **100% synchronizované přes společný perzistentní stav/úložiště** napříč všemi těmito stránkami i 4 fázemi průvodce!
   - V detailu podlaží (`1. NP - Výroba`) přidej přímo nad mapu haly jasné tlačítko **`[ + Přidat rozváděč nebo stroj na toto podlaží ]`** a možnost smazat nebo přesunout vybrané zařízení v hale.

================================================================================
ČÁST 3: NÁVRAT A VYLEPŠENÍ „CHYTRÉ REVIZE (OPTIMALIZACE VÝJEZDU TECHNIKA)“
================================================================================

PROBLÉM: Z průmyslové části se vytratila klíčová funkce **Chytré revize**, která před tím, než revizní technik vyrazí do závodu dělat revizi jednoho zařízení, automaticky nabídne a přibalí i ostatní revize v téže hale nebo závodě, kterým se blíží expirace!

OPRAVA – Vytvoř a viditelně zapoj komponentu **`SmartRevisionTripOptimizer.tsx`** na 3 klíčových místech (v přehledu závodu `/plant/[plantId]`, v detailu podlaží budovy i na stránkách `/revize` a `/planovac`):

1. **Jak funguje logika Chytré revize („Když už tam revizní technik jede“):**
   - Kdykoliv je v závodě alespoň 1 zařízení po termínu revize (`EXPIRED`) nebo do 30 dnů před expirací (`DUE_SOON`), systém automaticky prohledá celý závod (seřazený podle stejné budovy -> sousedních budov) a najde všechna další zařízení (rozváděče, stroje, nouzová osvětlení, spotřebiče), kterým končí revize v horizontu **30 / 60 / 90 / 180 dnů** (přepínatelný horizont!).
2. **Přehledný banner a jednoklikové sloučení do jednoho výjezdu:**
   - Zobraz výrazný chytrý panel:
     * **`🧠 Chytrá revize – Optimalizace výjezdu revizního technika:`**
     * *"Než revizní technik vyrazí do závodu kvůli 1 neodkladné revizi, doporučujeme do stejného výjezdu přibalit dalších **X zařízení v téže budově / závodě**, kterým vyprší platnost revize v nejbližších **90 dnech**. Ušetříte tím opakovaný výjezd a dopravu technika."*
   - Zobraz seznam těchto blížících se zařízení (se zaškrtávátky `[✓]`, budovou, počtem zbývajících dnů do expirace a odhadovanou časovou náročností) a tlačítka:
     * **`[ ⚡ Sloučit vybrané (X) do jednoho revizního výjezdu a otevřít formulář revize ]`**
     * **`[ 📩 Odeslat tento sloučený seznam reviznímu technikovi k přípravě ]`**

================================================================================
ČÁST 4: INTUITIVNÍ FORMULÁŘ „DOPLNIT DATA K REVIZI“ + ZÁKONNĚ UZNATEĽNÝ DIGITÁLNÍ PODPIS (eIDAS / ZÁK. 297/2016 Sb. / NV 190/2022 Sb.)
================================================================================

Vytvoř pro revizního technika maximálně rychlé, přehledné a zákonně neprůstřelné rozhraní pro zápis a uzavření revize (`RevisionTechnicianFormModal.tsx` – dostupné z každého rozváděče/stroje, z hromadné revize i po naskenování QR štítku):

1. **automatické PŘEDVYPLNĚNÍ PROFILU REVIZNÍHO TECHNIKA (aby nemusel nic vypisovat ručně):**
   - Umožni reviznímu technikovi uložit si svůj profil (nebo vybrat z uložených revizních techniků závodu):
     * **Jméno, příjmení a titul** (např. `Ing. Martin Dvořák`),
     * **Firma / IČO** (s načtením z ARESu), **Telefon** a **E-mail** (na tento e-mail mu bude chodit i měsíční bezpečnostní report!),
     * **Evidenční číslo osvědčení TIČR** (např. `1248/23/R-EZ-E2A` – rozsah `E2A / E2B / E1A`),
     * **Evidenční číslo oprávnění TIČR** (pro podnikající FO / PO),
     * **Použitý měřicí přístroj + číslo kalibračního listu** (např. `Metrel EurotestXC MI 3155, Kalibrační list č. KL-2026-0842, platnost do 10/2027`).

2. **RYCHLÉ DOPLNĚNÍ NAMĚŘENÝCH HODNOT (PŘEDVYPLNĚNÉ ŠABLONY NA 1 KLIK):**
   - Druh revize: `[ Pravidelná (periodická) ]` · `[ Výchozí ]` · `[ Mimořádná (po opravě / změně) ]` + lhůta příští revize dle ČSN 33 1500 (např. `3 roky` / `4 roky` / `2 roky` / `1 rok`).
   - Tlačítko **`[ ✨ Předvyplnit standardní vyhovující hodnoty měření ]`** (technik pak jen přepíše konkrétní čísla z přístroje):
     * Izolační odpor $R_{\text{iso}}$ [MΩ] (např. `> 500 MΩ při 500 V DC`),
     * Spojitost ochranného vodiče a pospojování PE [Ω] (např. `0,05 Ω`),
     * Impedance poruchové smyčky $Z_s$ [Ω] / zkratový proud $I_k$ [A],
     * Zkouška proudových chráničů RCD ($I_{\Delta n} = 30\text{ mA}$, vybavovací čas $t_A = 18\text{ ms}$),
     * Kontrola oteplení / termovize a dotažení spojů (`VYHOVUJE`),
     * Zjištěné závady (s možností přidat závadu a termín odstranění, nebo `Bez zjištěných závad`),
     * Celkový posudek dle § 10 NV č. 190/2022 Sb.: **`ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU`**.

3. **ZÁKONNĚ UZNATELNÝ ELEKTRONICKÝ PODPIS A KRYPTOGRAFICKÁ PEČEŤ (`eIDAS` + `Zák. č. 297/2016 Sb.`):**
   - Implementuj 2 spojené vrstvy podpisu, které splňují požadavky českého zákona č. 297/2016 Sb. (§ 7), nařízení eIDAS (čl. 25) a zákona č. 250/2021 Sb.:
     * **Vrstva A – Interaktivní podpisový pad + Digitální razítko TIČR + Autorizační PIN / 2FA kód + SHA-256 pečeť:**
       - Technik se podepíše myší/prstem na plátno (nebo použije uložený podpis), automaticky se vygeneruje grafický otisk jeho **kulatého/hranatého razítka revizního technika s číslem TIČR** a technik potvrdí vydání revize svým **osobním bezpečnostním PINem / autorizačním kódem**.
       - Systém ze všech dat protokolu, TIČR čísla a naměřených hodnot vygeneruje **neměnný kryptografický otisk `SHA-256`**, uloží přesné časové razítko UTC/CET a IP adresu a zapíše je přímo do patičky uzamčeného PDF protokolu i do cloudového registru!
     * **Vrstva B – Podpora kvalifikovaného elektronického podpisu PAdES (PostSignum / I.CA / eObčanka):**
       - Umožni technikovi stáhnout vygenerovaný PDF protokol, opatřit jej v PC svým kvalifikovaným certifikátem PAdES (`.pdf` s elektronickou značkou z USB tokenu / čipové karty) a jedním klikem jej nahrát/připojit k uzamčené revizi v cloudu!

================================================================================
ČÁST 5: MĚSÍČNÍ KONTROLNÍ REPORT REVIZNÍM TECHNIKŮM (OCHRANA PROTI ZNEUŽITÍ TIČR ČÍSLA A RAZÍTKA)
================================================================================

Aby měl každý revizní technik 100% jistotu, že nikdo cizí nezneužil jeho jméno nebo číslo osvědčení TIČR k vystavení falešné revize:

1. Vytvoř v horní navigaci průmyslové části (a v sekci `/revize` / `/ucty`) specializovaný modul **`🛡️ Měsíční report & Ochrana TIČR (Pro revizní techniky)`**:
   - Zobrazuje přehled za zvolený měsíc (např. *Listopad 2026*) filtrovaný podle **čísla osvědčení TIČR** revizního technika:
     * Celkový počet vystavených revizí a kusových zkoušek pod tímto TIČR číslem v daném měsíci,
     * Kompletní kontrolní tabulka každé jedné revize: **Datum a přesný čas podpisu**, **Závod / Klient / Budova**, **Zařízení a jeho QR štítek (`EL-xxxxxx`)**, **Výsledek revize**, **IP adresa / Zařízení při podpisu** a **Kryptografický hash `SHA-256`**.
2. **Tlačítko okamžité obrany proti zneužití (`[ 🚨 Nahlásit zneužití / Tato revize není moje! ]`):**
   - Pokud by revizní technik v měsíčním výpisu uviděl revizi, kterou sám neprovedl, jedním klikem ji označí jako **NEAUTORIZOVANOU / ZNEUŽITÍ TIČR ČÍSLA**.
   - Revize se v cloudu i pod QR štítkem okamžitě zablokuje s červeným varováním **`⛔ POZOR: REVIZNÍ TECHNIK ZNEPLATNIL TENTO ZÁZNAM PRO PODEZŘENÍ ZE ZNEUŽITÍ OSVĚDČENÍ TIČR`**, a událost se zaloguje do bezpečnostního auditu.
3. **Automatické zasílání měsíčního reportu e-mailem + Export PDF výpisu:**
   - Přidej přepínač **`[✓] Zasílat vždy 1. den v měsíci souhrnný bezpečnostní výpis všech mých revizí na e-mail revizního technika`**, tlačítko **`[ 📧 Odeslat kontrolní report na můj e-mail ihned ]`** a **`[ 📄 Stáhnout podepsaný měsíční výkaz revizí (PDF / CSV) ]`** (který technikovi zároveň poslouží jako podklad pro jeho vlastní fakturaci a evidenci pro TIČR!).

================================================================================
ČÁST 6: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit a integrační testy ověřující:
   - Že přidanou budovu v průmyslovém závodě lze upravit i kompletně smazat (jak ze seznamu na mapě závodu, tak z detailu budovy) a že nově přidaná budova se nepoloží přes stávající budovy.
   - Že Chytrá revize (`SmartRevisionTripOptimizer`) správně vyhledá a nabídne zařízení v téže budově/závodě, kterým se blíží konec platnosti revize v horizontu 30/60/90 dnů.
   - Že formulář revizního technika uloží TIČR číslo, kontaktní údaje, naměřené hodnoty a vygeneruje protokol s kryptografickým otiskem `SHA-256`.
   - Že Měsíční report revizního technika vypíše všechny revize pod daným TIČR číslem a umožní zneplatnit neautorizovaný záznam.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Data:** migrace `phase108_revision_signing`:

- nová tabulka `InspectorProfile` – profil revizního technika závodu: jméno a titul, firma, IČO, telefon, e-mail,
  číslo osvědčení TIČR a jeho klíč pro párování, rozsah a platnost, číslo oprávnění, měřicí přístroj, kalibrační list,
  uložený podpis, otisk PINu (scrypt), počítadlo chyb a zámek, přepínač měsíčního e-mailu;
- `InspectionRecord` má navíc kontakty technika a odkaz na profil, kalibrační list, zkratový proud I_k, kontrolu spojů,
  podpis (obrázek, čas, IP, zařízení, ověření PINem), pečeť SHA-256 s verzí, PDF s podpisem PAdES a zneplatnění
  technikem (čas, poznámka);
- nové druhy událostí bezpečnostního deníku `BUILDING_DELETED`, `REVISION_SIGNED`, `REVISION_MISUSE`,
  `INSPECTOR_PIN_FAILED`.

**1. Budovy – úprava, přesun a smazání:**

- Seznam budov na mapě závodu má u každé karty ✏️ a 🗑️ (s právem Studia výstavby a modulem Studio).
- Na mapě areálu ukáže najetí na budovu lištu ✥ Posunout · ✏️ Upravit · 🗑️ Smazat:
  - posun tažením ukazuje obrys – žlutý na volném místě, červený přes jinou halu nebo mimo areál;
  - poloha se uloží až po puštění na volné místo, Esc přesun zruší.
- Hlavička detailu budovy i podlaží: ← Zpět na mapu závodu, ✏️ Upravit budovu / podlaží (na podlaží nabídka budova
  nebo podlaží) a červené 🗑️ Odstranit tuto budovu.
- Smazání:
  - dialog vypíše, co zmizí (podlaží, zařízení, záznamy revizí, dokumenty);
  - budovu se zařízeními, revizemi nebo dokumenty smaže jen opsaný název;
  - po smazání se zapíše `BUILDING_DELETED` do bezpečnostního deníku a stránka přejde na mapu závodu;
  - lokální stav prohlížeče se uklidí (`forgetBuildingLocally`).
- Úprava budovy: název, kód (unikátní v závodě), krátký název, poloha a rozměr v metrech pozemku (převod na procenta
  mapy). Kontrola polohy `placementError` – mimo areál nebo přes jinou budovu (s názvy budov) se neuloží.
- Příčina překrývání nových hal: průvodce založením haly měl při plném prvním řádku pevné místo 8,10. Nově
  `freeSpotFor` v `src/lib/campus-layout.ts`:
  - prohledá areál po 1 % s odstupem 2 %;
  - když se hala nevejde, postupně ji zmenší (až na 40 %);
  - teprve plný areál vrátí místo s nejmenším překryvem.
- Služby `src/server/services/buildings.ts`, akce `src/server/actions/buildings.ts`, dialogy
  `src/components/map/campus/BuildingDialogs.tsx`.

**2. Podlaží a synchronizace dat:**

- Stránka podlaží je vycentrovaná (`mx-auto w-full max-w-[1600px]`), tabulka zařízení má `pb-28` pod plovoucí lištou
  hromadné revize. Prázdný levý sloupec v kódu nebyl – „díra“ byla prázdná výrobní zóna nové haly; snímek nové haly
  pořizuje E2E.
- Nad mapou haly je tlačítko „+ Přidat rozváděč nebo stroj na toto podlaží“ – otevře Studio rovnou nad tímto patrem
  (`/studio?plant=&building=&floor=`).
- Rychlý náhled vybraného zařízení má Přesunout (Studio nad patrem) a Smazat:
  - zařízení s revizemi nebo dokumenty smaže jen opsané označení;
  - nejde smazat zařízení, které napájí jiná, ani s otevřenou žádankou o změnu.
- Synchronizace: všechny stránky průmyslové části čtou z databáze a každá změna obnoví celý layout
  (`revalidatePath("/", "layout")`). Žádný oddělený klientský stav k synchronizaci nebyl potřeba.

**3. Chytrá revize – `SmartRevisionTripOptimizer`:**

- Je na mapě závodu (agendy 1 a 4), v detailu podlaží, na `/inspections` (v zadání `/revize`) a v plánovači
  `/inspections/planner` (v zadání `/planovac`).
- Logika `src/lib/revision-trip.ts`:
  - kotva výjezdu = nejnaléhavější zařízení po termínu (EXPIRED) nebo do 30 dnů (DUE_SOON); v detailu podlaží
    přednostně v této budově;
  - nabídka = další zařízení téhož závodu, kterým platnost skončí do horizontu 30 / 60 / 90 / 180 dnů (přepínač si
    pamatuje prohlížeč);
  - řazení: stejná budova → sousední budovy podle vzdálenosti středů na mapě → nejdřív končící;
  - zařízení bez revize a vyřazená (neschopná provozu) se nenabízí – řeší je lhůtník a zápis revize;
  - CAE vidí výjezdy po závodech (výběr závodu).
- Banner podle zadání, seznam se zaškrtávátky (budova, podlaží, dny do konce platnosti, orientační čas revize podle
  druhu zařízení) a dvě tlačítka:
  - ⚡ Sloučit vybrané otevře formulář revizního technika (část 4) pro kotvu a vybraná zařízení;
  - 📩 Odeslat pošle seznam na e-mail uloženého profilu technika závodu (SMTP; bez SMTP se jen zapíše do logu
    notifikací – limit 10 e-mailů za hodinu na uživatele). Bez profilu otevře seznam v poštovním programu uživatele;
    seznam jde i zkopírovat.
- Odchylka: odhad času je orientační tabulka minut podle druhu zařízení (`INSPECTION_MINUTES`), ne normová hodnota.

**4. Formulář revizního technika – `RevisionTechnicianFormModal`:**

- Otevře se z karty rozváděče / stroje (po naskenování platného QR štítku zvýrazněně), z lišty hromadné revize
  („🖊️ Podepsat (TIČR)“) a ze sloučeného výjezdu.
- Profil technika se ukládá do databáze pro závod (všichni technici závodu); prohlížeč si pamatuje naposledy vybraný.
  Firma se načte z ARES podle IČO.
- Druh revize: pravidelná, výchozí, mimořádná (s důvodem). Lhůta příští revize: podle lhůty zařízení, nebo 1–4 roky –
  zákonnou nejdelší lhůtu dál hlídá služba revizí.
- „✨ Předvyplnit standardní vyhovující hodnoty měření“ vyplní R_iso > 500 MΩ při 500 V DC, PE 0,05 Ω,
  Z_s 0,35 Ω (I_k = 230 V / Z_s), RCD 30 mA / 18 ms typ A a termovizi / spoje VYHOVUJE. Dokud hodnoty odpovídají
  šabloně, formulář upozorní, že to není měření. Před podpisem technik zaškrtne, že revizi provedl a hodnoty
  odpovídají skutečnému měření.
- Závady s porušeným ustanovením a termínem odstranění (text „… – odstranit do RRRR-MM-DD [ustanovení]“), nebo
  „Bez zjištěných závad“; celkový posudek podle § 10 NV č. 190/2022 Sb. („ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU“).
- Vrstva A:
  - podpis na plátno (nebo uložený podpis profilu) a generované kulaté razítko s číslem osvědčení TIČR;
  - osobní PIN (4–8 číslic, scrypt; po 5 chybách zámek na 15 minut, každá chyba v bezpečnostním deníku);
  - pečeť SHA-256 nad kanonickým obsahem protokolu (`sealPayload`: zařízení, druh, data, výsledek, závady, měření,
    přístroj a kalibrace, technik, obrázek podpisu, čas, IP, zařízení, ověření PINem);
  - čas UTC i SEČ / SELČ, IP a zařízení jsou v patičce zprávy (SVG i tiskový protokol) a v registru;
  - celý protokol (i sloučený výjezd) se zapíše v jedné transakci s událostí `REVISION_SIGNED`.
- Protokol `/inspections/report/[id]` přepočítá pečeť z uložených údajů: ✅ shoda, nebo ⛔ neshoda, když se údaj po
  podpisu změnil.
- Vrstva B: protokol se uloží jako PDF z tisku, technik ho podepíše kvalifikovaným certifikátem a nahraje
  (`POST /api/inspections/pades`):
  - server ověří, že jde o PDF se slovníkem podpisu (`/ByteRange`, `/SubFilter` PAdES / PKCS#7);
  - připojí ho jednou k celému protokolu – uzamčený protokol se už nemění;
  - platnost a kvalifikovanost certifikátu Eldock neověřuje (to dělá ověřovací software).
- Právní rámec bez nadsázky: vrstva A je prostý elektronický podpis (eIDAS čl. 25 odst. 1) s pečetí obsahu; vrstva B
  kvalifikovaný podpis technika (eIDAS čl. 25 odst. 2, zákon č. 297/2016 Sb.). Text formuláře a patičky nechat
  zkontrolovat právníkem.

**5. Měsíční report & Ochrana TIČR – `/inspections/ticr`:**

- Odkaz „TIČR report“ je v horní navigaci (účty s právem zápisu revize), v hlavičce `/inspections` a na `/admin/users`.
- Report vypíše za zvolený měsíc (pražský čas) všechny revize pod číslem osvědčení profilu ve všech závodech účtu.
  Číslo se páruje bez ohledu na mezery, pomlčky, velikost písmen a příponu rozsahu.
  - Souhrn: celkem, revize, kontroly spotřebičů / kusové zkoušky, podepsané a zneplatněné.
  - Tabulka: čas podpisu (u nepodepsaných den revize), závod / budova, zařízení s QR štítkem, výsledek, IP / zařízení
    a SHA-256.
- 🚨 „Nahlásit zneužití / Tato revize není moje!“:
  - vyžaduje PIN profilu se stejným číslem osvědčení (jiný technik cizí záznam zneplatnit nemůže);
  - záznam dostane čas zneplatnění, poznámku a událost `REVISION_MISUSE`;
  - na kartě zařízení (pod QR štítkem) a v protokolu se ukáže červené varování;
  - zneplatněná revize se nepočítá do lhůt – lhůtník, mapa, plánovač, hlídač i Chytrá revize ji vynechají
    (`governingInspection` a `misuseFlaggedAt: null` v dotazech).
- Přepínač měsíčního e-mailu: denní údržba 1. den v měsíci pošle souhrn za předchozí měsíc jednou za profil
  (`lastMonthlyReport`). „📧 Odeslat ihned“ pošle souhrn hned (s limitem e-mailů).
- „📄 Stáhnout podepsaný měsíční výkaz (PDF)“ je tisková stránka A4 na šířku s otiskem SHA-256 obsahu výkazu, uloženým
  podpisem a razítkem technika; CSV výkaz `GET /api/inspections/ticr` (oddělovač `;`, BOM).
- Odchylky:
  - QR štítky `EL-xxxxxx` patří rozváděčům z AI Panel Builderu; průmyslová zařízení mají vlastní QR kód karty, report
    proto ukazuje označení zařízení a zda má QR štítek;
  - revize pod stejným číslem mimo závody účtu ukáže report jen počtem (bez podrobností cizí firmy) s výzvou
    kontaktovat podporu;
  - bez nastaveného SMTP se e-maily jen zapíší do logu notifikací.
- Zásady ochrany osobních údajů 1.6: profil technika, podpis, IP a zařízení při podpisu, doba uložení a účel
  (oddíly 2, 3 a 6).

**6. Testy:**

- `src/lib/phase108.test.ts` (13): budovy bez překryvu, úprava a kontrola polohy, Chytrá revize (horizont 30 / 60 / 90 /
  180, řazení, kotva v budově, víc závodů, texty), pečeť, číslo osvědčení, šablona měření, PAdES, měsíc a čas.
- `src/server/services/phase108.test.ts` (8): úprava, přesun a smazání budovy s auditem a smazání zařízení; podepsaná
  revize s TIČR, kontakty, měřením a pečetí (i neshoda po změně, chybný PIN a zámek); PAdES jednou na protokol;
  měsíční report se zneplatněním a lhůtou; měsíční e-mail ručně i 1. den v měsíci.
- E2E `e2e/phase108.spec.ts` (3): nová hala z průvodce bez překryvu → úprava ze seznamu → podlaží (šířka 1600 px,
  tlačítko, snímek) → smazání z hlavičky; Chytrá revize na 4 místech a horizonty; formulář technika s profilem, ARES,
  šablonou, podpisem a PINem → protokol s ověřenou pečetí → TIČR report → zneplatnění → červené varování na kartě.
- Upravený test fáze 92 (průvodce halou): nové místo haly bez překryvu místo pevné pozice.

**Oprava zjištěná při E2E (plovoucí tlačítko z fáze 107):**

- Plovoucí tlačítko „💬 Nápověda, Chyby & Kontakt“ na desktopu překrývalo hlavní tlačítko spodních lišt akcí (odeslání
  revize CAE ke schválení, žádanka o změnu, hromadná revize) i poslední akci stránky („Potvrdit a propsat do systému“).
- Lišty mají atribut `data-bottom-bar` a tlačítko se nad ně na desktopu zvedne (pravidlo v `globals.css` mimo vrstvy
  Tailwindu); hlavní plocha aplikace má spodní rezervu `pb-24`, takže poslední prvek stránky jde odrolovat nad tlačítko.
