import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { ThermalWorkspace } from "@/components/panel-builder/ThermalWorkspace";
import { getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/thermal">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – výpočet oteplení` : "Výpočet oteplení" };
}

// Krok 3: výpočet oteplení dle ČSN EN 61439 / IEC TR 60890 a fázová bilance.
export default async function PanelThermalPage({ params }: PageProps<"/panel-builder/[id]/thermal">) {
  const guard = await panelBuilderGuard("AI Panel Builder");
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps projectId={project.id} current="thermal" />
      <ThermalWorkspace
        projectId={project.id}
        initialProject={{
          heightMm: project.heightMm,
          widthMm: project.widthMm,
          depthMm: project.depthMm,
          enclosureType: project.enclosureType,
          enclosureMaterial: project.enclosureMaterial,
          ipRating: project.ipRating,
          ambientTempC: project.ambientTempC,
          simultaneityFactor: project.simultaneityFactor,
          internalWiringLossW: project.internalWiringLossW,
        }}
        items={project.items.map((item) => ({
          id: item.id,
          designation: item.designation,
          circuitLabel: item.circuitLabel,
          parentItemId: item.parentItemId,
          phaseAssignment: item.phaseAssignment,
          operatingCurrentA: item.operatingCurrentA,
          catalogComponent: item.catalogComponent,
        }))}
      />
    </PageTransition>
  );
}
