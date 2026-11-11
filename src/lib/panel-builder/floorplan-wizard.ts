// Fáze 89: 2D půdorys v 5 fázích – průvodce nad plátnem ukazuje vždy jen jednu kontextovou lištu (podklad a místnosti,
// systém a design, osazení, trasy a výšky, kusovník a výstupy). Zkušení projektanti si ho trvale vypnou do kompaktní
// CAD lišty (jeden řádek nástrojů + 4 rozbalovací menu) – volba se pamatuje v prohlížeči (`eldock-floorplan-ui-mode`)
// i v profilu firmy (knihovna půdorysu, vyhrává novější). Čisté funkce.
// Fáze 90: průvodce nikdy sám nepřepne krok – aktivní krok se pamatuje v relaci prohlížeče podle půdorysu (nový půdorys
// po prvním uložení dostane id a editor se přemontuje), krokové karty nesou živý stav (počet místností, měřítko, prvky,
// okruhy) a fajfku u hotových kroků.

import type { FloorplanDraft } from "./floorplan-editor";

export const FLOORPLAN_UI_MODE_KEY = "eldock-floorplan-ui-mode";
export const FLOORPLAN_UI_MODES = ["wizard", "compact"] as const;
export type FloorplanUiMode = (typeof FLOORPLAN_UI_MODES)[number];
export const isFloorplanUiMode = (value: unknown): value is FloorplanUiMode => value === "wizard" || value === "compact";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardStepInfo {
  id: WizardStep;
  label: string;
  short: string;
  hint: string;
  /** Text tlačítka na další krok (poslední krok nemá). */
  next: string | null;
}

export const WIZARD_STEPS: readonly WizardStepInfo[] = [
  {
    id: 1,
    label: "1. Podklad a místnosti",
    short: "Podklad a místnosti",
    hint: "Nahrajte podklad a zkalibrujte měřítko, nebo zadejte rozměry X × Y jednotlivých místností a poskládejte je myší k sobě.",
    next: "Pokračovat na Výběr systému a designu →",
  },
  {
    id: 2,
    label: "2. Systém, výrobce a design",
    short: "Systém a design",
    hint: "Zvolte úroveň instalace, přívod rozváděče a výrobce, designovou řadu a barvy přístrojů – objednací čísla se přepočítají sama.",
    next: "Pokračovat na Osazení prvků →",
  },
  {
    id: 3,
    label: "3. Osazení prvků a spotřebičů",
    short: "Osazení prvků",
    hint: "Nejprve umístěte rozváděč RH, v koupelně vyznačte vanu/sprchu/umyvadlo a poté z levého menu osazujte zásuvky, světla, vypínače a spotřebiče.",
    next: "Pokračovat na Trasy kabelů →",
  },
  {
    id: 4,
    label: "4. Trasy kabelů a výšky",
    short: "Trasy a výšky",
    hint: "Zkontrolujte automatické obvodové trasy. Kterýkoliv rovný úsek kabelu můžete chytit myší a posunout v ose X nebo Y.",
    next: "Pokračovat na Kusovník a Rozváděč →",
  },
  {
    id: 5,
    label: "5. Kusovník, Export a Rozváděč",
    short: "Kusovník a výstupy",
    hint: "Zkontrolujte kusovník s objednacími čísly, vyexportujte výkres do PDF nebo CAD a jedním klikem vygenerujte rozváděč.",
    next: null,
  },
];

export const wizardStep = (id: WizardStep) => WIZARD_STEPS[id - 1];

/** Událost Interactive Tour video-návodu – kapitola 1–5 videa 2D půdorysu odpovídá kroku 1–5 průvodce. */
export const TUTORIAL_CHAPTER_EVENT = "eldock:tutorial-chapter";
export const stepForTutorialChapter = (chapter: number): WizardStep => (Math.min(5, Math.max(1, Math.round(chapter) + 1)) as WizardStep);
export const isWizardStep = (value: unknown): value is WizardStep => value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
export const nextStep = (id: WizardStep): WizardStep => (id < 5 ? ((id + 1) as WizardStep) : 5);

/** Fáze 90: klíč relace prohlížeče s aktivním krokem průvodce (+ „:<id půdorysu>“). */
export const WIZARD_STEP_KEY = "eldock-floorplan-wizard-step";

/**
 * Fáze 90: krok po (znovu)připojení editoru – uložený krok půdorysu v relaci prohlížeče má přednost (vytvoření místnosti,
 * nahrání podkladu ani kalibrace krok nemění), bez něj výchozí krok podle obsahu nákresu.
 */
export function resumeStep(saved: unknown, draft: Pick<FloorplanDraft, "rooms" | "elements" | "background" | "cad">): WizardStep {
  return isWizardStep(saved) ? saved : initialStep(draft);
}

/** Výchozí krok po otevření: prázdný nákres = 1, místnosti nebo podklad bez prvků = 2, s prvky = 3 (osazení). */
export function initialStep(draft: Pick<FloorplanDraft, "rooms" | "elements" | "background" | "cad">): WizardStep {
  if (draft.elements.length) return 3;
  if (draft.rooms.length || draft.background || draft.cad) return 2;
  return 1;
}

/** Fáze 90: údaje nákresu pro krokové karty průvodce. */
export interface WizardProgress {
  /** Místnosti aktivního podlaží. */
  rooms: number;
  /** „ok“ = rastr v mm, výkres CAD nebo zkalibrovaný podklad; „missing“ = podklad bez kalibrace. */
  scale: "ok" | "missing";
  /** Zvolený design („ABB Levit · bílá“). */
  design: string;
  /** Osazené elektrické prvky (bez zařizovacích předmětů a nábytku) a hlavní rozváděč RH. */
  elements: number;
  panel: boolean;
  circuits: number;
  /** Délka kabelů zvoleného způsobu vedení [m]. */
  cableM: number;
  /** Z půdorysu je vygenerovaný rozváděč. */
  project: boolean;
}

export interface WizardStepStatus {
  id: WizardStep;
  subtitle: string;
  done: boolean;
}

const plural = (count: number, one: string, few: string, many: string) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;

/**
 * Fáze 90: podtitul a fajfka krokových karet – krok 1 hotový s místností a v pořádku měřítkem, krok 2 po jeho opuštění
 * (nebo s osazenými prvky), krok 3 s prvky a rozváděčem RH, krok 4 s okruhy po jeho opuštění, krok 5 s rozváděčem.
 */
export function wizardStatus(progress: WizardProgress, active: WizardStep): WizardStepStatus[] {
  const passed = (id: WizardStep) => active > id;
  const scale = progress.scale === "ok" ? "měřítko OK" : "měřítko nezkalibrováno";
  return [
    { id: 1, subtitle: progress.rooms ? `${plural(progress.rooms, "místnost", "místnosti", "místností")} · ${scale}` : progress.scale === "missing" ? "podklad · měřítko nezkalibrováno" : "zatím žádná místnost", done: progress.rooms > 0 && progress.scale === "ok" },
    { id: 2, subtitle: progress.design, done: progress.rooms > 0 && (passed(2) || progress.elements > 0) },
    { id: 3, subtitle: progress.elements ? `${plural(progress.elements, "prvek", "prvky", "prvků")} · ${progress.panel ? "RH osazen" : "bez rozváděče RH"}` : "zatím nic osazeno", done: progress.elements > 0 && progress.panel },
    { id: 4, subtitle: progress.circuits ? `${plural(progress.circuits, "okruh", "okruhy", "okruhů")}${progress.cableM > 0 ? ` · ${Math.round(progress.cableM)} m kabelu` : ""}` : "trasy po osazení RH a prvků", done: progress.circuits > 0 && (passed(4) || progress.project) },
    { id: 5, subtitle: progress.project ? "rozváděč vygenerován" : "PDF · DXF · rozváděč", done: progress.project },
  ];
}

/** Režim zobrazení: volba v prohlížeči má přednost, jinak profil firmy, jinak průvodce. */
export function resolveUiMode(local: string | null | undefined, profile: FloorplanUiMode | null | undefined): FloorplanUiMode {
  if (isFloorplanUiMode(local)) return local;
  return isFloorplanUiMode(profile) ? profile : "wizard";
}
