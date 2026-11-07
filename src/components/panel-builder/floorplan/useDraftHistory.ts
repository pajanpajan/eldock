"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

import { TIMED_GROUP, initHistory, recordChange, redo as redoStep, undo as undoStep, type History } from "@/lib/panel-builder/draft-history";

/**
 * Fáze 64: stav nákresu s historií Zpět / Znovu. `setDraft` se používá stejně jako u `useState`. Úpravy během jednoho
 * stisku ukazatele (tažení prvku, místnosti, trasy …) tvoří jeden krok – gesto začíná stiskem kdekoli na stránce
 * a končí puštěním; úpravy z klávesnice a formulářů se slučují podle času (`COALESCE_MS`).
 */
export function useDraftHistory<T>(initial: () => T) {
  const [history, setHistory] = useState<History<T>>(() => initHistory(initial()));
  const gesture = useRef<string | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    const open = (prefix: string) => {
      counter.current += 1;
      gesture.current = `${prefix}${counter.current}`;
      return gesture.current;
    };
    /** Konec skupiny až po doběhnutí obsluhy události (úpravy v onUp / onClick ještě patří ke gestu). */
    const closeLater = (key: string | null) => window.setTimeout(() => gesture.current === key && (gesture.current = null), 0);
    const down = () => void open("g");
    const up = () => void closeLater(gesture.current);
    // Klik na tlačítko = vlastní krok (dvě rychlá kliknutí se nesloučí)
    const click = () => void closeLater(open("c"));
    const blur = () => void (gesture.current = null);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("click", click, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const setDraft = useCallback((update: SetStateAction<T>) => {
    const group = gesture.current ?? TIMED_GROUP;
    const now = Date.now();
    setHistory((state) => recordChange(state, typeof update === "function" ? (update as (current: T) => T)(state.present) : update, { group, now }));
  }, []);
  const undo = useCallback(() => setHistory((state) => undoStep(state)), []);
  const redo = useCallback(() => setHistory((state) => redoStep(state)), []);
  /** Nový stav bez historie (načtení verze ze serveru). */
  const reset = useCallback((next: T) => setHistory(initHistory(next)), []);
  const gestureActive = useCallback(() => gesture.current !== null, []);

  return { draft: history.present, setDraft, undo, redo, reset, canUndo: history.past.length > 0, canRedo: history.future.length > 0, gestureActive };
}
