"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, RotateCcw, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toWorld } from "@/lib/panel-builder/fixtures";
import { analyzeDraft, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { backgroundTransform, type FloorplanBackground } from "@/lib/panel-builder/floorplan-pdf";
import {
  DEFAULT_ISO,
  HEIGHT_LEVELS,
  HEIGHT_PRESETS,
  INSTALL_ZONES,
  WALL_SIDES,
  buildScene,
  cableRuns3D,
  elevationOf,
  elevationOfArea,
  emptyElevation,
  heightIssues,
  inferWalls,
  isoFloorMatrix,
  isoProject,
  roomWallSegments,
  sceneExtent,
  virtualRooms,
  wallRunZ,
  CABLE_COLORS,
  type CableCircuitLike,
  type CableRun3D,
  type Elevation,
  type IsoView,
  type PlanExtent,
  type SceneKind,
  type WallSegment,
  type WallSide,
} from "@/lib/panel-builder/pseudo3d";
import { displayRoutes } from "@/lib/panel-builder/route-display";
import { cn } from "@/lib/utils";

/**
 * Fáze 109: barvy a tvary prvků jasně odlišené – zásuvka modrý kroužek se svodem k podlaze, vypínač zelený kosočtverec
 * (ne oranžová – splývala se světly), svítidlo žluté se září a paprsky, rozváděč purpurová skříň, ovladač / čidlo
 * tyrkysový trojúhelník, spotřebič korálový.
 */
const KIND_COLOR: Record<SceneKind, string> = { socket: "#38bdf8", switch: "#10b981", light: "#fde047", board: "#d946ef", control: "#06b6d4", appliance: "#f43f5e", other: "#a1a1aa" };
const KIND_LABEL: Record<SceneKind, string> = { socket: "zásuvka", switch: "vypínač", light: "svítidlo", board: "rozváděč", control: "ovladač / čidlo / magnet", appliance: "spotřebič", other: "prvek" };
const KIND_EMOJI: Record<SceneKind, string> = { socket: "🔵", switch: "🟢", light: "🟡", board: "🟣", control: "🩵", appliance: "🔴", other: "⚫" };
/** Poloprůhledné stěny do výšky stropu (~20 %) a jejich hrany. */
const WALL_FILL = "rgba(148, 163, 184, 0.20)";
const WALL_EDGE = "rgba(226, 232, 240, 0.55)";
const FURNITURE_FILL = "rgba(255, 255, 255, 0.14)";

/** Značka prvku v izometrii podle druhu (v souřadnicích obrazovky, `u` = jednotka velikosti). */
function ElementMarker({ kind, u, selected }: { kind: SceneKind; u: number; selected: boolean }) {
  const color = KIND_COLOR[kind];
  const scale = selected ? 1.35 : 1;
  const outline = selected ? "#ffffff" : "#0b1220";
  const s = u * scale;
  switch (kind) {
    case "socket":
      return <circle r={s * 0.8} fill="#0b1220" stroke={color} strokeWidth={s * 0.38} />;
    case "switch":
      return <rect x={-s * 0.6} y={-s * 0.6} width={s * 1.2} height={s * 1.2} transform="rotate(45)" fill={color} stroke="#ffffff" strokeWidth={s * (selected ? 0.3 : 0.18)} />;
    case "light":
      return (
        <g>
          <circle r={s * 2} fill="url(#pseudo3d-light-glow)" />
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index * Math.PI) / 4;
            return <line key={index} x1={Math.cos(angle) * s * 1} y1={Math.sin(angle) * s * 1} x2={Math.cos(angle) * s * 1.6} y2={Math.sin(angle) * s * 1.6} stroke={color} strokeWidth={s * 0.16} strokeLinecap="round" />;
          })}
          <circle r={s * 0.7} fill={color} stroke={outline} strokeWidth={s * 0.15} />
        </g>
      );
    case "board":
      return (
        <g>
          <polygon points={`${-s * 0.9},${-s * 1.1} ${-s * 0.5},${-s * 1.45} ${s * 1.1},${-s * 1.45} ${s * 0.7},${-s * 1.1}`} fill={color} fillOpacity={0.6} stroke={outline} strokeWidth={s * 0.1} />
          <polygon points={`${s * 0.7},${-s * 1.1} ${s * 1.1},${-s * 1.45} ${s * 1.1},${s * 0.85} ${s * 0.7},${s * 1.2}`} fill={color} fillOpacity={0.45} stroke={outline} strokeWidth={s * 0.1} />
          <rect x={-s * 0.9} y={-s * 1.1} width={s * 1.6} height={s * 2.3} fill={color} stroke={selected ? "#ffffff" : "#fdf4ff"} strokeWidth={s * 0.14} />
        </g>
      );
    case "control":
      return <polygon points={`0,${-s * 0.95} ${s * 0.85},${s * 0.6} ${-s * 0.85},${s * 0.6}`} fill={color} stroke={selected ? "#ffffff" : "#ecfeff"} strokeWidth={s * 0.14} strokeLinejoin="round" />;
    case "appliance":
      return <rect x={-s * 0.7} y={-s * 0.7} width={s * 1.4} height={s * 1.4} rx={s * 0.3} fill={color} stroke={outline} strokeWidth={s * 0.16} />;
    default:
      return <circle r={s * 0.6} fill={color} stroke={outline} strokeWidth={s * 0.15} />;
  }
}

/** „Kuchyňská linka (0,60 m)“ → „Kuchyňská linka“ (popisek kvádru nábytku). */
const furnitureName = (label: string) => label.replace(/\s*\(.*\)\s*$/, "");

type Pt = { x: number; y: number };
const polygon = (points: readonly Pt[]) => points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

/** Výška prvku – číslo v mm a rychlé hodnoty. */
function HeightEditor({ label, value, onChange }: { label: string; value: number; onChange: (heightMm: number) => void }) {
  const [text, setText] = useState(String(Math.round(value)));
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 p-2 text-xs" data-testid="pseudo3d-height">
      <b className="mr-1">{label}</b>
      <label className="flex items-center gap-1">
        výška
        <input
          type="number"
          min={0}
          max={3000}
          step={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && Number.isFinite(Number(text))) onChange(Number(text));
          }}
          className="h-7 w-20 rounded border border-input bg-transparent px-1 text-right"
          data-testid="pseudo3d-height-input"
        />
        mm
      </label>
      <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => Number.isFinite(Number(text)) && onChange(Number(text))} data-testid="pseudo3d-height-apply">
        Nastavit
      </Button>
      {HEIGHT_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => {
            setText(String(preset));
            onChange(preset);
          }}
          className="rounded border border-border px-1.5 py-0.5 hover:bg-muted"
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

/** Fáze 110: PDF / obrázkový podklad na podlaze 3D náhledu (list podkladu v mm půdorysu). */
export interface FloorUnderlay {
  background: FloorplanBackground;
  mmPerPx: number;
  sheet: PlanExtent;
}

/**
 * Režim A: izometrický pohled na celý půdorys (otáčení po 90° / 15°, náklon). Fáze 110: stěny z jednotných úseček
 * (obdélníkové i mnohoúhelníkové místnosti, bez místností odvozené obvodové stěny a příčky), střed a výřez ze všech
 * místností, prvků, nábytku, otvorů a listu podkladu, PDF podklad s mřížkou na podlaze a 3D trasy kabelů.
 */
export function IsoView3D({
  draft,
  view,
  selectedId,
  onSelect,
  walls: wallSegments,
  floor = null,
  cables = null,
}: {
  draft: FloorplanDraft;
  view: IsoView;
  selectedId: string | null;
  onSelect: (id: string) => void;
  walls: readonly WallSegment[];
  floor?: FloorUnderlay | null;
  cables?: readonly CableRun3D[] | null;
}) {
  const scene = useMemo(() => buildScene(draft), [draft]);
  const extent = sceneExtent(scene, floor?.sheet ?? null);
  const center = { x: (extent.minX + extent.maxX) / 2, y: (extent.minY + extent.maxY) / 2 };
  const project = (point: { x: number; y: number; z?: number }) => isoProject(point, view, center);
  const H = scene.ceilingMm;
  // Stěny (svislé čtyřúhelníky od podlahy do stropu), vzdálenější dřív
  const walls = wallSegments.map((segment, index) => {
    const quad = [project({ ...segment.a, z: 0 }), project({ ...segment.b, z: 0 }), project({ ...segment.b, z: H }), project({ ...segment.a, z: H })];
    return { key: `${segment.kind}-${index}`, kind: segment.kind, quad, depth: (quad[0].depth + quad[1].depth) / 2 };
  });
  walls.sort((a, b) => a.depth - b.depth);
  const runs = (cables ?? []).map((run) => ({ ...run, projected: run.points.map((point) => project(point)) }));
  const sheetCorners = floor
    ? [
        { x: floor.sheet.minX, y: floor.sheet.minY },
        { x: floor.sheet.maxX, y: floor.sheet.minY },
        { x: floor.sheet.maxX, y: floor.sheet.maxY },
        { x: floor.sheet.minX, y: floor.sheet.maxY },
      ]
    : [];
  const gridStep = floor ? (Math.max(floor.sheet.maxX - floor.sheet.minX, floor.sheet.maxY - floor.sheet.minY) > 30_000 ? 2000 : 1000) : 1000;
  const furniture = scene.furniture.map((entry) => {
    const bottom = entry.geometry.corners.map((corner) => project({ ...corner, z: 0 }));
    const top = entry.geometry.corners.map((corner) => project({ ...corner, z: entry.height }));
    const sides = bottom.map((point, index) => {
      const next = (index + 1) % bottom.length;
      return { quad: [point, bottom[next], top[next], top[index]], depth: (point.depth + bottom[next].depth) / 2 };
    });
    sides.sort((a, b) => a.depth - b.depth);
    const center = top.reduce((sum, point) => ({ x: sum.x + point.x / top.length, y: sum.y + point.y / top.length }), { x: 0, y: 0 });
    return { id: entry.id, label: entry.label, height: entry.height, center, top, sides, depth: top.reduce((sum, point) => sum + point.depth, 0) / top.length };
  });
  furniture.sort((a, b) => a.depth - b.depth);
  const openings = scene.openings.map((opening) => {
    const a = toWorld(opening.geometry, -opening.geometry.w / 2, 0);
    const b = toWorld(opening.geometry, opening.geometry.w / 2, 0);
    const quad = [project({ ...a, z: opening.sill }), project({ ...b, z: opening.sill }), project({ ...b, z: opening.sill + opening.height }), project({ ...a, z: opening.sill + opening.height })];
    return { id: opening.id, door: opening.type.startsWith("door"), quad };
  });
  const elements = scene.elements
    .map((element) => ({ element, at: project(element), foot: project({ ...element, z: element.kind === "socket" || element.kind === "appliance" ? 0 : H }) }))
    .sort((a, b) => a.at.depth - b.at.depth);
  const all = [
    ...walls.flatMap((wall) => wall.quad),
    ...elements.map((entry) => entry.at),
    ...scene.rooms.flatMap((room) => room.polygon.map((point) => project({ ...point, z: 0 }))),
    ...furniture.flatMap((entry) => entry.top),
    ...openings.flatMap((opening) => opening.quad),
    ...sheetCorners.map((corner) => project({ ...corner, z: 0 })),
    ...runs.flatMap((run) => run.projected),
  ];
  const minX = Math.min(...all.map((point) => point.x), 0) - 400;
  const maxX = Math.max(...all.map((point) => point.x), 1) + 400;
  const minY = Math.min(...all.map((point) => point.y), 0) - 400;
  const maxY = Math.max(...all.map((point) => point.y), 1) + 400;
  const unit = Math.max(maxX - minX, maxY - minY) / 120;
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-[58vh] w-full rounded-xl bg-zinc-950" role="img" aria-label="Izometrický 3D náhled půdorysu" data-testid="pseudo3d-iso" data-ceiling={H} data-rotation={view.rotation} data-walls={walls.length}>
      {/* Fáze 110: PDF podklad na podlaze (z = 0) s obrysem listu a jemnou mřížkou – orientace podle čar výkresu */}
      {floor ? (
        <g transform={`matrix(${isoFloorMatrix(view, center).map((value) => value.toFixed(6)).join(" ")})`} pointerEvents="none" data-testid="pseudo3d-floor-pdf">
          <rect x={floor.sheet.minX} y={floor.sheet.minY} width={floor.sheet.maxX - floor.sheet.minX} height={floor.sheet.maxY - floor.sheet.minY} fill="#0f172a" stroke="#64748b" strokeWidth={40} />
          <g transform={backgroundTransform(floor.background, floor.mmPerPx)}>
            <image href={floor.background.url} width={floor.background.widthPx} height={floor.background.heightPx} preserveAspectRatio="none" opacity={0.55} style={{ filter: "invert(1) hue-rotate(180deg)" }} />
          </g>
          <g stroke="#94a3b8" strokeOpacity={0.18} strokeWidth={14}>
            {Array.from({ length: Math.floor((floor.sheet.maxX - floor.sheet.minX) / gridStep) + 1 }, (_, index) => floor.sheet.minX + index * gridStep).map((x) => (
              <line key={`gx${x}`} x1={x} y1={floor.sheet.minY} x2={x} y2={floor.sheet.maxY} />
            ))}
            {Array.from({ length: Math.floor((floor.sheet.maxY - floor.sheet.minY) / gridStep) + 1 }, (_, index) => floor.sheet.minY + index * gridStep).map((y) => (
              <line key={`gy${y}`} x1={floor.sheet.minX} y1={y} x2={floor.sheet.maxX} y2={y} />
            ))}
          </g>
        </g>
      ) : null}
      {scene.rooms.map((room) => (
        <polygon key={room.id} points={polygon(room.polygon.map((point) => project({ ...point, z: 0 })))} fill="#27272a" fillOpacity={floor ? 0.3 : 1} stroke="#52525b" strokeWidth={unit * 0.15} />
      ))}
      <defs>
        <radialGradient id="pseudo3d-light-glow">
          <stop offset="0%" stopColor="#fde047" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#fde047" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Fáze 109: název místnosti na podlaze */}
      {scene.rooms.map((room) => {
        const floor = room.polygon.map((point) => project({ ...point, z: 0 }));
        const center = floor.reduce((sum, point) => ({ x: sum.x + point.x / floor.length, y: sum.y + point.y / floor.length }), { x: 0, y: 0 });
        return room.name ? (
          <text key={`label-${room.id}`} x={center.x} y={center.y} fontSize={unit * 1.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#e2e8f0" fillOpacity={0.85} pointerEvents="none" data-testid="pseudo3d-room-label">
            {room.name}
          </text>
        ) : null;
      })}
      {furniture.map((entry) => (
        <g key={entry.id} data-testid="pseudo3d-furniture">
          {entry.sides.map((side, index) => (
            <polygon key={index} points={polygon(side.quad)} fill={FURNITURE_FILL} stroke="rgba(255,255,255,0.35)" strokeWidth={unit * 0.08} />
          ))}
          <polygon points={polygon(entry.top)} fill={FURNITURE_FILL} stroke="rgba(255,255,255,0.5)" strokeWidth={unit * 0.08}>
            <title>{entry.label}</title>
          </polygon>
          <text x={entry.center.x} y={entry.center.y} fontSize={unit * 0.95} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill="#f8fafc" stroke="rgba(9,13,22,0.9)" strokeWidth={unit * 0.25} paintOrder="stroke" pointerEvents="none" data-testid="pseudo3d-furniture-label">
            {furnitureName(entry.label)} {entry.height} mm
          </text>
        </g>
      ))}
      {/* Fáze 109: poloprůhledné stěny (~20 %) od podlahy do výšky stropu s hranami u podlahy, v rozích a u stropu */}
      {walls.map((wall) => (
        <polygon key={wall.key} points={polygon(wall.quad)} fill={WALL_FILL} stroke={WALL_EDGE} strokeWidth={unit * 0.14} strokeLinejoin="round" data-testid="pseudo3d-wall-face" data-kind={wall.kind} />
      ))}
      {/* Průhledné otvory: okna (parapet 900 → 2300 mm) a dveře (0 → 2000 mm) jen obrysem */}
      {openings.map((opening) => (
        <polygon key={opening.id} points={polygon(opening.quad)} fill={opening.door ? "rgba(251,191,36,0.05)" : "rgba(125,211,252,0.08)"} stroke={opening.door ? "#fbbf24" : "#7dd3fc"} strokeWidth={unit * 0.16} data-kind={opening.door ? "door" : "window"} data-testid="pseudo3d-opening" />
      ))}
      {/* Fáze 110: 🔌 3D trasy kabelů – vodorovně po podlaze / pod stropem a svislé svody po stěně do výšky prvku */}
      {runs.map((run) => (
        <polyline
          key={run.id}
          points={polygon(run.projected)}
          fill="none"
          stroke={run.color}
          strokeOpacity={0.9}
          strokeWidth={unit * 0.16}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
          data-testid="pseudo3d-cable"
          data-layer={run.layer}
          data-routing={run.routing}
        />
      ))}
      {elements.map(({ element, at, foot }) => (
        <g key={element.id} onClick={() => onSelect(element.id)} className="cursor-pointer" data-testid="pseudo3d-element" data-id={element.id} data-z={Math.round(element.z)}>
          {/* Svislý svod: zásuvky od podlahy, vypínače a ostatní ze stropu */}
          {element.kind !== "light" ? <line x1={foot.x} y1={foot.y} x2={at.x} y2={at.y} stroke={KIND_COLOR[element.kind]} strokeOpacity={0.7} strokeWidth={unit * 0.14} strokeDasharray={`${unit * 0.5} ${unit * 0.3}`} /> : null}
          <g transform={`translate(${at.x} ${at.y})`} data-kind={element.kind} data-color={KIND_COLOR[element.kind]}>
            <ElementMarker kind={element.kind} u={unit * 0.75} selected={selectedId === element.id} />
          </g>
          <title>{`${element.label} · ${Math.round(element.z)} mm`}</title>
        </g>
      ))}
    </svg>
  );
}

/**
 * Režim B: rozvinutý pohled na stěnu s pravítkem výšek; výška prvku tažením nebo číslem. Fáze 110: stěna nakreslené
 * místnosti i virtuální místnosti (celý půdorys na PDF podkladu, zóna z prvků), kabelové trasy v instalačních zónách.
 */
export function WallView({
  elevation,
  selectedId,
  onSelect,
  onHeight,
  cables = null,
  hint = null,
}: {
  elevation: Elevation | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHeight: (id: string, heightMm: number) => void;
  cables?: readonly CableCircuitLike[] | null;
  hint?: string | null;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; z: number } | null>(null);
  if (!elevation) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Na této straně místnost nemá stěnu – zvolte jinou stranu.</p>;
  const H = elevation.ceilingMm;
  const W = elevation.lengthMm;
  const margin = 420;
  const zAt = (event: ReactPointerEvent) => {
    const box = svg.current?.getScreenCTM();
    if (!box) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(box.inverse());
    return Math.round(Math.min(H, Math.max(0, H - point.y)) / 10) * 10;
  };
  return (
    <svg
      ref={svg}
      viewBox={`${-margin} ${-120} ${W + margin + 200} ${H + 320}`}
      className="h-[58vh] w-full rounded-xl bg-zinc-950 touch-none"
      role="img"
      aria-label="Pohled na stěnu místnosti s pravítkem výšek"
      data-testid="pseudo3d-wall"
      onPointerMove={(event) => {
        if (!drag) return;
        const z = zAt(event);
        if (z !== null) setDrag({ ...drag, z });
      }}
      onPointerUp={() => {
        if (drag) onHeight(drag.id, drag.z);
        setDrag(null);
      }}
    >
      {/* Stěna, podlaha a strop */}
      <rect x={0} y={0} width={W} height={H} fill="#18181b" stroke="#a1a1aa" strokeWidth={8} />
      {/* Pravítko 0–strop (po 100 mm, popisky po 500 mm) */}
      {Array.from({ length: Math.floor(H / 100) + 1 }, (_, index) => index * 100).map((mm) => (
        <g key={mm}>
          <line x1={-80} x2={mm % 500 === 0 ? -20 : -50} y1={H - mm} y2={H - mm} stroke="#71717a" strokeWidth={mm % 500 === 0 ? 6 : 3} />
          {mm % 500 === 0 ? (
            <text x={-100} y={H - mm + 22} fontSize={64} fill="#a1a1aa" textAnchor="end">
              {mm}
            </text>
          ) : null}
        </g>
      ))}
      {/* Hladiny: zásuvky 300, linka 900, nad linkou 1150, vypínače 1200, termostaty / RH 1500 */}
      {HEIGHT_LEVELS.map((level) => (
        <g key={level.mm}>
          <line x1={0} x2={W} y1={H - level.mm} y2={H - level.mm} stroke="#38bdf8" strokeOpacity={0.35} strokeWidth={4} strokeDasharray="30 20" />
          <text x={W + 20} y={H - level.mm + 18} fontSize={52} fill="#7dd3fc" fillOpacity={0.8}>
            {level.mm}
          </text>
        </g>
      ))}
      {elevation.furniture.map((entry) => (
        <rect key={entry.id} x={entry.along - entry.width / 2} y={H - entry.height} width={entry.width} height={entry.height} fill="#78716c" fillOpacity={0.45} stroke="#a8a29e" strokeWidth={6}>
          <title>{entry.label}</title>
        </rect>
      ))}
      {elevation.openings.map((opening) => (
        <rect key={opening.id} x={opening.along - opening.width / 2} y={H - opening.sill - opening.height} width={opening.width} height={opening.height} fill={opening.type.startsWith("door") ? "#92400e" : "#7dd3fc"} fillOpacity={0.35} stroke={opening.type.startsWith("door") ? "#d97706" : "#38bdf8"} strokeWidth={8} />
      ))}
      {/* Fáze 110: 🔌 vedení kabelů na stěně – instalační zóny (ČSN 33 2130 ed. 4), vodorovně v zóně a svisle k prvkům */}
      {cables ? (
        <g pointerEvents="none" data-testid="pseudo3d-wall-cables">
          <rect x={0} y={INSTALL_ZONES.top.from} width={W} height={INSTALL_ZONES.top.to - INSTALL_ZONES.top.from} fill="#38bdf8" fillOpacity={0.06} />
          <rect x={0} y={H - INSTALL_ZONES.bottom.to} width={W} height={INSTALL_ZONES.bottom.to - INSTALL_ZONES.bottom.from} fill="#38bdf8" fillOpacity={0.06} />
          <text x={20} y={INSTALL_ZONES.top.from + 70} fontSize={56} fill="#7dd3fc" fillOpacity={0.75}>
            instalační zóna pod stropem (ČSN 33 2130 ed. 4)
          </text>
          <text x={20} y={H - INSTALL_ZONES.bottom.to + 70} fontSize={56} fill="#7dd3fc" fillOpacity={0.75}>
            instalační zóna nad podlahou
          </text>
          {cables.map((circuit) => {
            // Prvky okruhu i konce jeho úseků (vypínač v korespondenci, rozváděč na začátku trasy)
            const ids = new Set([...(circuit.elementIds ?? []), ...circuit.legs.flatMap((leg) => [leg.from, leg.to])]);
            const fromPanel = circuit.legs.some((leg) => leg.from.startsWith("panel") || leg.to.startsWith("panel"));
            const members = elevation.elements.filter((element) => ids.has(element.id) || (fromPanel && element.kind === "board"));
            if (!members.length) return null;
            const runZ = wallRunZ(circuit.routing, H);
            const color = CABLE_COLORS[circuit.layer] ?? "#e5e7eb";
            const alongs = members.map((element) => element.along);
            const from = Math.min(...alongs);
            const to = Math.max(...alongs);
            return (
              <g key={circuit.id} stroke={color} strokeWidth={10} strokeOpacity={0.85} fill="none" data-testid="pseudo3d-wall-cable" data-layer={circuit.layer}>
                {to > from ? <line x1={from} y1={H - runZ} x2={to} y2={H - runZ} /> : <line x1={from - 150} y1={H - runZ} x2={from + 150} y2={H - runZ} />}
                {members.map((element) => (
                  <line key={element.id} x1={element.along} y1={H - runZ} x2={element.along} y2={H - element.z} strokeDasharray="24 14" />
                ))}
              </g>
            );
          })}
        </g>
      ) : null}
      {hint ? (
        <text x={W / 2} y={H / 2} fontSize={70} fill="#a1a1aa" textAnchor="middle" data-testid="pseudo3d-wall-hint">
          {hint}
        </text>
      ) : null}
      {elevation.elements.map((element) => {
        const z = drag?.id === element.id ? drag.z : element.z;
        return (
          <g
            key={element.id}
            className="cursor-ns-resize"
            onPointerDown={(event) => {
              event.stopPropagation();
              (event.target as Element).setPointerCapture?.(event.pointerId);
              onSelect(element.id);
              setDrag({ id: element.id, z: element.z });
            }}
            data-testid="pseudo3d-wall-element"
            data-id={element.id}
            data-z={Math.round(z)}
          >
            <rect x={element.along - 45} y={H - z - 45} width={90} height={90} rx={14} fill={KIND_COLOR[element.kind]} stroke={selectedId === element.id ? "#fff" : "#18181b"} strokeWidth={selectedId === element.id ? 12 : 6} />
            <text x={element.along} y={H - z - 60} fontSize={50} fill="#e4e4e7" textAnchor="middle">
              {element.symbol || KIND_LABEL[element.kind]} · {Math.round(z)}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H + 110} fontSize={60} fill="#a1a1aa" textAnchor="middle">
        stěna {(W / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m · strop {H} mm
      </text>
    </svg>
  );
}

/**
 * Fáze 105: „🧊 3D Náhled & Kontrola výšek“ – izometrický pohled na celý půdorys (stěny do výšky stropu, okna, dveře,
 * nábytek a prvky ve skutečné výšce Z) a pohled na stěnu místnosti (S / V / J / Z) s pravítkem; výškové kolize
 * (zásuvka za kuchyňskou linkou) s opravou jedním klikem a úprava výšky prvku číslem nebo tažením.
 */
export function FloorplanPseudo3DModal({ draft, onHeights }: { draft: FloorplanDraft; onHeights: (ids: readonly string[], heightMm: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"iso" | "wall">("iso");
  const [view, setView] = useState<IsoView>(DEFAULT_ISO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [side, setSide] = useState<WallSide>("N");
  // Fáze 110: 🔌 kabelové trasy (výchozí zapnuté) a 🗺️ PDF podklad na podlaze
  const [cablesOn, setCablesOn] = useState(true);
  const [floorPdfOn, setFloorPdfOn] = useState(true);
  const issues = useMemo(() => (open ? heightIssues(draft) : []), [draft, open]);
  const scene = useMemo(() => (open ? buildScene(draft) : null), [draft, open]);
  const selected = scene?.elements.find((element) => element.id === selectedId) ?? null;
  const hasBackground = Boolean(draft.background);
  const sheet = useMemo((): PlanExtent | null => (hasBackground ? { minX: 0, minY: 0, maxX: draft.widthMm, maxY: draft.heightMm } : null), [hasBackground, draft.widthMm, draft.heightMm]);
  // Stěny: nakreslené místnosti (obdélník i mnohoúhelník), bez místností odvozené z prvků na podkladu
  const inferred = useMemo(() => (scene && !draft.rooms.length ? inferWalls(scene, sheet) : null), [scene, draft.rooms.length, sheet]);
  const walls = useMemo(() => (scene ? (draft.rooms.length ? roomWallSegments(scene) : (inferred?.walls ?? [])) : []), [scene, draft.rooms.length, inferred]);
  const virtual = useMemo(() => (open ? virtualRooms(draft, { background: Boolean(draft.background), envelope: inferred?.envelope ?? null }) : []), [open, draft, inferred]);
  const pdfMode = open && !draft.rooms.length && walls.length > 0;
  const floor: FloorUnderlay | null = draft.background && sheet && floorPdfOn ? { background: draft.background, mmPerPx: draft.mmPerPx, sheet } : null;
  // Trasy kabelů z výpočtu okruhů (jen při otevřeném náhledu se zapnutými trasami)
  const circuits = useMemo((): CableCircuitLike[] | null => {
    if (!open || !cablesOn) return null;
    try {
      const routes = displayRoutes(draft, analyzeDraft(draft));
      return [...routes.circuits, ...(routes.bus ? [routes.bus] : [])].filter((circuit) => !circuit.inBoard);
    } catch {
      return [];
    }
  }, [open, cablesOn, draft]);
  const runs = useMemo(() => {
    if (!scene || !circuits) return null;
    const board = scene.elements.find((element) => element.kind === "board");
    return cableRuns3D(circuits, scene, board?.z ?? draft.profile.switchboardHeightMm);
  }, [scene, circuits, draft.profile.switchboardHeightMm]);
  // Pohled na stěnu: nakreslené místnosti + virtuální (celý půdorys na PDF podkladu, zóny z prvků)
  const areas = [...draft.rooms.map((candidate) => ({ id: candidate.id, name: candidate.name })), ...virtual.map((candidate) => ({ id: candidate.id, name: candidate.name }))];
  const areaId = areas.some((area) => area.id === roomId) ? roomId : (areas[0]?.id ?? null);
  const room = draft.rooms.find((candidate) => candidate.id === areaId) ?? null;
  const virtualArea = virtual.find((candidate) => candidate.id === areaId) ?? null;
  const elevation = useMemo((): Elevation | null => {
    if (!open || mode !== "wall") return null;
    if (room) return elevationOf(draft, room.id, side);
    if (virtualArea) return elevationOfArea(draft, virtualArea, side);
    return emptyElevation(draft.profile.ceilingHeightMm);
  }, [open, mode, room, virtualArea, side, draft]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-sky-400/70 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-100 shadow hover:bg-sky-500/25" data-testid="pseudo3d-open">
          🧊 3D Náhled & Kontrola výšek
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl" data-testid="pseudo3d-modal">
        <DialogHeader>
          <DialogTitle>🧊 3D náhled a kontrola výšek</DialogTitle>
          <DialogDescription>Stěny do výšky stropu {draft.profile.ceilingHeightMm} mm, okna (parapet 900 mm), dveře 2000 mm, nábytek a všechny prvky ve skutečné výšce. Klikněte na prvek a změňte jeho výšku.</DialogDescription>
        </DialogHeader>
        {issues.length ? (
          <ul className="flex flex-col gap-1.5" data-testid="pseudo3d-issues">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/60 bg-red-500/10 p-2 text-xs text-red-100">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{issue.text}</span>
                {issue.fix ? (
                  <Button type="button" size="sm" className="h-7 bg-red-600 px-2 text-xs hover:bg-red-500" onClick={() => onHeights(issue.elementIds, issue.fix!.heightMm)} data-testid="pseudo3d-fix">
                    {issue.fix.label}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-2 text-xs text-emerald-100" data-testid="pseudo3d-ok">
            ✓ Bez výškových kolizí (zásuvky u linky, prvky za skříní nebo v otvorech).
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Režim náhledu">
            {[
              { id: "iso" as const, label: "Izometrie 3D" },
              { id: "wall" as const, label: "Pohled na stěnu" },
            ].map((option) => (
              <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => setMode(option.id)} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", mode === option.id ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:bg-muted")} data-testid={`pseudo3d-mode-${option.id}`}>
                {option.label}
              </button>
            ))}
          </div>
          {/* Fáze 110: 🔌 kabelové trasy v izometrii i na stěně a 🗺️ PDF podklad na podlaze */}
          <button
            type="button"
            aria-pressed={cablesOn}
            onClick={() => setCablesOn((on) => !on)}
            className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", cablesOn ? "border-orange-400 bg-orange-500/15 text-orange-100" : "border-border text-muted-foreground")}
            data-testid="pseudo3d-cables"
          >
            🔌 Kabelové trasy
          </button>
          {draft.background && mode === "iso" ? (
            <button
              type="button"
              aria-pressed={floorPdfOn}
              onClick={() => setFloorPdfOn((on) => !on)}
              className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", floorPdfOn ? "border-sky-400 bg-sky-500/15 text-sky-100" : "border-border text-muted-foreground")}
              data-testid="pseudo3d-floor-toggle"
            >
              🗺️ PDF podklad na podlaze
            </button>
          ) : null}
          {mode === "iso" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => setView({ ...view, rotation: (view.rotation + 270) % 360 })} data-testid="pseudo3d-rotate-left">
                <RotateCcw className="size-3.5" aria-hidden /> 90°
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => setView({ ...view, rotation: (view.rotation + 90) % 360 })} data-testid="pseudo3d-rotate-right">
                <RotateCw className="size-3.5" aria-hidden /> 90°
              </Button>
              <label className="flex items-center gap-1">
                otočení
                <input type="range" min={0} max={345} step={15} value={view.rotation} onChange={(event) => setView({ ...view, rotation: Number(event.target.value) })} aria-label="Otočení pohledu" />
              </label>
              <label className="flex items-center gap-1">
                náklon
                <input type="range" min={0.3} max={0.95} step={0.05} value={view.tilt} onChange={(event) => setView({ ...view, tilt: Number(event.target.value) })} aria-label="Náklon pohledu" />
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select value={areaId ?? ""} onChange={(event) => setRoomId(event.target.value)} className="h-7 rounded-md border border-input bg-transparent px-1.5 dark:bg-input/30" aria-label="Místnost" data-testid="pseudo3d-room">
                {areas.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1" role="group" aria-label="Stěna">
                {WALL_SIDES.map((option) => (
                  <button key={option.id} type="button" aria-pressed={side === option.id} onClick={() => setSide(option.id)} className={cn("rounded-md border px-2 py-0.5", side === option.id ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid={`pseudo3d-side-${option.id}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {selected ? <HeightEditor key={`${selected.id}-${selected.z}`} label={`${selected.label} (${KIND_LABEL[selected.kind]})`} value={selected.z} onChange={(heightMm) => onHeights([selected.id], heightMm)} /> : <p className="text-xs text-muted-foreground">Klikněte na prvek (v pohledu na stěnu ho můžete i táhnout nahoru / dolů).</p>}
        {/* Fáze 113: místnosti rozpoznané z PDF (nebo nakreslené) = obvodové stěny i vnitřní příčky mezi pokoji */}
        {open && draft.rooms.length && draft.background ? (
          <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100" data-testid="pseudo3d-room-walls">
            🧱 Stěny a vnitřní příčky z místností podlaží ({draft.rooms.length}) – poloprůhledně 20 % nad PDF podkladem
          </p>
        ) : null}
        {pdfMode ? (
          <p className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-2 py-1 text-xs text-sky-100" data-testid="pseudo3d-pdf-mode">
            {draft.background
              ? "📐 PDF režim: Obvodové stěny a příčky byly automaticky odvozeny z prvků na PDF podkladu"
              : "📐 Bez nakreslených místností: obvodové stěny a příčky byly automaticky odvozeny z osazených prvků"}
            {inferred?.partitions ? ` · příček: ${inferred.partitions}` : ""}
          </p>
        ) : null}
        {mode === "iso" ? (
          <IsoView3D draft={draft} view={view} selectedId={selectedId} onSelect={setSelectedId} walls={walls} floor={floor} cables={cablesOn ? runs : null} />
        ) : (
          <WallView
            elevation={elevation}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onHeight={(id, heightMm) => onHeights([id], heightMm)}
            cables={cablesOn ? circuits : null}
            hint={!room && !virtualArea ? "Osaďte prvky nebo nahrajte podklad – zobrazí se na stěně" : null}
          />
        )}
        <p className="flex flex-wrap gap-3 text-[11px] text-muted-foreground" data-testid="pseudo3d-legend">
          {(Object.keys(KIND_LABEL) as SceneKind[])
            .filter((kind) => kind !== "other")
            .map((kind) => (
              <span key={kind} className="flex items-center gap-1" data-kind={kind}>
                <span className="size-2.5 rounded-sm" style={{ background: KIND_COLOR[kind] }} aria-hidden /> {KIND_EMOJI[kind]} {KIND_LABEL[kind]}
              </span>
            ))}
          <span className="flex items-center gap-1" data-kind="furniture">
            <span className="size-2.5 rounded-sm border border-white/40" style={{ background: FURNITURE_FILL }} aria-hidden /> ⚪ nábytek / zařizovací předměty
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm border" style={{ background: WALL_FILL, borderColor: WALL_EDGE }} aria-hidden /> stěny do výšky stropu
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
