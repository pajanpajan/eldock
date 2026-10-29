// Navigace v knize dokumentace na kartě zařízení: list a sloupec v URL (`?tab=schema&sheet=4&col=6`).
// Používá nativní `history.replaceState` (Next.js ho synchronizuje s `useSearchParams`) – bez dotazu na server.

export type SheetTarget = number | "orig";

/** Query string karty zařízení s otevřeným listem (a volitelně zvýrazněným sloupcem). */
export function sheetSearch(current: string, sheet: SheetTarget, column?: number | null): string {
  const params = new URLSearchParams(current);
  params.set("tab", "schema");
  params.set("sheet", String(sheet));
  if (column) params.set("col", String(column));
  else params.delete("col");
  return `?${params}`;
}

/** Otevře list knihy (záložka Schéma) a zvýrazní sloupec cíle křížového odkazu. */
export function openSheet(sheet: SheetTarget, column?: number | null) {
  window.history.replaceState(null, "", `${window.location.pathname}${sheetSearch(window.location.search, sheet, column)}`);
}

/** Typy zařízení s vlastním rozváděčem → kniha PCSCHEMATIC a diagnostika spojů. */
export const PANEL_BOOK_TYPES = ["SWITCHBOARD", "PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL"] as const;

export const hasPanelBook = (type: string) => (PANEL_BOOK_TYPES as readonly string[]).includes(type);
