# Zadání fáze 69 – export a výmaz dat firmy (GDPR) (2026-11-08)

**Zdroj:** roadmapa fází 66–72 (`ZADANI-faze-66.md`, posunutá ve `ZADANI-faze-68.md`) a pokyn „Pokračuj fází 69“
po nasazení fází 67 a 68 (2026-11-08). Navazuje na „ukládání jejich dat“ z původního zadání: firma musí jít ze služby
odejít se svými daty a po odchodu po ní nesmí v Eldocku zůstat nic, co zůstat nemusí.

## Stav před fází 69 (prověrka kódu 2026-11-08)

- Data firmy nejde stáhnout. Firma Správy závodů vidí svá data jen v aplikaci, firma Panel Builderu jen jednotlivé PDF.
- Účet firmy nejde zrušit ani v aplikaci, ani ve velínu. Výmaz by znamenal ruční zásah do databáze.
- Odchod zaměstnance = jen blokace z fáze 67: e-mail, telefon a jméno zůstávají a e-mail nejde použít pro nový účet.
- Vazby v databázi: závod → budovy → patra → zařízení → revize, změny, přílohy, závady, provizoria, návody, zálohy SW
  se mažou kaskádou; uživatelé jsou na záznamy navázaní bez kaskády (autor revize, zadavatel změny, autor události).
  `CreditOrder` se smaže kaskádou s firmou, přitom zálohové faktury se počítají z údajů firmy (bez kopie fakturačních
  údajů) – firmu s objednávkami nejde smazat bez ztráty dokladů.
- Zásady zpracování osobních údajů (`lib/legal.ts`, verze 1.1) nepopisují bezpečnostní deník, relace, zálohy
  ani konkrétní doby uložení.

## Úkoly fáze 69

1. **Export dat firmy** (čl. 20 GDPR, u Správy závodů i čl. 28 odst. 3 písm. g) – vrácení dat): ZIP se strojově
   čitelnými JSON (firma, uživatelé bez hesel a tajemství, závod, budovy, patra, zařízení, revize dokumentace, kusovníky,
   změny s událostmi a přílohami, revize VTZ a závady, provizoria, návody a zálohy SW, životnost součástek, avíza,
   bezpečnostní deník; u Panel Builderu projekty s přístroji, půdorysy s verzemi, objednávky kreditů a hlášení AI),
   CSV zařízení a revizí pro Excel, všechny soubory firmy a `manifest.json` + `README.txt`. Stahuje správce firmy
   (`/admin/data`, firma Panel Builderu v profilu firmy) a velín.
2. **Vlastní údaje uživatele** (čl. 15): „Stáhnout moje údaje“ v „Můj účet“ – JSON s profilem, přihlášenými zařízeními,
   vlastními událostmi bezpečnostního deníku a přehledem záznamů, které uživatel ve firmě vytvořil.
3. **Odebrání zaměstnance:** správce firmy zaměstnance odebere – zruší se přihlášení, heslo, 2FA, relace a odkazy,
   e-mail a telefon se odstraní (e-mail jde znovu použít), jméno zůstane v historii záznamů, volitelně se anonymizuje.
   Sebe ani posledního správce firmy odebrat nejde.
4. **Zrušení účtu firmy:** správce firmy (s heslem) požádá o zrušení – výmaz proběhne po 30 dnech (do té doby jde
   žádost zrušit a data stáhnout), velín může výmaz provést hned nebo zrušit. Výmaz smaže závod se vším, uživatele,
   relace, bezpečnostní deník, avíza a soubory firmy (ze zálohy mimo server zmizí podle retence fáze 68). Firma
   Panel Builderu s objednávkami kreditů zůstane jako zrušená firma jen s fakturačními údaji (název, IČO, DIČ, sídlo)
   kvůli dokladům – bez kontaktní osoby, e-mailu, telefonu a přihlášení. Ukázkovou firmu Tester zrušit nejde.
5. **Evidence žádostí** (`DataRequest`, čl. 5 odst. 2): export, odebrání zaměstnance, žádost o zrušení, zrušení žádosti
   a provedený výmaz – firma (název, IČO), kdy a souhrn, bez osobních údajů. Plánovač údržby provádí výmazy po lhůtě.
6. **Retence:** evidence žádostí 3 roky, zrušená firma s doklady 10 let od zrušení (pak se smaže i s objednávkami).
7. **Zásady zpracování osobních údajů** (verze 1.2): bezpečnostní deník a relace, zálohy, role správce a zpracovatele
   u dat firem, konkrétní doby uložení a jak práva uplatnit v aplikaci.
8. Testy: ZIP (struktura, CRC, rozbalení), export nad SQLite (vlastní data ano, cizí firma, demo a tajemství ne),
   odebrání zaměstnance, zrušení účtu (lhůta, zrušení žádosti, výmaz, zrušená firma s doklady, Tester), retence; E2E
   export ZIP, odebrání zaměstnance, žádost o zrušení a její zrušení, stažení vlastních údajů.

**Mimo rozsah:** opravy a omezení zpracování na žádost (čl. 16 a 18 – firmy opravují data v aplikaci, ostatní přes
kontaktní e-mail), elektronický podpis žádosti, smlouva o zpracování (DPA) jako dokument – patří do obchodních
podmínek a před ostrým prodejem ji má zkontrolovat právník.
