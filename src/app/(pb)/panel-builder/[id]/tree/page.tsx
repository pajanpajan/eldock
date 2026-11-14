import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { NextStepBar, PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { TreeEditor } from "@/components/panel-builder/TreeEditor";
import { TreeLinterSummary } from "@/components/panel-builder/TreeLinterSummary";
import { projectLintIssues } from "@/lib/panel-builder/panel-live-checklist";
import { panelPageHref } from "@/lib/panel-builder/panel-phases";
import { treeNodeFrom } from "@/lib/panel-builder/tree";
import { isIncomerFrom } from "@/lib/panel-builder/vector-layout";
import { vectorDeviceFrom } from "@/lib/panel-builder/vector-symbols";
import { railCapacities } from "@/lib/panel-builder/rails";
import { parseRailLayout } from "@/lib/panel-builder/rail-layout";
import { getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/tree">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – strom zapojení` : "Strom zapojení" };
}

// Krok 2: zapojení a hierarchie přímo nad 2D vektorovým rozváděčem (drag & drop, hlavní přívod, modré spojnice).
// Fáze 98: fáze „2. Strom zapojení, Fáze & Linter“ – nad stromem souhrn Elektro-linteru z uloženého projektu.
export default async function PanelTreePage({ params }: PageProps<"/panel-builder/[id]/tree">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps project={project} current="tree" />
      <TreeLinterSummary issues={projectLintIssues(project, project.enclosure?.totalModules ?? null)} fixHref={panelPageHref("recognition", project.id)} />
      <TreeEditor
        projectId={project.id}
        initial={project.items.map(treeNodeFrom)}
        devices={project.items.map(vectorDeviceFrom)}
        incomerFrom={isIncomerFrom(project.incomerFrom) ? project.incomerFrom : "TOP"}
        rails={project.dinRailsCount}
        modulesPerRail={railCapacities(project)}
        simultaneity={project.simultaneityFactor}
        networkSystem={project.networkSystem}
        supplyPhases={project.supplyPhases}
        // Fáze 115: volba hřebenu lišt i ve stromu zapojení (bez hřebenu = jističe s vodiči)
        combs={parseRailLayout(project.railLayoutJson, railCapacities(project).length).combs}
      />
      {/* Fáze 75: výrazný další krok dole na stránce */}
      <NextStepBar project={project} current="tree" />
    </PageTransition>
  );
}
