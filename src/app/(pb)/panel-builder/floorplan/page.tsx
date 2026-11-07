import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getApplianceLibraryJson, getBoardManufacturers, getWiringSeries } from "@/server/queries/panel-builder";
import { getPanelCompany } from "@/server/panel-session";

export const metadata: Metadata = { title: "2D půdorys a kabeláž" };

// Fáze 49: vizuální 2D editor půdorysu elektroinstalace, 3D výpočet kabeláže a rozváděč z půdorysu na 1 klik.
export default async function FloorplanPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [series, manufacturers, applianceJson, company] = await Promise.all([getWiringSeries(), getBoardManufacturers(), getApplianceLibraryJson(), getPanelCompany()]);
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
          </Link>
        }
        title="📐 2D půdorys & kabeláž"
        description="Nahrajte půdorys (obrázek / PDF) nebo nakreslete místnosti, zkalibrujte měřítko, osaďte zásuvky, světla, vypínače a spotřebiče. Výkaz kabeláže porovná vedení spodem, vrchem a optimalizovaně; rozváděč vygenerujete jedním klikem."
      />
      <FloorplanEditorLoader series={series.map(({ key, label, count }) => ({ key, label, count }))} manufacturers={manufacturers} applianceJson={applianceJson} company={company?.companyName ?? null} />
    </PageTransition>
  );
}
