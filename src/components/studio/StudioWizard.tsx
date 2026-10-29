"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Grid3x3, Loader2, Plug, Plus, Save, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PowerSpiderOverlay } from "@/components/map/floorplan/PowerSpiderOverlay";
import { IsometricBuilding } from "@/components/map/isometric/IsometricBuilding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";
import {
  DEFAULT_GRID,
  FLOOR_VIEWBOX,
  GRID_LIMITS,
  SCALES,
  ZONE_KINDS,
  clampGrid,
  gateToFloorplan,
  gridDimensions,
  gridToPercent,
  parseGridRef,
  renderGridFloorplanSvg,
  zoneToRoom,
  type DrawingScale,
  type GridSpec,
  type ZoneKind,
} from "@/lib/cad-grid";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { BUILDING_TYPE_LABELS, EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { extractFloorplanRooms } from "@/lib/mock-graphics/floorplan";
import { POWER_ROLE_HINTS, allowedParents, powerRole, suggestCircuit, validatePlacement, type PowerSource } from "@/lib/power-hierarchy";
import type { SpiderItem } from "@/lib/power-tree";
import { floorLabel, floorName, type StudioBuildingDraft, type StudioEquipmentDraft, type StudioFloorDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import { saveStudioAction } from "@/server/actions/studio";
import type { FloorOverview } from "@/server/queries/building";
import type { StudioData } from "@/server/queries/studio";

import { GridCanvas } from "./GridCanvas";

const STEPS = [
  { n: 1, title: "Rastr a měřítko", icon: Grid3x3 },
  { n: 2, title: "Budova a podlaží", icon: Building2 },
  { n: 3, title: "Místnosti, zóny a vrata", icon: Shapes },
  { n: 4, title: "Zařízení a napájení", icon: Plug },
] as const;

const PLACEABLE: EquipmentType[] = [
  "TRANSFORMER",
  "SWITCHBOARD",
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

/** Studio výstavby závodu – 4 kroky nad konstrukčním rastrem, uložení v jedné transakci. */
export function StudioWizard({ data }: { data: StudioData }) {
  const router = useRouter();
  const counter = useRef(1);
  const nextKey = (prefix: string) => `${prefix}${counter.current++}`;
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  // Krok 1 – rastr
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  const dims = gridDimensions(grid);

  // Krok 2 – budova a patra
  const [building, setBuilding] = useState<StudioBuildingDraft>({ mode: "new", code: "C", name: "Hala C - Nová výroba", type: "PRODUCTION", map: { x: 72, y: 74, w: 18, h: 16 } });
  const [floors, setFloors] = useState<StudioFloorDraft[]>([{ key: "f0", level: 0, usage: "Hlavní výroba", zones: [], gates: [] }]);
  const existingBuilding = building.mode === "existing" ? data.plant.buildings.find((entry) => entry.id === building.id) : undefined;
  const existingFloors = useMemo(() => existingBuilding?.floors ?? [], [existingBuilding]);
  const [hoveredFloor, setHoveredFloor] = useState<string | null>(null);

  // Kroky 3 a 4
  const [zoneFloorKey, setZoneFloorKey] = useState("f0");
  const [equipment, setEquipment] = useState<StudioEquipmentDraft[]>([]);
  const [placeFloor, setPlaceFloor] = useState<FloorRef>({ kind: "draft", key: "f0" });

  const allLevels = [...existingFloors.map((floor) => floor.level), ...floors.map((floor) => floor.level)];
  function addFloor(direction: "up" | "down") {
    const level = direction === "up" ? Math.max(-1, ...allLevels) + 1 : Math.min(0, ...allLevels) - 1;
    const key = nextKey("f");
    setFloors((current) => [...current, { key, level, usage: direction === "up" ? "" : "Technické zázemí", zones: [], gates: [] }].sort((a, b) => a.level - b.level));
    if (!floors.length) {
      setZoneFloorKey(key);
      setPlaceFloor({ kind: "draft", key });
    }
  }

  const updateFloor = (key: string, patch: Partial<StudioFloorDraft>) => setFloors((current) => current.map((floor) => (floor.key === key ? { ...floor, ...patch } : floor)));

  function removeFloor(key: string) {
    setFloors((current) => current.filter((floor) => floor.key !== key));
    setEquipment((current) => current.filter((item) => !(item.floor.kind === "draft" && item.floor.key === key)));
  }

  const floorSvg = (floor: StudioFloorDraft) => renderGridFloorplanSvg({ floorName: floorName(floor.level, floor.usage), spec: grid, zones: floor.zones, gates: floor.gates });

  // Zdroje napájení: rozváděče a trafa závodu + rozváděče konceptu
  const draftFloorId = (item: StudioEquipmentDraft) => (item.floor.kind === "draft" ? `draft:${item.floor.key}` : item.floor.id);
  const sources: PowerSource[] = [
    ...data.equipment.filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER").map(({ id, tag, type, floorId }) => ({ id, tag, type, floorId })),
    ...equipment.filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER").map((item) => ({ id: `draft:${item.key}`, tag: item.tag, type: item.type, floorId: draftFloorId(item) })),
  ];

  function draftPayload() {
    return { plantId: data.plant.id, grid, building, floors, equipment };
  }

  function save() {
    startTransition(async () => {
      const result = await saveStudioAction(draftPayload());
      if (!result.ok) return void toast.error(result.error);
      toast.success("Budova uložena do závodu.", { description: `Pater: ${result.data.floors} · zařízení: ${result.data.equipment}.` });
      router.push(result.data.href);
    });
  }

  // Izometrie (krok 2)
  const isoFloors: FloorOverview[] = useMemo(() => {
    const normalize = (rooms: { x: number; y: number; w: number; h: number }[]) =>
      rooms.map((room) => ({ x: room.x / FLOOR_VIEWBOX.width, y: room.y / FLOOR_VIEWBOX.height, w: room.w / FLOOR_VIEWBOX.width, h: room.h / FLOOR_VIEWBOX.height }));
    const overview = (id: string, level: number, name: string, rooms: { x: number; y: number; w: number; h: number }[], pins: { id: string; tag: string; type: EquipmentType; x: number; y: number }[]): FloorOverview => ({
      id,
      code: floorLabel(level).code,
      name,
      description: null,
      level,
      href: "#",
      rooms: normalize(rooms),
      equipment: pins.map((pin) => ({ ...pin, status: "ACTIVE" as const })),
      counts: { total: pins.length, pending: 0, waiting: 0 },
      worstStatus: "ACTIVE",
    });
    return [
      ...existingFloors.map((floor) =>
        overview(
          floor.id,
          floor.level,
          floor.name,
          extractFloorplanRooms(floor.floorplanSvg ?? ""),
          data.equipment.filter((item) => item.floorId === floor.id).map((item) => ({ id: item.id, tag: item.tag, type: item.type, x: item.pinX / 100, y: item.pinY / 100 })),
        ),
      ),
      ...floors.map((floor) =>
        overview(
          `draft:${floor.key}`,
          floor.level,
          `${floorName(floor.level, floor.usage)} (nové)`,
          floor.zones.map((zone) => zoneToRoom(zone, grid)).filter((room) => room !== null),
          equipment
            .filter((item) => item.floor.kind === "draft" && item.floor.key === floor.key)
            .map((item) => {
              const point = parseGridRef(item.at, grid);
              const pin = point ? gridToPercent(point, grid) : { pinX: 50, pinY: 50 };
              return { id: item.key, tag: item.tag, type: item.type, x: pin.pinX / 100, y: pin.pinY / 100 };
            }),
        ),
      ),
    ].sort((a, b) => a.level - b.level);
  }, [existingFloors, floors, equipment, grid, data.equipment]);

  return (
    <div className="space-y-6 pb-8">
      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Kroky Studia">
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
              <span className="font-medium">Krok {n}: {title}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section aria-labelledby="step-1" className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 id="step-1" className="text-lg font-semibold">Měřítko a konstrukční rastr</h2>
            <NumberField id="grid-cols" label={`Vodorovné osy 1…N (${GRID_LIMITS.cols.min}–${GRID_LIMITS.cols.max})`} value={grid.cols} onChange={(cols) => setGrid((current) => clampGrid({ ...current, cols }))} />
            <NumberField id="grid-rows" label={`Svislé osy A…Z (${GRID_LIMITS.rows.min}–${GRID_LIMITS.rows.max})`} value={grid.rows} onChange={(rows) => setGrid((current) => clampGrid({ ...current, rows }))} />
            <NumberField id="grid-step" label="Modulová rozteč sloupů [m]" value={grid.stepMeters} step={0.5} onChange={(stepMeters) => setGrid((current) => clampGrid({ ...current, stepMeters }))} />
            <div className="space-y-2">
              <Label htmlFor="grid-scale">Měřítko výkresu</Label>
              <select id="grid-scale" value={grid.scale} onChange={(event) => setGrid((current) => ({ ...current, scale: event.target.value as DrawingScale }))} className={selectClass}>
                {SCALES.map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              Rozměr haly: <span className="font-mono text-lg font-semibold" data-testid="grid-dimensions">{dims.label}</span>
              <span className="block text-xs text-muted-foreground">
                Osy 1–{grid.cols} × A–{String.fromCharCode(64 + grid.rows)}, sloupy v průsečících, M {grid.scale}
              </span>
            </p>
          </div>
          <GridCanvas svg={renderGridFloorplanSvg({ floorName: "Náhled rastru", spec: grid, zones: [], gates: [] })} spec={grid} label="Náhled konstrukčního rastru" />
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="step-2" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 id="step-2" className="text-lg font-semibold">Budova a podlaží</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Budova">
              <ChoiceButton active={building.mode === "new"} onClick={() => setBuilding({ mode: "new", code: "C", name: "Hala C - Nová výroba", type: "PRODUCTION", map: { x: 72, y: 74, w: 18, h: 16 } })}>
                Nová budova
              </ChoiceButton>
              <ChoiceButton active={building.mode === "existing"} onClick={() => data.plant.buildings[0] && setBuilding({ mode: "existing", id: data.plant.buildings[0].id })}>
                Upravit existující
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
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-medium">Umístění v areálu (%)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(["x", "y", "w", "h"] as const).map((key) => (
                      <NumberField
                        key={key}
                        id={`map-${key}`}
                        label={{ x: "X", y: "Y", w: "Šířka", h: "Hloubka" }[key]}
                        value={building.map[key]}
                        onChange={(value) => setBuilding({ ...building, map: { ...building.map, [key]: Math.min(100, Math.max(key === "w" || key === "h" ? 2 : 0, value)) } })}
                      />
                    ))}
                  </div>
                  <CampusPreview buildings={data.plant.buildings} map={building.map} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="building-existing">Budova</Label>
                <select id="building-existing" value={building.id} onChange={(event) => setBuilding({ mode: "existing", id: event.target.value })} className={selectClass}>
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
                  .sort((a, b) => a.floor.level - b.floor.level)
                  .reverse()
                  .map((entry) =>
                    entry.kind === "existing" ? (
                      <li key={entry.floor.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-mono">{floorLabel(entry.floor.level).short}</span> {entry.floor.name.split(" - ")[1] ?? ""} · stávající
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
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-2">
            <IsometricBuilding floors={isoFloors} hoveredId={hoveredFloor} onHover={setHoveredFloor} onSelect={() => setStep(3)} />
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <ZoneStep
          floors={floors}
          activeKey={zoneFloorKey}
          onActive={setZoneFloorKey}
          grid={grid}
          svgFor={floorSvg}
          onChange={(key, patch) => updateFloor(key, patch)}
        />
      ) : null}

      {step === 4 ? (
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
        {step < 4 ? (
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

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "touch-target rounded-lg border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Miniatura areálu: stávající budovy a obdélník nové budovy. */
function CampusPreview({ buildings, map }: { buildings: StudioData["plant"]["buildings"]; map: { x: number; y: number; w: number; h: number } }) {
  return (
    <svg viewBox="0 0 100 70" className="w-full rounded-lg border border-border bg-zinc-950" role="img" aria-label="Umístění v areálu">
      {buildings.map((entry) => (
        <polygon
          key={entry.id}
          points={entry.mapPolygon
            .split(" ")
            .map((pair) => {
              const [x, y] = pair.split(",").map(Number);
              return `${x},${y * 0.7}`;
            })
            .join(" ")}
          fill="#27272a"
          stroke="#52525b"
          strokeWidth={0.3}
        />
      ))}
      <rect x={map.x} y={map.y * 0.7} width={map.w} height={map.h * 0.7} fill="rgba(250,204,21,0.25)" stroke="#facc15" strokeWidth={0.5} />
    </svg>
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
  const [from, setFrom] = useState("A1");
  const [to, setTo] = useState("C11");
  const [name, setName] = useState("Montážní linka 1 – dveřní moduly");
  const [kind, setKind] = useState<ZoneKind>("PRODUCTION");
  const [target, setTarget] = useState<"from" | "to">("from");
  const [gateAt, setGateAt] = useState(`G${grid.cols}`);
  const [gateLabel, setGateLabel] = useState("Vrata – expedice");

  if (!floor) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nejdřív v kroku 2 přidejte nové patro.</p>;

  const zone = { from, to, name, kind };
  const zoneOk = zoneToRoom(zone, grid) !== null;
  const gateOk = gateToFloorplan({ at: gateAt, label: gateLabel }, grid) !== null;

  function pick(ref: string) {
    if (target === "from") {
      setFrom(ref);
      setTarget("to");
    } else {
      setTo(ref);
      setTarget("from");
    }
  }

  return (
    <section aria-labelledby="step-3" className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 id="step-3" className="text-lg font-semibold">Rozvržení místností, zón a vrat</h2>
        <FloorTabs items={floors.map((entry) => ({ id: entry.key, label: floorLabel(entry.level).short }))} active={floor.key} onActive={onActive} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="zone-from" className="text-xs">
              Od {target === "from" ? "(klik do rastru)" : ""}
            </Label>
            <Input id="zone-from" value={from} onChange={(event) => setFrom(event.target.value.toUpperCase())} onFocus={() => setTarget("from")} className="h-10 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-to" className="text-xs">
              Do {target === "to" ? "(klik do rastru)" : ""}
            </Label>
            <Input id="zone-to" value={to} onChange={(event) => setTo(event.target.value.toUpperCase())} onFocus={() => setTarget("to")} className="h-10 font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-name" className="text-xs">
            Název místnosti / zóny
          </Label>
          <Input id="zone-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-kind" className="text-xs">
            Typ zóny
          </Label>
          <select id="zone-kind" value={kind} onChange={(event) => setKind(event.target.value as ZoneKind)} className={selectClass}>
            {(Object.keys(ZONE_KINDS) as ZoneKind[]).map((value) => (
              <option key={value} value={value}>
                {ZONE_KINDS[value].label}
              </option>
            ))}
          </select>
        </div>
        <Button className="touch-target w-full gap-2" disabled={!zoneOk} onClick={() => onChange(floor.key, { zones: [...floor.zones, zone] })}>
          <Plus className="size-4" aria-hidden />
          Přidat místnost
        </Button>
        {!zoneOk ? <p className="text-xs text-amber-300">Zadejte dva různé průsečíky rastru (např. A1 a C11).</p> : null}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium">Vrata a vstupy na obvodové stěně</p>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
            <Input value={gateAt} onChange={(event) => setGateAt(event.target.value.toUpperCase())} aria-label="Osa vrat" className="h-10 font-mono" />
            <Input value={gateLabel} onChange={(event) => setGateLabel(event.target.value)} aria-label="Popis vrat" maxLength={60} className="h-10" />
          </div>
          <Button variant="outline" className="touch-target w-full gap-2" disabled={!gateOk} onClick={() => onChange(floor.key, { gates: [...floor.gates, { at: gateAt, label: gateLabel }] })}>
            <Plus className="size-4" aria-hidden />
            Přidat vrata
          </Button>
          {!gateOk ? <p className="text-xs text-amber-300">Vrata musí ležet na obvodu (první / poslední osa).</p> : null}
        </div>

        <ul className="space-y-1 text-sm" aria-label="Místnosti a vrata patra">
          {floor.zones.map((entry, index) => (
            <li key={`z${index}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="font-mono text-xs">
                {entry.from}–{entry.to}
              </span>
              <span className="flex-1 truncate">{entry.name}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(floor.key, { zones: floor.zones.filter((_, i) => i !== index) })} aria-label={`Odebrat ${entry.name}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
          {floor.gates.map((entry, index) => (
            <li key={`g${index}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="font-mono text-xs">{entry.at}</span>
              <span className="flex-1 truncate">{entry.label}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(floor.key, { gates: floor.gates.filter((_, i) => i !== index) })} aria-label={`Odebrat ${entry.label}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <GridCanvas svg={svgFor(floor)} spec={grid} onPick={pick} label={`Půdorys ${floorLabel(floor.level).short} – kliknutím vyberte průsečík (${target === "from" ? "Od" : "Do"})`} />
    </section>
  );
}

function FloorTabs({ items, active, onActive }: { items: { id: string; label: string; hint?: string }[]; active: string; onActive: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1" role="tablist" aria-label="Patro">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          onClick={() => onActive(item.id)}
          title={item.hint}
          className={cn("h-9 rounded-md px-3 font-mono text-sm", item.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          {item.label}
        </button>
      ))}
    </div>
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
  sources: PowerSource[];
  onAdd: (item: Omit<StudioEquipmentDraft, "key">) => void;
  onRemove: (key: string) => void;
}) {
  const draftFloor = active.kind === "draft" ? floors.find((floor) => floor.key === active.key) : undefined;
  const existingFloor = active.kind === "existing" ? existingFloors.find((floor) => floor.id === active.id) : undefined;
  const spec = draftFloor ? grid : DEFAULT_GRID;
  const svg = draftFloor ? svgFor(draftFloor) : (existingFloor?.floorplanSvg ?? "");
  const activeId = floorRefKey(active);

  const [at, setAt] = useState("B11");
  const [type, setType] = useState<EquipmentType>("SWITCHBOARD");
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [parentId, setParentId] = useState("");
  const [circuit, setCircuit] = useState("");
  const [zone, setZone] = useState("");

  const role = powerRole(type, isRoot);
  const parents = role === "SOURCE" ? [] : allowedParents(type, sources, activeId);
  const zoneNames = draftFloor?.zones.map((entry) => entry.name) ?? [];
  const siblings = (id: string) =>
    data.equipment.filter((item) => item.fedFromEquipmentId === id).length + equipment.filter((item) => item.parent && (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) === id).length;

  function chooseParent(id: string) {
    setParentId(id);
    const parent = sources.find((source) => source.id === id);
    if (parent) setCircuit(suggestCircuit(type, parent, siblings(id)));
  }

  const parentRef = parentId ? (parentId.startsWith("draft:") ? { kind: "draft" as const, key: parentId.slice(6) } : { kind: "existing" as const, id: parentId }) : null;
  const errors = [
    ...(parseGridRef(at, spec) ? [] : [`Průsečík ${at || "?"} leží mimo rastr.`]),
    ...validatePlacement({ type, tag, parentId: parentId || null, circuit, zone, isRoot }, sources),
  ];

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
    setTag("");
    setName("");
  }

  // Piny a pavouk: stávající zařízení patra + koncept
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
  const selected = parseGridRef(at, spec);
  const selectedPin = selected ? gridToPercent(selected, spec) : null;

  const floorItems = [
    ...existingFloors.map((floor) => ({ id: floor.id, label: floorLabel(floor.level).short, hint: `${floor.name} (stávající)` })),
    ...floors.map((floor) => ({ id: `draft:${floor.key}`, label: `${floorLabel(floor.level).short} ✦`, hint: `${floorName(floor.level, floor.usage)} (nové)` })),
  ];

  return (
    <section aria-labelledby="step-4" className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 id="step-4" className="text-lg font-semibold">Osazení prvků a hierarchie napájení</h2>
        <FloorTabs items={floorItems} active={activeId} onActive={(id) => onActive(id.startsWith("draft:") ? { kind: "draft", key: id.slice(6) } : { kind: "existing", id })} />
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="eq-at" className="text-xs">
              Průsečík
            </Label>
            <Input id="eq-at" value={at} onChange={(event) => setAt(event.target.value.toUpperCase())} className="h-10 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-type" className="text-xs">
              Typ zařízení
            </Label>
            <select
              id="eq-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as EquipmentType);
                setParentId("");
                setCircuit("");
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
          <div className="space-y-1.5">
            <Label htmlFor="eq-tag" className="text-xs">
              Tag
            </Label>
            <Input id="eq-tag" value={tag} onChange={(event) => setTag(event.target.value.toUpperCase())} maxLength={24} placeholder="R-ML-02" className="h-10 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-name" className="text-xs">
              Název
            </Label>
            <Input id="eq-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Rozváděč montážní linky 2" className="h-10" />
          </div>
        </div>
        {type === "SWITCHBOARD" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={isRoot} onChange={(event) => setIsRoot(event.target.checked)} />
            Hlavní rozváděč (kořenový zdroj, bez nadřazeného)
          </label>
        ) : null}
        <p className="rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">{POWER_ROLE_HINTS[role]}</p>
        {role !== "SOURCE" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="eq-parent" className="text-xs">
                Napájeno z
              </Label>
              <select id="eq-parent" value={parentId} onChange={(event) => chooseParent(event.target.value)} className={selectClass}>
                <option value="">– vyberte rozváděč –</option>
                {parents.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.tag}
                    {source.floorId === activeId ? " (toto patro)" : ""}
                    {source.id.startsWith("draft:") ? " ✦ nový" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-circuit" className="text-xs">
                Pole / jistič / okruh
              </Label>
              <Input id="eq-circuit" value={circuit} onChange={(event) => setCircuit(event.target.value)} maxLength={80} className="h-10" />
            </div>
          </>
        ) : null}
        {role === "OUTLET" ? (
          <div className="space-y-1.5">
            <Label htmlFor="eq-zone" className="text-xs">
              Místnost / zóna
            </Label>
            <Input id="eq-zone" value={zone} onChange={(event) => setZone(event.target.value)} list="eq-zone-list" maxLength={80} className="h-10" />
            <datalist id="eq-zone-list">
              {zoneNames.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </div>
        ) : null}
        {errors.length && tag ? (
          <ul className="space-y-0.5 text-xs text-amber-300">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <Button className="touch-target w-full gap-2" onClick={add} disabled={errors.length > 0}>
          <Plus className="size-4" aria-hidden />
          Osadit zařízení
        </Button>

        <ul className="space-y-1 text-sm" aria-label="Osazená zařízení konceptu">
          {equipment.map((item) => (
            <li key={item.key} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
              <span className="font-mono text-xs font-semibold">{item.tag}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {item.at} · {item.parent ? `← ${tagOf(item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id)} ${item.circuit ?? ""}` : "kořen"}
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
          <GridCanvas svg={svg} spec={spec} onPick={setAt} label="Půdorys – kliknutím na průsečík osadíte zařízení">
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
              <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary ring-4 ring-primary/30" style={{ left: `${selectedPin.pinX}%`, top: `${selectedPin.pinY}%` }} aria-hidden />
            ) : null}
          </GridCanvas>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Vyberte patro.</p>
        )}
        <p className="text-xs text-muted-foreground">⚡ Pavouk napájení: žlutě vývody z rozváděčů na patře, modře napájení z jiného patra. ✦ = nové patro / zařízení konceptu.</p>
      </div>
    </section>
  );
}
