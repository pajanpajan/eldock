"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_SWITCH_LINKS, SWITCH_LINK_KEY, isSwitchLinkMode, type SwitchLinkMode } from "@/lib/panel-builder/switch-links";

// Fáze 112: volba „📐 Vazby vypínačů: Pravoúhlé CAD | Přímé | Skrýt“ – pamatuje si ji prohlížeč (stejně v editoru i tisku).

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
    return window.localStorage.getItem(SWITCH_LINK_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function useSwitchLinkMode() {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const mode: SwitchLinkMode = isSwitchLinkMode(local) ? local : DEFAULT_SWITCH_LINKS;
  const setMode = useCallback((next: SwitchLinkMode) => {
    memory = next;
    try {
      window.localStorage.setItem(SWITCH_LINK_KEY, next);
    } catch {
      // soukromý režim prohlížeče – volba platí do obnovení stránky (záloha v paměti)
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [mode, setMode] as const;
}
