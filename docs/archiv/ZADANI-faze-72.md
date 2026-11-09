# Zadání fáze 72 – Server závodu (interní síť bez internetu)

**Zdroj:** roadmapa (`ZADANI-faze-66.md`, rozdělení ve `ZADANI-faze-71.md`), rozhodnutí uživatele 2026-11-09 („provoz obojí
podle závodu – závod s interní sítí bez internetu dostane navíc server závodu“) a pokyn „Ano, začni fázi 72“.

## Cíl

V závodě, kde zařízení v hale nesmí nebo nemůžou na internet, poběží na počítači v síti závodu **server závodu**.
Aplikace v hale (Windows, později mobilní) se párují a synchronizují s ním stejným protokolem jako s eldock.cz
(`docs/SYNC_API.md`) – aplikace rozdíl nepozná. Server závodu se s cloudem synchronizuje jako zařízení `PLANT_SERVER`
(kdykoli má spojení, aspoň jednou denně): stáhne data celého závodu a přepošle úpravy z haly jménem techniků, kteří
je zadali. Úpravy z haly vidí ostatní zařízení v síti závodu **hned** jako předběžné (nové provizorium nesmí čekat
na denní synchronizaci), cloud o nich rozhodne a jeho data předběžné záznamy nahradí.

## Rozsah

1. **Cloud (eldock.cz):**
   - kód párování s účelem `PLANT_SERVER` (migrace `SyncPairing.purpose`) – vytvoří ho jen správce firmy
     (oprávnění `manageUsers`) v Administraci → Zařízení; zařízení `PLANT_SERVER` jde spárovat jen takovým kódem
     a takový kód nespáruje běžné zařízení;
   - zařízení `PLANT_SERVER` dostává data celého závodu (bez výřezu kategorií) a v relaci přístupy uživatelů firmy
     v závodě (oprávnění, výřez, vrstvy – spočítané cloudem, server závodu nic nepočítá jinak); sám úpravy nezadává;
     správce bez oprávnění `manageUsers`, zablokovaný nebo odebraný = 401;
   - přeposlání úprav: `POST /mutations` od `PLANT_SERVER` nese u každé úpravy `actorId` – cloud ji provede jako ten
     uživatel (stejná firma a závod, aktivní účet, jeho oprávnění a výřez; evidence `SyncMutation` pod ním se zařízením
     serveru závodu, přesně jednou podle `id` úpravy); běžné zařízení `actorId` poslat nesmí;
   - Administrace → Zařízení: „Spárovat server závodu“ (kód + adresa cloudu) a servery závodu v seznamu zařízení.
2. **Server závodu** `src/plant-server/` (Node 22+, `node:sqlite` a `node:http` – bez nativních modulů; běží
   v `Eldock.exe --plant-server` nebo `npm run plant-server`):
   - úložiště SQLite: vrstva z cloudu, předběžná vrstva úprav z haly, místní žurnál (vlastní pořadí `seq`, značky smazání),
     zařízení a kódy párování v hale, přeposílané úpravy, soubory;
   - spojení s cloudem jádrem `src/sync-client/` (režim přeposílání): stažení závodu, nahrání fotek z haly, přeposlání
     úprav s `actorId`, stažení výsledků; plánovač (každých 5 minut, hned po úpravě z haly, ručně);
   - API pro zařízení v hale (stejný protokol): informace o serveru, párování kódem ze správy serveru, relace (účet z přístupů
     od cloudu), změny z místního žurnálu podle výřezu uživatele, úpravy (ověření schématem, oprávněním, závodem
     a výřezem, stavem záznamu a `baseUpdatedAt` → předběžná data + přeposlání; odpověď `accepted`, opakované odeslání
     vrátí výsledek z cloudu), nahrání a stažení souborů;
   - předběžná data úprav: nová změna (nebo komentář k otevřené změně), komentář, nové provizorium, ukončení provizoria 1:1,
     odstranění závady, výměna součástky, fotka zařízení; po výsledku z cloudu se nahradí jeho daty, odmítnutá úprava se vrátí;
   - správa serveru (webová stránka na serveru): první nastavení jen z tohoto počítače (heslo správce, spárování s cloudem),
     stav synchronizace, přeposílané úpravy, kódy párování pro uživatele firmy, zařízení v hale a jejich odpojení.
3. **Aplikace (jádro a Windows):** stav úpravy `accepted` („na serveru závodu, čeká na cloud“) – aplikace ji posílá znovu,
   dokud server závodu nevrátí výsledek z cloudu; informace o serveru závodu v hlavičce a nastavení.
4. **Spuštění ve Windows:** `Eldock.exe --plant-server --data <složka> --port <port>` bez okna (stejná podepsaná aplikace,
   žádný další runtime), skript naplánované úlohy po startu Windows a pravidla brány firewall.
5. **Testy:** cloud (účel kódu, výřez, přístupy uživatelů, přeposlání s `actorId` a jeho odmítnutí), celý řetězec v testu
   cloud ↔ server závodu ↔ dvě zařízení (předběžná data viditelná kolegovi hned, výsledek z cloudu, odmítnutí a vrácení,
   výřez uživatele, smazání a kaskáda, offline cloud), spuštění skutečného serveru přes HTTP.

**Mimo rozsah:** HTTPS na interní síti (zatím http s upozorněním v aplikaci – certifikát a ověření otiskem v další
fázi), přenos dat na nosiči do úplně izolované sítě, zařízení spárovaná s cloudem přímo na serveru závodu (token platný
na obou), více závodů na jednom serveru, mobilní aplikace (fáze 73).

**Hotovo když:** `npm run verify` OK, testy cloudu i celého řetězce zelené, skutečný server závodu přes HTTP obslouží
aplikaci pro Windows, `docs/SYNC_API.md` popisuje server závodu a přeposílání.
