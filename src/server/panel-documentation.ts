import "server-only";

import type { DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { formatDate } from "@/lib/format";
import { isMix } from "@/lib/panel-builder/catalog";
import { componentsList, partsList, technicalData } from "@/lib/panel-builder/documentation";
import { MAIN_BOARD } from "@/engine/floorplan-bridge";
import { drawingSymbolOf, renderPanelDrawingSvg, renderSingleLineDiagramSvg, type DrawingItem, type HotspotSink } from "@/lib/panel-builder/drawings";
import { symbolKindOf, symbolLegend } from "@/lib/panel-builder/iec-symbols";
import { LEGAL_FRAMEWORK, externalInfluencesProtocol, isFlushEnclosure } from "@/lib/panel-builder/external-influences";
import { analyzeDraft, floorsOf, parseCableReport, parseDraft, switchFloor, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { planScaleFor } from "@/lib/panel-builder/plan-sheet";
import { displayRoutes } from "@/lib/panel-builder/route-display";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { parseManufacturerInfo } from "@/lib/panel-builder/project";
import { companyManufacturer } from "@/lib/registered-company";
import { isConnected, proposeTree, readingOrder, treeNodeFrom } from "@/lib/panel-builder/tree";
import { supplyOf } from "@/lib/panel-builder/supply";
import { busbarPartsRows, planBusbars } from "@/lib/panel-builder/pe-n-busbars";
import { equipmentHref } from "@/lib/routes";
import { parseRoutineTest, standardEditionOf } from "@/lib/legislation-2027";
import { getEnclosureComponent, getLinkedBoards, getProjectEnclosure, type PanelProjectDetail } from "@/server/queries/panel-builder";
import { parseFeederInfo } from "@/server/services/panel-projects";
import { documentationState } from "@/server/services/panel-builder";

// Sestavení 6listového elaborátu rozváděče (krok 5) – sdílí ho dokumentace projektu i veřejná
// ukázka vzorového PB-001 na úvodní stránce (fáze 48).

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

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
    // Fáze 58: značka dle ČSN EN 60617 podle kategorie a podtypu katalogového prvku
    symbol: symbolKindOf(item.catalogComponent ?? { category: null }),
  }));
  // Fáze 55: veřejná ukázka má vždy úplný strom – nezapojené prvky dostanou navržené zapojení jen pro vykreslení
  // (List 2 spojnice, List 3 jednopólové schéma bez „Nezapojeno ve stromu“); databáze se nemění.
  if (options.showcase) {
    const nodes = project.items.map(treeNodeFrom);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    if (!nodes.every((node) => isConnected(node.id, byId))) {
      const proposal = proposeTree(nodes, null, { supplyPhases: supplyOf(project).phases });
      for (const item of drawingItems) Object.assign(item, proposal.get(item.id));
    }
  }
  const main = project.items.find((item) => item.catalogComponent?.category === "MAIN_SWITCH" && !item.parentItemId)?.catalogComponent ?? null;
  const date = project.releasedAt ?? project.updatedAt;
  const manufacturers = [...new Set(project.items.map((item) => item.catalogComponent?.manufacturer).filter(Boolean))];
  // Fáze 55: vodiče přívodu podle soustavy (1f / 3f, TN-C-S = PEN)
  const supply = supplyOf(project);
  const incomer = supply.conductors;
  const busbars = planBusbars(drawingItems, supply);

  // Fáze 55: kusovník domovní instalace z uloženého nákresu 2D půdorysu (projekt z půdorysu)
  const cableReport = parseCableReport(project.cableReportJson);
  const draft = project.floorplanJson ? parseDraft(safeJson(project.floorplanJson)) : null;
  const homeBom = draft ? compileFloorplanBom(draft, { installation: draft.installation, cables: cableReport?.byCable ?? [] }) : [];
  const edition = standardEditionOf(project.standardEdition);
  const routineTest = parseRoutineTest(project.routineTestJson);
  // Fáze 75: chytré PDF – klikací přístroje ve výkresech, příloha s půdorysem a propojené rozváděče
  const panelHotspots: HotspotSink = { hotspots: [], width: 0, height: 0 };
  const sldHotspots: HotspotSink = { hotspots: [], width: 0, height: 0 };
  const floorplanSheets = draft ? floorplanAnnex(draft, project.boardCode) : undefined;
  const boards = project.boardCode ? await linkedBoardsOf(project, origin) : undefined;
  const data: DocumentationData = {
    panelHotspots,
    sldHotspots,
    ...(floorplanSheets?.length ? { floorplanSheets } : {}),
    ...(boards ? { boards } : {}),
    code: project.code,
    name: project.name,
    customerName: project.customerName,
    installationSite: project.installationSite,
    cableReport,
    // Fáze 52: legislativní rámec (vyhl. 131/2024 Sb.) a protokol o určení vnějších vlivů z prostředí instalace
    legalFramework: LEGAL_FRAMEWORK,
    influences: externalInfluencesProtocol(project.environment),
    fullCover: isFlushEnclosure([project.enclosureModel, enclosure?.description].filter(Boolean).join(" ")),
    norm: edition.short,
    edition,
    routineTest,
    enclosure: [project.enclosureModel, `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`, project.ipRating].filter(Boolean).join(" · "),
    // Registrovaná firma = výrobce rozváděče (vždy aktuální „Firemní údaje do razítka“), jinak údaje projektu
    manufacturer: project.company ? companyManufacturer(project.company) : parseManufacturerInfo(project.manufacturerInfoJson),
    date: formatDate(date),
    year: String(date.getFullYear()),
    panelDrawingSvg: renderPanelDrawingSvg(project, drawingItems, project.enclosureModel, { plan: busbars, position: project.incomerFrom === "BOTTOM" ? "BOTTOM" : "TOP" }, panelHotspots),
    singleLineSvg: renderSingleLineDiagramSvg(drawingItems, { incomer, network: project.networkSystem }, sldHotspots),
    symbolLegend: symbolLegend(drawingItems.map(drawingSymbolOf)).map(({ info, svg }) => ({ label: info.label, norm: info.norm, svg })),
    functions: readingOrder(project.items).map((item) => ({ designation: item.designation, label: item.circuitLabel })),
    // Fáze 55: sběrnice PE / N0 / N-FIx a propojka PEN v kusovníku (List 4)
    parts: [...partsList(docItems, enclosure), ...busbarPartsRows(busbars)],
    components: componentsList(docItems, enclosure),
    homeBom,
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
    singlePhase: supply.phases === 1,
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

/**
 * Fáze 75: příloha dokumentace – půdorys každého podlaží s trasami okruhů tohoto rozváděče (hlavní rozváděč = okruhy
 * RH včetně přívodů podružných rozváděčů a sběrnice, podružný rozváděč = jen jeho okruhy). Chybný nákres přílohu vynechá.
 */
function floorplanAnnex(draft: FloorplanDraft, boardCode: string | null): NonNullable<DocumentationData["floorplanSheets"]> {
  try {
    const analysis = analyzeDraft(draft);
    const board = boardCode ?? MAIN_BOARD;
    return floorsOf(draft)
      .map((floor) => {
        const onFloor = switchFloor(draft, floor.id);
        const routes = displayRoutes(onFloor, analysis);
        return {
          floorId: floor.id,
          floorName: floor.name,
          scale: planScaleFor(onFloor, 190, 175),
          draft: onFloor,
          routes: { circuits: routes.circuits.filter((circuit) => circuit.board === board), bus: board === MAIN_BOARD ? routes.bus : null },
        };
      })
      .filter((sheet) => sheet.routes.circuits.length > 0);
  } catch {
    return [];
  }
}

/** Fáze 74: propojené rozváděče z jednoho půdorysu pro titulní list (odkazy na jejich dokumentaci). */
async function linkedBoardsOf(project: PanelProjectDetail, origin: string): Promise<DocumentationData["boards"]> {
  const { parent, children } = await getLinkedBoards(project);
  const feeder = parseFeederInfo(project.feederJson);
  return {
    code: project.boardCode ?? MAIN_BOARD,
    parent: parent ? { code: parent.boardCode ?? MAIN_BOARD, projectCode: parent.code, url: `${origin}/panel-builder/${parent.id}/documentation`, feeder } : null,
    children: children.map((child) => ({ code: child.boardCode ?? "RP", projectCode: child.code, name: child.name, url: `${origin}/panel-builder/${child.id}/documentation`, feeder: parseFeederInfo(child.feederJson) })),
  };
}
