# ELDOCK – trvalá paměť projektu

B2B webová aplikace a PWA pro výrobní závody: elektro dokumentace (schémata, kusovníky, půdorysy),
revize VTZ, změny skutečného provedení mezi údržbou v hale a externími CAE projektanty a AI pasportizace
rozváděčů. Pracovní název byl Digitry, od fáze 20 je to **ELDOCK**. Produkce běží na https://eldock.cz.
Původní zadání MVP je v `docs/archiv/SPECIFIKACE-MVP.md`, celá historie fází 0–35 v `docs/archiv/PLAN-faze-00-35.md`, celý archiv v jednom souboru `docs/archiv/ARCHIV-KOMPLET.md`.

## 1. Milníky (fáze 0–47 nasazené, 48–49 hotové k nasazení)

| Fáze | Milník |
|---|---|
| 0–12 | Core: mapa areálu → izometrie budovy → půdorys s piny, detail zařízení (QR, schéma, kusovník, 3D skříň, historie revizí), průvodce „Zadat změnu“ (redlining, fotky, hlas), CAE back-office, schválení údržbou, PWA, E2E |
| 13–16 | Revize VTZ: pasport rozváděče (ČSN EN 61439), lhůtník (ČSN 33 1500), spotřebiče a nářadí, rychlá revize, plánovač s hlasovým dispečerem, provizoria, závady, LOTO, auditní report |
| 17–19 | Účty a výřezy dat (RBAC, 6 typů účtů), Studio výstavby závodu, nový závod od nuly, kniha PCSCHEMATIC, diagnostika spojů, přihlašovací brána `/login` |
| 20–25 | Rebranding na ELDOCK a Docker, PDF protokoly, hlídač lhůt e-mailem, import CSV, visual diff revizí, prokliky ve schématu, licenční moduly a tarify, výkon (SQLite PRAGMA, lazy loading) |
| 26 | Produktové video v Remotionu (`npm run video:render`) |
| 27–34 | AI Panel Builder: katalog prvků a těžba datasheetů, analýza fotky přes Gemini, strom zapojení s hlídačem, oteplení (IEC TR 60890), dokumentace a CE, mix výrobců, živý konfigurátor, Vision Analyzer 2.0 |
| 35 | Revize Studia: rozměr areálu X × Y, funkční měřítko, živé kóty, tažení stěn, 7 typů zón, vrata, banery a barvy zařízení, jemný rastr 1 m, spotřebiče do místností |
| 36 | Konsolidace: zpětná editace pater ve Studiu (`Floor.studioLayoutJson`), optimistický konfigurátor, katalog Bonega, paralelní Vision Analyzer, originál fotky u zákresu, materiál skříně v oteplení, `ELDOCK_LOCK_ACCOUNT_SWITCHER` |
| 37 | Panel Builder: katalog ABB Compact Home, přesnější prompt (odpínače, B vs. C), ruční úprava rámečků, funkce obvodu, IEC prefixy -Q/-FI/-FA/-FV/-F/-K/-KA, krok 2 se skupinovými kartami |
| 38 | Studio: budovy v metrech (osy A…ZZ), více budov v jednom konceptu, přejmenování pater, Zpět/Vpřed, kontextový krok 3 s produktovými banery |
| 39 | Studio: sloupy jako jemné křížky, vlastní nabídka kroku 3 (tenant + localStorage), seskupené štítky „☕ 2× Kávovar“ v místnostech i v uloženém půdorysu, − / + ve skupinách |
| 40 | Studio: výchozí mapa závodu → proklik na budovu (Zařízení a napájení / Místnosti, zóny a vrata / Budova a podlaží), mazání a přesun uložených zařízení; vzorové závody v metrech s bohatým vybavením (`db:demo-plant`) |
| 41 | Dva samostatné produkty: AI Panel Builder (registrace firmy přes ARES, vlastní přihlášení `eldock-pb`, kredity, údaje firmy v PDF) a Správa závodů (`/register-plant`, registrovaný uživatel vidí jen svůj závod) |
| 42 | Panel Builder: čistá fotka se zoomem, 2D vektorový rozváděč (mechanické symboly, CAD Dark / Výkres osazení), našeptávač databáze prvků; zapojení drag & drop nad vektorovým rozváděčem s hlavním přívodem a modrými spojnicemi |
| 43 | Panel Builder: návrh rozváděče od nuly (lišty 8–36M), kaskádový výběr výrobce → kategorie → parametry s drag & drop osazením, výběr skříně podle velikosti, logo a razítko firmy, popisky 1:1, import externí databáze prvků (`npm run catalog:sync`) |
| 44 | Most „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`, `FLOORPLAN_SPEC.md`): kalibrace, řazení vypínačů, okruhy dle ČSN 33 2130 ed. 4, fáze, chrániče, přístroje na lištách a skříň |
| 45 | Panel Builder, krok 1: štítky funkce se Smart Presety a číslováním, sticky karta přístroje s chytrým vložením, prostředí instalace (ČSN 33 2000-5-51), elektro-linter s opravou 1 klikem |
| 46 | Legislativa 2027: návody a datasheety zařízení, verzované zálohy PLC / HMI / měničů se Safety CRC a rollbackem, klasifikace zásahu dle EU 2023/1230, normy ČSN EN IEC 61439 ed. 3 a kusová zkouška, LOTO dle ČSN EN 50110-1 ed. 4, pas baterie |
| 47 | Panel Builder: katalog po výrobcích a kategoriích, 9 značek skryto, Siemens SENTRON a ABB 144M (CA35R, DS301C, EN, free@home / KNX), ventilátory s výpočtem průtoku, domovní vypínače / zásuvky k obvodům i do místností Studia, Vision Analyzer pro velké rozváděče (detailní fotka lišty), přidat vpravo / duplikovat, linter jako odznak |
| 48 | Konsolidace: správa projektů Panel Builderu (hledání, filtr, hromadné mazání s vrácením kreditu, úprava hlavičky, chráněný PB-001), stav kroků, rozváděč ze soupisu místností, `npm run storage:cleanup`, technické SEO (robots, sitemap, náhled odkazu, JSON-LD) a veřejná ukázka elaborátu `/ukazka-elaboratu` |
| 49 | Panel Builder: 2D půdorys elektroinstalace `/panel-builder/floorplan`, 3D výpočet kabeláže s montážními výškami (Spodem / Vrchem / Optimalizovaně), výkaz kabeláže a rozváděč z půdorysu na 1 klik |

## 2. Moduly a klíčová místa v kódu

Licenční moduly a podfunkce definuje `src/lib/modules.ts` (moduly Core, Revize & Legislativa VTZ, CAE Projekce & Verzování
a Enterprise & Onboarding; tarify START / PROFI ÚDRŽBA / KOMPLET ENTERPRISE; režimy Čisté pracoviště / Obchodní demo).
Server je hlídá přes `assertFeature`, správa je na `/admin/modules`.

| Oblast | Trasy | Kód |
|---|---|---|
| Mapy a zařízení | `/plant/...`, `/equipment/[id]` | `components/map/*`, `server/queries/*`, `lib/mock-graphics/*`; návody a zálohy SW `server/services/equipment-knowledge.ts`, `lib/{equipment-documents,software-backups}.ts` |
| CAE workflow | `/cae`, `/equipment/[id]/change-request` | `lib/workflow/state-machine.ts`, `server/services/workflow.ts` |
| Revize VTZ | `/inspections/*` (plánovač, rychlá revize, audit) | `server/services/inspection.ts`, `lib/inspection-rules.ts` |
| Studio | `/studio` | `components/studio/*`, `lib/cad-grid.ts`, `lib/campus-layout.ts`, `lib/equipment-categories.ts`, `server/services/studio.ts` |
| AI Panel Builder (samostatný produkt) | `/panel-builder/*` (skupina `(pb)`), `/panel-builder/auth` | `lib/panel-builder/*`, `server/services/{panel-builder,panel-design,catalog-sync,geminiPanelService}.ts`, `server/panel-session.ts`, `scripts/sync-external-catalog.ts` |
| Účty, firmy a přístup | `/admin/users`, `/login`, `/register-plant`, `/api/ares` | `lib/accounts.ts`, `lib/registered-company.ts`, `server/permissions.ts`, `server/services/companies.ts`, `src/proxy.ts` |

## 3. Architektonické mantinely (závazné)

- **Next.js 16.4** (App Router, Turbopack, React 19; lint hlídá i pravidla React Compileru). `params`, `searchParams`, `cookies()` a `headers()` jsou async a Cache Components jsou vypnuté. Před psaním kódu s Next API čti návod v `node_modules/next/dist/docs/` (viz `AGENTS.md`). Lint = `eslint .`.
- **UI:** Tailwind CSS 4 (loader `@tailwindcss/turbopack`), shadcn/ui, `lucide-react`, `motion/react`, `sonner`. Výhradně česky, kód anglicky. Tmavý průmyslový vzhled. Stavové barvy a popisky jsou jen v `src/lib/status.ts`. Grafika je SVG/CSS generovaná kódem, bez externích obrázků a CDN.
- **Prisma 7.10:** balíčky vždy `@7` (tag `latest` je 8.0 RC). Klient se importuje z `@/generated/prisma/client` a v aplikaci jen přes `src/lib/prisma.ts`. Adaptér `@prisma/adapter-better-sqlite3`; `DATABASE_URL` je v `prisma.config.ts`.
- **SQLite:** za běhu produkce `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000` a `foreign_keys=ON` (`SQLITE_PRAGMAS` v `src/lib/prisma.ts`). V dev režimu je `DELETE`.
- **Vrstvy:** čtení dat v `src/server/queries` (`server-only`), business logika ve `src/server/services` (dostává `prisma` a `actor`, testuje se nad SQLite přes `test-db.ts`), tenké Server Actions v `src/server/actions` (zod → služba → `revalidatePath`), čisté funkce v `src/lib`; výpočetní moduly mezi produkty v `src/engine` (most půdorys → rozváděč, `FLOORPLAN_SPEC.md`).
- **Účty:** `ELDOCK_LOCK_ACCOUNT_SWITCHER=1` (produkce bez dema) = účet určuje jen podepsaná přihlašovací cookie a server přepnutí odmítne; výchozí `0` = obchodní demo s přepínačem. Nastavení účtu bez kontroly je `applyAccount` v `src/server/account-switch.ts` (záměrně mimo `"use server"`).
- **Dva produkty (fáze 41):** AI Panel Builder má vlastní přihlášení firmy (`RegisteredCompany` PANEL_BUILDER, cookie `eldock-pb` s předmětem `pbc:<id>`, `getPanelCompany`) a vlastní lištu; v navigaci správy závodů není. Každý dotaz i akce Panel Builderu filtruje `companyId`. Registrovaná firma správy závodů (`/register-plant`) má uživatele s `homePlantId` + `companyId`: přihlašuje se heslem firmy, bez přepínače účtů a vidí jen svůj závod (`plantAccessWhere`); demo účty nevidí závody registrovaných firem. Demo firma Tester (`tester@eldock.cz` / `Tester2026!`) vzniká v `db:panel-builder`.
- **Soubory:** jen ve `storage/uploads`. Upload přes `POST /api/uploads`, čtení přes `GET /api/files/[...path]`. SVG se v UI zobrazuje přes `<img>`; výjimka jsou půdorysy generované aplikací.
- **Workflow (CAE):** požadavek prochází `SUBMITTED → IN_PROGRESS → WAITING_APPROVAL → APPROVED`. Zamítnutá revize (`REJECTED`, komentář povinný) vrací požadavek do `IN_PROGRESS`; CAE může požadavek zrušit (`CANCELLED`). Každý přechod probíhá v `$transaction` se záznamem `ChangeRequestEvent`. Zařízení má max. 1 otevřený požadavek a 1 aktivní revizi. Stav zařízení se odvozuje přes `deriveEquipmentStatus`. Úplná tabulka přechodů je v archivu plánu, sekce B. Fáze 46: požadavek nese `safetyImpact` (EU 2023/1230) a `requiresSoftwareUpdate`; zálohy SW (`SoftwareBackup`) se zakládají jen přes `createSoftwareBackupInTx` (předchozí ACTIVE uzlu → ARCHIVED v transakci). Normy 2027, kusová zkouška, LOTO a QR doložka mají jediný zdroj `lib/legislation-2027.ts`.
- **Panel Builder – značení a zapojení:** IEC prefixy jen z `DESIGNATION_PREFIX` (`src/lib/panel-builder/matching.ts`); návrh zapojení `proposeTree` = pravidlo DIN lišty (chránič napájí jističe napravo na své liště). Hlídač hlásí jako chybu jen nezapojený prvek, cyklus a 3P pod 1P – součet In nad In chrániče není chyba.
- **Panel Builder – vektorový rozváděč (fáze 42):** krok 1 i 2 kreslí `VectorPanel` se symboly `VectorModuleSymbol` (texty `symbolTexts`, data `vectorDeviceFrom` v `lib/panel-builder/vector-symbols.ts`, geometrie a spojnice `vectorLayout` / `wiringPaths` v `vector-layout.ts` – čáry jen mezerami mezi lištami a okraji). Na fotce se rámečky nekreslí. Kořen stromu = prvek s `fedFromIncomer` bez rodiče (`currentRoot`; bez volby `chooseRoot`: odpínač, jinak první 3P/4P na 1. liště); `PanelBoardProject.incomerFrom` = TOP / BOTTOM. Drag & drop = `dropOnto` (na koncový přístroj → sourozenec pod jeho rodičem, fáze `rotatePhases`), hlavní vstupní prvek se nepřetahuje, mění se jen přes `setRoot`.
- **Panel Builder – návrh od nuly a katalog (fáze 43):** `PanelBoardProject.designMode` = PHOTO / DESIGN; kapacita lišt je pole `railModulesJson` (vždy přes `railCapacities` / `railColumns` v `lib/panel-builder/rails.ts`, `modulesPerRail` = nejširší lišta). Osazení z kaskády = `placeComponents` (`services/panel-design.ts`), kaskádové menu `CascadePicker` + `PlacementCard`. Skříně = model `PanelEnclosure` (matice `standardEnclosureMatrix` + externí DB), filtr `fitEnclosures`. Externí databáze `ai-panel-builder` se importuje jen přes `npm run catalog:sync` / export `prisma/external-catalog/catalog.json` (`importExternalCatalog`, upsert, vlastní katalog Eldocku se nepřepisuje); export po synchronizaci commitni.
- **Panel Builder – katalog a značky (fáze 47):** skryté značky jen přes `HIDDEN_MANUFACTURERS` / `isHiddenManufacturer` (`lib/panel-builder/brands.ts`) – v DB se nemažou, každý dotaz na katalog je musí vyfiltrovat. Kategorie katalogu = `lib/panel-builder/catalog-groups.ts`. Rešerše výrobců (Siemens, ABB z praxe, ventilátory `EnclosureFan`) = `prisma/seed-catalog-research.ts`. Domovní přístroje (`WiringDevice`, `PanelItemWiring`) se plní jen z exportu `prisma/external-catalog/wiring.json` (`catalog:sync`; `readSnapshot` ho záměrně nečte). Úprava detekcí z fotky = `normalizeDetection` (`detection-rules.ts`) + test; analýza nikdy nedoplňuje moduly do kapacity lišty; detailní fotka lišty = `analyzeRailDetail` (přepíše jen danou lištu). Ventilátor: `lib/panel-builder/fans.ts`.
- **Panel Builder – správa projektů (fáze 48):** vzorový projekt = `SAMPLE_PROJECT_CODE` (`lib/panel-builder/project-admin.ts`); mazání jen přes `deletePanelProjects` (`services/panel-projects.ts`: transakce + vrácení kreditu za nedokončený projekt mimo PB-001, pak fyzické smazání fotek přes `removeStoredFile` – nikdy `seed/`). Nový projekt ze soupisu místností = `src/engine/room-schedule.ts` → `createProjectFromSchedule`. Stav kroků = `stepProgress`. Sestavení 6listového elaborátu jen v `server/panel-documentation.ts` (`buildDocumentationData`, sdílí krok 4 i veřejná `/ukazka-elaboratu`).
- **Panel Builder – 2D půdorys a kabeláž (fáze 49):** výšky a režimy vedení jen v `src/engine/floorplan-bridge.ts` (`ElevationProfile`, `mountHeight`, `homeRunLength`), trasy okruhů a výkaz v `src/engine/cable-routing.ts` (`summarizeCabling`) – nové pravidlo = test v `cable-routing.test.ts`. Model editoru (paleta, nákres v mm, `buildPlan`, `analyzeDraft`) = `lib/panel-builder/floorplan-editor.ts`; editor běží jen v prohlížeči (nákres v localStorage). Projekt z půdorysu = `createProjectFromFloorplan` (výkaz `cableReportJson`, nákres `floorplanJson`, domovní přístroje `pickWiringDevice`).
- **Veřejná část a SEO (fáze 48):** veřejné trasy = `PUBLIC_PATHS` v `src/proxy.ts`; SEO texty, veřejné / zakázané cesty a JSON-LD jen v `src/lib/seo.ts` (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`). Stránka s vlastním `openGraph` musí uvést `images: [OG_IMAGE]`, jinak náhled odkazu zmizí. Osiřelé soubory úložiště uklízí `npm run storage:cleanup` (`--dry-run` nejdřív; maže jen soubory bez odkazu v DB starší 24 h mimo `seed/`).
- **Panel Builder – krok 1 (fáze 45):** štítky funkce obvodu = `lib/panel-builder/circuit-chips.ts` (localStorage `eldock.pb.circuit-chips` + `RegisteredCompany.circuitChipsJson`, novější `updatedAt` vyhrává); prostředí instalace = `environments.ts` (`PanelBoardProject.environment`, výběr přepíše `ambientTempC`); kontroly rozváděče jen v `validateSwitchboardState` (`linter.ts`) – nové pravidlo = nový `rule` + test, oprava přes existující Server Actions.
- **Studio:** rozměr budovy v metrech (`GridSpec.widthM/depthM`, osy dopočítané `axisMeters`, bez limitu os), koncept = více budov uložených v jedné transakci (`saveStudioConcept`). Souřadnice v metrech od osy A1, jednotné měřítko (`planFrame`). Každé uložené patro má `Floor.studioLayoutJson` (rastr, zóny, vrata) a jde znovu upravit; starší patra bez JSON se čtou ze SVG (`src/lib/studio-layout.ts`). Pin zařízení je vždy v rámu svého patra (`frameOfFloor`); při úpravě patra se piny přepočítají přes metry. Nabídka kroku 3 = `src/lib/studio-menu.ts` (`TenantSetting` `studio.menu` + localStorage, vyhrává novější `updatedAt`); seskupené štítky místností (`roomInventoryGroups`) se při uložení konceptu kreslí do `floorplanSvg` (`refreshFloorInventory`, skupina `data-room-inventory`). Výchozí obrazovka `/studio` je mapa závodu (bez konceptu); klik na budovu = pohled budovy se 3 režimy, „Uložit změny patra“ zůstane ve Studiu. Uložená zařízení jde ve Studiu přesunout (`equipmentEdits[].pos`) a smazat (`equipmentDeletes`, potvrzení v UI, server odmítne zařízení s otevřeným požadavkem nebo s nepřepojenými odběry).

## 4. Databáze – bezpečnostní pravidla

- **Na produkci NIKDY** nespouštěj `db:reset`, `prisma migrate reset`, `prisma db push` ani `npm run db:seed` nad daty. Seed nejdřív maže tabulky a je určený jen pro prázdnou databázi.
- Změna schématu = vždy čistá přírůstková migrace: `npx prisma migrate dev --name <popis>`, pak `npx prisma generate`. Migrace musí projít nad existujícími daty (výchozí hodnoty, žádné destruktivní přejmenování). Kontejner je při startu aplikuje přes `prisma migrate deploy`.
- Nová demo nebo katalogová data patří do přírůstkových skriptů (`upsert`, nic nemazat), stejně jako `db:demo-docs`, `db:demo-legislation` (návody, zálohy SW, pas baterie – značka `demo.legislation-2027`), `db:demo-plant` (vzorové závody v metrech, jednorázově přes značku `demo.plant-layout`, patra upravená ve Studiu nemění) a `db:panel-builder`, které entrypoint pouští nad neprázdnou DB. `ELDOCK_SEED_DEMO=1` plní demo daty jen prázdnou databázi.
- Lokálně: seed se spouští ručně (`npm run db:seed`). `db:reset` (smaže `dev.db`) jen po výslovném souhlasu uživatele.

## 5. Gemini (AI Panel Builder)

- Proměnné prostředí: `GEMINI_API_KEY`, `GEMINI_VISION_MODEL` (výchozí `gemini-2.5-pro`, analýza fotky po DIN lištách) a `GEMINI_DATASHEET_MODEL` (výchozí `gemini-2.5-flash`, datasheety a parametry). Čte je `src/server/services/geminiPanelService.ts`, v produkci přicházejí přes `docker-compose.yml`.
- **Stav (ověřeno 2026-11-01):** klíč je nastavený lokálně v `.env` i na produkci (kontejner `eldock-app`), takže **AI běží naostro přes Gemini**.
- Demo režim (deterministická analýza a Smart Fallback Picker) je jen záložní: zapne se bez klíče, u SVG ukázek nebo při chybě volání (klíč, kvóta, výpadek); UI pak ukáže štítek „Demo AI režim“. E2E testy běží záměrně s prázdným klíčem.
- Klíč nikdy nevypisuj do výstupu a nedávej ho do Gitu.

## 6. Pracovní postup

- Plán je v `docs/PLAN.md` (rotující: hotové fáze jednořádkově, podrobně jen otevřená fáze). `/faze` = další otevřená fáze, `/faze N` = konkrétní fáze. Jedna fáze = jeden commit, pak se zastav a shrň. `/overit` = kompletní kontrola.
- Archiv `docs/archiv/*.md` zůstává po souborech, ale vedle něj se udržuje sjednocený `docs/archiv/ARCHIV-KOMPLET.md` (archiv + na konci aktuální `docs/PLAN.md`; generuje `npm run docs:bundle`, ručně needitovat). Po každé změně archivu nebo plánu (nové `ZADANI-faze-N.md`, deník, stav fáze) skript spusť; test `scripts/archive-bundle.test.ts` ve `verify` neaktuální soubor odhalí.
- Uživatel občas vloží nové zadání místo obsahu `docs/PLAN.md`. Plán pak obnov z gitu a zadání doplň jako novou fázi. **Čísla fází v zadání ověř proti `git log`**, zadání někdy uvádí zastaralé číslo.
- Před každým commitem musí projít `npm run verify` (typecheck, lint, vitest, build). U UI změn spusť i dotčené E2E (`npx playwright test e2e/<soubor>`; vlastní server na portu 3200 s `e2e.db` a `.next-e2e`). Ruční dev server při testování spouštěj s jiným `NEXT_DIST_DIR` (např. `.next/shots`). Dva servery se sdíleným `.next-e2e` si rozbijí cache a stránky se pak přenačítají dokola.
- Prostředí je Windows: používej npm a Node/TS skripty. Pozor na CRLF po `git stash`. Regexy a `\b` nepiš přes bash heredoc do JS řetězců (vznikne řídicí znak) – použij Edit nebo `String.raw`. `git push` dělej jen při nasazení. Na mazání mimo projekt a nevratné operace se nejdřív zeptej.
- E2E: `e2e/global-setup.ts` před testy v prohlížeči zahřeje hlavní trasy (studený dev server stránky během kompilace přenačítá, první testy pak náhodně padaly).

## 7. Nasazení na produkci (Hetzner, https://eldock.cz)

Když uživatel řekne **„nasaď to na produkci“** nebo **„deploy“**:

1. Ověř změny (`npm run verify`) a commitni je (`git add -A`, commit s výstižnou zprávou).
2. `git push` na GitHub (`origin main`).
3. `ssh root@91.99.148.62 "cd /root/eldock && git pull && docker-compose up -d --build"`. Build na serveru s 2 GB RAM trvá přes 10 minut, proto ho pouštěj na pozadí. Docker build vynechává kontrolu typů (`ELDOCK_SKIP_BUILD_TYPECHECK=1`), typy hlídá `verify`.
4. Pokaždé po nasazení ukliď mezivrstvy: `ssh root@91.99.148.62 "docker image prune -f && df -h /"`. Maže jen obrazy bez tagu, kontejnery, data ani `.env` neovlivní.
5. Ověř výsledek: výstup buildu, `docker-compose ps` (`healthy`), odpověď https://eldock.cz (hned po startu chvíli vrací 503) a volné místo na disku. Pak ho shrň.

**Pozor:** na serveru je v `/root/eldock` ručně vytvořený `.env` s produkčními hesly. Nikdy ho nečti do výstupu, nepřepisuj a nedávej do Gitu. Na serveru nespouštěj nic jiného než výše uvedené příkazy a čtecí kontroly; cokoli dalšího (mazání, reset, změny konfigurace) jen po výslovném souhlasu.
Data na serveru: `./data/db` (SQLite) a `./data/storage` (soubory) jako svazky a `./data/caddy` (certifikáty). Caddy publikuje porty 80 a 443.

@AGENTS.md
