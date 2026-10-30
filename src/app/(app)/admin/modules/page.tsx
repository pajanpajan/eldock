import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { ModuleConfigurator } from "@/components/admin/ModuleConfigurator";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { getModuleState } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Konfigurace modulů a tarifu" };

// Licenční moduly tenantu: Core je vždy aktivní, add-ony zapíná / vypíná technický ředitel.
export default async function AdminModulesPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageUsers")) return <NoAccess title="Konfigurace modulů a tarifu" current={account.accountType} suggest="PLANT_ADMIN" />;
  const state = await getModuleState();

  return (
    <PageTransition>
      <PageHeader
        title="Konfigurace modulů a tarifu"
        description="Eldock Core je součástí každého tarifu. Add-on moduly zapněte podle zakoupeného tarifu – vypnutý modul se ze všech obrazovek čistě skryje, data zůstávají uložená."
      />
      <AdminTabs current="/admin/modules" />
      <ModuleConfigurator state={state} />
    </PageTransition>
  );
}
