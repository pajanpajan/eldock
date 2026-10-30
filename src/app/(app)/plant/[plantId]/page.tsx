import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Cpu, Factory, Plus, Hourglass, MousePointerClick, TriangleAlert, ScanLine } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { KpiTile } from "@/components/common/KpiTile";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { StatusLegend } from "@/components/common/StatusLegend";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { CampusExplorer } from "@/components/map/campus/CampusExplorer";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { getInspectionWatch } from "@/server/queries/inspections";
import { getPlantOverview } from "@/server/queries/plant";
import { getModuleState } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/plant/[plantId]">): Promise<Metadata> {
  const { plantId } = await params;
  const plant = await getPlantOverview(plantId);
  return { title: plant?.name ?? "Závod" };
}

// Level 1 – Půdorys areálu.
export default async function PlantPage({ params }: PageProps<"/plant/[plantId]">) {
  const { plantId } = await params;
  const account = await getCurrentAccount();
  const [plant, watch] = await Promise.all([getPlantOverview(plantId, account.types), getInspectionWatch(plantId, new Date(), account.types)]);
  if (!plant) notFound();

  return (
    <PageTransition>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={[{ label: plant.name }]} />}
        title={plant.name}
        description={[plant.customerName, plant.address, plant.city].filter(Boolean).join(" · ")}
        actions={
          account.can("studio") && (await getModuleState()).ENTERPRISE_TOOLS ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" variant="outline" className="touch-target gap-2">
                <Link href={`/studio?plant=${plant.id}&new=plant`}>
                  <Factory className="size-4" aria-hidden />+ Nový závod od nuly
                </Link>
              </Button>
              <Button asChild size="lg" className="touch-target gap-2">
                <Link href={`/studio?plant=${plant.id}`}>
                  <Plus className="size-4" aria-hidden />
                  Přidat budovu do areálu
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      {plant.buildings.length === 0 ? (
        <EmptyState
          className="mb-6"
          icon={Building2}
          title="Areál zatím nemá žádné budovy"
          description={account.can("studio") ? "Navrhněte první budovu ve Studiu výstavby – umístíte ji tažením na mapě areálu." : "Budovy přidává technický ředitel nebo vedoucí údržby ve Studiu výstavby."}
        />
      ) : null}

      {account.definition.fieldView ? (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground" data-testid="field-hint">
          <ScanLine className="size-5 shrink-0 text-primary" aria-hidden />
          Naskenujte QR štítek na rozváděči nebo stroji – otevře se rovnou jeho schéma. Případně vyberte budovu v areálu níže.
        </p>
      ) : (
      <section aria-label="Souhrn závodu" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Budovy" value={plant.buildings.length} icon={Building2} />
        <KpiTile label="Zařízení celkem" value={plant.counts.total} icon={Cpu} />
        <KpiTile
          label={EQUIPMENT_STATUS.PENDING_UPDATE.label}
          value={plant.counts.pending}
          hint="Nahlášená změna, výkres zatím neodpovídá"
          icon={TriangleAlert}
          accent={EQUIPMENT_STATUS.PENDING_UPDATE.text}
        />
        <KpiTile
          label={EQUIPMENT_STATUS.WAITING_APPROVAL.label}
          value={plant.counts.waiting}
          hint="Nová revize čeká na potvrzení údržbou"
          icon={Hourglass}
          accent={EQUIPMENT_STATUS.WAITING_APPROVAL.text}
        />
      </section>
      )}

      {account.definition.showInspections && !account.definition.fieldView ? (
        <div className="mb-6">
          <InspectionWatcher watch={watch} />
        </div>
      ) : null}

      <CampusExplorer
        plant={plant}
        legend={
          <StatusLegend
            extra={
              <span className="flex items-center gap-2">
                <MousePointerClick className="size-3.5" aria-hidden />
                Klikněte na budovu: vícepodlažní → výběr patra, jednopodlažní → půdorys
              </span>
            }
          />
        }
      />
    </PageTransition>
  );
}
