"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface RailItem {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  /** Text na čele modulu (typ). */
  caption: string;
}

/**
 * DIN lišty v měřítku: každá lišta má `modulesPerRail` pozic, prvek zabírá svou šířku v modulech.
 * Barvu a odznak prvku určuje volající (krok 1 = stav rozpoznání, krok 2 = stav zapojení).
 */
export function DinRails<T extends RailItem>({
  items,
  rails,
  modulesPerRail,
  selectedIds,
  onSelect,
  tone,
  badge,
}: {
  items: readonly T[];
  rails: number;
  modulesPerRail: number;
  selectedIds?: ReadonlySet<string>;
  onSelect?: (item: T) => void;
  tone: (item: T) => string;
  badge?: (item: T) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="din-rails">
      {Array.from({ length: rails }, (_, index) => {
        const rail = index + 1;
        const railItems = items.filter((item) => item.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
        const used = railItems.reduce((sum, item) => sum + item.modulesWidth, 0);
        const capacity = Math.max(modulesPerRail, used);
        return (
          <div key={rail} className="flex items-stretch gap-2">
            <span className="flex w-14 shrink-0 flex-col justify-center font-mono text-[11px] text-muted-foreground">
              Lišta {rail}
              <span className={cn(used > modulesPerRail && "text-red-400")}>
                {used}/{modulesPerRail} M
              </span>
            </span>
            <div
              className="relative flex h-16 flex-1 overflow-hidden rounded-md border border-border bg-muted/30"
              // mřížka pozic po 1 modulu
              style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent calc(${100 / capacity}% - 1px), rgba(161,161,170,0.18) calc(${100 / capacity}% - 1px), rgba(161,161,170,0.18) ${100 / capacity}%)` }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-zinc-600/50" aria-hidden />
              {railItems.map((item) => {
                const selected = selectedIds?.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect?.(item)}
                    disabled={!onSelect}
                    aria-pressed={selected}
                    aria-label={`${item.designation} ${item.caption}`}
                    className={cn(
                      "relative z-10 m-0.5 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded border-2 px-0.5 text-center transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:-translate-y-0.5",
                      tone(item),
                      selected && "ring-3 ring-primary",
                    )}
                    style={{ width: `calc(${(item.modulesWidth / capacity) * 100}% - 4px)` }}
                  >
                    <span className="max-w-full truncate font-mono text-[11px] font-semibold">{item.designation}</span>
                    <span className="max-w-full truncate text-[9px] opacity-80">{item.caption}</span>
                    {badge ? <span className="absolute -top-1 -right-1">{badge(item)}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
