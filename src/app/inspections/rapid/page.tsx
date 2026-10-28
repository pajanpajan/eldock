import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RapidInspection } from "@/components/inspections/RapidInspection";
import { Button } from "@/components/ui/button";
import { inspectionsHref } from "@/lib/routes";
import { getRapidQueue } from "@/server/queries/inspections";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Rychlá revize" };

// Mobilní režim pro revizního technika: fronta spotřebičů v místnosti a zápis jedním klikem.
export default async function RapidInspectionPage({ searchParams }: PageProps<"/inspections/rapid">) {
  const [role, plants, rememberedId, params] = await Promise.all([getCurrentRole(), getPlants(), getRememberedPlantId(), searchParams]);
  // Dávka z plánovače: `?ids=a,b,c` v pořadí pochůzky.
  const planIds = typeof params.ids === "string" ? params.ids.split(",").filter(Boolean).slice(0, 500) : [];
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const items = await getRapidQueue(plant?.id);

  return (
    <>
      <PageHeader
        title="Rychlá revize"
        description={`${plant ? plant.name : "Všechny závody"} · spotřebiče, nářadí a svářečky dle ČSN 33 1600 ed. 2 a ČSN EN 60974-4.`}
        actions={
          <Button asChild variant="outline" className="touch-target gap-2">
            <Link href={inspectionsHref}>
              <ListChecks className="size-4" aria-hidden />
              Přehled revizí
            </Link>
          </Button>
        }
      />
      {items.length ? (
        <RapidInspection items={items} planIds={planIds} />
      ) : (
        <EmptyState icon={PackageOpen} title="V závodě nejsou evidované spotřebiče ani nářadí" description="Rychlá revize pracuje s přenosnými spotřebiči, nářadím a svářečkami." />
      )}
    </>
  );
}
