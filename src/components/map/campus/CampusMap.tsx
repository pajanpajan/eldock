"use client";

import { useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";

import { formatCount } from "@/lib/format";
import { bounds,offsetPoints, parsePercentPolygon, toSvgPoints } from "@/lib/map-geometry";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BuildingOverview } from "@/server/queries/plant";

import { CampusSite } from "./CampusSite";
import { getSiteLayout } from "./site-layouts";

interface Props {
  plantCode: string;
  viewBox: { width: number; height: number };
  buildings: BuildingOverview[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  /** Fáze 93: zvýraznění budov větve zálohování (barva úrovně) a páteřních tras mezi budovami. */
  highlight?: { ids: ReadonlySet<string>; color: string; routes: { from: string; to: string }[] } | null;
}

const ROOF = "#27303a";
const ROOF_HOVER = "#36424f";
const EDGE = "#5b6774";
const ACCENT = "#fac800";

/** Popis budovy pro čtečky: „Hala A - Lisovna: 8 zařízení, 1 nahlášená změna“. */
function describeBuilding({ name, counts }: BuildingOverview): string {
  const parts = [`${counts.total} zařízení`];
  if (counts.pending) parts.push(formatCount(counts.pending, ["nahlášená změna", "nahlášené změny", "nahlášených změn"]));
  if (counts.waiting) parts.push(formatCount(counts.waiting, ["revize čeká", "revize čekají", "revizí čeká"]) + " na schválení");
  return `${name}: ${parts.join(", ")}`;
}

/** Level 1 – SVG mapa areálu s klikacími budovami a štítky. */
export function CampusMap({ plantCode, viewBox, buildings, hoveredId, onHover, highlight = null }: Props) {
  const router = useRouter();
  const layout = getSiteLayout(plantCode, viewBox.height);
  const { width, height } = viewBox;

  const shapes = useMemo(
    () =>
      buildings.map((building) => {
        const points = parsePercentPolygon(building.mapPolygon, width, height);
        // Výškový stín: vícepodlažní budovy vrhají delší stín.
        const aboveGround = building.floors.filter((floor) => floor.level >= 0).length;
        const lift = 6 + aboveGround * 5;
        return {
          building,
          points: toSvgPoints(points),
          shadow: toSvgPoints(offsetPoints(points, lift, lift * 1.2)),
          box: bounds(points),
        };
      }),
    [buildings, width, height],
  );

  function open(href: string) {
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent, href: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open(href);
    }
  }

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-xl border border-border"
      // Celá mapa se vejde na výšku okna (pod lištu).
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: `calc((100dvh - 8rem) * ${width / height})` }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 size-full"
        role="group"
        aria-label="Mapa areálu"
        fontFamily="var(--font-sans)"
      >
        <defs>
          <pattern id="roof-ribs" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0H10" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
        </defs>

        <CampusSite layout={layout} width={width} height={height} />

        {shapes.map(({ shadow, building }) => (
          <polygon key={`s-${building.id}`} points={shadow} fill="#000" opacity={0.55} aria-hidden />
        ))}

        {shapes.map(({ building, points, box }) => {
          const hovered = hoveredId === building.id;
          const status = building.worstStatus;
          // Fáze 93: budova ve větvi zálohování barvou úrovně, ostatní ztlumené
          const marked = highlight?.ids.has(building.id) ?? false;
          const statusStroke = marked && highlight ? highlight.color : status === "ACTIVE" ? EDGE : EQUIPMENT_STATUS[status].hex;
          return (
            <g
              key={building.id}
              role="link"
              tabIndex={0}
              aria-label={describeBuilding(building)}
              className="cursor-pointer outline-none"
              opacity={highlight && !marked ? 0.35 : 1}
              data-backup={marked ? "on" : undefined}
              onClick={() => open(building.href)}
              onKeyDown={(event) => onKeyDown(event, building.href)}
              onMouseEnter={() => {
                onHover(building.id);
                router.prefetch(building.href);
              }}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(building.id)}
              onBlur={() => onHover(null)}
            >
              <polygon
                points={points}
                fill={hovered ? ROOF_HOVER : ROOF}
                stroke={hovered ? ACCENT : statusStroke}
                strokeWidth={hovered ? 3 : marked ? 4 : status === "ACTIVE" ? 1.5 : 2.5}
                strokeLinejoin="round"
                style={{ transition: "fill 150ms, stroke 150ms" }}
              />
              <polygon points={points} fill="url(#roof-ribs)" pointerEvents="none" />
              {/* Světlíky na střeše */}
              {box.width > 150 && box.height > 100 ? (
                <g pointerEvents="none" fill="#1c232b" stroke="#3b4652" strokeWidth={0.8}>
                  {Array.from({ length: Math.floor(box.width / 90) }, (_, i) => (
                    <rect
                      key={i}
                      x={box.x + 30 + i * 90}
                      y={box.y + 16}
                      width={50}
                      height={12}
                      rx={2}
                    />
                  ))}
                </g>
              ) : null}
            </g>
          );
        })}

        {/* Fáze 93: páteřní trasy zálohované větve mezi budovami (od zdroje k rozváděčům) */}
        {highlight?.routes.map((route, index) => {
          const from = buildings.find((building) => building.id === route.from);
          const to = buildings.find((building) => building.id === route.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${route.from}-${route.to}-${index}`}
              x1={(from.labelX / 100) * width}
              y1={(from.labelY / 100) * height}
              x2={(to.labelX / 100) * width}
              y2={(to.labelY / 100) * height}
              stroke={highlight.color}
              strokeWidth={5}
              strokeDasharray="14 8"
              strokeLinecap="round"
              opacity={0.9}
              pointerEvents="none"
              data-testid="backup-route"
            />
          );
        })}
      </svg>

      {/* Štítky budov (HTML nad SVG; pozice v procentech viewBoxu) */}
      {buildings.map((building) => {
        const hovered = hoveredId === building.id;
        return (
          <div
            key={building.id}
            aria-hidden
            onClick={() => open(building.href)}
            onMouseEnter={() => onHover(building.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1 rounded-lg border bg-zinc-950/85 px-2 py-1 text-xs shadow-lg backdrop-blur-sm transition-colors sm:px-2.5 sm:py-1.5",
              hovered ? "border-primary" : "border-border",
            )}
            style={{ left: `${building.labelX}%`, top: `${building.labelY}%` }}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="rounded bg-primary px-1 font-mono text-[11px] font-bold text-primary-foreground">{building.code}</span>
              <span className="hidden font-medium sm:inline">{building.shortName ?? building.name}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Wrench className="size-3" />
                {building.counts.total}
              </span>
              {building.counts.pending ? (
                <span className={cn("flex items-center gap-0.5 rounded-full border px-1.5", EQUIPMENT_STATUS.PENDING_UPDATE.badge)}>
                  {building.counts.pending}
                </span>
              ) : null}
              {building.counts.waiting ? (
                <span className={cn("flex items-center gap-0.5 rounded-full border px-1.5", EQUIPMENT_STATUS.WAITING_APPROVAL.badge)}>
                  {building.counts.waiting}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
