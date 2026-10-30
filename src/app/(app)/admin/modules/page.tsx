import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { ModuleConfigurator } from "@/components/admin/ModuleConfigurator";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { getModuleConfig } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Správa modulů a tarifů" };

// Licenční moduly tenantu: presety tarifů, režim neaktivních funkcí, moduly s podfunkcemi a dopad na role.
export default async function AdminModulesPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageModules")) return <NoAccess title="Správa modulů a tarifů" current={account.accountType} suggest="PLANT_ADMIN" />;
  const config = await getModuleConfig();

  return (
    <PageTransition>
      <PageHeader
        title="Správa modulů a tarifů"
        description="Eldock Core je součástí každého tarifu. Add-on moduly a jejich funkce zapněte podle zakoupeného tarifu – změna platí okamžitě pro všechny uživatele, data zůstávají uložená."
      />
      <AdminTabs current="/admin/modules" canUsers={account.can("manageUsers")} canModules />
      <ModuleConfigurator initial={config} />
    </PageTransition>
  );
}
