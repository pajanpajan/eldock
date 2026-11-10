import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
      <FloorplanEditorLoader
        {...data}
        help={"Úpravy se průběžně ukládají do cloudu (do 1 s po změně); starší stavy najdete v historii verzí, projekt jde uložit i do počítače (.eldock). Zpět / Znovu: Ctrl+Z / Ctrl+Shift+Z."}
        stored={{
          id: floorplan.id,
          code: floorplan.code,
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
