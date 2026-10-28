# Digitry MVP – implementační plán

Plán pro realizaci specifikace z `CLAUDE.md` v Claude Code. Dělá se **fázi po fázi**: jedna fáze = jedna úloha (`/faze N`) = jeden commit. Po každé fázi se práce zastaví, ověří a shrne.

## Jak plán používat

1. Otevři terminál ve složce projektu a spusť `claude`.
   - Jen poprvé: nainstaluj projektové příkazy – zkopíruj složku `docs/claude/skills` do `.claude/skills` (ručně, nebo napiš Claude Code: *„Zkopíruj docs/claude/skills do .claude/skills“*) a spusť `claude` znovu.
2. Napiš `/faze` (vezme další nedokončenou fázi) nebo `/faze 3` (konkrétní fáze). Bez nainstalovaných příkazů funguje i věta *„Proveď fázi 0 podle docs/PLAN.md“*.
3. Po dokončení fáze si podle sekce **Hotovo když** výsledek vyzkoušej a pokračuj další fází.
4. `/overit` kdykoli spustí kompletní kontrolu (typecheck, lint, testy, build, smoke test workflow).

Claude Code po každé fázi: odškrtne úkoly, nastaví stav v tabulce níže, zapíše odchylky do **Deníku** a udělá commit (nikdy push).

## Stav fází

| # | Fáze | Stav |
|---|------|------|
| 0 | Scaffolding a nástroje | ✅ |
| 1 | Databáze, generátory grafiky a seed | ✅ |
| 2 | App shell, design systém, přepínač rolí | ✅ |
| 3 | Level 1 – Areál závodu | ✅ |
| 4 | Level 2 – Izometrická budova | ✅ |
| 5 | Level 3 – Půdorys patra a piny | ⬜ |
| 6 | Detail zařízení (Documentation Hub) | ⬜ |
| 7 | Workflow jádro – stavový automat, služby, uploady, testy | ⬜ |
| 8 | Průvodce „Zadat změnu“ | ⬜ |
| 9 | CAE Back-Office | ⬜ |
| 10 | Schválení údržbou a archiv | ⬜ |
| 11 | PWA, responzivita, dokončení UX | ⬜ |
| 12 | E2E testy, README a předání | ⬜ |

Legenda: ⬜ nezahájeno · 🟨 rozpracováno · ✅ hotovo

---

## A. Závazná technická rozhodnutí

| Oblast | Rozhodnutí |
|---|---|
| Runtime | Node.js **22 LTS (≥ 22.12)** nebo 24 LTS; npm. Windows: Claude Code s Git for Windows. |
| Framework | **Next.js 16.4** (App Router, Turbopack, React 19), TypeScript **5.x** (create-next-app dává `^5`; TS 7 nepoužívat, Prisma 7 doporučuje 5.9). |
| Next.js 16 specifika | `params` / `searchParams` jsou `Promise` (await), `cookies()` / `headers()` jsou async, `next lint` neexistuje (lint = `eslint .`), **Cache Components vypnuté** (`--no-cache-components`). Před psaním kódu s Next API číst příslušný návod v `node_modules/next/dist/docs/` (viz `AGENTS.md`). |
| UI | Tailwind CSS 4, shadcn/ui, `lucide-react`, animace přes balíček **`motion`** (`import { motion } from "motion/react"`, nástupce framer-motion), toasty `sonner`. |
| ORM | **Prisma 7.10** – vždy připínat `@7` (npm tag `latest` je teď 8.0 RC!). Generator `prisma-client` → `src/generated/prisma` (gitignored, import `@/generated/prisma/client`). Připojení přes **`@prisma/adapter-better-sqlite3`** (`new PrismaBetterSqlite3({ url })`); `better-sqlite3` neinstalovat zvlášť – adaptér si nese vlastní verzi. |
| Prisma 7 specifika | `DATABASE_URL` je v `prisma.config.ts` (načítá `dotenv`), ne ve schématu. `migrate dev` **nespouští** `generate` ani seed → vždy explicitně `npx prisma generate` a `npx prisma db seed`. Seed je nakonfigurovaný v `prisma.config.ts` (`tsx prisma/seed.ts`). |
| Databáze | SQLite `file:./dev.db` (kořen projektu). Později PostgreSQL: změna `provider` + `@prisma/adapter-pg`. |
| Data na stránkách | Čtení přes `src/server/queries/*` (`import "server-only"`). Stránky s daty jsou dynamické (čtou cookie role, případně `await connection()`), protože better-sqlite3 je synchronní a dotazy by se jinak provedly při prerenderu buildu. |
| Business logika | `src/server/services/*`: čisté služby, které dostanou `prisma` a `actor` jako parametr (testovatelné bez cookies). `src/server/actions/*` = tenké Server Actions: role z cookie → validace `zod` → služba → `revalidatePath`. Pravidla přechodů v `src/lib/workflow/state-machine.ts` (čisté funkce, bez Prismy). |
| Transakce | Každá změna stavu v `prisma.$transaction` + záznam `ChangeRequestEvent`. |
| Autentizace | Žádná (MVP). Role v cookie `digitry-role` (`MAINTENANCE` / `CAE_ENGINEER`), aktuální uživatel = demo uživatel dané role (údržba: Petr Novák, CAE: Ing. Tomáš Král). Výchozí role: údržba. |
| Soubory | Vše v `storage/uploads/{photos,revisions,markups,voice}` (mimo `public/`, protože soubory přidané po buildu `public/` neservíruje). Servíruje `GET /api/files/[...path]` (ochrana proti path traversal, správný content-type). Upload přes Route Handler `POST /api/uploads` (multipart) – ne přes Server Action (limit 1 MB). Do DB se ukládá URL `/api/files/...`. |
| Bezpečnost SVG | Schémata a fotky se v UI zobrazují přes `<img>` (SVG v `<img>` nespouští skripty), redline vrstva leží nad obrázkem. Výjimka: půdorysy patra (`Floor.floorplanSvg`) generuje seed → inline vykreslení je v pořádku. |
| Grafika | Žádné externí obrázky ani CDN. Areál, izometrie, půdorysy, schémata, „fotky“ v seedu a 3D skříň = SVG/CSS generované kódem. |
| Lokalizace | UI výhradně česky, kód a identifikátory anglicky. Datum `Intl.DateTimeFormat("cs-CZ")`, české skloňování počtů (helper `plural`). |
| Stavové barvy | Jediný zdroj pravdy `src/lib/status.ts`: `ACTIVE` zelená (emerald), `PENDING_UPDATE` oranžová, `WAITING_APPROVAL` modrá (sky). |
| Otevřené změny | Max. **1 otevřený požadavek na zařízení**. Pokud existuje, tlačítko „Zadat změnu“ se změní na „Doplnit k otevřené změně ZM-…“ (komentář + fotky do timeline). |
| Verzování revizí | CAE volí *minor* (+0.1, výchozí) nebo *major* (+1.0). Další číslo = maximum ze **všech** revizí zařízení včetně zamítnutých (zamítnuté si číslo ponechají kvůli auditní stopě; unikátní `[equipmentId, major, minor]`). |
| Číslo ticketu | `ZM-{rok}-{pořadí v roce, 4 místa}`, např. `ZM-2026-0043`. |
| Testy | Vitest (stavový automat, služby), smoke skript celé smyčky nad kopií DB, Playwright E2E ve fázi 12. |

## B. Stavový automat (reference pro fáze 7–10)

| Akce (služba) | Kdo | CR z | CR do | Zařízení | Revize | Událost |
|---|---|---|---|---|---|---|
| `submitChangeRequest` | Údržba | – (žádný otevřený CR) | `SUBMITTED` | → `PENDING_UPDATE` | – | `SUBMITTED` |
| `assignChangeRequest` | CAE | `SUBMITTED` | `IN_PROGRESS` (assignee, assignedAt) | `PENDING_UPDATE` | – | `ASSIGNED` |
| `uploadRevision` | CAE | `SUBMITTED`* / `IN_PROGRESS` | `WAITING_APPROVAL` (resolvedAt) | → `WAITING_APPROVAL` | nová `PENDING_APPROVAL` (autor, shrnutí, BOM) | `REVISION_UPLOADED` |
| `approveRevision` | Údržba | `WAITING_APPROVAL` | `APPROVED` (closedAt) | → `ACTIVE` | nová → `ACTIVE` (approver, approvedAt); dosavadní `ACTIVE` → `ARCHIVED` | `APPROVED` |
| `rejectRevision` (komentář povinný) | Údržba | `WAITING_APPROVAL` | `IN_PROGRESS` | → `PENDING_UPDATE` | → `REJECTED` + `rejectionComment` | `REJECTED` |
| `addComment` | obě role | libovolný otevřený | beze změny | – | – | `COMMENT` |
| `cancelChangeRequest` | CAE | `SUBMITTED` / `IN_PROGRESS` | `CANCELLED` (closedAt) | → `ACTIVE` | – | `CANCELLED` |

\* `uploadRevision` nad `SUBMITTED` automaticky přiřadí CR nahrávajícímu projektantovi (zapíše i `ASSIGNED`).

Invarianty (hlídá služba a testují testy):
- Zařízení má max. 1 revizi `ACTIVE` a max. 1 otevřený CR (`SUBMITTED` / `IN_PROGRESS` / `WAITING_APPROVAL`).
- `Equipment.status` = `deriveEquipmentStatus(otevřený CR)`: žádný → `ACTIVE`; `SUBMITTED`/`IN_PROGRESS` → `PENDING_UPDATE`; `WAITING_APPROVAL` → `WAITING_APPROVAL`.
- Nepovolený přechod nebo role → typovaná chyba `WorkflowError` s českou hláškou (UI ji ukáže v toastu).

## C. Demo data (specifikace seedu)

**Závody**
- `JBC` **Závod Jablonec** – Jablonec nad Nisou, klient *JBL Automotive Components s.r.o.* (fiktivní). Hlavní demo.
- `LBC` **Závod Liberec** – malý druhý závod (1 budova „Hala 1 - Lakovna“, 1 patro, 3 zařízení, 1 uzavřený CR), aby CAE dashboard ukazoval tickety napříč závody.

**Uživatelé** (e-maily na doméně `.example`)
- Petr Novák – údržba, směna A (výchozí uživatel role Údržba)
- Jana Dvořáková – údržba, směna B (nahlásila otevřenou změnu → „předchozí směna“)
- Ing. Tomáš Král – CAE projektant (výchozí uživatel role CAE)
- Ing. Lucie Marková – CAE projektant

**Budovy a patra – Závod Jablonec** (rozmístit realisticky v areálu 1000×700: vrátnice, komunikace, parkoviště, zeleň)
| Kód | Budova | Typ | Patra |
|---|---|---|---|
| A | Hala A - Lisovna | PRODUCTION (největší) | 1. NP - Hlavní výroba · 2. NP - Vzduchotechnika |
| B | Hala B - Montáž | ASSEMBLY | 1. NP - Montážní linky (jednopodlažní → klik vede rovnou na půdorys) |
| E | Energetika | ENERGY | 1. PP - Rozvodny · 1. NP - Trafostanice a kompresorovna |
| S | Sklad | WAREHOUSE | 1. NP - Expediční sklad |
| K | Administrativa | OFFICE | 1. NP · 2. NP - Kanceláře |

**Zařízení** (pozice pinů smysluplně v půdorysu, technické údaje realistické)
| Budova/patro | Tag – název | Typ |
|---|---|---|
| E / 1. PP | RM1 - Hlavní rozváděč nn (400 V, 1600 A, IP31) | SWITCHBOARD |
| E / 1. PP | RC1 - Rozváděč kompenzace jalového výkonu | SWITCHBOARD |
| E / 1. PP | RZ1 - Rozváděč zálohovaného napájení (UPS) | SWITCHBOARD |
| E / 1. NP | TR1 - Transformátor 22/0,4 kV, 1000 kVA | TRANSFORMER |
| E / 1. NP | KS1 - Kompresorová stanice | COMPRESSOR |
| A / 1. NP | R-LIS-01 - Rozváděč lisovací linky 1 | SWITCHBOARD |
| A / 1. NP | LIS-01 - Hydraulický lis 400 t | PRODUCTION_LINE |
| A / 1. NP | LIS-02 - Hydraulický lis 250 t | PRODUCTION_LINE |
| A / 1. NP | CNC-04 - CNC obráběcí centrum 04 | CNC_MACHINE |
| A / 1. NP | R-CNC-04 - Rozváděč CNC centra 04 | SWITCHBOARD |
| A / 1. NP | ROB-03 - Robotická buňka odebírání výlisků | ROBOT_CELL |
| A / 2. NP | VZT-01 - Vzduchotechnická jednotka haly A | HVAC_UNIT |
| A / 2. NP | R-VZT-01 - Rozváděč vzduchotechniky | SWITCHBOARD |
| B / 1. NP | ML-01 - Montážní linka dveřních modulů | PRODUCTION_LINE |
| B / 1. NP | ML-02 - Montážní linka sedadel | PRODUCTION_LINE |
| B / 1. NP | R-ML-01 - Rozváděč montážní linky 1 | SWITCHBOARD |
| B / 1. NP | ROB-07 - Svařovací robotické pracoviště | ROBOT_CELL |
| S / 1. NP | R-SKL - Rozváděč skladu a nabíjení VZV | SWITCHBOARD |
| K / 1. NP | RP-ADM1 - Patrový rozváděč 1. NP | SWITCHBOARD |
| K / 2. NP | RP-ADM2 - Patrový rozváděč 2. NP | SWITCHBOARD |

**Revize a požadavky na změnu**
- Každé zařízení má alespoň `v1.0` (digitalizace, autor CAE, schváleno údržbou) s BOM 8–15 položek (Q1 hlavní vypínač, F1–F6 jističe, K1–K4 stykače, T1 zdroj 24 V DC, A1 PLC, X1/X2 svorkovnice … s výrobci a objednacími čísly).
- **RM1**: v1.0 (2019, ARCHIVED) → v1.1 (2022, ARCHIVED) → v1.2 (2024, ACTIVE, z uzavřeného `ZM-2025-0033`) → **v1.3 PENDING_APPROVAL** od Ing. Markové = otevřený **`ZM-2026-0042`** ve stavu `WAITING_APPROVAL` (🔵).
- **R-CNC-04**: v1.0 → v1.1 (ACTIVE, z uzavřeného `ZM-2025-0007`) + otevřený **`ZM-2026-0041`** `IN_PROGRESS` (přiřazen Ing. Král, nahlásila Jana Dvořáková, priorita HIGH): přepis „Vyměněn stykač K4 za jiný typ, přepojena svorka A2“, zákres = červený kroužek kolem K4 na listu 1, 2 fotky (🟠).
- **R-LIS-01**: v1.0 → v2.0 (rekonstrukce linky 2023, ACTIVE, z `ZM-2024-0011`).
- **R-ML-01**: v1.0 → v1.1 **REJECTED** („Chybí přečíslování svorek X2“) → v1.2 ACTIVE, vše v rámci `ZM-2026-0019` (APPROVED) – ukázka vrácení v historii.
- Uzavřené CR mají kompletní timeline událostí. Další nový ticket dostane `ZM-2026-0043`.

**Soubory generované seedem**
- Schémata: `storage/uploads/revisions/seed/<tag>-v<major>.<minor>.svg` (A3 na šířku, rámeček, rohové razítko s názvem zařízení, číslem revize, datem, autorem, číslem listu; obsah se mezi revizemi liší podle popisu změny – např. jiný typ K4).
- „Fotky“: `storage/uploads/photos/seed/*.svg` (stylizované ilustrace zapojení rozváděče a štítku přístroje).
- Seed je **idempotentní**: smaže data v pořadí podle cizích klíčů a složky `storage/uploads/*/seed/`, pak vše vytvoří znovu a vypíše souhrn počtů.

---

## D. Fáze

### Fáze 0 – Scaffolding a nástroje
**Cíl:** běžící Next.js projekt se všemi závislostmi, Prisma klientem a skripty.

- [x] Ověřit `node -v` (≥ 22.12 nebo ≥ 24), `npm -v`, `git --version`. Pokud verze nevyhovuje, zastavit a říct uživateli, co nainstalovat.
- [x] Smazat prázdný testovací soubor `storage/uploads/photos/test.jpg`, pokud existuje.
- [x] Pokud chybí `.claude/skills/faze/SKILL.md`, zkopírovat `docs/claude/skills/*` do `.claude/skills/` a upozornit uživatele, že příkazy `/faze` a `/overit` budou dostupné po restartu `claude`.
- [x] Úvodní commit stávajícího stavu: `chore: specifikace, plán a kostra projektu`.
- [x] Scaffold do dočasné složky (adresář projektu není prázdný):
  `npx create-next-app@16.4.3 scaffold-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-react-compiler --no-cache-components --agents-md --no-agent-feedback --disable-git --skip-install --yes`
- [x] Přesunout do kořene: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `AGENTS.md`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/favicon.ico`. Ukázková SVG z `public/` nepřebírat. Do `.gitignore` doplnit případná pravidla ze scaffoldu (naše zachovat). Smazat `scaffold-tmp`. V `package.json` nastavit `"name": "digitry"`.
- [x] Instalace (verze Prismy vždy `@7`):
  - `npm install`
  - `npm i @prisma/client@7 @prisma/adapter-better-sqlite3@7 dotenv server-only motion lucide-react react-zoom-pan-pinch qrcode.react sonner zod`
  - `npm i -D prisma@7 tsx vitest`
- [x] shadcn/ui: `npx shadcn@latest init` neinteraktivně (zjistit přepínače přes `--help`; základní barva neutral/zinc, CSS proměnné), pak
  `npx shadcn@latest add button card badge dialog sheet tabs table tooltip separator scroll-area dropdown-menu input textarea label sonner skeleton alert avatar breadcrumb toggle-group progress`
- [x] `package.json`:
  - `"type": "module"` (doporučení Prismy 7 – ověřit, že `dev`, `build` i seed projdou; pokud ne, vrátit a zapsat do Deníku)
  - skripty: `dev`, `build`, `start`, `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run --passWithNoTests`, `postinstall: prisma generate`, `db:generate: prisma generate`, `db:migrate: prisma migrate dev`, `db:seed: prisma db seed`, `db:reset: prisma migrate reset --force && prisma generate && prisma db seed`, `db:studio: prisma studio`, `smoke: tsx scripts/smoke-workflow.ts`, `verify: npm run typecheck && npm run lint && npm run test && npm run build`
- [x] `.env` zkopírovat z `.env.example`.
- [x] `src/lib/prisma.ts` – singleton `PrismaClient` s `PrismaBetterSqlite3` adaptérem, cache v `globalThis` kvůli HMR, `import "server-only"`.
- [x] `eslint.config.mjs`: ignorovat `src/generated/**`. `vitest.config.ts`: prostředí node, alias `@` → `src`.
- [x] Dočasná `src/app/page.tsx` s textem „Digitry – připraveno“ (tmavé pozadí), aby šel ověřit běh.

**Hotovo když:** `npx prisma validate` OK · `npm run typecheck` a `npm run lint` OK · `npm run dev` běží na http://localhost:3000 a stránka vrací 200.
**Commit:** `chore(faze0): Next.js 16, Tailwind, shadcn/ui a Prisma 7`

### Fáze 1 – Databáze, generátory grafiky a seed
**Cíl:** migrovaná databáze s realistickými českými daty a vygenerovanými SVG podklady.

- [x] `npx prisma migrate dev --name init` a `npx prisma generate`.
- [x] Generátory grafiky jako čisté TS moduly (použije je seed i aplikace) v `src/lib/mock-graphics/`:
  - `schematic.ts` – `renderSchematicSvg({ equipment, revision, sheet, variant })`: rámeček A3, rohové razítko, přívod L1–L3/N/PE, Q1, F1–Fn, K1–K4 s cívkami a kontakty, T1, A1 PLC, svorkovnice X1/X2, popisky vodičů; prvky mají `data-designation`; `variant` umožní vyznačit změnu (např. jiný typ K4, přepojení A2).
  - `floorplan.ts` – `renderFloorplanSvg({ floor, rooms })`: obvodové zdi, rastr sloupů s osami (A–H / 1–12), vrata, schodiště, místnosti s popisky, technologické zóny; tmavý „blueprint“ styl.
  - `photo.ts` – stylizované SVG „fotky“ (zapojení v rozváděči, výrobní štítek přístroje).
  - `cabinet.ts` (volitelně, **odloženo do fáze 6**) – pomocné funkce pro rozložení modulů skříně podle BOM (využije fáze 6).
- [x] `prisma/seed-data.ts` (data podle sekce C) a `prisma/seed.ts` (vlastní `PrismaClient` s adaptérem – neimportovat `src/lib/prisma.ts` kvůli `server-only`; zápis souborů do `storage/uploads/*/seed/`; idempotence; souhrn počtů na konci).
- [x] Zákres v seedu = JSON tahů v normalizovaných souřadnicích 0–1 (formát viz fáze 8) kolem K4.

**Hotovo když:** `npm run db:reset` doběhne a vypíše cca 2 závody, 6 budov, 9 pater, 23 zařízení, 30+ revizí, 2 otevřené a 5+ uzavřených CR · SVG schémata a fotky existují ve `storage/uploads/**/seed/` a jdou otevřít · `npm run typecheck` OK.
**Commit:** `feat(faze1): migrace, generátory SVG a seed demo dat`

### Fáze 2 – App shell, design systém, přepínač rolí
**Cíl:** jednotný tmavý industriální vzhled, navigace a funkční přepínání pohledů.

- [x] Téma v `globals.css` (Tailwind 4 `@theme` + shadcn proměnné): pozadí zinc-950, plochy zinc-900/800, jemný rastr „blueprint“, akcent signální žlutá (CTA), stavové barvy, vysoký kontrast, velké dotykové cíle (min. 44 px), font Geist Sans + Geist Mono pro tagy a čísla revizí.
- [x] `src/lib/status.ts` (barva, český popisek, ikona, třídy pro badge/pin pro `EquipmentStatus`, `ChangeRequestStatus`, `RevisionStatus`, `ChangeRequestPriority`), `src/lib/format.ts` (datum, relativní čas, `plural`, popisky typů zařízení a budov).
- [x] `src/server/session.ts`: `getCurrentRole()`, `getCurrentUser()`; `src/server/actions/session.ts`: `setRole(role)` → cookie, `revalidatePath("/", "layout")`, přesměrování (CAE → `/cae`, Údržba → poslední závod).
- [x] Root layout (`lang="cs"`, metadata, `Toaster`), horní lišta: logo Digitry, přepínač závodu, přepínač rolí `[Pohled: Údržba v hale] / [Pohled: CAE Projektant]`, jméno aktuálního uživatele; na mobilu kompaktní varianta.
- [x] Sdílené komponenty: `StatusBadge`, `StatusDot`, `PageHeader`, `LocationBreadcrumb`, `EmptyState`, `KpiTile`.
- [x] `/` přesměruje na `/plant/[id]` prvního závodu. České `not-found.tsx`, `error.tsx`, `loading.tsx`.

**Hotovo když:** přepínač rolí funguje a přežije reload · vzhled je konzistentní na 1024×768 i 1920×1080 · `npm run verify` OK.
**Commit:** `feat(faze2): app shell, design systém a přepínač rolí`

### Fáze 3 – Level 1: Areál závodu
**Cíl:** interaktivní mapa areálu s klikacími budovami.

- [x] `src/server/queries/plant.ts` – `getPlantOverview(plantId)`: budovy, počty pater a zařízení, počty otevřených CR podle stavu, „nejhorší“ stav budovy.
- [x] `src/components/map/campus/CampusMap.tsx` (client): SVG ve viewBoxu závodu – oplocení, komunikace, parkoviště, zeleň, vrátnice, směrová růžice, měřítko; budovy jako polygony z `mapPolygon` (procenta → viewBox) s výškovým stínem; hover zvýraznění; štítek s názvem a badge (🔧 počet zařízení, 🟠/🔵 otevřené změny); klik: vícepodlažní → `/plant/[p]/building/[b]`, jednopodlažní → rovnou `/…/floor/[f]`.
- [x] Boční seznam budov (karty se stejnými údaji) pro dotyk a přístupnost; souhrn závodu (zařízení celkem, 🟠, 🔵); legenda.
- [x] Ovládání klávesnicí (budovy focusovatelné, Enter).

**Hotovo když:** Hala A otevře výběr patra, Hala B rovnou půdorys · badge odpovídají seedu (Energetika 🔵 1, Hala A 🟠 1) · `npm run verify` OK.
**Commit:** `feat(faze3): mapa areálu`

### Fáze 4 – Level 2: Izometrická budova
**Cíl:** 45° izometrický pohled na budovu s výběrem patra.

- [x] `src/components/map/isometric/IsometricBuilding.tsx` (client): patra jako naskládané izometrické desky (horní plocha + 2 viditelné stěny) počítané helperem `isoProject(x, y, z)`; podzemní podlaží pod čárkovanou linií terénu; na deskách náznak dispozice a piny zařízení jako tečky ve stavových barvách.
- [x] Hover: patro se vysune a zvýrazní, tooltip s názvem a počty; klik → půdorys. Vedle seznam pater (karty).
- [x] Přechody (motion) Areál → Budova → Patro (scale + fade, sdílené `layoutId` u názvu budovy); respektovat `prefers-reduced-motion`.
- [x] Breadcrumb `Závod Jablonec › Hala A - Lisovna`.

**Hotovo když:** Hala A ukazuje 2 patra, Energetika 1. PP pod terénem + 1. NP, Administrativa 2 patra · přechody jsou plynulé · `npm run verify` OK.
**Commit:** `feat(faze4): izometrický výběr patra`

### Fáze 5 – Level 3: Půdorys patra a piny
**Cíl:** zoomovatelný půdorys s interaktivními piny zařízení.

- [ ] `src/server/queries/floor.ts` – patro, budova, zařízení s otevřeným CR.
- [ ] `src/components/map/floorplan/FloorplanViewer.tsx` (client) s `react-zoom-pan-pinch`: inline `floorplanSvg` + vrstva pinů ve stejném souřadném systému; piny drží konstantní velikost na obrazovce (protiškálování podle zoomu).
- [ ] Pin: stavová barva, ikona podle typu, tag pod pinem, pulzování u `PENDING_UPDATE`, tooltip; klik → `Sheet` s rychlým náhledem (název, stav, aktivní revize, otevřená změna) a tlačítkem „Otevřít detail“.
- [ ] Ovládání: zoom +/−, reset, filtr stavu a typu, vyhledání tagu s přiblížením na pin; legenda; tabulka zařízení patra.
- [ ] Pinch-zoom na dotyku.

**Hotovo když:** R-CNC-04 na 1. NP Haly A svítí oranžově a pulzuje, RM1 v 1. PP Energetiky modře · filtr a hledání fungují · zoom 400 % je ostrý · `npm run verify` OK.
**Commit:** `feat(faze5): půdorys patra a piny zařízení`

### Fáze 6 – Detail zařízení (Documentation Hub)
**Cíl:** kompletní stránka zařízení dostupná i přes QR kód.

- [ ] `src/server/queries/equipment.ts` – zařízení, lokace, revize (s autorem, schvalovatelem, BOM), otevřený CR (přílohy, události).
- [ ] `/equipment/[id]` (server, `notFound()`): hlavička – název, tag, ID, breadcrumb lokace (odkazy), `StatusBadge`, tlačítko QR (Dialog s `qrcode.react`, absolutní URL z `headers()`, tisk štítku přes print CSS).
- [ ] **Bezpečnostní banner** při `PENDING_UPDATE`: výrazný oranžový, „Pozor – nahlášená změna (směna, kdo, kdy). Oficiální výkres zatím neodpovídá skutečnosti.“ + fotky (lightbox), přepis hlasové poznámky, náhled zákresu (aktuální schéma + vrstva tahů). Při `WAITING_APPROVAL` modrá varianta s CTA „Zkontrolovat novou revizi“.
- [ ] Záložky: **Schéma** (`SchematicViewer`: SVG/obrázek přes `<img>` v zoom-pan, PDF přes `<iframe>`, listy, stažení, výběr revize `?rev=`) · **Kusovník** (`BomTable`: řazení, hledání, export CSV) · **3D rozváděč** (`Cabinet3D`: CSS 3D skříň, otáčení tažením a tlačítky, otevírání dveří, DIN lišty s moduly podle BOM – bez externích knihoven) · **Historie změn** (`RevisionTimeline`: revize sestupně, verze, datum, autor, schvalovatel, shrnutí, stav včetně důvodu zamítnutí, odkaz na CR, stažení, „Zobrazit“).
- [ ] CTA „Zadat změnu“ (role Údržba; při otevřeném CR „Doplnit k otevřené změně ZM-…“); na mobilu přilepené dole.

**Hotovo když:** R-CNC-04 ukazuje banner s fotkami, přepisem a zákresem · RM1 modrou výzvu · R-ML-01 má v historii zamítnutou v1.1 s důvodem · QR vede na správnou URL · `npm run verify` OK.
**Commit:** `feat(faze6): detail zařízení a dokumentace`

### Fáze 7 – Workflow jádro: stavový automat, služby, uploady, testy
**Cíl:** spolehlivá a otestovaná logika celé smyčky dříve, než na ni napojíme UI.

- [ ] `src/lib/workflow/state-machine.ts`: typy akcí, tabulka přechodů ze sekce B, `canPerform(action, role, crStatus)`, `deriveEquipmentStatus()`, `nextVersion(revisions, bump)`, `formatTicketNumber(year, seq)`, `WorkflowError`.
- [ ] `src/lib/workflow/state-machine.test.ts` (Vitest): všechny povolené i zakázané přechody a role, verzování včetně zamítnutých revizí, odvození stavu zařízení, formát čísla ticketu.
- [ ] `src/server/services/workflow.ts`: `submitChangeRequest`, `addComment`, `cancelChangeRequest`, `assignChangeRequest`, `uploadRevision` (včetně kopie/úpravy BOM), `approveRevision`, `rejectRevision` – parametry `(prisma, actor, input)`, transakce, události, kontrola invariantů.
- [ ] `src/server/actions/workflow.ts`: tenké Server Actions (role z cookie, `zod`, služba, `revalidatePath` dotčených stránek), návratový typ `{ ok: true, data } | { ok: false, error }`.
- [ ] `src/app/api/uploads/route.ts` (POST multipart, `kind` = photo | revision | markup | voice; povolené typy a limity: fotky jpg/png/webp ≤ 15 MB, revize pdf/svg/png/jpg ≤ 25 MB) → `storage/uploads/<kind>/<cuid>.<ext>` → `{ url }`.
- [ ] `src/app/api/files/[...path]/route.ts` (GET, ochrana proti `..`, content-type, `Cache-Control`, u SVG hlavička `Content-Security-Policy: sandbox`).
- [ ] `scripts/smoke-workflow.ts`: zkopíruje `dev.db` do `smoke.db`, nad kopií projde celou smyčku přes služby (submit → assign → upload → reject → upload → approve), ověří invarianty, vypíše ✔ kroky a kopii smaže. Dev DB zůstane beze změny.

**Hotovo když:** `npm run test` zelené (≥ 20 testů) · `npm run smoke` projde · `npm run verify` OK.
**Commit:** `feat(faze7): stavový automat, služby workflow, uploady a testy`

### Fáze 8 – Průvodce „Zadat změnu“
**Cíl:** zadání změny bez psaní, ovladatelné prstem v rukavici na tabletu i mobilu.

- [ ] `/equipment/[id]/change-request` (jen Údržba; jinak výzva k přepnutí role). Stepper: **1 Zákres → 2 Fotky → 3 Poznámka → 4 Souhrn**; velká tlačítka Zpět/Další, ukazatel průběhu, stav v `useReducer`, koncept v `sessionStorage` (v try/catch).
- [ ] Krok 1 – `src/components/canvas/RedlineCanvas.tsx`: aktuální schéma (`<img>`) + `<canvas>` vrstva, Pointer Events (prst, stylus, myš; šířka podle tlaku), nástroje červené pero / zvýrazňovač / guma (maže celý tah), zpět/znovu, vymazat, režim Kreslit ↔ Posouvat (zoom/pan), výběr listu. Formát `markupData`: `{ "version": 1, "sheet": 1, "strokes": [{ "tool": "pen", "color": "#ef4444", "width": 0.004, "points": [[x, y, pressure], …] }] }` (souřadnice 0–1). Komponenta `MarkupOverlay` vykreslí tahy jako SVG nad libovolným obrázkem (použijí fáze 6, 9, 10). Volitelně export PNG (schéma + tahy) → upload `markup`.
- [ ] Krok 2 – `<input type="file" accept="image/*" capture="environment" multiple>`, zmenšení na klientu (max. 2000 px, JPEG 0,85), náhledy, popisek, odebrání, průběh nahrávání.
- [ ] Krok 3 – `VoiceNote`: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`, `lang = "cs-CZ"`, průběžný přepis), bez podpory simulace (animace nahrávání + vzorový přepis); vždy editovatelné textové pole; rychlé fráze („Vyměněn stykač“, „Přepojena svorka“, „Doplněn jistič“, „Změna kabeláže“, „Nový štítek“); priorita Normální / Vysoká / Kritická (bezpečnost).
- [ ] Krok 4 – souhrn, odeslání (`submitChangeRequest`), toast „Změna ZM-… odeslána do CAE“, přesměrování na detail. Validace: alespoň zákres, fotka nebo poznámka.
- [ ] Varianta „Doplnit k otevřené změně“: fotky + poznámka → `addComment`.

**Hotovo když:** v emulaci dotyku (DevTools) jde nakreslit kroužek, přidat fotku, vložit nebo nadiktovat text a odeslat · pin zoranžoví · nový ticket je vidět v CAE pohledu · `npm run verify` OK.
**Commit:** `feat(faze8): průvodce Zadat změnu s redliningem`

### Fáze 9 – CAE Back-Office
**Cíl:** pracoviště projektanta pro zpracování ticketů.

- [ ] `/cae` (jen CAE): KPI dlaždice (Nové, V práci, Čeká na schválení, Uzavřeno za 30 dní, průměrná doba vyřízení), tabulka ticketů napříč závody (filtry stav / priorita / závod / „přiřazeno mně“, řazení podle stáří, barevné SLA podle stáří), klik → detail.
- [ ] `/cae/tickets/[id]`: vlevo schéma revize, nad kterou technik kreslil, s přepínatelnou vrstvou zákresu, fotky (lightbox se zoomem), přepis, metadata (zařízení, lokace, nahlásil, kdy, priorita); vpravo timeline událostí s komentáři.
- [ ] Akce: **Převzít**, **Nahrát novou revizi** (soubor SVG/PDF/PNG/JPG, minor/major s náhledem čísla verze, povinné technické shrnutí, BOM zkopírovaný z aktivní revize jako editovatelná tabulka – přidat / upravit / odebrat řádek), **Stornovat**, **Komentář**.
- [ ] Pro demo tlačítko **„Vygenerovat upravené schéma“** – vytvoří SVG přes `renderSchematicSvg` s vyznačenou změnou, aby šla smyčka předvést bez vlastního souboru.

**Hotovo když:** CAE vidí oba seedové tickety i nový z fáze 8, převezme ho, nahraje revizi → zařízení modré · `npm run verify` OK.
**Commit:** `feat(faze9): CAE back-office`

### Fáze 10 – Schválení údržbou a archiv
**Cíl:** uzavření smyčky – porovnání a schválení nebo vrácení revize.

- [ ] `/equipment/[id]/approve` (Údržba, stav `WAITING_APPROVAL`).
- [ ] Porovnání revizí: **Vedle sebe** (synchronizovaný zoom/pan), **Posuvník** (swipe přes obě verze), **Prolínání** (průhlednost); původní zákres technika nad starou verzí; shrnutí CAE; diff BOM (přidáno / odebráno / změněno barevně).
- [ ] **„Potvrdit a propsat do systému“** (potvrzovací dialog) → `approveRevision`; **„Vrátit k přepracování“** (dialog s povinným komentářem) → `rejectRevision`.
- [ ] Po schválení toast, zelený pin, nová revize aktivní, předchozí v Historii jako archiv; po vrácení oranžová a komentář v CAE timeline.

**Hotovo když:** celá smyčka jde proklikat přepínačem rolí: Údržba zadá → CAE nahraje → Údržba vrátí → CAE nahraje znovu → Údržba schválí → pin zelený, v historii ARCHIVED, REJECTED s důvodem a nová ACTIVE · `npm run verify` a `npm run smoke` OK.
**Commit:** `feat(faze10): schválení revize a archiv`

### Fáze 11 – PWA, responzivita, dokončení UX
**Cíl:** aplikace připravená na tablety v hale a velké monitory.

- [ ] `src/app/manifest.ts` (název, `display: standalone`, theme color, start URL), ikony generované přes `src/app/icon.tsx` / `apple-icon.tsx` (ImageResponse). Service worker / offline mimo MVP.
- [ ] Responzivita: 390 px (mobil), 820 a 1024 px (tablet), 1440 px a víc (monitor); žádný horizontální scroll; přilepené akce na mobilu.
- [ ] `loading.tsx` se skeletony, prázdné a chybové stavy, optimistické UI u akcí, toasty u všech mutací.
- [ ] Přístupnost: kontrast AA, viditelný focus, `aria-label` u ikonových tlačítek, klávesové ovládání map.
- [ ] Kontrola češtiny: žádné anglické texty v UI, správné skloňování („1 změna, 2 změny, 5 změn“).
- [ ] Print CSS pro QR štítek zařízení.

**Hotovo když:** aplikace je instalovatelná (Chrome „Instalovat“) · na 390 px se nic nerozpadá · `npm run verify` OK.
**Commit:** `feat(faze11): PWA a dokončení UX`

### Fáze 12 – E2E testy, README a předání
**Cíl:** ověřené a zdokumentované MVP.

- [ ] `npm i -D @playwright/test` a `npx playwright install chromium`; `playwright.config.ts` (webServer `npm run dev`, globalSetup `npm run db:reset`); skript `test:e2e: playwright test`.
- [ ] `e2e/navigation.spec.ts` (areál → budova → patro → detail), `e2e/workflow.spec.ts` (celá smyčka přes přepínač rolí včetně kreslení na canvas myší, uploadu fotky z fixture, vrácení a schválení).
- [ ] Screenshoty klíčových obrazovek do `docs/screenshots/` (Playwright).
- [ ] `README.md` česky: popis, požadavky, instalace, skripty, demo scénář (sekce E), architektura, známá omezení, přechod na PostgreSQL.

**Hotovo když:** na čisté DB projde `npm run verify` i `npm run test:e2e`.
**Commit:** `test(faze12): E2E testy, README a screenshoty`

---

## E. Demo scénář (cíl MVP, cca 5 minut)

1. Pohled **Údržba** → mapa Závodu Jablonec: Hala A 🟠, Energetika 🔵.
2. Hala A → izometrie → 1. NP → oranžově pulzující **R-CNC-04** → detail: bezpečnostní banner s fotkami, přepisem a zákresem z předchozí směny.
3. Energetika → 1. PP → **RM1** (🔵) → porovnání v1.2 a v1.3 → **Potvrdit a propsat** → zelená, v1.2 v archivu.
4. Hala B → **R-ML-01** → **Zadat změnu**: zákres prstem, fotka, nadiktovaná poznámka → odeslat → oranžová.
5. Přepnout na **CAE Projektant** → dashboard → nový ticket → Převzít → Vygenerovat upravené schéma → Nahrát revizi → modrá.
6. Zpět na **Údržbu** → R-ML-01 → porovnání → Vrátit s komentářem → CAE nahraje znovu → Údržba schválí → zelená a kompletní historie.

## F. Mimo rozsah MVP (backlog)

Autentizace a více klientů (multi-tenant) · skutečný serverový přepis hlasu · redlining nad PDF (pdf.js) · offline režim se synchronizací · notifikace (e-mail, Teams) · import projektů z CAE nástrojů (EPLAN, PC|SCHEMATIC Automation) · PostgreSQL a nasazení · elektronický podpis schválení · role a práva na úrovni závodu.

---

## G. Deník (vyplňuje Claude Code po každé fázi)

| Fáze | Datum | Poznámky a odchylky od plánu |
|---|---|---|
| – | 2026-10-25 | Plán vytvořen. Schéma Prisma 7 validováno, kostra složek připravena. |
| 0 | 2026-10-28 | Next 16.4.3, Prisma 7.10.1, shadcn 4.23.0 (base `radix`, preset `nova`, base color neutral). Odchylky: (1) scaffold už negeneruje `postcss.config.mjs` – Tailwind 4 jde přes loader `@tailwindcss/turbopack` v `next.config.ts`. (2) `@types/node` povýšen z `^20` na `^22` (peer dependency `vitest@5`). (3) npm 11 blokuje install skripty – schváleny v `package.json` → `allowScripts` (připnuté verze): better-sqlite3, prisma, @prisma/engines, esbuild, unrs-resolver; po upgradu těchto balíčků znovu `npm install-scripts approve <balíček>`. (4) shadcn 4 používá místo `clsx`+`tailwind-merge` balíček `cn` (z repozitáře shadcn-ui) a přidal `shadcn`, `radix-ui`, `tw-animate-css`, `next-themes`. (5) `typecheck` = `next typegen && tsc --noEmit` (globální typy `LayoutProps`/`PageProps` jinak na čistém checkoutu chybí). (6) Layout: font proměnná `--font-sans` (jak čeká shadcn `globals.css`), subset `latin-ext` kvůli češtině, `lang="cs"`, třída `dark`. (7) Lokální git identita repozitáře nastavena (chyběla). `"type": "module"` ověřen: dev, build i Prisma klient přes `tsx` běží. Na fázi 2: obalit app `TooltipProvider`; `ui/sonner.tsx` volá `useTheme` z next-themes – buď `ThemeProvider`, nebo pevně `theme="dark"`; `next/font/google` stahuje Geist při buildu (build potřebuje internet, za běhu se servíruje lokálně) – případně přejít na balíček `geist`. |
| 1 | 2026-10-28 | Migrace `init`, generátory v `src/lib/mock-graphics/` (`schematic`, `floorplan`, `photo`, + `parts` = sdílený katalog dílů pro schéma i BOM a `svg` = pomocné funkce), `prisma/seed-data.ts` + `prisma/seed.ts`. Seed: 2 závody, 6 budov, 9 pater, 23 zařízení, 31 revizí, 465 položek BOM, 2 otevřené + 5 uzavřených CR, 29 událostí; idempotentní, invarianty ze sekce B ověřeny skriptem. Odchylky: (1) **`npm run db:reset` jsem nespustil** – Prisma `migrate reset` odmítá běh z Claude Code bez výslovného souhlasu uživatele; ověřeno `prisma migrate dev` + `prisma db seed` (reset spusťte ručně: `npm run db:reset`). (2) `cabinet.ts` odloženo do fáze 6 (volitelné). (3) Revize RM1 v1.2 je datovaná 2025-03 (plán říká 2024, ale vzniká z ZM-2025-0033). (4) Deterministická ID pro uživatele, závody, budovy, patra a zařízení (`eq-rm1`, `eq-r-cnc-04`, …) kvůli stabilním QR URL a E2E; revize a CR mají cuid. (5) `mapPolygon`, `labelX/Y` a `pinX/Y` jsou v procentech (jak říká schéma); půdorysy mají viewBox 1200×800, areál 1000×700. (6) Schémata a půdorysy mají jednotný vzor (silový + řídicí obvod, K1–K4, T1, A1…) pro všechny typy zařízení; list je vždy 1/1. (7) Seedové zákresy jsou kroužek kolem prvku `data-designation` (helper `schematicElementCenter`); i uzavřené CR mají zákres. Známé nedostatky: revizní obláček u jističů F2–F5 překrývá jejich popisek; `storage/uploads/{markups,voice}/seed` jsou prázdné. |
| 2 | 2026-10-28 | Téma (jediné, tmavé: zinc-950/900/800, žlutý akcent, blueprint rastr přes utility `bg-blueprint`, `touch-target` = min. 44 px), `src/lib/{status,format,roles}.ts`, `src/server/{session.ts,queries/plant.ts,actions/session.ts}`, komponenty `common/*` (StatusBadge, StatusDot, PageHeader, LocationBreadcrumb, EmptyState, KpiTile) a `layout/*` (AppHeader, Logo, RoleSwitcher, PlantSwitcher), `loading/error/not-found`. Přidán `format.test.ts` (4 testy). Ověřeno `npm run verify` a v headless Edge (přepnutí role, reload, návrat do posledního závodu, 1920/1024/390 px bez horizontálního scrollu, bez chyb v konzoli). Odchylky: (1) Dočasné stránky `/plant/[plantId]` (KPI souhrn; nahradí fáze 3) a `/cae` (prázdný stav; nahradí fáze 9), aby měl přepínač kam přesměrovat. (2) `/` pro roli CAE přesměruje na `/cae` (plán: vždy na závod); Údržba jde do posledního závodu (cookie `digitry-plant`, zapisuje ji `setRole` z aktuální cesty), jinak do prvního. (3) Přepínač závodu je jen v pohledu Údržba (CAE vidí všechny závody). (4) `ui/sonner.tsx` upraven na pevné `theme="dark"` (bez `next-themes`/`ThemeProvider`). (5) `error.tsx` používá prop `retry` (Next 16.4), ne `reset`. (6) Kořenový `loading.tsx` způsobí, že redirecty a `notFound()` se na stránkách streamují: HTTP status je 200 (přesměrování i 404 řeší body/meta), v prohlížeči to funguje normálně. (7) Role = `radio` (Radix ToggleGroup single) – pro testy `getByRole("radio")`. (8) Stará dev server instance držela zastaralou CSS cache; po `rm -rf .next` OK. Známé nedostatky: font Geist se stále stahuje přes `next/font/google` při buildu; ikonky/PWA až fáze 11. |
| 3 | 2026-10-28 | `getPlantOverview` (budovy, patra, počty zařízení 🟠/🔵 odvozené ze stavu zařízení, nejhorší stav, cílový odkaz), `src/lib/routes.ts` (jediné místo pro URL map a detailu), `src/lib/map-geometry.ts` (+ testy), `components/map/campus/` (`CampusMap` – SVG + HTML štítky v procentech, `CampusSite` + `site-layouts.ts` – kulisy pro JBC a LBC, `BuildingList`, `CampusExplorer` se sdíleným hover/focus), `common/StatusLegend`, `StatusBadge` umí `count`. Ověřeno v headless Edge: Hala A → výběr patra, Hala B → rovnou půdorys, Tab + Enter na budově, badge Hala A 🟠 1 a Energetika 🔵 1, 1920/1024/390 px bez horizontálního scrollu, bez chyb v konzoli; `npm run verify` OK (8 testů). Odchylky: (1) Dočasné stránky `/plant/[p]/building/[b]` (seznam pater; nahradí fáze 4) a `/…/floor/[f]` (prázdný stav; nahradí fáze 5), aby navigace z mapy nekončila 404; dotazy v `src/server/queries/building.ts`. (2) Kulisy areálu (komunikace, parkoviště, zeleň, vrátnice) nejsou v DB – jsou v kódu podle kódu závodu, pro neznámý závod jen plot, růžice a měřítko. (3) Štítky budov jsou HTML nad SVG (kontejner má přesný poměr stran viewBoxu), ne SVG text. (4) Mapa je omezená na výšku okna (`maxWidth` podle `100dvh`). (5) `getPlantSummary` nahrazen `getPlantOverview`. Známé nedostatky: na mobilu (390 px) štítky zakrývají menší budovy (seznam pod mapou slouží jako náhrada); hover stroke (žlutá) je u 🟠 budovy málo odlišný od stavové oranžové – rozlišení nese hlavně výplň. |
| 4 | 2026-10-28 | `src/lib/isometric.ts` (`isoProject`, `isoRect`, `isoSlab` + testy), `getBuildingOverview` (patra s dispozicí a piny), `extractFloorplanRooms` v `mock-graphics/floorplan.ts`, `components/map/isometric/` (`IsometricBuilding`, `FloorList`, `BuildingExplorer`), `layout/PageTransition` (motion, `MotionConfig reducedMotion="user"`) na stránkách areálu, budovy a patra. Ověřeno v headless Edge: Hala A 2 patra, Energetika 1. PP pod terénem + 1. NP, Administrativa 2 patra; hover vysune desku a ukáže tooltip; Tab + Enter na desce otevře půdorys; přechod (scale + fade) běží, s `prefers-reduced-motion` bez transformace; 1440/1024/390 px bez horizontálního scrollu, bez chyb v konzoli; `npm run verify` OK (11 testů). Odchylky: (1) **Sdílené `layoutId` u názvu budovy není** – v App Routeru se stará stránka při navigaci odmontuje, takže motion nemá z čeho animovat; přechod je „přiblížení“ (scale 0.96 → 1 + fade) při mountu každé úrovně. (2) Deska patra je obdélník 3:2 (poměr půdorysu), ne obrys budovy z mapy areálu – jinak by piny a dispozice neseděly (Energetika má v areálu tvar L). (3) Dispozice v izometrii se čte zpětně z uloženého `floorplanSvg` (regex na obdélníky místností). (4) Tooltip je pevně v levém horním rohu plátna (u kurzoru přetékal okraj na úzkých displejích). Známé nedostatky: deska vyššího patra částečně zakrývá zadní část desky pod ní (vysunutí při hoveru to řeší); na 390 px jsou popisky pater v izometrii drobné – hlavní ovládání je seznam pater. |
