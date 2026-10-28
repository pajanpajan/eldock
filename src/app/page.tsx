import { redirect } from "next/navigation";

import { EmptyState } from "@/components/common/EmptyState";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getRememberedPlantId } from "@/server/session";
import { DatabaseZap } from "lucide-react";

// Rozcestník: CAE rovnou na dashboard, Údržba do naposledy otevřeného (jinak prvního) závodu.
export default async function Home() {
  if ((await getCurrentRole()) === "CAE_ENGINEER") redirect("/cae");

  const [plants, rememberedId] = await Promise.all([getPlants(), getRememberedPlantId()]);
  const target = plants.find((plant) => plant.id === rememberedId) ?? plants[0];
  if (target) redirect(`/plant/${target.id}`);

  return (
    <EmptyState
      icon={DatabaseZap}
      title="Databáze je prázdná"
      description="Naplňte ji demo daty příkazem npm run db:seed (nebo npm run db:reset)."
    />
  );
}
