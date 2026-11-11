import { Suspense } from "react";

import { PanelLiveChecklist, TrainerCongrats } from "@/components/panel-builder/PanelLiveChecklist";
import { projectLintIssues } from "@/lib/panel-builder/panel-live-checklist";
import { trainerOf } from "@/lib/panel-builder/panel-trainer-presets";
import { getPanelProject } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

/**
 * Fáze 92: rozváděč z trenažéru (tréninková zakázka nebo cvičný bungalov z 2D půdorysu) má na všech krocích živý tahák
 * (pět bodů podle kroků 1–5) a po trenažéru půdorysu gratulaci; vlastní zakázky zůstávají beze změny rozložení. Stav
 * počítá server ze stejných dat jako kroky (Elektro-linter, strom, skříň, oteplení); cizí nebo neexistující projekt řeší
 * stránka kroku (404 / přihlášení).
 */
export default async function PanelProjectLayout({ children, params }: LayoutProps<"/panel-builder/[id]">) {
  const project = await getPanelProject((await params).id);
  const job = trainerOf(project?.trainerPreset);
  if (!project || !job) return children;
  const issues = projectLintIssues(project, project.enclosure?.totalModules ?? null);
  const { thermal, connected } = documentationState(project);
  return (
    <>
      <Suspense fallback={null}>
        <TrainerCongrats />
      </Suspense>
      <PanelLiveChecklist
        projectId={project.id}
        state={{
          lintIssues: issues.length,
          lintFirst: issues[0]?.message ?? null,
          connected,
          enclosure: project.enclosure ? `${project.enclosure.manufacturer} ${project.enclosure.model} (${project.enclosure.totalModules} M)` : project.enclosureModel || null,
          thermalOk: thermal.ok,
          thermalTempC: Number.isFinite(thermal.topTempC) ? thermal.topTempC : null,
        }}
        job={{ icon: job.icon, title: job.title, defect: job.defect, steps: job.steps }}
      />
      {children}
    </>
  );
}
