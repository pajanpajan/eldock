import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { NextStepBar, PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { TreeEditor } from "@/components/panel-builder/TreeEditor";
import { treeNodeFrom } from "@/lib/panel-builder/tree";
import { isIncomerFrom } from "@/lib/panel-builder/vector-layout";
import { vectorDeviceFrom } from "@/lib/panel-builder/vector-symbols";
import { railCapacities } from "@/lib/panel-builder/rails";
import { getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/tree">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – strom zapojení` : "Strom zapojení" };
}

// Krok 2: zapojení a hierarchie přímo nad 2D vektorovým rozváděčem (drag & drop, hlavní přívod, modré spojnice).
export default async function PanelTreePage({ params }: PageProps<"/panel-builder/[id]/tree">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps project={project} current="tree" />
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
      />
      {/* Fáze 75: výrazný další krok dole na stránce */}
      <NextStepBar project={project} current="tree" />
    </PageTransition>
  );
}
