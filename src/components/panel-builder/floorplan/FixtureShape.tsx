"use client";

import { useId, type PointerEvent as ReactPointerEvent } from "react";

import { archDrawing, primitivePath } from "@/lib/panel-builder/architecture";
import type { EditorElement } from "@/lib/panel-builder/floorplan-editor";
import {
  BASIN_MARGIN_MM,
  BASIN_RECOMMENDED_MM,
  BASIN_STRICT_MM,
  FIXTURE_ROTATIONS,
  WASH_AREA_TOP_MM,
  WASH_HIGH_MM,
  basinBand,
  clampFixture,
  fixtureDims,
  fixtureGeometry,
  fixtureSpecOf,
  toWorld,
  washArea,
  zone2Path,
  type ArchType,
  type BasinZone,
  type FixtureHandle,
} from "@/lib/panel-builder/fixtures";
import { cn } from "@/lib/utils";

const metres = (mm: number) => (mm / 1000).toLocaleString("cs-CZ");

/**
 * Fáze 63: zařizovací předmět jako architektonická 2D značka ve skutečném rozměru (šířka X × hloubka Y, natočení):
 * vana s vnitřní vanou a odtokem, sprchový kout s úhlopříčkami, umyvadlo / dvojumyvadlo s miskou a baterií u zadní
 * hrany. Zóny koupelny (zóna 1 = předmět, zóna 2 = +0,6 m čárkovaně) a pás nad a pod umyvadlem (šíře + 0,2 m na každou
 * stranu ke stěně) se kreslí z aktuálního rozměru. Vybraný předmět má posuvné strany a žlutý roh se živými kótami.
 * Fáze 90: zóny se ořežou stěnami místnosti předmětu (nepřesahují na fasádu), umyvadlový prostor je výrazný (tyrkysový
 * pás + 0,2 m, oranžově tečkovaně doporučených 0,4 m, popisek) a stejný mechanismus kreslí okna, dveře a nábytek.
 */

const NAME: Partial<Record<string, string>> = { bath: "VANA", shower: "SPRCHA", basin: "UMY", double_basin: "DUM" };

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
  basinZone = "norm",
  clip = null,
}: {
  element: EditorElement;
  active: boolean;
  onPaper: boolean;
  /** Jednotka popisků a úchytů (drží velikost na obrazovce). */
  unit: number;
  interactive: boolean;
  /** Fáze 74: ochranná zóna umyvadla – umývací prostor + 0,2 m (norma), nebo navíc 0,6 m (přísněji). */
  basinZone?: BasinZone;
  /** Fáze 90: obrys místnosti předmětu – zóny se jím ořežou (bez místnosti neořezané). */
  clip?: readonly { x: number; y: number }[] | null;
  onBodyDown?: (event: ReactPointerEvent) => void;
  onHandleDown?: (event: ReactPointerEvent, handle: FixtureHandle) => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const geometry = fixtureGeometry(element);
  if (!geometry) return null;
  const spec = fixtureSpecOf(element.item);
  const arch = Boolean(spec?.arch);
  const ink = onPaper ? "#111827" : "#e4e4e7";
  const line = Math.max(8, unit / 14);
  const w = geometry.w / 2;
  const d = geometry.d / 2;
  const rotation = geometry.rotation;
  const band = geometry.zone === "basin" ? basinBand(geometry) : null;
  const area = geometry.zone === "basin" ? washArea(geometry) : null;
  const edge = unit * 0.35;
  const handle = unit * 0.5;
  // Kóty nad obálkou natočeného předmětu (text se neotáčí)
  const rad = (rotation * Math.PI) / 180;
  const halfHeight = (Math.abs(geometry.w * Math.sin(rad)) + Math.abs(geometry.d * Math.cos(rad))) / 2;
  const bowls = geometry.type === "double_basin" ? [-w / 2, w / 2] : [0];
  const bowl = { rx: (geometry.type === "double_basin" ? w / 2 : w) * 0.7, ry: d * 0.62 };
  const clipId = clip && clip.length > 2 ? `fixture-clip-${uid}` : null;
  const transform = `translate(${geometry.cx} ${geometry.cy}) rotate(${rotation})`;
  // Fáze 90: popisek umyvadlového prostoru před umyvadlem (vodorovně)
  const basinLabel = band ? toWorld(geometry, 0, d + Math.max(unit * 0.55, 120)) : null;
  const soft = onPaper ? "rgba(17,24,39,0.05)" : "rgba(161,161,170,0.12)";
  return (
    <g data-testid="fixture" data-fixture={geometry.type} data-size={`${geometry.w}x${geometry.d}`} data-rotation={rotation} data-at={`${Math.round(geometry.cx)},${Math.round(geometry.cy)}`} data-flip={geometry.flip ? "true" : undefined} data-arch={arch ? spec?.arch : undefined}>
      {clipId ? (
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <polygon points={clip!.map((point) => `${point.x},${point.y}`).join(" ")} />
          </clipPath>
        </defs>
      ) : null}
      {/* Zóny: koupelna 0–2 / umyvadlový prostor – přepočítají se s rozměrem, ořízne je obrys místnosti */}
      {geometry.zone !== "none" ? (
        <g clipPath={clipId ? `url(#${clipId})` : undefined} pointerEvents="none" data-testid="fixture-zones" data-clipped={clipId ? "true" : undefined}>
          <g transform={transform}>
            {geometry.zone === "bath" ? <path d={zone2Path(geometry.w, geometry.d)} fill="rgba(56,189,248,0.06)" stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={line} strokeDasharray={`${line * 5} ${line * 3}`} data-testid="fixture-zone2" /> : null}
            {/* Fáze 74: ochranná zóna umyvadla jako zóny vany – volitelně 0,6 m */}
            {geometry.zone === "basin" && basinZone === "strict" ? <path d={zone2Path(geometry.w, geometry.d, BASIN_STRICT_MM)} fill="rgba(56,189,248,0.04)" stroke="#38bdf8" strokeOpacity={0.6} strokeWidth={line} strokeDasharray={`${line * 1.5} ${line * 3}`} data-testid="fixture-basin-strict" /> : null}
            {/* Fáze 90: doporučený lem 0,4 m tečkovaně oranžově, pás + 0,2 m tyrkysově čárkovaně, umývací prostor červeně */}
            {band ? <rect x={band.u1 - (BASIN_RECOMMENDED_MM - BASIN_MARGIN_MM)} y={band.v1} width={band.u2 - band.u1 + (BASIN_RECOMMENDED_MM - BASIN_MARGIN_MM) * 2} height={band.v2 - band.v1} fill="none" stroke="#f97316" strokeOpacity={0.85} strokeWidth={line} strokeDasharray={`${line * 1.2} ${line * 2.4}`} data-testid="fixture-band-recommended" /> : null}
            {band ? <rect x={band.u1} y={band.v1} width={band.u2 - band.u1} height={band.v2 - band.v1} fill="rgba(20,184,166,0.14)" stroke="#14b8a6" strokeWidth={line * 1.4} strokeDasharray={`${line * 5} ${line * 3}`} data-testid="fixture-band" /> : null}
            {area ? <rect x={area.u1} y={area.v1} width={area.u2 - area.u1} height={area.v2 - area.v1} fill="rgba(248,113,113,0.16)" stroke="#f87171" strokeOpacity={0.9} strokeWidth={line * 1.2} data-testid="fixture-wash-area" /> : null}
          </g>
        </g>
      ) : null}
      <g transform={transform}>
        {/* Tělo předmětu (zóna 1) – klik = výběr, tažení = přesun; u oken, dveří a nábytku jen neviditelná plocha */}
        <rect
          x={-w}
          y={-d}
          width={geometry.w}
          height={geometry.d}
          rx={arch ? 0 : geometry.type === "bath" ? 40 : 20}
          fill={arch ? "transparent" : onPaper ? "rgba(255,255,255,0.92)" : "rgba(24,24,27,0.92)"}
          stroke={arch ? (active ? "#facc15" : "none") : active ? "#facc15" : ink}
          strokeWidth={line * (active ? 2.2 : 1.4)}
          strokeDasharray={arch && active ? `${line * 4} ${line * 2}` : undefined}
          className={interactive ? "cursor-move" : undefined}
          onPointerDown={onBodyDown}
          data-testid="fixture-body"
        />
        {arch ? (
          // Fáze 90: CAD kresba okna, dveří nebo nábytku (stejná jako v PDF a DXF)
          <g fill="none" stroke={ink} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" data-testid="fixture-arch">
            {archDrawing(geometry.type as ArchType, geometry.w, geometry.d, geometry.flip).map((primitive, index) => (
              <path key={index} d={primitivePath(primitive)} fill={primitive.fill && primitive.closed ? soft : "none"} strokeWidth={line * (primitive.weight ?? 1)} strokeDasharray={primitive.dashed ? `${line * 3} ${line * 2.2}` : undefined} />
            ))}
          </g>
        ) : (
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
        )}
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
      {NAME[geometry.type] ? (
        <text x={geometry.cx} y={geometry.cy} fontSize={Math.max(60, Math.min(geometry.w, geometry.d) * 0.16)} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={ink} opacity={0.75} pointerEvents="none">
          {NAME[geometry.type]}
        </text>
      ) : null}
      {basinLabel ? (
        <text x={basinLabel.x} y={basinLabel.y} fontSize={Math.max(70, Math.min(unit * 0.4, geometry.w * 0.16))} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill="#0d9488" stroke={onPaper ? "#ffffff" : "#09090b"} strokeWidth={Math.max(8, unit * 0.04)} paintOrder="stroke" pointerEvents="none" data-testid="fixture-basin-label">
          UMYVADLOVÝ PROSTOR
        </text>
      ) : null}
      {active ? (
        <g pointerEvents="none">
          <text x={geometry.cx} y={geometry.cy - halfHeight - unit * 0.45} fontSize={unit * 0.62} fontWeight={800} textAnchor="middle" fill="#facc15" stroke="#09090b" strokeWidth={unit * 0.06} paintOrder="stroke" data-testid="fixture-dims">
            {fixtureDims(geometry.w, geometry.d)}
          </text>
          {arch ? (
            <text x={geometry.cx} y={geometry.cy + halfHeight + unit * 0.9} fontSize={unit * 0.45} textAnchor="middle" fill="#a1a1aa" stroke="#09090b" strokeWidth={unit * 0.04} paintOrder="stroke">
              {spec?.code} · {spec?.label} · {rotation}°{spec?.flip === "swing" ? (geometry.flip ? " · pravé otevírání" : " · levé otevírání") : ""}
            </text>
          ) : geometry.zone === "bath" ? (
            <text x={geometry.cx} y={geometry.cy + halfHeight + unit * 0.9} fontSize={unit * 0.45} textAnchor="middle" fill="#38bdf8" stroke="#09090b" strokeWidth={unit * 0.04} paintOrder="stroke">
              zóna 1 = předmět · zóna 2 = +0,6 m do výšky 2,25 m (zásuvky a spínače mimo)
            </text>
          ) : (
            <text x={geometry.cx} y={geometry.cy + halfHeight + unit * 0.9} fontSize={unit * 0.45} textAnchor="middle" fill="#14b8a6" stroke="#09090b" strokeWidth={unit * 0.04} paintOrder="stroke">
              umyvadlový prostor do {metres(WASH_AREA_TOP_MM)} m · pod {metres(WASH_HIGH_MM)} m bez IP44 +{BASIN_MARGIN_MM / 10} cm (doporučeno {BASIN_RECOMMENDED_MM / 10} cm){basinZone === "strict" ? ` · přísněji ${BASIN_STRICT_MM / 10} cm` : ""}
            </text>
          )}
        </g>
      ) : null}
    </g>
  );
}

/** Fáze 63: přesný rozměr a natočení předmětu v bočním panelu (zóny se přepočítají hned). */
export function FixtureControls({
  element,
  onChange,
  onRotate,
  basinZone = "norm",
  onBasinZone,
}: {
  element: EditorElement;
  onChange: (patch: Partial<EditorElement>) => void;
  onRotate: (step: number) => void;
  /** Fáze 74: ochranná zóna umyvadla pro celý nákres. */
  basinZone?: BasinZone;
  onBasinZone?: (zone: BasinZone) => void;
}) {
  const geometry = fixtureGeometry(element);
  const spec = fixtureSpecOf(element.item);
  if (!geometry || !spec) return null;
  const size = { w: geometry.w, d: geometry.d };
  const min = spec.min ?? 300;
  const max = spec.max ?? 4000;
  const set = (key: "w" | "d", value: string) => {
    const mm = Math.round(Number(value));
    if (!Number.isFinite(mm) || mm <= 0) return;
    onChange({ sizeMm: { ...size, [key]: clampFixture(mm, spec) } });
  };
  const flipLabel = spec.flip === "swing" ? (geometry.type === "door_sliding" ? "⇄ Posuv vlevo / vpravo" : "⇄ Levé / Pravé otevírání") : "⇄ Zrcadlit";
  const flipState = spec.flip === "swing" ? (geometry.type === "door_sliding" ? (geometry.flip ? "posuv vlevo" : "posuv vpravo") : geometry.flip ? "teď pravé" : "teď levé") : geometry.flip ? "zrcadleno" : "výchozí";
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border p-2 text-xs", spec.arch ? "border-amber-500/40 bg-amber-500/5" : "border-sky-500/40 bg-sky-500/5")} data-testid="fixture-detail">
      <p className={cn("font-semibold", spec.arch ? "text-amber-200" : "text-sky-200")} data-testid="fixture-detail-dims">
        {fixtureDims(geometry.w, geometry.d)} · natočení {geometry.rotation}°
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="flex flex-col gap-0.5 text-muted-foreground">
          Šířka X [mm]
          <input key={`w${size.w}`} type="number" min={min} max={max} step={10} defaultValue={size.w} onBlur={(event) => set("w", event.target.value)} onKeyDown={(event) => event.key === "Enter" && set("w", event.currentTarget.value)} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30" aria-label="Šířka X [mm]" />
        </label>
        <label className="flex flex-col gap-0.5 text-muted-foreground">
          Hloubka Y [mm]
          <input key={`d${size.d}`} type="number" min={min} max={max} step={10} defaultValue={size.d} onBlur={(event) => set("d", event.target.value)} onKeyDown={(event) => event.key === "Enter" && set("d", event.currentTarget.value)} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30" aria-label="Hloubka Y [mm]" />
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
      {/* Fáze 90: pevná natočení 0° / 45° / 90° / 180° / 270° */}
      <div className="flex flex-wrap items-center gap-1 text-muted-foreground" role="radiogroup" aria-label="Natočení předmětu">
        Natočení:
        {FIXTURE_ROTATIONS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={geometry.rotation === value} onClick={() => onChange({ rotation: value })} className={cn("rounded border px-1.5 py-0.5 font-mono", geometry.rotation === value ? "border-primary bg-primary/20 text-foreground" : "border-border hover:border-primary/60")} data-testid={`fixture-rotation-${value}`}>
            {value}°
          </button>
        ))}
      </div>
      {spec.flip ? (
        <button type="button" aria-pressed={geometry.flip} onClick={() => onChange({ flip: !geometry.flip })} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-amber-500/50 font-semibold text-foreground hover:bg-amber-500/10" data-testid="fixture-flip">
          [ {flipLabel} ] <span className="font-normal text-muted-foreground">({flipState})</span>
        </button>
      ) : null}
      <p className="text-muted-foreground">
        {spec.arch
          ? `Orientační prvek ${spec.code} – nevytváří okruh v rozváděči, zobrazí se v PDF i v DXF (vrstva ARCHITEKTURA_NABYTEK). Rozměr měňte tažením za strany nebo žlutý roh${spec.arch === "opening" ? "; okno a dveře se přichytí ke stěně místnosti (Alt = volně)" : ""}.`
          : geometry.zone === "bath"
            ? "Zóna 1 = půdorys předmětu, zóna 2 = 0,6 m od hrany do výšky 2,25 m (ČSN 33 2000-7-701 ed. 2) – zásuvky a spínače jen mimo. Rozměr měňte tažením za strany nebo žlutý roh."
            : `Umyvadlový prostor (červeně) = svislý průmět umyvadla ke stěně do ${metres(WASH_AREA_TOP_MM)} m – zásuvky a spínače jen vně. Níž než ${metres(WASH_HIGH_MM)} m bez krytí IP44 nejméně ${BASIN_MARGIN_MM / 10} cm od hranice (tyrkysově), doporučeno ${BASIN_RECOMMENDED_MM / 10} cm (oranžově tečkovaně); od ${metres(WASH_HIGH_MM)} m smí být těsně u hranice (ČSN 33 2130 ed. 4). Zóny 0–2 má jen vana a sprcha. Zadní hrana = strana u stěny.`}
      </p>
      {geometry.zone === "basin" && onBasinZone ? (
        <div className="flex flex-col gap-1" role="radiogroup" aria-label="Ochranná zóna umyvadla" data-testid="basin-zone">
          {(
            [
              ["norm", `Podle normy – umývací prostor + ${BASIN_MARGIN_MM / 10} cm`],
              ["strict", `Přísněji – ${BASIN_STRICT_MM / 10} cm kolem umyvadla (jako zóna 2)`],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-foreground">
              <input type="radio" name="basin-zone" checked={basinZone === value} onChange={() => onBasinZone(value)} data-testid={`basin-zone-${value}`} />
              {label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
