# Deník fáze 109 (přesunuto z `docs/PLAN.md`, sekce C)

| Fáze | Datum | Poznámky |
|---|---|---|
| 109 | 2026-11-13 | Zadání z chatu → `docs/archiv/ZADANI-faze-109.md` (i rozhodnutí a odchylky). Bez migrace. **Kód:** `src/lib/panel-builder/symbol-colors.ts` + `useSymbolColor.ts` (přepínač v liště, `FloorSymbol` / `PanelSymbol` / `PlanElement` s barvou a minimální tloušťkou, ztlumení podkladu, trasy a vazby v kontrolní barvě), 3D `FloorplanPseudo3DModal.tsx` (stěny 20 %, popisky, otvory, `ElementMarker`, legenda) a `pseudo3d.ts` (ovladače), `placesOnce` a WC v `floorplan-editor.ts`, `counter-heights.ts`, náhledy panelů v `SmartHomeDeviceCatalog.tsx` a `SmartHomeDeviceIllustration.tsx`, převod `installation-mode-converter.ts` (+ `projectVariants` / `activeVariant` v nákresu a `parseDraft`), `ConvertInstallationModal.tsx`, `ProjectVariantBar.tsx`. **Testy:** `src/lib/panel-builder/phase109.test.ts` (12), E2E `e2e/phase109.spec.ts` (3), upravený `phase90.test.ts`. |
