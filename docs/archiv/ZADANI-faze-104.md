# Zadání fáze 104 – technická ochrana know-how, výpočtových algoritmů a katalogových dat ELDOCK (zdrojové mapy, server-only data, limit požadavků a blokace robotů, právní doložka)

Vloženo z chatu 2026-11-12 (během fáze 103 / po jejím nasazení). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Chceme technicky ochránit duševní vlastnictví, výpočtové algoritmy a katalogová data platformy ELDOCK (`https://eldock.cz`) proti okopírování, reverznímu inženýrství v prohlížeči a automatizovanému stahování (scrapingu).

Zapiš tuto bezpečnostní úlohu do `docs/PLAN.md` a naimplementuj tyto 4 vrstvy ochrany:

1. ZÁKAZ SOURCE MAPS A OCHRANA KLIENTSKÉHO BUNDLU (`next.config.ts` / `next.config.mjs`):
   - Explicitně nastav `productionBrowserSourceMaps: false` a zapni minifikaci/kompresi produkčního kódu, aby v prohlížeči (`DevTools -> Sources`) nebylo možné číst původní TypeScript soubory a komentáře.
   - Odstraň z veřejných HTTP hlaviček `X-Powered-By` (`poweredByHeader: false`).

2. PŘESUN CITLIVÉHO KNOW-HOW DO `server-only` MODULŮ A API ENDPOINTŮ:
   - Zabezpeč klíčové inženýrské a katalogové matice tak, aby se neposílaly jako kompletní surové JSON soubory do klientského JS bundlu nepřihlášeným uživatelům, ale vyhodnocovaly se přes chráněné serverové endpointy.

3. RATE-LIMITING A OCHRANA PROTI SCRAPINGU DATABÁZE A ETIM KATALOGU (`middleware.ts` & API):
   - Přidej na všechna katalogová, výpočtová a exportní API (`/api/catalog*`, `/api/panel-builder*`, `/api/qr-labels*`, `/api/ares*`) paměťový Rate Limiter podle IP adresy (např. max. 60 požadavků za minutu na běžné API, max. 15 požadavků za minutu na těžké exporty), který při pokusu o automatizované stahování databáze vrátí `429 Too Many Requests`.
   - Zablokuj v `middleware.ts` známé agresivní scrapovací roboty (`HTTrack`, `WebCopier`, `Teleport`, `SiteSnagger`, `Offline Explorer`, `python-requests` na aplikačních routách mimo veřejné SEO stránky).

4. PRÁVNÍ DOLOŽKA OCHRANY DATABÁZE A AUTORSKÝCH PRÁV V PATIČCE, VOP A PDF VÝSTUPECH:
   - Do patičky webu, do podmínek užití a do zápatí generovaných PDF výstupů doplň doložku:
     *"© 2026 ELDOCK.cz – Všechna práva vyhrazena. Databáze prvků, výpočtové algoritmy a struktura dokumentace jsou chráněny autorským právem a zvláštním právem pořizovatele databáze dle zák. č. 121/2000 Sb. Automatizované vytěžování (scraping) a reverzní inženýrství je zakázáno."*

Spusť `npm run verify`, udělej commit a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**1. Build bez zdrojových map a bez X-Powered-By:**

- `next.config.ts`: `productionBrowserSourceMaps: false`, `poweredByHeader: false`; komprese (`compress: true`) zůstává.
- Minifikaci produkčního kódu dělá Next 16 vždy (volba `swcMinify` už neexistuje). Komentáře a původní TypeScript v
  prohlížeči nejsou.
- Turbopack v `.next/static/chunks` nechá jen prázdnou mapu (53 B, bez zdrojů, bez odkazu `sourceMappingURL`).

**2. Katalogová data výrobců jen na serveru:**

- `server-only`: celé importy ETIM a index produktových fotek s objednacími čísly. Build selže, kdyby je importoval
  klientský modul. Hlavičku zapisují i generátory (`catalog:etim`, `catalog:parse`, `catalog:images`).
  - `abb-etim.generated.ts`: EAN / GTIN objednacích čísel, rámečky 1R–5R s EAN, chytrá domácnost.
  - `brand-etim.generated.ts`: hloubky přístrojů dalších výrobců, KOPOS s EAN a ceníkovými cenami.
  - `catalog-images.generated.ts`: index produktových fotek.
- Prohlížeč dostane jen veřejnou část `catalog-public.generated.ts`, kterou píše `npm run catalog:public` po každém
  importu ETIM. Obsahuje vestavné hloubky přístrojů pro hlídač krabic, limity víceramečků a rozměry krabic KOPOS – bez
  EAN a cen.
- EAN kusovníku, rámečky ETIM zvolené řady, fotky konkrétní skříně / krabice / výrobku a fotky dílů řad jdou po kouscích
  a jen přihlášeným (firma AI Panel Builderu včetně ukázkové, uživatel závodu, velín):
  - serverové akce `catalogEansAction` (≤ 500 položek) a `etimFramesAction`;
  - `POST /api/catalog-images/lookup` (≤ 200 položek);
  - `GET /api/catalog-images/manifest`.
- Serverové výstupy (elaborát, dokument půdorysu, prezentace) doplňují EAN resolverem `catalogEan` přímo na serveru.
  Veřejná stránka katalogu skříní dostane fotky ze serveru (vidí je i nepřihlášený).
- Odchylka: výpočtové algoritmy (oteplení, kabely, normy, kusovník) zůstávají v minifikovaném klientském JS. Editor
  půdorysu a aplikace pro mobil počítají okamžitě a offline a přesun výpočtů na server by to rozbil. Chráněné jsou
  surové datové matice výrobců. Data chytrých přístrojů `smart-device-specs.generated.ts` (bez EAN a cen) zůstávají v
  klientovi.

**3. Limit požadavků a blokace kopírovacích robotů (`src/proxy.ts` = middleware Next 16, `src/lib/request-guard.ts`):**

- Pevné okno 60 s podle IP adresy. IP je první adresa `X-Forwarded-For` od Caddy, jinak `X-Real-IP`. Bez hlaviček
  (healthcheck, vývoj, E2E) se neomezuje.
- Limity:
  - 60 / min: `/api/catalog*`, `/api/panel-builder*`, `/api/qr-labels*`, `/api/ares*` a stránka katalogu prvků;
  - 15 / min: těžké exporty (ZIP dat firmy, CSV kontaktů a odběratelů, ZPL série štítků, balíček podkladů poolu);
  - 600 / min: obrázky katalogu;
  - 240 / min: serverové akce AI Panel Builderu.
- Překročení limitu = `429 Too Many Requests` s `Retry-After`. Okna jsou v paměti jedné instance aplikace a restart je
  vynuluje.
- Kopírovací roboti a skriptovací klienti dostanou na aplikačních cestách mimo veřejné SEO stránky `403` s odkazem na
  zák. č. 121/2000 Sb. Jde o HTTrack, WebCopier, Teleport, SiteSnagger, Offline Explorer, python-requests / urllib,
  aiohttp, Scrapy, WebZIP, WebStripper, WebReaper, SiteSucker, BlackWidow a Wget.
- `robots.txt` jim zakazuje celý web. Vyhledávače a AI vyhledávače se neblokují (řídí je `robots.txt`).
- User-Agent jde podvrhnout, takže blokace zastaví jen hotové kopírovací programy. Před vytěžováním chrání hlavně limit
  požadavků a přihlášení.

**4. Právní doložka (`IP_NOTICE` v `src/lib/legal.ts`, přesné znění ze zadání):**

- Patička webu (`SiteChrome`).
- Zápatí listů elaborátu (`DocumentationSheets`: listy, příloha půdorysu, verze pod QR štítkem).
- Zápatí výkresu 2D půdorysu (`FloorplanExport`), protokolu revize, auditního reportu a dokladu o nákupu kreditů.
- Podmínky užití 1.1 (`TERMS_VERSION = "1.1-2026-11"`): nový článek 7 „Ochrana databáze, autorských práv a zákaz
  vytěžování“. Změna verze znamená nový souhlas při registraci. Znění podmínek před ostrým prodejem zkontrolovat
  právníkem.

**Testy:**

- `src/lib/phase104.test.ts` (12): konfigurace buildu, `server-only` u importů a generátorů, veřejná část bez EAN a cen,
  kusovník bez EAN v prohlížeči / s EAN na serveru, limity cest, 61. požadavek = 429, roboti, IP, brána (403 / 429),
  robots.txt, doložka a VOP.
- E2E `e2e/phase104.spec.ts` (3): patička bez X-Powered-By, 403 / 200 a robots.txt, ukázka elaborátu, katalog skříní
  s fotkami ze serveru, 401 / prázdný index bez přihlášení.
- Upravené testy: kusovník s resolverem EAN ze serveru a fotky řad z `ALL_SERIES_PHOTOS` serveru. `e2e/phase94.spec.ts`
  čeká na fotky skříní načtené ze serveru.
