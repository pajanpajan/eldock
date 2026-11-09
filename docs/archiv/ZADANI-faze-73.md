# Zadání fáze 73 – Mobilní aplikace Eldock pro Android a iOS

**Zdroj:** roadmapa fází 71–73 (`ZADANI-faze-71.md`: „73 – mobilní aplikace iOS a Android: stejné rozhraní a jádro
jako aplikace pro Windows (QR fotoaparátem, offline fronta), vydání v obchodech až s firemními účty Eldock s.r.o.“),
rozhodnutí uživatele 2026-11-09 (provoz obojí podle závodu, účty Apple a Google až na Eldock s.r.o., do té doby
zkušební sestavení mimo obchody) a pokyn „Ano, začni fázi 73“.

## Cíl fáze 73

Údržbář s telefonem nebo tabletem Android či iPhone naskenuje fotoaparátem QR štítek zařízení i v hale bez signálu,
vidí jeho údaje, revize, závady, provizoria, požadavky na změnu a dokumentaci a zapíše stejné úpravy jako v aplikaci
pro Windows. Aplikace je odešle po připojení – přímo na eldock.cz, nebo na server závodu v interní síti (fáze 72).
Úpravy zapsané offline se neztratí ani tehdy, když systém smaže data prohlížeče aplikace.

## Rozhodnutí (technická, 2026-11-09)

- **Jedna aplikace, tři platformy:** `apps/desktop` → `apps/client`. Společné rozhraní (React, `src/`) a jádro
  synchronizace (`src/sync-client/`). Platformy: Windows `electron/` (fáze 71), Android `android/` a iOS `ios/`
  (Capacitor 8 – rozhraní běží v systémovém WebView, nativní funkce přes pluginy). Jedno sestavení `dist/`
  pro všechny tři.
- **Most platformy** `src/platform/`: Electron (`window.eldock`), mobilní aplikace (Capacitor) a prohlížeč (vývoj).
  Rozhraní nevolá nativní API jinde než v mostu.
- **QR štítky:** oficiální `@capacitor/barcode-scanner`. Na Androidu ML Kit v aplikaci (bez Google Play a bez
  internetu), na iOS AVFoundation (Swift Package Manager). Záloha je skener kamerou ve WebView (jsQR, jako Windows).
  Text štítku jde zadat i ručně.
- **Token zařízení:** iOS Klíčenka (jen toto zařízení, bez synchronizace přes iCloud, po prvním odemčení), Android
  Keystore (AES-GCM) – `@aparajita/capacitor-secure-storage`. Android zálohování a přenos dat aplikace vypnuté.
- **Data:** IndexedDB jako ve Windows (stejné živé dotazy rozhraní). iOS ale smí data WebView při nedostatku místa
  smazat, proto nová vrstva jádra `DurableStore` zrcadlí do souborů aplikace všechno, co ještě není na serveru:
  - neodeslané a odmítnuté úpravy;
  - fotky čekající na nahrání;
  - údaje spárování (bez tokenu).

  Při startu zrcadlo obnoví, co v IndexedDB chybí. Data závodu se pak stáhnou znovu.
- **Síť:** server závodu v interní síti jede přes http. Na Androidu jsou proto povolené nešifrované spoje a smíšený
  obsah WebView. Na iOS je povolená místní síť (ATS) s dotazem na přístup k místní síti. Aplikace dál upozorní,
  že http není šifrované.
- **Připomenutí synchronizace:** místní oznámení 24 h po poslední úplné synchronizaci (požadavek „každodenní
  synchronizace v offline režimu“). Synchronizace se spustí při otevření aplikace, návratu do popředí, připojení
  k síti a ručně.
- **Fotky a dokumenty:** fotka fotoaparátem telefonu nebo z galerie. Dokument se otevře v systémové aplikaci
  (PDF, výkres, návod).
- **Telefonní rozvržení:** spodní lišta (Přehled, Skenovat, Úpravy, Nastavení), dialogy jako spodní panely,
  bezpečné okraje displeje a systémové tlačítko Zpět (Android). Na tabletu a ve Windows zůstává dosavadní rozvržení.

## Rozsah

1. **Aplikace `apps/client`:**
   - přejmenování z `apps/desktop` (Windows beze změny chování, stejné `appId` a data);
   - Capacitor 8, `capacitor.config.ts` (`cz.eldock.app`), projekty `android/` a `ios/` s nastavením:
     oprávnění, odkazy `eldock://`, síť, zálohy, ikony;
   - most platformy, skener QR, fotky, otevření souboru, síť, návrat do popředí, Zpět, oznámení, zrcadlo fronty;
   - rozhraní pro telefon, párování naskenováním QR z webu (i ve Windows webkamerou).
2. **Jádro `src/sync-client/durable.ts`:** zrcadlo fronty, fotek a údajů spárování s obnovou (testy ve Vitestu).
3. **Web:** karta „Aplikace a zařízení“ – texty pro mobilní aplikace (odkaz „otevřít a spárovat“ i v telefonu).
4. **Sestavení:**
   - Android zkušební APK (podepsané ladicím klíčem, instalace mimo Google Play);
   - iOS projekt připravený pro Xcode (sestavení jen na Macu, ruční workflow GitHub Actions pro simulátor);
   - instalátor pro Windows jako dosud.
5. **Testy:**
   - jádro (zrcadlo a obnova, odeslání obnovené úpravy na server);
   - E2E v telefonním rozvržení proti E2E serveru;
   - E2E Android v emulátoru (APK, spárování odkazem `eldock://`, offline úprava, obnova fronty po smazání
     dat WebView, výsledek na webu);
   - E2E aplikace pro Windows a serveru závodu po přejmenování.

**Mimo rozsah:**
- vydání v App Store a Google Play a podpis vydání (účty Eldock s.r.o., D-U-N-S);
- push oznámení a synchronizace na pozadí (iOS BGTask, Android WorkManager);
- univerzální odkazy https (`apple-app-site-association`, `assetlinks.json`);
- záměrné čtečky v průmyslových telefonech přes intent (čtečka jako klávesnice funguje dál);
- revize VTZ z aplikace.

**Hotovo když:**
- `npm run verify` je zelené, stejně jako typy a lint aplikace;
- jsou zelené testy jádra, E2E v telefonním rozvržení, E2E Android v emulátoru a E2E fází 71 a 72;
- APK je sestavené a instalátor pro Windows sestavený;
- `docs/SYNC_API.md` a `CLAUDE.md` jsou doplněné.
