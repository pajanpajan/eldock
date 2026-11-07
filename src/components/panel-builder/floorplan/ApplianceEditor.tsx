"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  APPLIANCE_CABLES,
  APPLIANCE_LIBRARY_KEY,
  APPLIANCE_RATINGS,
  APPLIANCE_TEMPLATES,
  RCD_OPTIONS,
  builtinAppliance,
  cableForPoles,
  newAppliance,
  newestLibrary,
  parseApplianceLibrary,
  storedSpecs,
  type ApplianceLibrary,
  type ApplianceSpec,
} from "@/lib/panel-builder/appliances";
import { cn } from "@/lib/utils";
import { saveApplianceLibraryAction } from "@/server/actions/panel-design";

// Sdílená knihovna spotřebičů v prohlížeči (localStorage) + firma (DB): novější vyhrává, ukládá se do obou
const listeners = new Set<() => void>();
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
    return window.localStorage.getItem(APPLIANCE_LIBRARY_KEY);
  } catch {
    return null;
  }
}

/** Fáze 63: knihovna spotřebičů firmy – novější z prohlížeče a z profilu firmy; uložení do obou. */
export function useApplianceLibrary(serverJson: string | null) {
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const library = newestLibrary(parseApplianceLibrary(local), parseApplianceLibrary(serverJson));
  const save = useCallback((specs: ApplianceSpec[]) => {
    const next: ApplianceLibrary = { specs: storedSpecs(specs), updatedAt: Date.now() };
    try {
      window.localStorage.setItem(APPLIANCE_LIBRARY_KEY, JSON.stringify(next));
    } catch {
      // soukromý režim – zůstane jen ve firmě
    }
    listeners.forEach((listener) => listener());
    if (serverTimer) clearTimeout(serverTimer);
    serverTimer = setTimeout(() => void saveApplianceLibraryAction(next), 500);
  }, []);
  return [library, save] as const;
}

const field = "h-8 rounded-md border border-input bg-transparent px-1.5 text-xs text-foreground dark:bg-input/30";

/**
 * Fáze 63: „✎ Upravit / + Přidat“ samostatné spotřebiče – název, zkratka na značce, příkon, jistič (1P / 3P, B / C,
 * 6–32 A), chránič (A / F / B / RCBO), kabel podle počtu fází a výchozí montážní výška; vlastní spotřebiče ze šablon.
 */
export function ApplianceEditor({ open, onOpenChange, specs, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; specs: ApplianceSpec[]; onSave: (specs: ApplianceSpec[]) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="appliance-editor">
        {/* Formulář se při každém otevření založí znovu z aktuální knihovny */}
        {open ? (
          <ApplianceForm
            initial={specs}
            onCancel={() => onOpenChange(false)}
            onSave={(rows) => {
              onSave(rows);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApplianceForm({ initial, onCancel, onSave }: { initial: ApplianceSpec[]; onCancel: () => void; onSave: (specs: ApplianceSpec[]) => void }) {
  const [rows, setRows] = useState<ApplianceSpec[]>(initial);
  const patch = (id: string, change: Partial<ApplianceSpec>) =>
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...change };
        // Počet fází určuje kabel (3 / 5 žil) a RCBO jen pro 1f
        if (change.poles) {
          next.cable = cableForPoles(next.cable, change.poles);
          if (change.poles === 3 && next.rcd === "RCBO") next.rcd = "A";
        }
        return next;
      }),
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>🔥 Samostatné spotřebiče – vlastní jisticí okruhy</DialogTitle>
        <DialogDescription>Úpravy platí pro celý nákres (i osazené spotřebiče) a uloží se v prohlížeči i v profilu firmy. Okruh rozváděče se vytvoří přesně podle zadání; průřez kabelu výpočet zvětší, pokud nevyhoví úbytek napětí nebo jištění.</DialogDescription>
      </DialogHeader>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, index) => {
          const builtin = builtinAppliance(row.id);
          return (
            <li key={row.id} className={cn("grid gap-1.5 rounded-lg border p-2 text-xs sm:grid-cols-[minmax(0,1.6fr)_4rem_5.5rem_4rem_4.5rem_6.5rem_7rem_5rem_auto]", row.custom ? "border-primary/50 bg-primary/5" : "border-border")} data-testid="appliance-row" data-appliance={row.id}>
              <input className={field} value={row.label} maxLength={60} onChange={(event) => patch(row.id, { label: event.target.value })} aria-label={`Název spotřebiče ${index + 1}`} />
              <input className={cn(field, "font-mono uppercase")} value={row.symbol} maxLength={4} onChange={(event) => patch(row.id, { symbol: event.target.value.toUpperCase() })} aria-label={`Zkratka na značce ${index + 1}`} title="Zkratka na značce (2–3 písmena)" />
              <label className="flex items-center gap-1">
                <input className={cn(field, "w-full text-right tabular-nums")} type="number" min={1} max={100000} step={100} value={row.powerW} onChange={(event) => patch(row.id, { powerW: Math.max(1, Math.round(Number(event.target.value) || 0)) })} aria-label={`Příkon ${index + 1} [W]`} />W
              </label>
              <select className={field} value={row.poles} onChange={(event) => patch(row.id, { poles: Number(event.target.value) === 3 ? 3 : 1 })} aria-label={`Póly jističe ${index + 1}`}>
                <option value={1}>1P</option>
                <option value={3}>3P</option>
              </select>
              <select className={field} value={`${row.curve}${row.ratedA}`} onChange={(event) => patch(row.id, { curve: event.target.value.startsWith("C") ? "C" : "B", ratedA: Number(event.target.value.slice(1)) })} aria-label={`Jistič ${index + 1}`}>
                {(["B", "C"] as const).flatMap((curve) =>
                  APPLIANCE_RATINGS.map((rating) => (
                    <option key={`${curve}${rating}`} value={`${curve}${rating}`}>
                      {curve}
                      {rating}
                    </option>
                  )),
                )}
              </select>
              <select className={field} value={row.rcd} onChange={(event) => patch(row.id, { rcd: event.target.value as ApplianceSpec["rcd"] })} aria-label={`Chránič ${index + 1}`} title={RCD_OPTIONS.find((option) => option.id === row.rcd)?.detail}>
                {RCD_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} disabled={option.id === "RCBO" && row.poles === 3} title={option.detail}>
                    Chránič {option.label}
                  </option>
                ))}
              </select>
              <select className={field} value={row.cable} onChange={(event) => patch(row.id, { cable: event.target.value })} aria-label={`Kabel ${index + 1}`}>
                {APPLIANCE_CABLES[row.poles].map((cable) => (
                  <option key={cable} value={cable}>
                    {cable.replace("CYKY-J ", "")}
                  </option>
                ))}
              </select>
              <input
                className={cn(field, "text-right tabular-nums")}
                type="number"
                min={0}
                max={6000}
                step={50}
                placeholder="výchozí"
                value={row.heightMm ?? ""}
                onChange={(event) => patch(row.id, { heightMm: event.target.value === "" ? null : Math.max(0, Math.min(6000, Math.round(Number(event.target.value) || 0))) })}
                aria-label={`Montážní výška ${index + 1} [mm]`}
                title="Výchozí montážní výška vývodu [mm] (prázdné = podle výškového profilu)"
              />
              {builtin ? (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setRows((current) => current.map((candidate) => (candidate.id === row.id ? builtin : candidate)))} title="Obnovit výchozí hodnoty" aria-label={`Obnovit spotřebič ${index + 1}`}>
                  <RotateCcw className="size-3.5" aria-hidden />
                </Button>
              ) : (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-red-300" onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))} title="Smazat vlastní spotřebič" aria-label={`Smazat spotřebič ${index + 1}`}>
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-primary/50 p-2" data-testid="appliance-templates">
        <p className="flex items-center gap-1 text-xs font-bold">
          <Plus className="size-3.5" aria-hidden /> Přidat vlastní spotřebič
        </p>
        <div className="flex flex-wrap gap-1">
          {APPLIANCE_TEMPLATES.map((template) => (
            <button key={template.label} type="button" onClick={() => setRows((current) => [...current, newAppliance(template)])} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:border-primary/60" data-testid="appliance-template">
              {template.label}
            </button>
          ))}
          <button type="button" onClick={() => setRows((current) => [...current, newAppliance({ label: "Vlastní spotřebič", symbol: "SP", powerW: 2000, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 1 })])} className="rounded-full border border-primary/60 px-2 py-0.5 text-[11px] font-semibold" data-testid="appliance-add">
            + Prázdný spotřebič
          </button>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Zrušit
        </Button>
        <Button type="button" onClick={() => onSave(rows.map((row) => ({ ...row, label: row.label.trim() || builtinAppliance(row.id)?.label || "Spotřebič", symbol: row.symbol.trim() || "SP" })))} data-testid="appliance-save">
          Uložit spotřebiče
        </Button>
      </DialogFooter>
    </>
  );
}
