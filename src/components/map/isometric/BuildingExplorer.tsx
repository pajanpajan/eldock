"use client";

import { useState, type ReactNode } from "react";

import type { FloorOverview } from "@/server/queries/building";

import { FloorList } from "./FloorList";
import { IsometricBuilding } from "./IsometricBuilding";

/** Izometrie a seznam pater se sdíleným zvýrazněním (hover / focus). */
export function BuildingExplorer({ floors, legend }: { floors: FloorOverview[]; legend: ReactNode }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3 rounded-xl border border-border bg-[#0c1014] p-3 sm:p-6">
        <IsometricBuilding floors={floors} hoveredId={hoveredId} onHover={setHoveredId} />
        {legend}
      </div>
      <FloorList floors={floors} hoveredId={hoveredId} onHover={setHoveredId} />
    </div>
  );
}
