import "server-only";

import type { DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { formatDate } from "@/lib/format";
import { isMix } from "@/lib/panel-builder/catalog";
import { componentsList, partsList, technicalData } from "@/lib/panel-builder/documentation";
import { renderPanelDrawingSvg, renderSingleLineDiagramSvg, type DrawingItem } from "@/lib/panel-builder/drawings";
import { parseManufacturerInfo } from "@/lib/panel-builder/project";
import { companyManufacturer } from "@/lib/registered-company";
import { readingOrder } from "@/lib/panel-builder/tree";
import { equipmentHref } from "@/lib/routes";
import { parseRoutineTest, standardEditionOf } from "@/lib/legislation-2027";
import { getEnclosureComponent, getProjectEnclosure, type PanelProjectDetail } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

// Sestavení 6listového elaborátu rozváděče (krok 4) – sdílí ho dokumentace projektu i veřejná
// ukázka vzorového PB-001 na úvodní stránce (fáze 48).

const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export async function buildDocumentationData(project: PanelProjectDetail, origin: string, options: { showcase?: boolean } = {}) {
  const [enclosureRow, picked] = await Promise.all([getEnclosureComponent(project.enclosureModel), getProjectEnclosure(project.enclosureId)]);
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
    installationSite: project.installationSite,
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

  if (options.showcase) {
    // Veřejná ukázka: bez nahraných log a razítek (soubory jsou jen pro přihlášené), QR na ukázku
    data.logoUrl = null;
    data.stampUrl = null;
    data.qrUrl = `${origin}/ukazka-elaboratu`;
  }
  return { data, blockers, edition, routineTest };
}
