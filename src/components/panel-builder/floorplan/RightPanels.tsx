"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

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

/** Pravý sloupec s lištou Sbalit / Rozbalit vše (`ids` = všechny karty sloupce); karty si stav berou odsud. */
export function RightPanels({ children, label, ids }: { children: ReactNode; label: string; ids: readonly string[] }) {
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
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px]" role="group" aria-label="Sbalení karet pravého sloupce">
        <span className="font-bold tracking-wide text-muted-foreground uppercase">Panely</span>
        <button type="button" onClick={() => setClosed([...ids])} disabled={allClosed} className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" data-testid="right-collapse-all">
          <ChevronsDownUp className="size-3.5" aria-hidden /> Sbalit vše
        </button>
        <button type="button" onClick={() => setClosed([])} disabled={allOpen} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" data-testid="right-expand-all">
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
