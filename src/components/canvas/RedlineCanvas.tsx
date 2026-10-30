"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Hand, Highlighter, Maximize, Minus, Pencil, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import type { MarkupStroke } from "@/lib/markup";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH } from "@/lib/mock-graphics/schematic";
import { useDrawingImage } from "@/lib/use-drawing-image";
import { cn } from "@/lib/utils";

type Tool = "pen" | "highlighter" | "eraser";
type Mode = "draw" | "pan";

const PEN = { color: "#ef4444", width: 0.004 };
const HIGHLIGHTER = { color: "#facc15", width: 0.004 };
/** Dosah gumy v px obrazovky. */
const ERASER_RADIUS = 16;
const HISTORY_LIMIT = 50;

/** Tlak: myš a zařízení bez podpory hlásí 0 nebo 0,5 → bereme 0,5 (= základní šířka). */
const pressureOf = (event: PointerEvent | ReactPointerEvent) =>
  event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.5;

/** Vykreslení tahu do canvasu; vzhled odpovídá `MarkupOverlay` (šířka × 4 a průhlednost u zvýrazňovače). */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: MarkupStroke, w: number, h: number) {
  const base = stroke.width * w;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const points = stroke.points;
  if (stroke.tool === "highlighter") {
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = base * 4;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (points.length === 1) ctx.lineTo(points[0][0] * w + 0.1, points[0][1] * h);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = 0.95;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0] * w, points[0][1] * h, base / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Šířka podle tlaku: segment po segmentu (p = 0,5 → základní šířka).
  for (let i = 1; i < points.length; i++) {
    const [x0, y0, p0] = points[i - 1];
    const [x1, y1, p1] = points[i];
    ctx.lineWidth = base * (0.6 + 0.8 * ((p0 + p1) / 2));
    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    ctx.lineTo(x1 * w, y1 * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

interface Props {
  src: string;
  alt: string;
  strokes: MarkupStroke[];
  onChange: (strokes: MarkupStroke[]) => void;
  sheet: number;
  sheetCount: number;
  onSheetChange: (sheet: number) => void;
  /** Podklad je PDF – `sheet` je číslo stránky. */
  pdf?: boolean;
}

/**
 * Redlining: schéma (`<img>`) + `<canvas>` vrstva. Pointer Events (prst, stylus s tlakem, myš),
 * pero / zvýrazňovač / guma (maže celý tah), zpět / znovu, režim Kreslit ↔ Posouvat se zoomem.
 * Souřadnice tahů jsou normalizované 0–1 vůči listu.
 */
export function RedlineCanvas({ src, alt, strokes, onChange, sheet, sheetCount, onSheetChange, pdf = false }: Props) {
  // PDF revize: kreslí se nad stránkou vykreslenou přes pdf.js (list = stránka PDF).
  const image = useDrawingImage(src, pdf ? sheet : null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [mode, setMode] = useState<Mode>("draw");
  const [aspect, setAspect] = useState(SCHEMATIC_WIDTH / SCHEMATIC_HEIGHT);
  const [past, setPast] = useState<MarkupStroke[][]>([]);
  const [future, setFuture] = useState<MarkupStroke[][]>([]);

  // Rozpracovaný tah a poslední známý seznam tahů (handlery nečekají na re-render).
  const current = useRef<MarkupStroke | null>(null);
  const pointerId = useRef<number | null>(null);
  const latest = useRef(strokes);
  const erasing = useRef<{ pushed: boolean } | null>(null);

  useEffect(() => {
    latest.current = strokes;
  }, [strokes]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of latest.current) drawStroke(ctx, stroke, canvas.width, canvas.height);
    if (current.current) drawStroke(ctx, current.current, canvas.width, canvas.height);
  }, []);

  // Rozlišení canvasu = layoutová velikost × devicePixelRatio (ostré čáry i při zoomu 2×).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2) * 2;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(redraw, [strokes, redraw]);

  function commit(next: MarkupStroke[], pushHistory = true) {
    // Snímek musí vzniknout hned – updater setState běží až při renderu, kdy už je `latest` přepsaný.
    const previous = latest.current;
    if (pushHistory) {
      setPast((items) => [...items.slice(-HISTORY_LIMIT + 1), previous]);
      setFuture([]);
    }
    latest.current = next;
    onChange(next);
  }

  function toPoint(event: { clientX: number; clientY: number }, pressure: number): [number, number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000, Math.round(pressure * 100) / 100];
  }

  function eraseAt(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit = (stroke: MarkupStroke) =>
      stroke.points.some(
        ([x, y]) => Math.hypot(x * rect.width - (event.clientX - rect.left), y * rect.height - (event.clientY - rect.top)) <= ERASER_RADIUS,
      );
    const remaining = latest.current.filter((stroke) => !hit(stroke));
    if (remaining.length === latest.current.length) return;
    // Jedno gesto gumy = jeden krok v historii.
    commit(remaining, !erasing.current!.pushed);
    erasing.current!.pushed = true;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (mode !== "draw" || pointerId.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerId.current = event.pointerId;
    if (tool === "eraser") {
      erasing.current = { pushed: false };
      eraseAt(event);
      return;
    }
    const style = tool === "pen" ? PEN : HIGHLIGHTER;
    current.current = { tool, ...style, points: [toPoint(event, pressureOf(event))] };
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== pointerId.current) return;
    if (erasing.current) {
      eraseAt(event);
      return;
    }
    if (!current.current) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const item of events.length ? events : [event.nativeEvent]) {
      current.current.points.push(toPoint(item, pressureOf(item)));
    }
    redraw();
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    erasing.current = null;
    const stroke = current.current;
    current.current = null;
    if (stroke) commit([...latest.current, stroke]);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    const snapshot = latest.current;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [...items, snapshot]);
    commit(previous, false);
  }

  function redo() {
    const next = future.at(-1);
    if (!next) return;
    const snapshot = latest.current;
    setFuture((items) => items.slice(0, -1));
    setPast((items) => [...items, snapshot]);
    commit(next, false);
  }

  const toolButton = (value: Tool, label: string, Icon: typeof Pencil, swatch?: string) => (
    <Button
      variant={tool === value && mode === "draw" ? "default" : "outline"}
      className="h-12 min-w-12 gap-2 px-3 text-sm"
      aria-pressed={tool === value && mode === "draw"}
      onClick={() => {
        setTool(value);
        setMode("draw");
      }}
    >
      <Icon className="size-5" />
      <span className="hidden sm:inline">{label}</span>
      {swatch ? <span className="size-3 rounded-full ring-1 ring-black/40" style={{ background: swatch }} aria-hidden /> : null}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Nástroje zákresu">
        {toolButton("pen", "Červené pero", Pencil, PEN.color)}
        {toolButton("highlighter", "Zvýrazňovač", Highlighter, HIGHLIGHTER.color)}
        {toolButton("eraser", "Guma", Eraser)}
        <Button
          variant={mode === "pan" ? "default" : "outline"}
          className="h-12 min-w-12 gap-2 px-3 text-sm"
          aria-pressed={mode === "pan"}
          onClick={() => setMode((value) => (value === "pan" ? "draw" : "pan"))}
        >
          <Hand className="size-5" />
          <span className="hidden sm:inline">Posouvat</span>
        </Button>
        <span className="mx-1 hidden h-8 w-px bg-border sm:block" aria-hidden />
        <Button variant="outline" size="icon" className="size-12" onClick={undo} disabled={!past.length} aria-label="Zpět">
          <Undo2 className="size-5" />
        </Button>
        <Button variant="outline" size="icon" className="size-12" onClick={redo} disabled={!future.length} aria-label="Znovu">
          <Redo2 className="size-5" />
        </Button>
        <Button
          variant="outline"
          className="h-12 gap-2 px-3 text-sm"
          onClick={() => commit([])}
          disabled={!strokes.length}
          aria-label="Vymazat zákres"
        >
          <Trash2 className="size-5" />
          <span className="hidden sm:inline">Vymazat</span>
        </Button>
        {sheetCount > 1 ? (
          <div className="ml-auto flex gap-1" role="group" aria-label="List schématu">
            {Array.from({ length: sheetCount }, (_, index) => index + 1).map((value) => (
              <Button key={value} variant={value === sheet ? "default" : "outline"} className="h-12 px-3" onClick={() => onSheetChange(value)}>
                List {value}
              </Button>
            ))}
          </div>
        ) : (
          <span className="ml-auto text-sm text-muted-foreground">List 1 / 1</span>
        )}
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-border bg-white"
        // Celý list se vejde nad přilepenou lištu průvodce (tablet na šířku).
        style={{ maxWidth: `calc((100dvh - 17rem) * ${aspect})` }}
      >
        <TransformWrapper
          maxScale={6}
          panning={{ disabled: mode === "draw" }}
          pinch={{ disabled: mode === "draw" }}
          doubleClick={{ disabled: true }}
          wheel={{ step: 0.12 }}
        >
          <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
            <div className="relative w-full" style={{ aspectRatio: aspect }}>
              {image.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- schéma z /api/files nebo vykreslené PDF (blob:); SVG přes <img> nespouští skripty
                <img
                src={image.src}
                alt={alt}
                draggable={false}
                className="absolute inset-0 size-full object-contain select-none"
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight) setAspect(naturalWidth / naturalHeight);
                }}
              />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">{image.error ? "Výkres se nepodařilo vykreslit." : "Vykresluji výkres…"}</span>
              )}
              <canvas
                ref={canvasRef}
                aria-label="Plocha pro zákres – kreslete prstem, perem nebo myší"
                className={cn(
                  "absolute inset-0 size-full",
                  mode === "draw" ? "cursor-crosshair touch-none" : "pointer-events-none",
                  tool === "eraser" && mode === "draw" && "cursor-cell",
                )}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
              />
            </div>
          </TransformComponent>
          <ZoomButtons />
        </TransformWrapper>
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-zinc-950/80 px-2 py-1 text-xs text-zinc-200">
          {mode === "draw" ? "Kroužkem označte místo změny · kolečko myši = zoom" : "Posun tažením · zoom dvěma prsty"}
        </p>
      </div>
    </div>
  );
}

function ZoomButtons() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 right-2 flex gap-1 rounded-xl border border-border bg-zinc-950/90 p-1 shadow-lg">
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomIn(0.5)} aria-label="Přiblížit">
        <Plus className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomOut(0.5)} aria-label="Oddálit">
        <Minus className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => resetTransform()} aria-label="Celý list">
        <Maximize className="size-4" />
      </Button>
    </div>
  );
}
