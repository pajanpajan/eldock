"use client";

import { LayoutGrid, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { MAX_FRAME_GANGS, assembliesFor, assemblyError, assemblyGangs, assemblyLabel, frameableItems, gangsOf } from "@/lib/panel-builder/floorplan-frames";
import { cn } from "@/lib/utils";

export interface AssemblyPick {
  key: string;
  members: string[];
  label: string;
}

/** Rozbalení panelu sestav si prohlížeč pamatuje (kdo sestavy nepoužívá, sbalí je jednou provždy). */
const OPEN_KEY = "eldock-floorplan-assemblies-open";

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Fáze 62: sestavy ve víceramečku – samostatný panel nad paletou značek (ne v ní: „2× vypínač č. 1“ se nesmí plést
 * s jednotlivou značkou). Hotové sestavy (zásuvky, vypínače, kombinace) a vlastní složení po pozicích (nejvýš 5 pozic,
 * dvojzásuvka = 2). Vybraná sestava se vloží jedním klikem do půdorysu, přisazená a vyrovnaná v jednom rámečku.
 */
export function FrameAssemblyPalette({ level, active, onPick }: { level: InstallLevel; active: string | null; onPick: (pick: AssemblyPick) => void }) {
  const presets = assembliesFor(level);
  const options = frameableItems(level);
  const allowed = new Set(options.map((item) => item.id));
  const [expanded, setExpanded] = useState(readOpen);
  const [custom, setCustom] = useState<string[]>(["socket", "socket"]);
  const [customOpen, setCustomOpen] = useState(false);
  // Po změně úrovně instalace zůstanou ve vlastní sestavě jen přístroje dostupné na nové úrovni
  const members = custom.filter((id) => allowed.has(id));
  const gangs = assemblyGangs(members);
  const error = assemblyError(members);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // bez úložiště se stav jen nezapamatuje
    }
  };

  /** Změna vlastní sestavy; když se zrovna vkládá, vkládá se rovnou nová podoba. */
  const change = (next: string[]) => {
    setCustom(next);
    if (active === "custom" && !assemblyError(next)) onPick({ key: "custom", members: next, label: assemblyLabel(next) });
  };

  return (
    <section aria-label="Sestavy ve víceramečku" className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-card p-3" data-testid="assembly-palette">
      <button type="button" onClick={toggle} aria-expanded={expanded} className="flex items-center justify-between gap-2 text-left text-xs font-bold text-amber-200" data-testid="assembly-palette-toggle">
        <span>▦ Sestavy ve víceramečku</span>
        <span className="font-normal text-muted-foreground">{expanded ? "▾" : `▸ ${presets.length}`}</span>
      </button>
      {expanded ? (
        <>
          <p className="text-[11px] text-muted-foreground">Vypínače a zásuvky v jednom rámečku – vloží se celé jedním klikem, u stěny přisazené a natočené ke stěně.</p>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => {
              const size = assemblyGangs(preset.members);
              const pressed = active === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onPick({ key: preset.id, members: [...preset.members], label: preset.label })}
                  title={`${preset.label} – rámeček ${size}R, přisazené a vyrovnané`}
                  className={cn("flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight", pressed ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground")}
                  data-assembly={preset.id}
                >
                  <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] font-bold text-amber-200">{size}R</span>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setCustomOpen((value) => !value)} aria-expanded={customOpen} className="self-start text-xs font-semibold text-primary hover:underline" data-testid="assembly-custom-toggle">
            {customOpen ? "▾" : "▸"} Vlastní sestava (2–{MAX_FRAME_GANGS} pozic)
          </button>
          {customOpen ? (
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-1.5" data-testid="assembly-custom">
              {members.map((id, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{index + 1}.</span>
                  <select
                    value={id}
                    onChange={(event) => change(members.map((current, position) => (position === index ? event.target.value : current)))}
                    aria-label={`Pozice ${index + 1} sestavy`}
                    className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30"
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => change(members.filter((_, position) => position !== index))}
                    disabled={members.length <= 2}
                    aria-label={`Odebrat pozici ${index + 1}`}
                    className="rounded p-0.5 text-muted-foreground hover:text-red-300 disabled:opacity-30"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => change([...members, "socket"])} disabled={gangs >= MAX_FRAME_GANGS} data-testid="assembly-add">
                  <Plus className="size-3.5" aria-hidden /> Pozice
                </Button>
                <span className={cn("ml-auto font-mono text-[11px]", error ? "text-amber-200" : "text-muted-foreground")} data-testid="assembly-gangs">
                  {gangs}R
                </span>
              </div>
              {error ? <p className="text-[11px] text-amber-200">{error}</p> : null}
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={Boolean(error)}
                aria-pressed={active === "custom"}
                onClick={() => onPick({ key: "custom", members, label: assemblyLabel(members) })}
                data-testid="assembly-custom-place"
              >
                <LayoutGrid className="size-3.5" aria-hidden /> Vložit sestavu {gangs}R
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * Fáze 62: „▦ Přidat do rámečku“ v detailu přístroje – vedle vybraného přístroje se přidá další (stejný nebo jiný)
 * a oba skončí v jednom víceramečku; v rámečku se přidá na jeho konec.
 */
export function AddToFrameControl({ level, defaultItem, gangs, onAdd }: { level: InstallLevel; defaultItem: string; gangs: number; onAdd: (item: string) => void }) {
  const options = frameableItems(level);
  const [item, setItem] = useState(options.some((option) => option.id === defaultItem) ? defaultItem : (options[0]?.id ?? "socket"));
  const next = gangs + gangsOf({ item, frameUnits: 1 });
  const full = next > MAX_FRAME_GANGS;
  return (
    <div className="flex flex-col gap-1" data-testid="add-to-frame">
      <div className="flex items-center gap-1 text-xs">
        <span className="shrink-0 font-semibold text-amber-200">▦ Přidat do rámečku:</span>
        <select value={item} onChange={(event) => setItem(event.target.value)} aria-label="Přístroj přidaný do rámečku" className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30">
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" disabled={full} onClick={() => onAdd(item)} data-testid="add-to-frame-button">
          <Plus className="size-3.5" aria-hidden /> Přidat
        </Button>
      </div>
      <p className={cn("text-[11px]", full ? "text-amber-200" : "text-muted-foreground")}>
        {full ? `Rámeček by měl ${next} pozic – víceramček pojme nejvýš ${MAX_FRAME_GANGS}.` : `Přidá se vedle, přisazený a vyrovnaný (${gangs}R → ${next}R).`}
      </p>
    </div>
  );
}
