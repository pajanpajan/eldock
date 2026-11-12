# Zadání fáze 107 – kontaktní a zpětnovazební hub: hlášení chyb s printscreenem (Ctrl + V), tipy, schůzky, spolupráce, B2B a QR štítky, stránka /kontakt a velín „📬 Zprávy, Chyby & Schůzky“

Vloženo z chatu 2026-11-12 (během fáze 106). Celé zadání beze změn je níže, za ním rozhodnutí při implementaci.

## Zadání (z chatu)

Přidáváme do platformy ELDOCK (`https://eldock.cz`) rychlý, intuitivní a odevšad přístupný **Kontaktní a zpětnovazební systém (Feedback, Bug Report & B2B Contact Hub)** s podporou vkládání printscreenů/obrázků (včetně přímého `Ctrl+V` ze schránky).

Zapiš tuto úlohu jako novou fázi do `docs/PLAN.md` a kompletně ji naimplementuj v těchto 5 částech:

================================================================================
ČÁST 1: GLOBÁLNÍ DOSTUPNOST Z KAŽDÉHO MÍSTA NA WEBU (`GlobalContactWidget.tsx` + `/kontakt`)
================================================================================

Zajisti, aby byl kontaktní a zpětnovazební formulář okamžitě po ruce na kterékoliv stránce webu:

1. **Plovoucí akční tlačítko (FAB) v pravém dolním rohu (`src/components/contact/GlobalContactWidget.tsx`):**
   - Vlož do hlavního layoutu (`src/app/layout.tsx`) vkusné, kompaktní plovoucí tlačítko v pravém dolním rohu (`💬 Nápověda, Chyby & Kontakt`), které nepřekáží při kreslení v 2D půdorysu ani v AI Panel Builderu (v editorech má kompaktní režim pilulky).
   - Po najetí nebo kliknutí umožní buď rovnou otevřít hlavní modal, nebo jedním klikem vybrat rychlou akci:
     * `🐛 Nahlásit chybu (+ Printscreen)`
     * `💡 Tip na zlepšení / Chybí prvek`
     * `📅 Sjednat osobní schůzku / Demo`
     * `🤝 Spolupráce & B2B poptávka`
2. **Napojení na stávající tlačítka v hlavičce a patičce:**
   - Stávající tlačítko `Nahlásit chybu AI` v horní liště AI Panel Builderu a 2D Půdorysu napoj přímo na tento nový modal s předvybranou kategorií `🐛 Nahlásit chybu` a automaticky načteným ID aktuálního projektu!
   - Do hlavní horní navigace, na prezentační stránku `/prezentace` a do patičky přidej odkaz `Kontakt & Spolupráce`.
3. **Samostatná veřejná stránka `/kontakt` (`src/app/kontakt/page.tsx`):**
   - Přidej `/kontakt` do `publicPaths` v `middleware.ts` a do `sitemap.ts`.
   - Na stránce `/kontakt` zobraz tento interaktivní formulář naplno spolu s přímými kontaktními údaji (Pavel Janoušek · ELDOCK.cz · možnost osobní schůzky i online ukázky).

================================================================================
ČÁST 2: CHYTRÝ KONTAKTNÍ FORMULÁŘ SE 7 KATEGORIEMI A VKLÁDÁNÍM PRINTSCREENŮ (`ContactFeedbackModal.tsx`)
================================================================================

Navrhni formulář tak, aby jeho vyplnění trvalo maximálně 20 vteřin. Nahoře zobraz **7 přehledných přepínacích dlaždic (Chips)**, které dynamicky přizpůsobí pole formuláře:

1. **`🐛 Hlášení chyby` (Bug Report)**
   - Pole: *Co se stalo / co nefunguje správně?* (textarea), *Váš e-mail nebo telefon (abychom vám dali vědět, až to opravíme)*.
   - **Vložení printscreenu / obrázku (POVINNĚ PODPOROVANÉ!):**
     * Interaktivní zóna **`📷 Přiložit printscreen nebo fotku (až 3 obrázky)`**, která podporuje **3 způsoby vložení**:
       1) **Přímé vložení ze schránky přes `Ctrl + V` (`onPaste` event na celém modalu!)** – uživatel udělá výstřižek obrazovky (`Win + Shift + S` nebo `PrintScreen`), stiskne `Ctrl + V` a obrázek se okamžitě objeví v náhledu!
       2) **Přetažení souboru myší (Drag & Drop)**.
       3) **Kliknutí a výběr souboru z PC / vyfocení mobilem (`<input type="file" accept="image/*" multiple />`)**.
     * Každý vložený obrázek automaticky na klientovi zkomprimuj/zmenši přes HTML5 `<canvas>` (max. šířka `1600 px`, formát `.webp` / `.jpeg` s kvalitou `0.82`), zobraz jeho okamžitý náhled s možností smazání (`×`) a přilož k odesílané zprávě!
   - **Automatická technická diagnostika na pozadí:** Bez nutnosti cokoliv vyplňovat automaticky přilož k hlášení: `currentUrl`, aktivní modul a fázi průvodce (`wizardPhase`), `projectId`, `viewportSize` (`window.innerWidth × window.innerHeight`) a `userAgent`.

2. **`💡 Tip na zlepšení / Chybí mi prvek v katalogu`**
   - Rychlý přepínač podtypu: `[ ✨ Nápad na vylepšení funkce ]` · `[ 📦 Chybí mi konkrétní přístroj / řada v katalogu ]`.
   - Pole pro popis (příp. objednací číslo MPN / výrobce chybějícího prvku) + **stejná zóna pro vložení printscreenu / fotky (`Ctrl + V`, Drag & Drop, Nahrání souboru)**!

3. **`📅 Zájem o osobní schůzku / Živou ukázku`**
   - Volba formy setkání na 1 klik:
     * `[ 🤝 Osobní schůzka (u vás ve firmě / v závodě) ]`
     * `[ ☕ Osobní setkání v regionu (Liberec / Jablonec / Praha) ]`
     * `[ 💻 Rychlá online ukázka (Google Meet / Teams – 20 min) ]`
   - Pole: *Jméno*, *Firma / IČO (s automatickým doplněním z ARESu)*, *Telefon a E-mail*, *Preferovaný termín / poznámka*.

4. **`🤝 Zájem o spolupráci (Partnerství)`**
   - Rychlá volba typu partnera:
     * `[ 🏭 Výrobce rozváděčů – chci vyrábět rozváděče na klíč z ELDOCKu ]`
     * `[ 📐 Externí projektant (Freelancer) – chci překreslovat schémata a Červenky ]`
     * `[ 🔍 Revizní technik – spolupráce na revizích a kusových zkouškách ]`
     * `[ 📦 Velkoobchod / Výrobce elektro / Školitel ]`
   - Pole: *Jméno / Firma (IČO s ARESem)*, *E-mail*, *Telefon*, *Krátká zpráva (region, kapacity, používaný CAD)*.

5. **`🏢 Poptávka pro závod, obchodní centrum nebo nemocnici (B2B)`**
   - Rychlé zaškrtávací štítky zájmu: `[ 🏭 Správa rozváděčů a strojů ]`, `[ 🏢 Převod BIM (.ifc) modelu ]`, `[ 🛍️ Obchodní centrum (BD4) ]`, `[ 🏥 Nemocnice / Klinika ]`, `[ 📋 Kniha revizí ]`.
   - Pole: *IČO / Název organizace*, *Kontaktní osoba*, *E-mail a telefon*.

6. **`🏷️ Objednávka / Vzorky odolných QR štítků ELDOCK`**
   - Rychlá volba: `[ 🎁 Chci zaslat vzorkovou sadu stříbrných QR štítků ]` · `[ 📦 Poptávám tisk série QR štítků pro naši firmu ]` (Spotřebiče 30×15 mm / Rozváděče 50×25 mm / Stroje 70×40 mm).
   - Pole: *Firma / Jméno*, *Adresa doručení / E-mail / Telefon*, *Odhadovaný počet ks*.

7. **`⚡ Rychlá poradna k projektu / Normě ČSN`**
   - Když si uživatel potřebuje rychle poradit s rozpracovaným půdorysem, rozváděčem nebo normou – automaticky přiloží odkaz na aktuálně otevřený projekt + možnost vložit printscreen (`Ctrl + V`).

================================================================================
ČÁST 3: BACKEND API, UKLÁDÁNÍ PRINTSCREENŮ A NOTIFIKACE (`/api/contact`)
================================================================================

1. Vytvoř API endpoint `POST /api/contact` (a `GET / PATCH /api/contact` pro superadmina):
   - Ulož každou přijatou zprávu do perzistentního úložiště (databáze / strukturovaný JSON registr `data/contact-submissions.json` + uložené obrázky printscreenů do `public/uploads/feedback/` nebo base64/souborového úložiště), aby se žádná zpráva ani printscreen nikdy neztratily!
   - Pokud je v `.env` nastavený SMTP / Resend / webhook, odešli okamžitou notifikaci majiteli; současně zprávu ihned zobraz v `/superadmin`.
   - Po odeslání zobraz uživateli čisté potvrzení s číslem tiketu (např. `č. #EL-1042`) a informací, že se mu ozveme.

================================================================================
ČÁST 4: SPRÁVA ZPRÁV, CHYB A PRINTSCREENŮ V `/superadmin`
================================================================================

Do administrace `/superadmin` přidej přehlednou záložku **`📬 Zprávy, Chyby & Schůzky`** (s červeným odznakem počtu nepřečtených zpráv v horní liště `/superadmin`):
1. Rychlé filtry podle typu: `[ Vše ]` · `[ 🐛 Chyby ]` · `[ 💡 Tipy na zlepšení ]` · `[ 📅 Schůzky & B2B ]` · `[ 🤝 Spolupráce ]` · `[ 🏷️ QR Štítky ]`.
2. U každé zprávy zobraz:
   - Datum a čas, kategorii, kontaktní údaje (Jméno, Firma z ARESu, E-mail, Telefon – s klikacím `mailto:` a `tel:`),
   - Přesnou URL adresu a fázi projektu, odkud uživatel zprávu poslal (s klikacím odkazem pro otevření daného projektu!),
   - **Velké náhledy přiložených printscreenů** (po kliknutí se otevřou přes celou obrazovku v Lightboxu!),
   - Přepínač stavu: **`[ 🔴 Nové ]` ➔ `[ 🟡 V řešení ]` ➔ `[ 🟢 Vyřešeno ]`** a pole pro interní poznámku.

================================================================================
ČÁST 5: TESTY, VERIFIKACE A NASAZENÍ NA PRODUKCI
================================================================================

1. Napiš unit a integrační testy ověřující:
   - Že endpoint `POST /api/contact` přijme zprávu ve všech kategoriích včetně přiloženého obrázku (printscreenu) a technických metadat (`currentUrl`, `projectId`) a uloží ji.
   - Že stránka `/kontakt` vrací status `200 OK` bez nutnosti přihlášení.
   - Že plovoucí tlačítko i tlačítko `Nahlásit chybu` v horní liště editoru otevře modal s možností vložit printscreen přes `Ctrl+V` nebo nahrání souboru.
2. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` a `CLAUDE.md`, udělej commit a rovnou vše pushni a nasaď na produkční server `https://eldock.cz`.

## Rozhodnutí při implementaci

**Data:** tabulka `ContactMessage` (migrace `phase107_contact_messages`) – číslo tiketu `ticket` (od 1001 → „#EL-1001“),
kategorie `BUG | IDEA | MEETING | PARTNER | B2B | QR | ADVICE`, podtyp, stav `NEW | IN_PROGRESS | RESOLVED`, kontakty,
text, podrobnosti, diagnostika a printscreeny (JSON), interní poznámka, přečteno, výsledek notifikace. Čisté funkce
v `src/lib/contact.ts` (kategorie, schéma zod, filtry, diagnostika z adresy, text notifikace), služby
v `src/server/services/contact.ts`.

**1. Dostupnost odevšad:**

- `GlobalContactWidget` v `src/app/layout.tsx`:
  - plovoucí tlačítko „💬 Nápověda, Chyby & Kontakt“ vpravo dole;
  - najetí myší ukáže 4 rychlé akce a „Otevřít formulář“, klik otevře hlavní formulář (dotykem: 1. klepnutí nabídka);
  - v editorech (2D půdorys, kroky rozváděče) kompaktní pilulka 💬 nad lištou „Další krok“;
  - na mobilu kulaté 💬 nad pevnými spodními lištami (žádanka o změnu, hromadná revize), klepnutí ukáže nabídku –
    najetí se počítá jen myší (dotyk vyvolá i „mouseenter“);
  - dokud je vidět lišta cookies, tlačítko je nad ní (výška lišty v proměnné CSS `--consent-banner-h`
    z `CookieConsentBanner`) – lištu ani její tlačítka nepřekrývá (doplněno po nasazení, na produkci lišta tlačítko
    zakrývala).
- Modal se otevírá i událostí okna (`openContactModal` v `contact-events.ts`) – bez sdíleného kontextu Reactu.
- „🐛 Nahlásit chybu AI“ v hlavičce rozváděče otevře modal s kategorií Hlášení chyby a ID projektu. Hlášení
  přihlášené firmy k vlastnímu projektu jde i do „Hlášení chyb AI a fotky“ (fáze 50, snímek lišt). Starou akci
  `reportAiFeedbackAction` nahradil `POST /api/contact`.
- 2D půdorys má v liště průvodce i v kompaktní liště tlačítko „🐛 Nahlásit chybu“ a hlásí id půdorysu a fázi
  (`useContactPageContext`).
- Odkaz „Kontakt & Spolupráce“ je v hlavní navigaci (místo kotvy `/#kontakt`), v patičce, v liště `/prezentace` a jako
  „📅 Sjednat schůzku / online ukázku“ v kontaktní sekci úvodní stránky.
- `/kontakt` (`src/app/kontakt/page.tsx`):
  - veřejná (`PUBLIC_PATHS` v `src/proxy.ts` – v Next.js 16 je middleware `proxy.ts`), v sitemap přes `PUBLIC_PAGES`;
  - formulář naplno (`?kategorie=MEETING` apod. předvybere kategorii), Ctrl + V kdekoli na stránce;
  - přímý kontakt „Pavel Janoušek · ELDOCK.cz · možnost osobní schůzky i online ukázky“, e-mail z patičky webu,
    regiony a online ukázka, typy partnerství, JSON-LD `ContactPage`.

**2. Formulář (`ContactFeedbackModal.tsx` – `ContactForm` pro modal i stránku):**

- 7 dlaždic přepíná pole: chyba, tip / chybějící prvek (✨ / 📦 + MPN), schůzka (3 formy), spolupráce (4 typy),
  B2B (5 štítků zájmu), QR štítky (vzorky / série, 3 velikosti, adresa, počet ks), poradna.
- U chyby, tipu a poradny jedno pole „e-mail nebo telefon“ (rozpozná se samo) – vyplnění do 20 vteřin.
- IČO doplní název firmy z ARES (`/api/ares`).
- Printscreeny (jen u chyby, tipu a poradny – podle zadání):
  - `onPaste` na celém obsahu modalu, na stránce `/kontakt` posluchač celé stránky;
  - přetažení myší a `<input type="file" accept="image/*" multiple>`, max. 3, náhledy s ×;
  - zmenšení v prohlížeči přes canvas (max. 1600 px, WebP, kde ho prohlížeč nezakóduje JPEG, kvalita 0,82).
- Technická diagnostika (adresa, modul a krok průvodce, projekt, okno, prohlížeč):
  - přiloží se sama, u chyby a poradny ji formulář ukáže (transparentnost);
  - modul a krok se berou z tlačítka, z editoru nebo z adresy (`contextFromPath`);
  - poradna přiloží odkaz na otevřený projekt.
- Potvrzení „č. #EL-1042“ s informací, kam se ozveme. Skryté pole proti robotům.

**3. Backend `/api/contact`:**

- `POST` (veřejné):
  - multipart `payload` + `images`, nebo JSON; kontrola hlavičky Origin;
  - limit 10 zpráv / min / IP v proxy (kbelík `contact`), max. 3 obrázky po 3 MB;
  - vyplněná past na roboty → 202 bez uložení;
  - server každý obrázek znovu zakóduje přes sharp do WebP (max. 1600 px, bez metadat – i GPS z fotek mobilem) do
    `storage/uploads/feedback` (nová složka `UPLOAD_KINDS` – zálohuje se se soubory) a zapíše do registru souborů bez
    firmy (`COMPANY` bez `companyId` → čte ho jen velín přes `/api/files`).
- `GET` / `PATCH` jen s cookie velínu (PATCH i s kontrolou Origin).
- Notifikace majiteli až po odpovědi (`after`), výsledek se zapíše ke zprávě:
  - SMTP (`ELDOCK_SMTP_URL`, odpověď rovnou odesílateli přes Reply-To);
  - Resend (`ELDOCK_RESEND_API_KEY`) a webhook (`ELDOCK_CONTACT_WEBHOOK_URL` – Slack / Teams / Discord);
  - příjemce `ELDOCK_CONTACT_NOTIFY_EMAIL`, jinak kontaktní e-mail z patičky (`.env.example`).
- Potvrzovací e-mail odesílateli se neposílá – formulář by jinak šel zneužít k rozesílání e-mailů na cizí adresy.
- `sharp` je i ve standalone výstupu `/api/contact` (`outputFileTracingIncludes`).

**4. Velín:**

- Záložka „📬 Zprávy, Chyby & Schůzky“ s červeným odznakem nepřečtených (v liště záložek i v horní liště velínu
  „📬 Zprávy“).
- Filtry Vše / Chyby (+ poradna) / Tipy / Schůzky & B2B / Spolupráce / QR štítky s počty.
- Karta zprávy:
  - tiket, datum, kategorie a podtyp, text a podrobnosti;
  - kontakty s `mailto:` (předmět „Re: #EL-…“) a `tel:`, firma s IČO;
  - stránka a modul s krokem, odkaz na projekt, okno a prohlížeč, stav notifikace;
  - velké náhledy printscreenů → lightbox přes celou obrazovku (šipky, Esc);
  - stav 🔴 Nové ➔ 🟡 V řešení ➔ 🟢 Vyřešeno, interní poznámka, přečteno / nepřečteno, „Označit vše jako přečtené“.

**Ochrana osobních údajů:** zásady 1.5:

- kontaktní formulář v částech 2, 3, 4 a 6 a nová část 7c (kdo zprávu vidí, printscreeny bez metadat, diagnostika);
- retence: vyřízená zpráva i s printscreeny 2 roky od vyřízení – maže denní retence (`pruneContactMessages`), soubor
  i registr.
- Text čeká na kontrolu právníkem (stejně jako verze 1.4).

**Odchylky:**

- Místo strukturovaného JSON `data/contact-submissions.json` databáze (zálohuje se denně).
- Místo veřejného `public/uploads/feedback/` soukromé úložiště `storage/uploads/feedback`, protože printscreeny mohou
  obsahovat osobní údaje.
- Plovoucí tlačítko není na `/kontakt` (formulář je na stránce), ve velínu a na `/prezentace` – na projektoru by
  překrývalo slidy, odkaz „Kontakt & Spolupráce“ je v liště prezentace.
- Odkaz na projekt ve velínu otevře projekt jen přihlášeným do firmy, které projekt patří (velín projekty firem
  neotevírá).

**Testy:**

- `src/lib/phase107.test.ts` (6): kategorie a filtry, schéma všech kategorií, tiket a text notifikace, diagnostika
  z adresy, `/kontakt` a `/api/contact` bez přihlášení přes proxy, sitemap / navigace / patička, limit, složka
  feedback, zásady 1.5.
- `src/server/services/phase107.test.ts` (5):
  - `POST /api/contact` ve všech 7 kategoriích s printscreenem a metadaty (tikety #EL-1001…1007, WebP 1600 px, registr
    jen pro velín);
  - odmítnutí (formulář, 4 obrázky, podvržený soubor, cizí web), past na roboty;
  - hlášení chyby AI k projektu firmy;
  - notifikace SMTP / Resend / webhook i selhání;
  - velín GET / PATCH a retence 2 roky.
- E2E `e2e/phase107.spec.ts` (6):
  - `/kontakt` 200 bez přihlášení s Ctrl + V na stránce a schůzkou;
  - plovoucí tlačítko → rychlá akce → Ctrl + V v modalu + 2 soubory, zmenšení na 1600 px, × a tiket;
  - mobil 375 px: kulaté tlačítko nad spodními lištami, klepnutí → nabídka → schůzka;
  - nový návštěvník: tlačítko nad lištou cookies, rychlá akce funguje, „Odmítnout vše“ volné;
  - „Nahlásit chybu AI“ a „🐛 Nahlásit chybu“ v 2D půdorysu s ID projektu a krokem;
  - velín s odznakem, lightboxem, stavem a poznámkou.
- Upravené E2E `phase50` (hlášení chyby AI přes modal) a `phase54` (menu → `/kontakt`).
