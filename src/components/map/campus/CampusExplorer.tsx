"use client";

import { useState } from "react";

import type { PlantOverview } from "@/server/queries/plant";

import { BuildingList } from "./BuildingList";
import { CampusMap } from "./CampusMap";

/** Mapa areálu a seznam budov se sdíleným zvýrazněním (hover / focus). */
export function CampusExplorer({ plant, legend }: { plant: PlantOverview; legend: React.ReactNode }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3">
        <CampusMap
          plantCode={plant.code}
          viewBox={plant.viewBox}
          buildings={plant.buildings}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
        {legend}
      </div>
      <BuildingList buildings={plant.buildings} hoveredId={hoveredId} onHover={setHoveredId} />
    </div>
  );
}
