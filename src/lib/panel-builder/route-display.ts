// Fáze 63: trasy kabelů k vykreslení na aktivním podlaží – plátno editoru, tiskový výkres (PDF) i export DXF sdílí stejnou
// geometrii. Automatické trasy podél stěn se kreslí v odsazení 200 mm do místnosti (u šikmé stěny v její lokální ose)
// s kolmou odbočkou k prvku, ve volném prostoru v osách X / Y; ručně upravené úseky přesně podle úpravy. Každý okruh
// nese označení jističe (-F4), kabel, délku a štítek „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. Čisté funkce.

import { BUS_LEG_CABLE, type RoutePoint } from "@/engine/cable-routing";
import { circuitDesignations } from "@/engine/floorplan-bridge";

import { circuitTag, isLowVoltageCable } from "./cad-notation";
import type { analyzeDraft, FloorplanDraft } from "./floorplan-editor";
import { roomWalls } from "./room-geometry";
import { WALL_INSET_MM, insetWallRoute, legKey, type InsetWall, type PlanPoint } from "./route-edit";

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

/** Trasy okruhů a sběrnicové linky na aktivním podlaží. */
export function displayRoutes(draft: FloorplanDraft, analysis: Analysis, options: { inset?: number } = {}): { circuits: DisplayCircuit[]; bus: DisplayCircuit | null } {
  const inset = options.inset ?? WALL_INSET_MM;
  const walls = insetWalls(draft);
  const designations = circuitDesignations(analysis.circuits.circuits);
  const roomOf = (id: string) => (id === "panel" ? (draft.elements.find((element) => element.item === "panel")?.room ?? "") : (analysis.build.elementOf.get(id)?.room ?? ""));
  const legsOf = (segments: readonly { from: string; to: string; points?: RoutePoint[]; edited?: boolean }[]): DisplayLeg[] =>
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
        points: edited || !whole ? run : insetWallRoute(run, walls, inset, [roomOf(segment.from), roomOf(segment.to)]),
        edited,
        editable: whole,
      }));
    });
  const circuits = analysis.summary.circuits
    .map((circuit): DisplayCircuit => {
      const legs = legsOf(circuit.route.segments);
      const lengthM = circuit.lengthsM[draft.mode];
      const designation = designations[circuit.id] ?? null;
      return {
        id: circuit.id,
        label: circuit.label,
        designation,
        cable: circuit.cable,
        lengthM,
        routing: circuit.routing,
        legs,
        edited: legs.some((leg) => leg.edited),
        lowVoltage: isLowVoltageCable(circuit.cable),
        tag: circuitTag(designation, circuit.cable, lengthM),
      };
    })
    .filter((circuit) => circuit.legs.length);
  const line = analysis.summary.busLine;
  const busLegs = line ? legsOf(line.segments) : [];
  const busLength = line ? Math.round(line.totalMm / 100) / 10 : 0;
  const bus: DisplayCircuit | null = line && busLegs.length
    ? { id: "bus", label: "Sběrnicová linka", designation: null, cable: BUS_LEG_CABLE, lengthM: busLength, routing: line.mode, legs: busLegs, edited: busLegs.some((leg) => leg.edited), lowVoltage: true, tag: `Sběrnice 24 V DC · ${BUS_LEG_CABLE.replace(/ \(.*\)$/, "")} · ${busLength.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m` }
    : null;
  return { circuits, bus };
}

/** Klíče ručních úprav okruhu (reset trasy na automat). */
export const editedKeysOf = (circuit: Pick<DisplayCircuit, "legs">) => circuit.legs.filter((leg) => leg.edited).map((leg) => leg.key.replace(/#\d+$/, ""));
