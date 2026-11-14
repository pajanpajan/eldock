import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cable, CircuitBoard, EyeOff, Inbox, QrCode, ShieldX } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { ChangeRequestCta } from "@/components/equipment/ChangeRequestCta";
import { DocumentationTabs } from "@/components/equipment/DocumentationTabs";
import { EquipmentPhotoCard } from "@/components/equipment/EquipmentPhotoCard";
import { NameplateCard } from "@/components/equipment/NameplateCard";
import { idLabelData, titleWithoutTag } from "@/lib/equipment-id-label";
import { parseReading } from "@/lib/nameplate";
import { prisma } from "@/lib/prisma";
import { equipmentLabelSerial } from "@/server/services/qr-labels";
import { FieldQuickActions } from "@/components/equipment/FieldQuickActions";
import { RevisionTimeline } from "@/components/equipment/RevisionTimeline";
import { SafetyBanner } from "@/components/equipment/SafetyBanner";
import { SchematicViewer } from "@/components/equipment/SchematicViewer";
import { CompliancePassport } from "@/components/inspections/CompliancePassport";
import { InspectionLogbook } from "@/components/inspections/InspectionLogbook";
import { SignedRevisionEntry } from "@/components/inspections/SignedRevisionEntry";
import { MISUSE_BANNER } from "@/lib/revision-signature";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { LotoCard } from "@/components/inspections/LotoCard";
import { BatteryPassportCard } from "@/components/inspections/BatteryPassportCard";
import { TemporaryModArchive } from "@/components/temporary-mods/TemporaryModArchive";
import { TemporaryModBanner } from "@/components/temporary-mods/TemporaryModBanner";
import { TemporaryModDialog } from "@/components/temporary-mods/TemporaryModDialog";
import { PageTransition } from "@/components/layout/PageTransition";
import { LazyCabinet3D, LazyInteractiveSchematic, LazyPanelDiagnostics, LazyQrLabelCard } from "@/components/lazy";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_TYPE_LABELS, formatDate } from "@/lib/format";
import { pragueToday, summarizeInspections } from "@/lib/inspection";
import { USAGE_GROUP_LABELS, inspectionRuleFor, isLightCard, ruleInputFrom, type UsageGroup } from "@/lib/inspection-rules";
import { reportDefaults } from "@/lib/inspection-report";
import { renderPanelSheetSvg } from "@/lib/mock-graphics/pcschematic";
import { buildPanelModel } from "@/lib/panel-model";
import { buildingHref, caeTicketHref, equipmentHref, floorHref, plantHref } from "@/lib/routes";
import { checkLabel } from "@/lib/qr-label";
import { hasPanelBook } from "@/lib/sheet-nav";
import { buildLabelData } from "@/server/equipment-label";
import { getEquipmentDetail, getEquipmentKnowledge, getLinkableEquipment, getPowerNodes, getRevisionBom, getSchematicReferences } from "@/server/queries/equipment";
import { DocumentLibrary } from "@/components/equipment/DocumentLibrary";
import { SoftwareBackups } from "@/components/equipment/SoftwareBackups";
import { hasSoftwareTab } from "@/lib/software-backups";
import { getFeatures } from "@/server/modules";
import { getEquipmentPassports } from "@/server/queries/panel-builder";
import { getEquipmentHealth } from "@/server/queries/health";
import { ComponentLifespan } from "@/components/equipment/ComponentLifespan";
import { FeederCableCard } from "@/components/equipment/FeederCableCard";
import { PowerBackupCard } from "@/components/equipment/PowerBackupCard";
import { BimBoardButton } from "@/components/bim/BimBoardButton";
import { hasBackupTier, isPowerBackupTier, tierOf } from "@/lib/power-backup";
import { CABLE_STATUS } from "@/lib/cable-sizing";
import { LIFESPAN_STATUS } from "@/lib/component-lifespan";
import { classifyComponent } from "@/lib/bom-lifespan";
import { partKeyOf } from "@/lib/component-datasheets";
import { lossOf } from "@/lib/datasheet-view";
import { isCriticalRow, toRowView, verifiedDatasheetCount } from "@/lib/lifespan-view";
import { layoutCabinet } from "@/lib/mock-graphics/cabinet";
import { influenceCodesFrom, suggestEnclosure } from "@/lib/passport-docs";
import { BomDatasheets } from "@/components/equipment/BomDatasheets";
import { BomLifespanTable } from "@/components/equipment/BomLifespanTable";
import { EquipmentIdentityStrip } from "@/components/equipment/EquipmentIdentityStrip";
import { EquipmentRedlines, RedlinesSummary } from "@/components/equipment/EquipmentRedlines";
import type { PassportGeneratorContext } from "@/components/inspections/PassportDocActions";
import { getEquipmentRedlines } from "@/server/queries/equipment";
import { getCatalogParts, getEquipmentLifespan } from "@/server/queries/lifespan";
import { getCurrentAccount, getCurrentUser } from "@/server/session";

type Props = PageProps<"/equipment/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);
  return { title: equipment?.name ?? "Zařízení" };
}

// Detail zařízení – Documentation Hub (dostupný i přes QR kód).
export default async function EquipmentPage({ params, searchParams }: Props) {
  const [{ id }, { rev, qr }] = await Promise.all([params, searchParams]);
  const [equipment, account, modules] = await Promise.all([getEquipmentDetail(id), getCurrentAccount(), getFeatures()]);
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
  // Naskenovaný štítek s jiným kódem = štítek byl mezitím přegenerován (fyzicky neplatný).
  const labelCheck = checkLabel(qr, equipment.qrToken);
  const canEditCard = account.can("submitChange") || account.can("recordInspection");
  // Terénní pohled (směnový údržbář): rychlé akce nahoře, bez pasportu a lhůtníku.
  const fieldView = !!account.definition.fieldView && !isLightCard(equipment.type);
  // Interaktivní reference ve výkresu vybrané revize (CAE / správce závodu je upravuje).
  const canEditReferences = account.can("caeOffice") || account.can("studio");
  const withReferences = !!selected && !isLightCard(equipment.type) && modules.on("cae.hotspots");
  // Nezávislé dotazy po ověření přístupu najednou: napájení (LOTO), štítek, kusovník vybrané revize, reference.
  const [powerNodes, label, bom, references, linkable, passports, knowledge, health, labelSerial, lifespan, redlines, user] = await Promise.all([
    getPowerNodes(plantId),
    buildLabelData(equipment, inspection),
    selected ? getRevisionBom(selected.id) : Promise.resolve([]),
    withReferences ? getSchematicReferences(selected.id, now) : Promise.resolve([]),
    withReferences && canEditReferences ? getLinkableEquipment(plantId) : Promise.resolve([]),
    equipment.type === "SWITCHBOARD" ? getEquipmentPassports(equipment.id) : Promise.resolve([]),
    getEquipmentKnowledge(equipment.id),
    isLightCard(equipment.type) ? Promise.resolve(null) : getEquipmentHealth(equipment.id, plantId),
    // Fáze 111: identifikační štítek z registru (EL-xxxxxx), bez přidělení
    equipmentLabelSerial(prisma, equipment.id),
    // Fáze 116: životnost součástek napárovaná na kusovník zobrazené revize a Červenky stroje
    isLightCard(equipment.type) ? Promise.resolve(null) : getEquipmentLifespan(equipment.id, selected?.id ?? null),
    isLightCard(equipment.type) ? Promise.resolve([]) : getEquipmentRedlines(equipment.id),
    getCurrentUser(),
  ]);
  const catalog = lifespan ? await getCatalogParts(lifespan.rows.map(({ row }) => row.partNumber)) : new Map();
  const lifespanRows = lifespan ? lifespan.rows.map((entry) => toRowView(entry, catalog)) : [];
  const purchaseHref = account.can("submitChange") ? `/nakupni-report?zavod=${plantId}` : null;
  // Fáze 46: knihovna návodů / datasheetů a verzované zálohy řídicího SW
  const libraryDocuments = knowledge.documents.map((document) => ({
    id: document.id,
    category: document.category,
    title: document.title,
    componentTag: document.componentTag,
    manufacturer: document.manufacturer,
    modelNumber: document.modelNumber,
    version: document.version,
    language: document.language,
    fileUrl: document.fileUrl,
    fileName: document.fileName,
    fileSizeBytes: document.fileSizeBytes,
    createdAt: document.createdAt.toISOString(),
    uploadedBy: document.uploadedBy?.name ?? null,
  }));
  const docsPanel = (
    <div className="space-y-6">
      {/* Fáze 116: oficiální technické listy součástek z kusovníku */}
      <BomDatasheets rows={lifespanRows} />
      <DocumentLibrary
        equipmentId={equipment.id}
        documents={libraryDocuments}
        canUpload={account.can("submitChange") || account.can("recordInspection") || account.can("caeOffice")}
        canDelete={account.can("submitChange") || account.can("caeOffice")}
      />
    </div>
  );
  const docsCount = libraryDocuments.length + verifiedDatasheetCount(lifespanRows);
  const softwarePanel = hasSoftwareTab(equipment.type) ? (
    <SoftwareBackups
      equipmentId={equipment.id}
      backups={knowledge.backups.map((backup) => ({
        id: backup.id,
        targetUnit: backup.targetUnit,
        platform: backup.platform,
        major: backup.major,
        minor: backup.minor,
        status: backup.status,
        firmwareVersion: backup.firmwareVersion,
        isSafetyRelated: backup.isSafetyRelated,
        safetyChecksum: backup.safetyChecksum,
        changeSummary: backup.changeSummary,
        fileUrl: backup.fileUrl,
        fileName: backup.fileName,
        fileSizeBytes: backup.fileSizeBytes,
        createdAt: backup.createdAt.toISOString(),
        author: backup.author?.name ?? null,
        changeRequest: backup.changeRequest,
      }))}
      changes={knowledge.changes.map((change) => ({
        id: change.id,
        number: change.number,
        requiresSoftwareUpdate: change.requiresSoftwareUpdate,
        hasBackup: knowledge.backups.some((backup) => backup.changeRequest?.id === change.id),
      }))}
      canUpload={account.can("submitChange") || account.can("caeOffice")}
      ticketBase={role === "CAE_ENGINEER" && modules.on("cae.ticketing") ? "/cae/tickets/" : null}
    />
  ) : null;
  const today = pragueToday(now);
  // Spotřebiče, nářadí a bezpečnostní zařízení: lehká karta jen s revizemi a měřením.
  const light = isLightCard(equipment.type);
  const activeMods = equipment.temporaryMods.filter((mod) => mod.status === "ACTIVE");
  // Fáze 66: lhůta podle účelu objektu, provedení a prostoru (NV 190/2022 Sb., příloha č. 4)
  const rule = inspectionRuleFor(ruleInputFrom(equipment, building));
  const lastReport = equipment.inspections.find((record) => record.type === "INITIAL" || record.type === "PERIODIC") ?? null;
  const reportDefaultTexts = reportDefaults(
    {
      equipment,
      location: `${building.name} › ${floor.name}`,
      kind: rule.kind,
      type: "PERIODIC",
      previous: lastReport,
      activeRevision: equipment.revisions.find((revision) => revision.status === "ACTIVE") ?? null,
      influencesProtocol: equipment.complianceDocuments.find((document) => document.category === "EXTERNAL_INFLUENCES") ?? null,
      activeTemporaryMods: activeMods.length,
    },
    { evaluation: true },
  );
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
  // Fáze 53: prediktivní údržba – životnost součástek a přívodní kabel (záložka Diagnostika + indikátor v hlavičce)
  const canEditHealth = account.can("submitChange") || account.can("recordInspection");
  // Fáze 116: součástky po životnosti / v okně upozornění včetně dílů kusovníku s automatickým modelem
  const wornComponents = lifespanRows.filter(isCriticalRow);
  const worstWear = wornComponents.some((row) => row.assessment?.expired || row.assessment?.status === "CRITICAL_EXPIRED") ? "CRITICAL_EXPIRED" : wornComponents.length ? "PLAN_REPLACEMENT" : null;
  const cableStatus = health?.feeder.check?.status ?? null;
  const healthPanel = health ? (
    <div className="space-y-6">
      <ComponentLifespan
        equipmentId={equipment.id}
        revisionId={lifespan?.revisionId ?? null}
        rows={lifespanRows}
        profile={health.profile}
        alertDays={lifespan?.alertDays ?? equipment.lifespanAlertDays}
        bom={bom.map((item) => ({ designation: item.designation, description: item.description, manufacturer: item.manufacturer, partNumber: item.partNumber }))}
        canEdit={canEditHealth}
        bomHref={`${basePath}?tab=bom`}
        purchaseHref={purchaseHref}
      />
      <FeederCableCard
        equipmentId={equipment.id}
        tag={equipment.tag}
        parentTag={health.feeder.parentTag}
        cable={health.feeder.cable}
        check={health.feeder.check}
        nominalCurrentA={health.feeder.nominalCurrentA}
        measuredCurrentA={health.feeder.measuredCurrentA}
        nodes={health.nodes}
        canEdit={canEditHealth}
      />
      {panelModel ? <LazyPanelDiagnostics model={panelModel} /> : null}
    </div>
  ) : null;
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
      building={{ name: building.name, type: building.type, crowdOver200: building.crowdOver200 }}
      settings={{
        externalInfluences: equipment.externalInfluences,
        installationKind: equipment.installationKind,
        lpsCritical: equipment.lpsCritical,
        preventiveMaintenance: equipment.preventiveMaintenance,
        usageGroup: equipment.usageGroup,
        protectionClass: equipment.protectionClass,
        handHeld: equipment.handHeld,
        intervalMonths: equipment.inspectionIntervalMonths,
        inspectionVariant: equipment.inspectionVariant,
      }}
      ratedVoltage={equipment.ratedVoltage}
      reportDefaults={reportDefaultTexts}
      canRecord={account.can("recordInspection")}
      canResolveDefects={account.can("resolveDefects")}
      showReports={modules.on("inspections.pdf_reports")}
    />
  );

  // Fáze 116: kompaktní identifikační pruh (fotka, výrobní štítek + AI, QR štítek) pod lištou záložek
  const identityStrip = (
    <EquipmentIdentityStrip tag={equipment.tag}>
      <EquipmentPhotoCard
        compact
        equipmentId={equipment.id}
        tag={equipment.tag}
        name={equipment.name}
        type={equipment.type}
        photoUrl={equipment.photoUrl}
        inspection={showInspections ? inspection : null}
        documentStatus={light ? null : equipment.status}
        canEdit={canEditCard}
      />
      <NameplateCard
        compact
        equipmentId={equipment.id}
        tag={equipment.tag}
        photoUrl={equipment.nameplatePhotoUrl}
        readAt={equipment.nameplateReadAt?.toISOString() ?? null}
        reading={parseReading(equipment.nameplateDataJson)}
        current={{
          title: titleWithoutTag(equipment.name, equipment.tag),
          manufacturer: equipment.manufacturer,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          ratedVoltage: equipment.ratedVoltage,
          ipRating: equipment.ipRating,
          protectionClass: equipment.protectionClass,
          usageGroup: equipment.usageGroup,
          handHeld: equipment.handHeld,
        }}
        label={idLabelData(equipment, { serial: labelSerial, building: building.name, floor: floor.name, validUntil: inspection.validUntil })}
        canEdit={canEditCard}
      />
      <LazyQrLabelCard compact label={label} printHref={`${basePath}/label`} canEdit={canEditCard} />
    </EquipmentIdentityStrip>
  );

  // Zálohování napájení, rozváděč z BIMu a pasport AI Panel Builderu – v záložce Pasport & Shoda
  const passportExtras = (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Fáze 93: zálohování napájení rozváděče / zdroje a nájemní jednotka / zdravotnické oddělení */}
      {hasBackupTier(equipment.type) ? (
        <PowerBackupCard
          equipmentId={equipment.id}
          tag={equipment.tag}
          tier={isPowerBackupTier(equipment.powerBackupTier) ? equipment.powerBackupTier : "GRID_STANDARD"}
          capacityKva={equipment.backupCapacityKva}
          tenantUnit={equipment.tenantUnit}
          tiered
          canEdit={canEditCard || account.can("studio")}
        />
      ) : null}
      {/* Fáze 95: rozváděč z BIMu → návrh vnitřního osazení v AI Panel Builderu (vývody k napájeným zařízením) */}
      {equipment.type === "SWITCHBOARD" && equipment.bimGuid && account.can("panelBuilder") && modules.on("enterprise.ai_panel_builder") ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4" data-testid="bim-board-card">
          <div className="min-w-0 flex-1">
            <p className="font-medium">Rozváděč z BIM modelu</p>
            <p className="text-xs text-muted-foreground">
              Napájí {equipment.feeds.length} zařízení{equipment.ratedCurrent ? ` · In ${equipment.ratedCurrent}` : ""}
              {equipment.ratedPowerKw ? ` · P ${equipment.ratedPowerKw.toLocaleString("cs-CZ")} kW` : ""} – AI Panel Builder z nich složí DIN lišty s jističi, hlavním vypínačem a skříní (1 kredit).
            </p>
          </div>
          <BimBoardButton equipmentId={equipment.id} feeds={equipment.feeds.length} />
        </div>
      ) : null}
      {/* Pasport z AI Panel Builderu (propuštěná dokumentace rozváděče) */}
      {passports.map((passport) => (
        <div key={passport.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4" data-testid="panel-passport">
          <CircuitBoard className="size-5 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Pasport rozváděče <span className="font-mono">{passport.code}</span> – {passport.name}
            </p>
            <p className="text-xs text-muted-foreground">Výkres osazení, 1P schéma, kusovník, oteplení, prohlášení o shodě a CE štítek{passport.releasedAt ? ` · propuštěno ${formatDate(passport.releasedAt)}` : ""}</p>
          </div>
          {account.can("panelBuilder") && modules.on("enterprise.ai_panel_builder") ? (
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/panel-builder/${passport.id}/documentation`}>Otevřít dokumentaci</Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );

  // Fáze 116: předvyplnění dokumentů pasportu (prohlášení, kusová zkouška, liniové schéma, oteplení, vnější vlivy)
  const canEditPassport = account.can("submitChange") || account.can("caeOffice") || account.can("studio");
  const activeRevision = equipment.revisions.find((revision) => revision.status === "ACTIVE") ?? null;
  const amps = Number(/\d+/.exec(equipment.ratedCurrent ?? "")?.[0] ?? 0) || null;
  const rails = layoutCabinet(bom).length;
  const passportGenerator: PassportGeneratorContext | null =
    equipment.type === "SWITCHBOARD" && canEditPassport
      ? {
          equipmentId: equipment.id,
          tag: equipment.tag,
          today,
          author: user.name,
          conformity: {
            manufacturer: equipment.manufacturer ?? "",
            manufacturerAddress: "",
            product: `Rozváděč ${equipment.tag} – ${titleWithoutTag(equipment.name, equipment.tag)}`,
            typeDesignation: equipment.model ?? equipment.tag,
            serialNumber: equipment.serialNumber ?? "",
            place: building.plant.city ?? "",
          },
          revision: activeRevision ? { id: activeRevision.id, version: activeRevision.version, schematicUrl: activeRevision.schematicUrl, sheetCount: activeRevision.sheetCount } : null,
          thermal: {
            enclosure: suggestEnclosure(rails, amps),
            enclosureNote: `Rozměr skříně je odhadnutý z kusovníku (${rails} ${rails === 1 ? "lišta" : rails <= 4 ? "lišty" : "lišt"}) – přepište ho podle skutečné skříně. Ztrátový výkon: technický list / katalog výrobce, ostatní doplňte (W při jmenovitém proudu).`,
            ambientTempC: 35,
            maxRiseK: 30,
            losses: bom
              .filter((item) => {
                const kind = classifyComponent({ designation: item.designation, description: item.description });
                return kind !== "TERMINAL" && kind !== "OTHER";
              })
              .map((item) => {
                const loss = lossOf(item.partNumber, item.partNumber ? (catalog.get(partKeyOf(item.partNumber)) ?? null) : null);
                return { designation: item.designation, description: [item.description, item.manufacturer, item.partNumber].filter(Boolean).join(" · "), quantity: Math.max(1, Math.round(item.quantity)), lossW: loss?.lossW ?? null, source: loss?.source ?? "doplňte údaj výrobce" };
              }),
          },
          influences: { codes: influenceCodesFrom(equipment.externalInfluences), space: `${building.name} › ${floor.name}${equipment.assignedZone ? ` › ${equipment.assignedZone}` : ""}`, chair: user.name },
        }
      : null;

  // Upozornění nad obsahem záložek (neplatný QR, zneplatněná revize, otevřená změna, dočasné úpravy) + identifikační pruh
  const beforeContent = (
    <div className="flex flex-col gap-3">
      {labelCheck === "replaced" ? (
        <Alert variant="destructive" data-testid="qr-label-replaced">
          <ShieldX />
          <AlertTitle>Neplatný QR štítek</AlertTitle>
          <AlertDescription>
            Naskenovaný štítek u {equipment.tag} byl nahrazen novým kódem a už neplatí. Ověřte, že jste u správného zařízení, a nahlaste výměnu štítku – platný štítek vytisknete v identifikačním pruhu níže.
          </AlertDescription>
        </Alert>
      ) : null}
      {/* Fáze 108: revize zneplatněná technikem (podezření ze zneužití osvědčení TIČR) – červené varování */}
      {equipment.inspections
        .filter((record) => record.misuseFlaggedAt)
        .slice(0, 3)
        .map((record) => (
          <Alert key={`misuse-${record.id}`} variant="destructive" data-testid="revision-misuse-banner">
            <ShieldX />
            <AlertTitle>{MISUSE_BANNER}</AlertTitle>
            <AlertDescription>
              Záznam {record.reportNumber} ze dne {record.inspectionDate.toLocaleDateString("cs-CZ")} (technik {record.inspectorName}, osvědčení {record.inspectorLicense}) je zablokovaný a do platnosti revize se nepočítá.
              {record.misuseNote ? ` Poznámka technika: ${record.misuseNote}` : ""}
            </AlertDescription>
          </Alert>
        ))}
      {/* Fáze 108: formulář revizního technika z karty rozváděče / stroje a po naskenování QR štítku */}
      {account.can("recordInspection") ? <SignedRevisionEntry equipment={{ id: equipment.id, tag: equipment.tag, name: equipment.name }} today={pragueToday(now)} scanned={labelCheck === "valid"} /> : null}
      {fieldView ? <FieldQuickActions basePath={basePath} changeHref={`${basePath}/change-request`} openNumber={openChange?.number ?? null} canSubmit={account.can("submitChange")} /> : null}
      {openChange ? <SafetyBanner change={openChange} pendingRevision={pending} reviewHref={`${basePath}/approve`} canReview={account.can("approveRevision")} now={now} /> : null}
      {activeMods.map((mod) => (
        <TemporaryModBanner key={mod.id} mod={mod} version={active?.version ? active.version : null} now={now} canResolve={account.can("temporaryMods")} />
      ))}
      {identityStrip}
    </div>
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
              {worstWear ? (
                <Link href={`${basePath}?tab=diagnostics`} className={`rounded-full border border-current px-2.5 py-0.5 text-sm font-semibold ${LIFESPAN_STATUS[worstWear].text}`} data-testid="health-wear-badge">
                  ⏳ {wornComponents.length}× součástka před koncem životnosti
                </Link>
              ) : null}
              {cableStatus && cableStatus !== "OK" ? (
                <Link href={`${basePath}?tab=diagnostics`} className={`rounded-full border border-current px-2.5 py-0.5 text-sm font-semibold ${CABLE_STATUS[cableStatus].text}`} data-testid="health-cable-badge">
                  🔌 {cableStatus === "CRITICAL" ? "Přetížený / nejištěný přívod" : "Přívod s nízkou rezervou"}
                </Link>
              ) : null}
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
              {hasBackupTier(equipment.type) && equipment.powerBackupTier !== "GRID_STANDARD" ? (
                <span className="rounded px-1.5 font-mono text-xs font-bold text-white" style={{ background: tierOf(equipment.powerBackupTier).color }} data-testid="header-backup-tier">
                  {tierOf(equipment.powerBackupTier).badge}
                </span>
              ) : null}
              {equipment.tenantUnit ? <span data-testid="header-tenant-unit">🏬 {equipment.tenantUnit}</span> : null}
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
              {fieldView ? null : (
              <Button asChild variant="outline" className="touch-target gap-2">
                <a href="#qr-stitek">
                  <QrCode className="size-4" />
                  QR štítek
                </a>
              </Button>
              )}
              {!light && account.can("temporaryMods") ? <TemporaryModDialog equipmentId={equipment.id} tag={equipment.tag} version={active?.version ?? null} /> : null}
              {light || fieldView ? null : account.can("submitChange") ? (
                <ChangeRequestCta href={`${basePath}/change-request`} openNumber={openChange?.number ?? null} />
              ) : openChange && role === "CAE_ENGINEER" && modules.on("cae.ticketing") ? (
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

        {light ? (
          <DocumentationTabs
            panels={{ inspections: inspectionsPanel, docs: docsPanel }}
            defaultTab="inspections"
            labels={{ inspections: `Revize & Měření (${rule.standard})`, docs: `📚 Návody & Datasheety (${docsCount})` }}
            beforeContent={beforeContent}
          />
        ) : (
          <div id="dokumentace" className="scroll-mt-24">
          <DocumentationTabs
            labels={{ ...(fieldView ? { passport: "LOTO – bezpečné odpojení" } : {}), redlines: `✏️ Červenky (${redlines.length})`, docs: `📚 Návody & Datasheety (${docsCount})` }}
            beforeContent={beforeContent}
            panels={{
              schema: (
                <div className="space-y-3">
                {redlines.length ? <RedlinesSummary redlines={redlines} basePath={basePath} /> : null}
                <SchematicViewer
                  compare={modules.on("cae.visual_diff") ? "on" : modules.upsell ? "locked" : "off"}
                  interactiveLocked={!modules.on("cae.hotspots") && modules.upsell && !isLightCard(equipment.type)}
                  canManageModules={account.can("manageModules")}
                  interactive={
                    selected && modules.on("cae.hotspots") && (references.length || canEditReferences)
                      ? {
                          count: references.length,
                          node: (
                            <LazyInteractiveSchematic
                              key={selected.id}
                              revision={{ id: selected.id, version: selected.version, url: selected.schematicUrl, format: selected.schematicFormat, sheetCount: selected.sheetCount }}
                              references={references}
                              linkable={linkable}
                              canEdit={canEditReferences}
                              datasheets={libraryDocuments}
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
                </div>
              ),
              // Fáze 116: kusovník s prediktivní životností součástek a oficiálními datasheety
              bom: lifespan ? (
                <BomLifespanTable
                  equipmentId={equipment.id}
                  revisionId={lifespan.revisionId}
                  version={selected?.version ?? null}
                  rows={lifespanRows}
                  profile={lifespan.profile}
                  alertDays={lifespan.alertDays}
                  canEdit={canEditHealth}
                  purchaseHref={purchaseHref}
                  fileName={`kusovnik-${equipment.tag}-${selected?.version ?? "bez-revize"}.csv`}
                />
              ) : null,
              redlines: (
                <EquipmentRedlines
                  redlines={redlines}
                  changeHref={`${basePath}/change-request`}
                  canSubmit={account.can("submitChange")}
                  designer={building.plant.designerEmail || building.plant.designerName ? { name: building.plant.designerName, email: building.plant.designerEmail } : null}
                  ticketBase={role === "CAE_ENGINEER" && modules.on("cae.ticketing") ? "/cae/tickets/" : null}
                  approveHref={account.can("approveRevision") ? `${basePath}/approve` : null}
                />
              ),
              "3d": selected ? <LazyCabinet3D bom={bom} tag={equipment.tag} /> : null,
              docs: docsPanel,
              ...(softwarePanel ? { software: softwarePanel } : {}),
              history: (
                <div className="space-y-8">
                  <RevisionTimeline revisions={equipment.revisions} basePath={basePath} selectedId={selected?.id ?? null} />
                  <TemporaryModArchive mods={equipment.temporaryMods} canOpenTicket={role === "CAE_ENGINEER"} />
                </div>
              ),
              passport: fieldView ? (
                <LotoCard equipment={equipment} nodes={powerNodes} />
              ) : (
                <div className="space-y-8">
                  {passportExtras}
                  <LotoCard equipment={equipment} nodes={powerNodes} canEdit={canEditPassport} />
                  <BatteryPassportCard json={equipment.batteryPassportJson} />
                  <CompliancePassport equipment={equipment} generator={passportGenerator} />
                </div>
              ),
              // CAE projektant lhůtník revizí nevidí, terénní pohled ho nemá jako záložku (stav je v hlavičce).
              ...(showInspections && !fieldView ? { inspections: inspectionsPanel } : {}),
              ...(healthPanel ? { diagnostics: healthPanel } : panelModel ? { diagnostics: <LazyPanelDiagnostics model={panelModel} /> } : {}),
            }}
          />
          </div>
        )}

      </div>
    </PageTransition>
  );
}
