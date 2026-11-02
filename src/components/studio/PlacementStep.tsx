"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ChevronDown, DoorOpen, Move, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PowerSpiderOverlay } from "@/components/map/floorplan/PowerSpiderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentType } from "@/generated/prisma/enums";
import { DEFAULT_GRID, FLOOR_VIEWBOX, fineStep, fmtM, metersToPercent, metersToPx, pxPerMeter, planFrame, pxToMeters, zoneAt, type MeterPoint, type PlanFrame } from "@/lib/cad-grid";
import {
  EQUIPMENT_CATEGORIES,
  PRODUCT_TEMPLATES,
  categoryByKey,
  categoryOf,
  customTemplate,
  roomInventoryLabel,
  type EquipmentCategoryKey,
  type ProductTemplate,
} from "@/lib/equipment-categories";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { GATE_COLOR } from "@/lib/mock-graphics/floorplan";
import { POWER_ROLE_HINTS, powerRole, suggestCircuit, validatePlacement } from "@/lib/power-hierarchy";
import type { SpiderItem } from "@/lib/power-tree";
import { bestParent, nextTag, nextTagWithPrefix, type AutopilotSource } from "@/lib/studio-autopilot";
import { frameOfFloor, layoutOfFloor } from "@/lib/studio-layout";
import { floorLabel, floorName, type StudioEquipmentDraft, type StudioEquipmentEdit, type StudioFloorDraft } from "@/lib/studio-draft";
import { cn } from "@/lib/utils";
import type { StudioData } from "@/server/queries/studio";

import { PlanViewport, type ViewZoom } from "./PlanViewport";
import { FloorTabs, HistoryButtons, selectClass, type HistoryControls } from "./studio-ui";

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

/** Zařízení na patře – koncept i uložené (s rozpracovanými úpravami). */
interface FloorItem {
  id: string;
  draftKey: string | null;
  tag: string;
  name: string;
  type: EquipmentType;
  pos: MeterPoint;
  roomKey: string | null;
  parentId: string | null;
  circuit: string | null;
  zone: string | null;
}

/** Výběr místnosti: klíč místnosti, „celé patro“, nebo zatím nic. */
type RoomChoice = string | "floor" | null;
const WHOLE_FLOOR = "floor";
const ROOM_STEP_M = 1.5;

/** Kotva n-tého zařízení v místnosti (řady po 1,5 m od levého horního rohu). */
function roomAnchor(room: Pick<Room, "x" | "y" | "w" | "h">, index: number): MeterPoint {
  const perRow = Math.max(1, Math.floor((room.w - 1) / ROOM_STEP_M));
  const x = room.x + Math.min(room.w - 0.5, 1 + (index % perRow) * ROOM_STEP_M);
  const y = room.y + Math.min(room.h - 0.5, 1 + Math.floor(index / perRow) * ROOM_STEP_M);
  return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
}

/** Sekce rozbalovacího panelu (accordion) kroku 3. */
function Section({ n, title, summary, open, onToggle, children, testId }: { n: number; title: string; summary?: string; open: boolean; onToggle: () => void; children: React.ReactNode; testId: string }) {
  return (
    <section className="rounded-lg border border-border bg-background/40" data-testid={testId}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{n}</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {summary ? <span className="block truncate text-xs text-muted-foreground">{summary}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? <div className="space-y-3 border-t border-border p-3">{children}</div> : null}
    </section>
  );
}

/**
 * Krok 3 Studia: 1) místnost (klik v půdorysu nebo seznam) → 2) kategorie zařízení (počty v místnosti,
 * půdorys zvýrazní jen zvolený typ) → 3) „Vytvořit nové“ (konkrétní produktové banery s autopilotem)
 * nebo „Upravit stávající“ (tag, název, napájení, vývod, přesun, smazání).
 */
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
  edits,
  sources,
  buildingCode,
  buildingTitle,
  onAdd,
  onUpdate,
  onRemove,
  onEditExisting,
  history,
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
  edits: Readonly<Record<string, StudioEquipmentEdit>>;
  sources: AutopilotSource[];
  buildingCode: string;
  buildingTitle: string;
  onAdd: (item: Omit<StudioEquipmentDraft, "key">) => void;
  onUpdate: (key: string, patch: Partial<StudioEquipmentDraft>) => void;
  onRemove: (key: string) => void;
  onEditExisting: (edit: StudioEquipmentEdit) => void;
  history: HistoryControls;
}) {
  const draftFloor = active.kind === "draft" ? floors.find((floor) => floor.key === active.key && !floor.existingId) : undefined;
  const existingFloor = active.kind === "existing" ? existingFloors.find((floor) => floor.id === active.id) : undefined;
  // Stávající patro otevřené k úpravě v kroku 2: kreslí se koncept (nový rastr), piny se přepočítají
  const editDraft = existingFloor ? floors.find((floor) => floor.existingId === existingFloor.id) : undefined;
  const storedFrame = existingFloor ? frameOfFloor(existingFloor) : draftFrame;
  const frame = draftFloor ? draftFrame : editDraft ? planFrame(editDraft.grid ?? DEFAULT_GRID) : storedFrame;
  const svg = draftFloor ? svgFor(draftFloor) : editDraft ? svgFor(editDraft) : (existingFloor?.floorplanSvg ?? "");
  const activeId = floorRefKey(active);
  const floorTitle = draftFloor ? floorName(draftFloor.level, draftFloor.usage) : (existingFloor?.name ?? "");
  const step = fineStep(frame);
  const k = pxPerMeter(frame);
  const svgRef = useRef<SVGSVGElement>(null);

  const [roomChoice, setRoomChoice] = useState<RoomChoice>(null);
  const [categoryKey, setCategoryKey] = useState<EquipmentCategoryKey | null>(null);
  const [mode, setMode] = useState<"new" | "edit">("new");
  // Sekce accordionu: místnost se po výběru sbalí, kategorie zůstává otevřená i s akcemi (rychlé přepínání typů)
  const [open, setOpenState] = useState({ 1: true, 2: false, 3: false });
  const setOpen = (section: 1 | 2 | 3) => setOpenState((current) => (section === 1 ? { 1: true, 2: false, 3: false } : section === 2 ? { 1: false, 2: true, 3: current[3] } : { 1: false, 2: true, 3: true }));
  const toggle = (section: 1 | 2 | 3) => setOpenState((current) => ({ ...current, [section]: !current[section] }));
  const [showAll, setShowAll] = useState(false);
  const [template, setTemplate] = useState<ProductTemplate | null>(null);
  const [customPrefix, setCustomPrefix] = useState("");
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [parentId, setParentId] = useState("");
  const [circuit, setCircuit] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [hover, setHover] = useState<MeterPoint | null>(null);
  const category = categoryKey ? categoryByKey(categoryKey) : null;

  // Místnosti patra v metrech: zóny konceptu, u stávajícího patra z JSON Studia (starší patra ze SVG)
  const rooms: Room[] = (() => {
    const zones = draftFloor?.zones ?? editDraft?.zones;
    if (zones) return zones.map((entry) => ({ key: entry.key, name: entry.name.trim() || "Místnost", x: entry.x, y: entry.y, w: entry.w, h: entry.h }));
    return existingFloor ? layoutOfFloor(existingFloor).zones.map((zone, index) => ({ key: `ex:${index}`, name: zone.name, x: zone.x, y: zone.y, w: zone.w, h: zone.h })) : [];
  })();
  const selectedRoom = roomChoice && roomChoice !== WHOLE_FLOOR ? (rooms.find((room) => room.key === roomChoice) ?? null) : null;
  const roomName = selectedRoom?.name ?? null;

  // Zařízení na patře: koncept + uložená (s rozpracovanými úpravami z „Upravit stávající“)
  const existingMeters = (item: { pinX: number; pinY: number }) => pxToMeters(storedFrame, { x: (item.pinX / 100) * FLOOR_VIEWBOX.width, y: (item.pinY / 100) * FLOOR_VIEWBOX.height });
  const items: FloorItem[] = [
    ...(existingFloor
      ? data.equipment
          .filter((item) => item.floorId === existingFloor.id)
          .map((item) => {
            const edit = edits[item.id];
            const pos = existingMeters(item);
            return {
              id: item.id,
              draftKey: null,
              tag: edit?.tag ?? item.tag,
              name: edit?.name ?? (item.name.startsWith(`${item.tag} - `) ? item.name.slice(item.tag.length + 3) : item.name),
              type: item.type,
              pos,
              roomKey: zoneAt(rooms, pos)?.key ?? null,
              parentId: edit ? edit.parentId : item.fedFromEquipmentId,
              circuit: edit ? edit.circuit : item.fedFromCircuit,
              zone: edit?.zone ?? null,
            };
          })
      : []),
    ...equipment
      .filter((item) => floorRefKey(item.floor) === activeId)
      .map((item) => ({
        id: `draft:${item.key}`,
        draftKey: item.key,
        tag: item.tag,
        name: item.name,
        type: item.type,
        pos: item.pos,
        roomKey: item.roomKey ?? zoneAt(rooms, item.pos)?.key ?? null,
        parentId: item.parent ? (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) : null,
        circuit: item.circuit,
        zone: item.zone,
      })),
  ];
  const inChoice = (item: FloorItem) => roomChoice === WHOLE_FLOOR || (roomChoice !== null && item.roomKey === roomChoice);
  const roomItems = items.filter(inChoice);
  const countIn = (key: EquipmentCategoryKey) => roomItems.filter((item) => categoryOf(item.type).key === key).length;
  const listed = category ? roomItems.filter((item) => categoryOf(item.type).key === category.key) : [];
  const allTags = [...data.equipment.map((item) => item.tag), ...equipment.map((item) => item.tag)];
  const boardsInBuilding =
    data.equipment.filter((item) => item.type === "SWITCHBOARD" && existingFloors.some((floor) => floor.id === item.floorId)).length + equipment.filter((item) => item.type === "SWITCHBOARD").length;
  const siblings = (id: string) =>
    data.equipment.filter((item) => item.fedFromEquipmentId === id).length + equipment.filter((item) => item.parent && (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) === id).length;
  const tagOf = (id: string) => sources.find((source) => source.id === id)?.tag ?? data.equipment.find((item) => item.id === id)?.tag ?? "?";

  function chooseRoom(choice: RoomChoice) {
    setRoomChoice(choice);
    setEditing(null);
    setOpen(category ? 3 : 2);
    if (template) applyTemplate(template, choice);
  }

  function chooseCategory(key: EquipmentCategoryKey) {
    setCategoryKey(key);
    setTemplate(null);
    setEditing(null);
    setMoving(null);
    setShowAll(false);
    setOpen(3);
  }

  /** Autopilot pro produktový banner: tag (případně s vlastním prefixem), český název, napájení a vývod. */
  function applyTemplate(next: ProductTemplate, choice: RoomChoice = roomChoice, prefix = customPrefix, extraTags: string[] = []) {
    setTemplate(next);
    const tags = [...allTags, ...extraTags];
    const room = choice && choice !== WHOLE_FLOOR ? rooms.find((entry) => entry.key === choice) : null;
    const nextTagValue = prefix.trim() ? nextTagWithPrefix(prefix, tags) : nextTag(next.type, { buildingCode, tags });
    const parent = next.type === "TRANSFORMER" || next.root ? null : bestParent(next.type, sources, activeId);
    const root = next.type === "TRANSFORMER" || !!next.root || (next.type === "SWITCHBOARD" && !parent);
    setTag(nextTagValue);
    setName(`${next.name}${room ? ` – ${room.name}` : next.type === "SWITCHBOARD" && boardsInBuilding === 0 ? ` ${buildingTitle.split(" - ")[0]}` : ""}`);
    setIsRoot(root);
    setParentId(root || !parent ? "" : parent.id);
    setCircuit(root || !parent ? "" : suggestCircuit(next.type, parent, siblings(parent.id)));
  }

  const type = template?.type ?? category?.types[0] ?? "SWITCHBOARD";
  const role = powerRole(type, isRoot);
  const zone = roomName ?? (role === "OUTLET" ? floorTitle : "");
  const parentsFor = (forType: EquipmentType, selfId?: string) =>
    sources.filter((source) => source.id !== selfId && (forType === "SWITCHBOARD" ? source.type === "SWITCHBOARD" || source.type === "TRANSFORMER" : source.type === "SWITCHBOARD"));
  const errors = template ? validatePlacement({ type, tag, parentId: parentId || null, circuit, zone, isRoot }, sources) : [];
  const occupiedBy = (pos: MeterPoint) => items.find((item) => categoryOf(item.type).placement === "grid" && Math.abs(item.pos.x - pos.x) < step / 2 && Math.abs(item.pos.y - pos.y) < step / 2)?.tag ?? null;

  /** Vložení zařízení: do jemného rastru (bod), jinak na kotvu ve vybrané místnosti / na patře. */
  function insert(point?: MeterPoint) {
    if (!template || !category) return;
    if (errors.length) return void toast.error(errors[0]);
    const room = point ? (zoneAt(rooms, point) ?? selectedRoom) : selectedRoom;
    const roomList = room ? items.filter((item) => item.roomKey === room.key) : items;
    const pos = point ?? (room ? roomAnchor(room, roomList.length) : roomAnchor({ x: 0, y: 0, w: frame.widthM, h: frame.depthM }, items.length));
    const taken = category.placement === "grid" ? occupiedBy(pos) : null;
    if (taken) return void toast.error(`Bod je obsazen zařízením ${taken} – zvolte sousední bod jemného rastru.`);
    const parentRef = parentId ? (parentId.startsWith("draft:") ? { kind: "draft" as const, key: parentId.slice(6) } : { kind: "existing" as const, id: parentId }) : null;
    const insertedTag = tag.trim().toUpperCase();
    onAdd({
      floor: active.kind === "draft" ? { kind: "draft", key: active.key } : { kind: "existing", id: active.id },
      pos,
      roomKey: category.placement === "room" ? (room?.key ?? null) : null,
      tag: insertedTag,
      name,
      type,
      parent: role === "SOURCE" ? null : parentRef,
      circuit: role === "SOURCE" ? null : circuit,
      zone: (room?.name ?? zone) || null,
      isRoot: role === "SOURCE",
    });
    toast.success(`${insertedTag} vloženo${room ? ` do místnosti ${room.name}` : ""}.`);
    // Další kus stejného typu: nový tag hned připravený
    applyTemplate(template, room?.key ?? roomChoice, customPrefix, [insertedTag]);
  }

  const viewPoint = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * FLOOR_VIEWBOX.width, y: ((event.clientY - box.top) / box.height) * FLOOR_VIEWBOX.height };
  };
  const gridMode = (template && category?.placement === "grid") || (moving && categoryOf(items.find((item) => item.draftKey === moving)?.type ?? "OTHER").placement === "grid");
  const pointer = (event: PointerEvent) => pxToMeters(frame, viewPoint(event), gridMode ? step : 0);

  function onCanvasDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const point = pointer(event);
    const room = zoneAt(rooms, point);
    if (moving) {
      const item = items.find((entry) => entry.draftKey === moving);
      if (item) {
        const roomPlaced = categoryOf(item.type).placement === "room";
        const pos = roomPlaced && room ? roomAnchor(room, items.filter((entry) => entry.roomKey === room.key && entry.draftKey !== moving).length) : point;
        onUpdate(moving, { pos, roomKey: roomPlaced ? (room?.key ?? null) : null, zone: room?.name ?? item.zone });
        toast.success(`${item.tag} přesunuto${room ? ` do ${room.name}` : ""}.`);
      }
      setMoving(null);
      return;
    }
    if (template && mode === "new" && category) {
      if (category.placement === "grid") return insert(point);
      if (room) {
        setRoomChoice(room.key);
        return insert(roomAnchor(room, items.filter((entry) => entry.roomKey === room.key).length));
      }
      return void toast.info("Spotřebiče a nářadí se vkládají do místnosti – klikněte dovnitř místnosti.");
    }
    chooseRoom(room?.key ?? WHOLE_FLOOR);
  }

  /** Klik na značku v půdorysu: kategorie + „Upravit stávající“ s otevřenou položkou. */
  function selectItem(item: FloorItem) {
    setCategoryKey(categoryOf(item.type).key);
    if (roomChoice === null) setRoomChoice(item.roomKey ?? WHOLE_FLOOR);
    else if (!inChoice(item)) setRoomChoice(item.roomKey ?? WHOLE_FLOOR);
    setMode("edit");
    setEditing(item.id);
    setOpen(3);
  }

  const pins: (SpiderItem & { type: EquipmentType; draft: boolean; item: FloorItem })[] = items
    .filter((item) => categoryOf(item.type).placement === "grid")
    .map((item) => ({
      id: item.id,
      tag: item.tag,
      type: item.type,
      ...metersToPercent(frame, item.pos),
      fedFromEquipmentId: item.parentId,
      fedFromCircuit: item.circuit,
      fedFrom: item.parentId ? { id: item.parentId, tag: tagOf(item.parentId) } : null,
      draft: !!item.draftKey,
      item,
    }));
  const inventory = new Map<string, FloorItem[]>();
  for (const item of items) if (categoryOf(item.type).placement === "room" && item.roomKey) inventory.set(item.roomKey, [...(inventory.get(item.roomKey) ?? []), item]);
  const dimmed = (item: FloorItem) => !showAll && category !== null && categoryOf(item.type).key !== category.key;

  const floorItems = [
    ...existingFloors.map((floor) => ({ id: floor.id, level: floor.level, label: floorLabel(floor.level).short, isNew: false })),
    ...floors.filter((floor) => !floor.existingId).map((floor) => ({ id: `draft:${floor.key}`, level: floor.level, label: floorLabel(floor.level).short, isNew: true })),
  ].sort((a, b) => a.level - b.level);
  const templates = category ? [...PRODUCT_TEMPLATES[category.key], customTemplate(category)] : [];
  const edited = editing ? items.find((item) => item.id === editing) : null;
  const choiceLabel = roomChoice === WHOLE_FLOOR ? "Celé patro" : (selectedRoom?.name ?? null);

  return (
    <section aria-labelledby="step-3" className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="step-3" className="text-lg font-semibold">
            Zařízení a napájení
          </h2>
          <HistoryButtons history={history} />
        </div>
        <FloorTabs
          items={floorItems}
          active={activeId}
          onActive={(id) => {
            onActive(id.startsWith("draft:") ? { kind: "draft", key: id.slice(6) } : { kind: "existing", id });
            setRoomChoice(null);
            setEditing(null);
            setOpen(1);
          }}
        />

        <Section n={1} title="Místnost / zóna" summary={choiceLabel ?? "Klikněte na místnost v půdorysu nebo ji vyberte"} open={open[1]} onToggle={() => toggle(1)} testId="section-room">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Místnosti patra">
            {rooms.map((room) => (
              <button
                key={room.key}
                type="button"
                role="radio"
                aria-checked={roomChoice === room.key}
                onClick={() => chooseRoom(room.key)}
                className={cn("h-9 rounded-md border px-2.5 text-sm", roomChoice === room.key ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {room.name}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={roomChoice === WHOLE_FLOOR}
              onClick={() => chooseRoom(WHOLE_FLOOR)}
              className={cn("h-9 rounded-md border px-2.5 text-sm", roomChoice === WHOLE_FLOOR ? "border-primary bg-primary/15 text-foreground" : "border-dashed border-border text-muted-foreground hover:text-foreground")}
            >
              Celé patro
            </button>
          </div>
          {!rooms.length ? <p className="text-xs text-muted-foreground">Patro nemá místnosti – nakreslete je v kroku 2, nebo pracujte s celým patrem.</p> : null}
        </Section>

        <Section
          n={2}
          title="Kategorie zařízení"
          summary={category ? `${category.label} · ${countIn(category.key)} ks v místnosti` : choiceLabel ? "Vyberte typ zařízení" : "Nejdřív vyberte místnost"}
          open={open[2]}
          onToggle={() => toggle(2)}
          testId="section-category"
        >
          <div className="space-y-1.5" role="radiogroup" aria-label="Typ zařízení">
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
                    "flex w-full items-center gap-3 overflow-hidden rounded-lg border bg-background/60 py-1.5 pr-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "bg-muted" : "border-border hover:bg-muted/50",
                  )}
                  style={selected ? { borderColor: entry.color, boxShadow: `inset 0 0 0 1px ${entry.color}` } : undefined}
                  data-testid={`eq-banner-${entry.key}`}
                >
                  <span className="h-9 w-1.5 shrink-0 rounded-r" style={{ background: entry.color }} aria-hidden />
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md" style={{ background: `${entry.color}26`, color: entry.color }} aria-hidden>
                    <CategoryIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{entry.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{entry.placement === "grid" ? "Do jemného rastru" : "Do místnosti"}</span>
                  </span>
                  <span
                    className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold"
                    style={{ background: `${entry.color}33`, color: entry.color }}
                    title="Kusů ve vybrané místnosti"
                    data-testid={`eq-banner-count-${entry.key}`}
                  >
                    {countIn(entry.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          n={3}
          title={category ? category.label : "Vytvořit / upravit"}
          summary={category ? (mode === "new" ? "Vytvořit nové" : `Upravit stávající (${listed.length})`) : "Nejdřív vyberte kategorii"}
          open={open[3] && !!category}
          onToggle={() => toggle(3)}
          testId="section-action"
        >
          {category ? (
            <>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Režim">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "new"}
                  onClick={() => {
                    setMode("new");
                    setEditing(null);
                  }}
                  className={cn("h-10 rounded-md border text-sm font-semibold", mode === "new" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}
                >
                  ➕ Vytvořit nové
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "edit"}
                  onClick={() => {
                    setMode("edit");
                    setTemplate(null);
                  }}
                  className={cn("h-10 rounded-md border text-sm font-semibold", mode === "edit" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}
                >
                  ✏️ Upravit stávající ({listed.length})
                </button>
              </div>

              {mode === "new" ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Produktové šablony">
                    {templates.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        role="radio"
                        aria-checked={template?.key === entry.key}
                        onClick={() => applyTemplate(entry)}
                        className={cn(
                          "flex min-h-14 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium",
                          template?.key === entry.key ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                        style={template?.key === entry.key ? { borderColor: category.color, background: `${category.color}1f` } : undefined}
                      >
                        <span className="text-lg" aria-hidden>
                          {entry.emoji}
                        </span>
                        {entry.label}
                      </button>
                    ))}
                  </div>
                  {template ? (
                    <div className="space-y-2 rounded-lg border border-border p-2.5" data-testid="new-device-form">
                      <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="eq-tag" className="text-xs">
                            Tag
                          </Label>
                          <Input id="eq-tag" value={tag} onChange={(event) => setTag(event.target.value.toUpperCase())} maxLength={24} className="h-10 font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="eq-name" className="text-xs">
                            Název
                          </Label>
                          <Input id="eq-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="h-10" />
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="eq-prefix" className="text-xs">
                            Vlastní prefix tagu (nepovinné)
                          </Label>
                          <Input id="eq-prefix" value={customPrefix} onChange={(event) => setCustomPrefix(event.target.value.toUpperCase())} placeholder="např. NR-DIL-" maxLength={16} className="h-9 font-mono" />
                        </div>
                        <Button variant="outline" className="h-9" onClick={() => applyTemplate(template, roomChoice, customPrefix)}>
                          Použít prefix
                        </Button>
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
                          <div className="space-y-1">
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
                              {parentsFor(type).map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.tag}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="eq-circuit" className="text-xs">
                              Vývod / okruh
                            </Label>
                            <Input id="eq-circuit" value={circuit} onChange={(event) => setCircuit(event.target.value)} maxLength={80} className="h-10" />
                          </div>
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground" data-testid="placement-room">
                        Místnost: <span className="font-semibold text-foreground">{zone || "–"}</span>
                      </p>
                      {errors.length ? (
                        <ul className="space-y-0.5 text-xs text-amber-300">
                          {errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                      <Button className="touch-target w-full gap-2" onClick={() => insert()} disabled={errors.length > 0}>
                        <Plus className="size-4" aria-hidden />
                        Vložit {tag} {selectedRoom ? `do místnosti ${selectedRoom.name}` : "na patro"}
                      </Button>
                      {category.placement === "grid" ? <p className="text-xs text-muted-foreground">…nebo klikněte do jemného rastru v půdorysu (bod po {step} m).</p> : null}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Vyberte konkrétní zařízení – autopilot vygeneruje tag, český název a napájení.</p>
                  )}
                </>
              ) : (
                <ul className="space-y-1.5" aria-label="Stávající zařízení" data-testid="existing-list">
                  {listed.map((item) => (
                    <li key={item.id} className="rounded-md border border-border">
                      <button type="button" onClick={() => setEditing(editing === item.id ? null : item.id)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm" aria-expanded={editing === item.id}>
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryOf(item.type).color }} aria-hidden />
                        <span className="font-mono text-xs font-semibold">{item.tag}</span>
                        <span className="flex-1 truncate text-xs text-muted-foreground">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.draftKey ? "nové" : "uložené"}</span>
                      </button>
                      {editing === item.id && edited ? (
                        <EditForm
                          key={item.id}
                          item={edited}
                          rooms={rooms}
                          parents={parentsFor(item.type, item.id)}
                          onSave={(patch) => {
                            if (item.draftKey) {
                              const parent = patch.parentId ? (patch.parentId.startsWith("draft:") ? { kind: "draft" as const, key: patch.parentId.slice(6) } : { kind: "existing" as const, id: patch.parentId }) : null;
                              onUpdate(item.draftKey, { tag: patch.tag, name: patch.name, parent, circuit: patch.circuit, zone: patch.zone, isRoot: !parent && (item.type === "SWITCHBOARD" || item.type === "TRANSFORMER") });
                            } else onEditExisting({ id: item.id, ...patch });
                            toast.success(`${patch.tag} upraveno.`);
                          }}
                          onMove={item.draftKey ? () => setMoving(item.draftKey) : undefined}
                          onRemove={
                            item.draftKey
                              ? () => {
                                  onRemove(item.draftKey!);
                                  setEditing(null);
                                }
                              : undefined
                          }
                        />
                      ) : null}
                    </li>
                  ))}
                  {!listed.length ? <li className="text-xs text-muted-foreground">V této místnosti zatím žádné zařízení tohoto typu není.</li> : null}
                </ul>
              )}
            </>
          ) : null}
        </Section>
        {moving ? (
          <p className="rounded-lg border border-primary/50 bg-primary/10 p-2 text-sm" data-testid="moving-hint">
            Přesun {items.find((item) => item.draftKey === moving)?.tag}: klikněte na nové místo v půdorysu.{" "}
            <button type="button" className="underline" onClick={() => setMoving(null)}>
              Zrušit
            </button>
          </p>
        ) : null}
      </div>

      {svg ? (
        <PlanViewport
          viewMeters={FLOOR_VIEWBOX.width / k.x}
          viewBox={FLOOR_VIEWBOX}
          zoom={zoom}
          onZoom={onZoom}
          label={template ? "Půdorys – kliknutím vložíte vybrané zařízení" : "Půdorys – kliknutím vyberete místnost"}
          testId="studio-grid"
          toolbar={
            <>
              <HistoryButtons history={history} testId="placement-history" />
              {category ? (
                <button type="button" onClick={() => setShowAll((value) => !value)} aria-pressed={showAll} className="h-9 rounded-md border border-border px-2.5 text-xs font-semibold hover:border-primary/60">
                  {showAll ? `Zvýraznit jen: ${category.label}` : "Zobrazit vše"}
                </button>
              ) : null}
              <p className="text-xs text-muted-foreground">{floorTitle}</p>
            </>
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
                className={cn("absolute inset-0 size-full", gridMode ? "cursor-crosshair" : "cursor-pointer")}
                onPointerDown={onCanvasDown}
                onPointerMove={(event) => {
                  const point = pointer(event);
                  if (!hover || point.x !== hover.x || point.y !== hover.y) setHover(point);
                }}
                onPointerLeave={() => setHover(null)}
              >
                {!draftFloor && !editDraft ? (
                  <>
                    <defs>
                      <pattern id="studio-fine" x={frame.x} y={frame.y} width={k.x * step} height={k.y * step} patternUnits="userSpaceOnUse">
                        <path d={`M${k.x * step} 0H0V${k.y * step}`} fill="none" stroke="#1a2c48" strokeWidth={0.7} />
                      </pattern>
                    </defs>
                    <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="url(#studio-fine)" pointerEvents="none" />
                  </>
                ) : null}
                {/* Vybraná místnost a místnost pod kurzorem */}
                {rooms.map((room) => {
                  const a = metersToPx(frame, room);
                  const selected = room.key === roomChoice;
                  const hovered = hover && zoneAt(rooms, hover)?.key === room.key;
                  const color = category?.color ?? "#facc15";
                  return selected || hovered ? (
                    <rect
                      key={room.key}
                      x={a.x}
                      y={a.y}
                      width={room.w * k.x}
                      height={room.h * k.y}
                      fill={selected ? `${color}26` : `${color}12`}
                      stroke={color}
                      strokeWidth={selected ? 3 : 1.5}
                      strokeDasharray={selected ? undefined : "6 4"}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                      data-testid={selected ? "room-selected" : "room-highlight"}
                    />
                  ) : null;
                })}
                {gridMode && hover ? (
                  <g pointerEvents="none">
                    <circle cx={metersToPx(frame, hover).x} cy={metersToPx(frame, hover).y} r={6 * unit} fill="none" stroke={category?.color ?? "#facc15"} strokeWidth={2 * unit} />
                    <text x={metersToPx(frame, hover).x + 9 * unit} y={metersToPx(frame, hover).y - 8 * unit} fontSize={10.5 * unit} fill="#f8fafc" fontWeight={700} fontFamily="ui-monospace, monospace">
                      X {fmtM(hover.x)} · Y {fmtM(hover.y)} m
                    </text>
                  </g>
                ) : null}
              </svg>
              <PowerSpiderOverlay items={pins.filter((pin) => !dimmed(pin.item))} viewBox={FLOOR_VIEWBOX} />
              {pins.map((pin) => {
                const entry = categoryOf(pin.type);
                const PinIcon = EQUIPMENT_TYPE_ICONS[pin.type];
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => selectItem(pin.item)}
                    className={cn(
                      "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold shadow transition-opacity",
                      pin.draft ? "text-zinc-950" : "border-dashed text-zinc-100",
                      editing === pin.id && "ring-2 ring-white",
                    )}
                    style={{ left: `${pin.pinX}%`, top: `${pin.pinY}%`, background: pin.draft ? entry.color : "#18181b", borderColor: entry.color, opacity: dimmed(pin.item) ? 0.2 : 1 }}
                    data-testid={pin.draft ? "studio-draft-pin" : "studio-existing-pin"}
                    data-category={entry.key}
                    aria-label={`${pin.tag} – upravit`}
                  >
                    <PinIcon className="size-3" aria-hidden />
                    {pin.tag}
                  </button>
                );
              })}
              {/* Inventární štítky místností (spotřebiče a nářadí se nekreslí jako body) */}
              {rooms
                .filter((room) => inventory.has(room.key))
                .map((room) => {
                  const corner = metersToPx(frame, { x: room.x + room.w, y: room.y });
                  const roomList = inventory.get(room.key) ?? [];
                  const faded = category !== null && !showAll && !roomList.some((item) => categoryOf(item.type).key === category.key);
                  return (
                    <button
                      key={room.key}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        chooseRoom(room.key);
                        setCategoryKey(categoryOf(roomList[0].type).key);
                        setMode("edit");
                        setOpen(3);
                      }}
                      className="absolute -translate-x-full rounded-md border border-zinc-600 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-zinc-100 shadow hover:border-primary"
                      style={{ left: `${((corner.x - 4) / FLOOR_VIEWBOX.width) * 100}%`, top: `${((corner.y + 4) / FLOOR_VIEWBOX.height) * 100}%`, opacity: faded ? 0.2 : 1 }}
                      data-testid="room-inventory"
                      title={`Inventář místnosti ${room.name}`}
                    >
                      {roomInventoryLabel(roomList.map((item) => item.type))}
                    </button>
                  );
                })}
            </>
          )}
        </PlanViewport>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Vyberte patro.</p>
      )}
    </section>
  );
}

/** Úprava jednoho zařízení: tag, název, napájení, vývod a místnost; u konceptu i přesun a smazání. */
function EditForm({
  item,
  rooms,
  parents,
  onSave,
  onMove,
  onRemove,
}: {
  item: FloorItem;
  rooms: Room[];
  parents: AutopilotSource[];
  onSave: (patch: Omit<StudioEquipmentEdit, "id">) => void;
  onMove?: () => void;
  onRemove?: () => void;
}) {
  const [tag, setTag] = useState(item.tag);
  const [name, setName] = useState(item.name);
  const [parentId, setParentId] = useState(item.parentId ?? "");
  const [circuit, setCircuit] = useState(item.circuit ?? "");
  const [zone, setZone] = useState(item.zone ?? rooms.find((room) => room.key === item.roomKey)?.name ?? "");
  return (
    <div className="space-y-2 border-t border-border p-2" data-testid="edit-form">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <Input aria-label="Tag zařízení" value={tag} onChange={(event) => setTag(event.target.value.toUpperCase())} maxLength={24} className="h-9 font-mono" />
        <Input aria-label="Název zařízení" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="h-9" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Napájeno z" value={parentId} onChange={(event) => setParentId(event.target.value)} className={cn(selectClass, "h-9")}>
          <option value="">– bez napájení / kořen –</option>
          {parents.map((source) => (
            <option key={source.id} value={source.id}>
              {source.tag}
            </option>
          ))}
        </select>
        <Input aria-label="Vývod / okruh" value={circuit} onChange={(event) => setCircuit(event.target.value)} maxLength={80} placeholder="Vývod" className="h-9" />
      </div>
      <select aria-label="Místnost" value={zone} onChange={(event) => setZone(event.target.value)} className={cn(selectClass, "h-9")}>
        <option value="">– bez místnosti –</option>
        {[...new Set([...rooms.map((room) => room.name), ...(zone ? [zone] : [])])].map((roomName) => (
          <option key={roomName} value={roomName}>
            {roomName}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" className="h-9" onClick={() => onSave({ tag: tag.trim().toUpperCase(), name, parentId: parentId || null, circuit: circuit || null, zone: zone || null })} disabled={!tag.trim()}>
          Uložit změny
        </Button>
        {onMove ? (
          <Button size="sm" variant="outline" className="h-9 gap-1" onClick={onMove}>
            <Move className="size-3.5" aria-hidden /> Přesunout
          </Button>
        ) : null}
        {onRemove ? (
          <Button size="sm" variant="outline" className="h-9 gap-1 border-red-500/50 text-red-300" onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden /> Smazat
          </Button>
        ) : (
          <span className="self-center text-[11px] text-muted-foreground">Uložené zařízení se maže a přesouvá v jeho kartě.</span>
        )}
      </div>
    </div>
  );
}

