import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ENCLOSURE_TYPES, PROJECT_STATUS } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { isGeminiConfigured } from "@/server/services/geminiPanelService";

/** Hlavička projektu rozváděče: kód, stav, skříň a štítek demo AI režimu. */
export function ProjectHeader({ project }: { project: PanelProjectDetail }) {
  const status = PROJECT_STATUS[project.status];
  return (
    <PageHeader
      breadcrumb={
        <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
        </Link>
      }
      title={
        <>
          <span className="mr-2 font-mono text-primary">{project.code}</span>
          {project.name}
        </>
      }
      badges={
        <>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", status.badge)}>{status.label}</span>
          {isGeminiConfigured() ? null : (
            <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground" data-testid="demo-ai-badge">
              <Bot className="size-3.5" aria-hidden /> Demo AI režim (pro živé volání Gemini vložte GEMINI_API_KEY)
            </span>
          )}
        </>
      }
      description={[
        project.customerName,
        `${ENCLOSURE_TYPES[project.enclosureType]} ${project.enclosureModel || "rozváděč"}`,
        `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`,
        project.ipRating,
        `${project.dinRailsCount} DIN lišty × ${project.modulesPerRail} M`,
      ]
        .filter(Boolean)
        .join(" · ")}
    />
  );
}
