"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ENTRY_LABELS, MOUNTING_LABELS, type CncInput, type EntryDirection, type MountingType } from "@/lib/panel-builder/cnc-manufacturing-engine";
import { generateManufacturingPackage } from "@/lib/panel-builder/cnc-outputs";
import type { TurnkeyConfig } from "@/lib/panel-builder/turnkey-manufacturing";
import { cn } from "@/lib/utils";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const n1 = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** Náhled CNC vrtacího a frézovacího plánu 1 : 1 – montážní deska s lištami, žlaby, sběrnicemi, otvory a vývodkami. */
function CncDrawing({ pkg }: { pkg: ReturnType<typeof generateManufacturingPackage> }) {
  const { layout } = pkg;
  const W = layout.plate.widthMm;
  const H = layout.plate.heightMm;
  const faceGap = 60;
  const faceH = Math.min(layout.face.depthMm, 160);
  const totalH = faceH + faceGap + H + faceGap + faceH;
  const top = faceH + faceGap;
  return (
    <svg viewBox={`-40 -30 ${W + 80} ${totalH + 60}`} className="h-[60vh] w-full rounded-xl bg-white" role="img" aria-label="CNC vrtací a frézovací plán 1:1" data-testid="cnc-drawing">
      {/* Horní a dolní čelo s otvory vývodek */}
      {(["top", "bottom"] as const).map((side) => {
        const y0 = side === "top" ? 0 : top + H + faceGap;
        return (
          <g key={side} data-testid={`cnc-face-${side}`}>
            <rect x={0} y={y0} width={W} height={faceH} fill="#f8fafc" stroke="#334155" strokeWidth={1.5} />
            <text x={4} y={y0 - 6} fontSize={14} fill="#334155">
              {side === "top" ? "Horní čelo" : "Dolní čelo"}
              {layout.membrane ? " – membránová příruba (zapuštěná rozvodnice)" : ""}
            </text>
            {layout.membrane
              ? null
              : layout.glands
                  .filter((gland) => gland.side === side)
                  .map((gland) => (
                    <g key={gland.id} data-testid="cnc-gland" data-size={gland.size}>
                      <circle cx={Math.min(W - 10, gland.x)} cy={y0 + faceH / 2} r={gland.holeMm / 2} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1.2} />
                      <text x={Math.min(W - 10, gland.x)} y={y0 + faceH / 2 + gland.holeMm / 2 + 12} fontSize={9} textAnchor="middle" fill="#1e3a8a">
                        {gland.size}
                      </text>
                    </g>
                  ))}
          </g>
        );
      })}
      <g transform={`translate(0 ${top})`}>
        <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" stroke="#0f172a" strokeWidth={2} />
        <text x={4} y={-8} fontSize={14} fill="#0f172a">
          Montážní deska {n1(W)} × {n1(H)} mm (1 : 1)
        </text>
        {layout.ducts.map((duct, index) => (
          <rect key={`d${index}`} x={duct.x} y={duct.y} width={duct.w} height={duct.h} fill="#e2e8f0" stroke="#64748b" strokeDasharray="6 3" />
        ))}
        {layout.rails.map((rail) => (
          <g key={rail.index}>
            <rect x={rail.x1} y={rail.y - 17.5} width={rail.lengthMm} height={35} fill="#cbd5e1" stroke="#475569" />
            <text x={rail.x1 + 4} y={rail.y - 21} fontSize={10} fill="#334155">
              TS 35 – L{rail.index}: {rail.lengthMm} mm
            </text>
          </g>
        ))}
        {layout.devices.map((device) => (
          <g key={device.id}>
            <rect x={device.x} y={device.y} width={device.w} height={device.h} fill="#ffffff" stroke="#0f172a" strokeWidth={0.8} />
            <text x={device.x + device.w / 2} y={device.y + device.h / 2 + 4} fontSize={9} textAnchor="middle" fill="#0f172a">
              {device.designation}
            </text>
          </g>
        ))}
        {layout.bars.map((bar) => (
          <g key={bar.name}>
            <rect x={bar.x} y={bar.y - 6} width={bar.lengthMm} height={12} fill={bar.name === "PE" ? "#bbf7d0" : "#bfdbfe"} stroke="#334155" />
            <text x={bar.x + bar.lengthMm / 2} y={bar.y + 4} fontSize={9} textAnchor="middle">
              {bar.name}
            </text>
          </g>
        ))}
        {[...layout.rails.flatMap((rail) => rail.holes), ...layout.ducts.flatMap((duct) => duct.holes), ...layout.bars.flatMap((bar) => bar.holes)].map((hole, index) => (
          <g key={`h${index}`} data-testid="cnc-hole" data-thread={hole.thread}>
            <circle cx={hole.x} cy={hole.y} r={hole.diameterMm / 2 + 0.6} fill="#fee2e2" stroke="#dc2626" strokeWidth={1} />
            <title>{`${hole.thread} Ø ${n1(hole.diameterMm)} mm · X ${n1(hole.x)} / Y ${n1(H - hole.y)}`}</title>
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Fáze 106: „🛠️ CNC & Výroba na klíč“ – mechanické provedení skříně (přívod kabelů, montáž, prvky ve dveřích),
 * náhled CNC plánu 1 : 1, drátovací list vodičů (Odkud → Kam) a stažení DXF / CSV / XLSX.
 */
export function CncManufacturingPanel({ base, initial, onConfig, children }: { base: Omit<CncInput, "entry" | "mounting" | "door">; initial: TurnkeyConfig; onConfig?: (config: TurnkeyConfig) => void; children?: React.ReactNode }) {
  const [config, setConfig] = useState<TurnkeyConfig>(initial);
  const update = (patch: Partial<TurnkeyConfig>) => {
    const next = { ...config, ...patch, door: { ...config.door, ...(patch.door ?? {}) } };
    setConfig(next);
    onConfig?.(next);
  };
  const pkg = useMemo(() => generateManufacturingPackage({ ...base, ...config }), [base, config]);
  const [tab, setTab] = useState<"drawing" | "wires" | "cuts">("drawing");
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="CNC a výroba na klíč" data-testid="cnc-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">🛠️ CNC & Výroba na klíč – výrobní podklady</h2>
        <span className="text-xs text-muted-foreground" data-testid="cnc-summary">
          {pkg.summary.holes} vrtání · {pkg.summary.glands} vývodek · {pkg.summary.doorCutouts} výřezů ve dveřích · {pkg.summary.wires} vodičů ({n1(pkg.summary.wireMm / 1000)} m) · {pkg.summary.combs} hřebenů
        </span>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <fieldset className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <legend className="px-1 font-semibold">Přívod kabelů do skříně</legend>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(ENTRY_LABELS) as EntryDirection[]).map((entry) => (
              <button key={entry} type="button" aria-pressed={config.entry === entry} onClick={() => update({ entry })} className={cn("rounded-md border px-2 py-1", config.entry === entry ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid={`cnc-entry-${entry}`}>
                {ENTRY_LABELS[entry]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <legend className="px-1 font-semibold">Typ montáže</legend>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(MOUNTING_LABELS) as MountingType[]).map((mounting) => (
              <button key={mounting} type="button" aria-pressed={config.mounting === mounting} onClick={() => update({ mounting })} className={cn("rounded-md border px-2 py-1", config.mounting === mounting ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid={`cnc-mounting-${mounting}`}>
                {MOUNTING_LABELS[mounting]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1 rounded-lg border border-border p-2">
          <legend className="px-1 font-semibold">Prvky ve dveřích</legend>
          {(
            [
              ["centralStop", "Tlačítko CENTRAL STOP Ø 22,5 mm"],
              ["phaseLamps", "Kontrolky fází L1 / L2 / L3 Ø 22,5 mm"],
              ["meter", "Multimetr 92 × 92 mm"],
              ["ventilation", "Ventilátor s filtrem 120 × 120 mm"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input type="checkbox" checked={config.door[key]} onChange={(event) => update({ door: { ...config.door, [key]: event.target.checked } })} data-testid={`cnc-door-${key}`} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pkg.files.map((file) => (
          <Button key={file.name} type="button" size="sm" variant={file.name.endsWith(".dxf") ? "default" : "outline"} className="gap-1.5" onClick={() => download(file.name, file.content as BlobPart, file.mime)} data-testid={`cnc-download-${file.name.split(".").pop()}`}>
            {file.name.endsWith(".xlsx") ? <FileSpreadsheet className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />} {file.name}
          </Button>
        ))}
      </div>
      <div className="flex gap-1" role="tablist" aria-label="Výrobní podklady">
        {(
          [
            ["drawing", "CNC vrtací a frézovací plán 1:1"],
            ["wires", "Nářezový a drátovací list vodičů (Odkud ➔ Kam)"],
            ["cuts", "Nářezový list lišt, žlabů a hřebenů"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", tab === id ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:bg-muted")} data-testid={`cnc-tab-${id}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "drawing" ? <CncDrawing pkg={pkg} /> : null}
      {tab === "wires" ? (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs" data-testid="wire-table">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">Č.</th>
                <th className="px-2">Odkud (Přístroj : Svorka)</th>
                <th className="px-2">Kam (Přístroj : Svorka)</th>
                <th className="px-2">Typ a průřez</th>
                <th className="px-2">Barva</th>
                <th className="px-2 text-right">Délka [mm]</th>
                <th className="px-2">Konec A</th>
                <th className="px-2">Konec B</th>
              </tr>
            </thead>
            <tbody>
              {pkg.wires.map((row) => (
                <tr key={row.no} className={cn("border-t border-border", row.kind === "comb" && "bg-amber-500/10")} data-testid="wire-row" data-kind={row.kind}>
                  <td className="px-2 py-0.5 font-mono">{row.no}</td>
                  <td className="px-2 font-mono">{row.from}</td>
                  <td className="px-2 font-mono">{row.to}</td>
                  <td className="px-2">{row.comb ?? row.type}</td>
                  <td className="px-2">{row.color}</td>
                  <td className="px-2 text-right font-mono">{row.lengthMm}</td>
                  <td className={cn("px-2", row.endA.startsWith("Dvojitá") && "font-semibold text-amber-300")}>{row.endA}</td>
                  <td className={cn("px-2", row.endB.startsWith("Dvojitá") && "font-semibold text-amber-300")}>{row.endB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "cuts" ? (
        <table className="w-full text-xs" data-testid="cut-table">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1">Položka</th>
              <th className="text-right">Délka [mm]</th>
              <th className="text-right">Kusů</th>
            </tr>
          </thead>
          <tbody>
            {pkg.cuts.map((item) => (
              <tr key={`${item.item}-${item.lengthMm}`} className="border-t border-border">
                <td className="py-0.5">{item.item}</td>
                <td className="text-right font-mono">{item.lengthMm}</td>
                <td className="text-right font-mono">{item.pieces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {children}
    </section>
  );
}
