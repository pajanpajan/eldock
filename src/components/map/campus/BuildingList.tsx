"use client";

import Link from "next/link";
import { ChevronRight, Layers, Wrench } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { BUILDING_TYPE_LABELS, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CampusSize } from "@/lib/campus-layout";
import type { BuildingOverview } from "@/server/queries/plant";

import { BuildingCardActions } from "./BuildingDialogs";

const FLOORS = ["patro", "patra", "pater"] as const;

/**
 * Seznam budov vedle mapy – pro dotyk, čtečky a klávesnici. Fáze 108: s právem Studia u každé karty ✏️ Upravit
 * a 🗑️ Odstranit budovu (mimo odkaz na budovu).
 */
export function BuildingList({
  buildings,
  hoveredId,
  onHover,
  edit = null,
}: {
  buildings: BuildingOverview[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  edit?: { plantId: string; campus: CampusSize } | null;
}) {
  return (
    <ul className="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-1" aria-label="Budovy areálu">
      {buildings.map((building) => (
        <li key={building.id} className="relative" data-testid="building-card" data-building={building.code}>
          <Link
            href={building.href}
            onMouseEnter={() => onHover(building.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(building.id)}
            onBlur={() => onHover(null)}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-xl border bg-card p-3 transition-colors outline-none hover:border-primary/70 focus-visible:ring-3 focus-visible:ring-ring/50",
              hoveredId === building.id ? "border-primary/70" : "border-border",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary font-mono text-lg font-bold text-primary">
              {building.code}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate font-medium">{building.name}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{BUILDING_TYPE_LABELS[building.type]}</span>
                <span className="flex items-center gap-1">
                  <Layers className="size-3.5" aria-hidden />
                  {formatCount(building.floors.length, FLOORS)}
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="size-3.5" aria-hidden />
                  {building.counts.total} zařízení
                </span>
              </div>
              {building.counts.pending || building.counts.waiting ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {building.counts.pending ? (
                    <StatusBadge kind="equipment" status="PENDING_UPDATE" count={building.counts.pending} className="py-0.5" />
                  ) : null}
                  {building.counts.waiting ? (
                    <StatusBadge kind="equipment" status="WAITING_APPROVAL" count={building.counts.waiting} className="py-0.5" />
                  ) : null}
                </div>
              ) : null}
            </div>
            {edit ? <span className="w-[4.5rem] shrink-0" aria-hidden /> : null}
            <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          {edit ? <BuildingCardActions building={building} campus={edit.campus} plantId={edit.plantId} className="absolute top-1/2 right-9 -translate-y-1/2" /> : null}
        </li>
      ))}
    </ul>
  );
}
