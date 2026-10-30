"use client";

import { useEffect, useRef, useState } from "react";
import { Blend, ChevronLeft, ChevronRight, Columns2, Eye, EyeOff, Loader2, Maximize, Minus, Plus, ScanSearch, SplitSquareHorizontal } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

import { MarkupOverlay } from "@/components/canvas/MarkupOverlay";
import { ModuleBadge } from "@/components/common/ModuleDisabled";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SchematicFormat } from "@/generated/prisma/enums";
import type { MarkupData } from "@/lib/markup";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH } from "@/lib/mock-graphics/schematic";
import { renderPdfPage } from "@/lib/pdf-client";
import { cn } from "@/lib/utils";
import { DIFF_COLORS, diffCanvasSize, diffPixels } from "@/lib/visual-diff";

export interface CompareSide {
  version: string;
  url: string;
  format: SchematicFormat;
}

type Mode = "side" | "slider" | "diff" | "fade";

const MODES: { value: Mode; label: string; icon: typeof Columns2 }[] = [
  { value: "side", label: "Vedle sebe", icon: Columns2 },
  { value: "slider", label: "Posuvník", icon: SplitSquareHorizontal },
  { value: "diff", label: "Barevný diff", icon: ScanSearch },
  { value: "fade", label: "Prolínání", icon: Blend },
];

const SCHEMATIC_ASPECT = SCHEMATIC_WIDTH / SCHEMATIC_HEIGHT;
const rgb = (color: readonly number[]) => `rgb(${color.join(" ")})`;

/** Obrázek strany porovnání: SVG / obrázek přímo, PDF přes pdf.js (zvolená stránka). */
interface Rendered {
  src: string;
  aspect: number;
  pageCount: number;
}

function useRendered(side: CompareSide | null, page: number) {
  const [state, setState] = useState<{ key: string; value: Rendered | null; error: string | null } | null>(null);
  const key = side ? `${side.url}#${side.format === "PDF" ? page : 1}` : "";

  useEffect(() => {
    if (!side) return;
    let cancelled = false;
    const done = (value: Rendered | null, error: string | null = null) => !cancelled && setState({ key, value, error });
    if (side.format === "PDF") {
      renderPdfPage(side.url, page)
        .then((rendered) => done({ src: rendered.src, aspect: rendered.width / rendered.height, pageCount: rendered.pageCount }))
        .catch(() => done(null, "PDF se nepodařilo vykreslit."));
    } else {
      const img = new Image();
      img.onload = () => done({ src: side.url, aspect: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : SCHEMATIC_ASPECT, pageCount: 1 });
      img.onerror = () => done(null, "Výkres se nepodařilo načíst.");
      img.src = side.url;
    }
    return () => {
      cancelled = true;
    };
  }, [key, side, page]);

  return state?.key === key ? state : null;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Barevný diff: obě strany se vykreslí na stejné plátno a porovnají po pixelech. */
function useDiff(before: Rendered | null, after: Rendered | null, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; src: string; removed: number; added: number; changeRatio: number } | null>(null);
  const key = before && after ? `${before.src}|${after.src}` : "";

  useEffect(() => {
    if (!enabled || !before || !after) return;
    let cancelled = false;
    (async () => {
      const [a, b] = await Promise.all([loadImage(before.src), loadImage(after.src)]);
      const { width, height } = diffCanvasSize(before.aspect);
      const pixels = (img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      };
      const diff = diffPixels(pixels(a), pixels(b));
      const output = document.createElement("canvas");
      output.width = width;
      output.height = height;
      output.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(diff.data), width, height), 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
      if (!cancelled && blob) setResult({ key, src: URL.createObjectURL(blob), removed: diff.removed, added: diff.added, changeRatio: diff.changeRatio });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, enabled, before, after]);

  return result?.key === key ? result : null;
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute right-2 bottom-2 z-10 flex gap-1 rounded-lg border border-border bg-zinc-950/85 p-1 backdrop-blur">
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomIn(0.5)} aria-label="Přiblížit">
        <Plus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomOut(0.5)} aria-label="Oddálit">
        <Minus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => resetTransform()} aria-label="Celý list">
        <Maximize className="size-4" />
      </Button>
    </div>
  );
}

function Sheet({ src, aspect, markup, alt }: { src: string; aspect: number; markup?: MarkupData | null; alt: string }) {
  return (
    <div className="relative w-full bg-white" style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files nebo vykreslené PDF (blob:); SVG přes <img> nespouští skripty */}
      <img src={src} alt={alt} className="absolute inset-0 size-full object-contain" draggable={false} />
      {markup ? <MarkupOverlay markup={markup} aspect={aspect} /> : null}
    </div>
  );
}

function Placeholder({ aspect, error }: { aspect: number; error?: string | null }) {
  return (
    <div className="flex w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500" style={{ aspectRatio: aspect }}>
      {error ?? <Loader2 className="size-6 animate-spin" aria-label="Vykresluji výkres" />}
    </div>
  );
}

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("pointer-events-none absolute top-2 z-10 rounded-md px-2 py-1 font-mono text-xs font-semibold shadow", className)}>{children}</span>
);

/**
 * Porovnání revizí (Visual Diff): vedle sebe se synchronizovaným zoomem (stará verze s červenou,
 * nová se zelenou hlavičkou), překryvný posuvník, barevný diff (odebrané červeně, přidané zeleně)
 * a prolínání. PDF se vykresluje přes pdf.js po stránkách, takže všechny režimy fungují i pro PDF.
 * Zákres technika (jen SVG výkresy) lze zobrazit nad starou verzí.
 */
export function RevisionCompare({
  before,
  after,
  markup,
  labels = ["Platná", "Nová"],
  initialPage = 1,
  advanced = true,
}: {
  before: CompareSide | null;
  after: CompareSide;
  markup: MarkupData | null;
  /** Popisky stran (výchozí „Platná“ / „Nová“ pro schvalování). */
  labels?: [string, string];
  initialPage?: number;
  /** Posuvník, barevný diff a prolínání (modul CAE Advanced); bez něj jen vedle sebe. */
  advanced?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("side");
  const [page, setPage] = useState(initialPage);
  const [showMarkup, setShowMarkup] = useState(!!markup?.strokes.length);
  const [position, setPosition] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const refs = [useRef<ReactZoomPanPinchRef>(null), useRef<ReactZoomPanPinchRef>(null)];
  const syncing = useRef(false);

  const old = useRendered(before, page);
  const now = useRendered(after, page);
  const diff = useDiff(old?.value ?? null, now?.value ?? null, mode === "diff");
  const activeMode: Mode = before && advanced ? mode : "side";
  const pdf = before?.format === "PDF" || after.format === "PDF";
  const pageCount = Math.max(old?.value?.pageCount ?? 1, now?.value?.pageCount ?? 1);
  // Zákres technika je v souřadnicích SVG schématu – nad PDF ho neukazujeme.
  const markupFits = markup?.strokes.length && before?.format !== "PDF";
  const visibleMarkup = showMarkup && markupFits ? markup : null;
  const aspect = old?.value?.aspect ?? now?.value?.aspect ?? SCHEMATIC_ASPECT;

  /** Vedle sebe: posun a zoom jednoho listu se zrcadlí na druhý. */
  function sync(from: 0 | 1, state: { scale: number; positionX: number; positionY: number }) {
    if (syncing.current) return;
    const other = refs[from === 0 ? 1 : 0].current;
    if (!other) return;
    const current = other.state;
    if (current.scale === state.scale && current.positionX === state.positionX && current.positionY === state.positionY) return;
    syncing.current = true;
    other.setTransform(state.positionX, state.positionY, state.scale, 0);
    syncing.current = false;
  }

  const sides = [
    { side: before, rendered: old, label: labels[0], header: "bg-red-600 text-white", ring: "border-red-500/60" },
    { side: after, rendered: now, label: labels[1], header: "bg-emerald-600 text-white", ring: "border-emerald-500/60" },
  ];

  return (
    <div className="space-y-3" data-testid="revision-compare">
      <div className="flex flex-wrap items-center gap-2">
        {before && !advanced ? <ModuleBadge module="CAE_ADVANCED" /> : null}
        {before && advanced ? (
          <ToggleGroup
            type="single"
            value={activeMode}
            onValueChange={(value) => value && setMode(value as Mode)}
            variant="outline"
            spacing={0}
            aria-label="Režim porovnání"
            className="border border-border bg-card/60 p-0.5"
          >
            {MODES.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="touch-target gap-2 rounded-md border-0! px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        {pdf ? (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/60 p-0.5" role="group" aria-label="Stránka výkresu">
            <Button variant="ghost" size="icon" className="touch-target" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Předchozí stránka">
              <ChevronLeft className="size-4" />
            </Button>
            <label className="flex items-center gap-1.5 px-1 text-sm">
              Stránka
              <select value={page} onChange={(event) => setPage(Number(event.target.value))} className="h-9 rounded-md border border-input bg-transparent px-1 font-mono dark:bg-input/30" aria-label="Číslo stránky">
                {Array.from({ length: pageCount }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">/ {pageCount}</span>
            </label>
            <Button variant="ghost" size="icon" className="touch-target" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Další stránka">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
        {markupFits ? (
          <Button variant={showMarkup ? "secondary" : "outline"} className="touch-target ml-auto gap-2" aria-pressed={showMarkup} onClick={() => setShowMarkup((v) => !v)}>
            {showMarkup ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            Zákres technika na {before?.version}
          </Button>
        ) : null}
      </div>

      {activeMode === "side" ? (
        <div className={cn("grid gap-3", before && "md:grid-cols-2")}>
          {sides
            .filter((entry) => entry.side)
            .map(({ side, rendered, label, header, ring }, index) => (
              <figure key={side!.version + label} className={cn("overflow-hidden rounded-xl border-2 bg-white", ring)} data-testid={`compare-side-${index === 0 && before ? "before" : "after"}`}>
                <figcaption className={cn("flex items-center justify-between px-3 py-1.5 text-sm font-semibold", header)}>
                  <span>
                    {label} <span className="font-mono">{side!.version}</span>
                  </span>
                  {pdf ? <span className="font-mono text-xs opacity-90">str. {Math.min(page, rendered?.value?.pageCount ?? page)}</span> : null}
                </figcaption>
                <div className="relative">
                  <TransformWrapper
                    ref={refs[before ? index : 1]}
                    maxScale={8}
                    doubleClick={{ mode: "zoomIn", step: 0.7 }}
                    wheel={{ step: 0.12 }}
                    onTransform={(_, state) => sync((before ? index : 1) as 0 | 1, state)}
                  >
                    <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                      {rendered?.value ? (
                        <Sheet
                          src={rendered.value.src}
                          aspect={rendered.value.aspect}
                          markup={index === 0 && before ? visibleMarkup : null}
                          alt={`Schéma ${side!.version}${index === 0 && visibleMarkup ? " se zákresem technika" : ""}`}
                        />
                      ) : (
                        <Placeholder aspect={aspect} error={rendered?.error} />
                      )}
                    </TransformComponent>
                    <ZoomControls />
                  </TransformWrapper>
                </div>
              </figure>
            ))}
        </div>
      ) : activeMode === "diff" ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-white" data-testid="compare-diff">
            <Label className="left-2 bg-zinc-900 text-zinc-100">
              {before?.version} → {after.version}
            </Label>
            <TransformWrapper maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }}>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                {diff ? <Sheet src={diff.src} aspect={aspect} alt={`Barevný rozdíl ${before?.version} a ${after.version}`} /> : <Placeholder aspect={aspect} error={old?.error ?? now?.error} />}
              </TransformComponent>
              <ZoomControls />
            </TransformWrapper>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" data-testid="diff-legend">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: rgb(DIFF_COLORS.removed) }} /> Odebráno ve {after.version}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: rgb(DIFF_COLORS.added) }} /> Přidáno ve {after.version}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: rgb(DIFF_COLORS.same) }} /> Beze změny
            </span>
            {diff ? (
              <span className="ml-auto font-mono text-muted-foreground" data-testid="diff-stats">
                změna {(diff.changeRatio * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} % kresby
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative mx-auto max-w-[calc((100dvh-12rem)*1.414)] overflow-hidden rounded-xl border border-border bg-white" data-testid="compare-overlay">
            <Label className="left-2 bg-red-600 text-white">
              {labels[0]} {before?.version}
            </Label>
            <Label className="right-2 bg-emerald-600 text-white">
              {labels[1]} {after.version}
            </Label>
            <TransformWrapper maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }} panning={{ excluded: ["compare-handle"] }}>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                {old?.value && now?.value ? (
                  <div className="relative w-full">
                    <Sheet src={old.value.src} aspect={old.value.aspect} markup={visibleMarkup} alt={`Schéma ${before?.version}`} />
                    <div className="absolute inset-0" style={activeMode === "slider" ? { clipPath: `inset(0 0 0 ${position}%)` } : { opacity: opacity / 100 }}>
                      <Sheet src={now.value.src} aspect={old.value.aspect} alt={`Schéma ${after.version}`} />
                    </div>
                    {activeMode === "slider" ? (
                      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${position}%` }} aria-hidden />
                    ) : null}
                  </div>
                ) : (
                  <Placeholder aspect={aspect} error={old?.error ?? now?.error} />
                )}
              </TransformComponent>
              <ZoomControls />
            </TransformWrapper>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 font-mono text-red-300">{before?.version}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={activeMode === "slider" ? position : opacity}
              onChange={(event) => (activeMode === "slider" ? setPosition : setOpacity)(Number(event.target.value))}
              className="compare-handle h-11 flex-1 accent-emerald-500"
              aria-label={activeMode === "slider" ? "Poloha posuvníku mezi revizemi" : "Průhlednost nové revize"}
            />
            <span className="w-20 shrink-0 text-right font-mono text-emerald-300">{after.version}</span>
          </label>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {activeMode === "side"
          ? "Přiblížení a posun se v obou listech pohybují spolu."
          : activeMode === "slider"
            ? "Vlevo od čáry stará revize, vpravo nová. Posuvníkem pod listem měníte hranici."
            : activeMode === "diff"
              ? "Obě verze se vykreslí přes sebe: čáry, které zmizely, jsou červeně, nové čáry zeleně."
              : "Posuvníkem měníte průhlednost nové revize nad starou – změny „problikávají“."}
      </p>
    </div>
  );
}
