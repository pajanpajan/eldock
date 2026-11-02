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
| 40 | Studio: výchozí mapa závodu (bez automatického konceptu), proklik na budovu se 3 režimy (Zařízení a napájení / Místnosti, zóny a vrata / Budova a podlaží), úprava, přesun, změna místnosti a mazání uložených zařízení s potvrzením, poloha a rozměr stávající budovy; vzorové závody v metrech s bohatým vybavením (+92 zařízení, `db:demo-plant`) | 🟦 |

Fáze 36–38 jsou nasazené 2026-11-02 (commit `e9bfd76`), oprava kmitání plátna „Celé“ (`bd37aeb`) také; fáze 39 nasazena 2026-11-02 (commit `3c99981`).

## B. Otevřená fáze

**Fáze 41 – zatím nezadaná** ⬜

Šablona pro nové zadání (vložte sem, nepřepisujte celý soubor):

```
### Fáze 41 – <název>
**Cíl:** <jedna věta>
- [ ] <úkol>
**Hotovo když:** <ověřitelná kritéria> · `npm run verify` OK
**Commit:** `feat(faze41): <popis>`
```

## C. Deník (jen poslední záznamy, starší jsou v archivu)

| Fáze | Datum | Poznámky |
|---|---|---|
| 40 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-40.md`, plán obnoven z gitu. **Mapa závodu:** `/studio` u závodu s budovami otevře jen mapu (`CampusPlacementMap` s `onSelectBuilding`, budovy jako tlačítka) a výzvu; žádný koncept nové budovy. „✏️ Upravit areál / + Přidat budovu“ = dosavadní 3krokový průvodce (nově i posun / velikost stávající budovy klikem na ni v mapě), „🆕 Vytvořit nový závod od nuly“ = průvodce novým závodem; závod bez budov a `?new=plant` jdou rovnou do průvodce. **Pohled budovy:** záložky pater nahoře (výchozí 1. NP), levý panel se 3 režimy: Zařízení a napájení (výchozí, `PlacementStep`), Místnosti, zóny a vrata (`ZoneStep`, uložené patro se otevře automaticky), Budova a podlaží (přejmenování, nové NP / PP, rozměr X × Y = obrys v areálu + rastr všech pater, místnosti za obvodem se oříznou; poloha v areálu tažením). „Uložit změny patra“ zůstane ve Studiu nad stejnou budovou; neuložené změny hlídá počítadlo a potvrzení při návratu na mapu; nezměněné rozvržení stávajícího patra se neposílá. **Zařízení:** uložená jde přesunout (pin v metrech, `equipmentEdits[].pos`), přeřadit do jiné místnosti (přesun na kotvu místnosti), smazat s potvrzením (`equipmentDeletes`; smaže se až při uložení po druhém potvrzení, kaskádově i s historií; odmítne se zařízení s otevřeným požadavkem na změnu nebo s odběry, které se nepřepojí / nesmažou) a „−“ u skupiny označí ke smazání poslední uložený kus (toast „Vrátit“). Stávající budova má volitelné `map` (nový polygon a štítek). Ikony štítků podle klíčových slov (`emojiHint`: konvice 🫖, tiskárna 🖨️, mikrovlnka 🍲…). **Seed:** `prisma/seed-demo-plant.ts` – rozvržení 9 pater v metrech (rozměr = obrys budovy v areálu: Hala A 152 × 76, Hala B 136 × 68, Energetika 56 × 36, Sklad 88 × 64, Administrativa 52 × 56, Lakovna 160 × 100 m), místnosti bez překryvů pokrývají celou plochu (test), všech 7 typů zón, vrata na obvodu, piny všech demo zařízení v metrech, +92 zařízení (CNC-01–03, ROB-01/02/08, VZT-02, NAB-VZV1, BAL-01, spotřebiče a nářadí podle zadání s napájením a platnou revizí), obecné názvy kusů (`DEMO_RENAMES`, „Kávovar De'Longhi“ → „Kávovar“). Plný seed patra rovnou vytvoří s JSON; `npm run db:demo-plant` (entrypoint, po `db:demo-docs`) proběhne jednou (`TenantSetting` `demo.plant-layout` = 40), patro s vlastním rozvržením ze Studia (JSON bez příznaku `demo`) nechá být, nic nemaže; ověřeno na kopii dev.db (9 pater, 92 nových, 44 přemístěných, 14 přejmenovaných; druhý běh nic). **Oprava:** název souboru revizní zprávy v seedu (regex `[^w-]` bez zpětného lomítka → všechny zprávy se přepisovaly do jednoho souboru). |
| 39 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-39.md`, plán obnoven z gitu. **Rastr:** sloupy = středové křížky (±4 px, `PILLAR_COLOR`) v jedné cestě `data-pillars` (limit pro vykreslení zvednut na 20 000 sloupů). **Nabídka:** `src/lib/studio-menu.ts` (přejmenování kategorie, název / ikona / prefix dlaždice, smazání, vlastní dlaždice, obnovení výchozí); bez migrace – existující tabulka `TenantSetting`, klíč `studio.menu` (JSON s `updatedAt`, starší verze nepřepíše novější), v prohlížeči `localStorage` `eldock.studio.menu` (vyhrává novější). Rozepsané změny jdou do localStorage hned, do tenantu po „Hotovo“; nová dlaždice hned. Prefix dlaždice („KAV“) → tagy KAV01, KAV02… **Součty:** skupina = kategorie + název přístroje bez místnosti a tagu (`deviceBaseName`), ikona podle dlaždice se stejným názvem. Uložený půdorys (jen patra s `studioLayoutJson`) se při uložení konceptu překreslí se skupinou `data-room-inventory` (`refreshFloorInventory`) pro každé dotčené patro; Studio ji z uloženého SVG odstraní a kreslí živé štítky. Zařízení přidaná / smazaná mimo Studio štítky v SVG neaktualizují (až další uložení patra ve Studiu). **− / +:** jen u spotřebičů a nářadí; + = další tag v řadě podle posledního kusu (`nextInSeries`), stejné napájení a okruh; − ubere poslední nový kus (uložené se mažou v kartě zařízení). E2E nabídku mění v e2e.db – při opakování testu bez nové DB by první kroky selhaly. |
| 38 | 2026-11-02 | **Rastr v metrech:** `GridSpec.widthM/depthM`, osy po rozteči a poslední na hraně (`axisMeters`), počet os bez limitu, popisy A…Z, AA…ZZ; renderer kreslí skutečné polohy os, u hal nad 4 000 sloupů jen osy, popisky os se ředí. Rozteč 6 / 12 m / vlastní v detailu „Pokročilé“. Úchyt budovy v areálu mění rozměr po 1 m až do velikosti areálu. **Více budov:** koncept = pole budov (`StudioConceptDraft`), `saveStudioConcept` uloží vše v jedné transakci (první budova případně založí závod); napájení přes budovy konceptu není podporované (jen ze závodu nebo vlastní budovy). Šablona budovy mění aktivní budovu, novou budovu přidává „+ Přidat další budovu“ (odchylka od „klik na šablonu = nová budova“ – nechtěné zakládání budov). **Patra:** přejmenování stávajících (`floorRenames`). **Krok 2:** šablony rozdělení patra odstraněny; historie konceptu (30 kroků, slučování změn do 500 ms, tažení = 1 krok, Ctrl+Z / Ctrl+Y). **Krok 3:** accordion místnost → kategorie (počty v místnosti, ostatní značky 20 %) → „Vytvořit nové“ (produktové banery, vlastní prefix tagu, vložení tlačítkem do místnosti nebo klikem do rastru) / „Upravit stávající“ (koncept: úprava, přesun, smazání; uložená zařízení: tag, název, napájení, vývod, místnost přes `equipmentEdits` – mazání a přesun uložených jen v kartě zařízení). **Oprava:** fáze B Vision Analyzeru – výřezy lišt postupně, paralelně jen dotazy Gemini (test padal na souběhu). |
| 37 | 2026-11-01 | Zadání fází 37 a 38 vložené do sekce B (zase přepsalo sekce C a D) → plné znění v `docs/archiv/ZADANI-faze-37-38.md`, plán obnoven z gitu. **Selecty:** `color-scheme: dark` + tmavé `option`/`optgroup` v `globals.css`. **Katalog:** ABB SHD203/25·40·63, SHD204/40, SH201/SH203 B+C 6–32 A (vč. 13 A), FH202 AC/A (SD203/25 a FH204 už byly); objednací kód = typ. **Gemini:** pravidla červené páčky, B vs. C a těsných rámečků v promptu, výřez JPEG 95 % 4:4:4 bez zmenšení, pojistka `switchDisconnectorFromText` (SHD203/25 → odpínač 25 A), doplnění „vynechaných“ modulů jen uvnitř výřezu lišty. **Krok 1:** posun / levá / pravá hrana vybraného rámečku myší (`setItemBox`), funkce obvodu nahoře + 13 rychlých štítků, popis na dlaždici lišty, ruční přepis značení (unikátní v projektu). **IEC:** prefixy podle kategorie, referenční PB-001 přeznačen na -Q1, -FV1, -FI1, -F1…-F10 (testy přemapovány); měření (elektroměr) je v katalogu kategorie OTHER → -X (samostatná kategorie pro -U neexistuje). **Krok 2:** nový `proposeTree` (pravidlo DIN lišty; odchylka: jistič na liště bez chrániče jde pod „samostatný“ chránič z vyšší lišty, jinak pod -Q1 – jinak by referenční PB-001 ztratil ochranu chráničem), 3P/4P vypínač a chránič „L1,L2,L3,N“, 2P chránič „Lx,N“, střídání fází ve skupině; hlídač bez chyby přetížení (zatížení skupiny jen jako informace `groupLoad`), chyby jen nezapojený prvek / cyklus / 3P pod 1P; UI = skupinové karty s fázovými tlačítky a přepínačem „Napájeno z“; krok přejmenován na „2. Zapojení a hierarchie“. **Oprava z fáze 36:** regex v `InlineSvg` (Remotion) obsahoval místo `\b` řídicí znak – SVG ve videu se nezvětšovalo. |

## D. Známé nedostatky a backlog

- E2E na čistém dev serveru: první minuta kompilace stránky přenačítá – řeší zahřátí v `e2e/global-setup.ts` (`E2E_SKIP_WARMUP=1` ho vypne).
- Vzorové závody na produkci doplní `db:demo-plant` jen jednou a jen na patrech bez vlastních úprav ze Studia; zařízení přidaná nebo smazaná mimo Studio štítky v uloženém půdorysu nepřepočítají (až další uložení patra ve Studiu).
- Backlog z MVP: skutečný serverový přepis hlasu, redlining nad PDF (pdf.js), offline synchronizace, PostgreSQL, elektronický podpis schválení.
