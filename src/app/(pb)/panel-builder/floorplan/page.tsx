import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { DemoScenarioAutostart } from "@/components/panel-builder/DemoScenariosMenu";
import { FloorplanList } from "@/components/panel-builder/floorplan/FloorplanList";
import { getFloorplanList } from "@/server/queries/floorplans";

export const metadata: Metadata = { title: "2D půdorysy a kabeláž" };

// Fáze 64: seznam 2D půdorysů firmy uložených na serveru (editor: /panel-builder/floorplan/novy a /panel-builder/floorplan/[id]).
// Fáze 99: `?demo=<scénář>` (odkaz z prezentace /prezentace) rovnou načte demo scénář živé ukázky.
export default async function FloorplansPage({ searchParams }: PageProps<"/panel-builder/floorplan">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [{ active, deleted }, { demo }] = await Promise.all([getFloorplanList(), searchParams]);
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
          </Link>
        }
        title="📐 2D půdorys & kabeláž"
        description="Půdorysy elektroinstalace vaší firmy: nahrajte výkres (obrázek / PDF) nebo nakreslete místnosti, osaďte zásuvky, světla, vypínače a spotřebiče, spočítejte kabeláž a jedním klikem vygenerujte rozváděč. Vše se průběžně ukládá na server včetně historie verzí."
      />
      {typeof demo === "string" ? <DemoScenarioAutostart scenario={demo} /> : null}
      <FloorplanList active={active} deleted={deleted} />
    </PageTransition>
  );
}
