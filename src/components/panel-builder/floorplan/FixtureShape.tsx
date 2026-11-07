"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import type { EditorElement } from "@/lib/panel-builder/floorplan-editor";
import { BASIN_MARGIN_MM, basinBand, clampFixture, fixtureDims, fixtureGeometry, zone2Path, type FixtureHandle } from "@/lib/panel-builder/fixtures";

/**
 * Fáze 63: zařizovací předmět jako architektonická 2D značka ve skutečném rozměru (šířka X × hloubka Y, natočení):
 * vana s vnitřní vanou a odtokem, sprchový kout s úhlopříčkami, umyvadlo / dvojumyvadlo s miskou a baterií u zadní
 * hrany. Zóny koupelny (zóna 1 = předmět, zóna 2 = +0,6 m čárkovaně) a pás nad a pod umyvadlem (šíře + 0,2 m na každou
 * stranu ke stěně) se kreslí z aktuálního rozměru. Vybraný předmět má posuvné strany a žlutý roh se živými kótami.
 */

const NAME: Record<string, string> = { bath: "VANA", shower: "SPRCHA", basin: "UMY", double_basin: "DUM" };

/** Kurzor změny rozměru podle směru strany ve výkresu. */
function resizeCursor(angle: number) {
  const a = ((angle % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return "cursor-ew-resize";
  if (a >= 67.5 && a < 112.5) return "cursor-ns-resize";
  return a < 67.5 ? "cursor-nwse-resize" : "cursor-nesw-resize";
}

export function FixtureShape({
  element,
  active,
  onPaper,
  unit,
  interactive,
  onBodyDown,
  onHandleDown,
}: {
  element: EditorElement;
  active: boolean;
  onPaper: boolean;
  /** Jednotka popisků a úchytů (drží velikost na obrazovce). */
  unit: number;
  interactive: boolean;
  onBodyDown?: (event: ReactPointerEvent) => void;
  onHandleDown?: (event: ReactPointerEvent, handle: FixtureHandle) => void;
}) {
  const geometry = fixtureGeometry(element);
  if (!geometry) return null;
  const ink = onPaper ? "#111827" : "#e4e4e7";
  const line = Math.max(8, unit / 14);
  const w = geometry.w / 2;
  const d = geometry.d / 2;
  const rotation = geometry.rotation;
  const band = geometry.zone === "basin" ? basinBand(geometry) : null;
  const edge = unit * 0.35;
  const handle = unit * 0.5;
  // Kóty nad obálkou natočeného předmětu (text se neotáčí)
  const rad = (rotation * Math.PI) / 180;
  const halfHeight = (Math.abs(geometry.w * Math.sin(rad)) + Math.abs(geometry.d * Math.cos(rad))) / 2;
  const bowls = geometry.type === "double_basin" ? [-w / 2, w / 2] : [0];
  const bowl = { rx: (geometry.type === "double_basin" ? w / 2 : w) * 0.7, ry: d * 0.62 };
  return (
    <g data-testid="fixture" data-fixture={geometry.type} data-size={`${geometry.w}x${geometry.d}`} data-rotation={rotation}>
      <g transform={`translate(${geometry.cx} ${geometry.cy}) rotate(${rotation})`}>
        {/* Zóny: koupelna 0–2 / pás nad a pod umyvadlem – přepočítají se s rozměrem */}
        {geometry.zone === "bath" ? (
          <path d={zone2Path(geometry.w, geometry.d)} fill="rgba(56,189,248,0.06)" stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={line} strokeDasharray={`${line * 5} ${line * 3}`} pointerEvents="none" data-testid="fixture-zone2" />
        ) : null}
        {band ? (
          <rect x={band.u1} y={band.v1} width={band.u2 - band.u1} height={band.v2 - band.v1} fill="rgba(248,113,113,0.08)" stroke="#f87171" strokeOpacity={0.75} strokeWidth={line} strokeDasharray={`${line * 4} ${line * 3}`} pointerEvents="none" data-testid="fixture-band" />
        ) : null}
        {/* Tělo předmětu (zóna 1) – klik = výběr, tažení = přesun */}
        <rect
          x={-w}
          y={-d}
          width={geometry.w}
          height={geometry.d}
          rx={geometry.type === "bath" ? 40 : 20}
          fill={onPaper ? "rgba(255,255,255,0.92)" : "rgba(24,24,27,0.92)"}
          stroke={active ? "#facc15" : ink}
          strokeWidth={line * (active ? 2.2 : 1.4)}
          className={interactive ? "cursor-move" : undefined}
          onPointerDown={onBodyDown}
          data-testid="fixture-body"
        />
        <g fill="none" stroke={ink} strokeWidth={line} pointerEvents="none">
          {geometry.type === "bath" ? (
            <>
              <rect x={-w + 80} y={-d + 80} width={Math.max(10, geometry.w - 160)} height={Math.max(10, geometry.d - 160)} rx={Math.max(5, d - 80)} />
              <circle cx={-w + Math.min(260, w)} cy={0} r={45} />
            </>
          ) : null}
          {geometry.type === "shower" ? (
            <>
              <path d={`M${-w} ${-d} L${w} ${d} M${w} ${-d} L${-w} ${d}`} strokeOpacity={0.6} />
              <circle cx={0} cy={0} r={50} />
            </>
          ) : null}
          {geometry.type === "basin" || geometry.type === "double_basin"
            ? bowls.map((cx) => (
                <g key={cx}>
                  <ellipse cx={cx} cy={d * 0.1} rx={bowl.rx} ry={bowl.ry} />
                  <circle cx={cx} cy={-d + 55} r={22} fill={ink} />
                </g>
              ))
            : null}
        </g>
        {/* Posuvné strany a žlutý roh (vybraný předmět) */}
        {active && interactive && onHandleDown ? (
          <>
            <rect x={w - edge / 2} y={-d} width={edge} height={geometry.d} fill="transparent" className={resizeCursor(rotation)} onPointerDown={(event) => onHandleDown(event, "e")} data-handle="e" />
            <rect x={-w - edge / 2} y={-d} width={edge} height={geometry.d} fill="transparent" className={resizeCursor(rotation)} onPointerDown={(event) => onHandleDown(event, "w")} data-handle="w" />
            <rect x={-w} y={d - edge / 2} width={geometry.w} height={edge} fill="transparent" className={resizeCursor(rotation + 90)} onPointerDown={(event) => onHandleDown(event, "s")} data-handle="s" />
            <rect x={-w} y={-d - edge / 2} width={geometry.w} height={edge} fill="transparent" className={resizeCursor(rotation + 90)} onPointerDown={(event) => onHandleDown(event, "n")} data-handle="n" />
            <rect x={w - handle / 2} y={d - handle / 2} width={handle} height={handle} rx={handle * 0.15} fill="#facc15" stroke="#09090b" strokeWidth={line} className={resizeCursor(rotation + 45)} onPointerDown={(event) => onHandleDown(event, "se")} data-testid="fixture-handle" />
          </>
        ) : null}
      </g>
      {/* Popisek a kóty – vždy vodorovně */}
      <text x={geometry.cx} y={geometry.cy} fontSize={Math.max(60, Math.min(geometry.w, geometry.d) * 0.16)} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={ink} opacity={0.75} pointerEvents="none">
        {NAME[geometry.type]}
      </text>
      {active ? (
        <g pointerEvents="none">
          <text x={geometry.cx} y={geometry.cy - halfHeight - unit * 0.45} fontSize={unit * 0.62} fontWeight={800} textAnchor="middle" fill="#facc15" stroke="#09090b" strokeWidth={unit * 0.06} paintOrder="stroke" data-testid="fixture-dims">
            {fixtureDims(geometry.w, geometry.d)}
          </text>
          {geometry.zone === "bath" ? (
            <text x={geometry.cx} y={geometry.cy + halfHeight + unit * 0.9} fontSize={unit * 0.45} textAnchor="middle" fill="#38bdf8" stroke="#09090b" strokeWidth={unit * 0.04} paintOrder="stroke">
              zóna 1 = předmět · zóna 2 = +0,6 m (zásuvky a spínače mimo)
            </text>
          ) : (
            <text x={geometry.cx} y={geometry.cy + halfHeight + unit * 0.9} fontSize={unit * 0.45} textAnchor="middle" fill="#f87171" stroke="#09090b" strokeWidth={unit * 0.04} paintOrder="stroke">
              pás nad a pod umyvadlem = šíře + {BASIN_MARGIN_MM / 10} cm na každou stranu (bez zásuvek a spínačů)
            </text>
          )}
        </g>
      ) : null}
    </g>
  );
}

/** Fáze 63: přesný rozměr a natočení předmětu v bočním panelu (zóny se přepočítají hned). */
export function FixtureControls({ element, onChange, onRotate }: { element: EditorElement; onChange: (patch: Partial<EditorElement>) => void; onRotate: (step: number) => void }) {
  const geometry = fixtureGeometry(element);
  if (!geometry) return null;
  const size = { w: geometry.w, d: geometry.d };
  const set = (key: "w" | "d", value: string) => {
    const mm = Math.round(Number(value));
    if (!Number.isFinite(mm) || mm <= 0) return;
    onChange({ sizeMm: { ...size, [key]: clampFixture(mm) } });
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/5 p-2 text-xs" data-testid="fixture-detail">
      <p className="font-semibold text-sky-200" data-testid="fixture-detail-dims">
        {fixtureDims(geometry.w, geometry.d)} · natočení {geometry.rotation}°
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="flex flex-col gap-0.5 text-muted-foreground">
          Šířka X [mm]
          <input key={`w${size.w}`} type="number" min={300} max={4000} step={10} defaultValue={size.w} onBlur={(event) => set("w", event.target.value)} onKeyDown={(event) => event.key === "Enter" && set("w", event.currentTarget.value)} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30" aria-label="Šířka X [mm]" />
        </label>
        <label className="flex flex-col gap-0.5 text-muted-foreground">
          Hloubka Y [mm]
          <input key={`d${size.d}`} type="number" min={300} max={4000} step={10} defaultValue={size.d} onBlur={(event) => set("d", event.target.value)} onKeyDown={(event) => event.key === "Enter" && set("d", event.currentTarget.value)} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30" aria-label="Hloubka Y [mm]" />
        </label>
        <div className="flex flex-col gap-0.5 text-muted-foreground">
          Otočit
          <div className="flex gap-1">
            <button type="button" onClick={() => onRotate(90)} className="h-8 flex-1 rounded-md border border-border hover:border-primary/60" data-testid="fixture-rotate-90">
              ↻ 90°
            </button>
            <button type="button" onClick={() => onRotate(45)} className="h-8 flex-1 rounded-md border border-border hover:border-primary/60" data-testid="fixture-rotate-45">
              ↻ 45°
            </button>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground">
        {geometry.zone === "bath"
          ? "Zóna 1 = půdorys předmětu, zóna 2 = 0,6 m od hrany (ČSN 33 2000-7-701 ed. 2) – zásuvky a spínače jen mimo. Rozměr měňte tažením za strany nebo žlutý roh."
          : `Pás nad a pod umyvadlem v šíři umyvadla + ${BASIN_MARGIN_MM / 10} cm na každou stranu (ČSN 33 2130 ed. 4) – bez zásuvek a spínačů. Zadní hrana = strana u stěny.`}
      </p>
    </div>
  );
}
