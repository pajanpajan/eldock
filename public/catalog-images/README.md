# Oficiální náhledy výrobců (fáze 78)

Fotky a produktové vizualizace designových řad a prvků chytré domácnosti pro galerii **Designové řady a barvy**
a karty chytré domácnosti ve 2D půdorysu. Bez fotky aplikace kreslí vektorový náhled.

**Jen se souhlasem výrobce** – repozitář je veřejný, každá fotka je dílo výrobce. Ke každé složce řady patří
`zdroj.json` se zdrojem a podmínkami užití (aplikace je vypíše pod fotkou); bez něj se fotka do aplikace nedostane.

## Struktura

```
public/catalog-images/
  abb/tango/zdroj.json                 { "source": "ABB – partnerská fotobanka", "license": "souhlas výrobce …" }
  abb/tango/rada-switch.webp           řada bez barvy: díl switch / socket / set
  abb/tango/abb-tango-n-switch.webp    konkrétní barva řady (id barvy z katalogu řad)
  loxone/smart/zdroj.json
  loxone/smart/lox-presence.webp       výrobek chytré domácnosti (id výrobku z katalogu)
```

Složky výrobce a řady jsou názvy bez diakritiky a mezer (`ABB` → `abb`, `Time Arbo` → `time-arbo`,
`Nová Unica` → `nova-unica`). Formáty WebP, PNG, JPG, AVIF nebo SVG, nejvýš 3 MB na soubor.

## Mezipaměť prohlížeče (fáze 100)

Soubory z `public/catalog-images/` se servírují s `Cache-Control: public, max-age=31536000, immutable` (`next.config.ts`) –
prohlížeč je rok nenačítá znovu. Opravenou fotku proto ulož pod **novým názvem souboru** (a přegeneruj manifest), jinak
ji uživatelé, kteří starou už viděli, dlouho neuvidí. Fotky nahrané ve velínu jdou přes `/api/catalog-images/file/…?v=`
a pravidlo se jich netýká.

## Aktualizace

1. Nahrajte soubory do složek (nebo je doplňte do `zdroje.json` jako `{ "url": "https://…", "target": "abb/tango/rada-switch.webp" }`
   a spusťte `npm run catalog:images -- --download` – stáhne jen chybějící obrázky z adres https).
2. Spusťte `npm run catalog:images` – přegeneruje manifest `src/lib/panel-builder/catalog-images.generated.ts`
   (test hlídá, že odpovídá souborům ve složce).

## Reálné fotky výrobců (fáze 92)

- **Harvester** `npm run catalog:photos` (`scripts/harvest-switch-photos.mjs`, Playwright – Edge / Chrome / Chromium):
  pro každou řadu ABB a barvu spočítá objednací čísla jako kusovník (kryt spínače č. 1 / kompletní přístroj Decento,
  zásuvka 1N), najde stránku výrobku na oficiálním katalogu ABB pro ČR a stáhne fotku jen tehdy, když soubor nese
  přesně stejné objednací číslo. Fotky jdou do `<výrobce>/<řada>/<barva>-<díl>.webp`, zdroj, stránka výrobku a datum
  do `manifest.json` (fotky z manifestu nepotřebují `zdroj.json` složky a mají přednost před rendery). Když web výrobce
  automatizovaný prohlížeč odmítne (CAPTCHA, 403 / 429, ukončené spojení), harvester skončí a nic neobchází.
  Volby: `--only=Tango,Zoni`, `--dry-run`, `--force`, `--channel=msedge|chrome|chromium`, `--limit=N`.
- **Nahrávač v galerii** (jen přihlášený velín `/superadmin`): v dialogu **Designové řady a barvy** přepínač
  `📷 Nahrát reálné fotky (Ctrl+V / Soubor)` – klik na slot (Spínač 1R, Zásuvka 1R, Vícerámeček nebo dlaždici barvy),
  Ctrl+V / přetažení / soubor → `POST /api/catalog-images/upload`. Fotka se znovu zakóduje do WebP (max. 1600 px)
  a uloží do trvalého úložiště `storage/catalog-images/` (svazek Dockeru – `public/` je v obrazu jen ze sestavení),
  manifest `storage/catalog-images/manifest.json`; galerie ji hned ukáže všem uživatelům
  (`GET /api/catalog-images/manifest`, soubory `GET /api/catalog-images/file/…`).

## Datové balíčky výrobců (fáze 97)

1. `npm run catalog:discover` (`scripts/discover-and-download-etim.mjs`) projde stránky „Ke stažení / Ceníky / Databáze
   ETIM“ výrobců (ABB, KOPOS, OEZ, Schneider Electric, Legrand, Hager, Eaton, Schrack, Saltek), stáhne datové soubory
   (BMEcat / ETIM, XLSX / CSV ceníky) do `data/etim/downloads/<výrobce>/` (mimo git) a u výrobců bez veřejného balíčku
   přečte stránky výrobků (KOPOS e-shop, katalog OEZ, se.com). Respektuje robots.txt, zaheslované soubory nepoužije
   a weby, které automatizovaný přístup odmítnou, označí „blokuje“ – nic neobchází. Přehled `discovery.json`.
2. `npm run catalog:parse` (`scripts/parse-etim-packages.mjs`) z nich sestaví výrobky, stáhne fotky (kontrola: HTTP 200,
   `image/*`, víc než 1,5 kB, hlavička JPEG / PNG / WebP / GIF), převede je na WebP 400 × 400 a zapíše:
   - `<výrobce>/<řada>/<barva>-<díl>.webp` – díly řad Schneider / Legrand / Hager pro galerii (položky `photos`),
   - `kopos/boxes/<kód>.webp` – instalační krabice, `<výrobce>/enclosures/<objednací číslo>.webp` – rozvodnice
     (položky `products` s druhem `box` / `enclosure`; v aplikaci `catalog-images.generated.ts`),
   - `<výrobce>/devices/<objednací číslo>.webp` – DIN přístroje (`products` s druhem `device`; manifest jen pro server
     `src/lib/panel-builder/device-photos.generated.ts`, do klientského balíčku nepatří).
   Data výrobců (hloubky přístrojů řad Hager, rámečky podle ETIM, krabice KOPOS, EAN / Pv / hloubka DIN přístrojů) jdou do
   `brand-etim.generated.ts` a `brand-etim-components.generated.ts`.
