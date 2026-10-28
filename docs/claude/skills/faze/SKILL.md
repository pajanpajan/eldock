---
name: faze
description: Provede jednu fázi implementačního plánu Digitry z docs/PLAN.md (bez čísla vezme další nedokončenou fázi), ověří ji, aktualizuje plán a udělá commit.
argument-hint: "[číslo fáze]"
disable-model-invocation: true
---

Proveď jednu fázi implementačního plánu projektu Digitry.

Požadovaná fáze: "$ARGUMENTS" (prázdné = první fáze, která v tabulce „Stav fází“ v `docs/PLAN.md` není ✅).

## Postup

1. **Načti kontext.** Přečti `docs/PLAN.md` celý – hlavně sekce A (technická rozhodnutí), B (stavový automat), C (demo data) a zadání zvolené fáze. Specifikace produktu je v `CLAUDE.md`. Pokud existuje `AGENTS.md`, řiď se jím: před psaním kódu, který používá API Next.js, si přečti příslušný návod v `node_modules/next/dist/docs/`.
2. **Zkontroluj předpoklady.** Všechny předchozí fáze musí být ✅. Pracovní strom gitu musí být čistý (`git status`). Pokud něco nesedí, zastav se a zeptej se.
3. **Naplánuj.** Převeď úkoly fáze na task list. V tabulce „Stav fází“ nastav fázi na 🟨.
4. **Implementuj.** Drž se rozhodnutí ze sekce A. Pokud je nutná odchylka (např. jiný přepínač CLI, nekompatibilní verze), zvol rozumné řešení, pokračuj a zapiš ho do Deníku. Na mazání souborů mimo projekt a na cokoli nevratného se nejdřív zeptej.
5. **Ověř.** Spusť vše ze sekce „Hotovo když“ dané fáze a minimálně `npm run typecheck` a `npm run lint` (od fáze 2 `npm run verify`). Opravuj, dokud vše neprojde. U UI fází spusť dev server a ověř, že dotčené stránky vrací 200; je-li k dispozici prohlížečový nástroj, zkontroluj je i vizuálně (desktop a šířka tabletu).
6. **Aktualizuj plán.** Odškrtni splněné úkoly, nastav fázi na ✅ a přidej řádek do Deníku (datum, odchylky, známé nedostatky).
7. **Commit.** `git add -A` a commit se zprávou uvedenou u fáze. Nikdy nedělej push.
8. **Shrň česky** (krátce): co je hotové, jak to vyzkoušet (URL a kroky), odchylky od plánu, co přijde v další fázi.

Po jedné fázi se zastav a další nezačínej, pokud o to uživatel výslovně nepožádal.
