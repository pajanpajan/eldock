// Fáze 89: 2D půdorys v 5 fázích – průvodce nad plátnem ukazuje vždy jen jednu kontextovou lištu (podklad a místnosti,
// systém a design, osazení, trasy a výšky, kusovník a výstupy). Zkušení projektanti si ho trvale vypnou do kompaktní
// CAD lišty (jeden řádek nástrojů + 4 rozbalovací menu) – volba se pamatuje v prohlížeči (`eldock-floorplan-ui-mode`)
// i v profilu firmy (knihovna půdorysu, vyhrává novější). Čisté funkce.

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

/** Výchozí krok po otevření: prázdný nákres = 1, místnosti nebo podklad bez prvků = 2, s prvky = 3 (osazení). */
export function initialStep(draft: Pick<FloorplanDraft, "rooms" | "elements" | "background" | "cad">): WizardStep {
  if (draft.elements.length) return 3;
  if (draft.rooms.length || draft.background || draft.cad) return 2;
  return 1;
}

/** Režim zobrazení: volba v prohlížeči má přednost, jinak profil firmy, jinak průvodce. */
export function resolveUiMode(local: string | null | undefined, profile: FloorplanUiMode | null | undefined): FloorplanUiMode {
  if (isFloorplanUiMode(local)) return local;
  return isFloorplanUiMode(profile) ? profile : "wizard";
}
