import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { PlantDesignerSettings } from "@/components/admin/PlantDesignerSettings";
import { prisma } from "@/lib/prisma";
import { plantAccessWhere } from "@/server/queries/plant";
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
  const [config, plants] = await Promise.all([getModuleConfig(), plantAccessWhere().then((where) => prisma.plant.findMany({ where, orderBy: { name: "asc" }, take: 20, select: { id: true, name: true, designerName: true, designerEmail: true } }))]);

  return (
    <PageTransition>
      <PageHeader
        title="Správa modulů a tarifů"
        description="Eldock Core je součástí každého tarifu. Add-on moduly a jejich funkce zapněte podle zakoupeného tarifu – změna platí okamžitě pro všechny uživatele, data zůstávají uložená."
      />
      <AdminTabs current="/admin/modules" canUsers={account.can("manageUsers")} canModules canData={account.can("manageUsers") && Boolean(account.user.companyId)} />
      {/* Fáze 103: Nastavení závodu – firemní projektant pro překreslení Červenek */}
      <PlantDesignerSettings plants={plants} />
      <ModuleConfigurator initial={config} />
    </PageTransition>
  );
}
