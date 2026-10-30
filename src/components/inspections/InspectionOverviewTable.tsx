"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDown, Search, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeSearch } from "@/lib/equipment-filter";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount } from "@/lib/format";
import { needsAttention } from "@/lib/inspection";
import { inspectionRuleFor } from "@/lib/inspection-rules";
import { MAP_LAYERS, layerOf, type LayerKey } from "@/lib/map-layers";
import { equipmentHref, inspectionReportHref } from "@/lib/routes";
import { INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { InspectionOverviewItem } from "@/server/queries/inspections";

import { BatchInspectionBar } from "./BatchInspectionBar";
import { InspectionStatusBadge } from "./InspectionStatusBadge";

/** Přehled revizí: filtr skupiny, ⚠️ jen k řešení, hledání a výběr pro hromadnou revizi. */
export function InspectionOverviewTable({
  items,
  today,
  showPlant,
  canBatchInspect = true,
}: {
  items: InspectionOverviewItem[];
  today: string;
  showPlant: boolean;
  /** Hromadná revize (checkboxy a lišta) – jen účty, které zapisují revize. */
  canBatchInspect?: boolean;
}) {
  const [layer, setLayer] = useState<LayerKey | "ALL">("ALL");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  const q = normalizeSearch(query);
  const visible = items.filter(
    (item) =>
      (layer === "ALL" || layerOf(item.type) === layer) &&
      (!attentionOnly || needsAttention(item.summary.state)) &&
      (!q || normalizeSearch(`${item.tag} ${item.name} ${item.location} ${item.assignedZone ?? ""}`).includes(q)),
  );
  const attention = items.filter((item) => needsAttention(item.summary.state)).length;
  const allChecked = visible.length > 0 && visible.every((item) => checked.has(item.id));

  function toggle(ids: string[], on: boolean) {
    setChecked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const chip = (active: boolean) =>
    cn(
      "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat tag, název, místnost" aria-label="Hledat zařízení" className="h-11 pl-9" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Skupina zařízení">
          <button type="button" aria-pressed={layer === "ALL"} className={chip(layer === "ALL")} onClick={() => setLayer("ALL")}>
            Vše <span className="font-mono text-xs">{items.length}</span>
          </button>
          {MAP_LAYERS.map((entry) => (
            <button key={entry.key} type="button" aria-pressed={layer === entry.key} className={chip(layer === entry.key)} onClick={() => setLayer(entry.key)}>
              {entry.label}
              <span className="font-mono text-xs">{items.filter((item) => layerOf(item.type) === entry.key).length}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={attentionOnly}
          onClick={() => setAttentionOnly((value) => !value)}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            attentionOnly ? "border-amber-400 bg-amber-500 text-amber-950" : "border-amber-500/50 bg-amber-500/10 text-amber-300",
          )}
        >
          <TriangleAlert className="size-4" aria-hidden />
          Jen propadlé / končící <span className="font-mono text-xs">{attention}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="size-5 accent-primary align-middle"
                  checked={allChecked}
                  onChange={() => toggle(visible.map((item) => item.id), !allChecked)}
                  aria-label="Vybrat vše pro hromadnou revizi"
                />
              </TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Název</TableHead>
              <TableHead className="hidden lg:table-cell">Umístění</TableHead>
              <TableHead className="hidden md:table-cell">Norma · lhůta</TableHead>
              <TableHead>Stav revize</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Revizní zpráva</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Filtru neodpovídá žádné zařízení.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((item) => {
                const Icon = EQUIPMENT_TYPE_ICONS[item.type];
                const rule = inspectionRuleFor(item);
                const isChecked = checked.has(item.id);
                return (
                  <TableRow key={item.id} className={cn("h-12", isChecked && "bg-primary/5")}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-5 accent-primary align-middle"
                        checked={isChecked}
                        onChange={() => toggle([item.id], !isChecked)}
                        aria-label={`Vybrat ${item.tag} pro hromadnou revizi`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={equipmentHref(item.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                        {item.tag}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <span className="flex items-center gap-1.5">
                        <Icon className={cn("size-4 shrink-0", INSPECTION_STATE[item.summary.state].text)} aria-hidden />
                        <span className="truncate">{item.name.replace(`${item.tag} - `, "")}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{EQUIPMENT_TYPE_LABELS[item.type]}</span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {showPlant ? `${item.plantName} › ` : ""}
                      {item.assignedZone ?? item.location}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell" title={rule.basis}>
                      {rule.standard} · {formatCount(item.inspectionIntervalMonths, ["měsíc", "měsíce", "měsíců"])}
                    </TableCell>
                    <TableCell>
                      <InspectionStatusBadge summary={item.summary} />
                    </TableCell>
                    <TableCell>
                      {item.reportId ? (
                        <Button asChild variant="ghost" size="icon" className="touch-target" title="Generovat revizní zprávu (PDF)">
                          <a href={inspectionReportHref(item.reportId)} target="_blank" rel="noopener" aria-label={`Generovat revizní zprávu (PDF) – ${item.tag}`}>
                            <FileDown className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {canBatchInspect ? <BatchInspectionBar items={items.filter((item) => checked.has(item.id))} today={today} onClear={() => setChecked(new Set())} /> : null}
    </div>
  );
}
