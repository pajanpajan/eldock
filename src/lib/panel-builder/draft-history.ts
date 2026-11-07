// Fáze 64: Zpět / Znovu v editoru 2D půdorysu – čistá logika historie úprav. Jedno tažení (gesto ukazatele) nebo
// rychlá série úprav s mezerami do 700 ms (psaní do pole, opakované R) = jeden krok. Nová úprava po „Zpět“ smaže
// „Znovu“. Drží posledních 100 kroků; stavy jsou neměnné objekty, takže kroky sdílejí nezměněné části.

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 700;
/** Skupina úprav mimo gesto (klávesnice, formuláře, tlačítka) – slučuje se podle času. */
export const TIMED_GROUP = "t";

export interface History<T> {
  present: T;
  past: T[];
  future: T[];
  /** Skupina poslední úpravy (`g12` = tažení, `t` = rychlá série) a čas poslední úpravy [ms]. */
  group: string | null;
  at: number;
}

export const initHistory = <T>(present: T): History<T> => ({ present, past: [], future: [], group: null, at: 0 });

/** Úprava nákresu: buď nový krok, nebo sloučení s předchozím krokem stejné skupiny. */
export function recordChange<T>(state: History<T>, next: T, { group, now }: { group: string; now: number }): History<T> {
  if (Object.is(next, state.present)) return state;
  const merge = state.group === group && (group !== TIMED_GROUP || now - state.at <= COALESCE_MS);
  return { present: next, past: merge ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT), future: [], group, at: now };
}

export function undo<T>(state: History<T>): History<T> {
  if (!state.past.length) return state;
  return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, HISTORY_LIMIT), group: null, at: 0 };
}

export function redo<T>(state: History<T>): History<T> {
  if (!state.future.length) return state;
  const [next, ...rest] = state.future;
  return { present: next, past: [...state.past, state.present].slice(-HISTORY_LIMIT), future: rest, group: null, at: 0 };
}

export const canUndo = (state: History<unknown>) => state.past.length > 0;
export const canRedo = (state: History<unknown>) => state.future.length > 0;
