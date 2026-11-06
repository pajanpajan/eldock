# ELDOCK – sjednocený archiv dokumentace

> Generováno skriptem `npm run docs:bundle` ze souborů v `docs/archiv` a z `docs/PLAN.md` – needitujte ručně, upravte jednotlivé soubory a skript spusťte znovu. Aktuální pravidla projektu jsou v `CLAUDE.md`.

## Obsah

1. SPECIFIKACE-MVP.md
2. PLAN-faze-00-35.md
3. ZADANI-faze-37-38.md
4. ZADANI-faze-39.md
5. ZADANI-faze-40.md
6. ZADANI-faze-41.md
7. ZADANI-faze-42.md
8. ZADANI-faze-43.md
9. ZADANI-faze-44.md
10. ZADANI-faze-45.md
11. ZADANI-faze-46.md
12. ZADANI-faze-47.md
13. ZADANI-faze-48.md
14. ZADANI-faze-49.md
15. ZADANI-faze-50.md
16. ZADANI-faze-51.md
17. ZADANI-faze-52.md
18. ZADANI-faze-53.md
19. ZADANI-faze-54.md
20. ZADANI-faze-55.md
21. ZADANI-faze-56.md
22. ZADANI-faze-57.md
23. ZADANI-faze-58.md
24. docs/PLAN.md (aktuální plán a deník posledních fází)

---

# 📄 SPECIFIKACE-MVP.md

> **Archiv (2026-11-01):** původní anglická specifikace MVP (dříve sekce 1–4 v `CLAUDE.md`). Aktuální stav projektu je v `CLAUDE.md`.

\# Project Specification: Industrial Electrical Documentation \& Maintenance Twin Platform (MVP)



\## 1. Project Overview \& Core Value Proposition

We are building a B2B web \& mobile-ready (PWA) platform for manufacturing plants to manage electrical documentation (schematics, layouts, BOMs) and streamline the "As-Built" change request workflow between on-site Maintenance Technicians and our external Back-Office CAE Engineers.



\## 2. Tech Stack Requirements

\- \*\*Framework:\*\* Next.js (App Router, TypeScript)

\- \*\*Styling \& UI:\*\* Tailwind CSS, shadcn/ui components, Lucide React icons, Framer Motion (for smooth transitions between map levels)

\- \*\*Database \& ORM:\*\* SQLite with Prisma ORM (for zero-config local development and easy migration to PostgreSQL later)

\- \*\*Interactive Maps \& Canvas:\*\* 

&#x20; - `react-zoom-pan-pinch` for interactive floorplan zooming/panning

&#x20; - HTML5 Canvas / SVG overlays for 1) Building 45° isometric floor selection, 2) Equipment pin placement, and 3) Redlining (drawing annotations directly over schematic images/PDF previews).



\## 3. Core User Flows \& Architecture



\### A. 3-Tier Visual Navigation (The Map Engine)

1\. \*\*Level 1: Plant Campus View (Půdorys areálu)\*\*

&#x20;  - Displays an interactive SVG/image map of the entire factory complex.

&#x20;  - Highlights clickable buildings (e.g., "Hala A - Lisovna", "Hala B - Montáž", "Energetika") with badge indicators showing total equipment count and active change requests.

2\. \*\*Level 2: 45° Isometric Building View (Výběr patra)\*\*

&#x20;  - When a multi-story building is clicked, transition smoothly into a 45° isometric visual representation of the building.

&#x20;  - Users can hover and click individual floors (e.g., "1. PP - Rozvodny", "1. NP - Hlavní výroba", "2. NP - Vzduchotechnika").

3\. \*\*Level 3: Interactive Floorplan (Půdorys patra a zařízení)\*\*

&#x20;  - Zoomable, pannable 2D floorplan of the selected floor.

&#x20;  - Displays interactive pins for electrical assets (Switchboards/Rozváděče, CNC machines, Production lines).

&#x20;  - \*\*Pin Color Coding:\*\*

&#x20;    - 🟢 Green (`ACTIVE`): Documentation is 100% up-to-date.

&#x20;    - 🟠 Orange (`PENDING\_UPDATE`): A change was reported from the floor; CAE engineer is working on it (Warning state for other shifts!).

&#x20;    - 🔵 Blue (`WAITING\_APPROVAL`): CAE engineer uploaded the new revision; waiting for the maintenance technician to confirm it.



\### B. Equipment Detail \& Documentation Hub

Clicking an equipment pin (or scanning its direct QR code URL `/equipment/\[id]`) opens the Asset Drawer/Page:

\- \*\*Header:\*\* Asset Name, ID, Location breadcrumb, QR Code modal button, Status Badge.

\- \*\*Safety Banner:\*\* If status is `PENDING\_UPDATE`, display a prominent orange alert showing the raw photo, voice note transcript, and markup submitted by the previous shift so technicians aren't working blind before the official CAE drawing is finished.

\- \*\*Active Documentation:\*\* Viewer for the current valid electrical schematic (PDF/SVG preview), BOM list, and 3D cabinet preview.

\- \*\*Revision Archive (Historie změn):\*\* Timeline of all past versions (v1.0, v1.1, v2.0) with date, author, approver, and downloadable files.

\- \*\*Primary CTA Button:\*\* "Zadat změnu" (Submit Change Request).



\### C. "Zero-Typing" Change Request Wizard (Zadat změnu)

Designed for maintenance technicians with dirty hands on mobile devices:

1\. \*\*Step 1 (Visual Markup / Redlining):\*\* Loads the current schematic sheet on an interactive canvas. The technician can draw with a finger/stylus (red pen) to circle the modified area.

2\. \*\*Step 2 (Photo Evidence):\*\* Upload/take photos of the physical switchboard wiring or new component label.

3\. \*\*Step 3 (Voice / Quick Note):\*\* Simulated voice-to-text recorder (or quick text input) describing the change (e.g., "Vyměněn stykač K4 za jiný typ, přepojena svorka A2").

4\. Submitting changes the asset status to `PENDING\_UPDATE` and creates a ticket in the CAE Back-Office.



\### D. CAE Engineer Back-Office \& Approval Loop

Create a dedicated Role Switcher in the top navbar (`\[Pohled: Údržba v hale]` vs `\[Pohled: CAE Projektant]`) to demonstrate the full loop:

1\. \*\*CAE Engineer View:\*\*

&#x20;  - Dashboard of all `PENDING\_UPDATE` tickets across client plants.

&#x20;  - Engineer inspects the technician's redline markup, photos, and notes.

&#x20;  - Engineer uploads a "New Revision" (v1.2) + adds technical summary -> status changes to `WAITING\_APPROVAL`.

2\. \*\*Maintenance Confirmation (Back in Plant View):\*\*

&#x20;  - The technician sees the asset in Blue (`WAITING\_APPROVAL`), compares the old vs. new revision, and clicks \*\*"Potvrdit a propsat do systému"\*\* (Approve \& Publish) or \*\*"Vrátit k přepracování"\*\* (Reject with comment).

&#x20;  - Once approved, the new revision becomes the official active document, the previous one moves to the Archive, and the pin turns Green (`ACTIVE`).



\## 4. Implementation Steps for Claude

1\. Initialize the Next.js TypeScript project with Tailwind CSS and Prisma (SQLite).

2\. Create the Prisma schema (`Plant`, `Building`, `Floor`, `Equipment`, `DocumentRevision`, `ChangeRequest`) and a rich `seed.ts` script containing realistic Czech industrial data (e.g., "Závod Jablonec", "Hala A - Lisovna", rozváděče "RM1 - Hlavní rozváděč", "R-CNC-04", realistic revision history, and 2 active change requests).

3\. Build clean, industrial-grade SVG mock graphics for the Campus View, the 45° Isometric Building View (interactive stacked floor polygons), and the 2D Floorplan so the app works visually out-of-the-box without needing external image assets.

4\. Implement the full state-machine workflow (Submit Change with Canvas drawing -> CAE Back-Office Processing -> Maintenance Approval -> Archive).

5\. Ensure the UI is fully localized in Czech (česky) with a sleek, dark/high-contrast industrial UI aesthetic suitable for tablets and desktop monitors.



Start by setting up the project structure, database schema, and seeding the realistic demo data, then build the interactive views step-by-step.

---

# 📄 PLAN-faze-00-35.md

> **Archiv (2026-11-01):** úplný plán fází 0–35 včetně zadání, deníku, stavového automatu (sekce B) a specifikace demo dat (sekce C). Aktuální plán je v `docs/PLAN.md`, závazná pravidla v `CLAUDE.md`.

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
| 5 | Level 3 – Půdorys patra a piny | ✅ |
| 6 | Detail zařízení (Documentation Hub) | ✅ |
| 7 | Workflow jádro – stavový automat, služby, uploady, testy | ✅ |
| 8 | Průvodce „Zadat změnu“ | ✅ |
| 9 | CAE Back-Office | ✅ |
| 10 | Schválení údržbou a archiv | ✅ |
| 11 | PWA, responzivita, dokončení UX | ✅ |
| 12 | E2E testy, README a předání | ✅ |
| 13 | Pasport rozváděče (ČSN EN 61439) a Lhůtník revizí (ČSN 33 1500) | ✅ |
| 14 | Kompletní revizní agenda (spotřebiče, nářadí, stroje), vrstvy mapy a režim rychlé revize | ✅ |
| 15 | Chytrý plánovač revizí (měsíční přehled, hlasový dispečer, optimalizace pochůzky) | ✅ |
| 16 | Dočasná provizoria, revizní závady, LOTO strom napájení a auditní report | ✅ |
| 17 | Víceúrovňové účty (RBAC & výřezy dat) a 4krokové Studio budov, rastru a napájení | ✅ |
| 18 | Intuitivní vizuální Studio (3 kroky, drag & drop v areálu, kreslení zón tažením, správa areálů) | ✅ |
| 19 | Nový závod od nuly ve Studiu, vícelistová CAE dokumentace (PCSCHEMATIC), diagnostika pro údržbu a přihlašovací brána | ✅ |
| 20 | Rebranding na ELDOCK a produkční Docker balíček (Hetzner Cloud / On-Premise) | ✅ |
| 21 | Vlna 1: kreslení do fotek červenky, PDF revizní protokoly, hlídač lhůt s e-mailovým avízem, hromadný import CSV | ✅ |
| 22 | Vlna 2: vizuální porovnávač revizí (Visual Diff) a proklikávací CAE reference ve schématu | ✅ |
| 23 | Konsolidace: licenční moduly (Core + add-ony), administrace modulů a audit UX napříč rolemi | ✅ |
| 24 | Optimalizace výkonu: SQLite PRAGMA a indexy, lazy loading těžkých komponent, paralelní dotazy, cache souborů, Docker build | ✅ |
| 25 | Správa modulů a tarifů: podfunkce, režim Čisté pracoviště / Obchodní demo, presety tarifů a matice dopadu na role | ✅ |
| 26 | Produktové video v Remotionu (45 s, 5 scén) a líně načítaný přehrávač na úvodní stránce | ✅ |
| 27 | AI Panel Builder I: atomická databáze prvků, schéma projektů rozváděčů, katalog a těžba PDF datasheetů | ✅ |
| 28 | AI Panel Builder II: servisní vrstva Gemini s demo režimem, analýza fotky rozváděče a Smart Fallback Picker | ✅ |
| 29 | AI Panel Builder III: hierarchický strom zapojení, hromadné přiřazení, undo/redo a elektrotechnický hlídač | ✅ |
| 30 | AI Panel Builder IV: výpočet oteplení (ČSN EN 61439, IEC TR 60890) a fázová bilance | ✅ |
| 31 | AI Panel Builder V: generátor dokumentace rozváděče (1P schéma, osazení, kusovník, oteplení, CE štítek, prohlášení o shodě) | ✅ |
| 32 | AI Panel Builder: rozváděče s mixem výrobců (auto-detekce značky po modulech, filtr výrobce v pickeru, skuteční výrobci v kusovníku) | ✅ |
| 33 | AI Panel Builder: živý konfigurátor prvku, sloučení/rozdělení modulů, parametry podle kategorie a katalog 220+ přístrojů | ✅ |
| 34 | AI Panel Builder: Vision Analyzer 2.0 (analýza po DIN lištách, šroubky vs. páčky, kompaktní přístroje, správa lišt a modulů) | ✅ |
| 35 | Studio: revize UX (rozměr areálu X × Y, funkční měřítko, živé kóty, tažení stěn, 7 typů zón, kontrastní vrata, banery a barvy zařízení, jemný rastr 1 m, spotřebiče a nářadí do místností) | ✅ |

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

- [x] `src/server/queries/floor.ts` – patro, budova, zařízení s otevřeným CR.
- [x] `src/components/map/floorplan/FloorplanViewer.tsx` (client) s `react-zoom-pan-pinch`: inline `floorplanSvg` + vrstva pinů ve stejném souřadném systému; piny drží konstantní velikost na obrazovce (protiškálování podle zoomu).
- [x] Pin: stavová barva, ikona podle typu, tag pod pinem, pulzování u `PENDING_UPDATE`, tooltip; klik → `Sheet` s rychlým náhledem (název, stav, aktivní revize, otevřená změna) a tlačítkem „Otevřít detail“.
- [x] Ovládání: zoom +/−, reset, filtr stavu a typu, vyhledání tagu s přiblížením na pin; legenda; tabulka zařízení patra.
- [x] Pinch-zoom na dotyku.

**Hotovo když:** R-CNC-04 na 1. NP Haly A svítí oranžově a pulzuje, RM1 v 1. PP Energetiky modře · filtr a hledání fungují · zoom 400 % je ostrý · `npm run verify` OK.
**Commit:** `feat(faze5): půdorys patra a piny zařízení`

### Fáze 6 – Detail zařízení (Documentation Hub)
**Cíl:** kompletní stránka zařízení dostupná i přes QR kód.

- [x] `src/server/queries/equipment.ts` – zařízení, lokace, revize (s autorem, schvalovatelem, BOM), otevřený CR (přílohy, události).
- [x] `/equipment/[id]` (server, `notFound()`): hlavička – název, tag, ID, breadcrumb lokace (odkazy), `StatusBadge`, tlačítko QR (Dialog s `qrcode.react`, absolutní URL z `headers()`, tisk štítku přes print CSS).
- [x] **Bezpečnostní banner** při `PENDING_UPDATE`: výrazný oranžový, „Pozor – nahlášená změna (směna, kdo, kdy). Oficiální výkres zatím neodpovídá skutečnosti.“ + fotky (lightbox), přepis hlasové poznámky, náhled zákresu (aktuální schéma + vrstva tahů). Při `WAITING_APPROVAL` modrá varianta s CTA „Zkontrolovat novou revizi“.
- [x] Záložky: **Schéma** (`SchematicViewer`: SVG/obrázek přes `<img>` v zoom-pan, PDF přes `<iframe>`, listy, stažení, výběr revize `?rev=`) · **Kusovník** (`BomTable`: řazení, hledání, export CSV) · **3D rozváděč** (`Cabinet3D`: CSS 3D skříň, otáčení tažením a tlačítky, otevírání dveří, DIN lišty s moduly podle BOM – bez externích knihoven) · **Historie změn** (`RevisionTimeline`: revize sestupně, verze, datum, autor, schvalovatel, shrnutí, stav včetně důvodu zamítnutí, odkaz na CR, stažení, „Zobrazit“).
- [x] CTA „Zadat změnu“ (role Údržba; při otevřeném CR „Doplnit k otevřené změně ZM-…“); na mobilu přilepené dole.

**Hotovo když:** R-CNC-04 ukazuje banner s fotkami, přepisem a zákresem · RM1 modrou výzvu · R-ML-01 má v historii zamítnutou v1.1 s důvodem · QR vede na správnou URL · `npm run verify` OK.
**Commit:** `feat(faze6): detail zařízení a dokumentace`

### Fáze 7 – Workflow jádro: stavový automat, služby, uploady, testy
**Cíl:** spolehlivá a otestovaná logika celé smyčky dříve, než na ni napojíme UI.

- [x] `src/lib/workflow/state-machine.ts`: typy akcí, tabulka přechodů ze sekce B, `canPerform(action, role, crStatus)`, `deriveEquipmentStatus()`, `nextVersion(revisions, bump)`, `formatTicketNumber(year, seq)`, `WorkflowError`.
- [x] `src/lib/workflow/state-machine.test.ts` (Vitest): všechny povolené i zakázané přechody a role, verzování včetně zamítnutých revizí, odvození stavu zařízení, formát čísla ticketu.
- [x] `src/server/services/workflow.ts`: `submitChangeRequest`, `addComment`, `cancelChangeRequest`, `assignChangeRequest`, `uploadRevision` (včetně kopie/úpravy BOM), `approveRevision`, `rejectRevision` – parametry `(prisma, actor, input)`, transakce, události, kontrola invariantů.
- [x] `src/server/actions/workflow.ts`: tenké Server Actions (role z cookie, `zod`, služba, `revalidatePath` dotčených stránek), návratový typ `{ ok: true, data } | { ok: false, error }`.
- [x] `src/app/api/uploads/route.ts` (POST multipart, `kind` = photo | revision | markup | voice; povolené typy a limity: fotky jpg/png/webp ≤ 15 MB, revize pdf/svg/png/jpg ≤ 25 MB) → `storage/uploads/<kind>/<cuid>.<ext>` → `{ url }`.
- [x] *(hotovo ve fázi 6)* `src/app/api/files/[...path]/route.ts` (GET, ochrana proti `..`, content-type, `Cache-Control`, u SVG hlavička `Content-Security-Policy: sandbox`).
- [x] `scripts/smoke-workflow.ts`: zkopíruje `dev.db` do `smoke.db`, nad kopií projde celou smyčku přes služby (submit → assign → upload → reject → upload → approve), ověří invarianty, vypíše ✔ kroky a kopii smaže. Dev DB zůstane beze změny.

**Hotovo když:** `npm run test` zelené (≥ 20 testů) · `npm run smoke` projde · `npm run verify` OK.
**Commit:** `feat(faze7): stavový automat, služby workflow, uploady a testy`

### Fáze 8 – Průvodce „Zadat změnu“
**Cíl:** zadání změny bez psaní, ovladatelné prstem v rukavici na tabletu i mobilu.

- [x] `/equipment/[id]/change-request` (jen Údržba; jinak výzva k přepnutí role). Stepper: **1 Zákres → 2 Fotky → 3 Poznámka → 4 Souhrn**; velká tlačítka Zpět/Další, ukazatel průběhu, stav v `useReducer`, koncept v `sessionStorage` (v try/catch).
- [x] Krok 1 – `src/components/canvas/RedlineCanvas.tsx`: aktuální schéma (`<img>`) + `<canvas>` vrstva, Pointer Events (prst, stylus, myš; šířka podle tlaku), nástroje červené pero / zvýrazňovač / guma (maže celý tah), zpět/znovu, vymazat, režim Kreslit ↔ Posouvat (zoom/pan), výběr listu. Formát `markupData`: `{ "version": 1, "sheet": 1, "strokes": [{ "tool": "pen", "color": "#ef4444", "width": 0.004, "points": [[x, y, pressure], …] }] }` (souřadnice 0–1). Komponenta `MarkupOverlay` vykreslí tahy jako SVG nad libovolným obrázkem (použijí fáze 6, 9, 10). Volitelně export PNG (schéma + tahy) → upload `markup`.
- [x] Krok 2 – `<input type="file" accept="image/*" capture="environment" multiple>`, zmenšení na klientu (max. 2000 px, JPEG 0,85), náhledy, popisek, odebrání, průběh nahrávání.
- [x] Krok 3 – `VoiceNote`: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`, `lang = "cs-CZ"`, průběžný přepis), bez podpory simulace (animace nahrávání + vzorový přepis); vždy editovatelné textové pole; rychlé fráze („Vyměněn stykač“, „Přepojena svorka“, „Doplněn jistič“, „Změna kabeláže“, „Nový štítek“); priorita Normální / Vysoká / Kritická (bezpečnost).
- [x] Krok 4 – souhrn, odeslání (`submitChangeRequest`), toast „Změna ZM-… odeslána do CAE“, přesměrování na detail. Validace: alespoň zákres, fotka nebo poznámka.
- [x] Varianta „Doplnit k otevřené změně“: fotky + poznámka → `addComment`.

**Hotovo když:** v emulaci dotyku (DevTools) jde nakreslit kroužek, přidat fotku, vložit nebo nadiktovat text a odeslat · pin zoranžoví · nový ticket je vidět v CAE pohledu · `npm run verify` OK.
**Commit:** `feat(faze8): průvodce Zadat změnu s redliningem`

### Fáze 9 – CAE Back-Office
**Cíl:** pracoviště projektanta pro zpracování ticketů.

- [x] `/cae` (jen CAE): KPI dlaždice (Nové, V práci, Čeká na schválení, Uzavřeno za 30 dní, průměrná doba vyřízení), tabulka ticketů napříč závody (filtry stav / priorita / závod / „přiřazeno mně“, řazení podle stáří, barevné SLA podle stáří), klik → detail.
- [x] `/cae/tickets/[id]`: vlevo schéma revize, nad kterou technik kreslil, s přepínatelnou vrstvou zákresu, fotky (lightbox se zoomem), přepis, metadata (zařízení, lokace, nahlásil, kdy, priorita); vpravo timeline událostí s komentáři.
- [x] Akce: **Převzít**, **Nahrát novou revizi** (soubor SVG/PDF/PNG/JPG, minor/major s náhledem čísla verze, povinné technické shrnutí, BOM zkopírovaný z aktivní revize jako editovatelná tabulka – přidat / upravit / odebrat řádek), **Stornovat**, **Komentář**.
- [x] Pro demo tlačítko **„Vygenerovat upravené schéma“** – vytvoří SVG přes `renderSchematicSvg` s vyznačenou změnou, aby šla smyčka předvést bez vlastního souboru.

**Hotovo když:** CAE vidí oba seedové tickety i nový z fáze 8, převezme ho, nahraje revizi → zařízení modré · `npm run verify` OK.
**Commit:** `feat(faze9): CAE back-office`

### Fáze 10 – Schválení údržbou a archiv
**Cíl:** uzavření smyčky – porovnání a schválení nebo vrácení revize.

- [x] `/equipment/[id]/approve` (Údržba, stav `WAITING_APPROVAL`).
- [x] Porovnání revizí: **Vedle sebe** (synchronizovaný zoom/pan), **Posuvník** (swipe přes obě verze), **Prolínání** (průhlednost); původní zákres technika nad starou verzí; shrnutí CAE; diff BOM (přidáno / odebráno / změněno barevně).
- [x] **„Potvrdit a propsat do systému“** (potvrzovací dialog) → `approveRevision`; **„Vrátit k přepracování“** (dialog s povinným komentářem) → `rejectRevision`.
- [x] Po schválení toast, zelený pin, nová revize aktivní, předchozí v Historii jako archiv; po vrácení oranžová a komentář v CAE timeline.

**Hotovo když:** celá smyčka jde proklikat přepínačem rolí: Údržba zadá → CAE nahraje → Údržba vrátí → CAE nahraje znovu → Údržba schválí → pin zelený, v historii ARCHIVED, REJECTED s důvodem a nová ACTIVE · `npm run verify` a `npm run smoke` OK.
**Commit:** `feat(faze10): schválení revize a archiv`

### Fáze 11 – PWA, responzivita, dokončení UX
**Cíl:** aplikace připravená na tablety v hale a velké monitory.

- [x] `src/app/manifest.ts` (název, `display: standalone`, theme color, start URL), ikony generované přes `src/app/icon.tsx` / `apple-icon.tsx` (ImageResponse). Service worker / offline mimo MVP.
- [x] Responzivita: 390 px (mobil), 820 a 1024 px (tablet), 1440 px a víc (monitor); žádný horizontální scroll; přilepené akce na mobilu.
- [x] `loading.tsx` se skeletony, prázdné a chybové stavy, optimistické UI u akcí, toasty u všech mutací.
- [x] Přístupnost: kontrast AA, viditelný focus, `aria-label` u ikonových tlačítek, klávesové ovládání map.
- [x] Kontrola češtiny: žádné anglické texty v UI, správné skloňování („1 změna, 2 změny, 5 změn“).
- [x] Print CSS pro QR štítek zařízení.

**Hotovo když:** aplikace je instalovatelná (Chrome „Instalovat“) · na 390 px se nic nerozpadá · `npm run verify` OK.
**Commit:** `feat(faze11): PWA a dokončení UX`

### Fáze 12 – E2E testy, README a předání
**Cíl:** ověřené a zdokumentované MVP.

- [x] `npm i -D @playwright/test` a `npx playwright install chromium`; `playwright.config.ts` (webServer `npm run dev`, globalSetup `npm run db:reset`); skript `test:e2e: playwright test`.
- [x] `e2e/navigation.spec.ts` (areál → budova → patro → detail), `e2e/workflow.spec.ts` (celá smyčka přes přepínač rolí včetně kreslení na canvas myší, uploadu fotky z fixture, vrácení a schválení).
- [x] Screenshoty klíčových obrazovek do `docs/screenshots/` (Playwright).
- [x] `README.md` česky: popis, požadavky, instalace, skripty, demo scénář (sekce E), architektura, známá omezení, přechod na PostgreSQL.

**Hotovo když:** na čisté DB projde `npm run verify` i `npm run test:e2e`.
**Commit:** `test(faze12): E2E testy, README a screenshoty`

### Fáze 13 – Pasport rozváděče (ČSN EN 61439) a Lhůtník revizí (ČSN 33 1500)
**Cíl:** výrobní dokumentace rozváděče dle ČSN EN 61439 a hlídání termínů elektrorevizí dle ČSN 33 1500 v detailu zařízení, na mapě a v přehledech.

- [x] Prisma (migrace `compliance_inspections`, bez rozbití stávajících vazeb): `Equipment` + `fedFromEquipmentId` (relace `fedFrom` / `feeds` – hierarchie napájení), `fedFromCircuit` („Pole 3 / Jistič QF4“), `inspectionIntervalMonths Int @default(36)`, `externalInfluences`.
- [x] Model `ComplianceDocument` (výrobní dokumentace dle ČSN EN 61439): `category` = `SINGLE_LINE_DIAGRAM` (Liniové schéma) / `CONFORMITY_DECLARATION` (EU prohlášení o shodě) / `ROUTINE_VERIFICATION` (Kusová zkouška) / `THERMAL_CALCULATION` (Výpočet oteplení čl. 10.10.4) / `EXTERNAL_INFLUENCES` (Protokol o určení vnějších vlivů); `title`, `documentNumber`, `fileUrl`, `issuedAt`, `issuer`, `notes`.
- [x] Model `InspectionRecord` (revizní zprávy a lhůtník): `type` = `INITIAL` / `PERIODIC` / `EXTRAORDINARY` / `THERMOVISION`; `inspectionDate`, `validUntil`, `reportNumber`, `inspectorName`, `inspectorLicense` (ev. č. osvědčení TIČR dle NV 190/2022 Sb.), `result` = `CAPABLE` / `CAPABLE_WITH_DEFECTS` / `INCAPABLE`, `defectsSummary`, `reportUrl`.
- [x] `src/lib/inspection.ts` (čisté funkce + testy): `addMonths`, `computeValidUntil`, stav elektrorevize (platná / končí do 30 dnů / propadlá / bez záznamu – termovize se do lhůty nepočítá), odpočet dnů.
- [x] Seed: **RM1** – kompletní pasport dle ČSN EN 61439-2 (prohlášení o shodě, kusová zkouška, výpočet oteplení pro 630 A, liniové schéma rozvodny) + platná pravidelná revize i termovize (ještě 14 měsíců); **R-CNC-04** – napájeno z RM1 (Pole 2 / QF2), pravidelná revize končí za 18 dní, kompletní dokumentace + určení vnějších vlivů; **R-ML-01** – napájeno z RM1 (Pole 4 / QF5), revize propadla před 14 dny se závadou „Chybí krytí živých částí IP2X u stykače K2 a chybí štítek jističe F3“. Ostatní rozváděče platnou revizi. Dokumenty a revizní zprávy = SVG generované kódem (`storage/uploads/documents/seed/`).
- [x] Detail zařízení: `InspectionStatusBadge` v hlavičce (🟢 Revize platná do DD.MM.RRRR / 🟡 Revize končí za X dní / 🔴 REVIZE PROPADLÁ před X dny) a odkaz „Napájeno z: RM1 (Pole 2 / QF2)“.
- [x] Záložka **Pasport & Shoda (61439)**: karty dokumentů s náhledem a stažením, tabulka rozhraní rozváděče, napájené vývody.
- [x] Záložka **Revize & Lhůtník**: semafor platnosti, odpočet dnů, historie revizních zpráv a termovizí (technik, osvědčení, závady), dialog „Zapsat novou revizi“ (služba `recordInspection` + Server Action, nahrání zprávy PDF/SVG, bez souboru se zpráva vygeneruje).
- [x] Widget „Hlídač elektrorevizí (Lhůtník)“ na stránce areálu a v CAE přehledu (propadlé 🔴, končící do 30 dnů 🟡, proklik na zařízení); výstražný indikátor na pinu s propadlou revizí.

**Hotovo když:** po `npm run db:reset` má RM1 kompletní pasport a zelenou revizi, R-CNC-04 žluté „Blíží se konec platnosti revize!“, R-ML-01 červenou propadlou revizi se závadou a výstrahu na pinu · Hlídač je na areálu i v CAE · zápis nové revize přepne semafor · `npm run verify` OK.
**Commit:** `feat(faze13): pasport rozváděče a lhůtník revizí`

### Fáze 14 – Kompletní revizní agenda (Spotřebiče, Nářadí, Stroje), Vrstvy mapy a Režim rychlé revize
**Cíl:** lhůtník pokrývá celý závod od rozváděče po rychlovarnou konvici, mapa se nezahltí a revizní technik zapisuje revize hromadně nebo jedním klikem v terénu.

- [x] Prisma (migrace `appliance_inspections`): `EquipmentType` + `MACHINE` (pevný stroj), `POWER_TOOL`, `APPLIANCE`, `EXTENSION_CORD`, `WELDER`, `LIGHTNING_ROD`, `EMERGENCY_LIGHTING`; `Equipment` + `usageGroup` (skupina A–E dle ČSN 33 1600 ed. 2), `protectionClass` (I / II / III), `inventoryNumber`, `assignedZone`; `InspectionRecord` + měření `protectiveConductorResistance` (R_PE, Ω), `insulationResistance` (R_iso, MΩ), `measuringInstrument`.
- [x] `src/lib/inspection-rules.ts` (+ testy): doporučená lhůta a norma podle typu – rozváděče/VTZ ČSN 33 1500 12–60 měsíců dle vnějších vlivů, stroje NV 378/2001 Sb. 12, ruční nářadí ČSN 33 1600 ed. 2 (sk. C) 12, nepřipevněné spotřebiče (sk. C/E) 24, prodlužovací přívody (sk. C) 12, svářečky ČSN EN 60974-4 12, hromosvody ČSN EN 62305-3, nouzové osvětlení ČSN EN 50172; meze měření R_PE / R_iso; „lehká karta“ bez schématu a 3D. Posudek „Neschopno provozu“ = stav 🔴 vyřazeno z provozu.
- [x] Seed: spotřebiče a nářadí – kuchyňka (Rychlovarná konvice Eta, sk. E, tř. I, revize propadlá před 5 dny 🔴; Mikrovlnná trouba Bosch 🟢), dílna údržby v Hale A (Úhlová bruska Hilti AG 125, sk. C, tř. II, končí za 9 dní 🟡; Aku/síťová vrtačka Hilti 🟢; Prodlužovací buben 25 m 400 V propadlý se závadou „poškozená izolace kabelu“ 🔴; Invertorová svářečka Fronius TransPocket 🟢), hromosvod LPS a okruh nouzového osvětlení; lhůty všech zařízení z `inspection-rules`.
- [x] Půdorys: panel „Vrstvy zobrazení (Zaškrtávací filtry)“ s počty (rozváděče a energetika ✔, výrobní stroje a linky ✔, ruční nářadí a svářečky, spotřebiče a prodlužováky, hromosvody a bezpečnost) pro mapu i tabulku + přepínač „⚠️ Zobrazit vše s propadlou / končící revizí“.
- [x] Hromadná revize: checkboxy v tabulce patra a v přehledu revizí `/inspections`, plovoucí lišta „Zapsat hromadnou revizi (X vybráno)“, jeden záznam technika → platnost každému podle jeho lhůty, vše v jedné transakci, společný protokol.
- [x] `/inspections/rapid` (+ odkaz v navigaci): technik, osvědčení a přístroj nahoře (pamatuje si zařízení), hledání / simulace QR skeneru, fronta v místnosti, měření R_PE a R_iso s předvyplněním a obří tlačítka „VYHOVUJE – Uložit a další (1-klik)“ / „NEVYHOVUJE – Vyřadit z provozu“.
- [x] Lehká karta `/equipment/[id]` pro spotřebiče, nářadí a bezpečnostní zařízení: bez schématu, kusovníku, 3D a historie změn, výchozí záložka „Revize & Měření (ČSN 33 1600)“.
- [x] Testy: unit (pravidla lhůt, meze měření, vrstvy, služby) a E2E (vrstvy na půdorysu, rychlá revize).

**Hotovo když:** po čistém seedu je konvice 🔴, bruska 🟡, buben 🔴 se závadou · vrstvy na půdorysu skrývají/ukazují spotřebiče a přepínač ⚠️ ukáže jen 🔴/🟡 · hromadná revize zezelená vybrané položky · rychlá revize uloží kus jedním klikem a přejde na další · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze14): revizní agenda spotřebičů, vrstvy mapy a rychlá revize`

### Fáze 15 – Chytrý plánovač revizí (Měsíční přehled, Hlasový dispečer v češtině a Optimalizace pochůzky)
**Cíl:** revizní technik nadiktuje nebo napíše česky, co chce revidovat, a dostane seřazenou pochůzku s tipy, co přibrat při jedné cestě.

- [x] `src/lib/inspection-voice-parser.ts` (+ testy): deterministický offline parser české věty → `InspectionPlanQuery` – období (propadlé, tento / příští měsíc, názvy měsíců v 1. i 6. pádě, „do X dnů“, „do konce roku“, „tento kvartál“; měsíce včetně propadlých, pokud není řečeno jinak), kategorie podle kořenů slov bez diakritiky + souhrnné „přenosné spotřebiče a nářadí“ / „pevná zařízení / VTZ“, lokace (budovy, patra 1. NP / 2. NP / 1. PP / přízemí / suterén, zóny kuchyňka / dílna / svařovna / kancelář), `recognizedChips` odebíratelné křížkem.
- [x] `src/lib/inspection-planner.ts` (+ testy): měsíční horizont 🔴 po termínu · 🟠 tento měsíc · 🟡 příští měsíc · 🟢 další 3–6 měsíců; tip „Přiberte při jedné cestě“ (stejná budova / patro / zóna a měřicí skupina, konec revize do 45 dnů po okně); řazení pochůzky budova → patro → zóna → měřicí skupina → tag.
- [x] `/inspections/planner` (+ navigace): hlasový dispečer (`SpeechRecognition` / `webkitSpeechRecognition`, `cs-CZ`, animace nahrávání, fallback bez mikrofonu), ukázkové povely na 1 klik, odznaky filtrů + přepínače měsíců a budov, souhrn pevná vs. přenosná zařízení, tip s „Přidat do plánu“, „🚀 Spustit rychlou revizi této dávky“ → `/inspections/rapid?ids=…` (fronta přesně v pořadí pochůzky), „🖨️ Vytisknout pochůzkový list“ (`@media print`).
- [x] Seed: vždy existují revize propadlé, končící tento kalendářní měsíc a končící příští měsíc ve stejné místnosti (data relativní k okamžiku seedu).
- [x] Testy: unit (parser, plánovač) a E2E `e2e/planner.spec.ts`.

**Hotovo když:** ukázkové povely vrátí smysluplné dávky s odznaky · tip „Přiberte při jedné cestě“ se objeví pro kuchyňku tento měsíc · rychlá revize z plánovače má frontu v pořadí pochůzky · pochůzkový list jde vytisknout · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze15): chytrý plánovač revizí a hlasový dispečer`

### Fáze 16 – Dočasná provizoria (Temporary Modifications), Správa revizních závad, LOTO strom napájení a Auditní report
**Cíl:** provizorní zapojení v rozváděči je vidět a hlídané bez přepisu oficiální dokumentace, revizní závady se dotahují do konce, údržba ví, kde bezpečně vypnout, a závod má auditní knihu revizí.

- [x] Prisma (migrace `temporary_mods_defects`): `TemporaryModification` (`number` `PROV-RRRR-NNNN`, `title`, `description`, autor a role, `expiresAt` +7 / +14 dní, `photoUrl`, `markupJson`, stav `ACTIVE` / `RESTORED_1_TO_1` / `CONVERTED_TO_CR`, vyřešení, `spawnedChangeRequestId`); `InspectionDefect` (k revizní zprávě a zařízení, `severity` `MINOR` / `MAJOR` / `CRITICAL`, `deadline`, `OPEN` / `RESOLVED`, popis a fotka opravy); `InspectionRecord` + `maxTempC`, `deltaTempC`.
- [x] Služby + Server Actions: `createTemporaryMod` (nemění revize ani CAE), `resolveAsOneToOne`, `resolveAndConvertToChangeRequest` (v jedné transakci uzavře provizorium a založí požadavek na změnu – zadání změny a komentář vytaženy do transakčních funkcí workflow); `resolveDefect`; nové revize s výhradou zakládají závady s lhůtou podle závažnosti.
- [x] UI provizorií: `TemporaryModBanner` (odpočet / „PROVIZORIUM PO TERMÍNU!“, autor, popis, fotka, „Oficiální technická dokumentace vX.X zůstává v platnosti…“, „Ukončit a řádně nahradit provizorium“ se dvěma cestami), akce „⏱️ Zapsat dočasné provizorium (7–14 dní)“ v hlavičce, archiv provizorií v historii.
- [x] Závady na záložce „Revize & Lhůtník“: seznam u revizí s odpočtem lhůty a „✅ Potvrdit odstranění závady“ (popis opravy + volitelná fotka).
- [x] LOTO v záložce „Pasport & Shoda (61439)“: „⚡ LOTO – Bezpečné odpojení a hierarchie napájení“ – kde vypnout (řetězec nadřazených rozváděčů s proklikem) a dopad vypnutí (všechny podřízené rozváděče a stroje).
- [x] Termovize: max. teplota a ΔT s barevnou indikací (zápis, historie, zpráva).
- [x] `/inspections/audit-report`: % shody závodu, revize podle kategorií, otevřené závady, aktivní provizoria, kniha revizí, „🖨️ Tisk oficiální Knihy revizí závodu (PDF)“ (`@media print`) a CSV export.
- [x] Seed: 1 aktivní provizorium (končí za 6 dní), 1 vrácené 1:1 (+ 1 převedené na historický požadavek), otevřené i vyřešené závady u R-ML-01 a R-CNC-04, ΔT u termovizí.
- [x] Testy: unit (obě větve ukončení provizoria nad reálnou SQLite z migrací, závady, strom napájení, ΔT) a E2E.

**Hotovo když:** detail rozváděče s aktivním provizoriem ukazuje banner a obě cesty ukončení fungují · závadu lze potvrdit jako odstraněnou · LOTO ukazuje kde vypnout a dopad · auditní report jde vytisknout a exportovat · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze16): provizoria, revizní závady, LOTO a auditní report`

### Fáze 17 – Víceúrovňový systém účtů (RBAC & Scoped Views) a 4krokový Generátor budov, rastru a hierarchie napájení
**Cíl:** každý účet vidí jen svůj výřez dat a smí jen své akce; technický ředitel a vedoucí údržby naklikají novou budovu, patra, místnosti a zařízení s napájením přímo v CAD rastru.

- [x] Prisma (migrace `accounts_studio`): enum `AccountType` (`PLANT_ADMIN`, `MAINTENANCE_LEAD`, `MAINTENANCE_TECH`, `INSPECTOR_VTZ`, `INSPECTOR_APPLIANCES`, `CAE_ENGINEER`) na `User` (+ `title`, `scopeLayers` – vlastní výřez kategorií). Workflow role (`MAINTENANCE` / `CAE_ENGINEER`) se z typu účtu odvozuje – stavový automat zůstává.
- [x] `src/lib/accounts.ts` (+ testy): definice 6 účtů (osoba, popis výřezu, barva, oprávnění, domovská stránka), viditelné typy zařízení (VTZ inspektor nikdy nevidí spotřebiče a nářadí), skrytí lhůtníku pro CAE.
- [x] Session a UI: cookie účtu, dropdown `AccountSwitcher` v hlavičce (jméno, role, odznak oprávnění, výřez dat), výřez aplikovaný na areál, budovu, půdorys, detail, přehled revizí, hlídač, plánovač, rychlou revizi a audit; navigace a akce podle oprávnění (schválení revize jen vedoucí údržby / ředitel).
- [x] `/admin/users` (jen `PLANT_ADMIN`): přehled podúčtů, oprávnění a kategorií, přidání podúčtu.
- [x] `src/lib/cad-grid.ts` (+ testy): osy 1…N / A…Z, rozměr haly v metrech, souřadnice rastru (`A1`–`C11`) → půdorys, vrata na obvodu; `renderFloorplanSvg` s měřítkem a ryskou podle rozteče.
- [x] `src/lib/power-hierarchy.ts` (+ testy): pravidla napájení (trafo / hlavní rozváděč kořen, podružný rozváděč → rozváděč, stroje a linky → rozváděč, drobné vybavení → rozváděč + místnost), návrh pole / vývodu / zásuvkového okruhu.
- [x] `/studio` (ředitel, vedoucí údržby): 4 kroky – rastr a měřítko s živým náhledem · budova a podzemní / nadzemní patra s izometrií · místnosti, zóny a vrata v rastru · osazení zařízení klikem do rastru s hierarchií napájení; uložení v jedné transakci (budova, patra s vygenerovaným `floorplanSvg`, zařízení).
- [x] „⚡ Zobrazit pavouka napájení (Hierarchie)“ na půdorysu i v kroku 4: směrové spojnice rozváděč → napájená zařízení s popiskem vývodu, napájení z jiného patra jako odbočka.
- [x] Seed: 6 účtů; kompletní strom napájení patra Hala B 1. NP i Hala A 1. NP včetně spotřebičů a nářadí.
- [x] Testy: unit (výřezy účtů, rastr, hierarchie napájení, uložení studia nad SQLite) a E2E (`/studio`, výřez revizního technika VTZ, pavouk napájení).

**Hotovo když:** revizní technik VTZ nevidí na mapě ani v přehledech žádný spotřebič · CAE nevidí lhůtník · `/studio` vytvoří budovu s patrem, místnostmi a napájenými zařízeními a půdorys je ihned vidět · pavouk napájení vykreslí topologii Haly B · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze17): víceúrovňové účty a studio výstavby závodu`

### Fáze 18 – Intuitivní vizuální Studio (3 kroky, Drag & Drop na mapě areálu, kreslení zón tažením myši a správa Areálů)
**Cíl:** Studio bez ručního psaní souřadnic – budova se umístí tažením v areálu, místnosti se nakreslí myší a zařízení se osadí jedním klikem s automatickým předvyplněním.

- [x] Nový areál: položka „+ Přidat nový areál / závod“ v `PlantSwitcher` (oprávnění `studio`), dialog (název, kód, město / adresa), `createPlantAction` → přepnutí do nového areálu; tlačítko „+ Přidat budovu do areálu“ na mapě areálu → `/studio?plant=…`.
- [x] Krok 1 – budova, umístění a podlaží: šablony budov na 1 klik (výrobní hala, energetika, administrativa, sklad), velká mapa areálu s přesunem tažením a úchytem pro změnu velikosti (ohlídání hranic areálu, upozornění na překryv), u existující budovy jen její skutečná patra + přidání dalšího, blok rastru s rozměrem v metrech a izometrií.
- [x] Krok 2 – místnosti tažením myši v rastru (živý obdélník), souřadnice = **buňky rastru** (`B2`–`B5` = pás 1 modulu, i jediná buňka je platná – oprava `zoneToRoom`), šablony rozdělení patra, vrata jedním klikem u obvodové zdi.
- [x] Krok 3 – jedna lišta pater bez duplicit, „autopilot“: po kliknutí do rastru další volný tag a název podle typu, nejvhodnější nadřazený rozváděč (stejné patro, jinak hlavní rozváděč), další volný vývod a převzetí místnosti, ve které bod leží.
- [x] Testy: unit (buňky rastru vč. `B2`–`B5`, šablony patra, autopilot, nový areál) a E2E `e2e/accounts-studio.spec.ts` pro 3kroké Studio a nový areál.

**Hotovo když:** nový areál jde založit z hlavičky a hned se do něj přepne · budova se v areálu umístí a zvětší tažením · `B2`–`B5` vytvoří místnost bez chyby · klik do rastru v kroku 3 předvyplní tag, název, napájení, vývod i místnost · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze18): intuitivní vizuální studio a správa areálů`

### Fáze 19 – Tvorba závodu od nuly ve Studiu, Vícelistová CAE dokumentace (styl PCSCHEMATIC dle ISO/IEC 81346), Pokročilá diagnostika pro údržbu a Přihlašovací brána (/login)
**Cíl:** nový závod jde postavit od čisté mapy, rozváděče mají autentickou vícelistovou dokumentaci, údržba najde spoj / PLC adresu / rezervu fáze během vteřin a aplikace je chráněná heslem pro nasazení na vlastní doménu.

- [x] Studio: přepínač „Přidat budovu do stávajícího závodu“ / „🆕 Vytvořit úplně nový závod od nuly“ (název, kód, město / adresa, rozměr areálu v m, čistá mapa s oplocením a vrátnicí); uložení v jedné transakci založí závod, budovu, patra i zařízení a přepne do něj; zahození konceptu budovy; tlačítko „+ Nový závod od nuly“ na mapě areálu.
- [x] `src/lib/panel-model.ts` (+ testy): deterministický model rozváděče (přístroje dle ISO/IEC 81346, vývody a fáze, seznam spojů FROM → TO, PLC I/O, ztrátový výkon, zatížení fází a tepelná rezerva).
- [x] `src/lib/mock-graphics/pcschematic.ts` (+ testy): 6 listů A3 s rámem 1–8 / A–F a razítkem PCSCHEMATIC Automation – titulní list a obsah, liniové schéma, silové schéma, ovládání a PLC I/O, dispozice 1:5, oteplení / zatížení fází / CE štítek; křížové odkazy `/4.6`.
- [x] `SchematicViewer`: kniha dokumentace s obsahem (6 listů + původní výkres revize CAE), klikací křížové odkazy, odkaz na list a sloupec z URL.
- [x] Záložka „🔍 Diagnostika & Spoje (Údržba)“ u rozváděčů, linek a strojů: propípávač svorek / vodičů / kabelů, hledač PLC adres a signálů, kalkulačka zatížení fází a tepelné rezervy s doporučením.
- [x] Přihlašovací brána: `/login` (účet + přístupové heslo z `DIGITRY_ACCESS_PASSWORD`), `src/proxy.ts` s podepsanou httpOnly cookie `digitry-auth` (stránky → `/login`, API → 401), „Odhlásit (Zamknout)“ v hlavičce, E2E přes testovací cookie + samostatný test přihlášení.

**Hotovo když:** nový závod vznikne ze Studia a aplikace se do něj přepne · rozváděč má 6listovou knihu s funkčními křížovými odkazy · propípávač najde `X1:U` i vodič 18 · bez přihlášení se aplikace nenačte · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze19): nový závod ve studiu, PCSCHEMATIC dokumentace, diagnostika a přihlášení`

### Fáze 20 – Rebranding na ELDOCK a Produkční Docker balíček pro Hetzner Cloud / On-Premise
**Cíl:** aplikace nese oficiální značku Eldock (domény `eldock.cz`, `eldock.eu`, `eldock.sk`) a jde nasadit jedním `docker compose up -d` – stejně na Hetzner VPS s Let's Encrypt i na air-gapped serveru v továrně.

- [x] Značka Eldock: `src/lib/brand.ts` (název, podtitul „Průmyslový dok dokumentace a revizí“, domény), nové logo – průmyslový dok + elektro rastr (EL + DOCK) v černo-žluté; hlavička, `/login`, ikony PWA (`brand-icon.tsx`).
- [x] Metadata, manifest PWA (`Eldock`), tiskové sestavy (auditní report, pochůzkový list, štítek s QR kódem), razítka výkresů (PCSCHEMATIC, schéma revize, generované dokumenty) a e-maily / firmy v seedu (`…@eldock.cz`, „Eldock CAE“).
- [x] Zpětná kompatibilita: cookies a klíče v prohlížeči beze změny (`digitry-*`), proměnné prostředí `ELDOCK_*` s fallbackem na `DIGITRY_*`.
- [x] `next.config.ts` → `output: "standalone"`; vícefázový `Dockerfile` (Node 22 LTS, neprivilegovaný uživatel) + `docker-entrypoint.sh` (`prisma migrate deploy`, seed demo dat do prázdné databáze).
- [x] `docker-compose.yml` (`eldock-app` + `caddy`, svazky `./data/db` a `./data/storage`) a `Caddyfile` (Let's Encrypt pro `eldock.cz`, `www.eldock.cz`, `app.eldock.cz`, HSTS, `X-Frame-Options: DENY`, `nosniff`).
- [x] `README.md`: „Nasazení na Hetzner Cloud a nastavení DNS u Czechia.com (eldock.cz)“ + on-premise varianta.

**Hotovo když:** v UI ani v tiskových sestavách nezůstalo „Digitry“ · `npm run build` vytvoří `.next/standalone` a server z něj odpovídá · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze20): rebranding na Eldock a produkční Docker balíček`

### Fáze 21 – Vlna 1: pokročilé průmyslové funkce
**Cíl:** údržbář zakreslí změnu přímo do fotky, revizní technik vytiskne protokol do PDF, vedení dostává avízo o končících lhůtách a spotřebiče jdou do systému hromadně z Excelu.

- [x] **Kreslení do fotky u červenky** (`/equipment/[id]/change-request`, krok Fotky): plátno HTML5 Canvas nad fotkou (myš, dotyk, pero – Pointer Events), nástroje tužka, šipka, obdélník, elipsa (zakroužkování), text, barvy červená `#ef4444` / žlutá `#eab308`, Zpět a Vymazat vše. Uložení spojí fotku se zákresem (`canvas.toBlob`), nahraje přes `/api/uploads` a uloží jako přílohu požadavku → CAE ji vidí v `/cae/tickets/[id]`.
- [x] **Generátor revizních protokolů do PDF**: tlačítko „Generovat revizní zprávu (PDF)“ u záznamu revize v kartě zařízení a v `/inspections`; tisková šablona A4 ve dvou variantách – VTZ (NV 190/2022 Sb., ČSN 33 1500 / ČSN 33 2000-6) a spotřebiče / nářadí (ČSN 33 1600 ed. 2): hlavička podniku a závodu, evidenční číslo a umístění, datum a druh revize, revizní technik a ev. č. osvědčení, tabulka měření (R_PE, R_iso, unikající proud I_PE / I_Δ, funkční zkouška), celkový posudek, blok pro podpis a razítko. Měření doplněno o unikající proud a funkční zkoušku (schéma + formulář zápisu revize).
- [x] **Hlídač lhůt s e-mailovým avízem** (`/inspections/alerts`, záložka v plánovači): zařízení po termínu, do 14 a do 30 dnů; náhled souhrnného e-mailu pro vedoucího údržby a technického ředitele s prokliky do plánovače; tlačítko „Odeslat souhrnné avízo nyní“ a endpoint `/api/cron/inspection-alerts` pro cron (tajný token). Bez SMTP v `.env` se avízo uloží do logu notifikací v databázi a UI ukáže potvrzení s náhledem.
- [x] **Hromadný import spotřebičů z CSV / Excelu** (`/inspections/import`): vzorová šablona CSV ke stažení; průvodce ve 3 krocích – nahrání CSV nebo vložení ze schránky a parsování (Název, Evidenční číslo, Kategorie VTZ / Spotřebič / Nářadí, Interval, Poslední revize, Lokace), interaktivní tabulka s hromadným přiřazením do Závod → Budova → Patro (checkboxy, automatické spárování podle textu lokace), potvrzení a uložení včetně QR kódů.

**Hotovo když:** zákres z fotky je vidět v CAE ticketu · protokol VTZ i spotřebiče jde vytisknout do PDF · avízo se uloží do logu a ukáže náhled · import CSV založí zařízení s QR kódy na zvolených patrech · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze21): kreslení do fotek, PDF protokoly, hlídač lhůt a import CSV`

### Fáze 22 – Vlna 2: CAE dokumentace, vizuální porovnání revizí a interaktivní reference
**Cíl:** vedoucí údržby rychle uvidí, co se ve výkresu změnilo, a ze schématu se prokliká na související zařízení.

- [x] **Visual Diff** na schvalování (`/equipment/[id]/approve`), v CAE ticketu a v detailu zařízení: režimy Vedle sebe (synchronizovaně, stará verze s červenou a nová se zelenou hlavičkou), Překryvný posuvník (opona) a Barevný diff (odebrané prvky červeně, přidané zeleně – Canvas / blend-mode). Funguje i pro PDF demo pohonu vrat (`pohon-vrat-v2.pdf` → `pohon-vrat-motor.pdf`).
- [x] **Proklikávací CAE reference ve schématu**: referenční značení komponent (`-Q1`, `-M1`, `-K1`, `-F2`, `-X1`) s pozicí ve výkresu a vazbou na kartu zařízení (`linkedEquipmentId`); klikací štítky nad výkresem, boční „Rozpis prvků ve schématu“ a plovoucí karta s detailem, stavem revize, historií změn a tlačítkem „Přejít na kartu zařízení“.

**Hotovo když:** všechny tři režimy porovnání fungují na demo datech · klik na `-M1` ve výkresu otevře kartu prvku a odkaz na zařízení · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze22): visual diff revizí a interaktivní reference ve schématu`

### Fáze 23 – Konsolidace: licenční moduly, administrace modulů a audit UX
**Cíl:** aplikace jde prodávat jako Core + placené moduly a základní rozhraní zůstane jednoduché; workflow nemá slepé uličky.

- [x] **Moduly v databázi** (globální konfigurace tenantu): CORE vždy aktivní (hierarchie závodu, karty zařízení, fotky, prohlížeč PDF, QR štítky a tisk, základní červenka, správa uživatelů) + add-ony `INSPECTIONS_PRO` (plánovač, rychlá revize, auditní report, PDF revizní zprávy, hlídač lhůt), `CAE_ADVANCED` (kreslení do fotek, Visual Diff, interaktivní reference) a `ENTERPRISE_TOOLS` (import CSV/Excel, Studio). Výchozí stav: vše zapnuté.
- [x] **Administrace „Konfigurace modulů a tarifu“** (`/admin/modules`, Technický ředitel): karty balíčků s přepínačem Aktivní / Deaktivováno, popisem funkcí a štítkem tarifu (Core / Add-on).
- [x] **Dynamické UI:** navigace, stránky, tlačítka a pokročilé záložky detailu zařízení respektují moduly (skrytí, případně nenápadný odznak „Dostupné v modulu …“); vypnutý modul blokuje i přímé URL a API.
- [x] **Audit workflow a UX** (červenka → CAE → schválení → revize): oprava slepých uliček a duplicit, zjednodušený pohled pro směnového údržbáře (rychlý přístup ke schématu, QR štítku a nahlášení změny), report nálezů.

**Hotovo když:** vypnutí modulu skryje jeho funkce v UI a zablokuje přímý přístup · zapnutí je vrátí · nálezy auditu opravené a sepsané v Deníku · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze23): licenční moduly, administrace modulů a audit UX`

### Fáze 24 – Optimalizace výkonu a architektury
**Cíl:** stejný vzhled i funkce, ale rychlejší karta zařízení na mobilu v hale, menší JS a svižnější databáze i nasazení.

- [x] **SQLite a indexy:** PRAGMA `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`, `foreign_keys = ON` při inicializaci klienta; chybějící `@@index` na často filtrované sloupce a cizí klíče + migrace.
- [x] **Lazy loading (`next/dynamic`):** kreslení do fotek, Visual Diff, interaktivní výkres / pdf.js, import CSV a tiskové náhledy štítků se načítají až při použití, se skeletonem.
- [x] **Dotazy:** nezávislé `await` za sebou → `Promise.all`; přehledové stránky `select` / `_count` místo širokého `include`.
- [x] **Cache souborů:** `Cache-Control` pro `/api/files` (nahrané soubory jsou neměnné) a statické PDF; komprese anotací a fotek (JPEG 0,85).
- [x] **Docker:** vrstvy závislostí se cachují (npm ci jen při změně lockfile / schématu), rychlejší `docker-compose up -d --build`.

**Hotovo když:** vzhled a chování beze změny · změřené zmenšení JS na klíčových stránkách zapsané v Deníku · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `perf(faze24): optimalizace SQLite, lazy loading, dotazů, cache a Docker buildu`

### Fáze 25 – Správa modulů a licenčních tarifů (Feature Flags & Module Management Engine)
**Cíl:** obchodník jedním klikem přepne aplikaci mezi tarify a ukáže zákazníkovi, co který modul přináší; zapnutí a vypnutí funguje na všech vrstvách (DB → Server Actions → navigace → detail zařízení).

- [x] **Registr modulů a podfunkcí** (`src/lib/modules.ts`, jediný zdroj pravdy): CORE (vždy aktivní) + INSPECTIONS_PRO (`inspections.planner`, `inspections.pdf_reports`, `inspections.alerts`, `inspections.audit`), CAE_ADVANCED (`cae.ticketing`, `cae.canvas_annotation`, `cae.visual_diff`, `cae.hotspots`), ENTERPRISE_TOOLS (`enterprise.csv_import`, `enterprise.studio`, `enterprise.ai_panel_builder` jako připravovaný „Roadmap / AI Labs“). Stav modulů, podfunkcí a režimu v databázi, platí okamžitě pro všechny.
- [x] **Režim neaktivních modulů:** CLEAN (Čisté pracoviště – vypnuté funkce zmizí) a UPSELL (Obchodní demo – zůstanou se zámkem a odznakem „Modul Pro“, klik otevře okno s přínosem a tlačítkem „Přejít do správy modulů a aktivovat“).
- [x] **`/admin/modules`** pro technického ředitele i vedoucího údržby (položka v navigaci): presety tarifů START / PROFI ÚDRŽBA / KOMPLET ENTERPRISE, přepínač režimu, karty modulů s hlavním přepínačem a přepínači podfunkcí, „Matice dopadu na role“ živě pro všech 6 rolí.
- [x] **Propojení napříč aplikací:** navigace, rozcestník, detail zařízení, formulář červenky, schválení revize, `/inspections`, `/cae` a ochrana Server Actions / API podle podfunkcí.

**Hotovo když:** tarif START promění aplikaci v jednoduchý nástroj na schémata a QR štítky · vypnuté `cae.canvas_annotation` skryje kreslení do fotek, `cae.visual_diff` porovnávač na schválení · UPSELL ukáže zámek a okno s aktivací · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze25): správa modulů a tarifů s podfunkcemi, režimy a maticí rolí`

### Fáze 26 – Produktové video v Remotionu
**Cíl:** 45sekundové promo video Eldocku generované kódem ve stávajícím vizuálním stylu, přehrávané přímo na úvodní stránce.

- [x] **Remotion:** `remotion`, `@remotion/player`, `@remotion/cli`; `src/remotion/` s kompozicí `EldockPromo` (1920 × 1080, 30 fps, 1350 snímků); skripty `video:preview` a `video:render` (MP4 do `public/eldock-promo.mp4`).
- [x] **5 scén** (`spring()` / `interpolate()`): problém a příchod Eldocku · sken QR štítku RH1 a rozpad hierarchie do karty zařízení s 1P schématem · červenka se zákresem stykače K2 do fotky · Visual Diff s posuvníkem staré a nové revize · kalendář revizí, PDF protokol s razítkem a závěrečné CTA eldock.cz.
- [x] **Úvodní stránka:** `<Player>` v Hero sekci pod CTA v rámečku se zaoblením a jantarovým podsvícením; autoplay bez zvuku, loop, ovládání a celá obrazovka; líné načtení (dynamický import, bez SSR).

**Hotovo když:** `npm run video:preview` otevře studio s kompozicí · vybrané snímky jdou vyrenderovat · přehrávač na `/` se načte až po stránce · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze26): produktové video v Remotionu a přehrávač na úvodní stránce`

---

### Fáze 27–31 – ELDOCK AI Panel Builder (pasportizace a projekce rozváděče z fotky)
Společné: modul `enterprise.ai_panel_builder` (feature flag), routy pod `/panel-builder`, data v modelech `CatalogComponent`, `PanelBoardProject`, `PanelBoardItem`. Výpočty a návrhy (párování, strom, hlídač, oteplení, výkresy) jsou čisté funkce v `src/lib/panel-builder/` s unit testy; zápisy přes služby `src/server/services/panelBuilder*`. Bez `GEMINI_API_KEY` běží deterministický demo režim. Na produkci se po migraci spouští jen přírůstkový seed katalogu a PB-001 (`npm run db:seed:panel-builder`, upsert, nic nemaže).

### Fáze 27 – Atomická databáze prvků, schéma a těžba PDF datasheetů
**Cíl:** Katalog jednotlivých přístrojů (ne PDF v celku) a datový model projektů rozváděčů.

- [x] **Modul:** podfunkce `enterprise.ai_panel_builder` z „připravované“ na aktivní; položka „AI Panel Builder“ (`/panel-builder`) v hlavní navigaci.
- [x] **Schéma:** `CatalogComponent` (výrobce, řada, typ, objednací číslo, EAN, kategorie, póly, In, charakteristika, Icn, citlivost a typ RCD, šířka v modulech a rozměry, ztrátový výkon Pv, IEC značka, popis, zdroj dat + PDF a strana, `searchText` bez diakritiky; indexy `[category, poles, ratedCurrentA, trippingCurve]` a `[manufacturer, typeCode]`), `PanelBoardProject` (kód PB-xxx, volitelná vazba na `Equipment`, zákazník, výrobce rozváděče JSON, stav DRAFT → RECOGNIZED → TREE_BUILT → COMPLETED, skříň – typ instalace, materiál, model, norma, rozměry, IP, síť, Icw, teplota okolí, soudobost, ztráty vodičů, DIN lišty × moduly, fotka, dominantní výrobce), `PanelBoardItem` (lišta, pozice, šířka, bounding box v % fotky, stav rozpoznání VERIFIED/PARTIAL/UNRECOGNIZED, jistota, OCR text, IEC značení, popis obvodu, fáze, výpočtový proud, nadřazený prvek, pořadí).
- [x] **Seed:** ≥ 40 reálných prvků (ABB, Eaton, OEZ, Schneider) vč. přístrojů referenčního rozváděče (SD203/40, OVR T2-T3 3N 20-275 P QS, FH204 A-40/0,03, S203-B16, S201-B10, S201-B16, MISTRAL41W 36M 3R) a vzorový projekt „Domovní / Podružný rozváděč PB-001“ s 12 prvky (-Q1 … -F12) na 3 lištách, z toho 1 PARTIAL a 1 UNRECOGNIZED. Samostatný přírůstkový seed (upsert) pro produkci.
- [x] **Katalog `/panel-builder/catalog`:** filtry kategorie, výrobce, póly, proud, charakteristika + okamžité hledání přes `searchText`.
- [x] **„Atomizovat PDF datasheet (AI Import)“:** nahrání PDF (nebo výběr vzorového z `public/demo-docs`) → vytěžení jednotlivých přístrojů → samostatné záznamy v katalogu (bez klíče deterministická extrakce z textu PDF / ukázkových dat).

**Hotovo když:** migrace a seed projdou · katalog filtruje a hledá · import PDF přidá jednotlivé prvky · unit testy normalizace a extrakce · `npm run verify` OK.
**Commit:** `feat(faze27): katalog prvků, schéma projektů rozváděčů a těžba PDF datasheetů`

### Fáze 28 – Gemini servisní vrstva, analýza fotky a Smart Fallback Picker
**Cíl:** Z fotky rozváděče rozpoznané moduly na DIN lištách, nerozpoznané dohledané na 3 kliky.

- [x] **`src/server/services/geminiPanelService.ts`:** `GEMINI_API_KEY`; analýza fotky (`GEMINI_VISION_MODEL`, výchozí `gemini-2.5-pro`) → JSON (bounding box, OCR, kategorie, póly, proud, charakteristika, šířka, dominantní výrobce) + automatické párování s katalogem; datasheety a dohledávání (`GEMINI_DATASHEET_MODEL`, výchozí `gemini-2.5-flash`) → Pv a objednací číslo, trvale uloženo do katalogu. Bez klíče deterministický fallback, nikdy nespadne; v UI štítek „Demo AI režim (pro živé volání Gemini vložte GEMINI_API_KEY)“.
- [x] **Krok 1 `/panel-builder/[id]`:** vlevo fotka s rámečky (zelená VERIFIED, žlutá PARTIAL, červená „?“ UNRECOGNIZED) a pod ní DIN lišty s moduly v měřítku; vpravo „Bleskový identifikátor nerozpoznaných prvků“ – předvybraný dominantní výrobce a šířka, dlaždice Kategorie → Póly a charakteristika → Proud, okamžitě odpovídající kusy z katalogu (vč. W) k přiřazení jedním klikem, pole pro text z čela přístroje + „Dohledat v datasheetech přes Gemini AI“.
- [x] Seznam projektů `/panel-builder` (nový projekt z fotky, otevření PB-001).

**Hotovo když:** analýza fotky (demo režim) vytvoří prvky · picker přiřadí katalogový kus a prvek zezelená · unit testy párování a filtru pickeru · E2E přiřazení · `npm run verify` OK.
**Commit:** `feat(faze28): analýza fotky rozváděče přes Gemini a Smart Fallback Picker`

### Fáze 29 – Hierarchický strom zapojení a elektrotechnický hlídač
**Cíl:** Krok „2. Hierarchický strom a zapojení“ v detailu projektu.

- [x] **Split-screen:** vlevo DIN lišty se stavem zapojení (fajfka / žluté zvýraznění, filtr „Nepřiřazené“), vpravo strom Vstup napájení → -Q1 → -F1 SPD / -F2 RCD → koncové jističe.
- [x] **„AI Návrh stromu na 1 klik“:** z kategorií a pozic poskládá strom (odpínač a SPD na vstup, pod ně chrániče, pod chrániče jističe) a rozvrhne fáze L1/L2/L3 rovnoměrně.
- [x] **Hromadné přiřazení:** multi-select jističů → „Zapojit vybrané pod → [-F2]“.
- [x] **Inline úpravy + Undo/Redo:** na řádku „Napájeno z“, fáze (L1, L2, L3, L1,L2,L3) a editovatelný název obvodu; historie Zpět / Vpřed.
- [x] **Hlídač (guardrails):** 3P pod 1P uzlem, přetížení nadřazeného prvku součtem proudů, cykly ap. – zvýraznění uzlu s vysvětlením; „Automaticky přečíslovat IEC značení (-Q1, -F1, -F2…)“.

**Hotovo když:** návrh stromu, hromadné přiřazení, undo/redo a přečíslování fungují · unit testy návrhu, rozvržení fází a hlídače · `npm run verify` OK.
**Commit:** `feat(faze29): hierarchický strom zapojení s hlídačem a undo/redo`

### Fáze 30 – Výpočet oteplení (ČSN EN 61439, IEC TR 60890)
**Cíl:** Krok „3. Výpočet oteplení a bilance“ s deterministickým enginem `src/lib/thermalCalculation.ts`.

- [x] **Vstupy skříně:** V × Š × H, způsob instalace, materiál, IP, teplota okolí, soudobost SF, ztráty vnitřních vodičů.
- [x] **Výpočet:** pro každý přístroj In, Pn, výpočtový proud, zatížení L1/L2/L3/N, Pv a Pv × SF²; P_total = přístroje + vodiče; účinná chladicí plocha Ae podle zakrytých stěn, konstanta skříně k, ΔT₀,₅ a ΔT₁,₀, T_internal = T_okolí + ΔT; fázová bilance s nesymetrií.
- [x] **Výstup:** inženýrská tabulka (Přístroj, Typ, Popis, In, Pn, L1, L2, L3, N, Pv, Pv × SF², Imax × SF), graf teploty podle výšky skříně a verdikt („VYHOVUJE dle ČSN EN 61439 – … pod limitem 70 °C“).

**Hotovo když:** unit testy enginu na referenčním rozváděči · změna vstupů okamžitě přepočítá · `npm run verify` OK.
**Commit:** `feat(faze30): výpočet oteplení rozváděče a fázová bilance`

### Fáze 31 – Generátor dokumentace rozváděče do PDF
**Cíl:** Krok „4. Výstupní dokumentace a PDF export“ (`/panel-builder/[id]/documentation`) – tiskově čistý vícestránkový elaborát.

- [x] List 1 titulní strana a obsah · List 2 výkres osazení (SVG skříň, lišty, moduly, modré propojky) + výpis funkcí · List 3 jednopólové schéma ze stromu (přívod → -Q1 → -F1 → -F2 → přípojnice → -F3 … -F12, značky, fáze, svislé popisy) · List 4 kusovník podle objednacích čísel + seznam komponent podle značení · List 5 oteplení a technická data · List 6 ES prohlášení o shodě (LVD 2014/35/EU, EMC 2014/30/EU, ČSN EN 61439-1/-3, místo pro podpis) a výrobní štítek s CE a QR kódem na kartu zařízení.
- [x] „Vytisknout / Exportovat kompletní PDF elaborát“ a „Propustit dokumentaci do provozu (Přiřadit k zařízení v Eldocku)“ – vazba na `Equipment`, odkaz z karty `/equipment/[id]`, projekt COMPLETED.

**Hotovo když:** všech 6 listů se vykreslí a tiskne na A4 · propuštění propojí kartu zařízení · unit testy generátorů SVG · E2E průchod · `npm run verify` OK; poté push, nasazení, migrace a přírůstkový seed na produkci.
**Commit:** `feat(faze31): generátor dokumentace rozváděče, CE štítek a prohlášení o shodě`


### Fáze 32 – Panel Builder: mix výrobců v jednom rozváděči
**Cíl:** Rozváděč může kombinovat přístroje různých značek (např. OEZ odpínač, Saltek SPD, Eaton jističe) – AI, párování, picker i dokumentace s tím počítají.

- [x] **Nový projekt:** pole „Převažující výrobce (nápověda pro AI)“, výchozí „⚡ Různí výrobci / Auto-detekce AI“ (`MIX`), dále ABB, Eaton, OEZ, Schneider Electric, Hager, Noark, Schrack, Saltek, Finder; nápověda pod polem.
- [x] **Gemini:** u `MIX` (nebo prázdného) prompt neomezuje značku – výrobce se určuje u každého modulu zvlášť (logo, barva páček, formát typového kódu); párování s katalogem napříč všemi výrobci, u konkrétní značky jen upřednostnění. Normalizace názvů výrobců (Schneider Electric → Schneider, EATON → Eaton …).
- [x] **Smart Fallback Picker:** záložky výrobce [Všichni] [ABB] [EATON] [OEZ] [SCHNEIDER] [HAGER] [SALTEK] [FINDER] – filtrují nabídku jen pro vybraný modul.
- [x] **Kusovník a schéma:** u každého prvku skutečný výrobce z katalogu (kusovník, seznam komponent, 1P schéma, štítek); katalog doplněn o Hager, Saltek a Finder.

**Hotovo když:** nový projekt s výchozím „Různí výrobci“ · picker filtruje podle značky · dokumentace smíšeného rozváděče uvádí více výrobců · unit testy párování a promptu · `npm run verify` a `npm run test:e2e` OK; poté push a nasazení.
**Commit:** `feat(faze32): rozváděče s mixem výrobců v Panel Builderu`

### Fáze 33 – Panel Builder: živý konfigurátor prvku a velký katalog
**Cíl:** Krok 1 bez matoucího seznamu kusů: každý klik v konfigurátoru rovnou nastaví a uloží modul, parametry odpovídají kategorii, AI rozsekané vícepólové přístroje jde sloučit (a rozdělit) a katalog pokrývá český trh.

- [x] **Živá konfigurace:** místo seznamu „Odpovídající kusy z katalogu“ se po každém kliku (výrobce, kategorie, póly, parametr) modul uloží, přiřadí se nejbližší přesný kus z katalogu (jinak se vytvoří odhad IEC) a modul zezelená; dole karta „Přiřazený přístroj“ s úpravou typu, popisu obvodu a dohledáním přes Gemini.
- [x] **Výrazný výběr:** vybraný modul na liště jantarově s okrajem, zvětšením a štítkem „▼ UPRAVUJETE“; na fotce ostatní rámečky ztlumené, vybraný žlutě se jmenovkou „-F1 · 3M“.
- [x] **Geometrie na DIN liště:** sloučit 2 / 3 / 4 sousední moduly (spojí rámečky, smaže duplicity, přečísluje), rozdělit na 1M moduly; chytré sloučení při volbě 3P / 4P (checkbox „Sloučit se sousedními moduly vpravo“); prompt Gemini hlídá spojené páčky.
- [x] **Parametry podle kategorie:** jistič, chránič, jističochránič, odpínač, SPD, stykač, relé (nová dlaždice), zdroj / měření / jiné – každá s vlastními řádky dlaždic dle zadání (žádné B/C/D u chráničů a odpínačů).
- [x] **Model:** katalog i prvek ukládají typ a citlivost chrániče, typ SPD a svodičový proud, kontakty a napětí cívky stykače, podtyp relé a modulu; prvek si pamatuje konfiguraci a ruční typ.
- [x] **Katalog 220+ přístrojů:** generovaný seed (ABB, Eaton, OEZ, Schneider, Hager, Noark, Schrack, Saltek, Finder, Elko EP, Mean Well …), přírůstkový upsert při startu kontejneru.

**Hotovo když:** klik v konfigurátoru změní modul na liště a uloží ho · sloučení 3× 1M → 3P a rozdělení fungují · parametry se mění podle kategorie · katalog ≥ 220 prvků · unit testy konfigurátoru, sloučení a seedu · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze33): živý konfigurátor prvku, sloučení modulů a katalog 220+ přístrojů`

### Fáze 34 – Panel Builder: Vision Analyzer 2.0
**Cíl:** Analýza reálných fotek nevynechává jističe na konci lišty, nerozsekává 3P přístroje a nehalucinuje DIN lištu na PE/N svorkovnici; technik každou chybu opraví do 5 vteřin.

- [x] **Dvoufázová analýza:** fáze A – stav zakrytování (UNCOVERED / COVERED) a rámečky jen skutečných DIN lišt (ne PE/N svorkovnice, ne žlaby), počet lišt projektu podle fotky; fáze B – výřez každé lišty (`sharp`, přesah +15 %) zvlášť do Gemini, souřadnice zpět do celé fotky.
- [x] **Duální metodika:** odkrytovaný = počítání šroubků + spáry a hrazdičky (3 spojené moduly = 1× 3P, 4M s „T“ = 4P RCD); zakrytovaný = kalibrace šířky 1M, celkový počet modulů na liště = součet šířek (chybějící konec řady se doplní).
- [x] **Kompaktní přístroje:** póly oddělené od šířky – 2×1P v 1M, 1P+N v 1M, 3P ve 2M; dlaždice v konfigurátoru a ruční šířka 0,5–6M; 2×1P jde rozdělit na 2 obvodové větve.
- [x] **Správa lišt a modulů:** „+ Přidat modul“ na konci lišty (s rámečkem na fotce), „Smazat prvek“, „Smazat celou lištu“, „+ Přidat DIN lištu“; tečkované 1M dělení uvnitř vícemodulových rámečků; přepínač režimu analýzy (Auto / Odkrytovaný / Zakrytovaný).
- [x] **Katalog:** kompaktní přístroje (ABB SN201 / DSN201, Eaton PLN6, OEZ OLI, Hager, Schrack, Noark).

**Hotovo když:** analýza s mockovaným Gemini vrátí lišty a moduly ve správných souřadnicích · kompaktní dlaždice a ruční šířka fungují · přidání / smazání modulu a lišty přečísluje · `npm run verify` a `npm run test:e2e` OK.
**Commit:** `feat(faze34): Vision Analyzer 2.0 – analýza po DIN lištách, kompaktní přístroje a správa lišt`

### Fáze 35 – Studio: kompletní UX a funkční revize 3 kroků
**Cíl:** Studio pracuje v reálných metrech – areál i místnosti mají rozměr X × Y přímo u objektu, měřítko skutečně mění zoom, stěny místností jdou chytit myší a zařízení se osazuje do jemného rastru nebo do místnosti.

- [x] **Rozměr areálu (krok 1):** pole „Šířka areálu – osa X“ a „Hloubka areálu – osa Y“ (50–2000 m) nad mapou pro nový i stávající závod, předvolby 150×100 / 300×200 / 500×350 / 1000×600 m; mapa má poměr stran pozemku, souřadnicová síť v metrech; nová budova si drží polohu i rozměr v metrech; u stávajícího závodu uložení přepočítá polygony budov (budova mimo areál = chyba).
- [x] **Podlaží:** „+ Přidat nadzemní patro (NP)“ nahoře, „+ Přidat podzemní patro (PP)“ pod ním.
- [x] **Měřítko:** 1:100 / 1:200 / 1:500 / 1:1000 = skutečné měřítko obrazovky 96 dpi (plátno se zvětší a posouvá), „Celé“ přizpůsobí šířce; grafické měřítko vpravo dole se přepočítává; přepínač i v kroku 1.
- [x] **Živé kóty:** budova v areálu i místnost (kreslení, výběr, tažení stěny) má štítky „X: … m“ a „Y: … m“ u hran a uvnitř „X m × Y m (plocha m²)“; konstrukční rastr popsán jako „Osa X (šířka) × Osa Y (hloubka)“.
- [x] **Tažení stěn:** 4 stěny a 4 rohy každé místnosti (zvýraznění, kurzor ew/ns/nwse/nesw-resize), přichycení na 1 m, posun celé místnosti, přesné X/Y/šířka/hloubka v panelu.
- [x] **7 typů zón** jako barevné dlaždice (výroba, administrativa, rozvodna VTZ, sklad, dílna, zázemí, chodba se šrafou) i v uloženém půdorysu.
- [x] **Vrata:** azurová výplň průjezdu, křídla, šipka vjezdu a štítek „🚪 Vrata 1“ s tmavým podkladem.
- [x] **Banery zařízení (krok 3)** místo selectu: barevný pruh, ikona, název, způsob umístění, počet kusů na patře; jednotné barvy kategorií (`src/lib/equipment-categories.ts`) v banneru, na značce, v seznamu a v legendě.
- [x] **Jemný rastr 1 m** pro pevná zařízení (obsazený bod = chyba) a **režim výběru místnosti** pro spotřebiče a nářadí (zvýraznění celé místnosti, přiřazení k místnosti, inventární štítek „🔌 3× Spotřebič · 🛠️ 2× Nářadí“ s detailem v panelu).

**Hotovo když:** rozměr areálu mění mapu i síť · měřítko mění velikost plátna a grafické měřítko · místnost jde nakreslit a stěnou roztáhnout s živými kótami · spotřebič se přiřadí do místnosti · `npm run verify` a E2E Studia OK.
**Commit:** `feat(faze35): Studio – rozměr areálu, funkční měřítko, kóty, tažení stěn, typy zón a zařízení`

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
| 5 | 2026-10-28 | `src/server/queries/floor.ts` (`getFloorView`: zařízení + aktivní revize + otevřený CR), `src/lib/equipment-filter.ts` (filtr stavu/typu, hledání bez diakritiky a pomlček + testy), `src/lib/equipment-icons.ts`, `components/map/floorplan/` (`FloorplanViewer` s react-zoom-pan-pinch 4.2, `EquipmentPin`, `EquipmentQuickView` – Sheet, `FloorEquipmentTable`, `FloorExplorer`), přepínač pater v hlavičce. Ověřeno v headless Edge: R-CNC-04 na 1. NP Haly A oranžový a pulzuje, RM1 v 1. PP Energetiky modrý; filtr stavu (jen R-CNC-04) i typu (rozváděče) filtruje piny i tabulku; hledání „lis02“ + Enter přiblíží na 300 % a fokusuje pin; zoom 100 → 400 % ostrý (inline SVG); piny drží na obrazovce stálou velikost; klik na pin otevře náhled s otevřenou změnou a „Otevřít detail“ vede na `/equipment/[id]`; 1440/1024/390 px (dotyk) bez horizontálního scrollu, bez chyb v konzoli; `npm run verify` OK (16 testů). Odchylky: (1) Protiškálování pinů přes CSS proměnnou `--inv-scale` nastavovanou v `useTransformEffect` (bez re-renderu), ne přes `KeepScale`; na úzkých displejích navíc `--pin-scale: 0.6`. (2) Hledání filtr nemění – našeptá shody, Enter/klik přiblíží na pin a případně zruší filtry, které ho skrývají. (3) Dočasná stránka `/equipment/[id]` (hlavička s lokací a stavem, prázdný stav; nahradí fáze 6) + `src/server/queries/equipment.ts`, aby „Otevřít detail“ nekončilo 404. (4) `getFloorHeader` z `queries/building.ts` odstraněn (nahrazen `getFloorView`). Známé nedostatky: tlačítka zoomu po sobě rychle klikaná přeruší animaci (krok +50 %); pinch-zoom ověřen jen v emulaci dotyku (načtení stránky), ne gestem. |
| 6 | 2026-10-28 | `getEquipmentDetail`, `/equipment/[id]` (hlavička s lokací, tagem, ID, technickými údaji, `StatusBadge`; `QrDialog` s `qrcode.react`, absolutní URL z `headers()`, tisk štítku přes print CSS `.print-area`), `SafetyBanner` (🟠 zákres nad základní revizí + přepis + fotky v lightboxu se zoomem; 🔵 výzva „Zkontrolovat novou revizi“), `DocumentationTabs` (`?tab=`), `SchematicViewer` (`?rev=`, zoom, PDF v iframe, stažení), `BomTable` (řazení, hledání, CSV se středníkem a BOM), `Cabinet3D` (CSS 3D, tažení, tlačítka, dvířka, moduly z `lib/mock-graphics/cabinet.ts`), `RevisionTimeline`, `ChangeRequestCta` (na mobilu přilepené dole, jen role Údržba). Nové knihovny: `lib/files.ts`, `lib/markup.ts` (zod), `lib/csv.ts` + testy (25 celkem). Ověřeno v headless Edge: R-CNC-04 banner s 2 fotkami, přepisem a zákresem kolem K4, CTA „Doplnit k otevřené změně ZM-2026-0041“; RM1 modrá výzva → v1.3; R-ML-01 historie s vrácenou v1.1 a důvodem; QR = `http://localhost:3000/equipment/eq-r-cnc-04`; záložka přežije reload; CAE CTA nevidí; SVG z `/api/files` má `Content-Security-Policy: sandbox`; 1440/1024/390 px bez horizontálního scrollu, bez chyb a 4xx; `npm run verify` OK. Odchylky: (1) **`GET /api/files/[...path]` vzniklo už teď** (plán: fáze 7) – bez něj se schémata a fotky nezobrazí; ve fázi 7 odškrtnuto. Navíc `?download=1` → `Content-Disposition: attachment`. (2) **`MarkupOverlay`** (plán: fáze 8) vytvořen teď v `components/canvas/` – banner ho potřebuje. (3) `cabinet.ts` (odložený z fáze 1) hotový. (4) CTA „Zkontrolovat novou revizi“ zatím vede na náhled nové revize (`?rev=…&tab=schema`); fáze 10 ho přesměruje na `/approve`. (5) Dočasná stránka `/equipment/[id]/change-request` (nahradí fáze 8). (6) Odstraněny prázdné `.gitkeep` ve složkách, které už mají obsah. Známé nedostatky: list schématu je vždy 1/1 (seed); pohled do 3D skříně z boku nechává pravou stěnu zakrýt kraj montážní desky (realistické, ale ořízne F6). |
| 7 | 2026-10-28 | `src/lib/workflow/state-machine.ts` (tabulka `TRANSITIONS` dle sekce B, `canPerform`/`assertCanPerform`, `deriveEquipmentStatus`, `nextVersion`, `formatTicketNumber` + `nextTicketSequence`, `WorkflowError` s kódy FORBIDDEN/INVALID_STATE/NOT_FOUND/VALIDATION/CONFLICT/INVARIANT a českými hláškami) + 31 testů; `src/server/services/workflow.ts` (7 služeb, každá v `$transaction` s událostí; `syncEquipment` po každém kroku přepočítá stav zařízení a ověří invarianty, jinak rollback); `src/server/actions/workflow.ts` (zod, `ActionResult`, URL souborů jen `/api/files/...`, `revalidatePath("/", "layout")`); `POST /api/uploads` + `validateUpload` (testy); `scripts/smoke-workflow.ts`. Ověřeno: `npm run test` 58 testů; `npm run smoke` projde (submit → assign → upload v1.3 → reject → upload v1.4 → approve; v1.2 ARCHIVED, v1.3 REJECTED, v1.4 ACTIVE; odmítnuté nepovolené akce; storno; dev.db beze změny podle SHA-256); upload PNG → 201 a GET `image/png`, `.exe` → 400; `npm run verify` OK. Odchylky: (1) Nahrané soubory se jmenují `<UUID>.<přípona>` (`crypto.randomUUID`), ne cuid – bez další závislosti. (2) Limit hlasových/markup souborů: voice ≤ 15 MB (webm/ogg/mp3/m4a), markup ≤ 10 MB (png/json) – plán je neuváděl. (3) Služby nemají `import "server-only"` (smoke skript je spouští přes tsx). (4) Vrácení revize zapíše vracejícího do `approverId`/`approvedAt` (časová stopa rozhodnutí, v historii „Vrátil(a)“) a vynuluje `resolvedAt` požadavku. (5) `uploadRevision` uloží shrnutí i do `ChangeRequest.engineerSummary` a do komentáře události. (6) ADMIN v MVP nemá žádnou workflow akci. (7) Server Actions revalidují celý layout (mění se piny, počty v areálu i dashboard). Známé nedostatky: `/api/uploads` neověřuje roli (MVP bez přihlášení) a obsah souboru (jen příponu a velikost); dev server po úpravě souboru přes shell (`cat >>`) nezachytil změnu a musel se restartovat. |
| 8 | 2026-10-28 | `/equipment/[id]/change-request`: `ChangeRequestWizard` (useReducer v `wizard-state.ts` + 10 testů, koncept v sessionStorage s try/catch, stepper, velká přilepená tlačítka Zpět/Další), `canvas/RedlineCanvas` (Pointer Events, tlak pera, pero/zvýrazňovač/guma po tazích, zpět/znovu, vymazat, Kreslit ↔ Posouvat se zoomem, výběr listu), `PhotoStep` (fotoaparát / galerie, zmenšení na 2000 px JPEG 0,85 v `lib/upload-client.ts`, upload přes XHR s průběhem, popisek, odebrání, opakování), `VoiceNote` (Web Speech API cs-CZ s průběžným přepisem, jinak simulace s ukázkovým přepisem; rychlé fráze; priorita Normální/Vysoká/Kritická), souhrn s náhledem zákresu, odeslání → toast → detail; režim „Doplnit k otevřené změně“ (Fotky → Poznámka → Souhrn → `addCommentAction`); pro CAE výzva `SwitchToMaintenance` (`setRole` umí `redirectTo`). Ověřeno v headless Edge s emulací dotyku 1024×768 nad **kopií DB** (`next start -p 3100`, `DATABASE_URL=file:./smoke.db`): kroužek prstem (CDP touch), guma + zpět, koncept přežije reload, fotka 3000×2000 PNG → uložena 2000×1333 JPEG, rychlá fráze + text, priorita Vysoká, odeslání → toast „Změna ZM-2026-0043 odeslána do CAE“, banner se zákresem a fotkou, pin R-ML-01 🟠; doplnění komentářem; CAE → přepnutí role zůstane na průvodci; prázdný průvodce nejde odeslat. Kopie DB i testovací fotka smazány, dev.db beze změny. `npm run verify` (68 testů) a `npm run smoke` OK. Odchylky: (1) Export PNG zákresu (volitelný) neimplementován – CAE i údržba vidí zákres přes `MarkupOverlay` nad schématem. (2) **Nový ticket v CAE pohledu zatím vidět není** – dashboard je dočasný do fáze 9; ověřeno přes banner, pin a číslo ticketu. (3) Rozpoznávání řeči: text vzniklý diktováním se ukládá jako `voiceTranscript`, ručně psaný jako `note`; audio se nenahrává (soubor `voice` zatím nevzniká). (4) Zvýrazňovač žlutý (#facc15), pero červené (#ef4444). (5) Opravena chyba historie zákresu (snímek se bral až v updateru setState). Známé nedostatky: na tabletu 1024×768 je spodní okraj listu pod přilepenou lištou, dokud uživatel neodroluje (plátno je omezené na výšku okna minus 17 rem, hlavička stránky zabírá zbytek); simulace diktování vloží vždy stejnou ukázkovou větu. |
| 9 | 2026-10-28 | `/cae`: KPI (Nové, V řešení, Čeká na schválení, Uzavřeno za 30 dní, průměrná doba vyřízení od nahlášení po schválení), `TicketDashboard` (filtry stav / priorita / závod / „Přiřazeno mně“ uložené v URL, řazení podle stáří, SLA tečka a popisek podle priority, klik na řádek → detail); pravidla v `lib/cae-tickets.ts` (+ 9 testů). `/cae/tickets/[id]`: `MarkupLayerViewer` (schéma základní revize se zoomem a přepínatelnou vrstvou zákresu), popis od technika, fotky v `PhotoGallery` (lightbox se zoomem), revize k ticketu s důvodem vrácení, metadata se SLA, `TicketActions` (Převzít, Nahrát novou revizi, Stornovat s dialogem – podle `canPerform`), `TicketTimeline` + `CommentForm`. `/cae/tickets/[id]/revision`: `RevisionUploadForm` (soubor SVG/PDF/PNG/JPG s průběhem a náhledem, minor/major s náhledem čísla verze, název, povinné shrnutí, `BomEditor` – změněné řádky žlutě, nové zeleně, odebrané přeškrtnuté s vrácením; logika v `lib/bom-edit.ts` + 5 testů), **„Vygenerovat upravené schéma“** = `generateSchematicAction` → `services/schematic.ts` (kusovník z formuláře → `overridesFromBom`, revizní obláček u změněných/odebraných prvků a u prvku nejblíž středu zákresu `nearestSchematicElement`; + 4 testy). Barvy SLA a událostí timeline přidány do `status.ts` (`SLA_LEVEL`, `CHANGE_REQUEST_EVENT`). Ověřeno v headless Edge nad **kopií DB**: údržba zadá ZM-2026-0043 → CAE vidí 0041, 0042 i 0043; filtry Uzavřené (5), Vše + Liberec (1) přežijí reload, Přiřazeno mně = 0041; Převzít → V řešení + událost; komentář; revize v1.3 (major ukáže v2.0), přidaný a odebraný řádek BOM, prázdný soubor zablokuje odeslání, vygenerované schéma 1190 px, odeslání → ticket Čeká na schválení, pin R-ML-01 🔵 a modrý banner u zařízení; R-CNC-04 zákres jde skrýt, lightbox fotek; 1024 a 390 px bez horizontálního scrollu; Údržba na `/cae` dostane výzvu k přepnutí; bez chyb v konzoli a 4xx. Kopie DB a vygenerované soubory smazány, dev.db beze změny. `npm run verify` (86 testů) a `npm run smoke` OK. Odchylky: (1) Nahrání revize je samostatná stránka `/cae/tickets/[id]/revision` (formulář s kusovníkem je na dialog příliš široký), na detailu je tlačítko. (2) `SwitchToMaintenance` zobecněn na `common/SwitchRoleButton` (výzva k přepnutí i na stránkách CAE). (3) Detail zařízení má pro roli CAE tlačítko „Otevřít ticket ZM-…“. (4) `POST /api/uploads` a generované schéma sdílí `server/storage.ts` (`saveUpload`). (5) SLA běží jen u ticketů Nová / V řešení (Čeká na schválení je na údržbě); lhůty kritická 4 h / 1 den, vysoká 1 / 3 dny, normální 3 / 7 dní, nízká 7 / 14 dní. (6) Průměrná doba vyřízení počítá všechny schválené tickety (v seedu není žádný uzavřený za posledních 30 dní). Známé nedostatky: generované schéma zná jen prvky mock schématu (Q1, F1–F6, K1–K4, T1, A1, X1, X2) – nové položky BOM (např. X3) se do kresby nepromítnou; po přepnutí minor/major je nutné schéma vygenerovat znovu (formulář na to upozorní); nahrané soubory se při odebrání ve formuláři z úložiště nemažou. |
| 10 | 2026-10-28 | `/equipment/[id]/approve` (jen Údržba a stav `WAITING_APPROVAL`, jinak prázdný stav nebo výzva k přepnutí role): shrnutí CAE vedle původního hlášení technika, `revisions/RevisionCompare` – **Vedle sebe** (dva `TransformWrapper` synchronizované přes `onTransform` → `setTransform`), **Posuvník** (nová revize přes `clip-path` nad starou, hranice posuvníkem), **Prolínání** (průhlednost); zákres technika nad starou verzí jde vypnout; PDF jen vedle sebe. `revisions/BomDiffTable` + `lib/bom-diff.ts` (párování podle označení a pořadí výskytu, přidáno/odebráno/změněno se starou hodnotou přeškrtnutou; + 3 testy). `revisions/ApprovalActions`: „Potvrdit a propsat do systému“ (potvrzovací dialog) a „Vrátit k přepracování“ (dialog s povinným komentářem ≥ 3 znaky a rychlými důvody); na mobilu přilepené dole. Po schválení toast + přesměrování na Historii změn, po vrácení toast + detail. Banner 🔵 na detailu vede na `/approve`; CAE vidí banner bez tlačítka („čeká na potvrzení údržbou“). Ověřeno v headless Edge nad **kopií DB** jedním kontextem s přepínačem rolí: RM1 – vedle sebe se synchronním zoomem (obě strany `scale(1.5)`), posuvník, prolínání, rozdíl BOM (F6, T1), schválení → v1.3 Platná, v1.2 Archiv; celá smyčka R-ML-01: Údržba zadá ZM-2026-0043 → CAE nahraje v1.3 (🔵) → Údržba vrátí s komentářem (🟠, komentář v CAE timeline i v banneru formuláře revize) → CAE nahraje v1.4 → Údržba schválí → pin zelený, historie v1.4 Platná / v1.3 Vrácená s důvodem / v1.2 Archiv; `/approve` poté ukáže „Žádná revize nečeká na schválení“; 1024 a 390 px bez horizontálního scrollu, bez chyb v konzoli a 4xx. Kopie DB a vygenerované soubory smazány, dev.db beze změny. `npm run verify` (89 testů) a `npm run smoke` OK. Odchylky: (1) Posuvník se ovládá polem pod listem (ne tažením čáry přímo v listu – tažení v listu posouvá zoom); čára je v souřadnicích listu, takže se při zoomu posouvá s ním. (2) Porovnává se vždy dosavadní **platná** revize s revizí ke schválení; zákres technika se kreslí nad platnou verzí (seed i průvodce kreslí nad platnou). (3) Po schválení přesměrování rovnou na záložku Historie změn. Známé nedostatky: stránku schválení na šířce 390 px jsem ověřil jen nepřímo (v kopii DB po smyčce nic nečekalo); u PDF revizí porovnání jen vedle sebe bez synchronizace. |
| 11 | 2026-10-28 | PWA: `src/app/manifest.ts` (standalone, cs, theme/background #09090b, zkratka na CAE), ikony přes `ImageResponse` ve sdíleném `lib/brand-icon.tsx` – `app/icon.tsx` (`generateImageMetadata`: `/icon/32`, `/icon/192`, `/icon/512`, `/icon/maskable`) a `app/apple-icon.tsx`; `viewport` (themeColor, `viewportFit: cover`) a `appleWebApp` v layoutu; výchozí `favicon.ico` odstraněn. Responzivita: CAE dashboard má na mobilu karty místo tabulky; rozdíl kusovníku na mobilu jen ikona změny a objednací číslo pod popisem; formulář revize přetékal (kontejner `mx-auto` ve flex sloupci bez `w-full` a absolutně pozicovaný `sr-only` popisek unikal z rolovací tabulky → `relative`); nová utilita `pb-safe` pro přilepené lišty (iOS home indicator). UX: skeletony `cae/loading.tsx` a `equipment/[id]/loading.tsx`, optimistické zobrazení odesílaného komentáře, skloňování „položka/položky/položek“ (BomEditor, BomTable). Přístupnost: půdorys je fokusovatelná oblast s ovládáním z klávesnice (+ / − / 0 / šipky) a viditelným focusem. Tisk QR štítku: bílá jedna strana, štítek 70 mm vlevo nahoře, skrytý obsah stránky. Ověřeno: Chrome/Edge `Page.getAppManifest` bez chyb, `getInstallabilityErrors` hlásí jen `in-incognito` (testovací profil), manifest a ikony 200; automatický audit 13 stránek × 390/820/1024/1440 px × obě role – bez horizontálního scrollu, bez anglických textů, bez nepojmenovaných tlačítek a obrázků bez `alt`, bez chyb v konzoli (kromě záměrné 404); klávesnice na půdorysu (zoom 150 %, posun, reset); tisk štítku do PDF. `npm run verify` (89 testů) a `npm run smoke` OK. Odchylky: (1) Service worker a offline režim nejsou (mimo MVP dle plánu) – Chrome 120+ instaluje i bez něj. (2) Kontrast AA ověřen výběrem tokenů (zinc-400 na zinc-950 ≈ 7:1, stavové -300/-400 na tmavém), ne nástrojem. (3) Minifikátor CSS (lightningcss) slučuje `translate: none` do `transform` a vlastnost zahodí – v print CSS se proto nulují proměnné `--tw-translate-*`. (4) Optimistické UI jen u komentáře a přepínače rolí; ostatní mutace ukazují spinner na tlačítku + toast. Známé nedostatky: instalaci na reálném tabletu jsem neověřil (headless profil je anonymní); fokus po zavření dialogů se vrací na spouštěcí tlačítko (Radix), ale u přesměrování po akci začíná na začátku stránky. |
| 12 | 2026-10-28 | `@playwright/test` 1.64.1, `playwright.config.ts` (1 worker, Edge přes `channel: "msedge"`, přepsatelné `E2E_BROWSER_CHANNEL`), skript `test:e2e`. `e2e/navigation.spec.ts` (areál → Hala A → 1. NP → pin R-CNC-04 → rychlý náhled → detail s bannerem; Hala B rovnou na půdorys; QR odkaz a 404), `e2e/workflow.spec.ts` (celá smyčka přes přepínač rolí: zákres myší na canvas, fotka z `e2e/fixtures/rozvadec.png`, poznámka → CAE převzetí + vygenerované schéma v1.3 → vrácení s komentářem → komentář v CAE timeline → v1.4 → schválení → historie Platná / Vrácená s důvodem / Archiv, pin zelený), `e2e/screenshots.spec.ts` → 10 obrazovek v `docs/screenshots/` (jen s `E2E_SCREENSHOTS=1`). `README.md` česky (popis, požadavky, instalace, skripty, E2E, demo scénář, architektura, omezení, přechod na PostgreSQL). Ověřeno: `npm run test:e2e` 3 testy OK (+ screenshoty 4/4), `npm run verify` (89 testů), `npm run smoke`; pracovní strom po E2E čistý, dev.db a běžící dev server netknuté. Odchylky: (1) **Místo `globalSetup: npm run db:reset`** si E2E vytváří vlastní čistou `e2e.db` (`e2e/prepare-db.ts`: smazání + `prisma migrate deploy` + `prisma db seed`) – `migrate reset` Prisma z AI nástrojů blokuje a navíc by smazal demo data v dev.db. Příprava DB je součástí příkazu `webServer` (globalSetup běží až po startu serveru); globalSetup jen po testech smaže soubory nahrané během běhu. (2) `webServer` = `next dev` na portu **3200** s `DATABASE_URL=file:./e2e.db` a `NEXT_DIST_DIR=.next-e2e` (nová volba `distDir` v `next.config.ts`), aby běžel vedle `npm run dev` (Next drží zámek na build adresáři). `next dev` si do `tsconfig.json` doplnil cesty `.next-e2e/types` – ponecháno, jinak by je přidával při každém běhu. (3) `npx playwright install chromium` nebylo potřeba – Windows má Edge; postup pro Chromium je v README. (4) `PhotoStep` má `data-uploaded` na položce fotky (náhled zůstává `blob:` URL, test čeká na dokončení uploadu). (5) Screenshoty se generují jen na vyžádání, aby běžný běh neměnil soubory v repozitáři; tlačítko Next Dev Tools je na nich skryté. Známé nedostatky: E2E běží jen v desktopovém viewportu (mobil/tablet ověřen ve fázi 11 auditem); test nediktuje hlasem (Web Speech API v headless prohlížeči není). |
| 13 | 2026-10-28 | Zadání fáze bylo vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 13 do něj doplněna. Migrace `compliance_inspections` (enumy `ComplianceCategory`, `InspectionType`, `InspectionResult`; `Equipment.fedFrom/feeds` s `onDelete: SetNull`). `lib/inspection.ts` (lhůtu určuje jen výchozí/pravidelná revize, mimořádná a termovize ji neposouvají; dny = kalendářní dny v Europe/Prague; varování ≤ 30 dnů; poslední den platnosti = 🟡 „končí dnes“), styly `INSPECTION_STATE` / `INSPECTION_RESULT` + `inspectionBadgeLabel` ve `status.ts`, `formatDateShort` (DD.MM.RRRR). `lib/switchboard-interface.ts` – tabulka rozhraní (příloha C ČSN EN 61439-1) se **odvozuje** ze štítkových údajů (Icw/Ipk, forma rozdělení, IK podle proudu a IP) místo nových sloupců v DB. Generátory `mock-graphics/document.ts` (A4 protokol, liniové schéma) a `compliance.ts` (5 druhů dokumentů pasportu + revizní zpráva/termovize). Nový druh uploadu `document` → `storage/uploads/documents`. Seed (`prisma/seed-compliance.ts`): hierarchie napájení TR1 → RM1 → rozváděče → stroje, 28 dokumentů pasportu (RM1 a R-CNC-04 kompletní, ostatní rozváděče jen prohlášení + kusová zkouška, R-ML-01 ukazuje neúplný pasport), 82 revizních zpráv; data relativní k okamžiku seedu (RM1 +14 měsíců vč. termovize s platností 24 měsíců, R-CNC-04 +18 dní, R-ML-01 −14 dní se závadou); kratší lhůty R-SKL 24 a lakovna LBC 12 měsíců. Služba `services/inspection.ts` (`recordInspection`, `renderInspectionReport`) + `actions/inspection.ts`; bez nahraného souboru se SVG zpráva vygeneruje. Zápis revize mohou obě role. UI: odznak a odkaz „Napájeno z“ v hlavičce, záložky `?tab=passport` a `?tab=inspections`, `InspectionWatcher` na areálu a v CAE (napříč závody), červený „!“ na pinu s propadlou revizí (+ řádek v tooltipu i u končící). Testy +17 (lhůty, popisky, rozhraní, generátory SVG, služba s falešnou Prismou). **Odchylka:** `npm run db:reset` zablokovala ochrana Prismy proti destruktivním příkazům spuštěným AI bez výslovného souhlasu – místo toho ověřeno `migrate deploy` + seed na čisté DB v dočasné složce a `dev.db` přeseedována přes idempotentní `db:seed`. Běžící `next dev` (port 3000) drží starý Prisma klient → po migraci je nutné ho restartovat; stránky ověřeny na produkčním buildu (`next start -p 3100`, desktop i tablet), včetně zápisu revize přes dialog (R-ML-01 → 🟢). E2E testy (`npm run test:e2e`) se v této fázi nespouštěly a README zatím fázi 13 nepopisuje. |
| 14 | 2026-10-28 | Zadání fáze bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 14 doplněna. Migrace `appliance_inspections`. **Odchylka typů:** stávající `CNC_MACHINE`, `ROBOT_CELL`, `HVAC_UNIT`, `COMPRESSOR` zůstaly (data, piny, testy) a nový `MACHINE` je obecný pevný stroj – pravidla i vrstvy je řadí ke strojům. `lib/inspection-rules.ts` (+ testy): ČSN 33 1500 podle kódů vnějších vlivů (normální 60, vlhké/prašné 36, BE2/korozní 24, BE3/mokré 12, neurčeno 36 měsíců), stroje NV 378/2001 Sb. 12, ČSN 33 1600 ed. 2 tabulkou skupina × druh (nářadí sk. C 12, spotřebiče C/E 24, přívody C 12), svářečky 12, LPS III 48, nouzové osvětlení 12; meze R_PE ≤ 0,3 Ω (tř. I) a R_iso ≥ 1 / 2 / 0,25 MΩ (tř. I / II / III) bez korekce na délku přívodu. Lhůty všech zařízení v seedu jdou z pravidel (např. RM1 teď 60 měsíců, lisovna 36, lakovna 12 – stavy 🟢/🟡/🔴 z fáze 13 zůstaly, data jsou relativní). Opraven popis vlivu BE3 (výbuch, ne požár). Nový stav lhůtníku **FAILED** (posudek Neschopno = „VYŘAZENO Z PROVOZU“, 🔴, platnost končí dnem revize) – hlídač, pin i filtr ⚠️ ho započítávají. Seed (`prisma/seed-appliances.ts`): 15 lehkých položek (kuchyňka v Energetice 1. NP – zadání neurčilo budovu, v Hale A přibyla místnost „Dílna údržby“; hromosvody LPS Hala A a B, nouzové osvětlení Hala A a Energetika, PC, tiskárna, přívod v administrativě), měření R_PE/R_iso v revizních zprávách. Lehké položky nemají revize dokumentace, pin i sloupec „Stav“ ukazují stav revize, chybí u nich „Zadat změnu“. Půdorys: `MapLayersPanel` + `lib/map-layers.ts` (+ testy), vyhledání skrytého kusu zapne jeho vrstvu. Hromadná revize: `BatchInspectionBar` v tabulce patra a na novém přehledu `/inspections` (filtr skupin, ⚠️, hledání), `recordBatchInspection` v jedné `$transaction` se společným SVG protokolem `HR-…`. `/inspections/rapid` (+ odkazy „Revize“ a „Rychlá revize“ v hlavičce): technik/osvědčení/přístroj v `localStorage` přes `useSyncExternalStore` (sdílí je i hromadná revize), fronta podle místnosti (`assignedZone`) řazená nezrevidované dnes → naléhavost, simulace QR skeneru, VYHOVUJE blokováno při nevyhovujícím měření, NEVYHOVUJE s rychlými závadami. Rychlá revize je jen pro přenosné typy (nářadí, spotřebiče, přívody, svářečky). Testy: unit 144 (+23), E2E nový `e2e/inspections.spec.ts` (vrstvy, rychlá revize, hromadná revize) – celá sada 6 ✔, 1 přeskočen (screenshoty). `npm run db:reset` znovu nespuštěn kvůli ochraně Prismy (viz fáze 13); ověřeno přes `prepare-db` E2E (čistá DB + migrace + seed) a `dev.db` přeseedována. Ruční kontrola na `next start -p 3100` (desktop, tablet, telefon 390 px). README fázi 13–14 zatím nepopisuje. |
| 15 | 2026-10-28 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 15 doplněna. `lib/inspection-voice-parser.ts` (+ 18 testů): normalizace bez diakritiky, období jako posun ve dnech od dneška (Europe/Prague) – propadlé, tento / příští měsíc, 12 měsíců v 1., 2. a 6. pádě (uplynulý měsíc = příští rok), „do X dnů / týdnů / měsíců“, „do konce roku“, „tento kvartál“; „bez / kromě propadlých“ propadlé vyřadí. Bez období platí výchozí horizont 6 měsíců + propadlé (bez odznaku). **Odchylky:** (1) `buildingQuery` / `floorQuery` / `zoneQuery` jsou pole termínů (lze zmínit víc lokací) a přibylo `locationMode` – výčet spojkou („v kuchyňkách a administrativě“) = sjednocení, vnoření („dílna v Hale A“) = průnik; bez toho by ukázkový povel č. 4 nic nevrátil. (2) Kategorie mají každá vlastní odznak (lze odebrat jednotlivě), ne jeden společný. (3) „stroj / cnc / lis“ pokrývá celou rodinu strojů (`MACHINE`, `CNC_MACHINE`, `ROBOT_CELL`, `HVAC_UNIT`, `COMPRESSOR`), „lis“ jen jako celé slovo (ne „listopad“). Zóny se porovnávají s `assignedZone` a názvem patra. `lib/inspection-planner.ts` (+ 9 testů): sloupce 🔴/🟠/🟡/🟢 (vyřazené a bez revize = ihned), tip „přiberte“ = stejná budova + patro + zóna a měřicí skupina, konec platnosti do 45 dnů po konci okna (u „jen propadlé“ dny 0–44), pochůzka budova (`sortOrder`) → patro (od nejnižšího) → zóna → přenosné před pevnými → tag, `groupForRoute` pro list. `/inspections/planner` (+ odkaz „Plánovač“ v hlavičce): `useSpeechRecognition` (Web Speech API `cs-CZ`, průběžný přepis, pulzující tlačítko, české chybové hlášky, bez podpory zakázané tlačítko s nápovědou), 4 ukázkové povely, živé odznaky s křížkem, výběr budovy, klikací měsíční přehled, souhrn pevná vs. přenosná, tip s „Přidat do plánu“ / „Přidat všech“, checkboxy pro vyřazení z dávky. Rychlá revize přebírá `?ids=` v pořadí pochůzky („Dávka z plánovače“) – jen přenosné kusy, pevná zařízení se zapisují hromadnou revizí v přehledu. Pochůzkový list = portál do `<body>` se třídou `.print-route` (v `globals.css`, nekoliduje s tiskem QR štítku), kolonky pro R_PE / R_iso a podpis. Seed: nový kávovar SP-0204 v kuchyňce končí vždy tento kalendářní měsíc (polovina zbytku měsíce; poslední den = dnes), chladnička SP-0203 5. den příštího měsíce, svářečka SV-0004 za 38 dní (tip u „do 30 dnů“), tiskárna za 100 dní, RP-ADM1 tento měsíc. E2E: nový `e2e/planner.spec.ts` (2 testy); první test sady zpevněn přes `toPass` (studený dev server stránku při první kompilaci přenačte) – celá sada 8 ✔ / 1 přeskočen i od nuly bez `.next-e2e`. Ruční kontrola na `next start -p 3100` (desktop, tablet, emulace tisku). Hlasové zadání ověřeno jen kódem a fallbackem – v automatickém prohlížeči mikrofon není. `npm run db:reset` znovu nespuštěn (ochrana Prismy), `dev.db` přeseedována přes `db:seed`. |
| 16 | 2026-10-28 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 16 doplněna. Migrace `temporary_mods_defects` (`TemporaryModification` s relací na `ChangeRequest` přes `spawnedChangeRequestId`, `InspectionDefect`, `InspectionRecord.maxTempC/deltaTempC`). Workflow: zadání změny a komentář vytaženy do `submitChangeRequestInTx` / `addCommentInTx` (veřejné `submitChangeRequest` / `addComment` beze změny chování). `services/temporary-mod.ts`: `createTemporaryMod` (lhůta jen 7 / 14 dní, číslo `PROV-RRRR-NNNN`, nemění revize ani nezakládá ticket), `resolveAsOneToOne`, `resolveAndConvertToChangeRequest` v jedné transakci – **odchylka:** má-li zařízení už otevřený požadavek (invariant max. 1), doplní se do něj komentář s fotkou místo druhého ticketu; nový požadavek má prioritu HIGH a autora = údržbu (CAE převést nemůže, transakce se celá vrátí). Testy obou větví (+ rollback) běží nad skutečnou SQLite z migrací (`services/test-db.ts`, migrace přes `$executeRawUnsafe`, bez nových závislostí). Závady: `lib/defects.ts` (lhůty kritická 0 / závažná 30 / drobná 90 dnů, stav po lhůtě, rozdělení soupisu na položky, třídy ΔT ≤10 / ≤20 / ≤40 / >40 K); revize s výhradou nebo neschopno nově zakládají `InspectionDefect` (zápis, rychlá i hromadná revize), v dialogu volba závažnosti; `resolveDefect`. LOTO: `lib/power-tree.ts` (řetězec od zdroje, podřízená zařízení do hloubky, odolné proti cyklu) v záložce Pasport u všech pevných zařízení (i strojů). Termovize: max. teplota + ΔT s barvou v historii, zápisu i SVG zprávě. Audit `/inspections/audit-report` (+ odkaz „Audit“ v hlavičce a v přehledu revizí): % shody = platné + končící / vše (`lib/audit-report.ts` + testy), kategorie podle vrstev mapy, otevřené závady, aktivní provizoria, kniha revizí, tisk a CSV (`toCsv`). **Tisk:** pravidla QR štítku v `globals.css` přepsána na `body:has(.print-area, .print-route)`, aby šla tisknout i celá stránka (`.print-report` černě na bílém). Seed: **R-LIS-02 v závodě není** → aktivní provizorium `PROV-2026-0007` je na R-LIS-01 (končí za 6 dní), 1:1 na R-VZT-01 a převedené na historický ZM-2025-0007 (R-CNC-04); závady R-ML-01 (2 otevřené po lhůtě), mimořádná revize R-CNC-04 před 25 dny (1 odstraněná, 1 otevřená – mimořádná revize lhůtu neposouvá), buben PP-0031, odstraněná u staré termovize RM1; ΔT u termovizí (RM1 41,2 K → 9,8 K, R-LIS-01 16,5 K). Fotka provizoria je SVG z generátoru; nákres provizoria (`markupJson`) má model i služba, UI ho zatím nezadává. Testy: unit 190, E2E nový `e2e/temporary-mods.spec.ts` (5 testů; převod se testuje na R-CNC-04 s otevřeným ZM-2026-0041, aby se neposunulo číslování z workflow.spec) – celá sada 13 ✔ / 1 přeskočen od nuly. Ruční kontrola v dev serveru (desktop, tablet, emulace tisku). `npm run db:reset` znovu nespuštěn (ochrana Prismy), `dev.db` přeseedována přes `db:seed`. |
| 17 | 2026-10-29 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 17 doplněna. Migrace `accounts_studio`. **Odchylka (RBAC):** zadání chtělo rozšířit `UserRole`; místo toho je typ účtu samostatný enum `AccountType` na `User` (+ `title`, `scopeLayers`, `sortOrder`) a workflow role (`MAINTENANCE` / `CAE_ENGINEER`) se z něj odvozuje (`lib/accounts.ts`) – stavový automat, služby, smoke skript a historická data zůstaly beze změny. Výřez = vrstvy mapy (fáze 14): ředitel a vedoucí vše, údržbář a CAE pevná zařízení (rodina strojů vč. CNC / robotů / VZT / kompresoru), revizní technik VTZ + hromosvody a nouzové osvětlení, technik spotřebičů jen nářadí, spotřebiče, přívody a svářečky; CAE bez lhůtníku (odznak, záložka, hlídač na areálu i v CAE, výstrahy na pinech). Výřez platí pro areál (počty), izometrii, půdorys, detail (mimo výřez = prázdný stav), přehled revizí, hlídač, plánovač, rychlou revizi a audit. Oprávnění: `can()` v UI + `assertPermission()` v Server Actions (zadání změny, schválení / vrácení revize jen ředitel a vedoucí údržby, provizoria, závady, zápis revizí, podúčty, Studio); stránky bez oprávnění ukazují `NoAccess` s nabídkou přepnout účet. Session: cookie `digitry-account` (id uživatele), bez ní platí starší `digitry-role` → výchozí účet role (Údržba = Karel Novotný, CAE = Ing. Tomáš Krejčí), takže starší E2E testy fungují beze změny. `RoleSwitcher` nahrazen dropdownem `AccountSwitcher` (jméno, funkce, barevný odznak, výřez dat); navigace podle oprávnění (+ Back-Office, Studio, Účty). Nové účty jsou nové osoby; dřívější demo uživatelé zůstali jako autoři historických revizí a ticketů. `/admin/users`: tabulka účtů s kategoriemi a oprávněními + „Přidat podúčet“ (typ účtu a vlastní výřez kategorií). Studio `/studio` (ředitel, vedoucí): `lib/cad-grid.ts` (osy, rozměr haly mezi krajními osami 12 × 6 m = 66 m, souřadnice A1–C11, vrata na obvodu, ryska 10 m podle rozteče; `renderFloorplanSvg` dostal volitelné měřítko – výstup pro seed beze změny), `lib/power-hierarchy.ts` (role zdroj / podružný rozváděč / stroj / drobné vybavení, povolení nadřazení, návrh pole / vývodu / zásuvkového okruhu, validace), `lib/studio-draft.ts`, `services/studio.ts` (vše v jedné transakci, `floorplanSvg` z rastru, piny z průsečíků, lhůty z `inspection-rules`). Na existující patra se osazuje v rastru 12 × 8 (stejný jako seed); rozvržení už uložených pater Studio needituje a rastr patra se neukládá. Izometrie dostala `onSelect` (náhled bez navigace). „⚡ Pavouk napájení“: `spiderLinks` v `lib/power-tree.ts` + `PowerSpiderOverlay` (žluté zakřivené spojnice s popiskem vývodu, modrá odbočka pro napájení z jiného patra / skryté vrstvy) na půdorysu i v kroku 4. Seed: 6 účtů, strom napájení pro nářadí v dílně Haly A, svářečku v Hale B, kuchyňku (z RM1), nouzové osvětlení a administrativu; liniové schéma kreslí jen pevné vývody. Testy: unit 211 (+21: výřezy účtů, rastr, hierarchie, pavouk, Studio nad SQLite), E2E nový `e2e/accounts-studio.spec.ts` (5 testů) a upravené `e2e/helpers.ts` (přepínání přes dropdown) – celá sada 18 ✔ / 1 přeskočen od nuly; smoke test OK. Ruční kontrola v dev serveru (desktop, tablet). `npm run db:reset` znovu nespuštěn (ochrana Prismy), `dev.db` přeseedována. Po migraci je nutné `npm run db:seed` – bez účtů ze seedu se aplikace nenačte. |
| 18 | 2026-10-29 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 18 doplněna. Bez migrace. Nový areál: `services/plants.ts` (kód 2–6 znaků, unikátní; „Ulice, Město“ → adresa + město) + `createPlantAction` (oprávnění `studio`, nastaví cookie závodu a přesměruje), položka „+ Přidat nový areál / závod“ a dialog v `PlantSwitcher`; na mapě areálu tlačítko „Přidat budovu do areálu“ (→ `/studio?plant=…`, Studio se při změně areálu resetuje přes `key`) a prázdný stav pro areál bez budov. **Oprava `zoneToRoom`:** zóny jsou nově **buňky rastru** (pole mezi sousedními osami; `parseCellRef`, `cellAt`) – `B2`–`B5` je pás výšky 1 modulu, jediné pole je platná místnost, pořadí bodů nehraje roli; zařízení a vrata zůstávají na průsečících os. Přibylo `zoneContains` / `zoneAt` (nejmenší místnost pod bodem), `nearestWallPoint` / `isWallPoint` a šablony patra `floorTemplate` (2 výrobní linky + sklad, rozvodna + zázemí, kanceláře podél chodby – platné i pro rastr 4 × 4). `lib/campus-layout.ts` (+ testy): posun / změna velikosti s hlídáním hranic areálu, obálka polygonu, překryv, převod metrů šablony na mapu (areál ≈ 400 × 280 m) a první volné místo. `lib/studio-autopilot.ts` (+ testy): další volný tag podle typu (`R-C-01`, `ML-03`, `SP-0323`, `LPS-C` …), název (hlavní rozváděč budovy, „Výrobní linka 3 – Svařovna“ …), nejvhodnější napájení (rozváděč na patře → v budově → hlavní rozváděč napájený z trafa). Studio ve 3 krocích: (1) šablony budov, velká mapa areálu `CampusPlacementMap` (klik = umístit, tažení = posun, úchyt = velikost, červené upozornění na překryv), u existující budovy jen její patra (žádné duplicity) + „Rovnou osadit zařízení“, blok rastru s rozměrem a izometrií; (2) `GridCanvas` v režimu tažení buněk se živým obdélníkem, ruční zadání polí jako záloha, šablony, režim „Umístit vrata“ klikem u zdi, přejmenování místností v seznamu; (3) jedna lišta pater, autopilot po kliknutí do rastru i po změně typu (tag, název, napájení, vývod, místnost – mimo místnost u drobného vybavení název patra). Rozvržení stávajících pater Studio dál needituje. Testy: unit 222 (+11), E2E `accounts-studio.spec.ts` přepsán na 3kroké Studio (tažení budovy a úchytu, tažení B2–B5, vrata u zdi, autopilot RM1 → R-C-01 → ML-03 ve „Svařovně“) + nový areál – celá sada 19 ✔ / 1 přeskočen. **Známý problém:** běží-li současně `npm run dev` (port 3000), E2E server (port 3200, `.next-e2e`) se nekonečně přenačítá (oba servery přepisují sdílené soubory projektu) – před `npm run test:e2e` je nutné dev server zastavit. Ruční kontrola v dev serveru (desktop, tablet). |
| 19 | 2026-10-29 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 19 doplněna. Migrace `plant_campus_meters` (`Plant.campusWidthM` / `campusDepthM`, výchozí 400 × 280 m). **Nový závod od nuly:** přepínač na začátku kroku 1 Studia (stávající závod / „🆕 Vytvořit úplně nový závod od nuly“), pole název, kód, město / adresa a rozměr pozemku v m; mapa = generický oplocený pozemek s vrátnicí (`CampusSite`, měřítko podle šířky areálu), převod metrů budovy na mapu přes `metersToRect(…, campus)`. `saveStudioBuilding` s `newPlant` ověří závod (`preparePlant` – sdílené s přepínačem závodů) a v **jedné transakci** založí závod, budovu, patra i zařízení; akce nastaví cookie `digitry-plant`. „Zahodit koncept“ budovy, tlačítko „+ Nový závod od nuly“ na mapě areálu (`/studio?new=plant`). **Dokumentace:** `lib/panel-model.ts` – deterministický model rozváděče (ISO/IEC 81346 `=JBC+A1NP-R-CNC-04`, -Q1, -F1 SPD, -F2 RCD, vývody -F3…-F12 z napájených zařízení + 1f okruhy, motorový vývod -Q2/-Q3/-X1/-W1/>-M1, seznam spojů s čísly vodičů, PLC -K1 DI0–DI7 / DO0–DO3 / AI0 se sloty, ztráty P = Σ Pn·(Ib/In)²·SF 0,5 a oteplení dle IEC 60890). `mock-graphics/pcschematic.ts` – 6 listů A3 s rámem 1–8 / A–F a razítkem PCSCHEMATIC Automation (Project title, Customer, Page title, File name, Page ref., DCC, Scale, Last edit, Page X / 6), křížové odkazy `data-xref="/4.6"`. **Odchylka:** listy knihy se vkládají do stránky inline (výjimka z pravidla „nahrané SVG přes `<img>`“ – jde o SVG generované aplikací s escapovanými texty a jen tak fungují klikací křížové odkazy). `SchematicViewer`: obsah knihy (6 listů + „Původní výkres revize vX (CAE)“ – redlining a schvalování dál pracují s výkresem revize), list a sloupec v URL (`?tab=schema&sheet=4&col=6`, `history.replaceState` bez dotazu na server), zvýraznění sloupce cíle. Kniha je výchozí pohled záložky Schéma u rozváděčů, linek, strojů, CNC a robotických pracovišť. **Diagnostika:** záložka „🔍 Diagnostika & Spoje (Údržba)“ (`lib/panel-diagnostics.ts`) – propípávač (svorka X1:U / X2:5, vodič 18, kontakt -Q1:13, přístroj -S1, kabel W1 → FROM → TO, potenciál, průřez, barva, kabel / žíla, proklik na list a sloupec), hledač PLC (adresa 1.00, DI0 / DO2, slot, ALARM_ON_1, „Endstop UP“ → karta -K1, svorka, koncový prvek, Sink / Relay / 4-20mA) a kalkulačka fází L1/L2/L3/N vůči -Q1 s doporučením nejméně zatížené fáze, simulací nového okruhu a tepelnou rezervou. **Přihlášení:** `lib/auth.ts` (HMAC-SHA256 přes Web Crypto, token `id.expires.podpis`, platnost 12 h, heslo `DIGITRY_ACCESS_PASSWORD` – výchozí `digitry2026`, tajemství `DIGITRY_AUTH_SECRET`, jinak odvozené z hesla), `src/proxy.ts` (stránky → `/login?next=…`, `/api/*` → 401, výjimky statické soubory, ikony a manifest; `DIGITRY_BYPASS_AUTH=1` bránu vypne), `/login` (dlaždice účtů nebo e-mail + heslo / PIN, `useActionState`, odeslání přes transition kvůli resetu formuláře), „Odhlásit (Zamknout)“ v hlavičce; nepřihlášený vidí v hlavičce jen logo. Cookie je v produkci `Secure` (`DIGITRY_INSECURE_COOKIE=1` pro http bez TLS). E2E: `global-setup.ts` podepíše cookie tajemstvím E2E serveru do `storageState`, `login.spec.ts` ji vynuluje. Testy: unit 236 (+14: auth, panel model a diagnostika, PCSCHEMATIC listy, nový závod ve Studiu, rozměr areálu), E2E +3 (`login.spec.ts`, `phase19.spec.ts`: nový závod od nuly, kniha s odkazem /4.6 a diagnostika) – celá sada 22 ✔ / 1 přeskočen. **Oprava známého problému z fáze 18:** nekonečné přenačítání E2E serveru nezpůsoboval souběh s portem 3000, ale zastaralá cache Turbopacku v `.next-e2e` („HMR hash mismatch“ při každém připojení) – při opakování pomůže smazat `.next-e2e`. Vizuální kontrola v prohlížeči neproběhla (jen E2E). |
| 20 | 2026-10-29 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 20 doplněna. Bez migrace. **Značka:** `src/lib/brand.ts` (Eldock, podtitul „Průmyslový dok dokumentace a revizí“, domény eldock.cz / .eu / .sk, „Eldock CAE“), nové logo `LogoMark` – portál doku s bleskem nad nakládací rampou s výstražným černo-žlutým pruhem, nápis **EL**DOCK (hlavička, `/login`, ikony PWA v `brand-icon.tsx`). Metadata a manifest (`Eldock`), tiskové sestavy (auditní report – řádek značky jen v tisku, pochůzkový list, QR štítek se značkou a doménou), razítka výkresů (PCSCHEMATIC, schéma revize, generované dokumenty), seed (`…@eldock.cz`, „Eldock CAE“), `package.json` → `eldock`. **Zpětná kompatibilita:** cookies a klíče v prohlížeči zůstávají `digitry-*` (přihlášení a koncepty se nerozbijí); proměnné `ELDOCK_*` s fallbackem na `DIGITRY_*` (`brandEnv()` v `lib/auth.ts`), výchozí heslo nově `eldock2026` (`.env` a `.env.example` přejmenovány). Dev databázi je kvůli novým e-mailům potřeba přeseedovat (`npm run db:seed`). **Docker:** `next.config.ts` → `output: "standalone"` + `outputFileTracingExcludes` (bez `storage/**`, `src/**`, `*.db` – jinak je trasování přibalí kvůli cestám přes `process.cwd()`). `Dockerfile` (node:22-bookworm-slim, deps → build → runner, uživatel `eldock` 1001, tini, HEALTHCHECK na manifest), `docker-entrypoint.sh` (jako root připraví svazky a přes `setpriv` přejde na `eldock`, `prisma migrate deploy`, seed jen nad prázdnou DB a při `ELDOCK_SEED_DEMO=1`). **Odchylka:** migrace a seed běží z `/app/ops` s plnými `node_modules` z build fáze (Prisma CLI se schema enginem a tsx musí být v obraze předem kvůli air-gapu) – obraz je proto větší, ale běžící aplikace startuje ze standalone serveru. `docker-compose.yml` (`eldock-app` jen interně na 3000, svazky `./data/db`, `./data/storage`, `caddy` na 80/443 + HTTP/3, certifikáty v `./data/caddy`), `Caddyfile` (domény z `ELDOCK_DOMAINS`, Let's Encrypt, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-/Permissions-Policy, limit těla 50 MB), `.env.production.example`, `.dockerignore`, `.gitattributes` (LF pro `*.sh`, Dockerfile, Caddyfile). README: sekce o Hetzner Cloud, DNS u Czechia.com a on-premise / air-gapped variantě. **Známé omezení:** Docker na vývojovém stroji není, obraz ani compose nebyly sestaveny – ověřen je standalone build (`node server.js`: /login a manifest 200, chráněná stránka 307 → /login, API 401, po přihlášení závod, detail rozváděče s knihou PCSCHEMATIC, auditní report a ikony 200). Testy: unit 237 (+1 fallback proměnných), E2E celá sada 22 ✔ / 1 přeskočen. |
| 21 | 2026-10-30 | Zadání (Vlna 1 + Vlna 2) bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu, Vlna 1 = fáze 21, Vlna 2 = fáze 22. Mezi fázemi 20 a 21 proběhly na žádost uživatele mimo plán a rovnou se nasadily: veřejná landing page na `/` a aplikace na `/app` (`0d54185`), reálné PDF projekty PCSCHEMATIC s prohlížečem a porovnáním (`6b91741`), fotky zařízení a správa QR štítků (`7990e28`). **Migrace** `20261030210000_inspection_measurements_notifications`: `InspectionRecord.leakageCurrent` (I_PE / I_Δ v mA) a `functionalTest`, nový model `NotificationLog`. **Kreslení do fotky:** `lib/photo-annotation.ts` (tvary v souřadnicích 0–1, `drawAnnotations`, hrot šipky) + `PhotoAnnotator` (Pointer Events – myš, prst i pero; tužka, šipka, obdélník, elipsa, text, červená/žlutá, Zpět, Vymazat vše). Uložení složí fotku a vrstvu v plném rozlišení do JPEG, nahraje přes `/api/uploads` a nahradí fotku v průvodci (štítek „Se zákresem“, popisek „Zákres do fotky“) → CAE ji vidí mezi fotkami ticketu. **Protokoly:** `lib/inspection-protocol.ts` (varianta VTZ / spotřebič podle `isPortable`, tabulka R_PE, R_iso, I_PE / I_Δ, funkční zkouška s mezními hodnotami, posudek) + tisková stránka `(print)/inspections/report/[id]` (A4, `@page`, automatický dialog tisku → „Uložit jako PDF“; hlavička provozovatele, zařízení, revize, závady, podpis a razítko). Tlačítko u každého záznamu v kartě zařízení a ikona v přehledu `/inspections`. Formulář zápisu revize má nově unikající proud a funkční zkoušku. Protokol bez závad = 1 strana A4, s dlouhým seznamem závad 2 strany (posudek a podpisy se nedělí). Lišta tisku sjednocena do `components/common/PrintToolbar` (i štítek). **Hlídač lhůt:** `lib/inspection-digest.ts` (skupiny po termínu / do 14 / do 30 dnů, HTML e-mail s inline styly a textová verze), služba `services/notifications.ts` (příjemci = účty Technický ředitel a Vedoucí údržby; bez SMTP `LOGGED`, chyba SMTP `FAILED`, log vzniká vždy), `server/mailer.ts` (nodemailer **10.1.1** – připnutá verze starší než 2 týdny, `ELDOCK_SMTP_URL`, `ELDOCK_MAIL_FROM`), stránka `/inspections/alerts` (karty skupin, náhled e-mailu v izolovaném `iframe srcDoc`, „Odeslat souhrnné avízo nyní“, log s náhledy), endpoint `POST /api/cron/inspection-alerts` s `Authorization: Bearer ELDOCK_CRON_SECRET` (bez tokenu 503; přihlašovací brána `/api/cron/` propouští). Odkazy z plánovače i přehledu revizí. **Import:** `lib/equipment-import.ts` (CSV se středníkem / čárkou / tabulátorem z Excelu, uvozovky, UTF-8 i Windows-1250, hlavička nepovinná, kategorie → typ podle názvu, česká i ISO data, automatické spárování lokality s budovou a patrem), služba `services/equipment-import.ts` (transakce, jedinečnost evidenčních čísel v závodě, QR kódy, převzatá poslední revize se zprávou `IMP-…`, piny v řadách u spodního okraje patra), průvodce `/inspections/import` ve 3 krocích s hromadným přiřazením Závod → Budova → Patro. **Oprava produkce:** Caddy posílal `X-Frame-Options: DENY`, což blokovalo i vlastní náhledy PDF v `<iframe>` (prohlížeč PDF z předchozího nasazení na eldock.cz nefungoval) → `SAMEORIGIN`; na serveru je potřeba Caddy znovu načíst (`docker compose restart caddy`), běžný deploy to neudělá. **Známá omezení:** zákres je v souboru fotky (vrstva se neukládá zvlášť, nelze ji později upravit); e-mail se reálně neodesílal – ověřen jen režim bez SMTP a stub transport v testech. Testy: unit 269 (+32), E2E 32 ✔ / 1 přeskočen. |
| 22 | 2026-10-30 | **Migrace** `20261030230000_schematic_references`: model `SchematicReference` (revize, stránka, označení, název, popis, pozice v % stránky, `linkedEquipmentId`). Nová závislost **pdfjs-dist 6.4.299** (připnutá verze starší než 2 týdny) – `lib/pdf-client.ts` vykresluje stránky PDF do obrázku, worker přes `new Worker(new URL(…, import.meta.url))` (Turbopack ho v produkčním buildu přibalí do `static/media`, žádné CDN). **Visual Diff:** `RevisionCompare` přepsán – PDF i SVG se vykreslí do obrázku, takže všechny režimy fungují pro obojí: Vedle sebe (synchronizovaný zoom, stará verze červená hlavička, nová zelená), Posuvník (opona), **Barevný diff** (`lib/visual-diff.ts`: pixely kresby jen ve staré verzi červeně, jen v nové zeleně, společné šedě, statistika „změna X % kresby“) a ponechané Prolínání; výběr stránky u PDF (obě verze stejné číslo stránky). Použito na schvalování, v detailu zařízení („Porovnat s v1.0“) a nově v CAE ticketu (sekce „Porovnat revize (Visual Diff)“ – základ vs. poslední nahraná revize). Demo: pohon vrat PV-M1, stránka 6 (silové schéma) ukazuje reálné rozdíly mezi `pohon-vrat-v2.pdf` a `pohon-vrat-motor.pdf`. **CAE reference:** `InteractiveSchematic` jako vrstva prohlížeče dokumentace (tlačítko „Interaktivní prvky (N)“, i `?layer=refs`): stránka výkresu se zoomem a klikacími štítky (oranžové = propojené se zařízením, modré = součást zařízení), boční „Rozpis prvků ve schématu“ po stránkách a plovoucí karta (Sheet) s popisem, propojeným zařízením (stav dokumentace a revize, platná verze výkresu, poslední 3 červenky) a „Přejít na kartu zařízení“. CAE / správce závodu reference přidává kliknutím do výkresu, upravuje a maže (`services/schematic-references.ts`, značení normalizované dle ČSN EN 81346). Nová revize od CAE reference převezme z platné revize (jako kusovník). Demo: 10 referencí na výkresu PV-M1 v1.1 – pozice vyčtené z popisků skutečného PDF přes pdf.js (str. 6 -Q1/-Q2/-Q3/-F2/-X1/-M1, str. 7 tlačítka -S1–S3, str. 17 -UC2 → R-PLC-ML1); doplňuje je idempotentní `seed-demo-docs` (i na produkci při startu). **Odchylky:** zadání uvádí příklady -K1 „Řídicí relé PLC“ a -F2 „Jistič ovládání“ – v reálném PCSCHEMATIC projektu značka -K1 není, PLC je -UC2 (E2E test ukazuje přidání -K1 ručně). Motor je ve výkresu popsán jen „M“, reference -M1 je umístěna na tento popisek. **Známá omezení:** reference převzaté do nové revize se neposouvají automaticky (CAE je případně přesune); diff porovnává stejné číslo stránky v obou verzích. Testy: unit 276 (+7), E2E 35 ✔ / 1 přeskočen. |
| 23 | 2026-10-31 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 23 doplněna. Fáze 21 a 22 nasadil uživatel sám (`git push` + SSH s restartem Caddy) – produkce ověřena: `726fb56`, `X-Frame-Options: SAMEORIGIN`, migrace a 10 referencí ve výkresu. **Migrace** `20261031080000_tenant_modules`: `TenantModule` (globální konfigurace tenantu – jedna instance = jeden zákazník; chybějící řádek = zapnuto, výchozí stav vše aktivní). `lib/modules.ts` (definice Core + 3 add-onů, mapování cest na moduly, `resolveHome`), `services/modules.ts`, `server/modules.ts` (`getModuleState` cache na request, `assertModule` pro Server Actions). **Administrace** `/admin/modules` (jen Technický ředitel – `manageUsers`): karty Core / Add-on s přepínačem (role=switch, optimistické přepnutí), záložky „Podúčty a oprávnění“ / „Moduly a tarif“; položka navigace „Účty“ přejmenována na „Správa“. **Dynamické UI:** INSPECTIONS_PRO = navigace Plánovač / Rychlá revize / Audit, stránky planner, rapid, audit-report, alerts, tisk `/inspections/report/[id]` (404), cron API (403), akce avíza a rychlé revize, tlačítka „Generovat revizní zprávu (PDF)“ a „Hlídač lhůt“; CAE_ADVANCED = kreslení do fotek, interaktivní prvky ve výkresu (vrstva i akce), posuvník / barevný diff / prolínání (bez modulu zůstává porovnání vedle sebe s odznakem „Dostupné v modulu CAE Pro“ – schvalování revize je Core), Visual Diff v CAE ticketu; ENTERPRISE_TOOLS = Studio (navigace, stránka, akce, tlačítka v areálu a přepínači závodu), import CSV (stránka, akce, odkaz). Vypnutý modul: položky zmizí, přímé URL ukáže „… je součástí modulu …“ (správci s odkazem na konfiguraci). **Report auditu (nálezy → oprava):** (1) **Slepá ulička – zákres nad PDF revizí:** u zařízení s PDF projektem (RH1, R-PLC-ML1, PV-M1) průvodce „Zadat změnu“ vkládal PDF do `<img>` → technik kreslil nad rozbitým obrázkem, souhrn i bezpečnostní banner ukazovaly prázdno a CAE ticket psal „zákres nad PDF nelze zobrazit“. Oprava: `use-drawing-image` vykreslí stránku PDF přes pdf.js (list zákresu = stránka PDF, navigace listů funguje přes 52 stran) v průvodci, souhrnu, bezpečnostním banneru i CAE ticketu. (2) **Produkce – náhledy PDF:** Caddy posílal `X-Frame-Options: DENY`, takže prohlížeč PDF na eldock.cz nezobrazil nic → `SAMEORIGIN` (nasazeno). (3) **Duplicitní akce:** QR štítek a Zadat změnu byly u údržbáře dvakrát (hlavička + nové dlaždice) → v terénním pohledu jen jedna sada velkých akcí. (4) **Matoucí text:** údržbář bez práva schvalovat viděl „revize čeká na potvrzení údržbou“, přestože sám je údržba → „čeká na potvrzení vedoucím údržby“. (5) **Zahlcení směnového údržbáře** (Petr Svoboda): nový příznak účtu `fieldView` – areál bez KPI dlaždic a hlídače lhůt (místo nich výzva „naskenujte QR štítek“), v navigaci bez manažerského přehledu revizí (URL dál funguje), v detailu zařízení rychlé akce Schéma / QR štítek / Nahlásit změnu hned pod hlavičkou, dokumentace před fotkou a štítkem, záložka Pasport zúžená na „LOTO – bezpečné odpojení“ (pasport a lhůtník skryté; stav revize zůstává v hlavičce). (6) **Domovská stránka revizních techniků** (plánovač / rychlá revize) by po vypnutí modulu vedla na zablokovanou stránku → `resolveHome` je pošle na přehled revizí. (7) **Nasazení:** blok `git push … ! ssh …` vrátil exit 1, i když nasazení prošlo – `!` na začátku řádku v bashi neguje návratový kód (každý příkaz zadávat jako samostatný řádek s `!`). Prošlá smyčka bez nálezu: zadání → převzetí a nahrání v CAE (reference i kusovník se přebírají) → vrácení / schválení → archiv a zelený pin (E2E workflow). **Známá omezení:** moduly jsou globální pro instanci (ne per závod) – pro multi-tenant by se přesunuly na úroveň zákazníka. Testy: unit 282 (+6), E2E 40 ✔ / 1 přeskočen. |
| 24 | 2026-10-31 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 24 doplněna. Fázi 23 nasadil uživatel (`fd35deb`, ověřeno). **JS při prvním načtení (gzip, měřeno z build manifestů Turbopacku – Next 16 velikosti nevypisuje):** karta zařízení 341 → 274 KB (−20 %), schválení revize 293 → 228 KB (−22 %), přehled revizí 279 → 237 KB (−15 %), areál 274 → 232 KB (−15 %), import 273 → 231 KB, CAE ticket 258 → 249 KB, průvodce změnou 259 → 257 KB, rozcestník a landing beze změny (222 / 183 KB = React + Next + hlavička). **Co to udělalo:** (a) `PageTransition` z `motion` na čisté CSS (`@keyframes page-enter`, stejných 320 ms a křivka, `prefers-reduced-motion` = jen prolnutí) – 42 KB z každé stránky aplikace; **odchylka od sekce A** (animace přes `motion`): balíček zůstává v závislostech pro případné animace mapy, ale nikde se nenačítá. (b) `components/lazy` – `next/dynamic` z klientského modulu (dělení kódu z Server Componenty Next 16 nepodporuje): interaktivní výkres, Visual Diff (`RevisionCompare` i ve SchematicViewer, schválení a CAE ticketu), 3D rozváděč, diagnostika, kusovník, QR štítek; editor zákresu do fotky se stáhne až po „Zakreslit“. pdf.js se načítal dynamicky už dřív. Průvodce importem zůstal staticky – je to celý obsah stránky, dělení by nic neušetřilo. **SQLite:** `lib/prisma.ts` – volba adaptéru `timeout: 5000` (busy_timeout) a PRAGMA `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout`, `foreign_keys = ON` po startu (adaptér drží jediné spojení). **Odchylka:** PRAGMA s WAL jen za běhu produkčního serveru (`NODE_ENV=production` a ne `NEXT_PHASE=phase-production-build`); v dev a testech `journal_mode = DELETE`. Důvod (nalezeno při E2E): soubory `-wal`/`-shm` v kořeni projektu se mění při každém dotazu a hlídač souborů Turbopacku pak stránky donekonečna znovu načítal; `next build` by navíc trvale přepnul lokální `dev.db`. Ověřeno standalone serverem: produkční databáze přejde do WAL, `dev.db` po buildu zůstává v DELETE. WAL soubory v `.gitignore`, `.dockerignore` a vyloučení z trasování; entrypoint otevírá DB bez `readonly` (WAL potřebuje `-shm`). **Indexy** (migrace `20261031120000_performance_indexes`, 14): cizí klíče bez indexu (autor/schvalovatel revize, nahlašovatel a základní revize požadavku, nahrávající přílohy, aktér a revize události, provizorium → požadavek), `Equipment.type` (výřez účtu), `User.accountType`, `InspectionRecord(equipmentId, type, validUntil)`, `InspectionDefect(status, deadline)`, `ChangeRequest.submittedAt`, `NotificationLog(kind, plantId, createdAt)`. **Dotazy:** detailové a přehledové dotazy v `cache()` (generateMetadata a stránka dřív dělaly stejný těžký dotaz dvakrát; metadata areálu / budovy / patra nově se stejným výřezem účtu); karta zařízení už nenačítá kusovníky všech revizí (`getRevisionBom` jen pro vybranou) a napájení, štítek, kusovník a reference čte jedním `Promise.all`; `params`/`searchParams` paralelně; tisk štítku lehkým `getEquipmentLabel` místo celého detailu; Studio čte závod a zařízení paralelně. **Cache:** `/api/files` – nahrané soubory (UUID jméno) `private, max-age=31536000, immutable`, seed soubory den + `stale-while-revalidate`, ETag z velikosti a času změny a odpověď 304 bez čtení souboru; PDF projekty v `public/demo-docs` cache na den nastavuje přihlašovací brána jen přihlášeným, přesměrování na `/login` a 401 mají `no-store` (hlavička z `next.config.ts` by se přilepila i na přesměrování a prohlížeč by si den pamatoval „PDF → přihlášení“). Zákres do fotky JPEG 0,85 (fotky už dřív zmenšené na JPEG 0,85). **Docker:** fáze `deps` kopíruje jen `package.json`, zámek, `schema.prisma` a `prisma.config.ts` – dřív `COPY prisma` spouštělo `npm ci` (30+ s) při každé nové migraci či změně seedu; cache mount npm nelze (server staví klasickým builderem bez BuildKitu). Obraz lokálně nesestaven (Docker není), ověří až nasazení. Testy: unit 284 (+2), E2E 42 ✔ / 1 přeskočen. |
| 25 | 2026-10-31 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 25 doplněna. Fázi 24 nasadil uživatel (`6df3c01`): ověřeno – indexy z migrace, po prvním dotazu produkční DB ve WAL (`-wal`/`-shm` ve svazku), přesměrování PDF s `no-store`. **Migrace** `20261031150000_tenant_features`: `TenantFeature` (podfunkce) a `TenantSetting` (`modules.displayMode`); `TenantModule` z fáze 23 zůstává jako hlavní přepínač modulu. **Registr** `lib/modules.ts` (jediný zdroj pravdy): CORE + 3 add-ony a 11 podfunkcí s obchodním přínosem a vlastními cestami (`featureForPath`), `effectiveFeatures` (modul A podfunkce), presety START / PROFI / ENTERPRISE a `matchingPreset`, `resolveHome`, `roleImpact` (matice nástrojů × oprávnění rolí). Podfunkce `enterprise.ai_panel_builder` je jen ukázka „Roadmap / AI Labs“ (nelze zapnout). Server: `getFeatures()` (cache na request, `on()` / `show()` / `upsell`), `assertFeature()` v Server Actions a cron API; služby `setFeatureEnabled`, `setDisplayMode`, `applyPreset` (vše v jedné transakci). Nové oprávnění `manageModules` (technický ředitel **i vedoucí údržby**) – položka „Moduly“ v navigaci, „Účty“ zůstává jen řediteli. **Režimy:** CLEAN = vypnuté funkce zmizí (navigace, tlačítka, záložky); UPSELL = zůstanou se zámkem a odznakem „Modul Pro“ (zamčené položky navigace, „Porovnat s v1.0“, „Interaktivní prvky“, „Zakreslit“ u fotky, odkazy v přehledu revizí) a klik otevře okno s přínosem a „Přejít do správy modulů a aktivovat“ (ostatním výzva obrátit se na ředitele / vedoucího). Přímá URL vypnuté funkce ukáže kartu „… není ve vašem tarifu aktivní“ v obou režimech. Výchozí stav: vše zapnuté, režim Obchodní demo. **Propojení:** navigace (vč. Back-Office = `cae.ticketing`), areál (Studio), rozcestník a přepnutí účtu (domovská stránka), detail zařízení (prokliky, porovnávač, PDF protokoly, tlačítko CAE ticketu), červenka (kreslení do fotek), schválení revize, `/inspections`, `/cae` (dashboard, ticket, nahrání revize) a akce převzetí / nahrání revize. **Odchylky:** (1) podle zadání je CAE ticketing součástí add-onu CAE_ADVANCED – v tarifu START / PROFI nemá CAE projektant back-office (matice to ukazuje); červenka z haly zůstává v Core. (2) Fáze 23 nechávala na schválení vždy porovnání vedle sebe; podle tohoto zadání se bez `cae.visual_diff` porovnávač úplně skryje a schvalovatel vidí jen novou revizi. (3) CAE účet s vypnutým ticketingem zůstává na `/cae` s vysvětlující kartou (jinou stránku nemá). (4) E2E testy modulů z fáze 23 nahradil `phase25.spec.ts`. **Známé omezení:** konfigurace je globální pro instanci (jedna instance = jeden zákazník). Testy: unit 288 (+4), E2E 43 ✔ / 1 přeskočen. |
| 26 | 2026-10-31 | Zadání bylo opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu a fáze 26 doplněna. Fázi 25 nasadil uživatel (`2fcab9b`, ověřeno). Remotion **4.0.536** (připnuto přesně, `remotion`/`@remotion/player`, `@remotion/cli` jako dev). Odchylky: (1) Remotion 4 nemá příkaz `preview` → `video:preview` = `remotion studio`. (2) Remotion bundluje vlastním webpackem → alias `@` v `remotion.config.ts`; Tailwind uvnitř videa neplatí, styly jsou inline (`src/remotion/theme.ts`); písmo přes `var(--font-sans, …)` se záložními fonty uvnitř `var()` (jinak patkové písmo v renderu). (3) `LogoMark` má výchozí `fill` pro použití bez CSS aplikace. (4) Video nemá zvukovou stopu – přehrávač má ovládání hlasitosti, ale ztlumení nic nemění. (5) MP4 se do repozitáře nerenderuje (web přehrává kompozici živě v `<Player>`); `npm run video:render` ho vytvoří lokálně. (6) Přehrávač: `LazyPromoVideo` (`next/dynamic`, `ssr: false`) přes `src/components/lazy`, celá šířka Hero pod oběma sloupci; JS úvodní stránky při prvním načtení beze změny (přehrávač je samostatný chunk). Známé: Remotion `<Img>` při přepnutí scény hlásí v konzoli varování `EncodingError: The source image cannot be decoded` (přerušený `decode()`), obrázky se zobrazují správně; npm upozorňuje na neschválený postinstall esbuild z Remotion CLI (funguje i bez něj). **Licence Remotion:** zdarma pro jednotlivce a firmy do 3 zaměstnanců, jinak je nutná firemní licence (remotion.pro) – před komerčním nasazením ověřit. E2E: test úvodní stránky ověřuje, že se video načte a rozběhne. |
| 27 | 2026-10-31 | Zadání fází 27–31 bylo vloženo místo obsahu `docs/PLAN.md` a useklo se uprostřed fáze 29 → plán obnoven z gitu, zbytek zadání dodal uživatel v chatu, fáze 27–31 doplněny. Uživatel: `public/*.mp4` do `.gitignore`; na produkci jen migrace + přírůstkový seed (upsert), produkční `.env` beze změn. Fázi 26 nasadil uživatel (`1c34cce`, ověřeno). Hotovo: modul `enterprise.ai_panel_builder` aktivní (už ne Labs, cesty `/panel-builder`), nové oprávnění `panelBuilder` (technický ředitel, vedoucí údržby, CAE projektant), položka „Panel Builder“ v navigaci; migrace `20261031180000_panel_builder` (enumy kategorie, zdroje dat, stavu projektu, skříně a rozpoznání). Odchylky: (1) `articleNumber` je `@unique` (upsert seedu a deduplikace importu); `breakingCapacityKa` volitelné (skříň, SPD). (2) Navíc `PanelBoardItem.detectedJson` (odhad z fotky pro předvyplnění pickeru) a `fedFromIncomer` (kořen stromu napájený ze vstupu – odliší „nezapojeno“), `PanelBoardProject.analysisMode` a `releasedAt`. (3) „-Q1 až -F12“ je 13 přístrojů, ne 12 – seed drží referenční PDF `domovni-rozvadec-rh1.pdf` (skříň -A1 je projektový parametr). (4) Katalog 48 prvků; ABB přístroje referenčního rozváděče přesně dle PDF, objednací čísla a Pv ostatních řad (Eaton, OEZ, Schneider) jsou orientační ukázková data – před objednáním ověřit u výrobce. (5) Atomizace PDF: text stran čte pdf.js v prohlížeči (vlastní PDF se nejdřív nahraje přes `/api/uploads`), server deterministicky páruje objednací čísla (ABB, Schneider A9…, PCSCHEMATIC) a z typu/popisu odvodí kategorii, póly, In, charakteristiku, IΔn; chybí-li Pv, odhad dle IEC tabulek (zdroj `IEC_ESTIMATE`). Známá čísla se nepřepisují. Gemini napojí fáze 28. (6) Fotka PB-001 je SVG generované kódem (`mock-graphics/panel-photo.ts`) v geometrii DIN lišt (`lib/panel-builder/layout.ts`), -F6 pod odleskem (nerozpoznán), -F9 částečně. (7) `docker-entrypoint.sh` spouští `npm run db:panel-builder` (jako `db:demo-docs`) → nasazení doplní katalog a PB-001 samo. Opravena chyba filtru katalogu (zpožděné hledání přepisovalo mezitím zvolený filtr). E2E: vlastní `panel-builder.spec.ts`, ve `phase25.spec.ts` místo „AI Labs“ přepínač Panel Builderu. Hlavička se při 1440 px zalamuje do dvou řádků (víc položek navigace). |
| 28 | 2026-10-31 | `src/server/services/geminiPanelService.ts`: REST `generateContent` (bez SDK, hlavička `x-goog-api-key`, strukturovaná JSON odpověď podle schématu, timeout 90 s) pro analýzu fotky (`GEMINI_VISION_MODEL`), atomizaci PDF (`GEMINI_DATASHEET_MODEL`, PDF jako inline data) a dohledání přístroje. Bez klíče / při chybě / u SVG fotky deterministický demo režim (detekce referenčního rozváděče v geometrii skříně), služba nikdy nespadne; štítek „Demo AI režim“ v hlavičce projektu. Živé volání ověřeno lokálně jedním dotazem (dohledání Hager MBN116 za 3,5 s). Párování detekcí (`lib/panel-builder/matching.ts`): přečtený typ / objednací číslo = VERIFIED (nejdelší shoda), shoda parametrů = PARTIAL s dominantním výrobcem, jinak UNRECOGNIZED; IEC značení v pořadí čtení (Q odpínače, F jisticí/ochranné, K stykače). Krok 1 `/panel-builder/[id]`: fotka s rámečky (klik vybere prvek), DIN lišty v měřítku, Smart Fallback Picker (kategorie → póly/charakteristika → proud, dominantní výrobce a šířka předvoleny, kusy s Pv, „Potvrdit návrh“ u žlutých, po přiřazení skok na další nedořešený) a „Dohledat v datasheetech přes Gemini AI“ (nejdřív lokální katalog, ABB S200 i offline s vypočteným objednacím číslem, jinak odhad IEC; nový kus se trvale uloží). „Nový projekt z fotky“ (vlastní fotka nebo ukázková) s okamžitou analýzou, „Znovu analyzovat fotku“. Seed PB-001 teď vzniká stejnou cestou jako demo analýza (`applyDetections`). Odchylky: dohledání vrací kus k přiřazení jedním klikem (ne automatické přiřazení); kategorie v pickeru je volba (ne přepínač), aby předvyplněný odhad nešel omylem zrušit. Lokální `.env` obsahuje `GEMINI_API_KEY` → E2E vynucuje demo režim (`GEMINI_API_KEY: ""` v `playwright.config.ts`). `docker-compose.yml` předává `GEMINI_*` (prázdné = demo), `.env.example` doplněn; produkční `.env` beze změn.
| 29 | 2026-10-31 | Krok 2 na `/panel-builder/[id]/tree` (vlastní podstránka místo záložky; kroky v navigaci projektu). Logika v `lib/panel-builder/tree.ts` (čisté funkce, testy na referenčním rozváděči): AI návrh stromu (hlavní vypínač na vstup, SPD a chrániče pod něj, jističe pod nejbližší předchozí chránič v pořadí čtení, jističochrániče přímo pod vypínač) a rozvržení jednofázových vývodů na nejméně zatíženou fázi – výsledek odpovídá 1P schématu referenčního PDF (F5 L1, F6 L2, F7 L3 …); neznámý proud se při rozvržení počítá jako 10 A. Hlídač: nezapojený prvek, cyklus, 3P pod jednofázovým uzlem, fáze mimo nadřazený uzel, vývod pod SPD, chybějící fáze, přetížení nadřazeného prvku součtem Ib × SF (Ib = výpočtový proud, jinak In) na nejzatíženější fázi a selektivita jističů (info). Editor: DIN lišty se stavem zapojení (fajfka / žlutě) a výběrem, seznam s filtrem „Jen nepřiřazené“, hromadné „Zapojit vybrané pod →“, strom s inline „Napájeno z“ (nabízí jen rodiče bez cyklu), fází a názvem obvodu, Zpět/Vpřed (i Ctrl+Z / Ctrl+Y, 50 kroků), přečíslování IEC značení v pořadí lišt, průběžné ukládání (400 ms) přes `saveTree` (cykly a duplicitní značení odmítne). Plně zapojený strom → stav TREE_BUILT. Navíc `PanelBoardItem.fedFromIncomer` odlišuje kořen ze vstupu od nezapojeného prvku.
| 30 | 2026-10-31 | Engine `src/lib/thermalCalculation.ts` (čistý, běží v prohlížeči i pro PDF), krok 3 na `/panel-builder/[id]/thermal`. Metodika odvozená z tabulky oteplení referenčního PDF (PanelBuilder) a ověřená unit testem: koncový vývod nese Ib, jinak In · (1 − (T − 30)/80) při vnitřní teplotě (iterace do ustálení), nadřazené prvky součet potomků po fázích, N fázorově; Pv = Pn · (Imax/In)², u chráničů po pólech (L1–L3 + N); redukce Pv · SF²; SPD a přístroje bez proudu jen konstantní ztráta (Pconst). Ae podle IEC TR 60890 (strop 1,4 / zakrytý 0,7, volné stěny 0,9, zakryté 0,5; nástěnný = zakrytá záda, zapuštěný = jen čelo volné), Δt0,5 = k · P^0,804, Δt1,0 = c · Δt0,5. **Odchylka / omezení:** konstanty k (obr. 3/4) a c (obr. 5) jsou aproximace křivek normy (k = 0,4498 / Ae kalibrováno na referenční rozváděč, c = 1 + 0,12 · ln(1 + h^1,35/Ab)), ne odečet z tabulek – referenční případ sedí (42,4 °C, 17,75 W, L1 31,3 A, N 6,8 A), u jiných skříní jde o inženýrský odhad. Verdikt podle teploty pod stropem vs. limit 70 °C (zadání); navíc varování nad 55 °C (běžný limit okolí modulových přístrojů), při nesymetrii fází > 20 % a u prvků bez katalogových dat. UI: vstupy skříně (rozměry, instalace, materiál, IP, okolí, SF, ztráty vodičů) s živým přepočtem a autosave, KPI, chladicí plochy, teplotní křivka podle výšky (SVG, okolí a limit), fázová bilance, inženýrská tabulka s editací Ib koncových vývodů. Materiál skříně se do výpočtu nepromítá (IEC TR 60890 ho nerozlišuje), slouží pro dokumentaci.
| 31 | 2026-10-31 | Krok 4 `/panel-builder/[id]/documentation`: 6 listů A4 (černá na bílé, rohové razítko projekt / zákazník / výrobce / datum): 1 titulní strana a obsah · 2 výkres osazení (SVG v mm z geometrie DIN lišt, modré hřebenové propojky od nadřazeného přístroje, kóty) + výpis funkcí · 3 jednopólové schéma vykreslené ze stromu (přívod, sběrnice s odbočkami, značky odpínače / jističe / chrániče s toroidem / SPD se zemí / stykače, fáze a počet pólů, svislé popisy obvodů; nezapojené prvky vypsané pod schématem) · 4 kusovník podle objednacích čísel (skříň -A1 dohledaná v katalogu podle modelu) + seznam komponent podle značení s pozicí `/3.n` · 5 výpočet oteplení (stejný engine jako krok 3), technická data, teplotní křivka a fázová bilance · 6 ES prohlášení o shodě (LVD 2014/35/EU, EMC 2014/30/EU, ČSN EN 61439-1/-3, místo pro podpis) a výrobní štítek se značkou CE a QR kódem (na kartu přiřazeného rozváděče, jinak na dokumentaci). „Vytisknout / Exportovat kompletní PDF elaborát“ = tisk prohlížeče (`@page` A4, každý list na vlastní stranu, bez hlavičky aplikace) – ověřeno `page.pdf`: přesně 6 stran. „Propustit dokumentaci do provozu“ vybere rozváděč (`SWITCHBOARD`) v Eldocku; podmínky: všechny přístroje ověřené, strom kompletní, oteplení vyhovuje → projekt COMPLETED, `releasedAt`; karta `/equipment/[id]` ukáže „Pasport rozváděče“ s odkazem na dokumentaci. Odchylky: PDF se negeneruje na serveru (stejně jako revizní protokoly – tisk do PDF v prohlížeči); technická data doplněna obvyklými hodnotami (Form 1, stupeň znečištění 2, Ui 400 V, Uimp 6 kV), před podpisem prohlášení je ověří výrobce rozváděče. Všechny fáze 27–31 hotové; nasazení: migrace se aplikuje při startu kontejneru, katalog a PB-001 doplní `npm run db:panel-builder` v entrypointu (upsert, nic nemaže).
| 32 | 2026-10-31 | Zadání opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu, fáze 32 doplněna. Opravena tabulka stavů fází 27–31 (pomocný skript místo přepnutí stavu připisoval „✅ |“ na začátek souboru; commit `9387070`). Mix výrobců: hodnota `MIX` = „⚡ Různí výrobci / Auto-detekce AI“ (výchozí v novém projektu, uložená v `dominantManufacturer`); prompt Gemini (`photoPrompt`) u MIX vyžaduje určit výrobce u každého modulu (logo, páčky, formát typu), u konkrétní značky ji jen upřednostní; analýza už nepřepisuje převažujícího výrobce projektu odhadem AI. Párování: výrobce přečtený u modulu má přednost a omezuje kandidáty, převažující výrobce jen řadí; názvy výrobců se normalizují (`normalizeManufacturer`: EATON/Moeller → Eaton, Schneider Electric → Schneider …). Picker: záložky Všichni/ABB/EATON/OEZ/SCHNEIDER/HAGER/SALTEK/FINDER teď nabídku filtrují (dřív výrobce jen řadil) – výběr platí jen pro daný modul; výchozí záložka = výrobce přečtený u modulu, jinak převažující výrobce, u MIX „Všichni“. Dokumentace: sloupec Výrobce i v seznamu komponent, výrobce pod typem v 1P schématu, na štítku „Různí výrobci“, není-li co uvést. Katalog +9 prvků (Hager MBN/CDA/SBN, Saltek SLP/FLP, Finder 22.32/40.52 – orientační ukázková data), na produkci je doplní seed při startu. Navíc odstraněno varování buildu: čtení vzorových PDF (`readStoredFile`) má `turbopackIgnore`, Turbopack už netrasuje celý projekt. Noark a Schrack jsou v nabídce nového projektu, v katalogu zatím nejsou (doplní dohledání / import PDF). |
| 33 | 2026-11-01 | Zadání opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu, fáze 33 doplněna. Předtím nasazena fáze 32 + oprava Docker buildu (OOM na serveru s 2 GB RAM: build bez kontroly typů `ELDOCK_SKIP_BUILD_TYPECHECK=1`, na serveru se souhlasem uživatele 2 GB swap). **Konfigurátor** (`lib/panel-builder/configurator.ts`, `ItemConfigurator`): seznam „Odpovídající kusy z katalogu“ zrušen (i `getPickerCatalog`, `pickerCandidates`); každý klik (výrobce, kategorie, parametr) zavolá `configureItem` → nejbližší přesný kus (shoda výrobce, kategorie, pólů a určujících parametrů; šířka, Icn, svodičový proud a cívka jen řadí), jinak se uloží odhad IEC (`CFG-<výrobce>-<popis>`, zdroj `IEC_ESTIMATE`, znovu použitelný); prvek VERIFIED, konfigurace v `PanelBoardItem.configJson`; změna kategorie s jiným prefixem (F → K) přečísluje projekt. Karta „Přiřazený přístroj“ (typ, objednací číslo, šířka, Pv, štítek „odhad IEC“), ruční typ (`customTypeCode`, propsán do stromu, oteplení i dokumentace) a popis obvodu, dohledání přes Gemini rovnou přiřadí. Parametry podle kategorie přesně dle zadání (relé jako nová dlaždice; RCBO 1P+N 1M i 2M). **Výběr:** jantarový modul se štítkem „▼ UPRAVUJETE“ (varianta `edit` v `DinRails`, strom zůstává u vícenásobného výběru), na fotce ostatní rámečky 30 %, vybraný žlutý 3px s jmenovkou „-F1 · 3M“. **Geometrie:** `mergeItems` (2–4 sousedé vpravo, sjednocený rámeček, potomci ve stromu přejdou na sloučený prvek, přečíslování; známá kategorie se rovnou nastaví jako vícepólová – 3× 1P B10 → S203-B10), `splitItem` (poměrné rozdělení rámečku, díly jako 1P stejných parametrů), chytré sloučení při volbě širších pólů (checkbox, výchozí zapnuto); prompt Gemini výslovně hlídá spojené páčky / hrazdičku. **Model:** migrace `20261101090000_panel_builder_configurator` – katalog `spdType`, `surgeCurrentKa`, `contactConfig`, `coilVoltage`, `relaySubtype`, `moduleSubtype`; prvek `configJson`, `customTypeCode` (typ a citlivost chrániče už byly). **Katalog 386 prvků** (`prisma/seed-catalog-generated.ts` + ruční seznam, duplicity podle výrobce+typu / obj. čísla): ABB 119, Eaton 60, OEZ 54, Schneider 53, Hager 49, Noark 15, Elko EP 11, Finder 7, Saltek 6, Mean Well 5, Schrack 4, Hakel, Orno, Pollock. Objednací kódy dopočítané jen u veřejných vzorů (ABB S200 `2CDS25…`, SD200 `2CDD28…`, Schneider iC60N `A9F0…`), jinde = typové označení; Pv typické hodnoty – vše orientační, před objednáním ověřit. **Odchylky:** Bonega je v nabídce výrobců, ale v katalogu nemá prvky (nepodařilo se ověřit sortiment) – konfigurátor pro ni vytvoří odhad IEC; Hager RCBO pojmenované popisně (`ADA B16 30mA A`), protože jejich objednací kódy neznáme. Při konfiguraci se po každém kliku obnoví stránka (router.refresh) – na pomalém připojení může dlaždice krátce problikávat. |
| 34 | 2026-11-01 | Zadání opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu, fáze 34 doplněna. **Vision Analyzer 2.0** (`geminiPanelService.analyzePanelPhoto`): fáze A (`RAILS_PROMPT`) vrátí stav zakrytování a rámečky jen osazených DIN lišt (prompt výslovně zakazuje PE/N svorkovnice, prázdné lišty a žlaby; lišty pod 2 % výšky / 5 % šířky se zahodí); fáze B vyřízne každou lištu přes `sharp` (přesah max(15 % výšky lišty, 4 % výšky fotky) nahoru i dolů, 2 % do stran, JPEG 90 %, respektuje EXIF otočení) a pošle ji zvlášť s promptem `railPrompt` – odkrytovaný = počítání šroubků, spáry a hrazdičky (3 spojené moduly = 1× 3P, 4M s „T“ = 4P RCD), zakrytovaný = kalibrace w_1M a `totalModules`; souřadnice se přepočítají do celé fotky (`toPhotoBox`). Chybí-li do `totalModules` moduly, doplní se vpravo jako nerozpoznané 1M pozice („doplněno – AI modul vynechala“). Počet lišt projektu = nalezené lišty, `PanelBoardProject.coverState` (migrace `20261101150000_panel_cover_state`). Bez lišt z fáze A pojistka analýzou celé fotky (jednoprůchodový prompt), bez klíče demo. Režim z UI (Auto / Odkrytovaný / Zakrytovaný) přebije detekci zakrytování. Fyzická šířka z fotky má nově přednost před šířkou katalogového kusu. **Kompaktní přístroje:** póly „2x1P“ (dvojitý jistič, 2 jednofázové vývody), dlaždice ⚡ 2×1P Duální (1M), ⚡ 1P+N Kompakt (1M), ⚡ 3P Kompakt (2M) a řádek „Šířka v modulech (ručně)“ 0,5–6M u všech kategorií; 2×1P jde rozdělit na 2 obvodové větve (2× 0,5M, každá 1P stejných parametrů). **Správa lišt:** „+ modul“ na konci lišty (rámeček navazuje na poslední přístroj, u prázdné lišty z geometrie skříně), „Smazat prvek“ (potomci ve stromu přejdou na jeho rodiče), „Smazat celou lištu“ (lišty pod ní se posunou), „Přidat DIN lištu“, vše s přečíslováním; tečkované 1M dělení ve vícemodulových rámečcích na fotce. **Katalog 403 prvků** (+17 kompaktních: ABB SN201 L, DSN201 M, Eaton PLN6, OEZ OLI; Hager / Schrack / Noark 2×1P a 3P ve 2M pojmenované popisně „… kompakt“, protože jejich objednací kódy neznáme). Seed katalogu běží v jedné transakci (403 upsertů ~1,5 s – rychlejší start kontejneru). `sharp` 0.35.5 přidán jako přímá závislost (stejná verze, jakou už instaluje Next.js; v Dockeru se nainstaluje linuxová binárka). **Neověřeno:** živá dvoufázová analýza přes Gemini na reálné fotce (testy používají mock odpovědí a skutečný `sharp`) – stojí 1 + N volání Gemini 2.5 Pro na fotku. |
| 35 | 2026-11-01 | Zadání opět vloženo místo obsahu `docs/PLAN.md` → plán obnoven z gitu, fáze 35 doplněna. **Model v metrech:** zóny konceptu jsou obdélníky `{x, y, w, h}` v metrech od osy A1 (místo buněk `B2`–`B5`; ruční zadání polí a šablony se na metry převádí), zařízení mají `pos` v metrech + `roomKey` (místo průsečíku `at`). Nový půdorys Studia má **jednotné měřítko** v ose X i Y (`planFrame`, vystředěný obvod); stávající patra dál přes `EXISTING_FLOOR_FRAME` (70/70/1050/690 px = 66 × 42 m), takže piny starších pater sedí. **Měřítko** = skutečné měřítko obrazovky (96 dpi, plátno max. 8000 px, větší měřítka se u velkých objektů vypnou) + volba „Celé“ (výchozí, přizpůsobí šířce); měřítko výkresu v razítku se mění s výběrem 1:100–1:1000 (přidáno 1:1000). **Areál:** rozměr X × Y editovatelný i u stávajícího závodu – uložení přepočítá polygony a štítky budov (metry zůstanou) a nastaví `campusViewBoxH` podle poměru stran; obecné kulisy areálu (`getSiteLayout`) se přizpůsobí výšce mapy, ručně kreslené kulisy JBC/LBC jen pro 1000 × 700. Úchyt budovy v areálu přichytává velikost na rozteč sloupů (mění počet os). Minimální velikost budovy na mapě 1 % (dříve 4 %). **Typy zón:** `PRODUCTION, OFFICE, ELECTRICAL, STORAGE, WORKSHOP, FACILITIES, CORRIDOR` (dřívější `HAZARD` = `ELECTRICAL`); styl zóny se ukládá do SVG (rgba výplň, šrafa jako samostatný obdélník). Vrata jsou nově azurová i v půdorysech ze seedu (projeví se po `npm run db:seed`). Spotřebiče a nářadí (`PORTABLE_TYPES`) se přiřazují k místnosti, pozice = kotva v rohu místnosti (řady po 1,5 m); u stávajících pater se místnosti čtou z uloženého SVG (`extractFloorplanRoomsWithLabels`). Komponenty rozděleny: `PlanViewport`, `ZoneStep`, `PlacementStep`, `studio-ui`; `GridCanvas` odstraněn. **Ověření:** `npm run verify` OK (357 unit testů), E2E `accounts-studio` + `phase19` – Studio scénáře OK; **známé:** E2E „revizní technik VTZ…“ padá i na čistém `main` (tlačítko „Zobrazit vše s propadlou“, nesouvisí se Studiem – pravděpodobně datum revizí v seedu vs. dnešek). Pozor při ručním testování: dva dev servery se sdíleným `NEXT_DIST_DIR=.next-e2e` a různým prostředím si přepisují cache a `/studio` se pak přenačítá dokola – ruční server spouštět s vlastním adresářem (např. `.next/shots`). |
| 36 | 2026-11-01 | **E2E VTZ:** příčinou nebyla data, ale studený dev server (stránka se při kompilaci přenačítala) → `e2e/global-setup.ts` nejdřív v prohlížeči zahřeje hlavní trasy. Data plánovače („tento / příští měsíc“) se počítají od pražského dne (`src/lib/month-window.ts`, test pro každý den 2 let) – dřív UTC den mohl kolem půlnoci posledního dne v měsíci spadnout do minulosti. **Konfigurátor:** bez `router.refresh` po kliku (akce sama revaliduje), klíč bez katalogového kusu, debounce 250 ms, optimistický náhled na DIN liště. **Studio:** migrace `floor_studio_layout`; stávající patro jde v kroku 2 upravit (JSON, u starších pater dopočet ze SVG v `src/lib/studio-layout.ts`), piny se přepočítají přes metry. **Bonega:** 97 položek, popisné typové kódy `BONEGA …` (objednací kódy ověřit u výrobce); testy chybějící značky používají Legrand. **Vision Analyzer:** fáze B přes `mapWithConcurrency` (3). **Červenka:** migrace `attachment_original_url` + „Zobrazit originál bez zákresu“. **Remotion:** `InlineSvg` místo `<Img>`. **Oteplení:** materiál násobí Ae v poměru ocel 1,0 : nerez 0,95 : plast 0,88, normováno na referenční plastovou skříň (kalibrace K_AE, PB-001 dál 42,4 °C; kovové skříně vycházejí o něco chladněji). **Zámek účtu:** `ELDOCK_LOCK_ACCOUNT_SWITCHER=1` – účet z podepsané přihlašovací cookie, přepnutí odmítne server, v hlavičce odznak 🔒. |
| – | 2026-11-01 | Plán převeden na rotující. Původní plán archivován, trvalá paměť projektu konsolidována do `CLAUDE.md`. |
| 37 | 2026-11-01 | Zadání fází 37 a 38 vložené do sekce B (zase přepsalo sekce C a D) → plné znění v `docs/archiv/ZADANI-faze-37-38.md`, plán obnoven z gitu. **Selecty:** `color-scheme: dark` + tmavé `option`/`optgroup` v `globals.css`. **Katalog:** ABB SHD203/25·40·63, SHD204/40, SH201/SH203 B+C 6–32 A (vč. 13 A), FH202 AC/A (SD203/25 a FH204 už byly); objednací kód = typ. **Gemini:** pravidla červené páčky, B vs. C a těsných rámečků v promptu, výřez JPEG 95 % 4:4:4 bez zmenšení, pojistka `switchDisconnectorFromText` (SHD203/25 → odpínač 25 A), doplnění „vynechaných“ modulů jen uvnitř výřezu lišty. **Krok 1:** posun / levá / pravá hrana vybraného rámečku myší (`setItemBox`), funkce obvodu nahoře + 13 rychlých štítků, popis na dlaždici lišty, ruční přepis značení (unikátní v projektu). **IEC:** prefixy podle kategorie, referenční PB-001 přeznačen na -Q1, -FV1, -FI1, -F1…-F10 (testy přemapovány); měření (elektroměr) je v katalogu kategorie OTHER → -X (samostatná kategorie pro -U neexistuje). **Krok 2:** nový `proposeTree` (pravidlo DIN lišty; odchylka: jistič na liště bez chrániče jde pod „samostatný“ chránič z vyšší lišty, jinak pod -Q1 – jinak by referenční PB-001 ztratil ochranu chráničem), 3P/4P vypínač a chránič „L1,L2,L3,N“, 2P chránič „Lx,N“, střídání fází ve skupině; hlídač bez chyby přetížení (zatížení skupiny jen jako informace `groupLoad`), chyby jen nezapojený prvek / cyklus / 3P pod 1P; UI = skupinové karty s fázovými tlačítky a přepínačem „Napájeno z“; krok přejmenován na „2. Zapojení a hierarchie“. **Oprava z fáze 36:** regex v `InlineSvg` (Remotion) obsahoval místo `\b` řídicí znak – SVG ve videu se nezvětšovalo. |
| 38 | 2026-11-02 | **Rastr v metrech:** `GridSpec.widthM/depthM`, osy po rozteči a poslední na hraně (`axisMeters`), počet os bez limitu, popisy A…Z, AA…ZZ; renderer kreslí skutečné polohy os, u hal nad 4 000 sloupů jen osy, popisky os se ředí. Rozteč 6 / 12 m / vlastní v detailu „Pokročilé“. Úchyt budovy v areálu mění rozměr po 1 m až do velikosti areálu. **Více budov:** koncept = pole budov (`StudioConceptDraft`), `saveStudioConcept` uloží vše v jedné transakci (první budova případně založí závod); napájení přes budovy konceptu není podporované (jen ze závodu nebo vlastní budovy). Šablona budovy mění aktivní budovu, novou budovu přidává „+ Přidat další budovu“ (odchylka od „klik na šablonu = nová budova“ – nechtěné zakládání budov). **Patra:** přejmenování stávajících (`floorRenames`). **Krok 2:** šablony rozdělení patra odstraněny; historie konceptu (30 kroků, slučování změn do 500 ms, tažení = 1 krok, Ctrl+Z / Ctrl+Y). **Krok 3:** accordion místnost → kategorie (počty v místnosti, ostatní značky 20 %) → „Vytvořit nové“ (produktové banery, vlastní prefix tagu, vložení tlačítkem do místnosti nebo klikem do rastru) / „Upravit stávající“ (koncept: úprava, přesun, smazání; uložená zařízení: tag, název, napájení, vývod, místnost přes `equipmentEdits` – mazání a přesun uložených jen v kartě zařízení). **Oprava:** fáze B Vision Analyzeru – výřezy lišt postupně, paralelně jen dotazy Gemini (test padal na souběhu). |
| 39 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-39.md`, plán obnoven z gitu. **Rastr:** sloupy = středové křížky (±4 px, `PILLAR_COLOR`) v jedné cestě `data-pillars` (limit pro vykreslení zvednut na 20 000 sloupů). **Nabídka:** `src/lib/studio-menu.ts` (přejmenování kategorie, název / ikona / prefix dlaždice, smazání, vlastní dlaždice, obnovení výchozí); bez migrace – existující tabulka `TenantSetting`, klíč `studio.menu` (JSON s `updatedAt`, starší verze nepřepíše novější), v prohlížeči `localStorage` `eldock.studio.menu` (vyhrává novější). Rozepsané změny jdou do localStorage hned, do tenantu po „Hotovo“; nová dlaždice hned. Prefix dlaždice („KAV“) → tagy KAV01, KAV02… **Součty:** skupina = kategorie + název přístroje bez místnosti a tagu (`deviceBaseName`), ikona podle dlaždice se stejným názvem. Uložený půdorys (jen patra s `studioLayoutJson`) se při uložení konceptu překreslí se skupinou `data-room-inventory` (`refreshFloorInventory`) pro každé dotčené patro; Studio ji z uloženého SVG odstraní a kreslí živé štítky. Zařízení přidaná / smazaná mimo Studio štítky v SVG neaktualizují (až další uložení patra ve Studiu). **− / +:** jen u spotřebičů a nářadí; + = další tag v řadě podle posledního kusu (`nextInSeries`), stejné napájení a okruh; − ubere poslední nový kus (uložené se mažou v kartě zařízení). E2E nabídku mění v e2e.db – při opakování testu bez nové DB by první kroky selhaly. |
| 40 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-40.md`, plán obnoven z gitu. **Mapa závodu:** `/studio` u závodu s budovami otevře jen mapu (`CampusPlacementMap` s `onSelectBuilding`, budovy jako tlačítka) a výzvu; žádný koncept nové budovy. „✏️ Upravit areál / + Přidat budovu“ = dosavadní 3krokový průvodce (nově i posun / velikost stávající budovy klikem na ni v mapě), „🆕 Vytvořit nový závod od nuly“ = průvodce novým závodem; závod bez budov a `?new=plant` jdou rovnou do průvodce. **Pohled budovy:** záložky pater nahoře (výchozí 1. NP), levý panel se 3 režimy: Zařízení a napájení (výchozí, `PlacementStep`), Místnosti, zóny a vrata (`ZoneStep`, uložené patro se otevře automaticky), Budova a podlaží (přejmenování, nové NP / PP, rozměr X × Y = obrys v areálu + rastr všech pater, místnosti za obvodem se oříznou; poloha v areálu tažením). „Uložit změny patra“ zůstane ve Studiu nad stejnou budovou; neuložené změny hlídá počítadlo a potvrzení při návratu na mapu; nezměněné rozvržení stávajícího patra se neposílá. **Zařízení:** uložená jde přesunout (pin v metrech, `equipmentEdits[].pos`), přeřadit do jiné místnosti (přesun na kotvu místnosti), smazat s potvrzením (`equipmentDeletes`; smaže se až při uložení po druhém potvrzení, kaskádově i s historií; odmítne se zařízení s otevřeným požadavkem na změnu nebo s odběry, které se nepřepojí / nesmažou) a „−“ u skupiny označí ke smazání poslední uložený kus (toast „Vrátit“). Stávající budova má volitelné `map` (nový polygon a štítek). Ikony štítků podle klíčových slov (`emojiHint`: konvice 🫖, tiskárna 🖨️, mikrovlnka 🍲…). **Seed:** `prisma/seed-demo-plant.ts` – rozvržení 9 pater v metrech (rozměr = obrys budovy v areálu: Hala A 152 × 76, Hala B 136 × 68, Energetika 56 × 36, Sklad 88 × 64, Administrativa 52 × 56, Lakovna 160 × 100 m), místnosti bez překryvů pokrývají celou plochu (test), všech 7 typů zón, vrata na obvodu, piny všech demo zařízení v metrech, +92 zařízení (CNC-01–03, ROB-01/02/08, VZT-02, NAB-VZV1, BAL-01, spotřebiče a nářadí podle zadání s napájením a platnou revizí), obecné názvy kusů (`DEMO_RENAMES`, „Kávovar De'Longhi“ → „Kávovar“). Plný seed patra rovnou vytvoří s JSON; `npm run db:demo-plant` (entrypoint, po `db:demo-docs`) proběhne jednou (`TenantSetting` `demo.plant-layout` = 40), patro s vlastním rozvržením ze Studia (JSON bez příznaku `demo`) nechá být, nic nemaže; ověřeno na kopii dev.db (9 pater, 92 nových, 44 přemístěných, 14 přejmenovaných; druhý běh nic). **Oprava:** název souboru revizní zprávy v seedu (regex `[^w-]` bez zpětného lomítka → všechny zprávy se přepisovaly do jednoho souboru). |
| 41 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-41.md`, plán obnoven z gitu. **Model:** migrace `registered_company` – `RegisteredCompany` (enum `ProductScope`, údaje dle zadání, `passwordHash` scrypt v `src/server/password.ts`, `termsAcceptedAt/termsVersion`, `creditsRemaining`, `plantId`), `PanelBoardProject.companyId`; navíc (odchylka, nutné pro oddělení) `User.homePlantId` a `User.companyId`. **ARES:** `GET /api/ares?ico=` (veřejné, kontrola IČO mod 11, timeout 6 s, 404/503 → ruční vyplnění), převod v `src/lib/ares.ts`; formulář doplní údaje sám po 8 číslicích nebo tlačítkem „Doplnit z ARES“. **Panel Builder:** trasy přesunuty do skupiny `(pb)` s vlastní lištou `PanelBuilderHeader` (firma + IČO, kredity, „Firemní údaje do razítka“ = `/panel-builder/company`, Odhlásit); přihlášení firmy = cookie `eldock-pb` s podpisem `pbc:<id>` (`proxy.ts`: bez ní `/panel-builder/*` → `/panel-builder/auth`, token Panel Builderu neplatí ve správě závodů a naopak, API jen nahrání a čtení fotek); `/panel-builder/auth` = Přihlášení (+ „Vyzkoušet předvyplněný Tester účet“, `tester@eldock.cz` / `Tester2026!`) a Registrace firmy (Tester) s povinným souhlasem (doslovné znění, modal VOP). Dotazy i akce jen nad projekty firmy (`guardProject` / `guardItem`), 1 kredit = 1 nový projekt (5 po registraci, Tester 50), propuštění do provozu jen do vlastního závodu firmy (Tester = demo Jablonec). **PDF:** výrobce = aktuální údaje firmy (`companyManufacturer`): blok na titulní straně (název, IČO, DIČ, sídlo, odpovědná osoba + TIČR, telefon, e-mail), razítko všech 6 listů (výrobce + „Zpracoval“), prohlášení „Výrobce … na svou výhradní odpovědnost prohlašuje“ s podpisem odpovědné osoby, štítek CE s názvem a sídlem; tisk až po zaškrtnutí potvrzení kontroly. **Správa závodů:** odkaz Panel Builder z hlavní navigace odstraněn; `/register-plant` – firma (PLANT_MANAGEMENT) + závod (kód z názvu firmy) + Technický ředitel v jedné transakci a rovnou přihlášení; registrovaný uživatel se přihlašuje heslem firmy (sdílené demo heslo pro něj neplatí), nemá přepínač účtů, vidí jen svůj závod (`plantAccessWhere`, layouty `/plant/[plantId]` a `/equipment/[id]` → 404) a podúčty dědí firmu; demo nevidí závody registrovaných firem. **Úvodní stránka:** sekce „Produkty“ se dvěma kartami. **Seed:** `seedTesterCompany` (v `db:panel-builder`, tedy i na produkci) založí firmu Tester a přiřadí jí projekty bez firmy (PB-001 i projekty založené před fází 41). |
| 42 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-42.md`, plán obnoven z gitu; fáze 40 a 41 označeny jako nasazené. **Krok 1:** fotka bez rámečků (`PhotoViewer`: kolečko / +/− / dvojklik = zoom, tažení = posun), ruční úprava rámečků (`setItemBoxAction`) i dlaždice `DinRails` odstraněny; hlavní plocha = `VectorPanel` s `VectorModuleSymbol` (šroubky po modulech, páčky s hrazdičkou, červená páčka odpínače, [ T ] + okénko chrániče, modré T jističochrániče, kazety SPD s terčíky a bleskem, stykač / relé / zdroj), texty `symbolTexts` (-F4 · ABB · B16 · S201-B16, chránič „A 40A 0,03A“, odpínač „(40A)“), štítek funkce dvojklikem, přepínač „Tmavý editor (CAD Dark)“ / „Výkres osazení“. Optimistický náhled konfigurace se hned propíše do symbolu (`deviceWithConfig`). **Databáze prvků:** našeptávač v konfigurátoru (`searchCatalog`, filtr výrobce → kategorie → póly, Pv a objednací číslo), výběr kusu zahodí starou konfiguraci (`configJson = null`); bez výsledku „Dohledat přes Gemini AI a uložit do databáze“ (nově `upsert`); detekce z fotky nesou u chráničů `rcdType` a `rcdSensitivityMa` a párují se podle nich. **Krok 2:** lišta „Hlavní přívod rozváděče“ (⬇ shora / ⬆ zespoda – migrace `panel_incomer`, `PanelBoardProject.incomerFrom`; 🎯 klik na přístroj nebo roletka 3P/4P), drag & drop přístroje na přístroj (`dropOnto`: na jistič skupiny = vedle něj pod chráničem, chránič na SPD = průchozí uzel bez varování, cyklus a přesun kořene odmítne), výběr Ctrl/Shift a „▣ lišta“, „🔗 Připojit jističe vpravo na této liště“ u chráničů (`connectRightOf`), panel vybraného prvku (fáze, název, roletka „Napájeno z“ jako přístupná alternativa), modré spojnice + hřebenové sběrnice (`wiringPaths`). AI návrh bez odpínače vezme první 3P/4P přístroj na 1. liště (`chooseRoot`), takže vždy zapojí 100 % prvků. Odchylka: skupinové karty kroku 2 nahradil panel vybraného prvku a seznam hlídače; „Výkres osazení“ je režim plátna, PDF výkres v kroku 4 zůstal beze změny. |
| 43 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-43.md`, plán obnoven z gitu. **Model:** migrace `panel_design_mode` – `PanelBoardProject.designMode` (PHOTO / DESIGN), `railModulesJson` (kapacita každé lišty), `enclosureId` + `enclosurePmaxW`; `RegisteredCompany.logoUrl / stampUrl`; `CatalogComponent.archetypeId / facetsJson / externalSource`; nové `PanelEnclosure` (katalog rozvodnic) a `CatalogRelation` (příslušenství). **Návrh od nuly:** modal „Nový projekt rozváděče“ s přepínačem 📐 od nuly (výchozí) / 📷 z fotky; návrh = 1× 12M, stav RECOGNIZED, bez analýzy (1 kredit), plátno bez fotky, krok 1 „1. Návrh osazení“. U každé lišty pás ◉ aktivní lišta · 8/12/14/18/24/36M · − / + · ↑ ↓ · 🗑 (`lib/panel-builder/rails.ts`, `setRailCapacity` / `moveRail` v `services/panel-design.ts`), „➕ Přidat další DIN lištu (řadu)“, indikátor `formatRailSummary`. **Kaskáda:** `CascadePicker` (27 výrobců `brands.ts` s počty z DB a hledáním → kompaktní lišta + „🔄 Vybrat jiného výrobce“ → kategorie vč. nové „Svorky / Hřebeny / Příslušenství“ (`ACCESSORY`, 10 podtypů) → parametry) pro úpravu vybraného přístroje i pro paletu; `PlacementCard` = živý vektorový náhled, typ, MPN a Pv (`previewConfig`, bez zápisu), příslušenství z vazeb, HTML5 drag & drop na lištu (pozice podle středů přístrojů, modrá značka) a 1× / +3× / +6× (`placeComponents` vloží jen co se vejde, přečísluje značení). **Skříně:** `EnclosurePicker` v kroku 1 i 3 – výrobce (8) a montáž, `fitEnclosures` (řady ≥ lišty, moduly na řadu ≥ nejširší lišta, celkem ≥ obsazeno), rozměry, IP, P_max, rezerva; výběr propíše model, rozměry, instalaci, materiál, krytí a P_max (krok 3 ukáže P_max vs. ztráty, kusovník bere skříň z katalogu). Matice standardních rozvodnic 12–144M (14 řad výrobců, 150 skříní, orientační rozměry) v `db:panel-builder`. **Logo a razítko:** profil „Firemní údaje a razítko“ – nahrání přes `/api/uploads` (document), razítko vyčištěné z bílé na průhledné (`whitenToTransparent`, Canvas); logo na titulním listu, v rohovém razítku 6 listů a na štítku CE, razítko u podpisu prohlášení o shodě a v novém bloku „Protokol o kusové zkoušce“ (List 6). **Popisky 1:1:** `/panel-builder/[id]/labels` (odkaz v hlavičce projektu): A4 bez okrajů, kalibrace 100 mm, pásy po lištách (17,5 / 18 mm, výška 9 / 12 / 15 mm, barvy fází L1/L2/L3 nebo skupin, dělení podle 190 mm), štítky 17 × 9 mm, export CSV (středník, BOM) a XLSX (vlastní zápis bez závislostí `lib/xlsx.ts`). **Externí databáze:** `npm run catalog:sync` čte JSON záznamy `catalog_upsert_product` ze SQL seedů `ai-panel-builder/db` (nebo export), ukládá export `prisma/external-catalog/catalog.json` (v Gitu, 2 302 záznamů) a dávkově upsertuje 1 979 přístrojů, 282 skříní a 3 153 vazeb (pravidla z `014_component_relations.sql`); MCCB a skříně bez rozložení řad přeskočí, vlastní katalog Eldocku se stejným objednacím číslem nepřepíše; čísla MPN bez prefixu dostanou `VÝROBCE:`. Entrypoint (`db:panel-builder`) import pustí jen při změně otisku (`TenantSetting catalog.external-sync`). Odchylky: výrobci bez dat v DB mají kartu „odhad IEC“; P_max a rozměry standardní matice jsou orientační (přesné hodnoty nese externí DB); „Výkres osazení“ PDF v kroku 4 beze změny. |
| 44 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-44.md`, plán obnoven z gitu. Čistý výpočetní modul `src/engine/floorplan-bridge.ts` (nová složka `src/engine` podle zadání, bez UI a Prismy) + `FLOORPLAN_SPEC.md` v kořeni. **1.** `calibrateFloorplanScale`: 1 stěna = jednotné měřítko, 2 stěny = řešení sx² / sy² (zkosený sken), `calculateCableLength` = Manhattan + trasa 300 mm pod stropem k přívodu rozváděče (1 700 mm) a ke zásuvce (300) / spínači (1 050) / svítidlu; `voltageDropPercent` (Cu 70 °C) – světla 3 %, ostatní 5 %, jinak větší průřez + varování. **2.** `resolveSwitchWiring`: tabulka řazení 1 / 5 / 6 / 6+6 (5B) / 6+7, od 4 míst tlačítka + impulzní relé MR-41; `smart_relay` a `bus_loxone` = tlačítka / Loxone Touch Tree a DI / DO (žaluzie 2 výstupy). **3.** `generateCircuitsFromFloorplan`: vyhrazené B16 (≥ 2 000 W), varná deska B16 3P 5x2,5, lednice RCBO B16/30 mA A, EV / TČ 3f + chránič typ B, zásuvky po ≤ 10 vývodech podle místností (dvojzásuvka = 1, v kusovníku zvlášť), světla B10 min. 2 okruhy. **4.** `buildSwitchboardFromCircuits`: hladové vyvážení fází, ≤ 6 okruhů na 4P chránič A bez světel a zásuvek stejné místnosti, N-můstek a hřeben ke každému chrániči, -Q1 / -FV1 T1+T2 / -X1 HLAK, Loxone (Miniserver + Relay Extension + 24 V) / Shelly Pro 4PM, +25 % rezerva a nejmenší skříň z `PanelEnclosure` se ztrátami ≤ P_max; každý přístroj nese `ItemConfig` pro `placeComponents`. Test vzorového domu: 13 okruhů, 5 chráničů, fáze 10,6 / 10,6 / 10,5 kW, 52 M → 65 M → skříň 5 × 14 M (P_max 74 W, ztráty 55,7 W). Odchylky: šířky chytrých modulů a výchozí příkony spotřebičů jsou orientační konstanty (`SMART_MODULES`, `APPLIANCES`); napojení na editor půdorysu a založení projektu z výsledku je navazující krok. |
| 45 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-45.md`, plán obnoven z gitu. Migrace `panel_environment_chips` – `PanelBoardProject.environment` (výchozí INDOOR_DRY), `RegisteredCompany.circuitChipsJson`. **Štítky:** `lib/panel-builder/circuit-chips.ts` – výchozí štítky s presety (Hlavní vypínač 3P 40 A, Chránič 4P, Světla B10, Zásuvky / Kuchyně / … B16, Varná deska 3P B16), „Chránič 1/2“ nahradil jeden číslovaný štítek „Chránič“ (`nextChipLabel`: Chránič 1 → 2, nečíslovaný štítek dostane číslo až při opakování), `CircuitChips` (+ Přidat vlastní, ✎ Upravit štítky: název, číslování, preset kategorie / póly / charakteristika / In, pořadí, smazání, obnovení výchozích); uložení `useSyncExternalStore` nad localStorage + `saveCircuitChipsAction` po 800 ms klidu, novější `updatedAt` vyhrává. Štítky jsou u vybraného přístroje i v paletě nového přístroje. **Pravý panel:** jedna sticky karta (dřívější „Přiřazený přístroj“ + „D. … k osazení“) hned pod funkcí obvodu; u vybraného přístroje `assigned-device` s typem, MPN, šířkou a Pv; „Vložit“ chytře nabídne „Vložit na Lištu N (volno X M)“ nebo „+ Přidat novou lištu a vložit“; ruční šířka, typové označení a dohledání exotického prvku v akordeonu „Pokročilé / Ruční korekce a AI dohledání“; návrh od nuly sousedy při rozšíření nepohlcuje. **Prostředí:** `environments.ts` (5 prostředí, min. IP / IK, teplota okolí 25 / 40 / 35 °C, UV, žhavá smyčka 850 °C + AFDD) – výběr uloží prostředí a teplotu okolí pro oteplení; skříň pod min. IP = odznak + „Vybrat vhodnou skříň (min. IP 54)“ (výběr skříní filtrovaný krytím). **Linter:** `lib/panel-builder/linter.ts` – štítek vs. kategorie, popis vs. póly (synchronizace textu), chybějící / přetížený chránič (> 6 okruhů, podle stromu nebo lišty), rezerva < 20 % (ze skříně, jinak z lišt), smíchaní výrobci na liště (sjednotit na většinového), proud nad hlavním vypínačem a chránič slabší než jistič pod ním; `LinterPanel` nad plátnem, oprava 1 klikem přes stávající akce. Odchylka: synchronizace textu = zrušit ruční typ a znovu přiřadit kus podle parametrů; „Live Sync“ už zajišťoval optimistický náhled z fáze 42. |
| 46 | 2026-11-04 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-46.md`, plán obnoven z gitu. **Model:** migrace `legislation_2027` – `EquipmentDocument` (enum `AttachmentCategory`), `SoftwareBackup` (enum `SoftwareBackupStatus`, unikát zařízení + uzel + verze), `ChangeRequest.safetyImpact` (enum `SafetyImpactLevel`) a `requiresSoftwareUpdate`, `Equipment.batteryPassportJson`, `PanelBoardProject.standardEdition` a `routineTestJson`; vazby na `User` (autor / nahrál). **Uploady:** druhy `attachment` (30 MB, PDF / obrázky / DOCX / XLSX / CSV / TXT → `storage/uploads/attachments`) a `software` (50 MB, ZIP / 7Z / RAR / .zap16–19 / .s7p / .acd / XML / JSON / PAR / BIN / HEX / CSV / PDF → `storage/uploads/software`). **Karta zařízení:** záložka „📚 Návody & Datasheety (N)“ (`DocumentLibrary`: filtr kategorií, karty s komponentou, náhled PDF / obrázku v modalu, stažení, nahrání, smazání) i u lehké karty; interaktivní schéma ukáže u prvku se shodným `componentTag` tlačítko „📄 Otevřít datasheet komponenty“ (`normalizeComponentTag`: K4 = -K4). Záložka „💾 Software & Zálohy PLC“ (`SoftwareBackups`, jen rozváděče a stroje – `hasSoftwareTab`): uzly, zelená ACTIVE karta (verze, autor, platforma, FW, Safety CRC, změna ZM-…), historie s rollbackem a stažením, dialog Minor +0.1 / Major +1.0 s povinným popisem, CRC u bezpečnostního programu (`normalizeChecksum`) a vazbou na změnu; `createSoftwareBackupInTx` archivuje předchozí ACTIVE v transakci. **Červenka a CAE:** krok Poznámka má klasifikaci 🟢 / 🟡 / 🔴 (podstatná změna = varování a priorita Vysoká) a „💾 úprava řídicího SW“ s volitelnou přílohou zálohy (vytvoří se v transakci se změnou, Minor +0.1); ticket CAE ukáže klasifikaci a oranžový úkol „⚠️ Čeká na nahrání aktualizované zálohy SW“, po nahrání zelené potvrzení. **Panel Builder:** `lib/legislation-2027.ts` – 3 edice norem (DBO 61439-3 ed. 2, PSC 61439-2 ed. 3, strojní 60204-1 ed. 3 + EU 2023/1230), výběr v kroku 1 i 4, List 5 (ověření oteplení dle čl. 10.10.4) a List 6 (EU prohlášení, směrnice LVD / EMC / RoHS nebo Nařízení 2023/1230, štítek CE); interaktivní protokol o kusové zkoušce (8 bodů čl. 11, R_iso ≥ 1 000 Ω/V, zkoušející, datum, autosave) vytištěný na Listu 6. **Správa závodů:** LOTO doplněno o OOEZ / OPŘPČ a checklist 5 pravidel (ČSN EN 50110-1 ed. 4), QR štítek s doložkou čl. 10 Nařízení (EU) 2023/1230, hromosvody ČSN EN IEC 62305-3 ed. 3, `BatteryPassportCard` a sekce v revizním protokolu (`lib/battery-passport.ts`). **Seed:** `prisma/seed-legislation-2027.ts` (`npm run db:demo-legislation`, entrypoint i plný seed, značka `demo.legislation-2027`): 11 SVG návodů / datasheetů (R-CNC-04, CNC-04, LIS-01, ROB-03 a PV-M1 s vazbou na -Q1 / -UC2 ve schématu), 9 záloh (R-CNC-04 PLC -A1 v1.0 → v1.1 ACTIVE s CRC 0x8F4A-2C91 a změnou ZM-2025-0007, měnič -U1 v1.0; Safety PLC lisu, KUKA KRC4, HMI, Heidenhain) a pas baterie RZ1 (48 kWh, LiFePO4, SoH 97 %). Odchylky: ukázkové návody jsou SVG (náhled přes `<img>`), zálohy ukázkové XML / JSON; LOTO checklist se neukládá (pomůcka na obrazovce). |
| 47 | 2026-11-04 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-47.md`, plán obnoven z gitu; k fázi přidán požadavek „modulární přístroje Siemens a ventilátory rozváděčů s parametry a datasheety“. **Model:** migrace `catalog_brands_fans_wiring` – `CatalogComponent.datasheetUrl`, `EnclosureFan`, `WiringDevice` (klíč `ABB:<objednací číslo>`), `PanelItemWiring` (prvek + přístroj + místnost + kusy), `PanelBoardProject.railPhotosJson / fanId / fanCount`; enum `EquipmentType.WIRING_DEVICE` (SQLite = text, bez SQL migrace). **Značky:** Finder, Shelly, Mean Well, Dehn, Relpol, Pilz, Weidmüller, Elko EP a Pollmann jsou skryté (`HIDDEN_MANUFACTURERS` + varianty zápisu) v konfigurátoru, katalogu, počtech, AI párování, hledání i importu – řádky v produkční DB se nemažou (odchylka: nevratné mazání nahrazeno filtrem). `ManufacturerLogo` = typografická SVG loga 21 značek (kaskáda, skříně, katalog). **Katalog:** `/panel-builder/catalog` ve 3 krocích (`lib/panel-builder/catalog-groups.ts`, 11 kategorií vč. domovních přístrojů a ventilátorů; dlaždicové filtry póly / charakteristika / In / IΔn / řada; globální `?q=` přes přístroje i domovní přístroje), sloupec Datasheet. **Rešerše** (`prisma/seed-catalog-research.ts`): 48 Siemens (5SY6, 5SV3, 5SU1, 5TL1, 5SD7) a 19 ABB (DS301C B6–C16, EN20/25/40, S201-B2, S203-B16/B20, FH204, free@home SA-M, KNX) s datasheety, chybějící Pv = odhad IEC; skříň ABB CA35R (2CPX052241R9999, 4 × 36 = 144M); 19 ventilátorů (Rittal SK 3237–3244, Schneider NSYCVF, Pfannenberg PF, STEGO FPI). Opravy rešerše proti zadání: CA35R není Z151218, stykače EN mají prefix 1SAE, aktuální aktory free@home jsou řada SA-M, 5SD7414-1 je T1 a 5SD7444-1 T1+T2. **Domovní přístroje:** `npm run catalog:sync` čte i `ai-panel-builder/catalog/wiring/*/facts.json` → export `prisma/external-catalog/wiring.json` (1 906 kusů ABB / Schneider / Legrand), import při změně otisku (`catalog.wiring-sync`); v konfigurátoru jističe sekce „🔌 Domovní instalace obvodu“ (našeptávač, místnost, kusy, − / + / odebrat), tabulka na Listu 4 dokumentace; Studio: kategorie DI „Domovní přístroje“ do místnosti se 7 dlaždicemi s reálnými čísly ABB (vrstva mapy Energetika, lhůta jako pevná instalace). **Vision Analyzer:** prompt bez „1 šroubek = 1 modul“ (těla a páčky, DS301C 1M, smart moduly, svorky), bez doplňování vymyšlených modulů do kapacity lišty, `normalizeDetection` (`detection-rules.ts`: DS301C → jističochránič 1M, EN / ESB → stykač, FH204 → chránič 4P, S201 / S203, KNX / free@home / Loxone, svorky); pravidlo F = 📷 u každé lišty a pod fotkou → `analyzeRailDetail` přepíše jen danou lištu (demo režim jen uloží náhled). **Krok 1:** „➕ Přidat prvek vpravo“ / „📑 Duplikovat prvek“ (`insertNextTo`, nový prvek se vybere), linter jako odznak „⚠️ X doporučení ▾“ s popoverem (skrýt jeden / vše, Esc a klik mimo zavře), smíchaní výrobci jen u MCB / RCD / RCBO. **Oteplení:** `FanPanel` – V = 3,1 · Q / ΔT pro vnitřních 35 °C (Q = ztráty − 5,5 · Ae · ΔT), účinný průtok s filtrem, doporučení nejmenšího vyhovujícího, výběr a počet kusů. **Opravy:** klíč deduplikace katalogu v seedu (`/s+/` bez zpětného lomítka mazal písmena „s“), `readSnapshot` četl i `wiring.json` (seed by na produkci spadl) – test. |
| 48 | 2026-11-04 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-48.md`, plán obnoven z gitu; fáze 46 a 47 označeny ✅ (nasazeny 2026-11-04). **Model:** migrace `panel_project_site_index` – `PanelBoardProject.installationSite` a index `(companyId, updatedAt)` místo `(companyId)`; indexy `EquipmentDocument(equipmentId, category)` a `SoftwareBackup(equipmentId, targetUnit, status)` už existovaly z fáze 46 (odchylka: nic nepřidáno). **Správa projektů:** `lib/panel-builder/project-admin.ts` (vzorový `PB-001`, `filterProjects`, `refundsCredit`, `isDeletableUpload` – nikdy `seed/` ani path traversal), služba `services/panel-projects.ts` (`deletePanelProjects` = jedna transakce + kredity, pak fyzické smazání fotek projektu přes `removeStoredFile`, sdílené URL zůstanou; `updateProjectHeader`), akce `actions/panel-projects.ts`. Přehled `/panel-builder` = klientský `ProjectBoard` (hledání bez diakritiky i podle místa instalace, filtr Vše / Rozpracované / Dokončené, ☑️ hromadný výběr s plovoucí lištou, PB-001 se štítkem „Vzorový projekt“ a zakázaným checkboxem; hromadně se vynechá, jednotlivě jde smazat bez vrácení kreditu), řazení naposledy upravené nahoře. Detail: „🗑️ Smazat tento projekt“ v hlavičce, 📍 místo instalace v popisu i na titulním listu. Potvrzení přes `window.confirm` jako jinde v aplikaci. **Kroky:** `PanelSteps` počítá `stepProgress` z `documentationState` (krok 1 bez nerozpoznaných, krok 2 strom, krok 3 oteplení OK, krok 4 propuštěno); krok 1 návrhu = „1. Návrh a osazení“. Duplicitní karty „Přiřazený přístroj“ už nejsou (sloučené ve fázi 45). **Soupis místností:** `src/engine/room-schedule.ts` (syntetický půdorys 1 px = 1 mm, body v řadě od vzdálenosti místnosti → kalibrace) → `generateCircuitsFromFloorplan` → `buildSwitchboardFromCircuits` → nový DESIGN projekt (lišty podle vybrané skříně, katalogové kusy přes `componentForConfig`, funkce obvodů, při chybě se projekt smaže a kredit vrátí); 3. volba v dialogu s tabulkou místností (vzorový dům 4+kk), režim klasika / Loxone (chytrá relé nenabízím – Shelly je skrytá značka; „např. ELKO MR-41“ se z funkce obvodu odstraní). **Karta zařízení:** záložky `w-max flex-nowrap` ve vodorovně rolovacím kontejneru. **Úložiště:** `services/storage-cleanup.ts` + `scripts/cleanup-storage.ts` (`npm run storage:cleanup`, `--dry-run`) – odkazy hledá v každém textovém sloupci všech tabulek (`/api/files/…` v *Url, JSON i SVG), maže jen soubory starší 24 h mimo `seed/` a dotfiles; prázdná DB bez odkazů = nic nemaže. **SEO:** `lib/seo.ts` (jediný zdroj), `app/robots.ts` (allow veřejné stránky, disallow interní trasy vč. `/app$` – ne `/apple-icon`), `app/sitemap.ts`, `app/opengraph-image.tsx` (černo-žluté šrafy, výchozí font Geist s diakritikou), `metadataBase` + OG / Twitter v root layoutu, canonical a JSON-LD (`Organization` + `SoftwareApplication`) na `/`; stránky s vlastním `openGraph` musí uvést `OG_IMAGE` znovu (Next ho jinak přepíše). Proxy pouští `/ukazka-elaboratu`, `/sitemap.xml`, `/robots.txt` a `/opengraph-image` bez přihlášení. **Ukázka elaborátu:** sestavení 6 listů vytaženo do `server/panel-documentation.ts` (`buildDocumentationData`), veřejná stránka `/ukazka-elaboratu` (vzorový PB-001 bez log a razítek, `?embed=1` bez hlavičky, tisk do PDF) a modální náhled „📄 Prohlédnout vzorový 6listový PDF elaborát rozváděče“ na úvodní stránce. **Archiv:** `ARCHIV-KOMPLET.md` nově končí aktuálním `docs/PLAN.md` (deník 44–48), záznam deníku 43 přesunut do archivu. **Ověření:** `npm run verify` (515 testů) a E2E phase48 (5), panel-builder (7), phase43 + phase47 (5), landing + phase41 (5) OK; demo-docs a phase46 v prvním běhu spadly na přenačítání studeného dev serveru (stránka zařízení) a opakovaný běh ukončil nedostatek RAM – neověřeno, commit na pokyn uživatele. |

---

# 📄 ZADANI-faze-37-38.md

> **Zadání fází 37 a 38 (2026-11-01)** – plné znění tak, jak bylo vloženo do `docs/PLAN.md`. Fáze 37 = AI Panel Builder (body 1–5 první části), fáze 38 = Studio výstavby závodu (body 1–5 druhé části).

Na základě testování na reálné fotce rozváděče ABB (PB-004) musíme zásadně opravit 6 věcí v AI Panel Builderu: čitelnost selectů v dark mode, přesnost OCR (zejména B vs. C, 10/13/16A a odpínače SHD203), zarovnání rámečků na fotce, zadávání funkce obvodu v Kroku 1, správné značení přístrojů (-Q, -FI, -FA, -F) a kompletně přepracovat nepochopitelný Krok 2 (Hierarchický strom).

Zapiš tyto úpravy do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. GLOBÁLNÍ OPRAVA NEČITELNÝCH ROZBALOVACÍCH MENU (<select> / <option>):
- V "src/app/globals.css" nastav globálně "color-scheme: dark;" na ":root" a "html", a přidej explicitní stylování pro všechny nativní "<select>", "<option>" a "<optgroup>" (background-color: #18181b; color: #f4f4f5;), aby rozbalené menu na Windows nikdy nemělo světlý nečitelný text na bílém pozadí.

2. ZPŘESNĚNÍ OCR ANALÝZY FOTEK A KATALOGU ABB (SH200 / SHD200 / FH200 / 13A):
- Rozšiř katalog v seedu o kompletní řady ABB Compact Home:
  - Odpínače "SHD203/25", "SHD203/40", "SHD203/63", "SHD204/40" a "SD203/25" (kategorie MAIN_SWITCH, šířka 3M/4M).
  - Jističe "SH201" a "SH203" v charakteristikách B i C pro proudy 6A, 10A, 13A (!), 16A, 20A, 25A, 32A.
  - Chrániče "FH202" a "FH204" (AC i A, 25A, 40A, 63A / 30mA).
- V "src/server/services/geminiPanelService.ts" zásadně zpřesni systémový prompt pro čtení lišty:
  a) ČERVENÁ PÁČKA (Red toggle): Pokud má 3M nebo 4M přístroj červenou ovládací páčku a nemá testovací tlačítko T (např. ABB SHD203/25, SD203/40), jde VŽDY o hlavní vypínač / odpínač (category: "MAIN_SWITCH"), NIKDY o jistič! Číslo za lomítkem "/25" nebo "/40" je jmenovitý proud 25A / 40A, nikoliv charakteristika C25!
  b) CHARAKTERISTIKA B vs. C: Explicitně přikaž modelu, aby si dal pozor na záměnu písmen B a C u jističů. V domovních a plastových rozváděčích (řady SH201, S201, PL6, PL7, LTN, MBN) je drtivá většina jističů charakteristiky "B" (B10, B13, B16). Pokud není na přístroji zcela zřetelně vytištěno "C16" nebo "C10", upřednostni "B"! Pozorně rozlišuj hodnoty "B10", "B13" a "B16" vytištěné přímo pod červeným proužkem ABB.
  c) VÝŘEZ LIŠTY: Posílej výřez lišty do Gemini v plném rozlišení (PNG nebo JPEG kvalita 95 %, bez zmenšování šířky), aby drobný potisk "B10 / B13 / B16" zůstal ostrý.

3. PŘESNÉ KOPÍROVÁNÍ PODKLADU RÁMEČKY NA FOTCE + RUČNÍ ÚPRAVA RÁMEČKU MYŠÍ:
- V promptu pro detekci lišt a modulů striktně vyžaduj, aby souřadnice [ymin, xmin, ymax, xmax] obepínaly POUZE skutečná plastová těla osazených přístrojů (nikoliv prázdnou kovovou DIN lištu a kabely napravo od posledního jističe!).
- Při přepočtu nebo skládání modulů na liště nesmí systém roztahovat moduly na 100 % šířky DIN lišty, pokud je lišta zaplněná jen částečně (např. 10M z 12M).
- Přímo na fotce rozváděče v Kroku 1 umožni u právě vybraného (žlutého) rámečku chytit myší jeho levý/pravý okraj nebo celý rámeček a jemně ho posunout/upravit, aby technik mohl rámeček za 1 vteřinu srovnat přesně na hrany přístroje na fotce.

4. DOPLNĚNÍ FUNKCE OBVODU HNED V KROKU 1 + SPRÁVNÉ IEC ZNAČENÍ PŘÍSTROJŮ (-Q, -FI, -FA, -F):
- V pravém panelu "Konfigurátor prvku" (Krok 1) přesuň pole "Funkce / Popis obvodu" (circuitLabel) úplně nahoru hned pod hlavičku prvku (-Q1 / -FI1 / -F1).
- Hned pod toto pole přidej 1-klikové rychlé štítky (chips) pro bleskové vyplnění funkce:
  [Hlavní vypínač] [Chránič 1] [Chránič 2] [Světla] [Zásuvky] [Kuchyně] [Koupelna] [Varná deska] [Trouba] [Myčka / Pračka] [Bojler / TČ] [Topení] [Venek / Garáž].
- Zadaný popis obvodu zobrazuj čitelně přímo na dlaždici modulu na DIN liště pod fotkou!
- Uprav automatické IEC značení ("autoNumberDesignations" i prvotní detekci), aby používalo jasné prefixy podle kategorie:
  - Odpínač / Hlavní vypínač (MAIN_SWITCH): "-Q1", "-Q2"...
  - Proudový chránič (RCD): "-FI1", "-FI2"...
  - Jističochránič (RCBO): "-FA1", "-FA2"...
  - Svodič přepětí (SPD): "-FV1", "-FV2"...
  - Jistič (MCB): "-F1", "-F2"...
  - Stykač (CONTACTOR): "-K1", "-K2"...
  - Relé (RELAY): "-KA1", "-KA2"...
  - Zdroj / Měření / Jiné: "-T1" / "-U1" / "-X1".
  Umožni také v hlavičce Konfigurátoru prvku značení (např. "-FI1") ručně přepsat.

5. KOMPLETNÍ PŘEPRACOVÁNÍ KROKU 2 ("2. Zapojení a hierarchie" – /panel-builder/[id]/tree):
Současný Krok 2 je pro uživatele nepochopitelný a generuje falešné chyby. Přepracuj algoritmus i celé UI Kroku 2:
a) Opravený algoritmus "AI návrh zapojení na 1 klik" (Pravidlo DIN lišty a hřebenové propojky):
   - Hlavní vypínač (-Q1) je kořenem rozváděče (napájen ze Vstupu napájení, fáze vždy "L1,L2,L3,N" u 3P/4P).
   - Každý 4P nebo 3P+N proudový chránič (-FI1, -FI2...) je napájen z hlavního vypínače (-Q1) a má VŽDY nastavené fáze "L1,L2,L3,N" (NIKDY mu nenastavuj jen jednu fázi L1/L2/L3!). 2P chránič má "L1,N" (příp. L2/L3).
   - Pravidlo DIN lišty: Pokud na dané DIN liště leží proudový chránič (-FIx), pak VŠECHNY jističe (MCB) umístěné napravo od tohoto chrániče na STEJNÉ DIN liště automaticky zapoj POD tento chránič (-FIx)!
   - Všechny jističe, 3P jističe, jističochrániče (-FAx) a přepěťovky (-FVx), které jsou na liště bez proudového chrániče (např. na Liště 1 vedle hlavního vypínače -Q1) nebo leží nalevo od chrániče, zapoj PŘÍMO pod hlavní vypínač (-Q1)!
   - Jednofázovým jističům ve skupině automaticky střídej fáze L1 -> L2 -> L3 -> L1...
b) Zrušení falešné chyby přetížení vypínače/chrániče v hlídači (Guardrails):
   - Součet jmenovitých proudů jističů (Σ In) v rozváděči běžně převyšuje jmenovitý proud hlavního vypínače (-Q1, např. 25A nebo 40A) nebo chrániče (40A). Zruš červenou chybu "Součet výpočtových proudů přetěžuje -Q1"! Místo chyby zobrazuj u skupiny jen čistou informaci o zatížení se započtením koeficientu soudobosti. Skutečnou červenou chybou zůstává pouze: nezapojený prvek, cyklus, nebo 3P jistič pověšený pod 1P uzel.
c) Nové, intuitivní UI Kroku 2 – "Skupinové karty podle DIN lišt a chráničů":
   - Místo nepřehledného stromu s desítkami roletek vykresli Krok 2 jako vizuální SKUPINOVÉ KARTY:
     * Karta 1: "⚡ Hlavní přívod a přímé vývody (pod hlavním vypínačem -Q1)" – zobrazuje hlavní vypínač -Q1 a pod ním všechny přímo napájené přístroje (3P jističe, jističochrániče -FA1, -FA2, přepěťovky).
     * Karta 2: "🛡️ Skupina Chrániče -FI1 (Lišta 2 – např. FH204 40A/30mA)" – hlavička karty je samotný chránič a uvnitř karty jsou přehledně vypsané všechny jističe na této liště, které chránič jistí.
     * Karta 3: "🛡️ Skupina Chrániče -FI2 (Lišta 3 – např. F204 40A/30mA)" – hlavička druhého chrániče a pod ním jeho jističe.
   - Přímo na řádku každého jističe nahraď rozbalovací menu fáze přímými klikacími tlačítky (pills):
     * Pro 1P / 1P+N přístroje: [ L1 ] [ L2 ] [ L3 ] (klik okamžitě přepne fázi).
     * Pro 3P / 4P přístroje: pevný štítek [ L1, L2, L3 ].
   - Pro přesun jističe do jiné skupiny dej na řádek přehledný přepínač skupiny: "Napájeno z: [ -Q1 Hlavní ] [ -FI1 Chránič (Lišta 2) ] [ -FI2 Chránič (Lišta 3) ]".

Na základě testování modulu "Studio výstavby závodu" (/studio) musíme opravit 6 zásadních věcí v ergonomii a logice všech 3 kroků. Zapiš to do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:

1. ZRUŠENÍ LIMITU 114×90 M A ZJEDNODUŠENÍ VELIKOSTI BUDOVY (Krok 1):
- Zruš tvrdé omezení počtu os (max 20 × 16), které teď blokuje zvětšení budovy na 114 × 90 m!
- Hlavním vstupem pro velikost budovy musí být přímo rozměr v metrech:
  - "Šířka budovy – osa X [m]" (rozsah 6 m až do plné šířky areálu, např. 1000 m)
  - "Hloubka budovy – osa Y [m]" (rozsah 6 m až do plné hloubky areálu, např. 600 m)
- Při tažení za žlutý roh budovy na mapě areálu umožni budovu plynule zvětšovat až do rozměrů celého areálu (s krokem po 1 m nebo po rozteči sloupů).
- Sekci "Konstrukční rastr" v levém panelu maximálně zjednoduš a schovej do rozbalovacího detailu "Pokročilé: Rozteč nosných sloupů (výchozí 6 m / 12 m)" – počet sloupových os (1..N, A..Z, AA..ZZ) nech dopocítávat plně automaticky na pozadí z šířky a hloubky budovy v metrech, aby rastr uživatele vůbec neomezoval.

2. TVORBA A SPRÁVA VÍCE BUDOV V AREÁLU NAJEDNOU (Krok 1):
- Umožni v rámci jednoho průchodu Studiem (jak v novém závodě, tak ve stávajícím) vytvořit a spravovat VÍCE budov najednou.
- V levém panelu i nad mapou zobraz přepínač budov v konceptu: např. "[ 🏭 Hala A (114×90 m) ] [ ⚡ Energetika (24×18 m) ] [ ➕ Přidat další budovu ]".
- Kliknutím na "+ Přidat další budovu" (nebo kliknutím na šablonu budovy nahoře) se první budova uloží do seznamu budov na mapě areálu a vytvoří se další budova, se kterou může uživatel na mapě nezávisle hýbat, měnit její velikost a v Krocích 2 a 3 jí kreslit místnosti a osazovat zařízení. Kliknutím na libovolnou budovu v mapě areálu se tato budova stane aktivní pro úpravy.

3. EDITOVATELNÉ NÁZVY STÁVAJÍCÍCH PODLAŽÍ (Krok 1 – Upravit existující budovu):
- V režimu "Upravit existující budovu" jsou teď názvy již existujících pater (např. "1. NP Hlavní výroba", "2. NP Vzduchotechnika") zobrazené jen jako neaktivní šedý text se štítkem "stávající".
- Změň všechna stávající podlaží na plnohodnotná editovatelná vstupní pole (<input>), aby šel název/využití jakéhokoliv existujícího patra okamžitě přepsat a při uložení Studia se změna propsala do databáze (prisma.floor.update).

4. ODSTRANĚNÍ "ROZDĚLIT PATRO ŠABLONOU" A PŘIDÁNÍ HISTORIE ZPĚT / VPŘED (Krok 2):
- V Kroku 2 ("Místnosti, zóny a vrata") ÚPLNĚ ODSTRAŇ sekci "Rozdělit patro šablonou" (tlačítka "2 výrobní linky + sklad", "Rozvodna + zázemí", "Kanceláře podél chodby"), protože nechtěným kliknutím maže ručně nakreslené místnosti.
- Přidej do Kroku 2 (a stejně tak do Kroku 3) plnohodnotnou historii kroků (Undo / Redo stack pro posledních 30 akcí):
  - Výrazná tlačítka "[ ↩ Zpět (Ctrl+Z) ]" a "[ ↪ Vpřed (Ctrl+Y) ]" v horní liště nad půdorysem i v levém panelu.
  - Každé nakreslení místnosti, posunutí stěny, smazání místnosti nebo vložení vrat jde jedním klikem (nebo klávesou Ctrl+Z) vrátit zpět.

5. KOMPLETNÍ PŘEPRACOVÁNÍ KROKU 3 ("Zařízení a napájení") – AUTOMATICKÉ ROZBALOVACÍ MENU PODLE MÍSTNOSTI A KONKRÉTNÍ BANERY STROJŮ/NÁŘADÍ:
Přepracuj levý panel a interakci s půdorysem v Kroku 3 na čistý, kontextově rozbalovací (accordion) workflow:

a) Sekce 1 – VÝBĚR MÍSTNOSTI / ZÓNY (otevřená jako první):
   - Uživatel klikne přímo v půdorysu na místnost (např. "Lisovací linka 1" nebo "Expedice výlisků") NEBO ji vybere ze seznamu vlevo.
   - Vybraná místnost se v půdorysu jasně zvýrazní a v levém panelu se automaticky rozbalí Sekce 2 pro tuto místnost.

b) Sekce 2 – VÝBĚR KATEGORIE ZAŘÍZENÍ + AUTOMATICKÉ FILTROVÁNÍ PŮDORYSU:
   - Zobraz přehledné barevné banery kategorií (Transformátor, Rozváděč, Výrobní stroj / Linka, Robotické pracoviště, Technologie budov, Spotřebič, Ruční nářadí).
   - U každého baneru zobraz počet kusů této kategorie v právě vybrané místnosti.
   - DŮLEŽITÉ: Jakmile uživatel klikne na kategorii (např. "Výrobní stroj / Linka" nebo "Ruční nářadí"), na půdorysu i v seznamu se VYFILTRUJÍ A ZVÝRAZNÍ POUZE zařízení spadající do tohoto typu (ostatní typy se v půdorysu ztlumí na 20 % opacity, s tlačítkem "Zobrazit vše").
   - Po výběru kategorie se automaticky rozbalí Sekce 3.

c) Sekce 3 – PŘEPÍNAČ "[ ➕ Vytvořit nové ]" vs. "[ ✏️ Upravit stávající (N) ]":
   - Režim "✏️ Upravit stávající":
     * Vypíše pouze existující zařízení zvoleného typu v této místnosti. Kliknutím na položku (nebo na její značku v půdorysu) může uživatel okamžitě upravit její Tag, Název, Nadřazený rozváděč, Vývod nebo ji přesunout/smazat.
   - Režim "➕ Vytvořit nové" – KONKRÉTNÍ PRODUKTOVÉ BANERY (ŠABLONY):
     * Místo obecného vkládání zobraz klikací dlaždice/banery konkrétních přístrojů podle vybrané kategorie:
       - Pro "Ruční nářadí": [ 🔩 Vrtačka / Aku šroubovák ] [ ⚙️ Úhlová bruska ] [ 🔨 Vrtací / Bourací kladivo ] [ 🔥 Horkovzdušná pistole ] [ ⚡ Svářečka ] [ 📏 Měřicí přístroj ]
       - Pro "Spotřebič": [ 🧹 Průmyslový vysavač ] [ ☕ Kávovar / Rychlovarná konvice ] [ 🧊 Chladnička / Mikrovlnka ] [ 🖥️ PC sestava / Tiskárna ] [ 🔌 Prodlužovací přívod / Buben ]
       - Pro "Výrobní stroj / Linka": [ 🏭 Lisovací linka ] [ ⚙️ CNC obráběcí centrum ] [ 🔧 Soustruh / Frézka ] [ 📦 Montážní / Balicí linka ] [ 🏗️ Jeřáb / Zdvihadlo ]
       - Pro "Robotické pracoviště": [ 🤖 Svařovací robot ] [ 🦾 Manipulační robotická buňka ] [ 👁️ Kamerové / Kontrolní pracoviště ]
       - Pro "Technologie / VZT": [ 🌀 Vzduchotechnická jednotka (VZT) ] [ 💨 Kompresorová stanice ] [ ❄️ Chlazení / Tepelné čerpadlo ] [ 🚨 Nouzové osvětlení / Hromosvod ]
       - Pro "Rozváděč": [ ⚡ Hlavní rozváděč (RH) ] [ 🔌 Podružný / Patrový rozváděč (RP) ] [ 🤖 Rozváděč stroje / linky (RM) ]
       - Vždy přidej i dlaždici: [ 🏷️ Vlastní zařízení / Vytvořit nový Tag ]
     * Kliknutím na konkrétní baner (např. "Vrtačka", "Bruska", "Vysavač" nebo "Lisovací linka") autopilot okamžitě vygeneruje odpovídající Tag a přesný český název (např. "Úhlová bruska – Dílna údržby"), nabídne editovatelné pole pro "Vlastní Tag" (s tlačítkem pro vlastní prefix) a umožní zařízení jedním klikem vložit do místnosti nebo do jemného rastru.

Po implementaci spusť "npm run verify", aktualizuj testy Studia v "e2e/accounts-studio.spec.ts", udělej commit a vypiš příkazy pro push a deploy.

---

# 📄 ZADANI-faze-39.md

# Zadání fáze 39 – Studio (vloženo uživatelem 2026-11-02)

V modulu Studio (/studio, Krok 2 a Krok 3) provedeme 3 cílená vylepšení vizuálu rastru, editovatelnosti levého menu a sčítání prvků v místnostech. Zapiš je do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. ZJEMNĚNÍ SLOUPŮ V KONSTRUKČNÍM RASTRU (PlanViewport / SVG půdorys):
- Současné plné šedé čtverce v průsečících hlavních os rastru jsou příliš velké a působí rušivě.
- Zmenši symboly nosných sloupů na třetinovou velikost (max. 4×4 px s nízkou krytostí opacity-25) nebo je vykresli jako jemné architektonické středové křížky (+) v barvě rastru, aby nerušily čitelnost místností, popisků a zařízení.

2. EDITOVATELNÉ NÁZVY KATEGORIÍ A VLASTNÍ ŠABLONY V LEVÉM PANELU (Krok 3):
- V Kroku 3 v levém panelu (Sekce 2 "Kategorie zařízení" a Sekce 3 "Vytvořit nové" s dlaždicemi jako Průmyslový vysavač, Kávovar, Chladnička, PC sestava, Prodlužovací přívod...) umožni uživateli upravovat texty a přidávat vlastní šablony:
  a) Přidej do záhlaví Sekce 2 a Sekce 3 přepínač "[ ✏️ Upravit nabídku ]".
  b) V režimu úprav může uživatel přímo přepsat název kterékoliv kategorie nebo šablony (např. změnit "Kávovar / Rychlovarná konvice" na dva samostatné banery "Kávovar" a "Rychlovarná konvice", nebo přejmenovat cokoliv podle zvyklostí své firmy), změnit výchozí prefix Tagu (např. KAV, LED, VYS) nebo šablonu smazat.
  c) Přidej na konec dlaždic tlačítko "[ + Přidat vlastní dlaždici ]", kterým si uživatel uloží nový typ přístroje trvale do nabídky (uloženo do localStorage + databázového nastavení tenantu TenantSetting, aby upravené banery zůstaly zachovány i po obnovení stránky).

3. AUTOMATICKÉ SČÍTÁNÍ POLOŽEK PŘÍMO V MÍSTNOSTECH NA RASTRU I V SEZNAMU "UPRAVIT STÁVAJÍCÍ":
- Přímo na půdorysu v rastru (uvnitř obdélníku každé místnosti, např. "Kancelář 1"):
  * Místo jednoho obecného štítku "14× Spotřebič" vykresli přímo uvnitř místnosti v rastru přehledné seskupené štítky (chips) sečtené podle názvu přístroje!
  * Jakmile uživatel do místnosti nakliká položky, přímo v místnosti v rastru naskakují a sčítají se konkrétní počty, např.:
    [ 🖥️ 7× PC sestava ] [ 🔌 4× Prodlužovací přívod ] [ 🧊 2× Chladnička ] [ ☕ 1× Kávovar ]
  * Stejný seskupený přehled vykresli i do uloženého floorplanSvg, aby byl vidět i na mapě patra mimo Studio.
- V levém panelu v záložce "✏️ Upravit stávající (N)":
  * Seskup shodné položky v dané místnosti podle názvu do přehledných řádků se součtem: např. "🖥️ PC sestava (7×)", "🔌 Prodlužovací přívod (4×)", "🧊 Chladnička (2×)", "☕ Kávovar (1×)".
  * Přímo na každém seskupeném řádku přidej rychlá tlačítka "[ − ]" a "[ + ]" pro okamžité ubrání nebo přidání dalšího kusu stejného spotřebiče/nářadí v této místnosti jedním klikem (s automatickým vygenerováním dalšího Tagu v řadě).
  * Po rozkliknutí seskupeného řádku (chevron dolů) zobraz jednotlivé kusy (SP-0002 až SP-0008), kde lze v případě potřeby upravit individuální Tag, název nebo napájení konkrétního kusu.

Ověř změny přes "npm run verify", aktualizuj testy Studia, udělej commit a vypiš příkazy pro push a deploy na server.

---

# 📄 ZADANI-faze-40.md

# Zadání fáze 40 (vloženo 2026-11-02 do sekce B plánu)

Musíme zásadně přepracovat logiku a UX modulu "Studio výstavby závodu" (/studio) a kompletně aktualizovat vzorové závody (seed), ze kterých po zavedení nového modelu zmizely místnosti a vybavení.

Zapiš tyto úpravy do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. ŽÁDNÁ AUTOMATICKÁ NOVÁ BUDOVA PŘI OTEVŘENÍ STUDIA + REŽIM "MAPA ZÁVODU NA PRVNÍM MÍSTĚ":
- Když uživatel otevře "/studio" pro existující závod, NESMÍ se automaticky vytvářet žádný žlutý koncept nové budovy ("Hala C") a nesmí tam strašit rozbalený Krok 1!
- Výchozí obrazovka "/studio" zobrazí pouze čistou interaktivní mapu aktuálního závodu se všemi jeho stávajícími budovami a výzvou: "Klikněte na libovolnou budovu pro správu jejího vybavení a místností".
- V horní liště nad mapou zobraz pouze akční tlačítka:
  * "[ ✏️ Upravit areál / + Přidat budovu ]" – teprve po kliknutí na toto tlačítko se odemkne režim editace areálu (změna rozměrů pozemku X×Y, posouvání/změna velikosti budov a přidání nové budovy).
  * "[ 🆕 Vytvořit nový závod od nuly ]" – přepne do průvodce stavbou nového areálu.

2. PŘÍMÝ PROKLIK Z MAPY BUDOVY ROVNOU K ZAŘÍZENÍM A MÍSTNOSTEM (BEZ NUTNOSTI KROKU 1):
- Když uživatel na mapě areálu ve Studiu klikne na stávající budovu (např. Hala A, Energetika, Administrativa):
  * Otevře se pohled na tuto budovu s přepínačem jejích pater nahoře (1. PP, 1. NP, 2. NP...) a půdorysem vybraného patra.
  * Zároveň se otevře levý boční panel se 3 rychlými režimy práce nad tímto patrem:
    1) "[ 🔌 Zařízení a napájení ]" (VÝCHOZÍ AKTIVNÍ REŽIM po otevření budovy!) – uživatel hned vidí půdorys patra se všemi místnostmi a osazenými stroji, rozváděči a spotřebiči, může kliknout na místnost a okamžitě přidávat, upravovat nebo odebírat zařízení.
    2) "[ 🧱 Místnosti, zóny a vrata ]" – přepne plátno do režimu kreslení místností, posouvání stěn myší a osazování vrat.
    3) "[ 🏢 Budova a podlaží ]" – odemkne přejmenování pater, přidání nového patra (NP/PP) nebo úpravu rozměru budovy X×Y.

3. OBOUSMĚRNÁ SYNCHRONIZACE EXISTUJÍCÍCH ZAŘÍZENÍ A MÍSTNOSTÍ VE STUDIU:
- Oprav načítání existujícího patra do Studia: když uživatel otevře jakékoliv patro existující budovy, Studio musí načíst jak jeho "studioLayoutJson" (všechny místnosti, zóny a vrata v metrech), tak VŠECHNA existující zařízení ("Equipment") na tomto patře z databáze!
- V půdorysu Studia i v levém panelu ("Upravit stávající") musí být vidět všechny stávající rozváděče, stroje, roboty, spotřebiče i ruční nářadí, které na patře jsou.
- Umožni ve Studiu existující zařízení plnohodnotně upravovat (změnit název, tag, napájení, místnost, počet kusů přes +/−), mazat (s potvrzením) nebo přidávat nová, a při kliknutí na "Uložit změny patra" vše čistě zapsat do databáze a přegenerovat "floorplanSvg".

4. KOMPLETNÍ AKTUALIZACE A BOHATÉ VYBAVENÍ VZOROVÝCH ZÁVODŮ V SEEDU (Závod Jablonec & Závod Liberec):
Vzorové závody teď kvůli novým pravidlům působí prázdně nebo mají nekompatibilní staré SVG půdorysy. Aktualizuj seed ("prisma/seed-data.ts", "prisma/seed-appliances.ts" a přírůstkový seed pro produkci) tak, aby vzorové závody na 100 % využívaly novou metrovou architekturu Studia a byly bohatě naplněné realistickým vybavením:
- Pro KAŽDÉ patro všech budov v Závodě Jablonec (Hala A 1.NP a 2.NP, Hala B 1.NP, Energetika 1.PP a 1.NP, Sklad 1.NP, Administrativa 1.NP a 2.NP) i v Závodě Liberec (Hala 1 - Lakovna) definuj přesný "studioLayoutJson" s logickými místnostmi pokrývajícími celou plochu patra (žádné prázdné neobsazené kusy haly!), se správnými 7 typy zón a azurovými vraty, a vygeneruj z nich nové půdorysy "floorplanSvg".
- Bohatě vybav všechna patra a místnosti reálnými zařízeními napojenými do hierarchie napájení:
  * Energetika (1. PP a 1. NP): Transformátor TR1, hlavní rozváděč RM1, kompenzační rozváděč RC1, UPS rozváděč RZ1, kompresorová stanice KS1, v kuchyňce a velínu spotřebiče (2× Kávovar, 1× Chladnička, 1× Mikrovlnná trouba, 3× PC sestava, 4× Prodlužovací přívod) a v dílně měřicí přístroje a nářadí.
  * Hala A – Lisovna (1. NP a 2. NP): Rozváděče R-LIS-01, R-CNC-04, R-VZT-01, hydraulické lisy LIS-01 a LIS-02, CNC centra CNC-01 až CNC-04, robotické buňky ROB-01 až ROB-03, VZT jednotky, hromosvod, nouzové osvětlení + v místnosti "Dílna údržby" a "Mistrová" bohatá sada ručního nářadí a spotřebičů (4× Úhlová bruska, 3× Aku/elektrická vrtačka, 2× Svářečka, 2× Průmyslový vysavač, 6× Prodlužovací buben, 2× PC sestava).
  * Hala B – Montáž (1. NP): Rozváděč R-ML-01, montážní linky ML-01 a ML-02, svařovací roboty ROB-07 a ROB-08 + v montážních zónách a zázemí spotřebiče a nářadí (5× Elektrický šroubovák/vrtačka, 2× Horkovzdušná pistole, 4× Prodlužovací přívod, 1× Průmyslový vysavač).
  * Sklad (1. NP): Rozváděč R-SKL, nabíjecí stanice VZV, balicí linka + v expedici (3× PC sestava / terminál, 2× Horkovzdušná pistole, 4× Prodlužovací přívod).
  * Administrativa (1. NP a 2. NP): Patrové rozváděče RP-ADM1 a RP-ADM2 + v kancelářích, zasedačce a kuchyňkách (12× PC sestava / monitor, 3× Tiskárna, 2× Kávovar, 2× Rychlovarná konvice, 2× Chladnička, 10× Prodlužovací přívod).
- Zajisti, aby se tato aktualizovaná struktura (studioLayoutJson, přegenerované floorplanSvg se součtovými štítky v místnostech a doplněné kusy vybavení) bezpečně propsala i na produkční server přes přírůstkový seed skript při startu kontejneru (bez smazání uživatelských dat a projektů v Panel Builderu).

Po implementaci spusť "npm run verify", uprav E2E testy Studia na nový průchod (klik na budovu na mapě -> úprava patra -> přidání/úprava zařízení), udělej commit a vypiš příkazy pro push a deploy.

---

# 📄 ZADANI-faze-41.md

# Zadání fáze 41 (vloženo 2026-11-03 do sekce B plánu)

Přecházíme do další fáze, ve které obchodně a funkčně oddělíme "ELDOCK AI Panel Builder" (jako samostatný zpeněžitelný produkt s vlastní registrací firmy a propisem údajů do PDF) od hlavního systému "ELDOCK Správa závodů a revizí".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 6 bodech:

1. DATOVÝ MODEL PRO REGISTROVANÉ FIRMY A PRÁVNÍ SOUHLASY (Prisma migrace):
Vytvoř v "prisma/schema.prisma" model "RegisteredCompany" (a čistou migraci):
- id (String @id @default(cuid()))
- productScope (enum: "PANEL_BUILDER" | "PLANT_MANAGEMENT") – určuje, do kterého produktu je firma registrovaná
- ico (String) – IČO firmy
- dic (String?) – DIČ firmy
- companyName (String) – Obchodní název firmy (propisuje se jako Výrobce rozváděče)
- street (String) – Ulice a č.p.
- city (String) – Město
- zip (String) – PSČ
- contactName (String) – Jméno a příjmení odpovědné osoby / projektanta
- email (String @unique) – Přihlašovací e-mail
- phone (String) – Kontaktní telefon
- passwordHash (String) – Bezpečný hash hesla (scrypt / pbkdf2 přes node:crypto)
- authorizationNumber (String?) – Volitelné ev. č. oprávnění / osvědčení TIČR (NV 190/2022 Sb.)
- termsAcceptedAt (DateTime) – Přesný čas odsouhlasení VOP a přenesení odpovědnosti
- termsVersion (String @default("1.0-2026-11")) – Verze odsouhlasených podmínek
- creditsRemaining (Int @default(5)) – Počet volných kreditů/projektů pro testery
- plantId (String?) – Vazba na vlastní Plant (u firem registrovaných do PLANT_MANAGEMENT)
- Vazba "companyId String?" na "PanelBoardProject", aby každý registrovaný uživatel v Panel Builderu viděl pouze své vlastní rozváděče a měl v nich automaticky vyplněné své firemní údaje.

2. NAPOJENÍ NA REGISTR ARES (/api/ares):
- Vytvoř endpoint "GET /api/ares?ico=..." který zavolá veřejné REST API registru ARES ("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}") a vrátí JSON: { companyName, ico, dic, street, city, zip }.
- Ve formuláři registrace po zadání 8místného IČO (nebo kliknutí na "Načíst z ARES") automaticky předvyplň název firmy, DIČ a kompletní sídlo. Pokud je ARES nedostupný, umožni údaje vyplnit ručně.

3. SAMOSTATNÝ BANNER NA DOMOVSKÉ OBRAZOVCE (/) A ODDĚLENÍ NAVIGACE:
- Na veřejné úvodní stránce ("/") vytvoř výrazný samostatný produktový banner / sekci:
  "⚡ ELDOCK AI Panel Builder – Výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty".
  Tlačítka na banneru: "[ 🚀 Spustit AI Panel Builder (Registrace / Přihlášení) ]" -> vede na "/panel-builder/auth".
- Druhá hlavní sekce na úvodní stránce reprezentuje celozávodní platformu:
  "🏭 ELDOCK Průmyslový dok – Správa výrobních závodů, dokumentace a revizí" -> tlačítka "[ Registrovat výrobní závod ]" ("/register-plant") a "[ Přihlásit se / Demo závodu ]" ("/login").
- STRIKTNÍ ODDĚLENÍ PRODUKTŮ:
  * Z hlavní horní navigace ("AppHeader") v systému pro správu závodů (/plant, /inspections, /cae, /studio, /admin) ODSTRAŇ položku "Panel Builder"! V závodním systému je pouze správa závodů, budov, dokumentace, červenky a revizí.
  * Sekce "/panel-builder/*" dostane svou vlastní samostatnou horní lištu ("PanelBuilderHeader"), kde je logo "ELDOCK AI Panel Builder", název přihlášené firmy + IČO, počet zbývajících testovacích kreditů, tlačítko "Firemní údaje do razítka" (kde lze údaje kdykoliv upravit) a tlačítko "Odhlásit".

4. REGISTRACE A PŘIHLÁŠENÍ DO AI PANEL BUILDERU (/panel-builder/auth) + PRÁVNÍ VÝLUKA ODPOVĚDNOSTI:
- Pokud nepřihlášený uživatel klikne na banner AI Panel Builderu nebo vstoupí na "/panel-builder", přesměruj ho na "/panel-builder/auth".
- Stránka "/panel-builder/auth" má dvě záložky: "Přihlášení" (e-mail + heslo, plus rychlé tlačítko "Vyzkoušet předvyplněný Tester účet" pro snadné testování) a "Registrace firmy (Tester)".
- Registrační formulář vyžaduje:
  * IČO (s tlačítkem "Doplnit z ARES"), Obchodní název firmy, DIČ (volitelné), Ulice a č.p., Město, PSČ.
  * Jméno a příjmení odpovědné osoby, E-mail, Telefon, Ev. č. oprávnění TIČR (volitelné), Heslo.
- POVINNÝ PRÁVNÍ SOUHLAS A PŘENESENÍ ODPOVĚDNOSTI:
  * Pod formulářem musí být povinný zaškrtávací box (s možností rozkliknout celé znění v modalu "Obchodní podmínky a vyloučení odpovědnosti"):
    "Souhlasím s Obchodními podmínkami a výslovně beru na vědomí, že nástroj ELDOCK AI Panel Builder slouží výhradně jako pomocný softwarový nástroj. Veškerou odbornou, technickou a právní odpovědnost za správnost návrhu, dimenzování přístrojů, výpočet oteplení, provedení kusové zkoušky a shodu rozváděče s ČSN EN 61439 a platnými bezpečnostními předpisy nese výhradně uživatel (výrobce rozváděče / projektant), nikoliv provozovatel platformy Eldock."
  * Bez zaškrtnutí tohoto souhlasu nelze registraci odeslat.

5. AUTOMATICKÝ PROPIS FIREMNÍCH ÚDAJŮ DO 6LISTOVÉ PDF DOKUMENTACE ROZVÁDĚČE:
- Když přihlášená firma v AI Panel Builderu založí nový rozváděč (nebo otevře svůj projekt), automaticky propisuj její registrační údaje (companyName, ico, dic, street, city, zip, contactName, phone, email, authorizationNumber) do dat výrobce rozváděče:
  * List 1 (Titulní strana): Kompletní blok "Výrobce rozváděče" (Název firmy, IČO, DIČ, adresa sídla, odpovědná osoba, telefon, e-mail).
  * Listy 1–6 (Rohové razítko): Název firmy a jméno zpracovatele (`contactName`).
  * List 6 (EU Prohlášení o shodě a Výrobní štítek CE): V prohlášení o shodě je přímo vyplněná zaregistrovaná firma, její sídlo a IČO jako "Výrobce, který tímto na svou výhradní odpovědnost prohlašuje..." + jméno odpovědné osoby u podpisu. Na výrobním štítku se značkou CE je vypsán název firmy a sídlo výrobce.
- Před kliknutím na "Vytisknout / Exportovat kompletní PDF elaborát" v Kroku 4 přidej potvrzovací checkbox:
  "✅ Potvrzuji, že jsem veškeré rozpoznané přístroje, schéma zapojení i výpočet oteplení odborně zkontroloval(a) a přebírám za dokumentaci plnou odpovědnost výrobce rozváděče."

6. REGISTRACE PRO VÝROBNÍ ZÁVODY (/register-plant):
- Vytvoř registrační stránku "/register-plant" pro druhý produkt (Správa závodů, dokumentace a revizí):
  * Formulář načte přes IČO/ARES údaje firmy, doplní název prvního závodu (např. "Hlavní výrobní závod"), kontaktní osobu, e-mail, telefon, heslo a souhlas s VOP.
  * Po registraci v jedné transakci založí "RegisteredCompany" (scope: PLANT_MANAGEMENT), nový "Plant" s čistou mapou areálu, uživatele v roli Technického ředitele ("PLANT_ADMIN") a rovnou ho přihlásí do jeho nového závodu (kde může ve Studiu stavět budovy, nahrávat dokumentaci a řídit revize – bez Panel Builderu).

Ověř vše přes "npm run verify", uprav a doplň unit i E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.

---

# 📄 ZADANI-faze-42.md

# Zadání fáze 42 (vloženo 2026-11-03 do sekce B plánu)

Zásadně přepracujeme UX a architekturu AI Panel Builderu (/panel-builder/[id]). Opouštíme nepřesné vykreslování zelených/žlutých bounding boxů přes fotku rozváděče a nefunkční tabulkový Krok 2. Místo toho zavedeme přímý převod do standardizované 2D vektorové grafiky (mechanické symboly s živými modrými spojnicemi) a interaktivní Drag & Drop tvorbu hierarchie přímo na vektorovém rozváděči.
Zapiš tuto změnu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:
1. KONEC BOUNDING BOXŮ NA FOTCE -> ČISTÁ REFERENČNÍ FOTKA + 2D VEKTOROVÉ PLÁTNO:
- Na fotce rozváděče (vlevo) ZCELA VYPNI vykreslování zelených, žlutých a červených obdélníčků (bounding boxů). Fotka slouží pouze jako čistá, ostrá referenční předloha s možností přiblížení (zoom/pan), aby z ní technik mohl pohodlně číst bez rušivých čar.
- Hlavní pracovní plochou je "2D Vektorový rozváděč (Interactive Vector CAD)" – čisté grafické zobrazení DIN lišt a přístrojů, které má přepínatelný režim zobrazení:
  * "Tmavý editor (CAD Dark)" a "Výkres osazení (Černobílý CAD s modrými spojnicemi jako ve výkresu dokumentace)".

2. STANDARDIZOVANÉ MECHANICKÉ VEKTOROVÉ SYMBOLY (SVG KOMPONENTY):
Vytvoř v "src/components/panel-builder/VectorModuleSymbol.tsx" sadu pevných, graficky čistých mechanických vektorových symbolů pro každou kategorii a počet pólů (šířka v poměru modulů 1M, 2M, 3M, 4M):
- Každý symbol má nahoře a dole pás se šroubovými svorkami (kroužky šroubků: 1M = 1 šroubek nahoře/dole, 2M = 2, 3M = 3, 4M = 4).
- Střední část se mechanicky liší podle kategorie:
  * 1P Jistič (MCB 1M): 1 černá ovládací páčka.
  * 3P Jistič (MCB 3M): 3 páčky spojené společnou vodorovnou hrazdičkou.
  * Odpínač / Hlavní vypínač (MAIN_SWITCH 3M/4M): spojená ČERVENÁ páčka bez nadproudové spouště.
  * Proudový chránič (RCD 2M/4M): ovládací páčka + zřetelné testovací tlačítko "[ T ]" a okénko indikace.
  * Jističochránič (RCBO 1M/2M): páčka + modré/bílé testovací tlačítko "[ T ]".
  * Svodič přepětí (SPD 2M/3M/4M): vyjímatelné kazety s terčíky stavu (zelená) a symbolem blesku/uzemnění.
  * Stykač / Relé / Zdroj: odpovídající mechanická silueta s cívkou/kontakty.
- DYNAMICKÁ TEXTOVÁ POLE UVNITŘ KAŽDÉHO VEKTOROVÉHO SYMBOLU:
  1) Vlevo pod horními šroubky: Tučné IEC značení (např. "-Q1", "-FV1", "-FI1", "-FA1", "-F1").
  2) V těle přístroje: Výrobce + klíčová hodnota a typ z databáze:
     - U jističe např.: "ABB" a výrazně "B16" (pod tím drobně "S201-B16").
     - U chrániče např.: "ABB" a "FH204 AC 25A 0,03A".
     - U odpínače např.: "ABB · SD203/40 (40A)".
  3) Ve spodním štítku přístroje: Popis funkce/obvodu (např. "Světla", "Zásuvky", "Kuchyně") – editovatelný přímo dvojklikem nebo v pravém panelu.

3. NAPOJENÍ NA ROZŠÍŘENOU DATABÁZI PRVKŮ (CatalogComponent):
- Propoj AI analyzátor, konfigurátor i vektorové symboly s kompletní databází "CatalogComponent":
  * Při analýze fotky páruj detekované přístroje primárně proti "CatalogComponent" (podle výrobce, kategorie, pólů, jmenovitého proudu In, charakteristiky B/C/D nebo parametrů chrániče AC/A a mA).
  * V pravém konfigurátoru přidej rychlé našeptávací vyhledávání přímo z databáze prvků + okamžité filtrování podle dlaždic (Výrobce -> Kategorie -> Póly -> Hodnoty). Jakmile uživatel vybere parametry nebo kus z databáze, okamžitě se přepíše dynamický text ve vektorovém symbolu, aktualizuje se ztrátový výkon (Pv ve Wattech) a objednací číslo.
  * Pokud uživatel zadá nový typ, který v databázi není, po dohledání přes Gemini ho automaticky ulož (upsert) do "CatalogComponent", aby se databáze sama učila.
4. NOVÉ INTUITIVNÍ NASTAVENÍ HIERARCHIE A ZAPOJENÍ (PŘÍVOD + DRAG & DROP MEZI PRVKY):
Oprav a kompletně přepracuj tvorbu hierarchie (sjednoť ji s vektorovým pohledem na DIN lišty, aby uživatel pracoval přímo nad grafickým rozváděčem a nikoliv v nepřehledné textové tabulce s 37 chybami):
a) Volba hlavního přívodu a kořenového prvku (Root):
   - Nad vektorovým rozváděčem zobraz lištu "Hlavní přívod rozváděče":
     1. Přepínač směru přívodu: "[ ⬇ Přívod SHORA ]" vs. "[ ⬆ Přívod ZESPODA ]".
     2. Výběr prvního (kořenového) prvku, do kterého je napojen hlavní přívod: Tlačítko "[ 🎯 Určit hlavní vstupní prvek ]" (nebo roletka ze všech 3P/4P prvků v rozváděči).
     3. DŮLEŽITÉ: Hlavním vstupním prvkem může být JAKÝKOLIV přístroj (Odpínač -Q1, ale klidně i 3f jistič -F1, pokud rozváděč nemá samostatný odpínač, nebo hlavní chránič -FI1)! Jakmile je určen, vykreslí se do něj hlavní přívodní čára se šipkou (shora nebo zespoda).
b) Drag & Drop zapojování přímo na vektorovém rozváděči:
   - Uživatel může v režimu "Zapojení a hierarchie" chytit myší libovolný přístroj (nebo označit skupinu přístrojů / celou DIN lištu) a PŘETÁHNOUT (Drag & Drop) ho na přístroj, ze kterého je napájen!
   - Pravidla inteligentního řazení při přetažení (Drop):
     * Přetažení Přepěťovky (-FV1) na Hlavní prvek (-Q1 / -F1): Přepěťovka se zapojí přímo pod hlavní prvek (`parentId = Q1.id`).
     * Přetažení Chrániče (-FI1) na Přepěťovku (-FV1) nebo na Hlavní prvek (-Q1): Chránič se zapojí za tento prvek jako nadřazený skupinový uzel (a pokud je přetažen na přepěťovku, vytvoří průchozí napájecí uzel v hlavní větvi).
     * Přetažení Jističů (-F2, -F3, -F4...) na Chránič (-FI1) nebo na Hlavní prvek (-Q1): Kdykoliv uživatel přetáhne jeden nebo více jističů na Chránič (nebo dokonce přetáhne jistič na jiný jistič, který už pod tímto chráničem je), VŠECHNY tyto jističe se zařadí HIERARCHICKY VEDLE SEBE (paralelně jako sourozenci se stejným `parentId = FI1.id`), NIKDY za sebe do série! Automaticky se jim přitom střídají fáze L1, L2, L3.
   - Rychlá pomocná tlačítka (pro rozváděče s 30+ jističi):
     * U každého chrániče (-FI1, -FI2) přímo na liště zobraz tlačítko "[ 🔗 Připojit jističe vpravo na této liště ]", které jedním klikem naváže všechny jističe na dané DIN liště napravo od chrániče pod tento chránič.
     * Opravené tlačítko "[ ⚡ AI návrh zapojení na 1 klik ]": Pokud v rozváděči není odpínač -Q1, automaticky vezme jako kořenový vstupní prvek první 3P/4P přístroj na 1. liště (např. -F1 S203-C25 nebo první chránič), takže strom zapojení VŽDY zafunguje na 100 % a nikdy neskončí s 0/37 zapojenými prvky!
c) Živé vykreslování modrých spojnic (jako v CAD výkresu):
   - Přímo mezi vektorovými DIN lištami vykresluj v reálném čase modré napájecí čáry a hřebenové lišty (přesně ve stylu přiloženého vzoru: přívodní šipka -> hlavní prvek -> propojky na SPD a chrániče -> vodorovná modrá hřebenová sběrnice nad/pod jističi dané skupiny). Uživatel tak okamžitě vizuálně vidí, co je s čím spojené!
Ověř vše přes "npm run verify", aktualizuj testy a vypiš příkazy pro push a deploy na server.

---

# 📄 ZADANI-faze-43.md

Přidáváme do AI Panel Builderu klíčovou funkci "Projektování nového rozváděče bez fotky (CAD návrh od nuly)", kaskádový výběr výrobce a součástek s Drag & Drop osazováním, chytré filtrování skříní rozváděčů podle velikosti, nahrání razítka a loga firmy do profilu a tisk samolepicích popisků rozváděče v měřítku 1:1. Zároveň napojíme katalog na naši externí databázi prvků z "C:\Users\janou\Desktop\Claude\ai-panel-builder".

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj v těchto 6 bodech:

1. NOVÝ REŽIM "NAVRHNOUT ROZVÁDĚČ BEZ FOTKY (OD NULY)" A DYNAMICKÉ DIN LIŠTY:
- V modalu "Nový projekt rozváděče" (/panel-builder) přidej na začátek výrazný přepínač 2 režimů:
  a) "[ 📐 Navrhnout nový rozváděč od nuly (bez fotky) ]" (výchozí pro projekci)
  b) "[ 📷 Pasportizovat rozváděč z fotky (AI Vision) ]"
- Při volbě "Navrhnout od nuly" se projekt založí rovnou s 1 DIN lištou na 12 modulů (1× 12M) a otevře čisté 2D vektorové pracovní plátno (bez levého boxu s fotkou, takže 2D vektorový rozváděč má dostatek prostoru).
- Přímo u každé DIN lišty na plátně přidej ovládání její kapacity:
  * Rychlé presety šířky řady podle standardních rozvodnic: [ 8M ] [ 12M ] [ 14M (12+2) ] [ 18M ] [ 24M ] [ 36M ] + tlačítka "[ − ]" a "[ + ]" pro změnu po 1 modulu.
  * Tlačítko "[ ➕ Přidat další DIN lištu (řadu) ]" pod lištami (umožní přidat 2., 3., 4., 5., 6. řadu) a možnost lištu smazat nebo změnit pořadí lišt šipkami nahoru/dolů.
  * Nahoře nad lištami zobraz živý indikátor: "Konfigurace: {počet} DIN lišt × {moduly} M · Obsazeno: {obsazeno} / {celkem} M ({procenta} % · volná rezerva {rezerva} %)".

2. KASKÁDOVÉ PRAVÉ MENU: LOGA VÝROBCŮ -> KATEGORIE -> PARAMETRY -> DRAG & DROP SOUČÁSTKA:
Přepracuj pravý panel v "/panel-builder/[id]" tak, aby fungoval pro vkládání nových součástek i úpravu stávajících přesně v tomto sledu:
- KROK A (Výběr výrobce přístroje):
  * Zobraz vyhledávací pole "🔍 Hledat výrobce podle názvu..." a pod ním přehlednou mřížku karet s logy/odznaky výrobců z naší databáze (ABB, Eaton, OEZ, Schneider Electric, Hager, Noark, Bonega, Schrack, Siemens, ETI, SEZ, Saltek, Hakel, Dehn, Elko EP, Finder, Relpol, Loxone, Shelly, Eastron, Wago, Phoenix Contact, Weidmüller, Pollmann, Mean Well, Pilz, Omron).
  * JAKMILE uživatel klikne na jednoho výrobce (např. ABB), všechny ostatní karty výrobců ZMIZÍ a zůstane jen kompaktní lišta vybraného výrobce: "[ 🟥 ABB ]" + tlačítko "[ 🔄 Vybrat jiného výrobce ]".
  * Po kliknutí na "[ 🔄 Vybrat jiného výrobce ]" se opět rozbalí celé menu všech výrobců s vyhledáváním, dokud uživatel nevybere jiného.
- KROK B (Výběr kategorie – zobrazí se po výběru výrobce):
  * Zobraz dlaždice kategorií: [ Jistič ] [ Chránič ] [ Jističochránič ] [ Odpínač / Vypínač ] [ SPD (Přepěťovka) ] [ Stykač ] [ Relé ] [ Zdroj / Měření / Jiné ] + [ Svorky / Hřebeny / Příslušenství ].
- KROK C (Dynamické parametry podle kategorie):
  * Po kliknutí na kategorii zobraz odpovídající řádky dlaždic parametrů (Póly & Šířka vč. 0,5M / 1M / 2M / 3M / 4M, Charakteristika B/C/D/K/Z, Typ chrániče AC/A/F/B, Citlivost 10/30/100/300 mA, Jmenovitý proud In, Zkratová odolnost kA, Cívka stykače/relé, Třída SPD).
- KROK D (Živá finální součástka + Vícenásobné Drag & Drop přetahování na DIN lištu):
  * Dole pod parametry vykresli kartu "PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ", která se v reálném čase mění při každém kliknutí na parametr.
  * Karta obsahuje živý 2D vektorový náhled součástky (v přesném počtu modulů, s páčkou, šroubky a nápisem např. "ABB B16"), přesný typ a MPN z databáze, šířku v modulech, ztrátový výkon ve W a pole pro popis obvodu.
  * DRAG & DROP NA LIŠTU: Uživatel může tuto finální součástku chytit myší a PŘETÁHNOUT ji na libovolnou DIN lištu (i opakovaně vícekrát za sebou!). Přidej k ní také rychlá tlačítka "[ ➕ Vložit na aktivní lištu (1×) ]", "[ +3× ]" a "[ +6× ]", aby šlo osadit řadu jističů během pár vteřin.

3. CHYTRÝ VÝBĚR SKŘÍNĚ ROZVÁDĚČE (FILTROVÁNÍ PODLE VELIKOSTI AŽ PO VOLBĚ VÝROBCE):
- Vytvoř samostatnou sekci / modal "🗄️ Výběr skříně rozváděče (Rozvodnice)" (dostupný v Kroku 1 i v Kroku 3 Oteplení):
  * Nejprve uživatel zvolí VÝROBCE SKŘÍNĚ z karet s logy: [ ABB ] [ EATON ] [ HAGER ] [ OEZ ] [ NOARK ] [ SCHRACK ] [ HENSEL ] [ RITTAL ] (a volitelně montáž: Vše / Pod omítku / Na omítku / Krytí IP).
  * DŮLEŽITÉ PRAVIDLO: Dokud není zvolen výrobce skříně, seznam rozváděčů nezobrazuj!
  * Jakmile uživatel vybere výrobce (např. ABB nebo Eaton), vyfiltruj a zobraz POUZE ty skříně daného výrobce, které VYHOVUJÍ aktuální velikosti navrženého rozváděče:
    - `skrin.rows >= aktualniPocetDinList`
    - `skrin.modulesPerRow >= maxModuluNaListe`
    - `skrin.totalModules >= celkemObsazenoModulu`
  * U každé vyhovující skříně (např. ABB Mistral41W 36M 3×12, ABB UK600 36M 3×12/14, Eaton KLV-36UPS-F 3×12/14, Hager Volta VU36NC, Hensel KV 9336, Rittal AX) zobraz její přesné rozměry V×Š×H [mm], krytí IP, maximální ztrátový výkon skříně P_max [W] a kolik % volné rezervy v ní zůstane. Kliknutím na skříň se její rozměry, model a P_max automaticky propíšou do projektu a výpočtu oteplení.

4. RAZÍTKO A LOGO V PROFILU FIRMY -> AUTOMATICKÝ PROPIS DO DOKUMENTACE:
- Rozšiř model "RegisteredCompany" (a nastavení firmy "/panel-builder/profile" resp. modal "Firemní údaje a razítko") o dva grafické vstupy:
  * `logoUrl String?` – Firemní logo (PNG / SVG / JPG).
  * `stampUrl String?` – Otisk razítka a podpisu projektanta / revizního technika (PNG/JPG s automatickým vyčištěním bílého pozadí na průhledné přes HTML5 Canvas při nahrání, aby razítko na čáře podpisu vypadalo jako skutečný modrý/černý otisk!).
- Automaticky propisuj nahrané `logoUrl` a `stampUrl` do všech výstupů v Kroku 4 ("Výstupní dokumentace a PDF export"):
  * `logoUrl`: Vykresli na Titulní straně (List 1), v rohovém razítku výkresů (Listy 1–6) a na Výrobním štítku CE.
  * `stampUrl`: Vykresli přímo do pole "Podpis a razítko odpovědné osoby výrobce" na Listu 6 (ES Prohlášení o shodě) a u protokolu kusové zkoušky.

5. EXPORT A TISK SAMOLEPICÍCH POPISKŮ ROZVÁDĚČE (MĚŘÍTKO 1:1):
- V detailu projektu (v horní liště i v Kroku 4 Dokumentace) přidej záložku / tlačítko "🏷️ Tisk popisků a štítků (1:1)":
  * Vygeneruj tiskovou A4 sestavu (`@media print` bez okrajů prohlížeče, s kontrolním kalibračním měřítkem "100 mm = 10 cm" pro ověření 100% tisku bez přizpůsobení stránce):
    1) SOUVISLÉ POPISOVACÍ PÁSY NAD/POD DIN LIŠTY: Pro každou DIN lištu (Lišta 1, Lišta 2...) vykresli souvislý samolepicí proužek v přesné fyzické šířce modulů (`1 modul = 17,5 mm` nebo přepínatelně `18,0 mm`, volitelná výška pásu `9 mm / 12 mm / 15 mm`). Každé políčko odpovídá šířce přístroje (1M = 17,5 mm, 3M = 52,5 mm, 4M = 70 mm), má barevný proužek podle fáze/skupiny, tučné označení (`-Q1`, `-FI1`, `-F1`), český název obvodu (`Zásuvky kuchyně`) a hodnotu (`B16`).
    2) JEDNOTLIVÉ ŠTÍTKY NA PŘÍSTROJE: Mřížka malých štítků (17 × 9 mm) s označením `-Q1`, `-FI1`, `-FA1`, `-F1`... k nalepení přímo na těla jističů.
    3) Možnost exportovat popisky také do CSV/XLSX pro štítkovačky Brother P-Touch / Dymo.

6. MOST PRO NAPOJENÍ NA PARALELNÍ DATABÁZI ("C:\Users\janou\Desktop\Claude\ai-panel-builder"):
- Vytvoř v Eldocku synchronizační a importní skript `scripts/sync-external-catalog.ts` (spouštěný přes `npm run catalog:sync`), který zkontroluje složku `C:\Users\janou\Desktop\Claude\ai-panel-builder` (nebo lokální JSON export v `prisma/external-catalog/`):
  * Načte z ní vygenerované výrobce, přístroje (`components`), jejich ETIM fasety (`facets`), 2D vektorové archetypy (`din_vector_archetype_id`), svorky (`terminals`), skříně rozváděčů (`enclosure` s `max_heat_dissipation_w`) i relační příslušenství (`component_relations` – boční 0,5M pomocné kontakty, vyrážecí spouště, hřebenové lišty a pojistkové vložky).
  * Bezpečně je přes dávkový `upsert` propíše do databáze Eldocku (`CatalogComponent` + vazby příslušenství), aby náš kaskádový konfigurátor a 2D vektorový editor okamžitě čerpal z této plné databáze.
- Doplň do seedu také kompletní matici standardních rozvodnic (12M, 14M, 18M, 24M, 36M, 48M, 54M, 60M, 72M, 96M, 120M, 144M) od výrobců ABB, Eaton, Hager, OEZ, Noark, Schrack, Hensel a Rittal, aby filtrování skříní podle velikosti ihned fungovalo pro jakoukoliv sestavu.

Ověř vše přes "npm run verify", aktualizuj testy, udělej commit a vypiš příkazy pro push a deploy na produkční server.

---

# 📄 ZADANI-faze-44.md

Vytvoř v projektu architektonický a výpočetní modul `src/engine/floorplan-bridge.ts` a dokumentaci `FLOORPLAN_SPEC.md`, který propojí chystaný 2D editor domovní elektroinstalace (půdorys) přímo s naším automatickým návrhářem rozváděčů (AI Panel Builder).

Modul musí implementovat tyto 4 deterministické kroky:

1. KALIBRACE MĚŘÍTKA PŮDORYSU (`calibrateFloorplanScale`):
   - Vstup: 1 nebo 2 referenční stěny z PDF/obrázku se souřadnicemi `[x1, y1, x2, y2]` v pixelech a reálnou délkou v `mm` + souřadnice hlavního rozváděče `[rx, ry]`.
   - Výstup: Přepočtová matice `pxToMm` (pro osu X a Y zvlášť pro kompenzaci zkosených skenů) a funkce `calculateCableLength(node)` počítající ortogonální (Manhattan) délku kabelu k rozváděči včetně svislých instalačních zón dle ČSN 33 2130 ed. 4 (+300 mm zásuvky, +1050 mm spínače, -300 mm stropní trasa) + kontrola úbytku napětí (<= 3 % světla, <= 5 % zásuvky).

2. STAVOVÝ AUTOMAT SVĚTEL A MATICE ŘAZENÍ VYPÍNAČŮ (`resolveSwitchWiring`):
   - Vstup: Počet nezávisle spínaných větví v místě `groups` (1 nebo 2), počet ovládacích míst `switchCount` (1 až N) a zvolený režim instalace (`classic` | `smart_relay` | `bus_loxone`).
   - Výstup v režimu `classic`:
     * G=1, S=1 -> 1x Řazení 1 (jednopólový spínač)
     * G=2, S=1 -> 1x Řazení 5 (sériový lustrový spínač)
     * G=1, S=2 -> 2x Řazení 6 (střídavý přepínač)
     * G=2, S=2 -> 2x Řazení 6+6 / 5B (dvojitý střídavý přepínač)
     * G=1, S=3 -> 2x Řazení 6 + 1x Řazení 7 (křížový přepínač)
     * G=1, S>=4 -> Doporučení: Tlačítka Řazení 1/0 + Impulzní paměťové relé na DIN lištu v rozváděči (např. ELKO MR-41 / CRM-91H).
   - Výstup v režimu `smart_relay` (Shelly Pro / iNELS) a `bus_loxone` (Loxone Tree):
     * Přepne nástěnné prvky na tlačítka / Loxone Touch Tree (s integrovaným termostatem) a vygeneruje požadavek na příslušný počet digitálních vstupů/výstupů (DI/DO) pro světla a žaluzie v rozváděči.

3. NORMATIVNÍ SHLUKOVAČ OKRUHŮ DLE ČSN 33 2130 ed. 4 (`generateCircuitsFromFloorplan`):
   - Rozlišení `single_socket` vs `double_socket`: Pro limit max. 10 zásuvkových vývodů na okruh počítej dvojzásuvku jako 1 vývod, ale do kusovníku (BOM) ulož přesný typ dvojzásuvky.
   - Zásuvky se štítkem (`oven`, `dishwasher`, `washer`, `dryer`, `boiler`, `microwave_builtin` >= 2000 W) vyčleň každou na samostatný jisticí okruh B16A 1P (CYKY-J 3x2.5).
   - Štítek `cooktop_3p` vyčleň na 3f jistič B16A 3P (CYKY-J 5x2.5).
   - Štítek `fridge` vyčleň na samostatný jističochránič RCBO B16A/30mA Typ A (prioritní nevypínaná větev).
   - Štítek `ev_charger` nebo `heat_pump` vyčleň na 3f jistič + Proudový chránič Typ B.
   - Běžné zásuvky bez určení seskup podle blízkosti a místností po max. 10 vývodech na jeden okruh B16A 1P.
   - Světla seskup do světelných okruhů B10A 1P (CYKY-J 3x1.5), vždy min. 2 nezávislé světelné okruhy na dům/byt.

4. AUTOMATICKÝ GENERÁTOR ROZVÁDĚČE A VYVAŽOVÁNÍ FÁZÍ (`buildSwitchboardFromCircuits`):
   - Rozděl 1f okruhy rovnoměrně mezi fáze L1, L2, L3 pomocí hladového algoritmu (Greedy Phase Balancing) podle soudobého příkonu.
   - Rozděl okruhy pod proudové chrániče 30mA Typ A (max. 5 až 6 okruhů na jeden 4P chránič, přičemž světla a zásuvky ze stejné místnosti nesmí viset na stejném chrániči) + ke každému chrániči přidej do kusovníku izolovaný N-můstek a hřebenovou lištu.
   - Přidej hlavní vypínač, svodič přepětí T1+T2, rozbočovací svorkovnici HLAK a (v případě Smart Home režimu) vypočtený počet modulů Loxone (Miniserver + Relay Extension + zdroj 24V DC) nebo Shelly Pro.
   - Sečti celkový počet modulů (`width_modules`), přičti 25% rezervu a vyber z naší databáze odpovídající skříň rozváděče tak, aby splňovala oteplení (`total_power_loss_w <= enclosure.max_heat_dissipation_w`).

Napiš čistý TypeScript kód s plnou typovou kontrolou a přidej jednotkový test, který ověří celý průchod od vzorového rodinného domu až po seznam přístrojů na DIN lištách.

---

# 📄 ZADANI-faze-45.md

Na základě testování obrazovky "1. Návrh osazení" (Konfigurátor prvku + 2D vektorové plátno) provedeme 4 klíčová vylepšení UX a inženýrské logiky. Uprav příslušné komponenty následovně:

### 1. EDITOVATELNÉ ŠTÍTKY FUNKCÍ + CHYTRÉ PRESETY (v sekci "Funkce / Popis obvodu")
- Ze současných statických tlačítek (`Hlavní vypínač`, `Chránič 1`, `Chránič 2`, `Světla`, `Zásuvky`, `Kuchyně`, `Koupelna`, `Varná deska`, `Trouba`, `Myčka / Pračka`, `Bojler / TČ`, `Topení`, `Venek / Garáž`) udělej plně editovatelný systém uložený v `localStorage` (a synchronizovatelný do DB):
  1. Na konec seznamu přidej tlačítko `+ Přidat vlastní` a přepínač `✎ Upravit štítky`.
  2. V režimu úprav umožni štítky přejmenovat, smazat, měnit jejich pořadí a nastavit každému štítku volitelný **Smart Preset** (výchozí kategorii, počet pólů, charakteristiku a proud – např. kliknutí na `Varná deska` může automaticky nastavit `Jistič -> 3P (3M) -> B -> 16A`, kliknutí na `Chránič` přepne kategorii B na `Chránič`).
  3. Přidej automatické číslování: pokud v rozváděči už existuje prvek s popisem `Chránič 1` nebo `Světla 1`, další kliknutí automaticky nabídne `Chránič 2` / `Světla 2`.

### 2. REDESIGN PRAVÉHO PANELU – PŘESUN VÝSLEDNÉHO MODULU NAHORU (STICKY BAR)
- Současná karta `D. PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ` je příliš dole a vyžaduje dlouhé scrollování.
- Proveď tyto UX úpravy pravého sloupce (`Konfigurátor prvku`):
  1. Slouč duplicitní sekce `PŘIŘAZENÝ PŘÍSTROJ` a `D. PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ` do jedné kompaktní **Sticky karty nahoře** (hned pod řádkem s označením `-F4` / `Ověřeno` a polem `Funkce / Popis obvodu`), aby byla neustále viditelná přímo vedle DIN lišt na levém plátně.
  2. Pokud je na plátně vybraný existující přístroj (např. `-F4`), změny parametrů v sekcích A, B, C1–C4 musí okamžitě aktualizovat vybraný prvek na DIN liště v reálném čase (Live Sync).
  3. U tlačítka `+ Vložit na aktivní lištu (1x / +3x / +6x)` přidej chytrou logiku: pokud je aktivní lišta plná (např. `Lišta 2 - volno 0 M`) nebo se tam přístroj o šířce `4M` nevejde, tlačítko automaticky nabídne `Vložit na Lištu 1 (volno 7 M)` nebo `+ Přidat novou lištu a vložit`.
  4. Sekci `C5. ŠÍŘKA V MODULECH (RUČNĚ)` a pole `Exotický prvek – text z čela přístroje` zabal do rozbalovacího akordeonu `Pokročilé / Ruční korekce a AI dohledání`, čímž se pravý panel zkrátí o třetinu.

### 3. FUNKCE "PROSTŘEDÍ A VNĚJŠÍ VLIVY" (dle ČSN 33 2000-5-51 ed. 3)
- Do horní lišty nad plátnem (vedle informace o skříni `J4 - Nástěnný rozváděč - IP 41` a tlačítka `Výběr skříně rozváděče`) přidej selektor **Prostředí instalace**:
  1. `Interiér – Byt / Technická místnost (Suché - AA5/AD1)` -> min. IP 20/30, T_amb = 25 °C.
  2. `Garáž / Dílna / Sklep (Vlhkost a prach - AD2/AE4/AG2)` -> min. IP 44/54, min. IK 07, T_amb = 25 °C.
  3. `Venkovní prostředí / Fasáda / FVE (Déšť a UV - AA4/AD4/AN2)` -> min. IP 54/65, vyžaduje UV stabilní skříň, T_amb = -25 až +40 °C.
  4. `Dřevostavba / Hořlavý podklad (CA2/CB1)` -> skříň se zkouškou žhavou smyčkou 850 °C + doporučení AFDD.
  5. `Kotelna / Střídačovna FVE / Průmysl (Zvýšená teplota - AA6)` -> nastaví výchozí teplotu okolí pro výpočet oteplení na 35 °C a započítá teplotní derating jističů.
- Pokud aktuálně zvolená skříň (např. `IP 41`) nevyhovuje zvolenému prostředí (např. `Garáž` nebo `Venek`), zobraz v horní liště varovný odznak s tlačítkem `Vybrat vhodnou skříň (min. IP 54)`.

### 4. INTEGROVANÝ "ELEKTRO-LINTER" (KONTROLA CHYB A NOREM V REÁLNÉM ČASE)
- Vytvoř validační modul `validateSwitchboardState()`, který při každé změně zkontroluje rozváděč a zobrazí chyby (červeně) a varování (oranžově) s tlačítkem `[Opravit 1 klikem]`:
  1. **Kontrola štítku vs. kategorie přístroje:** Upozorni, pokud má prvek v názvu/štítku "Chránič", ale jeho kategorie je `Jistič` (jako u `-F1` na Liště 1), nebo pokud má štítek "Hlavní vypínač", ale je to `1P` jistič.
  2. **Kontrola souladu popisu a počtu pólů:** Upozorni, pokud text popisu obsahuje `3P` (např. `Jistič 3P B16 6 kA`), ale prvek má nastaveno `4P (4M)` (jako u `-F4` na Liště 2). Nabídni tlačítko pro automatickou synchronizaci textu s parametry.
  3. **Kontrola proudových chráničů (ČSN 33 2000-4-41):** Upozorni, pokud jsou v rozváděči okruhy `Zásuvky`, `Koupelna`, `Kuchyně`, `Venek / Garáž` a v rozváděči není osazen žádný `Chránič` ani `Jističochránič`, nebo pokud na jeden chránič připadá více než 6 koncových okruhů.
  4. **Kontrola rezervy modulů a kompatibility na liště:** Upozorni, pokud volná rezerva skříně klesne pod 20 % (dle ČSN EN 61439), nebo pokud jsou na jedné DIN liště vedle sebe smícháni různí výrobci (např. ABB + Eaton), které nelze propojit společnou hřebenovou lištou.
  5. **Kontrola jmenovitých proudů:** Upozorni, pokud je jmenovitý proud podružného jističe nebo chrániče nevhodně dimenzován vůči hlavnímu vypínači `-Q1`.

Po implementaci zkontroluj překlad přes `npx tsc --noEmit` a ověř funkčnost v prohlížeči.

---

# 📄 ZADANI-faze-46.md

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

---

# 📄 ZADANI-faze-47.md

Provedeme 6 zásadních úprav v AI Panel Builderu, Katalogu prvků a rozpoznávání reálných velkých rozváděčů (podle rozboru 144modulového rozváděče ABB CA35R z projektu PB-009 a jeho detailních fotek).

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj:

1. ODSTRANĚNÍ 9 NEPOUŽÍVANÝCH VÝROBCŮ + OFICIÁLNÍ VEKTOROVÁ LOGA ZNAČEK:
- Ze seznamu výrobců v AI Panel Builderu (Konfigurátor, Katalog, filtry i AI párování) kompletně ODSTRAŇ těchto 9 značek:
  `Finder`, `Shelly`, `Mean Well`, `Dehn`, `Relpol`, `Pilz`, `Weidmüller`, `Elko EP`, `Pollmann`.
- Ponech hlavní značky používané v naší praxi (ABB, Eaton, OEZ, Schneider Electric, Hager, Noark, Bonega, Schrack, Siemens, ETI, SEZ, Saltek, Hakel, Legrand, Loxone, Eastron, Wago, Phoenix Contact, Omron, Hensel, Rittal).
- Vytvoř komponentu `src/components/panel-builder/ManufacturerLogo.tsx`, která místo obyčejných barevných čtverečků s iniciálami ("E", "SE", "H", "N"...) vykreslí autentická, čistá SVG vektorová loga (wordmarky) v oficiálních barvách a typografii daných výrobců (ABB červené tučné dělené logo, EATON modrobílé, OEZ modré, Schneider Electric zelené, Hager, NOARK, BONEGA, SCHRACK, SIEMENS, ETI, SALTEK, HAKEL, LEGRAND, LOXONE, WAGO, HENSEL, RITTAL).

2. NOVÁ STRUKTURA "KATALOG PRVKŮ" (/panel-builder/catalog) -> VÝROBCI -> KATEGORIE -> PRVKY:
- Přepracuj stránku `/panel-builder/catalog`, aby po otevření neukazovala nepřehlednou tabulku 2500+ řádků, ale fungovala jako čistý vizuální katalog ve 3 krocích:
  * KROK 1 (Rozcestník výrobců): Zobraz přehledné karty aktivních výrobců s jejich oficiálními SVG logy a počtem prvků v databázi (+ globální vyhledávací pole nahoře).
  * KROK 2 (Rozcestník kategorií vybraného výrobce): Po kliknutí na výrobce (např. ABB) zobraz hlavičku výrobce s tlačítkem `[ ← Zpět na všechny výrobce ]` a velkými kartami kategorií:
    - `Jističe (MCB)`
    - `Proudové chrániče (RCD)`
    - `Jističochrániče (RCBO – vč. 1M kompaktních DS301C)`
    - `Odpínače a hlavní vypínače`
    - `Přepěťové ochrany (SPD)`
    - `Stykače a instalační relé (vč. ručních EN25-40N)`
    - `Smart Home / KNX / free@home a řídicí moduly`
    - `Rozvodnice a skříně rozváděčů (12M až 144M+)`
    - `Domovní vypínače, zásuvky a rámečky (Tango, Levit, Unica, Valena...)`
    - `Svorkovnice, hřebeny a příslušenství`
  * KROK 3 (Přehled prvků kategorie): Rychlé filtrovací dlaždice parametrů a přehledný seznam prvků.

3. INTEGRACE DOMOVNÍCH PŘÍSTROJŮ (VYPÍNAČE, ZÁSUVKY, RÁMEČKY) + DOPLNĚNÍ KATALOGU ABB Z PRAXE:
- Do katalogu modulárních přístrojů ABB doplň přesné prvky z našeho reálného 144M rozváděče:
  * Skříň `ABB CA35R (Z151218)` – nástěnná rozvodnice ComfortLine 144 modulů (4 řady × 36M, tj. dvoupolová 24M + jedno pole 12M, 800×800×160 mm, IP44).
  * Kompaktní 1M jističochrániče `ABB DS301C` (1P+N v 1 modulu, 30mA typ A: `DS301C B6 A30`, `DS301C B10 A30`, `DS301C B13 A30`, `DS301C B16 A30`, `DS301C C16 A30`).
  * Instalační stykače s ručním ovládáním `ABB EN20-20N`, `ABB EN25-40N`, `ABB EN40-40N` (šířka 2M / 3M, přepínač OFF-AUTO-ON).
  * Jistič `ABB S201-B2` (2A pro jištění větrání/ovládání), `S203-B16`, `S203-B20`, chránič `FH204 A-40/0,03` (`2CSF204102R1400`) a řídicí aktory ABB-free@home / KNX (4M, 8M, 12M).
- Rozšiř synchronizační skript `scripts/sync-external-catalog.ts` (a seed katalogu), aby z `C:\Users\janou\Desktop\Claude\ai-panel-builder\catalog\wiring` načetl domovní spínače, zásuvky a rámečky (1R až 6R):
  * ABB (`Tango`, `Levit`, `Decento`, `Neo`, `Element`, `Time`, `Swing`, `Basic55`, `Future Linear`, `Solo`, `Busch-axcent`, `Zoni`, `Classic`, `Garant`), Schneider (`Nová Unica`, `Sedna`, `Asfora`), Legrand (`Valena Life`, `Valena Allure`, `Niloe`, `Celiane`, `Mosaic`, `Plexo`).
- Umožni domovní vypínače/zásuvky přiřazovat jak v **AI Panel Builderu** (soupis domovní instalace k obvodům), tak ve **Studiu (Krok 3)** v místnostech.

4. NOVÁ PŘESNÁ PRAVIDLA PRO VISION ANALYZER (PODLE ROZBORU 144M SKŘÍNĚ ABB CA35R):
V `geminiPanelService.ts` a v post-processingu detekcí zaveď těchto 6 přesných elektrotechnických pravidel:
- PRAVIDLO A (Podpora velkých a vícesloupcových skříní 24M / 36M / 144M):
  * Rozváděče mohou mít šířku řady 12M, 14M, 18M, 24M nebo 36M (např. skříň 144M má v jedné řadě levé pole 24M a pravé pole 12M oddělené svislou příčkou = 36M celkem). Nezkracuj uměle 24M ani 36M lišty!
  * Pokud AI na fotce vidí neosazený volný kus DIN lišty (prázdný kovový profil mezi skupinami přístrojů), NESMÍ ho vyplňovat smyšlenými moduly – započítá pouze skutečně osazené přístroje.
- PRAVIDLO B (Počítání TĚL A PÁČEK, nikoliv šroubků!):
  * ZRUŠ slepé pravidlo "1 šroubek = 1 modul"!
  * Důvod 1: Kompaktní 1M jističochrániče (`ABB DS301C` / `DSN201`) mají šířku POUZE 1 MODUL (17,5 mm), ale nahoře mají 2 šroubky vedle sebe (`1/2` a `N`), 1 úzkou černou páčku s červeným `I-ON` a malé bílé tlačítko TEST. Jde o JEDEN 1M přístroj (`RCBO 1P+N 1M`), nikoliv o dva 1P jističe!
  * Důvod 2: Šedé řídicí moduly chytré elektroinstalace (KNX / ABB-free@home / Loxone v pravém poli skříně) mají šířku 4M, 8M nebo 12M a řadu 16 drobných šroubků nahoře a dole. Jde o JEDEN široký řídicí modul (`OTHER / SMART_HOME`), nikoliv o 16 samostatných jističů!
  * Důvod 3: Řadové svorky (šedé úzké svorky se žlutými/červenými vodiči na kraji lišty) označ jako `TERMINAL (-X)`, nikoliv jako jističe.
- PRAVIDLO C (Rozlišení 3P jističe `S203` od 4P chrániče `FH204`):
  * Nepředpokládej, že každá lišta začíná proudovým chráničem! V praxi jsou často všechny chrániče (např. `3× ABB FH204 A 40A/0,03A`) umístěné vedle sebe na 1. liště, zatímco 3. a 4. lišta začíná třípólovými jističi (`ABB S203 B20` nebo `S203 B16`).
  * `4P Chránič (RCD, 4M)`: má páčku jen v pravé části, vlevo má velkou bílou plochu s popisem a oválné tlačítko `TEST`.
  * `3P Jistič (MCB, 3M, např. S203 B20 / B16)`: má širokou černou ovládací páčku spojenou přes VŠECHNY 3 moduly, bez tlačítka TEST!
- PRAVIDLO D (Rozpoznání instalačních stykačů `ABB EN25-40N` / `ESB`):
  * Bílý 2modulový přístroj bez klasické černé jističové páčky, který má na čele malý svislý posuvník `OFF - AUTO - ON` a označení `EN25-40N` nebo `ESB25`, je vždy **Instalační stykač (`CONTACTOR`, `-K`, 2M, 25A)** – nikdy z čísla 25 v kódu `EN25` nedělej 25A jistič!
- PRAVIDLO E (Čtení hodnot B10, B16, B20, B2 a 40A):
  * U jističů ABB S201/S203 pozorně čti hodnotu přímo pod červeným proužkem: rozlišuj `B16`, `B10`, `B20` a `B2` (2A jistič např. pro větrání). U chráničů `FH204 A` čti přesně `40A` vs `25A` (`40A IΔn = 0,03A`).
- PRAVIDLO F (Nahrání detailních fotek jednotlivých lišt / sekcí v Kroku 1):
  * Protože u velkých 144M rozváděčů je na celkové fotce text drobný, přidej v Kroku 1 k celé fotce i přímo ke každé DIN liště tlačítko `[ 📷 Nahrát detailní fotku této lišty / sekce ]` (nebo nahrání více detailních fotek najednou při zakládání projektu). Když uživatel nahraje detailní fotku lišty/sekce, AI přečte přesné texty (`DS301C B16`, `EN25-40N`, `FH204 A 40A`, `S203 B20`) přímo z ostrého detailu!

5. TLAČÍTKO "+ PŘIDAT PRVEK VPRAVO" A "DUPLIKOVAT" VEDLE "SMAZAT PRVEK":
- V pravém panelu `Konfigurátor prvku` (Krok 1) hned vedle červeného tlačítka `[ 🗑️ Smazat prvek ]` přidej na stejný řádek:
  * `[ ➕ Přidat prvek vpravo ]` – vloží nový přístroj hned napravo za právě vybraný prvek na téže DIN liště a vybere ho k úpravě.
  * `[ 📑 Duplikovat prvek ]` – vloží napravo od aktuálního prvku jeho přesnou kopii se stejnými parametry.

6. ČISTÝ A NERUŠIVÝ "ELEKTRO-LINTER" (KOMPAKTNÍ ODZNAK MÍSTO VELKÉHO BOXU):
- Odstraň velký rozbalený žlutý box `Elektro-linter` přímo nad 2D vektorovým rozváděčem.
- Místo něj zobraz v horní liště nad plátnem pouze malý klikací odznak: `[ ⚠️ X doporučení ▾ ]` (po kliknutí se otevře plovoucí popover s detaily a možností skrýt). Zruš falešné varování o smíchaných výrobcích u přepěťovek, zdrojů, stykačů a chytrých modulů.

Po implementaci spusť `npm run verify`, aktualizuj testy, udělej commit a vypiš příkazy pro push a deploy na produkční server.

---

# 📄 ZADANI-faze-48.md

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

---

# 📄 ZADANI-faze-49.md

Implementujeme Fázi 49: "Vizuální 2D editor půdorysu elektroinstalace, 3D výpočet kabeláže s montážními výškami (Vrchem / Spodem / Optimalizovaně) a automatický generátor rozváděče".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 5 bodech:

1. ROZŠÍŘENÍ VÝPOČETNÍHO JÁDRA O 3D VÝŠKOVÝ PROFIL A REŽIMY TAHÁNÍ KABELŮ (`src/engine/floorplan-bridge.ts`):
Rozšiř výpočet délky kabelů (`calculateCableLength` a `generateCircuitsFromFloorplan`) o plný 3D výškový model v milimetrech:
- Globální výškové parametry podlaží (`ElevationProfile`):
  * `ceilingHeightMm`: Světlá výška stropu / podhledu pro vedení kabelů vrchem (výchozí `2600 mm`).
  * `floorDepthMm`: Hloubka uložení kabelu v podlaze / mazanině (výchozí `50 mm`).
  * `switchboardHeightMm`: Výška středu / vstupu rozváděče od čisté podlahy (výchozí `1500 mm`).
  * `defaultSocketHeightMm`: Výchozí výška běžných zásuvek od podlahy (výchozí `300 mm` dle ČSN 33 2130 ed. 4).
  * `worktopSocketHeightMm`: Výchozí výška zásuvek nad kuchyňskou linkou / v koupelně (`1150 mm`).
  * `defaultSwitchHeightMm`: Výchozí výška vypínačů / ovladačů od podlahy (`1050 mm`).
  * `slackPercent`: Technologická rezerva na ohyby a nepřesnosti trasy (výchozí `10 %`) + pevný přídavek na zapojení (`+600 mm` v rozváděči a `+150 mm` v každé krabici KU68).
- Individuální výška prvku: Každý uzel (`FloorNode`) může mít vlastní `mountHeightMm` (pokud není zadána, vezme se výchozí podle typu: běžná zásuvka `300 mm`, kuchyňská/pracovní zásuvka `1150 mm`, vypínač `1050 mm`, stropní světlo `ceilingHeightMm`).
- 3 REŽIMY VEDENÍ KABELÁŽE (`CableRoutingMode = "BOTTOM" | "TOP" | "OPTIMIZED"`):
  1) `BOTTOM` ("Spodem – v podlaze / mazanině"):
     - Svislý svod z rozváděče do podlahy: `switchboardHeightMm + floorDepthMm`.
     - Vodorovná ortogonální (Manhattan) trasa v podlaze: `|x2 - x1| + |y2 - y1|`.
     - Svislý výstup z podlahy do krabice prvku: `node.mountHeightMm + floorDepthMm` (u řetězených zásuvek v jednom okruhu jde přechod mezi sousedními zásuvkami ze zásuvky dolů do podlahy a zpět nahoru do další zásuvky: `2 * (mountHeightMm + floorDepthMm)`, pokud nejsou ve společném vícenásobném rámečku).
  2) `TOP` ("Vrchem – v podhledu / stropem"):
     - Svislý výstup z rozváděče do stropu: `(ceilingHeightMm - switchboardHeightMm)`.
     - Vodorovná ortogonální trasa ve stropě: `|x2 - x1| + |y2 - y1|`.
     - Svislé spuštění ze stropu dolů k prvku: `(ceilingHeightMm - node.mountHeightMm)`.
  3) `OPTIMIZED` ("Optimalizovaně – kombinace a nejmenší spotřeba kabelů"):
     - Pro každý okruh nezávisle spočítá variantu `BOTTOM` i variantu `TOP` a vybere pro daný okruh tu kratší a technicky nejvýhodnější (typicky: nízko položené zásuvky `300 mm` vede spodem v podlaze, stropní světla a vysoko položené vývody vede vrchem v podhledu; u řetězených zásuvek ve výšce `1150 mm` nad kuchyňskou linkou povolí přímé vodorovné propojení ve zdi ve stejné výšce bez scházení k podlaze!).
- Výstup výpočtu (`CableSummary`) musí vždy vracet porovnání všech 3 režimů:
  * Celková metráž v režimu `Spodem [m]`, `Vrchem [m]` a `Optimalizovaně [m]` + vyčíslená úspora v metrech (`Ušetřeno X m kabelu`).
  * Rozpad metráže podle průřezu a typu kabelu (`CYKY-J 3×1,5`, `CYKY-O 3×1,5`, `CYKY-J 3×2,5`, `CYKY-J 5×2,5`, `CYKY-J 5×4`, `CYKY-J 5×6`, `UTP Cat6`) a kontrolu úbytku napětí ΔU [%] na nejdelší větvi každého okruhu.

2. VIZUÁLNÍ 2D EDITOR PŮDORYSU ELEKTROINSTALACE (`/panel-builder/floorplan`):
Vytvoř novou interaktivní stránku `/panel-builder/floorplan` (dostupnou z modalu "Nový projekt rozváděče" i z horní lišty Panel Builderu jako `📐 2D Půdorys & Kabeláž`):
- PODKLAD PŮDORYSU:
  * Uživatel může nahrát vlastní obrázek půdorysu (PNG/JPG/WEBP/SVG) nebo PDF výkres stavby (vykreslený přes `pdf.js`), NEBO si přepnout na čistý rastr s rychlým nakreslením obdélníků místností myší.
- KALIBRACE MĚŘÍTKA NA 2 KLIKY:
  * Nástroj `[ 📏 Kalibrovat měřítko ]`: uživatel klikne na začátek a konec známé stěny nebo kóty ve výkresu a zadá reálnou délku (např. `4500 mm` / `4,5 m`) -> plátno okamžitě přepočítá měřítko a zobrazuje všechny vzdálenosti a trasy v reálných metrech.
- HORNÍ LIŠTA VÝŠEK A ZPŮSOBU TAHÁNÍ KABELŮ:
  * Přepínač trasy: `[ ⬇ Spodem (v podlaze) ]` · `[ ⬆ Vrchem (stropem/podhledem) ]` · `[ ✨ Optimalizovaně (Auto) ]`.
  * Rychlé nastavení výšek (v mm od podlahy): `Strop: [2600] mm` · `Rozváděč: [1500] mm` · `Zásuvky: [300] mm` · `Kuchyně/Linka: [1150] mm` · `Vypínače: [1050] mm`.

3. OSAZOVÁNÍ PRVKŮ DO PŮDORYSU A ŽIVÉ VYKRESLENÍ TRAS KABELŮ:
- V levém panelu zobraz paletu elektroinstalačních značek rozdělenou do 4 skupin:
  1. `⚡ Rozváděč`: Hlavní domovní / bytový rozváděč (výchozí bod všech tras).
  2. `🔌 Zásuvky`: Jednozásuvka (300 mm), Dvojzásuvka (300 mm), Zásuvka nad linkou (1150 mm), Zásuvka IP44 koupelna/venek (1150 mm), Datová zásuvka RJ45.
  3. `💡 Světla a vypínače`: Stropní svítidlo (2600 mm), Nástěnné svítidlo (2000 mm), Vypínač č. 1, Sériový č. 5, Střídavý č. 6, Křížový č. 7, Tlačítko (1050 mm). Kliknutím lze spárovat vypínač se světlem, které ovládá (vykreslí se čárkovaná ovládací vazba a podle počtu spínačů na jedno světlo se automaticky určí řazení 1 / 6 / 7!).
  4. `🔥 Samostatné spotřebiče (vlastní jisticí okruh)`: Varná deska 3f (400V), Trouba, Myčka, Pračka, Sušička, Chladnička (RCBO), Bojler, Tepelné čerpadlo, Wallbox EV.
- DETAIL VYBRANÉHO PRVKU V PŮDORYSU:
  * Po kliknutí na osazený prvek v půdorysu může uživatel upravit jeho přesnou **Montážní výšku [mm]**, název místnosti, počet kusů v rámečku (1R až 5R) a vybrat konkrétní **designovou řadu** z naší databáze `WiringDevice` (např. *ABB Levit*, *ABB Tango*, *ABB Zoni*, *Schneider Nová Unica*, *Legrand Valena Life*).
- VIZUALIZACE KABELOVÝCH TRAS:
  * Přímo nad půdorysem vykresluj ortogonální (Manhattan) trasy kabelů od rozváděče k jednotlivým okruhům (barevně odlišené podle okruhů, s popiskem délky v metrech včetně svislých svodů/výstupů).

4. ŽIVÁ KARTA METRÁŽE KABELŮ A PŘEVOD DO ROZVÁDĚČE NA 1 KLIK:
- V pravém panelu zobraz živou tabulku **„Výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4)“**:
  * Porovnání celkové délky: `Spodem: X m` | `Vrchem: Y m` | `Optimalizovaně: Z m (úspora N m)`.
  * Přesný rozpis kabelů k nákupu (např. `CYKY-J 3×2,5 mm²: 142 m`, `CYKY-J 3×1,5 mm²: 98 m`, `CYKY-J 5×2,5 mm²: 18 m`) včetně kontroly úbytku napětí ΔU.
  * Tlačítko **`[ ⚡ Vygenerovat rozváděč z tohoto půdorysu ]`**: zavolá `generateCircuitsFromFloorplan` + `buildSwitchboardFromCircuits`, vytvoří kompletně osazený projekt v AI Panel Builderu (se všemi jističi, chrániči, vyváženými fázemi, vybranou skříní, přiřazenými domovními vypínači/zásuvkami a uloženým výkazem kabeláže v dokumentaci) a přesměruje do `/panel-builder/[id]`.

5. TESTY A VERIFIKACE:
- Napiš unit testy pro 3D výpočet kabeláže (`BOTTOM` vs `TOP` vs `OPTIMIZED`, změna výšky zásuvky z 300 mm na 1150 mm, změna výšky stropu a rozváděče) a E2E test pro 2D půdorys. Spusť `npm run verify` a udělej commit.

---

# 📄 ZADANI-faze-50.md

Implementujeme Fázi 50: "SuperAdmin velín (/superadmin), samoobslužné dobíjení kreditů s českou QR platbou (SPD) a zálohovou fakturou, a systém hlášení chyb AI rozpoznání od testerů".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 5 bodech:

1. DATOVÝ MODEL PRO OBJEDNÁVKY KREDITŮ A HLÁŠENÍ CHYB AI (Prisma migrace):
Rozšiř `prisma/schema.prisma` (a vytvoř čistou migraci) o dva modely:
a) Model `CreditOrder` (Objednávky kreditů a tarifů v AI Panel Builderu):
   - `id` (String @id @default(cuid()))
   - `companyId` (String, vazba na `RegisteredCompany`, onDelete: Cascade)
   - `variableSymbol` (String @unique – např. `"20260001"`)
   - `packageCode` (String – `"START_10"` | `"PROFI_30"` | `"UNLIMITED_YEAR"`)
   - `creditsCount` (Int – `10`, `30`, `200`)
   - `priceCzkExclVat` (Int – `990`, `2490`, `5900`)
   - `priceCzkInclVat` (Int – částka s 21% DPH)
   - `status` (enum `CreditOrderStatus`: `PENDING` = Čeká na úhradu, `PAID` = Uhrazeno a kredity připsány, `CANCELLED` = Stornováno) @default(PENDING)
   - `paidAt` (DateTime?), `createdAt` (DateTime @default(now()))
b) Model `AiFeedbackReport` (Hlášení chyb AI rozpoznání a zpětná vazba od testerů):
   - `id` (String @id @default(cuid()))
   - `projectId` (String?, vazba na `PanelBoardProject`, onDelete: SetNull)
   - `companyId` (String?, vazba na `RegisteredCompany`, onDelete: SetNull)
   - `photoUrl` (String? – kopie URL fotky rozváděče v okamžiku hlášení)
   - `detectedSnapshotJson` (String – snímek rozpoznaných lišt a prvků)
   - `message` (String – popis chyby od testera, např. "Špatně rozpoznaný stykač na 2. liště")
   - `status` (String @default("OPEN") – `"OPEN"` | `"RESOLVED"`)
   - `adminNote` (String?)
   - `createdAt` (DateTime @default(now()))

2. SAMOOBSLUŽNÉ DOBÍJENÍ KREDITŮ + ČESKÝ QR KÓD PLATBY (SPD) A ZÁLOHOVÁ FAKTURA:
- V horní liště AI Panel Builderu (`PanelBuilderHeader`) udělej ze žlutého štítku `Kredity: X` klikací tlačítko `[ 🪙 Kredity: X (+ Dobít) ]`. Stejný dialog automaticky otevři, pokud se uživatel s 0 kredity pokusí založit nový projekt.
- Dialog / stránka `/panel-builder/credits` ("Dobít kredity pro AI Panel Builder"):
  * Nabídne 3 jasné balíčky:
    1) **Balíček 10 rozváděčů (`START 10`)** – 10 kreditů · **990 Kč** bez DPH (99 Kč / rozváděč)
    2) **Balíček 30 rozváděčů (`PROFI 30`)** – 30 kreditů · **2 490 Kč** bez DPH (83 Kč / rozváděč – nejoblíbenější)
    3) **Roční neomezený tarif (`PROJEKTANT ROK`)** – 200 kreditů na 12 měsíců · **5 900 Kč** bez DPH
  * Po kliknutí na `[ Objednat balíček ]` se v databázi založí `CreditOrder` s unikátním variabilním symbolem a uživateli se okamžitě zobrazí:
    - **Oficiální český QR kód pro mobilní bankovnictví (formát SPD 1.0)**:
      `SPD*1.0*ACC:${IBAN}*AM:${castka}.00*CC:CZK*X-VS:${vs}*MSG:ELDOCK Kredity ${companyName}` vykreslený přes `qrcode.react` (číslo účtu / IBAN čti z env `ELDOCK_BANK_IBAN` s bezpečným výchozím demo IBANem v `COMPANY_INFO`).
    - Tlačítko **`[ 🖨️ Vytisknout / Stáhnout zálohovou fakturu (PDF) ]`**, které otevře čistou A4 tiskovou sestavu zálohové faktury se všemi fakturačními údaji odběratele (`RegisteredCompany` – název, IČO, DIČ, sídlo), dodavatele (`COMPANY_INFO`), rozpisem DPH 21 % a QR kódem platby.

3. TLAČÍTKO "🐛 NAHLÁSIT CHYBU AI" PŘÍMO V PROJEKTU PANEL BUILDERU:
- V detailu projektu (`/panel-builder/[id]`) přidej do horní lišty tlačítko `[ 🐛 Nahlásit chybu AI ]`.
- Po kliknutí se otevře jednoduchý dialog: *"Našli jste chybu v rozpoznání přístrojů nebo ve schématu? Napište nám krátkou poznámku – pomůžete nám AI dál zpřesnit."*
- Po odeslání se uloží `AiFeedbackReport` včetně odkazu na fotku rozváděče a JSON snímku lišt, a tester dostane poděkování v toastu.

4. TVŮJ OBCHODNÍ A TECHNICKÝ VELÍN `/superadmin`:
- Vytvoř chráněnou sekci `/superadmin` (a přihlášení `/superadmin/login` ověřující heslo z env `ELDOCK_SUPERADMIN_PASSWORD`, s výchozím fallbackem na `ELDOCK_ACCESS_PASSWORD` + podepsanou httpOnly cookie `eldock-superadmin`; uprav `src/proxy.ts`, aby `/superadmin` vyžadoval tuto cookie).
- Stránka `/superadmin` obsahuje 4 přehledné části:
  a) **KPI dlaždice nahoře:** Počet registrovaných firem (Panel Builder / Závody), celkem vygenerovaných rozváděčů, čekající objednávky kreditů (`PENDING` + suma v Kč) a otevřená hlášení chyb AI (`OPEN`).
  b) **Záložka 1 – Registrované firmy a správa kreditů (`RegisteredCompany`):**
     - Tabulka všech firem (Název, IČO, DIČ, město, kontaktní osoba, e-mail, telefon, TIČR, datum registrace, počet projektů, zbývající kredity).
     - Přímo na řádku firmy rychlá tlačítka: `[ +5 kreditů ]`, `[ +10 kreditů ]`, `[ +50 kreditů ]`, pole pro ruční nastavení počtu kreditů a rozbalení všech projektů a fotek rozváděčů dané firmy.
  c) **Záložka 2 – Objednávky kreditů a fakturace (`CreditOrder`):**
     - Seznam objednávek s variabilním symbolem, firmou, balíčkem, částkou a stavem.
     - Tlačítko **`[ ✅ Potvrdit úhradu a připsat kredity ]`**: v jedné transakci přepne objednávku na `PAID`, uloží `paidAt` a automaticky přičte firmě koupený počet kreditů (`creditsRemaining += order.creditsCount`)!
  d) **Záložka 3 – Hlášení chyb AI a fotky od testerů (`AiFeedbackReport`):**
     - Zobrazí každou nahlášenou chybu s náhledem fotky rozváděče (s možností zvětšit a stáhnout originál), zprávou od testera, odkazem na projekt a tlačítkem `[ ✓ Označit jako vyřešené ]`.

5. TESTY A DOKUMENTACE:
- Napiš unit testy pro generátor SPD QR řetězce, schválení objednávky kreditů v transakci (připsání kreditů firmě), uložení AI feedbacku a oprávnění SuperAdminu.
- Přidej E2E test pro objednání kreditů, nahlášení chyby AI a schválení objednávky v `/superadmin`. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` + `npm run docs:bundle` a udělej commit.

---

# 📄 ZADANI-faze-51.md

# Zadání fáze 51 (vloženo 2026-11-05 místo obsahu docs/PLAN.md)

Na základě testování Katalogu prvků, zakládání projektu a 2D půdorysu elektroinstalace provedeme 4 zásadní vylepšení (Fáze 51). Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj:

1. OFICIÁLNÍ LOGA VÝROBCŮ ZE SLOŽKY `public/brands/` A VYČIŠTĚNÍ KATALOGU:
- Vytvoř složku `public/brands/` pro oficiální loga výrobců (`abb.svg`, `noark.svg`, `oez.svg`, `schneider.svg`, `eaton.svg`, `legrand.svg`, `eti.svg`, `hakel.svg`, `hager.svg`, `bonega.svg`, `siemens.svg`, `schrack.svg`, `loxone.svg`, `rittal.svg`, `hensel.svg`, `saltek.svg`, `sez.svg`, `wago.svg`).
- Napiš skript `scripts/fetch-brand-logos.ts`, který stáhne oficiální vektorová SVG loga těchto značek (z Wikimedia Commons / SimpleIcons / oficiálních CDN) do `public/brands/`, a tam, kde veřejné SVG není dostupné, vygeneruje věrné vektorové logo přesně podle oficiálního manuálu značky (žádné amatérské nápisy v bílém obdélníku).
- Komponentu `ManufacturerLogo.tsx` uprav tak, aby primárně načítala soubor z `/brands/<slug>.svg` (nebo `.png`/`.webp`, pokud tam uživatel nahraje vlastní soubor). Když uživatel do `public/brands/` vloží vlastní logo, okamžitě se propíše do celé aplikace.
- Z hlavního rozcestníku výrobců v Katalogu (`/panel-builder/catalog`) a v Konfigurátoru skryj okrajové 1položkové značky `ORNO`, `POLLOCK`, `LOVATO` a výrobce samotných ventilátorů `PFANNENBERG` a `STEGO` přesuň výhradně do výběru ventilátorů v Kroku 3 (Oteplení).

2. PŘEHLEDNÝ MODAL "NOVÝ PROJEKT ROZVÁDĚČE" + VÍCE FOTEK A ANALÝZA VIDEA (MP4/MOV):
Přepracuj nepřehledný modal `NewProjectDialog.tsx`:
- Odstraň hranaté závorky `[ ... ]` z tlačítek a místo 4 řádků pod sebou zobraz nahoře přehlednou mřížku **2×2 velkých karet (dlaždic) s ikonou, tučným nadpisem a stručným popisem**:
  1) **📐 Navrhnout od nuly (CAD)** – Čisté 2D vektorové plátno s DIN lištami.
  2) **📷 Pasport z fotek nebo 🎥 videa (AI Vision)** – Rozpoznání přístrojů z 1 až N fotek nebo z videa.
  3) **🏠 Ze soupisu místností (ČSN 33 2130)** – Rychlá tabulka místností, zásuvek a spotřebičů.
  4) **🗺️ 2D půdorys & kabeláž** – Vizuální kreslení půdorysu a výpočet kabelů (kliknutí rovnou otevře `/panel-builder/floorplan`).
- PODPORA VÍCE FOTEK A VIDEA V REŽIMU "PASPORT Z FOTEK NEBO VIDEA":
  * Umožni uživateli nahrát buď **více fotek najednou** (`<input type="file" accept="image/*" multiple>`: 1. hlavní celková fotka + libovolný počet detailních fotek jednotlivých DIN lišt/sekcí), NEBO **video rozváděče** (`<input type="file" accept="video/mp4,video/quicktime,video/webm">`).
  * Pokud uživatel nahraje **video** (např. 5–15s průjezd mobilem přes rozváděč):
    - Přímo na klientu v prohlížeči (`src/lib/video-frames.ts` přes `<video>` a `<canvas>`) automaticky vyextrahuj **6 rovnoměrně rozložených ostrých snímků (keyframes)** ve vysokém rozlišení (1920 px JPEG 0,92).
    - Zobraz uživateli náhledy vytažených snímků z videa (může označit, který je celkový pohled a které jsou detaily lišt, případně snímek přidat tlačítkem `"📸 Zachytit aktuální snímek z videa"`).
    - Při založení projektu ulož hlavní fotku + detailní snímky do `railPhotosJson` a pošli je do `geminiPanelService` ke kombinované analýze (celková topologie + ostré přečtení hodnot B10/B16/DS301C/EN25 z detailních snímků)!

3. 2D PŮDORYS (`/panel-builder/floorplan`): KASKÁDA VÝROBCE (S LOGEM) -> DESIGNOVÁ ŘADA -> BARVA + KOMPLETNÍ VYPÍNAČE:
- Odstraň malý select "Designová řada (výchozí)" ze spodku levého panelu a přesuň výběr domovních přístrojů **úplně NAHORU** (do horní lišty / horní karty levého panelu) jako živou 3stupňovou kaskádu:
  * **1. Výrobce (s oficiálním logem):** Klikací karty `[ ABB ]` · `[ Schneider Electric ]` · `[ Legrand ]` · `[ Hager ]`.
  * **2. Designová řada vybraného výrobce:**
    - Pro **ABB**: `Tango`, `Levit`, `Zoni`, `Time`, `Element`, `Swing / Swing L`, `Future Linear`, `Busch-axcent`, `Decento`, `Solo`, `Basic55`, `Garant (IP44)`.
    - Pro **Schneider Electric**: `Nová Unica`, `Sedna Design & Elements`, `Asfora`, `Mureva Styl (IP55)`.
    - Pro **Legrand**: `Valena Life`, `Valena Allure`, `Céliane`, `Niloé`, `Mosaic`, `Plexo (IP55)`.
    - Pro **Hager**: `lumina`, `berker S.1 / B.3 / Q.1 / Q.3`.
  * **3. Barva přístrojů (s barevnými kroužky):**
    - `⚪ Bílá / Alpská bílá`, `🟡 Slonová kost / Béžová`, `⚫ Černá matná / Antracit`, `🔘 Šedá / Metalická`, `🥈 Hliník / Inox`, `🟤 Dřevo / Písková`.
  * Změna výrobce, řady nebo barvy platí pro nově vkládané prvky a nabízí tlačítko `[ 🔄 Použít na celý půdorys ]` nebo `[ Použít na vybranou místnost ]`, takže ji lze plynule měnit kdykoliv během projektování! V kusovníku a soupisu domovní instalace se vypisuje přesný výrobce, řada i zvolená barva.
- ROZŠÍŘENÍ PALETY "💡 SVĚTLA A VYPÍNAČE" O VŠECHNY BĚŽNÉ TYPY:
  Do levého panelu v sekci `Světla a vypínače` doplň kompletní sadu spínačů a ovladačů:
  * `S1` Vypínač č. 1 (jednopólový)
  * `S5` Sériový přepínač č. 5 (lustrový – 2 klapky)
  * `S6` Střídavý přepínač č. 6 (schodový)
  * `S6+6` **Dvojitý střídavý přepínač č. 6+6 (řazení 5B – 2 klapky)**
  * `S7` Křížový přepínač č. 7
  * `T1` Tlačítko č. 1/0 (impulzní / zvonkové)
  * `T2` **Dvojtlačítko č. 1/0+1/0 (2 klapky)**
  * `ZAL` **Žaluziový spínač / tlačítko (nahoru / dolů)**
  * `STM` **Stmívač (otočný / tlačítkový LED)**
  * `PIR` **Pohybové čidlo (PIR nástěnné / stropní)**
  * `S1S` **Vypínač s orientační doutnavkou / LED (řazení 1S / 6S)**
  * `S44` **Vypínač IP44 (do vlhka / venkovní)**
  * `TER` **Pokojový termostat**
  Aktualizuj také výpočet kabeláže: k `S6+6` počítej dvoužilové korespondenční propojení pro obě větve, k `ZAL` kabel `CYKY-J 5×1,5` k pohonu žaluzie a k `TER` kabel k topnému okruhu.

4. 2D PŮDORYS: ŽIVÉ ROZMĚRY X × Y PŘI KRESLENÍ, POSOUVÁNÍ, AKTIVNÍ ROH A MAZÁNÍ MÍSTNOSTÍ:
Oprav práci s místnostmi na plátně `/panel-builder/floorplan`:
- **Živé kóty během kreslení místnosti:** Když uživatel v režimu `Kreslit místnost` táhne myší žlutý čárkovaný obdélník, zobrazuj v reálném čase přímo u horní hrany štítek `X: {šířka} m`, u pravé hrany `Y: {hloubka} m` a uprostřed obdélníku `{šířka} × {hloubka} m ({plocha} m²)`.
- **Výběr a posouvání nakreslené místnosti:** V režimu `Výběr` (nebo kliknutím na místnost) se místnost zvýrazní žlutým rámečkem. Tažením za vnitřek místnosti lze celou místnost plynule **posouvat myší** (přičemž všechny zásuvky, vypínače a světla umístěné uvnitř této místnosti se posouvají společně s ní!).
- **Aktivní roh a stěny pro změnu velikosti:** Vybraná místnost musí mít v pravém dolním rohu výrazný žlutý **aktivní úchyt (handle)** a interaktivní všechny 4 stěny (kurzory `nwse-resize`, `ew-resize`, `ns-resize`). Tažením za roh nebo stěnu uživatel plynule mění rozměr X a Y se živými kótami.
- **Úprava a smazání místnosti:** Když je místnost vybraná, zobraz v pravém panelu (a v plovoucí liště nad místností) editovatelné pole **Název místnosti** (s rychlými štítky: `Obývací pokoj`, `Kuchyně`, `Ložnice`, `Dětský pokoj`, `Koupelna`, `WC`, `Chodba`, `Technická místnost`, `Garáž`), číselná pole `Šířka X [m]` a `Hloubka Y [m]` a červené tlačítko **`[ 🗑️ Smazat místnost ]`** (funguje i klávesa `Delete` / `Backspace`).

Po implementaci spusť `npm run verify`, aktualizuj unit i E2E testy, udělej commit a vypiš příkazy pro push a deploy na server.

---

# 📄 ZADANI-faze-52.md

# Zadání fáze 52 – metodika ČSN 33 2130 ed. 4 (vloženo 2026-11-05)

Původní znění vložené místo `docs/PLAN.md`. V zadání se test jmenuje `phase53-methodology.test.ts`, uživatel ho určil jako fázi 52.

Na základě verifikace proti naší odborné referenční metodice ("Metodika pro návrh domovních elektroinstalací a Smart Home" – ČSN 33 2130 ed. 4 platná od 1. 1. 2025, ČSN 33 2000-5-52 ed. 2, ČSN 33 2000-5-51 ed. 3+Z1+Z2, TNI 33 2000-5-51:2022 a vyhláška č. 131/2024 Sb.) musíme zpřísnit a rozšířit inženýrskou logiku v `floorplan-bridge.ts`, `room-schedule.ts`, `linter.ts`, 2D půdorysu i výstupní dokumentaci.

Zapiš tuto etapu do docs/PLAN.md jako novou fázi a kompletně ji naimplementuj v těchto 6 bodech:

1. TŘI ÚROVNĚ ARCHITEKTURY INSTALACE (KLASIKA vs. SBĚRNICOVÁ SMART HOME vs. HYBRIDNÍ RETROFIT):
V `src/engine/floorplan-bridge.ts`, `src/engine/room-schedule.ts` i v UI (2D půdorys a modal Nový projekt ze soupisu) zaveď plnou podporu všech 3 úrovní podle metodiky:
- `classic` ("1. Klasická instalace 230/400 V"):
  * Okruhová/stromová topologie, lokální spínače, kabely `CYKY-J / CYKY-O`, krabice `KU68`.
- `bus_loxone` ("2. Plně sběrnicová Smart Home – Loxone / KNX / TapHome / ABB-free@home"):
  * Hvězdicová topologie silnoproudu: každý spínaný světelný vývod, spínaná zásuvka a pohon žaluzie (`CYKY-J 5×1,5`) vede samostatným kabelem přímo do centrálního rozváděče na vícepatrové instalační svorkovnice (L/N/PE).
  * Sběrnicová větev `24 V DC` (`CAT7` nebo `KNX TP J-Y(St)Y 2×2×0,8`) propojuje tlačítka a senzory; pro sběrnici RS-485 (elektroměry Eastron / střídač) automaticky přidej do kusovníku zakončovací rezistor `120 Ω` a vícepatrové svorkovnice.
- `smart_retrofit` ("3. Hybridní / Retrofit – Zigbee / Matter / Home Assistant / Lokální moduly pod vypínač"):
  * Klasická kabeláž, ale se STRIKTNÍM PRAVIDLEM: v každé krabici vypínače je POVINNÝ nulový vodič `N`! Zakáž použití kabelu `CYKY-O` (bez modré žíly) – ke každému vypínači počítej `CYKY-J 3×1,5` (nebo `5×1,5` u dvojitých spínačů) s průběžným vodičem `N`.
  * Do výkazu materiálu automaticky generuj hluboké přístrojové krabice **min. 65 mm (`KPR68 / KU68 hluboká`)** a lokální chytré moduly pod vypínače.

2. STRIKTNÍ PRAVIDLA ČSN 33 2130 ed. 4 PRO PROUDOVÉ CHRÁNIČE, SVĚTLA A ZÁSUVKY:
Uprav `generateCircuitsFromFloorplan`, `buildSwitchboardFromCircuits` (v `floorplan-bridge.ts`) a `validateSwitchboardState` (v `src/lib/panel-builder/linter.ts`):
- **Konec chráničů typu AC & Oddělení světel od zásuvek:**
  * Světelné obvody NESMÍ viset na společném proudovém chrániči se zásuvkovými obvody!
  * Každý koncový světelný obvod (`B10A`) musí mít v návrhu podle ČSN 33 2130 ed. 4 samostatnou doplňkovou ochranu proudovým chráničem **typu A** (`IΔn = 30 mA`) – buď jako samostatný jednomodulový jističochránič **RCBO 1P+N typ A** (např. `ABB DS301C B10 A30` / `Eaton PFL7-10/1N/B/003-A`), nebo přes vyhrazenou skupinu chráničů výhradně pro světla (nikdy smíchanou se zásuvkami!).
  * Všechny zásuvkové proudové chrániče musí být minimálně **Typ A** (nikdy `Typ AC`!).
  * Pro okruhy `ev_charger` (Wallbox), `pv_inverter` (FVE) a `heat_pump` (TČ s frekvenčním měničem) striktně vyžaduj proudový chránič **Typ B nebo Typ F**!
- **Počítání skutečných zásuvek v obvodu (max. 10 zásuvek):**
  * Podle ČSN 33 2130 ed. 4 zásuvkový obvod nepočítá rámečky, ale skutečné zásuvky: započítávej dvojzásuvku (`double_socket`) jako **2 zásuvky** do limitu max. 10 zásuvek na jeden okruh `B16A` (přidej volitelný přepínač `Počítat dvojzásuvku jako 2 zásuvky dle ČSN 33 2130 ed. 4` – výchozí zapnuto).
- **Nová pravidla v Elektro-linteru (`linter.ts`):**
  1) Varování (s opravou 1 klikem): *"Chránič -FIx je typu AC – dle ČSN 33 2130 ed. 4 musí být u koncových obvodů s elektronikou a LED osvětlením použit typ A (příp. B/F)."* -> Tlačítko `[Opravit 1 klikem: Přepnout na Typ A]`.
  2) Varování (s opravou 1 klikem): *"Pod chráničem -FIx jsou společně zapojené světelné i zásuvkové okruhy – dle ČSN 33 2130 ed. 4 nesmí světla viset na společném chrániči se zásuvkami!"* -> Tlačítko `[Opravit 1 klikem: Oddělit světla na RCBO / samostatný chránič]`.
  3) Varování: *"Okruh Wallbox / TČ / FVE je za chráničem typu A/AC – vyžadován chránič typu B nebo F."*

3. DIMENZOVÁNÍ VODIČŮ V TEPELNÉ IZOLACI (A1/A2/B2/C DLE TAB. 9) A IMPEDANCE SMYČKY V TEPLÉM STAVU ($Z_{sm}$):
Rozšiř výpočet kabelů v `floorplan-bridge.ts`:
- Přidej volbu způsobu uložení kabelů v budově (`InstallMethod = "C" | "B2" | "A2" | "A1"`):
  * `C` (ve zdi pod omítkou – standardní zdivo): `CYKY 3×1,5` -> $I_z = 19,5\text{ A}$ (jistič 10/16 A), `CYKY 3×2,5` -> $I_z = 27\text{ A}$ (jistič 16 A).
  * `B2` (v elektroinstalační trubce / liště ve zdi): `CYKY 3×1,5` -> max. jistič **10 A** (dle Tab. 9!), `CYKY 3×2,5` -> $I_z = 20\text{ A}$ (jistič 16 A).
  * `A1 / A2` (v tepelně izolační příčce / dřevostavbě / zatepleném podhledu): `CYKY 3×1,5` -> max. jistič **10 A**, `CYKY 3×2,5` -> $I_z$ klesá na **18,5 A** (max. jistič **16 A**; při souběhu více kabelů v izolaci klesá $I_z$ pod 16 A a systém musí automaticky navrhnout přechod na průřez `4 mm²` nebo jištění `13 A`!).
- **Kontrola obou podmínek koordinace (ČSN 33 2000-4-43):**
  * $I_B \le I_n \le I_z$ a $I_2 \le 1,45 \cdot I_z$ (kde pro jističe dle ČSN EN 60898 je $I_2 = 1,45 \cdot I_n$).
- **Kontrola impedance poruchové smyčky v teplém stavu ($Z_{sm}$ dle ČSN 33 2000-6 ed. 2):**
  * Pro každý navržený okruh spočítej impedanci vedení v teplém stavu (koeficient ohřevu $1,5\times$ a pokles napětí na $0,8 \cdot U_0$):
    $$I_{k,\min} = \frac{0,8 \cdot U_0}{1,5 \cdot Z_S} \ge I_a \quad \text{a} \quad Z_{sm} \le \frac{2 \cdot U_0}{3 \cdot I_a}$$
    (kde $U_0 = 230\text{ V}$ a $I_a = 5 \cdot I_n$ pro jistič char. B, resp. $10 \cdot I_n$ pro char. C). Pokud je trasa kabelu příliš dlouhá a nevyhoví impedanci smyčky nebo úbytku napětí $\Delta U$ (příloha A a E ČSN 33 2130 ed. 4: $\le 3\,\%$ světla, $\le 5\,\%$ ostatní), upozorni projektanta a navrhni o stupeň vyšší průřez!

4. KATALOGOVÉ ŘAZENÍ SPÍNAČŮ ABB A STAVEBNÍ DETAILY (VZDUCHOTĚSNOST, UZEMNĚNÍ V4A, SPD BEZ PŘEDJIŠTĚNÍ):
- Do palety spínačů v 2D půdorysu doplň přesná katalogová řazení dle standardu ABB:
  * `1` (jednopólový), `1So` (s orientační doutnavkou), `1S` (se signalizační doutnavkou), `1SSo`, `1+1` (dvojitý s blokováním proti současnému stisku), `5` (sériový), `6` (střídavý), `6+6` (dvojitý střídavý), `6+6/0`, `7` (křížový), `7So`, `1/0` (tlačítko zapínací), `1/0So`.
- Do katalogu přepěťových ochran Saltek přidej kombinované svodiče T1+T2 bez nutnosti předjištění s vnitřním nadproudovým odpojovačem a dálkovou signalizací: **`Saltek FLP-25-T1-VSF`** a **`Saltek FLP-B+C-MAXI-VSF`**.
- Při návrhu rozváděče s kombinací **FVE + Tepelné čerpadlo + EV Wallbox (Synergický energetický management)**:
  * Automaticky přidej do rozváděče **SG Ready bezpotenciálové relé** pro propojení střídače FVE s tepelným čerpadlem a **nepřímý/přímý 3f elektroměr pro Dynamické řízení zátěže (DLM)** wallboxu proti přetížení hlavního jističe (dle čl. 10 ČSN 33 2130 ed. 4 a požadavků pojišťoven) + možnost volby tlačítka **TOTAL STOP / CENTRAL STOP**.
- Pokud je v projektu zvoleno prostředí `Dřevostavba / Pasivní dům` nebo `Venkovní prostupy`, přidej do kusovníku a technické zprávy položky: **Vzduchotěsné membránové krabice, EPDM manžety (`ProClima ROFLEX`), krabice do zateplení (`Kopos KEZ_KB`)** a požadavek na **nerezový obvodový zemnič V4A (AISI 316Ti)** pod hydroizolací základové desky dle ČSN 33 2000-5-54 ed. 3.

5. PROTOKOL O URČENÍ VNĚJŠÍCH VLIVŮ (TNI 33 2000-5-51:2022) A HLAVIČKA DLE VYHLÁŠKY Č. 131/2024 Sb. V DOKUMENTACI:
- V Kroku 4 AI Panel Builderu (`/panel-builder/[id]/documentation`) a na kartě elaborátu:
  * Rozšiř technickou zprávu a titulní list o odkaz na **stavební zákon č. 283/2021 Sb., vyhlášku č. 131/2024 Sb. (Příloha 9, část D.2.5 TPS – Silnoproud)**, **zákon č. 250/2021 Sb.**, **NV č. 190/2022 Sb.** a normu **ČSN 33 2130 ed. 4** (u rozvodnic pod omítku DBO též deklaraci **„Úplný kryt“ dle ČSN EN 60670-24**).
  * Automaticky vygeneruj ze zvoleného prostředí instalace oficiální **„Protokol o určení vnějších vlivů dle TNI 33 2000-5-51:2022 a ČSN 33 2000-5-51 ed. 3+Z1+Z2“** (tabulka vnějších vlivů AA, AB, AC, AD, AE, AF, AG, AH, AN, BA, BC, BD, BE, CA, CB + stanovené opatření a požadované krytí IP/IK), který bude přímou součástí tiskového elaborátu pro výchozí a pravidelné revize.
- V revizních protokolech (`/inspections/report/[id]`) doplň u zkoušení proudových chráničů (RCD) dle **ČSN EN 61557-6 ed. 2** a **ČSN 33 2000-6 ed. 2** všechny 3 předepsané testy:
  1) Měření nevybavovacího proudu ($0,5 \cdot I_{\Delta n}$ po dobu $\ge 300\text{ ms}$ – nesmí vybavit),
  2) Měření vybavovacího času při $1,0 \cdot I_{\Delta n}$ ($t \le 300\text{ ms}$),
  3) Měření vybavovacího proudu $I_\Delta$ (u typu A testováno pulzujícím DC proudem do $1,4 \cdot I_{\Delta n}$) + kontrolu impedance smyčky $Z_{sm} \le \frac{2}{3} Z_{s,\max}$.

6. TESTY A VERIFIKACE:
- Napiš unit testy v `src/lib/phase53-methodology.test.ts` ověřující:
  * Že v návrhu dle ČSN 33 2130 ed. 4 nikdy nevznikne chránič typu AC a světelný okruh nikdy nesdílí chránič se zásuvkami.
  * Že v režimu `smart_retrofit` má každý spínač přivedený vodič `N` (`CYKY-J`) a krabici `KPR68 (65 mm)`.
  * Výpočet $I_z$ v tepelné izolaci (`A2` -> max. 10 A pro 1,5 mm²) a kontrolu impedance smyčky v teplém stavu $Z_{sm} \le \frac{2 U_0}{3 I_a}$.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `npm run docs:bundle`, udělej commit a vypiš příkazy pro push a deploy.

---

# 📄 ZADANI-faze-53.md

# Zadání fáze 53 – životnost součástek a zatížení kabelových tras (vloženo 2026-11-05)

Původní znění vložené místo `docs/PLAN.md`. V zadání je uvedené jako „Fáze 52“, uživatel ho posunul na fázi 53 (fáze 52 = metodika ČSN 33 2130 ed. 4).

Implementujeme Fázi 52 do větve Správa výrobních závodů: "Prediktivní hlídání životnosti elektrotechnických součástek (cykly, motohodiny, B10d Safety a teplotní degradace dle Arrhenia) a Hlídání proudového zatížení kabelových tras (dle ČSN 33 2000-5-52 ed. 2) se simulátorem připojení nového stroje".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 6 bodech:

1. DATABÁZOVÉ SCHÉMA A MIGRACE (`prisma/schema.prisma`):
Vytvoř čistou SQLite migraci pro tyto modely a rozšíření:
a) Rozšiř model `Equipment` o provozní a kabelové parametry přívodu:
   - `shiftRegime` (Int @default(2) – směnnost provozu stroje/rozváděče: `1` = 1 směna 8h/den, `2` = 2 směny 16h/den, `3` = 3 směny 24h prac. dny, `4` = nepřetržitý provoz 24/7)
   - `internalTempC` (Float? – reálná nebo vypočtená vnitřní teplota v rozváděči [°C] pro výpočet tepelného stárnutí zdrojů a měničů; výchozí 35 °C)
   - Parametry přívodního kabelu (vztah k nadřazenému `fedFromEquipmentId`):
     * `feederCableType` (String? – např. `"CYKY-J"`, `"1-CXKH-R"`, `"AYKY"`, `"ÖLFLEX CLASSIC 110"`)
     * `feederConductorMaterial` (String @default("CU") – `"CU"` měď | `"AL"` hliník)
     * `feederCrossSectionMm2` (Float? – průřez fázového vodiče v mm²: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240)
     * `feederParallelRuns` (Int @default(1) – počet paralelních kabelů na fázi, např. 2× CYKY 3×120+70)
     * `feederLengthM` (Float? – délka kabelové trasy v metrech)
     * `feederInstallMethod` (String @default("E") – referenční způsob uložení dle ČSN 33 2000-5-52: `"B2"` v trubce/lišty na zdi, `"C"` přímo na zdi/lávce, `"E"` perforovaný kabelový žlab/rošt na vzduchu, `"D"` v zemi)
     * `feederGroupingCount` (Int @default(1) – počet souběžně uložených zatížených třífázových kabelů ve stejném žlabu/trase pro výpočet korekčního součinitele seskupení k_1)
     * `feederAmbientTempC` (Float @default(30) – max. teplota okolí kabelové trasy [°C], např. 30 °C běžná hala, 40 °C pod střechou haly / u pecí)
     * `feederUpstreamBreakerA` (Float? – jmenovitý proud In předřazeného jističe/pojistky v nadřazeném rozváděči [A])
     * `nominalCurrentA` (Float? – jmenovitý výpočtový odběr Ib tohoto zařízení [A])
     * `measuredCurrentA` (Float? – skutečný proud naměřený klešťovým ampérmetrem při revizi/diagnostice [A])
b) Model `MonitoredComponent` (Sledované kritické součástky rozváděče/stroje s omezenou životností):
   - `id` (String @id @default(cuid()))
   - `equipmentId` (String, vazba na `Equipment`, onDelete: Cascade)
   - `designation` (String – IEC značení ve schématu, např. `"-K4"`, `"-T1"`, `"-U1"`, `"-G1"`, `"-F_FAN1"`)
   - `name` (String – např. `"Stykač hlavního čerpadla hydrauliky"`, `"Spínaný zdroj 24V DC / 10A"`, `"Frekvenční měnič vřetene"`, `"Safety relé Total Stop"`, `"Ventilátor rozváděče + filtr"`)
   - `manufacturer` (String?), `modelNumber` (String?)
   - `wearCategory` (enum `ComponentWearCategory`:
     * `SWITCHING_CONTACTOR` = Silový stykač / relé / ventil (počítání sepnutí)
     * `SAFETY_ELEMENT` = Bezpečnostní prvek dle ČSN EN ISO 13849-1 (hlídání B10d cyklů a doby mise T_M 20 let)
     * `POWER_ELECTRONICS` = 24V DC zdroj / Frekvenční měnič / Kondenzátory (motohodiny + teplotní degradace dle Arrhenia)
     * `COOLING_FAN_FILTER` = Ventilátor rozváděče / Filtrační vložka / Baterie UPS/PLC)
   - `installedAt` (DateTime – datum instalace nebo poslední výměny kusu)
   - `cyclesPerHour` (Float? – průměrný počet sepnutí za provozní hodinu stroje, např. `120` sepnutí/h u lisu nebo `15` u CNC)
   - `manualCyclesOffset` (Int @default(0) – případný ručně zadaný počáteční stav cyklů z čítače PLC)
   - `maxElectricalCycles` (Int? – katalogová elektrická životnost v cyklech při AC-3/AC-4 nebo limit B10d u Safety prvků, např. `1000000`)
   - `maxOperatingHours` (Int? – katalogová životnost v provozních hodinách při referenční teplotě 40 °C, např. `50000` h u zdroje/ventilátoru)
   - `maxCalendarMonths` (Int? – maximální kalendářní doba v měsících, např. `240` měsíců = 20 let doba mise T_M u Safety prvku, nebo `6` měsíců u filtrační vložky, `48` měsíců u baterie)
   - `replacementStockCount` (Int @default(0) – počet náhradních kusů skladem v dílně údržby!)
   - `notes` (String?), `updatedAt` (DateTime @updatedAt)

2. VÝPOČETNÍ ENGINE ŽIVOTNOSTI SOUČÁSTEK (`src/lib/component-lifespan.ts` + unit testy):
Vytvoř čistý deterministický modul pro výpočet opotřebení a predikci výměny:
- Výpočet odpracovaných hodin od `installedAt` podle `shiftRegime` stroje:
  * `1 směna` = 2 000 h/rok (~5,48 h/den), `2 směny` = 4 000 h/rok (~10,96 h/den), `3 směny` = 6 000 h/rok (~16,44 h/den), `24/7` = 8 760 h/rok (24 h/den).
- Výpočet aktuálního počtu sepnutí: `totalCycles = manualCyclesOffset + Math.round(operatingHours * cyclesPerHour)`.
- **Teplotní korekce životnosti dle Arrheniova zákona (pro `POWER_ELECTRONICS` – 24V zdroje, měniče, kondenzátory):**
  * Referenční teplota katalogové životnosti je `T_ref = 40 °C`.
  * Pokud je v rozváděči zvýšená teplota `T_internal > 40 °C` (zjištěná z výpočtu oteplení nebo termovize), efektivní životnost v hodinách klesá podle vzorce:
    `effectiveMaxHours = maxOperatingHours * Math.pow(2, -(T_internal - 40) / 10)` (každých +10 °C nad 40 °C zkracuje životnost elektrolytických kondenzátorů na polovinu!).
- Pro každou součástku spočítej % vyčerpání všech relevantních limitů (Cykly / B10d, Motohodiny s teplotní korekcí, Kalendářní limit T_M) a vezmi ten nejhorší (`wearPercent`, `remainingDays`, `predictedReplacementDate`):
  * 🟢 `OK` (`< 75 %` životnosti)
  * 🟡 `PLAN_REPLACEMENT` (`75–95 %` nebo zbývá méně než 90 dní – doporučit preventivní výměnu při odstávce a zkontrolovat, zda je `replacementStockCount > 0`!)
  * 🔴 `CRITICAL_EXPIRED` (`>= 95 %` nebo po termínu – hrozí nečekaná porucha linky / vypršela doba mise Safety prvku dle EU 2023/1230!).

3. VÝPOČETNÍ ENGINE ZATÍŽENÍ KABELŮ DLE ČSN 33 2000-5-52 ed. 2 (`src/lib/cable-sizing.ts` + unit testy):
Vytvoř inženýrský modul pro kontrolu dimenzování a zatížení průmyslových kabelových tras:
- Tabulka základních proudových zatížitelností $I_{\text{tab}}$ [A] pro PVC/XLPE kabely (Cu i Al, 3 zatížené žíly, průřezy `1,5 mm²` až `240 mm²`) pro referenční způsoby uložení `B2`, `C`, `E` a `D`.
- Korekční součinitel teploty okolí $k_{\text{temp}}$ (pro 25 °C až 55 °C) a korekční součinitel seskupení kabelů v lávce/žlabu $k_{\text{group}}$ (pro 1 až 20 souběžných třífázových kabelů dle tab. B.52.17 ČSN 33 2000-5-52: např. 1 kabel = 1,00; 2 kabely = 0,88; 3 = 0,82; 4–5 = 0,77; 6–8 = 0,73; 9+ = 0,70).
- **Skutečná dovolená zatížitelnost trasy:** `Iz = I_tab * parallelRuns * k_temp * k_group`.
- **Výpočtové a reálné zatížení kabelu $I_B$:**
  * Pokud má zařízení podřízené odběry v hierarchii napájení (`feeds`), sečti jejich výpočtové proudy se soudobostí (`SF = 0,8`), případně vezmi `measuredCurrentA` (pokud bylo změřeno klešťákem) nebo `nominalCurrentA`.
- **Kontrola 3 normativních podmínek a Semafor kabelu:**
  1) **Vytížení kabelu:** `loadPercent = (I_B / Iz) * 100`.
  2) **Podmínka jištění kabelu proti přetížení (čl. 433.1 ČSN 33 2000-4-43):** Platí `I_B <= In <= Iz`! Pokud je předřazený jistič `In > Iz` (protože v lávce přibyly kabely nebo je vysoká teplota), vyhoď červené varování: `🔴 NEJIŠTĚNÝ KABEL: Jistič In (${In} A) je vyšší než skutečná zatížitelnost kabelu Iz (${Iz} A po korekci seskupením a teplotou)!`
  3) **Úbytek napětí $\Delta U$ [%]:** `dU_percent` pro 3f 400 V soustavu (limit $\le 5\,\%$ pro motory/stroje, $\le 3\,\%$ pro světla).
- **SIMULÁTOR "CO KDYŽ PŘIPOJÍM NOVÝ STROJ?" (`simulateAddedLoad`):**
  * Funkce přijme stávající strom napájení závodu, cílový rozváděč (např. `R-LIS-01` nebo `R-CNC-04`) a příkon/proud plánovaného nového stroje (např. `+45 kW / +80 A`).
  * Okamžitě propíše tento přírůstek proudu celou kaskádou nahoru (přívodní kabel podružného rozváděče -> hlavní rozváděč `RM1` -> transformátor `TR1`) a vrátí přehled, které kabely a jističe v trase vyhoví (🟢) a které přejdou do přetížení (🔴) včetně doporučení potřebného průřezu v $\text{mm}^2$!

4. UŽIVATELSKÉ ROZHRANÍ NA KARTĚ ZAŘÍZENÍ (`/equipment/[id]`) A V PAVOUKU NAPÁJENÍ:
- V záložce **`🔍 Diagnostika & Spoje (Údržba)`** (a s indikátorem v hlavičce zařízení) vytvoř dvě nové přehledné sekce:
  a) **Sekce 1: `⏳ Životnost součástek a prediktivní údržba (B10d / Motohodiny)`:**
     - Přepínač směnnosti stroje (`1 směna`, `2 směny`, `3 směny`, `24/7`) a vnitřní teploty rozváděče (`T_rozváděče [°C]`).
     - Karty / tabulka sledovaných součástek (`-K4 Stykač`, `-T1 Zdroj 24V DC`, `-U1 Frekvenční měnič`, `-K_SAF1 Safety relé`, `-FAN1 Ventilátor + filtr`) s barevným progress barem vyčerpání životnosti (`%`), počtem sepnutí / motohodin, informací o teplotním zkrácení životnosti dle Arrhenia, stavem náhradního dílu na skladě (`Skladem: 1 ks` / `⚠️ Chybí na skladě!`) a předpokládaným datem výměny.
     - Tlačítko **`[ 🔄 Zapsat výměnu kusu za nový (Reset 0 %) ]`** (vynuluje počítadlo k dnešnímu dni a volitelně založí záznam do historie) a tlačítko **`[ + Přidat sledovanou součástku ]`** (s rychlým výběrem přímo z kusovníku BOM daného rozváděče!).
  b) **Sekce 2: `🔌 Dimenzování a zatížení přívodního kabelu (ČSN 33 2000-5-52)`:**
     - Karta přívodního kabelu (např. `RM1 ➔ R-CNC-04 · Kabel CYKY-J 3×50+25 mm² · délka 48 m · uložení E (žlab, 6 kabelů v souběhu) · okolí 35 °C`).
     - Velký vizuální ukazatel: **Tabulková $I_{\text{tab}}$ ➔ Skutečná zatížitelnost $I_z$ (po korekci $k_1 \times k_2$) ➔ Předřazený jistič $I_n$ ➔ Aktuální zatížení $I_B$ (v % $I_z$)** + úbytek napětí $\Delta U$ [%].
     - Tlačítko `[ ✏️ Upravit parametry kabelu a měření klešťákem ]`.
     - **Interaktivní box `🧪 Simulátor: Co když sem připojím další stroj?`**: Uživatel posuvníkem nebo polem zadá příkon nového stroje v `kW` nebo `A` (např. `30 kW / 55 A`) a okamžitě vidí dopad na tento přívodní kabel, na nadřazený hlavní rozváděč `RM1` i na transformátor `TR1`!
- V půdorysu patra při zapnutí **„⚡ Pavouk napájení (Hierarchie)“** zobrazuj přímo na spojnicích mezi rozváděči a stroji typ kabelu a barevné % jeho zatížení (např. `CYKY 4×50 · 78 % Iz`).
- Do **Hlídače lhůt (`/inspections/alerts` a přehled areálu)** přidej souhrnný odznak `⏳ Součástky před koncem životnosti (N)` a `🔌 Přetížené / nejištěné kabely (N)`.

5. REALISTICKÝ SEED PRO OKAMŽITOU UKÁZKU V ZÁVODĚ JABLonec (`prisma/seed-lifespan-cables.ts`):
Doplň do seedu (i do přírůstkového produkčního seedu volaného z `docker-entrypoint.sh`, aby se vše propsalo na `eldock.cz`) bohatá realistická data:
- Nastav kabelové pasporty na páteřních i koncových trasách v Závodě Jablonec:
  * `TR1 ➔ RM1`: `3× (3× 1-CXKH-R 1×240 mm²)`, 18 m, uložení E.
  * `RM1 ➔ R-LIS-01`: `CYKY-J 3×95+50 mm²`, 65 m, žlab E se 7 souběžnými kabely, teplota pod střechou 38 °C, jistič `In = 160 A`, odběr `138 A` (**🟡 Vytížení 86 % Iz – varování nízké rezervy pro další stroje!**).
  * `RM1 ➔ R-CNC-04`: `CYKY-J 3×50+25 mm²`, 48 m, žlab E se 6 kabely, jistič `In = 125 A`, ale po korekci seskupením a teplotou 35 °C je `Iz = 112 A` (**🔴 Ukázka chyby jištění dle ČSN: po přitažení dalších kabelů do žlabu kleslo Iz pod jistič 125 A!**).
  * `RM1 ➔ R-ML-01`, `R-LIS-01 ➔ LIS-01`, `R-CNC-04 ➔ CNC-04` atd. (**🟢 V pořádku, rezerva 35–55 %**).
- Doplň sledované součástky (`MonitoredComponent`) u hlavních rozváděčů a strojů:
  * U **`R-LIS-01` / `LIS-01`** (3směnný provoz):
    - `-K1` Stykač hlavního čerpadla hydrauliky (ABB AF38, 120 sepnutí/h, nasbíráno `940 000 / 1 000 000` cyklů = **🟡 94 % – naplánovat výměnu do 3 týdnů**, skladem 1 ks).
    - `-K_SAF1` Bezpečnostní modul lisu (Pilz PNOZsigma, hlídání $B_{10d}$ dle ISO 13849-1, 42 %).
  * U **`R-CNC-04`** (2směnný provoz, vnitřní teplota v rozváděči 48 °C):
    - `-T1` Spínaný zdroj 24V DC / 10A (kvůli teplotě 48 °C v rozváděči klesla životnost kondenzátorů dle Arrhenia z 50 000 h na 28 700 h -> aktuálně **🔴 97 % vyčerpáno, 0 ks skladem!**).
    - `-FAN1` Filtrační vložka ventilátoru rozváděče Rittal SK 3238 (**🔴 Po termínu výměny 6 měsíců – příčina zvýšené teploty v rozváděči!**).
    - `-U1` Frekvenční měnič vřetene (Siemens Sinamics, 58 % životnosti DC meziobvodu).

6. VERIFIKACE A TESTY:
- Napiš unit testy pro `component-lifespan.ts` (výpočet cyklů ze směnnosti, Arrheniův teplotní vzorec, B10d) a `cable-sizing.ts` (výpočet Iz se seskupením a teplotou, detekce `In > Iz`, úbytek napětí a simulátor nového stroje).
- Přidej E2E test ověřující zobrazení životnosti součástek, výměnu kusu na 1 klik a simulátor zatížení kabelu na kartě `R-CNC-04` / `R-LIS-01`.
- Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `npm run docs:bundle`, udělej commit a vypiš příkazy pro push a deploy.

---

# 📄 ZADANI-faze-54.md

# Zadání fází 54–58 – opravy webu, normový registr, nový web a bytový projekt (2026-11-05)

Vzniklo z analýzy webu eldock.cz (2026-11-05) a z normového registru `C:\Users\janou\Desktop\Claude\eldock-normovy-registr`
(181 položek, 135 ověřených proti zakonyprolidi.cz a katalogu ČSN). Uživatel schválil pořadí 54 → nasazení 50–54 → 55 → 56 → 57 → 58.

## Nálezy z analýzy produkce (2026-11-05)

- `/ukazka-elaboratu` vrací 404 (stránka „Stránka nenalezena“ i v náhledu na úvodní stránce) → na produkci chybí vzorový projekt PB-001.
  `seedPanelBuilder` zakládá PB-001 až po katalogu; když import katalogu selže, PB-001 nevznikne (příčina na serveru neověřena).
- `/panel-builder/auth` vypisuje e-mail i heslo firmy Tester a stránka je v sitemap.xml.
- `/login` vypisuje demo účty (produkce běží s `ELDOCK_LOCK_ACCOUNT_SWITCHER=0`) – změna je v serverovém `.env`, jen se souhlasem uživatele.
- Neexistující adresy (`/llms.txt`, `/.well-known/security.txt`, překlepy) přesměrují 307 na `/login` místo 404.
- `www.eldock.cz` vrací 200 (duplicita), `/favicon.ico` 404.
- Mobil: chybí navigace (odkazy sekcí zmizí), dvě tlačítka v kartě AI Panel Builderu přetékají kartu, ikony jsou zdvojené (SVG + emoji 🚀 📄).
- Chybí zásady zpracování osobních údajů; souhlas při registraci firmy uvádí „NV č. 116/2016 Sb.“ (ATEX) místo NV 118/2016 Sb. (nízké napětí),
  nápověda EU prohlášení o shodě jen 117/2016 Sb. (EMC).

## Fáze 54 – opravy webu před nasazením

1. PB-001 nezávisle na katalogu: každý krok `seedPanelBuilder` samostatně (selhání jednoho kroku nezastaví ostatní, skript vrátí chybový kód),
   vzorový projekt jako první. Úvodní stránka nabídne „vzorový elaborát“ jen tehdy, když PB-001 existuje.
2. Tester bez vypsaného hesla: tlačítko „Vyzkoušet demo“ přihlásí demo firmu na serveru; e-mail ani heslo se na stránce neukazují.
3. 404 místo přesměrování: na přihlášení přesměrovávají jen skutečné trasy aplikace; neznámá adresa = 404 s cestou na úvodní stránku.
   `www.eldock.cz` → 301 na `eldock.cz` (Caddyfile).
4. Mobil: navigační menu úvodní stránky, tlačítka v kartách produktů se zalamují, bez zdvojených ikon.
5. Právní texty: NV 118/2016 Sb. (LVD) a 117/2016 Sb. (EMC), veřejná stránka `/ochrana-osobnich-udaju` (návrh k právní kontrole)
   a `/obchodni-podminky` (stávající podmínky z registrace), odkazy v patičce a u registračních formulářů.

## Fáze 55 – normový registr v Eldocku

- Prisma modely `NormRegistryItem`, `NormRule` (přírůstková migrace), import přes `npm run catalog:sync`
  (zdroj `ai-panel-builder/catalog/norms/registr.json`, export `prisma/external-catalog/norms.json`).
- `src/lib/norms.ts` = jediný zdroj označení a vydání; postupná náhrada ~330 natvrdo psaných odkazů (elaborát, `external-influences.ts`,
  `legislation-2027.ts`, lhůtník).
- Test ve `verify`: kód nesmí citovat normu, která v registru chybí nebo je zrušená.
- Normový základ projektu: při vystavení elaborátu uložit použitá vydání (`PanelBoardProject.normBasisJson`).
- Velín: přehled registru (neověřené položky, kontroly po termínu).

## Fáze 56 – nový veřejný web

- Rozcestník Dům a byt / Rozváděče / Průmysl; `/dum` (klasika / sběrnice / retrofit), `/rozvadece`, `/prumysl` (vč. prediktivní údržby),
  `/cenik` (balíčky kreditů), `/ukazky`, `/normy-a-kvalita` (z registru, bez textů norem).
- Veřejné kalkulačky nad hotovým engine (`cableAmpacity`, `checkCoordination`, úbytek napětí).
- SEO po stránkách (`src/lib/seo.ts`): kratší description, H1 s klíčovými slovy, sitemap bez přihlašovacích stránek, statické `lastmod`.

## Fáze 57 – Projekt elektroinstalace jako samostatný produkt

- Vlastní vstup z `/dum` (dnes `/panel-builder/floorplan`), průvodce, balíčky (realizační projekt / s podpisem autorizované osoby / doplňky).
- Výstupy: technická zpráva dle vyhl. 131/2024 Sb., PDF výkresy, datová kabeláž (ČSN EN 50173-4), topologie chytré domácnosti.
- Fronta „ověření autorizovanou osobou“ ve velínu.

## Fáze 58 – normový hlídač v Průmyslovém doku

- Lhůty revizí VTZ z registru (po doplnění pravidla PR-016 z přílohy č. 4 NV 190/2022 Sb.).
- Posuzování zařízení podle norem platných v době zřízení.
- Upozornění na nová vydání norem (např. ČSN 33 2000-7-701 ed. 3, ČSN EN IEC 62305 ed. 3).

## Mimo kód (rozhodnutí uživatele)

- Nasazení fází 50–54 („nasaď to na produkci“), vypnutí demo režimu na produkci nebo demo na samostatné doméně.
- B2C prodej projektů: autorizovaná osoba ČKAIT, pojištění odpovědnosti, zápis s.r.o., obchodní podmínky pro spotřebitele, GDPR.

---

# 📄 ZADANI-faze-55.md

# Zadání fáze 55 – AI Panel Builder a 2D půdorys (vloženo 2026-11-05)

Původní znění vložené do `docs/PLAN.md` během práce na fázi 54 (opravy veřejného webu). V textu je uvedené jako „Fáze 54“;
číslo 54 už nese fáze oprav webu, proto je zařazené jako fáze 55. **Text končí uprostřed bodu 6** (poslední slova „varné plotýnky pro“) –
zbytek bodu 6 (oprava nahrání PDF půdorysu „Plocha 0 × 0 m“) chybí. Realizace čeká na potvrzení uživatele.

Bod 1 se částečně překrývá s fází 54: zdvojené emoji 🚀 / 📄 na úvodní stránce odstranila fáze 54; sestavení stromu PB-001
(List 3 „Nezapojeno ve stromu“, chybějící spojnice na Listu 2) zůstává pro fázi 55.

---

Na základě kontroly nasazené aplikace a Katalogu ABB 2026 provedeme v AI Panel Builderu a 2D půdorysu 6 zásadních oprav a vylepšení (Fáze 54). Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj:

1. OPRAVA VZOROVÉHO 6LISTOVÉHO ELABORÁTU NA ÚVODNÍ STRÁNCE (`/ukazka-elaboratu` a `PB-001`) + DUPLICITNÍ IKONY:
- V `image_3c1c24.png` je na Listu 3 vzorového elaborátu `PB-001` prázdné jednopólové schéma s červenou chybou `"Nezapojeno ve stromu: -Q1, -FV..."` a na Listu 2 chybí modré spojnice, protože položky `PB-001` nemají v databázi sestavený strom (`fedFromIncomer` / `parentItemId`).
- Oprav to na dvou místech:
  a) V `prisma/seed-panel-builder.ts` u vzorového projektu `PB-001` po vytvoření položek automaticky aplikuj `proposeTree()`, aby `-Q1` měl `fedFromIncomer = true`, `-FV1` a `-FI1` visely pod `-Q1` a všechny jističe `-F1` až `-F10` byly řádně zapojené s rozvrženými fázemi a vyplněným `routineTestJson`.
  b) V `src/server/panel-documentation.ts` ve funkci `buildDocumentationData`: pokud má projekt v režimu `showcase: true` (nebo `PB-001`) některé prvky nezapojené ve stromu, automaticky nad daty před vykreslením `renderSingleLineDiagramSvg` a `renderPanelDrawingSvg` spusť `proposeTree()`, aby veřejná ukázka na úvodní stránce měla VŽDY 100% kompletní jednopólové schéma na Listu 3, modré propojky na Listu 2 a nula chyb!
- Na úvodní stránce (`src/app/(site)/page.tsx` a `SampleElaborateDialog.tsx`) odstraň z textu tlačítek duplicitní textové emotikony `🚀` a `📄`, když už tlačítko obsahuje Lucide ikonu `<Rocket />` / `<FileText />`.

2. VOLBA 1FÁZOVÉ / 3FÁZOVÉ INSTALACE A AUTOMATICKÁ PRÁCE S VODIČI A SBĚRNICEMI `PE` A `N` (`TN-C-S` vs. `TN-S`):
Rozšiř datový model projektu (`PanelBoardProject`), 2D půdorys, soupis místností, vektorové plátno i PDF dokumentaci o volbu fází a správu `PE` / `N` vodičů:
- **Volba soustavy a počtu fází (`supplyPhases` & `networkSystem`):**
  * V hlavičce projektu rozváděče, v modalu Nový projekt i v 2D půdorysu přidej jasný přepínač:
    1) **`3f soustava (3× 230/400 V AC)`** se třemi variantami přívodu:
       - `TN-C-S (přívod 4-vodič L1, L2, L3, PEN -> rozdělení PEN na PE a N v tomto rozváděči)`
       - `TN-S (přívod 5-vodič L1, L2, L3, N, PE -> PE a N již rozděleny před rozváděčem)`
       - `TT (L1, L2, L3, N + vlastní uzemnění PE)`
    2) **`1f soustava (1× 230 V AC)`** se dvěma variantami přívodu:
       - `1f TN-S (přívod 3-vodič L, N, PE – 230 V)`
       - `1f TN-C-S (přívod 2-vodič L, PEN -> rozdělení PEN na PE a N v rozváděči)`
  * Pokud je zvolena **1f soustava (230 V)**:
    - Automatický generátor rozváděče osazuje **2P hlavní vypínač (`2M`)**, **1f přepěťovku (`2M`)** a **2P proudové chrániče (`2M`)** (nebo `1P+N` RCBO).
    - Všechny okruhy jsou přiřazeny na fázi `L1` (v fázové bilanci se hodnotí proud 1f přívodu bez falešného varování na nesymetrii L2/L3!).
- **Automatický model a vizualizace `PE` a `N` sběrnic (můstků) v rozváděči (`src/lib/panel-builder/pe-n-busbars.ts`):**
  * Vytvoř deterministický výpočet svorkovnic `PE` a `N` pro každý rozváděč:
    1) **Hlavní ochranná sběrnice `PE` (zeleno-žlutá):** Spočítej potřebný počet přípojných míst (`1× přívod PE/PEN` + `1× uzemnění/MET` + `1× SPD` + `počet všech koncových jisticích vývodů` + `20 % rezerva`) a vyber odpovídající PE sběrnici (např. `PE sběrnice 12 / 18 / 24 / 36 otvorů`).
    2) **Bod rozdělení `PEN -> PE + N` (pouze u `TN-C-S`):** Pokud je soustava `TN-C-S`, vykresli a zapiš do schématu i kusovníku **propojku (klemu) mezi sběrnicí `PE` a hlavní nulovou sběrnicí `N0`** s popisem `"Bod rozdělení PEN -> PE + N (ČSN 33 2000-5-54 ed. 3)"`. U soustavy `TN-S` jsou `PE` a `N0` plně izolované bez propojky!
    3) **Hlavní nulová sběrnice `N0` (modrá – před chrániči):** Pro přívod `N`, napájení `N` pólů jednotlivých proudových chráničů (`-FI1`, `-FI2`...), `1P+N` jističochráničů (`-FA1`...) a okruhů mimo skupinové chrániče.
    4) **Izolované skupinové nulové můstky `N-FI1`, `N-FI2`, `N-FI3`... (modré – ZA každým proudovým chráničem!):**
       - Pro KAŽDÝ proudový chránič (`RCD`, `-FIx`) v rozváděči automaticky vytvoř samostatný, elektricky oddělený modrý nulový můstek `N-FIx`, do kterého jsou přivedeny nulové vodiče výhradně těch koncových jističů (`-Fy`), které mají `parentItemId = FIx.id`!
       - Zobraz počet obsazených a volných svorek na každém můstku (např. `Můstek N1 (za -FI1): 7 / 10 svorek`).
  * **Vizualizace na 2D vektorovém rozváděči, v 1P schématu a v kusovníku (BOM):**
    - Přímo na 2D vektorovém plátně (`VectorPanel.tsx`) i na Listu 2 PDF dokumentace vykresli v horní nebo spodní části skříně (podle směru přívodu) grafickou lištu svorkovnic: zeleno-žlutý blok **`PE`** (s propojkou na `N0` při `TN-C-S`), modrý blok **`N0`** a samostatné modré bloky **`N1 (za -FI1)`**, **`N2 (za -FI2)`** se šroubky a počtem připojených vodičů!
    - Kliknutím na blok `PE / N svorkovnice` na plátně zobraz přehledné vysvětlení a rozpis, který okruh je na který N-můstek připojen.
    - Všechny vypočtené `PE` a `N` můstky automaticky přidej jako položky do Kusovníku (List 4).

3. OPRAVA LOGA HAGER (`hager` MÍSTO `hagergroup`):
- V `public/brands/hager.svg` a `ManufacturerLogo.tsx` nahraď šedé korporátní logo `hagergroup` oficiálním modrým logem **`hager`** (`#005CA9`, čistá tučná typografie `hager`).

4. 2D PŮDORYS (`/panel-builder/floorplan`): PŘESUN VÝBĚRU VÝROBCE A ŘADY ÚPLNĚ NAHORU + 15 DESIGNOVÝCH ŘAD ABB S NÁHLEDY A DYNAMICKÝMI BARVAMI DLE KATALOGU 2026:
- **Přesun z levého panelu do horní lišty:**
  * Odstraň velký blok `🎨 Domovní přístroje` z levého bočního panelu (kde teď zabírá polovinu výšky a vytlačuje rozváděč, zásuvky a vypínače mimo obrazovku!).
  * Umísti výběr **Výrobce -> Designová řada (s grafickým náhledem tvaru) -> Barva (s přesnými barvami dané řady)** do **horní vodorovné lišty přímo nad rastr půdorysu**! Levý panel tak bude od samého vrchu patřit výhradně osazovaným prvkům (`⚡ Rozváděč`, `🔌 Zásuvky`, `💡 Světla a vypínače`, `🔥 Samostatné spotřebiče`).
- **Kompletní designové řady ABB a jejich přesné barvy dle Katalogu ABB 2026 (`src/lib/panel-builder/abb-catalog-2026.ts`):**
  * Když uživatel vybere výrobce **ABB**, zobraz všech **14 designových řad pro zapuštěnou montáž + 3 nástěnné řady IP44/IP54**, každou s **2D SVG náhledem typického tvaru rámečku a klapky** (např. *Tango* zaoblený rámeček, *Levit* vrstvený čtvercový s barevnou spárou, *Zoni* moderní tenký matný, *Decento* kulatý porcelánový retro, *Time* s kovovým proužkem):
    1) `Zoni` (`T`) -> barvy: `Bílá (500)`, `Matná bílá (240)`, `Šedá / bílá (241/141)`, `Pudrová / bílá (242/142)`, `Olivová / bílá (243/143)`, `Greige / bílá (244/144)`, `Matná černá (237)`, `Matná černá / bílá (137)`.
    2) `Tango` (`A`) -> barvy: `Bílá (B)`, `Slonová kost (C)`, `Šedá (S)`, `Béžová (D)`, `Hnědá (H)`, `Černá (N)`, `Kouřová šedá (S2)`, `Vřesová červená (R2)`.
    3) `Levit` (`H`) -> barvy: `Bílá / ledová bílá (01)`, `Bílá / bílá (03)`, `Šedá / bílá (16)`, `Slonová kost / bílá (17)`, `Macchiato / bílá (18)`, `Bílá / kouřová černá (62)`, `Žlutá / kouřová černá (64)`, `Červená / kouřová černá (65)`, `Oranžová / kouřová černá (66)`, `Zelená / kouřová černá (67)`.
    4) `Levit M` (`H`) -> barvy: `Onyx / kouřová černá (63)`, `Perleťová / ledová bílá (68)`, `Ocelová / kouřová černá (69)`, `Titanová / kouřová černá (70)`.
    5) `Time` (`E/F`) -> barvy: `Bílá / ledová bílá (01)`, `Bílá / bílá (03)`, `Titanová (08)`, `Starostříbrná (32)`, `Šampaňská (33)`, `Antracitová (34)`, `Ocelová (36)`.
    6) `Time Arbo` (`E/F`) -> barvy: `Starostříbrná / přírodní javor`, `Starostříbrná / olše`, `Starostříbrná / třešeň`, `Titanová / třešeň`, `Antracitová / mahagon`, `Antracitová / wenge`.
    7) `Element` (`E`) -> barvy: `Bílá / ledová bílá`, `Bílá / bílá`, `Agáve`, `Karmínová`, `Karamelová`, `Titanová`, `Platinová`.
    8) `Swing` (`G`) -> barvy: `Jasně bílá (B1)`, `Krémová (C1)`, `Béžová (D1)`, `Světle šedá (S1)`, `Hnědá (H1)`.
    9) `Swing L` (`G/J`) -> barvy: `Jasně bílá (B1)`, `Krémová (C1)`, `Mocca (C3)`, `Světle šedá (S1)`, `Cihlová (R3)`.
    10) `Classic` (`3553`) -> barvy: `Jasně bílá (B1)`, `Béžová (D2)`, `Hnědá (H3)`.
    11) `Decento` (`K`) -> barvy: `Porcelán bílá`, `Porcelán černá`, `Porcelán bílá / dřevo buk`, `Porcelán bílá / dřevo třešeň`, `Porcelán černá / dřevo wenge`.
    12) `future linear` -> barvy: `Alpská bílá (84)`, `Matná alpská bílá (884)`, `Slonová kost (82)`, `Antracitová (81)`, `Matná černá (885)`, `Hliníková (83)`.
    13) `solo / solo carat` -> barvy: `Studio bílá`, `Slonová kost`, `Šedá metalíza`, `Chrom`, `Zlato`, `Bronz`, `Břidlice`.
    14) `Busch-axcent` -> barvy: `Studio bílá`, `Černá`, `Červená`, `Modrá`, `Zelená`, `Žlutá`, `Beton`, `Břidlice`, `Dřevo`.
    15) `Garant (IP44)` / `Variant+ (IP54)` / `Praktik (IP44)` -> barvy: `Bílá`, `Šedá`, `Béžová`, `Hnědá`.
  * **DŮLEŽITÉ:** Jakmile uživatel klikne na jinou designovou řadu (např. přepne z `Tango` na `Zoni` nebo `Classic` nebo `Levit M`), nabídka barev se OKAMŽITĚ PŘEPNE na skutečné barvy dané řady (a pokud předchozí barva v nové řadě neexistuje, automaticky se vybere první výchozí barva nové řady)! Totéž udělej pro řady Schneider Electric (`Nová Unica`, `Sedna`, `Asfora`, `Mureva Styl`), Legrand (`Valena Life`, `Valena Allure`, `Céliane`, `Niloé`, `Plexo`) a Hager (`lumina`, `berker`).

5. GENERÁTOR KUSOVNÍKU DOMOVNÍ INSTALACE (BOM S MNOŽSTVÍM A PŘESNÝMI OBJEDNACÍMI KÓDY DLE KOMPLETNOSTI):
- Podle Katalogu ABB 2026 (str. 26 "Sestavování přístrojů") se stavebnicový vypínač skládá z **Přístroje (strojku 1)** + **Krytu v barvě (4)** + **Rámečku 1R–5R v barvě (5)**, jednonásobná zásuvka z **Přístroje s krytem (2)** + **Rámečku (5)** a dvojzásuvka z **Kompletního přístroje (3)**.
- Vytvoř v `src/lib/panel-builder/wiring-bom.ts` funkci `compileFloorplanBom(nodes, mode)`, která pro celý naklikaný projekt v 2D půdorysu vygeneruje **kompletní položkový kusovník (BOM) s přesnými objednacími čísly (MPN) a součty kusů**:
  * Spočítá samostatně **Přístroje spínačů pod omítku** (např. `3559-A01345` pro řazení 1, `3559-A06345` pro ř. 6, `3559-A07345` pro ř. 7, `3559-A05345` pro ř. 5, `3559-A52345` pro ř. 6+6, `3559-A87345` pro 1/0+1/0, `3559-A89345` pro žaluziový spínač).
  * Spočítá **Kryty spínačů v přesné zvolené řadě a kódu barvy** (např. u Zoni bílá `3559T-A00651 500` jednoduchý / `3559T-A00652 500` dělený / `3559T-A00662 500` žaluziový; u Tango `3558A-A651 B`; u Levit `3559H-A00651 03`; u Time `3558E-A00651 03` – podloženo daty v `WiringDevice` + deterministickou maticí z Katalogu ABB 2026).
  * Spočítá **Zásuvky 1N a 2N** v přesné řadě a kódu barvy (`6619T-A06657 500`, `5513T-C02157 500`, `6619A-A06357 B`, `5513A-C02357 B`, `6619H-A06357 03`, `5513H-C02357 03`...).
  * Spočítá **Rámečky podle násobnosti (1R až 5R)** v přesné řadě a barvě (`3901T-A00010 500` až `A00050`, `3901A-B10 B` až `B50`, `3901H-A05010 03` až `A05050`...).
  * Spočítá **Instalační krabice KOPOS** (`KU 68-1901` pro běžnou montáž nebo `KPR 68 / KPRL 68-70/LD` hluboké krabice) a **Kabely CYKY** po metrech.
- V pravém panelu 2D půdorysu (a v samostatném modalu **`[ 📋 Zobrazit kompletní kusovník (BOM) a objednací čísla ]`** s exportem do **CSV / XLSX a tiskem PDF**) zobraz tuto kompletní tabulku se sloupci: **Kategorie · Objednací číslo (MPN) · Název a specifikace · Řada a barva · Počet ks / m**. Stejný kusovník přenes i do vygenerovaného projektu v AI Panel Builderu!

6. INTERAKTIVNÍ SCHEMATICKÉ ZNAČKY NA PŮDORYSU + OPRAVA NAHRÁNÍ PDF PŮDORYSU (`Plocha 0 × 0 m`):
- **Interaktivní schematické značky místo obyčejných teček:**
  * V 2D půdorysu (`/panel-builder/floorplan`) nahraď malé kruhové tečky skutečnými, čitelnými **interaktivními SVG elektrotechnickými značkami (dle ČSN EN 60617 / ČSN 01 3481)**:
    - **Zásuvky (1Z, 2Z, ZL, IP44, RJ45):** Půlkruhová značka zásuvky se svislou čarou (u 2Z s dvojitou ryskou / číslem `2`, u IP44 se stříškou) + barevný lem podle barvy přístroje.
    - **Vypínače (S1, S5, S6, S6+6, S7, T1, T2, ZAL, STM, PIR, TER):** Kruh spínače se šikmým praporkem podle počtu klapek a směru (1 praporek = ř. 1, 2 praporky = ř. 5, protilehlé praporky = ř. 6 / 6+6, 4 praporky = ř. 7, trojúhelník = tlačítko, šipky = žaluzie).
    - **Svítidla:** Křížek v kruhu (`⊗`) pro stropní svítidlo, nástěnná konzola pro nástěnné svítidlo.
    - **Samostatné spotřebiče (VD, TR, MY, PR, SU, CH, BO, TČ, EV, FVE):** Výrazný čtvercový technologický symbol s vnitřní piktogramovou ikonou spotřebiče (varné plotýnky pro

---

# 📄 ZADANI-faze-56.md

# Zadání fáze 56 (2026-11-05, z chatu)

Kontext: vlastní posouzení rizik databáze navrh-rozvadece.cz (zvláštní právo pořizovatele databáze § 88a a násl. AZ,
nekalá soutěž § 2976 OZ). Doporučení: zdroj nepoužívat, ze vzorku nechat jen souhrnnou statistiku, katalog plnit
z primárních zdrojů výrobců.

Zadání uživatele (doslovně):

> v tom případě se drž doporučení a zastav stahování dat z navrh-rozvadece.cz začni stahovat katalogy a produktové listy
> výrobců působících ve střední Evropě a začni z nich tvořit naši vlastní databázi, náš AI panel builder stále funguje
> velmi špatně a rozpoznávání je na mizerné úrovni i když dodáme více kvalitních fotek, musíme se zaměřit na vyřešení
> tohoto problému, také musíme vyřešit GDPR souhlas na našich stránkách, musíme přidat možnost přihlásit se
> k newsletteru, kam budeme zasílat novinky cca 1x za měsíc. Dále musíme upravit rozložení webových stránek eldock.cz,
> aby to působilo lépe jak na běžné elektrikáře, revizní techniky tak i na technické ředitele a údržbáře.

Rozdělení:
- Zdroj navrh-rozvadece.cz a katalogy výrobců → repozitář `ai-panel-builder` (FAZE.md, fáze 41 / 41b).
- Rozpoznávání fotek, souhlas s cookies, newsletter a úvodní stránka → Eldock fáze 56.

---

# 📄 ZADANI-faze-57.md

# Zadání fáze 57 (2026-11-06, z chatu)

Kontext: 2D půdorys & kabeláž v AI Panel Builderu (`/panel-builder/floorplan`, fáze 49–55). Uživatel přiložil výřez
půdorysu (ložnice 1.03 a šatna 1.04) se zásuvkami vloženými editorem – značky neodpovídají normě.

Zadání uživatele (doslovně):

> když chci navrhnout 2D půdorys & kabeláž, tak při vložení pdf mi chybí možnost otočení o 90° a potřebuji tam přidat
> možnost zoomu. Dále, když vložím PDF, musím obnovit stránku, aby se zobrazilo. Dále když zvolím možnost kalibrovat
> místnost, bylo by dobré tam mít nějaké ověření a potvrzení, že to opravdu sedí, jak má ještě tam musíme přidat
> možnost oříznutí vloženého PDF, vytvoř menu úprava pdf, pod kterým budou k dispozici tyto možnosti. Dále možnost
> nastavit rezervu na kabeláž v %. Před generováním finální dokumentace, je potřeba zvolit prostředí dle normy.
> schematické značky zásuvek nesedí s normou stejně tak nesedí ani schematické značky vypínačů, navíc je potřeba mít
> možnost u nich nastavit měřítko a po vložení do projektu je potřeba, aby byla možnost je přesunout, případně
> i odstranit. Když zvolím úroveň instalace, nic se v podstatě nemění a stále tam mám klasické vypínače, tohle musíme
> úplně předělat.

Rozpad:
1. Menu „Úprava PDF“: otočení o 90° (doprava / doleva), zoom (přiblížit / oddálit / celý výkres, kolečko myši, posun),
   ořez podkladu tažením (a jeho zrušení), kalibrace měřítka s ověřením druhou kótou a potvrzením (tolerance ±2 %),
   u PDF navíc kontrola proti měřítku výkresu z razítka (1 : 50, 1 : 100 …).
2. Chyba: nahrané PDF se zobrazí až po obnovení stránky.
3. Rezerva kabeláže v % (výkaz kabeláže, kusovník, dokumentace).
4. Prostředí dle ČSN 33 2000-5-51 ed. 3 povinně před generováním rozváděče z půdorysu i před tiskem / propuštěním
   dokumentace (protokol o určení vnějších vlivů).
5. Značky zásuvek a vypínačů dle ČSN EN 60617-11 (zásuvka 11-13-xx, spínače 11-14-xx), řazení podle skutečného
   párování, měřítko značek (celý nákres i jednotlivá značka), přesun a mazání osazených značek i v režimu vkládání,
   otočení značky a natočení zásuvky ke stěně.
6. Úroveň instalace mění ovládání: klasika = vypínače dle řazení, sběrnice = sběrnicová tlačítka / detektory /
   prostorové jednotky (jedna sběrnicová linka, světla hvězdou), retrofit = vypínače s modulem a bezdrátová tlačítka;
   převod osazených ovladačů při změně úrovně, kabeláž a kusovník podle úrovně.

Zdroj tvarů značek: galerie ProfiCAD (značky s čísly EN 60617-11 11-13-01, 11-13-04, 11-13-09, 11-14-01 až 11-14-09)
– převzaty jen tvary, kresba je vlastní (SVG v `FloorSymbol.tsx`). Knihovna IEC 60617 (library.iec.ch) vrátila 403.

---

# 📄 ZADANI-faze-58.md

# Zadání fáze 58 (2026-11-06, z chatu)

Zadání uživatele (doslovně, vloženo jako text):

> co je potřeba doladit:
>
> Co se neověřilo: E2E fáze 48 (demo-docs, phase46) a opakovaný běh phase48 zůstávají bez úspěšného běhu kvůli
> nedostatku RAM.
>
> Ověřit správnost symbolů modulárních přístrojů jako jsou jističe chrániče přepěťové ochrany a vše ostatní s tímto
> související jako stykače, relátka a podobně, nemůžeme si dovolit špatně zakreslené symboly. Ideálně ke každému
> symbolu, který máme mít možnost náhledu do datasheetu.
>
> úvodní menu webové stránky popíšeme obecným popisem, proč celý projekt vznikl a co má lidem přinést, dále bude
> rozdělení na levé straně pro domovní elektroinstalace a na pravé pro průmysl, po rozkliknutí jednoho, nebo druhého
> bude zákazník přesměrován na část, podle své volby. Celkově musíme mapu webu vylepšit.

Rozpad:
1. E2E `phase48`, `demo-docs` a `phase46` spustit znovu (v této relaci prošly už po fázi 57 – `phase46` po opravě testu).
2. Značky modulárních přístrojů v jednopólovém schématu podle ČSN EN 60617 (jistič, chránič, jističochránič, odpínač,
   odpojovač, pojistkový odpojovač, přepěťová ochrana, stykač, relé a jejich podtypy, zdroj, transformátor,
   elektroměr, svorka), legenda značek v dokumentaci a knihovna značek ke kontrole.
3. Náhled datasheetu u každého přístroje (krok 1, dokumentace, katalog).
4. Úvodní stránka: proč Eldock vznikl a co přináší, rozcestník vlevo Domovní elektroinstalace / vpravo Průmysl,
   samostatné stránky obou částí, lepší mapa webu (navigace, patička, sitemap.xml, drobečková navigace).

Zdroj tvarů značek: galerie ProfiCAD (EN 60617-7 – jističe, chrániče, odpojovače, odpínač, stykač, cívky relé
s kvalifikátory, elektroměr, pojistky, transformátor); přepěťová ochrana kreslena jako varistor (ČSN EN 60617-4)
s uzemněním. Kresba je vlastní (SVG v `src/lib/panel-builder/iec-symbols.ts`).

---

# 📄 docs/PLAN.md

# ELDOCK – rotující plán

Štíhlý plán: hotové fáze jsou tu jednou řádkou, podrobně se rozepisuje jen **otevřená fáze** (sekce B).
Celé zadání, odškrtnuté úkoly a deník fází 0–35 jsou v `docs/archiv/PLAN-faze-00-35.md`. Architektura, pravidla
a postup nasazení jsou v `CLAUDE.md`. Soubor drž pod 150 řádky.

**Jak plán používat**
- `/faze` = otevřená fáze ze sekce B, `/faze N` = konkrétní fáze. Jedna fáze = jeden commit (bez push), pak shrnutí.
- Nové zadání vlož do sekce B jako „Fáze N“ (N = poslední číslo ze sekce A + 1). Nepřepisuj celý soubor.
- Po dokončení: fáze přejde do tabulky v sekci A (jedna řádka), poznámka do deníku (sekce C) a sekce B se vyprázdní.
- Stavy: ⬜ nezahájeno · 🟨 rozpracováno · 🟦 hotovo, k nasazení · ✅ hotovo a nasazeno na produkci

## A. Hotové fáze

| # | Fáze | Stav |
|---|---|---|
| 0 | Scaffolding: Next.js 16, Tailwind, shadcn/ui, Prisma 7 | ✅ |
| 1 | Prisma schéma, generátory SVG grafiky a seed demo dat (Závod Jablonec + Liberec) | ✅ |
| 2 | App shell, tmavý design systém, přepínač rolí | ✅ |
| 3 | Level 1 – mapa areálu s budovami a odznaky | ✅ |
| 4 | Level 2 – izometrická budova, výběr patra | ✅ |
| 5 | Level 3 – půdorys patra, piny zařízení, filtry | ✅ |
| 6 | Detail zařízení: QR, bezpečnostní banner, schéma, kusovník, 3D skříň | ✅ |
| 7 | Workflow jádro: stavový automat, služby, uploady, testy | ✅ |
| 8 | Průvodce „Zadat změnu“ (redlining, fotky, hlasová poznámka) | ✅ |
| 9 | CAE back-office (tickety, nahrání revize) | ✅ |
| 10 | Schválení údržbou, vrácení k přepracování, archiv revizí | ✅ |
| 11 | PWA, responzivita, dokončení UX | ✅ |
| 12 | E2E testy (Playwright), README | ✅ |
| 13 | Pasport rozváděče (ČSN EN 61439) a lhůtník revizí (ČSN 33 1500) | ✅ |
| 14 | Revizní agenda spotřebičů a nářadí, vrstvy mapy, rychlá revize | ✅ |
| 15 | Chytrý plánovač revizí, hlasový dispečer, optimalizace pochůzky | ✅ |
| 16 | Provizoria, revizní závady, LOTO strom napájení, auditní report | ✅ |
| 17 | Víceúrovňové účty (RBAC, výřezy dat) a Studio výstavby závodu | ✅ |
| 18 | Vizuální Studio: drag & drop v areálu, kreslení zón, správa areálů | ✅ |
| 19 | Nový závod ve Studiu, kniha PCSCHEMATIC, diagnostika spojů, `/login` | ✅ |
| 20 | Rebranding na ELDOCK, produkční Docker (Hetzner / on-premise) | ✅ |
| 21 | Kreslení do fotek, PDF protokoly, hlídač lhůt e-mailem, import CSV | ✅ |
| 22 | Visual diff revizí, proklikávací CAE reference ve schématu | ✅ |
| 23 | Licenční moduly (Core + add-ony), administrace modulů, audit UX | ✅ |
| 24 | Výkon: SQLite PRAGMA a indexy, lazy loading, paralelní dotazy, Docker build | ✅ |
| 25 | Správa modulů a tarifů: podfunkce, Čisté pracoviště / Obchodní demo | ✅ |
| 26 | Produktové video v Remotionu a přehrávač na úvodní stránce | ✅ |
| 27 | AI Panel Builder I: katalog prvků, projekty rozváděčů, těžba PDF datasheetů | ✅ |
| 28 | AI Panel Builder II: Gemini s demo režimem, analýza fotky, Smart Fallback Picker | ✅ |
| 29 | AI Panel Builder III: strom zapojení, hromadné přiřazení, undo/redo, hlídač | ✅ |
| 30 | AI Panel Builder IV: oteplení (IEC TR 60890) a fázová bilance | ✅ |
| 31 | AI Panel Builder V: dokumentace rozváděče, CE štítek, prohlášení o shodě | ✅ |
| 32 | AI Panel Builder: rozváděče s mixem výrobců | ✅ |
| 33 | AI Panel Builder: živý konfigurátor prvku, katalog 220+ přístrojů | ✅ |
| 34 | AI Panel Builder: Vision Analyzer 2.0 (analýza po DIN lištách, kompaktní přístroje) | ✅ |
| 35 | Revize Studia (10 bodů UX): rozměr areálu X × Y, funkční měřítko, kóty, tažení stěn, 7 typů zón, vrata, banery a barvy zařízení, jemný rastr 1 m, spotřebiče do místností | ✅ |
| 36 | Konsolidace a technický dluh: stabilní E2E (zahřátí dev serveru, data plánovače podle pražského dne), optimistický konfigurátor, zpětná editace pater ve Studiu (`studioLayoutJson`), katalog Bonega, paralelní Vision Analyzer, originál fotky u zákresu, Remotion bez `<Img>`, materiál skříně v oteplení, `ELDOCK_LOCK_ACCOUNT_SWITCHER` | ✅ |
| 37 | AI Panel Builder: tmavé selecty, katalog ABB Compact Home (SHD/SH/FH), prompt (červená páčka = odpínač, B vs. C, těsné rámečky), ruční úprava rámečku, funkce obvodu se štítky, IEC prefixy -Q/-FI/-FA/-FV/-F/-K/-KA, nový krok 2 se skupinovými kartami | ✅ |
| 38 | Studio: budova v metrech bez limitu os (A…ZZ), více budov v jednom konceptu (jedna transakce), editovatelné názvy stávajících pater, krok 2 bez šablon + Zpět/Vpřed (30 kroků), krok 3 místnost → kategorie → produktové banery / úprava stávajících | ✅ |
| 39 | Studio: sloupy jako jemné křížky, vlastní nabídka kroku 3 (názvy kategorií a dlaždic, prefixy, vlastní dlaždice – `TenantSetting` + localStorage), štítky „☕ 2× Kávovar“ v místnostech (Studio i uložený půdorys), seskupené „Upravit stávající“ s − / + | ✅ |
| 40 | Studio: výchozí mapa závodu (bez automatického konceptu), proklik na budovu se 3 režimy (Zařízení a napájení / Místnosti, zóny a vrata / Budova a podlaží), úprava, přesun, změna místnosti a mazání uložených zařízení s potvrzením, poloha a rozměr stávající budovy; vzorové závody v metrech s bohatým vybavením (+92 zařízení, `db:demo-plant`) | ✅ |
| 41 | Dva samostatné produkty: AI Panel Builder (registrace firmy přes ARES, souhlas s přenesením odpovědnosti, vlastní přihlášení a lišta, kredity, vlastní projekty, údaje firmy v 6 listech PDF, potvrzení před tiskem) a Správa závodů (`/register-plant`: firma + závod + Technický ředitel v jedné transakci, jen vlastní závod); úvodní stránka se dvěma produkty | ✅ |
| 42 | AI Panel Builder: čistá referenční fotka (zoom / posun, bez rámečků), 2D vektorový rozváděč se standardizovanými mechanickými symboly (CAD Dark / Výkres osazení), našeptávač databáze prvků v konfigurátoru, párování chráničů podle AC/A a mA; krok 2 přímo nad vektorovým rozváděčem – hlavní přívod shora / zespoda, libovolný hlavní vstupní prvek, drag & drop, „Připojit jističe vpravo“, živé modré spojnice a hřebenové sběrnice | ✅ |
| 43 | AI Panel Builder: návrh rozváděče od nuly bez fotky (1× 12M, presety 8–36M, − / +, pořadí lišt, indikátor rezervy), kaskádové pravé menu výrobce → kategorie → parametry → karta k osazení s drag & drop a 1× / +3× / +6×, výběr skříně podle velikosti návrhu (P_max do oteplení), logo a razítko firmy v dokumentaci, popisky 1:1 (A4, CSV / XLSX), import externí databáze prvků `npm run catalog:sync` | ✅ |
| 44 | Most „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`, `FLOORPLAN_SPEC.md`): kalibrace měřítka X/Y a délky kabelů s instalačními zónami a úbytkem napětí, matice řazení vypínačů (klasika / chytré relé / Loxone), okruhy dle ČSN 33 2130 ed. 4, vyvážení fází, chrániče, přístroje na lištách a výběr skříně | ✅ |
| 45 | AI Panel Builder, krok 1: editovatelné štítky funkce se Smart Presety a číslováním (localStorage + DB), sticky karta přiřazeného přístroje s chytrým vložením (jiná lišta / nová lišta), akordeon Pokročilé, prostředí instalace dle ČSN 33 2000-5-51 ed. 3 (min. IP, teplota okolí), elektro-linter `validateSwitchboardState()` s opravou 1 klikem | ✅ |
| 46 | Legislativní paket 2027: knihovna návodů a datasheetů na kartě zařízení (vazba na prvek schématu), verzované zálohy PLC / HMI / měničů s Safety CRC, archivem a rollbackem, klasifikace zásahu dle Nařízení (EU) 2023/1230 v Července a CAE, normy ČSN EN IEC 61439 ed. 3 / 60204-1 ed. 3 a protokol o kusové zkoušce v Panel Builderu, LOTO dle ČSN EN 50110-1 ed. 4, QR doložka, hromosvody ed. 3, digitální pas baterie (EU 2023/1542) | ✅ |
| 47 | AI Panel Builder: katalog po výrobcích (rozcestník s vektorovými logy → kategorie → prvky s dlaždicovými filtry, globální hledání), 9 výrobců skryto, Siemens SENTRON a ABB z reálného 144M rozváděče (CA35R, DS301C, EN, S201-B2, free@home / KNX), ventilátory rozváděčů s datasheety a výpočtem průtoku v oteplení, domovní vypínače / zásuvky / rámečky (1 906 kusů) k obvodům i do místností Studia, Vision Analyzer pro velké rozváděče (pravidla A–F, detailní fotka lišty), přidat vpravo / duplikovat prvek, linter jako odznak | ✅ |
| 48 | Konsolidace: správa projektů Panel Builderu (hledání, filtr stavu, hromadný výběr, ✏️ hlavička s místem instalace, 🗑️ smazání s vrácením kreditu a úklidem fotek, chráněný vzorový PB-001), stav kroků ✓ Hotovo / Rozpracováno, nový projekt ze soupisu místností přes `floorplan-bridge`, záložky karty zařízení v jednom řádku, `npm run storage:cleanup`, index projektů, technické SEO (robots, sitemap, náhled odkazu, metadata, JSON-LD) a vzorový elaborát na úvodní stránce | ✅ |
| 49 | 2D půdorys elektroinstalace `/panel-builder/floorplan` (podklad obrázek / PDF / rastr s místnostmi, kalibrace na 2 kliky, paleta 4 skupin, párování vypínač → světlo, detail prvku s výškou, rámečkem 1R–5R a designovou řadou), 3D výpočet kabeláže s výškovým profilem a režimy Spodem / Vrchem / Optimalizovaně, živý výkaz kabeláže (rozpis kabelů, ΔU) a rozváděč z půdorysu na 1 klik (domovní přístroje řady, výkaz na listu 4) | ✅ |
| 50 | SuperAdmin velín `/superadmin` (heslo velínu, KPI, firmy a ruční kredity, objednávky s potvrzením úhrady v transakci, hlášení chyb AI s fotkami), samoobslužné dobíjení kreditů `/panel-builder/credits` (3 balíčky, variabilní symbol, česká QR platba SPD 1.0, zálohová faktura A4), „🐛 Nahlásit chybu AI“ v projektu | ✅ |
| 51 | Oficiální loga výrobců z `public/brands/` (`npm run brands:fetch`, vlastní PNG / WebP / SVG má přednost), rozcestník katalogu bez ORNO / POLLOCK / LOVATO a výrobců ventilátorů, dialog nového projektu jako 2×2 dlaždice s více fotkami a videem (6 ostrých snímků v prohlížeči, kombinovaná analýza celek + detaily lišt), 2D půdorys: kaskáda výrobce → řada → barva domovních přístrojů, 13 typů ovladačů (S6+6, ZAL, TER …) s kabeláží, živé kóty, přesun / změna rozměru / smazání místnosti | ✅ |
| 52 | Metodika ČSN 33 2130 ed. 4: 3 úrovně instalace (klasika / sběrnicová Smart Home – hvězda + 24 V DC / retrofit s N v každé krabici vypínače, CYKY-J a KPR 68), světla na RCBO typ A nikdy se zásuvkami, chrániče min. typ A a typ B pro EV / TČ / FVE, dvojzásuvka = 2 zásuvky, Iz podle uložení C / B2 / A2 / A1 se souběhem, koordinace IB ≤ In ≤ Iz a impedance smyčky v teplém stavu, 3 nová pravidla linteru s opravou 1 klikem, řazení ABB (1So … 1/0So), Saltek FLP bez předjištění, SG Ready / DLM / TOTAL STOP, legislativní rámec a protokol o určení vnějších vlivů v elaborátu, 3 zkoušky RCD v revizním protokolu | ✅ |
| 53 | Prediktivní údržba ve Správě závodů: sledované součástky (`MonitoredComponent` – cykly ze směnnosti, B10d a doba mise T_M, motohodiny s Arrheniovou korekcí, kalendářní limity filtrů / baterií, sklad náhradních dílů, výměna kusu na 1 klik), kabelový pasport přívodu (`Equipment.feeder*`, Iz dle ČSN 33 2000-5-52 ed. 2 s korekcí teplotou a seskupením, IB ≤ In ≤ Iz, ΔU), simulátor připojení nového stroje kaskádou až k TR1, % Iz v pavoukovi napájení, odznaky v hlídači lhůt a přehledu areálu, ukázková data Závodu Jablonec (`db:demo-lifespan`) | ✅ |
| 54 | Opravy veřejného webu z analýzy eldock.cz: vzorový PB-001 nezávisle na katalogu (kroky `seedPanelBuilder` samostatně, `failures`, `db:panel-builder` vždy – firma Tester jen s demem), úvodní stránka nabízí elaborát jen s PB-001, „Vyzkoušet ukázkovou firmu“ bez hesla v prohlížeči, 404 místo přesměrování na `/login` (`PLANT_ROUTE_PREFIXES`), `www.*` → 301 (Caddyfile), mobilní menu, tlačítka bez přetečení a bez zdvojených emoji, NV 118/2016 + 117/2016 Sb. v podmínkách, `/ochrana-osobnich-udaju` a `/obchodni-podminky` | ✅ |
| 55 | AI Panel Builder a 2D půdorys: strom vzorového PB-001 (seed + oprava existující DB, kusová zkouška, ukázka si strom navrhne sama), soustava přívodu 1f / 3f a TN-C-S / TN-S / TT (`supplyPhases`, `lib/panel-builder/supply.ts`, hlavička, Nový projekt, půdorys, generátor 2P / 1f SPD / 2P chrániče, vše na L1, bez falešné nesymetrie), svorkovnice PE / N0 / N-FIx (`pe-n-busbars.ts`, vektorový rozváděč, List 2, kusovník), logo hager, horní lišta půdorysu výrobce → řada (náhled tvaru) → barvy řady (17 řad ABB 2026, `abb-catalog-2026.ts`), kusovník domovní instalace s objednacími čísly (`wiring-bom.ts`, CSV / XLSX / tisk, List 4), značky ČSN EN 60617 na půdorysu | ✅ |
| 56 | Rozpoznávání fotek (výchozí `gemini-3.1-pro-preview` + záložní 2.5 Pro, lupa na každý přístroj z plného rozlišení s pojistkou ≥ 40 px/modul, sloučení řady LED signálek s lištou, RCD typ a citlivost i v lištové cestě, víc detailů jedné lišty a detail části lišty bez mazání, fotky 4096 px, párování podle řady z čela, měřák `npm run eval:recognition`), souhlas s cookies (`ConsentManager`, kategorie, GA4 jen po souhlasu přes `ELDOCK_GA4_ID`, záznam `ConsentRecord`, „Nastavení cookies“), newsletter s dvojím potvrzením (`NewsletterSubscriber` / `NewsletterIssue`, potvrzení / odhlášení / RFC 8058, velín: přehled, CSV, zkušební e-mail, rozeslání), úvodní stránka pro elektrikáře, revizní techniky, technické ředitele a údržbu | ✅ |
| 57 | 2D půdorys: menu „Úprava PDF“ (otočení o 90°, zoom a posun, ořez, kalibrace s ověřením druhou kótou ±2 % a kontrolou proti měřítku výkresu), robustní nahrání PDF (pdf.js z dat, předběžné načtení, průběh), rezerva kabeláže v %, značky dle ČSN EN 60617-11 s řazením z párování, měřítko značek a přesun / otočení / mazání i při vkládání, úroveň instalace mění paletu ovládání (sběrnicová tlačítka / bezdrátová tlačítka a moduly), převádí ovladače, kabeláž (sběrnicová linka) i kusovník, prostředí dle ČSN 33 2000-5-51 ed. 3 povinně před generováním, tiskem a propuštěním dokumentace | ✅ |
| 58 | Značky modulárních přístrojů v jednopólovém schématu dle ČSN EN 60617 (`iec-symbols.ts`: jistič se spouštěmi, chránič / jističochránič se spouští IΔ a toroidem, odpínač, odpojovač, pojistkový odpojovač, přepěťová ochrana jako varistor s uzemněním, stykač, relé s kvalifikátory cívky, hlídací / hladinové relé, termostat, zdroj, transformátor, elektroměr, svorka; neznámý prvek = obecná značka), legenda na Listu 3, knihovna značek `/panel-builder/catalog/znacky`, náhled datasheetu u každého přístroje (krok 1, dokumentace, katalog), úvod „proč Eldock vznikl“ s rozcestníkem Domovní elektroinstalace / Průmysl, stránky `/domovni-elektroinstalace` a `/prumysl`, společná hlavička a patička s mapou webu, drobečková navigace a sitemap | 🟦 |

Fáze 36–38 jsou nasazené 2026-11-02 (commit `e9bfd76`), oprava kmitání plátna „Celé“ (`bd37aeb`) také; fáze 39 nasazena 2026-11-02 (commit `3c99981`). Fáze 40 a 41 nasazeny 2026-11-03 (commit `2ad82e4`), fáze 42 nasazena 2026-11-03 (commit `41e823d`), fáze 43 nasazena 2026-11-03 (commit `cd0910a`), fáze 44 a 45 nasazeny 2026-11-04 (commit `6e697a3`). Fáze 46 a 47 nasazeny 2026-11-04 (commit `7568296`). Fáze 48 a 49 nasazeny 2026-11-05 (commit `f118289`). Fáze 57 nasazena 2026-11-06 (commit `6853165`, migrace `environment_confirmed` – propuštěné projekty potvrzené z `releasedAt`, ostatní se potvrzují jedním klikem na stránce dokumentace). Fáze 56 nasazena 2026-11-06 (commit `debb728`, migrace `consent_newsletter`; v produkčním `.env` přepnut se souhlasem uživatele 2026-11-06 řádek `GEMINI_VISION_MODEL` na `gemini-3.1-pro-preview` (kontejner znovu vytvořen, `healthy`), `ELDOCK_SMTP_URL` chybí → potvrzení newsletteru jen v logu, `ELDOCK_GA4_ID` nenastaveno → bez lišty cookies). Fáze 50–55 nasazeny 2026-11-05 (commit `576a7a1`, migrace `supply_phases`; přesměrování `www` → 301 načteno do Caddy bez restartu přes `caddy reload` z kopie Caddyfile – viz CLAUDE.md, sekce 7).

## B. Otevřená fáze

**Fáze 59 – zatím nezadaná** ⬜

Další plánované fáze z analýzy webu (`docs/archiv/ZADANI-faze-54.md`): normový registr v Eldocku, Projekt elektroinstalace jako produkt,
normový hlídač. Katalog výrobců pokračuje v repozitáři `ai-panel-builder` (FAZE.md, fáze 41b).

Šablona pro nové zadání (vložte sem, nepřepisujte celý soubor):

```
### Fáze 59 – <název>
**Cíl:** <jedna věta>
- [ ] <úkol>
**Hotovo když:** <ověřitelná kritéria> · `npm run verify` OK
**Commit:** `feat(faze59): <popis>`
```

## C. Deník (jen poslední záznamy, starší jsou v archivu)

| Fáze | Datum | Poznámky |
|---|---|---|
| 58 | 2026-11-06 | Zadání z chatu (vložený text „co je potřeba doladit“) → `docs/archiv/ZADANI-faze-58.md`. **E2E 48 / demo-docs / 46:** v této relaci prošly už po fázi 57 (phase46 po opravě zastaralého testu) a znovu po fázi 58 – nedostatek RAM se tu neprojevil. **Značky** (`lib/panel-builder/iec-symbols.ts`, tvary podle galerie ProfiCAD s čísly EN 60617-7): spínací kontakt se značkou funkce na pevném kontaktu (jistič křížek, odpojovač čárka, odpínač čárka + kroužek, stykač půlkroužek), jistič s tepelnou a elektromagnetickou spouští v sérii, chránič / jističochránič se spouští IΔ (čárkovaná vazba) a součtovým transformátorem, pojistkový odpojovač, přepěťová ochrana jako varistor (ČSN EN 60617-4) s uzemněním, cívky relé – obecná, s mechanickým přidržením (impulzní), zpožděný přítah (časové), zpožděný odpad (schodišťový automat), měřicí relé U<> / hladina / θ, měnič AC/DC, transformátor, elektroměr Wh, svorka, PLC a obecná značka. Dřív se neznámý prvek kreslil jako jistič a relé / zdroj jako prázdný obdélník. `symbolKindOf` z kategorie + `relaySubtype` / `moduleSubtype` (hlavní vypínače = odpínač, „odpojovač“ jen výslovně), s cívkou / spouští širší rozteč schématu (92 px). Legenda značek pod schématem na Listu 3, knihovna `/panel-builder/catalog/znacky` (schéma + půdorys ČSN EN 60617-11, odkaz z katalogu). **Datasheety:** `lib/panel-builder/datasheets.ts` (uložený `datasheetUrl` = ověřený; ABB / Schneider / Siemens / Eaton / Hager podle obj. čísla = „ověřte“ – weby výrobců blokují automatické ověření, Hager 200, Siemens přesměruje do SiePortal; jinak vyhledání), `componentDatasheetAction` + `DatasheetDialog` (značka, parametry z katalogu, původ dat, odkazy, PDF uložené v Eldocku přímo v náhledu) v kartě přiřazeného přístroje (krok 1), v novém přehledu „Značky a datasheety přístrojů“ na stránce dokumentace a v katalogu. **Web:** úvod = proč Eldock vznikl + co přináší (3 hodnoty) + rozcestník vlevo Domovní elektroinstalace / vpravo Průmysl, stránky `/domovni-elektroinstalace` (elektrikář, Panel Builder, 2D půdorys, 4 kroky, kredity) a `/prumysl` (ředitel, údržba, revizní technik, problém / řešení, pilíře, role), `lib/site-map.ts` (navigace, části, patička, BreadcrumbList), `SiteChrome` (hlavička, patička s mapou webu i na právních stránkách a ukázce, drobečky), `LandingSections`, sitemap.xml + 2 stránky. Kotva technického ředitele `#technicky-reditel`. Testy: `lib/panel-builder/phase58.test.ts` (7), E2E `phase58.spec.ts` (2), upravené `landing`, `phase54`, `phase56`, `phase48.test.ts`. `npm run verify` 651 testů OK, E2E 58, landing, 46, 48, 54, 56, demo-docs a panel-builder OK. **Neověřeno:** vzory adres stránek výrobců ABB, Schneider a Eaton (blokují automatické dotazy). |
| 57 | 2026-11-06 | Zadání z chatu (výřez půdorysu ložnice / šatny s nenormovými značkami) → `docs/archiv/ZADANI-faze-57.md`. **Chyba „PDF se zobrazí až po obnovení“:** v čistém prohlížeči (Edge, prázdný nákres, malé PDF) se nepodařilo zopakovat – podklad se ukázal hned (E2E na původním kódu prošel). Nahrání je proto robustnější: PDF jde do pdf.js přímo jako data (`renderPdfFile`, bez blob URL a cache), výsledek JPEG 3200 px, nahraný obrázek se před přepnutím nákresu načte a dekóduje (`preloadImage`, 3 pokusy), `<image key={url}>` a nad plátnem průběh „Vykresluji PDF… / Nahrávám… / Načítám…“; u vícestránkového PDF hláška, že je použita 1. strana. **Úprava PDF** (`lib/panel-builder/floorplan-pdf.ts`, `PdfEditMenu`): otočení o 90° doprava / doleva i s místnostmi a značkami (podklad se znovu nenahrává – `rotation` + `crop` v px otočeného obrázku, `backgroundTransform`), zoom (menu, tlačítka na plátně, Ctrl + kolečko ke kurzoru, posun kolečkem / tažením, výřez jako zlomek výkresu), ořez tažením (značky mimo výřez se po potvrzení odstraní, místnosti zkrátí, „Zrušit ořez“ vše vrátí, měřítko zůstává). **Kalibrace** (`CalibrationDialog` místo `window.prompt`): skutečná délka kóty + náhled plochy a varování při zjevně chybných jednotkách, u PDF kontrola proti měřítku výkresu z razítka (velikost stránky v pt → mm / px × 1 : N), pak povinné ověření druhou kótou – potvrdit lze jen v toleranci ±2 % (`CalibrationRecord`: none / set / verified). **Značky** (`FloorSymbol.tsx`, tvary podle galerie ProfiCAD s čísly EN 60617-11 11-13-01/04/09 a 11-14-01 až 09; IEC library vrátila 403): zásuvka = otevřený oblouk s nožičkou ke stěně a ochranným kontaktem, dvojzásuvka čárka + 2, RJ45 sdělovací zásuvka, vypínač kroužek s čarou a praporkem podle skutečného řazení z párování (`effectiveSwitchNo`: 1 / 5 / 6 / 7, doutnavka křížek, tlačítko soustředné kroužky, stmívač klínek), svítidla ⊗, rozváděč obdélník s vyplněnou polovinou; černá kresba na podkladu, světlá na rastru, popisek se neotáčí. Velikost `SYMBOL_MM` 300 mm × měřítko nákresu (40–400 %) × měřítko značky (50–300 %). Zásuvka / nástěnné svítidlo se při vložení i přetažení přicvakne ke stěně místnosti a natočí. Přesun a mazání: v režimu vkládání klik na značku ji vybere a táhne (nevloží další), plovoucí lišta (otočit, −, +, smazat), R / šipky / Delete, pravé tlačítko = konec vkládání. **Úroveň instalace** (`PaletteItem.levels` / `bus` / `wireless`, `paletteFor`, `convertForLevel` s potvrzovacím dialogem): klasika = vypínače dle řazení, sběrnice = sběrnicová tlačítka 1 / 2 / 4 / 6×, žaluziové tlačítko, detektor přítomnosti, prostorová jednotka, čidlo, dotykový panel (kresba v rámečku „sběrnice“), retrofit = klasické vypínače se štítkem M + bezdrátová tlačítka / PIR bez kabelu. Kabeláž: `busNodeIds` → jedna sběrnicová linka `BUS_LEG_CABLE` z rozváděče (zelená tečkovaná trasa), bez svodů CYKY-O, žaluzie z aktoru, termostat po sběrnici; hvězda světel kreslena od rozváděče. Kusovník: sběrnicové prvky bez MPN (dle systému), bez strojků spínačů; retrofit moduly pod vypínač na každou spínanou větev, spínací modul do krabice svítidla u bezdrátového tlačítka, bezdrátové tlačítko bez krabice. **Rezerva kabeláže** = `profile.slackPercent` v horní liště (0–50 %), propisuje se do výkazu a dokumentace. **Prostředí:** `FloorplanDraft.environment` povinné před generováním (`generationChecklist` – měřítko ověřené + prostředí), migrace `environment_confirmed` (`PanelBoardProject.environmentConfirmedAt`, propuštěné projekty doplněny z `releasedAt`), projekt z půdorysu převezme prostředí a teplotu okolí, stránka dokumentace má kartu `EnvironmentConfirm` – bez potvrzení nejde tisk ani propuštění (`ENVIRONMENT_BLOCKER` i v `releaseDocumentation`), PB-001 potvrzen v seedu. E2E zahřívá i `/panel-builder/floorplan` (studený dev server editor kompiluje minuty a přenačítá). Testy: `lib/panel-builder/phase57.test.ts` (15), `services/phase57.test.ts` (3), upravené `phase51.test.ts` (skupina Ovládání), E2E `phase57.spec.ts` (2), `phase49.spec.ts` (prostředí před generováním). E2E `phase46` „kusová zkouška“ opraven (od fáze 55 má PB-001 v seedu vyplněný protokol – test čekal „NEÚPLNÝ“). `npm run verify` 644 testů OK, E2E 49, 51, 52, 55, 57, panel-builder, demo-docs, 41, 45, 46, 48 a 54 OK. **Neověřeno:** skutečné PDF uživatele (původní chyba v čistém prostředí nenastala), značky sběrnicových prvků nemají normovou předlohu (EN 60617-11 je nezná) – kresleny jako tlačítko / čidlo v rámečku sběrnice. |
| 56 | 2026-11-05 | Zadání z chatu po vlastním posouzení rizik databáze navrh-rozvadece.cz → `docs/archiv/ZADANI-faze-56.md`. Zdroj navrh-rozvadece.cz vyřazen a katalog výrobců řešen v `ai-panel-builder` (fáze 41: registr 23 výrobců, `manufacturer_docs.py`, staženo ABB 680 stran + Schneider Acti 9 328 stran + OEZ; stažená data konkurence v karanténě mimo projekt – trvalé smazání provede uživatel). **Rozpoznávání – nalezené příčiny:** (1) víc detailních fotek jedné lišty → zůstala jen poslední (`Map` podle lišty); (2) detail jen části lišty smazal ostatní přístroje lišty i zapojení; (3) lištová cesta zahazovala `rcdType` / `rcdSensitivityMa`; (4) fotky zmenšené na 2400 px; (5) zastaralý model `gemini-2.5-pro`. **Měření** (`scripts/eval-recognition.ts`, `lib/panel-builder/recognition-eval.ts` – zarovnání Needleman–Wunsch po lištách; fotka osazeného rozváděče ABB z katalogu 2024, 995 px, hrubá pravda): 2.5 Pro 4–5 / 21 přístrojů se správnou strukturou (řadu LED signálek vzal jako další lištu s 10–14 „přepěťovkami“), 3.1 Pro 20 / 21 (95 %, kategorie 100 %, šířky 95 %); hodnoty proudů na 995 px nečitelné ani pro lupu – 2.5 Pro je vymýšlel („C20“ u všech) → pojistka `MIN_ZOOM_PX_PER_MODULE = 40`. **Změny:** `DEFAULT_VISION_MODEL = gemini-3.1-pro-preview` (+ `docker-compose.yml`), Gemini 3+ bez teploty a s `MEDIA_RESOLUTION_HIGH`, 404 / 400 → záložní `gemini-2.5-pro`; fáze C „lupa“ (`readDevicesZoomed`: výřez přístroje z plné fotky, zvětšení do 1280 × 960, dávky po 6, `mergeZoomReading` – hodnoty od jistoty 0,4, kategorie / póly od 0,6, odpínač SHD/SD dál MAIN_SWITCH, chyba dávky nic nerozbije; `GEMINI_ZOOM_PASS=0` vypne), `mergeTouchingRails` + prompt (LED signálky patří k liště), `rail-merge.ts` (detail celé lišty ji nahradí, detail části ji jen zpřesní, nesedící detail nic nezmění + upozornění, uživatelem potvrzené přístroje se nepřepisují), všechny detaily lišty se čtou, `PANEL_PHOTO_MAX_PX = 4096`, párování preferuje řadu přečtenou z čela (`seriesHit`). **Souhlas s cookies:** `lib/consent.ts` (cookie `eldock_consent` v1, 6 měsíců, nová verze = nový dotaz), `ConsentManager` (lišta jen s volitelnou službou – dnes GA4 přes `ELDOCK_GA4_ID`, konfigurace za běhu z `GET /api/consent`; „Přijmout vše“ / „Odmítnout vše“ stejně výrazně, nastavení po kategoriích, odvolání smaže `_ga*`), `ConsentRecord` přes `POST /api/consent` (bez IP), odkaz „Nastavení cookies“ v patičce i na právních stránkách; zásady v1.1 (sekce `#cookies`, `#newsletter`, souhlas a GA4 jako účely). **Newsletter:** migrace `consent_newsletter`, `services/newsletter.ts` (normalizace e-mailu, souhlas text + verze + čas, token jen jako SHA-256, platnost 7 dní, nový e-mail nejdřív za 10 min, nepotvrzené po 30 dnech smazány, rozeslání jen potvrzeným / cílové skupině s `List-Unsubscribe` + `List-Unsubscribe-Post`), stránky `/newsletter/potvrzeni` a `/newsletter/odhlaseni` (akce až tlačítkem – skenery pošty; v adrese jen kód stavu), `POST /api/newsletter/unsubscribe`, formulář `NewsletterSignup` (nezaškrtnutý souhlas, profese, past na roboty, limit 5 pokusů / 10 min na IP), velín – záložka Newsletter (počty, profese, CSV, zkušební e-mail, rozeslání s potvrzením). Bez `ELDOCK_SMTP_URL` jde potvrzovací odkaz jen do logu. **Úvodní stránka:** nadpis „elektrodokumentace od rodinného domu po výrobní závod“, navigace Pro elektrikáře / Pro revizní techniky / Pro průmysl / Novinky / Kontakt, rozcestník „Jsem…“ (4 karty, na mobilu hned pod úvodem), sekce pro každou skupinu (`lib/landing-audiences.ts`: bolest, funkce, co dostanete, tlačítka), produktové karty u elektrikáře a technického ředitele, normy a data (`TRUST_POINTS` ověřené proti normovému registru), blok Novinky, patička s rozcestníkem a nastavením cookies, nový SEO titulek a popis. Testy: `lib/phase56.test.ts` (15), `lib/phase56-web.test.ts` (7), `services/phase56.test.ts` (2), `services/phase56-newsletter.test.ts` (5), E2E `phase56.spec.ts` (5), `landing.spec.ts` (nový nadpis); E2E `phase48` „hromadný výběr“ opraven – od fáze 55 je PB-001 dokončený, ochrana se ověřuje ve filtru „Vše“. `npm run verify` 627 testů OK, E2E landing, phase41, phase48, phase51, phase54, phase56 a panel-builder OK. **Neověřeno:** rozpoznávání na skutečných fotkách zákazníků (měřeno jen na 1 katalogové fotce), rozesílání přes SMTP (lokálně bez SMTP – jen odkaz v logu). |
| 55 | 2026-11-05 | Zadání `docs/archiv/ZADANI-faze-55.md` (vloženo do plánu během fáze 54 jako „Fáze 54“, **text končí uprostřed bodu 6** – oprava „Plocha 0 × 0 m“ po nahrání PDF chybí; doplněna jen pojistka: prázdná stránka → chyba místo nulového měřítka). **PB-001:** `applyProposedTree` (proposeTree + saveTree), `completeShowcase` / `repairShowcaseProject` (strom jen u nezapojeného projektu, kusová zkouška 8× vyhovuje), `buildDocumentationData` v režimu ukázky navrhne strom jen pro vykreslení. **Soustava:** migrace `supply_phases` (`supplyPhases` výchozí 3), `supplyOf` čte i starší text `networkSystem`; `proposeTree(…, { supplyPhases: 1 })` = vše L1; generátor `buildSwitchboardFromCircuits({ supplyPhases: 1 })` 2P vypínač, SPD 1P+N, 2P chrániče, varování u 3f spotřebičů; `ThermalEnclosure.supplyPhases` vypne nesymetrii, `PhaseBalance singlePhase`. **Sběrnice:** PE = přívod + MET + SPD + koncové vývody (MCB / RCBO) × 1,2 → 12 / 18 / 24 / 36 (nad 36 více kusů), N0 = přívod + N póly chráničů + N SPD + RCBO a vývody mimo chrániče, N-FIx = vývody s nejbližším chráničem -FIx (bez 3P), propojka PEN jen TN-C-S; `BusbarStrip` (klik = rozpis) nad / pod vektorovým rozváděčem ve 2. kroku, pás na Listu 2, řádky kusovníku bez objednacího čísla („dle výrobce skříně“). **Logo:** wordmark `hager` #005CA9 (`WORDMARKS`, Wikimedia zdroj odebrán). **Řady:** `ABB_SERIES_2026` (14 + Garant / Variant+ / Praktik), barvy s kódy, `seriesColors` / `colorForSeries` (stejná skupina, jinak první barva řady), Schneider / Legrand / Hager dál obecné skupiny (katalogové barvy v podkladech chybí); horní lišta `DeviceAppearance` + `SeriesPreview`, levý panel jen paleta. **Kusovník:** `compileFloorplanBom` – strojky 3559-A…345 (ř. 1 / 5 / 6 / 7 / 6+6 / 1/0+1/0 / žaluzie), kryty a zásuvky a rámečky podle matice ze zadání (Zoni, Tango, Levit, Time), odvozené varianty `verified: false`, bez podkladu `null` („doplnit“), krabice KU 68-1901 / KPR 68, kabely z výkazu; `WiringBomDialog` a List 4 (`doc-home-bom`). **Značky:** `FloorSymbol` (zásuvky, vypínače podle řazení, svítidla, spotřebiče s piktogramem). **Odchylky:** barvy Schneider / Legrand / Hager a objednací čísla mimo matici ze zadání nevymyšleny; E2E `panel-builder.spec.ts` krok 2 začíná u PB-001 se stromem 13/13. Testy: `panel-builder/phase55.test.ts` (7), `phase51.test.ts` (aktualizace řad), E2E `phase55.spec.ts` (2), panel-builder (7), phase48 / 49 / 51 / 52 OK; `npm run verify` 598 testů OK. |
| 54 | 2026-11-05 | Zadání z analýzy webu a normového registru (`docs/archiv/ZADANI-faze-54.md`, plán fází 55–58). **PB-001:** na produkci `/ukazka-elaboratu` vracela 404 (v DB chyběl PB-001 – příčina na serveru neověřena; `seedPanelBuilder` ho zakládal až po katalogu a selhání kroku vše zastavilo). Teď každý krok běží samostatně a chyby vrací ve `failures` (`db:panel-builder` je vypíše a skončí kódem 1, plný seed spadne), entrypoint pouští `db:panel-builder` vždy (Tester jen s `ELDOCK_SEED_DEMO=1`), úvodní stránka nabízí elaborát jen při `hasShowcaseProject()`. **Demo:** `TESTER_COMPANY` (včetně hesla) byl v klientském balíčku `PanelAuthForms` – nově `loginDemoCompanyAction` přihlásí firmu na serveru. **404:** proxy přesměruje na `/login` jen `PLANT_ROUTE_PREFIXES` (`lib/routes.ts`, test hlídá všechny složky `(app)` / `(print)`), ostatní projde do Next.js (soubor nebo 404); 404 stránka vede primárně na úvodní stránku. **Caddy:** `@www header_regexp` → 301 na doménu bez www (funguje s jakýmkoli `ELDOCK_DOMAINS`; neověřeno na serveru). **Mobil:** `LandingMobileNav` (Sheet), tlačítka `whitespace-normal`, bez emoji v nadpisech a tlačítkách. **Právo:** podmínky odkazovaly na NV 116/2016 Sb. (ATEX) → 118/2016 + 117/2016 Sb., zásady zpracování osobních údajů `lib/legal.ts` (Hetzner, Gemini, e-mail, jen nezbytné cookies – **před ostrým prodejem právní kontrola**), veřejné obchodní podmínky, odkazy v patičce a u registrace, obě stránky v sitemap. **Vložené zadání:** během práce se do plánu vložilo další zadání („Fáze 54“ – AI Panel Builder a 2D půdorys) → archivováno jako `ZADANI-faze-55.md`, čeká na potvrzení. Testy: `lib/phase54.test.ts` (5), `panel-builder.test.ts` (+1), E2E `phase54.spec.ts` (2); `npm run verify` 591 testů OK, E2E landing, phase41, phase48, phase54 OK. |
| 53 | 2026-11-05 | Zadání z `docs/archiv/ZADANI-faze-53.md` (vloženo spolu s fází 52, v textu jako „Fáze 52“). Před začátkem vrácen `.env.example` – obsahoval skutečné heslo velínu (na pokyn uživatele, do Gitu se nedostalo). **Model:** migrace `lifespan_cables` – `Equipment.shiftRegime` (výchozí 2), `internalTempC`, `feederCableType / ConductorMaterial / CrossSectionMm2 / ParallelRuns / LengthM / InstallMethod (E) / GroupingCount / AmbientTempC (30) / UpstreamBreakerA`, `nominalCurrentA`, `measuredCurrentA`; model `MonitoredComponent` + enum `ComponentWearCategory` (Cascade se zařízením). **Engine:** `lib/component-lifespan.ts` (směny 2 000 / 4 000 / 6 000 / 8 760 h/rok, cykly = offset + hodiny × sepnutí/h, Arrhenius `max · 2^−(T−40)/10` jen pro výkonovou elektroniku, výchozí 35 °C, limity cykly / B10d, motohodiny, kalendář T_M; nejhorší rozhoduje; 🟢 < 75 %, 🟡 75–95 % nebo < 90 dní, 🔴 ≥ 95 % / po termínu; chybějící náhradní díl) a `lib/cable-sizing.ts` (Itab Cu PVC / XLPE pro B2 / C / E / D 1,5–240 mm², Al = 0,78 × Cu, k_temp nejbližší vyšší teplota tabulky, k_group dle metodiky 1 / 0,88 / 0,82 / 0,77 / 0,73 / 0,70, Iz = Itab · běhy · k1 · k2, IB = naměřeno klešťákem > součet podřízených × 0,8 > jmenovitý, NEJIŠTĚNÝ KABEL při In > Iz, ΔU 3f 400 V ≤ 5 %, doporučený průřez, `simulateAddedLoad` – přírůstek na cílovém přívodu, výš se soudobostí 0,8, zdroj TR1 podle jmenovitého proudu). **UI:** záložka „🔍 Diagnostika & Spoje“ je u všech pevných zařízení (rozváděče a stroje): `ComponentLifespan` (směnnost, T rozváděče, karty s progress barem, cykly / motohodiny, Arrhenius, Skladem / ⚠️ Chybí na skladě, datum výměny, 🔄 výměna = reset 0 % + odpis ze skladu + záznam do poznámky, + Přidat sledovanou součástku s rychlým výběrem z kusovníku revize) a `FeederCableCard` (Itab → Iz → In → IB, ΔU, ✏️ úprava pasportu a měření klešťákem, 🧪 simulátor kW / A s posuvníkem); kniha PCSCHEMATIC (diagnostika spojů) pod nimi. Odznaky v hlavičce karty (⏳ součástky, 🔌 přívod). Pavouk napájení: popisek „CYKY-J 50 · 78 % Iz“ barevně podle stavu. `PredictiveWatch` – odznaky „⏳ Součástky před koncem životnosti (N)“ a „🔌 Přetížené / nejištěné kabely (N)“ v `/inspections/alerts` (se seznamem) a v přehledu areálu (jen když je co hlásit), výřez účtu se respektuje. Akce `actions/lifespan.ts` (údržba a revizní technici), služba `services/lifespan.ts`, dotazy `queries/health.ts`. **Seed:** `prisma/seed-lifespan-cables.ts` (plný seed + `npm run db:demo-lifespan` v entrypointu, značka `demo.lifespan-cables`, vlastní pasport ani sledované součástky nepřepisuje): TR1 ➔ RM1 3× 1-CXKH-R 240 (Iz 1 614 A), R-LIS-01 🟡, R-CNC-04 🔴 (In 125 A > Iz 105 A), R-ML-01 / LIS-01 / CNC-04 🟢; součástky -K1 94 %, -K_SAF1 42 %, -T1 97 % (Arrhenius 50 000 → 28 717 h, 0 ks), -FAN1 po termínu, -U1 58 %. **Odchylky:** (1) R-LIS-01 má kabel 3×120+70 místo 3×95+50 – s tabulkami ČSN by 3×95 při 7 kabelech a 38 °C mělo Iz ≈ 151 A < In 160 A (nejištěný), ne „86 % Iz“; teď vytížení ≈ 79 % = 🟡. (2) R-CNC-04 vychází Iz 105 A (zadání uvádí 112 A) – závěr In 125 A > Iz platí. (3) Zdroj -T1 je kvůli 97 % starší než rozváděč (2021) – v poznámce „převzatý z předchozího stroje“. (4) Výměna kusu nezakládá samostatný historický záznam, datum výměny se připíše do poznámky součástky. Testy: `lib/phase53.test.ts` (6), `services/phase53.test.ts` (3), E2E `phase53.spec.ts` (2); `npm run verify` 585 testů OK, E2E phase53, phase19 + phase24, phase21 OK. |
| 52 | 2026-11-05 | Do plánu vložena 2 zadání najednou → plná znění v `docs/archiv/ZADANI-faze-52.md` (metodika ČSN 33 2130 ed. 4, kritické opravy návrhu) a `ZADANI-faze-53.md` (životnost součástek a kabely – v zadání jako „Fáze 52“, uživatel určil pořadí: metodika = 52). Fáze 50 a 51 zatím nenasazené. **Engine** (`floorplan-bridge.ts`): `InstallMode` + `smart_retrofit`, `INSTALL_LEVELS` (UI nabízí 3 úrovně, `smart_relay` jen API); `DesignOptions` (`installMethod` C / B2 / A2 / A1, `groupedCables`, `countDoubleAsTwo` výchozí ano, `lightingProtection` rcbo / rcd_group, `supplyLoopOhm` 0,3 Ω, `environment`). Světla B10 = RCBO 1P+N typ A 30 mA na každý okruh (`rcd: "own"`), nebo chrániče jen pro světla (`A30L`, `RcdGroup.lightingOnly`); zásuvkové chrániče typ A, EV / TČ / nový štítek `pv_inverter` (Střídač FVE) = vlastní typ B (`RCD_TYPE_B_TAGS`). Zásuvky po max. 10 skutečných zásuvkách (dvojzásuvka = 2). Průřez: `cableAmpacity` (tabulky IEC 60364-5-52 Cu/PVC, 1f 2 a 3f 3 zatížené žíly), `groupingFactor` (B.52.17), tab. 9 (1,5 mm² v B2 / A1 / A2 max. 10 A), `checkCoordination` (IB ≤ In ≤ Iz, I2 = 1,45 · In ≤ 1,45 · Iz), `loopImpedanceCheck` (Zs = přívod + 2·L·ρ20/S; Ik,min = 0,8·U0/(1,5·Zs) ≥ Ia a Zsm ≤ 2·U0/(3·Ia), Ia = 5 / 10 · In) – nejmenší vyhovující průřez, každé zvětšení s důvodem a alternativou jističe (např. A2 + souběh 2 kabelů → 4 mm² nebo 13 A). `Circuit.izA`, `Circuit.loop`, `Circuit.tag`. Kusovník: KU 68 / KPR 68 (65 mm), modul pod vypínač (retrofit), vícepatrové svorkovnice, sběrnicový kabel, elektroměr RS-485 + 2× 120 Ω (sběrnice s EV / TČ / FVE), stavební detaily dřevostavby / venkovních prostupů (`constructionDetails`: membránové krabice, ProClima ROFLEX, Kopos KEZ_KB, zemnič V4A AISI 316Ti). Rozváděč: SPD „T1+T2 bez předjištění“, SG Ready relé (FVE + TČ), elektroměr DLM (EV + FVE / TČ), volba `centralStop` (tlačítko TOTAL STOP + vypínací spoušť). **Kabeláž** (`cable-routing.ts`): `installation` – sběrnice = hvězda světel (`starRoutes`, `CYKY-J 3×1,5`) a 1 sběrnicový kabel na ovládací místo (`BUS_LEG_CABLE`), retrofit = `switchLegCable` mění CYKY-O na CYKY-J (i 6+6 → `CYKY-J 5×1,5`). **UI:** 2D půdorys – lišta „Metodika ČSN 33 2130 ed. 4“ (úroveň instalace, uložení kabelů, souběh, přepínač dvojzásuvky; uloženo v nákresu), výkaz okruhů ukazuje jištění (RCBO … typ A 30 mA), Iz a Zs ≤ Zs,max; dialog soupisu místností – úroveň instalace (3), uložení kabelů, přepínač dvojzásuvky. Paleta: ABB řazení 1So, 1S, 1SSo, 1+1, 6+6/0, 7So, 1/0So (+ stávající 1, 5, 6, 6+6, 7, 1/0) a Střídač FVE. **Linter:** `rcd-type-ac` (oprava na typ A), `rcd-lighting-mixed` (světelné jističe pod chráničem se zásuvkami → RCBO 1P+N typ A 30 mA stejné šířky, `configure-many`), `rcd-type-b` (Wallbox / TČ / FVE za A / AC → přepnout na B; i RCBO). **Katalog:** Saltek FLP-25-T1-VSF a FLP-B+C-MAXI-VSF (T1+T2 3+1 bez předjištění, vnitřní odpojovač, dálková signalizace) v `seed-catalog-research.ts` – **odchylka:** šířka 8M a Iimp 25 kA orientačně (zdroj = zadání), ověřit v katalogu Saltek. **Dokumentace:** list 1 – právní a normativní rámec (zákon 283/2021 Sb., vyhl. 131/2024 Sb. příl. 9 D.2.5, zákon 250/2021 Sb., NV 190/2022 Sb., ČSN 33 2130 ed. 4 …, u rozvodnice pod omítku „Úplný kryt“ dle ČSN EN 60670-24); list 5 přejmenován na „Výpočet oteplení, technická data a vnější vlivy“ a obsahuje protokol o určení vnějších vlivů (`lib/panel-builder/external-influences.ts`: 15 vlivů AA … CB s třídou a opatřením podle prostředí instalace, krytí IP / IK, stavební detaily) – elaborát zůstává 6listový. Prostředí TIMBER = „Dřevostavba / Pasivní dům / Hořlavý podklad“. **Revize:** migrace `inspection_rcd_tests` (`InspectionRecord.rcdTestJson`), `lib/rcd-test.ts` (0,5 · IΔn nesmí vybavit, tΔ ≤ 300 ms, IΔ v pásmu podle typu – A / F 0,35–1,4, AC 0,5–1, B 0,5–2 · IΔn, Zsm ≤ ⅔ · U0/Ia), formulář revize pevných zařízení (rozbalovací „Zkouška proudového chrániče“) a 4 řádky v revizním protokolu, jen když se měřilo. **Odchylka:** test podle zadání `phase53-methodology.test.ts` je pojmenovaný `src/lib/phase52-methodology.test.ts` (číslo fáze). Testy: `phase52-methodology.test.ts` (12), upravené `floorplan-bridge.test.ts` (dvojzásuvka = 2, světla na RCBO) a `phase51.test.ts` (paleta), E2E `phase52.spec.ts` (2); `npm run verify` 576 testů OK, E2E phase52 + phase49 a phase48 + phase45 OK. |
| 51 | 2026-11-05 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-51.md`, plán obnoven z gitu (fáze 50 zatím nenasazena). **Loga:** `lib/panel-builder/brand-logos.ts` (slugy 18 značek, zdroje na Wikimedia Commons, `sanitizeSvg` – žádné skripty, obsluhy událostí ani externí odkazy, generovaný wordmark), skript `scripts/fetch-brand-logos.ts` (`npm run brands:fetch`, `--force`, `--offline`; existující soubory nepřepisuje) stáhl 11 oficiálních SVG (ABB, Siemens, Schneider, Eaton, Legrand, WAGO, Hager, Schrack, Rittal, Loxone, Hensel), pro Noark, OEZ, ETI, Hakel, Bonega, Saltek, SEZ (bez veřejného SVG) a 5 dalších výrobců vygeneroval vektorový wordmark bez bílého obdélníku. Route `GET /api/brand-logo/[slug]` vrací první existující `public/brands/<slug>.webp|png|svg` (vlastní logo nahrané uživatelem má přednost, cache 5 min → propíše se bez buildu), jinak wordmark; `/brands/*` a `/api/brand-logo/*` jsou v proxy veřejné. `ManufacturerLogo` = `<img>` na světlé podložce (`data-logo` zůstal). **Odchylka:** loga jsou ochranné známky výrobců – použití jen k označení katalogu jejich výrobků; přesné „věrné podle manuálu značky“ u generovaných wordmarků nelze zaručit, oficiální soubor stačí vložit do `public/brands/`. ORNO / Pollock / Lovato přidány do `HIDDEN_MANUFACTURERS`, Pfannenberg a STEGO = `FAN_ONLY_MANUFACTURERS` (mimo rozcestník, dál ve výběru ventilátoru v kroku 3). **Nový projekt:** 2×2 dlaždice (📐 od nuly, 📷 pasport z fotek / 🎥 videa, 🏠 soupis místností, 🗺️ 2D půdorys = odkaz), bez hranatých závorek; více fotek najednou (1. celkový pohled, ostatní detaily lišt 1, 2, 3 … – u každého náhledu volba celkový pohled / lišta / nepoužít) nebo video MP4 / MOV / WebM: `src/lib/video-frames.ts` vybere v prohlížeči 6 rovnoměrně rozložených snímků, v okolí každého nejostřejší ze 3 kandidátů (rozptyl Laplaceova operátoru), JPEG 1920 px 0,92; náhled videa s „📸 Zachytit aktuální snímek z videa“. Video se na server neposílá, jen snímky. `createPanelProjectAction` přijímá `railPhotos` → po analýze celkové fotky `analyzeRailDetails` (`services/panel-design.ts`) přečte každý detail jako svou lištu (`railPhotosJson`), lištu mimo rozpoznaný rozváděč přeskočí s upozorněním. **2D půdorys:** `lib/panel-builder/wiring-designs.ts` (ABB 12 řad, Schneider 4, Legrand 6, Hager 2; `dbSeries` = názvy řad v katalogu, 6 barev → `wd_color_family`), kaskáda `DeviceAppearance` nahoře v levém panelu (karty s logy, řady s počtem přístrojů, barevné kroužky; „🔄 Použít na celý půdorys“ / „Použít na vybranou místnost“), nové prvky dostanou aktuální řadu a barvu, detail prvku má řadu i barvu, „Soupis domovní instalace“ s výrobcem, řadou a barvou; spodní select řady odstraněn. Paleta: S1, S5, S6, S6+6, S7, T1, T2, ZAL, STM, PIR, S1S, S44, TER (`control`, `fixedSwitchNo`, `wiringCategory`, `led`, `ip44`, `heightMm` – termostat 1,5 m, PIR 2,2 m). Kabeláž (`cable-routing.ts`): S6+6 = svody `CYKY-O 5×1,5` (L + korespondenční pár pro obě větve), ZAL = `CYKY-J 5×1,5` k pohonu (z vypínače do nadpraží + 1 m), TER = `CYKY-J 3×1,5` k nejbližšímu tepelnému čerpadlu / bojleru, jinak do rozváděče. `pickWiringDevice` má preferenci barvy, kategorii (žaluzie, stmívač, čidlo, termostat) a IP44; ZAL a TER se v projektu přiřadí k jističi světel své místnosti. **Místnosti:** živé kóty X / Y / plocha při kreslení i úpravě, místnost se po nakreslení rovnou vybere (bez `prompt`), výběr klikem, přesun tažením i s prvky (`moveRoom`), žlutý roh a 4 stěny (`resizeRect`, min. 0,5 m), detail místnosti s rychlými štítky názvu, `Šířka X` / `Hloubka Y` v m a 🗑️ Smazat (i Delete / Backspace a v plovoucí liště nad místností; prvky zůstanou). Testy: `lib/phase51.test.ts` (15), `services/phase51.test.ts` (2), E2E `phase51.spec.ts`; selektory dialogu v E2E 43 / 48 / panel-builder upraveny. |
| 50 | 2026-11-05 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-50.md`, plán obnoven z gitu; fáze 48 a 49 označeny ✅ (nasazeny 2026-11-05). **Model:** migrace `credit_orders_ai_feedback` – `CreditOrder` (enum `CreditOrderStatus` PENDING / PAID / CANCELLED, unikátní `variableSymbol`, indexy firma + datum a stav) a `AiFeedbackReport` (vazby na projekt a firmu `SetNull`, snímek `detectedSnapshotJson`). **Kredity:** `lib/credits.ts` (balíčky START 10 / PROFI 30 / PROJEKTANT ROK, DPH 21 % zaokrouhlené na koruny, VS `RRRRNNNN`, `spdPayload` SPD 1.0 – zpráva bez diakritiky a `*`, max. 60 znaků, kontrola IBAN / částky / VS), služba `services/credits.ts` (`createCreditOrder` s opakováním při souběhu VS, `confirmCreditOrder` = jedna transakce `updateMany` PENDING → PAID + `increment` kreditů, opakované potvrzení nic nepřičte, `cancelCreditOrder`, `adjustCredits` 0–100 000, `bankIban` = `ELDOCK_BANK_IBAN` nebo demo IBAN v `COMPANY_INFO`). `/panel-builder/credits` (balíčky + moje objednávky; `?reason=no-credits` při 0 kreditech – tlačítko Nový projekt rovnou vede sem), `/panel-builder/credits/[id]` (QR platba `qrcode.react`, platební údaje) a `/invoice` (zálohová faktura A4 – dodavatel, odběratel s IČO / DIČ / sídlem, splatnost 14 dní, rozpis DPH, QR; tisk bez lišty). Kredity v liště = odkaz „🪙 Kredity: X (+ Dobít)“. **Hlášení AI:** „🐛 Nahlásit chybu AI“ v hlavičce projektu → `createAiFeedback` (jen projekt firmy; fotka, detailní fotky lišt a snímek prvků s typy, stavem rozpoznání a OCR). **Velín:** `lib/auth.ts` – cookie `eldock-superadmin` (8 h, `sameSite: strict`) podepsaná odvozeným tajemstvím `…:superadmin`, takže token velínu neplatí jako přihlášení do závodu ani naopak; `superadminPassword` = `ELDOCK_SUPERADMIN_PASSWORD`, mimo produkci přístupové heslo. **Odchylka (bezpečnost):** v produkci se na `ELDOCK_ACCESS_PASSWORD` nepadá – přístupové heslo dema znají i zákazníci, bez vlastního hesla je velín vypnutý (proměnné `ELDOCK_SUPERADMIN_PASSWORD` a `ELDOCK_BANK_IBAN` přidány do `docker-compose.yml`, hodnoty patří do serverového `.env`). Proxy: `/superadmin/login` veřejný, `/superadmin/*` jen s cookie (jinak přihlášení), velín smí číst fotky `/api/files/photos`; stránky i akce ověřují cookie znovu (`requireSuperadmin`), neúspěšné přihlášení zpomalí 0,6 s; `/superadmin` v robots zakázán. Stránka: KPI (firmy Panel Builder / závody, rozváděče, čekající objednávky + Kč, otevřená hlášení), záložky firmy (údaje, TIČR, projekty s náhledy fotek, +5 / +10 / +50 a ruční nastavení kreditů), objednávky (✅ potvrdit / storno) a hlášení (fotky se zvětšením a stažením originálu, snímek prvků, ✓ vyřešeno s poznámkou). Testy: `lib/phase50.test.ts` (7), `services/phase50.test.ts` (6), E2E `phase50.spec.ts`. |
| 49 | 2026-11-04 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-49.md`; fáze 48 před tím commitnuta na pokyn uživatele (`037a165`, E2E demo-docs a phase46 neověřeny kvůli RAM). **Engine:** `floorplan-bridge.ts` – `ElevationProfile` / `DEFAULT_ELEVATION` (strop 2600, podlaha 50, rozváděč 1500, zásuvky 300 / linka 1150, vypínače 1050, rezerva 10 % + 600 / 150 mm), `FloorNode.mountHeightMm / variant / frame`, nový druh `data_socket` (jen do kusovníku), `mountHeight`, `homeRunLength`, `calibrateFloorplanScale({ elevation, routing })` (bez profilu beze změny – testy fáze 44 platí); nový `cable-routing.ts` – řetěz okruhu k nejbližšímu prvku, `routeCircuit` BOTTOM / TOP (mezi krabicemi 2 × (výška + hloubka), společný rámeček bez svodu), `circuitRoutes` s OPTIMIZED = kratší varianta na okruh s přímým propojením ve zdi (stejná místnost a výška ≥ 900 mm), `summarizeCabling` (3 režimy, úspora oproti spodem i vrchem, rozpis kabelů vč. svodů k vypínačům `CYKY-O 3×1,5` a datových `UTP Cat6`, ΔU na nejdelší větvi). Odchylka: svody k vypínačům a datové kabely nejsou součástí silových okruhů – počítají se samostatně (vypínač ze stropní krabice světla, UTP z rozváděče). **Editor:** `lib/panel-builder/floorplan-editor.ts` (paleta 22 značek ve 4 skupinách, nákres v mm, `parseDraft` s kontrolou URL podkladu, `recalibrate`, `parseLength` „4,5 m“ / „4500 mm“, `buildPlan` – vícenásobný rámeček = víc uzlů se stejným `frame`, ovládání místnosti z párování, `analyzeDraft` pro živý výpočet), `/panel-builder/floorplan` (klient bez SSR – nákres v localStorage `eldock.pb.floorplan`): podklad obrázek / SVG (převod na PNG) / PDF (1. strana přes pdf.js) nahraný jako fotka, čistý rastr s kreslením místností, kalibrace 2 kliky + délka, lišta režimu a výšek, prvky tažením, Delete / Esc, párování vypínače se světlem (čárkovaná vazba, řazení 1 / 6 + 6 / 6 + 6 + 7), trasy Manhattan po okruzích (vrchem čárkovaně) s délkou, `CablePanel` s výkazem. Odkaz v horní liště a 4. volba v dialogu Nový projekt. **Rozváděč z půdorysu:** `createProjectFromFloorplan` (sdílený `createPlanProject` i pro soupis místností), domovní přístroje vybrané řady přes `pickWiringDevice` (zásuvka / dvojzásuvka / IP44, rámeček 2R–5R, vypínač podle řazení, přednost bílá) po místnostech k jističům, chybějící kusy řady = varování; migrace `panel_floorplan_cabling` – `floorplanJson` a `cableReportJson`, výkaz na listu 4 dokumentace (`doc-cables`). Testy: `cable-routing.test.ts` (12), `lib/phase49.test.ts` (6), `services/phase49.test.ts` (2), E2E `phase49.spec.ts` OK; `npm run verify` 534 testů OK. E2E phase48 po změně dialogu: projekt ze soupisu vznikl, ale test nepočkal 30 s na přesměrování studeného serveru → timeout 90 s; opakovaný běh ukončil nedostatek RAM (neověřeno, commit na pokyn uživatele). |

## D. Známé nedostatky a backlog

- E2E na čistém dev serveru: první minuta kompilace stránky přenačítá – řeší zahřátí v `e2e/global-setup.ts` (`E2E_SKIP_WARMUP=1` ho vypne).
- Vzorové závody na produkci doplní `db:demo-plant` jen jednou a jen na patrech bez vlastních úprav ze Studia; zařízení přidaná nebo smazaná mimo Studio štítky v uloženém půdorysu nepřepočítají (až další uložení patra ve Studiu).
- Backlog z MVP: skutečný serverový přepis hlasu, redlining nad PDF (pdf.js), offline synchronizace, PostgreSQL, elektronický podpis schválení.
