import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { RecognitionWorkspace, type WorkspaceItem } from "@/components/panel-builder/RecognitionWorkspace";
import { parseBox } from "@/lib/panel-builder/layout";
import { getPanelProject, getPickerCatalog } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – ${project.name}` : "Projekt rozváděče" };
}

function parseDetected(json: string | null): WorkspaceItem["detected"] {
  try {
    return json ? (JSON.parse(json) as WorkspaceItem["detected"]) : null;
  } catch {
    return null;
  }
}

// Pracovní plocha projektu rozváděče – krok 1: analýza fotky a Smart Fallback Picker.
export default async function PanelProjectPage({ params }: PageProps<"/panel-builder/[id]">) {
  const guard = await panelBuilderGuard("AI Panel Builder");
  if (guard) return guard;
  const { id } = await params;
  const [project, catalog] = await Promise.all([getPanelProject(id), getPickerCatalog()]);
  if (!project) notFound();

  const items: WorkspaceItem[] = project.items.map((item) => ({
    id: item.id,
    designation: item.designation,
    circuitLabel: item.circuitLabel,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    modulesWidth: item.modulesWidth,
    box: parseBox(item.boundingBoxJson),
    recognitionStatus: item.recognitionStatus,
    confidence: item.confidence,
    rawOcrText: item.rawOcrText,
    detected: parseDetected(item.detectedJson),
    component: item.catalogComponent
      ? { id: item.catalogComponent.id, manufacturer: item.catalogComponent.manufacturer, typeCode: item.catalogComponent.typeCode, category: item.catalogComponent.category, powerLossWatts: item.catalogComponent.powerLossWatts }
      : null,
  }));

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps projectId={project.id} current="recognition" />
      <RecognitionWorkspace
        projectId={project.id}
        photoUrl={project.photoUrl}
        items={items}
        rails={project.dinRailsCount}
        modulesPerRail={project.modulesPerRail}
        catalog={catalog}
        dominant={project.dominantManufacturer}
      />
    </PageTransition>
  );
}
