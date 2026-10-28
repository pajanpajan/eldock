import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageTransition } from "@/components/layout/PageTransition";
import { buildingHref, floorHref, plantHref } from "@/lib/routes";
import { getEquipmentHeader } from "@/server/queries/equipment";

export async function generateMetadata({ params }: PageProps<"/equipment/[id]">): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentHeader(id);
  return { title: equipment?.name ?? "Zařízení" };
}

// Dočasný detail – dokumentaci, bezpečnostní banner a historii doplní fáze 6.
export default async function EquipmentPage({ params }: PageProps<"/equipment/[id]">) {
  const { id } = await params;
  const equipment = await getEquipmentHeader(id);
  if (!equipment) notFound();

  const { floor } = equipment;
  const { building } = floor;

  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <LocationBreadcrumb
            items={[
              { label: building.plant.name, href: plantHref(building.plant.id) },
              { label: building.name, href: buildingHref(building.plant.id, building.id) },
              { label: floor.name, href: floorHref(building.plant.id, building.id, floor.id) },
              { label: equipment.tag },
            ]}
          />
        }
        title={equipment.name}
        description={equipment.description}
        badges={<StatusBadge kind="equipment" status={equipment.status} />}
      />
      <EmptyState
        icon={FileText}
        title="Dokumentaci zařízení připravujeme"
        description="Schéma, kusovník a historie změn se objeví v další etapě vývoje."
      />
    </PageTransition>
  );
}
