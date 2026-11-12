"use client";

import Link from "next/link";

import { Input } from "@/components/ui/input";
import { CAD_FORMATS, REWARD_PRESETS, type CadFormat, type RedlineMode } from "@/lib/redline-marketplace";
import { cn } from "@/lib/utils";

export interface RoutingState {
  mode: RedlineMode;
  format: CadFormat;
  sheets: string;
  rewardCzk: string;
  dueAt: string;
  description: string;
}

export const initialRouting: RoutingState = { mode: "INTERNAL_DESIGNER", format: "PDF", sheets: "1", rewardCzk: "800", dueAt: "", description: "" };

/** Vstup akce z volby předání (cesta A bez parametrů poolu). */
export function routingInput(state: RoutingState) {
  const common = { description: state.description.trim() || undefined, dueAt: state.dueAt || undefined };
  return state.mode === "POOL" ? { mode: "POOL" as const, format: state.format, sheets: Number(state.sheets) || 1, rewardCzk: Number(state.rewardCzk) || 0, ...common } : { mode: "INTERNAL_DESIGNER" as const, ...common };
}

/**
 * Fáze 103: předání Červenky k čistému překreslení – cesta A firemní (interní nebo smluvní) projektant závodu, cesta B
 * ELDOCK Pool externích projektantů (formát, náročnost a orientační odměna; „kdo první přijme úkol“).
 */
export function RedlineRoutingChoice({ value, onChange, designer, canConfigure }: { value: RoutingState; onChange: (next: RoutingState) => void; designer: { name: string | null; email: string | null } | null; canConfigure: boolean }) {
  const set = (patch: Partial<RoutingState>) => onChange({ ...value, ...patch });
  const card = (active: boolean) => cn("flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 text-sm", active ? "border-primary bg-primary/10" : "border-border");
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="redline-routing">
      <legend className="px-1 text-base font-semibold">Předání k překreslení do CADu</legend>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className={card(value.mode === "INTERNAL_DESIGNER")} data-testid="routing-internal">
          <span className="flex items-center gap-2 font-semibold">
            <input type="radio" name="routing" checked={value.mode === "INTERNAL_DESIGNER"} onChange={() => set({ mode: "INTERNAL_DESIGNER" })} className="size-4 accent-primary" />
            🏢 Přiřadit našemu firemnímu projektantovi
          </span>
          <span className="text-muted-foreground">
            {designer?.email ? (
              <>
                {designer.name ?? "Firemní projektant"} ({designer.email}) dostane podklady (schéma s vrstvou Červenky, popis a termín); stav: Čeká na překreslení → Překresluje se → Hotovo.
              </>
            ) : (
              <>
                Závod nemá vyplněného projektanta – požadavek půjde do fronty CAE Back-Office závodu.{" "}
                {canConfigure ? (
                  <Link href="/admin/modules#firemni-projektant" className="underline">
                    Doplnit projektanta v Nastavení závodu
                  </Link>
                ) : (
                  "Projektanta doplní správce závodu v Nastavení závodu."
                )}
              </>
            )}
          </span>
        </label>
        <label className={card(value.mode === "POOL")} data-testid="routing-pool">
          <span className="flex items-center gap-2 font-semibold">
            <input type="radio" name="routing" checked={value.mode === "POOL"} onChange={() => set({ mode: "POOL" })} className="size-4 accent-primary" />
            🌐 Poptat překreslení přes ELDOCK Pool externích projektantů (Freelancer Marketplace)
          </span>
          <span className="text-muted-foreground">Pro závody bez vlastního projektanta – úkol převezme první schválený projektant poolu, který klikne na „Přijímám úkol“.</span>
        </label>
      </div>
      {value.mode === "POOL" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="routing-pool-options">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Zdrojový formát
            <select value={value.format} onChange={(event) => set({ format: event.target.value as CadFormat })} className="h-11 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" data-testid="routing-format">
              {CAD_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Náročnost
            <select
              value={String(REWARD_PRESETS.findIndex((preset) => String(preset.sheets) === value.sheets && String(preset.rewardCzk) === value.rewardCzk))}
              onChange={(event) => {
                const preset = REWARD_PRESETS[Number(event.target.value)];
                if (preset) set({ sheets: String(preset.sheets), rewardCzk: String(preset.rewardCzk) });
              }}
              className="h-11 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30"
              data-testid="routing-preset"
            >
              <option value="-1">vlastní rozsah</option>
              {REWARD_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label} – {preset.rewardCzk.toLocaleString("cs-CZ")} Kč
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Orientační odměna [Kč bez DPH]
            <Input type="number" min={100} max={100000} step={100} value={value.rewardCzk} onChange={(event) => set({ rewardCzk: event.target.value })} className="h-11 font-mono" data-testid="routing-reward" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Termín dodání
            <Input type="date" value={value.dueAt} onChange={(event) => set({ dueAt: event.target.value })} className="h-11" data-testid="routing-due" />
          </label>
        </div>
      ) : (
        <label className="flex max-w-xs flex-col gap-1 text-xs text-muted-foreground">
          Požadovaný termín překreslení
          <Input type="date" value={value.dueAt} onChange={(event) => set({ dueAt: event.target.value })} className="h-11" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Popis změny pro projektanta (nepovinné – jinak poznámka z průvodce)
        <Input value={value.description} maxLength={1000} onChange={(event) => set({ description: event.target.value })} className="h-11" data-testid="routing-description" />
      </label>
    </fieldset>
  );
}
