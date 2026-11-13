"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Move, Pencil, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { placementError, shiftRect } from "@/lib/building-edit";
import { polygonBounds, type CampusRect, type CampusSize } from "@/lib/campus-layout";
import { formatCount } from "@/lib/format";
import { bounds,offsetPoints, parsePercentPolygon, toSvgPoints } from "@/lib/map-geometry";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { moveBuildingAction } from "@/server/actions/buildings";
import type { BuildingOverview } from "@/server/queries/plant";

import { BuildingDeleteDialog, BuildingEditDialog } from "./BuildingDialogs";
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
  /** Fáze 108: právo Studia – lišta ✥ Posunout · ✏️ Upravit · 🗑️ Smazat u budovy a přesun tažením. */
  edit?: { plantId: string; campus: CampusSize } | null;
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
export function CampusMap({ plantCode, viewBox, buildings, hoveredId, onHover, highlight = null, edit = null }: Props) {
  const router = useRouter();
  const layout = getSiteLayout(plantCode, viewBox.height);
  const { width, height } = viewBox;
  // Fáze 108: přesun budovy tažením (obdélník v procentech mapy) a dialogy úpravy / smazání
  const svgRef = useRef<SVGSVGElement>(null);
  const [moving, setMoving] = useState<{ id: string; name: string; rect: CampusRect; origin: CampusRect; grab: { x: number; y: number } | null } | null>(null);
  const [dialog, setDialog] = useState<{ kind: "edit" | "delete"; building: BuildingOverview } | null>(null);
  const [saving, startSaving] = useTransition();
  const moveError = moving ? placementError(moving.rect, moving.id, buildings) : null;

  useEffect(() => {
    if (!moving) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoving(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moving]);

  /** Bod obrazovky → procenta mapy areálu. */
  function toPercent(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: (point.x / width) * 100, y: (point.y / height) * 100 };
  }

  function startMove(building: BuildingOverview) {
    const rect = polygonBounds(building.mapPolygon);
    setMoving({ id: building.id, name: building.name, rect, origin: rect, grab: null });
    toast.info(`✥ Přetáhněte budovu ${building.code} na volné místo · Esc = zrušit`);
  }

  function onMovePointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!moving) return;
    const point = toPercent(event);
    if (!point) return;
    if (event.type === "pointerdown") {
      const inside = point.x >= moving.rect.x && point.x <= moving.rect.x + moving.rect.w && point.y >= moving.rect.y && point.y <= moving.rect.y + moving.rect.h;
      if (!inside) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setMoving({ ...moving, grab: { x: point.x - moving.rect.x, y: point.y - moving.rect.y } });
      return;
    }
    if (!moving.grab) return;
    if (event.type === "pointermove") {
      const next = shiftRect(moving.rect, point.x - moving.grab.x - moving.rect.x, point.y - moving.grab.y - moving.rect.y);
      setMoving({ ...moving, rect: { ...next, x: Math.round(next.x * 2) / 2, y: Math.round(next.y * 2) / 2 } });
      return;
    }
    // pointerup – položení budovy: mimo areál / přes jinou halu se vrátí, jinak se poloha uloží
    const dropped = { ...moving, grab: null };
    const error = placementError(dropped.rect, dropped.id, buildings);
    if (error) {
      toast.error(error);
      setMoving({ ...dropped, rect: dropped.origin });
      return;
    }
    setMoving(dropped);
    startSaving(async () => {
      const result = await moveBuildingAction({ buildingId: dropped.id, rect: dropped.rect });
      if (!result.ok) {
        toast.error(result.error);
        setMoving({ ...dropped, rect: dropped.origin });
        return;
      }
      toast.success(`Budova ${dropped.name} přesunuta.`);
      setMoving(null);
      router.refresh();
    });
  }

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
    if (moving) return;
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
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("absolute inset-0 size-full", moving && "cursor-grab touch-none")}
        role="group"
        aria-label="Mapa areálu"
        fontFamily="var(--font-sans)"
        onPointerDown={onMovePointer}
        onPointerMove={onMovePointer}
        onPointerUp={onMovePointer}
        data-moving={moving ? moving.id : undefined}
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
              data-testid="campus-building"
              data-code={building.code}
              data-polygon={building.mapPolygon}
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

        {/* Fáze 108: přesouvaná budova – žlutý obrys na volném místě, červený přes jinou halu / mimo areál */}
        {moving ? (
          <rect
            x={(moving.rect.x / 100) * width}
            y={(moving.rect.y / 100) * height}
            width={(moving.rect.w / 100) * width}
            height={(moving.rect.h / 100) * height}
            fill={moveError ? "rgba(239,68,68,0.18)" : "rgba(250,200,0,0.16)"}
            stroke={moveError ? "#ef4444" : ACCENT}
            strokeWidth={4}
            strokeDasharray="14 8"
            className="cursor-grab"
            data-testid="building-move-ghost"
            data-error={moveError ? "true" : "false"}
          />
        ) : null}

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

      {/* Fáze 108: rychlá lišta budovy (najetí / fokus) – ✥ Posunout · ✏️ Upravit · 🗑️ Smazat */}
      {edit && !moving
        ? buildings.map((building) => {
            if (hoveredId !== building.id) return null;
            const box = polygonBounds(building.mapPolygon);
            return (
              <div
                key={`tools-${building.id}`}
                className="absolute z-10 flex -translate-x-full items-center gap-0.5 rounded-lg border border-primary/60 bg-zinc-950/95 p-0.5 shadow-xl"
                style={{ left: `${Math.min(100, box.x + box.w)}%`, top: `${box.y}%` }}
                onMouseEnter={() => onHover(building.id)}
                onMouseLeave={() => onHover(null)}
                data-testid="building-map-tools"
              >
                <button type="button" onClick={() => startMove(building)} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold hover:bg-muted" data-testid="building-map-move">
                  <Move className="size-3.5" aria-hidden /> Posunout
                </button>
                <button type="button" onClick={() => setDialog({ kind: "edit", building })} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold hover:bg-muted" data-testid="building-map-edit">
                  <Pencil className="size-3.5" aria-hidden /> Upravit
                </button>
                <button type="button" onClick={() => setDialog({ kind: "delete", building })} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/15" data-testid="building-map-delete">
                  <Trash2 className="size-3.5" aria-hidden /> Smazat
                </button>
              </div>
            );
          })
        : null}
      {moving ? (
        <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/60 bg-zinc-950/90 px-3 py-1.5 text-xs" role="status" data-testid="building-move-hint">
          {saving ? "Ukládám polohu…" : moveError ? `⚠️ ${moveError}` : `✥ Přetáhněte budovu „${moving.name}“ na volné místo a pusťte – poloha se uloží.`}
          <button type="button" onClick={() => setMoving(null)} className="rounded-md border border-border px-2 py-0.5 hover:bg-muted">
            Zrušit (Esc)
          </button>
        </div>
      ) : null}
      {dialog?.kind === "edit" && edit ? <BuildingEditDialog open onOpenChange={(open) => !open && setDialog(null)} building={dialog.building} campus={edit.campus} /> : null}
      {dialog?.kind === "delete" && edit ? <BuildingDeleteDialog open onOpenChange={(open) => !open && setDialog(null)} building={dialog.building} plantId={edit.plantId} /> : null}

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
