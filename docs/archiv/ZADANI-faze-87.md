# Zadání fáze 87 – video-návody s českým komentářem pro testery (2026-11-10)

Zadání z chatu (pro prvního testera – elektrikáře): dva ozvučené české video-návody (.mp4) vygenerované automaticky
nad běžící aplikací a jejich integrace do aplikace i na veřejnou stránku.

## 1. Generátor video-návodů s českým hlasovým komentářem (`scripts/generate-tutorials.mjs`)

Playwright s `recordVideo` ve Full HD 1920 × 1080, české neuronové TTS (`edge-tts` s hlasem `cs-CZ-AntoninNeural`,
případně `node-gtts` / lokální syntéza) a `ffmpeg` / `ffmpeg-static`; dvě reálná instruktážní videa přímo nad aplikací.

Vizuální kvalita (přes `page.addInitScript()`):
- **viditelný animovaný kurzor** – žlutý / červený kroužek s plynulým pohybem `transition: transform 0.35s ease`
  a pulzující vlnou při kliknutí (bezhlavý prohlížeč systémový kurzor nevykresluje);
- **spodní titulková lišta (lower third)** – tmavý poloprůhledný box dole uprostřed se žlutým odznakem kroku
  („KROK 2 / 5 · Výběr výrobce a designové řady“) a přesným přepisem toho, co právě říká hlasový komentář.

Pro každý krok česká MP3 stopa komentáře, změřená délka a pohyb kurzoru, kliknutí a titulek synchronizované na délku
stopy, aby obraz a mluvené slovo seděly.

### Video 1 – `public/tutorials/eldock-2d-pudorys-navod.mp4` („2D Půdorys & Kabeláž“)
1. **Úvod a měřítko** – `/panel-builder/floorplan`, velikost plochy (např. 20 × 16 m), kalibrace měřítka, úroveň
   instalace (klasická 230/400 V / sběrnicová Smart Home / retrofit). *Komentář:* „Vítejte v Eldocku. Ukážeme si, jak
   z půdorysu za pár minut vytvoříte návrh elektroinstalace, výkaz kabelů a hotový rozváděč. Můžete nahrát PDF či DXF
   výkres od stavaře, zkalibrovat měřítko na jednu známou stěnu, nebo kreslit místnosti od nuly na volitelnou plochu až
   sto krát sto metrů.“
2. **Výrobci, designové řady a barvy** – lišta výrobců (ABB, Schneider, Legrand, Hager, Loxone, TapHome), galerie
   řad a barev (ABB Zoni, Tango, Levit M, panely free@home / Loxone / TapHome), změna barvy. *Komentář:* „Nahoře si
   zvolíte výrobce, designovou řadu a barvu přístrojů – například ABB Zoni, Levit M nebo prvky chytré domácnosti ABB
   free at home, Loxone a TapHome. Kdykoliv změníte barvu nebo řadu, program automaticky přepočítá všechna objednací
   čísla strojků, krytů i vícerámečků.“
3. **Rozváděč, zásuvky, světla se stmíváním a koupelnové zóny** – místnosti, rozváděč RH, zásuvky, vypínače, vývod
   žaluzie, okenní čidlo, světlo (Stmívatelné / RGBW), vana a umyvadlo se zónami. *Komentář:* „Do půdorysu nejprve
   umístíte rozváděč a poté z levého menu vkládáte zásuvky, vypínače, žaluzie, čidla a samostatné spotřebiče. Často
   používané prvky a sestavy vícerámečků si můžete připnout hvězdičkou. U světel jednoduše zaškrtnete stmívání nebo
   změnu barvy a v koupelně program automaticky pohlídá ochranné zóny.“
4. **Obvodové trasování kabelů a úprava myší** – trasy po stěnách, posun úseku v ose X / Y, styl vedení (Spodem /
   Vrchem / Optimalizovaně), oko 👁️ u okruhu. *Komentář:* „Kabely se automaticky trasují po obvodu stěn v instalačních
   zónách, takže nikdy nekřižují střed místnosti. Kteroukoliv trasu můžete chytit myší a posunout v ose X nebo Y,
   přepínat vedení v podlaze či podhledu a ikonkou oka si filtrovat viditelnost jednotlivých okruhů.“
5. **Kusovník, export PDF / DXF a generování rozváděče** – kusovník s objednacími kódy, export PDF / DXF, žluté
   tlačítko „Vygenerovat rozváděč z tohoto půdorysu“. *Komentář:* „Na závěr si zobrazíte kompletní kusovník s přesnými
   objednacími čísly a metráží kabelů, vyexportujete výkres do PDF nebo AutoCADu a jedním klikem vygenerujete
   z půdorysu kompletně osazený rozváděč.“

### Video 2 – `public/tutorials/eldock-ai-panel-builder-navod.mp4` („AI Panel Builder – Rozváděč za 3 minuty“)
1. **Založení projektu, 1f / 3f soustava a rozvodnice** – pasport z fotky / videa, od nuly, z půdorysu; soustava
   3× 230/400 V TN-C-S / TN-S nebo 1f 230 V; volitelná kaskáda skříně (výrobce → řada → model). *Komentář:* „V AI Panel
   Builderu vytvoříte výrobní dokumentaci rozváděče za tři minuty. Projekt založíte vyfocením už osazeného rozváděče na
   stavbě, přenosem z půdorysu, nebo od nuly. Zvolíte jednofázovou či třífázovou soustavu a volitelně vyberete přesný
   typ rozvodnice.“
2. **2D osazení na DIN lišty, katalog a sběrnice PE / N** – vektorový rozváděč, přístroj z kaskádového katalogu
   (jističe, chrániče, akční členy chytré domácnosti), lišta sběrnic PE a N (bod rozdělení PEN, nulové můstky N1, N2).
   *Komentář:* „Na interaktivním plátně skládáte přístroje na DIN lišty z katalogu hlavních výrobců včetně akčních
   členů chytré domácnosti. Systém dole automaticky spočítá a vykreslí hlavní ochrannou sběrnici PE, bod rozdělení PEN
   a samostatné nulové můstky pro každý proudový chránič.“
3. **Strom zapojení, vyvážení fází a Elektro-linter** – automatický návrh stromu, fáze L1 / L2 / L3, Elektro-linter
   dle ČSN 33 2130 ed. 4 (oddělení světel od zásuvek, chrániče A / B / F) s opravou na 1 klik. *Komentář:* „Ve druhém
   kroku program sám sestaví strom zapojení a rovnoměrně rozloží zátěž mezi fáze L1, L2 a L3. Vestavěný Elektro-linter
   ihned zkontroluje soulad s normou ČSN 33 2130 edice 4 – pohlídá oddělené chrániče pro světla, zakáže starý typ AC
   a případné chyby opraví jedním klikem.“
4. **Výpočet oteplení dle IEC TR 60890** – tepelná bilance ve wattech, zvolená skříň, graf oteplení. *Komentář:* „Ve
   třetím kroku proběhne normativní výpočet oteplení rozváděče podle ČSN EN IEC 61439 a metodiky IEC TR 60890. Okamžitě
   vidíte součet ztrátových výkonů všech přístrojů, teplotu v horní části skříně a verdikt, zda rozvodnice tepelně
   vyhovuje.“
5. **6listový PDF elaborát, CE štítek a popisky 1:1** – karta zvolené rozvodnice, elaborát (titulní list, osazení,
   1P schéma, kusovník, oteplení, kusová zkouška, vnější vlivy, prohlášení o shodě, CE štítek), arch štítků 1:1.
   *Komentář:* „V posledním kroku si jedním klikem vytisknete kompletní šestilistový PDF elaborát s vaším razítkem:
   výkres osazení, jednopólové schéma, kusovník, protokol o kusové zkoušce, protokol vnějších vlivů, prohlášení o shodě,
   výrobní štítek CE i barevné samolepicí popisky na jističe v měřítku jedna ku jedné.“

## 2. Střih ffmpeg do kompaktního MP4
Natočené video + MP3 komentáře kapitol → `libx264 -pix_fmt yuv420p -crf 23`, `aac -b:a 128k`, `-movflags +faststart`
(prohlížeč, iPhone, WhatsApp) do `public/tutorials/…`; skript `"tutorials:generate": "node scripts/generate-tutorials.mjs"`.

## 3. Veřejná stránka `/navody`
V `publicPaths` brány a v `sitemap.xml`. Hlavička „🎬 Video-návody ELDOCK: Od půdorysu po hotový rozváděč za pár
minut“, Video 1 a Video 2 (HTML5 `<video controls preload="metadata">`, klikací kapitoly 1–5 přetáčí `currentTime`,
„⬇️ Stáhnout video MP4 (pro WhatsApp)“, „🚀 Vyzkoušet 2D Půdorys“ / „⚡ Vyzkoušet AI Panel Builder“) a „📋 Zkopírovat
pozvánku s odkazem pro kolegu elektrikáře“ (zpráva s odkazem na https://eldock.cz/navody do schránky).

## 4. Integrace do aplikace
„🎬 Video-návod“ v horní liště `/panel-builder/floorplan` (modal s videem 1, kapitoly, přepínač živého zvýraznění prvků
– Interactive Tour) a v `/panel-builder` i `/panel-builder/[id]` (modal s videem 2 a kapitolami); odkaz
„🎬 Video-návody (/navody)“ na úvodní stránce vedle vzorového elaborátu.

## 5. Vygenerování, ověření a nasazení
`npm run tutorials:generate`, kontrola existence, velikosti a stop obou MP4, test `/navody` (200 a oba přehrávače),
`npm run verify`, `docs/PLAN.md` a `CLAUDE.md`, commit, push a nasazení na https://eldock.cz.

## Rozhodnutí a odchylky od zadání (fáze 87)
- **Hlas:** Edge TTS `cs-CZ-AntoninNeural` přes npm `node-edge-tts` (bez instalačních skriptů). `msedge-tts` nejde –
  jeho publikovaný `preinstall: npx only-allow pnpm` by v Docker buildu (npm 10) shodil `npm ci`. Text komentáře jde
  na službu Microsoftu (veřejný text stránky); `--tts=local` použije lokální český hlas Windows (Microsoft Jakub,
  OneCore) bez odesílání ven – při výpadku Edge TTS na něj generátor přejde sám. Zkratky a čísla norem mají vlastní
  výslovnost (`say` v `src/lib/tutorials.ts`), titulky ukazují zápis ze zadání.
- **ffmpeg:** binárky Remotionu (`@remotion/compositor-*`, už v závislostech), případně `FFMPEG_PATH` nebo
  `ffmpeg-static`, když je nainstalovaný. `ffmpeg-static` se nepřidal – stahuje binárku instalačním skriptem (blokuje
  `allowScripts`, zdržel by Docker build). Playwright pro `recordVideo` potřebuje vlastní ffmpeg (`npx playwright install ffmpeg`).
- **Video 2 podle skutečné aplikace:** kroky Panel Builderu jsou 1. Návrh a osazení, 2. Zapojení, 3. Skříň,
  4. Oteplení, 5. Dokumentace. Elektro-linter je v kroku 1 a lišta sběrnic PE / N se kreslí ve stromu kroku 2 – věta
  o linteru se proto přesunula do kapitoly 2 a věta o sběrnicích do kapitoly 3 („Systém dole…“ → „Zároveň spočítá…“,
  sběrnice jsou při přívodu shora nad lištami); kapitola 4: „Ve třetím kroku potvrdíte skříň rozváděče a ve čtvrtém
  proběhne normativní výpočet oteplení…“.
- **Video 1:** místnosti se kreslí během úvodní věty, kalibrace je ukázaná na nástroji (bez nahraného výkresu),
  přepnutí úrovně instalace je v kapitole 2 u chytré domácnosti (sběrnicová úroveň), umyvadlo vynecháno kvůli délce
  kapitoly (zóny ukazuje vana).
- **Střih:** CRF 23 s `-preset veryslow -tune animation` (o ~10 % menší soubor), klíčové snímky na začátcích kapitol,
  poster JPEG; časy kapitol zapisuje generátor do `src/lib/tutorials.generated.ts`.
