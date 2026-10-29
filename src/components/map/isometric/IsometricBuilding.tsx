"use client";

import { useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { formatCount } from "@/lib/format";
import { isoPoints, isoProject, isoRect, isoSlab } from "@/lib/isometric";
import { EQUIPMENT_STATUS } from "@/lib/status";
import type { FloorOverview } from "@/server/queries/building";

// Rozměry desky patra v jednotkách modelu (poměr 3:2 jako půdorys 1200×800).
const W = 300;
const D = 200;
const SLAB = 12;
const GAP = 150;
const GROUND_MARGIN = 55;
const LABEL_SPACE = 110;
const SLIDE = { x: 42, y: -6 };

const TOP = "#2a333d";
const TOP_HOVER = "#36424f";
const RIGHT = "#1a2027";
const FRONT = "#20272f";
const ACCENT = "#fac800";

/** Krátký popisek patra: „1. NP - Hlavní výroba“ → „1. NP“. */
export const floorShortName = (name: string) => name.split(" - ")[0];

interface Props {
  floors: FloorOverview[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  /** Klik na patro místo navigace (náhled ve Studiu). */
  onSelect?: (floorId: string) => void;
}

/** Level 2 – patra budovy jako naskládané izometrické desky; podzemí pod linií terénu. */
export function IsometricBuilding({ floors, hoveredId, onHover, onSelect }: Props) {
  const router = useRouter();

  const model = useMemo(() => {
    const slabs = floors.map((floor) => {
      const z = floor.level * GAP;
      const top = z + SLAB;
      return {
        floor,
        z,
        slab: isoSlab(W, D, z, SLAB),
        rooms: floor.rooms.map((room) => isoRect(room.x * W, room.y * D, room.w * W, room.h * D, top)),
        pins: floor.equipment.map((equipment) => ({ equipment, at: isoProject(equipment.x * W, equipment.y * D, top) })),
        label: isoProject(0, D, z + SLAB / 2),
      };
    });

    const ground = isoRect(-GROUND_MARGIN, -GROUND_MARGIN, W + 2 * GROUND_MARGIN, D + 2 * GROUND_MARGIN, 0);
    const levels = floors.map((floor) => floor.level);
    const maxZ = Math.max(0, ...levels) * GAP + SLAB;
    const minZ = Math.min(0, ...levels) * GAP;
    const minX = isoProject(-GROUND_MARGIN, D + GROUND_MARGIN, 0)[0] - LABEL_SPACE;
    const maxX = isoProject(W + GROUND_MARGIN, -GROUND_MARGIN, 0)[0] + SLIDE.x + 20;
    const minY = isoProject(0, 0, maxZ)[1] - 40;
    const maxY = isoProject(W + GROUND_MARGIN, D + GROUND_MARGIN, minZ)[1] + 30;
    return { slabs, ground, viewBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
  }, [floors]);

  const { viewBox } = model;
  const underground = model.slabs.filter(({ floor }) => floor.level < 0);
  const above = model.slabs.filter(({ floor }) => floor.level >= 0);
  // Vysunuté patro se kreslí navrch, aby ho nepřekrývala deska nad ním.
  const byHover = (list: typeof model.slabs) =>
    [...list].sort((a, b) => Number(a.floor.id === hoveredId) - Number(b.floor.id === hoveredId));

  const hovered = model.slabs.find(({ floor }) => floor.id === hoveredId);
  function open(floor: FloorOverview) {
    if (onSelect) onSelect(floor.id);
    else router.push(floor.href);
  }

  function onKeyDown(event: KeyboardEvent, floor: FloorOverview) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open(floor);
    }
  }

  function renderSlab({ floor, slab, rooms, pins, label }: (typeof model.slabs)[number]) {
    const isHovered = floor.id === hoveredId;
    const dimmed = hoveredId !== null && !isHovered;
    const edge = floor.worstStatus === "ACTIVE" ? "#5b6774" : EQUIPMENT_STATUS[floor.worstStatus].hex;
    return (
      <g
        key={floor.id}
        role="link"
        tabIndex={0}
        aria-label={`${floor.name}: ${floor.counts.total} zařízení`}
        className="cursor-pointer outline-none"
        style={{
          transform: isHovered ? `translate(${SLIDE.x}px, ${SLIDE.y}px)` : "translate(0, 0)",
          opacity: dimmed ? 0.45 : 1,
          transition: "transform 220ms ease-out, opacity 220ms",
        }}
        onClick={() => open(floor)}
        onKeyDown={(event) => onKeyDown(event, floor)}
        onMouseEnter={() => {
          onHover(floor.id);
          if (!onSelect) router.prefetch(floor.href);
        }}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(floor.id)}
        onBlur={() => onHover(null)}
      >
        <polygon points={isoPoints(slab.right)} fill={RIGHT} stroke="#3b4652" strokeWidth={0.8} />
        <polygon points={isoPoints(slab.front)} fill={FRONT} stroke="#3b4652" strokeWidth={0.8} />
        <polygon
          points={isoPoints(slab.top)}
          fill={isHovered ? TOP_HOVER : TOP}
          stroke={isHovered ? ACCENT : edge}
          strokeWidth={isHovered ? 2.5 : 1.5}
          strokeLinejoin="round"
        />
        {rooms.map((room, i) => (
          <polygon key={i} points={isoPoints(room)} fill="none" stroke="#94a3b8" strokeOpacity={0.28} strokeWidth={0.8} />
        ))}
        {pins.map(({ equipment, at: [x, y] }) => {
          const style = EQUIPMENT_STATUS[equipment.status];
          return (
            <g key={equipment.id} pointerEvents="none">
              {equipment.status === "PENDING_UPDATE" ? (
                <ellipse cx={x} cy={y} rx={9} ry={4.5} fill={style.hex} opacity={0.35} className="animate-pulse" />
              ) : null}
              <line x1={x} y1={y} x2={x} y2={y - 9} stroke={style.hex} strokeWidth={1.5} />
              <ellipse cx={x} cy={y - 10} rx={4.5} ry={4.5} fill={style.hex} stroke="#0b0f13" strokeWidth={1} />
            </g>
          );
        })}
        <text
          x={label[0] - 14}
          y={label[1] + 4}
          textAnchor="end"
          fontSize={14}
          fontWeight={700}
          fill={isHovered ? ACCENT : "#e2e8f0"}
          fontFamily="var(--font-geist-mono)"
        >
          {floorShortName(floor.name)}
        </text>
      </g>
    );
  }

  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${viewBox.w} / ${viewBox.h}`, maxWidth: `calc((100dvh - 10rem) * ${viewBox.w / viewBox.h})` }}>
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="absolute inset-0 size-full overflow-visible"
        role="group"
        aria-label="Výběr patra"
      >
        {byHover(underground).map(renderSlab)}

        {/* Terén ±0,000: podzemní podlaží leží pod ním */}
        <g pointerEvents="none" aria-hidden>
          <polygon points={isoPoints(model.ground)} fill="#14221a" fillOpacity={0.6} stroke="#4ade80" strokeOpacity={0.45} strokeDasharray="8 6" />
          <text
            x={model.ground[1][0] - 4}
            y={model.ground[1][1] + 18}
            textAnchor="end"
            fontSize={11}
            fill="#86efac"
            fillOpacity={0.7}
            fontFamily="var(--font-geist-mono)"
          >
            terén ±0,000
          </text>
        </g>

        {byHover(above).map(renderSlab)}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 w-56 rounded-lg border border-primary/60 bg-zinc-950/95 p-3 text-sm shadow-xl"
          role="tooltip"
        >
          <div className="font-semibold">{hovered.floor.name}</div>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div>{hovered.floor.counts.total} zařízení</div>
            {hovered.floor.counts.pending ? (
              <div className={EQUIPMENT_STATUS.PENDING_UPDATE.text}>
                {formatCount(hovered.floor.counts.pending, ["nahlášená změna", "nahlášené změny", "nahlášených změn"])}
              </div>
            ) : null}
            {hovered.floor.counts.waiting ? (
              <div className={EQUIPMENT_STATUS.WAITING_APPROVAL.text}>
                {formatCount(hovered.floor.counts.waiting, ["revize čeká", "revize čekají", "revizí čeká"])} na schválení
              </div>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-primary">Klikněte pro půdorys →</div>
        </div>
      ) : null}
    </div>
  );
}
