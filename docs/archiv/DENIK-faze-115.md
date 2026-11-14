# Deník fáze 115 (přesunuto z `docs/PLAN.md`, sekce C)

| Fáze | Datum | Poznámky |
|---|---|---|
| 115 | 2026-11-14 | Zadání z chatu → `docs/archiv/ZADANI-faze-115.md` (i rozhodnutí a odchylky – řada typů, EAN a Pv ze zadání ABB nevede, platí ABB ETIM 9.0 a new.abb.com). Bez migrace. **Kód:** `smart-home.ts` (free@home, `lossFrom: "manufacturer"`), `configurator.ts` (C3 ze skutečných kusů, `COMB_ACCESSORY_SUBTYPES`), `comb-busbars.ts` (`combRuns`, `combFedIds`, `combForks`, `combParts`, `combCuts`), `RailCombMenu.tsx`, `vector-layout.ts` (`wiringPaths(…, combFed)`), `cnc-manufacturing-engine.ts` (`cncLayout` podle polí, `cncFitIssues`, vývodky v řadách), `CncManufacturingPanel.tsx` (listy, zoom), `revision-hub.ts` + `RevisionHub.tsx` + `/revize`, `industry-nav.ts` + `SectionNav.tsx`. **Testy:** `src/lib/phase115.test.ts` (15), E2E `e2e/phase115.spec.ts` (2). |
