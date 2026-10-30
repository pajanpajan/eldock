import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cable, EyeOff, Inbox, QrCode, ShieldX } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { BomTable } from "@/components/equipment/BomTable";
import { Cabinet3D } from "@/components/equipment/Cabinet3D";
import { ChangeRequestCta } from "@/components/equipment/ChangeRequestCta";
import { DocumentationTabs } from "@/components/equipment/DocumentationTabs";
import { EquipmentPhotoCard } from "@/components/equipment/EquipmentPhotoCard";
import { InteractiveSchematic } from "@/components/equipment/InteractiveSchematic";
import { QrLabelCard } from "@/components/equipment/QrLabelCard";
import { RevisionTimeline } from "@/components/equipment/RevisionTimeline";
import { SafetyBanner } from "@/components/equipment/SafetyBanner";
import { PanelDiagnostics } from "@/components/equipment/PanelDiagnostics";
import { SchematicViewer } from "@/components/equipment/SchematicViewer";
import { CompliancePassport } from "@/components/inspections/CompliancePassport";
import { InspectionLogbook } from "@/components/inspections/InspectionLogbook";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { LotoCard } from "@/components/inspections/LotoCard";
import { TemporaryModArchive } from "@/components/temporary-mods/TemporaryModArchive";
import { TemporaryModBanner } from "@/components/temporary-mods/TemporaryModBanner";
import { TemporaryModDialog } from "@/components/temporary-mods/TemporaryModDialog";
import { PageTransition } from "@/components/layout/PageTransition";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_TYPE_LABELS, formatDate } from "@/lib/format";
import { pragueToday, summarizeInspections } from "@/lib/inspection";
import { USAGE_GROUP_LABELS, inspectionRuleFor, isLightCard, type UsageGroup } from "@/lib/inspection-rules";
import { renderPanelSheetSvg } from "@/lib/mock-graphics/pcschematic";
import { buildPanelModel } from "@/lib/panel-model";
import { buildingHref, caeTicketHref, equipmentHref, floorHref, plantHref } from "@/lib/routes";
import { checkLabel } from "@/lib/qr-label";
import { hasPanelBook } from "@/lib/sheet-nav";
import { buildLabelData } from "@/server/equipment-label";
import { getEquipmentDetail, getLinkableEquipment, getPowerNodes, getSchematicReferences } from "@/server/queries/equipment";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/equipment/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);
  return { title: equipment?.name ?? "Zařízení" };
}

// Detail zařízení – Documentation Hub (dostupný i přes QR kód).
export default async function EquipmentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { rev, qr } = await searchParams;
  const [equipment, account] = await Promise.all([getEquipmentDetail(id), getCurrentAccount()]);
  if (!equipment) notFound();
  const role = account.definition.workflowRole;
  // Mimo výřez účtu (např. konvice pro revizního technika VTZ) – jen informace, ne data.
  if (!account.canSee(equipment.type)) {
    return (
      <EmptyState
        icon={EyeOff}
        title={`${equipment.tag} není ve výřezu vašeho účtu`}
        description={`${account.definition.label}: ${account.definition.scopeDescription}`}
        action={<SwitchRoleButton account="MAINTENANCE_LEAD" />}
      />
    );
  }
  const showInspections = account.definition.showInspections;
  const powerNodes = await getPowerNodes(equipment.floor.building.plant.id);

  const { floor } = equipment;
  const { building } = floor;
  const plantId = building.plant.id;
  const basePath = equipmentHref(equipment.id);
  const openChange = equipment.changeRequests[0] ?? null;
  const active = equipment.revisions.find((revision) => revision.status === "ACTIVE") ?? equipment.revisions[0] ?? null;
  const pending = equipment.revisions.find((revision) => revision.status === "PENDING_APPROVAL") ?? null;
  const selected = equipment.revisions.find((revision) => revision.id === rev) ?? active;
  // Pevné „teď“ pro relativní časy (server i klient vykreslí totéž).
  const now = new Date();
  const inspection = summarizeInspections(equipment.inspections, now);
  const label = await buildLabelData(equipment, inspection);
  // Naskenovaný štítek s jiným kódem = štítek byl mezitím přegenerován (fyzicky neplatný).
  const labelCheck = checkLabel(qr, equipment.qrToken);
  const canEditCard = account.can("submitChange") || account.can("recordInspection");
  // Interaktivní reference ve výkresu vybrané revize (CAE / správce závodu je upravuje).
  const canEditReferences = account.can("caeOffice") || account.can("studio");
  const [references, linkable] = selected && !isLightCard(equipment.type)
    ? await Promise.all([getSchematicReferences(selected.id, now), canEditReferences ? getLinkableEquipment(plantId) : Promise.resolve([])])
    : [[], []];
  const today = pragueToday(now);
  // Spotřebiče, nářadí a bezpečnostní zařízení: lehká karta jen s revizemi a měřením.
  const light = isLightCard(equipment.type);
  const activeMods = equipment.temporaryMods.filter((mod) => mod.status === "ACTIVE");
  const rule = inspectionRuleFor({ ...equipment, externalInfluences: equipment.externalInfluences });
  // Rozváděče a stroje: vícelistová kniha PCSCHEMATIC a diagnostika nad stejným modelem rozváděče.
  const panelModel = !light && hasPanelBook(equipment.type)
    ? buildPanelModel({
        ...equipment,
        plantCode: building.plant.code,
        plantName: building.plant.name,
        customerName: building.plant.customerName,
        buildingCode: building.code,
        floorCode: floor.code,
        feeds: equipment.feeds,
        revision: selected ? { version: selected.version, date: formatDate(selected.createdAt), author: selected.author?.name ?? "Eldock CAE" } : undefined,
      })
    : null;
  const book = panelModel ? { sheets: panelModel.sheets.map((sheet) => ({ ...sheet, svg: renderPanelSheetSvg(panelModel, sheet.number) })) } : undefined;
  const inspectionsPanel = (
    <InspectionLogbook
      equipmentId={equipment.id}
      tag={equipment.tag}
      type={equipment.type}
      protectionClass={equipment.protectionClass}
      intervalMonths={equipment.inspectionIntervalMonths}
      rule={rule}
      inspections={equipment.inspections}
      summary={inspection}
      today={today}
      now={now}
      canRecord={account.can("recordInspection")}
      canResolveDefects={account.can("resolveDefects")}
    />
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-20 sm:pb-0">
        <PageHeader
          className="pb-0"
          breadcrumb={
            <LocationBreadcrumb
              items={[
                { label: building.plant.name, href: plantHref(plantId) },
                {
                  label: building.name,
                  href: building._count.floors > 1 ? buildingHref(plantId, building.id) : plantHref(plantId),
                },
                { label: floor.name, href: floorHref(plantId, building.id, floor.id) },
                { label: equipment.tag },
              ]}
            />
          }
          title={equipment.name}
          badges={
            <>
              {light ? null : <StatusBadge kind="equipment" status={equipment.status} className="text-sm" />}
              {showInspections ? (
                <Link href={`${basePath}?tab=inspections`} className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <InspectionStatusBadge summary={inspection} className="text-sm" />
                </Link>
              ) : null}
            </>
          }
          description={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{EQUIPMENT_TYPE_LABELS[equipment.type]}</span>
              <span>
                Tag <span className="font-mono text-foreground">{equipment.tag}</span>
              </span>
              <span>
                ID <span className="font-mono">{equipment.id}</span>
              </span>
              {equipment.manufacturer ? (
                <span>
                  {equipment.manufacturer} {equipment.model}
                </span>
              ) : null}
              {equipment.ratedVoltage ? <span>{equipment.ratedVoltage}</span> : null}
              {equipment.ratedCurrent ? <span>{equipment.ratedCurrent}</span> : null}
              {equipment.ipRating ? <span>{equipment.ipRating}</span> : null}
              {equipment.inventoryNumber ? (
                <span>
                  Inv. č. <span className="font-mono text-foreground">{equipment.inventoryNumber}</span>
                </span>
              ) : null}
              {equipment.usageGroup ? <span>{USAGE_GROUP_LABELS[equipment.usageGroup as UsageGroup] ?? `Skupina ${equipment.usageGroup}`}</span> : null}
              {equipment.protectionClass ? <span>Třída ochrany {equipment.protectionClass}</span> : null}
              {equipment.assignedZone ? <span>{equipment.assignedZone}</span> : null}
              {equipment.fedFrom ? (
                <Link href={equipmentHref(equipment.fedFrom.id)} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  <Cable className="size-3.5" aria-hidden />
                  Napájeno z: <span className="font-mono">{equipment.fedFrom.tag}</span>
                  {equipment.fedFromCircuit ? ` (${equipment.fedFromCircuit})` : ""}
                </Link>
              ) : null}
              {active ? (
                <span>
                  Platná revize <span className="font-mono text-foreground">{active.version}</span>
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <Button asChild variant="outline" className="touch-target gap-2">
                <a href="#qr-stitek">
                  <QrCode className="size-4" />
                  QR štítek
                </a>
              </Button>
              {!light && account.can("temporaryMods") ? <TemporaryModDialog equipmentId={equipment.id} tag={equipment.tag} version={active?.version ?? null} /> : null}
              {light ? null : account.can("submitChange") ? (
                <ChangeRequestCta href={`${basePath}/change-request`} openNumber={openChange?.number ?? null} />
              ) : openChange && role === "CAE_ENGINEER" ? (
                <Button asChild size="lg" className="touch-target gap-2">
                  <Link href={caeTicketHref(openChange.id)}>
                    <Inbox className="size-4" />
                    Otevřít ticket {openChange.number}
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        {labelCheck === "replaced" ? (
          <Alert variant="destructive" data-testid="qr-label-replaced">
            <ShieldX />
            <AlertTitle>Neplatný QR štítek</AlertTitle>
            <AlertDescription>
              Naskenovaný štítek u {equipment.tag} byl nahrazen novým kódem a už neplatí. Ověřte, že jste u správného zařízení, a nahlaste výměnu štítku – platný štítek vytisknete níže.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <EquipmentPhotoCard
            equipmentId={equipment.id}
            tag={equipment.tag}
            name={equipment.name}
            type={equipment.type}
            photoUrl={equipment.photoUrl}
            inspection={showInspections ? inspection : null}
            documentStatus={light ? null : equipment.status}
            canEdit={canEditCard}
          />
          <QrLabelCard label={label} printHref={`${basePath}/label`} canEdit={canEditCard} />
        </div>

        {openChange ? (
          <SafetyBanner
            change={openChange}
            pendingRevision={pending}
            reviewHref={`${basePath}/approve`}
            canReview={account.can("approveRevision")}
            now={now}
          />
        ) : null}

        {activeMods.map((mod) => (
          <TemporaryModBanner key={mod.id} mod={mod} version={active?.version ?? null} now={now} canResolve={account.can("temporaryMods")} />
        ))}

        {light ? (
          <DocumentationTabs
            panels={{ inspections: inspectionsPanel }}
            defaultTab="inspections"
            labels={{ inspections: `Revize & Měření (${rule.standard})` }}
          />
        ) : (
          <DocumentationTabs
            panels={{
              schema: (
                <SchematicViewer
                  interactive={
                    selected && (references.length || canEditReferences)
                      ? {
                          count: references.length,
                          node: (
                            <InteractiveSchematic
                              key={selected.id}
                              revision={{ id: selected.id, version: selected.version, url: selected.schematicUrl, format: selected.schematicFormat, sheetCount: selected.sheetCount }}
                              references={references}
                              linkable={linkable}
                              canEdit={canEditReferences}
                            />
                          ),
                        }
                      : undefined
                  }
                  book={book}
                  basePath={basePath}
                  selectedId={selected?.id ?? ""}
                  revisions={equipment.revisions.map(({ id: revisionId, version, status, title, schematicUrl, schematicFormat, sheetCount, createdAt }) => ({
                    id: revisionId,
                    version,
                    status,
                    title,
                    schematicUrl,
                    schematicFormat,
                    sheetCount,
                    createdAt,
                  }))}
                />
              ),
              bom: selected ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Kusovník revize <span className="font-mono text-foreground">{selected.version}</span>
                  </p>
                  <BomTable rows={selected.bomItems} fileName={`kusovnik-${equipment.tag}-${selected.version}.csv`} />
                </div>
              ) : null,
              "3d": selected ? <Cabinet3D bom={selected.bomItems} tag={equipment.tag} /> : null,
              history: (
                <div className="space-y-8">
                  <RevisionTimeline revisions={equipment.revisions} basePath={basePath} selectedId={selected?.id ?? null} />
                  <TemporaryModArchive mods={equipment.temporaryMods} canOpenTicket={role === "CAE_ENGINEER"} />
                </div>
              ),
              passport: (
                <div className="space-y-8">
                  <LotoCard equipment={equipment} nodes={powerNodes} />
                  <CompliancePassport equipment={equipment} />
                </div>
              ),
              // CAE projektant lhůtník revizí nevidí.
              ...(showInspections ? { inspections: inspectionsPanel } : {}),
              ...(panelModel ? { diagnostics: <PanelDiagnostics model={panelModel} /> } : {}),
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
