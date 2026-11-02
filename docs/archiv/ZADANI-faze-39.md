# Zadání fáze 39 – Studio (vloženo uživatelem 2026-11-02)

V modulu Studio (/studio, Krok 2 a Krok 3) provedeme 3 cílená vylepšení vizuálu rastru, editovatelnosti levého menu a sčítání prvků v místnostech. Zapiš je do docs/PLAN.md jako novou fázi a kompletně je naimplementuj:

1. ZJEMNĚNÍ SLOUPŮ V KONSTRUKČNÍM RASTRU (PlanViewport / SVG půdorys):
- Současné plné šedé čtverce v průsečících hlavních os rastru jsou příliš velké a působí rušivě.
- Zmenši symboly nosných sloupů na třetinovou velikost (max. 4×4 px s nízkou krytostí opacity-25) nebo je vykresli jako jemné architektonické středové křížky (+) v barvě rastru, aby nerušily čitelnost místností, popisků a zařízení.

2. EDITOVATELNÉ NÁZVY KATEGORIÍ A VLASTNÍ ŠABLONY V LEVÉM PANELU (Krok 3):
- V Kroku 3 v levém panelu (Sekce 2 "Kategorie zařízení" a Sekce 3 "Vytvořit nové" s dlaždicemi jako Průmyslový vysavač, Kávovar, Chladnička, PC sestava, Prodlužovací přívod...) umožni uživateli upravovat texty a přidávat vlastní šablony:
  a) Přidej do záhlaví Sekce 2 a Sekce 3 přepínač "[ ✏️ Upravit nabídku ]".
  b) V režimu úprav může uživatel přímo přepsat název kterékoliv kategorie nebo šablony (např. změnit "Kávovar / Rychlovarná konvice" na dva samostatné banery "Kávovar" a "Rychlovarná konvice", nebo přejmenovat cokoliv podle zvyklostí své firmy), změnit výchozí prefix Tagu (např. KAV, LED, VYS) nebo šablonu smazat.
  c) Přidej na konec dlaždic tlačítko "[ + Přidat vlastní dlaždici ]", kterým si uživatel uloží nový typ přístroje trvale do nabídky (uloženo do localStorage + databázového nastavení tenantu TenantSetting, aby upravené banery zůstaly zachovány i po obnovení stránky).

3. AUTOMATICKÉ SČÍTÁNÍ POLOŽEK PŘÍMO V MÍSTNOSTECH NA RASTRU I V SEZNAMU "UPRAVIT STÁVAJÍCÍ":
- Přímo na půdorysu v rastru (uvnitř obdélníku každé místnosti, např. "Kancelář 1"):
  * Místo jednoho obecného štítku "14× Spotřebič" vykresli přímo uvnitř místnosti v rastru přehledné seskupené štítky (chips) sečtené podle názvu přístroje!
  * Jakmile uživatel do místnosti nakliká položky, přímo v místnosti v rastru naskakují a sčítají se konkrétní počty, např.:
    [ 🖥️ 7× PC sestava ] [ 🔌 4× Prodlužovací přívod ] [ 🧊 2× Chladnička ] [ ☕ 1× Kávovar ]
  * Stejný seskupený přehled vykresli i do uloženého floorplanSvg, aby byl vidět i na mapě patra mimo Studio.
- V levém panelu v záložce "✏️ Upravit stávající (N)":
  * Seskup shodné položky v dané místnosti podle názvu do přehledných řádků se součtem: např. "🖥️ PC sestava (7×)", "🔌 Prodlužovací přívod (4×)", "🧊 Chladnička (2×)", "☕ Kávovar (1×)".
  * Přímo na každém seskupeném řádku přidej rychlá tlačítka "[ − ]" a "[ + ]" pro okamžité ubrání nebo přidání dalšího kusu stejného spotřebiče/nářadí v této místnosti jedním klikem (s automatickým vygenerováním dalšího Tagu v řadě).
  * Po rozkliknutí seskupeného řádku (chevron dolů) zobraz jednotlivé kusy (SP-0002 až SP-0008), kde lze v případě potřeby upravit individuální Tag, název nebo napájení konkrétního kusu.

Ověř změny přes "npm run verify", aktualizuj testy Studia, udělej commit a vypiš příkazy pro push a deploy na server.
