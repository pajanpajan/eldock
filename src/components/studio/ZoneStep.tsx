"use client";

import { useRef, useState, type PointerEvent } from "react";
import { DoorOpen, SquareDashedMousePointer, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FLOOR_TEMPLATES,
  FLOOR_VIEWBOX,
  HANDLE_CURSORS,
  ZONE_KINDS,
  ZONE_KIND_KEYS,
  cellsToRect,
  floorTemplate,
  fmtM,
  formatGridRef,
  gateToFloorplan,
  metersToPx,
  moveZone,
  nearestWallPoint,
  pxPerMeter,
  pxToMeters,
  rectFromPoints,
  resizeZone,
  zoneDimensions,
  type GridSpec,
  type GridZone,
  type MeterPoint,
  type PlanFrame,
  type ZoneHandle,
  type ZoneKind,
  zoneAt,
} from "@/lib/cad-grid";
import { floorLabel, type StudioFloorDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";

import { PlanViewport, type ViewZoom } from "./PlanViewport";
import { ChoiceButton, FloorTabs } from "./studio-ui";

type Drag =
  | { kind: "new"; start: MeterPoint; end: MeterPoint }
  | { kind: "resize"; key: string; handle: ZoneHandle }
  | { kind: "move"; key: string; from: MeterPoint; origin: GridZone };

const SNAP_M = 1;
const EDGES: ZoneHandle[] = ["n", "s", "e", "w"];
const CORNERS: ZoneHandle[] = ["nw", "ne", "sw", "se"];

/** Body úchytu na obvodu zóny ve viewBoxu. */
function handleGeometry(zone: GridZone, frame: PlanFrame) {
  const a = metersToPx(frame, { x: zone.x, y: zone.y });
  const b = metersToPx(frame, { x: zone.x + zone.w, y: zone.y + zone.h });
  return {
    a,
    b,
    edges: {
      n: { x1: a.x, y1: a.y, x2: b.x, y2: a.y },
      s: { x1: a.x, y1: b.y, x2: b.x, y2: b.y },
      w: { x1: a.x, y1: a.y, x2: a.x, y2: b.y },
      e: { x1: b.x, y1: a.y, x2: b.x, y2: b.y },
    } as Record<"n" | "s" | "e" | "w", { x1: number; y1: number; x2: number; y2: number }>,
    corners: { nw: a, ne: { x: b.x, y: a.y }, sw: { x: a.x, y: b.y }, se: b } as Record<"nw" | "ne" | "sw" | "se", { x: number; y: number }>,
  };
}

export function ZoneStep({
  floors,
  activeKey,
  onActive,
  grid,
  frame,
  svgFor,
  onChange,
  zoom,
  onZoom,
  newKey,
}: {
  floors: StudioFloorDraft[];
  activeKey: string;
  onActive: (key: string) => void;
  grid: GridSpec;
  frame: PlanFrame;
  svgFor: (floor: StudioFloorDraft) => string;
  onChange: (key: string, patch: Partial<StudioFloorDraft>) => void;
  zoom: ViewZoom;
  onZoom: (zoom: ViewZoom) => void;
  newKey: () => string;
}) {
  const floor = floors.find((entry) => entry.key === activeKey) ?? floors[0];
  const [mode, setMode] = useState<"draw" | "wall">("draw");
  const [kind, setKind] = useState<ZoneKind>("PRODUCTION");
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [from, setFrom] = useState("B2");
  const [to, setTo] = useState("B5");
  const svgRef = useRef<SVGSVGElement>(null);

  if (!floor) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Rozvržení stávajících pater se ve Studiu nemění. Přidejte v kroku 1 nové patro, nebo pokračujte na osazení zařízení.
      </p>
    );
  }

  const zones = floor.zones;
  const setZones = (next: GridZone[]) => onChange(floor.key, { zones: next });
  const patchZone = (key: string, patch: Partial<GridZone>) => setZones(zones.map((zone) => (zone.key === key ? { ...zone, ...patch } : zone)));
  const defaultName = (zoneKind: ZoneKind) => `${ZONE_KINDS[zoneKind].defaultName} ${zones.filter((zone) => zone.kind === zoneKind).length + 1}`;

  function addZone(rect: { x: number; y: number; w: number; h: number }) {
    const zone: GridZone = { key: newKey(), ...rect, name: defaultName(kind), kind };
    setZones([...zones, zone]);
    setSelected(zone.key);
  }

  const addGate = (at: string) => {
    if (floor.gates.some((gate) => gate.at === at)) return;
    const gate = { at, label: `Vrata ${floor.gates.length + 1}` };
    if (gateToFloorplan(gate, frame)) onChange(floor.key, { gates: [...floor.gates, gate] });
  };

  // Ukazatel → viewBox → metry (přichycení na 1 m)
  const viewPoint = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * FLOOR_VIEWBOX.width, y: ((event.clientY - box.top) / box.height) * FLOOR_VIEWBOX.height };
  };
  const meterPoint = (event: PointerEvent) => pxToMeters(frame, viewPoint(event), SNAP_M);

  function capture(event: PointerEvent) {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function onBackgroundDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (mode === "wall") return addGate(formatGridRef(nearestWallPoint(viewPoint(event), frame)));
    capture(event);
    const point = meterPoint(event);
    setSelected(null);
    setDrag({ kind: "new", start: point, end: point });
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const point = meterPoint(event);
    if (drag.kind === "new") {
      if (point.x !== drag.end.x || point.y !== drag.end.y) setDrag({ ...drag, end: point });
      return;
    }
    const zone = zones.find((entry) => entry.key === drag.key);
    if (!zone) return;
    const next = drag.kind === "resize" ? resizeZone(zone, drag.handle, point, frame) : moveZone(drag.origin, point.x - drag.from.x, point.y - drag.from.y, frame);
    if (next.x !== zone.x || next.y !== zone.y || next.w !== zone.w || next.h !== zone.h) patchZone(zone.key, { x: next.x, y: next.y, w: next.w, h: next.h });
  }

  function onUp() {
    if (drag?.kind === "new") {
      const rect = rectFromPoints(drag.start, drag.end);
      if (rect.w >= SNAP_M && rect.h >= SNAP_M) addZone(rect);
      // Pouhé kliknutí do místnosti ji vybere (úchyty stěn, kóty, detail vlevo).
      else setSelected(zoneAt(zones, drag.start)?.key ?? null);
    }
    setDrag(null);
  }

  const draft = drag?.kind === "new" ? rectFromPoints(drag.start, drag.end) : null;
  const active = zones.find((zone) => zone.key === selected) ?? null;
  const activeKeyDrag = drag && drag.kind !== "new" ? drag.key : null;
  const k = pxPerMeter(frame);
  const manual = cellsToRect(from, to, grid);

  return (
    <section aria-labelledby="step-2" className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 id="step-2" className="text-lg font-semibold">
          Místnosti, zóny a vrata
        </h2>
        <FloorTabs items={floors.map((entry) => ({ id: entry.key, label: floorLabel(entry.level).short }))} active={floor.key} onActive={onActive} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nástroj">
          <ChoiceButton active={mode === "draw"} onClick={() => setMode("draw")}>
            <span className="flex items-center justify-center gap-2">
              <SquareDashedMousePointer className="size-4" aria-hidden />
              Kreslit místnosti
            </span>
          </ChoiceButton>
          <ChoiceButton active={mode === "wall"} onClick={() => setMode("wall")}>
            <span className="flex items-center justify-center gap-2">
              <DoorOpen className="size-4" aria-hidden />
              Umístit vrata
            </span>
          </ChoiceButton>
        </div>
        {mode === "draw" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Táhněte myší v půdorysu – místnost se přichytí na jemný rastr po 1 m. Stěny a rohy místnosti chyťte a posuňte, tělem místnosti ji přesunete.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium" id="zone-kind-label">
                Typ kreslené zóny
              </p>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-labelledby="zone-kind-label">
                {ZONE_KIND_KEYS.map((value) => {
                  const def = ZONE_KINDS[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={kind === value}
                      onClick={() => setKind(value)}
                      className={cn(
                        "flex min-h-14 items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        kind === value ? "bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                      style={kind === value ? { borderColor: def.color, boxShadow: `inset 0 0 0 1px ${def.color}` } : undefined}
                    >
                      <span
                        className="mt-0.5 size-5 shrink-0 rounded"
                        style={{
                          background: def.style.hatch ? `repeating-linear-gradient(45deg, ${def.color}55 0 2px, transparent 2px 6px)` : `${def.color}33`,
                          border: `2px ${def.style.dash ? "dashed" : "solid"} ${def.color}`,
                        }}
                        aria-hidden
                      />
                      <span>
                        <span className="block font-medium text-foreground">{def.label}</span>
                        <span className="text-[10px]">{def.look}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <details className="rounded-lg border border-border p-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Zadat pole rastru ručně</summary>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input value={from} onChange={(event) => setFrom(event.target.value.toUpperCase())} aria-label="Od pole" className="h-10 font-mono" />
                <Input value={to} onChange={(event) => setTo(event.target.value.toUpperCase())} aria-label="Do pole" className="h-10 font-mono" />
                <Button variant="outline" className="h-10" onClick={() => manual && addZone(manual)} disabled={!manual}>
                  Přidat
                </Button>
              </div>
            </details>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Wand2 className="size-4 text-primary" aria-hidden />
                Rozdělit patro šablonou
              </p>
              <div className="flex flex-wrap gap-2">
                {FLOOR_TEMPLATES.map((template) => (
                  <Button key={template.key} variant="outline" size="sm" className="h-10" onClick={() => setZones(floorTemplate(template.key, grid).map((zone) => ({ ...zone, key: newKey() })))}>
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Klikněte do půdorysu blízko obvodové zdi – vrata se umístí na nejbližší osu stěny (šířka průjezdu 4 m).</p>
        )}

        {active ? (
          <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: ZONE_KINDS[active.kind].color }} data-testid="zone-detail">
            <p className="text-sm font-medium">Vybraná místnost</p>
            <p className="font-mono text-xs" data-testid="zone-detail-size">
              Osa X (šířka): {fmtM(active.w)} m × Osa Y (hloubka): {fmtM(active.h)} m · {Math.round(active.w * active.h).toLocaleString("cs-CZ")} m²
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["x", "y", "w", "h"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`zone-${field}`} className="text-[10px] text-muted-foreground">
                    {{ x: "X od osy 1", y: "Y od osy A", w: "Šířka X", h: "Hloubka Y" }[field]} [m]
                  </Label>
                  <Input
                    id={`zone-${field}`}
                    type="number"
                    step={1}
                    value={active[field]}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value) || event.target.value === "") return;
                      const next = { ...active, [field]: value };
                      if (next.w >= 1 && next.h >= 1 && next.x >= 0 && next.y >= 0 && next.x + next.w <= frame.widthM && next.y + next.h <= frame.depthM) patchZone(active.key, { [field]: value });
                    }}
                    className="h-9 px-2 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="space-y-1.5 text-sm" aria-label="Místnosti a vrata patra">
          {zones.map((zone, index) => (
            <li
              key={zone.key}
              className={cn("flex items-center gap-2 rounded-md px-2 py-1", zone.key === selected ? "bg-muted ring-1 ring-primary/60" : "bg-muted/40")}
              onClick={() => setSelected(zone.key)}
            >
              <span className="size-3 shrink-0 rounded-sm" style={{ background: ZONE_KINDS[zone.kind].color }} aria-hidden />
              <span className="w-16 shrink-0 font-mono text-[11px]" title={zoneDimensions(zone)}>
                {fmtM(zone.w)} × {fmtM(zone.h)} m
              </span>
              <Input value={zone.name} onChange={(event) => patchZone(zone.key, { name: event.target.value })} aria-label={`Název místnosti ${index + 1}`} maxLength={80} className="h-8" />
              <select
                value={zone.kind}
                onChange={(event) => patchZone(zone.key, { kind: event.target.value as ZoneKind })}
                aria-label={`Typ místnosti ${index + 1}`}
                className="h-8 w-24 shrink-0 truncate rounded-md border border-input bg-background px-1 text-xs"
                title={ZONE_KINDS[zone.kind].label}
              >
                {ZONE_KIND_KEYS.map((value) => (
                  <option key={value} value={value}>
                    {ZONE_KINDS[value].defaultName}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={(event) => {
                  event.stopPropagation();
                  setZones(zones.filter((entry) => entry.key !== zone.key));
                }}
                aria-label={`Odebrat ${zone.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
          {floor.gates.map((gate, index) => (
            <li key={`g${index}`} className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-2 py-1 ring-1 ring-cyan-500/40">
              <DoorOpen className="size-4 shrink-0 text-cyan-400" aria-hidden />
              <span className="w-10 shrink-0 font-mono text-xs">{gate.at}</span>
              <Input
                value={gate.label}
                onChange={(event) => onChange(floor.key, { gates: floor.gates.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)) })}
                aria-label={`Popis vrat ${index + 1}`}
                maxLength={60}
                className="h-8"
              />
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(floor.key, { gates: floor.gates.filter((_, i) => i !== index) })} aria-label={`Odebrat ${gate.label}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <PlanViewport
        viewMeters={FLOOR_VIEWBOX.width / k.x}
        viewBox={FLOOR_VIEWBOX}
        zoom={zoom}
        onZoom={onZoom}
        label={mode === "draw" ? `Půdorys ${floorLabel(floor.level).short} – tažením myši nakreslete místnost` : `Půdorys ${floorLabel(floor.level).short} – kliknutím u zdi umístíte vrata`}
        testId="studio-grid"
        toolbar={
          <p className="text-xs text-muted-foreground">
            Osa X (šířka): <span className="font-mono text-foreground">{fmtM(frame.widthM)} m</span> × Osa Y (hloubka): <span className="font-mono text-foreground">{fmtM(frame.depthM)} m</span> · jemný rastr 1 m
          </p>
        }
      >
        {({ unit }) => {
          const font = 11.5 * unit;
          const badge = (x: number, y: number, text: string, color: string, anchor: "middle" | "start" | "end", testId?: string) => {
            const width = (text.length * 0.62 + 1.2) * font;
            const left = anchor === "middle" ? x - width / 2 : anchor === "start" ? x : x - width;
            return (
              <g pointerEvents="none" data-testid={testId}>
                <rect x={left} y={y - font} width={width} height={font * 1.55} rx={3 * unit} fill="#0b1220" stroke={color} strokeWidth={1.5 * unit} />
                <text x={left + width / 2} y={y + font * 0.2} textAnchor="middle" fontSize={font} fontWeight={700} fill="#f8fafc" fontFamily="ui-monospace, Consolas, monospace">
                  {text}
                </text>
              </g>
            );
          };
          /** Kóty u hran: X nad horní hranou, Y vpravo (u pravé zdi vlevo), uvnitř celkový rozměr. */
          const dims = (rect: { x: number; y: number; w: number; h: number }, color: string, prefix: string) => {
            const a = metersToPx(frame, { x: rect.x, y: rect.y });
            const b = metersToPx(frame, { x: rect.x + rect.w, y: rect.y + rect.h });
            const nearRight = b.x + 90 * unit > frame.x + frame.w + 60;
            const nearTop = a.y - 24 * unit < 0;
            return (
              <g>
                {badge((a.x + b.x) / 2, nearTop ? a.y + 16 * unit : a.y - 9 * unit, `X: ${fmtM(rect.w)} m`, color, "middle", `${prefix}-dim-x`)}
                {badge(nearRight ? b.x - 6 * unit : b.x + 6 * unit, (a.y + b.y) / 2, `Y: ${fmtM(rect.h)} m`, color, nearRight ? "end" : "start", `${prefix}-dim-y`)}
              </g>
            );
          };
          return (
            <>
              <div className="pointer-events-none absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svgFor(floor) }} aria-hidden />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${FLOOR_VIEWBOX.width} ${FLOOR_VIEWBOX.height}`}
                className={cn("absolute inset-0 size-full", mode === "draw" ? "cursor-crosshair" : "cursor-pointer")}
                onPointerDown={onBackgroundDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={() => setDrag(null)}
              >
                {mode === "draw"
                  ? zones.map((zone) => {
                      const color = ZONE_KINDS[zone.kind].color;
                      const g = handleGeometry(zone, frame);
                      const isActive = zone.key === selected || zone.key === activeKeyDrag;
                      return (
                        <g key={zone.key} data-zone={zone.name}>
                          <rect
                            x={g.a.x}
                            y={g.a.y}
                            width={g.b.x - g.a.x}
                            height={g.b.y - g.a.y}
                            fill={isActive ? `${color}22` : "transparent"}
                            stroke={isActive ? color : "none"}
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            className="cursor-move"
                            pointerEvents={isActive ? "auto" : "none"}
                            onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              capture(event);
                              setSelected(zone.key);
                              setDrag({ kind: "move", key: zone.key, from: meterPoint(event), origin: zone });
                            }}
                          />
                          {EDGES.map((handle) => {
                            const edge = g.edges[handle as "n" | "s" | "e" | "w"];
                            return (
                              <g key={handle} className="group" style={{ cursor: HANDLE_CURSORS[handle] }}>
                                <line {...edge} stroke={color} strokeWidth={4} vectorEffect="non-scaling-stroke" className={cn("transition-opacity", isActive ? "opacity-60" : "opacity-0", "group-hover:opacity-100")} />
                                <line
                                  {...edge}
                                  stroke="transparent"
                                  strokeWidth={14}
                                  vectorEffect="non-scaling-stroke"
                                  data-testid={`zone-edge-${handle}`}
                                  onPointerDown={(event) => {
                                    if (event.button !== 0) return;
                                    capture(event);
                                    setSelected(zone.key);
                                    setDrag({ kind: "resize", key: zone.key, handle });
                                  }}
                                />
                              </g>
                            );
                          })}
                          {CORNERS.map((handle) => {
                            const point = g.corners[handle as "nw" | "ne" | "sw" | "se"];
                            const size = 10 * unit;
                            return (
                              <rect
                                key={handle}
                                x={point.x - size / 2}
                                y={point.y - size / 2}
                                width={size}
                                height={size}
                                fill={isActive ? color : "transparent"}
                                stroke={isActive ? "#0b1220" : "transparent"}
                                strokeWidth={1.5 * unit}
                                style={{ cursor: HANDLE_CURSORS[handle] }}
                                data-testid={`zone-corner-${handle}`}
                                onPointerDown={(event) => {
                                  if (event.button !== 0) return;
                                  capture(event);
                                  setSelected(zone.key);
                                  setDrag({ kind: "resize", key: zone.key, handle });
                                }}
                              />
                            );
                          })}
                          {isActive ? dims(zone, color, "zone") : null}
                        </g>
                      );
                    })
                  : null}
                {draft ? (
                  <g pointerEvents="none" data-testid="studio-selection">
                    <rect
                      x={metersToPx(frame, draft).x}
                      y={metersToPx(frame, draft).y}
                      width={draft.w * k.x}
                      height={draft.h * k.y}
                      fill={`${ZONE_KINDS[kind].color}33`}
                      stroke={ZONE_KINDS[kind].color}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                    {draft.w > 0 && draft.h > 0 ? dims(draft, ZONE_KINDS[kind].color, "draft") : null}
                    {draft.w > 0 && draft.h > 0 ? (
                      <text
                        x={metersToPx(frame, draft).x + 6 * unit}
                        y={metersToPx(frame, draft).y + 16 * unit}
                        fontSize={11 * unit}
                        fontWeight={700}
                        fill="#f8fafc"
                        data-testid="draft-size"
                      >
                        {zoneDimensions(draft)}
                      </text>
                    ) : null}
                  </g>
                ) : null}
              </svg>
            </>
          );
        }}
      </PlanViewport>
    </section>
  );
}
