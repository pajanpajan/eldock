"use client";

import { useRef, useState } from "react";
import { Blend, Columns2, Eye, EyeOff, Maximize, Minus, Plus, SplitSquareHorizontal } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

import { MarkupOverlay } from "@/components/canvas/MarkupOverlay";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SchematicFormat } from "@/generated/prisma/enums";
import type { MarkupData } from "@/lib/markup";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH } from "@/lib/mock-graphics/schematic";
import { cn } from "@/lib/utils";

export interface CompareSide {
  version: string;
  url: string;
  format: SchematicFormat;
}

type Mode = "side" | "slider" | "fade";

const MODES: { value: Mode; label: string; icon: typeof Columns2 }[] = [
  { value: "side", label: "Vedle sebe", icon: Columns2 },
  { value: "slider", label: "Posuvník", icon: SplitSquareHorizontal },
  { value: "fade", label: "Prolínání", icon: Blend },
];

const ASPECT = SCHEMATIC_WIDTH / SCHEMATIC_HEIGHT;

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

function Sheet({ side, markup, alt }: { side: CompareSide; markup?: MarkupData | null; alt: string }) {
  return (
    <div className="relative w-full bg-white" style={{ aspectRatio: ASPECT }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files; SVG přes <img> nespouští skripty */}
      <img src={side.url} alt={alt} className="absolute inset-0 size-full object-contain" draggable={false} />
      {markup ? <MarkupOverlay markup={markup} aspect={ASPECT} /> : null}
    </div>
  );
}

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("pointer-events-none absolute top-2 z-10 rounded-md px-2 py-1 font-mono text-xs font-semibold shadow", className)}>{children}</span>
);

/**
 * Porovnání platné a nové revize: vedle sebe (synchronizovaný zoom/posun), posuvník a prolínání.
 * Zákres technika lze zobrazit nad starou verzí. PDF se porovnává jen vedle sebe (bez zoomu).
 */
export function RevisionCompare({ before, after, markup }: { before: CompareSide | null; after: CompareSide; markup: MarkupData | null }) {
  const [mode, setMode] = useState<Mode>("side");
  const [showMarkup, setShowMarkup] = useState(!!markup?.strokes.length);
  const [position, setPosition] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const refs = [useRef<ReactZoomPanPinchRef>(null), useRef<ReactZoomPanPinchRef>(null)];
  const syncing = useRef(false);

  const visibleMarkup = showMarkup ? markup : null;
  const hasPdf = before?.format === "PDF" || after.format === "PDF";
  const activeMode: Mode = hasPdf || !before ? "side" : mode;

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

  if (hasPdf || !before) {
    return (
      <div className={cn("grid gap-3", before && "lg:grid-cols-2")}>
        {[before, after].filter((side): side is CompareSide => !!side).map((side, index) => (
          <figure key={side.version} className="space-y-1">
            <figcaption className="text-sm text-muted-foreground">
              {index === 0 && before ? "Platná" : "Nová"} <span className="font-mono text-foreground">{side.version}</span>
            </figcaption>
            {side.format === "PDF" ? (
              <iframe src={side.url} title={`Schéma ${side.version}`} className="aspect-[1.414] w-full rounded-xl border border-border bg-white" />
            ) : (
              <Sheet side={side} alt={`Schéma ${side.version}`} />
            )}
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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
        {markup?.strokes.length ? (
          <Button variant={showMarkup ? "secondary" : "outline"} className="touch-target ml-auto gap-2" aria-pressed={showMarkup} onClick={() => setShowMarkup((v) => !v)}>
            {showMarkup ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            Zákres technika na {before.version}
          </Button>
        ) : null}
      </div>

      {activeMode === "side" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {([before, after] as const).map((side, index) => (
            <div key={side.version} className="relative overflow-hidden rounded-xl border border-border bg-white">
              <Label className={index === 0 ? "left-2 bg-zinc-800 text-zinc-100" : "left-2 bg-sky-500 text-sky-950"}>
                {index === 0 ? "Platná" : "Nová"} {side.version}
              </Label>
              <TransformWrapper
                ref={refs[index]}
                maxScale={8}
                doubleClick={{ mode: "zoomIn", step: 0.7 }}
                wheel={{ step: 0.12 }}
                onTransform={(_, state) => sync(index as 0 | 1, state)}
              >
                <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                  <Sheet side={side} markup={index === 0 ? visibleMarkup : null} alt={`Schéma ${side.version}${index === 0 && visibleMarkup ? " se zákresem technika" : ""}`} />
                </TransformComponent>
                <ZoomControls />
              </TransformWrapper>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative mx-auto max-w-[calc((100dvh-12rem)*1.414)] overflow-hidden rounded-xl border border-border bg-white" data-testid="compare-overlay">
            <Label className="left-2 bg-zinc-800 text-zinc-100">Platná {before.version}</Label>
            <Label className="right-2 bg-sky-500 text-sky-950">Nová {after.version}</Label>
            <TransformWrapper maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }} panning={{ excluded: ["compare-handle"] }}>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                <div className="relative w-full">
                  <Sheet side={before} markup={visibleMarkup} alt={`Schéma ${before.version}`} />
                  <div
                    className="absolute inset-0"
                    style={
                      activeMode === "slider"
                        ? { clipPath: `inset(0 0 0 ${position}%)` }
                        : { opacity: opacity / 100 }
                    }
                  >
                    <Sheet side={after} alt={`Schéma ${after.version}`} />
                  </div>
                  {activeMode === "slider" ? (
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-sky-500 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${position}%` }} aria-hidden />
                  ) : null}
                </div>
              </TransformComponent>
              <ZoomControls />
            </TransformWrapper>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 font-mono text-muted-foreground">{before.version}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={activeMode === "slider" ? position : opacity}
              onChange={(event) => (activeMode === "slider" ? setPosition : setOpacity)(Number(event.target.value))}
              className="compare-handle h-11 flex-1 accent-sky-500"
              aria-label={activeMode === "slider" ? "Poloha posuvníku mezi revizemi" : "Průhlednost nové revize"}
            />
            <span className="w-20 shrink-0 text-right font-mono text-sky-300">{after.version}</span>
          </label>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {activeMode === "side"
          ? "Přiblížení a posun se v obou listech pohybují spolu."
          : activeMode === "slider"
            ? "Vlevo od čáry platná revize, vpravo nová. Posuvníkem pod listem měníte hranici."
            : "Posuvníkem měníte průhlednost nové revize nad platnou – změny „problikávají“."}
      </p>
    </div>
  );
}
