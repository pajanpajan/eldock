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
