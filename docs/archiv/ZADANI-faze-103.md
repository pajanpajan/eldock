# Zadání fáze 103 – cloudový trezor dokumentace s kusovou zkouškou a verzemi pod QR štítkem, Červenky (firemní projektant / ELDOCK Pool), zámek místností 2D půdorysu a registr QR štítků ELDOCK

Vloženo z chatu 2026-11-12 (po nasazení fáze 102). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Máme 4 klíčové úkoly pro další rozvoj platformy ELDOCK (https://eldock.cz):
1) Cloudový trezor dokumentace s částí pro revizního technika (doplnění dat po kusové zkoušce/revizi), uzamčením PDF dokumentace (rozváděč + 2D půdorys) pod QR štítkem a přísným verzováním (`v1.0` -> odemknutí k úpravě -> nová kusová zkouška/revize -> uzamčení `v1.1` se zachováním `v1.0` jako `NEAKTUÁLNÍ`).
2) Systém předávání změn (Červenky) od údržbářů k projektantům se 2 cestami: A) Vlastní projektant firmy, B) ELDOCK Pool externích freelancer projektantů (burza úkolů principem „kdo první klikne na Přijímám úkol“).
3) Automatické uzamčení místností v 2D půdorysu po opuštění Kroku 1 (v krocích 2–5 jsou stěny a místnosti zamčené proti nechtěnému posunutí; upravit jdou po překliknutí zpět do Kroku 1).
4) Generátor globálně unikátních QR štítků s logem ELDOCK uprostřed QR kódu, přiřazením ke konkrétním firmám a garancí, že se žádný kód nikdy nezopakuje (tisk 300 DPI pro Zebra ZD421t i archy A4).

Zapiš tuto etapu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: CLOUDOVÉ UKLÁDÁNÍ DOKUMENTACE, ČÁST PRO REVIZNÍHO TECHNIKA A VERZOVÁNÍ (`v1.0` -> `v1.1`) POD QR ŠTÍTKEM
================================================================================

Vytvoř kompletní životní cyklus schvalování, zamykání a verzování dokumentace rozváděče a navázaného 2D půdorysu:

1. DATOVÝ MODEL A STAVY DOKUMENTACE (`SwitchboardVersion` / Cloud Snapshot):
   Každý rozváděč v AI Panel Builderu (včetně odkazu na případný zdrojový 2D půdorys `floorplanId`) musí podporovat verzování a 3 stavy:
   - **`DRAFT` (Rozpracováno / Odemčeno k editaci):** Projektant nebo elektrikář upravuje osazení, schéma nebo půdorys.
   - **`PENDING_INSPECTION` (Čeká na kusovou zkoušku a potvrzení revizního technika):** Konstrukce je hotová, čeká se na měření a podpis.
   - **`LOCKED_PUBLISHED` (Uzamčená schválená verze v cloudu, např. `Verze 1.0`, `Verze 1.1`, `Verze 1.2`):** Dokumentace je neměnná (read-only) a veřejně/přes PIN dostupná po naskenování QR štítku.

2. SEKCE PRO REVIZNÍHO TECHNIKA PO KUSOVÉ ZKOUŠCE (V KROKU 4 AI PANEL BUILDERU A NA QR KARTĚ):
   V Kroku 4 (`Dokumentace, Kusová zkouška & Štítky`) přidej samostatný, přehledný panel **`👨‍🔧 Část pro revizního technika / Výstupní kusovou zkoušku (Uzamčení do cloudu)`**:
   - Formulář, kde revizní technik (nebo odpovědná osoba výrobce) po fyzické kontrole rozváděče doplní:
     * **Jméno a příjmení revizního technika / zkoušejícího**, **Číslo osvědčení / oprávnění TIČR** (např. `E2A / E2B`), **Datum měření**,
     * **Naměřené hodnoty kusové zkoušky a revize:**
       - Izolační odpor $R_{iso}$ [MΩ] (např. `> 500 MΩ při 500 V DC`),
       - Spojitost ochranného obvodu PE [Ω] (např. `0,04 Ω – VYHOVUJE`),
       - Impedance poruchové smyčky $Z_s$ [Ω] / zkratový proud $I_k$,
       - Zkouška proudových chráničů RCD (vybavovací proud $I_{\Delta}$ [mA] a vybavovací čas $t_A$ [ms], např. `18 ms`),
       - Mechanická funkční zkouška a kontrola utahovacích momentů (`ANO / VYHOVUJE`),
       - Celkový verdikt: **`ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU`** + poznámka revizního technika.
   - Tlačítko **`[ 🔒 Potvrdit kusovou zkoušku, uzamknout PDF v cloudu a vydat Verzi X.Y ]`**:
     * Jakmile technik klikne na toto tlačítko:
       1) Projekt se **uzamkne proti editaci (`status = 'LOCKED_PUBLISHED'`)**.
       2) V cloudu se uloží kompletní neměnný snímek této verze (`v1.0`, resp. po úpravě `v1.1`, `v1.2`...), který obsahuje jak **6listový PDF elaborát rozváděče s vyplněnými naměřenými hodnotami a podpisem technika**, tak **PDF výkres a kusovník navázaného 2D půdorysu**!
       3) Všechny předchozí verze (např. `v1.0`) se automaticky přepnou do stavu **`SUPERSEDED` (`NEAKTUÁLNÍ – Nahrazeno verzí 1.1`)**.

3. VEŘEJNÁ / CLOUDOVÁ KARTA PO NASKENOVÁNÍ QR ŠTÍTKU (`src/app/q/[qrCode]/page.tsx`):
   Vytvoř veřejně (nebo pro techniky u rozváděče okamžitě na mobilu) přístupnou stránku `https://eldock.cz/q/[qrCode]`, která se otevře po načtení QR štítku nalepeného na rozváděči nebo stroji:
   - Zobrazuje hlavičku rozváděče, stav **`🔒 Schválená platná dokumentace – Verze 1.1 (Ověřeno revizním technikem dne ...)`** a 2 hlavní uzamčené PDF dokumenty k okamžitému prohlížení a stažení:
     1) **`📄 Kompletní PDF dokumentace rozváděče + Kusová zkouška (Verze 1.1 – AKTUÁLNÍ)`**
     2) **`📐 Prováděcí 2D půdorys a kabelové trasy (Verze 1.1 – AKTUÁLNÍ)`** (pokud byl rozváděč propojen s půdorysem).
   - **Archiv starších verzí (`Historie verzí rozváděče`):**
     * Pod aktuální verzí je rozbalovací seznam všech historických verzí (např. `Verze 1.0 ze dne ... – ⚠️ NEAKTUÁLNÍ`).
     * Uživatel si může starší verzi `v1.0` kdykoliv otevřít v PDF, ale v hlavičce každého listu i na kartě svítí výrazný červený štítek/vodoznak: **`⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1`**.
   - **Tlačítko pro úpravu na místě (`[ 🔓 Odemknout rozváděč k úpravě / Založit novou revizi ]`):**
     * Když elektrikář v budoucnu v rozváděči něco přepojí nebo přidá jistič, klikne na toto tlačítko -> projekt se mu v AI Panel Builderu odemkne jako rozpracovaná **`Verze 1.1 (Rozpracovaná změna)`**.
     * Po provedení úprav jej systém znovu vyzve k vyplnění a schválení kusové zkoušky revizním technikem -> po schválení se projekt opět zamkne a uloží jako nová platná **`Verze 1.1`**!

================================================================================
ČÁST 2: PŘEDÁVÁNÍ ZMĚN (ČERVENKY) OD ÚDRŽBÁŘŮ K PROJEKTANTOVI – 2 CESTY (INTERNÍ VS. FREELANCER POOL)
================================================================================

Když údržbář ve výrobním závodě, nemocnici nebo obchodním centru zakreslí do schématu polní úpravu pomocí nástroje **`✏️ Červenka`** (nebo zadá požadavek na překreslení), musíme změnu doručit projektantovi k čistému překreslení do CADu.

Naimplementuj dvoukanálový systém směrování změn (`src/lib/redline-marketplace.ts` + UI v `/` a nová stránka `/portal-projektantu`):

1. VOLBA REŽIMU PŘI ODESLÁNÍ ČERVENKY (A V NASTAVENÍ ZÁVODU):
   Když údržbář/vedoucí údržby ukládá zákres v Července (`Prohlížeč schématu -> Červenka`), nabídni mu 2 jasné možnosti předání k překreslení:
   - **Cesta A: `🏢 Přiřadit našemu firemnímu projektantovi`**
     * Závod má vyplněného vlastního (interního nebo smluvního) projektanta (jméno, e-mail).
     * Požadavek na překreslení se přiřadí přímo jemu (`assignedMode = 'INTERNAL_DESIGNER'`), odešle mu podklady (původní PDF + vrstvu Červenky + popis změny a požadovaný termín) a sleduje stav (`Čeká na překreslení` ➔ `Překresluje se` ➔ `Hotovo – nahrána nová verze schématu`).
   - **Cesta B: `🌐 Poptat překreslení přes ELDOCK Pool externích projektantů (Freelancer Marketplace)`**
     * Pro firmy, které nemají vlastního projektanta.
     * Údržbář vybere zdrojový formát / náročnost (např. *Překreslení 1 listu schématu v PDF / PC|SCHEMATIC / EPLAN / DWG*, orientační odměna za úkol např. `800 Kč` / `1 500 Kč`) a klikne na **`[ 🚀 Odeslat do ELDOCK Poolu projektantů ]`**.

2. PORTÁL PRO EXTERNÍ FREELANCER PROJEKTANTY (`/portal-projektantu` – Princip „Kdo první přijme úkol“):
   Vytvoř dedikovanou stránku **`src/app/portal-projektantu/page.tsx`** (a odkaz na ni z průmyslové navigace i ze `/superadmin`), kde spolupracující externí projektanti vidí živou frontu poptávek na překreslení Červenek:
   - **Seznam volných úkolů (`🟢 VOLNÝ ÚKOL K PŘIJETÍ`):**
     * U každého úkolu je vidět: Název rozváděče/stroje (anonymizovaný nebo s názvem firmy po přihlášení projektanta), náhled zákresu z Červenky, počet změn, požadovaný CAD formát, termín dodání a odměna v Kč.
   - **Atomické tlačítko **`[ ✋ Přijímám úkol k překreslení ]`** (First-come, first-served):**
     * Jakmile první z našich domluvených projektantů klikne na **`[ ✋ Přijímám úkol ]`** (zadá/potvrdí své jméno a e-mail z našeho seznamu schválených projektantů), úkol se v databázi **okamžitě uzamkne a přiřadí tomuto projektantovi (`status = 'CLAIMED'`)**!
     * Ostatním projektantům v poolu se úkol okamžitě přepne na šedý stav `🔒 Přijato projektantem [Jméno]`, takže na něm nikdy nebudou pracovat dva lidé současně!
   - **Odevzdání překresleného schématu projektantem:**
     * Projektant, který úkol přijal, si jedním klikem stáhne balíček podkladů (původní výkres + obrázek Červenky + komentář údržbáře) a po překreslení přímo v portálu nahraje **nové čisté PDF schéma (+ zdrojový CAD soubor)**.
     * Nahráním se dokumentace u rozváděče v závodě automaticky povýší na novou verzi (např. `v1.1`), původní verze `v1.0` se uloží do archivu jako `NEAKTUÁLNÍ` a Červenka se označí jako `✅ Zapracováno do dokumentace`.

================================================================================
ČÁST 3: AUTOMATICKÉ UZAMČENÍ MÍSTNOSTÍ V 2D PŮDORYSU PO KROKU 1 (`/panel-builder/floorplan`)
================================================================================

V `/panel-builder/floorplan` uprav chování plátna podle aktivní fáze průvodce (`wizardPhase` 1 až 5):
1. **Ve Fázi 1 (`1. Půdorys a místnosti`):**
   - Místnosti a stěny jsou **plně odemčené** – uživatel je může vytvářet, chytat myší, posouvat, měnit jejich rozměry `X × Y` za aktivní rohy, přejmenovávat a mazat klávesou `Delete`.
2. **Ve Fázích 2, 3, 4 a 5 (`Rozváděč a vybavení`, `Zásuvky`, `Světla a vypínače`, `Trasy a Kusovník`):**
   - Místnosti a obvodové stěny jsou **automaticky UZAMČENÉ proti posunutí, změně rozměrů a smazání**!
   - Když uživatel ve Fázi 2–5 klikne do prostoru místnosti nebo táhne myší zásuvku/světlo/nábytek/kabel, místnost pod ním se NIKDY nepohne a klávesa `Delete` nikdy nesmaže místnost (smaže pouze vybraný elektro prvek nebo nábytek).
   - Pokud uživatel klikne na místnost a chce upravit její rozměry nebo polohu, v liště nebo v pravém panelu se zobrazí přehledná informace:
     * **`🔒 Rozvržení místností je v této fázi uzamčeno proti nechtěnému posunutí.`** + tlačítko **`[ ✏️ Přepnout do Fáze 1 a upravit místnosti ]`**, které ho jedním klikem vrátí do Kroku 1, kde místnost upraví a pak se klidně vrátí zpět do rozpracované fáze!

================================================================================
ČÁST 4: GENERÁTOR UNIKÁTNÍCH QR ŠTÍTKŮ S LOGEM ELDOCK (PŘIŘAZENÍ FIRMÁM, NULOVÁ DUPLICITA, 300 DPI)
================================================================================

Vytvoř centrální generátor a registr průmyslových QR štítků s logem ELDOCK (`src/lib/qr-label-registry.ts` + API `/api/qr-labels` + UI v `/superadmin` a v sekci tisku štítků):

1. GLOBÁLNĚ UNIKÁTNÍ SEKVENČNÍ REGISTR ŠTÍTKŮ (NIKDY SE NEOPAKUJÍCÍ ID):
   - V databázi (Prisma / SQLite + perzistentní registr) udržuj atomické, monotónně rostoucí počítadlo `lastSequenceNumber` a tabulku všech vydaných štítků (`QrLabelBatch` a `QrLabelItem`).
   - Každý štítek dostane **globálně unikátní, nikdy se neopakující identifikátor**, např.:
     * Sériové číslo štítku: **`EL-000001`**, **`EL-000002`** ... (nebo s prefixem roku/kódu `EL26-000001`),
     * Cílová URL v QR kódu: **`https://eldock.cz/q/EL-000001`**.
   - Databázové omezení `UNIQUE` na `serialCode` zaručuje, že i při vygenerování stovek tisíc štítků pro stovky různých firem **nikdy nevzniknou dva stejné QR štítky**!

2. PŘIŘAZENÍ ŠTÍTKŮ KONKRÉTNÍ FIRMĚ + 3 ROZMĚRY PRO TISKÁRNU ZEBRA ZD421t (300 DPI):
   V administraci `/superadmin` (záložka **`🏷️ Generátor QR štítků ELDOCK`**) a v tisku štítků umožni:
   - **Zadat / vybrat cílovou firmu:** Název firmy, IČO (s automatickým načtením z ARESu), e-mail zákazníka. Všechny štítky v dané dávce (např. `100 ks`, od `EL-000101` do `EL-000200`) se v databázi trvale spárují s touto firmou! (Když pak jejich technik štítek poprvé naskenuje mobilem, systém už ví, že štítek patří firmě *XYZ s.r.o.*, a rovnou ho nechá spárovat s rozváděčem, strojem nebo spotřebičem!).
   - **Zvolit účel a přesný rozměr štítku (optimalizováno pro termotransfer Zebra ZD421t – 300 DPI):**
     1) **`🔌 SPOTŘEBIČ & NÁŘADÍ (30 × 15 mm – ČSN 33 1600 ed. 2)`**: Kompaktní štítek na vrtačky, prodlužovačky, PC a spotřebiče (QR kód s logem `EL`, unikátní ID `EL-xxxxxx`, nápis `REVIZE ELDOCK.CZ`).
     2) **`⚡ ROZVÁDĚČ (50 × 25 mm – ČSN EN IEC 61439)`**: Střední štítek na domovní a komerční rozváděče (QR kód s logem `ELDOCK`, ID `EL-xxxxxx`, název firmy / rozváděče, odkaz na uzamčenou cloud dokumentaci).
     3) **`🏭 STROJ & PRŮMYSL (70 × 40 mm – EU 2023/1230)`**: Velký štítek na výrobní stroje a průmyslové rozváděče (QR kód s logem `ELDOCK`, ID `EL-xxxxxx`, pole pro označení stroje, napájení a QR diagnostiku).
   - **Vykreslení QR kódu s logem ELDOCK uprostřed:**
     * Generuj QR kód s nejvyšší úrovní korekce chyb **`Error Correction Level H (30 %)`** a přímo do jeho středu vykresli ostré kontrastní černo-bílé vektorové logo **`ELDOCK` (`EL` v rámečku)** tak, aby byl kód na 300 DPI tiskárně 100% čitelný každým telefonem za 0,1 sekundy!
   - **Výstupy z generátoru na 1 klik:**
     * **`[ 🖨️ Tisk na kotouč Zebra ZD421t (PDF 1:1 po 1 štítku na stránku přesného rozměru 30×15 / 50×25 / 70×40 mm + ZPL kód) ]`**,
     * **`[ 📄 Tisk na arch A4 (samolepicí arch) ]`**,
     * **Přehledná tabulka historie všech vydaných sérií** (Které firmě patří rozsah `EL-000001` až `EL-000100`, datum tisku, kolik štítků ze série už zákazník v terénu aktivoval a možnost dotisknout štítek).

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit a integrační testy ověřující:
   - Že uzamčení rozváděče revizním technikem vytvoří `Verzi 1.0 (LOCKED_PUBLISHED)`, odemknutí a nové schválení vytvoří `Verzi 1.1` a původní `Verze 1.0` zůstane v historii dostupná jako `NEAKTUÁLNÍ`.
   - Že v 2D půdorysu jsou místnosti ve Fázi 1 editovatelné, zatímco ve Fázích 2–5 jsou uzamčené proti posunutí a smazání.
   - Že úkol z Červenky odeslaný do `ELDOCK Poolu projektantů` se po kliknutí prvního projektanta na `Přijímám úkol` uzamkne (`CLAIMED`) a druhý projektant už ho nemůže převzít.
   - Že generátor QR štítků s logem ELDOCK přiřadí sérii firmě a sekvenční čísla `EL-xxxxxx` se nikdy neopakují.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Mantinely a odchylky od zadání (proč):**

- „Uzamknout PDF v cloudu“ = neměnný snímek dat elaborátu (6 listů včetně části revizního technika a štítku CE s adresou
  karty) a navázaného 2D půdorysu v databázi (`SwitchboardVersion.documentationJson` / `floorplanJson`). PDF vzniká
  tiskem snímku z prohlížeče („Uložit jako PDF“) – pokaždé stejné, nikdy se nepřepočítá z rozpracovaného projektu.
  Elaborát je od fáze 43 HTML na listech A4 a server se 2 GB RAM PDF engine nemá.
- „Podpis technika“ = elektronické potvrzení (jméno, číslo osvědčení TIČR, datum měření a čas uzamčení ve snímku) plus
  otisk razítka firmy, je-li nahraný. Nejde o kvalifikovaný elektronický podpis.
- Karta `https://eldock.cz/q/EL-…` je veřejná (technik u rozváděče bez přihlášení), ale sériová čísla jdou po sobě a
  daly by se projít. Jméno zákazníka, místo instalace, logo a razítko proto vidí jen přihlášená firma výrobce. Zadání
  připouští „veřejně / přes PIN“ – PIN zatím není, veřejný pohled osobní údaje zákazníka neobsahuje.
- „🔓 Odemknout rozváděč k úpravě / Založit novou revizi“ na kartě vede do AI Panel Builderu (přihlášení firmy
  výrobce). Kdokoli se štítkem tak rozváděč neodemkne.
- Odevzdání z ELDOCK Poolu „automaticky povýší dokumentaci“ jen do stavu čekající revize. Platnou verzí se stane až
  po schválení údržbou závodu: stávající workflow drží princip čtyř očí a cizí výkres nemá platit bez kontroly
  závodu. Po schválení jde dosavadní revize do archivu (NEAKTUÁLNÍ) a Červenka je „✅ Zapracováno do dokumentace“.
  Po vrácení k přepracování se úkol vrátí projektantovi.
- Přijetí úkolu v poolu jde jen se schváleným projektantem. Přihlašuje se e-mailem a přístupovým kódem, který vydá
  velín (ukáže se jednou, uloží se jen otisk; nejvýš 10 pokusů za 15 minut). Samotné „jméno a e-mail ze seznamu“
  ze zadání by dovolilo převzít úkol pod cizí známou adresou.
- E-mail firemnímu projektantovi (cesta A) odchází jen s nastaveným SMTP a u závodu registrované firmy Správy závodů.
  Ve sdíleném obchodním demu může adresu vyplnit kdokoli.

**1. Životní cyklus dokumentace (`docState`, `SwitchboardVersion`, `src/lib/switchboard-versions.ts`,
`src/server/services/switchboard-versions.ts`, `src/server/actions/switchboard-versions.ts`, `InspectorLockPanel.tsx`):**

- Stavy `DRAFT` → (volitelně „📋 Předat ke kusové zkoušce“) `PENDING_INSPECTION` → `LOCKED_PUBLISHED`. Verze 1.0,
  1.1, 1.2 …; při vydání se v téže transakci předchozí platná verze přepne na `SUPERSEDED` s číslem verze, která ji
  nahradila.
- Část pro revizního technika (krok 4 Dokumentace) obsahuje:
  - jméno, osvědčení TIČR a datum;
  - R_iso se zkušebním napětím, PE, Z_s / I_k a RCD I_Δ / t_A;
  - mechanickou zkoušku, verdikt a poznámku.
- Měření doplní body 11.4, 11.8 a 11.9 protokolu o kusové zkoušce. Zbylých 5 bodů potvrdí výrobce ve stávajícím panelu
  protokolu.
- Uzamknout jde jen tehdy, když:
  - je verdikt „ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU“;
  - hodnoty jsou v mezích: R_iso ≥ 1 MΩ, PE ≤ 0,1 Ω, t_A ≤ 300 ms a mechanika vyhovuje;
  - dokumentace nemá žádné blokace (např. nepotvrzené prostředí).
- Zámek úprav: všechny měnící akce Panel Builderu jdou přes `guardEditableProject` / `guardEditableItem`. Protokol
  kusové zkoušky jde vyplnit i během `PENDING_INSPECTION`. Rozváděč s vydanou verzí nejde smazat (karta v terénu musí
  dál fungovat).
- QR štítek přijde při prvním vydání automaticky z registru (série 1 ks pro firmu výrobce), jinak se spáruje
  předtištěný štítek. Štítek CE na Listu 6 vede na kartu štítku.
- Karta `/q/[qrCode]` ukazuje:
  - platnou verzi „🔒 Schválená platná dokumentace – Verze X (Ověřeno revizním technikem … dne …)“;
  - dokumenty „📄 Kompletní PDF dokumentace…“ a „📐 Prováděcí 2D půdorys…“;
  - historii verzí;
  - během rozpracované změny poznámku „připravuje se Verze X.Y“.
- Neaktuální verze má v hlavičce každého listu červený štítek „⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1“
  a přes list vodoznak (tiskne se i do PDF).

**2. Červenky (`RedlineTask`, `src/lib/redline-marketplace.ts`, `src/server/services/redlines.ts`):**

- Volba předání je v posledním kroku průvodce „Zadat změnu“ (`RedlineRoutingChoice.tsx`). Výchozí je cesta A, která
  odpovídá dosavadní frontě CAE se sledováním stavu. Firemního projektanta (jméno, e-mail) zadá správce v Nastavení
  závodu (Administrace → Moduly).
- Stavy úkolu se mění s workflow požadavku (převzetí, nahrání revize, schválení, vrácení, storno – `workflow.ts`):
  - cesta A: Čeká na překreslení → Překresluje se → Hotovo;
  - cesta B: 🟢 VOLNÝ ÚKOL → 🔒 Přijato projektantem → Odevzdáno → ✅ Zapracováno.
- Portál `/portal-projektantu`:
  - nepřihlášenému ukáže jen anonymizovanou frontu (druh zařízení, označení, formát, termín, odměna);
  - schválenému projektantovi i firmu, závod a náhled vrstvy Červenky (jen tahy, bez schématu závodu);
  - přijetí úkolu je atomické (`updateMany` jen nad stavem OPEN) – druhý projektant dostane „Úkol už přijal
    projektant …“.
- Balíček podkladů (ZIP) obsahuje platné schéma, vrstvu Červenky (SVG), fotky a `0-zadani.txt`.
- Odevzdání: nové PDF (povinné, kontrola hlavičky `%PDF-`) a zdrojový CAD (DWG / DXF nebo zabalený projekt
  PC|SCHEMATIC / EPLAN). Vznikne nová revize přes workflow pod technickým účtem projektanta („Jméno (ELDOCK Pool)“,
  bez přihlášení). Soubory patří firmě závodu.
- Odměny jsou orientační – platby projektantům platforma neřeší.
- Odkazy na portál: „Pool projektantů“ v navigaci Správy závodů a záložka velínu „🌐 ELDOCK Pool projektantů“
  (schválení projektantů a přehled předaných Červenek).

**3. Zámek místností (`roomsLocked` ve `floorplan-phases.ts`, `FloorplanEditor.tsx`, `PlanLayers.tsx`, `RoomDetail`):**

- V kroku 1 je vše jako dřív. V krocích 2–5:
  - tažení po místnosti vybírá prvky obdélníkem a místnost se nepohne;
  - rohy, hrany a úchyty polygonu jsou skryté;
  - Delete maže jen vybrané prvky;
  - detail místnosti ukáže „🔒 Rozvržení místností je v této fázi uzamčeno…“ a „✏️ Přepnout do Fáze 1 a upravit
    místnosti“.
- Název a konstrukce stěn místnosti zůstávají upravitelné – nemění geometrii a konstrukce stěn ovlivní krabice
  v kusovníku kroku 5.
- Kompaktní lišta „vše“ (bez kroku) místnosti nezamyká.
- Oprava při testech: rychlé kliknutí (stisk a puštění v jednom snímku, rychlé ťuknutí na dotykovém displeji) zrušilo
  výběr zamčené místnosti. V kroku 1 mohlo místností i poskočit. Plátno se po výběru místnosti posune o lištu
  kroku a čekající poloha ukazatele z doby před stiskem se pak přepočítala na jiné souřadnice výkresu. Při stisku
  se proto tato poloha zahodí a výběr obdélníkem platí až po pohybu ukazatele o víc než 4 px na obrazovce.

**4. Registr QR štítků (`QrLabelCounter`, `QrLabelBatch`, `QrLabelItem`, `src/lib/qr-label-registry.ts`,
`src/server/services/qr-labels.ts`):**

- Unikátnost: jediné počítadlo `lastSequenceNumber` se zvedá v transakci SQLite a `sequence` i `serialCode` jsou
  UNIQUE. Čísla jdou EL-000001 … EL-999999, pak se prodlouží (EL-1000000) a zůstanou unikátní.
- Série se přiřadí firmě:
  - výběrem registrované firmy;
  - nebo ručně (název, IČO s načtením z ARES, e-mail) – registrovaná firma se dohledá podle IČO / e-mailu
    (přednostně AI Panel Builder, pak Správa závodů).
- Rozměry 30 × 15 / 50 × 25 / 70 × 40 mm. QR kód má korekci chyb H a uprostřed vektorové logo „EL“ v rámečku
  (22 % strany, moduly pod logem vynechané).
- Výstupy:
  - kotouč Zebra ZD421t = PDF 1:1 z dialogu tisku (stránka = rozměr štítku, 1 štítek na stránku);
  - kód ZPL II (`^BQN,2` s korekcí H) – nativní QR v ZPL logo neumí, verze s logem se tiskne z PDF;
  - arch A4 s mřížkou a ořezovými čarami;
  - historie sérií s počtem aktivovaných štítků, datem tisku (po tisku) a dotiskem jednoho štítku;
  - API `GET / POST /api/qr-labels` (jen velín).
- Spárování po naskenování nespárovaného štítku:
  - firma AI Panel Builderu ho spáruje s rozváděčem bez štítku;
  - uživatel registrované firmy Správy závodů se strojem, spotřebičem nebo rozváděčem svého závodu (karta pak vede
    na kartu zařízení pro přihlášenou údržbu).
- V kroku 4 „Štítky“ Panel Builderu je karta QR štítku rozváděče s tiskem 1:1 a spárováním předtištěného štítku.

**5. Testy:**

- `src/lib/phase103.test.ts`: verze, kusová zkouška, snímek, sériová čísla, ZPL, Červenky a zámek místností.
- `src/server/services/phase103.test.ts` nad SQLite:
  - 1.0 → odemknutí → 1.1 s 1.0 jako NEAKTUÁLNÍ;
  - zámek úprav a smazání;
  - série firmám a nikdy se neopakující čísla i souběžně;
  - spárování s rozváděčem i zařízením závodu;
  - pool, kde ze dvou souběžných přijetí vyhraje jedno, a celý průchod do schválení;
  - firemní projektant.
- E2E `e2e/phase103.spec.ts`:
  - zámek místností v krocích 2–5;
  - generátor ve velínu s tiskem a ZPL;
  - kusová zkouška a uzamčení 1.0 → 1.1 s kartou, historií a vodoznakem;
  - pool se dvěma projektanty až po schválení údržbou.
- `e2e/phase51.spec.ts` maže místnost v kroku 1.
