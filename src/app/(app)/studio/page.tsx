import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { StudioWizard } from "@/components/studio/StudioWizard";
import { getPlants } from "@/server/queries/plant";
import { getStudioData } from "@/server/queries/studio";
import { getFeatures } from "@/server/modules";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Studio výstavby závodu" };

// Studio výstavby závodu: budova a umístění v areálu → místnosti → zařízení s napájením.
export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const [account, plants, rememberedId, params] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId(), searchParams]);
  if (!account.can("studio")) return <NoAccess title="Studio výstavby závodu" current={account.accountType} suggest="PLANT_ADMIN" />;
  if (!(await getFeatures()).on("enterprise.studio")) return <ModuleDisabled feature="enterprise.studio" canManage={account.can("manageModules")} />;
  // Areál z odkazu „Přidat budovu do areálu“ (?plant=), jinak naposledy otevřený.
  const requested = typeof params.plant === "string" ? params.plant : undefined;
  const plant = plants.find((entry) => entry.id === requested) ?? plants.find((entry) => entry.id === rememberedId) ?? plants[0];
  if (!plant) notFound();
  // „+ Nový závod od nuly“ (?new=plant) otevře Studio rovnou v režimu čisté mapy areálu.
  const startNewPlant = params.new === "plant";
  const data = await getStudioData(plant.id);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title="Studio výstavby závodu"
        description={`${data.plant.name} · nová budova, patra, místnosti a zařízení s hierarchií napájení přímo v konstrukčním rastru.`}
      />
      <StudioWizard key={`${data.plant.id}:${startNewPlant}`} data={data} startNewPlant={startNewPlant} />
    </>
  );
}
