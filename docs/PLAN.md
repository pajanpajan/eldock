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

Fáze 36–38 jsou nasazené 2026-11-02 (commit `e9bfd76`).

## B. Otevřená fáze

**Fáze 39 – zatím nezadaná** ⬜

Šablona pro nové zadání (vložte sem, nepřepisujte celý soubor):

```
### Fáze 39 – <název>
**Cíl:** <jedna věta>
- [ ] <úkol>
**Hotovo když:** <ověřitelná kritéria> · `npm run verify` OK
**Commit:** `feat(faze39): <popis>`
```

## C. Deník (jen poslední záznamy, starší jsou v archivu)

| Fáze | Datum | Poznámky |
|---|---|---|
| 35 | 2026-11-01 | Model Studia v metrech: zóny `{x, y, w, h}`, zařízení `pos` + `roomKey`. Nová patra mají jednotné měřítko (`planFrame`), stávající `EXISTING_FLOOR_FRAME`. Měřítko = skutečný zoom 96 dpi + „Celé“. Rozměr areálu se ukládá i u stávajícího závodu (přepočet polygonů budov). Bez změny schématu DB. |
| 36 | 2026-11-01 | **E2E VTZ:** příčinou nebyla data, ale studený dev server (stránka se při kompilaci přenačítala) → `e2e/global-setup.ts` nejdřív v prohlížeči zahřeje hlavní trasy. Data plánovače („tento / příští měsíc“) se počítají od pražského dne (`src/lib/month-window.ts`, test pro každý den 2 let) – dřív UTC den mohl kolem půlnoci posledního dne v měsíci spadnout do minulosti. **Konfigurátor:** bez `router.refresh` po kliku (akce sama revaliduje), klíč bez katalogového kusu, debounce 250 ms, optimistický náhled na DIN liště. **Studio:** migrace `floor_studio_layout`; stávající patro jde v kroku 2 upravit (JSON, u starších pater dopočet ze SVG v `src/lib/studio-layout.ts`), piny se přepočítají přes metry. **Bonega:** 97 položek, popisné typové kódy `BONEGA …` (objednací kódy ověřit u výrobce); testy chybějící značky používají Legrand. **Vision Analyzer:** fáze B přes `mapWithConcurrency` (3). **Červenka:** migrace `attachment_original_url` + „Zobrazit originál bez zákresu“. **Remotion:** `InlineSvg` místo `<Img>`. **Oteplení:** materiál násobí Ae v poměru ocel 1,0 : nerez 0,95 : plast 0,88, normováno na referenční plastovou skříň (kalibrace K_AE, PB-001 dál 42,4 °C; kovové skříně vycházejí o něco chladněji). **Zámek účtu:** `ELDOCK_LOCK_ACCOUNT_SWITCHER=1` – účet z podepsané přihlašovací cookie, přepnutí odmítne server, v hlavičce odznak 🔒. |
| 38 | 2026-11-02 | **Rastr v metrech:** `GridSpec.widthM/depthM`, osy po rozteči a poslední na hraně (`axisMeters`), počet os bez limitu, popisy A…Z, AA…ZZ; renderer kreslí skutečné polohy os, u hal nad 4 000 sloupů jen osy, popisky os se ředí. Rozteč 6 / 12 m / vlastní v detailu „Pokročilé“. Úchyt budovy v areálu mění rozměr po 1 m až do velikosti areálu. **Více budov:** koncept = pole budov (`StudioConceptDraft`), `saveStudioConcept` uloží vše v jedné transakci (první budova případně založí závod); napájení přes budovy konceptu není podporované (jen ze závodu nebo vlastní budovy). Šablona budovy mění aktivní budovu, novou budovu přidává „+ Přidat další budovu“ (odchylka od „klik na šablonu = nová budova“ – nechtěné zakládání budov). **Patra:** přejmenování stávajících (`floorRenames`). **Krok 2:** šablony rozdělení patra odstraněny; historie konceptu (30 kroků, slučování změn do 500 ms, tažení = 1 krok, Ctrl+Z / Ctrl+Y). **Krok 3:** accordion místnost → kategorie (počty v místnosti, ostatní značky 20 %) → „Vytvořit nové“ (produktové banery, vlastní prefix tagu, vložení tlačítkem do místnosti nebo klikem do rastru) / „Upravit stávající“ (koncept: úprava, přesun, smazání; uložená zařízení: tag, název, napájení, vývod, místnost přes `equipmentEdits` – mazání a přesun uložených jen v kartě zařízení). **Oprava:** fáze B Vision Analyzeru – výřezy lišt postupně, paralelně jen dotazy Gemini (test padal na souběhu). |
| 37 | 2026-11-01 | Zadání fází 37 a 38 vložené do sekce B (zase přepsalo sekce C a D) → plné znění v `docs/archiv/ZADANI-faze-37-38.md`, plán obnoven z gitu. **Selecty:** `color-scheme: dark` + tmavé `option`/`optgroup` v `globals.css`. **Katalog:** ABB SHD203/25·40·63, SHD204/40, SH201/SH203 B+C 6–32 A (vč. 13 A), FH202 AC/A (SD203/25 a FH204 už byly); objednací kód = typ. **Gemini:** pravidla červené páčky, B vs. C a těsných rámečků v promptu, výřez JPEG 95 % 4:4:4 bez zmenšení, pojistka `switchDisconnectorFromText` (SHD203/25 → odpínač 25 A), doplnění „vynechaných“ modulů jen uvnitř výřezu lišty. **Krok 1:** posun / levá / pravá hrana vybraného rámečku myší (`setItemBox`), funkce obvodu nahoře + 13 rychlých štítků, popis na dlaždici lišty, ruční přepis značení (unikátní v projektu). **IEC:** prefixy podle kategorie, referenční PB-001 přeznačen na -Q1, -FV1, -FI1, -F1…-F10 (testy přemapovány); měření (elektroměr) je v katalogu kategorie OTHER → -X (samostatná kategorie pro -U neexistuje). **Krok 2:** nový `proposeTree` (pravidlo DIN lišty; odchylka: jistič na liště bez chrániče jde pod „samostatný“ chránič z vyšší lišty, jinak pod -Q1 – jinak by referenční PB-001 ztratil ochranu chráničem), 3P/4P vypínač a chránič „L1,L2,L3,N“, 2P chránič „Lx,N“, střídání fází ve skupině; hlídač bez chyby přetížení (zatížení skupiny jen jako informace `groupLoad`), chyby jen nezapojený prvek / cyklus / 3P pod 1P; UI = skupinové karty s fázovými tlačítky a přepínačem „Napájeno z“; krok přejmenován na „2. Zapojení a hierarchie“. **Oprava z fáze 36:** regex v `InlineSvg` (Remotion) obsahoval místo `\b` řídicí znak – SVG ve videu se nezvětšovalo. |
| – | 2026-11-01 | Plán převeden na rotující. Původní plán archivován, trvalá paměť projektu konsolidována do `CLAUDE.md`. |

## D. Známé nedostatky a backlog

- E2E na čistém dev serveru: první minuta kompilace stránky přenačítá – řeší zahřátí v `e2e/global-setup.ts` (`E2E_SKIP_WARMUP=1` ho vypne).
- Vrata v novém stylu se v patrech ze seedu projeví až po novém seedu (na produkci se seed nepouští, uložená SVG zůstávají).
- Backlog z MVP: skutečný serverový přepis hlasu, redlining nad PDF (pdf.js), offline synchronizace, PostgreSQL, elektronický podpis schválení.
