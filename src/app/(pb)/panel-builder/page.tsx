import type { Metadata } from "next";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { switchboardCharge } from "@/lib/credits/entitlements";
import Link from "next/link";
import { Library } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PanelBuilderPublicLanding } from "@/components/panel-builder/PanelBuilderPublicLanding";
import { NewProjectDialog } from "@/components/panel-builder/NewProjectDialog";
import { RevisionDataImporterModal } from "@/components/revisions/RevisionDataImporterModal";
import { PanelTrainerJobs } from "@/components/panel-builder/PanelTrainerJobs";
import { ProjectBoard, type BoardProject } from "@/components/panel-builder/ProjectBoard";
import { isTrainerPreset, type TrainerPresetId } from "@/lib/panel-builder/panel-trainer-presets";
import { TutorialVideoButton } from "@/components/tutorials/TutorialVideoButton";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/seo";
import { getPanelCompany, requirePanelCompany } from "@/server/panel-session";
import { getPanelProjects } from "@/server/queries/panel-builder";

// Fáze 96: veřejná vstupní stránka (bez přihlášené firmy) je indexovaná – titulek, popis a kanonická URL
const DESCRIPTION = "AI Panel Builder: návrh rozváděče online z fotky i od nuly, Elektro-linter dle ČSN 33 2130 ed. 4, výpočet oteplení IEC TR 60890 a výrobní dokumentace dle ČSN EN IEC 61439 s prohlášením o shodě a štítkem CE.";
export const metadata: Metadata = {
  title: { absolute: "AI Panel Builder – návrh rozváděče online z fotky i od nuly | ELDOCK" },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/panel-builder` },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}/panel-builder`, title: "AI Panel Builder – návrh rozváděče online", description: DESCRIPTION },
};

// AI Panel Builder: projekty rozváděčů (pasportizace z fotky → strom → oteplení → dokumentace).
export default async function PanelBuilderPage() {
  // Fáze 96: nepřihlášený návštěvník (i robot vyhledávače) vidí veřejnou vstupní stránku místo přesměrování
  if (!(await getPanelCompany())) return <PanelBuilderPublicLanding />;
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [projects, company] = await Promise.all([getPanelProjects(), requirePanelCompany()]);
  const board: BoardProject[] = projects.map((project) => {
    const recognition = { VERIFIED: 0, PARTIAL: 0, UNRECOGNIZED: 0 };
    for (const item of project.items) recognition[item.recognitionStatus]++;
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      customerName: project.customerName,
      installationSite: project.installationSite,
      status: project.status,
      items: project.items.length,
      recognition,
      equipmentName: project.equipment?.name ?? null,
    };
  });

  // Fáze 111: cena nového rozváděče – ukázková firma zkušební bez kreditů, jinak zkušební rozváděč / 15 kreditů
  const plan = company.id === TESTER_COMPANY.id ? { label: "Ukázková firma – zkušební rozváděč se zkušebním označením (bez kreditů)", cost: 0 } : switchboardCharge(company);
  const charge = { label: plan.label, cost: plan.cost, balance: company.creditsRemaining, allowed: plan.cost <= company.creditsRemaining };
  // Fáze 92: tréninkové zakázky – nová firma (bez vlastních projektů) je vidí rozbalené; už otevřené se jen znovu otevřou
  const own = projects.filter((project) => !project.trainerPreset).length;
  const opened: Partial<Record<TrainerPresetId, string>> = {};
  for (const project of projects) if (isTrainerPreset(project.trainerPreset) && !opened[project.trainerPreset]) opened[project.trainerPreset] = project.id;

  return (
    <PageTransition>
      <PageHeader
        title="AI Panel Builder"
        description={`${company.companyName} · rozváděče z fotky: rozpoznání přístrojů, strom zapojení, výpočet oteplení dle ČSN EN 61439 a dokumentace s CE štítkem. ${charge.label} (zbývá ${company.creditsRemaining} kreditů).`}
        actions={
          <>
            {/* Fáze 87: video-návod AI Panel Builderu s kapitolami */}
            <TutorialVideoButton tutorialId="panel-builder" size="default" className="touch-target" />
            <Button asChild variant="outline" className="touch-target gap-2">
              <Link href="/panel-builder/catalog">
                <Library className="size-4" aria-hidden /> Katalog prvků
              </Link>
            </Button>
            {/* Fáze 112: rozváděč z okruhů staré revizní zprávy / exportu měřicího přístroje */}
            <RevisionDataImporterModal target={{ kind: "panel" }} />
            <NewProjectDialog charge={charge} />
          </>
        }
      />
      <PanelTrainerJobs initiallyOpen={own === 0} opened={opened} />
      <ProjectBoard projects={board} />
    </PageTransition>
  );
}
