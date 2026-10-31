"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

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
  selectedVariant = "pick",
  onSelect,
  tone,
  badge,
  onAddModule,
  onDeleteRail,
  onAddRail,
  busy,
}: {
  items: readonly T[];
  rails: number;
  modulesPerRail: number;
  selectedIds?: ReadonlySet<string>;
  /** „edit“ = jediný upravovaný modul (jantarově se štítkem), „pick“ = vícenásobný výběr. */
  selectedVariant?: "edit" | "pick";
  onSelect?: (item: T) => void;
  tone: (item: T) => string;
  badge?: (item: T) => ReactNode;
  /** Správa lišt (krok 1): „+ Přidat modul“, „Smazat celou lištu“, „+ Přidat DIN lištu“. */
  onAddModule?: (rail: number) => void;
  onDeleteRail?: (rail: number) => void;
  onAddRail?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="din-rails">
      {Array.from({ length: rails }, (_, index) => {
        const rail = index + 1;
        const railItems = items.filter((item) => item.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
        const used = railItems.reduce((sum, item) => sum + item.modulesWidth, 0);
        const capacity = Math.max(modulesPerRail, used);
        return (
          <div key={rail} className={cn("flex items-stretch gap-2", selectedVariant === "edit" && "mt-5")}>
            <span className="flex w-14 shrink-0 flex-col justify-center font-mono text-[11px] text-muted-foreground">
              Lišta {rail}
              <span className={cn(used > modulesPerRail && "text-red-400")}>
                {used}/{modulesPerRail} M
              </span>
              {onDeleteRail ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeleteRail(rail)}
                  aria-label={`Smazat celou lištu ${rail}`}
                  title="Smazat celou lištu"
                  className="mt-1 flex w-fit items-center gap-0.5 rounded px-1 text-[10px] text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                >
                  <Trash2 className="size-3" aria-hidden /> lišta
                </button>
              ) : null}
            </span>
            <div
              className={cn("relative flex h-16 flex-1 rounded-md border border-border bg-muted/30", selectedVariant === "pick" && "overflow-hidden")}
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
                      selected && selectedVariant === "edit"
                        ? "z-20 scale-105 border-amber-300 bg-amber-400 font-extrabold text-neutral-950 shadow-[0_0_25px_rgba(251,191,36,0.8)] ring-4 ring-white/90"
                        : tone(item),
                      selected && selectedVariant === "pick" && "ring-3 ring-primary",
                    )}
                    style={{ width: `calc(${(item.modulesWidth / capacity) * 100}% - 4px)` }}
                  >
                    <span className="max-w-full truncate font-mono text-[11px] font-semibold">{item.designation}</span>
                    <span className="max-w-full truncate text-[9px] opacity-80">{item.caption}</span>
                    {badge ? <span className="absolute -top-1 -right-1">{badge(item)}</span> : null}
                    {selected && selectedVariant === "edit" ? (
                      <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-neutral-950 shadow" data-testid="rail-editing">
                        ▼ UPRAVUJETE
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {onAddModule ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAddModule(rail)}
                aria-label={`Přidat modul na lištu ${rail}`}
                title="Přidat modul na konec lišty"
                className="flex w-11 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-[10px] text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden /> modul
              </button>
            ) : null}
          </div>
        );
      })}
      {onAddRail ? (
        <button
          type="button"
          disabled={busy}
          onClick={onAddRail}
          className="touch-target ml-16 flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Přidat DIN lištu
        </button>
      ) : null}
    </div>
  );
}
