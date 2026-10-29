"use client";

import { useEffect, useRef, type Ref, type RefObject } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformEffect,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import type { FloorEquipment } from "@/server/queries/floor";

import { EquipmentPin } from "./EquipmentPin";
import { PowerSpiderOverlay } from "./PowerSpiderOverlay";

export const MAX_ZOOM = 8;

interface Props {
  svg: string;
  viewBox: { width: number; height: number };
  equipment: FloorEquipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  apiRef: Ref<ReactZoomPanPinchRef>;
  /** „⚡ Pavouk napájení“ – spojnice rozváděč → napájená zařízení. */
  spider?: boolean;
  /** Zobrazovat výstrahy revizí na pinech (CAE ne). */
  showInspections?: boolean;
}

/** Level 3 – zoomovatelný a posouvatelný půdorys (inline SVG ze seedu) s vrstvou pinů. */
export function FloorplanViewer({ svg, viewBox, equipment, selectedId, onSelect, apiRef, spider = false, showInspections = true }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const ratio = viewBox.width / viewBox.height;

  return (
    <div
      ref={frameRef}
      tabIndex={0}
      role="region"
      aria-label="Půdorys patra – klávesy + a − přiblíží, šipky posouvají, 0 zobrazí celé patro"
      className="relative mx-auto w-full overflow-hidden rounded-xl border border-border bg-[#0b1220] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}`, maxWidth: `calc((100dvh - 9rem) * ${ratio})` }}
    >
      <TransformWrapper
        ref={apiRef}
        minScale={1}
        maxScale={MAX_ZOOM}
        limitToBounds
        doubleClick={{ mode: "zoomIn", step: 0.7 }}
        wheel={{ step: 0.12 }}
        panning={{ excluded: ["pin-button"] }}
      >
        <ScaleSync contentRef={contentRef} zoomLabelRef={zoomLabelRef} />
        <KeyboardControls frameRef={frameRef} />
        <TransformComponent wrapperClass="!size-full" contentClass="!size-full">
          <div ref={contentRef} className="relative size-full max-sm:[--pin-scale:0.6]">
            {/* Půdorys generuje seed (viz PLAN sekce A – bezpečnost SVG), proto inline. */}
            <div className="absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />
            {spider ? <PowerSpiderOverlay items={equipment} viewBox={viewBox} /> : null}
            {equipment.map((item) => (
              <EquipmentPin key={item.id} equipment={item} selected={item.id === selectedId} onSelect={onSelect} showInspections={showInspections} />
            ))}
          </div>
        </TransformComponent>
        <ZoomControls zoomLabelRef={zoomLabelRef} />
      </TransformWrapper>
    </div>
  );
}

/** Promítá aktuální zoom do CSS proměnné (protiškálování pinů) a do popisku – bez re-renderu. */
function ScaleSync({
  contentRef,
  zoomLabelRef,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  zoomLabelRef: RefObject<HTMLSpanElement | null>;
}) {
  useTransformEffect(({ state }) => {
    contentRef.current?.style.setProperty("--inv-scale", String(1 / state.scale));
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(state.scale * 100)} %`;
  });
  return null;
}

const PAN_STEP = 80;

/** Ovládání půdorysu z klávesnice, když má fokus rám mapy (ne pin): + / − / 0 a šipky. */
function KeyboardControls({ frameRef }: { frameRef: RefObject<HTMLDivElement | null> }) {
  const { zoomIn, zoomOut, resetTransform, setTransform, instance } = useControls();
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target !== frame || event.altKey || event.ctrlKey || event.metaKey) return;
      const { positionX, positionY, scale } = instance.state;
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [PAN_STEP, 0],
        ArrowRight: [-PAN_STEP, 0],
        ArrowUp: [0, PAN_STEP],
        ArrowDown: [0, -PAN_STEP],
      };
      if (event.key === "+" || event.key === "=") zoomIn(0.5);
      else if (event.key === "-") zoomOut(0.5);
      else if (event.key === "0") resetTransform();
      else if (pan[event.key]) setTransform(positionX + pan[event.key][0], positionY + pan[event.key][1], scale, 150);
      else return;
      event.preventDefault();
    }
    frame.addEventListener("keydown", onKeyDown);
    return () => frame.removeEventListener("keydown", onKeyDown);
  }, [frameRef, instance, zoomIn, zoomOut, resetTransform, setTransform]);
  return null;
}

function ZoomControls({ zoomLabelRef }: { zoomLabelRef: RefObject<HTMLSpanElement | null> }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-1 rounded-xl border border-border bg-zinc-950/90 p-1 shadow-lg backdrop-blur">
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomIn(0.5)} aria-label="Přiblížit">
        <Plus className="size-5" />
      </Button>
      <span ref={zoomLabelRef} className="font-mono text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
        100 %
      </span>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomOut(0.5)} aria-label="Oddálit">
        <Minus className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => resetTransform()} aria-label="Zobrazit celé patro">
        <Maximize className="size-4" />
      </Button>
    </div>
  );
}
