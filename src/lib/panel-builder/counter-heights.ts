// Fáze 109: výška zásuvek a vypínačů u kuchyňské linky, ostrůvku a umyvadla – zásuvka nebo vypínač ve výchozí podlahové
// výšce (300 mm) v půdorysu linky nebo do 20 cm od její hrany se při vložení / přesunu zvedne na 1150 mm (nad pracovní
// desku 900 mm). Vložená nebo posunutá linka zvedne zásuvky, které nad ní už jsou. Spotřebiče pod linkou (myčka, trouba,
// varná deska, lednice) si technologickou výšku nechávají. Čisté funkce nad nákresem.

import { DEFAULT_ELEVATION } from "@/engine/floorplan-bridge";

import { distanceToFixture, fixtureGeometry } from "./fixtures";
import { paletteItem, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { effectiveHeight, frameOf, layoutFrame } from "./floorplan-frames";

/** Pracovní desky: kuchyňská linka, ostrůvek, umyvadlo a dvojumyvadlo. */
export const COUNTER_ITEMS: readonly string[] = ["arch-kitchen", "arch-island", "basin", "double-basin"];
/** Dosah od hrany desky [mm] – zásuvka na stěně za linkou (linka 600 mm od stěny) i těsně vedle ní. */
export const COUNTER_REACH_MM = 200;
/** Horní hrana pracovní desky [mm]. */
export const COUNTER_TOP_MM = 900;

export const COUNTER_RAISED_TEXT = "📏 Zásuvky nad kuchyňskou linkou byly automaticky nastaveny do výšky 1150 mm (nad pracovní desku 900 mm).";
export const ELEMENT_RAISED_TEXT = "📏 Zásuvka / vypínač u pracovní desky – výška nastavena na 1150 mm (nad desku 900 mm).";

/** Zásuvky (1N, 2N, IP44, USB, T3 – ne datové) a vypínače / ovladače; spotřebiče a svítidla ne. */
const RAISABLE_KINDS = new Set(["single_socket", "double_socket", "switch"]);

export const isCounter = (element: Pick<EditorElement, "item">) => COUNTER_ITEMS.includes(element.item);

/** Druh prvku, který se nad pracovní desku zvedá. */
export const raisableKind = (element: Pick<EditorElement, "item">) => RAISABLE_KINDS.has(paletteItem(element.item)?.kind ?? "");

const floorHeight = (draft: Pick<FloorplanDraft, "profile">) => draft.profile?.defaultSocketHeightMm ?? DEFAULT_ELEVATION.defaultSocketHeightMm;
const worktopHeight = (draft: Pick<FloorplanDraft, "profile">) => draft.profile?.worktopSocketHeightMm ?? DEFAULT_ELEVATION.worktopSocketHeightMm;

/** Prvek leží v půdorysu pracovní desky nebo do 20 cm od její hrany. */
export function nearCounter(draft: Pick<FloorplanDraft, "elements">, point: { x: number; y: number }, counters?: readonly EditorElement[]): boolean {
  for (const counter of counters ?? draft.elements.filter(isCounter)) {
    const geometry = fixtureGeometry(counter);
    if (geometry && distanceToFixture(geometry, point.x, point.y) <= COUNTER_REACH_MM) return true;
  }
  return false;
}

export interface CounterHeightResult {
  draft: FloorplanDraft;
  /** Prvky se zvednutou výškou (u víceramečku všechny jeho pozice). */
  raised: string[];
  /** Zvedla je vložená / posunutá linka (upozornění „Zásuvky nad kuchyňskou linkou …“). */
  byCounter: boolean;
}

/**
 * Po vložení / přesunu prvků `changedIds`: zásuvka nebo vypínač ve výchozí podlahové výšce u pracovní desky → výška nad
 * desku (1150 mm z výškového profilu); vložená / posunutá deska zvedne takové prvky ve svém dosahu. Víceramček se zvedá
 * celý podle kotvy (svislý se znovu rozvrhne po 71 mm). Prvek s ručně zadanou výškou (i 300 mm) se nemění.
 */
export function applyCounterHeights(draft: FloorplanDraft, changedIds: readonly string[]): CounterHeightResult {
  const changed = new Set(changedIds);
  const counters = draft.elements.filter(isCounter);
  if (!counters.length) return { draft, raised: [], byCounter: false };
  const movedCounters = counters.filter((counter) => changed.has(counter.id));
  const floor = floorHeight(draft);
  const target = worktopHeight(draft);
  const byId = new Map(draft.elements.map((element) => [element.id, element]));
  // Jednotky: samostatný prvek, nebo víceramček (rozhoduje kotva – první pozice)
  const units = new Map<string, { anchor: EditorElement; members: string[]; frameId: string | null }>();
  for (const element of draft.elements) {
    if (!raisableKind(element)) continue;
    const frame = frameOf(draft, element.id);
    const anchor = frame ? byId.get(frame.members[0]) : element;
    if (!anchor || units.has(anchor.id)) continue;
    units.set(anchor.id, { anchor, members: frame ? frame.members.filter((id) => byId.has(id)) : [element.id], frameId: frame?.id ?? null });
  }
  let next = draft;
  const raised: string[] = [];
  let byCounter = false;
  for (const unit of units.values()) {
    // Jen výchozí výška: samostatný prvek bez vlastní výšky (ručně zadaných 300 mm se nedotkne), víceramček podle kotvy
    if (!raisableKind(unit.anchor) || effectiveHeight(draft, unit.anchor) !== floor || (unit.anchor.mountHeightMm !== null && !unit.frameId)) continue;
    const members = unit.members.map((id) => byId.get(id)!).filter(Boolean);
    const unitMoved = unit.members.some((id) => changed.has(id));
    const nearMoved = movedCounters.length > 0 && members.some((member) => nearCounter(draft, member, movedCounters));
    const nearAny = unitMoved && members.some((member) => nearCounter(draft, member, counters));
    if (!nearMoved && !nearAny) continue;
    if (nearMoved && !unitMoved) byCounter = true;
    const ids = new Set(unit.members);
    next = { ...next, elements: next.elements.map((element) => (ids.has(element.id) ? { ...element, mountHeightMm: target } : element)) };
    if (unit.frameId) next = layoutFrame(next, unit.frameId);
    raised.push(...unit.members);
  }
  // Posunutá linka zvedla i prvky, které se s ní posunuly zároveň (výběr linky se zásuvkou) – pořád upozornění linky
  if (movedCounters.length && raised.length) byCounter = true;
  return { draft: next, raised, byCounter };
}
