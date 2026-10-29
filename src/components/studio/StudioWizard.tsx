"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, DoorOpen, Loader2, Plug, Plus, Save, Shapes, SquareDashedMousePointer, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PowerSpiderOverlay } from "@/components/map/floorplan/PowerSpiderOverlay";
import { IsometricBuilding } from "@/components/map/isometric/IsometricBuilding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";
import {
  DEFAULT_GRID,
  FLOOR_TEMPLATES,
  FLOOR_VIEWBOX,
  GRID_LIMITS,
  SCALES,
  ZONE_KINDS,
  clampGrid,
  floorTemplate,
  gateToFloorplan,
  gridDimensions,
  gridToPercent,
  parseGridRef,
  renderGridFloorplanSvg,
  zoneAt,
  zoneToRoom,
  type DrawingScale,
  type GridSpec,
  type ZoneKind,
} from "@/lib/cad-grid";
import { findFreeSpot, metersToRect, polygonBounds } from "@/lib/campus-layout";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { BUILDING_TYPE_LABELS, EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { extractFloorplanRooms } from "@/lib/mock-graphics/floorplan";
import { POWER_ROLE_HINTS, powerRole, suggestCircuit, validatePlacement } from "@/lib/power-hierarchy";
import type { SpiderItem } from "@/lib/power-tree";
import { bestParent, nextTag, suggestName, type AutopilotSource } from "@/lib/studio-autopilot";
import { floorLabel, floorName, type StudioBuildingDraft, type StudioEquipmentDraft, type StudioFloorDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import { saveStudioAction } from "@/server/actions/studio";
import type { FloorOverview } from "@/server/queries/building";
import type { StudioData } from "@/server/queries/studio";

import { CampusPlacementMap } from "./CampusPlacementMap";
import { GridCanvas } from "./GridCanvas";

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

const PLACEABLE: EquipmentType[] = [
  "SWITCHBOARD",
  "TRANSFORMER",
  "PRODUCTION_LINE",
  "MACHINE",
  "CNC_MACHINE",
  "ROBOT_CELL",
  "COMPRESSOR",
  "HVAC_UNIT",
  "APPLIANCE",
  "POWER_TOOL",
  "WELDER",
  "EXTENSION_CORD",
  "EMERGENCY_LIGHTING",
  "LIGHTNING_ROD",
];

const BUILDING_TYPES = Object.keys(BUILDING_TYPE_LABELS) as BuildingType[];
const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type FloorRef = { kind: "draft"; key: string } | { kind: "existing"; id: string };
const floorRefKey = (ref: FloorRef) => (ref.kind === "draft" ? `draft:${ref.key}` : ref.id);

/** Studio výstavby závodu – 3 kroky bez ručních souřadnic, uložení v jedné transakci. */
export function StudioWizard({ data }: { data: StudioData }) {
  const router = useRouter();
  const counter = useRef(1);
  const nextKey = (prefix: string) => `${prefix}${counter.current++}`;
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  const obstacles = useMemo(() => data.plant.buildings.map((building) => polygonBounds(building.mapPolygon)), [data.plant.buildings]);
  const freeCode = useMemo(() => {
    const used = new Set(data.plant.buildings.map((building) => building.code.toUpperCase()));
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((letter) => !used.has(letter)) ?? "N";
  }, [data.plant.buildings]);

  // Krok 1 – budova, umístění, rastr a patra
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  const dims = gridDimensions(grid);
  const [building, setBuilding] = useState<StudioBuildingDraft>(() => ({
    mode: "new",
    code: freeCode,
    name: `Hala ${freeCode} - Výroba`,
    type: "PRODUCTION",
    map: findFreeSpot(metersToRect(66, 42), obstacles),
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

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const nextGrid = clampGrid({ ...preset.grid, scale: grid.scale });
    setGrid(nextGrid);
    const size = metersToRect(gridDimensions(nextGrid).widthM, gridDimensions(nextGrid).depthM);
    setBuilding({
      mode: "new",
      code: freeCode,
      name: preset.type === "PRODUCTION" ? `Hala ${freeCode} - ${preset.name}` : `${preset.name} ${freeCode}`,
      type: preset.type,
      map: findFreeSpot(size, obstacles),
    });
    const next = preset.floors.map((floor) => ({ key: nextKey("f"), level: floor.level, usage: floor.usage, zones: [], gates: [] }));
    setFloors(next);
    setEquipment([]);
    const ground = next.find((floor) => floor.level === 0) ?? next[0];
    setZoneFloorKey(ground.key);
    setPlaceFloor({ kind: "draft", key: ground.key });
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

  const floorSvg = (floor: StudioFloorDraft) => renderGridFloorplanSvg({ floorName: floorName(floor.level, floor.usage), spec: grid, zones: floor.zones, gates: floor.gates });

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
      const result = await saveStudioAction({ plantId: data.plant.id, grid, building, floors, equipment });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Budova uložena do závodu.", { description: `Pater: ${result.data.floors} · zařízení: ${result.data.equipment}.` });
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
      ...floors.map((floor) => overview(`draft:${floor.key}`, floor.level, floorName(floor.level, floor.usage), floor.zones.map((zone) => zoneToRoom(zone, grid)).filter((room) => room !== null))),
    ].sort((a, b) => a.level - b.level);
  }, [existingFloors, floors, grid]);

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
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="touch-target gap-2" onClick={() => addFloor("down")}>
                    <Plus className="size-4" aria-hidden />
                    Přidat podzemní patro (PP)
                  </Button>
                  <Button variant="outline" className="touch-target gap-2" onClick={() => addFloor("up")}>
                    <Plus className="size-4" aria-hidden />
                    Přidat nadzemní patro (NP)
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
                  <NumberField id="grid-cols" label={`Osy 1…N (${GRID_LIMITS.cols.min}–${GRID_LIMITS.cols.max})`} value={grid.cols} onChange={(cols) => setGrid((current) => clampGrid({ ...current, cols }))} />
                  <NumberField id="grid-rows" label={`Osy A…Z (${GRID_LIMITS.rows.min}–${GRID_LIMITS.rows.max})`} value={grid.rows} onChange={(rows) => setGrid((current) => clampGrid({ ...current, rows }))} />
                  <NumberField id="grid-step" label="Rozteč sloupů [m]" value={grid.stepMeters} step={0.5} onChange={(stepMeters) => setGrid((current) => clampGrid({ ...current, stepMeters }))} />
                  <div className="space-y-1.5">
                    <Label htmlFor="grid-scale" className="text-xs">
                      Měřítko
                    </Label>
                    <select
                      id="grid-scale"
                      value={grid.scale}
                      onChange={(event) => setGrid((current) => ({ ...current, scale: event.target.value as DrawingScale }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {SCALES.map((scale) => (
                        <option key={scale} value={scale}>
                          {scale}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm">
                  Rozměr: <span className="font-mono text-lg font-semibold" data-testid="grid-dimensions">{dims.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    Osy 1–{grid.cols} × A–{String.fromCharCode(64 + grid.rows)}, sloupy v průsečících, M {grid.scale}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <CampusPlacementMap
                buildings={data.plant.buildings}
                rect={building.mode === "new" ? building.map : null}
                onChange={building.mode === "new" ? (map) => setBuilding({ ...building, map }) : undefined}
                highlightId={building.mode === "existing" ? building.id : null}
                newLabel={building.mode === "new" ? building.name.split(" - ")[0] : undefined}
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

      {step === 2 ? <ZoneStep floors={floors} activeKey={zoneFloorKey} onActive={setZoneFloorKey} grid={grid} svgFor={floorSvg} onChange={(key, patch) => updateFloor(key, patch)} /> : null}

      {step === 3 ? (
        <PlacementStep
          grid={grid}
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
            Uložit budovu do závodu
          </Button>
        )}
      </div>
    </div>
  );
}

function NumberField({ id, label, value, onChange, step = 1 }: { id: string; label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} type="number" inputMode="decimal" step={step} value={value} onChange={(event) => event.target.value !== "" && onChange(Number(event.target.value))} className="h-10 font-mono" />
    </div>
  );
}

function ChoiceButton({ active, onClick, disabled = false, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "touch-target rounded-lg border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FloorTabs({ items, active, onActive }: { items: { id: string; label: string; isNew?: boolean }[]; active: string; onActive: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1" role="tablist" aria-label="Patro">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          onClick={() => onActive(item.id)}
          title={item.isNew ? "Nové patro" : undefined}
          className={cn("flex h-9 items-center gap-1.5 rounded-md px-3 font-mono text-sm", item.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          {item.label}
          {item.isNew ? <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden /> : null}
        </button>
      ))}
    </div>
  );
}

function ZoneStep({
  floors,
  activeKey,
  onActive,
  grid,
  svgFor,
  onChange,
}: {
  floors: StudioFloorDraft[];
  activeKey: string;
  onActive: (key: string) => void;
  grid: GridSpec;
  svgFor: (floor: StudioFloorDraft) => string;
  onChange: (key: string, patch: Partial<StudioFloorDraft>) => void;
}) {
  const floor = floors.find((entry) => entry.key === activeKey) ?? floors[0];
  const [mode, setMode] = useState<"cells" | "wall">("cells");
  const [kind, setKind] = useState<ZoneKind>("PRODUCTION");
  const [from, setFrom] = useState("B2");
  const [to, setTo] = useState("B5");

  if (!floor) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Rozvržení stávajících pater se ve Studiu nemění. Přidejte v kroku 1 nové patro, nebo pokračujte na osazení zařízení.
      </p>
    );
  }

  const addZone = (zoneFrom: string, zoneTo: string) => {
    const number = floor.zones.length + 1;
    const name = kind === "PRODUCTION" ? `Výrobní zóna ${number}` : kind === "HAZARD" ? `Rozvodna ${number}` : `Místnost ${number}`;
    const zone = { from: zoneFrom, to: zoneTo, name, kind };
    if (zoneToRoom(zone, grid)) onChange(floor.key, { zones: [...floor.zones, zone] });
  };
  const addGate = (at: string) => {
    const gate = { at, label: `Vrata ${floor.gates.length + 1}` };
    if (gateToFloorplan(gate, grid)) onChange(floor.key, { gates: [...floor.gates, gate] });
  };
  const updateZone = (index: number, name: string) => onChange(floor.key, { zones: floor.zones.map((zone, i) => (i === index ? { ...zone, name } : zone)) });

  return (
    <section aria-labelledby="step-2" className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 id="step-2" className="text-lg font-semibold">
          Místnosti, zóny a vrata
        </h2>
        <FloorTabs items={floors.map((entry) => ({ id: entry.key, label: floorLabel(entry.level).short }))} active={floor.key} onActive={onActive} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nástroj">
          <ChoiceButton active={mode === "cells"} onClick={() => setMode("cells")}>
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
        {mode === "cells" ? (
          <>
            <p className="text-sm text-muted-foreground">Stiskněte myš na poli rastru, táhněte na cílové pole a pusťte – místnost se přidá. I jediné pole nebo pás v jedné řadě je platná místnost.</p>
            <div className="space-y-1.5">
              <Label htmlFor="zone-kind" className="text-xs">
                Typ kreslené zóny
              </Label>
              <select id="zone-kind" value={kind} onChange={(event) => setKind(event.target.value as ZoneKind)} className={selectClass}>
                {(Object.keys(ZONE_KINDS) as ZoneKind[]).map((value) => (
                  <option key={value} value={value}>
                    {ZONE_KINDS[value].label}
                  </option>
                ))}
              </select>
            </div>
            <details className="rounded-lg border border-border p-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Zadat pole ručně</summary>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input value={from} onChange={(event) => setFrom(event.target.value.toUpperCase())} aria-label="Od pole" className="h-10 font-mono" />
                <Input value={to} onChange={(event) => setTo(event.target.value.toUpperCase())} aria-label="Do pole" className="h-10 font-mono" />
                <Button variant="outline" className="h-10" onClick={() => addZone(from, to)} disabled={!zoneToRoom({ from, to, name: "x", kind }, grid)}>
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
                  <Button key={template.key} variant="outline" size="sm" className="h-10" onClick={() => onChange(floor.key, { zones: floorTemplate(template.key, grid) })}>
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Klikněte do rastru blízko obvodové zdi – vrata se umístí na nejbližší osu stěny.</p>
        )}

        <ul className="space-y-1.5 text-sm" aria-label="Místnosti a vrata patra">
          {floor.zones.map((zone, index) => (
            <li key={`z${index}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="w-16 shrink-0 font-mono text-xs">
                {zone.from}–{zone.to}
              </span>
              <Input value={zone.name} onChange={(event) => updateZone(index, event.target.value)} aria-label={`Název místnosti ${index + 1}`} maxLength={80} className="h-8" />
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(floor.key, { zones: floor.zones.filter((_, i) => i !== index) })} aria-label={`Odebrat ${zone.name}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
          {floor.gates.map((gate, index) => (
            <li key={`g${index}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <DoorOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
      <GridCanvas
        svg={svgFor(floor)}
        spec={grid}
        mode={mode}
        onCells={addZone}
        onPick={addGate}
        label={mode === "cells" ? `Půdorys ${floorLabel(floor.level).short} – tažením myši nakreslete místnost` : `Půdorys ${floorLabel(floor.level).short} – kliknutím u zdi umístíte vrata`}
      />
    </section>
  );
}

function PlacementStep({
  grid,
  floors,
  existingFloors,
  active,
  onActive,
  svgFor,
  data,
  equipment,
  sources,
  buildingCode,
  buildingTitle,
  onAdd,
  onRemove,
}: {
  grid: GridSpec;
  floors: StudioFloorDraft[];
  existingFloors: StudioData["plant"]["buildings"][number]["floors"];
  active: FloorRef;
  onActive: (ref: FloorRef) => void;
  svgFor: (floor: StudioFloorDraft) => string;
  data: StudioData;
  equipment: StudioEquipmentDraft[];
  sources: AutopilotSource[];
  buildingCode: string;
  buildingTitle: string;
  onAdd: (item: Omit<StudioEquipmentDraft, "key">) => void;
  onRemove: (key: string) => void;
}) {
  const draftFloor = active.kind === "draft" ? floors.find((floor) => floor.key === active.key) : undefined;
  const existingFloor = active.kind === "existing" ? existingFloors.find((floor) => floor.id === active.id) : undefined;
  const spec = draftFloor ? grid : DEFAULT_GRID;
  const svg = draftFloor ? svgFor(draftFloor) : (existingFloor?.floorplanSvg ?? "");
  const activeId = floorRefKey(active);

  const [at, setAt] = useState("");
  const [type, setType] = useState<EquipmentType>("SWITCHBOARD");
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [parentId, setParentId] = useState("");
  const [circuit, setCircuit] = useState("");
  const [zone, setZone] = useState("");

  const allTags = [...data.equipment.map((item) => item.tag), ...equipment.map((item) => item.tag)];
  const boardsInBuilding =
    data.equipment.filter((item) => item.type === "SWITCHBOARD" && existingFloors.some((floor) => floor.id === item.floorId)).length +
    equipment.filter((item) => item.type === "SWITCHBOARD").length;
  const siblings = (id: string) =>
    data.equipment.filter((item) => item.fedFromEquipmentId === id).length + equipment.filter((item) => item.parent && (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) === id).length;

  /** Autopilot: tag, název, napájení, vývod a místnost podle typu a bodu v rastru. */
  function autopilot(nextType: EquipmentType, ref: string) {
    const point = parseGridRef(ref, spec);
    const roomName = draftFloor && point ? (zoneAt(draftFloor.zones, point, spec)?.name ?? null) : null;
    const nextTagValue = nextTag(nextType, { buildingCode, tags: allTags });
    const parent = nextType === "TRANSFORMER" ? null : bestParent(nextType, sources, activeId);
    const root = nextType === "TRANSFORMER" || (nextType === "SWITCHBOARD" && !parent);
    setTag(nextTagValue);
    setName(suggestName(nextType, { tag: nextTagValue, zone: roomName, buildingName: buildingTitle, boardsInBuilding }));
    setIsRoot(root);
    setParentId(root || !parent ? "" : parent.id);
    setCircuit(root || !parent ? "" : suggestCircuit(nextType, parent, siblings(parent.id)));
    const outlet = powerRole(nextType) === "OUTLET";
    setZone(roomName ?? (outlet ? (draftFloor ? floorName(draftFloor.level, draftFloor.usage) : (existingFloor?.name ?? "")) : ""));
  }

  function pick(ref: string) {
    setAt(ref);
    autopilot(type, ref);
  }

  const role = powerRole(type, isRoot);
  const parents = role === "SOURCE" ? [] : sources.filter((source) => (type === "SWITCHBOARD" ? source.type === "SWITCHBOARD" || source.type === "TRANSFORMER" : source.type === "SWITCHBOARD"));
  const parentRef = parentId ? (parentId.startsWith("draft:") ? { kind: "draft" as const, key: parentId.slice(6) } : { kind: "existing" as const, id: parentId }) : null;
  const errors = at
    ? [...(parseGridRef(at, spec) ? [] : [`Bod ${at} leží mimo rastr.`]), ...validatePlacement({ type, tag, parentId: parentId || null, circuit, zone, isRoot }, sources)]
    : ["Klikněte do rastru na místo zařízení."];

  function add() {
    if (errors.length || (!draftFloor && !existingFloor)) return;
    onAdd({
      floor: active.kind === "draft" ? { kind: "draft", key: active.key } : { kind: "existing", id: active.id },
      at,
      tag: tag.trim().toUpperCase(),
      name,
      type,
      parent: role === "SOURCE" ? null : parentRef,
      circuit: role === "SOURCE" ? null : circuit,
      zone: zone || null,
      isRoot: role === "SOURCE",
    });
    setAt("");
  }

  const tagOf = (id: string) => sources.find((source) => source.id === id)?.tag ?? data.equipment.find((item) => item.id === id)?.tag ?? "?";
  const pins: (SpiderItem & { type: EquipmentType; draft: boolean })[] = [
    ...(existingFloor
      ? data.equipment
          .filter((item) => item.floorId === existingFloor.id)
          .map((item) => ({ id: item.id, tag: item.tag, type: item.type, pinX: item.pinX, pinY: item.pinY, fedFromEquipmentId: item.fedFromEquipmentId, fedFromCircuit: item.fedFromCircuit, fedFrom: item.fedFrom, draft: false }))
      : []),
    ...equipment
      .filter((item) => floorRefKey(item.floor) === activeId)
      .map((item) => {
        const pin = gridToPercent(parseGridRef(item.at, spec) ?? { col: 0, row: 0 }, spec);
        const parent = item.parent ? (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) : null;
        return { id: `draft:${item.key}`, tag: item.tag, type: item.type, ...pin, fedFromEquipmentId: parent, fedFromCircuit: item.circuit, fedFrom: parent ? { id: parent, tag: tagOf(parent) } : null, draft: true };
      }),
  ];
  const selected = at ? parseGridRef(at, spec) : null;
  const selectedPin = selected ? gridToPercent(selected, spec) : null;

  // Jedna lišta pater: stávající i nová, seřazená podle podlaží, bez duplicit
  const floorItems = [
    ...existingFloors.map((floor) => ({ id: floor.id, level: floor.level, label: floorLabel(floor.level).short, isNew: false })),
    ...floors.map((floor) => ({ id: `draft:${floor.key}`, level: floor.level, label: floorLabel(floor.level).short, isNew: true })),
  ].sort((a, b) => a.level - b.level);

  return (
    <section aria-labelledby="step-3" className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 id="step-3" className="text-lg font-semibold">
          Osazení zařízení a napájení
        </h2>
        <FloorTabs
          items={floorItems}
          active={activeId}
          onActive={(id) => {
            onActive(id.startsWith("draft:") ? { kind: "draft", key: id.slice(6) } : { kind: "existing", id });
            setAt("");
          }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="eq-type" className="text-xs">
            Typ zařízení
          </Label>
          <select
            id="eq-type"
            value={type}
            onChange={(event) => {
              const next = event.target.value as EquipmentType;
              setType(next);
              if (at) autopilot(next, at);
            }}
            className={selectClass}
          >
            {PLACEABLE.map((value) => (
              <option key={value} value={value}>
                {EQUIPMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <p className="rounded-lg border border-primary/40 bg-primary/10 p-2 text-sm">
          {at ? (
            <>
              Bod <span className="font-mono font-semibold" data-testid="placement-point">{at}</span> – autopilot předvyplnil tag, název, napájení a místnost.
            </>
          ) : (
            "Vyberte typ a klikněte do rastru – zbytek předvyplní autopilot."
          )}
        </p>
        {at ? (
          <>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="eq-tag" className="text-xs">
                  Tag
                </Label>
                <Input id="eq-tag" value={tag} onChange={(event) => setTag(event.target.value.toUpperCase())} maxLength={24} className="h-10 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-name" className="text-xs">
                  Název
                </Label>
                <Input id="eq-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="h-10" />
              </div>
            </div>
            {type === "SWITCHBOARD" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={isRoot} onChange={(event) => setIsRoot(event.target.checked)} />
                Hlavní rozváděč (kořenový zdroj, bez nadřazeného)
              </label>
            ) : null}
            <p className="text-xs text-muted-foreground">{POWER_ROLE_HINTS[role]}</p>
            {role !== "SOURCE" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eq-parent" className="text-xs">
                    Napájeno z
                  </Label>
                  <select
                    id="eq-parent"
                    value={parentId}
                    onChange={(event) => {
                      setParentId(event.target.value);
                      const parent = sources.find((source) => source.id === event.target.value);
                      if (parent) setCircuit(suggestCircuit(type, parent, siblings(parent.id)));
                    }}
                    className={selectClass}
                  >
                    <option value="">– vyberte –</option>
                    {parents.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.tag}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eq-circuit" className="text-xs">
                    Vývod / okruh
                  </Label>
                  <Input id="eq-circuit" value={circuit} onChange={(event) => setCircuit(event.target.value)} maxLength={80} className="h-10" />
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="eq-zone" className="text-xs">
                Místnost / zóna
              </Label>
              <Input id="eq-zone" value={zone} onChange={(event) => setZone(event.target.value)} maxLength={80} placeholder={role === "OUTLET" ? "povinné" : "nepovinné"} className="h-10" />
            </div>
            {errors.length ? (
              <ul className="space-y-0.5 text-xs text-amber-300">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            <Button className="touch-target w-full gap-2" onClick={add} disabled={errors.length > 0}>
              <Plus className="size-4" aria-hidden />
              Osadit {tag || "zařízení"}
            </Button>
          </>
        ) : null}

        <ul className="space-y-1 text-sm" aria-label="Osazená zařízení konceptu">
          {equipment.map((item) => (
            <li key={item.key} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="font-mono text-xs font-semibold">{item.tag}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {item.at} · {item.parent ? `← ${tagOf(item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id)} ${item.circuit ?? ""}` : "kořen"}
                {item.zone ? ` · ${item.zone}` : ""}
              </span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemove(item.key)} aria-label={`Odebrat ${item.tag}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        {svg ? (
          <GridCanvas svg={svg} spec={spec} onPick={pick} label="Půdorys – kliknutím do rastru osadíte zařízení">
            <PowerSpiderOverlay items={pins} viewBox={FLOOR_VIEWBOX} />
            {pins.map((pin) => {
              const Icon = EQUIPMENT_TYPE_ICONS[pin.type];
              return (
                <span
                  key={pin.id}
                  className={cn(
                    "pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold shadow",
                    pin.draft ? "border-yellow-300 bg-yellow-400 text-yellow-950" : "border-zinc-600 bg-zinc-800 text-zinc-100",
                  )}
                  style={{ left: `${pin.pinX}%`, top: `${pin.pinY}%` }}
                  data-testid={pin.draft ? "studio-draft-pin" : undefined}
                >
                  <Icon className="size-3" aria-hidden />
                  {pin.tag}
                </span>
              );
            })}
            {selectedPin ? (
              <span
                className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary ring-4 ring-primary/30"
                style={{ left: `${selectedPin.pinX}%`, top: `${selectedPin.pinY}%` }}
                aria-hidden
              />
            ) : null}
          </GridCanvas>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Vyberte patro.</p>
        )}
        <p className="text-xs text-muted-foreground">⚡ Pavouk napájení: žlutě vývody z rozváděčů na patře, modře napájení z jiného patra. Žluté štítky = nová zařízení konceptu.</p>
      </div>
    </section>
  );
}
