"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Factory, Loader2, Plug, Plus, Save, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { IsometricBuilding } from "@/components/map/isometric/IsometricBuilding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingType } from "@/generated/prisma/enums";
import { DEFAULT_GRID, FLOOR_VIEWBOX, GRID_LIMITS, SCALES, clampGrid, fmtM, gridDimensions, planFrame, renderGridFloorplanSvg, zoneToRoom, type DrawingScale, type GridSpec } from "@/lib/cad-grid";
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
import { floorLabel, floorName, type StudioBuildingDraft, type StudioEquipmentDraft, type StudioFloorDraft, type StudioNewPlantDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import { saveStudioAction } from "@/server/actions/studio";
import type { FloorOverview } from "@/server/queries/building";
import type { StudioData } from "@/server/queries/studio";

import { CampusPlacementMap } from "./CampusPlacementMap";
import { PlacementStep, type FloorRef } from "./PlacementStep";
import type { ViewZoom } from "./PlanViewport";
import { ChoiceButton, NumberField, selectClass } from "./studio-ui";
import { ZoneStep } from "./ZoneStep";

const STEPS = [
  { n: 1, title: "Budova, umístění a podlaží", icon: Building2 },
  { n: 2, title: "Místnosti, zóny a vrata", icon: Shapes },
  { n: 3, title: "Zařízení a napájení", icon: Plug },
] as const;

/** Šablony budov na 1 klik: rozměr (rastr), typ a patra. */
const PRESETS: { key: string; label: string; name: string; type: BuildingType; grid: Omit<GridSpec, "scale">; floors: { level: number; usage: string }[] }[] = [
  { key: "hall", label: "🏭 Výrobní hala (66 × 42 m, rastr 12×8)", name: "Výroba", type: "PRODUCTION", grid: { cols: 12, rows: 8, stepMeters: 6 }, floors: [{ level: 0, usage: "Hlavní výroba" }] },
  {
    key: "energy",
    label: "⚡ Energetika / Rozvodna (24 × 18 m, 1. PP + 1. NP)",
    name: "Energetika",
    type: "ENERGY",
    grid: { cols: 5, rows: 4, stepMeters: 6 },
    floors: [
      { level: -1, usage: "Rozvodny" },
      { level: 0, usage: "Trafostanice" },
    ],
  },
  {
    key: "office",
    label: "🏢 Administrativa (36 × 24 m, 2 patra)",
    name: "Administrativa",
    type: "OFFICE",
    grid: { cols: 7, rows: 5, stepMeters: 6 },
    floors: [
      { level: 0, usage: "Recepce a kanceláře" },
      { level: 1, usage: "Kanceláře" },
    ],
  },
  { key: "warehouse", label: "📦 Sklad / Expedice (48 × 30 m)", name: "Sklad", type: "WAREHOUSE", grid: { cols: 9, rows: 6, stepMeters: 6 }, floors: [{ level: 0, usage: "Expediční sklad" }] },
];

const BUILDING_TYPES = Object.keys(BUILDING_TYPE_LABELS) as BuildingType[];

type PlantMode = "existing" | "new";

const NEW_PLANT_DEFAULT: StudioNewPlantDraft = { name: "", code: "", location: "" };
const NEW_CAMPUS_DEFAULT: CampusSize = { width: 300, height: 200 };

/** První volné písmeno kódu budovy v závodě. */
function freeBuildingCode(buildings: { code: string }[]) {
  const used = new Set(buildings.map((building) => building.code.toUpperCase()));
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((letter) => !used.has(letter)) ?? "N";
}

/** Nový závod od nuly: čistá mapa bez budov a bez zdrojů napájení. */
const cleanScene = (data: StudioData): StudioData => ({ ...data, plant: { ...data.plant, buildings: [] }, equipment: [] });

/** Studio výstavby závodu – 3 kroky bez ručních souřadnic, uložení v jedné transakci. */
export function StudioWizard({ data: source, startNewPlant = false }: { data: StudioData; startNewPlant?: boolean }) {
  const router = useRouter();
  // Režim závodu: budova do stávajícího závodu, nebo úplně nový závod od nuly (čistá mapa areálu).
  const [plantMode, setPlantMode] = useState<PlantMode>(startNewPlant ? "new" : "existing");
  const [newPlant, setNewPlant] = useState<StudioNewPlantDraft>(NEW_PLANT_DEFAULT);
  const plantCampus: CampusSize = { width: source.plant.campusWidthM, height: source.plant.campusDepthM };
  // Rozměr areálu (osa X × osa Y) – editovatelný v obou režimech; vstupy se ověřují až při použití.
  const [campusInput, setCampusInput] = useState<CampusSize>(startNewPlant ? NEW_CAMPUS_DEFAULT : plantCampus);
  const [campus, setCampus] = useState<CampusSize>(startNewPlant ? NEW_CAMPUS_DEFAULT : plantCampus);
  const [campusZoom, setCampusZoom] = useState<ViewZoom>("fit");
  // Zoom půdorysu (kroky 2 a 3): „Celé“, nebo skutečné měřítko výkresu z přepínače Měřítko
  const [floorZoom, setFloorZoom] = useState<ViewZoom>("fit");
  const baseData = useMemo(() => (plantMode === "new" ? cleanScene(source) : source), [plantMode, source]);
  // Stávající budovy přepočtené na aktuální rozměr areálu (stejná poloha v metrech).
  const data = useMemo<StudioData>(() => {
    if (campus.width === plantCampus.width && campus.height === plantCampus.height) return baseData;
    return {
      ...baseData,
      plant: {
        ...baseData.plant,
        buildings: baseData.plant.buildings.map((building) => ({
          ...building,
          mapPolygon: rescalePolygon(building.mapPolygon, plantCampus, campus),
          labelX: (building.labelX * plantCampus.width) / campus.width,
          labelY: (building.labelY * plantCampus.height) / campus.height,
        })),
      },
    };
    // plantCampus je odvozený ze `source`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseData, campus, source.plant.campusWidthM, source.plant.campusDepthM]);
  const counter = useRef(1);
  const nextKey = (prefix: string) => `${prefix}${counter.current++}`;
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  const freeCode = useMemo(() => freeBuildingCode(data.plant.buildings), [data.plant.buildings]);

  // Krok 1 – budova, umístění, rastr a patra
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  const dims = gridDimensions(grid);
  const frame = useMemo(() => planFrame(grid), [grid]);
  const [building, setBuilding] = useState<StudioBuildingDraft>(() => ({
    mode: "new",
    code: freeCode,
    name: `Hala ${freeCode} - Výroba`,
    type: "PRODUCTION",
    map: findFreeSpot(
      metersToRect(66, 42, campus),
      data.plant.buildings.map((entry) => polygonBounds(entry.mapPolygon)),
    ),
  }));
  const [floors, setFloors] = useState<StudioFloorDraft[]>([{ key: "f0", level: 0, usage: "Hlavní výroba", zones: [], gates: [] }]);
  const existingBuilding = building.mode === "existing" ? data.plant.buildings.find((entry) => entry.id === building.id) : undefined;
  const existingFloors = useMemo(() => existingBuilding?.floors ?? [], [existingBuilding]);
  const [hoveredFloor, setHoveredFloor] = useState<string | null>(null);
  const buildingCode = building.mode === "new" ? building.code : (existingBuilding?.code ?? "X");
  const buildingTitle = building.mode === "new" ? building.name : (existingBuilding?.name ?? "");

  // Kroky 2 a 3
  const [zoneFloorKey, setZoneFloorKey] = useState("f0");
  const [equipment, setEquipment] = useState<StudioEquipmentDraft[]>([]);
  const [placeFloor, setPlaceFloor] = useState<FloorRef>({ kind: "draft", key: "f0" });

  /** Šablona budovy (i „Zahodit koncept“ a přepnutí režimu závodu – kontext areálu se předává výslovně). */
  function applyPreset(preset: (typeof PRESETS)[number], scene: { buildings: { code: string; mapPolygon: string }[]; campus: CampusSize } = { buildings: data.plant.buildings, campus }) {
    const nextGrid = clampGrid({ ...preset.grid, scale: grid.scale });
    setGrid(nextGrid);
    const size = metersToRect(gridDimensions(nextGrid).widthM, gridDimensions(nextGrid).depthM, scene.campus);
    const code = freeBuildingCode(scene.buildings);
    setBuilding({
      mode: "new",
      code,
      name: preset.type === "PRODUCTION" ? `Hala ${code} - ${preset.name}` : `${preset.name} ${code}`,
      type: preset.type,
      map: findFreeSpot(
        size,
        scene.buildings.map((entry) => polygonBounds(entry.mapPolygon)),
      ),
    });
    const next = preset.floors.map((floor) => ({ key: nextKey("f"), level: floor.level, usage: floor.usage, zones: [], gates: [] }));
    setFloors(next);
    setEquipment([]);
    const ground = next.find((floor) => floor.level === 0) ?? next[0];
    setZoneFloorKey(ground.key);
    setPlaceFloor({ kind: "draft", key: ground.key });
  }

  function switchPlantMode(mode: PlantMode) {
    if (mode === plantMode) return;
    setPlantMode(mode);
    const nextCampus = mode === "new" ? NEW_CAMPUS_DEFAULT : plantCampus;
    setCampus(nextCampus);
    setCampusInput(nextCampus);
    applyPreset(PRESETS[0], { buildings: mode === "new" ? [] : source.plant.buildings, campus: nextCampus });
  }

  /** Nový rozměr areálu: nová budova si zachová polohu i rozměr v metrech a zůstane uvnitř pozemku. */
  function updateCampus(patch: Partial<CampusSize>) {
    const next = { ...campusInput, ...patch };
    setCampusInput(next);
    if (!campusSizeValid(next)) return;
    if (building.mode === "new") setBuilding({ ...building, map: clampRect(rescaleRect(building.map, campus, next)) });
    setCampus(next);
  }

  /** Změna rastru: obrys nové budovy v areálu odpovídá rozměru haly. */
  function updateGrid(patch: Partial<GridSpec>) {
    const next = clampGrid({ ...grid, ...patch });
    setGrid(next);
    if (building.mode === "new") {
      const size = metersToRect(gridDimensions(next).widthM, gridDimensions(next).depthM, campus);
      setBuilding({ ...building, map: clampRect({ ...building.map, ...size }) });
    }
  }

  /** Posun / změna velikosti budovy v areálu; velikost se přichytí na rozteč sloupů (počet os). */
  function onCampusRect(rect: CampusRect, kind: "move" | "resize") {
    if (building.mode !== "new") return;
    if (kind === "move") return setBuilding({ ...building, map: rect });
    const meters = rectToMeters(rect, campus);
    const next = clampGrid({ ...grid, cols: Math.round(meters.w / grid.stepMeters) + 1, rows: Math.round(meters.h / grid.stepMeters) + 1 });
    setGrid(next);
    const size = metersToRect(gridDimensions(next).widthM, gridDimensions(next).depthM, campus);
    setBuilding({ ...building, map: clampRect({ ...rect, ...size }) });
  }

  function discardBuilding() {
    applyPreset(PRESETS[0]);
    setStep(1);
    toast.info("Koncept budovy zahozen – začínáte znovu od šablony.");
  }

  function chooseExisting(id: string) {
    setBuilding({ mode: "existing", id });
    // Stávající budova: jen její skutečná patra – nová se přidávají tlačítky (žádné duplicity).
    setFloors([]);
    setEquipment([]);
    const target = data.plant.buildings.find((entry) => entry.id === id);
    const ground = target?.floors.find((floor) => floor.level === 0) ?? target?.floors[0];
    if (ground) setPlaceFloor({ kind: "existing", id: ground.id });
  }

  const allLevels = [...existingFloors.map((floor) => floor.level), ...floors.map((floor) => floor.level)];
  function addFloor(direction: "up" | "down") {
    const level = direction === "up" ? (allLevels.length ? Math.max(...allLevels) + 1 : 0) : Math.min(0, ...allLevels) - 1;
    const key = nextKey("f");
    setFloors((current) => [...current, { key, level, usage: direction === "up" ? "" : "Technické zázemí", zones: [], gates: [] }].sort((a, b) => a.level - b.level));
    setZoneFloorKey(key);
    if (!floors.length && !existingFloors.length) setPlaceFloor({ kind: "draft", key });
  }

  const updateFloor = (key: string, patch: Partial<StudioFloorDraft>) => setFloors((current) => current.map((floor) => (floor.key === key ? { ...floor, ...patch } : floor)));

  function removeFloor(key: string) {
    setFloors((current) => current.filter((floor) => floor.key !== key));
    setEquipment((current) => current.filter((item) => !(item.floor.kind === "draft" && item.floor.key === key)));
  }

  // Plátno Studia s jemným pod-rastrem po 1 m (uložený půdorys ho nemá)
  const floorSvg = (floor: StudioFloorDraft) => renderGridFloorplanSvg({ floorName: floorName(floor.level, floor.usage), spec: grid, zones: floor.zones, gates: floor.gates, fineGrid: true });
  const setScale = (scale: DrawingScale) => {
    setGrid((current) => ({ ...current, scale }));
    setFloorZoom(scale);
  };
  const zoomFloor = (zoom: ViewZoom) => (zoom === "fit" ? setFloorZoom("fit") : setScale(zoom));

  // Zdroje napájení pro autopilota: rozváděče a trafa závodu + rozváděče konceptu
  const buildingFloorIds = new Set(existingFloors.map((floor) => floor.id));
  const draftFloorId = (item: StudioEquipmentDraft) => (item.floor.kind === "draft" ? `draft:${item.floor.key}` : item.floor.id);
  const sources: AutopilotSource[] = [
    ...data.equipment
      .filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER")
      .map((item) => {
        const parentType = data.equipment.find((entry) => entry.id === item.fedFromEquipmentId)?.type;
        return {
          id: item.id,
          tag: item.tag,
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
        grid,
        building,
        floors,
        equipment,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.data.plantCreated ? `Závod ${newPlant.name.trim()} založen.` : "Budova uložena do závodu.", {
        description: `${result.data.plantCreated ? "První budova uložena · " : ""}Pater: ${result.data.floors} · zařízení: ${result.data.equipment}.`,
      });
      router.push(result.data.href);
    });
  }

  // Izometrický náhled pater
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
      ...existingFloors.map((floor) => overview(floor.id, floor.level, floor.name, extractFloorplanRooms(floor.floorplanSvg ?? ""))),
      ...floors.map((floor) => overview(`draft:${floor.key}`, floor.level, floorName(floor.level, floor.usage), floor.zones.map((zone) => zoneToRoom(zone, frame)).filter((room) => room !== null))),
    ].sort((a, b) => a.level - b.level);
  }, [existingFloors, floors, frame]);

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
              className={cn(
                "h-9 rounded-md border px-2 font-mono text-xs",
                activePreset ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
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

      {step === 1 ? (
        <section aria-labelledby="step-1" className="space-y-4">
          <h2 id="step-1" className="sr-only">
            Budova, umístění v areálu a podlaží
          </h2>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Závod">
              <ChoiceButton active={plantMode === "existing"} onClick={() => switchPlantMode("existing")}>
                Přidat budovu do stávajícího závodu ({source.plant.name})
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
                  Mapa začíná jako prázdný oplocený pozemek s vrátnicí; rozměr areálu nastavíte nad mapou. Závod, budova, patra i zařízení se uloží najednou a aplikace se do nového závodu přepne.
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
                    <Input id="building-code" value={building.code} maxLength={4} onChange={(event) => setBuilding({ ...building, code: event.target.value.toUpperCase() })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="building-name">Název budovy</Label>
                    <Input id="building-name" value={building.name} maxLength={120} onChange={(event) => setBuilding({ ...building, name: event.target.value })} className="h-11" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="building-type">Typ</Label>
                    <select id="building-type" value={building.type} onChange={(event) => setBuilding({ ...building, type: event.target.value as BuildingType })} className={selectClass}>
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

              <div className="space-y-2">
                <p className="text-sm font-medium">Podlaží</p>
                <ul className="space-y-2" aria-label="Podlaží budovy">
                  {[...existingFloors.map((floor) => ({ kind: "existing" as const, floor })), ...floors.map((floor) => ({ kind: "draft" as const, floor }))]
                    .sort((a, b) => b.floor.level - a.floor.level)
                    .map((entry) =>
                      entry.kind === "existing" ? (
                        <li key={entry.floor.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                          <span className="w-14 shrink-0 font-mono font-semibold">{floorLabel(entry.floor.level).short}</span>
                          <span className="flex-1 text-muted-foreground">{entry.floor.name.split(" - ")[1] ?? ""}</span>
                          <span className="text-xs text-muted-foreground">stávající</span>
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

              <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
                <p className="text-sm font-medium">Konstrukční rastr{building.mode === "existing" ? " nových pater" : ""}</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField id="grid-cols" label={`Osa X: počet os 1…N (${GRID_LIMITS.cols.min}–${GRID_LIMITS.cols.max})`} value={grid.cols} onChange={(cols) => updateGrid({ cols })} />
                  <NumberField id="grid-rows" label={`Osa Y: počet os A…Z (${GRID_LIMITS.rows.min}–${GRID_LIMITS.rows.max})`} value={grid.rows} onChange={(rows) => updateGrid({ rows })} />
                  <NumberField id="grid-step" label="Rozteč sloupů [m]" value={grid.stepMeters} step={0.5} onChange={(stepMeters) => updateGrid({ stepMeters })} />
                  <div className="space-y-1.5">
                    <Label htmlFor="grid-scale" className="text-xs">
                      Měřítko výkresu
                    </Label>
                    <select id="grid-scale" value={grid.scale} onChange={(event) => setScale(event.target.value as DrawingScale)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {SCALES.map((scale) => (
                        <option key={scale} value={scale}>
                          {scale}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="font-mono font-semibold" data-testid="grid-axes">
                    Osa X (šířka): {fmtM(dims.widthM)} m × Osa Y (hloubka): {fmtM(dims.depthM)} m
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Rozměr <span data-testid="grid-dimensions">{dims.label}</span> · {Math.round(dims.widthM * dims.depthM).toLocaleString("cs-CZ")} m² · osy 1–{grid.cols} × A–{String.fromCharCode(64 + grid.rows)}, M {grid.scale}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
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
                label="Mapa areálu – umístění budovy"
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
          floors={floors}
          activeKey={zoneFloorKey}
          onActive={setZoneFloorKey}
          grid={grid}
          frame={frame}
          svgFor={floorSvg}
          onChange={(key, patch) => updateFloor(key, patch)}
          zoom={floorZoom}
          onZoom={zoomFloor}
          newKey={() => nextKey("z")}
        />
      ) : null}

      {step === 3 ? (
        <PlacementStep
          frame={frame}
          zoom={floorZoom}
          onZoom={zoomFloor}
          floors={floors}
          existingFloors={existingFloors}
          active={placeFloor}
          onActive={setPlaceFloor}
          svgFor={floorSvg}
          data={data}
          equipment={equipment}
          sources={sources}
          buildingCode={buildingCode}
          buildingTitle={buildingTitle}
          onAdd={(item) => setEquipment((current) => [...current, { ...item, key: nextKey("e") }])}
          onRemove={(key) => setEquipment((current) => current.filter((item) => item.key !== key && !(item.parent?.kind === "draft" && item.parent.key === key)))}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="outline" className="touch-target gap-2" disabled={step === 1} onClick={() => setStep((value) => value - 1)}>
          <ArrowLeft className="size-4" aria-hidden />
          Zpět
        </Button>
        <p className="text-sm text-muted-foreground">
          Koncept: {floors.length} nových pater · {floors.reduce((sum, floor) => sum + floor.zones.length, 0)} místností · {equipment.length} zařízení
        </p>
        {step < 3 ? (
          <Button className="touch-target gap-2" onClick={() => setStep((value) => value + 1)}>
            Další krok
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button className="touch-target gap-2" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {plantMode === "new" ? "Založit závod a uložit budovu" : "Uložit budovu do závodu"}
          </Button>
        )}
      </div>
    </div>
  );
}
