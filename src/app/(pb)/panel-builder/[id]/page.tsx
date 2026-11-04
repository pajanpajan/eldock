import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { RecognitionWorkspace, type WorkspaceItem } from "@/components/panel-builder/RecognitionWorkspace";
import { configFromComponent, parseConfig } from "@/lib/panel-builder/configurator";
import { brandOf } from "@/lib/panel-builder/brands";
import { railCapacities } from "@/lib/panel-builder/rails";
import { vectorDeviceFrom } from "@/lib/panel-builder/vector-symbols";
import { ENCLOSURE_TYPES } from "@/lib/panel-builder/project";
import { getBrandCounts, getPanelProject, getProjectEnclosure } from "@/server/queries/panel-builder";

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

// Pracovní plocha projektu rozváděče – krok 1: čistá fotka, 2D vektorový rozváděč a živý konfigurátor prvku.
export default async function PanelProjectPage({ params }: PageProps<"/panel-builder/[id]">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const { id } = await params;
  const [project, counts] = await Promise.all([getPanelProject(id), getBrandCounts()]);
  if (!project) notFound();
  const pickedEnclosure = await getProjectEnclosure(project.enclosureId);
  // Počty podle karet výrobců (sloučí zápisy „EATON“ / „Eaton“)
  const brandCounts: Record<string, number> = {};
  for (const [manufacturer, count] of Object.entries(counts)) {
    const key = brandOf(manufacturer)?.value ?? manufacturer;
    brandCounts[key] = (brandCounts[key] ?? 0) + count;
  }

  const items: WorkspaceItem[] = project.items.map((item) => ({
    id: item.id,
    designation: item.designation,
    circuitLabel: item.circuitLabel,
    customTypeCode: item.customTypeCode,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    modulesWidth: item.modulesWidth,
    recognitionStatus: item.recognitionStatus,
    confidence: item.confidence,
    rawOcrText: item.rawOcrText,
    detected: parseDetected(item.detectedJson),
    // Uložená konfigurace, jinak odvozená z přiřazeného kusu (prvky z analýzy fotky)
    config: parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null),
    component: item.catalogComponent
      ? {
          id: item.catalogComponent.id,
          manufacturer: item.catalogComponent.manufacturer,
          typeCode: item.catalogComponent.typeCode,
          articleNumber: item.catalogComponent.articleNumber,
          category: item.catalogComponent.category,
          powerLossWatts: item.catalogComponent.powerLossWatts,
          estimated: item.catalogComponent.dataSource === "IEC_ESTIMATE",
        }
      : null,
    device: vectorDeviceFrom(item),
    parentItemId: item.parentItemId,
  }));

  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps projectId={project.id} current="recognition" design={project.designMode === "DESIGN"} />
      <RecognitionWorkspace
        projectId={project.id}
        designMode={project.designMode === "DESIGN" ? "DESIGN" : "PHOTO"}
        photoUrl={project.photoUrl}
        items={items}
        capacities={railCapacities(project)}
        dominant={project.dominantManufacturer}
        coverState={project.coverState}
        brandCounts={brandCounts}
        enclosure={{
          model: project.enclosureModel,
          enclosureId: project.enclosureId,
          label: [ENCLOSURE_TYPES[project.enclosureType], project.enclosureModel].filter(Boolean).join(" – "),
          ipRating: project.ipRating,
          totalModules: pickedEnclosure?.totalModules ?? null,
        }}
        environment={project.environment}
        chipsJson={project.company?.circuitChipsJson ?? null}
      />
    </PageTransition>
  );
}
