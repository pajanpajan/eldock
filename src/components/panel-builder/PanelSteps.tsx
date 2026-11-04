import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";

import { stepProgress, type StepKey } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

export type PanelStep = StepKey;

const STEPS: { key: PanelStep; label: string; href: (id: string) => string }[] = [
  { key: "recognition", label: "1. Analýza fotky", href: (id) => `/panel-builder/${id}` },
  { key: "tree", label: "2. Zapojení a hierarchie", href: (id) => `/panel-builder/${id}/tree` },
  { key: "thermal", label: "3. Výpočet oteplení a bilance", href: (id) => `/panel-builder/${id}/thermal` },
  { key: "documentation", label: "4. Výstupní dokumentace a PDF export", href: (id) => `/panel-builder/${id}/documentation` },
];

/** Kroky pracovní plochy projektu rozváděče se stavem ✓ Hotovo / Rozpracováno (fáze 48). */
export function PanelSteps({ project, current }: { project: PanelProjectDetail; current: PanelStep }) {
  const { connected, thermal } = documentationState(project);
  const done = stepProgress({ items: project.items, status: project.status, connected, thermalOk: thermal.ok });
  const design = project.designMode === "DESIGN";
  return (
    <nav aria-label="Kroky projektu" className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {STEPS.map((step) => (
        <Link
          key={step.key}
          href={step.href(project.id)}
          aria-current={step.key === current ? "page" : undefined}
          data-step={step.key}
          data-done={done[step.key] ? "true" : "false"}
          className={cn(
            "touch-target flex items-center gap-2 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            step.key === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {design && step.key === "recognition" ? "1. Návrh a osazení" : step.label}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              done[step.key] ? (step.key === current ? "bg-primary-foreground/20" : "bg-emerald-500/15 text-emerald-300") : step.key === current ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground",
            )}
          >
            {done[step.key] ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}
            {done[step.key] ? "✓ Hotovo" : "Rozpracováno"}
          </span>
        </Link>
      ))}
    </nav>
  );
}
