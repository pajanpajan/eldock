"use client";

import { useDeferredValue, useMemo } from "react";
import { X } from "lucide-react";

import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { variantDraft, variantList, variantMetrics, type VariantMetrics } from "@/lib/panel-builder/installation-mode-converter";
import { cn } from "@/lib/utils";

// Fáze 109: přepínač uložených variant téže zakázky nad plátnem 2D půdorysu (Klasická 230 V ⇄ Smart Home) s ukazatelem
// rozdílu metráže kabelů a ceny práce (normohodiny × sazba z generátoru nabídky, bez materiálu).

const czk = (value: number) => `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
const signed = (value: number, unit: string) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(Math.round(value)).toLocaleString("cs-CZ")} ${unit}`;

function safeMetrics(draft: FloorplanDraft | null): VariantMetrics | null {
  if (!draft) return null;
  try {
    return variantMetrics(draft);
  } catch {
    return null;
  }
}

export function ProjectVariantBar({ draft, onSwitch, onRemove }: { draft: FloorplanDraft; onSwitch: (variantId: string) => void; onRemove: (variantId: string) => void }) {
  const deferred = useDeferredValue(draft);
  const variants = variantList(deferred);
  const active = variants.find((variant) => variant.active) ?? null;
  const other = variants.find((variant) => !variant.active) ?? null;
  // Srovnání (2× výpočet tras a kusovníku) jen při změně nákresu – odložená hodnota nebrzdí kreslení
  const metrics = useMemo(() => {
    if (!deferred.activeVariant) return null;
    const otherVariant = variantList(deferred).find((variant) => !variant.active);
    if (!otherVariant) return null;
    return { active: safeMetrics(deferred), other: safeMetrics(variantDraft(deferred, otherVariant.id)) };
  }, [deferred]);
  if (!draft.activeVariant || variants.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/50 bg-primary/5 px-3 py-2 text-xs" role="group" aria-label="Varianta návrhu" data-testid="project-variants" data-active={active?.id}>
      <span className="font-semibold text-foreground">Varianta návrhu:</span>
      {variants.map((variant, index) => (
        <span key={variant.id} className="flex items-center gap-1">
          {index ? <span aria-hidden className="text-muted-foreground">⇄</span> : null}
          <button
            type="button"
            onClick={() => !variant.active && onSwitch(variant.id)}
            aria-pressed={variant.active}
            className={cn("rounded-md border px-2 py-1 font-semibold", variant.active ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50")}
            data-testid={`project-variant-${variant.id}`}
          >
            [ {variant.label} ]
          </button>
          {!variant.active ? (
            <button
              type="button"
              onClick={() => window.confirm(`Odebrat uloženou variantu „${variant.label}“? Aktivní návrh zůstane.`) && onRemove(variant.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-red-300"
              aria-label={`Odebrat variantu ${variant.label}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      {metrics?.active && metrics.other && other ? (
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground" data-testid="project-variant-diff">
          <span>
            Kabely: <b className="text-foreground">{metrics.active.cableM} m</b> ({signed(metrics.active.cableM - metrics.other.cableM, "m")} proti variantě {other.id.slice(1)})
          </span>
          <span title="Montáž, zapojení a revize podle normohodin × 650 Kč/h (generátor cenové nabídky) – bez materiálu; materiál ocení cenová nabídka.">
            Práce a revize: <b className="text-foreground">{czk(metrics.active.laborCzk)}</b> ({signed(metrics.active.laborCzk - metrics.other.laborCzk, "Kč")})
          </span>
        </span>
      ) : null}
    </div>
  );
}
