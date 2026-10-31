import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { TreeEditor, type TreeMeta } from "@/components/panel-builder/TreeEditor";
import { treeNodeFrom } from "@/lib/panel-builder/tree";
import { getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/tree">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – strom zapojení` : "Strom zapojení" };
}

// Krok 2: hierarchický strom zapojení s hlídačem, hromadným přiřazením a historií změn.
export default async function PanelTreePage({ params }: PageProps<"/panel-builder/[id]/tree">) {
  const guard = await panelBuilderGuard("AI Panel Builder");
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();

  const meta: Record<string, TreeMeta> = Object.fromEntries(
    project.items.map((item) => [item.id, { typeCode: item.customTypeCode ?? item.catalogComponent?.typeCode ?? (item.rawOcrText ? `? ${item.rawOcrText}` : "nerozpoznáno"), modulesWidth: item.modulesWidth }]),
  );

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps projectId={project.id} current="tree" />
      <TreeEditor
        projectId={project.id}
        initial={project.items.map(treeNodeFrom)}
        meta={meta}
        rails={project.dinRailsCount}
        modulesPerRail={project.modulesPerRail}
        simultaneity={project.simultaneityFactor}
        networkSystem={project.networkSystem}
      />
    </PageTransition>
  );
}
