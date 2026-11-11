"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { parseDraft, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { clearBackup, writeBackup } from "@/lib/panel-builder/floorplan-storage";
import { createFloorplanAction, loadFloorplanAction, saveFloorplanAction } from "@/server/actions/floorplans";

// Fáze 64: průběžné ukládání 2D půdorysu na server. Změny se uloží 0,8 s po poslední úpravě (fáze 78; při nepřetržité
// práci nejpozději po 10 s), nový půdorys vznikne na serveru při první změně (a dostane kód FP-001 …). Před odesláním se změny zálohují v prohlížeči;
// výpadek spojení se zkouší znovu. Jiná verze na serveru (druhé okno) = souběh s volbou „Načíst aktuální verzi“
// nebo „Ponechat mou verzi“ – odmítnutý i přepsaný stav zůstane v historii verzí.

export const SAVE_DEBOUNCE_MS = 800;
export const SAVE_MAX_WAIT_MS = 10_000;
const RETRY_MS = [3_000, 10_000, 30_000];
const OFFLINE = "Spojení se serverem selhalo – změny zůstávají v tomto prohlížeči a uloží se znovu.";

export interface FloorplanMetaState {
  name: string;
  customerName: string | null;
  installationSite: string | null;
}

export type SyncStatus =
  | { kind: "saved"; at: string | null }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; serverVersion: number };

type Phase = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string; attempt: number } | { kind: "conflict"; serverVersion: number };

class SaveError extends Error {}

export function useFloorplanSync({
  stored,
  draft,
  initialSaved,
  meta,
  replaceDraft,
  disabled = false,
}: {
  /** Půdorys na serveru při otevření (null = nový). */
  stored: { id: string; code?: string | null; version: number; savedAt: string } | null;
  draft: FloorplanDraft;
  /** Nákres odpovídající serveru při otevření (null = obnovená záloha / nový se zálohou → hned uložit). */
  initialSaved: FloorplanDraft | null;
  meta: FloorplanMetaState;
  /** Nahrazení nákresu v editoru (načtení ze serveru, obnovení verze) – bez historie Zpět. */
  replaceDraft: (draft: FloorplanDraft) => void;
  /** Fáze 92: trenažér – nic se neukládá na server ani do zálohy v prohlížeči (cvičný bungalov se nikde neobjeví). */
  disabled?: boolean;
}) {
  const [floorplanId, setFloorplanId] = useState<string | null>(stored?.id ?? null);
  /** Fáze 78: kód půdorysu ve firmě (nový ho dostane při prvním uložení). */
  const [code, setCode] = useState<string | null>(stored?.code ?? null);
  const [saved, setSaved] = useState<FloorplanDraft | null>(initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(stored?.savedAt ?? null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const idRef = useRef(stored?.id ?? null);
  const version = useRef(stored?.version ?? 0);
  const draftRef = useRef(draft);
  const savedRef = useRef(initialSaved);
  const metaRef = useRef(meta);
  const replaceRef = useRef(replaceDraft);
  const inflight = useRef<Promise<boolean> | null>(null);
  const dirtySince = useRef<number | null>(null);

  useEffect(() => {
    draftRef.current = draft;
    metaRef.current = meta;
    replaceRef.current = replaceDraft;
  });

  const off = useRef(disabled);
  const backup = useCallback(() => {
    if (off.current || draftRef.current === savedRef.current) return;
    writeBackup(idRef.current, { baseVersion: idRef.current ? version.current : null, draft: draftRef.current, at: Date.now() });
  }, []);

  const save = useCallback((options: { force?: boolean } = {}): Promise<boolean> => {
    if (off.current) return Promise.resolve(true);
    if (inflight.current) return inflight.current;
    const snapshot = draftRef.current;
    if (snapshot === savedRef.current && !options.force) return Promise.resolve(true);
    const run = async () => {
      setPhase({ kind: "saving" });
      try {
        let outcome: { version: number; savedAt: string } | { conflict: number };
        const id = idRef.current;
        if (!id) {
          const result = await createFloorplanAction({ meta: metaRef.current, draft: snapshot });
          if (!result.ok) throw new SaveError(result.error);
          idRef.current = result.data.id;
          setFloorplanId(result.data.id);
          setCode(result.data.code);
          clearBackup(null);
          // Adresa nového půdorysu bez přenačtení editoru (reload otevře uložený půdorys)
          window.history.replaceState(null, "", `/panel-builder/floorplan/${result.data.id}`);
          outcome = result.data;
        } else {
          const result = await saveFloorplanAction({ id, baseVersion: version.current, draft: snapshot, force: options.force });
          if (!result.ok) throw new SaveError(result.error);
          outcome = result.data.status === "conflict" ? { conflict: result.data.version } : result.data;
        }
        if ("conflict" in outcome) {
          setPhase({ kind: "conflict", serverVersion: outcome.conflict });
          return false;
        }
        version.current = outcome.version;
        savedRef.current = snapshot;
        setSaved(snapshot);
        setSavedAt(outcome.savedAt);
        setPhase({ kind: "idle" });
        dirtySince.current = null;
        if (draftRef.current === snapshot) clearBackup(idRef.current);
        return true;
      } catch (error) {
        const message = error instanceof SaveError ? error.message : OFFLINE;
        setPhase((current) => ({ kind: "error", message, attempt: current.kind === "error" ? current.attempt + 1 : 1 }));
        return false;
      }
    };
    const promise = run().finally(() => {
      inflight.current = null;
    });
    inflight.current = promise;
    return promise;
  }, []);

  const dirty = !disabled && draft !== saved;

  // Odložené uložení po úpravě (nejpozději po SAVE_MAX_WAIT_MS nepřetržité práce); při souběhu / výpadku jen záloha
  useEffect(() => {
    if (!dirty) return;
    dirtySince.current ??= Date.now();
    const idle = phase.kind === "idle";
    const wait = idle ? Math.min(SAVE_DEBOUNCE_MS, Math.max(0, SAVE_MAX_WAIT_MS - (Date.now() - dirtySince.current))) : SAVE_DEBOUNCE_MS;
    const timer = window.setTimeout(() => {
      backup();
      if (idle) void save();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, phase.kind, backup, save]);

  // Výpadek spojení: další pokus po 3 / 10 / 30 s, hned po obnovení sítě
  useEffect(() => {
    if (phase.kind !== "error") return;
    const retry = () => void save();
    const timer = window.setTimeout(retry, RETRY_MS[Math.min(phase.attempt, RETRY_MS.length) - 1]);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [phase, save]);

  // Skrytí / zavření stránky: záloha v prohlížeči a pokus o okamžité uložení
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "hidden" || draftRef.current === savedRef.current) return;
      backup();
      void save();
    };
    const leave = () => backup();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, [backup, save]);

  /** Převzetí stavu ze serveru (souběh → „Načíst aktuální verzi“, obnovení verze z historie). */
  const adopt = useCallback((next: { draft: FloorplanDraft; version: number; savedAt: string }) => {
    version.current = next.version;
    savedRef.current = next.draft;
    draftRef.current = next.draft;
    dirtySince.current = null;
    setSaved(next.draft);
    setSavedAt(next.savedAt);
    setPhase({ kind: "idle" });
    clearBackup(idRef.current);
    replaceRef.current(next.draft);
  }, []);

  /** Souběh: načíst stav ze serveru (vlastní změny už jsou v historii verzí jako „odmítnuté“). */
  const reload = useCallback(async (): Promise<string | null> => {
    const id = idRef.current;
    if (!id) return "Půdorys ještě není uložený.";
    const result = await loadFloorplanAction(id);
    if (!result.ok) return result.error;
    const loaded = parseDraft(result.data.draft);
    if (!loaded) return "Uložený půdorys se nepodařilo načíst.";
    adopt({ draft: loaded, version: result.data.version, savedAt: result.data.savedAt });
    return null;
  }, [adopt]);

  /** Souběh: přepsat server vlastní verzí (serverový stav zůstane v historii verzí). */
  const keepMine = useCallback(() => save({ force: true }), [save]);

  /** Uložit hned (před generováním rozváděče, uložením verze, obnovením verze). */
  const flush = useCallback(async () => {
    if (inflight.current) await inflight.current;
    if (draftRef.current === savedRef.current) return true;
    backup();
    return save();
  }, [backup, save]);

  const currentId = useCallback(() => idRef.current, []);

  const status: SyncStatus =
    phase.kind === "conflict"
      ? { kind: "conflict", serverVersion: phase.serverVersion }
      : phase.kind === "error"
        ? { kind: "error", message: phase.message }
        : phase.kind === "saving"
          ? { kind: "saving" }
          : dirty
            ? { kind: "pending" }
            : { kind: "saved", at: savedAt };

  return { floorplanId, code, status, flush, reload, keepMine, adopt, currentId };
}
