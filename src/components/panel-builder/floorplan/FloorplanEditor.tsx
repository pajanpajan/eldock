"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Grid3x3, Link2, Loader2, MousePointer2, Ruler, Square, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTING_MODES, mountHeight, type CableRoutingMode, type ElevationProfile } from "@/engine/floorplan-bridge";
import {
  PALETTE,
  PALETTE_GROUPS,
  analyzeDraft,
  controllersOf,
  emptyDraft,
  paletteItem,
  parseDraft,
  parseLength,
  recalibrate,
  roomAt,
  switchingFor,
  type EditorElement,
  type FloorplanDraft,
} from "@/lib/panel-builder/floorplan-editor";
import { renderPdfPage } from "@/lib/pdf-client";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { createFloorplanProjectAction } from "@/server/actions/panel-projects";

import { CablePanel } from "./CablePanel";

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const update = (change: (current: FloorplanDraft) => FloorplanDraft) => setDraft((current) => ({ ...change(current), updatedAt: Date.now() }));

  const analysis = useMemo(() => {
    try {
      return { ok: true as const, ...analyzeDraft(draft) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Neplatný půdorys." };
    }
  }, [draft]);

  const selected = draft.elements.find((element) => element.id === selectedId) ?? null;
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
      const element: EditorElement = { id: newId(item.kind === "panel" ? "rh" : "e"), item: item.id, x: snap(point.x), y: snap(point.y), room, mountHeightMm: null, frameUnits: 1, series: null, controls: [] };
      update((current) => ({ ...current, elements: [...(item.kind === "panel" ? current.elements.filter((other) => other.item !== "panel") : current.elements), element] }));
      setSelectedId(element.id);
      if (item.kind === "panel") setTool({ kind: "select" });
      return;
    }
    if (tool.kind === "room") {
      svg.current?.setPointerCapture(event.pointerId);
      setRoomDraft({ x: snap(point.x), y: snap(point.y), w: 0, h: 0 });
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
    const point = toPlan(event);
    svg.current?.setPointerCapture(event.pointerId);
    setDrag({ id: element.id, dx: point.x - element.x, dy: point.y - element.y });
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag && !roomDraft) return;
    const point = toPlan(event);
    if (drag) {
      setDraft((current) => ({ ...current, elements: current.elements.map((element) => (element.id === drag.id ? { ...element, x: snap(point.x - drag.dx), y: snap(point.y - drag.dy) } : element)) }));
    }
    if (roomDraft) setRoomDraft({ ...roomDraft, w: snap(point.x) - roomDraft.x, h: snap(point.y) - roomDraft.y });
  }

  function onUp() {
    if (drag) {
      // Přetažením do jiné místnosti se změní i místnost prvku
      update((current) => ({ ...current, elements: current.elements.map((element) => (element.id === drag.id ? { ...element, room: roomAt(current.rooms, element.x, element.y)?.name ?? element.room } : element)) }));
      setDrag(null);
    }
    if (roomDraft) {
      const rect = { x: Math.min(roomDraft.x, roomDraft.x + roomDraft.w), y: Math.min(roomDraft.y, roomDraft.y + roomDraft.h), w: Math.abs(roomDraft.w), h: Math.abs(roomDraft.h) };
      setRoomDraft(null);
      if (rect.w < 500 || rect.h < 500) return;
      const name = window.prompt("Název místnosti:", `Místnost ${draft.rooms.length + 1}`)?.trim();
      if (!name) return;
      lastRoom.current = name;
      update((current) => ({
        ...current,
        rooms: [...current.rooms, { id: newId("m"), name: name.slice(0, 40), ...rect }],
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
        ? "Tažením myší nakreslete obdélník místnosti."
        : tool.kind === "calibrate"
          ? calibration.length
            ? "Klikněte na konec známé stěny / kóty."
            : "📏 Klikněte na začátek známé stěny nebo kóty ve výkresu."
          : tool.kind === "pair"
            ? "🔗 Klikněte na svítidla, která má vypínač ovládat (znovu = odpojit). Esc = hotovo."
            : "Výběr: klik = detail prvku, tažení = přesun, Delete = smazat.";

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
                      title={`${item.label} (${mountHeight({ kind: item.kind === "panel" ? "switch" : item.kind, variant: item.variant, tag: item.tag }, draft.profile)} mm)`}
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
          <div className="flex flex-col gap-1">
            <Label htmlFor="fp-series" className="text-xs font-bold text-muted-foreground">
              Designová řada (výchozí)
            </Label>
            <select id="fp-series" value={draft.series ?? ""} onChange={(event) => update((current) => ({ ...current, series: event.target.value || null }))} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
              <option value="">bez domovních přístrojů</option>
              {series.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
              {draft.rooms.map((room) => (
                <g key={room.id}>
                  <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="rgba(250,204,21,0.04)" stroke="#a1a1aa" strokeWidth={stroke * 2.5} />
                  <text x={room.x + symbol * 0.4} y={room.y + symbol * 1.1} fontSize={symbol * 0.8} fill="#d4d4d8">
                    {room.name} · {(room.w / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} × {(room.h / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m
                  </text>
                </g>
              ))}
              {roomDraft ? <rect x={Math.min(roomDraft.x, roomDraft.x + roomDraft.w)} y={Math.min(roomDraft.y, roomDraft.y + roomDraft.h)} width={Math.abs(roomDraft.w)} height={Math.abs(roomDraft.h)} fill="none" stroke="#facc15" strokeDasharray={`${symbol / 3} ${symbol / 4}`} strokeWidth={stroke * 3} /> : null}

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
                    {isPanel ? <rect x={-symbol * 0.9} y={-symbol * 0.6} width={symbol * 1.8} height={symbol * 1.2} rx={symbol * 0.15} fill={fill} stroke={active ? "#fff" : "#09090b"} strokeWidth={stroke * (active ? 5 : 2)} /> : <circle r={symbol * 0.55} fill={fill} stroke={active ? "#facc15" : "#09090b"} strokeWidth={stroke * (active ? 6 : 2)} />}
                    <text textAnchor="middle" dominantBaseline="central" fontSize={symbol * (item.symbol.length > 2 ? 0.42 : 0.55)} fontWeight={800} fill="#09090b">
                      {item.symbol}
                    </text>
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
          {selected ? (
            <ElementDetail
              key={selected.id}
              draft={draft}
              element={selected}
              series={series}
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
  series,
  pairing,
  onPair,
  onChange,
  onDelete,
}: {
  draft: FloorplanDraft;
  element: EditorElement;
  series: SeriesOption[];
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
  onDelete: () => void;
}) {
  const item = paletteItem(element.item)!;
  const isPanel = item.kind === "panel";
  const defaultHeight = isPanel ? draft.profile.switchboardHeightMm : mountHeight({ kind: item.kind as Exclude<typeof item.kind, "panel">, variant: item.variant, tag: item.tag }, draft.profile);
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
          {item.kind !== "appliance" ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Designová řada
              <select value={element.series ?? ""} onChange={(event) => onChange({ series: event.target.value || null })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Designová řada prvku">
                <option value="">podle nákresu ({series.find((option) => option.key === draft.series)?.label ?? "bez řady"})</option>
                {series.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {item.kind === "switch" ? (
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
