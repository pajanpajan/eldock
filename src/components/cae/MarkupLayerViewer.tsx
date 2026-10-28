"use client";

import { useState } from "react";
import { Eye, EyeOff, Maximize, Minus, Plus } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

import { MarkupPreview } from "@/components/equipment/MarkupPreview";
import { Button } from "@/components/ui/button";
import type { MarkupData } from "@/lib/markup";

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute right-2 bottom-2 flex gap-1 rounded-lg border border-border bg-zinc-950/85 p-1 backdrop-blur">
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

/** Schéma revize, nad kterou technik kreslil, s přepínatelnou vrstvou zákresu a zoomem. */
export function MarkupLayerViewer({ src, markup, version }: { src: string; markup: MarkupData | null; version: string }) {
  const [visible, setVisible] = useState(true);
  const strokes = markup?.strokes.length ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Revize <span className="font-mono text-foreground">{version}</span>, list {markup?.sheet ?? 1}
        </span>
        <Button
          variant={visible ? "default" : "outline"}
          className="touch-target ml-auto gap-2"
          aria-pressed={visible}
          disabled={!strokes}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {strokes ? (visible ? "Zákres zobrazen" : "Zákres skryt") : "Bez zákresu"}
        </Button>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-white">
        <TransformWrapper maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }}>
          <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
            <MarkupPreview
              src={src}
              markup={visible ? markup : null}
              alt={`Schéma ${version}${visible && strokes ? " se zákresem technika" : ""}`}
              className="w-full rounded-none"
            />
          </TransformComponent>
          <ZoomControls />
        </TransformWrapper>
      </div>
    </div>
  );
}
