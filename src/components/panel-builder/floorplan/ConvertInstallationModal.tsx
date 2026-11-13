"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { allElements, paletteItem, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import {
  CLASSIC_SERIES,
  SERIES_BY_SYSTEM,
  SYSTEM_LABELS,
  convertInstallationMode,
  defaultSmartOptions,
  isSmartSystem,
  type ConversionResult,
  type SmartConversionOptions,
} from "@/lib/panel-builder/installation-mode-converter";
import type { SmartSystemId } from "@/lib/panel-builder/smart-home";
import { cn } from "@/lib/utils";

// Fáze 109: krátké okno převodu návrhu Klasická 230 V ⇄ Chytrá domácnost – cílový systém, designová řada a způsob
// převodu vypínačů a tras. Původní návrh zůstane v projektu jako přepínatelná varianta.

const SYSTEMS: SmartSystemId[] = ["abb_freeathome", "loxone", "abb_knx", "taphome"];

const SMART_CHECKS: readonly { key: keyof Omit<SmartConversionOptions, "system" | "series">; label: string }[] = [
  { key: "replaceSwitches", label: "Nahradit klasické vypínače 230 V (č. 1, 5, 6, 7) sběrnicovými tlačítky 24 V DC" },
  { key: "mergeDoorControls", label: "Sloučit vícenásobné vypínače u dveří (např. světlo + žaluzie) do jednoho vícerámečku / vícekanálového tlačítka" },
  { key: "starTopology", label: "Přepočítat trasy světel a žaluzií na přímé hvězdicové větve do rozváděče + sběrnicovou linku 24 V DC" },
  { key: "dimMainLights", label: "Volitelně: Nastavit hlavní světla v obytných místnostech jako stmívatelná (přidat stmívací aktor)" },
  { key: "addPresence", label: "Volitelně: Doplnit do chodeb a koupelen stropní PIR čidla přítomnosti" },
];

export function ConvertInstallationModal({
  open,
  onOpenChange,
  draft,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: FloorplanDraft;
  onConverted: (result: Extract<ConversionResult, { ok: true }>) => void;
}) {
  const toSmart = draft.installation === "classic";
  const initialSystem = isSmartSystem(draft.smartSystem) ? draft.smartSystem : "abb_freeathome";
  const [smart, setSmart] = useState<SmartConversionOptions>(() => defaultSmartOptions(initialSystem));
  const [classicSeries, setClassicSeries] = useState<string>(CLASSIC_SERIES[0].value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => {
    const elements = allElements(draft);
    const controllers = elements.filter((element) => paletteItem(element.item)?.kind === "switch");
    return { controllers: controllers.length, bus: controllers.filter((element) => paletteItem(element.item)?.bus).length };
  }, [draft]);

  function pickSystem(system: SmartSystemId) {
    setSmart((current) => ({ ...current, system, series: SERIES_BY_SYSTEM[system][0].value }));
  }

  function convert() {
    setBusy(true);
    setError(null);
    // Výpočet převodu je synchronní – krátké odložení, ať se ukáže stav „Převádím…“
    window.setTimeout(() => {
      const result = convertInstallationMode(draft, toSmart ? { target: "smart", options: smart } : { target: "classic", options: { series: classicSeries } });
      setBusy(false);
      if (!result.ok) return setError(result.error);
      onConverted(result);
      onOpenChange(false);
    }, 30);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="convert-installation-modal" data-target={toSmart ? "smart" : "classic"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-primary" aria-hidden />
            {toSmart ? "Převést na Chytrou domácnost (Smart Home)" : "Převést na Klasickou instalaci 230 V"}
          </DialogTitle>
          <DialogDescription>
            Původní návrh zůstane v projektu jako přepínatelná varianta – nad plátnem pak přepnete mezi verzemi jedním klikem a pro každou vygenerujete rozváděč i cenovou nabídku.
            {toSmart ? ` Ovladačů v návrhu: ${counts.controllers}.` : ` Sběrnicových prvků v návrhu: ${counts.bus}.`}
          </DialogDescription>
        </DialogHeader>

        {toSmart ? (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">1) Cílový systém Smart Home</legend>
              <div role="radiogroup" aria-label="Cílový systém Smart Home" className="grid gap-2 sm:grid-cols-2">
                {SYSTEMS.map((system) => (
                  <button
                    key={system}
                    type="button"
                    role="radio"
                    aria-checked={smart.system === system}
                    onClick={() => pickSystem(system)}
                    className={cn("touch-target rounded-lg border px-3 py-2 text-left text-sm font-medium", smart.system === system ? "border-primary bg-primary/15" : "border-border hover:bg-muted/50")}
                    data-testid={`convert-system-${system}`}
                  >
                    {SYSTEM_LABELS[system]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">2) Designová řada ovladačů</span>
              <select
                value={smart.series ?? ""}
                onChange={(event) => setSmart((current) => ({ ...current, series: event.target.value || null }))}
                className="h-10 rounded-md border border-input bg-transparent px-2 text-sm"
                data-testid="convert-series"
              >
                {SERIES_BY_SYSTEM[smart.system].map((option) => (
                  <option key={option.label} value={option.value ?? ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">3) Jak převést vypínače a světla</legend>
              {SMART_CHECKS.map((check) => {
                const disabled = !smart.starTopology && (check.key === "replaceSwitches" || check.key === "mergeDoorControls");
                return (
                  <label key={check.key} className={cn("flex items-start gap-2 text-sm", disabled && "opacity-50")}>
                    <input
                      type="checkbox"
                      checked={smart[check.key] && !disabled}
                      disabled={disabled}
                      onChange={(event) => setSmart((current) => ({ ...current, [check.key]: event.target.checked }))}
                      className="mt-0.5 size-4 accent-primary"
                      data-testid={`convert-${check.key}`}
                    />
                    {check.label}
                  </label>
                );
              })}
              {!smart.starTopology ? <p className="text-xs text-muted-foreground">Bez hvězdicových tras vznikne hybridní / retrofit varianta – kabeláž 230 V a vypínače zůstanou, chytré moduly pod vypínače.</p> : null}
            </fieldset>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Cílová designová řada vypínačů 230 V</span>
              <select value={classicSeries} onChange={(event) => setClassicSeries(event.target.value)} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm" data-testid="convert-classic-series">
                {CLASSIC_SERIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Sběrnicová tlačítka se převedou na klasické vypínače podle počtu ovládacích míst světla: 1 místo = řazení 1 (u dvou skupin světel řazení 5), 2 místa = 6, 3 a více míst = 6 na krajích a 7 uprostřed. Žaluziová tlačítka na žaluziové spínače, trasy na klasické okruhy.
            </p>
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="button" onClick={convert} disabled={busy} className="gap-2 font-semibold" data-testid="convert-submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowLeftRight className="size-4" aria-hidden />}
            {busy ? "Převádím…" : "Převést a zachovat obě verze"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
