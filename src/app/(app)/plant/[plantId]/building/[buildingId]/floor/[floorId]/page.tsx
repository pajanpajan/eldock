import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocationBreadcrumb, type LocationCrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageTransition } from "@/components/layout/PageTransition";
import { BuildingHeaderActions } from "@/components/map/campus/BuildingDialogs";
import { FloorExplorer } from "@/components/map/floorplan/FloorExplorer";
import { SmartRevisionTripOptimizer } from "@/components/inspections/SmartRevisionTripOptimizer";
import { pragueToday } from "@/lib/inspection";
import { getTripItems } from "@/server/queries/revision-trip";
import { buildingHref, floorHref, plantHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getFeatures } from "@/server/modules";
import { getFloorView } from "@/server/queries/floor";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/plant/[plantId]/building/[buildingId]/floor/[floorId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ plantId, buildingId, floorId }, account] = await Promise.all([params, getCurrentAccount()]);
  const floor = await getFloorView(plantId, buildingId, floorId, account.types);
  return { title: floor ? `${floor.building.name} · ${floor.name}` : "Patro" };
}

// Level 3 – půdorys patra s piny zařízení.
export default async function FloorPage({ params }: Props) {
  const [{ plantId, buildingId, floorId }, account, modules] = await Promise.all([params, getCurrentAccount(), getFeatures()]);
  const floor = await getFloorView(plantId, buildingId, floorId, account.types);
  if (!floor) notFound();
  // Fáze 108: budova a zařízení patra jdou upravit / smazat s právem Studia výstavby
  const canEdit = account.can("studio") && modules.on("enterprise.studio");
  const now = new Date();
  const showTrip = account.definition.showInspections && !account.definition.fieldView;
  const tripItems = showTrip ? await getTripItems(plantId, now, account.types) : [];

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
      {/* Fáze 108: stránka podlaží vycentrovaná na plnou šířku (bez prázdného levého sloupce) */}
      <div className="mx-auto w-full max-w-[1600px]" data-testid="floor-page">
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
          <div className="flex flex-wrap items-center justify-end gap-2">
          <BuildingHeaderActions
            plantId={building.plant.id}
            building={{ id: building.id, code: building.code, name: building.name, shortName: building.shortName, mapPolygon: building.mapPolygon }}
            campus={{ width: building.plant.campusWidthM, height: building.plant.campusDepthM }}
            floor={{ id: floor.id, name: floor.name, description: floor.description }}
            canEdit={canEdit}
          />
          {multiFloor ? (
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
          ) : null}
          </div>
        }
      />
      {showTrip ? <SmartRevisionTripOptimizer items={tripItems} today={pragueToday(now)} focusBuildingId={buildingId} canRecord={account.can("recordInspection")} className="mb-4" /> : null}
      <FloorExplorer
        floor={floor}
        showInspections={account.definition.showInspections}
        canBatchInspect={account.can("recordInspection")}
        scopeLabel={account.types ? `${account.definition.label}: ${account.definition.scopeDescription}` : null}
        studioHref={canEdit ? `/studio?plant=${building.plant.id}&building=${building.id}&floor=${floor.id}` : null}
      />
      </div>
    </PageTransition>
  );
}
