// Fáze 59: víceramečky (2R–5R z různých přístrojů s vyrovnáním a přisazením), zakreslení změn do podkladu (nová
// příčka, bouraná konstrukce, šrafovaná oblast, textové pole) a přiřazení vypínačů ke světlům. Čisté funkce nad
// nákresem (aktivní podlaží), bezpečné pro klient i server.

import { DEFAULT_ELEVATION, mountHeight, type InstallLevel } from "@/engine/floorplan-bridge";

import {
  ANNOTATION_DEFAULTS,
  allElements,
  controlsLights,
  frameAxis,
  heightKindOf,
  mapAllElements,
  paletteFor,
  paletteItem,
  symbolSizeOf,
  type PaletteItem,
  type Annotation,
  type AnnotationKind,
  type EditorElement,
  type FloorplanDraft,
  type FrameGroup,
} from "./floorplan-editor";
import { frameLimitText, maxFrameGang } from "./residential-series-catalog";

let sequence = 0;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(sequence++).toString(36)}`;

// ---------------------------------------------------------------------------
//  Víceramečky
// ---------------------------------------------------------------------------

/** Víceramček pojme nejvýš 5 pozic (rámečky 1R–5R); fáze 91 – skutečný limit řady `frameLimitOf`. */
export const MAX_FRAME_GANGS = 5;

/** Fáze 91: limit víceramečku řady a barvy rámečku (Decento a nástěnné řady 1, Time Arbo a solo carat 4 …). */
export interface FrameLimit {
  max: number;
  /** Vysvětlení limitu (strana katalogu); null = řada pojme víceramček až do 5R. */
  text: string | null;
}

/** Fáze 91: limit víceramečku pro přístroj – řada a barva prvku, jinak nákresu. */
export function frameLimitOf(draft: Pick<FloorplanDraft, "series" | "color" | "frameColor">, anchor?: Partial<Pick<EditorElement, "series" | "color" | "frameColor">> | null): FrameLimit {
  const series = anchor?.series ?? draft.series;
  const look = { color: anchor?.color ?? draft.color, frameColor: anchor?.frameColor ?? draft.frameColor ?? null };
  return { max: maxFrameGang(series, look), text: frameLimitText(series, look) };
}

/** Hláška překročeného limitu (vybráno / sestava má N pozic). */
const overLimit = (limit: FrameLimit, gangs: number, what: string) =>
  limit.max < MAX_FRAME_GANGS && limit.text ? `${limit.text} ${what} ${gangs} pozic.` : `Víceramček pojme nejvýš ${limit.max} pozic – ${what} ${gangs} (dvojzásuvka = 2 pozice).`;

/** Přístroj do víceramečku: zásuvky (dvojzásuvka = 2 pozice), datová zásuvka, vypínače a tlačítka na stěně. */
export function isFrameable(element: Pick<EditorElement, "item">): boolean {
  const item = paletteItem(element.item);
  if (!item || item.wireless) return false;
  if (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket") return true;
  if (item.kind !== "switch") return false;
  // Fáze 77: čidla oken / vody a hlavice topení nejsou přístroje do rámečku
  if (item.sensor || item.heatingHead) return false;
  if (item.bus && (item.bus.role === "presence" || item.bus.role === "display")) return false;
  // Čidlo pod stropem (PIR 2,2 m) se s vypínači a zásuvkami do rámečku nekombinuje
  return (item.heightMm ?? 0) < 2000;
}

/** Počet pozic přístroje v rámečku (dvojzásuvka = 2 jednozásuvky vedle sebe). */
export const gangsOf = (element: Pick<EditorElement, "item" | "frameUnits">) => Math.max(1, element.frameUnits) * (paletteItem(element.item)?.kind === "double_socket" ? 2 : 1);

export const frameOf = (draft: Pick<FloorplanDraft, "frames">, elementId: string): FrameGroup | null => draft.frames.find((frame) => frame.members.includes(elementId)) ?? null;

export function frameGangs(draft: Pick<FloorplanDraft, "elements">, frame: FrameGroup): number {
  return frame.members.reduce((sum, id) => {
    const element = draft.elements.find((candidate) => candidate.id === id);
    return sum + (element ? gangsOf(element) : 0);
  }, 0);
}

/** Výška osy krabice prvku [mm] (vlastní, z palety, jinak podle druhu a výškového profilu). */
export function effectiveHeight(draft: Pick<FloorplanDraft, "profile">, element: EditorElement): number {
  const item = paletteItem(element.item);
  if (!item || item.kind === "panel" || item.kind === "riser" || item.kind === "fixture") return draft.profile?.switchboardHeightMm ?? DEFAULT_ELEVATION.switchboardHeightMm;
  return mountHeight({ kind: heightKindOf(item.kind), variant: item.variant, tag: item.tag, ...(element.mountHeightMm !== null ? { mountHeightMm: element.mountHeightMm } : item.heightMm ? { mountHeightMm: item.heightMm } : {}) }, draft.profile ?? DEFAULT_ELEVATION);
}

/** Rozteč pozic rámečku ve výkresu: značky se dotýkají („přisazení“), skutečná rozteč krabic je 71 mm. */
export const framePitch = (draft: Pick<FloorplanDraft, "symbolScale">, anchor: Pick<EditorElement, "scale">) => symbolSizeOf(draft, anchor) * 0.78;

/**
 * Vyrovnání a přisazení: kotva (první člen) drží polohu, ostatní přístroje se seřadí vedle ní v ose rámečku na jednu
 * linii se stejným natočením.
 */
export function layoutFrame(draft: FloorplanDraft, frameId: string): FloorplanDraft {
  const frame = draft.frames.find((candidate) => candidate.id === frameId);
  const anchor = frame ? draft.elements.find((element) => element.id === frame.members[0]) : null;
  if (!frame || !anchor) return draft;
  const axis = frameAxis(anchor.rotation);
  const pitch = framePitch(draft, anchor);
  const placed = new Map<string, { x: number; y: number }>();
  // Fáze 62: kotva drží svůj střed i jako dvojzásuvka (2 pozice) – dřív se rámeček při každém přepočtu
  // (otočení, posun v rámečku) posunul o půl pozice
  const base = ((gangsOf(anchor) - 1) / 2) * pitch;
  let start = 0;
  for (const id of frame.members) {
    const member = draft.elements.find((element) => element.id === id);
    if (!member) continue;
    const gangs = gangsOf(member);
    const offset = (start + (gangs - 1) / 2) * pitch - base;
    placed.set(id, { x: Math.round(anchor.x + axis.x * offset), y: Math.round(anchor.y + axis.y * offset) });
    start += gangs;
  }
  return { ...draft, elements: draft.elements.map((element) => (placed.has(element.id) ? { ...element, ...placed.get(element.id)!, rotation: anchor.rotation, scale: anchor.scale } : element)) };
}

export type FrameResult = { ok: true; draft: FloorplanDraft; frameId: string; gangs: number } | { ok: false; error: string };

/**
 * „▦ Vložit do víceramečku“: vybrané přístroje (min. 2, nejvýš 5 pozic) do jednoho rámečku. Pořadí podle polohy
 * v ose rámečku, natočení podle většiny, společná výška (nejvyšší z výšek – kombinace se zásuvkou a vypínačem je
 * ve výšce vypínače), místnost, řada a barva kotvy. Přístroje z jiných rámečků se z nich vyjmou.
 */
export function createFrame(draft: FloorplanDraft, ids: readonly string[]): FrameResult {
  const picked = draft.elements.filter((element) => ids.includes(element.id));
  const rejected = picked.filter((element) => !isFrameable(element));
  if (rejected.length) return { ok: false, error: `Do rámečku nejdou: ${[...new Set(rejected.map((element) => paletteItem(element.item)?.label ?? element.item))].join(", ")}.` };
  if (picked.length < 2) return { ok: false, error: "Vyberte alespoň 2 přístroje (Shift + klik nebo tažením obdélníku přes prázdné místo)." };
  const gangs = picked.reduce((sum, element) => sum + gangsOf(element), 0);
  if (gangs > MAX_FRAME_GANGS) return { ok: false, error: `Víceramček pojme nejvýš ${MAX_FRAME_GANGS} pozic – vybráno ${gangs} (dvojzásuvka = 2 pozice).` };
  const counts = new Map<number, number>();
  for (const element of picked) counts.set(element.rotation, (counts.get(element.rotation) ?? 0) + 1);
  const rotation = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const axis = frameAxis(rotation);
  const ordered = [...picked].sort((a, b) => a.x * axis.x + a.y * axis.y - (b.x * axis.x + b.y * axis.y) || a.id.localeCompare(b.id));
  const anchor = ordered[0];
  // Fáze 91: rámeček v řadě a barvě kotvy – víc pozic, než řada vyrábí (Decento, nástěnné řady, Time Arbo 4R …), nejde
  const limit = frameLimitOf(draft, anchor);
  if (gangs > limit.max) return { ok: false, error: overLimit(limit, gangs, "vybráno") };
  const height = Math.max(...ordered.map((element) => effectiveHeight(draft, element)));
  const frameId = uid("r");
  const memberIds = new Set(ordered.map((element) => element.id));
  const frames = [...draft.frames.map((frame) => ({ ...frame, members: frame.members.filter((id) => !memberIds.has(id)) })).filter((frame) => frame.members.length >= 2), { id: frameId, members: ordered.map((element) => element.id) }];
  const elements = draft.elements.map((element) =>
    memberIds.has(element.id)
      ? { ...element, rotation, room: anchor.room, series: anchor.series, color: anchor.color, scale: anchor.scale, mountHeightMm: effectiveHeight(draft, { ...element, mountHeightMm: null }) === height ? element.mountHeightMm : height }
      : element,
  );
  return { ok: true, draft: layoutFrame({ ...draft, frames, elements }, frameId), frameId, gangs };
}

/** Rozdělení rámečku – přístroje zůstanou na místě jako samostatné. */
export const dissolveFrame = (draft: FloorplanDraft, frameId: string): FloorplanDraft => ({ ...draft, frames: draft.frames.filter((frame) => frame.id !== frameId) });

/** Vyjmutí přístroje z rámečku (rámeček s 1 přístrojem zanikne). */
export function removeFromFrame(draft: FloorplanDraft, elementId: string): FloorplanDraft {
  const frames = draft.frames.map((frame) => ({ ...frame, members: frame.members.filter((id) => id !== elementId) })).filter((frame) => frame.members.length >= 2);
  const touched = frameOf(draft, elementId);
  const next = { ...draft, frames };
  return touched && frames.some((frame) => frame.id === touched.id) ? layoutFrame(next, touched.id) : next;
}

/** Posun přístroje v rámečku o pozici vlevo / vpravo (nahoru / dolů). */
export function moveInFrame(draft: FloorplanDraft, elementId: string, direction: -1 | 1): FloorplanDraft {
  const frame = frameOf(draft, elementId);
  if (!frame) return draft;
  const index = frame.members.indexOf(elementId);
  const target = index + direction;
  if (target < 0 || target >= frame.members.length) return draft;
  const members = [...frame.members];
  [members[index], members[target]] = [members[target], members[index]];
  // Nová kotva drží začátek rámečku staré kotvy (rámeček se neposouvá ani při výměně jednozásuvky za dvojzásuvku)
  const oldAnchor = draft.elements.find((element) => element.id === frame.members[0])!;
  const newAnchor = draft.elements.find((element) => element.id === members[0])!;
  const axis = frameAxis(oldAnchor.rotation);
  const shift = ((gangsOf(newAnchor) - gangsOf(oldAnchor)) / 2) * framePitch(draft, oldAnchor);
  const elements = draft.elements.map((element) => (element.id === members[0] ? { ...element, x: Math.round(oldAnchor.x + axis.x * shift), y: Math.round(oldAnchor.y + axis.y * shift) } : element));
  return layoutFrame({ ...draft, elements, frames: draft.frames.map((candidate) => (candidate.id === frame.id ? { ...candidate, members } : candidate)) }, frame.id);
}

/** Posun celého rámečku (tažení kteréhokoli přístroje rámečku). */
export function translateElements(draft: FloorplanDraft, ids: readonly string[], dx: number, dy: number): FloorplanDraft {
  if (!dx && !dy) return draft;
  const set = new Set(ids);
  return { ...draft, elements: draft.elements.map((element) => (set.has(element.id) ? { ...element, x: element.x + dx, y: element.y + dy } : element)) };
}

/** Otočení rámečku o 90° kolem kotvy (všechny přístroje stejně). */
export function rotateFrame(draft: FloorplanDraft, frameId: string): FloorplanDraft {
  const frame = draft.frames.find((candidate) => candidate.id === frameId);
  if (!frame) return draft;
  const anchor = draft.elements.find((element) => element.id === frame.members[0]);
  if (!anchor) return draft;
  const rotation = (anchor.rotation + 90) % 360;
  return layoutFrame({ ...draft, elements: draft.elements.map((element) => (frame.members.includes(element.id) ? { ...element, rotation } : element)) }, frameId);
}

/** Smazání prvků aktivního podlaží: z rámečků (rámeček s 1 přístrojem zanikne) a z párování na všech podlažích. */
export function removeElements(draft: FloorplanDraft, ids: readonly string[]): FloorplanDraft {
  const gone = new Set(ids);
  if (!gone.size) return draft;
  const touched = new Set(draft.frames.filter((frame) => frame.members.some((id) => gone.has(id))).map((frame) => frame.id));
  let next: FloorplanDraft = {
    ...draft,
    elements: draft.elements.filter((element) => !gone.has(element.id)),
    frames: draft.frames.map((frame) => ({ ...frame, members: frame.members.filter((id) => !gone.has(id)) })).filter((frame) => frame.members.length >= 2),
  };
  for (const frame of next.frames) if (touched.has(frame.id)) next = layoutFrame(next, frame.id);
  return mapAllElements(next, (element) => (element.controls.some((id) => gone.has(id)) ? { ...element, controls: element.controls.filter((id) => !gone.has(id)) } : element));
}

/** Přístroje, které se táhnou s prvkem: celý rámeček, jinak jen prvek sám. */
export const dragGroupOf = (draft: Pick<FloorplanDraft, "frames">, elementId: string): string[] => frameOf(draft, elementId)?.members ?? [elementId];

/** Obdélník rámečku ve výkresu (obálka značek) – kreslí se kolem přisazených přístrojů. */
export function frameOutline(draft: FloorplanDraft, frame: FrameGroup): { x: number; y: number; w: number; h: number } | null {
  const members = frame.members.map((id) => draft.elements.find((element) => element.id === id)).filter((element): element is EditorElement => Boolean(element));
  if (!members.length) return null;
  const anchor = members[0];
  const pitch = framePitch(draft, anchor);
  const axis = frameAxis(anchor.rotation);
  const along = members.map((element) => element.x * axis.x + element.y * axis.y);
  const across = anchor.x * axis.y + anchor.y * axis.x;
  const size = symbolSizeOf(draft, anchor);
  const half = pitch / 2;
  // Značky zásuvek leží „nožičkou“ u stěny – obálka jde od stěny do místnosti (natočení kotvy)
  const depth = size * 0.95;
  const inward = anchor.rotation === 0 || anchor.rotation === 270 ? 1 : -1;
  const lo = Math.min(...along) - half * (gangsOf(members[0]) > 1 ? 2 : 1);
  const hi = Math.max(...along) + half * (gangsOf(members[members.length - 1]) > 1 ? 2 : 1);
  const a0 = Math.min(across - size * 0.15 * inward, across + depth * inward);
  const a1 = Math.max(across - size * 0.15 * inward, across + depth * inward);
  return axis.x ? { x: lo, y: a0, w: hi - lo, h: a1 - a0 } : { x: a0, y: lo, w: a1 - a0, h: hi - lo };
}

// ---------------------------------------------------------------------------
//  Fáze 62: sestavy ve víceramečku přímo z palety, přidání přístroje do rámečku
// ---------------------------------------------------------------------------

/** Hotová sestava do víceramečku – pořadí členů = pořadí v rámečku (zleva doprava, shora dolů). */
export interface FrameAssembly {
  id: string;
  label: string;
  members: readonly string[];
}

export const FRAME_ASSEMBLIES: readonly FrameAssembly[] = [
  { id: "set-2z", label: "2× jednozásuvka", members: ["socket", "socket"] },
  { id: "set-3z", label: "3× jednozásuvka", members: ["socket", "socket", "socket"] },
  { id: "set-4z", label: "4× jednozásuvka", members: ["socket", "socket", "socket", "socket"] },
  { id: "set-2s1", label: "2× vypínač č. 1", members: ["switch-1", "switch-1"] },
  { id: "set-3s1", label: "3× vypínač č. 1", members: ["switch-1", "switch-1", "switch-1"] },
  { id: "set-s1-s6", label: "Vypínač č. 1 + přepínač č. 6", members: ["switch-1", "switch-6"] },
  { id: "set-s1-z", label: "Vypínač č. 1 + jednozásuvka", members: ["switch-1", "socket"] },
  { id: "set-s1-2z", label: "Vypínač č. 1 + 2× jednozásuvka", members: ["switch-1", "socket", "socket"] },
  { id: "set-z-rj", label: "Jednozásuvka + datová RJ45", members: ["socket", "data-socket"] },
  { id: "set-b2-z", label: "Sběrnicové tlačítko 2násobné + jednozásuvka", members: ["bus-2", "socket"] },
  { id: "set-b1-2z", label: "Sběrnicové tlačítko 1násobné + 2× jednozásuvka", members: ["bus-1", "socket", "socket"] },
];

/** Přístroje, které jdou na dané úrovni instalace do víceramečku (výběr pro vlastní sestavu). */
export const frameableItems = (level: InstallLevel): PaletteItem[] => paletteFor(level).filter((item) => isFrameable({ item: item.id }));

/** Hotové sestavy dostupné na úrovni instalace (všechny členy jsou v paletě úrovně). */
export function assembliesFor(level: InstallLevel): FrameAssembly[] {
  const available = new Set(frameableItems(level).map((item) => item.id));
  return FRAME_ASSEMBLIES.filter((assembly) => assembly.members.every((id) => available.has(id)));
}

/** Počet pozic sestavy (dvojzásuvka = 2). */
export const assemblyGangs = (members: readonly string[]) => members.reduce((sum, item) => sum + gangsOf({ item, frameUnits: 1 }), 0);

/** Popis vlastní sestavy: „Vypínač č. 1 + 2× Jednozásuvka“ (bez upřesnění v závorce, pořadí prvního výskytu). */
export function assemblyLabel(members: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of members) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => `${count > 1 ? `${count}× ` : ""}${(paletteItem(id)?.label ?? id).replace(/\s*\(.*\)$/, "")}`).join(" + ");
}

/**
 * Chyba sestavy (méně než 2 přístroje, nevhodný přístroj, víc pozic, než pojme rámeček řady – fáze 91), jinak null.
 * Bez limitu řady platí obecných 5 pozic.
 */
export function assemblyError(members: readonly string[], limit: FrameLimit = { max: MAX_FRAME_GANGS, text: null }): string | null {
  if (members.length < 2) return "Sestava potřebuje alespoň 2 přístroje.";
  const rejected = members.filter((id) => !isFrameable({ item: id }));
  if (rejected.length) return `Do rámečku nejdou: ${[...new Set(rejected.map((id) => paletteItem(id)?.label ?? id))].join(", ")}.`;
  const gangs = assemblyGangs(members);
  return gangs > Math.min(MAX_FRAME_GANGS, limit.max) ? overLimit(limit, gangs, "sestava má") : null;
}

/** Polohy členů sestavy podél osy rámečku se středem sestavy v bodě vložení (rozteč jako přisazení). */
export function assemblyLayout(draft: Pick<FloorplanDraft, "symbolScale">, members: readonly string[], at: { x: number; y: number; rotation: number; scale?: number | null }): { item: string; x: number; y: number }[] {
  const axis = frameAxis(at.rotation);
  const pitch = framePitch(draft, { scale: at.scale ?? null });
  const gangs = members.map((item) => gangsOf({ item, frameUnits: 1 }));
  const total = gangs.reduce((sum, value) => sum + value, 0);
  let start = 0;
  return members.map((item, index) => {
    const offset = (start + (gangs[index] - 1) / 2 - (total - 1) / 2) * pitch;
    start += gangs[index];
    return { item, x: Math.round(at.x + axis.x * offset), y: Math.round(at.y + axis.y * offset) };
  });
}

export type AssemblyResult = { ok: true; draft: FloorplanDraft; frameId: string; gangs: number; ids: string[] } | { ok: false; error: string };

export interface AssemblyAnchor {
  x: number;
  y: number;
  rotation: number;
  room: string;
  series: string | null;
  color: string | null;
}

/**
 * Vložení celé sestavy jedním klikem: přístroje se vytvoří v pořadí sestavy, vyrovnají a přisadí do jednoho rámečku
 * (společná výška, řada, barva a místnost – stejná pravidla jako „Vložit do víceramečku“). `ids` = předem
 * přidělená id členů (stejný výsledek i při opakovaném volání).
 */
export function placeAssembly(draft: FloorplanDraft, members: readonly string[], at: AssemblyAnchor, ids: readonly string[] = members.map(() => uid("e"))): AssemblyResult {
  const error = assemblyError(members, frameLimitOf(draft, { series: at.series, color: at.color }));
  if (error) return { ok: false, error };
  const elements: EditorElement[] = assemblyLayout(draft, members, at).map((slot, index) => ({ id: ids[index], item: slot.item, x: slot.x, y: slot.y, room: at.room, mountHeightMm: null, frameUnits: 1, series: at.series, color: at.color, controls: [], rotation: at.rotation, scale: null }));
  const result = createFrame({ ...draft, elements: [...draft.elements, ...elements] }, elements.map((element) => element.id));
  return result.ok ? { ...result, ids: elements.map((element) => element.id) } : result;
}

/**
 * „▦+“: přidá přístroj na konec rámečku vybraného přístroje (bez rámečku vznikne nový víceramček z obou). Nový
 * přístroj převezme natočení, místnost, řadu, barvu a měřítko; rámeček zůstane na místě a prodlouží se.
 */
export function addToFrame(draft: FloorplanDraft, elementId: string, itemId: string, id: string = uid("e")): AssemblyResult {
  const element = draft.elements.find((candidate) => candidate.id === elementId);
  if (!element) return { ok: false, error: "Přístroj v nákresu nenalezen." };
  if (!paletteItem(itemId)) return { ok: false, error: `Neznámý přístroj ${itemId}.` };
  const members = frameOf(draft, elementId)?.members ?? [elementId];
  const last = draft.elements.find((candidate) => candidate.id === members[members.length - 1]) ?? element;
  const axis = frameAxis(element.rotation);
  // Za poslední člen – pořadí v rámečku se bere podle polohy v ose
  const reach = (gangsOf(last) + 1) * framePitch(draft, element);
  const added: EditorElement = { id, item: itemId, x: Math.round(last.x + axis.x * reach), y: Math.round(last.y + axis.y * reach), room: element.room, mountHeightMm: null, frameUnits: 1, series: element.series, color: element.color, controls: [], rotation: element.rotation, scale: element.scale };
  const result = createFrame({ ...draft, elements: [...draft.elements, added] }, [...members, added.id]);
  return result.ok ? { ...result, ids: [added.id] } : result;
}

// ---------------------------------------------------------------------------
//  Vypínače → světla
// ---------------------------------------------------------------------------

/** Světla (všechna podlaží), která žádný vypínač / tlačítko neovládá. */
export function unpairedLights(draft: FloorplanDraft): EditorElement[] {
  const everything = allElements(draft);
  const controlled = new Set(everything.flatMap((element) => element.controls));
  return everything.filter((element) => paletteItem(element.item)?.kind === "light" && !controlled.has(element.id));
}

/** Ovladače světel bez přiřazeného svítidla. */
export const idleSwitches = (draft: FloorplanDraft): EditorElement[] => allElements(draft).filter((element) => controlsLights(paletteItem(element.item)) && !element.controls.length);

/**
 * „✨ Přiřadit automaticky“: každé světlo bez ovládání dostane nejbližší ovladač světel ve stejné místnosti a podlaží
 * (vypínač, tlačítko, sběrnicové i bezdrátové tlačítko). Místnost bez ovladače se přeskočí (zůstane v kontrole).
 */
export function autoPairLights(draft: FloorplanDraft): { draft: FloorplanDraft; paired: number; skipped: string[] } {
  const additions = new Map<string, string[]>();
  const skipped = new Set<string>();
  let paired = 0;
  const sheets = [draft.elements, ...draft.otherFloors.map((floor) => floor.elements)];
  const unpaired = new Set(unpairedLights(draft).map((element) => element.id));
  for (const elements of sheets) {
    for (const light of elements.filter((element) => unpaired.has(element.id))) {
      const candidates = elements.filter((element) => element.room === light.room && controlsLights(paletteItem(element.item)));
      if (!candidates.length) {
        skipped.add(light.room);
        continue;
      }
      const nearest = [...candidates].sort((a, b) => Math.hypot(a.x - light.x, a.y - light.y) - Math.hypot(b.x - light.x, b.y - light.y))[0];
      additions.set(nearest.id, [...(additions.get(nearest.id) ?? []), light.id]);
      paired++;
    }
  }
  if (!paired) return { draft, paired, skipped: [...skipped] };
  return { draft: mapAllElements(draft, (element) => (additions.has(element.id) ? { ...element, controls: [...new Set([...element.controls, ...additions.get(element.id)!])] } : element)), paired, skipped: [...skipped] };
}

/** Přepnutí vazby vypínač ↔ světlo (párování z kterékoli strany, i mezi podlažími). */
export const toggleLink = (draft: FloorplanDraft, switchId: string, lightId: string): FloorplanDraft =>
  mapAllElements(draft, (element) => (element.id === switchId ? { ...element, controls: element.controls.includes(lightId) ? element.controls.filter((id) => id !== lightId) : [...element.controls, lightId] } : element));

// ---------------------------------------------------------------------------
//  Zakreslení změn (Úprava PDF)
// ---------------------------------------------------------------------------

export const ANNOTATION_LABEL: Record<AnnotationKind, string> = { wall: "Nová příčka", demolish: "Bouraná konstrukce", zone: "Šrafovaná oblast", text: "Textové pole" };

/** Barvy zakreslení (nová konstrukce červeně, bourání žlutě / oranžově dle zvyklostí stavebních výkresů). */
export const ANNOTATION_COLORS = ["#dc2626", "#d97706", "#eab308", "#16a34a", "#2563eb", "#7c3aed", "#111827", "#ffffff"];

/** Tloušťky příček [mm] – sádrokarton 100 / 125, zděné 115 / 150, nosné 300. */
export const WALL_THICKNESSES = [75, 100, 125, 150, 200, 300];

/** Velikosti písma [mm půdorysu] – S / M / L / XL (1 : 50 = 3 / 5 / 8 / 12 mm na výkresu). */
export const FONT_SIZES = [
  { label: "S", mm: 150 },
  { label: "M", mm: 250 },
  { label: "L", mm: 400 },
  { label: "XL", mm: 600 },
];

/** Nová poznámka v nákresu (úsečka / obdélník / text) s výchozím vzhledem druhu. */
export function newAnnotation(kind: AnnotationKind, from: { x: number; y: number }, to: { x: number; y: number } = from): Annotation {
  const defaults = ANNOTATION_DEFAULTS[kind];
  return {
    id: uid("p"),
    kind,
    x: Math.round(from.x),
    y: Math.round(from.y),
    x2: Math.round(to.x),
    y2: Math.round(to.y),
    color: defaults.color,
    hatch: defaults.hatch,
    thicknessMm: defaults.thicknessMm,
    text: kind === "text" ? "Text" : "",
    fontMm: 250,
    bold: false,
    background: kind === "text",
  };
}

/** Úsečka příčky zarovnaná do vodorovné / svislé osy (bez klávesy Shift – většina příček je pravoúhlá). */
export function orthogonal(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

/** Obrys příčky / bourané konstrukce: obdélník kolem osy v tloušťce konstrukce [body polygonu]. */
export function wallPolygon(note: Pick<Annotation, "x" | "y" | "x2" | "y2" | "thicknessMm">): { x: number; y: number }[] {
  const length = Math.hypot(note.x2 - note.x, note.y2 - note.y) || 1;
  const nx = (-(note.y2 - note.y) / length) * (note.thicknessMm / 2);
  const ny = ((note.x2 - note.x) / length) * (note.thicknessMm / 2);
  return [
    { x: note.x + nx, y: note.y + ny },
    { x: note.x2 + nx, y: note.y2 + ny },
    { x: note.x2 - nx, y: note.y2 - ny },
    { x: note.x - nx, y: note.y - ny },
  ];
}

export const annotationLength = (note: Pick<Annotation, "x" | "y" | "x2" | "y2">) => Math.round(Math.hypot(note.x2 - note.x, note.y2 - note.y));

/** Obálka poznámky (výběr, ořez). */
export function annotationBounds(note: Annotation): { x: number; y: number; w: number; h: number } {
  if (note.kind === "text") {
    const lines = (note.text || " ").split("\n");
    const width = Math.max(...lines.map((line) => line.length)) * note.fontMm * 0.58 + note.fontMm * 0.6;
    return { x: note.x, y: note.y, w: width, h: lines.length * note.fontMm * 1.25 + note.fontMm * 0.35 };
  }
  const pad = note.kind === "zone" ? 0 : note.thicknessMm / 2;
  const x = Math.min(note.x, note.x2) - pad;
  const y = Math.min(note.y, note.y2) - pad;
  return { x, y, w: Math.abs(note.x2 - note.x) + pad * 2, h: Math.abs(note.y2 - note.y) + pad * 2 };
}

export const updateAnnotation = (draft: FloorplanDraft, id: string, patch: Partial<Omit<Annotation, "id" | "kind">>): FloorplanDraft => ({ ...draft, annotations: draft.annotations.map((note) => (note.id === id ? { ...note, ...patch } : note)) });

export const moveAnnotation = (draft: FloorplanDraft, id: string, dx: number, dy: number): FloorplanDraft =>
  !dx && !dy ? draft : { ...draft, annotations: draft.annotations.map((note) => (note.id === id ? { ...note, x: note.x + dx, y: note.y + dy, x2: note.x2 + dx, y2: note.y2 + dy } : note)) };

export const removeAnnotation = (draft: FloorplanDraft, id: string): FloorplanDraft => ({ ...draft, annotations: draft.annotations.filter((note) => note.id !== id) });

/** Souhrn zakreslených změn (dokumentace, kontrola): délky nových příček a bouraných konstrukcí [m]. */
export function annotationSummary(draft: Pick<FloorplanDraft, "annotations">) {
  const meters = (kind: AnnotationKind) => Math.round(draft.annotations.filter((note) => note.kind === kind).reduce((sum, note) => sum + annotationLength(note), 0) / 100) / 10;
  return { newWallsM: meters("wall"), demolishedM: meters("demolish"), zones: draft.annotations.filter((note) => note.kind === "zone").length, texts: draft.annotations.filter((note) => note.kind === "text").length };
}
