import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ENCLOSURE_TYPES, PROJECT_STATUS } from "@/lib/panel-builder/project";
import { railCapacities } from "@/lib/panel-builder/rails";
import { cn } from "@/lib/utils";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { isGeminiConfigured } from "@/server/services/geminiPanelService";

import { OpenFloorplanButton } from "./floorplan/OpenFloorplanButton";
import { DeleteProjectButton, EditProjectButton } from "./ProjectAdmin";
import { ReportAiErrorButton } from "./ReportAiErrorButton";
import { supplyOf } from "@/lib/panel-builder/supply";

/** Hlavička projektu rozváděče: kód, stav, skříň a štítek demo AI režimu. */
export function ProjectHeader({ project }: { project: PanelProjectDetail }) {
  const status = PROJECT_STATUS[project.status];
  const capacities = railCapacities(project);
  const uniform = new Set(capacities).size === 1;
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
          {project.designMode === "DESIGN" ? <span className="rounded-full border border-sky-500/60 px-2 py-0.5 text-xs text-sky-200">📐 Návrh od nuly</span> : null}
          {project.designMode === "DESIGN" || isGeminiConfigured() ? null : (
            <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground" data-testid="demo-ai-badge">
              <Bot className="size-3.5" aria-hidden /> Demo AI režim (pro živé volání Gemini vložte GEMINI_API_KEY)
            </span>
          )}
        </>
      }
      description={[
        project.customerName,
        project.installationSite ? `📍 ${project.installationSite}` : null,
        // Fáze 55: soustava přívodu (1f / 3f, TN-C-S / TN-S / TT)
        `⚡ ${supplyOf(project).label}`,
        `${ENCLOSURE_TYPES[project.enclosureType]} ${project.enclosureModel || "rozváděč"}`,
        `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`,
        project.ipRating,
        `${capacities.length} DIN ${capacities.length === 1 ? "lišta" : capacities.length <= 4 ? "lišty" : "lišt"} × ${uniform ? capacities[0] : capacities.join("/")} M`,
      ]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <>
          {/* Fáze 64: rozváděč z 2D půdorysu → zpět do editoru půdorysu (uložený půdorys, případně založený z kopie v projektu) */}
          {project.floorplanJson ? <OpenFloorplanButton projectId={project.id} /> : null}
          <Link
            href={`/panel-builder/${project.id}/labels`}
            className="touch-target flex items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:border-primary"
            data-testid="labels-link"
          >
            🏷️ Tisk popisků a štítků (1:1)
          </Link>
          <ReportAiErrorButton projectId={project.id} />
          <EditProjectButton project={{ id: project.id, code: project.code, name: project.name, customerName: project.customerName, installationSite: project.installationSite, status: project.status, supplySystem: supplyOf(project).id }} />
          <DeleteProjectButton project={{ id: project.id, code: project.code, name: project.name, customerName: project.customerName, installationSite: project.installationSite, status: project.status }} variant="full" redirectTo="/panel-builder" />
        </>
      }
    />
  );
}
