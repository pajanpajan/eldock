// Fáze 92: trenažér 2D půdorysu – „rozdělaná zakázka z 85 % hotová“. Bungalov 4+kk (ABB-free@home, sběrnicová úroveň)
// s nakreslenými místnostmi, nábytkem (postele, kuchyňská linka, vana, umyvadlo, WC), rozváděčem RH a většinou zásuvek
// a světel. Chybí 15 %: zásuvka u postele v ložnici, stmívání stropního svítidla v koupelně a vygenerování rozváděče.
// Tři úkoly se odškrtávají samy podle skutečného stavu nákresu (`sandboxProgress`); rozváděč z trenažéru vzniká bez
// kreditu jen z nákresu, který je opravdu cvičný bungalov (`sandboxDraftIssue` na serveru). Čisté funkce.

import { emptyDraft, paletteItem, wallRotation, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { smartPlanOf } from "./smart-home-plan";

/** Id předvolby v adrese trenažéru a značka `trainerPreset` rozváděče vygenerovaného z trenažéru. */
export const SANDBOX_PRESET_ID = "bungalov-4kk";
export const SANDBOX_TRAINER_PRESET = "pudorys-bungalov";
export const SANDBOX_NAME = "Cvičný bungalov 4+kk (trenažér)";
/** Kolik prvků smí trenažér navíc proti předvolbě (vlastní pokusy) – víc už není cvičný dům. */
export const SANDBOX_MAX_EXTRA_ELEMENTS = 15;
/** Nejvýš tolik rozváděčů z trenažérů (půdorys + tréninkové zakázky) na firmu – pak je třeba některé smazat. */
export const TRAINER_PROJECT_LIMIT = 12;

/** Místnosti bungalovu 13,8 × 9,6 m (mm v půdorysu, rastr 20 × 16 m). */
export const SANDBOX_ROOMS: readonly EditorRoom[] = [
  { id: "r-obyvak", name: "Obývací pokoj s kuchyní", x: 1000, y: 1000, w: 7000, h: 4500 },
  { id: "r-loznice", name: "Ložnice", x: 8000, y: 1000, w: 4000, h: 4500 },
  { id: "r-koupelna", name: "Koupelna", x: 12000, y: 1000, w: 2800, h: 4500 },
  { id: "r-chodba", name: "Chodba", x: 1000, y: 5500, w: 13800, h: 1600 },
  { id: "r-technicka", name: "Technická místnost", x: 1000, y: 7100, w: 2000, h: 3500 },
  { id: "r-wc", name: "WC", x: 3000, y: 7100, w: 1400, h: 3500 },
  { id: "r-detsky", name: "Dětský pokoj", x: 4400, y: 7100, w: 4000, h: 3500 },
  { id: "r-pracovna", name: "Pracovna", x: 8400, y: 7100, w: 3600, h: 3500 },
  { id: "r-satna", name: "Šatna", x: 12000, y: 7100, w: 2800, h: 3500 },
];

/** Cíl úkolu 1: stěna vpravo od manželské postele (noční stolek) – terčík „⊕ Sem položte dvojzásuvku“. */
export const SANDBOX_BED_TARGET = { x: 11400, y: 1000, radiusMm: 1100, room: "Ložnice" } as const;
/** Stropní svítidlo v koupelně – úkol 2 (🔆 Stmívatelné). */
export const SANDBOX_BATH_LIGHT_ID = "ko-l1";
/** Paletová položka úkolu 1 (pulzuje v levé paletě). */
export const SANDBOX_SOCKET_ITEM = "double-socket";

const roomOf = (name: string) => SANDBOX_ROOMS.find((room) => room.name === name)!;

function el(id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement {
  const palette = paletteItem(item);
  // Zásuvky, datové zásuvky a nástěnná svítidla „nožičkou“ ke stěně (stejně jako při vkládání v editoru)
  const wall = palette?.kind === "single_socket" || palette?.kind === "double_socket" || palette?.kind === "data_socket" || (palette?.kind === "light" && palette.variant === "wall");
  return { id, item, x, y, room, mountHeightMm: null, frameUnits: palette?.kind === "double_socket" ? 2 : 1, series: null, color: null, controls: [], rotation: wall ? wallRotation(roomOf(room), x, y) : 0, scale: null, ...patch };
}

/** Zařizovací předmět / nábytek: střed, rozměr a natočení (0 = zadní hrana u horní stěny, 90 vpravo, 180 dole, 270 vlevo). */
const fixture = (id: string, item: string, x: number, y: number, room: string, rotation: number, sizeMm?: { w: number; d: number }): EditorElement => ({
  ...el(id, item, x, y, room),
  rotation,
  ...(sizeMm ? { sizeMm } : {}),
});

const OK = "Obývací pokoj s kuchyní";
const LO = "Ložnice";
const KO = "Koupelna";
const CH = "Chodba";
const TE = "Technická místnost";
const DP = "Dětský pokoj";
const PR = "Pracovna";
const SA = "Šatna";

/** Prvky předvolby – rozváděč, nábytek, zásuvky, světla, sběrnicová tlačítka a spotřebiče (bez zásuvky u postele). */
export function sandboxElements(): EditorElement[] {
  return [
    // Technická místnost: hlavní rozváděč RH, pračka, zásuvka, světlo
    el("rh", "panel", 1350, 8900, TE),
    el("te-pr", "washer", 2300, 10250, TE),
    el("te-z1", "socket", 1700, 10600, TE),
    el("te-l1", "ceiling-light", 2000, 8400, TE),
    el("te-b1", "bus-1", 2750, 7350, TE, { controls: ["te-l1"] }),
    // Obývací pokoj s kuchyňským koutem
    fixture("ok-linka", "arch-kitchen", 2300, 1300, OK, 0),
    fixture("ok-stul", "arch-table-dining", 3300, 3500, OK, 0),
    fixture("ok-gauc", "arch-sofa-l", 6200, 2900, OK, 0),
    fixture("ok-tv", "arch-tv", 6200, 5275, OK, 180),
    el("ok-my", "dishwasher", 1400, 1350, OK),
    el("ok-vd", "cooktop", 2300, 1350, OK),
    el("ok-tr", "oven", 3100, 1350, OK),
    el("ok-ch", "fridge", 3950, 1350, OK),
    el("ok-zl1", "worktop-socket", 1800, 1000, OK),
    el("ok-zl2", "worktop-socket", 2800, 1000, OK),
    el("ok-z1", "double-socket", 1000, 3600, OK),
    el("ok-z2", "double-socket", 5600, 5500, OK),
    el("ok-z3", "double-socket", 8000, 3000, OK),
    el("ok-z4", "socket", 4600, 1000, OK),
    el("ok-d1", "data-socket", 6600, 5500, OK),
    el("ok-l1", "ceiling-light", 2300, 2500, OK),
    el("ok-l2", "ceiling-light", 3300, 3500, OK),
    el("ok-l3", "ceiling-light", 6200, 2900, OK),
    el("ok-b1", "bus-2", 7700, 5300, OK, { controls: ["ok-l1", "ok-l2"] }),
    el("ok-b2", "bus-1", 1300, 5300, OK, { controls: ["ok-l3"] }),
    // Ložnice: manželská postel u horní stěny, šatní skříň; zásuvka vlevo u postele je, vpravo chybí (úkol 1)
    fixture("lo-postel", "arch-bed-double", 10000, 2000, LO, 0),
    fixture("lo-skrin", "arch-wardrobe", 10000, 5200, LO, 180),
    el("lo-z1", "double-socket", 8600, 1000, LO),
    el("lo-z2", "double-socket", 8000, 4000, LO),
    el("lo-l1", "ceiling-light", 10000, 3800, LO),
    el("lo-b1", "bus-1", 8350, 5250, LO, { controls: ["lo-l1"] }),
    // Koupelna: vana u horní stěny, umyvadlo u levé stěny, zásuvka IP44 mimo umývací prostor, stropní svítidlo (úkol 2)
    fixture("ko-vana", "bath", 13400, 1375, KO, 0),
    fixture("ko-umyvadlo", "basin", 12225, 3000, KO, 270),
    el("ko-z1", "ip44-socket", 12000, 4300, KO),
    el(SANDBOX_BATH_LIGHT_ID, "ceiling-light", 13400, 3300, KO),
    el("ko-b1", "bus-1", 12350, 5250, KO, { controls: [SANDBOX_BATH_LIGHT_ID] }),
    // Chodba
    el("ch-l1", "ceiling-light", 3000, 6300, CH),
    el("ch-l2", "ceiling-light", 7500, 6300, CH),
    el("ch-l3", "ceiling-light", 12000, 6300, CH),
    el("ch-b1", "bus-2", 1350, 6800, CH, { controls: ["ch-l1", "ch-l2"] }),
    el("ch-b2", "bus-1", 14450, 6000, CH, { controls: ["ch-l3"] }),
    el("ch-z1", "socket", 5000, 7100, CH),
    // WC
    fixture("wc-misa", "arch-wc", 3700, 10275, "WC", 180),
    el("wc-l1", "ceiling-light", 3700, 8500, "WC"),
    el("wc-b1", "bus-1", 3250, 7350, "WC", { controls: ["wc-l1"] }),
    // Dětský pokoj
    fixture("dp-postel", "arch-bed-single", 5000, 9600, DP, 180),
    fixture("dp-stul", "arch-desk", 7300, 10250, DP, 180),
    el("dp-z1", "double-socket", 5900, 10600, DP),
    el("dp-z2", "double-socket", 8400, 8500, DP),
    el("dp-l1", "ceiling-light", 6400, 8800, DP),
    el("dp-b1", "bus-1", 4700, 7350, DP, { controls: ["dp-l1"] }),
    // Pracovna
    fixture("pr-stul", "arch-desk", 10200, 10250, PR, 180),
    el("pr-z1", "double-socket", 9400, 10600, PR),
    el("pr-d1", "data-socket", 10000, 10600, PR),
    el("pr-z2", "socket", 12000, 8500, PR),
    el("pr-l1", "ceiling-light", 10200, 8800, PR),
    el("pr-b1", "bus-1", 8700, 7350, PR, { controls: ["pr-l1"] }),
    // Šatna
    fixture("sa-skrin", "arch-wardrobe", 13400, 10300, SA, 180),
    el("sa-l1", "ceiling-light", 13400, 8800, SA),
    el("sa-b1", "bus-1", 12300, 7350, SA, { controls: ["sa-l1"] }),
  ];
}

/** Nákres trenažéru: čistý rastr 20 × 16 m, prostředí zvolené, ABB-free@home, řada ABB Levit, obvodové trasy po stěnách. */
export function sandboxDraft(): FloorplanDraft {
  return {
    ...emptyDraft(),
    rooms: SANDBOX_ROOMS.map((room) => ({ ...room })),
    elements: sandboxElements(),
    environment: "INDOOR_DRY",
    installation: "bus_loxone",
    smartSystem: "abb_freeathome",
    series: "ABB|Levit",
    routeStyle: "walls",
    updatedAt: 0,
  };
}

const PRESET_IDS = new Set(sandboxElements().map((element) => element.id));

export type SandboxTaskId = "bed-socket" | "bath-dimmer" | "generate";

export interface SandboxTask {
  id: SandboxTaskId;
  /** „Úkol 1/3“. */
  step: 1 | 2 | 3;
  title: string;
  instruction: string;
}

export const SANDBOX_TASKS: readonly SandboxTask[] = [
  {
    id: "bed-socket",
    step: 1,
    title: "Zásuvka u postele",
    instruction: "V ložnici chybí zásuvka u postele (vpravo u nočního stolku). Klikněte v levé paletě na Dvojzásuvka (nebo na [Vybrat nástroj]) a položte ji ke stěně u postele.",
  },
  {
    id: "bath-dimmer",
    step: 2,
    title: "Stmívání v koupelně",
    instruction: "V koupelně klikněte na stropní svítidlo a v detailu zaškrtněte 🔆 Stmívatelné.",
  },
  {
    id: "generate",
    step: 3,
    title: "Rozváděč jedním klikem",
    instruction: "Zakázka je kompletní! Klikněte na žluté tlačítko ⚡ Vygenerovat rozváděč z tohoto půdorysu.",
  },
];

/** Zásuvka, kterou uživatel položil u postele (nová, ne z předvolby), jinak null. */
export function bedSocketOf(draft: Pick<FloorplanDraft, "elements">): EditorElement | null {
  return (
    draft.elements.find((element) => {
      if (PRESET_IDS.has(element.id) || element.room !== SANDBOX_BED_TARGET.room) return false;
      const kind = paletteItem(element.item)?.kind;
      if (kind !== "double_socket" && kind !== "single_socket") return false;
      return Math.hypot(element.x - SANDBOX_BED_TARGET.x, element.y - SANDBOX_BED_TARGET.y) <= SANDBOX_BED_TARGET.radiusMm;
    }) ?? null
  );
}

/** Stropní svítidlo v koupelně je stmívatelné (stmívání, CCT i barva stmívají). */
export function bathLightDimmed(draft: Pick<FloorplanDraft, "elements">): boolean {
  const light = draft.elements.find((element) => element.id === SANDBOX_BATH_LIGHT_ID)?.light;
  return Boolean(light && (light.dimmable || light.cct || light.color));
}

/**
 * Stmívací akční člen, na který výpočet chytré domácnosti posadil stmívané svítidlo z koupelny (typ a popis z katalogu
 * ABB-free@home) – text gratulace k úkolu 2 je tak vždy pravdivý; null = svítidlo není na stmívacím kanálu.
 */
export function bathDimmerOf(draft: FloorplanDraft): { typeCode: string; label: string; channel: number } | null {
  const plan = smartPlanOf(draft);
  for (const unit of plan?.modules ?? []) {
    if (unit.role !== "dim") continue;
    const slot = unit.assigned.find((entry) => entry.load.id === SANDBOX_BATH_LIGHT_ID);
    if (slot) return { typeCode: unit.typeCode, label: unit.label, channel: slot.channel };
  }
  return null;
}

export interface SandboxProgress {
  done: Record<SandboxTaskId, boolean>;
  /** Aktuální úkol (první nehotový), null = vše hotovo. */
  current: SandboxTaskId | null;
  count: number;
}

/** Stav úkolů trenažéru podle nákresu; úkol 3 hotový po vygenerování rozváděče. */
export function sandboxProgress(draft: FloorplanDraft, generated = false): SandboxProgress {
  const done: Record<SandboxTaskId, boolean> = { "bed-socket": bedSocketOf(draft) !== null, "bath-dimmer": bathLightDimmed(draft), generate: generated };
  const current = SANDBOX_TASKS.find((task) => !done[task.id])?.id ?? null;
  return { done, current, count: SANDBOX_TASKS.filter((task) => done[task.id]).length };
}

/**
 * Server: nákres smí jít do rozváděče bez kreditu jen jako cvičný bungalov – jedno podlaží bez podkladu, stejné místnosti
 * (název a rozměr) a nejvýš `SANDBOX_MAX_EXTRA_ELEMENTS` prvků navíc. Vrací důvod odmítnutí, jinak null.
 */
export function sandboxDraftIssue(draft: Pick<FloorplanDraft, "background" | "cad" | "otherFloors" | "rooms" | "elements">): string | null {
  if (draft.background || draft.cad || draft.otherFloors.length) return "V trenažéru se kreslí jen do cvičného bungalovu (bez vlastního podkladu a dalších podlaží).";
  const preset = SANDBOX_ROOMS.map((room) => `${room.name}|${room.w}|${room.h}`).sort();
  const rooms = draft.rooms.map((room) => `${room.name}|${Math.round(room.w)}|${Math.round(room.h)}`).sort();
  if (rooms.length !== preset.length || rooms.some((room, index) => room !== preset[index]) || draft.rooms.some((room) => room.points?.length)) {
    return "Místnosti cvičného bungalovu se v trenažéru nemění – vraťte úpravu (Ctrl+Z) nebo trenažér začněte znovu.";
  }
  if (draft.elements.length > PRESET_IDS.size + SANDBOX_MAX_EXTRA_ELEMENTS) return `V trenažéru je víc než ${SANDBOX_MAX_EXTRA_ELEMENTS} prvků navíc – vlastní zakázku nakreslete v novém půdorysu.`;
  return null;
}
