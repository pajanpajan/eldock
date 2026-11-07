"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, FileUp, Grid3x3, LayoutGrid, Link2, Loader2, Maximize2, Minus, MousePointer2, Plus, RotateCw, Ruler, Sparkles, Square, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { INSTALL_LEVELS, INSTALL_METHODS, ROUTING_MODES, mountHeight, type CableRoutingMode, type ElevationProfile, type InstallLevel, type InstallMethod } from "@/engine/floorplan-bridge";
import {
  ANNOTATION_DEFAULTS,
  CONTROLS_LABEL,
  PALETTE_GROUPS,
  ROOM_NAME_CHIPS,
  SYMBOL_SCALE_MAX,
  SYMBOL_SCALE_MIN,
  addFloor,
  allElements,
  analyzeDraft,
  applyAppearance,
  clampSymbolScale,
  controllersOf,
  controlsLights,
  convertForLevel,
  deleteRoom,
  effectiveSwitchNo,
  emptyDraft,
  floorsOf,
  frameAxis,
  generationChecklist,
  isWallMounted,
  isWiredSwitch,
  levelConversionPreview,
  levelLabel,
  moveRoom,
  paletteFor,
  paletteItem,
  parseDraft,
  recalibrate,
  removeFloor,
  resizeRect,
  roomAt,
  roomDimensions,
  snapToWall,
  switchFloor,
  switchingFor,
  symbolSizeOf,
  updateFloor,
  updateRoom,
  wallRotation,
  wiringInventory,
  DEFAULT_LIGHT,
  LIGHT_LOADS,
  lightSpecOf,
  type Annotation,
  type AnnotationKind,
  type EditorElement,
  type EditorRoom,
  type FloorplanDraft,
  type PaletteItem,
  type RoomHandle,
} from "@/lib/panel-builder/floorplan-editor";
import {
  ANNOTATION_LABEL,
  MAX_FRAME_GANGS,
  addToFrame,
  annotationBounds,
  assemblyGangs,
  assemblyLayout,
  autoPairLights,
  createFrame,
  placeAssembly,
  dissolveFrame,
  dragGroupOf,
  frameGangs,
  frameOf,
  frameOutline,
  framePitch,
  gangsOf,
  idleSwitches,
  isFrameable,
  layoutFrame,
  moveAnnotation,
  moveInFrame,
  newAnnotation,
  orthogonal,
  removeAnnotation,
  removeElements,
  removeFromFrame,
  rotateFrame,
  toggleLink,
  translateElements,
  unpairedLights,
  updateAnnotation,
} from "@/lib/panel-builder/floorplan-frames";
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

import { AnnotationShape, HatchPatterns } from "./AnnotationLayer";
import { AnnotationDetail, NoteStyleControls, type NoteStyle } from "./AnnotationPanel";
import { CablePanel } from "./CablePanel";
import { CalibrationDialog, type CalibrationResult } from "./CalibrationDialog";
import { DeviceAppearance } from "./DeviceAppearance";
import { FloorBar } from "./FloorBar";
import { FloorSymbol, PanelSymbol } from "./FloorSymbol";
import { AddToFrameControl, FrameAssemblyPalette } from "./FrameAssemblyPalette";
import { ModeBar, type ModeTone } from "../ModeBar";
import { PdfEditMenu, type PdfEditAction } from "./PdfEditMenu";
import { PlanChecks, SelectionPanel, type PlanCheck } from "./PlanPanels";
import { SmartHomePanel } from "./SmartHomePanel";
import { applyNormFix, floorplanNorms } from "@/lib/panel-builder/floorplan-norms";
import { smartPlanOf } from "@/lib/panel-builder/smart-home-plan";
import { isSmartSystem } from "@/lib/panel-builder/smart-home";
import { WiringBomDialog } from "./WiringBomDialog";
import { ApplianceEditor, useApplianceLibrary } from "./ApplianceEditor";
import { FixtureControls, FixtureShape } from "./FixtureShape";
import { FloorplanExport } from "./FloorplanExport";
import { PaletteAccordion, type PaletteSection } from "./PaletteAccordion";
import { RouteLayer } from "./RouteLayer";
import { CUSTOM_APPLIANCE_ITEM, applianceCatalog, applianceSpecFor, protectionLabel, storedSpecs, type ApplianceSpec } from "@/lib/panel-builder/appliances";
import { resizeFixture, turnBy, type FixtureHandle } from "@/lib/panel-builder/fixtures";
import { isPolygonRoom, polygonArea, polygonBounds, pointInRoom, roomPolygon, snapAngle, validPolygon, wallLabel } from "@/lib/panel-builder/room-geometry";
import { displayRoutes, editedKeysOf, type DisplayCircuit, type DisplayLeg } from "@/lib/panel-builder/route-display";
import { cleanPolyline, dragSegment, insertJog, segmentShift } from "@/lib/panel-builder/route-edit";
import { PRODUCT_FAMILIES, productById, type CatalogProduct } from "@/lib/panel-builder/smart-catalog";

// 2D editor půdorysu elektroinstalace (fáze 49, úprava PDF / značky / úroveň instalace fáze 57, fáze 59: natočení další
// značky podle předchozí, vícenásobný výběr, víceramečky s přisazením, přiřazení vypínačů ke světlům, zakreslení změn
// a podlaží domu): podklad (obrázek / PDF / rastr) s otočením, ořezem a zoomem, kalibrace s ověřením, značky dle
// ČSN EN 60617-11, trasy kabelů a výkaz kabeláže v reálném čase.

const STORAGE_KEY = "eldock.pb.floorplan";
const SNAP_MM = 50;
/** Šířka podkladu po nahrání [px] – ostrý i při přiblížení (A3 ≈ 270 dpi). */
const BACKGROUND_PX = 3200;

type Tool =
  | { kind: "select" }
  | { kind: "place"; item: string; appliance?: string; product?: string }
  /** Fáze 62: sestava ve víceramečku z palety – vloží se celá jedním klikem. */
  | { kind: "place-set"; key: string; members: string[]; label: string }
  | { kind: "room" }
  /** Fáze 63: polygonální místnost se šikmými stěnami – rohy po obvodu. */
  | { kind: "polygon" }
  | { kind: "calibrate" }
  | { kind: "verify" }
  | { kind: "crop" }
  | { kind: "pair"; switchId: string }
  | { kind: "pair-light"; lightId: string }
  | { kind: "annotate"; mode: AnnotationKind };

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

const DEFAULT_STYLES: Record<AnnotationKind, NoteStyle> = {
  wall: { ...ANNOTATION_DEFAULTS.wall, fontMm: 250, bold: false, background: false },
  demolish: { ...ANNOTATION_DEFAULTS.demolish, fontMm: 250, bold: false, background: false },
  zone: { ...ANNOTATION_DEFAULTS.zone, fontMm: 250, bold: false, background: false },
  text: { ...ANNOTATION_DEFAULTS.text, fontMm: 250, bold: false, background: true },
};

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
const turn = (rotation: number) => turnBy(rotation, 90);
/** Český tvar podle počtu: 1 svítidlo, 2–4 svítidla, 5 a víc svítidel. */
const plural = (count: number, one: string, few: string, many: string) => (count === 1 ? one : count >= 2 && count <= 4 ? few : many);

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

export function FloorplanEditor({ series, manufacturers = [], applianceJson = null, company = null }: { series: SeriesOption[]; manufacturers?: { name: string; count: number }[]; applianceJson?: string | null; company?: string | null }) {
  const router = useRouter();
  const svg = useRef<SVGSVGElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Fáze 63: knihovna spotřebičů firmy (prohlížeč / profil firmy) – nákres ji převezme při načtení a při každém uložení
  const [library, saveLibrary] = useApplianceLibrary(applianceJson);
  const [draft, setDraft] = useState<FloorplanDraft>(() => {
    const loaded = loadDraft();
    return library ? { ...loaded, appliances: library.specs } : loaded;
  });
  const [tool, setTool] = useState<Tool>({ kind: "select" });
  /** Fáze 59: vícenásobný výběr (Shift + klik, tažení obdélníku); jeden prvek = detail prvku. */
  const [selection, setSelection] = useState<string[]>([]);
  const selectedId = selection.length === 1 ? selection[0] : null;
  const [drag, setDrag] = useState<{ ids: string[]; start: { x: number; y: number }; origin: Record<string, { x: number; y: number }> } | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  /** Tažení vybrané místnosti: přesun (celá místnost s prvky) nebo změna rozměru za stěnu / roh. */
  const [roomDrag, setRoomDrag] = useState<{ id: string; handle: RoomHandle | "move"; start: { x: number; y: number }; origin: Pick<EditorRoom, "x" | "y" | "w" | "h"> } | null>(null);
  /** Tažený obdélník – nová místnost nebo ořez podkladu. */
  const [roomDraft, setRoomDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number; additive: boolean } | null>(null);
  const [calibration, setCalibration] = useState<{ x: number; y: number }[]>([]);
  const [calibrationDialog, setCalibrationDialog] = useState<{ mode: "calibrate" | "verify"; segmentMm: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<ViewFraction>(FIT);
  const [pan, setPan] = useState<{ clientX: number; clientY: number; view: PlanView } | null>(null);
  const [levelPrompt, setLevelPrompt] = useState<({ level: InstallLevel } & ReturnType<typeof levelConversionPreview>) | null>(null);
  /** Fáze 59: natočení další vkládané značky = natočení předchozí (R při vkládání otočí náhled). */
  const [placeRotation, setPlaceRotation] = useState<number>(0);
  const [hover, setHover] = useState<{ x: number; y: number; shift?: boolean } | null>(null);
  /** Fáze 62: kabeláž v půdorysu – zobrazená / skrytá; při párování vypínačů se světly ve výchozím stavu skrytá. */
  const [showCables, setShowCables] = useState(true);
  const [pairCables, setPairCables] = useState(false);
  /** Fáze 59: zakreslení změn – vzhled nových poznámek, rozkreslená poznámka, výběr a tažení. */
  const [noteStyles, setNoteStyles] = useState<Record<AnnotationKind, NoteStyle>>(DEFAULT_STYLES);
  const [noteDraft, setNoteDraft] = useState<{ mode: AnnotationKind; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDrag, setNoteDrag] = useState<{ id: string; handle: "move" | "a" | "b"; start: { x: number; y: number }; origin: Annotation } | null>(null);
  /** Fáze 63: rozkreslená polygonální místnost, změna rozměru předmětu, ruční úprava trasy a posun rohu místnosti. */
  const [polyDraft, setPolyDraft] = useState<{ x: number; y: number }[]>([]);
  const [fixtureDrag, setFixtureDrag] = useState<{ id: string; handle: FixtureHandle } | null>(null);
  const [routeDrag, setRouteDrag] = useState<{ key: string; index: number; base: { x: number; y: number }[]; start: { x: number; y: number }; points: { x: number; y: number }[]; moved: boolean } | null>(null);
  const [vertexDrag, setVertexDrag] = useState<{ roomId: string; index: number } | null>(null);
  const [applianceOpen, setApplianceOpen] = useState(false);
  /** Fáze 63: dvojklik na úsek trasy = dva stisky na stejném úseku do 400 ms (plátno při stisku přebírá ukazatel). */
  const lastRouteTap = useRef<{ key: string; index: number; at: number } | null>(null);
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

  // Výpočet tras a okruhů na odloženém nákresu – tažení značky zůstane plynulé i u velkého domu
  const deferred = useDeferredValue(draft);
  const analysis = useMemo(() => {
    try {
      return { ok: true as const, ...analyzeDraft(deferred) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Neplatný půdorys." };
    }
  }, [deferred]);
  const bom = useMemo(() => compileFloorplanBom(deferred, { installation: deferred.installation, cables: analysis.ok ? analysis.summary.byCable : [] }), [deferred, analysis]);
  // Fáze 61: chytrá domácnost (sběrnicová úroveň) a normový hlídač
  const smartPlan = useMemo(() => smartPlanOf(deferred), [deferred]);
  const norms = useMemo(() => floorplanNorms(deferred), [deferred]);
  // Fáze 63: trasy k vykreslení (odsazení podél stěn, ruční úpravy, štítky okruhů) a knihovna spotřebičů palety
  const routes = useMemo(() => (analysis.ok ? displayRoutes(deferred, analysis) : null), [analysis, deferred]);
  const catalog = useMemo(() => applianceCatalog(draft.appliances), [draft.appliances]);
  const checklist = generationChecklist(draft);

  const floors = floorsOf(draft);
  const panelFloorId = floors.find((floor) => floor.elements.some((element) => element.item === "panel"))?.id ?? null;
  const selected = draft.elements.find((element) => element.id === selectedId) ?? null;
  const selectedRoom = draft.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedNote = draft.annotations.find((note) => note.id === selectedNoteId) ?? null;
  const available = useMemo(() => new Map(series.map((option) => [option.key, option.count ?? 1])), [series]);
  const inventory = useMemo(() => wiringInventory(draft), [draft]);
  const palette = paletteFor(draft.installation);
  const selectionFrame = selection.length >= 2 ? createFrame(draft, selection) : null;
  const pairing = tool.kind === "pair" || tool.kind === "pair-light";
  const cablesShown = pairing ? pairCables : showCables;
  const toggleCables = () => (pairing ? setPairCables((value) => !value) : setShowCables((value) => !value));
  /** Fáze 63: zobrazovaná položka – spotřebič z knihovny (název, zkratka), výrobek z lišty výrobců (popis, bezdrátově). */
  const displayItem = (element: Pick<EditorElement, "item" | "appliance" | "product">) => {
    const item = paletteItem(element.item);
    if (!item) return null;
    if (item.kind === "appliance") {
      const spec = applianceSpecFor(draft.appliances, element);
      return spec ? { ...item, label: spec.label, symbol: spec.symbol } : item;
    }
    const product = productById(element.product);
    return product ? { ...item, label: product.label, ...(product.noBus ? { wireless: true } : {}) } : item;
  };
  /** Úseky tras jdou táhnout ve výběru (vybraná místnost / poznámka má přednost – úchyty stěn). */
  const routesEditable = tool.kind === "select" && !selectedRoomId && !selectedNoteId;

  function toPlan(event: { clientX: number; clientY: number }) {
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function clearSelection() {
    setSelection([]);
    setSelectedRoomId(null);
    setSelectedNoteId(null);
  }

  /** Otočení vybraných značek (rámeček jako celek); natočení se pamatuje pro další vkládanou značku. */
  function rotateSelection(ids: readonly string[] = selection, step = 90) {
    if (!ids.length) return;
    const first = draft.elements.find((element) => element.id === ids[0]);
    if (first) setPlaceRotation(turnBy(first.rotation, step));
    update((current) => {
      // Rámeček se otáčí po 90°, samostatné prvky (předměty po 45°) o zvolený krok
      const frames = new Set(ids.map((id) => frameOf(current, id)?.id).filter((id): id is string => Boolean(id)));
      let next = current;
      for (const frameId of frames) next = rotateFrame(next, frameId);
      const loose = new Set(ids.filter((id) => !frameOf(current, id)));
      return { ...next, elements: next.elements.map((element) => (loose.has(element.id) ? { ...element, rotation: turnBy(element.rotation, step) } : element)) };
    });
  }

  function removeSelection(ids: readonly string[] = selection) {
    update((current) => removeElements(current, ids));
    setSelection([]);
  }

  /** Fáze 62: přístroj vedle vybraného do společného víceramečku (▦+ v liště značky, „Přidat do rámečku“ v detailu). */
  function addIntoFrame(elementId: string, itemId: string) {
    const id = newId("e");
    const result = addToFrame(draft, elementId, itemId, id);
    if (!result.ok) return void toast.error(result.error);
    update((current) => {
      const next = addToFrame(current, elementId, itemId, id);
      return next.ok ? next.draft : current;
    });
  }

  /** Obsazené pozice rámečku prvku (bez rámečku pozice prvku samotného). */
  const usedGangs = (element: EditorElement) => {
    const frame = frameOf(draft, element.id);
    return frame ? frameGangs(draft, frame) : gangsOf(element);
  };

  function zoomBy(factor: number, focus?: { x: number; y: number }) {
    setViewMm(zoomView(viewMm, draft, factor, focus));
  }

  /** Kam a jak se vloží značka v místě kurzoru: u stěny místnosti přicvaknutí a natočení ke stěně, jinak natočení předchozí. */
  function placement(item: NonNullable<ReturnType<typeof paletteItem>>, point: { x: number; y: number }) {
    const room = roomAt(draft.rooms, point.x, point.y);
    const base = { x: snap(point.x), y: snap(point.y) };
    if (item.kind === "fixture") return { position: base, rotation: placeRotation, room };
    if (isWallMounted(item) && room) {
      const position = snapToWall(room, base.x, base.y);
      if (position.x !== base.x || position.y !== base.y) return { position, rotation: wallRotation(room, point.x, point.y), room };
    }
    return { position: base, rotation: item.kind === "panel" ? (0 as Rotation) : placeRotation, room };
  }

  // Esc = zpět na výběr, Delete = smazat, R = otočit (i náhled vkládané značky), šipky = posun, + / − / 0 = zoom, [ ] = otočit podklad
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (calibrationDialog || levelPrompt) return;
      if (event.key === "Escape") {
        // Fáze 62: Esc ukončí probíhající krok, ve výběru ukončí úpravu (zruší výběr) – jako „Hotovo“ nad půdorysem
        if (tool.kind === "select") clearSelection();
        setTool({ kind: "select" });
        setCalibration([]);
        setRoomDraft(null);
        setNoteDraft(null);
        setMarquee(null);
        setPolyDraft([]);
        return;
      }
      if (event.key === "k" || event.key === "K") return toggleCables();
      // Fáze 63: polygonální místnost – Enter uzavře obrys, Backspace vrátí poslední roh
      if (tool.kind === "polygon" && event.key === "Enter") return finishPolygon();
      if (tool.kind === "polygon" && event.key === "Backspace" && polyDraft.length) {
        event.preventDefault();
        return setPolyDraft((points) => points.slice(0, -1));
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection.length) {
        removeSelection();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteId) {
        update((current) => removeAnnotation(current, selectedNoteId));
        setSelectedNoteId(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedRoomId) {
        update((current) => deleteRoom(current, selectedRoomId));
        setSelectedRoomId(null);
      } else if (event.key === "r" || event.key === "R") {
        // Fáze 63: Shift + R = otočení o 45° (zařizovací předměty, šikmé stěny)
        const step = event.shiftKey ? 45 : 90;
        if (selection.length) rotateSelection(selection, step);
        else if (tool.kind === "place" || tool.kind === "place-set") setPlaceRotation((rotation) => turnBy(rotation, step));
      } else if (event.key.startsWith("Arrow") && selection.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : SNAP_MM;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const ids = [...new Set(selection.flatMap((id) => dragGroupOf(draft, id)))];
        update((current) => translateElements(current, ids, dx, dy));
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
      const target = placement(item, point);
      const single = item.kind === "panel" || item.kind === "riser";
      const element: EditorElement = {
        id: newId(item.kind === "panel" ? "rh" : item.kind === "riser" ? "st" : "e"),
        item: item.id,
        x: Math.round(target.position.x),
        y: Math.round(target.position.y),
        room: target.room?.name ?? lastRoom.current,
        mountHeightMm: null,
        frameUnits: 1,
        series: single ? null : draft.series,
        color: single ? null : draft.color,
        controls: [],
        rotation: target.rotation,
        scale: null,
        // Fáze 63: vlastní spotřebič z knihovny a výrobek z lišty výrobců
        ...(tool.appliance ? { appliance: tool.appliance } : {}),
        ...(tool.product ? { product: tool.product } : {}),
      };
      if (!single) setPlaceRotation(target.rotation);
      update((current) => {
        // Rozváděč je v domě jen jeden (i přes podlaží), stoupací vedení jedno na podlaží
        if (item.kind === "panel") return { ...current, elements: [...current.elements.filter((other) => other.item !== "panel"), element], otherFloors: current.otherFloors.map((floor) => ({ ...floor, elements: floor.elements.filter((other) => other.item !== "panel") })) };
        if (item.kind === "riser") return { ...current, elements: [...current.elements.filter((other) => other.item !== "riser"), element] };
        return { ...current, elements: [...current.elements, element] };
      });
      setSelection([element.id]);
      setSelectedNoteId(null);
      if (single) setTool({ kind: "select" });
      return;
    }
    if (tool.kind === "place-set") {
      // Fáze 62: celá sestava jedním klikem – u stěny přicvaknutá a natočená ke stěně, střed sestavy v místě kliknutí
      const first = paletteItem(tool.members[0]);
      if (!first) return;
      const target = placement(first, point);
      const at = { x: Math.round(target.position.x), y: Math.round(target.position.y), rotation: target.rotation, room: target.room?.name ?? lastRoom.current, series: draft.series, color: draft.color };
      const ids = tool.members.map(() => newId("e"));
      const result = placeAssembly(draft, tool.members, at, ids);
      if (!result.ok) return void toast.error(result.error);
      setPlaceRotation(target.rotation);
      update((current) => {
        const next = placeAssembly(current, tool.members, at, ids);
        return next.ok ? next.draft : current;
      });
      setSelection([ids[0]]);
      setSelectedRoomId(null);
      setSelectedNoteId(null);
      return;
    }
    if (tool.kind === "annotate") {
      const at = { x: snap(point.x), y: snap(point.y) };
      if (tool.mode === "text") {
        // Text je ve výchozím stavu tmavý na bílém podkladu – čitelný nad výkresem i nad tmavým rastrem
        const note = { ...newAnnotation("text", at), ...noteStyles.text };
        update((current) => ({ ...current, annotations: [...current.annotations, note] }));
        setSelection([]);
        setSelectedNoteId(note.id);
        setTool({ kind: "select" });
        return;
      }
      capture(svg.current, event.pointerId);
      setNoteDraft({ mode: tool.mode, from: at, to: at });
      return;
    }
    if (tool.kind === "polygon") {
      // Fáze 63: roh polygonální místnosti – první na rastr 5 cm, další s přichycením úhlu 0° / 45° / 90° (Shift = volně)
      const first = polyDraft[0];
      if (first && polyDraft.length >= 3 && Math.hypot(point.x - first.x, point.y - first.y) <= ui * 0.8) return finishPolygon();
      const last = polyDraft[polyDraft.length - 1];
      const corner = !last ? { x: snap(point.x), y: snap(point.y) } : event.shiftKey ? { x: Math.round(point.x), y: Math.round(point.y) } : snapAngle(last, point, 45);
      if (last && Math.hypot(corner.x - last.x, corner.y - last.y) < 100) return;
      setPolyDraft([...polyDraft, corner]);
      setSelectedRoomId(null);
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
    if (tool.kind === "pair" || tool.kind === "pair-light") return;
    // Výběr: přiblížený výkres posouvá tažením (Shift = výběr obdélníkem), jinak výběr obdélníkem
    if (zoomed && !event.shiftKey) {
      clearSelection();
      return startPan(event);
    }
    if (!event.shiftKey) clearSelection();
    capture(svg.current, event.pointerId);
    setMarquee({ x: point.x, y: point.y, w: 0, h: 0, additive: event.shiftKey });
  }

  /** Klik do místnosti v režimu Výběr = výběr místnosti a přesun tažením (prvky uvnitř jdou s ní). */
  function onRoomDown(event: ReactPointerEvent, room: EditorRoom, handle: RoomHandle | "move") {
    if (tool.kind !== "select" || event.button !== 0) return;
    event.stopPropagation();
    if (event.shiftKey && handle === "move") return onCanvasDown(event as unknown as ReactPointerEvent<SVGSVGElement>);
    setSelection([]);
    setSelectedNoteId(null);
    setSelectedRoomId(room.id);
    capture(svg.current, event.pointerId);
    setRoomDrag({ id: room.id, handle, start: toPlan(event), origin: { x: room.x, y: room.y, w: room.w, h: room.h } });
  }

  function onElementDown(event: ReactPointerEvent, element: EditorElement) {
    event.stopPropagation();
    if (event.button === 1) return startPan(event);
    if (event.button !== 0) return;
    const item = paletteItem(element.item);
    if (tool.kind === "pair") {
      if (item?.kind !== "light") return void toast.error("Klikněte na svítidlo, které má vypínač ovládat.");
      update((current) => toggleLink(current, tool.switchId, element.id));
      return;
    }
    if (tool.kind === "pair-light") {
      if (!controlsLights(item)) return void toast.error("Klikněte na vypínač nebo tlačítko, které má světlo ovládat.");
      update((current) => toggleLink(current, element.id, tool.lightId));
      return;
    }
    if (tool.kind === "room" || tool.kind === "polygon" || tool.kind === "crop" || tool.kind === "calibrate" || tool.kind === "verify" || tool.kind === "annotate") return onCanvasDown(event as unknown as ReactPointerEvent<SVGSVGElement>);
    // Shift + klik = přidat / odebrat z výběru
    if (event.shiftKey) {
      setSelectedRoomId(null);
      setSelectedNoteId(null);
      setSelection((current) => (current.includes(element.id) ? current.filter((id) => id !== element.id) : [...current, element.id]));
      return;
    }
    // Fáze 57: i v režimu vkládání klik na osazenou značku ji vybere a dá se přesunout (nevloží se další přes ni);
    // fáze 59: tažení přesune celý rámeček, případně celý vícenásobný výběr
    const ids = selection.length > 1 && selection.includes(element.id) ? [...new Set(selection.flatMap((id) => dragGroupOf(draft, id)))] : dragGroupOf(draft, element.id);
    if (!(selection.length > 1 && selection.includes(element.id))) setSelection([element.id]);
    setSelectedRoomId(null);
    setSelectedNoteId(null);
    capture(svg.current, event.pointerId);
    setDrag({ ids, start: toPlan(event), origin: Object.fromEntries(draft.elements.filter((candidate) => ids.includes(candidate.id)).map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])) });
  }

  function onNoteDown(event: ReactPointerEvent, note: Annotation) {
    if (tool.kind !== "select" || event.button !== 0) return;
    event.stopPropagation();
    setSelection([]);
    setSelectedRoomId(null);
    setSelectedNoteId(note.id);
    capture(svg.current, event.pointerId);
    setNoteDrag({ id: note.id, handle: "move", start: toPlan(event), origin: note });
  }

  function onNoteHandle(event: ReactPointerEvent, note: Annotation, handle: "a" | "b") {
    event.stopPropagation();
    capture(svg.current, event.pointerId);
    setNoteDrag({ id: note.id, handle, start: toPlan(event), origin: note });
  }

  /** Fáze 63: uzavření polygonální místnosti (aspoň 3 rohy, plocha ≥ 0,25 m²). */
  function finishPolygon(points = polyDraft) {
    if (!validPolygon(points)) return void toast.error("Místnost potřebuje aspoň 3 rohy a plochu 0,25 m² – klikejte rohy po obvodu, uzavřete klikem na první roh nebo Enter.");
    const name = uniqueRoomName(draft.rooms, `Místnost ${draft.rooms.length + 1}`);
    lastRoom.current = name;
    const room: EditorRoom = { id: newId("m"), name, ...polygonBounds(points), points };
    setPolyDraft([]);
    setSelectedRoomId(room.id);
    setSelection([]);
    setTool({ kind: "select" });
    update((current) => ({ ...current, rooms: [...current.rooms, room], elements: current.elements.map((element) => (pointInRoom(room, element.x, element.y) ? { ...element, room: name } : element)) }));
    toast.success(`Polygonální místnost ${name} (${points.length} rohů) – kabely vedou podél šikmých stěn v jejich ose.`);
  }

  /** Fáze 63: posun rohu polygonální místnosti. */
  function onVertexDown(event: ReactPointerEvent, room: EditorRoom, index: number) {
    if (event.button !== 0) return;
    event.stopPropagation();
    capture(svg.current, event.pointerId);
    setVertexDrag({ roomId: room.id, index });
  }

  /** Fáze 63: změna rozměru zařizovacího předmětu za stranu / žlutý roh. */
  function onFixtureHandle(event: ReactPointerEvent, element: EditorElement, handle: FixtureHandle) {
    if (event.button !== 0) return;
    event.stopPropagation();
    capture(svg.current, event.pointerId);
    setFixtureDrag({ id: element.id, handle });
  }

  /** Fáze 63: tažení úseku trasy – vodorovný jen v ose Y, svislý jen v ose X, šikmý kolmo ke stěně; dvojklik = odskok. */
  function onRouteDown(event: ReactPointerEvent, _circuit: DisplayCircuit, leg: DisplayLeg, index: number) {
    if (tool.kind !== "select" || event.button !== 0) return;
    event.stopPropagation();
    const now = Date.now();
    const last = lastRouteTap.current;
    if (last && last.key === leg.key && last.index === index && now - last.at < 400) {
      lastRouteTap.current = null;
      return insertRouteJog(leg, index, toPlan(event));
    }
    lastRouteTap.current = { key: leg.key, index, at: now };
    capture(svg.current, event.pointerId);
    setSelection([]);
    setRouteDrag({ key: leg.key, index, base: leg.points, start: toPlan(event), points: leg.points, moved: false });
  }

  /** Fáze 63: ortogonální odskok kolem překážky v místě dvojkliku. */
  function insertRouteJog(leg: DisplayLeg, index: number, at: { x: number; y: number }) {
    update((current) => ({ ...current, routeEdits: { ...current.routeEdits, [leg.key]: insertJog(leg.points, index, at) } }));
    toast.info("Odskok vložen – táhněte prostřední úsek kolem překážky. Pravé tlačítko na trase ji vrátí na automat.");
  }

  /** Fáze 63: „🔄 Resetovat trasu na automat“ – zruší ruční úpravy všech úseků okruhu. */
  function resetRoute(circuit: Pick<DisplayCircuit, "legs" | "label">) {
    const keys = editedKeysOf(circuit);
    if (!keys.length) return void toast.info("Trasa okruhu je automatická – není co vracet.");
    update((current) => ({ ...current, routeEdits: Object.fromEntries(Object.entries(current.routeEdits).filter(([key]) => !keys.includes(key))) }));
    toast.success(`🔄 Trasa ${circuit.label} vrácena na automat.`);
  }

  /** Fáze 63: výrobek z lišty výrobců do půdorysu (systém chytré domácnosti se nastaví podle rodiny výrobku). */
  function placeProduct(product: CatalogProduct) {
    if (!product.item) return;
    const family = PRODUCT_FAMILIES.find((option) => option.id === productById(product.id)?.family);
    if (family?.system && draft.smartSystem !== family.system) {
      const system = family.system;
      update((current) => ({ ...current, smartSystem: system }));
      toast.info(`Systém chytré domácnosti: ${family.label} – akční členy se přepočítají.`);
    }
    setTool({ kind: "place", item: product.item, product: product.id });
    setHover(null);
  }

  /** Fáze 63: uložení knihovny spotřebičů – nákres, prohlížeč i profil firmy; osazený vlastní spotřebič se nesmaže. */
  function saveAppliances(specs: ApplianceSpec[]) {
    const used = new Set(allElements(draft).flatMap((element) => (element.item === CUSTOM_APPLIANCE_ITEM && element.appliance ? [element.appliance] : [])));
    const kept = [...specs, ...draft.appliances.filter((spec) => spec.custom && used.has(spec.id) && !specs.some((other) => other.id === spec.id))];
    const restored = kept.length - specs.length;
    saveLibrary(kept);
    update((current) => ({ ...current, appliances: storedSpecs(kept) }));
    toast.success(`Spotřebiče uloženy v nákresu, v prohlížeči i v profilu firmy.${restored ? ` ${restored}× vlastní spotřebič zůstal, protože je osazený v půdorysu.` : ""}`);
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (pan) {
      const element = svg.current;
      const perPx = pan.view.w / Math.max(1, element?.clientWidth ?? 1);
      setViewMm({ ...pan.view, x: pan.view.x - (event.clientX - pan.clientX) * perPx, y: pan.view.y - (event.clientY - pan.clientY) * perPx });
      return;
    }
    const point = toPlan(event);
    if (tool.kind === "place" || tool.kind === "place-set" || tool.kind === "polygon") setHover({ ...point, shift: event.shiftKey });
    // Fáze 63: změna rozměru předmětu, posun úseku trasy, posun rohu polygonální místnosti
    if (fixtureDrag) {
      setDraft((current) => ({
        ...current,
        elements: current.elements.map((element) => {
          if (element.id !== fixtureDrag.id) return element;
          const next = resizeFixture(element, fixtureDrag.handle, point);
          return next ? { ...element, ...next } : element;
        }),
      }));
      return;
    }
    if (routeDrag) {
      const delta = { x: point.x - routeDrag.start.x, y: point.y - routeDrag.start.y };
      setRouteDrag({ ...routeDrag, points: dragSegment(routeDrag.base, routeDrag.index, delta, { snap: SNAP_MM }), moved: segmentShift(routeDrag.base, routeDrag.index, delta, SNAP_MM) !== null });
      return;
    }
    if (vertexDrag) {
      const at = { x: snap(point.x), y: snap(point.y) };
      setDraft((current) => ({
        ...current,
        rooms: current.rooms.map((room) => {
          if (room.id !== vertexDrag.roomId || !room.points) return room;
          const points = room.points.map((corner, index) => (index === vertexDrag.index ? at : corner));
          return { ...room, points, ...polygonBounds(points) };
        }),
      }));
      return;
    }
    if (!drag && !roomDraft && !roomDrag && !marquee && !noteDraft && !noteDrag) return;
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
      const dx = snap(point.x - drag.start.x);
      const dy = snap(point.y - drag.start.y);
      setDraft((current) => ({ ...current, elements: current.elements.map((element) => (drag.origin[element.id] ? { ...element, x: drag.origin[element.id].x + dx, y: drag.origin[element.id].y + dy } : element)) }));
    }
    if (roomDraft) {
      const crop = tool.kind === "crop";
      setRoomDraft({ ...roomDraft, w: (crop ? point.x : snap(point.x)) - roomDraft.x, h: (crop ? point.y : snap(point.y)) - roomDraft.y });
    }
    if (marquee) setMarquee({ ...marquee, w: point.x - marquee.x, h: point.y - marquee.y });
    if (noteDraft) {
      const to = { x: snap(point.x), y: snap(point.y) };
      setNoteDraft({ ...noteDraft, to: noteDraft.mode === "zone" || event.shiftKey ? to : orthogonal(noteDraft.from, to) });
    }
    if (noteDrag) {
      const dx = snap(point.x - noteDrag.start.x);
      const dy = snap(point.y - noteDrag.start.y);
      const origin = noteDrag.origin;
      setDraft((current) => {
        if (noteDrag.handle === "move") return moveAnnotation({ ...current, annotations: current.annotations.map((note) => (note.id === origin.id ? origin : note)) }, origin.id, dx, dy);
        const raw = noteDrag.handle === "a" ? { x: origin.x + dx, y: origin.y + dy } : { x: origin.x2 + dx, y: origin.y2 + dy };
        const anchor = noteDrag.handle === "a" ? { x: origin.x2, y: origin.y2 } : { x: origin.x, y: origin.y };
        const end = origin.kind === "zone" || event.shiftKey ? raw : orthogonal(anchor, raw);
        return updateAnnotation(current, origin.id, noteDrag.handle === "a" ? { x: end.x, y: end.y } : { x2: end.x, y2: end.y });
      });
    }
  }

  function onUp() {
    if (pan) return void setPan(null);
    if (fixtureDrag) {
      update((current) => current);
      setFixtureDrag(null);
      return;
    }
    if (routeDrag) {
      const { key, points, moved } = routeDrag;
      setRouteDrag(null);
      if (moved) update((current) => ({ ...current, routeEdits: { ...current.routeEdits, [key]: cleanPolyline(points) } }));
      return;
    }
    if (vertexDrag) {
      const { roomId } = vertexDrag;
      setVertexDrag(null);
      update((current) => {
        const room = current.rooms.find((candidate) => candidate.id === roomId);
        return room ? { ...current, elements: current.elements.map((element) => (pointInRoom(room, element.x, element.y) ? { ...element, room: room.name } : element)) } : current;
      });
      return;
    }
    if (roomDrag) {
      // Po změně rozměru patří do místnosti prvky, které v ní nově leží
      update((current) => {
        const room = current.rooms.find((candidate) => candidate.id === roomDrag.id);
        if (!room || roomDrag.handle === "move") return current;
        return { ...current, elements: current.elements.map((element) => (pointInRoom(room, element.x, element.y) ? { ...element, room: room.name } : element)) };
      });
      setRoomDrag(null);
      return;
    }
    if (drag) {
      const ids = drag.ids;
      update((current) => {
        const frame = frameOf(current, ids[0]);
        // Celý rámeček: kotva se přicvakne ke stěně a natočí, ostatní přístroje se k ní znovu přisadí
        if (frame && ids.length === frame.members.length && frame.members.every((id) => ids.includes(id))) {
          const anchor = current.elements.find((element) => element.id === frame.members[0]);
          const room = anchor ? roomAt(current.rooms, anchor.x, anchor.y) : null;
          if (!anchor || !room) return current;
          const position = snapToWall(room, anchor.x, anchor.y);
          const atWall = position.x !== anchor.x || position.y !== anchor.y;
          const rotation = atWall ? wallRotation(room, anchor.x, anchor.y) : anchor.rotation;
          const moved = { ...current, elements: current.elements.map((element) => (frame.members.includes(element.id) ? { ...element, room: room.name, rotation, ...(element.id === anchor.id ? { x: Math.round(position.x), y: Math.round(position.y) } : {}) } : element)) };
          return layoutFrame(moved, frame.id);
        }
        // Přetažením do jiné místnosti se změní i místnost prvku; samostatná zásuvka u stěny se k ní přicvakne a natočí
        return {
          ...current,
          elements: current.elements.map((element) => {
            if (!ids.includes(element.id)) return element;
            const room = roomAt(current.rooms, element.x, element.y);
            if (!room) return element;
            if (ids.length > 1 || !isWallMounted(paletteItem(element.item))) return { ...element, room: room.name };
            const position = snapToWall(room, element.x, element.y);
            const atWall = position.x !== element.x || position.y !== element.y;
            return { ...element, room: room.name, x: Math.round(position.x), y: Math.round(position.y), rotation: atWall ? wallRotation(room, element.x, element.y) : element.rotation };
          }),
        };
      });
      setDrag(null);
    }
    if (marquee) {
      const rect = { x: Math.min(marquee.x, marquee.x + marquee.w), y: Math.min(marquee.y, marquee.y + marquee.h), w: Math.abs(marquee.w), h: Math.abs(marquee.h) };
      setMarquee(null);
      if (rect.w > ui * 0.4 || rect.h > ui * 0.4) {
        const inside = draft.elements.filter((element) => element.x >= rect.x && element.x <= rect.x + rect.w && element.y >= rect.y && element.y <= rect.y + rect.h).map((element) => element.id);
        setSelection((current) => (marquee.additive ? [...new Set([...current, ...inside])] : inside));
        setSelectedRoomId(null);
        setSelectedNoteId(null);
      }
    }
    if (noteDraft) {
      const from = noteDraft.from;
      const to = noteDraft.to;
      setNoteDraft(null);
      const big = noteDraft.mode === "zone" ? Math.abs(to.x - from.x) >= 200 && Math.abs(to.y - from.y) >= 200 : Math.hypot(to.x - from.x, to.y - from.y) >= 200;
      if (big) {
        const note = { ...newAnnotation(noteDraft.mode, from, to), ...noteStyles[noteDraft.mode] };
        update((current) => ({ ...current, annotations: [...current.annotations, note] }));
        setSelectedNoteId(note.id);
        setSelection([]);
      }
    }
    if (noteDrag) setNoteDrag(null);
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
      setSelection([]);
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
    if ((impact.elements || impact.rooms || impact.annotations) && !window.confirm(`Mimo ořez leží ${impact.elements} značek, ${impact.rooms} místností a ${impact.annotations} zakreslených změn – budou odstraněny. Oříznout?`)) return;
    update((current) => cropDraft(current, rect));
    setView(FIT);
    setTool({ kind: "select" });
    clearSelection();
    toast.success(`Podklad oříznut na ${roomDimensions(rect.w, rect.h).label}. Měřítko zůstává.`);
  }

  function pdfAction(action: PdfEditAction) {
    if (action === "zoom-in") return zoomBy(ZOOM_STEP);
    if (action === "zoom-out") return zoomBy(1 / ZOOM_STEP);
    if (action === "zoom-fit") return setView(FIT);
    if (action.startsWith("draw-")) {
      const mode = action.slice(5) as AnnotationKind;
      clearSelection();
      setTool({ kind: "annotate", mode });
      return void toast.info(mode === "text" ? "Klikněte do půdorysu, kam se má vložit text." : `${ANNOTATION_LABEL[mode]}: táhněte myší (Shift = libovolný úhel). Barvu a šrafu zvolíte v liště nad výkresem.`);
    }
    if (!draft.background) return;
    if (action === "rotate-cw" || action === "rotate-ccw") {
      update((current) => rotateDraft(current, action === "rotate-cw" ? 1 : -1));
      setView(FIT);
      return void toast.success(`Podklad otočen o 90° ${action === "rotate-cw" ? "doprava" : "doleva"} i se značkami, místnostmi a zakreslenými změnami.`);
    }
    if (action === "crop") {
      clearSelection();
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
      toast.info(`${pages > 1 ? `PDF má ${pages} stran – použita 1. strana. ` : ""}Podklad podlaží ${draft.floorName} nahrán. Teď klikněte na začátek a konec známé stěny nebo kóty (📏 kalibrace).`);
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
    if (tool.kind === "place-set" && !tool.members.every((id) => paletteFor(level).some((item) => item.id === id))) setTool({ kind: "select" });
    const label = INSTALL_LEVELS.find((option) => option.id === level)?.label ?? level;
    const converted = result.changes.reduce((sum, row) => sum + row.count, 0);
    toast.success(`${label}${converted ? ` – převedeno ${converted} ovladačů` : ""}${result.removed ? `, odstraněno ${result.removed}` : ""}. Paleta ovládání se změnila.`);
  }

  function selectFloor(id: string) {
    update((current) => switchFloor(current, id));
    clearSelection();
    setView(FIT);
    setCalibration([]);
    if (tool.kind !== "pair" && tool.kind !== "pair-light") setTool({ kind: "select" });
  }

  function makeFrame() {
    const result = createFrame(draft, selection);
    if (!result.ok) return void toast.error(result.error);
    update(() => result.draft);
    setSelection([result.draft.frames.find((frame) => frame.id === result.frameId)!.members[0]]);
    toast.success(`Víceramček ${result.gangs}R vytvořen – přístroje přisazeny vedle sebe.`);
  }

  function autoPair() {
    const result = autoPairLights(draft);
    if (!result.paired) return void toast.error(result.skipped.length ? `V místnostech ${result.skipped.join(", ")} není žádný vypínač – vložte ho a spárujte.` : "Všechna světla už mají ovládání.");
    update(() => result.draft);
    toast.success(`Přiřazeno ${result.paired} světel k nejbližšímu vypínači v místnosti.${result.skipped.length ? ` Bez vypínače: ${result.skipped.join(", ")}.` : ""}`);
  }

  function generate(form: FormData) {
    if (!checklist.ready) return void toast.error(checklist.items.find((item) => !item.ok)?.label ?? "Doplňte kontrolní seznam.");
    startTransition(async () => {
      const result = await createFloorplanProjectAction({
        name: String(form.get("name") ?? ""),
        customerName: String(form.get("customer") ?? "") || null,
        installationSite: String(form.get("site") ?? "") || null,
        draft,
        manufacturer: String(form.get("manufacturer") ?? "") || null,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Rozváděč vygenerován: ${result.data.circuits} okruhů, ${result.data.devices} přístrojů${result.data.manufacturer ? ` ${result.data.manufacturer}` : ""}${result.data.enclosure ? `, skříň ${result.data.enclosure}` : ""}. Strom zapojení je sestavený podle hierarchie.`);
      for (const warning of result.data.warnings.slice(0, 3)) toast.warning(warning);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  // Kontrola půdorysu (fáze 59): ovládání světel a stoupací vedení
  const lightsWithout = unpairedLights(draft);
  const idle = idleSwitches(draft);
  const checks: PlanCheck[] = [];
  if (lightsWithout.length) {
    const rooms = [...new Set(lightsWithout.map((light) => light.room))];
    checks.push({ id: "lights-unpaired", level: "warning", text: `${lightsWithout.length}× svítidlo bez vypínače (${rooms.slice(0, 4).join(", ")}${rooms.length > 4 ? " …" : ""}).`, action: { label: "✨ Přiřadit automaticky", onClick: autoPair } });
  }
  if (idle.length) checks.push({ id: "switch-idle", level: "info", text: `${idle.length}× vypínač bez přiřazeného svítidla – vyberte ho a klikněte na 🔗.`, action: { label: "Zobrazit", onClick: () => (draft.elements.some((element) => element.id === idle[0].id) ? setSelection([idle[0].id]) : toast.info(`Vypínač je na jiném podlaží (${floors.find((floor) => floor.elements.some((element) => element.id === idle[0].id))?.name}).`)) } });
  if (floors.length > 1) {
    const missing = floors.filter((floor) => floor.elements.some((element) => element.item !== "riser") && !floor.elements.some((element) => element.item === "riser" || element.item === "panel"));
    if (missing.length) checks.push({ id: "riser-missing", level: "info", text: `Podlaží ${missing.map((floor) => floor.name).join(", ")} nemá stoupací vedení ↕ – trasy vedou svisle nad / pod rozváděčem.` });
  }
  // Fáze 61: normový hlídač (koupelnové zóny, krytí, AFDD) s opravou jedním klikem
  for (const issue of norms) {
    const here = issue.elementIds.find((id) => draft.elements.some((element) => element.id === id));
    checks.push({
      id: issue.id,
      level: issue.level,
      text: issue.text,
      source: issue.source,
      action: issue.fix
        ? { label: issue.fix.label, onClick: () => (update((current) => applyNormFix(current, issue)), toast.success(`Opraveno: ${issue.fix!.label}.`)) }
        : here
          ? { label: "Zobrazit", onClick: () => setSelection(issue.elementIds.filter((id) => draft.elements.some((element) => element.id === id))) }
          : undefined,
    });
  }

  const riserHere = analysis.ok ? analysis.build.floors.find((floor) => floor.id === draft.floorId) : null;
  const ghostItem = tool.kind === "place" ? paletteItem(tool.item) : null;
  const ghost = ghostItem && hover ? placement(ghostItem, hover) : null;
  // Fáze 62: náhled celé sestavy u kurzoru (přístroje i obrys rámečku)
  const setGhost = (() => {
    if (tool.kind !== "place-set" || !hover) return null;
    const first = paletteItem(tool.members[0]);
    if (!first) return null;
    const target = placement(first, hover);
    const members = assemblyLayout(draft, tool.members, { x: target.position.x, y: target.position.y, rotation: target.rotation }).map(
      (slot, index): EditorElement => ({ id: `ghost-${index}`, item: slot.item, x: slot.x, y: slot.y, room: "", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: target.rotation, scale: null }),
    );
    return { rotation: target.rotation, members, outline: frameOutline({ ...draft, elements: members }, { id: "ghost", members: members.map((member) => member.id) }) };
  })();
  const setGangs = tool.kind === "place-set" ? assemblyGangs(tool.members) : 0;
  const pairCablesHint = cablesShown ? " Kabeláž skryjete klávesou K." : " Kabeláž je při párování skrytá (K = zobrazit).";
  const toolLabel = tool.kind === "place" ? (displayItem({ item: tool.item, appliance: tool.appliance, product: tool.product })?.label ?? "") : "";

  const hint =
    tool.kind === "place"
      ? `Klikněte do půdorysu – ${toolLabel} (natočení ${placeRotation}°, R = otočit, Shift + R = 45°). Klik na osazenou značku ji vybere a přesune. Esc / pravé tlačítko = konec.`
      : tool.kind === "place-set"
        ? `Klikněte do půdorysu – celá sestava se vloží přisazená v jednom rámečku ${setGangs}R; u stěny se přicvakne a natočí ke stěně (jinak natočení ${placeRotation}°, R = otočit). Esc / pravé tlačítko = konec.`
      : tool.kind === "room"
        ? "Tažením myší nakreslete obdélník místnosti – rozměry X × Y se zobrazují živě."
        : tool.kind === "polygon"
          ? `📐 Klikejte rohy místnosti po obvodu (${polyDraft.length} ${plural(polyDraft.length, "roh", "rohy", "rohů")}) – úhel se přichytává na 0° / 45° / 90°, Shift = volný úhel podle podkladu. Uzavřete klikem na první roh nebo Enter, Backspace = zpět.`
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
                ? `Klikněte na svítidla, která má vypínač ovládat (znovu = odpojit; i na jiném podlaží). Esc = hotovo.${pairCablesHint}`
                : tool.kind === "pair-light"
                  ? `Klikněte na vypínače / tlačítka, která mají světlo ovládat (znovu = odpojit). Esc = hotovo.${pairCablesHint}`
                  : tool.kind === "annotate"
                    ? tool.mode === "text"
                      ? "T Klikněte do půdorysu, kam se má vložit textové pole."
                      : `✏️ ${ANNOTATION_LABEL[tool.mode]}: táhněte myší${tool.mode === "zone" ? " obdélník" : " (Shift = libovolný úhel)"}. Esc = konec kreslení.`
                    : selectedRoom
                      ? "Místnost: tažením za vnitřek přesun (i s prvky), za stěnu nebo žlutý roh změna rozměru, Delete = smazat."
                      : selection.length > 1
                        ? "Vybráno víc prvků: tažením přesun všech, R = otočit, Delete = smazat, vpravo „Vložit do víceramečku“."
                        : selected
                          ? paletteItem(selected.item)?.kind === "fixture"
                            ? "Předmět: tažením přesun, za strany nebo žlutý roh změna rozměru X × Y (zóny se přepočítají), R = 90°, Shift + R = 45°, přesný rozměr v detailu vpravo."
                            : "Značka: tažením přesun (rámeček celý), R = otočit (další vkládaná značka převezme natočení), šipky = posun po 5 cm, Shift + klik = přidat do výběru."
                          : `Výběr: klik = detail, Shift + klik nebo tažení obdélníku = víc prvků, Delete = smazat. Trasy: táhněte úsek (↕ jen v ose Y, ↔ jen v ose X), dvojklik = odskok, pravé tlačítko = zpět na automat. Ctrl + kolečko = zoom${zoomed ? ", tažením prázdným místem posun (Shift = výběr)" : ""}.`;

  // Fáze 62: lišta probíhajícího kroku nad půdorysem – co právě dělám, ovládání kroku a „Hotovo“ vždy na stejném místě
  const pairWith = tool.kind === "pair" ? draft.elements.find((element) => element.id === tool.switchId) : tool.kind === "pair-light" ? draft.elements.find((element) => element.id === tool.lightId) : null;
  const elementName = (element: EditorElement | null | undefined) => (element ? `${displayItem(element)?.label ?? element.item} – ${element.room}` : "");
  const endStep = () => {
    // Konec vkládání = konec i úprav naposledy vloženého prvku (jinak by zůstal vybraný)
    if (tool.kind === "place" || tool.kind === "place-set") clearSelection();
    setTool({ kind: "select" });
    setCalibration([]);
    setRoomDraft(null);
    setNoteDraft(null);
    setPolyDraft([]);
  };
  const rotateNext = (
    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setPlaceRotation((rotation) => turn(rotation))} title="Natočení další vkládané značky (R)" data-testid="mode-rotate">
      <RotateCw className="size-3.5" aria-hidden /> {placeRotation}°
    </Button>
  );
  const pairCount = tool.kind === "pair" ? (pairWith?.controls.length ?? 0) : tool.kind === "pair-light" ? controllersOf(draft, tool.lightId) : 0;
  const step: { tone: ModeTone; title: string; onDone?: () => void; doneLabel?: string; extra?: ReactNode } = pairing
    ? {
        tone: "pair",
        title: `🔗 Párování: ${elementName(pairWith)}`,
        onDone: endStep,
        extra: (
          <>
            <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-xs text-emerald-200" data-testid="pair-count">
              {tool.kind === "pair" ? `ovládá ${pairCount} ${plural(pairCount, "svítidlo", "svítidla", "svítidel")}` : `${pairCount} ${plural(pairCount, "ovládací místo", "ovládací místa", "ovládacích míst")}`}
            </span>
            {/* Přepínač kabeláže i v lepkavé liště – přepínač v rohu plátna po posunu stránky není vidět */}
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={toggleCables} title="Kabeláž v půdorysu (K)" data-testid="mode-toggle-cables">
              {cablesShown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />} {cablesShown ? "Skrýt kabeláž" : "Zobrazit kabeláž"}
            </Button>
          </>
        ),
      }
    : tool.kind === "annotate"
      ? {
          tone: "annotate",
          title: `✏️ Zakreslení změny: ${ANNOTATION_LABEL[tool.mode]}`,
          onDone: endStep,
          extra: (
            <div className="flex flex-wrap items-center gap-2" data-testid="annotate-bar">
              <NoteStyleControls compact kind={tool.mode} style={noteStyles[tool.mode]} onChange={(patch) => setNoteStyles((current) => ({ ...current, [tool.mode]: { ...current[tool.mode], ...patch } }))} />
            </div>
          ),
        }
      : tool.kind === "place"
        ? { tone: "place", title: `➕ Vkládání: ${toolLabel}`, onDone: endStep, extra: rotateNext }
        : tool.kind === "place-set"
          ? { tone: "place", title: `▦ Vkládání sestavy: ${tool.label} (${setGangs}R)`, onDone: endStep, extra: rotateNext }
          : tool.kind === "room"
            ? { tone: "draw", title: "▭ Kreslení místností", onDone: endStep }
            : tool.kind === "polygon"
              ? { tone: "draw", title: "📐 Polygonální místnost / šikmé stěny", onDone: () => (polyDraft.length >= 3 ? finishPolygon() : endStep()), doneLabel: polyDraft.length >= 3 ? "Uzavřít místnost" : "Hotovo" }
            : tool.kind === "crop"
              ? { tone: "measure", title: "✂ Ořez podkladu", onDone: endStep, doneLabel: "Zrušit" }
              : tool.kind === "calibrate" || tool.kind === "verify"
                ? { tone: "measure", title: tool.kind === "calibrate" ? "📏 Kalibrace měřítka" : "✅ Ověření měřítka", onDone: endStep, doneLabel: "Zrušit" }
                : selectedRoom
                  ? { tone: "edit", title: `✏️ Úprava místnosti ${selectedRoom.name}`, onDone: clearSelection }
                  : selectedNote
                    ? { tone: "edit", title: `✏️ Úprava: ${ANNOTATION_LABEL[selectedNote.kind]}`, onDone: clearSelection }
                    : selection.length > 1
                      ? { tone: "edit", title: `✏️ Vybráno ${selection.length} ${plural(selection.length, "prvek", "prvky", "prvků")}`, onDone: clearSelection }
                      : selected
                        ? { tone: "edit", title: `✏️ Úprava: ${elementName(selected)}`, onDone: clearSelection }
                        : { tone: "idle", title: "Výběr a úpravy" };

  // Fáze 63: paleta jako akordeon – počty osazených prvků kategorie na aktivním podlaží, spotřebiče z knihovny
  const groupCounts = new Map<string, number>();
  for (const element of draft.elements) {
    const group = paletteItem(element.item)?.group;
    if (group) groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }
  const paletteSections: PaletteSection[] = PALETTE_GROUPS.map((group): PaletteSection => {
    if (group.id === "appliances") {
      return {
        id: group.id,
        label: group.label,
        count: groupCounts.get(group.id) ?? 0,
        action: (
          <button type="button" onClick={() => setApplianceOpen(true)} className="shrink-0 rounded-md border border-orange-500/50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-200 hover:bg-orange-500/10" data-testid="appliance-edit">
            ✎ Upravit / + Přidat
          </button>
        ),
        entries: catalog.map((spec) => {
          const itemId = spec.custom ? CUSTOM_APPLIANCE_ITEM : spec.id;
          const active = tool.kind === "place" && tool.item === itemId && (tool.appliance ?? null) === (spec.custom ? spec.id : null);
          return {
            id: spec.id,
            label: spec.label,
            symbol: spec.symbol,
            title: `${spec.label} – ${spec.powerW.toLocaleString("cs-CZ")} W · ${protectionLabel(spec)}`,
            active,
            onPick: () => {
              setTool(active ? { kind: "select" } : { kind: "place", item: itemId, ...(spec.custom ? { appliance: spec.id } : {}) });
              setHover(null);
            },
          };
        }),
      };
    }
    return {
      id: group.id,
      label: group.id === "controls" ? CONTROLS_LABEL[draft.installation] : group.label,
      count: groupCounts.get(group.id) ?? 0,
      entries: palette
        .filter((item) => item.group === group.id)
        .map((item) => {
          const active = tool.kind === "place" && tool.item === item.id && !tool.product;
          // Fáze 61: zařizovací předmět nemá výšku montáže – v titulku jen rozměr
          const height = item.kind === "fixture" ? null : item.kind === "panel" || item.kind === "riser" ? draft.profile.switchboardHeightMm : (item.heightMm ?? mountHeight({ kind: item.kind, variant: item.variant, tag: item.tag }, draft.profile));
          return {
            id: item.id,
            label: item.label,
            symbol: item.symbol,
            title: height === null ? item.label : `${item.label} (${height} mm)`,
            active,
            onPick: () => {
              setTool(active ? { kind: "select" } : { kind: "place", item: item.id });
              setHover(null);
            },
          };
        }),
    };
  }).filter((section) => section.entries.length);

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
        <ToolButton active={tool.kind === "room"} onClick={() => setTool({ kind: "room" })} icon={<Square className="size-4" aria-hidden />} label="Kreslit místnost (obdélník)" />
        <ToolButton active={tool.kind === "polygon"} onClick={() => (setPolyDraft([]), setTool({ kind: "polygon" }))} icon={<span aria-hidden>📐</span>} label="Kreslit šikmou stěnu / polygonální místnost" />
        <ToolButton active={tool.kind === "calibrate"} onClick={() => (setCalibration([]), setTool({ kind: "calibrate" }))} icon={<Ruler className="size-4" aria-hidden />} label="📏 Kalibrovat měřítko" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            if (!window.confirm("Vymazat celý nákres (všechna podlaží, prvky, místnosti i podklady)?")) return;
            setDraft({ ...emptyDraft(), updatedAt: Date.now() });
            clearSelection();
            setView(FIT);
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Vymazat nákres
        </Button>
        {/* Fáze 63: export výkresu do PDF (tiskový list A3 / A4) a do CAD (DXF) */}
        <FloorplanExport draft={deferred} analysis={analysis.ok ? analysis : null} company={company} />
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
        {/* Fáze 63: zobrazení kabelů – barevně podle okruhů / normové CAD značení */}
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Zobrazení kabelů">
          {(
            [
              ["color", "🎨 Barevně podle okruhů"],
              ["cad", "📐 Normové CAD značení (ČSN)"],
            ] as const
          ).map(([view, label]) => (
            <button
              key={view}
              type="button"
              role="radio"
              aria-checked={draft.cableView === view}
              onClick={() => update((current) => ({ ...current, cableView: view }))}
              className={cn("rounded-md border px-2.5 py-1.5 text-sm font-semibold", draft.cableView === view ? "border-emerald-500 bg-emerald-500/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              data-testid={`cable-view-${view}`}
            >
              [ {label} ]
            </button>
          ))}
        </div>
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
            const nextSeries = patch.series ?? current.series;
            return { ...current, series: nextSeries, color: colorForSeries(nextSeries, patch.color ?? current.color) };
          })
        }
        onApplyAll={() => {
          update((current) => applyAppearance(current));
          toast.success(`Vzhled ${appearanceLabel(draft.series, draft.color)} použit na celý dům.`);
        }}
        onApplyRoom={() => {
          if (!selectedRoom) return;
          update((current) => applyAppearance(current, { room: selectedRoom.name }));
          toast.success(`Vzhled použit v místnosti ${selectedRoom.name}.`);
        }}
        installation={draft.installation}
        smartSystem={draft.smartSystem}
        activeProduct={tool.kind === "place" ? (tool.product ?? null) : null}
        onSmartSystem={(smartSystem) => {
          if (!isSmartSystem(smartSystem)) return;
          update((current) => ({ ...current, smartSystem }));
          toast.success("Systém chytré domácnosti změněn – akční členy se přepočítaly.");
        }}
        onBusLevel={() => changeLevel("bus_loxone")}
        onPlaceProduct={placeProduct}
      />

      {/* Fáze 59: podlaží domu */}
      <FloorBar
        floors={floors}
        activeId={draft.floorId}
        panelFloorId={panelFloorId}
        onSelect={selectFloor}
        onAdd={(input) => {
          update((current) => addFloor(current, input));
          clearSelection();
          setView(FIT);
          toast.success(`Podlaží ${input.name} přidáno – nahrajte jeho podklad nebo kreslete do rastru. Stoupací vedení ↕ najdete v paletě Rozváděč.`);
        }}
        onUpdate={(id, patch) => update((current) => updateFloor(current, id, patch))}
        onRemove={(id) => {
          update((current) => removeFloor(current, id));
          clearSelection();
          setView(FIT);
        }}
      />

      <div className="grid gap-3 xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-3">
          {/* Fáze 62: sestavy zásuvek a vypínačů ve víceramečku – samostatný panel nad paletou, vloží se celé jedním klikem */}
          <FrameAssemblyPalette
            level={draft.installation}
            active={tool.kind === "place-set" ? tool.key : null}
            onPick={(pick) => {
              setTool(tool.kind === "place-set" && tool.key === pick.key && pick.key !== "custom" ? { kind: "select" } : { kind: "place-set", ...pick });
              setHover(null);
            }}
          />
          {/* Fáze 63: paleta značek jako akordeon (počty osazených prvků, sbalit / rozbalit vše, jedna kategorie) */}
          <PaletteAccordion sections={paletteSections} />
        </div>

        {/* Plátno půdorysu */}
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* Fáze 62: probíhající krok (párování, vkládání, kreslení, úprava) a „Hotovo“ vždy nad půdorysem */}
          <ModeBar tone={step.tone} title={step.title} hint={hint} onDone={step.onDone} doneLabel={step.doneLabel}>
            {step.extra}
          </ModeBar>
          <div className="relative overflow-hidden rounded-xl border border-border bg-zinc-950">
            <svg
              ref={svg}
              viewBox={viewBoxOf(viewMm, draft)}
              className={cn("block h-auto w-full touch-none select-none", pan ? "cursor-grabbing" : tool.kind === "select" ? (zoomed ? "cursor-grab" : "cursor-default") : "cursor-crosshair")}
              role="application"
              aria-label="Půdorys elektroinstalace"
              data-testid="floorplan-canvas"
              data-zoom={Math.round(zoom * 100)}
              data-floor={draft.floorName}
              onPointerDown={onCanvasDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={() => setHover(null)}
              onContextMenu={(event) => {
                // Pravé tlačítko = konec vkládání / měření / kreslení
                event.preventDefault();
                setTool({ kind: "select" });
                setCalibration([]);
                setRoomDraft(null);
                setNoteDraft(null);
              }}
            >
              <defs>
                <pattern id="fp-grid" width={1000} height={1000} patternUnits="userSpaceOnUse">
                  <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#27272a" strokeWidth={Math.max(stroke, draft.widthMm / 2000)} />
                </pattern>
                <HatchPatterns notes={draft.annotations} extra={tool.kind === "annotate" ? [noteStyles[tool.mode]] : []} />
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
                // Fáze 63: polygonální místnost se šikmými stěnami
                const polygon = isPolygonRoom(room);
                const corners = roomPolygon(room);
                const shape = {
                  fill: active ? "rgba(250,204,21,0.10)" : "rgba(250,204,21,0.04)",
                  stroke: active ? "#facc15" : "#a1a1aa",
                  strokeWidth: stroke * (active ? 4 : 2.5),
                  className: tool.kind === "select" ? (active ? "cursor-move" : "cursor-pointer") : undefined,
                  onPointerDown: (event: ReactPointerEvent) => onRoomDown(event, room, "move"),
                  "data-testid": `room-${room.name}`,
                };
                return (
                  <g key={room.id} data-room={room.name} aria-label={`Místnost ${room.name}`}>
                    {polygon ? <polygon points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")} strokeLinejoin="round" data-polygon="true" {...shape} /> : <rect x={room.x} y={room.y} width={room.w} height={room.h} {...shape} />}
                    <text x={room.x + ui * 0.4} y={room.y + ui * 1.1} fontSize={ui * 0.8} fill={draft.background ? "#52525b" : "#d4d4d8"} pointerEvents="none">
                      {room.name} · {polygon ? `${(polygonArea(corners) / 1e6).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m² (${corners.length} rohů)` : roomDimensions(room.w, room.h).label}
                    </text>
                    {active && polygon ? (
                      <g data-testid="polygon-handles">
                        {corners.map((corner, index) => {
                          const next = corners[(index + 1) % corners.length];
                          return (
                            <g key={index}>
                              <text x={(corner.x + next.x) / 2} y={(corner.y + next.y) / 2 - ui * 0.3} fontSize={ui * 0.5} fontWeight={700} textAnchor="middle" fill="#facc15" stroke="#09090b" strokeWidth={ui * 0.05} paintOrder="stroke" pointerEvents="none">
                                {wallLabel(corner, next)}
                              </text>
                              <rect x={corner.x - ui * 0.3} y={corner.y - ui * 0.3} width={ui * 0.6} height={ui * 0.6} rx={ui * 0.1} fill="#facc15" stroke="#09090b" strokeWidth={stroke * 2} className="cursor-move" onPointerDown={(event) => onVertexDown(event, room, index)} data-testid="polygon-vertex" />
                            </g>
                          );
                        })}
                      </g>
                    ) : null}
                    {active && !polygon ? (
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

              {/* Fáze 59: zakreslené změny (příčky, bourání, šrafy, texty) */}
              <g data-testid="annotation-layer">
                {draft.annotations.map((note) => (
                  <AnnotationShape key={note.id} note={note} unit={ui} selected={note.id === selectedNoteId} interactive={tool.kind === "select"} onDown={onNoteDown} onHandle={onNoteHandle} />
                ))}
                {noteDraft ? <AnnotationShape note={{ ...newAnnotation(noteDraft.mode, noteDraft.from, noteDraft.to), ...noteStyles[noteDraft.mode], id: "draft" }} unit={ui} selected={false} interactive={false} /> : null}
              </g>

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
              {/* Fáze 63: rozkreslená polygonální místnost – rohy a gumová čára ke kurzoru s délkou a úhlem */}
              {tool.kind === "polygon" && polyDraft.length
                ? (() => {
                    const last = polyDraft[polyDraft.length - 1];
                    const first = polyDraft[0];
                    const cursor = hover ? (hover.shift ? { x: Math.round(hover.x), y: Math.round(hover.y) } : snapAngle(last, hover, 45)) : null;
                    const closing = Boolean(hover && polyDraft.length >= 3 && Math.hypot(hover.x - first.x, hover.y - first.y) <= ui * 0.8);
                    const angle = cursor ? Math.round(((Math.atan2(cursor.y - last.y, cursor.x - last.x) * 180) / Math.PI + 360) % 360) : 0;
                    return (
                      <g pointerEvents="none" data-testid="polygon-draft" data-points={polyDraft.length}>
                        <polyline points={polyDraft.map((corner) => `${corner.x},${corner.y}`).join(" ")} fill="rgba(250,204,21,0.06)" stroke="#facc15" strokeWidth={stroke * 3} />
                        {cursor ? <line x1={last.x} y1={last.y} x2={closing ? first.x : cursor.x} y2={closing ? first.y : cursor.y} stroke="#facc15" strokeWidth={stroke * 2} strokeDasharray={`${ui / 3} ${ui / 4}`} /> : null}
                        {cursor && !closing ? (
                          <text x={(last.x + cursor.x) / 2} y={(last.y + cursor.y) / 2 - ui * 0.4} fontSize={ui * 0.6} fontWeight={700} textAnchor="middle" fill="#facc15" stroke="#09090b" strokeWidth={ui * 0.05} paintOrder="stroke">
                            {wallLabel(last, cursor)} · {angle}°
                          </text>
                        ) : null}
                        {polyDraft.map((corner, index) => (
                          <circle key={index} cx={corner.x} cy={corner.y} r={ui * (index === 0 ? 0.35 : 0.22)} fill={index === 0 && closing ? "#22c55e" : "#facc15"} stroke="#09090b" strokeWidth={stroke} />
                        ))}
                      </g>
                    );
                  })()
                : null}

              {/* Trasy kabelů po okruzích a sběrnicová linka (aktivní podlaží); fáze 62: vrstvu jde skrýt (K), při párování
                  vypínačů se světly je ve výchozím stavu skrytá; fáze 63: barevně / normové CAD značení, odsazení 200 mm podél
                  stěn (u šikmé stěny v její ose), ruční posun úseků (↕ v ose Y, ↔ v ose X), odskok dvojklikem, reset pravým tlačítkem */}
              {cablesShown && routes ? (
                <RouteLayer
                  circuits={routes.circuits}
                  bus={routes.bus}
                  view={draft.cableView}
                  onPaper={Boolean(draft.background)}
                  unit={ui}
                  stroke={stroke}
                  editable={routesEditable}
                  drag={routeDrag ? { key: routeDrag.key, points: routeDrag.points } : null}
                  onSegmentDown={onRouteDown}
                  onReset={resetRoute}
                />
              ) : null}
              {/* Fáze 59: průchod stoupacího vedení bez značky (výchozí nad / pod rozváděčem) */}
              {floors.length > 1 && riserHere && !draft.elements.some((element) => element.item === "riser") ? (
                <g transform={`translate(${riserHere.riser.x} ${riserHere.riser.y})`} pointerEvents="none" data-testid="riser-default">
                  <circle r={ui * 0.45} fill="none" stroke="#a78bfa" strokeWidth={stroke * 2.5} strokeDasharray={`${ui / 6} ${ui / 8}`} />
                  <text y={ui * 0.22} fontSize={ui * 0.6} textAnchor="middle" fill="#a78bfa" fontWeight={800}>
                    ↕
                  </text>
                </g>
              ) : null}

              {/* Ovládací vazby vypínač → světlo (aktivní podlaží) */}
              {draft.elements.flatMap((element) =>
                element.controls.map((lightId) => {
                  const light = draft.elements.find((candidate) => candidate.id === lightId);
                  return light ? <line key={`${element.id}-${lightId}`} x1={element.x} y1={element.y} x2={light.x} y2={light.y} stroke={draft.background ? "#71717a" : "#e4e4e7"} strokeWidth={stroke * 1.5} strokeDasharray={`${ui / 4} ${ui / 4}`} data-testid="switch-link" pointerEvents="none" /> : null;
                }),
              )}

              {calibration.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r={ui / 4} fill={tool.kind === "verify" ? "#22c55e" : "#facc15"} stroke="#09090b" strokeWidth={stroke} data-testid="calibration-point" />
              ))}

              {/* Fáze 59: víceramečky – obrys kolem přisazených přístrojů */}
              {draft.frames.map((frame) => {
                const outline = frameOutline(draft, frame);
                if (!outline) return null;
                const active = frame.members.some((id) => selection.includes(id));
                return (
                  <g key={frame.id} pointerEvents="none" data-testid="frame-outline" data-gangs={frameGangs(draft, frame)}>
                    <rect x={outline.x} y={outline.y} width={outline.w} height={outline.h} rx={ui * 0.2} fill="none" stroke={active ? "#facc15" : "#ca8a04"} strokeWidth={stroke * (active ? 3 : 2)} />
                    <text x={outline.x + outline.w} y={outline.y - ui * 0.15} fontSize={ui * 0.5} textAnchor="end" fill="#ca8a04" fontWeight={800}>
                      {frameGangs(draft, frame)}R
                    </text>
                  </g>
                );
              })}

              {draft.elements.map((element) => {
                const item = displayItem(element);
                if (!item) return null;
                const size = symbolSizeOf(draft, element);
                const active = selection.includes(element.id) || (tool.kind === "pair" && tool.switchId === element.id) || (tool.kind === "pair-light" && tool.lightId === element.id);
                // Fáze 63: zařizovací předmět ve skutečném rozměru se zónami, posuvnými stranami a žlutým rohem
                if (item.kind === "fixture") {
                  return (
                    <g key={element.id} data-element={item.id} data-selected={active ? "true" : undefined} aria-label={`${item.label} – ${element.room}`} role="button">
                      <FixtureShape element={element} active={active} onPaper={Boolean(draft.background)} unit={ui} interactive={tool.kind === "select" || tool.kind === "place"} onBodyDown={(event) => onElementDown(event, element)} onHandleDown={(event, handle) => onFixtureHandle(event, element, handle)} />
                    </g>
                  );
                }
                // Při párování zvýraznit, na co jde kliknout
                const candidate = (tool.kind === "pair" && item.kind === "light") || (tool.kind === "pair-light" && controlsLights(item));
                const linked = tool.kind === "pair" ? draft.elements.find((other) => other.id === tool.switchId)?.controls.includes(element.id) : tool.kind === "pair-light" ? element.controls.includes(tool.lightId) : false;
                // Fáze 62: ve víceramečku klikací plocha jen na pozici přístroje (sousedé v rozteči 0,78 značky se jinak překrývají)
                const hitSlot = frameOf(draft, element.id) ? { length: gangsOf(element) * framePitch(draft, element), horizontal: frameAxis(element.rotation).x === 1 } : null;
                return (
                  <g key={element.id} transform={`translate(${element.x} ${element.y})`} onPointerDown={(event) => onElementDown(event, element)} className={tool.kind === "select" || tool.kind === "place" ? "cursor-move" : "cursor-pointer"} data-element={item.id} data-selected={active ? "true" : undefined} aria-label={`${item.label} – ${element.room}`} role="button">
                    {candidate ? <circle r={size * 0.62} fill={linked ? "rgba(34,197,94,0.18)" : "rgba(56,189,248,0.12)"} stroke={linked ? "#22c55e" : "#38bdf8"} strokeWidth={stroke * 2} strokeDasharray={linked ? undefined : `${ui / 5} ${ui / 7}`} pointerEvents="none" data-testid="pair-candidate" /> : null}
                    {item.kind === "panel" ? (
                      <PanelSymbol size={size * 1.3} active={active} onPaper={Boolean(draft.background)} label={item.symbol} />
                    ) : (
                      // Fáze 57: značka dle ČSN EN 60617-11, řazení vypínače z párování, natočení ke stěně
                      <FloorSymbol item={item} size={size} active={active} onPaper={Boolean(draft.background)} rotation={element.rotation} switchNo={isWiredSwitch(item) && (item.control ?? "light") === "light" ? effectiveSwitchNo(draft, element) : undefined} level={draft.installation} lem={designColor(element.color ?? draft.color)?.swatch ?? null} hitSlot={hitSlot} />
                    )}
                    {element.frameUnits > 1 ? (
                      <text x={size * 0.6} y={size * 0.75} fontSize={size * 0.3} fill="#ca8a04" fontWeight={700}>
                        {element.frameUnits}R
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {/* Fáze 59: náhled vkládané značky u kurzoru s natočením (R = otočit) */}
              {ghostItem && ghost && ghostItem.kind === "fixture" ? (
                <g opacity={0.55} pointerEvents="none" data-testid="place-ghost" data-rotation={ghost.rotation}>
                  <FixtureShape element={{ id: "ghost", item: ghostItem.id, x: ghost.position.x, y: ghost.position.y, room: "", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: ghost.rotation, scale: null }} active={false} onPaper={Boolean(draft.background)} unit={ui} interactive={false} />
                </g>
              ) : ghostItem && ghost && ghostItem.kind !== "panel" ? (
                <g transform={`translate(${ghost.position.x} ${ghost.position.y})`} opacity={0.55} pointerEvents="none" data-testid="place-ghost" data-rotation={ghost.rotation}>
                  <FloorSymbol item={ghostItem} size={symbolSizeOf(draft, { scale: null })} active={false} onPaper={Boolean(draft.background)} rotation={ghost.rotation} level={draft.installation} />
                </g>
              ) : null}
              {/* Fáze 62: náhled celé sestavy ve víceramečku */}
              {setGhost ? (
                <g opacity={0.6} pointerEvents="none" data-testid="place-set-ghost" data-rotation={setGhost.rotation} data-members={setGhost.members.length}>
                  {setGhost.outline ? <rect x={setGhost.outline.x} y={setGhost.outline.y} width={setGhost.outline.w} height={setGhost.outline.h} rx={ui * 0.2} fill="none" stroke="#ca8a04" strokeWidth={stroke * 2} strokeDasharray={`${ui / 4} ${ui / 6}`} /> : null}
                  {setGhost.members.map((member) => {
                    const item = paletteItem(member.item);
                    return item ? (
                      <g key={member.id} transform={`translate(${member.x} ${member.y})`}>
                        <FloorSymbol item={item} size={symbolSizeOf(draft, { scale: null })} active={false} onPaper={Boolean(draft.background)} rotation={setGhost.rotation} level={draft.installation} />
                      </g>
                    ) : null;
                  })}
                </g>
              ) : null}

              {marquee ? <rect x={Math.min(marquee.x, marquee.x + marquee.w)} y={Math.min(marquee.y, marquee.y + marquee.h)} width={Math.abs(marquee.w)} height={Math.abs(marquee.h)} fill="rgba(56,189,248,0.08)" stroke="#38bdf8" strokeDasharray={`${ui / 4} ${ui / 6}`} strokeWidth={stroke * 2} pointerEvents="none" data-testid="marquee" /> : null}

              {/* Fáze 57: plovoucí lišta vybrané značky – otočit, zmenšit / zvětšit, smazat; fáze 59: 🔗 přiřadit */}
              {selected && !pairing ? (
                <ElementToolbar
                  x={selected.x}
                  y={selected.y - symbolSizeOf(draft, selected) * 0.9}
                  unit={ui}
                  onRotate={() => rotateSelection([selected.id])}
                  onScale={(factor) => update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === selected.id ? { ...element, scale: clampSymbolScale((element.scale ?? 1) * factor) } : element)) }))}
                  onDelete={() => removeSelection([selected.id])}
                  onPair={
                    controlsLights(paletteItem(selected.item))
                      ? () => setTool({ kind: "pair", switchId: selected.id })
                      : paletteItem(selected.item)?.kind === "light"
                        ? () => setTool({ kind: "pair-light", lightId: selected.id })
                        : undefined
                  }
                  onAddToFrame={isFrameable(selected) && usedGangs(selected) + gangsOf({ item: selected.item, frameUnits: 1 }) <= MAX_FRAME_GANGS ? () => addIntoFrame(selected.id, selected.item) : undefined}
                />
              ) : null}
              {selectedNote && tool.kind === "select" ? (
                <rect {...(() => { const box = annotationBounds(selectedNote); return { x: box.x - ui * 0.2, y: box.y - ui * 0.2, width: box.w + ui * 0.4, height: box.h + ui * 0.4 }; })()} fill="none" stroke="#38bdf8" strokeDasharray={`${ui / 4} ${ui / 6}`} strokeWidth={stroke * 1.5} pointerEvents="none" />
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
            {/* Fáze 62: vrstva kabeláže – zobrazit / skrýt (K); při párování vypínačů se světly je ve výchozím stavu skrytá */}
            <button
              type="button"
              aria-label="Zobrazit kabeláž v půdorysu"
              aria-pressed={cablesShown}
              onClick={toggleCables}
              title={cablesShown ? "Skrýt trasy kabelů v půdorysu (K)" : "Zobrazit trasy kabelů v půdorysu (K)"}
              className={cn("absolute top-2 right-2 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold shadow", cablesShown ? "border-border bg-card/90 text-foreground hover:bg-muted" : "border-amber-400/70 bg-amber-950/90 text-amber-100 hover:bg-amber-900")}
              data-testid="toggle-cables"
            >
              {cablesShown ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
              {cablesShown ? "Kabeláž" : "Kabeláž skrytá"}
            </button>
            <span className="pointer-events-none absolute top-2 left-2 rounded-md border border-border bg-card/90 px-2 py-0.5 text-xs font-semibold" data-testid="active-floor">
              {draft.floorName} <span className="font-mono text-muted-foreground">{levelLabel(draft.floorLevelMm)}</span>
            </span>
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
          {selectedNote ? (
            <AnnotationDetail
              key={selectedNote.id}
              note={selectedNote}
              onChange={(patch) => update((current) => updateAnnotation(current, selectedNote.id, patch))}
              onDelete={() => {
                update((current) => removeAnnotation(current, selectedNote.id));
                setSelectedNoteId(null);
              }}
            />
          ) : null}
          {selection.length > 1 ? (
            <SelectionPanel
              count={selection.length}
              gangs={draft.elements.filter((element) => selection.includes(element.id)).reduce((sum, element) => sum + gangsOf(element), 0)}
              frameError={selectionFrame && !selectionFrame.ok ? selectionFrame.error : null}
              onFrame={makeFrame}
              onRotate={() => rotateSelection()}
              onDelete={() => removeSelection()}
              onClear={() => setSelection([])}
            />
          ) : null}
          {selected ? (
            <ElementDetail
              key={selected.id}
              draft={draft}
              element={selected}
              pairing={(tool.kind === "pair" && tool.switchId === selected.id) || (tool.kind === "pair-light" && tool.lightId === selected.id)}
              onPair={() => {
                const item = paletteItem(selected.item);
                if (pairing) return setTool({ kind: "select" });
                setTool(item?.kind === "light" ? { kind: "pair-light", lightId: selected.id } : { kind: "pair", switchId: selected.id });
              }}
              onChange={(patch) => update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === selected.id ? { ...element, ...patch } : element)) }))}
              onRotate={() => rotateSelection([selected.id])}
              onDelete={() => removeSelection([selected.id])}
              onAutoPair={autoPair}
              usedGangs={usedGangs(selected)}
              onAddToFrame={(item) => addIntoFrame(selected.id, item)}
              display={displayItem(selected) ?? paletteItem(selected.item)!}
              appliance={paletteItem(selected.item)?.kind === "appliance" ? applianceSpecFor(draft.appliances, selected) : null}
              onRotateStep={(step) => rotateSelection([selected.id], step)}
              onEditAppliances={() => setApplianceOpen(true)}
              onFrame={{
                moveLeft: () => update((current) => moveInFrame(current, selected.id, -1)),
                moveRight: () => update((current) => moveInFrame(current, selected.id, 1)),
                rotate: () => {
                  const frame = frameOf(draft, selected.id);
                  if (frame) update((current) => rotateFrame(current, frame.id));
                },
                leave: () => update((current) => removeFromFrame(current, selected.id)),
                dissolve: () => {
                  const frame = frameOf(draft, selected.id);
                  if (frame) update((current) => dissolveFrame(current, frame.id));
                },
              }}
            />
          ) : null}
          {smartPlan ? <SmartHomePanel plan={smartPlan} onSystem={(smartSystem) => isSmartSystem(smartSystem) && update((current) => ({ ...current, smartSystem }))} /> : null}
          <PlanChecks checks={checks} title="Kontrola půdorysu a norem" />
          {/* Fáze 63: ručně upravené trasy – návrat na automat */}
          {routes && routes.circuits.some((circuit) => circuit.edited) ? (
            <section className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-card p-3 text-xs" aria-label="Ručně upravené trasy" data-testid="edited-routes">
              <h3 className="text-sm font-bold">✎ Ručně upravené trasy</h3>
              <ul className="flex flex-col gap-1">
                {routes.circuits
                  .filter((circuit) => circuit.edited)
                  .map((circuit) => (
                    <li key={circuit.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        {circuit.designation ? `${circuit.designation} ` : ""}
                        {circuit.label} · {circuit.lengthM.toLocaleString("cs-CZ")} m
                      </span>
                      <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => resetRoute(circuit)} data-testid="route-reset">
                        🔄 Resetovat trasu na automat
                      </Button>
                    </li>
                  ))}
              </ul>
              <p className="text-muted-foreground">Délka kabelu se počítá z upravené trasy. Pravé tlačítko na trase vrátí okruh na automat.</p>
            </section>
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
            manufacturers={manufacturers}
            wallFloors={analysis.ok ? analysis.build.wallFloors.length : 0}
            floorCount={floors.length}
          />
          {/* Fáze 55: kusovník domovní instalace s objednacími čísly */}
          <WiringBomDialog rows={bom} />
          {inventory.length ? (
            <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Soupis domovní instalace" data-testid="wiring-inventory">
              <h3 className="font-bold">Soupis domovní instalace{floors.length > 1 ? ` (${floors.length} podlaží)` : ""}</h3>
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

      {/* Fáze 63: knihovna samostatných spotřebičů (✎ Upravit / + Přidat v paletě) */}
      <ApplianceEditor open={applianceOpen} onOpenChange={setApplianceOpen} specs={catalog} onSave={saveAppliances} />

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
            <p className="text-xs text-muted-foreground">Párování ovladačů se světly zůstane. Kabeláž, okruhy a kusovník se přepočítají podle nové úrovně (všechna podlaží).</p>
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
function ElementToolbar({ x, y, unit, onRotate, onScale, onDelete, onPair, onAddToFrame }: { x: number; y: number; unit: number; onRotate: () => void; onScale: (factor: number) => void; onDelete: () => void; onPair?: () => void; onAddToFrame?: () => void }) {
  const size = unit * 1.15;
  const buttons: { label: string; text: string; fill: string; onClick: () => void; font?: number }[] = [
    ...(onPair ? [{ label: "Přiřadit vypínač ke světlu", text: "🔗", fill: "#166534", onClick: onPair }] : []),
    // Fáze 62: stejný přístroj vedle do víceramečku (zásuvka → 2R → 3R …)
    ...(onAddToFrame ? [{ label: "Přidat stejný přístroj vedle do rámečku", text: "▦+", fill: "#a16207", onClick: onAddToFrame, font: 0.5 }] : []),
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
          <text x={size / 2} y={size / 2} fontSize={unit * (button.font ?? 0.7)} textAnchor="middle" dominantBaseline="central" fill="#fafafa" pointerEvents="none">
            {button.text}
          </text>
        </g>
      ))}
    </g>
  );
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
  onAutoPair,
  usedGangs,
  onAddToFrame,
  onFrame,
  display,
  appliance,
  onRotateStep,
  onEditAppliances,
}: {
  draft: FloorplanDraft;
  element: EditorElement;
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
  onRotate: () => void;
  onDelete: () => void;
  onAutoPair: () => void;
  /** Fáze 62: obsazené pozice rámečku prvku a přidání dalšího přístroje do rámečku. */
  usedGangs: number;
  onAddToFrame: (item: string) => void;
  onFrame: { moveLeft: () => void; moveRight: () => void; rotate: () => void; leave: () => void; dissolve: () => void };
  /** Fáze 63: zobrazovaná položka (spotřebič z knihovny, výrobek), zadání spotřebiče, otočení po 45° a úprava spotřebičů. */
  display: PaletteItem;
  appliance: ApplianceSpec | null;
  onRotateStep: (step: number) => void;
  onEditAppliances: () => void;
}) {
  const item = paletteItem(element.item)!;
  const isPanel = item.kind === "panel" || item.kind === "riser" || item.kind === "fixture";
  const defaultHeight = isPanel ? draft.profile.switchboardHeightMm : (appliance?.heightMm ?? item.heightMm ?? mountHeight({ kind: item.kind as Exclude<typeof item.kind, "panel" | "riser" | "fixture">, variant: item.variant, tag: item.tag }, draft.profile));
  const light = item.kind === "light" ? lightSpecOf(element) : null;
  const frame = frameOf(draft, element.id);
  const legacyFrameable = !frame && !item.wireless && (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch");
  const rooms = [...new Set([...draft.rooms.map((room) => room.name), ...draft.elements.map((other) => other.room)])];
  const everything = [...draft.elements, ...draft.otherFloors.flatMap((floor) => floor.elements)];
  const lights = everything.filter((other) => element.controls.includes(other.id));
  const controllers = everything.filter((other) => other.controls.includes(element.id));
  const floorName = (id: string) => (draft.elements.some((other) => other.id === id) ? null : (draft.otherFloors.find((floor) => floor.elements.some((other) => other.id === id))?.name ?? null));
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Detail vybraného prvku" data-testid="element-detail">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          <span className="mr-1.5 rounded bg-muted px-1 font-mono text-xs">{display.symbol}</span>
          {display.label}
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
      {item.kind === "fixture" ? (
        // Fáze 63: přesný rozměr X × Y a natočení po 90° / 45°
        <FixtureControls element={element} onChange={onChange} onRotate={onRotateStep} />
      ) : isPanel ? (
        <p className="text-xs text-muted-foreground">
          {item.kind === "riser"
            ? "Průchod kabelů do jiného podlaží – trasy z tohoto podlaží vedou k rozváděči přes toto místo (svislá délka = rozdíl výšek podlaží)."
            : `Výchozí bod všech tras. Výška rozváděče se nastavuje v horní liště (${draft.profile.switchboardHeightMm} mm).`}
        </p>
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
          {/* Fáze 63: samostatný spotřebič – jištění, chránič a kabel z knihovny spotřebičů */}
          {appliance ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-500/40 bg-orange-500/5 p-2 text-xs" data-testid="appliance-detail">
              <span>
                {appliance.powerW.toLocaleString("cs-CZ")} W · {protectionLabel(appliance)}
                {appliance.custom ? " · vlastní spotřebič" : ""}
              </span>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onEditAppliances}>
                ✎ Upravit spotřebiče
              </Button>
            </div>
          ) : null}
          {/* Fáze 59: víceramček – pořadí, otočení, vyjmutí a rozdělení */}
          {frame ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs" data-testid="frame-detail">
              <p className="font-semibold text-amber-200">
                <LayoutGrid className="mr-1 inline size-3.5" aria-hidden />
                Víceramček {frameGangs(draft, frame)}R · pozice {frame.members.indexOf(element.id) + 1} z {frame.members.length}
              </p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.moveLeft} disabled={frame.members.indexOf(element.id) === 0}>
                  ◀ Posunout
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.moveRight} disabled={frame.members.indexOf(element.id) === frame.members.length - 1}>
                  Posunout ▶
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.rotate}>
                  ⟳ Otočit rámeček
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.leave}>
                  Vyjmout z rámečku
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-red-300" onClick={onFrame.dissolve} data-testid="frame-dissolve">
                  Rozdělit rámeček
                </Button>
              </div>
              <AddToFrameControl level={draft.installation} defaultItem={element.item} gangs={usedGangs} onAdd={onAddToFrame} />
            </div>
          ) : legacyFrameable ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground" role="radiogroup" aria-label="Počet kusů v rámečku">
                Stejné kusy v rámečku:
                {[1, 2, 3, 4, 5].map((units) => (
                  <button key={units} type="button" role="radio" aria-checked={element.frameUnits === units} onClick={() => onChange({ frameUnits: units })} className={cn("rounded border px-2 py-0.5", element.frameUnits === units ? "border-primary bg-primary/20 text-foreground" : "border-border")}>
                    {units}R
                  </button>
                ))}
              </div>
              {isFrameable(element) ? (
                <>
                  <AddToFrameControl level={draft.installation} defaultItem={element.item} gangs={usedGangs} onAdd={onAddToFrame} />
                  <p className="text-[11px] text-muted-foreground">Celou sestavu vložíte i z palety (▦ Sestavy ve víceramečku), již osazené přístroje spojíte Shift + klikem a „Vložit do víceramečku“.</p>
                </>
              ) : null}
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
              {/* Fáze 62: párování se ukončuje tlačítkem „Hotovo“ nad půdorysem, ne v bočním panelu */}
              {pairing ? (
                <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200" data-testid="pairing-note">
                  🔗 Párování běží – klikejte na svítidla v půdorysu, ukončíte ho tlačítkem Hotovo nad půdorysem (Esc).
                </p>
              ) : (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onPair} data-testid="pair-switch">
                  <Link2 className="size-4" aria-hidden /> 🔗 Přiřadit ke světlu
                </Button>
              )}
              <p className="text-xs text-muted-foreground" data-testid="switch-controls">
                {lights.length
                  ? `Ovládá: ${lights.map((light) => `${paletteItem(light.item)?.label} (${light.room}${floorName(light.id) ? `, ${floorName(light.id)}` : ""})${isWiredSwitch(item) ? ` – řazení ${switchingFor(controllersOf(draft, light.id))}` : ""}`).join(", ")}`
                  : "Zatím neovládá žádné svítidlo."}
              </p>
              {isWiredSwitch(item) && lights.length ? (
                <p className="flex items-center gap-1 text-xs text-emerald-300" data-testid="switch-number">
                  <CheckCircle2 className="size-3" aria-hidden /> Značka kreslena jako řazení č. {effectiveSwitchNo(draft, element)}
                </p>
              ) : null}
            </div>
          ) : null}
          {/* Fáze 61: svítidlo pro chytrou domácnost – stmívání, příkon a druh zátěže (výběr akčního členu) */}
          {light && draft.installation === "bus_loxone" ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs" data-testid="light-spec">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={light.dimmable} onChange={(event) => onChange({ light: { ...light, dimmable: event.target.checked } })} aria-label="Stmívané svítidlo" /> Stmívané (stmívací kanál)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-muted-foreground">
                  Příkon [W]
                  <Input type="number" min={1} max={3000} value={light.powerW} onChange={(event) => onChange({ light: { ...light, powerW: Math.min(3000, Math.max(1, Math.round(Number(event.target.value) || DEFAULT_LIGHT.powerW))) } })} aria-label="Příkon svítidla [W]" className="h-8" />
                </label>
                <label className="flex flex-col gap-1 text-muted-foreground">
                  Zátěž
                  <select value={light.load} onChange={(event) => onChange({ light: { ...light, load: event.target.value as typeof light.load, ...(event.target.value === "dali" ? { dimmable: true } : {}) } })} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-foreground dark:bg-input/30" aria-label="Druh zátěže svítidla">
                    {LIGHT_LOADS.map((load) => (
                      <option key={load.id} value={load.id}>
                        {load.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
          {item.kind === "light" ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground" data-testid="light-switching">
                Ovládací místa: {controllersOf(draft, element.id)} · řazení {switchingFor(controllersOf(draft, element.id))}
                {controllers.length ? ` · ${controllers.map((controller) => `${paletteItem(controller.item)?.symbol} (${controller.room}${floorName(controller.id) ? `, ${floorName(controller.id)}` : ""})`).join(", ")}` : ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pairing ? (
                  <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200" data-testid="pairing-note">
                    🔗 Párování běží – klikejte na vypínače v půdorysu, ukončíte ho tlačítkem Hotovo nad půdorysem (Esc).
                  </p>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onPair} data-testid="pair-light">
                    <Link2 className="size-4" aria-hidden /> 🔗 Přiřadit vypínač
                  </Button>
                )}
                {!controllers.length ? (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onAutoPair}>
                    <Sparkles className="size-4" aria-hidden /> Nejbližší vypínač v místnosti
                  </Button>
                ) : null}
              </div>
            </div>
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
