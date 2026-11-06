"use client";

import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_STOREY_MM, FLOOR_NAME_CHIPS, MAX_FLOORS, levelLabel, type FloorSheet } from "@/lib/panel-builder/floorplan-editor";
import { cn } from "@/lib/utils";

/**
 * Fáze 59: podlaží domu nad plátnem – záložky (název a výškový údaj ±0,000 / +3,000), přidání podlaží, název,
 * výška podlahy a smazání aktivního podlaží. Každé podlaží má vlastní podklad, kalibraci, místnosti a prvky.
 */
export function FloorBar({
  floors,
  activeId,
  panelFloorId,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
}: {
  floors: FloorSheet[];
  activeId: string;
  /** Podlaží s hlavním rozváděčem (štítek ⚡). */
  panelFloorId: string | null;
  onSelect: (id: string) => void;
  onAdd: (input: { name: string; levelMm: number }) => void;
  onUpdate: (id: string, patch: { name?: string; levelMm?: number }) => void;
  onRemove: (id: string) => void;
}) {
  const active = floors.find((floor) => floor.id === activeId) ?? floors[0];
  const [adding, setAdding] = useState(false);
  const top = floors[floors.length - 1];
  const [draftName, setDraftName] = useState("");
  const [draftLevel, setDraftLevel] = useState(String((top.levelMm + DEFAULT_STOREY_MM) / 1000));
  const counts = (floor: FloorSheet) => floor.elements.filter((element) => element.item !== "riser").length;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 text-xs" role="group" aria-label="Podlaží domu" data-testid="floor-bar">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1 font-semibold text-muted-foreground">
          <Layers className="size-4" aria-hidden /> Podlaží:
        </span>
        {[...floors].reverse().map((floor) => (
          <button
            key={floor.id}
            type="button"
            role="tab"
            aria-selected={floor.id === activeId}
            onClick={() => onSelect(floor.id)}
            className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-semibold", floor.id === activeId ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            data-testid={`floor-tab-${floor.name}`}
          >
            {floor.id === panelFloorId ? <span title="Hlavní rozváděč">⚡</span> : null}
            {floor.name}
            <span className="font-mono text-[10px] opacity-80">{levelLabel(floor.levelMm)}</span>
            <span className="rounded bg-black/20 px-1 text-[10px]">{counts(floor)}</span>
          </button>
        ))}
        {floors.length < MAX_FLOORS ? (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => {
              setAdding((value) => !value);
              setDraftLevel(String((top.levelMm + DEFAULT_STOREY_MM) / 1000).replace(".", ","));
            }}
            aria-expanded={adding}
            data-testid="floor-add"
          >
            <Plus className="size-3.5" aria-hidden /> Přidat podlaží
          </Button>
        ) : null}
        <span className="ml-auto text-muted-foreground">Trasy mezi podlažími vedou stoupacím vedením ↕ (paleta Rozváděč).</span>
      </div>
      {adding ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-primary/50 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            const levelMm = Math.round(Number(draftLevel.replace(",", ".")) * 1000);
            onAdd({ name: draftName.trim() || `${Math.round(levelMm / DEFAULT_STOREY_MM) + 1}. NP`, levelMm: Number.isFinite(levelMm) ? levelMm : top.levelMm + DEFAULT_STOREY_MM });
            setAdding(false);
            setDraftName("");
          }}
          data-testid="floor-add-form"
        >
          <label className="flex flex-col gap-1 text-muted-foreground">
            Název podlaží
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="2. NP" maxLength={30} className="h-8 w-32 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Název nového podlaží" />
          </label>
          <div className="flex flex-wrap gap-1">
            {FLOOR_NAME_CHIPS.filter((name) => !floors.some((floor) => floor.name === name)).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setDraftName(name);
                  if (name === "1. PP") setDraftLevel(String(-(DEFAULT_STOREY_MM - 200) / 1000));
                }}
                className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {name}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-muted-foreground">
            Výška podlahy [m]
            <input value={draftLevel} onChange={(event) => setDraftLevel(event.target.value)} inputMode="decimal" className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm text-foreground tabular-nums dark:bg-input/30" aria-label="Výška podlahy nového podlaží [m]" />
          </label>
          <Button type="submit" size="sm" data-testid="floor-add-confirm">
            Vytvořit podlaží
          </Button>
        </form>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-muted-foreground">
          Název:
          <input key={`n-${active.id}-${active.name}`} defaultValue={active.name} maxLength={30} onBlur={(event) => event.target.value.trim() && event.target.value !== active.name && onUpdate(active.id, { name: event.target.value })} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} className="h-7 w-28 rounded-md border border-input bg-transparent px-1.5 text-foreground dark:bg-input/30" aria-label="Název aktivního podlaží" />
        </label>
        <label className="flex items-center gap-1 text-muted-foreground" title="Výška čisté podlahy nad podlažím rozváděče (konstrukční výška podlaží se počítá do stoupacího vedení)">
          Výška podlahy:
          <input
            key={`l-${active.id}-${active.levelMm}`}
            defaultValue={String(active.levelMm / 1000).replace(".", ",")}
            inputMode="decimal"
            onBlur={(event) => {
              const value = Math.round(Number(event.target.value.replace(",", ".")) * 1000);
              if (Number.isFinite(value) && value !== active.levelMm) onUpdate(active.id, { levelMm: value });
            }}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            className="h-7 w-20 rounded-md border border-input bg-transparent px-1.5 text-right text-foreground tabular-nums dark:bg-input/30"
            aria-label="Výška podlahy aktivního podlaží [m]"
          />
          m
        </label>
        {floors.length > 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-red-300 hover:bg-red-500/15"
            onClick={() => {
              if (window.confirm(`Smazat podlaží ${active.name} i se všemi prvky, místnostmi a podkladem?`)) onRemove(active.id);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden /> Smazat podlaží
          </Button>
        ) : null}
      </div>
    </div>
  );
}
