import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Factory, Plus, MousePointerClick, ScanLine } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageTransition } from "@/components/layout/PageTransition";
import { StatusLegend } from "@/components/common/StatusLegend";
import { PredictiveWatch } from "@/components/inspections/PredictiveWatch";
import { RevisionHub } from "@/components/inspections/RevisionHub";
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
import { formatCount } from "@/lib/format";
import { PLANT_PHASE_PARAM, plantPhaseHref, plantPhaseOf, type PlantPhaseCounts } from "@/lib/plant-phases";
import { REVISION_BUILDING_PARAM, REVISION_TAB_PARAM, revisionTabOf } from "@/lib/revision-hub";
import { WALK_SORT_PARAM, walkSortOf } from "@/lib/revision-walk";
import { getPlantCableNodes } from "@/server/queries/health";
import { getInspectionWatch } from "@/server/queries/inspections";
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
// Fáze 115: horní část závodu je jeden kompaktní pruh (název, KPI pilulky, Import BIM a + Přidat budovu) a hned pod ním
// začíná mapa areálu; Chytrá revize a celá revizní agenda jsou jen v „📋 Revize & Plánovač“ (agenda 4 a `/revize`).
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
  const [power, predictive, cableNodes] = await Promise.all([
    phase === 1 ? getPlantPower(plantId, account.types) : Promise.resolve([]),
    phase === 4 ? getPredictiveSummary(plantId, account.types) : Promise.resolve(null),
    phase === 4 ? getPlantCableNodes(plantId) : Promise.resolve([]),
  ]);
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
  const pill = "rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs font-semibold whitespace-nowrap";
  const revisionTab = revisionTabOf(query[REVISION_TAB_PARAM]);
  const revisionBuilding = Array.isArray(query[REVISION_BUILDING_PARAM]) ? query[REVISION_BUILDING_PARAM][0] : query[REVISION_BUILDING_PARAM];

  return (
    <PageTransition>
      {/* Fáze 115: jeden kompaktní pruh – název závodu, KPI pilulky a akce mapy (Import BIM, + Přidat budovu) */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-1.5" data-testid="plant-strip">
        <div className="flex max-w-[16rem] min-w-0 flex-col">
          <h1 className="truncate text-lg leading-tight font-bold">{plant.name}</h1>
          <span className="truncate text-xs text-muted-foreground" title={[plant.customerName, plant.address, plant.city].filter(Boolean).join(" · ")}>
            {[plant.customerName, plant.address, plant.city].filter(Boolean).join(" · ")}
          </span>
        </div>
        {account.definition.fieldView ? null : (
          <section aria-label="Souhrn závodu" className="flex flex-wrap items-center gap-1.5" data-testid="plant-kpis">
            <span className={pill} data-testid="plant-kpi-buildings">
              🏢 {formatCount(plant.buildings.length, ["budova", "budovy", "budov"])}
            </span>
            <span className={pill} data-testid="plant-kpi-equipment">
              ⚙️ {formatCount(plant.counts.total, ["zařízení", "zařízení", "zařízení"])}
            </span>
            <span className={pill} data-testid="plant-kpi-redlines">
              🖍️ {formatCount(counts.redlines, ["změna Červenky", "změny Červenky", "změn Červenky"])}
            </span>
            {plant.counts.pending ? (
              <span className={`${pill} border-amber-400/60 text-amber-300`} title="Nahlášená změna, výkres zatím neodpovídá">
                ⚠️ {plant.counts.pending} k aktualizaci
              </span>
            ) : null}
            {plant.counts.waiting ? (
              <span className={`${pill} border-sky-400/60 text-sky-300`} title="Nová revize čeká na potvrzení údržbou">
                ⏳ {plant.counts.waiting} ke schválení
              </span>
            ) : null}
          </section>
        )}
        {/* Fáze 98: založení budovy a import BIM patří do agendy 1 (mapa závodu) */}
        {phase === 1 && canBuild ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Fáze 95: import BIM (IFC) – budova, místnosti, zdroje, rozváděče, trasy a stroje z modelu */}
            <BimImportButtons plantId={plant.id} canPanelBuilder={account.can("panelBuilder") && modules.on("enterprise.ai_panel_builder")} autoSample={autoSample} compact />
            <Button asChild size="sm" className="touch-target gap-2">
              <Link href={`/studio?plant=${plant.id}`} aria-label="Přidat budovu do areálu">
                <Plus className="size-4" aria-hidden />
                Přidat budovu
              </Link>
            </Button>
            <Link href={`/studio?plant=${plant.id}&new=plant`} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="+ Nový závod od nuly" title="+ Nový závod od nuly">
              <Factory className="size-3.5" aria-hidden />
              <span className="hidden 2xl:inline">+ Nový závod</span>
            </Link>
          </div>
        ) : null}
      </div>

      {/* Fáze 92: nový závod – průvodce založením a mise noční poruchy (dialog i z horní lišty „🧭 Průvodce závodem“) */}
      <PlantOnboardingLoader plantId={plant.id} plantName={plant.name} canBuild={canBuild} canAudit={canAudit} empty={plant.buildings.length === 0} open={guide} />

      <PlantPhaseSwitcher plantId={plant.id} phase={phase} counts={counts} />

      {phase === 2 ? <PlantEquipmentBoard rows={agenda} fieldView={Boolean(account.definition.fieldView)} /> : null}
      {phase === 3 ? <PlantDocsBoard rows={agenda} /> : null}
      {phase === 4 ? (
        <div className="flex flex-col gap-4" data-testid="plant-compliance">
          {/* Fáze 115: 📋 Revize & Plánovač – semafor budov, Chytrá revize, lhůtník, Hlídač spotřebičů a TIČR report */}
          {showInspections ? (
            <RevisionHub
              plant={{ id: plant.id, name: plant.name, buildings: plant.buildings.map(({ id, name }) => ({ id, name })) }}
              base={plantPhaseHref(plant.id, 4)}
              tab={revisionTab}
              buildingId={revisionBuilding ?? null}
              sort={walkSortOf(query[WALK_SORT_PARAM])}
              now={now}
              access={{
                canRecord: account.can("recordInspection"),
                canAudit,
                canPlanner: account.can("planner") && modules.on("inspections.planner"),
                canRapid: account.can("rapid") && modules.on("inspections.planner"),
                canImport: (account.can("recordInspection") || account.can("studio")) && modules.on("enterprise.csv_import"),
                showReports: modules.on("inspections.pdf_reports"),
                alerts: modules.on("inspections.alerts"),
                types: account.types,
              }}
            />
          ) : null}
          {showInspections && predictive && (predictive.components.length || predictive.cables.length) ? <PredictiveWatch summary={predictive} /> : null}
          <PlantMachineryRegulation rows={agenda} now={now} />
          <PlantLoadSimulator nodes={cableNodes} boards={agenda.filter((row) => row.type === "SWITCHBOARD").map(({ id, tag, name }) => ({ id, tag, name }))} initialKw={initialKw} />
        </div>
      ) : null}

      {/* Fáze 98: agenda 1 – mapa závodu (vrstvy napájení Síť / DA / UPS, budovy a patra) hned pod pruhem */}
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
            <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground" data-testid="field-hint">
              <ScanLine className="size-5 shrink-0 text-primary" aria-hidden />
              Naskenujte QR štítek na rozváděči nebo stroji – otevře se rovnou jeho schéma. Případně vyberte budovu v areálu níže.
            </p>
          ) : null}
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
