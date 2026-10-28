import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { floorHref, plantHref } from "@/lib/routes";
import { worstEquipmentStatus } from "@/lib/status";
import { getBuilding } from "@/server/queries/building";

type Props = PageProps<"/plant/[plantId]/building/[buildingId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { plantId, buildingId } = await params;
  const building = await getBuilding(plantId, buildingId);
  return { title: building?.name ?? "Budova" };
}

// Dočasný výběr patra – izometrický pohled doplní fáze 4.
export default async function BuildingPage({ params }: Props) {
  const { plantId, buildingId } = await params;
  const building = await getBuilding(plantId, buildingId);
  if (!building) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={
          <LocationBreadcrumb
            items={[{ label: building.plant.name, href: plantHref(building.plant.id) }, { label: building.name }]}
          />
        }
        title={building.name}
        description={building.description}
      />
      <ul className="grid max-w-2xl gap-2" aria-label="Patra budovy">
        {building.floors.map((floor) => {
          const status = worstEquipmentStatus(floor.equipment.map((equipment) => equipment.status));
          return (
            <li key={floor.id}>
              <Link
                href={floorHref(plantId, building.id, floor.id)}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-3 outline-none hover:border-primary/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="w-12 font-mono text-sm text-primary">{floor.code}</span>
                <span className="flex-1 font-medium">{floor.name}</span>
                <span className="text-xs text-muted-foreground">{floor.equipment.length} zařízení</span>
                {status === "ACTIVE" ? null : <StatusBadge kind="equipment" status={status} />}
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
