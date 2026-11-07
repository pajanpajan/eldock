"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Fáze 63: paleta 2D půdorysu jako akordeon – záhlaví kategorie se šipkou ▾ / ▸ a počtem osazených prvků kategorie
 * na aktivním podlaží, nahoře „Sbalit vše“ / „Rozbalit vše“ a režim „Rozbalit vždy jen jednu kategorii“. Stav si
 * pamatuje prohlížeč (výchozí: vše rozbalené).
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
  /** Osazené prvky kategorie na aktivním podlaží. */
  count: number;
  entries: PaletteEntry[];
  /** Tlačítko v záhlaví (✎ Upravit / + Přidat u spotřebičů). */
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
    <aside className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Paleta elektroinstalačních značek" data-testid="palette">
      <div className="flex flex-wrap items-center gap-1 text-[11px]" role="group" aria-label="Sbalení kategorií palety">
        <button type="button" onClick={() => setState((current) => ({ ...current, closed: ids }))} disabled={allClosed} className="rounded-md border border-border px-2 py-0.5 font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40" data-testid="palette-collapse-all">
          Sbalit vše
        </button>
        <button
          type="button"
          onClick={() => setState((current) => ({ ...current, closed: current.single ? ids.slice(1) : [] }))}
          disabled={!state.single && allOpen}
          className="rounded-md border border-border px-2 py-0.5 font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
          data-testid="palette-expand-all"
          title={state.single ? "V režimu jedné kategorie se rozbalí první kategorie" : undefined}
        >
          Rozbalit vše
        </button>
        <label className="flex items-center gap-1 text-muted-foreground" title="Otevřením kategorie se ostatní sbalí">
          <input
            type="checkbox"
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
          Rozbalit vždy jen jednu kategorii
        </label>
      </div>
      {sections.map((section) => {
        const expanded = open(section.id);
        return (
          <section key={section.id} className="flex flex-col gap-1" data-group={section.id} data-open={expanded ? "true" : "false"}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`palette-${section.id}`}
                onClick={() => toggle(section.id)}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                data-testid={`palette-toggle-${section.id}`}
              >
                <span aria-hidden className="w-3 shrink-0 text-center">
                  {expanded ? "▾" : "▸"}
                </span>
                <span className="min-w-0 flex-1">{section.label}</span>
                <span className={cn("shrink-0 rounded-full border px-1.5 font-mono text-[10px] tabular-nums", section.count ? "border-primary/60 text-foreground" : "border-border text-muted-foreground")} title="Osazeno na aktivním podlaží" data-testid={`palette-count-${section.id}`}>
                  {section.count}
                </span>
              </button>
              {section.action}
            </div>
            {expanded ? (
              <div id={`palette-${section.id}`} className="flex flex-wrap gap-1">
                {section.entries.map((entry) => (
                  <span key={entry.id} className="inline-flex items-stretch gap-0.5">
                  <button
                    type="button"
                    aria-pressed={entry.active}
                    onClick={entry.onPick}
                    title={entry.title ?? entry.label}
                    className={cn("flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs", entry.active ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground")}
                  >
                    <span className="rounded bg-muted px-1 font-mono text-[10px] font-bold text-foreground">{entry.symbol}</span>
                    {entry.label}
                  </button>
                  {entry.onInfo ? (
                    <button type="button" onClick={entry.onInfo} className="rounded-md border border-border px-1 text-muted-foreground hover:border-primary/60 hover:text-foreground" aria-label={`Technický list ${entry.symbol}`} title={`Technický list: ${entry.label}`} data-testid="palette-datasheet">
                      <FileText className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </aside>
  );
}
