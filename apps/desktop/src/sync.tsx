// Fáze 71: jádro synchronizace v rozhraní – jedna instance `SyncEngine` nad IndexedDB, stav pro hlavičku
// a automatická synchronizace (start, připojení k síti, každých 5 minut, krátce po zápisu úpravy).

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { SyncEngine, type EngineStatus, type SyncEvent, type SyncPhase, type SyncReport } from "@/sync-client";

import { bridge } from "./bridge";
import { db } from "./db";
import { IdbStore } from "./idb-store";

const AUTO_SYNC_MS = 5 * 60_000;
const AFTER_QUEUE_MS = 1500;

export interface Progress {
  phase: SyncPhase;
  pulled?: number;
  head?: number;
  done?: number;
  total?: number;
}

interface SyncContextValue {
  engine: SyncEngine;
  status: EngineStatus | undefined;
  syncing: boolean;
  progress: Progress | null;
  lastReport: SyncReport | null;
  online: boolean;
  syncNow: () => Promise<SyncReport | null>;
  /** Po zápisu úpravy: odeslat, jakmile to jde (je-li síť). */
  scheduleSync: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [tokenVersion, setTokenVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engine = useMemo(() => {
    const onEvent = (event: SyncEvent) => {
      if (event.type === "progress") setProgress({ phase: event.phase, pulled: event.pulled, head: event.head, done: event.done, total: event.total });
      if (event.type === "finished") {
        setLastReport(event.report);
        setProgress(null);
      }
      if (event.type === "paired" || event.type === "unpaired") setTokenVersion((value) => value + 1);
    };
    return new SyncEngine({ store: new IdbStore(db), tokens: bridge.token, platform: "WINDOWS", appVersion: __APP_VERSION__, onEvent });
  }, []);

  // Stav se přepočítá při každé změně metadat nebo fronty v IndexedDB (a po spárování / odpojení)
  const status = useLiveQuery(async () => {
    await Promise.all([db.meta.count(), db.outbox.count()]);
    return engine.status();
  }, [engine, tokenVersion]);

  const syncNow = useCallback(async () => {
    if (!(await engine.status()).paired) return null;
    setSyncing(true);
    try {
      return await engine.sync();
    } finally {
      setSyncing(false);
      setTokenVersion((value) => value + 1);
    }
  }, [engine]);

  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (navigator.onLine) void syncNow();
    }, AFTER_QUEUE_MS);
  }, [syncNow]);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      void syncNow();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const interval = setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, AUTO_SYNC_MS);
    // První synchronizace hned po startu (mimo tělo efektu)
    const initial = setTimeout(() => void syncNow(), 0);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [syncNow]);

  const value = useMemo(() => ({ engine, status, syncing, progress, lastReport, online, syncNow, scheduleSync }), [engine, status, syncing, progress, lastReport, online, syncNow, scheduleSync]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync mimo SyncProvider");
  return value;
}

/** Popis fáze synchronizace pro uživatele. */
export function progressLabel(progress: Progress | null): string {
  if (!progress) return "Synchronizuji…";
  switch (progress.phase) {
    case "session":
      return "Ověřuji spojení se serverem…";
    case "upload":
      return "Nahrávám fotky k úpravám…";
    case "push":
      return `Odesílám úpravy${progress.total ? ` (${(progress.done ?? 0) + 1}–${progress.total})` : ""}…`;
    case "pull":
      return progress.head ? `Stahuji data závodu (${progress.pulled ?? 0} změn)…` : "Stahuji data závodu…";
    case "files":
      return progress.total ? `Stahuji dokumenty pro offline (${(progress.done ?? 0) + 1} / ${progress.total})…` : "Stahuji dokumenty pro offline…";
  }
}
