import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { StudioWizard } from "@/components/studio/StudioWizard";
import { getPlants } from "@/server/queries/plant";
import { getStudioData } from "@/server/queries/studio";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Studio výstavby závodu" };

// Studio výstavby závodu: rastr → budova a patra → místnosti → zařízení s napájením.
export default async function StudioPage() {
  const [account, plants, rememberedId] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("studio")) return <NoAccess title="Studio výstavby závodu" current={account.accountType} suggest="PLANT_ADMIN" />;
  const plant = plants.find((entry) => entry.id === rememberedId) ?? plants[0];
  if (!plant) notFound();
  const data = await getStudioData(plant.id);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title="Studio výstavby závodu"
        description={`${data.plant.name} · nová budova, patra, místnosti a zařízení s hierarchií napájení přímo v konstrukčním rastru.`}
      />
      <StudioWizard data={data} />
    </>
  );
}
