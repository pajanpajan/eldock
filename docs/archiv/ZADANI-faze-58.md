# Zadání fáze 58 (2026-11-06, z chatu)

Zadání uživatele (doslovně, vloženo jako text):

> co je potřeba doladit:
>
> Co se neověřilo: E2E fáze 48 (demo-docs, phase46) a opakovaný běh phase48 zůstávají bez úspěšného běhu kvůli
> nedostatku RAM.
>
> Ověřit správnost symbolů modulárních přístrojů jako jsou jističe chrániče přepěťové ochrany a vše ostatní s tímto
> související jako stykače, relátka a podobně, nemůžeme si dovolit špatně zakreslené symboly. Ideálně ke každému
> symbolu, který máme mít možnost náhledu do datasheetu.
>
> úvodní menu webové stránky popíšeme obecným popisem, proč celý projekt vznikl a co má lidem přinést, dále bude
> rozdělení na levé straně pro domovní elektroinstalace a na pravé pro průmysl, po rozkliknutí jednoho, nebo druhého
> bude zákazník přesměrován na část, podle své volby. Celkově musíme mapu webu vylepšit.

Rozpad:
1. E2E `phase48`, `demo-docs` a `phase46` spustit znovu (v této relaci prošly už po fázi 57 – `phase46` po opravě testu).
2. Značky modulárních přístrojů v jednopólovém schématu podle ČSN EN 60617 (jistič, chránič, jističochránič, odpínač,
   odpojovač, pojistkový odpojovač, přepěťová ochrana, stykač, relé a jejich podtypy, zdroj, transformátor,
   elektroměr, svorka), legenda značek v dokumentaci a knihovna značek ke kontrole.
3. Náhled datasheetu u každého přístroje (krok 1, dokumentace, katalog).
4. Úvodní stránka: proč Eldock vznikl a co přináší, rozcestník vlevo Domovní elektroinstalace / vpravo Průmysl,
   samostatné stránky obou částí, lepší mapa webu (navigace, patička, sitemap.xml, drobečková navigace).

Zdroj tvarů značek: galerie ProfiCAD (EN 60617-7 – jističe, chrániče, odpojovače, odpínač, stykač, cívky relé
s kvalifikátory, elektroměr, pojistky, transformátor); přepěťová ochrana kreslena jako varistor (ČSN EN 60617-4)
s uzemněním. Kresba je vlastní (SVG v `src/lib/panel-builder/iec-symbols.ts`).
