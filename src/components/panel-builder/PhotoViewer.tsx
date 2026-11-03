"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

const MIN = 1;
const MAX = 6;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Čistá referenční fotka rozváděče (fáze 42): žádné rámečky rozpoznání, jen ostrý obraz s
 * přiblížením (kolečko, tlačítka +/−) a posunem tažením – technik z ní pohodlně čte popisky.
 */
export function PhotoViewer({ src }: { src: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [pan, setPan] = useState<{ x: number; y: number; startX: number; startY: number } | null>(null);

  /** Posun omezený tak, aby fotka nikdy neodjela z rámu. */
  function bounded(zoom: number, x: number, y: number) {
    const box = frame.current?.getBoundingClientRect();
    const maxX = box ? (box.width * (zoom - 1)) / 2 : 0;
    const maxY = box ? (box.height * (zoom - 1)) / 2 : 0;
    return { zoom, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }
  const zoomTo = (zoom: number) => setView((current) => bounded(clamp(zoom, MIN, MAX), current.x, current.y));

  // Kolečko myši: nativní posluchač (passive: false), ať zoom fotky neposouvá celou stránku
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      setView((current) => {
        const zoom = clamp(current.zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), MIN, MAX);
        const box = element!.getBoundingClientRect();
        const maxX = (box.width * (zoom - 1)) / 2;
        const maxY = (box.height * (zoom - 1)) / 2;
        return { zoom, x: clamp(current.x, -maxX, maxX), y: clamp(current.y, -maxY, maxY) };
      });
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  function down(event: ReactPointerEvent) {
    if (view.zoom === 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPan({ x: view.x, y: view.y, startX: event.clientX, startY: event.clientY });
  }
  function move(event: ReactPointerEvent) {
    if (!pan) return;
    setView(bounded(view.zoom, pan.x + event.clientX - pan.startX, pan.y + event.clientY - pan.startY));
  }

  return (
    <div className="flex flex-col gap-2" data-testid="panel-photo">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="mr-auto">Referenční fotka – kolečkem nebo tlačítky přiblížit, tažením posunout</span>
        <button type="button" aria-label="Oddálit fotku" onClick={() => zoomTo(view.zoom / 1.4)} disabled={view.zoom <= MIN} className="flex size-8 items-center justify-center rounded-md border border-border hover:text-foreground disabled:opacity-40">
          <ZoomOut className="size-4" aria-hidden />
        </button>
        <span className="w-12 text-center font-mono" data-testid="photo-zoom">
          {Math.round(view.zoom * 100)} %
        </span>
        <button type="button" aria-label="Přiblížit fotku" onClick={() => zoomTo(view.zoom * 1.4)} disabled={view.zoom >= MAX} className="flex size-8 items-center justify-center rounded-md border border-border hover:text-foreground disabled:opacity-40">
          <ZoomIn className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="Celá fotka" onClick={() => setView({ zoom: 1, x: 0, y: 0 })} className="flex size-8 items-center justify-center rounded-md border border-border hover:text-foreground">
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </div>
      <div
        ref={frame}
        className="relative mx-auto w-full max-w-xl touch-none overflow-hidden rounded-xl border border-border bg-black"
        style={{ cursor: view.zoom > 1 ? (pan ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => setPan(null)}
        onPointerCancel={() => setPan(null)}
        onDoubleClick={() => (view.zoom === 1 ? zoomTo(2.5) : setView({ zoom: 1, x: 0, y: 0 }))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fotka z /api/files (SVG i JPG) bez úprav */}
        <img
          src={src}
          alt="Fotka rozváděče"
          draggable={false}
          className="block h-auto w-full origin-center transition-transform duration-75"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        />
      </div>
    </div>
  );
}
