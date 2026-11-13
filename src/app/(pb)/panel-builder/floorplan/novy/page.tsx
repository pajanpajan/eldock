import type { Metadata } from "next";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorplanEditorLoader } from "@/components/panel-builder/floorplan/FloorplanEditorLoader";
import { getFloorplanEditorData, isFirstFloorplan } from "@/server/queries/floorplans";
import { ChargeNotice } from "@/components/credits/ChargeNotice";
import { floorplanCharge } from "@/lib/credits/entitlements";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { requirePanelCompany } from "@/server/panel-session";

export const metadata: Metadata = { title: "Nový 2D půdorys" };

// Fáze 64: nový půdorys – na serveru vznikne při první změně (adresa se pak přepne na /panel-builder/floorplan/[id]).
export default async function NewFloorplanPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [data, first, company] = await Promise.all([getFloorplanEditorData(), isFirstFloorplan(), requirePanelCompany()]);
  // Fáze 111: cena nového půdorysu před začátkem kreslení (zkušební zdarma / 15 kreditů / bez kreditů prodejní modal)
  const demo = company.id === TESTER_COMPANY.id;
  const plan = floorplanCharge(company);
  const blocked = !demo && plan.cost > company.creditsRemaining;
  return (
    <PageTransition>
      <ChargeNotice
        testId="floorplan-charge-notice"
        tone={demo ? "demo" : plan.license === "TRIAL" ? "trial" : blocked ? "blocked" : "paid"}
        text={
          demo
            ? "Ukázková firma: zkušební půdorys se zkušebním označením výstupů, bez kreditů."
            : plan.license === "TRIAL"
              ? `${plan.label} – výstupy nesou označení „ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL“.`
              : blocked
                ? `Nový 2D půdorys stojí ${plan.cost} kreditů, zbývá ${company.creditsRemaining}. Kreslit můžete hned – na server se půdorys uloží po dobití kreditů.`
                : `${plan.label} – odečtou se při prvním uložení na server (zbývá ${company.creditsRemaining} kreditů).`
        }
        paywall={blocked ? { reason: "NO_CREDITS", action: "Nový 2D půdorys", cost: plan.cost, balance: company.creditsRemaining } : null}
      />
      {/* Fáze 92: první půdorys firmy – volba trenažér nanečisto / prázdný půdorys v pravém sloupci editoru */}
      <FloorplanEditorLoader {...data} stored={null} startChoice={first} help={"Nahrajte půdorys (obrázek / PDF) nebo nakreslete místnosti, zkalibrujte měřítko, osaďte zásuvky, světla, vypínače a spotřebiče. Výkaz kabeláže porovná vedení spodem, vrchem a optimalizovaně; rozváděč vygenerujete jedním klikem."} />
    </PageTransition>
  );
}
