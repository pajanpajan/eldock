"use client";

import { useState, useTransition } from "react";
import { Check, Link2, Loader2, Scissors, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PICKER_MANUFACTURERS, formatWatts, isMix } from "@/lib/panel-builder/catalog";
import { CONFIG_CATEGORIES, CONFIG_FIELDS, defaultConfig, isOptionActive, type ConfigCategory, type ItemConfig } from "@/lib/panel-builder/configurator";
import { sameManufacturer } from "@/lib/panel-builder/matching";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { assignComponentAction, configureItemAction, deleteItemAction, lookupComponentAction, mergeItemsAction, splitItemAction, updateItemTextAction } from "@/server/actions/panel-builder";

import type { WorkspaceItem } from "./RecognitionWorkspace";

function Tile({ active, onClick, children, label, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "touch-target min-h-11 rounded-lg border-2 px-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Živý konfigurátor vybraného modulu: každý klik (výrobce, kategorie, parametr) modul rovnou uloží,
 * přiřadí nejbližší přesný kus z katalogu a označí ho jako ověřený. Nahoře geometrie na DIN liště
 * (sloučení / rozdělení), dole karta přiřazeného přístroje.
 */
export function ItemConfigurator({ item, dominant, rightNeighbors, onChanged, onDeleted }: { item: WorkspaceItem; dominant: string; rightNeighbors: number; onChanged: () => void; onDeleted: () => void }) {
  const initialManufacturer = item.config?.manufacturer ?? item.component?.manufacturer ?? item.detected?.manufacturer ?? (isMix(dominant) ? null : dominant);
  const [config, setConfig] = useState<ItemConfig | null>(item.config);
  const [manufacturer, setManufacturer] = useState<string | null>(initialManufacturer);
  const [mergeRight, setMergeRight] = useState(true);
  const [pending, startTransition] = useTransition();
  const [lookupText, setLookupText] = useState(item.rawOcrText?.replace(/[?б]/g, "") ?? "");

  function apply(next: ItemConfig) {
    setConfig(next);
    const absorb = mergeRight && next.modules > item.modulesWidth;
    if (next.modules > item.modulesWidth && !mergeRight) toast.warning(`Přístroj má ${next.modules}M, ale modul na liště jen ${item.modulesWidth}M – zapněte „Sloučit se sousedními moduly vpravo“.`);
    startTransition(async () => {
      const result = await configureItemAction(item.id, next, absorb);
      if (!result.ok) return void toast.error(result.error);
      onChanged();
    });
  }

  function pickManufacturer(value: string | null) {
    setManufacturer(value);
    if (config) apply({ ...config, manufacturer: value });
  }

  function pickCategory(category: ConfigCategory) {
    const base = { manufacturer, modules: item.modulesWidth, ratedCurrentA: item.detected?.ratedCurrentA ?? config?.ratedCurrentA ?? null, curve: item.detected?.trippingCurve ?? config?.curve ?? null };
    apply(config?.category === category ? config : defaultConfig(category, base));
  }

  function geometry(run: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      onChanged();
    });
  }

  function lookup() {
    startTransition(async () => {
      const found = await lookupComponentAction({
        itemId: item.id,
        text: lookupText,
        hints: { category: config?.category === "OTHER" ? null : (config?.category ?? null), poles: config?.poles ?? null, current: config?.ratedCurrentA ?? null, curve: config?.curve ?? null, manufacturer },
      });
      if (!found.ok) return void toast.error(found.error);
      if (!found.data.component) return void toast.error("Přístroj se podle textu nepodařilo dohledat. Zkuste delší úsek typového označení.");
      const assigned = await assignComponentAction(item.id, found.data.component.id);
      if (!assigned.ok) return void toast.error(assigned.error);
      toast.success(`Přiřazeno: ${found.data.component.manufacturer} ${found.data.component.typeCode}${found.data.mode === "GEMINI" ? " (Gemini AI)" : ""}`);
      onChanged();
    });
  }

  function saveText(patch: { customTypeCode?: string | null; circuitLabel?: string }) {
    const next = { customTypeCode: patch.customTypeCode !== undefined ? patch.customTypeCode : item.customTypeCode, circuitLabel: patch.circuitLabel ?? item.circuitLabel };
    if (next.customTypeCode === item.customTypeCode && next.circuitLabel === item.circuitLabel) return;
    startTransition(async () => {
      const result = await updateItemTextAction(item.id, next);
      if (!result.ok) return void toast.error(result.error);
      onChanged();
    });
  }

  const suggested = item.recognitionStatus === "PARTIAL" ? item.component : null;
  const fields = config ? CONFIG_FIELDS[config.category] : [];

  return (
    <div className="flex flex-col gap-4" data-testid="item-configurator">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-semibold">{item.designation}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs", RECOGNITION[item.recognitionStatus].badge)} data-testid="configurator-status">
          {RECOGNITION[item.recognitionStatus].label}
        </span>
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ukládám" /> : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          OCR: {item.rawOcrText || "–"} · jistota {Math.round(item.confidence * 100)} %
        </span>
        <Button
          size="sm"
          variant="outline"
          className="touch-target gap-1.5 border-red-500/50 text-red-300 hover:bg-red-500/15"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Smazat prvek ${item.designation}? Ostatní prvky se přečíslují.`)) return;
            startTransition(async () => {
              const result = await deleteItemAction(item.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success(`${item.designation} smazán.`);
              onDeleted();
            });
          }}
        >
          <Trash2 className="size-3.5" aria-hidden /> Smazat prvek
        </Button>
      </div>

      {/* Geometrie na DIN liště */}
      <section aria-label="Geometrie na DIN liště" className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold uppercase">Geometrie na DIN liště</span>
          <span>
            lišta {item.dinRailIndex}, pozice {item.positionOnRail} · šířka <b className="text-foreground">{item.modulesWidth}M</b>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 1} onClick={() => geometry(() => mergeItemsAction(item.id, 2), "Sloučeno: 2 sousední moduly.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 2 sousední (2M)
          </Button>
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 2} onClick={() => geometry(() => mergeItemsAction(item.id, 3), "Sloučeno: 3× 1M → 3P.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 3× 1M → 3P (3 moduly)
          </Button>
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 3} onClick={() => geometry(() => mergeItemsAction(item.id, 4), "Sloučeno: 4 sousední moduly.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 4 sousední (4M)
          </Button>
          {item.config?.poles === "2x1P" ? (
            <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => geometry(() => splitItemAction(item.id), "Rozděleno na 2 obvodové větve.")}>
              <Scissors className="size-3.5" aria-hidden /> Rozdělit na 2 obvodové větve (2×1P)
            </Button>
          ) : item.modulesWidth >= 2 ? (
            <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => geometry(() => splitItemAction(item.id), "Rozděleno na 1M moduly.")}>
              <Scissors className="size-3.5" aria-hidden /> Rozdělit na 1M moduly
            </Button>
          ) : null}
        </div>
      </section>

      {suggested ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
          <span>
            Návrh AI: <b>{suggested.manufacturer} {suggested.typeCode}</b>
          </span>
          <Button
            className="touch-target ml-auto gap-2"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await assignComponentAction(item.id, suggested.id);
                if (!result.ok) return void toast.error(result.error);
                onChanged();
              })
            }
          >
            <Check className="size-4" aria-hidden /> Potvrdit návrh
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" role="group" aria-label="Výrobce přístroje">
        <span className="mr-1">Výrobce:</span>
        {PICKER_MANUFACTURERS.map((option) => {
          const active = option.value === null ? manufacturer === null : sameManufacturer(manufacturer, option.value);
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => pickManufacturer(option.value)}
              className={cn("min-h-8 rounded-md border px-2 font-semibold tracking-wide", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:text-foreground")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <section aria-label="1. Kategorie" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">1. Kategorie</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONFIG_CATEGORIES.map((category) => (
            <Tile key={category.value} active={config?.category === category.value} onClick={() => pickCategory(category.value)}>
              {category.label}
            </Tile>
          ))}
        </div>
      </section>

      {fields.map((field, index) => (
        <section key={field.key} aria-label={field.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">
            {index + 2}. {field.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <Tile key={option.value} active={!!config && isOptionActive(config, option)} onClick={() => config && apply({ ...config, ...option.patch })}>
                {option.label}
              </Tile>
            ))}
          </div>
          {field.key === "poles" || field.key === "contacts" ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={mergeRight} onChange={(event) => setMergeRight(event.target.checked)} />
              Sloučit se sousedními moduly vpravo (širší přístroj pohltí moduly, které AI rozsekala)
            </label>
          ) : null}
        </section>
      ))}

      {/* Přiřazený přístroj */}
      <section aria-label="Přiřazený přístroj" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" data-testid="assigned-device">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Přiřazený přístroj</h3>
        {item.component ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <b>
              {item.component.manufacturer} {item.customTypeCode || item.component.typeCode}
            </b>
            <span className="font-mono text-xs text-muted-foreground">({item.component.articleNumber})</span>
            <span className="text-muted-foreground">· Šířka: {item.modulesWidth}M · Ztrátový výkon: {formatWatts(item.component.powerLossWatts)}</span>
            {item.component.estimated ? <Badge variant="outline">odhad IEC</Badge> : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Zatím nepřiřazeno – ťukněte na kategorii a parametry.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Typové označení (ručně)
            <Input
              key={`type:${item.id}:${item.customTypeCode ?? ""}`}
              defaultValue={item.customTypeCode ?? ""}
              placeholder={item.component?.typeCode ?? "např. S201-B16"}
              maxLength={80}
              className="h-10"
              aria-label="Typové označení"
              onBlur={(event) => saveText({ customTypeCode: event.target.value.trim() || null })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Popis obvodu
            <Input
              key={`label:${item.id}:${item.circuitLabel}`}
              defaultValue={item.circuitLabel}
              placeholder="např. Zásuvky kuchyně"
              maxLength={80}
              className="h-10"
              aria-label="Popis obvodu"
              onBlur={(event) => saveText({ circuitLabel: event.target.value })}
            />
          </label>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            lookup();
          }}
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Exotický prvek – text z čela přístroje
            <Input value={lookupText} onChange={(event) => setLookupText(event.target.value)} placeholder="např. Hager MBN116" className="h-10" aria-label="Text z čela přístroje" />
          </label>
          <Button type="submit" variant="secondary" className="touch-target gap-2" disabled={pending}>
            <Sparkles className="size-4" aria-hidden /> Dohledat přes Gemini AI
          </Button>
        </form>
      </section>
    </div>
  );
}
