"use client";

import { useCallback, useSyncExternalStore } from "react";

// Technik, osvědčení a měřicí přístroj si zařízení pamatuje (localStorage) – technik je
// zadá jednou a hromadná i rychlá revize je předvyplní. Bez úložiště platí výchozí demo hodnoty.

export interface InspectorProfile {
  name: string;
  license: string;
  instrument: string;
}

export const DEFAULT_INSPECTOR: InspectorProfile = {
  name: "Miroslav Beneš",
  license: "TIČR č. E-1432/2023 (E2A)",
  instrument: "Metrel MI 3309 BT",
};

const KEY = "digitry-inspector";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedProfile: InspectorProfile = DEFAULT_INSPECTOR;
/** Úložiště nefunguje → profil jen v paměti. */
let memoryOnly = false;

function read(): InspectorProfile {
  if (memoryOnly) return cachedProfile;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedProfile;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<InspectorProfile>) : {};
    cachedProfile = {
      name: typeof parsed.name === "string" ? parsed.name : DEFAULT_INSPECTOR.name,
      license: typeof parsed.license === "string" ? parsed.license : DEFAULT_INSPECTOR.license,
      instrument: typeof parsed.instrument === "string" ? parsed.instrument : DEFAULT_INSPECTOR.instrument,
    };
  } catch {
    cachedProfile = DEFAULT_INSPECTOR;
  }
  return cachedProfile;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useInspectorProfile(): [InspectorProfile, (patch: Partial<InspectorProfile>) => void] {
  const profile = useSyncExternalStore(subscribe, read, () => DEFAULT_INSPECTOR);
  const update = useCallback((patch: Partial<InspectorProfile>) => {
    const next = { ...read(), ...patch };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Bez úložiště (soukromé okno) se profil drží jen v paměti.
      memoryOnly = true;
      cachedProfile = next;
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [profile, update];
}
