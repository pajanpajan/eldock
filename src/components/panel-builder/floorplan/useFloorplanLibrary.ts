"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { FLOORPLAN_LIBRARY_KEY, newestLibrary, parseFloorplanLibrary, type FloorplanLibrary } from "@/lib/panel-builder/floorplan-library";
import { saveFloorplanLibraryAction } from "@/server/actions/floorplans";

// Fáze 78: knihovna 2D půdorysu firmy (šablony sestav ve víceramečku, oblíbené ⭐) – prohlížeč (localStorage) i profil
// firmy, vyhrává novější. Změna se hned zapíše do prohlížeče a za 500 ms do firmy (víc změn za sebou = jedno uložení).

const listeners = new Set<() => void>();
let serverTimer: ReturnType<typeof setTimeout> | null = null;

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
    return window.localStorage.getItem(FLOORPLAN_LIBRARY_KEY);
  } catch {
    return null;
  }
}

export function useFloorplanLibrary(serverJson: string | null) {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const library = useMemo(() => newestLibrary(parseFloorplanLibrary(local), parseFloorplanLibrary(serverJson)), [local, serverJson]);
  const save = useCallback((next: FloorplanLibrary) => {
    try {
      window.localStorage.setItem(FLOORPLAN_LIBRARY_KEY, JSON.stringify(next));
    } catch {
      // soukromý režim – zůstane jen ve firmě
    }
    listeners.forEach((listener) => listener());
    if (serverTimer) clearTimeout(serverTimer);
    serverTimer = setTimeout(() => void saveFloorplanLibraryAction(next), 500);
  }, []);
  return [library, save] as const;
}
