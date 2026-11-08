# Zadání fáze 68 – soubory firem, zálohy mimo server a retence (2026-11-08)

**Zdroj:** roadmapa schválená s fází 66 (`ZADANI-faze-66.md`) a pokyn „pokračuj“ po fázi 67 (2026-11-08).
Uživatel: „Potom se musíme pustit do registrace firem, hlavně zabezpečení, ukládání jejich dat a synchronizaci napříč
zaměstnanci ve firmě.“ Fáze 68 = **ukládání dat firem**: komu patří který soubor, kdo ho smí číst, zálohy a jak dlouho
se drží záznamy o přihlášení.

## Stav před fází 68 (prověrka kódu 2026-11-08)

- Všechny nahrané soubory leží v `storage/uploads/<druh>/<UUID>` a `GET /api/files/…` je vydá **komukoli
  přihlášenému** do správy závodů – i obchodnímu demu nebo jiné firmě, pokud zná adresu. Ochranu dělá jen náhodné jméno.
- Soubor nemá vlastníka ani záznam v databázi (velikost, otisk, kdo nahrál). Serverové akce přijmou **jakoukoli adresu
  `/api/files/…`** – firma si tak může k vlastnímu záznamu připojit cizí soubor a server ho pak čte za ni (analýza fotky
  rozváděče, import datasheetu, tisk loga).
- Firma jen v AI Panel Builderu nesmí přes přihlašovací bránu číst nic mimo `/api/files/photos/` – vlastní logo
  a razítko (`documents`) se jí v profilu firmy nezobrazí (chyba od fáze 43, E2E ji nezachytily, protože mají obě cookie).
- Zálohy neexistují: data jsou jen ve svazcích `./data/db` a `./data/storage` na jednom serveru. Při ztrátě serveru
  nebo poškození databáze není z čeho obnovit.
- Bezpečnostní deník (fáze 67), prošlé relace a použité odkazy na nastavení hesla rostou bez omezení.
- Pasport z Panel Builderu se do závodu propouští jen jako vazba projektu na zařízení (`PanelBoardProject.equipmentId`)
  – soubory se mezi firmami nesdílejí, závod fotky projektu nezobrazuje.

## Úkoly fáze 68

1. **Registr souborů** (`StoredFile`): adresa, druh, vlastník (demo / firma / sdílený), kdo nahrál, velikost, SHA-256,
   typ, původní název, smazání. Nahrání přes `/api/uploads` i soubory, které vytvoří server (zpráva o revizi, revize
   schématu, protokol importu), se zapíšou s vlastníkem podle přihlášení (Panel Builder posílá `scope=panel`).
2. **Izolace `/api/files`:** soubor firmy čtou jen její přihlášení (správa závodů i Panel Builder), soubor dema jen
   demo účty, velín vše; vzorové soubory `seed/` a sdílené soubory každé přihlášení. Brána pustí na soubory kohokoli
   přihlášeného, rozhoduje vlastník souboru (oprava loga a razítka firmy jen v Panel Builderu).
3. **Převzetí souboru jen od vlastníka:** serverové akce, které ukládají adresu souboru (fotky, přílohy, zprávy,
   zálohy SW, revize schématu, provizoria, závady, projekty a lišty Panel Builderu, logo a razítko, import datasheetu,
   podklad půdorysu), odmítnou soubor jiného vlastníka.
4. **Doplnění registru pro starší soubory** (`npm run storage:registry`, idempotentní, entrypoint ho pouští před
   startem aplikace): vlastník podle záznamu, který na soubor odkazuje (závod → firma / demo, firma Panel Builderu);
   soubor s odkazy více vlastníků nebo z neznámé tabulky = sdílený (chová se jako dosud), soubor bez odkazu se nezapíše.
5. **Zálohy:** každý den konzistentní snímek databáze (`VACUUM INTO`, kontrola integrity, gzip), volitelně šifrovaný
   AES-256-GCM (`ELDOCK_BACKUP_KEY`), lokálně v `./data/backups` s rotací; **mimo server** do úložiště kompatibilního
   s S3 (Hetzner Object Storage, AWS S3, MinIO v závodě) – snímky databáze s retencí denních a měsíčních kopií a soubory
   přírůstkově, každý šifrovaně; soubor smazaný v aplikaci zmizí ze zálohy po 30 dnech. Bez klíče se mimo server nic
   neposílá. Plánovač v procesu aplikace (`instrumentation.ts`), ruční záloha z velínu a `npm run backup`, obnova do
   prázdné složky `npm run backup:restore` (nikdy přes živá data).
6. **Retence:** bezpečnostní deník 1 rok, zrušené a prošlé relace a použité / prošlé odkazy na heslo 30 dní – každý den
   se stejným plánovačem.
7. **Velín → Zálohy a data:** poslední zálohy (stav, velikost, mimo server, chyby), nastavení bez tajných údajů
   (otisk klíče), tlačítko „Zálohovat teď“, registr souborů podle vlastníků.
8. Testy: pravidla čtení a převzetí souborů, doplnění registru nad SQLite, podpis AWS SigV4 (vzorový příklad AWS),
   šifrování a obnova zálohy přes testovací S3 server, retence; E2E izolace souborů mezi firmami a logo firmy jen
   v Panel Builderu.

**Mimo rozsah (nová fáze 69):** export dat firmy (GDPR čl. 20) a výmaz firmy nebo zaměstnance při ukončení služby
(čl. 17) včetně zachování účetních dokladů. Roadmapa se tím posouvá: 70 synchronizační API, 71 aplikace pro Windows
a server závodu, 72 mobilní aplikace. Před mimoserverovou zálohou na produkci rozhodne uživatel o úložišti
(doporučení: Hetzner Object Storage v jiné lokalitě než server) a doplní klíče do `.env` sám.
