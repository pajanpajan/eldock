"use client";

import { useRef } from "react";

import { PLANE_MAX_MM, PLANE_MIN_MM, PLANE_PRESETS, meters, planePresetOf } from "@/lib/panel-builder/floorplan-plane";

/**
 * Fáze 83: plocha 2D půdorysu v horní liště – šířka X × hloubka Y v metrech (5–100 m, potvrzení Enter / opuštěním
 * pole), předvolby velikosti a „⛶ Přizpůsobit pohled“. U podlaží s podkladem je plocha podle podkladu (jen popisek).
 */
export function PlaneSizeControl({
  widthMm,
  heightMm,
  fromBackground,
  onResize,
  onFit,
}: {
  widthMm: number;
  heightMm: number;
  fromBackground: boolean;
  /** Vrací skutečnou plochu (rozsah 5–100 m, nikdy menší než nákres). */
  onResize: (widthMm: number, heightMm: number) => { widthMm: number; heightMm: number };
  onFit: () => void;
}) {
  const widthRef = useRef<HTMLInputElement>(null);
  const fit = (
    <button type="button" onClick={onFit} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-semibold text-foreground hover:border-primary/60" title="Vycentrovat celý půdorys do okna" aria-label="Přizpůsobit pohled – vycentrovat celý půdorys" data-testid="plane-fit">
      <span aria-hidden>⛶</span> Přizpůsobit pohled
    </button>
  );
  if (fromBackground) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span data-testid="floorplan-scale">
          Plocha {meters(widthMm)} × {meters(heightMm)} m
        </span>
        {fit}
      </span>
    );
  }
  // Potvrzení pole: neplatná hodnota se vrátí, ořezaná (mimo rozsah / pod nákres) se v poli opraví na skutečnou
  const commit = (axis: "w" | "h", input: HTMLInputElement) => {
    const current = axis === "w" ? widthMm : heightMm;
    const value = Number(input.value.replace(",", "."));
    const mm = Math.round(value * 1000);
    if (!Number.isFinite(value) || value <= 0 || mm === current) {
      input.value = String(current / 1000);
      return;
    }
    const size = onResize(axis === "w" ? mm : widthMm, axis === "h" ? mm : heightMm);
    input.value = String((axis === "w" ? size.widthMm : size.heightMm) / 1000);
  };
  const field = (axis: "w" | "h", label: string, value: number) => (
    <label className="flex items-center gap-1">
      {label}
      <input
        key={`${axis}-${value}`}
        ref={axis === "w" ? widthRef : undefined}
        type="number"
        inputMode="decimal"
        min={PLANE_MIN_MM / 1000}
        max={PLANE_MAX_MM / 1000}
        step={0.5}
        defaultValue={value / 1000}
        onBlur={(event) => commit(axis, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(axis, event.currentTarget);
        }}
        className="h-7 w-14 rounded-md border border-input bg-transparent px-1 text-center font-mono text-foreground tabular-nums dark:bg-input/30"
        aria-label={axis === "w" ? "Šířka plochy X [m]" : "Hloubka plochy Y [m]"}
        data-testid={axis === "w" ? "plane-width" : "plane-height"}
      />
      m
    </label>
  );
  const preset = planePresetOf(widthMm, heightMm);
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid="plane-size">
      <b className="text-foreground">Plocha:</b>
      {field("w", "Šířka X", widthMm)}
      <span aria-hidden>×</span>
      {field("h", "Hloubka Y", heightMm)}
      <select
        value={preset}
        onChange={(event) => {
          const next = PLANE_PRESETS.find((option) => option.id === event.target.value);
          if (next) onResize(next.widthMm, next.heightMm);
          else widthRef.current?.focus();
        }}
        className="h-7 rounded-md border border-input bg-transparent px-1 text-foreground dark:bg-input/30"
        aria-label="Předvolba velikosti plochy"
        data-testid="plane-preset"
      >
        {PLANE_PRESETS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        <option value="custom">Vlastní rozměr (až 100 × 100 m)</option>
      </select>
      {fit}
    </span>
  );
}
