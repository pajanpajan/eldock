"use client";

import { useCallback, useSyncExternalStore } from "react";

// Fáze 114: volba „[✓] Spojovat překrývající se obdélníky do jedné L-místnosti“ (nástroje Kreslit místnost a roh ➔ roh) –
// ve výchozím stavu zapnutá, pamatuje si ji prohlížeč.

export const MERGE_RECTS_KEY = "eldock-floorplan-merge-rects";

const listeners = new Set<() => void>();
/** Záloha volby, když prohlížeč úložiště nepustí (soukromý režim). */
let memory: string | null = null;

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
    return window.localStorage.getItem(MERGE_RECTS_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function useMergeRects() {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const enabled = local !== "0";
  const setEnabled = useCallback((next: boolean) => {
    memory = next ? "1" : "0";
    try {
      window.localStorage.setItem(MERGE_RECTS_KEY, memory);
    } catch {
      // soukromý režim prohlížeče – volba platí do obnovení stránky (záloha v paměti)
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [enabled, setEnabled] as const;
}
