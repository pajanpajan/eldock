// Fáze 57: úprava podkladu 2D půdorysu (menu „Úprava PDF“) – otočení o 90°, ořez, zoom a kalibrace měřítka
// s ověřením. Podklad zůstává jeden nahraný obrázek; otočení a ořez se ukládají jako transformace, takže se
// nic znovu nenahrává, kvalita neklesá a měřítko (mm / px) zůstává platné. Čisté funkce.

import type { Annotation, EditorElement, EditorRoom, FloorplanDraft } from "./floorplan-editor";

export type Rotation = 0 | 90 | 180 | 270;
export const isRotation = (value: unknown): value is Rotation => value === 0 || value === 90 || value === 180 || value === 270;

/** Výřez podkladu v pixelech otočeného obrázku. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorplanBackground {
  url: string;
  /** Rozměr nahraného obrázku (před otočením) [px]. */
  widthPx: number;
  heightPx: number;
  /** Otočení po směru hodinových ručiček. */
  rotation: Rotation;
  /** Ořez v pixelech otočeného obrázku; null = celý podklad. */
  crop: CropRect | null;
  /** PDF: velikost stránky [pt] – ověření měřítka podle razítka výkresu (1 : 50, 1 : 100 …). */
  pagePt: { width: number; height: number } | null;
}

/** Nejmenší ořez [px] – menší výřez je spíš omyl než záměr. */
export const MIN_CROP_PX = 40;

/** Rozměr otočeného obrázku [px]. */
export function rotatedSize(background: Pick<FloorplanBackground, "widthPx" | "heightPx" | "rotation">) {
  return background.rotation === 90 || background.rotation === 270 ? { w: background.heightPx, h: background.widthPx } : { w: background.widthPx, h: background.heightPx };
}

/** Viditelná část otočeného podkladu [px]. */
export function visibleRect(background: FloorplanBackground): CropRect {
  const size = rotatedSize(background);
  return background.crop ?? { x: 0, y: 0, w: size.w, h: size.h };
}

/** Plocha výkresu [mm] z podkladu a měřítka. */
export function planExtent(background: FloorplanBackground, mmPerPx: number) {
  const rect = visibleRect(background);
  return { widthMm: Math.round(rect.w * mmPerPx), heightMm: Math.round(rect.h * mmPerPx) };
}

/**
 * SVG transformace podkladu v souřadnicích plánu [mm]: měřítko → posun o ořez → otočení obrázku.
 * `<image>` se kreslí v pixelech původního obrázku (0 0 widthPx heightPx).
 */
export function backgroundTransform(background: FloorplanBackground, mmPerPx: number): string {
  const { widthPx: w, heightPx: h } = background;
  const rect = visibleRect(background);
  const rotate = { 0: "", 90: `translate(${h} 0) rotate(90)`, 180: `translate(${w} ${h}) rotate(180)`, 270: `translate(0 ${w}) rotate(270)` }[background.rotation];
  return `scale(${mmPerPx}) translate(${-rect.x} ${-rect.y}) ${rotate}`.trim();
}

const rotatePoint = (x: number, y: number, heightMm: number) => ({ x: heightMm - y, y: x });
const rotateRect = (rect: { x: number; y: number; w: number; h: number }, heightMm: number) => ({ x: heightMm - (rect.y + rect.h), y: rect.x, w: rect.h, h: rect.w });
/** Fáze 63: místnost (i mnohoúhelník) a ruční trasy se otáčejí / posouvají s podkladem. */
const mapRoom = (room: EditorRoom, map: (x: number, y: number) => { x: number; y: number }, rect: (room: EditorRoom) => { x: number; y: number; w: number; h: number }): EditorRoom => {
  if (!room.points?.length) return { ...room, ...rect(room) };
  const points = room.points.map((point) => map(point.x, point.y));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { ...room, points, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const mapEdits = (edits: FloorplanDraft["routeEdits"] | undefined, map: (x: number, y: number) => { x: number; y: number }) =>
  Object.fromEntries(Object.entries(edits ?? {}).map(([key, points]) => [key, points.map((point) => map(point.x, point.y))]));

/** Otočení celého nákresu o 90° po směru (podklad, ořez, místnosti i značky); proti směru = 3× po směru. */
export function rotateDraft(draft: FloorplanDraft, direction: 1 | -1 = 1): FloorplanDraft {
  let next = draft;
  for (let step = 0; step < (direction === 1 ? 1 : 3); step++) next = rotateClockwise(next);
  return next;
}

function rotateClockwise(draft: FloorplanDraft): FloorplanDraft {
  const heightMm = draft.heightMm;
  const background = draft.background;
  let rotated: FloorplanBackground | null = null;
  if (background) {
    const size = rotatedSize(background);
    const crop = background.crop ? { x: size.h - (background.crop.y + background.crop.h), y: background.crop.x, w: background.crop.h, h: background.crop.w } : null;
    rotated = { ...background, rotation: (((background.rotation + 90) % 360) as Rotation), crop };
  }
  return {
    ...draft,
    background: rotated,
    widthMm: draft.heightMm,
    heightMm: draft.widthMm,
    rooms: draft.rooms.map((room) => mapRoom(room, (x, y) => rotatePoint(x, y, heightMm), (rect) => rotateRect(rect, heightMm))),
    elements: draft.elements.map((element) => ({ ...element, ...rotatePoint(element.x, element.y, heightMm), rotation: (element.rotation + 90) % 360 })),
    routeEdits: mapEdits(draft.routeEdits, (x, y) => rotatePoint(x, y, heightMm)),
    // Fáze 59: zakreslené změny se otáčejí s podkladem (text zůstává vodorovně čitelný)
    annotations: (draft.annotations ?? []).map((note): Annotation => {
      const a = rotatePoint(note.x, note.y, heightMm);
      const b = rotatePoint(note.x2, note.y2, heightMm);
      return { ...note, x: a.x, y: a.y, x2: b.x, y2: b.y };
    }),
  };
}

const inside = (rect: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

/** Kolik prvků a místností ořez vyřadí (pro potvrzení před oříznutím). */
export function cropImpact(draft: Pick<FloorplanDraft, "elements" | "rooms"> & Partial<Pick<FloorplanDraft, "annotations">>, rectMm: { x: number; y: number; w: number; h: number }) {
  const elements = draft.elements.filter((element) => !inside(rectMm, element.x, element.y)).length;
  const rooms = draft.rooms.filter((room) => clipRoom(room, rectMm) === null).length;
  const annotations = (draft.annotations ?? []).filter((note) => !keepsNote(note, rectMm)).length;
  return { elements, rooms, annotations };
}

/** Zakreslená změna zůstane po ořezu, pokud do výřezu zasahuje aspoň jedním bodem. */
const keepsNote = (note: Annotation, rect: { x: number; y: number; w: number; h: number }) => inside(rect, note.x, note.y) || inside(rect, note.x2, note.y2);

function clipRoom(room: EditorRoom, rect: { x: number; y: number; w: number; h: number }): EditorRoom | null {
  // Fáze 63: mnohoúhelník se neořezává – zůstane celý, pokud jeho obálka do výřezu zasahuje aspoň 0,5 × 0,5 m
  if (room.points?.length) {
    const w = Math.min(room.x + room.w, rect.x + rect.w) - Math.max(room.x, rect.x);
    const h = Math.min(room.y + room.h, rect.y + rect.h) - Math.max(room.y, rect.y);
    return w >= 500 && h >= 500 ? room : null;
  }
  const x = Math.max(room.x, rect.x);
  const y = Math.max(room.y, rect.y);
  const w = Math.min(room.x + room.w, rect.x + rect.w) - x;
  const h = Math.min(room.y + room.h, rect.y + rect.h) - y;
  return w >= 500 && h >= 500 ? { ...room, x, y, w, h } : null;
}

/**
 * Ořez podkladu obdélníkem v mm plánu: nový výřez, plocha výkresu a posun místností i značek. Značky mimo
 * výřez se odstraní (i z párování), místnosti se zkrátí na výřez. Měřítko se nemění.
 */
export function cropDraft(draft: FloorplanDraft, rectMm: { x: number; y: number; w: number; h: number }): FloorplanDraft {
  const background = draft.background;
  if (!background) return draft;
  const current = visibleRect(background);
  const k = draft.mmPerPx;
  const x = Math.max(0, rectMm.x);
  const y = Math.max(0, rectMm.y);
  const w = Math.min(draft.widthMm, rectMm.x + rectMm.w) - x;
  const h = Math.min(draft.heightMm, rectMm.y + rectMm.h) - y;
  if (w / k < MIN_CROP_PX || h / k < MIN_CROP_PX) return draft;
  const crop: CropRect = { x: current.x + x / k, y: current.y + y / k, w: w / k, h: h / k };
  const clip = { x, y, w, h };
  const kept = draft.elements.filter((element) => inside(clip, element.x, element.y));
  const keptIds = new Set(kept.map((element) => element.id));
  // Párování na jiná podlaží zůstává (prvky jiných podlaží ořez nemění)
  const elsewhere = new Set((draft.otherFloors ?? []).flatMap((floor) => floor.elements.map((element) => element.id)));
  return {
    ...draft,
    background: { ...background, crop },
    widthMm: Math.round(w),
    heightMm: Math.round(h),
    rooms: draft.rooms
      .map((room) => clipRoom(room, clip))
      .filter((room): room is EditorRoom => room !== null)
      .map((room) => mapRoom(room, (px, py) => ({ x: px - x, y: py - y }), (rect) => ({ x: rect.x - x, y: rect.y - y, w: rect.w, h: rect.h }))),
    routeEdits: mapEdits(draft.routeEdits, (px, py) => ({ x: px - x, y: py - y })),
    elements: kept.map((element): EditorElement => ({ ...element, x: element.x - x, y: element.y - y, controls: element.controls.filter((id) => keptIds.has(id) || elsewhere.has(id)) })),
    frames: (draft.frames ?? []).map((frame) => ({ ...frame, members: frame.members.filter((id) => keptIds.has(id)) })).filter((frame) => frame.members.length >= 2),
    annotations: (draft.annotations ?? []).filter((note) => keepsNote(note, clip)).map((note) => ({ ...note, x: note.x - x, y: note.y - y, x2: note.x2 - x, y2: note.y2 - y })),
  };
}

/** Zrušení ořezu: celý podklad, místnosti a značky se posunou zpět na své místo ve výkresu. */
export function resetCrop(draft: FloorplanDraft): FloorplanDraft {
  const background = draft.background;
  if (!background?.crop) return draft;
  const dx = background.crop.x * draft.mmPerPx;
  const dy = background.crop.y * draft.mmPerPx;
  const next = { ...background, crop: null };
  return {
    ...draft,
    background: next,
    ...planExtent(next, draft.mmPerPx),
    rooms: draft.rooms.map((room) => mapRoom(room, (x, y) => ({ x: Math.round(x + dx), y: Math.round(y + dy) }), (rect) => ({ x: Math.round(rect.x + dx), y: Math.round(rect.y + dy), w: rect.w, h: rect.h }))),
    elements: draft.elements.map((element) => ({ ...element, x: Math.round(element.x + dx), y: Math.round(element.y + dy) })),
    annotations: (draft.annotations ?? []).map((note) => ({ ...note, x: Math.round(note.x + dx), y: Math.round(note.y + dy), x2: Math.round(note.x2 + dx), y2: Math.round(note.y2 + dy) })),
    routeEdits: mapEdits(draft.routeEdits, (x, y) => ({ x: Math.round(x + dx), y: Math.round(y + dy) })),
  };
}

// ---------------------------------------------------------------------------
//  Zoom a posun pohledu
// ---------------------------------------------------------------------------

export interface PlanView {
  x: number;
  y: number;
  /** Šířka výřezu [mm]; výška se dopočte z poměru stran výkresu. */
  w: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 16;
export const ZOOM_STEP = 1.25;

export const fitView = (draft: Pick<FloorplanDraft, "widthMm">): PlanView => ({ x: 0, y: 0, w: draft.widthMm });
export const zoomOf = (view: PlanView, draft: Pick<FloorplanDraft, "widthMm">) => draft.widthMm / view.w;

/** Výřez se drží uvnitř výkresu (poměr stran = poměr výkresu, takže plátno nemění výšku). */
export function clampView(view: PlanView, draft: Pick<FloorplanDraft, "widthMm" | "heightMm">): PlanView {
  const w = Math.min(draft.widthMm, Math.max(draft.widthMm / ZOOM_MAX, view.w));
  const h = (w * draft.heightMm) / draft.widthMm;
  return { w, x: Math.min(Math.max(0, view.x), draft.widthMm - w), y: Math.min(Math.max(0, view.y), draft.heightMm - h) };
}

/** Zoom kolem bodu (kurzor / střed): bod zůstane na stejném místě obrazovky. `factor` > 1 = přiblížit. */
export function zoomView(view: PlanView, draft: Pick<FloorplanDraft, "widthMm" | "heightMm">, factor: number, focus?: { x: number; y: number }): PlanView {
  const h = (view.w * draft.heightMm) / draft.widthMm;
  const center = focus ?? { x: view.x + view.w / 2, y: view.y + h / 2 };
  const w = view.w / factor;
  const ratio = w / view.w;
  return clampView({ w, x: center.x - (center.x - view.x) * ratio, y: center.y - (center.y - view.y) * ratio }, draft);
}

export const viewBoxOf = (view: PlanView, draft: Pick<FloorplanDraft, "widthMm" | "heightMm">) => `${view.x} ${view.y} ${view.w} ${(view.w * draft.heightMm) / draft.widthMm}`;

// ---------------------------------------------------------------------------
//  Kalibrace měřítka s ověřením
// ---------------------------------------------------------------------------

/** Povolená odchylka ověřovací kóty [%] – víc znamená špatně odečtenou kótu nebo nestejné měřítko os. */
export const CALIBRATION_TOLERANCE_PCT = 2;

export type CalibrationState = "none" | "set" | "verified";

export interface CalibrationRecord {
  state: CalibrationState;
  /** Kalibrační kóta [mm] a ověřovací kóta (naměřeno / zadáno). */
  referenceMm: number | null;
  check: { measuredMm: number; expectedMm: number; deviationPct: number } | null;
  /** Měřítko výkresu z razítka (50 = 1 : 50), pokud ho uživatel zadal. */
  drawingScale: number | null;
  /** Odchylka kalibrace od měřítka výkresu [%] (jen PDF se známou velikostí stránky). */
  scaleDeviationPct: number | null;
  at: number | null;
}

export const emptyCalibration = (): CalibrationRecord => ({ state: "none", referenceMm: null, check: null, drawingScale: null, scaleDeviationPct: null, at: null });

export const DRAWING_SCALES = [20, 25, 50, 75, 100, 200, 250, 500] as const;

/** Délka úsečky ze 2 kliků [mm plánu]. */
export const segmentLength = (points: readonly { x: number; y: number }[]) => (points.length < 2 ? 0 : Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));

/** Odchylka naměřené délky od očekávané [%] se znaménkem. */
export const deviationPct = (measuredMm: number, expectedMm: number) => (expectedMm > 0 ? Math.round(((measuredMm - expectedMm) / expectedMm) * 1000) / 10 : 0);

/** Náhled kalibrace: nové měřítko a plocha výkresu po zadání skutečné délky kóty. */
export function calibrationPreview(draft: Pick<FloorplanDraft, "mmPerPx" | "widthMm" | "heightMm">, segmentMm: number, realMm: number) {
  const ratio = segmentMm > 0 && realMm > 0 ? realMm / segmentMm : 1;
  return { ratio, mmPerPx: draft.mmPerPx * ratio, widthMm: Math.round(draft.widthMm * ratio), heightMm: Math.round(draft.heightMm * ratio) };
}

/**
 * Měřítko podle razítka výkresu: PDF stránka má známou velikost v pt, takže 1 px podkladu = (šířka stránky v mm / šířka
 * obrázku v px) × měřítko. Vrací mm / px, nebo null (obrázek bez rozměru stránky).
 */
export function mmPerPxFromDrawingScale(background: Pick<FloorplanBackground, "pagePt" | "widthPx"> | null, scale: number): number | null {
  if (!background?.pagePt || !(scale > 0) || !(background.widthPx > 0)) return null;
  return ((background.pagePt.width * 25.4) / 72 / background.widthPx) * scale;
}

/** Plausibilita plochy výkresu (rodinný dům až hala): varování při zjevně chybném měřítku. */
export function extentWarning(widthMm: number, heightMm: number): string | null {
  const longer = Math.max(widthMm, heightMm);
  if (longer < 3000) return `Plocha výkresu vychází jen ${(longer / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m – nezadali jste délku v metrech místo milimetrů?`;
  if (longer > 250_000) return `Plocha výkresu vychází ${(longer / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} m – zkontrolujte jednotky zadané délky.`;
  return null;
}
