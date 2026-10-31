// Výstupy výpočtu oteplení bez stavu: teplotní křivka, fázová bilance a inženýrská tabulka.
// Používá je krok 3 (tmavé UI) i tisková dokumentace (`print` = černá na bílé).

import type { ReactNode } from "react";

import type { ThermalResult, ThermalRow } from "@/lib/thermalCalculation";
import { cn } from "@/lib/utils";

const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const dash = (value: number, digits = 2) => (value ? n(value, digits) : "0");

/** Teplota podle výšky skříně: profil, okolí, limit a body Δt0,5 / Δt1,0. */
export function ThermalCurve({ result, ambientTempC, print = false }: { result: ThermalResult; ambientTempC: number; print?: boolean }) {
  const W = 380;
  const H = 230;
  const pad = { left: 46, right: 16, top: 16, bottom: 40 };
  const minT = Math.floor(Math.min(ambientTempC, ...result.curve.map((p) => p.tempC)) / 5) * 5 - 5;
  const maxT = Math.ceil(Math.max(result.limitTempC, result.topTempC) / 5) * 5 + 5;
  const x = (t: number) => pad.left + ((t - minT) / (maxT - minT)) * (W - pad.left - pad.right);
  const y = (h: number) => H - pad.bottom - h * (H - pad.top - pad.bottom);
  const ink = print ? "#111" : "var(--color-foreground)";
  const muted = print ? "#555" : "var(--color-muted-foreground)";
  const grid = print ? "#ddd" : "color-mix(in oklab, var(--color-border) 70%, transparent)";
  const line = print ? "#b45309" : "var(--color-primary)";
  const critical = print ? "#b91c1c" : "#f87171";
  const ticks = Array.from({ length: Math.floor((maxT - minT) / 10) + 1 }, (_, i) => Math.ceil(minT / 10) * 10 + i * 10).filter((t) => t <= maxT);
  const points = result.curve.map((p) => `${x(p.tempC)},${y(p.height)}`).join(" ");
  const marks = [
    { h: 0.5, t: result.internalTempC, label: `0,5 h: ${n(result.internalTempC, 1)} °C` },
    { h: 1, t: result.topTempC, label: `1,0 h: ${n(result.topTempC, 1)} °C` },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Teplota podle výšky skříně: uprostřed ${n(result.internalTempC, 1)} °C, pod stropem ${n(result.topTempC, 1)} °C, limit ${result.limitTempC} °C`} data-testid="thermal-curve">
      {[0, 0.25, 0.5, 0.75, 1].map((h) => (
        <g key={h}>
          <line x1={pad.left} x2={W - pad.right} y1={y(h)} y2={y(h)} stroke={grid} strokeWidth={1} />
          <text x={pad.left - 6} y={y(h) + 3} fontSize={10} fill={muted} textAnchor="end">
            {h * 100} %
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - pad.bottom + 14} fontSize={10} fill={muted} textAnchor="middle">
          {t}
        </text>
      ))}
      <text x={(pad.left + W - pad.right) / 2} y={H - 6} fontSize={10} fill={muted} textAnchor="middle">
        Teplota [°C]
      </text>
      <text transform={`translate(11 ${(pad.top + H - pad.bottom) / 2}) rotate(-90)`} fontSize={10} fill={muted} textAnchor="middle">
        Výška skříně
      </text>
      {/* okolí a limit */}
      <line x1={x(ambientTempC)} x2={x(ambientTempC)} y1={pad.top} y2={y(0)} stroke={muted} strokeWidth={1} strokeDasharray="3 3" />
      <text x={x(ambientTempC) + 4} y={pad.top + 8} fontSize={10} fill={muted}>
        okolí {n(ambientTempC, 0)} °C
      </text>
      <line x1={x(result.limitTempC)} x2={x(result.limitTempC)} y1={pad.top} y2={y(0)} stroke={critical} strokeWidth={1.5} strokeDasharray="5 3" />
      <text x={x(result.limitTempC) - 4} y={pad.top + 8} fontSize={10} fill={ink} textAnchor="end">
        limit {result.limitTempC} °C
      </text>
      <polyline points={points} fill="none" stroke={line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {marks.map((mark) => (
        <g key={mark.h}>
          <circle cx={x(mark.t)} cy={y(mark.h)} r={5} fill={line} stroke={print ? "#fff" : "var(--color-card)"} strokeWidth={2}>
            <title>{`Výška ${mark.label}`}</title>
          </circle>
          <text x={x(mark.t) + 8} y={y(mark.h) + (mark.h === 1 ? 12 : -6)} fontSize={10} fill={ink}>
            {mark.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Zatížení fází L1 / L2 / L3 / N (Imax × SF) s nesymetrií. */
export function PhaseBalance({ result, print = false }: { result: ThermalResult; print?: boolean }) {
  const entries = [
    ["L1", result.phaseLoads.L1],
    ["L2", result.phaseLoads.L2],
    ["L3", result.phaseLoads.L3],
    ["N", result.phaseLoads.N],
  ] as const;
  const max = Math.max(1, ...entries.map(([, value]) => value)) * 1.1;
  return (
    <div className="flex flex-col gap-2" data-testid="phase-balance">
      {entries.map(([phase, value]) => (
        <div key={phase} className="flex items-center gap-3 text-sm">
          <span className="w-6 font-mono font-semibold">{phase}</span>
          <div className={cn("relative h-3 flex-1 rounded-sm", print ? "bg-zinc-200" : "bg-muted")}>
            <div className={cn("absolute inset-y-0 left-0 rounded-r", phase === "N" ? (print ? "bg-zinc-500" : "bg-zinc-400") : print ? "bg-amber-600" : "bg-primary")} style={{ width: `${(value / max) * 100}%` }} title={`${phase}: ${n(value)} A`} />
          </div>
          <span className="w-20 text-right font-mono">{n(value)} A</span>
        </div>
      ))}
      <p className={cn("text-xs", print ? "text-zinc-600" : "text-muted-foreground")}>Nesymetrie fází: {n(result.phaseImbalancePct, 0)} % · provozní proud {n(result.operatingCurrentA)} A</p>
    </div>
  );
}

/** Inženýrská tabulka (Přístroj, Typ, Popis, In, Pn, L1–N, Pv, Pv × SF², Imax × SF). */
export function ThermalTable({ result, print = false, renderIb }: { result: ThermalResult; print?: boolean; renderIb?: (row: ThermalRow) => ReactNode }) {
  const th = cn("text-right font-medium whitespace-nowrap", print ? "border border-zinc-400 px-0.5 py-1" : "border-b border-border px-2 py-1.5 text-muted-foreground");
  const td = cn("text-right font-mono whitespace-nowrap", print ? "border border-zinc-300 px-0.5 py-0.5" : "border-b border-border/60 px-2 py-1");
  return (
    <table className={cn("w-full border-collapse", print ? "text-[6.5pt]" : "text-xs")} data-testid="thermal-table">
      <thead>
        <tr>
          <th className={cn(th, "text-left")}>Přístroj</th>
          <th className={cn(th, "text-left")}>Typ</th>
          <th className={cn(th, "text-left")}>Popis</th>
          <th className={th}>In [A]</th>
          <th className={th}>Pn [W]</th>
          <th className={th}>{renderIb ? "Ib [A]" : "Int [A]"}</th>
          <th className={th}>L1</th>
          <th className={th}>L2</th>
          <th className={th}>L3</th>
          <th className={th}>N</th>
          <th className={th}>Pv [W]</th>
          <th className={th}>Pv × SF²</th>
          <th className={th}>Imax × SF</th>
        </tr>
      </thead>
      <tbody>
        <tr className="font-semibold">
          <td className={cn(td, "text-left font-sans")}>Vstup</td>
          <td className={td} colSpan={5} />
          <td className={td}>{n(result.incoming.L1)}</td>
          <td className={td}>{n(result.incoming.L2)}</td>
          <td className={td}>{n(result.incoming.L3)}</td>
          <td className={td}>{n(result.incoming.N)}</td>
          <td className={td} />
          <td className={td}>{n(result.deviceLossW)}</td>
          <td className={td}>{n(result.operatingCurrentA)}</td>
        </tr>
        {result.rows.map((row) => (
          <tr key={row.id} data-testid={`thermal-row-${row.designation}`}>
            <td className={cn(td, "text-left font-sans font-semibold")}>{row.designation}</td>
            <td className={cn(td, "text-left font-sans", print && "w-[24mm] whitespace-normal")}>{row.typeCode}</td>
            <td className={cn(td, "text-left font-sans", print ? "w-[34mm] whitespace-normal" : "max-w-48 truncate")} title={row.description}>
              {row.description}
            </td>
            <td className={td}>{dash(row.ratedCurrentA, 0)}</td>
            <td className={td}>{dash(row.ratedLossW)}</td>
            <td className={td}>{renderIb && row.leaf && row.ratedCurrentA > 0 && !row.constantLossW ? renderIb(row) : dash(row.operatingCurrentA)}</td>
            <td className={td}>{dash(row.L1)}</td>
            <td className={td}>{dash(row.L2)}</td>
            <td className={td}>{dash(row.L3)}</td>
            <td className={td}>{dash(row.N)}</td>
            <td className={td}>{dash(row.lossW + row.constantLossW)}</td>
            <td className={td}>{dash(row.reducedLossW + row.constantLossW)}</td>
            <td className={td}>{dash(row.imaxSf)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
