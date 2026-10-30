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

## 5. Pracovní postup pro Claude Code

- Implementace probíhá podle `docs/PLAN.md`, **fázi po fázi** (`/faze` = další nedokončená fáze, `/faze 3` = konkrétní fáze). Jedna fáze = jeden commit, pak se zastav a shrň. `/overit` = kompletní kontrola.
- Sekce A–C v `docs/PLAN.md` (technická rozhodnutí, stavový automat, demo data) jsou závazné. Odchylky zapiš do Deníku v plánu.
- **Next.js 16:** před psaním kódu s Next API čti návody v `node_modules/next/dist/docs/` (viz `AGENTS.md`, vytvoří ho fáze 0). `params`/`searchParams`/`cookies()`/`headers()` jsou async, Cache Components jsou vypnuté.
- **Prisma 7:** balíčky vždy `@7` (ne `latest`, to je 8.0 RC). Klient se importuje z `@/generated/prisma/client` a v aplikaci jen přes `src/lib/prisma.ts`. Po změně schématu: `npx prisma migrate dev --name <popis>` a pak `npx prisma generate`; seed se spouští ručně (`npm run db:seed` / `npm run db:reset`).
- **Architektura:** čtení dat v `src/server/queries`, business logika ve `src/server/services` (dostává `prisma` a `actor`), Server Actions v `src/server/actions` jsou tenké, pravidla přechodů v `src/lib/workflow`. Soubory jen ve `storage/uploads` přes `/api/uploads` a `/api/files`.
- **UI:** výhradně česky, kód anglicky. Stavové barvy a popisky jen ze `src/lib/status.ts`. Žádné externí obrázky ani CDN – grafika je SVG/CSS generovaná kódem.
- **Ověření:** `npm run verify` (typecheck, lint, test, build) musí projít před každým commitem (ve fázích 0–1 stačí `npm run typecheck` a `npm run lint`).
- **Prostředí:** Windows – používej npm skripty a Node/TS skripty místo bash-only příkazů. `git push` dělej jen při nasazení (viz níže), jinak nikdy. Na mazání mimo projekt a nevratné operace se nejdřív zeptej.

## 6. Nasazení na produkci (Hetzner, https://eldock.cz)

Když uživatel řekne **„nasaď to na produkci“** nebo **„deploy“**:

1. Ověř změny (`npm run verify`) a commitni je (`git add -A`, commit s výstižnou zprávou).
2. `git push` na GitHub (`origin main`).
3. Spusť nasazení přes SSH:
   `ssh root@91.99.148.62 "cd /root/eldock && git pull && docker-compose up -d --build"`
4. Ověř výsledek (výstup buildu, `docker-compose ps`, odpověď https://eldock.cz) a shrň ho.

**Pozor:** na serveru je v `/root/eldock` ručně vytvořený soubor `.env` s produkčními hesly – při nasazení na něj nikdy nesahej, nečti ho do výstupu, nepřepisuj ho a nedávej ho do Gitu. Na serveru nespouštěj nic jiného než výše uvedený příkaz a čtecí kontroly; cokoli dalšího (mazání, reset, změny konfigurace) jen po výslovném souhlasu.

@AGENTS.md
