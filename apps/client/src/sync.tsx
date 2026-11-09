// Fáze 71 a 73: jádro synchronizace v rozhraní – jedna instance `SyncEngine` nad IndexedDB (v mobilní aplikaci se
// zrcadlem fronty v souborech aplikace), stav pro hlavičku a automatická synchronizace: start, připojení k síti,
// návrat aplikace do popředí, každých 5 minut a krátce po zápisu úpravy. Mobil navíc připomene synchronizaci
// oznámením 24 h po poslední úplné synchronizaci.

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { SYNC_POLICY } from "@/lib/sync";
import { DurableStore, SyncEngine, type EngineStatus, type SyncEvent, type SyncPhase, type SyncReport, type SyncStore } from "@/sync-client";

import { bridge } from "./bridge";
import { db } from "./db";
import { IdbStore } from "./idb-store";

const AUTO_SYNC_MS = 5 * 60_000;
const AFTER_QUEUE_MS = 1500;
/** Po návratu do popředí synchronizovat, jen když poslední pokus je starší (přepínání aplikací). */
const RESUME_SYNC_MS = 30_000;

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

/** Úložiště aplikace: IndexedDB, v mobilní aplikaci se zrcadlem neodeslaného v souborech aplikace. */
function createStore(): { store: SyncStore; restore: () => Promise<void> } {
  const idb = new IdbStore(db);
  if (!bridge.backup) return { store: idb, restore: async () => undefined };
  const durable = new DurableStore(idb, bridge.backup, (error) => console.warn("[eldock] zrcadlo fronty:", error));
  return {
    store: durable,
    restore: async () => {
      const report = await durable.restore().catch((error: unknown) => {
        console.warn("[eldock] obnova ze zrcadla:", error);
        return null;
      });
      if (report && (report.pairing || report.outbox || report.files)) console.info("[eldock] obnoveno ze zrcadla:", report);
    },
  };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [tokenVersion, setTokenVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { engine, restore } = useMemo(() => {
    const onEvent = (event: SyncEvent) => {
      if (event.type === "progress") setProgress({ phase: event.phase, pulled: event.pulled, head: event.head, done: event.done, total: event.total });
      if (event.type === "finished") {
        setLastReport(event.report);
        setProgress(null);
      }
      if (event.type === "paired" || event.type === "unpaired") setTokenVersion((value) => value + 1);
      // Po spárování požádat o oznámení (připomenutí synchronizace); po odpojení připomenutí zrušit
      if (event.type === "paired") void bridge.allowNotifications?.();
      if (event.type === "unpaired") void bridge.remindSync?.(null);
    };
    const { store, restore } = createStore();
    return { engine: new SyncEngine({ store, tokens: bridge.token, platform: bridge.syncPlatform, appVersion: __APP_VERSION__, onEvent }), restore: restore() };
  }, []);

  // Stav se přepočítá při každé změně metadat nebo fronty v IndexedDB (a po spárování / odpojení)
  const status = useLiveQuery(async () => {
    await Promise.all([db.meta.count(), db.outbox.count()]);
    return engine.status();
  }, [engine, tokenVersion]);

  const syncNow = useCallback(async () => {
    await restore;
    if (!(await engine.status()).paired) return null;
    setSyncing(true);
    try {
      const report = await engine.sync();
      // Připomenutí: 24 h (podle zásad serveru) po poslední úplné synchronizaci
      if (bridge.remindSync) {
        const after = await engine.status();
        if (after.paired && after.lastSyncAt) {
          const hours = after.session?.policy.staleAfterHours ?? SYNC_POLICY.staleAfterHours;
          void bridge.remindSync(new Date(new Date(after.lastSyncAt).getTime() + hours * 3_600_000)).catch(() => undefined);
        }
      }
      return report;
    } finally {
      setSyncing(false);
      setTokenVersion((value) => value + 1);
    }
  }, [engine, restore]);

  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (navigator.onLine || bridge.network) void syncNow();
    }, AFTER_QUEUE_MS);
  }, [syncNow]);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      void syncNow();
    };
    const down = () => setOnline(false);
    const stops: Array<() => void> = [];
    if (bridge.network) {
      // Plugin hlásí i změny vlastností sítě (síla signálu, typ) – synchronizovat jen při přechodu offline → online
      let last: boolean | null = null;
      void bridge.network.connected().then((connected) => {
        last ??= connected;
        setOnline(connected);
      });
      stops.push(
        bridge.network.onChange((connected) => {
          if (connected === last) return;
          last = connected;
          if (connected) up();
          else down();
        }),
      );
    } else {
      window.addEventListener("online", up);
      window.addEventListener("offline", down);
      stops.push(() => {
        window.removeEventListener("online", up);
        window.removeEventListener("offline", down);
      });
    }
    if (bridge.onResume) {
      stops.push(
        bridge.onResume(() => {
          void engine.status().then((current) => {
            const last = current.lastAttemptAt ? new Date(current.lastAttemptAt).getTime() : 0;
            if (Date.now() - last > RESUME_SYNC_MS) void syncNow();
          });
        }),
      );
    }
    const interval = setInterval(() => {
      if (navigator.onLine || bridge.network) void syncNow();
    }, AUTO_SYNC_MS);
    // Data WebView ať prohlížeč nemaže (Android, iOS 17+ – kde to jde)
    void navigator.storage?.persist?.().catch(() => undefined);
    // První synchronizace hned po startu (mimo tělo efektu)
    const initial = setTimeout(() => void syncNow(), 0);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      for (const stop of stops) stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [syncNow, engine]);

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
