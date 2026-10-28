"use client";

import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";
import type { FloorOverview } from "@/server/queries/building";

import { floorShortName } from "./IsometricBuilding";

/** Karty pater (shora dolů) – pro dotyk, čtečky a klávesnici. */
export function FloorList({
  floors,
  hoveredId,
  onHover,
}: {
  floors: FloorOverview[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const ordered = [...floors].sort((a, b) => b.level - a.level);
  return (
    <ul className="grid content-start gap-2" aria-label="Patra budovy">
      {ordered.map((floor) => (
        <li key={floor.id}>
          <Link
            href={floor.href}
            onMouseEnter={() => onHover(floor.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(floor.id)}
            onBlur={() => onHover(null)}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-xl border bg-card p-3 transition-colors outline-none hover:border-primary/70 focus-visible:ring-3 focus-visible:ring-ring/50",
              hoveredId === floor.id ? "border-primary/70" : "border-border",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-14 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold",
                floor.level < 0 ? "bg-emerald-950/60 text-emerald-300" : "bg-secondary text-primary",
              )}
            >
              {floorShortName(floor.name)}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate font-medium">{floor.name.split(" - ")[1] ?? floor.name}</div>
              {floor.description ? <div className="text-xs text-muted-foreground">{floor.description}</div> : null}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                <span className="mr-1 flex items-center gap-1">
                  <Wrench className="size-3.5" aria-hidden />
                  {floor.counts.total} zařízení
                </span>
                {floor.counts.pending ? (
                  <StatusBadge kind="equipment" status="PENDING_UPDATE" count={floor.counts.pending} className="py-0.5" />
                ) : null}
                {floor.counts.waiting ? (
                  <StatusBadge kind="equipment" status="WAITING_APPROVAL" count={floor.counts.waiting} className="py-0.5" />
                ) : null}
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
