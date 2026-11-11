"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { calculateThermal } from "@/lib/thermalCalculation";
import { cn } from "@/lib/utils";

const INSTALL = [
  { value: "WALL_MOUNTED", label: "Na stěně" },
  { value: "FLUSH_MOUNTED", label: "Zapuštěná" },
  { value: "FREE_STANDING", label: "Volně stojící" },
] as const;

const PRESETS = [
  { label: "Rozvodnice 2 × 12 M", heightMm: 360, widthMm: 310, depthMm: 100 },
  { label: "Rozvodnice 4 × 18 M", heightMm: 650, widthMm: 435, depthMm: 120 },
  { label: "Skříň 1000 × 800 × 300", heightMm: 1000, widthMm: 800, depthMm: 300 },
] as const;

const cz = (value: number, digits = 1) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Fáze 96: interaktivní náhled výpočtu oteplení dle IEC TR 60890 (stejný výpočet jako kalkulačka AI Panel Builderu):
 * součet ztrátového výkonu Pv, efektivní chladicí plocha Ae, oteplení Δt0,5 (výška přístrojů) a Δt1,0 (pod stropem skříně).
 */
export function ThermalPreview() {
  const [lossW, setLossW] = useState(45);
  const [preset, setPreset] = useState(1);
  const [installation, setInstallation] = useState<(typeof INSTALL)[number]["value"]>("WALL_MOUNTED");
  const [ambientC, setAmbientC] = useState(30);
  const size = PRESETS[preset];
  const result = useMemo(
    () =>
      calculateThermal(
        [{ id: "pv", designation: "Σ", typeCode: "", description: "Ztrátový výkon přístrojů", category: null, poles: null, ratedCurrentA: 0, ratedLossW: lossW, operatingCurrentA: null, parentItemId: null, phaseAssignment: null }],
        { heightMm: size.heightMm, widthMm: size.widthMm, depthMm: size.depthMm, installation, ambientTempC: ambientC, simultaneityFactor: 1, internalWiringLossW: 0 },
      ),
    [lossW, size, installation, ambientC],
  );
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-5" aria-label="Interaktivní náhled výpočtu oteplení" data-testid="thermal-preview">
      <h3 className="text-lg font-semibold">Interaktivní náhled výpočtu (IEC TR 60890)</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Součet ztrátového výkonu přístrojů Pv: <b data-testid="thermal-loss">{lossW} W</b>
          </span>
          <input type="range" min={5} max={400} step={5} value={lossW} onChange={(event) => setLossW(Number(event.target.value))} aria-label="Ztrátový výkon Pv [W]" data-testid="thermal-loss-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Teplota okolí: <b>{ambientC} °C</b>
          <input type="range" min={20} max={45} step={1} value={ambientC} onChange={(event) => setAmbientC(Number(event.target.value))} aria-label="Teplota okolí [°C]" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Skříň
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rozměr skříně">
            {PRESETS.map((option, index) => (
              <button key={option.label} type="button" role="radio" aria-checked={preset === index} onClick={() => setPreset(index)} className={cn("rounded-full border px-3 py-1 text-xs", preset === index ? "border-primary bg-primary/15" : "border-border")}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Montáž
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Montáž skříně">
            {INSTALL.map((option) => (
              <button key={option.value} type="button" role="radio" aria-checked={installation === option.value} onClick={() => setInstallation(option.value)} className={cn("rounded-full border px-3 py-1 text-xs", installation === option.value ? "border-primary bg-primary/15" : "border-border")}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="thermal-result">
        {[
          ["Chladicí plocha Ae", `${cz(result.effectiveAreaM2, 2)} m²`],
          ["Δt0,5 (výška přístrojů)", `${cz(result.deltaT05)} K`],
          ["Δt1,0 (pod stropem)", `${cz(result.deltaT10)} K`],
          ["Teplota uvnitř / nahoře", `${cz(result.internalTempC)} / ${cz(result.topTempC)} °C`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className={cn("text-sm", result.ok ? "text-emerald-300" : "text-amber-200")} data-testid="thermal-verdict">
        {result.ok ? "✅" : "⚠️"} {result.verdict}
      </p>
      <Button asChild className="w-fit">
        <Link href="/panel-builder/auth">Spočítat oteplení vlastního rozváděče v Panel Builderu</Link>
      </Button>
    </section>
  );
}
