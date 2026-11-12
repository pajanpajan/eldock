"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { paletteItem, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { MAX_FRAME_GANGS, frameGangs, frameOf, frameOrientationOf, gangsOf, slotChoicesFor, type FrameLimit } from "@/lib/panel-builder/floorplan-frames";
import { cn } from "@/lib/utils";

import { AddToFrameControl, SaveTemplateControl } from "./FrameAssemblyPalette";

export interface FrameSectionActions {
  /** 1R (samostatně) – 5R: počet pozic víceramečku na pozici prvku. */
  resize: (gangs: number) => void;
  orientation: (orientation: "horizontal" | "vertical") => void;
  /** Obsah pozice (prvek rámečku → přístroj z rychlé volby). */
  slot: (memberId: string, item: string) => void;
  /** 🔗 Spojení se sousedy u stejné stěny do 35 cm (null = žádný soused). */
  join: (() => void) | null;
  joinCount: number;
  moveLeft: () => void;
  moveRight: () => void;
  rotate: () => void;
  leave: () => void;
  dissolve: () => void;
}

/** Krátký popis přístroje v okénku pozice („Jednozásuvka“, „Vypínač č. 1“). */
const shortLabel = (item: string) => (paletteItem(item)?.label ?? item).replace(/\s*\(.*\)$/, "").replace(/^Zásuvka s USB-A \/ USB-C nabíječkou$/, "USB nabíječka");

/**
 * Fáze 101: „▣ Sestava ve vícerámečku (na této pozici)“ v detailu zásuvky, vypínače, datové zásuvky, termostatu nebo
 * sběrnicového tlačítka – přepínač 1R (samostatně) až 5R podle limitu řady (`maxFrameGang`), orientace ↔ / ↕, okénka pozic
 * s obsahem na 1 klik, 🔗 spojení se sousedy u stejné stěny a ✂️ rozdělení na samostatné přístroje.
 */
export function FrameSection({ draft, element, limit, actions, usedGangs, onAddToFrame, onSaveTemplate }: { draft: FloorplanDraft; element: EditorElement; limit: FrameLimit; actions: FrameSectionActions; usedGangs: number; onAddToFrame: (item: string) => void; onSaveTemplate?: (members: string[], label: string) => string | null }) {
  const frame = frameOf(draft, element.id);
  const members = frame ? frame.members.map((id) => draft.elements.find((candidate) => candidate.id === id)).filter((member): member is EditorElement => Boolean(member)) : [element];
  const gangs = frame ? frameGangs(draft, frame) : gangsOf(element);
  const max = Math.min(MAX_FRAME_GANGS, limit.max);
  const vertical = frameOrientationOf(frame) === "vertical";
  const [activeId, setActiveId] = useState(element.id);
  const active = members.find((member) => member.id === activeId) ?? element;
  const activeIndex = members.indexOf(active);
  const choices = slotChoicesFor(draft.installation);
  const choice = "rounded-md border px-1.5 py-1 text-[11px] leading-tight font-semibold transition-colors disabled:opacity-35";
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs" data-testid="frame-detail" data-gangs={gangs} data-orientation={vertical ? "vertical" : "horizontal"}>
      <p className="font-semibold text-amber-200">
        ▣ Sestava ve vícerámečku (na této pozici)
      </p>
      <p className="text-[11px] text-muted-foreground" data-testid="frame-status">
        {frame ? `Víceramček ${gangs}R · pozice ${frame.members.indexOf(element.id) + 1} z ${frame.members.length}${vertical ? " · svisle pod sebou" : ""}` : gangs > 1 ? `${gangs} stejné přístroje v jednom rámečku (${gangs}R)` : "Samostatný přístroj v rámečku 1R"}
      </p>
      <div className="grid grid-cols-[1.9fr_1fr_1fr_1fr_1fr] gap-1" role="radiogroup" aria-label="Počet pozic víceramečku" data-testid="frame-gangs">
        {[1, 2, 3, 4, 5].map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={gangs === count}
            disabled={count > max}
            title={count > max ? (limit.text ?? `Řada vyrábí rámečky nejvýš ${max}R.`) : undefined}
            onClick={() => count !== gangs && actions.resize(count)}
            className={cn(choice, gangs === count ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            data-gangs={count}
          >
            {count === 1 ? "1R (Samostatně)" : `${count}R`}
          </button>
        ))}
      </div>
      {limit.text && max < MAX_FRAME_GANGS ? <p className="text-[11px] text-amber-100">ℹ️ {limit.text}</p> : null}
      {frame ? (
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Orientace víceramečku" data-testid="frame-orientation">
          {(["horizontal", "vertical"] as const).map((orientation) => (
            <button key={orientation} type="button" role="radio" aria-checked={(orientation === "vertical") === vertical} onClick={() => (orientation === "vertical") !== vertical && actions.orientation(orientation)} className={cn(choice, (orientation === "vertical") === vertical ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-orientation={orientation}>
              {orientation === "vertical" ? "↕ Svisle" : "↔ Vodorovně"}
            </button>
          ))}
        </div>
      ) : null}
      {/* Okénka pozic – klik vybere pozici, rychlá tlačítka pod nimi nastaví její obsah */}
      <div className={cn("flex gap-1", vertical && "flex-col")} role="radiogroup" aria-label="Pozice víceramečku" data-testid="frame-slots">
        {members.map((member, index) => (
          <button
            key={member.id}
            type="button"
            role="radio"
            aria-checked={member.id === active.id}
            onClick={() => setActiveId(member.id)}
            className={cn("flex min-w-0 flex-1 flex-col items-center rounded-md border px-1 py-1 text-center", member.id === active.id ? "border-amber-400 bg-amber-400/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            data-testid="frame-position"
            data-item={member.item}
          >
            <span className="font-mono text-[10px]">Pozice {index + 1}</span>
            <span className="w-full truncate text-[11px] font-semibold">{shortLabel(member.item)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={`Obsah pozice ${activeIndex + 1}`} data-testid="frame-position-choices">
        {choices.map((option) => (
          <button key={option.item} type="button" aria-pressed={active.item === option.item} onClick={() => active.item !== option.item && actions.slot(active.id, option.item)} className={cn(choice, "font-medium", active.item === option.item ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-slot-item={option.item}>
            {option.label}
          </button>
        ))}
      </div>
      {actions.join ? (
        <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 w-full justify-start gap-1.5 py-1 text-left text-xs whitespace-normal" onClick={actions.join} data-testid="frame-join">
          🔗 Spojit sousední prvky do společného vícerámečku (2R–5R)
          <span className="ml-auto shrink-0 rounded bg-muted px-1 font-mono text-[10px]">+{actions.joinCount}</span>
        </Button>
      ) : null}
      {frame ? (
        <>
          <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 w-full justify-start gap-1.5 border-red-500/40 py-1 text-left text-xs whitespace-normal text-red-200" onClick={actions.dissolve} data-testid="frame-dissolve">
            ✂️ Rozdělit vícerámeček na samostatné přístroje
          </Button>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={actions.moveLeft} disabled={frame.members.indexOf(element.id) === 0}>
              {vertical ? "▲ Posunout" : "◀ Posunout"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={actions.moveRight} disabled={frame.members.indexOf(element.id) === frame.members.length - 1}>
              {vertical ? "Posunout ▼" : "Posunout ▶"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={actions.rotate}>
              ⟳ Otočit rámeček
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={actions.leave}>
              Vyjmout z rámečku
            </Button>
          </div>
        </>
      ) : null}
      <AddToFrameControl level={draft.installation} defaultItem={element.item} gangs={usedGangs} onAdd={onAddToFrame} limit={limit} />
      {/* Fáze 78: osazený víceramček jako šablona firmy (pořadí pozic zleva) */}
      {frame && onSaveTemplate ? <SaveTemplateControl members={members.map((member) => member.item)} onSave={onSaveTemplate} limit={limit} /> : null}
    </div>
  );
}
