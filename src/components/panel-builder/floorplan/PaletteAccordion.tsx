"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

import { FavoriteStar } from "./FrameAssemblyPalette";

/**
 * Fáze 63: paleta 2D půdorysu jako akordeon – záhlaví kategorie s počtem osazených prvků kategorie na aktivním podlaží,
 * „Sbalit vše“ / „Rozbalit vše“ a režim „jen jedna kategorie“. Stav si pamatuje prohlížeč (výchozí: vše rozbalené).
 * Fáze 74: přehlednější řádky – ikona, krátký název, podtitul (norma / poznámka) a počet v jedné ose, šipka vpravo;
 * tlačítko kategorie (✎ knihovna spotřebičů) v jejím těle; prvky jako seznam se značkou v jednotné šířce.
 * Fáze 100: krátké názvy kategorií, které se nikdy neořezávají třemi tečkami (zalomí se), počet osazených u ikony;
 * prvky jako kompaktní mřížka 2 sloupců dlaždic (`grid-cols-2 gap-1.5`) – čistá vektorová CAD značka, srozumitelný
 * název a rozměr / zkratka, ⭐ oblíbené a technický list v rozích dlaždice.
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
  /** Fáze 78: oblíbená položka (⭐) – oblíbené jsou na začátku kategorie. */
  favorite?: boolean;
  onFavorite?: () => void;
  /** Fáze 100: vektorová CAD značka dlaždice a rozměr / zkratka pod názvem. */
  glyph?: ReactNode;
  meta?: string;
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
  /** Fáze 101: obsah pod dlaždicemi (▣ Vícerámečky se zásuvkami / s vypínači). */
  footer?: ReactNode;
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

export function PaletteAccordion({
  sections,
  focus = null,
  autoOpen = false,
}: {
  sections: PaletteSection[];
  /** Fáze 92: položka trenažéru – její kategorie je rozbalená a položka pulzuje žlutě. */
  focus?: string | null;
  /** Fáze 98: kategorie fáze průvodce automaticky rozbalené (sbalení platí jen do přepnutí fáze, neukládá se). */
  autoOpen?: boolean;
}) {
  const [state, setState] = useState<Stored>(readStored);
  // Fáze 98: sbalené kategorie fáze (do přepnutí fáze); v režimu jedné kategorie zůstane rozbalená jen první
  const [session, setSession] = useState<string[]>(() => (autoOpen && readStored().single ? sections.slice(1).map((section) => section.id) : []));
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // soukromý režim – stav jen do zavření stránky
    }
  }, [state]);
  const ids = sections.map((section) => section.id);
  const focusSection = focus ? (sections.find((section) => section.entries.some((entry) => entry.id === focus))?.id ?? null) : null;
  const open = (id: string) => id === focusSection || (autoOpen ? !session.includes(id) : !state.closed.includes(id));
  const allOpen = ids.every(open);
  const allClosed = ids.every((id) => !open(id));
  const toggle = (id: string) =>
    autoOpen
      ? setSession((current) => (current.includes(id) ? (state.single ? ids.filter((other) => other !== id) : current.filter((other) => other !== id)) : [...current, id]))
      : setState((current) => {
      const isOpen = !current.closed.includes(id);
      if (isOpen) return { ...current, closed: [...current.closed, id] };
      // Režim jedné kategorie: otevřením se ostatní sbalí
      return { ...current, closed: current.single ? ids.filter((other) => other !== id) : current.closed.filter((other) => other !== id) };
    });
  return (
    <aside className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2" aria-label="Paleta elektroinstalačních značek" data-testid="palette">
      <div className="flex items-center gap-1 px-1 pb-1 text-[11px]" role="group" aria-label="Sbalení kategorií palety">
        <span className="font-bold tracking-wide text-muted-foreground uppercase">Paleta</span>
        <button type="button" onClick={() => (autoOpen ? setSession(ids) : setState((current) => ({ ...current, closed: ids })))} disabled={allClosed} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35" title="Sbalit vše" aria-label="Sbalit vše" data-testid="palette-collapse-all">
          <ChevronsDownUp className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => (autoOpen ? setSession(state.single ? ids.slice(1) : []) : setState((current) => ({ ...current, closed: current.single ? ids.slice(1) : [] })))}
          disabled={(autoOpen || !state.single) && allOpen}
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
              if (single && autoOpen) {
                const keep = ids.find((id) => !session.includes(id)) ?? ids[0];
                setSession(ids.filter((id) => id !== keep));
              }
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
              className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted/60"
              data-testid={`palette-toggle-${section.id}`}
            >
              <span className="relative w-6 shrink-0 self-start pt-0.5 text-center text-base leading-none" aria-hidden>
                {section.icon ?? "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-tight font-semibold text-balance break-words text-foreground" data-testid={`palette-label-${section.id}`}>
                  {section.label}
                </span>
                {section.hint ? <span className="block text-[10px] leading-tight break-words text-muted-foreground">{section.hint}</span> : null}
              </span>
              <span className={cn("shrink-0 self-start rounded-full px-1.5 font-mono text-[10px] leading-4 tabular-nums", section.count ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground")} title="Osazeno na aktivním podlaží" data-testid={`palette-count-${section.id}`}>
                {section.count}
              </span>
              {expanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
            {expanded ? (
              <div id={`palette-${section.id}`} className="flex flex-col gap-1.5 px-1 pb-1.5">
                <div className="grid grid-cols-2 gap-1.5" data-testid={`palette-grid-${section.id}`}>
                  {/* Fáze 101: akce sekce (Knihovna spotřebičů) jako tlačítko přes celou šířku nad dlaždicemi – ve sloupci se lámala */}
                  {section.action ? <div className="col-span-2 mb-1.5 w-full">{section.action}</div> : null}
                  {section.entries.map((entry) => (
                    <div key={entry.id} className="relative min-w-0" data-entry={entry.id} data-favorite={entry.favorite ? "true" : undefined} data-trainer-focus={focus === entry.id ? "true" : undefined}>
                      <button
                        type="button"
                        aria-pressed={entry.active}
                        onClick={entry.onPick}
                        title={entry.title ?? entry.label}
                        className={cn(
                          "flex h-full w-full min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 pt-1.5 pb-1 text-center text-[10.5px] leading-tight",
                          entry.active ? "border-primary bg-primary/20 text-foreground" : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 hover:text-foreground",
                          focus === entry.id && !entry.active && "trainer-pulse border-yellow-400 text-yellow-100",
                        )}
                        data-testid="palette-tile"
                      >
                        <span className={cn("flex h-9 w-full items-center justify-center px-4", entry.active ? "text-primary" : "text-zinc-200")} aria-hidden>
                          {entry.glyph ?? <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] font-bold text-foreground">{entry.symbol}</span>}
                        </span>
                        <span className="w-full font-semibold break-words text-foreground/90">{entry.label}</span>
                        {entry.meta ? <span className="w-full font-mono text-[9.5px] break-words text-muted-foreground">{entry.meta}</span> : null}
                      </button>
                      {entry.onFavorite ? <FavoriteStar on={Boolean(entry.favorite)} label={entry.label} onToggle={entry.onFavorite} className="absolute top-0.5 right-0.5" /> : null}
                      {entry.onInfo ? (
                        <button type="button" onClick={entry.onInfo} className="absolute top-0.5 left-0.5 rounded-md border border-transparent p-0.5 text-muted-foreground hover:border-border hover:text-foreground" aria-label={`Technický list ${entry.symbol}`} title={`Technický list: ${entry.label}`} data-testid="palette-datasheet">
                          <FileText className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {section.footer ?? null}
              </div>
            ) : null}
          </section>
        );
      })}
    </aside>
  );
}
