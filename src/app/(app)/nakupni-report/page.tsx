import type { Metadata } from "next";
import Link from "next/link";

import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PurchaseReportView } from "@/components/lifespan/PurchaseReportView";
import { PageTransition } from "@/components/layout/PageTransition";
import { DEFAULT_PURCHASE_HORIZON, isPurchaseHorizon, serializeReport } from "@/lib/lifespan-purchase";
import { cn } from "@/lib/utils";
import { getPlantPurchaseSettings, getPurchaseReport } from "@/server/queries/lifespan";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Nákupní report součástek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Fáze 116: 📦 Nákupní report prediktivní údržby (konsolidovaná objednávka náhradních dílů) – dostupný z Kusovníku
 * stroje, z Diagnostiky i z horního menu „⚡ Rozváděče & Stroje“. Závod `?zavod=`, výhled nákupu `?vyhled=`.
 */
export default async function PurchaseReportPage({ searchParams }: PageProps<"/nakupni-report">) {
  const [query, account, plants, rememberedId] = await Promise.all([searchParams, getCurrentAccount(), getPlants(), getRememberedPlantId()]);
  if (!account.can("submitChange")) return <NoAccess title="Nákupní report součástek" current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  const wanted = first(query.zavod);
  const plant = plants.find((entry) => entry.id === wanted) ?? plants.find((entry) => entry.id === rememberedId) ?? plants[0];
  const settings = plant ? await getPlantPurchaseSettings(plant.id) : null;
  const requested = Number(first(query.vyhled));
  const horizon = isPurchaseHorizon(requested) ? requested : (settings?.horizonDays ?? DEFAULT_PURCHASE_HORIZON);
  const result = plant ? await getPurchaseReport(plant.id, horizon, account.types) : null;
  const base = plant && wanted === plant.id ? `/nakupni-report?zavod=${plant.id}` : "/nakupni-report";
  return (
    <PageTransition>
      <PageHeader title="📦 Nákupní report prediktivní údržby" description="Konsolidovaná objednávka náhradních dílů – součástky celého závodu před koncem životnosti sečtené podle objednacího čísla, aby nákup neobjednával každý týden po jednom kusu." />
      {plants.length > 1 ? (
        <nav aria-label="Závod" className="mb-4 flex flex-wrap gap-1.5">
          {plants.map((entry) => (
            <Link key={entry.id} href={`/nakupni-report?zavod=${entry.id}`} aria-current={entry.id === plant?.id ? "page" : undefined} className={cn("rounded-lg border px-3 py-1.5 text-sm", entry.id === plant?.id ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted")}>
              {entry.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {plant && result && settings ? (
        <PurchaseReportView
          plant={{ id: plant.id, name: plant.name }}
          report={serializeReport(result.report)}
          base={base}
          settings={{ email: settings.email, frequency: settings.frequency, horizonDays: settings.horizonDays, lastSentAt: settings.lastSentAt }}
          printHref={`/nakupni-report/tisk?zavod=${plant.id}&vyhled=${horizon}`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Zatím nemáte žádný závod.</p>
      )}
    </PageTransition>
  );
}
