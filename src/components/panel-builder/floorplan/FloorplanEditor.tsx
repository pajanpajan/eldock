"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Grid3x3, Link2, Loader2, MousePointer2, Ruler, Square, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INSTALL_LEVELS, INSTALL_METHODS, ROUTING_MODES, mountHeight, type CableRoutingMode, type ElevationProfile, type InstallLevel, type InstallMethod } from "@/engine/floorplan-bridge";
import {
  PALETTE,
  PALETTE_GROUPS,
  ROOM_NAME_CHIPS,
  analyzeDraft,
  applyAppearance,
  controllersOf,
  controlsLights,
  deleteRoom,
  emptyDraft,
  moveRoom,
  paletteItem,
  parseDraft,
  parseLength,
  recalibrate,
  resizeRect,
  roomAt,
  roomDimensions,
  switchingFor,
  updateRoom,
  wiringInventory,
  type EditorElement,
  type EditorRoom,
  type FloorplanDraft,
  type RoomHandle,
} from "@/lib/panel-builder/floorplan-editor";
import { DESIGN_BRANDS, appearanceLabel, colorForSeries, designColor, seriesColors } from "@/lib/panel-builder/wiring-designs";
import { renderPdfPage } from "@/lib/pdf-client";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { createFloorplanProjectAction } from "@/server/actions/panel-projects";

import { CablePanel } from "./CablePanel";
import { DeviceAppearance } from "./DeviceAppearance";
import { FloorSymbol } from "./FloorSymbol";
import { WiringBomDialog } from "./WiringBomDialog";

// 2D editor půdorysu elektroinstalace (fáze 49): podklad (obrázek / PDF / rastr), kalibrace na 2 kliky,
// osazení značek, párování vypínačů se světly, trasy kabelů a výkaz kabeláže v reálném čase.

const STORAGE_KEY = "eldock.pb.floorplan";
const SNAP_MM = 50;
const ROUTE_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#4ade80"];

type Tool = { kind: "select" } | { kind: "place"; item: string } | { kind: "room" } | { kind: "calibrate" } | { kind: "pair"; switchId: string };

const HEIGHTS: { key: keyof ElevationProfile; label: string }[] = [
  { key: "ceilingHeightMm", label: "Strop" },
  { key: "switchboardHeightMm", label: "Rozváděč" },
  { key: "defaultSocketHeightMm", label: "Zásuvky" },
  { key: "worktopSocketHeightMm", label: "Kuchyně/Linka" },
  { key: "defaultSwitchHeightMm", label: "Vypínače" },
];

const MODE_BUTTONS: Record<CableRoutingMode, string> = { BOTTOM: "⬇ Spodem (v podlaze)", TOP: "⬆ Vrchem (stropem/podhledem)", OPTIMIZED: "✨ Optimalizovaně (Auto)" };

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
  const [roomDraft, setRoomDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [calibration, setCalibration] = useState<{ x: number; y: number }[]>([]);
  const [uploading, setUploading] = useState(false);
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

  // Esc = zpět na výběr, Delete = smazat vybraný prvek
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Escape") {
        setTool({ kind: "select" });
        setCalibration([]);
        setRoomDraft(null);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        setDraft((current) => removeElement(current, selectedId));
        setSelectedId(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedRoomId) {
        setDraft((current) => ({ ...deleteRoom(current, selectedRoomId), updatedAt: Date.now() }));
        setSelectedRoomId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedRoomId]);

  const update = (change: (current: FloorplanDraft) => FloorplanDraft) => setDraft((current) => ({ ...change(current), updatedAt: Date.now() }));

  const analysis = useMemo(() => {
    try {
      return { ok: true as const, ...analyzeDraft(draft) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Neplatný půdorys." };
    }
  }, [draft]);
  const bom = useMemo(() => compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.ok ? analysis.summary.byCable : [] }), [draft, analysis]);

  const selected = draft.elements.find((element) => element.id === selectedId) ?? null;
  const selectedRoom = draft.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const available = useMemo(() => new Map(series.map((option) => [option.key, option.count ?? 1])), [series]);
  const inventory = useMemo(() => wiringInventory(draft), [draft]);
  const size = Math.max(draft.widthMm, draft.heightMm);
  const symbol = size / 55;
  const stroke = size / 900;

  function toPlan(event: { clientX: number; clientY: number }) {
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function onCanvasDown(event: ReactPointerEvent<SVGSVGElement>) {
    const point = toPlan(event);
    if (tool.kind === "place") {
      const item = paletteItem(tool.item);
      if (!item) return;
      const room = roomAt(draft.rooms, point.x, point.y)?.name ?? lastRoom.current;
      const element: EditorElement = { id: newId(item.kind === "panel" ? "rh" : "e"), item: item.id, x: snap(point.x), y: snap(point.y), room, mountHeightMm: null, frameUnits: 1, series: item.kind === "panel" ? null : draft.series, color: item.kind === "panel" ? null : draft.color, controls: [] };
      update((current) => ({ ...current, elements: [...(item.kind === "panel" ? current.elements.filter((other) => other.item !== "panel") : current.elements), element] }));
      setSelectedId(element.id);
      if (item.kind === "panel") setTool({ kind: "select" });
      return;
    }
    if (tool.kind === "room") {
      capture(svg.current, event.pointerId);
      setRoomDraft({ x: snap(point.x), y: snap(point.y), w: 0, h: 0 });
      setSelectedRoomId(null);
      return;
    }
    if (tool.kind === "calibrate") {
      const points = [...calibration, point];
      if (points.length < 2) return void setCalibration(points);
      setCalibration([]);
      const segment = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const answer = window.prompt("Skutečná délka označené stěny nebo kóty (např. 4500 mm nebo 4,5 m):", "");
      const real = answer ? parseLength(answer) : null;
      if (!real) return void toast.error("Zadejte délku, např. 4500 mm nebo 4,5 m.");
      update((current) => recalibrate(current, segment, real));
      setTool({ kind: "select" });
      toast.success(`Měřítko nastaveno: ${(real / 1000).toLocaleString("cs-CZ")} m.`);
      return;
    }
    setSelectedId(null);
    setSelectedRoomId(null);
  }

  /** Klik do místnosti v režimu Výběr = výběr místnosti a přesun tažením (prvky uvnitř jdou s ní). */
  function onRoomDown(event: ReactPointerEvent, room: EditorRoom, handle: RoomHandle | "move") {
    if (tool.kind !== "select") return;
    event.stopPropagation();
    setSelectedId(null);
    setSelectedRoomId(room.id);
    capture(svg.current, event.pointerId);
    setRoomDrag({ id: room.id, handle, start: toPlan(event), origin: { x: room.x, y: room.y, w: room.w, h: room.h } });
  }

  function onElementDown(event: ReactPointerEvent, element: EditorElement) {
    event.stopPropagation();
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
    if (tool.kind !== "select") return onCanvasDown(event as unknown as ReactPointerEvent<SVGSVGElement>);
    setSelectedId(element.id);
    setSelectedRoomId(null);
    const point = toPlan(event);
    capture(svg.current, event.pointerId);
    setDrag({ id: element.id, dx: point.x - element.x, dy: point.y - element.y });
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
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
    if (roomDraft) setRoomDraft({ ...roomDraft, w: snap(point.x) - roomDraft.x, h: snap(point.y) - roomDraft.y });
  }

  function onUp() {
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
      // Přetažením do jiné místnosti se změní i místnost prvku
      update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === drag.id ? { ...element, room: roomAt(current.rooms, element.x, element.y)?.name ?? element.room } : element)) }));
      setDrag(null);
    }
    if (roomDraft) {
      const rect = { x: Math.min(roomDraft.x, roomDraft.x + roomDraft.w), y: Math.min(roomDraft.y, roomDraft.y + roomDraft.h), w: Math.abs(roomDraft.w), h: Math.abs(roomDraft.h) };
      setRoomDraft(null);
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

  async function pickBackground(file: File) {
    setUploading(true);
    try {
      let image: File;
      if (file.type === "application/pdf") {
        const local = URL.createObjectURL(file);
        const page = await renderPdfPage(local, 1, 2400);
        image = new File([await (await fetch(page.src)).blob()], "pudorys.png", { type: "image/png" });
        URL.revokeObjectURL(local);
      } else if (file.type === "image/svg+xml") {
        image = await rasterizeSvg(file);
      } else image = file;
      const resized = await resizeImage(image, 2400, 0.9);
      const bitmap = await createImageBitmap(resized);
      // Fáze 55: nevykreslená / prázdná stránka PDF by dala nesmyslné měřítko (plocha 0 × 0 m)
      if (!bitmap.width || !bitmap.height) {
        bitmap.close();
        throw new Error("Podklad se nepodařilo vykreslit (prázdná stránka). Zkuste jinou stránku nebo obrázek PNG / JPG.");
      }
      const uploaded = await uploadFile("photo", resized);
      // Výchozí odhad měřítka: šířka podkladu ≈ 15 m – přesně ho nastaví kalibrace
      const mmPerPx = 15_000 / bitmap.width;
      update((current) => ({ ...current, background: { url: uploaded.url, widthPx: bitmap.width, heightPx: bitmap.height }, mmPerPx, widthMm: Math.round(bitmap.width * mmPerPx), heightMm: Math.round(bitmap.height * mmPerPx) }));
      bitmap.close();
      setTool({ kind: "calibrate" });
      toast.info("Podklad nahrán. Teď klikněte na začátek a konec známé stěny nebo kóty (📏 kalibrace).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Podklad se nepodařilo nahrát.");
    } finally {
      setUploading(false);
    }
  }

  function removeRoom(id: string) {
    update((current) => deleteRoom(current, id));
    setSelectedRoomId(null);
  }

  function generate(form: FormData) {
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
  const hint =
    tool.kind === "place"
      ? `Klikněte do půdorysu – ${paletteItem(tool.item)?.label ?? ""} (Esc = konec)`
      : tool.kind === "room"
        ? "Tažením myší nakreslete obdélník místnosti – rozměry X × Y se zobrazují živě."
        : tool.kind === "calibrate"
          ? calibration.length
            ? "Klikněte na konec známé stěny / kóty."
            : "📏 Klikněte na začátek známé stěny nebo kóty ve výkresu."
          : tool.kind === "pair"
            ? "🔗 Klikněte na svítidla, která má vypínač ovládat (znovu = odpojit). Esc = hotovo."
            : selectedRoom
              ? "Místnost: tažením za vnitřek přesun (i s prvky), za stěnu nebo žlutý roh změna rozměru, Delete = smazat."
              : "Výběr: klik = detail prvku / místnosti, tažení = přesun, Delete = smazat.";

  return (
    <div className="flex flex-col gap-3" data-testid="floorplan-editor">
      {/* Horní lišta: podklad, nástroje, režim vedení a výšky */}
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Nahrát půdorys (obrázek / PDF)
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => update((current) => ({ ...current, background: null }))} disabled={!draft.background}>
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
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Vymazat nákres
        </Button>
        <span className="ml-auto text-xs text-muted-foreground" data-testid="floorplan-scale">
          Plocha {(draft.widthMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} × {(draft.heightMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m
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
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 text-xs" role="group" aria-label="Metodika ČSN 33 2130 ed. 4" data-testid="install-methodology">
        <label className="flex items-center gap-1 text-muted-foreground">
          Úroveň instalace:
          <select
            className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30"
            value={draft.installation}
            onChange={(event) => update((current) => ({ ...current, installation: event.target.value as InstallLevel }))}
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
        {/* Paleta značek */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3" aria-label="Paleta elektroinstalačních značek">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-muted-foreground">{group.label}</h3>
              <div className="flex flex-wrap gap-1">
                {PALETTE.filter((item) => item.group === group.id).map((item) => {
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
          ))}
        </aside>

        {/* Plátno půdorysu */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-xs text-muted-foreground" role="status">
            {hint}
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
            <svg
              ref={svg}
              viewBox={`0 0 ${draft.widthMm} ${draft.heightMm}`}
              className={cn("block h-auto w-full touch-none select-none", tool.kind === "select" ? "cursor-default" : "cursor-crosshair")}
              role="application"
              aria-label="Půdorys elektroinstalace"
              data-testid="floorplan-canvas"
              onPointerDown={onCanvasDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              <defs>
                <pattern id="fp-grid" width={1000} height={1000} patternUnits="userSpaceOnUse">
                  <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#27272a" strokeWidth={stroke} />
                </pattern>
              </defs>
              <rect width={draft.widthMm} height={draft.heightMm} fill={draft.background ? "#fff" : "url(#fp-grid)"} />
              {draft.background ? <image href={draft.background.url} width={draft.widthMm} height={draft.heightMm} preserveAspectRatio="none" opacity={0.85} /> : null}
              {draft.rooms.map((room) => {
                const active = room.id === selectedRoomId;
                const handle = symbol * 0.45;
                const edge = symbol * 0.35;
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
                    <text x={room.x + symbol * 0.4} y={room.y + symbol * 1.1} fontSize={symbol * 0.8} fill="#d4d4d8" pointerEvents="none">
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
                        <Dimensions x={room.x} y={room.y} w={room.w} h={room.h} symbol={symbol} />
                        {/* Plovoucí lišta nad místností */}
                        <g transform={`translate(${room.x} ${room.y - symbol * 1.5})`}>
                          <rect width={symbol * 7.5} height={symbol * 1.1} rx={symbol * 0.2} fill="#18181b" stroke="#facc15" strokeWidth={stroke * 1.5} />
                          <text x={symbol * 0.3} y={symbol * 0.75} fontSize={symbol * 0.6} fill="#fafafa" pointerEvents="none">
                            {room.name.slice(0, 18)}
                          </text>
                          <g
                            transform={`translate(${symbol * 6.3} 0)`}
                            className="cursor-pointer"
                            role="button"
                            aria-label="Smazat místnost (plovoucí lišta)"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              removeRoom(room.id);
                            }}
                          >
                            <rect width={symbol * 1.1} height={symbol * 1.1} rx={symbol * 0.2} fill="#dc2626" />
                            <text x={symbol * 0.55} y={symbol * 0.78} fontSize={symbol * 0.6} textAnchor="middle" pointerEvents="none">
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
                <g data-testid="room-draft">
                  <rect x={Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} y={Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} width={Math.abs(roomDraft.w)} height={Math.abs(roomDraft.h)} fill="none" stroke="#facc15" strokeDasharray={`${symbol / 3} ${symbol / 4}`} strokeWidth={stroke * 3} />
                  <Dimensions x={Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} y={Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} w={Math.abs(roomDraft.w)} h={Math.abs(roomDraft.h)} symbol={symbol} />
                </g>
              ) : null}

              {/* Trasy kabelů po okruzích (Manhattan) */}
              {analysis.ok && panelPoint
                ? analysis.summary.circuits.map((circuit, index) => {
                    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
                    let last = { x: panelPoint.x, y: panelPoint.y };
                    const path: string[] = [`M ${last.x} ${last.y}`];
                    for (const segment of circuit.route.segments) {
                      const to = nodeById.get(segment.to);
                      if (!to) continue;
                      path.push(`L ${to.x} ${last.y} L ${to.x} ${to.y}`);
                      last = to;
                    }
                    return (
                      <g key={circuit.id} data-testid="cable-route">
                        <path d={path.join(" ")} fill="none" stroke={color} strokeWidth={stroke * 3.5} strokeDasharray={circuit.routing === "TOP" ? `${symbol / 2} ${symbol / 5}` : undefined} opacity={0.9} />
                        <text x={last.x + symbol * 0.6} y={last.y - symbol * 0.6} fontSize={symbol * 0.62} fill={color} fontWeight={700}>
                          {circuit.lengthsM[draft.mode].toLocaleString("cs-CZ")} m
                        </text>
                      </g>
                    );
                  })
                : null}

              {/* Ovládací vazby vypínač → světlo */}
              {draft.elements.flatMap((element) =>
                element.controls.map((lightId) => {
                  const light = draft.elements.find((candidate) => candidate.id === lightId);
                  return light ? <line key={`${element.id}-${lightId}`} x1={element.x} y1={element.y} x2={light.x} y2={light.y} stroke="#e4e4e7" strokeWidth={stroke * 1.5} strokeDasharray={`${symbol / 4} ${symbol / 4}`} data-testid="switch-link" /> : null;
                }),
              )}

              {calibration.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r={symbol / 4} fill="#facc15" />
              ))}

              {draft.elements.map((element) => {
                const item = paletteItem(element.item);
                if (!item) return null;
                const isPanel = item.kind === "panel";
                const active = element.id === selectedId || (tool.kind === "pair" && tool.switchId === element.id);
                const fill = isPanel ? "#facc15" : item.kind === "light" ? "#fde68a" : item.kind === "switch" ? "#93c5fd" : item.kind === "appliance" ? "#fca5a5" : item.kind === "data_socket" ? "#86efac" : "#e4e4e7";
                return (
                  <g key={element.id} transform={`translate(${element.x} ${element.y})`} onPointerDown={(event) => onElementDown(event, element)} className="cursor-pointer" data-element={item.id} aria-label={`${item.label} – ${element.room}`} role="button">
                    {isPanel ? (
                      <>
                        <rect x={-symbol * 0.9} y={-symbol * 0.6} width={symbol * 1.8} height={symbol * 1.2} rx={symbol * 0.15} fill={fill} stroke={active ? "#fff" : "#09090b"} strokeWidth={stroke * (active ? 5 : 2)} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={symbol * 0.55} fontWeight={800} fill="#09090b">
                          {item.symbol}
                        </text>
                      </>
                    ) : (
                      // Fáze 55: elektrotechnická značka (ČSN EN 60617) s lemem v barvě domovních přístrojů
                      <FloorSymbol item={item} size={symbol} stroke={stroke} active={active} lem={designColor(element.color ?? draft.color)?.swatch ?? null} />
                    )}
                    {element.frameUnits > 1 ? (
                      <text x={symbol * 0.6} y={symbol * 0.75} fontSize={symbol * 0.45} fill="#facc15" fontWeight={700}>
                        {element.frameUnits}R
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
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
              onDelete={() => {
                update((current) => removeElement(current, selected.id));
                setSelectedId(null);
              }}
            />
          ) : null}
          <CablePanel analysis={analysis} mode={draft.mode} pending={pending} onGenerate={generate} />
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

function removeElement(draft: FloorplanDraft, id: string): FloorplanDraft {
  return { ...draft, updatedAt: Date.now(), elements: draft.elements.filter((element) => element.id !== id).map((element) => ({ ...element, controls: element.controls.filter((lightId) => lightId !== id) })) };
}

/** SVG podklad → PNG (createImageBitmap SVG neumí). */
async function rasterizeSvg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = 2400 / Math.max(image.naturalWidth || 1200, image.naturalHeight || 800);
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
  onDelete,
}: {
  draft: FloorplanDraft;
  element: EditorElement;
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
  onDelete: () => void;
}) {
  const item = paletteItem(element.item)!;
  const isPanel = item.kind === "panel";
  const defaultHeight = isPanel ? draft.profile.switchboardHeightMm : item.heightMm ?? mountHeight({ kind: item.kind as Exclude<typeof item.kind, "panel">, variant: item.variant, tag: item.tag }, draft.profile);
  const frameable = item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch";
  const rooms = [...new Set([...draft.rooms.map((room) => room.name), ...draft.elements.map((other) => other.room)])];
  const lights = draft.elements.filter((other) => element.controls.includes(other.id));
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Detail vybraného prvku" data-testid="element-detail">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          <span className="mr-1.5 rounded bg-muted px-1 font-mono text-xs">{item.symbol}</span>
          {item.label}
        </h3>
        <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label="Smazat prvek">
          <Trash2 className="size-4" aria-hidden />
        </button>
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
                {lights.length ? `Ovládá: ${lights.map((light) => `${paletteItem(light.item)?.label} (${light.room}) – řazení ${switchingFor(controllersOf(draft, light.id))}`).join(", ")}` : "Zatím neovládá žádné svítidlo."}
              </p>
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
        <Zap className="size-3" aria-hidden /> Poloha {(element.x / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} / {(element.y / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m
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
