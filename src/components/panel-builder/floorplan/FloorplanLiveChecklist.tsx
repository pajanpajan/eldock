"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Minus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FloorplanPhase } from "@/lib/panel-builder/floorplan-phases";
import { LIVE_CHECKLIST_KEY, isLiveChecklistMode, type LiveChecklist, type LiveChecklistMode } from "@/lib/panel-builder/floorplan-live-checklist";
import { cn } from "@/lib/utils";

/** Stav taháku v prohlížeči (rozbalený / pilulka / vypnutý); bez úložiště rozbalený do zavření stránky. */
export function useLiveChecklistMode(): [LiveChecklistMode, (mode: LiveChecklistMode) => void] {
  const [mode, setMode] = useState<LiveChecklistMode>(() => {
    try {
      const stored = window.localStorage.getItem(LIVE_CHECKLIST_KEY);
      return isLiveChecklistMode(stored) ? stored : "open";
    } catch {
      return "open";
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(LIVE_CHECKLIST_KEY, mode);
    } catch {
      // soukromý režim – volba platí jen do zavření stránky
    }
  }, [mode]);
  return [mode, setMode];
}

/**
 * Fáze 92: „🧭 Tahák zakázky (Co teď udělat)“ – sbalitelná karta v pravém horním rohu editoru (nahoře v pravém sloupci,
 * nic nepřekrývá) sama odškrtává hotové body podle stavu nákresu. Aktuální (první nehotový) bod má tlačítka, která
 * rovnou otevřou správné místo editoru.
 */
export function FloorplanLiveChecklist({
  checklist,
  mode,
  onMode,
  boxMaker,
  pending,
  onShowBase,
  onChangeSeries,
  onPickPanel,
  onOpenBom,
  onGenerate,
  onPhase,
  phase,
}: {
  checklist: LiveChecklist;
  mode: LiveChecklistMode;
  onMode: (mode: LiveChecklistMode) => void;
  boxMaker: string;
  pending: boolean;
  onShowBase: () => void;
  onChangeSeries: () => void;
  onPickPanel: () => void;
  onOpenBom: () => void;
  onGenerate: () => void;
  /** Fáze 98: klik na bod přepne editor do jeho fáze. */
  onPhase?: (phase: FloorplanPhase) => void;
  /** Aktivní fáze průvodce (zvýrazní bod). */
  phase?: FloorplanPhase | null;
}) {
  if (mode === "off") return null;
  const total = checklist.items.length;
  if (mode === "pill") {
    return (
      <button
        type="button"
        onClick={() => onMode("open")}
        className="flex w-fit items-center gap-1.5 self-end rounded-full border border-primary/60 bg-card px-3 py-1 text-xs font-semibold hover:border-primary"
        data-testid="live-checklist-pill"
        aria-label={`Rozbalit tahák zakázky – ${checklist.done} z ${total} hotovo`}
      >
        🧭 Tahák ({checklist.done}/{total} hotovo)
      </button>
    );
  }
  const action = (label: string, onClick: () => void, testId: string, primary = false) => (
    <Button type="button" size="sm" variant={primary ? "default" : "outline"} className={cn("h-7 px-2 text-[11px]", primary && "bg-yellow-400 font-bold text-zinc-950 hover:bg-yellow-300")} onClick={onClick} disabled={primary && pending} data-testid={testId}>
      {label}
    </Button>
  );
  return (
    <section className="rounded-xl border border-primary/40 bg-card text-xs" aria-label="Tahák zakázky" data-testid="live-checklist" data-done={checklist.done} data-current={checklist.current ?? "done"}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <b className="min-w-0 flex-1 text-sm leading-tight">🧭 Tahák zakázky (Co teď udělat)</b>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[11px] tabular-nums" data-testid="live-checklist-count">
          {checklist.done}/{total}
        </span>
        <button type="button" onClick={() => onMode("pill")} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Minimalizovat tahák do pilulky" title="Minimalizovat" data-testid="live-checklist-minimize">
          <Minus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Tahák trvale vypnout? Znovu ho zapnete tlačítkem 🧭 v liště průvodce nad plátnem.")) onMode("off");
          }}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Trvale vypnout tahák"
          title="Trvale vypnout"
          data-testid="live-checklist-off"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ol className="flex flex-col gap-1 p-2">
        {checklist.items.map((item) => {
          const current = checklist.current === item.id;
          const open = phase === item.phase;
          return (
            <li key={item.id} className={cn("rounded-lg border px-2 py-1.5", open ? "border-yellow-400/80 bg-yellow-400/10" : current ? "border-primary/70 bg-primary/10" : item.ok ? "border-transparent" : "border-border/60")} data-testid={`live-checklist-${item.id}`} data-ok={item.ok ? "true" : "false"} data-current={current ? "true" : undefined} data-phase={item.phase} data-open={open ? "true" : undefined}>
              {/* Fáze 98: bod = fáze průvodce – klik přepne editor do ní */}
              <button type="button" onClick={() => onPhase?.(item.phase)} className="flex w-full items-start gap-1.5 text-left font-semibold hover:text-primary" disabled={!onPhase} aria-label={`${item.label} – přepnout editor do této fáze`} data-testid={`live-checklist-${item.id}-open`}>
                {item.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-400" aria-label="hotovo" /> : <Circle className={cn("mt-px size-3.5 shrink-0", current ? "text-primary" : "text-muted-foreground")} aria-label="zbývá" />}
                <span className="sr-only">{item.ok ? "[✓]" : "[○]"}</span>
                {item.label}
              </button>
              <p className="mt-0.5 pl-5 text-[11px] leading-snug text-muted-foreground" data-testid={`live-checklist-${item.id}-detail`}>
                {item.detail}
              </p>
              {item.id === "base" && !item.ok ? <div className="mt-1 pl-5">{action("Ukázat kde", onShowBase, "live-checklist-show-base")}</div> : null}
              {item.id === "lights" ? <div className="mt-1 pl-5">{action("Změnit řadu/barvu", onChangeSeries, "live-checklist-change-series")}</div> : null}
              {item.id === "panel" && !item.ok ? <div className="mt-1 pl-5">{action("Vybrat rozváděč RH", onPickPanel, "live-checklist-pick-panel", current)}</div> : null}
              {item.id === "output" ? (
                <div className="mt-1 flex flex-wrap gap-1 pl-5">
                  {action(`Otevřít kusovník s krabičkami ${boxMaker}`, onOpenBom, "live-checklist-bom")}
                  {action("⚡ Vygenerovat rozváděč", onGenerate, "live-checklist-generate", true)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
