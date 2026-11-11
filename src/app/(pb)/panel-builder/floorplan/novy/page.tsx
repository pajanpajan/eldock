import type { Metadata } from "next";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getFloorplanEditorData, isFirstFloorplan } from "@/server/queries/floorplans";

export const metadata: Metadata = { title: "Nový 2D půdorys" };

// Fáze 64: nový půdorys – na serveru vznikne při první změně (adresa se pak přepne na /panel-builder/floorplan/[id]).
export default async function NewFloorplanPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [data, first] = await Promise.all([getFloorplanEditorData(), isFirstFloorplan()]);
  return (
    <PageTransition>
      {/* Fáze 92: první půdorys firmy – volba trenažér nanečisto / prázdný půdorys v pravém sloupci editoru */}
      <FloorplanEditorLoader {...data} stored={null} startChoice={first} help={"Nahrajte půdorys (obrázek / PDF) nebo nakreslete místnosti, zkalibrujte měřítko, osaďte zásuvky, světla, vypínače a spotřebiče. Výkaz kabeláže porovná vedení spodem, vrchem a optimalizovaně; rozváděč vygenerujete jedním klikem."} />
    </PageTransition>
  );
}
