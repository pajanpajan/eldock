import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { EnclosureLockBanner } from "@/components/panel-builder/EnclosureLockBanner";
import { EnclosureWorkspace } from "@/components/panel-builder/EnclosureWorkspace";
import { TurnkeyEntry } from "@/components/panel-builder/manufacturing/TurnkeyEntry";
import { brandLabel } from "@/lib/panel-builder/enclosure-choice";
import { NextStepBar, PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { enclosureNeed } from "@/lib/panel-builder/enclosures";
import { environmentOf } from "@/lib/panel-builder/environments";
import { railCapacities } from "@/lib/panel-builder/rails";
import { getEnclosureCatalog, getPanelProject } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/enclosure">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – skříň rozváděče` : "Skříň rozváděče" };
}

// Fáze 75: krok 3 – výběr skříně rozváděče (mezi zapojením a výpočtem oteplení – skříň je vstupem oteplení).
export default async function PanelEnclosurePage({ params }: PageProps<"/panel-builder/[id]/enclosure">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [project, catalog] = await Promise.all([getPanelProject((await params).id), getEnclosureCatalog()]);
  if (!project) notFound();
  const capacities = railCapacities(project);
  const need = enclosureNeed(capacities, project.items);
  const railUsed = capacities.map((_, index) => Math.round(project.items.filter((item) => item.dinRailIndex === index + 1).reduce((sum, item) => sum + item.modulesWidth, 0)));
  const environment = environmentOf(project.environment);
  const { thermal } = documentationState(project);
  return (
    <PageTransition>
      <ProjectHeader project={project} />
      <PanelSteps project={project} current="enclosure" />
      {/* Fáze 85: skříň zvolená při zakládání – omezení lišt a jeho uvolnění */}
      {project.enclosureFixed && project.enclosure ? <EnclosureLockBanner projectId={project.id} title={`${brandLabel(project.enclosure.manufacturer)} ${project.enclosure.model}`} rows={project.enclosure.rows} modulesPerRow={project.enclosure.modulesPerRow} /> : null}
      <EnclosureWorkspace
        projectId={project.id}
        need={need}
        railUsed={railUsed}
        catalog={catalog.map((row) => ({ id: row.id, manufacturer: row.manufacturer, series: row.series, model: row.model, articleNumber: row.articleNumber, rows: row.rows, modulesPerRow: row.modulesPerRow, totalModules: row.totalModules, widthMm: row.widthMm, heightMm: row.heightMm, depthMm: row.depthMm, ipRating: row.ipRating, installation: row.installation, material: row.material, pMaxW: row.pMaxW, dataSource: row.dataSource }))}
        current={{ model: project.enclosureModel, enclosureId: project.enclosureId }}
        minIp={environment.minIp}
        recommendedIp={environment.recommendedIp}
        lossW={project.items.length ? Math.round(thermal.totalLossW * 10) / 10 : null}
        preferredManufacturer={project.dominantManufacturer}
      />
      {/* Fáze 106: poptávka / objednávka výroby rozváděče na klíč u certifikovaného výrobce ELDOCK */}
      <TurnkeyEntry project={project} variant="button" />
      <NextStepBar project={project} current="enclosure" />
    </PageTransition>
  );
}
