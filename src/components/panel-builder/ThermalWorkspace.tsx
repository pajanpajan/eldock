"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, CircleAlert, Loader2, ThermometerSun, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";
import { ENCLOSURE_MATERIALS, ENCLOSURE_TYPES } from "@/lib/panel-builder/project";
import { thermalDevices, thermalEnclosure, type ThermalItemInput, type ThermalProjectInput } from "@/lib/panel-builder/thermal-input";
import { calculateThermal } from "@/lib/thermalCalculation";
import { cn } from "@/lib/utils";
import { saveThermalInputsAction } from "@/server/actions/panel-builder";

import { PhaseBalance, ThermalCurve, ThermalTable } from "./ThermalViews";

const selectClass = "h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function NumberField({ id, label, value, onChange, step = 1, min, max, unit }: { id: string; label: string; value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number; unit?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
        {unit ? ` [${unit}]` : ""}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => {
          const next = Number(event.target.value.replace(",", "."));
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-10 font-mono"
      />
    </div>
  );
}

/** Krok 3: vstupy skříně (živý přepočet), verdikt, teplotní křivka, fázová bilance a tabulka. */
export function ThermalWorkspace({ projectId, initialProject, items }: { projectId: string; initialProject: ThermalProjectInput; items: ThermalItemInput[] }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [currents, setCurrents] = useState<Record<string, number | null>>(() => Object.fromEntries(items.map((item) => [item.id, item.operatingCurrentA])));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const dirty = useRef(false);

  const result = useMemo(
    () => calculateThermal(thermalDevices(items.map((item) => ({ ...item, operatingCurrentA: currents[item.id] ?? null }))), thermalEnclosure(project)),
    [items, currents, project],
  );

  const patch = (change: Partial<ThermalProjectInput>) => {
    dirty.current = true;
    setProject((current) => ({ ...current, ...change }));
  };

  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      dirty.current = false;
      const saved = await saveThermalInputsAction({
        projectId,
        ...project,
        heightMm: Math.round(project.heightMm),
        widthMm: Math.round(project.widthMm),
        depthMm: Math.round(project.depthMm),
        operatingCurrents: Object.entries(currents).map(([itemId, value]) => ({ itemId, value: value && value > 0 ? value : null })),
      });
      if (!saved.ok) {
        setSaveState("error");
        toast.error(saved.error);
        return;
      }
      setSaveState("saved");
      router.refresh();
    }, 600);
    return () => clearTimeout(timer);
  }, [project, currents, projectId, router]);

  const kpis = [
    { label: "Ztrátový výkon celkem", value: `${n(result.totalLossW)} W`, hint: `přístroje ${n(result.deviceLossW)} W + vodiče ${n(result.wiringLossW)} W` },
    { label: "Účinná chladicí plocha Ae", value: `${n(result.effectiveAreaM2, 3)} m²`, hint: `k = ${n(result.k, 3)} · c = ${n(result.c)}` },
    { label: "Oteplení Δt0,5 / Δt1,0", value: `${n(result.deltaT05, 1)} / ${n(result.deltaT10, 1)} K`, hint: `výpočet při ${n(result.internalTempC, 2)} °C, derating ${n(result.derating, 3)}` },
    { label: "Vnitřní teplota", value: `${n(result.internalTempC, 1)} °C`, hint: `${n(project.ambientTempC, 0)} + ${n(result.deltaT05, 1)} °C · pod stropem ${n(result.topTempC, 1)} °C` },
    { label: "Provozní proud", value: `${n(result.operatingCurrentA)} A`, hint: `soudobost SF ${n(project.simultaneityFactor)}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn("flex items-start gap-3 rounded-xl border p-4", result.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/60 bg-red-500/10")}
        role="status"
        data-testid="thermal-verdict"
      >
        {result.ok ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-400" aria-hidden /> : <XCircle className="mt-0.5 size-6 shrink-0 text-red-400" aria-hidden />}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{result.verdict}</p>
          {result.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-1.5 text-sm text-yellow-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {warning}
            </p>
          ))}
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground" data-testid="thermal-save-state">
          {saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : saveState === "saved" ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : <CircleAlert className="size-3.5 text-red-400" aria-hidden />}
          {saveState === "saving" ? "Ukládám…" : saveState === "saved" ? "Uloženo" : "Neuloženo"}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold">{kpi.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{kpi.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <section aria-label="Vstupní parametry skříně" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ThermometerSun className="size-4 text-primary" aria-hidden /> Vstupní parametry skříně
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="th-h" label="Výška" unit="mm" value={project.heightMm} onChange={(heightMm) => patch({ heightMm })} min={100} />
            <NumberField id="th-w" label="Šířka" unit="mm" value={project.widthMm} onChange={(widthMm) => patch({ widthMm })} min={100} />
            <NumberField id="th-d" label="Hloubka" unit="mm" value={project.depthMm} onChange={(depthMm) => patch({ depthMm })} min={50} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="th-install" className="text-xs text-muted-foreground">
                Způsob instalace
              </Label>
              <select id="th-install" className={selectClass} value={project.enclosureType} onChange={(event) => patch({ enclosureType: event.target.value as EnclosureType })}>
                {Object.entries(ENCLOSURE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="th-material" className="text-xs text-muted-foreground">
                Materiál
              </Label>
              <select id="th-material" className={selectClass} value={project.enclosureMaterial} onChange={(event) => patch({ enclosureMaterial: event.target.value as EnclosureMaterial })}>
                {Object.entries(ENCLOSURE_MATERIALS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="th-ip" className="text-xs text-muted-foreground">
                Krytí
              </Label>
              <Input id="th-ip" value={project.ipRating} maxLength={12} onChange={(event) => patch({ ipRating: event.target.value })} className="h-10" />
            </div>
            <NumberField id="th-ambient" label="Teplota okolí" unit="°C" value={project.ambientTempC} onChange={(ambientTempC) => patch({ ambientTempC })} />
            <NumberField id="th-sf" label="Koeficient soudobosti SF" value={project.simultaneityFactor} onChange={(simultaneityFactor) => patch({ simultaneityFactor })} step={0.05} min={0.05} max={1} />
            <NumberField id="th-wiring" label="Ztráty vnitřních vodičů" unit="W" value={project.internalWiringLossW} onChange={(internalWiringLossW) => patch({ internalWiringLossW })} step={0.1} min={0} />
          </div>
          <table className="mt-1 w-full text-xs">
            <caption className="mb-1 text-left text-muted-foreground">Chladicí plochy (IEC TR 60890)</caption>
            <tbody>
              {result.surfaces.map((surface) => (
                <tr key={surface.name} className="border-b border-border/60">
                  <td className="py-1">{surface.name}</td>
                  <td className="py-1 text-right font-mono">{n(surface.areaM2, 4)} m²</td>
                  <td className="py-1 text-right font-mono">× b {n(surface.factor, 1)}</td>
                  <td className="py-1 text-right font-mono">{n(surface.areaM2 * surface.factor, 4)} m²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-label="Teplotní křivka podle výšky rozváděče" className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Teplota podle výšky rozváděče</h2>
          <ThermalCurve result={result} ambientTempC={project.ambientTempC} />
        </section>

        <section aria-label="Fázová bilance" className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Fázová bilance (Imax × SF)</h2>
          <PhaseBalance result={result} />
        </section>
      </div>

      <section aria-label="Tabulka oteplení" className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 font-semibold">Výpočet oteplení po přístrojích</h2>
        <p className="mb-3 text-xs text-muted-foreground">Ib = výpočtový proud koncového vývodu; prázdné = In snížené na vnitřní teplotu. Pv = Pn · (I / In)², u chráničů po pólech.</p>
        <ThermalTable
          result={result}
          renderIb={(row) => (
            <input
              aria-label={`${row.designation} výpočtový proud Ib`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder={n(row.operatingCurrentA)}
              value={currents[row.id] ?? ""}
              onChange={(event) => {
                const value = event.target.value === "" ? null : Number(event.target.value.replace(",", "."));
                dirty.current = true;
                setCurrents((current) => ({ ...current, [row.id]: value !== null && Number.isFinite(value) ? value : null }));
              }}
              className="h-7 w-20 rounded border border-input bg-transparent px-1 text-right font-mono dark:bg-input/30"
            />
          )}
        />
      </section>
    </div>
  );
}
