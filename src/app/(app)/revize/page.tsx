import type { Metadata } from "next";
import Link from "next/link";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { RevisionHub } from "@/components/inspections/RevisionHub";
import { PageTransition } from "@/components/layout/PageTransition";
import { REVISION_BUILDING_PARAM, REVISION_TAB_PARAM, revisionHubHref, revisionTabOf } from "@/lib/revision-hub";
import { cn } from "@/lib/utils";
import { getFeatures } from "@/server/modules";
import { getPlantOverview, getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Revize & Plánovač" };

/**
 * Fáze 115: „📋 Revize & Plánovač“ – jediné centrální místo pro revize závodu: přehled budov se semaforem revizí a záložky
 * Chytrá revize & Plánovač výjezdů, Lhůtník, Hlídač revizí spotřebičů a Měsíční TIČR report & Audit. Údržba vidí svůj
 * závod, revizní technik a CAE si závod vyberou (`?zavod=`).
 */
export default async function RevisionHubPage({ searchParams }: PageProps<"/revize">) {
  const [query, account, plants, rememberedId, modules] = await Promise.all([searchParams, getCurrentAccount(), getPlants(), getRememberedPlantId(), getFeatures()]);
  if (!account.can("inspections")) return <NoAccess title="Revize & Plánovač" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  const wanted = Array.isArray(query.zavod) ? query.zavod[0] : query.zavod;
  const chosen = plants.find((plant) => plant.id === wanted) ?? plants.find((plant) => plant.id === rememberedId) ?? plants[0];
  const overview = chosen ? await getPlantOverview(chosen.id, account.types) : null;
  const tab = revisionTabOf(query[REVISION_TAB_PARAM]);
  const building = Array.isArray(query[REVISION_BUILDING_PARAM]) ? query[REVISION_BUILDING_PARAM][0] : query[REVISION_BUILDING_PARAM];
  // Ručně vybraný závod zůstává v odkazech záložek a filtru budovy
  const base = chosen && wanted === chosen.id ? `${revisionHubHref}?zavod=${chosen.id}` : revisionHubHref;
  return (
    <PageTransition>
      <PageHeader title="📋 Revize & Plánovač" description="Revize rozváděčů, VTZ, strojů a spotřebičů na jednom místě – semafor budov, Chytrá revize, lhůtník, Hlídač revizí a TIČR report." />
      {plants.length > 1 && account.definition.workflowRole !== "MAINTENANCE" ? (
        <nav aria-label="Závod" className="mb-4 flex flex-wrap gap-1.5" data-testid="revision-plants">
          {plants.map((plant) => (
            <Link key={plant.id} href={`${revisionHubHref}?zavod=${plant.id}`} aria-current={plant.id === chosen?.id ? "page" : undefined} className={cn("rounded-lg border px-3 py-1.5 text-sm", plant.id === chosen?.id ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted")}>
              {plant.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {overview ? (
        <RevisionHub
          plant={{ id: overview.id, name: overview.name, buildings: overview.buildings.map(({ id, name }) => ({ id, name })) }}
          base={base}
          tab={tab}
          buildingId={building ?? null}
          access={{
            canRecord: account.can("recordInspection"),
            canAudit: account.can("audit") && modules.on("inspections.audit"),
            canPlanner: account.can("planner") && modules.on("inspections.planner"),
            canRapid: account.can("rapid") && modules.on("inspections.planner"),
            canImport: (account.can("recordInspection") || account.can("studio")) && modules.on("enterprise.csv_import"),
            showReports: modules.on("inspections.pdf_reports"),
            alerts: modules.on("inspections.alerts"),
            types: account.types,
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Zatím nemáte žádný závod.</p>
      )}
    </PageTransition>
  );
}
