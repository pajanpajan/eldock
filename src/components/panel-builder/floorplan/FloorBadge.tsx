"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";

import { levelLabel, type FloorSheet } from "@/lib/panel-builder/floorplan-editor";
import { cn } from "@/lib/utils";

/**
 * Fáze 113: štítek podlaží v levém horním rohu plátna je přepínač:
 * - 1 podlaží – jen štítek (kliky projdou na plátno),
 * - přesně 2 podlaží – najetím myší se štítek plynule rozšíří o výzvu „⇄ Přepnout na 1. NP ±0,000“ se šipkou
 *   nahoru / dolů a zvýrazněným rámečkem; klik podlaží hned přepne,
 * - 3 a více podlaží – najetím nebo klikem se rozbalí plovoucí menu všech podlaží (nejvyšší nahoře).
 */
export function FloorBadge({ floors, activeId, onSelect }: { floors: readonly FloorSheet[]; activeId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = floors.find((floor) => floor.id === activeId) ?? floors[0];
  const base = "rounded-md border border-border bg-card/90 px-2 py-0.5 text-xs font-semibold shadow-sm";
  const label = (
    <span data-testid="active-floor">
      {active.name} <span className="font-mono text-muted-foreground">{levelLabel(active.levelMm)}</span>
    </span>
  );

  if (floors.length < 2)
    return (
      <span className={cn(base, "pointer-events-none absolute top-2 left-2")} data-testid="floor-badge" data-floors={floors.length}>
        {label}
      </span>
    );

  if (floors.length === 2) {
    const other = floors.find((floor) => floor.id !== active.id) ?? floors[0];
    const up = other.levelMm > active.levelMm;
    return (
      <button
        type="button"
        onClick={() => onSelect(other.id)}
        className={cn(base, "group absolute top-2 left-2 z-10 flex items-center transition-all duration-300 hover:border-yellow-400 hover:bg-zinc-950/95 hover:ring-2 hover:ring-yellow-400/40 focus-visible:border-yellow-400 focus-visible:outline-none")}
        title={`Přepnout na ${other.name} ${levelLabel(other.levelMm)}`}
        aria-label={`Podlaží ${active.name} ${levelLabel(active.levelMm)} – kliknutím přepnout na ${other.name} ${levelLabel(other.levelMm)}`}
        data-testid="floor-badge"
        data-floors={2}
        data-target={other.name}
      >
        {label}
        <span className="flex max-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-yellow-200 opacity-0 transition-all duration-300 group-hover:max-w-80 group-hover:pl-2 group-hover:opacity-100 group-focus-visible:max-w-80 group-focus-visible:pl-2 group-focus-visible:opacity-100" data-testid="floor-badge-switch">
          ⇄ {up ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />} Přepnout na {other.name} <span className="font-mono">{levelLabel(other.levelMm)}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-10" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} data-testid="floor-badge" data-floors={floors.length}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className={cn(base, "flex items-center gap-1 transition-colors hover:border-yellow-400", open && "border-yellow-400")} data-testid="floor-badge-toggle">
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div role="menu" aria-label="Podlaží domu" className="mt-1 flex min-w-44 flex-col gap-0.5 rounded-lg border border-yellow-400/50 bg-zinc-950/95 p-1 shadow-xl backdrop-blur" data-testid="floor-badge-menu">
          {[...floors]
            .sort((a, b) => b.levelMm - a.levelMm)
            .map((floor) => (
              <button
                key={floor.id}
                type="button"
                role="menuitemradio"
                aria-checked={floor.id === active.id}
                onClick={() => {
                  setOpen(false);
                  if (floor.id !== active.id) onSelect(floor.id);
                }}
                className={cn("flex items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs", floor.id === active.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}
                data-testid={`floor-badge-item-${floor.name}`}
              >
                <span className="font-semibold">{floor.name}</span>
                <span className="font-mono opacity-80">{levelLabel(floor.levelMm)}</span>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
