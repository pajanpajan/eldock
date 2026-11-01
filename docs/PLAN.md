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
| 36 | Konsolidace a technický dluh: stabilní E2E (zahřátí dev serveru, data plánovače podle pražského dne), optimistický konfigurátor, zpětná editace pater ve Studiu (`studioLayoutJson`), katalog Bonega, paralelní Vision Analyzer, originál fotky u zákresu, Remotion bez `<Img>`, materiál skříně v oteplení, `ELDOCK_LOCK_ACCOUNT_SWITCHER` | 🟦 |

Fáze 35 je nasazená 2026-11-01 (commit `64079a6`).

## B. Otevřená fáze

**Fáze 37 – zatím nezadaná** ⬜

Šablona pro nové zadání (vložte sem, nepřepisujte celý soubor):

```
### Fáze 37 – <název>
**Cíl:** <jedna věta>
- [ ] <úkol>
**Hotovo když:** <ověřitelná kritéria> · `npm run verify` OK
**Commit:** `feat(faze37): <popis>`
```

## C. Deník (jen poslední záznamy, starší jsou v archivu)

| Fáze | Datum | Poznámky |
|---|---|---|
| 35 | 2026-11-01 | Model Studia v metrech: zóny `{x, y, w, h}`, zařízení `pos` + `roomKey`. Nová patra mají jednotné měřítko (`planFrame`), stávající `EXISTING_FLOOR_FRAME`. Měřítko = skutečný zoom 96 dpi + „Celé“. Rozměr areálu se ukládá i u stávajícího závodu (přepočet polygonů budov). Bez změny schématu DB. |
| 36 | 2026-11-01 | **E2E VTZ:** příčinou nebyla data, ale studený dev server (stránka se při kompilaci přenačítala) → `e2e/global-setup.ts` nejdřív v prohlížeči zahřeje hlavní trasy. Data plánovače („tento / příští měsíc“) se počítají od pražského dne (`src/lib/month-window.ts`, test pro každý den 2 let) – dřív UTC den mohl kolem půlnoci posledního dne v měsíci spadnout do minulosti. **Konfigurátor:** bez `router.refresh` po kliku (akce sama revaliduje), klíč bez katalogového kusu, debounce 250 ms, optimistický náhled na DIN liště. **Studio:** migrace `floor_studio_layout`; stávající patro jde v kroku 2 upravit (JSON, u starších pater dopočet ze SVG v `src/lib/studio-layout.ts`), piny se přepočítají přes metry. **Bonega:** 97 položek, popisné typové kódy `BONEGA …` (objednací kódy ověřit u výrobce); testy chybějící značky používají Legrand. **Vision Analyzer:** fáze B přes `mapWithConcurrency` (3). **Červenka:** migrace `attachment_original_url` + „Zobrazit originál bez zákresu“. **Remotion:** `InlineSvg` místo `<Img>`. **Oteplení:** materiál násobí Ae v poměru ocel 1,0 : nerez 0,95 : plast 0,88, normováno na referenční plastovou skříň (kalibrace K_AE, PB-001 dál 42,4 °C; kovové skříně vycházejí o něco chladněji). **Zámek účtu:** `ELDOCK_LOCK_ACCOUNT_SWITCHER=1` – účet z podepsané přihlašovací cookie, přepnutí odmítne server, v hlavičce odznak 🔒. |
| – | 2026-11-01 | Plán převeden na rotující. Původní plán archivován, trvalá paměť projektu konsolidována do `CLAUDE.md`. |

## D. Známé nedostatky a backlog

- E2E na čistém dev serveru: první minuta kompilace stránky přenačítá – řeší zahřátí v `e2e/global-setup.ts` (`E2E_SKIP_WARMUP=1` ho vypne).
- Vrata v novém stylu se v patrech ze seedu projeví až po novém seedu (na produkci se seed nepouští, uložená SVG zůstávají).
- Backlog z MVP: skutečný serverový přepis hlasu, redlining nad PDF (pdf.js), offline synchronizace, PostgreSQL, elektronický podpis schválení.
