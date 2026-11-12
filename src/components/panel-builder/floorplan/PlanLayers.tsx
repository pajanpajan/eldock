"use client";

import { memo, useEffect, type PointerEvent as ReactPointerEvent } from "react";

import type { InstallLevel } from "@/engine/floorplan-bridge";
import { backgroundFilterId, backgroundStyle, DARK_CAD_FILTER, DIM_FILTER, filterSteps, type BackgroundLook, type FilterStep } from "@/lib/panel-builder/background-look";
import type { CadGeometry, CadUnderlay } from "@/lib/panel-builder/cad-underlay";
import { lightBadges } from "@/lib/panel-builder/field-devices";
import { paletteItem, roomLabelDetails, roomLabelLines, type Annotation, type EditorElement, type EditorRoom, type PaletteItem, type RoomHandle } from "@/lib/panel-builder/floorplan-editor";
import { backgroundTransform, type FloorplanBackground } from "@/lib/panel-builder/floorplan-pdf";
import type { ElementView } from "@/lib/panel-builder/floorplan-phases";
import type { BasinZone, FixtureHandle } from "@/lib/panel-builder/fixtures";
import { isPolygonRoom, roomPolygon, wallLabel } from "@/lib/panel-builder/room-geometry";

import { AnnotationShape } from "./AnnotationLayer";
import { CadUnderlayLayer } from "./CadUnderlayLayer";
import { Dimensions } from "./ElementPanels";
import { FixtureShape } from "./FixtureShape";
import { FloorSymbol, LightBadges, PanelSymbol } from "./FloorSymbol";

/**
 * Fáze 100: vrstvy plátna 2D půdorysu jako samostatné memoizované komponenty – statický podklad (rastr, PDF / obrázek,
 * DXF), místnosti, zakreslené změny a každý prvek zvlášť. Při pohybu myší (náhled vkládané značky, posun výřezu) ani při
 * tažení jednoho prvku se nepřekreslují ostatní vrstvy a prvky; obsluha událostí přichází přes stabilní `PlanHandlers`
 * (editor do nich předává vždy svou aktuální obsluhu).
 */

export interface PlanHandlers {
  roomDown: (event: ReactPointerEvent, room: EditorRoom, handle: RoomHandle | "move") => void;
  vertexDown: (event: ReactPointerEvent, room: EditorRoom, index: number) => void;
  removeRoom: (id: string) => void;
  elementDown: (event: ReactPointerEvent, element: EditorElement) => void;
  fixtureHandle: (event: ReactPointerEvent, element: EditorElement, handle: FixtureHandle) => void;
  noteDown: (event: ReactPointerEvent, note: Annotation) => void;
  noteHandle: (event: ReactPointerEvent, note: Annotation, handle: "a" | "b") => void;
}

/** Počítadlo vykreslení vrstev pro E2E test výkonu (`window.__eldockLayerRenders`, jen když ho test zapne). */
function useLayerCount(layer: string) {
  useEffect(() => {
    const counter = (window as unknown as { __eldockLayerRenders?: Record<string, number> }).__eldockLayerRenders;
    if (counter) counter[layer] = (counter[layer] ?? 0) + 1;
  });
}

/** Primitiva SVG filtru – stejný výsledek jako CSS filtr (sRGB jako CSS funkce). */
function FilterPrimitives({ steps }: { steps: readonly FilterStep[] }) {
  return steps.map((step, index) =>
    step.kind === "hueRotate" ? (
      <feColorMatrix key={index} type="hueRotate" values={String(step.values[0])} />
    ) : (
      <feComponentTransfer key={index}>
        {(["feFuncR", "feFuncG", "feFuncB"] as const).map((Func) =>
          step.kind === "table" ? <Func key={Func} type="table" tableValues={step.values.join(" ")} /> : <Func key={Func} type="linear" slope={step.values[0]} intercept={step.values[1]} />,
        )}
      </feComponentTransfer>
    ),
  );
}

/** Fáze 100: SVG filtry vzhledu podkladu (do `<defs>` plátna). */
export function BackgroundFilters() {
  return (
    <>
      <filter id="fp-bg-dim" colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
        <FilterPrimitives steps={filterSteps(DIM_FILTER)} />
      </filter>
      <filter id="fp-bg-dark" colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
        <FilterPrimitives steps={filterSteps(DARK_CAD_FILTER)} />
      </filter>
    </>
  );
}

/** Statický podklad plátna: rastr (bez podkladu), plocha pod výkresem, obrázek / PDF se vzhledem 🌗 a výkres DXF. */
export const PlanBackdrop = memo(function PlanBackdrop({
  widthMm,
  heightMm,
  background,
  mmPerPx,
  look,
  fineGrid,
  fineGridOn,
  cad,
  cadGeometry,
  onPaper,
  unit,
}: {
  widthMm: number;
  heightMm: number;
  background: FloorplanBackground | null;
  mmPerPx: number;
  look: BackgroundLook;
  fineGrid: number;
  fineGridOn: boolean;
  cad: CadUnderlay | null;
  cadGeometry: CadGeometry | null;
  onPaper: boolean;
  unit: number;
}) {
  useLayerCount("backdrop");
  const style = backgroundStyle(look);
  const filter = backgroundFilterId(look);
  return (
    <g data-testid="plan-backdrop">
      {!background && fineGridOn ? <rect width={widthMm} height={heightMm} fill="url(#fp-grid-fine)" data-testid="grid-fine" data-step={fineGrid} /> : null}
      <rect width={widthMm} height={heightMm} fill={background ? style.backdrop : "url(#fp-grid)"} data-testid="plan-sheet" />
      {background ? (
        <g transform={backgroundTransform(background, mmPerPx)} pointerEvents="none">
          <image
            key={background.url}
            href={background.url}
            width={background.widthPx}
            height={background.heightPx}
            preserveAspectRatio="none"
            opacity={style.opacity}
            filter={filter ? `url(#${filter})` : undefined}
            data-testid="floorplan-background"
            data-look={look}
            data-filter={style.filter ?? undefined}
          />
        </g>
      ) : null}
      {/* Fáze 79: podklad CAD (DXF) po hladinách */}
      {cad && cadGeometry ? <CadUnderlayLayer geometry={cadGeometry} cad={cad} onPaper={onPaper} unit={unit} /> : null}
    </g>
  );
});

/** Místnosti podlaží (obrys, popisek, u vybrané úchyty stěn / rohů, kóty a plovoucí lišta). */
export const RoomsLayer = memo(function RoomsLayer({ rooms, selectedRoomId, unit: ui, stroke, onPaper, selecting, handlers }: { rooms: readonly EditorRoom[]; selectedRoomId: string | null; unit: number; stroke: number; onPaper: boolean; selecting: boolean; handlers: PlanHandlers }) {
  useLayerCount("rooms");
  return rooms.map((room) => {
    const active = room.id === selectedRoomId;
    const handle = ui * 0.45;
    const edge = ui * 0.35;
    // Fáze 63: polygonální místnost se šikmými stěnami
    const polygon = isPolygonRoom(room);
    const corners = roomPolygon(room);
    const shape = {
      fill: active ? "rgba(250,204,21,0.10)" : "rgba(250,204,21,0.04)",
      stroke: active ? "#facc15" : "#a1a1aa",
      strokeWidth: stroke * (active ? 4 : 2.5),
      className: selecting ? (active ? "cursor-move" : "cursor-pointer") : undefined,
      onPointerDown: (event: ReactPointerEvent) => handlers.roomDown(event, room, "move"),
      "data-testid": `room-${room.name}`,
    };
    return (
      <g key={room.id} data-room={room.name} aria-label={`Místnost ${room.name}`}>
        {polygon ? <polygon points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")} strokeLinejoin="round" data-polygon="true" {...shape} /> : <rect x={room.x} y={room.y} width={room.w} height={room.h} {...shape} />}
        {/* Fáze 100: popisek s obrysem v barvě podkladu – nesplývá s čarou stěny pod ním */}
        <text x={room.x + ui * 0.4} y={room.y + ui * 1.1} fontSize={ui * 0.8} fill={onPaper ? "#52525b" : "#d4d4d8"} stroke={onPaper ? "rgba(255,255,255,0.9)" : "rgba(15,23,42,0.88)"} strokeWidth={ui * 0.16} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none" data-testid="room-label">
          {roomLabelLines(room.name, roomLabelDetails(room), room, ui * 0.8).map((line, index) => (
            <tspan key={index} x={room.x + ui * 0.4} dy={index ? ui * 0.95 : 0}>
              {line}
            </tspan>
          ))}
        </text>
        {active && polygon ? (
          <g data-testid="polygon-handles">
            {corners.map((corner, index) => {
              const next = corners[(index + 1) % corners.length];
              return (
                <g key={index}>
                  <text x={(corner.x + next.x) / 2} y={(corner.y + next.y) / 2 - ui * 0.3} fontSize={ui * 0.5} fontWeight={700} textAnchor="middle" fill="#facc15" stroke="#09090b" strokeWidth={ui * 0.05} paintOrder="stroke" pointerEvents="none">
                    {wallLabel(corner, next)}
                  </text>
                  <rect x={corner.x - ui * 0.3} y={corner.y - ui * 0.3} width={ui * 0.6} height={ui * 0.6} rx={ui * 0.1} fill="#facc15" stroke="#09090b" strokeWidth={stroke * 2} className="cursor-move" onPointerDown={(event) => handlers.vertexDown(event, room, index)} data-testid="polygon-vertex" />
                </g>
              );
            })}
          </g>
        ) : null}
        {active && !polygon ? (
          <>
            {/* Stěny: tažením změna rozměru */}
            <rect x={room.x} y={room.y - edge / 2} width={room.w} height={edge} fill="transparent" className="cursor-ns-resize" onPointerDown={(event) => handlers.roomDown(event, room, "n")} data-handle="n" />
            <rect x={room.x} y={room.y + room.h - edge / 2} width={room.w} height={edge} fill="transparent" className="cursor-ns-resize" onPointerDown={(event) => handlers.roomDown(event, room, "s")} data-handle="s" />
            <rect x={room.x - edge / 2} y={room.y} width={edge} height={room.h} fill="transparent" className="cursor-ew-resize" onPointerDown={(event) => handlers.roomDown(event, room, "w")} data-handle="w" />
            <rect x={room.x + room.w - edge / 2} y={room.y} width={edge} height={room.h} fill="transparent" className="cursor-ew-resize" onPointerDown={(event) => handlers.roomDown(event, room, "e")} data-handle="e" />
            {/* Aktivní roh vpravo dole */}
            <rect
              x={room.x + room.w - handle / 2}
              y={room.y + room.h - handle / 2}
              width={handle}
              height={handle}
              rx={handle * 0.15}
              fill="#facc15"
              stroke="#09090b"
              strokeWidth={stroke * 2}
              className="cursor-nwse-resize"
              onPointerDown={(event) => handlers.roomDown(event, room, "se")}
              data-testid="room-handle"
            />
            <Dimensions x={room.x} y={room.y} w={room.w} h={room.h} symbol={ui} />
            {/* Plovoucí lišta nad místností */}
            <g transform={`translate(${room.x} ${room.y - ui * 1.5})`}>
              <rect width={ui * 7.5} height={ui * 1.1} rx={ui * 0.2} fill="#18181b" stroke="#facc15" strokeWidth={stroke * 1.5} />
              <text x={ui * 0.3} y={ui * 0.75} fontSize={ui * 0.6} fill="#fafafa" pointerEvents="none">
                {room.name.slice(0, 18)}
              </text>
              <g
                transform={`translate(${ui * 6.3} 0)`}
                className="cursor-pointer"
                role="button"
                aria-label="Smazat místnost (plovoucí lišta)"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  handlers.removeRoom(room.id);
                }}
              >
                <rect width={ui * 1.1} height={ui * 1.1} rx={ui * 0.2} fill="#dc2626" />
                <text x={ui * 0.55} y={ui * 0.78} fontSize={ui * 0.6} textAnchor="middle" pointerEvents="none">
                  🗑
                </text>
              </g>
            </g>
          </>
        ) : null}
      </g>
    );
  });
});

/** Fáze 59: zakreslené změny (příčky, bourání, šrafy, texty). */
export const NotesLayer = memo(function NotesLayer({ notes, unit, selectedNoteId, interactive, handlers }: { notes: readonly Annotation[]; unit: number; selectedNoteId: string | null; interactive: boolean; handlers: PlanHandlers }) {
  useLayerCount("notes");
  return notes.map((note) => <AnnotationShape key={note.id} note={note} unit={unit} selected={note.id === selectedNoteId} interactive={interactive} onDown={handlers.noteDown} onHandle={handlers.noteHandle} />);
});

export interface PlanElementProps {
  element: EditorElement;
  /** Zobrazovaná položka (spotřebič z knihovny / výrobek z lišty výrobců mají vlastní název a zkratku). */
  item: PaletteItem;
  size: number;
  active: boolean;
  /** Fáze 98: prvky mimo aktivní fázi jsou potlačené a neklikatelné. */
  view: ElementView;
  opacity: number;
  /** Párování: jde na prvek kliknout / je už spárovaný. */
  candidate: boolean;
  linked: boolean;
  /** Fáze 74: barva okruhu vybraného / zvýrazněného okruhu (kruh kolem prvku), null = bez zvýraznění. */
  halo: string | null;
  switchNo?: string;
  lem: string | null;
  /** Fáze 62: přístroj ve víceramečku – klikací plocha jen na jeho pozici (délka v ose rámečku). */
  hitLength: number | null;
  hitHorizontal: boolean;
  onPaper: boolean;
  level: InstallLevel;
  /** Kurzor (přesun ve výběru a vkládání, jinak ukazatel). */
  movable: boolean;
  basinZone: BasinZone;
  clip: readonly { x: number; y: number }[] | null;
  unit: number;
  stroke: number;
  handlers: PlanHandlers;
}

/** Jeden prvek půdorysu (značka, rozváděč nebo zařizovací předmět) – překreslí se jen při změně svých vlastností. */
export const PlanElement = memo(function PlanElement({ element, item, size, active, view, opacity, candidate, linked, halo, switchNo, lem, hitLength, hitHorizontal, onPaper, level, movable, basinZone, clip, unit: ui, stroke, handlers }: PlanElementProps) {
  useLayerCount("element");
  const lookProps = view === "active" ? { "data-view": "active" } : { opacity, pointerEvents: "none" as const, "data-view": view };
  // Fáze 63: zařizovací předmět ve skutečném rozměru se zónami, posuvnými stranami a žlutým rohem
  if (item.kind === "fixture") {
    return (
      <g data-element={item.id} data-selected={active ? "true" : undefined} aria-label={`${item.label} – ${element.room}`} role="button" {...lookProps}>
        <FixtureShape element={element} active={active} onPaper={onPaper} unit={ui} interactive={movable} onBodyDown={(event) => handlers.elementDown(event, element)} onHandleDown={(event, handle) => handlers.fixtureHandle(event, element, handle)} basinZone={basinZone} clip={clip} />
      </g>
    );
  }
  return (
    <g transform={`translate(${element.x} ${element.y})`} onPointerDown={(event) => handlers.elementDown(event, element)} className={movable ? "cursor-move" : "cursor-pointer"} data-element={item.id} data-selected={active ? "true" : undefined} aria-label={`${item.label} – ${element.room}`} role="button" {...lookProps}>
      {candidate ? <circle r={size * 0.62} fill={linked ? "rgba(34,197,94,0.18)" : "rgba(56,189,248,0.12)"} stroke={linked ? "#22c55e" : "#38bdf8"} strokeWidth={stroke * 2} strokeDasharray={linked ? undefined : `${ui / 5} ${ui / 7}`} pointerEvents="none" data-testid="pair-candidate" /> : null}
      {/* Fáze 74: prvky vybraného / zvýrazněného okruhu */}
      {halo ? <circle r={size * 0.78} fill="none" stroke={halo} strokeWidth={stroke * 3.5} pointerEvents="none" data-testid="circuit-halo" /> : null}
      {item.kind === "panel" ? (
        <PanelSymbol size={size * 1.3} active={active} onPaper={onPaper} label={element.boardCode ?? item.symbol} />
      ) : (
        // Fáze 57: značka dle ČSN EN 60617-11, řazení vypínače z párování, natočení ke stěně; fáze 100: podkladový štítek
        <FloorSymbol item={item} size={size} active={active} onPaper={onPaper} rotation={element.rotation} switchNo={switchNo} level={level} lem={lem} hitSlot={hitLength === null ? null : { length: hitLength, horizontal: hitHorizontal }} plate />
      )}
      {element.frameUnits > 1 ? (
        <text x={size * 0.6} y={size * 0.75} fontSize={size * 0.3} fill="#ca8a04" fontWeight={700} stroke="rgba(15,23,42,0.88)" strokeWidth={size * 0.07} strokeLinejoin="round" paintOrder="stroke">
          {element.frameUnits}R
        </text>
      ) : null}
      {/* Fáze 77: štítky svítidla – DIM / CCT / RGB(W) a technologie DALI / 24V u značky */}
      {item.kind === "light" ? <LightBadges badges={lightBadges(element, paletteItem(element.item))} size={size} /> : null}
    </g>
  );
});
