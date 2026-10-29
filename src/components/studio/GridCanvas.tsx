"use client";

import { useState, type PointerEvent, type ReactNode } from "react";

import { FLOOR_VIEWBOX, cellAt, formatGridRef, gridToPx, nearestGridPoint, nearestWallPoint, type GridPoint, type GridSpec } from "@/lib/cad-grid";

export type GridCanvasMode = "point" | "cells" | "wall";

interface Props {
  svg: string;
  spec: GridSpec;
  label: string;
  /** point = průsečík os, cells = tažení přes buňky (místnosti), wall = nejbližší bod na obvodové zdi (vrata). */
  mode?: GridCanvasMode;
  /** Klik v režimu point / wall → „B11“. */
  onPick?: (ref: string) => void;
  /** Tažení v režimu cells → první a poslední buňka („B2“, „D6“). */
  onCells?: (from: string, to: string) => void;
  children?: ReactNode;
}

const pct = (point: { x: number; y: number }) => ({ left: `${(point.x / FLOOR_VIEWBOX.width) * 100}%`, top: `${(point.y / FLOOR_VIEWBOX.height) * 100}%` });

/**
 * Náhled půdorysu v rastru Studia. SVG generuje aplikace (`renderGridFloorplanSvg`) nebo seed,
 * proto inline. V režimu `cells` se při tažení myší živě kreslí vybraný obdélník zóny.
 */
export function GridCanvas({ svg, spec, label, mode = "point", onPick, onCells, children }: Props) {
  const [drag, setDrag] = useState<{ start: GridPoint; end: GridPoint } | null>(null);
  const interactive = mode === "cells" ? !!onCells : !!onPick;

  const percentOf = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || event.button !== 0) return;
    if (mode === "cells") {
      const cell = cellAt(percentOf(event), spec);
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ start: cell, end: cell });
      return;
    }
    const point = mode === "wall" ? nearestWallPoint(percentOf(event), spec) : nearestGridPoint(percentOf(event), spec);
    onPick?.(formatGridRef(point));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const cell = cellAt(percentOf(event), spec);
    if (cell.col !== drag.end.col || cell.row !== drag.end.row) setDrag({ ...drag, end: cell });
  }

  function onPointerUp() {
    if (!drag) return;
    onCells?.(formatGridRef(drag.start), formatGridRef(drag.end));
    setDrag(null);
  }

  // Živý obdélník tažení: buňky → osy (pravý dolní roh = další osa)
  const selection = drag
    ? {
        a: gridToPx({ col: Math.min(drag.start.col, drag.end.col), row: Math.min(drag.start.row, drag.end.row) }, spec),
        b: gridToPx({ col: Math.max(drag.start.col, drag.end.col) + 1, row: Math.max(drag.start.row, drag.end.row) + 1 }, spec),
      }
    : null;

  return (
    <div
      className={`relative w-full touch-none overflow-hidden rounded-xl border border-border bg-[#0b1220] select-none ${interactive ? "cursor-crosshair" : ""}`}
      style={{ aspectRatio: `${FLOOR_VIEWBOX.width} / ${FLOOR_VIEWBOX.height}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      role={interactive ? "application" : "img"}
      aria-label={label}
      data-testid="studio-grid"
    >
      <div className="pointer-events-none absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />
      {children}
      {selection && drag ? (
        <div
          className="pointer-events-none absolute border-2 border-yellow-300 bg-yellow-400/25"
          style={{ ...pct(selection.a), width: `${((selection.b.x - selection.a.x) / FLOOR_VIEWBOX.width) * 100}%`, height: `${((selection.b.y - selection.a.y) / FLOOR_VIEWBOX.height) * 100}%` }}
          data-testid="studio-selection"
        >
          <span className="absolute -top-6 left-0 rounded bg-yellow-400 px-1.5 font-mono text-xs font-semibold text-yellow-950">
            {formatGridRef({ col: Math.min(drag.start.col, drag.end.col), row: Math.min(drag.start.row, drag.end.row) })}–
            {formatGridRef({ col: Math.max(drag.start.col, drag.end.col), row: Math.max(drag.start.row, drag.end.row) })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
