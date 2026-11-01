"use client";

import { useRef, useState, type PointerEvent } from "react";
import { DoorOpen, Plus, Trash2 } from "lucide-react";

import { PowerSpiderOverlay } from "@/components/map/floorplan/PowerSpiderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentType } from "@/generated/prisma/enums";
import {
  EXISTING_FLOOR_FRAME,
  FLOOR_VIEWBOX,
  fineStep,
  fmtM,
  formatPosition,
  metersToPercent,
  metersToPx,
  pxPerMeter,
  pxToMeters,
  zoneAt,
  type MeterPoint,
  type PlanFrame,
} from "@/lib/cad-grid";
import { EQUIPMENT_CATEGORIES, categoryByKey, categoryOf, roomInventoryLabel, type EquipmentCategoryKey } from "@/lib/equipment-categories";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { GATE_COLOR, extractFloorplanRoomsWithLabels } from "@/lib/mock-graphics/floorplan";
import { POWER_ROLE_HINTS, powerRole, suggestCircuit, validatePlacement } from "@/lib/power-hierarchy";
import type { SpiderItem } from "@/lib/power-tree";
import { bestParent, nextTag, suggestName, type AutopilotSource } from "@/lib/studio-autopilot";
import { floorLabel, floorName, type StudioEquipmentDraft, type StudioFloorDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import type { StudioData } from "@/server/queries/studio";

import { PlanViewport, type ViewZoom } from "./PlanViewport";
import { FloorTabs, selectClass } from "./studio-ui";

export type FloorRef = { kind: "draft"; key: string } | { kind: "existing"; id: string };
export const floorRefKey = (ref: FloorRef) => (ref.kind === "draft" ? `draft:${ref.key}` : ref.id);

interface Room {
  key: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Pick = { kind: "grid"; pos: MeterPoint } | { kind: "room"; room: Room | null };

const ROOM_STEP_M = 1.5;

/** Kotva n-tého spotřebiče / nářadí v místnosti (řady po 1,5 m od levého horního rohu). */
function roomAnchor(room: Room, index: number): MeterPoint {
  const perRow = Math.max(1, Math.floor((room.w - 1) / ROOM_STEP_M));
  const x = room.x + Math.min(room.w - 0.5, 1 + (index % perRow) * ROOM_STEP_M);
  const y = room.y + Math.min(room.h - 0.5, 1 + Math.floor(index / perRow) * ROOM_STEP_M);
  return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
}

export function PlacementStep({
  frame: draftFrame,
  zoom,
  onZoom,
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
  frame: PlanFrame;
  zoom: ViewZoom;
  onZoom: (zoom: ViewZoom) => void;
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
  const frame = draftFloor ? draftFrame : EXISTING_FLOOR_FRAME;
  const svg = draftFloor ? svgFor(draftFloor) : (existingFloor?.floorplanSvg ?? "");
  const activeId = floorRefKey(active);
  const floorTitle = draftFloor ? floorName(draftFloor.level, draftFloor.usage) : (existingFloor?.name ?? "");
  const step = fineStep(frame);
  const k = pxPerMeter(frame);
  const svgRef = useRef<SVGSVGElement>(null);

  const [categoryKey, setCategoryKey] = useState<EquipmentCategoryKey>("R");
  const category = categoryByKey(categoryKey);
  const [type, setType] = useState<EquipmentType>("SWITCHBOARD");
  const [pick, setPick] = useState<Pick | null>(null);
  const [hover, setHover] = useState<MeterPoint | null>(null);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [parentId, setParentId] = useState("");
  const [circuit, setCircuit] = useState("");
  const [zone, setZone] = useState("");

  // Místnosti patra v metrech: zóny konceptu, u stávajícího patra vytažené z uloženého půdorysu.
  const rooms: Room[] = (() => {
    if (draftFloor) return draftFloor.zones.map((entry) => ({ key: entry.key, name: entry.name.trim() || "Místnost", x: entry.x, y: entry.y, w: entry.w, h: entry.h }));
    return extractFloorplanRoomsWithLabels(existingFloor?.floorplanSvg ?? "").map((room, index) => {
      const a = pxToMeters(EXISTING_FLOOR_FRAME, { x: room.x, y: room.y });
      const b = pxToMeters(EXISTING_FLOOR_FRAME, { x: room.x + room.w, y: room.y + room.h });
      return { key: `ex:${index}`, name: room.label, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    });
  })();

  const onFloor = equipment.filter((item) => floorRefKey(item.floor) === activeId);
  const existingOnFloor = existingFloor ? data.equipment.filter((item) => item.floorId === existingFloor.id) : [];
  const allTags = [...data.equipment.map((item) => item.tag), ...equipment.map((item) => item.tag)];
  const boardsInBuilding =
    data.equipment.filter((item) => item.type === "SWITCHBOARD" && existingFloors.some((floor) => floor.id === item.floorId)).length +
    equipment.filter((item) => item.type === "SWITCHBOARD").length;
  const siblings = (id: string) =>
    data.equipment.filter((item) => item.fedFromEquipmentId === id).length + equipment.filter((item) => item.parent && (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) === id).length;

  // Stávající zařízení: procenta půdorysu → metry (seskupení spotřebičů do místností)
  const existingMeters = (item: { pinX: number; pinY: number }) => pxToMeters(frame, { x: (item.pinX / 100) * FLOOR_VIEWBOX.width, y: (item.pinY / 100) * FLOOR_VIEWBOX.height });
  const roomItems = new Map<string, { key: string; tag: string; type: EquipmentType; draft: boolean }[]>();
  for (const item of onFloor) {
    if (categoryOf(item.type).placement !== "room" || !item.roomKey) continue;
    roomItems.set(item.roomKey, [...(roomItems.get(item.roomKey) ?? []), { key: item.key, tag: item.tag, type: item.type, draft: true }]);
  }
  for (const item of existingOnFloor) {
    if (categoryOf(item.type).placement !== "room") continue;
    const room = zoneAt(rooms, existingMeters(item));
    if (room) roomItems.set(room.key, [...(roomItems.get(room.key) ?? []), { key: item.id, tag: item.tag, type: item.type, draft: false }]);
  }
  const counts = new Map<EquipmentCategoryKey, number>();
  for (const item of [...onFloor, ...existingOnFloor]) counts.set(categoryOf(item.type).key, (counts.get(categoryOf(item.type).key) ?? 0) + 1);
  const fixedSpots = [...onFloor.filter((item) => categoryOf(item.type).placement === "grid").map((item) => item.pos), ...existingOnFloor.filter((item) => categoryOf(item.type).placement === "grid").map(existingMeters)];
  const occupiedBy = (pos: MeterPoint) =>
    onFloor.find((item) => categoryOf(item.type).placement === "grid" && Math.abs(item.pos.x - pos.x) < 0.01 && Math.abs(item.pos.y - pos.y) < 0.01)?.tag ??
    existingOnFloor.find((item) => {
      const point = existingMeters(item);
      return categoryOf(item.type).placement === "grid" && Math.abs(point.x - pos.x) < step / 2 && Math.abs(point.y - pos.y) < step / 2;
    })?.tag ??
    null;

  /** Autopilot: tag, název, napájení, vývod a místnost podle typu a místa. */
  function autopilot(nextType: EquipmentType, roomName: string | null) {
    const nextTagValue = nextTag(nextType, { buildingCode, tags: allTags });
    const parent = nextType === "TRANSFORMER" ? null : bestParent(nextType, sources, activeId);
    const root = nextType === "TRANSFORMER" || (nextType === "SWITCHBOARD" && !parent);
    setTag(nextTagValue);
    setName(suggestName(nextType, { tag: nextTagValue, zone: roomName, buildingName: buildingTitle, boardsInBuilding }));
    setIsRoot(root);
    setParentId(root || !parent ? "" : parent.id);
    setCircuit(root || !parent ? "" : suggestCircuit(nextType, parent, siblings(parent.id)));
    setZone(roomName ?? (powerRole(nextType) === "OUTLET" ? floorTitle : ""));
  }

  const pickRoomName = (value: Pick | null) => (value?.kind === "room" ? (value.room?.name ?? floorTitle) : value?.kind === "grid" ? (zoneAt(rooms, value.pos)?.name ?? null) : null);

  function chooseCategory(key: EquipmentCategoryKey) {
    const next = categoryByKey(key);
    setCategoryKey(key);
    setType(next.types[0]);
    // Jiný způsob umístění (rastr ↔ místnost) = nový výběr místa
    if (next.placement !== category.placement) setPick(null);
    else if (pick) autopilot(next.types[0], pickRoomName(pick));
  }

  function chooseType(next: EquipmentType) {
    setType(next);
    if (pick) autopilot(next, pickRoomName(pick));
  }

  const viewPoint = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * FLOOR_VIEWBOX.width, y: ((event.clientY - box.top) / box.height) * FLOOR_VIEWBOX.height };
  };
  const pointer = (event: PointerEvent) => pxToMeters(frame, viewPoint(event), category.placement === "grid" ? step : 0);

  function onCanvasDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const point = pointer(event);
    if (category.placement === "grid") {
      const next: Pick = { kind: "grid", pos: point };
      setPick(next);
      autopilot(type, pickRoomName(next));
      return;
    }
    const room = zoneAt(rooms, point);
    if (!room) return;
    chooseRoom(room);
  }

  function chooseRoom(room: Room | null) {
    const next: Pick = { kind: "room", room };
    setPick(next);
    setOpenRoom(room?.key ?? null);
    autopilot(type, pickRoomName(next));
  }

  const role = powerRole(type, isRoot);
  const parents = role === "SOURCE" ? [] : sources.filter((source) => (type === "SWITCHBOARD" ? source.type === "SWITCHBOARD" || source.type === "TRANSFORMER" : source.type === "SWITCHBOARD"));
  const parentRef = parentId ? (parentId.startsWith("draft:") ? { kind: "draft" as const, key: parentId.slice(6) } : { kind: "existing" as const, id: parentId }) : null;
  const taken = pick?.kind === "grid" ? occupiedBy(pick.pos) : null;
  const errors = pick
    ? [...(taken ? [`Bod je obsazen zařízením ${taken} – zvolte sousední bod jemného rastru.`] : []), ...validatePlacement({ type, tag, parentId: parentId || null, circuit, zone, isRoot }, sources)]
    : [category.placement === "grid" ? "Klikněte do půdorysu – zařízení se přichytí na jemný rastr." : "Klikněte do místnosti v půdorysu nebo ji vyberte v seznamu."];

  function add() {
    if (!pick || errors.length || (!draftFloor && !existingFloor)) return;
    const room = pick.kind === "room" ? pick.room : null;
    const pos = pick.kind === "grid" ? pick.pos : room ? roomAnchor(room, (roomItems.get(room.key) ?? []).length) : { x: 1, y: 1 };
    onAdd({
      floor: active.kind === "draft" ? { kind: "draft", key: active.key } : { kind: "existing", id: active.id },
      pos,
      roomKey: room?.key ?? null,
      tag: tag.trim().toUpperCase(),
      name,
      type,
      parent: role === "SOURCE" ? null : parentRef,
      circuit: role === "SOURCE" ? null : circuit,
      zone: zone || null,
      isRoot: role === "SOURCE",
    });
    setPick(null);
  }

  const tagOf = (id: string) => sources.find((source) => source.id === id)?.tag ?? data.equipment.find((item) => item.id === id)?.tag ?? "?";
  const pins: (SpiderItem & { type: EquipmentType; draft: boolean })[] = [
    ...existingOnFloor
      .filter((item) => categoryOf(item.type).placement === "grid")
      .map((item) => ({ id: item.id, tag: item.tag, type: item.type, pinX: item.pinX, pinY: item.pinY, fedFromEquipmentId: item.fedFromEquipmentId, fedFromCircuit: item.fedFromCircuit, fedFrom: item.fedFrom, draft: false })),
    ...onFloor
      .filter((item) => categoryOf(item.type).placement === "grid")
      .map((item) => {
        const parent = item.parent ? (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) : null;
        return { id: `draft:${item.key}`, tag: item.tag, type: item.type, ...metersToPercent(frame, item.pos), fedFromEquipmentId: parent, fedFromCircuit: item.circuit, fedFrom: parent ? { id: parent, tag: tagOf(parent) } : null, draft: true };
      }),
  ];

  const floorItems = [
    ...existingFloors.map((floor) => ({ id: floor.id, level: floor.level, label: floorLabel(floor.level).short, isNew: false })),
    ...floors.map((floor) => ({ id: `draft:${floor.key}`, level: floor.level, label: floorLabel(floor.level).short, isNew: true })),
  ].sort((a, b) => a.level - b.level);
  const Icon = EQUIPMENT_TYPE_ICONS[type];
  const hoverRoom = category.placement === "room" && hover ? zoneAt(rooms, hover) : null;
  const open = openRoom ? rooms.find((room) => room.key === openRoom) : null;

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
            setPick(null);
            setOpenRoom(null);
          }}
        />

        <div className="space-y-1.5">
          <p className="text-xs font-medium" id="eq-category-label">
            Typ zařízení
          </p>
          <div className="space-y-1.5" role="radiogroup" aria-labelledby="eq-category-label">
            {EQUIPMENT_CATEGORIES.map((entry) => {
              const CategoryIcon = EQUIPMENT_TYPE_ICONS[entry.types[0]];
              const selected = entry.key === categoryKey;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={entry.label}
                  onClick={() => chooseCategory(entry.key)}
                  className={cn(
                    "flex w-full items-center gap-3 overflow-hidden rounded-lg border bg-background/60 py-2 pr-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "bg-muted" : "border-border hover:bg-muted/50",
                  )}
                  style={selected ? { borderColor: entry.color, boxShadow: `inset 0 0 0 1px ${entry.color}` } : undefined}
                  data-testid={`eq-banner-${entry.key}`}
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-r" style={{ background: entry.color }} aria-hidden />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ background: `${entry.color}26`, color: entry.color }} aria-hidden>
                    <CategoryIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{entry.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{entry.code}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{entry.placement === "grid" ? "Umístění do jemného rastru" : "Přiřazení do místnosti"}</span>
                  </span>
                  <span
                    className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold"
                    style={{ background: `${entry.color}33`, color: entry.color }}
                    title="Osazeno na patře"
                    data-testid={`eq-banner-count-${entry.key}`}
                  >
                    {counts.get(entry.key) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          {category.types.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label="Podtyp zařízení">
              {category.types.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={type === value}
                  onClick={() => chooseType(value)}
                  className={cn("h-8 rounded-md border px-2.5 text-xs", type === value ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                  style={type === value ? { borderColor: category.color, background: `${category.color}22` } : undefined}
                >
                  {EQUIPMENT_TYPE_LABELS[value]}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {category.placement === "room" ? (
          <div className="space-y-1.5 rounded-lg border border-dashed p-2" style={{ borderColor: category.color }}>
            <p className="text-xs font-medium">Režim „Výběr místnosti“ – klikněte do místnosti v půdorysu, nebo ji vyberte:</p>
            {rooms.length ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Místnosti patra">
                {rooms.map((room) => (
                  <button
                    key={room.key}
                    type="button"
                    onClick={() => chooseRoom(room)}
                    className={cn("h-8 rounded-md border px-2 text-xs", pick?.kind === "room" && pick.room?.key === room.key ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                    style={pick?.kind === "room" && pick.room?.key === room.key ? { borderColor: category.color, background: `${category.color}22` } : undefined}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>Patro nemá místnosti – nakreslete je v kroku 2, nebo přiřaďte vybavení k celému patru.</p>
                <Button variant="outline" size="sm" className="h-8" onClick={() => chooseRoom(null)}>
                  Přiřadit k celému patru
                </Button>
              </div>
            )}
          </div>
        ) : null}

        <p className="rounded-lg border p-2 text-sm" style={{ borderColor: `${category.color}88`, background: `${category.color}14` }}>
          {pick ? (
            <>
              <Icon className="mr-1 inline size-4 align-text-bottom" style={{ color: category.color }} aria-hidden />
              {pick.kind === "grid" ? (
                <>
                  Bod <span className="font-mono font-semibold" data-testid="placement-point">{formatPosition(frame, pick.pos)}</span>
                </>
              ) : (
                <>
                  Místnost <span className="font-semibold" data-testid="placement-room">{pick.room?.name ?? floorTitle}</span>
                </>
              )}{" "}
              – autopilot předvyplnil tag, název, napájení a místnost.
            </>
          ) : category.placement === "grid" ? (
            `Klikněte do půdorysu – ${category.label.toLowerCase()} se přichytí na jemný rastr po ${step} m.`
          ) : (
            "Najeďte na půdorys – zvýrazní se celé místnosti; kliknutím vybavení přiřadíte."
          )}
        </p>

        {pick ? (
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
              <Input
                id="eq-zone"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                maxLength={80}
                placeholder={role === "OUTLET" ? "povinné" : "nepovinné"}
                readOnly={pick.kind === "room" && !!pick.room}
                className="h-10"
              />
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
              {pick.kind === "room" ? `Přiřadit ${tag || "vybavení"} do místnosti` : `Osadit ${tag || "zařízení"}`}
            </Button>
          </>
        ) : null}

        {open ? (
          <div className="space-y-1.5 rounded-lg border border-border p-2" data-testid="room-inventory-detail">
            <p className="text-sm font-medium">Inventář místnosti {open.name}</p>
            {(roomItems.get(open.key) ?? []).length ? (
              <ul className="space-y-1 text-xs">
                {(roomItems.get(open.key) ?? []).map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryOf(item.type).color }} aria-hidden />
                    <span className="font-mono font-semibold">{item.tag}</span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {EQUIPMENT_TYPE_LABELS[item.type]}
                      {item.draft ? "" : " · stávající"}
                    </span>
                    {item.draft ? (
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => onRemove(item.key)} aria-label={`Odebrat ${item.tag}`}>
                        <Trash2 className="size-3" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Zatím bez spotřebičů a nářadí.</p>
            )}
          </div>
        ) : null}

        <ul className="space-y-1 text-sm" aria-label="Osazená zařízení konceptu">
          {equipment.map((item) => {
            const entry = categoryOf(item.type);
            return (
              <li key={item.key} className="flex items-center gap-2 rounded-md bg-muted/40 py-1 pr-1 pl-0" style={{ boxShadow: `inset 3px 0 0 ${entry.color}` }}>
                <span className="ml-2 size-2.5 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden />
                <span className="font-mono text-xs font-semibold">{item.tag}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {item.roomKey || entry.placement === "room" ? `🏠 ${item.zone ?? ""}` : `X ${fmtM(item.pos.x)} · Y ${fmtM(item.pos.y)} m`} ·{" "}
                  {item.parent ? `← ${tagOf(item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id)} ${item.circuit ?? ""}` : "kořen"}
                </span>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemove(item.key)} aria-label={`Odebrat ${item.tag}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      {svg ? (
        <PlanViewport
          viewMeters={FLOOR_VIEWBOX.width / k.x}
          viewBox={FLOOR_VIEWBOX}
          zoom={zoom}
          onZoom={onZoom}
          label={category.placement === "grid" ? "Půdorys – kliknutím do jemného rastru osadíte zařízení" : "Půdorys – kliknutím do místnosti přiřadíte spotřebič nebo nářadí"}
          testId="studio-grid"
          toolbar={
            <p className="text-xs text-muted-foreground">
              {category.placement === "grid" ? `Jemný rastr ${step} m uvnitř polí sloupů` : "Režim výběru místnosti"} · {floorTitle}
            </p>
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs" aria-label="Legenda" data-testid="studio-legend">
              {EQUIPMENT_CATEGORIES.map((entry) => (
                <span key={entry.key} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ background: entry.color }} aria-hidden />
                  {entry.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <DoorOpen className="size-3.5" style={{ color: GATE_COLOR }} aria-hidden />
                Vrata
              </span>
              <span className="text-muted-foreground">⚡ Pavouk napájení: žlutě vývody z rozváděčů na patře, modře napájení z jiného patra.</span>
            </div>
          }
        >
          {({ unit }) => (
            <>
              <div className="pointer-events-none absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${FLOOR_VIEWBOX.width} ${FLOOR_VIEWBOX.height}`}
                className={cn("absolute inset-0 size-full", category.placement === "grid" ? "cursor-crosshair" : hoverRoom ? "cursor-pointer" : "cursor-not-allowed")}
                onPointerDown={onCanvasDown}
                onPointerMove={(event) => {
                  const point = pointer(event);
                  if (!hover || point.x !== hover.x || point.y !== hover.y) setHover(point);
                }}
                onPointerLeave={() => setHover(null)}
              >
                {!draftFloor && category.placement === "grid" ? (
                  <>
                    <defs>
                      <pattern id="studio-fine" x={frame.x} y={frame.y} width={k.x * step} height={k.y * step} patternUnits="userSpaceOnUse">
                        <path d={`M${k.x * step} 0H0V${k.y * step}`} fill="none" stroke="#1a2c48" strokeWidth={0.7} />
                      </pattern>
                    </defs>
                    <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="url(#studio-fine)" pointerEvents="none" />
                  </>
                ) : null}
                {/* Režim místnosti: zvýraznění celé místnosti pod kurzorem a vybrané místnosti */}
                {category.placement === "room"
                  ? rooms.map((room) => {
                      const a = metersToPx(frame, room);
                      const lit = room.key === hoverRoom?.key || (pick?.kind === "room" && pick.room?.key === room.key);
                      return (
                        <rect
                          key={room.key}
                          x={a.x}
                          y={a.y}
                          width={room.w * k.x}
                          height={room.h * k.y}
                          fill={lit ? `${category.color}33` : "transparent"}
                          stroke={lit ? category.color : "transparent"}
                          strokeWidth={3}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                          data-testid={lit ? "room-highlight" : undefined}
                        />
                      );
                    })
                  : null}
                {/* Režim rastru: náhled bodu pod kurzorem a obsazené body */}
                {category.placement === "grid" && hover ? (
                  <g pointerEvents="none">
                    <circle cx={metersToPx(frame, hover).x} cy={metersToPx(frame, hover).y} r={6 * unit} fill="none" stroke={category.color} strokeWidth={2 * unit} />
                    <text x={metersToPx(frame, hover).x + 9 * unit} y={metersToPx(frame, hover).y - 8 * unit} fontSize={10.5 * unit} fill="#f8fafc" fontWeight={700} fontFamily="ui-monospace, monospace">
                      X {fmtM(hover.x)} · Y {fmtM(hover.y)} m
                    </text>
                  </g>
                ) : null}
                {category.placement === "grid"
                  ? fixedSpots.map((spot, index) => (
                      <rect
                        key={index}
                        x={metersToPx(frame, spot).x - (k.x * step) / 2}
                        y={metersToPx(frame, spot).y - (k.y * step) / 2}
                        width={k.x * step}
                        height={k.y * step}
                        fill="rgba(248,250,252,0.08)"
                        pointerEvents="none"
                      />
                    ))
                  : null}
              </svg>
              <PowerSpiderOverlay items={pins} viewBox={FLOOR_VIEWBOX} />
              {pins.map((pin) => {
                const entry = categoryOf(pin.type);
                const PinIcon = EQUIPMENT_TYPE_ICONS[pin.type];
                return (
                  <span
                    key={pin.id}
                    className={cn(
                      "pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold shadow",
                      pin.draft ? "text-zinc-950" : "border-dashed text-zinc-100 opacity-85",
                    )}
                    style={{ left: `${pin.pinX}%`, top: `${pin.pinY}%`, background: pin.draft ? entry.color : "#18181b", borderColor: entry.color }}
                    data-testid={pin.draft ? "studio-draft-pin" : undefined}
                    data-category={entry.key}
                  >
                    <PinIcon className="size-3" aria-hidden />
                    {pin.tag}
                  </span>
                );
              })}
              {/* Inventární štítky místností (spotřebiče a nářadí se nekreslí jako body) */}
              {rooms
                .filter((room) => roomItems.has(room.key))
                .map((room) => {
                  const corner = metersToPx(frame, { x: room.x + room.w, y: room.y });
                  return (
                    <button
                      key={room.key}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setOpenRoom(room.key)}
                      className="absolute -translate-x-full rounded-md border border-zinc-600 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-zinc-100 shadow hover:border-primary"
                      style={{ left: `${((corner.x - 4) / FLOOR_VIEWBOX.width) * 100}%`, top: `${((corner.y + 4) / FLOOR_VIEWBOX.height) * 100}%` }}
                      data-testid="room-inventory"
                      title={`Inventář místnosti ${room.name}`}
                    >
                      {roomInventoryLabel((roomItems.get(room.key) ?? []).map((item) => item.type))}
                    </button>
                  );
                })}
              {pick?.kind === "grid" ? (
                <span
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${metersToPercent(frame, pick.pos).pinX}%`,
                    top: `${metersToPercent(frame, pick.pos).pinY}%`,
                    borderColor: category.color,
                    boxShadow: `0 0 0 4px ${category.color}55`,
                  }}
                  aria-hidden
                />
              ) : null}
            </>
          )}
        </PlanViewport>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Vyberte patro.</p>
      )}
    </section>
  );
}
