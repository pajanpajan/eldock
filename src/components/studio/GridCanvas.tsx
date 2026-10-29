"use client";

import type { MouseEvent, ReactNode } from "react";

import { FLOOR_VIEWBOX, formatGridRef, nearestGridPoint, type GridSpec } from "@/lib/cad-grid";

/**
 * Náhled půdorysu v rastru Studia. SVG generuje aplikace (`renderGridFloorplanSvg`) nebo seed,
 * proto inline. Klik vrátí nejbližší průsečík os („B11“). `children` = vrstvy v procentech.
 */
export function GridCanvas({ svg, spec, onPick, children, label }: { svg: string; spec: GridSpec; onPick?: (ref: string) => void; children?: ReactNode; label: string }) {
  function pick(event: MouseEvent<HTMLDivElement>) {
    if (!onPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = nearestGridPoint({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }, spec);
    onPick(formatGridRef(point));
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-border bg-[#0b1220] ${onPick ? "cursor-crosshair" : ""}`}
      style={{ aspectRatio: `${FLOOR_VIEWBOX.width} / ${FLOOR_VIEWBOX.height}` }}
      onClick={pick}
      role={onPick ? "button" : "img"}
      aria-label={label}
      data-testid="studio-grid"
    >
      <div className="absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />
      {children}
    </div>
  );
}
