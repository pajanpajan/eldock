"use client";

import { Eye, EyeOff, Lock, LockOpen, Magnet, Sparkles } from "lucide-react";

import { isBallastLayer } from "@/lib/panel-builder/dxf-import";
import type { CadUnderlay } from "@/lib/panel-builder/cad-underlay";
import { cn } from "@/lib/utils";

/**
 * Fáze 79: „🗂️ Vrstvy CAD výkresu (Hladiny)“ – hladiny nahraného DXF s barvou, počtem objektů, viditelností a zámkem,
 * vyčištění architektonického balastu jedním klikem, ztlumení do šedé s krytím 20–100 % a přichytávání k CAD.
 */
export function CadLayersPanel({ cad, onChange, onRemove }: { cad: CadUnderlay; onChange: (cad: CadUnderlay) => void; onRemove: () => void }) {
  const setLayer = (name: string, patch: Partial<CadUnderlay["layers"][number]>) => onChange({ ...cad, layers: cad.layers.map((layer) => (layer.name === name ? { ...layer, ...patch } : layer)) });
  const ballast = cad.layers.filter((layer) => isBallastLayer(layer.name) && layer.visible && !layer.locked);
  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="cad-layers">
      <p className="text-muted-foreground" data-testid="cad-units">
        {cad.fileName} · {(cad.widthMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} × {(cad.heightMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m · jednotky {cad.units}
        {cad.unitsSource === "header" ? " (z hlavičky $INSUNITS)" : " (odhad z rozměru – ověřte kótou)"} · měřítko 1 : 1
      </p>
      <button
        type="button"
        onClick={() => onChange({ ...cad, layers: cad.layers.map((layer) => (isBallastLayer(layer.name) && !layer.locked ? { ...layer, visible: false } : layer)) })}
        disabled={!ballast.length}
        className="flex items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 font-semibold text-amber-100 disabled:opacity-40"
        data-testid="cad-clean"
      >
        <Sparkles className="size-3.5" aria-hidden /> 🧹 Vyčistit architektonický balast{ballast.length ? ` (${ballast.length})` : ""}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={cad.monochrome} onChange={(event) => onChange({ ...cad, monochrome: event.target.checked })} data-testid="cad-monochrome" /> 🌑 Ztlumit podklad do šedé
        </label>
        <label className="flex flex-1 items-center gap-1.5">
          Krytí
          <input type="range" min={20} max={100} step={5} value={Math.round(cad.opacity * 100)} onChange={(event) => onChange({ ...cad, opacity: Number(event.target.value) / 100 })} aria-label="Krytí podkladu CAD" className="flex-1" data-testid="cad-opacity" />
          <span className="w-9 text-right font-mono tabular-nums">{Math.round(cad.opacity * 100)} %</span>
        </label>
      </div>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={cad.snap} onChange={(event) => onChange({ ...cad, snap: event.target.checked })} data-testid="cad-snap" />
        <Magnet className="size-3.5" aria-hidden /> Přichytávat k čarám a vrcholům CAD (místnosti, zásuvky, vypínače, čidla, žaluzie)
      </label>
      <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto" data-testid="cad-layer-list">
        {cad.layers.map((layer) => (
          <li key={layer.name} className={cn("flex items-center gap-1.5 rounded px-1 py-0.5", !layer.visible && "opacity-50")} data-layer={layer.name}>
            <span className="size-3 shrink-0 rounded-sm border border-border" style={{ background: layer.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={layer.name}>
              {layer.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{layer.entities}</span>
            <button type="button" role="checkbox" aria-checked={layer.visible} aria-label={`Viditelnost hladiny ${layer.name}`} onClick={() => setLayer(layer.name, { visible: !layer.visible })} className="rounded p-0.5 hover:bg-muted" data-testid="cad-layer-eye">
              {layer.visible ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
            </button>
            <button type="button" role="checkbox" aria-checked={layer.locked} aria-label={`Zámek hladiny ${layer.name}`} onClick={() => setLayer(layer.name, { locked: !layer.locked })} className="rounded p-0.5 hover:bg-muted" data-testid="cad-layer-lock">
              {layer.locked ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5 text-muted-foreground" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">🔒 Zamčená hladina zůstane, jak je – vyčištění balastu ji nepřepne a kurzor se k ní nepřichytává.</p>
      <button type="button" onClick={onRemove} className="self-start text-[11px] text-red-300 underline-offset-2 hover:underline" data-testid="cad-remove">
        🗑 Odebrat podklad CAD z podlaží
      </button>
    </div>
  );
}
