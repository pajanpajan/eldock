# Zadání fáze 70 – synchronizační API pro aplikace Windows, iOS a Android (2026-11-08)

**Zdroj:** roadmapa fází 66–72 (`ZADANI-faze-66.md`, posunutá ve `ZADANI-faze-68.md`) a pokyn „Pokračuj fází 70“
po nasazení fáze 69 (2026-11-08). Původní zadání: „Budeme muset udělat windows aplikaci pro offline provoz stejně tak
aplikaci pro telefony s IOS a Android, aby měli údržbáři přístup k datům, mohli skenovat QR kódy rovnou posílat úpravy
a to jak online tak offline, je spoustu závodů, kde není ve výrobě signál proto je potřeba, aby systém mohl běžet
i na interní síti, nebo offline, s tím, že v offline režimu bude potřeba každodenní synchronizace, aby se vše propsalo.“
Fáze 70 staví serverovou část, na kterou se napojí aplikace pro Windows a server závodu (fáze 71) a mobilní aplikace
(fáze 72).

## Stav před fází 70 (prověrka kódu 2026-11-08)

- Data jdou číst a měnit jen z webu: stránky (React Server Components) a serverové akce s přihlašovací cookie.
  Žádné API pro aplikace, žádný způsob, jak zjistit „co se změnilo od včerejška“ (`updatedAt` nemají všechny tabulky,
  smazané záznamy nezanechají stopu a kaskáda závod → budovy → patra → zařízení → revize, změny … běží v SQLite).
- Přihlášení je relace prohlížeče na 12 h (`UserSession`, fáze 67) – pro telefon v hale bez signálu nepoužitelné.
- Kontroly v akcích (`assertTenantAccess`, `assertPlantFiles`) berou uživatele z cookie a globální `prisma` –
  pro požadavek z aplikace (token v hlavičce) je nejde použít.
- Soubory mají od fáze 68 registr s SHA-256, `/api/files` ale přijme jen cookie a otisk nevrací.
- Čísla změn (`ZM-RRRR-NNNN`) a provizorií (`PROV-RRRR-NNNN`) přiděluje server – offline je aplikace přidělit nemůže.

## Rozhodnutí (návrh fáze)

- **Žurnál změn triggery SQLite** (`SyncChange`, jeden řádek na záznam s posledním pořadovým číslem `seq` z čítače
  `SyncCounter`): zachytí zápis odkudkoli (služby, skripty, kaskády). Rozsah záznamu (závod, zařízení, firma) se dědí
  ze žurnálu rodiče, takže tělo triggeru sahá **jen do tabulek žurnálu** – trigger odkazující na jinou tabulku by
  rozbil budoucí migrace Prismy (přestavba tabulky `DROP` + `RENAME` skončí chybou „error in trigger … no such table“,
  ověřeno nad SQLite 3.53). Triggery zakládá kód (`ensureSyncTriggers`) při startu aplikace, po migracích v kontejneru
  a v testech; chybějící triggery (tabulku přestavěla migrace) doplní a tabulku přežurnáluje.
- **Párování zařízení kódem / QR** z „Můj účet“ (8 znaků, 10 minut, jednorázový) místo hesla v aplikaci – funguje
  i s dvoufázovým ověřením, QR nese adresu serveru (cloud nebo server závodu ve fázi 71). Zařízení dostane dlouhý
  token (v DB jen SHA-256), platí do odpojení, po 90 dnech bez spojení vyprší.
- **Úpravy z aplikace jako záměry, ne přepis řádků:** každá úprava prochází stejnými službami a pravidly jako web
  (oprávnění účtu, závod, výřez kategorií, vlastník souborů), je idempotentní (id úpravy z aplikace) a zapíše se
  v jedné transakci s evidencí `SyncMutation` (přesně jednou i při výpadku spojení). Server je zdroj pravdy:
  odmítnutá úprava vrátí důvod, souběh se pozná podle stavu záznamu nebo `baseUpdatedAt`.
- Nové záznamy z aplikace nesou **id přidělené aplikací** (offline na ně jde navázat další úpravu), čísla ZM / PROV
  přidělí server při synchronizaci.

## Úkoly fáze 70

1. **Zařízení a párování:** „Můj účet“ → „Aplikace a zařízení“: spárovat nové zařízení (kód + QR s adresou serveru),
   seznam vlastních zařízení (platforma, verze aplikace, poslední synchronizace, upozornění po 24 h bez synchronizace)
   s odpojením. Administrace → „Zařízení“ (technický ředitel): všechna zařízení firmy, úpravy za 7 dní, odpojení.
   Párování jen pro aktivní účty registrovaných firem Správy závodů (demo a Panel Builder ne), nejvýš 10 zařízení
   na uživatele, limit chybných kódů na IP. Bezpečnostní deník: spárování, odpojení, chybný kód.
2. **Zabezpečení zařízení:** token platí jen pro aktivní účet (blokace, odebrání zaměstnance, zrušení firmy ho
   zneplatní); změna hesla, nastavení hesla z odkazu, blokace a „odhlásit ze všech zařízení“ odpojí i aplikace.
3. **Žurnál změn** pro závod (budovy, patra, zařízení, dokumentace, kusovníky, odkazy ve schématu, změny s událostmi
   a přílohami, revize VTZ a závady, provizoria, návody, zálohy SW, životnost součástek) a jména a role kolegů z firmy.
   Smazání = značka (90 dní), změna kategorie zařízení přežurnáluje jeho podstrom.
4. **API `/api/sync/v1`** (token v hlavičce `Authorization: Bearer`): informace o serveru, spárování, relace
   (uživatel, oprávnění, výřez, závod, moduly, pravidla), stahování změn po stránkách od kurzoru (první stažení = celý
   závod; výřez kategorií účtu; změna výřezu, verze schématu nebo prošlý kurzor = `reset`), odeslání fronty úprav
   (nejvýš 50 najednou), nahrání souboru s kontrolou SHA-256 a odstraněním duplicit, odpojení. Soubory z `/api/files`
   i s tokenem zařízení a s otiskem v hlavičce `X-Content-SHA256`.
5. **Úpravy z aplikace (v1):** zadání změny (do otevřeného požadavku se připojí jako komentář), komentář ke změně,
   založení a ukončení provizoria 1:1, odstranění závady, výměna sledované součástky, fotka zařízení. Čas provedení
   z aplikace (offline) se převezme, pokud je v posledních 30 dnech.
6. **Retence a GDPR:** značky smazání a evidence úprav 90 dní, odpojená a prošlá zařízení 30 dní, kódy párování 1 den;
   export firmy a vlastních údajů doplnit o zařízení; zásady zpracování osobních údajů 1.3.
7. **Popis protokolu pro aplikace** `docs/SYNC_API.md` (fáze 71–72).
8. Testy: triggery nad službami (rozsah, kaskáda, přestavba tabulky, změna kategorie), párování a token (prošlý,
   použitý, blokace, změna hesla), stahování (cizí firma, demo, výřez, `reset`, stránky), fronta úprav (přesně jednou,
   oprávnění, cizí záznam a soubor, souběh, sloučení do otevřené změny), retence; E2E spárování v „Můj účet“, API
   s tokenem, nahrání souboru, odpojení zařízení správcem.

**Mimo rozsah:** samotné aplikace (Windows a server závodu = fáze 71, iOS / Android = fáze 72), push notifikace,
synchronizace server závodu ↔ cloud (fáze 71 – protokol je na ni připravený platformou `PLANT_SERVER`), úpravy
z aplikace mimo seznam v1 (revize VTZ se zprávou PDF, Studio, CAE back-office zůstávají na webu).
