---
name: overit
description: Kompletní kontrola projektu Digitry – typecheck, lint, unit testy, build, smoke test workflow a E2E testy (pokud existují) – s českým souhrnem výsledků.
disable-model-invocation: true
---

Proveď kompletní kontrolu projektu Digitry a nic neopravuj, dokud k tomu uživatel nedá pokyn (výjimka: zjevné triviální chyby, které rovnou uveď).

1. `npm run verify` (typecheck, lint, test, build).
2. Pokud existuje skript `smoke`: `npm run smoke`.
3. Pokud existuje skript `test:e2e`: `npm run test:e2e`.
4. Projdi `src/` a hledej anglické texty viditelné v UI (UI musí být česky) a pevně zadrátované barvy stavů mimo `src/lib/status.ts`.
5. Porovnej stav s `docs/PLAN.md`: jsou odškrtnuté úkoly opravdu hotové?

Výstup česky: tabulka kontrol (✅ / ❌ + krátký důvod), seznam nalezených problémů seřazený podle závažnosti a doporučený další krok.
