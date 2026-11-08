# Zadání fáze 67 – účty zaměstnanců firem a zabezpečení přihlášení (2026-11-08)

**Zdroj:** chat 2026-11-07 (roadmapa schválená s fází 66, viz `ZADANI-faze-66.md`) a pokyn „pokračuj“ 2026-11-08.
Uživatel: „Potom se musíme pustit do registrace firem, hlavně zabezpečení, ukládání jejich dat a synchronizaci napříč
zaměstnanci ve firmě.“ Roadmapa: 67 firmy, uživatelé a zabezpečení · 68 data a provoz (zálohy, GDPR, úložiště souborů) ·
69 synchronizační API · 70 aplikace pro Windows a server závodu · 71 mobilní aplikace.

## Stav před fází 67 (prověrka kódu 2026-11-08)

- Registrovaná firma Správy závodů má **jedno heslo pro všechny zaměstnance** (`RegisteredCompany.passwordHash`);
  podúčty vznikají bez hesla a přihlašují se heslem firmy. Žádné pozvánky, obnova ani změna hesla.
- Přihlášení: bez limitu pokusů, hláška „Účet s tímto e-mailem neexistuje“ prozradí existenci účtu, bezstavový token
  12 h nejde odvolat (odchod zaměstnance, ztráta telefonu), žádné dvoufázové ověření, žádný záznam přihlášení.
- **Díra v oddělení firem:** nepodepsaná cookie přepínače účtů (`digitry-account`) vybere i uživatele registrované
  firmy (stačí znát jeho id) a `setAccountType` („Přepnout na …“) bere prvního uživatele daného typu bez ohledu na
  firmu – držitel sdíleného hesla obchodního dema se tak teoreticky dostane do účtu firmy.
- Serverové akce nad daty závodu (karta zařízení, změny, provizoria, závady, životnost, Studio, import) nekontrolují,
  že zařízení patří do závodu přihlášeného uživatele (stránky ano – `plantAccessWhere`).
- Soubory `/api/files` nemají vlastníka (UUID jména) – izolace souborů a registr úložiště patří do fáze 68
  (Panel Builder sdílí soubory se závody přes propuštěný pasport).

## Úkoly fáze 67

1. Vlastní heslo každého uživatele registrované firmy (`User.passwordHash`); migrace převezme heslo firmy, ostatní
   zaměstnanci si ho při prvním přihlášení změní (`mustChangePassword`). Pravidla hesla: aspoň 10 znaků, ne e-mail
   ani jméno, ne běžná hesla.
2. Pozvánka zaměstnance (odkaz na nastavení hesla, 7 dní) a obnova hesla (odkaz 1 h) – e-mailem přes `ELDOCK_SMTP_URL`,
   bez SMTP odkaz zobrazí správce firmy (a zapíše se do logu serveru). Odpověď „Zapomenuté heslo“ je vždy stejná.
3. Relace na serveru (`UserSession`): odhlášení zruší relaci, „Můj účet“ ukáže přihlášená zařízení s odhlášením
   jednotlivě i všude jinde, správce firmy zablokuje účet nebo odhlásí zaměstnance ze všech zařízení.
4. Ochrana přihlášení: stejná hláška pro neznámý e-mail i špatné heslo, limit neúspěšných pokusů na e-mail a IP
   (zablokování na 15 minut), bezpečnostní deník firmy (přihlášení, chyby, změny hesla, pozvánky, blokace).
5. Dvoufázové ověření TOTP (aplikace Authenticator) s 8 záložními kódy, tajemství šifrované klíčem aplikace.
6. Oprava oddělení firem: cookie přepínače a „Přepnout na …“ jen demo účty; serverové akce nad daty závodu ověří
   přístup k zařízení / závodu.
7. Testy (pravidla hesla, TOTP, relace, limit pokusů, oddělení firem nad SQLite) a E2E (pozvánka → nastavení hesla →
   přihlášení, blokace po chybných pokusech, dvoufázové ověření, obrana proti podvržené cookie účtu).

**Mimo rozsah:** izolace souborů a registr úložiště, zálohy, export a výmaz dat firmy (fáze 68); dlouhé relace zařízení
pro aplikace (fáze 69–71); Panel Builder zůstává u přihlášení firmy (jedno heslo), dostane jen stejná pravidla hesla.
