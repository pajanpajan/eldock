import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { DocumentationActions } from "@/components/panel-builder/documentation/DocumentationActions";
import { DocumentationSheets } from "@/components/panel-builder/documentation/DocumentationSheets";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { getPanelProject, getReleaseTargets } from "@/server/queries/panel-builder";
import { requestOrigin } from "@/server/request-url";
import type { StandardEditionId } from "@/lib/legislation-2027";
import { RoutineTestPanel, StandardEditionSelect } from "@/components/panel-builder/documentation/RoutineTestPanel";
import { buildDocumentationData } from "@/server/panel-documentation";
import { EnvironmentConfirm } from "@/components/panel-builder/documentation/EnvironmentConfirm";
import { ENVIRONMENT_BLOCKER } from "@/lib/panel-builder/environments";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/documentation">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – dokumentace rozváděče` : "Dokumentace rozváděče" };
}

// Krok 4: kompletní elaborát rozváděče (6 listů A4) k tisku / PDF a propuštění do provozu.
export default async function PanelDocumentationPage({ params }: PageProps<"/panel-builder/[id]/documentation">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();
  const [targets, origin] = await Promise.all([getReleaseTargets(), requestOrigin()]);

  const { data, blockers: baseBlockers, edition, routineTest } = await buildDocumentationData(project, origin);
  // Fáze 57: bez výslovně zvoleného prostředí dle ČSN 33 2000-5-51 ed. 3 nelze tisknout ani propustit dokumentaci
  const environmentConfirmed = Boolean(project.environmentConfirmedAt);
  const blockers = environmentConfirmed ? baseBlockers : [ENVIRONMENT_BLOCKER, ...baseBlockers];

  return (
    <PageTransition>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          main { padding: 0 !important; max-width: none !important; display: block !important; }
          .no-print { display: none !important; }
          .doc-sheets { display: block !important; gap: 0 !important; }
          .doc-sheet { max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .doc-sheet:last-child { break-after: auto; }
        }
      `}</style>
      <div className="no-print">
        <ProjectHeader project={project} />
        <PanelSteps project={project} current="documentation" />
      </div>
      <div className="flex flex-col gap-6">
        <DocumentationActions
          projectId={project.id}
          released={project.equipment && project.status === "COMPLETED" ? { equipmentId: project.equipment.id, tag: project.equipment.tag, name: project.equipment.name } : null}
          blockers={blockers}
          environmentConfirmed={environmentConfirmed}
          targets={targets.map((target) => ({ id: target.id, tag: target.tag, label: `${target.name} · ${target.floor.building.plant.name}, ${target.floor.building.name}` }))}
        />
        <div className="no-print">
          <EnvironmentConfirm projectId={project.id} environment={project.environment} confirmedAt={project.environmentConfirmedAt} />
        </div>
        <div className="no-print grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-card p-4">
            <StandardEditionSelect projectId={project.id} value={edition.id as StandardEditionId} />
            <p className="mt-2 text-xs text-muted-foreground">Propisuje se do Listu 5 (oteplení) a Listu 6 (EU prohlášení o shodě, štítek CE).</p>
          </div>
          <RoutineTestPanel projectId={project.id} initial={routineTest} />
        </div>
        <DocumentationSheets data={data} />
      </div>
    </PageTransition>
  );
}
