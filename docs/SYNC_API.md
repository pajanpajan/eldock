# Synchronizační API Eldocku (v1) – protokol pro aplikace Windows, iOS a Android

Fáze 70 (2026-11-08). Serverová část pro aplikace údržbářů (fáze 71 aplikace pro Windows, fáze 72 server závodu, fáze 73 iOS / Android):
data závodu offline, skenování QR štítků a úpravy z haly bez signálu, které se odešlou po připojení. Kód:
`src/server/services/sync.ts` (párování, token, stahování), `src/server/sync/mutations.ts` (fronta úprav),
`src/server/sync/journal.ts` (žurnál změn), trasy `src/app/api/sync/v1/*`, pravidla `src/lib/sync.ts`, schémata
a oprávnění úprav `src/lib/sync-mutations.ts`. Referenční klient (fáze 71): jádro synchronizace `src/sync-client/`
(bez frameworku, jen `fetch` a Web Crypto) a aplikace pro Windows `apps/desktop`.

## 1. Základ

- Adresa API: `<server>/api/sync/v1` – `https://eldock.cz` nebo server závodu na interní síti (fáze 72). Adresu
  serveru nese QR kód párování.
- Data JSON v UTF-8, časy ISO 8601 v UTC. Odpovědi API se necachují (`Cache-Control: no-store`).
- Chyba = HTTP stav + `{ "error": { "code": "…", "message": "česká hláška pro uživatele" } }`.
- **CORS (fáze 71):** API synchronizace a stažení souborů `/api/files/…` s tokenem posílají
  `Access-Control-Allow-Origin: *` a zpřístupní hlavičky `X-Content-SHA256`, `ETag`; předběžné dotazy `OPTIONS` projdou.
  Rozhraní aplikace (Electron, WebView) tak volá server přímo. Ověření je jen tokenem v hlavičce – cookies API nečte
  a odpovědi s cookie relací CORS nemají.

| Stav | Kód | Co udělat |
|---|---|---|
| 400 | `BAD_REQUEST`, `VALIDATION` | chyba aplikace / dat – neopakovat beze změny |
| 401 | `UNAUTHORIZED` | token neplatí (odpojeno, vypršelo, blokace, změna hesla) → smazat token, spárovat znovu; frontu úprav ponechat |
| 404 | `NOT_FOUND` | záznam neexistuje nebo není vidět (cizí firma, mimo výřez) |
| 409 | `CONFLICT`, `INVALID_STATE` | souběh / stav záznamu |
| 413 | `BAD_REQUEST` | tělo nebo soubor je příliš velký |
| 422 | `CHECKSUM_MISMATCH` | otisk SHA-256 nahraného souboru nesouhlasí → nahrát znovu |
| 429 | `RATE_LIMITED` | příliš mnoho chybných kódů párování z IP (15 min) |
| 5xx | `SERVER_ERROR` | opakovat později |

`GET /api/sync/v1` (bez přihlášení) vrátí `{ api: "eldock-sync", version: 1, schema, name, serverTime, pairing, platforms }`
– aplikace tím po naskenování QR ověří, že na adrese běží Eldock s podporovanou verzí.

## 2. Párování zařízení

Uživatel registrované firmy Správy závodů otevře na webu **Můj účet → Aplikace a zařízení → Spárovat nové zařízení**.
Web ukáže QR a kód (8 znaků Crockford Base32 bez I, L, O, U, zobrazený `K7QX-3MZP`), platí **10 minut a jednou**.
Obsah QR: `eldock://pair?server=<adresa serveru, URL-encoded>&code=<kód>`. Bez fotoaparátu uživatel opíše adresu
serveru a kód (malá písmena, mezery a pomlčky nevadí, O = 0, I / L = 1).

```http
POST /api/sync/v1/pair
{ "code": "K7QX-3MZP", "platform": "ANDROID", "name": "Samsung údržba hala A", "appVersion": "1.0.0" }
```

`platform`: `WINDOWS` · `IOS` · `ANDROID` · `PLANT_SERVER` (server závodu, fáze 72) · `OTHER`.
Odpověď 201: `{ token, device: { id, name, platform, createdAt }, session }` (`session` = jako `GET /session`).
Token (`eldk_…`) uložte do zabezpečeného úložiště systému (Keychain, Android Keystore, Windows DPAPI) – server
má jen jeho SHA-256 a znovu ho neukáže. Párovat smí jen aktivní účet registrované firmy se závodem (obchodní demo
a Panel Builder ne), nejvýš 10 zařízení na uživatele. Chybný kód = 404; 10 chybných kódů z jedné IP za 15 minut = 429.

**Platnost tokenu:** do odpojení. Odpojí ho uživatel (Můj účet, nebo `DELETE /session` z aplikace), technický
ředitel (Administrace → Zařízení), změna hesla, nové heslo z odkazu, blokace účtu, „odhlásit ze všech zařízení“,
odebrání zaměstnance a zrušení firmy. Po **90 dnech bez spojení** vyprší. Každý požadavek nese
`Authorization: Bearer <token>`.

## 3. Relace – `GET /api/sync/v1/session`

Na začátku každé synchronizace. Vrací:

- `scope` – otisk toho, co zařízení vidí (epocha žurnálu, verze dat, firma, závody, výřez účtu); posílá se
  ke stahování změn,
- `user` – `id`, `name`, `email`, `title`, `accountType` + `accountLabel`, `permissions` (např. `submitChange`,
  `temporaryMods`, `resolveDefects`, `recordInspection`), `layers` a `visibleTypes` (výřez kategorií, `null` = vše),
- `company` (`id`, `name`, `ico`), `plants` (`id`, `code`, `name`, `city`), `features` (zapnuté moduly a podfunkce),
- `entities` (synchronizované tabulky), `mutations` (podporované úpravy), `policy` (`staleAfterHours` 24,
  `idleExpiryDays` 90, `maxBatch` 50, `defaultPageSize` 500, `maxPageSize` 2000, `tombstoneDays` 90),
- `journal.head` – poslední pořadí žurnálu (průběh prvního stažení), `device` (název, poslední synchronizace).

`DELETE /api/sync/v1/session` = odhlásit a odpojit zařízení (token přestane platit).

## 4. Stahování změn – `GET /api/sync/v1/changes?cursor=<n>&scope=<scope>&limit=<1–2000>`

Žurnál změn (`SyncChange`) drží pro každý záznam pořadí poslední změny (`seq`). Aplikace si pamatuje `cursor`
a `scope` a stahuje, dokud `hasMore` není `false`.

- `cursor=0` = první stažení celého závodu (bez značek smazání).
- Odpověď: `{ cursor, hasMore, reset, scope, changes, files, serverTime }`.
- `changes[]`: `{ entity, id, op: "upsert" | "delete", seq, data? }` – `upsert` nese celý záznam (`data`) a nahradí
  místní řádek se stejným `id`; `delete` záznam smaže. Stránka nikdy nerozdělí změny se stejným `seq`.
- **`reset: true`** → smazat všechna místní data závodu, zachovat frontu úprav a stáhnout vše od `cursor=0`.
  Nastane po změně výřezu účtu (jiný typ účtu, kategorie, závod), nové verzi dat (`schema`), nové epoše žurnálu
  (obnova serveru ze zálohy), kurzoru starším než 90 dní (smazané značky) nebo kurzoru z jiné databáze.
- **Konzistence:** data jsou úplná až po stažení všech stránek (`hasMore: false`) – mezi stránkami může přijít potomek
  dřív než rodič. Místní databáze aplikace proto nevynucuje cizí klíče během synchronizace.
- **Kaskáda na straně aplikace:** smazání rodiče smaže i jeho potomky (server pošle značky i pro potomky, ale
  aplikace se na to nesmí spoléhat – např. zařízení, které vypadlo z výřezu, přijde jen jako `delete` zařízení).
- **Výřez účtu:** záznam zařízení mimo `visibleTypes` (a vše pod ním) aplikace nedostane; změní-li se kategorie
  zařízení, přijde celý jeho podstrom znovu (`upsert`, nebo `delete`, když vypadl z výřezu).
- `files`: otisky souborů, na které změny odkazují – `{ "/api/files/photos/…": { sha256, size, mime } }`
  (vzorové soubory `seed/` otisk nemají).

Synchronizované tabulky a jejich rodiče (pole = sloupce modelu Prismy v `prisma/schema.prisma`):

| Entita | Rodič | Poznámka |
|---|---|---|
| `Plant` | – | závod uživatele |
| `Building` | `Plant` (`plantId`) | |
| `Floor` | `Building` (`buildingId`) | půdorys `floorplanSvg` / `floorplanUrl`, `studioLayoutJson` |
| `Equipment` | `Floor` (`floorId`) | `qrToken` = kód QR štítku (offline vyhledání po naskenování) |
| `DocumentRevision` | `Equipment` | schéma `schematicUrl`, stav `ACTIVE` = platná dokumentace |
| `BomItem`, `SchematicReference` | `DocumentRevision` (`revisionId`) | kusovník, odkazy ve výkresu |
| `ChangeRequest` | `Equipment` | `number` přidělí server (`ZM-RRRR-NNNN`) |
| `Attachment`, `ChangeRequestEvent` | `ChangeRequest` | |
| `InspectionRecord` | `Equipment` | revize VTZ, `validUntil` |
| `InspectionDefect` | `Equipment` (+ `inspectionId`) | závady z revizí |
| `ComplianceDocument`, `EquipmentDocument`, `SoftwareBackup`, `MonitoredComponent`, `TemporaryModification` | `Equipment` | |
| `User` | firma | jen `id`, `name`, `role`, `accountType`, `title`, `companyId`, `homePlantId`, `disabledAt` |

QR štítek zařízení obsahuje `…/equipment/<id>?qr=<qrToken>` – aplikace najde zařízení podle `id` z adresy a ověří
`qrToken` (jiný kód = štítek byl přegenerován, starý je neplatný).

## 5. Fronta úprav – `POST /api/sync/v1/mutations`

Úpravy z aplikace jsou **záměry**, ne přepis řádků: server je provede stejnými službami a pravidly jako web
(oprávnění účtu, závod a výřez, vlastník souborů, stav záznamu). Server je zdroj pravdy.

```json
{ "mutations": [
  { "id": "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9b0a3e", "type": "changeRequest.submit",
    "performedAt": "2026-11-07T06:30:00Z",
    "payload": { "id": "6a1d…", "equipmentId": "…", "note": "Vyměněn stykač -K4", "attachments": [{ "url": "/api/files/photos/…" }] } }
] }
```

- `id` – UUID úpravy (8–64 znaků `A–Z a–z 0–9 _ -`), unikátní pro uživatele. **Přesně jednou:** úprava se zapíše
  v jedné transakci se svou evidencí; opakované odeslání (výpadek spojení) vrátí původní výsledek s `duplicate: true`.
- `performedAt` – kdy úpravu uživatel provedl (offline); převezme se, je-li z posledních 30 dní a ne z budoucnosti
  (jinak čas přijetí). Určuje např. začátek lhůty provizoria nebo čas odstranění závady.
- `baseUpdatedAt` – volitelně `updatedAt` záznamu, jak ho aplikace znala; jinak změněný záznam = `CONFLICT`.
- Nejvýš 50 úprav a 8 MB v jednom odeslání, zpracují se v pořadí, každá samostatně.
- Výsledky `results[]`: `{ id, status, duplicate?, code?, message?, entity?, entityId?, result? }`
  - `applied` – provedeno (`entity` + `entityId` = vytvořený / změněný záznam, `result` např. číslo změny),
  - `rejected` – odmítnuto pravidlem (`code`: `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `INVALID_STATE`,
    `DUPLICATE_ID`, `UNKNOWN_TYPE`; `message` ukázat uživateli) – **znovu neposílat**, uživatel úpravu opraví jako novou,
  - `error` – chyba serveru, poslat znovu později (stejné `id`).
- **Fronta patří uživateli:** po spárování jiného uživatele ji aplikace neodešle (úpravy by se zapsaly pod jeho jménem).
- Nové záznamy nesou **id přidělené aplikací** (`payload.id`) – offline na ně jde navázat další úprava ve frontě
  (založit provizorium a pak ho ukončit). Čísla `ZM-…` a `PROV-…` přidělí server až při synchronizaci.

| `type` | `payload` | Oprávnění |
|---|---|---|
| `changeRequest.submit` | `id?`, `equipmentId`, `note?`, `voiceTranscript?`, `markupData?` (JSON zákresu), `markupSheet?`, `markupImageUrl?`, `attachments?` (`url`, `type` PHOTO / VOICE_NOTE / MARKUP_IMAGE / OTHER, `fileName`, `mimeType`, `sizeBytes`, `caption`, `originalUrl`), `priority?`, `safetyImpact?`, `requiresSoftwareUpdate?` | `submitChange` |
| `changeRequest.comment` | `changeRequestId`, `comment?`, `attachments?` | každý, kdo změnu vidí |
| `temporaryMod.create` | `id?`, `equipmentId`, `title`, `description`, `days` (7 / 14), `photoUrl?`, `createdByRole?` | `temporaryMods` |
| `temporaryMod.restore` | `temporaryModId`, `note?` (ukončení 1:1 podle schématu) | `temporaryMods` |
| `defect.resolve` | `defectId`, `note`, `photoUrl?` | `resolveDefects` |
| `component.replace` | `componentId`, `equipmentId` (výměna kusu, odepíše náhradní díl) | `submitChange` nebo `recordInspection` |
| `equipment.photo` | `equipmentId`, `photoUrl` (`null` = odebrat) | `submitChange` nebo `recordInspection` |

**Zadání změny u zařízení s otevřeným požadavkem** (zařízení má nejvýš 1 otevřený – offline ho mohl mezitím zadat
kolega): server ho připojí k otevřenému požadavku jako komentář s přílohami a zákresem (`result.merged: true`,
`entityId` = otevřený požadavek). Aplikace pak místní nový požadavek nahradí otevřeným.

## 6. Soubory

- **Nahrání:** `POST /api/sync/v1/files?kind=<druh>&name=<název souboru>`, tělo = obsah souboru, hlavička
  `X-Content-SHA256: <hex>`. Druhy a limity jako na webu (`photo` 15 MB JPG / PNG / WebP, `markup`, `voice`,
  `document`, `attachment`, `revision`, `software` – `UPLOAD_RULES` v `src/lib/files.ts`). Server otisk ověří (jinak 422)
  a soubor firmy se stejným obsahem vrátí místo nového (`deduplicated: true`) – opakované nahrání po výpadku spojení
  nevytvoří duplikát. Odpověď `{ url, sha256, sizeBytes, mimeType, fileName, deduplicated }`; `url` pak použijte
  v `payload` úpravy. Nahrávejte **před** odesláním fronty úprav, které na soubor odkazují.
- **Stažení:** `GET <url>` (`/api/files/…`) s tokenem zařízení – vydá jen soubory firmy (a sdílené / vzorové),
  hlavička `X-Content-SHA256` = otisk z registru (ověřit a podle něj držet mezipaměť), `ETag` pro podmíněné stažení.

## 7. Doporučený cyklus synchronizace (offline provoz = aspoň jednou denně)

1. `GET /session` – 401 → spárovat znovu; jiný `scope` než uložený → po stažení změn přijde `reset`.
2. Nahrát soubory čekajících úprav (`POST /files`).
3. Odeslat frontu (`POST /mutations`, po 50) – `applied` a `rejected` z fronty odebrat, `rejected` ukázat uživateli.
4. Stahovat `GET /changes` od uloženého kurzoru, dokud `hasMore` není `false`; při `reset` smazat data a začít od 0.
5. Stáhnout chybějící soubory podle `files` (offline potřebné: schémata, návody, fotky zařízení).

Web ukazuje u zařízení „Nesynchronizováno déle než 24 h“ (Můj účet, Administrace → Zařízení) – aplikace má uživatele
upozornit stejně (`policy.staleAfterHours`).

## 8. Server závodu (fáze 72) a provoz

- Server závodu poběží stejnou aplikací Eldock (Docker v síti závodu) se stejným API – aplikace v hale se párují
  s ním (QR nese jeho adresu). Se cloudem se bude synchronizovat jako zařízení `PLANT_SERVER` (doplní fáze 72, na jádru `src/sync-client/`).
- Žurnál plní triggery SQLite (`ensureSyncTriggers`: start aplikace, `npm run sync:setup` po migracích v kontejneru).
  Po obnově databáze ze zálohy spusťte `npm run sync:setup -- --new-epoch` – aplikace stáhnou vše znovu.
- Retence: značky smazání v žurnálu a evidence úprav 90 dní, odpojená a vypršelá zařízení 30 dní, kódy párování 1 den.
