"use client";

import { Layers, TriangleAlert } from "lucide-react";

import { MAP_LAYERS, type LayerKey, type layerCounts } from "@/lib/map-layers";
import { INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";

interface Props {
  layers: ReadonlySet<LayerKey>;
  counts: ReturnType<typeof layerCounts>;
  attentionOnly: boolean;
  onToggleLayer: (key: LayerKey) => void;
  onToggleAttention: () => void;
}

/** Panel „Vrstvy zobrazení“: zaškrtávací skupiny zařízení s počty + rychlý přepínač ⚠️. */
export function MapLayersPanel({ layers, counts, attentionOnly, onToggleLayer, onToggleAttention }: Props) {
  const attentionTotal = Object.values(counts).reduce((sum, entry) => sum + entry.attention, 0);

  return (
    <section aria-labelledby="map-layers" className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="map-layers" className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="size-4 text-primary" aria-hidden />
          Vrstvy zobrazení <span className="font-normal text-muted-foreground">(zaškrtávací filtry)</span>
        </h2>
        <button
          type="button"
          aria-pressed={attentionOnly}
          onClick={onToggleAttention}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            attentionOnly
              ? "border-amber-400 bg-amber-500 text-amber-950"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
          )}
        >
          <TriangleAlert className="size-4" aria-hidden />
          Zobrazit vše s propadlou / končící revizí
          <span className="rounded-full bg-black/25 px-2 font-mono text-xs tabular-nums">{attentionTotal}</span>
        </button>
      </div>
      <fieldset className="mt-3 flex flex-wrap gap-2" disabled={attentionOnly}>
        <legend className="sr-only">Vrstvy</legend>
        {MAP_LAYERS.map((layer) => {
          const checked = attentionOnly || layers.has(layer.key);
          const count = counts[layer.key];
          return (
            <label
              key={layer.key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                checked ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                attentionOnly && "cursor-default opacity-70",
              )}
            >
              <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={() => onToggleLayer(layer.key)} />
              {layer.label}
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{count.total}</span>
              {count.attention ? (
                <span className={cn("rounded-full border px-1.5 font-mono text-xs tabular-nums", INSPECTION_STATE.EXPIRED.badge)} title="S propadlou nebo končící revizí">
                  {count.attention}
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
      {attentionOnly ? (
        <p className="mt-2 text-xs text-amber-300">Zobrazeny všechny vrstvy – jen zařízení s propadlou, končící nebo nevyhovující revizí.</p>
      ) : null}
    </section>
  );
}
