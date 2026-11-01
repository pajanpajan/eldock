"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { CampusSite } from "@/components/map/campus/CampusSite";
import { getSiteLayout } from "@/components/map/campus/site-layouts";
import { fmtM } from "@/lib/cad-grid";
import { campusViewBox, centerAt, moveRect, polygonBounds, rectInsideCampus, rectToMeters, rectsOverlap, resizeRect, type CampusRect, type CampusSize } from "@/lib/campus-layout";

import { PlanViewport, type ViewZoom } from "./PlanViewport";

interface CampusBuilding {
  id: string;
  code: string;
  name: string;
  mapPolygon: string;
  labelX: number;
  labelY: number;
}

interface Props {
  buildings: CampusBuilding[];
  /** Nová budova (procenta mapy); `null` = upravuje se stávající budova. */
  rect: CampusRect | null;
  onChange?: (rect: CampusRect, kind: "move" | "resize") => void;
  label: string;
  /** Zvýrazněná stávající budova (režim úprav). */
  highlightId?: string | null;
  newLabel?: string;
  /** Kód závodu (kulisy areálu); neznámý kód = čistý oplocený pozemek s vrátnicí. */
  plantCode?: string;
  /** Rozměr pozemku v metrech (osa X × osa Y). */
  campus: CampusSize;
  zoom: ViewZoom;
  onZoom: (zoom: ViewZoom) => void;
  toolbar?: ReactNode;
}

/** Krok souřadnicové sítě v metrech: čáry aspoň 28 px od sebe. */
function gridStepMeters(pxPerMeter: number) {
  return [5, 10, 20, 25, 50, 100, 200, 250, 500].find((value) => value * pxPerMeter >= 28) ?? 500;
}

/** Velká mapa areálu ve skutečném měřítku: budovu lze umístit kliknutím, posunout tažením a zvětšit úchytem. */
export function CampusPlacementMap({ buildings, rect, onChange, label, highlightId = null, newLabel = "Nová budova", plantCode = "", campus, zoom, onZoom, toolbar }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: "move" | "resize"; x: number; y: number; start: CampusRect } | null>(null);
  const viewBox = campusViewBox(campus);
  const W = viewBox.width;
  const H = viewBox.height;
  const overlaps = rect ? buildings.filter((building) => rectsOverlap(rect, polygonBounds(building.mapPolygon))) : [];
  const outside = buildings.filter((building) => !rectInsideCampus(polygonBounds(building.mapPolygon)));
  const unitsPerMeter = W / campus.width;

  const percentOf = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 };
  };

  function start(kind: "move" | "resize", event: PointerEvent) {
    if (!rect || !onChange) return;
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    const point = percentOf(event);
    setDrag({ kind, x: point.x, y: point.y, start: rect });
  }

  function move(event: PointerEvent) {
    if (!drag || !onChange) return;
    const point = percentOf(event);
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    onChange(drag.kind === "move" ? moveRect(drag.start, dx, dy) : resizeRect(drag.start, dx, dy), drag.kind);
  }

  const toX = (percent: number) => (percent / 100) * W;
  const toY = (percent: number) => (percent / 100) * H;

  return (
    <div className="space-y-2">
      <PlanViewport viewMeters={campus.width} viewBox={viewBox} zoom={zoom} onZoom={onZoom} label={label} testId="campus-map" toolbar={toolbar}>
        {({ px, unit }) => {
          const step = gridStepMeters(px / campus.width);
          const font = 12 * unit;
          const xs = Array.from({ length: Math.floor(campus.width / step) + 1 }, (_, i) => i * step);
          const ys = Array.from({ length: Math.floor(campus.height / step) + 1 }, (_, i) => i * step);
          const meters = rect ? rectToMeters(rect, campus) : null;
          const badge = (x: number, y: number, text: string, anchor: "middle" | "start" = "middle", testId?: string) => {
            const width = (text.length * 0.62 + 1.2) * font;
            const left = anchor === "middle" ? x - width / 2 : x;
            return (
              <g pointerEvents="none" data-testid={testId}>
                <rect x={left} y={y - font} width={width} height={font * 1.55} rx={3 * unit} fill="#0b1220" stroke="#facc15" strokeWidth={1.5 * unit} />
                <text x={left + width / 2} y={y + font * 0.2} textAnchor="middle" fontSize={font} fontWeight={700} fill="#fde68a" fontFamily="ui-monospace, Consolas, monospace">
                  {text}
                </text>
              </g>
            );
          };
          return (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 size-full"
              onPointerDown={(event) => {
                if (!rect || !onChange || event.button !== 0) return;
                const point = percentOf(event);
                onChange(centerAt(rect, point.x, point.y), "move");
              }}
              onPointerMove={move}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
            >
              <CampusSite layout={getSiteLayout(plantCode, H)} width={W} height={H} widthM={campus.width} />
              {/* Souřadnicová síť v metrech (osa X doprava, osa Y dolů) */}
              <g pointerEvents="none" data-testid="campus-grid" data-step={step}>
                {xs.map((m) => (
                  <line key={`x${m}`} x1={m * unitsPerMeter} y1={0} x2={m * unitsPerMeter} y2={H} stroke="#1e293b" strokeWidth={unit * (m % (step * 5) === 0 ? 1.4 : 0.7)} />
                ))}
                {ys.map((m) => (
                  <line key={`y${m}`} x1={0} y1={m * unitsPerMeter} x2={W} y2={m * unitsPerMeter} stroke="#1e293b" strokeWidth={unit * (m % (step * 5) === 0 ? 1.4 : 0.7)} />
                ))}
                {xs
                  .filter((m) => m > 0 && m % (step * 2) === 0)
                  .map((m) => (
                    <text key={`tx${m}`} x={m * unitsPerMeter + 3 * unit} y={11 * unit} fontSize={9.5 * unit} fill="#64748b" fontFamily="ui-monospace, monospace">
                      {m}
                    </text>
                  ))}
                {ys
                  .filter((m) => m > 0 && m % (step * 2) === 0)
                  .map((m) => (
                    <text key={`ty${m}`} x={3 * unit} y={m * unitsPerMeter - 3 * unit} fontSize={9.5 * unit} fill="#64748b" fontFamily="ui-monospace, monospace">
                      {m}
                    </text>
                  ))}
                <text x={W - 6 * unit} y={H - 8 * unit} textAnchor="end" fontSize={11 * unit} fontWeight={600} fill="#94a3b8" data-testid="campus-size">
                  Areál {campus.width} × {campus.height} m
                </text>
              </g>
              {buildings.map((building) => {
                const highlighted = building.id === highlightId;
                const bad = overlaps.some((entry) => entry.id === building.id) || outside.some((entry) => entry.id === building.id);
                return (
                  <g key={building.id}>
                    <polygon
                      points={building.mapPolygon
                        .split(" ")
                        .map((pair) => {
                          const [x, y] = pair.split(",").map(Number);
                          return `${toX(x)},${toY(y)}`;
                        })
                        .join(" ")}
                      fill={highlighted ? "rgba(250,204,21,0.25)" : "#1f2937"}
                      stroke={bad ? "#ef4444" : highlighted ? "#facc15" : "#475569"}
                      strokeWidth={(bad || highlighted ? 3 : 1.5) * unit}
                    />
                    <text x={toX(building.labelX)} y={toY(building.labelY)} textAnchor="middle" fontSize={13 * unit} fill="#cbd5e1" fontWeight={600} pointerEvents="none">
                      {building.name.split(" - ")[0]}
                    </text>
                  </g>
                );
              })}
              {rect && meters ? (
                <g data-testid="campus-new-building">
                  <rect
                    x={toX(rect.x)}
                    y={toY(rect.y)}
                    width={toX(rect.w)}
                    height={toY(rect.h)}
                    fill={overlaps.length ? "rgba(239,68,68,0.25)" : "rgba(250,204,21,0.3)"}
                    stroke={overlaps.length ? "#ef4444" : "#facc15"}
                    strokeWidth={3 * unit}
                    className={onChange ? "cursor-move" : undefined}
                    onPointerDown={(event) => start("move", event)}
                  />
                  <text x={toX(rect.x + rect.w / 2)} y={toY(rect.y + rect.h / 2)} textAnchor="middle" fontSize={14 * unit} fontWeight={700} fill="#fde68a" pointerEvents="none">
                    {newLabel}
                  </text>
                  <text x={toX(rect.x + rect.w / 2)} y={toY(rect.y + rect.h / 2) + 16 * unit} textAnchor="middle" fontSize={11 * unit} fill="#fef3c7" pointerEvents="none" data-testid="campus-building-size">
                    {fmtM(meters.w)} m × {fmtM(meters.h)} m ({Math.round(meters.w * meters.h).toLocaleString("cs-CZ")} m²)
                  </text>
                  {/* Živé kóty u hran: vodorovná = osa X, svislá = osa Y */}
                  {/* U horního / pravého okraje mapy se kóta přesune dovnitř budovy */}
                  {badge(toX(rect.x + rect.w / 2), toY(rect.y) - 24 * unit < 0 ? toY(rect.y) + 16 * unit : toY(rect.y) - 9 * unit, `X: ${fmtM(meters.w)} m`, "middle", "campus-dim-x")}
                  {toX(rect.x + rect.w) + 90 * unit > W
                    ? badge(toX(rect.x + rect.w) - 7 * unit - (`Y: ${fmtM(meters.h)} m`.length * 0.62 + 1.2) * font, toY(rect.y + rect.h / 2), `Y: ${fmtM(meters.h)} m`, "start", "campus-dim-y")
                    : badge(toX(rect.x + rect.w) + 7 * unit, toY(rect.y + rect.h / 2), `Y: ${fmtM(meters.h)} m`, "start", "campus-dim-y")}
                  {onChange ? (
                    <rect
                      x={toX(rect.x + rect.w) - 9 * unit}
                      y={toY(rect.y + rect.h) - 9 * unit}
                      width={16 * unit}
                      height={16 * unit}
                      rx={3 * unit}
                      fill="#facc15"
                      stroke="#09090b"
                      strokeWidth={1.5 * unit}
                      className="cursor-nwse-resize"
                      onPointerDown={(event) => start("resize", event)}
                      data-testid="campus-resize-handle"
                      aria-label="Změnit velikost budovy"
                    />
                  ) : null}
                </g>
              ) : null}
            </svg>
          );
        }}
      </PlanViewport>
      {outside.length ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="status" data-testid="campus-outside">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Mimo areál {campus.width} × {campus.height} m by ležely: {outside.map((building) => building.name).join(", ")} – zvětšete rozměr areálu.
        </p>
      ) : null}
      {overlaps.length ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="status" data-testid="campus-overlap">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Budova se překrývá s: {overlaps.map((building) => building.name).join(", ")} – posuňte ji tažením na volné místo.
        </p>
      ) : rect && onChange ? (
        <p className="text-xs text-muted-foreground">Klikněte do mapy pro umístění, táhněte budovu pro posun a žlutý úchyt vpravo dole pro změnu velikosti (přichytává se na rozteč sloupů).</p>
      ) : null}
    </div>
  );
}
