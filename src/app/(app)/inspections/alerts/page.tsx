import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ListChecks } from "lucide-react";

import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { DigestPanel } from "@/components/inspections/DigestPanel";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { brandEnv } from "@/lib/auth";
import { groupDigest } from "@/lib/inspection-digest";
import { inspectionsHref, plannerHref } from "@/lib/routes";
import { getDigestLog, getDigestPreview } from "@/server/queries/notifications";
import { getPlants } from "@/server/queries/plant";
import { requestOrigin } from "@/server/request-url";
import { getFeatures } from "@/server/modules";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Notifikace a hlídač lhůt" };

// Hlídač lhůt revizí: zařízení po termínu, do 14 a do 30 dnů + souhrnné e-mailové avízo vedení závodu.
export default async function InspectionAlertsPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("inspections")) return <NoAccess title="Notifikace a hlídač lhůt" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  if (!(await getFeatures()).on("inspections.alerts")) return <ModuleDisabled feature="inspections.alerts" canManage={account.can("manageModules")} />;
  const plant = plants.find((entry) => entry.id === rememberedId) ?? plants[0];
  if (!plant) return <NoAccess title="Notifikace a hlídač lhůt" current={account.accountType} suggest="PLANT_ADMIN" />;

  const [preview, log] = await Promise.all([getDigestPreview(plant.id, await requestOrigin()), getDigestLog(plant.id)]);
  const groups = groupDigest(preview.items);

  return (
    <PageTransition>
      <PageHeader
        title="Notifikace a hlídač lhůt"
        description={`${plant.name} · zařízení po termínu revize a s koncem platnosti do 14 a 30 dnů; souhrnné avízo pro vedoucího údržby a technického ředitele.`}
        actions={
          <>
            <Button asChild variant="outline" className="touch-target gap-2">
              <Link href={plannerHref}>
                <CalendarRange className="size-4" aria-hidden />
                Plánovač revizí
              </Link>
            </Button>
            <Button asChild variant="outline" className="touch-target gap-2">
              <Link href={inspectionsHref}>
                <ListChecks className="size-4" aria-hidden />
                Přehled revizí
              </Link>
            </Button>
          </>
        }
      />
      <DigestPanel
        plantId={plant.id}
        groups={groups}
        recipients={preview.recipients}
        preview={{ subject: preview.email.subject, html: preview.email.html }}
        log={log}
        smtpConfigured={Boolean(brandEnv("SMTP_URL"))}
        cronConfigured={Boolean(brandEnv("CRON_SECRET"))}
      />
    </PageTransition>
  );
}
