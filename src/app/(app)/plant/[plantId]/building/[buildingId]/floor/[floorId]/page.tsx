import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocationBreadcrumb, type LocationCrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageTransition } from "@/components/layout/PageTransition";
import { FloorExplorer } from "@/components/map/floorplan/FloorExplorer";
import { buildingHref, floorHref, plantHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getFloorView } from "@/server/queries/floor";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/plant/[plantId]/building/[buildingId]/floor/[floorId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { plantId, buildingId, floorId } = await params;
  const floor = await getFloorView(plantId, buildingId, floorId);
  return { title: floor ? `${floor.building.name} · ${floor.name}` : "Patro" };
}

// Level 3 – půdorys patra s piny zařízení.
export default async function FloorPage({ params }: Props) {
  const { plantId, buildingId, floorId } = await params;
  const account = await getCurrentAccount();
  const floor = await getFloorView(plantId, buildingId, floorId, account.types);
  if (!floor) notFound();

  const { building } = floor;
  const multiFloor = building.floors.length > 1;
  const crumbs: LocationCrumb[] = [
    { label: building.plant.name, href: plantHref(building.plant.id) },
    // Jednopodlažní budova nemá výběr patra – odkaz vede zpět do areálu.
    { label: building.name, href: multiFloor ? buildingHref(plantId, building.id) : plantHref(building.plant.id) },
    { label: floor.name },
  ];
  const pending = floor.equipment.filter((item) => item.status === "PENDING_UPDATE").length;
  const waiting = floor.equipment.filter((item) => item.status === "WAITING_APPROVAL").length;

  return (
    <PageTransition>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={crumbs} />}
        title={floor.name}
        description={[building.name, floor.description].filter(Boolean).join(" · ")}
        badges={
          <>
            {pending ? <StatusBadge kind="equipment" status="PENDING_UPDATE" count={pending} /> : null}
            {waiting ? <StatusBadge kind="equipment" status="WAITING_APPROVAL" count={waiting} /> : null}
          </>
        }
        actions={
          multiFloor ? (
            <nav aria-label="Patra budovy" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
              {building.floors.map((item) => (
                <Link
                  key={item.id}
                  href={floorHref(plantId, building.id, item.id)}
                  aria-current={item.id === floor.id ? "page" : undefined}
                  className={cn(
                    "flex h-10 min-w-14 items-center justify-center rounded-lg px-3 font-mono text-sm",
                    item.id === floor.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={item.name}
                >
                  {item.name.split(" - ")[0]}
                </Link>
              ))}
            </nav>
          ) : null
        }
      />
      <FloorExplorer
        floor={floor}
        showInspections={account.definition.showInspections}
        canBatchInspect={account.can("recordInspection")}
        scopeLabel={account.types ? `${account.definition.label}: ${account.definition.scopeDescription}` : null}
      />
    </PageTransition>
  );
}
