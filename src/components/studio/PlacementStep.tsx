"use client";

import { useRef, useState, useTransition, type PointerEvent, type ReactNode } from "react";
import { Check, ChevronDown, DoorOpen, Minus, Move, Pencil, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PowerSpiderOverlay } from "@/components/map/floorplan/PowerSpiderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentType } from "@/generated/prisma/enums";
import { DEFAULT_GRID, FLOOR_VIEWBOX, fineStep, fmtM, inventoryTop, metersToPercent, metersToPx, pxPerMeter, planFrame, pxToMeters, roomAnchor, zoneAt, type MeterPoint, type PlanFrame } from "@/lib/cad-grid";
import {
  EQUIPMENT_CATEGORIES,
  categoryByKey,
  categoryOf,
  customTemplate,
  deviceBaseName,
  inventoryChipText,
  roomInventoryGroups,
  type EquipmentCategoryKey,
  type InventoryGroup,
  type ProductTemplate,
} from "@/lib/equipment-categories";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { GATE_COLOR, stripFloorplanInventory } from "@/lib/mock-graphics/floorplan";
import {
  STUDIO_MENU_STORAGE_KEY,
  addTemplate,
  allMenuTemplates,
  categoryLabel,
  menuTemplates,
  newerMenu,
  normalizeMenu,
  parseStudioMenu,
  removeTemplate,
  resetCategory,
  setCategoryLabel,
  updateTemplate,
  type StudioMenu,
} from "@/lib/studio-menu";
import { saveStudioMenuAction } from "@/server/actions/studio";
import { POWER_ROLE_HINTS, powerRole, suggestCircuit, validatePlacement } from "@/lib/power-hierarchy";
import type { SpiderItem } from "@/lib/power-tree";
import { bestParent, nextInSeries, nextTag, nextTagWithPrefix, type AutopilotSource } from "@/lib/studio-autopilot";
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
/** Sekce rozbalovacího panelu (accordion) kroku 3; `action` = tlačítko v záhlaví (např. „Upravit nabídku“). */
function Section({
  n,
  title,
  summary,
  open,
  onToggle,
  children,
  testId,
  action,
}: {
  n: number;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/40" data-testid={testId}>
      <div className="flex items-center">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{n}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{title}</span>
            {summary ? <span className="block truncate text-xs text-muted-foreground">{summary}</span> : null}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && action ? <div className="shrink-0 pr-2">{action}</div> : null}
      </div>
      {open ? <div className="space-y-3 border-t border-border p-3">{children}</div> : null}
    </section>
  );
}

/** Přepínač „✏️ Upravit nabídku“ / „Hotovo“ v záhlaví sekce. */
function MenuEditToggle({ editing, onToggle, testId }: { editing: boolean; onToggle: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={editing}
      className={cn(
        "flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold",
        editing ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
      data-testid={testId}
    >
      {editing ? <Check className="size-3.5" aria-hidden /> : <Pencil className="size-3.5" aria-hidden />}
      {editing ? "Hotovo" : "Upravit nabídku"}
    </button>
  );
}

/** Nabídka při otevření kroku 3: novější z nastavení tenantu a z localStorage prohlížeče. */
function initialMenu(serverJson: string | null): StudioMenu {
  let local: StudioMenu | null = null;
  try {
    local = parseStudioMenu(typeof window === "undefined" ? null : window.localStorage.getItem(STUDIO_MENU_STORAGE_KEY));
  } catch {
    local = null;
  }
  return newerMenu(parseStudioMenu(serverJson), local);
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
  deletes = [],
  onDeleteExisting,
  onRestoreExisting,
  panelHeader,
  hideFloorTabs = false,
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
  /** Uložená zařízení označená ke smazání (smažou se až při uložení). */
  deletes?: readonly string[];
  onDeleteExisting?: (id: string) => void;
  onRestoreExisting?: (id: string) => void;
  /** Obsah nad panelem (přepínač režimů práce s budovou). */
  panelHeader?: ReactNode;
  /** Patro se přepíná nahoře nad Studiem (pohled budovy). */
  hideFloorTabs?: boolean;
  history: HistoryControls;
}) {
  const draftFloor = active.kind === "draft" ? floors.find((floor) => floor.key === active.key && !floor.existingId) : undefined;
  const existingFloor = active.kind === "existing" ? existingFloors.find((floor) => floor.id === active.id) : undefined;
  // Stávající patro otevřené k úpravě v kroku 2: kreslí se koncept (nový rastr), piny se přepočítají
  const editDraft = existingFloor ? floors.find((floor) => floor.existingId === existingFloor.id) : undefined;
  const storedFrame = existingFloor ? frameOfFloor(existingFloor) : draftFrame;
  const frame = draftFloor ? draftFrame : editDraft ? planFrame(editDraft.grid ?? DEFAULT_GRID) : storedFrame;
  // Uložený půdorys bez seskupených štítků inventáře – Studio je kreslí živě (s rozpracovanými kusy)
  const svg = draftFloor ? svgFor(draftFloor) : editDraft ? svgFor(editDraft) : stripFloorplanInventory(existingFloor?.floorplanSvg ?? "");
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
  // Vlastní nabídka (fáze 39): krok 3 se otevírá až po interakci, takže čtení localStorage nehrozí nesouladem hydratace
  const [menu, setMenu] = useState<StudioMenu>(() => initialMenu(data.menuJson));
  const [menuEdit, setMenuEdit] = useState<null | "categories" | "templates">(null);
  const [adding, setAdding] = useState<{ label: string; prefix: string; emoji: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [, startSaving] = useTransition();
  const category = categoryKey ? categoryByKey(categoryKey) : null;
  const labelOf = (entry: (typeof EQUIPMENT_CATEGORIES)[number]) => categoryLabel(menu, entry);
  const menuAll = allMenuTemplates(menu);

  /** Rozpracovaná úprava nabídky: hned v prohlížeči (localStorage), do nastavení tenantu až „Hotovo“. */
  function changeMenu(next: StudioMenu) {
    setMenu(next);
    try {
      window.localStorage.setItem(STUDIO_MENU_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // soukromé okno / zakázané úložiště – nabídka se uloží aspoň do nastavení tenantu
    }
  }
  function persistMenu(next: StudioMenu) {
    const clean = normalizeMenu(next);
    changeMenu(clean);
    startSaving(async () => {
      const result = await saveStudioMenuAction(clean);
      if (!result.ok) toast.error(result.error);
    });
  }
  const toggleMenuEdit = (section: "categories" | "templates") => {
    if (menuEdit === section) persistMenu(menu);
    setMenuEdit(menuEdit === section ? null : section);
  };
  const toggleGroup = (key: string, force?: boolean) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (force ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

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
          .filter((item) => item.floorId === existingFloor.id && !deletes.includes(item.id))
          .map((item) => {
            const edit = edits[item.id];
            const pos = edit?.pos ?? existingMeters(item);
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
    // Prefix: vlastní z formuláře, jinak výchozí prefix dlaždice z nabídky, jinak autopilot podle typu
    const usePrefix = prefix.trim() || next.prefix || "";
    const nextTagValue = usePrefix ? nextTagWithPrefix(usePrefix, tags) : nextTag(next.type, { buildingCode, tags });
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
  const gridMode = (template && category?.placement === "grid") || (moving && categoryOf(items.find((item) => item.id === moving)?.type ?? "OTHER").placement === "grid");
  const pointer = (event: PointerEvent) => pxToMeters(frame, viewPoint(event), gridMode ? step : 0);

  function onCanvasDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const point = pointer(event);
    const room = zoneAt(rooms, point);
    if (moving) {
      const item = items.find((entry) => entry.id === moving);
      if (item) {
        const roomPlaced = categoryOf(item.type).placement === "room";
        if (roomPlaced && !room) return void toast.info("Spotřebiče a nářadí patří do místnosti – klikněte dovnitř místnosti.");
        const pos = roomPlaced && room ? roomAnchor(room, items.filter((entry) => entry.roomKey === room.key && entry.id !== moving).length) : point;
        const taken = roomPlaced ? null : items.find((entry) => entry.id !== item.id && categoryOf(entry.type).placement === "grid" && Math.abs(entry.pos.x - pos.x) < step / 2 && Math.abs(entry.pos.y - pos.y) < step / 2);
        if (taken) return void toast.error(`Bod je obsazen zařízením ${taken.tag} – zvolte sousední bod jemného rastru.`);
        relocate(item, pos, room?.name ?? item.zone);
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
    toggleGroup(groupKeyOf(item), true);
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
  const templates = category ? [...menuTemplates(menu, category.key), customTemplate(category)] : [];
  const edited = editing ? items.find((item) => item.id === editing) : null;

  // „Upravit stávající“: shodné přístroje seskupené podle názvu („🖥️ PC sestava (7×)“)
  const groupKeyOf = (item: FloorItem) => `${categoryOf(item.type).key}:${deviceBaseName(item.name, item.tag).toLowerCase()}`;
  const groups: (InventoryGroup & { items: FloorItem[] })[] = roomInventoryGroups(listed, menuAll).map((group) => ({ ...group, items: listed.filter((item) => groupKeyOf(item) === group.key) }));

  /** „+“ u skupiny: další kus stejného přístroje do stejné místnosti s dalším tagem v řadě. */
  function addOne(group: (typeof groups)[number]) {
    const sample = group.items[group.items.length - 1];
    const room = rooms.find((entry) => entry.key === sample.roomKey) ?? selectedRoom;
    const nextValue = nextInSeries(sample.tag, allTags) ?? nextTag(sample.type, { buildingCode, tags: allTags });
    const errors = validatePlacement({ type: sample.type, tag: nextValue, parentId: sample.parentId, circuit: sample.circuit ?? "", zone: room?.name ?? sample.zone ?? floorTitle, isRoot: false }, sources);
    if (errors.length) return void toast.error(`${sample.tag}: ${errors[0]} Doplňte napájení v detailu kusu.`);
    const parent = sample.parentId ? (sample.parentId.startsWith("draft:") ? { kind: "draft" as const, key: sample.parentId.slice(6) } : { kind: "existing" as const, id: sample.parentId }) : null;
    onAdd({
      floor: active.kind === "draft" ? { kind: "draft", key: active.key } : { kind: "existing", id: active.id },
      pos: room ? roomAnchor(room, items.filter((item) => item.roomKey === room.key).length) : roomAnchor({ x: 0, y: 0, w: frame.widthM, h: frame.depthM }, items.length),
      roomKey: room?.key ?? null,
      tag: nextValue,
      name: sample.name,
      type: sample.type,
      parent,
      circuit: sample.circuit,
      zone: room?.name ?? sample.zone,
      isRoot: false,
    });
    toast.success(`${nextValue} přidáno – ${group.label} (${group.count + 1}×).`);
  }

  /** „−“ u skupiny: ubere poslední nový kus, jinak označí ke smazání poslední uložený (smaže se až při uložení). */
  function removeOne(group: (typeof groups)[number]) {
    const last = [...group.items].reverse().find((item) => item.draftKey) ?? group.items[group.items.length - 1];
    if (!last) return;
    if (editing === last.id) setEditing(null);
    if (last.draftKey) {
      onRemove(last.draftKey);
      return void toast.success(`${last.tag} odebráno – ${group.label} (${group.count - 1}×).`);
    }
    if (!onDeleteExisting) return;
    onDeleteExisting(last.id);
    toast.success(`${last.tag} se smaže při uložení – ${group.label} (${group.count - 1}×).`, onRestoreExisting ? { action: { label: "Vrátit", onClick: () => onRestoreExisting(last.id) } } : undefined);
  }

  /** Nová poloha zařízení (přesun nebo jiná místnost): koncept hned, uložené jako úprava. */
  function relocate(item: FloorItem, pos: MeterPoint, zoneName: string | null) {
    const roomKey = categoryOf(item.type).placement === "room" ? (zoneAt(rooms, pos)?.key ?? null) : null;
    if (item.draftKey) return onUpdate(item.draftKey, { pos, roomKey, zone: zoneName });
    onEditExisting({ id: item.id, tag: item.tag, name: item.name, parentId: item.parentId, circuit: item.circuit, zone: zoneName, pos });
  }

  /** Spotřebič / nářadí přiřazené jiné místnosti v detailu kusu → přesun na další kotvu v ní. */
  function roomMove(item: FloorItem, zoneName: string | null): MeterPoint | null {
    if (categoryOf(item.type).placement !== "room" || !zoneName) return null;
    const target = rooms.find((room) => room.name === zoneName);
    if (!target || target.key === item.roomKey) return null;
    return roomAnchor(target, items.filter((entry) => entry.roomKey === target.key).length);
  }
  const deletedHere = existingFloor ? data.equipment.filter((item) => item.floorId === existingFloor.id && deletes.includes(item.id)) : [];
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
        {panelHeader}
        {hideFloorTabs ? null : (
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
        )}

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
          summary={category ? `${labelOf(category)} · ${countIn(category.key)} ks v místnosti` : choiceLabel ? "Vyberte typ zařízení" : "Nejdřív vyberte místnost"}
          open={open[2]}
          onToggle={() => toggle(2)}
          testId="section-category"
          action={<MenuEditToggle editing={menuEdit === "categories"} onToggle={() => toggleMenuEdit("categories")} testId="menu-edit-categories" />}
        >
          {menuEdit === "categories" ? (
            <div className="space-y-1.5" data-testid="category-editor">
              <p className="text-xs text-muted-foreground">Přejmenujte kategorie podle zvyklostí firmy. Prázdný název = výchozí.</p>
              {EQUIPMENT_CATEGORIES.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2">
                  <span className="h-8 w-1.5 shrink-0 rounded-r" style={{ background: entry.color }} aria-hidden />
                  <Input
                    aria-label={`Název kategorie: ${entry.label}`}
                    value={menu.labels[entry.key] ?? entry.label}
                    placeholder={entry.label}
                    onChange={(event) => changeMenu(setCategoryLabel(menu, entry.key, event.target.value))}
                    maxLength={60}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          ) : (
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
                    aria-label={labelOf(entry)}
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
                      <span className="block truncate text-sm font-semibold text-foreground">{labelOf(entry)}</span>
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
          )}
        </Section>

        <Section
          n={3}
          title={category ? labelOf(category) : "Vytvořit / upravit"}
          summary={category ? (mode === "new" ? "Vytvořit nové" : `Upravit stávající (${listed.length})`) : "Nejdřív vyberte kategorii"}
          open={open[3] && !!category}
          onToggle={() => toggle(3)}
          testId="section-action"
          action={mode === "new" ? <MenuEditToggle editing={menuEdit === "templates"} onToggle={() => toggleMenuEdit("templates")} testId="menu-edit-templates" /> : undefined}
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

              {mode === "new" && menuEdit === "templates" ? (
                <div className="space-y-1.5" data-testid="template-editor">
                  <p className="text-xs text-muted-foreground">Ikona, název dlaždice a výchozí prefix tagu (prázdný = autopilot). Změny platí pro celou firmu.</p>
                  {menuTemplates(menu, category.key).map((entry, index) => (
                    <div key={entry.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_2.25rem] items-center gap-1.5">
                      <Input
                        aria-label={`Ikona dlaždice ${index + 1}`}
                        value={entry.emoji}
                        onChange={(event) => changeMenu(updateTemplate(menu, category.key, entry.key, { emoji: event.target.value }))}
                        className="h-9 px-1 text-center"
                      />
                      <Input
                        aria-label={`Název dlaždice ${index + 1}`}
                        value={entry.label}
                        onChange={(event) => changeMenu(updateTemplate(menu, category.key, entry.key, { label: event.target.value }))}
                        maxLength={80}
                        className="h-9"
                      />
                      <Input
                        aria-label={`Prefix tagu dlaždice ${index + 1}`}
                        value={entry.prefix ?? ""}
                        placeholder="auto"
                        onChange={(event) => changeMenu(updateTemplate(menu, category.key, entry.key, { prefix: event.target.value }))}
                        maxLength={16}
                        className="h-9 font-mono uppercase"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 border-red-500/40 text-red-300"
                        aria-label={`Smazat dlaždici ${entry.label}`}
                        onClick={() => {
                          if (template?.key === entry.key) setTemplate(null);
                          changeMenu(removeTemplate(menu, category.key, entry.key));
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => changeMenu(resetCategory(menu, category.key))}>
                    <RotateCcw className="size-3.5" aria-hidden /> Obnovit výchozí nabídku kategorie
                  </Button>
                </div>
              ) : mode === "new" ? (
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
                    {adding ? null : (
                      <button
                        type="button"
                        onClick={() => setAdding({ label: "", prefix: "", emoji: "🏷️" })}
                        className="flex min-h-14 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 text-xs font-semibold text-muted-foreground hover:border-primary/60 hover:text-foreground"
                      >
                        <Plus className="size-4" aria-hidden /> Přidat vlastní dlaždici
                      </button>
                    )}
                  </div>
                  {adding ? (
                    <form
                      className="space-y-2 rounded-lg border border-dashed border-primary/60 p-2.5"
                      data-testid="add-tile-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!adding.label.trim()) return void toast.error("Zadejte název dlaždice.");
                        const result = addTemplate(menu, category.key, adding);
                        persistMenu(result.menu);
                        setAdding(null);
                        applyTemplate(result.template);
                        toast.success(`Dlaždice „${result.template.label}“ uložena do nabídky.`);
                      }}
                    >
                      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] gap-1.5">
                        <Input aria-label="Ikona nové dlaždice" value={adding.emoji} onChange={(event) => setAdding({ ...adding, emoji: event.target.value })} className="h-9 px-1 text-center" />
                        <Input aria-label="Název nové dlaždice" value={adding.label} onChange={(event) => setAdding({ ...adding, label: event.target.value })} placeholder="např. Rychlovarná konvice" maxLength={80} className="h-9" autoFocus />
                        <Input
                          aria-label="Prefix tagu nové dlaždice"
                          value={adding.prefix}
                          onChange={(event) => setAdding({ ...adding, prefix: event.target.value.toUpperCase() })}
                          placeholder="auto"
                          maxLength={16}
                          className="h-9 font-mono"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="submit" size="sm" className="h-9">
                          Uložit dlaždici
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setAdding(null)}>
                          Zrušit
                        </Button>
                      </div>
                    </form>
                  ) : null}
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
                  {groups.map((group) => {
                    const expanded = openGroups.has(group.key);
                    const removable = group.items.some((item) => item.draftKey) || (!!onDeleteExisting && group.items.length > 0);
                    return (
                      <li key={group.key} className="rounded-md border border-border" data-testid="group-row" data-group={group.label}>
                        <div className="flex items-center gap-1 pr-1">
                          <button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={expanded} aria-label={`${expanded ? "Sbalit" : "Rozbalit"}: ${group.label}`} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm">
                            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                            <span aria-hidden>{group.emoji}</span>
                            <span className="truncate font-medium">{group.label}</span>
                            <span className="shrink-0 font-mono text-xs font-bold" style={{ color: group.color }} data-testid="group-count">
                              ({group.count}×)
                            </span>
                          </button>
                          {category.placement === "room" ? (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                aria-label={`Ubrat kus: ${group.label}`}
                                title={group.items.some((item) => item.draftKey) ? "Ubrat poslední nový kus" : "Označit poslední kus ke smazání (smaže se při uložení)"}
                                disabled={!removable}
                                onClick={() => removeOne(group)}
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </Button>
                              <Button variant="outline" size="icon" className="size-8" aria-label={`Přidat kus: ${group.label}`} title="Přidat další kus s dalším tagem v řadě" onClick={() => addOne(group)}>
                                <Plus className="size-3.5" aria-hidden />
                              </Button>
                            </>
                          ) : null}
                        </div>
                        {expanded ? (
                          <ul className="space-y-1 border-t border-border p-1.5" aria-label={`Kusy: ${group.label}`}>
                            {group.items.map((item) => (
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
                                      const moved = roomMove(item, patch.zone);
                                      if (item.draftKey) {
                                        const parent = patch.parentId ? (patch.parentId.startsWith("draft:") ? { kind: "draft" as const, key: patch.parentId.slice(6) } : { kind: "existing" as const, id: patch.parentId }) : null;
                                        onUpdate(item.draftKey, {
                                          tag: patch.tag,
                                          name: patch.name,
                                          parent,
                                          circuit: patch.circuit,
                                          zone: patch.zone,
                                          isRoot: !parent && (item.type === "SWITCHBOARD" || item.type === "TRANSFORMER"),
                                          ...(moved ? { pos: moved, roomKey: zoneAt(rooms, moved)?.key ?? null } : {}),
                                        });
                                      } else onEditExisting({ id: item.id, ...patch, pos: moved ?? edits[item.id]?.pos ?? null });
                                      // Přejmenovaný kus patří do jiné skupiny – ta zůstane rozbalená
                                      toggleGroup(groupKeyOf({ ...item, tag: patch.tag, name: patch.name }), true);
                                      toast.success(`${patch.tag} upraveno.`);
                                    }}
                                    onMove={() => setMoving(item.id)}
                                    onRemove={
                                      item.draftKey
                                        ? () => {
                                            onRemove(item.draftKey!);
                                            setEditing(null);
                                          }
                                        : onDeleteExisting
                                          ? () => {
                                              onDeleteExisting(item.id);
                                              setEditing(null);
                                              toast.success(`${item.tag} se smaže při uložení patra.`);
                                            }
                                          : undefined
                                    }
                                    confirmRemove={!item.draftKey}
                                  />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                  {!listed.length ? <li className="text-xs text-muted-foreground">V této místnosti zatím žádné zařízení tohoto typu není.</li> : null}
                </ul>
              )}
            </>
          ) : null}
        </Section>
        {deletedHere.length ? (
          <div className="space-y-1.5 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-100" data-testid="pending-deletes">
            <p className="font-semibold">Smaže se při uložení ({deletedHere.length}):</p>
            <ul className="flex flex-wrap gap-1.5">
              {deletedHere.map((item) => (
                <li key={item.id} className="flex items-center gap-1 rounded-md border border-red-500/40 px-1.5 py-0.5">
                  <span className="font-mono">{item.tag}</span>
                  {onRestoreExisting ? (
                    <button type="button" onClick={() => onRestoreExisting(item.id)} aria-label={`Vrátit ${item.tag}`} className="text-red-200 hover:text-white">
                      <Undo2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {moving ? (
          <p className="rounded-lg border border-primary/50 bg-primary/10 p-2 text-sm" data-testid="moving-hint">
            Přesun {items.find((item) => item.id === moving)?.tag}: klikněte na nové místo v půdorysu.{" "}
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
                  {showAll ? `Zvýraznit jen: ${labelOf(category)}` : "Zobrazit vše"}
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
                  {labelOf(entry)}
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
              {/* Seskupené štítky místností: spotřebiče a nářadí sečtené podle názvu („🖥️ 7× PC sestava“) */}
              {rooms
                .filter((room) => inventory.has(room.key))
                .map((room) => {
                  const corner = metersToPx(frame, room);
                  const w = room.w * k.x;
                  const h = room.h * k.y;
                  const top = inventoryTop({ w, h, subLabel: "rozměr" });
                  const roomGroups = roomInventoryGroups(inventory.get(room.key) ?? [], menuAll);
                  return (
                    <div
                      key={room.key}
                      className="pointer-events-none absolute flex flex-wrap content-start gap-1 overflow-hidden"
                      style={{
                        left: `${((corner.x + 8) / FLOOR_VIEWBOX.width) * 100}%`,
                        top: `${((corner.y + top) / FLOOR_VIEWBOX.height) * 100}%`,
                        width: `${(Math.max(20, w - 16) / FLOOR_VIEWBOX.width) * 100}%`,
                        maxHeight: `${(Math.max(16, h - top - 4) / FLOOR_VIEWBOX.height) * 100}%`,
                      }}
                      data-testid="room-inventory"
                      data-room={room.name}
                      aria-label={`Inventář místnosti ${room.name}`}
                    >
                      {roomGroups.map((group) => {
                        const faded = category !== null && !showAll && group.category !== category.key;
                        return (
                          <button
                            key={group.key}
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => {
                              chooseRoom(room.key);
                              setCategoryKey(group.category);
                              setMode("edit");
                              toggleGroup(group.key, true);
                              setOpen(3);
                            }}
                            className="pointer-events-auto rounded-md border bg-zinc-950/90 px-1.5 py-0.5 text-[10px] leading-tight font-semibold whitespace-nowrap text-zinc-100 shadow transition-opacity hover:bg-zinc-800"
                            style={{ borderColor: group.color, opacity: faded ? 0.2 : 1 }}
                            data-testid="room-chip"
                            title={`${group.label} v místnosti ${room.name} – upravit`}
                          >
                            {inventoryChipText(group)}
                          </button>
                        );
                      })}
                    </div>
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

/** Úprava jednoho zařízení: tag, název, napájení, vývod, místnost, přesun a smazání (uložené s potvrzením). */
function EditForm({
  item,
  rooms,
  parents,
  onSave,
  onMove,
  onRemove,
  confirmRemove = false,
}: {
  item: FloorItem;
  rooms: Room[];
  parents: AutopilotSource[];
  onSave: (patch: Omit<StudioEquipmentEdit, "id" | "pos">) => void;
  onMove?: () => void;
  onRemove?: () => void;
  /** Uložené zařízení: smazání až po potvrzení. */
  confirmRemove?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
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
          <Button size="sm" variant="outline" className="h-9 gap-1 border-red-500/50 text-red-300" onClick={() => (confirmRemove ? setConfirming(true) : onRemove())} disabled={confirming}>
            <Trash2 className="size-3.5" aria-hidden /> Smazat
          </Button>
        ) : null}
      </div>
      {confirming && onRemove ? (
        <div className="space-y-2 rounded-md border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-100" role="alertdialog" aria-label={`Smazat ${item.tag}`} data-testid="confirm-delete">
          <p>
            Opravdu smazat <span className="font-mono font-semibold">{item.tag}</span>? Zařízení se smaže při uložení patra i s historií revizí a dokumentů.
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-8 bg-red-600 text-white hover:bg-red-500" onClick={onRemove}>
              Ano, smazat
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirming(false)}>
              Ne
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

