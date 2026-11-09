import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { CompanyDevices } from "@/components/sync/CompanyDevices";
import { PlantServerCard } from "@/components/sync/PlantServerCard";
import { getCompanyDevices } from "@/server/queries/sync";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Zařízení firmy" };

// Fáze 70: spárované aplikace (Windows, iOS, Android) všech zaměstnanců registrované firmy – technický ředitel.
export default async function AdminDevicesPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageUsers")) return <NoAccess title="Zařízení firmy" current={account.accountType} suggest="PLANT_ADMIN" />;
  const companyId = account.user.companyId;
  const data = companyId ? await getCompanyDevices(companyId) : null;

  return (
    <PageTransition>
      <PageHeader title="Zařízení firmy" description="Aplikace pro Windows, iPhone a Android spárované zaměstnanci – synchronizace, úpravy z haly a odpojení." />
      <AdminTabs current="/admin/devices" canUsers canModules={account.can("manageModules")} canData={Boolean(companyId)} canDevices={Boolean(companyId)} />
      {data ? (
        <div className="space-y-4">
          <CompanyDevices devices={data.devices} rejected={data.rejected} />
          <PlantServerCard />
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Obchodní demo nepáruje aplikace – aplikace pro Windows, iOS a Android jsou pro účty registrovaných firem.
        </p>
      )}
    </PageTransition>
  );
}
