import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { EnclosurePicker } from "@/components/panel-builder/EnclosurePicker";
import { ThermalWorkspace } from "@/components/panel-builder/ThermalWorkspace";
import { enclosureNeed } from "@/lib/panel-builder/enclosures";
import { railCapacities } from "@/lib/panel-builder/rails";
import { getEnclosureFans, getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/thermal">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – výpočet oteplení` : "Výpočet oteplení" };
}

// Krok 3: výpočet oteplení dle ČSN EN 61439 / IEC TR 60890 a fázová bilance.
export default async function PanelThermalPage({ params }: PageProps<"/panel-builder/[id]/thermal">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [project, fans] = await Promise.all([getPanelProject((await params).id), getEnclosureFans()]);
  if (!project) notFound();

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps project={project} current="thermal" />
      <ThermalWorkspace
        // Nová skříň z katalogu = nové vstupy (rozměry, materiál, krytí)
        key={project.enclosureId ?? "no-enclosure"}
        projectId={project.id}
        pMaxW={project.enclosurePmaxW}
        enclosureModel={project.enclosureModel}
        fans={fans}
        fan={{ id: project.fanId, count: project.fanCount }}
        enclosurePicker={<EnclosurePicker projectId={project.id} need={enclosureNeed(railCapacities(project), project.items)} current={{ model: project.enclosureModel, enclosureId: project.enclosureId }} />}
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
          supplyPhases: project.supplyPhases,
        }}
        items={project.items.map((item) => ({
          id: item.id,
          designation: item.designation,
          circuitLabel: item.circuitLabel,
          parentItemId: item.parentItemId,
          phaseAssignment: item.phaseAssignment,
          operatingCurrentA: item.operatingCurrentA,
          customTypeCode: item.customTypeCode,
          catalogComponent: item.catalogComponent,
        }))}
      />
    </PageTransition>
  );
}
