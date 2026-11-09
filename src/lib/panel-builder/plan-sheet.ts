// Fáze 75: měřítko a obálka výkresu půdorysu pro tisk – sdílí tiskový list editoru (`FloorplanExport`) i příloha
// dokumentace rozváděče na serveru (chytré PDF). Čisté funkce bez React a bez prohlížeče.

import type { FloorplanDraft } from "./floorplan-editor";
import { roomPolygon } from "./room-geometry";

/** Normová měřítka výkresu 1 : N. */
export const PLAN_SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500] as const;

/** Obálka obsahu výkresu aktivního podlaží (místnosti, prvky, zakreslené změny) s okrajem 0,8 m [mm]. */
export function contentBox(draft: Pick<FloorplanDraft, "rooms" | "elements" | "annotations" | "widthMm" | "heightMm">) {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const room of draft.rooms) for (const point of roomPolygon(room)) add(point.x, point.y);
  for (const element of draft.elements) add(element.x, element.y);
  for (const note of draft.annotations) {
    add(note.x, note.y);
    add(note.x2, note.y2);
  }
  if (!xs.length) return { x: 0, y: 0, w: draft.widthMm, h: draft.heightMm };
  const pad = 800;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Nejmenší normové měřítko, ve kterém se obálka vejde do plochy papíru (mm). */
export const scaleForBox = (box: { w: number; h: number }, widthMm: number, heightMm: number) => PLAN_SCALES.find((scale) => box.w / scale <= widthMm && box.h / scale <= heightMm) ?? PLAN_SCALES[PLAN_SCALES.length - 1];

/** Měřítko podlaží nákresu pro plochu výkresu. */
export const planScaleFor = (draft: Pick<FloorplanDraft, "rooms" | "elements" | "annotations" | "widthMm" | "heightMm">, widthMm: number, heightMm: number) => scaleForBox(contentBox(draft), widthMm, heightMm);
