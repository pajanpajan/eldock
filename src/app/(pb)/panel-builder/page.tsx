import type { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { NewProjectDialog } from "@/components/panel-builder/NewProjectDialog";
import { ProjectBoard, type BoardProject } from "@/components/panel-builder/ProjectBoard";
import { Button } from "@/components/ui/button";
import { requirePanelCompany } from "@/server/panel-session";
import { getPanelProjects } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "AI Panel Builder" };

// AI Panel Builder: projekty rozváděčů (pasportizace z fotky → strom → oteplení → dokumentace).
export default async function PanelBuilderPage() {
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

  return (
    <PageTransition>
      <PageHeader
        title="AI Panel Builder"
        description={`${company.companyName} · rozváděče z fotky: rozpoznání přístrojů, strom zapojení, výpočet oteplení dle ČSN EN 61439 a dokumentace s CE štítkem. Nový projekt = 1 kredit (zbývá ${company.creditsRemaining}).`}
        actions={
          <>
            <Button asChild variant="outline" className="touch-target gap-2">
              <Link href="/panel-builder/catalog">
                <Library className="size-4" aria-hidden /> Katalog prvků
              </Link>
            </Button>
            <NewProjectDialog credits={company.creditsRemaining} />
          </>
        }
      />
      <ProjectBoard projects={board} />
    </PageTransition>
  );
}
