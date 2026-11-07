# Zadání fáze 64 – půdorys jako uložený projekt na serveru (2026-11-07)

Vzniklo z doporučení v chatu po nasazení fáze 63 (otázka uživatele „Jaká další vylepšení a úpravy bychom měli vyřešit
a implementovat“). Uživatel z nabídky vybral **„Půdorys na serveru“**.

## Zjištění, ze kterých fáze vychází (ověřeno v kódu 2026-11-07)

- Rozpracovaný 2D půdorys je jen v prohlížeči pod jediným klíčem `eldock.pb.floorplan` (`FloorplanEditor.tsx`):
  jeden nákres na prohlížeč, na jiném počítači chybí a smazáním dat prohlížeče se ztratí.
- Po vygenerování rozváděče (`createFloorplanProjectAction`, 1 kredit) se na projekt uloží jen kopie nákresu
  (`PanelBoardProject.floorplanJson`) pro dokumentaci; zpět do editoru se otevřít nedá.
- Editor nemá Zpět / Znovu (Ctrl+Z). `FloorplanEditor.tsx` má 2 535 řádků.

## Doporučení přijaté uživatelem

Seznam půdorysů firmy s průběžným ukládáním na server a historií verzí, otevření půdorysu z hotového projektu
a nové vygenerování rozváděče, převzetí stávajícího nákresu z prohlížeče (aby nikdo nepřišel o práci),
Ctrl+Z / Ctrl+Shift+Z a při tom rozdělení `FloorplanEditor.tsx`.

## Rozpad

1. **Data:** `Floorplan` (firma, název, zákazník, místo, nákres JSON, číslo verze, souhrn pro seznam, vazba na poslední
   vygenerovaný rozváděč, smazání do koše) a `FloorplanVersion` (snímky nákresu s důvodem a popisem). Přírůstková migrace.
2. **Server:** služba a akce s kontrolou firmy (cizí půdorys = nenalezen) – založit, uložit s kontrolou verze, načíst,
   přejmenovat, duplikovat, smazat / obnovit, verze (seznam, ruční uložení, obnovení), převzetí z prohlížeče,
   otevření z projektu.
3. **Stránky:** `/panel-builder/floorplan` = seznam, `/panel-builder/floorplan/novy` = nový prázdný editor (záznam vznikne
   při první změně), `/panel-builder/floorplan/[id]` = editor uloženého půdorysu.
4. **Ukládání:** průběžně na server (stav Uloženo / Ukládám / Neuloženo / Konflikt), záloha neuložených změn v prohlížeči,
   varování při zavření okna, konflikt dvou oken s volbou „Načíst aktuální verzi“ / „Ponechat mou verzi“ – odmítnutá
   i přepsaná verze zůstane v historii.
5. **Zpět / Znovu:** Ctrl+Z, Ctrl+Shift+Z i Ctrl+Y, tlačítka v liště; jedno tažení nebo rychlá série úprav = jeden krok.
6. **Rozdělení editoru:** detail prvku, místnosti a nová logika (historie, ukládání, verze) v samostatných souborech.
7. **Testy:** unit (historie úprav, služba půdorysů) a E2E (seznam, ukládání, konflikt, verze, Zpět / Znovu, převzetí
   z prohlížeče, otevření z projektu); stávající E2E půdorysu otevírají nový půdorys přes `/panel-builder/floorplan/novy`.
