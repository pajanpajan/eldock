"use client";

import { useMemo, useState } from "react";

import { backupSummary, matchesTenant, tierOf, type BackupFilter, type BackupNode } from "@/lib/power-backup";
import type { PlantOverview } from "@/server/queries/plant";

import { BuildingList } from "./BuildingList";
import { CampusMap } from "./CampusMap";
import { PowerBackupFilter } from "./PowerBackupFilter";

/**
 * Mapa areálu a seznam budov se sdíleným zvýrazněním (hover / focus). Fáze 93: nad mapou filtr větví podle zálohování
 * napájení (síť / DA / UPS · ZIS IT) a hledání nájemní jednotky / oddělení – zvýrazní budovy a páteřní trasy větve.
 */
export function CampusExplorer({ plant, legend, power = [], canEdit = false }: { plant: PlantOverview; legend: React.ReactNode; power?: readonly BackupNode[]; canEdit?: boolean }) {
  // Fáze 108: úprava, přesun a smazání budov (právo Studia výstavby)
  const edit = canEdit ? { plantId: plant.id, campus: plant.campus } : null;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BackupFilter>("ALL");
  const [query, setQuery] = useState("");
  const summary = useMemo(() => backupSummary(power, filter), [power, filter]);
  const highlight = useMemo(() => {
    if (filter === "ALL" && !query.trim()) return null;
    const members = summary.members.filter((node) => matchesTenant(node, query));
    const ids = new Set(query.trim() ? members.map((node) => node.buildingId) : summary.buildingIds);
    const building = new Map(power.map((node) => [node.id, node.buildingId]));
    // Páteřní trasy mezi budovami (zdroj → rozváděč v jiné budově)
    const routes = filter === "ALL" ? [] : summary.trunk.map((edge) => ({ from: building.get(edge.from) ?? "", to: building.get(edge.to) ?? "" })).filter((edge) => edge.from && edge.to && edge.from !== edge.to);
    return { ids, color: filter === "ALL" ? "#fac800" : tierOf(filter).color, routes };
  }, [filter, query, summary, power]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3">
        {power.length ? <PowerBackupFilter nodes={power} summary={summary} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} /> : null}
        <CampusMap
          plantCode={plant.code}
          viewBox={plant.viewBox}
          buildings={plant.buildings}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          highlight={highlight}
          edit={edit}
        />
        {legend}
      </div>
      <BuildingList buildings={plant.buildings} hoveredId={hoveredId} onHover={setHoveredId} edit={edit} />
    </div>
  );
}
