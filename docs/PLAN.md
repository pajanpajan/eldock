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
| 42 | AI Panel Builder: čistá referenční fotka (zoom / posun, bez rámečků), 2D vektorový rozváděč se standardizovanými mechanickými symboly (CAD Dark / Výkres osazení), našeptávač databáze prvků v konfigurátoru, párování chráničů podle AC/A a mA; krok 2 přímo nad vektorovým rozváděčem – hlavní přívod shora / zespoda, libovolný hlavní vstupní prvek, drag & drop, „Připojit jističe vpravo“, živé modré spojnice a hřebenové sběrnice | 🟦 |

Fáze 36–38 jsou nasazené 2026-11-02 (commit `e9bfd76`), oprava kmitání plátna „Celé“ (`bd37aeb`) také; fáze 39 nasazena 2026-11-02 (commit `3c99981`). Fáze 40 a 41 nasazeny 2026-11-03 (commit `2ad82e4`).

## B. Otevřená fáze

**Fáze 43 – zatím nezadaná** ⬜

Šablona pro nové zadání (vložte sem, nepřepisujte celý soubor):

```
### Fáze 43 – <název>
**Cíl:** <jedna věta>
- [ ] <úkol>
**Hotovo když:** <ověřitelná kritéria> · `npm run verify` OK
**Commit:** `feat(faze43): <popis>`
```

## C. Deník (jen poslední záznamy, starší jsou v archivu)

| Fáze | Datum | Poznámky |
|---|---|---|
| 42 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-42.md`, plán obnoven z gitu; fáze 40 a 41 označeny jako nasazené. **Krok 1:** fotka bez rámečků (`PhotoViewer`: kolečko / +/− / dvojklik = zoom, tažení = posun), ruční úprava rámečků (`setItemBoxAction`) i dlaždice `DinRails` odstraněny; hlavní plocha = `VectorPanel` s `VectorModuleSymbol` (šroubky po modulech, páčky s hrazdičkou, červená páčka odpínače, [ T ] + okénko chrániče, modré T jističochrániče, kazety SPD s terčíky a bleskem, stykač / relé / zdroj), texty `symbolTexts` (-F4 · ABB · B16 · S201-B16, chránič „A 40A 0,03A“, odpínač „(40A)“), štítek funkce dvojklikem, přepínač „Tmavý editor (CAD Dark)“ / „Výkres osazení“. Optimistický náhled konfigurace se hned propíše do symbolu (`deviceWithConfig`). **Databáze prvků:** našeptávač v konfigurátoru (`searchCatalog`, filtr výrobce → kategorie → póly, Pv a objednací číslo), výběr kusu zahodí starou konfiguraci (`configJson = null`); bez výsledku „Dohledat přes Gemini AI a uložit do databáze“ (nově `upsert`); detekce z fotky nesou u chráničů `rcdType` a `rcdSensitivityMa` a párují se podle nich. **Krok 2:** lišta „Hlavní přívod rozváděče“ (⬇ shora / ⬆ zespoda – migrace `panel_incomer`, `PanelBoardProject.incomerFrom`; 🎯 klik na přístroj nebo roletka 3P/4P), drag & drop přístroje na přístroj (`dropOnto`: na jistič skupiny = vedle něj pod chráničem, chránič na SPD = průchozí uzel bez varování, cyklus a přesun kořene odmítne), výběr Ctrl/Shift a „▣ lišta“, „🔗 Připojit jističe vpravo na této liště“ u chráničů (`connectRightOf`), panel vybraného prvku (fáze, název, roletka „Napájeno z“ jako přístupná alternativa), modré spojnice + hřebenové sběrnice (`wiringPaths`). AI návrh bez odpínače vezme první 3P/4P přístroj na 1. liště (`chooseRoot`), takže vždy zapojí 100 % prvků. Odchylka: skupinové karty kroku 2 nahradil panel vybraného prvku a seznam hlídače; „Výkres osazení“ je režim plátna, PDF výkres v kroku 4 zůstal beze změny. |
| 41 | 2026-11-03 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-41.md`, plán obnoven z gitu. **Model:** migrace `registered_company` – `RegisteredCompany` (enum `ProductScope`, údaje dle zadání, `passwordHash` scrypt v `src/server/password.ts`, `termsAcceptedAt/termsVersion`, `creditsRemaining`, `plantId`), `PanelBoardProject.companyId`; navíc (odchylka, nutné pro oddělení) `User.homePlantId` a `User.companyId`. **ARES:** `GET /api/ares?ico=` (veřejné, kontrola IČO mod 11, timeout 6 s, 404/503 → ruční vyplnění), převod v `src/lib/ares.ts`; formulář doplní údaje sám po 8 číslicích nebo tlačítkem „Doplnit z ARES“. **Panel Builder:** trasy přesunuty do skupiny `(pb)` s vlastní lištou `PanelBuilderHeader` (firma + IČO, kredity, „Firemní údaje do razítka“ = `/panel-builder/company`, Odhlásit); přihlášení firmy = cookie `eldock-pb` s podpisem `pbc:<id>` (`proxy.ts`: bez ní `/panel-builder/*` → `/panel-builder/auth`, token Panel Builderu neplatí ve správě závodů a naopak, API jen nahrání a čtení fotek); `/panel-builder/auth` = Přihlášení (+ „Vyzkoušet předvyplněný Tester účet“, `tester@eldock.cz` / `Tester2026!`) a Registrace firmy (Tester) s povinným souhlasem (doslovné znění, modal VOP). Dotazy i akce jen nad projekty firmy (`guardProject` / `guardItem`), 1 kredit = 1 nový projekt (5 po registraci, Tester 50), propuštění do provozu jen do vlastního závodu firmy (Tester = demo Jablonec). **PDF:** výrobce = aktuální údaje firmy (`companyManufacturer`): blok na titulní straně (název, IČO, DIČ, sídlo, odpovědná osoba + TIČR, telefon, e-mail), razítko všech 6 listů (výrobce + „Zpracoval“), prohlášení „Výrobce … na svou výhradní odpovědnost prohlašuje“ s podpisem odpovědné osoby, štítek CE s názvem a sídlem; tisk až po zaškrtnutí potvrzení kontroly. **Správa závodů:** odkaz Panel Builder z hlavní navigace odstraněn; `/register-plant` – firma (PLANT_MANAGEMENT) + závod (kód z názvu firmy) + Technický ředitel v jedné transakci a rovnou přihlášení; registrovaný uživatel se přihlašuje heslem firmy (sdílené demo heslo pro něj neplatí), nemá přepínač účtů, vidí jen svůj závod (`plantAccessWhere`, layouty `/plant/[plantId]` a `/equipment/[id]` → 404) a podúčty dědí firmu; demo nevidí závody registrovaných firem. **Úvodní stránka:** sekce „Produkty“ se dvěma kartami. **Seed:** `seedTesterCompany` (v `db:panel-builder`, tedy i na produkci) založí firmu Tester a přiřadí jí projekty bez firmy (PB-001 i projekty založené před fází 41). |
| 40 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-40.md`, plán obnoven z gitu. **Mapa závodu:** `/studio` u závodu s budovami otevře jen mapu (`CampusPlacementMap` s `onSelectBuilding`, budovy jako tlačítka) a výzvu; žádný koncept nové budovy. „✏️ Upravit areál / + Přidat budovu“ = dosavadní 3krokový průvodce (nově i posun / velikost stávající budovy klikem na ni v mapě), „🆕 Vytvořit nový závod od nuly“ = průvodce novým závodem; závod bez budov a `?new=plant` jdou rovnou do průvodce. **Pohled budovy:** záložky pater nahoře (výchozí 1. NP), levý panel se 3 režimy: Zařízení a napájení (výchozí, `PlacementStep`), Místnosti, zóny a vrata (`ZoneStep`, uložené patro se otevře automaticky), Budova a podlaží (přejmenování, nové NP / PP, rozměr X × Y = obrys v areálu + rastr všech pater, místnosti za obvodem se oříznou; poloha v areálu tažením). „Uložit změny patra“ zůstane ve Studiu nad stejnou budovou; neuložené změny hlídá počítadlo a potvrzení při návratu na mapu; nezměněné rozvržení stávajícího patra se neposílá. **Zařízení:** uložená jde přesunout (pin v metrech, `equipmentEdits[].pos`), přeřadit do jiné místnosti (přesun na kotvu místnosti), smazat s potvrzením (`equipmentDeletes`; smaže se až při uložení po druhém potvrzení, kaskádově i s historií; odmítne se zařízení s otevřeným požadavkem na změnu nebo s odběry, které se nepřepojí / nesmažou) a „−“ u skupiny označí ke smazání poslední uložený kus (toast „Vrátit“). Stávající budova má volitelné `map` (nový polygon a štítek). Ikony štítků podle klíčových slov (`emojiHint`: konvice 🫖, tiskárna 🖨️, mikrovlnka 🍲…). **Seed:** `prisma/seed-demo-plant.ts` – rozvržení 9 pater v metrech (rozměr = obrys budovy v areálu: Hala A 152 × 76, Hala B 136 × 68, Energetika 56 × 36, Sklad 88 × 64, Administrativa 52 × 56, Lakovna 160 × 100 m), místnosti bez překryvů pokrývají celou plochu (test), všech 7 typů zón, vrata na obvodu, piny všech demo zařízení v metrech, +92 zařízení (CNC-01–03, ROB-01/02/08, VZT-02, NAB-VZV1, BAL-01, spotřebiče a nářadí podle zadání s napájením a platnou revizí), obecné názvy kusů (`DEMO_RENAMES`, „Kávovar De'Longhi“ → „Kávovar“). Plný seed patra rovnou vytvoří s JSON; `npm run db:demo-plant` (entrypoint, po `db:demo-docs`) proběhne jednou (`TenantSetting` `demo.plant-layout` = 40), patro s vlastním rozvržením ze Studia (JSON bez příznaku `demo`) nechá být, nic nemaže; ověřeno na kopii dev.db (9 pater, 92 nových, 44 přemístěných, 14 přejmenovaných; druhý běh nic). **Oprava:** název souboru revizní zprávy v seedu (regex `[^w-]` bez zpětného lomítka → všechny zprávy se přepisovaly do jednoho souboru). |
| 39 | 2026-11-02 | Zadání opět vloženo místo plánu → plné znění v `docs/archiv/ZADANI-faze-39.md`, plán obnoven z gitu. **Rastr:** sloupy = středové křížky (±4 px, `PILLAR_COLOR`) v jedné cestě `data-pillars` (limit pro vykreslení zvednut na 20 000 sloupů). **Nabídka:** `src/lib/studio-menu.ts` (přejmenování kategorie, název / ikona / prefix dlaždice, smazání, vlastní dlaždice, obnovení výchozí); bez migrace – existující tabulka `TenantSetting`, klíč `studio.menu` (JSON s `updatedAt`, starší verze nepřepíše novější), v prohlížeči `localStorage` `eldock.studio.menu` (vyhrává novější). Rozepsané změny jdou do localStorage hned, do tenantu po „Hotovo“; nová dlaždice hned. Prefix dlaždice („KAV“) → tagy KAV01, KAV02… **Součty:** skupina = kategorie + název přístroje bez místnosti a tagu (`deviceBaseName`), ikona podle dlaždice se stejným názvem. Uložený půdorys (jen patra s `studioLayoutJson`) se při uložení konceptu překreslí se skupinou `data-room-inventory` (`refreshFloorInventory`) pro každé dotčené patro; Studio ji z uloženého SVG odstraní a kreslí živé štítky. Zařízení přidaná / smazaná mimo Studio štítky v SVG neaktualizují (až další uložení patra ve Studiu). **− / +:** jen u spotřebičů a nářadí; + = další tag v řadě podle posledního kusu (`nextInSeries`), stejné napájení a okruh; − ubere poslední nový kus (uložené se mažou v kartě zařízení). E2E nabídku mění v e2e.db – při opakování testu bez nové DB by první kroky selhaly. |

## D. Známé nedostatky a backlog

- E2E na čistém dev serveru: první minuta kompilace stránky přenačítá – řeší zahřátí v `e2e/global-setup.ts` (`E2E_SKIP_WARMUP=1` ho vypne).
- Vzorové závody na produkci doplní `db:demo-plant` jen jednou a jen na patrech bez vlastních úprav ze Studia; zařízení přidaná nebo smazaná mimo Studio štítky v uloženém půdorysu nepřepočítají (až další uložení patra ve Studiu).
- Backlog z MVP: skutečný serverový přepis hlasu, redlining nad PDF (pdf.js), offline synchronizace, PostgreSQL, elektronický podpis schválení.
