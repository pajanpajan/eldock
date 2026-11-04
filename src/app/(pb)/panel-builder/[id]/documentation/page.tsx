import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { DocumentationActions } from "@/components/panel-builder/documentation/DocumentationActions";
import { DocumentationSheets, type DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { PanelSteps } from "@/components/panel-builder/PanelSteps";
import { ProjectHeader } from "@/components/panel-builder/ProjectHeader";
import { formatDate } from "@/lib/format";
import { isMix } from "@/lib/panel-builder/catalog";
import { componentsList, partsList, technicalData } from "@/lib/panel-builder/documentation";
import { renderPanelDrawingSvg, renderSingleLineDiagramSvg, type DrawingItem } from "@/lib/panel-builder/drawings";
import { parseManufacturerInfo } from "@/lib/panel-builder/project";
import { companyManufacturer } from "@/lib/registered-company";
import { readingOrder } from "@/lib/panel-builder/tree";
import { equipmentHref } from "@/lib/routes";
import { getEnclosureComponent, getPanelProject, getProjectEnclosure, getReleaseTargets } from "@/server/queries/panel-builder";
import { requestOrigin } from "@/server/request-url";
import { parseRoutineTest, standardEditionOf, type StandardEditionId } from "@/lib/legislation-2027";
import { RoutineTestPanel, StandardEditionSelect } from "@/components/panel-builder/documentation/RoutineTestPanel";
import { documentationState } from "@/server/services/panel-builder";

export async function generateMetadata({ params }: PageProps<"/panel-builder/[id]/documentation">): Promise<Metadata> {
  const project = await getPanelProject((await params).id);
  return { title: project ? `${project.code} – dokumentace rozváděče` : "Dokumentace rozváděče" };
}

const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Krok 4: kompletní elaborát rozváděče (6 listů A4) k tisku / PDF a propuštění do provozu.
export default async function PanelDocumentationPage({ params }: PageProps<"/panel-builder/[id]/documentation">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const project = await getPanelProject((await params).id);
  if (!project) notFound();
  const [enclosureRow, picked, targets, origin] = await Promise.all([getEnclosureComponent(project.enclosureModel), getProjectEnclosure(project.enclosureId), getReleaseTargets(), requestOrigin()]);

  const { thermal, docItems, blockers } = documentationState(project);
  // Skříň vybraná z katalogu rozvodnic (fáze 43) má přednost před dohledáním podle názvu modelu
  const enclosure = picked
    ? { articleNumber: picked.articleNumber, typeCode: picked.model, manufacturer: picked.manufacturer, description: `Skříň rozváděče ${picked.model}, ${picked.rows}× ${picked.modulesPerRow} M, ${picked.heightMm} × ${picked.widthMm} × ${picked.depthMm} mm, ${picked.ipRating}`, category: "ENCLOSURE" as const }
    : enclosureRow
    ? { articleNumber: enclosureRow.articleNumber, typeCode: enclosureRow.typeCode, manufacturer: enclosureRow.manufacturer, description: enclosureRow.description, category: enclosureRow.category }
    : null;
  const drawingItems: DrawingItem[] = project.items.map((item) => ({
    id: item.id,
    designation: item.designation,
    typeCode: item.customTypeCode ?? item.catalogComponent?.typeCode ?? "?",
    manufacturer: item.catalogComponent?.manufacturer ?? null,
    category: item.catalogComponent?.category ?? null,
    poles: item.catalogComponent?.poles ?? null,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    modulesWidth: item.modulesWidth,
    parentItemId: item.parentItemId,
    fedFromIncomer: item.fedFromIncomer,
    phaseAssignment: item.phaseAssignment,
    circuitLabel: item.circuitLabel,
  }));
  const main = project.items.find((item) => item.catalogComponent?.category === "MAIN_SWITCH" && !item.parentItemId)?.catalogComponent ?? null;
  const date = project.releasedAt ?? project.updatedAt;
  const manufacturers = [...new Set(project.items.map((item) => item.catalogComponent?.manufacturer).filter(Boolean))];
  const incomer = project.networkSystem.includes("TN-C ") ? "L1,L2,L3,PEN" : "L1,L2,L3,N";

  const edition = standardEditionOf(project.standardEdition);
  const routineTest = parseRoutineTest(project.routineTestJson);
  const data: DocumentationData = {
    code: project.code,
    name: project.name,
    customerName: project.customerName,
    norm: edition.short,
    edition,
    routineTest,
    enclosure: [project.enclosureModel, `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`, project.ipRating].filter(Boolean).join(" · "),
    // Registrovaná firma = výrobce rozváděče (vždy aktuální „Firemní údaje do razítka“), jinak údaje projektu
    manufacturer: project.company ? companyManufacturer(project.company) : parseManufacturerInfo(project.manufacturerInfoJson),
    date: formatDate(date),
    year: String(date.getFullYear()),
    panelDrawingSvg: renderPanelDrawingSvg(project, drawingItems, project.enclosureModel),
    singleLineSvg: renderSingleLineDiagramSvg(drawingItems, { incomer, network: project.networkSystem }),
    functions: readingOrder(project.items).map((item) => ({ designation: item.designation, label: item.circuitLabel })),
    parts: partsList(docItems, enclosure),
    components: componentsList(docItems, enclosure),
    wiring: project.items.flatMap((item) =>
      item.wiringDevices.map((row) => ({
        designation: item.designation,
        circuit: item.circuitLabel,
        room: row.room,
        quantity: row.quantity,
        articleNumber: row.wiringDevice.articleNumber.replace(/^[A-Z]+:/, ""),
        title: row.wiringDevice.title,
      })),
    ),
    thermal,
    ambientTempC: project.ambientTempC,
    technical: technicalData(project, thermal, main?.ratedCurrentA ?? null),
    label: {
      operatingVoltage: project.networkSystem,
      operatingCurrent: `${n(thermal.operatingCurrentA)} A`,
      shortCircuit: `${n(project.shortCircuitKa, 0)} kA`,
      ipRating: project.ipRating,
      mainBreaker: main ? `${n(main.ratedCurrentA, 0)} A` : "–",
      type: enclosure?.typeCode ?? (project.enclosureModel || "–"),
      deviceManufacturer: manufacturers.join(", ") || (isMix(project.dominantManufacturer) ? "Různí výrobci" : project.dominantManufacturer),
    },
    logoUrl: project.company?.logoUrl ?? null,
    stampUrl: project.company?.stampUrl ?? null,
    qrUrl: project.equipmentId ? `${origin}${equipmentHref(project.equipmentId)}` : `${origin}/panel-builder/${project.id}/documentation`,
  };

  return (
    <PageTransition>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          main { padding: 0 !important; max-width: none !important; display: block !important; }
          .no-print { display: none !important; }
          .doc-sheets { display: block !important; gap: 0 !important; }
          .doc-sheet { max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .doc-sheet:last-child { break-after: auto; }
        }
      `}</style>
      <div className="no-print">
        <ProjectHeader project={project} />
        <PanelSteps projectId={project.id} current="documentation" design={project.designMode === "DESIGN"} />
      </div>
      <div className="flex flex-col gap-6">
        <DocumentationActions
          projectId={project.id}
          released={project.equipment && project.status === "COMPLETED" ? { equipmentId: project.equipment.id, tag: project.equipment.tag, name: project.equipment.name } : null}
          blockers={blockers}
          targets={targets.map((target) => ({ id: target.id, tag: target.tag, label: `${target.name} · ${target.floor.building.plant.name}, ${target.floor.building.name}` }))}
        />
        <div className="no-print grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-card p-4">
            <StandardEditionSelect projectId={project.id} value={edition.id as StandardEditionId} />
            <p className="mt-2 text-xs text-muted-foreground">Propisuje se do Listu 5 (oteplení) a Listu 6 (EU prohlášení o shodě, štítek CE).</p>
          </div>
          <RoutineTestPanel projectId={project.id} initial={routineTest} />
        </div>
        <DocumentationSheets data={data} />
      </div>
    </PageTransition>
  );
}
