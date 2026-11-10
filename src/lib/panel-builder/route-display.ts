// Fáze 63: trasy kabelů k vykreslení na aktivním podlaží – plátno editoru, tiskový výkres (PDF) i export DXF sdílí stejnou
// geometrii. Automatické trasy podél stěn se kreslí v odsazení 200 mm do místnosti (u šikmé stěny v její lokální ose)
// s kolmou odbočkou k prvku, ve volném prostoru v osách X / Y; ručně upravené úseky přesně podle úpravy. Každý okruh
// nese označení jističe (-F4), kabel, délku a štítek „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. Čisté funkce.

import { BUS_LEG_CABLE, DATA_CABLE, boardOfPanelKey, type RoutePoint } from "@/engine/cable-routing";
import { MAIN_BOARD, circuitDesignations, type CircuitKind } from "@/engine/floorplan-bridge";

import { circuitTag, isLowVoltageCable } from "./cad-notation";
import { boardDesignation } from "./boards";
import type { analyzeDraft, FloorplanDraft } from "./floorplan-editor";
import { roomWalls } from "./room-geometry";
import { WALL_INSET_MM, insetWallRoute, legKey, type InsetWall, type PlanPoint } from "./route-edit";
import { elementIdOf } from "./socket-circuits";

/** Fáze 74: druh okruhu pro vrstvy plátna a soupis okruhů. */
export type CircuitLayer = "sockets" | "lighting" | "appliance" | "data" | "feeder" | "bus";

export const CIRCUIT_LAYERS: readonly { id: Exclude<CircuitLayer, "bus" | "feeder">; label: string; short: string }[] = [
  { id: "sockets", label: "Zásuvkové okruhy", short: "Zásuvky" },
  { id: "lighting", label: "Světelné okruhy", short: "Světla" },
  { id: "appliance", label: "Samostatné spotřebiče", short: "Spotřebiče" },
  { id: "data", label: "Datové rozvody (UTP)", short: "Data" },
];

/** Druh okruhu z výpočtu → vrstva. */
export function layerOf(kind: CircuitKind): CircuitLayer {
  if (kind === "lighting") return "lighting";
  if (kind === "sockets") return "sockets";
  if (kind === "feeder") return "feeder";
  return "appliance";
}

/** Vrstva je zobrazená: přívod podružného rozváděče a sběrnice se ukazují vždy, ostatní podle přepínačů. */
export const layerVisible = (layer: CircuitLayer, hidden: ReadonlySet<string>) => layer === "feeder" || layer === "bus" || !hidden.has(layer);

export interface DisplayLeg {
  /** Klíč ruční úpravy „od>do“. */
  key: string;
  from: string;
  to: string;
  /** Lomená čára na aktivním podlaží (u úseku přes stoupací vedení jen část na tomto podlaží). */
  points: PlanPoint[];
  edited: boolean;
  /** Úsek celý na jednom podlaží – jde ručně upravit. */
  editable: boolean;
}

export interface DisplayCircuit {
  id: string;
  label: string;
  designation: string | null;
  cable: string;
  lengthM: number;
  routing: "BOTTOM" | "TOP";
  legs: DisplayLeg[];
  edited: boolean;
  /** Ovládací / sběrnicový kabel – v normovém zobrazení čárkovaně. */
  lowVoltage: boolean;
  /** Štítek okruhu do výkresu. */
  tag: string;
  /** Fáze 74: druh okruhu (vrstva), rozváděč a prvky nákresu okruhu (všechna podlaží). */
  layer: CircuitLayer;
  board: string;
  elementIds: string[];
}

type Analysis = ReturnType<typeof analyzeDraft>;

/** Části lomené čáry na podlaží `floorId` (přechod podlaží = stoupací vedení). */
export function runsOnFloor(points: readonly RoutePoint[], floorId: string): PlanPoint[][] {
  const runs: PlanPoint[][] = [];
  let current: PlanPoint[] = [];
  for (const point of points) {
    if (point.floor === undefined || point.floor === floorId) current.push({ x: point.x, y: point.y });
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs.filter((run) => run.length >= 2);
}

/** Stěny místností aktivního podlaží pro odsazení tras. */
export const insetWalls = (draft: Pick<FloorplanDraft, "rooms">): InsetWall[] => draft.rooms.flatMap((room) => roomWalls(room).map((wall) => ({ ...wall, room: room.name })));

/**
 * Fáze 74: všechny okruhy nákresu (všechna podlaží) s označením jističe včetně rozváděče, druhem a prvky – pro soupis
 * okruhů a vrstvy. Pořadí = pořadí výkazu kabeláže (stejné barvy na plátně i v soupisu), datové zásuvky D1, D2 … na konci.
 */
export function circuitEntries(analysis: Analysis): Omit<DisplayCircuit, "legs" | "edited" | "tag">[] {
  const designations = circuitDesignations(analysis.circuits.circuits);
  const multiple = analysis.build.boards.length > 1;
  const byId = new Map(analysis.circuits.circuits.map((circuit) => [circuit.id, circuit]));
  const elementsOf = (nodeIds: readonly string[]) => [...new Set(nodeIds.map((id) => analysis.build.elementOf.get(id)?.id ?? elementIdOf(id)))];
  const rows = analysis.summary.circuits.map((row) => {
    const circuit = byId.get(row.id);
    const board = circuit?.board ?? MAIN_BOARD;
    return {
      id: row.id,
      label: row.label,
      designation: boardDesignation(board, designations[row.id], multiple),
      cable: row.cable,
      lengthM: row.lengthsM[analysis.summary.selected],
      routing: row.routing,
      lowVoltage: isLowVoltageCable(row.cable),
      layer: circuit ? layerOf(circuit.kind) : ("sockets" as CircuitLayer),
      board,
      elementIds: circuit ? elementsOf(circuit.nodeIds) : [],
    };
  });
  const data = analysis.summary.dataRuns.map((run, index) => {
    const element = analysis.build.elementOf.get(run.nodeId);
    return {
      id: run.id,
      label: `Datová zásuvka – ${element?.room ?? "místnost"}`,
      designation: multiple ? `${run.board} D${index + 1}` : `D${index + 1}`,
      cable: DATA_CABLE,
      lengthM: run.lengthsM[analysis.summary.selected],
      routing: run.routing,
      lowVoltage: true,
      layer: "data" as CircuitLayer,
      board: run.board,
      elementIds: element ? [element.id] : [],
    };
  });
  return [...rows, ...data];
}

/** Trasy okruhů a sběrnicové linky na aktivním podlaží. */
export function displayRoutes(draft: FloorplanDraft, analysis: Analysis, options: { inset?: number } = {}): { circuits: DisplayCircuit[]; bus: DisplayCircuit | null } {
  const inset = options.inset ?? WALL_INSET_MM;
  const walls = insetWalls(draft);
  // Fáze 74: výchozí bod podružného rozváděče („panel-RP1“) a jeho uzel přívodu („board-RP1“) leží v místnosti rozváděče
  const boardRoom = (code: string) => analysis.build.boards.find((board) => board.code === code)?.roomName ?? "";
  const roomOf = (id: string) => {
    const board = boardOfPanelKey(id);
    if (board) return boardRoom(board);
    return analysis.build.elementOf.get(id)?.room ?? "";
  };
  type Segment = { from: string; to: string; points?: RoutePoint[]; edited?: boolean; final?: boolean };
  const legsOf = (segments: readonly Segment[]): DisplayLeg[] =>
    segments.flatMap((segment) => {
      if (!segment.points?.length) return [];
      const runs = runsOnFloor(segment.points, draft.floorId);
      if (!runs.length) return [];
      const whole = runs.length === 1 && runs[0].length === segment.points.length;
      const key = legKey(segment.from, segment.to);
      const edited = Boolean(segment.edited);
      return runs.map((run, index) => ({
        key: runs.length > 1 ? `${key}#${index}` : key,
        from: segment.from,
        to: segment.to,
        // Fáze 76: úsek obvodového routeru už leží v dráze místnosti (neodsazuje se)
        points: edited || !whole || segment.final ? run : insetWallRoute(run, walls, inset, [roomOf(segment.from), roomOf(segment.to)]),
        edited,
        editable: whole,
      }));
    });
  // Fáze 74: okruhy, přívody podružných rozváděčů a datové zásuvky (vlastní UTP) jako jedna sada tras
  const routesOf = new Map<string, { segments: readonly Segment[] }>([
    ...analysis.summary.circuits.map((row) => [row.id, row.route] as const),
    ...analysis.summary.dataRuns.map((run) => [run.id, run.route] as const),
  ]);
  const circuits = circuitEntries(analysis)
    .map((entry): DisplayCircuit => {
      const legs = legsOf(routesOf.get(entry.id)?.segments ?? []);
      return { ...entry, legs, edited: legs.some((leg) => leg.edited), tag: circuitTag(entry.designation, entry.cable, entry.lengthM) };
    })
    .filter((circuit) => circuit.legs.length);
  const line = analysis.summary.busLine;
  const busLegs = line ? legsOf(line.segments) : [];
  const busLength = line ? Math.round(line.totalMm / 100) / 10 : 0;
  const bus: DisplayCircuit | null = line && busLegs.length
    ? { id: "bus", label: "Sběrnicová linka", designation: null, cable: BUS_LEG_CABLE, lengthM: busLength, routing: line.mode, legs: busLegs, edited: busLegs.some((leg) => leg.edited), lowVoltage: true, tag: `Sběrnice 24 V DC · ${BUS_LEG_CABLE.replace(/ \(.*\)$/, "")} · ${busLength.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`, layer: "bus", board: MAIN_BOARD, elementIds: [] }
    : null;
  return { circuits, bus };
}

/** Klíče ručních úprav okruhu (reset trasy na automat). */
export const editedKeysOf = (circuit: Pick<DisplayCircuit, "legs">) => circuit.legs.filter((leg) => leg.edited).map((leg) => leg.key.replace(/#\d+$/, ""));
