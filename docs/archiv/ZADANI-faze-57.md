# Zadání fáze 57 (2026-11-06, z chatu)

Kontext: 2D půdorys & kabeláž v AI Panel Builderu (`/panel-builder/floorplan`, fáze 49–55). Uživatel přiložil výřez
půdorysu (ložnice 1.03 a šatna 1.04) se zásuvkami vloženými editorem – značky neodpovídají normě.

Zadání uživatele (doslovně):

> když chci navrhnout 2D půdorys & kabeláž, tak při vložení pdf mi chybí možnost otočení o 90° a potřebuji tam přidat
> možnost zoomu. Dále, když vložím PDF, musím obnovit stránku, aby se zobrazilo. Dále když zvolím možnost kalibrovat
> místnost, bylo by dobré tam mít nějaké ověření a potvrzení, že to opravdu sedí, jak má ještě tam musíme přidat
> možnost oříznutí vloženého PDF, vytvoř menu úprava pdf, pod kterým budou k dispozici tyto možnosti. Dále možnost
> nastavit rezervu na kabeláž v %. Před generováním finální dokumentace, je potřeba zvolit prostředí dle normy.
> schematické značky zásuvek nesedí s normou stejně tak nesedí ani schematické značky vypínačů, navíc je potřeba mít
> možnost u nich nastavit měřítko a po vložení do projektu je potřeba, aby byla možnost je přesunout, případně
> i odstranit. Když zvolím úroveň instalace, nic se v podstatě nemění a stále tam mám klasické vypínače, tohle musíme
> úplně předělat.

Rozpad:
1. Menu „Úprava PDF“: otočení o 90° (doprava / doleva), zoom (přiblížit / oddálit / celý výkres, kolečko myši, posun),
   ořez podkladu tažením (a jeho zrušení), kalibrace měřítka s ověřením druhou kótou a potvrzením (tolerance ±2 %),
   u PDF navíc kontrola proti měřítku výkresu z razítka (1 : 50, 1 : 100 …).
2. Chyba: nahrané PDF se zobrazí až po obnovení stránky.
3. Rezerva kabeláže v % (výkaz kabeláže, kusovník, dokumentace).
4. Prostředí dle ČSN 33 2000-5-51 ed. 3 povinně před generováním rozváděče z půdorysu i před tiskem / propuštěním
   dokumentace (protokol o určení vnějších vlivů).
5. Značky zásuvek a vypínačů dle ČSN EN 60617-11 (zásuvka 11-13-xx, spínače 11-14-xx), řazení podle skutečného
   párování, měřítko značek (celý nákres i jednotlivá značka), přesun a mazání osazených značek i v režimu vkládání,
   otočení značky a natočení zásuvky ke stěně.
6. Úroveň instalace mění ovládání: klasika = vypínače dle řazení, sběrnice = sběrnicová tlačítka / detektory /
   prostorové jednotky (jedna sběrnicová linka, světla hvězdou), retrofit = vypínače s modulem a bezdrátová tlačítka;
   převod osazených ovladačů při změně úrovně, kabeláž a kusovník podle úrovně.

Zdroj tvarů značek: galerie ProfiCAD (značky s čísly EN 60617-11 11-13-01, 11-13-04, 11-13-09, 11-14-01 až 11-14-09)
– převzaty jen tvary, kresba je vlastní (SVG v `FloorSymbol.tsx`). Knihovna IEC 60617 (library.iec.ch) vrátila 403.
