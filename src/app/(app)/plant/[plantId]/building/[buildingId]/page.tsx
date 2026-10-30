import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MousePointerClick } from "lucide-react";

import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusLegend } from "@/components/common/StatusLegend";
import { PageTransition } from "@/components/layout/PageTransition";
import { BuildingExplorer } from "@/components/map/isometric/BuildingExplorer";
import { BUILDING_TYPE_LABELS, formatCount } from "@/lib/format";
import { plantHref } from "@/lib/routes";
import { getBuildingOverview } from "@/server/queries/building";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/plant/[plantId]/building/[buildingId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ plantId, buildingId }, account] = await Promise.all([params, getCurrentAccount()]);
  const building = await getBuildingOverview(plantId, buildingId, account.types);
  return { title: building?.name ?? "Budova" };
}

// Level 2 – 45° izometrický pohled na budovu a výběr patra.
export default async function BuildingPage({ params }: Props) {
  const [{ plantId, buildingId }, account] = await Promise.all([params, getCurrentAccount()]);
  const building = await getBuildingOverview(plantId, buildingId, account.types);
  if (!building) notFound();

  const equipment = building.floors.reduce((sum, floor) => sum + floor.counts.total, 0);

  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <LocationBreadcrumb
            items={[{ label: building.plant.name, href: plantHref(building.plant.id) }, { label: building.name }]}
          />
        }
        title={building.name}
        description={[
          BUILDING_TYPE_LABELS[building.type],
          formatCount(building.floors.length, ["podlaží", "podlaží", "podlaží"]),
          `${equipment} zařízení`,
          building.description,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <BuildingExplorer
        floors={building.floors}
        legend={
          <StatusLegend
            extra={
              <span className="flex items-center gap-2">
                <MousePointerClick className="size-3.5" aria-hidden />
                Vyberte patro – otevře se jeho půdorys
              </span>
            }
          />
        }
      />
    </PageTransition>
  );
}
