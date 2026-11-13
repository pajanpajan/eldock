import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, FileCheck2, FileSpreadsheet, ScanLine, ShieldCheck } from "lucide-react";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { InspectionOverviewTable } from "@/components/inspections/InspectionOverviewTable";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { SmartRevisionTripOptimizer } from "@/components/inspections/SmartRevisionTripOptimizer";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { pragueToday } from "@/lib/inspection";
import { auditReportHref, inspectionAlertsHref, inspectionImportHref, rapidInspectionHref, ticrReportHref } from "@/lib/routes";
import { getInspectionOverview, getInspectionWatch, getRoomTargets } from "@/server/queries/inspections";
import { RevisionDataImporterModal } from "@/components/revisions/RevisionDataImporterModal";
import { getTripItems } from "@/server/queries/revision-trip";
import { getFeatures } from "@/server/modules";
import { LockedButton } from "@/components/modules/Upsell";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getCurrentUser, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Přehled revizí" };

// Přehled revizí celého závodu (rozváděče, stroje, spotřebiče, nářadí) s hromadným zápisem.
export default async function InspectionsPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("inspections")) return <NoAccess title="Přehled revizí" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  const role = account.definition.workflowRole;
  // Údržba vidí svůj závod, CAE všechny závody.
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  const [items, watch, modules, tripItems] = await Promise.all([
    getInspectionOverview(plant?.id, now, account.types),
    getInspectionWatch(plant?.id, now, account.types),
    getFeatures(),
    // Fáze 108: Chytrá revize – výjezdy po závodech (údržba svůj závod, CAE všechny dostupné)
    getTripItems(plant?.id ?? null, now, account.types),
  ]);

  const canManage = account.can("manageModules");
  // Fáze 112: patra s místnostmi pro import revizních dat (jen s oprávněním zápisu revizí nebo Studia)
  const [importTargets, user] = account.can("recordInspection") || account.can("studio") ? await Promise.all([getRoomTargets(), getCurrentUser()]) : [[], null];

  return (
    <PageTransition>
      <PageHeader
        title="Přehled revizí"
        description={`${plant ? plant.name : "Všechny závody"} · rozváděče a VTZ (NV 190/2022 Sb., příloha č. 4), stroje (NV 378/2001 Sb.), spotřebiče a nářadí (ČSN 33 1600 ed. 2), hromosvody, nouzové osvětlení a CENTRAL STOP, zdravotnické přístroje (ČSN EN 62353 ed. 2) a prostory (ČSN 33 2000-7-710 ed. 2).`}
        actions={
          <>
            {/* Fáze 112: import ze staré revizní zprávy / exportu měřicího přístroje do místnosti budovy */}
            {(account.can("recordInspection") || account.can("studio")) && importTargets.length ? <RevisionDataImporterModal target={{ kind: "floor", floors: importTargets, inspectorName: user?.name ?? null }} triggerClassName="h-10" /> : null}
            {/* Fáze 108: 🛡️ Měsíční report & Ochrana TIČR (pro revizní techniky) */}
            {account.can("recordInspection") ? (
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={ticrReportHref} data-testid="inspections-ticr-link">
                  <ShieldCheck className="size-4" aria-hidden />
                  🛡️ TIČR report
                </Link>
              </Button>
            ) : null}
            {account.can("audit") && modules.on("inspections.audit") ? (
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={auditReportHref}>
                  <FileCheck2 className="size-4" aria-hidden />
                  Auditní report
                </Link>
              </Button>
            ) : account.can("audit") && modules.upsell ? (
              <LockedButton feature="inspections.audit" canManage={canManage} size="lg">
                Auditní report
              </LockedButton>
            ) : null}
            {modules.on("inspections.alerts") ? (
            <Button asChild size="lg" variant="outline" className="touch-target gap-2">
              <Link href={inspectionAlertsHref}>
                <BellRing className="size-4" aria-hidden />
                Hlídač lhůt
              </Link>
            </Button>
            ) : modules.upsell ? (
              <LockedButton feature="inspections.alerts" canManage={canManage} size="lg">
                Hlídač lhůt
              </LockedButton>
            ) : null}
            {(account.can("recordInspection") || account.can("studio")) && modules.on("enterprise.csv_import") ? (
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={inspectionImportHref}>
                  <FileSpreadsheet className="size-4" aria-hidden />
                  Import z CSV
                </Link>
              </Button>
            ) : (account.can("recordInspection") || account.can("studio")) && modules.upsell ? (
              <LockedButton feature="enterprise.csv_import" canManage={canManage} size="lg">
                Import z CSV
              </LockedButton>
            ) : null}
            {account.can("rapid") && modules.on("inspections.planner") ? (
              <Button asChild size="lg" className="touch-target gap-2">
                <Link href={rapidInspectionHref}>
                  <ScanLine className="size-4" aria-hidden />
                  Rychlá revize
                </Link>
              </Button>
            ) : account.can("rapid") && modules.upsell ? (
              <LockedButton feature="inspections.planner" canManage={canManage} size="lg">
                Rychlá revize
              </LockedButton>
            ) : null}
          </>
        }
      />
      <div className="space-y-6">
        <SmartRevisionTripOptimizer items={tripItems} today={pragueToday(now)} canRecord={account.can("recordInspection")} />
        <InspectionWatcher watch={watch} showPlant={!plant} />
        <InspectionOverviewTable items={items} today={pragueToday(now)} showPlant={!plant} canBatchInspect={account.can("recordInspection")} showReports={modules.on("inspections.pdf_reports")} showAudit={account.can("audit") && modules.on("inspections.audit")} />
      </div>
    </PageTransition>
  );
}
