import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HardHat } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ChangeRequestWizard } from "@/components/change-request/ChangeRequestWizard";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { equipmentHref, floorHref, plantHref } from "@/lib/routes";
import { getEquipmentDetail } from "@/server/queries/equipment";
import { getCurrentRole } from "@/server/session";

type Props = PageProps<"/equipment/[id]/change-request">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);
  return { title: equipment ? `Zadat změnu – ${equipment.tag}` : "Zadat změnu" };
}

// Průvodce „Zadat změnu“ (jen pohled Údržba).
export default async function ChangeRequestPage({ params }: Props) {
  const { id } = await params;
  const [equipment, role] = await Promise.all([getEquipmentDetail(id), getCurrentRole()]);
  if (!equipment) notFound();

  const { floor } = equipment;
  const plantId = floor.building.plant.id;
  const openChange = equipment.changeRequests[0] ?? null;
  const active = equipment.revisions.find((revision) => revision.status === "ACTIVE") ?? null;

  const header = (
    <PageHeader
      breadcrumb={
        <LocationBreadcrumb
          items={[
            { label: floor.building.plant.name, href: plantHref(plantId) },
            { label: floor.name, href: floorHref(plantId, floor.building.id, floor.id) },
            { label: equipment.tag, href: equipmentHref(equipment.id) },
            { label: openChange ? "Doplnit ke změně" : "Zadat změnu" },
          ]}
        />
      }
      title={openChange ? `Doplnit k otevřené změně ${openChange.number}` : `Zadat změnu – ${equipment.tag}`}
      description={equipment.name}
      badges={<StatusBadge kind="equipment" status={equipment.status} />}
    />
  );

  if (role !== "MAINTENANCE") {
    return (
      <>
        {header}
        <EmptyState
          icon={HardHat}
          title="Změny zadává údržba v hale"
          description="Průvodce je určený pro pohled Údržba. Po přepnutí zůstanete na této stránce."
          action={<SwitchRoleButton role="MAINTENANCE" />}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <ChangeRequestWizard
        equipment={{ id: equipment.id, tag: equipment.tag, name: equipment.name }}
        schematic={active ? { url: active.schematicUrl, version: active.version, sheetCount: active.sheetCount } : null}
        openChange={openChange ? { id: openChange.id, number: openChange.number } : null}
      />
    </>
  );
}
