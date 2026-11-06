// Fáze 59: víceramečky (2R–5R z různých přístrojů s vyrovnáním a přisazením), zakreslení změn do podkladu (nová
// příčka, bouraná konstrukce, šrafovaná oblast, textové pole) a přiřazení vypínačů ke světlům. Čisté funkce nad
// nákresem (aktivní podlaží), bezpečné pro klient i server.

import { DEFAULT_ELEVATION, mountHeight } from "@/engine/floorplan-bridge";

import {
  ANNOTATION_DEFAULTS,
  allElements,
  controlsLights,
  frameAxis,
  mapAllElements,
  paletteItem,
  symbolSizeOf,
  type Annotation,
  type AnnotationKind,
  type EditorElement,
  type FloorplanDraft,
  type FrameGroup,
} from "./floorplan-editor";
import type { Rotation } from "./floorplan-pdf";

let sequence = 0;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(sequence++).toString(36)}`;

// ---------------------------------------------------------------------------
//  Víceramečky
// ---------------------------------------------------------------------------

/** Víceramček pojme nejvýš 5 pozic (rámečky 1R–5R v řadách ABB i ostatních výrobců). */
export const MAX_FRAME_GANGS = 5;

/** Přístroj do víceramečku: zásuvky (dvojzásuvka = 2 pozice), datová zásuvka, vypínače a tlačítka na stěně. */
export function isFrameable(element: Pick<EditorElement, "item">): boolean {
  const item = paletteItem(element.item);
  if (!item || item.wireless) return false;
  if (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket") return true;
  if (item.kind !== "switch") return false;
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
  if (!item || item.kind === "panel" || item.kind === "riser") return draft.profile?.switchboardHeightMm ?? DEFAULT_ELEVATION.switchboardHeightMm;
  return mountHeight({ kind: item.kind, variant: item.variant, tag: item.tag, ...(element.mountHeightMm !== null ? { mountHeightMm: element.mountHeightMm } : item.heightMm ? { mountHeightMm: item.heightMm } : {}) }, draft.profile ?? DEFAULT_ELEVATION);
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
  let start = 0;
  for (const id of frame.members) {
    const member = draft.elements.find((element) => element.id === id);
    if (!member) continue;
    const gangs = gangsOf(member);
    const offset = (start + (gangs - 1) / 2) * pitch;
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
  const counts = new Map<Rotation, number>();
  for (const element of picked) counts.set(element.rotation, (counts.get(element.rotation) ?? 0) + 1);
  const rotation = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const axis = frameAxis(rotation);
  const ordered = [...picked].sort((a, b) => a.x * axis.x + a.y * axis.y - (b.x * axis.x + b.y * axis.y) || a.id.localeCompare(b.id));
  const anchor = ordered[0];
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
  // Nová kotva drží polohu staré kotvy (rámeček se neposouvá)
  const oldAnchor = draft.elements.find((element) => element.id === frame.members[0])!;
  const elements = draft.elements.map((element) => (element.id === members[0] ? { ...element, x: oldAnchor.x, y: oldAnchor.y } : element));
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
  const rotation = ((anchor.rotation + 90) % 360) as Rotation;
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
