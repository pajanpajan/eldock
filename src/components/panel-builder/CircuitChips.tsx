"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { CHIPS_STORAGE_KEY, DEFAULT_CHIPS, moveChip, newestChipSet, parseChipSet, type ChipPreset, type CircuitChip } from "@/lib/panel-builder/circuit-chips";
import { CONFIG_CATEGORIES, type ConfigCategory } from "@/lib/panel-builder/configurator";
import { cn } from "@/lib/utils";
import { saveCircuitChipsAction } from "@/server/actions/panel-design";

// Sdílený stav štítků v prohlížeči: localStorage + oznámení všem odběratelům v tomto okně
const listeners = new Set<() => void>();
/** Zápis do DB až po chvíli klidu (psaní názvu štítku neposílá akci po každém znaku). */
let serverTimer: ReturnType<typeof setTimeout> | null = null;
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function readLocal(): string | null {
  try {
    return window.localStorage.getItem(CHIPS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Štítky funkce obvodu: novější sada z prohlížeče nebo firmy (DB); uložení do obou. */
export function useCircuitChips(serverJson: string | null) {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const set = newestChipSet(parseChipSet(local), parseChipSet(serverJson));
  const save = useCallback((chips: CircuitChip[]) => {
    const next = { chips, updatedAt: Date.now() };
    try {
      window.localStorage.setItem(CHIPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // soukromý režim – zůstane jen v DB
    }
    listeners.forEach((listener) => listener());
    if (serverTimer) clearTimeout(serverTimer);
    serverTimer = setTimeout(() => void saveCircuitChipsAction(next), 800);
  }, []);
  return [set.chips, save] as const;
}

const selectClass = "h-8 rounded-md border border-input bg-transparent px-1 text-xs dark:bg-input/30";
const PRESET_POLES = ["1P", "1P+N", "2P", "3P", "3P+N", "4P"];
const PRESET_CURVES = ["B", "C", "D"];
const PRESET_CURRENTS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100];

const presetText = (preset: ChipPreset | null | undefined) =>
  preset ? [CONFIG_CATEGORIES.find((category) => category.value === preset.category)?.label, preset.poles, preset.curve, preset.ratedCurrentA ? `${preset.ratedCurrentA}A` : null].filter(Boolean).join(" → ") : "";

/**
 * Rychlé štítky funkce obvodu (fáze 45): klik = popis (s automatickým číslováním) + Smart Preset
 * (kategorie, póly, charakteristika, proud). „+ Přidat vlastní“ a „✎ Upravit štítky“ (přejmenovat,
 * smazat, pořadí, preset).
 */
export function CircuitChips({ chips, onChange, active, onPick }: { chips: CircuitChip[]; onChange: (chips: CircuitChip[]) => void; active: string; onPick: (chip: CircuitChip) => void }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const update = (index: number, patch: Partial<CircuitChip>) => onChange(chips.map((chip, i) => (i === index ? { ...chip, ...patch } : chip)));
  const updatePreset = (index: number, patch: Partial<ChipPreset> | null) => {
    const current = chips[index].preset;
    if (patch === null) return update(index, { preset: null });
    update(index, { preset: { category: current?.category ?? "MCB", ...current, ...patch } });
  };

  function add() {
    const label = adding?.trim();
    setAdding(null);
    if (!label) return;
    onChange([...chips, { id: `custom-${Date.now()}`, label: label.slice(0, 40), preset: null }]);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-primary/50 bg-primary/5 p-2" data-testid="chips-editor">
        {chips.map((chip, index) => (
          <div key={chip.id} className="flex flex-wrap items-center gap-1.5" data-testid="chip-row">
            <Input value={chip.label} maxLength={40} onChange={(event) => update(index, { label: event.target.value })} aria-label={`Název štítku ${index + 1}`} className="h-8 w-36 text-xs" />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Číslovat: Světla 1, Světla 2 …">
              <input type="checkbox" className="accent-primary" checked={!!chip.numbered} onChange={(event) => update(index, { numbered: event.target.checked })} aria-label={`Číslovat štítek ${chip.label}`} />№
            </label>
            <select className={selectClass} value={chip.preset?.category ?? ""} aria-label={`Preset kategorie – ${chip.label}`} onChange={(event) => updatePreset(index, event.target.value ? { category: event.target.value as ConfigCategory } : null)}>
              <option value="">bez presetu</option>
              {CONFIG_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            {chip.preset ? (
              <>
                <select className={selectClass} value={chip.preset.poles ?? ""} aria-label={`Preset póly – ${chip.label}`} onChange={(event) => updatePreset(index, { poles: event.target.value || undefined })}>
                  <option value="">póly</option>
                  {PRESET_POLES.map((poles) => (
                    <option key={poles}>{poles}</option>
                  ))}
                </select>
                <select className={selectClass} value={chip.preset.curve ?? ""} aria-label={`Preset charakteristika – ${chip.label}`} onChange={(event) => updatePreset(index, { curve: event.target.value || undefined })}>
                  <option value="">char.</option>
                  {PRESET_CURVES.map((curve) => (
                    <option key={curve}>{curve}</option>
                  ))}
                </select>
                <select className={selectClass} value={chip.preset.ratedCurrentA ?? ""} aria-label={`Preset proud – ${chip.label}`} onChange={(event) => updatePreset(index, { ratedCurrentA: event.target.value ? Number(event.target.value) : undefined })}>
                  <option value="">In</option>
                  {PRESET_CURRENTS.map((current) => (
                    <option key={current} value={current}>
                      {current}A
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <span className="ml-auto flex gap-0.5">
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index === 0} onClick={() => onChange(moveChip(chips, index, -1))} aria-label={`Posunout štítek ${chip.label} nahoru`}>
                <ArrowUp className="size-3.5" aria-hidden />
              </button>
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index === chips.length - 1} onClick={() => onChange(moveChip(chips, index, 1))} aria-label={`Posunout štítek ${chip.label} dolů`}>
                <ArrowDown className="size-3.5" aria-hidden />
              </button>
              <button type="button" className="rounded p-1 text-red-300 hover:bg-red-500/15" onClick={() => onChange(chips.filter((_, i) => i !== index))} aria-label={`Smazat štítek ${chip.label}`}>
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </span>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="flex min-h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:border-primary" onClick={() => onChange([...chips, { id: `custom-${Date.now()}`, label: "Nový štítek", preset: null }])}>
            <Plus className="size-3.5" aria-hidden /> Přidat štítek
          </button>
          <button type="button" className="flex min-h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange([...DEFAULT_CHIPS])}>
            <RotateCcw className="size-3.5" aria-hidden /> Obnovit výchozí
          </button>
          <button type="button" className="ml-auto min-h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground" onClick={() => {
              onChange(chips.filter((chip) => chip.label.trim()));
              setEditing(false);
            }} data-testid="chips-done">
            Hotovo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rychlé štítky funkce obvodu" data-testid="circuit-chips">
      {chips.map((chip) => {
        const pressed = active === chip.label || new RegExp(`^${chip.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`).test(active);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            title={chip.preset ? `Preset: ${presetText(chip.preset)}` : undefined}
            onClick={() => onPick(chip)}
            className={cn(
              "min-h-8 rounded-full border px-2.5 text-xs font-medium transition-colors",
              pressed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
              chip.preset && !pressed && "border-sky-500/40",
            )}
          >
            {chip.label}
          </button>
        );
      })}
      {adding !== null ? (
        <Input
          autoFocus
          value={adding}
          maxLength={40}
          onChange={(event) => setAdding(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
            if (event.key === "Escape") setAdding(null);
          }}
          aria-label="Název vlastního štítku"
          placeholder="např. Sauna"
          className="h-8 w-32 text-xs"
        />
      ) : (
        <button type="button" onClick={() => setAdding("")} className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
          <Plus className="size-3" aria-hidden /> Přidat vlastní
        </button>
      )}
      <button type="button" onClick={() => setEditing(true)} className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
        <Pencil className="size-3" aria-hidden /> ✎ Upravit štítky
      </button>
    </div>
  );
}
