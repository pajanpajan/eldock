# Digitry – elektrodokumentace a údržba výrobních závodů (MVP)

B2B webová aplikace (PWA) pro správu elektrodokumentace výrobních závodů – schémata, kusovníky, dispozice rozváděčů – a pro **As-Built workflow** mezi údržbou v hale a externími CAE projektanty:

> technik v hale nahlásí změnu (zákres prstem do schématu, fotka, nadiktovaná poznámka) → zařízení zoranžoví → CAE projektant nahraje novou revizi → zařízení zmodrá → údržba revizi porovná a potvrdí, nebo vrátí → zařízení zezelená a stará revize jde do archivu.

![Areál závodu](docs/screenshots/01-areal.png)

| | |
|---|---|
| ![Izometrie budovy](docs/screenshots/02-izometrie.png) | ![Půdorys patra s piny](docs/screenshots/03-pudorys.png) |
| ![Detail zařízení s bezpečnostním bannerem](docs/screenshots/04-detail-banner.png) | ![Průvodce Zadat změnu – zákres](docs/screenshots/06-pruvodce-zakres.png) |
| ![CAE dashboard](docs/screenshots/08-cae-dashboard.png) | ![Schválení – porovnání revizí](docs/screenshots/07-schvaleni-porovnani.png) |

Další screenshoty jsou v [`docs/screenshots/`](docs/screenshots/).

## Funkce

- **3úrovňová mapa:** areál závodu (SVG) → 45° izometrie budovy s výběrem patra → zoomovatelný půdorys s piny zařízení. Barva pinu = stav dokumentace: 🟢 aktuální, 🟠 nahlášená změna, 🔵 nová revize čeká na schválení.
- **Detail zařízení** (i přes QR kód `/equipment/[id]`): bezpečnostní banner s fotkami, přepisem a zákresem předchozí směny, schéma se zoomem, kusovník (CSV export), 3D náhled skříně, historie revizí, tisk QR štítku.
- **Průvodce „Zadat změnu“** pro tablet a rukavice: zákres prstem/perem/myší, fotky (zmenšení na zařízení), hlasová poznámka (Web Speech API, jinak simulace), priorita.
- **CAE Back-Office:** KPI, tickety napříč závody s filtry a SLA, detail ticketu se zákresem a timeline, převzetí, nahrání revize (minor/major, editovatelný kusovník, demo „Vygenerovat upravené schéma“), storno, komentáře.
- **Schválení údržbou:** porovnání revizí vedle sebe (synchronní zoom), posuvníkem a prolínáním, rozdíl kusovníku, „Potvrdit a propsat do systému“ / „Vrátit k přepracování“ s komentářem.
- **Přepínač pohledu** v hlavičce: `Pohled: Údržba v hale` ↔ `Pohled: CAE Projektant` (bez přihlašování, MVP).
- Instalovatelná PWA, tmavé vysoce kontrastní rozhraní, celé UI česky.

## Požadavky

- **Node.js 22 LTS (≥ 22.12)** nebo 24 LTS, npm 10+
- Windows, macOS i Linux (vyvíjeno na Windows 11 s Git for Windows)
- Pro E2E testy prohlížeč Microsoft Edge (na Windows je vždy) nebo Chromium z Playwrightu
- Build potřebuje internet (font Geist přes `next/font/google`); aplikace sama žádné externí zdroje nenačítá

## Instalace a spuštění

```bash
npm install                 # nainstaluje závislosti a vygeneruje Prisma klienta
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run db:reset            # vytvoří dev.db, aplikuje migrace a nahraje demo data
npm run dev                 # http://localhost:3000
```

`npm run db:reset` kdykoli vrátí demo data do výchozího stavu (smaže změny ze zkoušení workflow).

## Skripty

| Skript | Co dělá |
|---|---|
| `npm run dev` | vývojový server (Turbopack) na portu 3000 |
| `npm run build` / `npm start` | produkční build a server |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | jednotkové testy (Vitest) – stavový automat, filtry, kusovníky, geometrie… |
| `npm run smoke` | celá smyčka workflow přes služby nad **kopií** `dev.db` (dev.db zůstane beze změny) |
| `npm run test:e2e` | Playwright E2E – vlastní dev server na portu 3200 s čistou `e2e.db` |
| `npm run verify` | typecheck + lint + test + build (povinné před každým commitem) |
| `npm run db:seed` / `db:reset` / `db:migrate` / `db:studio` | práce s databází (Prisma) |

### E2E testy

```bash
npm run test:e2e
```

- Playwright si sám spustí `next dev` na portu **3200** s databází `e2e.db` (vždy čerstvě vytvořená migrací a seedem) a build adresářem `.next-e2e` – běžící `npm run dev` ani `dev.db` neovlivní.
- Soubory nahrané během testů se po doběhnutí smažou.
- Výchozí prohlížeč je Edge (`channel: "msedge"`). Jinde: `npx playwright install chromium` a proměnná `E2E_BROWSER_CHANNEL=chromium`.
- Screenshoty do `docs/screenshots/` se obnoví s `E2E_SCREENSHOTS=1 npm run test:e2e` (PowerShell: `$env:E2E_SCREENSHOTS=1; npm run test:e2e`).
- Testy: `e2e/navigation.spec.ts` (areál → budova → patro → detail), `e2e/workflow.spec.ts` (celá smyčka přes přepínač rolí včetně kreslení myší, fotky z `e2e/fixtures/`, vrácení a schválení).

## Demo scénář (cca 5 minut)

Po `npm run db:reset`:

1. Pohled **Údržba** → mapa Závodu Jablonec: Hala A 🟠, Energetika 🔵.
2. Hala A → izometrie → 1. NP → oranžově pulzující **R-CNC-04** → detail: bezpečnostní banner s fotkami, přepisem a zákresem z předchozí směny.
3. Energetika → 1. PP → **RM1** (🔵) → „Zkontrolovat novou revizi“ → porovnání v1.2 a v1.3 → **Potvrdit a propsat do systému** → zelená, v1.2 v archivu.
4. Hala B → **R-ML-01** → **Zadat změnu**: zákres prstem, fotka, nadiktovaná poznámka → odeslat → oranžová.
5. Přepnout na **CAE Projektant** → dashboard → nový ticket ZM-2026-0043 → Převzít → Nahrát novou revizi → **Vygenerovat upravené schéma** → shrnutí → Odeslat ke schválení → modrá.
6. Zpět na **Údržbu** → R-ML-01 → porovnání → **Vrátit k přepracování** s komentářem → CAE nahraje znovu → Údržba schválí → zelená a kompletní historie (Platná / Vrácená s důvodem / Archiv).

## Architektura

```
src/
  app/                    Next.js App Router (stránky, /api/uploads, /api/files, manifest, ikony)
  components/             UI – map/ (areál, izometrie, půdorys), equipment/, change-request/,
                          canvas/ (redlining), cae/, revisions/, common/, layout/, ui/ (shadcn)
  lib/                    čisté funkce: status.ts (jediný zdroj barev a popisků stavů), format.ts,
                          workflow/state-machine.ts (pravidla přechodů), mock-graphics/ (SVG generátory),
                          bom-edit / bom-diff / cae-tickets / markup / files …
  server/
    queries/              čtení dat pro stránky (server-only)
    services/             business logika – dostává `prisma` a `actor`, každá změna v transakci + událost
    actions/              tenké Server Actions: role z cookie → zod → služba → revalidatePath
    session.ts, storage.ts
prisma/                   schema.prisma, migrace, seed.ts + seed-data.ts (realistická česká demo data)
storage/uploads/          nahrané soubory (fotky, revize, zákresy) – mimo public/, servíruje /api/files
e2e/                      Playwright testy, příprava DB, fixture
scripts/smoke-workflow.ts smoke test celé smyčky nad kopií DB
docs/PLAN.md              implementační plán, stavový automat, demo data a deník fází
```

- **Stack:** Next.js 16.4 (App Router, Turbopack, React 19), TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, `motion`, sonner, zod, react-zoom-pan-pinch, qrcode.react; Prisma 7.10 + SQLite (`@prisma/adapter-better-sqlite3`); Vitest, Playwright.
- **Stavový automat** (`src/lib/workflow/state-machine.ts`, viz `docs/PLAN.md` sekce B): `SUBMITTED → IN_PROGRESS → WAITING_APPROVAL → APPROVED`, vrácení `WAITING_APPROVAL → IN_PROGRESS`, storno. Stav zařízení se vždy odvozuje z otevřeného požadavku; služby hlídají invarianty (max. 1 platná revize a 1 otevřený požadavek na zařízení).
- **Soubory:** upload přes `POST /api/uploads` (Route Handler, ne Server Action kvůli limitu 1 MB), do DB se ukládá URL `/api/files/...`. SVG se zobrazují přes `<img>` (nespustí skripty) a `/api/files` posílá `Content-Security-Policy: sandbox`.
- **Grafika** (areál, izometrie, půdorysy, schémata, „fotky“ v seedu, 3D skříň) je generovaná kódem – žádné externí obrázky ani CDN.

## Známá omezení (MVP)

- Bez přihlašování a oprávnění – role je jen cookie z přepínače; demo uživatel role = Petr Novák (údržba) / Ing. Tomáš Král (CAE). `/api/uploads` neověřuje roli ani obsah souboru (jen příponu a velikost).
- Hlasová poznámka: rozpoznávání řeči z prohlížeče (Chrome/Edge), jinak simulace; audio se neukládá.
- Redlining jen nad SVG/obrázkem schématu (ne nad PDF), schémata v seedu mají 1 list.
- „Vygenerovat upravené schéma“ umí vykreslit jen prvky mock schématu (Q1, F1–F6, K1–K4, T1, A1, X1, X2).
- PWA bez service workeru – žádný offline režim.
- Další náměty (notifikace, import z EPLAN, elektronický podpis, multi-tenant…) viz `docs/PLAN.md` sekce F.

## Přechod na PostgreSQL

1. V `prisma/schema.prisma` změňte `provider = "sqlite"` na `"postgresql"`. Strukturovaná data (zákresy, polygony) jsou uložená jako `String` se serializovaným JSON, schéma tedy funguje beze změn (volitelně lze přejít na `Json`).
2. `npm i @prisma/adapter-pg@7 pg` a v `src/lib/prisma.ts` (a v `prisma/seed.ts`, `scripts/smoke-workflow.ts`) nahraďte `PrismaBetterSqlite3` za `PrismaPg({ connectionString: process.env.DATABASE_URL })`.
3. `DATABASE_URL="postgresql://uzivatel:heslo@server:5432/digitry"` v `.env`.
4. Smažte staré SQLite migrace (`prisma/migrations`) a vytvořte nové: `npx prisma migrate dev --name init`, pak `npx prisma generate` a `npm run db:seed`.
5. Nahrané soubory ze `storage/uploads` přesuňte na sdílené úložiště (nebo S3 – stačí upravit `src/server/storage.ts` a `/api/files`).
