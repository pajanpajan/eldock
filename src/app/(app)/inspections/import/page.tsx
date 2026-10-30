import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { EquipmentImportWizard } from "@/components/inspections/EquipmentImportWizard";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { inspectionsHref } from "@/lib/routes";
import { getImportFloors } from "@/server/queries/inspections";
import { getModuleState } from "@/server/modules";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Hromadný import zařízení" };

// Hromadný import spotřebičů, nářadí a VTZ z CSV / Excelu ve 3 krocích.
export default async function EquipmentImportPage() {
  const [account, floors, rememberedId] = await Promise.all([getCurrentAccount(), getImportFloors(), getRememberedPlantId()]);
  if (!account.can("recordInspection") && !account.can("studio")) return <NoAccess title="Hromadný import zařízení" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  if (!(await getModuleState()).ENTERPRISE_TOOLS) return <ModuleDisabled module="ENTERPRISE_TOOLS" feature="Hromadný import zařízení" canManage={account.can("manageUsers")} />;

  return (
    <PageTransition>
      <PageHeader
        title="Hromadný import zařízení"
        description="Spotřebiče, nářadí a VTZ z CSV nebo Excelu: nahrání, přiřazení do Závod → Budova → Patro a uložení včetně QR kódů."
        actions={
          <Button asChild variant="outline" className="touch-target gap-2">
            <Link href={inspectionsHref}>
              <ListChecks className="size-4" aria-hidden />
              Přehled revizí
            </Link>
          </Button>
        }
      />
      <EquipmentImportWizard floors={floors} defaultPlantId={rememberedId ?? floors[0]?.plantId ?? null} />
    </PageTransition>
  );
}
