Na základě testování obrazovky "1. Návrh osazení" (Konfigurátor prvku + 2D vektorové plátno) provedeme 4 klíčová vylepšení UX a inženýrské logiky. Uprav příslušné komponenty následovně:

### 1. EDITOVATELNÉ ŠTÍTKY FUNKCÍ + CHYTRÉ PRESETY (v sekci "Funkce / Popis obvodu")
- Ze současných statických tlačítek (`Hlavní vypínač`, `Chránič 1`, `Chránič 2`, `Světla`, `Zásuvky`, `Kuchyně`, `Koupelna`, `Varná deska`, `Trouba`, `Myčka / Pračka`, `Bojler / TČ`, `Topení`, `Venek / Garáž`) udělej plně editovatelný systém uložený v `localStorage` (a synchronizovatelný do DB):
  1. Na konec seznamu přidej tlačítko `+ Přidat vlastní` a přepínač `✎ Upravit štítky`.
  2. V režimu úprav umožni štítky přejmenovat, smazat, měnit jejich pořadí a nastavit každému štítku volitelný **Smart Preset** (výchozí kategorii, počet pólů, charakteristiku a proud – např. kliknutí na `Varná deska` může automaticky nastavit `Jistič -> 3P (3M) -> B -> 16A`, kliknutí na `Chránič` přepne kategorii B na `Chránič`).
  3. Přidej automatické číslování: pokud v rozváděči už existuje prvek s popisem `Chránič 1` nebo `Světla 1`, další kliknutí automaticky nabídne `Chránič 2` / `Světla 2`.

### 2. REDESIGN PRAVÉHO PANELU – PŘESUN VÝSLEDNÉHO MODULU NAHORU (STICKY BAR)
- Současná karta `D. PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ` je příliš dole a vyžaduje dlouhé scrollování.
- Proveď tyto UX úpravy pravého sloupce (`Konfigurátor prvku`):
  1. Slouč duplicitní sekce `PŘIŘAZENÝ PŘÍSTROJ` a `D. PŘIŘAZENÝ PŘÍSTROJ K OSAZENÍ` do jedné kompaktní **Sticky karty nahoře** (hned pod řádkem s označením `-F4` / `Ověřeno` a polem `Funkce / Popis obvodu`), aby byla neustále viditelná přímo vedle DIN lišt na levém plátně.
  2. Pokud je na plátně vybraný existující přístroj (např. `-F4`), změny parametrů v sekcích A, B, C1–C4 musí okamžitě aktualizovat vybraný prvek na DIN liště v reálném čase (Live Sync).
  3. U tlačítka `+ Vložit na aktivní lištu (1x / +3x / +6x)` přidej chytrou logiku: pokud je aktivní lišta plná (např. `Lišta 2 - volno 0 M`) nebo se tam přístroj o šířce `4M` nevejde, tlačítko automaticky nabídne `Vložit na Lištu 1 (volno 7 M)` nebo `+ Přidat novou lištu a vložit`.
  4. Sekci `C5. ŠÍŘKA V MODULECH (RUČNĚ)` a pole `Exotický prvek – text z čela přístroje` zabal do rozbalovacího akordeonu `Pokročilé / Ruční korekce a AI dohledání`, čímž se pravý panel zkrátí o třetinu.

### 3. FUNKCE "PROSTŘEDÍ A VNĚJŠÍ VLIVY" (dle ČSN 33 2000-5-51 ed. 3)
- Do horní lišty nad plátnem (vedle informace o skříni `J4 - Nástěnný rozváděč - IP 41` a tlačítka `Výběr skříně rozváděče`) přidej selektor **Prostředí instalace**:
  1. `Interiér – Byt / Technická místnost (Suché - AA5/AD1)` -> min. IP 20/30, T_amb = 25 °C.
  2. `Garáž / Dílna / Sklep (Vlhkost a prach - AD2/AE4/AG2)` -> min. IP 44/54, min. IK 07, T_amb = 25 °C.
  3. `Venkovní prostředí / Fasáda / FVE (Déšť a UV - AA4/AD4/AN2)` -> min. IP 54/65, vyžaduje UV stabilní skříň, T_amb = -25 až +40 °C.
  4. `Dřevostavba / Hořlavý podklad (CA2/CB1)` -> skříň se zkouškou žhavou smyčkou 850 °C + doporučení AFDD.
  5. `Kotelna / Střídačovna FVE / Průmysl (Zvýšená teplota - AA6)` -> nastaví výchozí teplotu okolí pro výpočet oteplení na 35 °C a započítá teplotní derating jističů.
- Pokud aktuálně zvolená skříň (např. `IP 41`) nevyhovuje zvolenému prostředí (např. `Garáž` nebo `Venek`), zobraz v horní liště varovný odznak s tlačítkem `Vybrat vhodnou skříň (min. IP 54)`.

### 4. INTEGROVANÝ "ELEKTRO-LINTER" (KONTROLA CHYB A NOREM V REÁLNÉM ČASE)
- Vytvoř validační modul `validateSwitchboardState()`, který při každé změně zkontroluje rozváděč a zobrazí chyby (červeně) a varování (oranžově) s tlačítkem `[Opravit 1 klikem]`:
  1. **Kontrola štítku vs. kategorie přístroje:** Upozorni, pokud má prvek v názvu/štítku "Chránič", ale jeho kategorie je `Jistič` (jako u `-F1` na Liště 1), nebo pokud má štítek "Hlavní vypínač", ale je to `1P` jistič.
  2. **Kontrola souladu popisu a počtu pólů:** Upozorni, pokud text popisu obsahuje `3P` (např. `Jistič 3P B16 6 kA`), ale prvek má nastaveno `4P (4M)` (jako u `-F4` na Liště 2). Nabídni tlačítko pro automatickou synchronizaci textu s parametry.
  3. **Kontrola proudových chráničů (ČSN 33 2000-4-41):** Upozorni, pokud jsou v rozváděči okruhy `Zásuvky`, `Koupelna`, `Kuchyně`, `Venek / Garáž` a v rozváděči není osazen žádný `Chránič` ani `Jističochránič`, nebo pokud na jeden chránič připadá více než 6 koncových okruhů.
  4. **Kontrola rezervy modulů a kompatibility na liště:** Upozorni, pokud volná rezerva skříně klesne pod 20 % (dle ČSN EN 61439), nebo pokud jsou na jedné DIN liště vedle sebe smícháni různí výrobci (např. ABB + Eaton), které nelze propojit společnou hřebenovou lištou.
  5. **Kontrola jmenovitých proudů:** Upozorni, pokud je jmenovitý proud podružného jističe nebo chrániče nevhodně dimenzován vůči hlavnímu vypínači `-Q1`.

Po implementaci zkontroluj překlad přes `npx tsc --noEmit` a ověř funkčnost v prohlížeči.

