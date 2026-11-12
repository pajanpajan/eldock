// Fáze 98: jednotný vzhled krokových karet fázových průvodců napříč Eldockem – 2D půdorys (5 fází), AI Panel Builder
// (4 fáze projektu rozváděče) a ELDOCK Průmysl (4 agendy závodu). Aktivní fáze žlutě s horním a spodním akcentem,
// hotová zeleně s fajfkou, ostatní tlumeně; mezi kartami šipka (žlutá do aktivní fáze).

import { cn } from "@/lib/utils";

/** Rámeček krokové karty. */
export function phaseCardClass(active: boolean, done: boolean): string {
  return cn(
    "relative flex flex-1 items-center gap-2 rounded-lg border-2 px-2 py-1 text-left transition-colors",
    active
      ? "border-yellow-400 bg-yellow-400/15 text-foreground shadow-[inset_0_3px_0_0_#facc15,inset_0_-3px_0_0_#facc15,0_0_14px_rgba(250,204,21,0.25)]"
      : done
        ? "border-emerald-500/60 bg-emerald-500/10 text-foreground hover:border-emerald-400"
        : "border-border bg-background/40 text-muted-foreground hover:border-primary/60 hover:text-foreground",
  );
}

/** Kroužek s číslem fáze (✓ u hotové). */
export function phaseBubbleClass(active: boolean, done: boolean): string {
  return cn(
    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black",
    active ? "border-yellow-200 bg-yellow-400 text-zinc-950" : done ? "border-emerald-300 bg-emerald-500 text-white" : "border-zinc-500 bg-zinc-900/40 text-zinc-200",
  );
}

/** Šipka mezi kartami – žlutá až po aktivní fázi. */
export const phaseArrowClass = (reached: boolean) => cn("flex shrink-0 items-center px-0.5 text-base font-black", reached ? "text-yellow-400" : "text-muted-foreground/60");

/** Název fáze (v 2D půdorysu se nezalamuje – `nowrap`, jinde smí na dva řádky). */
export const phaseTitleClass = (active: boolean, nowrap = false) => cn("block text-[13px] font-extrabold leading-tight", nowrap && "whitespace-nowrap", active && "text-yellow-100");

/** Živý podtitul fáze („3 místnosti · měřítko OK“) – nepřispívá do šířky karty, dlouhý dostane trojtečku. */
export const phaseSubtitleClass = (active: boolean) => cn("block w-0 min-w-full truncate text-[11px] leading-tight", active ? "text-yellow-200/90" : "text-muted-foreground");
