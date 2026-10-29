"use client";

import { useRef, useState, type PointerEvent } from "react";
import { TriangleAlert } from "lucide-react";

import { CampusSite } from "@/components/map/campus/CampusSite";
import { getSiteLayout } from "@/components/map/campus/site-layouts";
import { centerAt, moveRect, polygonBounds, rectsOverlap, resizeRect, type CampusRect, type CampusSize } from "@/lib/campus-layout";

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
  onChange?: (rect: CampusRect) => void;
  label: string;
  /** Zvýrazněná stávající budova (režim úprav). */
  highlightId?: string | null;
  newLabel?: string;
  /** Kód závodu (kulisy areálu); neznámý kód = čistý oplocený pozemek s vrátnicí. */
  plantCode?: string;
  /** Rozměr pozemku v metrech (popisek a měřítko). */
  campus?: CampusSize;
}

// SVG v jednotkách 1000 × 700 (jako mapa areálu); data budov jsou v procentech.
const W = 1000;
const H = 700;

/** Velká mapa areálu: novou budovu lze umístit kliknutím, posunout tažením a zvětšit úchytem. */
export function CampusPlacementMap({ buildings, rect, onChange, label, highlightId = null, newLabel = "Nová budova", plantCode = "", campus }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: "move" | "resize"; x: number; y: number; start: CampusRect } | null>(null);
  const overlaps = rect ? buildings.filter((building) => rectsOverlap(rect, polygonBounds(building.mapPolygon))) : [];

  const percentOf = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 };
  };

  function start(kind: "move" | "resize", event: PointerEvent) {
    if (!rect || !onChange) return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const point = percentOf(event);
    setDrag({ kind, x: point.x, y: point.y, start: rect });
  }

  function move(event: PointerEvent) {
    if (!drag || !onChange) return;
    const point = percentOf(event);
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    onChange(drag.kind === "move" ? moveRect(drag.start, dx, dy) : resizeRect(drag.start, dx, dy));
  }

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-xl border border-border bg-[#0b1220] select-none"
        role="application"
        aria-label={label}
        data-testid="campus-map"
        onPointerDown={(event) => {
          if (!rect || !onChange || event.button !== 0) return;
          const point = percentOf(event);
          onChange(centerAt(rect, point.x, point.y));
        }}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <pattern id="campus-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" fill="none" stroke="#111c30" strokeWidth="1" />
          </pattern>
        </defs>
        <CampusSite layout={getSiteLayout(plantCode)} width={W} height={H} widthM={campus?.width} />
        <rect width={W} height={H} fill="url(#campus-grid)" opacity={0.6} pointerEvents="none" />
        {campus ? (
          <text x={40} y={28} fontSize={16} fontWeight={600} fill="#94a3b8" data-testid="campus-size">
            Areál {campus.width} × {campus.height} m
          </text>
        ) : null}
        {buildings.map((building) => {
          const highlighted = building.id === highlightId;
          const overlapping = overlaps.some((entry) => entry.id === building.id);
          return (
            <g key={building.id}>
              <polygon
                points={building.mapPolygon
                  .split(" ")
                  .map((pair) => {
                    const [x, y] = pair.split(",").map(Number);
                    return `${(x / 100) * W},${(y / 100) * H}`;
                  })
                  .join(" ")}
                fill={highlighted ? "rgba(250,204,21,0.25)" : "#1f2937"}
                stroke={overlapping ? "#ef4444" : highlighted ? "#facc15" : "#475569"}
                strokeWidth={overlapping || highlighted ? 4 : 2}
              />
              <text x={(building.labelX / 100) * W} y={(building.labelY / 100) * H} textAnchor="middle" fontSize={20} fill="#cbd5e1" fontWeight={600}>
                {building.name.split(" - ")[0]}
              </text>
            </g>
          );
        })}
        {rect ? (
          <g data-testid="campus-new-building">
            <rect
              x={(rect.x / 100) * W}
              y={(rect.y / 100) * H}
              width={(rect.w / 100) * W}
              height={(rect.h / 100) * H}
              fill={overlaps.length ? "rgba(239,68,68,0.25)" : "rgba(250,204,21,0.3)"}
              stroke={overlaps.length ? "#ef4444" : "#facc15"}
              strokeWidth={4}
              className={onChange ? "cursor-move" : undefined}
              onPointerDown={(event) => start("move", event)}
            />
            <text x={((rect.x + rect.w / 2) / 100) * W} y={((rect.y + rect.h / 2) / 100) * H + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill="#fde68a" pointerEvents="none">
              {newLabel}
            </text>
            {onChange ? (
              <rect
                x={((rect.x + rect.w) / 100) * W - 14}
                y={((rect.y + rect.h) / 100) * H - 14}
                width={22}
                height={22}
                rx={4}
                fill="#facc15"
                stroke="#09090b"
                strokeWidth={2}
                className="cursor-nwse-resize"
                onPointerDown={(event) => start("resize", event)}
                data-testid="campus-resize-handle"
                aria-label="Změnit velikost budovy"
              />
            ) : null}
          </g>
        ) : null}
      </svg>
      {overlaps.length ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="status" data-testid="campus-overlap">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Budova se překrývá s: {overlaps.map((building) => building.name).join(", ")} – posuňte ji tažením na volné místo.
        </p>
      ) : rect && onChange ? (
        <p className="text-xs text-muted-foreground">Klikněte do mapy pro umístění, táhněte budovu pro posun a žlutý úchyt vpravo dole pro změnu velikosti.</p>
      ) : null}
    </div>
  );
}
