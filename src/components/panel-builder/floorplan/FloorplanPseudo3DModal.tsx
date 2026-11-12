"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, RotateCcw, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toWorld } from "@/lib/panel-builder/fixtures";
import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { DEFAULT_ISO, HEIGHT_LEVELS, HEIGHT_PRESETS, WALL_SIDES, buildScene, elevationOf, heightIssues, isoProject, type IsoView, type SceneKind, type WallSide } from "@/lib/panel-builder/pseudo3d";
import { cn } from "@/lib/utils";

/** Barvy značek podle druhu prvku (zásuvky modré / zelené, vypínače jantarové, světla žlutá, rozváděč fialový). */
const KIND_COLOR: Record<SceneKind, string> = { socket: "#38bdf8", switch: "#f59e0b", light: "#facc15", board: "#a78bfa", control: "#34d399", appliance: "#fb7185", other: "#a1a1aa" };
const KIND_LABEL: Record<SceneKind, string> = { socket: "zásuvka", switch: "vypínač", light: "svítidlo", board: "rozváděč", control: "ovladač / čidlo", appliance: "spotřebič", other: "prvek" };

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

/** Režim A: izometrický pohled na celý půdorys (otáčení po 90° / 15°, náklon). */
function IsoView3D({ draft, view, selectedId, onSelect }: { draft: FloorplanDraft; view: IsoView; selectedId: string | null; onSelect: (id: string) => void }) {
  const scene = useMemo(() => buildScene(draft), [draft]);
  const center = { x: (scene.bounds.minX + scene.bounds.maxX) / 2, y: (scene.bounds.minY + scene.bounds.maxY) / 2 };
  const project = (point: { x: number; y: number; z?: number }) => isoProject(point, view, center);
  const H = scene.ceilingMm;
  // Stěny místností (svislé čtyřúhelníky po obvodu), vzdálenější dřív
  const walls = scene.rooms.flatMap((room) =>
    room.polygon.map((a, index) => {
      const b = room.polygon[(index + 1) % room.polygon.length];
      const quad = [project({ ...a, z: 0 }), project({ ...b, z: 0 }), project({ ...b, z: H }), project({ ...a, z: H })];
      return { key: `${room.id}-${index}`, quad, depth: (quad[0].depth + quad[1].depth) / 2 };
    }),
  );
  walls.sort((a, b) => a.depth - b.depth);
  const furniture = scene.furniture.map((entry) => {
    const bottom = entry.geometry.corners.map((corner) => project({ ...corner, z: 0 }));
    const top = entry.geometry.corners.map((corner) => project({ ...corner, z: entry.height }));
    const sides = bottom.map((point, index) => {
      const next = (index + 1) % bottom.length;
      return { quad: [point, bottom[next], top[next], top[index]], depth: (point.depth + bottom[next].depth) / 2 };
    });
    sides.sort((a, b) => a.depth - b.depth);
    return { id: entry.id, label: entry.label, top, sides, depth: top.reduce((sum, point) => sum + point.depth, 0) / top.length };
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
  const all = [...walls.flatMap((wall) => wall.quad), ...elements.map((entry) => entry.at), ...scene.rooms.flatMap((room) => room.polygon.map((point) => project({ ...point, z: 0 })))];
  const minX = Math.min(...all.map((point) => point.x), 0) - 400;
  const maxX = Math.max(...all.map((point) => point.x), 1) + 400;
  const minY = Math.min(...all.map((point) => point.y), 0) - 400;
  const maxY = Math.max(...all.map((point) => point.y), 1) + 400;
  const unit = Math.max(maxX - minX, maxY - minY) / 120;
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-[58vh] w-full rounded-xl bg-zinc-950" role="img" aria-label="Izometrický 3D náhled půdorysu" data-testid="pseudo3d-iso" data-rotation={view.rotation}>
      {scene.rooms.map((room) => (
        <polygon key={room.id} points={polygon(room.polygon.map((point) => project({ ...point, z: 0 })))} fill="#27272a" stroke="#52525b" strokeWidth={unit * 0.15} />
      ))}
      {furniture.map((entry) => (
        <g key={entry.id} data-testid="pseudo3d-furniture">
          {entry.sides.map((side, index) => (
            <polygon key={index} points={polygon(side.quad)} fill="#78716c" fillOpacity={0.55} stroke="#a8a29e" strokeWidth={unit * 0.08} />
          ))}
          <polygon points={polygon(entry.top)} fill="#a8a29e" fillOpacity={0.75} stroke="#d6d3d1" strokeWidth={unit * 0.08}>
            <title>{entry.label}</title>
          </polygon>
        </g>
      ))}
      {walls.map((wall) => (
        <polygon key={wall.key} points={polygon(wall.quad)} fill="#e4e4e7" fillOpacity={0.1} stroke="#d4d4d8" strokeOpacity={0.7} strokeWidth={unit * 0.12} />
      ))}
      {openings.map((opening) => (
        <polygon key={opening.id} points={polygon(opening.quad)} fill={opening.door ? "#92400e" : "#7dd3fc"} fillOpacity={opening.door ? 0.55 : 0.4} stroke={opening.door ? "#d97706" : "#38bdf8"} strokeWidth={unit * 0.12} data-testid="pseudo3d-opening" />
      ))}
      {elements.map(({ element, at, foot }) => (
        <g key={element.id} onClick={() => onSelect(element.id)} className="cursor-pointer" data-testid="pseudo3d-element" data-id={element.id} data-z={Math.round(element.z)}>
          {/* Svislý svod: zásuvky od podlahy, vypínače a ostatní ze stropu */}
          {element.kind !== "light" ? <line x1={foot.x} y1={foot.y} x2={at.x} y2={at.y} stroke={KIND_COLOR[element.kind]} strokeOpacity={0.6} strokeWidth={unit * 0.12} strokeDasharray={`${unit * 0.5} ${unit * 0.3}`} /> : null}
          <circle cx={at.x} cy={at.y} r={unit * (selectedId === element.id ? 1.1 : 0.75)} fill={KIND_COLOR[element.kind]} stroke={selectedId === element.id ? "#fff" : "#18181b"} strokeWidth={unit * 0.2} />
          <title>{`${element.label} · ${Math.round(element.z)} mm`}</title>
        </g>
      ))}
    </svg>
  );
}

/** Režim B: rozvinutý pohled na stěnu místnosti s pravítkem výšek; výška prvku tažením nebo číslem. */
function WallView({ draft, roomId, side, selectedId, onSelect, onHeight }: { draft: FloorplanDraft; roomId: string; side: WallSide; selectedId: string | null; onSelect: (id: string) => void; onHeight: (id: string, heightMm: number) => void }) {
  const elevation = useMemo(() => elevationOf(draft, roomId, side), [draft, roomId, side]);
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
  const issues = useMemo(() => (open ? heightIssues(draft) : []), [draft, open]);
  const scene = useMemo(() => (open ? buildScene(draft) : null), [draft, open]);
  const selected = scene?.elements.find((element) => element.id === selectedId) ?? null;
  const room = draft.rooms.find((candidate) => candidate.id === roomId) ?? draft.rooms[0] ?? null;
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
              <select value={room?.id ?? ""} onChange={(event) => setRoomId(event.target.value)} className="h-7 rounded-md border border-input bg-transparent px-1.5 dark:bg-input/30" aria-label="Místnost" data-testid="pseudo3d-room">
                {draft.rooms.map((candidate) => (
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
        {mode === "iso" ? (
          <IsoView3D draft={draft} view={view} selectedId={selectedId} onSelect={setSelectedId} />
        ) : room ? (
          <WallView draft={draft} roomId={room.id} side={side} selectedId={selectedId} onSelect={setSelectedId} onHeight={(id, heightMm) => onHeights([id], heightMm)} />
        ) : (
          <p className="text-sm text-muted-foreground">Nakreslete nejdřív místnost.</p>
        )}
        <p className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(KIND_LABEL) as SceneKind[]).map((kind) => (
            <span key={kind} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full" style={{ background: KIND_COLOR[kind] }} aria-hidden /> {KIND_LABEL[kind]}
            </span>
          ))}
        </p>
      </DialogContent>
    </Dialog>
  );
}
