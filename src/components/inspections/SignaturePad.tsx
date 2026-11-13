"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Fáze 108: podpisový pad – podpis myší, perem nebo prstem na plátno. Výsledek jako PNG (data URL, průhledné pozadí);
 * prázdné plátno = `null`. Vyhlazení přes střed úseček (kvadratické křivky).
 */
export function SignaturePad({ onChange, className, height = 150 }: { onChange: (png: string | null) => void; className?: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const width = canvas.clientWidth || 520;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#1e3a8a";
  }, [height]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function start(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
    const context = canvasRef.current?.getContext("2d");
    if (!context || !last.current) return;
    context.beginPath();
    context.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    context.fillStyle = "#1e3a8a";
    context.fill();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    const mid = { x: (last.current.x + next.x) / 2, y: (last.current.y + next.y) / 2 };
    context.beginPath();
    context.moveTo(last.current.x, last.current.y);
    context.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    last.current = next;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    strokes.current += 1;
    setEmpty(false);
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative overflow-hidden rounded-lg border border-dashed border-primary/60 bg-white">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          style={{ height }}
          aria-label="Podpisové plátno – podepište se myší nebo prstem"
          role="img"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          data-testid="signature-pad"
          data-empty={empty ? "true" : "false"}
        />
        {empty ? <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-zinc-400">Podepište se zde myší, perem nebo prstem</span> : null}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-zinc-300" aria-hidden />
      </div>
      <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={clear} disabled={empty} data-testid="signature-clear">
        <Eraser className="size-3.5" aria-hidden /> Smazat podpis
      </Button>
    </div>
  );
}
