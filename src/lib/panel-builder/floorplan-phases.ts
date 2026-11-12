// Fáze 98: 2D půdorys jako fázový průvodce – v každé fázi levá paleta, plátno i pravý panel ukazují VÝHRADNĚ nástroje
// a vrstvy dané fáze (mezi fázemi se dá kdykoli volně přecházet, data se nemění):
//   1 Půdorys a místnosti – podklad, kalibrace, místnosti X × Y, podlaží; na plátně jen místnosti (prvky potlačené);
//   2 Rozváděč, okna, dveře a vybavení – rozváděče, zařizovací předměty (koupelnové zóny), okna, dveře a nábytek;
//   3 Zásuvkové okruhy a spotřebiče – ostře zásuvky, spotřebiče a jejich trasy, nábytek a zóny jako jemný podklad,
//     světla a vypínače na 25 % bez tras;
//   4 Světla, vypínače a chytrá domácnost – ostře světla, ovladače, stínění, čidla a jejich trasy / sběrnice, zásuvky
//     a nábytek na 30 % bez zásuvkových tras;
//   5 Trasy kabelů, Kusovník a Rozváděč – celý výkres, rychlý filtr vrstev (vše / zásuvky / světla / stínění a Smart Home).
// Kompaktní lišta (bez průvodce) může ukázat vše najednou (`null` = bez filtru fáze). Čisté funkce.

import type { PaletteGroup } from "./floorplan-editor";
import type { CircuitLayer } from "./route-display";
import type { WizardStep } from "./floorplan-wizard";

/** Fáze průvodce (1–5); `null` = bez filtru (kompaktní lišta – Zobrazit vše). */
export type FloorplanPhase = WizardStep;

/** Skupiny palety značek v levém sloupci podle fáze (fáze 1 a 5 paletu značek nemají). */
export const PHASE_PALETTE: Readonly<Record<FloorplanPhase, readonly PaletteGroup[]>> = {
  1: [],
  2: ["panel", "fixtures", "architecture", "medical"],
  3: ["sockets", "appliances"],
  4: ["lights", "controls", "shading"],
  5: [],
};

/** Fáze, ve které je skupina palety (null = skupina mimo fáze průvodce). */
export function phaseOfGroup(group: PaletteGroup | null | undefined): FloorplanPhase | null {
  if (!group) return null;
  for (const phase of [2, 3, 4] as const) if (PHASE_PALETTE[phase].includes(group)) return phase;
  return null;
}

/** Paleta skupiny je v levém sloupci vidět (bez fáze vždy). */
export const paletteGroupVisible = (phase: FloorplanPhase | null, group: PaletteGroup) => phase === null || PHASE_PALETTE[phase].includes(group);

/** Sestavy ve vícerámečku (zásuvky / vypínače) – fáze 3 a 4. */
export const assembliesVisible = (phase: FloorplanPhase | null) => phase === null || phase === 3 || phase === 4;

/** Sekce pravého panelu (fáze 100: `generate` = velké tlačítko fáze 5, `generate-form` = karta Založit rozváděč). */
export type PanelSectionId = "rooms" | "detail" | "site" | "socket-circuits" | "zone-checks" | "design" | "smart" | "generate" | "generate-form" | "checks" | "circuits" | "cables" | "edited" | "bom" | "inventory" | "cad";

/**
 * Sekce pravého panelu podle fáze (pořadí = pořadí v panelu). Detail vybraného prvku / místnosti je ve všech fázích;
 * varování zón, krytí, krabiček a víceramečků (jen se zjištěním) ve fázích osazování 3 a 4 – vypínač v zóně 1 koupelny
 * nebo stmívač v mělké krabici projektant opraví hned při osazení, ne až v kontrole fáze 5.
 */
export const PHASE_PANELS: Readonly<Record<FloorplanPhase, readonly PanelSectionId[]>> = {
  1: ["rooms", "detail", "cad"],
  2: ["site", "detail"],
  3: ["detail", "socket-circuits", "zone-checks"],
  4: ["design", "detail", "smart", "zone-checks"],
  5: ["generate", "detail", "checks", "circuits", "cables", "edited", "bom", "inventory", "cad"],
};

/** Sekce je v pravém panelu vidět (bez fáze všechny kromě úzkých výřezů fází – seznam místností, kontrola zón). */
export function panelVisible(phase: FloorplanPhase | null, section: PanelSectionId): boolean {
  if (phase === null) return section !== "rooms" && section !== "zone-checks" && section !== "site" && section !== "design" && section !== "generate";
  return PHASE_PANELS[phase].includes(section);
}

/**
 * Fáze 100: pravý panel ve 4 záložkách (místo až 10 karet pod sebou) – záložka se přepne sama podle fáze průvodce
 * (fáze 1, 2 a 4 Detail, fáze 3 Okruhy & Trasy, fáze 5 Kusovník & Rozváděč), uživatel ji může kdykoli přepnout ručně
 * a klik na prvek / místnost na plátně otevře Detail. V záložce jsou její karty ve všech fázích; jen pomocné karty fáze
 * (místnosti 1, přívod a typ prostoru 2, systém a design 4, velké tlačítko generování 5, chytrá domácnost a hladiny
 * CAD) se řídí fází jako dřív. Varování zón (výřez kontroly pro fáze 3 a 4) nahrazuje celá kontrola v záložce Normy.
 */
export type RightTab = "detail" | "circuits" | "norms" | "bom";

export const RIGHT_TABS: readonly { id: RightTab; icon: string; label: string }[] = [
  { id: "detail", icon: "🎯", label: "Detail" },
  { id: "circuits", icon: "🔌", label: "Okruhy & Trasy" },
  { id: "norms", icon: "🛡️", label: "Normy (Linter)" },
  { id: "bom", icon: "⚡", label: "Kusovník & Rozváděč" },
];

export const isRightTab = (value: unknown): value is RightTab => RIGHT_TABS.some((tab) => tab.id === value);

/** Výchozí záložka fáze (kompaktní lišta „Zobrazit vše“ = Detail). */
export const PHASE_TAB: Readonly<Record<FloorplanPhase, RightTab>> = { 1: "detail", 2: "detail", 3: "circuits", 4: "detail", 5: "bom" };

export const defaultRightTab = (phase: FloorplanPhase | null): RightTab => (phase === null ? "detail" : PHASE_TAB[phase]);

/** Záložka každé karty pravého panelu. */
export const TAB_OF_SECTION: Readonly<Record<PanelSectionId, RightTab>> = {
  rooms: "detail",
  site: "detail",
  design: "detail",
  detail: "detail",
  smart: "detail",
  cad: "detail",
  circuits: "circuits",
  "socket-circuits": "circuits",
  cables: "circuits",
  edited: "circuits",
  checks: "norms",
  "zone-checks": "norms",
  generate: "bom",
  "generate-form": "bom",
  bom: "bom",
  inventory: "bom",
};

/** Karty záložky vidět ve všech fázích (ostatní karty záložky jen ve své fázi – `panelVisible`). */
const TAB_CORE: readonly PanelSectionId[] = ["detail", "circuits", "socket-circuits", "cables", "edited", "checks", "generate-form", "bom", "inventory"];

/** Karta je v aktivní záložce pravého panelu vidět. */
export function tabSectionVisible(phase: FloorplanPhase | null, tab: RightTab, section: PanelSectionId): boolean {
  if (TAB_OF_SECTION[section] !== tab || section === "zone-checks") return false;
  return TAB_CORE.includes(section) || panelVisible(phase, section);
}

/**
 * Zobrazení prvku na plátně: `active` = 100 % a lze ho vybrat / posunout, `context` = orientační podklad (jemně
 * potlačený, neklikatelný), `dim` = potlačený na 25–30 % (neklikatelný).
 */
export type ElementView = "active" | "context" | "dim";

export interface ElementLook {
  view: ElementView;
  /** Průhlednost značky (1 = plně). */
  opacity: number;
}

const ACTIVE: ElementLook = { view: "active", opacity: 1 };
const look = (view: ElementView, opacity: number): ElementLook => ({ view, opacity });

/** Jak se prvek skupiny palety ukáže ve fázi. */
export function elementLook(phase: FloorplanPhase | null, group: PaletteGroup | null | undefined): ElementLook {
  if (phase === null || phase === 5 || !group) return ACTIVE;
  if (phase === 1) return look("dim", 0.12);
  if (phase === 2) return PHASE_PALETTE[2].includes(group) ? ACTIVE : look("dim", 0.2);
  if (phase === 3) {
    if (group === "sockets" || group === "appliances") return ACTIVE;
    // Rozváděč (zdroj okruhů) zůstává čitelný, nábytek a zařizovací předměty = jemný orientační podklad
    if (group === "panel") return look("context", 0.85);
    if (group === "fixtures" || group === "architecture" || group === "medical") return look("context", 0.45);
    return look("dim", 0.25);
  }
  // Fáze 4
  if (group === "lights" || group === "controls" || group === "shading") return ACTIVE;
  if (group === "panel") return look("context", 0.85);
  return look("dim", 0.3);
}

/** Fáze 5: rychlý filtr viditelnosti vrstev na plátně. */
export type LayerFilter = "all" | "power" | "lighting" | "smart";

export const LAYER_FILTERS: readonly { id: LayerFilter; label: string }[] = [
  { id: "all", label: "👁️ Všechny okruhy" },
  { id: "power", label: "🔌 Jen zásuvky a spotřebiče" },
  { id: "lighting", label: "💡 Jen světla a vypínače" },
  { id: "smart", label: "🪟 Jen stínění a Smart Home" },
];

export const isLayerFilter = (value: unknown): value is LayerFilter => LAYER_FILTERS.some((filter) => filter.id === value);

const POWER: readonly CircuitLayer[] = ["sockets", "appliance", "data"];
const LIGHTING: readonly CircuitLayer[] = ["lighting"];
const SMART: readonly CircuitLayer[] = ["shading", "bus"];

/**
 * Smí se trasa vrstvy okruhu ve fázi kreslit? Fáze 1–2 trasy nemají; fáze 3 jen zásuvky, spotřebiče a data, fáze 4 jen
 * světla, stínění a sběrnice; fáze 5 podle filtru. Přívod podružného rozváděče (`feeder`) se kreslí ve fázích 3–5.
 */
export function routeVisible(phase: FloorplanPhase | null, layer: CircuitLayer, filter: LayerFilter = "all"): boolean {
  if (phase === null) return true;
  if (phase === 1 || phase === 2) return false;
  if (layer === "feeder") return true;
  if (phase === 3) return POWER.includes(layer);
  if (phase === 4) return LIGHTING.includes(layer) || SMART.includes(layer);
  if (filter === "power") return POWER.includes(layer);
  if (filter === "lighting") return LIGHTING.includes(layer);
  if (filter === "smart") return SMART.includes(layer);
  return true;
}

/** Skupina palety prvku ve filtru fáze 5 (značky mimo filtr se potlačí stejně jako trasy). */
export function filterLook(filter: LayerFilter, group: PaletteGroup | null | undefined): ElementLook {
  if (filter === "all" || !group) return ACTIVE;
  const groups: Record<Exclude<LayerFilter, "all">, readonly PaletteGroup[]> = { power: ["sockets", "appliances", "panel"], lighting: ["lights", "controls", "panel"], smart: ["shading", "controls", "panel"] };
  if (groups[filter].includes(group)) return ACTIVE;
  return group === "fixtures" || group === "architecture" || group === "medical" ? look("context", 0.45) : look("dim", 0.25);
}

/** Popisky fází pro živý tahák zakázky (FloorplanLiveChecklist) – stejné pořadí jako průvodce. */
export const CHECKLIST_PHASES: readonly { phase: FloorplanPhase; label: string }[] = [
  { phase: 1, label: "1. Půdorys a místnosti" },
  { phase: 2, label: "2. Rozváděč, okna, dveře a nábytek" },
  { phase: 3, label: "3. Zásuvkové okruhy a spotřebiče" },
  { phase: 4, label: "4. Světla, vypínače a Smart Home" },
  { phase: 5, label: "5. Kontrola, Kusovník a Rozváděč" },
];
