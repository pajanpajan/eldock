"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { FloorplanLibrary } from "@/lib/panel-builder/floorplan-library";
import { FLOORPLAN_UI_MODE_KEY, resolveUiMode, type FloorplanUiMode } from "@/lib/panel-builder/floorplan-wizard";

// Fáze 89: režim lišty 2D půdorysu – průvodce v 5 krocích / kompaktní CAD lišta. Volba se uloží do prohlížeče
// (`eldock-floorplan-ui-mode`) a do profilu firmy (knihovna půdorysu), takže zkušenému projektantovi zůstane
// průvodce vypnutý i na jiném počítači.

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readLocal(): string | null {
  try {
    return window.localStorage.getItem(FLOORPLAN_UI_MODE_KEY);
  } catch {
    return null;
  }
}

export function useFloorplanUiMode(library: FloorplanLibrary, saveLibrary: (next: FloorplanLibrary) => void) {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const mode = resolveUiMode(local, library.uiMode);
  const setMode = useCallback(
    (next: FloorplanUiMode) => {
      try {
        window.localStorage.setItem(FLOORPLAN_UI_MODE_KEY, next);
      } catch {
        // soukromý režim – zůstane jen v profilu firmy
      }
      listeners.forEach((listener) => listener());
      if (library.uiMode !== next) saveLibrary({ ...library, uiMode: next, updatedAt: Date.now() });
    },
    [library, saveLibrary],
  );
  return [mode, setMode] as const;
}
