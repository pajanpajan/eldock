import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { InspectionPlanner } from "@/components/inspections/InspectionPlanner";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { inspectionsHref } from "@/lib/routes";
import { getPlannerItems } from "@/server/queries/inspections";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Plánovač revizí" };

// Chytrý plánovač revizí: hlasový dispečer, měsíční přehled, tip „přiberte“ a pochůzkový list.
export default async function InspectionPlannerPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("planner")) return <NoAccess title="Plánovač revizí" current={account.accountType} suggest="INSPECTOR_VTZ" />;
  const role = account.definition.workflowRole;
  // Údržba plánuje svůj závod, CAE všechny závody.
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  // Revizní technik VTZ plánuje jen VTZ, technik spotřebičů jen spotřebiče.
  const items = await getPlannerItems(plant?.id, now, account.types);

  return (
    <PageTransition>
      <PageHeader
        title="Chytrý plánovač revizí"
        description={`${plant ? plant.name : "Všechny závody"} · měsíční přehled, hlasový dispečer a optimalizace pochůzky.`}
        actions={
          <Button asChild variant="outline" className="touch-target gap-2">
            <Link href={inspectionsHref}>
              <ListChecks className="size-4" aria-hidden />
              Přehled revizí
            </Link>
          </Button>
        }
      />
      <InspectionPlanner
        items={items}
        nowIso={now.toISOString()}
        plantName={plant?.name ?? "Všechny závody"}
        scopeLabel={account.types ? `${account.definition.label}: ${account.definition.scopeDescription}` : null}
        canRapid={account.can("rapid")}
      />
    </PageTransition>
  );
}
