import { redirect } from "next/navigation";

import { EmptyState } from "@/components/common/EmptyState";
import { resolveHome } from "@/lib/modules";
import { getFeatures } from "@/server/modules";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";
import { DatabaseZap } from "lucide-react";

// Rozcestník: CAE rovnou na dashboard, Údržba do naposledy otevřeného (jinak prvního) závodu.
export default async function Home() {
  const { definition } = await getCurrentAccount();
  if (definition.home !== "plant") redirect(resolveHome(definition.home, (await getFeatures()).flags));

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
