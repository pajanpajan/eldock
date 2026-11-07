import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getFloorplanEditorData, getFloorplanForEditor } from "@/server/queries/floorplans";

export async function generateMetadata({ params }: PageProps<"/panel-builder/floorplan/[id]">): Promise<Metadata> {
  const floorplan = await getFloorplanForEditor((await params).id);
  return { title: floorplan ? `${floorplan.name} – 2D půdorys` : "2D půdorys" };
}

// Fáze 64: uložený půdorys v editoru – průběžné ukládání na server, historie verzí, Zpět / Znovu.
export default async function FloorplanEditorPage({ params }: PageProps<"/panel-builder/floorplan/[id]">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [floorplan, data] = await Promise.all([getFloorplanForEditor((await params).id), getFloorplanEditorData()]);
  if (!floorplan) notFound();
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder/floorplan" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Půdorysy
          </Link>
        }
        title="📐 2D půdorys & kabeláž"
        description="Úpravy se průběžně ukládají na server; starší stavy najdete v historii verzí. Zpět / Znovu: Ctrl+Z / Ctrl+Shift+Z."
      />
      <FloorplanEditorLoader
        {...data}
        stored={{
          id: floorplan.id,
          name: floorplan.name,
          customerName: floorplan.customerName,
          installationSite: floorplan.installationSite,
          version: floorplan.version,
          updatedAt: floorplan.updatedAt,
          draftJson: floorplan.draftJson,
          project: floorplan.project,
        }}
      />
    </PageTransition>
  );
}
