"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { coresOf, labelPlacement, longestStretch, stretchSlot, tickMarks } from "@/lib/panel-builder/cad-notation";
import type { DisplayCircuit, DisplayLeg } from "@/lib/panel-builder/route-display";
import { segmentAxis, type PlanPoint } from "@/lib/panel-builder/route-edit";

/**
 * Fáze 63: trasy kabelů na plátně a na tiskovém výkresu. Barevně podle okruhů (jako dřív, vrchem čárkovaně), nebo
 * normové CAD značení: plná čára se šikmými ryskami počtu žil, ovládací a sběrnicové kabely čárkovaně, podél větve
 * štítek „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. V režimu výběru má každý rovný úsek úchyt: vodorovný se táhne jen v ose Y
 * (↕), svislý jen v ose X (↔), šikmý kolmo ke stěně; dvojklik vloží odskok, pravé tlačítko vrátí trasu na automat.
 */

export const ROUTE_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#4ade80"];

const pathOf = (runs: readonly (readonly PlanPoint[])[]) => runs.map((run) => `M ${run.map((point) => `${Math.round(point.x)} ${Math.round(point.y)}`).join(" L ")}`).join(" ");

const CURSOR = { horizontal: "cursor-ns-resize", vertical: "cursor-ew-resize", slanted: "cursor-move" } as const;
const GLYPH = { horizontal: "↕", vertical: "↔", slanted: "⤢" } as const;

export interface RouteDrag {
  key: string;
  points: PlanPoint[];
}

export function RouteLayer({
  circuits,
  bus,
  view,
  onPaper,
  unit,
  stroke,
  editable = false,
  drag = null,
  onSegmentDown,
  onReset,
}: {
  circuits: DisplayCircuit[];
  bus: DisplayCircuit | null;
  view: "color" | "cad";
  onPaper: boolean;
  unit: number;
  stroke: number;
  editable?: boolean;
  drag?: RouteDrag | null;
  /** Stisk úseku – tažení; dva stisky na stejném úseku = dvojklik (odskok) rozpozná editor. */
  onSegmentDown?: (event: ReactPointerEvent, circuit: DisplayCircuit, leg: DisplayLeg, index: number) => void;
  onReset?: (circuit: DisplayCircuit) => void;
}) {
  const cad = view === "cad";
  const ink = onPaper ? "#111827" : "#e4e4e7";
  const halo = onPaper ? "#ffffff" : "#09090b";
  const legPoints = (leg: DisplayLeg) => (drag && drag.key === leg.key ? drag.points : leg.points);
  const all = bus ? [...circuits, bus] : circuits;
  return (
    <g data-testid="route-layer" data-view={view}>
      {all.map((circuit, index) => {
        const isBus = circuit.id === "bus";
        const runs = circuit.legs.map(legPoints);
        const color = isBus ? "#22c55e" : ROUTE_COLORS[index % ROUTE_COLORS.length];
        const offset = cad || isBus ? 0 : ((index % 7) - 3) * stroke * 2.4;
        const dashed = cad ? circuit.lowVoltage : isBus || circuit.routing === "TOP";
        const stretch = longestStretch(runs);
        const last = runs[runs.length - 1]?.[runs[runs.length - 1].length - 1];
        return (
          <g key={circuit.id} transform={offset ? `translate(${offset} ${offset})` : undefined} data-circuit={circuit.id} data-edited={circuit.edited ? "true" : undefined}>
            <g data-testid={isBus ? "bus-line" : "cable-route"} pointerEvents="none">
              <path
                d={pathOf(runs)}
                fill="none"
                stroke={cad ? ink : color}
                strokeWidth={cad ? stroke * (circuit.lowVoltage ? 1.8 : 2.4) : stroke * (isBus ? 2.5 : 3.5)}
                strokeLinejoin="round"
                strokeDasharray={dashed ? (cad ? `${unit / 2.5} ${unit / 5}` : isBus ? `${unit / 6} ${unit / 6}` : `${unit / 2} ${unit / 5}`) : undefined}
                opacity={cad ? 1 : 0.9}
              />
              {cad && stretch ? (
                <>
                  {/* Rysky počtu žil uprostřed nejdelšího úseku a číslo žil */}
                  {tickMarks(stretch.a, stretch.b, coresOf(circuit.cable), unit * 0.5, unit * 0.22, stretchSlot(index)).map((tick, tickIndex) => (
                    <line key={tickIndex} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={ink} strokeWidth={stroke * 1.6} data-testid="cable-tick" />
                  ))}
                  {(() => {
                    const label = labelPlacement(stretch.a, stretch.b, unit * 0.55, stretchSlot(index));
                    return (
                      <text x={label.x} y={label.y} fontSize={unit * 0.42} fontWeight={700} textAnchor="middle" fill={ink} stroke={halo} strokeWidth={unit * 0.09} paintOrder="stroke" transform={`rotate(${label.angle} ${label.x} ${label.y})`} data-testid="cable-tag">
                        {circuit.tag}
                        {circuit.edited ? " ✎" : ""}
                      </text>
                    );
                  })()}
                </>
              ) : null}
              {!cad && last && !isBus ? (
                <text x={last.x + unit * 0.6} y={last.y - unit * 0.6} fontSize={unit * 0.62} fill={color} fontWeight={700}>
                  {circuit.lengthM.toLocaleString("cs-CZ")} m{circuit.edited ? " ✎" : ""}
                </text>
              ) : null}
            </g>
            {/* Úchyty úseků pro ruční úpravu trasy */}
            {editable
              ? circuit.legs
                  .filter((leg) => leg.editable)
                  .map((leg) => {
                    const points = legPoints(leg);
                    return (
                      <g key={leg.key} data-testid="route-handles" data-leg={leg.key}>
                        {points.slice(0, -1).map((a, segment) => {
                          const b = points[segment + 1];
                          const axis = segmentAxis(a, b);
                          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                          return (
                            <g key={segment} className="group">
                              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#facc15" strokeWidth={stroke * 4} strokeLinecap="round" className="opacity-0 group-hover:opacity-70" pointerEvents="none" />
                              <line
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                stroke="transparent"
                                strokeWidth={unit * 0.55}
                                strokeLinecap="butt"
                                className={CURSOR[axis]}
                                onPointerDown={(event) => onSegmentDown?.(event, circuit, leg, segment)}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onReset?.(circuit);
                                }}
                                data-testid="route-segment"
                                data-axis={axis}
                                data-index={segment}
                              />
                              <g transform={`translate(${mid.x} ${mid.y})`} className="opacity-0 group-hover:opacity-100" pointerEvents="none">
                                <rect x={-unit * 0.28} y={-unit * 0.28} width={unit * 0.56} height={unit * 0.56} rx={unit * 0.1} fill="#facc15" stroke="#09090b" strokeWidth={stroke} />
                                <text y={unit * 0.14} fontSize={unit * 0.42} fontWeight={800} textAnchor="middle" fill="#09090b">
                                  {GLYPH[axis]}
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })
              : null}
          </g>
        );
      })}
    </g>
  );
}
