import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getFloorplanEditorData } from "@/server/queries/floorplans";

export const metadata: Metadata = { title: "Nový 2D půdorys" };

// Fáze 64: nový půdorys – na serveru vznikne při první změně (adresa se pak přepne na /panel-builder/floorplan/[id]).
export default async function NewFloorplanPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const data = await getFloorplanEditorData();
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder/floorplan" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Půdorysy
          </Link>
        }
        title="📐 2D půdorys & kabeláž"
        description="Nahrajte půdorys (obrázek / PDF) nebo nakreslete místnosti, zkalibrujte měřítko, osaďte zásuvky, světla, vypínače a spotřebiče. Výkaz kabeláže porovná vedení spodem, vrchem a optimalizovaně; rozváděč vygenerujete jedním klikem."
      />
      <FloorplanEditorLoader {...data} stored={null} />
    </PageTransition>
  );
}
