Implementujeme novou etapu: "Legislativní paket 2027 (EU 2023/1230, ČSN EN IEC 61439 ed. 3, ČSN EN 50110-1 ed. 4, ČSN EN IEC 62305 ed. 3, Bateriový pas), Knihovna návodů/datasheetů a Verzované zálohy řídicího softwaru (PLC/HMI/Měniče) s historií změn".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 6 bodech:

1. DATABÁZOVÉ SCHÉMA A MIGRACE (prisma/schema.prisma):
Vytvoř čistou SQLite migraci pro tyto modely a rozšíření:
a) Model `EquipmentDocument` (Návody, datasheety a technické přílohy):
   - `id`, `equipmentId` (vazba na Equipment, onDelete: Cascade)
   - `category` (enum `AttachmentCategory`: `MANUAL` = Návod k obsluze a údržbě, `DATASHEET` = Katalogový list / Datasheet dílu, `DRIVE_PARAMS` = Manuál a chybové kódy měniče/pohonu, `FLUID_SCHEMA` = Schéma hydrauliky / pneumatiky, `CERTIFICATE` = Certifikát / ATEX / Shoda, `OTHER` = Ostatní)
   - `title` (String), `componentTag` (String? – např. "-U1", "-A1", "-K4" pro vazbu na konkrétní prvek rozváděče), `manufacturer` (String?), `modelNumber` (String?)
   - `version` (String @default("1.0")), `language` (String @default("cs"))
   - `fileUrl` (String), `fileName` (String), `fileSizeBytes` (Int)
   - `uploadedById` (String?), `createdAt` (DateTime @default(now()))
b) Model `SoftwareBackup` (Verzované zálohy PLC, HMI, robotů a frekvenčních měničů):
   - `id`, `equipmentId` (vazba na Equipment, onDelete: Cascade)
   - `targetUnit` (String – např. "PLC -A1 (Siemens S7-1500)", "Frekvenční měnič -U1", "HMI Panel", "Safety relé -K1")
   - `platform` (String – např. "TIA Portal V19", "Step7", "Codesys", "Loxone Config", "Parametry měniče VFD", "KUKA KRC4")
   - `major` (Int), `minor` (Int) – verzování v1.0, v1.1, v2.0 per `[equipmentId, targetUnit]`
   - `status` (enum `SoftwareBackupStatus`: `ACTIVE` = Aktuálně ve stroji, `ARCHIVED` = Starší záloha pro rollback)
   - `firmwareVersion` (String? – evidence firmwaru dle Cyber Resilience Act EU 2024/2847)
   - `isSafetyRelated` (Boolean @default(false) – zda obsahuje bezpečnostní logiku dle Nařízení EU 2023/1230)
   - `safetyChecksum` (String? – kontrolní součet / F-Signature bezpečnostního programu, např. "CRC: 0x8F4A-2C91")
   - `changeSummary` (String – povinný popis co a proč se v programu/parametrech změnilo)
   - `fileUrl` (String), `fileName` (String), `fileSizeBytes` (Int)
   - `changeRequestId` (String? – volitelná vazba na ticket Červenky `ChangeRequest`, ze kterého změna SW vzešla)
   - `authorId` (String?), `createdAt` (DateTime @default(now()))
c) Rozšíření stávajících modelů pro legislativu 2027:
   - Na `ChangeRequest` přidej:
     * `safetyImpact` (enum `SafetyImpactLevel`: `NONE_1_TO_1` = Běžná údržba kus za kus, `OPERATIONAL_ONLY` = Provozní úprava bez vlivu na bezpečnost, `SUBSTANTIAL_SAFETY_MOD` = Zásah do bezpečnostního obvodu / Podstatná změna dle čl. 18 Nařízení EU 2023/1230) @default(NONE_1_TO_1)
     * `requiresSoftwareUpdate` (Boolean @default(false) – příznak, že zásah vyžaduje i úpravu/zálohu SW nebo parametrů)
   - Na `Equipment` přidej:
     * `batteryPassportJson` (String? – JSON pro Digitální pas baterie dle Nařízení EU 2023/1542 u UPS a BESS > 2 kWh: kapacita kWh, chemie LiFePO4/VRLA, SoH %, nominální napětí, výrobce článků)
   - Na `PanelBoardProject` přidej:
     * `standardEdition` (String @default("CSN_61439_3_ED2") – hodnoty: `"CSN_61439_3_ED2"` pro DBO rozvodnice dle ČSN EN IEC 61439-1 ed. 3 a -3 ed. 2; `"CSN_61439_2_ED3"` pro průmyslové PSC rozváděče; `"CSN_60204_1_ED3"` pro strojní rozváděče dle ČSN EN 60204-1 ed. 3 a Nařízení EU 2023/1230)
     * `routineTestJson` (String? – JSON s výsledky Protokolu o kusové zkoušce dle čl. 11 ČSN EN IEC 61439-1 ed. 3)

2. ROZŠÍŘENÍ UPLOADŮ (/api/uploads):
- V `src/app/api/uploads/route.ts` přidej nové druhy uploadů:
  * `kind = "attachment"` (návody a datasheety: povol `.pdf`, `.png`, `.jpg`, `.webp`, `.svg`, `.docx`, `.xlsx`, `.csv`, `.txt` do 30 MB -> ukládat do `storage/uploads/attachments/`).
  * `kind = "software"` (zálohy PLC/HMI/měničů: povol `.zip`, `.7z`, `.rar`, `.zap16`, `.zap17`, `.zap18`, `.zap19`, `.s7p`, `.acd`, `.xml`, `.json`, `.par`, `.bin`, `.hex`, `.csv`, `.pdf` do 50 MB -> ukládat do `storage/uploads/software/`).

3. KNIHOVNA NÁVODŮ A DATASHEETŮ NA KARTĚ ZAŘÍZENÍ (`/equipment/[id]`):
- Přidej na kartu zařízení záložku `📚 Návody & Datasheety (N)`:
  * Přehledné filtrování podle kategorie (Návody k obsluze, Datasheety komponent, Chybové kódy a měniče, Hydraulika/Pneumatika, Certifikáty).
  * Každá karta dokumentu zobrazuje název, kategorii, navázanou komponentu ve schématu (např. štítek `-U1` nebo `-K4`), výrobce, verzi, velikost souboru, tlačítko pro okamžitý náhled PDF (v modalu/iframu) a stažení.
  * Tlačítko `+ Nahrát návod / datasheet` (otevře dialog s výběrem souboru, kategorie, názvu a volitelného označení komponenty ze schématu).
  * Propojení s interaktivním schématem: pokud má komponenta (např. `-M1`, `-Q1`, `-UC2`) přiřazený datasheet se shodným `componentTag`, zobraz v plovoucí kartě prvku ve výkresu přímé tlačítko `📄 Otevřít datasheet komponenty`.

4. VERZOVANÉ ZÁLOHY SOFTWARU, PLC A PARAMETRŮ STROJŮ + PROPOJENÍ S ČERVENKOU:
- Přidej na kartu pevných zařízení (rozváděče, výrobní linky, CNC, roboty, VZT, kompresory) záložku `💾 Software & Zálohy PLC`:
  * Seskupení podle řídicích uzlů stroje (`targetUnit`, např. "PLC -A1", "Frekvenční měnič -U1", "HMI Panel").
  * U každého uzlu svítí zelená karta **Aktuální platná záloha v provozu (`ACTIVE`, např. `v1.2`)** s datem, autorem, platformou (`TIA Portal V19`), verzí firmwaru (`FW V3.1`), případným **Safety CRC podpisem** (pokud jde o bezpečnostní program dle EU 2023/1230), popisem poslední změny (`changeSummary`), odkazem na související ticket Červenky (`ZM-2026-...`) a tlačítkem `⬇️ Stáhnout zálohu`.
  * Pod aktivní verzí je rozbalovací **Historie a archiv starších verzí (`v1.1`, `v1.0`)** s porovnáním změn (changelog timeline) a možností stáhnout starší verzi pro případ návratu (rollback) nebo jedním klikem nastavit starší verzi zpět jako `ACTIVE`.
  * Tlačítko `+ Nahrát novou verzi zálohy SW / parametrů`:
    - Umožní vybrat existující řídicí uzel stroje (nebo zadat nový), zvolit skok verze (`Minor +0.1` pro úpravu parametrů/časovačů vs. `Major +1.0` pro novou revizi programu), nahrát soubor zálohy, zadat povinný popis změny v programu, zaškrtnout `Bezpečnostní program (Safety PLC / F-CPU)` + vyplnit `Safety Checksum (CRC)` a volitelně spárovat se změnovým řízením (`ChangeRequest`).
    - Při uložení v transakci přepne dosavadní `ACTIVE` verzi daného uzlu na `ARCHIVED` a novou nastaví jako `ACTIVE`.
- Propojení do průvodce **Zadat změnu (Červenka)** a **CAE Ticketu**:
  * V průvodci Červenkou přidej:
    1. Klasifikaci zásahu dle **Nařízení (EU) 2023/1230**:
       - `🟢 Běžná údržba / Výměna 1:1 (nemění funkci ani bezpečnost)`
       - `🟡 Provozní úprava zapojení (bez zásahu do bezpečnostních obvodů)`
       - `🔴 Zásah do bezpečnostního obvodu / Safety PLC (Podstatná změna dle čl. 18 Nařízení EU 2023/1230!)` – při volbě zobraz výrazné varování, že zásah vyžaduje schválení vedoucím údržby, ověření Safety CRC a posouzení shody.
    2. Zaškrtávací pole `💾 Součástí zásahu byla i úprava řídicího SW / parametrů měniče` – s možností rovnou v průvodci přiložit novou zálohu SW (nebo se u ticketu v CAE zobrazí oranžový úkol `⚠️ Čeká na nahrání aktualizované zálohy SW`).

5. LEGISLATIVA 2027 V AI PANEL BUILDERU A SPRÁVĚ ZÁVODŮ:
- **V AI Panel Builderu (`/panel-builder/[id]` a `/documentation`):**
  * V nastavení projektu a v Kroku 4 umožni přepnout normu rozváděče (`standardEdition`):
    1) `ČSN EN IEC 61439-1 ed. 3 / ČSN EN IEC 61439-3 ed. 2` (Rozvodnice DBO určené k laické obsluze – platnost 2027)
    2) `ČSN EN IEC 61439-1 ed. 3 / ČSN EN IEC 61439-2 ed. 3` (Výkonové průmyslové rozváděče PSC)
    3) `ČSN EN 60204-1 ed. 3 + Nařízení (EU) 2023/1230` (Elektrická zařízení pracovních strojů)
  * Aktualizuj texty na Listu 5 (Oteplení) a Listu 6 (EU prohlášení o shodě a CE štítek), aby dynamicky vypisovaly přesné zvolené edice norem pro rok 2027 (včetně směrnic LVD 2014/35/EU, EMC 2014/30/EU a RoHS 2011/65/EU, resp. Nařízení (EU) 2023/1230 u strojních rozváděčů).
  * Přidej do Kroku 4 interaktivní **Protokol o kusové zkoušce rozváděče (dle čl. 11 ČSN EN IEC 61439-1 ed. 3)** s 8 kontrolními body (1. Stupeň krytí IP, 2. Vzdušné a povrchové cesty, 3. Ochrana před úrazem a spojitost PE obvodu, 4. Vestavěné přístroje, 5. Vnitřní el. obvody a spoje, 6. Svorky pro vnější vodiče, 7. Mechanická funkčnost, 8. Dielektrické vlastnosti a izolační odpor R_iso [MΩ]) a vykresli ho přímo do tiskového PDF elaborátu.
- **Ve Správě závodů (`/equipment/[id]`, LOTO, QR štítky, Revize):**
  * V záložce `Pasport & Shoda` v bloku **LOTO – Bezpečné odpojení** doplň terminologii dle **ČSN EN 50110-1 ed. 4**: *Osoba odpovědná za elektrické zařízení (OOEZ)*, *Osoba pověřená řízením pracovní činnosti (OPŘPČ)* a checklist *5 bezpečnostních pravidel pro zajištění pracoviště*.
  * Na tiskový **QR štítek zařízení** (`QrDialog`) přidej legislativní doložku: `"Digitální provozní dokumentace dle čl. 10 Nařízení (EU) 2023/1230 a ČSN EN 50110-1 ed. 4"`.
  * V pravidlech revizí (`src/lib/inspection-rules.ts` a `inspection-protocol.ts`) aktualizuj normu hromosvodů na `ČSN EN IEC 62305-3 ed. 3` a u rozváděčů `RZ1 (UPS)` zobraz sekci **Digitální pas baterie dle Nařízení (EU) 2023/1542** (kapacita, chemie, SoH %, stav článků).

6. BOHATÝ SEED PRO UKÁZKU NOVÝCH FUNKCÍ:
- Doplň do seedu (i do přírůstkového produkčního seedu, aby se vše ukázalo na eldock.cz bez smazání DB) ukázková data:
  * U rozváděče/stroje **R-CNC-04**, **CNC-04**, **LIS-01** a **ROB-03** přidej vzorové návody k obsluze, datasheety komponent (např. Datasheet stykače ABB AF, Manuál frekvenčního měniče, Návod k obsluze CNC centra dle EU 2023/1230 – generované čisté SVG/PDF dokumenty) a **verzované zálohy softwaru** (např. u `R-CNC-04`: `PLC -A1 Siemens S7-1500` s historií `v1.0 ARCHIVED` -> `v1.1 ACTIVE` s Safety CRC `0x8F4A-2C91` a `Frekvenční měnič vřetene -U1` `v1.0 ACTIVE`).
  * U rozváděče **RZ1 (Rozváděč zálohovaného napájení UPS)** vyplň ukázkový **Digitální pas baterie (EU 2023/1542)** (48 kWh, LiFePO4, SoH 97 %).

Ověř vše přes `npm run verify`, přidej unit testy pro verzování záloh SW a nové normy 2027, udělej commit a vypiš příkazy pro push a deploy na server.

