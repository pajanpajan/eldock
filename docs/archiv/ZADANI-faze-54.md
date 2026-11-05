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
