"use client";

import { memo, type PointerEvent as ReactPointerEvent } from "react";

import { coresOf, labelPlacement, longestStretch, stretchSlot, tickMarks } from "@/lib/panel-builder/cad-notation";
import type { DisplayCircuit, DisplayLeg } from "@/lib/panel-builder/route-display";
import { segmentAxis, type PlanPoint } from "@/lib/panel-builder/route-edit";

/**
 * Fáze 63: trasy kabelů na plátně a na tiskovém výkresu. Barevně podle okruhů (jako dřív, vrchem čárkovaně), nebo
 * normové CAD značení: plná čára se šikmými ryskami počtu žil, ovládací a sběrnicové kabely čárkovaně, podél větve
 * štítek „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. V režimu výběru má každý rovný úsek úchyt: vodorovný se táhne jen v ose Y
 * (↕), svislý jen v ose X (↔), šikmý kolmo ke stěně; dvojklik vloží odskok, pravé tlačítko vrátí trasu na automat.
 * Fáze 100: na plátně mají štítky tras podkladový štítek (světlé písmo s tmavým obrysem `paint-order: stroke`, ≈ 4 px) –
 * nesplývají s čarou stěny ani s bílým podkladem; vrstva se při pohybu myší nepřekresluje (React.memo).
 */

/** Fáze 100: podkladový štítek textu na plátně (tmavý obrys pod písmem). */
export const PLATE_STROKE = "rgba(15,23,42,0.88)";

export const ROUTE_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#4ade80"];

const pathOf = (runs: readonly (readonly PlanPoint[])[]) => runs.map((run) => `M ${run.map((point) => `${Math.round(point.x)} ${Math.round(point.y)}`).join(" L ")}`).join(" ");

const CURSOR = { horizontal: "cursor-ns-resize", vertical: "cursor-ew-resize", slanted: "cursor-move" } as const;
const GLYPH = { horizontal: "↕", vertical: "↔", slanted: "⤢" } as const;

export interface RouteDrag {
  key: string;
  points: PlanPoint[];
}

export const RouteLayer = memo(function RouteLayer({
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
  colorOf,
  focusId = null,
  hoverId = null,
  onPick,
  links,
  plate = false,
  inkOf,
}: {
  circuits: DisplayCircuit[];
  bus: DisplayCircuit | null;
  view: "color" | "cad";
  onPaper: boolean;
  unit: number;
  stroke: number;
  /** Fáze 74: úchyty úseků má jen vybraný okruh (`focusId`), ostatní trasy se nedají omylem posunout. */
  editable?: boolean;
  drag?: RouteDrag | null;
  /** Stisk úseku – tažení; dva stisky na stejném úseku = dvojklik (odskok) rozpozná editor. */
  onSegmentDown?: (event: ReactPointerEvent, circuit: DisplayCircuit, leg: DisplayLeg, index: number) => void;
  onReset?: (circuit: DisplayCircuit) => void;
  /** Fáze 74: barva okruhu (stejná v soupisu okruhů i na plátně). */
  colorOf?: (id: string, index: number) => string;
  /** Fáze 74: vybraný okruh (ostatní ztlumené) a okruh pod myší v soupisu (zvýraznění). */
  focusId?: string | null;
  hoverId?: string | null;
  /** Fáze 74: klik na trasu okruhu = výběr okruhu. */
  onPick?: (circuit: DisplayCircuit) => void;
  /** Fáze 75: odkaz okruhu (chytré PDF – trasa i štítek odkazují na řádek okruhu v rozcestníku dokumentace). */
  links?: Readonly<Record<string, string>>;
  /** Fáze 100: podkladové štítky popisků (plátno editoru; tiskový výkres je nemá). */
  plate?: boolean;
  /** Fáze 112: barva čáry okruhu v normovém zobrazení (tiskový výkres s barevnými druhy okruhů); jinak černě. */
  inkOf?: (circuit: DisplayCircuit) => string | null;
}) {
  const cad = view === "cad";
  const ink = onPaper ? "#111827" : "#e4e4e7";
  const halo = onPaper ? "#ffffff" : "#09090b";
  const legPoints = (leg: DisplayLeg) => (drag && drag.key === leg.key ? drag.points : leg.points);
  const all = bus ? [...circuits, bus] : circuits;
  const lead = focusId ?? hoverId;
  return (
    <g data-testid="route-layer" data-view={view} data-focus={focusId ?? undefined}>
      {all.map((circuit, index) => {
        const isBus = circuit.id === "bus";
        const runs = circuit.legs.map(legPoints);
        const color = isBus ? "#22c55e" : colorOf ? colorOf(circuit.id, index) : ROUTE_COLORS[index % ROUTE_COLORS.length];
        const offset = cad || isBus ? 0 : ((index % 7) - 3) * stroke * 2.4;
        const dashed = cad ? circuit.lowVoltage : isBus || circuit.routing === "TOP";
        const stretch = longestStretch(runs);
        const last = runs[runs.length - 1]?.[runs[runs.length - 1].length - 1];
        // Fáze 74: vybraný / zvýrazněný okruh silněji, ostatní ztlumené
        const strong = lead === circuit.id;
        const dim = lead !== null && !strong;
        const handles = editable && focusId === circuit.id;
        const link = links?.[circuit.id];
        const body = (
          <g key={circuit.id} transform={offset ? `translate(${offset} ${offset})` : undefined} opacity={dim ? 0.16 : 1} data-circuit={circuit.id} data-layer={circuit.layer} data-focused={focusId === circuit.id ? "true" : undefined} data-edited={circuit.edited ? "true" : undefined}>
            <g data-testid={isBus ? "bus-line" : "cable-route"} pointerEvents="none">
              {strong && !cad ? <path d={pathOf(runs)} fill="none" stroke={halo} strokeWidth={stroke * 9} strokeLinejoin="round" opacity={0.7} /> : null}
              <path
                d={pathOf(runs)}
                fill="none"
                stroke={cad ? (inkOf?.(circuit) ?? ink) : color}
                strokeWidth={(cad ? stroke * (circuit.lowVoltage ? 1.8 : 2.4) : stroke * (isBus ? 2.5 : 3.5)) * (strong ? 1.7 : 1)}
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
                      <text
                        x={label.x}
                        y={label.y}
                        fontSize={unit * 0.42}
                        fontWeight={700}
                        textAnchor="middle"
                        fill={plate ? "#f8fafc" : ink}
                        stroke={plate ? PLATE_STROKE : halo}
                        strokeWidth={plate ? unit * 0.24 : unit * 0.09}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                        data-testid="cable-tag"
                        data-plate={plate ? "true" : undefined}
                      >
                        {circuit.tag}
                        {circuit.edited ? " ✎" : ""}
                      </text>
                    );
                  })()}
                </>
              ) : null}
              {!cad && last && !isBus ? (
                <text x={last.x + unit * 0.6} y={last.y - unit * 0.6} fontSize={unit * 0.62} fill={color} fontWeight={700} {...(plate ? { stroke: PLATE_STROKE, strokeWidth: unit * 0.24, strokeLinejoin: "round" as const, paintOrder: "stroke" } : {})} data-testid="route-length">
                  {circuit.lengthM.toLocaleString("cs-CZ")} m{circuit.edited ? " ✎" : ""}
                </text>
              ) : null}
            </g>
            {/* Fáze 74: klik na trasu vybere okruh (vybraný okruh má místo toho úchyty úseků) */}
            {onPick && !handles && !isBus ? (
              <path
                d={pathOf(runs)}
                fill="none"
                stroke="transparent"
                strokeWidth={unit * 0.5}
                strokeLinejoin="round"
                pointerEvents="stroke"
                className="cursor-pointer"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  onPick(circuit);
                }}
                data-testid="route-pick"
              />
            ) : null}
            {/* Úchyty úseků pro ruční úpravu trasy */}
            {handles
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
        // Fáze 75: chytré PDF – celá trasa okruhu je odkaz na jeho řádek v rozcestníku dokumentace
        return link ? (
          <a key={circuit.id} href={link} data-testid="route-link">
            {body}
          </a>
        ) : (
          body
        );
      })}
    </g>
  );
});
