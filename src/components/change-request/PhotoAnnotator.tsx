"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Circle, Loader2, Pencil, Square, Trash2, Type, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ANNOTATION_COLORS, drawAnnotations, isMeaningful, type AnnotationShape, type AnnotationTool, type Point } from "@/lib/photo-annotation";
import { cn } from "@/lib/utils";

const TOOLS: { value: AnnotationTool; label: string; icon: typeof Pencil }[] = [
  { value: "pen", label: "Tužka", icon: Pencil },
  { value: "arrow", label: "Šipka", icon: ArrowUpRight },
  { value: "rect", label: "Obdélník", icon: Square },
  { value: "ellipse", label: "Zakroužkovat", icon: Circle },
  { value: "text", label: "Text", icon: Type },
];

/**
 * Editor zákresu do fotky: plátno nad fotkou (Pointer Events = myš, prst i pero), tvary v souřadnicích 0–1.
 * „Uložit zákres“ spojí fotku a vrstvu v plném rozlišení do JPEG a předá ho volajícímu k nahrání.
 */
export function PhotoAnnotator({
  imageSrc,
  fileName,
  open,
  onClose,
  onSave,
}: {
  imageSrc: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<AnnotationTool>("ellipse");
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0].value);
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [draft, setDraft] = useState<AnnotationShape | null>(null);
  const [pendingText, setPendingText] = useState<{ at: Point; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [aspect, setAspect] = useState(4 / 3);

  useEffect(() => {
    // Editor se pro každou fotku připojuje znovu (key), stav načtení proto začíná vždy od false.
    if (!open) return;
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setAspect(img.naturalWidth / img.naturalHeight);
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc, open]);

  const redraw = useCallback(() => {
    const element = canvas.current;
    const box = frame.current;
    if (!element || !box) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = box.getBoundingClientRect();
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const ctx = element.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, element.width, element.height);
    drawAnnotations(ctx, draft ? [...shapes, draft] : shapes, element.width, element.height);
  }, [shapes, draft]);

  useEffect(() => {
    redraw();
    const box = frame.current;
    if (!box) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [redraw, ready]);

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
  }

  function commitText() {
    if (pendingText?.value.trim()) setShapes((list) => [...list, { kind: "text", color, at: pendingText.at, text: pendingText.value.trim() }]);
    setPendingText(null);
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const at = point(event);
    if (tool === "text") {
      commitText();
      setPendingText({ at, value: "" });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(tool === "pen" ? { kind: "pen", color, points: [at] } : { kind: tool, color, from: at, to: at });
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const at = point(event);
    setDraft(draft.kind === "pen" ? { ...draft, points: [...draft.points, at] } : draft.kind === "text" ? draft : { ...draft, to: at });
  }

  function onPointerUp() {
    if (draft && isMeaningful(draft)) setShapes((list) => [...list, draft]);
    setDraft(null);
  }

  async function save() {
    const img = image.current;
    if (!img) return;
    setSaving(true);
    try {
      const output = document.createElement("canvas");
      output.width = img.naturalWidth;
      output.height = img.naturalHeight;
      const ctx = output.getContext("2d");
      if (!ctx) throw new Error("Plátno není k dispozici.");
      ctx.drawImage(img, 0, 0);
      // Rozepsaný popisek se uloží také (blur inputu proběhne až po kliknutí).
      const text = pendingText?.value.trim();
      drawAnnotations(ctx, text && pendingText ? [...shapes, { kind: "text", color, at: pendingText.at, text }] : shapes, output.width, output.height);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Zákres se nepodařilo uložit.");
      const base = fileName.replace(/\.[^.]+$/, "") || "fotka";
      await onSave(new File([blob], `${base}-zakres.jpg`, { type: "image/jpeg" }));
      setShapes([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="flex max-h-[96dvh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Zakreslit do fotky</DialogTitle>
          <DialogDescription>Zakroužkujte, šipkou nebo popiskem označte místo změny. CAE projektant uvidí fotku i se zákresem.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Nástroje zákresu">
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {TOOLS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={tool === value ? "default" : "ghost"}
                className="touch-target gap-1.5"
                aria-pressed={tool === value}
                onClick={() => {
                  commitText();
                  setTool(value);
                }}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {ANNOTATION_COLORS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-pressed={color === value}
                aria-label={`Barva ${label}`}
                className={cn("touch-target flex size-9 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50", color === value && "bg-muted ring-2 ring-foreground/60")}
              >
                <span className="size-5 rounded-full border border-black/40" style={{ background: value }} />
              </button>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" className="touch-target gap-1.5" disabled={!shapes.length} onClick={() => setShapes((list) => list.slice(0, -1))}>
            <Undo2 className="size-4" aria-hidden />
            Zpět
          </Button>
          <Button type="button" size="sm" variant="outline" className="touch-target gap-1.5" disabled={!shapes.length} onClick={() => setShapes([])}>
            <Trash2 className="size-4" aria-hidden />
            Vymazat vše
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
          {ready ? (
            <div ref={frame} className="relative max-h-[62dvh] w-full" style={{ aspectRatio: aspect, maxWidth: `calc(62dvh * ${aspect})` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- lokální náhled (blob:) nebo /api/files */}
              <img src={imageSrc} alt="" className="absolute inset-0 size-full select-none" draggable={false} />
              <canvas
                ref={canvas}
                className="absolute inset-0 size-full touch-none"
                style={{ cursor: tool === "text" ? "text" : "crosshair" }}
                data-testid="annotation-canvas"
                aria-label="Plátno zákresu"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
              {pendingText ? (
                <input
                  autoFocus
                  value={pendingText.value}
                  onChange={(event) => setPendingText({ ...pendingText, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitText();
                    if (event.key === "Escape") setPendingText(null);
                  }}
                  onBlur={commitText}
                  maxLength={60}
                  placeholder="Popisek…"
                  aria-label="Text popisku"
                  className="absolute h-9 min-w-40 -translate-y-1/2 rounded-md border-2 bg-zinc-950/85 px-2 text-sm font-bold text-white outline-none"
                  style={{ left: `${pendingText.at[0] * 100}%`, top: `${pendingText.at[1] * 100}%`, borderColor: color }}
                />
              ) : null}
            </div>
          ) : (
            <Loader2 className="m-10 size-8 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="touch-target" onClick={onClose} disabled={saving}>
            Zrušit
          </Button>
          <Button type="button" className="touch-target gap-2" onClick={save} disabled={saving || !ready || (!shapes.length && !pendingText?.value.trim())}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            Uložit zákres
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
