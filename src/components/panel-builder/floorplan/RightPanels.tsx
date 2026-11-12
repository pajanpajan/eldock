"use client";

import { createContext, useContext, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { RIGHT_TABS, type RightTab } from "@/lib/panel-builder/floorplan-phases";
import { cn } from "@/lib/utils";

/**
 * Fáze 76: sbalovací karty pravého sloupce 2D půdorysu (detail prvku, soupis okruhů, chytrá domácnost, kontrola norem,
 * zásuvkové okruhy, výkaz kabeláže, založení rozváděče …) – záhlaví se šipkou ▾ / ▸ jako v levé paletě a nahoře
 * „Sbalit vše / Rozbalit vše“. Stav si pamatuje prohlížeč (výchozí: vše rozbalené). Mimo `RightPanels` je karta vždy
 * rozbalená (komponenta jde použít i jinde).
 */

const STORAGE_KEY = "eldock-floorplan-right";

interface RightPanelsState {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}

const RightPanelsContext = createContext<RightPanelsState | null>(null);

function readClosed(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as { closed?: unknown } | null;
    return Array.isArray(value?.closed) ? value.closed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Pravý sloupec s lištou Sbalit / Rozbalit vše (`ids` = karty aktivní záložky); karty si stav berou odsud. */
export function RightPanels({ children, label, ids, tabs = null }: { children: ReactNode; label: string; ids: readonly string[]; /** Fáze 100: lišta záložek nad kartami. */ tabs?: ReactNode }) {
  const [closed, setClosed] = useState<string[]>(readClosed);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ closed }));
    } catch {
      // soukromý režim – stav jen do zavření stránky
    }
  }, [closed]);
  const state = useMemo<RightPanelsState>(
    () => ({
      isOpen: (id) => !closed.includes(id),
      toggle: (id) => setClosed((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id])),
    }),
    [closed],
  );
  const allClosed = ids.every((id) => closed.includes(id));
  const allOpen = ids.every((id) => !closed.includes(id));
  return (
    <aside className="flex flex-col gap-3" aria-label={label}>
      {tabs}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px]" role="group" aria-label="Sbalení karet pravého sloupce">
        <span className="font-bold tracking-wide text-muted-foreground uppercase">Panely</span>
        <button type="button" onClick={() => setClosed((current) => [...new Set([...current, ...ids])])} disabled={allClosed} className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" data-testid="right-collapse-all">
          <ChevronsDownUp className="size-3.5" aria-hidden /> Sbalit vše
        </button>
        <button type="button" onClick={() => setClosed((current) => current.filter((id) => !ids.includes(id)))} disabled={allOpen} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" data-testid="right-expand-all">
          <ChevronsUpDown className="size-3.5" aria-hidden /> Rozbalit vše
        </button>
      </div>
      <RightPanelsContext.Provider value={state}>{children}</RightPanelsContext.Provider>
    </aside>
  );
}

/**
 * Sbalovací karta: záhlaví (šipka, ikona, název, odznak vpravo) a tělo. `id` = klíč stavu sbalení, `testId` a `ariaLabel`
 * zůstávají na kořeni karty (testy a čtečky). Tělo `bare` = skoro bez odsazení (vnořené karty detailu prvku).
 */
export function PanelSection({
  id,
  title,
  icon,
  badge,
  className,
  testId,
  ariaLabel,
  bare = false,
  children,
}: {
  id: string;
  title: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  const panels = useContext(RightPanelsContext);
  const open = panels ? panels.isOpen(id) : true;
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card text-sm", className)} aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)} data-testid={testId} data-section={id} data-open={open ? "true" : "false"}>
      <button
        type="button"
        onClick={() => panels?.toggle(id)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left font-bold outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        data-testid={`right-toggle-${id}`}
      >
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
        {badge}
      </button>
      {open ? <div className={cn("flex flex-col gap-2", bare ? "px-1 pb-1" : "px-3 pb-3")}>{children}</div> : null}
    </section>
  );
}

export interface TabBadge {
  value: ReactNode;
  tone: "neutral" | "danger" | "ok";
  title?: string;
}

const BADGE_TONE: Record<TabBadge["tone"], string> = {
  neutral: "bg-muted text-foreground",
  danger: "bg-red-500 text-white",
  ok: "bg-emerald-500/90 text-emerald-950",
};

/**
 * Fáze 100: 4 záložky pravého panelu 2D půdorysu (🎯 Detail · 🔌 Okruhy & Trasy · 🛡️ Normy (Linter) · ⚡ Kusovník &
 * Rozváděč) s odznakem počtu položek / nálezů; šipky ← → přepínají záložky z klávesnice. Lišta drží nahoře sloupce.
 */
export function RightTabBar({ active, onSelect, badges }: { active: RightTab; onSelect: (tab: RightTab) => void; badges: Partial<Record<RightTab, TabBadge>> }) {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = RIGHT_TABS.findIndex((tab) => tab.id === active);
    const next = RIGHT_TABS[(index + (event.key === "ArrowRight" ? 1 : RIGHT_TABS.length - 1)) % RIGHT_TABS.length];
    onSelect(next.id);
    document.getElementById(`right-tab-${next.id}`)?.focus();
  };
  return (
    <div className="sticky top-0 z-10 grid grid-cols-4 gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur" role="tablist" aria-label="Záložky pravého panelu" onKeyDown={onKey} data-testid="right-tabs" data-active={active}>
      {RIGHT_TABS.map((tab) => {
        const selected = tab.id === active;
        const badge = badges[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`right-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls="right-tabpanel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 pt-1.5 pb-1 text-center text-[11px] leading-tight font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              selected ? "bg-primary/15 text-foreground ring-1 ring-primary/60" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            data-testid={`right-tab-${tab.id}`}
          >
            <span className="text-[15px] leading-none" aria-hidden>
              {tab.icon}
            </span>
            <span className="text-balance">{tab.label}</span>
            {badge ? (
              <span className={cn("absolute top-0.5 right-0.5 min-w-4 rounded-full px-1 text-center font-mono text-[10px] leading-4 font-bold tabular-nums", BADGE_TONE[badge.tone])} title={badge.title} data-testid={`right-tab-badge-${tab.id}`} data-tone={badge.tone}>
                {badge.value}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
