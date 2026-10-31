"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, PICKER_MANUFACTURERS, formatWatts } from "@/lib/panel-builder/catalog";
import { PICKER_CATEGORIES, PICKER_CURRENTS, PICKER_CURVES, PICKER_POLES, initialSelection, pickerCandidates, sameManufacturer, type PickerSelection } from "@/lib/panel-builder/matching";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { assignComponentAction, lookupComponentAction } from "@/server/actions/panel-builder";
import type { PickerComponent } from "@/server/queries/panel-builder";
import type { ImportedComponent } from "@/server/services/panel-builder";

import type { WorkspaceItem } from "./RecognitionWorkspace";

function Tile({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "touch-target min-h-12 rounded-lg border-2 px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

/** „Bleskový identifikátor nerozpoznaných prvků“ – kategorie → póly a charakteristika → proud → kus z katalogu. */
export function SmartFallbackPicker({ item, catalog, dominant, onAssigned }: { item: WorkspaceItem; catalog: PickerComponent[]; dominant: string; onAssigned: () => void }) {
  const [selection, setSelection] = useState<PickerSelection>(() => initialSelection(item.detected, dominant, item.modulesWidth));
  const [text, setText] = useState(item.rawOcrText?.replace(/[?б]/g, "") ?? "");
  const [found, setFound] = useState<{ component: ImportedComponent; mode: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const candidates = useMemo(() => pickerCandidates(catalog, selection).filter((component) => component.id !== found?.component.id).slice(0, 12), [catalog, selection, found]);

  const set = (patch: Partial<PickerSelection>) => setSelection((current) => ({ ...current, ...patch }));
  const toggle = <K extends keyof PickerSelection>(key: K, value: PickerSelection[K]) => set({ [key]: selection[key] === value ? null : value } as Partial<PickerSelection>);

  function assign(componentId: string) {
    setBusy(componentId);
    startTransition(async () => {
      const result = await assignComponentAction(item.id, componentId);
      setBusy(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${item.designation} přiřazen – ověřeno.`);
      onAssigned();
    });
  }

  function lookup() {
    startTransition(async () => {
      const result = await lookupComponentAction({
        itemId: item.id,
        text,
        hints: { category: selection.category, poles: selection.poles, current: selection.current, curve: selection.curve, manufacturer: selection.manufacturer },
      });
      if (!result.ok) return void toast.error(result.error);
      const component = result.data.component;
      if (!component) return void toast.error("Přístroj se podle textu nepodařilo dohledat. Zkuste delší úsek typového označení.");
      setFound({ component, mode: result.data.mode });
      toast.success(
        result.data.mode === "CATALOG" ? `Nalezeno v katalogu: ${component.typeCode}` : component.status === "created" ? `Dohledáno a uloženo do katalogu: ${component.typeCode} (${formatWatts(component.powerLossWatts)})` : `Nalezeno: ${component.typeCode}`,
      );
    });
  }

  const suggested = item.recognitionStatus === "PARTIAL" ? item.component : null;

  return (
    <div className="flex flex-col gap-4" data-testid="smart-picker">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-semibold">{item.designation}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs", RECOGNITION[item.recognitionStatus].badge)}>{RECOGNITION[item.recognitionStatus].label}</span>
        {item.circuitLabel ? <span className="text-sm text-muted-foreground">{item.circuitLabel}</span> : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          OCR: {item.rawOcrText || "–"} · jistota {Math.round(item.confidence * 100)} %
        </span>
      </div>

      {suggested ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
          <span>
            Návrh AI: <b>{suggested.manufacturer} {suggested.typeCode}</b> · {formatWatts(suggested.powerLossWatts)}
          </span>
          <Button className="touch-target ml-auto gap-2" onClick={() => assign(suggested.id)} disabled={pending}>
            {busy === suggested.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Potvrdit návrh
          </Button>
        </div>
      ) : null}

      {/* Výrobce jen pro tento modul – ostatní přístroje v rozváděči se nemění */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" role="group" aria-label="Výrobce přístroje">
        <span className="mr-1">Výrobce:</span>
        {PICKER_MANUFACTURERS.map((option) => {
          const active = option.value === null ? selection.manufacturer === null : sameManufacturer(selection.manufacturer, option.value);
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => set({ manufacturer: option.value })}
              className={cn("min-h-8 rounded-md border px-2.5 font-semibold tracking-wide", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:text-foreground")}
            >
              {option.label}
            </button>
          );
        })}
        <span className="ml-auto">Šířka: {item.modulesWidth} M</span>
      </div>

      <section aria-label="1. Kategorie" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">1. Kategorie</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PICKER_CATEGORIES.map((category) => (
            <Tile key={category.value} active={selection.category === category.value} onClick={() => set({ category: category.value })}>
              {category.label}
            </Tile>
          ))}
        </div>
      </section>

      <section aria-label="2. Póly a charakteristika" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">2. Póly a charakteristika</h3>
        <div className="flex flex-wrap gap-2">
          {PICKER_POLES.map((poles) => (
            <Tile key={poles} active={selection.poles === poles} onClick={() => toggle("poles", poles)}>
              {poles}
            </Tile>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          {PICKER_CURVES.map((curve) => (
            <Tile key={curve} active={selection.curve === curve} onClick={() => toggle("curve", curve)} label={`Charakteristika ${curve}`}>
              {curve}
            </Tile>
          ))}
        </div>
      </section>

      <section aria-label="3. Jmenovitý proud" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">3. Jmenovitý proud</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {PICKER_CURRENTS.map((current) => (
            <Tile key={current} active={selection.current === current} onClick={() => toggle("current", current)}>
              {current}A
            </Tile>
          ))}
        </div>
      </section>

      <section aria-label="Odpovídající kusy z katalogu" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Odpovídající kusy z katalogu</h3>
        {found || candidates.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border" data-testid="picker-candidates">
            {found ? (
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-primary/10 p-2 text-sm">
                <span className="font-semibold">{found.component.typeCode}</span>
                <span className="text-xs text-muted-foreground">
                  {found.component.manufacturer} · {CATEGORY_LABELS[found.component.category]} · {found.component.articleNumber}
                </span>
                <Badge variant="outline">{found.mode === "GEMINI" ? "Gemini AI" : found.mode === "CATALOG" ? "Z katalogu" : "Dohledáno (odhad Pv dle IEC)"}</Badge>
                <span className="ml-auto font-mono text-xs">{formatWatts(found.component.powerLossWatts)}</span>
                <Button size="sm" className="touch-target" onClick={() => assign(found.component.id)} disabled={pending} aria-label={`Přiřadit ${found.component.typeCode}`}>
                  {busy === found.component.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Přiřadit"}
                </Button>
              </li>
            ) : null}
            {candidates.map((component) => (
              <li key={component.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2 text-sm">
                <span className="font-semibold">{component.typeCode}</span>
                <span className="text-xs text-muted-foreground">
                  {component.manufacturer} · {CATEGORY_LABELS[component.category]} · {component.poles} · {component.modulesCount} M
                </span>
                <span className="ml-auto font-mono text-xs">{formatWatts(component.powerLossWatts)}</span>
                <Button size="sm" className="touch-target" onClick={() => assign(component.id)} disabled={pending} aria-label={`Přiřadit ${component.typeCode}`}>
                  {busy === component.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Přiřadit"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{selection.category ? "Výběru neodpovídá žádný kus – zkuste dohledat podle textu z čela přístroje." : "Ťukněte na kategorii přístroje."}</p>
        )}
      </section>

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          lookup();
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Text z čela přístroje
          <span className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="např. S201 B10" className="h-10 pl-9" aria-label="Text z čela přístroje" />
          </span>
        </label>
        <Button type="submit" variant="secondary" className="touch-target gap-2" disabled={pending}>
          {pending && !busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} Dohledat v datasheetech přes Gemini AI
        </Button>
      </form>
    </div>
  );
}
