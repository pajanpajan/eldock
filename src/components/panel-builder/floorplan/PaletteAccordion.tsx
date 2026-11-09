"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Fáze 63: paleta 2D půdorysu jako akordeon – záhlaví kategorie s počtem osazených prvků kategorie na aktivním podlaží,
 * „Sbalit vše“ / „Rozbalit vše“ a režim „jen jedna kategorie“. Stav si pamatuje prohlížeč (výchozí: vše rozbalené).
 * Fáze 74: přehlednější řádky – ikona, krátký název, podtitul (norma / poznámka) a počet v jedné ose, šipka vpravo;
 * tlačítko kategorie (✎ knihovna spotřebičů) v jejím těle; prvky jako seznam se značkou v jednotné šířce.
 */

export interface PaletteEntry {
  id: string;
  label: string;
  symbol: string;
  title?: string;
  active: boolean;
  onPick: () => void;
  /** Fáze 65: technický list (sběrnicové prvky chytré domácnosti). */
  onInfo?: () => void;
}

export interface PaletteSection {
  id: string;
  label: string;
  /** Fáze 74: ikona a podtitul kategorie (norma, rozsah). */
  icon?: string;
  hint?: string;
  /** Osazené prvky kategorie na aktivním podlaží. */
  count: number;
  entries: PaletteEntry[];
  /** Tlačítko v těle kategorie (✎ Upravit / + Přidat u spotřebičů). */
  action?: ReactNode;
}

const STORAGE_KEY = "eldock-floorplan-palette";

interface Stored {
  closed: string[];
  single: boolean;
}

function readStored(): Stored {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Stored> | null;
    return { closed: Array.isArray(value?.closed) ? value.closed.filter((id): id is string => typeof id === "string") : [], single: value?.single === true };
  } catch {
    return { closed: [], single: false };
  }
}

export function PaletteAccordion({ sections }: { sections: PaletteSection[] }) {
  const [state, setState] = useState<Stored>(readStored);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // soukromý režim – stav jen do zavření stránky
    }
  }, [state]);
  const ids = sections.map((section) => section.id);
  const open = (id: string) => !state.closed.includes(id);
  const allOpen = ids.every(open);
  const allClosed = ids.every((id) => !open(id));
  const toggle = (id: string) =>
    setState((current) => {
      const isOpen = !current.closed.includes(id);
      if (isOpen) return { ...current, closed: [...current.closed, id] };
      // Režim jedné kategorie: otevřením se ostatní sbalí
      return { ...current, closed: current.single ? ids.filter((other) => other !== id) : current.closed.filter((other) => other !== id) };
    });
  return (
    <aside className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2" aria-label="Paleta elektroinstalačních značek" data-testid="palette">
      <div className="flex items-center gap-1 px-1 pb-1 text-[11px]" role="group" aria-label="Sbalení kategorií palety">
        <span className="font-bold tracking-wide text-muted-foreground uppercase">Paleta</span>
        <button type="button" onClick={() => setState((current) => ({ ...current, closed: ids }))} disabled={allClosed} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" title="Sbalit vše" aria-label="Sbalit vše" data-testid="palette-collapse-all">
          <ChevronsDownUp className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setState((current) => ({ ...current, closed: current.single ? ids.slice(1) : [] }))}
          disabled={!state.single && allOpen}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"
          aria-label="Rozbalit vše"
          title={state.single ? "V režimu jedné kategorie se rozbalí první kategorie" : "Rozbalit vše"}
          data-testid="palette-expand-all"
        >
          <ChevronsUpDown className="size-3.5" aria-hidden />
        </button>
        <label className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground hover:text-foreground" title="Otevřením kategorie se ostatní sbalí">
          <input
            type="checkbox"
            className="size-3 accent-primary"
            checked={state.single}
            onChange={(event) => {
              const single = event.target.checked;
              // Zapnutí: zůstane rozbalená jen první otevřená kategorie
              setState((current) => {
                if (!single) return { ...current, single };
                const keep = ids.find((id) => !current.closed.includes(id)) ?? ids[0];
                return { single, closed: ids.filter((id) => id !== keep) };
              });
            }}
            data-testid="palette-single"
          />
          jen jedna
        </label>
      </div>
      {sections.map((section) => {
        const expanded = open(section.id);
        return (
          <section key={section.id} className={cn("rounded-lg border", expanded ? "border-border bg-background/40" : "border-transparent")} data-group={section.id} data-open={expanded ? "true" : "false"}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`palette-${section.id}`}
              onClick={() => toggle(section.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
              data-testid={`palette-toggle-${section.id}`}
            >
              <span className="w-5 shrink-0 text-center text-base leading-none" aria-hidden>
                {section.icon ?? "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight font-semibold text-foreground">{section.label}</span>
                {section.hint ? <span className="block truncate text-[10.5px] leading-tight text-muted-foreground" title={section.hint}>{section.hint}</span> : null}
              </span>
              <span className={cn("shrink-0 rounded-full px-1.5 font-mono text-[10px] leading-4 tabular-nums", section.count ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground")} title="Osazeno na aktivním podlaží" data-testid={`palette-count-${section.id}`}>
                {section.count}
              </span>
              {expanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
            {expanded ? (
              <div id={`palette-${section.id}`} className="flex flex-col gap-0.5 px-1 pb-1.5">
                {section.action ? <div className="flex justify-end px-1 pb-0.5">{section.action}</div> : null}
                {section.entries.map((entry) => (
                  <div key={entry.id} className="flex items-stretch gap-0.5">
                    <button
                      type="button"
                      aria-pressed={entry.active}
                      onClick={entry.onPick}
                      title={entry.title ?? entry.label}
                      className={cn("flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs leading-tight", entry.active ? "border-primary bg-primary/20 text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground")}
                    >
                      <span className="w-11 shrink-0 truncate rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] font-bold text-foreground">{entry.symbol}</span>
                      <span className="min-w-0 flex-1 line-clamp-2">{entry.label}</span>
                    </button>
                    {entry.onInfo ? (
                      <button type="button" onClick={entry.onInfo} className="rounded-md border border-transparent px-1 text-muted-foreground hover:border-border hover:text-foreground" aria-label={`Technický list ${entry.symbol}`} title={`Technický list: ${entry.label}`} data-testid="palette-datasheet">
                        <FileText className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </aside>
  );
}
