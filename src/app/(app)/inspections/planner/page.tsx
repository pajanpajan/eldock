import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ListChecks } from "lucide-react";

import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { InspectionPlanner } from "@/components/inspections/InspectionPlanner";
import { SmartRevisionTripOptimizer } from "@/components/inspections/SmartRevisionTripOptimizer";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { inspectionAlertsHref, inspectionsHref } from "@/lib/routes";
import { pragueToday } from "@/lib/inspection";
import { getPlannerItems } from "@/server/queries/inspections";
import { getTripItems } from "@/server/queries/revision-trip";
import { getPlants } from "@/server/queries/plant";
import { getFeatures } from "@/server/modules";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Plánovač revizí" };

// Chytrý plánovač revizí: hlasový dispečer, měsíční přehled, tip „přiberte“ a pochůzkový list.
export default async function InspectionPlannerPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("planner")) return <NoAccess title="Plánovač revizí" current={account.accountType} suggest="INSPECTOR_VTZ" />;
  if (!(await getFeatures()).on("inspections.planner")) return <ModuleDisabled feature="inspections.planner" canManage={account.can("manageModules")} />;
  const role = account.definition.workflowRole;
  // Údržba plánuje svůj závod, CAE všechny závody.
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  // Revizní technik VTZ plánuje jen VTZ, technik spotřebičů jen spotřebiče.
  const [items, tripItems] = await Promise.all([getPlannerItems(plant?.id, now, account.types), getTripItems(plant?.id ?? null, now, account.types)]);

  return (
    <PageTransition>
      <PageHeader
        title="Chytrý plánovač revizí"
        description={`${plant ? plant.name : "Všechny závody"} · měsíční přehled, hlasový dispečer a optimalizace pochůzky.`}
        actions={
          <>
            {account.can("inspections") && (await getFeatures()).on("inspections.alerts") ? (
              <Button asChild variant="outline" className="touch-target gap-2">
                <Link href={inspectionAlertsHref}>
                  <BellRing className="size-4" aria-hidden />
                  Notifikace a hlídač lhůt
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="touch-target gap-2">
              <Link href={inspectionsHref}>
                <ListChecks className="size-4" aria-hidden />
                Přehled revizí
              </Link>
            </Button>
          </>
        }
      />
      {/* Fáze 108: Chytrá revize – sloučení výjezdu technika (horizont 30 / 60 / 90 / 180 dnů) */}
      <SmartRevisionTripOptimizer items={tripItems} today={pragueToday(now)} canRecord={account.can("recordInspection")} className="mb-6" />
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
