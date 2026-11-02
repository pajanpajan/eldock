"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Factory, Loader2, Plug, Plus, Save, Shapes, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { IsometricBuilding } from "@/components/map/isometric/IsometricBuilding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingType } from "@/generated/prisma/enums";
import { BUILDING_LIMITS, DEFAULT_GRID, FLOOR_VIEWBOX, SCALES, fmtM, gridDimensions, gridFromMeters, planFrame, renderGridFloorplanSvg, rowLabel, zoneToRoom, type DrawingScale, type GridSpec } from "@/lib/cad-grid";
import {
  CAMPUS_LIMITS,
  CAMPUS_PRESETS,
  campusSizeValid,
  clampRect,
  findFreeSpot,
  metersToRect,
  polygonBounds,
  rectToMeters,
  rescalePolygon,
  rescaleRect,
  type CampusRect,
  type CampusSize,
} from "@/lib/campus-layout";
import { BUILDING_TYPE_LABELS } from "@/lib/format";
import { extractFloorplanRooms } from "@/lib/mock-graphics/floorplan";
import type { AutopilotSource } from "@/lib/studio-autopilot";
import { layoutOfFloor } from "@/lib/studio-layout";
import { floorLabel, floorName, type StudioBuildingDraft, type StudioEquipmentDraft, type StudioEquipmentEdit, type StudioFloorDraft, type StudioNewPlantDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import { saveStudioAction } from "@/server/actions/studio";
import type { FloorOverview } from "@/server/queries/building";
import type { StudioData } from "@/server/queries/studio";

import { CampusPlacementMap } from "./CampusPlacementMap";
import { PlacementStep, type FloorRef } from "./PlacementStep";
import type { ViewZoom } from "./PlanViewport";
import { ChoiceButton, selectClass, type HistoryControls } from "./studio-ui";
import { ZoneStep } from "./ZoneStep";

const STEPS = [
  { n: 1, title: "Budovy, umístění a podlaží", icon: Building2 },
  { n: 2, title: "Místnosti, zóny a vrata", icon: Shapes },
  { n: 3, title: "Zařízení a napájení", icon: Plug },
] as const;

/** Šablony budov na 1 klik: rozměr v metrech, typ a patra. */
const PRESETS: { key: string; label: string; emoji: string; name: string; type: BuildingType; widthM: number; depthM: number; floors: { level: number; usage: string }[] }[] = [
  { key: "hall", label: "🏭 Výrobní hala (66 × 42 m)", emoji: "🏭", name: "Výroba", type: "PRODUCTION", widthM: 66, depthM: 42, floors: [{ level: 0, usage: "Hlavní výroba" }] },
  {
    key: "energy",
    label: "⚡ Energetika / Rozvodna (24 × 18 m, 1. PP + 1. NP)",
    emoji: "⚡",
    name: "Energetika",
    type: "ENERGY",
    widthM: 24,
    depthM: 18,
    floors: [
      { level: -1, usage: "Rozvodny" },
      { level: 0, usage: "Trafostanice" },
    ],
  },
  {
    key: "office",
    label: "🏢 Administrativa (36 × 24 m, 2 patra)",
    emoji: "🏢",
    name: "Administrativa",
    type: "OFFICE",
    widthM: 36,
    depthM: 24,
    floors: [
      { level: 0, usage: "Recepce a kanceláře" },
      { level: 1, usage: "Kanceláře" },
    ],
  },
  { key: "warehouse", label: "📦 Sklad / Expedice (48 × 30 m)", emoji: "📦", name: "Sklad", type: "WAREHOUSE", widthM: 48, depthM: 30, floors: [{ level: 0, usage: "Expediční sklad" }] },
];
const TYPE_EMOJI: Record<BuildingType, string> = { PRODUCTION: "🏭", ASSEMBLY: "🔧", ENERGY: "⚡", WAREHOUSE: "📦", OFFICE: "🏢", OTHER: "🏗️" };

const BUILDING_TYPES = Object.keys(BUILDING_TYPE_LABELS) as BuildingType[];
const HISTORY_LIMIT = 30;
/** Změny rychleji po sobě (psaní, tažení) se slučují do jednoho kroku historie. */
const HISTORY_COALESCE_MS = 500;

type PlantMode = "existing" | "new";

/** Jedna budova konceptu se vším, co se k ní ve Studiu nakreslí. */
interface Concept {
  key: string;
  building: StudioBuildingDraft;
  grid: GridSpec;
  floors: StudioFloorDraft[];
  equipment: StudioEquipmentDraft[];
  /** Nové využití stávajících pater (Floor.id → využití). */
  renames: Record<string, string>;
  /** Úpravy uložených zařízení z kroku 3. */
  edits: Record<string, StudioEquipmentEdit>;
  zoneFloorKey: string;
  placeFloor: FloorRef;
}

interface WizardState {
  concepts: Concept[];
  past: Concept[][];
  future: Concept[][];
  lastPush: number;
}

const NEW_PLANT_DEFAULT: StudioNewPlantDraft = { name: "", code: "", location: "" };
const NEW_CAMPUS_DEFAULT: CampusSize = { width: 300, height: 200 };

/** První volné písmeno kódu budovy (závod i ostatní budovy konceptu). */
function freeBuildingCode(codes: readonly string[]) {
  const used = new Set(codes.map((code) => code.toUpperCase()));
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((letter) => !used.has(letter)) ?? "N";
}

/** Nový závod od nuly: čistá mapa bez budov a bez zdrojů napájení. */
const cleanScene = (data: StudioData): StudioData => ({ ...data, plant: { ...data.plant, buildings: [] }, equipment: [] });
const usageOf = (name: string) => name.split(" - ").slice(1).join(" - ");

/** Nová budova konceptu ze šablony – volné místo v areálu i volný kód. */
function makeConcept(preset: (typeof PRESETS)[number], scene: { codes: string[]; rects: CampusRect[]; campus: CampusSize }, scale: DrawingScale, key: (prefix: string) => string): Concept {
  const grid = gridFromMeters(preset.widthM, preset.depthM, DEFAULT_GRID.stepMeters, scale);
  const code = freeBuildingCode(scene.codes);
  const floors = preset.floors.map((floor) => ({ key: key("f"), level: floor.level, usage: floor.usage, zones: [], gates: [] }));
  const ground = floors.find((floor) => floor.level === 0) ?? floors[0];
  return {
    key: key("b"),
    building: {
      mode: "new",
      code,
      name: preset.type === "PRODUCTION" ? `Hala ${code} - ${preset.name}` : `${preset.name} ${code}`,
      type: preset.type,
      map: findFreeSpot(metersToRect(preset.widthM, preset.depthM, scene.campus), scene.rects),
    },
    grid,
    floors,
    equipment: [],
    renames: {},
    edits: {},
    zoneFloorKey: ground.key,
    placeFloor: { kind: "draft", key: ground.key },
  };
}

/** Studio výstavby závodu – 3 kroky, jedna či více budov, uložení celého konceptu v jedné transakci. */
export function StudioWizard({ data: source, startNewPlant = false }: { data: StudioData; startNewPlant?: boolean }) {
  const router = useRouter();
  const [plantMode, setPlantMode] = useState<PlantMode>(startNewPlant ? "new" : "existing");
  const [newPlant, setNewPlant] = useState<StudioNewPlantDraft>(NEW_PLANT_DEFAULT);
  const plantCampus: CampusSize = { width: source.plant.campusWidthM, height: source.plant.campusDepthM };
  const [campusInput, setCampusInput] = useState<CampusSize>(startNewPlant ? NEW_CAMPUS_DEFAULT : plantCampus);
  const [campus, setCampus] = useState<CampusSize>(startNewPlant ? NEW_CAMPUS_DEFAULT : plantCampus);
  const [campusZoom, setCampusZoom] = useState<ViewZoom>("fit");
  const [floorZoom, setFloorZoom] = useState<ViewZoom>("fit");
  const baseData = useMemo(() => (plantMode === "new" ? cleanScene(source) : source), [plantMode, source]);
  // Stávající budovy přepočtené na aktuální rozměr areálu (stejná poloha v metrech).
  const data = useMemo<StudioData>(() => {
    if (campus.width === source.plant.campusWidthM && campus.height === source.plant.campusDepthM) return baseData;
    const from = { width: source.plant.campusWidthM, height: source.plant.campusDepthM };
    return {
      ...baseData,
      plant: {
        ...baseData.plant,
        buildings: baseData.plant.buildings.map((building) => ({
          ...building,
          mapPolygon: rescalePolygon(building.mapPolygon, from, campus),
          labelX: (building.labelX * from.width) / campus.width,
          labelY: (building.labelY * from.height) / campus.height,
        })),
      },
    };
  }, [baseData, campus, source.plant.campusWidthM, source.plant.campusDepthM]);
  const counter = useRef(1);
  const nextKey = (prefix: string) => `${prefix}${counter.current++}`;
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [hoveredFloor, setHoveredFloor] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>(() => {
    // Výchozí budova: klíče z lokálního počítadla (počítadlo v ref se při renderu číst nesmí)
    let index = 0;
    const initialKey = (prefix: string) => `${prefix}0${index++}`;
    const buildings = data.plant.buildings;
    return {
      concepts: [makeConcept(PRESETS[0], { codes: buildings.map((building) => building.code), rects: buildings.map((building) => polygonBounds(building.mapPolygon)), campus }, DEFAULT_GRID.scale, initialKey)],
      past: [],
      future: [],
      lastPush: 0,
    };
  });
  const { concepts } = state;
  const [activeKey, setActiveKey] = useState(state.concepts[0].key);
  const concept = concepts.find((entry) => entry.key === activeKey) ?? concepts[0];

  /** Změna konceptu s historií (Zpět / Vpřed, max. 30 kroků; rychlé po sobě jdoucí změny se slučují). */
  const change = useCallback((fn: (all: Concept[]) => Concept[], record = true) => {
    const now = Date.now();
    setState((current) => {
      const next = fn(current.concepts);
      if (next === current.concepts) return current;
      if (!record) return { ...current, concepts: next };
      const push = now - current.lastPush > HISTORY_COALESCE_MS;
      return {
        concepts: next,
        past: push ? [...current.past, current.concepts].slice(-HISTORY_LIMIT) : current.past,
        future: [],
        lastPush: push ? now : current.lastPush,
      };
    });
  }, []);
  const checkpoint = useCallback(() => setState((current) => ({ ...current, lastPush: 0 })), []);
  const undo = useCallback(
    () => setState((current) => (current.past.length ? { concepts: current.past[current.past.length - 1], past: current.past.slice(0, -1), future: [current.concepts, ...current.future], lastPush: 0 } : current)),
    [],
  );
  const redo = useCallback(
    () => setState((current) => (current.future.length ? { concepts: current.future[0], past: [...current.past, current.concepts].slice(-HISTORY_LIMIT), future: current.future.slice(1), lastPush: 0 } : current)),
    [],
  );
  const history: HistoryControls = { canUndo: state.past.length > 0, canRedo: state.future.length > 0, undo, redo, depth: state.past.length };

  // Ctrl+Z / Ctrl+Y v krocích 2 a 3 (mimo textová pole)
  useEffect(() => {
    if (step === 1) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement).closest("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, undo, redo]);

  /** Úprava aktivní budovy konceptu. */
  const patch = (update: Partial<Concept> | ((current: Concept) => Partial<Concept>), record = true) =>
    change((all) => all.map((entry) => (entry.key === concept.key ? { ...entry, ...(typeof update === "function" ? update(entry) : update) } : entry)), record);

  const { building, grid, floors, equipment } = concept;
  const dims = gridDimensions(grid);
  const frame = useMemo(() => planFrame(grid), [grid]);
  const existingBuilding = building.mode === "existing" ? data.plant.buildings.find((entry) => entry.id === building.id) : undefined;
  const existingFloors = useMemo(() => existingBuilding?.floors ?? [], [existingBuilding]);
  const buildingCode = building.mode === "new" ? building.code : (existingBuilding?.code ?? "X");
  const buildingTitle = building.mode === "new" ? building.name : (existingBuilding?.name ?? "");
  const otherConcepts = concepts.filter((entry) => entry.key !== concept.key);
  const scene = (excludeKey = concept.key, sceneCampus = campus) => ({
    codes: [...data.plant.buildings.map((entry) => entry.code), ...concepts.filter((entry) => entry.key !== excludeKey && entry.building.mode === "new").map((entry) => (entry.building as { code: string }).code)],
    rects: [
      ...data.plant.buildings.map((entry) => polygonBounds(entry.mapPolygon)),
      ...concepts.filter((entry) => entry.key !== excludeKey && entry.building.mode === "new").map((entry) => (entry.building as { map: CampusRect }).map),
    ],
    campus: sceneCampus,
  });

  /** Šablona budovy pro AKTIVNÍ budovu konceptu. */
  function applyPreset(preset: (typeof PRESETS)[number]) {
    const fresh = makeConcept(preset, scene(), grid.scale, nextKey);
    patch({ ...fresh, key: concept.key });
  }

  /** „+ Přidat další budovu“: aktuální budova zůstane v konceptu, nová se stane aktivní. */
  function addBuilding() {
    const fresh = makeConcept(PRESETS[0], scene("__none__"), grid.scale, nextKey);
    change((all) => [...all, fresh]);
    setActiveKey(fresh.key);
    toast.success(`Do konceptu přidána ${fresh.building.mode === "new" ? fresh.building.name : "budova"}.`);
  }

  function removeConcept(key: string) {
    if (concepts.length < 2) return;
    change((all) => all.filter((entry) => entry.key !== key));
    if (key === concept.key) setActiveKey(concepts.find((entry) => entry.key !== key)!.key);
  }

  function switchPlantMode(mode: PlantMode) {
    if (mode === plantMode) return;
    setPlantMode(mode);
    const nextCampus = mode === "new" ? NEW_CAMPUS_DEFAULT : plantCampus;
    setCampus(nextCampus);
    setCampusInput(nextCampus);
    const buildings = mode === "new" ? [] : source.plant.buildings;
    const fresh = makeConcept(PRESETS[0], { codes: buildings.map((entry) => entry.code), rects: buildings.map((entry) => polygonBounds(entry.mapPolygon)), campus: nextCampus }, grid.scale, nextKey);
    setState({ concepts: [fresh], past: [], future: [], lastPush: 0 });
    setActiveKey(fresh.key);
  }

  /** Nový rozměr areálu: všechny nové budovy konceptu si zachovají polohu i rozměr v metrech. */
  function updateCampus(next: Partial<CampusSize>) {
    const size = { ...campusInput, ...next };
    setCampusInput(size);
    if (!campusSizeValid(size)) return;
    change((all) => all.map((entry) => (entry.building.mode === "new" ? { ...entry, building: { ...entry.building, map: clampRect(rescaleRect(entry.building.map, campus, size)) } } : entry)));
    setCampus(size);
  }

  /** Rozměr budovy v metrech (6 m až rozměr areálu) – osy rastru se dopočítají automaticky. */
  function updateSize(next: { widthM?: number; depthM?: number; stepMeters?: number }) {
    const widthM = Math.min(campus.width, next.widthM ?? dims.widthM);
    const depthM = Math.min(campus.height, next.depthM ?? dims.depthM);
    const nextGrid = gridFromMeters(widthM, depthM, next.stepMeters ?? grid.stepMeters, grid.scale);
    const nextDims = gridDimensions(nextGrid);
    patch((current) => ({
      grid: nextGrid,
      building: current.building.mode === "new" ? { ...current.building, map: clampRect({ ...current.building.map, ...metersToRect(nextDims.widthM, nextDims.depthM, campus) }) } : current.building,
    }));
  }

  /** Posun / změna velikosti tažením v areálu: velikost po 1 m až do rozměru celého areálu. */
  function onCampusRect(rect: CampusRect, kind: "move" | "resize") {
    if (building.mode !== "new") return;
    if (kind === "move") return patch({ building: { ...building, map: rect } });
    const meters = rectToMeters(rect, campus);
    updateSize({ widthM: Math.max(BUILDING_LIMITS.min, Math.round(meters.w)), depthM: Math.max(BUILDING_LIMITS.min, Math.round(meters.h)) });
  }

  function discardBuilding() {
    applyPreset(PRESETS[0]);
    setStep(1);
    toast.info("Koncept budovy zahozen – začínáte znovu od šablony.");
  }

  function chooseExisting(id: string) {
    const target = data.plant.buildings.find((entry) => entry.id === id);
    const ground = target?.floors.find((floor) => floor.level === 0) ?? target?.floors[0];
    // Stávající budova: jen její skutečná patra – nová se přidávají tlačítky (žádné duplicity).
    patch({ building: { mode: "existing", id }, floors: [], equipment: [], renames: {}, edits: {}, placeFloor: ground ? { kind: "existing", id: ground.id } : concept.placeFloor });
  }

  const newFloors = floors.filter((floor) => !floor.existingId);
  const allLevels = [...existingFloors.map((floor) => floor.level), ...newFloors.map((floor) => floor.level)];
  function addFloor(direction: "up" | "down") {
    const level = direction === "up" ? (allLevels.length ? Math.max(...allLevels) + 1 : 0) : Math.min(0, ...allLevels) - 1;
    const key = nextKey("f");
    patch((current) => ({
      floors: [...current.floors, { key, level, usage: direction === "up" ? "" : "Technické zázemí", zones: [], gates: [] }].sort((a, b) => a.level - b.level),
      zoneFloorKey: key,
      placeFloor: !newFloors.length && !existingFloors.length ? { kind: "draft", key } : current.placeFloor,
    }));
  }

  /** Otevře uložené patro k úpravě: rozvržení z `studioLayoutJson`, u starších pater dopočtené ze SVG. */
  function editExistingFloor(floorId: string) {
    const target = existingFloors.find((floor) => floor.id === floorId);
    if (!target || floors.some((floor) => floor.existingId === floorId)) return;
    const layout = layoutOfFloor(target);
    const key = nextKey("f");
    patch((current) => ({
      floors: [
        ...current.floors,
        { key, existingId: target.id, level: target.level, usage: usageOf(target.name), zones: layout.zones.map((zone) => ({ ...zone, key: nextKey("z") })), gates: layout.gates, grid: { ...layout.grid, scale: grid.scale } },
      ],
      zoneFloorKey: key,
    }));
  }

  const updateFloor = (key: string, update: Partial<StudioFloorDraft>) => patch((current) => ({ floors: current.floors.map((floor) => (floor.key === key ? { ...floor, ...update } : floor)) }));

  function removeFloor(key: string) {
    patch((current) => ({
      floors: current.floors.filter((floor) => floor.key !== key),
      equipment: current.equipment.filter((item) => !(item.floor.kind === "draft" && item.floor.key === key)),
    }));
  }

  // Plátno Studia s jemným pod-rastrem po 1 m (uložený půdorys ho nemá)
  const floorSvg = (floor: StudioFloorDraft) =>
    renderGridFloorplanSvg({ floorName: floorName(floor.level, floor.usage), spec: floor.grid ? { ...floor.grid, scale: grid.scale } : grid, zones: floor.zones, gates: floor.gates, fineGrid: true });
  const setScale = (scale: DrawingScale) => {
    change((all) => all.map((entry) => ({ ...entry, grid: { ...entry.grid, scale } })), false);
    setFloorZoom(scale);
  };
  const zoomFloor = (zoom: ViewZoom) => (zoom === "fit" ? setFloorZoom("fit") : setScale(zoom));

  // Zdroje napájení pro autopilota: rozváděče a trafa závodu + rozváděče aktivní budovy konceptu
  const buildingFloorIds = new Set(existingFloors.map((floor) => floor.id));
  const draftFloorId = (item: StudioEquipmentDraft) => (item.floor.kind === "draft" ? `draft:${item.floor.key}` : item.floor.id);
  const sources: AutopilotSource[] = [
    ...data.equipment
      .filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER")
      .map((item) => {
        const parentType = data.equipment.find((entry) => entry.id === item.fedFromEquipmentId)?.type;
        return {
          id: item.id,
          tag: concept.edits[item.id]?.tag ?? item.tag,
          type: item.type,
          floorId: item.floorId,
          isMain: item.type === "SWITCHBOARD" && (!parentType || parentType === "TRANSFORMER"),
          inBuilding: buildingFloorIds.has(item.floorId),
        };
      }),
    ...equipment
      .filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER")
      .map((item) => ({ id: `draft:${item.key}`, tag: item.tag, type: item.type, floorId: draftFloorId(item), isMain: item.isRoot, inBuilding: true })),
  ];

  function save() {
    startTransition(async () => {
      const result = await saveStudioAction({
        plantId: source.plant.id,
        newPlant: plantMode === "new" ? newPlant : null,
        campus: { widthM: campus.width, depthM: campus.height },
        buildings: concepts.map((entry) => ({
          grid: entry.grid,
          building: entry.building,
          floors: entry.floors,
          equipment: entry.equipment,
          floorRenames: Object.entries(entry.renames).map(([id, usage]) => ({ id, usage })),
          equipmentEdits: Object.values(entry.edits),
        })),
      });
      if (!result.ok) return void toast.error(result.error);
      const many = result.data.buildings > 1;
      toast.success(result.data.plantCreated ? `Závod ${newPlant.name.trim()} založen.` : many ? `Uloženo ${result.data.buildings} ${result.data.buildings < 5 ? "budovy" : "budov"} do závodu.` : "Budova uložena do závodu.", {
        description: `Nových pater: ${result.data.floors}${result.data.editedFloors ? ` · upravených: ${result.data.editedFloors}` : ""} · zařízení: ${result.data.equipment}.`,
      });
      router.push(result.data.href);
    });
  }

  // Izometrický náhled pater aktivní budovy
  const isoFloors: FloorOverview[] = useMemo(() => {
    const normalize = (rooms: { x: number; y: number; w: number; h: number }[]) =>
      rooms.map((room) => ({ x: room.x / FLOOR_VIEWBOX.width, y: room.y / FLOOR_VIEWBOX.height, w: room.w / FLOOR_VIEWBOX.width, h: room.h / FLOOR_VIEWBOX.height }));
    const overview = (id: string, level: number, name: string, rooms: { x: number; y: number; w: number; h: number }[]): FloorOverview => ({
      id,
      code: floorLabel(level).code,
      name,
      description: null,
      level,
      href: "#",
      rooms: normalize(rooms),
      equipment: [],
      counts: { total: 0, pending: 0, waiting: 0 },
      worstStatus: "ACTIVE",
    });
    return [
      ...existingFloors.map((floor) => {
        const draft = floors.find((entry) => entry.existingId === floor.id);
        const rooms = draft ? draft.zones.map((zone) => zoneToRoom(zone, planFrame(draft.grid ?? grid))).filter((room) => room !== null) : extractFloorplanRooms(floor.floorplanSvg ?? "");
        return overview(floor.id, floor.level, floor.name, rooms);
      }),
      ...newFloors.map((floor) => overview(`draft:${floor.key}`, floor.level, floorName(floor.level, floor.usage), floor.zones.map((zone) => zoneToRoom(zone, frame)).filter((room) => room !== null))),
    ].sort((a, b) => a.level - b.level);
  }, [existingFloors, floors, newFloors, frame, grid]);

  const conceptLabel = (entry: Concept) => {
    if (entry.building.mode === "existing") {
      const target = data.plant.buildings.find((item) => item.id === (entry.building as { id: string }).id);
      return `✏️ ${target?.name.split(" - ")[0] ?? "Stávající budova"}`;
    }
    const size = gridDimensions(entry.grid);
    return `${TYPE_EMOJI[entry.building.type]} ${entry.building.name.split(" - ")[0]} (${fmtM(size.widthM)}×${fmtM(size.depthM)} m)`;
  };
  const buildingSwitcher = (testId: string) => (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Budovy v konceptu" data-testid={testId}>
      {concepts.map((entry) => (
        <span key={entry.key} className="flex items-center">
          <button
            type="button"
            role="tab"
            aria-selected={entry.key === concept.key}
            onClick={() => setActiveKey(entry.key)}
            className={cn(
              "h-9 rounded-l-md border px-2.5 text-sm font-medium",
              concepts.length < 2 && "rounded-r-md",
              entry.key === concept.key ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {conceptLabel(entry)}
          </button>
          {concepts.length > 1 ? (
            <button
              type="button"
              onClick={() => removeConcept(entry.key)}
              aria-label={`Odebrat z konceptu: ${conceptLabel(entry)}`}
              className="flex h-9 items-center rounded-r-md border border-l-0 border-border bg-card px-1.5 text-muted-foreground hover:text-red-300"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      <Button variant="outline" className="h-9 gap-1.5" onClick={addBuilding}>
        <Plus className="size-4" aria-hidden /> Přidat další budovu
      </Button>
    </div>
  );

  const campusInvalid = !campusSizeValid(campusInput);
  const campusToolbar = (
    <div className="flex flex-wrap items-end gap-2" data-testid="campus-settings">
      <div className="space-y-1">
        <Label htmlFor="campus-width" className="text-[11px]">
          Šířka areálu – osa X [m]
        </Label>
        <Input
          id="campus-width"
          type="number"
          inputMode="numeric"
          min={CAMPUS_LIMITS.min}
          max={CAMPUS_LIMITS.max}
          value={campusInput.width}
          onChange={(event) => updateCampus({ width: Number(event.target.value) })}
          aria-invalid={campusInvalid}
          className="h-9 w-28 font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="campus-depth" className="text-[11px]">
          Hloubka areálu – osa Y [m]
        </Label>
        <Input
          id="campus-depth"
          type="number"
          inputMode="numeric"
          min={CAMPUS_LIMITS.min}
          max={CAMPUS_LIMITS.max}
          value={campusInput.height}
          onChange={(event) => updateCampus({ height: Number(event.target.value) })}
          aria-invalid={campusInvalid}
          className="h-9 w-28 font-mono"
        />
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Předvolby rozměru areálu">
        {CAMPUS_PRESETS.map((preset) => {
          const activePreset = preset.width === campus.width && preset.height === campus.height;
          return (
            <button
              key={`${preset.width}x${preset.height}`}
              type="button"
              onClick={() => updateCampus(preset)}
              aria-pressed={activePreset}
              className={cn("h-9 rounded-md border px-2 font-mono text-xs", activePreset ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {preset.width}×{preset.height} m
            </button>
          );
        })}
      </div>
      {campusInvalid ? (
        <p className="w-full text-xs text-amber-300">
          Rozsah {CAMPUS_LIMITS.min}–{CAMPUS_LIMITS.max} m na každou osu – mapa zatím zůstává {campus.width} × {campus.height} m.
        </p>
      ) : null}
    </div>
  );
  const newConceptRects = otherConcepts
    .filter((entry) => entry.building.mode === "new")
    .map((entry) => ({ key: entry.key, label: (entry.building as { name: string }).name.split(" - ")[0], rect: (entry.building as { map: CampusRect }).map }));

  return (
    <div className="space-y-6 pb-8">
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Kroky Studia">
        {STEPS.map(({ n, title, icon: Icon }) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => setStep(n)}
              aria-current={step === n ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                step === n ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-mono font-bold", step === n ? "bg-primary text-primary-foreground" : "bg-muted")}>{n}</span>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="font-medium">
                Krok {n}: {title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step > 1 && concepts.length > 1 ? buildingSwitcher("building-switcher-steps") : null}

      {step === 1 ? (
        <section aria-labelledby="step-1" className="space-y-4">
          <h2 id="step-1" className="sr-only">
            Budovy, umístění v areálu a podlaží
          </h2>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Závod">
              <ChoiceButton active={plantMode === "existing"} onClick={() => switchPlantMode("existing")}>
                Přidat budovy do stávajícího závodu ({source.plant.name})
              </ChoiceButton>
              <ChoiceButton active={plantMode === "new"} onClick={() => switchPlantMode("new")}>
                🆕 Vytvořit úplně nový závod od nuly (Čistá mapa areálu)
              </ChoiceButton>
            </div>
            {plantMode === "new" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_7rem_minmax(0,2fr)]" data-testid="new-plant-fields">
                <div className="space-y-1.5">
                  <Label htmlFor="plant-name">Název závodu</Label>
                  <Input id="plant-name" value={newPlant.name} maxLength={120} placeholder="Závod Turnov – Optika" onChange={(event) => setNewPlant({ ...newPlant, name: event.target.value })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plant-code">Kód závodu</Label>
                  <Input id="plant-code" value={newPlant.code} maxLength={6} placeholder="TUR" onChange={(event) => setNewPlant({ ...newPlant, code: event.target.value.toUpperCase() })} className="h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plant-location">Město / adresa</Label>
                  <Input id="plant-location" value={newPlant.location} maxLength={200} placeholder="Nádražní 15, Turnov" onChange={(event) => setNewPlant({ ...newPlant, location: event.target.value })} className="h-11" />
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  <Factory className="size-4 shrink-0" aria-hidden />
                  Mapa začíná jako prázdný oplocený pozemek s vrátnicí; rozměr areálu nastavíte nad mapou. Závod, budovy, patra i zařízení se uloží najednou a aplikace se do nového závodu přepne.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Šablony budov">
            {PRESETS.map((preset) => (
              <Button key={preset.key} variant="outline" className="touch-target" onClick={() => applyPreset(preset)}>
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              {buildingSwitcher("building-switcher")}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Budova">
                <ChoiceButton active={building.mode === "new"} onClick={() => building.mode !== "new" && applyPreset(PRESETS[0])}>
                  Nová budova
                </ChoiceButton>
                <ChoiceButton active={building.mode === "existing"} disabled={!data.plant.buildings.length} onClick={() => data.plant.buildings[0] && chooseExisting(data.plant.buildings[0].id)}>
                  Upravit existující budovu
                </ChoiceButton>
                {building.mode === "new" ? (
                  <Button variant="ghost" className="touch-target ml-auto gap-2 text-muted-foreground" onClick={discardBuilding}>
                    <Trash2 className="size-4" aria-hidden />
                    Zahodit koncept
                  </Button>
                ) : null}
              </div>

              {building.mode === "new" ? (
                <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="building-code">Kód</Label>
                    <Input id="building-code" value={building.code} maxLength={4} onChange={(event) => patch({ building: { ...building, code: event.target.value.toUpperCase() } })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="building-name">Název budovy</Label>
                    <Input id="building-name" value={building.name} maxLength={120} onChange={(event) => patch({ building: { ...building, name: event.target.value } })} className="h-11" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="building-type">Typ</Label>
                    <select id="building-type" value={building.type} onChange={(event) => patch({ building: { ...building, type: event.target.value as BuildingType } })} className={selectClass}>
                      {BUILDING_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {BUILDING_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="building-existing">Budova</Label>
                  <select id="building-existing" value={building.id} onChange={(event) => chooseExisting(event.target.value)} className={selectClass}>
                    {data.plant.buildings.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
                <p className="text-sm font-medium">{building.mode === "existing" ? "Rozměr nových pater" : "Rozměr budovy"}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="building-width" className="text-xs">
                      Šířka budovy – osa X [m]
                    </Label>
                    <Input
                      id="building-width"
                      type="number"
                      inputMode="decimal"
                      min={BUILDING_LIMITS.min}
                      max={campus.width}
                      key={`w:${concept.key}:${dims.widthM}`}
                      defaultValue={dims.widthM}
                      onBlur={(event) => event.target.value && updateSize({ widthM: Number(event.target.value) })}
                      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="building-depth" className="text-xs">
                      Hloubka budovy – osa Y [m]
                    </Label>
                    <Input
                      id="building-depth"
                      type="number"
                      inputMode="decimal"
                      min={BUILDING_LIMITS.min}
                      max={campus.height}
                      key={`d:${concept.key}:${dims.depthM}`}
                      defaultValue={dims.depthM}
                      onBlur={(event) => event.target.value && updateSize({ depthM: Number(event.target.value) })}
                      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                      className="h-10 font-mono"
                    />
                  </div>
                </div>
                <p className="text-sm">
                  <span className="font-mono font-semibold" data-testid="grid-axes">
                    Osa X (šířka): {fmtM(dims.widthM)} m × Osa Y (hloubka): {fmtM(dims.depthM)} m
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Rozměr <span data-testid="grid-dimensions">{dims.label}</span> · {Math.round(dims.widthM * dims.depthM).toLocaleString("cs-CZ")} m² · {BUILDING_LIMITS.min} m až {campus.width} × {campus.height} m
                    (areál)
                  </span>
                </p>
                <details className="rounded-md border border-border p-2 text-sm" data-testid="grid-advanced">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Pokročilé: Rozteč nosných sloupů (výchozí 6 m / 12 m) · osy 1–{frame.cols} × A–{rowLabel(frame.rows - 1)}
                  </summary>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {[6, 12].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={grid.stepMeters === value}
                        onClick={() => updateSize({ stepMeters: value })}
                        className={cn("h-9 rounded-md border px-3 font-mono text-xs", grid.stepMeters === value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}
                      >
                        {value} m
                      </button>
                    ))}
                    <div className="space-y-1">
                      <Label htmlFor="grid-step" className="text-[11px]">
                        Vlastní rozteč [m]
                      </Label>
                      <Input
                        id="grid-step"
                        type="number"
                        step={0.5}
                        min={2}
                        max={30}
                        key={`s:${concept.key}:${grid.stepMeters}`}
                        defaultValue={grid.stepMeters}
                        onBlur={(event) => event.target.value && updateSize({ stepMeters: Number(event.target.value) })}
                        className="h-9 w-24 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="grid-scale" className="text-[11px]">
                        Měřítko výkresu
                      </Label>
                      <select id="grid-scale" value={grid.scale} onChange={(event) => setScale(event.target.value as DrawingScale)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                        {SCALES.map((scale) => (
                          <option key={scale} value={scale}>
                            {scale}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Počet sloupových os se dopočítává automaticky z rozměru budovy – rastr velikost budovy neomezuje.</p>
                </details>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Podlaží</p>
                <ul className="space-y-2" aria-label="Podlaží budovy">
                  {[...existingFloors.map((floor) => ({ kind: "existing" as const, floor })), ...newFloors.map((floor) => ({ kind: "draft" as const, floor }))]
                    .sort((a, b) => b.floor.level - a.floor.level)
                    .map((entry) =>
                      entry.kind === "existing" ? (
                        <li key={entry.floor.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
                          <span className="w-14 shrink-0 font-mono text-sm font-semibold">{floorLabel(entry.floor.level).short}</span>
                          <Input
                            value={concept.renames[entry.floor.id] ?? usageOf(entry.floor.name)}
                            onChange={(event) => patch((current) => ({ renames: { ...current.renames, [entry.floor.id]: event.target.value } }))}
                            placeholder="Využití patra"
                            aria-label={`Využití patra ${floorLabel(entry.floor.level).short}`}
                            maxLength={80}
                            className="h-10"
                          />
                          <span className="shrink-0 text-xs text-muted-foreground">stávající</span>
                        </li>
                      ) : (
                        <li key={entry.floor.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <span className="w-14 shrink-0 font-mono text-sm font-semibold">{floorLabel(entry.floor.level).short}</span>
                          <Input
                            value={entry.floor.usage}
                            onChange={(event) => updateFloor(entry.floor.key, { usage: event.target.value })}
                            placeholder="Využití patra, např. Montážní linky"
                            aria-label={`Využití patra ${floorLabel(entry.floor.level).short}`}
                            maxLength={80}
                            className="h-10"
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeFloor(entry.floor.key)} aria-label={`Odebrat ${floorLabel(entry.floor.level).short}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ),
                    )}
                </ul>
                {/* Nadzemní patro nahoře, podzemní pod ním – stejně jako pořadí pater v seznamu */}
                <div className="flex flex-col gap-2" data-testid="floor-add-buttons">
                  <Button variant="outline" className="touch-target justify-start gap-2" onClick={() => addFloor("up")}>
                    <Plus className="size-4" aria-hidden />
                    Přidat nadzemní patro (NP)
                  </Button>
                  <Button variant="outline" className="touch-target justify-start gap-2" onClick={() => addFloor("down")}>
                    <Plus className="size-4" aria-hidden />
                    Přidat podzemní patro (PP)
                  </Button>
                  {building.mode === "existing" ? (
                    <Button variant="ghost" className="touch-target gap-2" onClick={() => setStep(3)}>
                      Rovnou osadit zařízení
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {buildingSwitcher("building-switcher-map")}
              <CampusPlacementMap
                buildings={data.plant.buildings}
                rect={building.mode === "new" ? building.map : null}
                onChange={building.mode === "new" ? onCampusRect : undefined}
                highlightId={building.mode === "existing" ? building.id : null}
                newLabel={building.mode === "new" ? building.name.split(" - ")[0] : undefined}
                plantCode={plantMode === "new" ? "" : source.plant.code}
                campus={campus}
                zoom={campusZoom}
                onZoom={setCampusZoom}
                toolbar={campusToolbar}
                others={newConceptRects}
                onSelectOther={setActiveKey}
                label="Mapa areálu – umístění budov"
              />
              <div className="rounded-xl border border-border bg-card p-2">
                {isoFloors.length ? (
                  <IsometricBuilding floors={isoFloors} hoveredId={hoveredFloor} onHover={setHoveredFloor} onSelect={() => setStep(2)} />
                ) : (
                  <p className="p-6 text-center text-sm text-muted-foreground">Přidejte patro.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <ZoneStep
          key={concept.key}
          floors={floors}
          activeKey={concept.zoneFloorKey}
          onActive={(key) => patch({ zoneFloorKey: key }, false)}
          grid={grid}
          svgFor={floorSvg}
          existingFloors={existingFloors}
          onEditExisting={editExistingFloor}
          onDiscard={removeFloor}
          onChange={(key, update) => updateFloor(key, update)}
          zoom={floorZoom}
          onZoom={zoomFloor}
          newKey={() => nextKey("z")}
          history={history}
          onCheckpoint={checkpoint}
        />
      ) : null}

      {step === 3 ? (
        <PlacementStep
          key={concept.key}
          frame={frame}
          zoom={floorZoom}
          onZoom={zoomFloor}
          floors={floors}
          existingFloors={existingFloors}
          active={concept.placeFloor}
          onActive={(ref) => patch({ placeFloor: ref }, false)}
          svgFor={floorSvg}
          data={data}
          equipment={equipment}
          edits={concept.edits}
          sources={sources}
          buildingCode={buildingCode}
          buildingTitle={buildingTitle}
          onAdd={(item) => patch((current) => ({ equipment: [...current.equipment, { ...item, key: nextKey("e") }] }))}
          onUpdate={(key, update) => patch((current) => ({ equipment: current.equipment.map((item) => (item.key === key ? { ...item, ...update } : item)) }))}
          onRemove={(key) => patch((current) => ({ equipment: current.equipment.filter((item) => item.key !== key && !(item.parent?.kind === "draft" && item.parent.key === key)) }))}
          onEditExisting={(edit) => patch((current) => ({ edits: { ...current.edits, [edit.id]: edit } }))}
          history={history}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="outline" className="touch-target gap-2" disabled={step === 1} onClick={() => setStep((value) => value - 1)}>
          <ArrowLeft className="size-4" aria-hidden />
          Předchozí krok
        </Button>
        <p className="text-sm text-muted-foreground">
          Koncept: {concepts.length} {concepts.length === 1 ? "budova" : concepts.length < 5 ? "budovy" : "budov"} · {concepts.reduce((sum, entry) => sum + entry.floors.filter((floor) => !floor.existingId).length, 0)} nových pater ·{" "}
          {concepts.reduce((sum, entry) => sum + entry.floors.reduce((rooms, floor) => rooms + floor.zones.length, 0), 0)} místností · {concepts.reduce((sum, entry) => sum + entry.equipment.length, 0)} zařízení
        </p>
        {step < 3 ? (
          <Button className="touch-target gap-2" onClick={() => setStep((value) => value + 1)}>
            Další krok
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button className="touch-target gap-2" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {plantMode === "new" ? "Založit závod a uložit budovy" : concepts.length > 1 ? `Uložit ${concepts.length} ${concepts.length < 5 ? "budovy" : "budov"} do závodu` : "Uložit budovu do závodu"}
          </Button>
        )}
      </div>
    </div>
  );
}
