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
import { PredictiveWatch } from "@/components/inspections/PredictiveWatch";
import { SmartRevisionTripOptimizer } from "@/components/inspections/SmartRevisionTripOptimizer";
import { getPredictiveSummary } from "@/server/queries/health";
import { CampusExplorer } from "@/components/map/campus/CampusExplorer";
import { PlantOnboardingLoader } from "@/components/plant/PlantOnboardingLoader";
import { BimImportButtons } from "@/components/bim/BimImportModal";
import { PlantDocsBoard } from "@/components/plant/PlantDocsBoard";
import { PlantEquipmentBoard } from "@/components/plant/PlantEquipmentBoard";
import { PlantLoadSimulator } from "@/components/plant/PlantLoadSimulator";
import { PlantMachineryRegulation } from "@/components/plant/PlantMachineryRegulation";
import { PlantPhaseSwitcher } from "@/components/plant/PlantPhaseSwitcher";
import { Button } from "@/components/ui/button";
import { PLANT_PHASE_PARAM, plantPhaseOf, type PlantPhaseCounts } from "@/lib/plant-phases";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { getPlantCableNodes } from "@/server/queries/health";
import { pragueToday } from "@/lib/inspection";
import { getInspectionWatch } from "@/server/queries/inspections";
import { getTripItems } from "@/server/queries/revision-trip";
import { getPlantOverview, getPlantPower } from "@/server/queries/plant";
import { getPlantAgenda } from "@/server/queries/plant-agenda";
import { getFeatures } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/plant/[plantId]">): Promise<Metadata> {
  const [{ plantId }, account] = await Promise.all([params, getCurrentAccount()]);
  const plant = await getPlantOverview(plantId, account.types);
  return { title: plant?.name ?? "Závod" };
}

// Level 1 – Půdorys areálu.
// Fáze 98: správa závodu ve 4 agendách (`?faze=`) – nad plochou přepínač fází, stránka ukazuje vždy jen jednu agendu
// a načítá jen její data (mapa a napájení ve fázi 1, prediktivní údržba a kabelový strom simulátoru ve fázi 4).
export default async function PlantPage({ params, searchParams }: PageProps<"/plant/[plantId]">) {
  const [{ plantId }, query, account, modules] = await Promise.all([params, searchParams, getCurrentAccount(), getFeatures()]);
  const { pruvodce } = query;
  const phase = plantPhaseOf(query[PLANT_PHASE_PARAM]);
  // Fáze 99: demo scénář závodu – `?bim=vzor` načte vzorový BIM model, `?stroj=75` nastaví simulátor nového stroje
  const machineKw = Number(Array.isArray(query.stroj) ? query.stroj[0] : query.stroj);
  const initialKw = Number.isFinite(machineKw) && machineKw > 0 && machineKw <= 500 ? machineKw : undefined;
  const autoSample = query.bim === "vzor";
  const now = new Date();
  const [plant, watch, agenda] = await Promise.all([getPlantOverview(plantId, account.types), getInspectionWatch(plantId, now, account.types), getPlantAgenda(plantId, account.types)]);
  if (!plant) notFound();
  const showInspections = account.definition.showInspections && !account.definition.fieldView;
  const [power, predictive, cableNodes, tripItems] = await Promise.all([
    phase === 1 ? getPlantPower(plantId, account.types) : Promise.resolve([]),
    phase === 4 ? getPredictiveSummary(plantId, account.types) : Promise.resolve(null),
    phase === 4 ? getPlantCableNodes(plantId) : Promise.resolve([]),
    // Fáze 108: Chytrá revize (optimalizace výjezdu technika) na mapě závodu i v agendě revizí
    showInspections && (phase === 1 || phase === 4) ? getTripItems(plantId, now, account.types) : Promise.resolve([]),
  ]);
  const trip = showInspections ? (
    <SmartRevisionTripOptimizer items={tripItems} today={pragueToday(now)} canRecord={account.can("recordInspection")} className="mb-6" />
  ) : null;
  const counts: PlantPhaseCounts = {
    buildings: plant.buildings.length,
    boards: agenda.filter((row) => row.group === "boards").length,
    machines: agenda.filter((row) => row.group === "machines").length,
    devices: agenda.filter((row) => row.group === "devices").length,
    drawings: agenda.filter((row) => row.drawing).length,
    redlines: agenda.reduce((sum, row) => sum + row.changes.filter((change) => change.redline).length, 0),
    backups: agenda.reduce((sum, row) => sum + row.backups.length, 0),
    inspectionsDue: showInspections ? watch.expired + watch.expiring : 0,
    substantial: agenda.reduce((sum, row) => sum + row.changes.filter((change) => change.safetyImpact === "SUBSTANTIAL_SAFETY_MOD").length, 0),
  };
  // Fáze 92: průvodce závodem – režim A zakládá skutečná data (právo Studio), režim B je mise nad vzorovým závodem
  const canBuild = account.can("studio") && modules.on("enterprise.studio");
  const canAudit = account.can("audit") && modules.on("inspections.audit");
  const guide = pruvodce === "zavod" ? "build" : pruvodce === "mise" ? "mission" : pruvodce ? "choose" : null;

  return (
    <PageTransition>
      <PageHeader
        breadcrumb={<LocationBreadcrumb items={[{ label: plant.name }]} />}
        title={plant.name}
        description={[plant.customerName, plant.address, plant.city].filter(Boolean).join(" · ")}
        actions={
          // Fáze 98: založení závodu, budovy a import BIM patří do agendy 1 (mapa závodu)
          phase === 1 && account.can("studio") && modules.on("enterprise.studio") ? (
            <div className="flex flex-wrap gap-2">
              {/* Fáze 95: import BIM (IFC) – budova, místnosti, zdroje, rozváděče, trasy a stroje z modelu */}
              <BimImportButtons plantId={plant.id} canPanelBuilder={account.can("panelBuilder") && modules.on("enterprise.ai_panel_builder")} autoSample={autoSample} />
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

      {/* Fáze 92: nový závod – průvodce založením a mise noční poruchy (dialog i z horní lišty „🧭 Průvodce závodem“) */}
      <PlantOnboardingLoader plantId={plant.id} plantName={plant.name} canBuild={canBuild} canAudit={canAudit} empty={plant.buildings.length === 0} open={guide} />

      <PlantPhaseSwitcher plantId={plant.id} phase={phase} counts={counts} />

      {phase === 2 ? <PlantEquipmentBoard rows={agenda} fieldView={Boolean(account.definition.fieldView)} /> : null}
      {phase === 3 ? <PlantDocsBoard rows={agenda} /> : null}
      {phase === 4 ? (
        <div className="flex flex-col gap-4" data-testid="plant-compliance">
          {trip}
          {showInspections ? (
            <div>
              <InspectionWatcher watch={watch} />
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                <Link href="/inspections" className="text-primary underline-offset-2 hover:underline" data-testid="plant-inspections-link">
                  📅 Všechny revize a lhůtník →
                </Link>
                {canAudit ? (
                  <Link href="/inspections/audit-report" className="text-primary underline-offset-2 hover:underline" data-testid="plant-audit-link">
                    📖 Kniha revizí (auditní report pro TIČR / SÚIP) →
                  </Link>
                ) : null}
              </p>
              {predictive && (predictive.components.length || predictive.cables.length) ? (
                <div className="mt-3">
                  <PredictiveWatch summary={predictive} />
                </div>
              ) : null}
            </div>
          ) : null}
          <PlantMachineryRegulation rows={agenda} now={now} />
          <PlantLoadSimulator nodes={cableNodes} boards={agenda.filter((row) => row.type === "SWITCHBOARD").map(({ id, tag, name }) => ({ id, tag, name }))} initialKw={initialKw} />
        </div>
      ) : null}

      {/* Fáze 98: agenda 1 – mapa závodu (souhrn, vrstvy napájení Síť / DA / UPS, budovy a patra) */}
      {phase === 1 ? (
        <>
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

          {plant.buildings.length ? trip : null}
          <CampusExplorer
        plant={plant}
        power={power}
        canEdit={canBuild}
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
        </>
      ) : null}
    </PageTransition>
  );
}
