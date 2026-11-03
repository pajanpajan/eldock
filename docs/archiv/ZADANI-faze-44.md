Vytvoř v projektu architektonický a výpočetní modul `src/engine/floorplan-bridge.ts` a dokumentaci `FLOORPLAN_SPEC.md`, který propojí chystaný 2D editor domovní elektroinstalace (půdorys) přímo s naším automatickým návrhářem rozváděčů (AI Panel Builder).

Modul musí implementovat tyto 4 deterministické kroky:

1. KALIBRACE MĚŘÍTKA PŮDORYSU (`calibrateFloorplanScale`):
   - Vstup: 1 nebo 2 referenční stěny z PDF/obrázku se souřadnicemi `[x1, y1, x2, y2]` v pixelech a reálnou délkou v `mm` + souřadnice hlavního rozváděče `[rx, ry]`.
   - Výstup: Přepočtová matice `pxToMm` (pro osu X a Y zvlášť pro kompenzaci zkosených skenů) a funkce `calculateCableLength(node)` počítající ortogonální (Manhattan) délku kabelu k rozváděči včetně svislých instalačních zón dle ČSN 33 2130 ed. 4 (+300 mm zásuvky, +1050 mm spínače, -300 mm stropní trasa) + kontrola úbytku napětí (<= 3 % světla, <= 5 % zásuvky).

2. STAVOVÝ AUTOMAT SVĚTEL A MATICE ŘAZENÍ VYPÍNAČŮ (`resolveSwitchWiring`):
   - Vstup: Počet nezávisle spínaných větví v místě `groups` (1 nebo 2), počet ovládacích míst `switchCount` (1 až N) a zvolený režim instalace (`classic` | `smart_relay` | `bus_loxone`).
   - Výstup v režimu `classic`:
     * G=1, S=1 -> 1x Řazení 1 (jednopólový spínač)
     * G=2, S=1 -> 1x Řazení 5 (sériový lustrový spínač)
     * G=1, S=2 -> 2x Řazení 6 (střídavý přepínač)
     * G=2, S=2 -> 2x Řazení 6+6 / 5B (dvojitý střídavý přepínač)
     * G=1, S=3 -> 2x Řazení 6 + 1x Řazení 7 (křížový přepínač)
     * G=1, S>=4 -> Doporučení: Tlačítka Řazení 1/0 + Impulzní paměťové relé na DIN lištu v rozváděči (např. ELKO MR-41 / CRM-91H).
   - Výstup v režimu `smart_relay` (Shelly Pro / iNELS) a `bus_loxone` (Loxone Tree):
     * Přepne nástěnné prvky na tlačítka / Loxone Touch Tree (s integrovaným termostatem) a vygeneruje požadavek na příslušný počet digitálních vstupů/výstupů (DI/DO) pro světla a žaluzie v rozváděči.

3. NORMATIVNÍ SHLUKOVAČ OKRUHŮ DLE ČSN 33 2130 ed. 4 (`generateCircuitsFromFloorplan`):
   - Rozlišení `single_socket` vs `double_socket`: Pro limit max. 10 zásuvkových vývodů na okruh počítej dvojzásuvku jako 1 vývod, ale do kusovníku (BOM) ulož přesný typ dvojzásuvky.
   - Zásuvky se štítkem (`oven`, `dishwasher`, `washer`, `dryer`, `boiler`, `microwave_builtin` >= 2000 W) vyčleň každou na samostatný jisticí okruh B16A 1P (CYKY-J 3x2.5).
   - Štítek `cooktop_3p` vyčleň na 3f jistič B16A 3P (CYKY-J 5x2.5).
   - Štítek `fridge` vyčleň na samostatný jističochránič RCBO B16A/30mA Typ A (prioritní nevypínaná větev).
   - Štítek `ev_charger` nebo `heat_pump` vyčleň na 3f jistič + Proudový chránič Typ B.
   - Běžné zásuvky bez určení seskup podle blízkosti a místností po max. 10 vývodech na jeden okruh B16A 1P.
   - Světla seskup do světelných okruhů B10A 1P (CYKY-J 3x1.5), vždy min. 2 nezávislé světelné okruhy na dům/byt.

4. AUTOMATICKÝ GENERÁTOR ROZVÁDĚČE A VYVAŽOVÁNÍ FÁZÍ (`buildSwitchboardFromCircuits`):
   - Rozděl 1f okruhy rovnoměrně mezi fáze L1, L2, L3 pomocí hladového algoritmu (Greedy Phase Balancing) podle soudobého příkonu.
   - Rozděl okruhy pod proudové chrániče 30mA Typ A (max. 5 až 6 okruhů na jeden 4P chránič, přičemž světla a zásuvky ze stejné místnosti nesmí viset na stejném chrániči) + ke každému chrániči přidej do kusovníku izolovaný N-můstek a hřebenovou lištu.
   - Přidej hlavní vypínač, svodič přepětí T1+T2, rozbočovací svorkovnici HLAK a (v případě Smart Home režimu) vypočtený počet modulů Loxone (Miniserver + Relay Extension + zdroj 24V DC) nebo Shelly Pro.
   - Sečti celkový počet modulů (`width_modules`), přičti 25% rezervu a vyber z naší databáze odpovídající skříň rozváděče tak, aby splňovala oteplení (`total_power_loss_w <= enclosure.max_heat_dissipation_w`).

Napiš čistý TypeScript kód s plnou typovou kontrolou a přidej jednotkový test, který ověří celý průchod od vzorového rodinného domu až po seznam přístrojů na DIN lištách.

