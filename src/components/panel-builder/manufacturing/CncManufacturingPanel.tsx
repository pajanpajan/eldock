"use client";

import { toast } from "sonner";
import { reportActionError } from "@/components/credits/paywall";
import { TRIAL_WATERMARK } from "@/lib/credits/pricing";
import { unlockOutputAction } from "@/server/actions/credits";

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

type CncSheet = "all" | "plate" | "faces" | "door";

/** Fáze 115: listy CNC výkresu. */
const CNC_SHEETS: [CncSheet, string][] = [
  ["all", "📐 Kompletní sestava"],
  ["plate", "🔩 Montážní deska (Vrtání & Lišty)"],
  ["faces", "🕳️ Kabelová čela (Vývodky M16–M40)"],
  ["door", "🚪 Dveře skříně"],
];
const ZOOM_STEP = 1.25;

type CncLayoutView = ReturnType<typeof generateManufacturingPackage>["layout"];

/** Kóta: vodorovná / svislá čára s šipkami a textem v mm. */
function Dimension({ x1, y1, x2, y2, text, side = 1, t }: { x1: number; y1: number; x2: number; y2: number; text: string; side?: 1 | -1; t: number }) {
  const horizontal = Math.abs(y2 - y1) < 0.01;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g data-testid="cnc-dimension" stroke="#0369a1" fill="#0369a1">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} markerStart="url(#cnc-arrow)" markerEnd="url(#cnc-arrow)" />
      <text x={horizontal ? mx : mx - side * 8 * t} y={horizontal ? my - side * 5 * t : my} fontSize={12 * t} textAnchor="middle" stroke="none" transform={horizontal ? undefined : `rotate(-90 ${mx - side * 8 * t} ${my})`}>
        {text}
      </text>
    </g>
  );
}

/** Montážní deska v souřadnicích (0, 0) = levý horní roh desky [mm]. */
function PlateSheet({ layout, t }: { layout: CncLayoutView; t: number }) {
  const W = layout.plate.widthMm;
  const H = layout.plate.heightMm;
  const holes = [...layout.rails.flatMap((rail) => rail.holes), ...layout.ducts.flatMap((duct) => duct.holes), ...layout.bars.flatMap((bar) => bar.holes)];
  return (
    <g data-testid="cnc-plate">
      <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" stroke="#0f172a" strokeWidth={2} />
      <text x={4} y={-34 * t} fontSize={16 * t} fontWeight={700} fill="#0f172a">
        Montážní deska {n1(W)} × {n1(H)} mm (1 : 1){layout.fields === 2 ? " – 2 pole vedle sebe" : ""}
      </text>
      <Dimension x1={0} y1={-14 * t} x2={W} y2={-14 * t} text={`${n1(W)} mm`} t={t} />
      <Dimension x1={-16 * t} y1={0} x2={-16 * t} y2={H} text={`${n1(H)} mm`} side={1} t={t} />
      {layout.ducts.map((duct, index) => (
        <rect key={`d${index}`} x={duct.x} y={duct.y} width={duct.w} height={duct.h} fill="#e2e8f0" stroke="#64748b" strokeDasharray="6 3" />
      ))}
      {layout.fields === 2
        ? layout.columns.map((column) => (
            <text key={column.label} x={column.x1} y={14 * t} fontSize={12 * t} fontWeight={700} fill="#7c2d12" data-testid="cnc-column">
              {column.label}
            </text>
          ))
        : null}
      {layout.rails.map((rail) => (
        <g key={rail.index} data-testid="cnc-rail" data-rail={rail.index} data-field={rail.field}>
          <rect x={rail.x1} y={rail.y - 17.5} width={rail.lengthMm} height={35} fill="#cbd5e1" stroke="#475569" />
        </g>
      ))}
      {layout.devices.map((device) => (
        <g key={device.id} data-testid="cnc-device" data-x2={n1(device.x + device.w)}>
          <rect x={device.x} y={device.y} width={device.w} height={device.h} fill="#ffffff" stroke="#0f172a" strokeWidth={0.8} />
          <text x={device.x + device.w / 2} y={device.y + device.h / 2} fontSize={Math.min(11 * t, device.w / 2.4)} fontWeight={700} textAnchor="middle" fill="#0f172a" transform={device.w < 30 ? `rotate(-90 ${device.x + device.w / 2} ${device.y + device.h / 2})` : undefined} dominantBaseline="middle">
            {device.designation}
          </text>
        </g>
      ))}
      {/* Popisky lišt nad přístroji (v mezeře u žlabu), aby je přístroje nezakryly */}
      {layout.rails.map((rail) => (
        <text key={`label-${rail.index}`} x={rail.x1 + 2} y={rail.y - 45 - 3} fontSize={Math.min(9 * t, 12)} fontWeight={600} fill="#334155" data-testid="cnc-rail-label">
          TS 35 – L{rail.index}: {rail.lengthMm} mm ({rail.modules} M) · osa Y = {n1(H - rail.y)} mm
        </text>
      ))}
      {layout.bars.map((bar) => (
        <g key={bar.name}>
          <rect x={bar.x} y={bar.y - 6} width={bar.lengthMm} height={12} fill={bar.name === "PE" ? "#bbf7d0" : "#bfdbfe"} stroke="#334155" />
          <text x={bar.x + bar.lengthMm / 2} y={bar.y + 3} fontSize={Math.min(9 * t, 10)} fontWeight={700} textAnchor="middle">
            {bar.name}
          </text>
        </g>
      ))}
      {holes.map((hole, index) => (
        <g key={`h${index}`} data-testid="cnc-hole" data-thread={hole.thread}>
          <circle cx={hole.x} cy={hole.y} r={hole.diameterMm / 2 + 0.6} fill="#fee2e2" stroke="#dc2626" strokeWidth={1} />
          <line x1={hole.x - 5} y1={hole.y} x2={hole.x + 5} y2={hole.y} stroke="#dc2626" strokeWidth={1} />
          <line x1={hole.x} y1={hole.y - 5} x2={hole.x} y2={hole.y + 5} stroke="#dc2626" strokeWidth={1} />
          <title>{`${hole.thread} Ø ${n1(hole.diameterMm)} mm · X ${n1(hole.x)} / Y ${n1(H - hole.y)}`}</title>
        </g>
      ))}
      <text x={4} y={H + 22 * t} fontSize={10 * t} fill="#7f1d1d" data-testid="cnc-hole-legend">
        ⊕ Ø 4,2 mm – závit M5 (DIN lišty, žlaby) · ⊕ Ø 5,0 mm – závit M6 (sběrnice PE / N) · souřadnice od levého dolního rohu desky
      </text>
    </g>
  );
}

/** Horní a dolní čelo s vývodkami ve 2 šachovnicových řadách (popisky horní řady nad otvorem, dolní pod ním). */
function FacesSheet({ layout, t, sides = ["top", "bottom"] }: { layout: CncLayoutView; t: number; sides?: readonly ("top" | "bottom")[] }) {
  const W = layout.face.widthMm;
  const D = layout.face.depthMm;
  const gap = 90;
  return (
    <g data-testid="cnc-faces">
      {sides.map((side, index) => {
        const y0 = index * (D + gap);
        const glands = layout.glands.filter((gland) => gland.side === side);
        const twoRows = glands.some((gland) => gland.row === 1);
        return (
          <g key={side} data-testid={`cnc-face-${side}`}>
            <rect x={0} y={y0} width={W} height={D} fill="#f8fafc" stroke="#334155" strokeWidth={1.5} />
            <text x={4} y={y0 - 10 * t} fontSize={13 * t} fontWeight={700} fill="#334155">
              {side === "top" ? "Horní čelo" : "Dolní čelo"} {n1(W)} × {n1(D)} mm{layout.membrane ? " – membránová příruba (zapuštěná rozvodnice)" : ` – ${glands.length} vývodek${twoRows ? " ve 2 řadách" : ""}`}
            </text>
            {layout.membrane
              ? null
              : glands.map((gland) => (
                  <g key={gland.id} data-testid="cnc-gland" data-size={gland.size} data-row={gland.row} data-x={gland.x} data-y={gland.y}>
                    <circle cx={gland.x} cy={y0 + gland.y} r={gland.holeMm / 2} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1.2} />
                    <text x={gland.x} y={twoRows && gland.row === 0 ? y0 + gland.y - gland.holeMm / 2 - 4 : y0 + gland.y + gland.holeMm / 2 + 12} fontSize={Math.min(9 * t, 11)} fontWeight={700} textAnchor="middle" fill="#1e3a8a">
                      {gland.size}
                    </text>
                    <title>{`${gland.id} ${gland.size} Ø ${n1(gland.holeMm)} mm – ${gland.label} (${gland.cable}) · X ${n1(gland.x)} / Y ${n1(gland.y)}`}</title>
                  </g>
                ))}
          </g>
        );
      })}
    </g>
  );
}

/** Dveře s výřezy (návěstidla, CENTRAL STOP, měřidlo, ventilace). */
function DoorSheet({ layout, t }: { layout: CncLayoutView; t: number }) {
  const W = layout.door.widthMm;
  const H = layout.door.heightMm;
  return (
    <g data-testid="cnc-door">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" stroke="#0f172a" strokeWidth={2} />
      <text x={4} y={-34 * t} fontSize={16 * t} fontWeight={700}>
        Dveře {n1(W)} × {n1(H)} mm
      </text>
      <Dimension x1={0} y1={-14 * t} x2={W} y2={-14 * t} text={`${n1(W)} mm`} t={t} />
      {layout.doorCutouts.map((cut) => (
        <g key={cut.label}>
          {cut.diameterMm ? <circle cx={cut.x} cy={cut.y} r={cut.diameterMm / 2} fill="#fef3c7" stroke="#b45309" strokeWidth={1.2} /> : <rect x={cut.x - (cut.w ?? 0) / 2} y={cut.y - (cut.h ?? 0) / 2} width={cut.w} height={cut.h} fill="#fef3c7" stroke="#b45309" strokeWidth={1.2} />}
          <text x={cut.x} y={cut.y + (cut.diameterMm ?? cut.h ?? 0) / 2 + 14} fontSize={10 * t} textAnchor="middle" fill="#78350f">
            {cut.label}
          </text>
        </g>
      ))}
      {layout.doorCutouts.length ? null : (
        <text x={W / 2} y={H / 2} fontSize={13 * t} textAnchor="middle" fill="#64748b">
          Bez výřezů ve dveřích
        </text>
      )}
    </g>
  );
}

/**
 * Náhled CNC vrtacího a frézovacího plánu 1 : 1. Fáze 115: listy (kompletní sestava, montážní deska, kabelová čela,
 * dveře), přiblížení / oddálení a přizpůsobení šířce – výchozí měřítko vyplní šířku okna, kóty v mm a značení přístrojů
 * jsou čitelné.
 */
function CncDrawing({ pkg }: { pkg: ReturnType<typeof generateManufacturingPackage> }) {
  const { layout } = pkg;
  const [sheet, setSheet] = useState<CncSheet>("all");
  const [zoom, setZoom] = useState(1);
  const pad = 60;
  const plateBox = { w: layout.plate.widthMm, h: layout.plate.heightMm };
  const facesH = layout.face.depthMm * 2 + 90;
  // Čelo bývá širší než deska – v sestavě je vystředěné nad / pod deskou
  const faceShift = Math.max(0, (layout.face.widthMm - plateBox.w) / 2);
  // Písmo a okraje listu v jednotkách „t“ (šířka listu / 900) – na obrazovce stejně velké na všech listech
  const sheetWidth = sheet === "plate" ? plateBox.w : sheet === "faces" ? layout.face.widthMm : sheet === "door" ? layout.door.widthMm : Math.max(plateBox.w, layout.face.widthMm) + 120 + layout.door.widthMm;
  const t = Math.max(0.3, sheetWidth / 900);
  const box =
    sheet === "plate"
      ? { x: -40 * t, y: -60 * t, w: plateBox.w + 60 * t, h: plateBox.h + 90 * t }
      : sheet === "faces"
        ? { x: -20 * t, y: -40 * t, w: layout.face.widthMm + 40 * t, h: facesH + 60 * t }
        : sheet === "door"
          ? { x: -30 * t, y: -60 * t, w: layout.door.widthMm + 60 * t, h: layout.door.heightMm + 90 * t }
          : { x: -50 - faceShift, y: -layout.face.depthMm - 130, w: Math.max(plateBox.w, layout.face.widthMm) + 170 + layout.door.widthMm + pad, h: layout.face.depthMm * 2 + 200 + plateBox.h + 60 };
  return (
    <div className="flex flex-col gap-2" data-testid="cnc-viewer">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="List CNC výkresu">
          {CNC_SHEETS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sheet === id}
              onClick={() => setSheet(id)}
              className={cn("rounded-md border px-2 py-1 text-xs font-semibold", sheet === id ? "border-sky-500 bg-sky-500/15 text-sky-200" : "border-border text-muted-foreground hover:bg-muted")}
              data-testid={`cnc-sheet-${id}`}
            >
              [ {label} ]
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <button type="button" onClick={() => setZoom((value) => Math.min(6, value * ZOOM_STEP))} className="rounded-md border border-border px-2 py-1 hover:bg-muted" data-testid="cnc-zoom-in">
            🔍+ Přiblížit
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.4, value / ZOOM_STEP))} className="rounded-md border border-border px-2 py-1 hover:bg-muted" data-testid="cnc-zoom-out">
            🔍- Oddálit
          </button>
          <button type="button" onClick={() => setZoom(1)} className="rounded-md border border-border px-2 py-1 hover:bg-muted" data-testid="cnc-zoom-fit">
            ⛶ Přizpůsobit šířce
          </button>
          <span className="w-12 text-right font-mono text-muted-foreground" data-testid="cnc-zoom-level">
            {Math.round(zoom * 100)} %
          </span>
        </div>
      </div>
      {layout.warnings.length ? (
        <ul className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200" data-testid="cnc-warnings">
          {layout.warnings.map((warning) => (
            <li key={warning}>⚠️ {warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="max-h-[78vh] overflow-auto rounded-xl border border-border bg-white" data-testid="cnc-canvas">
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          style={{ width: `${zoom * 100}%` }}
          className="block h-auto [&_*]:[vector-effect:non-scaling-stroke]"
          role="img"
          aria-label="CNC vrtací a frézovací plán 1:1"
          data-testid="cnc-drawing"
          data-sheet={sheet}
          data-zoom={zoom}
        >
          <defs>
            <marker id="cnc-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0369a1" />
            </marker>
          </defs>
          {sheet === "plate" ? <PlateSheet layout={layout} t={t} /> : null}
          {sheet === "faces" ? <FacesSheet layout={layout} t={t} /> : null}
          {sheet === "door" ? <DoorSheet layout={layout} t={t} /> : null}
          {sheet === "all" ? (
            <>
              <g transform={`translate(${-faceShift} ${-layout.face.depthMm - 70})`}>
                <FacesSheet layout={layout} t={t} sides={["top"]} />
              </g>
              <PlateSheet layout={layout} t={t} />
              <g transform={`translate(${-faceShift} ${plateBox.h + 70})`}>
                <FacesSheet layout={layout} t={t} sides={["bottom"]} />
              </g>
              <g transform={`translate(${Math.max(plateBox.w, layout.face.widthMm - faceShift) + 120} 0)`}>
                <DoorSheet layout={layout} t={t} />
              </g>
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

/**
 * Fáze 106: „🛠️ CNC & Výroba na klíč“ – mechanické provedení skříně (přívod kabelů, montáž, prvky ve dveřích),
 * náhled CNC plánu 1 : 1, drátovací list vodičů (Odkud → Kam) a stažení DXF / CSV / XLSX.
 */
/** Fáze 111: `projectId` = CNC výrobní balíček za 8 kreditů (jednorázově na projekt, zkušební projekt se zkušebním označením). */
export function CncManufacturingPanel({ base, initial, onConfig, children, projectId = null }: { base: Omit<CncInput, "entry" | "mounting" | "door">; initial: TurnkeyConfig; onConfig?: (config: TurnkeyConfig) => void; children?: React.ReactNode; projectId?: string | null }) {
  const [config, setConfig] = useState<TurnkeyConfig>(initial);
  /** Fáze 111: CNC balíček – nárok ověří server (8 kreditů jednorázově, zkušební projekt s označením v souboru). */
  async function downloadGated(file: { name: string; content: unknown; mime: string }) {
    if (!projectId) return download(file.name, file.content as BlobPart, file.mime);
    const unlocked = await unlockOutputAction("cnc", projectId);
    if (!unlocked.ok) return reportActionError(unlocked);
    if (unlocked.data.cost) toast.success(`CNC výrobní balíček odemčen za ${unlocked.data.cost} kreditů (zbývá ${unlocked.data.balance}).`);
    const trial = unlocked.data.license === "TRIAL";
    const content = trial && typeof file.content === "string" ? (file.name.endsWith(".dxf") ? file.content : `${TRIAL_WATERMARK}\n${file.content}`) : file.content;
    download(trial ? file.name.replace(/(\.[a-z]+)$/i, "-ZKUSEBNI$1") : file.name, content as BlobPart, file.mime);
  }
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
          <Button key={file.name} type="button" size="sm" variant={file.name.endsWith(".dxf") ? "default" : "outline"} className="gap-1.5" onClick={() => void downloadGated(file)} data-testid={`cnc-download-${file.name.split(".").pop()}`}>
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
                <td className="text-right font-mono">{item.lengthMm > 0 ? item.lengthMm : "–"}</td>
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
