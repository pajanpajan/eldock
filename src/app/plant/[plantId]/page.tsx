import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Cpu, Hourglass, MousePointerClick, TriangleAlert } from "lucide-react";

import { KpiTile } from "@/components/common/KpiTile";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusLegend } from "@/components/common/StatusLegend";
import { CampusExplorer } from "@/components/map/campus/CampusExplorer";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { getPlantOverview } from "@/server/queries/plant";

export async function generateMetadata({ params }: PageProps<"/plant/[plantId]">): Promise<Metadata> {
  const { plantId } = await params;
  const plant = await getPlantOverview(plantId);
  return { title: plant?.name ?? "Závod" };
}

// Level 1 – Půdorys areálu.
export default async function PlantPage({ params }: PageProps<"/plant/[plantId]">) {
  const { plantId } = await params;
  const plant = await getPlantOverview(plantId);
  if (!plant) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={[{ label: plant.name }]} />}
        title={plant.name}
        description={[plant.customerName, plant.address, plant.city].filter(Boolean).join(" · ")}
      />

      <section aria-label="Souhrn závodu" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Budovy" value={plant.buildings.length} icon={Building2} />
        <KpiTile label="Zařízení celkem" value={plant.counts.total} icon={Cpu} />
        <KpiTile
          label={EQUIPMENT_STATUS.PENDING_UPDATE.label}
          value={plant.counts.pending}
          hint="Nahlášená změna, výkres zatím neodpovídá"
          icon={TriangleAlert}
          accent={EQUIPMENT_STATUS.PENDING_UPDATE.text}
        />
        <KpiTile
          label={EQUIPMENT_STATUS.WAITING_APPROVAL.label}
          value={plant.counts.waiting}
          hint="Nová revize čeká na potvrzení údržbou"
          icon={Hourglass}
          accent={EQUIPMENT_STATUS.WAITING_APPROVAL.text}
        />
      </section>

      <CampusExplorer
        plant={plant}
        legend={
          <StatusLegend
            extra={
              <span className="flex items-center gap-2">
                <MousePointerClick className="size-3.5" aria-hidden />
                Klikněte na budovu: vícepodlažní → výběr patra, jednopodlažní → půdorys
              </span>
            }
          />
        }
      />
    </>
  );
}
