// Fáze 89: 2D půdorys v 5 fázích – průvodce nad plátnem ukazuje vždy jen jednu kontextovou lištu (podklad a místnosti,
// systém a design, osazení, trasy a výšky, kusovník a výstupy). Zkušení projektanti si ho trvale vypnou do kompaktní
// CAD lišty (jeden řádek nástrojů + 4 rozbalovací menu) – volba se pamatuje v prohlížeči (`eldock-floorplan-ui-mode`)
// i v profilu firmy (knihovna půdorysu, vyhrává novější). Čisté funkce.
// Fáze 90: průvodce nikdy sám nepřepne krok – aktivní krok se pamatuje v relaci prohlížeče podle půdorysu (nový půdorys
// po prvním uložení dostane id a editor se přemontuje), krokové karty nesou živý stav (počet místností, měřítko, prvky,
// okruhy) a fajfku u hotových kroků.
// Fáze 98: fázový průvodce – 1 půdorys a místnosti, 2 rozváděč, okna, dveře a vybavení, 3 zásuvkové okruhy
// a spotřebiče, 4 světla, vypínače a chytrá domácnost, 5 trasy kabelů, kusovník a rozváděč; v každé fázi jen její
// nástroje a vrstvy (`floorplan-phases.ts`).

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
    label: "1. Půdorys a místnosti",
    short: "Půdorys a místnosti",
    hint: "Nahrajte podklad (PDF / DXF / DWG / BIM .ifc / obrázek) a zkalibrujte měřítko, nebo vytvořte místnosti X × Y, nakreslete obdélník či šikmou stěnu a přidejte podlaží.",
    next: "Další fáze: Rozváděč, okna, dveře a vybavení →",
  },
  {
    id: 2,
    label: "2. Rozváděč, okna, dveře a vybavení",
    short: "Rozváděč a vybavení",
    hint: "Umístěte hlavní rozváděč RH (podružný RP, stoupačku), do stěn okna a dveře, do koupelny vanu, sprchu, umyvadlo a WC (ochranné zóny ČSN 33 2000-7-701) a do pokojů nábytek.",
    next: "Další fáze: Zásuvkové okruhy a spotřebiče →",
  },
  {
    id: 3,
    label: "3. Zásuvkové okruhy a spotřebiče",
    short: "Zásuvky a spotřebiče",
    hint: "Osaďte zásuvky (jednozásuvky, dvojzásuvky, IP44, RJ45, TV) a spotřebiče s vlastním jisticím okruhem – zásuvky se samy seskupí do okruhů po nejvýš 10 (ČSN 33 2130 ed. 4).",
    next: "Další fáze: Světla, vypínače a chytrá domácnost →",
  },
  {
    id: 4,
    label: "4. Světla, vypínače a chytrá domácnost",
    short: "Světla a vypínače",
    hint: "Zvolte úroveň instalace a design vypínačů, osaďte světla, vypínače a tlačítka, žaluzie, čidla a termostaty a spárujte vypínače se světly.",
    next: "Další fáze: Trasy kabelů, Kusovník a Rozváděč →",
  },
  {
    id: 5,
    label: "5. Trasy kabelů, Kusovník a Rozváděč",
    short: "Trasy, kusovník a rozváděč",
    hint: "Zkontrolujte obvodové trasy (rovný úsek posunete myší), kontrolu norem a kusovník s krabičkami KOPOS, vyexportujte PDF / DXF a jedním klikem vygenerujte rozváděč.",
    next: null,
  },
];

export const wizardStep = (id: WizardStep) => WIZARD_STEPS[id - 1];

/** Událost Interactive Tour video-návodu – kapitola videa 2D půdorysu přepne průvodce na fázi s jejími nástroji. */
export const TUTORIAL_CHAPTER_EVENT = "eldock:tutorial-chapter";
/** Fáze 98: kapitoly videa (podklad, design, osazení, trasy, kusovník) → fáze průvodce (1, 4, 3, 5, 5). */
const CHAPTER_PHASES: readonly WizardStep[] = [1, 4, 3, 5, 5];
export const stepForTutorialChapter = (chapter: number): WizardStep => CHAPTER_PHASES[Math.min(4, Math.max(0, Math.round(chapter)))];
export const isWizardStep = (value: unknown): value is WizardStep => value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
export const nextStep = (id: WizardStep): WizardStep => (id < 5 ? ((id + 1) as WizardStep) : 5);
/** Fáze 98: předchozí fáze (tlačítko „← Předchozí fáze“). */
export const prevStep = (id: WizardStep): WizardStep => (id > 1 ? ((id - 1) as WizardStep) : 1);

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

/** Fáze 90: údaje nákresu pro krokové karty průvodce (fáze 98: počty podle fází). */
export interface WizardProgress {
  /** Místnosti aktivního podlaží. */
  rooms: number;
  /** „ok“ = rastr v mm, výkres CAD nebo zkalibrovaný podklad; „missing“ = podklad bez kalibrace. */
  scale: "ok" | "missing";
  /** Zvolený design („ABB Levit · bílá“). */
  design: string;
  /** Hlavní rozváděč RH osazen. */
  panel: boolean;
  /** Okna, dveře, nábytek a zařizovací předměty (fáze 2). */
  fittings: number;
  /** Zásuvky a spotřebiče s vlastním okruhem (fáze 3). */
  sockets: number;
  /** Světla, vypínače, stínění, čidla a termostaty (fáze 4). */
  lights: number;
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
 * Fáze 90 / 98: podtitul a fajfka krokových karet – fáze 1 hotová s místností a v pořádku měřítkem, fáze 2 s rozváděčem RH,
 * fáze 3 se zásuvkou nebo spotřebičem, fáze 4 se světlem nebo ovladačem, fáze 5 s vygenerovaným rozváděčem.
 */
export function wizardStatus(progress: WizardProgress, active: WizardStep): WizardStepStatus[] {
  void active;
  const scale = progress.scale === "ok" ? "měřítko OK" : "měřítko nezkalibrováno";
  return [
    { id: 1, subtitle: progress.rooms ? `${plural(progress.rooms, "místnost", "místnosti", "místností")} · ${scale}` : progress.scale === "missing" ? "podklad · měřítko nezkalibrováno" : "zatím žádná místnost", done: progress.rooms > 0 && progress.scale === "ok" },
    { id: 2, subtitle: `${progress.panel ? "RH osazen" : "bez rozváděče RH"}${progress.fittings ? ` · ${plural(progress.fittings, "prvek vybavení", "prvky vybavení", "prvků vybavení")}` : ""}`, done: progress.panel },
    { id: 3, subtitle: progress.sockets ? plural(progress.sockets, "zásuvka / spotřebič", "zásuvky / spotřebiče", "zásuvek / spotřebičů") : "zatím žádná zásuvka", done: progress.sockets > 0 },
    { id: 4, subtitle: progress.lights ? `${plural(progress.lights, "světlo / ovladač", "světla / ovladače", "světel / ovladačů")} · ${progress.design}` : progress.design, done: progress.lights > 0 },
    { id: 5, subtitle: progress.project ? "rozváděč vygenerován" : progress.circuits ? `${plural(progress.circuits, "okruh", "okruhy", "okruhů")}${progress.cableM > 0 ? ` · ${Math.round(progress.cableM)} m kabelu` : ""}` : "PDF · DXF · rozváděč", done: progress.project },
  ];
}

/** Režim zobrazení: volba v prohlížeči má přednost, jinak profil firmy, jinak průvodce. */
export function resolveUiMode(local: string | null | undefined, profile: FloorplanUiMode | null | undefined): FloorplanUiMode {
  if (isFloorplanUiMode(local)) return local;
  return isFloorplanUiMode(profile) ? profile : "wizard";
}
