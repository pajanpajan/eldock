"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { LayoutChoice, LayoutPreviewDto } from "@/lib/panel-builder/layout-options";
import type { RailLayout } from "@/lib/panel-builder/rail-layout";
import { cn } from "@/lib/utils";
import { applyProjectLayoutAction, previewProjectLayoutsAction, setAllRailCapacitiesAction, setRailFieldsAction } from "@/server/actions/panel-design";

import { SwitchboardLayoutWizardModal } from "./SwitchboardLayoutWizardModal";

/** Šířky „Šířka všech lišt“ (standardní řady rozvodnic). */
export const GLOBAL_RAIL_WIDTHS = [12, 18, 24, 36] as const;

const railsWord = (count: number) => (count === 1 ? "lištu" : count >= 2 && count <= 4 ? "lišty" : "lišt");

/**
 * Fáze 111: horní lišta plátna AI Panel Builderu – výrazné „📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud)“
 * (průvodce se čtyřmi koncepcemi a skutečnými skříněmi), „Šířka všech lišt: 12M | 18M | 24M | 36M“ (přístroje se znovu
 * vyskládají na lišty nové šířky) a „Sloupce (Pole): 1 pole | 2 pole vedle sebe (Silnoproud | Slaboproud)“.
 */
export function RailLayoutToolbar({ projectId, layout, capacities, disabled = false }: { projectId: string; layout: Pick<RailLayout, "fields">; capacities: readonly number[]; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<LayoutPreviewDto | null>(null);
  const uniform = capacities.length && capacities.every((value) => value === capacities[0]) ? capacities[0] : null;
  const busy = pending || disabled;

  function openWizard() {
    startTransition(async () => {
      const result = await previewProjectLayoutsAction(projectId);
      if (!result.ok) return void toast.error(result.error);
      setPreview(result.data);
    });
  }

  function apply(choice: LayoutChoice) {
    startTransition(async () => {
      const result = await applyProjectLayoutAction(projectId, choice);
      if (!result.ok) return void toast.error(result.error);
      setPreview(null);
      const second = result.data.secondId;
      toast.success(`Uspořádáno na ${result.data.rails} ${railsWord(result.data.rails)}${result.data.enclosure ? ` · skříň ${result.data.enclosure}` : ""}${second ? " · slaboproud a Smart Home v novém rozváděči RH2" : ""}.`, second ? { action: { label: "Otevřít RH2", onClick: () => router.push(`/panel-builder/${second}`) } } : undefined);
      router.refresh();
    });
  }

  function setWidth(modules: number) {
    startTransition(async () => {
      const result = await setAllRailCapacitiesAction(projectId, modules);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Všechny lišty ${modules} M – přístroje vyskládané na ${result.data.rails} ${railsWord(result.data.rails)} (skupina chrániče pohromadě, rezerva ~15 %).`);
      router.refresh();
    });
  }

  function setFields(fields: 1 | 2) {
    startTransition(async () => {
      const result = await setRailFieldsAction(projectId, fields);
      if (!result.ok) return void toast.error(result.error);
      toast.success(fields === 2 ? `2 pole vedle sebe: Pole A ${result.data.fieldARails} ${railsWord(result.data.fieldARails)} | Pole B zbytek.` : "Lišty pod sebou v jednom poli.");
      router.refresh();
    });
  }

  const segment = (active: boolean) => cn("min-h-8 rounded-md px-2 font-semibold whitespace-nowrap disabled:opacity-50", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="rail-layout-toolbar">
      <Button type="button" size="sm" className="min-h-8 gap-1.5 font-semibold" onClick={openWizard} disabled={busy} data-testid="layout-wizard-open">
        {pending && !preview ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} [ 📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud) ]
      </Button>
      <div role="group" aria-label="Šířka všech lišt" className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-xs">
        <span className="px-1.5 text-muted-foreground">Šířka všech lišt:</span>
        {GLOBAL_RAIL_WIDTHS.map((modules) => (
          <button key={modules} type="button" disabled={busy} aria-pressed={uniform === modules} onClick={() => setWidth(modules)} className={cn(segment(uniform === modules), "font-mono")} data-testid={`rails-width-${modules}`}>
            {modules}M
          </button>
        ))}
      </div>
      <div role="group" aria-label="Sloupce (Pole)" className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-xs">
        <span className="px-1.5 text-muted-foreground">Sloupce (Pole):</span>
        <button type="button" disabled={busy} aria-pressed={layout.fields === 1} onClick={() => setFields(1)} className={segment(layout.fields === 1)} data-testid="rails-fields-1">
          1 pole
        </button>
        <button type="button" disabled={busy || capacities.length < 2} aria-pressed={layout.fields === 2} onClick={() => setFields(2)} className={segment(layout.fields === 2)} data-testid="rails-fields-2">
          2 pole vedle sebe (Silnoproud | Slaboproud)
        </button>
      </div>
      <SwitchboardLayoutWizardModal preview={preview} onClose={() => setPreview(null)} onConfirm={apply} confirmLabel="📐 Použít uspořádání" busy={pending} context="project" />
    </div>
  );
}
