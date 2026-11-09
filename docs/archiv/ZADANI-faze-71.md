# Zadání fáze 71 – Aplikace Eldock pro Windows (offline klient údržby)

**Zdroj:** roadmapa fází 66–72 (`ZADANI-faze-66.md`, posunutá ve `ZADANI-faze-68.md`), synchronizační API fáze 70
(`ZADANI-faze-70.md`, protokol `docs/SYNC_API.md`), rozhodnutí uživatele 2026-11-09 a pokyn „Ano, začni fázi 71“.

**Rozhodnutí uživatele (2026-11-09):** provoz obojí podle závodu – aplikace vždy pracují offline a s eldock.cz se
synchronizují aspoň jednou denně, závod s interní sítí bez internetu dostane navíc server závodu; účty Apple, Google
a podpis aplikace pro Windows (Azure Artifact Signing) až na zapsanou Eldock s.r.o. – do té doby vývoj a zkušební
sestavení mimo obchody; e-maily přes schránku `noreply@eldock.cz` u Zoneru; zálohy mimo server do Hetzner Object
Storage v Helsinkách.

**Rozdělení původní fáze 71 (Windows a server závodu = zhruba trojnásobek fáze 70):**

- **71 – aplikace Eldock pro Windows:** offline klient údržby proti eldock.cz – hned použitelný ve všech závodech,
  kde se zařízení aspoň jednou denně připojí k internetu (kancelář, Wi-Fi, mobilní data).
- **72 – server závodu:** závod s interní sítí bez internetu – zařízení se synchronizují se serverem v síti závodu
  a ten jednou denně s cloudem (zařízení `PLANT_SERVER`). Staví na jádru synchronizace z fáze 71.
- **73 – mobilní aplikace iOS a Android:** stejné rozhraní a jádro jako aplikace pro Windows (QR fotoaparátem,
  offline fronta), vydání v obchodech až s firemními účty Eldock s.r.o.

## Cíl fáze 71

Údržbář na počítači nebo tabletu s Windows v hale bez signálu najde zařízení (QR štítek webkamerou, čtečkou
čárových kódů nebo podle označení), vidí jeho údaje, revize, závady, provizoria, požadavky na změnu a dokumentaci
i offline, zapíše úpravy (zadání změny s fotkami, komentář, provizorium a jeho ukončení 1:1, odstranění závady,
výměna sledované součástky, fotka zařízení) a aplikace je po připojení odešle. Úpravy provede server stejnými
pravidly jako web (fáze 70).

## Rozsah

1. **Společné jádro synchronizace** `src/sync-client/` – TypeScript bez frameworku a bez Node API (jen `fetch`
   a Web Crypto), stejné pro Windows, mobilní aplikace (fáze 73) i server závodu (fáze 72):
   - klient API (`info`, `pair`, `session`, `changes`, `mutations`, `files` nahrání a stažení, odpojení) s chybami
     podle protokolu (401 = spárovat znovu, 5xx a výpadek sítě = zkusit později);
   - rozhraní místního úložiště + úložiště v paměti (testy): záznamy entit s kaskádou smazání podle rodičů,
     kurzor a výřez, fronta úprav, soubory;
   - cyklus synchronizace podle `docs/SYNC_API.md` §7: relace → nahrání souborů čekajících úprav (místní odkaz
     `local:<sha256>` se po nahrání nahradí adresou ze serveru) → fronta po 50 → stahování změn s `reset` →
     stažení souborů s ověřením SHA-256; fronta patří uživateli (jiný uživatel ji neodešle);
   - tvorba úprav s ověřením schématem (sdílená schémata `src/lib/sync-mutations.ts` – server i aplikace),
     id nových záznamů z aplikace, `performedAt`, `baseUpdatedAt` z místního záznamu;
   - rozpoznání naskenovaného textu: štítek `…/equipment/<id>?qr=<token>` (ověření `qrToken`), párovací odkaz
     `eldock://pair?server=…&code=…`, jinak hledání podle označení.
2. **Server:**
   - CORS pro `/api/sync/v1/*` a pro stažení souborů `/api/files/*` s tokenem zařízení (`Access-Control-Allow-Origin: *`
     – API nepoužívá cookies; odpovědi s cookie relací CORS hlavičky nedostanou), předběžné dotazy `OPTIONS`
     projdou bránou `proxy.ts`;
   - schémata úprav v `src/lib/sync-mutations.ts` (služba `server/sync/mutations.ts` je používá beze změny pravidel);
   - karta „Aplikace a zařízení“ v Můj účet: odkaz „Otevřít v aplikaci Eldock pro Windows“ (`eldock://pair…`)
     vedle QR a kódu.
3. **Aplikace `apps/desktop/`** (vlastní `package.json` – závislosti aplikace nejdou do obrazu webu):
   - Electron + React + Vite + Tailwind (stejné tmavé téma a štítky stavů jako web – sdílené `src/lib/*`);
   - data v IndexedDB (Dexie), token zašifrovaný DPAPI (`safeStorage`) v hlavním procesu, odkaz `eldock://`
     (jedna instance aplikace), bezpečné výchozí nastavení (izolace kontextu, sandbox, bez navigace mimo aplikaci,
     CSP, kamera jen pro tuto aplikaci);
   - obrazovky: spárování (adresa serveru + kód, vložený odkaz, deep link), přehled (závody, budovy, patra,
     vyhledávání, skenování QR, stav synchronizace a upozornění po 24 h), detail zařízení (údaje, fotka, revize,
     závady, provizoria, požadavky na změnu s historií, dokumentace a návody s otevřením souboru offline,
     sledované součástky, kusovník), formuláře úprav podle oprávnění účtu, fronta úprav (čekající, odmítnuté
     s důvodem), nastavení (účet, server, synchronizace, odpojení, smazání místních dat);
   - automatická synchronizace (po startu, po připojení k síti a pravidelně), ruční „Synchronizovat“;
   - instalátor NSIS (electron-builder) – zatím nepodepsaný, připravený na Azure Artifact Signing.
4. **Testy:** jádro proti skutečným trasám API v testovací databázi (spárování, první stažení, úprava offline
   → po synchronizaci na serveru, odmítnutá úprava, reset výřezu, 401, soubory s místním odkazem a otiskem,
   fronta jiného uživatele), CORS tras, E2E aplikace v Electronu proti E2E serveru (spárování kódem z webu,
   synchronizace, vyhledání, offline úprava → po připojení vidět na webu).

**Mimo rozsah:** server závodu (fáze 72), iOS / Android (fáze 73), podpis a distribuce instalátoru zákazníkům
(Eldock s.r.o. + Artifact Signing), automatické aktualizace aplikace, zákres do schématu a hlasové poznámky
z aplikace, revize VTZ z aplikace, push notifikace.

**Hotovo když:** `npm run verify` OK, testy jádra a CORS zelené, E2E aplikace pro Windows zelené, instalátor
`Eldock-Setup-<verze>.exe` sestavený, `docs/SYNC_API.md` doplněný o CORS a pokyny pro aplikace.
