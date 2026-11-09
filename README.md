# Eldock – Průmyslový dok dokumentace a revizí

**[eldock.cz](https://eldock.cz)** · eldock.eu · eldock.sk — elektrodokumentace, revize a údržba výrobních závodů.

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
- **Přihlašovací brána** (`/login`, přístupové heslo `ELDOCK_ACCESS_PASSWORD`) a přepínač účtů v hlavičce (ředitel, údržba, revizní technici, CAE projektant).
- **Aplikace Eldock pro Windows (fáze 71):** offline klient údržby v `apps/client` (Electron) – spárování kódem z „Můj účet“ nebo odkazem `eldock://`, data závodu v zařízení (IndexedDB), token zašifrovaný Windows DPAPI, vyhledání zařízení a QR štítek webkamerou i čtečkou čárových kódů, detail zařízení s dokumentací offline, úpravy z haly ve frontě (změna s fotkami, komentář, provizorium, závada, součástka, fotka) a automatické odeslání po připojení. Jádro synchronizace `src/sync-client/` sdílí s mobilní aplikací a serverem závodu.
- **Mobilní aplikace Eldock pro Android a iOS (fáze 73):** stejné rozhraní a jádro jako Windows v `apps/client` (Capacitor 8) – QR štítek fotoaparátem i bez internetu, token v Klíčence iOS / Android Keystore, fronta úprav odolná proti smazání dat WebView (zrcadlo v souborech aplikace), fotky fotoaparátem nebo z galerie, dokumenty v systémové aplikaci, připomenutí synchronizace a telefonní rozvržení se spodní lištou. Zkušební APK mimo Google Play, projekt iOS pro Xcode.
- **Server závodu (fáze 72):** pro závod s interní sítí bez internetu – `src/plant-server/` na počítači v síti závodu (Eldock pro Windows jako služba bez okna): spáruje ho správce kódem z Administrace → Zařízení, stáhne celý závod, zařízení v hale se synchronizují s ním (stejný protokol), úpravy z haly ukáže ostatním hned a cloudu je přepošle jménem techniků, kdykoli má spojení. Správa serveru v prohlížeči (heslo, spárování, kódy pro tablety, přeposlané úpravy).
- **Aplikace pro Windows, iOS a Android (fáze 70 – serverová část):** synchronizační API `/api/sync/v1` (`docs/SYNC_API.md`) – párování v „Můj účet“ kódem / QR, data závodu offline, fronta úprav z haly bez signálu (změny, provizoria, závady, fotky) a správa zařízení firmy v Administraci.
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
| `npm run backup` / `npm run backup:restore` | záloha databáze (a s úložištěm mimo server i souborů) podle `ELDOCK_BACKUP_*`; obnova jen do prázdné složky (`-- --list`, `-- --from s3 --to <složka> --files`) |
| `npm run sync:setup` | triggery žurnálu změn pro aplikace (po migracích, idempotentní; `-- --new-epoch` po obnově databáze ze zálohy) |
| `npm --prefix apps/client install` / `run build` / `run start` / `run dist` | aplikace pro Windows: závislosti (Electron, Capacitor), sestavení, spuštění, instalátor NSIS do `apps/client/release/` (zatím nepodepsaný) |
| `npm --prefix apps/client run android:apk` / `run mobile:sync` / `run ios:open` | mobilní aplikace: zkušební APK do `apps/client/release/` (Android SDK, Java 17–24), rozhraní do projektů `android/` a `ios/`, projekt v Xcode (jen Mac) |
| `npm run plant-server -- --data <složka> --port 8787` | server závodu ve vývoji (v instalaci `resources\plant-server.cmd`, jako služba `resources\plant-server-task.ps1` spuštěný správcem) |
| `npm run storage:registry` / `npm run storage:cleanup` | doplnění registru souborů pro starší soubory (vlastník podle odkazů) / úklid osiřelých souborů (`--dry-run`) |
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
docs/PLAN.md              rotující plán (hotové fáze, otevřená fáze, deník)
docs/archiv/              úplný plán fází 0–35 a původní specifikace MVP
```

- **Stack:** Next.js 16.4 (App Router, Turbopack, React 19), TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, `motion`, sonner, zod, react-zoom-pan-pinch, qrcode.react; Prisma 7.10 + SQLite (`@prisma/adapter-better-sqlite3`); Vitest, Playwright.
- **Stavový automat** (`src/lib/workflow/state-machine.ts`, viz `docs/archiv/PLAN-faze-00-35.md` sekce B): `SUBMITTED → IN_PROGRESS → WAITING_APPROVAL → APPROVED`, vrácení `WAITING_APPROVAL → IN_PROGRESS`, storno. Stav zařízení se vždy odvozuje z otevřeného požadavku; služby hlídají invarianty (max. 1 platná revize a 1 otevřený požadavek na zařízení).
- **Soubory:** upload přes `POST /api/uploads` (Route Handler, ne Server Action kvůli limitu 1 MB), do DB se ukládá URL `/api/files/...`. SVG se zobrazují přes `<img>` (nespustí skripty) a `/api/files` posílá `Content-Security-Policy: sandbox`.
- **Grafika** (areál, izometrie, půdorysy, schémata, „fotky“ v seedu, 3D skříň) je generovaná kódem – žádné externí obrázky ani CDN.

## Známá omezení (MVP)

- Přihlášení je společné přístupové heslo závodu (ne osobní hesla) a účet si lze v hlavičce přepnout (demo). `/api/uploads` neověřuje obsah souboru (jen příponu a velikost).
- Hlasová poznámka: rozpoznávání řeči z prohlížeče (Chrome/Edge), jinak simulace; audio se neukládá.
- Redlining jen nad SVG/obrázkem schématu (ne nad PDF), schémata v seedu mají 1 list.
- „Vygenerovat upravené schéma“ umí vykreslit jen prvky mock schématu (Q1, F1–F6, K1–K4, T1, A1, X1, X2).
- PWA bez service workeru – žádný offline režim.
- Další náměty (notifikace, import z EPLAN, elektronický podpis, multi-tenant…) viz `docs/PLAN.md` sekce D a `docs/archiv/PLAN-faze-00-35.md` sekce F.

## Přechod na PostgreSQL

1. V `prisma/schema.prisma` změňte `provider = "sqlite"` na `"postgresql"`. Strukturovaná data (zákresy, polygony) jsou uložená jako `String` se serializovaným JSON, schéma tedy funguje beze změn (volitelně lze přejít na `Json`).
2. `npm i @prisma/adapter-pg@7 pg` a v `src/lib/prisma.ts` (a v `prisma/seed.ts`, `scripts/smoke-workflow.ts`) nahraďte `PrismaBetterSqlite3` za `PrismaPg({ connectionString: process.env.DATABASE_URL })`.
3. `DATABASE_URL="postgresql://uzivatel:heslo@server:5432/eldock"` v `.env`.
4. Smažte staré SQLite migrace (`prisma/migrations`) a vytvořte nové: `npx prisma migrate dev --name init`, pak `npx prisma generate` a `npm run db:seed`.
5. Nahrané soubory ze `storage/uploads` přesuňte na sdílené úložiště (nebo S3 – stačí upravit `src/server/storage.ts` a `/api/files`).

## Nasazení na Hetzner Cloud a nastavení DNS u Czechia.com (eldock.cz)

Produkční balíček tvoří `Dockerfile` (Node 22 LTS, Next.js `output: "standalone"`, neprivilegovaný uživatel `eldock`), `docker-entrypoint.sh`, `docker-compose.yml` a `Caddyfile`. Stejná sestava běží na Hetzner VPS i na serveru v továrně bez internetu.

| Služba | Co dělá |
|---|---|
| `eldock-app` | Next.js server na interním portu 3000. Při startu aplikuje migrace (`prisma migrate deploy`) a nad prázdnou databází nahraje demo data (`ELDOCK_SEED_DEMO=1`). |
| `caddy` | Reverzní proxy na portech 80/443: automatický certifikát **Let's Encrypt** pro `eldock.cz`, `www.eldock.cz`, `app.eldock.cz`, HSTS, `X-Frame-Options: SAMEORIGIN` (vlastní náhledy PDF v `<iframe>` fungují, cizí weby aplikaci nevloží), `X-Content-Type-Options: nosniff`. |

Trvalá data jsou na hostiteli v `./data`: `./data/db` (SQLite `eldock.db`), `./data/storage` (fotky, revize, schémata), `./data/backups` (denní snímky databáze), `./data/caddy` (certifikáty). Aplikace každý den v 02:30 uloží snímek databáze do `./data/backups`; s `ELDOCK_BACKUP_KEY` a `ELDOCK_BACKUP_S3_*` ho i se soubory úložiště šifrovaně pošle mimo server (viz `.env.production.example`, stav ve velínu → Zálohy a data). **Dokud záloha mimo server není nastavená, kopírujte celý adresář `./data` i jinam.**

### 1. Server u Hetzner Cloud

1. V [Hetzner Cloud Console](https://console.hetzner.cloud) vytvořte projekt a server: lokalita **Falkenstein / Norimberk** (EU), obraz **Ubuntu 24.04**, typ **CX22** (2 vCPU, 4 GB RAM) stačí pro jeden závod; přidejte svůj SSH klíč.
2. Firewall (Hetzner Firewall): povolte příchozí **22/tcp** (jen z vaší IP), **80/tcp**, **443/tcp** a **443/udp** (HTTP/3).
3. Poznamenejte si veřejnou **IPv4** (a IPv6) serveru.
4. Na serveru nainstalujte Docker:
   ```bash
   ssh root@<IPv4>
   curl -fsSL https://get.docker.com | sh
   ```

### 2. DNS u Czechia.com

V administraci [Czechia.com](https://www.czechia.com) → *Domény* → `eldock.cz` → *DNS záznamy* nastavte (TTL např. 3600):

| Název | Typ | Hodnota |
|---|---|---|
| `@` (eldock.cz) | A | `<IPv4 serveru>` |
| `www` | A | `<IPv4 serveru>` |
| `app` | A | `<IPv4 serveru>` |
| `@`, `www`, `app` | AAAA | `<IPv6 serveru>` (volitelné) |
| `@` | CAA | `0 issue "letsencrypt.org"` (doporučeno) |

Ověření propagace: `nslookup app.eldock.cz` musí vrátit IP serveru – **až potom** spusťte Caddy (jinak Let's Encrypt certifikát nevydá). Domény `eldock.eu` a `eldock.sk` stačí nasměrovat stejně a přidat je do `ELDOCK_DOMAINS` (nebo v Caddyfile přesměrovat `redir https://eldock.cz{uri}`).

### 3. Spuštění

```bash
git clone <repozitář> /opt/eldock && cd /opt/eldock
cp .env.production.example .env.production
openssl rand -base64 32          # → ELDOCK_AUTH_SECRET v .env.production
nano .env.production             # heslo, tajemství, domény, e-mail pro Let's Encrypt
docker compose --env-file .env.production up -d --build
docker compose logs -f eldock-app   # „[eldock] Startuji aplikaci…“
```

Aplikace pak běží na **https://app.eldock.cz** (i `eldock.cz` a `www.eldock.cz`). Pro ostrý provoz bez demo dat nastavte před prvním startem `ELDOCK_SEED_DEMO="0"`.

**Aktualizace:** `git pull && docker compose --env-file .env.production up -d --build` – migrace se aplikují automaticky, data v `./data` zůstávají.
**Záloha:** automaticky každý den (velín → Zálohy a data, ručně `docker exec -u eldock eldock-app sh -c 'cd /app/ops && npm run backup'`); obnova vždy do prázdné složky (`npm run backup:restore -- --list`, `-- --from s3 --to /app/data/backups/obnova --files`), výměnu dat pak dělá správce při zastavené aplikaci. Celý server navíc Hetzner Backups / Snapshots.

### On-premise / air-gapped server v továrně

1. Na stroji s internetem sestavte a exportujte obrazy: `docker compose build && docker save eldock:latest caddy:2.10-alpine | gzip > eldock-images.tgz`.
2. Na serveru v továrně: `docker load < eldock-images.tgz`, zkopírujte repozitář (stačí `docker-compose.yml`, `Caddyfile`, `.env.production`) a spusťte `docker compose --env-file .env.production up -d` (bez `--build`).
3. Bez veřejné domény zvolte v `.env.production` jednu z variant:
   - **HTTP v uzavřené síti:** `ELDOCK_DOMAINS=":80"` a `ELDOCK_INSECURE_COOKIE="1"`;
   - **HTTPS s interní CA Caddy:** `ELDOCK_DOMAINS="eldock.zavod.local"` a v `Caddyfile` do bloku webu doplňte `tls internal` (kořenový certifikát z `./data/caddy/data/caddy/pki/authorities/local/root.crt` nainstalujte na tablety), případně vlastní certifikát firmy: `tls /cesta/cert.pem /cesta/key.pem`.
4. Aplikace nenačítá žádné externí zdroje (fonty jsou součástí buildu), takže za běhu internet nepotřebuje.

