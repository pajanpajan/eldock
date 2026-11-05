Implementujeme Fázi 50: "SuperAdmin velín (/superadmin), samoobslužné dobíjení kreditů s českou QR platbou (SPD) a zálohovou fakturou, a systém hlášení chyb AI rozpoznání od testerů".

Zapiš tuto fázi do docs/PLAN.md a kompletně ji naimplementuj v těchto 5 bodech:

1. DATOVÝ MODEL PRO OBJEDNÁVKY KREDITŮ A HLÁŠENÍ CHYB AI (Prisma migrace):
Rozšiř `prisma/schema.prisma` (a vytvoř čistou migraci) o dva modely:
a) Model `CreditOrder` (Objednávky kreditů a tarifů v AI Panel Builderu):
   - `id` (String @id @default(cuid()))
   - `companyId` (String, vazba na `RegisteredCompany`, onDelete: Cascade)
   - `variableSymbol` (String @unique – např. `"20260001"`)
   - `packageCode` (String – `"START_10"` | `"PROFI_30"` | `"UNLIMITED_YEAR"`)
   - `creditsCount` (Int – `10`, `30`, `200`)
   - `priceCzkExclVat` (Int – `990`, `2490`, `5900`)
   - `priceCzkInclVat` (Int – částka s 21% DPH)
   - `status` (enum `CreditOrderStatus`: `PENDING` = Čeká na úhradu, `PAID` = Uhrazeno a kredity připsány, `CANCELLED` = Stornováno) @default(PENDING)
   - `paidAt` (DateTime?), `createdAt` (DateTime @default(now()))
b) Model `AiFeedbackReport` (Hlášení chyb AI rozpoznání a zpětná vazba od testerů):
   - `id` (String @id @default(cuid()))
   - `projectId` (String?, vazba na `PanelBoardProject`, onDelete: SetNull)
   - `companyId` (String?, vazba na `RegisteredCompany`, onDelete: SetNull)
   - `photoUrl` (String? – kopie URL fotky rozváděče v okamžiku hlášení)
   - `detectedSnapshotJson` (String – snímek rozpoznaných lišt a prvků)
   - `message` (String – popis chyby od testera, např. "Špatně rozpoznaný stykač na 2. liště")
   - `status` (String @default("OPEN") – `"OPEN"` | `"RESOLVED"`)
   - `adminNote` (String?)
   - `createdAt` (DateTime @default(now()))

2. SAMOOBSLUŽNÉ DOBÍJENÍ KREDITŮ + ČESKÝ QR KÓD PLATBY (SPD) A ZÁLOHOVÁ FAKTURA:
- V horní liště AI Panel Builderu (`PanelBuilderHeader`) udělej ze žlutého štítku `Kredity: X` klikací tlačítko `[ 🪙 Kredity: X (+ Dobít) ]`. Stejný dialog automaticky otevři, pokud se uživatel s 0 kredity pokusí založit nový projekt.
- Dialog / stránka `/panel-builder/credits` ("Dobít kredity pro AI Panel Builder"):
  * Nabídne 3 jasné balíčky:
    1) **Balíček 10 rozváděčů (`START 10`)** – 10 kreditů · **990 Kč** bez DPH (99 Kč / rozváděč)
    2) **Balíček 30 rozváděčů (`PROFI 30`)** – 30 kreditů · **2 490 Kč** bez DPH (83 Kč / rozváděč – nejoblíbenější)
    3) **Roční neomezený tarif (`PROJEKTANT ROK`)** – 200 kreditů na 12 měsíců · **5 900 Kč** bez DPH
  * Po kliknutí na `[ Objednat balíček ]` se v databázi založí `CreditOrder` s unikátním variabilním symbolem a uživateli se okamžitě zobrazí:
    - **Oficiální český QR kód pro mobilní bankovnictví (formát SPD 1.0)**:
      `SPD*1.0*ACC:${IBAN}*AM:${castka}.00*CC:CZK*X-VS:${vs}*MSG:ELDOCK Kredity ${companyName}` vykreslený přes `qrcode.react` (číslo účtu / IBAN čti z env `ELDOCK_BANK_IBAN` s bezpečným výchozím demo IBANem v `COMPANY_INFO`).
    - Tlačítko **`[ 🖨️ Vytisknout / Stáhnout zálohovou fakturu (PDF) ]`**, které otevře čistou A4 tiskovou sestavu zálohové faktury se všemi fakturačními údaji odběratele (`RegisteredCompany` – název, IČO, DIČ, sídlo), dodavatele (`COMPANY_INFO`), rozpisem DPH 21 % a QR kódem platby.

3. TLAČÍTKO "🐛 NAHLÁSIT CHYBU AI" PŘÍMO V PROJEKTU PANEL BUILDERU:
- V detailu projektu (`/panel-builder/[id]`) přidej do horní lišty tlačítko `[ 🐛 Nahlásit chybu AI ]`.
- Po kliknutí se otevře jednoduchý dialog: *"Našli jste chybu v rozpoznání přístrojů nebo ve schématu? Napište nám krátkou poznámku – pomůžete nám AI dál zpřesnit."*
- Po odeslání se uloží `AiFeedbackReport` včetně odkazu na fotku rozváděče a JSON snímku lišt, a tester dostane poděkování v toastu.

4. TVŮJ OBCHODNÍ A TECHNICKÝ VELÍN `/superadmin`:
- Vytvoř chráněnou sekci `/superadmin` (a přihlášení `/superadmin/login` ověřující heslo z env `ELDOCK_SUPERADMIN_PASSWORD`, s výchozím fallbackem na `ELDOCK_ACCESS_PASSWORD` + podepsanou httpOnly cookie `eldock-superadmin`; uprav `src/proxy.ts`, aby `/superadmin` vyžadoval tuto cookie).
- Stránka `/superadmin` obsahuje 4 přehledné části:
  a) **KPI dlaždice nahoře:** Počet registrovaných firem (Panel Builder / Závody), celkem vygenerovaných rozváděčů, čekající objednávky kreditů (`PENDING` + suma v Kč) a otevřená hlášení chyb AI (`OPEN`).
  b) **Záložka 1 – Registrované firmy a správa kreditů (`RegisteredCompany`):**
     - Tabulka všech firem (Název, IČO, DIČ, město, kontaktní osoba, e-mail, telefon, TIČR, datum registrace, počet projektů, zbývající kredity).
     - Přímo na řádku firmy rychlá tlačítka: `[ +5 kreditů ]`, `[ +10 kreditů ]`, `[ +50 kreditů ]`, pole pro ruční nastavení počtu kreditů a rozbalení všech projektů a fotek rozváděčů dané firmy.
  c) **Záložka 2 – Objednávky kreditů a fakturace (`CreditOrder`):**
     - Seznam objednávek s variabilním symbolem, firmou, balíčkem, částkou a stavem.
     - Tlačítko **`[ ✅ Potvrdit úhradu a připsat kredity ]`**: v jedné transakci přepne objednávku na `PAID`, uloží `paidAt` a automaticky přičte firmě koupený počet kreditů (`creditsRemaining += order.creditsCount`)!
  d) **Záložka 3 – Hlášení chyb AI a fotky od testerů (`AiFeedbackReport`):**
     - Zobrazí každou nahlášenou chybu s náhledem fotky rozváděče (s možností zvětšit a stáhnout originál), zprávou od testera, odkazem na projekt a tlačítkem `[ ✓ Označit jako vyřešené ]`.

5. TESTY A DOKUMENTACE:
- Napiš unit testy pro generátor SPD QR řetězce, schválení objednávky kreditů v transakci (připsání kreditů firmě), uložení AI feedbacku a oprávnění SuperAdminu.
- Přidej E2E test pro objednání kreditů, nahlášení chyby AI a schválení objednávky v `/superadmin`. Spusť `npm run verify`, aktualizuj `docs/PLAN.md` + `npm run docs:bundle` a udělej commit.
