import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Map as MapIcon } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb, type LocationCrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { buildingHref, plantHref } from "@/lib/routes";
import { getFloorHeader } from "@/server/queries/building";

type Props = PageProps<"/plant/[plantId]/building/[buildingId]/floor/[floorId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { plantId, buildingId, floorId } = await params;
  const floor = await getFloorHeader(plantId, buildingId, floorId);
  return { title: floor ? `${floor.building.name} · ${floor.name}` : "Patro" };
}

// Dočasná stránka – zoomovatelný půdorys s piny doplní fáze 5.
export default async function FloorPage({ params }: Props) {
  const { plantId, buildingId, floorId } = await params;
  const floor = await getFloorHeader(plantId, buildingId, floorId);
  if (!floor) notFound();

  const { building } = floor;
  const crumbs: LocationCrumb[] = [
    { label: building.plant.name, href: plantHref(building.plant.id) },
    // Jednopodlažní budova nemá výběr patra – drobečky vedou rovnou z areálu.
    building._count.floors > 1 ? { label: building.name, href: buildingHref(plantId, building.id) } : { label: building.name },
    { label: floor.name },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={crumbs} />}
        title={floor.name}
        description={`${building.name} · ${floor._count.equipment} zařízení`}
      />
      <EmptyState
        icon={MapIcon}
        title="Půdorys patra připravujeme"
        description="Interaktivní půdorys s piny zařízení se objeví v další etapě vývoje."
      />
    </>
  );
}
