// Fáze 74: úpravy rozváděčů 2D půdorysu – kód nového podružného rozváděče, ruční přiřazení prvků a okruhů k rozváděči,
// popisy pro soupis a výkres. Model (seznam rozváděčů, automatické přiřazení) je ve `floorplan-editor.ts`
// (`boardsOf`, `boardOfElement`) – výpočet tras ho potřebuje v `buildPlan`. Čisté funkce.

import { MAIN_BOARD } from "@/engine/floorplan-bridge";

import { BOARD_CODE, boardsOf, floorsOf, hasBoard, mapAllElements, type BoardInfo, type FloorplanDraft } from "./floorplan-editor";

export { MAIN_BOARD };
export { BOARD_CODE, SUBPANEL_CODE, SUBPANEL_ITEM, autoBoard, boardOfElement, boardsOf, hasBoard, isSubpanel, type BoardInfo } from "./floorplan-editor";

/** První volný kód podružného rozváděče (RP1 … RP99); null = vše obsazeno. */
export function nextBoardCode(draft: FloorplanDraft): string | null {
  const used = new Set(boardsOf(draft).map((board) => board.code));
  for (let index = 1; index <= 99; index++) if (!used.has(`RP${index}`)) return `RP${index}`;
  return null;
}

/** „RH – hlavní rozváděč (Chodba)“ / „RP1 – podružný rozváděč (Garáž)“. */
export function boardLabel(board: Pick<BoardInfo, "code" | "main" | "room">, options: { room?: boolean } = {}): string {
  const base = board.main ? `${board.code} – hlavní rozváděč` : `${board.code} – podružný rozváděč`;
  return options.room === false || !board.room ? base : `${base} (${board.room})`;
}

/** Ruční přiřazení prvků k rozváděči (`code` null = automaticky). Rozváděče a předměty beze změny. */
export function assignBoard(draft: FloorplanDraft, elementIds: readonly string[], code: string | null): FloorplanDraft {
  if (code !== null && !BOARD_CODE.test(code)) return draft;
  const ids = new Set(elementIds);
  let changed = false;
  const next = mapAllElements(draft, (element) => {
    if (!ids.has(element.id) || !hasBoard(element) || (element.board ?? null) === code) return element;
    changed = true;
    if (code === null) {
      const rest = { ...element };
      delete rest.board;
      return rest;
    }
    return { ...element, board: code };
  });
  return changed ? next : draft;
}

/** Po smazání podružného rozváděče: ruční přiřazení k němu se zruší (prvky přejdou automaticky jinam). */
export function releaseBoard(draft: FloorplanDraft, code: string): FloorplanDraft {
  const ids = floorsOf(draft).flatMap((floor) => floor.elements.filter((element) => element.board === code).map((element) => element.id));
  return ids.length ? assignBoard(draft, ids, null) : draft;
}

/** Označení jističe s rozváděčem pro výkres a soupis („-F3“ jen s hlavním rozváděčem, jinak „RH -F3“ / „RP1 -F3“). */
export const boardDesignation = (board: string | undefined, designation: string | null | undefined, multiple: boolean) =>
  designation ? (multiple || (board && board !== MAIN_BOARD) ? `${board ?? MAIN_BOARD} ${designation}` : designation) : null;
