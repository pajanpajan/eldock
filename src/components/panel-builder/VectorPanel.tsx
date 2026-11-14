"use client";

import { useId, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Camera, Minus, Moon, Plus, Printer, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { MAX_RAIL_MODULES, MIN_RAIL_MODULES, RAIL_PRESETS } from "@/lib/panel-builder/rails";
import { FIELD_GAP, pathOf, vectorLayout, wiringPaths, VECTOR, type IncomerFrom, type Rect, type WiringNode } from "@/lib/panel-builder/vector-layout";
import { symbolTexts, type VectorDevice } from "@/lib/panel-builder/vector-symbols";
import { combFedIds, combForks, combLabel, combRuns, combShortLabel, phaseBadges, poleCount, type CombNode, type CombSetting } from "@/lib/panel-builder/comb-busbars";

import type { BusbarPlan } from "@/lib/panel-builder/pe-n-busbars";

import { BusbarStrip } from "./BusbarStrip";
import { RailCombMenu } from "./RailCombMenu";
import { VECTOR_THEMES, VectorModuleSymbol, type VectorTheme } from "./VectorModuleSymbol";

export interface SymbolOutline {
  color: string;
  dashed?: boolean;
  glow?: boolean;
}

const DRAG_THRESHOLD = 6;
/** MIME přetahované karty „Přiřazený přístroj k osazení“ (HTML5 drag & drop z pravého menu). */
export const PLACE_MIME = "application/x-eldock-place";

/**
 * 2D vektorový rozváděč (Interactive Vector CAD): DIN lišty se standardizovanými mechanickými
 * symboly, živé modré spojnice podle stromu zapojení a přívodní šipka. Režim zobrazení
 * „Tmavý editor (CAD Dark)“ / „Výkres osazení“. Volitelně výběr (Ctrl/Shift = více), drag & drop
 * přístroje na přístroj, ze kterého je napájen, dvojklik na spodní štítek = úprava funkce obvodu
 * a správa lišt (krok 1).
 */
export function VectorPanel({
  devices,
  rails,
  modulesPerRail,
  nodes,
  incomer = "TOP",
  selectedIds,
  outlineFor,
  onSelect,
  onBackground,
  onDrop,
  dragHint,
  onLabelEdit,
  onSelectRail,
  onAddModule,
  onDeleteRail,
  onAddRail,
  busy,
  deviceAction,
  toolbar,
  pickHint,
  onRailCapacity,
  onMoveRail,
  activeRail,
  onActivateRail,
  onPlaceDrop,
  onMoveDevice,
  onRailPhoto,
  busbars,
  fields = null,
  partition = null,
  combs,
  onRailComb,
  supplyPhases = 3,
  combNodes,
}: {
  devices: readonly VectorDevice[];
  rails: number;
  /** Jedna šířka pro všechny lišty, nebo kapacita každé lišty zvlášť (návrh od nuly). */
  modulesPerRail: number | readonly number[];
  /** Strom zapojení pro modré spojnice (bez něj se kreslí jen osazení). */
  nodes?: readonly WiringNode[];
  incomer?: IncomerFrom;
  selectedIds?: ReadonlySet<string>;
  outlineFor?: (device: VectorDevice) => SymbolOutline | null;
  onSelect?: (device: VectorDevice, modifiers: { additive: boolean }) => void;
  onBackground?: () => void;
  /** Drag & drop: přetažené prvky (výběr nebo jeden) na cílový přístroj. */
  onDrop?: (sourceIds: string[], targetId: string) => void;
  /** Text u kurzoru při přetahování na cíl (např. „napájet z -FI1“). */
  dragHint?: (sourceIds: string[], target: VectorDevice) => string;
  onLabelEdit?: (device: VectorDevice, label: string) => void;
  onSelectRail?: (rail: number) => void;
  onAddModule?: (rail: number) => void;
  onDeleteRail?: (rail: number) => void;
  onAddRail?: () => void;
  busy?: boolean;
  /** Tlačítko nad přístrojem (např. „🔗 Připojit jističe vpravo“ u chrániče). */
  deviceAction?: (device: VectorDevice) => { label: string; onClick: () => void } | null;
  toolbar?: ReactNode;
  /** Režim výběru (např. „Klikněte na hlavní vstupní prvek“). */
  pickHint?: string | null;
  /** Fáze 43 – ovládání kapacity lišty (presety, − / +) přímo u lišty. */
  onRailCapacity?: (rail: number, modules: number) => void;
  onMoveRail?: (rail: number, direction: -1 | 1) => void;
  /** Aktivní lišta pro „➕ Vložit na aktivní lištu“. */
  activeRail?: number;
  onActivateRail?: (rail: number) => void;
  /** Upuštění karty z pravého menu na lištu (pozice = pořadí zleva, kam se přístroj vloží). */
  onPlaceDrop?: (rail: number, position: number) => void;
  /** Fáze 59: přesun osazeného přístroje tažením na jinou pozici / lištu (pozice = pořadí bez přesouvaného přístroje). */
  onMoveDevice?: (deviceId: string, rail: number, position: number) => void;
  /** Fáze 47 – detailní fotka jedné lišty / sekce (velké rozváděče). */
  onRailPhoto?: (rail: number) => void;
  /** Fáze 55 – svorkovnice PE / N0 / N-FIx (nahoře nebo dole podle přívodu). */
  busbars?: BusbarPlan | null;
  /** Fáze 111 – dvě pole vedle sebe (lišty 1…n vlevo „Pole A – Silnoproud“, zbytek vpravo) se svislou přepážkou. */
  fields?: { aRails: number; labels: [string, string] } | null;
  /** Fáze 111 – vodorovná izolační přepážka pod lištou (silnoproud nahoře, slaboproud dole). */
  partition?: { afterRail: number; label: string } | null;
  /** Fáze 112 – ruční volba propojovacího hřebenu lišt (bez údaje Auto) a přepnutí tlačítkem u hřebenu. */
  combs?: Record<number, CombSetting>;
  onRailComb?: (rail: number, setting: CombSetting) => void;
  /** Fáze 112 – soustava přívodu (1f = všechny jističe L1, hřeben 1f). */
  supplyPhases?: 1 | 3;
  /** Fáze 112 – strom zapojení jen pro hřebeny a fáze (krok 1 bez modrých spojnic). */
  combNodes?: readonly CombNode[];
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [theme, setTheme] = useState<VectorTheme>("dark");
  const colors = VECTOR_THEMES[theme];
  const layout = useMemo(() => vectorLayout(devices, rails, modulesPerRail, { fields, partition }), [devices, rails, modulesPerRail, fields, partition]);
  // Fáze 112 / 115: propojovací hřebeny (volba lišty „Bez hřebenu“ je zruší) a odznaky fází jističů
  const combPlan = useMemo(() => {
    const treeNodes = nodes ?? combNodes ?? devices.map((device) => ({ id: device.id, parentItemId: null }));
    const settings = combs ?? {};
    const runs = combRuns(devices, treeNodes, settings, supplyPhases);
    return { runs, active: runs, badges: phaseBadges(devices, runs, supplyPhases), settings };
  }, [devices, nodes, combNodes, combs, supplyPhases]);
  // Fáze 115: přístroj napájený hřebenem nedostane navíc modrou spojnici od napájecího přístroje (duplicitní propojení)
  const wires = useMemo(() => (nodes ? wiringPaths(layout, devices, nodes, incomer, combFedIds(combPlan.active)) : []), [layout, devices, nodes, incomer, combPlan]);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ ids: string[]; startX: number; startY: number; x: number; y: number; active: boolean; pointerId: number; origin: VectorDevice; additive: boolean } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const toSvg = (event: ReactPointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * layout.width, y: ((event.clientY - box.top) / box.height) * layout.height };
  };
  const hit = (point: { x: number; y: number }) => devices.find((device) => {
    const rect = layout.rects.get(device.id);
    return rect && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y - 4 && point.y <= rect.y + rect.h + 4;
  }) ?? null;
  const target = drag?.active && onDrop ? hit(drag) : null;
  const validTarget = target && !drag?.ids.includes(target.id) ? target : null;

  function pointerDown(event: ReactPointerEvent, device: VectorDevice) {
    if (event.button !== 0 || editing) return;
    event.stopPropagation();
    const point = toSvg(event);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const ids = selectedIds?.has(device.id) && selectedIds.size > 1 ? [...selectedIds] : [device.id];
    // Strom (krok 2) zachytí ukazatel hned; přesun v kroku 1 až po rozjetí tažení – dvojklik na štítek tak dál funguje
    if (onDrop) svg.current?.setPointerCapture(event.pointerId);
    setDrag({ ids, startX: point.x, startY: point.y, x: point.x, y: point.y, active: false, pointerId: event.pointerId, origin: device, additive });
  }
  function pointerMove(event: ReactPointerEvent) {
    if (!drag || (!onDrop && !onMoveDevice)) return;
    const point = toSvg(event);
    const active = drag.active || Math.hypot(point.x - drag.startX, point.y - drag.startY) > DRAG_THRESHOLD;
    if (active && !drag.active && !onDrop) {
      try {
        svg.current?.setPointerCapture(drag.pointerId);
      } catch {
        // ukazatel už není aktivní
      }
    }
    setDrag({ ...drag, ...point, active });
    if (active && onMoveDevice && !onDrop) {
      const hint = dropTarget(event, drag.origin.id);
      if (hint && (hint.rail !== moveHint?.rail || hint.position !== moveHint.position)) setMoveHint(hint);
    }
  }
  function pointerUp() {
    if (!drag) return;
    const current = drag;
    const hint = moveHint;
    setDrag(null);
    setMoveHint(null);
    if (!current.active) return onSelect?.(current.origin, { additive: current.additive });
    if (validTarget) return onDrop?.(current.ids, validTarget.id);
    if (onMoveDevice && hint) {
      const unchanged = hint.rail === current.origin.dinRailIndex && hint.position === devices.filter((device) => device.dinRailIndex === hint.rail && device.positionOnRail < current.origin.positionOnRail).length + 1;
      if (!unchanged) onMoveDevice(current.origin.id, hint.rail, hint.position);
    }
  }
  function keyDown(event: ReactKeyboardEvent, device: VectorDevice) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(device, { additive: event.ctrlKey || event.shiftKey });
    }
  }
  function commitLabel() {
    if (!editing) return;
    const device = devices.find((candidate) => candidate.id === editing.id);
    setEditing(null);
    if (device && editing.value.trim() !== device.label) onLabelEdit?.(device, editing.value.trim());
  }

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  const overlay = (rect: Rect) => ({ left: pct(rect.x, layout.width), top: pct(rect.y, layout.height), width: pct(rect.w, layout.width), height: pct(rect.h, layout.height) });
  const editingRect = editing ? layout.rects.get(editing.id) : null;

  // Drag & drop karty z pravého menu: nejbližší lišta a pořadí podle středů přístrojů vlevo od kurzoru
  const [dropHint, setDropHint] = useState<{ rail: number; position: number; x: number } | null>(null);
  const [moveHint, setMoveHint] = useState<{ rail: number; position: number; x: number } | null>(null);
  const indicator = dropHint ?? moveHint;
  /** Místo vložení podle kurzoru: nejbližší lišta, pořadí podle středů přístrojů vlevo (bez přesouvaného přístroje). */
  function dropTarget(event: { clientX: number; clientY: number }, exclude?: string) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    const x = ((event.clientX - box.left) / box.width) * layout.width;
    const y = ((event.clientY - box.top) / box.height) * layout.height;
    // Fáze 111: u dvou polí nejbližší lišta ve sloupci pod kurzorem
    const column = layout.fields ? layout.rails.filter((candidate) => x >= candidate.left - FIELD_GAP / 2 && x <= candidate.right + FIELD_GAP / 2) : layout.rails;
    const rail = [...(column.length ? column : layout.rails)].sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0];
    if (!rail) return null;
    const onRail = devices.filter((device) => device.dinRailIndex === rail.index && device.id !== exclude).sort((a, b) => a.positionOnRail - b.positionOnRail);
    const before = onRail.filter((device) => {
      const rect = layout.rects.get(device.id);
      return rect ? rect.x + rect.w / 2 < x : false;
    });
    const next = onRail[before.length];
    const last = before[before.length - 1];
    const lineX = next ? layout.rects.get(next.id)!.x : last ? layout.rects.get(last.id)!.x + layout.rects.get(last.id)!.w : rail.left;
    return { rail: rail.index, position: before.length + 1, x: lineX };
  }
  const placing = (event: ReactDragEvent) => !!onPlaceDrop && event.dataTransfer.types.includes(PLACE_MIME);

  return (
    <div className="flex flex-col gap-2" data-testid="vector-panel" data-theme={theme}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Režim zobrazení rozváděče">
          {(
            [
              ["dark", "Tmavý editor (CAD Dark)", Moon],
              ["print", "Výkres osazení", Printer],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn("flex min-h-8 items-center gap-1.5 rounded-md px-2.5 font-semibold", theme === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        {toolbar}
      </div>
      {pickHint ? (
        <p className="rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200" role="status" data-testid="pick-hint">
          {pickHint}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border" style={{ background: colors.bg }}>
        <div
          className="relative"
          style={{ minWidth: Math.max(onRailCapacity ? 560 : 360, layout.capacity * 30 + 110) }}
          data-testid="vector-drop-zone"
          onDragOver={(event) => {
            if (!placing(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            const hint = dropTarget(event);
            if (hint && (hint.rail !== dropHint?.rail || hint.position !== dropHint.position)) setDropHint(hint);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropHint(null);
          }}
          onDrop={(event) => {
            if (!placing(event)) return;
            event.preventDefault();
            const hint = dropTarget(event);
            setDropHint(null);
            if (hint) onPlaceDrop?.(hint.rail, hint.position);
          }}
        >
          {busbars && incomer === "TOP" ? <BusbarStrip plan={busbars} position="TOP" /> : null}
          <svg
            ref={svg}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className={cn("block h-auto w-full select-none", drag?.active && "cursor-grabbing")}
            role="group"
            aria-label="2D vektorový rozváděč"
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={() => {
              setDrag(null);
              setMoveHint(null);
            }}
            onPointerDown={() => onBackground?.()}
          >
            <defs>
              <linearGradient id={`copper-${uid}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#e9a96b" />
                <stop offset="0.5" stopColor="#b87333" />
                <stop offset="1" stopColor="#8a5226" />
              </linearGradient>
              <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill={colors.wire} />
              </marker>
            </defs>
            <rect width={layout.width} height={layout.height} fill={colors.bg} />

            {/* Fáze 111: dvě pole vedle sebe – záhlaví polí a svislá přepážka skříně (jako ABB CA2xV / OEZ RZA) */}
            {layout.fields ? (
              <g data-testid="vector-fields" pointerEvents="none">
                {layout.fields.columns.map((column, index) => (
                  <g key={index} data-field={index === 0 ? "A" : "B"}>
                    <rect x={column.left - 10} y={12} width={column.right - column.left + 20} height={22} rx={5} fill={index === 0 ? "rgba(250, 204, 21, 0.14)" : "rgba(34, 211, 238, 0.14)"} stroke={index === 0 ? "#facc15" : "#22d3ee"} strokeWidth={1} />
                    <text x={column.left} y={27} fontSize={12} fontWeight={800} fill={index === 0 ? "#facc15" : "#22d3ee"} fontFamily="ui-sans-serif, system-ui, sans-serif" data-testid={`vector-field-${index === 0 ? "A" : "B"}`}>
                      {layout.fields!.labels[index]}
                    </text>
                  </g>
                ))}
                <line x1={layout.fields.partitionX} x2={layout.fields.partitionX} y1={40} y2={layout.height - 16} stroke={colors.railStroke} strokeWidth={6} strokeDasharray="14 7" opacity={0.85} data-testid="vector-partition-vertical" />
                <text x={layout.fields.partitionX + 6} y={layout.height - 22} fontSize={9.5} fill={colors.muted} fontFamily="ui-sans-serif, system-ui, sans-serif">
                  přepážka skříně
                </text>
              </g>
            ) : null}
            {layout.partition ? (
              <g data-testid="vector-partition" pointerEvents="none">
                <line x1={20} x2={layout.width - 20} y1={layout.partition.y} y2={layout.partition.y} stroke="#f59e0b" strokeWidth={4} strokeDasharray="16 8" />
                <rect x={VECTOR.left} y={layout.partition.y - 11} width={Math.min(layout.width - VECTOR.left - 24, layout.partition.label.length * 6.2 + 16)} height={22} rx={5} fill={colors.bg} stroke="#f59e0b" strokeWidth={1} />
                <text x={VECTOR.left + 8} y={layout.partition.y + 4} fontSize={11} fontWeight={700} fill="#f59e0b" fontFamily="ui-sans-serif, system-ui, sans-serif">
                  {layout.partition.label}
                </text>
              </g>
            ) : null}

            {/* DIN lišty (35 mm) a volné pozice */}
            {layout.rails.map((rail) => (
              <g key={rail.index} data-rail={rail.index} data-capacity={rail.capacity} data-active={activeRail === rail.index ? "true" : undefined}>
                {activeRail === rail.index ? (
                  <rect x={rail.x0 - 4} y={rail.top - 6} width={rail.x1 - rail.x0 + 8} height={VECTOR.deviceH + 12} rx={6} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.75} />
                ) : null}
                <rect x={rail.x0} y={rail.y - 7} width={rail.x1 - rail.x0} height={14} fill={colors.rail} stroke={colors.railStroke} strokeWidth={0.8} />
                {Array.from({ length: Math.max(0, rail.capacity - Math.ceil(rail.used)) }, (_, index) => (
                  <rect
                    key={index}
                    x={rail.left + (Math.ceil(rail.used) + index) * VECTOR.moduleW + 2}
                    y={rail.top + 6}
                    width={VECTOR.moduleW - 4}
                    height={VECTOR.deviceH - 12}
                    rx={3}
                    fill="none"
                    stroke={colors.grid.replace(/0\.0\d\)/, "0.35)")}
                    strokeDasharray="4 4"
                  />
                ))}
                <text x={rail.left - VECTOR.left + 8} y={rail.y - 4} fontSize={11} fontWeight={700} fill={colors.text} fontFamily="ui-sans-serif, system-ui, sans-serif">
                  Lišta {rail.index}
                </text>
                <text x={rail.left - VECTOR.left + 8} y={rail.y + 10} fontSize={9.5} fill={rail.used > rail.capacity ? "#ef4444" : colors.muted} fontFamily="ui-monospace, monospace" data-testid={`rail-usage-${rail.index}`}>
                  {String(rail.used).replace(".", ",")}/{rail.capacity} M
                </text>
              </g>
            ))}

            {/* Modré spojnice: přívod, propojky, hřebenové sběrnice a odbočky */}
            <g data-testid="vector-wires" pointerEvents="none">
              {wires.map((wire, index) => (
                <path
                  key={index}
                  d={pathOf(wire.points)}
                  fill="none"
                  stroke={colors.wire}
                  strokeWidth={wire.kind === "bus" ? 4.5 : wire.kind === "incomer" ? 4 : wire.kind === "feed" ? 2.6 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={wire.kind === "incomer" ? `url(#arrow-${uid})` : undefined}
                  opacity={selectedIds?.size && wire.from !== "incomer" && !selectedIds.has(wire.from) ? 0.55 : 1}
                  data-wire={wire.kind}
                  data-to={wire.to}
                  data-from={wire.from}
                />
              ))}
              {wires
                .filter((wire) => wire.kind === "incomer")
                .map((wire, index) => (
                  <text key={`label-${index}`} x={wire.points[0][0] + 8} y={incomer === "TOP" ? 20 : layout.height - 12} fontSize={10} fontWeight={700} fill={colors.wire} fontFamily="ui-sans-serif, system-ui, sans-serif">
                    PŘÍVOD {incomer === "TOP" ? "SHORA ⬇" : "ZESPODA ⬆"}
                  </text>
                ))}
            </g>

            {devices.map((device) => {
              const rect = layout.rects.get(device.id);
              if (!rect) return null;
              const selected = selectedIds?.has(device.id) ?? false;
              const isTarget = validTarget?.id === device.id;
              const custom = outlineFor?.(device) ?? null;
              const outline = isTarget ? { color: "#22d3ee", glow: true } : selected ? { color: "#fbbf24", glow: true } : custom;
              const texts = symbolTexts(device);
              return (
                <g
                  key={device.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${device.designation} ${[texts.manufacturer, texts.value, texts.detail].filter(Boolean).join(" ")}${device.label ? ` · ${device.label}` : ""}`}
                  className={cn("outline-none", onDrop || onMoveDevice ? "cursor-grab" : "cursor-pointer")}
                  onPointerDown={(event) => pointerDown(event, device)}
                  onKeyDown={(event) => keyDown(event, device)}
                  onDoubleClick={() => onLabelEdit && setEditing({ id: device.id, value: device.label })}
                  data-testid={`symbol-${device.designation}`}
                >
                  <VectorModuleSymbol
                    device={device}
                    rect={rect}
                    theme={theme}
                    outline={outline?.color}
                    dashed={outline?.dashed}
                    glow={outline?.glow}
                    dimmed={drag?.active && drag.ids.includes(device.id)}
                    phase={combPlan.badges.get(device.id) ?? null}
                  />
                </g>
              );
            })}

            {/* Fáze 112 / 115: měděné hřebenové přípojnice – vidličky jen do svorek vodičů hřebenu (4P chránič s 1P / 3P
                jističi bez N), úsek končí za vidličkou posledního přístroje skupiny (jasná mezera před dalším přístrojem),
                N chrániče vede modrý vodič na nulový můstek N-FIx */}
            <g data-testid="vector-combs" pointerEvents="none">
              {combPlan.active.map((run) => {
                const byId = new Map(devices.map((device) => [device.id, device]));
                const members = run.ids.flatMap((id) => {
                  const rect = layout.rects.get(id);
                  const device = byId.get(id);
                  return rect && device ? [{ rect, device }] : [];
                });
                if (members.length < 2) return null;
                const edge = run.input ? Math.min(...members.map((member) => member.rect.y)) : Math.max(...members.map((member) => member.rect.y + member.rect.h));
                const forks = members.flatMap(({ rect, device }) => combForks(device, run).map((pole) => rect.x + ((pole + 0.5) * rect.w) / poleCount(device.poles)));
                const x0 = Math.min(...forks) - 5;
                const x1 = Math.max(...forks) + 5;
                const barY = run.input ? edge - 9 : edge + 3;
                const head = members[0];
                const headPoles = poleCount(head.device.poles);
                const neutralStub = !run.input && head.device.category === "RCD" && !run.conductors.includes("N") && /\+N|^2P$|^4P$/.test(head.device.poles ?? "");
                const neutralX = head.rect.x + ((headPoles - 0.5) * head.rect.w) / headPoles;
                const labelX = neutralStub ? members[1].rect.x + 3 : x0 + 4;
                const room = x1 - labelX;
                const full = combLabel(run);
                const medium = combShortLabel(run, "medium");
                const label = room >= full.length * 4.7 ? full : room >= medium.length * 4.7 ? medium : combShortLabel(run, "short");
                return (
                  <g key={`${run.rail}-${run.ids[0]}`} data-testid="comb-busbar" data-comb-rail={run.rail} data-kind={run.kind} data-count={run.ids.length} data-ids={run.ids.join(" ")} data-x0={Math.round(x0)} data-x1={Math.round(x1)} data-conductors={run.conductors.join(" ")}>
                    {run.note ? <title>{run.note}</title> : null}
                    {forks.map((x, index) => (
                      <rect key={index} x={x - 2} y={run.input ? edge - 3 : edge - 6} width={4} height={9} fill="#c27c3a" stroke="#7c4a1e" strokeWidth={0.6} data-testid="comb-fork" />
                    ))}
                    <rect x={x0} y={barY} width={x1 - x0} height={6} rx={1.5} fill={`url(#copper-${uid})`} stroke="#7c4a1e" strokeWidth={0.8} />
                    <text x={labelX} y={barY + (run.input ? -3 : 15)} fontSize={8.5} fontWeight={700} fill="#d6a77a" fontFamily="ui-sans-serif, system-ui, sans-serif">
                      {label}
                    </text>
                    {neutralStub ? (
                      <g data-testid="comb-neutral" data-to={`N-${head.device.designation.replace(/^-/, "")}`}>
                        <line x1={neutralX} y1={edge - 4} x2={neutralX} y2={edge + 24} stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
                        <text x={neutralX + 3} y={edge + 31} fontSize={7} fontWeight={700} fill="#60a5fa" fontFamily="ui-sans-serif, system-ui, sans-serif">
                          N → N-{head.device.designation.replace(/^-/, "")}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>

            {/* Místo vložení karty z pravého menu */}
            {indicator ? (
              <g pointerEvents="none" data-testid="drop-indicator">
                <line x1={indicator.x} x2={indicator.x} y1={(layout.rails[indicator.rail - 1]?.top ?? 0) - 10} y2={(layout.rails[indicator.rail - 1]?.top ?? 0) + VECTOR.deviceH + 10} stroke="#22d3ee" strokeWidth={4} strokeLinecap="round" />
                <circle cx={indicator.x} cy={(layout.rails[indicator.rail - 1]?.top ?? 0) - 10} r={6} fill="#22d3ee" />
              </g>
            ) : null}

            {/* Přetahovaný prvek u kurzoru */}
            {drag?.active ? (
              <g pointerEvents="none" data-testid="drag-ghost">
                <rect x={drag.x + 10} y={drag.y - 26} width={Math.max(90, (validTarget && dragHint ? dragHint(drag.ids, validTarget).length : 14) * 6.4 + 16)} height={22} rx={4} fill="#0f172a" stroke={validTarget ? "#22d3ee" : "#64748b"} />
                <text x={drag.x + 18} y={drag.y - 11} fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="ui-sans-serif, system-ui, sans-serif">
                  {validTarget && dragHint ? dragHint(drag.ids, validTarget) : moveHint ? `${drag.origin.designation} → lišta ${moveHint.rail}, pozice ${moveHint.position}` : `${drag.ids.length > 1 ? `${drag.ids.length} prvky` : drag.origin.designation} → …`}
                </text>
              </g>
            ) : null}
          </svg>
          {busbars && incomer !== "TOP" ? <BusbarStrip plan={busbars} position="BOTTOM" /> : null}

          {/* HTML vrstva: tlačítka u přístrojů, správa lišt a úprava štítku */}
          {deviceAction
            ? devices.map((device) => {
                const action = deviceAction(device);
                const rect = layout.rects.get(device.id);
                if (!action || !rect) return null;
                return (
                  <button
                    key={`action-${device.id}`}
                    type="button"
                    onClick={action.onClick}
                    className="absolute z-10 -translate-y-full rounded-md border border-sky-400/70 bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-sky-100 backdrop-blur hover:bg-sky-500/40"
                    style={{ left: pct(rect.x, layout.width), top: `calc(${pct(rect.y, layout.height)} - 4px)` }}
                  >
                    {action.label}
                  </button>
                );
              })
            : null}
          {layout.rails.map((rail) => (
            <div key={`controls-${rail.index}`}>
              {onSelectRail ? (
                <button
                  type="button"
                  onClick={() => onSelectRail(rail.index)}
                  aria-label={`Označit celou lištu ${rail.index}`}
                  title="Označit celou lištu (pak přetáhnout na napájecí přístroj)"
                  className="absolute rounded px-1 text-[10px] text-sky-300 hover:bg-sky-500/15"
                  style={{ left: pct(rail.left - VECTOR.left + 6, layout.width), top: pct(rail.y + 16, layout.height) }}
                >
                  ▣ lišta
                </button>
              ) : null}
              {onRailCapacity ? (
                <div
                  className="absolute z-10 flex items-center gap-0.5 rounded-md border border-border/80 bg-background/85 px-1 py-0.5 text-[10px] whitespace-nowrap shadow backdrop-blur has-[[aria-expanded=true]]:z-40"
                  style={{ left: pct(rail.left - 8, layout.width), top: `calc(${pct(rail.top, layout.height)} - 34px)` }}
                  role="group"
                  aria-label={`Ovládání lišty ${rail.index}`}
                  data-testid={`rail-controls-${rail.index}`}
                >
                  <button
                    type="button"
                    aria-pressed={activeRail === rail.index}
                    onClick={() => onActivateRail?.(rail.index)}
                    title="Aktivní lišta pro „Vložit na aktivní lištu“"
                    className={cn("rounded px-1.5 py-0.5 font-semibold", activeRail === rail.index ? "bg-amber-400 text-black" : "text-muted-foreground hover:text-foreground")}
                  >
                    ◉ Lišta {rail.index}
                  </button>
                  <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                  {RAIL_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={busy}
                      aria-pressed={rail.capacity === preset}
                      aria-label={`Lišta ${rail.index}: ${preset}M${preset === 14 ? " (12+2)" : ""}`}
                      onClick={() => onRailCapacity(rail.index, preset)}
                      className={cn("rounded px-1 py-0.5 font-mono", rail.capacity === preset ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      {preset}M
                    </button>
                  ))}
                  <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                  <button type="button" disabled={busy || rail.capacity <= MIN_RAIL_MODULES} aria-label={`Lišta ${rail.index} o modul užší`} onClick={() => onRailCapacity(rail.index, rail.capacity - 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-40">
                    <Minus className="size-3" aria-hidden />
                  </button>
                  <button type="button" disabled={busy || rail.capacity >= MAX_RAIL_MODULES} aria-label={`Lišta ${rail.index} o modul širší`} onClick={() => onRailCapacity(rail.index, rail.capacity + 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-40">
                    <Plus className="size-3" aria-hidden />
                  </button>
                  {onMoveRail ? (
                    <>
                      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                      <button type="button" disabled={busy || rail.index === 1} aria-label={`Posunout lištu ${rail.index} nahoru`} onClick={() => onMoveRail(rail.index, -1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-40">
                        <ArrowUp className="size-3" aria-hidden />
                      </button>
                      <button type="button" disabled={busy || rail.index === layout.rails.length} aria-label={`Posunout lištu ${rail.index} dolů`} onClick={() => onMoveRail(rail.index, 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-40">
                        <ArrowDown className="size-3" aria-hidden />
                      </button>
                    </>
                  ) : null}
                  {onRailPhoto ? (
                    <button type="button" disabled={busy} aria-label={`Nahrát detailní fotku lišty ${rail.index}`} title="📷 Nahrát detailní fotku této lišty / sekce" onClick={() => onRailPhoto(rail.index)} className="rounded p-0.5 text-sky-300 hover:bg-sky-500/15 disabled:opacity-40">
                      <Camera className="size-3" aria-hidden />
                    </button>
                  ) : null}
                  {onRailComb ? (
                    <>
                      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                      <RailCombMenu rail={rail.index} setting={combPlan.settings[rail.index] ?? "AUTO"} kinds={combPlan.runs.filter((run) => run.rail === rail.index).map((run) => run.kind)} busy={busy} onChange={(setting) => onRailComb(rail.index, setting)} />
                    </>
                  ) : null}
                  {onDeleteRail ? (
                    <button type="button" disabled={busy} aria-label={`Smazat celou lištu ${rail.index}`} title="Smazat celou lištu" onClick={() => onDeleteRail(rail.index)} className="rounded p-0.5 text-red-300 hover:bg-red-500/15 disabled:opacity-40">
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {/* Fáze 115: bez ovládání šířky lišty (náhled) je volba hřebenu samostatně u levého okraje lišty */}
              {onRailComb && !onRailCapacity ? (
                <div
                  className="absolute z-10 rounded-md border border-amber-600/60 bg-background/90 px-1 text-[10px] whitespace-nowrap shadow has-[[aria-expanded=true]]:z-40"
                  style={{ left: pct(rail.left - 8, layout.width), top: `calc(${pct(rail.top, layout.height)} - 30px)` }}
                >
                  <RailCombMenu rail={rail.index} setting={combPlan.settings[rail.index] ?? "AUTO"} kinds={combPlan.runs.filter((run) => run.rail === rail.index).map((run) => run.kind)} busy={busy} onChange={(setting) => onRailComb(rail.index, setting)} />
                </div>
              ) : null}
              {onDeleteRail && !onRailCapacity ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeleteRail(rail.index)}
                  aria-label={`Smazat celou lištu ${rail.index}`}
                  title="Smazat celou lištu"
                  className="absolute flex items-center gap-0.5 rounded px-1 text-[10px] text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                  style={{ left: pct(rail.left - VECTOR.left + 6, layout.width), top: pct(rail.y + 16, layout.height) }}
                >
                  <Trash2 className="size-3" aria-hidden /> lišta
                </button>
              ) : null}
              {onAddModule ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAddModule(rail.index)}
                  aria-label={`Přidat modul na lištu ${rail.index}`}
                  title="Přidat modul na konec lišty"
                  className="absolute flex -translate-y-1/2 flex-col items-center rounded-md border-2 border-dashed border-slate-500 px-1 py-1 text-[10px] text-slate-300 hover:border-primary hover:text-white disabled:opacity-50"
                  style={{ left: pct((layout.fields ? rail.right : layout.width - VECTOR.right) + 6, layout.width), top: pct(rail.y, layout.height) }}
                >
                  <Plus className="size-3.5" aria-hidden /> modul
                </button>
              ) : null}
            </div>
          ))}
          {editing && editingRect ? (
            <input
              autoFocus
              aria-label="Funkce obvodu na štítku"
              value={editing.value}
              maxLength={80}
              onChange={(event) => setEditing({ ...editing, value: event.target.value })}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitLabel();
                if (event.key === "Escape") setEditing(null);
              }}
              className="absolute z-20 min-w-28 rounded border-2 border-amber-400 bg-white px-1 text-xs text-black shadow-lg"
              style={{ ...overlay({ x: editingRect.x, y: editingRect.y + 100, w: editingRect.w, h: 22 }) }}
            />
          ) : null}
        </div>
      </div>
      {onAddRail ? (
        <button
          type="button"
          disabled={busy}
          onClick={onAddRail}
          className="touch-target flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Přidat další DIN lištu (řadu)
        </button>
      ) : null}
    </div>
  );
}
