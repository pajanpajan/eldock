import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { LabelSheet } from "@/components/panel-builder/LabelSheet";
import { ProjectQrLabelCard } from "@/components/qr/ProjectQrLabelCard";
import { NextStepBar, PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { railCapacities } from "@/lib/panel-builder/rails";
import { vectorDeviceFrom } from "@/lib/panel-builder/vector-symbols";
import { getPanelProject } from "@/server/queries/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/labels">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – popisky a štítky 1:1` : "Popisky rozváděče" };
}

// Tisk samolepicích popisků rozváděče v měřítku 1:1 (fáze 43): pásy nad / pod DIN lišty a štítky na přístroje.
export default async function PanelLabelsPage({ params }: PageProps<"/panel-builder/[id]/labels">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();

  return (
    <PageTransition>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          header, nav, footer, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; display: block !important; }
          .label-sheet { box-shadow: none !important; margin: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-print">
        <ProjectHeader project={project} />
        {/* Fáze 98: štítky = část 4b fáze „4. Dokumentace, Kusovník & Štítky“ */}
        <PanelSteps project={project} current="labels" />
      </div>
      {/* Fáze 103: globálně unikátní QR štítek ELDOCK rozváděče (karta /q/EL-… s uzamčenou dokumentací) */}
      <ProjectQrLabelCard projectId={project.id} serial={project.qrSerial} companyName={project.company?.companyName ?? null} />
      <LabelSheet
        code={project.code}
        name={project.name}
        capacities={railCapacities(project)}
        devices={project.items.map((item) => ({ ...vectorDeviceFrom(item), phaseAssignment: item.phaseAssignment, parentItemId: item.parentItemId }))}
      />
      <NextStepBar project={project} current="labels" />
    </PageTransition>
  );
}
