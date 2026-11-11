import type { Metadata } from "next";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getFloorplanEditorData } from "@/server/queries/floorplans";

export const metadata: Metadata = { title: "Trenažér 2D půdorysu" };

// Fáze 92: trenažér 2D půdorysu – rozdělaný bungalov 4+kk (3 úkoly, nic se neukládá, rozváděč bez kreditu).
export default async function FloorplanTrainerPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const data = await getFloorplanEditorData();
  return (
    <PageTransition>
      <FloorplanEditorLoader {...data} stored={null} sandbox help={"Trenažér: rozdělaný bungalov 4+kk je z 85 % hotový. Doplňte zásuvku u postele, stmívání v koupelně a vygenerujte rozváděč – nic se neukládá, rozváděč z trenažéru je zdarma (0 kreditů)."} />
    </PageTransition>
  );
}
