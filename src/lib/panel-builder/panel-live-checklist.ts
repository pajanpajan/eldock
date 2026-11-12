// Fáze 92: živý tahák rozváděče (AI Panel Builder) – pět bodů podle skutečných kroků projektu (`STEPS` v `PanelSteps.tsx`):
// 1 Elektro-linter bez nálezů, 2 strom zapojení kompletní, 3 zvolená skříň, 4 oteplení vyhovuje a bylo zkontrolováno,
// 5 PDF elaborát vytištěný. Stav ze serveru (projekt) + co uživatel v prohlížeči udělal (otevřený krok 4, tisk PDF).
// Tréninková zakázka má k bodům vlastní úkoly (`TrainerJob.steps`). Čisté funkce.

import type { RecognitionStatus } from "@/generated/prisma/enums";

import { configFromComponent, parseConfig, type CatalogLike } from "./configurator";
import { validateSwitchboardState, type LintIssue } from "./linter";
import type { TrainerJob, TrainerStep } from "./panel-trainer-presets";
import { railCapacities } from "./rails";
import { vectorDeviceFrom } from "./vector-symbols";

/** Prvek projektu tak, jak ho vrací dotaz projektu (s kusem katalogu). */
export interface ChecklistItem {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  circuitLabel: string;
  customTypeCode: string | null;
  recognitionStatus: RecognitionStatus;
  rawOcrText: string | null;
  configJson: string | null;
  parentItemId: string | null;
  catalogComponent: (CatalogLike & { powerLossWatts: number }) | null;
}

/** Nálezy Elektro-linteru nad uloženým projektem – stejný výpočet jako v kroku 1 (`RecognitionWorkspace`). */
export function projectLintIssues(project: { dinRailsCount: number; modulesPerRail: number; railModulesJson?: string | null; occupancy?: string | null; items: readonly ChecklistItem[] }, enclosureModules: number | null): LintIssue[] {
  return validateSwitchboardState({
    devices: project.items.map((item) => {
      const device = vectorDeviceFrom(item);
      return {
        id: item.id,
        designation: item.designation,
        dinRailIndex: item.dinRailIndex,
        positionOnRail: item.positionOnRail,
        modulesWidth: item.modulesWidth,
        category: device.category,
        poles: device.poles,
        ratedCurrentA: device.ratedCurrentA,
        manufacturer: device.manufacturer,
        typeCode: device.typeCode,
        label: item.circuitLabel,
        parentItemId: item.parentItemId,
        config: parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null),
      };
    }),
    capacities: railCapacities(project),
    enclosureModules,
    occupancy: project.occupancy ?? null,
  });
}

export type PanelChecklistKey = TrainerStep["key"];

export interface PanelChecklistState {
  /** Nálezy Elektro-linteru (chyby + varování). */
  lintIssues: number;
  /** První nález (text do taháku). */
  lintFirst: string | null;
  connected: boolean;
  enclosure: string | null;
  thermalOk: boolean;
  /** Oteplení – nejvyšší teplota ve skříni [°C], null = nespočteno. */
  thermalTempC: number | null;
}

/** Co uživatel v prohlížeči u projektu už udělal (localStorage). */
export interface PanelChecklistVisits {
  thermal?: boolean;
  printed?: boolean;
}

export interface PanelChecklistRow {
  key: PanelChecklistKey;
  /** „1. Návrh a osazení …“ – číslo = krok projektu. */
  label: string;
  ok: boolean;
  detail: string;
  /** Úkol tréninkové zakázky k tomuto kroku (jinak null). */
  task: string | null;
}

// Fáze 98: body taháku nesou čísla 4 fází projektu (1a osazení, 1b skříň, 2 strom, 3 oteplení, 4 dokumentace)
const STEP_LABEL: Record<PanelChecklistKey, string> = {
  recognition: "1a. Osazení DIN lišt – Elektro-linter",
  tree: "2. Strom zapojení a fáze",
  enclosure: "1b. Skříň rozváděče",
  thermal: "3. Výpočet oteplení IEC 60890",
  documentation: "4. Dokumentace, kusovník a PDF elaborát",
};

/** Body taháku s živým stavem; první nehotový je aktuální krok. */
export function panelChecklist(state: PanelChecklistState, visits: PanelChecklistVisits, job: Pick<TrainerJob, "steps"> | null): PanelChecklistRow[] {
  const task = (key: PanelChecklistKey) => job?.steps.find((step) => step.key === key)?.text ?? null;
  const nalezy = (count: number) => `${count} ${count === 1 ? "nález" : count >= 2 && count <= 4 ? "nálezy" : "nálezů"}`;
  return [
    { key: "recognition", label: STEP_LABEL.recognition, ok: state.lintIssues === 0, detail: state.lintIssues ? `${nalezy(state.lintIssues)} – ${state.lintFirst ?? "otevřete Elektro-linter"}` : "Bez nálezů – chrániče, póly, rezerva i hřebeny v pořádku", task: task("recognition") },
    { key: "tree", label: STEP_LABEL.tree, ok: state.connected, detail: state.connected ? "Všechny přístroje jsou ve stromu zapojení" : "Některé přístroje nejsou zapojené ve stromu", task: task("tree") },
    { key: "enclosure", label: STEP_LABEL.enclosure, ok: Boolean(state.enclosure), detail: state.enclosure ?? "Skříň zatím není zvolená", task: task("enclosure") },
    {
      key: "thermal",
      label: STEP_LABEL.thermal,
      ok: state.thermalOk && Boolean(visits.thermal),
      detail: !state.thermalOk ? "Oteplení nevyhovuje – upravte skříň nebo ztráty" : visits.thermal ? `Vyhovuje${state.thermalTempC !== null ? ` (${state.thermalTempC.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} °C ve skříni)` : ""}` : "Spočteno – otevřete fázi 3 a zkontrolujte výsledek",
      task: task("thermal"),
    },
    { key: "documentation", label: STEP_LABEL.documentation, ok: Boolean(visits.printed), detail: visits.printed ? "PDF elaborát vytištěn" : "Otevřete fázi 4 a vytiskněte elaborát (Tisk / PDF)", task: task("documentation") },
  ];
}

/** Klíč localStorage pro projekt („co uživatel u projektu udělal“). */
export const panelChecklistKey = (projectId: string) => `eldock-panel-checklist:${projectId}`;
/** Trvalé vypnutí taháku rozváděče v prohlížeči. */
export const PANEL_CHECKLIST_OFF_KEY = "eldock-panel-checklist-off";
