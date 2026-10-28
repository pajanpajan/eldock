import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Cpu, Hourglass, TriangleAlert } from "lucide-react";

import { KpiTile } from "@/components/common/KpiTile";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { getPlantSummary } from "@/server/queries/plant";

export async function generateMetadata({ params }: PageProps<"/plant/[plantId]">): Promise<Metadata> {
  const { plantId } = await params;
  const plant = await getPlantSummary(plantId);
  return { title: plant?.name ?? "Závod" };
}

// Dočasný přehled závodu – interaktivní mapu areálu doplní fáze 3.
export default async function PlantPage({ params }: PageProps<"/plant/[plantId]">) {
  const { plantId } = await params;
  const plant = await getPlantSummary(plantId);
  if (!plant) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={[{ label: plant.name }]} />}
        title={plant.name}
        description={`${plant.customerName}${plant.city ? ` · ${plant.city}` : ""}`}
      />
      <section aria-label="Souhrn závodu" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Budovy" value={plant.buildings} icon={Building2} />
        <KpiTile label="Zařízení" value={plant.equipment} icon={Cpu} />
        <KpiTile
          label={EQUIPMENT_STATUS.PENDING_UPDATE.label}
          value={plant.pending}
          icon={TriangleAlert}
          accent={EQUIPMENT_STATUS.PENDING_UPDATE.text}
        />
        <KpiTile
          label={EQUIPMENT_STATUS.WAITING_APPROVAL.label}
          value={plant.waiting}
          icon={Hourglass}
          accent={EQUIPMENT_STATUS.WAITING_APPROVAL.text}
        />
      </section>
    </>
  );
}
