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
