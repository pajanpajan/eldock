// Fáze 98: AI Panel Builder ve stejné fázové filozofii jako 2D půdorys – projekt rozváděče má 4 fáze, každá stránka
// projektu ukazuje jen nástroje své fáze:
//   1 Osazení DIN lišt & Skříň – 1a osazení (fotka / soupis / od nuly, Elektro-linter u lišt), 1b skříň rozváděče;
//   2 Strom zapojení, Fáze & Linter – hierarchie napájení, rozdělení L1 / L2 / L3, nálezy Elektro-linteru;
//   3 Výpočet oteplení IEC 60890 – ztráty, soudobost, krytí a ventilátor (ČSN EN 61439 / IEC TR 60890);
//   4 Dokumentace, Kusovník & Štítky – 4a elaborát PDF s kusovníkem, 4b štítky přístrojů 1:1.
// Stránky (adresy) zůstávají z fází 48 / 75, mění se jen seskupení, popisky a navigace. Čisté funkce.

import type { StepKey } from "./project";

/** Stránka projektu rozváděče (kroky z fází 48 / 75 + tisk štítků). */
export type PanelPage = StepKey | "labels";
export type PanelPhaseId = 1 | 2 | 3 | 4;

export interface PanelPhaseInfo {
  id: PanelPhaseId;
  /** „2. Strom zapojení, Fáze & Linter“. */
  label: string;
  hint: string;
  /** Stránky fáze v pořadí (fáze 1 a 4 mají dvě části – 1a / 1b, 4a / 4b). */
  pages: readonly PanelPage[];
}

export const PANEL_PHASES: readonly PanelPhaseInfo[] = [
  {
    id: 1,
    label: "1. Osazení DIN lišt & Skříň",
    hint: "Přístroje na DIN lišty z fotky, ze soupisu nebo od nuly (Elektro-linter u lišt hlídá chrániče, póly a rezervu) a skříň rozváděče, do které se návrh vejde.",
    pages: ["recognition", "enclosure"],
  },
  {
    id: 2,
    label: "2. Strom zapojení, Fáze & Linter",
    hint: "Hierarchie napájení (přívod → hlavní vypínač → chrániče → jističe), rozdělení fází L1 / L2 / L3 a nálezy Elektro-linteru nad zapojením.",
    pages: ["tree"],
  },
  {
    id: 3,
    label: "3. Výpočet oteplení IEC 60890",
    hint: "Ztrátové výkony přístrojů, soudobost a krytí skříně – oteplení dle ČSN EN 61439 / IEC TR 60890, případně filtrační ventilátor.",
    pages: ["thermal"],
  },
  {
    id: 4,
    label: "4. Dokumentace, Kusovník & Štítky",
    hint: "Elaborát PDF (schéma, kusovník, protokol kusové zkoušky, prohlášení o shodě, štítek CE) a štítky přístrojů v měřítku 1:1.",
    pages: ["documentation", "labels"],
  },
];

/** Všechny stránky projektu v pořadí průchodu (Předchozí / Další). */
export const PANEL_PAGES: readonly PanelPage[] = PANEL_PHASES.flatMap((phase) => phase.pages);

export const panelPhase = (id: PanelPhaseId): PanelPhaseInfo => PANEL_PHASES[id - 1];
export const panelPhaseOf = (page: PanelPage): PanelPhaseId => PANEL_PHASES.find((phase) => phase.pages.includes(page))!.id;

export const panelPageHref = (page: PanelPage, projectId: string): string => (page === "recognition" ? `/panel-builder/${projectId}` : `/panel-builder/${projectId}/${page}`);

/** Název části fáze (návrh od nuly = „Návrh a osazení“, z fotky = „Analýza fotky a osazení“). */
export function panelPageLabel(page: PanelPage, design: boolean): string {
  switch (page) {
    case "recognition":
      return design ? "Návrh a osazení DIN lišt" : "Analýza fotky a osazení DIN lišt";
    case "enclosure":
      return "Skříň rozváděče";
    case "tree":
      return "Strom zapojení, fáze a linter";
    case "thermal":
      return "Výpočet oteplení IEC 60890";
    case "documentation":
      return "Dokumentace a kusovník (PDF)";
    case "labels":
      return "Štítky rozváděče";
  }
}

/** Označení části: „1a“, „1b“, „4b“; fáze s jedinou stránkou jen číslo („2“). */
export function panelPageCode(page: PanelPage): string {
  const phase = panelPhase(panelPhaseOf(page));
  return phase.pages.length > 1 ? `${phase.id}${"ab"[phase.pages.indexOf(page)]}` : String(phase.id);
}

export const nextPanelPage = (page: PanelPage): PanelPage | null => PANEL_PAGES[PANEL_PAGES.indexOf(page) + 1] ?? null;
export const prevPanelPage = (page: PanelPage): PanelPage | null => PANEL_PAGES[PANEL_PAGES.indexOf(page) - 1] ?? null;

/** Text přechodu: uvnitř fáze „1b · Skříň rozváděče“, do jiné fáze celý název fáze. */
export function panelStepLabel(from: PanelPage, to: PanelPage, design: boolean): string {
  return panelPhaseOf(from) === panelPhaseOf(to) || panelPhase(panelPhaseOf(to)).pages.length > 1 ? `${panelPageCode(to)} · ${panelPageLabel(to, design)}` : panelPhase(panelPhaseOf(to)).label;
}

export interface PanelPhaseStatus {
  id: PanelPhaseId;
  done: boolean;
  subtitle: string;
}

/** Stav fází z kroků projektu (`stepProgress`): 1 = osazení i skříň, 2 = kompletní strom, 3 = oteplení vyhovuje, 4 = propuštěno. */
export function panelPhaseStatus(progress: Readonly<Record<StepKey, boolean>>): PanelPhaseStatus[] {
  return [
    { id: 1, done: progress.recognition && progress.enclosure, subtitle: `${progress.recognition ? "osazeno ✓" : "osazení rozpracované"} · ${progress.enclosure ? "skříň ✓" : "skříň nezvolena"}` },
    { id: 2, done: progress.tree, subtitle: progress.tree ? "strom zapojení kompletní" : "zapojení rozpracované" },
    { id: 3, done: progress.thermal, subtitle: progress.thermal ? "oteplení vyhovuje" : "oteplení nespočteno / nevyhovuje" },
    { id: 4, done: progress.documentation, subtitle: progress.documentation ? "propuštěno do provozu" : "PDF · kusovník · štítky" },
  ];
}

/** Hotová část fáze (štítky stav nemají). */
export const panelPageDone = (page: PanelPage, progress: Readonly<Record<StepKey, boolean>>): boolean | null => (page === "labels" ? null : progress[page]);
