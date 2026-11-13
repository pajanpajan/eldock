"use client";

import { useCallback, useSyncExternalStore } from "react";

import { SYMBOL_COLOR_KEY, parseSymbolColor, serializeSymbolColor, type SymbolColorSetting } from "@/lib/panel-builder/symbol-colors";

// Fáze 109: „🎨 Barva značek“ na plátně 2D půdorysu – volba se pamatuje v prohlížeči (ne v projektu: je to pohled
// projektanta, výkres a export zůstávají podle ČSN).

const listeners = new Set<() => void>();
/** Záloha volby bez úložiště prohlížeče (soukromý režim) – platí do zavření stránky. */
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
    return window.localStorage.getItem(SYMBOL_COLOR_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function useSymbolColor() {
  const raw = useSyncExternalStore(subscribe, readLocal, () => null);
  const setting = parseSymbolColor(raw);
  const setSetting = useCallback((next: SymbolColorSetting) => {
    memory = serializeSymbolColor(next);
    try {
      window.localStorage.setItem(SYMBOL_COLOR_KEY, serializeSymbolColor(next));
    } catch {
      // soukromý režim – volba platí do zavření stránky
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [setting, setSetting] as const;
}
