import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, FileCheck2, FileSpreadsheet, ScanLine } from "lucide-react";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { InspectionOverviewTable } from "@/components/inspections/InspectionOverviewTable";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { pragueToday } from "@/lib/inspection";
import { auditReportHref, inspectionAlertsHref, inspectionImportHref, rapidInspectionHref } from "@/lib/routes";
import { getInspectionOverview, getInspectionWatch } from "@/server/queries/inspections";
import { getModuleState } from "@/server/modules";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Přehled revizí" };

// Přehled revizí celého závodu (rozváděče, stroje, spotřebiče, nářadí) s hromadným zápisem.
export default async function InspectionsPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("inspections")) return <NoAccess title="Přehled revizí" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  const role = account.definition.workflowRole;
  // Údržba vidí svůj závod, CAE všechny závody.
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  const [items, watch, modules] = await Promise.all([getInspectionOverview(plant?.id, now, account.types), getInspectionWatch(plant?.id, now, account.types), getModuleState()]);

  return (
    <PageTransition>
      <PageHeader
        title="Přehled revizí"
        description={`${plant ? plant.name : "Všechny závody"} · rozváděče a VTZ (ČSN 33 1500), stroje (NV 378/2001 Sb.), spotřebiče a nářadí (ČSN 33 1600 ed. 2), hromosvody a nouzové osvětlení.`}
        actions={
          <>
            {account.can("audit") && modules.INSPECTIONS_PRO ? (
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={auditReportHref}>
                  <FileCheck2 className="size-4" aria-hidden />
                  Auditní report
                </Link>
              </Button>
            ) : null}
            {modules.INSPECTIONS_PRO ? (
            <Button asChild size="lg" variant="outline" className="touch-target gap-2">
              <Link href={inspectionAlertsHref}>
                <BellRing className="size-4" aria-hidden />
                Hlídač lhůt
              </Link>
            </Button>
            ) : null}
            {(account.can("recordInspection") || account.can("studio")) && modules.ENTERPRISE_TOOLS ? (
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={inspectionImportHref}>
                  <FileSpreadsheet className="size-4" aria-hidden />
                  Import z CSV
                </Link>
              </Button>
            ) : null}
            {account.can("rapid") && modules.INSPECTIONS_PRO ? (
              <Button asChild size="lg" className="touch-target gap-2">
                <Link href={rapidInspectionHref}>
                  <ScanLine className="size-4" aria-hidden />
                  Rychlá revize
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="space-y-6">
        <InspectionWatcher watch={watch} showPlant={!plant} />
        <InspectionOverviewTable items={items} today={pragueToday(now)} showPlant={!plant} canBatchInspect={account.can("recordInspection")} showReports={modules.INSPECTIONS_PRO} />
      </div>
    </PageTransition>
  );
}
