import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { InspectionOverviewTable } from "@/components/inspections/InspectionOverviewTable";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { pragueToday } from "@/lib/inspection";
import { rapidInspectionHref } from "@/lib/routes";
import { getInspectionOverview, getInspectionWatch } from "@/server/queries/inspections";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Přehled revizí" };

// Přehled revizí celého závodu (rozváděče, stroje, spotřebiče, nářadí) s hromadným zápisem.
export default async function InspectionsPage() {
  const [role, plants, rememberedId] = await Promise.all([getCurrentRole(), getPlants(), getRememberedPlantId()]);
  // Údržba vidí svůj závod, CAE všechny závody.
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  const [items, watch] = await Promise.all([getInspectionOverview(plant?.id, now), getInspectionWatch(plant?.id, now)]);

  return (
    <PageTransition>
      <PageHeader
        title="Přehled revizí"
        description={`${plant ? plant.name : "Všechny závody"} · rozváděče a VTZ (ČSN 33 1500), stroje (NV 378/2001 Sb.), spotřebiče a nářadí (ČSN 33 1600 ed. 2), hromosvody a nouzové osvětlení.`}
        actions={
          <Button asChild size="lg" className="touch-target gap-2">
            <Link href={rapidInspectionHref}>
              <ScanLine className="size-4" aria-hidden />
              Rychlá revize
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <InspectionWatcher watch={watch} showPlant={!plant} />
        <InspectionOverviewTable items={items} today={pragueToday(now)} showPlant={!plant} />
      </div>
    </PageTransition>
  );
}
