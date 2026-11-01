"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { MAX_CANVAS_PX, SCALES, canvasWidthPx, scaleBarLength, type DrawingScale } from "@/lib/cad-grid";
import { cn } from "@/lib/utils";

export interface ViewInfo {
  /** Šířka plátna na obrazovce [px]. */
  px: number;
  /** Jednotky viewBoxu na 1 px obrazovky (pro úchyty s konstantní velikostí). */
  unit: number;
}

/** Zoom plátna: skutečné měřítko výkresu, nebo „Celé“ = přizpůsobit šířce okna. */
export type ViewZoom = DrawingScale | "fit";

interface Props {
  /** Šířka celého viewBoxu ve skutečnosti [m]. */
  viewMeters: number;
  viewBox: { width: number; height: number };
  zoom: ViewZoom;
  onZoom: (zoom: ViewZoom) => void;
  label: string;
  testId: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: (view: ViewInfo) => ReactNode;
}

/** Přibližné měřítko pro zobrazení „Celé“ (zaokrouhlené na 1:50 / 1:10). */
const approxScale = (pxPerMeter: number) => {
  const denominator = 96 / 0.0254 / pxPerMeter;
  return Math.round(denominator / (denominator > 500 ? 50 : 10)) * (denominator > 500 ? 50 : 10);
};

/**
 * Plátno Studia ve skutečném měřítku (obrazovka 96 dpi): 1:100 = 1 m na 3,8 cm. Větší měřítko
 * plátno zvětší a zapne posuvníky; „Celé“ plátno přizpůsobí šířce. Grafické měřítko vpravo dole
 * se přepočítává podle zoomu.
 */
export function PlanViewport({ viewMeters, viewBox, zoom, onZoom, label, testId, toolbar, footer, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const center = useRef({ x: 0.5, y: 0.5 });
  const [available, setAvailable] = useState(960);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setAvailable(Math.max(240, element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitted = zoom === "fit" ? null : canvasWidthPx(viewMeters, zoom);
  const px = zoom === "fit" ? available : (fitted ?? MAX_CANVAS_PX);
  const pxPerMeter = px / viewMeters;
  const bar = scaleBarLength(pxPerMeter);

  // Při změně měřítka zůstane střed výřezu na stejném místě výkresu.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = center.current.x * element.scrollWidth - element.clientWidth / 2;
    element.scrollTop = center.current.y * element.scrollHeight - element.clientHeight / 2;
  }, [px]);

  const remember = () => {
    const element = scrollRef.current;
    if (!element || !element.scrollWidth) return;
    center.current = { x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth, y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight };
  };

  const chip = (value: ViewZoom, text: string, enabled = true, title?: string) => (
    <button
      key={value}
      type="button"
      role="radio"
      aria-checked={value === zoom}
      disabled={!enabled}
      title={title}
      onClick={() => onZoom(value)}
      className={cn(
        "h-8 rounded-md px-2.5 font-mono text-xs font-semibold transition-colors disabled:opacity-35",
        value === zoom ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {text}
    </button>
  );

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <div className="ml-auto flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background p-1" role="radiogroup" aria-label="Měřítko zobrazení">
          <span className="px-2 text-xs text-muted-foreground">Měřítko</span>
          {chip("fit", "Celé", true, "Přizpůsobit šířce okna")}
          {SCALES.map((value) => {
            const ok = canvasWidthPx(viewMeters, value) !== null;
            return chip(value, value, ok, ok ? `Zobrazit ve skutečném měřítku ${value}` : `V měřítku ${value} by bylo plátno širší než ${MAX_CANVAS_PX} px`);
          })}
        </div>
      </div>
      <div className="relative">
        <div ref={scrollRef} onScroll={remember} className="max-h-[75vh] overflow-auto rounded-xl border border-border bg-[#0b1220]" data-testid={`${testId}-viewport`}>
          <div
            className="relative mx-auto touch-none select-none"
            style={{ width: px, aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
            role="application"
            aria-label={label}
            data-testid={testId}
            data-scale={zoom}
          >
            {children({ px, unit: viewBox.width / px })}
          </div>
        </div>
        <div
          className="pointer-events-none absolute right-5 bottom-5 rounded-md border border-zinc-700 bg-zinc-950/90 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 shadow-lg"
          data-testid={`${testId}-scalebar`}
        >
          <div className="flex items-end gap-2">
            <svg width={bar.px + 2} height={12} aria-hidden>
              <rect x={1} y={4} width={bar.px / 2} height={5} fill="#e2e8f0" />
              <rect x={1 + bar.px / 2} y={4} width={bar.px / 2} height={5} fill="#0b1220" stroke="#e2e8f0" strokeWidth={1} />
            </svg>
            <span>{String(bar.meters).replace(".", ",")} m</span>
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-400">
            {zoom === "fit" ? `≈ M 1:${approxScale(pxPerMeter)} (celé)` : `M ${zoom}${fitted === null ? " (zmenšeno)" : ""}`} · 1 m = {Math.round(pxPerMeter * 10) / 10} px
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
