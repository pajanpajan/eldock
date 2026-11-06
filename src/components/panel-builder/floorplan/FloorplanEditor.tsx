"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Grid3x3, Link2, Loader2, Maximize2, Minus, MousePointer2, Plus, RotateCw, Ruler, Square, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { INSTALL_LEVELS, INSTALL_METHODS, ROUTING_MODES, mountHeight, type CableRoutingMode, type ElevationProfile, type InstallLevel, type InstallMethod } from "@/engine/floorplan-bridge";
import {
  CONTROLS_LABEL,
  PALETTE_GROUPS,
  ROOM_NAME_CHIPS,
  SYMBOL_SCALE_MAX,
  SYMBOL_SCALE_MIN,
  analyzeDraft,
  applyAppearance,
  clampSymbolScale,
  controllersOf,
  controlsLights,
  convertForLevel,
  deleteRoom,
  effectiveSwitchNo,
  emptyDraft,
  generationChecklist,
  isWallMounted,
  isWiredSwitch,
  levelConversionPreview,
  moveRoom,
  paletteFor,
  paletteItem,
  parseDraft,
  recalibrate,
  resizeRect,
  roomAt,
  roomDimensions,
  snapToWall,
  switchingFor,
  symbolSizeOf,
  updateRoom,
  wallRotation,
  wiringInventory,
  type EditorElement,
  type EditorRoom,
  type FloorplanDraft,
  type RoomHandle,
} from "@/lib/panel-builder/floorplan-editor";
import {
  ZOOM_STEP,
  backgroundTransform,
  clampView,
  cropDraft,
  cropImpact,
  emptyCalibration,
  planExtent,
  resetCrop,
  rotateDraft,
  segmentLength,
  viewBoxOf,
  zoomOf,
  zoomView,
  type FloorplanBackground,
  type PlanView,
  type Rotation,
} from "@/lib/panel-builder/floorplan-pdf";
import { DESIGN_BRANDS, appearanceLabel, colorForSeries, designColor, seriesColors } from "@/lib/panel-builder/wiring-designs";
import { renderPdfFile } from "@/lib/pdf-client";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { createFloorplanProjectAction } from "@/server/actions/panel-projects";

import { CablePanel } from "./CablePanel";
import { CalibrationDialog, type CalibrationResult } from "./CalibrationDialog";
import { DeviceAppearance } from "./DeviceAppearance";
import { FloorSymbol, PanelSymbol } from "./FloorSymbol";
import { PdfEditMenu, type PdfEditAction } from "./PdfEditMenu";
import { WiringBomDialog } from "./WiringBomDialog";

// 2D editor půdorysu elektroinstalace (fáze 49, úprava PDF / značky / úroveň instalace fáze 57): podklad (obrázek / PDF /
// rastr) s otočením, ořezem a zoomem, kalibrace s ověřením, značky dle ČSN EN 60617-11, párování vypínačů se světly,
// trasy kabelů a výkaz kabeláže v reálném čase.

const STORAGE_KEY = "eldock.pb.floorplan";
const SNAP_MM = 50;
const ROUTE_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#4ade80"];
/** Šířka podkladu po nahrání [px] – ostrý i při přiblížení (A3 ≈ 270 dpi). */
const BACKGROUND_PX = 3200;

type Tool = { kind: "select" } | { kind: "place"; item: string } | { kind: "room" } | { kind: "calibrate" } | { kind: "verify" } | { kind: "crop" } | { kind: "pair"; switchId: string };

const HEIGHTS: { key: keyof ElevationProfile; label: string }[] = [
  { key: "ceilingHeightMm", label: "Strop" },
  { key: "switchboardHeightMm", label: "Rozváděč" },
  { key: "defaultSocketHeightMm", label: "Zásuvky" },
  { key: "worktopSocketHeightMm", label: "Kuchyně/Linka" },
  { key: "defaultSwitchHeightMm", label: "Vypínače" },
];

const MODE_BUTTONS: Record<CableRoutingMode, string> = { BOTTOM: "⬇ Spodem (v podlaze)", TOP: "⬆ Vrchem (stropem/podhledem)", OPTIMIZED: "✨ Optimalizovaně (Auto)" };

/** Co úroveň instalace v nákresu znamená (fáze 57). */
const LEVEL_NOTES: Record<InstallLevel, string> = {
  classic: "Vypínače 230 V se kreslí podle skutečného řazení z párování (1 / 5 / 6 / 7), svody CYKY-O ze stropní krabice, okruhy stromově.",
  bus_loxone: "Tlačítka, detektory a prostorové jednotky na jedné sběrnicové lince 24 V DC z rozváděče; každé svítidlo a žaluzie samostatným kabelem k aktoru v rozváděči (hvězda).",
  smart_retrofit: "Klasická kabeláž s nulovým vodičem v každé krabici (CYKY-J) a modulem pod vypínačem (štítek M); bezdrátová tlačítka na baterii bez kabelu – svítidlo pak dostane spínací modul.",
};

const SCALE_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 3];

function loadDraft(): FloorplanDraft {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return (stored && parseDraft(JSON.parse(stored))) || emptyDraft();
  } catch {
    return emptyDraft();
  }
}

const snap = (value: number) => Math.round(value / SNAP_MM) * SNAP_MM;
let sequence = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(sequence++).toString(36)}`;

export interface SeriesOption {
  count?: number;
  key: string;
  label: string;
}

/** Výřez pohledu jako zlomek výkresu – přežije kalibraci (změnu mm) bez přepočtu. */
interface ViewFraction {
  x: number;
  y: number;
  w: number;
}
const FIT: ViewFraction = { x: 0, y: 0, w: 1 };

export function FloorplanEditor({ series }: { series: SeriesOption[] }) {
  const router = useRouter();
  const svg = useRef<SVGSVGElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<FloorplanDraft>(loadDraft);
  const [tool, setTool] = useState<Tool>({ kind: "select" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  /** Tažení vybrané místnosti: přesun (celá místnost s prvky) nebo změna rozměru za stěnu / roh. */
  const [roomDrag, setRoomDrag] = useState<{ id: string; handle: RoomHandle | "move"; start: { x: number; y: number }; origin: Pick<EditorRoom, "x" | "y" | "w" | "h"> } | null>(null);
  /** Tažený obdélník – nová místnost nebo ořez podkladu. */
  const [roomDraft, setRoomDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [calibration, setCalibration] = useState<{ x: number; y: number }[]>([]);
  const [calibrationDialog, setCalibrationDialog] = useState<{ mode: "calibrate" | "verify"; segmentMm: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<ViewFraction>(FIT);
  const [pan, setPan] = useState<{ clientX: number; clientY: number; view: PlanView } | null>(null);
  const [levelPrompt, setLevelPrompt] = useState<({ level: InstallLevel } & ReturnType<typeof levelConversionPreview>) | null>(null);
  const [pending, startTransition] = useTransition();
  const lastRoom = useRef("Místnost 1");

  // Nákres se průběžně ukládá v prohlížeči (rozpracovaný půdorys přežije reload)
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // plné úložiště – nevadí
    }
  }, [draft]);

  const update = (change: (current: FloorplanDraft) => FloorplanDraft) => setDraft((current) => ({ ...change(current), updatedAt: Date.now() }));

  const viewMm = clampView({ x: view.x * draft.widthMm, y: view.y * draft.heightMm, w: view.w * draft.widthMm }, draft);
  const setViewMm = (next: PlanView) => {
    const clamped = clampView(next, draft);
    setView({ x: clamped.x / draft.widthMm, y: clamped.y / draft.heightMm, w: clamped.w / draft.widthMm });
  };
  const zoom = zoomOf(viewMm, draft);
  const zoomed = zoom > 1.001;
  const viewHeight = (viewMm.w * draft.heightMm) / draft.widthMm;
  /** Jednotka popisků, úchytů a lišt – při zoomu drží stejnou velikost na obrazovce. */
  const ui = Math.max(viewMm.w, viewHeight) / 55;
  const stroke = ui / 16;

  const analysis = useMemo(() => {
    try {
      return { ok: true as const, ...analyzeDraft(draft) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Neplatný půdorys." };
    }
  }, [draft]);
  const bom = useMemo(() => compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.ok ? analysis.summary.byCable : [] }), [draft, analysis]);
  const checklist = generationChecklist(draft);

  const selected = draft.elements.find((element) => element.id === selectedId) ?? null;
  const selectedRoom = draft.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const available = useMemo(() => new Map(series.map((option) => [option.key, option.count ?? 1])), [series]);
  const inventory = useMemo(() => wiringInventory(draft), [draft]);
  const palette = paletteFor(draft.installation);

  function toPlan(event: { clientX: number; clientY: number }) {
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function rotateSelected(id: string) {
    update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === id ? { ...element, rotation: (((element.rotation + 90) % 360) as Rotation) } : element)) }));
  }

  function removeSelected(id: string) {
    update((current) => removeElement(current, id));
    setSelectedId(null);
  }

  function zoomBy(factor: number, focus?: { x: number; y: number }) {
    setViewMm(zoomView(viewMm, draft, factor, focus));
  }

  // Esc = zpět na výběr, Delete = smazat, R = otočit značku, šipky = posun značky, + / − / 0 = zoom, [ ] = otočit podklad
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (calibrationDialog || levelPrompt) return;
      if (event.key === "Escape") {
        setTool({ kind: "select" });
        setCalibration([]);
        setRoomDraft(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        setDraft((current) => removeElement(current, selectedId));
        setSelectedId(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedRoomId) {
        setDraft((current) => ({ ...deleteRoom(current, selectedRoomId), updatedAt: Date.now() }));
        setSelectedRoomId(null);
      } else if ((event.key === "r" || event.key === "R") && selectedId) {
        rotateSelected(selectedId);
      } else if (event.key.startsWith("Arrow") && selectedId) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : SNAP_MM;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        setDraft((current) => ({ ...current, updatedAt: Date.now(), elements: current.elements.map((element) => (element.id === selectedId ? { ...element, x: element.x + dx, y: element.y + dy } : element)) }));
      } else if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
      else if (event.key === "-") zoomBy(1 / ZOOM_STEP);
      else if (event.key === "0") setView(FIT);
      else if ((event.key === "]" || event.key === "[") && draft.background) pdfAction(event.key === "]" ? "rotate-cw" : "rotate-ccw");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Kolečko: Ctrl + kolečko = zoom ke kurzoru; přiblížený výkres kolečkem posouvá (bez přiblížení se posouvá stránka)
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !zoomed) return;
      event.preventDefault();
      if (event.ctrlKey) return zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, toPlan(event));
      const perPx = viewMm.w / Math.max(1, element.clientWidth);
      setViewMm({ ...viewMm, x: viewMm.x + (event.shiftKey ? event.deltaY : event.deltaX) * perPx, y: viewMm.y + (event.shiftKey ? 0 : event.deltaY) * perPx });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  });

  function startPan(event: ReactPointerEvent) {
    capture(svg.current, event.pointerId);
    setPan({ clientX: event.clientX, clientY: event.clientY, view: viewMm });
  }

  function onCanvasDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button === 2) return;
    if (event.button === 1) return startPan(event);
    const point = toPlan(event);
    if (tool.kind === "place") {
      const item = paletteItem(tool.item);
      if (!item) return;
      const room = roomAt(draft.rooms, point.x, point.y);
      // Fáze 57: zásuvka / nástěnné svítidlo se přicvakne ke stěně místnosti a natočí „nožičkou“ ke stěně
      const wall = isWallMounted(item) && room;
      const position = wall ? snapToWall(room, snap(point.x), snap(point.y)) : { x: snap(point.x), y: snap(point.y) };
      const element: EditorElement = {
        id: newId(item.kind === "panel" ? "rh" : "e"),
        item: item.id,
        x: Math.round(position.x),
        y: Math.round(position.y),
        room: room?.name ?? lastRoom.current,
        mountHeightMm: null,
        frameUnits: 1,
        series: item.kind === "panel" ? null : draft.series,
        color: item.kind === "panel" ? null : draft.color,
        controls: [],
        rotation: wall ? wallRotation(room, point.x, point.y) : 0,
        scale: null,
      };
      update((current) => ({ ...current, elements: [...(item.kind === "panel" ? current.elements.filter((other) => other.item !== "panel") : current.elements), element] }));
      setSelectedId(element.id);
      if (item.kind === "panel") setTool({ kind: "select" });
      return;
    }
    if (tool.kind === "room" || tool.kind === "crop") {
      capture(svg.current, event.pointerId);
      setRoomDraft({ x: tool.kind === "crop" ? point.x : snap(point.x), y: tool.kind === "crop" ? point.y : snap(point.y), w: 0, h: 0 });
      setSelectedRoomId(null);
      return;
    }
    if (tool.kind === "calibrate" || tool.kind === "verify") {
      const points = [...calibration, point];
      if (points.length < 2) return void setCalibration(points);
      setCalibration([]);
      const segmentMm = segmentLength(points);
      if (segmentMm < 1) return void toast.error("Klikněte na dva různé body (začátek a konec kóty).");
      setCalibrationDialog({ mode: tool.kind, segmentMm });
      return;
    }
    setSelectedId(null);
    setSelectedRoomId(null);
    // Přiblížený výkres: tažení prázdným místem = posun pohledu
    if (zoomed) startPan(event);
  }

  /** Klik do místnosti v režimu Výběr = výběr místnosti a přesun tažením (prvky uvnitř jdou s ní). */
  function onRoomDown(event: ReactPointerEvent, room: EditorRoom, handle: RoomHandle | "move") {
    if (tool.kind !== "select" || event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(null);
    setSelectedRoomId(room.id);
    capture(svg.current, event.pointerId);
    setRoomDrag({ id: room.id, handle, start: toPlan(event), origin: { x: room.x, y: room.y, w: room.w, h: room.h } });
  }

  function onElementDown(event: ReactPointerEvent, element: EditorElement) {
    event.stopPropagation();
    if (event.button === 1) return startPan(event);
    if (event.button !== 0) return;
    if (tool.kind === "pair") {
      if (paletteItem(element.item)?.kind !== "light") return void toast.error("Klikněte na svítidlo, které má vypínač ovládat.");
      update((current) => ({
        ...current,
        elements: current.elements.map((candidate) =>
          candidate.id === tool.switchId ? { ...candidate, controls: candidate.controls.includes(element.id) ? candidate.controls.filter((id) => id !== element.id) : [...candidate.controls, element.id] } : candidate,
        ),
      }));
      return;
    }
    if (tool.kind === "room" || tool.kind === "crop" || tool.kind === "calibrate" || tool.kind === "verify") return onCanvasDown(event as unknown as ReactPointerEvent<SVGSVGElement>);
    // Fáze 57: i v režimu vkládání klik na osazenou značku ji vybere a dá se přesunout (nevloží se další přes ni)
    setSelectedId(element.id);
    setSelectedRoomId(null);
    const point = toPlan(event);
    capture(svg.current, event.pointerId);
    setDrag({ id: element.id, dx: point.x - element.x, dy: point.y - element.y });
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (pan) {
      const element = svg.current;
      const perPx = pan.view.w / Math.max(1, element?.clientWidth ?? 1);
      setViewMm({ ...pan.view, x: pan.view.x - (event.clientX - pan.clientX) * perPx, y: pan.view.y - (event.clientY - pan.clientY) * perPx });
      return;
    }
    if (!drag && !roomDraft && !roomDrag) return;
    const point = toPlan(event);
    if (roomDrag) {
      const dx = snap(point.x - roomDrag.start.x);
      const dy = snap(point.y - roomDrag.start.y);
      setDraft((current) => {
        const room = current.rooms.find((candidate) => candidate.id === roomDrag.id);
        if (!room) return current;
        if (roomDrag.handle === "move") return moveRoom(current, room.id, roomDrag.origin.x + dx - room.x, roomDrag.origin.y + dy - room.y);
        const rect = resizeRect(roomDrag.origin, roomDrag.handle, { x: snap(point.x), y: snap(point.y) });
        return { ...current, rooms: current.rooms.map((candidate) => (candidate.id === room.id ? { ...candidate, ...rect } : candidate)) };
      });
      return;
    }
    if (drag) {
      setDraft((current) => ({ ...current, elements: current.elements.map((element) => (element.id === drag.id ? { ...element, x: snap(point.x - drag.dx), y: snap(point.y - drag.dy) } : element)) }));
    }
    if (roomDraft) {
      const crop = tool.kind === "crop";
      setRoomDraft({ ...roomDraft, w: (crop ? point.x : snap(point.x)) - roomDraft.x, h: (crop ? point.y : snap(point.y)) - roomDraft.y });
    }
  }

  function onUp() {
    if (pan) return void setPan(null);
    if (roomDrag) {
      // Po změně rozměru patří do místnosti prvky, které v ní nově leží
      update((current) => {
        const room = current.rooms.find((candidate) => candidate.id === roomDrag.id);
        if (!room || roomDrag.handle === "move") return current;
        return { ...current, elements: current.elements.map((element) => (element.x >= room.x && element.x <= room.x + room.w && element.y >= room.y && element.y <= room.y + room.h ? { ...element, room: room.name } : element)) };
      });
      setRoomDrag(null);
      return;
    }
    if (drag) {
      // Přetažením do jiné místnosti se změní i místnost prvku; zásuvka u stěny se k ní přicvakne a natočí
      update((current) => ({
        ...current,
        elements: current.elements.map((element) => {
          if (element.id !== drag.id) return element;
          const room = roomAt(current.rooms, element.x, element.y);
          if (!room) return element;
          if (!isWallMounted(paletteItem(element.item))) return { ...element, room: room.name };
          const position = snapToWall(room, element.x, element.y);
          const atWall = position.x !== element.x || position.y !== element.y;
          return { ...element, room: room.name, x: Math.round(position.x), y: Math.round(position.y), rotation: atWall ? wallRotation(room, element.x, element.y) : element.rotation };
        }),
      }));
      setDrag(null);
    }
    if (roomDraft) {
      const rect = { x: Math.min(roomDraft.x, roomDraft.x + roomDraft.w), y: Math.min(roomDraft.y, roomDraft.y + roomDraft.h), w: Math.abs(roomDraft.w), h: Math.abs(roomDraft.h) };
      setRoomDraft(null);
      if (tool.kind === "crop") return applyCrop(rect);
      if (rect.w < 500 || rect.h < 500) return;
      // Název se upraví v detailu místnosti (rychlé štítky), místnost zůstane vybraná
      const name = uniqueRoomName(draft.rooms, `Místnost ${draft.rooms.length + 1}`);
      lastRoom.current = name;
      const id = newId("m");
      setSelectedRoomId(id);
      setSelectedId(null);
      setTool({ kind: "select" });
      update((current) => ({
        ...current,
        rooms: [...current.rooms, { id, name: name.slice(0, 40), ...rect }],
        // prvky uvnitř nové místnosti do ní patří
        elements: current.elements.map((element) => (element.x >= rect.x && element.x <= rect.x + rect.w && element.y >= rect.y && element.y <= rect.y + rect.h ? { ...element, room: name.slice(0, 40) } : element)),
      }));
    }
  }

  function applyCrop(rect: { x: number; y: number; w: number; h: number }) {
    if (rect.w < 500 || rect.h < 500) return void toast.error("Ořez je příliš malý – táhněte obdélník přes část výkresu, kterou chcete zachovat.");
    const impact = cropImpact(draft, rect);
    if ((impact.elements || impact.rooms) && !window.confirm(`Mimo ořez leží ${impact.elements} značek a ${impact.rooms} místností – budou odstraněny. Oříznout?`)) return;
    update((current) => cropDraft(current, rect));
    setView(FIT);
    setTool({ kind: "select" });
    setSelectedId(null);
    setSelectedRoomId(null);
    toast.success(`Podklad oříznut na ${roomDimensions(rect.w, rect.h).label}. Měřítko zůstává.`);
  }

  function pdfAction(action: PdfEditAction) {
    if (action === "zoom-in") return zoomBy(ZOOM_STEP);
    if (action === "zoom-out") return zoomBy(1 / ZOOM_STEP);
    if (action === "zoom-fit") return setView(FIT);
    if (!draft.background) return;
    if (action === "rotate-cw" || action === "rotate-ccw") {
      update((current) => rotateDraft(current, action === "rotate-cw" ? 1 : -1));
      setView(FIT);
      return void toast.success(`Podklad otočen o 90° ${action === "rotate-cw" ? "doprava" : "doleva"} i se značkami a místnostmi.`);
    }
    if (action === "crop") {
      setSelectedId(null);
      setTool({ kind: "crop" });
      return;
    }
    if (action === "crop-reset") {
      update((current) => resetCrop(current));
      setView(FIT);
      return void toast.success("Ořez zrušen – zobrazen celý podklad.");
    }
    setCalibration([]);
    setTool({ kind: action === "verify" ? "verify" : "calibrate" });
  }

  function onCalibrated(result: CalibrationResult) {
    if (!calibrationDialog) return;
    const segmentMm = calibrationDialog.segmentMm;
    update((current) => ({
      ...recalibrate(current, segmentMm, result.realMm),
      calibration: { ...emptyCalibration(), state: "set", referenceMm: result.realMm, drawingScale: result.drawingScale, scaleDeviationPct: result.scaleDeviationPct, at: Date.now() },
    }));
    setCalibrationDialog(null);
    setCalibration([]);
    setTool({ kind: "verify" });
    toast.info(`Měřítko nastaveno (${(result.realMm / 1000).toLocaleString("cs-CZ")} m). Teď ho ověřte: klikněte na začátek a konec jiné známé kóty.`);
  }

  function onVerified(check: { measuredMm: number; expectedMm: number; deviationPct: number }) {
    update((current) => ({ ...current, calibration: { ...current.calibration, state: "verified", check, at: Date.now() } }));
    setCalibrationDialog(null);
    setTool({ kind: "select" });
    toast.success("Měřítko ověřeno a potvrzeno.");
  }

  async function pickBackground(file: File) {
    try {
      let blob: Blob;
      let widthPx: number;
      let heightPx: number;
      let pagePt: FloorplanBackground["pagePt"] = null;
      let pages = 1;
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        // Fáze 57: pdf.js dostane přímo data souboru; výsledek je hotový JPEG v šířce 3200 px
        setBusy("Vykresluji PDF…");
        const rendered = await renderPdfFile(file, 1, BACKGROUND_PX);
        ({ blob, width: widthPx, height: heightPx, pagePt, pageCount: pages } = rendered);
      } else {
        setBusy("Připravuji obrázek…");
        const resized = await resizeImage(file.type === "image/svg+xml" ? await rasterizeSvg(file) : file, BACKGROUND_PX, 0.9);
        const bitmap = await createImageBitmap(resized);
        widthPx = bitmap.width;
        heightPx = bitmap.height;
        bitmap.close();
        blob = resized;
      }
      // Fáze 55: nevykreslená / prázdná stránka PDF by dala nesmyslné měřítko (plocha 0 × 0 m)
      if (!widthPx || !heightPx) throw new Error("Podklad se nepodařilo vykreslit (prázdná stránka). Zkuste jinou stránku nebo obrázek PNG / JPG.");
      setBusy("Nahrávám podklad…");
      const uploaded = await uploadFile("photo", new File([blob], "pudorys.jpg", { type: "image/jpeg" }));
      // Obrázek se načte dřív, než se přepne nákres – plátno ho pak ukáže hned, bez obnovení stránky
      setBusy("Načítám podklad…");
      await preloadImage(uploaded.url);
      // Výchozí odhad měřítka: šířka podkladu ≈ 15 m – přesně ho nastaví kalibrace
      const mmPerPx = 15_000 / widthPx;
      const background: FloorplanBackground = { url: uploaded.url, widthPx, heightPx, rotation: 0, crop: null, pagePt };
      update((current) => ({ ...current, background, mmPerPx, ...planExtent(background, mmPerPx), calibration: emptyCalibration() }));
      setView(FIT);
      setCalibration([]);
      setTool({ kind: "calibrate" });
      toast.info(`${pages > 1 ? `PDF má ${pages} stran – použita 1. strana. ` : ""}Podklad nahrán. Teď klikněte na začátek a konec známé stěny nebo kóty (📏 kalibrace).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Podklad se nepodařilo nahrát.");
    } finally {
      setBusy(null);
    }
  }

  function removeRoom(id: string) {
    update((current) => deleteRoom(current, id));
    setSelectedRoomId(null);
  }

  function changeLevel(level: InstallLevel) {
    if (level === draft.installation) return;
    const preview = levelConversionPreview(draft, level);
    if (preview.count || preview.removed) return void setLevelPrompt({ level, ...preview });
    applyLevel(level);
  }

  function applyLevel(level: InstallLevel) {
    const result = convertForLevel(draft, level);
    update(() => result.draft);
    setLevelPrompt(null);
    if (tool.kind === "place" && !paletteFor(level).some((item) => item.id === tool.item)) setTool({ kind: "select" });
    const label = INSTALL_LEVELS.find((option) => option.id === level)?.label ?? level;
    const converted = result.changes.reduce((sum, row) => sum + row.count, 0);
    toast.success(`${label}${converted ? ` – převedeno ${converted} ovladačů` : ""}${result.removed ? `, odstraněno ${result.removed}` : ""}. Paleta ovládání se změnila.`);
  }

  function generate(form: FormData) {
    if (!checklist.ready) return void toast.error(checklist.items.find((item) => !item.ok)?.label ?? "Doplňte kontrolní seznam.");
    startTransition(async () => {
      const result = await createFloorplanProjectAction({
        name: String(form.get("name") ?? ""),
        customerName: String(form.get("customer") ?? "") || null,
        installationSite: String(form.get("site") ?? "") || null,
        draft,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Rozváděč vygenerován: ${result.data.circuits} okruhů, ${result.data.devices} přístrojů${result.data.enclosure ? `, skříň ${result.data.enclosure}` : ""}.`);
      for (const warning of result.data.warnings.slice(0, 3)) toast.warning(warning);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  const nodeById = analysis.ok ? new Map(analysis.build.routeNodes.map((node) => [node.id, node])) : new Map();
  const panelPoint = analysis.ok ? analysis.build.panel : null;
  const routePath = (segments: readonly { from: string; to: string }[]) => {
    if (!panelPoint) return "";
    const path: string[] = [];
    let last = { x: panelPoint.x, y: panelPoint.y };
    for (const segment of segments) {
      const to = nodeById.get(segment.to);
      if (!to) continue;
      // Hvězda (sběrnicová instalace) začíná každou větev znovu v rozváděči
      const from = segment.from === "panel" ? panelPoint : (nodeById.get(segment.from) ?? last);
      path.push(`M ${from.x} ${from.y} L ${to.x} ${from.y} L ${to.x} ${to.y}`);
      last = to;
    }
    return path.join(" ");
  };
  const hint =
    tool.kind === "place"
      ? `Klikněte do půdorysu – ${paletteItem(tool.item)?.label ?? ""}. Klik na osazenou značku ji vybere a přesune. Esc / pravé tlačítko = konec.`
      : tool.kind === "room"
        ? "Tažením myší nakreslete obdélník místnosti – rozměry X × Y se zobrazují živě."
        : tool.kind === "crop"
          ? "✂ Tažením vyberte část podkladu, která zůstane (Esc = zrušit)."
          : tool.kind === "calibrate"
            ? calibration.length
              ? "Klikněte na konec známé stěny / kóty."
              : "📏 Kalibrace: klikněte na začátek známé stěny nebo kóty ve výkresu (nejlépe co nejdelší)."
            : tool.kind === "verify"
              ? calibration.length
                ? "Klikněte na konec ověřovací kóty."
                : "✅ Ověření: klikněte na začátek jiné známé kóty (ideálně kolmé na kalibrační)."
              : tool.kind === "pair"
                ? "🔗 Klikněte na svítidla, která má vypínač ovládat (znovu = odpojit). Esc = hotovo."
                : selectedRoom
                  ? "Místnost: tažením za vnitřek přesun (i s prvky), za stěnu nebo žlutý roh změna rozměru, Delete = smazat."
                  : selected
                    ? "Značka: tažením přesun, R = otočit, šipky = posun po 5 cm, Delete = smazat."
                    : `Výběr: klik = detail prvku / místnosti, tažení = přesun, Delete = smazat. Ctrl + kolečko = zoom${zoomed ? ", tažením prázdným místem posun" : ""}.`;

  return (
    <div className="flex flex-col gap-3" data-testid="floorplan-editor">
      {/* Horní lišta: podklad, úprava PDF, nástroje */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          className="sr-only"
          aria-label="Podklad půdorysu"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void pickBackground(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Nahrát půdorys (obrázek / PDF)
        </Button>
        <PdfEditMenu hasBackground={Boolean(draft.background)} cropped={Boolean(draft.background?.crop)} zoomPercent={Math.round(zoom * 100)} calibration={draft.calibration.state} onAction={pdfAction} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => update((current) => ({ ...current, background: null, calibration: emptyCalibration() }))} disabled={!draft.background}>
          <Grid3x3 className="size-4" aria-hidden /> Čistý rastr
        </Button>
        <ToolButton active={tool.kind === "select"} onClick={() => setTool({ kind: "select" })} icon={<MousePointer2 className="size-4" aria-hidden />} label="Výběr" />
        <ToolButton active={tool.kind === "room"} onClick={() => setTool({ kind: "room" })} icon={<Square className="size-4" aria-hidden />} label="Kreslit místnost" />
        <ToolButton active={tool.kind === "calibrate"} onClick={() => (setCalibration([]), setTool({ kind: "calibrate" }))} icon={<Ruler className="size-4" aria-hidden />} label="📏 Kalibrovat měřítko" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            if (!window.confirm("Vymazat celý nákres (prvky, místnosti i podklad)?")) return;
            setDraft({ ...emptyDraft(), updatedAt: Date.now() });
            setSelectedId(null);
            setView(FIT);
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Vymazat nákres
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {draft.background ? (
            <span className={cn("rounded-full border px-2 py-0.5", draft.calibration.state === "verified" ? "border-emerald-500/50 text-emerald-300" : "border-amber-400/60 text-amber-200")} data-testid="calibration-state">
              {draft.calibration.state === "verified" ? "✓ Měřítko ověřeno" : draft.calibration.state === "set" ? "Měřítko neověřeno" : "Měřítko nekalibrováno"}
            </span>
          ) : null}
          <span data-testid="floorplan-scale">
            Plocha {(draft.widthMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} × {(draft.heightMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Způsob vedení kabelů">
          {ROUTING_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={draft.mode === mode}
              onClick={() => update((current) => ({ ...current, mode }))}
              className={cn("rounded-md border px-2.5 py-1.5 text-sm font-semibold", draft.mode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              [ {MODE_BUTTONS[mode]} ]
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Výšky v mm od podlahy" role="group">
          {HEIGHTS.map((height) => (
            <label key={height.key} className="flex items-center gap-1 text-muted-foreground">
              {height.label}:
              <input
                type="number"
                min={0}
                max={6000}
                step={50}
                value={draft.profile[height.key]}
                onChange={(event) => update((current) => ({ ...current, profile: { ...current.profile, [height.key]: Math.max(0, Number(event.target.value) || 0) } }))}
                className="h-8 w-20 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30"
                aria-label={`${height.label} [mm]`}
              />
              mm
            </label>
          ))}
        </div>
        {/* Fáze 57: rezerva kabeláže a měřítko značek */}
        <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Rezerva a značky">
          <label className="flex items-center gap-1 text-muted-foreground" title="Technologická rezerva na ohyby, nepřesnost trasy a prořez – přičte se ke všem trasám">
            Rezerva kabeláže:
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={draft.profile.slackPercent}
              onChange={(event) => update((current) => ({ ...current, profile: { ...current.profile, slackPercent: Math.min(50, Math.max(0, Math.round(Number(event.target.value) || 0))) } }))}
              className="h-8 w-14 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30"
              aria-label="Rezerva kabeláže [%]"
            />
            %
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            Velikost značek:
            <input
              type="range"
              min={SYMBOL_SCALE_MIN}
              max={SYMBOL_SCALE_MAX}
              step={0.1}
              value={draft.symbolScale}
              onChange={(event) => update((current) => ({ ...current, symbolScale: clampSymbolScale(Number(event.target.value)) }))}
              className="w-24 accent-primary"
              aria-label="Velikost značek"
            />
            <span className="w-10 text-right font-mono tabular-nums text-foreground" data-testid="symbol-scale">
              {Math.round(draft.symbolScale * 100)} %
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 text-xs" role="group" aria-label="Metodika ČSN 33 2130 ed. 4" data-testid="install-methodology">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-muted-foreground">
            Úroveň instalace:
            <select
              className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30"
              value={draft.installation}
              onChange={(event) => changeLevel(event.target.value as InstallLevel)}
              aria-label="Úroveň instalace"
              title={INSTALL_LEVELS.find((level) => level.id === draft.installation)?.description}
            >
              {INSTALL_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            Uložení kabelů:
            <select
              className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30"
              value={draft.installMethod}
              onChange={(event) => update((current) => ({ ...current, installMethod: event.target.value as InstallMethod }))}
              aria-label="Způsob uložení kabelů"
            >
              {INSTALL_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            Souběh kabelů:
            <input
              type="number"
              min={1}
              max={20}
              value={draft.groupedCables}
              onChange={(event) => update((current) => ({ ...current, groupedCables: Math.min(20, Math.max(1, Math.round(Number(event.target.value) || 1))) }))}
              className="h-8 w-14 rounded-md border border-input bg-transparent px-1.5 text-right text-sm text-foreground tabular-nums dark:bg-input/30"
              aria-label="Počet souběžných kabelů"
            />
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={draft.countDoubleAsTwo} onChange={(event) => update((current) => ({ ...current, countDoubleAsTwo: event.target.checked }))} />
            Počítat dvojzásuvku jako 2 zásuvky dle ČSN 33 2130 ed. 4
          </label>
        </div>
        <p className="rounded-md bg-primary/10 px-2 py-1 text-foreground" data-testid="level-note">
          {LEVEL_NOTES[draft.installation]}
        </p>
      </div>

      {/* Fáze 55: výrobce → řada (náhled tvaru) → barvy řady a soustava přívodu v horní liště nad rastrem */}
      <DeviceAppearance
        seriesKey={draft.series}
        color={draft.color}
        available={available}
        selectedRoom={selectedRoom?.name ?? null}
        supply={draft.supplySystem}
        onSupply={(supplySystem) => update((current) => ({ ...current, supplySystem }))}
        onChange={(patch) =>
          update((current) => {
            const series = patch.series ?? current.series;
            return { ...current, series, color: colorForSeries(series, patch.color ?? current.color) };
          })
        }
        onApplyAll={() => {
          update((current) => applyAppearance(current));
          toast.success(`Vzhled ${appearanceLabel(draft.series, draft.color)} použit na celý půdorys.`);
        }}
        onApplyRoom={() => {
          if (!selectedRoom) return;
          update((current) => applyAppearance(current, { room: selectedRoom.name }));
          toast.success(`Vzhled použit v místnosti ${selectedRoom.name}.`);
        }}
      />

      <div className="grid gap-3 xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
        {/* Paleta značek podle úrovně instalace */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3" aria-label="Paleta elektroinstalačních značek">
          {PALETTE_GROUPS.map((group) => {
            const items = palette.filter((item) => item.group === group.id);
            if (!items.length) return null;
            return (
              <div key={group.id} className="flex flex-col gap-1" data-group={group.id}>
                <h3 className="text-xs font-bold text-muted-foreground">{group.id === "controls" ? CONTROLS_LABEL[draft.installation] : group.label}</h3>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => {
                    const active = tool.kind === "place" && tool.item === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTool(active ? { kind: "select" } : { kind: "place", item: item.id })}
                        title={`${item.label} (${item.heightMm ?? mountHeight({ kind: item.kind === "panel" ? "switch" : item.kind, variant: item.variant, tag: item.tag }, draft.profile)} mm)`}
                        className={cn("flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs", active ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground")}
                      >
                        <span className="rounded bg-muted px-1 font-mono text-[10px] font-bold text-foreground">{item.symbol}</span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Plátno půdorysu */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-xs text-muted-foreground" role="status">
            {hint}
          </p>
          <div className="relative overflow-hidden rounded-xl border border-border bg-zinc-950">
            <svg
              ref={svg}
              viewBox={viewBoxOf(viewMm, draft)}
              className={cn("block h-auto w-full touch-none select-none", pan ? "cursor-grabbing" : tool.kind === "select" ? (zoomed ? "cursor-grab" : "cursor-default") : "cursor-crosshair")}
              role="application"
              aria-label="Půdorys elektroinstalace"
              data-testid="floorplan-canvas"
              data-zoom={Math.round(zoom * 100)}
              onPointerDown={onCanvasDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onContextMenu={(event) => {
                // Pravé tlačítko = konec vkládání / měření
                event.preventDefault();
                setTool({ kind: "select" });
                setCalibration([]);
                setRoomDraft(null);
              }}
            >
              <defs>
                <pattern id="fp-grid" width={1000} height={1000} patternUnits="userSpaceOnUse">
                  <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#27272a" strokeWidth={Math.max(stroke, draft.widthMm / 2000)} />
                </pattern>
              </defs>
              <rect width={draft.widthMm} height={draft.heightMm} fill={draft.background ? "#fff" : "url(#fp-grid)"} />
              {draft.background ? (
                <g transform={backgroundTransform(draft.background, draft.mmPerPx)} pointerEvents="none">
                  <image key={draft.background.url} href={draft.background.url} width={draft.background.widthPx} height={draft.background.heightPx} preserveAspectRatio="none" opacity={0.9} data-testid="floorplan-background" />
                </g>
              ) : null}
              {draft.rooms.map((room) => {
                const active = room.id === selectedRoomId;
                const handle = ui * 0.45;
                const edge = ui * 0.35;
                return (
                  <g key={room.id} data-room={room.name} aria-label={`Místnost ${room.name}`}>
                    <rect
                      x={room.x}
                      y={room.y}
                      width={room.w}
                      height={room.h}
                      fill={active ? "rgba(250,204,21,0.10)" : "rgba(250,204,21,0.04)"}
                      stroke={active ? "#facc15" : "#a1a1aa"}
                      strokeWidth={stroke * (active ? 4 : 2.5)}
                      className={tool.kind === "select" ? (active ? "cursor-move" : "cursor-pointer") : undefined}
                      onPointerDown={(event) => onRoomDown(event, room, "move")}
                      data-testid={`room-${room.name}`}
                    />
                    <text x={room.x + ui * 0.4} y={room.y + ui * 1.1} fontSize={ui * 0.8} fill={draft.background ? "#52525b" : "#d4d4d8"} pointerEvents="none">
                      {room.name} · {roomDimensions(room.w, room.h).label}
                    </text>
                    {active ? (
                      <>
                        {/* Stěny: tažením změna rozměru */}
                        <rect x={room.x} y={room.y - edge / 2} width={room.w} height={edge} fill="transparent" className="cursor-ns-resize" onPointerDown={(event) => onRoomDown(event, room, "n")} data-handle="n" />
                        <rect x={room.x} y={room.y + room.h - edge / 2} width={room.w} height={edge} fill="transparent" className="cursor-ns-resize" onPointerDown={(event) => onRoomDown(event, room, "s")} data-handle="s" />
                        <rect x={room.x - edge / 2} y={room.y} width={edge} height={room.h} fill="transparent" className="cursor-ew-resize" onPointerDown={(event) => onRoomDown(event, room, "w")} data-handle="w" />
                        <rect x={room.x + room.w - edge / 2} y={room.y} width={edge} height={room.h} fill="transparent" className="cursor-ew-resize" onPointerDown={(event) => onRoomDown(event, room, "e")} data-handle="e" />
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
                          onPointerDown={(event) => onRoomDown(event, room, "se")}
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
                              removeRoom(room.id);
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
              })}
              {roomDraft ? (
                <g data-testid={tool.kind === "crop" ? "crop-draft" : "room-draft"}>
                  {tool.kind === "crop" ? (
                    // Ztmavení části, která se ořízne
                    <path
                      d={`M0 0 H${draft.widthMm} V${draft.heightMm} H0 Z M${Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} ${Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} v${Math.abs(roomDraft.h)} h${Math.abs(roomDraft.w)} v${-Math.abs(roomDraft.h)} Z`}
                      fill="rgba(9,9,11,0.55)"
                      fillRule="evenodd"
                      pointerEvents="none"
                    />
                  ) : null}
                  <rect x={Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} y={Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} width={Math.abs(roomDraft.w)} height={Math.abs(roomDraft.h)} fill="none" stroke="#facc15" strokeDasharray={`${ui / 3} ${ui / 4}`} strokeWidth={stroke * 3} />
                  <Dimensions x={Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} y={Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} w={Math.abs(roomDraft.w)} h={Math.abs(roomDraft.h)} symbol={ui} />
                </g>
              ) : null}

              {/* Trasy kabelů po okruzích (Manhattan) */}
              {analysis.ok && panelPoint
                ? analysis.summary.circuits.map((circuit, index) => {
                    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
                    const last = nodeById.get(circuit.route.segments.at(-1)?.to ?? "") ?? panelPoint;
                    return (
                      <g key={circuit.id} data-testid="cable-route" pointerEvents="none">
                        <path d={routePath(circuit.route.segments)} fill="none" stroke={color} strokeWidth={stroke * 3.5} strokeDasharray={circuit.routing === "TOP" ? `${ui / 2} ${ui / 5}` : undefined} opacity={0.9} />
                        <text x={last.x + ui * 0.6} y={last.y - ui * 0.6} fontSize={ui * 0.62} fill={color} fontWeight={700}>
                          {circuit.lengthsM[draft.mode].toLocaleString("cs-CZ")} m
                        </text>
                      </g>
                    );
                  })
                : null}
              {/* Fáze 57: sběrnicová linka (KNX / Loxone Tree) */}
              {analysis.ok && analysis.summary.busLine ? (
                <path d={routePath(analysis.summary.busLine.segments)} fill="none" stroke="#22c55e" strokeWidth={stroke * 2.5} strokeDasharray={`${ui / 6} ${ui / 6}`} pointerEvents="none" data-testid="bus-line" />
              ) : null}

              {/* Ovládací vazby vypínač → světlo */}
              {draft.elements.flatMap((element) =>
                element.controls.map((lightId) => {
                  const light = draft.elements.find((candidate) => candidate.id === lightId);
                  return light ? <line key={`${element.id}-${lightId}`} x1={element.x} y1={element.y} x2={light.x} y2={light.y} stroke={draft.background ? "#71717a" : "#e4e4e7"} strokeWidth={stroke * 1.5} strokeDasharray={`${ui / 4} ${ui / 4}`} data-testid="switch-link" pointerEvents="none" /> : null;
                }),
              )}

              {calibration.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r={ui / 4} fill={tool.kind === "verify" ? "#22c55e" : "#facc15"} stroke="#09090b" strokeWidth={stroke} data-testid="calibration-point" />
              ))}

              {draft.elements.map((element) => {
                const item = paletteItem(element.item);
                if (!item) return null;
                const size = symbolSizeOf(draft, element);
                const active = element.id === selectedId || (tool.kind === "pair" && tool.switchId === element.id);
                return (
                  <g key={element.id} transform={`translate(${element.x} ${element.y})`} onPointerDown={(event) => onElementDown(event, element)} className={tool.kind === "select" || tool.kind === "place" ? "cursor-move" : "cursor-pointer"} data-element={item.id} aria-label={`${item.label} – ${element.room}`} role="button">
                    {item.kind === "panel" ? (
                      <PanelSymbol size={size * 1.3} active={active} onPaper={Boolean(draft.background)} label={item.symbol} />
                    ) : (
                      // Fáze 57: značka dle ČSN EN 60617-11, řazení vypínače z párování, natočení ke stěně
                      <FloorSymbol item={item} size={size} active={active} onPaper={Boolean(draft.background)} rotation={element.rotation} switchNo={isWiredSwitch(item) && (item.control ?? "light") === "light" ? effectiveSwitchNo(draft, element) : undefined} level={draft.installation} lem={designColor(element.color ?? draft.color)?.swatch ?? null} />
                    )}
                    {element.frameUnits > 1 ? (
                      <text x={size * 0.6} y={size * 0.75} fontSize={size * 0.3} fill="#ca8a04" fontWeight={700}>
                        {element.frameUnits}R
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {/* Fáze 57: plovoucí lišta vybrané značky – otočit, zmenšit / zvětšit, smazat */}
              {selected && tool.kind !== "pair" ? (
                <ElementToolbar
                  x={selected.x}
                  y={selected.y - symbolSizeOf(draft, selected) * 0.9}
                  unit={ui}
                  onRotate={() => rotateSelected(selected.id)}
                  onScale={(factor) => update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === selected.id ? { ...element, scale: clampSymbolScale((element.scale ?? 1) * factor) } : element)) }))}
                  onDelete={() => removeSelected(selected.id)}
                />
              ) : null}
            </svg>
            {/* Zoom */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 text-xs shadow" role="group" aria-label="Zoom půdorysu">
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Oddálit">
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="w-12 text-center font-mono tabular-nums" data-testid="zoom-level">
                {Math.round(zoom * 100)} %
              </span>
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Přiblížit">
                <Plus className="size-3.5" aria-hidden />
              </button>
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => setView(FIT)} aria-label="Celý výkres">
                <Maximize2 className="size-3.5" aria-hidden />
              </button>
            </div>
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70" role="status" data-testid="floorplan-busy">
                <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> {busy}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Detail prvku + výkaz kabeláže */}
        <aside className="flex flex-col gap-3" aria-label="Detail a výkaz kabeláže">
          {selectedRoom ? (
            <RoomDetail
              key={selectedRoom.id}
              room={selectedRoom}
              onChange={(patch) => update((current) => updateRoom(current, selectedRoom.id, patch))}
              onDelete={() => removeRoom(selectedRoom.id)}
            />
          ) : null}
          {selected ? (
            <ElementDetail
              key={selected.id}
              draft={draft}
              element={selected}
              pairing={tool.kind === "pair" && tool.switchId === selected.id}
              onPair={() => setTool(tool.kind === "pair" ? { kind: "select" } : { kind: "pair", switchId: selected.id })}
              onChange={(patch) => update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === selected.id ? { ...element, ...patch } : element)) }))}
              onRotate={() => rotateSelected(selected.id)}
              onDelete={() => removeSelected(selected.id)}
            />
          ) : null}
          <CablePanel
            analysis={analysis}
            mode={draft.mode}
            pending={pending}
            onGenerate={generate}
            slackPercent={draft.profile.slackPercent}
            environment={draft.environment}
            onEnvironment={(environment) => update((current) => ({ ...current, environment }))}
            checklist={checklist}
          />
          {/* Fáze 55: kusovník domovní instalace s objednacími čísly */}
          <WiringBomDialog rows={bom} />
          {inventory.length ? (
            <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Soupis domovní instalace" data-testid="wiring-inventory">
              <h3 className="font-bold">Soupis domovní instalace</h3>
              <ul className="flex flex-col gap-0.5 text-xs">
                {inventory.map((row) => (
                  <li key={`${row.label}|${row.appearance}`} className="flex justify-between gap-2">
                    <span className="min-w-0">
                      {row.label} <span className="text-muted-foreground">– {row.appearance}</span>
                    </span>
                    <span className="font-mono tabular-nums">{row.count}×</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {calibrationDialog ? (
        <CalibrationDialog
          mode={calibrationDialog.mode}
          segmentMm={calibrationDialog.segmentMm}
          draft={draft}
          onCalibrate={onCalibrated}
          onVerified={onVerified}
          onRetry={(mode) => {
            setCalibrationDialog(null);
            setCalibration([]);
            setTool({ kind: mode });
          }}
          onClose={() => {
            setCalibrationDialog(null);
            setCalibration([]);
          }}
        />
      ) : null}

      {levelPrompt ? (
        <Dialog open onOpenChange={(open) => !open && setLevelPrompt(null)}>
          <DialogContent className="sm:max-w-lg" data-testid="level-conversion">
            <DialogHeader>
              <DialogTitle>Změnit úroveň instalace?</DialogTitle>
              <DialogDescription>{INSTALL_LEVELS.find((level) => level.id === levelPrompt.level)?.description}</DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-1 text-sm">
              {levelPrompt.changes.map((row) => (
                <li key={`${row.from}>${row.to}`} className="flex justify-between gap-3 rounded bg-muted/40 px-2 py-1">
                  <span>
                    {row.from} → <b>{row.to}</b>
                  </span>
                  <span className="font-mono">{row.count}×</span>
                </li>
              ))}
              {levelPrompt.removed ? <li className="text-amber-200">Bez obdoby v nové úrovni (odstraní se): {levelPrompt.removed}×</li> : null}
            </ul>
            <p className="text-xs text-muted-foreground">Párování ovladačů se světly zůstane. Kabeláž, okruhy a kusovník se přepočítají podle nové úrovně.</p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setLevelPrompt(null)}>
                Zrušit
              </Button>
              <Button type="button" onClick={() => applyLevel(levelPrompt.level)} data-testid="level-convert">
                Převést ovládání
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} className="gap-1.5" onClick={onClick}>
      {icon} {label}
    </Button>
  );
}

/** Plovoucí lišta nad vybranou značkou (velikost drží stejnou na obrazovce i při zoomu). */
function ElementToolbar({ x, y, unit, onRotate, onScale, onDelete }: { x: number; y: number; unit: number; onRotate: () => void; onScale: (factor: number) => void; onDelete: () => void }) {
  const size = unit * 1.15;
  const buttons: { label: string; text: string; fill: string; onClick: () => void }[] = [
    { label: "Otočit značku o 90°", text: "⟳", fill: "#27272a", onClick: onRotate },
    { label: "Zmenšit značku", text: "−", fill: "#27272a", onClick: () => onScale(1 / 1.25) },
    { label: "Zvětšit značku", text: "+", fill: "#27272a", onClick: () => onScale(1.25) },
    { label: "Smazat značku", text: "🗑", fill: "#dc2626", onClick: onDelete },
  ];
  const width = buttons.length * (size + unit * 0.15) + unit * 0.15;
  return (
    <g transform={`translate(${x - width / 2} ${y - size - unit * 0.3})`} data-testid="element-toolbar">
      <rect width={width} height={size + unit * 0.3} rx={unit * 0.25} fill="#18181b" stroke="#38bdf8" strokeWidth={unit / 16} />
      {buttons.map((button, index) => (
        <g
          key={button.label}
          transform={`translate(${unit * 0.15 + index * (size + unit * 0.15)} ${unit * 0.15})`}
          className="cursor-pointer"
          role="button"
          aria-label={button.label}
          onPointerDown={(event) => {
            event.stopPropagation();
            button.onClick();
          }}
        >
          <rect width={size} height={size} rx={unit * 0.2} fill={button.fill} />
          <text x={size / 2} y={size / 2} fontSize={unit * 0.7} textAnchor="middle" dominantBaseline="central" fill="#fafafa" pointerEvents="none">
            {button.text}
          </text>
        </g>
      ))}
    </g>
  );
}

function removeElement(draft: FloorplanDraft, id: string): FloorplanDraft {
  return { ...draft, updatedAt: Date.now(), elements: draft.elements.filter((element) => element.id !== id).map((element) => ({ ...element, controls: element.controls.filter((lightId) => lightId !== id) })) };
}

/** Předběžné načtení nahraného podkladu (dekódování) – při chybě ještě 2 pokusy. */
async function preloadImage(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const image = new Image();
      image.src = attempt ? `${url}?pokus=${attempt}` : url;
      await image.decode();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new Error("Nahraný podklad se nepodařilo načíst – zkuste to prosím znovu.");
}

/** SVG podklad → PNG (createImageBitmap SVG neumí). */
async function rasterizeSvg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = BACKGROUND_PX / Math.max(image.naturalWidth || 1200, image.naturalHeight || 800);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((image.naturalWidth || 1200) * scale);
    canvas.height = Math.round((image.naturalHeight || 800) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Plátno není k dispozici.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("SVG se nepodařilo převést.");
    return new File([blob], "pudorys.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ElementDetail({
  draft,
  element,
  pairing,
  onPair,
  onChange,
  onRotate,
  onDelete,
}: {
  draft: FloorplanDraft;
  element: EditorElement;
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const item = paletteItem(element.item)!;
  const isPanel = item.kind === "panel";
  const defaultHeight = isPanel ? draft.profile.switchboardHeightMm : item.heightMm ?? mountHeight({ kind: item.kind as Exclude<typeof item.kind, "panel">, variant: item.variant, tag: item.tag }, draft.profile);
  const frameable = !item.wireless && (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch");
  const rooms = [...new Set([...draft.rooms.map((room) => room.name), ...draft.elements.map((other) => other.room)])];
  const lights = draft.elements.filter((other) => element.controls.includes(other.id));
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Detail vybraného prvku" data-testid="element-detail">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          <span className="mr-1.5 rounded bg-muted px-1 font-mono text-xs">{item.symbol}</span>
          {item.label}
        </h3>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onRotate} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Otočit prvek o 90°" title="Otočit o 90° (R)">
            <RotateCw className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label="Smazat prvek">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {/* Fáze 57: měřítko značky (násobek velikosti značek nákresu) */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" role="radiogroup" aria-label="Měřítko značky">
        Měřítko značky:
        {SCALE_OPTIONS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={(element.scale ?? 1) === value} onClick={() => onChange({ scale: value === 1 ? null : value })} className={cn("rounded border px-1.5 py-0.5", (element.scale ?? 1) === value ? "border-primary bg-primary/20 text-foreground" : "border-border")}>
            {Math.round(value * 100)} %
          </button>
        ))}
      </div>
      {isPanel ? (
        <p className="text-xs text-muted-foreground">Výchozí bod všech tras. Výška rozváděče se nastavuje v horní liště ({draft.profile.switchboardHeightMm} mm).</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Montážní výška [mm]
              <Input type="number" min={0} max={6000} step={50} value={element.mountHeightMm ?? ""} placeholder={String(defaultHeight)} onChange={(event) => onChange({ mountHeightMm: event.target.value === "" ? null : Number(event.target.value) })} aria-label="Montážní výška [mm]" className="h-8" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Místnost
              <Input value={element.room} list="fp-rooms" maxLength={40} onChange={(event) => onChange({ room: event.target.value })} aria-label="Místnost" className="h-8" />
              <datalist id="fp-rooms">
                {rooms.map((room) => (
                  <option key={room} value={room} />
                ))}
              </datalist>
            </label>
          </div>
          {frameable ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" role="radiogroup" aria-label="Počet kusů v rámečku">
              Rámeček:
              {[1, 2, 3, 4, 5].map((units) => (
                <button key={units} type="button" role="radio" aria-checked={element.frameUnits === units} onClick={() => onChange({ frameUnits: units })} className={cn("rounded border px-2 py-0.5", element.frameUnits === units ? "border-primary bg-primary/20 text-foreground" : "border-border")}>
                  {units}R
                </button>
              ))}
            </div>
          ) : null}
          {item.kind !== "appliance" && item.kind !== "light" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Designová řada
                <select value={element.series ?? ""} onChange={(event) => onChange({ series: event.target.value || null, ...(element.color ? { color: colorForSeries(event.target.value || draft.series, element.color) } : {}) })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Designová řada prvku">
                  <option value="">podle nákresu</option>
                  {DESIGN_BRANDS.map((brand) => (
                    <optgroup key={brand.manufacturer} label={brand.label}>
                      {brand.series.map((option) => (
                        <option key={option.name} value={`${brand.manufacturer}|${option.name}`}>
                          {brand.label} {option.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Barva
                <select value={element.color ?? ""} onChange={(event) => onChange({ color: event.target.value || null })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Barva prvku">
                  <option value="">podle nákresu</option>
                  {/* Fáze 55: jen barvy řady prvku (ABB 2026 s kódy), jinak obecné skupiny */}
                  {seriesColors(element.series ?? draft.series).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="col-span-2 text-[11px] text-muted-foreground" data-testid="element-appearance">
                {appearanceLabel(element.series ?? draft.series, element.color ?? draft.color)}
              </p>
            </div>
          ) : null}
          {controlsLights(item) ? (
            <div className="flex flex-col gap-1.5">
              <Button type="button" size="sm" variant={pairing ? "default" : "outline"} className="gap-1.5" onClick={onPair}>
                <Link2 className="size-4" aria-hidden /> {pairing ? "Hotovo – ukončit párování" : "🔗 Spárovat se světlem"}
              </Button>
              <p className="text-xs text-muted-foreground" data-testid="switch-controls">
                {lights.length
                  ? `Ovládá: ${lights.map((light) => `${paletteItem(light.item)?.label} (${light.room})${isWiredSwitch(item) ? ` – řazení ${switchingFor(controllersOf(draft, light.id))}` : ""}`).join(", ")}`
                  : "Zatím neovládá žádné svítidlo."}
              </p>
              {isWiredSwitch(item) && lights.length ? (
                <p className="flex items-center gap-1 text-xs text-emerald-300" data-testid="switch-number">
                  <CheckCircle2 className="size-3" aria-hidden /> Značka kreslena jako řazení č. {effectiveSwitchNo(draft, element)}
                </p>
              ) : null}
            </div>
          ) : null}
          {item.kind === "light" ? (
            <p className="text-xs text-muted-foreground" data-testid="light-switching">
              Ovládací místa: {controllersOf(draft, element.id)} · řazení {switchingFor(controllersOf(draft, element.id))}
            </p>
          ) : null}
        </>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Zap className="size-3" aria-hidden /> Poloha {(element.x / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} / {(element.y / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m · otočení {element.rotation}°
      </p>
    </section>
  );
}

/** Živé kóty obdélníku: X u horní hrany, Y u pravé hrany, uprostřed rozměr a plocha. */
function Dimensions({ x, y, w, h, symbol }: { x: number; y: number; w: number; h: number; symbol: number }) {
  if (w <= 0 || h <= 0) return null;
  const dims = roomDimensions(w, h);
  const font = symbol * 0.62;
  const tag = (cx: number, cy: number, text: string, id: string) => (
    <g data-testid={id} pointerEvents="none">
      <rect x={cx - (text.length * font * 0.3 + font * 0.4)} y={cy - font * 0.8} width={text.length * font * 0.6 + font * 0.8} height={font * 1.3} rx={font * 0.25} fill="#facc15" />
      <text x={cx} y={cy + font * 0.1} fontSize={font} fontWeight={700} textAnchor="middle" fill="#09090b">
        {text}
      </text>
    </g>
  );
  return (
    <>
      {tag(x + w / 2, y - font * 0.2, `X: ${dims.x}`, "dim-x")}
      {tag(x + w + font * 3.2, y + h / 2, `Y: ${dims.y}`, "dim-y")}
      {tag(x + w / 2, y + h / 2, dims.label, "dim-area")}
    </>
  );
}

/** Unikátní název místnosti („Místnost 3“, „Kuchyně 2“). */
function uniqueRoomName(rooms: readonly EditorRoom[], base: string) {
  const names = new Set(rooms.map((room) => room.name));
  if (!names.has(base)) return base;
  for (let index = 2; ; index++) if (!names.has(`${base} ${index}`)) return `${base} ${index}`;
}

/** Detail vybrané místnosti: název s rychlými štítky, rozměr X × Y v metrech a smazání. */
function RoomDetail({ room, onChange, onDelete }: { room: EditorRoom; onChange: (patch: Partial<Pick<EditorRoom, "name" | "w" | "h">>) => void; onDelete: () => void }) {
  const toM = (mm: number) => Math.round(mm) / 1000;
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-yellow-400/60 bg-card p-3 text-sm" aria-label="Detail vybrané místnosti" data-testid="room-detail">
      <h3 className="font-semibold">🏠 Místnost</h3>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Název místnosti
        <Input value={room.name} maxLength={40} onChange={(event) => onChange({ name: event.target.value })} aria-label="Název místnosti" className="h-8" />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Rychlé názvy místností">
        {ROOM_NAME_CHIPS.map((name) => (
          <button key={name} type="button" onClick={() => onChange({ name })} className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", room.name === name ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Šířka X [m]
          <Input type="number" min={0.5} max={200} step={0.05} defaultValue={toM(room.w)} key={`w${room.w}`} onBlur={(event) => Number(event.target.value) > 0 && onChange({ w: Math.round(Number(event.target.value) * 1000) })} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} aria-label="Šířka X [m]" className="h-8" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hloubka Y [m]
          <Input type="number" min={0.5} max={200} step={0.05} defaultValue={toM(room.h)} key={`h${room.h}`} onBlur={(event) => Number(event.target.value) > 0 && onChange({ h: Math.round(Number(event.target.value) * 1000) })} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} aria-label="Hloubka Y [m]" className="h-8" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="room-area">
        {roomDimensions(room.w, room.h).label}
      </p>
      <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={onDelete}>
        <Trash2 className="size-4" aria-hidden /> 🗑️ Smazat místnost
      </Button>
    </section>
  );
}

/** Zachycení ukazatele plátnem (bezpečně i u syntetických událostí bez aktivního ukazatele). */
function capture(element: SVGSVGElement | null, pointerId: number) {
  try {
    element?.setPointerCapture(pointerId);
  } catch {
    // ukazatel už není aktivní – tažení funguje i bez zachycení
  }
}
