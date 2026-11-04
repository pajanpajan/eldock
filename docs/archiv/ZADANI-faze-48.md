Spouštíme konsolidační a optimalizační Fázi 48: přidání mazání a správy projektů v AI Panel Builderu, celkový úklid UX/databáze po fázích 0–47 a technické SEO pro zviditelnění https://eldock.cz/ veřejnosti.

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 5 bodech:

1. MAZÁNÍ, HROMADNÝ ÚKLID A SPRÁVA PROJEKTŮ V AI PANEL BUILDERU (/panel-builder):
- Na přehledu projektů (/panel-builder) přidej na každou kartu projektu (vedle ikony v pravém horním rohu) akční menu / tlačítka:
  a) "[ 🗑️ Smazat projekt ]" – otevře potvrzovací dialog ("Opravdu chcete trvale smazat projekt PB-XXX?"). Při smazání v jedné transakci:
     - Smaž projekt i všechny jeho položky (`PanelBoardItem`) z databáze.
     - Fyzicky vymaž související nahrané fotky projektu a lišt ze složky `storage/uploads/` na disku, aby se neplnil server (ochrana: nikdy nemaž soubory ze složky `seed/`).
     - Pokud šlo o neuzavřený testovací/rozpracovaný projekt (stav != `COMPLETED`) a nejde o vzorový `PB-001`, vrať firmě zpět +1 kredit (`creditsRemaining`), aby testeři nepřišli o kredity při zkoušení!
  b) "[ ✏️ Přejmenovat / Upravit hlavičku ]" – rychlý modal pro úpravu názvu rozváděče, jména zákazníka a místa instalace přímo ze seznamu.
  c) Přidej tlačítko "[ 🗑️ Smazat tento projekt ]" také přímo do horní lišty detailu projektu (`/panel-builder/[id]`).
- HROMADNÉ MAZÁNÍ A FILTROVÁNÍ NA PŘEHLEDU (/panel-builder):
  * Nad seznam karet projektů přidej vyhledávací pole ("🔍 Hledat projekt podle kódu, názvu nebo zákazníka..."), filtr stavu (`Vše` / `Rozpracované` / `Dokončené`) a tlačítko "[ ☑️ Hromadný výběr ]".
  * V režimu hromadného výběru zobraz na kartách checkboxy a plovoucí lištu "[ 🗑️ Smazat vybrané projekty (N) ]", aby šlo jedním klikem uklidit desítky testovacích projektů (`test-1`, `test 3` atd.). Vzorový projekt `PB-001` označ štítkem "Vzorový projekt" a chraň ho před nechtěným hromadným smazáním (nebo přidej tlačítko "Obnovit vzorový PB-001").

2. AUDITING A VIZUÁLNÍ SJEDNOCENÍ ROZHRANÍ (CLEANUP PO FÁZÍCH 0–47):
Projdi obě produktové větve (AI Panel Builder i Správa závodů) a vyčisti vizuální a funkční nánosy:
- V AI Panel Builderu (`/panel-builder/[id]`):
  * Zkontroluj, že v pravém panelu (Konfigurátor prvku) nejsou žádné duplicitní karty "Přiřazený přístroj", že horní Sticky karta je čistá a že rozbalovací sekce nepřebíjejí hlavní 2D vektorové plátno.
  * V навигаci kroků projektu (`1. Návrh a osazení` -> `2. Zapojení a hierarchie` -> `3. Výpočet oteplení a bilance` -> `4. Výstupní dokumentace a PDF export`) zobrazuj u každého kroku jasný stavový indikátor (✓ Hotovo / Rozpracováno).
  * Propoj výpočetní modul z Fáze 44 (`src/engine/floorplan-bridge.ts`) do modalu "Nový projekt rozváděče" jako 3. volbu: "[ 🏠 Vygenerovat rozváděč ze soupisu okruhů / místností (ČSN 33 2130 ed. 4) ]", aby tento hotový engine nezůstával nevyužitý v kódu.
- Ve Správě závodů (`/plant`, `/studio`, `/equipment/[id]`):
  * Zkontroluj záložky na kartě zařízení (`Schéma`, `Kusovník`, `3D rozváděč`, `Pasport & Shoda`, `Revize & Lhůtník`, `Návody & Datasheety`, `Software & Zálohy PLC`, `Diagnostika`, `Historie změn`), aby se na noteboocích (1280–1440 px) nezalamovaly do dvou nevzhledných řádků (použij čistý horizontální scroll-container nebo seskupení s počty položek).

3. DATABÁZOVÁ HYGIENA, ÚKLID OSIŘELÝCH SOUBORŮ A SINKRONIZACE DOKUMENTACE:
- Vytvoř údržbový skript `scripts/cleanup-storage.ts` (`npm run storage:cleanup`), který projde `storage/uploads/` a porovná soubory se všemi URL v databázi (`PanelBoardProject`, `Equipment`, `DocumentRevision`, `ChangeRequestAttachment`, `ComplianceDocument`, `InspectionRecord`, `EquipmentDocument`, `SoftwareBackup`, `RegisteredCompany`). Osiřelé soubory starší než 24 hodin mimo `seed/` bezpečně smaže.
- Doplň chybějící databázové indexy v `prisma/schema.prisma` pro nové modely z fází 41–47 (`PanelBoardProject(companyId, updatedAt)`, `EquipmentDocument(equipmentId, category)`, `SoftwareBackup(equipmentId, targetUnit, status)`).
- Aktualizuj `docs/PLAN.md` a spusť `npm run docs:bundle`, aby `ARCHIV-KOMPLET.md` obsahoval kompletní zápisy Deníku pro fáze 43 až 48.

4. TECHNICKÉ SEO A VEŘEJNÁ VIDITELNOST PRO https://eldock.cz/:
Aby vyhledávače (Google, Seznam.cz) a sdílení na sítích (LinkedIn, Facebook) okamžitě indexovaly a atraktivně zobrazovaly `eldock.cz`:
- Vytvoř `src/app/robots.ts`: povol indexaci veřejných stránek (`/`, `/panel-builder/auth`, `/register-plant`) a zakaž indexaci interních aplikačních tras (`/plant/*`, `/equipment/*`, `/cae/*`, `/inspections/*`, `/admin/*`, `/api/*`).
- Vytvoř `src/app/sitemap.ts`: dynamicky generuj `https://eldock.cz/sitemap.xml` pro veřejné vstupní stránky.
- Vytvoř `src/app/opengraph-image.tsx` (přes `next/og` `ImageResponse` v černo-žlutém industriálním designu Eldock): automaticky generovaný náhledový obrázek 1200×630 px s nápisem "ELDOCK – AI Panel Builder & Průmyslový dok dokumentace a revizí", který se zobrazí při vložení odkazu `https://eldock.cz` na LinkedIn, Facebook nebo do WhatsAppu/Teamsů.
- Do `src/app/page.tsx` a root `layout.tsx` doplň kompletní česká SEO metadata (`title`, `description`, `keywords`, `canonical: "https://eldock.cz"`, OpenGraph, Twitter Card) a vlož do úvodní stránky strukturovaná data **JSON-LD (`SoftwareApplication` a `Organization`)** cílená na klíčová slova: *návrh rozváděčů, výrobní dokumentace rozváděče ČSN EN IEC 61439, výpočet oteplení rozváděče IEC 60890, štítek rozváděče CE, pasportizace rozváděče z fotky, správa elektrorevizí ČSN 33 1500*.

5. UKÁZKA VÝSTUPU BEZ REGISTRACE PŘÍMO NA LANDING PAGE (`/`):
- Návštěvník, který přijde na `https://eldock.cz/`, chce před registrací vidět, co přesně z AI Panel Builderu vypadne.
- Přidej na úvodní stránku `/` k sekci AI Panel Builderu interaktivní náhled / modální okno **"[ 📄 Prohlédnout vzorový 6listový PDF elaborát rozváděče ]"** (Titulní list, 2D osazení, 1P schéma, Kusovník, Výpočet oteplení dle ČSN EN IEC 61439 a EU Prohlášení o shodě s CE štítkem), aby si každý elektrikář a revizák mohl výstup prohlédnout na 1 klik ještě před registrací.

Po implementaci spusť `npm run verify`, aktualizuj E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.

